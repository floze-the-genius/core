/* Tone.js audio engine: same API as audio.js, richer instruments, real effects and a
   Transport-driven adaptive soundtrack. If Tone.js failed to load, audio.js stays in charge. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const T = window.Tone;
  if (!T) return;

  const S = { ready: false, sfxVol: 0.8, musicVol: 0.55, tone: true };
  const PENTA = [0, 2, 4, 7, 9];
  const hz = (m) => T.Frequency(m, 'midi').toFrequency();
  const R = (a, b) => a + Math.random() * (b - a);

  let n = null; // node graph, built on first gesture
  let lastTink = 0;
  const lastAt = new Map();
  // Monophonic Tone instruments need strictly increasing start times.
  const at = (inst, t) => {
    const prev = lastAt.get(inst) || 0;
    const time = Math.max(t, prev + 0.002);
    lastAt.set(inst, time);
    return time;
  };
  const now = () => T.immediate();

  function build() {
    const limiter = new T.Limiter(-1).toDestination();
    const comp = new T.Compressor({ threshold: -16, ratio: 3, attack: 0.004, release: 0.2 }).connect(limiter);
    const reverb = new T.Reverb({ decay: 3.2, preDelay: 0.02, wet: 1 }).connect(comp);
    const delay = new T.PingPongDelay({ delayTime: 0.27, feedback: 0.32, wet: 1 }).connect(comp);
    const sfx = new T.Volume(0).connect(comp);
    const sfxVerb = new T.Gain(0.22).connect(reverb);
    sfx.connect(sfxVerb);
    const musicFilter = new T.Filter(18000, 'lowpass').connect(comp);
    const music = new T.Volume(-4).connect(musicFilter);
    const musicVerb = new T.Gain(0.35).connect(reverb);
    music.connect(musicVerb);
    const toDelay = new T.Gain(0.3).connect(delay);

    const g = { limiter, comp, reverb, delay, sfx, music, musicFilter, toDelay };

    // ---- sfx instruments ----
    g.tap = new T.PolySynth(T.FMSynth, {
      maxPolyphony: 48,
      harmonicity: 2,
      modulationIndex: 2.5,
      envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.12 },
      modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 },
      volume: -9,
    }).connect(sfx);
    g.bell = new T.PolySynth(T.FMSynth, {
      maxPolyphony: 128,
      harmonicity: 3.01,
      modulationIndex: 12,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 0.6 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 },
      volume: -16,
    }).connect(sfx);
    g.metal = new T.MetalSynth({
      envelope: { attack: 0.001, decay: 0.28, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4200,
      octaves: 1.5,
      volume: -24,
    }).connect(sfx);
    g.thud = new T.MembraneSynth({ pitchDecay: 0.06, octaves: 5, envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.2 }, volume: -5 }).connect(sfx);
    g.noiseF = new T.Filter(2000, 'bandpass').connect(sfx);
    g.noise = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }, volume: -10 }).connect(g.noiseF);
    g.clickF = new T.Filter({ frequency: 2600, type: 'bandpass', Q: 3 }).connect(sfx);
    g.click = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.014, sustain: 0, release: 0.01 }, volume: -8 }).connect(g.clickF);
    g.hissF = new T.Filter(6500, 'highpass').connect(sfx);
    g.hiss = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 0.4 }, volume: -20 }).connect(g.hissF);
    g.brassF = new T.Filter(2600, 'lowpass').connect(sfx);
    g.brass = new T.PolySynth(T.Synth, {
      maxPolyphony: 40,
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.03, decay: 0.2, sustain: 0.55, release: 0.7 },
      volume: -24,
    }).connect(g.brassF);
    g.pluck = new T.PolySynth(T.Synth, {
      maxPolyphony: 48,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.3 },
      volume: -11,
    }).connect(sfx);
    g.pluck.connect(toDelay);
    g.sad = new T.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass' },
      filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.3, baseFrequency: 300, octaves: 1.5 },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.3 },
      volume: -22,
    }).connect(sfx);
    g.choir = new T.PolySynth(T.AMSynth, {
      maxPolyphony: 24,
      harmonicity: 1.5,
      envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 3 },
      volume: -26,
    }).connect(reverb);

    // ---- band ----
    g.padF = new T.Filter(1400, 'lowpass').connect(music);
    g.chorus = new T.Chorus(2.2, 3.5, 0.6).start().connect(g.padF);
    g.pad = new T.PolySynth(T.Synth, {
      maxPolyphony: 16,
      oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
      envelope: { attack: 0.7, decay: 0.5, sustain: 0.7, release: 1.4 },
      volume: -27,
    }).connect(g.chorus);
    g.bass = new T.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 3, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.005, decay: 0.22, sustain: 0.25, baseFrequency: 70, octaves: 2.6 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.2 },
      volume: -13,
    }).connect(music);
    g.kick = new T.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.34, sustain: 0 }, volume: -7 }).connect(music);
    g.clapF = new T.Filter(1600, 'bandpass').connect(music);
    g.clap = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -17 }).connect(g.clapF);
    g.hat = new T.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 7200,
      octaves: 1.5,
      volume: -36,
    }).connect(music);
    g.arp = new T.PolySynth(T.FMSynth, {
      maxPolyphony: 16,
      harmonicity: 2,
      modulationIndex: 4,
      envelope: { attack: 0.004, decay: 0.3, sustain: 0, release: 0.3 },
      modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
      volume: -22,
    }).connect(music);
    g.arp.connect(toDelay);
    g.lead = new T.PolySynth(T.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 10,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
      volume: -24,
    }).connect(music);
    return g;
  }

  S.init = () => {
    if (n) {
      T.start();
      return;
    }
    try {
      T.getContext().lookAhead = 0.04;
      T.start();
      n = build();
      S.ready = true;
      S.setVolumes(S.sfxVol, S.musicVol);
      if (M.wanted) M.start(M.wanted);
    } catch (e) {
      console.warn('Tone audio unavailable', e);
    }
  };
  S.setVolumes = (sfx, music) => {
    S.sfxVol = sfx;
    S.musicVol = music;
    if (!n) return;
    n.sfx.mute = sfx <= 0.001;
    n.music.mute = music <= 0.001;
    n.sfx.volume.rampTo(T.gainToDb(Math.max(0.0001, sfx * sfx)), 0.05);
    n.music.volume.rampTo(T.gainToDb(Math.max(0.0001, music * music * 0.9)) - 2, 0.05);
  };
  S.suspend = () => {
    const c = T.getContext().rawContext;
    if (c && c.state === 'running') c.suspend();
  };
  S.resume = () => {
    const c = T.getContext().rawContext;
    if (c && c.state === 'suspended') c.resume();
  };
  S.time = () => T.getContext().currentTime;
  const ok = () => n && T.getContext().state === 'running';

  // Bell sparkles fire in real time so they never reserve voices far ahead.
  const ring = (f, delay, dur, vel) => {
    const go = () => ok() && n.bell.triggerAttackRelease(f, dur || 0.8, now(), vel === undefined ? 0.6 : vel);
    if (delay <= 0.02) go();
    else setTimeout(go, delay * 1000);
  };
  const pl = (m, t, dur, vel) => n.pluck.triggerAttackRelease(hz(m + (M.key || 0)), dur || 0.3, t, vel === undefined ? 0.7 : vel);
  function sweep(filter, from, to, t, d) {
    filter.frequency.cancelScheduledValues(t);
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + d);
  }

  // ---------- effects ----------
  S.tap = (combo, crit) => {
    if (!ok()) return;
    const t = now();
    const i = combo % 10;
    const m = 72 + PENTA[i % 5] + 12 * Math.floor(i / 5) + (M.key || 0);
    n.tap.triggerAttackRelease(hz(m), 0.12, t, 0.7);
    n.click.triggerAttackRelease(0.02, at(n.click, t), 0.5);
    if (crit) S.crit();
  };
  S.coin = (pitch) => {
    if (!ok()) return;
    const t = now();
    const p = pitch || 1;
    n.pluck.triggerAttackRelease(988 * p, 0.06, t, 0.6);
    n.pluck.triggerAttackRelease(1319 * p, 0.25, t + 0.06, 0.6);
    ring(2637 * p, 0.06, 0.3, 0.25);
  };
  S.tink = () => {
    if (!ok()) return;
    const t = now();
    if (t - lastTink < 0.035) return;
    lastTink = t;
    ring(R(2400, 3300), 0, 0.15, 0.18);
  };
  S.crit = () => {
    if (!ok()) return;
    const t = now();
    n.thud.triggerAttackRelease('C1', 0.4, at(n.thud, t), 1);
    n.metal.triggerAttackRelease(420, 0.3, at(n.metal, t), 0.6);
    ring(hz(93), 0, 0.6, 0.5);
    ring(hz(100), 0.03, 0.5, 0.4);
  };
  S.buy = () => {
    if (!ok()) return;
    const t = now();
    n.click.triggerAttackRelease(0.03, at(n.click, t), 0.8);
    n.thud.triggerAttackRelease('G2', 0.08, at(n.thud, t), 0.35);
    ring(hz(88), 0.05, 0.6, 0.55);
    ring(hz(95), 0.05, 0.6, 0.45);
    ring(hz(100), 0.1, 0.5, 0.35);
  };
  S.milestone = () => {
    if (!ok()) return;
    const t = now();
    [0, 4, 7, 12, 16].forEach((s, i) => ring(hz(84 + s), i * 0.06, 0.6, 0.4));
  };
  S.deny = () => {
    if (!ok()) return;
    const t = now();
    n.sad.triggerAttackRelease(hz(40), 0.07, at(n.sad, t), 0.6);
    n.sad.triggerAttackRelease(hz(37), 0.1, at(n.sad, t + 0.09), 0.6);
  };
  S.ui = () => {
    if (!ok()) return;
    const t = now();
    n.tap.triggerAttackRelease(hz(81), 0.06, t, 0.35);
    n.tap.triggerAttackRelease(hz(88), 0.06, t + 0.04, 0.3);
  };
  S.hover = () => {
    if (!ok()) return;
    n.click.triggerAttackRelease(0.01, at(n.click, now()), 0.15);
  };
  S.whoosh = (up) => {
    if (!ok()) return;
    const t = at(n.noise, now());
    sweep(n.noiseF, up ? 400 : 3500, up ? 4000 : 350, t, 0.3);
    n.noise.triggerAttackRelease(0.3, t, 0.8);
  };
  S.arp = (notes, gap, vol, base) => {
    if (!ok()) return;
    const t = now();
    notes.forEach((s, i) => pl((base || 72) + s, t + i * gap, 0.35, Math.min(1, (vol || 0.14) * 5)));
  };
  S.win = (level) => {
    if (!ok()) return;
    const seq = [0, 4, 7, 12, 16, 19, 24];
    S.arp(seq.slice(0, 3 + Math.min(4, level || 0)), 0.07, 0.14);
    const t = now();
    for (let i = 0; i < 3 + (level || 0) * 2; i++) ring(R(2000, 3600), 0.2 + i * 0.05, 0.25, 0.15);
  };
  function brass(notes, t, d) {
    n.brassF.frequency.cancelScheduledValues(t);
    n.brassF.frequency.setValueAtTime(700, t);
    n.brassF.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
    n.brass.triggerAttackRelease(notes.map((m) => hz(m + (M.key || 0))), d, t, 0.8);
  }
  S.cymbal = (t, d, vol) => {
    if (!ok()) return;
    n.hiss.envelope.decay = d || 1.4;
    n.hiss.triggerAttackRelease(0.02, at(n.hiss, t || now()), Math.min(1, (vol || 0.14) * 6));
  };
  S.bigWin = (mega) => {
    if (!ok()) return;
    const t = now();
    M.duck(mega ? 3 : 2);
    brass([60, 64, 67], t, 0.2);
    brass([65, 69, 72], t + 0.22, 0.2);
    brass([67, 71, 74], t + 0.44, 0.2);
    brass([72, 76, 79, 84], t + 0.66, mega ? 1.5 : 0.9);
    S.cymbal(t + 0.66, 1.8, 0.16);
    n.thud.triggerAttackRelease('A0', 0.6, at(n.thud, t + 0.66), 1);
    for (let i = 0; i < (mega ? 30 : 14); i++) ring(R(1800, 4200), 0.7 + i * 0.045, 0.3, 0.18);
  };
  S.jackpot = () => {
    if (!ok()) return;
    S.bigWin(true);
    const t = now();
    [0, 4, 7, 12, 7, 12, 16, 19, 24, 28, 31, 36].forEach((s, i) => ring(hz(72 + s), 1.2 + i * 0.07, 0.8, 0.4));
    brass([60, 64, 67, 72], t + 2.1, 1.8);
    S.cymbal(t + 2.1, 2.5, 0.18);
  };
  S.lose = () => {
    if (!ok()) return;
    const t = at(n.sad, now());
    n.sad.triggerAttackRelease(hz(55), 0.22, t, 0.8);
    n.sad.frequency.setValueAtTime(hz(55), t);
    n.sad.frequency.exponentialRampToValueAtTime(hz(54), t + 0.2);
    n.sad.triggerAttackRelease(hz(53), 0.45, at(n.sad, t + 0.25), 0.8);
    n.sad.frequency.exponentialRampToValueAtTime(hz(48), t + 0.7);
  };
  S.tick = (pitch) => {
    if (!ok()) return;
    const t = at(n.click, now());
    n.clickF.frequency.setValueAtTime(2600 * (pitch || 1), t);
    n.click.triggerAttackRelease(0.015, t, 0.7);
  };
  S.reelStop = (i) => {
    if (!ok()) return;
    const t = now();
    n.thud.triggerAttackRelease(hz(36 + i * 2), 0.15, at(n.thud, t), 0.8);
    n.click.triggerAttackRelease(0.03, at(n.click, t), 0.6);
  };
  S.lever = () => {
    if (!ok()) return;
    const t = now();
    for (let i = 0; i < 7; i++) n.click.triggerAttackRelease(0.01, at(n.click, t + i * 0.028), 0.5);
    n.thud.triggerAttackRelease('D2', 0.2, at(n.thud, t + 0.2), 0.7);
  };
  let tensionNodes = null;
  S.tension = (on) => {
    if (!ok()) return;
    if (on && !tensionNodes) {
      const osc = new T.Oscillator(110, 'sawtooth');
      const f = new T.Filter(400, 'lowpass');
      const trem = new T.Tremolo(9, 0.6).start();
      const gain = new T.Gain(0).connect(n.sfx);
      osc.chain(f, trem, gain);
      osc.start();
      osc.frequency.exponentialRampTo(440, 2.5);
      f.frequency.exponentialRampTo(2400, 2.5);
      gain.gain.rampTo(0.09, 0.3);
      tensionNodes = { osc, f, trem, gain };
    } else if (!on && tensionNodes) {
      const tn = tensionNodes;
      tensionNodes = null;
      tn.gain.gain.rampTo(0, 0.08);
      setTimeout(() => {
        tn.osc.stop();
        [tn.osc, tn.f, tn.trem, tn.gain].forEach((x) => x.dispose());
      }, 300);
    }
  };
  S.peg = (row, pan) => {
    if (!ok()) return;
    const m = 96 - PENTA[row % 5] - 12 * Math.floor(row / 5) + (M.key || 0);
    n.tap.triggerAttackRelease(hz(m), 0.06, now(), 0.35);
  };
  S.land = (mult) => {
    if (!ok()) return;
    const t = now();
    if (mult >= 1) {
      pl(67 + Math.min(24, Math.round(Math.log2(mult + 1) * 5)), t, 0.4, 0.8);
      if (mult >= 3) S.coin(1 + Math.min(1, mult / 25));
    } else n.thud.triggerAttackRelease('E2', 0.18, at(n.thud, t), 0.35);
  };
  S.toss = () => {
    if (!ok()) return;
    const t = now();
    n.metal.triggerAttackRelease(700, 0.2, at(n.metal, t), 0.5);
    S.whoosh(true);
    for (let i = 0; i < 10; i++) ring(5200, 0.08 + i * 0.075, 0.02, 0.05 + i * 0.01);
  };
  S.clink = () => {
    if (!ok()) return;
    const t = now();
    n.metal.triggerAttackRelease(520, 0.25, at(n.metal, t), 0.9);
    n.metal.triggerAttackRelease(880, 0.2, at(n.metal, t + 0.09), 0.6);
    n.metal.triggerAttackRelease(640, 0.2, at(n.metal, t + 0.16), 0.4);
    n.thud.triggerAttackRelease('G2', 0.08, at(n.thud, t), 0.4);
  };
  S.engine = () => {
    if (!ok()) return { set() {}, stop() {} };
    const noise = new T.Noise('brown');
    const f = new T.Filter(300, 'lowpass');
    const osc = new T.Oscillator(46, 'sawtooth');
    const of = new T.Filter(240, 'lowpass');
    const gain = new T.Gain(0).connect(n.sfx);
    noise.chain(f, gain);
    osc.chain(of, gain);
    noise.start();
    osc.start();
    gain.gain.rampTo(0.5, 0.4);
    return {
      set(m) {
        const k = Math.min(1, Math.log10(m) / 2);
        f.frequency.rampTo(300 + k * 2600, 0.1);
        osc.frequency.rampTo(46 + k * 90, 0.1);
        gain.gain.rampTo(0.45 + k * 0.3, 0.1);
      },
      stop(fade) {
        gain.gain.rampTo(0, fade || 0.05);
        setTimeout(() => {
          noise.stop();
          osc.stop();
          [noise, f, osc, of, gain].forEach((x) => x.dispose());
        }, 600);
      },
    };
  };
  S.explode = () => {
    if (!ok()) return;
    const t = at(n.noise, now());
    sweep(n.noiseF, 2400, 90, t, 1.2);
    n.noise.envelope.decay = 1.2;
    n.noise.triggerAttackRelease(1.2, t, 1);
    setTimeout(() => (n.noise.envelope.decay = 0.2), 1400);
    n.thud.triggerAttackRelease('F0', 0.9, at(n.thud, t), 1);
    S.cymbal(t + 0.05, 0.6, 0.12);
  };
  S.cashout = () => {
    if (!ok()) return;
    const t = now();
    n.click.triggerAttackRelease(0.04, at(n.click, t), 0.8);
    [0, 4, 7, 12].forEach((s, i) => ring(hz(79 + s), i * 0.05, 0.6, 0.45));
    for (let i = 0; i < 12; i++) ring(R(2000, 4000), 0.15 + i * 0.04, 0.2, 0.15);
  };
  S.coinRain = (dur) => {
    if (!ok()) return;
    const t = now();
    const d = dur || 1.5;
    for (let i = 0; i < Math.floor(d * 12); i++) ring(R(2200, 4400), Math.random() * d, 0.18, R(0.08, 0.2));
  };
  S.feverOn = () => {
    if (!ok()) return;
    const t = at(n.noise, now());
    sweep(n.noiseF, 300, 6000, t, 0.45);
    n.noise.triggerAttackRelease(0.5, t, 0.9);
    S.arp([0, 7, 12, 16, 19, 24], 0.05, 0.14, 72);
    S.cymbal(t + 0.45, 1.2, 0.12);
  };
  S.golden = () => {
    if (!ok()) return;
    const t = now();
    [0, 7, 12, 19, 24].forEach((s, i) => ring(hz(84 + s), i * 0.08, 0.8, 0.25));
  };
  S.goldenGrab = () => {
    if (!ok()) return;
    S.cashout();
    S.coinRain(1);
  };
  S.door = (open) => {
    if (!ok()) return;
    const t = at(n.noise, now());
    sweep(n.noiseF, open ? 400 : 700, open ? 900 : 300, t, 0.55);
    n.noise.triggerAttackRelease(0.55, t, 0.6);
    n.thud.triggerAttackRelease('C2', 0.25, at(n.thud, t + 0.55), 0.8);
  };
  S.ding = () => {
    if (!ok()) return;
    const t = now();
    ring(hz(88), 0, 1.6, 0.8);
    ring(hz(84), 0.35, 2, 0.8);
  };
  S.levelUp = () => {
    if (!ok()) return;
    const t = now();
    M.duck(2.5);
    const tn = at(n.noise, t);
    sweep(n.noiseF, 300, 7000, tn, 0.6);
    n.noise.triggerAttackRelease(0.6, tn, 0.8);
    brass([60, 67, 72, 76], t + 0.6, 1.3);
    S.cymbal(t + 0.6, 2, 0.15);
    n.thud.triggerAttackRelease('B0', 0.6, at(n.thud, t + 0.6), 1);
    [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => ring(hz(84 + s), 0.7 + i * 0.06, 0.8, 0.3));
  };
  S.clunk = (big) => {
    if (!ok()) return;
    const t = now();
    n.thud.triggerAttackRelease(big ? 'F#0' : 'C#1', 0.5, at(n.thud, t), 1);
    n.metal.triggerAttackRelease(180, 0.9, at(n.metal, t), 1);
    for (let i = 0; i < 5; i++) n.click.triggerAttackRelease(0.012, at(n.click, t + 0.15 + i * 0.05), 0.5);
  };
  S.rumble = (dur) => {
    if (!ok()) return;
    const noise = new T.Noise('brown');
    const f = new T.Filter(80, 'lowpass');
    const gain = new T.Gain(0).connect(n.sfx);
    noise.chain(f, gain);
    noise.start();
    gain.gain.rampTo(0.9, dur * 0.8);
    f.frequency.exponentialRampTo(420, dur * 0.8);
    setTimeout(() => gain.gain.rampTo(0, 0.4), dur * 800);
    setTimeout(() => {
      noise.stop();
      [noise, f, gain].forEach((x) => x.dispose());
    }, dur * 1000 + 800);
  };
  S.choir = () => {
    if (!ok()) return;
    const t = now();
    n.choir.triggerAttackRelease([48, 55, 60, 64, 67, 72, 76].map(hz), 3.2, t, 0.8);
    S.cymbal(t, 3.5, 0.18);
    for (let i = 0; i < 24; i++) ring(hz(79 + PENTA[i % 5] + 12 * (i % 2)), 0.3 + i * 0.14, 1.2, 0.25);
  };

  // ---------- adaptive soundtrack on the Transport ----------
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
  const M = { on: false, energy: 0, key: 0, prog: 'main', wanted: null, fever: false, step: 0, loop: null };
  S.music = M;

  M.start = (prog) => {
    M.wanted = prog || 'main';
    if (!n) return;
    M.prog = M.wanted;
    const tr = T.getTransport();
    tr.bpm.rampTo(M.prog === 'title' ? 82 : M.prog === 'vault' ? 96 : 104, 0.5);
    tr.swing = 0.08;
    tr.swingSubdivision = '16n';
    if (M.on) return;
    M.on = true;
    M.step = 0;
    if (!M.loop) M.loop = new T.Loop((time) => M.play(M.step++, time), '16n').start(0);
    tr.start('+0.05');
  };
  M.stop = () => {
    M.on = false;
    M.wanted = null;
    if (!n) return;
    T.getTransport().stop();
    n.pad.releaseAll();
  };
  M.setEnergy = (e) => (M.energy = e);
  M.setKey = (k) => (M.key = k);
  M.setFever = (f) => {
    M.fever = f;
    if (n) n.padF.frequency.rampTo(f ? 3200 : 1400, 0.4);
  };
  M.duck = (sec) => {
    if (!n) return;
    const f = n.musicFilter.frequency;
    f.cancelScheduledValues(T.now());
    f.rampTo(500, 0.05);
    setTimeout(() => n && f.rampTo(18000, 0.8), sec * 1000);
  };
  M.muffle = (on) => n && n.musicFilter.frequency.rampTo(on ? 700 : 18000, 0.3);

  M.play = (step, t) => {
    // after a stall the Transport replays missed steps; drop them instead of piling up voices
    if (!M.on || t < T.immediate() - 0.08) return;
    const prog = PROGS[M.prog] || PROGS.main;
    const bar = Math.floor(step / 16) % prog.length;
    const s = step % 16;
    const ch = prog[bar];
    const k = M.key;
    const e = M.fever ? 4 : M.energy;
    const title = M.prog === 'title';
    const sixteenth = T.Time('16n').toSeconds();
    if (s === 0) n.pad.triggerAttackRelease(ch.chord.map((m) => hz(m + k)), sixteenth * 15, t, 0.7);
    if (!title && (s === 0 || s === 8 || (e >= 3 && s === 10))) n.kick.triggerAttackRelease('C1', '8n', t, 0.9);
    if (title && s === 0 && bar % 2 === 0) n.kick.triggerAttackRelease('A0', '4n', t, 0.45);
    if (e >= 2 && !title && (s === 4 || s === 12)) n.clap.triggerAttackRelease('16n', t, 0.8);
    if (e >= 1 && !title && (s % 2 === 0 || e >= 4)) n.hat.triggerAttackRelease(300, '32n', t, s % 4 === 2 ? 0.9 : 0.45);
    for (const [st, iv, len] of BASS) {
      if (st !== s || (title && st !== 0)) continue;
      n.bass.triggerAttackRelease(hz(ch.root + iv + k), title ? sixteenth * 12 : sixteenth * len * 0.9, t, 0.85);
    }
    if ((e >= 2 || title) && s % (title ? 4 : 2) === 0 && !(e < 3 && s % 4 === 2 && !title)) {
      const tones = ch.chord.concat(ch.chord.map((m) => m + 12));
      const pat = [0, 2, 1, 3, 4, 2, 5, 3];
      n.arp.triggerAttackRelease(hz(tones[pat[(s / 2) % 8]] + 12 + k), title ? 0.6 : 0.2, t, title ? 0.45 : 0.6);
    }
    if (e >= 4 && s % 2 === 1 && Math.random() < 0.5) n.lead.triggerAttackRelease(hz(84 + PENTA[Math.floor(Math.random() * 5)] + k), 0.2, t, 0.5);
  };

  A.audioFallback = A.audio;
  A.audio = S;
  A.sfx = S;
})();
