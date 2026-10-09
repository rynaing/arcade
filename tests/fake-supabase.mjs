// Stand-in for @supabase/supabase-js realtime: rooms are BroadcastChannels shared by pages of one browser context.
class FakeChannel {
  constructor(name, opts) {
    this.key = (opts && opts.config && opts.config.presence && opts.config.presence.key) || String(Math.random());
    this.h = []; this.state = {};
    this.bc = new BroadcastChannel('fake:' + name);
    this.bc.onmessage = e => this._in(e.data);
  }
  on(type, filter, cb) { this.h.push({ type, event: filter.event, cb }); return this; }
  subscribe(cb) { setTimeout(() => { cb && cb('SUBSCRIBED'); this.bc.postMessage({ k: 'hello', from: this.key }); }, 10); return this; }
  presenceState() { const o = {}; for (const k in this.state) o[k] = [this.state[k]]; return o; }
  async track(p) {
    this.bc.postMessage({ k: 'track', from: this.key, p });
    this._track(this.key, p); return 'ok';
  }
  // like Supabase: a re-track is a join plus a leave for the same key; currentPresences says what the key holds
  _track(key, p) {
    const old = this.state[key]; this.state[key] = p;
    this._emit('presence', 'join', { key, currentPresences: old ? [old] : [], newPresences: [p] });
    if (old) this._emit('presence', 'leave', { key, currentPresences: [p], leftPresences: [old] });
    this._emit('presence', 'sync', {});
  }
  send(m) { this.bc.postMessage({ k: 'bc', event: m.event, payload: m.payload }); return Promise.resolve('ok'); }
  async unsubscribe() { this.bc.postMessage({ k: 'untrack', from: this.key }); this.bc.close(); return 'ok'; }
  _in(d) {
    if (d.k === 'bc') this._emit('broadcast', d.event, { payload: d.payload });
    else if (d.k === 'hello') { if (this.state[this.key]) this.bc.postMessage({ k: 'track', from: this.key, p: this.state[this.key] }); }
    else if (d.k === 'track') this._track(d.from, d.p);
    else if (d.k === 'untrack') { const p = this.state[d.from]; delete this.state[d.from]; if (p) this._emit('presence', 'leave', { key: d.from, currentPresences: [], leftPresences: [p] }); this._emit('presence', 'sync', {}); }
  }
  _emit(t, e, arg) { for (const h of this.h) if (h.type === t && h.event === e) h.cb(arg); }
}

// Stand-in for supabase auth + the arcade_profiles / arcade_saves tables (accounts.mjs). The "server" is
// /__fakedb on the test server (harness.mjs), so two browser contexts act like two devices on one account.
// Sign-in: any email, code 123456. Names containing "badword" are rejected like arcade_name_ok would.
const AUTH_KEY = 'sb-ukrxoqsvyvlyeblubjeo-auth-token';
function fakeAuth() {
  const subs = [];
  const get = () => { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } };
  const emit = (ev, s) => subs.forEach(cb => setTimeout(() => cb(ev, s), 0));
  return {
    getSession: async () => ({ data: { session: get() }, error: null }),
    onAuthStateChange(cb) { subs.push(cb); setTimeout(() => cb('INITIAL_SESSION', get()), 0); return { data: { subscription: { unsubscribe() {} } } }; },
    signInWithOtp: async () => ({ data: {}, error: null }),
    signInWithOAuth: async () => ({ data: {}, error: null }),
    async verifyOtp({ email, token }) {
      if (token !== '123456') return { data: {}, error: { message: 'Token has expired or is invalid' } };
      const id = 'u-' + [...email].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16);
      const s = { access_token: 'fake', user: { id, email } };
      localStorage.setItem(AUTH_KEY, JSON.stringify(s)); emit('SIGNED_IN', s);
      return { data: { session: s, user: s.user }, error: null };
    },
    async signOut() { localStorage.removeItem(AUTH_KEY); emit('SIGNED_OUT', null); return { error: null }; },
    _uid: () => (get() || { user: {} }).user.id,
  };
}
class FakeQuery {
  constructor(auth, table) { this.q = { table, uid: auth._uid(), filters: {} }; }
  select() { if (!this.q.op) this.q.op = 'select'; return this; }
  insert(row) { this.q.op = 'insert'; this.q.row = row; return this; }
  update(row) { this.q.op = 'update'; this.q.row = row; return this; }
  upsert(row) { this.q.op = 'upsert'; this.q.row = row; return this; }
  eq(k, v) { this.q.filters[k] = v; return this; }
  single() { this.q.one = 'single'; return this; }
  maybeSingle() { this.q.one = 'maybe'; return this; }
  then(ok, bad) { return fakeDb(this.q).then(ok, bad); }
}
async function fakeDb(q) {
  const r = await fetch('/__fakedb', { method: 'POST', body: JSON.stringify(q) });
  return r.json();
}
export function createClient() {
  const auth = fakeAuth();
  return {
    channel: (name, opts) => new FakeChannel(name, opts),
    auth,
    from: table => new FakeQuery(auth, table),
    rpc: fn => fakeDb({ op: 'rpc', fn, uid: auth._uid() }),
  };
}
