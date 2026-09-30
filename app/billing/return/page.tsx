'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { Spinner } from '@/components/app/ui';
import { api } from '@/lib/client/api';
import { fmtDate, planLabel } from '@/lib/client/format';
import { t } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import type { ActivePlan, Payment } from '@/lib/shared/types';

export default function BillingReturnPage() { return <Suspense><BillingReturn /></Suspense>; }

type Result = { payment?: Payment; plan?: ActivePlan; error?: unknown } | null;
function BillingReturn() {
  const app = useApp();
  const q = useSearchParams();
  const pid = q.get('pid') || ''; const fail = q.get('fail') === '1';
  const [last, setLast] = useState<Result>(null);
  const [done, setDone] = useState(false);
  const [round, setRound] = useState(0);
  const check = useCallback(async (alive: () => boolean) => {
    setDone(false);
    let r: Result = null;
    for (let i = 0; i < 8; i++) {
      try { r = await api('GET', '/api/billing/verify?id=' + encodeURIComponent(pid)); } catch (e) { r = { error: e }; break; }
      const p = r!.payment!;
      if (p.status === 'paid' || p.status === 'failed' || p.method === 'manual') break;
      if (fail && i >= 1) break;
      await new Promise((res) => setTimeout(res, 2500));
      if (!alive()) return;
    }
    await app.loadMe();
    if (alive()) { setLast(r); setDone(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, fail]);
  useEffect(() => { let alive = true; check(() => alive); return () => { alive = false; }; }, [check, round]);

  let body;
  if (!done) body = <div className="row"><Spinner /><h2>{t('Checking your payment…')}</h2></div>;
  else if (last && last.payment && last.payment.status === 'paid') body = <>
    <p className="eyebrow">{t('Payment received')}</p><h2>{t('You’re on {plan}', { plan: planLabel(last.plan) })}</h2>
    <p>{tr('Your plan runs until {date}. Thank you.', { date: <b>{fmtDate(last.plan!.until)}</b> })}</p>
    <div className="row"><Link className="btn primary" href="/">{t('Start practising')}</Link><Link className="btn" href="/account">{t('See receipt')}</Link></div>
  </>;
  else if (last && last.payment && last.payment.status === 'review') body = <>
    <h2>{t('Waiting for activation')}</h2><p>{t('We received your reference. Your plan starts as soon as the payment is confirmed, usually within 24 hours.')}</p><Link className="btn" href="/">{t('Back to the app')}</Link>
  </>;
  else body = <>
    <h2>{fail ? t('The payment didn’t go through') : t('Payment not confirmed yet')}</h2>
    <p className="muted">{fail ? t('No money was taken for this attempt. You can try again or choose another method.') + ' ' : t('If you completed the payment, it can take a minute to arrive. Check again, or contact us with this reference:') + ' '}<span className="mono" style={{ userSelect: 'all' }}>{pid}</span></p>
    <div className="row"><button className="btn primary" data-sa="recheck" onClick={() => setRound((n) => n + 1)}>{t('Check again')}</button><Link className="btn" href="/plans">{t('Back to plans')}</Link></div>
  </>;
  return <Page><div className="panel" id="ret">{body}</div></Page>;
}
