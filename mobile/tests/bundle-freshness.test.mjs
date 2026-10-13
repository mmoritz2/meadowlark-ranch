import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileHash,sourcePath,currentRevision,runtimeSourcePaths,captureBuildInputs,assertBuildInputsUnchanged,verifyBundleFreshness} from '../scripts/bundle-freshness.mjs';

// Tiny local source/output fixtures exercise the production validator without
// copying the game's large assets, running a build, or invoking native tooling.
const nativeHtml="const SOCIAL=false; await window.MeadowlarkNative.ready; window.MeadowlarkNative.attachGame({}); save:{awaitConfirmedFresh:()=>window.MeadowlarkNative.confirmedSave(SAVE_KEY)}";
const nativeBootstrap='function confirmGameSave(){}; function whenDurable(){};';
async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'meadowlark-native-freshness-')),base=path.join(root,'mobile/www');
 t.after(()=>rm(root,{recursive:true,force:true}));
 async function write(file,bytes){const absolute=sourcePath(root,file);await mkdir(path.dirname(absolute),{recursive:true});await writeFile(absolute,bytes);}
 const body='approved fixture horse',spec={roots:['assets'],rootFiles:['sw.js'],reviewFiles:[{path:'review/horse/model.glb',sha256:fileHash(body)}],excludedExtensions:['.blend']};
 for(const [file,bytes] of Object.entries({
  'ranch3d.html':'original web core and save API',
  'assets/features/cottonwood-post.js':'export const complete=()=>"confirmed receipt";',
  'assets/features/cottonwood-post-rules.mjs':'export const exactProof=true;',
  'assets/ranch-progress.mjs':'export const points=82;',
  'assets/expeditions.mjs':'export const offline=true;',
  'assets/model.blend':'excluded authoring source',
  'sw.js':'cache version one',
  'review/horse/model.glb':body,
  'mobile/src/bootstrap.js':'import {plugin} from "fixture-cap"; import "./save-confirmation.mjs";',
  'mobile/src/save-store.mjs':'export const whenDurable=()=>{};',
  'mobile/src/save-confirmation.mjs':'export const confirmGameSave=()=>{};',
  'mobile/scripts/stage.mjs':'capture actual build inputs; inject awaitConfirmedFresh;',
  'mobile/scripts/bundle-freshness.mjs':'production validator fixture input',
  'mobile/package.json':JSON.stringify({dependencies:{'fixture-cap':'1.0.0'},devDependencies:{esbuild:'0.28.2'}}),
  'mobile/package-lock.json':JSON.stringify({lockfileVersion:3,packages:{}}),
  'mobile/capacitor.config.json':JSON.stringify({webDir:'www'}),
  'mobile/release-status.json':JSON.stringify({gates:{device:false},blockingAssets:['fixture-horse']}),
  'mobile/runtime-assets.json':JSON.stringify(spec),
  'mobile/node_modules/fixture-cap/package.json':JSON.stringify({name:'fixture-cap',dependencies:{'fixture-child':'1.0.0'}}),
  'mobile/node_modules/fixture-cap/index.js':'export const plugin=true;',
  'mobile/node_modules/fixture-child/package.json':JSON.stringify({name:'fixture-child'}),
  'mobile/node_modules/fixture-child/index.js':'export const dependency=true;',
  'mobile/node_modules/esbuild/package.json':JSON.stringify({name:'esbuild',optionalDependencies:{'@esbuild/darwin-arm64':'0.28.2'}}),
  'mobile/node_modules/esbuild/bin/esbuild':Buffer.from([0,255,17,42]),
  'mobile/node_modules/@esbuild/darwin-arm64/package.json':JSON.stringify({name:'@esbuild/darwin-arm64'}),
  'mobile/node_modules/@esbuild/darwin-arm64/bin/esbuild':Buffer.from([0,255,29,42]),
 }))await write(file,bytes);
 execFileSync('git',['init','--quiet'],{cwd:root,stdio:'ignore'});
 execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','--allow-empty','-m','fixture'],{cwd:root,stdio:'ignore'});
 const files=[];
 async function add(output,source,bytes,generated=false){
  await write('mobile/www/'+output,bytes);
  files.push({path:output,bytes:Buffer.byteLength(bytes),sha256:fileHash(bytes),...(generated?{generated:true}:{sourcePath:source,sourceSha256:fileHash(await readFile(sourcePath(root,source)))})});
 }
 for(const file of await runtimeSourcePaths(root,spec))if(file!=='ranch3d.html')await add(file,file,await readFile(sourcePath(root,file)));
 await add('index.html','ranch3d.html',nativeHtml);await add('ranch3d.html','ranch3d.html',nativeHtml);await add('native-bootstrap.js',null,nativeBootstrap,true);
 const manifest={schema:2,sourceRevision:currentRevision(root),mode:'native-development-offline',releaseReady:false,files,buildInputs:await captureBuildInputs(root),
  bootstrapInputs:['mobile/src/bootstrap.js','mobile/src/save-store.mjs','mobile/src/save-confirmation.mjs','mobile/node_modules/fixture-cap/index.js','mobile/node_modules/fixture-child/index.js']};
 return {root,base,manifest,write,check:()=>verifyBundleFreshness({root,base,manifest}),
  async changeOutput(file,text){await write('mobile/www/'+file,text);const row=files.find(r=>r.path===file);row.sha256=fileHash(text);row.bytes=Buffer.byteLength(text);}};
}
const rejects=async(f,pattern)=>assert((await f.check()).some(s=>pattern.test(s)),String(pattern));

test('current captured inputs, exact aliases and unchanged requested runtime pass production freshness checks',async t=>{
 const f=await fixture(t);assert.deepEqual(await f.check(),[]);
 const paths=f.manifest.buildInputs.files.map(row=>row.path);
 for(const file of ['mobile/src/save-confirmation.mjs','mobile/package-lock.json','mobile/runtime-assets.json','mobile/release-status.json','mobile/capacitor.config.json','mobile/scripts/stage.mjs','mobile/scripts/bundle-freshness.mjs','mobile/node_modules/fixture-child/index.js'])assert(paths.includes(file),file);
 assert.equal(f.manifest.files.find(r=>r.path==='index.html').sourcePath,'ranch3d.html');
});
test('legacy self-consistent bundles lack freshness provenance and cannot pass',async t=>{
 const f=await fixture(t);f.manifest.schema=1;delete f.manifest.buildInputs;delete f.manifest.bootstrapInputs;
 assert.deepEqual(await f.check(),['Legacy or incomplete native bundle metadata. Run stage again.']);
});
test('core changes invalidate both generated aliases even when every staged hash remains valid',async t=>{
 const f=await fixture(t);await f.write('ranch3d.html','changed core save API');
 const failures=await f.check();assert(failures.includes('Stale raw source: ranch3d.html -> index.html'));assert(failures.includes('Stale raw source: ranch3d.html -> ranch3d.html'));
});
test('Cottonwood completion changes invalidate an otherwise intact old bundle',async t=>{
 const f=await fixture(t);await f.write('assets/features/cottonwood-post.js','export const complete=()=>"verified native acknowledgement";');
 await rejects(f,/Stale raw source: assets\/features\/cottonwood-post\.js/);
});
test('native adapter, store and bootstrap source changes invalidate generated bootstrap provenance',async t=>{
 const f=await fixture(t);
 for(const file of ['mobile/src/bootstrap.js','mobile/src/save-confirmation.mjs','mobile/src/save-store.mjs']){
  const before=await readFile(sourcePath(f.root,file));await f.write(file,String(before)+'\n// changed');await rejects(f,new RegExp('Stale native build input: '+file.replaceAll('.','\\.')));await f.write(file,before);
 }
 assert.deepEqual(await f.check(),[]);
});
test('changed build configuration, lock, staging recipe, validator, asset specification and release inputs require restaging',async t=>{
 const f=await fixture(t);
 for(const file of ['mobile/package.json','mobile/package-lock.json','mobile/capacitor.config.json','mobile/scripts/stage.mjs','mobile/scripts/bundle-freshness.mjs','mobile/runtime-assets.json','mobile/release-status.json']){
  const before=await readFile(sourcePath(f.root,file));await f.write(file,String(before)+'\n');await rejects(f,new RegExp('Stale native build input: '+file.replaceAll('.','\\.')));await f.write(file,before);
 }
});
test('installed dependency source changes are detected independently of an unchanged package lock',async t=>{
 const f=await fixture(t);await f.write('mobile/node_modules/fixture-child/index.js','export const dependency="changed";');
 await rejects(f,/Stale native build input: mobile\/node_modules\/fixture-child\/index\.js/);
});
test('installed compiler wrapper and platform executable drift invalidate an unchanged bootstrap and package lock',async t=>{
 const f=await fixture(t),lock=await readFile(sourcePath(f.root,'mobile/package-lock.json')),bootstrap=await readFile(sourcePath(f.root,'mobile/www/native-bootstrap.js'));
 for(const file of ['mobile/node_modules/esbuild/bin/esbuild','mobile/node_modules/@esbuild/darwin-arm64/bin/esbuild']){
  assert(f.manifest.buildInputs.files.some(row=>row.path===file),'Actual executable bytes are a required captured input');
  const before=await readFile(sourcePath(f.root,file));await f.write(file,Buffer.concat([before,Buffer.from([0,128])]));
  await rejects(f,new RegExp('Stale native build input: '+file.replaceAll('.','\\.')));await f.write(file,before);
 }
 assert.deepEqual(await readFile(sourcePath(f.root,'mobile/package-lock.json')),lock);assert.deepEqual(await readFile(sourcePath(f.root,'mobile/www/native-bootstrap.js')),bootstrap);
 assert.deepEqual(await f.check(),[]);
});
test('new source modules cannot evade verification by being omitted from the manifest inputs',async t=>{
 const f=await fixture(t);await f.write('mobile/src/new-confirmation.mjs','export const needed=true;');await rejects(f,/Required build input omitted: mobile\/src\/new-confirmation\.mjs/);
});
test('new requested runtime assets cannot be omitted from an old still-consistent manifest',async t=>{
 const f=await fixture(t);await f.write('assets/new-route.mjs','export const route=true;');await rejects(f,/Required runtime asset omitted: assets\/new-route\.mjs/);
});
test('excluded authoring files do not change the runtime inventory',async t=>{
 const f=await fixture(t);await f.write('assets/new-source.blend','authoring file');assert.deepEqual(await f.check(),[]);
});
test('removing requested manifest rows or required build/compiled inputs fails closed',async t=>{
 const f=await fixture(t);f.manifest.files=f.manifest.files.filter(r=>r.path!=='assets/expeditions.mjs');await rejects(f,/Required runtime asset omitted: assets\/expeditions\.mjs/);
 f.manifest.buildInputs.files=f.manifest.buildInputs.files.filter(r=>r.path!=='mobile/src/save-confirmation.mjs');await rejects(f,/Required build input omitted: mobile\/src\/save-confirmation\.mjs/);
 f.manifest.bootstrapInputs=f.manifest.bootstrapInputs.filter(p=>p!=='mobile/src/save-store.mjs');await rejects(f,/Required native bootstrap input omitted: mobile\/src\/save-store\.mjs/);
});
test('wrong raw aliases, duplicate rows and escaping paths cannot substitute a source',async t=>{
 const f=await fixture(t);f.manifest.files.find(r=>r.path==='index.html').sourcePath='mobile/src/bootstrap.js';await rejects(f,/incorrect raw source path: index\.html/);
 f.manifest.files.push({...f.manifest.files[0]});await rejects(f,/Duplicate bundle record/);
 f.manifest.files.push({path:'../external.js'});await rejects(f,/Invalid bundle source path/);
 f.manifest.buildInputs.files.push({path:'../external.js',sha256:'x'});await rejects(f,/Invalid bundle source path/);
});
test('an old native bridge cannot be approved by updating only its generated self-hash',async t=>{
 const f=await fixture(t);const old=nativeHtml.replace('awaitConfirmedFresh:()=>window.MeadowlarkNative.confirmedSave(SAVE_KEY)','fresh:freshSave');
 await f.changeOutput('index.html',old);await f.changeOutput('ranch3d.html',old);await rejects(f,/Native reward confirmation bridge missing/);
});
test('a bootstrap without the durability adapter fails even when its own manifest hash matches',async t=>{
 const f=await fixture(t);await f.changeOutput('native-bootstrap.js','function ordinaryMirror(){}');await rejects(f,/Native bootstrap durability adapter missing/);
});
test('generated bytes and alias mismatch are checked beyond raw-source freshness',async t=>{
 const f=await fixture(t);await f.write('mobile/www/assets/expeditions.mjs','damaged file');await rejects(f,/Generated file changed: assets\/expeditions\.mjs/);
 await f.changeOutput('index.html',nativeHtml+'\n// changed alias');await rejects(f,/Generated game aliases disagree/);
});
test('current Git HEAD is required, even with unchanged source bytes and complete input inventory',async t=>{
 const f=await fixture(t);execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','--allow-empty','-m','new source revision'],{cwd:f.root,stdio:'ignore'});
 await rejects(f,/Stale source Git revision/);
});
test('pre-build capture rejects source writes or newly added inputs while a stage is in progress',async t=>{
 const f=await fixture(t),captured=await captureBuildInputs(f.root);await assertBuildInputsUnchanged(f.root,captured);
 await f.write('mobile/src/save-store.mjs','changed during build');await assert.rejects(assertBuildInputsUnchanged(f.root,captured),/changed during staging/);
});
test('approved horse hashes and native development gates cannot be relaxed by fresh self-hashes',async t=>{
 const f=await fixture(t);await f.write('review/horse/model.glb','replacement horse');await f.changeOutput('review/horse/model.glb','replacement horse');
 f.manifest.files.find(r=>r.path==='review/horse/model.glb').sourceSha256=fileHash('replacement horse');await rejects(f,/Approved runtime asset changed: review\/horse\/model\.glb/);
 f.manifest.releaseReady=true;await rejects(f,/Native development release guard changed/);
});
test('staging retains the exact native-only save API injection and captures compiler inputs before building',async()=>{
 const stage=await readFile(new URL('../scripts/stage.mjs',import.meta.url),'utf8');
 assert(stage.includes("const saveConfirmation='save:{KEY:SAVE_KEY,fresh:freshSave,sync:syncSave,ensure(fn)';"));
 assert(stage.includes("html=html.replace(saveConfirmation,'save:{KEY:SAVE_KEY,fresh:freshSave,sync:syncSave,awaitConfirmedFresh:()=>window.MeadowlarkNative.confirmedSave(SAVE_KEY),ensure(fn)');"));
 assert(stage.indexOf('const buildInputs=await captureBuildInputs(root)')<stage.indexOf('for(const directory of spec.roots)'));
 assert(stage.indexOf('const buildInputs=await captureBuildInputs(root)')<stage.indexOf('const nativeBuild=await build('));
 assert(stage.includes('await assertBuildInputsUnchanged(root,buildInputs)'));assert(stage.includes('nativeBuild.metafile.inputs'));assert(stage.includes('releaseReady:false'));
});
