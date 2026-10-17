// Launches the desktop build, checks it loads offline, plays a CAPTCHA run to the end and sees the Steam event go out.
// Run with `npm test` (on Linux without a display: xvfb-run npm test). No Steam needed: steam.js skips itself.
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const desk = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = await electron.launch({ args: [desk, '--no-sandbox'], env: { ...process.env, STEAM_APP_ID: '' } });
const fail = msg => { console.error('✗ ' + msg); process.exitCode = 1; };
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForSelector('#go-shift');
  if (!(await page.evaluate(() => !!window.lhmDesktop && typeof window.lhmDesktop.event === 'function'))) fail('window.lhmDesktop missing');
  if (!(await page.isVisible('text=Quit to desktop'))) fail('no Quit to desktop button');
  if ((await page.getAttribute('#menu .small a', 'href')) !== 'https://cakecade.com/how-to-play.html#large-human-model') fail('How to play link not pointed at cakecade.com');
  // outside network is blocked
  const fetched = await page.evaluate(() => fetch('https://example.com/').then(() => true, () => false));
  if (fetched) fail('outside network was reachable');
  // record events reaching the main process
  await app.evaluate(({ ipcMain }) => { global.__ev = []; ipcMain.on('lhm-event', (e, n, d) => global.__ev.push([n, d])); });
  // a short shift: answer everything with "make it up" until the shift ends
  await page.click('#go-shift');
  for (const end = Date.now() + 120000; Date.now() < end;) {   // 12 requests, each a few seconds of "typing"
    const done = await page.evaluate(() => window.__lhm.S.done);
    if (done) break;
    const mk = await page.$('#s-row .btn.warn');
    if (mk) await mk.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForSelector('#r-menu', { timeout: 10000 });
  const ev = await app.evaluate(() => global.__ev);
  if (!ev.some(([n, d]) => n === 'shift-end' && typeof d.tokens === 'number')) fail('shift-end event not received: ' + JSON.stringify(ev));
  if (errors.length) fail('script errors: ' + errors.join(' | '));
  await page.screenshot({ path: join(desk, 'dist-smoke.png') });
  if (!process.exitCode) console.log('✓ desktop build loads offline, plays a shift and sends the Steam event', JSON.stringify(ev));
} finally {
  await app.close();
}
