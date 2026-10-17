// Steam hooks. Everything here is optional: without Steam running (or without steamworks.js) the game just plays.
// App ID comes from steam_appid.txt next to the executable, or STEAM_APP_ID; 480 is Valve's public test app (Spacewar).
const fs = require('fs');
const path = require('path');

// achievement API names, to be created with the same names in Steamworks (App Admin > Stats & Achievements)
const ACH = {
  firstShift: 'LHM_FIRST_SHIFT',        // finish a shift without getting replaced
  employee: 'LHM_EMPLOYEE_OF_MONTH',    // finish a shift with a 4.2+ star average
  replaced: 'LHM_REPLACED',             // get replaced by an actual AI
  confident: 'LHM_CONFIDENTLY_WRONG',   // make it up 3 times in one shift without getting fact-checked
  captcha10: 'LHM_CAPTCHA_10',          // 10 CAPTCHAs in one run
  captcha25: 'LHM_CAPTCHA_25',          // 25 CAPTCHAs in one run
};

function appId() {
  if (process.env.STEAM_APP_ID) return +process.env.STEAM_APP_ID;
  for (const dir of [path.dirname(process.execPath), process.cwd()]) {
    try { return +fs.readFileSync(path.join(dir, 'steam_appid.txt'), 'utf8').trim(); } catch (e) {}
  }
  return undefined;
}

let client = null;
function init() {
  const id = appId();
  if (!id) { console.log('[steam] no app id, running without Steam'); return null; }
  try {
    const sw = require('steamworks.js');
    client = sw.init(id);
    sw.electronEnableSteamOverlay();
    console.log('[steam] ready as', client.localplayer.getName());
  } catch (e) {
    console.log('[steam] not available, running without Steam:', e.message);
    client = null;
  }
  return client;
}

function unlock(key) {
  if (!client) return;
  try { if (!client.achievement.isActivated(ACH[key])) client.achievement.activate(ACH[key]); } catch (e) {}
}

// events come from the page (preload.js), so treat them as untrusted input: finite numbers, known names only
function onEvent(name, data) {
  data = data && typeof data === 'object' ? data : {};
  const num = v => (Number.isFinite(+v) ? +v : 0);
  if (name === 'shift-end') {
    if (data.fired === true) unlock('replaced');
    else { unlock('firstShift'); if (num(data.avg) >= 4.2) unlock('employee'); }
    if (num(data.fooled) >= 3) unlock('confident');
  } else if (name === 'captcha-end') {
    if (num(data.solved) >= 10) unlock('captcha10');
    if (num(data.solved) >= 25) unlock('captcha25');
  }
}

module.exports = { init, onEvent, ACH };
