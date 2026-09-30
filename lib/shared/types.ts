// Types shared by the server (API replies) and the browser.

export type Exam = 'ielts' | 'tef';
export type Skill = 'L' | 'R' | 'W' | 'S';
export type Plan = 'free' | 'solo' | 'duo';
export type Period = 'month' | 'year';

export type ActivePlan = { plan: Plan; exam: Exam | null; until: string | null };
export type Entitlement = { paid: boolean; course: boolean; lessons: boolean; tts: boolean; unlimitedMocks: boolean };
export type Me = { id: string; email: string; name: string; lang: string | null; createdAt: string; plan: ActivePlan; isAdmin: boolean };

export type Prices = Record<'solo' | 'duo', Record<Period, number>>;
export type Config = {
  prices: Prices;
  methods: { konnect?: boolean; flouci?: boolean; manual: boolean };
  manualInfo: string;
  support?: string;
  business?: string;
  matricule?: string;
  inpdp?: string;
  limits: { free?: Record<string, number>; paid?: { aiPerDay: number; ttsPerDay: number; testsPerDay: number; sectionsPerMonth: number } };
};

export type Payment = {
  id: string; method: string; plan: Plan; exam: Exam | null; period: Period; amount: number;
  status: 'pending' | 'review' | 'paid' | 'failed' | 'rejected'; reference: string | null; createdAt: string; paidAt: string | null;
};

/* ---------- invitation rounds ---------- */
export type EERound = { n: number; date: string; cat: string; name: string; itas: number; crs: number };
export type PoolDist = { asOf: string | null; total: number; buckets: [number, number, number][] };
export type QuebecRound = { date: string; stream: number; itas: number; groups: [string, number | null, number | null][] };
export type ProvRound = { date: string; prov: string; stream: string; itas: number | null; min: number | null; fr?: boolean };
export type Draws = {
  checked: string;
  ee: { source: string; rounds: EERound[]; dist: PoolDist | null; note: string; fetchedAt?: string };
  quebec: { source: string; note: string; rounds: QuebecRound[] };
  provinces: { note: string; rounds: ProvRound[]; news?: string[] };
  live: boolean;
  updated?: string;
};
