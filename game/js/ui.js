/* Screens, HUD, shop, tabs, modals and all the shared celebration effects. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;
  const E = A.econ;
  const G = A.game;
  const $ = U.$;

  const UI = {};
  const TABS = [
    { id: 'coin', icon: 'coin', floor: 0 },
    { id: 'flip', icon: 'flip', floor: 0 },
    { id: 'slots', icon: 'slot', floor: 1 },
    { id: 'plinko', icon: 'plinko', floor: 2 },
    { id: 'wheel', icon: 'wheel', floor: 3 },
    { id: 'crash', icon: 'rocket', floor: 4 },
  ];
  const FLOOR_ICONS = ['flip', 'slot', 'plinko', 'wheel', 'rocket', 'vault'];
  UI.FLOOR_ICONS = FLOOR_ICONS;

  let screen = 'title';
  let tab = 'coin';
  let bigCoin = null;
  let titleCoin = null;
  let vaultCv = null;
  let shownCoins = 0;
  let coinsEl;
  let incomeEl;
  let clickValEl;
  let lastIncome = '';
  let lastCoinsTxt = '';
  const shopItems = [];
  const tabBtns = {};
  const views = {};
  let shopOpen = false;
  let bump = 0;

  UI.fillIcons = (root) => {
    U.$$('[data-icon]', root).forEach((e) => {
      if (e.dataset.filled) return;
      e.dataset.filled = '1';
      e.innerHTML = A.icon(e.dataset.icon);
    });
  };

  // ---------- screens ----------
  UI.show = (name) => {
    screen = name;
    U.$$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + name));
    document.body.dataset.screen = name;
    if (name === 'game') {
      requestAnimationFrame(() => {
        if (bigCoin) bigCoin.resize();
        UI.setTab(tab, true);
      });
    }
  };
  UI.screen = () => screen;

  // ---------- build ----------
  UI.init = () => {
    UI.fillIcons(document);
    coinsEl = $('#coins');
    incomeEl = $('#income');

    // title coin
    titleCoin = new A.BigCoin($('#title-coin'), { autoSpin: true });
    titleCoin.setSkin(2);

    // views
    const viewsEl = $('#views');
    TABS.forEach((t) => {
      const v = U.el('div', 'view view-' + t.id);
      v.dataset.view = t.id;
      viewsEl.appendChild(v);
      views[t.id] = v;
      const b = U.el('button', 'tab', `${A.icon(t.icon)}<span class="tab-lock">${A.icon('lock')}</span><span class="tab-dot"></span>`);
      b.dataset.tab = t.id;
      b.setAttribute('data-i18n-title', 'g_' + t.id);
      b.addEventListener('click', () => {
        if (!tabUnlocked(t)) {
          A.sfx.deny();
          UI.denyShake(b);
          flashElevator();
          return;
        }
        A.sfx.ui();
        UI.setTab(t.id);
      });
      $('#tabs').appendChild(b);
      tabBtns[t.id] = b;
    });
    const shopTab = U.el('button', 'tab tab-shop', `${A.icon('shop')}<span class="tab-dot"></span>`);
    shopTab.setAttribute('data-i18n-title', 'g_shop');
    shopTab.addEventListener('click', () => {
      A.sfx.ui();
      UI.toggleShop();
    });
    $('#tabs').appendChild(shopTab);
    tabBtns.shop = shopTab;
    $('#shop-grab').addEventListener('click', () => UI.toggleShop(false));
    $('#views').addEventListener(
      'pointerdown',
      (e) => {
        if (!shopOpen) return;
        e.stopPropagation();
        e.preventDefault();
        UI.toggleShop(false);
      },
      true
    );

    buildCoinView(views.coin);
    ['flip', 'slots', 'plinko', 'wheel', 'crash'].forEach((id) => A.games[id].build(views[id]));
    buildShop();

    $('#elevator').addEventListener('click', onElevator);
    $('#btn-gear').addEventListener('click', () => {
      A.sfx.ui();
      UI.openSettings(true);
    });
    initTips();
    window.addEventListener('resize', UI.resize);
  };

  UI.resize = () => {
    if (bigCoin) bigCoin.resize();
    if (titleCoin) titleCoin.resize();
    if (vaultCv) sizeCanvas(vaultCv);
    const g = A.games[tab];
    if (g && g.resize) g.resize();
    if (window.innerWidth > 900 && shopOpen) UI.toggleShop(false);
  };

  function sizeCanvas(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(10, Math.round(r.width * dpr));
    cv.height = Math.max(10, Math.round(r.height * dpr));
  }

  // ---------- main coin view ----------
  function buildCoinView(v) {
    v.innerHTML = `
      <canvas class="vault-bg"></canvas>
      <div class="coin-wrap"><canvas class="big-coin"></canvas></div>
      <div class="click-val"><span data-icon="tap"></span><b>+1</b></div>`;
    UI.fillIcons(v);
    vaultCv = v.querySelector('.vault-bg');
    clickValEl = v.querySelector('.click-val b');
    const cv = v.querySelector('.big-coin');
    bigCoin = new A.BigCoin(cv, { meter: () => ({ value: G.isFever() ? (G.s.feverUntil - G.s.time) / E.feverDur(G.s) : G.s.fever, active: G.isFever() }) });
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!bigCoin.hit(e.clientX, e.clientY)) return;
      clickCoin(e.clientX, e.clientY);
    });
    cv.addEventListener('pointermove', (e) => bigCoin.look(e.clientX, e.clientY));
    cv.addEventListener('pointerleave', () => {
      bigCoin.hx = 0;
      bigCoin.hy = 0;
    });
    window.addEventListener('keydown', (e) => {
      if (screen !== 'game' || tab !== 'coin' || e.repeat || document.querySelector('.modal')) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const c = bigCoin.center();
        clickCoin(c.x + U.rand(-40, 40), c.y + U.rand(-40, 40));
      }
    });
  }

  let flyingCoins = 0;
  function clickCoin(x, y) {
    const r = G.click();
    bigCoin.punch(x, y, r.crit ? 2.2 : 1);
    A.sfx.tap(r.combo, r.crit);
    A.fx.pulse(r.crit ? 0.6 : 0.08);
    U.vibrate(r.crit ? 30 : 6);
    const fever = r.fever;
    if (r.crit) {
      A.fx.text(x, y - 30, '+' + U.fmt(r.v), { size: 44, color: '#fff27a', color2: '#ff3d7f', life: 1.2, vy: -200 });
      A.fx.text(x + 50, y - 80, 'x' + E.CRIT_MULT, { size: 30, color: '#9ff6ff', color2: '#2d7bff', life: 0.9 });
      A.fx.shake(9, 0.25);
      A.fx.ring(x, y, '#ffffff', 120, 0.4, 8);
      A.fx.sparks(x, y, 26, '#fff2a8', { max: 700 });
      A.fx.flash('#fff6d0', 0.12, 0.25);
    } else {
      A.fx.text(x + U.rand(-28, 28), y - 20 - U.rand(0, 24), '+' + U.fmt(r.v), { size: fever ? 30 : 24, color: fever ? '#ffd23f' : '#ffe27a', color2: fever ? '#ff4d1a' : '#ff9d00' });
      A.fx.sparks(x, y, fever ? 8 : 4, fever ? '#ff9a3d' : '#ffe08a', { max: 320 });
    }
    A.fx.coinBurst(x, y, fever ? 3 : 1, { up: true, min: 200, max: 450 });
    if (flyingCoins < 14) {
      flyingCoins++;
      A.fx.fly(x, y, 1, UI.coinTarget, () => {
        flyingCoins--;
        UI.coinHit();
      });
    }
    if (r.feverStart) feverStartFx();
    G.s.seen.tapped = (G.s.seen.tapped || 0) + 1;
  }

  function feverStartFx() {
    const c = bigCoin.center();
    A.sfx.feverOn();
    A.fx.banner(A.t('fever'), 'fire', { life: 1.4 });
    A.fx.flash('#ff7a1a', 0.3, 0.6);
    A.fx.ring(c.x, c.y, '#ff7a1a', 260, 0.7, 14);
    A.fx.sparks(c.x, c.y, 60, '#ff9a3d', { max: 900 });
    A.fx.shake(10, 0.4);
  }

  UI.coinTarget = () => {
    const ic = $('#money .coin-ic');
    return ic ? U.center(ic) : { x: 0, y: 0 };
  };
  UI.coinHit = () => {
    bump = 1;
    A.sfx.tink();
  };

  // ---------- tabs ----------
  function tabUnlocked(t) {
    return G.s.floor >= t.floor;
  }
  UI.setTab = (id, force) => {
    if (id === tab && !force) return;
    const prev = A.games[tab];
    if (prev && prev.hide && id !== tab) prev.hide();
    tab = id;
    Object.keys(views).forEach((k) => views[k].classList.toggle('active', k === id));
    Object.keys(tabBtns).forEach((k) => tabBtns[k].classList.toggle('active', k === id));
    G.s.seen['tab_' + id] = 1;
    requestAnimationFrame(() => {
      const g = A.games[id];
      if (g && g.show) g.show();
      if (id === 'coin') {
        bigCoin.resize();
        sizeCanvas(vaultCv);
      }
    });
    if (shopOpen && window.innerWidth <= 900) UI.toggleShop(false);
  };
  UI.tab = () => tab;

  UI.toggleShop = (open) => {
    shopOpen = open === undefined ? !shopOpen : open;
    document.body.classList.toggle('shop-open', shopOpen);
    tabBtns.shop.classList.toggle('active', shopOpen);
    if (shopOpen) G.s.seen.shopOpened = 1;
  };

  // ---------- shop ----------
  function buildShop() {
    const list = $('#shop-list');
    const upWrap = U.el('div', 'upg-grid');
    E.UPGS.forEach((u) => {
      const b = U.el('button', 'upg');
      b.setAttribute('data-i18n-title', 'u_' + u.id);
      b.innerHTML = `
        <span class="up-ic">${A.icon(u.icon)}</span>
        <span class="up-lvl"></span>
        <span class="up-price">${A.icon('coin')}<b></b></span>
        <span class="lock-cover">${A.icon('lock')}</span>`;
      upWrap.appendChild(b);
      const item = { kind: 'upg', def: u, el: b, lvl: b.querySelector('.up-lvl'), price: b.querySelector('.up-price b'), last: {} };
      bindBuy(item);
      shopItems.push(item);
    });
    list.appendChild(upWrap);
    const genWrap = U.el('div', 'gen-list');
    E.GENS.forEach((g) => {
      const b = U.el('button', 'gen');
      b.setAttribute('data-i18n-title', 'p_' + g.id);
      b.innerHTML = `
        <span class="gen-ic">${A.icon(g.icon)}<b class="gen-count"></b></span>
        <span class="gen-mid">
          <span class="gen-eff"><span class="gen-plus"></span>${A.icon('clock')}</span>
          <span class="gen-bar"><i></i></span>
        </span>
        <span class="gen-price">${A.icon('coin')}<b></b></span>
        <span class="lock-cover">${A.icon('lock')}<span class="lock-floor">${A.icon(FLOOR_ICONS[g.floor])}</span></span>`;
      genWrap.appendChild(b);
      const item = {
        kind: 'gen',
        def: g,
        el: b,
        count: b.querySelector('.gen-count'),
        plus: b.querySelector('.gen-plus'),
        bar: b.querySelector('.gen-bar i'),
        price: b.querySelector('.gen-price b'),
        last: {},
      };
      bindBuy(item);
      shopItems.push(item);
    });
    list.appendChild(genWrap);
  }

  function tryBuy(item) {
    if (item.el.classList.contains('locked')) return false;
    const ok = item.kind === 'gen' ? G.buyGen(item.def.id) : G.buyUpg(item.def.id);
    if (!ok) return false;
    G.s.seen.bought = 1;
    const c = U.center(item.el.querySelector(item.kind === 'gen' ? '.gen-ic' : '.up-ic'));
    A.sfx.buy();
    A.fx.sparks(c.x, c.y, 14, '#ffe08a', { max: 300 });
    A.fx.stars(c.x, c.y, 3, '#fff3b0', 20);
    item.el.classList.remove('bought');
    void item.el.offsetWidth;
    item.el.classList.add('bought');
    U.vibrate(10);
    return true;
  }

  function bindBuy(item) {
    let hold = null;
    let rep = null;
    const stop = () => {
      clearTimeout(hold);
      clearInterval(rep);
      hold = rep = null;
    };
    item.el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      if (!tryBuy(item)) {
        A.sfx.deny();
        UI.denyShake(item.el);
        return;
      }
      stop();
      let delay = 0.12;
      hold = setTimeout(() => {
        const step = () => {
          if (!tryBuy(item)) return stop();
          delay = Math.max(0.04, delay * 0.85);
          rep = setTimeout(step, delay * 1000);
        };
        step();
      }, 380);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => item.el.addEventListener(ev, stop));
  }

  G.on('buy', (d) => {
    if (d.milestone) {
      const item = shopItems.find((i) => i.kind === 'gen' && i.def.id === d.id);
      if (item) {
        const c = U.center(item.el);
        A.sfx.milestone();
        A.fx.text(c.x, c.y - 10, 'x2', { size: 34, color: '#9dffb0', color2: '#12c46b' });
        A.fx.stars(c.x, c.y, 10, '#c8ffd6', 60);
        A.fx.ring(c.x, c.y, '#7dffb0', 90, 0.5, 6);
      }
    }
  });

  function setTxt(item, key, el, txt) {
    if (item.last[key] !== txt) {
      item.last[key] = txt;
      el.textContent = txt;
    }
  }
  function setCls(item, cls, on) {
    const k = 'c_' + cls;
    if (item.last[k] !== on) {
      item.last[k] = on;
      item.el.classList.toggle(cls, on);
    }
  }

  function updateShop() {
    const s = G.s;
    let anyAfford = false;
    for (const it of shopItems) {
      const d = it.def;
      const locked = d.floor > s.floor;
      const hidden = d.floor > s.floor + 1;
      setCls(it, 'locked', locked);
      setCls(it, 'hidden', hidden);
      if (it.kind === 'gen') {
        const n = s.gens[d.id] || 0;
        const cost = E.genCost(d, n);
        const afford = !locked && s.coins >= cost;
        setCls(it, 'afford', afford);
        if (afford) anyAfford = true;
        setTxt(it, 'count', it.count, n ? String(n) : '');
        setTxt(it, 'price', it.price, U.fmt(cost));
        const add = (E.genProd(d, n + 1) - E.genProd(d, n)) * E.floorMult(s);
        setTxt(it, 'plus', it.plus, '+' + U.fmt(add));
        const prev = E.MILESTONES.filter((m) => m <= n).pop() || 0;
        const next = E.nextMilestone(n);
        const pct = next ? ((n - prev) / (next - prev)) * 100 : 100;
        const w = pct.toFixed(1) + '%';
        if (it.last.bar !== w) {
          it.last.bar = w;
          it.bar.style.width = w;
        }
      } else {
        const lvl = s.upg[d.id] || 0;
        const maxed = lvl >= d.max;
        const cost = E.upgCost(d, lvl);
        const afford = !locked && !maxed && s.coins >= cost;
        setCls(it, 'afford', afford);
        setCls(it, 'maxed', maxed);
        if (afford) anyAfford = true;
        setTxt(it, 'price', it.price, maxed ? 'MAX' : U.fmt(cost));
        const key = lvl + '/' + d.max;
        if (it.last.lvl !== key) {
          it.last.lvl = key;
          if (d.max <= 10) {
            it.lvl.innerHTML = Array.from({ length: d.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
            it.lvl.classList.add('pips');
          } else {
            it.lvl.textContent = lvl ? String(lvl) : '';
          }
        }
      }
    }
    tabBtns.shop.classList.toggle('dot', anyAfford && !shopOpen);
  }

  // ---------- HUD ----------
  function updateHud(dt) {
    const s = G.s;
    // rolling counter
    const target = s.coins;
    if (Math.abs(target - shownCoins) < 1 || target < shownCoins * 0.5) shownCoins = target;
    else shownCoins += (target - shownCoins) * Math.min(1, dt * 9);
    const txt = U.fmt(shownCoins);
    if (txt !== lastCoinsTxt) {
      lastCoinsTxt = txt;
      coinsEl.textContent = txt;
    }
    bump = Math.max(0, bump - dt * 5);
    $('#money').style.setProperty('--bump', bump.toFixed(3));
    const inc = '+' + U.fmt(G.cps());
    if (inc !== lastIncome) {
      lastIncome = inc;
      incomeEl.textContent = inc;
    }
    $('#money').classList.toggle('frenzy', G.isFrenzy());
    if (clickValEl) {
      let cv = G.clickValue();
      if (G.isFever()) cv *= E.feverMult(s);
      const t = '+' + U.fmt(cv);
      if (clickValEl.textContent !== t) clickValEl.textContent = t;
    }
    updateElevator();
    updateBoosts();
    updateTabs();
  }

  let elevLast = {};
  function updateElevator() {
    const s = G.s;
    const btn = $('#elevator');
    const vault = G.atVault();
    const cost = G.goalCost();
    const k = U.clamp(s.coins / cost, 0, 1);
    $('#el-fill').style.transform = `scaleX(${k.toFixed(4)})`;
    const ready = s.coins >= cost && !s.won;
    btn.classList.toggle('ready', ready);
    btn.classList.toggle('vault', vault);
    const key = vault + ':' + s.floor + ':' + s.locks;
    if (elevLast.key !== key) {
      elevLast.key = key;
      $('#el-icon').innerHTML = vault ? A.icon('key') : A.icon(FLOOR_ICONS[s.floor + 1]) + `<span class="el-up">${A.icon('up')}</span>`;
      $('#el-track').innerHTML = vault
        ? E.LOCKS.map((_, i) => `<i class="${i < s.locks ? 'on' : ''}">${A.icon(i < s.locks ? 'unlock' : 'lock')}</i>`).join('')
        : E.FLOORS.map((f, i) => `<i class="${i <= s.floor ? 'on' : ''}${i === s.floor + 1 ? ' next' : ''}"></i>`).join('');
    }
    const price = U.fmt(cost);
    if (elevLast.price !== price) {
      elevLast.price = price;
      $('#el-price').innerHTML = A.icon('coin') + `<b>${price}</b>`;
    }
  }
  function flashElevator() {
    const b = $('#elevator');
    b.classList.remove('nudge');
    void b.offsetWidth;
    b.classList.add('nudge');
  }

  let boostKey = '';
  function updateBoosts() {
    const s = G.s;
    const items = [];
    if (G.isFever()) items.push(['fire', (s.feverUntil - s.time) / E.feverDur(s), 'x' + E.feverMult(s)]);
    if (G.isFrenzy()) items.push(['clover', (s.frenzyUntil - s.time) / E.FRENZY_DUR, 'x' + E.FRENZY_MULT]);
    const key = items.map((i) => i[0]).join();
    const host = $('#boosts');
    if (key !== boostKey) {
      boostKey = key;
      host.innerHTML = items
        .map(
          (i) =>
            `<div class="boost b-${i[0]}"><svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg>${A.icon(i[0])}<b>${i[2]}</b></div>`
        )
        .join('');
    }
    const circles = host.querySelectorAll('.ring circle');
    items.forEach((i, idx) => {
      const c = circles[idx];
      if (!c) return;
      const len = 2 * Math.PI * 17;
      c.style.strokeDasharray = len;
      c.style.strokeDashoffset = len * (1 - U.clamp(i[1], 0, 1));
    });
  }

  function updateTabs() {
    TABS.forEach((t) => {
      const b = tabBtns[t.id];
      const un = tabUnlocked(t);
      b.classList.toggle('locked', !un);
      b.classList.toggle('dot', un && t.id !== 'coin' && !G.s.seen['tab_' + t.id]);
      if (t.id === 'wheel') b.classList.toggle('gift', un && A.games.wheel.freeReady() && tab !== 'wheel');
    });
  }

  function onElevator() {
    if (G.s.won) return;
    if (!G.canGoal()) {
      A.sfx.deny();
      UI.denyShake($('#elevator'));
      return;
    }
    if (A.cinema.busy()) return;
    G.s.seen.elev = 1;
    A.sfx.ui();
    G.goUp();
  }

  // ---------- floors ----------
  UI.applyFloor = (instant) => {
    const s = G.s;
    const f = E.FLOORS[s.floor];
    A.fx.setTheme(f.id, instant);
    document.body.dataset.floor = f.id;
    if (bigCoin) bigCoin.setSkin(s.floor);
    const badge = $('#floor-badge');
    badge.innerHTML = `${A.icon(FLOOR_ICONS[s.floor])}<span>${A.t('f_' + f.id)}</span>`;
    A.sfx.music.setKey([0, 2, 3, 5, 7, 0][s.floor] || 0);
    A.sfx.music.setEnergy(Math.min(3, s.floor));
    if (A.sfx.music.on || A.sfx.music.wanted) A.sfx.music.start(G.atVault() ? 'vault' : 'main');
    views.coin.classList.toggle('at-vault', G.atVault());
    if (vaultCv) requestAnimationFrame(() => sizeCanvas(vaultCv));
  };

  // ---------- celebrations ----------
  UI.celebrate = (x, y, win, bet, tier, opts) => {
    opts = opts || {};
    if (win <= 0) return;
    const ratio = bet > 0 ? win / bet : 2;
    if (ratio < 1) {
      A.fx.text(x, y, '+' + U.fmt(win), { size: 20, color: '#d9d2ff', color2: '#8a7cff' });
      A.fx.fly(x, y, 2, UI.coinTarget, UI.coinHit);
      A.sfx.coin(0.8);
      return;
    }
    const n = Math.min(26, 4 + tier * 6);
    A.fx.fly(x, y, n, UI.coinTarget, UI.coinHit, { spread: 1 + tier * 0.4 });
    A.fx.text(x, y, '+' + U.fmt(win), { size: 28 + tier * 10, life: 1.2 + tier * 0.2, vy: -160 });
    A.fx.stars(x, y, 6 + tier * 4, '#fff3b0', 60 + tier * 30);
    A.fx.pulse(0.4 + tier * 0.3);
    U.vibrate(20 + tier * 30);
    if (tier >= 3) {
      A.sfx.bigWin(true);
      A.fx.banner(A.t('mega'), 'mega', { rays: true, life: 2.4, sub: A.icon('coin') + U.fmt(win) });
      A.fx.rain(1.6, 8);
      A.fx.confetti(x, y, 120);
      A.fx.shake(14, 0.6);
      A.fx.flash('#ffe27a', 0.35, 0.7);
      A.sfx.coinRain(1.8);
    } else if (tier >= 2) {
      A.sfx.bigWin(false);
      A.fx.banner(A.t('bigwin'), 'gold', { life: 1.8, sub: A.icon('coin') + U.fmt(win) });
      A.fx.confetti(x, y, 60);
      A.fx.shake(8, 0.4);
      A.fx.flash('#ffe27a', 0.2, 0.5);
      A.fx.coinBurst(x, y, 20, { up: true });
    } else {
      if (!opts.quiet) A.sfx.win(Math.round(Math.min(3, ratio / 2)));
      else A.sfx.coin(1.1);
      A.fx.sparks(x, y, 20, '#ffe08a', { max: 500 });
      A.fx.coinBurst(x, y, 6, { up: true });
    }
  };

  UI.jackpot = (x, y, win) => {
    A.sfx.jackpot();
    A.fx.banner(A.t('jackpot'), 'jackpot', { rays: true, life: 3.4, sub: A.icon('crown') + U.fmt(win) });
    A.fx.rain(3, 10);
    A.sfx.coinRain(3);
    A.fx.flash('#fff3b0', 0.6, 1);
    A.fx.shake(18, 0.9);
    A.fx.fly(x, y, 30, UI.coinTarget, UI.coinHit, { spread: 2 });
    const { w, h } = A.fx.size();
    for (let i = 0; i < 6; i++) U.after(0.3 + i * 0.35, () => A.fx.firework(U.rand(w * 0.15, w * 0.85), U.rand(h * 0.1, h * 0.4)));
    A.fx.confetti(0, 0, 160, { wide: true, down: true });
    U.vibrate([60, 40, 60, 40, 200]);
  };

  UI.loseText = (x, y, amount) => {
    if (amount > 0) A.fx.text(x, y, '−' + U.fmt(amount), { size: 24, color: '#ff8a9a', color2: '#d0102f', stroke: 'rgba(40,0,10,0.9)', vy: 60, g: 60 });
  };

  UI.denyShake = (el) => {
    if (!el) return;
    el.classList.remove('deny');
    void el.offsetWidth;
    el.classList.add('deny');
  };

  // ---------- golden chip ----------
  let golden = null;
  G.on('golden', () => {
    if (golden || screen !== 'game' || A.cinema.busy()) return;
    const layer = $('#golden-layer');
    const b = U.el('button', 'golden', `<span class="g-chip"><span class="g-face">${A.icon('clover')}</span></span>`);
    layer.appendChild(b);
    const st = $('#stage').getBoundingClientRect();
    const dir = Math.random() < 0.5 ? 1 : -1;
    golden = {
      el: b,
      t: 0,
      x0: dir > 0 ? st.left - 40 : st.right + 40,
      x1: dir > 0 ? st.right + 40 : st.left - 40,
      y: st.top + st.height * U.rand(0.2, 0.6),
      amp: st.height * 0.12,
      ph: Math.random() * 6,
      caught: false,
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      catchGolden();
    });
    A.sfx.golden();
  });
  function catchGolden() {
    if (!golden || golden.caught) return;
    golden.caught = true;
    const c = U.center(golden.el);
    const r = G.goldenReward();
    A.sfx.goldenGrab();
    A.fx.ring(c.x, c.y, '#ffe27a', 160, 0.6, 10);
    A.fx.stars(c.x, c.y, 16, '#fff3b0', 70);
    if (r.kind === 'coins') {
      G.earn(r.n, 'golden');
      A.fx.text(c.x, c.y - 20, '+' + U.fmt(r.n), { size: 40, life: 1.4 });
      A.fx.fly(c.x, c.y, 16, UI.coinTarget, UI.coinHit, { spread: 1.5 });
    } else {
      A.fx.banner(A.t('frenzy'), 'green', { life: 1.6, sub: A.icon('clover') + 'x' + E.FRENZY_MULT });
      A.fx.flash('#7dffb0', 0.25, 0.6);
    }
    const el = golden.el;
    el.classList.add('caught');
    setTimeout(() => el.remove(), 400);
    golden = null;
  }
  function updateGolden(dt) {
    if (!golden) return;
    golden.t += dt;
    const k = golden.t / E.GOLDEN_LIFETIME;
    if (k >= 1) {
      golden.el.remove();
      golden = null;
      return;
    }
    const x = U.lerp(golden.x0, golden.x1, k);
    const y = golden.y + Math.sin(golden.t * 2 + golden.ph) * golden.amp;
    golden.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    if (Math.random() < dt * 12) A.fx.stars(x, y, 1, '#fff3b0', 26);
  }

  // ---------- tutorial hints (icon-only) ----------
  let hintEl = null;
  let hintTarget = null;
  function setHint(target) {
    if (!hintEl) {
      hintEl = U.el('div', 'hint-hand', A.icon('tap'));
      $('#hints').appendChild(hintEl);
    }
    hintTarget = target;
    hintEl.classList.toggle('on', !!target);
  }
  function updateHints() {
    const s = G.s;
    if (screen !== 'game' || A.cinema.busy() || document.querySelector('.modal')) return setHint(null);
    let t = null;
    const narrow = window.innerWidth <= 900;
    if ((s.seen.tapped || 0) < 6 && tab === 'coin') t = views.coin.querySelector('.coin-wrap');
    else if (!s.seen.bought && s.coins >= 15) {
      if (narrow && !shopOpen) t = tabBtns.shop;
      else t = shopItems.find((i) => i.def.id === 'piggy').el;
    } else if (s.floor === 0 && !s.seen.elev && G.canGoal()) t = $('#elevator');
    setHint(t);
    if (t) {
      const c = U.center(t);
      hintEl.style.transform = `translate(${c.x}px, ${c.y}px)`;
    }
  }

  // ---------- modals ----------
  UI.modal = (html, cls) => {
    const root = $('#modal-root');
    const m = U.el('div', 'modal ' + (cls || ''));
    m.innerHTML = `<div class="panel">${html}</div>`;
    root.appendChild(m);
    UI.fillIcons(m);
    A.i18n.apply(m);
    A.sfx.whoosh(true);
    requestAnimationFrame(() => m.classList.add('in'));
    m.addEventListener('pointerdown', (e) => {
      if (e.target === m && !m.dataset.sticky) UI.closeModal(m);
    });
    return m;
  };
  UI.closeModal = (m) => {
    if (!m || m.dataset.closing) return;
    m.dataset.closing = '1';
    m.classList.remove('in');
    A.sfx.whoosh(false);
    setTimeout(() => m.remove(), 260);
    if (m._onClose) m._onClose();
  };

  UI.openSettings = (inGame) => {
    const st = A.settings;
    const m = UI.modal(
      `<div class="panel-head"><span data-icon="gear"></span><h3 data-i18n="settings"></h3><button class="icon-btn x">${A.icon('close')}</button></div>
      <div class="set-row"><span data-icon="sound"></span><label data-i18n="sound"></label><input type="range" min="0" max="100" class="rng" data-k="sfx"></div>
      <div class="set-row"><span data-icon="music"></span><label data-i18n="music"></label><input type="range" min="0" max="100" class="rng" data-k="music"></div>
      <div class="set-row"><span data-icon="globe"></span><label data-i18n="lang"></label><div class="seg">${A.i18n.langs
        .map((l) => `<button data-lang="${l}">${l.toUpperCase()}</button>`)
        .join('')}</div></div>
      <div class="set-row"><span data-icon="vibro"></span><label data-i18n="vibro"></label><button class="tog" data-k="vibro"><i></i></button></div>
      <div class="set-row"><span data-icon="screen"></span><label data-i18n="screen"></label><button class="tog" data-k="full"><i></i></button></div>
      <div class="set-row"><span data-icon="trash"></span><label data-i18n="reset"></label><button class="btn-danger reset">${A.icon('trash')}</button></div>
      ${inGame ? `<div class="panel-foot"><button class="btn btn-glass icon-only home">${A.icon('home')}</button></div>` : ''}`,
      'settings'
    );
    const sync = () => {
      U.$$('.rng', m).forEach((r) => {
        const v = Math.round(st[r.dataset.k] * 100);
        r.value = v;
        r.style.setProperty('--v', v + '%');
      });
      U.$$('.seg button', m).forEach((b) => b.classList.toggle('on', b.dataset.lang === st.lang));
      $('.tog[data-k="vibro"]', m).classList.toggle('on', !!st.vibro);
      $('.tog[data-k="full"]', m).classList.toggle('on', !!document.fullscreenElement);
    };
    sync();
    U.$$('.rng', m).forEach((r) =>
      r.addEventListener('input', () => {
        st[r.dataset.k] = r.value / 100;
        r.style.setProperty('--v', r.value + '%');
        A.sfx.setVolumes(st.sfx, st.music);
        A.saveSettings();
      })
    );
    U.$$('.rng', m).forEach((r) => r.addEventListener('change', () => A.sfx.ui()));
    U.$$('.seg button', m).forEach((b) =>
      b.addEventListener('click', () => {
        st.lang = b.dataset.lang;
        A.i18n.set(st.lang);
        UI.applyFloor(true);
        A.saveSettings();
        A.sfx.ui();
        sync();
      })
    );
    $('.tog[data-k="vibro"]', m).addEventListener('click', () => {
      st.vibro = !st.vibro;
      A.saveSettings();
      A.sfx.ui();
      sync();
      U.vibrate(40);
    });
    $('.tog[data-k="full"]', m).addEventListener('click', () => {
      A.sfx.ui();
      const d = document;
      try {
        const p = d.fullscreenElement ? d.exitFullscreen() : d.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* not supported */
      }
      setTimeout(sync, 300);
    });
    const rb = $('.reset', m);
    rb.addEventListener('click', () => {
      if (!rb.classList.contains('arm')) {
        rb.classList.add('arm');
        rb.innerHTML = A.icon('check');
        A.sfx.deny();
        setTimeout(() => {
          rb.classList.remove('arm');
          rb.innerHTML = A.icon('trash');
        }, 2500);
        return;
      }
      A.sfx.ui();
      UI.closeModal(m);
      A.main.resetGame();
    });
    $('.x', m).addEventListener('click', () => UI.closeModal(m));
    const home = $('.home', m);
    if (home)
      home.addEventListener('click', () => {
        UI.closeModal(m);
        A.main.toTitle();
      });
  };

  UI.offline = (n) => {
    const m = UI.modal(
      `<div class="offline">
        <div class="off-ic">${A.icon('moonz')}</div>
        <div class="off-amt">${A.icon('coin')}<b>+${U.fmt(n)}</b></div>
        <button class="btn btn-gold btn-round ok">${A.icon('check')}</button>
      </div>`,
      'small'
    );
    m.dataset.sticky = '1';
    $('.ok', m).addEventListener('click', () => {
      const c = U.center($('.off-amt', m));
      G.earn(n, 'offline');
      A.sfx.cashout();
      A.fx.fly(c.x, c.y, 20, UI.coinTarget, UI.coinHit, { spread: 1.5 });
      UI.closeModal(m);
    });
  };

  // ---------- tooltips ----------
  function initTips() {
    const tip = $('#tip');
    let cur = null;
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t === cur) return;
      cur = t;
      if (!t) {
        tip.classList.remove('on');
        return;
      }
      tip.textContent = t.getAttribute('data-tip');
      const r = t.getBoundingClientRect();
      const tw = tip.offsetWidth;
      let x = r.left + r.width / 2 - tw / 2;
      x = U.clamp(x, 6, window.innerWidth - tw - 6);
      let y = r.top - 34;
      if (y < 6) y = r.bottom + 8;
      tip.style.transform = `translate(${x}px, ${y}px)`;
      tip.classList.add('on');
      A.sfx.hover();
    });
    document.addEventListener('pointerdown', () => tip.classList.remove('on'));
  }

  // ---------- frame ----------
  UI.frame = (dt) => {
    if (screen === 'title') titleCoin.frame(dt);
    if (screen !== 'game') return;
    updateHud(dt);
    updateShop();
    updateGolden(dt);
    updateHints();
    if (tab === 'coin') {
      bigCoin.fever = G.isFever();
      bigCoin.frame(dt);
      if (G.isFever() && Math.random() < dt * 30) {
        const c = bigCoin.center();
        const a = U.rand(0, Math.PI * 2);
        const R = Math.min(c.w, c.h) * 0.36;
        A.fx.sparks(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, 1, U.pick(['#ffb13b', '#ff5a1a', '#ffe27a']), { min: 40, max: 120, g: -300, life: 1.4 });
      }
      if (G.atVault() && vaultCv) A.vault.drawDoor(vaultCv, { locks: G.s.locks, time: performance.now() / 1000 });
    }
    for (const id in A.games) A.games[id].frame(dt, tab === id);
  };

  UI.bigCoin = () => bigCoin;
  UI.views = views;
  A.ui = UI;
})();
