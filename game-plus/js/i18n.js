/* Two languages, one word per label. */
(function () {
  'use strict';
  const A = (window.ALLIN = window.ALLIN || {});

  const DICT = {
    ru: {
      title: 'ВА-БАНК',
      play: 'Играть',
      settings: 'Настройки',
      sound: 'Звук',
      music: 'Музыка',
      lang: 'Язык',
      vibro: 'Вибро',
      screen: 'Экран',
      reset: 'Сброс',
      again: 'Заново',
      victory: 'ПОБЕДА',
      bigwin: 'КРУПНО!',
      mega: 'МЕГА!',
      jackpot: 'ДЖЕКПОТ!',
      fever: 'ЖАРА!',
      frenzy: 'УДАЧА!',
      open: 'ОТКРЫТО',
      f_basement: 'Подвал',
      f_bar: 'Бар',
      f_hall: 'Зал',
      f_vip: 'VIP',
      f_penthouse: 'Пентхаус',
      f_vault: 'Хранилище',
      g_coin: 'Монета',
      g_flip: 'Бросок',
      g_slots: 'Слоты',
      g_plinko: 'Плинко',
      g_wheel: 'Колесо',
      g_crash: 'Ракета',
      g_shop: 'Магазин',
      u_power: 'Сила',
      u_crit: 'Крит',
      u_fever: 'Жара',
      u_luck: 'Удача',
      u_magnet: 'Магнит',
      p_piggy: 'Копилка',
      p_dice: 'Кости',
      p_cards: 'Карты',
      p_slotm: 'Автомат',
      p_roulette: 'Рулетка',
      p_diamond: 'Алмазы',
      p_tower: 'Башня',
    },
    en: {
      title: 'ALL IN',
      play: 'Play',
      settings: 'Settings',
      sound: 'Sound',
      music: 'Music',
      lang: 'Language',
      vibro: 'Vibration',
      screen: 'Screen',
      reset: 'Reset',
      again: 'Again',
      victory: 'VICTORY',
      bigwin: 'BIG WIN!',
      mega: 'MEGA!',
      jackpot: 'JACKPOT!',
      fever: 'FEVER!',
      frenzy: 'LUCKY!',
      open: 'OPEN',
      f_basement: 'Basement',
      f_bar: 'Bar',
      f_hall: 'Hall',
      f_vip: 'VIP',
      f_penthouse: 'Penthouse',
      f_vault: 'Vault',
      g_coin: 'Coin',
      g_flip: 'Flip',
      g_slots: 'Slots',
      g_plinko: 'Plinko',
      g_wheel: 'Wheel',
      g_crash: 'Rocket',
      g_shop: 'Shop',
      u_power: 'Power',
      u_crit: 'Crit',
      u_fever: 'Fever',
      u_luck: 'Luck',
      u_magnet: 'Magnet',
      p_piggy: 'Piggy',
      p_dice: 'Dice',
      p_cards: 'Cards',
      p_slotm: 'Slots',
      p_roulette: 'Roulette',
      p_diamond: 'Diamonds',
      p_tower: 'Tower',
    },
  };

  const I = {};
  I.langs = ['ru', 'en'];
  I.lang = 'ru';
  I.detect = () => {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^(ru|uk|be|kk)/i.test(nav) ? 'ru' : 'en';
  };
  I.set = (lang) => {
    I.lang = DICT[lang] ? lang : 'en';
    document.documentElement.lang = I.lang;
    document.title = I.t('title') + ' Deluxe';
    I.apply(document);
  };
  I.t = (key) => (DICT[I.lang] && DICT[I.lang][key]) || DICT.en[key] || key;
  I.apply = (root) => {
    root.querySelectorAll('[data-i18n]').forEach((e) => {
      const txt = I.t(e.getAttribute('data-i18n'));
      if (e.classList.contains('split')) e.innerHTML = Array.from(txt, (ch) => `<span class="ll">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
      else e.textContent = txt;
    });
    root.querySelectorAll('[data-i18n-title]').forEach((e) => {
      const txt = I.t(e.getAttribute('data-i18n-title'));
      e.setAttribute('aria-label', txt);
      e.setAttribute('data-tip', txt);
    });
  };

  A.i18n = I;
  A.t = I.t;
})();
