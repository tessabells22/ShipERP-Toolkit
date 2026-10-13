// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../assets/js/core.js');
const Data = require('../assets/js/data.js');
const Gen = require('../assets/js/generators.js');

test('exact conversion factors', () => {
  assert.equal(Core.convertWeight(1, 'LB', 'KG'), 0.45359237);
  assert.equal(Core.convertLength(1, 'IN', 'CM'), 2.54);
  assert.equal(Core.roundTo(Core.convertWeight(10, 'KG', 'LB'), 2), 22.05);
  assert.equal(Core.roundTo(Core.convertLength(50, 'CM', 'IN'), 2), 19.69);
  assert.equal(Core.roundTo(Core.convertWeight(16, 'OZ', 'LB'), 6), 1);
  assert.equal(Core.roundTo(Core.convertLength(1, 'FT', 'IN'), 6), 12);
});

test('rounding modes', () => {
  assert.equal(Core.roundTo(1.005, 2), 1.01); // binary-noise case
  assert.equal(Core.roundTo(2.345, 2, 'half-even'), 2.34);
  assert.equal(Core.roundTo(2.355, 2, 'half-even'), 2.36);
  assert.equal(Core.roundTo(2.341, 2, 'up'), 2.35);
  assert.equal(Core.roundTo(2.349, 2, 'down'), 2.34);
  assert.equal(Core.roundTo(2.5, 0), 3);
});

test('seeded rng is reproducible', () => {
  const a = Core.createRng(42), b = Core.createRng(42);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
  const r = Core.createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.float(1.5, 2.5, 1);
    assert.ok(v >= 1.5 && v <= 2.5, String(v));
  }
});

test('special char injection positions', () => {
  const rng = Core.createRng(1);
  assert.equal(Core.inject('Airport', '#', 'start', rng), '#Airport');
  assert.equal(Core.inject('Airport', '#', 'end', rng), 'Airport#');
  for (let i = 0; i < 100; i++) {
    const v = Core.inject('Airport', 'é', 'middle', rng);
    assert.equal(v.length, 8);
    assert.ok(!v.startsWith('é') && !v.endsWith('é'), v);
  }
  // Highlight segments survive multiple injections and never split an earlier one
  let segs = Core.toSegments('Main');
  segs = Core.injectSeg(segs, '  ', 'middle', rng);
  for (let i = 0; i < 20; i++) segs = Core.injectSeg(segs, '&', 'middle', rng);
  assert.ok(Core.segText(segs).includes('  '));
  assert.equal(Core.segText(segs).replace(/[& ]/g, ''), 'Main');
  assert.deepEqual(Core.parseChars('[NBSP] & é'), [' ', '&', 'é']);
  assert.equal(Core.utf8Bytes('é'), 2);
  assert.equal(Core.utf8Bytes('東'), 3);
});

test('HU conversion totals and dim weight', () => {
  const hus = [
    { id: '1', weight: 10.25, wUom: 'KG', l: 50, w: 40, h: 30, dUom: 'CM' },
    { id: '2', weight: 3.333, wUom: 'KG', l: 20, w: 20, h: 20, dUom: 'CM' }
  ];
  const out = Core.convertHUs(hus, { toW: 'LB', toD: 'IN', wDp: 2, dDp: 2, mode: 'half-up', dimWeight: true, divisor: 139, roundDimsUp: true });
  assert.equal(out.rows[0].weight, 22.6);   // 10.25 * 2.20462262 = 22.597
  assert.equal(out.rows[1].weight, 7.35);   // 3.333 * 2.20462262 = 7.348
  assert.deepEqual(out.rows[0].dims.map(d => d.value), [19.69, 15.75, 11.81]);
  assert.deepEqual(out.rows[0].dimCalcDims, [20, 16, 12]);
  assert.equal(out.rows[0].dimWeight, 27.63); // 3840 / 139
  assert.equal(out.rows[0].billable, 27.63);
  assert.equal(out.totals.sumOfRounded, 29.95);
  assert.equal(out.totals.roundedOfSum, 29.95);
});

test('address sets: international, reproducible, valid data', () => {
  const opts = {
    count: 25, from: 'RANDOM', to: 'RANDOM', forceIntl: true, partners: ['soldTo', 'importer', 'ultimate'],
    nameStyle: 'mixed', houseSeparate: true, fillSupp: true, fillAddr2: true, fillAddr34: true, fillSuburb: true, fillFax: true,
    custPrefix: 'TSTCUS', custStart: '001',
    special: { enabled: true, chars: ['&', 'é', '#'], positions: ['start', 'middle', 'end'], fields: ['name', 'addr1', 'city'], apply: 'both', perField: 3, together: false }
  };
  const a = Gen.generateAddressSets(99, opts);
  const b = Gen.generateAddressSets(99, opts);
  assert.deepEqual(a, b);
  a.forEach(set => {
    assert.notEqual(set.from, set.to);
    assert.equal(set.partners.length, 5);
    const to = Gen.flatten(set.partners.find(p => p.id === 'shipTo'));
    assert.ok(/@example\.(com|net|org)$/.test(to.email), to.email);
    assert.ok(/^TSTCUS\d{3}$/.test(to.customerNo), to.customerNo);
    assert.ok(!/#/.test(to.phone));
    const nameSegs = set.partners.find(p => p.id === 'shipTo').fields.name;
    assert.equal(nameSegs.filter(s => s.inj).length, 3);
  });
});

test('every city row is well-formed', () => {
  Object.entries(Data.COUNTRIES).forEach(([cc, c]) => {
    assert.ok(Data.NAMES[c.locale], cc);
    c.cities.forEach(row => {
      assert.ok(row[0] && row[2] && row[3].includes('#'), cc + ' ' + row[0]);
      const streets = row[5] && row[5].length ? row[5] : c.streets;
      assert.ok(streets && streets.length, cc + ' streets');
      assert.ok(row[1].length <= 3, cc + ' region > 3 chars');
    });
  });
});

test('HU generation respects ranges and mixed UoM', () => {
  const hus = Gen.generateHUs(5, { count: 10, wUom: 'KG', dUom: 'CM', mixed: true, wMin: 1, wMax: 30, wDp: 2, dMin: 10, dMax: 100, dDp: 1, idPrefix: 'HU', idStart: '0001' });
  assert.equal(hus.length, 10);
  assert.equal(hus[0].id, 'HU0001');
  hus.forEach(h => {
    assert.ok(['KG', 'LB'].includes(h.wUom));
    assert.ok(h.weight > 0);
  });
});

test('special chars: clustered injection and full coverage', () => {
  const chars = ['#', '$', '%', '&', "'", '(', ')', '*', '<', '>', '@', '^'];
  const sets = Gen.generateAddressSets(3, {
    count: 2, from: 'US', to: 'CA', forceIntl: true, partners: [], nameStyle: 'company', houseSeparate: true,
    fillAddr2: true, fillSuburb: true, custPrefix: 'C', custStart: '001',
    special: { enabled: true, chars, positions: ['end'], fields: ['addr1', 'addr2', 'city'], apply: 'both', perField: 2, together: true }
  });
  const used = new Set();
  sets.forEach(set => set.partners.forEach(p => ['addr1', 'addr2', 'city'].forEach(f => {
    const inj = p.fields[f].filter(s => s.inj);
    assert.equal(inj.length, 1, 'one cluster per field');
    assert.equal(Array.from(inj[0].t).length, 2);
    assert.ok(Core.segText(p.fields[f]).endsWith(inj[0].t));
    Array.from(inj[0].t).forEach(c => used.add(c));
  })));
  // 2 sets x 2 partners x 3 fields x 2 chars = 24 draws: every one of the 12 chars must appear
  assert.equal(used.size, chars.length);
});

test('special chars: every field except Customer # can be targeted', () => {
  assert.ok(!Gen.INJECTABLE.includes('customerNo'));
  ['email', 'phone', 'fax', 'postcode', 'region', 'country', 'houseNum', 'supp', 'suburb'].forEach(f => assert.ok(Gen.INJECTABLE.includes(f), f));
  const fields = Gen.INJECTABLE;
  const sets = Gen.generateAddressSets(11, {
    count: 1, from: 'US', to: 'CA', forceIntl: true, partners: [], nameStyle: 'company', houseSeparate: true,
    fillAddr2: true, fillAddr34: true, fillSupp: true, fillFax: true, fillSuburb: true, forceSuburb: true,
    custPrefix: 'C', custStart: '001',
    special: { enabled: true, chars: ['#'], positions: ['end'], fields, apply: 'both', perField: 1, together: true }
  });
  sets[0].partners.forEach(p => {
    fields.forEach(f => assert.ok(Core.segText(p.fields[f]).endsWith('#'), p.id + ' ' + f + ' = ' + Core.segText(p.fields[f])));
    assert.ok(!Core.segText(p.fields.customerNo).includes('#'));
  });
});

test('freight class: density and class lookup', () => {
  // 48x40x48 in pallet, 500 lb: 53.333 ft3, 9.375 PCF
  const out = Core.calcFreight([{ qty: 1, l: 48, w: 40, h: 48, weight: 500 }], { dUom: 'IN', wUom: 'LB', weightPer: 'piece', scale: 'classic' });
  assert.equal(Core.roundTo(out.rows[0].cuFt, 3), 53.333);
  assert.equal(Core.roundTo(out.totals.density, 3), 9.375);
  assert.equal(out.totals.cls, '100');
  assert.equal(Core.freightClass(9.375, 'nmfc2025'), '100');
  // Boundaries take the lower class; extremes
  assert.equal(Core.freightClass(15, 'classic'), '70');
  assert.equal(Core.freightClass(14.99, 'classic'), '77.5');
  assert.equal(Core.freightClass(0.5, 'classic'), '500');
  assert.equal(Core.freightClass(60, 'classic'), '50');
  assert.equal(Core.freightClass(0.5, 'nmfc2025'), '400');
  // Quantity and per-line weight; metric input converts to the same answer
  const two = Core.calcFreight([{ qty: 2, l: 48, w: 40, h: 48, weight: 1000 }], { dUom: 'IN', wUom: 'LB', weightPer: 'line', scale: 'classic' });
  assert.equal(Core.roundTo(two.totals.density, 3), 9.375);
  const metric = Core.calcFreight([{ qty: 1, l: 121.92, w: 101.6, h: 121.92, weight: 226.796185 }], { dUom: 'CM', wUom: 'KG', weightPer: 'piece', scale: 'classic' });
  assert.equal(Core.roundTo(metric.totals.density, 3), 9.375);
});

test('freight: unit factor overrides (yards, tonnes, custom)', () => {
  // 48x40x48 in = 1.3333 x 1.1111 x 1.3333 yd; 500 lb = 0.226796185 t
  const out = Core.calcFreight([{ qty: 1, l: 48 / 36, w: 40 / 36, h: 48 / 36, weight: 0.226796185 }],
    { dUom: 'YD', wUom: 'T', toIn: 36, toLb: 2204.62262185, weightPer: 'piece', scale: 'classic' });
  assert.equal(Core.roundTo(out.totals.density, 3), 9.375);
  assert.equal(out.totals.cls, '100');
});

test('address length edge cases hit the SAP limit exactly (or +1), special chars included', () => {
  const base = { count: 2, from: 'US', to: 'MX', forceIntl: true, partners: [], nameStyle: 'mixed', houseSeparate: true,
    fillAddr2: true, fillAddr34: true, fillSuburb: true, forceSuburb: true, custPrefix: 'C', custStart: '001' };
  const sp = { enabled: true, chars: ['#', '$'], positions: ['end'], fields: ['addr1', 'city'], apply: 'both', perField: 2, together: true };
  ['max', 'over'].forEach(mode => {
    const sets = Gen.generateAddressSets(5, Object.assign({}, base, { lengthMode: mode, special: sp }));
    const extra = mode === 'over' ? 1 : 0;
    sets.forEach(set => set.partners.forEach(p => Gen.LENGTH_FIELDS.forEach(f => {
      const v = Core.segText(p.fields[f]);
      if (v) assert.equal(Array.from(v).length, Gen.MAX_LEN[f] + extra, mode + ' ' + f + ': ' + v);
      assert.ok(!/\s$/.test(v));
    })));
  });
});

test('HU edge values', () => {
  const base = { count: 5, wUom: 'KG', dUom: 'CM', wMin: 1, wMax: 30, wDp: 2, dMin: 10, dMax: 100, dDp: 1, idPrefix: 'HU', idStart: '1',
    target: { toW: 'LB', toD: 'IN', wDp: 2, dDp: 2, divisor: 139, roundDimsUp: true, mode: 'half-up' } };
  const min = Gen.generateHUs(1, Object.assign({}, base, { edge: 'min' }));
  assert.equal(min[0].weight, 0.01); assert.equal(min[0].l, 0.1);
  const max = Gen.generateHUs(1, Object.assign({}, base, { edge: 'max' }));
  assert.equal(max[0].weight, 30); assert.equal(max[0].h, 100);
  // Boundary: converted weight sits near a .xx5 half-step
  Gen.generateHUs(2, Object.assign({}, base, { edge: 'boundary' })).forEach(h => {
    const x = Core.convertWeight(h.weight, 'KG', 'LB') * 100;
    assert.ok(Math.abs(x - Math.floor(x) - 0.5) < 0.05, String(x));
  });
  // Dim weight ~= actual weight once converted
  Gen.generateHUs(3, Object.assign({}, base, { edge: 'dimeq' })).forEach(h => {
    const out = Core.convertHUs([h], { toW: 'LB', toD: 'IN', wDp: 2, dDp: 2, mode: 'half-up', dimWeight: true, divisor: 139, roundDimsUp: true });
    const r = out.rows[0];
    assert.ok(Math.abs(r.weight - r.dimWeight) <= 0.03, r.weight + ' vs ' + r.dimWeight);
  });
});
