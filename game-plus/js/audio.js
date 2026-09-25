/* Procedural audio: every sound and the adaptive soundtrack are synthesized with Web Audio. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});

  const S = { ready: false, sfxVol: 0.8, musicVol: 0.55 };
  let ctx = null;
  let master, sfxBus, musicBus, musicFilter, verbSend, delaySend, noiseBuf;
  let lastTink = 0;

  const PENTA = [0, 2, 4, 7, 9];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  S.init = () => {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 16000;
    musicBus = ctx.createGain();
    musicBus.connect(musicFilter);
    musicFilter.connect(master);

    // Reverb from a generated impulse response.
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    verbSend = ctx.createGain();
    verbSend.gain.value = 0.32;
    verbSend.connect(verb);
    verb.connect(master);

    // Tempo-ish echo for plucks.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.28;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2600;
    delaySend = ctx.createGain();
    delaySend.gain.value = 0.5;
    delaySend.connect(delay);
    delay.connect(dlp);
    dlp.connect(fb);
    fb.connect(delay);
    dlp.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    S.ready = true;
    S.setVolumes(S.sfxVol, S.musicVol);
    if (M.wanted) M.start(M.wanted);
  };

  S.setVolumes = (sfx, music) => {
    S.sfxVol = sfx;
    S.musicVol = music;
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(sfx * sfx, t, 0.03);
    musicBus.gain.setTargetAtTime(music * music * 0.9, t, 0.05);
  };
  S.suspend = () => ctx && ctx.state === 'running' && ctx.suspend();
  S.resume = () => ctx && ctx.state === 'suspended' && ctx.resume();
  S.time = () => (ctx ? ctx.currentTime : 0);

  // ---------- building blocks ----------
  function out(dest, pan, verb, dly) {
    let node = dest || sfxBus;
    const g = ctx.createGain();
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(node);
    } else g.connect(node);
    if (verb) {
      const s = ctx.createGain();
      s.gain.value = verb;
      g.connect(s);
      s.connect(verbSend);
    }
    if (dly) {
      const s = ctx.createGain();
      s.gain.value = dly;
      g.connect(s);
      s.connect(delaySend);
    }
    return g;
  }

  function tone(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const a = o.a || 0.004;
    const d = o.d || 0.2;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || d));
    if (o.detune) osc.detune.value = o.detune;
    const g = out(o.dest, o.pan, o.verb, o.dly);
    const vol = o.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (o.hold) g.gain.setValueAtTime(vol, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (o.hold || 0) + d);
    let src = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + a + (o.hold || 0) + d);
      f.Q.value = o.q || 0.8;
      osc.connect(f);
      src = f;
    }
    src.connect(g);
    osc.start(t);
    osc.stop(t + a + (o.hold || 0) + d + 0.05);
    return osc;
  }

  function noise(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.a || 0.003) + (o.d || 0.1));
    f.Q.value = o.q || 1;
    const g = out(o.dest, o.pan, o.verb);
    const a = o.a || 0.002;
    const d = o.d || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.3, t + a);
    if (o.hold) g.gain.setValueAtTime(o.vol || 0.3, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (o.hold || 0) + d);
    src.connect(f);
    f.connect(g);
    src.start(t, Math.random() * 1.5);
    src.stop(t + a + (o.hold || 0) + d + 0.05);
  }

  function bell(f, t, d, vol, opts) {
    opts = opts || {};
    const c = ctx.createOscillator();
    c.frequency.value = f;
    const m = ctx.createOscillator();
    m.frequency.value = Math.min(18000, f * (opts.ratio || 3.51));
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * (opts.index || 2.2), t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05 + 1, t + d);
    m.connect(mg);
    mg.connect(c.frequency);
    const g = out(opts.dest, opts.pan, opts.verb === undefined ? 0.5 : opts.verb);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    c.connect(g);
    c.start(t);
    m.start(t);
    c.stop(t + d + 0.05);
    m.stop(t + d + 0.05);
  }

  function pluck(f, t, d, vol, opts) {
    opts = opts || {};
    tone({ type: 'triangle', f, t, a: 0.003, d, vol, dest: opts.dest, pan: opts.pan, verb: opts.verb, dly: opts.dly });
    tone({
      type: 'square',
      f: f * 2,
      t,
      a: 0.002,
      d: d * 0.4,
      vol: vol * 0.18,
      lp: 3200,
      lp2: 600,
      dest: opts.dest,
      pan: opts.pan,
    });
  }

  const ok = () => ctx && S.ready && ctx.state === 'running';

  // ---------- sound effects ----------
  S.tap = (combo, crit) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    const i = combo % 10;
    const n = 72 + PENTA[i % 5] + 12 * Math.floor(i / 5) + (M.key || 0);
    const f = midi(n);
    tone({ f, t, d: 0.13, vol: 0.2, pan: (Math.random() - 0.5) * 0.4 });
    tone({ type: 'triangle', f: f * 2, t, d: 0.06, vol: 0.06 });
    noise({ t, f: 5000, q: 0.7, d: 0.018, vol: 0.12, ft: 'highpass' });
    if (crit) S.crit();
  };

  S.coin = (pitch) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    const p = pitch || 1;
    tone({ type: 'square', f: 988 * p, t, d: 0.05, vol: 0.05, lp: 5000 });
    tone({ type: 'square', f: 1319 * p, t: t + 0.06, d: 0.24, vol: 0.05, lp: 5000, lp2: 1500 });
    bell(2637 * p, t + 0.06, 0.3, 0.035);
  };

  S.tink = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    if (t - lastTink < 0.035) return;
    lastTink = t;
    bell(2400 + Math.random() * 900, t, 0.12, 0.03, { verb: 0.1 });
  };

  S.crit = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone({ f: 190, f2: 42, t, d: 0.4, vol: 0.55, glide: 0.35 });
    noise({ t, f: 1400, q: 0.6, d: 0.18, vol: 0.25 });
    bell(1760, t, 0.6, 0.08);
    bell(2637, t + 0.03, 0.5, 0.05);
  };

  S.buy = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, f: 4200, ft: 'highpass', d: 0.06, vol: 0.18 });
    tone({ type: 'square', f: 180, f2: 90, t, d: 0.06, vol: 0.08, lp: 900 });
    bell(1318, t + 0.05, 0.55, 0.09);
    bell(1975, t + 0.05, 0.55, 0.07);
    bell(2637, t + 0.1, 0.45, 0.05);
  };

  S.milestone = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((s, i) => bell(midi(84 + s), t + i * 0.06, 0.5, 0.05));
  };

  S.deny = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone({ type: 'square', f: 150, t, d: 0.07, vol: 0.09, lp: 700 });
    tone({ type: 'square', f: 120, t: t + 0.09, d: 0.1, vol: 0.09, lp: 700 });
  };

  S.ui = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone({ f: 700, f2: 1050, t, d: 0.07, vol: 0.12, glide: 0.05 });
  };

  S.hover = () => {
    if (!ok()) return;
    tone({ f: 1500, t: ctx.currentTime, d: 0.025, vol: 0.025 });
  };

  S.whoosh = (up) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, f: up ? 500 : 3000, f2: up ? 3500 : 400, q: 1.4, a: 0.05, d: 0.28, vol: 0.2 });
  };

  S.arp = (notes, gap, vol, base) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    notes.forEach((s, i) => pluck(midi((base || 72) + s + (M.key || 0)), t + i * gap, 0.35, vol || 0.14, { verb: 0.3, dly: 0.2 }));
  };

  S.win = (level) => {
    if (!ok()) return;
    const seq = [0, 4, 7, 12, 16, 19, 24];
    S.arp(seq.slice(0, 3 + Math.min(4, level || 0)), 0.07, 0.13);
    const t = ctx.currentTime;
    for (let i = 0; i < 3 + (level || 0) * 2; i++) bell(2000 + Math.random() * 1600, t + 0.2 + i * 0.05, 0.25, 0.025);
  };

  function brass(notes, t, d, vol) {
    notes.forEach((n) => {
      [-8, 8].forEach((dt) =>
        tone({ type: 'sawtooth', f: midi(n + (M.key || 0)), t, a: 0.03, d, vol, detune: dt, lp: 600, lp2: 2800, q: 1.2, verb: 0.35 })
      );
    });
  }

  S.cymbal = (t, d, vol) => {
    if (!ok()) return;
    noise({ t: t || ctx.currentTime, ft: 'highpass', f: 6000, d: d || 1.4, vol: vol || 0.14, verb: 0.4 });
  };

  S.bigWin = (mega) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    M.duck(mega ? 3 : 2);
    brass([60, 64, 67], t, 0.22, 0.05);
    brass([65, 69, 72], t + 0.22, 0.22, 0.05);
    brass([67, 71, 74], t + 0.44, 0.22, 0.05);
    brass([72, 76, 79, 84], t + 0.66, mega ? 1.6 : 1, 0.055);
    S.cymbal(t + 0.66, 1.8, 0.16);
    tone({ f: 110, f2: 40, t: t + 0.66, d: 0.5, vol: 0.5 });
    for (let i = 0; i < (mega ? 30 : 14); i++) bell(1800 + Math.random() * 2400, t + 0.7 + i * 0.045, 0.3, 0.03);
  };

  S.jackpot = () => {
    if (!ok()) return;
    S.bigWin(true);
    const t = ctx.currentTime;
    const run = [0, 4, 7, 12, 7, 12, 16, 19, 24, 28, 31, 36];
    run.forEach((s, i) => bell(midi(72 + s), t + 1.2 + i * 0.07, 0.8, 0.06));
    brass([60, 64, 67, 72], t + 2.1, 1.8, 0.05);
    S.cymbal(t + 2.1, 2.5, 0.18);
  };

  S.lose = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone({ type: 'sawtooth', f: midi(55), f2: midi(54), t, a: 0.02, d: 0.22, vol: 0.07, lp: 900, glide: 0.2 });
    tone({ type: 'sawtooth', f: midi(53), f2: midi(49), t: t + 0.24, a: 0.02, d: 0.5, vol: 0.07, lp: 900, lp2: 300, glide: 0.45 });
  };

  S.tick = (pitch) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, f: 2600 * (pitch || 1), q: 3, d: 0.012, vol: 0.2 });
    tone({ f: 1800 * (pitch || 1), t, d: 0.015, vol: 0.04 });
  };

  S.reelStop = (i) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone({ f: 130, f2: 55, t, d: 0.14, vol: 0.35, pan: (i - 1) * 0.4 });
    noise({ t, f: 1800, q: 1.5, d: 0.03, vol: 0.18, pan: (i - 1) * 0.4 });
  };

  S.lever = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 7; i++) noise({ t: t + i * 0.028, f: 3000 - i * 200, q: 4, d: 0.012, vol: 0.18 });
    noise({ t: t + 0.2, f: 800, f2: 200, q: 1, d: 0.15, vol: 0.2 });
    tone({ f: 90, f2: 50, t: t + 0.2, d: 0.2, vol: 0.3 });
  };

  let tensionNodes = null;
  S.tension = (on) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    if (on && !tensionNodes) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(440, t + 2.5);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + 2.5);
      const g = out(sfxBus, 0, 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.3);
      const trem = ctx.createGain();
      trem.gain.value = 0.5;
      lfo.connect(lg);
      lg.connect(trem.gain);
      o.connect(f);
      f.connect(trem);
      trem.connect(g);
      o.start(t);
      lfo.start(t);
      tensionNodes = { o, lfo, g };
    } else if (!on && tensionNodes) {
      const n = tensionNodes;
      tensionNodes = null;
      n.g.gain.cancelScheduledValues(t);
      n.g.gain.setTargetAtTime(0.0001, t, 0.05);
      n.o.stop(t + 0.3);
      n.lfo.stop(t + 0.3);
    }
  };

  S.peg = (row, pan) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = 96 - PENTA[row % 5] - 12 * Math.floor(row / 5) + (M.key || 0);
    tone({ f: midi(n), t, d: 0.08, vol: 0.07, pan });
    tone({ type: 'triangle', f: midi(n) * 3, t, d: 0.03, vol: 0.02, pan });
  };

  S.land = (mult, pan) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    if (mult >= 1) {
      pluck(midi(67 + Math.min(24, Math.round(Math.log2(mult + 1) * 5)) + (M.key || 0)), t, 0.4, 0.14, { pan, verb: 0.3 });
      if (mult >= 3) S.coin(1 + Math.min(1, mult / 25));
    } else {
      tone({ type: 'triangle', f: 180, f2: 120, t, d: 0.18, vol: 0.12, pan });
    }
  };

  S.toss = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    bell(3136, t, 0.35, 0.06);
    noise({ t, f: 600, f2: 2800, q: 1.2, a: 0.05, d: 0.3, vol: 0.12 });
    for (let i = 0; i < 10; i++) tone({ f: 5200, t: t + 0.08 + i * 0.075, d: 0.012, vol: 0.02 + i * 0.002 });
  };

  S.clink = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    bell(2349, t, 0.3, 0.1, { verb: 0.2 });
    bell(3520, t + 0.09, 0.25, 0.06, { verb: 0.2 });
    bell(2794, t + 0.16, 0.3, 0.04, { verb: 0.2 });
    tone({ f: 200, f2: 90, t, d: 0.08, vol: 0.2 });
  };

  S.engine = () => {
    if (!ok()) return { set() {}, stop() {} };
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300;
    f.Q.value = 2;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 48;
    const of = ctx.createBiquadFilter();
    of.type = 'lowpass';
    of.frequency.value = 260;
    const g = out(sfxBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.4);
    const og = ctx.createGain();
    og.gain.value = 0.5;
    src.connect(f);
    f.connect(g);
    o.connect(of);
    of.connect(og);
    og.connect(g);
    src.start(t);
    o.start(t);
    return {
      set(m) {
        const now = ctx.currentTime;
        const k = Math.min(1, Math.log10(m) / 2);
        f.frequency.setTargetAtTime(300 + k * 2600, now, 0.1);
        o.frequency.setTargetAtTime(48 + k * 90, now, 0.1);
        g.gain.setTargetAtTime(0.2 + k * 0.12, now, 0.1);
      },
      stop(fade) {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0.0001, now, fade || 0.05);
        src.stop(now + 1);
        o.stop(now + 1);
      },
    };
  };

  S.explode = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, ft: 'lowpass', f: 2400, f2: 90, q: 0.5, d: 1.3, vol: 0.7, verb: 0.3 });
    tone({ f: 80, f2: 28, t, d: 0.9, vol: 0.7 });
    noise({ t: t + 0.05, ft: 'highpass', f: 3000, d: 0.5, vol: 0.12 });
  };

  S.cashout = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, f: 4200, ft: 'highpass', d: 0.05, vol: 0.18 });
    [0, 4, 7, 12].forEach((s, i) => bell(midi(79 + s), t + i * 0.05, 0.6, 0.07));
    for (let i = 0; i < 12; i++) bell(2000 + Math.random() * 2000, t + 0.15 + i * 0.04, 0.2, 0.025);
  };

  S.coinRain = (dur) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = Math.floor((dur || 1.5) * 22);
    for (let i = 0; i < n; i++) bell(2200 + Math.random() * 2200, t + Math.random() * (dur || 1.5), 0.18, 0.02 + Math.random() * 0.02, { verb: 0.25, pan: Math.random() - 0.5 });
  };

  S.feverOn = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, f: 300, f2: 6000, q: 2, a: 0.4, d: 0.2, vol: 0.2 });
    tone({ type: 'sawtooth', f: 110, f2: 880, t, a: 0.4, d: 0.15, vol: 0.06, lp: 3000, glide: 0.45 });
    S.arp([0, 7, 12, 16, 19, 24], 0.05, 0.12, 72);
    S.cymbal(t + 0.45, 1.2, 0.12);
  };

  S.golden = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    [0, 7, 12, 19, 24].forEach((s, i) => bell(midi(84 + s), t + i * 0.08, 0.7, 0.035, { verb: 0.6 }));
  };

  S.goldenGrab = () => {
    if (!ok()) return;
    S.cashout();
    S.coinRain(1);
  };

  S.door = (open) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, f: open ? 400 : 700, f2: open ? 900 : 300, q: 0.7, a: 0.1, hold: 0.35, d: 0.2, vol: 0.12 });
    tone({ f: 70, f2: 50, t: t + 0.55, d: 0.25, vol: 0.35 });
    noise({ t: t + 0.55, f: 900, q: 3, d: 0.06, vol: 0.2 });
  };

  S.ding = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    bell(midi(88), t, 1.6, 0.12, { ratio: 2.0, index: 1.2, verb: 0.6 });
    bell(midi(84), t + 0.35, 2.0, 0.12, { ratio: 2.0, index: 1.2, verb: 0.6 });
  };

  S.levelUp = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    M.duck(2.5);
    noise({ t, f: 300, f2: 7000, q: 1.5, a: 0.6, d: 0.3, vol: 0.18 });
    brass([60, 67, 72, 76], t + 0.6, 1.4, 0.05);
    S.cymbal(t + 0.6, 2, 0.15);
    tone({ f: 120, f2: 40, t: t + 0.6, d: 0.6, vol: 0.55 });
    [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => bell(midi(84 + s), t + 0.7 + i * 0.06, 0.8, 0.04));
  };

  S.clunk = (big) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone({ f: big ? 90 : 140, f2: 35, t, d: 0.5, vol: 0.6 });
    noise({ t, ft: 'lowpass', f: 1500, f2: 100, d: 0.5, vol: 0.45, verb: 0.3 });
    [180, 410, 730].forEach((f) => noise({ t, f, q: 25, d: 0.9, vol: 0.25, verb: 0.3 }));
    for (let i = 0; i < 5; i++) noise({ t: t + 0.15 + i * 0.05, f: 2500, q: 5, d: 0.012, vol: 0.12 });
  };

  S.rumble = (dur) => {
    if (!ok()) return;
    const t = ctx.currentTime;
    noise({ t, ft: 'lowpass', f: 80, f2: 400, q: 1, a: dur * 0.8, d: dur * 0.2, vol: 0.5 });
    tone({ type: 'sawtooth', f: 40, f2: 70, t, a: dur * 0.8, d: dur * 0.2, vol: 0.12, lp: 200 });
    tone({ type: 'sawtooth', f: 220, f2: 180, t: t + 0.3, a: 0.4, hold: dur * 0.5, d: 0.5, vol: 0.03, lp: 1200, q: 8 });
  };

  S.choir = () => {
    if (!ok()) return;
    const t = ctx.currentTime;
    [48, 55, 60, 64, 67, 72, 76].forEach((n) => {
      [-12, 0, 12].forEach((dt) =>
        tone({ type: 'sawtooth', f: midi(n), t, a: 1.2, hold: 2.5, d: 3, vol: 0.018, detune: dt, lp: 1800, verb: 0.8 })
      );
    });
    S.cymbal(t, 3.5, 0.18);
    for (let i = 0; i < 40; i++) bell(midi(79 + PENTA[i % 5] + 12 * (i % 2)), t + 0.3 + i * 0.09, 1.2, 0.03, { verb: 0.7 });
  };

  // ---------- music ----------
  const PROGS = {
    main: [
      { root: 45, chord: [57, 60, 64, 67] },
      { root: 41, chord: [57, 60, 64, 65] },
      { root: 48, chord: [55, 60, 64, 67] },
      { root: 43, chord: [55, 59, 62, 67] },
    ],
    vault: [
      { root: 45, chord: [57, 60, 64, 69] },
      { root: 50, chord: [57, 62, 65, 69] },
      { root: 46, chord: [58, 62, 65, 70] },
      { root: 52, chord: [56, 59, 64, 68] },
    ],
    title: [
      { root: 45, chord: [57, 60, 64, 71] },
      { root: 41, chord: [57, 60, 64, 67] },
      { root: 50, chord: [57, 62, 65, 69] },
      { root: 52, chord: [56, 59, 62, 64] },
    ],
  };
  const BASS = [
    [0, 0, 3],
    [3, 12, 1],
    [6, 0, 2],
    [8, 0, 3],
    [11, 7, 1],
    [14, 12, 2],
  ];

  const M = { on: false, energy: 0, step: 0, next: 0, bpm: 100, key: 0, prog: 'main', timer: null, wanted: null, fever: false };
  S.music = M;

  M.start = (prog) => {
    M.wanted = prog || 'main';
    if (!ctx) return;
    M.prog = M.wanted;
    M.bpm = M.prog === 'title' ? 82 : M.prog === 'vault' ? 96 : 104;
    if (M.on) return;
    M.on = true;
    M.step = 0;
    M.next = ctx.currentTime + 0.1;
    M.timer = setInterval(M.schedule, 25);
  };
  M.stop = () => {
    M.on = false;
    M.wanted = null;
    clearInterval(M.timer);
  };
  M.setEnergy = (e) => (M.energy = e);
  M.setKey = (k) => (M.key = k);
  M.setFever = (f) => {
    M.fever = f;
    if (!ctx) return;
    musicFilter.frequency.setTargetAtTime(f ? 18000 : 16000, ctx.currentTime, 0.2);
  };
  M.duck = (sec) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicFilter.frequency.cancelScheduledValues(t);
    musicFilter.frequency.setTargetAtTime(500, t, 0.05);
    musicFilter.frequency.setTargetAtTime(16000, t + sec, 0.6);
  };
  M.muffle = (on) => {
    if (!ctx) return;
    musicFilter.frequency.setTargetAtTime(on ? 700 : 16000, ctx.currentTime, 0.25);
  };

  M.schedule = () => {
    if (!M.on || !ctx || ctx.state !== 'running') return;
    const spb = 60 / M.bpm / 4;
    // Skip ahead if we fell behind (e.g. after the tab was hidden).
    if (M.next < ctx.currentTime - 0.2) M.next = ctx.currentTime + 0.05;
    while (M.next < ctx.currentTime + 0.12) {
      M.play(M.step, M.next, spb);
      M.next += spb;
      M.step++;
    }
  };

  M.play = (step, t, spb) => {
    const prog = PROGS[M.prog] || PROGS.main;
    const bar = Math.floor(step / 16) % prog.length;
    const s = step % 16;
    const ch = prog[bar];
    const k = M.key;
    const e = M.fever ? 4 : M.energy;
    const title = M.prog === 'title';
    const dest = musicBus;

    // Pad
    if (s === 0) {
      ch.chord.forEach((n, i) => {
        [-7, 7].forEach((dt) =>
          tone({
            type: 'sawtooth',
            f: midi(n + k),
            t,
            a: 0.6,
            hold: spb * 16 - 1.1,
            d: 0.9,
            vol: 0.022,
            detune: dt + i,
            lp: title ? 900 : 1300 + e * 250,
            dest,
            verb: 0.6,
          })
        );
      });
    }
    // Kick
    if (!title && (s === 0 || s === 8 || (e >= 3 && s === 10))) {
      tone({ f: 140, f2: 42, t, d: 0.28, vol: 0.55, glide: 0.12, dest });
      tone({ type: 'triangle', f: 1200, f2: 200, t, d: 0.02, vol: 0.05, dest });
    }
    if (title && s === 0 && bar % 2 === 0) tone({ f: 90, f2: 40, t, d: 0.5, vol: 0.25, glide: 0.3, dest });
    // Clap
    if (e >= 2 && !title && (s === 4 || s === 12)) {
      noise({ t, f: 1500, q: 0.8, d: 0.14, vol: 0.14, dest, verb: 0.3 });
      noise({ t: t + 0.012, f: 1100, q: 0.8, d: 0.1, vol: 0.08, dest });
    }
    // Hats
    if (e >= 1 && !title) {
      if (s % 2 === 0 || e >= 4) {
        const accent = s % 4 === 2;
        noise({ t, ft: 'highpass', f: 7500, d: accent ? 0.05 : 0.025, vol: accent ? 0.06 : 0.03, dest, pan: 0.2 });
      }
    }
    // Bass
    if (!title || s === 0) {
      for (const [st, iv, len] of BASS) {
        if (st !== s) continue;
        if (title && st !== 0) continue;
        const n = ch.root + iv + k;
        tone({
          type: 'sawtooth',
          f: midi(n),
          t,
          a: 0.01,
          hold: spb * len * 0.6,
          d: title ? 1.5 : spb * len,
          vol: title ? 0.12 : 0.16,
          lp: 260 + e * 60,
          lp2: 120,
          q: 3,
          dest,
        });
        tone({ f: midi(n - 12), t, a: 0.01, d: spb * len * 1.1, vol: 0.22, dest });
      }
    }
    // Arp
    if ((e >= 2 || title) && s % (title ? 4 : 2) === 0 && !(e < 3 && s % 4 === 2 && !title)) {
      const tones = ch.chord.concat(ch.chord.map((n) => n + 12));
      const pat = [0, 2, 1, 3, 4, 2, 5, 3];
      const n = tones[pat[(s / 2) % 8]] + 12 + k;
      pluck(midi(n), t, title ? 0.8 : 0.25, title ? 0.03 : 0.045, { dest, pan: Math.sin(step) * 0.4, verb: 0.4, dly: 0.35 });
    }
    // Lead sparkle in fever
    if (e >= 4 && s % 2 === 1 && Math.random() < 0.5) {
      const n = 84 + PENTA[Math.floor(Math.random() * 5)] + k;
      bell(midi(n), t, 0.25, 0.025, { dest, verb: 0.4 });
    }
  };

  A.audio = S;
  A.sfx = S;
})();
