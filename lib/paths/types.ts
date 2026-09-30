// Immigration path data (one module per interface language: en.ts, fr.ts, ar.ts).
export type StopApp = { go: string; label: string; exam: 'tef' | 'ielts'; min: number };
export type Stop = {
  id: string; title: string; time: string; cost: string; link: string;
  why?: string; steps?: string[]; docs?: string[]; tunisia?: string; app?: StopApp; optional?: boolean;
};
export type PathLang = { exam: 'tef' | 'ielts'; min: number; label: string };
export type Path = {
  id: string; name: string; color: string; tag: string; summary: string;
  who: string[]; time: string; cost: string; lang?: PathLang | null; facts?: string[]; stops: Stop[];
};
export type Paused = { name: string; note: string; link: string };
export type PathsModule = { CHECKED: string; PATHS: Path[]; PAUSED: Paused[]; LINKS: Record<string, string> };
/** Overrides passed to a shared stop builder (S.eca(), S.french(level, o)…). */
export type StopOpts = Partial<Stop> & { min?: number };
