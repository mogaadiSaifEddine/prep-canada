// Studio voices: Gemini text-to-speech, returned as a 24 kHz mono WAV. Optional and paid:
// without GEMINI_API_KEY studio voices are off and the app reads with the device's voices.
import { err } from './util';
import { mockAudio } from './mock';
import { isMock, postJSON } from './ai';

// One spoken line for text-to-speech.
export type Line = { speaker: string; text: string };

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const ttsModel = () => process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
export const ttsAvailable = () => isMock() || !!process.env.GEMINI_API_KEY;

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw err(503, 'tts_unavailable', 'Studio voices are not available.');
  return k;
}
const post = (url: string, body: unknown) => postJSON(url, { 'x-goog-api-key': key() }, body, 100000);

function upstreamError(r: { status: number; json: any; text: string }) {
  const msg = (r.json && r.json.error && r.json.error.message) || r.text || '';
  if (r.status === 429) return err(429, 'rate_limited', 'The AI service is busy. Wait a minute and try again.');
  console.error('Gemini TTS error', r.status, msg.slice(0, 500));
  return err(502, 'ai_error', 'The AI service returned an error. Try again.');
}

function findAudio(node: any): { data: string; mime: string } | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const a = findAudio(n); if (a) return a; } return null; }
  if (node.inlineData && node.inlineData.data) return { data: node.inlineData.data, mime: node.inlineData.mimeType || '' };
  if (node.inline_data && node.inline_data.data) return { data: node.inline_data.data, mime: node.inline_data.mime_type || '' };
  if (typeof node.data === 'string' && node.data.length > 1000) return { data: node.data, mime: node.mime_type || node.mimeType || '' };
  for (const k of Object.keys(node)) { const a = findAudio(node[k]); if (a) return a; }
  return null;
}

export function pcmToWav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function toWav(audio: { data: string; mime: string }) {
  const buf = Buffer.from(audio.data, 'base64');
  if (buf.slice(0, 4).toString() === 'RIFF') return buf;
  const m = /rate=(\d+)/.exec(audio.mime);
  return pcmToWav(buf, m ? Number(m[1]) : 24000);
}

// lines: [{speaker, text}], voices: {speaker: voiceName} (at most 2 speakers), style: accent/delivery note
export async function tts(lines: Line[], voices: Record<string, string>, style?: string): Promise<Buffer> {
  if (isMock()) return mockAudio(lines);
  const model = ttsModel();
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
  });
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
    r = await post(`${BASE}/interactions`, body);
    audio = r.status === 200 ? findAudio(r.json) : null;
  }
  if (!audio) throw r.status === 200 ? err(502, 'ai_error', 'No audio came back.') : upstreamError(r);
  return toWav(audio);
}
