// What the router and the content pool need from an exam's prompt module (ielts.ts, tef.ts).
// Profiles, attempts and AI content are free-form JSON saved by the app.
export type Json = Record<string, any>;
export type AudioChunk = { kind: string; lines: { speaker: string; text: string }[] };
export type AudioPlan = { chunks: AudioChunk[]; voices: Record<string, string>; style: string };

export interface ExamPrompts {
  genPrompt(att: Json, p: Json, user: Json, k: string, i: number, o?: { diff?: string; avoid?: string[] }): { prompt: string; fast?: boolean };
  resolveDiff(att: Json, p: Json, k: string): string;
  weakKeys(p: Json, k: string): string[];
  levelBucket(p: Json, skill: string): string;
  lessonPrompt(p: Json, user: Json, u: Json, level: string): string;
  coursePrompt(p: Json, user: Json, catalog?: Json[], prev?: Json | null): string;
  taskFbPrompt(p: Json, user: Json, u: Json, taskPrompt: string, answer: string): string;
  markWritingPrompt(doc: Json, p: Json, user: Json): string;
  markSpeakingPrompt(doc: Json, p: Json, user: Json): string;
}
