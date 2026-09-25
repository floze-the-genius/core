/* Plinko: drop balls through a peg pyramid into multiplier bins. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;

  const ROWS = 10;
  const MULTS = [25, 8, 3, 1, 0.5, 0.5, 0.5, 1, 3, 8, 25];
  const BIN_COLORS = ['#ff2d55', '#ff5a3d', '#ff8f1f', '#ffc31f', '#7a6cff', '#5a5cff', '#7a6cff', '#ffc31f', '#ff8f1f', '#ff5a3d', '#ff2d55'];
  const BALL_COLORS = ['#ff4fd8', '#ffd23f', '#3dffe0', '#ff7a3d', '#9d7bff'];
  let BASE_RTP = 0;
  (function () {
    const C = (n, k) => {
      let r = 1;
      for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
      return r;
    };
    for (let k = 0; k <= ROWS; k++) BASE_RTP += (C(ROWS, k) / Math.pow(2, ROWS)) * MULTS[k];
  })();

  const P = { id: 'plinko', icon: 'plinko' };
  let el;
  let cv;
  let ctx;
  let bet;
  let dropBtn;
  let visible = false;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let geo = null;
  const balls = [];
  const pegGlow = [];
  const binPulse = MULTS.map(() => 0);
  let holdTimer = null;
  let colorIdx = 0;

  P.build = (view) => {
    el = view;
    el.classList.add('g-plinko');
    el.innerHTML = `
      <div class="plinko-board"><canvas></canvas></div>
      <div class="game-controls">
        <div class="bet-host"></div>
        <button class="btn btn-gold btn-round drop-btn">${A.icon('down')}<span class="drop-amt"></span></button>
      </div>`;
    cv = el.querySelector('canvas');
    ctx = cv.getContext('2d');
    bet = new A.Bet(el.querySelector('.bet-host'), 'plinko');
    bet.mountAmount(el.querySelector('.drop-amt'));
    dropBtn = el.querySelector('.drop-btn');
    const stop = () => {
      clearInterval(holdTimer);
      holdTimer = null;
    };
    dropBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      P.drop();
      stop();
      holdTimer = setInterval(() => {
        if (!P.drop(true)) stop();
      }, 230);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => dropBtn.addEventListener(ev, stop));
    for (let r = 0; r < ROWS; r++) pegGlow.push(new Array(r + 3).fill(0));
  };

  function layout() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    cv.width = Math.max(10, Math.round(W * dpr));
    cv.height = Math.max(10, Math.round(H * dpr));
    const binH = Math.max(26, H * 0.09);
    let top = H * 0.07;
    const gap = Math.min((W * 0.94) / (ROWS + 2), (H - binH - top - 10) / (ROWS * 0.9 + 0.6));
    const rowH = gap * 0.9;
    // keep the pyramid vertically centred when the board is limited by width
    const used = ROWS * rowH + gap * 0.25 + binH;
    top = Math.max(top, (H - used) / 2);
    geo = {
      cx: W / 2,
      top,
      gap,
      rowH,
      pegR: Math.max(2.2, gap * 0.1),
      ballR: Math.max(4, gap * 0.2),
      binY: top + ROWS * rowH + gap * 0.25,
      binH,
    };
  }
  const pegX = (r, j) => geo.cx + (j - (r + 2) / 2) * geo.gap;
  const pegY = (r) => geo.top + r * geo.rowH;

  P.show = () => {
    visible = true;
    layout();
  };
  P.hide = () => {
    visible = false;
    clearInterval(holdTimer);
    holdTimer = null;
  };
  P.resize = () => visible && layout();
  P.busy = () => balls.length > 0;

  P.drop = (auto) => {
    if (balls.length >= 14) return true;
    const amount = bet.amount();
    if (!A.game.placeBet(amount)) {
      if (!auto) {
        A.sfx.deny();
        A.ui.denyShake(dropBtn);
      }
      return false;
    }
    const dirs = [];
    for (let i = 0; i < ROWS; i++) dirs.push(Math.random() < 0.5 ? -0.5 : 0.5);
    const offs = [0];
    for (let i = 0; i < ROWS; i++) offs.push(offs[i] + dirs[i]);
    balls.push({
      offs,
      seg: -1,
      t: 0,
      bet: amount,
      color: BALL_COLORS[colorIdx++ % BALL_COLORS.length],
      trail: [],
      x: 0,
      y: 0,
      jit: offs.map(() => U.rand(-0.06, 0.06)),
      land: -1,
    });
    A.sfx.tick(1.4);
    return true;
  };

  function ballPos(b) {
    const g = geo;
    const hitY = (r) => pegY(r) - g.pegR - g.ballR * 0.9;
    const hx = (i) => g.cx + (b.offs[i] + (i > 0 && i < ROWS ? b.jit[i] : 0)) * g.gap;
    if (b.seg === -1) {
      const k = b.t;
      return [g.cx + b.jit[0] * g.gap * 0.5, U.lerp(g.top - g.rowH * 1.2, hitY(0), k * k)];
    }
    if (b.seg < ROWS - 1) {
      const k = b.t;
      const x = U.lerp(hx(b.seg), hx(b.seg + 1), k);
      const y = U.lerp(hitY(b.seg), hitY(b.seg + 1), k * k) - g.rowH * 0.42 * Math.sin(Math.PI * k) * (1 - k * 0.5);
      return [x, y];
    }
    const k = b.t;
    const x = U.lerp(hx(ROWS - 1), g.cx + b.offs[ROWS] * g.gap, k);
    const y = U.lerp(hitY(ROWS - 1), g.binY + g.binH * 0.35, k * k) - g.rowH * 0.42 * Math.sin(Math.PI * k) * (1 - k * 0.5);
    return [x, y];
  }

  function update(dt) {
    if (!geo) layout();
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.land >= 0) {
        b.land += dt;
        if (b.land > 0.35) balls.splice(i, 1);
        continue;
      }
      const segDur = b.seg === -1 ? 0.28 : 0.15;
      b.t += dt / segDur;
      while (b.t >= 1 && b.land < 0) {
        b.t -= 1;
        b.seg++;
        if (b.seg <= ROWS - 1) {
          // hit peg in row b.seg
          const r = b.seg;
          const j = Math.round(b.offs[r] + (r + 2) / 2);
          if (pegGlow[r] && pegGlow[r][j] !== undefined) pegGlow[r][j] = 1;
          if (visible) {
            const pan = (b.offs[r] / (ROWS / 2)) * 0.6;
            A.sfx.peg(r, pan);
          }
        } else {
          landBall(b);
        }
      }
      const [x, y] = ballPos(b);
      b.x = x;
      b.y = y;
      b.trail.push([x, y]);
      if (b.trail.length > 7) b.trail.shift();
    }
    pegGlow.forEach((row) => row.forEach((v, j) => (row[j] = Math.max(0, v - dt * 3))));
    binPulse.forEach((v, j) => (binPulse[j] = Math.max(0, v - dt * 2.5)));
  }

  function landBall(b) {
    b.land = 0;
    b.t = 1;
    const bin = Math.round(b.offs[ROWS] + ROWS / 2);
    const m = MULTS[bin];
    binPulse[bin] = 1;
    const win = b.bet * m * (A.game.rtp() / BASE_RTP);
    const r = cv.getBoundingClientRect();
    const sx = r.left + geo.cx + b.offs[ROWS] * geo.gap;
    const sy = r.top + geo.binY;
    const pan = (b.offs[ROWS] / (ROWS / 2)) * 0.6;
    if (visible) A.sfx.land(m, pan);
    const tier = A.game.payout(win, b.bet);
    if (visible) {
      if (m >= 3) A.ui.celebrate(sx, sy, Math.floor(win), b.bet, tier, { quiet: true });
      else if (win >= 1) {
        A.fx.text(sx, sy - 20, '+' + U.fmt(win), { size: 18, color: m >= 1 ? '#ffe27a' : '#c9c3ff', color2: m >= 1 ? '#ff9d00' : '#7a6cff' });
        if (m >= 1) A.fx.fly(sx, sy, 2, A.ui.coinTarget, A.ui.coinHit);
      }
      A.fx.sparks(sx, sy, m >= 3 ? 26 : 8, BIN_COLORS[bin], { max: 380 });
      if (m >= 8) A.fx.shake(m >= 25 ? 10 : 5, 0.3);
    }
  }

  function draw() {
    const c = ctx;
    const g = geo;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // pegs
    for (let r = 0; r < ROWS; r++) {
      for (let j = 0; j < r + 3; j++) {
        const x = pegX(r, j);
        const y = pegY(r);
        const gl = pegGlow[r][j];
        if (gl > 0) {
          c.fillStyle = A.fx.color('g2', 0.35 * gl);
          c.beginPath();
          c.arc(x, y, g.pegR * 4 * (0.6 + gl * 0.4), 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = gl > 0.1 ? '#ffffff' : 'rgba(235,225,255,0.85)';
        c.beginPath();
        c.arc(x, y, g.pegR * (1 + gl * 0.5), 0, Math.PI * 2);
        c.fill();
      }
    }
    // bins
    const bw = g.gap * 0.92;
    MULTS.forEach((m, j) => {
      const x = g.cx + (j - ROWS / 2) * g.gap;
      const p = binPulse[j];
      const y = g.binY + p * 6;
      const col = BIN_COLORS[j];
      c.save();
      c.shadowColor = col;
      c.shadowBlur = 8 + p * 26;
      const gr = c.createLinearGradient(0, y, 0, y + g.binH);
      gr.addColorStop(0, col);
      gr.addColorStop(1, shade(col));
      c.fillStyle = gr;
      roundRect(c, x - bw / 2, y, bw, g.binH, Math.min(8, bw * 0.2));
      c.fill();
      c.restore();
      c.fillStyle = '#1a0a1e';
      c.font = `900 ${Math.max(9, Math.min(g.binH * 0.42, bw * 0.34))}px "Segoe UI", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(U.fmtMult(m).replace('x', ''), x, y + g.binH / 2 + 1);
    });
    // balls
    c.globalCompositeOperation = 'lighter';
    for (const b of balls) {
      const a = b.land >= 0 ? 1 - b.land / 0.35 : 1;
      b.trail.forEach(([x, y], i) => {
        c.globalAlpha = (i / b.trail.length) * 0.35 * a;
        c.fillStyle = b.color;
        c.beginPath();
        c.arc(x, y, g.ballR * (0.5 + i / b.trail.length / 2), 0, Math.PI * 2);
        c.fill();
      });
    }
    c.globalCompositeOperation = 'source-over';
    for (const b of balls) {
      const a = b.land >= 0 ? 1 - b.land / 0.35 : 1;
      c.globalAlpha = a;
      const gr = c.createRadialGradient(b.x - g.ballR * 0.35, b.y - g.ballR * 0.4, 1, b.x, b.y, g.ballR);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, b.color);
      gr.addColorStop(1, shade(b.color));
      c.shadowColor = b.color;
      c.shadowBlur = 14;
      c.fillStyle = gr;
      c.beginPath();
      c.arc(b.x, b.y, g.ballR, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
  }

  function shade(hexc) {
    const n = parseInt(hexc.slice(1), 16);
    const r = Math.floor(((n >> 16) & 255) * 0.45);
    const gg = Math.floor(((n >> 8) & 255) * 0.45);
    const b = Math.floor((n & 255) * 0.45);
    return `rgb(${r},${gg},${b})`;
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  P.frame = (dt, vis) => {
    if (!geo && !vis) return;
    update(dt);
    if (!vis) return;
    bet.refresh();
    draw();
  };

  (A.games = A.games || {}).plinko = P;
})();
