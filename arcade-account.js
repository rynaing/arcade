/* Ryan Cake Studios Arcade — one optional account for every game (Supabase Auth + cloud saves).
 *
 * Include on every page, right after arcade-ui.js and before the game's own scripts:
 *   <script src="arcade-account.js?v=1" data-game="crumb-bound"></script>
 *
 *  - Guests play exactly as before: progress lives in this browser's localStorage only.
 *  - Signed in, the account is the one source of truth:
 *      · one player name (arcade_profiles.name) written into every game's name key on load,
 *        and a name typed in any game becomes the account name;
 *      · each game's save keys (SAVES below) are mirrored to arcade_saves, so progress follows
 *        the player to any device. A newer cloud save is written to localStorage and the page
 *        reloads once, so the game reads it the normal way. No game code needs to change.
 *  - Adds an account button to the studio bar (and binds any [data-arc-account] link, e.g. on the hub).
 *  - ArcadeAccount.client() is the one shared Supabase client (arcade-net.js uses it too).
 *  - ArcadeAccount.user() → { id, email, name } or null;  ArcadeAccount.open() shows the account card.
 *
 * Database: supabase/accounts.sql (Ryan runs it). New game? Add its save keys to SAVES and its id to
 * the arcade_saves_game check in that file.
 */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://ukrxoqsvyvlyeblubjeo.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_hXr3XBpmRYSDiJNiOzt6yw_DttyIY6y';
  var SUPABASE_JS = 'vendor/supabase-js-2.117.2.umd.js';   // pinned; upgrade steps in README
  var AUTH_KEY = 'sb-ukrxoqsvyvlyeblubjeo-auth-token';     // where supabase-js keeps the session

  // localStorage keys that make up each game's saved progress ('arcade' = shared across games)
  var SAVES = {
    'arcade': ['arcade-audio'],
    'crumb-bound': ['cb-gold', 'cb-inv', 'cb-loadout', 'cb-gear-owned', 'cb-gear-equipped', 'cb-wins', 'cb-tp-gift', 'cb-bot'],
    'hamster-roll': ['hr-coins', 'hr-shop', 'hr2-best'],
    'bubble-brawl': ['bb-diff'],
    'frosted-duel': ['fd-record', 'fd-diff'],
    'ryans-cake-td': [],
  };
  var NAME_KEYS = ['arcade-player-name', 'cb-name', 'hr-name', 'bb-name'];
  var LS_ACCT = 'arcade-account';   // { id, email, name } of the signed-in player, for instant name on load
  var LS_SYNC = 'arcade-sync';      // { userId: { game: { rev, hash } } } — last save this device agreed with
  var SS_RELOAD = 'arcade-sync-reloaded';
  var TICK_MS = 10000;

  var me = document.currentScript || document.querySelector('script[src*="arcade-account"]');
  var GAME = (me && me.dataset.game) || '';
  if (!SAVES[GAME]) GAME = '';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function jget(k, d) { try { var v = JSON.parse(lsGet(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { lsSet(k, v == null ? null : JSON.stringify(v)); }
  function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16); }
  function isDefault(n) { return !!(window.ArcadeBoard && ArcadeBoard.isDefaultName && ArcadeBoard.isDefaultName(n)); }

  /* ---------------- name: the account's name wins, before any game reads it ---------------- */
  var acct = jget(LS_ACCT, null);
  if (acct && !acct.id) acct = null;
  function applyName(n) { n = cleanName(n); if (n) NAME_KEYS.forEach(function (k) { lsSet(k, n); }); }
  if (acct) applyName(acct.name);

  /* ---------------- shared Supabase client ---------------- */
  var ready = null;
  function client() {
    if (!ready) ready = new Promise(function (res) {
      function make() { try { res(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'implicit' } })); } catch (e) { res(null); } }
      if (window.supabase && window.supabase.createClient) return make();
      var s = document.createElement('script');
      s.src = SUPABASE_JS; s.onload = make; s.onerror = function () { res(null); };
      document.head.appendChild(s);
    });
    return ready;
  }

  /* ---------------- saves ---------------- */
  function snapshot(game) {
    var o = {};
    SAVES[game].forEach(function (k) { var v = lsGet(k); if (v != null) o[k] = v; });
    return o;
  }
  function hash(o) {
    var s = JSON.stringify(Object.keys(o).sort().map(function (k) { return [k, o[k]]; })), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36) + '.' + s.length;
  }
  function empty(o) { return !o || !Object.keys(o).length; }
  function syncMeta(uid, game, val) {
    var all = jget(LS_SYNC, {}) || {};
    if (val === undefined) return (all[uid] || {})[game] || null;
    all[uid] = all[uid] || {}; all[uid][game] = val; jset(LS_SYNC, all);
  }
  function cleanCloud(game, data) {
    var o = {};
    if (data && typeof data === 'object') SAVES[game].forEach(function (k) { if (typeof data[k] === 'string') o[k] = data[k]; });
    return o;
  }
  function applyCloud(game, data) {
    SAVES[game].forEach(function (k) { lsSet(k, Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null); });
  }

  var sb = null, user = null, profile = null, busy = {};
  async function upload(game) {
    if (!sb || !user || busy[game]) return;
    var snap = snapshot(game), h = hash(snap), m = syncMeta(user.id, game);
    if (m && m.hash === h) return;
    busy[game] = true;
    try {
      var r = await sb.from('arcade_saves').upsert({ user_id: user.id, game: game, data: snap }, { onConflict: 'user_id,game' })
        .select('updated_at').single();
      if (!r.error && r.data) syncMeta(user.id, game, { rev: r.data.updated_at, hash: h });
    } catch (e) {} finally { busy[game] = false; }
  }

  // returns true when the page is about to reload with the cloud save
  async function pull(game) {
    var r = await sb.from('arcade_saves').select('data,updated_at').eq('game', game).maybeSingle();
    if (r.error) return false;
    var local = snapshot(game), m = syncMeta(user.id, game);
    if (!r.data) { if (!empty(local)) await upload(game); return false; }
    var cloud = cleanCloud(game, r.data.data), rev = r.data.updated_at;
    if (hash(cloud) === hash(local)) { syncMeta(user.id, game, { rev: rev, hash: hash(local) }); return false; }
    if (m && m.rev === rev) { await upload(game); return false; }          // only this device changed: push it
    if (!m && !empty(local) && game !== 'arcade') {                         // first sign-in here, both have progress
      var keepCloud = await choose(game);
      if (!keepCloud) { syncMeta(user.id, game, { rev: rev, hash: '' }); await upload(game); return false; }
    }
    applyCloud(game, cloud);
    syncMeta(user.id, game, { rev: rev, hash: hash(cloud) });
    if (game === 'arcade' || !GAME) return false;
    var key = SS_RELOAD + ':' + game + ':' + rev;
    try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch (e) {}
    try { sessionStorage.setItem(SS_RELOAD, '1'); } catch (e) {}
    location.reload();
    return true;
  }

  /* ---------------- profile (the one name) ---------------- */
  function localName() {
    for (var i = 0; i < NAME_KEYS.length; i++) { var n = cleanName(lsGet(NAME_KEYS[i])); if (n && !isDefault(n)) return n; }
    return '';
  }
  async function loadProfile() {
    var r = await sb.from('arcade_profiles').select('name').eq('user_id', user.id).maybeSingle();
    if (r.error) return;
    if (r.data) profile = r.data;
    else {
      var ins = await sb.from('arcade_profiles').insert({ user_id: user.id, name: localName() }).select('name').single();
      if (ins.error) ins = await sb.from('arcade_profiles').insert({ user_id: user.id, name: '' }).select('name').single();
      profile = ins.data || { name: '' };
    }
    if (!profile.name) {
      var n = localName();
      if (n) await setName(n);
    }
    remember(); applyName(profile.name);
  }
  // resolves { ok: true, name } or { ok: false, error: 'name' | 'offline' }
  async function setName(n) {
    n = cleanName(n);
    if (!sb || !user) return { ok: false, error: 'offline' };
    var r = await sb.from('arcade_profiles').update({ name: n }).eq('user_id', user.id).select('name').single();
    if (r.error) return { ok: false, error: /not allowed/.test(r.error.message || '') ? 'name' : 'offline' };
    if (profile && profile.name && profile.name !== r.data.name) stale[profile.name] = true;
    delete stale[r.data.name];
    profile = r.data; remember(); applyName(profile.name);
    paint();
    return { ok: true, name: profile.name };
  }
  function remember() {
    acct = user ? { id: user.id, email: user.email || '', name: (profile && profile.name) || '' } : null;
    jset(LS_ACCT, acct);
  }
  // a name typed inside a game becomes the account name (and a rejected one is put back)
  var nameTry = '', stale = {};
  async function watchName() {
    if (!profile) return;
    var c = jget(LS_ACCT, null);   // another tab may have changed the name already
    if (c && c.id === user.id && c.name !== profile.name) { profile.name = c.name; acct = c; paint(); }
    for (var i = 0; i < NAME_KEYS.length; i++) {
      var n = cleanName(lsGet(NAME_KEYS[i]));
      if (n && n !== profile.name && !isDefault(n)) {
        if (stale[n]) { applyName(profile.name); return; }   // the open game wrote back the name it had before a rename
        if (n === nameTry) return;
        nameTry = n;
        var r = await setName(n);
        if (!r.ok && r.error === 'name') applyName(profile.name);
        return;
      }
    }
  }

  /* ---------------- session ---------------- */
  var started = false, listening = false;
  function listen() {
    if (listening || !sb || !sb.auth) return;
    listening = true;
    sb.auth.onAuthStateChange(function (ev, s) {
      setTimeout(function () {
        if (s && s.user) signedIn(s.user); else if (ev === 'SIGNED_OUT') signedOut();
      }, 0);
    });
  }
  async function signedIn(u) {
    if (user && user.id === u.id && started) return;
    user = u; started = true;
    await loadProfile();
    paint();
    if (GAME && (await pull(GAME))) return;
    await pull('arcade');
    try { if (sessionStorage.getItem(SS_RELOAD)) { sessionStorage.removeItem(SS_RELOAD); toast('Loaded your saved progress'); } } catch (e) {}
  }
  function signedOut() {
    user = null; profile = null; started = false; remember(); paint();
  }
  async function start() {
    var fromLink = /access_token=|error_description=/.test(location.hash);
    if (!fromLink && !lsGet(AUTH_KEY) && !acct) return;   // guests never load Supabase just for this
    sb = await client();
    if (!sb || !sb.auth) return;
    listen();
    var r = await sb.auth.getSession();
    if (r && r.data && r.data.session) signedIn(r.data.session.user);
    else if (acct) signedOut();
    if (fromLink) history.replaceState(null, '', location.pathname + location.search);
  }
  function tick() {
    if (!user || !sb) return;
    watchName();
    if (GAME) upload(GAME);
    upload('arcade');
  }
  setInterval(tick, TICK_MS);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') tick(); });

  /* ---------------- UI ---------------- */
  var CSS = [
    '#arc-acct{border:0;background:rgba(255,255,255,.12);color:#fff;font:800 12px var(--arc-font,system-ui);height:26px;padding:0 10px;border-radius:999px;cursor:pointer;',
    'max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#arc-acct:hover,#arc-acct:focus-visible{background:rgba(255,123,169,.35);outline:none}',
    '.arc-acct-ov{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(40,10,50,.55)}',
    '.arc-acct-ov[hidden]{display:none}',
    '.arc-acct-ov .arc-card{width:min(400px,100%);max-height:100%;overflow:auto;padding:22px 20px 18px;text-align:center;position:relative}',
    '.arc-acct-ov h2{margin:0 0 6px;font-size:22px;font-weight:900;color:var(--arc-plum,#5b3446)}',
    '.arc-acct-ov p{margin:6px 0;font-size:14px;line-height:1.45;color:var(--arc-ink,#3d3448)}',
    '.arc-acct-ov .arc-input{width:100%;margin:6px 0}',
    '.arc-acct-ov .arc-btn{width:100%;margin-top:8px}',
    '.arc-acct-ov .x{position:absolute;top:8px;right:10px;border:0;background:none;font-size:22px;cursor:pointer;color:var(--arc-muted,#8a7f95)}',
    '.arc-acct-ov select.arc-input{appearance:auto;cursor:pointer}',
    '.arc-acct-ov .msg{min-height:1.2em;font-size:13px;font-weight:800;color:var(--arc-pink-dark,#b0396a)}',
    '.arc-acct-ov .small{font-size:12px;color:var(--arc-muted,#8a7f95)}',
    '.arc-acct-ov .linkish{border:0;background:none;color:var(--arc-muted,#8a7f95);text-decoration:underline;cursor:pointer;font:inherit;font-size:12px;margin-top:10px}',
    '#arc-acct-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483600;background:#3a1a40;color:#fff;font:800 14px var(--arc-font,system-ui);',
    'padding:10px 18px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.3)}',
  ].join('');

  // after an under-age answer, keep saying no for a day so going back and picking another year doesn't work
  var LS_AGE = 'arcade-age-check';
  function ageBlocked() { var t = +lsGet(LS_AGE) || 0; return Date.now() - t < 864e5; }
  function blockAge() { lsSet(LS_AGE, String(Date.now())); }

  var ov = null, view = 'start', email = '', googleOn = false;
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs) { if (k === 'on') { for (var ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); } else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function toast(t) {
    var d = el('div', { id: 'arc-acct-toast', role: 'status' }, t);
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200);
  }
  function label() { return acct ? '👤 ' + (acct.name || 'My account') : '👤 Sign in'; }
  function paint() {
    var b = document.getElementById('arc-acct');
    if (b) b.textContent = label();
    [].forEach.call(document.querySelectorAll('[data-arc-account]'), function (a) { a.textContent = acct ? 'My account' : 'Sign in'; });
    // re-render the open card only when signing in or out changes which card it should be
    var want = acct ? 'me' : view === 'me' ? 'start' : view;
    if (ov && !ov.hidden && want !== view) { view = want; render(); }
  }
  function mount() {
    if (!document.getElementById('arc-acct-css')) { var st = el('style', { id: 'arc-acct-css' }); st.textContent = CSS; document.head.appendChild(st); }
    var snd = document.getElementById('arc-snd');
    if (snd && !document.getElementById('arc-acct')) {
      var wrap = snd.parentNode.classList.contains('arc-right') ? snd.parentNode : null;
      var b = el('button', { type: 'button', id: 'arc-acct', 'aria-label': 'Account' }, label());
      b.addEventListener('click', open);
      if (wrap) wrap.insertBefore(b, snd); else snd.parentNode.insertBefore(b, snd);
    }
    [].forEach.call(document.querySelectorAll('[data-arc-account]'), function (a) {
      if (a._arcAcct) return; a._arcAcct = true;
      a.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    paint();
  }

  function open() {
    if (!ov) {
      ov = el('div', { id: 'arc-acct-ov', class: 'arc-acct-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Account' });
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov && !ov.hidden && !choosing) close(); });
      document.body.appendChild(ov);
    }
    view = acct ? 'me' : (view === 'sent' ? 'sent' : 'start');
    ov.hidden = false; render();
    client().then(function (c) {
      sb = sb || c;
      listen();
      if (!c || googleOn) return;
      fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } }).then(function (r) { return r.json(); })
        .then(function (s) { googleOn = !!(s && s.external && s.external.google); if (googleOn && !acct) render(); }, function () {});
    });
  }
  function close() { if (ov) ov.hidden = true; }

  function render() {
    var card = el('div', { class: 'arc-card' });
    card.appendChild(el('button', { class: 'x', type: 'button', 'aria-label': 'Close', on: { click: close } }, '×'));
    var msg = el('p', { class: 'msg', role: 'status' });
    function say(t) { msg.textContent = t || ''; }
    function need() { if (!sb || !sb.auth) { say("Can't reach the server. Check your connection."); return false; } return true; }

    if (view === 'start') {
      card.appendChild(el('h2', {}, 'Sign in to save your progress'));
      card.appendChild(el('p', {}, 'One free account keeps your name, coins and best times in every game, on any device. Been here before? Use the same email to sign back in.'));
      // neutral age screen: pick a birth year (not stored anywhere). Too young → a grown-up makes the account.
      var now = new Date().getFullYear();
      var age = el('select', { class: 'arc-input', id: 'arc-acct-age', 'aria-label': 'Year you were born' });
      age.appendChild(el('option', { value: '' }, 'Year you were born'));
      for (var y = now; y >= now - 100; y--) age.appendChild(el('option', { value: String(y) }, String(y)));
      var lab = el('p', { class: 'small' }, 'Setting this up for your child? Use your own birth year and email.');
      function tooYoung() {
        if (ageBlocked()) return true;
        var y = +age.value;
        if (!y) { say('Pick the year you were born.'); return null; }
        if (now - y < 14) { blockAge(); return true; }   // born this recently could still be 12, so a grown-up signs up
        return false;
      }
      var KID = 'Please ask a grown-up to make the account with their own email.';
      var inp = el('input', { class: 'arc-input', type: 'email', placeholder: 'Your email', autocomplete: 'email', 'aria-label': 'Email' });
      inp.value = email;
      var go = el('button', { class: 'arc-btn', type: 'button' }, 'Email me a sign-in link');
      go.addEventListener('click', async function () {
        email = inp.value.trim();
        var t = tooYoung(); if (t === null) return; if (t) return say(KID);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('That email doesn’t look right.');
        if (!need()) return;
        go.disabled = true; say('Sending…');
        var r = await sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
        go.disabled = false;
        if (r.error) return say(/rate|seconds/i.test(r.error.message) ? 'Please wait a minute, then try again.' : 'Couldn’t send the email. Try again.');
        view = 'sent'; render();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
      card.appendChild(age); card.appendChild(lab); card.appendChild(inp); card.appendChild(go);
      if (googleOn) {
        var g = el('button', { class: 'arc-btn ghost', type: 'button' }, 'Continue with Google');
        g.addEventListener('click', function () {
          var t = tooYoung(); if (t === null) return; if (t) return say(KID);
          if (need()) sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
        });
        card.appendChild(g);
      }
      card.appendChild(msg);
      card.appendChild(el('p', { class: 'small' }, 'We only use your email to sign you in. See our Privacy page.'));
    } else if (view === 'sent') {
      card.appendChild(el('h2', {}, 'Check your email'));
      card.appendChild(el('p', {}, 'We sent a sign-in link to ' + email + '. Open it on this device, or type the code from the email here.'));
      var code = el('input', { class: 'arc-input', inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: 'Code', maxlength: '10', 'aria-label': 'Code' });
      var ok = el('button', { class: 'arc-btn', type: 'button' }, 'Sign in');
      ok.addEventListener('click', async function () {
        var t = code.value.replace(/\D/g, '');
        if (t.length < 6) return say('Type the code from the email.');
        if (!need()) return;
        ok.disabled = true; say('Checking…');
        var r = await sb.auth.verifyOtp({ email: email, token: t, type: 'email' });
        ok.disabled = false;
        if (r.error) return say('That code didn’t work. Check it or send a new one.');
        say('Signed in! Loading your account…');   // paint() switches to the account card once it's loaded
      });
      code.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok.click(); });
      card.appendChild(code); card.appendChild(ok); card.appendChild(msg);
      card.appendChild(el('button', { class: 'linkish', type: 'button', on: { click: function () { view = 'start'; render(); } } }, 'Use a different email'));
    } else {
      card.appendChild(el('h2', {}, acct && acct.name ? 'Hi, ' + acct.name + '!' : 'Your account'));
      card.appendChild(el('p', {}, 'Your name and progress in every game are saved to your account.'));
      if (acct && acct.email) card.appendChild(el('p', { class: 'small' }, 'Signed in as ' + acct.email));
      var nm = el('input', { class: 'arc-input', maxlength: '16', placeholder: 'Player name', 'aria-label': 'Player name' });
      nm.value = (acct && acct.name) || '';
      var save = el('button', { class: 'arc-btn mint', type: 'button' }, 'Save name');
      save.addEventListener('click', async function () {
        var n = cleanName(nm.value);
        if (!n) return say('Type a name first.');
        if (isDefault(n)) return say('Pick your own name.');
        save.disabled = true;
        var r = await setName(n);
        save.disabled = false;
        say(r.ok ? 'Saved! It shows in every game.' : r.error === 'name' ? 'Please pick a different name.' : 'Couldn’t save. Try again.');
      });
      var out = el('button', { class: 'arc-btn ghost', type: 'button' }, 'Sign out');
      out.addEventListener('click', async function () {
        if (sb && sb.auth) { tick(); await sb.auth.signOut(); }
        signedOut(); view = 'start'; render();
      });
      var del = el('button', { class: 'linkish', type: 'button' }, 'Delete my account');
      del.addEventListener('click', async function () {
        if (!confirm('Delete your account and its saved progress? Progress on this device stays.')) return;
        if (!need()) return;
        var r = await sb.rpc('arcade_delete_me');
        if (r.error) return say('Couldn’t delete it. Email hello@cakecade.com and we’ll do it.');
        await sb.auth.signOut(); signedOut(); view = 'start'; render(); toast('Account deleted');
      });
      card.appendChild(nm); card.appendChild(save); card.appendChild(out); card.appendChild(msg); card.appendChild(del);
    }
    ov.innerHTML = ''; ov.appendChild(card);
  }

  // first sign-in on a device where both the account and this device already have progress
  var choosing = false;
  function choose(game) {
    return new Promise(function (res) {
      if (!document.body) return res(true);
      choosing = true;
      var title = document.title.split('—')[0].split('|')[0].trim() || 'this game';
      var box = el('div', { class: 'arc-acct-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose progress' });
      var card = el('div', { class: 'arc-card' });
      card.appendChild(el('h2', {}, 'Which progress to keep?'));
      card.appendChild(el('p', {}, 'Your account and this device both have ' + title + ' progress. Pick one to keep everywhere.'));
      function pick(v) { return function () { choosing = false; box.remove(); res(v); }; }
      card.appendChild(el('button', { class: 'arc-btn', type: 'button', on: { click: pick(true) } }, 'Keep my account’s progress'));
      card.appendChild(el('button', { class: 'arc-btn ghost', type: 'button', on: { click: pick(false) } }, 'Keep this device’s progress'));
      box.appendChild(card);
      if (!document.getElementById('arc-acct-css')) mount();
      document.body.appendChild(box);
    });
  }

  window.ArcadeAccount = {
    client: client,
    user: function () { return acct ? { id: acct.id, email: acct.email, name: acct.name } : null; },
    open: open,
    setName: setName,
    _games: SAVES,
  };
  function boot() { mount(); setTimeout(mount, 400); start(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
