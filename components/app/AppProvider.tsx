'use client';
// App state that every page needs: config, the signed-in user and their plan, the interface
// language, toasts and the upgrade prompt. Boot mirrors the old single-page app: theme, language,
// config, session, health check, then render.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, type ApiError } from '@/lib/client/api';
import { bridge } from '@/lib/client/bridge';
import * as Theme from '@/lib/client/theme';
import * as Paths from '@/lib/client/paths-store';
import { detect, saved as savedLang, setLang, t, type Lang } from '@/lib/i18n';
import type { Config, Entitlement, Exam, Me, Period } from '@/lib/shared/types';
import { resetCoaches } from '@/lib/coach/registry';

type Health = { ok: boolean; missing?: string[]; db?: boolean };
export type Billing = { period: Period; plan: 'solo' | 'duo' | null; exam: Exam; method: 'konnect' | 'flouci' | 'manual' | null };

type AppCtx = {
  ready: boolean;
  me: Me | null;
  ent: Partial<Record<Exam, Entitlement>>;
  config: Config;
  setup: Health | null;
  lang: Lang;
  focus: boolean;
  billing: Billing;
  installEvt: any;
  setBilling: (b: Partial<Billing>) => void;
  setFocus: (on: boolean) => void;
  setLanguage: (l: string) => Promise<void>;
  loadMe: () => Promise<void>;
  signedOut: () => void;
  toast: (msg: string) => void;
  errCopy: (e: unknown) => string;
  handleError: (e: unknown) => void;
  upsell: (msg: string) => void;
  closeUpsell: () => void;
  install: () => void;
  go: (path: string) => void;
};

const FALLBACK_CONFIG: Config = { prices: { solo: { month: 15, year: 150 }, duo: { month: 25, year: 250 } }, methods: { manual: true }, manualInfo: '', limits: {} };
const Ctx = createContext<AppCtx | null>(null);
export function useApp() { const c = useContext(Ctx); if (!c) throw new Error('useApp outside AppProvider'); return c; }

// The TEF coach speaks French whatever the interface language.
const FR: Record<string, string> = {
  plan_required: 'Cette fonction fait partie des offres Solo et Duo.',
  rate_limited: 'Le service est occupé. Réessayez dans une minute.',
  ai_error: 'Le service IA a renvoyé une erreur. Réessayez.',
  ai_timeout: 'L’IA a mis trop de temps à répondre. Réessayez.',
  invalid_json: 'La réponse est arrivée dans un mauvais format. Réessayez.',
  offline: 'Vous semblez hors ligne. Vérifiez votre connexion.',
  unauthorized: 'Reconnectez-vous.',
  server_error: 'Un problème est survenu. Réessayez.',
  not_saved: 'Vos réponses ne sont pas encore enregistrées. Réessayez dans un instant.'
};

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [ent, setEnt] = useState<Partial<Record<Exam, Entitlement>>>({});
  const [config, setConfig] = useState<Config>(FALLBACK_CONFIG);
  const [setup, setSetup] = useState<Health | null>(null);
  const [lang, setLangState] = useState<Lang>('en');
  const [focus, setFocus] = useState(false);
  const [billing, setBillingState] = useState<Billing>({ period: 'month', plan: null, exam: 'ielts', method: null });
  const [toastMsg, setToastMsg] = useState('');
  const [upsellMsg, setUpsellMsg] = useState<string | null>(null);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const meRef = useRef<Me | null>(null); meRef.current = me;
  const entRef = useRef(ent); entRef.current = ent;

  const toast = useCallback((msg: string) => { setToastMsg(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 4200); }, []);
  const curExam = () => (typeof location !== 'undefined' && location.pathname.startsWith('/tef') ? 'tef' : 'ielts');
  const errCopy = useCallback((e: unknown) => {
    const x = (e || {}) as ApiError;
    if (curExam() === 'tef' && FR[x.code]) return FR[x.code];
    if (x.key) return t(x.key, x.vars || {});
    return x.message ? t(x.message) : t('Something went wrong. Try again.');
  }, []);
  const go = useCallback((path: string) => router.push(path), [router]);

  const loadMe = useCallback(async () => {
    Paths.reset();
    try { const r = await api<{ user: Me | null; entitlements?: Record<Exam, Entitlement> }>('GET', '/api/me'); setMe(r.user); meRef.current = r.user; setEnt(r.entitlements || {}); }
    catch { setMe(null); meRef.current = null; setEnt({}); }
  }, []);
  const signedOut = useCallback(() => { setMe(null); meRef.current = null; setEnt({}); resetCoaches(); Paths.reset(); }, []);
  const handleError = useCallback((e: unknown) => {
    const x = (e || {}) as ApiError;
    if (x.code === 'unauthorized') { signedOut(); router.push('/login'); return; }
    if (x.code === 'plan_required') { setUpsellMsg(errCopy(e)); return; }
    toast(errCopy(e));
  }, [errCopy, router, signedOut, toast]);

  const setLanguage = useCallback(async (l: string) => {
    const next = await setLang(l);
    setLangState(next);
    if (meRef.current) { setMe({ ...meRef.current, lang: next }); api('POST', '/api/me', { lang: next }).catch(() => {}); }
  }, []);

  // Non-React modules (coaches, paths store) read the current state through the bridge.
  bridge.me = () => meRef.current;
  bridge.ent = (ex) => entRef.current[ex] || {};
  bridge.toast = toast;
  bridge.errCopy = errCopy;
  bridge.handleError = handleError;
  bridge.navigate = go;

  // Boot
  useEffect(() => {
    let alive = true;
    (async () => {
      // Old links used hash routes (#/signup, #/paths/score…): move them to the real path.
      if (location.hash.startsWith('#/')) router.replace(location.hash.slice(1) || '/');
      Theme.apply();
      setLangState(await setLang(detect(), { remember: false }));
      try { setConfig(await api<Config>('GET', '/api/config')); } catch { setConfig(FALLBACK_CONFIG); }
      Paths.reset();
      let user: Me | null = null;
      try { const r = await api<{ user: Me | null; entitlements?: Record<Exam, Entitlement> }>('GET', '/api/me'); user = r.user; setEnt(r.entitlements || {}); } catch { /* signed out */ }
      setMe(user); meRef.current = user;
      if (user && user.lang && !savedLang()) setLangState(await setLang(user.lang, { remember: false }));
      try { const hl = await api<Health>('GET', '/api/health'); if (!hl.ok) setSetup(hl); } catch { setSetup({ ok: false, missing: ['server'] }); }
      if (alive) setReady(true);
      if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {});
    })();
    const unfollow = Theme.followSystem();
    const onInstall = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => { alive = false; unfollow(); window.removeEventListener('beforeinstallprompt', onInstall); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New page: close the upgrade prompt and leave the test "focus" mode.
  useEffect(() => { setUpsellMsg(null); setFocus(false); }, [pathname]);

  const value = useMemo<AppCtx>(() => ({
    ready, me, ent, config, setup, lang, focus, billing, installEvt,
    setBilling: (b) => setBillingState((cur) => ({ ...cur, ...b })),
    setFocus,
    setLanguage, loadMe, signedOut, toast, errCopy, handleError,
    upsell: (m) => setUpsellMsg(m), closeUpsell: () => setUpsellMsg(null),
    install: () => { if (installEvt) { installEvt.prompt(); setInstallEvt(null); } },
    go
  }), [ready, me, ent, config, setup, lang, focus, billing, installEvt, setLanguage, loadMe, signedOut, toast, errCopy, handleError, go]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast" id="toast" hidden={!toastMsg} role="status">{toastMsg}</div>
      <div id="upsell">{upsellMsg != null && <UpsellModal msg={upsellMsg} onClose={() => setUpsellMsg(null)} />}</div>
    </Ctx.Provider>
  );
}

function UpsellModal({ msg, onClose }: { msg: string; onClose: () => void }) {
  const fr = typeof location !== 'undefined' && location.pathname.startsWith('/tef');
  const router = useRouter();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 30, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="up-t" style={{ maxWidth: 440, width: '100%' }}>
        <p className="eyebrow">Solo &amp; Duo</p>
        <h2 id="up-t">{fr ? 'Passez à une offre payante' : t('Upgrade to keep going')}</h2>
        <p>{msg}</p>
        <div className="row">
          <a className="btn primary" href="/plans" data-sa="close-upsell" onClick={(e) => { e.preventDefault(); onClose(); router.push('/plans'); }}>{fr ? 'Voir les offres' : t('See plans')}</a>
          <button className="btn" data-sa="close-upsell" onClick={onClose}>{fr ? 'Plus tard' : t('Not now')}</button>
        </div>
      </div>
    </div>
  );
}
