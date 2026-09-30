'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { AuthShell } from '@/components/app/Page';
import { api } from '@/lib/client/api';
import { adoptVisitorData } from '@/lib/client/paths-store';
import { lang, t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';

export default function SignupPage() {
  const app = useApp();
  const [f, setF] = useState({ name: '', email: '', pass: '', consent: false });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api('POST', '/api/auth/signup', { name: f.name, email: f.email, password: f.pass, consent: f.consent, lang: lang() });
      await app.loadMe();
      if (await adoptVisitorData('signup').catch(() => false)) app.toast(t('Your paths and score are now saved in your account.'));
      app.go('/');
    } catch (err) { setError(app.errCopy(err)); setBusy(false); }
  }
  return (
    <AuthShell title={t('Create your account')}>
      <p className="muted">{t('Free: a placement test for each exam and one mock test a month.')}</p>
      <form id="f-signup" className="stack" onSubmit={submit}>
        <label className="field"><span>{t('Your name')}</span><input type="text" id="s-name" autoComplete="name" required maxLength={80} style={{ width: '100%' }} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field"><span>{t('Email')}</span><input type="email" id="s-email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="field"><span>{t('Password (at least 8 characters)')}</span><input type="password" id="s-pass" autoComplete="new-password" minLength={8} required value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} /></label>
        <label className="check"><input type="checkbox" id="s-consent" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
          <span>{tr('I accept the {terms} and the {privacy}, including that my answers are processed by AI services (through OpenRouter) outside Tunisia to create and mark my tests.', { terms: <a href="/legal/terms" target="_blank">{t('terms')}</a>, privacy: <a href="/legal/privacy" target="_blank">{t('privacy policy')}</a> })}</span>
        </label>
        <p className="banner bad small" id="s-err" hidden={!error}>{error}</p>
        <button className="btn primary" type="submit" disabled={busy}>{t('Create account')}</button>
      </form>
      <p className="small">{t('Already have an account?')} <Link href="/login">{t('Sign in')}</Link></p>
    </AuthShell>
  );
}
