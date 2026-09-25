/* The big clickable coin, drawn on canvas with springy 3D-ish motion. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;

  const SKINS = [
    { face: ['#ffe4c4', '#e39a5c', '#7a3d14'], rim: '#5a2a0a', em: 'star' },
    { face: ['#ffffff', '#c9d4e4', '#56647c'], rim: '#36425a', em: 'spade' },
    { face: ['#fff6c2', '#ffc53a', '#a86400'], rim: '#734200', em: 'heart' },
    { face: ['#e8f1ff', '#6f9dff', '#1b3a8f'], rim: '#0d215e', em: 'diamond' },
    { face: ['#f0ffff', '#7ff0ff', '#177a96'], rim: '#0b4a5e', em: 'club' },
    { face: ['#fffbe0', '#ffd23f', '#c47400'], rim: '#7e4300', em: 'crown' },
  ];
  const FEVER = { face: ['#fff3c4', '#ff8a1f', '#b3200a'], rim: '#5e0d02' };

  function starPath() {
    const p = new Path2D();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 17 : 38;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 50 + Math.cos(a) * r;
      const y = 53 + Math.sin(a) * r;
      if (i) p.lineTo(x, y);
      else p.moveTo(x, y);
    }
    p.closePath();
    return p;
  }
  function clubPath() {
    const p = new Path2D();
    p.arc(50, 33, 15, 0, Math.PI * 2);
    p.moveTo(47, 57);
    p.arc(32, 57, 15, 0, Math.PI * 2);
    p.moveTo(83, 57);
    p.arc(68, 57, 15, 0, Math.PI * 2);
    p.moveTo(40, 44);
    p.rect(40, 40, 20, 22);
    p.moveTo(46, 58);
    p.lineTo(38, 86);
    p.lineTo(62, 86);
    p.lineTo(54, 58);
    p.closePath();
    return p;
  }
  const EMBLEMS = {
    star: starPath(),
    spade: new Path2D(
      'M50 12C62 30 84 42 84 60c0 12-10 18-20 18-6 0-10-3-12-6 1 8 4 14 10 16H38c6-2 9-8 10-16-2 3-6 6-12 6-10 0-20-6-20-18 0-18 22-30 34-48z'
    ),
    heart: new Path2D('M50 85C30 69 14 57 14 38c0-12 9-20 20-20 8 0 13 5 16 11 3-6 8-11 16-11 11 0 20 8 20 20 0 19-16 31-36 47z'),
    diamond: new Path2D('M50 12Q64 34 81 50 64 66 50 88 36 66 19 50 36 34 50 12z'),
    club: clubPath(),
    crown: new Path2D('M17 70L13 32l21 17 16-27 16 27 21-17-4 38zM19 75h62v10H19z'),
  };

  class BigCoin {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.c = canvas.getContext('2d');
      this.opts = opts || {};
      this.skin = SKINS[0];
      this.skinIdx = 0;
      this.fever = false;
      this.sq = 0;
      this.sqv = 0;
      this.tx = 0;
      this.ty = 0;
      this.tvx = 0;
      this.tvy = 0;
      this.hx = 0;
      this.hy = 0;
      this.time = Math.random() * 10;
      this.sweep = -1;
      this.spin = 0;
      this.feverRing = 0;
      this.hover = false;
      this.resize();
    }
    setSkin(i) {
      this.skinIdx = U.clamp(i, 0, SKINS.length - 1);
      this.skin = SKINS[this.skinIdx];
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(10, Math.round(r.width * dpr));
      const h = Math.max(10, Math.round(r.height * dpr));
      if (this.cv.width !== w || this.cv.height !== h) {
        this.cv.width = w;
        this.cv.height = h;
      }
      this.dpr = dpr;
    }
    // client point -> hit test + impulse
    hit(clientX, clientY) {
      const r = this.cv.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const R = Math.min(r.width, r.height) * 0.36;
      const dx = (clientX - cx) / R;
      const dy = (clientY - cy) / R;
      return dx * dx + dy * dy <= 1.15;
    }
    punch(clientX, clientY, power) {
      const r = this.cv.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const R = Math.min(r.width, r.height) * 0.36;
      const dx = U.clamp((clientX - cx) / R, -1, 1);
      const dy = U.clamp((clientY - cy) / R, -1, 1);
      const p = power || 1;
      this.sqv -= 5.5 * p;
      this.tvx += dx * 9 * p;
      this.tvy += dy * 9 * p;
      if (p > 1.5) this.sweep = 0;
    }
    look(clientX, clientY) {
      const r = this.cv.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      this.hx = U.clamp((clientX - cx) / r.width, -0.5, 0.5);
      this.hy = U.clamp((clientY - cy) / r.height, -0.5, 0.5);
    }
    center() {
      return U.center(this.cv);
    }
    update(dt) {
      this.time += dt;
      // springs
      const k = 220;
      const d = 14;
      this.sqv += (-k * this.sq - d * this.sqv) * dt;
      this.sq += this.sqv * dt;
      const tk = 140;
      const td = 11;
      const tgx = this.hx * 0.6;
      const tgy = this.hy * 0.6;
      this.tvx += (-tk * (this.tx - tgx) - td * this.tvx) * dt;
      this.tvy += (-tk * (this.ty - tgy) - td * this.tvy) * dt;
      this.tx += this.tvx * dt;
      this.ty += this.tvy * dt;
      if (this.sweep >= 0) {
        this.sweep += dt * 1.6;
        if (this.sweep > 1.4) this.sweep = -1;
      } else if (Math.random() < dt * 0.25) this.sweep = 0;
      if (this.opts.autoSpin) this.spin += dt * 1.3;
    }
    draw() {
      const c = this.c;
      const W = this.cv.width;
      const H = this.cv.height;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.36;
      const skin = this.fever ? Object.assign({}, this.skin, FEVER) : this.skin;
      const FX = A.fx;
      const g1 = 'rgba(' + (this.fever ? '255,120,20' : FX.rgb('g1')) + ',';

      // halo + rays
      c.globalCompositeOperation = 'lighter';
      const halo = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.36);
      halo.addColorStop(0, g1 + (this.fever ? 0.55 : 0.35) + ')');
      halo.addColorStop(1, g1 + '0)');
      c.fillStyle = halo;
      c.fillRect(0, 0, W, H);
      c.save();
      c.translate(cx, cy);
      c.rotate(this.time * (this.fever ? 0.9 : 0.15));
      const rays = 14;
      for (let i = 0; i < rays; i++) {
        c.rotate((Math.PI * 2) / rays);
        const rg = c.createLinearGradient(0, 0, 0, -R * 1.36);
        rg.addColorStop(0, g1 + (this.fever ? 0.22 : 0.1) + ')');
        rg.addColorStop(1, g1 + '0)');
        c.fillStyle = rg;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(-R * 0.12, -R * 1.36);
        c.lineTo(R * 0.12, -R * 1.36);
        c.closePath();
        c.fill();
      }
      c.restore();
      c.globalCompositeOperation = 'source-over';

      // body transform
      const scale = 1 + this.sq * 0.08;
      let sx = scale * (1 - Math.abs(this.tx) * 0.16);
      const sy = scale * (1 - Math.abs(this.ty) * 0.16);
      if (this.opts.autoSpin) sx *= Math.cos(this.spin);
      const facing = sx >= 0;
      sx = Math.abs(sx);
      const thick = R * 0.09;
      const ox = -this.tx * thick * 1.2;
      const oy = thick * (1 - this.ty * 0.8);

      c.save();
      c.translate(cx, cy + Math.sin(this.time * 1.8) * R * 0.02);
      // shadow
      c.save();
      c.scale(sx, sy * 0.25);
      c.translate(0, R * 4.6);
      const sh = c.createRadialGradient(0, 0, 0, 0, 0, R);
      sh.addColorStop(0, 'rgba(0,0,0,0.45)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sh;
      c.beginPath();
      c.arc(0, 0, R, 0, Math.PI * 2);
      c.fill();
      c.restore();

      c.scale(Math.max(0.02, sx), sy);
      // edge (thickness) with reeding
      c.fillStyle = skin.rim;
      c.beginPath();
      c.arc(ox, oy, R, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.14)';
      c.lineWidth = Math.max(1, R * 0.012);
      c.beginPath();
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        c.moveTo(ox + Math.cos(a) * R * 0.97, oy + Math.sin(a) * R * 0.97);
        c.lineTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97);
      }
      c.stroke();

      // face
      const fg = c.createRadialGradient(-R * 0.35 - this.tx * R * 0.4, -R * 0.4 - this.ty * R * 0.4, R * 0.05, 0, 0, R * 1.05);
      fg.addColorStop(0, skin.face[0]);
      fg.addColorStop(0.55, skin.face[1]);
      fg.addColorStop(1, skin.face[2]);
      c.fillStyle = fg;
      c.beginPath();
      c.arc(0, 0, R, 0, Math.PI * 2);
      c.fill();

      // outer bevel
      c.lineWidth = R * 0.05;
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.arc(0, 0, R * 0.965, Math.PI * 0.95, Math.PI * 1.75);
      c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.arc(0, 0, R * 0.965, Math.PI * -0.05, Math.PI * 0.75);
      c.stroke();

      // bead ring
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + this.time * 0.05;
        c.beginPath();
        c.arc(Math.cos(a) * R * 0.87 + 1, Math.sin(a) * R * 0.87 + 1, R * 0.022, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + this.time * 0.05;
        c.beginPath();
        c.arc(Math.cos(a) * R * 0.87, Math.sin(a) * R * 0.87, R * 0.018, 0, Math.PI * 2);
        c.fill();
      }

      // inner ring
      c.lineWidth = R * 0.035;
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.beginPath();
      c.arc(1.5, 2, R * 0.76, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.beginPath();
      c.arc(-0.5, -0.5, R * 0.76, 0, Math.PI * 2);
      c.stroke();

      // emblem
      if (facing || !this.opts.autoSpin) {
        const em = EMBLEMS[this.skin.em] || EMBLEMS.star;
        const es = (R * 1.1) / 100;
        c.save();
        c.translate(-50 * es, -50 * es);
        c.scale(es, es);
        c.translate(1.8, 2.6);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fill(em);
        c.translate(-2.6, -3.2);
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.fill(em);
        c.translate(0.8, 0.6);
        const eg = c.createLinearGradient(0, 10, 0, 90);
        eg.addColorStop(0, skin.face[0]);
        eg.addColorStop(0.5, skin.face[1]);
        eg.addColorStop(1, skin.face[2]);
        c.fillStyle = eg;
        c.fill(em);
        c.restore();
      } else {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.font = `900 ${R * 0.9}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('$', 2, 4);
        c.fillStyle = skin.face[0];
        c.fillText('$', 0, 0);
      }

      // specular sweep
      c.save();
      c.beginPath();
      c.arc(0, 0, R, 0, Math.PI * 2);
      c.clip();
      if (this.sweep >= 0) {
        const p = -1.4 + this.sweep * 2.8;
        c.rotate(-0.6);
        const sg = c.createLinearGradient(p * R - R * 0.3, 0, p * R + R * 0.3, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sg;
        c.fillRect(-R * 2, -R * 2, R * 4, R * 4);
      }
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.beginPath();
      c.ellipse(-R * 0.35 - this.tx * R * 0.2, -R * 0.5 - this.ty * R * 0.2, R * 0.35, R * 0.14, -0.5, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // fever ring (meter) around coin
      if (this.opts.meter !== undefined) {
        const m = this.opts.meter();
        this.feverRing = U.lerp(this.feverRing, m.value, 0.2);
        const rr = R * 1.18;
        c.lineCap = 'round';
        c.lineWidth = Math.max(4, R * 0.045);
        c.strokeStyle = 'rgba(255,255,255,0.08)';
        c.beginPath();
        c.arc(cx, cy, rr, 0, Math.PI * 2);
        c.stroke();
        if (this.feverRing > 0.002) {
          const gr = c.createLinearGradient(cx - rr, cy + rr, cx + rr, cy - rr);
          gr.addColorStop(0, '#ffd23f');
          gr.addColorStop(0.5, '#ff7a1a');
          gr.addColorStop(1, '#ff2d55');
          c.strokeStyle = gr;
          c.shadowColor = '#ff7a1a';
          c.shadowBlur = m.active ? 30 : 14;
          c.beginPath();
          c.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.feverRing);
          c.stroke();
          c.shadowBlur = 0;
        }
      }
    }
    frame(dt) {
      this.update(dt);
      this.draw();
    }
  }

  A.BigCoin = BigCoin;
  A.coinSkins = SKINS;
})();
