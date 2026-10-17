// Large Human Model, desktop (Steam) build. Runs the web game from app/ (see scripts/copy-game.mjs) fully offline:
// no ads, analytics, leaderboard or accounts, since every outside request is blocked.
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const steam = require('./steam');

const STORE_URL = 'https://store.steampowered.com/';   // TODO: the game's store page once Steam gives it an app ID
// links the player may open in their browser (How to play, the store page); everything else stays blocked
const EXTERNAL_OK = /^https:\/\/(cakecade\.com|store\.steampowered\.com)\//;

steam.init();   // before the window: the overlay needs its GPU switches set early

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    title: 'Large Human Model', backgroundColor: '#1d1830', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  // the arcade bar's back link goes to the cakecade.com hub, which isn't part of this build
  win.webContents.on('did-finish-load', () => win.webContents.insertCSS('#arc-bar a.arc-back{visibility:hidden}'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (EXTERNAL_OK.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    e.preventDefault();
    if (EXTERNAL_OK.test(url)) shell.openExternal(url);
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.key === 'Enter' && input.alt))) {
      win.setFullScreen(!win.isFullScreen()); e.preventDefault();
    }
  });
  win.loadFile(path.join(__dirname, 'app', 'large-human-model.html'));
}

app.whenReady().then(() => {
  // offline only: ads, analytics, Supabase, fonts and CDNs never load in the desktop build
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => cb({ cancel: true }));
  ipcMain.on('lhm-event', (e, name, data) => steam.onEvent(String(name).slice(0, 40), data));
  ipcMain.on('lhm-quit', () => app.quit());
  ipcMain.on('lhm-store-url', e => { e.returnValue = STORE_URL; });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
