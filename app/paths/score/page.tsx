'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { ArrBack, ArrFwd, Loading } from '@/components/app/ui';
import { usePathsData } from '@/components/paths/common';
import * as PV from '@/lib/client/paths-store';
import { fmtDay, fmtNum, t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import { boosts, crs, EDU, fsw, IELTS_CLB, poolAbove, TEF_NCLC, type CrsProfile, type LevelTable, type Levels } from '@/lib/shared/crs';
import { allAtLeast, CAT_LABEL, defaultProfile, fillFromTests, OCC, PSKN, recent, SHORT, SK, SKN, verdict } from '@/lib/shared/scoretools';
import type { Draws } from '@/lib/shared/types';

export default function ScorePage() {
  const ready = usePathsData();
  return <Page>{ready ? <Calculator /> : <Loading />}</Page>;
}

const tl = (opts: [string | number, string][]): [string | number, string][] => opts.map(([v, l]) => [v, t(l)]); // translate a tk() option table

function Calculator() {
  const app = useApp(); const signedIn = !!app.me;
  const levels = PV.state.levels; const draws = PV.state.draws;
  const [p, setP] = useState<CrsProfile>(() => PV.profile() || defaultProfile(levels));
  // A newer profile arrives when the account data loads after the first render
  useEffect(() => { const x = PV.profile(); if (x) { setP(x); setAgeText(String(x.age)); } }, [app.me?.id]);
  // The age box keeps what is typed; the profile gets the clamped number (16–70).
  const [ageText, setAgeText] = useState(() => String(p.age));
  const update = (patch: Partial<CrsProfile>) => { const next = { ...p, ...patch }; setP(next); PV.setProfile(next); };
  const setLang = (key: 'en' | 'fr', k: keyof Levels, v: number) => update({ [key]: { ...p[key], [k]: v } } as Partial<CrsProfile>);
  const hasTests = !!levels && !!(levels.enDetail || levels.frDetail);
  const years = (max: number): [number, string][] => Array.from({ length: max + 1 }, (_, i) => [i, i === 0 ? t('None or less than 1 year') : i === max ? t('{n}+ years', { n: i }) : i === 1 ? t('1 year') : t('{n} years', { n: i })]);
  const total = crs(p).total;

  const langBlock = (pre: 'en' | 'fr', title: string, table: LevelTable, unit: string, fmt: (x: number) => string) => (
    <fieldset className="cset"><legend>{title}</legend><div className="cgrid4">
      {SK.map((k) => <Field key={k} label={t(SKN[k])}><select name={pre + k} id={'c-' + pre + k} value={p[pre][k]} onChange={(e) => setLang(pre, k, Number(e.target.value) || 0)}><ClbOpts table={table} k={k} unit={unit} fmt={fmt} /></select></Field>)}
    </div></fieldset>
  );
  return <>
    <div><Link className="btn sm ghost" href="/paths"><ArrBack />{t('All paths')}</Link></div>
    <div><p className="eyebrow">{t('Express Entry')}</p><h1>{t('Score calculator')}</h1><p className="muted" style={{ maxWidth: '70ch' }}>{t('Your Comprehensive Ranking System (CRS) score out of 1,200 and your Federal Skilled Worker grid out of 100, compared with the latest invitation rounds. Official grids in force on 27 September 2026.')}</p></div>
    <div className="calc">
      <form id="f-crs" className="stack cform" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        {hasTests ? <div className="banner-info small">{t('Your language levels were filled in from your latest IELTS / TEF results in the app.')} <button type="button" className="btn sm" data-sa="crs-fill" onClick={() => { const next = fillFromTests({ ...p }, levels); setP(next); PV.setProfile(next); app.toast(t('Filled from your latest test results.')); }}>{t('Refill from my tests')}</button></div> : null}
        <fieldset className="cset"><legend>{t('You')}</legend><div className="cgrid">
          <Field label={t('Age')} hint={t('Your age when you would receive the invitation.')}><input type="number" name="age" id="c-age" min={16} max={70} inputMode="numeric" value={ageText} onChange={(e) => { setAgeText(e.target.value); update({ age: Math.max(16, Math.min(70, Number(e.target.value) || 30)) }); }} /></Field>
          <Field label={t('Marital status')}><Sel name="spouse" value={p.spouse} opts={[['single', t('Single, or partner not coming / Canadian')], ['with', t('Married or common-law, partner coming with me')]]} onChange={(v) => update({ spouse: v === 'with' ? 'with' : 'single' })} /></Field>
          <Field label={t('Children coming with you')} hint={t('Only used for the fees and proof of funds.')}><Sel name="kids" value={p.kids} opts={[0, 1, 2, 3, 4].map((n) => [n, n === 4 ? '4+' : String(n)])} onChange={(v) => update({ kids: Number(v) || 0 })} /></Field>
        </div></fieldset>
        <fieldset className="cset"><legend>{t('Education')}</legend><div className="cgrid">
          <Field label={t('Highest diploma (with an ECA)')}><Sel name="edu" value={p.edu} opts={tl(EDU)} onChange={(v) => update({ edu: v })} /></Field>
          <Field label={t('Studies in Canada')}><Sel name="caEdu" value={p.caEdu} opts={[['0', t('None')], ['1', t('1–2 year Canadian credential')], ['3', t('3+ year Canadian credential')]]} onChange={(v) => update({ caEdu: v || '0' })} /></Field>
        </div></fieldset>
        {langBlock('en', t('English (IELTS band)'), IELTS_CLB, 'CLB', (x) => x.toFixed(1))}
        {langBlock('fr', t('French (TEF score)'), TEF_NCLC, 'NCLC', (x) => x + '+')}
        <fieldset className="cset"><legend>{t('Skilled work (TEER 0–3)')}</legend><div className="cgrid">
          <Field label={t('Outside Canada, last 10 years')}><Sel name="fwExp" value={p.fwExp} opts={years(6)} onChange={(v) => update({ fwExp: Number(v) || 0 })} /></Field>
          <Field label={t('In Canada, last 10 years')}><Sel name="caExp" value={p.caExp} opts={years(5)} onChange={(v) => update({ caExp: Number(v) || 0 })} /></Field>
          <Field label={t('Your occupation group')} hint={t('For the category draws. Check the eligible NOC codes on the official page.')}><Sel name="occ" value={p.occ} opts={tl(OCC)} onChange={(v) => update({ occ: v })} /></Field>
        </div>
          <Check name="cert" label={t('Certificate of qualification from a Canadian province (trades)')} on={p.cert} set={(v) => update({ cert: v })} />
        </fieldset>
        <fieldset className="cset" id="c-partner" hidden={p.spouse !== 'with'}><legend>{t('Your partner')}</legend>
          <div className="cgrid">
            <Field label={t('Partner\'s highest diploma')}><Sel name="spEdu" value={p.sp.edu} opts={tl(EDU)} onChange={(v) => update({ sp: { ...p.sp, edu: v || 'bach' } })} /></Field>
            <Field label={t('Partner\'s work in Canada')}><Sel name="spCaExp" value={p.sp.caExp} opts={years(5)} onChange={(v) => update({ sp: { ...p.sp, caExp: Number(v) || 0 } })} /></Field>
          </div>
          <div className="cgrid4">{SK.map((k) => <Field key={k} label={t(PSKN[k])}><select name={'sp' + k} id={'c-sp' + k} value={p.sp.lang[k]} onChange={(e) => update({ sp: { ...p.sp, lang: { ...p.sp.lang, [k]: Number(e.target.value) || 0 } } })}><ClbOpts table={IELTS_CLB} k={k} unit="CLB" fmt={(x) => x.toFixed(1)} /></select></Field>)}</div>
          <Check name="spStudyCa" label={t('Partner studied 2+ years in Canada')} hint={t('FSW adaptability points only.')} on={p.spStudyCa} set={(v) => update({ spStudyCa: v })} />
        </fieldset>
        <fieldset className="cset"><legend>{t('Extras')}</legend>
          <Check name="pnp" label={t('Provincial nomination')} hint={t('+600 CRS points.')} on={p.pnp} set={(v) => update({ pnp: v })} />
          <Check name="sibling" label={t('Brother or sister in Canada (citizen or PR, 18+)')} hint={t('+15 CRS points.')} on={p.sibling} set={(v) => update({ sibling: v })} />
          <Check name="offer" label={t('Valid job offer (arranged employment)')} hint={t('No CRS points since March 2025, but still 10 + 5 points on the FSW grid.')} on={p.offer} set={(v) => update({ offer: v })} />
          <Check name="relative" label={t('Close relative in Canada (citizen or PR)')} hint={t('FSW adaptability points only.')} on={p.relative} set={(v) => update({ relative: v })} />
        </fieldset>
        <p className="small muted">{signedIn ? t('Changes are saved to your account.') : tr('Saved on this device as you type. {link} to keep it on all your devices.', { link: <Link href="/signup">{t('Create a free account')}</Link> })}</p>
      </form>
      <aside className="calc-out" id="crs-out" aria-live="polite"><Result p={p} draws={draws} /></aside>
    </div>
    <button type="button" className="crs-float" data-sa="to-result" onClick={() => document.getElementById('crs-out')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span className="small">{t('Your CRS')}</span><b className="mono" id="crs-float-n">{total}</b><span className="small">{t('Details')} ↓</span></button>
  </>;
}

function ClbOpts({ table, k, unit, fmt }: { table: LevelTable; k: keyof Levels; unit: string; fmt: (x: number) => string }) {
  const rows: [number, string][] = [[0, t('None')]];
  for (let n = 10; n >= 4; n--) { const row = table[k].find((x) => x[1] === n); rows.push([n, unit + ' ' + n + (n === 10 ? '+' : '') + (row ? ' (' + fmt(row[0]) + ')' : '')]); }
  rows.push([3, t('{unit} 3 or less', { unit })]);
  return <>{rows.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</>;
}
function Sel({ name, value, opts, onChange }: { name: string; value: string | number; opts: [string | number, string][]; onChange: (v: string) => void }) {
  return <select name={name} id={'c-' + name} value={String(value)} onChange={(e) => onChange(e.target.value)}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="cfield"><span className="clabel">{label}</span>{children}{hint ? <span className="chint">{hint}</span> : null}</label>;
}
function Check({ name, label, hint, on, set }: { name: string; label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return <label className="ccheck"><input type="checkbox" name={name} checked={!!on} onChange={(e) => set(e.target.checked)} /><span><b>{label}</b>{hint ? <><br /><span className="chint">{hint}</span></> : null}</span></label>;
}

function Result({ p, draws }: { p: CrsProfile; draws: Draws | null }) {
  const r = crs(p); const f = fsw(p);
  const pool = poolAbove(draws && draws.ee && draws.ee.dist, r.total);
  const row = (label: string, v: number, max?: number) => <div className="crow" key={label}><span>{label}</span><span className="mono">{v}{max ? <span className="muted"> / {max}</span> : null}</span></div>;
  const cmp: ReactNode[] = [];
  const addCmp = (cat: string, label: string, ok: boolean, why: string, bonus = 0) => {
    const rec = recent(draws, cat); if (!rec) return;
    const v = ok ? verdict(r.total + bonus, rec) : { cls: '', text: why };
    cmp.push(<div className="ccmp" key={cat + label}>
      <div className="row between" style={{ gap: 6 }}><b className="small">{label}</b><span className="mono small">{t('last {score} · {date}', { score: rec.last.crs, date: fmtDay(rec.last.date, SHORT) })}</span></div>
      <div className="row small" style={{ gap: 6 }}><span className="muted">{t('6-month range {min}–{max}', { min: rec.min, max: rec.max })}</span>{v ? <span className={'pill ' + v.cls}>{v.text}</span> : null}</div>
    </div>);
  };
  const frOk = allAtLeast(p.fr, 7);
  const expOk = (Number(p.fwExp) || 0) + (Number(p.caExp) || 0) >= 1;
  addCmp('french', t('French-language draws'), frOk && expOk, !frOk ? t('Needs NCLC 7 in all four French skills') : t('Needs 1 year of skilled work'));
  addCmp('cec', t('Canadian Experience Class'), (Number(p.caExp) || 0) >= 1, t('Needs 1 year of skilled work in Canada'));
  if (p.occ) addCmp(p.occ, t('{category} draws', { category: t(CAT_LABEL[p.occ] || p.occ) }), expOk, t('Needs 6 months of work in an eligible occupation'));
  if (!p.pnp) addCmp('pnp', t('With a provincial nomination (+600)'), true, '', 600); else addCmp('pnp', t('Provincial nominee draws'), true, '');
  const bs = boosts(p).slice(0, 4);
  return <>
    <div className="panel cres">
      <p className="eyebrow">{t('Your CRS score')}</p><div className="crsbig mono">{r.total}<span className="muted"> / {fmtNum(1200)}</span></div>
      {pool ? <p className="small muted">{tr('About {above} of {total} candidates in the pool ({pct}%) had a higher score on {date}.', { above: <b>{fmtNum(pool.above)}</b>, total: fmtNum(pool.total), pct: pool.pct, date: fmtDay(pool.asOf) })}</p> : null}
      <div className="cbreak">{row(t('Core: age, education, language, Canadian work'), r.coreTotal, p.spouse === 'with' ? 460 : 500)}{p.spouse === 'with' ? row(t('Partner'), r.spTotal, 40) : null}{row(t('Skill transferability'), r.transferTotal, 100)}{row(t('Additional: nomination, French, Canadian studies, sibling'), r.addTotal, 600)}</div>
      <details className="small"><summary>{t('Details')}</summary><div className="cbreak" style={{ marginTop: 6 }}>
        {row(t('Age'), r.core.age)}{row(t('Education'), r.core.edu)}{row(t('First language ({lang})', { lang: r.firstName === 'French' ? t('French') : t('English') }), r.core.lang1)}{row(t('Second language'), r.core.lang2)}{row(t('Canadian work'), r.core.caExp)}{row(t('Transferability: education'), r.transfer.education)}{row(t('Transferability: foreign work'), r.transfer.foreign)}{row(t('Trade certificate'), r.transfer.cert)}{row(t('French bonus'), r.additional.french)}{row(t('Canadian studies'), r.additional.caEdu)}{row(t('Sibling'), r.additional.sibling)}{row(t('Nomination'), r.additional.pnp)}
      </div></details>
      <div className="fswline"><span><b>{t('FSW grid')}</b> <span className="mono">{f.total} / 100</span></span>{f.pass && f.eligible ? <span className="pill good">{t('Passes 67')}</span> : !f.eligible ? <span className="pill warn">{t('Needs CLB 7 in all four + 1 year work')}</span> : <span className="pill bad">{t('Below 67')}</span>}</div>
    </div>
    {cmp.length ? <div className="panel"><h3>{t('Against the latest rounds')}</h3>{cmp}<Link className="small" href="/paths/draws">{t('All invitation rounds')}<ArrFwd /></Link></div> : null}
    {bs.length ? <div className="panel"><h3>{t('What would raise your score')}</h3><ul className="boosts">{bs.map((b) => <li key={b.label}><span className="mono gain">+{b.gain}</span><span><b>{t(b.label)}</b> <ArrFwd /> {b.total}{b.how ? <><br /><span className="small muted">{t(b.how)}</span></> : null}</span></li>)}</ul></div> : null}
    <p className="small muted">{tr('An estimate for planning, not an official result. Confirm with {link}.', { link: <a href="https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp" target="_blank" rel="noopener">{t('IRCC\'s own tool')}</a> })}</p>
  </>;
}
