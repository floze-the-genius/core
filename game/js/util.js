/* Small shared helpers. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});

  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.now = () => performance.now() / 1000;

  U.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
    outBounce: (t) => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
  };

  // Compact number format: 999, 9999, 12.3K, 456M ... never shows tiny fractions.
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  U.fmt = (n) => {
    if (!isFinite(n)) return '∞';
    const neg = n < 0;
    n = Math.abs(n);
    let out;
    if (n < 10000) out = String(Math.floor(n));
    else {
      let i = 0;
      while (n >= 1000 && i < SUF.length - 1) {
        n /= 1000;
        i++;
      }
      const d = n >= 100 ? 0 : n >= 10 ? 1 : 2;
      out = (Math.floor(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
      if (d) out = out.replace(/\.?0+$/, '');
      out += SUF[i];
    }
    return (neg ? '-' : '') + out;
  };

  U.fmtTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  };

  // Multiplier label, e.g. x25, x3, x½, x1½
  U.fmtMult = (m) => {
    const whole = Math.floor(m);
    const frac = m - whole;
    let f = '';
    if (Math.abs(frac - 0.5) < 0.01) f = '½';
    else if (Math.abs(frac - 0.25) < 0.01) f = '¼';
    else if (frac > 0.01) return 'x' + m.toFixed(1);
    return 'x' + (whole || !f ? whole : '') + f;
  };

  U.el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.center = (elem) => {
    const r = elem.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  };

  // Tiny tween runner driven by the main loop.
  const tweens = [];
  U.tween = (dur, fn, ease, done) => {
    const t = { t: 0, dur, fn, ease: ease || U.ease.outCubic, done, dead: false };
    tweens.push(t);
    fn(0, 0);
    return t;
  };
  U.updateTweens = (dt) => {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i];
      if (t.dead) {
        tweens.splice(i, 1);
        continue;
      }
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      t.fn(t.ease(k), k);
      if (k >= 1) {
        tweens.splice(i, 1);
        if (t.done) t.done();
      }
    }
  };

  // Timers driven by the main loop (pause with the game, unlike setTimeout).
  const timers = [];
  U.after = (sec, fn) => {
    const t = { left: sec, fn, dead: false };
    timers.push(t);
    return t;
  };
  U.updateTimers = (dt) => {
    for (let i = timers.length - 1; i >= 0; i--) {
      const t = timers[i];
      if (t.dead) {
        timers.splice(i, 1);
        continue;
      }
      t.left -= dt;
      if (t.left <= 0) {
        timers.splice(i, 1);
        t.fn();
      }
    }
  };
  U.wait = (sec) => new Promise((res) => U.after(sec, res));

  U.vibrate = (ms) => {
    if (A.settings && A.settings.vibro && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        /* ignore */
      }
    }
  };

  U.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {
        /* storage unavailable */
      }
    },
    del(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* storage unavailable */
      }
    },
  };

  A.util = U;
})();
