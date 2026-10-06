/* Ryan Cake Studios Arcade — shared online rooms (Supabase Realtime).
 *
 * Include before the game's own script on pages with online play:
 *   <script src="arcade-net.js?v=1"></script>
 *
 *  - ArcadeNet.client()      → Promise of the Supabase client (pinned copy in vendor/), or null if it can't load.
 *                              Loaded on first use, so menus and solo play never wait on it.
 *  - ArcadeNet.newCode()     → random 4-character room code;  ArcadeNet.validCode(c) checks one.
 *  - ArcadeNet.join(opts)    → joins room opts.prefix + opts.code. Resolves { ok: true, room } or
 *                              { ok: false, error: 'code' | 'offline' | 'timeout' } so each game keeps its own wording.
 *      opts.id               this player's id (the presence key)
 *      opts.clean(p, base)   game-specific presence fields: return the extra fields to keep (base = id, name, joinedAt)
 *      opts.on               { event: fn(payload) } broadcast handlers. 'chat' payloads arrive with name/text cleaned.
 *      opts.onJoin/onLeave   fn(players) with cleaned presences;  opts.onSync fn()
 *  - room.channel            the raw channel (send/track/unsubscribe as before)
 *  - room.players()          cleaned presences, oldest first;  room.hostId() the oldest player's id
 *  - room.send(event, p)     best-effort broadcast;  room.track(p);  room.leave()
 *  - ArcadeNet.str / num / id — the checks every handler uses on data from other players.
 *
 * Everything on a channel comes from another player's browser, so it is never trusted:
 * strings are clipped, numbers must be finite, ids must look like ids.
 */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://ukrxoqsvyvlyeblubjeo.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_hXr3XBpmRYSDiJNiOzt6yw_DttyIY6y';
  var SUPABASE_JS = 'vendor/supabase-js-2.117.2.umd.js';   // pinned; upgrade steps in README
  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function str(v, n) { return (typeof v === 'string' ? v : '').slice(0, n); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function id(v) { return typeof v === 'string' && /^[\w-]{1,32}$/.test(v) ? v : ''; }

  var ready = null;
  function client() {
    if (!ready) ready = new Promise(function (res) {
      var s = document.createElement('script');
      s.src = SUPABASE_JS;
      s.onload = function () { try { res(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)); } catch (e) { res(null); } };
      s.onerror = function () { res(null); };
      document.head.appendChild(s);
    });
    return ready;
  }

  function newCode() { var c = ''; for (var i = 0; i < 4; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]; return c; }
  function validCode(c) { return /^[A-Z2-9]{4}$/.test(c); }

  async function join(o) {
    var code = String(o.code || '').toUpperCase().trim();
    if (!validCode(code)) return { ok: false, error: 'code' };
    var sb = await client();
    if (!sb) return { ok: false, error: 'offline' };
    var ch = sb.channel(o.prefix + code, { config: { presence: { key: o.id }, broadcast: { ack: false } } });

    function clean(p) {
      if (!p || !id(p.id)) return null;
      var base = { id: p.id, name: str(p.name, 14) || 'Player', joinedAt: num(p.joinedAt, Date.now()) };
      return Object.assign(base, o.clean ? o.clean(p, base) : null);
    }
    function cleanAll(list) { return (list || []).map(clean).filter(Boolean); }
    function players() {
      var out = [], st = ch.presenceState();
      for (var k in st) out = out.concat(cleanAll(st[k]));
      return out.sort(function (a, b) { return a.joinedAt - b.joinedAt; });
    }

    if (o.onSync) ch.on('presence', { event: 'sync' }, function () { o.onSync(); });
    if (o.onJoin) ch.on('presence', { event: 'join' }, function (e) { o.onJoin(cleanAll(e.newPresences)); });
    if (o.onLeave) ch.on('presence', { event: 'leave' }, function (e) { o.onLeave(cleanAll(e.leftPresences)); });
    Object.keys(o.on || {}).forEach(function (ev) {
      ch.on('broadcast', { event: ev }, function (m) {
        var p = m && m.payload;
        if (!p || typeof p !== 'object') return;
        if (ev === 'chat') {
          p = Object.assign({}, p, { name: str(p.name, 14) || 'Player', text: str(p.text, 120) });
          if (!p.text) return;
        }
        o.on[ev](p);
      });
    });

    var ok = await new Promise(function (res) {
      var done = false;
      var to = setTimeout(function () { if (!done) { done = true; res(false); } }, 10000);
      ch.subscribe(function (s) {
        if (done) return;
        if (s === 'SUBSCRIBED') { done = true; clearTimeout(to); res(true); }
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { done = true; clearTimeout(to); res(false); }
      });
    });
    if (!ok) { try { ch.unsubscribe(); } catch (e) {} return { ok: false, error: 'timeout' }; }

    var room = {
      code: code,
      channel: ch,
      players: players,
      hostId: function () { var ps = players(); return ps.length ? ps[0].id : null; },
      send: function (event, payload) { try { ch.send({ type: 'broadcast', event: event, payload: payload }); } catch (e) {} },
      track: function (p) { return ch.track(p).catch(function () {}); },
      leave: function () { return Promise.resolve().then(function () { return ch.unsubscribe(); }).catch(function () {}); },
    };
    return { ok: true, room: room };
  }

  window.ArcadeNet = { client: client, join: join, newCode: newCode, validCode: validCode, str: str, num: num, id: id };
})();
