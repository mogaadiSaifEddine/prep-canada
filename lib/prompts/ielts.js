// IELTS General Training prompts. Built on the server from the saved profile and attempt,
// so the browser can never send its own prompt to the AI.
import { toArr, words, clampStr } from '../util.js';

export const SK = { L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' };
const ORDER = ['L', 'R', 'W', 'S'];
export const TARGETS = {
  7: { L: 6, R: 6, W: 6, S: 6 },
  8: { L: 7.5, R: 6.5, W: 6.5, S: 6.5 },
  9: { L: 8, R: 7, W: 7, S: 7 },
  10: { L: 8.5, R: 8, W: 7.5, S: 7.5 }
};
const TYPE_NAMES = { tfng: 'True / False / Not Given', ynng: 'Yes / No / Not Given', mcq: 'Multiple choice', matching: 'Matching', headings: 'Matching headings', completion: 'Completion', short: 'Short answer' };
export const RSEC = [
  { start: 1, count: 14, desc: 'Section 1: two or three short everyday texts (notices, adverts, timetables, leaflets), about 550–650 words in total' },
  { start: 15, count: 13, desc: 'Section 2: two workplace texts (job descriptions, staff policies, training material, contracts), about 600–700 words in total' },
  { start: 28, count: 13, desc: 'Section 3: one long general-interest text of 850–950 words with paragraphs labelled A to G' }
];
export const LPART = [
  { start: 1, desc: 'Part 1: a conversation between two people in an everyday social context (a booking, enquiry or registration)', words: 650 },
  { start: 11, desc: 'Part 2: a monologue in an everyday social context (a guide or officer describing a local facility, service or event)', words: 700 },
  { start: 21, desc: 'Part 3: a conversation between two to four people in an educational or training context (students and a tutor discussing an assignment)', words: 750 },
  { start: 31, desc: 'Part 4: a lecture-style monologue on an academic subject', words: 800 }
];
const DIFF = {
  foundation: 'the accessible end of real IELTS difficulty: clear texts, fewer traps, aimed at moving a candidate from band 5.5 to 6.5',
  exam: 'exactly real IELTS exam difficulty, as in Cambridge IELTS 17–19',
  advanced: 'the upper end of real IELTS difficulty: dense texts, subtle paraphrase, strong distractors and tricky NOT GIVEN items, aimed at pushing a candidate from 7.5 to 8.5+'
};

function daysLeft(p) { const d = new Date((p.examDate || '2027-01-01') + 'T09:00:00'); return Math.max(0, Math.ceil((d - new Date()) / 86400000)); }
function weakTypes(p, skill) {
  const st = p.qtypeStats || {}; const out = [];
  for (const key in st) { const [k, t] = key.split(':'); if (skill && k !== skill) continue; const v = st[key]; if (v && v.t >= 3) out.push({ skill: k, type: t, pct: Math.round(100 * v.c / v.t) }); }
  return out.sort((a, b) => a.pct - b.pct).slice(0, 4);
}
export function brief(p, user) {
  const t = TARGETS[p.clbTarget || 9] || TARGETS[9];
  const w = weakTypes(p);
  const about = clampStr(p.about || '', 300);
  return 'CANDIDATE PROFILE: ' + (user.name ? clampStr(user.name, 60) + ', ' : '') + (about || 'an adult candidate') +
    '. Taking IELTS General Training for Canada immigration, exam in about ' + daysLeft(p) + ' days. ' +
    'Target CLB ' + (p.clbTarget || 9) + ' (Listening ' + t.L + ', Reading ' + t.R + ', Writing ' + t.W + ', Speaking ' + t.S + '). ' +
    'Current band estimates: ' + ORDER.map((k) => SK[k] + ' ' + ((p.bands || {})[k] ?? 'unknown')).join(', ') + '. ' +
    'Known error patterns: ' + (toArr(p.errorPatterns).slice(0, 8).map((x) => clampStr(x, 160)).join('; ') || 'none recorded yet') + '. ' +
    'Weakest question types so far: ' + (w.length ? w.map((x) => SK[x.skill] + ' ' + (TYPE_NAMES[x.type] || x.type) + ' ' + x.pct + '%').join(', ') : 'not enough data yet') + '.';
}
function autoDiff(p, k) { const b = (p.bands || {})[k]; if (b == null) return 'exam'; if (b < 6) return 'foundation'; if (b >= 7.5) return 'advanced'; return 'exam'; }
function diffFor(att, p, k) { return att.kind === 'placement' ? 'exam' : (att.diff === 'auto' || !DIFF[att.diff] ? autoDiff(p, k) : att.diff); }
function focusLine(att, p, k) {
  if (att.kind === 'placement') return 'Use a balanced mix of question types, as in a real paper.';
  const w = weakTypes(p, k);
  return w.length ? 'Give extra weight to these question types, where the candidate is weakest: ' + w.map((x) => TYPE_NAMES[x.type] || x.type).join(', ') + '. Still include at least one other type.' : 'Use a balanced mix of question types, as in a real paper.';
}
function avoidLine(p, o) { const u = toArr(o && o.avoid ? o.avoid : p.usedTopics).slice(-30).map((x) => clampStr(x, 60)); return u.length ? 'Avoid these topics, already used in earlier tests: ' + u.join('; ') + '.' : ''; }
export function resolveDiff(att, p, k) { return diffFor(att, p, k); }
export function weakKeys(p, k) { return weakTypes(p, k).filter((w) => w.pct < 70).map((w) => w.type); }
export function levelBucket(p, skill) { const b = (p.bands || {})[skill]; return b == null ? 'mid' : b < 6 ? 'low' : b < 7 ? 'mid' : 'high'; }
const LEVEL_TEXT = { low: 'around band 5–5.5', mid: 'around band 6–6.5', high: 'around band 7 and above' };
const GROUP_SHAPE = '"groups":[{"type":"tfng","instructions":"...","options":[{"label":"i","text":"..."}],"questions":[{"n":1,"prompt":"...","choices":["...","..."],"answer":["..."],"evidence":"exact sentence from the source that proves the answer","explain":"one short line on why, naming any trap or paraphrase"}]}]';

export function genPrompt(att, p, user, k, i, o = {}) {
  const d = DIFF[o.diff || diffFor(att, p, k)];
  const seed = 'Variation seed: ' + Math.random().toString(36).slice(2, 8) + '.';
  if (k === 'R') {
    const s = RSEC[i]; const end = s.start + s.count - 1;
    return { fast: false, prompt: 'You are an experienced IELTS test developer. Write an original IELTS General Training Reading ' + s.desc + '. Difficulty: ' + d + '.\n' +
      'Questions ' + s.start + ' to ' + end + ' (' + s.count + ' questions) in 2 or 3 groups of different types. Allowed types: "tfng" (TRUE/FALSE/NOT GIVEN for factual texts), "ynng" (YES/NO/NOT GIVEN, only for a writer\'s views), "mcq" (4 choices, exactly one correct), "matching" (match statements to texts, people or paragraphs; give the options list), "headings" (choose the heading for each lettered paragraph; roman-numeral options, more options than paragraphs; question prompt = "Paragraph B"), "completion" (sentence, summary, note or table completion with words copied exactly from the text; state the word limit in the instructions), "short" (short answer with a word limit).\n' +
      focusLine(att, p, 'R') + ' ' + avoidLine(p, o) + '\n' +
      'Rules: realistic texts at real exam length. Every answer must be provable from the text; NOT GIVEN items must be genuinely absent, FALSE items must be contradicted. Completion answers must be copied exactly from the text and fit the word limit; list acceptable variants as extra strings in "answer". For mcq, "choices" are plain text without letters and "answer" is the letter (e.g. ["B"]). For matching and headings, "answer" is the option label. For tfng use "TRUE","FALSE","NOT GIVEN"; for ynng "YES","NO","NOT GIVEN". Omit "options" unless the type is matching or headings; omit "choices" unless mcq. ' + seed + '\n' +
      'Reply with only JSON in this shape: {"title":"short topic name","texts":[{"label":"A","heading":"text title","body":"paragraph\\n\\nparagraph"}],' + GROUP_SHAPE + '}' };
  }
  if (k === 'L') {
    const pt = LPART[i];
    return { fast: false, prompt: 'You are an experienced IELTS test developer. Write an original IELTS Listening ' + pt.desc + '. Difficulty: ' + d + '.\n' +
      'Ten questions numbered ' + pt.start + ' to ' + (pt.start + 9) + ', in 1 or 2 groups. Allowed types: "completion" (form, note, table, flow-chart or sentence completion; state the word limit, e.g. "Write ONE WORD AND/OR A NUMBER"), "mcq" (3 choices, exactly one correct), "matching" (options list labelled A to G), "short". Answers must occur in the script in question order.\n' +
      focusLine(att, p, 'L') + ' ' + avoidLine(p, o) + '\n' +
      'The script will be read aloud ONCE by text-to-speech with British and other native accents, so write natural spoken English of about ' + pt.words + ' words: hesitations, realistic distractors (a speaker gives a detail then corrects it, options mentioned then rejected), names spelled out letter by letter ("that\'s H-A-R-T-L-E-Y"), numbers, dates and prices. Use at most 3 speakers. Completion answers must be words actually spoken and must fit the word limit; list acceptable variants (e.g. "15" and "fifteen") as extra strings in "answer". For mcq, "choices" are plain text without letters and "answer" is the letter. "evidence" is the script sentence that gives the answer. ' + seed + '\n' +
      'Reply with only JSON in this shape: {"title":"short topic name","context":"one line describing the situation, as the recording\'s introduction would","speakers":[{"name":"Receptionist","gender":"female"}],"script":[{"speaker":"Receptionist","text":"..."}],' + GROUP_SHAPE + '}' };
  }
  if (k === 'W') {
    return { fast: true, prompt: 'You are an experienced IELTS test developer. Write an original IELTS General Training Writing paper at ' + d + '.\n' + avoidLine(p, o) + '\n' +
      'Task 1: a letter task. Choose one tone (formal, semi-formal or informal) with a realistic situation and exactly three bullet points. Task 2: an essay question of one of these types: opinion, discussion, advantages/disadvantages, problem/solution, two-part question, on a common IELTS topic. ' + seed + '\n' +
      'Reply with only JSON: {"task1":{"tone":"formal","situation":"You ... (the scenario, as printed on the paper)","instruction":"Write a letter to ... In your letter","bullets":["...","...","..."],"salutation":"Dear ...,"},"task2":{"type":"opinion","topic":"short topic name","prompt":"the full essay question, ending as the real paper does"}}' };
  }
  if (k === 'S') {
    return { fast: true, prompt: 'You are an IELTS speaking examiner preparing an original speaking test.\n' + avoidLine(p, o) + '\n' +
      'Part 1: 3 topics (the first about home, work or study), 3 or 4 questions each. Part 2: one cue card with 3 bullet points and a final "and explain" line, plus one short rounding-off question. Part 3: 5 discussion questions linked to the Part 2 theme, getting more abstract. ' + seed + '\n' +
      'Reply with only JSON: {"part1":[{"topic":"...","questions":["...","..."]}],"part2":{"topic":"short topic name","card":"Describe ...","bullets":["...","...","..."],"final":"and explain ...","followup":"..."},"part3":["...","...","...","...","..."]}' };
  }
  return null;
}

export function markWritingPrompt(doc, p, user) {
  const c = doc.content.W[0]; const a = doc.answers.W || {};
  const t1 = c.task1 || {}, t2 = c.task2 || {};
  const a1 = clampStr(a.t1, 12000), a2 = clampStr(a.t2, 16000);
  return 'You are a strict, experienced IELTS General Training Writing examiner. Mark these two responses against the public IELTS band descriptors. Never inflate scores; mark as a real examiner would. Penalise Task 1 under 150 words and Task 2 under 250 words under Task Achievement/Response, penalise memorised phrases and off-topic content.\n' + brief(p, user) + '\n\n' +
    'TASK 1 (' + t1.tone + ' letter): ' + t1.situation + ' ' + t1.instruction + ': ' + toArr(t1.bullets).join(' / ') + '\nCANDIDATE LETTER (' + words(a1) + ' words):\n' + (a1 || '(no answer)') + '\n\n' +
    'TASK 2 (' + t2.type + '): ' + t2.prompt + '\nCANDIDATE ESSAY (' + words(a2) + ' words):\n' + (a2 || '(no answer)') + '\n\n' +
    'Reply with only JSON: {"task1":{"TA":6,"CC":6,"LR":6,"GRA":6,"band":6,"summary":"two sentences"},"task2":{"TR":6,"CC":6,"LR":6,"GRA":6,"band":6,"summary":"two sentences"},"errors":[{"quote":"exact words the candidate wrote","fix":"corrected version","reason":"one short line"}],"patterns":["repeated error pattern with an example"],"model":{"task":"Task 2","original":"the candidate\'s weakest paragraph, copied","band8":"that paragraph rewritten at Band 8, keeping the candidate\'s ideas"},"next":["three concrete priorities"]}. Use half bands (e.g. 6.5). List up to 12 errors, most important first.';
}

export function speakSteps(c) {
  const st = [];
  toArr(c.part1).forEach((t) => toArr(t.questions).forEach((q) => st.push({ part: 1, label: 'Part 1 · ' + t.topic, q })));
  const p2 = c.part2 || {};
  const card = p2.card + '\nYou should say:\n' + toArr(p2.bullets).map((b) => '• ' + b).join('\n') + '\n' + (p2.final || '');
  st.push({ part: 2, phase: 'prep', label: 'Part 2 · preparation', q: card });
  st.push({ part: 2, phase: 'talk', label: 'Part 2 · long turn', q: card });
  if (p2.followup) st.push({ part: 2, phase: 'follow', label: 'Part 2 · rounding off', q: p2.followup });
  toArr(c.part3).forEach((q) => st.push({ part: 3, label: 'Part 3 · discussion', q }));
  return st;
}

export function markSpeakingPrompt(doc, p, user) {
  const c = doc.content.S[0]; const A = doc.answers.S || {};
  const lines = [];
  speakSteps(c).forEach((st, i) => { if (st.phase === 'prep') return; const ans = clampStr(A[i] || '', 4000); lines.push('Q (' + st.label + '): ' + st.q + '\nA (' + words(ans) + ' words): ' + (ans || '(no answer)')); });
  return 'You are a strict, experienced IELTS Speaking examiner. Below is a transcript of a candidate\'s speaking test, produced by voice dictation or typing, so ignore punctuation and spelling. You cannot hear pronunciation: mark Fluency & Coherence, Lexical Resource and Grammatical Range & Accuracy from the transcript, judging answer length, development, linking, vocabulary and grammar. Never inflate scores.\n' + brief(p, user) + '\n\nTRANSCRIPT:\n' + lines.join('\n\n') + '\n\n' +
    'Reply with only JSON: {"FC":6,"LR":6,"GRA":6,"summary":"two or three sentences","errors":[{"quote":"exact words","fix":"corrected version","reason":"one short line"}],"patterns":["repeated error pattern with an example"],"model":{"task":"the question","original":"the candidate\'s answer","band8":"a Band 8 answer in the candidate\'s own situation, natural spoken style"},"next":["three concrete tips"]}. Use half bands. List up to 12 errors.';
}

export function coursePrompt(p, user, catalog = []) {
  return 'You are an expert IELTS General Training coach. Design a personalised course for this candidate.\n' + brief(p, user) + '\n' + (catalog.length ? 'When one of these existing unit titles fits what the candidate needs, reuse it EXACTLY (same wording): ' + catalog.map((c) => '[' + c.skill + '] ' + clampStr(c.title, 90)).join(' | ') + '. Invent a new title only when none fits.\n' : '') + 'The candidate studies about ' + clampStr(p.studyTime || '1 hour a day', 60) + '. Build 12 units in 3 phases, ordered by impact: the skill with the biggest gap to its target gets the most units. Each unit is one focused point (a grammar pattern, a question-type strategy, a writing structure, a speaking technique, or topic vocabulary). Make units 4, 8 and 12 checkpoints: a timed single-skill mock test of the skill that most needs checking at that point.\n' +
    'Reply with only JSON: {"title":"course name","summary":"two sentences","phases":[{"name":"Phase 1 · Weeks 1–4: ...","units":[{"id":"u1","skill":"S","title":"...","goal":"one line","checkpoint":false}]}]}. skill is one of L, R, W, S. For checkpoints set "checkpoint":true and "skill" to the skill tested. ids u1 to u12.';
}
export function lessonPrompt(p, user, u, level) {
  return 'You are an expert IELTS General Training coach. Write one short, practical lesson for IELTS General Training candidates preparing for Canada immigration, ' + (LEVEL_TEXT[level] || LEVEL_TEXT.mid) + ' in this skill.\nUNIT: ' + SK[u.skill] + ' · ' + clampStr(u.title, 200) + ' — goal: ' + clampStr(u.goal, 300) + '\n' +
    'Teach by doing: brief explanations, many examples from everyday adult life (work, family, travel, moving to Canada), pitched at that level. Do not refer to any individual candidate. Then a 10-item quiz that tests exactly this point, mixing "mcq" (4 choices, one correct, answer is the letter) and "gap" (fill one to three words; list every acceptable answer). Then one production task (write about 80–150 words or a spoken answer typed by dictation) that makes the candidate use the point.\n' +
    'Reply with only JSON: {"intro":"two sentences","teach":[{"heading":"...","body":"short paragraph","examples":[{"wrong":"typical mistake or weak version","right":"correct or stronger version"}]}],"phrases":[{"phrase":"natural phrase","use":"example sentence"}],"quiz":[{"type":"mcq","prompt":"...","choices":["...","...","...","..."],"answer":"B","explain":"one line"},{"type":"gap","prompt":"I work ___ a software developer.","answer":["as"],"explain":"one line"}],"task":{"kind":"write","prompt":"...","minWords":100}}. 2 to 3 teach blocks, 5 to 8 phrases.';
}
export function taskFbPrompt(p, user, u, taskPrompt, answer) {
  return 'You are a strict IELTS coach. The candidate just studied: ' + clampStr(u.title, 200) + ' (' + clampStr(u.goal, 300) + '). Task: ' + clampStr(taskPrompt, 800) + '\nCandidate answer (' + words(answer) + ' words):\n' + clampStr(answer, 6000) + '\n' + brief(p, user) + '\nReply with only JSON: {"band":6.5,"verdict":"two sentences, honest","used_point":"did they use the lesson point correctly? one line","errors":[{"quote":"exact words","fix":"correction","reason":"one line"}],"better":"the answer rewritten at Band 8, same ideas"}';
}
export function realExplainPrompt(wrong, transcript) {
  return 'You are an IELTS Listening coach. The candidate did a real IELTS Listening test. For each wrong answer, name the most likely cause: a distractor (speaker corrected themselves), a missed paraphrase, spelling, plural/singular, numbers or dates, word limit, or lost concentration. Be specific and short.\n' +
    (transcript ? 'TRANSCRIPT:\n' + clampStr(transcript, 30000) + '\n' : 'No transcript available: infer causes from the answers only and say so when unsure.\n') +
    'WRONG ANSWERS:\n' + toArr(wrong).slice(0, 40).map((i) => 'Q' + Number(i.n) + ': candidate "' + (clampStr(i.given, 80) || '(blank)') + '", key "' + clampStr(i.key, 120) + '"').join('\n') +
    '\nReply with only JSON: {"items":[{"n":7,"cause":"one short line"}],"patterns":["up to 3 patterns across the mistakes"]}';
}

// TTS: voices and chunking for an IELTS Listening part.
const FEMALE = ['Kore', 'Aoede', 'Leda', 'Despina', 'Erinome', 'Autonoe'];
const MALE = ['Charon', 'Orus', 'Iapetus', 'Algieba', 'Rasalgethi', 'Puck'];
export function listeningAudioPlan(doc, i) {
  const part = doc.content && doc.content.L && doc.content.L[i];
  if (!part) return null;
  const voices = {}; let f = 0, m = 0;
  toArr(part.speakers).forEach((s) => { const g = String(s.gender || '').toLowerCase(); voices[s.name] = g.startsWith('m') ? MALE[m++ % MALE.length] : FEMALE[f++ % FEMALE.length]; });
  const nar = 'Narrator';
  voices[nar] = 'Sadaltager';
  const a = LPART[i].start, b = a + 9;
  const chunks = [{ kind: 'intro', lines: [{ speaker: nar, text: 'Part ' + (i + 1) + '. ' + part.context + ' First, you have some time to look at questions ' + a + ' to ' + b + '.' }] }];
  chunks.push({ kind: 'go', lines: [{ speaker: nar, text: 'Now listen carefully and answer questions ' + a + ' to ' + b + '.' }] });
  chunkScript(toArr(part.script), voices).forEach((c) => chunks.push({ kind: 'script', lines: c }));
  chunks.push({ kind: 'outro', lines: [{ speaker: nar, text: 'That is the end of Part ' + (i + 1) + '. You now have 30 seconds to check your answers.' }] });
  return { chunks, voices, style: 'Read this IELTS Listening recording aloud naturally, at a normal conversational pace, with native British English accents' };
}
export function chunkScript(script, voices, maxWords = 120) {
  const out = []; let cur = []; let w = 0; let sp = new Set();
  for (const l of script) {
    const text = clampStr(l.text, 1500); if (!text.trim()) continue;
    const s = String(l.speaker || 'Speaker');
    if (!voices[s]) voices[s] = FEMALE[Object.keys(voices).length % FEMALE.length];
    const nw = words(text);
    if (cur.length && (w + nw > maxWords || (!sp.has(s) && sp.size >= 2))) { out.push(cur); cur = []; w = 0; sp = new Set(); }
    cur.push({ speaker: s, text }); w += nw; sp.add(s);
  }
  if (cur.length) out.push(cur);
  return out;
}
