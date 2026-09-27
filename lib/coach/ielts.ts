// IELTS General Training coach: all test, marking and course logic. Prompts live on the server;
// this drives the UI (components/coach/Ielts.tsx renders the state).
import { api } from '../client/api';
import { audioSeries, say as sayStudio, speakLines, warmVoices, type SpeakLine, type VoiceMap } from '../client/audio';
import { stopDictation, toggleDictation } from '../client/dictation';
import { bridge } from '../client/bridge';
import { CoachBase, clone, fmtTime, pickVoices, toArr, today, uid, words, type GenState, type Run } from './common';

/* ---------- constants ---------- */
export const SK: Record<string, string> = { L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' };
export const ORDER = ['L', 'R', 'W', 'S'];
export const TARGETS: Record<number, Record<string, number>> = { 7: { L: 6, R: 6, W: 6, S: 6 }, 8: { L: 7.5, R: 6.5, W: 6.5, S: 6.5 }, 9: { L: 8, R: 7, W: 7, S: 7 }, 10: { L: 8.5, R: 8, W: 7.5, S: 7.5 } };
export const SKCOL: Record<string, string> = { L: 'var(--cL)', R: 'var(--cR)', W: 'var(--cW)', S: 'var(--cS)', G: 'var(--muted)', V: 'var(--muted)' };
export const SEC: Record<string, { mins: number; note: string }> = {
  L: { mins: 32, note: '4 parts · 40 questions · 30 min listening + 2 min to check answers (computer-delivered format)' },
  R: { mins: 60, note: '3 sections · 40 questions · 60 min, no extra transfer time' },
  W: { mins: 60, note: 'Task 1 letter (150+ words, about 20 min) · Task 2 essay (250+ words, about 40 min)' },
  S: { mins: 14, note: 'Part 1 interview 4–5 min · Part 2 long turn (1 min prep, up to 2 min talk) · Part 3 discussion 4–5 min' }
};
export const RSEC = [{ start: 1, count: 14 }, { start: 15, count: 13 }, { start: 28, count: 13 }];
export const LPART = [{ start: 1 }, { start: 11 }, { start: 21 }, { start: 31 }];
export const DIFF: Record<string, { label: string; text: string }> = {
  foundation: { label: 'Foundation', text: 'the accessible end of real IELTS difficulty: clear texts, fewer traps, aimed at moving a candidate from band 5.5 to 6.5' },
  exam: { label: 'Exam standard', text: 'exactly real IELTS exam difficulty, as in Cambridge IELTS 17–19' },
  advanced: { label: 'Advanced', text: 'the upper end of real IELTS difficulty: dense texts, subtle paraphrase, strong distractors and tricky NOT GIVEN items, aimed at pushing a candidate from 7.5 to 8.5+' }
};
export const TYPE_NAMES: Record<string, string> = { tfng: 'True / False / Not Given', ynng: 'Yes / No / Not Given', mcq: 'Multiple choice', matching: 'Matching', headings: 'Matching headings', completion: 'Completion', short: 'Short answer' };
const L_TABLE = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [0, 1]];
const R_TABLE = [[39, 9], [37, 8.5], [36, 8], [34, 7.5], [32, 7], [30, 6.5], [27, 6], [23, 5.5], [19, 5], [15, 4.5], [12, 4], [9, 3.5], [6, 3], [4, 2.5], [2, 2], [0, 1]];
const CLB: Record<string, number[][]> = {
  L: [[8.5, 10], [8, 9], [7.5, 8], [6, 7], [5.5, 6], [5, 5], [4.5, 4]],
  R: [[8, 10], [7, 9], [6.5, 8], [6, 7], [5, 6], [4, 5], [3.5, 4]],
  W: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]],
  S: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]]
};
const DEFAULT_PROFILE = () => ({ v: 1, setupDone: false, clbTarget: 9, examDate: '', about: '', studyTime: '1 hour a day', bands: { L: null, R: null, W: null, S: null } as Record<string, number | null>, bandNote: {} as Record<string, string>, placementDone: false, qtypeStats: {} as Record<string, { c: number; t: number }>, usedTopics: [] as string[], history: [] as any[], activeAttemptId: null as string | null, errorPatterns: [] as string[] });
export type IeltsProfile = ReturnType<typeof DEFAULT_PROFILE>;

/* ---------- helpers ---------- */
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/^[\s"'(]+|[\s.,;:!?"')]+$/g, '').trim();
export const fmtBand = (b: number | null | undefined) => (b == null ? '–' : Number(b).toFixed(1));
export function roundBand(x: number) { const f = Math.floor(x), r = x - f; return r < 0.25 ? f : (r < 0.75 ? f + 0.5 : f + 1); }
function bandFrom(k: string, raw40: number) { const tb = k === 'L' ? L_TABLE : R_TABLE; for (const [min, b] of tb) if (raw40 >= min) return b; return 1; }
export function clbOf(k: string, b: number | null | undefined): number | string | null { if (b == null) return null; for (const [min, c] of CLB[k]) if (b >= min) return c; return b >= 3 ? '<4' : null; }
const jobCount = (k: string) => (k === 'L' ? 4 : k === 'R' ? 3 : 1);
export const parseKey = (txt: string) => { const key: Record<number, string[]> = {}; String(txt || '').split(/\n+/).forEach((line) => { const m = line.match(/^\s*(\d{1,2})\s*[.):\-]?\s+(.+?)\s*$/); if (m) key[Number(m[1])] = m[2].split(/\s*(?:\/|\||\bOR\b)\s*/i).map((x) => x.trim()).filter(Boolean); }); return key; };

const FEM = /female|woman|samantha|karen|moira|tessa|fiona|victoria|zira|susan|hazel|libby|sonia|natasha|aria|jenny|serena|kate|allison|ava|joanna|salli|kimberly|emma|amy|olivia|catherine/i;
const MAL = /\bmale\b|daniel|alex|fred|oliver|george|ryan|guy|david|mark|james|thomas|arthur|rishi|aaron|matthew|brian|william|lee/i;
function voiceRank(v: SpeechSynthesisVoice) { let s = 0; const n = v.name || ''; if (/natural|neural|online|premium|enhanced|siri|wavenet|studio/i.test(n)) s += 20; if (/google/i.test(n)) s += 6; if (/en[-_](GB|AU)/i.test(v.lang)) s += 4; else if (/en[-_](CA|IE|NZ)/i.test(v.lang)) s += 3; else if (/en[-_]US/i.test(v.lang)) s += 2; if (v.localService === false) s += 1; if (/compact|espeak|novelty|bad news|bells|bubbles|cellos|jester|organ|whisper|zarvox|trinoids|superstar|albert|boing|wobble|good news/i.test(n)) s -= 40; return s; }

export type SpeakStep = { part: number; phase?: 'prep' | 'talk' | 'follow'; label: string; q: string };
export function speakSteps(c: any): SpeakStep[] {
  const st: SpeakStep[] = [];
  toArr<any>(c.part1).forEach((tp) => toArr<string>(tp.questions).forEach((q) => st.push({ part: 1, label: 'Part 1 · ' + tp.topic, q })));
  const p2 = c.part2 || {};
  const card = p2.card + '\nYou should say:\n' + toArr<string>(p2.bullets).map((b) => '• ' + b).join('\n') + '\n' + (p2.final || '');
  st.push({ part: 2, phase: 'prep', label: 'Part 2 · preparation', q: card });
  st.push({ part: 2, phase: 'talk', label: 'Part 2 · long turn', q: card });
  if (p2.followup) st.push({ part: 2, phase: 'follow', label: 'Part 2 · rounding off', q: p2.followup });
  toArr<string>(c.part3).forEach((q) => st.push({ part: 3, label: 'Part 3 · discussion', q }));
  return st;
}
const PART_MS: Record<number, number> = { 1: 5 * 60000, 3: 5 * 60000 };

export type RealState = { files: File[]; answers: Record<number, string>; count: number; from: number; played: false | 'playing' | 'done'; key: string; transcript: string; result?: any; runId?: string };

/* ---------- state ---------- */
export class IeltsCoach extends CoachBase {
  S = {
    view: 'home', profile: DEFAULT_PROFILE(), course: null as any, run: null as Run | null, gen: {} as Record<string, GenState>,
    ready: false, booting: false, starting: false, sec: 'L', tab: 0, markErr: null as string | null,
    reportRun: null as Run | null, lessonUnit: null as any, lesson: null as any, lessonErr: null as string | null, lessonBusy: false,
    quizChecked: false, quizScore: 0, taskFb: null as any, taskAns: '', taskBusy: false,
    courseBusy: false, courseErr: null as string | null,
    confirmDiscard: false, confirmReset: false, confirmSubmit: false,
    mock: { type: 'full', diff: 'auto' }, usage: null as any,
    real: null as RealState | null, realBusy: false, realAudio: null as HTMLAudioElement | null,
    reports: {} as Record<string, string>,
    lmeter: {} as Record<number, number>, lstatus: {} as Record<number, string>, readOnceText: null as SpeakLine[] | null, rmeter: 0, rtime: ''
  };
  TARGET = TARGETS[9]; STRETCH = TARGETS[10];

  constructor() { super('ielts'); warmVoices(); }
  protected saveCurrent() { if (this.S.run) this.saveRun(this.S.run); }

  CLBT = () => this.S.profile.clbTarget || 9;
  setTargets() { this.TARGET = TARGETS[this.CLBT()] || TARGETS[9]; this.STRETCH = TARGETS[Math.min(10, this.CLBT() + 1)]; }
  daysLeft() { if (!this.S.profile.examDate) return null; const d = new Date(this.S.profile.examDate + 'T09:00:00'); return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000)); }

  saveProfile() { return this.serial('profile', () => this.set('profile', this.S.profile).catch(() => this.toast('Progress could not be saved. Check your connection.'))); }
  saveCourse() { return this.serial('course', () => this.set('course', this.S.course).catch(() => this.toast('Course could not be saved.'))); }
  scheduleSave() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveRun(this.S.run), 8000); }

  ai = (task: string, params: Record<string, unknown>) => api<any>('POST', '/api/ai', Object.assign({ exam: 'ielts', task }, params));
  weakTypes(skill?: string) {
    const st = this.S.profile.qtypeStats || {}; const out: { skill: string; type: string; pct: number; t: number }[] = [];
    for (const key in st) { const [k, tp] = key.split(':'); if (skill && k !== skill) continue; const v = st[key]; if (v.t >= 3) out.push({ skill: k, type: tp, pct: Math.round(100 * v.c / v.t), t: v.t }); }
    return out.sort((a, b) => a.pct - b.pct).slice(0, 4);
  }
  autoDiff(k: string) { const b = this.S.profile.bands[k]; if (b == null) return 'exam'; if (b < 6) return 'foundation'; if (b >= 7.5) return 'advanced'; return 'exam'; }

  fixGroups(groups: any, start: number) {
    let n = start; const out: any[] = [];
    for (const g of toArr<any>(groups)) {
      if (!g || !Array.isArray(g.questions)) continue;
      const type = TYPE_NAMES[g.type] ? g.type : 'short';
      const qs = g.questions.map((q: any) => ({ n: n++, prompt: String(q.prompt || ''), choices: Array.isArray(q.choices) ? q.choices.map(String) : undefined, answer: toArr(q.answer).map(String), evidence: String(q.evidence || ''), explain: String(q.explain || '') }));
      const opts = Array.isArray(g.options) ? g.options.map((o: any, i: number) => (typeof o === 'string' ? { label: String.fromCharCode(65 + i), text: o } : { label: String(o.label ?? String.fromCharCode(65 + i)), text: String(o.text ?? '') })) : undefined;
      out.push({ type, instructions: String(g.instructions || ''), options: opts, questions: qs });
    }
    return out;
  }
  fixContent(j: { k: string; i: number }, data: any) {
    if (!data || typeof data !== 'object') throw { code: 'invalid_json' };
    if (j.k === 'R') { const groups = this.fixGroups(data.groups, RSEC[j.i].start); if (!groups.length || !Array.isArray(data.texts)) throw { code: 'invalid_json' }; return { _pool: data._pool, title: String(data.title || 'Reading'), texts: data.texts.map((x: any) => ({ label: String(x.label || ''), heading: String(x.heading || ''), body: String(x.body || '') })), groups }; }
    if (j.k === 'L') { const groups = this.fixGroups(data.groups, LPART[j.i].start); if (!groups.length || !Array.isArray(data.script)) throw { code: 'invalid_json' }; return { _pool: data._pool, title: String(data.title || 'Listening'), context: String(data.context || ''), speakers: toArr(data.speakers), script: data.script.map((l: any) => ({ speaker: String(l.speaker || ''), text: String(l.text || '') })).filter((l: SpeakLine) => l.text), groups }; }
    if (j.k === 'W') { if (!data.task1 || !data.task2) throw { code: 'invalid_json' }; return data; }
    if (j.k === 'S') { if (!Array.isArray(data.part1) || !data.part2 || !Array.isArray(data.part3)) throw { code: 'invalid_json' }; return data; }
  }

  /* ---------- generation queue ---------- */
  jobsFor(run: Run) { const jobs: { k: string; i: number }[] = []; for (const k of run.sections) for (let i = 0; i < jobCount(k); i++) if (!(run.content[k] && run.content[k][i])) jobs.push({ k, i }); return jobs; }
  sectionReady(run: Run, k: string) { for (let i = 0; i < jobCount(k); i++) if (!(run.content[k] && run.content[k][i])) return false; return true; }
  async generateAll(run: Run) {
    const jobs = this.jobsFor(run).filter((j) => this.S.gen[j.k + j.i] !== 'busy');
    let idx = 0;
    const worker = async () => { while (idx < jobs.length) { const j = jobs[idx++]; await this.genJob(run, j); } };
    await Promise.all([worker(), worker(), worker()]);
  }
  async genJob(run: Run, j: { k: string; i: number }) {
    const key = j.k + j.i; this.S.gen[key] = 'busy'; this.emit();
    try {
      const data = await this.ai('gen', { attemptId: run.id, k: j.k, i: j.i });
      if (this.S.run !== run) return;
      run.content[j.k] = run.content[j.k] || {};
      run.content[j.k][j.i] = this.fixContent(j, data);
      this.S.gen[key] = 'ok'; this.saveRun(run);
    } catch (e) { this.S.gen[key] = { err: this.errCopy(e) }; }
    this.emit();
  }

  /* ---------- runs ---------- */
  newRun(kind: string, sections: string[], diff: string, label: string, unitId?: string): Run {
    return { id: 'a' + uid(), kind, sections, diff: diff || 'exam', label, unitId: unitId || null, startedAt: Date.now(), date: today(), content: {}, answers: { L: {}, R: {}, W: { t1: '', t2: '' }, S: {} }, state: {}, results: {}, status: 'active' };
  }
  async startRun(run: Run) {
    const S = this.S; if (S.starting) return; S.starting = true;
    try { const r = await api<{ id: string }>('POST', '/api/attempts/start', { exam: 'ielts', kind: run.unitId ? 'checkpoint' : run.kind, sections: run.sections, diff: run.diff }); run.id = r.id; }
    catch (e) { S.starting = false; this.handleError(e); return; }
    S.starting = false;
    S.run = run; S.gen = {}; S.profile.activeAttemptId = run.id; this.saveProfile(); this.saveRun(run);
    S.view = 'intro'; this.emit(); this.generateAll(run);
  }
  nextSection(run: Run) { return run.sections.find((k) => !run.results[k]); }
  goIntro() { this.S.view = 'intro'; this.stopTimer(); this.stopSpeech(); this.emit(); window.scrollTo(0, 0); }
  startSection(k: string) {
    const run = this.S.run!; const st = run.state[k];
    // "Continue" on an already-started section opens it without resetting the timer
    if (st && (k === 'S' ? st.started : st.deadline) && !st.submitted) { this.openSection(k); return; }
    if (k === 'S') run.state.S = run.state.S || { pos: 0, partDeadline: null, started: Date.now() };
    else run.state[k] = { deadline: Date.now() + SEC[k].mins * 60000, started: Date.now() };
    if (k === 'L') run.state.L.played = {};
    this.saveRun(run); this.openSection(k);
  }
  openSection(k: string) {
    const S = this.S; S.view = 'section'; S.sec = k; S.tab = 0; S.confirmSubmit = false; this.emit(); window.scrollTo(0, 0); this.startTimer();
    if (k === 'S') this.enterSpeakStep();
  }
  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      const run = this.S.run; if (!run || this.S.view !== 'section') return;
      const k = this.S.sec;
      if (k === 'S') { this.speakTick(); return; }
      if (run.state[k].deadline - Date.now() <= 0) { this.stopTimer(); this.submitSection(k, true); }
    }, 1000);
  }
  /** What the exam bar's clock shows. */
  timerLeft(): number | null {
    const run = this.S.run; if (!run) return null; const k = this.S.sec; const st = run.state[k] || {};
    let dl = st.deadline;
    if (k === 'S') { const step = speakSteps(run.content.S[0])[st.pos]; dl = step && (step.phase === 'prep' || step.phase === 'talk') ? st.stepDeadline : st.partDeadline; }
    return dl ? dl - Date.now() : null;
  }
  timerLow(left: number) { const k = this.S.sec; if (k !== 'S') return left < 5 * 60000; return left < 30000; }
  async submitSection(k: string, auto?: boolean) {
    const run = this.S.run!; this.stopTimer(); this.stopSpeech();
    if (auto) this.toast('Time is up. Your answers were submitted.');
    if (k === 'L' || k === 'R') {
      const units: any[] = []; for (let i = 0; i < jobCount(k); i++) units.push(run.content[k][i]);
      run.results[k] = this.autoMark(run, k, units);
      this.saveRun(run); this.afterSection();
    } else {
      run.state[k].submitted = true; this.saveRun(run);
      await this.markProduction(k);
    }
  }
  async markProduction(k: string) {
    const run = this.S.run!;
    this.S.view = 'marking'; this.S.sec = k; this.S.markErr = null; this.emit();
    try {
      const res = k === 'W' ? await this.markWriting(run) : await this.markSpeaking(run);
      run.results[k] = res; this.saveRun(run); this.afterSection();
    } catch (e) { this.S.markErr = this.errCopy(e); this.emit(); }
  }
  afterSection() { const run = this.S.run!; if (this.nextSection(run)) { this.goIntro(); return; } this.finishRun(run); }
  finishRun(run: Run) {
    const S = this.S;
    run.status = 'done'; run.finishedAt = Date.now();
    const p = S.profile; const bands: Record<string, number> = {};
    for (const k of run.sections) { const r = run.results[k]; if (r && r.band != null) { bands[k] = r.band; p.bands[k] = r.band; if (p.bandNote) delete p.bandNote[k]; } }
    const all = ORDER.every((k) => bands[k] != null);
    run.overall = all ? roundBand(ORDER.reduce((a, k) => a + bands[k], 0) / 4) : null;
    for (const k of ['L', 'R']) { const r = run.results[k]; if (!r) continue; for (const tp in r.per) { const key = k + ':' + tp; const s = p.qtypeStats[key] || (p.qtypeStats[key] = { c: 0, t: 0 }); s.c += r.per[tp].c; s.t += r.per[tp].t; } }
    const pats: string[] = []; for (const k of ['W', 'S']) { const r = run.results[k]; if (r && Array.isArray(r.patterns)) pats.push(...r.patterns.map(String)); }
    if (pats.length) p.errorPatterns = [...new Set([...pats, ...p.errorPatterns])].slice(0, 10);
    const topics: string[] = []; for (const k of run.sections) { const c = run.content[k] || {}; for (const i in c) { const x = c[i]; if (!x) continue; if (x.title) topics.push(x.title); if (x.task2 && x.task2.topic) topics.push(x.task2.topic); if (x.part2 && x.part2.topic) topics.push(x.part2.topic); } }
    p.usedTopics = [...(p.usedTopics || []), ...topics].slice(-40);
    p.history = [...(p.history || []), { id: run.id, date: run.date, kind: run.kind, label: run.label, bands, overall: run.overall }].slice(-60);
    if (run.kind === 'placement') p.placementDone = true;
    p.activeAttemptId = null;
    if (run.unitId && S.course) { S.course.progress = S.course.progress || {}; S.course.progress[run.unitId] = { done: true, score: null, band: Object.values(bands)[0] ?? null }; this.saveCourse(); }
    this.saveProfile(); this.saveRun(run);
    S.reportRun = run; S.run = null; S.view = 'report'; this.emit(); window.scrollTo(0, 0);
  }
  autoMark(run: Run, k: string, units: any[]) {
    const items: any[] = []; const per: Record<string, { c: number; t: number }> = {}; const ans = run.answers[k] || {};
    units.forEach((u) => (u ? u.groups : []).forEach((g: any) => g.questions.forEach((q: any) => {
      const given = ans[q.n] || ''; const acc = q.answer; const ok = this.isRight(g.type, given, acc);
      items.push({ n: q.n, type: g.type, prompt: q.prompt, choices: q.choices || null, options: g.options || null, given, correct: acc[0] ?? '', alts: acc.slice(1), ok, evidence: q.evidence, explain: q.explain });
      const tp = per[g.type] || (per[g.type] = { c: 0, t: 0 }); tp.t++; if (ok) tp.c++;
    })));
    items.sort((a, b) => a.n - b.n);
    const raw = items.filter((i) => i.ok).length, total = items.length;
    const scaled = Math.round(raw * 40 / Math.max(total, 1));
    return { raw, total, band: bandFrom(k, scaled), per, items };
  }
  isRight(type: string, given: unknown, acc: string[]) {
    const g = String(given || '').trim(); if (!g) return false;
    if (type === 'mcq') return acc.some((a) => String(a).trim().toUpperCase().charAt(0) === g.toUpperCase());
    if (type === 'tfng' || type === 'ynng') return acc.some((a) => String(a).trim().toUpperCase() === g.toUpperCase());
    return acc.some((a) => norm(a) === norm(g));
  }

  /* ---------- marking W/S ---------- */
  async markWriting(run: Run) {
    const a = run.answers.W;
    await this.saveRunNow(run);
    const r = await this.ai('markW', { attemptId: run.id });
    const b1 = Number(r.task1 && r.task1.band), b2 = Number(r.task2 && r.task2.band);
    if (!isFinite(b1) || !isFinite(b2)) throw { code: 'invalid_json' };
    return { band: roundBand((b1 + 2 * b2) / 3), t1: r.task1, t2: r.task2, errors: toArr(r.errors), patterns: toArr(r.patterns), model: r.model || null, next: toArr(r.next), wc: { t1: words(a.t1), t2: words(a.t2) } };
  }
  async markSpeaking(run: Run) {
    await this.saveRunNow(run);
    const r = await this.ai('markS', { attemptId: run.id });
    const fc = Number(r.FC), lr = Number(r.LR), gra = Number(r.GRA);
    if (![fc, lr, gra].every(isFinite)) throw { code: 'invalid_json' };
    return { band: roundBand((fc + lr + gra) / 3), crit: { FC: fc, LR: lr, GRA: gra }, summary: r.summary || '', errors: toArr(r.errors), patterns: toArr(r.patterns), model: r.model || null, next: toArr(r.next) };
  }

  /* ---------- speech (device voices) ---------- */
  engVoices() { if (!this.tts) return []; return speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang) || /^en$/i.test(v.lang)).sort((a, b) => voiceRank(b) - voiceRank(a)); }
  pickVoices(speakers: { name: string; gender?: string }[]) { return pickVoices(this.engVoices(), speakers, FEM, MAL, { maleGuard: true }); }
  speak(lines: SpeakLine[], vm: VoiceMap, onProgress?: (p: number) => void, onDone?: () => void, shared?: number) {
    const tok = shared != null ? shared : ++this.speakToken;
    speakLines(lines, vm, { lang: 'en-GB', rate: 0.97, token: tok, current: () => this.speakToken, onProgress, onDone });
  }
  speakP(lines: SpeakLine[], vm: VoiceMap, onProg: ((p: number) => void) | null, tok: number) { return new Promise<boolean>((res) => this.speak(lines, vm, onProg || undefined, () => res(true), tok)); }
  say(text: string) {
    const ex = () => ({ ex: this.pickVoices([{ name: 'ex', gender: 'female' }]).ex });
    if (this.ent().tts) { const tok = this.speakToken; sayStudio('ielts', text, {}, () => tok !== this.speakToken).then((ok) => { if (!ok && tok === this.speakToken && this.tts) this.speak([{ speaker: 'ex', text }], ex()); }); return; }
    if (this.tts) this.speak([{ speaker: 'ex', text }], ex());
  }
  voiceTest() {
    if (this.ent().tts) { this.stopSpeech(); this.say('Good morning, Riverside Sports Centre. How can I help you? This is how your Listening tests will sound.'); return; }
    const vm = this.pickVoices([{ name: 'a', gender: 'female' }, { name: 'b', gender: 'male' }]);
    this.speak([{ speaker: 'a', text: 'Good morning, Riverside Sports Centre. How can I help you?' }, { speaker: 'b', text: 'Hi, I\'d like to book a badminton court for Saturday, please.' }], vm);
  }

  /* ---------- speaking flow ---------- */
  enterSpeakStep() {
    const run = this.S.run!; const c = run.content.S[0]; const steps = speakSteps(c); const st = run.state.S; const step = steps[st.pos];
    if (!step) { this.submitSection('S'); return; }
    const prev = steps[st.pos - 1];
    if (step.phase === 'prep') st.stepDeadline = Date.now() + 60000;
    else if (step.phase === 'talk') st.stepDeadline = Date.now() + 120000;
    else st.stepDeadline = null;
    if (!prev || prev.part !== step.part) st.partDeadline = PART_MS[step.part] ? Date.now() + PART_MS[step.part] : null;
    this.saveRun(run); this.emit();
    if (step.phase !== 'talk') this.say(step.phase === 'prep' ? 'Now I\'m going to give you a topic, and I\'d like you to talk about it for one to two minutes. You have one minute to think about what you\'re going to say. You can make some notes if you wish.' : step.q);
    else this.say('All right? Remember you have one to two minutes for this. Please start speaking now.');
  }
  speakTick() {
    const run = this.S.run; if (!run) return; const st = run.state.S; const steps = speakSteps(run.content.S[0]); const step = steps[st.pos]; if (!step) return;
    const dl = step.phase === 'prep' || step.phase === 'talk' ? st.stepDeadline : st.partDeadline;
    if (dl && Date.now() >= dl) {
      if (step.phase === 'prep') { this.advanceSpeak(1); return; }
      if (step.phase === 'talk') { this.toast('Two minutes are up.'); this.advanceSpeak(1); return; }
      let i = st.pos; while (steps[i] && steps[i].part === step.part) i++;
      this.toast('Time for Part ' + step.part + ' is up.');
      st.pos = i; this.stopSpeech(); this.enterSpeakStep();
    }
  }
  advanceSpeak(d: number) { const run = this.S.run!; this.stopSpeech(); stopDictation(); run.state.S.pos += d; this.enterSpeakStep(); }
  repeatQuestion() { const run = this.S.run!; const step = speakSteps(run.content.S[0])[run.state.S.pos]; if (step) { this.stopSpeech(); this.say(step.q); } }

  /* ---------- answers ---------- */
  setAnswer(k: string, n: number | string, v: string) { this.S.run!.answers[k][n] = v; this.scheduleSave(); this.emit(); }
  setWriting(which: 't1' | 't2', v: string) { this.S.run!.answers.W[which] = v; this.scheduleSave(); this.emit(); }
  setSpeaking(key: string, v: string) { const A = this.S.run!.answers.S; if (key === 'notes') A.notes = v; else A[key] = v; this.scheduleSave(); this.emit(); }
  mic() {
    const run = this.S.run; if (!run) return;
    const st = run.state.S; const step = speakSteps(run.content.S[0])[st.pos]; const key = step && step.phase === 'prep' ? 'notes' : String(st.pos);
    toggleDictation(() => (key === 'notes' ? run.answers.S.notes : run.answers.S[key]) || '', 'en-GB', (v) => { if (this.S.run === run) this.setSpeaking(key, v); }, () => this.toast('The microphone is blocked. Allow it in your browser settings.'));
  }
  micTask() { toggleDictation(() => this.S.taskAns || '', 'en-GB', (v) => { this.S.taskAns = v; this.emit(); }, () => this.toast('The microphone is blocked. Allow it in your browser settings.')); }

  /* ---------- course ---------- */
  async buildCourse() {
    const S = this.S; S.view = 'course'; S.courseBusy = true; S.courseErr = null; this.emit();
    try {
      const r = await this.ai('course', {});
      if (!r || !Array.isArray(r.phases)) throw { code: 'invalid_json' };
      r.phases.forEach((ph: any) => { ph.units = toArr<any>(ph.units).map((u, i) => ({ id: String(u.id || ('u' + i)), skill: ORDER.includes(u.skill) ? u.skill : 'W', title: String(u.title || ''), goal: String(u.goal || ''), checkpoint: !!u.checkpoint })); });
      S.course = { title: String(r.title || 'Your course'), summary: String(r.summary || ''), phases: r.phases, createdAt: Date.now(), basedOn: clone(S.profile.bands), progress: {}, version: uid() };
      this.saveCourse();
    } catch (e) { S.courseErr = this.errCopy(e); }
    S.courseBusy = false; this.emit();
  }
  allUnits(): any[] { return this.S.course ? this.S.course.phases.flatMap((p: any) => p.units) : []; }
  async openUnit(id: string) {
    const S = this.S; const u = this.allUnits().find((x) => x.id === id); if (!u) return;
    S.view = 'lesson'; S.lessonUnit = u; S.lesson = null; S.lessonErr = null; S.quizChecked = false; S.taskFb = null; this.emit(); window.scrollTo(0, 0);
    if (u.checkpoint) return;
    const key = S.course.version + '_' + u.id;
    let l = null; try { l = await this.getLesson(key); } catch { /* ignore */ }
    if (l) { S.lesson = l; this.emit(); return; }
    await this.genLesson(u, key);
  }
  async genLesson(u: any, key: string) {
    const S = this.S; S.lessonBusy = true; this.emit();
    try {
      const r = await this.ai('lesson', { unitId: u.id });
      if (!r || !Array.isArray(r.quiz)) throw { code: 'invalid_json' };
      S.lesson = r; await this.setLesson(key, r).catch(() => {});
    } catch (e) { S.lessonErr = this.errCopy(e); }
    S.lessonBusy = false; this.emit();
  }
  relesson() { const u = this.S.lessonUnit; this.genLesson(u, this.S.course.version + '_' + u.id); }
  setQuizAnswer(i: number, v: string) { this.S.lesson.quiz[i]._given = v; this.emit(); }
  checkQuiz() {
    const S = this.S; const l = S.lesson; let c = 0;
    l.quiz.forEach((q: any) => {
      const v = q._given || '';
      q._ok = q.type === 'mcq' ? String(q.answer).trim().toUpperCase().charAt(0) === String(v).toUpperCase() : toArr<string>(q.answer).some((a) => norm(a) === norm(v));
      if (q._ok) c++;
    });
    const pct = Math.round(100 * c / l.quiz.length); S.quizChecked = true; S.quizScore = pct;
    const u = S.lessonUnit; S.course.progress = S.course.progress || {};
    const prev = S.course.progress[u.id];
    S.course.progress[u.id] = { done: pct >= 70 || (prev && prev.done), score: Math.max(pct, (prev && prev.score) || 0) };
    this.saveCourse(); this.emit();
  }
  async taskFeedback() {
    const S = this.S; const txt = S.taskAns || '';
    if (words(txt) < 20) { this.toast('Write at least 20 words first.'); return; }
    S.taskBusy = true; S.taskFb = null; this.emit();
    try { S.taskFb = await this.ai('taskfb', { unitId: S.lessonUnit.id, answer: txt }); }
    catch (e) { S.taskFb = { err: this.errCopy(e) }; }
    S.taskBusy = false; this.emit();
  }

  /* ---------- real recordings ---------- */
  realState(): RealState { return this.S.real || (this.S.real = { files: [], answers: {}, count: 40, from: 1, played: false, key: '', transcript: '' }); }
  realAudioPlay() {
    const R = this.realState(); if (!R.files.length || R.played) return; R.played = 'playing'; this.emit();
    const urls = R.files.map((f) => URL.createObjectURL(f)); let idx = 0; const au = new Audio(); this.S.realAudio = au;
    const go = () => {
      if (idx >= urls.length) { R.played = 'done'; this.S.rmeter = 100; this.emit(); this.toast('Recording finished. Check your answers, then paste the key.'); return; }
      au.src = urls[idx++]; au.play().catch(() => { R.played = false; this.emit(); this.toast('This file could not be played. Try an MP3.'); });
    };
    au.ontimeupdate = () => { if (au.duration) { this.S.rmeter = Math.round(100 * au.currentTime / au.duration); this.S.rtime = fmtTime(au.currentTime * 1000) + ' / ' + fmtTime(au.duration * 1000) + (urls.length > 1 ? ' · file ' + idx + ' of ' + urls.length : ''); this.emit(); } };
    au.onended = go; go();
  }
  realMark() {
    const S = this.S; const R = this.realState(); const key = parseKey(R.key); const items: any[] = [];
    for (let n = R.from; n < R.from + R.count; n++) { const acc = key[n]; if (!acc) continue; const given = R.answers[n] || ''; const ok = !!given.trim() && acc.some((a) => (a.length === 1 && /[a-h]/i.test(a) ? a.toUpperCase() === given.trim().toUpperCase() : norm(a) === norm(given))); items.push({ n, type: 'completion', prompt: 'Question ' + n, given, correct: acc[0], alts: acc.slice(1), ok, evidence: '', explain: '' }); }
    if (!items.length) { this.toast('Paste the answer key first: one line per question, like "1 Hartley".'); return; }
    const raw = items.filter((i) => i.ok).length, total = items.length;
    const band = bandFrom('L', Math.round(raw * 40 / total));
    R.result = { raw, total, band, items };
    const id = 'r' + uid(); const run: Run = { id, kind: 'real', sections: ['L'], diff: 'exam', unitId: null, label: 'Real recording · ' + (R.files.map((f) => f.name).join(', ') || 'Listening'), date: today(), startedAt: Date.now(), status: 'done', content: {}, answers: {}, state: {}, results: { L: { raw, total, band, per: {}, items } } };
    this.saveRun(run); S.profile.bands.L = band; if (S.profile.bandNote) delete S.profile.bandNote.L;
    S.profile.history = [...(S.profile.history || []), { id, date: run.date, kind: 'real', label: run.label, bands: { L: band }, overall: null }].slice(-60); this.saveProfile();
    R.runId = id; this.emit();
  }
  async realExplain() {
    const S = this.S; const R = this.realState(); const wrong = R.result.items.filter((i: any) => !i.ok); if (!wrong.length) { this.toast('No mistakes to explain.'); return; }
    S.realBusy = true; this.emit();
    try {
      const r = await this.ai('real', { wrong: wrong.map((i: any) => ({ n: i.n, given: i.given, key: [i.correct, ...i.alts].join(' / ') })), transcript: R.transcript });
      toArr<any>(r.items).forEach((x) => { const it = R.result.items.find((i: any) => i.n === Number(x.n)); if (it) it.cause = String(x.cause || ''); });
      R.result.patterns = toArr(r.patterns).map(String);
    } catch (e) { this.toast(this.errCopy(e)); }
    S.realBusy = false; this.emit();
  }
  realReset() { if (this.S.realAudio) { try { this.S.realAudio.pause(); } catch { /* ignore */ } } this.S.real = null; this.S.rmeter = 0; this.S.rtime = ''; this.emit(); }
  realRange(from: number, to: number) { const R = this.realState(); if (from > 0 && to >= from && to - from < 60) { R.from = from; R.count = to - from + 1; this.emit(); } else this.toast('Enter a range like 1 to 40.'); }

  /* ---------- listening ---------- */
  playListening() {
    const S = this.S; const run = S.run!; const i = S.tab; const part = run.content.L[i];
    run.state.L.played = run.state.L.played || {};
    if (run.state.L.played[i]) return;
    run.state.L.played[i] = 'playing'; S.lmeter[i] = 0; this.emit();
    if (this.ent().tts) this.runPartNatural(run, i, part); else { this.saveRun(run); this.runPart(run, i, part); }
  }
  private status(i: number, txt: string) { this.S.lstatus[i] = txt; this.emit(); }
  private meter(i: number, pct: number) { this.S.lmeter[i] = pct; this.emit(); }
  private partDone(run: Run, i: number) {
    run.state.L.played[i] = 'done'; this.saveRun(run);
    this.S.lmeter[i] = 100;
    this.emit(); this.toast('Part ' + (i + 1) + ' finished.' + (i < 3 ? ' Go to Part ' + (i + 2) + '.' : ''));
  }
  async runPartNatural(run: Run, i: number, part: any) {
    const tok = ++this.speakToken;
    this.status(i, 'Loading the recording…');
    let plan: { chunks: { kind: string }[] };
    try { await this.saveRunNow(run); plan = await api('POST', '/api/tts/plan', { exam: 'ielts', attemptId: run.id, part: i }); }
    catch { if (tok !== this.speakToken) return; this.status(i, 'Studio voices unavailable, using device voices.'); return this.runPart(run, i, part); }
    if (tok !== this.speakToken) return;
    const q = audioSeries('/api/tts/chunk?exam=ielts&attemptId=' + encodeURIComponent(run.id) + '&part=' + i, plan.chunks.length);
    const idx = (k: string) => plan.chunks.map((c, n) => (c.kind === k ? n : -1)).filter((n) => n >= 0);
    const scriptIdx = idx('script');
    const vm = this.pickVoices(toArr<any>(part.speakers).length ? part.speakers : [{ name: 'Speaker', gender: 'female' }]);
    const playOr = async (n: number | undefined, lines?: SpeakLine[]) => { const ok = await q.play(n, () => tok !== this.speakToken); if (!ok && tok === this.speakToken && lines) await this.speakP(lines, vm, null, tok); };
    const a = LPART[i].start, b = a + 9;
    q.prefetch(0); q.prefetch(1); if (scriptIdx.length) q.prefetch(scriptIdx[0]);
    this.status(i, 'Introduction');
    await playOr(idx('intro')[0]);
    if (tok !== this.speakToken) return;
    scriptIdx.slice(1, 3).forEach((n) => q.prefetch(n));
    if (!await this.waitFor(30000, tok, (l) => this.status(i, 'Read questions ' + a + ' to ' + b + ': ' + Math.ceil(l / 1000) + ' s'))) return;
    await playOr(idx('go')[0]);
    this.status(i, 'Recording playing');
    for (let n = 0; n < scriptIdx.length; n++) {
      if (tok !== this.speakToken) return;
      if (scriptIdx[n + 1] != null) q.prefetch(scriptIdx[n + 1]); if (scriptIdx[n + 2] != null) q.prefetch(scriptIdx[n + 2]);
      await playOr(scriptIdx[n]);
      this.meter(i, Math.round((n + 1) / scriptIdx.length * 100));
    }
    if (tok !== this.speakToken) return;
    await playOr(idx('outro')[0]);
    if (tok !== this.speakToken) return;
    if (!await this.waitFor(30000, tok, (l) => this.status(i, 'Check your answers: ' + Math.ceil(l / 1000) + ' s'))) return;
    q.dispose();
    this.partDone(run, i);
  }
  async runPart(run: Run, i: number, part: any) {
    const tok = ++this.speakToken;
    const vm = this.pickVoices(toArr<any>(part.speakers).length ? part.speakers : [{ name: 'Speaker', gender: 'female' }]);
    const nar: VoiceMap = { __n: this.pickVoices([{ name: 'n', gender: 'male' }]).n };
    const a = LPART[i].start, b = a + 9;
    this.status(i, 'Introduction');
    await this.speakP([{ speaker: '__n', text: 'Part ' + (i + 1) + '. ' + part.context + ' First, you have some time to look at questions ' + a + ' to ' + b + '.' }], nar, null, tok);
    if (tok !== this.speakToken) return;
    if (!await this.waitFor(30000, tok, (l) => this.status(i, 'Read questions ' + a + ' to ' + b + ': ' + Math.ceil(l / 1000) + ' s'))) return;
    this.status(i, 'Now listen carefully.');
    await this.speakP([{ speaker: '__n', text: 'Now listen carefully and answer questions ' + a + ' to ' + b + '.' }], nar, null, tok);
    if (tok !== this.speakToken) return;
    this.status(i, 'Recording playing');
    await this.speakP(part.script, vm, (p) => this.meter(i, Math.round(p * 100)), tok);
    if (tok !== this.speakToken) return;
    await this.speakP([{ speaker: '__n', text: 'That is the end of Part ' + (i + 1) + '. You now have 30 seconds to check your answers.' }], nar, null, tok);
    if (tok !== this.speakToken) return;
    if (!await this.waitFor(30000, tok, (l) => this.status(i, 'Check your answers: ' + Math.ceil(l / 1000) + ' s'))) return;
    this.partDone(run, i);
  }
  readOnce() {
    const S = this.S; const run = S.run!; const i = S.tab; const part = run.content.L[i];
    run.state.L.played = run.state.L.played || {}; if (run.state.L.played[i]) return;
    run.state.L.played[i] = 'done'; this.saveRun(run);
    S.readOnceText = part.script; this.emit();
    const ms = Math.max(30000, words(part.script.map((l: SpeakLine) => l.text).join(' ')) / 2.6 * 1000);
    setTimeout(() => { S.readOnceText = null; this.emit(); }, ms);
  }

  /* ---------- actions from the views ---------- */
  nav(v: string) {
    const S = this.S;
    if (S.run && ['intro', 'section', 'marking'].includes(S.view)) return;
    S.view = v; if (v === 'tests') this.loadUsage(); S.confirmReset = false; this.emit(); window.scrollTo(0, 0);
  }
  loadUsage() { api('GET', '/api/usage/ielts').then((u) => { this.S.usage = u; this.emit(); }).catch(() => {}); }
  async openReport(id: string) {
    const S = this.S; S.view = 'report'; S.reportRun = null; this.emit();
    try { S.reportRun = await this.getAttempt(id); } catch { /* ignore */ }
    if (!S.reportRun) this.toast('That result could not be loaded.');
    this.emit(); window.scrollTo(0, 0);
  }
  setTab(i: number) { if (this.S.view !== 'section') return; this.S.tab = i; this.saveRun(this.S.run); this.emit(); window.scrollTo(0, 0); }
  reportOpen(k: string, i: number) { this.S.reports[k + i] = 'open'; this.emit(); }
  async reportSend(k: string, i: number, reason: string) {
    this.S.reports[k + i] = 'sent'; this.emit();
    try { await this.saveRunNow(this.S.run!); await api('POST', '/api/pool/report', { exam: 'ielts', attemptId: this.S.run!.id, k, i, reason }); } catch { /* ignore */ }
  }
  placement() { return this.startRun(this.newRun('placement', ORDER.slice(), 'exam', 'Placement test')); }
  mock() { const m = this.S.mock; const secs = m.type === 'full' ? ORDER.slice() : [m.type]; return this.startRun(this.newRun('mock', secs, m.diff, (m.type === 'full' ? 'Full mock test' : SK[m.type] + ' mock') + ' · ' + (m.diff === 'auto' ? 'auto level' : DIFF[m.diff].label))); }
  checkpoint() { const u = this.S.lessonUnit; return this.startRun(this.newRun('mock', [u.skill], 'auto', SK[u.skill] + ' checkpoint · ' + u.title, u.id)); }
  setMock(p: Partial<{ type: string; diff: string }>) { Object.assign(this.S.mock, p); this.emit(); }
  confirm(k: 'confirmDiscard' | 'confirmReset' | 'confirmSubmit', v: boolean) { this.S[k] = v; this.emit(); if (k === 'confirmSubmit' && v) window.scrollTo(0, 0); }
  async discard() {
    const S = this.S; const id = S.profile.activeAttemptId; S.profile.activeAttemptId = null; S.confirmDiscard = false; this.saveProfile();
    try { const r = id ? await this.getAttempt(id) : null; if (r) { r.status = 'discarded'; await this.saveAttempt(r); } } catch { /* ignore */ }
    S.run = null; this.emit();
  }
  regen() { const S = this.S; for (const k in S.gen) { const g = S.gen[k]; if (g && typeof g === 'object' && g.err) delete S.gen[k]; } this.emit(); this.generateAll(S.run!); }
  leave() { this.saveRun(this.S.run); this.stopTimer(); this.stopSpeech(); this.S.run = null; this.S.view = 'home'; this.emit(); }
  submit() { this.S.confirmSubmit = false; this.submitSection(this.S.sec, false); }
  remark() { this.markProduction(this.S.sec); }
  saveSettings(v: { clbTarget: number; examDate: string; studyTime: string; about: string }) {
    const p = this.S.profile; p.clbTarget = Number(v.clbTarget) || 9; p.examDate = v.examDate || ''; p.studyTime = v.studyTime || p.studyTime; p.about = (v.about || '').slice(0, 280);
    const first = !p.setupDone; p.setupDone = true; this.setTargets(); this.saveProfile();
    this.toast(first ? 'Saved. Start with the placement test.' : 'Settings saved.'); this.emit();
  }
  async resetAll() {
    try { await api('DELETE', '/api/docs/ielts'); } catch (e) { this.handleError(e); return; }
    this.S.profile = DEFAULT_PROFILE(); this.S.course = null; this.S.confirmReset = false; this.setTargets(); this.toast('IELTS progress erased.'); this.emit();
  }
  async resume() {
    const S = this.S; const id = S.profile.activeAttemptId; if (!id) return;
    let run: Run | null = null; try { run = await this.getAttempt(id); } catch { /* ignore */ }
    if (!run) { this.toast('That test could not be loaded.'); S.profile.activeAttemptId = null; this.saveProfile(); this.emit(); return; }
    run.content = run.content || {}; run.answers = run.answers || { L: {}, R: {}, W: { t1: '', t2: '' }, S: {} }; run.state = run.state || {}; run.results = run.results || {};
    S.run = run; S.gen = {};
    const k = this.nextSection(run);
    if (k && run.state[k] && run.state[k].submitted) { S.sec = k; this.markProduction(k); return; }
    if (k && k !== 'S' && run.state[k] && run.state[k].deadline && Date.now() >= run.state[k].deadline) { S.sec = k; this.submitSection(k, true); return; }
    S.view = 'intro'; this.emit(); this.generateAll(run);
  }

  /* ---------- boot ---------- */
  async boot() {
    const S = this.S; this.emit();
    try { const p = await this.get('profile'); if (p) S.profile = Object.assign(DEFAULT_PROFILE(), p); } catch (e) { this.handleError(e); }
    try { const c = await this.get('course'); if (c && Array.isArray(c.phases)) S.course = c; } catch { /* ignore */ }
    this.setTargets(); S.ready = true; this.emit();
  }
  mount() { this.active = true; if (!this.S.ready && !this.S.booting) { this.S.booting = true; this.boot(); } else this.emit(); }
  unmount() { this.active = false; this.stopSpeech(); stopDictation(); }
  firstName() { return ((bridge.me() && bridge.me()!.name) || '').split(' ')[0] || 'there'; }
}
