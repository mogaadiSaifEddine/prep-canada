'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { AuthShell } from '@/components/app/Page';
import { api } from '@/lib/client/api';
import { adoptVisitorData } from '@/lib/client/paths-store';
import { t } from '@/lib/i18n';

export default function LoginPage() { return <Suspense><Login /></Suspense>; }

function Login() {
  const app = useApp();
  const next = useSearchParams().get('next') || '';
  const [email, setEmail] = useState(''); const [pass, setPass] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api('POST', '/api/auth/login', { email, password: pass });
      await app.loadMe();
      if (await adoptVisitorData('login').catch(() => false)) app.toast(t('Your paths and score from this device were added to your account.'));
      app.go(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) { setError(app.errCopy(err)); setBusy(false); }
  }
  return (
    <AuthShell title={t('Sign in')}>
      <form id="f-login" className="stack" onSubmit={submit}>
        <label className="field"><span>{t('Email')}</span><input type="email" id="l-email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>{t('Password')}</span><input type="password" id="l-pass" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        <p className="banner bad small" id="l-err" hidden={!error}>{error}</p>
        <button className="btn primary" type="submit" disabled={busy}>{t('Sign in')}</button>
      </form>
      <div className="row between small"><Link href="/forgot">{t('Forgot your password?')}</Link><Link href="/signup">{t('Create an account')}</Link></div>
    </AuthShell>
  );
}
