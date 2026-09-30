// Light / dark theme. The root layout applies the saved or system theme before first paint;
// this module switches it and keeps the browser bar colour in step.
const KEY = 'pc_theme';
export type Theme = 'light' | 'dark';
export function saved(): Theme | null { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } }
export const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
export function apply(th?: Theme | null): Theme {
  const t: Theme = th || saved() || (systemDark() ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null; if (m) m.content = t === 'dark' ? '#0B1220' : '#F5F7FB';
  return t;
}
export function toggle(): Theme { const t: Theme = current() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, t); } catch { /* private mode */ } return apply(t); }
/** Follow the system while the user has not picked a theme. Returns an unsubscribe function. */
export function followSystem() {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const on = () => { if (!saved()) apply(); };
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}

/** Runs before React, in <head>: sets theme, language and direction so the first paint is right. */
export const BOOT_SCRIPT = '(function(){var t;try{t=localStorage.getItem("pc_theme")}catch(e){}if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;if(t==="dark"){var m=document.querySelector(\'meta[name="theme-color"]\');if(m)m.content="#0B1220"}try{var l=localStorage.getItem("pc_lang");if(l==="ar"){document.documentElement.lang="ar";document.documentElement.dir="rtl"}else if(l)document.documentElement.lang=l}catch(e){}})();';
