'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { ArrBack, Spinner } from '@/components/app/ui';
import { api } from '@/lib/client/api';
import { fmtDate, fmtTND, planLabel } from '@/lib/client/format';
import { t } from '@/lib/i18n';
import type { Payment } from '@/lib/shared/types';

export default function ReceiptPage() {
  const app = useApp(); const c = app.config; const me = app.me!;
  const { id } = useParams<{ id: string }>();
  const [x, setX] = useState<Payment | null | undefined>(undefined);
  useEffect(() => { api<{ payments: Payment[] }>('GET', '/api/billing/payments').then((r) => setX(r.payments.find((p) => p.id === decodeURIComponent(id)) || null)).catch((e) => { app.handleError(e); setX(null); }); }, [id, app]);
  const back = <div className="row"><Link className="btn sm" href="/account"><ArrBack />{t('Account')}</Link></div>;
  if (x === undefined) return <Page>{back}<div className="panel"><Spinner /></div></Page>;
  if (!x || x.status !== 'paid') return <Page>{back}<div className="panel"><p className="muted">{t('No payments yet.')}</p></div></Page>;
  const ttc = Number(x.amount); const ht = Math.round(ttc / 1.19 * 1000) / 1000; const tva = Math.round((ttc - ht) * 1000) / 1000;
  const plan = planLabel({ plan: x.plan, exam: x.exam });
  return (
    <Page>
      {back}
      <div className="panel legal">
        <p className="eyebrow">{t('Receipt')}</p><h2>{c.business || 'Prep Canada'}</h2>
        {c.matricule ? <p className="small">{t('Matricule fiscal: {id}', { id: c.matricule })}</p> : null}
        <div className="tablewrap"><table><tbody>
          <tr><th>{t('Receipt no.')}</th><td className="mono">{x.id}</td></tr>
          <tr><th>{t('Date')}</th><td>{fmtDate(x.paidAt || x.createdAt)}</td></tr>
          <tr><th>{t('Customer')}</th><td>{me.name} · {me.email}</td></tr>
          <tr><th>{t('Service')}</th><td>{x.period === 'year' ? t('Prep Canada {plan}, 12 months', { plan }) : t('Prep Canada {plan}, 1 month', { plan })}</td></tr>
          <tr><th>{t('Amount excl. VAT (HT)')}</th><td className="mono">{fmtTND(ht)}</td></tr>
          <tr><th>{t('VAT 19%')}</th><td className="mono">{fmtTND(tva)}</td></tr>
          <tr><th>{t('Total incl. VAT (TTC)')}</th><td className="mono"><b>{fmtTND(ttc)}</b></td></tr>
          <tr><th>{t('Paid with')}</th><td>{x.method}</td></tr>
        </tbody></table></div>
        <p className="small muted">{t('Keep this page for your records.')}</p>
      </div>
    </Page>
  );
}
