/* Hand-made vector icons (24x24 grid). Stroke = currentColor. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const F = 'fill="currentColor" stroke="none"';
  const T = 'fill="currentColor" fill-opacity=".18"';

  function spokes(cx, cy, r1, r2, n, off) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      const x1 = cx + Math.cos(a) * r1;
      const y1 = cy + Math.sin(a) * r1;
      const x2 = cx + Math.cos(a) * r2;
      const y2 = cy + Math.sin(a) * r2;
      d += `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
    }
    return d;
  }
  const leaf =
    'M12 11.3C9.6 9.7 8 8.4 8 6.5 8 5.2 9 4.2 10.1 4.2c.8 0 1.5.5 1.9 1.2.4-.7 1.1-1.2 1.9-1.2 1.1 0 2.1 1 2.1 2.3 0 1.9-1.6 3.2-4 4.8z';

  const P = {
    coin: `<circle cx="12" cy="12" r="9" ${T}/><circle cx="12" cy="12" r="5.6"/><path d="M12 9.2v5.6"/>`,
    play: `<path d="M8 5.2v13.6l11-6.8z" ${F}/>`,
    gear: `<circle cx="12" cy="12" r="6.3" ${T}/><circle cx="12" cy="12" r="2.4"/><path stroke-width="3.2" d="${spokes(12, 12, 7.4, 9.4, 8, 0)}"/>`,
    sound: `<path d="M4 9.3h3.6L12.2 5v14l-4.6-4.3H4z" ${T}/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.3 6.6a7.6 7.6 0 0 1 0 10.8"/>`,
    mute: `<path d="M4 9.3h3.6L12.2 5v14l-4.6-4.3H4z" ${T}/><path d="M16 9.5l5 5M21 9.5l-5 5"/>`,
    music: `<path d="M9 17.5V6.2l11-2.2v11.5"/><circle cx="6.6" cy="17.6" r="2.6" ${F}/><circle cx="17.6" cy="15.6" r="2.6" ${F}/>`,
    globe: `<circle cx="12" cy="12" r="9" ${T}/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>`,
    vibro: `<rect x="8" y="3.5" width="8" height="17" rx="2" ${T}/><path d="M4.6 9v6M19.4 9v6M2 10.8v2.4M22 10.8v2.4M11 17h2"/>`,
    screen: `<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
    trash: `<path d="M4 7h16M9 7V4.5h6V7"/><path d="M6.5 7l1 13h9l1-13" ${T}/><path d="M10 11v5.5M14 11v5.5"/>`,
    close: `<path d="M6 6l12 12M18 6L6 18"/>`,
    check: `<path d="M5 12.5l4.5 4.5L19 7"/>`,
    home: `<path d="M4 11l8-7 8 7"/><path d="M6.5 9.5V20h11V9.5" ${T}/><path d="M10 20v-5h4v5"/>`,
    back: `<path d="M15 5l-7 7 7 7"/>`,
    lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.2" ${T}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.3v2.6"/>`,
    unlock: `<rect x="5" y="10.5" width="14" height="10" rx="2.2" ${T}/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.5M12 14.3v2.6"/>`,
    tap: `<path d="M9.6 20.5l-3.9-5.2a1.6 1.6 0 0 1 2.4-2.1l1.6 1.5V6.2a1.6 1.6 0 0 1 3.2 0v5.2l4 .7a2.3 2.3 0 0 1 1.9 2.6l-.9 5.8" ${T}/><path d="M6.3 4.5L4.8 3M11.2 2.2V.9M16 4.5L17.5 3"/>`,
    bolt: `<path d="M13.5 2.5L5 13.6h6.3L10.2 21.5 19 10.2h-6.4z" ${T}/>`,
    fire: `<path d="M12 21.6c-3.9 0-6.6-2.7-6.6-6.3 0-3.3 2.3-5.2 3.6-7.8.4 1.6 1.2 2.6 2.3 3.2C11 6.8 12.7 4 15 2.4c-.3 3 1.3 5 2.5 6.7 1 1.4 1.6 3 1.6 4.7 0 4.5-3 7.8-7.1 7.8z" ${T}/><path d="M12 21.6c-1.7 0-3-1.2-3-3 0-2 1.8-3 2.5-4.6.9 1.3 3.5 2.3 3.5 4.7 0 1.7-1.3 2.9-3 2.9z" ${F}/>`,
    clover: `<g ${F} transform="rotate(20 12 12)"><path d="${leaf}"/><path d="${leaf}" transform="rotate(90 12 12)"/><path d="${leaf}" transform="rotate(180 12 12)"/><path d="${leaf}" transform="rotate(270 12 12)"/></g><path d="M12.6 12.8c1.4 2.8 3.2 5 5.8 7.4"/>`,
    magnet: `<path d="M5.5 3.5h4.2v8.7a2.3 2.3 0 0 0 4.6 0V3.5h4.2v8.7a6.5 6.5 0 0 1-13 0z" ${T}/><path d="M5.5 7.6h4.2M14.3 7.6h4.2"/>`,
    piggy: `<path d="M4.8 12c0-3.6 3.2-6.2 7.7-6.2 1.2 0 2.3.2 3.3.5l2.3-1.9v3.4c1 .8 1.7 1.8 2 3h1.6v4.1h-1.9c-.5 1-1.3 1.9-2.3 2.5V20h-3v-1.5h-3.6V20h-3v-2.6C6.2 16.3 4.8 14.4 4.8 12z" ${T}/><path d="M10.2 8.6h3.8M4.8 12c-1.4 0-2.3-.9-2-2.2"/><circle cx="16.6" cy="10.7" r="1" ${F}/>`,
    dice: `<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.8" ${T}/><g ${F}><circle cx="8.4" cy="8.4" r="1.55"/><circle cx="15.6" cy="8.4" r="1.55"/><circle cx="12" cy="12" r="1.55"/><circle cx="8.4" cy="15.6" r="1.55"/><circle cx="15.6" cy="15.6" r="1.55"/></g>`,
    cards: `<rect x="3" y="6.4" width="10" height="14" rx="1.8" transform="rotate(-13 8 13.4)"/><rect x="10.2" y="4" width="10" height="14" rx="1.8" transform="rotate(9 15.2 11)" ${T}/><path d="M15.6 9.4c-.8-1.3-2.7-.7-2.5.7.2 1.2 2 2.2 2.2 2.8.4-.6 2.2-1.4 2.5-2.6.3-1.4-1.5-2.2-2.2-.9z" ${F}/>`,
    slot: `<rect x="2.8" y="4.8" width="15.2" height="15.4" rx="2.6" ${T}/><path d="M2.8 9h15.2M5.7 12.6h2.3l-1.4 4M9.5 12.6h2.3l-1.4 4M13.3 12.6h2.3l-1.4 4M21 9v5.6h-3"/><circle cx="21" cy="7" r="1.7" ${F}/>`,
    roulette: `<circle cx="12" cy="12" r="9" ${T}/><circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="1.8" ${F}/><path d="${spokes(12, 12, 5.6, 9, 12, 0)}"/><circle cx="12" cy="4.6" r="1.1" ${F}/>`,
    wheel: `<circle cx="12" cy="13" r="8.2" ${T}/><path d="${spokes(12, 13, 2, 8.2, 8, Math.PI / 8)}"/><circle cx="12" cy="13" r="2" ${F}/><path d="M9.4 1.8h5.2L12 5.6z" ${F}/>`,
    diamond: `<path d="M6.6 4h10.8L21 9.2 12 20.5 3 9.2z" ${T}/><path d="M3 9.2h18M9.6 4L8 9.2l4 11.3 4-11.3L14.4 4"/>`,
    tower: `<path d="M9.5 21V3.5h9V21M3.5 21v-11h6" ${T}/><path d="M2 21h20M12.3 7h3.4M12.3 10.5h3.4M12.3 14h3.4M12.3 17.5h3.4M5.8 13.5h1.4M5.8 17h1.4"/>`,
    rocket: `<path d="M12 2.4c3.1 2.1 4.6 5.7 4.6 9.7l-1.6 4H9l-1.6-4c0-4 1.5-7.6 4.6-9.7z" ${T}/><circle cx="12" cy="9" r="1.9"/><path d="M7.4 12.2L4.8 15.4l.9 3.2 3.1-2.1M16.6 12.2l2.6 3.2-.9 3.2-3.1-2.1M10.4 19.2l1.6 3 1.6-3"/>`,
    plinko: `<g ${F}><circle cx="12" cy="4.2" r="1.5"/><circle cx="8.6" cy="8.4" r="1.5"/><circle cx="15.4" cy="8.4" r="1.5"/><circle cx="5.2" cy="12.6" r="1.5"/><circle cx="12" cy="12.6" r="1.5"/><circle cx="18.8" cy="12.6" r="1.5"/></g><path d="M2.8 17.2h18.4M2.8 17.2v3.6h18.4v-3.6M7.4 17.2v3.6M12 17.2v3.6M16.6 17.2v3.6"/>`,
    flip: `<ellipse cx="12" cy="12" rx="4.6" ry="7.6" ${T}/><path d="M12 8.6v6.8M3.4 8.5A9 9 0 0 1 16.8 4.4M20.6 15.5a9 9 0 0 1-13.4 4.1M17.8 1.6l-.9 2.9-2.9-.8M6.2 22.4l.9-2.9 2.9.8"/>`,
    crown: `<path d="M3.2 8.2l4.6 4 4.2-6.8 4.2 6.8 4.6-4-2 10.3H5.2z" ${T}/><path d="M5.2 21h13.6"/><g ${F}><circle cx="3.2" cy="7.6" r="1.4"/><circle cx="12" cy="4.6" r="1.4"/><circle cx="20.8" cy="7.6" r="1.4"/></g>`,
    key: `<circle cx="7.6" cy="12" r="4.2" ${T}/><circle cx="7.6" cy="12" r="1.3" ${F}/><path d="M11.8 12H21.4M18.4 12v3.6M15.4 12v2.6"/>`,
    vault: `<rect x="2.8" y="3.2" width="18.4" height="17.6" rx="2.8" ${T}/><circle cx="12.6" cy="12" r="5.2"/><path d="${spokes(12.6, 12, 1.6, 5.2, 6, 0)}M2.8 7.5h1.6M2.8 16.5h1.6"/>`,
    elevator: `<rect x="4.5" y="6.5" width="15" height="14.5" rx="1.8" ${T}/><path d="M12 6.5V21M8.6 4.4L12 1.6l3.4 2.8"/>`,
    up: `<path d="M12 19.5V5M6 11l6-6 6 6"/>`,
    down: `<path d="M12 4.5V19M6 13l6 6 6-6"/>`,
    star: `<path d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L3 9.4l6.2-.9z" ${T}/>`,
    trophy: `<path d="M7.8 3.6h8.4V10a4.2 4.2 0 0 1-8.4 0z" ${T}/><path d="M7.8 5.8H4.4c0 3 1.5 4.7 3.9 5M16.2 5.8h3.4c0 3-1.5 4.7-3.9 5M12 14.2v3.6M8 21h8M9.4 17.8h5.2"/>`,
    clock: `<circle cx="12" cy="12" r="9" ${T}/><path d="M12 6.8V12l3.6 2.2"/>`,
    gift: `<rect x="4" y="9.2" width="16" height="11.6" rx="1.6" ${T}/><path d="M3 9.2h18M12 9.2v11.6M12 9.2C10.6 5.6 6 4.7 6 7.1s3.6 2.1 6 2.1c2.4 0 6 .3 6-2.1s-4.6-1.5-6 2.1z"/>`,
    skull: `<path d="M12 3C7.5 3 4.5 6 4.5 10c0 2.5 1.2 4.3 3 5.3V19h9v-3.7c1.8-1 3-2.8 3-5.3 0-4-3-7-7.5-7z" ${T}/><g ${F}><circle cx="9" cy="10.6" r="1.9"/><circle cx="15" cy="10.6" r="1.9"/></g><path d="M10 19v2.2M14 19v2.2M12 13.6l-.8 1.8h1.6z"/>`,
    bag: `<path d="M9 3.4h6l-1.6 3.6h-2.8z"/><path d="M10.6 7C6.6 9 4 12.5 4 16c0 3.1 2.6 5 8 5s8-1.9 8-5c0-3.5-2.6-7-6.6-9z" ${T}/><path d="M12 10.4v7.4M14 12.1c-.5-.8-1.2-1.1-2-1.1-1.2 0-2 .6-2 1.5 0 2.1 4 1.3 4 3.3 0 .9-.8 1.5-2 1.5-.9 0-1.6-.3-2-1"/>`,
    shop: `<circle cx="12" cy="12" r="9.2" ${T}/><path d="M8 12.6l4-4 4 4M8 16.6l4-4 4 4"/>`,
    again: `<path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.8v5h-5"/>`,
    chip: `<circle cx="12" cy="12" r="9" ${T}/><circle cx="12" cy="12" r="5.2"/><path stroke-width="2.6" d="${spokes(12, 12, 6.6, 9, 8, Math.PI / 8)}"/>`,
    spin: `<path d="M4.6 12a7.4 7.4 0 0 1 12.8-5.1M19.4 12a7.4 7.4 0 0 1-12.8 5.1"/><path d="M17.8 2.8v4.5h-4.5M6.2 21.2v-4.5h4.5"/>`,
    sun: `<circle cx="12" cy="12" r="4.4" ${F}/><path d="${spokes(12, 12, 6.8, 9.4, 8, 0)}"/>`,
    moon: `<path d="M15.2 3.4A8.6 8.6 0 1 0 20.6 16 7.1 7.1 0 0 1 15.2 3.4z" ${F}/>`,
    x2: `<path d="M3.5 8l6 8M9.5 8l-6 8M13.4 9.6c.4-1.1 1.5-1.8 2.8-1.8 1.6 0 2.8 1 2.8 2.4 0 2.6-5.6 3.6-5.6 5.8h5.8"/>`,
    moonz: `<path d="M13.6 4.2A7.8 7.8 0 1 0 19.8 16a6.4 6.4 0 0 1-6.2-11.8z" ${T}/><path d="M16 3.5h4l-4 4.5h4"/>`,
    target: `<circle cx="12" cy="12" r="9" ${T}/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" ${F}/>`,
    info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.4v.2"/>`,
  };

  // Lucide supplies most of the set; casino-specific glyphs (slot, plinko, chips...) stay hand-drawn.
  const LUCIDE = {
    play: 'Play',
    gear: 'Settings',
    sound: 'Volume2',
    mute: 'VolumeX',
    music: 'Music',
    globe: 'Globe',
    vibro: 'Vibrate',
    screen: 'Maximize',
    trash: 'Trash2',
    close: 'X',
    check: 'Check',
    home: 'House',
    back: 'ChevronLeft',
    lock: 'Lock',
    unlock: 'LockOpen',
    tap: 'Pointer',
    bolt: 'Zap',
    fire: 'Flame',
    clover: 'Clover',
    magnet: 'Magnet',
    piggy: 'PiggyBank',
    dice: 'Dice5',
    diamond: 'Gem',
    tower: 'Building2',
    rocket: 'Rocket',
    crown: 'Crown',
    key: 'KeyRound',
    vault: 'Vault',
    up: 'ArrowUp',
    down: 'ArrowDown',
    star: 'Star',
    trophy: 'Trophy',
    clock: 'Clock3',
    gift: 'Gift',
    skull: 'Skull',
    bag: 'HandCoins',
    shop: 'ChevronsUp',
    again: 'RotateCw',
    spin: 'RefreshCw',
    sun: 'Sun',
    moon: 'Moon',
    moonz: 'MoonStar',
    target: 'Target',
    info: 'Info',
  };
  const esc = (v) => String(v).replace(/"/g, '&quot;');
  const cache = {};
  function lucideInner(name) {
    const L = window.lucide;
    const key = LUCIDE[name];
    if (!L || !key) return null;
    if (cache[name] !== undefined) return cache[name];
    const node = (L.icons && L.icons[key]) || L[key];
    if (!Array.isArray(node)) return (cache[name] = null);
    return (cache[name] = node
      .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs || {}).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`)
      .join(''));
  }

  const I = {};
  I.svg = (name, cls) =>
    `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${lucideInner(name) || P[name] || P.info}</svg>`;
  I.has = (name) => !!P[name];
  A.icon = I.svg;
  A.icons = I;
})();
