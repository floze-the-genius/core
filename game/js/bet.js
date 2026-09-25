/* Shared bet selector: four casino chips (share of balance) + live amount. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});
  const U = A.util;
  const E = A.econ;

  const CHIP_CLS = ['c10', 'c25', 'c50', 'c100'];

  class Bet {
    constructor(host, key) {
      this.key = key;
      this.idx = 1;
      const saved = A.game.s.seen['bet_' + key];
      if (typeof saved === 'number') this.idx = U.clamp(saved, 0, E.BETS.length - 1);
      this.el = U.el('div', 'bet');
      this.chips = E.BETS.map((f, i) => {
        const b = U.el('button', 'chip ' + CHIP_CLS[i]);
        b.innerHTML = `<span class="chip-in">${Math.round(f * 100)}%</span>`;
        b.addEventListener('click', () => {
          this.select(i);
          A.sfx.ui();
        });
        this.el.appendChild(b);
        return b;
      });
      this.amt = U.el('div', 'bet-amt', `${A.icon('coin', 'gold')}<span>0</span>`);
      this.amtNum = this.amt.querySelector('span');
      host.appendChild(this.el);
      this.select(this.idx, true);
      this.last = -1;
    }
    mountAmount(host) {
      host.appendChild(this.amt);
    }
    select(i, silent) {
      this.idx = i;
      this.chips.forEach((c, j) => c.classList.toggle('on', j === i));
      A.game.s.seen['bet_' + this.key] = i;
      if (!silent) this.chips[i].animate([{ transform: 'translateY(-10px) scale(1.15)' }, { transform: '' }], { duration: 260, easing: 'ease-out' });
      this.last = -1;
    }
    frac() {
      return E.BETS[this.idx];
    }
    amount() {
      return A.game.betAmount(this.frac());
    }
    lock(on) {
      this.el.classList.toggle('locked', !!on);
    }
    refresh() {
      const a = this.amount();
      if (a !== this.last) {
        this.last = a;
        this.amtNum.textContent = U.fmt(a);
        this.amt.classList.toggle('zero', a < 1);
      }
    }
  }

  A.Bet = Bet;
})();
