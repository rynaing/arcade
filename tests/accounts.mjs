// Accounts: two browser contexts play as two devices on one account (fake-supabase.mjs + harness.mjs's
// fake database). Checks sign-in, the one shared name, cloud saves following the player, the
// "which progress to keep" choice, the name filter, and that guests never load Supabase.
import { chromium } from 'playwright';
import { serve, offlineContext, openPage, sleep, db } from './harness.mjs';

const site = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let bad = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) bad++; };
const ls = (p, k) => p.evaluate(k => localStorage.getItem(k), k);
const save = game => (Object.entries(db.arcade_saves).find(([k]) => k.endsWith('|' + game)) || [])[1];
async function until(fn, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn().catch(() => false)) return true; await sleep(150); } return false; }

async function signIn(p) {
  await p.click('#arc-acct');
  await p.selectOption('#arc-acct-age', '1990');
  await p.fill('.arc-acct-ov input[type=email]', 'player@example.com');
  await p.click('text=Email me a sign-in link');
  await p.fill('.arc-acct-ov input[autocomplete=one-time-code]', '123456');
  await p.click('.arc-acct-ov >> text=Sign in');
}

try {
  // guests: no Supabase download just for accounts
  const g = await offlineContext(browser);
  let loaded = false;
  g.on('request', r => { if (/supabase-js/.test(r.url())) loaded = true; });
  const gp = await openPage(g, site.url('index.html'), errors, 'guest hub');
  await sleep(800);
  check(!loaded, 'guest on the hub never loads Supabase');
  check((await gp.textContent('[data-arc-account]')) === 'Sign in', 'hub nav shows Sign in');
  await g.close();

  // age screen: too young is turned away, and stays turned away after picking another year
  const k = await offlineContext(browser);
  const pk = await openPage(k, site.url('crumb-bound.html'), errors, 'kid');
  await pk.click('#arc-acct');
  await pk.selectOption('#arc-acct-age', String(new Date().getFullYear() - 10));
  await pk.fill('.arc-acct-ov input[type=email]', 'kid@example.com');
  await pk.click('text=Email me a sign-in link');
  check(await until(() => pk.isVisible('text=Please ask a grown-up')), 'under 13 is asked to get a grown-up');
  await pk.selectOption('#arc-acct-age', '1990');
  await pk.click('text=Email me a sign-in link');
  check(!(await pk.isVisible('text=Check your email')) && await pk.isVisible('text=Please ask a grown-up'), 'changing the year after that still says no');
  check((await pk.evaluate(() => Object.keys(localStorage).filter(x => /1990|birth/.test(x + localStorage.getItem(x))).length)) === 0, 'birth year is not stored');
  await k.close();

  // device A: guest progress, then sign in → account takes the name and the save
  const a = await offlineContext(browser);
  const pa = await openPage(a, site.url('crumb-bound.html'), errors, 'device A');
  await pa.evaluate(() => { localStorage.setItem('cb-gold', '1234'); localStorage.setItem('cb-name', 'Baker Bob'); });
  await pa.reload(); await sleep(500);
  check(await pa.evaluate(() => { const i = document.getElementById('chat-in'); return i.readOnly && i.placeholder === 'Sign in to chat'; }), 'guests can\'t type in chat');
  check(await pa.evaluate(() => ArcadeBoard.record('cake-td', 'classic-0', 5000, { format: 'points', label: 'Classic · Meadow Loop' })), 'a guest\'s new best is recorded');
  check(await until(() => pa.isVisible('#arc-acct-nudge >> text=New best!')), 'a guest\'s new best offers an account');
  await pa.click('#arc-acct-nudge .nx');
  await signIn(pa);
  check(await until(async () => (db.arcade_profiles[Object.keys(db.arcade_profiles)[0]] || {}).name === 'Baker Bob'), 'first sign-in keeps the name typed as a guest');
  check(await until(async () => (save('crumb-bound') || { data: {} }).data['cb-gold'] === '1234'), 'guest progress is uploaded to the account');
  check(/Baker Bob/.test(await pa.textContent('#arc-acct')), 'bar button shows the account name');
  check(await until(() => pa.isVisible('text=Hi, Baker Bob!')), 'card switches to the account after the code');
  check(await until(async () => /cake-td\|classic-0/.test((save('arcade') || { data: {} }).data['arcade-bests'] || '')), 'the guest\'s best is saved to the account');
  check(await pa.evaluate(() => !document.getElementById('chat-in').readOnly), 'signed in, chat unlocks');
  await pa.keyboard.press('Escape');

  // device B: has its own progress → asked which to keep → account wins → page reloads with it
  const b = await offlineContext(browser);
  const pb = await openPage(b, site.url('crumb-bound.html'), errors, 'device B');
  await pb.evaluate(() => localStorage.setItem('cb-gold', '50'));
  await pb.reload(); await sleep(500);
  await signIn(pb);
  check(await until(() => pb.isVisible('text=Which progress to keep?')), 'second device asks which progress to keep');
  await pb.click('text=Keep my account’s progress');
  check(await until(async () => (await ls(pb, 'cb-gold')) === '1234'), 'account progress lands on the second device');
  check((await ls(pb, 'cb-name')) === 'Baker Bob', 'second device gets the account name');
  check(await until(() => pb.isVisible('text=Loaded your saved progress')), 'reload says progress was loaded');

  // play on B → the change is uploaded on the next tick
  await pb.evaluate(() => localStorage.setItem('cb-gold', '2000'));
  check(await until(async () => save('crumb-bound').data['cb-gold'] === '2000', 14000), 'progress on one device is saved to the account');

  // back on A: the newer cloud save replaces A's copy
  await pa.reload();
  check(await until(async () => (await ls(pa, 'cb-gold')) === '2000'), 'other device picks up the newer save on load');

  // my page: the best made as a guest on device A shows on device B
  const pp = await openPage(b, site.url('profile.html'), errors, 'device B my page');
  check(await until(async () => /Classic · Meadow Loop\s*5,000/.test(await pp.textContent('#games'))), 'my page shows bests from the account');
  await pp.close();

  // the one name: rejected names stay out, a new name reaches every game's key
  await pb.click('#arc-acct');
  await pb.fill('.arc-acct-ov input[aria-label="Player name"]', 'badword');
  await pb.click('text=Save name');
  check(await until(() => pb.isVisible('text=Please pick a different name.')), 'filtered names are refused');
  await pb.fill('.arc-acct-ov input[aria-label="Player name"]', 'Cake Boss');
  await pb.click('text=Save name');
  check(await until(() => pb.isVisible('text=Saved! It shows in every game.')), 'new name saves');
  check((await pb.inputValue('#name-input')) === 'Cake Boss', 'the game\'s name box on screen updates too');
  const ph = await openPage(a, site.url('hamster-roll.html'), errors, 'device A hamster');
  check(await until(async () => (await ls(ph, 'hr-name')) === 'Cake Boss' && (await ls(ph, 'cb-name')) === 'Cake Boss'), 'new name reaches every game on the other device');

  // a name typed inside a game becomes the account name
  await ph.evaluate(() => localStorage.setItem('hr-name', 'Roll Queen'));
  check(await until(async () => Object.values(db.arcade_profiles)[0].name === 'Roll Queen', 14000), 'a name typed in a game updates the account');

  // sign out, then delete
  await pb.keyboard.press('Escape');
  await pb.click('#arc-acct');
  await pb.click('.arc-acct-ov >> text=Sign out');
  check(await until(async () => /Sign in/.test(await pb.textContent('#arc-acct'))), 'sign out');
  await pa.reload(); await sleep(800);
  await pa.evaluate(() => { window.confirm = () => true; });
  await pa.click('#arc-acct');
  await pa.click('text=Delete my account');
  check(await until(async () => !Object.keys(db.arcade_profiles).length && !save('crumb-bound')), 'delete my account removes profile and saves');
  check((await ls(pa, 'cb-gold')) === '2000', 'deleting keeps progress on this device');
  await a.close(); await b.close();
} catch (e) { errors.push('test: ' + e.message.split('\n')[0]); }

for (const e of errors) console.log('✗ ' + e);
await browser.close(); site.close();
process.exit(bad || errors.length ? 1 : 0);
