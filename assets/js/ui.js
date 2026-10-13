/* DOM wiring. Logic lives in core.js / generators.js. */
(function () {
  'use strict';
  var Core = window.SECore, Data = window.SEData, Gen = window.SEGen;

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.from((el || document).querySelectorAll(sel)); };
  var checkedValues = function (name) { return $$('input[name="' + name + '"]:checked').map(function (i) { return i.value; }); };
  var num = function (id, fallback) { var v = parseFloat($(id).value); return isNaN(v) ? fallback : v; };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  // SAP address field lengths (ADRC / KNA1), used for the over-length warning
  var MAX_LEN = {
    name: 40, attention: 40, addr1: 60, houseNum: 10, supp: 10, addr2: 40, addr3: 40, addr4: 40,
    suburb: 40, city: 40, region: 3, postcode: 10, country: 3, phone: 30, fax: 30, customerNo: 10, email: 241
  };

  /* ---------- Shared helpers ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function copy(text, label) {
    var done = function () { toast((label || 'Copied') + ' ✓'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type || 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function segHtml(segs) {
    return segs.map(function (s) {
      return s.inj
        ? '<mark class="inj" title="' + esc(Core.codePoints(s.t)) + '">' + esc(Core.visible(s.t)) + '</mark>'
        : esc(s.t);
    }).join('');
  }

  function fillSelect(sel, options, value) {
    sel.innerHTML = options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }

  function charSetCheckboxes(container, name, defaults) {
    container.innerHTML = Core.CHAR_SETS.map(function (s) {
      return '<label class="check set"><input type="checkbox" name="' + name + '" value="' + s.id + '"' +
        (defaults.indexOf(s.id) >= 0 ? ' checked' : '') + '> <span class="set-label">' + esc(s.label) +
        '</span><code>' + esc(s.chars) + '</code></label>';
    }).join('');
  }

  function selectedChars(name, customId) {
    var chars = [];
    checkedValues(name).forEach(function (id) {
      var set = Core.CHAR_SETS.find(function (s) { return s.id === id; });
      chars = chars.concat(Core.parseChars(set.chars));
    });
    chars = chars.concat(Core.parseChars($(customId).value));
    return chars.filter(function (c, i) { return chars.indexOf(c) === i; });
  }

  function seedFor(inputId, autoId) {
    var input = $(inputId);
    if ((autoId && $(autoId).checked) || !input.value) input.value = Core.newSeed();
    return Number(input.value);
  }

  /* ---------- Tabs ---------- */
  function showTab(id) {
    $$('.tab').forEach(function (t) {
      var on = t.dataset.tab === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on);
    });
    $$('.panel').forEach(function (p) {
      var on = p.id === 'panel-' + id;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    try { localStorage.setItem('qa-toolkit-tab', id); } catch (e) { /* ignore */ }
  }
  $$('.tab').forEach(function (t) { t.addEventListener('click', function () { showTab(t.dataset.tab); }); });

  /* =========================================================
   * 1. Addresses
   * ========================================================= */
  var countryOpts = Object.keys(Data.COUNTRIES).map(function (k) { return [k, k + ' – ' + Data.COUNTRIES[k].name]; });
  fillSelect($('#af-from'), [['RANDOM', 'Random']].concat(countryOpts), 'US');
  fillSelect($('#af-to'), [['RANDOM', 'Random']].concat(countryOpts), 'MX');

  $('#lane-chips').innerHTML = Data.LANES.map(function (l) {
    return '<button type="button" class="chip" data-from="' + l[0] + '" data-to="' + l[1] + '">' + l[0] + ' → ' + l[1] + '</button>';
  }).join('') + '<button type="button" class="chip chip-accent" data-from="RANDOM" data-to="RANDOM">Random international</button>';
  $('#lane-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    $('#af-from').value = b.dataset.from;
    $('#af-to').value = b.dataset.to;
    if (b.dataset.from === 'RANDOM') $('#af-intl').checked = true;
    generateAddresses();
  });
  $('#af-swap').addEventListener('click', function () {
    var f = $('#af-from').value; $('#af-from').value = $('#af-to').value; $('#af-to').value = f;
  });

  charSetCheckboxes($('#sp-sets'), 'sp-set', ['punct', 'es']);
  $('#sp-fields').innerHTML = Gen.INJECTABLE.map(function (f) {
    var on = ['name', 'addr1', 'city'].indexOf(f) >= 0;
    return '<label class="check"><input type="checkbox" name="sp-field" value="' + f + '"' + (on ? ' checked' : '') + '> ' + Gen.FIELD_LABELS[f] + '</label>';
  }).join('');

  function syncSpecialState() {
    var on = $('#sp-enabled').checked;
    $('#sp-state').textContent = on ? 'on' : 'off';
    $('#sp-state').classList.toggle('on', on);
    $('#sp-per-wrap').hidden = $('#sp-mode').value === 'each';
  }
  $('#sp-enabled').addEventListener('change', syncSpecialState);
  $('#sp-mode').addEventListener('change', syncSpecialState);

  var addrSets = [];
  var addrSeed = null;

  function addressOptions() {
    return {
      count: Math.min(Math.max(parseInt($('#af-count').value, 10) || 1, 1), 50),
      from: $('#af-from').value, to: $('#af-to').value, forceIntl: $('#af-intl').checked,
      partners: checkedValues('af-partner'),
      nameStyle: $('#af-namestyle').value, namePrefix: $('#af-nameprefix').value,
      houseSeparate: $('#af-house').value === 'separate',
      fillSupp: $('#af-supp').checked, fillAddr2: $('#af-addr2').checked, fillAddr34: $('#af-addr34').checked,
      fillSuburb: $('#af-suburb').checked, fillFax: $('#af-fax').checked,
      custPrefix: $('#af-custprefix').value, custStart: $('#af-custstart').value || '001',
      special: {
        enabled: $('#sp-enabled').checked,
        chars: selectedChars('sp-set', '#sp-custom'),
        positions: checkedValues('sp-pos'),
        fields: checkedValues('sp-field'),
        apply: $('#sp-apply').value,
        mode: $('#sp-mode').value,
        perField: Math.min(Math.max(parseInt($('#sp-per').value, 10) || 1, 1), 5)
      }
    };
  }

  function generateAddresses() {
    var opts = addressOptions();
    if (opts.special.enabled && (!opts.special.chars.length || !opts.special.positions.length || !opts.special.fields.length)) {
      toast('Pick at least one character set, position and field');
    }
    addrSeed = seedFor('#af-seed', '#af-autoseed');
    addrSets = Gen.generateAddressSets(addrSeed, opts);
    renderAddresses();
  }

  function fieldBtn(partner, f, extraClass) {
    var segs = partner.fields[f];
    var text = Core.segText(segs);
    var len = Array.from(text).length;
    var over = MAX_LEN[f] && len > MAX_LEN[f];
    var title = Gen.FIELD_LABELS[f] + ': ' + len + ' chars' + (MAX_LEN[f] ? ' (max ' + MAX_LEN[f] + ')' : '') + ' · click to copy';
    return '<button type="button" class="fv ' + (extraClass || '') + (over ? ' over' : '') + (text ? '' : ' empty') +
      '" data-copy="' + esc(text) + '" title="' + esc(title) + '">' + (text ? segHtml(segs) : '&nbsp;') + '</button>';
  }

  function partnerForm(p) {
    var F = function (f, cls) { return fieldBtn(p, f, cls); };
    var row = function (label, html, req) {
      return '<div class="fr"><span class="fl">' + label + (req ? '<i>*</i>' : '') + '</span><div class="fc">' + html + '</div></div>';
    };
    var html = row('Name', F('name')) +
      row('Attention', F('attention')) +
      row('Addr 1', F('addr1'), true) +
      row('House Num', F('houseNum', 'w-s') + '<span class="fl-in">Supp</span>' + F('supp', 'w-s')) +
      row('Addr 2', F('addr2')) + row('Addr 3', F('addr3')) + row('Addr 4', F('addr4')) +
      row('Suburb', F('suburb')) +
      row('City/State', F('city') + F('region', 'w-xs') + '<span class="fl-in">PostCode/Ctry</span>' + F('postcode', 'w-m') + F('country', 'w-xs'), true) +
      row('Phone/Fax', F('phone') + '<span class="fl-in">/</span>' + F('fax'));
    if (p.id !== 'shipFrom') html += row('Customer #', F('customerNo', 'w-m'));
    html += row('Email', F('email'));
    return '<div class="sap-form">' + html + '</div>';
  }

  function renderAddresses() {
    var opts = addressOptions();
    var summary = addrSets.length + ' test set' + (addrSets.length > 1 ? 's' : '') +
      ' · seed <code>' + addrSeed + '</code>' + (opts.special.enabled ? ' · special chars on' : '');
    $('#af-summary').innerHTML = summary;

    $('#af-results').innerHTML = addrSets.map(function (set, si) {
      var defaultTab = set.partners.findIndex(function (p) { return p.id === 'shipTo'; });
      var tabs = set.partners.map(function (p, pi) {
        return '<button type="button" class="sap-tab' + (pi === defaultTab ? ' is-active' : '') + '" data-set="' + si + '" data-p="' + pi + '">' + esc(p.label) + '</button>';
      }).join('');
      var panes = set.partners.map(function (p, pi) {
        return '<div class="sap-pane" data-set="' + si + '" data-p="' + pi + '"' + (pi === defaultTab ? '' : ' hidden') + '>' + partnerForm(p) + '</div>';
      }).join('');
      return '<article class="set card">' +
        '<header class="set-head"><div><span class="set-num">Set ' + set.index + '</span>' +
        '<span class="lane-badge">' + set.from + ' <span>→</span> ' + set.to + '</span>' +
        (set.from === set.to ? '<span class="pill">domestic</span>' : '<span class="pill on">international</span>') + '</div>' +
        '<div class="set-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="set-tsv" data-set="' + si + '">Copy partner</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="set-json" data-set="' + si + '">Copy set JSON</button></div></header>' +
        '<div class="sap-tabs">' + tabs + '</div>' + panes + '</article>';
    }).join('');
  }

  $('#af-results').addEventListener('click', function (e) {
    var tab = e.target.closest('.sap-tab');
    if (tab) {
      var card = tab.closest('.set');
      $$('.sap-tab', card).forEach(function (t) { t.classList.toggle('is-active', t === tab); });
      $$('.sap-pane', card).forEach(function (p) { p.hidden = p.dataset.p !== tab.dataset.p; });
      return;
    }
    var fv = e.target.closest('.fv');
    if (fv) { if (fv.dataset.copy) copy(fv.dataset.copy, 'Copied ' + fv.title.split(':')[0]); return; }
    var act = e.target.closest('[data-action]');
    if (!act) return;
    var set = addrSets[Number(act.dataset.set)];
    if (act.dataset.action === 'set-json') copy(JSON.stringify(setToJson(set), null, 2), 'Set JSON copied');
    if (act.dataset.action === 'set-tsv') {
      var card2 = act.closest('.set');
      var active = $('.sap-tab.is-active', card2);
      var p = set.partners[Number(active.dataset.p)];
      var flat = Gen.flatten(p);
      copy(Core.toTSV(Gen.FIELDS.map(function (f) { return [Gen.FIELD_LABELS[f], flat[f]]; })), p.label + ' copied');
    }
  });

  function setToJson(set) {
    var o = { set: set.index, lane: set.from + '-' + set.to };
    set.partners.forEach(function (p) { o[p.id] = Gen.flatten(p); });
    return o;
  }

  function addressRows() {
    var rows = [['Set', 'Lane', 'Partner'].concat(Gen.FIELDS.map(function (f) { return Gen.FIELD_LABELS[f]; }))];
    addrSets.forEach(function (set) {
      set.partners.forEach(function (p) {
        var flat = Gen.flatten(p);
        rows.push([set.index, set.from + '-' + set.to, p.label].concat(Gen.FIELDS.map(function (f) { return flat[f]; })));
      });
    });
    return rows;
  }

  $('#af-go').addEventListener('click', generateAddresses);

  /* =========================================================
   * 2. Special characters
   * ========================================================= */
  charSetCheckboxes($('#sc-sets'), 'sc-set', ['punct', 'xml', 'es']);
  $('#sc-seed').value = Core.newSeed();
  var scRows = [];

  function renderSpecial() {
    var bases = $('#sc-input').value.split('\n').map(function (s) { return s.replace(/\r$/, ''); }).filter(function (s) { return s.trim(); });
    var chars = selectedChars('sc-set', '#sc-custom');
    var positions = checkedValues('sc-pos');
    var maxLen = num('#sc-maxlen', 0);
    var rng = Core.createRng(Number($('#sc-seed').value) || 1);
    var labels = { start: 'Beginning', middle: 'Middle', end: 'End' };
    scRows = [];
    bases.forEach(function (base) {
      chars.forEach(function (ch) {
        positions.forEach(function (pos) {
          var segs = Core.injectSeg(Core.toSegments(base), ch, pos, rng);
          var val = Core.segText(segs);
          scRows.push({ base: base, ch: ch, cp: Core.codePoints(ch), pos: labels[pos], segs: segs, value: val,
            len: Array.from(val).length, bytes: Core.utf8Bytes(val), xml: Core.xmlEscape(val) });
        });
      });
    });
    var limit = 1500;
    $('#sc-summary').innerHTML = scRows.length + ' variants (' + bases.length + ' value' + (bases.length === 1 ? '' : 's') + ' × ' +
      chars.length + ' chars × ' + positions.length + ' positions)' + (scRows.length > limit ? ' · showing first ' + limit + ', export has all' : '');
    $('#sc-table tbody').innerHTML = scRows.slice(0, limit).map(function (r, i) {
      var over = maxLen && r.len > maxLen;
      return '<tr><td class="muted">' + (i + 1) + '</td><td class="nw">' + esc(r.base) + '</td><td class="ch">' + esc(Core.visible(r.ch)) + '</td>' +
        '<td><code>' + r.cp + '</code></td><td>' + r.pos + '</td>' +
        '<td class="nw"><button type="button" class="fv inline" data-copy="' + esc(r.value) + '" title="Click to copy">' + segHtml(r.segs) + '</button></td>' +
        '<td class="num' + (over ? ' warn' : '') + '">' + r.len + '</td><td class="num' + (r.bytes !== r.len ? ' note' : '') + '">' + r.bytes + '</td>' +
        '<td><code class="xml">' + esc(r.xml) + '</code></td></tr>';
    }).join('') || '<tr><td colspan="9" class="empty-row">Add a value and pick at least one character set and position.</td></tr>';
  }

  ['#sc-input', '#sc-custom', '#sc-maxlen', '#sc-seed'].forEach(function (id) { $(id).addEventListener('input', renderSpecial); });
  $('#panel-chars').addEventListener('change', renderSpecial);
  $('#sc-table').addEventListener('click', function (e) {
    var fv = e.target.closest('.fv'); if (fv) copy(fv.dataset.copy, 'Value copied');
  });

  function specialRows() {
    return [['Base', 'Char', 'Code point', 'Position', 'Result', 'Chars', 'UTF-8 bytes', 'XML escaped']].concat(scRows.map(function (r) {
      return [r.base, r.ch, r.cp, r.pos, r.value, r.len, r.bytes, r.xml];
    }));
  }

  /* =========================================================
   * 3. Handling units
   * ========================================================= */
  var wUoms = Object.keys(Core.WEIGHT).map(function (k) { return [k, k]; });
  var dUoms = Object.keys(Core.LENGTH).map(function (k) { return [k, k]; });
  fillSelect($('#hu-wuom'), wUoms, 'KG');
  fillSelect($('#hu-duom'), dUoms, 'CM');

  function applyDefaultRanges() {
    var w = Gen.DEFAULT_RANGES.weight[$('#hu-wuom').value];
    var d = Gen.DEFAULT_RANGES.length[$('#hu-duom').value];
    $('#hu-wmin').value = w[0]; $('#hu-wmax').value = w[1];
    $('#hu-dmin').value = d[0]; $('#hu-dmax').value = d[1];
  }
  $('#hu-wuom').addEventListener('change', applyDefaultRanges);
  $('#hu-duom').addEventListener('change', applyDefaultRanges);
  applyDefaultRanges();

  var hus = [];
  var huSeed = null;

  function generateHUs() {
    var wMin = num('#hu-wmin', 1), wMax = num('#hu-wmax', 10);
    var dMin = num('#hu-dmin', 1), dMax = num('#hu-dmax', 10);
    if (wMin > wMax) { var t = wMin; wMin = wMax; wMax = t; }
    if (dMin > dMax) { var t2 = dMin; dMin = dMax; dMax = t2; }
    huSeed = seedFor('#hu-seed', '#hu-autoseed');
    hus = Gen.generateHUs(huSeed, {
      count: Math.min(Math.max(parseInt($('#hu-count').value, 10) || 1, 1), 200),
      wUom: $('#hu-wuom').value, dUom: $('#hu-duom').value, mixed: $('#hu-mixed').checked,
      wMin: wMin, wMax: wMax, wDp: Math.min(Math.max(parseInt($('#hu-wdp').value, 10) || 0, 0), 4),
      dMin: dMin, dMax: dMax, dDp: Math.min(Math.max(parseInt($('#hu-ddp').value, 10) || 0, 0), 4),
      identical: $('#hu-identical').checked, packaging: $('#hu-pkg').value,
      idPrefix: $('#hu-idprefix').value, idStart: $('#hu-idstart').value || '1'
    });
    renderHUs();
  }

  function dpOf(v) { var s = String(v); var i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }

  function renderHUs() {
    var wDp = parseInt($('#hu-wdp').value, 10) || 0;
    var dDp = parseInt($('#hu-ddp').value, 10) || 0;
    $('#hu-table tbody').innerHTML = hus.map(function (h) {
      var vol = Core.roundTo(h.l * h.w * h.h, Math.min(dDp * 3, 6), 'half-up');
      return '<tr><td><code>' + esc(h.id) + '</code></td><td>' + h.pkg + '</td><td class="num">' + Core.fmt(h.weight, wDp) + '</td><td>' + h.wUom +
        '</td><td class="num">' + Core.fmt(h.l, dDp) + '</td><td class="num">' + Core.fmt(h.w, dDp) + '</td><td class="num">' + Core.fmt(h.h, dDp) +
        '</td><td>' + h.dUom + '</td><td class="num muted">' + vol + ' ' + h.dUom.toLowerCase() + '³</td></tr>';
    }).join('');
    var totals = {};
    hus.forEach(function (h) { totals[h.wUom] = (totals[h.wUom] || 0) + h.weight; });
    $('#hu-table tfoot').innerHTML = '<tr><td colspan="2">Total</td><td class="num" colspan="2">' + Object.keys(totals).map(function (u) {
      return Core.fmt(Core.roundTo(totals[u], wDp), wDp) + ' ' + u;
    }).join(' + ') + '</td><td colspan="5"></td></tr>';
    $('#hu-summary').innerHTML = hus.length + ' HU' + (hus.length === 1 ? '' : 's') + ' · seed <code>' + huSeed + '</code>';
  }

  function huRows() {
    return [['HU', 'Packaging', 'Weight', 'Weight UoM', 'Length', 'Width', 'Height', 'Dim UoM']].concat(hus.map(function (h) {
      return [h.id, h.pkg, h.weight, h.wUom, h.l, h.w, h.h, h.dUom];
    }));
  }

  $('#hu-go').addEventListener('click', generateHUs);

  /* =========================================================
   * 4. Conversion
   * ========================================================= */
  fillSelect($('#cv-tow'), wUoms, 'LB');
  fillSelect($('#cv-tod'), dUoms, 'IN');

  function syncDivisor() {
    var key = $('#cv-tod').value + '/' + $('#cv-tow').value;
    if (Core.DIM_DIVISORS[key] !== undefined) $('#cv-div').value = Core.DIM_DIVISORS[key];
  }
  $('#cv-tow').addEventListener('change', syncDivisor);
  $('#cv-tod').addEventListener('change', syncDivisor);

  function uomSelect(cls, list, value) {
    return '<select class="' + cls + '">' + list.map(function (u) {
      return '<option' + (u[0] === value ? ' selected' : '') + '>' + u[0] + '</option>';
    }).join('') + '</select>';
  }

  function addInputRow(h) {
    h = h || { id: 'HU' + String($$('#cv-input tbody tr').length + 1).padStart(4, '0'), weight: '', wUom: 'KG', l: '', w: '', h: '', dUom: 'CM' };
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><input class="c-id" value="' + esc(h.id) + '"></td>' +
      '<td><input class="c-w num" type="number" step="any" value="' + esc(h.weight) + '"></td>' +
      '<td>' + uomSelect('c-wu', wUoms, h.wUom) + '</td>' +
      '<td><input class="c-l num" type="number" step="any" value="' + esc(h.l) + '"></td>' +
      '<td><input class="c-wd num" type="number" step="any" value="' + esc(h.w) + '"></td>' +
      '<td><input class="c-h num" type="number" step="any" value="' + esc(h.h) + '"></td>' +
      '<td>' + uomSelect('c-du', dUoms, h.dUom) + '</td>' +
      '<td><button type="button" class="icon-btn sm" data-action="cv-del" aria-label="Remove row">×</button></td>';
    $('#cv-input tbody').appendChild(tr);
  }

  function setInputRows(list) {
    $('#cv-input tbody').innerHTML = '';
    list.forEach(addInputRow);
    renderConversion();
  }

  function readInputRows() {
    return $$('#cv-input tbody tr').map(function (tr) {
      return {
        id: $('.c-id', tr).value,
        weight: parseFloat($('.c-w', tr).value), wUom: $('.c-wu', tr).value,
        l: parseFloat($('.c-l', tr).value), w: parseFloat($('.c-wd', tr).value), h: parseFloat($('.c-h', tr).value),
        dUom: $('.c-du', tr).value
      };
    }).filter(function (h) { return [h.weight, h.l, h.w, h.h].every(function (v) { return !isNaN(v); }); });
  }

  var conv = null;

  function convOpts() {
    return {
      toW: $('#cv-tow').value, toD: $('#cv-tod').value,
      wDp: Math.min(Math.max(parseInt($('#cv-wdp').value, 10) || 0, 0), 6),
      dDp: Math.min(Math.max(parseInt($('#cv-ddp').value, 10) || 0, 0), 6),
      mode: $('#cv-mode').value,
      dimWeight: $('#cv-dim').checked, divisor: num('#cv-div', 0), roundDimsUp: $('#cv-dimup').checked
    };
  }

  function renderFactors() {
    var o = convOpts();
    var lines = [];
    Object.keys(Core.WEIGHT).forEach(function (u) {
      if (u !== o.toW) lines.push('1 ' + u + ' = ' + Core.factorText(Core.factor(Core.WEIGHT, u, o.toW)) + ' ' + o.toW);
    });
    Object.keys(Core.LENGTH).forEach(function (u) {
      if (u !== o.toD) lines.push('1 ' + u + ' = ' + Core.factorText(Core.factor(Core.LENGTH, u, o.toD)) + ' ' + o.toD);
    });
    $('#cv-factors').innerHTML = '<h3>Factors used</h3><ul>' + lines.map(function (l) { return '<li><code>' + l + '</code></li>'; }).join('') +
      '</ul><p class="hint">Based on the exact definitions 1 lb = 0.45359237 kg and 1 in = 2.54 cm.</p>';
  }

  function renderConversion() {
    var o = convOpts();
    var src = readInputRows();
    $('#cv-count').textContent = '(' + src.length + ')';
    renderFactors();
    if (!src.length) {
      conv = null;
      $('#cv-table thead').innerHTML = '';
      $('#cv-table tbody').innerHTML = '<tr><td class="empty-row">Add HUs above, paste from Excel, or send them from the Handling Units tab.</td></tr>';
      $('#cv-table tfoot').innerHTML = '';
      $('#cv-totals').innerHTML = '';
      $('#cv-summary').textContent = '';
      return;
    }
    conv = Core.convertHUs(src, o);
    var showF = $('#cv-formula').checked;
    var head = '<tr><th>HU</th><th class="num">Weight (' + o.toW + ')</th>' +
      '<th class="num">Length (' + o.toD + ')</th><th class="num">Width (' + o.toD + ')</th><th class="num">Height (' + o.toD + ')</th>' +
      (o.dimWeight ? '<th class="num">Dim wt (' + o.toW + ')</th><th class="num">Billable (' + o.toW + ')</th>' : '') + '</tr>';
    $('#cv-table thead').innerHTML = head;

    var cell = function (val, dp, formula) {
      return '<td class="num"><strong>' + Core.fmt(val, dp) + '</strong>' + (showF && formula ? '<small class="calc">' + formula + '</small>' : '') + '</td>';
    };
    $('#cv-table tbody').innerHTML = conv.rows.map(function (r) {
      var s = r.src;
      var wF = s.wUom === o.toW ? 'no conversion' :
        s.weight + ' ' + s.wUom + ' × ' + Core.factorText(r.wFactor) + ' = ' + Number(r.wRaw.toPrecision(10));
      var html = '<tr><td><code>' + esc(r.id) + '</code></td>' + cell(r.weight, o.wDp, wF);
      r.dims.forEach(function (d) {
        var f = s.dUom === o.toD ? 'no conversion' :
          d.src + ' ' + s.dUom + ' × ' + Core.factorText(r.dFactor) + ' = ' + Number(d.raw.toPrecision(10));
        html += cell(d.value, o.dDp, f);
      });
      if (o.dimWeight) {
        var dd = r.dimCalcDims.map(function (v) { return Number(v.toFixed(o.dDp)); });
        html += cell(r.dimWeight, o.wDp, dd.join(' × ') + ' / ' + o.divisor + ' = ' + Number((r.dimVolume / o.divisor).toPrecision(10)));
        html += cell(r.billable, o.wDp, r.billable === r.dimWeight && r.dimWeight > r.weight ? 'dim wt' : 'actual wt');
      }
      return html + '</tr>';
    }).join('');

    var t = conv.totals;
    $('#cv-table tfoot').innerHTML = '<tr><td>Total</td><td class="num"><strong>' + Core.fmt(t.sumOfRounded, o.wDp) + '</strong></td><td colspan="3"></td>' +
      (o.dimWeight ? '<td></td><td class="num"><strong>' + Core.fmt(t.billable, o.wDp) + '</strong></td>' : '') + '</tr>';

    var srcTotal = Object.keys(t.source).map(function (u) { return Number(t.source[u].toPrecision(10)) + ' ' + u; }).join(' + ');
    var mismatch = t.delta !== 0;
    $('#cv-totals').innerHTML = '<div class="totals-grid">' +
      '<div class="stat"><span>Source total</span><strong>' + srcTotal + '</strong></div>' +
      '<div class="stat"><span>Sum of converted HUs</span><strong>' + Core.fmt(t.sumOfRounded, o.wDp) + ' ' + o.toW + '</strong><small>each HU rounded, then added</small></div>' +
      '<div class="stat"><span>Converted total</span><strong>' + Core.fmt(t.roundedOfSum, o.wDp) + ' ' + o.toW + '</strong><small>added unrounded, then rounded</small></div>' +
      '<div class="stat ' + (mismatch ? 'stat-warn' : 'stat-ok') + '"><span>Difference</span><strong>' + (mismatch ? t.delta + ' ' + o.toW : 'none') +
      '</strong><small>' + (mismatch ? 'Rounding drift: check which total the web service sends' : 'Both totaling methods agree') + '</small></div></div>';
    $('#cv-summary').innerHTML = conv.rows.length + ' HU' + (conv.rows.length === 1 ? '' : 's') + ' → ' + o.toW + '/' + o.toD + ', ' + $('#cv-mode').selectedOptions[0].text.toLowerCase() + ' rounding';
  }

  function convRows() {
    if (!conv) return [];
    var o = convOpts();
    var head = ['HU', 'Source weight', 'Source weight UoM', 'Source L', 'Source W', 'Source H', 'Source dim UoM',
      'Weight (' + o.toW + ')', 'Length (' + o.toD + ')', 'Width (' + o.toD + ')', 'Height (' + o.toD + ')', 'Weight factor', 'Dim factor'];
    if (o.dimWeight) head.push('Dim weight (' + o.toW + ')', 'Billable (' + o.toW + ')');
    return [head].concat(conv.rows.map(function (r) {
      var s = r.src;
      var row = [r.id, s.weight, s.wUom, s.l, s.w, s.h, s.dUom, Core.fmt(r.weight, o.wDp)]
        .concat(r.dims.map(function (d) { return Core.fmt(d.value, o.dDp); }))
        .concat([Core.factorText(r.wFactor), Core.factorText(r.dFactor)]);
      if (o.dimWeight) row.push(Core.fmt(r.dimWeight, o.wDp), Core.fmt(r.billable, o.wDp));
      return row;
    }));
  }

  $('#panel-conv').addEventListener('input', function (e) {
    if (e.target.id !== 'cv-paste') renderConversion();
  });
  $('#panel-conv').addEventListener('change', function (e) {
    if (e.target.id !== 'cv-paste') renderConversion();
  });

  function parsePasted(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var c = line.split(/\t|,|;/).map(function (s) { return s.trim(); });
      if (c.length >= 7) c = c.slice(0, 7); else if (c.length === 6) c = ['HU' + String(out.length + 1).padStart(4, '0')].concat(c); else return;
      var w = parseFloat(c[1]);
      if (isNaN(w)) return; // header row
      var wu = c[2].toUpperCase(), du = c[6].toUpperCase();
      if (!(wu in Core.WEIGHT) || !(du in Core.LENGTH)) return;
      out.push({ id: c[0], weight: w, wUom: wu, l: parseFloat(c[3]), w: parseFloat(c[4]), h: parseFloat(c[5]), dUom: du });
    });
    return out;
  }

  /* ---------- Toolbar actions ---------- */
  var ACTIONS = {
    'af-tsv': function () { if (!addrSets.length) return toast('Generate addresses first'); copy(Core.toTSV(addressRows()), 'Copied ' + (addressRows().length - 1) + ' rows'); },
    'af-json': function () { if (!addrSets.length) return toast('Generate addresses first'); copy(JSON.stringify({ seed: addrSeed, sets: addrSets.map(setToJson) }, null, 2), 'JSON copied'); },
    'af-csv': function () { if (!addrSets.length) return toast('Generate addresses first'); download('addresses-seed' + addrSeed + '-' + stamp() + '.csv', Core.toCSV(addressRows())); },
    'sc-values': function () { copy(scRows.map(function (r) { return r.value; }).join('\n'), 'Copied ' + scRows.length + ' values'); },
    'sc-tsv': function () { copy(Core.toTSV(specialRows()), 'Copied ' + scRows.length + ' rows'); },
    'sc-csv': function () { download('special-chars-' + stamp() + '.csv', Core.toCSV(specialRows())); },
    'hu-tsv': function () { if (!hus.length) return toast('Generate HUs first'); copy(Core.toTSV(huRows()), 'Copied ' + hus.length + ' HUs'); },
    'hu-json': function () { if (!hus.length) return toast('Generate HUs first'); copy(JSON.stringify({ seed: huSeed, handlingUnits: hus }, null, 2), 'JSON copied'); },
    'hu-csv': function () { if (!hus.length) return toast('Generate HUs first'); download('handling-units-seed' + huSeed + '-' + stamp() + '.csv', Core.toCSV(huRows())); },
    'hu-send': function () {
      if (!hus.length) return toast('Generate HUs first');
      setInputRows(hus.map(function (h) { return Object.assign({}, h); }));
      // Default the target to the "other" system so the conversion is meaningful
      var first = hus[0];
      if (first.wUom === 'LB' || first.wUom === 'OZ') { $('#cv-tow').value = 'KG'; $('#cv-tod').value = 'CM'; }
      else { $('#cv-tow').value = 'LB'; $('#cv-tod').value = 'IN'; }
      syncDivisor(); renderConversion();
      showTab('conv');
      $('#tool').scrollIntoView({ behavior: 'smooth' });
    },
    'cv-add': function () { addInputRow(); renderConversion(); var last = $$('#cv-input tbody tr').pop(); $('.c-w', last).focus(); },
    'cv-clear': function () { setInputRows([]); },
    'cv-sample': function () {
      setInputRows([
        { id: 'HU0001', weight: 12.5, wUom: 'KG', l: 40, w: 30, h: 20, dUom: 'CM' },
        { id: 'HU0002', weight: 3.333, wUom: 'KG', l: 25.4, w: 25.4, h: 12.7, dUom: 'CM' },
        { id: 'HU0003', weight: 22.68, wUom: 'KG', l: 60, w: 40, h: 35.5, dUom: 'CM' }
      ]);
    },
    'cv-paste-toggle': function () { var b = $('#cv-paste-box'); b.hidden = !b.hidden; if (!b.hidden) $('#cv-paste').focus(); },
    'cv-import': function () {
      var rows = parsePasted($('#cv-paste').value);
      if (!rows.length) return toast('No valid rows found');
      setInputRows(rows);
      $('#cv-paste').value = ''; $('#cv-paste-box').hidden = true;
      toast('Imported ' + rows.length + ' rows');
    },
    'cv-del': function (btn) { btn.closest('tr').remove(); renderConversion(); },
    'cv-tsv': function () { if (!conv) return toast('Nothing to copy'); copy(Core.toTSV(convRows()), 'Copied ' + conv.rows.length + ' rows'); },
    'cv-json': function () {
      if (!conv) return toast('Nothing to copy');
      var o = convOpts();
      copy(JSON.stringify({
        target: { weightUom: o.toW, dimUom: o.toD, rounding: o.mode },
        handlingUnits: conv.rows.map(function (r) {
          var x = { id: r.id, weight: r.weight, length: r.dims[0].value, width: r.dims[1].value, height: r.dims[2].value };
          if (o.dimWeight) { x.dimWeight = r.dimWeight; x.billableWeight = r.billable; }
          return x;
        }),
        totalWeight: conv.totals.sumOfRounded
      }, null, 2), 'JSON copied');
    },
    'cv-csv': function () { if (!conv) return toast('Nothing to export'); download('uom-conversion-' + stamp() + '.csv', Core.toCSV(convRows())); }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (b && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action](b);
  });

  /* ---------- Init ---------- */
  syncSpecialState();
  generateAddresses();
  renderSpecial();
  generateHUs();
  ACTIONS['cv-sample']();
  try {
    var saved = localStorage.getItem('qa-toolkit-tab');
    if (saved && $('#panel-' + saved)) showTab(saved);
  } catch (e) { /* ignore */ }
})();
