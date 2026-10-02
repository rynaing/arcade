/* Ryan Cake Studios Arcade — shared sound engine.
 *
 * Everything is synthesised with Web Audio (no files to download), so games stay
 * quick to load. One mute setting is shared by every game.
 *
 *   ArcadeAudio.sfx(name, opts)     — play an effect ('boom', 'coin', 'pop', ... see SFX below)
 *   ArcadeAudio.music(name | null)  — start a looping song ('menu','cake','brawl','race') or stop
 *   ArcadeAudio.toggle()            — mute / unmute everything (remembered across games)
 *   ArcadeAudio.bindButton(el)      — make a button show 🔊/🔇 and toggle on click
 *   ArcadeAudio.muted               — current state
 *
 * Browsers only allow sound after the player interacts, so the engine wakes on the
 * first tap / key press and quietly ignores calls before that.
 */
(function () {
  'use strict';
  var LS = 'arcade-audio';
  var prefs = { muted: false, music: 0.5, sfx: 0.85 };
  try { var saved = JSON.parse(localStorage.getItem(LS) || 'null'); if (saved) for (var k in prefs) if (k in saved) prefs[k] = saved[k]; } catch (e) {}
  function savePrefs() { try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch (e) {} }

  var ac = null, master, musicBus, sfxBus, verbSend, noiseBuf, buttons = [];
  var lastPlayed = {};
  var stats = { sfx: {}, notes: 0 };   // counters for testing/debugging

  function ensure() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch (e) { return null; }
    var comp = ac.createDynamicsCompressor();          // glue + protect against clipping
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ac.createGain(); master.gain.value = prefs.muted ? 0 : 1;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = prefs.music; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = prefs.sfx; sfxBus.connect(master);
    // small room reverb for bells / sparkles
    var len = Math.floor(ac.sampleRate * 1.3), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    var verb = ac.createConvolver(); verb.buffer = ir;
    verbSend = ac.createGain(); verbSend.gain.value = 0.35; verbSend.connect(verb); verb.connect(master);
    // white noise source buffer
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    return ac;
  }
  function wake() {
    var a = ensure(); if (!a) return;
    var go = function () { if (pendingSong && !songTimer) startSong(pendingSong); };
    if (a.state === 'suspended') a.resume().then(go, function () {}); else go();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, wake, { capture: true, passive: true }); });
  function live() { return ac && ac.state === 'running' && !prefs.muted; }

  /* ---------------- building blocks ---------------- */
  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  // tone with an attack/decay envelope; o: {type, vol, a, r, to (pitch slide target Hz), filter, q, bus, verb, detune}
  function tone(f, t, dur, o) {
    o = o || {};
    var osc = ac.createOscillator(), g = ac.createGain(), out = g;
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    var vol = o.vol == null ? 0.3 : o.vol, a = o.a == null ? 0.005 : o.a;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    if (o.filter) { var bq = ac.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = o.filter; bq.Q.value = o.q || 0.7; g.connect(bq); out = bq; }
    out.connect(o.bus || sfxBus); if (o.verb) out.connect(verbSend);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  // filtered noise burst; o: {vol, type ('lowpass'|'bandpass'|'highpass'), f, to, q, a, bus}
  function noise(t, dur, o) {
    o = o || {};
    var src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var bq = ac.createBiquadFilter(); bq.type = o.type || 'lowpass'; bq.Q.value = o.q || 0.8;
    bq.frequency.setValueAtTime(o.f || 2000, t); if (o.to) bq.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + dur);
    var g = ac.createGain(), vol = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq); bq.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  function arp(notes, t, step, o) { notes.forEach(function (n, i) { tone(mtof(n), t + i * step, (o && o.dur) || 0.25, o); }); }

  /* ---------------- effects ---------------- */
  var SFX = {
    click:   function (t) { tone(1300, t, 0.05, { type: 'triangle', vol: 0.12 }); },
    select:  function (t) { tone(880, t, 0.07, { type: 'triangle', vol: 0.14 }); tone(1320, t + 0.05, 0.09, { type: 'triangle', vol: 0.12 }); },
    error:   function (t) { tone(220, t, 0.16, { type: 'square', vol: 0.08, filter: 1200 }); tone(180, t + 0.1, 0.2, { type: 'square', vol: 0.08, filter: 1000 }); },
    turn:    function (t) { arp([79, 84], t, 0.09, { type: 'sine', vol: 0.16, dur: 0.35, verb: true }); },
    count:   function (t) { tone(660, t, 0.14, { type: 'square', vol: 0.09, filter: 2500 }); },
    go:      function (t) { tone(990, t, 0.35, { type: 'square', vol: 0.11, filter: 3000 }); tone(1320, t, 0.35, { type: 'triangle', vol: 0.08 }); },
    // artillery / balloons
    fire:    function (t, o) { var k = (o && o.size) || 1; noise(t, 0.25, { f: 3000, to: 400, vol: 0.18 * k, type: 'bandpass', q: 0.6 }); tone(220, t, 0.18, { type: 'sine', vol: 0.22, to: 90 }); },
    whoosh:  function (t) { noise(t, 0.35, { type: 'bandpass', f: 600, to: 2400, q: 1.2, vol: 0.14, a: 0.08 }); },
    boom:    function (t, o) {
      var s = Math.max(0.5, Math.min(2, (o && o.size) || 1));
      noise(t, 0.5 + s * 0.35, { f: 1800, to: 80, vol: 0.32 * s, type: 'lowpass', q: 0.5 });
      tone(110, t, 0.45 + s * 0.2, { type: 'sine', vol: 0.4 * Math.min(1.3, s), to: 38 });
      noise(t, 0.09, { type: 'highpass', f: 2500, vol: 0.12 });
    },
    hit:     function (t) { tone(330, t, 0.12, { type: 'square', vol: 0.1, to: 160, filter: 1800 }); noise(t, 0.08, { type: 'highpass', f: 1500, vol: 0.1 }); },
    ko:      function (t) { tone(600, t, 0.7, { type: 'sawtooth', vol: 0.12, to: 70, filter: 1400 }); noise(t + 0.05, 0.6, { f: 900, to: 100, vol: 0.18 }); arp([67, 62, 55], t + 0.25, 0.12, { type: 'triangle', vol: 0.12, dur: 0.3 }); },
    zap:     function (t) { for (var i = 0; i < 4; i++) tone(1200 + Math.random() * 1600, t + i * 0.035, 0.06, { type: 'sawtooth', vol: 0.07, filter: 5000 }); noise(t, 0.3, { type: 'highpass', f: 3000, vol: 0.12 }); },
    charge:  function (t, o) { var p = (o && o.p) || 0; tone(200 + p * 7, t, 0.06, { type: 'triangle', vol: 0.05 }); },
    item:    function (t) { arp([72, 76, 79, 84], t, 0.05, { type: 'triangle', vol: 0.12, dur: 0.2, verb: true }); },
    legendary: function (t) {
      arp([60, 64, 67, 72], t, 0.11, { type: 'sawtooth', vol: 0.09, dur: 0.4, filter: 3000, verb: true });
      [72, 76, 79, 84].forEach(function (n) { tone(mtof(n), t + 0.5, 1.4, { type: 'triangle', vol: 0.09, verb: true }); });
      noise(t + 0.45, 1.2, { type: 'highpass', f: 6000, vol: 0.06, a: 0.3 });
    },
    // bubbles / splashes
    place:   function (t) { tone(520, t, 0.12, { type: 'sine', vol: 0.2, to: 300 }); noise(t, 0.05, { type: 'bandpass', f: 1200, vol: 0.06 }); },
    splash:  function (t, o) { var s = (o && o.size) || 1; noise(t, 0.45, { type: 'bandpass', f: 2600, to: 500, q: 0.9, vol: 0.22 * s }); tone(180, t, 0.25, { type: 'sine', vol: 0.18, to: 70 }); for (var i = 0; i < 4; i++) tone(900 + Math.random() * 900, t + 0.05 + i * 0.05, 0.07, { type: 'sine', vol: 0.05 }); },
    trap:    function (t) { tone(300, t, 0.5, { type: 'sine', vol: 0.18, to: 700 }); tone(450, t + 0.02, 0.5, { type: 'sine', vol: 0.1, to: 1050, verb: true }); },
    pop:     function (t) { tone(900, t, 0.09, { type: 'sine', vol: 0.3, to: 200 }); noise(t, 0.06, { type: 'highpass', f: 2000, vol: 0.14 }); arp([79, 84, 88], t + 0.06, 0.05, { type: 'triangle', vol: 0.1, dur: 0.18, verb: true }); },
    free:    function (t) { tone(440, t, 0.25, { type: 'triangle', vol: 0.14, to: 990 }); noise(t, 0.15, { type: 'highpass', f: 3000, vol: 0.06 }); },
    // pickups / movement
    coin:    function (t) { tone(mtof(88), t, 0.08, { type: 'square', vol: 0.07, filter: 5000 }); tone(mtof(93), t + 0.06, 0.22, { type: 'square', vol: 0.07, filter: 5000, verb: true }); },
    pickup:  function (t) { arp([76, 81, 88], t, 0.05, { type: 'triangle', vol: 0.13, dur: 0.18, verb: true }); },
    powerup: function (t) { arp([67, 71, 74, 79, 83], t, 0.045, { type: 'square', vol: 0.06, dur: 0.15, filter: 4000, verb: true }); },
    jump:    function (t) { tone(330, t, 0.16, { type: 'square', vol: 0.07, to: 760, filter: 2500 }); },
    land:    function (t) { tone(130, t, 0.12, { type: 'sine', vol: 0.22, to: 60 }); noise(t, 0.06, { type: 'lowpass', f: 900, vol: 0.12 }); },
    bump:    function (t) { tone(200, t, 0.1, { type: 'sine', vol: 0.22, to: 110 }); noise(t, 0.05, { type: 'bandpass', f: 1500, vol: 0.08 }); },
    boing:   function (t) { tone(220, t, 0.32, { type: 'sine', vol: 0.2, to: 880 }); tone(330, t + 0.02, 0.28, { type: 'triangle', vol: 0.06, to: 1320 }); },
    boost:   function (t) { noise(t, 0.5, { type: 'bandpass', f: 400, to: 3500, q: 1.4, vol: 0.18, a: 0.03 }); tone(220, t, 0.45, { type: 'sawtooth', vol: 0.06, to: 880, filter: 2000 }); },
    crumble: function (t) { for (var i = 0; i < 5; i++) noise(t + i * 0.06, 0.12, { type: 'lowpass', f: 700, vol: 0.12 }); },
    // results
    win:     function (t) { arp([72, 76, 79, 84], t, 0.1, { type: 'square', vol: 0.08, dur: 0.22, filter: 3500 }); [72, 76, 79, 84].forEach(function (n) { tone(mtof(n), t + 0.45, 0.9, { type: 'triangle', vol: 0.08, verb: true }); }); },
    lose:    function (t) { arp([67, 63, 60], t, 0.18, { type: 'triangle', vol: 0.13, dur: 0.35 }); tone(mtof(55), t + 0.55, 0.8, { type: 'sine', vol: 0.12, to: mtof(52) }); },
    dnf:     function (t) { arp([64, 60, 57], t, 0.14, { type: 'square', vol: 0.06, dur: 0.25, filter: 1800 }); },
  };
  function sfx(name, opts) {
    if (!live()) return;
    var f = SFX[name]; if (!f) return;
    var now = ac.currentTime, key = name + ((opts && opts.size) || '');
    if (lastPlayed[key] && now - lastPlayed[key] < 0.03) return;   // don't stack identical sounds in one frame
    lastPlayed[key] = now; stats.sfx[name] = (stats.sfx[name] || 0) + 1;
    try { f(now + 0.005, opts || {}); } catch (e) {}
  }

  /* ---------------- music: tiny step sequencer ---------------- */
  // chord = [root midi, 'maj'|'min'] per bar; 16 steps per bar
  var Q = { maj: [0, 4, 7], min: [0, 3, 7] };
  var SONGS = {
    menu:  { bpm: 96,  chords: [[60, 'maj'], [57, 'min'], [53, 'maj'], [55, 'maj']], drums: 'soft', lead: 'sparse', pad: true },
    cake:  { bpm: 126, chords: [[60, 'maj'], [55, 'maj'], [57, 'min'], [53, 'maj']], drums: 'bouncy', lead: 'hook' },
    brawl: { bpm: 138, chords: [[62, 'maj'], [59, 'min'], [55, 'maj'], [57, 'maj']], drums: 'bouncy', lead: 'bubbly' },
    race:  { bpm: 156, chords: [[64, 'min'], [60, 'maj'], [55, 'maj'], [62, 'maj']], drums: 'drive', lead: 'hook' },
  };
  var DRUMS = {
    soft:   { k: [0, 8], s: [], h: [4, 12] },
    bouncy: { k: [0, 6, 8], s: [4, 12], h: [2, 6, 10, 14] },
    drive:  { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14, 15] },
  };
  var song = null, songTimer = null, step = 0, nextT = 0, pendingSong = null;
  function scheduleStep(st, t) {
    var bar = Math.floor(st / 16) % song.chords.length, s = st % 16, ch = song.chords[bar], tones = Q[ch[1]].map(function (x) { return ch[0] + x; });
    var spb = 60 / song.bpm / 4, mb = musicBus, dr = DRUMS[song.drums];
    if (dr.k.indexOf(s) >= 0) tone(130, t, 0.22, { type: 'sine', vol: 0.5, to: 45, bus: mb });
    if (dr.s.indexOf(s) >= 0) { noise(t, 0.16, { type: 'bandpass', f: 1800, q: 0.7, vol: 0.16, bus: mb }); tone(220, t, 0.08, { type: 'triangle', vol: 0.08, bus: mb }); }
    if (dr.h.indexOf(s) >= 0) noise(t, 0.04, { type: 'highpass', f: 7000, vol: 0.06, bus: mb });
    if (s % 4 === 0 || (song.drums !== 'soft' && s % 4 === 3 && s !== 15)) tone(mtof(ch[0] - 24 + (s === 11 || s === 3 ? 7 : 0)), t, spb * 1.8, { type: 'triangle', vol: 0.22, bus: mb, filter: 900 });
    if (song.pad && s === 0) tones.forEach(function (n) { tone(mtof(n), t, spb * 15, { type: 'sine', vol: 0.05, a: 0.4, bus: mb, verb: true }); });
    if (!song.pad && s % 2 === 0) tone(mtof(tones[(s / 2) % 3] + 12), t, spb * 1.4, { type: 'triangle', vol: 0.045, bus: mb, filter: 2500 });  // arpeggio
    // melody: chord tones on a per-song rhythm, varied by bar so the loop doesn't drone
    var rhythm = song.lead === 'sparse' ? [0, 6, 10] : song.lead === 'bubbly' ? [0, 3, 6, 8, 11, 14] : [0, 2, 4, 7, 10, 12];
    var ri = rhythm.indexOf(s);
    if (ri >= 0) {
      var pick = [2, 1, 0, 1, 2, 1][(ri + bar) % 6], up = (bar % 2 && ri === rhythm.length - 1) ? 12 : 0;
      tone(mtof(tones[pick] + 12 + up), t, spb * (song.lead === 'sparse' ? 5 : 1.6), { type: song.lead === 'bubbly' ? 'sine' : 'square', vol: song.lead === 'bubbly' ? 0.07 : 0.035, bus: mb, filter: 3200, verb: song.lead === 'sparse' });
    }
  }
  function tick() {
    if (!ac || !song) return;
    var spb = 60 / song.bpm / 4;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;   // tab was in the background: skip missed steps, don't burst
    while (nextT < ac.currentTime + 0.12) { if (!prefs.muted) { scheduleStep(step, nextT); stats.notes++; } step++; nextT += spb; }
  }
  function startSong(name) {
    if (songTimer && song === SONGS[name]) return;           // already playing: don't restart
    pendingSong = name;
    if (!ac || ac.state !== 'running') return;               // starts on the first interaction
    stopSong(true);
    song = SONGS[name]; if (!song) return;
    step = 0; nextT = ac.currentTime + 0.08;
    songTimer = setInterval(tick, 25);
  }
  function stopSong(keepPending) { if (songTimer) clearInterval(songTimer); songTimer = null; song = null; if (!keepPending) pendingSong = null; }

  /* ---------------- mute ---------------- */
  function setMuted(m) {
    prefs.muted = !!m; savePrefs();
    if (master) master.gain.setTargetAtTime(prefs.muted ? 0 : 1, ac.currentTime, 0.02);
    buttons.forEach(paint);
  }
  function paint(b) { b.textContent = prefs.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', prefs.muted ? 'Sound off — tap to turn on' : 'Sound on — tap to mute'); b.setAttribute('aria-pressed', String(!prefs.muted)); }

  window.ArcadeAudio = {
    sfx: sfx,
    music: function (name) { if (name) startSong(name); else stopSong(); },
    toggle: function () { wake(); setMuted(!prefs.muted); return prefs.muted; },
    setMuted: setMuted,
    get muted() { return prefs.muted; },
    bindButton: function (el) { if (!el) return; buttons.push(el); paint(el); el.addEventListener('click', function (e) { e.preventDefault(); window.ArcadeAudio.toggle(); }); },
    _sfxNames: Object.keys(SFX),
    get state() { return { ctx: ac ? ac.state : 'none', song: song ? Object.keys(SONGS).find(function (k) { return SONGS[k] === song; }) : null, stats: stats }; },
  };
})();
