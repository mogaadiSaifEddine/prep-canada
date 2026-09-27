// Language switch, RTL layout and untranslated-text sweep. NODE_PATH=$(npm root -g) node test/i18n.cjs (server on :3100)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const shots = '/tmp/pc-shots'; require('fs').mkdirSync(shots, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const step = async (page, n, fn) => { process.stdout.write('• ' + n + ' … '); try { await fn(); console.log('ok'); } catch (e) { console.log('FAIL'); await page.screenshot({ path: shots + '/fail-i18n.png', fullPage: true }); throw e; } };
  // English-looking words that should not appear on a French/Arabic page (visible text only)
  const LEAKS = /\b(Home|Paths|Plans|Sign in|Sign up|Create free account|Your road to Canada|Score calculator|Latest draws|stops done|Find my path|All paths|Your estimate|Official page|Mark as done|Timeline|Lowest score|What would raise|Details)\b/;
  const visible = (page) => page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let s = ''; while (w.nextNode()) { const n = w.currentNode; const el = n.parentElement; if (!el || el.closest('script,style,[lang="en"],[hidden],#app[lang],.sr,option')) continue; const r = el.getBoundingClientRect(); if (r.width && r.height) s += n.textContent + ' | '; } return s; });

  for (const [l, vp] of [['fr', { width: 1280, height: 900 }], ['ar', { width: 1280, height: 900 }], ['ar', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, locale: l === 'ar' ? 'ar-TN' : 'fr-FR' });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(l + ': ' + e.message));
    const tag = l + (vp.width < 500 ? '-m' : '');
    await step(page, tag + ': browser language is detected', async () => {
      await page.goto(BASE + '/#/'); await page.waitForFunction((x) => document.documentElement.lang === x, l);
      const dir = await page.evaluate(() => document.documentElement.dir); if (dir !== (l === 'ar' ? 'rtl' : 'ltr')) throw new Error('dir ' + dir);
      await page.screenshot({ path: shots + '/50-' + tag + '-landing.png', fullPage: vp.width < 500 });
    });
    for (const [n, u, sel] of [['paths', '/#/paths', '.pathgrid'], ['map', '/#/paths/ee-french', '.jmap'], ['calc', '/#/paths/score', '#f-crs'], ['draws', '/#/paths/draws', '.dtable'], ['plans', '/#/plans', '.plan'], ['login', '/#/login', 'form']]) {
      await step(page, tag + ': ' + n + ' has no English leftovers and no overflow', async () => {
        await page.goto(BASE + u); await page.waitForSelector(sel); await page.waitForTimeout(400);
        const txt = await visible(page); const m = txt.match(LEAKS); if (m) throw new Error('English "' + m[0] + '" in: …' + txt.slice(Math.max(0, m.index - 80), m.index + 60));
        const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (ov > 1) throw new Error('overflow ' + ov);
        if (['map', 'calc', 'draws', 'paths'].includes(n)) await page.screenshot({ path: shots + '/5' + (['paths', 'map', 'calc', 'draws'].indexOf(n) + 1) + '-' + tag + '-' + n + '.png', fullPage: true });
      });
    }
    if (vp.width > 500) await step(page, tag + ': drawer opens on the correct side', async () => {
      await page.goto(BASE + '/#/paths/ee-french'); await page.waitForSelector('.jmap'); await page.click('.mpin >> nth=2'); await page.waitForSelector('#stopdrawer.open .drawer'); await page.waitForTimeout(400);
      const x = await page.evaluate(() => document.querySelector('#stopdrawer .drawer').getBoundingClientRect().left);
      if (l === 'ar' ? x > 10 : x < 600) throw new Error('drawer x ' + x);
      await page.screenshot({ path: shots + '/55-' + tag + '-drawer.png' }); await page.keyboard.press('Escape');
    });
    await ctx.close();
  }
  // Switching language with the picker, and it sticks after reload; signed-in choice is saved to the account
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' }); const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push('switch: ' + e.message));
  await step(page, 'picker switches EN → AR and remembers it', async () => {
    await page.goto(BASE + '/#/paths'); await page.waitForSelector('text=Your road to Canada');
    await page.selectOption('#side [data-lang-pick]', 'ar'); await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await page.reload(); await page.waitForFunction(() => document.documentElement.lang === 'ar');
  });
  await step(page, 'sign-up in Arabic stores the language; coach stays English LTR', async () => {
    await page.goto(BASE + '/#/signup'); await page.fill('#s-name', 'Lang'); await page.fill('#s-email', 'lang' + Date.now() + '@x.tn'); await page.fill('#s-pass', 'secret123'); await page.check('#s-consent'); await page.click('button[type=submit]');
    await page.waitForSelector('#today'); const me = await page.evaluate(async () => (await (await fetch('/api/me')).json()).user.lang); if (me !== 'ar') throw new Error('lang ' + me);
    await page.goto(BASE + '/#/ielts'); await page.waitForTimeout(800);
    const a = await page.evaluate(() => ({ dir: document.getElementById('app').dir, lang: document.getElementById('app').lang })); if (a.dir !== 'ltr' || a.lang !== 'en') throw new Error(JSON.stringify(a));
    await page.screenshot({ path: shots + '/56-ar-ielts.png' });
    await page.selectOption('#side [data-lang-pick]', 'fr'); await page.waitForTimeout(500);
    const me2 = await page.evaluate(async () => (await (await fetch('/api/me')).json()).user.lang); if (me2 !== 'fr') throw new Error('lang after switch ' + me2);
  });
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
