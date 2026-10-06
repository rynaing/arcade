// Every page must load a shared script with the same ?v=, and a shared script changed on this
// branch must get a new ?v= (otherwise browsers keep the cached copy). Usage: node tests/check-versions.mjs [baseRef]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

process.chdir(new URL('..', import.meta.url).pathname);

const base = process.argv[2];
const ref = /(?:src|href)="([\w./-]+)\?v=([^"]+)"/g;
const pages = readdirSync('.').filter(f => f.endsWith('.html'));
const seen = {};   // file -> { v -> [pages] }
let bad = 0;
const fail = msg => { console.log('✗ ' + msg); bad++; };

for (const page of pages) {
  for (const [, file, v] of readFileSync(page, 'utf8').matchAll(ref)) {
    if (!existsSync(file)) fail(`${page} loads ${file}, which doesn't exist`);
    ((seen[file] ??= {})[v] ??= []).push(page);
  }
}
for (const [file, byV] of Object.entries(seen)) {
  const vs = Object.keys(byV);
  if (vs.length > 1) fail(`${file} is loaded with different ?v= values: ` + vs.map(v => `v=${v} in ${byV[v].join(', ')}`).join('; '));
}

if (base) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });
  const changed = new Set(git('diff', '--name-only', `${base}...HEAD`).split('\n'));
  for (const [file, byV] of Object.entries(seen)) {
    if (!changed.has(file)) continue;
    const page = Object.values(byV)[0][0];
    let old = '';
    try { old = git('show', `${base}:${page}`); } catch { continue; }   // page is new on this branch
    const oldV = [...old.matchAll(ref)].find(m => m[1] === file)?.[2];
    if (oldV && Object.keys(byV).includes(oldV)) fail(`${file} changed but its ?v= is still ${oldV}: bump it in every page`);
  }
}
console.log(bad ? `${bad} problem(s)` : `✓ ${Object.keys(seen).length} shared files, versions consistent`);
process.exit(bad ? 1 : 0);
