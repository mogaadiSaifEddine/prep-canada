'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { ArrFwd, Badge, Icon, LangPicker, Nm, Spinner } from '@/components/app/ui';
import { MiniTrail } from '@/components/paths/PathMap';
import { fmtDay, fmtNum, t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import { fmtTND } from '@/lib/client/format';
import { getDoc } from '@/lib/client/api';
import * as PV from '@/lib/client/paths-store';

export default function HomePage() {
  const app = useApp();
  return app.me ? <Home /> : <Landing />;
}

function Landing() {
  const { config } = useApp();
  const pr = config.prices;
  return (
    <Page>
      <section className="panel hero">
        <div className="row between"><p className="eyebrow">IELTS General Training · TEF Canada</p><LangPicker id="lang-pick-l" /></div>
        <h1>{t('Reach your CLB target for Canada')}</h1>
        <p className="lead">{t('Start with a full placement test in the real format and timings. You get a course built on your weak points, and new mock tests at your level whenever you want one.')}</p>
        <div className="row"><Link className="btn primary" href="/signup">{t('Take the free placement test')}</Link><Link className="btn" href="/login">{t('Sign in')}</Link></div>
      </section>
      <div className="grid">
        <div className="panel examcard" style={{ ['--c' as string]: 'var(--ielts)' }}><span className="tag">IELTS GENERAL TRAINING</span><h2 lang="en">English</h2><p className="muted">{t('Listening, Reading, Writing and Speaking, with band scores and your CLB level for each skill.')}</p></div>
        <div className="panel examcard" style={{ ['--c' as string]: 'var(--tef)' }}><span className="tag">TEF CANADA</span><h2 lang="fr">Français</h2><p className="muted">{t('Compréhension et expression, orales et écrites, with scores out of 699 and your NCLC level.')}</p></div>
        <div className="panel"><h3>{t('How it works')}</h3>
          <ol style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>{t('Placement test in all four skills')}</li><li>{t('Writing and speaking marked against the official criteria, with your errors quoted')}</li><li>{t('A 12-unit course built on your results')}</li><li>{t('Unlimited new mock tests that adapt to your level')}</li>
          </ol>
        </div>
      </div>
      <Link className="panel flat" href="/paths" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="row between"><div><h3>{t('Every immigration path, as a map')}</h3><p className="muted">{t('Express Entry, the French draws, Québec, provinces, community pilots, study routes: each one step by step, with documents, time and cost.')}</p></div><span className="btn">{t('Explore the paths')}</span></div>
      </Link>
      <div className="panel flat"><div className="row between"><div><h3>{t('Free to start')}</h3><p className="muted">{t('The placement test and one mock a month are free. Unlimited tests, the course and studio voices start at {price} a month.', { price: fmtTND(pr.solo.month) })}</p></div><Link className="btn" href="/plans">{t('See plans')}</Link></div></div>
    </Page>
  );
}

type Act = { href: string; icon: React.ReactNode; title: string; sub?: string; primary?: boolean; lang?: string };
function Action({ a }: { a: Act }) {
  return (
    <Link className={'action' + (a.primary ? ' primary' : '')} href={a.href} lang={a.lang}>
      <span className="aic">{a.icon}</span><span className="atext"><b>{a.title}</b>{a.sub ? <span className="small muted">{a.sub}</span> : null}</span>
      <span className="achev" aria-hidden="true"><ArrFwd /></span>
    </Link>
  );
}

function Home() {
  const app = useApp(); const me = app.me!; const p = me.plan;
  PV.usePaths();
  const [docs, setDocs] = useState<{ ie: any; te: any } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [ie, te] = await Promise.all(['ielts', 'tef'].map((ex) => getDoc(ex, 'profile').catch(() => null)));
      await Promise.all([PV.load().catch(() => {}), PV.loadDraws().catch(() => null)]);
      if (alive) setDocs({ ie, te });
    })();
    return () => { alive = false; };
  }, []);

  const EN = <Badge text="EN" color="var(--ielts)" />; const FRB = <Badge text="FR" color="var(--tef)" />;
  let acts: Act[] = [];
  const ps = docs ? PV.pinnedSummary() : null;
  if (docs) {
    const { ie, te } = docs;
    if (ie && ie.activeAttemptId) acts.push({ href: '/ielts', icon: EN, title: t('Resume your IELTS test'), sub: t('Your answers are saved'), primary: true });
    if (te && te.activeAttemptId) acts.push({ href: '/tef', icon: FRB, title: 'Reprendre votre test TEF', sub: 'Vos réponses sont enregistrées', primary: true, lang: 'fr' });
    if (ps && ps.next) acts.push({ href: '/paths/' + ps.p.id, icon: <Icon name="map" />, title: t('Next stop: {title}', { title: ps.next.title }), sub: ps.p.name + ' · ' + t('{n} of {total} done', { n: ps.done, total: ps.p.stops.length }), primary: !acts.length });
    if (!ie || !ie.placementDone) acts.push({ href: '/ielts', icon: EN, title: ie && ie.setupDone ? t('Take the IELTS placement test') : t('Set up your IELTS coach'), sub: t('About 2 h 50 min, with breaks'), primary: !acts.length });
    else acts.push({ href: '/ielts', icon: EN, title: t('Practise IELTS'), sub: t('Mock tests and your course') });
    if (!te || !te.placementDone) acts.push({ href: '/tef', icon: FRB, title: te && te.setupDone ? 'Passer le test de positionnement TEF' : 'Configurer votre coach TEF', sub: 'Environ 2 h 55, avec pauses', lang: 'fr' });
    else acts.push({ href: '/tef', icon: FRB, title: 'S’entraîner au TEF', sub: 'Tests blancs et parcours', lang: 'fr' });
    const pf = PV.profile(); const fd = PV.frenchCut();
    acts.push({ href: '/paths/score', icon: <Icon name="calc" />, title: pf ? t('Your CRS score: {n}', { n: PV.score() }) : t('Calculate your CRS score'), sub: fd ? t('Latest French draw: {crs} · CEC: {cec}', { crs: fd.crs, cec: (PV.cecCut() || { crs: '' }).crs }) : t('Express Entry points out of {max}', { max: fmtNum(1200) }) });
    if (!ps) acts.push({ href: '/paths', icon: <Icon name="map" />, title: t('Find your immigration path'), sub: t('{n} routes to PR as maps', { n: 11 }) });
    acts = acts.slice(0, 5);
  }
  const card = (ex: 'ielts' | 'tef', c: string, title: string, sub: string, note: string, xl?: string) => (
    <Link className="panel examcard" style={{ ['--c' as string]: c }} href={'/' + ex}>
      <div className="row between"><span className="tag">{title}</span><Badge text={ex === 'tef' ? 'FR' : 'EN'} color={c} /></div>
      <h2 lang={xl}>{sub}</h2>
      <div className="stack" style={{ gap: 6 }} id={'sum-' + ex}>{docs && (ex === 'ielts' ? docs.ie : docs.te) ? <Summary ex={ex} d={ex === 'ielts' ? docs.ie : docs.te} /> : <p className="muted small" lang={xl}>{note}</p>}</div>
      <div className="row">{app.ent[ex]?.paid ? <span className="pill good">{t('Included in your plan')}</span> : <span className="pill">{t('Free plan')}</span>}</div>
    </Link>
  );
  return (
    <Page>
      <div><p className="eyebrow">{fmtDay(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>{t('Welcome, {name}', { name: me.name.split(' ')[0] })}</h1></div>
      <section className="panel today" aria-labelledby="today-t">
        <h2 id="today-t">{t('Today')}</h2>
        <div id="today" className="actions">
          {docs ? acts.map((a, i) => <Action key={i} a={a} />) : <div className="row"><Spinner /><span className="muted small">{t('Loading your next steps…')}</span></div>}
        </div>
      </section>
      <div className="grid">{card('ielts', 'var(--ielts)', 'IELTS GENERAL TRAINING', t('English coach'), t('Band scores and CLB levels.'))}{card('tef', 'var(--tef)', 'TEF CANADA', 'Coach de français', 'Scores sur 699 et niveaux NCLC.', 'fr')}</div>
      <div id="home-path">{ps && (
        <Link className="panel pinned" href={'/paths/' + ps.p.id} style={{ ['--pc' as string]: ps.p.color }}>
          <p className="eyebrow">{t('Your immigration path')}</p><h2><Nm s={ps.p.name} /></h2>
          <MiniTrail p={ps.p} done={ps.done} />
          <p>{t('{n} of {total} stops done', { n: ps.done, total: ps.p.stops.length })}{ps.next ? <> · {tr('next: {title}', { title: <b>{ps.next.title}</b> })}</> : null}</p>
        </Link>
      )}</div>
      <InstallPanel />
      {p.plan === 'free' && <div className="panel flat"><div className="row between"><div><h3>{t('Unlock unlimited practice')}</h3><p className="muted small">{t('Unlimited mock tests, your personal course and studio voices for Listening.')}</p></div><Link className="btn primary" href="/plans">{t('See plans')}</Link></div></div>}
    </Page>
  );
}

function Summary({ ex, d }: { ex: 'ielts' | 'tef'; d: any }) {
  if (ex === 'ielts') {
    const b = d.bands || {};
    return <><p className="mono">L {b.L ?? '–'} · R {b.R ?? '–'} · W {b.W ?? '–'} · S {b.S ?? '–'}</p><p className="small muted">{d.placementDone ? t('Target CLB {n}', { n: d.clbTarget || 9 }) : t('Placement test not taken yet')}</p></>;
  }
  const sc = d.scores || {};
  return <><p className="mono">CO {sc.L ?? '–'} · CE {sc.R ?? '–'} · EE {sc.W ?? '–'} · EO {sc.S ?? '–'}</p><p className="small muted" lang="fr">{d.placementDone ? 'Objectif NCLC ' + (d.target || 7) : 'Test de positionnement à faire'}</p></>;
}

function InstallPanel() {
  const app = useApp();
  const [env, setEnv] = useState<{ standalone: boolean; ios: boolean } | null>(null);
  useEffect(() => { setEnv({ standalone: window.matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone, ios: /iphone|ipad|ipod/i.test(navigator.userAgent) }); }, []);
  if (!env || env.standalone) return null;
  if (app.installEvt) return <div className="panel flat"><div className="row between"><div><h3>{t('Install the app')}</h3><p className="muted small">{t('Open Prep Canada from your home screen, full screen, like any app.')}</p></div><button className="btn" data-sa="install" onClick={app.install}>{t('Install')}</button></div></div>;
  if (env.ios) return <div className="panel flat"><h3>{t('Install on iPhone')}</h3><p className="muted small">{t('In Safari, tap the Share button, then “Add to Home Screen”.')}</p></div>;
  return null;
}
