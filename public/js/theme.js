// Light / dark theme. index.html applies the saved or system theme before first paint;
// this module switches it and keeps the browser bar colour in step.
const KEY = 'pc_theme';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
export function saved() { try { return localStorage.getItem(KEY); } catch { return null; } }
export const current = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
export function apply(th) {
  const t = th || saved() || (mq && mq.matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#0B1220' : '#F5F7FB';
  return t;
}
export function toggle() { const t = current() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, t); } catch { /* private mode */ } return apply(t); }
// Follow the system while the user has not picked a theme
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (!saved()) apply(); });
export function themeButton(label) {
  return '<button type="button" class="themebtn" data-sa="theme-toggle" aria-label="' + label + '" title="' + label + '">' +
    '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
    '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>';
}
