// Online rooms in each game: two players create/join a room and start a match, while a third
// "player" sends hostile presence, chat and gameplay messages. Fails on script errors, injected
// HTML running, or the match not starting.
import { chromium } from 'playwright';
import { serve, offlineContext, openPage, sleep } from './harness.mjs';

const XSS = '<img src=x onerror="window.__pwned=(window.__pwned||0)+1">';
// room prefixes must match each game's channel name (bump here when a game bumps its prefix)
const GAMES = [
  { file: 'crumb-bound.html', prefix: 'cb-v6:', joinShow: null, codeInput: '#room-input', joinBtn: '#btn-joinb' },
  { file: 'bubble-brawl.html', prefix: 'bb-v2:', joinShow: '#btn-join', codeInput: '#code-input', joinBtn: '#btn-go' },
  { file: 'hamster-roll.html', prefix: 'hr2:', joinShow: '#btn-join', codeInput: '#code-input', joinBtn: '#btn-go' },
];
const click = (p, sel) => p.evaluate(s => document.querySelector(s).click(), sel);

async function evil(page, room, msgs) {
  // a raw BroadcastChannel on the room: learns player ids from presence, then posts whatever it likes
  return page.evaluate(async ({ room, msgs }) => {
    const bc = new BroadcastChannel('fake:' + room), ids = [];
    bc.onmessage = e => { if (e.data.k === 'track' && e.data.p && e.data.p.id) ids.push(e.data.p.id); };
    bc.postMessage({ k: 'hello', from: 'evil' });
    await new Promise(r => setTimeout(r, 200));
    for (const m of msgs) {
      const list = m.perId ? ids.map(id => JSON.parse(JSON.stringify(m.msg).replaceAll('$ID', id))) : [m.msg];
      for (const x of list) bc.postMessage(x);
      await new Promise(r => setTimeout(r, 150));
    }
    bc.close(); return ids;
  }, { room, msgs });
}

async function run(browser, g) {
  const ctx = await offlineContext(browser);
  const errors = [];
  const open = async name => {
    const p = await openPage(ctx, site.url(g.file), errors, name);
    await p.fill('#name-input', name);
    return p;
  };
  const A = await open('Alice'), B = await open('Bob');
  await click(A, '#btn-create');
  await A.waitForFunction(() => /^[A-Z2-9]{4}$/.test((document.getElementById('room-code') || {}).textContent || ''), null, { timeout: 5000 });
  const code = await A.textContent('#room-code');
  if (g.joinShow) await click(B, g.joinShow);
  await B.evaluate(([s, c]) => { document.querySelector(s).value = c; }, [g.codeInput, code]);
  await click(B, g.joinBtn);
  await A.waitForFunction(() => /Bob/.test(document.getElementById('roster').textContent), null, { timeout: 5000 });
  const room = g.prefix + code;

  // lobby junk: hostile presence + chat
  await evil(B, room, [
    { msg: { k: 'track', from: 'evil', p: { id: 'evil', name: XSS, team: XSS, mobile: '__proto__', color: 'red;x:' + XSS, skin: {}, gear: 'x', joinedAt: 'soon', ready: 'yes' } } },
    { msg: { k: 'bc', event: 'chat', payload: { id: 'evil', name: { a: 1 }, text: XSS.repeat(50) } } },
    { msg: { k: 'untrack', from: 'evil' } },
  ]);
  await sleep(300);
  const lobbyRoster = await A.textContent('#roster');

  // start a match
  if (g.file === 'crumb-bound.html') {
    await click(B, '.teambtn[data-t="B"]'); await sleep(200);
    await click(A, '#btn-ready'); await click(B, '#btn-ready'); await sleep(300);
  }
  await click(A, '#btn-start');
  await sleep(1500);
  // the guest sees the host's match running (turn messages / snapshots arriving)
  const flowing = await {
    'crumb-bound.html': async () => /Alice|Bob/.test(await B.textContent('#turn-banner')),
    'bubble-brawl.html': async () => { const t0 = await B.textContent('#hTime'); await sleep(1200); return t0 !== await B.textContent('#hTime'); },
    'hamster-roll.html': async () => true,
  }[g.file]();
  const started = await B.evaluate(() => { const l = document.getElementById('lobby'); return !!l && getComputedStyle(l).display === 'none' || l.classList.contains('hidden'); });

  // match junk
  const junk = {
    'crumb-bound.html': [
      { perId: true, msg: { k: 'bc', event: 'move', payload: { id: '$ID', idx: '0', x: 'abc', ang: {}, face: 'x' } } },
      { perId: true, msg: { k: 'bc', event: 'aim', payload: { id: '$ID', idx: 0, ang: 'up' } } },
      { perId: true, msg: { k: 'bc', event: 'shot', payload: { id: '$ID', x: 'abc', ang: 45, power: 50, weapon: 7, item: 'bogus' } } },
      { perId: true, msg: { k: 'bc', event: 'shot', payload: { id: '$ID', x: 0, ang: 45, power: 'max', weapon: 7, item: 'bogus' } } },
      { msg: { k: 'bc', event: 'turn', payload: { activeIdx: 9 } } },
      { msg: { k: 'bc', event: 'snap', payload: { seq: 999, final: { terrain: 'x', mobiles: [] } } } },
    ],
    'bubble-brawl.html': [
      { perId: true, msg: { k: 'bc', event: 'inp', payload: { id: '$ID', d: 'zz' } } },
      { msg: { k: 'bc', event: 'snap', payload: { t: 'x', ps: [[0, 'a', 'b']], bs: 1 } } },
      { msg: { k: 'bc', event: 'mend', payload: { pid: 'evil', name: XSS, pops: XSS, d: 0 } } },
    ],
    'hamster-roll.html': [
      { msg: { k: 'bc', event: 'pos', payload: { id: '__proto__', x: 1, y: 1, name: XSS, roll: 'x' } } },
      { msg: { k: 'bc', event: 'pos', payload: { id: 'evil', x: 1, y: 1, name: XSS.repeat(20), roll: 'x', color: XSS } } },
      { msg: { k: 'bc', event: 'finish', payload: { id: 'evil', name: XSS, track: '__proto__', ms: 'x' } } },
      { msg: { k: 'bc', event: 'finish', payload: { id: 'evil', name: XSS, track: 0, ms: XSS } } },
    ],
  }[g.file];
  await evil(B, room, junk);
  await sleep(1500);
  const pwned = (await A.evaluate(() => window.__pwned || 0)) + (await B.evaluate(() => window.__pwned || 0));
  await ctx.close();
  return { game: g.file, started, flowing, rosterOk: /Alice/.test(lobbyRoster) && /Bob/.test(lobbyRoster), pwned, errors: [...new Set(errors)] };
}

const site = await serve();
const browser = await chromium.launch();
let bad = 0;
for (const g of GAMES) {
  let res;
  try { res = await run(browser, g); } catch (e) { res = { game: g.file, crashed: e.message.split('\n')[0] }; }
  const ok = !res.crashed && res.started && res.flowing && res.rosterOk && !res.pwned && !res.errors.length;
  if (!ok) bad++;
  console.log((ok ? '✓ ' : '✗ ') + JSON.stringify(res));
}
await browser.close(); site.close();
process.exit(bad ? 1 : 0);
