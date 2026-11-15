import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync,renameSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {estimateBoard} from './dashboard/model.js';
import {buildDossier} from './vendor/makefun-board.ts';

const root=dirname(fileURLToPath(import.meta.url));
const inputAt=process.argv.indexOf('--input');
const input=inputAt>=0?process.argv[inputAt+1]:join(process.env.MAKEFUN_INPUT_DIR||'/input','snapshot.json');
const output=resolve(process.env.MAKEFUN_OUTPUT_DIR||'/output');
const dataOnly=process.argv.includes('--data-only');
type Protocol = {slug:string;name:string;tvl_usd:number;chains:string[];mcap_usd:number|null;change_7d:number|null};
type Snapshot = {as_of:string;protocols:Protocol[];watchlist:string[]};
const atomic=(file:string,bytes:string|Uint8Array)=>{writeFileSync(file+'.tmp',bytes);renameSync(file+'.tmp',file);};

function validateSnapshot(snapshot:Snapshot) {
  if(!snapshot || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.as_of) || !Number.isFinite(Date.parse(snapshot.as_of))) throw new Error('snapshot.as_of must be a valid ISO date');
  if(!Array.isArray(snapshot.protocols) || !Array.isArray(snapshot.watchlist)) throw new Error('protocols and watchlist arrays required');
  const slugs=new Set();
  for(const p of snapshot.protocols) {
    if(!p || typeof p.slug!=='string' || !/^[^\s]{1,128}$/.test(p.slug) || slugs.has(p.slug)) throw new Error('protocol slugs must be unique and nonempty');
    if(typeof p.name!=='string' || !p.name.trim() || !Number.isFinite(p.tvl_usd) || p.tvl_usd<=0 || !Array.isArray(p.chains)) throw new Error(`invalid protocol record: ${p.slug}`);
    if(p.mcap_usd!==null && !Number.isFinite(p.mcap_usd)) throw new Error(`invalid market cap: ${p.slug}`);
    if(p.change_7d!==null && !Number.isFinite(p.change_7d)) throw new Error(`invalid growth: ${p.slug}`);
    slugs.add(p.slug);
  }
  if(snapshot.watchlist.some(slug=>!slugs.has(slug))) throw new Error('watchlist includes a protocol missing from snapshot');
  if(new Set(snapshot.watchlist).size!==snapshot.watchlist.length) throw new Error('watchlist must have unique slugs');
  if(snapshot.protocols.length<100) throw new Error('at least 100 protocol records are required');
}

try {
  if(!input) throw new Error('--input needs a snapshot file');
  const snapshot=JSON.parse(readFileSync(input,'utf8'));
  validateSnapshot(snapshot);
  const board=estimateBoard(snapshot);
  mkdirSync(output,{recursive:true});
  atomic(join(output,'board.json'),JSON.stringify(board));
  atomic(join(output,'data.js'),'window.RADAR='+JSON.stringify(board).replace(/</g,'\\u003c')+';\n');
  cpSync(join(root,'dashboard'),join(output,'dashboard'),{recursive:true});
  if(!dataOnly) {
    if(!existsSync(join(root,'screenshots'))) throw new Error('capture three actual browser screenshots before packaging');
    cpSync(join(root,'screenshots'),join(output,'screenshots'),{recursive:true});
    atomic(join(output,'dossier.json'),buildDossier(output,{text_max_bytes:65536,
      screenshots:{max:4,max_bytes:512*1024},dashboard:{max_files:400,max_bytes:4*1024*1024}}));
    if(readFileSync(join(output,'dossier.json')).length>1.5*1024*1024) throw new Error('dossier is over the competition 1.5 MiB cap');
  }
  console.log(JSON.stringify({rows:board.rows.length,watchlist:board.model.coverage.watchlist_covered,
    training_tokens:board.model.training_tokens,mode:dataOnly?'data-preview':'submission',output}));
} catch(error) {
  console.error('Radar build failed: '+(error instanceof Error?error.message:String(error)));
  process.exitCode=1;
}
