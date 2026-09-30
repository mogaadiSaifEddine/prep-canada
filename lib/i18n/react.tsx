import { Fragment, type ReactNode } from 'react';
import { template } from './index';

/**
 * Translate a string whose placeholders are React elements, e.g.
 * tr('{link} to see it on the chart.', { link: <Link href="/paths/score">{t('Calculate your score')}</Link> }).
 * Plain values work too. Unknown placeholders are left as written.
 */
export function tr(s: string, vars: Record<string, ReactNode>): ReactNode {
  const parts = template(s).split(/(\{\w+\})/g);
  return parts.map((p, i) => {
    const m = /^\{(\w+)\}$/.exec(p);
    if (m && m[1] in vars) return <Fragment key={i}>{vars[m[1]]}</Fragment>;
    return p ? <Fragment key={i}>{p}</Fragment> : null;
  });
}

/** Some source strings carry HTML entities (e.g. "IELTS &amp; TEF coach"); show them as text. */
export const unescapeHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
