'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { AuthShell } from '@/components/app/Page';
import { api } from '@/lib/client/api';
import { t } from '@/lib/i18n';

export default function ForgotPage() {
  const app = useApp();
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api<{ manual?: boolean; support?: string }>('POST', '/api/auth/forgot', { email });
      setMsg(r.manual ? t('Password reset by email is not set up yet. Write to {support} from your account email and we will reset it for you.', { support: r.support || t('the support team') }) : t('If an account exists for this email, a reset link is on its way. It works for one hour.'));
    } catch (err) { app.handleError(err); }
    setBusy(false);
  }
  return (
    <AuthShell title={t('Reset your password')}>
      <form id="f-forgot" className="stack" onSubmit={submit}>
        <label className="field"><span>{t('Email')}</span><input type="email" id="fg-email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <p className="small" id="fg-msg" hidden={!msg}>{msg}</p>
        <button className="btn primary" type="submit" disabled={busy}>{t('Send reset link')}</button>
      </form>
      <p className="small"><Link href="/login">{t('Back to sign in')}</Link></p>
    </AuthShell>
  );
}
