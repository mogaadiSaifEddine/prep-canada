'use client';
// Admin (English only, as before): KPIs, payments to approve, AI costs and the test pool,
// invitation rounds, users.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { Spinner } from '@/components/app/ui';
import { api } from '@/lib/client/api';
import { fmtDate, fmtTND, planLabel } from '@/lib/client/format';

const SKN: Record<string, string> = { L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' };

export default function AdminPage() {
  const app = useApp();
  useEffect(() => { if (app.me && !app.me.isAdmin) app.go('/'); }, [app]);
  const [tick, setTick] = useState(0); // bump to reload everything
  const reload = () => setTick((n) => n + 1);
  if (!app.me?.isAdmin) return null;
  return (
    <Page>
      <div><p className="eyebrow">Admin</p><h1>Overview</h1></div>
      <Kpis tick={tick} />
      <Payments tick={tick} onChange={reload} />
      <Costs tick={tick} onChange={reload} />
      <Draws />
      <Users />
    </Page>
  );
}

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const app = useApp();
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => fn().then(setData).catch((e) => app.handleError(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps);
  useEffect(() => { load(); }, [load]);
  return [data, load] as const;
}

function Kpis({ tick }: { tick: number }) {
  const [s] = useLoad(() => api<any>('GET', '/api/admin/stats'), [tick]);
  if (!s) return <div className="kpis" id="kpis"><Spinner /></div>;
  const act = s.active.reduce((a: number, x: any) => a + x.n, 0);
  const rows: [string, string | number][] = [['Users', s.users], ['Active paid plans', act], ['Revenue this month', fmtTND(s.revenueMonth)], ['Payments to review', s.toReview], ['Tests started (7 days)', s.testsWeek]];
  return <div className="kpis" id="kpis">{rows.map(([l, v]) => <div key={l} className="panel kpi"><span className="small muted">{l}</span><b>{v}</b></div>)}</div>;
}

function Payments({ tick, onChange }: { tick: number; onChange: () => void }) {
  const app = useApp();
  const [st, setSt] = useState('review');
  const [r] = useLoad(() => api<any>('GET', '/api/admin/payments?status=' + st), [st, tick]);
  const act = async (id: string, a: 'approve' | 'reject') => {
    try { await api('POST', '/api/admin/payments/' + id + '/' + a); app.toast(a === 'approve' ? 'Approved. The plan is active.' : 'Rejected.'); onChange(); } catch (e) { app.handleError(e); }
  };
  return (
    <div className="panel">
      <div className="row between"><h2>Payments</h2>
        <select id="adm-pst" value={st} onChange={(e) => setSt(e.target.value)}><option value="review">Waiting for review</option><option value="pending">Pending (online)</option><option value="paid">Paid</option><option value="all">All</option></select>
      </div>
      <div id="adm-pays">{!r ? <Spinner /> : r.payments.length ? (
        <div className="tablewrap"><table><thead><tr><th>Date</th><th>User</th><th>Plan</th><th className="mono">Amount</th><th>Method / ref</th><th>Status</th><th /></tr></thead><tbody>
          {r.payments.map((x: any) => (
            <tr key={x.id}><td className="mono">{fmtDate(x.createdAt)}</td><td>{x.email}</td><td>{planLabel({ plan: x.plan, exam: x.exam })} · {x.period}</td><td className="mono">{fmtTND(x.amount)}</td>
              <td>{x.method}{x.reference ? <><br /><span className="mono small" style={{ userSelect: 'all' }}>{x.reference}</span></> : null}</td><td>{x.status}</td>
              <td>{x.status !== 'paid' && x.status !== 'rejected' ? <div className="row"><button className="btn sm primary" data-sa="adm-approve" data-id={x.id} onClick={() => act(x.id, 'approve')}>Approve</button><button className="btn sm" data-sa="adm-reject" data-id={x.id} onClick={() => act(x.id, 'reject')}>Reject</button></div> : null}</td></tr>
          ))}
        </tbody></table></div>
      ) : <p className="muted">Nothing here.</p>}</div>
    </div>
  );
}

function Costs({ tick, onChange }: { tick: number; onChange: () => void }) {
  const app = useApp();
  const [r, reload] = useLoad(() => api<any>('GET', '/api/admin/costs'), [tick]);
  const [fill, setFill] = useState({ exam: 'ielts', k: 'all', diff: 'exam', n: '3', audio: false });
  const [status, setStatus] = useState('');
  const filling = useRef(false);
  useEffect(() => () => { filling.current = false; }, []);

  async function fillPool() {
    if (filling.current) return;
    const exam = fill.exam; const diff = fill.diff; const sets = Math.max(1, Math.min(20, Number(fill.n) || 1));
    const parts: Record<string, Record<string, number>> = { ielts: { L: 4, R: 3, W: 1, S: 1 }, tef: { L: 4, R: 4, W: 1, S: 1 } };
    const jobs: { k: string; i: number }[] = [];
    for (let n = 0; n < sets; n++) for (const k of (fill.k === 'all' ? ['L', 'R', 'W', 'S'] : [fill.k])) for (let i = 0; i < parts[exam][k]; i++) jobs.push({ k, i });
    let done = 0, failed = 0; filling.current = true;
    for (const j of jobs) {
      if (!filling.current) break;
      setStatus('Writing ' + (done + 1) + ' of ' + jobs.length + ' (' + j.k + ' part ' + (j.i + 1) + ')… keep this page open.');
      try {
        const x = await api<any>('POST', '/api/admin/pool/fill', { exam, k: j.k, i: j.i, diff });
        if (!x.valid) failed++;
        if (fill.audio && x.valid && j.k === 'L') {
          for (let c = 0; c < 80; c++) {
            setStatus('Voicing Listening part ' + (j.i + 1) + ', clip ' + (c + 1) + '…');
            const a = await api<any>('POST', '/api/admin/pool/' + x.id + '/audio', { c });
            if (a.done) break;
          }
        }
      } catch (e: any) { failed++; if (e.code === 'rate_limited') await new Promise((res) => setTimeout(res, 20000)); }
      done++;
    }
    filling.current = false;
    setStatus('Done: ' + (done - failed) + ' added' + (failed ? ', ' + failed + ' failed quality checks or errors' : '') + '.');
    reload();
  }
  const retire = async (id: string, v: boolean) => { try { await api('POST', '/api/admin/pool/' + id + '/retire', { retired: v }); onChange(); } catch (e) { app.handleError(e); } };

  let costs = <Spinner />; let pool = null;
  if (r) {
    const fx = r.usdToTnd || 3.1;
    const tnd = (usd: number) => (usd * fx).toFixed(2) + ' TND';
    const rate = (c: number, n: number) => (n ? Math.round(100 * c / n) + '%' : '–');
    const perUser = r.paidUsers ? tnd(r.month.usd / r.paidUsers) : '–';
    const genCalls = r.byTask.filter((x: any) => x.task === 'gen').reduce((a: any, x: any) => ({ calls: a.calls + x.calls, cached: a.cached + x.cached }), { calls: 0, cached: 0 });
    const tt = r.byTask.find((x: any) => x.task === 'tts') || { calls: 0, cached: 0 };
    const k: [string, React.ReactNode][] = [['AI spend', <>{tnd(r.month.usd)}<br /><span className="small muted">${r.month.usd.toFixed(2)}</span></>], ['Per paying user', perUser], ['Tests from the pool', rate(genCalls.cached, genCalls.calls)], ['Voices from cache', rate(tt.cached, tt.calls)], ['Audio cache', r.audio.items + ' clips · ' + (r.audio.mb < 10 ? r.audio.mb.toFixed(1) : r.audio.mb.toFixed(0)) + ' MB']];
    costs = <>
      <div className="kpis">{k.map(([l, v]) => <div key={l} className="panel kpi"><span className="small muted">{l}</span><b style={{ fontSize: '1.35rem' }}>{v}</b></div>)}</div>
      <div className="tablewrap"><table><thead><tr><th>Task</th><th className="mono">Calls</th><th className="mono">From cache</th><th className="mono">Cost</th></tr></thead><tbody>
        {r.byTask.map((x: any) => <tr key={x.task}><td>{x.task}</td><td className="mono">{x.calls}</td><td className="mono">{rate(x.cached, x.calls)}</td><td className="mono">{tnd(x.usd)}</td></tr>)}
      </tbody></table></div>
      {r.top.length ? <details><summary>Highest-cost users this month</summary><div className="tablewrap"><table><tbody>{r.top.map((x: any) => <tr key={x.email}><td>{x.email}</td><td className="mono">{tnd(x.usd)}</td></tr>)}</tbody></table></div></details> : null}
    </>;
    const P = r.pool;
    pool = <>
      <div className="tablewrap"><table><thead><tr><th>Exam</th><th>Section</th><th>Level</th><th className="mono">Items</th><th className="mono">Times used</th><th className="mono">Retired</th></tr></thead><tbody>
        {P.buckets.length ? P.buckets.map((b: any) => <tr key={b.exam + b.k + b.diff}><td>{b.exam.toUpperCase()}</td><td>{SKN[b.k]}</td><td>{b.diff}</td><td className="mono">{b.items}</td><td className="mono">{b.uses}</td><td className="mono">{b.retired}</td></tr>)
          : <tr><td colSpan={6} className="muted">Empty. Generate a few sets, or it fills up as people take tests.</td></tr>}
      </tbody></table></div>
      <p className="small muted">Lessons in the pool: {P.lessons.items} (used {P.lessons.uses} times).</p>
      {P.reported.length ? <><h3>Reported by learners</h3><div className="tablewrap"><table><thead><tr><th>Part</th><th>Topic</th><th className="mono">Reports</th><th>Reasons</th><th /></tr></thead><tbody>
        {P.reported.map((x: any) => <tr key={x.id}><td>{x.exam.toUpperCase()} {SKN[x.k]} {x.i + 1} · {x.diff}</td><td>{x.topic}</td><td className="mono">{x.reports}</td><td className="small">{x.reasons || ''}</td><td><button className="btn sm" data-sa="adm-retire" data-id={x.id} data-v={x.retired ? '0' : '1'} onClick={() => retire(x.id, !x.retired)}>{x.retired ? 'Restore' : 'Retire'}</button></td></tr>)}
      </tbody></table></div></> : null}
    </>;
  }
  return <>
    <div className="panel"><div className="row between"><h2>AI costs and cache</h2><span className="small muted">This month</span></div><div id="adm-costs">{costs}</div></div>
    <div className="panel"><h2>Test pool</h2>
      <p className="small muted" style={{ maxWidth: '70ch' }}>Tests are written once and reused by other learners at the same level. Nobody gets the same part twice. Fill the pool before launch so the first users get instant tests. Listening parts can also be voiced in advance.</p>
      <form id="f-fill" className="row" onSubmit={(e) => { e.preventDefault(); fillPool(); }}>
        <select id="fl-exam" value={fill.exam} onChange={(e) => setFill({ ...fill, exam: e.target.value })}><option value="ielts">IELTS</option><option value="tef">TEF</option></select>
        <select id="fl-k" value={fill.k} onChange={(e) => setFill({ ...fill, k: e.target.value })}><option value="all">All sections</option><option value="L">Listening</option><option value="R">Reading</option><option value="W">Writing</option><option value="S">Speaking</option></select>
        <select id="fl-diff" value={fill.diff} onChange={(e) => setFill({ ...fill, diff: e.target.value })}><option value="exam">Exam standard</option><option value="foundation">Foundation</option><option value="advanced">Advanced</option></select>
        <label className="small">Sets <input type="text" id="fl-n" value={fill.n} onChange={(e) => setFill({ ...fill, n: e.target.value })} inputMode="numeric" style={{ width: 56 }} /></label>
        <label className="check small" style={{ gridTemplateColumns: '22px auto' }}><input type="checkbox" id="fl-audio" checked={fill.audio} onChange={(e) => setFill({ ...fill, audio: e.target.checked })} /><span>Voice Listening now</span></label>
        <button className="btn sm primary" type="submit">Generate</button>
      </form>
      <p className="small" id="fl-status">{status}</p>
      <div id="adm-pool">{pool}</div>
    </div>
  </>;
}

function Draws() {
  const app = useApp();
  const [r, reload] = useLoad(() => api<any>('GET', '/api/admin/draws'), []);
  const [json, setJson] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (r) { const c = r.current; setJson(JSON.stringify({ checked: c.checked, quebec: c.quebec, provinces: c.provinces }, null, 2)); } }, [r]);
  const refresh = async () => { setBusy(true); try { const x = await api<any>('POST', '/api/admin/draws/refresh'); app.toast(x.live ? 'Updated from IRCC: round #' + x.latest.n : 'IRCC could not be reached; bundled data kept.'); await reload(); } catch (e) { app.handleError(e); } setBusy(false); };
  const resetD = async () => { try { await api('DELETE', '/api/admin/draws'); app.toast('Back to the bundled data.'); reload(); } catch (e) { app.handleError(e); } };
  const saveD = async () => {
    let data; try { data = JSON.parse(json); } catch { setMsg('That is not valid JSON.'); return; }
    try { await api('PUT', '/api/admin/draws', data); app.toast('Saved. Everyone sees it within 30 minutes.'); setMsg(''); reload(); } catch (e: any) { setMsg(e.message); }
  };
  let body = <Spinner />;
  if (r) {
    const c = r.current; const top = c.ee.rounds[0];
    body = <>
      <p className="small">{c.live ? <span className="pill good">Live from IRCC</span> : <span className="pill warn">Using bundled data</span>} Latest Express Entry round: <b>#{top.n}</b> {top.date} · {top.name} · lowest {top.crs}{c.ee.fetchedAt ? ' · fetched ' + c.ee.fetchedAt.slice(0, 16).replace('T', ' ') : ''}</p>
      <div className="row"><button className="btn sm" data-sa="adm-draws-refresh" disabled={busy} onClick={refresh}>Refresh from IRCC now</button><button className="btn sm" data-sa="adm-draws-reset" onClick={resetD}>Back to bundled Québec/provinces</button></div>
      <label className="stack" style={{ gap: 6 }}><span className="small muted">Québec and provinces (JSON)</span><textarea id="adm-draws-json" rows={14} className="mono" style={{ width: '100%', fontSize: '.8rem' }} value={json} onChange={(e) => setJson(e.target.value)} /></label>
      <div className="row"><button className="btn sm primary" data-sa="adm-draws-save" onClick={saveD}>Save</button><span id="adm-draws-msg" className="small muted">{msg}</span></div>
    </>;
  }
  return <div className="panel"><h2>Invitation rounds</h2><p className="small muted" style={{ maxWidth: '70ch' }}>Express Entry refreshes itself from IRCC every 6 hours. Québec and provincial rounds are edited here as JSON (same shape as shown), no redeploy needed.</p><div id="adm-draws">{body}</div></div>;
}

function Users() {
  const app = useApp();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [r, reload] = useLoad(() => api<any>('GET', '/api/admin/users?q=' + encodeURIComponent(search)), [search]);
  const [edits, setEdits] = useState<Record<string, { plan?: string; days?: string }>>({});
  const [temps, setTemps] = useState<Record<string, string>>({});
  const setPlan = async (u: any) => {
    const cur = u.active.plan === 'solo' ? 'solo:' + u.active.exam : u.active.plan;
    const v = (edits[u.id]?.plan || cur).split(':');
    try { await api('POST', '/api/admin/users/' + u.id + '/plan', { plan: v[0], exam: v[1], days: Number(edits[u.id]?.days ?? 30) }); app.toast('Plan updated.'); reload(); } catch (e) { app.handleError(e); }
  };
  const resetPw = async (id: string) => { try { const x = await api<any>('POST', '/api/admin/users/' + id + '/reset-password'); setTemps({ ...temps, [id]: x.tempPassword }); } catch (e) { app.handleError(e); } };
  const disable = async (id: string, v: boolean) => { try { await api('POST', '/api/admin/users/' + id + '/disable', { disabled: v }); reload(); } catch (e) { app.handleError(e); } };
  return (
    <div className="panel"><h2>Users</h2>
      <form id="f-users" className="row" onSubmit={(e) => { e.preventDefault(); setSearch(q); if (q === search) reload(); }}><input type="search" id="adm-q" placeholder="Email or name" style={{ flex: '1 1 220px' }} value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn sm" type="submit">Search</button></form>
      <div id="adm-users">{r && (
        <div className="tablewrap"><table><thead><tr><th>User</th><th>Joined</th><th>Plan</th><th>Change plan</th><th /></tr></thead><tbody>
          {r.users.map((u: any) => {
            const cur = u.active.plan === 'solo' ? 'solo:' + u.active.exam : u.active.plan;
            return (
              <tr key={u.id}>
                <td>{u.name}<br /><span className="small muted">{u.email}</span>{u.disabled ? <> <span className="pill bad">disabled</span></> : null}</td>
                <td className="mono">{fmtDate(u.created_at)}</td>
                <td>{planLabel(u.active)}{u.active.until ? <><br /><span className="small muted">until {fmtDate(u.active.until)}</span></> : null}</td>
                <td><div className="row">
                  <select id={'up-' + u.id} value={edits[u.id]?.plan || cur} onChange={(e) => setEdits({ ...edits, [u.id]: { ...edits[u.id], plan: e.target.value } })}>{[['free', 'Free'], ['solo:ielts', 'Solo IELTS'], ['solo:tef', 'Solo TEF'], ['duo', 'Duo']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <input type="text" id={'ud-' + u.id} value={edits[u.id]?.days ?? '30'} onChange={(e) => setEdits({ ...edits, [u.id]: { ...edits[u.id], days: e.target.value } })} inputMode="numeric" style={{ width: 64 }} aria-label="Days" />
                  <button className="btn sm" data-sa="adm-plan" data-id={u.id} onClick={() => setPlan(u)}>Apply</button>
                </div></td>
                <td><div className="row">
                  {temps[u.id] ? <span className="small">Temporary password: <b className="mono" style={{ userSelect: 'all' }}>{temps[u.id]}</b></span> : <button className="btn sm" data-sa="adm-reset" data-id={u.id} onClick={() => resetPw(u.id)}>Reset password</button>}
                  <button className="btn sm" data-sa="adm-disable" data-id={u.id} data-v={u.disabled ? '0' : '1'} onClick={() => disable(u.id, !u.disabled)}>{u.disabled ? 'Enable' : 'Disable'}</button>
                </div></td>
              </tr>
            );
          })}
        </tbody></table></div>
      )}</div>
    </div>
  );
}
