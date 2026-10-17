// Copies the live web game (repo root) into desktop/app/, so the Steam build always runs the same code as cakecade.com.
// The page detects the desktop build through window.lhmDesktop (set in preload.js). The one edit made here: no
// accounts script, since cakecade.com accounts need the network and Steam has its own (saves stay local, see README).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desk = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(desk, '..');
const out = join(desk, 'app');
const PAGE = 'large-human-model.html';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const html = readFileSync(join(root, PAGE), 'utf8').replace(/<script[^>]+src="arcade-account\.js[^"]*"[^>]*><\/script>\n?/, '');
writeFileSync(join(out, PAGE), html);
// every local script the page loads (arcade-ui.js?v=5 and friends)
const scripts = [...html.matchAll(/<script[^>]+src="([^":?]+\.js)(?:\?[^"]*)?"/g)].map(m => m[1]);
for (const s of scripts) {
  if (!existsSync(join(root, s))) throw new Error(`${PAGE} loads ${s}, which doesn't exist`);
  cpSync(join(root, s), join(out, s));
}
console.log(`copied ${PAGE} + ${scripts.join(', ')} into desktop/app/`);
