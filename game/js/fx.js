/* Visual effects: animated background, particle system, popups, banners, shake, flash. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;

  const FX = { quality: 1 };

  // ---------------- palettes ----------------
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const THEMES = {
    title: { top: '#05020c', bot: '#1a0630', g1: '#ff2fb4', g2: '#7a3cff', grid: '#ff3fd0', dust: '#ffd98a' },
    basement: { top: '#020d0c', bot: '#06302a', g1: '#12ffc0', g2: '#0aa6ff', grid: '#19ffcb', dust: '#b6fff0' },
    bar: { top: '#0b0316', bot: '#2a0845', g1: '#b44bff', g2: '#ff4fd8', grid: '#c870ff', dust: '#f3c6ff' },
    hall: { top: '#14020c', bot: '#420628', g1: '#ff2d7a', g2: '#ffb13b', grid: '#ff4f8f', dust: '#ffd0a0' },
    vip: { top: '#020716', bot: '#0b1f4d', g1: '#3d7dff', g2: '#ffd24a', grid: '#4f8dff', dust: '#fff0b0' },
    penthouse: { top: '#06051a', bot: '#2a0f52', g1: '#00e5ff', g2: '#ff5ea8', grid: '#29f0ff', dust: '#ffd6f0' },
    vault: { top: '#0b0702', bot: '#352006', g1: '#ffc53d', g2: '#ff7a1a', grid: '#ffcf4a', dust: '#fff3c4' },
  };
  const theme = {};
  const themeFrom = {};
  const themeTo = {};
  let themeT = 1;
  function setThemeImmediate(name) {
    const th = THEMES[name] || THEMES.title;
    for (const k in th) {
      theme[k] = hex(th[k]);
      themeTo[k] = theme[k].slice();
    }
    themeT = 1;
  }
  FX.setTheme = (name, instant) => {
    if (instant || !theme.top) return setThemeImmediate(name);
    const th = THEMES[name] || THEMES.title;
    for (const k in th) {
      themeFrom[k] = theme[k].slice();
      themeTo[k] = hex(th[k]);
    }
    themeT = 0;
  };
  FX.color = (k, a) => {
    const c = theme[k] || [255, 255, 255];
    return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };
  FX.rgb = (k) => (theme[k] || [255, 255, 255]).join(',');
  FX.themeHex = (name, k) => (THEMES[name] || THEMES.title)[k];

  // ---------------- background ----------------
  let bg;
  let bctx;
  let bw = 0;
  let bh = 0;
  const bokeh = [];
  let bgTime = 0;
  let pulse = 0;
  FX.pulse = (v) => (pulse = Math.min(1.5, pulse + (v || 0.3)));

  function resizeBg() {
    const s = 0.5;
    bw = Math.ceil(window.innerWidth * s);
    bh = Math.ceil(window.innerHeight * s);
    bg.width = bw;
    bg.height = bh;
  }

  function drawBg(dt) {
    bgTime += dt;
    pulse = Math.max(0, pulse - dt * 1.6);
    if (themeT < 1) {
      themeT = Math.min(1, themeT + dt / 1.6);
      const k = U.ease.inOutQuad(themeT);
      for (const key in themeTo) {
        theme[key] = [0, 1, 2].map((i) => Math.round(U.lerp(themeFrom[key][i], themeTo[key][i], k)));
      }
    }
    const c = bctx;
    const g = c.createLinearGradient(0, 0, 0, bh);
    g.addColorStop(0, FX.color('top'));
    g.addColorStop(1, FX.color('bot'));
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = g;
    c.fillRect(0, 0, bw, bh);

    c.globalCompositeOperation = 'lighter';
    // drifting glows
    const glows = [
      [0.2 + Math.sin(bgTime * 0.13) * 0.12, 0.25 + Math.cos(bgTime * 0.1) * 0.1, 0.55, 'g1', 0.22],
      [0.8 + Math.cos(bgTime * 0.11) * 0.12, 0.35 + Math.sin(bgTime * 0.09) * 0.12, 0.5, 'g2', 0.2],
      [0.5 + Math.sin(bgTime * 0.07) * 0.2, 0.85, 0.6, 'g1', 0.14],
    ];
    const big = Math.max(bw, bh);
    for (const [x, y, r, col, a] of glows) {
      const rg = c.createRadialGradient(x * bw, y * bh, 0, x * bw, y * bh, r * big);
      rg.addColorStop(0, FX.color(col, a + pulse * 0.08));
      rg.addColorStop(1, FX.color(col, 0));
      c.fillStyle = rg;
      c.fillRect(0, 0, bw, bh);
    }

    // spotlights sweeping from the ceiling
    for (let i = 0; i < 2; i++) {
      const ox = bw * (i ? 0.85 : 0.15);
      const ang = Math.PI / 2 + Math.sin(bgTime * 0.35 + i * 2.1) * 0.45;
      const len = bh * 1.3;
      const spread = 0.16;
      const lg = c.createRadialGradient(ox, -10, 0, ox, -10, len);
      lg.addColorStop(0, FX.color(i ? 'g2' : 'g1', 0.16));
      lg.addColorStop(1, FX.color(i ? 'g2' : 'g1', 0));
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(ox, -10);
      c.lineTo(ox + Math.cos(ang - spread) * len, -10 + Math.sin(ang - spread) * len);
      c.lineTo(ox + Math.cos(ang + spread) * len, -10 + Math.sin(ang + spread) * len);
      c.closePath();
      c.fill();
    }

    // perspective neon floor
    const hy = bh * 0.66;
    c.strokeStyle = FX.color('grid', 0.2 + pulse * 0.1);
    c.lineWidth = 1;
    c.beginPath();
    const off = (bgTime * 0.35) % 1;
    for (let i = 0; i < 14; i++) {
      const z = (i + off) / 14;
      const y = hy + (bh - hy) * z * z;
      c.moveTo(0, y);
      c.lineTo(bw, y);
    }
    const vx = bw / 2;
    for (let i = -12; i <= 12; i++) {
      c.moveTo(vx + i * bw * 0.012, hy);
      c.lineTo(vx + i * bw * 0.16, bh);
    }
    c.stroke();
    const hg = c.createLinearGradient(0, hy - 30, 0, hy + 20);
    hg.addColorStop(0, FX.color('grid', 0));
    hg.addColorStop(0.6, FX.color('grid', 0.22 + pulse * 0.1));
    hg.addColorStop(1, FX.color('grid', 0));
    c.fillStyle = hg;
    c.fillRect(0, hy - 30, bw, 50);
    // fade the far grid into the horizon
    c.globalCompositeOperation = 'source-over';
    const fg = c.createLinearGradient(0, hy, 0, bh);
    fg.addColorStop(0, FX.color('bot', 0.9));
    fg.addColorStop(0.35, FX.color('bot', 0.2));
    fg.addColorStop(1, FX.color('bot', 0));
    c.fillStyle = fg;
    c.fillRect(0, hy, bw, bh - hy);

    // bokeh dust
    c.globalCompositeOperation = 'lighter';
    while (bokeh.length < 38) {
      bokeh.push({ x: Math.random(), y: Math.random(), r: U.rand(1, 5), s: U.rand(0.004, 0.02), p: Math.random() * 6 });
    }
    for (const b of bokeh) {
      b.y -= b.s * dt;
      b.x += Math.sin(bgTime * 0.5 + b.p) * 0.0006;
      if (b.y < -0.05) {
        b.y = 1.05;
        b.x = Math.random();
      }
      const a = (0.25 + 0.25 * Math.sin(bgTime * 1.5 + b.p)) * (1 + pulse);
      const px = b.x * bw;
      const py = b.y * bh;
      const rr = b.r * 3;
      const bgd = c.createRadialGradient(px, py, 0, px, py, rr);
      bgd.addColorStop(0, FX.color('dust', a * 0.7));
      bgd.addColorStop(1, FX.color('dust', 0));
      c.fillStyle = bgd;
      c.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    c.globalCompositeOperation = 'source-over';
    // vignette
    const vg = c.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.3, bw / 2, bh / 2, Math.max(bw, bh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vg;
    c.fillRect(0, 0, bw, bh);
  }

  // ---------------- particles ----------------
  let fx;
  let ctx;
  let W = 0;
  let H = 0;
  let dpr = 1;
  const parts = [];
  const MAX = 1400;
  const sprites = {};

  function makeCoinSprite(size, tint) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const r = size / 2;
    const g = c.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r);
    g.addColorStop(0, tint[0]);
    g.addColorStop(0.55, tint[1]);
    g.addColorStop(1, tint[2]);
    c.fillStyle = g;
    c.beginPath();
    c.arc(r, r, r - 1, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = tint[3];
    c.lineWidth = size * 0.07;
    c.beginPath();
    c.arc(r, r, r * 0.68, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.ellipse(r * 0.7, r * 0.55, r * 0.25, r * 0.12, -0.6, 0, Math.PI * 2);
    c.fill();
    return cv;
  }
  function makeGlowSprite(size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const r = size / 2;
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return cv;
  }
  function makeStarSprite(size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const r = size / 2;
    const g = c.createRadialGradient(r, r, 0, r, r, r * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(r, 0);
    c.quadraticCurveTo(r, r, size, r);
    c.quadraticCurveTo(r, r, r, size);
    c.quadraticCurveTo(r, r, 0, r);
    c.quadraticCurveTo(r, r, r, 0);
    c.fill();
    return cv;
  }

  function resizeFx() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    fx.width = Math.floor(W * dpr);
    fx.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  FX.init = () => {
    bg = document.getElementById('bg');
    bctx = bg.getContext('2d');
    fx = document.getElementById('fx');
    ctx = fx.getContext('2d');
    sprites.coin = makeCoinSprite(64, ['#fff6c2', '#ffc93a', '#b8730c', '#9a5a06']);
    sprites.silver = makeCoinSprite(64, ['#ffffff', '#cfd8e6', '#6c7a90', '#58657a']);
    sprites.glow = makeGlowSprite(64);
    sprites.star = makeStarSprite(64);
    setThemeImmediate('title');
    const onResize = () => {
      resizeBg();
      resizeFx();
    };
    window.addEventListener('resize', onResize);
    onResize();
  };

  function add(p) {
    if (parts.length >= MAX * FX.quality) parts.shift();
    parts.push(p);
    return p;
  }

  FX.coinBurst = (x, y, n, opts) => {
    opts = opts || {};
    n = Math.ceil(n * FX.quality);
    for (let i = 0; i < n; i++) {
      const a = opts.up ? U.rand(-Math.PI * 0.85, -Math.PI * 0.15) : U.rand(0, Math.PI * 2);
      const sp = U.rand(opts.min || 150, opts.max || 520);
      add({
        k: 'coin',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: opts.g === undefined ? 1100 : opts.g,
        life: U.rand(0.7, 1.3) * (opts.life || 1),
        t: 0,
        size: U.rand(10, 20) * (opts.scale || 1),
        spin: Math.random() * 6,
        vs: U.rand(8, 18),
        spr: opts.silver ? 'silver' : 'coin',
      });
    }
  };

  FX.sparks = (x, y, n, color, opts) => {
    opts = opts || {};
    n = Math.ceil(n * FX.quality);
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      const sp = U.rand(opts.min || 120, opts.max || 600);
      add({
        k: 'spark',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: opts.g || 300,
        life: U.rand(0.25, 0.6) * (opts.life || 1),
        t: 0,
        size: U.rand(1.5, 3.2),
        color: color || '#ffd66b',
        drag: 3,
      });
    }
  };

  FX.stars = (x, y, n, color, spread) => {
    n = Math.ceil(n * FX.quality);
    for (let i = 0; i < n; i++) {
      add({
        k: 'star',
        x: x + U.rand(-1, 1) * (spread || 40),
        y: y + U.rand(-1, 1) * (spread || 40),
        vx: U.rand(-30, 30),
        vy: U.rand(-60, 0),
        g: 0,
        life: U.rand(0.5, 1.1),
        t: 0,
        size: U.rand(10, 26),
        color: color || '#fff2b0',
        rot: Math.random() * Math.PI,
      });
    }
  };

  const CONF = ['#ff3d7f', '#ffd23f', '#3dffb5', '#3db8ff', '#b84dff', '#ffffff', '#ff8a3d'];
  FX.confetti = (x, y, n, opts) => {
    opts = opts || {};
    n = Math.ceil(n * FX.quality);
    for (let i = 0; i < n; i++) {
      const a = opts.down ? U.rand(0.3, Math.PI - 0.3) : U.rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const sp = U.rand(200, opts.power || 900);
      add({
        k: 'conf',
        x: opts.wide ? Math.random() * W : x,
        y: opts.wide ? -20 : y,
        vx: Math.cos(a) * sp * (opts.wide ? 0.2 : 1),
        vy: Math.sin(a) * sp * (opts.wide ? 0.3 : 1),
        g: 600,
        drag: 1.6,
        life: U.rand(1.8, 3.2),
        t: 0,
        w: U.rand(6, 12),
        h: U.rand(3, 7),
        rot: Math.random() * 6,
        vr: U.rand(-12, 12),
        flip: Math.random() * 6,
        color: U.pick(CONF),
      });
    }
  };

  FX.ring = (x, y, color, r, life, width) =>
    add({ k: 'ring', x, y, vx: 0, vy: 0, g: 0, t: 0, life: life || 0.45, r: r || 90, color: color || '#ffe08a', w: width || 6 });

  FX.glow = (x, y, color, r, life) =>
    add({ k: 'glow', x, y, vx: 0, vy: 0, g: 0, t: 0, life: life || 0.5, r: r || 120, color: color || '#ffd66b' });

  FX.text = (x, y, str, opts) => {
    opts = opts || {};
    return add({
      k: 'text',
      x: x + U.rand(-8, 8),
      y,
      vx: opts.vx || U.rand(-20, 20),
      vy: opts.vy || -140,
      g: opts.g === undefined ? 120 : opts.g,
      drag: 1.2,
      t: 0,
      life: opts.life || 0.95,
      str,
      size: opts.size || 26,
      color: opts.color || '#ffe27a',
      color2: opts.color2 || '#ff9d00',
      stroke: opts.stroke || 'rgba(40,10,0,0.9)',
    });
  };

  FX.rain = (dur, rate) => {
    const t0 = U.now();
    const spawn = () => {
      if (U.now() - t0 > dur) return;
      const n = Math.ceil((rate || 6) * FX.quality);
      for (let i = 0; i < n; i++) {
        add({
          k: 'coin',
          x: Math.random() * W,
          y: -30,
          vx: U.rand(-40, 40),
          vy: U.rand(100, 400),
          g: 900,
          life: 2.5,
          t: 0,
          size: U.rand(12, 26),
          spin: Math.random() * 6,
          vs: U.rand(6, 14),
          spr: 'coin',
        });
      }
      U.after(0.05, spawn);
    };
    spawn();
  };

  // Coins that fly into a UI element (e.g. the balance counter).
  FX.fly = (x, y, n, target, onHit, opts) => {
    opts = opts || {};
    n = Math.max(1, Math.ceil(n * Math.max(0.5, FX.quality)));
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      const sp = U.rand(80, 360) * (opts.spread || 1);
      add({
        k: 'fly',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        g: 0,
        drag: 4,
        t: 0,
        life: 3,
        delay: U.rand(0.18, 0.4) + i * 0.012,
        target,
        onHit,
        size: U.rand(12, 18) * (opts.scale || 1),
        spin: Math.random() * 6,
        vs: U.rand(8, 16),
        spr: 'coin',
        home: 0,
      });
    }
  };

  FX.firework = (x, y, color) => {
    const col = color || U.pick(CONF);
    add({
      k: 'rocket',
      x,
      y: H + 10,
      vx: U.rand(-40, 40),
      vy: -Math.sqrt(2 * 900 * Math.max(60, H + 10 - y)),
      g: 900,
      t: 0,
      life: 4,
      color: col,
      size: 3,
    });
  };

  function burstFirework(p) {
    const n = Math.ceil(70 * FX.quality);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + U.rand(-0.05, 0.05);
      const sp = U.rand(250, 420);
      add({
        k: 'spark',
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 240,
        drag: 1.8,
        life: U.rand(0.9, 1.5),
        t: 0,
        size: U.rand(2, 3.5),
        color: p.color,
      });
    }
    FX.glow(p.x, p.y, p.color, 160, 0.6);
    if (A.sfx) A.sfx.cymbal(undefined, 0.6, 0.05);
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.k === 'fly') {
        if (p.t > p.delay) {
          const tr = typeof p.target === 'function' ? p.target() : p.target;
          const dx = tr.x - p.x;
          const dy = tr.y - p.y;
          const d = Math.hypot(dx, dy);
          p.home += dt * 5;
          const sp = 400 + p.home * 900;
          p.vx = U.lerp(p.vx, (dx / (d || 1)) * sp, Math.min(1, dt * (3 + p.home * 3)));
          p.vy = U.lerp(p.vy, (dy / (d || 1)) * sp, Math.min(1, dt * (3 + p.home * 3)));
          if (d < 22 || p.t > 2.5) {
            parts.splice(i, 1);
            if (p.onHit) p.onHit();
            continue;
          }
        } else {
          p.vx *= 1 - Math.min(1, p.drag * dt);
          p.vy *= 1 - Math.min(1, p.drag * dt);
        }
      } else if (p.t >= p.life) {
        if (p.k === 'rocket') burstFirework(p);
        parts.splice(i, 1);
        continue;
      }
      if (p.k === 'rocket' && p.vy >= -30) {
        burstFirework(p);
        parts.splice(i, 1);
        continue;
      }
      if (p.drag && p.k !== 'fly') {
        const k = 1 - Math.min(1, p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin !== undefined) p.spin += p.vs * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.flip !== undefined) p.flip += dt * 9;
      if (p.k === 'rocket' && Math.random() < 0.8) {
        add({ k: 'spark', x: p.x, y: p.y, vx: U.rand(-20, 20), vy: U.rand(40, 90), g: 100, life: 0.4, t: 0, size: 2, color: '#ffd9a0' });
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      const k = p.t / p.life;
      if (p.k === 'coin' || p.k === 'fly') {
        const a = p.k === 'fly' ? 1 : k > 0.75 ? (1 - k) / 0.25 : 1;
        const sx = Math.abs(Math.cos(p.spin));
        ctx.globalAlpha = a;
        ctx.drawImage(sprites[p.spr], p.x - (p.size * Math.max(0.12, sx)) / 2, p.y - p.size / 2, p.size * Math.max(0.12, sx), p.size);
      } else if (p.k === 'text') {
        const a = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
        const sc = k < 0.15 ? U.ease.outBack(k / 0.15) : 1;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(sc, sc);
        ctx.font = `900 ${p.size}px "Segoe UI", system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, p.size * 0.18);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = p.stroke;
        ctx.strokeText(p.str, 0, 0);
        const gr = ctx.createLinearGradient(0, -p.size / 2, 0, p.size / 2);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.35, p.color);
        gr.addColorStop(1, p.color2);
        ctx.fillStyle = gr;
        ctx.fillText(p.str, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const k = p.t / p.life;
      if (p.k === 'spark' || p.k === 'rocket') {
        ctx.globalAlpha = p.k === 'rocket' ? 1 : 1 - k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.k === 'star') {
        const a = Math.sin(k * Math.PI);
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + k);
        const s = p.size * (0.6 + a * 0.4);
        ctx.drawImage(sprites.star, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (p.k === 'ring') {
        const e = U.ease.outCubic(k);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.w * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 + p.r * e, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.k === 'glow') {
        ctx.globalAlpha = (1 - k) * 0.8;
        const r = p.r * (0.6 + k * 0.6);
        ctx.drawImage(tinted(p.color), p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of parts) {
      if (p.k !== 'conf') continue;
      const k = p.t / p.life;
      ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  const tintCache = {};
  function tinted(color) {
    if (tintCache[color]) return tintCache[color];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    c.drawImage(sprites.glow, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, 64, 64);
    tintCache[color] = cv;
    return cv;
  }

  // ---------------- screen shake / flash / banner ----------------
  let shakeT = 0;
  let shakeDur = 0;
  let shakeAmp = 0;
  FX.shake = (amp, dur) => {
    if (A.settings && A.settings.shake === false) return;
    if (amp >= shakeAmp * (shakeT / Math.max(0.001, shakeDur))) {
      shakeAmp = amp;
      shakeDur = dur || 0.3;
      shakeT = shakeDur;
    }
  };
  function applyShake(dt) {
    const root = document.getElementById('shake');
    if (!root) return;
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt);
      const k = shakeT / shakeDur;
      const a = shakeAmp * k * k;
      root.style.transform = `translate(${U.rand(-a, a).toFixed(1)}px,${U.rand(-a, a).toFixed(1)}px) rotate(${(U.rand(-a, a) * 0.05).toFixed(2)}deg)`;
      if (shakeT === 0) root.style.transform = '';
    }
  }

  FX.flash = (color, alpha, dur) => {
    const f = document.getElementById('flash');
    f.style.transition = 'none';
    f.style.background = color || '#fff';
    f.style.opacity = alpha === undefined ? 0.6 : alpha;
    void f.offsetWidth;
    f.style.transition = `opacity ${dur || 0.5}s ease-out`;
    f.style.opacity = 0;
  };

  FX.banner = (text, style, opts) => {
    opts = opts || {};
    const host = document.getElementById('banners');
    const b = U.el('div', 'banner ' + (style || 'gold'));
    if (opts.rays) b.appendChild(U.el('div', 'rays'));
    const inner = U.el('div', 'banner-text');
    inner.textContent = text;
    inner.setAttribute('data-text', text);
    b.appendChild(inner);
    if (opts.sub) {
      const sub = U.el('div', 'banner-sub');
      sub.innerHTML = opts.sub;
      b.appendChild(sub);
    }
    host.appendChild(b);
    const life = opts.life || 1.6;
    U.after(life, () => {
      b.classList.add('out');
      U.after(0.45, () => b.remove());
    });
    return b;
  };

  // ---------------- frame ----------------
  let perfAcc = 0;
  let perfN = 0;
  FX.frame = (dt) => {
    drawBg(dt);
    update(dt);
    draw();
    applyShake(dt);
    perfAcc += dt;
    perfN++;
    if (perfAcc > 2) {
      const avg = perfAcc / perfN;
      if (avg > 1 / 40) FX.quality = Math.max(0.35, FX.quality * 0.8);
      else if (avg < 1 / 55) FX.quality = Math.min(1, FX.quality * 1.1);
      perfAcc = 0;
      perfN = 0;
    }
  };
  FX.size = () => ({ w: W, h: H });

  A.fx = FX;
})();
