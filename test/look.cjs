// Visual check: screenshots of the main screens in light and dark, desktop and phone.
// OUT=/tmp/pc-look node test/look.cjs   (server on :3100)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = process.env.OUT || '/tmp/pc-look'; require('fs').mkdirSync(OUT, { recursive: true });
const LANG = process.env.LOOK_LANG || 'en';
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const email = 'look' + Date.now() + '@x.tn';
  for (const [scheme, vp, tag] of [['light', { width: 1360, height: 900 }, 'd-light'], ['dark', { width: 1360, height: 900 }, 'd-dark'], ['dark', { width: 390, height: 844 }, 'm-dark'], ['light', { width: 390, height: 844 }, 'm-light']]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, locale: LANG === 'ar' ? 'ar-TN' : LANG === 'fr' ? 'fr-FR' : 'en-US', deviceScaleFactor: vp.width < 500 ? 2 : 1 });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(tag + ': ' + e.message));
    const shot = async (n, full = false) => { await page.waitForTimeout(350); await page.screenshot({ path: OUT + '/' + tag + '-' + n + '.png', fullPage: full }); };
    await page.goto(BASE + '/'); await page.waitForSelector('.hero, .today, .panel'); await shot('1-landing', vp.width < 500);
    if (tag === 'd-light') {
      await page.goto(BASE + '/signup'); await page.waitForSelector('#s-email'); await shot('2-signup');
      await page.fill('#s-name', 'Look Test'); await page.fill('#s-email', email); await page.fill('#s-pass', 'secret123');
      const c = await page.$('form input[type=checkbox]'); if (c) await c.check();
      await page.click('form button[type=submit]'); await page.waitForTimeout(1500);
    } else {
      await page.goto(BASE + '/login'); await page.waitForSelector('form'); await page.fill('input[type=email]', email); await page.fill('input[type=password]', 'secret123'); await page.click('form button[type=submit]'); await page.waitForTimeout(1500);
    }
    await page.goto(BASE + '/'); await page.waitForTimeout(800); await shot('3-home', vp.width < 500);
    await page.goto(BASE + '/paths'); await page.waitForSelector('.pathgrid'); await shot('4-paths', true);
    await page.goto(BASE + '/paths/ee-french'); await page.waitForSelector('.jmap'); await shot('5-map');
    await page.click('.mpin >> nth=0'); await page.waitForSelector('#stopdrawer.open .drawer'); await shot('6-drawer'); await page.keyboard.press('Escape');
    await page.goto(BASE + '/paths/score'); await page.waitForSelector('#f-crs'); await shot('7-calc');
    await page.goto(BASE + '/paths/draws'); await page.waitForSelector('.dtable'); await shot('8-draws');
    await page.goto(BASE + '/plans'); await page.waitForSelector('.plan'); await shot('9-plans');
    await page.goto(BASE + '/ielts'); await page.waitForTimeout(1200); await shot('10-ielts');
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'page errors: none');
  console.log('screenshots in ' + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
