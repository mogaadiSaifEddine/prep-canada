// Studio voices (paid plans): MP3 clips from /api/tts, played one at a time through a single <audio>.
import { HEADERS } from './api';

let AUDIO: HTMLAudioElement | null = null;
const el = () => { if (!AUDIO) { AUDIO = new Audio(); AUDIO.preload = 'auto'; } return AUDIO; };
let playResolve: ((ok: boolean) => void) | null = null;

export function stopAudio() {
  try { AUDIO?.pause(); } catch { /* ignore */ }
  if (playResolve) { const r = playResolve; playResolve = null; r(true); }
}
export function playUrl(url: string): Promise<boolean> {
  return new Promise((res) => {
    stopAudio();
    playResolve = res;
    const a = el();
    const done = (ok: boolean) => { if (playResolve === res) { playResolve = null; res(ok); } };
    a.onended = () => done(true);
    a.onerror = () => done(false);
    a.src = url;
    a.play().catch(() => done(false));
  });
}

export type AudioSeries = { prefetch(i: number | undefined): void; play(i: number | undefined, cancelled?: () => boolean): Promise<boolean>; dispose(): void };
/** A numbered series of clips (base + '&c=' + i), fetched two at a time ahead of playback. */
export function audioSeries(base: string, n: number): AudioSeries {
  const cache: Record<number, Promise<string | null>> = {}; const urls: string[] = []; let active = 0; const waiting: (() => void)[] = [];
  const run = (fn: () => Promise<string | null>) => new Promise<string | null>((res) => {
    const go = () => { active++; fn().then(res, () => res(null)).finally(() => { active--; const nx = waiting.shift(); if (nx) nx(); }); };
    if (active < 2) go(); else waiting.push(go);
  });
  const fetchOne = (i: number) => cache[i] || (cache[i] = run(() => fetch(base + '&c=' + i, { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => { if (!b) return null; const u = URL.createObjectURL(b); urls.push(u); return u; })));
  return {
    prefetch(i) { if (i != null && i >= 0 && i < n) fetchOne(i); },
    async play(i, cancelled) { if (i == null || i < 0 || i >= n) return true; const u = await fetchOne(i); if (cancelled && cancelled()) return true; if (!u) return false; return playUrl(u); },
    dispose() { setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 1000); }
  };
}

const sayCache = new Map<string, string>();
/** Speak one line with the exam's studio voice. Resolves false when the clip could not be played. */
export async function say(exam: string, text: string, opts: { role?: string } = {}, cancelled?: () => boolean): Promise<boolean> {
  const key = exam + '|' + (opts.role || '') + '|' + text;
  let url = sayCache.get(key);
  if (!url) {
    try {
      const r = await fetch('/api/tts/say', { method: 'POST', credentials: 'same-origin', headers: HEADERS, body: JSON.stringify({ exam, text, role: opts.role }) });
      if (!r.ok) return false;
      url = URL.createObjectURL(await r.blob());
      if (sayCache.size > 60) { const first = sayCache.keys().next().value as string; URL.revokeObjectURL(sayCache.get(first)!); sayCache.delete(first); }
      sayCache.set(key, url);
    } catch { return false; }
  }
  if (cancelled && cancelled()) return true;
  return playUrl(url);
}

/* ---------- device voices (speechSynthesis), used on the free plan and as a fallback ---------- */
export type SpeakLine = { speaker: string; text: string };
export type VoiceMap = Record<string, SpeechSynthesisVoice | undefined>;
export const hasTTS = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
export function warmVoices() { if (hasTTS()) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch { /* ignore */ } } }

/** Split long text at sentence ends so every utterance stays short (some engines stop after ~15 s). */
export function chunks(text: string, ends = /[^.!?]+[.!?]*\s*/g) {
  const parts = String(text).match(ends) || [text]; const out: string[] = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 200 && cur) { out.push(cur); cur = p; } else cur += p; }
  if (cur.trim()) out.push(cur);
  return out;
}

/**
 * Read lines aloud with device voices. `token` is compared with `current()` before each utterance,
 * so a newer playback (or a stop) cancels this one.
 */
export function speakLines(lines: SpeakLine[], voiceMap: VoiceMap, o: { lang: string; rate: number; ends?: RegExp; token: number; current: () => number; onProgress?: (p: number) => void; onDone?: () => void }) {
  const queue: { li: number; text: string; speaker: string }[] = [];
  lines.forEach((l, li) => chunks(l.text, o.ends).forEach((c) => queue.push({ li, text: c, speaker: l.speaker })));
  let i = 0;
  const next = () => {
    if (o.token !== o.current()) return;
    if (i >= queue.length) { o.onDone && o.onDone(); return; }
    const item = queue[i++];
    const u = new SpeechSynthesisUtterance(item.text);
    const v = voiceMap[item.speaker]; if (v) { u.voice = v; u.lang = v.lang; } else u.lang = o.lang;
    u.rate = o.rate;
    u.onend = () => { o.onProgress && o.onProgress(i / queue.length); setTimeout(next, queue[i] && queue[i].li !== item.li ? 350 : 60); };
    u.onerror = u.onend as any;
    (window as any).__utt = u; // keep a reference: some browsers drop utterances that get garbage-collected
    speechSynthesis.speak(u);
  };
  next();
}
