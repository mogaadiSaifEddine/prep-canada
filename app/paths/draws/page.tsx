'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Page } from '@/components/app/Page';
import { ArrBack, ArrFwd, Loading } from '@/components/app/ui';
import { useMapWidth, usePathsData } from '@/components/paths/common';
import * as PV from '@/lib/client/paths-store';
import { fmtDay, fmtNum, t, tk } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import { CAT_COLOR, CAT_LABEL, recent, SHORT } from '@/lib/shared/scoretools';
import type { Draws, EERound } from '@/lib/shared/types';

export default function DrawsPage() { return <Suspense><DrawsRoute /></Suspense>; }

function DrawsRoute() {
  const ready = usePathsData();
  return <Page>{ready ? <DrawsView /> : <Loading />}</Page>;
}

// Chosen category and tab survive moving between pages, like the old app.
const memo = { cat: 'french', group: 'ee' };

function DrawsView() {
  const q = useSearchParams();
  const [cat, setCat] = useState(memo.cat);
  const [group, setGroup] = useState(memo.group);
  useEffect(() => {
    const c = q.get('c'), g = q.get('g');
    if (c) { setCat(c); setGroup('ee'); memo.cat = c; memo.group = 'ee'; }
    if (g) { setGroup(g); memo.group = g; }
  }, [q]);
  const width = useMapWidth() - 40;
  const draws = PV.state.draws;
  const you = PV.score();
  const pick = (c: string) => { setCat(c); memo.cat = c; };
  const pickG = (g: string) => { setGroup(g); memo.group = g; };
  if (!draws) return <div className="panel"><p>{t('Could not load the invitation rounds. Check your connection and try again.')}</p></div>;
  const tabs: [string, string][] = [['ee', tk('Express Entry')], ['quebec', tk('Québec (Arrima)')], ['provinces', tk('Provinces')]];
  return <>
    <div><Link className="btn sm ghost" href="/paths"><ArrBack />{t('All paths')}</Link></div>
    <div><p className="eyebrow">{t('Invitation rounds')}</p><h1>{t('Latest draws and lowest scores')}</h1>
      <p className="muted" style={{ maxWidth: '70ch' }}>{t('Who was invited, how many, and the lowest score that got an invitation.')}{' '}
        {draws.live ? <><span className="pill good">{t('Live from IRCC')}</span> {t('Express Entry updated {date}.', { date: fmtDay(draws.ee.rounds[0].date) })}</> : t('Express Entry as of {date}.', { date: fmtDay(draws.ee.rounds[0].date) })}{' '}
        {t('Québec and provinces checked {date}.', { date: fmtDay(draws.checked) })}</p>
    </div>
    <div className="seg" role="tablist">{tabs.map(([k, l]) => <button key={k} type="button" role="tab" data-sa="draws-group" data-g={k} aria-pressed={group === k} onClick={() => pickG(k)}>{t(l)}</button>)}</div>
    {group === 'ee' ? <EE draws={draws} cat={cat} pick={pick} you={you} width={width} /> : group === 'quebec' ? <Quebec draws={draws} /> : <Provinces draws={draws} />}
    <p className="small muted" style={{ maxWidth: '80ch' }}>{t('Past cut-offs do not guarantee future ones: each round\'s minimum depends on how many people IRCC invites and who is in the pool that day.')}</p>
  </>;
}

const catName = (k: string) => (CAT_LABEL[k] ? t(CAT_LABEL[k]) : k);
function EE({ draws, cat, pick, you, width: W }: { draws: Draws; cat: string; pick: (c: string) => void; you: number | null; width: number }) {
  const cats = [...new Set(draws.ee.rounds.map((r) => r.cat))];
  const order = ['french', 'cec', 'pnp', 'health', 'trades', 'transport', 'stem', 'education', 'agri', 'senior', 'physicians', 'military', 'fsw', 'general', 'other'].filter((c) => cats.includes(c));
  const c = order.includes(cat) ? cat : order[0];
  const rs = draws.ee.rounds.filter((r) => r.cat === c);
  const rec = recent(draws, c);
  const calc = <Link href="/paths/score">{t('calculator')}</Link>;
  return <>
    <div className="row chips" role="group" aria-label={t('Category')}>
      {order.map((k) => <button key={k} type="button" className={'fchip' + (k === c ? ' on' : '')} data-sa="draws-cat" data-c={k} aria-pressed={k === c} onClick={() => pick(k)}><i style={{ background: CAT_COLOR[k] || 'var(--hue-slate)' }} />{catName(k)}</button>)}
    </div>
    <div className="panel">
      <div className="row between"><div><h2>{catName(c)}</h2><p className="small muted">{t('Lowest CRS score invited, each round')}{rec ? ' · ' + t('last 6 months: {rounds} rounds, {n} invitations', { rounds: rec.count, n: fmtNum(rec.itas) }) : ''}</p></div>
        {rec ? <div className="kstat"><span className="eyebrow">{t('Latest')}</span><b className="mono">{rec.last.crs}</b><span className="small muted">{fmtDay(rec.last.date)}</span></div> : null}
      </div>
      <TrendChart rounds={rs.slice(0, W < 500 ? 14 : 24)} width={W} color={CAT_COLOR[c]} you={you} title={t('Lowest score per {category} round', { category: catName(c) })} />
      {you != null ? <p className="small">{c === 'pnp' ? tr('Dashed line: your score from the {link} (a nomination adds 600).', { link: calc }) : tr('Dashed line: your score from the {link}.', { link: calc })}</p>
        : <p className="small">{tr('{link} to see it on the chart.', { link: <Link href="/paths/score">{t('Calculate your score')}</Link> })}</p>}
      <div className="tablewrap"><table className="dtable"><thead><tr><th>{t('Date')}</th><th>{t('Round')}</th><th className="num">{t('Invitations')}</th><th className="num">{t('Lowest score')}</th>{you != null ? <th>{t('You')}</th> : null}</tr></thead><tbody>
        {rs.slice(0, 16).map((r) => { const mine = c === 'pnp' ? you! + 600 : you!; return (
          <tr key={r.n}><td>{fmtDay(r.date)}</td><td className="mono">#{r.n}</td><td className="num mono">{fmtNum(r.itas)}</td><td className="num mono"><b>{r.crs}</b></td>
            {you != null ? <td>{mine >= r.crs ? <span className="pill good">{t('Above')}</span> : <span className="pill">{t('{n} short', { n: r.crs - mine })}</span>}</td> : null}</tr>
        ); })}
      </tbody></table></div>
      {draws.ee.note ? <p className="small muted">{t(draws.ee.note)}</p> : null}
      <p className="small"><a href={draws.ee.source} target="_blank" rel="noopener">{t('IRCC: all rounds of invitations')} ↗</a></p>
    </div>
    <div className="panel"><h3>{t('Last 10 Express Entry rounds, all categories')}</h3>
      <div className="tablewrap"><table className="dtable"><thead><tr><th>{t('Date')}</th><th>{t('Category')}</th><th className="num">{t('Invitations')}</th><th className="num">{t('Lowest score')}</th></tr></thead><tbody>
        {draws.ee.rounds.slice(0, 10).map((r) => <tr key={r.n}><td>{fmtDay(r.date)}</td><td><span className="cdot" style={{ background: CAT_COLOR[r.cat] || 'var(--hue-slate)' }} />{CAT_LABEL[r.cat] ? t(CAT_LABEL[r.cat]) : r.name}</td><td className="num mono">{fmtNum(r.itas)}</td><td className="num mono"><b>{r.crs}</b></td></tr>)}
      </tbody></table></div>
    </div>
  </>;
}

function Quebec({ draws }: { draws: Draws }) {
  const qd = draws.quebec;
  return (
    <div className="panel"><h2>{t('Québec skilled workers (PSTQ)')}</h2><p className="small muted">{t(qd.note)}</p>
      <div className="tablewrap"><table className="dtable"><thead><tr><th>{t('Date')}</th><th>{t('Stream')}</th><th>{t('Group')}</th><th className="num">{t('Invitations')}</th><th className="num">{t('Lowest score')}</th></tr></thead><tbody>
        {qd.rounds.flatMap((r, ri) => r.groups.map((g, i) => (
          <tr key={ri + '-' + i} className={i ? 'sub' : undefined}><td>{i ? '' : fmtDay(r.date)}</td><td>{i ? '' : t('Stream {n}', { n: r.stream })}</td><td>{t(g[0])}</td><td className="num mono">{g[1] != null ? fmtNum(g[1]) : '—'}</td><td className="num mono"><b>{g[2] != null ? g[2] : '—'}</b></td></tr>
        )))}
      </tbody></table></div>
      <p className="small">{t('Stream 1 needs French NCLC 7 oral and 5 written; stream 2 needs NCLC 5 oral.')} <a href={qd.source} target="_blank" rel="noopener">{t('Québec: invitations in Arrima')} ↗</a></p>
    </div>
  );
}

function Provinces({ draws }: { draws: Draws }) {
  const pd = draws.provinces;
  return (
    <div className="panel"><h2>{t('Provincial rounds')}</h2><p className="small muted">{t(pd.note)}</p>
      <div className="tablewrap"><table className="dtable"><thead><tr><th>{t('Date')}</th><th>{t('Province')}</th><th>{t('Stream')}</th><th className="num">{t('Invitations')}</th><th className="num">{t('Lowest score')}</th></tr></thead><tbody>
        {pd.rounds.map((r, i) => <tr key={i}><td>{fmtDay(r.date)}</td><td><b>{r.prov}</b></td><td>{t(r.stream)}{r.fr ? <> <span className="pill accent">{t('Francophone')}</span></> : null}</td><td className="num mono">{r.itas != null ? fmtNum(r.itas) : '—'}</td><td className="num mono">{r.min != null ? <b>{r.min}</b> : <span className="muted">{t('not published')}</span>}</td></tr>)}
      </tbody></table></div>
      {pd.news && pd.news.length ? <ul className="small" style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{pd.news.map((n, i) => <li key={i}>{t(n)}</li>)}</ul> : null}
      <p className="small">{tr('Express Entry rounds for provincial nominees are under {where}.', { where: <>{t('Express Entry')} <ArrFwd /> {t('Provincial nominees')}</> })}</p>
    </div>
  );
}

/* trend chart: lowest CRS per round for one category */
function TrendChart({ rounds, color = 'var(--hue-blue)', you = null, title = '', width = 640 }: { rounds: EERound[]; color?: string; you?: number | null; title?: string; width?: number }) {
  const rs = rounds.slice().reverse(); if (rs.length < 2) return null;
  const W = Math.max(300, Math.min(760, width)), H = W < 500 ? 200 : 230, pl = 44, pr = 16, pt = 18, pb = 30;
  const vals = rs.map((r) => r.crs).concat(you != null ? [you] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(8, (hi - lo) * 0.12); lo = Math.floor((lo - pad) / 10) * 10; hi = Math.ceil((hi + pad) / 10) * 10;
  const t0 = new Date(rs[0].date).getTime(), t1 = new Date(rs[rs.length - 1].date).getTime();
  const x = (d: string) => pl + (W - pl - pr) * ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0));
  const y = (v: number) => pt + (H - pt - pb) * (1 - (v - lo) / Math.max(1, hi - lo));
  const step = (hi - lo) > 120 ? 50 : (hi - lo) > 50 ? 20 : 10;
  const grid = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(<g key={v}><line x1={pl} x2={W - pr} y1={y(v).toFixed(1)} y2={y(v).toFixed(1)} className="tgrid" /><text x={pl - 8} y={(y(v) + 4).toFixed(1)} className="tax" textAnchor="end">{v}</text></g>);
  // month ticks
  const m = new Date(rs[0].date); m.setUTCDate(1); m.setUTCMonth(m.getUTCMonth() + 1);
  const ticks = [];
  while (m.getTime() <= t1) { const xx = x(m.toISOString().slice(0, 10)); ticks.push(<text key={m.getTime()} x={xx.toFixed(1)} y={H - 8} className="tax" textAnchor="middle">{fmtDay(m, { month: 'short' })}</text>); m.setUTCMonth(m.getUTCMonth() + 1); }
  const d = rs.map((r, i) => (i ? 'L' : 'M') + x(r.date).toFixed(1) + ' ' + y(r.crs).toFixed(1)).join(' ');
  const last = rs[rs.length - 1];
  return (
    <figure className="trend"><svg viewBox={'0 0 ' + W + ' ' + H} style={{ direction: 'ltr' }} role="group" aria-label={title || t('Lowest score per round')}>
      {grid}{ticks}
      {you != null ? <><line x1={pl} x2={W - pr} y1={y(you).toFixed(1)} y2={y(you).toFixed(1)} className="tyou" /><text x={pl + 6} y={(y(you) - 6).toFixed(1)} className="tyoul" textAnchor="start">{t('You: {score}', { score: you })}</text></> : null}
      <path d={d} className="tline" style={{ stroke: color }} />
      <text x={(x(last.date) - 8).toFixed(1)} y={(y(last.crs) - 10).toFixed(1)} textAnchor="end" className="tlast">{last.crs}</text>
      {rs.map((r) => {
        const cx = x(r.date), cy = y(r.crs); const tx = Math.min(W - pr - 70, Math.max(pl + 70, cx)); const above = cy > pt + 44;
        return (
          <g key={r.n} className="tpt" tabIndex={0} role="img" aria-label={t('{date}: lowest score {score}, {n} invitations', { date: fmtDay(r.date), score: r.crs, n: fmtNum(r.itas) })}>
            <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="14" className="thit" /><circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="4.5" className="tdot" style={{ fill: color }} />
            <g className="ttip"><rect x={tx - 68} y={above ? cy - 50 : cy + 12} width="136" height="38" rx="6" /><text x={tx} y={above ? cy - 34 : cy + 28} textAnchor="middle" className="ttip1">{r.crs} · {fmtDay(r.date, SHORT)}</text><text x={tx} y={above ? cy - 19 : cy + 43} textAnchor="middle" className="ttip2">{t('{n} invitations', { n: fmtNum(r.itas) })}</text></g>
          </g>
        );
      })}
    </svg></figure>
  );
}
