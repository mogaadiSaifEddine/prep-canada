// Text AI through OpenRouter (server side only; the key never reaches the browser).
// Each tier is a list of models, tried in order: free models are often rate-limited or
// withdrawn, so a 429, 404 or 5xx moves on to the next one.
import { err } from './util';
import { mockJSON, mockText } from './mock';
import { logUsage } from './cost';

type Reply = { status: number; json: any; text: string };
type Meta = { userId?: string; exam?: string };
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MAIN = 'nvidia/nemotron-3-super-120b-a12b:free,qwen/qwen3.8-27b:free,nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free,openrouter/free';
const DEFAULT_FAST = 'nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-26b-a4b-it:free,google/gemma-4-31b-it:free,qwen/qwen3.8-27b:free,openrouter/free';
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const models = (fast?: boolean) => list(fast ? process.env.AI_MODEL_FAST || DEFAULT_FAST : process.env.AI_MODEL || DEFAULT_MAIN);
// Free models think slowly: with reasoning on, a Reading section takes over 2 minutes. Off unless AI_REASONING=1.
const reasoningOn = () => process.env.AI_REASONING === '1';
export const isMock = () => process.env.AI_MOCK === '1' || process.env.GEMINI_MOCK === '1';
export const textModel = (fast?: boolean) => models(fast)[0];

function key() {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw err(500, 'config', 'OPENROUTER_API_KEY is not set on the server.');
  return k;
}

export async function postJSON(url: string, headers: Record<string, string>, body: unknown, ms = 110000): Promise<Reply> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { status: r.status, json, text };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw err(504, 'ai_timeout', 'The AI took too long to answer. Try again.');
    throw err(502, 'ai_error', 'Could not reach the AI service.');
  } finally { clearTimeout(t); }
}

export function parseJSONLoose(s: unknown): any {
  const t = String(s || '').trim();
  try { return JSON.parse(t); } catch { /* continue */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* continue */ } }
  const a = t.search(/[[{]/);
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* continue */ } }
  throw err(502, 'invalid_json', 'The AI answer came back in the wrong format. Try again.');
}

function upstreamError(r: Reply) {
  const msg = (r.json && r.json.error && r.json.error.message) || r.text || '';
  if (accountLimit(r)) { console.error('OpenRouter free-model daily limit reached'); return err(429, 'rate_limited', 'Today’s free AI quota is used up. Try again tomorrow.'); }
  if (r.status === 429) return err(429, 'rate_limited', 'The AI service is busy. Wait a minute and try again.');
  if (r.status === 402) return err(503, 'ai_error', 'The AI service account has run out of credit.');
  if (/moderation|flagged|safety/i.test(msg)) return err(422, 'refused', 'The AI declined this request.');
  // 404 "No endpoints found matching your data policy": allow free endpoints in the OpenRouter privacy settings.
  console.error('OpenRouter error', r.status, msg.slice(0, 500));
  return err(502, 'ai_error', 'The AI service returned an error. Try again.');
}
// The account's daily cap for all free models together (50 a day, or 1000 once $10 of credit was bought).
function accountLimit(r: Reply) { return r.status === 429 && /free-models-per-day|openrouter_free_tier/i.test(r.text); }
// Worth trying the next model: rate limit, model gone or not allowed, provider down.
const retryable = (r: Reply) => (r.status === 429 && !accountLimit(r)) || r.status === 404 || r.status === 408 || r.status >= 500 || (r.status === 400 && /not a valid model|no endpoints|unavailable/i.test(r.text));

// The API route may run 120 s: share 105 s between the models, and never let one model take it all.
const BUDGET_MS = 105000;
const PER_MODEL_MS = { fast: 45000, main: 90000 };

// Tries each model in turn. `use` turns the reply text into the result; if it throws (empty or
// broken JSON), the next model gets a chance while time remains.
async function complete<T>(messages: Msg[], fast: boolean, o: { json?: boolean; effort?: string; maxTokens?: number; task: string; meta: Meta }, use: (text: string) => T): Promise<T> {
  const headers = { authorization: 'Bearer ' + key(), 'x-title': 'Prep Canada', ...(process.env.APP_URL ? { 'http-referer': process.env.APP_URL } : {}) };
  const start = Date.now();
  let failure: unknown = null;
  for (const model of models(fast)) {
    const left = BUDGET_MS - (Date.now() - start);
    if (left < 5000) break;
    const body: Record<string, unknown> = { model, messages, max_tokens: o.maxTokens || 32000, reasoning: reasoningOn() ? { effort: o.effort || 'low', exclude: true } : { enabled: false } };
    if (o.json) body.response_format = { type: 'json_object' };
    let r: Reply;
    try { r = await postJSON(URL, headers, body, Math.min(left, fast ? PER_MODEL_MS.fast : PER_MODEL_MS.main)); }
    catch (e) { failure = e; continue; }
    const choice = r.status === 200 && r.json && r.json.choices && r.json.choices[0];
    // OpenRouter can answer 200 with an error in the body when the provider fails mid-way.
    if (!choice || r.json.error) {
      const bad = r.status === 200 ? { ...r, status: 502 } : r;
      failure = upstreamError(bad);
      if (!retryable(bad)) break;
      continue;
    }
    const text = String((choice.message && choice.message.content) || '');
    const u = r.json.usage || {};
    logUsage({ ...o.meta, task: o.task, model, inTok: u.prompt_tokens || 0, outTok: u.completion_tokens || text.length / 4 });
    try { return use(text); } catch (e) { failure = e; console.error('Unusable answer from', model); }
  }
  throw failure || err(502, 'ai_error', 'The AI service returned an error. Try again.');
}

export async function aiJSON(prompt: string, { fast = false, task = '', meta = {}, think }: { fast?: boolean; task?: string; meta?: Meta; think?: string } = {}): Promise<any> {
  if (isMock()) { const out = mockJSON(task); logUsage({ ...meta, task, model: textModel(fast), inTok: prompt.length / 4, outTok: JSON.stringify(out).length / 4 }); return out; }
  return complete([{ role: 'user', content: prompt }], fast, { json: true, effort: think || (fast ? 'low' : 'medium'), task, meta }, (text) => {
    if (!text.trim()) throw err(502, 'empty', 'The AI returned an empty answer. Try again.');
    const data = parseJSONLoose(text);
    if (!data || typeof data !== 'object') throw err(502, 'invalid_json', 'The AI answer came back in the wrong format. Try again.');
    return data;
  });
}

// Role-play chat: system rules + alternating turns. roles: 'candidate' | 'examiner'.
export async function aiChat(rules: string, turns: { role: string; text: string }[], meta: Meta = {}): Promise<string> {
  if (isMock()) { logUsage({ ...meta, task: 'examiner', model: textModel(true), inTok: (rules.length + JSON.stringify(turns).length) / 4, outTok: 30 }); return mockText(turns); }
  const msgs: Msg[] = turns.map((t) => ({ role: t.role === 'examiner' ? 'assistant' : 'user', content: t.text }));
  if (!msgs.length || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '(Le candidat décroche / the candidate is ready.)' });
  return complete([{ role: 'system', content: rules }, ...msgs], true, { effort: 'low', maxTokens: 4000, task: 'examiner', meta }, (text) => {
    if (!text.trim()) throw err(502, 'empty', 'The AI returned an empty answer. Try again.');
    return text.trim();
  });
}
