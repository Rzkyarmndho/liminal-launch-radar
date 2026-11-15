const $=id=>document.getElementById(id),D=window.RADAR,F=x=>typeof x==='number'&&Number.isFinite(x),N=x=>F(x)?x.toFixed(2):'n/a';
const M=x=>F(x)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(x):'n/a',G=x=>F(x)?`${x>0?'+':''}${x.toFixed(1)}%`:'n/a';
function E(t,s,c){const n=document.createElement(t);if(s!=null)n.textContent=String(s);if(c)n.className=c;return n;}
function add(p,t,s,c){const n=E(t,s,c);p.append(n);return n;}
const T=(id,s)=>$(id).textContent=s,A=(id,event,fn)=>$(id).addEventListener(event,fn),P=(p,s)=>add(p,'p',s);
function S(p,t){const n=add(p,'section',null,'section');add(n,'h3',t);return n;}
function stats(p,a){for(const [k,v]of a){const n=add(p,'div',null,'statline');add(n,'span',k);add(n,'strong',v);}}
function list(p,a,t='ul'){const n=add(p,t);for(const s of a||[])add(n,'li',s);}
function cell(p,k,s){const n=add(p,'td',s);n.dataset.label=k;return n;}
if(!D||!Array.isArray(D.rows)){
T('state','Snapshot unavailable. Add data.js beside dashboard and reopen.');T('result-count','Snapshot unavailable');for(const n of document.querySelectorAll('button,input,select'))n.disabled=true;
}else{
const rows=D.rows.filter(r=>r&&typeof r.name==='string');let status='unrecorded',limit=12,down=true,f=[];
T('as-of',D.as_of||'Not recorded');T('protocols',rows.length.toLocaleString('en-US'));T('unrecorded',rows.filter(r=>r.token_status==='unrecorded').length.toLocaleString('en-US'));T('source',D.source||'Source not recorded');
for(const [id,a]of [['category',rows.map(r=>r.category)],['chain',rows.flatMap(r=>r.chains||[])]])for(const v of [...new Set(a.filter(Boolean))].sort())add($(id),'option',v).value=v;
const metric=r=>({value:r.implied_value_usd,tvl:r.tvl_usd,growth:r.change_7d,net:r.plan?.scenario_net_usd})[$('sort').value];
function render(){
const q=$('search').value.trim().toLowerCase(),cat=$('category').value,ch=$('chain').value;
f=rows.filter(r=>(!$('eligible').checked||r.radar_eligible===true)&&(status==='all'||r.token_status===status)&&(!cat||r.category===cat)&&(!ch||(r.chains||[]).includes(ch))&&(!q||[r.name,r.slug,r.symbol,r.category,...(r.chains||[])].join(' ').toLowerCase().includes(q)));
f.sort((a,b)=>{const x=metric(a),y=metric(b);return !F(x)?F(y)?1:0:!F(y)?-1:(down?y-x:x-y)||a.name.localeCompare(b.name);});$('rows').replaceChildren();
for(const r of f.slice(0,limit)){
const tr=add($('rows'),'tr');tr.dataset.slug=r.slug;const name=cell(tr,'Protocol'),w=add(name,'div',null,'protocol');add(w,'span',r.rank||'n/a','rank');const id=add(w,'div');add(id,'button',r.name,'row-open');add(id,'small',`${r.category||'Unclassified'} · ${(r.chains||[]).join(', ')}`);if(r.token_status==='recorded')add(id,'small','Token recorded'+(r.symbol?' · '+r.symbol:''));
cell(tr,'TVL',M(r.tvl_usd));cell(tr,'7d growth',G(r.change_7d)).className=F(r.change_7d)?r.change_7d>=0?'positive':'negative':'';
add(cell(tr,'Implied cap range',M(r.implied_value_usd)),'small',`${M(r.value_low_usd)} – ${M(r.value_high_usd)}`);cell(tr,'Tracked age',F(r.age_days)?r.age_days.toLocaleString('en-US')+'d':'Unknown');
const p=cell(tr,'Plan verdict');add(p,'span',r.plan?.verdict||'n/a','verdict '+(r.plan?.verdict||''));add(p,'small',M(r.plan?.scenario_net_usd)+' scenario net');
}
T('result-count',`${f.length} of ${rows.length} protocols`);$('state').hidden=!!f.length;T('state',rows.length?'No protocols match. Reset filters to see the snapshot.':'Empty snapshot. Regenerate data.js.');$('more').hidden=limit>=f.length;$('export').disabled=!f.length;
$('active').replaceChildren();for(const s of [status==='unrecorded'?'No token recorded':status==='recorded'?'Token recorded':'All records',cat,ch,q?'Search: '+$('search').value.trim():''])if(s)add($('active'),'span',s,'filter-tag');
for(const n of document.querySelectorAll('[data-status]'))n.setAttribute('aria-pressed',String(n.dataset.status===status));T('direction',down?'↓':'↑');$('direction').title=down?'Descending':'Ascending';
}
for(const id of ['search','category','chain','sort','eligible'])A(id,id==='search'?'input':'change',()=>{limit=12;render();});
for(const n of document.querySelectorAll('[data-status]'))n.onclick=()=>{status=n.dataset.status;limit=12;render();};
A('direction','click',()=>{down=!down;render();});A('more','click',()=>{limit+=12;render();});A('reset','click',()=>{status='unrecorded';down=true;limit=12;for(const id of ['search','category','chain'])$(id).value='';$('sort').value='value';$('eligible').checked=true;render();});
A('export','click',()=>{
const h='rank name category chains token_status tvl_usd change_7d implied_value_usd value_low_usd value_high_usd age_days verdict scenario_net_usd'.split(' '),quote=x=>'"'+String(x??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';
const csv=[h,...f.map(r=>h.map(k=>k==='chains'?(r[k]||[]).join('; '):['verdict','scenario_net_usd'].includes(k)?r.plan?.[k]:r[k]))].map(a=>a.map(x=>F(x)?x:quote(x)).join(',')).join('\r\n');
const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=E('a');a.href=u;a.download='liminal-radar.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
});
const m=D.model||{},v=m.validation||{},c=m.coverage||{},d=$('diagnostics');add(d,'h2','Model diagnostics');P(d,m.method||'Method unavailable');
const h=S(d,'Grouped holdout');P(h,'Median multiplicative error. Lower is better.');stats(h,[['Selected model',F(v.model_factor_error)?v.model_factor_error.toFixed(1)+'×':'n/a'],['Global baseline',F(v.baseline_factor_error)?v.baseline_factor_error.toFixed(1)+'×':'n/a'],['Median log error',N(v.model_median_log_error)+' / '+N(v.baseline_median_log_error)],['Holdout groups',v.groups??'n/a']]);
const cv=S(d,'Evidence coverage');stats(cv,[['Distinct training tokens',m.training_tokens??'n/a'],['Training rows',m.training_rows??'n/a'],['Watchlist covered',`${c.watchlist_covered??'n/a'} / ${c.watchlist??'n/a'}`]]);P(cv,'Coverage ignores filters.');
const l=S(d,'Read before ranking');P(l,'All + uncheck shows excluded records.');for(const a of m.assumptions||[])P(l,a);P(l,'Missing cap does not mean no token.');
let opener;
function open(r,button){
opener=button;const b=$('detail-body');b.replaceChildren();b.className='dossier';T('detail-title',r.name);const p=r.plan||{},v=r.valuation||{};
P(b,`${r.slug} · ${r.category} · ${(r.chains||[]).join(', ')} · ${r.token_status==='recorded'?'Token recorded':'No token recorded'}${r.symbol?' · '+r.symbol:''}`);P(b,`Tracked age: ${F(r.age_days)?r.age_days+' days':'unknown'}${r.listed_at?' · tracked since '+r.listed_at:''}`);
stats(b,[['Snapshot TVL',M(r.tvl_usd)],['7d growth',G(r.change_7d)],['Observed token cap',M(r.mcap_usd>0?r.mcap_usd:null)],['Conditional cap',M(r.implied_value_usd)],['Scenario range',`${M(r.value_low_usd)} – ${M(r.value_high_usd)}`]]);
const budget=S(b,'Pilot budget / '+(p.verdict||'n/a')),grid=add(budget,'div',null,'budget');stats(grid,[['Capital at risk',M(p.capital_usd)],['Gas budget',M(p.gas_usd)],['Time budget',F(p.time_hours)?p.time_hours+'h':'n/a'],['Horizon',F(p.horizon_days)?p.horizon_days+'d':'n/a']]);list(budget,p.cautions);
const s=S(b,'Peer valuation / sensitivity');P(s,v.method||'No comparable method');P(s,`Confidence: ${v.confidence||'unknown'} · TVL multiple ${N(v.multiple)}× · growth ${N(v.growth_factor)} · age ${N(v.age_factor)}`);
const plot=add(s,'div');plot.id='peer-plot';const label=add(s,'label','Cap sensitivity (relative to modeled cap)'),slider=add(s,'input');Object.assign(slider,{id:'sensitivity',type:'range',min:'30',max:'200',step:'5',value:'100'});label.htmlFor=slider.id;
const out=add(s,'div',null,'sensitivity-values'),cap=add(out,'strong'),net=add(out,'strong');cap.id='sensitive-cap';net.id='sensitive-net';const al=add(s,'label','Assumed allocation, basis points of market cap'),alloc=add(s,'select');alloc.id='allocation';al.htmlFor=alloc.id;for(const x of [.001,.01,.1])add(alloc,'option',x+' bps').value=x;alloc.value='0.01';
P(s,'Assumption, not expected return. Net subtracts modeled expenses, not principal. Conditional market-cap scenario, not forecast or airdrop promise. Gas budgets, not live quotes.');list(s,v.warnings);
function update(){
const f=Number(slider.value)/100,x=F(r.implied_value_usd)?r.implied_value_usd*f:NaN,cost=F(p.scenario_gross_usd)&&F(p.scenario_net_usd)?p.scenario_gross_usd-p.scenario_net_usd:NaN;cap.textContent=`${M(x)} · ${f.toFixed(2)}×`;net.textContent=M(x*Number(alloc.value)/10000-cost)+' net scenario';
const a=(v.comps||[]).filter(c=>F(c.multiple)&&F(r.tvl_usd)).map(c=>[`${c.name} · ${N(c.multiple)}× TVL · weight ${N(c.weight)}`,r.tvl_usd*c.multiple]);a.push(['Modeled cap × sensitivity',x]);const max=Math.max(1,...a.map(c=>F(c[1])?c[1]:0));plot.replaceChildren();
for(const [name,value]of a){const row=add(plot,'div',null,'plot-row'),head=add(row,'div',null,'plot-label');add(head,'span',name);add(head,'strong',M(value));const track=add(row,'div',null,'plot-track'),fill=add(track,'div',null,'plot-fill');fill.style.width=Math.max(0,F(value)?value/max*100:0)+'%';}
add(plot,'div',`Linear scale: $0 to ${M(max)}. Peers = TVL × multiple.`,'plot-note');
}
slider.oninput=update;alloc.onchange=update;update();const schedule=S(b,'Costed timeline'),tl=add(schedule,'ol',null,'timeline');for(const x of p.schedule||[]){const n=add(tl,'li');add(n,'strong','D'+x.day);add(n,'span',x.action);add(n,'span',M(x.cost_usd));}
list(S(b,'Farm steps'),r.farm_steps,'ol');$('detail').showModal();$('detail').scrollTop=0;$('close').focus();
}
A('rows','click',e=>{const tr=e.target.closest('tr[data-slug]');if(tr){const r=rows.find(x=>x.slug===tr.dataset.slug);if(r)open(r,tr.querySelector('button'));}});A('close','click',()=>$('detail').close());A('detail','close',()=>opener?.focus());
A('detail','keydown',e=>{if(e.key==='Tab'){const a=[...$('detail').querySelectorAll('button,input,select')],i=e.shiftKey?0:a.length-1;if(document.activeElement===a[i]){e.preventDefault();a[e.shiftKey?a.length-1:0].focus();}}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!$('detail').open&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();$('search').focus();}});render();
}
