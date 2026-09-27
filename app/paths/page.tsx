'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { Loading, Nm } from '@/components/app/ui';
import { MiniTrail } from '@/components/paths/PathMap';
import { cutLine, Disclaimer, EstPill, estPillInfo, MatchPill, ProgressLine, usePathsData } from '@/components/paths/common';
import * as PV from '@/lib/client/paths-store';
import { t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import { recent } from '@/lib/shared/scoretools';

export default function PathsPage() {
  const ready = usePathsData();
  return <Page>{ready ? <PathsList /> : <Loading />}</Page>;
}

function PathsList() {
  const { me } = useApp();
  const grid = useRef<HTMLDivElement>(null);
  const f = PV.state.finder;
  const ranked = f ? PV.rank(f) : null;
  const all = PV.P().PATHS;
  const order = ranked ? ranked.map((r) => all.find((p) => p.id === r.id)).filter((p): p is NonNullable<typeof p> => !!p) : all;
  const why = (id: string) => ranked && ranked.find((r) => r.id === id);
  const pinned = PV.findPath(PV.journey().pinned);
  return <>
    <div><p className="eyebrow">{t('Immigration paths')}</p><h1>{t('Your road to Canada')}</h1><p className="muted" style={{ maxWidth: '66ch' }}>{t('Every route to permanent residence as a map of stops: what to do, which documents, how long, what it costs, with tips for applicants from Tunisia. Checked against official sources on {date}.', { date: PV.P().CHECKED })}</p></div>
    {pinned && <Link className="panel pinned" href={'/paths/' + pinned.id} style={{ ['--pc' as string]: pinned.color }}><p className="eyebrow">{t('Your path')}</p><h2><Nm s={pinned.name} /></h2><p><ProgressLine p={pinned} /></p></Link>}
    <Tools />
    <FinderForm onDone={() => setTimeout(() => grid.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)} />
    <div className="pathgrid" ref={grid}>
      {order.map((p) => {
        const d = PV.doneCount(p); const r = why(p.id); const cut = cutLine(p);
        return (
          <Link key={p.id} className="panel pathcard" href={'/paths/' + p.id} style={{ ['--pc' as string]: p.color }}>
            <div className="row between"><span className="tag">{p.tag}</span>{r ? <MatchPill score={r.score} /> : null}</div>
            <h3><Nm s={p.name} /></h3><p className="small muted">{p.summary}</p>
            {r ? <p className="small"><b>{t('For you:')}</b> {r.why}</p> : null}
            <MiniTrail p={p} done={d} />
            <div className="row small muted" style={{ gap: 14 }}><span>{t('{n} stops', { n: p.stops.length })}</span><span>{p.time}</span>{d ? <span><b>{t('{done}/{total} done', { done: d, total: p.stops.length })}</b></span> : null}</div>
            {cut ? <div className="cutline small"><span className="mono">{cut}</span><EstPill p={p} /></div> : estPillInfo(p) ? <div className="cutline small"><EstPill p={p} /></div> : null}
          </Link>
        );
      })}
    </div>
    <div className="panel flat"><h3>{t('Paused programs')}</h3><ul style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{PV.P().PAUSED.map((x) => <li key={x.name}><b>{x.name}.</b> {x.note} <a href={x.link} target="_blank" rel="noopener">{t('Official page')}</a></li>)}</ul></div>
    <Disclaimer />
    {me ? null : <p className="small muted">{tr('Your progress is saved on this device. {link} to keep it on all your devices.', { link: <Link href="/signup">{t('Create a free account')}</Link> })}</p>}
  </>;
}

function Tools() {
  const score = PV.score();
  const d = PV.state.draws; const fr = d ? recent(d, 'french') : null; const cec = d ? recent(d, 'cec') : null;
  return (
    <div className="tools">
      <Link className="panel tool" href="/paths/score">
        <span className="tool-ic" aria-hidden="true">{score != null ? <b className="mono">{score}</b> : <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4" /></svg>}</span>
        <span><b>{score != null ? t('Your CRS score') : t('Score calculator')}</b><br /><span className="small muted">{score != null ? t('Edit your profile, see what raises it') : t('CRS out of 1,200 and the FSW 67 grid, in 2 minutes')}</span></span>
      </Link>
      <Link className="panel tool" href="/paths/draws">
        <span className="tool-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 20h18M5 16l4-5 4 3 6-8" /></svg></span>
        <span><b>{t('Latest draws')}</b><br /><span className="small muted">{fr && cec ? t('French {fr} · CEC {cec} · lowest scores per round', { fr: fr.last.crs, cec: cec.last.crs }) : t('Lowest score invited, per round and path')}</span></span>
      </Link>
    </div>
  );
}

function FinderForm({ onDone }: { onDone: () => void }) {
  const st = PV.state;
  const [f, setF] = useState<PV.Finder>(() => st.finder || PV.finderDefaults());
  const [open, setOpen] = useState(!st.finder);
  const lv = st.levels;
  const submit = (e: FormEvent) => { e.preventDefault(); PV.setFinder({ ...f }); setOpen(false); onDone(); };
  return (
    <details className="panel" id="finder" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary><b>{t('Find my path')}</b> <span className="small muted">· {lv && (lv.fr != null || lv.en != null) ? t('8 quick questions, with your language levels from the app') : t('8 quick questions')}</span></summary>
      <form id="f-finder" className="stack" style={{ marginTop: 12 }} onSubmit={submit}>
        {PV.Q.map(([k, label, opts]) => (
          <div key={k} className="stack" style={{ gap: 6 }}><span className="small muted">{t(label)}</span>
            <div className="opts">{opts.map(([v, l]) => <label key={v} className="opt"><input type="radio" name={'fq-' + k} value={v} checked={f[k] === v} onChange={() => setF({ ...f, [k]: v })} /><span>{t(l)}</span></label>)}</div>
          </div>
        ))}
        <div className="row"><button className="btn primary" type="submit">{t('Show my best paths')}</button>{st.finder ? <button className="btn" type="button" data-sa="finder-clear" onClick={() => { PV.setFinder(null); setF(PV.finderDefaults()); setOpen(true); }}>{t('Clear')}</button> : null}</div>
      </form>
    </details>
  );
}
