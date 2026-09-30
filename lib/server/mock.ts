// Offline stand-in for the AI services, used when AI_MOCK=1 (local testing only).
import { pcmToWav } from './tts';

const range = <T>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));

function ieltsR() {
  return {
    title: 'Community sports centre',
    texts: [{ label: 'A', heading: 'Riverside Sports Centre', body: 'A The centre opens at 6 am on weekdays.\n\nB Members can book courts online up to seven days ahead.\n\nC Parking is free for the first two hours.' }],
    groups: [
      { type: 'tfng', instructions: 'Do the following statements agree with the information in the text? Write TRUE, FALSE or NOT GIVEN.', questions: range(5, (i) => ({ prompt: 'Statement ' + (i + 1) + ' about opening hours.', answer: ['TRUE'], evidence: 'The centre opens at 6 am on weekdays.', explain: 'Stated directly.' })) },
      { type: 'completion', instructions: 'Complete the sentences. Write NO MORE THAN TWO WORDS.', questions: range(5, (i) => ({ prompt: 'Courts can be booked ______ (' + (i + 1) + ').', answer: ['online'], evidence: 'Members can book courts online.', explain: 'Paraphrase of "book".' })) },
      { type: 'mcq', instructions: 'Choose the correct letter, A, B, C or D.', questions: range(4, () => ({ prompt: 'How long is parking free?', choices: ['One hour', 'Two hours', 'Three hours', 'All day'], answer: ['B'], evidence: 'Parking is free for the first two hours.', explain: 'Two hours.' })) }
    ]
  };
}
function ieltsL() {
  return {
    title: 'Booking a course',
    context: 'You will hear a woman calling a language school to book a course.',
    speakers: [{ name: 'Receptionist', gender: 'female' }, { name: 'Caller', gender: 'male' }],
    script: [
      { speaker: 'Receptionist', text: 'Good morning, Hartley Language School, how can I help?' },
      { speaker: 'Caller', text: 'Hi, I would like to book the evening French course. My name is Tom Hartley, that is H-A-R-T-L-E-Y.' },
      { speaker: 'Receptionist', text: 'Lovely. The course costs 150 pounds, sorry, 180 pounds, and starts on the 15th of May.' }
    ],
    groups: [{ type: 'completion', instructions: 'Complete the form. Write ONE WORD AND/OR A NUMBER.', questions: range(10, (i) => ({ prompt: 'Item ' + (i + 1) + ': ______', answer: i % 2 ? ['180'] : ['Hartley'], evidence: 'The course costs 180 pounds.', explain: 'The speaker corrects 150 to 180.' })) }]
  };
}
function tefDocs(listen: boolean) {
  const q = (i: number) => ({ prompt: 'Question ' + (i + 1) + ' : que propose le document ?', choices: ['Un cours de cuisine', 'Un appartement', 'Un voyage', 'Un emploi'], answer: 'B', evidence: 'Appartement à louer', explain: 'Le document parle d’un appartement.' });
  return {
    title: 'Logement',
    docs: [0, 1].map((d) => (listen
      ? { context: 'Vous allez entendre un message sur un répondeur.', speakers: [{ name: 'Agent', gender: 'female', accent: 'fr-FR' }], script: [{ speaker: 'Agent', text: 'Bonjour, c’est l’agence Soleil. L’appartement de la rue Victor-Hugo est toujours disponible, rappelez-nous avant jeudi.' }], questions: range(5, (i) => q(i + d * 5)) }
      : { kind: 'annonce', heading: 'Appartement à louer', body: 'Appartement 3 pièces, centre-ville.\nLoyer : 850 € charges comprises.\nLibre le 1er octobre.', questions: range(5, (i) => q(i + d * 5)) }))
  };
}

export function mockJSON(task: string): any {
  const [exam, kind, k] = String(task).split(':');
  if (exam === 'ielts') {
    if (kind === 'gen') return ({ R: ieltsR, L: ieltsL, W: () => ({ task1: { tone: 'formal', situation: 'You recently stayed at a hotel and left a bag in your room.', instruction: 'Write a letter to the hotel manager. In your letter', bullets: ['describe the bag', 'say where you left it', 'explain how it can be returned'], salutation: 'Dear Sir or Madam,' }, task2: { type: 'opinion', topic: 'Remote work', prompt: 'Some people think working from home is better for employees. To what extent do you agree or disagree?' } }), S: () => ({ part1: [{ topic: 'Work', questions: ['What do you do?', 'Do you enjoy your job?', 'What would you change about it?'] }, { topic: 'Weekends', questions: ['What do you usually do at weekends?', 'Did you do the same as a child?'] }, { topic: 'Music', questions: ['What music do you like?', 'Do you play an instrument?'] }], part2: { topic: 'A useful skill', card: 'Describe a skill that took you a long time to learn.', bullets: ['what the skill is', 'when and how you learned it', 'what difficulties you had'], final: 'and explain how you feel about this skill now.', followup: 'Do you still use it often?' }, part3: ['Should children learn practical skills at school?', 'Is it better to learn from parents or teachers?', 'How has technology changed learning?', 'Will robots replace teachers?', 'What skills will be important in the future?'] }) } as Record<string, () => any>)[k]();
    if (kind === 'markW') return { task1: { TA: 6, CC: 6, LR: 6, GRA: 5.5, band: 6, summary: 'Covers the bullets but lacks detail.' }, task2: { TR: 6, CC: 6.5, LR: 6, GRA: 6, band: 6, summary: 'Clear position, limited development.' }, errors: [{ quote: 'I am writing for inform you', fix: 'I am writing to inform you', reason: 'Infinitive of purpose.' }], patterns: ['Articles: "as software developer" → "as a software developer"'], model: { task: 'Task 2', original: 'Working from home is good.', band8: 'Remote work gives employees more control over their time.' }, next: ['Develop each idea with an example', 'Check articles', 'Use a wider range of linkers'] };
    if (kind === 'markS') return { FC: 6, LR: 6, GRA: 5.5, summary: 'Answers are short and need more development.', errors: [{ quote: 'I am working as software developer', fix: 'I work as a software developer', reason: 'Article and present simple for permanent states.' }], patterns: ['Short answers'], model: { task: 'What do you do?', original: 'I am developer.', band8: 'I work as a software developer for an international team, which I really enjoy.' }, next: ['Answer, reason, example', 'Use linking words', 'Fix articles'] };
    if (kind === 'course') return { title: 'Road to CLB 9', summary: 'Twelve units focused on your biggest gaps.', phases: [0, 1, 2].map((ph) => ({ name: 'Phase ' + (ph + 1), units: range(4, (i) => { const n = ph * 4 + i + 1; return { id: 'u' + n, skill: ['S', 'W', 'R', 'L'][n % 4], title: n % 4 === 0 ? 'Checkpoint' : 'Unit ' + n, goal: 'Practise one point', checkpoint: n % 4 === 0 }; }) })) };
    if (kind === 'lesson') return { intro: 'Articles matter.', teach: [{ heading: 'Jobs take "a"', body: 'Use a/an with jobs.', examples: [{ wrong: 'I am developer', right: 'I am a developer' }] }], phrases: [{ phrase: 'on my own', use: 'I built it on my own.' }], quiz: range(10, (i) => (i % 2 ? { type: 'gap', prompt: 'I work ___ a developer.', answer: ['as'], explain: 'as + job' } : { type: 'mcq', prompt: 'Choose the correct sentence.', choices: ['I am developer', 'I am a developer', 'I am the developer of all', 'I developer'], answer: 'B', explain: 'Article needed.' })), task: { kind: 'write', prompt: 'Describe your job in 100 words.', minWords: 100 } };
    if (kind === 'taskfb') return { band: 6, verdict: 'Good start.', used_point: 'Mostly yes.', errors: [], better: 'I work as a software developer.' };
    if (kind === 'real') return { items: [{ n: 1, cause: 'Spelling' }], patterns: ['Spelling of names'] };
  }
  if (exam === 'tef') {
    if (kind === 'gen') return ({ R: () => tefDocs(false), L: () => tefDocs(true), W: () => ({ A: { topic: 'Chien perdu', source: 'Le Parisien — Un chien a retrouvé seul le chemin de la maison après trois jours.', consigne: 'Terminez cet article en ajoutant un texte de 80 mots minimum.' }, B: { topic: 'Télétravail', statement: '« Le télétravail isole les salariés. » — forum', consigne: 'Vous écrivez un article (200 mots minimum) pour donner votre point de vue.' } }), S: () => ({ A: { topic: 'Cours de yoga', ad: 'Cours de yoga\nDébutants bienvenus\nRenseignements : 01 23 45 67 89', role: 'la réceptionniste du studio', facts: '20 € la séance, le mardi et le jeudi à 19 h.', opening: 'Studio Zen, bonjour !' }, B: { topic: 'Voyage', ad: 'Week-end à Tozeur, 299 TND', goal: 'partir en week-end à Tozeur', objections: ['C’est trop cher', 'Je n’ai pas le temps'], opening: 'Tozeur ? Mais il fait trop chaud là-bas, non ?' } }) } as Record<string, () => any>)[k]();
    if (kind === 'markW') return { score: 410, A: { summary: 'Suite cohérente.' }, B: { summary: 'Arguments peu développés.' }, criteria: [{ name: 'Lexique', level: 'B1', comment: 'Correct mais répétitif.' }], errors: [{ quote: 'je suis d’accord avec ça', fix: 'je partage cet avis', reason: 'Registre.' }], patterns: ['Accords du participe passé'], model: { task: 'Section B', original: 'Le télétravail est bien.', better: 'Le télétravail offre une souplesse précieuse.' }, next: ['Développer', 'Relire les accords', 'Varier les connecteurs'] };
    if (kind === 'markS') return { score: 440, summary: 'Interaction correcte.', criteria: [{ name: 'Interaction et registre', level: 'B1', comment: 'Vouvoiement respecté.' }], errors: [], patterns: [], model: null, next: ['Poser plus de questions'], missed_questions: ['Y a-t-il un cours d’essai ?'] };
    if (kind === 'course') return { title: 'Objectif NCLC 7', summary: 'Douze unités.', phases: [0, 1, 2].map((ph) => ({ name: 'Phase ' + (ph + 1), units: range(4, (i) => { const n = ph * 4 + i + 1; return { id: 'u' + n, skill: ['S', 'W', 'R', 'L'][n % 4], title: n % 4 === 0 ? 'Test d’étape' : 'Unité ' + n, goal: 'Un point', checkpoint: n % 4 === 0 }; }) })) };
    if (kind === 'lesson') return { intro: 'Les connecteurs.', teach: [{ heading: 'Cependant', body: 'Pour opposer.', examples: [{ wrong: 'mais cependant', right: 'cependant' }] }], phrases: [{ phrase: 'en revanche', use: 'En revanche, le prix est élevé.' }], quiz: range(10, () => ({ type: 'gap', prompt: 'Je travaille ___ développeur.', answer: ['comme'], explain: 'comme + métier' })), task: { kind: 'write', prompt: 'Présentez votre travail.', minWords: 100 } };
    if (kind === 'taskfb') return { nclc: 6, verdict: 'Bien.', used_point: 'Oui.', errors: [], better: 'Je travaille comme développeur.' };
  }
  return {};
}
export function mockText(turns: { role: string; text: string }[]) {
  const n = turns.filter((t) => t.role !== 'examiner').length;
  return ['Oui, bien sûr. Que voulez-vous savoir ?', 'La séance coûte 20 euros.', 'C’est le mardi et le jeudi à 19 heures.', 'Autre chose ?'][n % 4];
}
export function mockAudio(lines: unknown[]) {
  // 0.4 s of a quiet tone per line, so the player has something real to play.
  const rate = 24000; const secs = 0.4 * lines.length;
  const pcm = Buffer.alloc(Math.floor(rate * secs) * 2);
  for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 20) * 800), i * 2);
  return pcmToWav(pcm, rate);
}
