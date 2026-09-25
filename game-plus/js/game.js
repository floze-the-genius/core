/* Core game state and rules. UI listens to events emitted here. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const E = A.econ;
  const U = A.util;

  const SAVE_KEY = 'allin.save.v1';
  const G = {};
  const listeners = {};
  G.on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  G.emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));

  G.fresh = () => ({
    v: 1,
    coins: 0,
    total: 0,
    floor: 0,
    locks: 0,
    gens: {},
    upg: {},
    jackpot: 800,
    wheelAt: 0,
    frenzyUntil: 0,
    fever: 0,
    feverUntil: 0,
    goldenAt: 45,
    time: 0,
    lastClick: -99,
    stats: { clicks: 0, crits: 0, bets: 0, bestWin: 0, spent: 0, golden: 0, jackpots: 0 },
    seen: {},
    won: false,
    started: false,
    saved: Date.now(),
  });

  G.s = G.fresh();

  G.load = () => {
    const d = U.store.get(SAVE_KEY, null);
    if (!d || d.v !== 1) return false;
    const base = G.fresh();
    G.s = Object.assign(base, d);
    G.s.stats = Object.assign(G.fresh().stats, d.stats || {});
    G.s.seen = d.seen || {};
    return true;
  };
  G.save = () => {
    if (!G.s.started) return;
    G.s.saved = Date.now();
    U.store.set(SAVE_KEY, G.s);
  };
  G.hasSave = () => {
    const d = U.store.get(SAVE_KEY, null);
    return !!(d && d.v === 1 && d.started && !d.won);
  };
  G.reset = () => {
    U.store.del(SAVE_KEY);
    G.s = G.fresh();
  };

  // ---- derived ----
  G.cps = () => E.cps(G.s, G.s.time);
  G.baseCps = () => E.baseCps(G.s);
  G.clickValue = () => E.clickValue(G.s, G.s.time);
  G.isFever = () => G.s.feverUntil > G.s.time;
  G.isFrenzy = () => G.s.frenzyUntil > G.s.time;
  G.rtp = () => E.rtp(G.s);
  G.atVault = () => G.s.floor >= E.FLOORS.length - 1;
  G.goalCost = () => (G.atVault() ? E.LOCKS[G.s.locks] || Infinity : E.FLOORS[G.s.floor + 1].cost);
  G.floorId = () => E.FLOORS[G.s.floor].id;
  G.gameUnlocked = (gameId) => {
    const f = E.FLOORS.findIndex((x) => x.game === gameId);
    return f >= 0 && G.s.floor >= f;
  };
  G.gameFloor = (gameId) => E.FLOORS.findIndex((x) => x.game === gameId);

  // ---- money ----
  G.earn = (n, src) => {
    if (!(n > 0)) return;
    G.s.coins += n;
    G.s.total += n;
    G.emit('earn', { n, src });
  };
  G.spend = (n) => {
    if (n > G.s.coins + 1e-6) return false;
    G.s.coins = Math.max(0, G.s.coins - n);
    G.s.stats.spent += n;
    G.emit('spend', n);
    return true;
  };

  // ---- clicking ----
  let combo = 0;
  G.combo = () => combo;
  G.click = () => {
    const s = G.s;
    const fever = G.isFever();
    const crit = Math.random() < E.critChance(s);
    let v = G.clickValue();
    if (fever) v *= E.feverMult(s);
    if (crit) v *= E.CRIT_MULT;
    v = Math.floor(v);
    s.stats.clicks++;
    if (crit) s.stats.crits++;
    combo = s.time - s.lastClick < 0.6 ? combo + 1 : 0;
    s.lastClick = s.time;
    let feverStart = false;
    if (!fever) {
      s.fever = Math.min(1, s.fever + E.feverGain(s));
      if (s.fever >= 1) {
        s.fever = 0;
        s.feverUntil = s.time + E.feverDur(s);
        feverStart = true;
      }
    }
    G.earn(v, 'click');
    const r = { v, crit, fever, feverStart, combo };
    G.emit('click', r);
    if (feverStart) G.emit('fever', true);
    return r;
  };

  // ---- shop ----
  G.genCost = (id) => E.genCost(E.genById[id], G.s.gens[id] || 0);
  G.upgCost = (id) => E.upgCost(E.upgById[id], G.s.upg[id] || 0);
  G.upgMaxed = (id) => (G.s.upg[id] || 0) >= E.upgById[id].max;
  G.buyGen = (id) => {
    const cost = G.genCost(id);
    if (!G.spend(cost)) return false;
    const before = G.s.gens[id] || 0;
    G.s.gens[id] = before + 1;
    const milestone = E.genMilestones(before + 1) > E.genMilestones(before);
    G.emit('buy', { kind: 'gen', id, milestone });
    return true;
  };
  G.buyUpg = (id) => {
    if (G.upgMaxed(id)) return false;
    const cost = G.upgCost(id);
    if (!G.spend(cost)) return false;
    G.s.upg[id] = (G.s.upg[id] || 0) + 1;
    G.emit('buy', { kind: 'upg', id });
    return true;
  };

  // ---- progression ----
  G.canGoal = () => G.s.coins >= G.goalCost();
  G.goUp = () => {
    if (!G.canGoal()) return false;
    if (!G.spend(G.goalCost())) return false;
    if (G.atVault()) {
      G.s.locks++;
      G.emit('lock', G.s.locks);
      if (G.s.locks >= E.LOCKS.length) {
        G.s.won = true;
        G.save();
        G.emit('win');
      }
    } else {
      G.s.floor++;
      G.s.jackpot = Math.max(G.s.jackpot, G.baseCps() * 120);
      G.emit('floor', G.s.floor);
    }
    G.save();
    return true;
  };

  // ---- gambling ----
  G.betAmount = (frac) => Math.floor(G.s.coins * frac);
  G.placeBet = (amount) => {
    amount = Math.floor(amount);
    if (amount < 1 || !G.spend(amount)) return false;
    G.s.stats.bets++;
    G.s.jackpot += amount * 0.03;
    G.emit('bet', amount);
    return true;
  };
  // Returns the tier of the win for fanfare: 0 none/refund, 1 win, 2 big, 3 mega
  G.payout = (win, bet) => {
    win = Math.floor(win);
    if (win > 0) G.earn(win, 'bet');
    const ratio = bet > 0 ? win / bet : win > 0 ? 10 : 0;
    const profit = win - bet;
    if (profit > G.s.stats.bestWin) G.s.stats.bestWin = profit;
    let tier = 0;
    if (ratio >= 25) tier = 3;
    else if (ratio >= 8) tier = 2;
    else if (ratio > 1.001) tier = 1;
    G.emit('payout', { win, bet, ratio, tier });
    return tier;
  };
  G.winJackpot = () => {
    const j = Math.floor(G.s.jackpot);
    G.s.jackpot = Math.max(1000, G.baseCps() * 120);
    G.s.stats.jackpots++;
    return j;
  };

  // ---- golden chip ----
  G.goldenReward = () => {
    G.s.stats.golden++;
    if (Math.random() < 0.5) {
      G.s.frenzyUntil = G.s.time + E.FRENZY_DUR;
      G.emit('frenzy', true);
      return { kind: 'frenzy' };
    }
    const n = Math.floor(E.goldenReward(G.s, G.s.time));
    return { kind: 'coins', n };
  };

  // ---- time ----
  let saveAcc = 0;
  let wasFever = false;
  let wasFrenzy = false;
  G.tick = (dt) => {
    const s = G.s;
    if (!s.started || s.won) return;
    s.time += dt;
    const inc = G.cps() * dt;
    if (inc > 0) {
      s.coins += inc;
      s.total += inc;
    }
    s.jackpot += G.baseCps() * dt * 0.4;
    if (!G.isFever() && s.time - s.lastClick > 2) s.fever = Math.max(0, s.fever - dt * 0.03);
    const fever = G.isFever();
    if (wasFever && !fever) G.emit('fever', false);
    wasFever = fever;
    const frenzy = G.isFrenzy();
    if (wasFrenzy && !frenzy) G.emit('frenzy', false);
    wasFrenzy = frenzy;
    if (s.time >= s.goldenAt) {
      s.goldenAt = s.time + E.goldenInterval(s) * U.rand(0.7, 1.3);
      G.emit('golden');
    }
    saveAcc += dt;
    if (saveAcc > 5) {
      saveAcc = 0;
      G.save();
    }
  };

  G.offline = () => {
    const s = G.s;
    const away = (Date.now() - (s.saved || Date.now())) / 1000;
    if (away < 60 || s.won) return 0;
    const n = Math.floor(Math.min(away, E.OFFLINE_CAP) * E.baseCps(s) * E.OFFLINE_RATE);
    return n;
  };

  A.game = G;
})();
