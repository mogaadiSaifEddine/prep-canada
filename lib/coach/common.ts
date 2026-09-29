// Shared pieces of the IELTS and TEF coaches: a tiny observable store, saving in order,
// timers, text helpers and device-voice selection.
import { getDoc, putDoc } from '../client/api';
import { bridge } from '../client/bridge';
import { stopAudio } from '../client/audio';
import { hasTTS } from '../client/audio';
import type { Exam } from '../shared/types';

export const toArr = <T = any>(a: T | T[] | null | undefined | ''): T[] => (Array.isArray(a) ? a : a == null || a === '' ? [] : [a]);
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export const words = (s: unknown) => (String(s || '').trim().match(/\S+/g) || []).length;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);
export function stripLetter(c: unknown, L: string) { return String(c).replace(new RegExp('^\\(?' + L + '[\\).:\\s-]+'), '').trim(); }
export function fmtTime(ms: number) { ms = Math.max(0, ms); const s = Math.round(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

/** A generated test in progress (IELTS or TEF). AI content is free-form JSON. */
export type Run = {
  id: string; kind: string; sections: string[]; diff: string; label: string; unitId: string | null;
  startedAt: number; date: string; finishedAt?: number;
  content: Record<string, Record<number, any>>; answers: any; state: any; results: Record<string, any>;
  status: string; overall?: number | null; nclc?: number | null;
};
export type GenState = 'busy' | 'ok' | { err: string };

/**
 * Base class: subscription for React (useSyncExternalStore), document storage for one exam,
 * and saves that run one after another per document.
 */
export abstract class CoachBase {
  readonly exam: Exam;
  private version = 0;
  private subs = new Set<() => void>();
  private chains: Record<string, Promise<unknown>> = {};
  active = false;
  speakToken = 0;
  protected saveT: ReturnType<typeof setTimeout> | undefined;
  protected timer: ReturnType<typeof setInterval> | null = null;

  constructor(exam: Exam) {
    this.exam = exam;
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.saveCurrent());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.saveCurrent(); });
    }
  }
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getVersion = () => this.version;
  /** Tell React the state changed (the old app's render()). */
  emit() { this.version++; this.subs.forEach((f) => f()); }

  protected abstract saveCurrent(): void;

  get = (key: string) => getDoc(this.exam, key);
  set = (key: string, val: unknown) => putDoc(this.exam, key, val);
  getAttempt = (id: string) => getDoc<Run>(this.exam, 'attempt_' + id);
  saveAttempt = (a: Run) => putDoc(this.exam, 'attempt_' + a.id, a);
  getLesson = (id: string) => getDoc(this.exam, 'lesson_' + id);
  setLesson = (id: string, v: unknown) => putDoc(this.exam, 'lesson_' + id, v);

  serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const p = (this.chains[key] || Promise.resolve()).then(fn, fn);
    this.chains[key] = p.catch(() => {});
    return p;
  }
  saveRun(run: Run | null | undefined) { if (!run) return; return this.serial('a' + run.id, () => this.saveAttempt(run).catch(() => {})); }
  saveRunNow(run: Run) { return this.serial('a' + run.id, () => this.saveAttempt(run)); }

  toast = (m: string) => bridge.toast(m);
  errCopy = (e: unknown) => bridge.errCopy(e);
  handleError = (e: unknown) => bridge.handleError(e);
  ent = () => bridge.ent(this.exam);
  get tts() { return hasTTS(); }

  stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  stopSpeech() { this.speakToken++; stopAudio(); if (hasTTS()) { try { speechSynthesis.cancel(); } catch { /* ignore */ } } }
  waitFor(ms: number, tok: number, onTick?: (left: number) => void) {
    return new Promise<boolean>((res) => {
      const end = Date.now() + ms;
      const iv = setInterval(() => { if (tok !== this.speakToken) { clearInterval(iv); res(false); return; } const left = end - Date.now(); onTick && onTick(left); if (left <= 0) { clearInterval(iv); res(true); } }, 250);
    });
  }
}

/* ---------- course rebuilds ---------- */
const unitKey = (u: any) => u.skill + '|' + String(u.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Saved-lesson id of a unit: kept from an earlier course, or this course's own. */
export const lessonKeyOf = (course: any, u: any): string => u.lessonKey || course.version + '_' + u.id;
/**
 * When a course is rebuilt, units with the same skill and title keep their progress and saved
 * lesson (sets lessonKey on them). Checkpoints always start fresh. Returns the new progress.
 */
export function carryProgress(old: any, phases: any[]): Record<string, any> {
  const progress: Record<string, any> = {};
  if (!old || !Array.isArray(old.phases)) return progress;
  const prev = new Map<string, { p: any; lessonKey: string }>();
  for (const u of old.phases.flatMap((ph: any) => toArr<any>(ph.units))) {
    if (!u.checkpoint) prev.set(unitKey(u), { p: old.progress && old.progress[u.id], lessonKey: lessonKeyOf(old, u) });
  }
  for (const u of phases.flatMap((ph: any) => ph.units)) {
    const hit = !u.checkpoint && prev.get(unitKey(u));
    if (!hit) continue;
    u.lessonKey = hit.lessonKey;
    if (hit.p) progress[u.id] = hit.p;
  }
  return progress;
}

/* ---------- device voices ---------- */
type SpeakerSpec = { name: string; gender?: string; accent?: string };
export function pickVoices(voices: SpeechSynthesisVoice[], speakers: SpeakerSpec[], FEM: RegExp, MAL: RegExp, o: { maleGuard?: boolean; accents?: boolean } = {}) {
  const map: Record<string, SpeechSynthesisVoice> = {}; if (!voices.length) return map;
  const used = new Set<string>();
  speakers.forEach((sp, i) => {
    const g = String(sp.gender || '').toLowerCase();
    const want = g.startsWith('f') ? FEM : g.startsWith('m') ? MAL : null;
    let v: SpeechSynthesisVoice | undefined;
    if (o.accents) {
      const acc = String(sp.accent || '').toLowerCase();
      v = voices.find((x) => !used.has(x.name) && !!want && want.test(x.name) && (!acc || x.lang.toLowerCase().replace('_', '-') === acc)) || voices.find((x) => !used.has(x.name) && !!want && want.test(x.name));
    } else v = voices.find((x) => !used.has(x.name) && !!want && want.test(x.name) && !(o.maleGuard && want === FEM && /\bmale\b/i.test(x.name) && !/female/i.test(x.name)));
    if (!v) v = voices.find((x) => !used.has(x.name)) || voices[i % voices.length];
    used.add(v.name); map[sp.name] = v;
  });
  return map;
}
