# CLAUDE.md

Rules and decisions for anyone (human or Claude) changing this repo. Read this before editing.
See README.md for how the games, leaderboards and online play work.

## The site

- Live at https://cakecade.com (GitHub Pages from `main`, custom domain via `CNAME`).
  Every merge to `main` goes live, so test before merging.
- Static site: one self-contained HTML file per game, shared code in `arcade-ui.js`,
  `arcade-art.js`, `arcade-audio.js`, `arcade-net.js` and `leaderboard.js`. No build step,
  no game framework: shared behaviour goes into these files instead of being copied per game.
- Online play (Crumb Bound, Bubble Brawl, Hamster Roll) goes through `arcade-net.js`: Supabase
  loading, rooms, roster, and checks on everything other players send. Never trust a channel
  message: clip strings, require finite numbers, accept only known keys.
- Supabase presence reports a player re-tracking (ready, team, mobile) as a join plus a leave for the
  same key. `arcade-net.js` only passes on real arrivals and departures, and `tests/fake-supabase.mjs`
  behaves the same way, so keep both in step if presence handling changes.
- A guest can receive the host's start before its own join has finished; joining must not cover a
  running match with the lobby.
- supabase-js is a pinned copy in `vendor/` (same for game-night). Bump it deliberately, never
  load a floating version from a CDN; upgrade steps are in README.

## More than one Claude works on this repo

Ryan runs more than one Claude project against this repo. Decisions made in one are not
visible to the other except through this file and git history.

- Always start from the latest `main` (`git fetch origin main`) and branch from it.
- Don't add commits to a branch whose PR already merged; start a new branch.
- If you make a lasting decision about the arcade, add it here in the same PR.

## Ads (Google AdSense, under review)

- The site is in AdSense review. Reviewers reject sites with thin content, so keep the
  About page, How to play page, the home intro and footer links.
- When trimming in-game text, keep the full rules on `how-to-play.html`. Trim the home
  intro rather than delete it.
- Never click our own ads. To test ads, add `?adtest=1` to the page URL.
- Between-round ad breaks (`ArcadeUI.adBreak(...)`, solo play only) use H5 Games Ads, a
  separate beta. Until it's approved those slots show nothing, which is expected.
- Ads are configured to be non-personalized (kid-friendly site). Don't change that.
- Ad settings, ad placement and anything privacy-related are Ryan's call: open a PR and
  leave it for him rather than merging.

## Analytics

Cloudflare Web Analytics is already installed (loaded in `arcade-ui.js`). Don't add another
analytics script or re-run Cloudflare's setup.

## Leaderboard

- Test runs must never post to the world leaderboard. When playtesting (by hand or with
  Playwright), block or stub `submit_score` requests to Supabase, or wrap
  `window.ArcadeBoard.submit` so it never sends. Test scores have leaked before.
- Database changes (tables, functions) go to Ryan as SQL he runs himself. Deleting rows (test scores,
  test data) is allowed: see Deletes below.
  Keep the source of truth in `supabase/*.sql`.
- Bump the `?v=` on `leaderboard.js` script tags in every page when the client changes.
- Players who haven't typed a name get a fun default like "Sunny Otter" (`ArcadeBoard.friendlyName()`,
  shared by every game). Defaults never post to the world boards (`ArcadeBoard.isDefaultName()`);
  a player has to type their own name for that. Keep new games on these helpers.

## Game decisions

- Crumb Bound: teams always alternate turns (within a team, whoever acted longest ago goes
  first). Weapons: Shell is always ready, Twin rests 1 turn after use, the special charges to
  full in about 3 turns.
- Crumb Bound: every player gets one free Teleport and one Band-Aid (a one-time welcome gift).
- Crumb Bound match logs upload to Supabase `cb_match_logs` through `log_cb_match()` only
  (anon can insert through it, not read). `cb_prune_match_logs()` deletes 30+ day rows only
  when the database nears 400 MB. See `supabase/cb_match_logs.sql`; Ryan runs the SQL.
- Hamster Roll: every player in a room gets a distinct colour.
- Bubble Brawl online: once every real player is popped and 2+ bots are left, everyone in the room is
  asked whether to end the round (any one player can end it; the bot with the most pops wins).
- Ryan's Cake TD keeps its own synth and music (it shares the arcade mute setting through its
  🔊 button). Moving it onto `arcade-audio.js` would change how it sounds, so ask Ryan first.
- Ryan's Cake TD limitless mode: after wave 30 enemy HP also grows by a per-difficulty factor each
  wave (`late` in `DIFFS`: Chill 1.04, Classic 1.05, Nightmare 1.065), and gold per kill is worked
  out before that factor so income stays linear. Without it, late waves got easy. Retune `late`
  if it feels too soft or too brutal.

## Archived games

- Most Likely To, Math Sprint, Guesstimate, Common Threads, Common Threads Solo and Anagrams
  are archived. Their cards are commented out in `index.html` with an `ARCHIVED` note.
  Anagrams' code is kept in game-night, hidden from its picker and `?game=` links.
- They stay archived unless Ryan says otherwise. The games themselves live in the
  game-night repo.

## Checks

- `tests/` runs on every PR (`.github/workflows/checks.yml`): `?v=` consistency, every page loads
  without script errors, and each online game plays a 2-player room while a fake player sends junk.
  Keep it green; run it locally before merging (see README).
- The checks block all outside network (ads, Supabase, CDNs) and stub Supabase realtime with
  `tests/fake-supabase.mjs`, so they never post to the world leaderboard or load real ads.
  Keep it that way when adding tests.

## Merging

- Game, content and docs changes: open a PR, test it, and squash-merge it yourself once it's
  safe and the Site checks are green.
- Ads, privacy and leaderboard database changes: leave the PR for Ryan.

## Deletes

Claude may delete things (test rows in Supabase, files, branches, archived code) without asking,
but every delete must be noted:
- Say what was deleted and why in the PR description or the thread where it happened.
- Add one line to the log below: date, what was deleted (table and row ids, file paths), why.
  For database rows, keep the SQL used. Never delete real players' data.

Delete log:
- (none yet)

## Style

- Keep on-screen text in the games short. Full rules belong on How to play.
- The site is family-friendly, for all ages.
