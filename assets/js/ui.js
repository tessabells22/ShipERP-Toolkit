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
   * Shared address view (used by the Addresses and Special Characters tabs)
   * ========================================================= */
  var countryOpts = Object.keys(Data.COUNTRIES).map(function (k) { return [k, k + ' – ' + Data.COUNTRIES[k].name]; });

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

  function setToJson(set) {
    var o = { set: set.index, lane: set.from + '-' + set.to };
    set.partners.forEach(function (p) { o[p.id] = Gen.flatten(p); });
    return o;
  }

  function injectedChars(p) {
    var out = [];
    Gen.FIELDS.forEach(function (f) {
      p.fields[f].forEach(function (seg) { if (seg.inj) out.push(Gen.FIELD_LABELS[f] + ': ' + seg.t); });
    });
    return out.join(' | ');
  }

  // One instance per tab: owns its sets, seed and result container.
  function AddressView(container, defaultPartner) {
    var view = { sets: [], seed: null, withInjected: false };

    view.render = function () {
      container.innerHTML = view.sets.map(function (set, si) {
        var defaultTab = Math.max(0, set.partners.findIndex(function (p) { return p.id === defaultPartner; }));
        var tabs = set.partners.map(function (p, pi) {
          return '<button type="button" class="sap-tab' + (pi === defaultTab ? ' is-active' : '') + '" data-p="' + pi + '">' + esc(p.label) + '</button>';
        }).join('');
        var panes = set.partners.map(function (p, pi) {
          return '<div class="sap-pane" data-p="' + pi + '"' + (pi === defaultTab ? '' : ' hidden') + '>' + partnerForm(p) + '</div>';
        }).join('');
        return '<article class="set card">' +
          '<header class="set-head"><div><span class="set-num">Set ' + set.index + '</span>' +
          '<span class="lane-badge">' + set.from + ' <span>→</span> ' + set.to + '</span>' +
          (set.from === set.to ? '<span class="pill">domestic</span>' : '<span class="pill on">international</span>') + '</div>' +
          '<div class="set-actions"><button type="button" class="btn btn-ghost btn-sm" data-set-action="tsv" data-set="' + si + '">Copy partner</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-set-action="json" data-set="' + si + '">Copy set JSON</button></div></header>' +
          '<div class="sap-tabs">' + tabs + '</div>' + panes + '</article>';
      }).join('');
    };

    view.rows = function () {
      var head = ['Set', 'Lane', 'Partner'].concat(Gen.FIELDS.map(function (f) { return Gen.FIELD_LABELS[f]; }));
      if (view.withInjected) head.push('Inserted characters');
      var rows = [head];
      view.sets.forEach(function (set) {
        set.partners.forEach(function (p) {
          var flat = Gen.flatten(p);
          var r = [set.index, set.from + '-' + set.to, p.label].concat(Gen.FIELDS.map(function (f) { return flat[f]; }));
          if (view.withInjected) r.push(injectedChars(p));
          rows.push(r);
        });
      });
      return rows;
    };

    view.json = function () {
      return JSON.stringify({ seed: view.seed, sets: view.sets.map(setToJson) }, null, 2);
    };

    container.addEventListener('click', function (e) {
      var tab = e.target.closest('.sap-tab');
      if (tab) {
        var card = tab.closest('.set');
        $$('.sap-tab', card).forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        $$('.sap-pane', card).forEach(function (p) { p.hidden = p.dataset.p !== tab.dataset.p; });
        return;
      }
      var fv = e.target.closest('.fv');
      if (fv) { if (fv.dataset.copy) copy(fv.dataset.copy, 'Copied ' + fv.title.split(':')[0]); return; }
      var act = e.target.closest('[data-set-action]');
      if (!act) return;
      var set = view.sets[Number(act.dataset.set)];
      if (act.dataset.setAction === 'json') copy(JSON.stringify(setToJson(set), null, 2), 'Set JSON copied');
      if (act.dataset.setAction === 'tsv') {
        var active = $('.sap-tab.is-active', act.closest('.set'));
        var p = set.partners[Number(active.dataset.p)];
        var flat = Gen.flatten(p);
        copy(Core.toTSV(Gen.FIELDS.map(function (f) { return [Gen.FIELD_LABELS[f], flat[f]]; })), p.label + ' copied');
      }
    });
    return view;
  }

  function wireLane(prefix, from, to) {
    fillSelect($('#' + prefix + '-from'), [['RANDOM', 'Random']].concat(countryOpts), from);
    fillSelect($('#' + prefix + '-to'), [['RANDOM', 'Random']].concat(countryOpts), to);
    $('#' + prefix + '-swap').addEventListener('click', function () {
      var f = $('#' + prefix + '-from').value;
      $('#' + prefix + '-from').value = $('#' + prefix + '-to').value;
      $('#' + prefix + '-to').value = f;
    });
  }

  /* =========================================================
   * 1. Addresses (special characters are an optional section)
   * ========================================================= */
  wireLane('af', 'US', 'MX');
  var addrView = AddressView($('#af-results'), 'shipTo');

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

  /* ---------- Collapsible sections ---------- */
  function setOpen(acc, open) {
    acc.classList.toggle('is-open', open);
    $('.acc-toggle', acc).setAttribute('aria-expanded', open);
  }
  $$('.acc-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var acc = btn.closest('.acc');
      setOpen(acc, !acc.classList.contains('is-open'));
    });
  });

  var CHAR_NAMES = {
    '#': 'Number sign', '$': 'Dollar', '%': 'Percent', '&': 'Ampersand', "'": 'Apostrophe', '(': 'Left parenthesis',
    ')': 'Right parenthesis', '*': 'Asterisk', '<': 'Less-than', '>': 'Greater-than', '@': 'At sign', '^': 'Caret',
    '!': 'Exclamation', '"': 'Double quote', '+': 'Plus', ',': 'Comma', '-': 'Hyphen', '.': 'Period', '/': 'Slash',
    ':': 'Colon', ';': 'Semicolon', '=': 'Equals', '?': 'Question mark', '[': 'Left bracket', '\\': 'Backslash',
    ']': 'Right bracket', '_': 'Underscore', '`': 'Backtick', '{': 'Left brace', '|': 'Pipe', '}': 'Right brace', '~': 'Tilde',
    ' ': 'Space', ' ': 'Non-breaking space', '\t': 'Tab'
  };
  var charLabel = function (c) { return (CHAR_NAMES[c] ? CHAR_NAMES[c] + ' · ' : '') + Core.codePoints(c); };

  var scSelected = Core.parseChars(Core.CHAR_SETS[0].chars); // carrier table preselected

  function renderMultiSelect() {
    $('#sc-ms-chips').innerHTML = scSelected.length
      ? scSelected.map(function (c, i) {
          return '<span class="ms-chip" title="' + esc(charLabel(c)) + '">' + esc(Core.visible(c)) +
            '<button type="button" data-remove="' + i + '" aria-label="Remove ' + esc(charLabel(c)) + '">×</button></span>';
        }).join('') + '<button type="button" class="ms-clear" data-clear>Clear</button>'
      : '<span class="ms-placeholder">No characters selected</span>';
    $('#sc-ms-menu').innerHTML = Core.CHAR_SETS.map(function (g) {
      var chars = Core.parseChars(g.chars);
      var all = chars.every(function (c) { return scSelected.indexOf(c) >= 0; });
      return '<div class="ms-group"><div class="ms-group-head"><span>' + esc(g.label) + '</span>' +
        '<button type="button" data-group="' + g.id + '">' + (all ? 'Remove all' : 'Add all') + '</button></div>' +
        '<div class="ms-grid">' + chars.map(function (c) {
          var on = scSelected.indexOf(c) >= 0;
          return '<button type="button" class="ms-opt' + (on ? ' on' : '') + '" data-ch="' + esc(c) + '" aria-pressed="' + on + '" title="' + esc(charLabel(c)) + '">' + esc(Core.visible(c)) + '</button>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function toggleMenu(open) {
    var menu = $('#sc-ms-menu');
    open = open === undefined ? menu.hidden : open;
    menu.hidden = !open;
    $('#sc-ms-toggle').setAttribute('aria-expanded', open);
    $('#sc-ms-toggle').textContent = open ? 'Done ▴' : 'Select ▾';
  }

  function addManual() {
    var input = $('#sc-ms-input');
    // Every typed character is added individually; spaces separate entries
    var added = 0;
    Array.from(input.value.replace(/\s+/g, '')).forEach(function (c) {
      if (scSelected.indexOf(c) < 0) { scSelected.push(c); added++; }
    });
    input.value = '';
    renderMultiSelect();
    if (added) toast('Added ' + added + ' character' + (added > 1 ? 's' : ''));
  }

  $('#sc-ms-toggle').addEventListener('click', function () { toggleMenu(); });
  $('#sc-ms-add').addEventListener('click', addManual);
  $('#sc-ms-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addManual(); } });
  $('#sc-ms').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.remove !== undefined) scSelected.splice(Number(t.dataset.remove), 1);
    else if (t.hasAttribute('data-clear')) scSelected = [];
    else if (t.dataset.ch !== undefined) {
      var i = scSelected.indexOf(t.dataset.ch);
      if (i >= 0) scSelected.splice(i, 1); else scSelected.push(t.dataset.ch);
    } else if (t.dataset.group) {
      var g = Core.parseChars(Core.CHAR_SETS.find(function (x) { return x.id === t.dataset.group; }).chars);
      var all = g.every(function (c) { return scSelected.indexOf(c) >= 0; });
      if (all) scSelected = scSelected.filter(function (c) { return g.indexOf(c) < 0; });
      else g.forEach(function (c) { if (scSelected.indexOf(c) < 0) scSelected.push(c); });
    } else return;
    renderMultiSelect();
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('#sc-ms')) toggleMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggleMenu(false); });

  var SC_FIELD_LABELS = { region: 'State', postcode: 'PostCode', country: 'Ctry' };
  var SC_FIELD_LABELS = { region: 'State', postcode: 'PostCode', country: 'Ctry' };
  var fieldName = function (f) { return SC_FIELD_LABELS[f] || Gen.FIELD_LABELS[f]; };
  $('#sc-fields').innerHTML = Gen.INJECTABLE.map(function (f) {
    var on = ['addr1', 'addr2', 'city'].indexOf(f) >= 0;
    return '<label class="check"><input type="checkbox" name="sc-field" value="' + f + '"' + (on ? ' checked' : '') + '> ' + fieldName(f) + '</label>';
  }).join('');
  $('#sc-fields-all').addEventListener('click', function () {
    var boxes = $$('input[name="sc-field"]');
    var all = boxes.every(function (b) { return b.checked; });
    boxes.forEach(function (b) { b.checked = !all; });
    updateSummaries();
  });

  $('#sp-enabled').addEventListener('change', function () {
    if (this.checked) setOpen(this.closest('.acc'), true);
    updateSummaries();
  });

  /* ---------- One-line summaries on each section header ---------- */
  var POS_LABELS = { start: 'Beginning', middle: 'Middle', end: 'End' };
  function updateSummaries() {
    var from = $('#af-from').value, to = $('#af-to').value;
    var n = parseInt($('#af-count').value, 10) || 1;
    $('#sum-lane').textContent = (from === 'RANDOM' ? 'Random' : from) + ' → ' + (to === 'RANDOM' ? 'Random' : to) + ' · ' + n + ' set' + (n > 1 ? 's' : '');

    var on = $('#sp-enabled').checked;
    $('.acc-sp').classList.toggle('is-on', on);
    if (!on) $('#sum-sp').textContent = 'Off';
    else {
      var fields = checkedValues('sc-field');
      var fl = fields.length === Gen.INJECTABLE.length ? 'all fields' :
        fields.length > 3 ? fields.length + ' fields' : fields.map(fieldName).join(', ') || 'no fields';
      $('#sum-sp').textContent = scSelected.length + ' chars · ' + fl + ' · ' +
        (checkedValues('sc-pos').map(function (p) { return POS_LABELS[p]; }).join('/') || 'no position');
    }

    var partners = checkedValues('af-partner');
    $('#sum-partners').textContent = 'Ship From, Ship To' + (partners.length ? ' +' + partners.length : '') + ' · ' + $('#af-namestyle').selectedOptions[0].text;

    var fills = $$('input[name="af-fill"]');
    var filled = fills.filter(function (b) { return b.checked; }).length;
    $('#sum-fields').textContent = (filled === fills.length ? 'All optional fields filled' : filled + ' of ' + fills.length + ' optional filled') +
      ($('#af-house').value === 'inline' ? ' · house no. in Addr 1' : '');
  }
  $('#panel-addr .controls').addEventListener('change', updateSummaries);
  $('#panel-addr .controls').addEventListener('input', updateSummaries);
  // Chip edits in the multi-select re-render, so refresh the summary after them too
  $('#sc-ms').addEventListener('click', function () { setTimeout(updateSummaries, 0); });
  $('#sc-ms-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') setTimeout(updateSummaries, 0); });

  function generateAddresses() {
    var spOn = $('#sp-enabled').checked;
    var fields = checkedValues('sc-field');
    var sp = {
      enabled: spOn, chars: scSelected.slice(), positions: checkedValues('sc-pos'), fields: fields,
      apply: $('#sc-apply').value, together: $('#sc-together').checked,
      perField: Math.min(Math.max(parseInt($('#sc-per').value, 10) || 1, 1), 5)
    };
    if (spOn) {
      if (!sp.chars.length) return toast('Select at least one special character');
      if (!sp.positions.length) return toast('Pick at least one position');
      if (!fields.length) return toast('Pick at least one field for special characters');
    }
    // A field picked for special characters is always filled, so there is a value to insert into
    var picked = function (f) { return spOn && fields.indexOf(f) >= 0; };
    addrView.seed = seedFor('#af-seed', '#af-autoseed');
    addrView.sets = Gen.generateAddressSets(addrView.seed, {
      count: Math.min(Math.max(parseInt($('#af-count').value, 10) || 1, 1), 50),
      from: $('#af-from').value, to: $('#af-to').value, forceIntl: $('#af-intl').checked,
      partners: checkedValues('af-partner'),
      nameStyle: $('#af-namestyle').value, namePrefix: $('#af-nameprefix').value,
      houseSeparate: $('#af-house').value === 'separate' || picked('houseNum') || picked('supp'),
      fillAddr2: $('#af-addr2').checked || picked('addr2'),
      fillAddr34: $('#af-addr34').checked || picked('addr3') || picked('addr4'),
      fillSuburb: $('#af-suburb').checked || picked('suburb'),
      forceSuburb: $('#af-suburb').checked || picked('suburb'),
      fillSupp: $('#af-supp').checked || picked('supp'),
      fillFax: $('#af-fax').checked || picked('fax'),
      custPrefix: $('#af-custprefix').value, custStart: $('#af-custstart').value || '001',
      special: sp
    });
    addrView.withInjected = spOn;
    addrView.render();

    var summary = addrView.sets.length + ' test set' + (addrView.sets.length > 1 ? 's' : '') + ' · seed <code>' + addrView.seed + '</code>';
    if (spOn) {
      var used = [];
      addrView.sets.forEach(function (set) {
        set.partners.forEach(function (p) {
          Gen.FIELDS.forEach(function (f) {
            p.fields[f].forEach(function (seg) { if (seg.inj) Array.from(seg.t).forEach(function (c) { if (used.indexOf(c) < 0) used.push(c); }); });
          });
        });
      });
      var missing = sp.chars.filter(function (c) { return used.indexOf(c) < 0; });
      summary += ' · ' + used.length + ' of ' + sp.chars.length + ' special characters used' +
        (missing.length ? ' <span class="warn-text">(add more sets or fields to cover ' + esc(missing.map(Core.visible).join(' ')) + ')</span>' : '');
    }
    $('#af-summary').innerHTML = summary;
    $('#af-hint').innerHTML = 'Click any value to copy it. Fields over the SAP field length turn red.' +
      (spOn ? ' Inserted characters are <mark class="inj">highlighted</mark>; every selected character is used before any repeats.' : '');
  }
  $('#af-go').addEventListener('click', generateAddresses);

  /* =========================================================
   * 2. Handling units (conversion is an optional section)
   * ========================================================= */
  var wUoms = Object.keys(Core.WEIGHT).map(function (k) { return [k, k]; });
  var dUoms = Object.keys(Core.LENGTH).map(function (k) { return [k, k]; });
  fillSelect($('#hu-wuom'), wUoms, 'KG');
  fillSelect($('#hu-duom'), dUoms, 'CM');
  fillSelect($('#cv-tow'), wUoms, 'LB');
  fillSelect($('#cv-tod'), dUoms, 'IN');

  // Metric source converts to imperial by default and vice versa
  var OTHER_W = { KG: 'LB', G: 'LB', LB: 'KG', OZ: 'KG' };
  var OTHER_D = { CM: 'IN', MM: 'IN', M: 'IN', IN: 'CM', FT: 'CM' };

  function syncDivisor() {
    var key = $('#cv-tod').value + '/' + $('#cv-tow').value;
    if (Core.DIM_DIVISORS[key] !== undefined) $('#cv-div').value = Core.DIM_DIVISORS[key];
  }
  $('#cv-tow').addEventListener('change', syncDivisor);
  $('#cv-tod').addEventListener('change', syncDivisor);

  function applyDefaultRanges() {
    var w = Gen.DEFAULT_RANGES.weight[$('#hu-wuom').value];
    var d = Gen.DEFAULT_RANGES.length[$('#hu-duom').value];
    $('#hu-wmin').value = w[0]; $('#hu-wmax').value = w[1];
    $('#hu-dmin').value = d[0]; $('#hu-dmax').value = d[1];
  }
  $('#hu-wuom').addEventListener('change', function () {
    applyDefaultRanges();
    if ($('#cv-tow').value === this.value) { $('#cv-tow').value = OTHER_W[this.value]; syncDivisor(); }
  });
  $('#hu-duom').addEventListener('change', function () {
    applyDefaultRanges();
    if ($('#cv-tod').value === this.value) { $('#cv-tod').value = OTHER_D[this.value]; syncDivisor(); }
  });
  applyDefaultRanges();

  var huSeed = null;

  function generateHUs() {
    var wMin = num('#hu-wmin', 1), wMax = num('#hu-wmax', 10);
    var dMin = num('#hu-dmin', 1), dMax = num('#hu-dmax', 10);
    if (wMin > wMax) { var t = wMin; wMin = wMax; wMax = t; }
    if (dMin > dMax) { var t2 = dMin; dMin = dMax; dMax = t2; }
    huSeed = seedFor('#hu-seed', '#hu-autoseed');
    setInputRows(Gen.generateHUs(huSeed, {
      count: Math.min(Math.max(parseInt($('#hu-count').value, 10) || 1, 1), 200),
      wUom: $('#hu-wuom').value, dUom: $('#hu-duom').value, mixed: $('#hu-mixed').checked,
      wMin: wMin, wMax: wMax, wDp: Math.min(Math.max(parseInt($('#hu-wdp').value, 10) || 0, 0), 4),
      dMin: dMin, dMax: dMax, dDp: Math.min(Math.max(parseInt($('#hu-ddp').value, 10) || 0, 0), 4),
      identical: $('#hu-identical').checked,
      idPrefix: $('#hu-idprefix').value, idStart: $('#hu-idstart').value || '1'
    }));
  }
  $('#hu-go').addEventListener('click', generateHUs);

  /* ---------- Editable HU table ---------- */
  function uomSelect(cls, list, value) {
    return '<select class="' + cls + '">' + list.map(function (u) {
      return '<option' + (u[0] === value ? ' selected' : '') + '>' + u[0] + '</option>';
    }).join('') + '</select>';
  }

  function addInputRow(h) {
    h = h || { id: 'HU' + String($$('#cv-input tbody tr').length + 1).padStart(4, '0'), weight: '', wUom: $('#hu-wuom').value, l: '', w: '', h: '', dUom: $('#hu-duom').value };
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

  /* ---------- Conversion ---------- */
  var conv = null;
  var cvOn = function () { return $('#cv-enabled').checked; };

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
    $('#cv-factors').innerHTML = '<ul>' + lines.map(function (l) { return '<li><code>' + l + '</code></li>'; }).join('') +
      '</ul><p class="hint">Exact definitions: 1 lb = 0.45359237 kg, 1 in = 2.54 cm.</p>';
  }

  function updateHuSummaries() {
    var mixed = $('#hu-mixed').checked;
    $('#sum-hu').textContent = (parseInt($('#hu-count').value, 10) || 1) + ' HUs · ' +
      (mixed ? 'mixed LB/IN + KG/CM' : $('#hu-wuom').value + '/' + $('#hu-duom').value);
    var o = convOpts();
    $('#acc-cv').classList.toggle('is-on', cvOn());
    $('#sum-cv').textContent = cvOn()
      ? o.toW + '/' + o.toD + ' · ' + o.wDp + ' dp · ' + $('#cv-mode').selectedOptions[0].text.replace(/ \(.*/, '').toLowerCase() + (o.dimWeight ? ' · dim wt' : '')
      : 'Off';
    $('#cv-dim-opts').hidden = !o.dimWeight;
  }

  function renderConversion() {
    updateHuSummaries();
    var o = convOpts();
    var src = readInputRows();
    $('#cv-count').textContent = '(' + src.length + ')';
    renderFactors();
    var seedTxt = huSeed ? ' · seed <code>' + huSeed + '</code>' : '';
    $('#hu-summary').innerHTML = src.length + ' HU' + (src.length === 1 ? '' : 's') + seedTxt +
      (cvOn() && src.length ? ' · converted to ' + o.toW + '/' + o.toD + ', ' + $('#cv-mode').selectedOptions[0].text.replace(/ \(.*/, '').toLowerCase() + ' rounding' : '');
    $('#cv-out').hidden = !cvOn();
    if (!src.length) {
      conv = null;
      $('#cv-table thead').innerHTML = '';
      $('#cv-table tbody').innerHTML = '<tr><td class="empty-row">Generate HUs, add rows, or paste from Excel.</td></tr>';
      $('#cv-table tfoot').innerHTML = '';
      return;
    }
    conv = Core.convertHUs(src, o);
    if (!cvOn()) return;
    $('#cv-title').textContent = 'Converted to ' + o.toW + ' / ' + o.toD;
    var showF = $('#cv-formula').checked;
    $('#cv-table thead').innerHTML = '<tr><th>HU</th><th class="num">Weight (' + o.toW + ')</th>' +
      '<th class="num">Length (' + o.toD + ')</th><th class="num">Width (' + o.toD + ')</th><th class="num">Height (' + o.toD + ')</th>' +
      (o.dimWeight ? '<th class="num">Dim wt (' + o.toW + ')</th><th class="num">Billable (' + o.toW + ')</th>' : '') + '</tr>';

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
  }

  // One export covers source HUs, plus the converted values when conversion is on
  function huExportRows() {
    var src = readInputRows();
    if (!src.length) return [];
    var head = ['HU', 'Weight', 'Weight UoM', 'Length', 'Width', 'Height', 'Dim UoM'];
    if (!cvOn()) {
      return [head].concat(src.map(function (h) { return [h.id, h.weight, h.wUom, h.l, h.w, h.h, h.dUom]; }));
    }
    var o = convOpts();
    head = head.concat(['Weight (' + o.toW + ')', 'Length (' + o.toD + ')', 'Width (' + o.toD + ')', 'Height (' + o.toD + ')', 'Weight factor', 'Dim factor']);
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

  function huJson() {
    var src = readInputRows();
    var out = { seed: huSeed, handlingUnits: src };
    if (cvOn() && conv) {
      var o = convOpts();
      out.converted = {
        weightUom: o.toW, dimUom: o.toD, rounding: o.mode,
        handlingUnits: conv.rows.map(function (r) {
          var x = { id: r.id, weight: r.weight, length: r.dims[0].value, width: r.dims[1].value, height: r.dims[2].value };
          if (o.dimWeight) { x.dimWeight = r.dimWeight; x.billableWeight = r.billable; }
          return x;
        }),
        totalWeight: conv.totals.sumOfRounded
      };
    }
    return JSON.stringify(out, null, 2);
  }

  $('#cv-enabled').addEventListener('change', function () {
    if (this.checked) setOpen(this.closest('.acc'), true);
  });
  $('#panel-hu').addEventListener('input', function (e) { if (e.target.id !== 'cv-paste') renderConversion(); });
  $('#panel-hu').addEventListener('change', function (e) { if (e.target.id !== 'cv-paste') renderConversion(); });

  function parsePasted(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
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

  /* =========================================================
   * 3. Freight calculator (density-based class)
   * ========================================================= */
  fillSelect($('#fc-scale'), Object.keys(Core.FREIGHT_SCALES).map(function (k) { return [k, Core.FREIGHT_SCALES[k].label]; }), 'classic');
  var fc = null;
  var fcUnits = function () { var u = $('#fc-units').value.split('/'); return { d: u[0], w: u[1] }; };
  var n2 = function (v) { return Core.fmt(Core.roundTo(v, 2), 2); };

  function fcAddRow(r) {
    r = r || { qty: 1, l: '', w: '', h: '', weight: '' };
    var tr = document.createElement('tr');
    var inp = function (cls, v, step) { return '<td><input class="' + cls + ' num" type="number" min="0" step="' + (step || 'any') + '" value="' + esc(v) + '"></td>'; };
    tr.innerHTML = inp('f-q', r.qty, '1') + inp('f-l', r.l) + inp('f-w', r.w) + inp('f-h', r.h) + inp('f-wt', r.weight) +
      '<td><button type="button" class="icon-btn sm" data-action="fc-del" aria-label="Remove row">×</button></td>';
    $('#fc-input tbody').appendChild(tr);
  }
  function fcSetRows(list) { $('#fc-input tbody').innerHTML = ''; list.forEach(fcAddRow); renderFreight(); }
  function fcReadRows() {
    return $$('#fc-input tbody tr').map(function (tr) {
      return { qty: parseFloat($('.f-q', tr).value) || 1, l: parseFloat($('.f-l', tr).value), w: parseFloat($('.f-w', tr).value),
        h: parseFloat($('.f-h', tr).value), weight: parseFloat($('.f-wt', tr).value) };
    }).filter(function (r) { return [r.l, r.w, r.h, r.weight].every(function (v) { return !isNaN(v) && v > 0; }); });
  }

  function renderFreight() {
    var u = fcUnits(), per = $('#fc-weightper').value, scale = $('#fc-scale').value;
    $('#fc-h-l').textContent = 'Length (' + u.d + ')'; $('#fc-h-w').textContent = 'Width (' + u.d + ')'; $('#fc-h-h').textContent = 'Height (' + u.d + ')';
    $('#fc-h-wt').textContent = 'Weight (' + u.w + (per === 'line' ? ', line total' : ', per piece') + ')';
    $('#sum-fc').textContent = u.d + '/' + u.w + ' · weight ' + (per === 'line' ? 'per line' : 'per piece') + ' · ' + (scale === 'classic' ? 'classic chart' : 'NMFC 2025');

    var lines = fcReadRows();
    $('#fc-count').textContent = '(' + lines.length + ')';
    fc = lines.length ? Core.calcFreight(lines, { dUom: u.d, wUom: u.w, weightPer: per, scale: scale }) : null;

    // Density chart with the shipment's tier highlighted
    var tiers = Core.FREIGHT_SCALES[scale].tiers;
    $('#fc-chart tbody').innerHTML = tiers.map(function (t, i) {
      var range = i === 0 ? t[0] + ' or more' : t[0] === 0 ? 'under ' + tiers[i - 1][0] : t[0] + ' to under ' + tiers[i - 1][0];
      return '<tr' + (fc && fc.totals.cls === t[1] ? ' class="hit"' : '') + '><td class="num">' + range + '</td><td class="num">' + t[1] + '</td></tr>';
    }).join('');

    if (!fc) {
      $('#fc-result').innerHTML = '';
      $('#fc-table thead').innerHTML = ''; $('#fc-table tfoot').innerHTML = '';
      $('#fc-table tbody').innerHTML = '<tr><td class="empty-row">Enter dimensions and weight above.</td></tr>';
      $('#fc-summary').textContent = '';
      return;
    }
    var t = fc.totals;
    $('#fc-result').innerHTML =
      '<div class="fc-class"><span>Estimated freight class</span><strong>' + t.cls + '</strong></div>' +
      '<div class="fc-stat"><span>Total volume</span><strong>' + n2(t.cuFt) + ' ft³</strong></div>' +
      '<div class="fc-stat"><span>Total weight</span><strong>' + n2(t.lbs) + ' lb</strong></div>' +
      '<div class="fc-stat"><span>Density</span><strong>' + n2(t.density) + ' lb/ft³</strong></div>';
    $('#fc-summary').innerHTML = t.pieces + ' piece' + (t.pieces === 1 ? '' : 's') + ' on ' + fc.rows.length + ' line' + (fc.rows.length === 1 ? '' : 's');

    var cell = function (val, f) { return '<td class="num"><strong>' + val + '</strong>' + (f ? '<small class="calc">' + f + '</small>' : '') + '</td>'; };
    var metric = u.d !== 'IN' || u.w !== 'LB';
    $('#fc-table thead').innerHTML = '<tr><th>Line</th><th class="num">Pieces</th><th class="num">Dimensions (' + u.d + ')</th><th class="num">Cubic feet</th><th class="num">Weight (lb)</th><th class="num">Density (lb/ft³)</th><th class="num">Class</th></tr>';
    $('#fc-table tbody').innerHTML = fc.rows.map(function (r, i) {
      var s = r.src;
      var ftF = (metric ? Number(r.cuInPiece.toPrecision(10)) + ' in³' : s.l + ' × ' + s.w + ' × ' + s.h + ' = ' + Number(r.cuInPiece.toPrecision(10)) + ' in³') +
        ' ÷ 1728' + (r.qty > 1 ? ' × ' + r.qty : '');
      var lbF = (u.w !== 'LB' ? s.weight + ' KG × 2.204622622' : s.weight + ' LB') + (per === 'piece' && r.qty > 1 ? ' × ' + r.qty : '');
      return '<tr><td>' + (i + 1) + '</td>' + cell(r.qty) + cell(s.l + ' × ' + s.w + ' × ' + s.h) +
        cell(n2(r.cuFt), ftF) + cell(n2(r.lbs), lbF) + cell(n2(r.density), n2(r.lbs) + ' ÷ ' + n2(r.cuFt)) + cell(r.cls) + '</tr>';
    }).join('');
    $('#fc-table tfoot').innerHTML = '<tr><td>Shipment</td><td class="num"><strong>' + t.pieces + '</strong></td><td></td>' +
      cell(n2(t.cuFt)) + cell(n2(t.lbs)) + cell(n2(t.density), n2(t.lbs) + ' ÷ ' + n2(t.cuFt)) + cell(t.cls) + '</tr>';
  }

  function fcRows() {
    if (!fc) return [];
    var u = fcUnits();
    var rows = [['Line', 'Pieces', 'Length (' + u.d + ')', 'Width (' + u.d + ')', 'Height (' + u.d + ')', 'Weight entered (' + u.w + ')', 'Cubic feet', 'Weight (lb)', 'Density (lb/ft3)', 'Class']];
    fc.rows.forEach(function (r, i) {
      rows.push([i + 1, r.qty, r.src.l, r.src.w, r.src.h, r.src.weight, n2(r.cuFt), n2(r.lbs), n2(r.density), r.cls]);
    });
    var t = fc.totals;
    rows.push(['Shipment', t.pieces, '', '', '', '', n2(t.cuFt), n2(t.lbs), n2(t.density), t.cls]);
    return rows;
  }

  $('#panel-fc').addEventListener('input', renderFreight);
  $('#panel-fc').addEventListener('change', renderFreight);

  /* ---------- Table → PNG (for pasting into test evidence) ---------- */
  // Draws the rendered table onto a canvas so the image matches the screen exactly.
  function tableToCanvas(table, title, subtitle) {
    var SCALE = 2, PAD_X = 12, PAD_Y = 8, LINE = 17, SMALL_LINE = 14, MARGIN = 16;
    var FONT = '13px "Open Sans", "Segoe UI", Arial, sans-serif';
    var BOLD = '600 13px "Open Sans", "Segoe UI", Arial, sans-serif';
    var HEAD = '700 12px "Open Sans", "Segoe UI", Arial, sans-serif';
    var MONO = '11px ui-monospace, Consolas, "Liberation Mono", monospace';
    var TITLE = '700 16px "Open Sans", "Segoe UI", Arial, sans-serif';
    var css = getComputedStyle(document.documentElement);
    var color = function (v, fb) { return (css.getPropertyValue(v) || fb).trim(); };
    var C = { head: color('--navy', '#1d5f8f'), line: '#dfe5ea', ink: '#222b33', muted: '#5f6b76', zebra: '#f8fafc', foot: '#eef3f9', title: color('--blue', '#2c7bab') };

    var readRow = function (tr, kind) {
      return Array.from(tr.children).map(function (td) {
        var strong = td.querySelector('strong');
        var small = td.querySelector('small');
        return {
          main: (strong ? strong.textContent : (small ? td.firstChild.textContent : td.textContent)).trim(),
          sub: small ? small.textContent.trim() : '',
          num: td.classList.contains('num'), kind: kind, span: td.colSpan || 1
        };
      });
    };
    var head = readRow(table.tHead.rows[0], 'head');
    var body = Array.from(table.tBodies[0].rows).map(function (r) { return readRow(r, 'body'); });
    var foot = table.tFoot && table.tFoot.rows[0] ? readRow(table.tFoot.rows[0], 'foot') : null;
    var ncol = head.length;
    // Expand colspans so every row has one cell per column
    var expand = function (row) {
      var out = [];
      row.forEach(function (c) { out.push(c); for (var i = 1; i < c.span; i++) out.push({ main: '', sub: '', num: c.num, kind: c.kind }); });
      while (out.length < ncol) out.push({ main: '', sub: '', kind: row[0].kind });
      return out.slice(0, ncol);
    };
    var rows = [head].concat(body).concat(foot ? [foot] : []).map(expand);

    var ctx = document.createElement('canvas').getContext('2d');
    var widths = new Array(ncol).fill(0);
    rows.forEach(function (r) {
      r.forEach(function (c, i) {
        ctx.font = c.kind === 'head' ? HEAD : BOLD;
        var w = ctx.measureText(c.main).width;
        ctx.font = MONO;
        if (c.sub) w = Math.max(w, ctx.measureText(c.sub).width);
        widths[i] = Math.max(widths[i], w + PAD_X * 2);
      });
    });
    var rowH = rows.map(function (r) {
      var hasSub = r.some(function (c) { return c.sub; });
      return PAD_Y * 2 + LINE + (hasSub ? SMALL_LINE : 0);
    });
    var tableW = widths.reduce(function (a, b) { return a + b; }, 0);
    var headerH = 26 + (subtitle ? 18 : 0) + 10;
    var W = tableW + MARGIN * 2;
    var H = headerH + rowH.reduce(function (a, b) { return a + b; }, 0) + MARGIN * 2;

    var canvas = document.createElement('canvas');
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';

    ctx.fillStyle = C.title; ctx.font = TITLE;
    ctx.fillText(title, MARGIN, MARGIN);
    if (subtitle) { ctx.fillStyle = C.muted; ctx.font = FONT; ctx.fillText(subtitle, MARGIN, MARGIN + 24); }

    var y = MARGIN + headerH;
    rows.forEach(function (r, ri) {
      var h = rowH[ri], x = MARGIN, kind = r[0].kind;
      ctx.fillStyle = kind === 'head' ? C.head : kind === 'foot' ? C.foot : (ri % 2 === 0 ? C.zebra : '#fff');
      ctx.fillRect(MARGIN, y, tableW, h);
      r.forEach(function (c, ci) {
        var w = widths[ci];
        var tx = c.num ? x + w - PAD_X : x + PAD_X;
        ctx.textAlign = c.num ? 'right' : 'left';
        ctx.font = kind === 'head' ? HEAD : (c.num || kind === 'foot' ? BOLD : FONT);
        ctx.fillStyle = kind === 'head' ? '#fff' : C.ink;
        ctx.fillText(c.main, tx, y + PAD_Y + (kind === 'head' ? 2 : 0));
        if (c.sub) { ctx.font = MONO; ctx.fillStyle = C.muted; ctx.fillText(c.sub, tx, y + PAD_Y + LINE); }
        x += w;
      });
      ctx.textAlign = 'left';
      ctx.fillStyle = kind === 'foot' ? C.head : C.line;
      ctx.fillRect(MARGIN, kind === 'foot' ? y : y + h - 1, tableW, kind === 'foot' ? 2 : 1);
      y += h;
    });
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN + .5, MARGIN + headerH + .5, tableW - 1, y - MARGIN - headerH - 1);
    return canvas;
  }

  function copyCanvas(canvas, filename) {
    var fallback = function (err) {
      if (err) console.warn('Clipboard image copy failed:', err);
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png'); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      toast('Image downloaded (this browser blocks copying images)');
    };
    if (!(navigator.clipboard && window.ClipboardItem && window.isSecureContext)) return fallback();
    // Pass a promise so Safari keeps the click as the user gesture
    var blob = new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      .then(function () { toast('Table copied as image. Paste it into your test file'); }, fallback);
  }

  /* ---------- Toolbar actions ---------- */
  function exportView(view, kind, name) {
    if (!view.sets.length) return toast('Generate addresses first');
    if (kind === 'tsv') copy(Core.toTSV(view.rows()), 'Copied ' + (view.rows().length - 1) + ' rows');
    if (kind === 'json') copy(view.json(), 'JSON copied');
    if (kind === 'csv') download(name + '-seed' + view.seed + '-' + stamp() + '.csv', Core.toCSV(view.rows()));
  }

  var ACTIONS = {
    'af-tsv': function () { exportView(addrView, 'tsv', 'addresses'); },
    'af-json': function () { exportView(addrView, 'json', 'addresses'); },
    'af-csv': function () { exportView(addrView, 'csv', 'addresses'); },
    'hu-tsv': function () { var r = huExportRows(); if (!r.length) return toast('No HUs to copy'); copy(Core.toTSV(r), 'Copied ' + (r.length - 1) + ' HUs'); },
    'hu-json': function () { if (!readInputRows().length) return toast('No HUs to copy'); copy(huJson(), 'JSON copied'); },
    'hu-csv': function () {
      var r = huExportRows(); if (!r.length) return toast('No HUs to export');
      download('handling-units' + (huSeed ? '-seed' + huSeed : '') + '-' + stamp() + '.csv', Core.toCSV(r));
    },
    'cv-add': function () { addInputRow(); renderConversion(); var last = $$('#cv-input tbody tr').pop(); $('.c-w', last).focus(); },
    'cv-clear': function () { huSeed = null; setInputRows([]); },
    'cv-paste-toggle': function () { var b = $('#cv-paste-box'); b.hidden = !b.hidden; if (!b.hidden) $('#cv-paste').focus(); },
    'cv-import': function () {
      var rows = parsePasted($('#cv-paste').value);
      if (!rows.length) return toast('No valid rows found');
      huSeed = null;
      setInputRows(rows);
      $('#cv-paste').value = ''; $('#cv-paste-box').hidden = true;
      toast('Imported ' + rows.length + ' rows');
    },
    'cv-del': function (btn) { btn.closest('tr').remove(); renderConversion(); },
    'fc-add': function () { fcAddRow(); renderFreight(); $('.f-l', $$('#fc-input tbody tr').pop()).focus(); },
    'fc-clear': function () { fcSetRows([]); fcAddRow(); },
    'fc-del': function (btn) { btn.closest('tr').remove(); renderFreight(); },
    'fc-tsv': function () { var r = fcRows(); if (!r.length) return toast('Nothing to copy'); copy(Core.toTSV(r), 'Copied ' + (r.length - 2) + ' lines'); },
    'fc-csv': function () { var r = fcRows(); if (!r.length) return toast('Nothing to export'); download('freight-class-' + stamp() + '.csv', Core.toCSV(r)); },
    'fc-from-hu': function () {
      var hus = readInputRows();
      if (!hus.length) return toast('No HUs on the Handling Units tab');
      var u = fcUnits();
      fcSetRows(hus.map(function (h) {
        var d = function (v) { return Core.roundTo(Core.convertLength(v, h.dUom, u.d), 2); };
        return { qty: 1, l: d(h.l), w: d(h.w), h: d(h.h), weight: Core.roundTo(Core.convertWeight(h.weight, h.wUom, u.w), 2) };
      }));
      $('#fc-weightper').value = 'piece'; renderFreight();
      toast('Loaded ' + hus.length + ' HUs (converted to ' + u.d + '/' + u.w + ')');
    },
    'fc-image': function () {
      if (!fc) return toast('Nothing to copy');
      var t = fc.totals;
      var sub = 'Estimated class ' + t.cls + ' · ' + n2(t.cuFt) + ' ft³ · ' + n2(t.lbs) + ' lb · ' + n2(t.density) + ' lb/ft³ · ' +
        Core.FREIGHT_SCALES[$('#fc-scale').value].label;
      copyCanvas(tableToCanvas($('#fc-table'), 'Freight class calculation', sub), 'freight-class-' + stamp() + '.png');
    },
    'cv-image': function () {
      if (!conv || !cvOn()) return toast('Nothing to copy');
      var o = convOpts();
      var sub = conv.rows.length + ' HU' + (conv.rows.length === 1 ? '' : 's') + ' · ' + o.wDp + ' weight / ' + o.dDp + ' dim decimals · ' +
        $('#cv-mode').selectedOptions[0].text.replace(/ \(.*/, '').toLowerCase() + ' rounding' +
        (o.dimWeight ? ' · dim divisor ' + o.divisor : '');
      copyCanvas(tableToCanvas($('#cv-table'), $('#cv-title').textContent, sub), 'uom-conversion-' + stamp() + '.png');
    }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (b && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action](b);
  });

  /* ---------- Init ---------- */
  renderMultiSelect();
  updateSummaries();
  generateAddresses();
  generateHUs();
  fcSetRows([{ qty: 1, l: 48, w: 40, h: 48, weight: 500 }]);
  try {
    var saved = localStorage.getItem('qa-toolkit-tab');
    if (saved && $('#panel-' + saved)) showTab(saved);
  } catch (e) { /* ignore */ }
})();
