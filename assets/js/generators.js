/* Address and handling-unit generators. Pure functions, no DOM. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'), require('./data.js'));
  } else {
    root.SEGen = factory(root.SECore, root.SEData);
  }
})(typeof self !== 'undefined' ? self : this, function (Core, Data) {
  'use strict';

  var FIELDS = [
    'name', 'attention', 'addr1', 'houseNum', 'supp', 'addr2', 'addr3', 'addr4',
    'suburb', 'city', 'region', 'postcode', 'country', 'phone', 'fax', 'customerNo', 'email'
  ];
  var FIELD_LABELS = {
    name: 'Name', attention: 'Attention', addr1: 'Addr 1', houseNum: 'House Num', supp: 'Supp',
    addr2: 'Addr 2', addr3: 'Addr 3', addr4: 'Addr 4', suburb: 'Suburb', city: 'City',
    region: 'State', postcode: 'PostCode', country: 'Ctry', phone: 'Phone', fax: 'Fax',
    customerNo: 'Customer #', email: 'Email'
  };
  // Fields that can receive special characters
  var INJECTABLE = FIELDS.filter(function (f) { return f !== 'customerNo'; });

  var PARTNERS = [
    { id: 'soldTo', label: 'Sold To', side: 'to', optional: true },
    { id: 'shipFrom', label: 'Ship From', side: 'from', optional: false },
    { id: 'shipTo', label: 'Ship To', side: 'to', optional: false },
    { id: 'importer', label: 'Importer', side: 'to', optional: true },
    { id: 'ultimate', label: 'Ultimate Consignee', side: 'to', optional: true }
  ];

  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function fillTemplate(rng, tpl) {
    return tpl.replace(/#/g, function () { return rng.digit(); });
  }

  function genAddress(rng, cc, partnerId, opts, customerNo) {
    var c = Data.COUNTRIES[cc];
    var row = rng.pick(c.cities);
    var city = row[0], region = row[1], postcode = row[2], phoneTpl = row[3];
    var suburbs = row[4] && row[4].length ? row[4] : (c.suburbs || []);
    var streets = row[5] && row[5].length ? row[5] : c.streets;
    var names = Data.NAMES[c.locale];
    var first = rng.pick(names.first), last = rng.pick(names.last);

    var style = opts.nameStyle || 'mixed';
    var isCompany = style === 'company' || (style === 'mixed' && rng.bool(0.6));
    var name = isCompany
      ? rng.pick(Data.COMPANY_PREFIX) + ' ' + rng.pick(Data.COMPANY_NOUN) + ' ' + rng.pick(c.suffixes)
      : first + ' ' + last;
    if (opts.namePrefix) name = opts.namePrefix + name;
    var attention = isCompany && rng.bool(0.7) ? first + ' ' + last : rng.pick(Data.DEPARTMENTS);

    var street = rng.pick(streets);
    var house = c.houseNum === 'jp'
      ? rng.int(1, 5) + '-' + rng.int(1, 20) + '-' + rng.int(1, 30)
      : String(rng.int(c.houseNum[0], c.houseNum[1]));

    var a = {
      name: name, attention: attention, addr1: '', houseNum: '', supp: '',
      addr2: '', addr3: '', addr4: '', suburb: '', city: city, region: region,
      postcode: postcode, country: cc, phone: fillTemplate(rng, phoneTpl), fax: '',
      customerNo: customerNo || '', email: ''
    };

    if (opts.houseSeparate) {
      a.addr1 = street;
      a.houseNum = house;
      if (opts.fillSupp) a.supp = rng.pick(['A', 'B', 'C', '1/2', 'Rear']);
    } else {
      a.addr1 = c.numberFirst ? house + ' ' + street : street + ' ' + house;
    }
    if (opts.fillAddr2) a.addr2 = rng.pick(c.addr2);
    if (opts.fillAddr34) {
      a.addr3 = rng.pick(Data.ADDR_EXTRA);
      do { a.addr4 = rng.pick(Data.ADDR_EXTRA); } while (a.addr4 === a.addr3);
    }
    if (opts.fillSuburb && suburbs.length) a.suburb = rng.pick(suburbs);
    else if (opts.forceSuburb) a.suburb = rng.pick(Data.GENERIC_SUBURBS);
    if (opts.fillFax) a.fax = fillTemplate(rng, phoneTpl);
    a.email = slug(first) + '.' + slug(last) + '@' + rng.pick(Data.EMAIL_DOMAINS);
    return a;
  }

  function otherCountry(rng, exclude) {
    var codes = Object.keys(Data.COUNTRIES).filter(function (k) { return k !== exclude; });
    return rng.pick(codes);
  }

  /* opts: {
   *   count, from, to ('RANDOM' or ISO code), forceIntl, partners: [ids of optional partners],
   *   nameStyle, namePrefix, houseSeparate, fillSupp, fillAddr2, fillAddr34, fillSuburb, fillFax,
   *   custPrefix, custStart,
   *   special: see applySpecialChars
   * } */
  function generateAddressSets(seed, opts) {
    var rng = Core.createRng(seed);
    var codes = Object.keys(Data.COUNTRIES);
    var sets = [];
    var cust = Number(opts.custStart) || 1;
    var custWidth = String(opts.custStart || '1').length;
    var charQueue = [];

    for (var i = 0; i < opts.count; i++) {
      var from = opts.from === 'RANDOM' ? rng.pick(codes) : opts.from;
      var to = opts.to === 'RANDOM' ? rng.pick(codes) : opts.to;
      if (opts.forceIntl && from === to) {
        if (opts.to === 'RANDOM') to = otherCountry(rng, from);
        else if (opts.from === 'RANDOM') from = otherCountry(rng, to);
      }

      var partners = PARTNERS.filter(function (p) {
        return !p.optional || (opts.partners || []).indexOf(p.id) >= 0;
      });
      var set = { index: i + 1, from: from, to: to, partners: [] };
      partners.forEach(function (p) {
        var cc = p.side === 'from' ? from : to;
        var custNo = p.id === 'shipFrom' ? '' : (opts.custPrefix || '') + String(cust++).padStart(custWidth, '0');
        var plain = genAddress(rng, cc, p.id, opts, custNo);
        var segs = {};
        FIELDS.forEach(function (f) { segs[f] = Core.toSegments(plain[f]); });
        set.partners.push({ id: p.id, label: p.label, country: cc, fields: segs });
      });

      applySpecialChars(rng, set, opts.special, charQueue);
      sets.push(set);
    }
    return sets;
  }

  /* sp: { enabled, chars[], positions[], fields[], apply: 'from'|'to'|'both'|'all', perField, together }
   * Characters are drawn from a shuffled queue that refills only when empty, so
   * every selected character is used before any repeats (even coverage). */
  function applySpecialChars(rng, set, sp, queue) {
    if (!sp || !sp.enabled || !sp.chars.length || !sp.positions.length || !sp.fields.length) return;
    function nextChar() {
      if (!queue.length) {
        var fresh = sp.chars.slice();
        for (var i = fresh.length - 1; i > 0; i--) {
          var j = Math.floor(rng.next() * (i + 1));
          var t = fresh[i]; fresh[i] = fresh[j]; fresh[j] = t;
        }
        Array.prototype.push.apply(queue, fresh);
      }
      return queue.shift();
    }
    set.partners.forEach(function (p) {
      var hit = sp.apply === 'all' ||
        (sp.apply === 'both' && (p.id === 'shipFrom' || p.id === 'shipTo')) ||
        (sp.apply === 'from' && p.id === 'shipFrom') ||
        (sp.apply === 'to' && p.id === 'shipTo');
      if (!hit) return;
      sp.fields.forEach(function (f) {
        if (!Core.segText(p.fields[f])) return;
        var n = Math.max(1, sp.perField || 1);
        var chars = Array.from({ length: n }, nextChar);
        if (sp.together) {
          p.fields[f] = Core.injectSeg(p.fields[f], chars.join(''), rng.pick(sp.positions), rng);
        } else {
          chars.forEach(function (ch) {
            p.fields[f] = Core.injectSeg(p.fields[f], ch, rng.pick(sp.positions), rng);
          });
        }
      });
    });
  }

  function flatten(partner) {
    var out = {};
    FIELDS.forEach(function (f) { out[f] = Core.segText(partner.fields[f]); });
    return out;
  }

  /* ---------- Handling units ---------- */
  var DEFAULT_RANGES = {
    weight: { LB: [1, 150], KG: [0.5, 68], G: [100, 20000], OZ: [2, 160] },
    length: { IN: [4, 48], CM: [10, 120], MM: [100, 1200], M: [0.1, 1.2], FT: [0.5, 4] }
  };
  var MIX_PAIRS = [['LB', 'IN'], ['KG', 'CM']];

  /* opts: { count, wUom, dUom, mixed, wMin, wMax, wDp, dMin, dMax, dDp, identical, idPrefix, idStart } */
  function generateHUs(seed, opts) {
    var rng = Core.createRng(seed);
    var hus = [];
    var start = Number(opts.idStart) || 1;
    var width = String(opts.idStart || '1').length;
    var template = null;

    for (var i = 0; i < opts.count; i++) {
      var hu;
      if (opts.identical && template) {
        hu = Object.assign({}, template);
      } else {
        hu = {
          weight: rng.float(opts.wMin, opts.wMax, opts.wDp),
          l: rng.float(opts.dMin, opts.dMax, opts.dDp),
          w: rng.float(opts.dMin, opts.dMax, opts.dDp),
          h: rng.float(opts.dMin, opts.dMax, opts.dDp),
          wUom: opts.wUom, dUom: opts.dUom
        };
        if (opts.mixed) {
          // Generate in the chosen UoM, then express this HU in a random UoM pair
          // so magnitudes stay realistic.
          var pair = rng.pick(MIX_PAIRS);
          if (pair[0] !== hu.wUom) {
            hu.weight = Math.max(Core.roundTo(Core.convertWeight(hu.weight, hu.wUom, pair[0]), opts.wDp, 'half-up'), Math.pow(10, -opts.wDp));
            hu.wUom = pair[0];
          }
          if (pair[1] !== hu.dUom) {
            ['l', 'w', 'h'].forEach(function (k) {
              hu[k] = Math.max(Core.roundTo(Core.convertLength(hu[k], hu.dUom, pair[1]), opts.dDp, 'half-up'), Math.pow(10, -opts.dDp));
            });
            hu.dUom = pair[1];
          }
        }
        template = hu;
      }
      hu.id = (opts.idPrefix || '') + String(start + i).padStart(width, '0');
      hus.push(hu);
    }
    return hus;
  }

  return {
    FIELDS: FIELDS, FIELD_LABELS: FIELD_LABELS, INJECTABLE: INJECTABLE, PARTNERS: PARTNERS,
    generateAddressSets: generateAddressSets, flatten: flatten,
    DEFAULT_RANGES: DEFAULT_RANGES, generateHUs: generateHUs
  };
});
