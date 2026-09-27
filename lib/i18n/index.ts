// Interface languages: English (source), French, Arabic (right-to-left).
// Strings are written in English in the code and wrapped in t('…'); fr.ts / ar.ts map each English
// string to its translation. A missing translation falls back to English, never to a blank.
// Placeholders: t('{n} of {total} stops done', { n: 2, total: 14 }).
// tk('…') marks a string that is stored in a table and translated later with t(value).
// In React, use tr() (lib/i18n/react.tsx) when a placeholder is a link or other element.

export type Lang = 'en' | 'fr' | 'ar';
export type Vars = Record<string, string | number | null | undefined>;

export const LANGS: [Lang, string, string][] = [['en', 'English', 'EN'], ['fr', 'Français', 'FR'], ['ar', 'العربية', 'ع']];
const KEY = 'pc_lang';
const DICTS: Partial<Record<Lang, Record<string, string>>> = { en: {} };
let LANG: Lang = 'en';

export const tk = (s: string) => s;
export function t(s: string, vars?: Vars): string {
  let out = (LANG !== 'en' && DICTS[LANG] && DICTS[LANG]![s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return out;
}
/** The translated template, placeholders left in place (for tr()). */
export const template = (s: string) => (LANG !== 'en' && DICTS[LANG] && DICTS[LANG]![s]) || s;
export const lang = () => LANG;
export const isRTL = () => LANG === 'ar';
// Latin digits in Arabic too: that is what Tunisian users read on documents and prices
export const locale = () => ({ en: 'en-GB', fr: 'fr-FR', ar: 'ar-TN-u-nu-latn' })[LANG];
// Numbers: in Arabic use comma grouping (1,200) — in Tunisia a dot reads as a decimal (1.500 DT = 1.5 dinars)
export const fmtNum = (n: number | string, o?: Intl.NumberFormatOptions) => Number(n).toLocaleString(LANG === 'ar' ? 'en-US' : locale(), o);
export const fmtDay = (d: string | number | Date | null | undefined, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const x = typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) ? new Date(d + 'T12:00:00Z') : new Date(d as string);
  return isNaN(x.getTime()) ? String(d || '–') : x.toLocaleDateString(locale(), { timeZone: 'UTC', ...o });
};

const DICT_LOADERS: Record<Lang, () => Promise<Record<string, string>>> = {
  en: async () => ({}),
  fr: () => import('./fr').then((m) => m.default),
  ar: () => import('./ar').then((m) => m.default)
};
const isLang = (l: unknown): l is Lang => typeof l === 'string' && l in DICT_LOADERS;

export function saved(): Lang | null {
  try { const v = localStorage.getItem(KEY); return isLang(v) ? v : null; } catch { return null; }
}
export function detect(): Lang {
  const s = saved(); if (s) return s;
  const nav = (navigator.languages || [navigator.language || 'en']).map((x) => String(x).slice(0, 2).toLowerCase());
  return (nav.find(isLang) as Lang | undefined) || 'en';
}

export async function setLang(l: string, { remember = true } = {}): Promise<Lang> {
  const next: Lang = isLang(l) ? l : 'en';
  if (!DICTS[next]) { try { DICTS[next] = await DICT_LOADERS[next](); } catch { DICTS[next] = {}; } }
  LANG = next;
  if (remember) { try { localStorage.setItem(KEY, next); } catch { /* private mode */ } }
  const html = document.documentElement;
  html.lang = next; html.dir = next === 'ar' ? 'rtl' : 'ltr';
  return next;
}
