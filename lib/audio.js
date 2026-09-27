// Studio-voice cache. Every chunk of speech is stored once, keyed by a hash of exactly what was
// spoken (model, voices, style, text), and served to every later listener. Pooled tests share
// scripts, so the second person to take a test hears it with no new AI cost.
// Audio is stored as MP3 (about 10x smaller than the WAV Gemini returns).
import { Mp3Encoder } from '@breezystack/lamejs';
import { q, one } from './db.js';
import { sha256 } from './util.js';
import { tts, ttsModel } from './gemini.js';
import { logUsage } from './cost.js';

const MAX_MB = () => Number(process.env.AUDIO_CACHE_MAX_MB || 400);
const inflight = new Map();

export function wavInfo(buf) {
  // Walk RIFF chunks to find the format and data blocks.
  let rate = 24000; let off = 12; let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4); const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(off + 12);
    if (id === 'data') { data = buf.subarray(off + 8, Math.min(buf.length, off + 8 + size)); break; }
    off += 8 + size + (size % 2);
  }
  if (!data) data = buf.subarray(44);
  return { rate, pcm: data };
}
export function wavToMp3(wav, kbps = 40) {
  const { rate, pcm } = wavInfo(wav);
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const enc = new Mp3Encoder(1, rate, kbps);
  const out = [];
  for (let i = 0; i < samples.length; i += 1152) { const b = enc.encodeBuffer(samples.subarray(i, i + 1152)); if (b.length) out.push(Buffer.from(b)); }
  const end = enc.flush(); if (end.length) out.push(Buffer.from(end));
  return { mp3: Buffer.concat(out), seconds: samples.length / rate };
}

export function audioKey(lines, voices, style) {
  const used = {}; lines.forEach((l) => { used[l.speaker] = voices[l.speaker] || null; });
  return sha256(JSON.stringify({ m: ttsModel(), lines: lines.map((l) => [l.speaker, l.text]), v: used, s: style || '' }));
}

async function prune() {
  const r = await one('select coalesce(sum(size),0)::bigint as total from audio_cache');
  const limit = MAX_MB() * 1024 * 1024;
  if (Number(r.total) <= limit) return;
  // Drop the least useful audio first: rarely played and not played recently.
  await q(`delete from audio_cache where key in (select key from audio_cache order by hits asc, last_hit asc limit 200)`);
}

// Returns { key, mime, bytes, cached }
export async function cachedSpeech(lines, voices, style, meta = {}) {
  const key = audioKey(lines, voices, style);
  const hit = await one('update audio_cache set hits=hits+1, last_hit=now() where key=$1 returning mime, bytes', [key]);
  if (hit) {
    logUsage({ ...meta, task: 'tts', model: ttsModel(), cached: true });
    return { key, mime: hit.mime, bytes: Buffer.from(hit.bytes), cached: true };
  }
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const wav = await tts(lines, voices, style);
    const { mp3, seconds } = wavToMp3(wav);
    logUsage({ ...meta, task: 'tts', model: ttsModel(), inTok: lines.reduce((a, l) => a + l.text.length / 4, 0), audioSec: seconds });
    await q('insert into audio_cache(key, mime, bytes, size) values($1,$2,$3,$4) on conflict(key) do nothing', [key, 'audio/mpeg', mp3, mp3.length]);
    if (Math.random() < 0.05) prune().catch(() => {});
    return { key, mime: 'audio/mpeg', bytes: mp3, cached: false };
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function audioStats() {
  return one('select count(*)::int as items, coalesce(sum(size),0)::bigint as bytes, coalesce(sum(hits),0)::bigint as hits from audio_cache');
}
