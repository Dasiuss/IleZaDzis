(function () {
  'use strict';

  var calc = window.IleZaDzisCalculator;
  var results = document.getElementById('results');
  var status = document.getElementById('status');
  var passed = 0;
  var failed = 0;
  var skipped = 0;

  function fail(message) { throw new Error(message); }

  function equal(actual, expected, message) {
    if (actual !== expected) fail(message + ' | otrzymano: ' + actual + ', oczekiwano: ' + expected);
  }

  function near(actual, expected, message) {
    if (Math.abs(actual - expected) > 0.0000001) fail(message + ' | otrzymano: ' + actual + ', oczekiwano: ' + expected);
  }

  function arrayEqual(actual, expected, message) {
    equal(JSON.stringify(actual), JSON.stringify(expected), message);
  }

  function test(name, fn) {
    try {
      fn();
      passed++;
      var passItem = document.createElement('li');
      passItem.className = 'pass';
      passItem.textContent = 'PASS: ' + name;
      results.appendChild(passItem);
    } catch (error) {
      failed++;
      var failItem = document.createElement('li');
      failItem.className = 'fail';
      failItem.textContent = 'FAIL: ' + name + ' - ' + error.message;
      results.appendChild(failItem);
    }
  }

  function state(overrides) {
    var value = {
      dayType: 'weekday',
      halfHours: 4,
      multisports: 4,
      players: 4,
      shuttles: ['', '', '', '']
    };
    for (var key in overrides) value[key] = overrides[key];
    return value;
  }

  // Parser: puste wartości, liczby, x/*, spacje, przecinki i błędne dane.
  test('puste lotki są równe zero', function () {
    equal(calc.parseShuttleValue(''), 0, 'pusty string');
    equal(calc.parseShuttleValue('   '), 0, 'same spacje');
    equal(calc.parseShuttleValue(null), 0, 'null');
    equal(calc.parseShuttleValue(undefined), 0, 'undefined');
  });

  test('pojedyncza kwota lotek', function () {
    equal(calc.parseShuttleValue('24'), 24, 'liczba całkowita');
    equal(calc.parseShuttleValue('24.50'), 24.5, 'kropka dziesiętna');
    equal(calc.parseShuttleValue('24,50'), 24.5, 'przecinek dziesiętny');
    equal(calc.parseShuttleValue(' 24,50 '), 24.5, 'spacje wokół kwoty');
  });

  test('mnożenie przez x', function () {
    equal(calc.parseShuttleValue('3x12'), 36, 'bez spacji');
    equal(calc.parseShuttleValue('3 x 12'), 36, 'ze spacjami');
    equal(calc.parseShuttleValue('3X12'), 36, 'wielkie X');
    equal(calc.parseShuttleValue('2,5 x 12,40'), 31, 'przecinki w obu liczbach');
  });

  test('mnożenie przez gwiazdkę', function () {
    equal(calc.parseShuttleValue('3*12'), 36, 'bez spacji');
    equal(calc.parseShuttleValue('3 * 12'), 36, 'ze spacjami');
    equal(calc.parseShuttleValue('2,5 * 12,40'), 31, 'przecinki w obu liczbach');
  });

  test('URL zachowuje przecinki dziesiętne w lotkach', function () {
    var original = ['2,5 x 12,40', '', '3*8', ''];
    var serialized = calc.serializeShuttles(original);
    arrayEqual(calc.deserializeShuttles(serialized, 4), original, 'round-trip z separatorem średnikowym');
    equal(serialized, '2,5 x 12,40;;3*8;', 'średnik nie koliduje z przecinkiem dziesiętnym');
    arrayEqual(calc.deserializeShuttles('24,3x12', 2), ['24', '3x12'], 'stary format URL');
  });

  test('walidacja wpisów lotek', function () {
    if (!calc.isValidShuttleValue('')) fail('puste pole powinno być poprawne');
    if (!calc.isValidShuttleValue('3x12')) fail('3x12 powinno być poprawne');
    if (!calc.isValidShuttleValue('3 * 12')) fail('3 * 12 powinno być poprawne');
    if (calc.isValidShuttleValue('3x')) fail('3x powinno być niepoprawne');
    if (calc.isValidShuttleValue('12 abc')) fail('tekst po kwocie powinien być niepoprawny');
  });

  test('niepoprawny zapis lotek nie tworzy częściowej kwoty', function () {
    equal(calc.parseShuttleValue('3x'), 0, 'brak ceny');
    equal(calc.parseShuttleValue('x12'), 0, 'brak liczby');
    equal(calc.parseShuttleValue('3x12x2'), 0, 'więcej niż jeden operator');
    equal(calc.parseShuttleValue('3*12abc'), 0, 'tekst po cenie');
    equal(calc.parseShuttleValue('abc'), 0, 'tekst bez liczby');
    equal(calc.parseShuttleValue('Infinity'), 0, 'nieskończoność');
  });

  test('normalizacja lotek dopasowuje długość tablicy', function () {
    arrayEqual(calc.normalizeShuttles(['24', '3x12'], 4), ['24', '3x12', '', ''], 'uzupełnienie');
    arrayEqual(calc.normalizeShuttles(['24', '3x12', '8', '9', '10'], 2), ['24', '3x12'], 'obcięcie');
    arrayEqual(calc.normalizeShuttles([24, 0], 2), ['24', '0'], 'stare wartości liczbowe');
    arrayEqual(calc.normalizeShuttles(null, 3), ['', '', ''], 'brak tablicy');
  });

  test('cena kortu w tygodniu', function () {
    var result = calc.compute(state({ dayType: 'weekday', halfHours: 4, multisports: 0 }));
    equal(result.courtGross, 178, '44,50 × 4');
    equal(result.multiDiscount, 0, 'brak rabatu');
    equal(result.courtNet, 178, 'cena netto');
  });

  test('cena kortu w weekend', function () {
    var result = calc.compute(state({ dayType: 'weekend', halfHours: 3, multisports: 0 }));
    equal(result.courtGross, 97.5, '32,50 × 3');
  });

  test('minimalny i maksymalny czas', function () {
    equal(calc.compute(state({ halfHours: 1, multisports: 0 })).courtGross, 44.5, '0,5h');
    equal(calc.compute(state({ halfHours: 16, multisports: 0 })).courtGross, 712, '8h');
  });

  test('minimalna i maksymalna liczba multisportów', function () {
    equal(calc.compute(state({ multisports: 0 })).multiDiscount, 0, '0 multisportów');
    equal(calc.compute(state({ multisports: 8 })).multiDiscount, 120, '8 multisportów');
    equal(calc.compute(state({ halfHours: 1, multisports: 8 })).courtNet, -75.5, 'ujemny kort netto');
  });

  test('przykład z opisu', function () {
    var result = calc.compute(state({ dayType: 'weekend', halfHours: 3, multisports: 6, players: 4 }));
    equal(result.total, 7.5, 'kort po multisportach');
    near(result.share, 1.875, 'udział przed zaokrągleniem');
    arrayEqual(result.perPlayer, [1.88, 1.88, 1.88, 1.88], 'kwoty graczy');
  });

  test('lotki są dodawane do sumy i odejmowane danemu graczowi', function () {
    var result = calc.compute(state({ halfHours: 4, multisports: 0, players: 4, shuttles: ['24', '', '3x12', '2*8'] }));
    equal(result.shuttlesTotal, 76, '24 + 36 + 16');
    equal(result.total, 254, '178 + 76');
    equal(result.share, 63.5, '254 / 4');
    arrayEqual(result.perPlayer, [39.5, 63.5, 27.5, 47.5], 'netto per gracz');
  });

  test('jedna osoba', function () {
    var result = calc.compute(state({ players: 1, halfHours: 1, multisports: 0, shuttles: ['3x12'] }));
    equal(result.total, 80.5, '44,50 + 36');
    arrayEqual(result.perPlayer, [44.5], 'udział minus własne lotki');
  });

  test('osiem osób tworzy osiem kwot', function () {
    var result = calc.compute(state({ players: 8, shuttles: ['', '', '', '', '', '', '', ''] }));
    equal(result.perPlayer.length, 8, 'liczba wyników');
    equal(result.perPlayer[7], 14.75, 'ósmy gracz');
  });

  test('zaokrąglenie kwot do groszy i normalizacja minus zero', function () {
    equal(calc.round2(1.875), 1.88, 'w górę');
    equal(calc.round2(1.874), 1.87, 'w dół');
    equal(calc.round2(-0.004), 0, 'brak -0');
  });

  test('duże wartości i dziesiętne lotki nie powodują NaN', function () {
    var result = calc.compute(state({ players: 8, shuttles: ['999999.99', '0,01', '3 x 12,50', '', '', '', '', ''] }));
    result.perPlayer.forEach(function (value) { if (isNaN(value)) fail('NaN w kwocie gracza'); });
    if (isNaN(result.total) || isNaN(result.share)) fail('NaN w podsumowaniu');
  });

  function runIntegrationTest() {
    return new Promise(function (resolve) {
      var frame = document.getElementById('app-frame');
      try { localStorage.removeItem('ilezadzis-state'); } catch (e) {}
      function inspect(attempt) {
        var doc = frame.contentDocument;
        if (!doc) {
          if (attempt < 20) {
            setTimeout(function () { inspect(attempt + 1); }, 50);
            return;
          }
          skipped++;
          var skipItem = document.createElement('li');
          skipItem.className = 'pass';
          skipItem.textContent = 'SKIP: integracja strony - przeglądarka blokuje dostęp do iframe w trybie file://';
          results.appendChild(skipItem);
          resolve();
          return;
        }

        try {
          var tiles = doc.querySelectorAll('.tile');
          equal(tiles.length, 5, 'pięciu graczy po odświeżeniu');
          for (var i = 0; i < tiles.length; i++) {
            if (tiles[i].querySelector('.tile-amount').textContent.indexOf('NaN') !== -1) {
              fail('NaN na kafelku ' + (i + 1));
            }
          }
          var shuttleInput = doc.querySelectorAll('.tile-shuttle')[2];
          shuttleInput.value = '3x12';
          shuttleInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (doc.querySelectorAll('.tile-amount')[2].textContent.indexOf('NaN') !== -1) {
            fail('NaN po wpisaniu 3x12');
          }
          if (frame.contentWindow.location.search.indexOf('3x12') === -1) {
            fail('wyrażenie lotek nie zostało zapisane w URL');
          }
          if (localStorage.getItem('ilezadzis-state').indexOf('3x12') === -1) {
            fail('wyrażenie lotek nie zostało zapisane w localStorage');
          }
          equal(doc.querySelector('.tile-shuttle').inputMode, 'text', 'pełna klawiatura dla lotek');

          doc.querySelector('.tile-name').click();
          var nameInput = doc.querySelector('.tile-name-input');
          nameInput.value = 'Ania';
          nameInput.blur();
          equal(doc.querySelector('.tile-name').textContent, 'Ania', 'zmiana nazwy gracza');
          equal(new URL(frame.contentWindow.location.href).searchParams.get('n').indexOf('Ania') !== -1, true, 'nazwa gracza w URL');

          shuttleInput = doc.querySelectorAll('.tile-shuttle')[2];
          shuttleInput.value = '3x';
          shuttleInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (!shuttleInput.classList.contains('invalid')) fail('błędny wpis nie został oznaczony');
          shuttleInput.value = '3 x 12';
          shuttleInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (shuttleInput.classList.contains('invalid')) fail('poprawny wpis został oznaczony jako błędny');

          doc.querySelector('[data-player="inc"]').click();
          equal(doc.querySelectorAll('.tile').length, 6, 'dodanie szóstego gracza');
          doc.querySelector('[data-player="dec"]').click();
          equal(doc.querySelectorAll('.tile').length, 5, 'usunięcie szóstego gracza');

          doc.getElementById('clearBtn').click();
          equal(frame.contentWindow.location.search, '', 'wyczyszczenie URL');
          equal(doc.querySelectorAll('.tile').length, 4, 'powrót do 4 graczy');
          if (localStorage.getItem('ilezadzis-state') !== null) fail('localStorage nie został wyczyszczony');

          var localFrame = document.createElement('iframe');
          localFrame.style.display = 'none';
          document.body.appendChild(localFrame);
          localStorage.setItem('ilezadzis-state', JSON.stringify({
            dayType: 'weekend',
            halfHours: 3,
            multisports: 2,
            players: 5,
            shuttles: ['2,5 x 12,40', '', '', '', '']
          }));
          localFrame.onload = function () {
            try {
              var localDoc = localFrame.contentDocument;
              equal(localDoc.querySelectorAll('.tile').length, 5, 'pięciu graczy z localStorage');
              var localUrl = new URL(localFrame.contentWindow.location.href);
              equal(localUrl.searchParams.get('l'), '2,5 x 12,40;;;;', 'lotki z localStorage w URL');
              equal(localUrl.searchParams.get('p'), '5', 'liczba graczy z localStorage w URL');
              localDoc.getElementById('clearBtn').click();
              localFrame.remove();
              resolve();
            } catch (error) {
              failed++;
              var localFailItem = document.createElement('li');
              localFailItem.className = 'fail';
              localFailItem.textContent = 'FAIL: localStorage -> URL - ' + error.message;
              results.appendChild(localFailItem);
              resolve();
            }
          };
          localFrame.src = '../index.html';
        } catch (error) {
          failed++;
          var failItem = document.createElement('li');
          failItem.className = 'fail';
          failItem.textContent = 'FAIL: integracja strony - ' + error.message;
          results.appendChild(failItem);
          resolve();
        }
      }
      frame.onload = function () { inspect(0); };
      frame.src = '../index.html?d=weekend&t=1&m=0&p=5';
    });
  }

  function finish() {
    status.textContent = 'Wynik: ' + passed + ' zaliczonych, ' + failed + ' niezaliczonych' + (skipped ? ', ' + skipped + ' pominięty.' : '.');
    status.className = failed ? 'fail' : 'pass';
  }

  runIntegrationTest().then(finish);
}());
