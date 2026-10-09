/* Ryan Cake Studios Arcade — shared studio chrome.
 *
 * Include on every game page (after arcade-audio.js if the page uses it):
 *   <script src="arcade-ui.js?v=1" data-title="Bubble Brawl" data-home="./index.html" data-layout="flow"></script>
 *
 *  - injects the studio bar: [← Ryan Cake Studios]  [Game title]  [🔊]  — identical in every game
 *  - defines the studio palette (CSS variables --arc-*) and shared component classes:
 *      .arc-title  frosted pink title lettering       .arc-card   cream rounded dialog card
 *      .arc-btn    chunky 3D pill button (+ .alt .mint .sun .ghost)    .arc-chip   white pill label
 *      .arc-input  rounded text field                 .arc-kbd    key cap
 *  - data-layout="flow"    (default) pushes the page down by the bar height
 *    data-layout="overlay" leaves layout alone (full-screen games offset their own UI with var(--arc-bar))
 *  - data-home: where the back link goes (default ./index.html)
 */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[src*="arcade-ui"]');
  var title = (me && me.dataset.title) || '';
  var home = (me && me.dataset.home) || './index.html';
  var layout = (me && me.dataset.layout) || 'flow';
  var barOff = !!(me && me.dataset.bar === 'off');   // the hub itself: shared palette + cast, no back bar

  var CSS = [
    ':root{--arc-bar:32px;--arc-pink:#ff7ba9;--arc-pink-deep:#e0548b;--arc-pink-dark:#b0396a;--arc-lav:#b79df0;--arc-lav-deep:#7d5fd6;',
    '--arc-mint:#8fd6a8;--arc-mint-deep:#3f9f6a;--arc-sun:#ffc46b;--arc-sun-deep:#e8861a;--arc-sky:#9ecdf2;--arc-cream:#fdf8ef;',
    '--arc-ink:#3d3448;--arc-plum:#5b3446;--arc-muted:#8a7f95;--arc-font:"Baloo 2","Trebuchet MS","Segoe UI",system-ui,sans-serif}',
    'html.arc-flow body{padding-top:var(--arc-bar)}',
    /* the bar */
    '#arc-bar{position:fixed;top:0;left:0;right:0;height:var(--arc-bar);z-index:2147483000;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;',
    'padding:0 8px;padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right));',
    'background:linear-gradient(180deg,#4a2250,#3a1a40);border-bottom:3px solid var(--arc-pink);font-family:var(--arc-font);box-shadow:0 3px 12px rgba(40,10,50,.35)}',
    '#arc-bar a.arc-back{justify-self:start;display:inline-flex;align-items:center;gap:6px;color:#ffe3ef;text-decoration:none;font-weight:800;font-size:13px;',
    'padding:3px 11px 3px 8px;border-radius:999px;white-space:nowrap;min-height:26px}',
    '#arc-bar a.arc-back:hover,#arc-bar a.arc-back:focus-visible{background:rgba(255,123,169,.28);outline:none}',
    '#arc-bar a.arc-back svg{flex:none}',
    '#arc-bar .arc-name{font-weight:800;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffb3cf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw}',
    '#arc-bar .arc-right{justify-self:end;display:flex;align-items:center;gap:6px;min-width:0}',
    '#arc-bar button.arc-snd{flex:none;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:14px;line-height:1;width:28px;height:26px;border-radius:999px;cursor:pointer}',
    '#arc-bar button.arc-snd:hover,#arc-bar button.arc-snd:focus-visible{background:rgba(255,123,169,.35);outline:none}',
    '@media (max-width:480px){#arc-bar .arc-name{display:none}#arc-bar{grid-template-columns:1fr auto}}',
    /* shared components */
    '.arc-title{font-family:var(--arc-font);font-weight:900;letter-spacing:.05em;color:#fff6e8;-webkit-text-stroke:2px #8a4a6a;paint-order:stroke fill;',
    'text-shadow:0 3px 0 #ff8fb8,0 6px 0 #b0567e,0 10px 18px rgba(60,20,60,.45);text-transform:uppercase;line-height:1.05}',
    '.arc-card{background:linear-gradient(180deg,#fffdf8,#fff1f7);color:var(--arc-ink);border:3px solid #fff;border-radius:22px;box-shadow:0 6px 0 rgba(120,60,110,.30),0 14px 30px rgba(40,10,40,.30);',
    'font-family:var(--arc-font)}',
    '.arc-btn{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--arc-font);font-weight:900;font-size:17px;',
    'color:#fff;padding:11px 28px;border-radius:999px;background:linear-gradient(180deg,#ff8fb8,var(--arc-pink-deep));box-shadow:0 5px 0 var(--arc-pink-dark),0 8px 16px rgba(60,10,40,.28);',
    'text-shadow:0 1px 0 rgba(0,0,0,.2);transition:transform .08s}',
    '.arc-btn:active{transform:translateY(4px);box-shadow:0 1px 0 var(--arc-pink-dark)}',
    '.arc-btn:focus-visible{outline:3px solid #ffd43b;outline-offset:2px}',
    '.arc-btn.alt{background:linear-gradient(180deg,#c9b6ff,var(--arc-lav-deep));box-shadow:0 5px 0 #53399e,0 8px 16px rgba(30,10,70,.28)}',
    '.arc-btn.alt:active{box-shadow:0 1px 0 #53399e}',
    '.arc-btn.mint{background:linear-gradient(180deg,#a8e8bf,var(--arc-mint-deep));box-shadow:0 5px 0 #2a6e48,0 8px 16px rgba(10,50,30,.28)}',
    '.arc-btn.mint:active{box-shadow:0 1px 0 #2a6e48}',
    '.arc-btn.sun{background:linear-gradient(180deg,#ffd98f,var(--arc-sun-deep));box-shadow:0 5px 0 #a35a0a,0 8px 16px rgba(70,30,0,.28)}',
    '.arc-btn.sun:active{box-shadow:0 1px 0 #a35a0a}',
    '.arc-btn.ghost{background:rgba(255,255,255,.75);color:var(--arc-plum);text-shadow:none;box-shadow:0 4px 0 rgba(120,60,110,.30)}',
    '.arc-btn.small{font-size:14px;padding:7px 18px}',
    '.arc-btn:disabled{opacity:.5;cursor:default}',
    '.arc-chip{display:inline-flex;align-items:center;gap:6px;background:#fff;color:var(--arc-plum);border:2px solid #ffd1e2;border-radius:999px;padding:4px 12px;font-family:var(--arc-font);font-weight:800;font-size:13px}',
    '.arc-input{box-sizing:border-box;font:inherit;font-family:var(--arc-font);font-weight:800;color:var(--arc-ink);background:#fff;border:3px solid #ffd1e2;border-radius:999px;padding:9px 16px;text-align:center;outline:none}',
    '.arc-input:focus{border-color:var(--arc-pink)}',
    '.arc-cast{display:flex;align-items:flex-end;justify-content:center;gap:2px;flex-wrap:nowrap;overflow:hidden}',
    '.arc-cast canvas{flex:none;display:block;background:transparent!important;box-shadow:none!important;border-radius:0!important;border:0!important;max-width:none!important}',
    '.arc-presents{font-family:var(--arc-font);font-weight:800;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--arc-pink-deep);margin:0 0 2px}',
    '.arc-kbd{display:inline-block;font-family:var(--arc-font);font-weight:800;font-size:.85em;color:var(--arc-plum);background:#fff;border:2px solid #ffd1e2;border-bottom-width:3px;border-radius:7px;padding:0 7px}',
  ].join('');

  var st = document.createElement('style');
  st.id = 'arc-ui-css'; st.textContent = CSS;
  document.head.appendChild(st);
  if (layout !== 'overlay' && !barOff) document.documentElement.classList.add('arc-flow');

  var MUSH = '<svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8C28 8 12 26 12 44c0 5 4 8 9 8h58c5 0 9-3 9-8C88 26 72 8 50 8z" fill="#ff7ba9"/>' +
    '<circle cx="32" cy="32" r="6" fill="#fff"/><circle cx="56" cy="24" r="4.5" fill="#fff"/><circle cx="70" cy="38" r="5" fill="#fff"/><rect x="40" y="50" width="20" height="32" rx="9" fill="#f7ecd9"/></svg>';

  function build() {
    if (barOff || document.getElementById('arc-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'arc-bar';
    bar.setAttribute('role', 'banner');
    var a = document.createElement('a');
    a.className = 'arc-back'; a.href = home; a.setAttribute('aria-label', 'Back to Ryan Cake Studios Arcade');
    a.innerHTML = '<span aria-hidden="true">←</span>' + MUSH + '<span>Ryan Cake Studios</span>';
    var nm = document.createElement('div'); nm.className = 'arc-name'; nm.textContent = title;
    bar.appendChild(a); bar.appendChild(nm);
    var right = document.createElement('div'); right.className = 'arc-right';   // arcade-account.js adds its button here
    var snd = document.createElement('button'); snd.type = 'button'; snd.className = 'arc-snd'; snd.id = 'arc-snd'; snd.textContent = '🔊';
    right.appendChild(snd); bar.appendChild(right);
    document.body.insertBefore(bar, document.body.firstChild);
    // one shared mute for the whole arcade (arcade-audio.js, which may load after this script): bind once it exists
    var bound = false;
    function bindSnd() {
      if (bound) return;
      if (window.ArcadeAudio && ArcadeAudio.bindButton) { ArcadeAudio.bindButton(snd); snd.style.display = ''; bound = true; }
      else snd.style.display = 'none';
    }
    bindSnd(); window.addEventListener('load', bindSnd); setTimeout(bindSnd, 300);
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);

  /* any element with data-arc-cast="id,id,..." (and optional data-size) becomes an animated row of studio characters */
  function castInit() {
    if (!window.ArcadeArt) return false;
    [].forEach.call(document.querySelectorAll('[data-arc-cast]'), function (el) {
      if (el._arcCast) return; el._arcCast = true;
      ArcadeArt.cast(el, el.getAttribute('data-arc-cast').split(','), { size: +el.getAttribute('data-size') || 72 });
    });
    return true;
  }
  function castSoon() { if (!castInit()) { window.addEventListener('load', castInit); setTimeout(castInit, 400); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', castSoon); else castSoon();

  /* ---------------- money: analytics + ad breaks ----------------
   * Everything here is off until a key below is filled in, so the site behaves exactly as before.
   *  - CF_ANALYTICS_TOKEN: Cloudflare Web Analytics token (cookie-free page views, no banner needed)
   *  - ADSENSE_CLIENT: 'ca-pub-…' once AdSense approves the domain (H5 Games Ads / adBreak API)
   *  - NON_PERSONALIZED: keep true while the arcade is pitched at kids (Google's child-safe ad mode)
   * Games call ArcadeUI.adBreak('name') at natural breaks (results screens, solo play only). On a
   * game portal its SDK wins: CrazyGames (CrazyGames.SDK) or Poki (PokiSDK), if loaded on the page.
   * Add ?adtest=1 to a page URL to see AdSense test ads.
   */
  var CF_ANALYTICS_TOKEN = '89d2ba8dbecd428bac5bca26479cf03d';
  var ADSENSE_CLIENT = 'ca-pub-5048455596508415';
  var NON_PERSONALIZED = true;
  var AD_GAP_MS = 120000;   // at most one ad break every 2 minutes
  var lastAd = 0;

  function addScript(src, attrs) {
    var s = document.createElement('script'); s.async = true; s.src = src;
    for (var k in attrs) s.setAttribute(k, attrs[k]);
    document.head.appendChild(s);
  }
  if (CF_ANALYTICS_TOKEN && /(^|\.)cakecade\.com$/.test(location.hostname))   // live site only, not local testing
    addScript('https://static.cloudflareinsights.com/beacon.min.js', { 'data-cf-beacon': JSON.stringify({ token: CF_ANALYTICS_TOKEN }) });
  if (ADSENSE_CLIENT) {
    var test = /[?&]adtest=1\b/.test(location.search);
    // pages also carry Google's tag in <head> (so AdSense can verify the site); load it here only if missing
    var tag = document.querySelector('script[src*="adsbygoogle.js"]');
    if (tag && test) tag.setAttribute('data-adbreak-test', 'on');
    if (!tag) addScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT,
      test ? { crossorigin: 'anonymous', 'data-adbreak-test': 'on' } : { crossorigin: 'anonymous' });
    window.adsbygoogle = window.adsbygoogle || [];
    if (NON_PERSONALIZED) window.adsbygoogle.requestNonPersonalizedAds = 1;
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
  }

  // silence the shared sound engine while an ad plays, without touching the player's mute setting
  function hold(on) { if (window.ArcadeAudio && ArcadeAudio.hold) ArcadeAudio.hold(on); }
  /* resolves true if an ad was shown; never rejects, so callers can ignore it */
  function adBreak(name) {
    return new Promise(function (resolve) {
      if (Date.now() - lastAd < AD_GAP_MS) return resolve(false);
      var settled = false;
      function done(shown) { if (settled) return; settled = true; hold(false); if (shown) lastAd = Date.now(); resolve(!!shown); }
      try {
        var cg = window.CrazyGames && window.CrazyGames.SDK;
        if (cg && cg.ad) {
          cg.ad.requestAd('midgame', { adStarted: function () { hold(true); }, adFinished: function () { done(true); }, adError: function () { done(false); } });
        } else if (window.PokiSDK) {
          hold(true); window.PokiSDK.commercialBreak().then(function () { done(true); }, function () { done(false); });
        } else if (ADSENSE_CLIENT) {
          var started = false;
          window.adBreak({ type: 'next', name: name || 'break', beforeAd: function () { started = true; hold(true); },
            adBreakDone: function (info) { done(info && info.breakStatus === 'viewed'); } });
          // ad blockers stop Google's script from ever answering: give up quietly if no ad starts
          setTimeout(function () { if (!started) done(false); }, 4000);
        } else done(false);
      } catch (e) { done(false); }
    });
  }

  window.ArcadeUI = { cast: castInit, adBreak: adBreak, barHeight: function () { return (document.getElementById('arc-bar') || {}).offsetHeight || 32; } };
})();
