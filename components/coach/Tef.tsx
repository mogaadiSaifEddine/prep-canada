'use client';
// TEF Canada coach views (in French). State and logic live in lib/coach/tef.ts; this file only renders.
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { CoachHeader, Footer } from '@/components/app/Page';
import { Spinner } from '@/components/app/ui';
import { canDictate } from '@/lib/client/dictation';
import { stripLetter, toArr, words } from '@/lib/coach/common';
import { getTef } from '@/lib/coach/registry';
import { AB, DIFF, fmtS, jobCount, LPART, minFor, nclcOf, nclcTxt, ORDER, RPART, SEC, SK, SKCOL, TefCoach, TYPE_NAMES } from '@/lib/coach/tef';
import { ErrTable, MicButton, PlanPill, ReportBox, ScoreTrend, Timer, Upsell } from './shared';

type P = { c: TefCoach };
const ERR_HEAD: [string, string, string] = ['Vous avez écrit', 'Correction', 'Pourquoi'];

export default function TefCoachView() {
  const app = useApp();
  const c = getTef();
  useSyncExternalStore(c.subscribe, c.getVersion, c.getVersion);
  useEffect(() => { c.mount(); return () => c.unmount(); }, [c]);
  const S = c.S;
  const inTest = ['intro', 'section', 'marking'].includes(S.view);
  const { setFocus } = app;
  useEffect(() => { setFocus(S.ready && inTest); }, [S.ready, inTest, setFocus]);
  useEffect(() => () => setFocus(false), [setFocus]);
  if (!S.ready) return <div className="row"><Spinner /><span className="muted">Chargement de votre coach…</span></div>;
  const views: Record<string, () => ReactNode> = {
    home: () => <Home c={c} />, tests: () => <Tests c={c} />, course: () => <Course c={c} />, lesson: () => <Lesson c={c} />, history: () => <History c={c} />,
    report: () => <Report c={c} />, intro: () => <Intro c={c} />, section: () => <Section c={c} />, marking: () => <Marking c={c} />
  };
  const body = (views[S.view] || views.home)();
  if (inTest) return body;
  return <>
    <CoachHeader exam="tef" nav={[['home', 'Tableau de bord'], ['tests', 'Tests'], ['course', 'Parcours'], ['history', 'Résultats']]} current={S.view === 'lesson' ? 'course' : S.view} subtitle={'TEF Canada · objectif NCLC ' + S.profile.target} onNav={(v) => c.nav(v)} />
    {body}
    <Footer />
  </>;
}

/* ---------- tableau de bord ---------- */
function SkillCard({ c, k }: P & { k: string }) {
  const s = c.S.profile.scores[k]; const n = nclcOf(k, s); const tgt = c.S.profile.target; const tmin = minFor(k, tgt);
  const pct = s == null ? 0 : Math.min(100, s / 699 * 100); const tp = tmin / 699 * 100;
  const status = s == null ? <span className="pill">Pas encore testé</span> : n! >= tgt ? <span className="pill good">Objectif atteint</span> : <span className={'pill ' + (tmin - s <= 30 ? 'warn' : 'bad')}>+{tmin - s} points</span>;
  return (
    <div className="panel skill">
      <div className="head"><div className="row"><span className="letter" style={{ background: SKCOL[k] }}>{AB[k]}</span><b>{SK[k]}</b></div>{status}</div>
      <div className="band mono">{fmtS(s)}<small>{s != null ? '/ 699 · NCLC ' + nclcTxt(n) : ''}</small></div>
      <div className="scale" role="img" aria-label={'Score ' + fmtS(s) + ', objectif ' + tmin}><div className="fill" style={{ width: pct + '%', background: SKCOL[k] }} /><div className="tick" style={{ left: tp + '%' }} /></div>
      <div className="scale-labels"><span>0</span><span>NCLC {tgt} = {tmin}+</span><span>699</span></div>
    </div>
  );
}
function nclcNow(c: TefCoach) { const s = c.S.profile.scores; if (ORDER.some((k) => s[k] == null)) return null; return Math.min(...ORDER.map((k) => nclcOf(k, s[k])!)); }

function Home({ c }: P) {
  const S = c.S; const p = S.profile; const n = nclcNow(c);
  let hero;
  if (p.activeAttemptId) {
    hero = <div className="panel"><p className="eyebrow">Test non terminé</p><h2>Un test est en cours</h2><p className="muted">Reprenez là où vous vous êtes arrêté. Une épreuve déjà commencée garde son chronomètre d’origine.</p>
      <div className="row"><button className="btn primary" data-act="resume" onClick={() => c.resume()}>Reprendre le test</button><button className="btn" data-act="discard" onClick={() => c.confirm('confirmDiscard', true)}>Abandonner</button></div>
      {S.confirmDiscard ? <div className="banner">Abandonner ce test ? Ses réponses ne compteront pas. <button className="btn sm" data-act="discard-yes" onClick={() => c.discard()}>Oui, abandonner</button> <button className="btn sm" data-act="discard-no" onClick={() => c.confirm('confirmDiscard', false)}>Non</button></div> : null}
    </div>;
  } else if (!p.placementDone) {
    hero = <div className="panel"><p className="eyebrow">Étape 1 · Test de positionnement</p><h1>Trouvez votre vrai niveau de départ</h1>
      <p style={{ maxWidth: '62ch' }}>Un TEF Canada complet, dans les quatre compétences, avec le format et les durées de l’examen réel. Vos résultats fixent le niveau de votre parcours et de tous les tests blancs suivants. Vous pouvez faire une pause entre les épreuves : chaque chronomètre ne démarre que lorsque vous cliquez sur Commencer.</p>
      <div className="tablewrap"><table><thead><tr><th>Épreuve</th><th>Format</th><th className="mono">Durée</th></tr></thead><tbody>{ORDER.map((k) => <tr key={k}><td><b>{SK[k]}</b></td><td>{SEC[k].note}</td><td className="mono">{SEC[k].time}</td></tr>)}</tbody></table></div>
      <div className="row"><button className="btn primary" data-act="placement" onClick={() => c.placement()}>Commencer le test de positionnement</button><span className="small muted">Environ 2 h 55 au total, plus les pauses.</span></div>
    </div>;
  } else {
    const next = S.course ? c.allUnits().find((u) => !((S.course.progress || {})[u.id] || {}).done) : null;
    hero = <div className="panel"><div className="row between">
      <div className="stack" style={{ gap: 6 }}><p className="eyebrow">Niveau global</p><div className="row" style={{ alignItems: 'baseline' }}><span className="bigband mono">NCLC {nclcTxt(n)}</span></div><p className="muted small">Votre niveau NCLC est fixé par votre compétence la plus faible. Objectif : NCLC {p.target} partout.</p></div>
      <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
        {S.course ? (next ? <button className="btn primary" data-unit={next.id} onClick={() => c.openUnit(next.id)}>Continuer : {next.title}</button> : <span className="pill good">Parcours terminé</span>) : <button className="btn primary" data-act="build" onClick={() => c.buildCourse()}>Créer mon parcours</button>}
        <button className="btn" data-nav="tests" onClick={() => c.nav('tests')}>Nouveau test blanc</button>
      </div>
    </div></div>;
  }
  const weak = c.weakTypes(); const pats = (p.errorPatterns || []).slice(0, 6); const dl = c.daysLeft(); const first = c.firstName();
  return <>
    <div className="row between"><div><p className="eyebrow">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h2>Bonjour {first}</h2></div><div className="row">{dl != null ? <span className="pill"><span className="mono">{dl}</span> jours avant l’examen</span> : null}<PlanPill exam="tef" /></div></div>
    {p.setupDone ? null : <Setup c={c} first />}
    {hero}
    <div className="grid">{ORDER.map((k) => <SkillCard key={k} c={c} k={k} />)}</div>
    <div className="grid">
      <div className="panel"><h3>Erreurs à surveiller</h3>{pats.length ? <ul className="stack" style={{ gap: 6, margin: 0, paddingLeft: 18 }}>{pats.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">Apparaît après votre première épreuve d’expression.</p>}</div>
      <div className="panel"><h3>Types de documents les plus difficiles</h3>{weak.length ? <div className="stack" style={{ gap: 8 }}>{weak.map((w) => <div key={w.skill + w.type} className="row between"><span>{TYPE_NAMES[w.type] || w.type}</span><span className={'pill ' + (w.pct < 50 ? 'bad' : w.pct < 70 ? 'warn' : 'good') + ' mono'}>{w.pct}% sur {w.t}</span></div>)}</div> : <p className="muted">Apparaît après votre première épreuve de compréhension.</p>}</div>
    </div>
    <ScoreTrend hist={p.history || []} order={ORDER} colors={SKCOL} names={AB} y0={200} y1={699} ticks={[200, 300, 400, 500, 600, 699]} pl={40} get={(e, k) => e.scores && e.scores[k]} title="Évolution des scores" label="Scores TEF au fil du temps" />
    {p.setupDone ? <Setup c={c} /> : null}
  </>;
}

function Setup({ c, first }: P & { first?: boolean }) {
  const S = c.S; const p = S.profile;
  const [v, setV] = useState({ target: p.target, examDate: p.examDate, studyTime: p.studyTime, about: p.about });
  return (
    <div className={'panel' + (first ? '' : ' flat')}>
      <p className="eyebrow">{first ? 'Avant de commencer' : 'Réglages'}</p>
      {first ? <><h2>Configurez votre coach TEF</h2><p className="muted" style={{ maxWidth: '62ch' }}>Ces informations adaptent vos tests, la correction et votre parcours. Vous pourrez les modifier plus tard.</p></> : null}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <label className="stack" style={{ gap: 6 }}><span className="small muted">Objectif</span><select id="target" value={v.target} onChange={(e) => setV({ ...v, target: Number(e.target.value) })}>{[5, 6, 7, 8, 9, 10].map((x) => <option key={x} value={x}>NCLC {x}</option>)}</select></label>
        <label className="stack" style={{ gap: 6 }}><span className="small muted">Date de l’examen (si réservée)</span><input type="date" id="examdate" value={v.examDate} onChange={(e) => setV({ ...v, examDate: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="small muted">Temps d’étude</span><select id="set-time" value={v.studyTime} onChange={(e) => setV({ ...v, studyTime: e.target.value })}>{['30 minutes par jour', '1 heure par jour', '1 h 30 par jour', '2 heures ou plus par jour'].map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <label className="stack" style={{ gap: 6 }}><span className="small muted">À propos de vous (facultatif) : métier, pays, langues. Sert à rendre les exemples pertinents.</span><input type="text" id="set-about" maxLength={280} style={{ width: '100%' }} value={v.about} onChange={(e) => setV({ ...v, about: e.target.value })} placeholder="ex. Développeur en Tunisie, parle arabe et anglais" /></label>
      <p className="small muted">NCLC 7 dans les quatre compétences donne les points bonus pour le français dans l’Entrée express.</p>
      <div className="row">
        <button className={'btn ' + (first ? 'primary' : 'sm')} data-act="savesettings" onClick={() => c.saveSettings(v)}>{first ? 'Enregistrer et continuer' : 'Enregistrer'}</button>
        {first ? null : <span className="small muted">{S.confirmReset ? <>Tout effacer (résultats TEF, parcours) ? <button className="btn sm" data-act="reset-yes" onClick={() => c.resetAll()}>Tout effacer</button> <button className="btn sm" data-act="reset-no" onClick={() => c.confirm('confirmReset', false)}>Annuler</button></> : <button className="link" data-act="reset" onClick={() => c.confirm('confirmReset', true)}>Réinitialiser la progression TEF</button>}</span>}
      </div>
    </div>
  );
}

/* ---------- tests ---------- */
function Tests({ c }: P) {
  const app = useApp(); const S = c.S; const p = S.profile; const busy = !!p.activeAttemptId; const sel = S.mock;
  const types: [string, string, string][] = [['full', 'Test complet', '4 épreuves · environ 2 h 55'], ['L', 'Compréhension orale', '40 min · 40 questions'], ['R', 'Compréhension écrite', '60 min · 40 questions'], ['W', 'Expression écrite', '60 min · sections A et B'], ['S', 'Expression orale', '15 min · deux jeux de rôle']];
  const diffs: [string, string][] = [['auto', 'Auto'], ['foundation', 'Progressif'], ['exam', 'Niveau examen'], ['advanced', 'Avancé']];
  const gaps = ORDER.filter((k) => p.scores[k] != null).map((k) => ({ k, gap: minFor(k, p.target) - (p.scores[k] as number) })).sort((a, b) => b.gap - a.gap)[0];
  const u = S.usage; const left = u && u.sectionsLimit ? Math.max(0, u.sectionsLimit - u.sectionsUsed) : 0;
  return <>
    {!p.placementDone && !busy ? <div className="banner">Faites d’abord le test de positionnement pour que les tests blancs s’adaptent à votre niveau. <button className="btn sm primary" data-act="placement" onClick={() => c.placement()}>Commencer</button></div> : null}
    {busy ? <div className="banner">Un test est en cours. <button className="btn sm primary" data-act="resume" onClick={() => c.resume()}>Le reprendre</button></div> : null}
    {app.ent.tef?.paid ? (u && u.sectionsLimit ? <div className={'banner small' + (left < 8 ? '' : ' good')}>Ce mois-ci : {u.sectionsUsed} épreuves utilisées sur {u.sectionsLimit} ({left} restantes). Un test complet en utilise 4, un test d’une compétence en utilise 1. Remise à zéro le 1er du mois.</div> : null)
      : <div className="banner small">Offre gratuite : 1 test blanc par mois et 1 test de positionnement. <Link href="/plans">Voir les offres</Link> pour des tests illimités et des voix naturelles.</div>}
    <div className="panel"><p className="eyebrow">Générateur de tests blancs</p><h2>Créer un nouveau test blanc</h2>
      <p className="muted" style={{ maxWidth: '64ch' }}>Chaque test est inédit. Le mode Auto suit votre dernier score dans chaque compétence, et les épreuves de compréhension insistent sur les types de documents où vous perdez le plus de points.{gaps && gaps.gap > 0 ? <> Votre plus grand écart : <b>{SK[gaps.k]}</b> ({p.scores[gaps.k]} → {minFor(gaps.k, p.target)}).</> : null}</p>
      <div className="stack"><span className="eyebrow">Test</span><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        {types.map(([v, l, d]) => <label key={v} className="choice"><input type="radio" name="mtype" value={v} checked={sel.type === v} onChange={() => c.setMock({ type: v })} /><span className="mono">{v === 'full' ? '4' : AB[v]}</span><span><b>{l}</b><br /><span className="small muted">{d}</span></span></label>)}
      </div></div>
      <div className="stack"><span className="eyebrow">Difficulté</span>
        <div className="opts">{diffs.map(([v, l]) => <label key={v} className="opt"><input type="radio" name="mdiff" value={v} checked={sel.diff === v} onChange={() => c.setMock({ diff: v })} /><span>{l}</span></label>)}</div>
        <p className="small muted">{sel.diff === 'auto' ? (sel.type === 'full' ? ORDER : [sel.type]).map((k) => AB[k] + ' : ' + DIFF[c.autoDiff(k)].label).join(' · ') : 'Toutes les épreuves au niveau « ' + DIFF[sel.diff].label + ' ».'}</p>
      </div>
      <div className="row"><button className="btn primary" data-act="mock" disabled={busy} onClick={() => c.mock()}>Créer et commencer</button><span className="small muted">Le test est écrit pendant que vous lisez les consignes. La première partie est prête en une minute environ.</span></div>
    </div>
  </>;
}

/* ---------- déroulé du test ---------- */
function Intro({ c }: P) {
  const app = useApp(); const S = c.S; const run = S.run!; const k = c.nextSection(run); const done = run.sections.filter((x) => run.results[x]);
  const inProg = !!k && c.started(run, k) && !run.state[k].submitted;
  const gens = Object.values(S.gen);
  const busyGen = gens.some((g) => g === 'busy'); const failed = gens.find((g) => g && typeof g === 'object') as { err: string } | undefined;
  const ready = !!k && (jobCount(k) > 1 ? !!(run.content[k] && run.content[k][0]) : c.sectionReady(run, k));
  const prep: ReactNode[] = [];
  for (const s of run.sections) for (let i = 0; i < jobCount(s); i++) { const ok = run.content[s] && run.content[s][i]; const g = S.gen[s + i]; const name = jobCount(s) > 1 ? AB[s] + ' · partie ' + (i + 1) : SK[s] + ' · sujet'; prep.push(<div key={s + i} className="prep">{ok ? <span className="pill good">Prêt</span> : g && typeof g === 'object' ? <span className="pill bad">Échec</span> : <Spinner />}<span>{name}</span></div>); }
  const tts = !!app.ent.tef?.tts; const ul = { margin: 0, paddingLeft: 18 };
  const tips: Record<string, ReactNode> = {
    L: <ul className="small muted" style={ul}><li>Chaque document est lu <b>une seule fois</b> par {tts ? 'des voix naturelles de studio' : 'la voix de votre appareil'}, et vous ne pouvez pas revenir en arrière. Utilisez des écouteurs.</li><li>Lisez les questions avant de cliquer sur Écouter.</li><li>Les questions deviennent plus difficiles au fil des parties, comme à l’examen.</li>{c.tts ? null : <li><b>Aucune voix française dans ce navigateur :</b> chaque texte s’affiche une seule fois, puis disparaît.</li>}</ul>,
    R: <ul className="small muted" style={ul}><li>40 questions en 60 minutes : environ 1 min 30 par question. Ne restez pas bloqué.</li><li>Pas de point négatif : répondez à toutes les questions.</li></ul>,
    W: <ul className="small muted" style={ul}><li>Section A (25 min) puis section B (35 min), chronométrées séparément : on ne revient pas à la section A.</li><li>Le compteur de mots s’affiche, comme à l’examen sur ordinateur.</li></ul>,
    S: <ul className="small muted" style={ul}><li>Votre coach IA joue l’examinateur et vous répond{tts ? ' avec une voix naturelle' : ', avec la voix de votre appareil si elle existe'}.</li><li>{canDictate() ? <>Appuyez sur <b>Parler</b> et répondez à voix haute : vos phrases s’écrivent pendant que vous parlez.</> : 'Parlez en utilisant le micro de dictée de votre clavier : vos phrases s’écrivent pendant que vous parlez.'} Envoyez chaque réplique.</li><li>Section A : vouvoiement, une dizaine de questions. Section B : tutoiement, arguments et réponses aux objections.</li><li>La prononciation ne peut pas être évaluée à partir d’un texte.</li></ul>
  };
  return (
    <div className="panel">
      <div className="row between"><div><p className="eyebrow">{run.label}</p><h2>{k ? (inProg ? 'Reprendre : ' : 'Prochaine épreuve : ') + SK[k] : 'Toutes les épreuves sont terminées'}</h2></div><button className="btn sm" data-act="leave" onClick={() => c.leave()}>Enregistrer et quitter</button></div>
      {k ? <><p>{SEC[k].note}.</p>{tips[k]}</> : null}
      {done.length ? <p className="small muted">Terminé : {done.map((x) => AB[x] + ' ' + run.results[x].score).join(' · ')}</p> : null}
      <div className="row">
        {k ? (ready ? <button className="btn primary" data-act="start" data-k={k} onClick={() => c.startSection(k)}>{inProg ? 'Continuer' : 'Commencer · ' + SEC[k].time}</button> : <button className="btn primary" disabled>Préparation de l’épreuve…</button>) : null}
        {failed && !busyGen ? <button className="btn" data-act="regen" onClick={() => c.regen()}>Réessayer</button> : null}
      </div>
      {failed && !busyGen ? <p className="banner bad small">{failed.err}</p> : null}
      <div className="stack" style={{ gap: 8 }}><span className="eyebrow">Préparation du sujet</span><div className="prepgrid">{prep}</div></div>
    </div>
  );
}
function Marking({ c }: P) {
  const S = c.S; const k = S.sec;
  return <div className="panel"><p className="eyebrow">{SK[k]}</p>{S.markErr ? <><h2>La correction n’a pas abouti</h2><p>{S.markErr} Vos réponses sont enregistrées.</p><div className="row"><button className="btn primary" data-act="remark" onClick={() => c.remark()}>Relancer la correction</button><button className="btn" data-act="leave" onClick={() => c.leave()}>Enregistrer et quitter</button></div></> : <><div className="row"><Spinner /><h2>Correction en cours</h2></div><p className="muted">Correction selon les critères du TEF Canada. Cela prend généralement moins d’une minute.</p></>}</div>;
}
function ExamBar({ c, k, extra, noSubmit }: P & { k: string; extra?: string; noSubmit?: boolean }) {
  const S = c.S;
  return <>
    <div className="exambar"><div><div className="small" style={{ opacity: 0.75 }}>{S.run!.label}</div><b>{SK[k]}</b>{extra || ''}</div>
      <div className="row"><Timer left={() => c.timerLeft()} low={(l) => c.timerLow(l)} />{noSubmit ? null : <button className="btn sm" data-act="ask-submit" onClick={() => c.confirm('confirmSubmit', true)}>Terminer l’épreuve</button>}</div></div>
    {S.confirmSubmit ? <div className="banner">Terminer {SK[k].toLowerCase()} maintenant ? Vous ne pourrez pas y revenir. {unanswered(c, k)} <button className="btn sm primary" data-act="submit" onClick={() => c.submit()}>Terminer</button> <button className="btn sm" data-act="cancel-submit" onClick={() => c.confirm('confirmSubmit', false)}>Continuer</button></div> : null}
  </>;
}
function unanswered(c: TefCoach, k: string) {
  const run = c.S.run!;
  if (k === 'W') { const a = run.answers.W; return 'Section A : ' + words(a.A) + ' mots, section B : ' + words(a.B) + ' mots.'; }
  if (k === 'S') return '';
  const ans = run.answers[k] || {}; let tt = 0, u = 0; const ct = run.content[k] || {};
  for (const i in ct) ct[i].docs.forEach((d: any) => d.questions.forEach((q: any) => { tt++; if (!ans[q.n]) u++; }));
  return u ? u + ' question(s) sans réponse sur ' + tt + '.' : 'Toutes les questions ont une réponse.';
}
function WaitPanel({ c, label }: P & { label: string }) {
  const S = c.S; const g = S.gen[S.sec + (S.sec === 'L' ? S.run!.state.L.pos.p : S.tab)];
  return <div className="panel" id="waitpart">{g && typeof g === 'object' ? <><p className="banner bad">{g.err}</p><button className="btn" data-act="regen" onClick={() => c.regen()}>Réessayer</button></> : <><div className="row"><Spinner /><b>{label} est encore en cours d’écriture.</b></div><p className="muted">Elle apparaîtra ici dès qu’elle sera prête.</p></>}</div>;
}
function Qs({ c, k, qs }: P & { k: string; qs: any[] }) {
  const ans = c.S.run!.answers[k];
  return <>{qs.map((q) => (
    <div key={q.n} className="q"><span className="qn mono">{q.n}</span><div className="qbody"><p>{q.prompt}</p>
      <div className="mcq">{q.choices.map((ch: string, i: number) => { const L = 'ABCD'[i]; return <label key={L} className="choice"><input type="radio" name={'q' + q.n} value={L} data-n={q.n} checked={ans[q.n] === L} onChange={() => c.setAnswer(k, q.n, L)} /><span className="mono">{L}</span><span>{stripLetter(ch, L)}</span></label>; })}</div>
    </div></div>
  ))}</>;
}
function Section({ c }: P) {
  const k = c.S.sec;
  if (k === 'L') return <Listening c={c} />;
  if (k === 'R') return <Reading c={c} />;
  if (k === 'W') return <Writing c={c} />;
  return <Speaking c={c} />;
}
function Reading({ c }: P) {
  const S = c.S; const part = S.run!.content.R[S.tab];
  const tabs = <div className="tabs" role="tablist">{RPART.map((p, i) => <button key={i} role="tab" data-tab={i} aria-selected={S.tab === i} onClick={() => c.setTab(i)}>{i + 1} · {p.name}</button>)}</div>;
  if (!part) return <><ExamBar c={c} k="R" />{tabs}<WaitPanel c={c} label={'La partie ' + (S.tab + 1)} /></>;
  return <>
    <ExamBar c={c} k="R" />{tabs}
    {part.docs.map((d: any, i: number) => <div key={i} className="split"><div className="panel">{d.kind ? <span className="dockind">{d.kind}</span> : null}{d.heading ? <h3>{d.heading}</h3> : null}<div className="doc">{d.body}</div></div><div className="panel"><Qs c={c} k="R" qs={d.questions} /></div></div>)}
    <ReportBox fr state={S.reports['R' + S.tab]} k="R" i={S.tab} onOpen={() => c.reportOpen('R', S.tab)} onSend={(r) => c.reportSend('R', S.tab, r)} />
    <div className="row">{S.tab < 3 ? <button className="btn dark" data-tab={S.tab + 1} onClick={() => c.setTab(S.tab + 1)}>Partie suivante</button> : <button className="btn primary" data-act="ask-submit" onClick={() => c.confirm('confirmSubmit', true)}>Terminer la compréhension écrite</button>}</div>
  </>;
}
function Listening({ c }: P) {
  const app = useApp(); const S = c.S; const run = S.run!; const pos = run.state.L.pos; const { part, doc } = c.curDoc(run);
  const head = <p className="small muted">Partie {pos.p + 1} sur 4 · {LPART[Math.min(pos.p, 3)].name}</p>;
  if (!part) return <><ExamBar c={c} k="L" noSubmit />{head}<WaitPanel c={c} label={'La partie ' + (pos.p + 1)} /></>;
  const key = pos.p + '_' + pos.d; const st = run.state.L.played[key];
  const player = c.tts || app.ent.tef?.tts
    ? <div className="player"><button className="btn primary" data-act="play" disabled={!!st} onClick={() => c.playDoc()}>{st === 'done' ? 'Écouté' : st === 'playing' ? 'Écoute en cours…' : 'Écouter le document'}</button><div className="meter" aria-hidden="true"><i id="lmeter" style={{ width: (st === 'done' ? 100 : st === 'playing' ? S.lmeter : 0) + '%' }} /></div><span className="small muted" id="lstatus">{st ? S.lstatus : 'Une seule écoute'}</span></div>
    : <><div className="player"><button className="btn primary" data-act="readonce" disabled={!!st} onClick={() => c.readOnce()}>{st ? 'Texte affiché' : 'Afficher le texte une fois'}</button><span className="small muted">Aucune voix française : le texte s’affiche une fois, puis disparaît.</span></div>
      <div id="readonce" className="panel flat" hidden={!S.readOnceText}>{(S.readOnceText || []).map((l, i) => <p key={i}><b>{l.speaker} :</b> {l.text}</p>)}</div></>;
  const last = pos.p === 3 && pos.d === part.docs.length - 1;
  return <>
    <ExamBar c={c} k="L" noSubmit />{head}
    <div className="panel"><p className="eyebrow">Document {pos.d + 1} sur {part.docs.length}</p><p><b>{doc.context}</b></p>{player}<Qs c={c} k="L" qs={doc.questions} />
      <ReportBox fr state={S.reports['L' + pos.p]} k="L" i={pos.p} onOpen={() => c.reportOpen('L', pos.p)} onSend={(r) => c.reportSend('L', pos.p, r)} />
      <div className="row"><button className={'btn ' + (last ? 'primary' : 'dark')} data-act="nextdoc" disabled={st === 'playing'} onClick={() => c.nextDoc()}>{last ? 'Terminer la compréhension orale' : 'Document suivant'}</button><span className="small muted">Pas de retour en arrière.</span></div>
    </div>
  </>;
}
function Writing({ c }: P) {
  const S = c.S; const run = S.run!; const w = run.content.W[0]; const st = run.state.W; const a = run.answers.W; const sec: 'A' | 'B' = st.phase;
  const task = sec === 'A' ? <><p className="eyebrow">Section A · 25 minutes · 80 mots minimum</p><div className="ad">{w.A.source}</div><p><b>{w.A.consigne}</b></p></> : <><p className="eyebrow">Section B · 35 minutes · 200 mots minimum</p><div className="ad">{w.B.statement}</div><p><b>{w.B.consigne}</b></p></>;
  const val = a[sec] || ''; const min = sec === 'A' ? 80 : 200; const n = words(val);
  return <>
    <ExamBar c={c} k="W" extra={' · section ' + sec} noSubmit={sec === 'A'} />
    {S.confirmNext ? <div className="banner">Passer à la section B ? Vous ne pourrez pas revenir à la section A ({words(a.A)} mots). <button className="btn sm primary" data-act="tob" onClick={() => c.toPhaseB('W')}>Passer à la section B</button> <button className="btn sm" data-act="cancel-next" onClick={() => c.confirm('confirmNext', false)}>Continuer</button></div> : null}
    <div className="split"><div className="panel">{task}</div>
      <div className="panel"><label htmlFor="wtext" className="eyebrow">Votre texte</label><textarea key={sec} id="wtext" className="big" data-w={sec} spellCheck={false} lang="fr" value={val} onChange={(e) => c.setWriting(sec, e.target.value)} />
        <div className="row between"><span className={'wc' + (n >= min ? ' ok' : '')} id="wc">{n} mots</span>{sec === 'A' ? <button className="btn dark" data-act="ask-next" onClick={() => c.confirm('confirmNext', true)}>Passer à la section B</button> : <button className="btn primary" data-act="ask-submit" onClick={() => c.confirm('confirmSubmit', true)}>Terminer l’expression écrite</button>}</div>
      </div>
    </div>
  </>;
}
function Speaking({ c }: P) {
  const app = useApp(); const S = c.S; const run = S.run!; const cs = run.content.S[0]; const st = run.state.S;
  const box = useRef<HTMLTextAreaElement>(null); const chat = useRef<HTMLDivElement>(null);
  const log: any[] = st.phase === 'A' || st.phase === 'B' ? run.answers.S[st.phase] : [];
  useEffect(() => { box.current?.focus(); if (chat.current) chat.current.scrollTop = chat.current.scrollHeight; }, [log.length, S.exBusy, st.phase]);
  if (st.phase === 'Bwait' || (st.phase === 'A' && !run.answers.S.A.length)) {
    const sec: 'A' | 'B' = st.phase === 'A' ? 'A' : 'B'; const d = cs[sec];
    return <>
      <ExamBar c={c} k="S" extra={' · section ' + sec} noSubmit />
      <div className="panel"><p className="eyebrow">Section {sec} · {sec === 'A' ? '5' : '10'} minutes</p><h2>{sec === 'A' ? 'Obtenir des informations' : 'Convaincre un(e) ami(e)'}</h2><div className="ad">{d.ad}</div>
        <p>{sec === 'A' ? 'Vous avez lu cette annonce et vous téléphonez pour obtenir plus d’informations. Posez une dizaine de questions. L’examinateur joue le rôle de ' + d.role + '. Vouvoiement.' : 'Vous avez lu cette annonce. Vous essayez de convaincre un(e) ami(e) de ' + d.goal + '. L’examinateur joue votre ami(e) : il va faire des objections. Tutoiement.'}</p>
        <div className="row"><button className="btn primary" data-act="speakstart" data-sec={sec} onClick={() => c.beginSpeak(sec)}>Commencer la section {sec}</button><span className="small muted">Le chronomètre démarre au clic.</span></div>
      </div>
    </>;
  }
  const sec: 'A' | 'B' = st.phase; const d = cs[sec];
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); c.sendSpeak(); } };
  return <>
    <ExamBar c={c} k="S" extra={' · section ' + sec} noSubmit />
    <div className="split">
      <div className="panel"><p className="eyebrow">Section {sec} · {sec === 'A' ? 'vouvoiement' : 'tutoiement'}</p><div className="ad small">{d.ad}</div>{sec === 'B' ? <p className="small"><b>Objectif :</b> convaincre votre ami(e) de {d.goal}.</p> : null}</div>
      <div className="panel">
        <div className="chat" id="chat" ref={chat} aria-live="polite">{log.map((m, i) => <div key={i} className={'msg ' + (m.role === 'ex' ? 'ex' : 'me')}>{m.text}</div>)}{S.exBusy ? <div className="msg ex"><Spinner style={{ display: 'inline-block', verticalAlign: 'middle' }} /></div> : null}</div>
        <label htmlFor="spk" className="eyebrow">Votre réplique (dictée)</label>
        <textarea ref={box} id="spk" lang="fr" placeholder={canDictate() ? 'Appuyez sur Parler, ou écrivez…' : 'Touchez le micro de votre clavier et parlez…'} value={S.draft || ''} onChange={(e) => c.setDraft(e.target.value)} onKeyDown={onKey} />
        <div className="row between">
          <div className="row"><MicButton act="mic" label="Parler" stopLabel="Arrêter" onClick={() => c.mic()} />{c.tts || app.ent.tef?.tts ? <button className="btn sm" data-act="repeat" onClick={() => c.repeat()}>Réécouter</button> : null}
            <button className="btn sm" data-act={sec === 'A' ? 'endA' : 'ask-submit'} onClick={() => (sec === 'A' ? c.toPhaseB('S') : c.confirm('confirmSubmit', true))}>{sec === 'A' ? 'Passer à la section B' : 'Terminer l’oral'}</button></div>
          <button className="btn primary" data-act="send" disabled={S.exBusy} onClick={() => c.sendSpeak()}>Envoyer</button>
        </div>
      </div>
    </div>
    {S.confirmSubmit && sec === 'B' ? <div className="banner">Terminer l’expression orale ? <button className="btn sm primary" data-act="submit" onClick={() => c.submit()}>Terminer</button> <button className="btn sm" data-act="cancel-submit" onClick={() => c.confirm('confirmSubmit', false)}>Continuer</button></div> : null}
  </>;
}

/* ---------- bilan ---------- */
function ReviewList({ r }: { r: any }) {
  const wrong = r.items.filter((i: any) => !i.ok);
  const it = (i: any) => (
    <div key={i.n} className="ritem"><span className={'qn mono ' + (i.ok ? 'ok' : '')}>{i.n}</span><div className="stack" style={{ gap: 4 }}>
      <p>{i.prompt}</p>
      <p className="small">Votre réponse : <b>{i.given ? i.given + ' · ' + stripLetter(i.choices['ABCD'.indexOf(i.given)] || '', i.given) : <span className="muted">aucune</span>}</b><br />Bonne réponse : <b style={{ color: 'var(--good)' }}>{i.correct + ' · ' + stripLetter(i.choices['ABCD'.indexOf(i.correct)] || '', i.correct)}</b> · <span className="muted">{TYPE_NAMES[i.type] || i.type}</span></p>
      {i.evidence ? <p className="quote small">{i.evidence}</p> : null}{i.explain ? <p className="small">{i.explain}</p> : null}
    </div></div>
  );
  return <><details open={wrong.length <= 12}><summary>{wrong.length} réponses fausses ou vides</summary><div className="review">{wrong.map(it)}</div></details><details><summary>Les {r.total} réponses</summary><div className="review">{r.items.map(it)}</div></details></>;
}
function SectionReport({ c, k, r }: P & { k: string; r: any }) {
  const n = nclcOf(k, r.score)!; const tgt = c.S.profile.target;
  const body = k === 'L' || k === 'R'
    ? <><p className="mono">{r.raw} / {r.total} bonnes réponses</p><p className="small muted">Score estimé à partir du nombre de bonnes réponses. Le vrai TEF pondère chaque question selon sa difficulté.</p><div className="tablewrap"><table><thead><tr><th>Type de document</th><th className="mono">Réussite</th></tr></thead><tbody>{Object.entries(r.per).map(([tp, v]: [string, any]) => <tr key={tp}><td>{TYPE_NAMES[tp] || tp}</td><td className="mono">{v.c} / {v.t}</td></tr>)}</tbody></table></div><ReviewList r={r} /></>
    : <>
      {k === 'W' ? <><p><b>Section A</b> ({r.wc.A} mots). {r.A.summary || ''}</p><p><b>Section B</b> ({r.wc.B} mots). {r.B.summary || ''}</p></> : <><p>{r.summary}</p><p className="small muted">Section A : {r.turns.A} répliques · section B : {r.turns.B} répliques. Prononciation non évaluée.</p></>}
      {r.criteria.length ? <div className="tablewrap"><table><thead><tr><th>Critère</th><th>Niveau</th><th>Commentaire</th></tr></thead><tbody>{r.criteria.map((cr: any, i: number) => <tr key={i}><td>{cr.name}</td><td className="mono">{cr.level}</td><td>{cr.comment}</td></tr>)}</tbody></table></div> : null}
      {r.missed && r.missed.length ? <><h3>Questions que vous auriez pu poser</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{r.missed.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></> : null}
      {r.errors.length ? <><h3>Erreurs relevées</h3><ErrTable errs={r.errors} head={ERR_HEAD} /></> : null}
      {r.patterns.length ? <><h3>Erreurs récurrentes</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{r.patterns.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></> : null}
      {r.model && r.model.better ? <><h3>Version NCLC 9</h3><p className="small muted">{r.model.task || ''}</p><p className="quote">{r.model.original || ''}</p><div className="model">{r.model.better}</div></> : null}
      {r.next.length ? <><h3>Priorités</h3><ol style={{ margin: 0, paddingLeft: 20 }}>{r.next.map((p: string, i: number) => <li key={i}>{p}</li>)}</ol></> : null}
    </>;
  return (
    <div className="panel">
      <div className="row between"><div className="row"><span className="letter" style={{ background: SKCOL[k] }}>{AB[k]}</span><h2>{SK[k]}</h2></div><div className="row" style={{ alignItems: 'baseline' }}><span className="bigband mono" style={{ fontSize: '2.4rem' }}>{r.score}</span><span className={'pill ' + (n >= tgt ? 'good' : n >= tgt - 1 ? 'warn' : 'bad')}>NCLC {nclcTxt(n)} · objectif {tgt}</span></div></div>
      {body}
    </div>
  );
}
function Report({ c }: P) {
  const S = c.S; const run = S.reportRun; if (!run) return <div className="panel"><p className="muted">Chargement…</p></div>;
  const ks = run.sections.filter((k) => run.results[k]); const tgt = S.profile.target;
  const below = ks.filter((k) => nclcOf(k, run.results[k].score)! < tgt);
  const pats: string[] = []; ks.forEach((k) => { const r = run.results[k]; if (r.patterns) pats.push(...r.patterns); });
  const weak: string[] = []; ['L', 'R'].forEach((k) => { const r = run.results[k]; if (r) for (const tp in r.per) { const v = r.per[tp]; if (v.t && v.c / v.t < 0.6) weak.push((TYPE_NAMES[tp] || tp) + ' (' + v.c + '/' + v.t + ')'); } });
  return <>
    <div className="row"><button className="btn sm" data-nav="history" onClick={() => c.nav('history')}>← Tous les résultats</button></div>
    <div className="panel"><p className="eyebrow">Bilan · {run.date}</p><h1>{run.label}</h1>
      <div className="row">{ks.map((k) => <span key={k} className="pill"><b>{AB[k]}</b>&nbsp;<span className="mono">{run.results[k].score}</span>&nbsp;· NCLC {nclcTxt(nclcOf(k, run.results[k].score))}</span>)}{run.nclc != null ? <span className="pill ink">Global NCLC {nclcTxt(run.nclc)}</span> : null}</div>
      <p>{below.length ? 'Verdict honnête : pas encore NCLC ' + tgt + ' en ' + below.map((k) => SK[k].toLowerCase() + ' (il faut ' + minFor(k, tgt) + ')').join(', ') + '.' : 'Ces résultats atteignent votre objectif NCLC ' + tgt + '. Stabilisez ce niveau.'}</p>
      {weak.length ? <p><b>Documents à travailler :</b> {weak.join(', ')}</p> : null}
      {pats.length ? <p><b>Erreurs à surveiller :</b> {pats.slice(0, 4).join(' ; ')}</p> : null}
      <div className="row">{run.kind === 'placement' ? <button className="btn primary" data-act="build" onClick={() => c.buildCourse()}>{S.course ? 'Recréer mon parcours avec ces résultats' : 'Créer mon parcours avec ces résultats'}</button> : null}<button className="btn" data-nav="tests" onClick={() => c.nav('tests')}>Nouveau test blanc</button></div>
    </div>
    {ks.map((k) => <SectionReport key={k} c={c} k={k} r={run.results[k]} />)}
  </>;
}
function History({ c }: P) {
  const hist = [...(c.S.profile.history || [])].reverse();
  return (
    <div className="panel"><h2>Résultats</h2>
      {hist.length ? <div className="tablewrap"><table><thead><tr><th>Date</th><th>Test</th>{ORDER.map((k) => <th key={k} className="mono">{AB[k]}</th>)}<th>NCLC</th><th /></tr></thead><tbody>
        {hist.map((e) => <tr key={e.id}><td className="mono">{e.date}</td><td>{e.label}</td>{ORDER.map((k) => <td key={k} className="mono">{e.scores && e.scores[k] != null ? e.scores[k] : '–'}</td>)}<td className="mono">{nclcTxt(e.nclc)}</td><td><button className="btn sm" data-report={e.id} onClick={() => c.openReport(e.id)}>Ouvrir</button></td></tr>)}
      </tbody></table></div> : <p className="muted">Aucun résultat pour l’instant. Votre test de positionnement apparaîtra ici.</p>}
    </div>
  );
}

/* ---------- parcours ---------- */
function Course({ c }: P) {
  const app = useApp(); const S = c.S;
  if (!app.ent.tef?.course) return <Upsell exam="tef" title="Votre parcours personnalisé" text="Un parcours de 12 unités construit sur vos résultats, avec leçons, quiz, tâches corrigées et tests d’étape chronométrés." />;
  if (S.courseBusy) return <div className="panel"><div className="row"><Spinner /><h2>Création de votre parcours</h2></div><p className="muted">12 unités construites à partir de vos scores et de vos erreurs. Cela prend jusqu’à une minute.</p></div>;
  if (!S.course) return (
    <div className="panel"><p className="eyebrow">Parcours personnalisé</p><h2>Un parcours construit sur vos résultats</h2>
      <p style={{ maxWidth: '64ch' }}>Douze unités : chacune travaille un point précis, avec une leçon courte, un quiz de 10 questions et une tâche corrigée par votre coach IA. Les unités 4, 8 et 12 sont des tests chronométrés. {S.profile.placementDone ? 'Le parcours utilise vos résultats au test de positionnement.' : 'Pour un meilleur parcours, faites d’abord le test de positionnement.'}</p>
      {S.courseErr ? <p className="banner bad">{S.courseErr}</p> : null}
      <div className="row"><button className="btn primary" data-act="build" onClick={() => c.buildCourse()}>Créer mon parcours</button>{!S.profile.placementDone ? <button className="btn" data-act="placement" onClick={() => c.placement()}>D’abord le test de positionnement</button> : null}</div>
    </div>
  );
  const co = S.course; const prog = co.progress || {}; const units = c.allUnits(); const done = units.filter((u) => (prog[u.id] || {}).done).length;
  return <>
    <div className="panel"><div className="row between"><div><p className="eyebrow">Votre parcours · {done} unités sur {units.length}</p><h2>{co.title}</h2></div><button className="btn sm" data-act="build" onClick={() => c.buildCourse()}>Recréer avec mes derniers résultats</button></div><p className="muted" style={{ maxWidth: '68ch' }}>{co.summary}</p>{S.courseErr ? <p className="banner bad">{S.courseErr}</p> : null}</div>
    {co.phases.map((ph: any, pi: number) => (
      <div key={pi} className="phase"><h3>{ph.name}</h3>
        {ph.units.map((u: any) => {
          const p = prog[u.id];
          const pill = p && p.done ? <span className="pill good">{p.nclc != null ? 'NCLC ' + nclcTxt(p.nclc) : p.score != null ? p.score + ' %' : 'Fait'}</span> : p && p.score != null ? <span className="pill warn">{p.score} % · à refaire</span> : u.checkpoint ? <span className="pill ink">Test d’étape</span> : <span className="pill">À faire</span>;
          return <button key={u.id} className="unit" data-unit={u.id} onClick={() => c.openUnit(u.id)}><span className="letter" style={{ background: SKCOL[u.skill], height: 34 }}>{AB[u.skill]}</span><span><b>{u.title}</b><br /><span className="small muted">{u.goal}</span></span>{pill}</button>;
        })}
      </div>
    ))}
  </>;
}
function Lesson({ c }: P) {
  const S = c.S; const u = S.lessonUnit;
  const head = <><div className="row"><button className="btn sm" data-nav="course" onClick={() => c.nav('course')}>← Parcours</button></div><div className="panel"><p className="eyebrow">{SK[u.skill]}{u.checkpoint ? ' · test d’étape' : ''}</p><h1>{u.title}</h1><p className="muted">{u.goal}</p></div></>;
  if (u.checkpoint) return <>{head}<div className="panel"><h2>Test d’étape : {SK[u.skill].toLowerCase()}</h2><p>{SEC[u.skill].note}. Sujet inédit, à votre niveau actuel. Le résultat met à jour votre score et valide cette unité.</p><div className="row"><button className="btn primary" data-act="checkpoint" disabled={!!S.profile.activeAttemptId} onClick={() => c.checkpoint()}>Commencer le test d’étape</button>{S.profile.activeAttemptId ? <span className="small muted">Terminez ou abandonnez d’abord le test en cours.</span> : null}</div></div></>;
  if (S.lessonBusy) return <>{head}<div className="panel"><div className="row"><Spinner /><b>Écriture de la leçon…</b></div></div></>;
  if (S.lessonErr) return <>{head}<div className="panel"><p className="banner bad">{S.lessonErr}</p><button className="btn primary" data-act="relesson" onClick={() => c.relesson()}>Réessayer</button></div></>;
  const l = S.lesson; if (!l) return head;
  const fb = S.taskFb;
  return <>
    {head}
    <div className="panel"><p style={{ maxWidth: '68ch' }}>{l.intro}</p>{toArr<any>(l.teach).map((tb, i) => <div key={i} className="stack" style={{ gap: 8 }}><h3>{tb.heading}</h3><p style={{ maxWidth: '68ch' }}>{tb.body}</p>{toArr<any>(tb.examples).map((e, j) => <div key={j} className="ex">{e.wrong ? <span className="w">{e.wrong}</span> : null}<span className="r">{e.right}</span></div>)}</div>)}</div>
    {toArr(l.phrases).length ? <div className="panel"><h3>Expressions à utiliser</h3><div className="tablewrap"><table><tbody>{l.phrases.map((p: any, i: number) => <tr key={i}><td><b>{p.phrase}</b></td><td className="muted">{p.use}</td></tr>)}</tbody></table></div></div> : null}
    <div className="panel">
      <div className="row between"><h3>Quiz · {l.quiz.length} questions</h3>{S.quizChecked ? <span className={'pill ' + (S.quizScore >= 70 ? 'good' : 'bad') + ' mono'}>{S.quizScore} %{S.quizScore >= 70 ? ' · unité validée' : ' · 70 % pour valider'}</span> : null}</div>
      {l.quiz.map((q: any, i: number) => (
        <div key={i} className="q"><span className="qn mono">{i + 1}</span><div className="qbody"><p>{q.prompt}</p>
          {q.type === 'mcq' ? <div className="mcq">{toArr<string>(q.choices).map((ch, ci) => { const L = 'ABCD'[ci]; return <label key={L} className="choice"><input type="radio" name={'lq' + i} value={L} checked={q._given === L} onChange={() => c.setQuizAnswer(i, L)} /><span className="mono">{L}</span><span>{stripLetter(ch, L)}</span></label>; })}</div>
            : <input type="text" id={'lq' + i} value={q._given || ''} onChange={(e) => c.setQuizAnswer(i, e.target.value)} autoComplete="off" lang="fr" />}
          {S.quizChecked ? <p className="small" style={{ color: q._ok ? 'var(--good)' : 'var(--bad)' }}>{q._ok ? 'Exact. ' : 'Réponse : ' + toArr(q.answer).join(' / ') + '. '}<span className="muted">{q.explain || ''}</span></p> : null}
        </div></div>
      ))}
      <div className="row"><button className="btn primary" data-act="checkquiz" onClick={() => c.checkQuiz()}>{S.quizChecked ? 'Vérifier à nouveau' : 'Vérifier mes réponses'}</button></div>
    </div>
    {l.task ? (
      <div className="panel"><h3>À vous · {l.task.kind === 'speak' ? 'à l’oral (dictée)' : 'à l’écrit'}</h3><p>{l.task.prompt}</p>
        <textarea id="taskans" lang="fr" placeholder={l.task.kind === 'speak' ? 'Utilisez le micro de votre clavier et parlez…' : 'Écrivez ici…'} value={S.taskAns || ''} onChange={(e) => { S.taskAns = e.target.value; c.emit(); }} />
        <div className="row"><MicButton act="mictask" label="Parler" stopLabel="Arrêter" onClick={() => c.micTask()} /><button className="btn primary" data-act="taskfb" disabled={S.taskBusy} onClick={() => c.taskFeedback()}>{S.taskBusy ? 'Correction…' : 'Obtenir une correction'}</button>{S.taskBusy ? <Spinner /> : null}</div>
        {fb ? (fb.err ? <p className="banner bad">{fb.err}</p> : <div className="stack"><div className="row"><span className="pill ink">NCLC {fb.nclc}</span></div><p>{fb.verdict}</p><p className="small">{fb.used_point || ''}</p><ErrTable errs={toArr(fb.errors)} head={ERR_HEAD} />{fb.better ? <><h3>Version NCLC 9</h3><div className="model">{fb.better}</div></> : null}</div>) : null}
      </div>
    ) : null}
  </>;
}
