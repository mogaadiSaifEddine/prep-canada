'use client';
// Small shared pieces of the interface: icons, badges, arrows, the language picker and theme button.
import type { ReactNode } from 'react';
import { LANGS, lang, t } from '@/lib/i18n';
import { toggle as toggleTheme } from '@/lib/client/theme';
import { useApp } from './AppProvider';

const ICON: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  map: <path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />,
  plans: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M8 18h2M12 18h4" /></>,
  admin: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  login: <path d="M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
};
export const Icon = ({ name }: { name: keyof typeof ICON | string }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICON[name]}</svg>;
export const Badge = ({ text, color }: { text: string; color: string }) => <span className="xbadge" style={{ ['--xb' as string]: color }}>{text}</span>;
export const ExamBadge = ({ exam }: { exam: 'ielts' | 'tef' }) => <Badge text={exam === 'tef' ? 'FR' : 'EN'} color={exam === 'tef' ? 'var(--tef)' : 'var(--ielts)'} />;
export const ArrBack = () => <span className="arr-back" aria-hidden="true" />;
export const ArrFwd = () => <span className="arr-fwd" aria-hidden="true" />;
export const Spinner = ({ style }: { style?: React.CSSProperties }) => <span className="spinner" style={style} />;
export const Loading = () => <div className="row"><Spinner /></div>;

/** Arabic: keep a Latin name in brackets, e.g. «(Express Entry)», on one line and in LTR order. */
export function Nm({ s }: { s: string }) {
  if (lang() !== 'ar') return <>{s}</>;
  const parts = String(s).split(/(\([A-Za-z][A-Za-z0-9 .\/&+'’-]*\))/g);
  return <>{parts.map((p, i) => (i % 2 ? <bdi key={i} className="ltrrun">{p}</bdi> : p))}</>;
}

// Language menu (a native <select>: accessible, works on every phone)
export function LangPicker({ id = 'lang-pick' }: { id?: string }) {
  const app = useApp();
  return (
    <label className="langpick" htmlFor={id}>
      <span className="sr">{t('Language')}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" /></svg>
      <select id={id} data-lang-pick="" value={app.lang} onChange={(e) => app.setLanguage(e.target.value)}>
        {LANGS.map(([k, name]) => <option key={k} value={k} lang={k}>{name}</option>)}
      </select>
    </label>
  );
}

export function ThemeButton() {
  const label = t('Light or dark theme');
  return (
    <button type="button" className="themebtn" data-sa="theme-toggle" aria-label={label} title={label} onClick={() => toggleTheme()}>
      <svg className="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
      <svg className="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  );
}
