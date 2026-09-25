/* Economy: pure data + formulas (no DOM). */
(function (root) {
  'use strict';
  const E = {};

  // Floors of the casino tower. cost = elevator price to reach this floor.
  E.FLOORS = [
    { id: 'basement', cost: 0, game: 'flip' },
    { id: 'bar', cost: 15e3, game: 'slots' },
    { id: 'hall', cost: 800e3, game: 'plinko' },
    { id: 'vip', cost: 35e6, game: 'wheel' },
    { id: 'penthouse', cost: 1e9, game: 'crash' },
    { id: 'vault', cost: 10e9, game: null },
  ];

  // The three locks of the vault door. Opening the last one ends the game.
  E.LOCKS = [50e9, 100e9, 200e9];

  // Passive income sources.
  E.GENS = [
    { id: 'piggy', icon: 'piggy', base: 15, prod: 1, floor: 0 },
    { id: 'dice', icon: 'dice', base: 130, prod: 7, floor: 0 },
    { id: 'cards', icon: 'cards', base: 1200, prod: 50, floor: 1 },
    { id: 'slotm', icon: 'slot', base: 12e3, prod: 380, floor: 2 },
    { id: 'roulette', icon: 'roulette', base: 130e3, prod: 3000, floor: 3 },
    { id: 'diamond', icon: 'diamond', base: 1.5e6, prod: 25e3, floor: 4 },
    { id: 'tower', icon: 'tower', base: 20e6, prod: 220e3, floor: 5 },
  ];
  E.GEN_GROWTH = 1.15;
  E.MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300];

  // One-off leveled upgrades.
  E.UPGS = [
    { id: 'power', icon: 'tap', max: 30, base: 30, growth: 4.5, floor: 0 },
    { id: 'crit', icon: 'bolt', max: 10, base: 150, growth: 4, floor: 0 },
    { id: 'fever', icon: 'fire', max: 8, base: 600, growth: 6, floor: 1 },
    { id: 'luck', icon: 'clover', max: 10, base: 1000, growth: 4, floor: 1 },
    { id: 'magnet', icon: 'magnet', max: 5, base: 8000, growth: 9, floor: 2 },
  ];

  E.CRIT_MULT = 10;
  E.WHEEL_COOLDOWN = 150; // seconds between free wheel spins
  E.GOLDEN_LIFETIME = 9; // seconds a golden chip stays on screen
  E.FRENZY_DUR = 20; // golden chip income boost duration
  E.FRENZY_MULT = 7;
  E.OFFLINE_CAP = 2 * 3600; // seconds
  E.OFFLINE_RATE = 0.5;

  E.genById = {};
  E.GENS.forEach((g) => (E.genById[g.id] = g));
  E.upgById = {};
  E.UPGS.forEach((u) => (E.upgById[u.id] = u));

  E.genCost = (g, owned) => Math.ceil(g.base * Math.pow(E.GEN_GROWTH, owned));
  E.genMilestones = (owned) => {
    let m = 0;
    for (const t of E.MILESTONES) if (owned >= t) m++;
    return m;
  };
  E.nextMilestone = (owned) => {
    for (const t of E.MILESTONES) if (owned < t) return t;
    return null;
  };
  E.genProd = (g, owned) => g.prod * owned * Math.pow(2, E.genMilestones(owned));
  E.upgCost = (u, lvl) => Math.ceil(u.base * Math.pow(u.growth, lvl));

  // Raw passive income (no temporary boosts).
  E.baseCps = (s) => {
    let t = 0;
    for (const g of E.GENS) t += E.genProd(g, s.gens[g.id] || 0);
    // every floor and every opened vault lock boosts all passive income
    return t * E.floorMult(s);
  };
  E.floorMult = (s) => Math.pow(1.25, s.floor + (s.locks || 0));
  E.cps = (s, now) => E.baseCps(s) * (s.frenzyUntil > now ? E.FRENZY_MULT : 1);

  E.clickBase = (s) => Math.pow(2, s.upg.power || 0);
  E.clickValue = (s, now) => {
    // every click also grabs a slice of passive income so clicking never feels useless
    return Math.max(1, Math.floor(E.clickBase(s) + E.cps(s, now) * 0.03));
  };
  E.critChance = (s) => 0.02 + 0.025 * (s.upg.crit || 0);
  E.feverDur = (s) => 7 + 0.5 * (s.upg.fever || 0);
  E.feverMult = (s) => 3 + 0.5 * (s.upg.fever || 0);
  E.feverGain = (s) => 1 / (80 - 5 * (s.upg.fever || 0));
  // Return-to-player for gambling. Luck pushes it past 100%.
  E.rtp = (s) => 0.95 + 0.02 * (s.upg.luck || 0);
  E.goldenInterval = (s) => [95, 78, 64, 52, 42, 34][s.upg.magnet || 0];
  E.goldenReward = (s, now) => Math.max(50, E.cps(s, now) * 45 + E.clickValue(s, now) * 60);
  E.wheelFreeBet = (s) => Math.max(40, Math.floor(E.baseCps(s) * 60 + E.clickBase(s) * 30));

  // Rocket: P(reaching multiplier m) = K / m^beta. Luck lowers beta, rewarding bravery.
  E.CRASH_K = 0.96;
  E.CRASH_MAX = 1000;
  E.crashBeta = (s) => 1 - 0.012 * (s.upg.luck || 0);
  E.crashPoint = (s, u) => {
    const c = Math.pow(E.CRASH_K / Math.max(1e-9, u), 1 / E.crashBeta(s));
    return c < 1 ? 1 : Math.min(E.CRASH_MAX, Math.floor(c * 100) / 100);
  };

  E.BETS = [0.1, 0.25, 0.5, 1];

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else (root.ALLIN = root.ALLIN || {}).econ = E;
})(typeof window !== 'undefined' ? window : globalThis);
