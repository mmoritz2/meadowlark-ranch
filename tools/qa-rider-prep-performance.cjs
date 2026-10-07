/* Reproduce the fitting-kernel speedup without mixing in concurrent art changes.
   Runs the pinned production kit twice: original kernels, then current BVH kernels.
   Every generated attribute/index is hashed, including lashes and neck weights.
   No renderer is created: these are CPU preparation timings, never game FPS.
   Run: NODE_PATH=$(npm root -g) QA_PORT=8431 node tools/qa-rider-prep-performance.cjs
   QA_PREP_REF selects a compatible pre-BVH commit (default 68d31f3).
   QA_PREP_OUTPUT optionally selects another report path. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),QA=require('./qa-platform.cjs');
const root=path.resolve(__dirname,'..'),ref=process.env.QA_PREP_REF||'68d31f3';
const output=path.resolve(process.env.QA_PREP_OUTPUT||path.join(root,'output/character-overhaul',process.env.QA_PREP_VALIDATE_ONLY==='1'?'prep-compatibility-report.json':'prep-performance-report.json'));
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const revision=git('rev-parse',ref).toString().trim();
const paths=git('ls-tree','-r','--name-only',revision,'assets','ranch3d.html').toString().trim().split('\n').filter(p=>p==='ranch3d.html'||/^assets\/rider-[^/]+\.js$/.test(p)||/^assets\/models\/rider\/.*\.glb$/.test(p));
const baseline=new Map(paths.map(p=>[p,git('show',revision+':'+p)])),optimized=new Map(baseline);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const kernels=['rider-head-surface.js','rider-fit.js','rider-heads.js','rider-face.js'];
const current=new Map(kernels.map(p=>[p,fs.readFileSync(path.join(root,'assets',p),'utf8')]));
const replace=(s,from,to,label)=>{if(!s.includes(from))throw Error('Incompatible '+ref+' source: '+label);return s.split(from).join(to);};
const importLine="import {createTriangleSurface} from './rider-head-surface.js?v=prep-qa';\n";
let head=baseline.get('assets/rider-heads.js').toString();
head=replace(head,'const original=skin.geometry.clone().applyMatrix4(inverse),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surface=new THREE.Mesh(original,material);surface.updateMatrixWorld(true);const ray=new THREE.Raycaster(),a=V(),b=V(),c=V(),bary=V();','const original=skin.geometry.clone().applyMatrix4(inverse),surface=createTriangleSurface(THREE,original),a=V(),b=V(),c=V(),bary=V();','head body probe');
head=replace(head,'ray.set(center.clone().addScaledVector(dir,.4),dir.clone().negate());const hit=ray.intersectObject(surface,false)[0];','const hit=surface.cast(center.clone().addScaledVector(dir,.4),dir.clone().negate());','head skin sampling');
head=replace(head,'const headProbe=new THREE.Mesh(headLocal,material);headProbe.updateMatrixWorld(true);','const headProbe=createTriangleSurface(THREE,headLocal);','brow probe');
head=replace(head,'ray.set(V(x,y,.35),V(0,0,-1));return ray.intersectObject(headProbe,false)[0];','return headProbe.cast(V(x,y,.35),V(0,0,-1));','brow ray');
head=replace(head,'original.dispose();material.dispose();eyeSources.forEach(g=>g.dispose());','original.dispose();surface.dispose();headProbe.dispose();eyeSources.forEach(g=>g.dispose());','head disposal');
let face=baseline.get('assets/rider-face.js').toString();
face=replace(face,'const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surface=new THREE.Mesh(face,material),ray=new THREE.Raycaster();surface.updateMatrixWorld(true);','const surface=createTriangleSurface(THREE,face);','lash face probe');
face=replace(face,'const eyeSurface=new THREE.Mesh(eyeGeometry,material);eyeSurface.updateMatrixWorld(true);','const eyeSurface=createTriangleSurface(THREE,eyeGeometry);','lash eye probe');
face=replace(face,'ray.set(V(x,y,.3),V(0,0,-1));return ray.intersectObject(mesh,false)[0];','return mesh.cast(V(x,y,.3),V(0,0,-1));','lash ray');
face=replace(face,'face.dispose();eyeGeometry.dispose();material.dispose();','surface.dispose();eyeSurface.dispose();face.dispose();eyeGeometry.dispose();','lash disposal');
// Pinned art is deliberate; claiming validation of a changed runtime kernel is not.
// Ignore only import cache query values, which do not change module semantics.
const normalizeImports=s=>s.replace(/(from\s*['"][^'"?]+)\?[^'"]*(['"])/g,'$1$2').replace(/\r\n/g,'\n');
const headPrefix=s=>s.split('export function patchStylizedHead')[0];
const currentKernelCompatibility=[
 ['prepareRiderHead prefix',headPrefix(current.get('rider-heads.js')),headPrefix(importLine+head)],
 ['rider-face full source',current.get('rider-face.js'),importLine+face]
].map(([kernel,actual,expected])=>{const a=normalizeImports(actual),b=normalizeImports(expected);return {kernel,pass:a===b,currentNormalizedHash:digest(a),testedNormalizedHash:digest(b)};});
const incompatible=currentKernelCompatibility.filter(c=>!c.pass);
if(incompatible.length){
 const report={pass:false,reference:revision,finishedAt:new Date().toISOString(),reason:'Incompatible current kernel source: pinned replacement templates do not execute the current prepareHead/lash implementation.',currentKernelCompatibility};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
 throw Error(report.reason+' '+incompatible.map(c=>c.kernel).join(', ')+'; report: '+output);
}
if(process.env.QA_PREP_VALIDATE_ONLY==='1'){
 const report={pass:true,reference:revision,finishedAt:new Date().toISOString(),scope:'Static current kernel compatibility only; no browser or preparation benchmark was run.',currentKernelCompatibility};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exit(0);
}
const marker='/* Clip triangles',prefix=current.get('rider-fit.js').split(marker)[0],suffix=baseline.get('assets/rider-fit.js').toString().split(marker)[1];
if(!prefix.includes('createTriangleSurface')||!suffix)throw Error('Expected the BVH sampler and compatible trimGarment source');
optimized.set('assets/rider-head-surface.js',Buffer.from(current.get('rider-head-surface.js')));
optimized.set('assets/rider-fit.js',Buffer.from(prefix+marker+suffix));
optimized.set('assets/rider-heads.js',Buffer.from(importLine+head));
optimized.set('assets/rider-face.js',Buffer.from(importLine+face));
const sourceHashes=Object.fromEntries([...baseline].map(([p,b])=>[p,digest(b)]));
const kernelHashes=Object.fromEntries([...current].map(([p,b])=>[p,digest(b)]));
const RJ=baseline.get('ranch3d.html').toString().match(/const RJ=(\{[\s\S]*?\n\});/)[1];
const instrument=s=>s.replace('export function surfaceSampler(','function underlyingSampler(')+`
export function surfaceSampler(...args){const phase=window.__phase,r=window.__fit[phase]||={builds:0,buildMs:0,casts:0,castMs:0},t=performance.now(),api=underlyingSampler(...args);r.builds++;r.buildMs+=performance.now()-t;return {cast(...q){const t=performance.now(),hit=api.cast(...q);r.casts++;r.castMs+=performance.now()-t;return hit;},dispose(){api.dispose();}};}`;
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const runs=[],errors=[],failedRequests=[];
 try{
  for(const variant of ['baseline','optimized']){
   const sources=variant==='baseline'?baseline:optimized,page=await browser.newPage();
   page.on('pageerror',e=>errors.push({variant,message:e.message}));
   page.on('requestfailed',r=>failedRequests.push({variant,url:r.url(),message:r.failure()?.errorText}));
   page.on('console',m=>{if(m.text().startsWith('PREP '))console.log(m.text());if(m.type()==='error')errors.push({variant,message:m.text()});});
   await page.route('**/__prep_qa.html',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><script>window.RJ=${RJ};window.__phase='import';window.__fit={};</script>`}));
   await page.route('**/__prep_original_fit.js',r=>r.fulfill({contentType:'text/javascript',body:baseline.get('assets/rider-fit.js')}));
   await page.route('**/assets/**',r=>{const p=new URL(r.request().url()).pathname.slice(1);if(!sources.has(p))return r.continue();let body=sources.get(p);if(p==='assets/rider-fit.js')body=instrument(body.toString());return r.fulfill({contentType:p.endsWith('.js')?'text/javascript':'model/gltf-binary',body});});
   await page.goto(QA.BASE+'/__prep_qa.html');
   const measured=await page.evaluate(async variant=>{
    const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js'),{createRiderLibrary}=await import('/assets/rider-model.js');
    const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),bodies=[],oracles=[];
    const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),get=['getX','getY','getZ','getW'];
    const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data.buffer))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const fingerprint=async(geometry,name)=>{const attributes={};for(const [key,a]of Object.entries(geometry.attributes)){const data=new Float64Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=a[get[k]](i);attributes[key]={count:a.count,itemSize:a.itemSize,hash:await hash(data)};}return {name,attributes,index:geometry.index?await hash(new Float64Array(Array.from({length:geometry.index.count},(_,i)=>geometry.index.getX(i)))):null,userData:geometry.userData};};
    const oracle=async(geometry,name)=>{
     const {surfaceSampler:oldSampler}=await import('/__prep_original_fit.js'),{surfaceSampler:newSampler}=await import('/assets/rider-fit.js'),{createTriangleSurface}=await import('/assets/rider-head-surface.js');
     const source={geometry,name},old=oldSampler(THREE,[source]),next=newSampler(THREE,[source]);
     const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster(),index=createTriangleSurface(THREE,geometry);mesh.updateMatrixWorld(true);
     geometry.computeBoundingBox();const box=geometry.boundingBox,center=box.getCenter(V()),size=box.getSize(V()),radius=Math.max(size.x,size.z)*1.2+.5;
     let seed=91451,queries=0,hits=0,rejectedFrontQueries=0,maxPointDifference=0,maxNormalDifference=0,maxWeightDifference=0,failures=[];
     const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
     const compare=(a,b,label)=>{queries++;if(!!a!==!!b){failures.push({label,check:'hit/miss'});return;}if(!a)return;hits++;maxPointDifference=Math.max(maxPointDifference,a.point.distanceTo(b.point));maxNormalDifference=Math.max(maxNormalDifference,a.normal.distanceTo(b.normal));if(a.source!==b.source)failures.push({label,check:'source'});for(let k=0;k<4;k++){if(a.joints[k]!==b.joints[k])failures.push({label,check:'joint',k});maxWeightDifference=Math.max(maxWeightDifference,Math.abs(a.weights[k]-b.weights[k]));}};
     for(let i=0;i<240;i++){
      const angle=rand()*Math.PI*2,y=box.min.y+(box.max.y-box.min.y)*rand(),origin=V(center.x+Math.cos(angle)*radius,y,center.z+Math.sin(angle)*radius),target=V(center.x+(rand()-.5)*size.x*.15,y+(i%3===0?(rand()-.5)*size.y*.5:0),center.z+(rand()-.5)*size.z*.15),direction=target.sub(origin).normalize();
      compare(old.cast(origin,direction),next.cast(origin,direction),'body-'+i);
      const accept=p=>p.z<center.z;const before=old.cast(origin,direction,accept),after=next.cast(origin,direction,accept);compare(before,after,'reject-front-'+i);if(before)rejectedFrontQueries++;
      ray.set(origin,direction);const full=ray.intersectObject(mesh,false)[0],fast=index.cast(origin,direction);
      if(!!full!==!!fast||full&&(full.face.a!==fast.face.a||full.face.b!==fast.face.b||full.face.c!==fast.face.c||full.point.distanceTo(fast.point)>1e-10))failures.push({label:'direct-'+i,check:'full Mesh oracle'});
     }
     old.dispose();next.dispose();index.dispose();material.dispose();
     return {name,queries,hits,rejectedFrontQueries,maxPointDifference,maxNormalDifference,maxWeightDifference,failures,pass:!failures.length&&maxPointDifference<1e-10&&maxNormalDifference<1e-10&&maxWeightDifference<1e-10};
    };
    for(const body of ['f','m']){
     window.__phase='kit-'+body;let t=performance.now();const kit=await lib.kit(body),kitMs=performance.now()-t;console.log('PREP '+variant+' kit-'+body+' '+kitMs.toFixed(1)+'ms');
     const kitHashes=[];for(const [name,g]of [['body',kit.skin.geometry],['head',kit.headAsset.mesh.geometry],['head-local',kit.headAsset.local],['eyes',kit.eyes.geometry],['brows',kit.brows.geometry],...(kit.lashGeo?[['lashes',kit.lashGeo]]:[]),...Object.entries(kit.hair).map(([n,h])=>[n,h.geometry])])kitHashes.push(await fingerprint(g,name));
     window.__phase='outfit-'+body;t=performance.now();const [polo,peasant]=await Promise.all([lib.outfitFor(kit,'polo'),lib.outfitFor(kit,'peasant')]),outfitMs=performance.now()-t;console.log('PREP '+variant+' outfit-'+body+' '+outfitMs.toFixed(1)+'ms');
     const outfitHashes=[];for(const [name,s]of [['polo',polo],['peasant',peasant]])for(let i=0;i<s.meshes.length;i++)outfitHashes.push(await fingerprint(s.meshes[i].geometry,name+'-'+i+'-'+s.meshes[i].name));
     bodies.push({body,kitMs,outfitMs,kitHashes,outfitHashes});
     if(variant==='optimized'){window.__phase='oracle-'+body;oracles.push(await oracle(kit.skin.geometry,'production-body-'+body));}
    }
    if(variant==='optimized'){
     const {surfaceSampler:oldSampler}=await import('/__prep_original_fit.js'),{surfaceSampler:newSampler}=await import('/assets/rider-fit.js');
     const geometry=new THREE.BufferGeometry(),P=[],J=[],W=[];for(const z of [.1,0,-.1])for(const p of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){P.push(...p,z);J.push(1,2,3,0);W.push(.2+(p[0]+1)*.1,.3,.5-(p[0]+1)*.1,0);}geometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4));
     const source={geometry,name:'layered'},second={geometry,name:'duplicate'},old=oldSampler(THREE,[source,second]),next=newSampler(THREE,[source,second]),cases=[];
     for(const [name,accept,expectedSource,expectedZ]of [['reject-nearest',p=>p.z<.05,source,0],['reject-source',(_,s)=>s===second,second,.1],['reject-all',()=>false,null,null]]){const origin=V(.17,.21,.4),direction=V(0,0,-1),a=old.cast(origin,direction,accept),b=next.cast(origin,direction,accept);cases.push({name,pass:!!a===!!b&&(!a||a.point.distanceTo(b.point)<1e-10&&a.source===b.source&&JSON.stringify(a.joints)===JSON.stringify(b.joints)&&a.weights.every((w,k)=>Math.abs(w-b.weights[k])<1e-10))&&(!b?expectedSource===null:b.source===expectedSource&&Math.abs(b.point.z-expectedZ)<1e-8),hitZ:b?.point.z??null,source:b?.source.name??null});}
     old.dispose();next.dispose();geometry.dispose();oracles.push({name:'layered-rejections',cases,pass:cases.every(c=>c.pass)});
    }
    return {variant,bodies,fit:window.__fit,oracles};
   },variant);runs.push(measured);await page.close();
  }
  const differences=[];for(let b=0;b<2;b++)for(const group of ['kitHashes','outfitHashes']){const a=runs[0].bodies[b][group],z=runs[1].bodies[b][group];for(let i=0;i<Math.max(a.length,z.length);i++)if(JSON.stringify(a[i])!==JSON.stringify(z[i]))differences.push({body:runs[0].bodies[b].body,group,before:a[i],after:z[i]});}
  const report={reference:revision,sourceHashes,kernelHashes,currentKernelCompatibility,baseUrl:QA.BASE,finishedAt:new Date().toISOString(),scope:'Pinned geometry and visual code with original versus current BVH fitting kernels; CPU kit and outfit preparation only. Fresh pages, one shared browser, baseline first. Single runs are observations, not statistical performance guarantees. Oracle queries run after each optimized phase timing.',runs,differences,errors,failedRequests,byteIdentical:!differences.length,oraclePass:runs[1].oracles.every(o=>o.pass)};
  report.pass=report.byteIdentical&&report.oraclePass&&!errors.length&&!failedRequests.length;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:report.pass,report:output,byteIdentical:report.byteIdentical,oraclePass:report.oraclePass,runs:runs.map(r=>({variant:r.variant,bodies:r.bodies.map(({body,kitMs,outfitMs})=>({body,kitMs,outfitMs})),oracles:r.oracles})),differences: differences.length,errors,failedRequests},null,2));if(!report.pass)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
