// Opens every page and fails on any uncaught script error.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { root, serve, offlineContext, openPage, sleep } from './harness.mjs';

const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const site = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const page of pages) {
  const errors = [];
  const ctx = await offlineContext(browser);
  try {
    await openPage(ctx, site.url(page), errors, page);
    await sleep(1500);
  } catch (e) { errors.push(`${page}: ${e.message.split('\n')[0]}`); }
  await ctx.close();
  if (errors.length) bad++;
  console.log((errors.length ? '✗ ' : '✓ ') + page + (errors.length ? '\n    ' + errors.join('\n    ') : ''));
}
await browser.close(); site.close();
process.exit(bad ? 1 : 0);
