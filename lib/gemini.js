// Google Gemini client (server side only; the key never reaches the browser).
// Text: generateContent with JSON output, falling back to the Interactions API.
// Speech: Gemini TTS, returned as a 24 kHz mono WAV.
import { err } from './util.js';
import { mockJSON, mockText, mockAudio } from './mock.js';
import { logUsage } from './cost.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MODEL_FAST = () => process.env.GEMINI_MODEL_FAST || 'gemini-3.5-flash-lite';
const MODEL_TTS = () => process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const isMock = () => process.env.GEMINI_MOCK === '1';
export const ttsModel = MODEL_TTS;
export const textModel = (fast) => (fast ? MODEL_FAST() : MODEL());

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw err(500, 'config', 'GEMINI_API_KEY is not set on the server.');
  return k;
}

async function post(url, body, ms = 110000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key() },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { status: r.status, json, text };
  } catch (e) {
    if (e.name === 'AbortError') throw err(504, 'ai_timeout', 'The AI took too long to answer. Try again.');
    throw err(502, 'ai_error', 'Could not reach the AI service.');
  } finally { clearTimeout(t); }
}

function collectText(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((n) => collectText(n, out)); return out; }
  if (typeof node.text === 'string' && !node.thought) out.push(node.text);
  for (const k of Object.keys(node)) if (k !== 'text' && typeof node[k] === 'object') collectText(node[k], out);
  return out;
}

export function parseJSONLoose(s) {
  const t = String(s || '').trim();
  try { return JSON.parse(t); } catch { /* continue */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* continue */ } }
  const a = t.search(/[[{]/);
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* continue */ } }
  throw err(502, 'invalid_json', 'The AI answer came back in the wrong format. Try again.');
}

function upstreamError(r) {
  const msg = (r.json && r.json.error && r.json.error.message) || r.text || '';
  if (r.status === 429) return err(429, 'rate_limited', 'The AI service is busy. Wait a minute and try again.');
  if (r.status === 400 && /safety|blocked/i.test(msg)) return err(422, 'refused', 'The AI declined this request.');
  console.error('Gemini error', r.status, msg.slice(0, 500));
  return err(502, 'ai_error', 'The AI service returned an error. Try again.');
}

async function generate(body, model) {
  // 1) generateContent
  let r = await post(`${BASE}/models/${model}:generateContent`, body);
  if (r.status === 400 && body.generationConfig && body.generationConfig.thinkingConfig) {
    // Some models don't accept thinking settings: retry without them.
    const b2 = JSON.parse(JSON.stringify(body));
    delete b2.generationConfig.thinkingConfig;
    r = await post(`${BASE}/models/${model}:generateContent`, b2);
  }
  if (r.status === 200) {
    const cand = r.json && r.json.candidates && r.json.candidates[0];
    if (cand && cand.finishReason === 'SAFETY') throw err(422, 'refused', 'The AI declined this request.');
    const um = r.json.usageMetadata || {};
    const text = collectText(cand && cand.content).join('');
    return { text, inTok: um.promptTokenCount || 0, outTok: (um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0) || text.length / 4 };
  }
  if (r.status === 404 || r.status === 400) {
    // 2) Interactions API (default API since mid-2026)
    const input = (body.systemInstruction ? body.systemInstruction.parts[0].text + '\n\n' : '') +
      body.contents.map((c) => (body.contents.length > 1 ? (c.role === 'model' ? 'Examiner: ' : 'Candidate: ') : '') + c.parts.map((p) => p.text).join('')).join('\n');
    const ib = { model, input, store: false };
    if (body.generationConfig && body.generationConfig.responseMimeType === 'application/json') {
      ib.response_format = { type: 'text', mime_type: 'application/json' };
    }
    const r2 = await post(`${BASE}/interactions`, ib);
    if (r2.status === 200) {
      const steps = r2.json.steps || r2.json.execution_steps || r2.json.outputs || r2.json;
      const text = collectText(steps).join('');
      const u = r2.json.usage || r2.json.usage_metadata || r2.json.usageMetadata || {};
      return { text, inTok: u.input_tokens || u.total_input_tokens || u.promptTokenCount || input.length / 4, outTok: (u.output_tokens || u.total_output_tokens || u.candidatesTokenCount || 0) + (u.thought_tokens || u.total_thought_tokens || u.thoughtsTokenCount || 0) || text.length / 4 };
    }
    throw upstreamError(r2);
  }
  throw upstreamError(r);
}

export async function aiJSON(prompt, { fast = false, task = '', meta = {}, think } = {}) {
  const model = fast ? MODEL_FAST() : MODEL();
  if (isMock()) { const out = mockJSON(task, prompt); logUsage({ ...meta, task, model, inTok: prompt.length / 4, outTok: JSON.stringify(out).length / 4 }); return out; }
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: think || (fast ? 'low' : 'medium') } }
  };
  const g = await generate(body, model);
  logUsage({ ...meta, task, model, inTok: g.inTok, outTok: g.outTok });
  if (!g.text.trim()) throw err(502, 'empty', 'The AI returned an empty answer. Try again.');
  return parseJSONLoose(g.text);
}

// Role-play chat: system rules + alternating turns. roles: 'candidate' | 'examiner'.
export async function aiChat(rules, turns, meta = {}) {
  if (isMock()) { logUsage({ ...meta, task: 'examiner', model: MODEL_FAST(), inTok: (rules.length + JSON.stringify(turns).length) / 4, outTok: 30 }); return mockText(turns); }
  const contents = turns.map((t) => ({ role: t.role === 'examiner' ? 'model' : 'user', parts: [{ text: t.text }] }));
  if (!contents.length || contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(Le candidat décroche / the candidate is ready.)' }] });
  const body = { systemInstruction: { parts: [{ text: rules }] }, contents, generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } };
  const g = await generate(body, MODEL_FAST());
  logUsage({ ...meta, task: 'examiner', model: MODEL_FAST(), inTok: g.inTok, outTok: g.outTok });
  return g.text.trim();
}

/* ---------------- Text to speech ---------------- */
function findAudio(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const a = findAudio(n); if (a) return a; } return null; }
  if (node.inlineData && node.inlineData.data) return { data: node.inlineData.data, mime: node.inlineData.mimeType || '' };
  if (node.inline_data && node.inline_data.data) return { data: node.inline_data.data, mime: node.inline_data.mime_type || '' };
  if (typeof node.data === 'string' && node.data.length > 1000) return { data: node.data, mime: node.mime_type || node.mimeType || '' };
  for (const k of Object.keys(node)) { const a = findAudio(node[k]); if (a) return a; }
  return null;
}

export function pcmToWav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function toWav(audio) {
  const buf = Buffer.from(audio.data, 'base64');
  if (buf.slice(0, 4).toString() === 'RIFF') return buf;
  const m = /rate=(\d+)/.exec(audio.mime);
  return pcmToWav(buf, m ? Number(m[1]) : 24000);
}

// lines: [{speaker, text}], voices: {speaker: voiceName} (at most 2 speakers), style: accent/delivery note
export async function tts(lines, voices, style) {
  if (isMock()) return mockAudio(lines);
  const model = MODEL_TTS();
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const multi = speakers.length > 1;
  const transcript = multi ? lines.map((l) => l.speaker + ': ' + l.text).join('\n') : lines.map((l) => l.text).join(' ');
  const prompt = (style ? style + (multi ? ':\n' : ': ') : '') + transcript;
  const speechConfig = multi
    ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.slice(0, 2).map((s) => ({ speaker: s, voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[s] || 'Kore' } } })) } }
    : { voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[speakers[0]] || 'Kore' } } };
  let r = await post(`${BASE}/models/${model}:generateContent`, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig }
  }, 100000);
  let audio = r.status === 200 ? findAudio(r.json) : null;
  if (!audio && (r.status === 400 || r.status === 404 || r.status === 200)) {
    // Interactions API format
    const content = lines.map((l) => ({ type: 'text', text: l.text, annotations: [{ type: 'speech_metadata', speaker: multi ? l.speaker : undefined, style: style || undefined }] }));
    const body = {
      model, store: false,
      input: [{ type: 'user_input', content }],
      response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
      generation_config: { speech_config: multi ? { mode: 'conversational', speakers: speakers.slice(0, 2).map((s) => ({ speaker: s, voice: voices[s] || 'Kore' })) } : [{ voice: voices[speakers[0]] || 'Kore' }] }
    };
    r = await post(`${BASE}/interactions`, body, 100000);
    audio = r.status === 200 ? findAudio(r.json) : null;
  }
  if (!audio) throw r.status === 200 ? err(502, 'ai_error', 'No audio came back.') : upstreamError(r);
  return toWav(audio);
}
