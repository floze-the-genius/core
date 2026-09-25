/* Rocket (crash): the multiplier climbs until the rocket blows up. Cash out in time. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;
  const E = A.econ;

  const K = 0.19; // growth rate: m(t) = e^(K t)
  const AUTO = [0, 1.5, 2, 3, 5, 10];

  const C = { id: 'crash', icon: 'rocket' };
  let el;
  let cv;
  let ctx;
  let bet;
  let goBtn;
  let autoBtn;
  let multEl;
  let winEl;
  let histEl;
  let visible = false;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let state = 'idle';
  let t = 0;
  let m = 1;
  let crashAt = 1;
  let amount = 0;
  let cashed = 0;
  let cashT = 0;
  let stateT = 0;
  let engine = null;
  let autoIdx = 0;
  const trail = [];
  const stars = [];
  const debris = [];
  const history = [];

  C.build = (view) => {
    el = view;
    el.classList.add('g-crash');
    autoIdx = A.game.s.seen.crashAuto || 0;
    el.innerHTML = `
      <div class="crash-screen">
        <canvas></canvas>
        <div class="crash-hist"></div>
        <div class="crash-hud"><div class="crash-mult">x1</div><div class="crash-win"></div></div>
      </div>
      <div class="game-controls">
        <button class="btn btn-glass btn-round auto-btn">${A.icon('target')}<span class="auto-val"></span></button>
        <div class="bet-host"></div>
        <button class="btn btn-gold btn-round go-btn"><span class="go-ic">${A.icon('rocket')}</span><span class="go-amt"></span></button>
      </div>`;
    cv = el.querySelector('canvas');
    ctx = cv.getContext('2d');
    multEl = el.querySelector('.crash-mult');
    winEl = el.querySelector('.crash-win');
    histEl = el.querySelector('.crash-hist');
    bet = new A.Bet(el.querySelector('.bet-host'), 'crash');
    goBtn = el.querySelector('.go-btn');
    autoBtn = el.querySelector('.auto-btn');
    bet.mountAmount(el.querySelector('.go-amt'));
    goBtn.addEventListener('click', () => (state === 'fly' && !cashed ? C.cashout() : C.launch()));
    autoBtn.addEventListener('click', () => {
      autoIdx = (autoIdx + 1) % AUTO.length;
      A.game.s.seen.crashAuto = autoIdx;
      renderAuto();
      A.sfx.ui();
    });
    renderAuto();
    for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), z: U.rand(0.2, 1) });
  };

  function renderAuto() {
    autoBtn.querySelector('.auto-val').textContent = AUTO[autoIdx] ? 'x' + AUTO[autoIdx] : '∞';
    autoBtn.classList.toggle('on', AUTO[autoIdx] > 0);
  }

  function layout() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    cv.width = Math.max(10, Math.round(W * dpr));
    cv.height = Math.max(10, Math.round(H * dpr));
  }

  C.show = () => {
    visible = true;
    layout();
  };
  C.hide = () => (visible = false);
  C.resize = () => visible && layout();
  C.busy = () => state === 'fly';

  C.launch = () => {
    if (state === 'fly' || state === 'boom') return;
    amount = bet.amount();
    if (!A.game.placeBet(amount)) {
      A.sfx.deny();
      A.ui.denyShake(goBtn);
      return;
    }
    crashAt = E.crashPoint(A.game.s, Math.random());
    state = 'fly';
    t = 0;
    m = 1;
    cashed = 0;
    trail.length = 0;
    debris.length = 0;
    bet.lock(true);
    el.classList.add('flying');
    el.classList.remove('cashed', 'boom');
    engine = A.sfx.engine();
    A.sfx.whoosh(true);
    A.fx.shake(3, 0.3);
  };

  C.cashout = () => {
    if (state !== 'fly' || cashed) return;
    cashed = m;
    cashT = t;
    const win = amount * m;
    el.classList.add('cashed');
    const tier = A.game.payout(win, amount);
    const r = U.center(goBtn);
    A.sfx.cashout();
    A.ui.celebrate(r.x, r.y - 60, Math.floor(win), amount, tier, { quiet: true });
    bet.lock(false);
  };

  function boom() {
    state = 'boom';
    stateT = 0;
    if (engine) engine.stop(0.02);
    engine = null;
    el.classList.add('boom');
    el.classList.remove('flying');
    history.unshift(crashAt);
    if (history.length > 9) history.pop();
    histEl.innerHTML = history
      .map((h) => `<span class="${h < 2 ? 'lo' : h < 10 ? 'mid' : 'hi'}">${fmtM(h)}</span>`)
      .join('');
    const p = rocketPos();
    if (visible) {
      A.sfx.explode();
      A.fx.shake(cashed ? 6 : 14, 0.5);
      const r = cv.getBoundingClientRect();
      A.fx.sparks(r.left + p.x, r.top + p.y, 60, '#ffb13b', { max: 700 });
      A.fx.glow(r.left + p.x, r.top + p.y, '#ff6a1a', 180, 0.7);
      if (!cashed) A.fx.flash('#ff2d2d', 0.25, 0.4);
    }
    for (let i = 0; i < 40; i++) {
      const a = U.rand(0, Math.PI * 2);
      const sp = U.rand(60, 380);
      debris.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.rand(0.5, 1.4), t: 0, s: U.rand(2, 5) });
    }
    if (!cashed) {
      A.game.payout(0, amount);
      if (visible) A.ui.loseText(W / 2 + cv.getBoundingClientRect().left, cv.getBoundingClientRect().top + H * 0.4, amount);
    }
    bet.lock(false);
  }

  const fmtM = (v) => 'x' + (v < 10 ? (Math.floor(v * 10) / 10).toFixed(1) : Math.floor(v));

  function scales() {
    const tMax = Math.max(8, t * 1.15);
    const mMax = Math.max(2.2, m * 1.25);
    return { tMax, mMax };
  }
  function toXY(tt, mm, sc) {
    const pad = 0.1;
    const x = W * pad + (tt / sc.tMax) * W * (1 - pad * 2);
    const y = H * (1 - pad) - ((mm - 1) / (sc.mMax - 1)) * H * (1 - pad * 2.4);
    return { x, y };
  }
  function rocketPos() {
    const sc = scales();
    return toXY(t, m, sc);
  }

  function update(dt) {
    if (state === 'fly') {
      t += dt;
      m = Math.exp(K * t);
      if (engine) engine.set(m);
      const auto = AUTO[autoIdx];
      if (!cashed && auto && m >= auto && auto <= crashAt) {
        m = Math.max(auto, Math.min(m, crashAt));
        C.cashout();
      }
      if ((crashAt > 1 && m >= crashAt) || (crashAt <= 1 && t >= 0.35) || t > 60) {
        m = crashAt;
        boom();
      }
    } else if (state === 'boom') {
      stateT += dt;
      if (stateT > 1.6) {
        state = 'idle';
        t = 0;
        m = 1;
        el.classList.remove('boom', 'cashed');
      }
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.t += dt;
      d.vy += 300 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.t > d.life) debris.splice(i, 1);
    }
    const speed = state === 'fly' ? 0.05 + Math.min(0.6, Math.log(m) * 0.25) : 0.01;
    stars.forEach((s) => {
      s.x -= speed * s.z * dt;
      s.y += speed * s.z * dt * 0.6;
      if (s.x < 0) s.x += 1;
      if (s.y > 1) s.y -= 1;
    });
  }

  function drawRocket(c, x, y, ang, size, flame) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    if (flame) {
      const fl = size * (1.1 + Math.random() * 0.6);
      const g = c.createLinearGradient(-size * 0.5, 0, -size * 0.5 - fl, 0);
      g.addColorStop(0, '#fff6c8');
      g.addColorStop(0.3, '#ffb13b');
      g.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-size * 0.45, -size * 0.18);
      c.quadraticCurveTo(-size * 0.5 - fl * 0.6, 0, -size * 0.45 - fl, 0);
      c.quadraticCurveTo(-size * 0.5 - fl * 0.6, 0, -size * 0.45, size * 0.18);
      c.closePath();
      c.fill();
    }
    // fins
    c.fillStyle = '#e8203f';
    c.beginPath();
    c.moveTo(-size * 0.2, -size * 0.2);
    c.lineTo(-size * 0.55, -size * 0.42);
    c.lineTo(-size * 0.5, -size * 0.12);
    c.closePath();
    c.moveTo(-size * 0.2, size * 0.2);
    c.lineTo(-size * 0.55, size * 0.42);
    c.lineTo(-size * 0.5, size * 0.12);
    c.closePath();
    c.fill();
    // body
    const bg = c.createLinearGradient(0, -size * 0.25, 0, size * 0.25);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.5, '#d9dde8');
    bg.addColorStop(1, '#7c8499');
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(size * 0.55, 0);
    c.quadraticCurveTo(size * 0.35, -size * 0.26, -size * 0.1, -size * 0.24);
    c.lineTo(-size * 0.48, -size * 0.18);
    c.lineTo(-size * 0.48, size * 0.18);
    c.lineTo(-size * 0.1, size * 0.24);
    c.quadraticCurveTo(size * 0.35, size * 0.26, size * 0.55, 0);
    c.fill();
    // nose
    c.fillStyle = '#e8203f';
    c.beginPath();
    c.moveTo(size * 0.55, 0);
    c.quadraticCurveTo(size * 0.42, -size * 0.17, size * 0.3, -size * 0.2);
    c.lineTo(size * 0.3, size * 0.2);
    c.quadraticCurveTo(size * 0.42, size * 0.17, size * 0.55, 0);
    c.fill();
    // window
    c.fillStyle = '#3a4a6a';
    c.beginPath();
    c.arc(size * 0.08, 0, size * 0.11, 0, Math.PI * 2);
    c.fill();
    const wg = c.createRadialGradient(size * 0.05, -size * 0.04, 1, size * 0.08, 0, size * 0.09);
    wg.addColorStop(0, '#dffcff');
    wg.addColorStop(1, '#27c8ff');
    c.fillStyle = wg;
    c.beginPath();
    c.arc(size * 0.08, 0, size * 0.085, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function draw() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // stars
    stars.forEach((s) => {
      c.fillStyle = `rgba(255,255,255,${0.25 + s.z * 0.6})`;
      const len = state === 'fly' ? Math.min(14, Math.log(m + 1) * 6) * s.z : 0;
      if (len > 1.5) {
        c.strokeStyle = c.fillStyle;
        c.lineWidth = s.z * 1.6;
        c.beginPath();
        c.moveTo(s.x * W, s.y * H);
        c.lineTo(s.x * W + len, s.y * H - len * 0.6);
        c.stroke();
      } else c.fillRect(s.x * W, s.y * H, s.z * 2, s.z * 2);
    });
    const sc = scales();
    // grid
    c.strokeStyle = 'rgba(255,255,255,0.07)';
    c.lineWidth = 1;
    c.font = `700 ${Math.max(10, H * 0.032)}px "Segoe UI", system-ui, sans-serif`;
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.textAlign = 'left';
    const steps = niceSteps(sc.mMax);
    steps.forEach((v) => {
      const p = toXY(0, v, sc);
      c.beginPath();
      c.moveTo(W * 0.1, p.y);
      c.lineTo(W * 0.95, p.y);
      c.stroke();
      c.fillText('x' + v, 6, p.y + 4);
    });
    // curve
    if (state !== 'idle') {
      const tEnd = state === 'fly' ? t : Math.log(crashAt) / K;
      const pts = [];
      const N = 60;
      for (let i = 0; i <= N; i++) {
        const tt = (tEnd * i) / N;
        pts.push(toXY(tt, Math.exp(K * tt), sc));
      }
      const last = pts[pts.length - 1];
      const fillG = c.createLinearGradient(0, last.y, 0, H * 0.9);
      fillG.addColorStop(0, A.fx.color('g1', 0.35));
      fillG.addColorStop(1, A.fx.color('g1', 0));
      c.fillStyle = fillG;
      c.beginPath();
      c.moveTo(pts[0].x, H * 0.9);
      pts.forEach((p) => c.lineTo(p.x, p.y));
      c.lineTo(last.x, H * 0.9);
      c.closePath();
      c.fill();
      c.strokeStyle = state === 'boom' ? '#ff4f5e' : A.fx.color('g1');
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 16;
      c.lineWidth = Math.max(3, H * 0.012);
      c.lineCap = 'round';
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
      c.shadowBlur = 0;
      // cash-out flag
      if (cashed) {
        const cp = toXY(cashT, cashed, sc);
        c.fillStyle = '#ffd23f';
        c.shadowColor = '#ffd23f';
        c.shadowBlur = 16;
        c.beginPath();
        c.arc(cp.x, cp.y, Math.max(5, H * 0.018), 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      }
    }
    // rocket
    const size = Math.max(34, Math.min(W, H) * 0.14);
    if (state === 'idle') {
      const p = toXY(0, 1, sc);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(p.x - size * 0.6, p.y + size * 0.25, size * 1.2, 4);
      drawRocket(c, p.x, p.y, -Math.PI / 4, size, false);
    } else if (state === 'fly') {
      const p = rocketPos();
      const p2 = toXY(Math.max(0, t - 0.3), Math.exp(K * Math.max(0, t - 0.3)), sc);
      const ang = Math.atan2(p.y - p2.y, p.x - p2.x);
      trail.push({ x: p.x, y: p.y, a: 1 });
      if (trail.length > 24) trail.shift();
      trail.forEach((tp, i) => {
        c.fillStyle = `rgba(255,190,120,${(i / trail.length) * 0.25})`;
        c.beginPath();
        c.arc(tp.x - Math.cos(ang) * size * 0.5, tp.y - Math.sin(ang) * size * 0.5, (i / trail.length) * size * 0.25, 0, Math.PI * 2);
        c.fill();
      });
      drawRocket(c, p.x, p.y, ang, size, true);
    }
    // debris
    debris.forEach((d) => {
      const k = d.t / d.life;
      c.fillStyle = k < 0.3 ? '#fff2b0' : k < 0.6 ? '#ff8a2a' : 'rgba(120,120,140,0.7)';
      c.globalAlpha = 1 - k;
      c.fillRect(d.x, d.y, d.s, d.s);
    });
    c.globalAlpha = 1;
  }

  function niceSteps(max) {
    const cand = [1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
    const out = cand.filter((v) => v < max);
    while (out.length > 4) out.splice(0, 1);
    return out;
  }

  let lastMultTxt = '';
  C.frame = (dt, vis) => {
    update(dt);
    if (!vis) return;
    if (state !== 'fly' || cashed) bet.refresh();
    draw();
    const txt = fmtM(m);
    if (txt !== lastMultTxt) {
      lastMultTxt = txt;
      multEl.textContent = txt;
      multEl.style.setProperty('--h', String(Math.min(300, 160 + Math.log(m) * 60)));
    }
    if (state === 'fly' && !cashed) {
      winEl.textContent = '+' + U.fmt(amount * m);
      goBtn.classList.add('cash');
      goBtn.querySelector('.go-ic').innerHTML = A.icon('bag');
      bet.amtNum.textContent = U.fmt(amount * m);
      bet.last = -1;
    } else {
      winEl.textContent = cashed ? '+' + U.fmt(amount * cashed) : '';
      if (goBtn.classList.contains('cash')) {
        goBtn.classList.remove('cash');
        goBtn.querySelector('.go-ic').innerHTML = A.icon('rocket');
        bet.last = -1;
      }
    }
    goBtn.classList.toggle('wait', state === 'boom' || (state === 'fly' && !!cashed));
  };

  (A.games = A.games || {}).crash = C;
})();
