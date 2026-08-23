(function () {
  'use strict';

  var VERSION = 'v3';
  var CALC = window.IleZaDzisCalculator;
  var PRICES = CALC.PRICES;
  var MULTI_DISCOUNT = CALC.MULTI_DISCOUNT;
  var TIME_MIN = 1, TIME_MAX = 16;   // w jednostkach 0,5h: 0,5h .. 8h
  var MULTI_MIN = 0, MULTI_MAX = 8;
  var PLAYERS_MIN = 1, PLAYERS_MAX = 8;
  var LS_KEY = 'ilezadzis-state';
  var SHUTTLE_PLACEHOLDERS = ['Lotki (zł)', 'np. 14', 'np. 3x12', 'np. 2*8'];

  function defaultState() {
    return {
      dayType: 'weekday',
      halfHours: 4,      // 2h
      multisports: 4,
      players: 4,
      shuttles: ['', '', '', '']
    };
  }

  var syncLocalStateToUrl = false;
  var state = load();
  if (syncLocalStateToUrl) save();

  // ---------- helpers ----------
  function round2(x) {
    return CALC.round2(x);
  }

  function formatMoney(v) {
    var r = round2(v);
    return r.toFixed(2).replace('.', ',') + ' zł';
  }

  function shortNum(v) {
    var r = round2(v);
    return String(r).replace('.', ',');
  }

  function formatHours(hh) {
    var h = hh / 2;
    var dec = (h % 1 === 0) ? 0 : 1;
    return h.toFixed(dec).replace('.', ',') + 'h';
  }

  function clampInt(str, min, max, def) {
    var n = parseInt(str, 10);
    if (isNaN(n)) return def;
    return Math.min(max, Math.max(min, n));
  }

  function parseShuttleValue(value) {
    return CALC.parseShuttleValue(value);
  }

  function normalizeShuttles(arr, n) {
    return CALC.normalizeShuttles(arr, n);
  }

  // ---------- compute ----------
  function compute(s) {
    return CALC.compute(s);
  }

  // ---------- persistence ----------
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}

    var params = new URLSearchParams();
    params.set('d', state.dayType);
    params.set('t', state.halfHours);
    params.set('m', state.multisports);
    params.set('p', state.players);
    if (state.shuttles.some(function (x) { return String(x).trim() !== ''; })) {
      params.set('l', CALC.serializeShuttles(state.shuttles));
    }
    var url = new URL(location.href);
    url.search = params.toString();
    history.replaceState(null, '', url);
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return null;
      var out = defaultState();
      out.dayType = s.dayType === 'weekend' ? 'weekend' : 'weekday';
      out.halfHours = clampInt(s.halfHours, TIME_MIN, TIME_MAX, out.halfHours);
      out.multisports = clampInt(s.multisports, MULTI_MIN, MULTI_MAX, out.multisports);
      out.players = clampInt(s.players, PLAYERS_MIN, PLAYERS_MAX, out.players);
      out.shuttles = normalizeShuttles(s.shuttles, out.players);
      return out;
    } catch (e) {
      return null;
    }
  }

  function load() {
    var params = new URLSearchParams(location.search);
    var fromUrl = params.has('d') || params.has('t') || params.has('m') || params.has('p') || params.has('l');
    if (fromUrl) {
      var s = defaultState();
      s.dayType = params.get('d') === 'weekend' ? 'weekend' : 'weekday';
      s.halfHours = clampInt(params.get('t'), TIME_MIN, TIME_MAX, s.halfHours);
      s.multisports = clampInt(params.get('m'), MULTI_MIN, MULTI_MAX, s.multisports);
      s.players = clampInt(params.get('p'), PLAYERS_MIN, PLAYERS_MAX, s.players);
      var list = params.get('l');
      if (list != null) {
        s.shuttles = CALC.deserializeShuttles(list, s.players);
      }
      s.shuttles = normalizeShuttles(s.shuttles, s.players);
      return s;
    }
    var localState = readLocal();
    if (localState) {
      syncLocalStateToUrl = true;
      return localState;
    }
    return defaultState();
  }

  // ---------- rendering ----------
  function renderDayType() {
    var buttons = document.querySelectorAll('.seg-btn');
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute('data-day') === state.dayType;
      buttons[i].classList.toggle('active', active);
      buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function renderSteppers() {
    var timeBtnDec = document.querySelector('[data-target="time"][data-action="dec"]');
    var timeBtnInc = document.querySelector('[data-target="time"][data-action="inc"]');
    var multiBtnDec = document.querySelector('[data-target="multisport"][data-action="dec"]');
    var multiBtnInc = document.querySelector('[data-target="multisport"][data-action="inc"]');

    document.getElementById('timeValue').textContent = formatHours(state.halfHours);
    document.getElementById('multiValue').textContent = state.multisports;

    timeBtnDec.disabled = state.halfHours <= TIME_MIN;
    timeBtnInc.disabled = state.halfHours >= TIME_MAX;
    multiBtnDec.disabled = state.multisports <= MULTI_MIN;
    multiBtnInc.disabled = state.multisports >= MULTI_MAX;

    var hint = document.getElementById('multiHint');
    if (state.multisports > 0) {
      hint.innerHTML = 'Rabat: <strong>' + formatMoney(-state.multisports * MULTI_DISCOUNT) + '</strong>';
    } else {
      hint.textContent = 'Brak rabatu';
    }
  }

  function lotkiDetail(shuttles, total) {
    var parts = shuttles.map(parseShuttleValue).filter(function (v) { return v !== 0; });
    if (parts.length === 0) return null;
    if (parts.length === 1) return formatMoney(total);
    return parts.map(shortNum).join(' zł + ') + ' zł = ' + formatMoney(total);
  }

  function renderSummary() {
    var c = compute(state);
    var price = PRICES[state.dayType];

    var rows = [
      { label: 'Kort', value: formatMoney(price) + ' × ' + state.halfHours + ' = ' + formatMoney(c.courtGross), negative: false },
      { label: 'Multisporty', value: '15 zł × ' + state.multisports + ' = ' + formatMoney(-c.multiDiscount), negative: c.multiDiscount > 0 }
    ];

    var lotki = lotkiDetail(state.shuttles, c.shuttlesTotal);
    if (lotki) {
      rows.push({ label: 'Lotki', value: lotki, negative: c.shuttlesTotal < 0 });
    }

    rows.push({ label: 'Razem', value: formatMoney(c.total), negative: c.total < 0, total: true });
    rows.push({ label: 'Na osobę', value: formatMoney(c.share), negative: false, perPerson: true });

    var dl = document.getElementById('summary');
    dl.innerHTML = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var div = document.createElement('div');
      div.className = 'row' + (r.negative ? ' negative' : '') + (r.total ? ' total' : '') + (r.perPerson ? ' per-person' : '');
      var dt = document.createElement('dt');
      dt.textContent = r.label;
      var dd = document.createElement('dd');
      dd.textContent = r.value;
      div.appendChild(dt);
      div.appendChild(dd);
      dl.appendChild(div);
    }
  }

  var PERSON_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="12" cy="8" r="4"></circle>' +
    '<path d="M12 14c-4.1 0-7.5 2-7.5 4.8V20h15v-1.2C19.5 16 16.1 14 12 14z"></path>' +
    '</svg>';

  function renderTiles() {
    var c = compute(state);
    var tiles = document.getElementById('tiles');
    tiles.innerHTML = '';

    for (var i = 0; i < state.players; i++) {
      var tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('data-index', i);

      var name = document.createElement('span');
      name.className = 'tile-name';
      name.textContent = 'Gracz ' + (i + 1);

      var icon = document.createElement('div');
      icon.className = 'tile-icon';
      icon.innerHTML = PERSON_ICON;

      var input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.className = 'tile-shuttle';
      input.placeholder = SHUTTLE_PLACEHOLDERS[i] || 'Lotki (zł)';
      input.title = 'Wpisz kwotę albo liczbę lotek x cena, np. 3x12 lub 3*12';
      input.setAttribute('aria-label', 'Wartość lotek gracza ' + (i + 1));
      input.setAttribute('data-index', i);
      input.value = state.shuttles[i] || '';
      input.classList.toggle('invalid', !CALC.isValidShuttleValue(input.value));

      var amount = document.createElement('div');
      amount.className = 'tile-amount';
      amount.textContent = formatMoney(c.perPlayer[i]);
      setAmountState(amount, c.perPlayer[i]);

      tile.appendChild(name);
      tile.appendChild(icon);
      tile.appendChild(input);
      tile.appendChild(amount);
      tiles.appendChild(tile);
    }

    var control = document.createElement('div');
    control.className = 'tiles-control';

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'player-btn';
    addBtn.setAttribute('data-player', 'inc');
    addBtn.setAttribute('aria-label', 'Dodaj gracza');
    addBtn.textContent = '+';
    addBtn.disabled = state.players >= PLAYERS_MAX;

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'player-btn';
    delBtn.setAttribute('data-player', 'dec');
    delBtn.setAttribute('aria-label', 'Usuń gracza');
    delBtn.textContent = '−';
    delBtn.disabled = state.players <= PLAYERS_MIN;

    control.appendChild(addBtn);
    control.appendChild(delBtn);
    tiles.appendChild(control);
  }

  function renderAmounts() {
    var c = compute(state);
    var amounts = document.querySelectorAll('#tiles .tile-amount');
    for (var i = 0; i < amounts.length; i++) {
      amounts[i].textContent = formatMoney(c.perPlayer[i]);
      setAmountState(amounts[i], c.perPlayer[i]);
    }
  }

  function setAmountState(el, value) {
    el.classList.toggle('negative', value < 0);
    el.classList.toggle('zero', value === 0);
  }

  function renderAll() {
    renderDayType();
    renderSteppers();
    renderSummary();
    renderTiles();
  }

  function clearAll() {
    state = defaultState();
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    var url = new URL(location.href);
    url.search = '';
    history.replaceState(null, '', url);
    renderAll();
  }

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var seg = e.target.closest('.seg-btn');
    if (seg) {
      state.dayType = seg.getAttribute('data-day');
      stateChanged(true);
      return;
    }

    var playerBtn = e.target.closest('[data-player]');
    if (playerBtn && !playerBtn.disabled) {
      var pDir = playerBtn.getAttribute('data-player') === 'inc' ? 1 : -1;
      var newPlayers = clampInt(state.players + pDir, PLAYERS_MIN, PLAYERS_MAX, state.players);
      if (newPlayers !== state.players) {
        state.players = newPlayers;
        state.shuttles = normalizeShuttles(state.shuttles, state.players);
        stateChanged(true);
      }
      return;
    }

    var step = e.target.closest('.step-btn');
    if (step && !step.disabled) {
      var target = step.getAttribute('data-target');
      var dir = step.getAttribute('data-action') === 'inc' ? 1 : -1;
      if (target === 'time') {
        state.halfHours = clampInt(state.halfHours + dir, TIME_MIN, TIME_MAX, state.halfHours);
      } else if (target === 'multisport') {
        state.multisports = clampInt(state.multisports + dir, MULTI_MIN, MULTI_MAX, state.multisports);
      }
      stateChanged(true);
    }
  });

  document.getElementById('tiles').addEventListener('input', function (e) {
    var input = e.target.closest('.tile-shuttle');
    if (!input) return;
    var i = parseInt(input.getAttribute('data-index'), 10);
    state.shuttles[i] = input.value;
    input.classList.toggle('invalid', !CALC.isValidShuttleValue(input.value));
    save();
    renderSummary();
    renderAmounts();
  });

  document.getElementById('clearBtn').addEventListener('click', clearAll);

  function stateChanged(rebuildTiles) {
    save();
    renderDayType();
    renderSteppers();
    renderSummary();
    if (rebuildTiles) {
      renderTiles();
    } else {
      renderAmounts();
    }
  }

  // ---------- init ----------
  document.getElementById('version').textContent = VERSION;
  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () {});
    });
  }
})();
