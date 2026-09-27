'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { api } from '@/lib/client/api';
import { fmtTND } from '@/lib/client/format';
import { fmtNum, t, tk } from '@/lib/i18n';
import { tr } from '@/lib/i18n/react';
import type { Exam } from '@/lib/shared/types';

export default function PlansPage() {
  const app = useApp();
  const c = app.config; const pr = c.prices; const b = app.billing; const me = app.me;
  const cur = me ? me.plan : { plan: 'free' as const };
  const per = b.period === 'year' ? t('/ year') : t('/ month');
  const price = (plan: 'solo' | 'duo') => pr[plan][b.period];
  const [ref, setRef] = useState('');
  const [payErr, setPayErr] = useState('');
  const [paying, setPaying] = useState(false);
  const checkoutEl = useRef<HTMLDivElement>(null);
  useEffect(() => { if (b.plan && checkoutEl.current) checkoutEl.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [b.plan]);

  async function pay() {
    setPaying(true); setPayErr('');
    try {
      const r = await api<{ id: string; payUrl?: string }>('POST', '/api/billing/checkout', { plan: b.plan, period: b.period, exam: b.exam, method: b.method, reference: ref });
      if (r.payUrl) { location.href = r.payUrl; return; }
      app.setBilling({ plan: null });
      app.go('/billing/return?pid=' + encodeURIComponent(r.id));
    } catch (err) { setPayErr(app.errCopy(err)); setPaying(false); }
  }

  const card = (plan: 'free' | 'solo' | 'duo', title: string, feats: string[], featured?: boolean) => {
    const isCur = cur.plan === plan;
    return (
      <div className={'panel plan' + (featured ? ' featured' : '')}>
        <div className="row between"><h2>{t(title)}</h2>{featured && <span className="pill accent">{t('Best value')}</span>}{isCur && <span className="pill good">{t('Your plan')}</span>}</div>
        <div className="price">{plan === 'free' ? fmtNum(0) : fmtNum(price(plan))} <small>TND {plan === 'free' ? '' : per}</small></div>
        {plan !== 'free' && b.period === 'year' && <p className="small muted">{t('{amount} TND less than 12 monthly payments', { amount: fmtNum(pr[plan].month * 12 - pr[plan].year) })}</p>}
        <ul>{feats.map((f) => <li key={f}>{t(f)}</li>)}</ul>
        {plan === 'solo' && <div className="seg" role="group" aria-label={t('Exam')}>{(['ielts', 'tef'] as Exam[]).map((x) => <button key={x} type="button" data-sa="solo-exam" data-x={x} aria-pressed={b.exam === x} onClick={() => app.setBilling({ exam: x })}>{x.toUpperCase()}</button>)}</div>}
        {plan === 'free' ? (me ? null : <Link className="btn" href="/signup">{t('Create a free account')}</Link>)
          : <button className={'btn ' + (featured ? 'primary' : 'dark')} data-sa="choose" data-plan={plan} onClick={() => { if (!me) { app.go('/signup'); return; } app.setBilling({ plan }); }}>{isCur ? t('Extend') : t('Choose {plan}', { plan: t(title) })}</button>}
      </div>
    );
  };

  let checkout = null;
  if (b.plan && me) {
    const m = c.methods;
    const label = b.plan === 'duo' ? t('Duo · IELTS + TEF') : t('Solo · {exam}', { exam: b.exam.toUpperCase() });
    const methods = ([
      ['konnect', 'Konnect', tk('Bank card, e-Dinar or Konnect wallet')],
      ['flouci', 'Flouci', tk('Flouci wallet or bank card')],
      ['manual', tk('D17 or bank transfer'), tk('Send the money, enter the reference, and we activate it (usually within 24 hours)')]
    ] as const).filter(([k]) => m[k]);
    const amount = fmtTND(price(b.plan));
    checkout = (
      <div className="panel" id="checkout" ref={checkoutEl}>
        <p className="eyebrow">{t('Checkout')}</p>
        <h2>{b.period === 'year' ? t('{plan} · {price} for 12 months', { plan: label, price: amount }) : t('{plan} · {price} for 1 month', { plan: label, price: amount })}</h2>
        <p className="small muted">{t('Price includes VAT. Prepaid: nothing renews automatically, and we remind you a few days before it ends.')}{cur.plan === 'solo' && b.plan === 'duo' ? ' ' + t('Unused Solo days are credited to Duo.') : ''}</p>
        <div className="methods">{methods.map(([k, nm, d]) => (
          <label key={k} className="choice"><input type="radio" name="paymethod" value={k} checked={b.method === k} onChange={() => app.setBilling({ method: k })} /><span className="mono" /><span><b>{t(nm)}</b><br /><span className="small muted">{t(d)}</span></span></label>
        ))}</div>
        {b.method === 'manual' && (
          <div className="panel flat">
            <p style={{ whiteSpace: 'pre-line' }}>{c.manualInfo}</p>
            <p className="small">{tr('Amount: {amount}. Put your email in the transfer note if you can.', { amount: <b>{amount}</b> })}</p>
            <label className="field"><span>{t('D17 or transfer reference')}</span><input type="text" id="pay-ref" maxLength={120} style={{ width: '100%' }} value={ref} onChange={(e) => setRef(e.target.value)} /></label>
          </div>
        )}
        <p className="banner bad small" id="pay-err" hidden={!payErr}>{payErr}</p>
        <div className="row">
          <button className="btn primary" data-sa="pay" disabled={!b.method || paying} onClick={pay}>{b.method === 'manual' ? t('Send for activation') : t('Pay {amount}', { amount })}</button>
          <button className="btn" data-sa="cancel-checkout" onClick={() => app.setBilling({ plan: null })}>{t('Cancel')}</button>
        </div>
      </div>
    );
  }
  return (
    <Page>
      <div><p className="eyebrow">{t('Plans')}</p><h1>{t('Choose how you prepare')}</h1></div>
      <div className="row"><div className="seg" role="group" aria-label={t('Billing period')}>
        <button type="button" data-sa="period" data-p="month" aria-pressed={b.period === 'month'} onClick={() => app.setBilling({ period: 'month' })}>{t('Monthly')}</button>
        <button type="button" data-sa="period" data-p="year" aria-pressed={b.period === 'year'} onClick={() => app.setBilling({ period: 'year' })}>{t('Yearly · 2 months free')}</button>
      </div></div>
      <div className="plans">
        {card('free', tk('Free'), [tk('Placement test for each exam'), tk('1 mock test a month'), tk('Marking with quoted errors'), tk('Device voices for Listening')])}
        {card('solo', tk('Solo'), [tk('One exam: IELTS or TEF'), tk('Unlimited mock tests'), tk('Personal 12-unit course with lessons'), tk('Studio voices for Listening and speaking'), tk('Timed checkpoints')])}
        {card('duo', tk('Duo'), [tk('IELTS and TEF together'), tk('Everything in Solo, for both exams'), tk('Best for bilingual Express Entry points')], true)}
      </div>
      {checkout}
      <p className="small muted">{t('Prices in Tunisian dinars, VAT included. Fair use: up to {n} new tests a day.', { n: c.limits?.paid?.testsPerDay || 6 })}</p>
    </Page>
  );
}
