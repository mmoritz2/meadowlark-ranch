/* Run every package QA script that speaks the PASS/FAIL protocol and tally the lot.

   These were only ever run one at a time by hand, which is how it went unnoticed that half
   of them were launching chromium with a GPU backend from the wrong operating system. A
   single command that runs them all and prints one table per script is the cheapest way to
   keep that from happening again, and it is also how you check that a change to
   tools/qa-platform.cjs did not quietly break the fleet.

   Usage:  QA_PORT=8515 NODE_PATH=$(npm root -g) node tools/qa-suite.cjs [name ...]
   Names are matched as substrings, so 'world ranch' runs qa-world-features and qa-ranch.
   The scripts are run one at a time on purpose: several of them drive a real GPU and a real
   simulation clock, and running them concurrently makes their timings and their flakes
   indistinguishable.
*/
const QA=require('./qa-platform.cjs');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const dir=__dirname, root=path.dirname(dir), want=process.argv.slice(2).filter(a=>!a.startsWith('--'));

/* First, the thing the whole sweep was about: prove the backend is chosen from the platform
   rather than baked in, on both branches, before spending twenty minutes finding out it was
   not. process.platform is writable, which is the only way to exercise the other OS here. */
function selfCheck(){
 const real=process.platform, seen={}, pinned=process.env.QA_ANGLE;
 delete process.env.QA_ANGLE;
 for(const p of ['darwin','win32','linux']){
  Object.defineProperty(process,'platform',{value:p,configurable:true});
  delete require.cache[require.resolve('./qa-platform.cjs')];
  seen[p]=require('./qa-platform.cjs').ANGLE;
 }
 Object.defineProperty(process,'platform',{value:real,configurable:true});
 if(pinned!==undefined)process.env.QA_ANGLE=pinned;
 delete require.cache[require.resolve('./qa-platform.cjs')];
 const ok=seen.darwin==='--use-angle=metal'&&seen.win32==='--use-angle=d3d11'&&seen.linux==='--use-angle=gl';
 console.log((ok?'PASS ':'FAIL ')+'qa-platform picks the backend per platform — '+JSON.stringify(seen));
 return ok;
}

/* selfCheck proves the helper answers correctly. It does not prove anybody asks it, and the bug
   this sweep was about was never a wrong ternary — it was a literal sitting in a launch line.
   That literal comes back the moment somebody copies an old script as a starting point, so read
   the fleet and fail on the three spellings that were wrong in the first place. qa-platform.cjs
   and this file are exempt: one documents the literals and the other has to name them to assert
   on them. Comments are stripped first, minus the '//' of a URL, so prose about the bug is free
   to keep saying d3d11. */
function sweepCheck(){
 const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
 const bad=[];
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.cjs')&&f!=='qa-platform.cjs'&&f!=='qa-suite.cjs')){
  const src=strip(fs.readFileSync(path.join(dir,f),'utf8'));
  if(/--use-angle=(d3d11|metal|gl)\b/.test(src))bad.push(f+': hardcoded ANGLE backend');
  if(/127\.0\.0\.1:8431/.test(src))bad.push(f+': hardcoded port 8431');
  if(/[A-Za-z]:[\\/]Users[\\/]/.test(src))bad.push(f+': absolute Windows user path');
 }
 console.log((bad.length?'FAIL ':'PASS ')+'no script hardcodes a backend, a port or a home directory'+(bad.length?' — '+JSON.stringify(bad):''));
 return !bad.length;
}

const suite=fs.readdirSync(dir).filter(f=>/^qa-.*\.cjs$/.test(f)&&f!=='qa-platform.cjs'&&f!=='qa-suite.cjs')
 .filter(f=>/'PASS '|"PASS "/.test(fs.readFileSync(path.join(dir,f),'utf8')))
 .filter(f=>!want.length||want.some(w=>f.includes(w))).sort();

const selfOk=selfCheck(),sweepOk=sweepCheck();
console.log('# '+suite.length+' script(s) against '+QA.BASE+' on '+QA.GPU+'\n');
const rows=[];
for(const f of suite){
 const t0=Date.now();
 /* Inherit the environment rather than rebuilding it: QA_PORT, QA_URL and NODE_PATH are the
    caller's business, and a script that needs something else will say so in its own output. */
 const r=spawnSync(process.execPath,[path.join(dir,f)],{cwd:root,encoding:'utf8',timeout:900000,env:process.env});
 const text=(r.stdout||'')+(r.stderr||'');
 const pass=(text.match(/^PASS /gm)||[]).length, fail=(text.match(/^FAIL /gm)||[]).length;
 const row={script:f,pass,fail,exit:r.status,seconds:+((Date.now()-t0)/1000).toFixed(1)};
 rows.push(row);
 console.log(f.padEnd(34)+String(pass).padStart(4)+' pass '+String(fail).padStart(3)+' fail  exit '+String(r.status)+'  '+row.seconds+'s');
 for(const line of text.split('\n'))if(line.startsWith('FAIL '))console.log('    '+line);
}
const tot=rows.reduce((a,r)=>({pass:a.pass+r.pass,fail:a.fail+r.fail,bad:a.bad+(r.exit?1:0)}),{pass:0,fail:0,bad:0});
console.log('\nTOTAL '+tot.pass+' pass, '+tot.fail+' fail, '+tot.bad+' script(s) exited non-zero');
fs.mkdirSync(path.join(root,'output'),{recursive:true});
fs.writeFileSync(path.join(root,'output','qa-suite.json'),JSON.stringify({base:QA.BASE,gpu:QA.GPU,platformSelfCheck:selfOk,sweepClean:sweepOk,rows,tot},null,2));
process.exit(tot.fail||tot.bad||!selfOk||!sweepOk?1:0);
