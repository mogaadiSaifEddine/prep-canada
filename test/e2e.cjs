// End-to-end check against a local server running with GEMINI_MOCK=1 PAYMENTS_MOCK=1.
// npm run build && ./scripts/devserver.sh && NODE_PATH=$(npm root -g) node test/e2e.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const shots = process.env.SHOTS || '/tmp/pc-shots';
require('fs').mkdirSync(shots, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const step = async (name, fn) => { process.stdout.write('• ' + name + ' … '); try { await fn(); console.log('ok'); } catch (e) { console.log('FAIL'); await page.screenshot({ path: shots + '/fail-' + name.replace(/\W+/g, '_') + '.png', fullPage: true }); throw e; } };
  const shot = (n) => page.screenshot({ path: shots + '/' + n + '.png', fullPage: true });
  const click = (sel) => page.click(sel);

  await step('landing', async () => { await page.goto(BASE + '/'); await page.waitForSelector('text=Reach your CLB target'); await shot('01-landing'); });
  await step('signup', async () => {
    await page.goto(BASE + '/signup');
    await page.fill('#s-name', 'Saif Mogaadi'); await page.fill('#s-email', 'admin@x.tn'); await page.fill('#s-pass', 'secret123');
    await click('button[type=submit]'); await page.waitForSelector('#s-err:not([hidden])'); // consent missing
    await page.check('#s-consent'); await click('button[type=submit]');
    await page.waitForSelector('text=Welcome, Saif'); await shot('02-home');
  });
  await step('ielts setup', async () => {
    await page.goto(BASE + '/ielts'); await page.waitForSelector('text=Set up your IELTS coach');
    await page.selectOption('#set-target', '9'); await page.fill('#set-about', 'Software developer in Tunisia');
    await click('[data-act=savesettings]'); await page.waitForSelector('text=Find your real starting level'); await shot('03-ielts-home');
  });
  await step('placement: listening', async () => {
    await click('[data-act=placement]'); await page.waitForSelector('[data-act=start]:not([disabled])', { timeout: 20000 }); await shot('04-intro');
    await click('[data-act=start]'); await page.waitForSelector('.exambar');
    await page.fill('#L-q1', 'Hartley'); await page.fill('#L-q2', '180');
    await shot('05-listening');
    await click('[data-act=ask-submit]'); await click('[data-act=submit]');
    await page.waitForSelector('text=Next: Reading');
  });
  await step('placement: reading', async () => {
    await click('[data-act=start]'); await page.waitForSelector('.passage');
    await page.check('input[name="R-q1"][value="TRUE"]', { force: true });
    await shot('06-reading');
    await click('[data-act=ask-submit]'); await click('[data-act=submit]');
    await page.waitForSelector('text=Next: Writing');
  });
  await step('placement: writing', async () => {
    await click('[data-act=start]'); await page.waitForSelector('#wtext');
    await page.fill('#wtext', 'Dear Sir or Madam, I am writing for inform you that I left my bag in room 204. '.repeat(10));
    await click('[data-tab="1"]'); await page.fill('#wtext', 'Working from home is good for many employees because it saves time. '.repeat(20));
    await click('[data-act=ask-submit]'); await click('[data-act=submit]');
    await page.waitForSelector('text=Next: Speaking', { timeout: 20000 });
  });
  await step('placement: speaking', async () => {
    await click('[data-act=start]'); await page.waitForSelector('#spk');
    for (let i = 0; i < 40; i++) {
      const done = await page.$('text=Progress card');
      if (done) break;
      const box = await page.$('#spk');
      if (box) { const ds = await box.getAttribute('data-s'); if (ds !== 'notes') await box.fill('I work as a software developer and I really enjoy it because I solve problems every day.'); }
      const nx = await page.$('[data-act=snext]'); if (!nx) { await page.waitForTimeout(300); continue; }
      await nx.click(); await page.waitForTimeout(150);
    }
    await page.waitForSelector('text=Progress card', { timeout: 20000 }); await shot('07-report');
  });
  await step('free quota blocks second mock', async () => {
    await page.goto(BASE + '/ielts'); await click('[data-nav=tests]'); await page.check('input[name=mtype][value=L]', { force: true });
    await click('[data-act=mock]'); await page.waitForSelector('[data-act=start]:not([disabled])', { timeout: 20000 });
    await click('[data-act=leave]');
    await click('[data-act=discard]'); await click('[data-act=discard-yes]');
    await click('[data-nav=tests]'); await click('[data-act=mock]');
    await page.waitForSelector('#upsell h2'); await shot('08-upsell'); await click('#upsell [data-sa=close-upsell]:not(a)');
  });
  await step('course is gated on free', async () => { await click('[data-nav=course]'); await page.waitForSelector('text=Your personal course'); });
  await step('buy Duo with Konnect (mock)', async () => {
    await page.goto(BASE + '/plans'); await page.waitForSelector('text=Choose how you prepare'); await shot('09-plans');
    await click('[data-sa=choose][data-plan=duo]'); await page.check('input[name=paymethod][value=konnect]', { force: true });
    await shot('10-checkout');
    await click('[data-sa=pay]'); await page.waitForSelector('text=You’re on Duo', { timeout: 20000 }); await shot('11-paid');
  });
  await step('manual payment + admin approve', async () => {
    await page.goto(BASE + '/plans'); await click('[data-sa=period][data-p=year]'); await click('[data-sa=choose][data-plan=duo]');
    await page.check('input[name=paymethod][value=manual]', { force: true }); await page.fill('#pay-ref', 'D17-99812');
    await click('[data-sa=pay]'); await page.waitForSelector('text=Waiting for activation');
    await page.goto(BASE + '/admin'); await page.waitForSelector('text=D17-99812'); await shot('12-admin');
    await click('[data-sa=adm-approve]'); await page.waitForSelector('text=Nothing here.');
  });
  await step('course + lesson', async () => {
    await page.goto(BASE + '/ielts'); await page.reload(); await click('[data-nav=course]');
    await page.waitForSelector('[data-act=build]'); await click('[data-act=build]'); await page.waitForSelector('.unit', { timeout: 20000 }); await shot('13-course');
    await click('.unit >> nth=0'); await page.waitForSelector('text=Quiz', { timeout: 20000 });
    await click('[data-act=checkquiz]'); await page.waitForSelector('text=70% to pass'); await shot('14-lesson');
  });
  await step('tef setup + listening with studio voices', async () => {
    await page.goto(BASE + '/tef'); await page.waitForSelector('text=Configurez votre coach TEF');
    await click('[data-act=savesettings]'); await page.waitForSelector('text=Trouvez votre vrai niveau');
    await click('[data-act=placement]'); await page.waitForSelector('[data-act=start]:not([disabled])', { timeout: 20000 });
    await click('[data-act=start]'); await page.waitForSelector('[data-act=play]');
    await click('[data-act=play]');
    await page.waitForSelector('text=Écouté', { timeout: 30000 }); await shot('15-tef-listening');
  });
  await step('tef speaking examiner', async () => {
    await page.goto(BASE + '/tef'); await page.reload(); await page.waitForSelector('[data-act=discard]');
    await click('[data-act=discard]'); await click('[data-act=discard-yes]');
    await click('[data-nav=tests]'); await page.check('input[name=mtype][value=S]', { force: true });
    await click('[data-act=mock]'); await page.waitForSelector('[data-act=start]:not([disabled])', { timeout: 20000 });
    await click('[data-act=start]'); await click('[data-act=speakstart]'); await page.waitForSelector('.msg.ex');
    await page.fill('#spk', 'Bonjour, je voudrais savoir le prix des cours, s’il vous plaît.');
    await click('[data-act=send]'); await page.waitForFunction(() => [...document.querySelectorAll('.msg.ex')].filter((m) => !m.querySelector('.spinner')).length >= 2, null, { timeout: 20000 });
    await shot('16-tef-speaking');
    await click('[data-act=endA]'); await click('[data-act=speakstart]');
    await page.fill('#spk', 'Allez, viens avec moi, c’est une super occasion !'); await click('[data-act=send]');
    await page.waitForFunction(() => document.querySelectorAll('.msg.me').length >= 1 && !document.querySelector('.msg.ex .spinner'), null, { timeout: 20000 });
    await click('[data-act=ask-submit]'); await click('[data-act=submit]');
    await page.waitForSelector('text=Bilan', { timeout: 20000 }); await shot('17-tef-report');
  });
  await step('account + receipt', async () => {
    await page.goto(BASE + '/account'); await page.waitForSelector('[data-sa=receipt]'); await shot('18-account');
    await click('[data-sa=receipt]'); await page.waitForSelector('text=VAT 19%'); await shot('19-receipt');
  });
  await step('old #/ links still work', async () => {
    await page.goto(BASE + '/#/plans'); await page.waitForURL(BASE + '/plans'); await page.waitForSelector('text=Choose how you prepare');
    await page.goto(BASE + '/#/paths/score'); await page.waitForURL(BASE + '/paths/score'); await page.waitForSelector('#f-crs');
  });
  await step('phone layout', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [n, hsh] of [['20-m-home', '/'], ['21-m-ielts', '/ielts'], ['22-m-plans', '/plans']]) {
      await page.goto(BASE + hsh); await page.waitForTimeout(700);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) throw new Error(n + ' scrolls sideways by ' + ov + 'px');
      await shot(n);
    }
  });
  console.log('\nErrors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
