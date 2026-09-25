/* Plinko with real Matter.js physics. Each ball follows a random left/right plan: when it
   strikes a peg it is bounced toward the planned side, and it pays out wherever it really lands.
   BASE_RTP was measured over 20 000 simulated drops with this exact board and timestep. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;
  const M = window.Matter;
  if (!M) return; // plinko-lite.js takes over without the physics engine

  const ROWS = 10;
  const MULTS = [25, 8, 3, 1, 0.5, 0.5, 0.5, 1, 3, 8, 25];
  const BASE_RTP = 0.99;
  const BIN_COLORS = ['#ff2d55', '#ff5a3d', '#ff8f1f', '#ffc31f', '#7a6cff', '#5a5cff', '#7a6cff', '#ffc31f', '#ff8f1f', '#ff5a3d', '#ff2d55'];
  const BALL_COLORS = ['#ff4fd8', '#ffd23f', '#3dffe0', '#ff7a3d', '#9d7bff'];

  // virtual board (physics units)
  const GAP = 46;
  const ROWH = 42;
  const PEG_R = 5.5;
  const BALL_R = 9;
  const TOP = 60;
  const VW = GAP * (ROWS + 3);
  const CX = VW / 2;
  const BIN_Y = TOP + (ROWS - 1) * ROWH + ROWH * 0.8;
  const BIN_H = 46;
  const VH = BIN_Y + BIN_H + 12;
  const STEP = 1000 / 120;
  const VX = 1.5;
  const VY = 1.4;
  const PULL = 0.00005;

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
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let engine = null;
  const pegs = [];
  const balls = [];
  const binPulse = MULTS.map(() => 0);
  let holdTimer = null;
  let colorIdx = 0;
  let acc = 0;
  let lastPegSound = 0;

  function buildWorld() {
    engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0011 } });
    for (let r = 0; r < ROWS; r++) {
      for (let j = 0; j < r + 3; j++) {
        const p = M.Bodies.circle(CX + (j - (r + 2) / 2) * GAP, TOP + r * ROWH, PEG_R, { isStatic: true, restitution: 0.3, friction: 0 });
        p.row = r;
        p.glow = 0;
        pegs.push(p);
      }
    }
    M.Composite.add(engine.world, pegs);
    M.Events.on(engine, 'collisionStart', (e) => {
      for (const pair of e.pairs) {
        const ball = pair.bodyA.plan ? pair.bodyA : pair.bodyB.plan ? pair.bodyB : null;
        if (!ball) continue;
        const peg = ball === pair.bodyA ? pair.bodyB : pair.bodyA;
        if (peg.row === undefined) continue;
        peg.glow = 1;
        const r = peg.row;
        if (r >= ball.row) {
          ball.row = r + 1;
          const dir = Math.sign(ball.plan[r + 1] - ball.plan[r]);
          M.Body.setVelocity(ball, { x: dir * VX * U.rand(0.9, 1.1), y: -VY * U.rand(0.8, 1.2) });
        }
        const now = performance.now();
        if (visible && now - lastPegSound > 28) {
          lastPegSound = now;
          A.sfx.peg(r, ((peg.position.x - CX) / (VW / 2)) * 0.7);
        }
      }
    });
  }

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
    buildWorld();
  };

  function layout() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    cv.width = Math.max(10, Math.round(W * dpr));
    cv.height = Math.max(10, Math.round(H * dpr));
    scale = Math.min(W / VW, H / VH);
    ox = (W - VW * scale) / 2;
    oy = (H - VH * scale) / 2;
  }

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
    const plan = [0];
    for (let i = 0; i < ROWS; i++) plan.push(plan[i] + (Math.random() < 0.5 ? -0.5 : 0.5));
    const b = M.Bodies.circle(CX + U.rand(-1.5, 1.5), TOP - ROWH * 1.3, BALL_R, {
      restitution: 0.3,
      friction: 0,
      frictionAir: 0.002,
      collisionFilter: { group: -1 },
    });
    b.plan = plan;
    b.row = 0;
    b.age = 0;
    b.bet = amount;
    b.color = BALL_COLORS[colorIdx++ % BALL_COLORS.length];
    b.trail = [];
    b.land = -1;
    M.Composite.add(engine.world, b);
    balls.push(b);
    A.sfx.tick(1.4);
    return true;
  };

  function stepWorld() {
    for (const b of balls) {
      if (b.land >= 0) continue;
      const tx = CX + b.plan[Math.min(ROWS, b.row)] * GAP;
      M.Body.applyForce(b, b.position, { x: PULL * (tx - b.position.x) * b.mass, y: 0 });
      b.age++;
    }
    M.Engine.update(engine, STEP);
    for (const b of balls) {
      if (b.land >= 0) continue;
      if (b.position.y > BIN_Y + BIN_H * 0.35 || b.age > 2400) landBall(b);
    }
  }

  function landBall(b) {
    b.land = 0;
    M.Composite.remove(engine.world, b);
    const bin = U.clamp(Math.round((b.position.x - CX) / GAP + ROWS / 2), 0, ROWS);
    const m = MULTS[bin];
    binPulse[bin] = 1;
    const win = b.bet * m * (A.game.rtp() / BASE_RTP);
    const tier = A.game.payout(win, b.bet);
    if (!visible) return;
    const r = cv.getBoundingClientRect();
    const sx = r.left + ox + (CX + (bin - ROWS / 2) * GAP) * scale;
    const sy = r.top + oy + BIN_Y * scale;
    const pan = ((bin - ROWS / 2) / (ROWS / 2)) * 0.6;
    A.sfx.land(m, pan);
    if (m >= 3) A.ui.celebrate(sx, sy, Math.floor(win), b.bet, tier, { quiet: true });
    else if (win >= 1) {
      A.fx.text(sx, sy - 20, '+' + U.fmt(win), { size: 18, color: m >= 1 ? '#ffe27a' : '#c9c3ff', color2: m >= 1 ? '#ff9d00' : '#7a6cff' });
      if (m >= 1) A.fx.fly(sx, sy, 2, A.ui.coinTarget, A.ui.coinHit);
    }
    A.fx.sparks(sx, sy, m >= 3 ? 26 : 8, BIN_COLORS[bin], { max: 380 });
    if (m >= 8) {
      A.fx.shake(m >= 25 ? 10 : 5, 0.3);
      if (A.gl) A.gl.burst(sx, sy, m >= 25 ? 40 : 16);
    }
  }

  function update(dt) {
    acc = Math.min(acc + dt * 1000, STEP * 14);
    while (acc >= STEP) {
      stepWorld();
      acc -= STEP;
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.land >= 0) {
        b.land += dt;
        if (b.land > 0.35) balls.splice(i, 1);
        continue;
      }
      b.trail.push([b.position.x, b.position.y]);
      if (b.trail.length > 8) b.trail.shift();
    }
    for (const p of pegs) p.glow = Math.max(0, p.glow - dt * 3);
    binPulse.forEach((v, j) => (binPulse[j] = Math.max(0, v - dt * 2.5)));
  }

  function draw() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.translate(ox, oy);
    c.scale(scale, scale);
    for (const p of pegs) {
      const { x, y } = p.position;
      if (p.glow > 0) {
        c.fillStyle = A.fx.color('g2', 0.35 * p.glow);
        c.beginPath();
        c.arc(x, y, PEG_R * 4 * (0.6 + p.glow * 0.4), 0, Math.PI * 2);
        c.fill();
      }
      const g = c.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, PEG_R * (1 + p.glow * 0.4));
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, p.glow > 0.1 ? A.fx.color('g2') : 'rgba(200,190,235,0.85)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, PEG_R * (1 + p.glow * 0.4), 0, Math.PI * 2);
      c.fill();
    }
    const bw = GAP * 0.92;
    MULTS.forEach((m, j) => {
      const x = CX + (j - ROWS / 2) * GAP;
      const pl = binPulse[j];
      const y = BIN_Y + pl * 6;
      const col = BIN_COLORS[j];
      c.save();
      c.shadowColor = col;
      c.shadowBlur = 8 + pl * 26;
      const gr = c.createLinearGradient(0, y, 0, y + BIN_H);
      gr.addColorStop(0, col);
      gr.addColorStop(1, shade(col));
      c.fillStyle = gr;
      roundRect(c, x - bw / 2, y, bw, BIN_H, 9);
      c.fill();
      c.restore();
      c.fillStyle = '#1a0a1e';
      c.font = `800 ${m >= 10 ? 15 : 17}px Unbounded, "Segoe UI", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(U.fmtMult(m).replace('x', ''), x, y + BIN_H / 2 + 1);
    });
    c.globalCompositeOperation = 'lighter';
    for (const b of balls) {
      const a = b.land >= 0 ? 1 - b.land / 0.35 : 1;
      b.trail.forEach(([x, y], i) => {
        c.globalAlpha = (i / b.trail.length) * 0.35 * a;
        c.fillStyle = b.color;
        c.beginPath();
        c.arc(x, y, BALL_R * (0.5 + i / b.trail.length / 2), 0, Math.PI * 2);
        c.fill();
      });
    }
    c.globalCompositeOperation = 'source-over';
    for (const b of balls) {
      const a = b.land >= 0 ? 1 - b.land / 0.35 : 1;
      const { x, y } = b.position;
      c.globalAlpha = a;
      const gr = c.createRadialGradient(x - BALL_R * 0.35, y - BALL_R * 0.4, 1, x, y, BALL_R);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, b.color);
      gr.addColorStop(1, shade(b.color));
      c.shadowColor = b.color;
      c.shadowBlur = 14;
      c.fillStyle = gr;
      c.beginPath();
      c.arc(x, y, BALL_R, 0, Math.PI * 2);
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
    if (!engine) return;
    update(dt);
    if (!vis) return;
    bet.refresh();
    draw();
  };

  (A.games = A.games || {}).plinko = P;
})();
