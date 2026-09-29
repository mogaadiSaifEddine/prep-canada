'use client';
// IELTS coach views. State and logic live in lib/coach/ielts.ts; this file only renders.
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { CoachHeader, Footer } from '@/components/app/Page';
import { Spinner } from '@/components/app/ui';
import { canDictate } from '@/lib/client/dictation';
import { stripLetter, toArr, words } from '@/lib/coach/common';
import { clbOf, DIFF, fmtBand, IeltsCoach, LPART, ORDER, roundBand, RSEC, SEC, SK, SKCOL, speakSteps, TARGETS, TYPE_NAMES } from '@/lib/coach/ielts';
import { getIelts } from '@/lib/coach/registry';
import { ErrTable, MicButton, Paragraphs, PlanPill, ReportBox, ScoreTrend, Timer, Upsell } from './shared';

type P = { c: IeltsCoach };
const ERR_HEAD: [string, string, string] = ['You wrote', 'Better', 'Why'];

export default function IeltsCoachView() {
  const app = useApp();
  const c = getIelts();
  useSyncExternalStore(c.subscribe, c.getVersion, c.getVersion);
  useEffect(() => { c.mount(); return () => c.unmount(); }, [c]);
  const S = c.S;
  const inTest = ['intro', 'section', 'marking'].includes(S.view);
  const { setFocus } = app;
  useEffect(() => { setFocus(S.ready && inTest); }, [S.ready, inTest, setFocus]);
  useEffect(() => () => setFocus(false), [setFocus]);
  if (!S.ready) return <div className="row"><Spinner /><span className="muted">Loading your coach…</span></div>;
  const views: Record<string, () => ReactNode> = {
    home: () => <Home c={c} />, tests: () => <Tests c={c} />, course: () => <Course c={c} />, lesson: () => <Lesson c={c} />, history: () => <History c={c} />,
    report: () => <Report c={c} />, intro: () => <Intro c={c} />, section: () => <Section c={c} />, marking: () => <Marking c={c} />, real: () => <Real c={c} />
  };
  const body = (views[S.view] || views.home)();
  if (inTest) return body;
  return <>
    <CoachHeader exam="ielts" nav={[['home', 'Dashboard'], ['tests', 'Tests'], ['course', 'Course'], ['history', 'Results']]} current={S.view === 'lesson' ? 'course' : S.view === 'real' ? 'tests' : S.view} subtitle={'General Training · target CLB ' + c.CLBT()} onNav={(v) => c.nav(v)} />
    {body}
    <Footer />
  </>;
}

/* ---------- dashboard ---------- */
function SkillCard({ c, k }: P & { k: string }) {
  const b = c.S.profile.bands[k]; const tg = c.TARGET[k]; const cl = clbOf(k, b);
  const pct = b == null ? 0 : Math.min(100, Math.max(0, (b - 4) / 5 * 100)); const tp = (tg - 4) / 5 * 100;
  const gap = b == null ? null : tg - b;
  const status = b == null ? <span className="pill">Not tested</span> : gap! <= 0 ? <span className="pill good">On target</span> : gap! <= 0.5 ? <span className="pill warn">{gap!.toFixed(1)} to go</span> : <span className="pill bad">{gap!.toFixed(1)} to go</span>;
  const note = c.S.profile.bandNote && c.S.profile.bandNote[k];
  return (
    <div className="panel skill">
      <div className="head"><div className="row"><span className="letter" style={{ background: SKCOL[k] }}>{k}</span><b>{SK[k]}</b></div>{status}</div>
      <div className="band mono">{fmtBand(b)}<small>{cl ? 'CLB ' + cl : ''}</small></div>
      <div className="scale" role="img" aria-label={'Band ' + fmtBand(b) + ' of target ' + tg.toFixed(1)}><div className="fill" style={{ width: pct + '%', background: SKCOL[k] }} /><div className="tick" style={{ left: tp + '%' }} /></div>
      <div className="scale-labels"><span>4</span><span>target {tg.toFixed(1)} · stretch {c.STRETCH[k].toFixed(1)}</span><span>9</span></div>
      {note ? <p className="small muted">Estimate {note}.</p> : null}
    </div>
  );
}
function overallNow(c: IeltsCoach) { const b = c.S.profile.bands; if (ORDER.some((k) => b[k] == null)) return null; return roundBand(ORDER.reduce((a, k) => a + (b[k] as number), 0) / 4); }
function clbOverall(c: IeltsCoach) { const b = c.S.profile.bands; if (ORDER.some((k) => b[k] == null)) return null; return Math.min(...ORDER.map((k) => { const x = clbOf(k, b[k]); return typeof x === 'number' ? x : 3; })); }

function Home({ c }: P) {
  const S = c.S; const p = S.profile; const ov = overallNow(c); const clb = clbOverall(c);
  let hero;
  if (p.activeAttemptId) {
    hero = <div className="panel"><p className="eyebrow">Unfinished test</p><h2>You have a test in progress</h2><p className="muted">Pick up where you stopped. Any section that was running keeps its original timer.</p>
      <div className="row"><button className="btn primary" data-act="resume" onClick={() => c.resume()}>Resume test</button><button className="btn" data-act="discard" onClick={() => c.confirm('confirmDiscard', true)}>Discard it</button></div>
      {S.confirmDiscard ? <div className="banner">Discard this attempt? Its answers will not count. <button className="btn sm" data-act="discard-yes" onClick={() => c.discard()}>Yes, discard</button> <button className="btn sm" data-act="discard-no" onClick={() => c.confirm('confirmDiscard', false)}>Keep it</button></div> : null}
    </div>;
  } else if (!p.placementDone) {
    hero = <div className="panel"><p className="eyebrow">Step 1 · Placement test</p><h1>Find your real starting level</h1>
      <p style={{ maxWidth: '62ch' }}>A full General Training paper in all four skills with real exam timings. Your results set the level of your course and every mock test after it. You can take a break between sections; each timer starts only when you press Start.</p>
      <div className="tablewrap"><table><thead><tr><th>Section</th><th>Format</th><th className="mono">Time</th></tr></thead><tbody>{ORDER.map((k) => <tr key={k}><td><b>{SK[k]}</b></td><td>{SEC[k].note}</td><td className="mono">{k === 'S' ? '11–14 min' : SEC[k].mins + ' min'}</td></tr>)}</tbody></table></div>
      <div className="row"><button className="btn primary" data-act="placement" onClick={() => c.placement()}>Start placement test</button><span className="small muted">About 2 h 50 min in total, plus breaks.</span></div>
    </div>;
  } else {
    const next = S.course ? c.allUnits().find((u) => !(S.course.progress || {})[u.id]?.done) : null;
    hero = <div className="panel"><div className="row between">
      <div className="stack" style={{ gap: 6 }}><p className="eyebrow">Overall</p><div className="row" style={{ alignItems: 'baseline' }}><span className="bigband mono">{fmtBand(ov)}</span><span className="pill ink">{clb ? 'CLB ' + clb : 'CLB –'}</span></div><p className="muted small">Your CLB level is set by your lowest skill. Target: CLB {c.CLBT()} in every skill.</p></div>
      <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
        {S.course ? (next ? <button className="btn primary" data-unit={next.id} onClick={() => c.openUnit(next.id)}>Continue course: {next.title}</button> : <span className="pill good">Course complete</span>) : <button className="btn primary" data-act="build" onClick={() => c.buildCourse()}>Build my course</button>}
        <button className="btn" data-nav="tests" onClick={() => c.nav('tests')}>New mock test</button>
      </div>
    </div></div>;
  }
  const weak = c.weakTypes(); const pats = (p.errorPatterns || []).slice(0, 6); const dl = c.daysLeft();
  return <>
    <div className="row between"><div><p className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h2>Hi {c.firstName()}</h2></div><div className="row">{dl != null ? <span className="pill"><span className="mono">{dl}</span> days to exam</span> : null}<PlanPill exam="ielts" /></div></div>
    {p.setupDone ? null : <Setup c={c} first />}
    {hero}
    <div className="grid">{ORDER.map((k) => <SkillCard key={k} c={c} k={k} />)}</div>
    <div className="grid">
      <div className="panel"><h3>Errors to watch</h3>{pats.length ? <ul className="stack" style={{ gap: 6, margin: 0, paddingLeft: 18 }}>{pats.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">Appears after your first Writing or Speaking test.</p>}</div>
      <div className="panel"><h3>Weakest question types</h3>{weak.length ? <div className="stack" style={{ gap: 8 }}>{weak.map((w) => <div key={w.skill + w.type} className="row between"><span>{SK[w.skill]} · {TYPE_NAMES[w.type] || w.type}</span><span className={'pill ' + (w.pct < 50 ? 'bad' : w.pct < 70 ? 'warn' : 'good') + ' mono'}>{w.pct}% of {w.t}</span></div>)}</div> : <p className="muted">Appears after your first Listening or Reading test.</p>}</div>
    </div>
    <ScoreTrend hist={p.history || []} order={ORDER} colors={SKCOL} names={SK} y0={4} y1={9} ticks={[4, 5, 6, 7, 8, 9]} pl={36} get={(e, k) => e.bands && e.bands[k]} title="Band trend" label="Band scores over time" />
    {p.setupDone ? <Setup c={c} /> : null}
  </>;
}

function Setup({ c, first }: P & { first?: boolean }) {
  const S = c.S; const p = S.profile;
  const [v, setV] = useState({ clbTarget: c.CLBT(), examDate: p.examDate, studyTime: p.studyTime, about: p.about });
  return (
    <div className={'panel' + (first ? '' : ' flat')}>
      <p className="eyebrow">{first ? 'Before you start' : 'Settings'}</p>
      {first ? <><h2>Set up your IELTS coach</h2><p className="muted" style={{ maxWidth: '62ch' }}>These details shape your tests, marking and course. You can change them later.</p></> : null}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <label className="stack" style={{ gap: 6 }}><span className="small muted">Target level</span><select id="set-target" value={v.clbTarget} onChange={(e) => setV({ ...v, clbTarget: Number(e.target.value) })}>{[7, 8, 9, 10].map((x) => <option key={x} value={x}>CLB {x} · L {TARGETS[x].L} R {TARGETS[x].R} W {TARGETS[x].W} S {TARGETS[x].S}</option>)}</select></label>
        <label className="stack" style={{ gap: 6 }}><span className="small muted">Exam date (if booked)</span><input type="date" id="set-date" value={v.examDate} onChange={(e) => setV({ ...v, examDate: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="small muted">Study time</span><select id="set-time" value={v.studyTime} onChange={(e) => setV({ ...v, studyTime: e.target.value })}>{['30 minutes a day', '1 hour a day', '1.5 hours a day', '2+ hours a day'].map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <label className="stack" style={{ gap: 6 }}><span className="small muted">About you (optional): job, country, languages. Used to make examples relevant.</span><input type="text" id="set-about" maxLength={280} style={{ width: '100%' }} value={v.about} onChange={(e) => setV({ ...v, about: e.target.value })} placeholder="e.g. Software developer in Tunisia, speaks Arabic and French" /></label>
      <div className="row">
        <button className={'btn ' + (first ? 'primary' : 'sm')} data-act="savesettings" onClick={() => c.saveSettings(v)}>{first ? 'Save and continue' : 'Save settings'}</button>
        {first ? null : <span className="small muted">{S.confirmReset ? <>Erase all IELTS progress, results and your course? <button className="btn sm" data-act="reset-yes" onClick={() => c.resetAll()}>Erase everything</button> <button className="btn sm" data-act="reset-no" onClick={() => c.confirm('confirmReset', false)}>Cancel</button></> : <button className="link" data-act="reset" onClick={() => c.confirm('confirmReset', true)}>Reset IELTS progress</button>}</span>}
      </div>
    </div>
  );
}

/* ---------- tests ---------- */
function Tests({ c }: P) {
  const app = useApp(); const S = c.S; const p = S.profile; const busy = !!p.activeAttemptId;
  const sel = S.mock;
  const recommend = ORDER.filter((k) => p.bands[k] != null).map((k) => ({ k, gap: c.TARGET[k] - (p.bands[k] as number) })).sort((a, b) => b.gap - a.gap)[0];
  const types: [string, string, string][] = [['full', 'Full test', 'All four skills · about 2 h 50 min'], ['L', 'Listening', '30 + 2 min · 40 questions'], ['R', 'Reading', '60 min · 40 questions'], ['W', 'Writing', '60 min · letter + essay'], ['S', 'Speaking', '11–14 min · 3 parts']];
  const diffs: [string, string][] = [['auto', 'Auto'], ['foundation', 'Foundation'], ['exam', 'Exam standard'], ['advanced', 'Advanced']];
  const u = S.usage; const left = u && u.sectionsLimit ? Math.max(0, u.sectionsLimit - u.sectionsUsed) : 0;
  return <>
    {!p.placementDone && !busy ? <div className="banner">Take the placement test first so mock tests can match your level. <button className="btn sm primary" data-act="placement" onClick={() => c.placement()}>Start placement test</button></div> : null}
    {busy ? <div className="banner">A test is in progress. <button className="btn sm primary" data-act="resume" onClick={() => c.resume()}>Resume it</button></div> : null}
    {app.ent.ielts?.paid ? (u && u.sectionsLimit ? <div className={'banner small' + (left < 8 ? '' : ' good')}>This month: {u.sectionsUsed} of {u.sectionsLimit} test sections used ({left} left). A full test uses 4, a single-skill test uses 1. Resets on the 1st.</div> : null)
      : <div className="banner small">Free plan: 1 mock test per month and 1 placement test. <Link href="/plans">See plans</Link> for unlimited tests and natural voices.</div>}
    <div className="panel"><p className="eyebrow">Mock test generator</p><h2>Build a new mock test</h2>
      <p className="muted" style={{ maxWidth: '64ch' }}>Every mock is newly written. Auto difficulty follows your latest band in each skill, and Listening and Reading mocks lean on the question types you miss most.{recommend && recommend.gap > 0 ? <> Your biggest gap right now is <b>{SK[recommend.k]}</b> ({fmtBand(p.bands[recommend.k])} → {c.TARGET[recommend.k].toFixed(1)}).</> : null}</p>
      <div className="stack"><span className="eyebrow">Test</span><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {types.map(([v, l, d]) => <label key={v} className="choice"><input type="radio" name="mtype" value={v} checked={sel.type === v} onChange={() => c.setMock({ type: v })} /><span className="mono">{v === 'full' ? '4' : v}</span><span><b>{l}</b><br /><span className="small muted">{d}</span></span></label>)}
      </div></div>
      <div className="stack"><span className="eyebrow">Difficulty</span>
        <div className="opts">{diffs.map(([v, l]) => <label key={v} className="opt"><input type="radio" name="mdiff" value={v} checked={sel.diff === v} onChange={() => c.setMock({ diff: v })} /><span>{l}</span></label>)}</div>
        <p className="small muted">{sel.diff === 'auto' ? 'Auto sets ' + (sel.type === 'full' ? ORDER : [sel.type]).map((k) => SK[k] + ': ' + DIFF[c.autoDiff(k)].label).join(' · ') : 'Every section at ' + DIFF[sel.diff].label + ': ' + DIFF[sel.diff].text + '.'}</p>
      </div>
      <div className="row"><button className="btn primary" data-act="mock" disabled={busy} onClick={() => c.mock()}>Create and start</button><span className="small muted">Content is written while you read the instructions; each part takes up to a minute.</span></div>
    </div>
    <div className="panel flat"><p className="eyebrow">Real recordings</p><h3>Practise with a real IELTS recording</h3><p className="muted" style={{ maxWidth: '64ch' }}>Load a recording from a Cambridge IELTS book or official practice test (like the MP3s you have), answer on the sheet while it plays once, then paste the answer key to get your score and band. Questions come from the book, so have the question paper open.</p><div className="row"><button className="btn dark" data-nav="real" onClick={() => c.nav('real')}>Open real-recording mode</button></div></div>
    <VoicePanel c={c} />
  </>;
}

function VoicePanel({ c }: P) {
  const app = useApp();
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => { setNames(c.engVoices().slice(0, 4).map((v) => v.name.replace(/\s*\(.*\)/, ''))); }, [c]);
  if (app.ent.ielts?.tts) return <div className="panel flat"><h3>Voices</h3><p className="small muted" style={{ maxWidth: '68ch' }}>Your plan reads Listening tests and speaking questions with natural studio voices in British accents. If they can&apos;t load, the app falls back to your device&apos;s voices.</p><div className="row"><button className="btn sm" data-act="voicetest" onClick={() => c.voiceTest()}>Hear a sample</button></div></div>;
  if (!c.tts) return <div className="panel flat"><h3>Voices</h3><p className="muted">This browser has no speech voices, so generated Listening tests show the script once instead. Upgrade for natural studio voices, or use Chrome or Edge.</p></div>;
  return <div className="panel flat"><h3>Voices</h3><p className="small muted" style={{ maxWidth: '68ch' }}>The free plan uses your device&apos;s voices: {names && names.length ? names.join(', ') : 'none found yet'}. <Link href="/plans">Solo and Duo</Link> use natural studio voices that sound like the real exam.</p><div className="row"><button className="btn sm" data-act="voicetest" onClick={() => c.voiceTest()}>Hear a sample</button></div></div>;
}

function Real({ c }: P) {
  const S = c.S; const R = c.realState();
  const [range, setRange] = useState({ from: String(R.from), to: String(R.from + R.count - 1) });
  const nums: number[] = []; for (let n = R.from; n < R.from + R.count; n++) nums.push(n);
  const r = R.result;
  return <>
    <div className="row"><button className="btn sm" data-nav="tests" onClick={() => c.nav('tests')}>← Tests</button></div>
    <div className="panel"><p className="eyebrow">Real recording</p><h2>Listening with a real recording</h2>
      <div className="stack"><label className="eyebrow" htmlFor="rfiles">1 · Audio files (played in order)</label>
        <input type="file" id="rfiles" accept="audio/*,.mp3,.m4a,.wav" multiple disabled={!!R.played} onChange={(e) => { R.files = [...(e.target.files || [])]; c.emit(); }} />
        <p className="small muted">{R.files.length ? R.files.map((f) => f.name).join(' → ') : 'Add the instruction file first if you have one, then the test.'}</p>
        <div className="row"><label className="small muted" htmlFor="rfrom">Questions</label><input type="text" id="rfrom" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} style={{ width: 70 }} inputMode="numeric" /><span className="small muted">to</span><input type="text" id="rto" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} style={{ width: 70 }} inputMode="numeric" /><button className="btn sm" data-act="realrange" disabled={!!R.played} onClick={() => c.realRange(parseInt(range.from, 10), parseInt(range.to, 10))}>Set</button></div>
      </div>
      <div className="player"><button className="btn primary" data-act="realplay" disabled={!R.files.length || !!R.played} onClick={() => c.realAudioPlay()}>{R.played === 'done' ? 'Played' : R.played ? 'Playing…' : 'Play once'}</button><div className="meter" aria-hidden="true"><i id="rmeter" style={{ width: (R.played === 'done' ? 100 : S.rmeter) + '%' }} /></div><span className="small muted mono" id="rtime">{S.rtime}</span></div>
      <div className="stack"><span className="eyebrow">2 · Answer sheet</span><p className="small muted">Spelling counts, as in the exam.</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 8 }}>{nums.map((n) => <div key={n} className="q" style={{ alignItems: 'center' }}><span className="qn mono">{n}</span><input type="text" id={'ra' + n} data-ra={n} value={R.answers[n] || ''} onChange={(e) => { R.answers[n] = e.target.value; c.emit(); }} autoComplete="off" autoCapitalize="off" spellCheck={false} style={{ width: '100%' }} /></div>)}</div>
      </div>
      <div className="stack"><label className="eyebrow" htmlFor="rkey">3 · Answer key</label><p className="small muted">One line per question. Separate accepted alternatives with a slash, e.g. <span className="mono">7 15 / fifteen</span>.</p>
        <textarea id="rkey" spellCheck={false} placeholder={'1 Hartley\n2 15 / fifteen\n3 B'} value={R.key} onChange={(e) => { R.key = e.target.value; c.emit(); }} />
        <label className="eyebrow" htmlFor="rtrans">Transcript (optional)</label><textarea id="rtrans" placeholder="Paste the audioscript from the book for a precise mistake analysis" value={R.transcript} onChange={(e) => { R.transcript = e.target.value; c.emit(); }} />
        <div className="row"><button className="btn primary" data-act="realmark" onClick={() => c.realMark()}>Mark my answers</button></div>
      </div>
    </div>
    {r ? <div className="panel"><div className="row between"><h2>Your result</h2><div className="row" style={{ alignItems: 'baseline' }}><span className="bigband mono" style={{ fontSize: '2.4rem' }}>{fmtBand(r.band)}</span><span className="pill">{r.raw} / {r.total}</span></div></div>
      <div className="tablewrap"><table><thead><tr><th className="mono">Q</th><th>Your answer</th><th>Key</th><th>Likely cause</th></tr></thead><tbody>
        {r.items.filter((i: any) => !i.ok).map((i: any) => <tr key={i.n}><td className="mono">{i.n}</td><td style={{ color: 'var(--bad)' }}>{i.given ? i.given : <span className="muted">blank</span>}</td><td style={{ color: 'var(--good)' }}>{i.correct}{i.alts.length ? <> <span className="muted">/ {i.alts.join(' / ')}</span></> : null}</td><td>{i.cause || ''}</td></tr>)}
      </tbody></table></div>
      {r.patterns ? <p><b>Patterns:</b> {r.patterns.join('; ')}</p> : null}
      <div className="row"><button className="btn" data-act="realexplain" disabled={S.realBusy} onClick={() => c.realExplain()}>{S.realBusy ? 'Analysing…' : 'Explain my mistakes'}</button>{S.realBusy ? <Spinner /> : null}<button className="btn" data-act="realreset" onClick={() => c.realReset()}>New recording</button></div>
      <p className="small muted">Paste the transcript below first for a precise analysis; without it, causes are inferred from your answers.</p>
    </div> : null}
  </>;
}

/* ---------- test flow ---------- */
function Intro({ c }: P) {
  const app = useApp(); const S = c.S; const run = S.run!; const k = c.nextSection(run);
  const done = run.sections.filter((x) => run.results[x]);
  const inProg = !!k && !!run.state[k] && (k === 'S' ? run.state.S.pos > 0 || run.state.S.started : true) && !run.state[k].submitted;
  const gens = Object.values(S.gen);
  const failed = gens.find((g) => g && typeof g === 'object') as { err: string } | undefined;
  const busyGen = gens.some((g) => g === 'busy');
  const ready = !!k && ((k === 'L' || k === 'R') ? !!(run.content[k] && run.content[k][0]) : c.sectionReady(run, k));
  const prep: ReactNode[] = [];
  for (const s of run.sections) for (let i = 0; i < (s === 'L' ? 4 : s === 'R' ? 3 : 1); i++) {
    const ok = run.content[s] && run.content[s][i]; const g = S.gen[s + i];
    const name = s === 'L' ? 'Listening Part ' + (i + 1) : s === 'R' ? 'Reading Section ' + (i + 1) : SK[s] + ' paper';
    prep.push(<div key={s + i} className="prep">{ok ? <span className="pill good">Ready</span> : g && typeof g === 'object' ? <span className="pill bad">Failed</span> : <Spinner />}<span>{name}</span></div>);
  }
  return (
    <div className="panel">
      <div className="row between"><div><p className="eyebrow">{run.label}</p><h2>{k ? (inProg ? 'Resume ' : 'Next: ') + SK[k] : 'All sections done'}</h2></div><button className="btn sm" data-act="leave" onClick={() => c.leave()}>Save and exit</button></div>
      {k ? <><p>{SEC[k].note}.</p><SectionTips c={c} k={k} tts={!!app.ent.ielts?.tts} />{inProg && k !== 'S' ? <p className="banner">This section was already started. The timer kept running: <IntroLeft deadline={run.state[k].deadline} /> left.</p> : null}</> : null}
      {done.length ? <p className="small muted">Completed: {done.map((x) => SK[x] + ' ' + fmtBand(run.results[x].band)).join(' · ')}</p> : null}
      <div className="row">
        {k ? (ready ? <button className="btn primary" data-act="start" data-k={k} onClick={() => c.startSection(k)}>{inProg ? 'Continue' : 'Start ' + SK[k]} · {k === 'S' ? '11–14' : SEC[k].mins} min</button> : <button className="btn primary" disabled>Preparing {SK[k]}…</button>) : null}
        {failed && !busyGen ? <button className="btn" data-act="regen" onClick={() => c.regen()}>Try again</button> : null}
      </div>
      {failed && !busyGen ? <p className="banner bad small">{failed.err}</p> : null}
      <div className="stack" style={{ gap: 8 }}><span className="eyebrow">Paper preparation</span><div className="prepgrid">{prep}</div></div>
    </div>
  );
}
function IntroLeft({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  const ms = Math.max(0, deadline - now); const s = Math.round(ms / 1000);
  return <>{String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')}</>;
}
function SectionTips({ c, k, tts }: P & { k: string; tts: boolean }) {
  const ul = { margin: 0, paddingLeft: 18 };
  if (k === 'L') return <ul className="small muted" style={ul}><li>Each part plays <b>once</b>, read aloud by {tts ? 'natural studio voices' : 'your device\'s voice'}. Use headphones and turn the volume up.</li><li>Read the questions before pressing Play, as you would in the 30 seconds the real test gives you.</li><li>Spelling and word limits count, exactly as in the exam.</li>{c.tts ? null : <li><b>This browser has no speech voice.</b> Each script will be shown once for about the time it takes to hear it, then hidden.</li>}</ul>;
  if (k === 'R') return <ul className="small muted" style={ul}><li>Three sections, 40 questions. Aim for about 15, 20 and 25 minutes.</li><li>Answers are marked as in the exam: spelling counts, and completion answers must fit the word limit.</li></ul>;
  if (k === 'W') return <ul className="small muted" style={ul}><li>Spend about 20 minutes on Task 1 and 40 on Task 2. Task 2 counts twice as much.</li><li>Write at least 150 and 250 words. The word counter is shown, as in the computer test.</li></ul>;
  return <ul className="small muted" style={ul}><li>The examiner&apos;s questions are spoken aloud{c.tts ? '' : ' (no voice in this browser, so read them)'}.</li><li>{canDictate() ? <>Press <b>Speak</b> and answer out loud: your words are written as you talk.</> : 'Answer out loud using your keyboard\'s dictation microphone, so your words are typed as you speak.'} Don&apos;t edit afterwards; the marking ignores punctuation.</li><li>Part 1 and Part 3 have about 5 minutes each. Part 2 gives you 1 minute to prepare and 2 minutes to talk.</li><li>Pronunciation can&apos;t be judged from text, so your band covers fluency, vocabulary and grammar only.</li></ul>;
}

function Marking({ c }: P) {
  const S = c.S; const k = S.sec;
  return (
    <div className="panel"><p className="eyebrow">{SK[k]}</p>
      {S.markErr ? <><h2>Marking didn&apos;t finish</h2><p>{S.markErr} Your answers are saved.</p><div className="row"><button className="btn primary" data-act="remark" onClick={() => c.remark()}>Try marking again</button><button className="btn" data-act="leave" onClick={() => c.leave()}>Save and exit</button></div></>
        : <><div className="row"><Spinner /><h2>Marking your {SK[k].toLowerCase()}</h2></div><p className="muted">An examiner-style marking against the four official criteria. This usually takes under a minute.</p></>}
    </div>
  );
}

function ExamBar({ c, k, extra }: P & { k: string; extra?: string }) {
  const S = c.S;
  return <>
    <div className="exambar"><div><div className="small" style={{ opacity: 0.75 }}>{S.run!.label}</div><b>{SK[k]}</b>{extra || ''}</div>
      <div className="row"><Timer left={() => c.timerLeft()} low={(l) => c.timerLow(l)} />{k === 'S' ? null : <button className="btn sm" data-act="ask-submit" onClick={() => c.confirm('confirmSubmit', true)}>Submit {SK[k]}</button>}</div>
    </div>
    {S.confirmSubmit ? <div className="banner">Submit {SK[k]} now? You can&apos;t come back to it. {unansweredNote(c, k)} <button className="btn sm primary" data-act="submit" onClick={() => c.submit()}>Submit</button> <button className="btn sm" data-act="cancel-submit" onClick={() => c.confirm('confirmSubmit', false)}>Keep working</button></div> : null}
  </>;
}
function unansweredNote(c: IeltsCoach, k: string) {
  const run = c.S.run!;
  if (k === 'W') { const a = run.answers.W; return 'Task 1: ' + words(a.t1) + ' words, Task 2: ' + words(a.t2) + ' words.'; }
  const ans = run.answers[k] || {}; const ct = run.content[k]; let tt = 0, u = 0;
  for (const i in ct) (ct[i].groups || []).forEach((g: any) => g.questions.forEach((q: any) => { tt++; if (!String(ans[q.n] || '').trim()) u++; }));
  return u ? u + ' of ' + tt + ' questions are unanswered.' : 'All questions answered.';
}
function Tabs({ c, n, label }: P & { n: number; label: string }) {
  return <div className="tabs" role="tablist">{Array.from({ length: n }, (_, i) => <button key={i} role="tab" data-tab={i} aria-selected={c.S.tab === i} onClick={() => c.setTab(i)}>{label} {i + 1}</button>)}</div>;
}
function Groups({ c, k, groups }: P & { k: string; groups: any[] }) {
  const ans = c.S.run!.answers[k];
  return <>{groups.map((g, gi) => (
    <div key={gi} className="group"><p className="instr">{g.instructions}</p>
      {g.options && g.options.length ? <ul className="optlist">{g.options.map((o: any) => <li key={o.label}><b className="mono">{o.label}</b>&nbsp; {o.text}</li>)}</ul> : null}
      {g.questions.map((q: any) => <Question key={q.n} c={c} k={k} g={g} q={q} val={ans[q.n] || ''} />)}
    </div>
  ))}</>;
}
function Question({ c, k, g, q, val }: P & { k: string; g: any; q: any; val: string }) {
  const name = k + '-q' + q.n; const tp = g.type; const set = (v: string) => c.setAnswer(k, q.n, v);
  let ctl;
  if (tp === 'tfng' || tp === 'ynng') { const vals = tp === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN']; ctl = <div className="opts">{vals.map((v) => <label key={v} className="opt"><input type="radio" name={name} value={v} data-n={q.n} checked={val === v} onChange={() => set(v)} /><span>{v}</span></label>)}</div>; }
  else if (tp === 'mcq') ctl = <div className="mcq">{toArr<string>(q.choices).map((ch, i) => { const L = 'ABCDEFGH'[i]; return <label key={L} className="choice"><input type="radio" name={name} value={L} data-n={q.n} checked={val === L} onChange={() => set(L)} /><span className="mono">{L}</span><span>{stripLetter(ch, L)}</span></label>; })}</div>;
  else if (tp === 'matching' || tp === 'headings') ctl = <select id={name} data-n={q.n} aria-label={'Answer to question ' + q.n} value={val} onChange={(e) => set(e.target.value)}><option value="">Choose…</option>{toArr<any>(g.options).map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}</select>;
  else ctl = <input type="text" id={name} data-n={q.n} value={val} onChange={(e) => set(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label={'Answer to question ' + q.n} />;
  return <div className="q"><span className="qn mono">{q.n}</span><div className="qbody"><p>{q.prompt}</p>{ctl}</div></div>;
}
function WaitPanel({ c, w }: P & { w: string }) {
  const S = c.S; const g = S.gen[S.sec + S.tab];
  return <div className="panel" id="waitpart">{g && typeof g === 'object' ? <><p className="banner bad">{g.err}</p><button className="btn" data-act="regen" onClick={() => c.regen()}>Try again</button></>
    : <><div className="row"><Spinner /><b>{w} {S.tab + 1} is still being written.</b></div><p className="muted">It appears here as soon as it&apos;s ready. Keep working on the earlier {w.toLowerCase()}s meanwhile.</p></>}</div>;
}
function Section({ c }: P) {
  const k = c.S.sec;
  if (k === 'L') return <Listening c={c} />;
  if (k === 'R') return <Reading c={c} />;
  if (k === 'W') return <Writing c={c} />;
  return <Speaking c={c} />;
}
function Reading({ c }: P) {
  const S = c.S; const sec = S.run!.content.R[S.tab];
  if (!sec) return <><ExamBar c={c} k="R" /><Tabs c={c} n={3} label="Section" /><WaitPanel c={c} w="Section" /></>;
  return <>
    <ExamBar c={c} k="R" />
    <div className="row between"><Tabs c={c} n={3} label="Section" /><span className="small muted">Questions {RSEC[S.tab].start}–{RSEC[S.tab].start + RSEC[S.tab].count - 1}</span></div>
    <div className="split">
      <div className="panel textcol"><div className="passage">{sec.texts.map((tx: any, i: number) => <div key={i}>{i ? <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} /> : null}<h3>{tx.heading}</h3><Paragraphs body={tx.body} /></div>)}</div></div>
      <div className="panel"><Groups c={c} k="R" groups={sec.groups} /><ReportBox state={S.reports['R' + S.tab]} k="R" i={S.tab} onOpen={() => c.reportOpen('R', S.tab)} onSend={(r) => c.reportSend('R', S.tab, r)} />
        <div className="row">{S.tab < 2 ? <button className="btn dark" data-tab={S.tab + 1} onClick={() => c.setTab(S.tab + 1)}>Next section</button> : <button className="btn primary" data-act="ask-submit" onClick={() => c.confirm('confirmSubmit', true)}>Submit Reading</button>}</div>
      </div>
    </div>
  </>;
}
function Listening({ c }: P) {
  const app = useApp(); const S = c.S; const run = S.run!; const part = run.content.L[S.tab];
  if (!part) return <><ExamBar c={c} k="L" /><Tabs c={c} n={4} label="Part" /><WaitPanel c={c} w="Part" /></>;
  const st = (run.state.L.played || {})[S.tab];
  const meter = st === 'done' ? 100 : st === 'playing' ? (S.lmeter[S.tab] || 0) : 0;
  const status = st === 'done' ? 'Finished' : st === 'playing' ? (S.lstatus[S.tab] || 'Playing once only') : 'Plays once, with 30 s to read the questions first, as in the exam.';
  const player = c.tts || app.ent.ielts?.tts
    ? <div className="player"><button className="btn primary" data-act="play" disabled={!!st} onClick={() => c.playListening()}>{st === 'done' ? 'Played' : st === 'playing' ? 'Playing…' : 'Play Part ' + (S.tab + 1)}</button><div className="meter" aria-hidden="true"><i id="lmeter" style={{ width: meter + '%' }} /></div><span className="small muted" id="lstatus">{status}</span></div>
    : <><div className="player"><button className="btn primary" data-act="readonce" disabled={!!st} onClick={() => c.readOnce()}>{st ? 'Script shown' : 'Show script once'}</button><span className="small muted">No speech voice in this browser: the script shows once, then hides.</span></div>
      <div id="readonce" className="panel flat" hidden={!S.readOnceText}>{(S.readOnceText || []).map((l, i) => <p key={i}><b>{l.speaker}:</b> {l.text}</p>)}</div></>;
  return <>
    <ExamBar c={c} k="L" />
    <div className="row between"><Tabs c={c} n={4} label="Part" /><span className="small muted">Questions {LPART[S.tab].start}–{LPART[S.tab].start + 9}</span></div>
    <div className="panel"><p className="muted">{part.context}</p>{player}<Groups c={c} k="L" groups={part.groups} />
      <ReportBox state={S.reports['L' + S.tab]} k="L" i={S.tab} onOpen={() => c.reportOpen('L', S.tab)} onSend={(r) => c.reportSend('L', S.tab, r)} />
      <div className="row">{S.tab < 3 ? <button className="btn dark" data-tab={S.tab + 1} onClick={() => c.setTab(S.tab + 1)}>Next part</button> : <button className="btn primary" data-act="ask-submit" onClick={() => c.confirm('confirmSubmit', true)}>Submit Listening</button>}</div>
    </div>
  </>;
}
function Writing({ c }: P) {
  const S = c.S; const run = S.run!; const w = run.content.W[0]; const a = run.answers.W; const tb = S.tab;
  const task = tb === 0
    ? <><p className="eyebrow">Task 1 · {w.task1.tone} letter · about 20 minutes</p><p>{w.task1.situation}</p><p>{w.task1.instruction}</p><ul>{toArr<string>(w.task1.bullets).map((b, i) => <li key={i}>{b}</li>)}</ul><p className="small muted">Write at least 150 words. You do NOT need to write any addresses. Begin your letter: <b>{w.task1.salutation || 'Dear …,'}</b></p></>
    : <><p className="eyebrow">Task 2 · essay · about 40 minutes</p><p>Write about the following topic:</p><p style={{ fontWeight: 600, maxWidth: '64ch' }}>{w.task2.prompt}</p><p className="small muted">Write at least 250 words.</p></>;
  const which = tb === 0 ? 't1' : 't2'; const val = a[which]; const min = tb === 0 ? 150 : 250; const wc = words(val);
  return <>
    <ExamBar c={c} k="W" /><Tabs c={c} n={2} label="Task" />
    <div className="split">
      <div className="panel textcol">{task}<ReportBox state={S.reports.W0} k="W" i={0} onOpen={() => c.reportOpen('W', 0)} onSend={(r) => c.reportSend('W', 0, r)} /></div>
      <div className="panel"><label htmlFor="wtext" className="eyebrow">Your answer</label>
        <textarea key={which} id="wtext" className="big" data-w={which} spellCheck={false} value={val} onChange={(e) => c.setWriting(which, e.target.value)} />
        <div className="row between"><span className={'wc' + (wc >= min ? ' ok' : '')} id="wc">{wc} words</span>{tb === 0 ? <button className="btn dark" data-tab="1" onClick={() => c.setTab(1)}>Go to Task 2</button> : <button className="btn primary" data-act="ask-submit" onClick={() => c.confirm('confirmSubmit', true)}>Submit Writing</button>}</div>
      </div>
    </div>
  </>;
}
function Speaking({ c }: P) {
  const app = useApp(); const S = c.S; const run = S.run!; const cs = run.content.S[0]; const steps = speakSteps(cs); const st = run.state.S; const step = steps[st.pos];
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = box.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, [st.pos]);
  if (!step) return null;
  const val = run.answers.S[st.pos] || '';
  const partNames: Record<number, string> = { 1: 'Part 1 · Interview', 2: 'Part 2 · Long turn', 3: 'Part 3 · Discussion' };
  const p2 = cs.part2;
  const q = step.phase === 'prep' || step.phase === 'talk'
    ? <div className="cue"><p style={{ fontWeight: 700 }}>{p2.card}</p><p>You should say:</p><ul>{toArr<string>(p2.bullets).map((b, i) => <li key={i}>{b}</li>)}</ul><p>{p2.final}</p></div>
    : <p className="examiner">{step.q}</p>;
  const lbl = step.phase === 'prep' ? 'Notes (1 minute to prepare)' : step.phase === 'talk' ? 'Speak for up to 2 minutes (dictate here)' : 'Your answer (dictate here)';
  const isNotes = step.phase === 'prep';
  const nextLbl = step.phase === 'prep' ? 'Start speaking now' : st.pos === steps.length - 1 ? 'Finish speaking test' : 'Next question';
  const qNum = steps.filter((x) => x.part === step.part && x.phase !== 'prep').indexOf(step) + 1;
  return <>
    <ExamBar c={c} k="S" extra={' · ' + partNames[step.part]} />
    <div className="panel">
      <div className="row between"><p className="eyebrow">{step.label}{step.phase ? '' : ' · question ' + qNum}</p>{(c.tts || app.ent.ielts?.tts) && step.phase !== 'talk' ? <button className="btn sm" data-act="repeatq" onClick={() => c.repeatQuestion()}>Hear it again</button> : null}</div>
      {q}
      <label htmlFor="spk" className="eyebrow">{lbl}</label>
      {isNotes
        ? <textarea ref={box} key="notes" id="spk" data-s="notes" placeholder="Short notes…" value={run.answers.S.notes || ''} onChange={(e) => c.setSpeaking('notes', e.target.value)} />
        : <textarea ref={box} key={st.pos} id="spk" data-s={st.pos} className={step.phase === 'talk' ? 'big' : ''} placeholder={canDictate() ? 'Press Speak and answer out loud, or type…' : 'Tap your keyboard\'s microphone and answer out loud…'} value={val} onChange={(e) => c.setSpeaking(String(st.pos), e.target.value)} />}
      <div className="row between">
        <div className="row">{!isNotes ? <MicButton act="mic" label="Speak" stopLabel="Stop" onClick={() => c.mic()} /> : null}<span className="wc" id="wc">{isNotes ? '' : words(val) + ' words'}</span></div>
        <button className="btn primary" data-act="snext" onClick={() => c.advanceSpeak(1)}>{nextLbl}</button>
      </div>
    </div>
  </>;
}

/* ---------- report ---------- */
function ReviewList({ r }: { r: any }) {
  const wrong = r.items.filter((i: any) => !i.ok);
  const item = (i: any) => (
    <div key={i.n} className="ritem"><span className={'qn mono ' + (i.ok ? 'ok' : '')}>{i.n}</span><div className="stack" style={{ gap: 4 }}>
      <p>{i.prompt}</p>
      <p className="small">Your answer: <b>{i.given ? i.given : <span className="muted">blank</span>}</b> · Correct: <b style={{ color: 'var(--good)' }}>{i.correct}</b>{i.alts && i.alts.length ? <> <span className="muted">(also: {i.alts.join(', ')})</span></> : null} · <span className="muted">{TYPE_NAMES[i.type] || i.type}</span></p>
      {i.evidence ? <p className="quote small">{i.evidence}</p> : null}{i.explain ? <p className="small">{i.explain}</p> : null}
    </div></div>
  );
  return <><details open={wrong.length <= 12}><summary>{wrong.length} wrong or blank answers</summary><div className="review">{wrong.map(item)}</div></details><details><summary>All {r.total} answers</summary><div className="review">{r.items.map(item)}</div></details></>;
}
function SectionReport({ c, k, r }: P & { k: string; r: any }) {
  const cl = clbOf(k, r.band); const tg = c.TARGET[k];
  let body;
  if (k === 'L' || k === 'R') body = <><p className="mono">{r.raw} / {r.total} correct</p><div className="tablewrap"><table><thead><tr><th>Question type</th><th className="mono">Correct</th></tr></thead><tbody>{Object.entries(r.per).map(([tp, v]: [string, any]) => <tr key={tp}><td>{TYPE_NAMES[tp] || tp}</td><td className="mono">{v.c} / {v.t}</td></tr>)}</tbody></table></div><ReviewList r={r} /></>;
  else if (k === 'W') { const c1 = r.t1 || {}, c2 = r.t2 || {}; body = <>
    <div className="tablewrap"><table><thead><tr><th /><th>Task achievement / response</th><th>Coherence &amp; cohesion</th><th>Lexical resource</th><th>Grammar</th><th>Task band</th></tr></thead><tbody>
      <tr><td><b>Task 1</b> <span className="small muted">{r.wc.t1} w</span></td><td className="mono">{fmtBand(c1.TA)}</td><td className="mono">{fmtBand(c1.CC)}</td><td className="mono">{fmtBand(c1.LR)}</td><td className="mono">{fmtBand(c1.GRA)}</td><td className="mono"><b>{fmtBand(c1.band)}</b></td></tr>
      <tr><td><b>Task 2</b> <span className="small muted">{r.wc.t2} w</span></td><td className="mono">{fmtBand(c2.TR)}</td><td className="mono">{fmtBand(c2.CC)}</td><td className="mono">{fmtBand(c2.LR)}</td><td className="mono">{fmtBand(c2.GRA)}</td><td className="mono"><b>{fmtBand(c2.band)}</b></td></tr>
    </tbody></table></div>
    <p><b>Task 1.</b> {c1.summary}</p><p><b>Task 2.</b> {c2.summary}</p>
  </>; }
  else { const cr = r.crit || {}; body = <><div className="tablewrap"><table><thead><tr><th>Fluency &amp; coherence</th><th>Lexical resource</th><th>Grammar</th><th>Pronunciation</th></tr></thead><tbody><tr><td className="mono">{fmtBand(cr.FC)}</td><td className="mono">{fmtBand(cr.LR)}</td><td className="mono">{fmtBand(cr.GRA)}</td><td className="small muted">Not assessed from text</td></tr></tbody></table></div><p>{r.summary}</p></>; }
  return (
    <div className="panel">
      <div className="row between"><div className="row"><span className="letter mono" style={{ background: SKCOL[k], color: '#fff', width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center' }}>{k}</span><h2>{SK[k]}</h2></div>
        <div className="row" style={{ alignItems: 'baseline' }}><span className="bigband mono" style={{ fontSize: '2.4rem' }}>{fmtBand(r.band)}</span><span className={'pill ' + (r.band >= tg ? 'good' : r.band >= tg - 0.5 ? 'warn' : 'bad')}>{cl ? 'CLB ' + cl : 'below CLB 4'} · target {tg.toFixed(1)}</span></div></div>
      {body}
      {k === 'W' || k === 'S' ? <>
        {r.errors && r.errors.length ? <><h3>Errors, quoted</h3><ErrTable errs={r.errors} head={ERR_HEAD} /></> : null}
        {r.patterns && r.patterns.length ? <><h3>Patterns</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{r.patterns.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></> : null}
        {r.model && r.model.band8 ? <><h3>Band 8 version</h3><p className="small muted">{r.model.task || ''}</p><p className="quote">{r.model.original || ''}</p><div className="model">{r.model.band8}</div></> : null}
        {r.next && r.next.length ? <><h3>Next priorities</h3><ol style={{ margin: 0, paddingLeft: 20 }}>{r.next.map((p: string, i: number) => <li key={i}>{p}</li>)}</ol></> : null}
      </> : null}
    </div>
  );
}
function Report({ c }: P) {
  const S = c.S; const run = S.reportRun; if (!run) return <div className="panel"><p className="muted">Loading report…</p></div>;
  const ks = run.sections.filter((k) => run.results[k]);
  const allPats: string[] = []; ks.forEach((k) => { const r = run.results[k]; if (r.patterns) allPats.push(...r.patterns); });
  const weak: string[] = []; ['L', 'R'].forEach((k) => { const r = run.results[k]; if (r) for (const tp in r.per) { const v = r.per[tp]; if (v.t && v.c / v.t < 0.7) weak.push(SK[k] + ' · ' + (TYPE_NAMES[tp] || tp) + ' (' + v.c + '/' + v.t + ')'); } });
  const onTrack = ks.every((k) => run.results[k].band >= c.TARGET[k]);
  return <>
    <div className="row"><button className="btn sm" data-nav="history" onClick={() => c.nav('history')}>← All results</button></div>
    <div className="panel"><p className="eyebrow">Progress card · {run.date}</p><h1>{run.label}</h1>
      <div className="row">{ks.map((k) => <span key={k} className="pill"><b>{SK[k]}</b>&nbsp;<span className="mono">{fmtBand(run.results[k].band)}</span></span>)}{run.overall != null ? <span className="pill ink">Overall <span className="mono">{fmtBand(run.overall)}</span></span> : null}</div>
      <p>{onTrack ? 'These results meet your CLB ' + c.CLBT() + ' targets. Keep the level steady and push toward the stretch bands.' : 'Honest verdict: not yet at CLB ' + c.CLBT() + ' in ' + ks.filter((k) => run.results[k].band < c.TARGET[k]).map((k) => SK[k] + ' (needs ' + c.TARGET[k].toFixed(1) + ')').join(', ') + '.'}</p>
      {weak.length ? <p><b>Question types to fix:</b> {weak.join(', ')}</p> : null}
      {allPats.length ? <p><b>Errors to watch:</b> {allPats.slice(0, 4).join('; ')}</p> : null}
      <div className="row">{run.kind === 'placement' || (S.course && !run.unitId) ? <button className="btn primary" data-act="build" onClick={() => c.buildCourse()}>{S.course ? 'Rebuild my course from these results' : 'Build my course from these results'}</button> : null}<button className="btn" data-nav="tests" onClick={() => c.nav('tests')}>Take another mock</button></div>
    </div>
    {ks.map((k) => <SectionReport key={k} c={c} k={k} r={run.results[k]} />)}
  </>;
}
function History({ c }: P) {
  const hist = [...(c.S.profile.history || [])].reverse();
  return (
    <div className="panel"><h2>Results</h2>
      {hist.length ? <div className="tablewrap"><table><thead><tr><th>Date</th><th>Test</th>{ORDER.map((k) => <th key={k} className="mono">{k}</th>)}<th>Overall</th><th /></tr></thead><tbody>
        {hist.map((e) => <tr key={e.id}><td className="mono">{e.date}</td><td>{e.label}</td>{ORDER.map((k) => <td key={k} className="mono">{e.bands && e.bands[k] != null ? fmtBand(e.bands[k]) : '–'}</td>)}<td className="mono">{fmtBand(e.overall)}</td><td><button className="btn sm" data-report={e.id} onClick={() => c.openReport(e.id)}>Open</button></td></tr>)}
      </tbody></table></div> : <p className="muted">No results yet. Your placement test will appear here.</p>}
    </div>
  );
}

/* ---------- course ---------- */
function Course({ c }: P) {
  const app = useApp(); const S = c.S;
  if (!app.ent.ielts?.course) return <Upsell exam="ielts" title="Your personal course" text="A course of up to 12 units built on your test results, with lessons, quizzes, marked tasks and timed checkpoints." />;
  if (S.courseBusy) return <div className="panel"><div className="row"><Spinner /><h2>Building your course</h2></div><p className="muted">Planning units around your bands, error patterns, finished lessons and exam date. This takes up to a minute.</p></div>;
  if (!S.course) return (
    <div className="panel"><p className="eyebrow">Personal course</p><h2>A course built on your results</h2>
      <p style={{ maxWidth: '64ch' }}>Up to twelve units, sized to the time left before your exam. Each unit is one focused point with short teaching, a 10-question quiz and a task marked by your AI coach. Each phase ends with a timed checkpoint test. {S.profile.placementDone ? 'It uses your placement results.' : 'Take the placement test first for the best plan; you can also start now from your known weaknesses.'}</p>
      {S.courseErr ? <p className="banner bad">{S.courseErr}</p> : null}
      <div className="row"><button className="btn primary" data-act="build" onClick={() => c.buildCourse()}>Build my course</button>{!S.profile.placementDone ? <button className="btn" data-act="placement" onClick={() => c.placement()}>Placement test first</button> : null}</div>
    </div>
  );
  const co = S.course; const prog = co.progress || {}; const units = c.allUnits(); const done = units.filter((u) => prog[u.id] && prog[u.id].done).length;
  return <>
    <div className="panel"><div className="row between"><div><p className="eyebrow">Your course · {done} of {units.length} units done</p><h2>{co.title}</h2></div><button className="btn sm" data-act="build" onClick={() => c.buildCourse()}>Rebuild from latest results</button></div><p className="muted" style={{ maxWidth: '68ch' }}>{co.summary}</p>{S.courseErr ? <p className="banner bad">{S.courseErr}</p> : null}</div>
    {co.phases.map((ph: any, pi: number) => (
      <div key={pi} className="phase"><h3>{ph.name}</h3>
        {ph.units.map((u: any) => {
          const p = prog[u.id];
          const pill = p && p.done ? <span className="pill good">{p.band != null ? 'Band ' + fmtBand(p.band) : p.score != null ? p.score + '%' : 'Done'}</span> : p && p.score != null ? <span className="pill warn">{p.score}% · retry</span> : u.checkpoint ? <span className="pill ink">Checkpoint test</span> : <span className="pill">Not started</span>;
          return <button key={u.id} className="unit" data-unit={u.id} onClick={() => c.openUnit(u.id)}><span className="sk" style={{ background: SKCOL[u.skill] }}>{u.skill}</span><span><b>{u.title}</b><br /><span className="small muted">{u.goal}</span></span>{pill}</button>;
        })}
      </div>
    ))}
  </>;
}
function Lesson({ c }: P) {
  const S = c.S; const u = S.lessonUnit;
  const head = <><div className="row"><button className="btn sm" data-nav="course" onClick={() => c.nav('course')}>← Course</button></div><div className="panel"><p className="eyebrow">{SK[u.skill]}{u.checkpoint ? ' · checkpoint' : ''}</p><h1>{u.title}</h1><p className="muted">{u.goal}</p></div></>;
  if (u.checkpoint) return <>{head}<div className="panel"><h2>Checkpoint: timed {SK[u.skill]} test</h2><p>{SEC[u.skill].note}. Newly written, at your current level. The result updates your {SK[u.skill]} band and completes this unit.</p><div className="row"><button className="btn primary" data-act="checkpoint" disabled={!!S.profile.activeAttemptId} onClick={() => c.checkpoint()}>Start checkpoint</button>{S.profile.activeAttemptId ? <span className="small muted">Finish or discard your test in progress first.</span> : null}</div></div></>;
  if (S.lessonBusy) return <>{head}<div className="panel"><div className="row"><Spinner /><b>Writing your lesson…</b></div></div></>;
  if (S.lessonErr) return <>{head}<div className="panel"><p className="banner bad">{S.lessonErr}</p><button className="btn primary" data-act="relesson" onClick={() => c.relesson()}>Try again</button></div></>;
  const l = S.lesson; if (!l) return head;
  const fb = S.taskFb;
  return <>
    {head}
    <div className="panel lesson"><p>{l.intro}</p>{toArr<any>(l.teach).map((tb, i) => <div key={i} className="stack" style={{ gap: 8 }}><h3>{tb.heading}</h3><p>{tb.body}</p>{toArr<any>(tb.examples).map((e, j) => <div key={j} className="ex">{e.wrong ? <span className="w">{e.wrong}</span> : null}<span className="r">{e.right}</span></div>)}</div>)}</div>
    {toArr(l.phrases).length ? <div className="panel"><h3>Phrases to use</h3><div className="tablewrap"><table><tbody>{l.phrases.map((p: any, i: number) => <tr key={i}><td><b>{p.phrase}</b></td><td className="muted">{p.use}</td></tr>)}</tbody></table></div></div> : null}
    <div className="panel">
      <div className="row between"><h3>Quiz · {l.quiz.length} questions</h3>{S.quizChecked ? <span className={'pill ' + (S.quizScore >= 70 ? 'good' : 'bad') + ' mono'}>{S.quizScore}%{S.quizScore >= 70 ? ' · unit passed' : ' · 70% to pass'}</span> : null}</div>
      {l.quiz.map((q: any, i: number) => (
        <div key={i} className="q"><span className="qn mono">{i + 1}</span><div className="qbody"><p>{q.prompt}</p>
          {q.type === 'mcq' ? <div className="mcq">{toArr<string>(q.choices).map((ch, ci) => { const L = 'ABCDEFGH'[ci]; return <label key={L} className="choice"><input type="radio" name={'lq' + i} value={L} checked={q._given === L} onChange={() => c.setQuizAnswer(i, L)} /><span className="mono">{L}</span><span>{stripLetter(ch, L)}</span></label>; })}</div>
            : <input type="text" id={'lq' + i} value={q._given || ''} onChange={(e) => c.setQuizAnswer(i, e.target.value)} autoComplete="off" />}
          {S.quizChecked ? <p className="small" style={{ color: q._ok ? 'var(--good)' : 'var(--bad)' }}>{q._ok ? 'Correct. ' : 'Answer: ' + toArr(q.answer).join(' / ') + '. '}<span className="muted">{q.explain || ''}</span></p> : null}
        </div></div>
      ))}
      <div className="row"><button className="btn primary" data-act="checkquiz" onClick={() => c.checkQuiz()}>{S.quizChecked ? 'Check again' : 'Check answers'}</button></div>
    </div>
    {l.task ? (
      <div className="panel"><h3>Your turn · {l.task.kind === 'speak' ? 'speak (dictate)' : 'write'}</h3><p>{l.task.prompt}</p>
        <textarea id="taskans" placeholder={l.task.kind === 'speak' ? 'Use your keyboard\'s microphone and answer out loud…' : 'Write here…'} value={S.taskAns || ''} onChange={(e) => { S.taskAns = e.target.value; c.emit(); }} />
        <div className="row"><MicButton act="mictask" label="Speak" stopLabel="Stop" onClick={() => c.micTask()} /><button className="btn primary" data-act="taskfb" disabled={S.taskBusy} onClick={() => c.taskFeedback()}>{S.taskBusy ? 'Marking…' : 'Get feedback'}</button>{S.taskBusy ? <Spinner /> : null}</div>
        {fb ? (fb.err ? <p className="banner bad">{fb.err}</p> : <div className="stack"><div className="row"><span className="pill ink">Band {fmtBand(fb.band)}</span></div><p>{fb.verdict}</p><p className="small">{fb.used_point || ''}</p><ErrTable errs={toArr(fb.errors)} head={ERR_HEAD} />{fb.better ? <><h3>Band 8 version</h3><div className="model">{fb.better}</div></> : null}</div>) : null}
      </div>
    ) : null}
  </>;
}
