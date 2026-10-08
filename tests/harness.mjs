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
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: p => `http://127.0.0.1:${server.address().port}/${p}`, close: () => server.close() };
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
