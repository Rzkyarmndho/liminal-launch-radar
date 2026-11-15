const DAY = 86400000;
const CAP = 100000000000000;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, digits = 3) => Number(n.toFixed(digits));
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
const recorded = p => Boolean(p.gecko_id || p.symbol);
const dollars = n => Math.max(1, Math.min(CAP, Math.round(n)));
const age = (p, asOf) => {
  if (!p.listed_at) return null;
  const days = Math.floor((Date.parse(asOf) - Date.parse(p.listed_at)) / DAY);
  return Number.isFinite(days) && days >= 0 ? days : null;
};
const tokenKey = p => String(p.gecko_id || p.symbol || p.slug).toLowerCase();
const category = p => p.category || 'Unclassified';
const features = (p, asOf, imputedAge) => [1, Math.log(Math.max(1,p.tvl_usd) / 1e8),
  Math.asinh(clamp(Number(p.change_7d) || 0,-100,300) / 20),
  Math.log1p((age(p,asOf) ?? imputedAge) / 365), Math.log1p(p.chains.length)];
const dot = (x, y) => x.reduce((sum, n, i) => sum + n * y[i], 0);

function solve(matrix, vector) {
  const a = matrix.map((row,i) => [...row,vector[i]]), n = vector.length;
  for (let col=0;col<n;col++) {
    let pivot=col;
    for (let row=col+1;row<n;row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot=row;
    [a[col],a[pivot]]=[a[pivot],a[col]];
    if (Math.abs(a[col][col]) < 1e-12) continue;
    const divisor=a[col][col];
    for (let j=col;j<=n;j++) a[col][j]/=divisor;
    for (let row=0;row<n;row++) {
      if (row===col) continue;
      const multiplier=a[row][col];
      for (let j=col;j<=n;j++) a[row][j]-=multiplier*a[col][j];
    }
  }
  return a.map(row => row[n]);
}

// Fit one representative per token, not every fork or version that shares its ticker.
function uniquePeers(protocols) {
  const map=new Map();
  for (const p of protocols) {
    if (!recorded(p) || !(p.mcap_usd>0) || !(p.tvl_usd>0)) continue;
    const key=tokenKey(p), prior=map.get(key);
    if (!prior || p.tvl_usd>prior.tvl_usd || (p.tvl_usd===prior.tvl_usd && p.slug<prior.slug)) map.set(key,p);
  }
  return [...map.values()].sort((a,b) => a.slug<b.slug?-1:a.slug>b.slug?1:0);
}

function fitCore(peers, asOf) {
  const imputedAge=median(peers.map(p => age(p,asOf)).filter(n => n!==null));
  const ratios=peers.map(p => Math.log(p.mcap_usd/p.tvl_usd));
  const baseline=peers.length?median(ratios):Math.log(0.2);
  const beta=[Math.log(1e8)+baseline,1,0,0,0];
  const offsets={};
  if (peers.length<8) return {beta,offsets,imputedAge,baseline};
  const X=peers.map(p => features(p,asOf,imputedAge));
  const Y=peers.map(p => Math.log(p.mcap_usd));
  let weights=peers.map(() => 1), fitted=beta;
  const penalty=[0.001,2,8,8,8];
  for (let iteration=0;iteration<5;iteration++) {
    const A=Array.from({length:5},()=>Array(5).fill(0)), B=Array(5).fill(0);
    for (let i=0;i<X.length;i++) for(let j=0;j<5;j++) {
      B[j]+=weights[i]*X[i][j]*Y[i];
      for(let k=0;k<5;k++) A[j][k]+=weights[i]*X[i][j]*X[i][k];
    }
    for(let j=0;j<5;j++) {A[j][j]+=penalty[j]; B[j]+=penalty[j]*beta[j];}
    fitted=solve(A,B);
    const residuals=Y.map((y,i)=>y-dot(X[i],fitted));
    const center=median(residuals);
    const scale=Math.max(0.25,1.4826*median(residuals.map(r=>Math.abs(r-center))));
    weights=residuals.map(r=>Math.min(1,1.345*scale/Math.max(0.001,Math.abs(r-center))));
  }
  const byCategory=new Map();
  peers.forEach((p,i) => {
    const key=category(p), values=byCategory.get(key)||[];
    values.push(clamp(Y[i]-dot(X[i],fitted),-3,3));byCategory.set(key,values);
  });
  for (const [key,values] of byCategory) offsets[key]=median(values)*values.length/(values.length+8);
  return {beta:fitted,offsets,imputedAge,baseline};
}
const predictLog=(core,p,asOf)=>dot(features(p,asOf,core.imputedAge),core.beta)+(core.offsets[category(p)]||0);

function validate(peers, asOf) {
  const errors=[],controls=[];
  for (let i=0;i<peers.length;i++) {
    const train=peers.filter((_,j)=>j!==i), core=fitCore(train,asOf), p=peers[i];
    errors.push(Math.abs(predictLog(core,p,asOf)-Math.log(p.mcap_usd)));
    controls.push(Math.abs(Math.log(p.tvl_usd)+core.baseline-Math.log(p.mcap_usd)));
  }
  const med=median(errors), base=median(controls);
  const selected=peers.length>=8 && med<=base ? 'huber-ridge' : 'global-ratio';
  const ordered=[...(selected==='huber-ridge'?errors:controls)].sort((a,b)=>a-b);
  const width=Math.max(Math.log(2),ordered[Math.floor((ordered.length-1)*0.8)]||Math.log(4));
  return {groups:peers.length,model_median_log_error:round(med),baseline_median_log_error:round(base),
    model_factor_error:round(Math.exp(med)),baseline_factor_error:round(Math.exp(base)),
    model_win_fraction:peers.length?round(errors.filter((e,i)=>e<controls[i]).length/peers.length):0,
    selected_method:selected,interval_log_width:clamp(width,Math.log(2),Math.log(100)),
    held_out_errors:errors.map((e,i)=>({token:tokenKey(peers[i]),model:round(e),baseline:round(controls[i])}))};
}

function farmPlan(p, implied, eligible) {
  const chain=[...p.chains].sort((a,b)=>(a==='Ethereum')-(b==='Ethereum') || (a<b?-1:1))[0] || 'unreported chain';
  const restricted=/CEX|RWA|Risk Curators|Insurance|Payments|Governance Incentives/.test(category(p));
  const pool=/Dexs|Yield|Lending|CDP|Liquidity|Collateral|Allocator|Restak|Staking|Basis|CeDeFi/.test(category(p));
  const skip=!eligible || !pool || restricted;
  const capital=skip?0:100;
  const txBudget=chain==='Ethereum'?12:0.5;
  const gas=skip?0:6*txBudget;
  const hours=skip?0.5:2;
  const horizon=28;
  const opportunity=capital*0.05*horizon/365;
  const research=hours*8;
  const bps=0.01;
  const gross=implied*bps/10000;
  const net=gross-gas-research-opportunity;
  const verdict=skip?'skip':net>0 && p.change_7d!==null && p.change_7d>-20?'pilot':'thin';
  const cautions=[
    'Reward eligibility, protocol terms and a launch are not verified by this snapshot. Validate them before spending.',
    'Gas and time are planning caps, not live quotes; capital may be lost entirely. No leveraged borrowing, wash volume or sybil accounts.',
    'Gross scenario assumes a fully realizable 0.01 basis-point share of the modeled circulating cap; allocation, price and liquidity are unknown.',
    'Research time is budgeted at $8/hour and capital opportunity cost at 5% annualized; both are replaceable assumptions.'
  ];
  if(restricted) cautions.push('Restricted or institutional category: access, KYC and retail incentive eligibility are unknown; start with research, not capital.');
  if(!eligible) cautions.push('Exchange, bridged or derivative token record is excluded from launch candidates; no missing-token arbitrage is inferred.');
  if(p.change_7d<-20) cautions.push('TVL contracted more than 20% in seven days: do not deploy fresh capital solely for speculative rewards.');
  const operation=/Lending|CDP/.test(category(p))?'supply one supported collateral asset without borrowing':
    /Dexs|Liquidity/.test(category(p))?'use a supported liquidity pair only if both assets are wanted and impermanent loss is acceptable':
    /Restak|Staking|Collateral/.test(category(p))?'inspect slash and unbonding conditions, then deposit only if the minimum fits the $100 budget':
    /Allocator|Yield|Basis|CeDeFi/.test(category(p))?'inspect the underlying vault strategy and fees, then make a single supported-asset deposit':'use one documented product action';
  const steps=skip?[
    `Day 0, 30 minutes, $0 gas: inspect ${p.name}'s official documentation and token/reward terms; the sealed record alone does not establish a tokenless product.`,
    `Day 0, $0 capital: check whether ${category(p)} access on ${chain} is permissionless and available in your jurisdiction; do not fake KYC or seek privileged access.`,
    'Day 7, 10 minutes, $0 gas: review official product and reward announcements; ignore unsolicited claim sites and do not pay for speculative access.',
    'Day 28, $0 capital: keep the row on the research watchlist only if eligibility is documented; otherwise skip farming. There is no demonstrated reward to claim.'
  ]:[
    `Day 0, 30 minutes, $0 gas: verify ${p.name}'s official product, eligible network ${chain}, published reward rules and current minimum deposit; if terms are absent, stop at research.`,
    `Day 1, 30 minutes: ${operation}; test a $20 deposit and full exit before committing the remaining $80; no bridge is included in the budget.`,
    `Day 1, gas cap $${txBudget.toFixed(2)} per action: approve only the intended amount, record the transaction and fee, and keep total principal at or below $100; abandon if minimum or fees exceed the cap.`,
    'Days 7, 14 and 21, 10 minutes each: inspect the position and documented points without churn; perform no unnecessary swaps, artificial volume or repeated deposit/withdraw cycles.',
    `Day 28, 20 minutes: withdraw only when the documented lock/unbond allows, revoke unused approvals and reconcile actual costs; the full plan caps six paid actions at $${gas.toFixed(2)} gas.`,
    `Before continuing: compare an illustrative ${bps} bp allocation ($${gross.toFixed(2)} gross) against $${(gas+research+opportunity).toFixed(2)} gas, research and opportunity cost; actual rewards may be zero and principal loss is not included in this scenario.`
  ];
  return {steps,plan:{verdict,capital_usd:capital,gas_usd:gas,time_hours:hours,horizon_days:horizon,
    research_cost_usd:research,opportunity_cost_usd:round(opportunity,2),scenario_allocation_bps:bps,
    scenario_gross_usd:round(gross,2),scenario_net_usd:round(net,2),cautions,
    schedule:skip?[{day:0,action:'Verify official terms and eligibility; no deposit',cost_usd:0},{day:7,action:'Review official announcements',cost_usd:0},{day:28,action:'Reassess or archive',cost_usd:0}]:
      [{day:0,action:'Verify terms, minimums and withdrawability',cost_usd:0},{day:1,action:'Small deposit/exit test, then bounded allocation',cost_usd:round(gas*0.67,2)},
        {day:7,action:'Read-only balance / points inspection',cost_usd:0},{day:14,action:'Read-only product and risk inspection',cost_usd:0},{day:21,action:'Read-only position review',cost_usd:0},{day:28,action:'Exit and reconcile actual costs',cost_usd:round(gas*0.33,2)}]}};
}

export function estimateBoard(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.protocols) || !Array.isArray(snapshot.watchlist)) {
    throw new Error('The input must contain protocols and a watchlist.');
  }
  const peers=uniquePeers(snapshot.protocols), core=fitCore(peers,snapshot.as_of), validation=validate(peers,snapshot.as_of);
  const estimate=p=>validation.selected_method==='huber-ridge'?predictLog(core,p,snapshot.as_of):Math.log(Math.max(1,p.tvl_usd))+core.baseline;
  const rows=snapshot.protocols.map(p=>{
    const status=recorded(p)?'recorded':'unrecorded';
    const observed=status==='recorded' && p.mcap_usd>0;
    const implied=dollars(observed?p.mcap_usd:Math.exp(estimate(p)));
    const ref={...p,listed_at:null};
    const eligible=snapshot.watchlist.includes(p.slug) || (status==='unrecorded' && !/CEX|Bridge|Liquid Staking|Liquid Restaking|Restaked BTC|Staking Pool|Stablecoin Wrapper/.test(category(p)) && !/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name));
    const farm=farmPlan(p,implied,eligible);
    const nearest=peers.filter(q=>tokenKey(q)!==tokenKey(p)).map(q=>({p:q,distance:Math.abs(Math.log(q.tvl_usd/p.tvl_usd))+(category(q)===category(p)?0:1.5)}))
      .sort((a,b)=>a.distance-b.distance || (a.p.slug<b.p.slug?-1:1)).slice(0,5);
    const warnings=[];
    if (status==='recorded' && !(p.mcap_usd>0)) warnings.push('Token is recorded, but circulating market cap is unavailable or a sentinel; the shown value is modeled, not observed.');
    if (p.change_7d===null) warnings.push('Seven-day growth unreported: neutral feature imputation, not a measured zero.');
    if (age(p,snapshot.as_of)===null) warnings.push('Tracking date unavailable: median peer age is imputed.');
    if (status==='unrecorded') warnings.push('No token in this snapshot record is not proof of no existing token or a future launch.');
    const n=peers.filter(q=>category(q)===category(p)).length;
    if(n<4) warnings.push('Thin category peer set: sector estimate is heavily pooled toward the global model.');
    return {...p,category:category(p),token_status:status,radar_eligible:eligible,farm_steps:farm.steps,plan:farm.plan,watchlist:snapshot.watchlist.includes(p.slug),
      age_days:age(p,snapshot.as_of),implied_value_usd:implied,
      value_low_usd:observed?implied:dollars(implied/Math.exp(validation.interval_log_width)),
      value_high_usd:observed?implied:dollars(implied*Math.exp(validation.interval_log_width)),
      valuation:{method:observed?'observed snapshot market cap':validation.selected_method,
        multiple:round(implied/p.tvl_usd),growth_factor:round(Math.exp(estimate(p)-estimate({...p,change_7d:0}))),
        age_factor:round(Math.exp(estimate(p)-estimate(ref))),
        confidence:!observed && n>=4 && p.change_7d!==null && age(p,snapshot.as_of)!==null?'medium':'low',warnings,
        comps:nearest.map(q=>({slug:q.p.slug,name:q.p.name,category:category(q.p),multiple:round(q.p.mcap_usd/q.p.tvl_usd),weight:round(1/(1+q.distance))}))}
    };
  }).sort((a,b)=>b.implied_value_usd-a.implied_value_usd || (a.slug<b.slug?-1:a.slug>b.slug?1:0));
  rows.forEach((row,i)=>{row.rank=i+1;});
  return {as_of:snapshot.as_of,source:snapshot.source,floor_usd:snapshot.floor_usd,rows,
    model:{method:validation.selected_method==='huber-ridge'?'Token-grouped Huber ridge with shrunk category residuals':'Out-of-sample-selected global median market-cap / TVL',
      training_tokens:peers.length,training_rows:snapshot.protocols.filter(p=>recorded(p)&&p.mcap_usd>0).length,
      validation,coefficients:core.beta.map(n=>round(n,5)),category_offsets:core.offsets,
      features:['log TVL','bounded seven-day TVL growth','log tracked age','log chain count','pooled category residual'],
      assumptions:['Conditional market-cap scenario, not a forecast, launch prediction or airdrop promise.',
        'Tracked since is DefiLlama tracking history, not tokenless age or a token-launch date.',
        'TVL is not revenue, free cash flow or proof of token value capture.',
        'One greatest-TVL protocol per token identifier prevents same-token versions leaking between validation folds.',
        'Leave-one-token-group-out errors compare the estimator with a global median-ratio control; the lower median error selects the estimator.',
        'Ranges use the 80th percentile of absolute held-out log errors with a minimum 2x width; they are sensitivity bands, not confidence intervals.',
        'Only this sealed snapshot is used; circulating market cap is not FDV, and unreported fields are not silently treated as measurements.'],
      coverage:{protocols:rows.length,watchlist:snapshot.watchlist.length,watchlist_covered:rows.filter(p=>p.watchlist).length}}};
}
