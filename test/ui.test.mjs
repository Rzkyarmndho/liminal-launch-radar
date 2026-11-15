import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),files=['dashboard/index.html','dashboard/app.css','dashboard/app.js'];
test('offline boot contract',()=>{
 for(const f of files)assert.ok(existsSync(join(root,f)),`Missing ${f}`);
 const h=readFileSync(join(root,files[0]),'utf8');assert.match(h,/<html lang="en">/);
 assert.ok(h.includes('src="../data.js"')&&h.indexOf('src="../data.js"')<h.indexOf('src="app.js"'));
 for(const f of files)assert.doesNotMatch(readFileSync(join(root,f),'utf8'),/https?:\/\//i);
});
const code=String.raw`
import sys,json,threading,http.server,functools,pathlib,csv
from playwright.sync_api import sync_playwright,expect
mode=sys.argv[2];rows=[]
for i in range(36):
 r=dict(slug='s'+str(i),name='=QA' if i==0 else '<img src=x onerror=alert(1)>' if i==1 else 'Synthetic '+str(i).zfill(2),category='CEX' if i==0 else 'Lending' if i%2 else 'DEX',chains=['Ethereum' if i%2 else 'Arbitrum'],rank=i+1,tvl_usd=(36-i)*1e6,change_7d=None if i==1 else i-10,token_status='recorded' if i and i%6==0 else 'unrecorded',radar_eligible=i!=0,watchlist=i!=0,age_days=None if i==1 else i*10,implied_value_usd=(i+1)*1e6,value_low_usd=(i+1)*5e5,value_high_usd=(i+1)*2e6,farm_steps=['QA withdrawal'])
 r['plan']=dict(verdict='pilot' if i%3==0 else 'thin',capital_usd=100,gas_usd=8,time_hours=2,horizon_days=30,scenario_allocation_bps=1,scenario_gross_usd=100,scenario_net_usd=i-20,cautions=['QA only'],schedule=[dict(day=0,action='QA deposit',cost_usd=4),dict(day=30,action='QA exit',cost_usd=4)])
 r['valuation']=dict(method='SYNTHETIC peers',comps=[dict(slug='peer',name='QA peer',category='Lending',multiple=2.5,weight=1)],multiple=2.5,growth_factor=1.1,age_factor=1,confidence='low',warnings=['QA only']);rows.append(r)
data=dict(as_of='2026-01-01',source='SYNTHETIC QA FIXTURE, NOT MARKET DATA',floor_usd=1e5,rows=rows,model=dict(method='SYNTHETIC model',training_tokens=20,training_rows=20,validation=dict(groups=4,model_median_log_error=.5,baseline_median_log_error=.8,model_factor_error=1.65,baseline_factor_error=2.23),assumptions=['SYNTHETIC assumption'],coverage=dict(protocols=36,watchlist=35,watchlist_covered=30)))
if mode!='boot':pathlib.Path(sys.argv[1],'data.js').write_text('window.RADAR='+json.dumps(data))
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=sys.argv[1]));threading.Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);c=b.new_context(viewport=dict(width=1400,height=900),accept_downloads=True);blocked=[];errors=[]
 def route(r):
  if r.request.url.startswith('http://127.0.0.1:'):r.continue_()
  else:blocked.append(r.request.url);r.abort()
 c.route('**/*',route);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:'+str(s.server_port)+'/dashboard/index.html');L=page.locator;R=L('tbody tr[data-slug]');X=L('#search');Q=L('#detail');C=L('#close')
 def text(selector,value):expect(L(selector)).to_contain_text(value)
 def reset():L('#reset').click()
 if mode=='boot':text('#state','Snapshot unavailable')
 else:
  text('#result-count','30 of 36');expect(R).to_have_count(12);L('#more').click();expect(R).to_have_count(24)
  page.keyboard.press('/');expect(X).to_be_focused();X.fill('Synthetic 02');expect(R).to_have_count(1);text('#active','Synthetic 02');reset()
  L('#category').select_option('Lending');L('#chain').select_option('Ethereum');text('#result-count','18 of 36');L('[data-status=recorded]').click();text('#state','No protocols match');reset()
  expect(L('#eligible')).to_be_checked();L('[data-status=all]').click();text('#result-count','35 of 36');L('#eligible').uncheck();text('#result-count','36 of 36')
  for key,slug in [('value','s35'),('tvl','s0'),('growth','s35'),('net','s35')]:
   L('#sort').select_option(key);assert R.first.get_attribute('data-slug')==slug
  L('#direction').click();assert R.first.get_attribute('data-slug')=='s0'
  with page.expect_download() as d:L('#export').click()
  out=list(csv.reader(pathlib.Path(d.value.path()).read_text().splitlines()));assert len(out)==37;assert "'=QA" in out[1]
  X.fill('<img');expect(R).to_have_count(1);assert L('tbody img').count()==0;reset()
  for w in [375,768,1024,1400]:
   page.set_viewport_size(dict(width=w,height=900));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),w
  if mode=='detail':
   for t in ['20','0.50','0.80','30 / 35']:text('#diagnostics',t)
   opener=L('.row-open').first;opener.focus();page.keyboard.press('Enter');expect(Q).to_be_visible();expect(C).to_be_focused()
   for t in ['QA peer','QA deposit','QA withdrawal','not forecast or airdrop promise']:text('#detail',t)
   expect(L('#peer-plot .plot-row')).to_have_count(2);old=L('#sensitive-cap').inner_text();L('#sensitivity').fill('150');L('#sensitivity').dispatch_event('input');assert L('#sensitive-cap').inner_text()!=old
   old=L('#sensitive-net').inner_text();L('#allocation').select_option('0.1');assert L('#sensitive-net').inner_text()!=old
   for _ in range(20):
    page.keyboard.press('Tab');assert Q.evaluate('(d)=>d.contains(document.activeElement)')
   page.keyboard.press('Escape');expect(Q).not_to_be_visible();expect(opener).to_be_focused();R.first.click();expect(Q).to_be_visible();C.click();expect(Q).not_to_be_visible()
   X.fill('<img');L('.row-open').click();expect(L('#detail-title')).to_have_text('<img src=x onerror=alert(1)>');assert L('#detail img').count()==0;text('#detail','Tracked age: unknown');C.click();reset()
   for w in [375,768,1400]:
    page.set_viewport_size(dict(width=w,height=900));L('.row-open').first.click();assert Q.evaluate('(d)=>d.scrollWidth<=d.clientWidth');C.click()
 assert not errors,errors;assert not blocked,blocked
 print('PASS '+mode+': synthetic Chromium QA; no errors/network');b.close()
s.shutdown()
`;
function browser(mode){
 const dir=mkdtempSync(join(process.env.TMPDIR||'/home/rzkyarmndho/.hermes/cache/scratch','radar-ui-'));
 try{mkdirSync(join(dir,'dashboard'));for(const f of files)copyFileSync(join(root,f),join(dir,f));writeFileSync(join(dir,'data.js'),'');
 const r=spawnSync(process.env.UI_PYTHON||'python3',['-c',code,dir,mode],{encoding:'utf8',timeout:90000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);console.log(r.stdout.trim());
 }finally{rmSync(dir,{recursive:true,force:true});}
}
for(const mode of ['boot','table','detail'])test('offline browser '+mode,()=>browser(mode));
test('owned files <=28KB',()=>assert.ok([...files,'test/ui.test.mjs'].reduce((n,f)=>n+statSync(join(root,f)).size,0)<=28000));
