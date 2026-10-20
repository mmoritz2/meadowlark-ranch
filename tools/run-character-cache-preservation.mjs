// Run existing CPU preservation suites against only the exact restored a0f3837
// HTML/index subjects. Runtime art sources remain live and are not projected.
import {mkdtempSync,mkdirSync,readdirSync,copyFileSync,symlinkSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {normalizeCharacterCacheSource,assertCharacterCacheCurrent} from './character-cache-source-guard.cjs';
const root=path.resolve(process.env.CHARACTER_CACHE_SUBJECT_ROOT||fileURLToPath(new URL('../',import.meta.url))),owners=process.env.CHARACTER_CACHE_OWNER_ROOT||root;
const contract=JSON.parse(readFileSync(new URL('./fixtures/character-cache-a0f3837/contract.json',import.meta.url),'utf8')),baseline=process.env.CHARACTER_CACHE_BASELINE==='1';
const sha=s=>createHash('sha256').update(s).digest('hex'),projection=mkdtempSync(path.join(tmpdir(),'meadowlark-character-cache98-'));
const tests=process.argv.slice(2);if(!tests.length)tests.push('tools/test-estate-builder-integration.mjs','tools/test-estate-outbuildings.mjs','tools/test-estate-grandstand.mjs','tools/test-arrival-stable.mjs');
if(tests.some(f=>!/^tools\/test-[a-z0-9-]+\.mjs$/.test(f)))throw Error('Only explicit existing CPU test modules');
const subjects=[];
function sourceOwner(file){
 const raw=readFileSync(path.join(baseline?root:owners,file));
 if(baseline){if(sha(raw)!==contract.ownerBeforeSHA256[file])throw Error('Baseline is not the complete literal a0f3837 owner '+file);return raw;}
 assertCharacterCacheCurrent(raw,file);const restored=normalizeCharacterCacheSource(raw,file);
 if(sha(restored)!==contract.ownerBeforeSHA256[file])throw Error('Projection did not restore complete a0f3837 owner '+file);
 return restored;
}
function tree(relative=''){
 mkdirSync(path.join(projection,relative),{recursive:true});
 for(const ent of readdirSync(path.join(root,relative),{withFileTypes:true})){
  if(!relative&&['.git','output','.playwright-mcp'].includes(ent.name))continue;
  const name=path.posix.join(relative,ent.name),dest=path.join(projection,name),src=path.join(root,name);
  if(ent.isDirectory()){
   if(['assets','assets/features','tools'].includes(name))tree(name);else symlinkSync(src,dest,'dir');
  }else if(Object.hasOwn(contract.ownerBeforeSHA256,name)){
   const restored=sourceOwner(name);writeFileSync(dest,restored);subjects.push({file:name,sha256:sha(restored),expectedA0F3837SHA256:contract.ownerBeforeSHA256[name]});
  }else if(relative==='tools'&&/\.(?:mjs|cjs|js)$/.test(ent.name))copyFileSync(src,dest);
  else symlinkSync(src,dest);
 }
}
let result;
try{tree();result=spawnSync(process.execPath,['--test',...tests],{cwd:projection,encoding:'utf8',maxBuffer:16*1024*1024});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');}
finally{rmSync(projection,{recursive:true,force:true});}
const report={baseline,scope:'Only3 exact Character98 imports reversed to whole a0f3837 HTML/index. All pre-existing tests, guards, assertions and fixtures retain exact bytes. No character runtime source projected.',tests,subjects,status:result?.status,error:result?.error?.message||null,stdoutSHA256:sha(result?.stdout||''),projectionRemoved:true};
if(process.env.CHARACTER_CACHE_REPORT)writeFileSync(process.env.CHARACTER_CACHE_REPORT,JSON.stringify(report,null,2));
if(result?.error)throw result.error;process.exitCode=result?.status??1;
