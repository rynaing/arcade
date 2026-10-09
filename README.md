# Ryan Cake Studios Arcade

A free hub of party and solo games for all ages — no sign-up, just pick a game and play.

Live at https://cakecade.com/ · Free forever · Kid-friendly

## Games

**Hosted here** (one self-contained HTML file each)

| Game | Modes | What it is |
|---|---|---|
| **Crumb Bound** (`crumb-bound.html`) | Solo vs bots · online 1v1 / 2v2 | GunBound-style pastry artillery: scrolling map, delay turn order, weather, slopes tilt your cannon, Random pick with a secret legendary |
| **Bubble Brawl** (`bubble-brawl.html`) | Solo vs bots · online | Balloono-style arena: splashes trap you in a bubble, rivals pop you by touch |
| **Hamster Roll** (`hamster-roll.html`) | Solo · online race | Ball Racer-style 2D hamster-ball racing across 4 tracks |
| **Frosted Duel** (`frosted-duel.html`) | Solo vs bot | 3D third-person arena duel (three.js, vendored in `vendor/`): sprinkle blaster, sword slash and lunge, block and parry, dash, wall-run |
| **Ryan's Cake TD** (`ryans-cake-td.html`) | Solo | Tower defense: survive 10 waves, then endless |

**Game Night** (party games for the big screen, hosted in the [game-night](https://github.com/rynaing/game-night) repo):
Trivia. (Most Likely To, Math Sprint, Guesstimate, Anagrams and Common Threads are archived: their cards are commented out in index.html.)
Each has its own card here and opens straight into that game (`game-night/?game=<key>`); the hub's
**Game Night** filter lists them and the "Got a room code?" box joins a room.

## Global leaderboards

`leaderboard.js` (shared client) talks to two Postgres functions in Supabase — see
[`supabase/leaderboard.sql`](supabase/leaderboard.sql). Scores are validated server-side
(ranges, name filter, rate limits); the public key can't read or edit the table directly.
Bump the `?v=` on `<script src="leaderboard.js?v=…">` in every page when the client changes.

## Accounts (optional)

`arcade-account.js` (on every page, right after `arcade-ui.js`) adds a Sign in button to the studio bar and
the hub's top nav. Sign-in is Supabase Auth: an emailed link or 6-digit code, plus Google when it's turned
on in Supabase. Signed in, the account is the one source of truth: its name (`arcade_profiles`) is written
into every game's name key on load, and each game's save keys (the `SAVES` list in `arcade-account.js`) are
mirrored to `arcade_saves`. A newer cloud save is written to localStorage and the page reloads once, so
games need no account code. Guests never load Supabase for this. Tables and rules: [`supabase/accounts.sql`](supabase/accounts.sql).
New game with saved progress? Add its keys to `SAVES` and its id to the `arcade_saves_game` check.

## Online play

Crumb Bound, Bubble Brawl and Hamster Roll use Supabase Realtime channels (no tables) through the
shared `arcade-net.js`: it loads the client, joins/leaves rooms, keeps the roster, and checks every
presence and chat message from other players (each game adds checks for its own message fields).
Each game's room prefix carries a version (e.g. `cb-v5:`); bump it whenever the match
simulation or messages change so old cached copies can't join new rooms.

The Supabase client is a pinned copy in `vendor/supabase-js-<version>.umd.js` (from the npm
package's `dist/umd/supabase.js`), so a new supabase-js release never reaches players untested.
To upgrade: `npm pack @supabase/supabase-js@<new>`, copy `dist/umd/supabase.js` over, update the
path in `arcade-net.js` (and bump its `?v=`), and play one online match before merging.

## Archived games

Removed but recoverable from git tags: `archive/berrybrook-swordplay`, `archive/word-crumb`.

## Checks

`tests/` runs on every PR (`.github/workflows/checks.yml`): shared-script `?v=` values must
match across pages and change when the script does, every page must load without script errors,
and each online game must start a match while a fake player sends bad data. Run them locally with
`cd tests && npm ci && npx playwright install chromium && node check-versions.mjs && node smoke.mjs && node online.mjs && node accounts.mjs`.
