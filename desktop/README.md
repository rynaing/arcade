# Large Human Model: desktop (Steam) build

An Electron app that runs `large-human-model.html` from the repo root, so the Steam version and
cakecade.com always play the same game. Nothing here is served or used by the website.

## How it fits together

- `scripts/copy-game.mjs` copies the page and the shared scripts it loads into `app/` (ignored by git).
  It leaves out `arcade-account.js`: cakecade.com accounts need the network.
- `main.js` opens the window and blocks every outside request, so no ads, analytics, leaderboard or
  fonts load. Only links to cakecade.com and the Steam store open, in the player's browser.
  F11 or Alt+Enter toggles fullscreen.
- `preload.js` gives the page `window.lhmDesktop` (`event`, `quit`, `storeUrl`). The game uses it to
  send end-of-run events, add a "Quit to desktop" button, point Share at the store page and skip ad breaks.
- `steam.js` starts Steamworks ([steamworks.js](https://github.com/ceifa/steamworks.js)), turns on the
  overlay and unlocks achievements from those events. Without Steam running it skips itself.

## Run it

```sh
cd desktop
npm install
npm start                 # copies the game in and opens the window
npm test                  # plays a shift in the app and checks the Steam event (Linux, no display: xvfb-run npm test)
npm run dist              # builds an unpacked app in dist/ for this OS
```

To try the Steam hooks before the game has its own app ID, run Steam and use Valve's test app:
`echo 480 > steam_appid.txt` (or `STEAM_APP_ID=480 npm start`). The overlay (Shift+Tab) should appear.
Achievements only unlock once they exist in the game's own Steamworks page.

## Before it goes on Steam

1. Steamworks: pay the $100 app fee, get the app ID, put it in `steam_appid.txt` for local runs and
   `STORE_URL` in `main.js`.
2. Create these achievements (API names must match `steam.js`):

   | API name | Unlocks when |
   |---|---|
   | `LHM_FIRST_SHIFT` | a shift ends without getting replaced |
   | `LHM_EMPLOYEE_OF_MONTH` | a shift ends with a 4.2+ star average |
   | `LHM_REPLACED` | the player gets replaced by an actual AI |
   | `LHM_CONFIDENTLY_WRONG` | 3 made-up answers get past the fact check in one shift |
   | `LHM_CAPTCHA_10` | 10 CAPTCHAs in one run |
   | `LHM_CAPTCHA_25` | 25 CAPTCHAs in one run |

3. Saves (bests) live in Electron's localStorage under the app's user data folder. Steam Auto-Cloud can sync
   that folder with no code: in Steamworks, add a root for `%APPDATA%/Large Human Model/Local Storage`
   (Windows) and the matching `~/Library/Application Support/...` and `~/.config/...` paths.
4. Build on each OS you ship (`npm run dist` on Windows, macOS, Linux), add an app icon in `build/`,
   then upload `dist/` with SteamPipe. macOS builds also need signing and notarizing.
