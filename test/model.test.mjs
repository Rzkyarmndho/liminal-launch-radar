import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../dashboard/model.js').catch(() => null);

test('the estimator ranks snapshot records and covers the watchlist', () => {
  assert.ok(module, 'missing feature: the snapshot estimator has not been implemented');
  const snapshot = { as_of: '2026-11-14', source: 'synthetic test fixture', floor_usd: 50000000,
    watchlist: ['small'], protocols: [
      {slug:'small',name:'Small',category:'Lending',chains:['Base'],tvl_usd:10000000,change_7d:2,mcap_usd:null,listed_at:'2025-01-01',symbol:null,gecko_id:null},
      {slug:'large',name:'Large',category:'Lending',chains:['Ethereum'],tvl_usd:100000000,change_7d:2,mcap_usd:80000000,listed_at:'2025-01-01',symbol:'LARGE',gecko_id:'large'}
    ]};
  const result = module.estimateBoard(snapshot);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map(r => r.rank), [1,2]);
  assert.ok(result.rows[0].implied_value_usd >= result.rows[1].implied_value_usd);
  assert.equal(result.rows.find(r => r.slug === 'small').token_status, 'unrecorded');
  assert.equal(result.rows.find(r => r.slug === 'large').token_status, 'recorded');
  assert.equal(result.model.coverage.watchlist_covered, 1);
});

test('the empirical model is evaluated out of sample by distinct token groups', () => {
  const peers = Array.from({length:28}, (_,i) => ({
    slug:`peer-${i}`, name:`Peer ${i}`, category:i % 2 ? 'Lending' : 'Dexs',
    chains:['Base'], tvl_usd:Math.round(8000000 * 1.18 ** i),
    change_7d:i * 2 - 16,
    mcap_usd:Math.round(7000000 * 1.26 ** i),
    listed_at:'2025-01-01', gecko_id:`token-${i}`,symbol:`P${i}`
  }));
  const copy = {...peers[0],slug:'peer-0-copy',tvl_usd:1000000};
  const result = module.estimateBoard({as_of:'2026-11-14',source:'synthetic fixture',
    floor_usd:50000000,protocols:[...peers,copy],watchlist:[]});
  const m = result.model;
  assert.equal(m.training_tokens,28,'versions of one token must not leak into separate folds');
  assert.equal(m.validation.groups,28);
  assert.ok(m.validation.model_factor_error >= 1);
  assert.ok(m.validation.model_factor_error < m.validation.baseline_factor_error,
    'synthetic covariate signal must outperform a global-ratio control');
  assert.ok(m.assumptions.some(a => a.includes('not tokenless age')));
});

test('farm plans are costed scenarios and exclude exchange records from launch candidates', () => {
  const p={slug:'vault',name:'Example vault',category:'Yield',chains:['Base'],tvl_usd:100000000,change_7d:10,mcap_usd:null,listed_at:'2025-01-01',symbol:null,gecko_id:null};
  const exchange={...p,slug:'exchange',name:'Example exchange',category:'CEX'};
  const d=module.estimateBoard({as_of:'2026-11-14',source:'synthetic fixture',floor_usd:50000000,protocols:[p,exchange],watchlist:['vault']});
  for (const row of d.rows) {
    assert.ok(row.plan,'costed category playbook missing');
    assert.ok(row.farm_steps.length>=3 && row.farm_steps.length<=12);
    assert.ok(row.farm_steps.every(s=>s.trim().length>=20 && s.length<=600));
    assert.ok(Number.isFinite(row.plan.scenario_net_usd));
    assert.ok(row.plan.cautions.some(s=>s.includes('not verified')));
  }
  assert.equal(d.rows.find(r=>r.slug==='exchange').radar_eligible,false);
  assert.equal(d.rows.find(r=>r.slug==='exchange').plan.verdict,'skip');
  assert.equal(d.rows.find(r=>r.slug==='vault').radar_eligible,true);
});
