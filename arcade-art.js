/* Ryan Cake Studios Arcade — shared cast.
 *
 * The studio's characters, drawn procedurally (no image files), taken straight from the games so every
 * game can show the same faces:   Shortcake / Éclair / Meringue / Fudge (Crumb Bound pastries),
 * the hatted blobs (Bubble Brawl) and the hamster (Hamster Roll).
 *
 *   ArcadeArt.ids                       -> ['shortcake','eclair','meringue','fudge','blob0'..'blob7','hamster']
 *   ArcadeArt.draw(canvas, id, opts)    -> paint one character (opts: t seconds, team 'A'|'B', bot 'baker'|...)
 *   ArcadeArt.cast(el, ids, opts)       -> fill an element with animated (blinking, bobbing) portraits;
 *                                          pauses automatically while the tab is hidden
 */
(function () {
  'use strict';
  var ctx = null;
  /* ---------- shared helpers ---------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  
  function rr(x, y, w, h, r) { roundRect(x, y, w, h, r); }
  function maxHpOf(m) { return m.hpMax || 100; }

  /* ---------- Crumb Bound pastries ---------- */
  var PAST = (function () {
  const INK = '#5b3446';                       // soft outline colour
  const TEAM = { A: ['#4dabf7', '#1c7ed6'], B: ['#ff7aa2', '#e64980'] };
  function outline(w) { ctx.strokeStyle = INK; ctx.lineWidth = w || 2.2; ctx.lineJoin = 'round'; ctx.stroke(); }
  function blob(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.29); }
  // big shiny chibi eyes; blink / worried / KO variants
  function drawFace(cx, cy, m, i) {
    const now = performance.now() / 1000;
    const blink = m.alive && ((now + i * 1.7) % 4.2) < 0.12;
    const low = m.alive && m.hp / maxHpOf(m) < 0.3;
    const ex = 6.5;
    if (!m.alive) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { const x = cx + s * ex; ctx.beginPath(); ctx.moveTo(x - 3, cy - 3); ctx.lineTo(x + 3, cy + 3); ctx.moveTo(x + 3, cy - 3); ctx.lineTo(x - 3, cy + 3); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx, cy + 9, 3, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      return;
    }
    for (const s of [-1, 1]) {
      const x = cx + s * ex;
      if (blink) { ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, cy, 3.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); continue; }
      ctx.fillStyle = '#fff'; blob(x, cy, 4.4, 5.2); ctx.fill(); outline(1.4);
      ctx.fillStyle = '#2b1d2e'; blob(x + 1, cy + 0.8, 3, 3.8); ctx.fill();
      ctx.fillStyle = '#fff'; blob(x + 2, cy - 1.2, 1.3, 1.5); ctx.fill(); blob(x - 0.2, cy + 2.4, 0.7, 0.7); ctx.fill();
      if (low) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 4, cy - 7 - s * 1.5); ctx.lineTo(x + 4, cy - 7 + s * 1.5); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,120,150,.55)'; blob(cx - 11, cy + 5, 3.4, 2.2); ctx.fill(); blob(cx + 12, cy + 5, 3.4, 2.2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath();
    if (low) ctx.arc(cx + 1, cy + 11, 2.8, Math.PI * 1.15, Math.PI * 1.85);            // worried
    else { ctx.arc(cx - 1.4, cy + 6, 2.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.moveTo(cx + 3.6, cy + 6.4); ctx.arc(cx + 1.4, cy + 6, 2.2, 0.1 * Math.PI, 0.9 * Math.PI); } // cat smile
    ctx.stroke();
    if (low) { ctx.fillStyle = '#9fd6ff'; ctx.beginPath(); ctx.moveTo(cx + 17, cy - 8); ctx.quadraticCurveTo(cx + 21, cy - 1, cx + 17, cy); ctx.quadraticCurveTo(cx + 13, cy - 1, cx + 17, cy - 8); ctx.fill(); } // sweat drop
  }
  function grad(y0, y1, c0, c1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  const PASTRY = {
    dragonfruit(m, i) {
      const now = performance.now() / 1000, flap = Math.sin(now * 6 + i) * 0.25;
      for (const s2 of [-1, 1]) {                                                         // little wings
        ctx.save(); ctx.translate(s2 * 14, -38); ctx.rotate(s2 * (0.5 + flap));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s2 * 18, -14, s2 * 20, 4); ctx.quadraticCurveTo(s2 * 12, 0, s2 * 10, 6); ctx.quadraticCurveTo(s2 * 6, 2, 0, 6); ctx.closePath();
        ctx.fillStyle = grad(-14, 6, '#b2f2bb', '#40c057'); ctx.fill(); outline(1.6); ctx.restore();
      }
      blob(0, -32, 18, 16); ctx.fillStyle = grad(-48, -16, '#ff6fb5', '#d6336c'); ctx.fill(); outline();   // dragon fruit body
      ctx.fillStyle = '#69db7c';                                                                           // green scale tips
      for (const [sx, sy, a] of [[-14, -42, -0.9], [14, -42, 0.9], [-17, -28, -1.6], [17, -28, 1.6], [0, -48, 0]]) {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-3, 2); ctx.quadraticCurveTo(0, -9, 3, 2); ctx.closePath(); ctx.fill(); outline(1.2); ctx.restore();
      }
      ctx.fillStyle = '#ffd43b';                                                                           // tiny horns
      for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s2 * 6, -46); ctx.quadraticCurveTo(s2 * 9, -56, s2 * 12, -55); ctx.quadraticCurveTo(s2 * 9, -50, s2 * 10, -45); ctx.closePath(); ctx.fill(); outline(1.2); }
      ctx.fillStyle = 'rgba(255,255,255,.35)'; blob(-7, -40, 5, 3.5); ctx.fill();
      ctx.fillStyle = '#2b1d2e'; for (const [sx, sy] of [[-9, -22], [10, -20], [-3, -18], [6, -44]]) { blob(sx, sy, 0.9, 0.9); ctx.fill(); } // seeds
      if (m.alive) { ctx.fillStyle = 'rgba(255,170,60,' + (0.35 + 0.25 * Math.sin(now * 9)) + ')'; blob(20, -24, 4 + Math.sin(now * 9) * 1.5, 2.5); ctx.fill(); } // ember puff
      drawFace(2, -30, m, i);
    },
    random(m, i) {                                                                         // mystery gift box (menu only)
      const now = performance.now() / 1000, wob = Math.sin(now * 3 + i) * 0.06;
      ctx.save(); ctx.translate(0, -32); ctx.rotate(wob);
      roundRect(-17, -14, 34, 28, 5); ctx.fillStyle = grad(-14, 14, '#b197fc', '#7048e8'); ctx.fill(); outline();
      roundRect(-19, -19, 38, 8, 3); ctx.fillStyle = grad(-19, -11, '#d0bfff', '#9775fa'); ctx.fill(); outline(1.8);
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(-3, -19, 6, 33);                                            // ribbon
      ctx.beginPath(); ctx.ellipse(-7, -23, 7, 4, -0.5, 0, 6.29); ctx.ellipse(7, -23, 7, 4, 0.5, 0, 6.29); ctx.fill(); outline(1.4);
      ctx.fillStyle = '#fff'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('?', 0, 3); ctx.fillText('?', 0, 3);
      for (let k = 0; k < 3; k++) { const a = now * 2 + k * 2.1; ctx.fillStyle = '#ffd43b'; blob(Math.cos(a) * 24, -2 + Math.sin(a) * 14, 1.6, 1.6); ctx.fill(); } // sparkles
      ctx.restore();
    },
    shortcake(m, i) {
      roundRect(-17, -46, 34, 28, 9); ctx.fillStyle = grad(-46, -18, '#fff0c7', '#f3c983'); ctx.fill(); outline();
      ctx.fillStyle = '#ff9ec6'; ctx.fillRect(-16, -35, 32, 5); ctx.fillStyle = '#e8435a'; ctx.fillRect(-16, -31, 32, 2);   // cream + jam layer
      ctx.fillStyle = '#fff';                                                                                                  // whipped cream scallops
      for (const cx of [-11, 0, 11]) { blob(cx, -47, 7, 5.5); ctx.fill(); }
      ctx.beginPath(); for (const cx of [-11, 0, 11]) { ctx.moveTo(cx + 7, -47); ctx.ellipse(cx, -47, 7, 5.5, 0, 0, Math.PI, true); } outline(1.8);
      ctx.fillStyle = grad(-62, -50, '#ff5a6e', '#d6243c');                                                                  // strawberry
      ctx.beginPath(); ctx.moveTo(0, -50); ctx.bezierCurveTo(-9, -55, -8, -64, 0, -61); ctx.bezierCurveTo(8, -64, 9, -55, 0, -50); ctx.fill(); outline(1.8);
      ctx.fillStyle = '#ffe9a8'; for (const [sx, sy] of [[-3, -58], [2, -56], [-1, -54], [3, -60]]) { blob(sx, sy, 0.8, 1.1); ctx.fill(); }
      ctx.fillStyle = '#51cf66'; ctx.beginPath(); ctx.moveTo(-5, -62); ctx.lineTo(0, -66); ctx.lineTo(5, -62); ctx.lineTo(0, -60); ctx.closePath(); ctx.fill();
      drawFace(2, -27, m, i);
    },
    eclair(m, i) {
      roundRect(-24, -40, 48, 22, 11); ctx.fillStyle = grad(-40, -18, '#f7c983', '#d9944a'); ctx.fill(); outline();
      ctx.fillStyle = grad(-44, -32, '#6b3a1d', '#4a250f');                                                                // glossy chocolate glaze with drips
      ctx.beginPath(); ctx.moveTo(-22, -34); ctx.quadraticCurveTo(-24, -44, -12, -43); ctx.lineTo(14, -43); ctx.quadraticCurveTo(25, -44, 22, -34);
      for (const [dx, dl] of [[16, 5], [6, 8], [-6, 4], [-15, 7]]) { ctx.lineTo(dx + 3, -34); ctx.quadraticCurveTo(dx, -34 + dl * 1.6, dx - 3, -34); }
      ctx.closePath(); ctx.fill(); outline(1.8);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; roundRect(-14, -42, 16, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#fff5e0'; for (const dx of [-14, -4, 6]) { blob(dx, -19, 3.2, 2); ctx.fill(); }                      // cream peeking out
      drawFace(4, -26, m, i);
    },
    meringue(m, i) {
      const g = grad(-60, -18, '#fbe4ff', '#d0b3ff');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-19, -20); ctx.quadraticCurveTo(-22, -34, -12, -38); ctx.quadraticCurveTo(-14, -48, -4, -50);
      ctx.quadraticCurveTo(-4, -60, 3, -64); ctx.quadraticCurveTo(9, -62, 5, -57);                                         // curled peak
      ctx.quadraticCurveTo(14, -50, 10, -40); ctx.quadraticCurveTo(22, -36, 19, -20); ctx.closePath(); ctx.fill(); outline();
      ctx.strokeStyle = 'rgba(160,110,220,.55)'; ctx.lineWidth = 1.6;                                                      // swirl lines
      ctx.beginPath(); ctx.moveTo(-14, -38); ctx.quadraticCurveTo(0, -33, 12, -40); ctx.moveTo(-6, -49); ctx.quadraticCurveTo(2, -45, 9, -50); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; blob(-8, -44, 3, 5); ctx.fill();
      drawFace(1, -27, m, i);
    },
    fudge(m, i) {
      roundRect(-18, -46, 36, 28, 6); ctx.fillStyle = grad(-46, -18, '#8a5230', '#5e3219'); ctx.fill(); outline();
      roundRect(-18, -46, 36, 8, 5); ctx.fillStyle = '#4a2611'; ctx.fill();                                               // crackly crust
      ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-12, -44); ctx.lineTo(-6, -41); ctx.lineTo(1, -44); ctx.lineTo(8, -41); ctx.stroke();
      ctx.strokeStyle = '#fff6ea'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';                                             // white drizzle
      ctx.beginPath(); ctx.moveTo(-15, -47); ctx.lineTo(-9, -40); ctx.lineTo(-3, -47); ctx.lineTo(3, -40); ctx.lineTo(9, -47); ctx.lineTo(14, -41); ctx.stroke();
      ctx.fillStyle = '#3a1d0c'; for (const [cx, cy] of [[-13, -22], [13, -36], [12, -22]]) { blob(cx, cy, 2, 1.6); ctx.fill(); }  // choc chips
      drawFace(1, -29, m, i);
    },
  };
  /* cart + cannon + rider (+ bot accessory), drawn at the feet origin. Shared by battle and menu thumbnails. */
  function drawBody(m, i, tilt) {
    const now = performance.now() / 1000;
    const [tc, tcd] = TEAM[m.team] || TEAM.A;
    if (!m.alive) ctx.globalAlpha = 0.45;
    // soft shadow + team glow ring
    ctx.fillStyle = 'rgba(40,20,40,.22)'; blob(0, 1, 23, 5); ctx.fill();
    ctx.strokeStyle = tc; ctx.globalAlpha *= 0.85; ctx.lineWidth = 2.5; blob(0, 0, 24, 6.5); ctx.stroke(); ctx.globalAlpha = m.alive ? 1 : 0.45;
    // treads: rounded track with rolling wheels
    if (m._lx == null) m._lx = m.x;
    m.wheelA = (m.wheelA || 0) + (m.x - m._lx) / 5; m._lx = m.x;
    roundRect(-21, -12, 42, 11, 5.5); ctx.fillStyle = '#5a4660'; ctx.fill(); outline(2);
    for (const wx of [-14, 0, 14]) {
      ctx.fillStyle = '#c9b8d6'; blob(wx, -6.5, 4, 4); ctx.fill();
      ctx.strokeStyle = '#7d6a8a'; ctx.lineWidth = 1.5; const a = m.wheelA;
      ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 3.5, -6.5 + Math.sin(a) * 3.5); ctx.lineTo(wx - Math.cos(a) * 3.5, -6.5 - Math.sin(a) * 3.5); ctx.stroke();
    }
    // cart tray in team colours
    roundRect(-19, -19, 38, 9, 4.5); ctx.fillStyle = grad(-19, -10, tc, tcd); ctx.fill(); outline(2);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; roundRect(-15, -18, 18, 2.5, 1.2); ctx.fill();
    // piping-bag cannon, mounted on the cart BEHIND the rider so faces stay visible (unflipped: matches aim + trajectory)
    if (m.alive) {
      const a = (m.ang || 45) * Math.PI / 180;
      ctx.save(); ctx.translate(0, -17); ctx.rotate(-a); // aim is relative to the (tilted) body
      ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(24, -3.2); ctx.lineTo(24, 3.2); ctx.lineTo(2, 6); ctx.quadraticCurveTo(-3, 0, 2, -6); ctx.closePath();
      ctx.fillStyle = grad(-6, 6, '#ffffff', '#e9dcf2'); ctx.fill(); outline(1.8);
      ctx.strokeStyle = tc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(9, -5); ctx.lineTo(9, 5); ctx.moveTo(16, -4.2); ctx.lineTo(16, 4.2); ctx.stroke();
      ctx.fillStyle = tc; ctx.beginPath();                                                                                // star nozzle
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 2.4 : 5, t = k * Math.PI / 5; ctx.lineTo(28 + Math.cos(t) * r * 0.6, Math.sin(t) * r); }
      ctx.closePath(); ctx.fill(); outline(1.4);
      ctx.restore();
    }
    // the pastry rider: idle bob, faces the direction of travel
    const bob = m.alive ? Math.sin(now * 3 + i * 1.3) * 1.2 : 0;
    ctx.save(); ctx.translate(0, bob + 1); ctx.scale(m.face || 1, 1);
    (PASTRY[m.mobile] || PASTRY.shortcake)(m, i);
    if (m.isBot && m.bot) drawAccessory(m.bot, m.mobile);
    ctx.restore();
  }
  /* bot personalities wear something: chef hat, monocle, fuse, grad cap + specs, bib */
  const HEAD = { dragonfruit: [2, -30, -48], random: [0, -32, -52], shortcake: [2, -27, -50], eclair: [4, -26, -44], meringue: [1, -27, -52], fudge: [1, -29, -47] }; // face x, face y, head top
  function drawAccessory(bot, mobile) {
    const [fx, fy, top] = HEAD[mobile] || HEAD.shortcake;
    const now = performance.now() / 1000;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (bot === 'baker') {            // chef's hat, jaunty
      ctx.save(); ctx.translate(-7, top - 2); ctx.rotate(-0.25);
      roundRect(-9, -6, 18, 7, 2); ctx.fillStyle = '#fff'; ctx.fill(); outline(1.6);
      ctx.beginPath(); ctx.arc(-6, -9, 5.5, 0, 6.29); ctx.arc(0, -12, 6.5, 0, 6.29); ctx.arc(6, -9, 5.5, 0, 6.29); ctx.fillStyle = '#fff'; ctx.fill(); outline(1.6);
      ctx.restore();
    } else if (bot === 'deadeye') {   // gold monocle + chain
      ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2; blob(fx + 6.5, fy, 6.2, 6.6); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx + 11, fy + 5); ctx.quadraticCurveTo(fx + 16, fy + 14, fx + 12, fy + 18); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; blob(fx + 4.5, fy - 2.5, 2, 1.4); ctx.fill();
    } else if (bot === 'cannon') {    // lit fuse on top
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(3, top + 2); ctx.quadraticCurveTo(6, top - 8, 11, top - 11); ctx.stroke();
      const f = 0.6 + Math.sin(now * 20) * 0.4;
      ctx.fillStyle = '#ffd43b'; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = (k % 2 ? 2 : 5) * (0.8 + f * 0.4), t = k * Math.PI / 5; ctx.lineTo(12 + Math.cos(t) * r, top - 12 + Math.sin(t) * r); }
      ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff6b3d'; blob(12, top - 12, 1.8, 1.8); ctx.fill();
    } else if (bot === 'prof') {      // mortarboard + round specs
      ctx.save(); ctx.translate(0, top - 1);
      ctx.fillStyle = '#2b2440'; ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(0, -8); ctx.lineTo(14, -2); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); outline(1.4);
      roundRect(-6, 0, 12, 5, 1.5); ctx.fill();
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(10, 1); ctx.lineTo(10, 8); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; for (const s2 of [-1, 1]) { blob(fx + s2 * 6.5, fy, 5.6, 5.6); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(fx - 1, fy); ctx.lineTo(fx + 1, fy); ctx.stroke();
    } else if (bot === 'baby') {      // bib + a little curl of hair
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy + 11, 7, 0, Math.PI); ctx.closePath(); ctx.fill(); outline(1.4);
      ctx.strokeStyle = '#ff9ec6'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(fx, fy + 11, 5, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(fx, top + 1); ctx.bezierCurveTo(fx - 1, top - 7, fx + 7, top - 7, fx + 4, top - 2); ctx.stroke();
    }
  }
  /* menu thumbnails: draw a character into a small canvas with the same art as the battle */
  
    return { drawBody: drawBody };
  })();

  /* ---------- Bubble Brawl blobs ---------- */
  var BLOBS = (function () {
  const PALETTE=['#ff7b8a','#4aa8ff','#51d88a','#b07fe8','#ffd76a','#ff9d5c','#2ed8d0','#e8e8f0'];
  const PALETTE_D=['#d44a5c','#2b6fd4','#2f9e5f','#7d4fc0','#c9a13b','#c96a2e','#1a9a94','#9a9ab0'];
  const INK='#3b2a4a';
  function ink(w){ctx.strokeStyle=INK;ctx.lineWidth=w||1.8;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke()}
  function ell(x,y,rx,ry,rot){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rot||0,0,6.29)}
  /* one hat per colour slot, so every player in a match has their own look (and it matches on every screen).
     Each takes the head-centre x and the head-top y. */
  const HATS=[
   /* bow */(x,t)=>{ctx.save();ctx.translate(x+9,t+4);ctx.rotate(.35);ctx.fillStyle='#ff4f7b';
    ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-9,-9,-10,0);ctx.quadraticCurveTo(-9,9,0,0);ctx.fill();ink(1.5);
    ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(9,-9,10,0);ctx.quadraticCurveTo(9,9,0,0);ctx.fill();ink(1.5);
    ell(0,0,3,3);ctx.fillStyle='#ff9bb5';ctx.fill();ink(1.3);ctx.restore()},
   /* beanie */(x,t)=>{ctx.beginPath();ctx.moveTo(x-13,t+8);ctx.quadraticCurveTo(x-13,t-10,x,t-10);ctx.quadraticCurveTo(x+13,t-10,x+13,t+8);ctx.closePath();ctx.fillStyle='#3d7be8';ctx.fill();ink();
    rr(x-14,t+3,28,7,3.5);ctx.fillStyle='#a8c8ff';ctx.fill();ink(1.6);ell(x,t-12,4.6,4.6);ctx.fillStyle='#fff';ctx.fill();ink(1.5)},
   /* sprout */(x,t)=>{ctx.strokeStyle='#4a9a3a';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,t+3);ctx.quadraticCurveTo(x+1,t-5,x,t-9);ctx.stroke();
    for(const s of[-1,1]){ell(x+s*6,t-11,6.5,3.6,s*-.5);ctx.fillStyle=s<0?'#5fcf55':'#79e06a';ctx.fill();ink(1.5)}},
   /* wizard */(x,t)=>{ell(x,t+3,15,4.2);ctx.fillStyle='#5a34a8';ctx.fill();ink(1.6);
    ctx.beginPath();ctx.moveTo(x-10,t+3);ctx.quadraticCurveTo(x-6,t-12,x+5,t-27);ctx.quadraticCurveTo(x+7,t-10,x+10,t+3);ctx.closePath();ctx.fillStyle='#7b4fd0';ctx.fill();ink();
    ctx.fillStyle='#ffd23f';ctx.beginPath();for(let k=0;k<10;k++){const r=k%2?1.7:4,a=k*Math.PI/5-Math.PI/2;ctx.lineTo(x-1+Math.cos(a)*r,t-9+Math.sin(a)*r)}ctx.closePath();ctx.fill();ink(1)},
   /* crown */(x,t)=>{ctx.beginPath();ctx.moveTo(x-11,t+4);ctx.lineTo(x-11,t-9);ctx.lineTo(x-5.5,t-3);ctx.lineTo(x,t-12);ctx.lineTo(x+5.5,t-3);ctx.lineTo(x+11,t-9);ctx.lineTo(x+11,t+4);ctx.closePath();ctx.fillStyle='#ffd23f';ctx.fill();ink();
    ell(x,t-1,2.3,2.3);ctx.fillStyle='#ff4f6e';ctx.fill();ink(1);for(const s of[-1,1]){ell(x+s*7,t,1.6,1.6);ctx.fillStyle='#6fe0ff';ctx.fill()}},
   /* party */(x,t)=>{ctx.beginPath();ctx.moveTo(x-9,t+4);ctx.lineTo(x+1,t-21);ctx.lineTo(x+9,t+4);ctx.closePath();ctx.fillStyle='#ff9d5c';ctx.fill();ink();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-5,t-3);ctx.lineTo(x+6,t-6);ctx.moveTo(x-2,t-11);ctx.lineTo(x+3.5,t-12.5);ctx.stroke();
    ell(x+1,t-22,3.6,3.6);ctx.fillStyle='#ffe066';ctx.fill();ink(1.4)},
   /* cap */(x,t)=>{ctx.beginPath();ctx.moveTo(x-12,t+6);ctx.quadraticCurveTo(x-12,t-9,x,t-9);ctx.quadraticCurveTo(x+12,t-9,x+12,t+6);ctx.closePath();ctx.fillStyle='#1fb5ad';ctx.fill();ink();
    ell(x+11,t+5,10,3.2,.08);ctx.fillStyle='#168f89';ctx.fill();ink(1.5);ell(x,t-9,2.2,2.2);ctx.fillStyle='#fff';ctx.fill();ink(1.2)},
   /* chef */(x,t)=>{for(const[dx,dy,r]of[[-7,-3,7],[7,-3,7],[0,-8,8.5]]){ell(x+dx,t+dy,r,r);ctx.fillStyle='#fff';ctx.fill();ink(1.6)}
    rr(x-10,t,20,7,3);ctx.fillStyle='#f4f4fb';ctx.fill();ink(1.6)},
  ];
  function drawBlob(p,now){
   const blink=p.invuln>0&&Math.floor(now*10)%2===0;
   if(blink)ctx.globalAlpha=.35;
   const idle=Math.sin(now*3+p.id*1.7),hop=p.moving?Math.abs(Math.sin(p.walkPh))*3:0;
   const x=p.x,y=p.y,by=y-hop+idle*.6,r=p.r;
   // soft shadow (shrinks while hopping) + little feet
   ctx.fillStyle='rgba(40,20,50,.22)';ell(x,y+16,14-hop*.8,5-hop*.3);ctx.fill();
   const step=p.moving?Math.sin(p.walkPh)*4:0;
   for(const s of[-1,1]){ell(x+s*8,y+14+(s>0?-step:step),6,4.6);ctx.fillStyle=p.dark;ctx.fill();ink(1.5)}
   // body, squashed a touch as it hops / breathes
   const sq=p.moving?1+Math.cos(p.walkPh*2)*.05:1+idle*.025;
   ctx.save();ctx.translate(x,y+15);ctx.scale(sq,1/sq);ctx.translate(-x,-(y+15));
   ctx.beginPath();ctx.arc(x,by,r,0,6.29);ctx.fillStyle=p.dark;ctx.fill();               // rim shade
   ctx.beginPath();ctx.arc(x-1.5,by-2,r-2,0,6.29);ctx.fillStyle=p.color;ctx.fill();      // body
   ctx.fillStyle='rgba(255,255,255,.42)';ell(x-6,by-8,5,3.2,-.6);ctx.fill();             // shine
   ctx.beginPath();ctx.arc(x,by,r,0,6.29);ink(2);                                         // outline
   // face: big shiny eyes (blink), blush, cat smile; chevron eyes + frown when trapped
   const ex=p.face*1.8,trapped=p.knocked>0,blinking=!trapped&&((now+p.id*1.3)%4)<.13;
   for(const s of[-1,1]){
    const cx=x+s*6.2+ex*.6;
    if(trapped){ctx.beginPath();ctx.moveTo(x+s*9,by-5);ctx.lineTo(x+s*4,by-2);ctx.lineTo(x+s*9,by+1);ink(2.2)}
    else if(blinking){ctx.beginPath();ctx.arc(cx,by-2,3.6,.15*Math.PI,.85*Math.PI);ink(2)}
    else{
     ell(cx,by-2,4.6,5.4);ctx.fillStyle='#fff';ctx.fill();ink(1.2);
     ell(cx+ex*.7,by-1,3,3.9);ctx.fillStyle='#2b1d2e';ctx.fill();
     ctx.fillStyle='#fff';ell(cx+ex*.7+1,by-3,1.3,1.5);ctx.fill();ell(cx+ex*.7-1,by+1,.7,.7);ctx.fill();
    }
   }
   ctx.fillStyle='rgba(255,110,140,.5)';ell(x-11,by+4.5,3,2);ctx.fill();ell(x+11,by+4.5,3,2);ctx.fill();
   if(trapped){ctx.beginPath();ctx.arc(x,by+9,2.6,Math.PI*1.1,Math.PI*1.9);ink(1.8);ctx.fillStyle='#8fd8ff';ctx.beginPath();ctx.moveTo(x+11,by);ctx.quadraticCurveTo(x+14,by+5,x+11,by+7);ctx.quadraticCurveTo(x+8,by+5,x+11,by);ctx.fill()}
   else{ctx.beginPath();ctx.arc(x-1.5,by+5.5,2,.1*Math.PI,.9*Math.PI);ctx.moveTo(x+3.5,by+5.9);ctx.arc(x+1.5,by+5.5,2,.1*Math.PI,.9*Math.PI);ink(1.7)}
   // this player's hat (colour slot → hat), swaying with the walk
   const hi=Math.max(0,PALETTE.indexOf(p.color))%HATS.length,ht=by-r+1;
   ctx.save();ctx.translate(x,ht);ctx.rotate(idle*.03+(p.moving?Math.sin(p.walkPh)*.06:0));ctx.translate(-x,-ht);
   HATS[hi](x+ex*.4,ht);ctx.restore();
   ctx.restore();
   ctx.globalAlpha=1;
  }
  
  return { drawBlob: drawBlob, PALETTE: PALETTE, PALETTE_D: PALETTE_D };
  })();

  /* ---------- Hamster Roll hamster ---------- */
  var HAM = (function () {
    var R = 15;
  function drawHamster(x,y,roll,face,color,name,dizzy,now,sq,sqAxis){
    const squashing=sq>0;
    if(squashing){const a=sq,k=1+a*0.6;ctx.save();ctx.translate(x,y+(sqAxis==='y'?R*a*0.5:0));ctx.scale(sqAxis==='x'?1-a:k,sqAxis==='x'?k:1-a);ctx.translate(-x,-y);}
    // bubble
    ctx.fillStyle='rgba(200,235,255,.38)';ctx.beginPath();ctx.arc(x,y,R+5,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,R+5,0,7);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(x-4,y-6,5,Math.PI*.9,Math.PI*1.5);ctx.stroke();
    // hamster (rotates with roll)
    ctx.save();ctx.translate(x,y);ctx.rotate(roll*.9);
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,R-2,0,7);ctx.fill();
    // ears
    ctx.beginPath();ctx.arc(-8,-R+6,5.5,0,7);ctx.arc(8,-R+6,5.5,0,7);ctx.fill();
    ctx.fillStyle='#ffb3c1';ctx.beginPath();ctx.arc(-8,-R+6,2.6,0,7);ctx.arc(8,-R+6,2.6,0,7);ctx.fill();
    // feet
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(-7,R-3,5,3.4,0,0,7);ctx.ellipse(7,R-3,5,3.4,0,0,7);ctx.fill();
    // face
    const fx=face*3;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-5.5+fx,-2,4.6,0,7);ctx.arc(5.5+fx,-2,4.6,0,7);ctx.fill();
    ctx.fillStyle=dizzy?'#888':'#222';ctx.beginPath();ctx.arc(-5+fx,-1.4,2.4,0,7);ctx.arc(6+fx,-1.4,2.4,0,7);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-4.3+fx,-2.2,.9,0,7);ctx.arc(6.7+fx,-2.2,.9,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,130,150,.75)';ctx.beginPath();ctx.arc(-10+fx,3.5,2.8,0,7);ctx.arc(10+fx,3.5,2.8,0,7);ctx.fill();
    ctx.strokeStyle='#7a4a21';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(fx,4.5,3,.3,Math.PI-.3);ctx.stroke();
    if(dizzy){ctx.strokeStyle='#ffd166';ctx.lineWidth=2;for(let i=0;i<3;i++){const a=now/300+i*2.1;ctx.beginPath();ctx.arc(Math.cos(a)*14,-R-6+Math.sin(a)*3,3,0,7);ctx.stroke();}}
    ctx.restore();
    if(squashing)ctx.restore();
    // name
    if(name){ctx.fillStyle='rgba(0,0,0,.55)';ctx.font='bold 12px Trebuchet MS';ctx.textAlign='center';const w=ctx.measureText(name).width;rr(x-w/2-5,y-R-26,w+10,17,8);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(name,x,y-R-13);}
  }
  
    return { drawHamster: drawHamster };
  })();

  /* ---------- public API ---------- */
  var PASTRIES = ['shortcake', 'eclair', 'meringue', 'fudge'];
  var ids = PASTRIES.concat(BLOBS.PALETTE.map(function (_, i) { return 'blob' + i; }), ['hamster']);
  var TEAMCOL = { A: '#4dabf7', B: '#ff7aa2' };

  function draw(canvas, id, o) {
    o = o || {};
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = canvas.clientWidth || canvas.width / dpr || 84, h = canvas.clientHeight || canvas.height / dpr || 84;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var c = canvas.getContext('2d'), t = o.t == null ? performance.now() / 1000 : o.t;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
    var k = (h / 82) * dpr, cx = (w / 2) * dpr, base = h * 0.9 * dpr;
    ctx = c;
    try {
      if (PASTRIES.indexOf(id) >= 0) {
        var m = canvas._m || (canvas._m = { mobile: id, team: o.team || 'A', bot: o.bot || null, isBot: !!o.bot, alive: true, hp: 999, hpMax: 999, face: o.face || 1, ang: 38, x: 0 });
        m.mobile = id; m.team = o.team || 'A'; m.bot = o.bot || null; m.isBot = !!o.bot; m.face = o.face || 1;
        c.setTransform(k, 0, 0, k, cx - 2 * dpr, base); PAST.drawBody(m, canvas._i || (canvas._i = (Math.random() * 6) | 0), 0);
      } else if (id.indexOf('blob') === 0) {
        var n = +id.slice(4) % BLOBS.PALETTE.length;
        var p = canvas._p || (canvas._p = { id: n, x: 0, y: 0, r: 16, moving: false, walkPh: 0, knocked: 0, invuln: 0, face: 1, name: '', isBot: false });
        p.color = BLOBS.PALETTE[n]; p.dark = BLOBS.PALETTE_D[n]; p.face = o.face || 1;
        var s = (h / 66) * dpr;
        c.setTransform(s, 0, 0, s, cx, h * 0.62 * dpr); p.x = 0; p.y = 0;
        BLOBS.drawBlob(p, t);
      } else if (id === 'hamster') {
        var s2 = (h / 54) * dpr;
        c.setTransform(s2, 0, 0, s2, cx, h * 0.55 * dpr);
        HAM.drawHamster(0, 0, Math.sin(t * 2) * 0.25, 1, '#ff9f43', '', false, t * 1000);
      }
    } catch (e) { /* a drawing problem must never break a menu */ }
    ctx = null;
  }

  var live = [], raf = 0;
  function frame() {
    raf = 0;
    if (document.hidden || !live.length) return;
    var t = performance.now() / 1000;
    for (var i = live.length - 1; i >= 0; i--) {
      var it = live[i];
      if (!it.c.isConnected) { live.splice(i, 1); continue; }
      draw(it.c, it.id, { t: t + it.off, team: it.team, bot: it.bot });
    }
    if (live.length) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && live.length) raf = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', kick);

  function cast(el, list, o) {
    o = o || {}; el.classList.add('arc-cast');
    (list || ids).forEach(function (id, i) {
      var c = document.createElement('canvas'); c.className = 'arc-cast-c'; c.setAttribute('aria-hidden', 'true');
      c.style.width = c.style.height = (o.size || 84) + 'px';
      el.appendChild(c);
      live.push({ c: c, id: id, off: i * 1.3, team: o.team || (i % 2 ? 'B' : 'A'), bot: null });
    });
    kick();
  }

  window.ArcadeArt = { ids: ids, draw: draw, cast: cast };
})();
