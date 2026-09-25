/* Cut-scenes: intro, elevator ride between floors, vault locks and the grand finale. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;
  const E = A.econ;

  // ---------------- vault door art ----------------
  const V = {};
  V.paint = (c, cx, cy, R, o) => {
    o = o || {};
    const locks = o.locks || 0;
    const time = o.time || 0;
    const spin = o.spin || 0;
    const bolts = o.bolts === undefined ? 1 : o.bolts; // 1 = locked out, 0 = retracted
    // frame
    const fr = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.12);
    fr.addColorStop(0, '#1b1407');
    fr.addColorStop(0.4, '#6b5a3a');
    fr.addColorStop(0.6, '#2c2412');
    fr.addColorStop(1, '#0d0a04');
    c.fillStyle = fr;
    c.beginPath();
    c.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
    c.fill();
    // bolts
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
      c.save();
      c.translate(cx, cy);
      c.rotate(a);
      const ext = R * (0.86 + 0.18 * bolts);
      const bg = c.createLinearGradient(0, -R * 0.045, 0, R * 0.045);
      bg.addColorStop(0, '#fff3c4');
      bg.addColorStop(0.5, '#b89448');
      bg.addColorStop(1, '#4a3a14');
      c.fillStyle = bg;
      c.fillRect(R * 0.7, -R * 0.045, ext - R * 0.7, R * 0.09);
      c.restore();
    }
    // door face
    const df = c.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    df.addColorStop(0, '#d9c9a0');
    df.addColorStop(0.45, '#8a7446');
    df.addColorStop(1, '#2e2410');
    c.fillStyle = df;
    c.beginPath();
    c.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
    c.fill();
    // brushed rings
    c.lineWidth = Math.max(1, R * 0.006);
    for (let i = 0; i < 16; i++) {
      c.strokeStyle = i % 2 ? 'rgba(255,240,200,0.08)' : 'rgba(0,0,0,0.12)';
      c.beginPath();
      c.arc(cx, cy, R * (0.3 + i * 0.037), 0, Math.PI * 2);
      c.stroke();
    }
    c.lineWidth = R * 0.025;
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,235,180,0.25)';
    c.beginPath();
    c.arc(cx - 1, cy - 1, R * 0.82, 0, Math.PI * 2);
    c.stroke();
    // rivets
    c.fillStyle = 'rgba(255,240,200,0.55)';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.beginPath();
      c.arc(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, R * 0.012, 0, Math.PI * 2);
      c.fill();
    }
    // handle wheel
    c.save();
    c.translate(cx, cy);
    c.rotate(spin + time * 0.05);
    c.strokeStyle = '#e8d49a';
    c.lineCap = 'round';
    c.lineWidth = R * 0.05;
    for (let i = 0; i < 5; i++) {
      c.rotate((Math.PI * 2) / 5);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -R * 0.62);
      c.stroke();
      const kg = c.createRadialGradient(-R * 0.01, -R * 0.63, 1, 0, -R * 0.62, R * 0.06);
      kg.addColorStop(0, '#fff8dc');
      kg.addColorStop(1, '#8a6a20');
      c.fillStyle = kg;
      c.beginPath();
      c.arc(0, -R * 0.62, R * 0.06, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // lock lights
    for (let i = 0; i < E.LOCKS.length; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.32;
      const x = cx + Math.cos(a) * R * 0.99;
      const y = cy + Math.sin(a) * R * 0.99;
      const open = i < locks;
      const pul = 0.6 + 0.4 * Math.sin(time * 4 + i);
      c.fillStyle = open ? '#3dff9a' : `rgba(255,${40 + 30 * pul},60,1)`;
      c.shadowColor = open ? '#3dff9a' : '#ff2d4a';
      c.shadowBlur = R * 0.08;
      c.beginPath();
      c.arc(x, y, R * 0.035, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }
  };
  V.drawDoor = (cv, o) => {
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const R = Math.min(cv.width, cv.height) * 0.43;
    c.globalAlpha = 0.95;
    V.paint(c, cv.width / 2, cv.height / 2, R, o);
    c.globalAlpha = 1;
  };
  A.vault = V;

  // ---------------- cinema ----------------
  const C = {};
  let busy = false;
  let skip = null;
  C.busy = () => busy;
  const host = () => document.getElementById('cinema');

  function overlay(cls) {
    const h = host();
    h.innerHTML = '';
    h.className = 'on ' + (cls || '');
    return h;
  }
  function closeOverlay() {
    const h = host();
    h.className = '';
    h.innerHTML = '';
  }

  // ---- intro: a single coin drops into the dark basement, lights flicker on ----
  C.intro = () =>
    new Promise((resolve) => {
      busy = true;
      const h = overlay('intro');
      const cv = U.el('canvas');
      h.appendChild(cv);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      const c = cv.getContext('2d');
      const floorY = H * 0.62;
      let y = -60;
      let vy = 0;
      let x = W / 2;
      let spinA = 0;
      let bounces = 0;
      let t = 0;
      let phase = 'fall';
      let flick = 0;
      let done = false;
      const R = Math.min(W, H) * 0.06;
      const finish = () => {
        if (done) return;
        done = true;
        h.classList.add('fade');
        A.sfx.whoosh(true);
        setTimeout(() => {
          closeOverlay();
          busy = false;
          resolve();
        }, 700);
      };
      skip = finish;
      h.addEventListener('pointerdown', finish, { once: true });
      const drawCoin = (sx) => {
        c.save();
        c.translate(x, y);
        c.scale(Math.max(0.08, Math.abs(sx)), 1);
        const g = c.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
        g.addColorStop(0, '#ffe4c4');
        g.addColorStop(0.55, '#e39a5c');
        g.addColorStop(1, '#7a3d14');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, R, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(90,40,10,0.7)';
        c.lineWidth = R * 0.12;
        c.beginPath();
        c.arc(0, 0, R * 0.68, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      };
      let last = performance.now();
      const step = (now) => {
        if (done) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = '#000';
        c.fillRect(0, 0, W, H);
        // faint light cone from above
        const lc = c.createRadialGradient(W / 2, floorY, 0, W / 2, floorY, H * 0.5);
        lc.addColorStop(0, `rgba(255,220,160,${0.08 + (phase === 'flicker' ? flick * 0.3 : 0)})`);
        lc.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = lc;
        c.fillRect(0, 0, W, H);
        if (phase === 'fall') {
          vy += 2600 * dt;
          y += vy * dt;
          spinA += dt * 14;
          if (y > floorY - R) {
            y = floorY - R;
            vy = -vy * 0.45;
            bounces++;
            A.sfx.clink();
            A.fx.sparks(x, floorY, 6 + bounces * 2, '#ffd6a0', { max: 220 });
            if (bounces >= 3) {
              phase = 'spin';
              t = 0;
            }
          }
          drawCoin(Math.cos(spinA));
        } else if (phase === 'spin') {
          // settling wobble like a spinning coin on a table
          const k = Math.min(1, t / 1.1);
          spinA += dt * (26 - k * 18);
          y = floorY - R;
          drawCoin(Math.cos(spinA) * (1 - k * 0.2));
          if (Math.random() < dt * (10 - k * 6)) A.sfx.tick(2);
          if (k >= 1) {
            phase = 'flicker';
            t = 0;
          }
        } else if (phase === 'flicker') {
          drawCoin(1);
          const seq = [0.1, 0.18, 0.3, 0.36, 0.5, 0.55, 0.62];
          const on = seq.filter((s) => t > s).length % 2 === 1 || t > 0.7;
          if (on && flick < 0.5) A.sfx.tick(0.4);
          flick = on ? 1 : 0;
          if (on) {
            c.fillStyle = 'rgba(255,40,200,0.07)';
            c.fillRect(0, 0, W, H);
          }
          if (t > 0.9) finish();
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

  // ---- elevator between floors ----
  C.elevator = (floor) =>
    new Promise((resolve) => {
      busy = true;
      const h = overlay('elev');
      const f = E.FLOORS[floor];
      const icons = A.ui.FLOOR_ICONS;
      h.innerHTML = `
        <div class="el-door l"><i></i></div>
        <div class="el-door r"><i></i></div>
        <div class="el-panel">${icons
          .map((ic, i) => `<span class="${i < floor ? 'past' : i === floor ? 'cur' : ''}">${A.icon(ic)}</span>`)
          .join('')}<b class="el-arrow">${A.icon('up')}</b></div>
        <div class="el-reveal">
          <div class="el-big">${A.icon(icons[floor])}</div>
          <div class="el-name">${A.t('f_' + f.id)}</div>
        </div>`;
      A.sfx.door(false);
      A.sfx.music.muffle(true);
      requestAnimationFrame(() => h.classList.add('closed'));
      U.after(0.7, () => {
        A.fx.shake(6, 0.3);
        h.classList.add('moving');
        A.sfx.rumble(1.2);
      });
      U.after(1.5, () => {
        h.classList.add('arrived');
        A.ui.applyFloor(false);
        A.sfx.ding();
        A.sfx.music.muffle(false);
      });
      U.after(2.1, () => {
        A.sfx.levelUp();
        h.classList.add('show');
      });
      U.after(3.4, () => {
        h.classList.remove('closed', 'show');
        h.classList.add('open');
        A.sfx.door(true);
        const { w, hh } = { w: window.innerWidth, hh: window.innerHeight };
        A.fx.confetti(w / 2, hh * 0.3, 120);
        A.fx.flash('#ffffff', 0.25, 0.8);
        for (let i = 0; i < 3; i++) U.after(0.2 + i * 0.3, () => A.fx.firework(U.rand(w * 0.2, w * 0.8), U.rand(hh * 0.15, hh * 0.35)));
      });
      U.after(4.2, () => {
        closeOverlay();
        busy = false;
        resolve();
      });
    });

  // ---- one lock of the vault opens ----
  C.lock = (n) => {
    const v = A.ui.views.coin;
    const c = U.center(v);
    A.sfx.clunk(n >= E.LOCKS.length);
    A.fx.shake(16, 0.6);
    A.fx.flash('#3dff9a', 0.25, 0.6);
    A.fx.ring(c.x, c.y, '#3dff9a', 300, 0.8, 16);
    A.fx.sparks(c.x, c.y, 50, '#fff3b0', { max: 800 });
    const locks = E.LOCKS.map((_, i) => A.icon(i < n ? 'unlock' : 'lock')).join('');
    A.fx.banner(A.t('open'), 'green', { life: 1.8, sub: locks });
    A.ui.setTab('coin');
  };

  // ---- finale: the vault door swings open ----
  C.finale = () =>
    new Promise((resolve) => {
      busy = true;
      const h = overlay('finale');
      const cv = U.el('canvas');
      h.appendChild(cv);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      const c = cv.getContext('2d');
      const R = Math.min(W, H) * 0.38;
      let t = 0;
      let last = performance.now();
      const events = [];
      const at = (time, fn) => events.push({ time, fn });
      A.sfx.music.stop();
      at(0.1, () => A.sfx.clunk(true));
      for (let i = 0; i < 10; i++) at(0.9 + i * 0.09, () => A.sfx.tick(0.6));
      at(1.9, () => {
        A.sfx.rumble(2.2);
        A.fx.shake(10, 2);
      });
      at(3.4, () => {
        A.sfx.choir();
        A.fx.flash('#fff6d0', 0.9, 1.6);
        A.fx.shake(22, 1);
        A.fx.rain(4, 14);
        A.sfx.coinRain(4);
        A.fx.coinBurst(W / 2, H / 2, 80, { min: 300, max: 1100, life: 1.6, scale: 1.4 });
      });
      for (let i = 0; i < 12; i++) at(3.8 + i * 0.3, () => A.fx.firework(U.rand(W * 0.1, W * 0.9), U.rand(H * 0.1, H * 0.45)));
      at(4.2, () => A.fx.confetti(0, 0, 220, { wide: true, down: true }));
      const step = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        while (events.length && events[0].time <= t) events.shift().fn();
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const bg = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
        bg.addColorStop(0, '#2a1a05');
        bg.addColorStop(1, '#050301');
        c.fillStyle = bg;
        c.fillRect(0, 0, W, H);
        const spin = t < 0.9 ? 0 : Math.min(1, (t - 0.9) / 0.9) * Math.PI * 3;
        const bolts = t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.9);
        const openK = t < 1.9 ? 0 : U.ease.inOutCubic(Math.min(1, (t - 1.9) / 1.8));
        // light behind the door
        if (openK > 0) {
          const lg = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * (1 + openK * 2.5));
          lg.addColorStop(0, `rgba(255,255,240,${openK})`);
          lg.addColorStop(0.3, `rgba(255,214,90,${openK * 0.9})`);
          lg.addColorStop(1, 'rgba(255,160,20,0)');
          c.fillStyle = lg;
          c.fillRect(0, 0, W, H);
          c.save();
          c.translate(W / 2, H / 2);
          c.rotate(t * 0.4);
          c.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 18; i++) {
            c.rotate((Math.PI * 2) / 18);
            c.fillStyle = `rgba(255,220,120,${0.12 * openK})`;
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(-R * 0.25, -Math.max(W, H));
            c.lineTo(R * 0.25, -Math.max(W, H));
            c.closePath();
            c.fill();
          }
          c.restore();
          c.globalCompositeOperation = 'source-over';
        }
        // the door swings on its left hinge
        c.save();
        const hingeX = W / 2 - R * 1.12;
        c.translate(hingeX, H / 2);
        c.scale(1 - openK * 0.92, 1 + openK * 0.08);
        c.translate(-hingeX, -H / 2);
        c.globalAlpha = 1 - openK * 0.35;
        V.paint(c, W / 2, H / 2, R, { locks: E.LOCKS.length, time: t, spin, bolts });
        c.restore();
        if (t < 6.2) requestAnimationFrame(step);
        else {
          busy = false;
          resolve(() => {
            h.classList.add('fade');
            setTimeout(closeOverlay, 900);
          });
        }
      };
      requestAnimationFrame(step);
    });

  C.skip = () => skip && skip();
  A.cinema = C;
})();
