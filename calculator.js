(function (global) {
  'use strict';

  var PRICES = { weekday: 44.50, weekend: 32.50 };
  var MULTI_DISCOUNT = 15;

  function round2(value) {
    var result = Math.round(value * 100) / 100;
    return Object.is(result, -0) ? 0 : result;
  }

  function parseNumber(value) {
    var text = String(value == null ? '' : value).trim().replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return NaN;
    var number = Number(text);
    return isFinite(number) ? number : NaN;
  }

  function parseShuttleValue(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return 0;

    var parts = text.split(/[x*]/i);
    if (/[x*]/i.test(text)) {
      if (parts.length === 2 && isValidNumber(parts[0]) && isValidNumber(parts[1])) {
        var count = parseNumber(parts[0]);
        var price = parseNumber(parts[1]);
        return count * price;
      }
      return 0;
    }

    var amount = parseNumber(text);
    return isNaN(amount) ? 0 : amount;
  }

  function isValidNumber(value) {
    return !isNaN(parseNumber(value));
  }

  function isValidShuttleValue(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return true;
    var parts = text.split(/[x*]/i);
    if (/[x*]/i.test(text)) {
      return parts.length === 2 && isValidNumber(parts[0]) && isValidNumber(parts[1]);
    }
    return isValidNumber(text);
  }

  function normalizeShuttles(values, count) {
    var result = new Array(count);
    for (var i = 0; i < count; i++) {
      result[i] = Array.isArray(values) && values[i] != null ? String(values[i]) : '';
    }
    return result;
  }

  function serializeShuttles(values) {
    return values.join(';');
  }

  function deserializeShuttles(serialized, count) {
    if (serialized == null || serialized === '') return normalizeShuttles([], count);
    // Semicolons avoid colliding with comma decimal separators. Commas remain a legacy fallback.
    var separator = serialized.indexOf(';') !== -1 ? ';' : ',';
    return normalizeShuttles(serialized.split(separator), count);
  }

  function compute(state) {
    var courtGross = PRICES[state.dayType] * state.halfHours;
    var multiDiscount = MULTI_DISCOUNT * state.multisports;
    var courtNet = courtGross - multiDiscount;
    var shuttlesTotal = state.shuttles.reduce(function (sum, value) {
      return sum + parseShuttleValue(value);
    }, 0);
    var total = courtNet + shuttlesTotal;
    var share = state.players > 0 ? total / state.players : 0;
    var perPlayer = state.shuttles.map(function (value) {
      return round2(share - parseShuttleValue(value));
    });

    return {
      courtGross: courtGross,
      multiDiscount: multiDiscount,
      courtNet: courtNet,
      shuttlesTotal: shuttlesTotal,
      total: total,
      share: share,
      perPlayer: perPlayer
    };
  }

  global.IleZaDzisCalculator = {
    PRICES: PRICES,
    MULTI_DISCOUNT: MULTI_DISCOUNT,
    round2: round2,
    parseShuttleValue: parseShuttleValue,
    isValidShuttleValue: isValidShuttleValue,
    normalizeShuttles: normalizeShuttles,
    serializeShuttles: serializeShuttles,
    deserializeShuttles: deserializeShuttles,
    compute: compute
  };
}(window));
