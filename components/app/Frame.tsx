'use client';
// The app chrome: side menu (desktop), tab bar (phones) and the main column. Also the route guard:
// pages other than the public ones need an account, as in the old app.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { t, tk } from '@/lib/i18n';
import { unescapeHtml } from '@/lib/i18n/react';
import { fmtDate, planLabel } from '@/lib/client/format';
import { useApp } from './AppProvider';
import { ArrFwd, Badge, Icon, LangPicker, ThemeButton } from './ui';

const PUBLIC = ['/', '/login', '/signup', '/forgot', '/reset', '/legal/terms', '/legal/privacy', '/plans'];
const isPublic = (p: string) => PUBLIC.includes(p) || p === '/paths' || p.startsWith('/paths/');

export function activeKey(p: string) {
  if (p === '/') return 'home';
  const first = p.split('/')[1] || '';
  if (first === 'billing') return 'plans';
  if (['login', 'signup', 'forgot', 'reset'].includes(first)) return 'auth';
  return first; // ielts, tef, paths, plans, account, admin, legal
}

type NavItem = [key: string, href: string, icon: ReactNode, label: string];
function navItems(signedIn: boolean, isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [['home', '/', <Icon key="i" name="home" />, tk('Home')], ['ielts', '/ielts', <Badge key="i" text="EN" color="var(--ielts)" />, 'IELTS'], ['tef', '/tef', <Badge key="i" text="FR" color="var(--tef)" />, 'TEF'], ['paths', '/paths', <Icon key="i" name="map" />, tk('Paths')]];
  if (signedIn) { items.push(['plans', '/plans', <Icon key="i" name="plans" />, tk('Plans')], ['account', '/account', <Icon key="i" name="user" />, tk('Account')]); if (isAdmin) items.push(['admin', '/admin', <Icon key="i" name="admin" />, tk('Admin')]); }
  else items.push(['plans', '/plans', <Icon key="i" name="plans" />, tk('Plans')], ['login', '/login', <Icon key="i" name="login" />, tk('Sign in')]);
  return items;
}

export function Frame({ children }: { children: ReactNode }) {
  const app = useApp();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const active = activeKey(pathname);
  const coach = pathname === '/ielts' ? 'ielts' : pathname === '/tef' ? 'tef' : null;

  // Accent colour follows the exam; the coach content keeps its exam's language, left to right.
  useEffect(() => { document.documentElement.dataset.exam = coach === 'tef' ? 'tef' : 'ielts'; }, [coach]);
  useEffect(() => { document.body.classList.toggle('focus', app.focus); }, [app.focus]);
  useEffect(() => { if (coach) { try { localStorage.setItem('pc_last', coach); } catch { /* ignore */ } } }, [coach]);

  // Guard
  const blocked = app.ready && !app.me && !isPublic(pathname);
  const bounce = app.ready && !!app.me && (pathname === '/login' || pathname === '/signup');
  useEffect(() => {
    if (blocked) router.replace('/login?next=' + encodeURIComponent(pathname));
    else if (bounce) router.replace('/');
  }, [blocked, bounce, pathname, router]);

  const me = app.me; const p = me && me.plan;
  const all = navItems(!!me, !!me?.isAdmin);
  const tabs = me ? ['home', 'ielts', 'tef', 'paths', 'account'] : ['home', 'paths', 'plans', 'login'];
  return (
    <>
      <div className="layout">
        <aside className="side" id="side" aria-label="Main menu">
          {app.ready && <>
            <Link className="brand" href="/"><span className="mark">PC</span><div><b>Prep Canada</b><div className="sub">{unescapeHtml(t('IELTS &amp; TEF coach'))}</div></div></Link>
            <nav className="sidenav" aria-label={t('Main')}>
              {all.filter(([k]) => me || !['ielts', 'tef'].includes(k)).map(([k, href, ic, label]) => (
                <Link key={k} href={href} aria-current={active === k ? 'page' : undefined}>{ic}<span>{t(label)}</span></Link>
              ))}
            </nav>
            {me && p ? (
              <Link className="sideplan" href={p.plan === 'free' ? '/plans' : '/account'}>
                <span className="small muted">{t('Your plan')}</span><b>{planLabel(p)}</b>
                {p.until ? <span className="small muted">{t('until {date}', { date: fmtDate(p.until) })}</span> : <span className="small" style={{ color: 'var(--accent)' }}>{t('Upgrade')}<ArrFwd /></span>}
              </Link>
            ) : <Link className="btn primary" href="/signup" style={{ justifyContent: 'center' }}>{t('Create free account')}</Link>}
            <div className="sidetools"><LangPicker /><ThemeButton /></div>
          </>}
        </aside>
        <main className="shell" id="app" lang={coach ? (coach === 'tef' ? 'fr' : 'en') : undefined} dir={coach ? 'ltr' : undefined}>
          {!app.ready || blocked || bounce ? <p className="muted">{app.ready ? '' : 'Loading…'}</p> : children}
        </main>
      </div>
      <nav className="tabbar" id="tabbar" aria-label="Main">
        {app.ready && tabs.map((k) => {
          const it = all.find((x) => x[0] === k); if (!it) return null;
          const cur = active === k || (k === 'account' && ['plans', 'admin'].includes(active));
          return <Link key={k} href={it[1]} aria-current={cur ? 'page' : undefined}>{it[2]}<span>{t(it[3])}</span></Link>;
        })}
      </nav>
    </>
  );
}
