// Serves the site from the repo root and opens pages offline: ads, fonts and CDNs are blocked,
// and supabase-js is swapped for fake-supabase.mjs (rooms are BroadcastChannels inside one browser).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
const FAKE = fs.readFileSync(path.join(here, 'fake-supabase.mjs'), 'utf8');
const FAKE_UMD = FAKE.replace('export function createClient', 'window.supabase = { createClient }; function createClient');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };

export async function serve() {
  const server = http.createServer((q, r) => {
    if (q.url === '/__fakedb') { let b = ''; q.on('data', c => b += c); q.on('end', () => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(fakeDb(JSON.parse(b)))); }); return; }
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: p => `http://127.0.0.1:${server.address().port}/${p}`, close: () => server.close() };
}

// the "server" side of fake-supabase.mjs's tables: rows live here, so separate browser contexts share them
export const db = { arcade_profiles: {}, arcade_saves: {}, clock: Date.parse('2026-01-01T00:00:00Z') };
function fakeDb(q) {
  const err = message => ({ data: null, error: { message } });
  if (!q.uid) return err('not signed in');
  if (q.op === 'rpc') { if (q.fn !== 'arcade_delete_me') return err('no such function'); delete db.arcade_profiles[q.uid]; for (const k in db.arcade_saves) if (k.startsWith(q.uid + '|')) delete db.arcade_saves[k]; return { data: null, error: null }; }
  const t = db[q.table]; if (!t) return err('no such table');
  const key = q.table === 'arcade_saves' ? q.uid + '|' + (q.row ? q.row.game : q.filters.game) : q.uid;
  const out = row => {
    if (q.one === 'single' && !row) return err('no rows');
    return { data: row ? { ...row } : null, error: null };
  };
  if (q.op === 'select') return out(t[key] || null);
  if (q.row && q.row.user_id !== undefined && q.row.user_id !== q.uid) return err('row-level security');
  const now = new Date(db.clock += 1000).toISOString();
  if (q.table === 'arcade_profiles' && q.row && 'name' in q.row) {
    if (/badword/i.test(q.row.name)) return err('name not allowed');
  }
  if (q.op === 'insert') { if (t[key]) return err('duplicate key'); t[key] = { user_id: q.uid, name: '', ...q.row, updated_at: now }; return out(t[key]); }
  if (q.op === 'update') { if (!t[key]) return out(null); Object.assign(t[key], q.row, { updated_at: now }); return out(t[key]); }
  if (q.op === 'upsert') { t[key] = { ...(t[key] || {}), ...q.row, user_id: q.uid, updated_at: now }; return out(t[key]); }
  return err('bad op');
}

export async function offlineContext(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  // no outside network: never post to the world leaderboard (submit_score), never load real ads
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  // registered last, so it wins over the block above
  await ctx.route(/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' },
    body: /umd/.test(r.request().url()) ? FAKE_UMD : FAKE }));
  return ctx;
}

export async function openPage(ctx, url, errors, label) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${label}: ${e.message}`));
  p.on('dialog', d => d.dismiss());
  await p.goto(url);
  return p;
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
