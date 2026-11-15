import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const repo = new URL('..',import.meta.url).pathname;
const input = process.env.RADAR_SNAPSHOT || join(repo,'../kit/token-radar-01-kit/input/snapshot.json');
test('the entry produces a ranked reproducible board from the sealed snapshot',()=>{
  assert.ok(existsSync(join(repo,'main.ts')),'missing feature: main.ts entry pipeline');
  const out=mkdtempSync(join(tmpdir(),'radar-test-'));
  try {
    const env={...process.env,MAKEFUN_OUTPUT_DIR:out};
    let r=spawnSync(process.execPath,['main.ts','--input',input,'--data-only'],{cwd:repo,env,encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
    const before=readFileSync(join(out,'board.json'));
    const d=JSON.parse(before);
    assert.equal(d.rows.length,758);
    assert.equal(d.model.coverage.watchlist_covered,40);
    for(let i=0;i<d.rows.length;i++) {
      const row=d.rows[i];assert.equal(row.rank,i+1);
      assert.ok(Number.isInteger(row.implied_value_usd) && row.implied_value_usd>0);
      assert.ok(row.farm_steps.length>=3 && row.farm_steps.length<=12);
      assert.ok(row.farm_steps.every(x=>x.trim().length>=20 && x.length<=600));
      if(i) assert.ok(d.rows[i-1].implied_value_usd>=row.implied_value_usd);
    }
    r=spawnSync(process.execPath,['main.ts','--input',input,'--data-only'],{cwd:repo,env,encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
    assert.deepEqual(readFileSync(join(out,'board.json')),before,'repeated board bytes differ');
    assert.ok(readFileSync(join(out,'data.js'),'utf8').startsWith('window.RADAR='));
  } finally {rmSync(out,{recursive:true,force:true});}
});
