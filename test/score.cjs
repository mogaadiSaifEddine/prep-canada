// Score calculator, draws page and per-path estimates. NODE_PATH=$(npm root -g) node test/score.cjs (server on :3100)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const shots = '/tmp/pc-shots'; require('fs').mkdirSync(shots, { recursive: true });
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const step = async (n, fn) => { process.stdout.write('• ' + n + ' … '); try { await fn(); console.log('ok'); } catch (e) { console.log('FAIL'); await page.screenshot({ path: shots + '/fail-score.png', fullPage: true }); throw e; } };
  const big = async () => Number((await page.textContent('.crsbig')).split('/')[0].trim());

  await step('calculator computes a known profile (469)', async () => {
    await page.goto(BASE + '/#/paths/score'); await page.waitForSelector('#f-crs');
    await page.fill('#c-age', '29'); await page.selectOption('#c-edu', 'mast');
    for (const k of ['L', 'R', 'W', 'S']) { await page.selectOption('#c-en' + k, '9'); await page.selectOption('#c-fr' + k, '0'); }
    await page.selectOption('#c-fwExp', '3'); await page.selectOption('#c-caExp', '0');
    await page.waitForTimeout(200);
    const v = await big(); if (v !== 469) throw new Error('CRS ' + v);
  });
  await step('adding French NCLC 7 → 531 and French draw verdict', async () => {
    for (const k of ['L', 'R', 'W', 'S']) await page.selectOption('#c-fr' + k, '7');
    await page.waitForTimeout(200);
    const v = await big(); if (v !== 531) throw new Error('CRS ' + v);
    await page.waitForSelector('.ccmp >> text=Above every cut-off');
    await page.screenshot({ path: shots + '/40-calc.png', fullPage: true });
  });
  await step('partner fields appear for couples', async () => {
    await page.selectOption('#c-spouse', 'with'); await page.waitForSelector('#c-partner:not([hidden])');
    await page.selectOption('#c-spouse', 'single');
  });
  await step('draws page with trend and your line', async () => {
    await page.goto(BASE + '/#/paths/draws'); await page.waitForSelector('.trend svg .tline');
    await page.waitForSelector('text=You: 531');
    await page.click('[data-sa=draws-cat][data-c=cec]'); await page.waitForSelector('h2 >> text=Canadian Experience Class');
    await page.hover('.tpt >> nth=-1 >> .tdot', { force: true }); await page.waitForTimeout(200);
    await page.screenshot({ path: shots + '/41-draws.png', fullPage: true });
    await page.click('[data-sa=draws-group][data-g=quebec]'); await page.waitForSelector('text=Québec skilled workers');
    await page.click('[data-sa=draws-group][data-g=provinces]'); await page.waitForSelector('text=Provincial rounds');
  });
  await step('paths list shows tools, cut-offs and match pills', async () => {
    await page.goto(BASE + '/#/paths'); await page.waitForSelector('.tools .tool >> text=531');
    await page.waitForSelector('.pathcard .cutline >> text=Last cut-off 382');
    await page.screenshot({ path: shots + '/42-paths-tools.png' });
  });
  await step('path estimate panel', async () => {
    await page.goto(BASE + '/#/paths/ee-french'); await page.waitForSelector('#estimate >> text=Above every cut-off');
    await page.click('[data-sa=to-estimate]'); await page.waitForTimeout(500);
    await page.screenshot({ path: shots + '/43-estimate.png' });
    await page.goto(BASE + '/#/paths/draws?c=pnp'); await page.waitForSelector('h2 >> text=Provincial nominees');
  });
  await step('phone layout', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [n, u] of [['44-m-calc', '/#/paths/score'], ['45-m-draws', '/#/paths/draws?c=french'], ['46-m-est', '/#/paths/ee-cec']]) {
      await page.goto(BASE + u); await page.waitForTimeout(700);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) throw new Error(n + ' overflows by ' + ov);
      await page.screenshot({ path: shots + '/' + n + '.png', fullPage: true });
    }
  });
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
