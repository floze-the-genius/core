/* Coin flip: pick sun or moon, double or nothing. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;

  const F = { id: 'flip', icon: 'flip' };
  let el;
  let coin;
  let shadow;
  let bet;
  let btns;
  let streakEl;
  let busy = false;
  let anim = null;
  let streak = 0;
  let lastFace = 0;

  F.build = (view) => {
    el = view;
    el.classList.add('g-flip');
    el.innerHTML = `
      <div class="flip-top"><div class="flip-streak" id="flip-streak"></div></div>
      <div class="flip-scene">
        <div class="flip-coin">
          ${Array.from({ length: 9 }, (_, i) => `<div class="flip-layer" style="transform: translateZ(${(i - 4) * 1.2}px)"></div>`).join('')}
          <div class="flip-face sun">${A.icon('sun')}</div>
          <div class="flip-face moon">${A.icon('moon')}</div>
        </div>
        <div class="flip-shadow"></div>
      </div>
      <div class="flip-pick">
        <button class="pick sun" data-face="0">${A.icon('sun')}</button>
        <div class="flip-bet-amt"></div>
        <button class="pick moon" data-face="1">${A.icon('moon')}</button>
      </div>
      <div class="bet-host"></div>`;
    coin = el.querySelector('.flip-coin');
    shadow = el.querySelector('.flip-shadow');
    streakEl = el.querySelector('.flip-streak');
    bet = new A.Bet(el.querySelector('.bet-host'), 'flip');
    bet.mountAmount(el.querySelector('.flip-bet-amt'));
    btns = U.$$('.pick', el);
    btns.forEach((b) => b.addEventListener('click', () => F.play(+b.dataset.face, b)));
    setCoin(0, 0, 0);
  };

  function setCoin(rot, lift, wob) {
    coin.style.transform = `translateY(${-lift}px) rotateX(${rot}deg) rotateY(${wob}deg)`;
    const k = U.clamp(1 - lift / 260, 0.35, 1);
    shadow.style.transform = `translateX(-50%) scale(${k})`;
    shadow.style.opacity = 0.25 + 0.5 * k;
  }

  F.play = (face, btn) => {
    if (busy) return;
    const amount = bet.amount();
    if (!A.game.placeBet(amount)) {
      A.sfx.deny();
      A.ui.denyShake(btn);
      return;
    }
    busy = true;
    bet.lock(true);
    btns.forEach((b) => b.classList.toggle('chosen', b === btn));
    el.classList.remove('won', 'lost');
    A.sfx.toss();
    A.fx.pulse(0.3);
    const win = Math.random() < A.game.rtp() / 2;
    const result = win ? face : 1 - face;
    const turns = U.randi(5, 7);
    const from = lastFace * 180;
    const to = turns * 360 + result * 180;
    lastFace = result;
    const H = Math.min(170, el.clientHeight * 0.2);
    const dur = 1.25;
    let t = 0;
    anim = (dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      const lift = H * 4 * k * (1 - k);
      const rot = from + (to - from) * U.ease.outQuad(k);
      setCoin(rot, lift, Math.sin(k * Math.PI * 3) * 10);
      if (k >= 1) {
        anim = landing(result, face, amount, win);
      }
    };
  };

  function landing(result, face, amount, win) {
    A.sfx.clink();
    A.fx.shake(4, 0.15);
    let t = 0;
    let done = false;
    return (dt) => {
      t += dt;
      const bounce = Math.abs(Math.sin(t * 16)) * 22 * Math.exp(-t * 7);
      const wob = Math.sin(t * 22) * 18 * Math.exp(-t * 6);
      setCoin(result * 180 + wob, bounce, 0);
      if (!done && t > 0.35) {
        done = true;
        resolve(result, face, amount, win);
      }
      if (t > 0.9) {
        setCoin(result * 180, 0, 0);
        anim = null;
        busy = false;
        bet.lock(false);
      }
    };
  }

  function resolve(result, face, amount, win) {
    const c = U.center(coin);
    if (win) {
      streak++;
      const prize = amount * 2;
      A.game.payout(prize, amount);
      el.classList.add('won');
      A.ui.celebrate(c.x, c.y, prize, amount, 1 + Math.min(3, streak - 1));
      A.fx.ring(c.x, c.y, '#ffe27a', 150, 0.6, 10);
      if (streak >= 3) A.fx.banner('x' + Math.pow(2, streak), 'fire', { life: 1.1 });
    } else {
      streak = 0;
      A.game.payout(0, amount);
      el.classList.add('lost');
      U.after(1.4, () => !busy && el.classList.remove('lost'));
      A.sfx.lose();
      A.fx.sparks(c.x, c.y, 18, '#8a93a8', { max: 300 });
      A.ui.loseText(c.x, c.y - 40, amount);
    }
    streakEl.innerHTML = streak >= 2 ? `${A.icon('fire')}<b>${streak}</b>` : '';
    streakEl.classList.toggle('on', streak >= 2);
  }

  F.frame = (dt, visible) => {
    if (anim) anim(dt);
    if (visible) bet.refresh();
  };
  F.show = () => {};
  F.hide = () => {};
  F.busy = () => busy;

  (A.games = A.games || {}).flip = F;
})();
