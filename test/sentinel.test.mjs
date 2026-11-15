import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=import.meta.dirname+'/..';
const input=process.env.RADAR_SNAPSHOT||root+'/../kit/token-radar-01-kit/input/snapshot.json';
test('a negative market-cap sentinel renders as unavailable in the real-snapshot detail',()=>{
 const out=mkdtempSync(join(tmpdir(),'radar-sentinel-'));
 try {
  const build=spawnSync(process.execPath,['main.ts','--input',input,'--data-only'],{cwd:root,env:{...process.env,MAKEFUN_OUTPUT_DIR:out},encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  const code=String.raw`
import sys,threading,functools,http.server
from playwright.sync_api import sync_playwright,expect
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=sys.argv[1]));threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page();page.goto('http://127.0.0.1:'+str(s.server_port)+'/dashboard/index.html')
  page.locator('[data-status=all]').click();page.locator('#eligible').uncheck();page.locator('#search').fill('AUTOfinance');page.locator('.row-open').click()
  stat=page.locator('#detail .statline').filter(has_text='Observed token cap')
  expect(stat.locator('strong')).to_have_text('n/a')
  b.close()
finally:s.shutdown();s.server_close()
`;
  const r=spawnSync(process.env.UI_PYTHON||'python3',['-c',code,out],{encoding:'utf8',timeout:90000});
  assert.equal(r.status,0,r.stderr);
 } finally {rmSync(out,{recursive:true,force:true});}
});
