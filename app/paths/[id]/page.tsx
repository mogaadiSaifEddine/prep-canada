'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { ArrBack, ArrFwd, Loading, Nm } from '@/components/app/ui';
import { PathMap } from '@/components/paths/PathMap';
import { cutLine, Disclaimer, EstimateBox, LangLine, ProgressLine, StopBody, useMapWidth, usePathsData } from '@/components/paths/common';
import * as PV from '@/lib/client/paths-store';
import { isRTL, t } from '@/lib/i18n';
import type { Path, Stop } from '@/lib/paths/types';
import { estimate } from '@/lib/shared/scoretools';

export default function PathPage() {
  const ready = usePathsData();
  const { id } = useParams<{ id: string }>();
  return <Page>{ready ? <Detail id={id} /> : <Loading />}</Page>;
}

function Detail({ id }: { id: string }) {
  const app = useApp();
  const p = PV.findPath(id);
  const width = useMapWidth();
  const [openStop, setOpenStop] = useState<string | null>(null);
  const view = PV.state.view;
  const scrolled = useRef(false);

  // List view: bring the next stop into view when there is progress
  useEffect(() => {
    if (!p || view !== 'list' || scrolled.current) return;
    scrolled.current = true;
    const nx = PV.nextStop(p);
    if (nx && PV.journey().progress[p.id] && Object.keys(PV.journey().progress[p.id]).length) setTimeout(() => document.getElementById('stop-' + nx.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }, [p, view]);

  const jump = useCallback((sid: string) => {
    const el = document.getElementById('stop-' + sid); if (!el) return;
    const d = el.querySelector('details'); if (d) d.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (!p) return <div className="panel"><p>{t('Path not found.')} <Link href="/paths">{t('All paths')}</Link></p></div>;
  const prog = PV.journey().progress[p.id] || {};
  const d = PV.doneCount(p); const nx = PV.nextStop(p);
  const pct = Math.round(100 * d / p.stops.length);
  const isPinned = PV.journey().pinned === p.id;

  const toggle = (sid: string, fromDrawer: boolean) => {
    const y = window.scrollY;
    const nowDone = PV.toggleStop(p.id, sid);
    requestAnimationFrame(() => window.scrollTo(0, y));
    if (fromDrawer) {
      const i = p.stops.findIndex((x) => x.id === sid);
      if (nowDone && p.stops[i + 1]) { app.toast(t('Stop {n} done.', { n: i + 1 })); setOpenStop(p.stops[i + 1].id); }
    } else setTimeout(() => document.getElementById('stop-' + sid)?.scrollIntoView({ block: 'nearest' }), 0);
  };
  const openNext = () => { if (!nx) return; if (view === 'list') jump(nx.id); else setOpenStop(nx.id); };

  const e = estimate(p, PV.profile(), PV.state.draws, PV.state.levels); const cut = cutLine(p);
  const ecls = { good: 'good', close: 'warn', far: 'bad', blocked: 'bad', info: '' }[e.status] || '';
  return <>
    <div className="row between">
      <Link className="btn sm ghost" href="/paths"><ArrBack />{t('All paths')}</Link>
      <div className="seg" role="group" aria-label={t('View')}>
        <button type="button" data-sa="path-view" data-v="map" aria-pressed={view === 'map'} onClick={() => { setOpenStop(null); PV.setView('map'); }}>{t('Map')}</button>
        <button type="button" data-sa="path-view" data-v="list" aria-pressed={view === 'list'} onClick={() => { setOpenStop(null); PV.setView('list'); }}>{t('List')}</button>
      </div>
    </div>
    <div className="panel pathhead" style={{ ['--pc' as string]: p.color }}>
      <p className="eyebrow">{p.tag}</p><h1><Nm s={p.name} /></h1><p className="muted" style={{ maxWidth: '70ch' }}>{p.summary}</p>
      <div className="row" style={{ gap: 8 }}><span className="chip">⏱ {p.time}</span><span className="chip">{p.cost}</span>{p.lang ? <span className="chip"><LangLine p={p} /></span> : null}</div>
      <div className="stack" style={{ gap: 6 }}><div className="row between small"><span><ProgressLine p={p} bold /></span><span className="mono">{pct}%</span></div><div className="meter"><i style={{ width: pct + '%', background: p.color }} /></div></div>
      {e.title || cut ? <button type="button" className="esthead" data-sa="to-estimate" onClick={() => document.getElementById('estimate')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{e.title ? <span className={'pill ' + ecls}>{e.title}</span> : null}{cut ? <span className="small mono">{cut}</span> : null}<span className="small">{t('Your estimate')} ↓</span></button> : null}
      <div className="row">
        {nx ? <button className="btn primary" data-sa="open-stop" data-stop={nx.id} style={{ background: p.color, borderColor: p.color }} onClick={openNext}>{t('Open next stop')}</button> : null}
        {app.me ? <button className="btn" data-sa="pin-path" data-path={p.id} onClick={() => PV.togglePin(p.id)}>{isPinned ? t('My path') + ' ✓' : t('Make this my path')}</button> : <Link className="btn" href="/signup">{t('Keep it in an account')}</Link>}
      </div>
      <details className="about"><summary>{t('Who it\'s for and what\'s new in 2026')}</summary>
        <div className="grid" style={{ marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          <div><b className="small">{t('Who it\'s for')}</b><ul className="small" style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>{p.who.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          {p.facts && p.facts.length ? <div><b className="small">{t('Good to know in 2026')}</b><ul className="small" style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>{p.facts.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
        </div>
      </details>
    </div>
    {view === 'map' ? <>
      <div className="mapwrap" id="mapwrap" style={{ ['--pc' as string]: p.color }}><PathMap p={p} progress={prog} width={width} currentId={nx && nx.id} hereLabel={d ? t('Next stop') : t('Start here')} onOpenStop={setOpenStop} /></div>
      <p className="small muted">{t('Tap a pin to see what to do at that stop and mark it done.')}</p>
    </> : (
      <ol className="route" style={{ ['--pc' as string]: p.color }}>
        {p.stops.map((s, i) => <RouteStop key={s.id} p={p} s={s} i={i} done={!!prog[s.id]} current={!!nx && nx.id === s.id} onToggle={() => toggle(s.id, false)} />)}
        <li className="stop finish"><span className="dot">🍁</span><div className="stopbody"><span className="stoptitle">{t('Permanent resident')}</span></div></li>
      </ol>
    )}
    <EstimateBox p={p} />
    <Disclaimer />
    <StopDrawer p={p} sid={openStop} onOpen={setOpenStop} onClose={() => setOpenStop(null)} onToggle={(sid) => toggle(sid, true)} />
  </>;
}

function RouteStop({ p, s, i, done, current, onToggle }: { p: Path; s: Stop; i: number; done: boolean; current: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (current && ref.current) ref.current.open = true; }, [current]);
  return (
    <li className={'stop' + (done ? ' done' : '') + (current ? ' current' : '') + (s.optional ? ' optional' : '')} id={'stop-' + s.id}>
      <button className="dot" data-sa="stop-toggle" data-path={p.id} data-stop={s.id} aria-pressed={done} aria-label={done ? t('Mark not done: {title}', { title: s.title }) : t('Mark done: {title}', { title: s.title })} onClick={onToggle}>{done ? '✓' : i + 1}</button>
      <details className="stopbody" ref={ref}>
        <summary><span className="stoptitle"><Nm s={s.title} />{current ? <> <span className="pill accentp">{t('Next stop')}</span></> : null}</span></summary>
        <div className="stack" style={{ gap: 10, marginTop: 10 }}>
          <StopBody p={p} s={s} />
          <div className="row"><button className={'btn sm' + (done ? '' : ' primary')} data-sa="stop-toggle" data-path={p.id} data-stop={s.id} onClick={onToggle}>{done ? t('Mark as not done') : t('Mark as done')}</button></div>
        </div>
      </details>
    </li>
  );
}

/* stop drawer: side panel on desktop, bottom sheet on phones */
function StopDrawer({ p, sid, onOpen, onClose, onToggle }: { p: Path; sid: string | null; onOpen: (id: string) => void; onClose: () => void; onToggle: (sid: string) => void }) {
  const [shown, setShown] = useState<string | null>(sid); // stays set while the closing animation runs
  const [open, setOpen] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (sid) { setShown(sid); const r = requestAnimationFrame(() => setOpen(true)); return () => cancelAnimationFrame(r); }
    setOpen(false); const tm = setTimeout(() => setShown(null), 250); return () => clearTimeout(tm);
  }, [sid]);
  useEffect(() => { if (open) closeBtn.current?.focus({ preventScroll: true }); }, [open, shown]);
  useEffect(() => {
    if (!sid) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = p.stops.findIndex((s) => s.id === sid);
        const fwd = isRTL() ? 'ArrowLeft' : 'ArrowRight'; // "next" follows the reading direction
        const j = i + (e.key === fwd ? 1 : -1); if (p.stops[j]) onOpen(p.stops[j].id);
      }
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [sid, p, onClose, onOpen]);

  const i = shown ? p.stops.findIndex((s) => s.id === shown) : -1;
  const s = i >= 0 ? p.stops[i] : null;
  const done = !!s && !!(PV.journey().progress[p.id] || {})[s.id];
  return (
    <div id="stopdrawer" className={open && s ? 'open' : ''}>
      {s ? <>
        <div className="dr-backdrop" data-sa="close-stop" onClick={onClose} />
        <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title" style={{ ['--pc' as string]: p.color }}>
          <div className="dr-grip" aria-hidden="true" />
          <div className="dr-head"><span className={'dr-num' + (done ? ' done' : '')}>{done ? '✓' : i + 1}</span><div style={{ minWidth: 0 }}><p className="eyebrow">{t('Stop {n} of {total}', { n: i + 1, total: p.stops.length })}</p><h2 id="dr-title"><Nm s={s.title} /></h2></div><button ref={closeBtn} className="btn sm ghost dr-x" data-sa="close-stop" aria-label={t('Close')} onClick={onClose}>✕</button></div>
          <div className="dr-body stack" style={{ gap: 12 }}><StopBody p={p} s={s} /></div>
          <div className="dr-foot">
            <button className="btn" data-sa="open-stop" data-stop={(p.stops[i - 1] || s).id} disabled={!i} aria-label={t('Previous stop')} onClick={() => p.stops[i - 1] && onOpen(p.stops[i - 1].id)}><ArrBack /></button>
            <button className={'btn ' + (done ? '' : 'primary') + ' grow'} data-sa="stop-toggle" data-path={p.id} data-stop={s.id} style={done ? undefined : { background: p.color, borderColor: p.color }} onClick={() => onToggle(s.id)}>{done ? t('Done ✓ · undo') : t('Mark as done')}</button>
            <button className="btn" data-sa="open-stop" data-stop={(p.stops[i + 1] || s).id} disabled={i >= p.stops.length - 1} aria-label={t('Next stop')} onClick={() => p.stops[i + 1] && onOpen(p.stops[i + 1].id)}><ArrFwd /></button>
          </div>
        </aside>
      </> : null}
    </div>
  );
}
