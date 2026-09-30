// Immigration paths check. NODE_PATH=$(npm root -g) node test/paths.cjs  (server on :3100)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const shots = '/tmp/pc-shots'; require('fs').mkdirSync(shots, { recursive: true });
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const step = async (n, fn) => { process.stdout.write('• ' + n + ' … '); try { await fn(); console.log('ok'); } catch (e) { console.log('FAIL'); await page.screenshot({ path: shots + '/fail-paths.png', fullPage: true }); throw e; } };

  await step('list as visitor', async () => { await page.goto(BASE + '/paths'); await page.waitForSelector('text=Your road to Canada'); await page.screenshot({ path: shots + '/30-paths.png', fullPage: true }); });
  await step('finder ranks French draws first for a French speaker', async () => {
    await page.check('input[name=fq-fr][value="7"]', { force: true }); await page.check('input[name=fq-exp][value="3"]', { force: true });
    await page.click('#f-finder button[type=submit]'); await page.waitForSelector('.pathcard .pill.good');
    const first = await page.textContent('.pathgrid .pathcard h3'); if (!/French-language/.test(first)) throw new Error('first was ' + first);
    await page.screenshot({ path: shots + '/31-finder.png', fullPage: true });
  });
  await step('map page', async () => { await page.click('.pathgrid .pathcard >> nth=0'); await page.waitForSelector('.jmap .mpin'); await page.screenshot({ path: shots + '/32-map.png', fullPage: true }); await page.click('.mpin >> nth=3'); await page.waitForSelector('#stopdrawer.open .drawer'); await page.waitForTimeout(300); await page.screenshot({ path: shots + '/32b-drawer.png' }); await page.keyboard.press('Escape'); });
  await step('sign up and tick stops', async () => {
    await page.goto(BASE + '/signup'); await page.fill('#s-name', 'Paths Tester'); await page.fill('#s-email', 'paths' + Date.now() + '@x.tn'); await page.fill('#s-pass', 'secret123'); await page.check('#s-consent'); await page.click('button[type=submit]');
    await page.waitForSelector('text=Welcome'); await page.waitForSelector('text=Find your immigration path');
    await page.goto(BASE + '/paths/ee-french'); await page.waitForSelector('.jmap');
    await page.click('.mpin[data-stop=check]'); await page.waitForSelector('#stopdrawer.open .drawer'); await page.click('#stopdrawer .dr-foot [data-sa=stop-toggle]');
    await page.waitForSelector('#stopdrawer.open #dr-title >> text=Take TEF Canada'); await page.click('#stopdrawer .dr-foot [data-sa=stop-toggle]'); await page.waitForTimeout(300); await page.keyboard.press('Escape');
    await page.waitForSelector('text=2 of 14 stops done');
    await page.waitForTimeout(1200); await page.reload(); await page.waitForSelector('text=2 of 14 stops done');
    await page.waitForSelector('.mpin.cur[data-stop=eca]');
    await page.screenshot({ path: shots + '/33-map-progress.png', fullPage: true });
  });
  await step('home shows the pinned path', async () => { await page.goto(BASE + '/'); await page.waitForSelector('text=Your immigration path'); await page.screenshot({ path: shots + '/34-home-path.png' }); });
  await step('phone layout', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [n, u] of [['35-m-paths', '/paths'], ['36-m-map', '/paths/c16']]) {
      await page.goto(BASE + u); await page.waitForTimeout(600);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) throw new Error(n + ' overflows by ' + ov);
      await page.screenshot({ path: shots + '/' + n + '.png', fullPage: true });
    }
  });
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
