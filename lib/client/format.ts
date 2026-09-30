// Small display helpers shared by the pages.
import { fmtDay, fmtNum, t, tk } from '../i18n';
import type { ActivePlan } from '../shared/types';

export const fmtDate = (d: string | number | Date | null | undefined) => (d ? fmtDay(d) : '–');
export const fmtTND = (n: number | string) => fmtNum(n, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) + ' TND';
export function planLabel(p: Partial<ActivePlan> | null | undefined) {
  if (!p || p.plan === 'free') return t('Free');
  return p.plan === 'duo' ? t('Duo') : t('Solo {exam}', { exam: String(p.exam || '').toUpperCase() });
}

export const PAY_STATUS: Record<string, string> = { paid: tk('paid'), pending: tk('pending'), review: tk('review'), failed: tk('failed'), rejected: tk('rejected') };
