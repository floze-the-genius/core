/* Three-reel, five-line slot machine with a progressive jackpot. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;

  const SYM = ['cherry', 'lemon', 'bell', 'clover', 'diamond', 'seven'];
  const PAY = [2, 3, 5, 10, 20, 50]; // three in a line, times the bet
  const PAIR_CHERRY = 0.5; // two cherries from the left
  const COUNTS = [7, 6, 5, 3, 2, 1];
  const LINES = [
    [1, 1, 1],
    [0, 0, 0],
    [2, 2, 2],
    [0, 1, 2],
    [2, 1, 0],
  ];
  const LINE_COLORS = ['#ffe45c', '#5cf2ff', '#ff5cc8', '#8cff5c', '#ff9b3d'];

  // Deterministic reel strips so the payout math is fixed.
  function makeStrip(seed) {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    const arr = [];
    COUNTS.forEach((n, i) => {
      for (let k = 0; k < n; k++) arr.push(i);
    });
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const STRIPS = [makeStrip(7), makeStrip(1234), makeStrip(98765)];
  const L = STRIPS[0].length;
  const mod = (a, n) => ((a % n) + n) % n;

  function grid(stops) {
    // grid[reel][row] with row 0 = top
    return stops.map((s, r) => [0, 1, 2].map((row) => STRIPS[r][mod(s + row, L)]));
  }
  function evaluate(g) {
    const wins = [];
    let total = 0;
    LINES.forEach((ln, li) => {
      const a = g[0][ln[0]];
      const b = g[1][ln[1]];
      const c = g[2][ln[2]];
      let m = 0;
      if (a === b && b === c) m = PAY[a];
      else if (a === 0 && b === 0) m = PAIR_CHERRY;
      if (m) {
        wins.push({ line: li, m, sym: a, three: a === b && b === c });
        total += m;
      }
    });
    return { wins, total };
  }
  // Exact base return-to-player over every possible stop combination.
  let BASE_RTP = 1;
  (function () {
    let sum = 0;
    for (let a = 0; a < L; a++) for (let b = 0; b < L; b++) for (let c = 0; c < L; c++) sum += evaluate(grid([a, b, c])).total;
    BASE_RTP = sum / (L * L * L);
  })();

  // ---------------- symbol art ----------------
  const sprites = [];
  let spriteSize = 0;
  function drawSymbol(c, id, S) {
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const rg = (x, y, r, stops) => {
      const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
      return g;
    };
    c.shadowColor = 'rgba(0,0,0,0.45)';
    c.shadowBlur = S * 0.06;
    c.shadowOffsetY = S * 0.03;
    if (id === 'cherry') {
      c.strokeStyle = '#2f8a2a';
      c.lineWidth = S * 0.05;
      c.beginPath();
      c.moveTo(S * 0.36, S * 0.52);
      c.quadraticCurveTo(S * 0.42, S * 0.28, S * 0.64, S * 0.16);
      c.moveTo(S * 0.66, S * 0.56);
      c.quadraticCurveTo(S * 0.64, S * 0.34, S * 0.64, S * 0.16);
      c.stroke();
      c.fillStyle = rg(S * 0.72, S * 0.2, S * 0.16, ['#b6ff8a', '#3cc43a', '#16681a']);
      c.beginPath();
      c.ellipse(S * 0.76, S * 0.2, S * 0.16, S * 0.07, -0.5, 0, Math.PI * 2);
      c.fill();
      [
        [0.34, 0.66, 0.2],
        [0.67, 0.71, 0.19],
      ].forEach(([x, y, r]) => {
        c.fillStyle = rg(S * x, S * y, S * r, ['#ffb3bd', '#f0143a', '#6e0012']);
        c.beginPath();
        c.arc(S * x, S * y, S * r, 0, Math.PI * 2);
        c.fill();
        c.shadowColor = 'transparent';
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.ellipse(S * (x - 0.07), S * (y - 0.08), S * 0.05, S * 0.028, -0.6, 0, Math.PI * 2);
        c.fill();
        c.shadowColor = 'rgba(0,0,0,0.45)';
      });
    } else if (id === 'lemon') {
      c.translate(S * 0.5, S * 0.52);
      c.rotate(-0.4);
      c.fillStyle = rg(0, 0, S * 0.38, ['#fffbd0', '#ffe01a', '#c98a00']);
      c.beginPath();
      c.ellipse(0, 0, S * 0.36, S * 0.26, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(S * 0.36, 0, S * 0.07, S * 0.06, 0, 0, Math.PI * 2);
      c.ellipse(-S * 0.36, 0, S * 0.07, S * 0.06, 0, 0, Math.PI * 2);
      c.fill();
      c.shadowColor = 'transparent';
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.beginPath();
      c.ellipse(-S * 0.1, -S * 0.12, S * 0.14, S * 0.05, -0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(170,110,0,0.25)';
      for (let i = 0; i < 14; i++) {
        c.beginPath();
        c.arc(Math.cos(i * 2.4) * S * 0.22, Math.sin(i * 1.7) * S * 0.14, S * 0.012, 0, Math.PI * 2);
        c.fill();
      }
    } else if (id === 'bell') {
      const body = new Path2D();
      body.moveTo(S * 0.5, S * 0.14);
      body.bezierCurveTo(S * 0.27, S * 0.14, S * 0.25, S * 0.4, S * 0.23, S * 0.56);
      body.bezierCurveTo(S * 0.21, S * 0.69, S * 0.13, S * 0.72, S * 0.13, S * 0.78);
      body.lineTo(S * 0.87, S * 0.78);
      body.bezierCurveTo(S * 0.87, S * 0.72, S * 0.79, S * 0.69, S * 0.77, S * 0.56);
      body.bezierCurveTo(S * 0.75, S * 0.4, S * 0.73, S * 0.14, S * 0.5, S * 0.14);
      body.closePath();
      c.fillStyle = '#b36f00';
      c.beginPath();
      c.arc(S * 0.5, S * 0.86, S * 0.07, 0, Math.PI * 2);
      c.fill();
      const g = c.createLinearGradient(S * 0.15, 0, S * 0.85, 0);
      g.addColorStop(0, '#a86100');
      g.addColorStop(0.3, '#fff2a8');
      g.addColorStop(0.55, '#ffc82e');
      g.addColorStop(1, '#8a4c00');
      c.fillStyle = g;
      c.fill(body);
      c.beginPath();
      c.arc(S * 0.5, S * 0.12, S * 0.05, 0, Math.PI * 2);
      c.fill();
      c.shadowColor = 'transparent';
      c.fillStyle = '#d88a00';
      c.fillRect(S * 0.12, S * 0.74, S * 0.76, S * 0.07);
      c.strokeStyle = 'rgba(255,255,255,0.65)';
      c.lineWidth = S * 0.035;
      c.beginPath();
      c.moveTo(S * 0.36, S * 0.26);
      c.quadraticCurveTo(S * 0.3, S * 0.4, S * 0.3, S * 0.56);
      c.stroke();
    } else if (id === 'clover') {
      const leaf = new Path2D(
        'M12 11.6C10 10 7.6 9.3 7.6 7.1c0-1.4 1.1-2.4 2.3-2.4.9 0 1.6.5 2.1 1.2.5-.7 1.2-1.2 2.1-1.2 1.2 0 2.3 1 2.3 2.4 0 2.2-2.4 2.9-4.4 4.5z'
      );
      c.strokeStyle = '#1f7a2a';
      c.lineWidth = S * 0.05;
      c.beginPath();
      c.moveTo(S * 0.52, S * 0.52);
      c.quadraticCurveTo(S * 0.6, S * 0.72, S * 0.76, S * 0.9);
      c.stroke();
      const k = S / 24;
      for (let i = 0; i < 4; i++) {
        c.save();
        c.translate(S * 0.5, S * 0.47);
        c.rotate((i * Math.PI) / 2);
        c.translate(-12 * k * 1.25, -12 * k * 1.25);
        c.scale(k * 1.25, k * 1.25);
        const g = c.createRadialGradient(12, 7, 0.5, 12, 8, 6);
        g.addColorStop(0, '#caff9a');
        g.addColorStop(0.5, '#3ed45a');
        g.addColorStop(1, '#0f6e26');
        c.fillStyle = g;
        c.fill(leaf);
        c.restore();
      }
    } else if (id === 'diamond') {
      const P = (x, y) => [S * x, S * y];
      const poly = (pts, fill) => {
        c.fillStyle = fill;
        c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(...P(...p)) : c.moveTo(...P(...p))));
        c.closePath();
        c.fill();
      };
      poly(
        [
          [0.27, 0.22],
          [0.73, 0.22],
          [0.92, 0.4],
          [0.5, 0.88],
          [0.08, 0.4],
        ],
        '#1a5cff'
      );
      c.shadowColor = 'transparent';
      poly(
        [
          [0.27, 0.22],
          [0.5, 0.22],
          [0.38, 0.4],
          [0.08, 0.4],
        ],
        '#b5e6ff'
      );
      poly(
        [
          [0.5, 0.22],
          [0.73, 0.22],
          [0.62, 0.4],
          [0.38, 0.4],
        ],
        '#e8f8ff'
      );
      poly(
        [
          [0.73, 0.22],
          [0.92, 0.4],
          [0.62, 0.4],
        ],
        '#6fb8ff'
      );
      poly(
        [
          [0.08, 0.4],
          [0.38, 0.4],
          [0.5, 0.88],
        ],
        '#4a8dff'
      );
      poly(
        [
          [0.38, 0.4],
          [0.62, 0.4],
          [0.5, 0.88],
        ],
        '#8fd0ff'
      );
      poly(
        [
          [0.62, 0.4],
          [0.92, 0.4],
          [0.5, 0.88],
        ],
        '#1f47c9'
      );
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = S * 0.012;
      c.beginPath();
      c.moveTo(...P(0.08, 0.4));
      c.lineTo(...P(0.92, 0.4));
      c.stroke();
      c.fillStyle = '#fff';
      c.beginPath();
      const sx = S * 0.3;
      const sy = S * 0.28;
      const r = S * 0.09;
      c.moveTo(sx, sy - r);
      c.quadraticCurveTo(sx, sy, sx + r, sy);
      c.quadraticCurveTo(sx, sy, sx, sy + r);
      c.quadraticCurveTo(sx, sy, sx - r, sy);
      c.quadraticCurveTo(sx, sy, sx, sy - r);
      c.fill();
    } else if (id === 'seven') {
      c.font = `italic 900 ${S * 0.92}px "Arial Black", "Segoe UI", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = S * 0.1;
      c.strokeStyle = '#ffd23f';
      c.strokeText('7', S * 0.5, S * 0.54);
      c.shadowColor = 'transparent';
      c.lineWidth = S * 0.04;
      c.strokeStyle = '#7a3a00';
      c.strokeText('7', S * 0.5, S * 0.54);
      const g = c.createLinearGradient(0, S * 0.1, 0, S * 0.95);
      g.addColorStop(0, '#ff9a9a');
      g.addColorStop(0.45, '#ff1a2e');
      g.addColorStop(1, '#7a0010');
      c.fillStyle = g;
      c.fillText('7', S * 0.5, S * 0.54);
    }
    c.restore();
  }
  function buildSprites(size) {
    if (size === spriteSize) return;
    spriteSize = size;
    SYM.forEach((id, i) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      drawSymbol(cv.getContext('2d'), id, size);
      sprites[i] = cv;
    });
  }
  A.slotSymbolImage = (i, size) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    drawSymbol(cv.getContext('2d'), SYM[i], size);
    return cv.toDataURL();
  };

  // ---------------- game ----------------
  const S = { id: 'slots', icon: 'slot' };
  let el;
  let cv;
  let ctx;
  let bet;
  let spinBtn;
  let lever;
  let jackEl;
  let winEl;
  let reelsEl;
  let busy = false;
  let visible = false;
  const reels = [0, 1, 2].map((i) => ({ pos: U.randi(0, L - 1), phase: 'idle', v: 0, t: 0, from: 0, to: 0, dur: 0, glow: 0 }));
  let spin = null;
  let winFx = null;
  let jackShown = -1;

  S.build = (view) => {
    el = view;
    el.classList.add('g-slots');
    const bulbs = Array.from({ length: 11 }, (_, i) => `<i style="--d:${i}"></i>`).join('');
    const pay = SYM.map((_, i) => i)
      .reverse()
      .map((i) => `<div class="pay"><img alt="" src="${A.slotSymbolImage(i, 48)}"><b>x${PAY[i]}</b></div>`)
      .join('');
    el.innerHTML = `
      <div class="slot-machine">
        <div class="sm-top">
          <div class="sm-jack">${A.icon('crown')}<span class="sm-jack-num">0</span></div>
        </div>
        <div class="sm-body">
          <div class="sm-bulbs top">${bulbs}</div>
          <div class="sm-bulbs bot">${bulbs}</div>
          <div class="sm-window">
            <canvas class="sm-reels"></canvas>
            <div class="sm-glass"></div>
            <div class="sm-lines">${LINES.map((_, i) => `<span style="--c:${LINE_COLORS[i]}"></span>`).join('')}</div>
          </div>
          <div class="sm-win"><span data-icon="coin"></span><b class="sm-win-num">0</b></div>
        </div>
        <div class="sm-pay">${pay}</div>
        <button class="sm-lever" aria-label="lever"><span class="stick"></span><span class="knob"></span></button>
      </div>
      <div class="game-controls">
        <div class="bet-host"></div>
        <button class="btn btn-gold btn-round spin-btn">${A.icon('spin')}<span class="spin-amt"></span></button>
      </div>`;
    cv = el.querySelector('.sm-reels');
    ctx = cv.getContext('2d');
    reelsEl = el.querySelector('.sm-window');
    jackEl = el.querySelector('.sm-jack-num');
    winEl = el.querySelector('.sm-win');
    bet = new A.Bet(el.querySelector('.bet-host'), 'slots');
    bet.mountAmount(el.querySelector('.spin-amt'));
    spinBtn = el.querySelector('.spin-btn');
    lever = el.querySelector('.sm-lever');
    spinBtn.addEventListener('click', () => S.spin(spinBtn));
    lever.addEventListener('click', () => S.spin(lever));
    A.ui.fillIcons(el);
  };

  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(10, Math.round(r.width * dpr));
    cv.height = Math.max(10, Math.round(r.height * dpr));
    buildSprites(Math.round((cv.height / 3) * 0.78));
  }

  S.show = () => {
    visible = true;
    resize();
  };
  S.hide = () => (visible = false);
  S.resize = () => visible && resize();
  S.busy = () => busy;

  S.spin = (src) => {
    if (busy) return;
    const amount = bet.amount();
    if (!A.game.placeBet(amount)) {
      A.sfx.deny();
      A.ui.denyShake(src);
      return;
    }
    busy = true;
    bet.lock(true);
    winFx = null;
    winEl.classList.remove('on');
    el.classList.remove('won');
    lever.classList.remove('pull');
    void lever.offsetWidth;
    lever.classList.add('pull');
    A.sfx.lever();
    const stops = [0, 1, 2].map(() => U.randi(0, L - 1));
    const g = grid(stops);
    const res = evaluate(g);
    // suspense when the first two reels could still line up something juicy
    let tease = false;
    LINES.forEach((ln) => {
      const a = g[0][ln[0]];
      if (a >= 2 && a === g[1][ln[1]]) tease = true;
    });
    spin = { t: 0, stops, g, res, amount, tease, stopped: 0, teaseOn: false };
    reels.forEach((r, i) => {
      r.phase = 'wind';
      r.t = 0;
      r.from = r.pos;
      r.stopAt = 0.55 + i * 0.38 + (i === 2 && tease ? 1.3 : 0);
      r.glow = 0;
    });
  };

  function updateReels(dt) {
    const SPEED = 20;
    reels.forEach((r, i) => {
      r.t += dt;
      if (r.phase === 'wind') {
        r.pos = r.from + Math.sin(Math.min(1, r.t / 0.15) * Math.PI) * 0.25;
        if (r.t >= 0.15) {
          r.phase = 'spin';
          r.v = 0;
        }
      } else if (r.phase === 'spin') {
        r.v = Math.min(SPEED, r.v + dt * 90);
        r.pos -= r.v * dt;
        if (spin && spin.t >= r.stopAt) {
          // The strip is a blur at full speed, so we can silently re-align it
          // to land on the predetermined stop after a fixed deceleration.
          const target = spin.stops[i];
          let to = Math.floor(r.pos - 4.5);
          const delta = target - mod(to, L);
          r.pos += delta;
          to += delta;
          r.from = r.pos;
          r.to = to;
          r.dur = (3 * (r.from - r.to)) / SPEED;
          r.t = 0;
          r.phase = 'stop';
          if (i === 2 && spin.teaseOn) {
            A.sfx.tension(false);
            spin.teaseOn = false;
          }
        }
      } else if (r.phase === 'stop') {
        const k = Math.min(1, r.t / r.dur);
        r.pos = r.from + (r.to - r.from) * U.ease.outCubic(k);
        if (k >= 1) {
          r.phase = 'bounce';
          r.t = 0;
          A.sfx.reelStop(i);
          A.fx.shake(2.5, 0.12);
          if (spin) spin.stopped++;
          if (spin && i === 1 && spin.tease) {
            A.sfx.tension(true);
            spin.teaseOn = true;
            reels[2].glow = 1;
          }
        }
      } else if (r.phase === 'bounce') {
        r.pos = r.to - Math.sin(r.t * 22) * 0.1 * Math.exp(-r.t * 10);
        if (r.t > 0.35) {
          r.pos = mod(r.to, L);
          r.phase = 'idle';
        }
      }
      if (r.phase === 'idle' || r.phase === 'bounce') r.glow = Math.max(0, r.glow - dt * 2);
    });
    if (spin) {
      spin.t += dt;
      if (spin.stopped >= 3 && reels.every((r) => r.phase === 'idle')) finish();
    }
  }

  function finish() {
    const sp = spin;
    spin = null;
    busy = false;
    bet.lock(false);
    const { res, amount, g } = sp;
    const scale = A.game.rtp() / BASE_RTP;
    let win = res.total * amount * scale;
    const jack = g[0][1] === 5 && g[1][1] === 5 && g[2][1] === 5;
    const r = U.center(reelsEl);
    if (jack) win += A.game.winJackpot();
    if (win > 0) {
      winFx = { wins: res.wins, t: 0 };
      const tier = A.game.payout(win, amount);
      el.classList.add('won');
      winEl.querySelector('.sm-win-num').textContent = U.fmt(win);
      winEl.classList.add('on');
      if (jack) A.ui.jackpot(r.x, r.y, Math.floor(win));
      else A.ui.celebrate(r.x, r.y, Math.floor(win), amount, tier);
    } else {
      A.game.payout(0, amount);
      A.ui.loseText(r.x, r.y, amount);
    }
  }

  function draw() {
    const W = cv.width;
    const H = cv.height;
    const c = ctx;
    c.clearRect(0, 0, W, H);
    const colW = W / 3;
    const cell = H / 3;
    const ss = spriteSize;
    for (let i = 0; i < 3; i++) {
      const r = reels[i];
      const x0 = i * colW;
      // reel drum
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#c9c3d6');
      bg.addColorStop(0.18, '#fbfaff');
      bg.addColorStop(0.82, '#fbfaff');
      bg.addColorStop(1, '#c9c3d6');
      c.fillStyle = bg;
      c.fillRect(x0 + 2, 0, colW - 4, H);
      if (r.glow > 0) {
        c.fillStyle = `rgba(255,200,40,${0.25 * r.glow * (0.6 + 0.4 * Math.sin(performance.now() / 60))})`;
        c.fillRect(x0 + 2, 0, colW - 4, H);
      }
      const base = Math.floor(r.pos);
      const frac = r.pos - base;
      const speed = r.phase === 'spin' ? r.v : r.phase === 'stop' ? 6 : 0;
      c.save();
      c.beginPath();
      c.rect(x0 + 2, 0, colW - 4, H);
      c.clip();
      for (let k = -1; k <= 3; k++) {
        const sym = STRIPS[i][mod(base + k, L)];
        const cy = (k - frac) * cell + cell / 2;
        const img = sprites[sym];
        if (!img) continue;
        const sx = x0 + colW / 2 - ss / 2;
        if (speed > 8) {
          c.globalAlpha = 0.35;
          c.drawImage(img, sx, cy - ss / 2 - cell * 0.2, ss, ss * 1.25);
          c.globalAlpha = 0.5;
          c.drawImage(img, sx, cy - ss / 2, ss, ss * 1.1);
          c.globalAlpha = 1;
        } else {
          let scl = 1;
          if (winFx && k >= 0 && k <= 2) {
            const hit = winFx.wins.some((w) => LINES[w.line][i] === k && (w.three || i < 2));
            if (hit) scl = 1 + 0.1 * Math.abs(Math.sin(winFx.t * 6));
          }
          c.drawImage(img, x0 + colW / 2 - (ss * scl) / 2, cy - (ss * scl) / 2, ss * scl, ss * scl);
        }
      }
      c.restore();
      // separators
      c.fillStyle = 'rgba(40,20,60,0.9)';
      c.fillRect(x0, 0, 3, H);
    }
    // winning lines
    if (winFx) {
      const n = winFx.wins.length;
      winFx.wins.forEach((w, idx) => {
        const active = n === 1 || Math.floor(winFx.t * 1.5) % n === idx;
        const ln = LINES[w.line];
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.strokeStyle = LINE_COLORS[w.line];
        c.shadowColor = LINE_COLORS[w.line];
        c.shadowBlur = active ? 24 : 8;
        c.globalAlpha = active ? 1 : 0.35;
        c.lineWidth = H * 0.025;
        c.beginPath();
        const pts = ln.map((row, i) => [i * colW + colW / 2, row * cell + cell / 2]);
        c.moveTo(4, pts[0][1]);
        pts.forEach((p) => c.lineTo(p[0], p[1]));
        c.lineTo(W - 4, pts[2][1]);
        c.stroke();
        c.restore();
      });
    }
  }

  S.frame = (dt, vis) => {
    updateReels(dt);
    if (winFx) winFx.t += dt;
    if (!vis) return;
    bet.refresh();
    draw();
    const j = Math.floor(A.game.s.jackpot);
    if (j !== jackShown) {
      jackShown = j;
      jackEl.textContent = U.fmt(j);
    }
  };

  S.BASE_RTP = () => BASE_RTP;
  (A.games = A.games || {}).slots = S;
})();
