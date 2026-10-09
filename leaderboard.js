/* Ryan Cake Studios Arcade — global leaderboard client.
 *
 * Talks to two Postgres functions (see supabase/leaderboard.sql) over plain
 * fetch, so games don't need the Supabase library just for scores. The URL
 * and *publishable* key are public by design: the database only lets this key
 * call submit_score / top_scores, which validate everything server-side.
 *
 *   ArcadeBoard.submit(game, board, name, score, detail) -> Promise<{ok, error?, queued?}>
 *   ArcadeBoard.top(game, board, {period, limit})        -> Promise<rows | null>
 *   ArcadeBoard.render(el, rows, {format, emptyText})     -> fills a list element
 *   ArcadeBoard.name() / ArcadeBoard.setName(n)           -> remembered player name
 *   ArcadeBoard.friendlyName(fresh) / isDefaultName(n)    -> fun default name, and
 *                                    whether a name is a default (defaults don't post)
 *   ArcadeBoard.record(game, board, score, {lower, add, format, label}) -> true on a new personal best
 *                                    Kept in localStorage 'arcade-bests' for every player, named or not, so
 *                                    it follows a signed-in player (arcade-account.js) and a guest's bests
 *                                    are kept when they sign up. ArcadeBoard.bests() reads them.
 *
 * Submissions that fail because of the network are queued in localStorage and
 * retried on the next page load, so an offline win isn't lost.
 */
(function () {
  'use strict';
  var URL_ = 'https://ukrxoqsvyvlyeblubjeo.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_hXr3XBpmRYSDiJNiOzt6yw_DttyIY6y';
  var LS_CLIENT = 'arcade-client-id', LS_NAME = 'arcade-player-name', LS_QUEUE = 'arcade-score-queue';

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function clientId() {
    var id = lsGet(LS_CLIENT, '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) { id = uuid(); lsSet(LS_CLIENT, id); }
    return id;
  }

  function rpc(fn, body, timeoutMs) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = ctl && setTimeout(function () { ctl.abort(); }, timeoutMs || 8000);
    return fetch(URL_ + fn, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    }, function (err) { if (t) clearTimeout(t); throw err; });
  }

  function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16); }

  // Default names for players who haven't typed one, e.g. "Sunny Otter".
  // Words are short so every pair fits the 14-character name boxes.
  var ADJ = ['Sunny', 'Zippy', 'Jolly', 'Bouncy', 'Fuzzy', 'Giggly', 'Cosmic', 'Peppy', 'Snappy', 'Speedy',
    'Comfy', 'Bubbly', 'Frosty', 'Lucky', 'Dizzy', 'Cheery', 'Sugary', 'Toasty', 'Wobbly', 'Sparkly'];
  var CRITTER = ['Otter', 'Panda', 'Bunny', 'Puffin', 'Kitten', 'Koala', 'Gecko', 'Llama', 'Turtle', 'Corgi',
    'Sloth', 'Lemur', 'Pony', 'Frog', 'Owl', 'Fox', 'Bee', 'Duck', 'Hedgie', 'Moose'];
  var LS_DEFAULT = 'arcade-default-name';
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  // The same fun name each visit on this device, or a new one when `fresh`.
  function friendlyName(fresh) {
    var n = fresh ? '' : lsGet(LS_DEFAULT, '');
    if (!n || !isDefaultName(n)) { n = pick(ADJ) + ' ' + pick(CRITTER); if (!fresh) lsSet(LS_DEFAULT, n); }
    return n;
  }
  // Defaults (our fun names, plus the old "Player"/"Player 2"/"Hamster") never go
  // on the world boards: a player has to type their own name for that.
  function isDefaultName(n) {
    n = cleanName(n).toLowerCase();
    if (!n || /^(player( \d+)?|hamster)$/.test(n)) return true;
    var w = n.split(' ');
    var has = function (a, x) { return a.some(function (y) { return y.toLowerCase() === x; }); };
    return w.length === 2 && has(ADJ, w[0]) && has(CRITTER, w[1]);
  }

  function queue() { try { return JSON.parse(lsGet(LS_QUEUE, '[]')) || []; } catch (e) { return []; } }
  function saveQueue(q) { lsSet(LS_QUEUE, JSON.stringify(q.slice(-20))); }

  function send(entry) {
    return rpc('submit_score', {
      p_game: entry.game, p_board: entry.board, p_name: entry.name,
      p_score: entry.score, p_detail: entry.detail || {}, p_client_id: clientId()
    });
  }

  function submit(game, board, name, score, detail) {
    var entry = { game: game, board: String(board), name: cleanName(name), score: Math.round(Number(score)), detail: detail || {} };
    if (!entry.name) return Promise.resolve({ ok: false, error: 'Enter a name to join the leaderboard.' });
    if (!isFinite(entry.score)) return Promise.resolve({ ok: false, error: 'Invalid score.' });
    return send(entry).then(function (res) {
      return res && typeof res === 'object' ? res : { ok: false, error: 'Unexpected reply.' };
    }, function (err) {
      // Network / server down: keep it and retry later. 4xx means it won't ever succeed.
      if (!err.status || err.status >= 500) {
        var q = queue(); q.push(entry); saveQueue(q);
        return { ok: false, queued: true, error: 'Offline — your score will be sent next time.' };
      }
      return { ok: false, error: 'Couldn’t reach the leaderboard.' };
    });
  }

  function flushQueue() {
    var q = queue(); if (!q.length) return;
    saveQueue([]);
    q.reduce(function (p, entry) {
      return p.then(function () {
        return send(entry).catch(function (err) {
          if (!err.status || err.status >= 500) { var left = queue(); left.push(entry); saveQueue(left); }
        });
      });
    }, Promise.resolve());
  }

  function top(game, board, opts) {
    opts = opts || {};
    return rpc('top_scores', {
      p_game: game, p_board: String(board), p_period: opts.period || 'all', p_limit: opts.limit || 10
    }).then(function (rows) { return Array.isArray(rows) ? rows : []; }, function () { return null; });
  }

  // Formats: 'points' (1,234), 'seconds' (1:05), 'ms' (29.34s), 'wins' (12 wins).
  function fmt(score, format) {
    var n = Number(score);
    if (format === 'seconds') return Math.floor(n / 60) + ':' + String(Math.round(n % 60)).padStart(2, '0');
    if (format === 'ms') return (n / 1000).toFixed(2) + 's';
    if (format === 'wins') return n + (n === 1 ? ' win' : ' wins');
    return Math.round(n).toLocaleString();
  }

  // Renders rows into an <ol>/<ul>/<div>. Uses textContent only (names are user input).
  function render(el, rows, opts) {
    opts = opts || {};
    if (!el) return;
    el.textContent = '';
    var msg = function (text) { var li = document.createElement(el.tagName === 'OL' || el.tagName === 'UL' ? 'li' : 'div'); li.className = 'lb-empty'; li.textContent = text; el.appendChild(li); };
    if (rows === null) return msg('Leaderboard unavailable right now.');
    if (!rows.length) return msg(opts.emptyText || 'No scores yet — be the first!');
    var me = cleanName(lsGet(LS_NAME, '')).toLowerCase();
    rows.forEach(function (r) {
      var li = document.createElement(el.tagName === 'OL' || el.tagName === 'UL' ? 'li' : 'div');
      li.className = 'lb-row' + (me && String(r.name).toLowerCase() === me ? ' lb-me' : '');
      var rank = document.createElement('span'); rank.className = 'lb-rank'; rank.textContent = r.rank + '.';
      var name = document.createElement('span'); name.className = 'lb-name'; name.textContent = r.name;
      var score = document.createElement('span'); score.className = 'lb-score'; score.textContent = fmt(r.score, opts.format);
      li.appendChild(rank); li.appendChild(name); li.appendChild(score);
      if (opts.extra) { var ex = document.createElement('span'); ex.className = 'lb-extra'; ex.textContent = opts.extra(r) || ''; li.appendChild(ex); }
      el.appendChild(li);
    });
  }

  // Personal bests: { 'game|board': { s: score, lo: 1 if lower is better, add: 1 if a running total, f: format, l: label, at } }
  var LS_BESTS = 'arcade-bests';
  function bests() { try { var o = JSON.parse(lsGet(LS_BESTS, '{}')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function record(game, board, score, opts) {
    opts = opts || {}; score = Number(score);
    if (!game || !isFinite(score)) return false;
    var all = bests(), k = game + '|' + board, cur = all[k];
    var s = opts.add ? ((cur && +cur.s) || 0) + score : score;
    var better = opts.add || !cur || !isFinite(+cur.s) || (opts.lower ? s < +cur.s : s > +cur.s);
    if (!better) return false;
    all[k] = { s: s, at: Date.now() };
    if (opts.lower) all[k].lo = 1;
    if (opts.add) all[k].add = 1;
    if (opts.format) all[k].f = String(opts.format).slice(0, 12);
    if (opts.label) all[k].l = String(opts.label).slice(0, 40);
    lsSet(LS_BESTS, JSON.stringify(all));
    // a guest who just did well is the best moment to offer an account
    if (window.ArcadeAccount && ArcadeAccount.nudge && !ArcadeAccount.user())
      ArcadeAccount.nudge(opts.add ? 'Nice win! Sign in to keep your wins on every device.' : 'New best! Sign in to keep it on every device.');
    return true;
  }

  // Win-count boards (vs bots): post one win if the player won and has a real
  // name, then show the top 5. Default names and `placeholder` matches don't post.
  function winBoard(o) {
    var note = function (t) { if (o.note) { o.note.textContent = t || ''; o.note.hidden = !t; } };
    var AB = window.ArcadeBoard; // public object, so callers (and tests) can wrap it
    var show = function () { return AB.top(o.game, 'wins', { limit: 5 }).then(function (rows) { AB.render(o.list, rows, { format: 'wins', emptyText: 'No wins yet — be the first!' }); }); };
    note('');
    var n = cleanName(o.name);
    if (!o.won) return show();
    record(o.game, 'wins', 1, { add: true, format: 'wins', label: 'Wins vs bots' });
    if (isDefaultName(n) || (o.placeholder && o.placeholder.test(n))) { note('Type your name on the menu to count your wins worldwide.'); return show(); }
    AB.setName(n);
    return AB.submit(o.game, 'wins', n, 1, {}).then(function (res) {
      note(res.ok ? '🌍 +1 world win!' : res.queued ? '📡 Offline — your win will count next visit.' : res.error);
      return show();
    });
  }

  window.ArcadeBoard = {
    submit: submit,
    top: top,
    render: render,
    winBoard: winBoard,
    format: fmt,
    clientId: clientId,
    name: function () { return cleanName(lsGet(LS_NAME, '')); },
    setName: function (n) { n = cleanName(n); if (n && !isDefaultName(n)) lsSet(LS_NAME, n); return n; },
    friendlyName: friendlyName,
    isDefaultName: isDefaultName,
    record: record,
    bests: bests
  };

  if (document.readyState === 'complete') setTimeout(flushQueue, 1500);
  else window.addEventListener('load', function () { setTimeout(flushQueue, 1500); });
})();
