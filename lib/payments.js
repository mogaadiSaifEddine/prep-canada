// Payments in TND: Konnect, Flouci, or manual (D17 / bank transfer approved by an admin).
// Plans are prepaid for a month or a year; nothing renews automatically.
import { one, q } from './db.js';
import { err, uid, clampStr } from './util.js';
import { prices, activate, EXAMS } from './plans.js';

const KONNECT_BASE = () => (process.env.KONNECT_API_BASE || 'https://api.konnect.network/api/v2').replace(/\/$/, '');
const FLOUCI_BASE = () => (process.env.FLOUCI_API_BASE || 'https://developers.flouci.com/api/v2').replace(/\/$/, '');
const PAYMENTS_MOCK = () => process.env.PAYMENTS_MOCK === '1';

export function methods() {
  return {
    konnect: PAYMENTS_MOCK() || !!(process.env.KONNECT_API_KEY && process.env.KONNECT_WALLET_ID),
    flouci: PAYMENTS_MOCK() || !!(process.env.FLOUCI_PUBLIC_KEY && process.env.FLOUCI_PRIVATE_KEY),
    manual: true
  };
}
export function manualInfo() {
  return (process.env.MANUAL_PAY_INFO || '').replace(/\\n/g, '\n') || 'Send the amount by D17 or bank transfer. The details will be added here by the app owner.';
}

async function http(url, opts) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* ignore */ }
    return { status: r.status, json, text };
  } catch { throw err(502, 'payment_unreachable', 'The payment service could not be reached. Try again in a minute.'); }
  finally { clearTimeout(t); }
}

export async function checkout(user, body, base) {
  const plan = body.plan, period = body.period, method = body.method;
  if (!['solo', 'duo'].includes(plan)) throw err(400, 'bad_request', 'Choose Solo or Duo.');
  if (!['month', 'year'].includes(period)) throw err(400, 'bad_request', 'Choose monthly or yearly.');
  const exam = plan === 'solo' ? body.exam : null;
  if (plan === 'solo' && !EXAMS.includes(exam)) throw err(400, 'bad_request', 'Choose the exam for the Solo plan.');
  const m = methods();
  if (!m[method]) throw err(400, 'bad_request', 'This payment method is not available.');
  const amount = Math.round(Number(prices()[plan][period]) * 1000);
  const id = 'p_' + uid(9);
  const reference = method === 'manual' ? clampStr(body.reference, 120).trim() : null;
  if (method === 'manual' && reference.length < 3) throw err(400, 'bad_request', 'Enter the D17 or transfer reference so the payment can be matched.');
  await q(`insert into payments(id, user_id, email, method, plan, exam, period, amount_millimes, status, reference)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, user.id, user.email, method, plan, exam, period, amount, method === 'manual' ? 'review' : 'pending', reference]);
  const label = 'Prep Canada ' + (plan === 'duo' ? 'Duo' : 'Solo ' + exam.toUpperCase()) + ' · ' + (period === 'year' ? '12 months' : '1 month');
  const back = base + '/#/billing/return?pid=' + id;

  if (method === 'manual') return { id, manual: true, info: manualInfo() };

  if (PAYMENTS_MOCK()) {
    await q('update payments set provider_ref=$2 where id=$1', [id, 'mock_' + id]);
    return { id, payUrl: base + '/api/billing/mock-pay?pid=' + id };
  }

  if (method === 'konnect') {
    const [firstName, ...rest] = String(user.name || 'Client').split(' ');
    const r = await http(KONNECT_BASE() + '/payments/init-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.KONNECT_API_KEY },
      body: JSON.stringify({
        receiverWalletId: process.env.KONNECT_WALLET_ID, token: 'TND', amount, type: 'immediate',
        description: label, acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'], lifespan: 30,
        checkoutForm: false, addPaymentFeesToAmount: false, firstName, lastName: rest.join(' ') || firstName,
        email: user.email, orderId: id, webhook: base + '/api/billing/konnect-webhook',
        successUrl: back, failUrl: back + '&fail=1', theme: 'light'
      })
    });
    if (r.status >= 300 || !r.json || !r.json.payUrl) { console.error('Konnect init failed', r.status, r.text.slice(0, 300)); throw err(502, 'payment_error', 'Konnect could not start the payment. Try another method.'); }
    await q('update payments set provider_ref=$2 where id=$1', [id, r.json.paymentRef]);
    return { id, payUrl: r.json.payUrl };
  }

  if (method === 'flouci') {
    const r = await http(FLOUCI_BASE() + '/generate_payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.FLOUCI_PUBLIC_KEY + ':' + process.env.FLOUCI_PRIVATE_KEY },
      body: JSON.stringify({ amount: String(amount), success_link: back, fail_link: back + '&fail=1', developer_tracking_id: id, webhook: base + '/api/billing/flouci-webhook?pid=' + id, session_timeout_secs: 1800, accept_card: true })
    });
    const res = r.json && r.json.result;
    if (r.status >= 300 || !res || !res.link) { console.error('Flouci init failed', r.status, r.text.slice(0, 300)); throw err(502, 'payment_error', 'Flouci could not start the payment. Try another method.'); }
    await q('update payments set provider_ref=$2 where id=$1', [id, res.payment_id]);
    return { id, payUrl: res.link };
  }
  throw err(400, 'bad_request', 'Unknown payment method.');
}

export async function markPaid(id, note) {
  const row = await one(`update payments set status='paid', paid_at=now(), note=coalesce($2, note) where id=$1 and status<>'paid' returning *`, [id, note || null]);
  if (row) await activate(row.user_id, row.plan, row.exam, row.period);
  return row;
}

// Ask the provider whether the payment went through. Safe to call many times.
export async function verify(id) {
  const p = await one('select * from payments where id=$1', [id]);
  if (!p) throw err(404, 'not_found', 'Payment not found.');
  if (p.status === 'paid' || p.method === 'manual' || !p.provider_ref) return p;
  if (PAYMENTS_MOCK()) return p;
  if (p.method === 'konnect') {
    const r = await http(KONNECT_BASE() + '/payments/' + encodeURIComponent(p.provider_ref), { headers: { 'x-api-key': process.env.KONNECT_API_KEY } });
    const pay = r.json && r.json.payment;
    if (pay && pay.status === 'completed' && Number(pay.amount) >= p.amount_millimes) await markPaid(p.id, 'konnect');
  } else if (p.method === 'flouci') {
    const r = await http(FLOUCI_BASE() + '/verify_payment/' + encodeURIComponent(p.provider_ref), { headers: { authorization: 'Bearer ' + process.env.FLOUCI_PUBLIC_KEY + ':' + process.env.FLOUCI_PRIVATE_KEY } });
    const res = r.json && r.json.result;
    if (res && res.status === 'SUCCESS' && Number(res.amount) >= p.amount_millimes) await markPaid(p.id, 'flouci');
    else if (res && /FAIL|EXPIRED|CANCEL/i.test(res.status || '')) await q(`update payments set status='failed' where id=$1 and status='pending'`, [p.id]);
  }
  return one('select * from payments where id=$1', [id]);
}

export async function byProviderRef(ref) {
  return one('select * from payments where provider_ref=$1', [String(ref || '')]);
}

export function publicPayment(p) {
  return { id: p.id, method: p.method, plan: p.plan, exam: p.exam, period: p.period, amount: p.amount_millimes / 1000, status: p.status, reference: p.reference, createdAt: p.created_at, paidAt: p.paid_at };
}
