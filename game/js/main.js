/* Boot, main loop, screen flow, and wiring between game events and presentation. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;
  const G = A.game;
  const E = A.econ;
  const $ = U.$;

  const SETTINGS_KEY = 'allin.settings.v1';
  A.settings = Object.assign({ lang: A.i18n.detect(), sfx: 0.8, music: 0.55, vibro: true }, U.store.get(SETTINGS_KEY, {}));
  A.saveSettings = () => U.store.set(SETTINGS_KEY, A.settings);

  const M = {};
  let last = performance.now();
  let hiddenAt = 0;

  function audioOn() {
    A.sfx.init();
    A.sfx.setVolumes(A.settings.sfx, A.settings.music);
  }

  function buildLangQuick() {
    const host = $('#lang-quick');
    host.innerHTML = A.i18n.langs.map((l) => `<button data-lang="${l}">${l.toUpperCase()}</button>`).join('');
    const sync = () => U.$$('button', host).forEach((b) => b.classList.toggle('on', b.dataset.lang === A.settings.lang));
    U.$$('button', host).forEach((b) =>
      b.addEventListener('click', () => {
        A.settings.lang = b.dataset.lang;
        A.i18n.set(A.settings.lang);
        A.saveSettings();
        audioOn();
        A.sfx.ui();
        sync();
      })
    );
    sync();
  }

  M.boot = () => {
    A.i18n.set(A.settings.lang);
    A.fx.init();
    G.load();
    A.ui.init();
    A.ui.applyFloor(true);
    A.fx.setTheme('title', true);
    document.body.dataset.screen = 'title';
    buildLangQuick();
    A.ui.show('title');

    $('#btn-play').addEventListener('click', M.play);
    $('#btn-settings').addEventListener('click', () => {
      audioOn();
      A.sfx.ui();
      A.ui.openSettings(false);
    });
    $('#btn-again').addEventListener('click', () => {
      A.sfx.ui();
      M.newGame();
    });
    $('#btn-home').addEventListener('click', () => {
      A.sfx.ui();
      M.toTitle();
    });

    // The first touch anywhere wakes up the audio and the lounge music.
    const wake = () => {
      audioOn();
      if (A.ui.screen() === 'title' && !A.sfx.music.on) A.sfx.music.start('title');
    };
    document.addEventListener('pointerdown', wake, { once: true });
    document.addEventListener('keydown', wake, { once: true });

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => G.save());
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    requestAnimationFrame(loop);
  };

  function onVisibility() {
    if (document.hidden) {
      hiddenAt = Date.now();
      G.save();
      A.sfx.suspend();
    } else {
      A.sfx.resume();
      last = performance.now();
      if (A.ui.screen() === 'game' && hiddenAt && Date.now() - hiddenAt > 60000) {
        const n = G.offline();
        if (n > 0) A.ui.offline(n);
      }
      hiddenAt = 0;
    }
  }

  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    U.updateTimers(dt);
    U.updateTweens(dt);
    if (A.ui.screen() === 'game') G.tick(dt);
    A.ui.frame(dt);
    A.fx.frame(dt);
    requestAnimationFrame(loop);
  }

  M.play = () => {
    audioOn();
    A.sfx.ui();
    if (G.hasSave()) M.continueGame();
    else M.newGame();
  };

  M.continueGame = () => {
    const off = G.offline();
    A.ui.applyFloor(true);
    A.ui.show('game');
    A.sfx.music.start(G.atVault() ? 'vault' : 'main');
    A.sfx.whoosh(true);
    if (off > 0) U.after(0.5, () => A.ui.offline(off));
  };

  M.newGame = async () => {
    G.reset();
    G.s.started = true;
    G.save();
    A.ui.applyFloor(true);
    A.ui.setTab('coin', true);
    A.ui.show('game');
    A.sfx.music.stop();
    await A.cinema.intro();
    A.sfx.music.start('main');
    A.fx.flash('#ffffff', 0.25, 0.8);
    const c = A.ui.bigCoin().center();
    A.fx.ring(c.x, c.y, '#ffffff', 220, 0.7, 10);
    A.fx.stars(c.x, c.y, 12, '#fff3b0', 120);
  };

  M.toTitle = () => {
    G.save();
    A.ui.show('title');
    A.fx.setTheme('title');
    A.sfx.music.start('title');
    A.sfx.music.setKey(0);
    A.sfx.music.setEnergy(0);
    A.sfx.music.setFever(false);
  };

  M.resetGame = () => {
    G.reset();
    M.toTitle();
  };

  // ---------- game events -> presentation ----------
  G.on('floor', (f) => {
    A.cinema.elevator(f).then(() => {
      const game = E.FLOORS[f].game;
      if (game) {
        const tabBtn = document.querySelector(`.tab[data-tab="${game}"]`);
        if (tabBtn) {
          const c = U.center(tabBtn);
          A.fx.ring(c.x, c.y, '#ffffff', 80, 0.7, 6);
          A.fx.stars(c.x, c.y, 10, '#fff3b0', 30);
        }
      }
      G.save();
    });
  });

  G.on('lock', (n) => {
    if (n < E.LOCKS.length) A.cinema.lock(n);
  });

  G.on('win', async () => {
    A.ui.setTab('coin');
    A.cinema.lock(E.LOCKS.length);
    await U.wait(1.2);
    const close = await A.cinema.finale();
    showEnd();
    close();
    const { w, h } = A.fx.size();
    for (let i = 0; i < 8; i++) U.after(0.4 + i * 0.5, () => A.fx.firework(U.rand(w * 0.1, w * 0.9), U.rand(h * 0.1, h * 0.4)));
    A.fx.confetti(0, 0, 200, { wide: true, down: true });
    A.sfx.music.start('title');
    A.sfx.music.setKey(0);
  });

  G.on('fever', (on) => A.sfx.music.setFever(on));

  function showEnd() {
    const s = G.s;
    const st = s.stats;
    const items = [
      ['clock', U.fmtTime(s.time)],
      ['tap', U.fmt(st.clicks)],
      ['bolt', U.fmt(st.crits)],
      ['chip', U.fmt(st.bets)],
      ['trophy', U.fmt(st.bestWin)],
      ['coin', U.fmt(s.total)],
      ['clover', U.fmt(st.golden)],
      ['crown', U.fmt(st.jackpots)],
    ];
    $('#end-stats').innerHTML = items
      .map(([ic, v], i) => `<div class="stat" style="animation-delay:${0.4 + i * 0.08}s">${A.icon(ic)}<b>${v}</b></div>`)
      .join('');
    A.fx.setTheme('vault');
    A.ui.show('end');
  }

  M.toTitleFromEnd = M.toTitle;
  A.main = M;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', M.boot);
  else M.boot();
})();
