/* Wheel of fortune: uneven segments, free spin on a timer, paid spins with a bet. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;
  const E = A.econ;

  // m: multiplier; fire = instant fever, clover = lucky frenzy (both also return the bet)
  const SEGS = [
    { m: 2, w: 2.6 },
    { m: 0, w: 4.4 },
    { m: 1, w: 3 },
    { m: 5, w: 1 },
    { m: 0, w: 4.4 },
    { m: 3, w: 1.8 },
    { m: 'fire', w: 1.2 },
    { m: 0, w: 4.4 },
    { m: 1, w: 3 },
    { m: 10, w: 0.5 },
    { m: 0, w: 4.4 },
    { m: 2, w: 2.6 },
    { m: 'clover', w: 1.2 },
    { m: 1, w: 3 },
    { m: 0, w: 4.4 },
    { m: 50, w: 0.14 },
  ];
  const COLORS = {
    0: ['#2a1633', '#160a1d'],
    1: ['#3a59ff', '#1d2c99'],
    2: ['#7a3dff', '#3c1a99'],
    3: ['#ff3db8', '#8f1666'],
    5: ['#ff7a1a', '#99400a'],
    10: ['#ffd23f', '#a37400'],
    50: ['#ffffff', '#ffd23f'],
    fire: ['#ff3d3d', '#8a0f0f'],
    clover: ['#2de07a', '#0e7a3c'],
  };
  const TOTAL_W = SEGS.reduce((a, s) => a + s.w, 0);
  let acc = 0;
  SEGS.forEach((s) => {
    s.a0 = (acc / TOTAL_W) * Math.PI * 2;
    acc += s.w;
    s.a1 = (acc / TOTAL_W) * Math.PI * 2;
    s.p = s.w / TOTAL_W;
  });
  const val = (s) => (typeof s.m === 'number' ? s.m : 1);
  const BASE_RTP = SEGS.reduce((a, s) => a + s.p * val(s), 0);

  const Wh = { id: 'wheel', icon: 'wheel' };
  let el;
  let cv;
  let ctx;
  let bet;
  let spinBtn;
  let freeBtn;
  let freeRing;
  let visible = false;
  let angle = 0;
  let spin = null;
  let flap = 0;
  let flapV = 0;
  let lastSeg = -1;
  let dpr = 1;
  let S = 0;
  let lights = 0;
  let wheelImg = null;
  let wheelImgSize = 0;

  Wh.build = (view) => {
    el = view;
    el.classList.add('g-wheel');
    el.innerHTML = `
      <div class="wheel-wrap"><canvas></canvas></div>
      <div class="game-controls">
        <button class="btn btn-glass btn-round free-btn">
          <svg class="free-ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20"/></svg>
          ${A.icon('gift')}<span class="free-amt"></span>
        </button>
        <div class="bet-host"></div>
        <button class="btn btn-gold btn-round spin-btn">${A.icon('spin')}<span class="spin-amt"></span></button>
      </div>`;
    cv = el.querySelector('canvas');
    ctx = cv.getContext('2d');
    bet = new A.Bet(el.querySelector('.bet-host'), 'wheel');
    bet.mountAmount(el.querySelector('.spin-amt'));
    spinBtn = el.querySelector('.spin-btn');
    freeBtn = el.querySelector('.free-btn');
    freeRing = el.querySelector('.free-ring circle');
    spinBtn.addEventListener('click', () => Wh.spin(false));
    freeBtn.addEventListener('click', () => Wh.spin(true));
  };

  function layout() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    S = Math.min(r.width, r.height);
    cv.width = Math.max(10, Math.round(r.width * dpr));
    cv.height = Math.max(10, Math.round(r.height * dpr));
    buildWheel();
  }

  // Pre-render the static wheel face.
  function buildWheel() {
    const size = Math.round(S * dpr);
    if (!size || size === wheelImgSize) return;
    wheelImgSize = size;
    const R = size * 0.43;
    const off = document.createElement('canvas');
    off.width = off.height = size;
    const c = off.getContext('2d');
    c.translate(size / 2, size / 2);
    // rim
    const rim = c.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.1);
    rim.addColorStop(0, '#6b4300');
    rim.addColorStop(0.4, '#ffe08a');
    rim.addColorStop(0.7, '#c98a10');
    rim.addColorStop(1, '#5a3700');
    c.fillStyle = rim;
    c.beginPath();
    c.arc(0, 0, R * 1.1, 0, Math.PI * 2);
    c.fill();
    SEGS.forEach((s) => {
      const col = COLORS[s.m] || COLORS[1];
      const g = c.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
      g.addColorStop(0, col[1]);
      g.addColorStop(0.7, col[0]);
      g.addColorStop(1, col[1]);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, R, s.a0, s.a1);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,230,160,0.8)';
      c.lineWidth = Math.max(1, R * 0.008);
      c.stroke();
      // label
      const mid = (s.a0 + s.a1) / 2;
      c.save();
      c.rotate(mid);
      c.translate(R * 0.74, 0);
      c.rotate(Math.PI / 2);
      const segW = (s.a1 - s.a0) * R * 0.74;
      if (typeof s.m === 'number' && s.m > 0) {
        const fs = Math.min(R * 0.13, segW * 0.62);
        c.font = `900 ${fs}px "Segoe UI", system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = fs * 0.16;
        c.strokeStyle = 'rgba(0,0,0,0.55)';
        c.strokeText('x' + s.m, 0, 0);
        c.fillStyle = s.m >= 50 ? '#7a3d00' : '#ffffff';
        c.fillText('x' + s.m, 0, 0);
      } else {
        const icon = s.m === 0 ? 'skull' : s.m === 'fire' ? 'fire' : 'clover';
        drawIcon(c, icon, Math.min(R * 0.16, segW * 0.75), s.m === 0 ? 'rgba(255,255,255,0.35)' : '#ffffff');
      }
      c.restore();
    });
    // inner shading
    const sh = c.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
    sh.addColorStop(0, 'rgba(0,0,0,0.35)');
    sh.addColorStop(0.3, 'rgba(0,0,0,0)');
    sh.addColorStop(0.92, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.4)');
    c.fillStyle = sh;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fill();
    // pegs
    c.fillStyle = '#fff5d6';
    SEGS.forEach((s) => {
      c.beginPath();
      c.arc(Math.cos(s.a0) * R * 0.985, Math.sin(s.a0) * R * 0.985, Math.max(2, R * 0.022), 0, Math.PI * 2);
      c.fill();
    });
    // hub
    const hub = c.createRadialGradient(-R * 0.04, -R * 0.05, 1, 0, 0, R * 0.17);
    hub.addColorStop(0, '#fffbe0');
    hub.addColorStop(0.5, '#ffc93a');
    hub.addColorStop(1, '#7a4a00');
    c.fillStyle = hub;
    c.beginPath();
    c.arc(0, 0, R * 0.17, 0, Math.PI * 2);
    c.fill();
    drawIcon(c, 'star', R * 0.2, '#7a4a00');
    wheelImg = off;
  }

  function drawIcon(c, name, size, color) {
    const svg = A.icon(name).replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="color:${color}" `);
    const img = new Image();
    const target = c;
    const tf = c.getTransform();
    img.onload = () => {
      target.save();
      target.setTransform(tf);
      target.drawImage(img, -size / 2, -size / 2, size, size);
      target.restore();
    };
    img.src =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(svg.replace(/currentColor/g, color).replace('class="ic"', 'fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'));
  }

  Wh.show = () => {
    visible = true;
    layout();
  };
  Wh.hide = () => (visible = false);
  Wh.resize = () => {
    if (!visible) return;
    wheelImgSize = 0;
    layout();
  };
  Wh.busy = () => !!spin;
  Wh.freeReady = () => A.game.s.time >= A.game.s.wheelAt;

  Wh.spin = (free) => {
    if (spin) return;
    let amount;
    const btn = free ? freeBtn : spinBtn;
    if (free) {
      if (!Wh.freeReady()) {
        A.sfx.deny();
        A.ui.denyShake(btn);
        return;
      }
      amount = E.wheelFreeBet(A.game.s);
      A.game.s.wheelAt = A.game.s.time + E.WHEEL_COOLDOWN;
    } else {
      amount = bet.amount();
      if (!A.game.placeBet(amount)) {
        A.sfx.deny();
        A.ui.denyShake(btn);
        return;
      }
    }
    // pick outcome by weight
    let r = Math.random();
    let idx = 0;
    for (; idx < SEGS.length - 1; idx++) {
      r -= SEGS[idx].p;
      if (r <= 0) break;
    }
    const s = SEGS[idx];
    const inside = U.rand(0.15, 0.85);
    const segAngle = s.a0 + (s.a1 - s.a0) * inside;
    // pointer is at the top (-PI/2): final angle so that segAngle sits under it
    const base = -Math.PI / 2 - segAngle;
    const cur = angle;
    let target = base;
    while (target < cur + Math.PI * 2 * 5) target += Math.PI * 2;
    target += Math.PI * 2 * U.randi(0, 1);
    spin = { from: cur, to: target, t: 0, dur: U.rand(4.6, 5.6), idx, amount, free };
    bet.lock(true);
    el.classList.add('spinning');
    A.sfx.whoosh(true);
    A.fx.pulse(0.4);
  };

  function segAt(a) {
    // which segment is under the pointer for wheel rotation a
    let x = (-Math.PI / 2 - a) % (Math.PI * 2);
    if (x < 0) x += Math.PI * 2;
    for (let i = 0; i < SEGS.length; i++) if (x >= SEGS[i].a0 && x < SEGS[i].a1) return i;
    return 0;
  }

  function finish() {
    const sp = spin;
    spin = null;
    bet.lock(false);
    el.classList.remove('spinning');
    const s = SEGS[sp.idx];
    const scale = A.game.rtp() / BASE_RTP;
    const win = sp.amount * val(s) * scale;
    const r = U.center(cv);
    const cost = sp.free ? 0 : sp.amount;
    const ref = sp.amount;
    if (s.m === 'fire') {
      A.game.s.feverUntil = A.game.s.time + E.feverDur(A.game.s);
      A.game.s.fever = 0;
      A.game.emit('fever', true);
    } else if (s.m === 'clover') {
      A.game.s.frenzyUntil = A.game.s.time + E.FRENZY_DUR;
      A.game.emit('frenzy', true);
    }
    if (win > 0) {
      const tier = A.game.payout(win, ref);
      A.ui.celebrate(r.x, r.y - S * 0.1, Math.floor(win), ref, sp.free ? Math.max(1, tier) : tier);
    } else {
      A.game.payout(0, cost);
      A.ui.loseText(r.x, r.y - S * 0.1, cost);
    }
  }

  function update(dt) {
    lights += dt;
    if (spin) {
      spin.t += dt;
      const k = Math.min(1, spin.t / spin.dur);
      angle = spin.from + (spin.to - spin.from) * (1 - Math.pow(1 - k, 3.4));
      const seg = segAt(angle);
      if (seg !== lastSeg) {
        lastSeg = seg;
        flapV -= 9 + (1 - k) * 8;
        if (visible) A.sfx.tick(0.8 + (1 - k) * 0.5);
      }
      if (k >= 1) finish();
    }
    flapV += (-120 * flap - 10 * flapV) * dt;
    flap += flapV * dt;
    flap = U.clamp(flap, -0.9, 0.2);
  }

  function draw() {
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const cx = cv.width / 2;
    const cy = cv.height / 2 + S * dpr * 0.03;
    const size = wheelImgSize;
    const R = size * 0.43;
    // glow
    const gl = c.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.35);
    gl.addColorStop(0, A.fx.color('g2', 0.35));
    gl.addColorStop(1, A.fx.color('g2', 0));
    c.fillStyle = gl;
    c.fillRect(0, 0, cv.width, cv.height);
    if (wheelImg) {
      c.save();
      c.translate(cx, cy);
      c.rotate(angle);
      c.drawImage(wheelImg, -size / 2, -size / 2);
      c.restore();
    }
    // chasing rim lights
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const on = (Math.floor(lights * (spin ? 14 : 4)) + i) % 3 === 0;
      c.fillStyle = on ? '#fff6c8' : 'rgba(120,70,0,0.9)';
      c.shadowColor = '#ffd23f';
      c.shadowBlur = on ? 14 * dpr : 0;
      c.beginPath();
      c.arc(cx + Math.cos(a) * R * 1.055, cy + Math.sin(a) * R * 1.055, Math.max(2, R * 0.022), 0, Math.PI * 2);
      c.fill();
    }
    c.shadowBlur = 0;
    // pointer / flapper
    c.save();
    c.translate(cx, cy - R * 1.08);
    c.rotate(flap);
    const pw = R * 0.11;
    const ph = R * 0.2;
    const pg = c.createLinearGradient(-pw, 0, pw, 0);
    pg.addColorStop(0, '#a30f3a');
    pg.addColorStop(0.5, '#ff4f7a');
    pg.addColorStop(1, '#7a0a2a');
    c.fillStyle = pg;
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(-pw, -ph * 0.35);
    c.quadraticCurveTo(0, -ph * 0.7, pw, -ph * 0.35);
    c.lineTo(0, ph);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#ffe08a';
    c.beginPath();
    c.arc(0, -ph * 0.2, pw * 0.35, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  Wh.frame = (dt, vis) => {
    update(dt);
    if (!vis) return;
    bet.refresh();
    draw();
    const s = A.game.s;
    const left = Math.max(0, s.wheelAt - s.time);
    const ready = left <= 0;
    freeBtn.classList.toggle('ready', ready);
    const circ = 2 * Math.PI * 20;
    freeRing.style.strokeDasharray = circ;
    freeRing.style.strokeDashoffset = ready ? 0 : circ * (left / E.WHEEL_COOLDOWN);
    const amt = freeBtn.querySelector('.free-amt');
    const txt = ready ? U.fmt(E.wheelFreeBet(s)) : U.fmtTime(left);
    if (amt.textContent !== txt) amt.textContent = txt;
  };

  Wh.BASE_RTP = () => BASE_RTP;
  (A.games = A.games || {}).wheel = Wh;
})();
