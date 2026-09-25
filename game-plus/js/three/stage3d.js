/* WebGL layer built on Three.js: a shader background, physically based metal coins with bloom,
   instanced 3D coin showers and the 3D vault door. Everything renders into one canvas that sits
   behind the UI; DOM elements act as anchors that the 3D objects follow. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;

  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.1/';
  A.loadThree = () => {
    if (A._threeP) return A._threeP;
    const probe = document.createElement('canvas');
    const gl = window.WebGL2RenderingContext && probe.getContext('webgl2');
    let ok = !!gl;
    if (gl) {
      // Software-rendered WebGL (no GPU) is far too slow for bloom and PBR: use the 2D renderer.
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) && !/[?&]gl=1/.test(location.search)) ok = false;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
    if (!ok || !window.gsap) return (A._threeP = Promise.resolve(null));
    const add = (p) => import(CDN + 'examples/jsm/' + p + '/+esm');
    const load = Promise.all([
      import(CDN + '+esm'),
      add('postprocessing/EffectComposer.js'),
      add('postprocessing/RenderPass.js'),
      add('postprocessing/UnrealBloomPass.js'),
      add('postprocessing/OutputPass.js'),
    ]).then(([T, EC, RP, UB, OP]) => ({
      THREE: T,
      EffectComposer: EC.EffectComposer,
      RenderPass: RP.RenderPass,
      UnrealBloomPass: UB.UnrealBloomPass,
      OutputPass: OP.OutputPass,
    }));
    const timeout = new Promise((res) => setTimeout(() => res(null), 12000));
    A._threeP = Promise.race([load, timeout]).catch((e) => {
      console.warn('3D disabled:', e && e.message);
      return null;
    });
    return A._threeP;
  };

  const BG_FRAG = `
    precision highp float;
    uniform float uTime, uPulse, uAspect;
    uniform vec3 uTop, uBot, uG1, uG2, uGrid;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }
    void main() {
      vec2 uv = vUv;
      vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y);
      vec3 col = mix(uBot, uTop, smoothstep(0.0, 1.0, uv.y));
      // slow neon smoke
      float n = fbm(p * 2.2 + vec2(uTime * 0.03, -uTime * 0.02));
      float n2 = fbm(p * 3.4 - vec2(uTime * 0.02, uTime * 0.035) + n * 1.5);
      col += uG1 * pow(n2, 3.0) * (0.32 + uPulse * 0.3);
      col += uG2 * pow(n, 4.0) * 0.28;
      // drifting glows
      vec2 c1 = vec2(-0.38 * uAspect + sin(uTime * 0.13) * 0.25, 0.74 + cos(uTime * 0.1) * 0.08);
      vec2 c2 = vec2(0.38 * uAspect + cos(uTime * 0.11) * 0.25, 0.6 + sin(uTime * 0.09) * 0.1);
      col += uG1 * 0.2 * exp(-dot(p - c1, p - c1) * 5.0);
      col += uG2 * 0.18 * exp(-dot(p - c2, p - c2) * 5.0);
      // sweeping spotlights
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 o = vec2((fi * 2.0 - 1.0) * 0.4 * uAspect, 1.08);
        float th = sin(uTime * 0.33 + fi * 2.1) * 0.5;
        vec2 dir = vec2(sin(th), -cos(th));
        vec2 d = p - o;
        float along = dot(d, dir);
        float perp = abs(d.x * dir.y - d.y * dir.x);
        float cone = smoothstep(along * 0.26, along * 0.1, perp) * step(0.0, along) * exp(-along * 0.9);
        col += (fi < 0.5 ? uG1 : uG2) * cone * 0.11;
      }
      // perspective neon floor
      float h = 0.34;
      if (uv.y < h) {
        float depth = h - uv.y;
        float z = 0.09 / max(depth, 0.001);
        vec2 g = vec2((uv.x - 0.5) * uAspect * z * 3.2, z + uTime * 0.55);
        vec2 gd = abs(fract(g) - 0.5) / max(fwidth(g), vec2(0.0001));
        float line = 1.0 - min(min(gd.x, gd.y), 1.0);
        float fade = smoothstep(0.0, 0.22, depth);
        col *= mix(1.0, 0.5, smoothstep(0.0, 0.3, depth));
        col += uGrid * line * (0.5 + uPulse * 0.5) * fade;
      }
      col += uGrid * exp(-abs(uv.y - h) * 45.0) * (0.45 + uPulse * 0.3);
      // twinkling dust
      vec2 sp = uv * vec2(uAspect, 1.0) * 38.0;
      vec2 id = floor(sp);
      float r = hash(id);
      if (r > 0.965 && uv.y > h) {
        vec2 f = fract(sp) - 0.5 + (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + r * 3.0) + r * 60.0);
        col += mix(uG1, vec3(1.0), 0.6) * smoothstep(0.09, 0.0, length(f)) * tw * 0.7;
      }
      float v = length(uv - 0.5) * 1.25;
      col *= 1.0 - 0.5 * v * v;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const EMBLEMS = {
    star: null,
    spade: 'M50 12C62 30 84 42 84 60c0 12-10 18-20 18-6 0-10-3-12-6 1 8 4 14 10 16H38c6-2 9-8 10-16-2 3-6 6-12 6-10 0-20-6-20-18 0-18 22-30 34-48z',
    heart: 'M50 85C30 69 14 57 14 38c0-12 9-20 20-20 8 0 13 5 16 11 3-6 8-11 16-11 11 0 20 8 20 20 0 19-16 31-36 47z',
    diamond: 'M50 12Q64 34 81 50 64 66 50 88 36 66 19 50 36 34 50 12z',
    club: null,
    crown: 'M17 70L13 32l21 17 16-27 16 27 21-17-4 38zM19 75h62v10H19z',
  };
  const SKINS = [
    { color: '#e5935a', em: 'star' },
    { color: '#dfe5ee', em: 'spade' },
    { color: '#ffc83a', em: 'heart' },
    { color: '#7d9dff', em: 'diamond' },
    { color: '#a6f5ff', em: 'club' },
    { color: '#ffd24a', em: 'crown' },
  ];

  function emblemPath(name) {
    if (name === 'star') {
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
    if (name === 'club') {
      const p = new Path2D();
      p.arc(50, 33, 15, 0, Math.PI * 2);
      p.moveTo(47, 57);
      p.arc(32, 57, 15, 0, Math.PI * 2);
      p.moveTo(83, 57);
      p.arc(68, 57, 15, 0, Math.PI * 2);
      p.rect(40, 40, 20, 22);
      p.moveTo(46, 58);
      p.lineTo(38, 86);
      p.lineTo(62, 86);
      p.lineTo(54, 58);
      p.closePath();
      return p;
    }
    return new Path2D(EMBLEMS[name]);
  }

  // Draws a coin face as a height map: raised emblem, rings and beads.
  function faceCanvas(draw, size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    c.fillStyle = '#000';
    c.fillRect(0, 0, size, size);
    c.save();
    c.filter = `blur(${size / 260}px)`;
    const s = size / 100;
    c.scale(s, s);
    c.strokeStyle = '#fff';
    c.fillStyle = '#fff';
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(50, 50, 44, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      c.beginPath();
      c.arc(50 + Math.cos(a) * 47.2, 50 + Math.sin(a) * 47.2, 0.9, 0, Math.PI * 2);
      c.fill();
    }
    draw(c);
    c.restore();
    return cv;
  }
  function roughFrom(height) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = height.width;
    const c = cv.getContext('2d');
    c.fillStyle = '#6a6a6a';
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'difference';
    c.globalAlpha = 0.72;
    c.drawImage(height, 0, 0);
    return cv;
  }

  const GL = { ok: false };

  A.initGL = (L) => {
    const THREE = L.THREE;
    GL.THREE = THREE;
    const canvas = document.getElementById('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.95;
    GL.renderer = renderer;
    let pr = Math.min(1.75, window.devicePixelRatio || 1);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // ---------- background ----------
    const bgScene = new THREE.Scene();
    const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bgU = {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uAspect: { value: 1 },
      uTop: { value: new THREE.Color() },
      uBot: { value: new THREE.Color() },
      uG1: { value: new THREE.Color() },
      uG2: { value: new THREE.Color() },
      uGrid: { value: new THREE.Color() },
    };
    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: bgU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: BG_FRAG,
        depthTest: false,
        depthWrite: false,
      })
    );
    bgScene.add(bgMesh);

    // ---------- main scene ----------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    camera.position.set(0, 0, 20);
    // A dark photo studio: a warm softbox above, coloured rim strips in the floor's palette,
    // and a small fill behind the camera. Metal reflects this, so it sets the whole mood.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envCache = {};
    function studio(c1, c2, key) {
      if (key && envCache[key]) {
        scene.environment = envCache[key];
        return;
      }
      const env = new THREE.Scene();
      env.background = new THREE.Color(0x06040a);
      const panel = (w, h, color, k, x, y, z) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })
        );
        m.position.set(x, y, z);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      panel(7, 3, 0xfff0d8, 6, -1, 6, 5);
      panel(2.2, 9, c1, 4.5, -7, 0, 1.5);
      panel(2.2, 9, c2, 4.5, 7, 0, 1.5);
      panel(3, 1.6, 0xffffff, 2.2, 3, -1.5, 8);
      panel(12, 12, 0x2a1a30, 0.8, 0, -7, 0);
      const tex = pmrem.fromScene(env, 0.025, 0.1, 100, { size: 128 }).texture;
      if (key) envCache[key] = tex;
      scene.environment = tex;
      env.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
    }
    studio(0xff3fd0, 0x7a3cff, 'title');
    scene.environmentIntensity = 1;
    const key = new THREE.DirectionalLight(0xfff4e0, 0.9);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim1 = new THREE.PointLight(0xff3fd0, 28, 30, 1.6);
    rim1.position.set(-5, 3, 4);
    scene.add(rim1);
    const rim2 = new THREE.PointLight(0x7a3cff, 22, 30, 1.6);
    rim2.position.set(5, -3, 4);
    scene.add(rim2);
    const vaultLight = new THREE.PointLight(0xfff0c0, 0, 40, 1.2);
    scene.add(vaultLight);

    // ---------- post ----------
    const composer = new L.EffectComposer(renderer);
    composer.addPass(new L.RenderPass(bgScene, bgCam));
    const mainPass = new L.RenderPass(scene, camera);
    mainPass.clear = false;
    composer.addPass(mainPass);
    const bloom = new L.UnrealBloomPass(new THREE.Vector2(256, 256), 0.34, 0.45, 0.92);
    composer.addPass(bloom);
    composer.addPass(new L.OutputPass());
    GL.bloom = bloom;

    // ---------- helpers ----------
    let W = 1;
    let H = 1;
    let wpp = 0.01; // world units per CSS pixel on the z=0 plane
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      renderer.setPixelRatio(pr);
      renderer.setSize(W, H, false);
      composer.setPixelRatio(pr);
      composer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      bgU.uAspect.value = W / H;
      wpp = (2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360)) / H;
    }
    window.addEventListener('resize', resize);
    resize();
    const toWorld = (x, y, out) => (out || new THREE.Vector3()).set((x - W / 2) * wpp, -(y - H / 2) * wpp, 0);
    GL.toWorld = toWorld;

    const tex = (cv, color) => {
      const t = new THREE.CanvasTexture(cv);
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      return t;
    };

    // ---------- coin factory ----------
    const rimGeo = (() => {
      const pts = [
        [0.862, 0.05],
        [0.885, 0.076],
        [0.955, 0.081],
        [0.99, 0.067],
        [1.0, 0.046],
        [1.0, -0.046],
        [0.99, -0.067],
        [0.955, -0.081],
        [0.885, -0.076],
        [0.862, -0.05],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const g = new THREE.LatheGeometry(pts, 160);
      g.rotateX(Math.PI / 2);
      return g;
    })();
    const faceGeo = new THREE.CircleGeometry(0.866, 160);
    const reed = (() => {
      const cv = document.createElement('canvas');
      // ribs only on the outer wall (the middle band of the lathe profile)
      cv.width = 1024;
      cv.height = 90;
      const c = cv.getContext('2d');
      c.fillStyle = 'rgb(128,128,128)';
      c.fillRect(0, 0, 1024, 90);
      for (let i = 0; i < 1024; i++) {
        const v = 128 + 127 * Math.sin((i / 1024) * Math.PI * 2 * 150);
        c.fillStyle = `rgb(${v},${v},${v})`;
        c.fillRect(i, 41, 1, 8);
      }
      const t = tex(cv);
      t.wrapS = THREE.RepeatWrapping;
      return t;
    })();

    function metal(color, extra) {
      return new THREE.MeshStandardMaterial(
        Object.assign({ color: new THREE.Color(color), metalness: 1, roughness: 0.3, envMapIntensity: 1 }, extra || {})
      );
    }
    function faceMats(height, color) {
      const bump = tex(height);
      const rough = tex(roughFrom(height));
      return metal(color, { bumpMap: bump, bumpScale: 3.2, roughnessMap: rough, roughness: 1 });
    }
    function makeCoin(frontCv, backCv, color) {
      const g = new THREE.Group();
      const edge = metal(color, { bumpMap: reed, bumpScale: 1.2, roughness: 0.32, side: THREE.DoubleSide });
      const front = faceMats(frontCv, color);
      const back = faceMats(backCv, color);
      const rim = new THREE.Mesh(rimGeo, edge);
      const f = new THREE.Mesh(faceGeo, front);
      f.position.z = 0.05;
      const b = new THREE.Mesh(faceGeo, back);
      b.position.z = -0.05;
      b.rotation.y = Math.PI;
      g.add(rim, f, b);
      g.userData = { edge, front, back };
      return g;
    }
    const emblemCanvas = (name) =>
      faceCanvas((c) => {
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(50, 50, 37, 0, Math.PI * 2);
        c.stroke();
        c.save();
        c.translate(50, 50);
        c.scale(0.62, 0.62);
        c.translate(-50, -50);
        c.fill(emblemPath(name));
        c.restore();
      }, 1024);
    const backCanvas = faceCanvas((c) => {
      c.font = '900 46px Unbounded, "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('$', 50, 52);
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(50, 50, 30, 0, Math.PI * 2);
      c.stroke();
    }, 1024);

    const emblemCache = {};
    const emblemTex = (name) => (emblemCache[name] = emblemCache[name] || emblemCanvas(name));

    // ---------- main / title coin ----------
    const coin = makeCoin(emblemTex('star'), backCanvas, SKINS[0].color);
    scene.add(coin);
    const coinState = {
      anchors: {},
      active: null,
      vis: 0,
      sq: 0,
      sqv: 0,
      tx: 0,
      ty: 0,
      tvx: 0,
      tvy: 0,
      hx: 0,
      hy: 0,
      spin: 0,
      extraSpin: 0,
      fever: 0,
      skin: -1,
    };
    function applySkin(i) {
      if (coinState.skin === i) return;
      coinState.skin = i;
      const s = SKINS[U.clamp(i, 0, SKINS.length - 1)];
      const { edge, front } = coin.userData;
      [edge, front, coin.userData.back].forEach((m) => m.color.set(s.color));
      const h = emblemTex(s.em);
      front.bumpMap.image = h;
      front.bumpMap.needsUpdate = true;
      front.roughnessMap.image = roughFrom(h);
      front.roughnessMap.needsUpdate = true;
    }
    applySkin(0);

    // DOM-anchored adapter that mirrors the 2D BigCoin API used by the UI.
    GL.coinAdapter = (el, mode) => {
      const ad = {
        mode,
        el,
        skin: mode === 'title' ? 2 : 0,
        fever: false,
        hx: 0,
        hy: 0,
        setSkin(i) {
          ad.skin = i;
        },
        resize() {},
        frame() {},
        rect() {
          return el.getBoundingClientRect();
        },
        center() {
          return U.center(el);
        },
        hit(x, y) {
          const r = el.getBoundingClientRect();
          const R = Math.min(r.width, r.height) * 0.36;
          const dx = x - (r.left + r.width / 2);
          const dy = y - (r.top + r.height / 2);
          return dx * dx + dy * dy <= R * R * 1.15;
        },
        punch(x, y, power) {
          const r = el.getBoundingClientRect();
          const R = Math.min(r.width, r.height) * 0.36;
          const dx = U.clamp((x - (r.left + r.width / 2)) / R, -1, 1);
          const dy = U.clamp((y - (r.top + r.height / 2)) / R, -1, 1);
          const p = power || 1;
          coinState.sqv -= 5.5 * p;
          coinState.tvx += dx * 7 * p;
          coinState.tvy += dy * 7 * p;
          if (p > 1.5) window.gsap.to(coinState, { extraSpin: coinState.extraSpin + Math.PI * 2, duration: 0.7, ease: 'power3.out' });
        },
        look(x, y) {
          const r = el.getBoundingClientRect();
          coinState.hx = U.clamp((x - (r.left + r.width / 2)) / r.width, -0.5, 0.5);
          coinState.hy = U.clamp((y - (r.top + r.height / 2)) / r.height, -0.5, 0.5);
        },
      };
      coinState.anchors[mode] = ad;
      return ad;
    };

    // ---------- flip coin (sun / moon) ----------
    const iconFace = (name) =>
      faceCanvas((c) => {
        c.save();
        c.translate(50, 50);
        if (name === 'sun') {
          c.beginPath();
          c.arc(0, 0, 13, 0, Math.PI * 2);
          c.fill();
          c.lineWidth = 5;
          c.lineCap = 'round';
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            c.beginPath();
            c.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
            c.lineTo(Math.cos(a) * 29, Math.sin(a) * 29);
            c.stroke();
          }
        } else {
          c.beginPath();
          c.arc(0, 0, 26, 0, Math.PI * 2);
          c.fill();
          c.globalCompositeOperation = 'destination-out';
          c.beginPath();
          c.arc(11, -9, 22, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
      }, 768);
    const flipCoin = makeCoin(iconFace('sun'), iconFace('moon'), '#ffc83a');
    flipCoin.userData.back.color.set('#cfd9ee');
    scene.add(flipCoin);
    const shadowTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(0,0,0,0.7)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      return tex(cv);
    })();
    const flipShadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    scene.add(flipShadow);
    const flipState = { el: null, lift: 0, rotX: 0, wob: 0, vis: 0, glow: 0, dim: 0 };
    GL.flip = {
      anchor(el) {
        flipState.el = el;
      },
      // Tosses the coin; resolves when it lands. result 0 = sun up, 1 = moon up.
      toss(result, onLand) {
        const gs = window.gsap;
        const r = flipState.el.getBoundingClientRect();
        const liftPx = Math.min(200, r.height * 1.1);
        const from = flipState.rotX % (Math.PI * 2);
        const to = U.randi(5, 7) * Math.PI * 2 + result * Math.PI;
        flipState.rotX = from;
        flipState.dim = 0;
        const tl = gs.timeline();
        tl.to(flipState, { lift: liftPx, duration: 0.62, ease: 'power2.out' }, 0);
        tl.to(flipState, { lift: 0, duration: 0.58, ease: 'power2.in' }, 0.62);
        tl.to(flipState, { rotX: to, duration: 1.2, ease: 'power1.out' }, 0);
        tl.to(flipState, { wob: 1, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
        tl.add(() => onLand && onLand(), 1.2);
        tl.to(flipState, { lift: 26, duration: 0.14, ease: 'power2.out' }, 1.2);
        tl.to(flipState, { lift: 0, duration: 0.14, ease: 'power2.in' }, 1.34);
        tl.to(flipState, { lift: 8, duration: 0.09, ease: 'power2.out' }, 1.48);
        tl.to(flipState, { lift: 0, duration: 0.09, ease: 'power2.in' }, 1.57);
        return tl;
      },
      glow(on) {
        window.gsap.to(flipState, { glow: on ? 1 : 0, duration: on ? 0.2 : 1.2 });
      },
      dim(on) {
        window.gsap.to(flipState, { dim: on ? 1 : 0, duration: 0.3 });
      },
    };

    // ---------- vault door ----------
    const vault = new THREE.Group();
    const vaultPivot = new THREE.Group();
    const steel = metal('#b9ae96', { roughness: 0.38, metalness: 0.95 });
    const dark = metal('#4a4236', { roughness: 0.45 });
    const goldM = metal('#ffcf55', { roughness: 0.22 });
    const ringsCv = (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1024;
      const c = cv.getContext('2d');
      c.fillStyle = '#000';
      c.fillRect(0, 0, 1024, 1024);
      c.filter = 'blur(2px)';
      c.strokeStyle = '#fff';
      for (let i = 0; i < 26; i++) {
        c.lineWidth = i % 5 === 0 ? 8 : 2;
        c.globalAlpha = i % 5 === 0 ? 1 : 0.35;
        c.beginPath();
        c.arc(512, 512, 120 + i * 15, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        c.beginPath();
        c.arc(512 + Math.cos(a) * 470, 512 + Math.sin(a) * 470, 9, 0, Math.PI * 2);
        c.fillStyle = '#fff';
        c.fill();
      }
      return cv;
    })();
    const doorFace = metal('#c9bea4', { bumpMap: tex(ringsCv), bumpScale: 2.2, roughness: 0.33 });
    const doorGeo = new THREE.CylinderGeometry(1, 1, 0.24, 128);
    doorGeo.rotateX(Math.PI / 2);
    const door = new THREE.Mesh(doorGeo, [steel, doorFace, doorFace]);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.11, 32, 160), dark);
    const plate = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.6, 128), metal('#2c261c', { roughness: 0.6 }));
    plate.position.z = -0.12;
    const bolts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
      const bg = new THREE.CylinderGeometry(0.055, 0.055, 0.36, 24);
      bg.rotateZ(Math.PI / 2);
      const bolt = new THREE.Mesh(bg, goldM);
      bolt.userData.a = a;
      bolts.push(bolt);
    }
    const handle = new THREE.Group();
    handle.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 20, 96), goldM));
    for (let i = 0; i < 5; i++) {
      const sg = new THREE.CylinderGeometry(0.03, 0.03, 0.46, 16);
      sg.translate(0, 0.23, 0);
      const s = new THREE.Mesh(sg, goldM);
      s.rotation.z = (i / 5) * Math.PI * 2;
      handle.add(s);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), goldM);
      knob.position.set(Math.cos((i / 5) * Math.PI * 2 + Math.PI / 2) * 0.62, Math.sin((i / 5) * Math.PI * 2 + Math.PI / 2) * 0.62, 0);
      handle.add(knob);
      const spoke = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 12);
      spoke.translate(0, 0.53, 0);
      const sp = new THREE.Mesh(spoke, goldM);
      sp.rotation.z = (i / 5) * Math.PI * 2;
      handle.add(sp);
    }
    handle.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16), goldM));
    handle.position.z = 0.2;
    const lampMats = [];
    const lamps = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.3), toneMapped: false });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), m);
      const a = -Math.PI / 2 + (i - 1) * 0.3;
      lamp.position.set(Math.cos(a) * -0.98, Math.sin(a) * -0.98, 0.15);
      lampMats.push(m);
      lamps.push(lamp);
    }
    const hinge1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.3), dark);
    const hinge2 = hinge1.clone();
    hinge1.position.set(-1.02, 0.45, 0.02);
    hinge2.position.set(-1.02, -0.45, 0.02);
    const doorParts = new THREE.Group();
    doorParts.add(door, handle, ...bolts, ...lamps);
    doorParts.position.x = 1; // pivot sits at the hinge
    vaultPivot.position.x = -1;
    vaultPivot.add(doorParts);
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.02, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false }));
    glowDisc.position.z = -0.1;
    vault.add(plate, frame, glowDisc, vaultPivot, hinge1, hinge2);
    vault.visible = false;
    scene.add(vault);
    const vaultState = { locks: 0, bolts: 1, spin: 0, open: 0, light: 0, finale: false, vis: 0, scale: 1, x: 0, y: 0, z: -1.2 };
    function layoutBolts() {
      bolts.forEach((b) => {
        const rr = 0.86 + 0.2 * vaultState.bolts;
        b.position.set(Math.cos(b.userData.a) * rr, Math.sin(b.userData.a) * rr, 0);
        b.rotation.z = b.userData.a;
      });
    }
    layoutBolts();

    // ---------- 3D coin shower (instanced) ----------
    const MAXC = 420;
    const rainGeo = new THREE.CylinderGeometry(1, 1, 0.14, 36);
    rainGeo.rotateX(Math.PI / 2);
    const rainMat = metal('#ffc83a', { roughness: 0.24 });
    const rain = new THREE.InstancedMesh(rainGeo, rainMat, MAXC);
    rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rain.frustumCulled = false;
    rain.count = 0;
    scene.add(rain);
    const drops = [];
    const dummy = new THREE.Object3D();
    const v3 = new THREE.Vector3();
    function spawn(o) {
      if (drops.length >= MAXC) drops.shift();
      drops.push(
        Object.assign(
          {
            x: 0,
            y: 0,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            rx: Math.random() * 6,
            ry: Math.random() * 6,
            rz: 0,
            wx: U.rand(-9, 9),
            wy: U.rand(-9, 9),
            s: U.rand(0.16, 0.26),
            t: 0,
            life: 3.5,
            g: 9,
          },
          o
        )
      );
    }
    GL.rain = (dur, rate) => {
      const top = (H / 2) * wpp + 1;
      const half = (W / 2) * wpp;
      let t = 0;
      const tick = () => {
        const n = Math.ceil((rate || 6) * A.fx.quality);
        for (let i = 0; i < n; i++) spawn({ x: U.rand(-half, half), y: top + U.rand(0, 1), z: U.rand(-4, 2), vy: U.rand(-3, -1), life: 4 });
        t += 0.05;
        if (t < dur) U.after(0.05, tick);
      };
      tick();
    };
    GL.burst = (x, y, n, power) => {
      toWorld(x, y, v3);
      const p = power || 1;
      n = Math.ceil(n * A.fx.quality);
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, Math.PI * 2);
        const sp = U.rand(2, 7) * p;
        spawn({ x: v3.x, y: v3.y, z: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 + U.rand(3, 7) * p, vz: U.rand(-2, 4), life: 2.6 });
      }
    };
    function updateRain(dt) {
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.t += dt;
        if (d.t > d.life || d.y < -(H / 2) * wpp - 2 || d.z > 18) {
          drops.splice(i, 1);
          continue;
        }
        d.vy -= d.g * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.rx += d.wx * dt;
        d.ry += d.wy * dt;
      }
      rain.count = drops.length;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(d.rx, d.ry, d.rz);
        const k = Math.min(1, d.t * 6) * (d.t > d.life - 0.4 ? (d.life - d.t) / 0.4 : 1);
        dummy.scale.setScalar(d.s * k);
        dummy.updateMatrix();
        rain.setMatrixAt(i, dummy.matrix);
      }
      rain.instanceMatrix.needsUpdate = true;
    }

    // ---------- theme ----------
    const themeKeys = ['top', 'bot', 'g1', 'g2', 'grid'];
    const uniformOf = { top: bgU.uTop, bot: bgU.uBot, g1: bgU.uG1, g2: bgU.uG2, grid: bgU.uGrid };
    GL.setTheme = (name, instant) => {
      themeKeys.forEach((k) => {
        const target = new THREE.Color(A.fx.themeHex(name, k));
        const u = uniformOf[k].value;
        if (instant) u.copy(target);
        else window.gsap.to(u, { r: target.r, g: target.g, b: target.b, duration: 1.6, ease: 'sine.inOut' });
      });
      const c1 = new THREE.Color(A.fx.themeHex(name, 'g1'));
      const c2 = new THREE.Color(A.fx.themeHex(name, 'g2'));
      studio(c1, c2, name);
      if (instant) {
        rim1.color.copy(c1);
        rim2.color.copy(c2);
      } else {
        window.gsap.to(rim1.color, { r: c1.r, g: c1.g, b: c1.b, duration: 1.6 });
        window.gsap.to(rim2.color, { r: c2.r, g: c2.g, b: c2.b, duration: 1.6 });
      }
    };
    GL.pulse = (v) => (bgU.uPulse.value = Math.min(1.5, bgU.uPulse.value + (v || 0.3)));

    // ---------- vault control ----------
    GL.vault = {
      setLocks(n) {
        vaultState.locks = n;
      },
      // Full-screen finale: spin the wheel, pull the bolts, swing the door, flood the screen with gold.
      finale() {
        const gs = window.gsap;
        vaultState.finale = true;
        vault.visible = true;
        const s = vaultState;
        const fit = Math.min(W, H) * 0.36 * wpp;
        const tl = gs.timeline();
        tl.to(s, { x: 0, y: 0, z: 0, scale: fit, duration: 1.1, ease: 'power3.inOut' }, 0);
        tl.to(coinState, { vis: 0, duration: 0.5 }, 0);
        tl.to(s, { spin: Math.PI * 3, duration: 1.3, ease: 'power2.inOut' }, 1.0);
        tl.to(s, { bolts: 0, duration: 0.9, ease: 'power2.in', onUpdate: layoutBolts }, 1.3);
        tl.to(s, { open: 1, duration: 1.9, ease: 'power2.inOut' }, 2.4);
        tl.to(s, { light: 1, duration: 1.6, ease: 'power2.in' }, 2.5);
        tl.to(bloom, { strength: 2.2, radius: 0.9, duration: 1.6 }, 2.5);
        tl.add(() => {
          for (let k = 0; k < 40; k++) {
            U.after(k * 0.07, () => {
              for (let i = 0; i < 9 * A.fx.quality; i++) {
                spawn({
                  x: U.rand(-0.6, 0.6) * fit,
                  y: U.rand(-0.6, 0.6) * fit,
                  z: -0.2,
                  vx: U.rand(-5, 5),
                  vy: U.rand(-1, 6),
                  vz: U.rand(7, 13),
                  life: 3,
                  g: 6,
                  s: U.rand(0.18, 0.3),
                });
              }
            });
          }
        }, 3.2);
        tl.to(bloom, { strength: 0.5, radius: 0.5, duration: 2.5 }, 5.2);
        // settle into a warm glow behind the victory screen
        tl.to(s, { light: 0.22, duration: 2.5, ease: 'power2.out' }, 5.6);
        tl.to(s, { scale: fit * 1.25, y: -fit * 0.1, duration: 3, ease: 'power2.inOut' }, 5.6);
        return tl;
      },
      reset() {
        Object.assign(vaultState, { bolts: 1, spin: 0, open: 0, light: 0, finale: false, vis: 0 });
        layoutBolts();
        bloom.strength = 0.34;
        bloom.radius = 0.45;
        coinState.vis = 0;
      },
    };

    // ---------- per-frame ----------
    let time = 0;
    let perfAcc = 0;
    let perfN = 0;
    const anchorTmp = new THREE.Vector3();
    function placeOnAnchor(obj, el, diamFrac, z) {
      const r = el.getBoundingClientRect();
      toWorld(r.left + r.width / 2, r.top + r.height / 2, anchorTmp);
      obj.position.set(anchorTmp.x, anchorTmp.y, z || 0);
      return Math.min(r.width, r.height) * diamFrac * 0.5 * wpp;
    }

    GL.frame = (dt) => {
      time += dt;
      bgU.uTime.value = time;
      bgU.uPulse.value = Math.max(0, bgU.uPulse.value - dt * 1.6);
      const G = A.game;
      const screen = A.ui ? A.ui.screen() : 'title';
      const tab = A.ui ? A.ui.tab() : 'coin';
      const cinema = A.cinema && A.cinema.busy();

      // coin
      const cs = coinState;
      let anchor = null;
      if (!vaultState.finale) {
        if (screen === 'title') anchor = cs.anchors.title;
        else if (screen === 'game' && tab === 'coin') anchor = cs.anchors.main;
      }
      if (anchor && anchor !== cs.active) cs.active = anchor;
      cs.vis = U.lerp(cs.vis, anchor ? 1 : 0, Math.min(1, dt * (anchor ? 7 : 14)));
      if (cs.active) {
        applySkin(cs.active.skin);
        const R = placeOnAnchor(coin, cs.active.el, 0.72, 0);
        cs.sqv += (-220 * cs.sq - 14 * cs.sqv) * dt;
        cs.sq += cs.sqv * dt;
        cs.tvx += (-140 * (cs.tx - cs.hx * 0.7) - 11 * cs.tvx) * dt;
        cs.tvy += (-140 * (cs.ty - cs.hy * 0.7) - 11 * cs.tvy) * dt;
        cs.tx += cs.tvx * dt;
        cs.ty += cs.tvy * dt;
        if (cs.active.mode === 'title') cs.spin += dt * 1.1;
        else cs.spin = U.lerp(cs.spin, Math.round(cs.spin / (Math.PI * 2)) * Math.PI * 2, Math.min(1, dt * 3));
        const s = R * (1 + cs.sq * 0.08) * cs.vis;
        coin.scale.setScalar(Math.max(0.0001, s));
        coin.position.y += Math.sin(time * 1.8) * R * 0.03;
        const idle = cs.active.mode === 'title' ? 0 : 1;
        coin.rotation.set(cs.ty * 0.55 - 0.22 * idle + Math.sin(time * 0.6) * 0.05, cs.tx * 0.55 + cs.spin + cs.extraSpin + (0.28 + Math.sin(time * 0.45) * 0.12) * idle, Math.sin(time * 0.7) * 0.04);
        const fever = cs.active.mode === 'main' && G && G.isFever && G.isFever();
        cs.fever = U.lerp(cs.fever, fever ? 1 : 0, Math.min(1, dt * 4));
        const { edge, front, back } = coin.userData;
        [edge, front, back].forEach((m) => {
          m.emissive.setRGB(1, 0.35, 0.05);
          m.emissiveIntensity = cs.fever * (0.35 + 0.15 * Math.sin(time * 12));
        });
      }
      coin.visible = cs.vis > 0.01;

      // flip coin
      const fs = flipState;
      const flipOn = screen === 'game' && tab === 'flip' && fs.el && !cinema;
      fs.vis = U.lerp(fs.vis, flipOn ? 1 : 0, Math.min(1, dt * 8));
      flipCoin.visible = flipShadow.visible = fs.vis > 0.01;
      if (flipCoin.visible) {
        const R = placeOnAnchor(flipCoin, fs.el, 0.9, 0.5);
        const base = flipCoin.position.y;
        flipCoin.position.y = base + fs.lift * wpp;
        flipCoin.scale.setScalar(R * fs.vis);
        flipCoin.rotation.set(fs.rotX + Math.sin(time * 1.2) * 0.05, Math.sin(fs.wob * Math.PI) * 0.5, 0);
        flipShadow.position.set(flipCoin.position.x, base - R * 1.25, 0.2);
        const k = 1 - Math.min(0.7, (fs.lift * wpp) / (R * 3));
        flipShadow.scale.set(R * k, R * k, 1);
        flipShadow.material.opacity = 0.6 * k * fs.vis;
        const { edge, front, back } = flipCoin.userData;
        [edge, front, back].forEach((m) => {
          m.emissive.setRGB(1, 0.8, 0.3);
          m.emissiveIntensity = fs.glow * 0.45;
          m.roughness = 0.28 + fs.dim * 0.4;
        });
        front.roughness = back.roughness = 1;
        front.color.set(fs.dim > 0.5 ? '#9a8a60' : '#ffc83a');
        back.color.set(fs.dim > 0.5 ? '#7a8294' : '#cfd9ee');
      }

      // vault
      const vs = vaultState;
      const vaultOn = vs.finale || (screen === 'game' && tab === 'coin' && G && G.atVault && G.atVault() && !cinema);
      vs.vis = U.lerp(vs.vis, vaultOn ? 1 : 0, Math.min(1, dt * 5));
      vault.visible = vs.vis > 0.01;
      if (vault.visible) {
        if (!vs.finale && cs.anchors.main) {
          const R = placeOnAnchor(vault, cs.anchors.main.el, 0.9, -1.2);
          vs.x = vault.position.x;
          vs.y = vault.position.y;
          vs.z = -1.2;
          vs.scale = R;
        }
        vault.position.set(vs.x, vs.y, vs.z);
        vault.scale.setScalar(vs.scale * vs.vis);
        handle.rotation.z = vs.spin + time * 0.05;
        vaultPivot.rotation.y = -vs.open * 1.95;
        glowDisc.material.color.setRGB(4 * vs.light, 3.2 * vs.light, 1.6 * vs.light);
        vaultLight.position.set(vs.x, vs.y, vs.z + 1.5);
        vaultLight.intensity = vs.light * 400;
        const open = vs.finale ? 3 : vs.locks;
        lampMats.forEach((m, i) => {
          const on = i < open;
          const pulse = 0.75 + 0.25 * Math.sin(time * 4 + i);
          if (on) m.color.setRGB(0.3, 3, 1.2);
          else m.color.setRGB(3 * pulse, 0.15, 0.25);
        });
      }

      updateRain(dt);
      composer.render(dt);

      // adaptive resolution
      perfAcc += dt;
      perfN++;
      if (perfAcc > 2.5) {
        const avg = perfAcc / perfN;
        const prev = pr;
        if (avg > 1 / 42 && pr > 0.7) pr = Math.max(0.7, pr - 0.25);
        else if (avg < 1 / 57 && pr < Math.min(1.75, window.devicePixelRatio || 1)) pr = Math.min(Math.min(1.75, window.devicePixelRatio || 1), pr + 0.25);
        if (pr !== prev) resize();
        perfAcc = 0;
        perfN = 0;
      }
    };

    GL.ok = true;
    document.body.classList.add('gl-on');
    A.gl = GL;
    return GL;
  };
})();
