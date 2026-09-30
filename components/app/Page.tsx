'use client';
// What every page shares: the phone header, the plan-renewal banner, the setup warning and the footer.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import { fmtDate, planLabel } from '@/lib/client/format';
import { useApp } from './AppProvider';
import { ExamBadge, LangPicker, ThemeButton } from './ui';

export function MobileTop() {
  const { me } = useApp();
  return (
    <header className="mtop">
      <Link className="brand" href="/"><span className="mark">PC</span><b>Prep Canada</b></Link>
      <LangPicker id="lang-pick-m" /><ThemeButton />
      {me ? <Link className={'pill ' + (me.plan.plan === 'free' ? '' : 'good')} href={me.plan.plan === 'free' ? '/plans' : '/account'}>{planLabel(me.plan)}</Link>
        : <Link className="btn sm primary" href="/signup">{t('Sign up')}</Link>}
    </header>
  );
}

export function RenewBanner() {
  const { me } = useApp();
  const p = me && me.plan; if (!p || p.plan === 'free' || !p.until) return null;
  const days = Math.ceil((new Date(p.until).getTime() - Date.now()) / 86400000);
  if (days > 5) return null;
  const vars = { plan: planLabel(p), date: fmtDate(p.until), n: days };
  return <div className="banner small">{days === 1 ? t('Your {plan} plan ends on {date} (1 day). Plans don’t renew automatically.', vars) : t('Your {plan} plan ends on {date} ({n} days). Plans don’t renew automatically.', vars)} <Link href="/plans">{t('Renew now')}</Link></div>;
}

function SetupBanner() {
  const { setup: s } = useApp(); if (!s) return null;
  const items = (s.missing || []).concat(s.db === false && !(s.missing || []).includes('DATABASE_URL') ? [t('a working database connection')] : []).join(', ');
  return <div className="banner bad"><b>{t('Setup not finished.')}</b> {t('The owner still needs to add: {items}. Sign-up will work once this is done.', { items })}</div>;
}

export function Footer() {
  const { config: c } = useApp();
  return (
    <footer className="foot">
      <Link href="/legal/terms">{t('Terms')}</Link><Link href="/legal/privacy">{t('Privacy')}</Link>
      {c.support ? <span>{tr('Help: {email}', { email: <span style={{ userSelect: 'all' }}>{c.support}</span> })}</span> : null}
      <span>{t('Not affiliated with IELTS, IDP, the British Council, Cambridge or CCI Paris Île-de-France. Scores are estimates.')}</span>
    </footer>
  );
}

/** A normal page: phone header, renewal and setup banners, content, footer. */
export function Page({ children }: { children: ReactNode }) {
  useApp(); // re-render on language change
  return <><MobileTop /><RenewBanner /><SetupBanner />{children}<Footer /></>;
}

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return <Page><div className="auth"><div className="panel"><h1 style={{ fontSize: '1.8rem' }}>{title}</h1>{children}</div></div></Page>;
}

/** Header of the IELTS / TEF coaches, with their section tabs. */
export function CoachHeader({ exam, nav, current, subtitle, onNav }: { exam: 'ielts' | 'tef'; nav: [string, string][]; current: string; subtitle: string; onNav: (v: string) => void }) {
  return (
    <div className="apphead">
      <MobileTop /><RenewBanner />
      <div className="modhead">
        <div className="modtitle"><ExamBadge exam={exam} /><div><b>{exam === 'tef' ? 'TEF Canada' : 'IELTS General Training'}</b><span className="small muted">{subtitle}</span></div></div>
        <nav className="nav" aria-label="Sections">
          {nav.map(([v, l]) => <button key={v} data-nav={v} aria-current={current === v ? 'page' : undefined} onClick={() => onNav(v)}>{l}</button>)}
        </nav>
      </div>
    </div>
  );
}
