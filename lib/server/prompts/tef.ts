// TEF Canada prompts (server side).
import { toArr, words, clampStr } from '../util';
import { chunkScript, unitPlan, listAnd, studiedUnits, catalogFor, type Studied } from './ielts';
import type { AudioChunk, AudioPlan, Json } from './types';

const SK: Record<string, string> = { L: 'Compréhension orale', R: 'Compréhension écrite', W: 'Expression écrite', S: 'Expression orale' };
const AB: Record<string, string> = { L: 'CO', R: 'CE', W: 'EE', S: 'EO' };
const ORDER = ['L', 'R', 'W', 'S'];
export const NCLC_T: Record<string, [number, number][]> = {
  L: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]],
  R: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]],
  W: [[558, 10], [512, 9], [472, 8], [428, 7], [379, 6], [330, 5], [268, 4]],
  S: [[556, 10], [518, 9], [494, 8], [456, 7], [422, 6], [387, 5], [328, 4]]
};
const LPART = [
  { start: 1, desc: 'short everyday recordings: phone messages, public announcements (station, airport, shop), short radio adverts. 5 or 6 documents, 1 or 2 questions each' },
  { start: 11, desc: 'everyday and workplace conversations between two people. 4 documents, 2 or 3 questions each' },
  { start: 21, desc: 'radio news items, short reports and cultural programmes. 3 documents, 3 or 4 questions each' },
  { start: 31, desc: 'longer radio interviews or debates with several viewpoints. 2 or 3 documents, 3 to 5 questions each, testing opinions, implicit meaning, tone and nuance' }
];
const RPART = [
  { start: 1, desc: 'short practical documents: adverts, notices, timetables, menus, forms, short emails. 5 or 6 documents, 1 or 2 questions each' },
  { start: 11, desc: 'short press articles and news items. 3 or 4 documents, 2 or 3 questions each' },
  { start: 21, desc: 'administrative letters, workplace rules, contract extracts, official information. 3 documents, 3 or 4 questions each' },
  { start: 31, desc: 'longer opinion and argumentative texts (editorials, essays, columns) of 350 to 500 words. 2 documents, 5 questions each, testing the author’s viewpoint, implicit meaning and nuance' }
];
const TYPE_NAMES: Record<string, string> = { messages: 'CO · messages et annonces', dialogues: 'CO · conversations', radio: 'CO · radio', entretiens: 'CO · entretiens et débats', pratiques: 'CE · documents pratiques', presse: 'CE · articles de presse', administratifs: 'CE · textes administratifs', argumentatifs: 'CE · textes d’opinion' };
const DIFF: Record<string, string> = {
  foundation: 'the accessible end of real TEF Canada difficulty (aimed at moving a candidate from NCLC 5 to NCLC 6–7): clear documents, fewer traps',
  exam: 'exactly real TEF Canada difficulty, with questions getting harder through the paper as in the real test',
  advanced: 'the upper end of real TEF Canada difficulty (aimed at NCLC 9–10): dense documents, implicit meaning, subtle paraphrase and strong distractors'
};
function nclcOf(k: string, s: number | null | undefined) { if (s == null) return null; for (const [m, n] of NCLC_T[k]) if (s >= m) return n; return 3; }
function daysLeft(p: Json) { const d = new Date((p.examDate || '2027-01-01') + 'T09:00:00'); return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000)); }
function weakTypes(p: Json) {
  const st = p.typeStats || {}; const out: { type: string; pct: number }[] = [];
  for (const key in st) { const [, t] = key.split(':'); const v = st[key]; if (v && v.t >= 3) out.push({ type: t, pct: Math.round(100 * v.c / v.t) }); }
  return out.sort((a, b) => a.pct - b.pct).slice(0, 4);
}
export function brief(p: Json, user: Json) {
  const w = weakTypes(p); const sc = p.scores || {};
  return 'CANDIDATE PROFILE: ' + (user.name ? clampStr(user.name, 60) + ', ' : '') + (clampStr(p.about || '', 300) || 'an adult candidate') + '. Preparing TEF Canada for Canada immigration, exam in about ' + daysLeft(p) + ' days. Target: NCLC ' + (p.target || 7) + ' in all four skills. ' +
    'Current TEF score estimates (0–699): ' + ORDER.map((k) => AB[k] + ' ' + (sc[k] ?? 'unknown') + (sc[k] != null ? ' (NCLC ' + nclcOf(k, sc[k]) + ')' : '')).join(', ') + '. ' +
    'Known error patterns: ' + (toArr<string>(p.errorPatterns).slice(0, 8).map((x) => clampStr(x, 160)).join('; ') || 'none recorded yet') + '. ' +
    'Weakest document types: ' + (w.length ? w.map((x) => (TYPE_NAMES[x.type] || x.type) + ' ' + x.pct + '%').join(', ') : 'not enough data yet') + '.';
}
function autoDiff(p: Json, k: string) { const s = (p.scores || {})[k]; if (s == null) return 'exam'; const n = nclcOf(k, s); if (n! < 6) return 'foundation'; if (n! >= 8) return 'advanced'; return 'exam'; }
function diffFor(att: Json, p: Json, k: string) { return att.kind === 'placement' ? 'exam' : (att.diff === 'auto' || !DIFF[att.diff] ? autoDiff(p, k) : att.diff); }
function avoidLine(p: Json, o?: { avoid?: string[] }) { const u = toArr<string>(o && o.avoid ? o.avoid : p.usedTopics).slice(-30).map((x) => clampStr(x, 60)); return u.length ? 'Avoid these topics, already used: ' + u.join('; ') + '.' : ''; }
export function resolveDiff(att: Json, p: Json, k: string) { return diffFor(att, p, k); }
export function weakKeys(_p?: Json, _k?: string): string[] { return []; }
export function levelBucket(p: Json, skill: string) { const s = (p.scores || {})[skill]; if (s == null) return 'mid'; const n = nclcOf(skill, s); return n! < 6 ? 'low' : n! < 8 ? 'mid' : 'high'; }
const LEVEL_TEXT: Record<string, string> = { low: 'autour du NCLC 4–5', mid: 'autour du NCLC 6–7', high: 'NCLC 8 et plus' };
const Q_SHAPE = '"questions":[{"prompt":"question en français","choices":["...","...","...","..."],"answer":"B","evidence":"the exact sentence of the document that gives the answer","explain":"une phrase en français : pourquoi, et le piège éventuel"}]';
function nclcTable(k: string) { return NCLC_T[k].map(([m, n]) => 'NCLC ' + n + ' ≥ ' + m).join(', '); }

export function genPrompt(att: Json, p: Json, user: Json, k: string, i: number, o: { diff?: string; avoid?: string[] } = {}): { prompt: string; fast?: boolean } {
  const d = DIFF[o.diff || diffFor(att, p, k)];
  const seed = 'Variation seed: ' + Math.random().toString(36).slice(2, 8) + '.';
  if (k === 'R') {
    return { fast: false, prompt: 'You are an experienced TEF Canada test developer (CCI Paris Île-de-France style). Write part ' + (i + 1) + ' of 4 of an original TEF Canada Compréhension écrite paper, entirely in French: ' + RPART[i].desc + '. Exactly 10 questions in total for this part. Difficulty: ' + d + '.\n' + avoidLine(p, o) + '\n' +
      'Rules: authentic-looking French documents (France, Québec, Belgium, Switzerland or other francophone contexts). Every question is multiple choice with exactly 4 plain-text choices (no letters) and one correct answer, given as a letter A–D. Distractors must be plausible and use words from the document; the right answer usually paraphrases it. Vary the position of the right answer. ' + seed + '\n' +
      'Reply with only JSON: {"title":"short topic summary","docs":[{"kind":"annonce | courriel | article | règlement | éditorial …","heading":"document title","body":"the document text; use line breaks for layout",' + Q_SHAPE + '}]}' };
  }
  if (k === 'L') {
    return { fast: false, prompt: 'You are an experienced TEF Canada test developer (CCI Paris Île-de-France style). Write part ' + (i + 1) + ' of 4 of an original TEF Canada Compréhension orale paper, entirely in French: ' + LPART[i].desc + '. Exactly 10 questions in total for this part. Difficulty: ' + d + '.\n' + avoidLine(p, o) + '\n' +
      'Each document is a recording that will be read aloud ONCE by text-to-speech: write natural spoken French (hesitations, reformulations, numbers, times, prices, and details that change during the recording). Mix accents and contexts from France and Québec. At most 2 speakers per document. Every question is multiple choice with exactly 4 plain-text choices (no letters) and one correct answer, given as a letter A–D; vary its position. Questions for a document follow the order of the recording. ' + seed + '\n' +
      'Reply with only JSON: {"title":"short topic summary","docs":[{"context":"one short line announcing the document, as the test does (e.g. Vous allez entendre un message sur un répondeur.)","speakers":[{"name":"Présentatrice","gender":"female","accent":"fr-FR"}],"script":[{"speaker":"Présentatrice","text":"..."}],' + Q_SHAPE + '}]}' };
  }
  if (k === 'W') {
    return { fast: true, prompt: 'You are an experienced TEF Canada test developer. Write an original TEF Canada Expression écrite paper in French at ' + d + '.\n' + avoidLine(p, o) + '\n' +
      'Section A: the start of a short news item (fait divers) of 2–4 sentences, which the candidate must continue in at least 80 words, telling what happened next in the same journalistic style, in the third person. Section B: a short provocative statement taken from a newspaper, blog or forum, about a society topic; the candidate writes at least 200 words to the newspaper or forum to give and justify their opinion with at least three arguments. ' + seed + '\n' +
      'Reply with only JSON: {"A":{"topic":"short topic","source":"Journal … — the beginning of the news item","consigne":"Terminez cet article en ajoutant un texte de 80 mots minimum. Faites plusieurs paragraphes."},"B":{"topic":"short topic","statement":"« … » — source","consigne":"Vous écrivez un article (200 mots minimum) pour donner votre point de vue sur cette affirmation. Vous développerez au moins trois arguments."}}' };
  }
  if (k === 'S') {
    return { fast: true, prompt: 'You are an experienced TEF Canada oral examiner. Prepare an original TEF Canada Expression orale subject, in French.\n' + avoidLine(p, o) + '\n' +
      'Section A (5 min): an advert or notice (courses, rental, event, service, job…) with some information missing; the candidate phones to ask about 10 questions. Give the examiner the hidden facts to answer consistently. Section B (10 min): a different advert or notice; the candidate must convince a friend (played by the examiner, informal "tu") to take part or buy; give the friend 5 or 6 realistic objections. ' + seed + '\n' +
      'Reply with only JSON: {"A":{"topic":"short topic","ad":"the advert text as printed, with line breaks","role":"who the examiner plays, e.g. l’employée de l’agence","facts":"hidden details the examiner uses to answer: prices, times, conditions, etc.","opening":"the examiner’s first line when answering the phone"},"B":{"topic":"short topic","ad":"the advert text","goal":"what the candidate must convince the friend to do","objections":["...","..."],"opening":"the friend’s first line, reacting to the idea"}}' };
  }
  throw new Error('Unknown section ' + k);
}

export function markWritingPrompt(doc: Json, p: Json, user: Json) {
  const c = doc.content.W[0]; const a = doc.answers.W || {};
  const A = clampStr(a.A, 8000), B = clampStr(a.B, 14000);
  return 'Tu es un correcteur expérimenté et exigeant du TEF Canada, Expression écrite. Corrige ces deux productions comme un vrai correcteur, sans jamais gonfler la note. Pénalise les textes sous le minimum de mots (80 et 200), hors sujet ou appris par cœur.\n' + brief(p, user) + '\n\n' +
    'SECTION A — début de l’article : ' + c.A.source + '\nConsigne : ' + c.A.consigne + '\nTEXTE DU CANDIDAT (' + words(A) + ' mots) :\n' + (A || '(pas de réponse)') + '\n\n' +
    'SECTION B — affirmation : ' + c.B.statement + '\nConsigne : ' + c.B.consigne + '\nTEXTE DU CANDIDAT (' + words(B) + ' mots) :\n' + (B || '(pas de réponse)') + '\n\n' +
    'Donne un score TEF estimé sur 699 pour l’ensemble de l’épreuve, calibré sur cette table officielle : ' + nclcTable('W') + '. Écris toutes les explications en français simple.\n' +
    'Réponds uniquement en JSON : {"score":420,"A":{"summary":"deux phrases"},"B":{"summary":"deux phrases"},"criteria":[{"name":"Réalisation de la tâche","level":"B1","comment":"une phrase"},{"name":"Cohérence et organisation","level":"B1","comment":""},{"name":"Lexique","level":"B1","comment":""},{"name":"Grammaire et orthographe","level":"B1","comment":""}],"errors":[{"quote":"mots exacts du candidat","fix":"version corrigée","reason":"une phrase courte"}],"patterns":["erreur récurrente avec exemple"],"model":{"task":"Section B","original":"le paragraphe le plus faible, copié","better":"ce paragraphe réécrit au niveau NCLC 9, avec les idées du candidat"},"next":["trois priorités concrètes"]}. Jusqu’à 12 erreurs, les plus importantes d’abord.';
}
function transcript(log: unknown) { return toArr<any>(log).slice(0, 80).map((m) => (m.role === 'ex' ? 'EXAMINATEUR' : 'CANDIDAT') + ' : ' + clampStr(m.text, 1500)).join('\n'); }
export function markSpeakingPrompt(doc: Json, p: Json, user: Json) {
  const c = doc.content.S[0]; const A = doc.answers.S || {};
  return 'Tu es un examinateur expérimenté et exigeant du TEF Canada, Expression orale. Voici la transcription d’une épreuve (le candidat a dicté ou tapé ses réponses : ignore la ponctuation et l’orthographe ; la prononciation ne peut pas être évaluée). Évalue comme un vrai examinateur, sans gonfler la note.\n' + brief(p, user) + '\n\n' +
    'SECTION A (obtenir des informations, 5 min). Annonce : ' + c.A.ad + '\n' + transcript(A.A) + '\n\n' +
    'SECTION B (convaincre un ami, 10 min). Annonce : ' + c.B.ad + '\nObjectif : ' + c.B.goal + '\n' + transcript(A.B) + '\n\n' +
    'Critères : en A, nombre et pertinence des questions, registre formel (vouvoiement) ; en B, qualité et variété des arguments, réponses aux objections, registre informel. Donne un score TEF estimé sur 699, calibré sur cette table officielle : ' + nclcTable('S') + '. Écris les explications en français simple.\n' +
    'Réponds uniquement en JSON : {"score":420,"summary":"deux ou trois phrases","criteria":[{"name":"Réalisation des tâches","level":"B1","comment":"une phrase"},{"name":"Interaction et registre","level":"B1","comment":""},{"name":"Lexique","level":"B1","comment":""},{"name":"Grammaire","level":"B1","comment":""},{"name":"Cohérence et aisance","level":"B1","comment":""}],"errors":[{"quote":"mots exacts","fix":"version corrigée","reason":"une phrase"}],"patterns":["erreur récurrente avec exemple"],"model":{"task":"la réplique","original":"réplique du candidat","better":"la même réplique au niveau NCLC 9, style oral naturel"},"next":["trois conseils concrets"],"missed_questions":["questions utiles que le candidat n’a pas posées en section A"]}.';
}
export function examinerRules(doc: Json, sec: string) {
  const c = doc.content.S[0];
  if (sec === 'A') return 'Tu fais passer l’épreuve d’Expression orale du TEF Canada, section A. Tu joues ce rôle : ' + c.A.role + '. Le candidat t’appelle au téléphone pour obtenir des informations sur cette annonce :\n' + c.A.ad + '\nInformations dont tu disposes (invente des détails cohérents si besoin) : ' + c.A.facts + '\nRègles : réponds seulement à ce qu’on te demande, en 1 à 3 phrases, à l’oral, en français standard, en vouvoyant. Ne pose pas les questions à sa place, ne corrige jamais ses erreurs, ne donne aucun conseil. S’il ne dit rien d’utile, relance brièvement (« Oui ? Vous aviez une autre question ? »). Réponds uniquement avec ta réplique, sans guillemets ni didascalies.';
  return 'Tu fais passer l’épreuve d’Expression orale du TEF Canada, section B. Tu joues un(e) ami(e) du candidat, et vous vous tutoyez. Le candidat a vu cette annonce :\n' + c.B.ad + '\nIl doit te convaincre de : ' + c.B.goal + '.\nTu es sceptique : soulève tes objections une par une (' + toArr(c.B.objections).join(' ; ') + '), demande des précisions, et laisse-toi convaincre peu à peu seulement si ses arguments sont bons. 1 à 3 phrases par réplique, oral naturel et familier. Ne corrige jamais ses erreurs. Réponds uniquement avec ta réplique, sans guillemets ni didascalies.';
}
function trendLine(p: Json) {
  const h = toArr<any>(p.history).slice(-4);
  if (!h.length) return '';
  return 'Derniers résultats, du plus ancien au plus récent : ' + h.map((e) => clampStr(e.date, 10) + ' ' + clampStr(e.kind, 12) + ' (' + ORDER.filter((k) => e.scores && e.scores[k] != null).map((k) => AB[k] + ' ' + e.scores[k]).concat(e.nclc != null ? ['NCLC ' + e.nclc] : []).join(', ') + ')').join(' ; ') + '.\n';
}
function studiedLine(st: Studied[]) {
  if (!st.length) return '';
  return 'Unités déjà étudiées dans le parcours précédent : ' + st.map((s) => '[' + s.skill + '] ' + s.title + ' (' + (s.checkpoint ? 'test d’étape' + (s.level != null ? ', NCLC ' + s.level : '') : 'quiz ' + (s.score ?? '?') + ' %' + (s.done ? '' : ', pas encore réussi')) + ')').join(' | ') +
    '. Ne répète pas une unité réussie, sauf si l’erreur correspondante figure encore dans le profil ; dans ce cas, donne-lui un nouvel angle et un nouveau titre. Une unité pas encore réussie peut être gardée avec exactement le même titre.\n';
}
export function coursePrompt(p: Json, user: Json, catalog: Json[] = [], prev: Json | null = null) {
  const plan = unitPlan(daysLeft(p)); const st = studiedUnits(prev); const cat = catalogFor(catalog, st);
  return 'Tu es un coach expert du TEF Canada. Conçois un parcours personnalisé pour ce candidat.\n' + brief(p, user) + '\n' + trendLine(p) + studiedLine(st) + (cat.length ? 'Quand un de ces titres d’unité existants correspond au besoin du candidat, réutilise-le EXACTEMENT (même formulation) : ' + cat.map((c) => '[' + c.skill + '] ' + clampStr(c.title, 90)).join(' | ') + '. N’invente un nouveau titre que si aucun ne convient.\n' : '') + 'Le candidat étudie environ ' + clampStr(p.studyTime || '1 heure par jour', 60) + ' et passe l’examen dans environ ' + daysLeft(p) + ' jours. Crée ' + plan.n + ' unités en ' + plan.phases + ' phases adaptées à ce délai, par ordre d’impact : la compétence la plus éloignée de l’objectif NCLC reçoit le plus d’unités. Chaque unité travaille un seul point (un point de grammaire, une stratégie pour un type de document, une structure d’écrit pour la section A ou B, une technique pour l’oral A ou B, ou du vocabulaire thématique). Les unités ' + listAnd(plan.checkpoints, 'et') + ' sont des points d’étape : un test chronométré d’une seule compétence, celle qui a le plus besoin d’être vérifiée.\n' +
    'Réponds uniquement en JSON : {"title":"nom du parcours","summary":"deux phrases","phases":[{"name":"Phase 1 · …","units":[{"id":"u1","skill":"S","title":"…","goal":"une ligne","checkpoint":false}]}]}. skill vaut L (CO), R (CE), W (EE) ou S (EO). Pour les points d’étape, "checkpoint":true et "skill" = la compétence testée. ids u1 à u' + plan.n + '.';
}
export function lessonPrompt(p: Json, user: Json, u: Json, level: string) {
  return 'Tu es un coach expert du TEF Canada. Écris une leçon courte et pratique, en français simple, pour des candidats au TEF Canada (immigration au Canada) de niveau ' + (LEVEL_TEXT[level] || LEVEL_TEXT.mid) + ' dans cette compétence.\nUNITÉ : ' + SK[u.skill] + ' · ' + clampStr(u.title, 200) + ' — objectif : ' + clampStr(u.goal, 300) + '\n' +
    'Apprendre en pratiquant : explications brèves, beaucoup d’exemples tirés de la vie quotidienne d’un adulte (travail, famille, voyages, projet d’installation au Canada), adaptés à ce niveau. Ne t’adresse à aucun candidat en particulier. Puis un quiz de 10 questions qui teste exactement ce point, avec des questions "mcq" (4 choix, une seule bonne réponse, answer = la lettre) et "gap" (un à trois mots à compléter ; liste toutes les réponses acceptables). Puis une tâche de production (écrire 80 à 200 mots, ou répondre à l’oral en dictant) qui oblige à utiliser le point étudié.\n' +
    'Réponds uniquement en JSON : {"intro":"deux phrases","teach":[{"heading":"…","body":"court paragraphe","examples":[{"wrong":"erreur typique ou version faible","right":"version correcte ou meilleure"}]}],"phrases":[{"phrase":"expression utile","use":"phrase d’exemple"}],"quiz":[{"type":"mcq","prompt":"…","choices":["…","…","…","…"],"answer":"B","explain":"une ligne"},{"type":"gap","prompt":"Je travaille ___ développeur.","answer":["comme"],"explain":"une ligne"}],"task":{"kind":"write","prompt":"…","minWords":120}}. 2 ou 3 blocs teach, 5 à 8 expressions.';
}
export function taskFbPrompt(p: Json, user: Json, u: Json, taskPrompt: string, answer: string) {
  return 'Tu es un coach TEF Canada exigeant. Le candidat vient d’étudier : ' + clampStr(u.title, 200) + ' (' + clampStr(u.goal, 300) + '). Tâche : ' + clampStr(taskPrompt, 800) + '\nRéponse du candidat (' + words(answer) + ' mots) :\n' + clampStr(answer, 6000) + '\n' + brief(p, user) + '\nRéponds uniquement en JSON, en français simple : {"nclc":7,"verdict":"deux phrases honnêtes","used_point":"le point étudié est-il bien utilisé ? une ligne","errors":[{"quote":"mots exacts","fix":"correction","reason":"une ligne"}],"better":"la réponse réécrite au niveau NCLC 9, mêmes idées"}';
}

const FEMALE = ['Aoede', 'Kore', 'Leda', 'Despina', 'Erinome', 'Vindemiatrix'];
const MALE = ['Charon', 'Orus', 'Iapetus', 'Algieba', 'Rasalgethi', 'Alnilam'];
export function listeningAudioPlan(doc: Json, p: number, d: number): AudioPlan | null {
  const part = doc.content && doc.content.L && doc.content.L[p];
  const item = part && toArr<any>(part.docs)[d];
  if (!item) return null;
  const voices: Record<string, string> = {}; let f = 0, m = 0; let qc = false;
  toArr<any>(item.speakers).forEach((s) => { const g = String(s.gender || '').toLowerCase(); voices[s.name] = g.startsWith('m') ? MALE[m++ % MALE.length] : FEMALE[f++ % FEMALE.length]; if (/ca/i.test(s.accent || '')) qc = true; });
  voices['Narrateur'] = 'Sadaltager';
  const chunks: AudioChunk[] = [];
  if (item.context) chunks.push({ kind: 'intro', lines: [{ speaker: 'Narrateur', text: clampStr(item.context, 400) }] });
  chunkScript(toArr<any>(item.script), voices).forEach((c) => chunks.push({ kind: 'script', lines: c }));
  return { chunks, voices, style: 'Lis cet enregistrement du TEF Canada à voix haute, naturellement, avec un accent ' + (qc ? 'québécois' : 'français de France') + ' natif' };
}
