'use client';
// Pieces shared by the paths pages: loading, map width, the stop body, estimates, disclaimer.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import * as PV from '@/lib/client/paths-store';
import { fmtNum, t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import type { Path, Stop } from '@/lib/paths/types';
import { allAtLeast, estimate, lastCutLine, PATH_DRAWS } from '@/lib/shared/scoretools';

/** Loads the journey, levels, draws and the path text in the current language. */
export function usePathsData() {
  const app = useApp();
  PV.usePaths();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true; setReady(false);
    Promise.all([PV.load().catch(() => {}), PV.loadDraws()]).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [app.me?.id, app.lang]);
  return ready;
}

/** Width available for the map / charts, like the old mapWidth(). */
export function useMapWidth() {
  const [w, setW] = useState(360);
  useEffect(() => {
    const measure = () => { const a = document.getElementById('app'); return Math.max(300, Math.min(1180, (a ? a.clientWidth : 360) - 32)); };
    let last = measure(); setW(last);
    let tm: ReturnType<typeof setTimeout> | undefined;
    const on = () => { clearTimeout(tm); tm = setTimeout(() => { const W = measure(); if (Math.abs(W - last) >= 40) { last = W; setW(W); } }, 150); };
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('resize', on); clearTimeout(tm); };
  }, []);
  return w;
}

export function Disclaimer() {
  return <p className="small muted" style={{ maxWidth: '80ch' }}>{tr('This is general information, not legal advice. Programs, cut-offs and fees change often: always confirm on the official page linked at each stop before you act. If you hire help, use a licensed consultant (check the {link}) or a lawyer, and never pay anyone who promises a guaranteed visa or job.', { link: <a href={PV.LINKS.cicc} target="_blank" rel="noopener">{t('CICC public register')}</a> })}</p>;
}

export function MatchPill({ score }: { score: number }) {
  if (score >= 75) return <span className="pill good">{t('Strong match')}</span>;
  if (score >= 40) return <span className="pill warn">{t('Possible')}</span>;
  return <span className="pill">{t('Unlikely now')}</span>;
}

export const cutLine = (p: Path) => (PV.state.draws ? lastCutLine(p, PV.state.draws) : '');
/** The "Likely / Possible / Hard now" pill on a path card, or null when there is nothing to say. */
export function estPillInfo(p: Path): [string, string] | null {
  const pr = PV.profile(); const lv = PV.state.levels;
  if (!pr && !(lv && (lv.frDetail || lv.enDetail))) return null;
  const e = estimate(p, pr, PV.state.draws, lv);
  const map: Record<string, [string, string]> = { good: ['good', 'Likely'], close: ['warn', 'Possible'], far: ['bad', 'Hard now'], blocked: ['', 'Not eligible yet'] };
  return map[e.status] || null;
}
export function EstPill({ p }: { p: Path }) {
  const m = estPillInfo(p);
  return m ? <span className={'pill ' + m[0]}>{t(m[1])}</span> : null;
}

export function LangLine({ p }: { p: Path }) {
  if (!p.lang) return null;
  const lv = PV.state.levels || { fr: null, en: null };
  const mine = p.lang.exam === 'tef' ? lv.fr : lv.en;
  const unit = p.lang.exam === 'tef' ? 'NCLC' : 'CLB';
  return <><span>{p.lang.label}</span>{mine != null ? <> {mine >= p.lang.min ? <span className="pill good">{t('You: {unit} {n}', { unit, n: mine })}</span> : <span className="pill warn">{t('You: {unit} {n}, need {min}', { unit, n: mine, min: p.lang.min })}</span>}</> : null}</>;
}

/** "3 of 14 stops done · next: <b>…</b>" */
export function ProgressLine({ p, bold }: { p: Path; bold?: boolean }) {
  const d = PV.doneCount(p); const nx = PV.nextStop(p);
  return <>{tr('{n} of {total} stops done', { n: bold ? <b>{d}</b> : d, total: p.stops.length })} · {nx ? tr('next: {title}', { title: <b>{nx.title}</b> }) : t('all done')}</>;
}

export function StopBody({ p, s }: { p: Path; s: Stop }) {
  const { me } = useApp();
  const lv = PV.state.levels || { fr: null, en: null };
  let app = null;
  if (s.app) {
    const mine = s.app.exam === 'tef' ? lv.fr : lv.en; const unit = s.app.exam === 'tef' ? 'NCLC' : 'CLB';
    app = <div className="row small"><Link className="btn sm dark" href={s.app.go}>{s.app.label}</Link>
      {mine != null ? <span className={'pill ' + (mine >= s.app.min ? 'good' : 'warn')}>{mine >= s.app.min ? t('Your latest level: {unit} {n}', { unit, n: mine }) : t('Your latest level: {unit} {n} (target {min})', { unit, n: mine, min: s.app.min })}</span>
        : (me ? <span className="muted">{t('Take the placement test to see your level here.')}</span> : null)}</div>;
  }
  return <>
    <div className="row" style={{ gap: 8 }}><span className="chip">⏱ {s.time}</span><span className="chip">{s.cost}</span>{s.optional ? <span className="chip">{t('Optional')}</span> : null}</div>
    {s.why ? <p>{s.why}</p> : null}
    {s.steps && s.steps.length ? <ol className="steps">{s.steps.map((x, i) => <li key={i}>{x}</li>)}</ol> : null}
    {s.docs && s.docs.length ? <div className="row small" style={{ gap: 6 }}><span className="muted">{t('Documents:')}</span>{s.docs.map((x, i) => <span key={i} className="pill">{x}</span>)}</div> : null}
    {s.tunisia ? <p className="tn small" style={{ ['--pc' as string]: p.color }}><b>{t('From Tunisia:')}</b> {s.tunisia}</p> : null}
    {app}
    <p className="small"><a href={s.link} target="_blank" rel="noopener">{t('Official page')} ↗</a></p>
  </>;
}

export function EstimateBox({ p }: { p: Path }) {
  const { me } = useApp();
  const prof = PV.profile(); const draws = PV.state.draws;
  const e = estimate(p, prof, draws, PV.state.levels);
  const icon = { good: '●', close: '◐', far: '○', blocked: '✗', info: 'ℹ' }[e.status];
  const cls = { good: 'good', close: 'warn', far: 'bad', blocked: 'bad', info: '' }[e.status];
  const many = !!e.cost && e.cost.people > 1;
  const cut = draws ? lastCutLine(p, draws) : '';
  const drawsHref = '/paths/draws' + (PATH_DRAWS[p.id] ? '?c=' + PATH_DRAWS[p.id] : p.id === 'quebec' ? '?g=quebec' : '');
  return (
    <div className="panel estimate" id="estimate">
      <div className="row between"><h3>{t('Your estimate')}</h3>{e.score != null ? <Link className="pill ink" href="/paths/score">{t('CRS {score} · edit', { score: e.score })}</Link> : <Link className="btn sm" href="/paths/score">{t('Calculate my score')}</Link>}</div>
      {e.title ? <p className="est-title"><span className={'pill ' + cls}>{icon}</span> <b>{e.title}</b></p> : null}
      {e.lines.length ? <ul className="small est-lines">{e.lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
      <div className="est-grid">
        <div><b className="small">{t('Timeline')}</b>
          <p className="small">{prof && p.lang && p.lang.exam === 'tef' && !allAtLeast(prof.fr, p.lang.min) ? t('{time}, plus 2–6 months to reach NCLC {n}', { time: p.time, n: p.lang.min }) : p.time}</p>
          {cut ? <p className="small"><b>{t('Latest invitations:')}</b> {cut} · <Link href={drawsHref}>{t('see rounds')}</Link></p> : null}
        </div>
        {e.cost ? (
          <div className="est-cost"><b className="small">{many ? t('Official fees for {n} people', { n: e.cost.people }) : t('Official fees for 1 person')}</b>
            <div className="cbreak">{e.cost.items.map(([l, v]) => <div key={l} className="crow small"><span>{t(l)}</span><span className="mono">{fmtNum(v)}</span></div>)}<div className="crow"><b>{t('Total, about')}</b><b className="mono">CAD {fmtNum(e.cost.total)}</b></div></div>
            {e.cost.funds ? <p className="small muted">{many ? t('Plus proof of funds: CAD {amount} for {n} people (not spent, but it must be in your account).', { amount: fmtNum(e.cost.funds), n: e.cost.people }) : t('Plus proof of funds: CAD {amount} for 1 person (not spent, but it must be in your account).', { amount: fmtNum(e.cost.funds) })}</p> : null}
          </div>
        ) : null}
      </div>
      {prof && !me ? <p className="small muted">{tr('Saved on this device. {link} to keep it.', { link: <Link href="/signup">{t('Create an account')}</Link> })}</p> : null}
    </div>
  );
}
