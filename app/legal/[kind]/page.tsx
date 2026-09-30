'use client';
// Terms of use and privacy policy (a starting draft: have a Tunisian lawyer review them).
import { useParams } from 'next/navigation';
import { useApp } from '@/components/app/AppProvider';
import { Page } from '@/components/app/Page';
import { fmtDate } from '@/lib/client/format';
import { t } from '@/lib/i18n';
import { tr, unescapeHtml } from '@/lib/i18n/react';
import { ArrFwd } from '@/components/app/ui';

export default function LegalPage() {
  const { config: c } = useApp();
  const { kind } = useParams<{ kind: string }>();
  const biz = c.business || t('[Business name, legal form and address]');
  const mf = c.matricule || t('[matricule fiscal]');
  const sup = c.support || t('[support email]');
  const inpdp = c.inpdp || t('[INPDP declaration / authorisation number]');
  const updated = <p className="muted">{t('Last updated {date}', { date: fmtDate(new Date()) })}</p>;
  const terms = <>
    <h1>{t('Terms of use')}</h1>{updated}
    <h2>{t('1. The service')}</h2><p>{unescapeHtml(t('Prep Canada (“the service”) is operated by {business}, matricule fiscal {matricule}. It offers practice tests, marking and lessons for IELTS General Training and TEF Canada. Tests and lessons are written and marked by an AI system. Scores are estimates to guide your preparation. They are not official results, and the service is not affiliated with IELTS, IDP, the British Council, Cambridge University Press &amp; Assessment, or CCI Paris Île-de-France.', { business: biz, matricule: mf }))}</p>
    <h2>{t('2. Your account')}</h2><p>{t('You must give accurate details and keep your password private. One account is for one person. We may suspend accounts used to abuse the service, for example by automated use or reselling access.')}</p>
    <h2>{t('3. Plans and payment')}</h2><p>{t('Prices are in Tunisian dinars and include VAT. Paid plans are prepaid for one month or twelve months and do not renew automatically. A plan starts when the payment is confirmed. Manual payments (D17 or bank transfer) start when we confirm receipt. Upgrading from Solo to Duo credits your unused Solo days.')}</p>
    <h2>{t('4. Refunds')}</h2><p>{t('If a technical problem on our side prevents you from using a paid plan, contact {support} within 14 days of payment and we will extend your plan or refund you. Under Law No. 2000-83 on electronic commerce, you may have a right to withdraw; because the service starts immediately at your request, this right may no longer apply once you have used it.', { support: sup })}</p>
    <h2>{t('5. Fair use')}</h2><p>{t('Paid plans include up to {n} new tests a day and daily limits on AI requests, to keep the service fast and affordable for everyone.', { n: c.limits?.paid?.testsPerDay || 6 })}</p>
    <h2>{t('6. Content')}</h2><p>{t('Practice material is generated for your personal preparation. You keep the rights to the answers you write. Do not copy the service or resell its content.')}</p>
    <h2>{t('7. Liability')}</h2><p>{t('We work to make the tests accurate and close to the real exams, but we do not guarantee any result in an official test or immigration process.')}</p>
    <h2>{t('8. Contact and law')}</h2><p>{t('Questions: {support}. These terms are governed by Tunisian law.', { support: sup })}</p>
  </>;
  const privacy = <>
    <h1>{t('Privacy policy')}</h1>{updated}
    <h2>{t('Who is responsible')}</h2><p>{t('{business} (matricule fiscal {matricule}) processes your personal data under Organic Law No. 2004-63 of 27 July 2004. Declaration to the INPDP: {inpdp}. Contact: {support}.', { business: biz, matricule: mf, inpdp, support: sup })}</p>
    <h2>{t('What we collect')}</h2><ul><li>{t('Account details: name, email, a secured (hashed) password')}</li><li>{t('Your study data: settings, test answers, spoken answers as text, scores and course progress')}</li><li>{t('Payments: plan, amount, method, the payment provider’s reference. We never see or store your card details.')}</li></ul>
    <h2>{t('Why')}</h2><p>{t('To provide the service you signed up for: creating and marking your tests, building your course, managing your plan, and keeping accounting records.')}</p>
    <h2>{t('Transfers outside Tunisia')}</h2><p>{t('With your explicit consent at sign-up, your answers are sent through OpenRouter to third-party AI model providers to create and mark tests. We use free models, whose providers may keep what is sent and use it to improve their services, so do not put sensitive personal details in your answers. When studio voices are on, test scripts are also sent to Google to produce the voices. Our database and hosting may also be located outside Tunisia. These transfers are subject to authorisation by the INPDP, which we request or hold as required.')}</p>
    <h2>{t('How long')}</h2><p>{t('We keep your study data while your account exists. When you delete your account, it is erased. Payment records are kept for the period required by Tunisian tax law.')}</p>
    <h2>{t('Your rights')}</h2><p>{tr('You can access and download your data ({where}), correct it, object to its processing on legitimate grounds, and delete your account at any time. You can also contact the INPDP.', { where: <>{t('Account')} <ArrFwd /> {t('Download my data')}</> })}</p>
    <h2>{t('Cookies and storage on your device')}</h2><p>{t('We use one essential cookie to keep you signed in. No advertising or tracking cookies.')}</p><p>{t('If you use the immigration paths or the score calculator without an account, your progress and answers are kept only in your browser\'s storage on this device; they are not sent to us. When you create an account, they are moved into it and removed from the device. You can clear them at any time by clearing this site\'s data in your browser.')}</p>
  </>;
  return <Page><div className="panel legal">{kind === 'terms' ? terms : privacy}</div></Page>;
}
