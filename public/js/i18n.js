// Interface languages: English (source), French, Arabic (right-to-left).
// Strings are written in English in the code and wrapped in t('…'); fr.js / ar.js map each English
// string to its translation. A missing translation falls back to English, never to a blank.
// Placeholders: t('{n} of {total} stops done', { n: 2, total: 14 }).
// tk('…') marks a string that is stored in a table and translated later with t(value).

export const LANGS = [['en', 'English', 'EN'], ['fr', 'Français', 'FR'], ['ar', 'العربية', 'ع']];
const KEY = 'pc_lang';
const DICTS = { en: {} };
let LANG = 'en';

export const tk = (s) => s;
export function t(s, vars) {
  let out = (LANG !== 'en' && DICTS[LANG] && DICTS[LANG][s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return out;
}
export const lang = () => LANG;
export const isRTL = () => LANG === 'ar';
// Latin digits in Arabic too: that is what Tunisian users read on documents and prices
export const locale = () => ({ en: 'en-GB', fr: 'fr-FR', ar: 'ar-TN-u-nu-latn' })[LANG];
// Numbers: in Arabic use comma grouping (1,200) — in Tunisia a dot reads as a decimal (1.500 DT = 1.5 dinars)
export const fmtNum = (n, o) => Number(n).toLocaleString(LANG === 'ar' ? 'en-US' : locale(), o);
export const fmtDay = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const x = typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) ? new Date(d + 'T12:00:00Z') : new Date(d);
  return isNaN(x) ? String(d || '–') : x.toLocaleDateString(locale(), { timeZone: 'UTC', ...o });
};

export function detect() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
  if (saved && DICT_LOADERS[saved]) return saved;
  const nav = (navigator.languages || [navigator.language || 'en']).map((x) => String(x).slice(0, 2).toLowerCase());
  return nav.find((l) => DICT_LOADERS[l]) || 'en';
}
const DICT_LOADERS = { en: async () => ({}), fr: () => import('./i18n/fr.js').then((m) => m.default), ar: () => import('./i18n/ar.js').then((m) => m.default) };

export async function setLang(l, { remember = true } = {}) {
  if (!DICT_LOADERS[l]) l = 'en';
  if (!DICTS[l]) { try { DICTS[l] = await DICT_LOADERS[l](); } catch { DICTS[l] = {}; } }
  LANG = l;
  if (remember) { try { localStorage.setItem(KEY, l); } catch { /* ignore */ } }
  const html = document.documentElement;
  html.lang = l; html.dir = l === 'ar' ? 'rtl' : 'ltr';
  return l;
}

// Language menu (a native <select>: accessible, works on every phone)
export function langPicker(id = 'lang-pick') {
  return '<label class="langpick" for="' + id + '"><span class="sr">' + t('Language') + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/></svg><select id="' + id + '" data-lang-pick>' +
    LANGS.map(([k, name]) => '<option value="' + k + '"' + (k === LANG ? ' selected' : '') + ' lang="' + k + '">' + name + '</option>').join('') + '</select></label>';
}
