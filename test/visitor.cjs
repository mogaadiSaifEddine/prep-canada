// Visitor data lives on the device and moves into the account at sign-up. NODE_PATH=$(npm root -g) node test/visitor.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const step = async (n, fn) => { process.stdout.write('• ' + n + ' … '); try { await fn(); console.log('ok'); } catch (e) { console.log('FAIL'); await page.screenshot({ path: '/tmp/pc-shots/fail-visitor.png', fullPage: true }); throw e; } };
  const local = () => page.evaluate(() => JSON.parse(localStorage.getItem('pc_journey') || 'null'));
  const email = 'visitor' + Date.now() + '@x.tn';

  await step('visitor ticks two stops and pins the path', async () => {
    await page.goto(BASE + '/#/paths/ee-french'); await page.waitForSelector('.jmap');
    await page.click('.mpin[data-stop=check]'); await page.waitForSelector('#stopdrawer.open .drawer');
    await page.click('#stopdrawer .dr-foot [data-sa=stop-toggle]'); await page.waitForTimeout(250);
    await page.click('#stopdrawer .dr-foot [data-sa=stop-toggle]'); await page.waitForTimeout(250); await page.keyboard.press('Escape');
    await page.waitForSelector('text=Saved on this device');
    const j = await local(); if (!j || Object.keys(j.progress['ee-french'] || {}).length !== 2 || j.pinned !== 'ee-french') throw new Error(JSON.stringify(j));
  });
  await step('visitor fills the calculator', async () => {
    await page.goto(BASE + '/#/paths/score'); await page.waitForSelector('#f-crs');
    for (const k of ['L', 'R', 'W', 'S']) { await page.selectOption('#c-en' + k, '9'); await page.selectOption('#c-fr' + k, '7'); }
    await page.fill('#c-age', '29'); await page.waitForTimeout(200);
    const j = await local(); if (!j.profile || j.profile.fr.L !== 7) throw new Error('profile not saved');
  });
  await step('survives a reload', async () => {
    await page.reload(); await page.goto(BASE + '/#/paths'); await page.waitForSelector('.pinned >> text=2 of 14 stops done');
    await page.waitForSelector('.tools .tool >> text=Your CRS score');
  });
  await step('sign-up moves everything into the account', async () => {
    await page.goto(BASE + '/#/signup'); await page.fill('#s-name', 'Visitor'); await page.fill('#s-email', email); await page.fill('#s-pass', 'secret123'); await page.check('#s-consent'); await page.click('button[type=submit]');
    await page.waitForSelector('text=now saved in your account');
    const doc = await page.evaluate(async () => (await (await fetch('/api/docs/journey/progress')).json()).data);
    if (Object.keys(doc.progress['ee-french']).length !== 2 || doc.pinned !== 'ee-french' || !doc.profile || doc.profile.fr.L !== 7) throw new Error(JSON.stringify(doc).slice(0, 300));
    if (await local()) throw new Error('local copy not cleared');
    await page.waitForSelector('#today >> text=Next stop');
  });
  await step('log out: this device is clean, the account is not copied back', async () => {
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', headers: { 'x-requested-with': 'prep-canada' } }));
    await page.goto(BASE + '/#/paths'); await page.reload(); await page.waitForSelector('text=Your road to Canada');
    if (await page.$('.pinned')) throw new Error('account data visible after logout');
  });
  await step('login to an account that has data does not merge a new visitor\'s ticks', async () => {
    await page.goto(BASE + '/#/paths/c16'); await page.waitForSelector('.jmap');
    await page.click('.mpin >> nth=0'); await page.waitForSelector('#stopdrawer.open .drawer'); await page.click('#stopdrawer .dr-foot [data-sa=stop-toggle]'); await page.waitForTimeout(250);
    await page.goto(BASE + '/#/login'); await page.fill('#l-email', email); await page.fill('#l-pass', 'secret123'); await page.click('button[type=submit]');
    await page.waitForSelector('#today .action'); await page.waitForTimeout(500);
    const doc = await page.evaluate(async () => (await (await fetch('/api/docs/journey/progress')).json()).data);
    if (doc.progress.c16) throw new Error('merged into an existing account');
    if (!(await local())) throw new Error('visitor data was dropped');
  });
  console.log('page errors:', errors.length ? errors : 'none');
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
