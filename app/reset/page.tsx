'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { AuthShell } from '@/components/app/Page';
import { api } from '@/lib/client/api';
import { t } from '@/lib/i18n';

export default function ResetPage() { return <Suspense><Reset /></Suspense>; }

function Reset() {
  const app = useApp();
  const token = useSearchParams().get('token') || '';
  const [pass, setPass] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('POST', '/api/auth/reset', { token, password: pass }); await app.loadMe(); app.toast(t('Password changed.')); app.go('/'); }
    catch (err) { setError(app.errCopy(err)); setBusy(false); }
  }
  return (
    <AuthShell title={t('Choose a new password')}>
      <form id="f-reset" className="stack" onSubmit={submit}>
        <label className="field"><span>{t('New password (at least 8 characters)')}</span><input type="password" id="rs-pass" minLength={8} required autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        <p className="banner bad small" id="rs-err" hidden={!error}>{error}</p>
        <button className="btn primary" type="submit" disabled={busy}>{t('Save password')}</button>
      </form>
    </AuthShell>
  );
}
