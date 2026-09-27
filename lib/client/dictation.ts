// Dictation (speech to text) with the browser's SpeechRecognition. One session at a time.
// Components show the mic state through useDictation().
import { useSyncExternalStore } from 'react';

type Rec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((ev: any) => void) | null; onend: (() => void) | null; onerror: ((ev: any) => void) | null };
const SR = (): (new () => Rec) | null => (typeof window === 'undefined' ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null));
export const canDictate = () => !!SR();

let rec: Rec | null = null; let recOn = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function useDictation() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => recOn, () => false);
}

export function stopDictation() { recOn = false; if (rec) { try { rec.stop(); } catch { /* ignore */ } } rec = null; emit(); }

/**
 * Start (or stop, if running) dictation into a text field. `current()` gives the text already there;
 * `onChange` receives the whole new value as the person speaks.
 */
export function toggleDictation(current: () => string, lang: string, onChange: (v: string) => void, onBlocked: () => void) {
  if (recOn) { stopDictation(); return; }
  const C = SR(); if (!C) return;
  const prev = current();
  const base = prev ? prev.replace(/\s*$/, ' ') : '';
  let finalText = '';
  rec = new C(); rec.lang = lang; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) finalText += r[0].transcript.trim() + ' '; else interim += r[0].transcript; }
    onChange((base + finalText + interim).replace(/[ \t]+/g, ' '));
  };
  rec.onend = () => { if (recOn && rec) { try { rec.start(); } catch { recOn = false; emit(); } } };
  rec.onerror = (ev) => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture') { recOn = false; onBlocked(); emit(); } };
  recOn = true;
  try { rec.start(); } catch { recOn = false; }
  emit();
}
