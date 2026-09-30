'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { Spinner } from '@/components/app/ui';
import { api } from '@/lib/client/api';
import { fmtDate, fmtTND, PAY_STATUS, planLabel } from '@/lib/client/format';
import { t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import type { Payment } from '@/lib/shared/types';

export default function AccountPage() {
  const app = useApp(); const me = app.me!; const p = me.plan;
  const [pays, setPays] = useState<Payment[] | null>(null);
  const [payErr, setPayErr] = useState('');
  const [name, setName] = useState(me.name);
  const [pw, setPw] = useState({ old: '', next: '' });
  const [delPass, setDelPass] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { api<{ payments: Payment[] }>('GET', '/api/billing/payments').then((r) => setPays(r.payments)).catch((e) => setPayErr(app.errCopy(e))); }, [app]);

  const run = (id: string, fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault(); setBusy(id);
    try { await fn(); } catch (err) { app.handleError(err); }
    setBusy('');
  };
  const saveName = run('name', async () => { await api('POST', '/api/me', { name }); await app.loadMe(); app.toast(t('Name saved.')); });
  const savePass = run('pass', async () => { await api('POST', '/api/me', { password: pw.old, newPassword: pw.next }); app.toast(t('Password changed.')); setPw({ old: '', next: '' }); });
  const del = run('delete', async () => { await api('DELETE', '/api/me', { password: delPass }); app.signedOut(); app.toast(t('Your account was deleted.')); app.go('/'); });
  const logout = async () => { try { await api('POST', '/api/auth/logout'); } catch { /* ignore */ } app.signedOut(); app.go('/'); };

  return (
    <Page>
      <div><p className="eyebrow">{t('Account')}</p><h1>{me.name}</h1><p className="muted">{me.email}</p></div>
      <div className="panel"><div className="row between"><div><h3>{t('Your plan')}</h3><p>{planLabel(p)}{p.until ? <> · {tr('until {date}', { date: <b>{fmtDate(p.until)}</b> })}</> : null}</p></div><Link className={'btn ' + (p.plan === 'free' ? 'primary' : '')} href="/plans">{p.plan === 'free' ? t('Upgrade') : t('Extend or change')}</Link></div></div>
      <div className="panel"><h3>{t('Payments and receipts')}</h3><div id="pays">
        {payErr ? payErr : !pays ? <Spinner /> : pays.length ? (
          <div className="tablewrap"><table><thead><tr><th>{t('Date')}</th><th>{t('Plan')}</th><th>{t('Method')}</th><th className="mono">{t('Amount')}</th><th>{t('Status')}</th><th>{t('Receipt')}</th></tr></thead><tbody>
            {pays.map((x) => (
              <tr key={x.id}><td className="mono">{fmtDate(x.createdAt)}</td><td>{planLabel({ plan: x.plan, exam: x.exam })} · {x.period === 'year' ? t('12 months') : t('1 month')}</td><td>{x.method}</td><td className="mono">{fmtTND(x.amount)}</td>
                <td><span className={'pill ' + (x.status === 'paid' ? 'good' : x.status === 'review' || x.status === 'pending' ? 'warn' : 'bad')}>{t(PAY_STATUS[x.status] || x.status)}</span></td>
                <td>{x.status === 'paid' ? <Link className="btn sm" data-sa="receipt" data-id={x.id} href={'/account/receipt/' + encodeURIComponent(x.id)}>{t('View')}</Link> : null}</td></tr>
            ))}
          </tbody></table></div>
        ) : <p className="muted">{t('No payments yet.')}</p>}
      </div></div>
      <div className="grid">
        <form className="panel" id="f-name" onSubmit={saveName}><h3>{t('Name')}</h3><label className="field"><span>{t('Your name')}</span><input type="text" id="a-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={{ width: '100%' }} /></label><button className="btn sm" type="submit" disabled={busy === 'name'}>{t('Save')}</button></form>
        <form className="panel" id="f-pass" onSubmit={savePass}><h3>{t('Password')}</h3>
          <label className="field"><span>{t('Current password')}</span><input type="password" id="a-old" autoComplete="current-password" required value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></label>
          <label className="field"><span>{t('New password')}</span><input type="password" id="a-new" minLength={8} autoComplete="new-password" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          <button className="btn sm" type="submit" disabled={busy === 'pass'}>{t('Change password')}</button>
        </form>
      </div>
      <div className="panel flat"><h3>{t('Your data')}</h3>
        <p className="small muted">{t('Download everything we store about you, or delete your account. Payment records are kept for accounting, as the law requires.')}</p>
        <div className="row"><a className="btn sm" href="/api/me/export" download="prep-canada-data.json">{t('Download my data')}</a><button className="btn sm" data-sa="logout" onClick={logout}>{t('Sign out')}</button></div>
        <details><summary>{t('Delete my account')}</summary>
          <form id="f-delete" className="stack" style={{ marginTop: 10 }} onSubmit={del}>
            <p className="small">{t('This erases your tests, results and course for both exams. It cannot be undone.')}</p>
            <label className="field"><span>{t('Type your password to confirm')}</span><input type="password" id="d-pass" required value={delPass} onChange={(e) => setDelPass(e.target.value)} /></label>
            <button className="btn sm" type="submit" disabled={busy === 'delete'} style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>{t('Delete my account')}</button>
          </form>
        </details>
      </div>
    </Page>
  );
}
