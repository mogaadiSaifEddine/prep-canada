'use client';
// Pieces shared by the IELTS and TEF coach views.
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { fmtDate, fmtTND, planLabel } from '@/lib/client/format';
import { canDictate, useDictation } from '@/lib/client/dictation';
import { fmtTime } from '@/lib/coach/common';

/** Re-render once a second (exam clocks). */
export function useTick(on = true) {
  const [, set] = useState(0);
  useEffect(() => { if (!on) return; const iv = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(iv); }, [on]);
}

export function Timer({ left, low }: { left: () => number | null; low: (ms: number) => boolean }) {
  useTick();
  const l = left();
  return <span className={'timer mono' + (l != null && low(l) ? ' low' : '')} id="timer" aria-live="off">{l != null ? fmtTime(l) : '--:--'}</span>;
}

export function PlanPill({ exam }: { exam: 'ielts' | 'tef' }) {
  const app = useApp(); const e = app.ent[exam]; const p = app.me && app.me.plan;
  const fr = exam === 'tef';
  if (e?.paid && p) return <Link className="pill good" href="/account">{planLabel(p)} · {fr ? 'jusqu’au ' : 'until '}{fmtDate(p.until)}</Link>;
  return <Link className="pill" href="/plans">{fr ? 'Offre gratuite · voir les offres' : 'Free plan · see plans'}</Link>;
}

export function Upsell({ exam, title, text }: { exam: 'ielts' | 'tef'; title: string; text: string }) {
  const { config } = useApp(); const fr = exam === 'tef';
  return (
    <div className="panel"><p className="eyebrow">Solo &amp; Duo</p><h2>{title}</h2><p style={{ maxWidth: '62ch' }}>{text}</p>
      <div className="row"><Link className="btn primary" href="/plans">{fr ? 'Voir les offres' : 'See plans'}</Link><span className="small muted">{fr ? 'À partir de ' : 'From '}{fmtTND(config.prices.solo.month || 15)}{fr ? ' par mois' : ' a month'}</span></div>
    </div>
  );
}

const MIC = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export function MicButton({ act, label, stopLabel, onClick }: { act: string; label: string; stopLabel: string; onClick: () => void }) {
  const on = useDictation();
  if (!canDictate()) return null;
  return <button type="button" className={'btn mic' + (on ? ' on' : '')} data-act={act} data-label={label} onClick={onClick}>{MIC}<span>{on ? stopLabel : label}</span></button>;
}

export function ErrTable({ errs, head }: { errs: any[] | undefined; head: [string, string, string] }) {
  if (!errs || !errs.length) return null;
  return (
    <div className="tablewrap"><table><thead><tr><th>{head[0]}</th><th>{head[1]}</th><th>{head[2]}</th></tr></thead><tbody>
      {errs.map((e, i) => <tr key={i}><td style={{ color: 'var(--bad)' }}>{e.quote}</td><td style={{ color: 'var(--good)' }}>{e.fix}</td><td>{e.reason}</td></tr>)}
    </tbody></table></div>
  );
}

/** "Report a problem with this part" under a test part. */
export function ReportBox({ state, k, i, fr, onOpen, onSend }: { state: string | undefined; k: string; i: number; fr?: boolean; onOpen: () => void; onSend: (reason: string) => void }) {
  const opts = fr ? ['Mauvaise réponse dans le corrigé', 'Question ambiguë', 'Le texte ou l’audio ne correspond pas aux questions', 'Autre'] : ['Wrong answer key', 'Question unclear or ambiguous', 'Text or audio doesn\'t match the questions', 'Other'];
  const [reason, setReason] = useState(opts[0]);
  const key = k + i;
  if (state === 'sent') return <p className="small muted">{fr ? 'Merci, votre signalement a été envoyé.' : 'Thanks, your report was sent.'}</p>;
  if (state !== 'open') return <p className="small"><button className="link" data-act="report-open" data-k={k} data-i={i} onClick={onOpen}>{fr ? 'Signaler un problème dans cette partie' : 'Report a problem with this part'}</button></p>;
  return (
    <div className="row small"><label htmlFor={'rep-' + key} className="muted">{fr ? 'Quel est le problème ?' : 'What\'s wrong?'}</label>
      <select id={'rep-' + key} value={reason} onChange={(e) => setReason(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
      <button className="btn sm" data-act="report-send" data-k={k} data-i={i} onClick={() => onSend(reason)}>{fr ? 'Envoyer' : 'Send'}</button>
    </div>
  );
}

/** Score history chart (bands for IELTS, scores for TEF). */
export function ScoreTrend({ hist, order, colors, names, y0, y1, ticks, pl, get, title, label }: { hist: any[]; order: string[]; colors: Record<string, string>; names: Record<string, string>; y0: number; y1: number; ticks: number[]; pl: number; get: (e: any, k: string) => number | null | undefined; title: string; label: string }) {
  if (!hist.length) return null;
  const W = 640, H = 220, pr = 14, pt = 14, pb = 28;
  const n = hist.length; const x = (i: number) => (n === 1 ? pl + (W - pl - pr) / 2 : pl + i * (W - pl - pr) / (n - 1)); const y = (b: number) => pt + (y1 - b) / (y1 - y0) * (H - pt - pb);
  const lines: ReactNode[] = [];
  for (const k of order) {
    const pts = hist.map((e, i) => { const v = get(e, k); return v != null ? [x(i), y(Math.max(y0, v))] : null; }).filter((p): p is number[] => !!p);
    if (!pts.length) continue;
    if (pts.length > 1) lines.push(<polyline key={'l' + k} fill="none" stroke={colors[k]} strokeWidth="2.5" strokeLinejoin="round" points={pts.map((p) => p.join(',')).join(' ')} />);
    pts.forEach((p, i) => lines.push(<circle key={k + i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4.5 : 3} fill={colors[k]} />));
  }
  return (
    <div className="panel chart"><div className="row between"><h3>{title}</h3><div className="legend">{order.map((k) => <span key={k}><i style={{ background: colors[k] }} />{names[k]}</span>)}</div></div>
      <svg viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={label}>
        {ticks.map((b) => <g key={b}><line x1={pl} x2={W - pr} y1={y(b)} y2={y(b)} stroke="var(--line)" strokeWidth="1" /><text x={pl - 8} y={y(b) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="IBM Plex Mono,monospace">{b}</text></g>)}
        {lines}
        {hist.map((e, i) => (n <= 8 || i === 0 || i === n - 1) ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="IBM Plex Mono,monospace">{String(e.date).slice(5)}</text> : null)}
      </svg>
    </div>
  );
}

/** Split a reading text into paragraphs, with the "A", "B"… paragraph labels shown in a badge. */
export function Paragraphs({ body }: { body: string }) {
  return <>{String(body).split(/\n\s*\n/).map((p, i) => { const m = p.match(/^\s*([A-H])[\).:\s]\s*/); return <p key={i}>{m ? <><span className="plabel">{m[1]}</span>{p.slice(m[0].length)}</> : p}</p>; })}</>;
}
