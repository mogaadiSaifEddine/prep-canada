// AI cost tracking: every Gemini call (and every cache hit) is logged with an estimated USD cost,
// so the admin page can show real spend, cache hit rates and cost per paying user.
import { q } from './db';

// USD per 1M tokens. Override with AI_PRICES_JSON when Google changes prices
// (3.8 Flash and 3.8 TTS double on 1 January 2027).
type ModelPrice = { in?: number; out?: number; audio?: number };
const DEFAULT_PRICES: Record<string, ModelPrice> = {
  'gemini-3.8-flash': { in: 0.75, out: 3.75 },
  'gemini-3.5-flash-lite': { in: 0.30, out: 2.50 },
  'gemini-3.8-flash-tts': { in: 0.50, audio: 9.00 },
  'gemini-3.8-flash-lite-tts': { in: 0.50, audio: 6.00 }
};
const AUDIO_TOKENS_PER_SEC = 32;

function prices(): Record<string, ModelPrice> {
  try { return Object.assign({}, DEFAULT_PRICES, JSON.parse(process.env.AI_PRICES_JSON || '{}')); }
  catch { return DEFAULT_PRICES; }
}
export type UsageRecord = { userId?: string | null; exam?: string | null; task?: string; model?: string; inTok?: number; outTok?: number; audioSec?: number; cached?: boolean };
export function estimateUSD(model: string | undefined, { inTok = 0, outTok = 0, audioSec = 0 }: UsageRecord = {}) {
  const p = prices()[model || ''] || { in: 1, out: 5, audio: 10 };
  return (inTok * (p.in || 0) + outTok * (p.out || 0) + audioSec * AUDIO_TOKENS_PER_SEC * (p.audio || 0)) / 1e6;
}
export function logUsage(r: UsageRecord) {
  const cost = r.cached ? 0 : estimateUSD(r.model, r);
  // Fire and forget: logging must never break a user request.
  q(`insert into ai_usage(user_id, exam, task, model, in_tok, out_tok, audio_sec, cost_usd, cached) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [r.userId || null, r.exam || null, r.task || '', r.model || '', Math.round(r.inTok || 0), Math.round(r.outTok || 0), r.audioSec || 0, cost, !!r.cached])
    .catch((e) => console.error('usage log failed', e.message));
  return cost;
}
