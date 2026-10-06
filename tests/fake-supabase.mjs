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
    const fresh = !this.state[this.key]; this.state[this.key] = p;
    this.bc.postMessage({ k: 'track', from: this.key, p });
    if (fresh) this._emit('presence', 'join', { newPresences: [p] });
    this._emit('presence', 'sync', {}); return 'ok';
  }
  send(m) { this.bc.postMessage({ k: 'bc', event: m.event, payload: m.payload }); return Promise.resolve('ok'); }
  async unsubscribe() { this.bc.postMessage({ k: 'untrack', from: this.key }); this.bc.close(); return 'ok'; }
  _in(d) {
    if (d.k === 'bc') this._emit('broadcast', d.event, { payload: d.payload });
    else if (d.k === 'hello') { if (this.state[this.key]) this.bc.postMessage({ k: 'track', from: this.key, p: this.state[this.key] }); }
    else if (d.k === 'track') { const fresh = !this.state[d.from]; this.state[d.from] = d.p; if (fresh) this._emit('presence', 'join', { newPresences: [d.p] }); this._emit('presence', 'sync', {}); }
    else if (d.k === 'untrack') { const p = this.state[d.from]; delete this.state[d.from]; if (p) this._emit('presence', 'leave', { leftPresences: [p] }); this._emit('presence', 'sync', {}); }
  }
  _emit(t, e, arg) { for (const h of this.h) if (h.type === t && h.event === e) h.cb(arg); }
}
export function createClient() { return { channel: (name, opts) => new FakeChannel(name, opts) }; }
