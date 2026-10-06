# CLAUDE.md

Rules and decisions for anyone (human or Claude) changing this repo. Read this before editing.
See README.md for how the games, leaderboards and online play work.

## The site

- Live at https://cakecade.com (GitHub Pages from `main`, custom domain via `CNAME`).
  Every merge to `main` goes live, so test before merging.
- Static site: one self-contained HTML file per game, shared code in `arcade-ui.js`,
  `arcade-art.js`, `arcade-audio.js` and `leaderboard.js`. No build step.

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
- Database changes (tables, functions, deleting scores) go to Ryan as SQL he runs himself.
  Keep the source of truth in `supabase/*.sql`.
- Bump the `?v=` on `leaderboard.js` script tags in every page when the client changes.

## Archived games

- Most Likely To, Math Sprint, Guesstimate, Common Threads, Common Threads Solo and Anagrams
  are archived. Their cards are commented out in `index.html` with an `ARCHIVED` note.
- They stay archived unless Ryan says otherwise. The games themselves live in the
  game-night repo.

## Merging

- Game, content and docs changes: open a PR, test it, and merge it yourself once it's safe.
- Ads, privacy, leaderboard database changes and deleting anything: leave the PR for Ryan.

## Style

- Keep on-screen text in the games short. Full rules belong on How to play.
- The site is family-friendly, for all ages.
