// TEF Canada coach: all test, marking and course logic (the interface of this coach is in French).
// components/coach/Tef.tsx renders the state.
import { api } from '../client/api';
import { audioSeries, say as sayStudio, speakLines, warmVoices, type SpeakLine, type VoiceMap } from '../client/audio';
import { stopDictation, toggleDictation } from '../client/dictation';
import { bridge } from '../client/bridge';
import { CoachBase, carryProgress, lessonKeyOf, pickVoices, toArr, today, uid, words, type GenState, type Run } from './common';

/* ---------- constants ---------- */
export const SK: Record<string, string> = { L: 'Compréhension orale', R: 'Compréhension écrite', W: 'Expression écrite', S: 'Expression orale' };
export const AB: Record<string, string> = { L: 'CO', R: 'CE', W: 'EE', S: 'EO' };
export const ORDER = ['L', 'R', 'W', 'S'];
export const SKCOL: Record<string, string> = { L: 'var(--cL)', R: 'var(--cR)', W: 'var(--cW)', S: 'var(--cS)' };
const NCLC_T: Record<string, number[][]> = {
  L: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]],
  R: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]],
  W: [[558, 10], [512, 9], [472, 8], [428, 7], [379, 6], [330, 5], [268, 4]],
  S: [[556, 10], [518, 9], [494, 8], [456, 7], [422, 6], [387, 5], [328, 4]]
};
const RAWMAP = [[0, 100], [8, 230], [14, 306], [18, 352], [22, 393], [25, 434], [28, 462], [32, 503], [36, 546], [40, 699]];
export const SEC: Record<string, { mins: number; time: string; note: string }> = {
  L: { mins: 40, time: '40 min', note: '4 parties · 40 questions à choix multiple · chaque enregistrement n’est diffusé qu’une seule fois, sans retour en arrière' },
  R: { mins: 60, time: '60 min', note: '4 parties · 40 questions à choix multiple · navigation libre' },
  W: { mins: 60, time: '60 min', note: 'Section A : suite d’un fait divers, 80 mots minimum, 25 min · Section B : défendre un point de vue, 200 mots minimum, 35 min' },
  S: { mins: 15, time: '15 min', note: 'Section A : obtenir des informations au téléphone, 5 min · Section B : convaincre un(e) ami(e), 10 min' }
};
export const LPART = [{ start: 1, type: 'messages', name: 'Messages et annonces' }, { start: 11, type: 'dialogues', name: 'Conversations' }, { start: 21, type: 'radio', name: 'Radio et informations' }, { start: 31, type: 'entretiens', name: 'Entretiens et débats' }];
export const RPART = [{ start: 1, type: 'pratiques', name: 'Documents pratiques' }, { start: 11, type: 'presse', name: 'Articles de presse' }, { start: 21, type: 'administratifs', name: 'Textes administratifs et professionnels' }, { start: 31, type: 'argumentatifs', name: 'Textes d’opinion' }];
export const TYPE_NAMES: Record<string, string> = { messages: 'CO · messages et annonces', dialogues: 'CO · conversations', radio: 'CO · radio', entretiens: 'CO · entretiens et débats', pratiques: 'CE · documents pratiques', presse: 'CE · articles de presse', administratifs: 'CE · textes administratifs', argumentatifs: 'CE · textes d’opinion' };
export const DIFF: Record<string, { label: string }> = { foundation: { label: 'Progressif' }, exam: { label: 'Niveau examen' }, advanced: { label: 'Avancé' } };
const DEFAULT_PROFILE = () => ({ v: 1, setupDone: false, examDate: '', target: 7, about: '', studyTime: '1 heure par jour', scores: { L: null, R: null, W: null, S: null } as Record<string, number | null>, placementDone: false, typeStats: {} as Record<string, { c: number; t: number }>, usedTopics: [] as string[], history: [] as any[], activeAttemptId: null as string | null, errorPatterns: [] as string[] });

/* ---------- helpers ---------- */
const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/^[\s"'(«]+|[\s.,;:!?"')»]+$/g, '').trim();
export const fmtS = (s: number | null | undefined) => (s == null ? '–' : String(Math.round(s)));
export function nclcOf(k: string, s: number | null | undefined) { if (s == null) return null; for (const [m, n] of NCLC_T[k]) if (s >= m) return n; return 3; }
export const nclcTxt = (n: number | null | undefined) => (n == null ? '–' : (n < 4 ? '< 4' : String(n)));
export function minFor(k: string, n: number) { const r = NCLC_T[k].find((x) => x[1] === n); return r ? r[0] : 0; }
function rawToScore(raw: number, total: number) { const r = raw * 40 / Math.max(total, 1); for (let i = 1; i < RAWMAP.length; i++) { const [a, sa] = RAWMAP[i - 1], [b, sb] = RAWMAP[i]; if (r <= b) return Math.round(sa + (sb - sa) * (r - a) / (b - a)); } return 699; }
export const jobCount = (k: string) => ((k === 'L' || k === 'R') ? 4 : 1);

const FEM = /female|femme|amélie|amelie|audrey|aurélie|aurelie|julie|marie|céline|celine|chantal|sylvie|denise|hortense|virginie|léa|lea|juliette|joana|google français|caroline|brigitte|eloise|vivienne|sylvie/i;
const MAL = /\bmale\b|homme|thomas|nicolas|daniel|henri|paul|claude|jacques|antoine|jean|guillaume|mathieu|remy|rémy|alain|jérôme|jerome|fabrice|gérard|gerard/i;
function voiceRank(v: SpeechSynthesisVoice) { let s = 0; const n = v.name || ''; if (/natural|neural|online|premium|enhanced|siri|wavenet|studio/i.test(n)) s += 20; if (/google/i.test(n)) s += 6; if (/fr[-_](FR|CA)/i.test(v.lang)) s += 3; if (v.localService === false) s += 1; if (/compact|espeak/i.test(n)) s -= 40; return s; }
const SENT_FR = /[^.!?…]+[.!?…]*\s*/g;

export class TefCoach extends CoachBase {
  S = {
    view: 'home', profile: DEFAULT_PROFILE(), course: null as any, run: null as Run | null, gen: {} as Record<string, GenState>,
    ready: false, booting: false, starting: false, sec: 'L', tab: 0, markErr: null as string | null,
    reportRun: null as Run | null, lessonUnit: null as any, lesson: null as any, lessonErr: null as string | null, lessonBusy: false,
    quizChecked: false, quizScore: 0, taskFb: null as any, taskAns: '', taskBusy: false,
    courseBusy: false, courseErr: null as string | null,
    confirmDiscard: false, confirmReset: false, confirmSubmit: false, confirmNext: false,
    mock: { type: 'full', diff: 'auto' }, usage: null as any, reports: {} as Record<string, string>,
    exBusy: false, draft: '', lmeter: 0, lstatus: 'Une seule écoute', readOnceText: null as SpeakLine[] | null
  };

  constructor() { super('tef'); warmVoices(); }
  protected saveCurrent() { if (this.S.run) this.saveRun(this.S.run); }
  daysLeft() { if (!this.S.profile.examDate) return null; const d = new Date(this.S.profile.examDate + 'T09:00:00'); return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000)); }

  saveProfile() { return this.serial('profile', () => this.set('profile', this.S.profile).catch(() => this.toast('La progression n’a pas pu être enregistrée.'))); }
  saveCourse() { return this.serial('course', () => this.set('course', this.S.course).catch(() => this.toast('Le parcours n’a pas pu être enregistré.'))); }
  scheduleSave() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveRun(this.S.run), 8000); }

  ai = (task: string, params: Record<string, unknown>) => api<any>('POST', '/api/ai', Object.assign({ exam: 'tef', task }, params));
  weakTypes(skill?: string) {
    const st = this.S.profile.typeStats || {}; const out: { skill: string; type: string; pct: number; t: number }[] = [];
    for (const key in st) { const [k, tp] = key.split(':'); if (skill && k !== skill) continue; const v = st[key]; if (v.t >= 3) out.push({ skill: k, type: tp, pct: Math.round(100 * v.c / v.t), t: v.t }); }
    return out.sort((a, b) => a.pct - b.pct).slice(0, 4);
  }
  autoDiff(k: string) { const s = this.S.profile.scores[k]; if (s == null) return 'exam'; const n = nclcOf(k, s)!; if (n < 6) return 'foundation'; if (n >= 8) return 'advanced'; return 'exam'; }
  fixDocs(docs: any, start: number) {
    let n = start; const out: any[] = [];
    for (const d of toArr<any>(docs)) {
      if (!d || !Array.isArray(d.questions)) continue;
      const qs = d.questions.map((q: any) => ({ n: n++, prompt: String(q.prompt || ''), choices: toArr(q.choices).map(String), answer: String(toArr(q.answer)[0] || 'A').trim().toUpperCase().charAt(0), evidence: String(q.evidence || ''), explain: String(q.explain || '') }));
      out.push({ kind: String(d.kind || ''), heading: String(d.heading || ''), body: String(d.body || ''), context: String(d.context || ''), speakers: toArr(d.speakers), script: toArr<any>(d.script).map((l) => ({ speaker: String(l.speaker || ''), text: String(l.text || '') })).filter((l) => l.text), questions: qs });
    }
    return out;
  }
  fixContent(j: { k: string; i: number }, data: any) {
    if (!data || typeof data !== 'object') throw { code: 'invalid_json' };
    if (j.k === 'R' || j.k === 'L') { const P = j.k === 'R' ? RPART : LPART; const docs = this.fixDocs(data.docs, P[j.i].start); if (!docs.length) throw { code: 'invalid_json' }; if (j.k === 'L' && docs.some((d) => !d.script.length)) throw { code: 'invalid_json' }; return { _pool: data._pool, title: String(data.title || ''), type: P[j.i].type, docs }; }
    if (j.k === 'W') { if (!data.A || !data.B) throw { code: 'invalid_json' }; return data; }
    if (j.k === 'S') { if (!data.A || !data.B) throw { code: 'invalid_json' }; return data; }
  }

  /* ---------- generation ---------- */
  jobsFor(run: Run) { const jobs: { k: string; i: number }[] = []; for (const k of run.sections) for (let i = 0; i < jobCount(k); i++) if (!(run.content[k] && run.content[k][i])) jobs.push({ k, i }); return jobs; }
  sectionReady(run: Run, k: string) { for (let i = 0; i < jobCount(k); i++) if (!(run.content[k] && run.content[k][i])) return false; return true; }
  async generateAll(run: Run) {
    const jobs = this.jobsFor(run).filter((j) => this.S.gen[j.k + j.i] !== 'busy'); let idx = 0;
    const worker = async () => { while (idx < jobs.length) { const j = jobs[idx++]; await this.genJob(run, j); } };
    await Promise.all([worker(), worker(), worker()]);
  }
  async genJob(run: Run, j: { k: string; i: number }) {
    const key = j.k + j.i; this.S.gen[key] = 'busy'; this.emit();
    try {
      const data = await this.ai('gen', { attemptId: run.id, k: j.k, i: j.i });
      if (this.S.run !== run) return;
      run.content[j.k] = run.content[j.k] || {}; run.content[j.k][j.i] = this.fixContent(j, data);
      this.S.gen[key] = 'ok'; this.saveRun(run);
    } catch (e) { this.S.gen[key] = { err: this.errCopy(e) }; }
    this.emit();
  }

  /* ---------- runs ---------- */
  newRun(kind: string, sections: string[], diff: string, label: string, unitId?: string): Run { return { id: 'a' + uid(), kind, sections, diff: diff || 'exam', label, unitId: unitId || null, startedAt: Date.now(), date: today(), content: {}, answers: { L: {}, R: {}, W: { A: '', B: '' }, S: { A: [], B: [] } }, state: {}, results: {}, status: 'active' }; }
  async startRun(run: Run) {
    const S = this.S; if (S.starting) return; S.starting = true;
    try { const r = await api<{ id: string }>('POST', '/api/attempts/start', { exam: 'tef', kind: run.unitId ? 'checkpoint' : run.kind, sections: run.sections, diff: run.diff }); run.id = r.id; }
    catch (e) { S.starting = false; this.handleError(e); return; }
    S.starting = false;
    S.run = run; S.gen = {}; S.profile.activeAttemptId = run.id; this.saveProfile(); this.saveRun(run);
    S.view = 'intro'; this.emit(); this.generateAll(run);
  }
  nextSection(run: Run) { return run.sections.find((k) => !run.results[k]); }
  goIntro() { this.S.view = 'intro'; this.stopTimer(); this.stopSpeech(); this.emit(); window.scrollTo(0, 0); }
  started(run: Run, k: string) { const st = run.state[k]; return !!(st && st.started); }
  startSection(k: string) {
    const S = this.S; const run = S.run!;
    if (!this.started(run, k)) {
      const now = Date.now();
      if (k === 'L') run.state.L = { started: now, deadline: now + 40 * 60000, pos: { p: 0, d: 0 }, played: {} };
      if (k === 'R') run.state.R = { started: now, deadline: now + 60 * 60000 };
      if (k === 'W') run.state.W = { started: now, phase: 'A', deadline: now + 25 * 60000 };
      if (k === 'S') run.state.S = { started: now, phase: 'A', deadline: null };
      this.saveRun(run);
    }
    S.view = 'section'; S.sec = k; S.tab = 0; S.confirmSubmit = false; S.lmeter = 0; S.lstatus = 'Une seule écoute'; this.emit(); window.scrollTo(0, 0); this.startTimer();
  }
  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      const run = this.S.run; if (!run || this.S.view !== 'section') return; const k = this.S.sec; const st = run.state[k];
      if (!st.deadline) return;
      if (st.deadline - Date.now() <= 0) {
        if (k === 'W' && st.phase === 'A') { this.toast('Fin de la section A. Passez à la section B.'); this.toPhaseB('W'); return; }
        if (k === 'S' && st.phase === 'A') { this.toast('Fin de la section A.'); this.toPhaseB('S'); return; }
        this.stopTimer(); this.submitSection(k, true);
      }
    }, 1000);
  }
  timerLeft(): number | null { const run = this.S.run; if (!run) return null; const st = run.state[this.S.sec] || {}; return st.deadline ? st.deadline - Date.now() : null; }
  timerLow(left: number) { return left < (this.S.sec === 'S' ? 60000 : 5 * 60000); }
  toPhaseB(k: string) {
    const S = this.S; const st = S.run!.state[k]; this.stopSpeech(); S.exBusy = false; stopDictation();
    if (k === 'W') { st.phase = 'B'; st.deadline = Date.now() + 35 * 60000; }
    if (k === 'S') { st.phase = 'Bwait'; st.deadline = null; }
    S.confirmNext = false; this.saveRun(S.run); this.emit(); window.scrollTo(0, 0);
  }
  async submitSection(k: string, auto?: boolean) {
    const run = this.S.run!; this.stopTimer(); this.stopSpeech();
    if (auto) this.toast('Temps écoulé. Vos réponses ont été envoyées.');
    if (k === 'L' || k === 'R') { run.results[k] = this.autoMark(run, k); this.saveRun(run); this.afterSection(); }
    else { run.state[k].submitted = true; this.saveRun(run); await this.markProduction(k); }
  }
  async markProduction(k: string) {
    const S = this.S; S.view = 'marking'; S.sec = k; S.markErr = null; this.emit();
    try { const res = k === 'W' ? await this.markWriting(S.run!) : await this.markSpeaking(S.run!); S.run!.results[k] = res; this.saveRun(S.run); this.afterSection(); }
    catch (e) { S.markErr = this.errCopy(e); this.emit(); }
  }
  afterSection() { if (this.nextSection(this.S.run!)) { this.goIntro(); return; } this.finishRun(this.S.run!); }
  finishRun(run: Run) {
    const S = this.S;
    run.status = 'done'; run.finishedAt = Date.now();
    const p = S.profile; const scores: Record<string, number> = {};
    for (const k of run.sections) { const r = run.results[k]; if (r && r.score != null) { scores[k] = r.score; p.scores[k] = r.score; } }
    const all = ORDER.every((k) => scores[k] != null);
    run.nclc = all ? Math.min(...ORDER.map((k) => nclcOf(k, scores[k])!)) : null;
    for (const k of ['L', 'R']) { const r = run.results[k]; if (!r) continue; for (const tp in r.per) { const key = k + ':' + tp; const s = p.typeStats[key] || (p.typeStats[key] = { c: 0, t: 0 }); s.c += r.per[tp].c; s.t += r.per[tp].t; } }
    const pats: string[] = []; for (const k of ['W', 'S']) { const r = run.results[k]; if (r && Array.isArray(r.patterns)) pats.push(...r.patterns.map(String)); }
    if (pats.length) p.errorPatterns = [...new Set([...pats, ...p.errorPatterns])].slice(0, 10);
    const topics: string[] = []; for (const k of run.sections) { const c = run.content[k] || {}; for (const i in c) { const x = c[i]; if (!x) continue; if (x.title) topics.push(x.title); if (x.A && x.A.topic) topics.push(x.A.topic); if (x.B && x.B.topic) topics.push(x.B.topic); } }
    p.usedTopics = [...(p.usedTopics || []), ...topics].slice(-40);
    p.history = [...(p.history || []), { id: run.id, date: run.date, kind: run.kind, label: run.label, scores, nclc: run.nclc }].slice(-60);
    if (run.kind === 'placement') p.placementDone = true;
    p.activeAttemptId = null;
    if (run.unitId && S.course) { S.course.progress = S.course.progress || {}; const k = run.sections[0]; S.course.progress[run.unitId] = { done: true, score: null, nclc: nclcOf(k, scores[k]) }; this.saveCourse(); }
    this.saveProfile(); this.saveRun(run);
    S.reportRun = run; S.run = null; S.view = 'report'; this.emit(); window.scrollTo(0, 0);
  }
  autoMark(run: Run, k: string) {
    const items: any[] = []; const per: Record<string, { c: number; t: number }> = {}; const ans = run.answers[k] || {};
    for (let i = 0; i < 4; i++) {
      const part = run.content[k] && run.content[k][i]; if (!part) continue;
      part.docs.forEach((d: any) => d.questions.forEach((q: any) => {
        const given = ans[q.n] || ''; const ok = !!given && given.toUpperCase() === q.answer;
        items.push({ n: q.n, type: part.type, prompt: q.prompt, choices: q.choices, given, correct: q.answer, ok, evidence: q.evidence, explain: q.explain });
        const tp = per[part.type] || (per[part.type] = { c: 0, t: 0 }); tp.t++; if (ok) tp.c++;
      }));
    }
    items.sort((a, b) => a.n - b.n);
    const raw = items.filter((i) => i.ok).length, total = items.length;
    return { raw, total, score: rawToScore(raw, total), per, items };
  }

  /* ---------- marking EE / EO ---------- */
  async markWriting(run: Run) {
    const a = run.answers.W;
    await this.saveRunNow(run);
    const r = await this.ai('markW', { attemptId: run.id }); const sc = Number(r.score); if (!isFinite(sc)) throw { code: 'invalid_json' };
    return { score: Math.max(0, Math.min(699, Math.round(sc))), A: r.A || {}, B: r.B || {}, criteria: toArr(r.criteria), errors: toArr(r.errors), patterns: toArr(r.patterns), model: r.model || null, next: toArr(r.next), wc: { A: words(a.A), B: words(a.B) } };
  }
  async markSpeaking(run: Run) {
    const A = run.answers.S;
    await this.saveRunNow(run);
    const r = await this.ai('markS', { attemptId: run.id }); const sc = Number(r.score); if (!isFinite(sc)) throw { code: 'invalid_json' };
    return { score: Math.max(0, Math.min(699, Math.round(sc))), summary: r.summary || '', criteria: toArr(r.criteria), errors: toArr(r.errors), patterns: toArr(r.patterns), model: r.model || null, next: toArr(r.next), missed: toArr(r.missed_questions), turns: { A: A.A.filter((m: any) => m.role === 'me').length, B: A.B.filter((m: any) => m.role === 'me').length } };
  }

  /* ---------- speech (French device voices) ---------- */
  frVoices() { if (!this.tts) return []; return speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang)).sort((a, b) => voiceRank(b) - voiceRank(a)); }
  pickVoices(speakers: { name: string; gender?: string; accent?: string }[]) { return pickVoices(this.frVoices(), speakers, FEM, MAL, { accents: true }); }
  speak(lines: SpeakLine[], vm: VoiceMap, onProgress?: (p: number) => void, onDone?: () => void, shared?: number) {
    const tok = shared != null ? shared : ++this.speakToken;
    speakLines(lines, vm, { lang: 'fr-FR', rate: 1, ends: SENT_FR, token: tok, current: () => this.speakToken, onProgress, onDone });
  }
  exVoice = () => this.pickVoices([{ name: 'ex', gender: 'female' }]).ex;
  sayEx(text: string, role?: string) {
    if (this.ent().tts) { const tok = this.speakToken; sayStudio('tef', text, { role }, () => tok !== this.speakToken).then((ok) => { if (!ok && tok === this.speakToken && this.tts) this.speak([{ speaker: 'ex', text }], { ex: this.exVoice() }); }); return; }
    if (this.tts) this.speak([{ speaker: 'ex', text }], { ex: this.exVoice() });
  }

  /* ---------- listening flow ---------- */
  curDoc(run: Run) { const pos = run.state.L.pos; const part = run.content.L && run.content.L[pos.p]; if (!part) return { part: null, doc: null }; return { part, doc: part.docs[pos.d] }; }
  nextDoc() {
    const S = this.S; const run = S.run!; const pos = run.state.L.pos; const part = run.content.L[pos.p]; this.stopSpeech();
    if (part && pos.d + 1 < part.docs.length) pos.d++; else { pos.p++; pos.d = 0; }
    S.lmeter = 0; S.lstatus = 'Une seule écoute'; S.readOnceText = null;
    this.saveRun(run);
    if (pos.p >= 4) { this.submitSection('L', false); return; }
    this.emit(); window.scrollTo(0, 0);
  }
  playDoc() {
    const S = this.S; const run = S.run!; const pos = run.state.L.pos; const key = pos.p + '_' + pos.d; const { doc } = this.curDoc(run); if (!doc || run.state.L.played[key]) return;
    run.state.L.played[key] = 'playing'; S.lmeter = 0; this.emit();
    if (this.ent().tts) { this.playDocNatural(run, pos.p, pos.d, key, doc); return; }
    this.saveRun(run);
    const vm = this.pickVoices(doc.speakers.length ? doc.speakers : [{ name: 'Voix', gender: 'female' }]);
    this.speak(doc.script, vm, (p) => { S.lmeter = Math.round(p * 100); this.emit(); }, () => { run.state.L.played[key] = 'done'; S.lmeter = 100; this.saveRun(run); this.emit(); });
  }
  readOnce() {
    const S = this.S; const run = S.run!; const pos = run.state.L.pos; const key = pos.p + '_' + pos.d; const { doc } = this.curDoc(run); if (!doc || run.state.L.played[key]) return;
    run.state.L.played[key] = 'done'; this.saveRun(run);
    S.readOnceText = doc.script; this.emit();
    const ms = Math.max(15000, words(doc.script.map((l: SpeakLine) => l.text).join(' ')) / 2.6 * 1000);
    setTimeout(() => { S.readOnceText = null; this.emit(); }, ms);
  }
  async playDocNatural(run: Run, p: number, d: number, key: string, doc: any) {
    const S = this.S; const tok = ++this.speakToken;
    const status = (x: string) => { S.lstatus = x; this.emit(); };
    const done = () => { run.state.L.played[key] = 'done'; S.lmeter = 100; this.saveRun(run); this.emit(); };
    const fallback = () => { const vm = this.pickVoices(doc.speakers.length ? doc.speakers : [{ name: 'Voix', gender: 'female' }]); this.speak(doc.script, vm, (x) => { S.lmeter = Math.round(x * 100); this.emit(); }, done, tok); };
    status('Chargement de l’enregistrement…');
    let plan: { chunks: { kind: string }[] };
    try { await this.saveRunNow(run); plan = await api('POST', '/api/tts/plan', { exam: 'tef', attemptId: run.id, part: p, doc: d }); }
    catch { if (tok === this.speakToken) { status('Voix de studio indisponibles : voix de l’appareil.'); fallback(); } return; }
    if (tok !== this.speakToken) return;
    const q = audioSeries('/api/tts/chunk?exam=tef&attemptId=' + encodeURIComponent(run.id) + '&part=' + p + '&doc=' + d, plan.chunks.length);
    for (let n = 0; n < Math.min(3, plan.chunks.length); n++) q.prefetch(n);
    status('Écoute en cours');
    for (let n = 0; n < plan.chunks.length; n++) {
      if (tok !== this.speakToken) return;
      if (n + 2 < plan.chunks.length) q.prefetch(n + 2);
      const ok = await q.play(n, () => tok !== this.speakToken);
      if (!ok && tok === this.speakToken) { q.dispose(); fallback(); return; }
      S.lmeter = Math.round((n + 1) / plan.chunks.length * 100); this.emit();
    }
    q.dispose(); if (tok === this.speakToken) done();
  }

  /* ---------- speaking flow ---------- */
  beginSpeak(sec: 'A' | 'B') {
    const run = this.S.run!; const st = run.state.S; const c = run.content.S[0];
    st.phase = sec; st.deadline = Date.now() + (sec === 'A' ? 5 : 10) * 60000;
    const opening = sec === 'A' ? c.A.opening : c.B.opening;
    if (!run.answers.S[sec].length) run.answers.S[sec].push({ role: 'ex', text: String(opening || 'Bonjour !') });
    this.saveRun(run); this.emit(); this.sayEx(run.answers.S[sec][run.answers.S[sec].length - 1].text, sec === 'B' ? 'friend' : 'staff');
  }
  async sendSpeak() {
    const S = this.S; const run = S.run!; const st = run.state.S; const sec = st.phase; if (sec !== 'A' && sec !== 'B') return;
    const txt = (S.draft || '').trim(); if (!txt || S.exBusy) return;
    run.answers.S[sec].push({ role: 'me', text: txt }); S.draft = ''; S.exBusy = true; this.emit();
    try {
      await this.saveRunNow(run);
      const reply = String((await this.ai('examiner', { attemptId: run.id, sec })).text || '').trim();
      if (S.run !== run || st.phase !== sec) { S.exBusy = false; return; }
      run.answers.S[sec].push({ role: 'ex', text: reply }); this.sayEx(reply, sec === 'B' ? 'friend' : 'staff');
    } catch (e) { this.toast(this.errCopy(e)); }
    S.exBusy = false; this.saveRun(run); this.emit(); stopDictation();
  }
  repeat() { const run = this.S.run!; const log = run.answers.S[run.state.S.phase] || []; const last = [...log].reverse().find((m: any) => m.role === 'ex'); if (last) this.sayEx(last.text); }

  /* ---------- answers ---------- */
  setAnswer(k: string, n: number | string, v: string) { this.S.run!.answers[k][n] = v; this.scheduleSave(); this.emit(); }
  setWriting(which: 'A' | 'B', v: string) { this.S.run!.answers.W[which] = v; this.scheduleSave(); this.emit(); }
  setDraft(v: string) { this.S.draft = v; this.emit(); }
  mic() { toggleDictation(() => this.S.draft || '', 'fr-FR', (v) => this.setDraft(v), () => this.toast('Le micro est bloqué. Autorisez-le dans les réglages du navigateur.')); }
  micTask() { toggleDictation(() => this.S.taskAns || '', 'fr-FR', (v) => { this.S.taskAns = v; this.emit(); }, () => this.toast('Le micro est bloqué. Autorisez-le dans les réglages du navigateur.')); }

  /* ---------- course ---------- */
  async buildCourse() {
    const S = this.S; S.view = 'course'; S.courseBusy = true; S.courseErr = null; this.emit();
    try {
      const r = await this.ai('course', {}); if (!r || !Array.isArray(r.phases)) throw { code: 'invalid_json' };
      r.phases.forEach((ph: any) => { ph.units = toArr<any>(ph.units).map((u, i) => ({ id: String(u.id || ('u' + i)), skill: ORDER.includes(u.skill) ? u.skill : 'W', title: String(u.title || ''), goal: String(u.goal || ''), checkpoint: !!u.checkpoint })); });
      S.course = { title: String(r.title || 'Votre parcours'), summary: String(r.summary || ''), phases: r.phases, createdAt: Date.now(), progress: carryProgress(S.course, r.phases), version: uid() }; this.saveCourse();
    } catch (e) { S.courseErr = this.errCopy(e); }
    S.courseBusy = false; this.emit();
  }
  allUnits(): any[] { return this.S.course ? this.S.course.phases.flatMap((p: any) => p.units) : []; }
  async openUnit(id: string) {
    const S = this.S; const u = this.allUnits().find((x) => x.id === id); if (!u) return;
    S.view = 'lesson'; S.lessonUnit = u; S.lesson = null; S.lessonErr = null; S.quizChecked = false; S.taskFb = null; S.taskAns = ''; this.emit(); window.scrollTo(0, 0);
    if (u.checkpoint) return;
    const key = lessonKeyOf(S.course, u); let l = null; try { l = await this.getLesson(key); } catch { /* ignore */ }
    if (l) { S.lesson = l; this.emit(); return; }
    await this.genLesson(u, key);
  }
  async genLesson(u: any, key: string) {
    const S = this.S; S.lessonBusy = true; this.emit();
    try { const r = await this.ai('lesson', { unitId: u.id }); if (!r || !Array.isArray(r.quiz)) throw { code: 'invalid_json' }; S.lesson = r; await this.setLesson(key, r).catch(() => {}); }
    catch (e) { S.lessonErr = this.errCopy(e); }
    S.lessonBusy = false; this.emit();
  }
  relesson() { const u = this.S.lessonUnit; this.genLesson(u, lessonKeyOf(this.S.course, u)); }
  setQuizAnswer(i: number, v: string) { this.S.lesson.quiz[i]._given = v; this.emit(); }
  checkQuiz() {
    const S = this.S; const l = S.lesson; let c = 0;
    l.quiz.forEach((q: any) => {
      const v = q._given || '';
      q._ok = q.type === 'mcq' ? String(q.answer).trim().toUpperCase().charAt(0) === String(v).toUpperCase() : toArr<string>(q.answer).some((a) => norm(a) === norm(v));
      if (q._ok) c++;
    });
    const pct = Math.round(100 * c / l.quiz.length); S.quizChecked = true; S.quizScore = pct;
    const u = S.lessonUnit; S.course.progress = S.course.progress || {}; const prev = S.course.progress[u.id];
    S.course.progress[u.id] = { done: pct >= 70 || !!(prev && prev.done), score: Math.max(pct, (prev && prev.score) || 0) };
    this.saveCourse(); this.emit();
  }
  async taskFeedback() {
    const S = this.S; const txt = S.taskAns || '';
    if (words(txt) < 20) { this.toast('Écrivez au moins 20 mots.'); return; }
    S.taskBusy = true; S.taskFb = null; this.emit();
    try { S.taskFb = await this.ai('taskfb', { unitId: S.lessonUnit.id, answer: txt }); }
    catch (e) { S.taskFb = { err: this.errCopy(e) }; }
    S.taskBusy = false; this.emit();
  }

  /* ---------- actions from the views ---------- */
  nav(v: string) {
    const S = this.S; if (S.run && ['intro', 'section', 'marking'].includes(S.view)) return;
    S.view = v; if (v === 'tests') this.loadUsage(); S.confirmReset = false; this.emit(); window.scrollTo(0, 0);
  }
  loadUsage() { api('GET', '/api/usage/tef').then((u) => { this.S.usage = u; this.emit(); }).catch(() => {}); }
  async openReport(id: string) {
    const S = this.S; S.view = 'report'; S.reportRun = null; this.emit();
    try { S.reportRun = await this.getAttempt(id); } catch { /* ignore */ }
    if (!S.reportRun) this.toast('Ce résultat n’a pas pu être chargé.');
    this.emit(); window.scrollTo(0, 0);
  }
  setTab(i: number) { if (this.S.view !== 'section') return; this.S.tab = i; this.saveRun(this.S.run); this.emit(); window.scrollTo(0, 0); }
  reportOpen(k: string, i: number) { this.S.reports[k + i] = 'open'; this.emit(); }
  async reportSend(k: string, i: number, reason: string) {
    this.S.reports[k + i] = 'sent'; this.emit();
    try { await this.saveRunNow(this.S.run!); await api('POST', '/api/pool/report', { exam: 'tef', attemptId: this.S.run!.id, k, i, reason }); } catch { /* ignore */ }
  }
  placement() { return this.startRun(this.newRun('placement', ORDER.slice(), 'exam', 'Test de positionnement')); }
  mock() { const m = this.S.mock; const secs = m.type === 'full' ? ORDER.slice() : [m.type]; return this.startRun(this.newRun('mock', secs, m.diff, (m.type === 'full' ? 'Test blanc complet' : 'Test blanc · ' + SK[m.type]) + ' · ' + (m.diff === 'auto' ? 'auto' : DIFF[m.diff].label))); }
  checkpoint() { const u = this.S.lessonUnit; return this.startRun(this.newRun('mock', [u.skill], 'auto', 'Test d’étape · ' + u.title, u.id)); }
  setMock(p: Partial<{ type: string; diff: string }>) { Object.assign(this.S.mock, p); this.emit(); }
  confirm(k: 'confirmDiscard' | 'confirmReset' | 'confirmSubmit' | 'confirmNext', v: boolean) { this.S[k] = v; this.emit(); if ((k === 'confirmSubmit' || k === 'confirmNext') && v) window.scrollTo(0, 0); }
  async discard() {
    const S = this.S; const id = S.profile.activeAttemptId; S.profile.activeAttemptId = null; S.confirmDiscard = false; this.saveProfile();
    try { const r = id ? await this.getAttempt(id) : null; if (r) { r.status = 'discarded'; await this.saveAttempt(r); } } catch { /* ignore */ }
    S.run = null; this.emit();
  }
  regen() { const S = this.S; for (const k in S.gen) { const g = S.gen[k]; if (g && typeof g === 'object' && g.err) delete S.gen[k]; } this.emit(); this.generateAll(S.run!); }
  leave() { this.saveRun(this.S.run); this.stopTimer(); this.stopSpeech(); this.S.run = null; this.S.view = 'home'; this.emit(); }
  submit() { this.S.confirmSubmit = false; this.submitSection(this.S.sec, false); }
  remark() { this.markProduction(this.S.sec); }
  saveSettings(v: { target: number; examDate: string; studyTime: string; about: string }) {
    const p = this.S.profile; p.examDate = v.examDate || ''; if (Number(v.target)) p.target = Number(v.target); p.studyTime = v.studyTime || p.studyTime; p.about = (v.about || '').slice(0, 280);
    const first = !p.setupDone; p.setupDone = true; this.saveProfile();
    this.toast(first ? 'Enregistré. Commencez par le test de positionnement.' : 'Réglages enregistrés.'); this.emit();
  }
  async resetAll() {
    try { await api('DELETE', '/api/docs/tef'); } catch (e) { this.handleError(e); return; }
    this.S.profile = DEFAULT_PROFILE(); this.S.course = null; this.S.confirmReset = false; this.toast('Progression TEF effacée.'); this.emit();
  }
  async resume() {
    const S = this.S; const id = S.profile.activeAttemptId; if (!id) return;
    let run: Run | null = null; try { run = await this.getAttempt(id); } catch { /* ignore */ }
    if (!run) { this.toast('Ce test n’a pas pu être chargé.'); S.profile.activeAttemptId = null; this.saveProfile(); this.emit(); return; }
    run.content = run.content || {}; run.state = run.state || {}; run.results = run.results || {};
    S.run = run; S.gen = {}; const k = this.nextSection(run);
    if (k && run.state[k] && run.state[k].submitted) { this.markProduction(k); return; }
    if (k && run.state[k] && run.state[k].deadline && Date.now() >= run.state[k].deadline && !(k === 'W' && run.state.W.phase === 'A') && !(k === 'S' && run.state.S.phase === 'A')) { S.sec = k; this.submitSection(k, true); return; }
    S.view = 'intro'; this.emit(); this.generateAll(run);
  }

  /* ---------- boot ---------- */
  async boot() {
    const S = this.S; this.emit();
    try { const p = await this.get('profile'); if (p) S.profile = Object.assign(DEFAULT_PROFILE(), p); } catch (e) { this.handleError(e); }
    try { const c = await this.get('course'); if (c && Array.isArray(c.phases)) S.course = c; } catch { /* ignore */ }
    S.ready = true; this.emit();
  }
  mount() { this.active = true; if (!this.S.ready && !this.S.booting) { this.S.booting = true; this.boot(); } else this.emit(); }
  unmount() { this.active = false; this.stopSpeech(); stopDictation(); }
  firstName() { return ((bridge.me() && bridge.me()!.name) || '').split(' ')[0] || ''; }
}
