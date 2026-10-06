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

## Online play

Crumb Bound, Bubble Brawl and Hamster Roll use Supabase Realtime channels (no tables).
Each game's room prefix carries a version (e.g. `cb-v5:`); bump it whenever the match
simulation or messages change so old cached copies can't join new rooms.

## Archived games

Removed but recoverable from git tags: `archive/berrybrook-swordplay`, `archive/word-crumb`.
