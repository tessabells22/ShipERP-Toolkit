/* Core logic shared by the browser UI and the Node tests.
 * No DOM access in this file. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.SECore = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Seeded RNG (mulberry32) ----------
   * Same seed => same data, so a test case can record the seed and
   * anyone can regenerate the exact dataset later. */
  function createRng(seed) {
    var a = (Number(seed) >>> 0) || 1;
    function next() {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      int: function (min, max) { return Math.floor(next() * (max - min + 1)) + min; },
      float: function (min, max, dp) {
        var v = roundTo(min + next() * (max - min), dp, 'half-up');
        if (v < min) v = roundTo(min, dp, 'up');
        if (v > max) v = roundTo(max, dp, 'down');
        return v;
      },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      bool: function (p) { return next() < (p === undefined ? 0.5 : p); },
      digit: function () { return String(Math.floor(next() * 10)); }
    };
  }

  function newSeed() { return Math.floor(Math.random() * 900000) + 100000; }

  /* ---------- Rounding ----------
   * half-up    : 2.345 -> 2.35   (away from zero on .5)
   * up         : always toward +infinity (carriers often round weight up)
   * down       : truncate
   * half-even  : banker's rounding (2.345 -> 2.34, 2.355 -> 2.36) */
  function roundTo(value, dp, mode) {
    dp = dp || 0;
    var f = Math.pow(10, dp);
    // toPrecision strips binary noise such as 1.005*100 = 100.49999999999999
    var x = Number((value * f).toPrecision(15));
    var r;
    switch (mode) {
      case 'up': r = Math.ceil(x); break;
      case 'down': r = Math.trunc(x); break;
      case 'half-even': {
        var fl = Math.floor(x);
        var diff = Number((x - fl).toPrecision(12));
        if (diff > 0.5) r = fl + 1;
        else if (diff < 0.5) r = fl;
        else r = fl % 2 === 0 ? fl : fl + 1;
        break;
      }
      default: r = Math.sign(x) * Math.round(Math.abs(x));
    }
    return Number((r / f).toFixed(dp));
  }

  function fmt(value, dp) { return Number(value).toFixed(dp); }

  /* ---------- Units of measure ----------
   * Factors are the exact international definitions:
   * 1 lb = 0.45359237 kg, 1 oz = 1/16 lb, 1 in = 2.54 cm, 1 ft = 12 in. */
  var WEIGHT = { KG: 1, LB: 0.45359237, G: 0.001, OZ: 0.028349523125 };
  var LENGTH = { CM: 1, IN: 2.54, MM: 0.1, M: 100, FT: 30.48 };

  function factor(table, from, to) {
    if (!(from in table) || !(to in table)) throw new Error('Unknown UoM ' + from + '/' + to);
    return table[from] / table[to];
  }
  function convertWeight(v, from, to) { return from === to ? v : v * factor(WEIGHT, from, to); }
  function convertLength(v, from, to) { return from === to ? v : v * factor(LENGTH, from, to); }

  function factorText(f) {
    // Enough significant digits to reproduce the result by hand
    return Number(f.toPrecision(10)).toString();
  }

  // Common carrier dimensional-weight divisors (volume per unit of weight)
  var DIM_DIVISORS = {
    'IN/LB': 139, 'CM/KG': 5000, 'MM/KG': 5000000, 'M/KG': 0.005, 'FT/LB': 0.0804398
  };

  /* Converts a list of handling units.
   * hu: { id, weight, wUom, l, w, h, dUom }
   * opts: { toW, toD, wDp, dDp, mode, dimWeight, divisor, roundDimsUp } */
  function convertHUs(hus, opts) {
    var rows = hus.map(function (hu) {
      var wF = factor(WEIGHT, hu.wUom, opts.toW);
      var dF = factor(LENGTH, hu.dUom, opts.toD);
      var wRaw = hu.weight * wF;
      var row = {
        id: hu.id,
        src: hu,
        wFactor: wF, dFactor: dF,
        wRaw: wRaw,
        weight: roundTo(wRaw, opts.wDp, opts.mode),
        dims: ['l', 'w', 'h'].map(function (k) {
          var raw = hu[k] * dF;
          return { key: k, src: hu[k], raw: raw, value: roundTo(raw, opts.dDp, opts.mode) };
        })
      };
      row.volume = row.dims.reduce(function (p, d) { return p * d.value; }, 1);
      if (opts.dimWeight && opts.divisor > 0) {
        var dimsForCalc = row.dims.map(function (d) { return opts.roundDimsUp ? Math.ceil(d.value) : d.value; });
        var vol = dimsForCalc[0] * dimsForCalc[1] * dimsForCalc[2];
        row.dimCalcDims = dimsForCalc;
        row.dimVolume = vol;
        row.dimWeight = roundTo(vol / opts.divisor, opts.wDp, opts.mode);
        row.billable = Math.max(row.weight, row.dimWeight);
      }
      return row;
    });

    // Two ways to get a total, and they can disagree after rounding.
    // Showing both catches a classic carrier-integration defect.
    var sumRounded = rows.reduce(function (s, r) { return s + r.weight; }, 0);
    var sumRaw = rows.reduce(function (s, r) { return s + r.wRaw; }, 0);
    var totals = {
      sumOfRounded: roundTo(sumRounded, opts.wDp, 'half-up'),
      roundedOfSum: roundTo(sumRaw, opts.wDp, opts.mode)
    };
    totals.delta = roundTo(totals.sumOfRounded - totals.roundedOfSum, opts.wDp + 2, 'half-up');
    if (opts.dimWeight) {
      totals.billable = roundTo(rows.reduce(function (s, r) { return s + (r.billable || 0); }, 0), opts.wDp, 'half-up');
    }
    // Source totals grouped by UoM (HUs can be mixed)
    totals.source = {};
    hus.forEach(function (hu) {
      totals.source[hu.wUom] = (totals.source[hu.wUom] || 0) + hu.weight;
    });
    return { rows: rows, totals: totals };
  }

  /* ---------- Freight class (LTL density) ----------
   * Each scale lists [minimum density in lb/ft³, class], highest density first.
   * A density exactly on a boundary takes the lower class (e.g. 15.0 PCF -> 70). */
  var FREIGHT_SCALES = {
    classic: {
      label: 'Classic 18-class density chart',
      tiers: [[50, '50'], [35, '55'], [30, '60'], [22.5, '65'], [15, '70'], [13.5, '77.5'], [12, '85'], [10.5, '92.5'],
        [9, '100'], [8, '110'], [7, '125'], [6, '150'], [5, '175'], [4, '200'], [3, '250'], [2, '300'], [1, '400'], [0, '500']]
    },
    nmfc2025: {
      label: 'NMFC 13-tier density scale (2025)',
      tiers: [[50, '50'], [35, '55'], [30, '60'], [22.5, '65'], [15, '70'], [12, '85'], [10, '92.5'], [8, '100'],
        [6, '125'], [4, '175'], [2, '250'], [1, '300'], [0, '400']]
    }
  };

  function freightClass(density, scale) {
    var tiers = (FREIGHT_SCALES[scale] || FREIGHT_SCALES.classic).tiers;
    for (var i = 0; i < tiers.length; i++) if (density >= tiers[i][0]) return tiers[i][1];
    return tiers[tiers.length - 1][1];
  }

  /* lines: [{ qty, l, w, h, weight }]
   * opts: { dUom, wUom, weightPer: 'piece'|'line', scale, toIn?, toLb? }
   * toIn / toLb override the unit tables, for units not listed there (yards, tonnes, custom). */
  function calcFreight(lines, opts) {
    var toIn = opts.toIn || factor(LENGTH, opts.dUom, 'IN');
    var toLb = opts.toLb || factor(WEIGHT, opts.wUom, 'LB');
    var rows = lines.map(function (ln) {
      var qty = Math.max(1, Math.round(ln.qty || 1));
      var cuIn = ln.l * toIn * ln.w * toIn * ln.h * toIn;          // one piece
      var cuFt = cuIn / 1728 * qty;
      var lbs = ln.weight * toLb * (opts.weightPer === 'line' ? 1 : qty);
      var density = cuFt > 0 ? lbs / cuFt : 0;
      return { src: ln, qty: qty, toIn: toIn, toLb: toLb, cuInPiece: cuIn, cuFt: cuFt, lbs: lbs, density: density, cls: freightClass(density, opts.scale) };
    });
    var totFt = rows.reduce(function (s, r) { return s + r.cuFt; }, 0);
    var totLb = rows.reduce(function (s, r) { return s + r.lbs; }, 0);
    var dens = totFt > 0 ? totLb / totFt : 0;
    return {
      rows: rows,
      totals: { pieces: rows.reduce(function (s, r) { return s + r.qty; }, 0), cuFt: totFt, lbs: totLb, density: dens, cls: freightClass(dens, opts.scale) }
    };
  }

  /* ---------- Special characters ---------- */
  // First group mirrors the carrier special-character table (/ERPIS/CHARS2) and is preselected.
  var CHAR_SETS = [
    { id: 'carrier', label: 'Carrier table (/ERPIS/CHARS2)', chars: "# $ % & ' ( ) * < > @ ^" },
    { id: 'punct', label: 'Other punctuation', chars: '! " + , - . / : ; = ? [ \\ ] _ ` { | } ~' },
    { id: 'accent', label: 'Accented letters', chars: 'á é í ó ú ñ ü ç à è ê ô ö ä ß ø å Ñ É Ü' },
    { id: 'sym', label: 'Symbols', chars: '° ± § © ® ™ € £ ¥ ½ ² ¿ ¡' },
    { id: 'quotes', label: 'Smart quotes & dashes', chars: '‘ ’ “ ” – — …' },
    { id: 'ws', label: 'Whitespace', chars: '[SP] [NBSP] [TAB]' },
    { id: 'nonlatin', label: 'Non-Latin', chars: '東 京 中 文 Ж Ω' }
  ];
  var WS_TOKENS = { '[SP]': ' ', '[NBSP]': ' ', '[TAB]': '\t', '[2SP]': '  ' };

  function parseChars(str) {
    return String(str || '').split(/ +/).filter(Boolean).map(function (t) {
      return WS_TOKENS[t] !== undefined ? WS_TOKENS[t] : t;
    });
  }

  // A value is kept as segments so the UI can highlight what was injected.
  function toSegments(text) { return [{ t: String(text), inj: false }]; }
  function segText(segs) { return segs.map(function (s) { return s.t; }).join(''); }
  function segLength(segs) { return Array.from(segText(segs)).length; }

  // Insert `str` at code-point index `idx` of the flattened segments.
  function insertSeg(segs, idx, str) {
    // Never split an earlier injection (e.g. a double space): snap to its end
    var p = 0;
    segs.forEach(function (s) {
      var n = Array.from(s.t).length;
      if (s.inj && idx > p && idx < p + n) idx = p + n;
      p += n;
    });
    var out = [], pos = 0, done = false;
    segs.forEach(function (s) {
      var cps = Array.from(s.t);
      if (!done && idx <= pos + cps.length) {
        var cut = idx - pos;
        if (cut > 0) out.push({ t: cps.slice(0, cut).join(''), inj: s.inj });
        out.push({ t: str, inj: true });
        if (cut < cps.length) out.push({ t: cps.slice(cut).join(''), inj: s.inj });
        done = true;
      } else {
        out.push(s);
      }
      pos += cps.length;
    });
    if (!done) out.push({ t: str, inj: true });
    return out.filter(function (s) { return s.t.length; });
  }

  /* position: 'start' | 'middle' | 'end'
   * Middle picks a random interior index, so the character lands in a
   * different spot each time (beginning of a word, inside a word, next to a space). */
  function injectSeg(segs, str, position, rng) {
    var len = segLength(segs);
    var idx;
    if (position === 'start') idx = 0;
    else if (position === 'end') idx = len;
    else idx = len < 2 ? len : rng.int(1, len - 1);
    return insertSeg(segs, idx, str);
  }

  function inject(text, str, position, rng) {
    return segText(injectSeg(toSegments(text), str, position, rng));
  }

  function utf8Bytes(s) {
    var n = 0;
    for (var ch of String(s)) {
      var c = ch.codePointAt(0);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    return n;
  }

  function xmlEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function codePoints(s) {
    return Array.from(String(s)).map(function (ch) {
      return 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    }).join(' ');
  }

  // Readable label for invisible characters
  function visible(s) {
    return String(s).replace(/ /g, '⍽').replace(/\t/g, '⇥').replace(/ /g, '␣');
  }

  /* ---------- Export helpers ---------- */
  function csvCell(v) {
    var s = v === undefined || v === null ? '' : String(v);
    return /[",\n\r\t]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows) {
    // BOM so Excel opens UTF-8 accents correctly
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }
  function toTSV(rows) {
    return rows.map(function (r) {
      return r.map(function (v) { return String(v === undefined || v === null ? '' : v).replace(/[\t\r\n]/g, ' '); }).join('\t');
    }).join('\n');
  }

  return {
    createRng: createRng, newSeed: newSeed, roundTo: roundTo, fmt: fmt,
    WEIGHT: WEIGHT, LENGTH: LENGTH, factor: factor, factorText: factorText,
    convertWeight: convertWeight, convertLength: convertLength,
    DIM_DIVISORS: DIM_DIVISORS, convertHUs: convertHUs,
    FREIGHT_SCALES: FREIGHT_SCALES, freightClass: freightClass, calcFreight: calcFreight,
    CHAR_SETS: CHAR_SETS, parseChars: parseChars,
    toSegments: toSegments, segText: segText, segLength: segLength,
    insertSeg: insertSeg, injectSeg: injectSeg, inject: inject,
    utf8Bytes: utf8Bytes, xmlEscape: xmlEscape, codePoints: codePoints, visible: visible,
    toCSV: toCSV, toTSV: toTSV
  };
});
