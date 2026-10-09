// CPU-only regression checks. Executes the selector and current runtime seams.
// No renderer, browser, textures, GPU, or tracked source edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';

// Intended tracked location: tools/test-pastoral-woodland.mjs.
// PASTORAL_REPO overrides repository inference; candidate paths are optional.
// PASTORAL_CORE_ONLY=1 runs only pure selector and ownership-policy tests.
const MODEL_SHA='5393f0c370b385920b840850881d4fbb25afc965f3e1dc24bda596572476b538';
const CORE_ONLY=process.env.PASTORAL_CORE_ONLY==='1';
function inferRoot(){
 let dir=path.dirname(fileURLToPath(import.meta.url));
 while(!fs.existsSync(path.join(dir,'ranch3d.html'))){const next=path.dirname(dir);if(next===dir)throw Error('Set PASTORAL_REPO to a Meadowlark Ranch checkout');dir=next;}
 return dir;
}
const ROOT=path.resolve(process.env.PASTORAL_REPO||inferRoot());
const fromRoot=p=>import(pathToFileURL(path.join(ROOT,p)));
const selectorURL=pathToFileURL(path.resolve(process.env.PASTORAL_SELECTOR||path.join(ROOT,'assets/pastoral-woodland.mjs')));
const {selectPastoralWoodland,isOrdinaryTrunkCircle,PASTORAL_GROVES,PASTORAL_UPRIGHT_LIMIT}=await import(selectorURL);
const T=CORE_ONLY?null:await fromRoot('assets/vendor/three/build/three.module.js');
const {createSolidWorld}=CORE_ONLY?{}:await fromRoot('assets/solid-collisions.js');
const woodURL=pathToFileURL(path.resolve(process.env.PASTORAL_WOOD||path.join(ROOT,'assets/upright-broadleaf-wood-proxies.mjs')));
const {UPRIGHT_HYBRID_WOOD_BOXES:BOXES,UPRIGHT_HYBRID_WOOD_SOURCE_HEIGHT:HEIGHT,
 UPRIGHT_HYBRID_WOOD_SOURCE_FOOT:FOOT,UPRIGHT_HYBRID_WOOD_SOURCE_SHA:SHA}=CORE_ONLY?{}:await import(woodURL);
const modelPath=path.resolve(process.env.PASTORAL_MODEL||path.join(ROOT,'assets/models/world/realism/upright_broadleaf_01.glb'));
const runtimePath=path.resolve(process.env.PASTORAL_RUNTIME||path.join(ROOT,'assets/world-photoscans.js'));
const runtime=CORE_ONLY?'':fs.readFileSync(runtimePath,'utf8');
// In-memory diagnostic counters; this test never writes evidence files.
const evidence={checks:{}};
function sliceBetween(start,end){const i=runtime.indexOf(start);assert(i>=0,`missing runtime marker ${start}`);const j=runtime.indexOf(end,i);assert(j>i,`missing runtime end ${end}`);return runtime.slice(i,j);}
function nativeCPU(fn){const random=Math.random;Math.random=()=>{throw Error('CPU operation consumed world RNG');};try{return fn();}finally{Math.random=random;}}
function site(i=0,changes={}){return {id:`site-${i}`,x:111+i*.003,z:-110+i*.007,height:10,yaw:.137*i,kind:'oak',source:'canopy-broadleaf',...changes};}
function cohort(){return PASTORAL_GROVES.flatMap((g,j)=>Array.from({length:g.cap+5},(_,i)=>site(i,{id:`${g.id}-${i}`,x:g.x+i*.04,z:g.z+i*.03,height:9+(i%6),yaw:i*.31,source:i%2?'broadleaf':{key:'woodland-broadleaf'}})));}
function selectedIDs(rows){return rows.map(r=>[r.tree.id,r.grove]);}
function source(){return {key:'upright-broadleaf',meta:{sourceHeight:HEIGHT},bounds:{min:{y:FOOT}}};}
const slab={bottom:.38,top:2.65,radius:.55};

test('seven stands meet caps without RNG, input mutation, or traversal-order dependence',()=>{
 const input=cohort();for(const t of input)Object.freeze(t);Object.freeze(input);
 const before=JSON.stringify(input),forward=nativeCPU(()=>selectPastoralWoodland(input));
 const reversed=nativeCPU(()=>selectPastoralWoodland([...input].reverse()));
 assert.equal(PASTORAL_UPRIGHT_LIMIT,54);assert.equal(forward.length,54);
 assert.equal(new Set(forward.map(r=>r.tree)).size,54);
 assert.deepEqual(selectedIDs(reversed),selectedIDs(forward));
 for(const g of PASTORAL_GROVES)assert.equal(forward.filter(r=>r.grove===g.id).length,g.cap);
 assert.equal(JSON.stringify(input),before);assert(forward.every(r=>input.includes(r.tree)));
 evidence.checks.deterministicCap={selected:forward.length,groves:PASTORAL_GROVES.map(g=>({id:g.id,cap:g.cap}))};
});

test('source, authored, species, finite, town, height, and warm-climate exclusions hold at boundaries',()=>{
 const good=[site(1,{height:9}),site(2,{height:14,source:{key:'mature-leaf-broadleaf'}}),site(3,{kind:'pine',source:'broadleaf'})];
 const bad=[site(10,{height:8.9999}),site(11,{height:14.0001}),site(12,{x:NaN}),site(13,{z:Infinity}),site(14,{height:NaN}),
  ...['authoredOrchard','authoredVillage','authoredWoodlandEdge'].map((key,i)=>site(20+i,{[key]:true})),
  ...['cold','snowpine','willow','orchard','village'].map((kind,i)=>site(30+i,{kind})),
  ...['mature-pine','pine-0','upright-broadleaf','orchard-broadleaf','unknown'].map((key,i)=>site(40+i,{source:{key}})),
  site(50,{x:47,z:-50}),site(51,{x:111.8})];
 const coldAt=(x)=>x===111.8?.080001:.08;
 assert.deepEqual(selectPastoralWoodland([...good,...bad],{coldAt}).map(r=>r.tree.id),good.map(t=>t.id));
 assert.equal(selectPastoralWoodland(good,{coldAt:()=>.080001}).length,0);
 evidence.checks.exclusions={validBoundarySites:good.length,rejectedCases:bad.length,warmFormerPineAllowed:true};
});

test('clearance rejection refills from the same stand without exceeding its cap',()=>{
 const input=cohort(),rejected=new Set(input.filter(t=>Number(t.id.split('-').at(-1))<4));
 const got=selectPastoralWoodland(input,{canReplace:t=>!rejected.has(t)});
 assert.equal(got.length,54);assert(got.every(r=>!rejected.has(r.tree)));
 for(const g of PASTORAL_GROVES)assert.equal(got.filter(r=>r.grove===g.id).length,g.cap);
 evidence.checks.refillAfterClearance=true;
});

test('ordinary trunk policy rejects unknown ownership metadata and nonfinite footprints',()=>{
 for(const c of [{x:1,z:2,r:.8},{x:1,z:2,r:.8,height:9},{x:1,z:2,r:.8,height:9,trunk:true}])assert.equal(isOrdinaryTrunkCircle(c),true);
 for(const change of [{r:0},{r:-1},{r:1.20001},{r:NaN},{x:NaN},{z:Infinity},{decor:true},{id:'plot'},{precise:true},{plant:true},{landform:true},{climb:true},{terrainCliff:true},{authoredWoodlandEdge:true},{futureOwner:true}])assert.equal(isOrdinaryTrunkCircle({x:1,z:2,r:.8,...change}),false,JSON.stringify(change));
});

// These snippets are the actual candidate runtime blocks, not separate copies of their algorithms.
const placementCode=CORE_ONLY?'':sliceBetween('    for(const t of trees){\n      const scale=t.height/t.source.meta.sourceHeight','    if(edge.trees.length&&');
const place=new Function('THREE','trees','W','q','s','v','UP',placementCode);
const registrationCode=CORE_ONLY?'':sliceBetween('    if(pastoral.trees.length){','    pastoral.trees=pastoral.trees.map');
const register=new Function('THREE','pastoral','group','identity','uprightSource','UPRIGHT_HYBRID_WOOD_BOXES','UPRIGHT_HYBRID_WOOD_SOURCE_SHA','W','G',registrationCode);
const replacementCode=CORE_ONLY?'':sliceBetween('    const pastoral=state.pastoralWoodland=','    state.villageEvergreens=');
const replace=new Function('THREE','state','trees','uprightSource','W','G','window','routes','edgeWoodRadius','cottonwoodReserved','segmentDistance','coldWoodlandWeights','selectPastoralWoodland','isOrdinaryTrunkCircle',replacementCode+'return pastoral;');
function fixture(trees,{circles=null,forestPoints=null}={}){
 const world=createSolidWorld({THREE:T}),scene=new T.Scene(),group=new T.Group();scene.add(group);
 const W={solidWorld:world,groundH:()=>0,pathDist:()=>1e6,walls:[],colliders:circles||trees.map(t=>({x:t.x,z:t.z,r:.8,height:t.height})),forestPoints:forestPoints||trees.map(t=>({x:t.x,z:t.z,s:t.height/8}))};
 const invalidations={count:0},G={worldPaths:{trackDist:()=>1e6},followCam:{invalidateTrees(){invalidations.count++;}}};
 return {world,scene,group,W,G,invalidations};
}
function runReplace(trees,f,override={}){
 const state={},S=source();
 const result=replace(T,state,trees,S,f.W,f.G,override.window||{},override.routes||[],()=>1.9,override.cottonwoodReserved||(()=>false),override.segmentDistance||(()=>1e6),()=>({weight:0}),selectPastoralWoodland,isOrdinaryTrunkCircle);
 return {pastoral:result,S};
}
function commit(pastoral,f,S=source()){
 // The runtime allocates one native Group (whose UUID uses randomness). Block
 // RNG only inside the real collision registry, after that explicit setup.
 const original=f.W.solidWorld.register;
 f.W.solidWorld.register=(...args)=>nativeCPU(()=>original(...args));
 try{return register(T,pastoral,f.group,new T.Matrix4(),S,BOXES,SHA,f.W,f.G);}
 finally{f.W.solidWorld.register=original;}
}

test('actual source replacement and matrix block preserve original root, yaw and post-legacy height',{skip:CORE_ONLY},()=>{
 const input=[site(0,{height:9,yaw:0}),site(1,{height:14,yaw:2.37}),site(2,{height:11.26,yaw:-1.13})];
 const before=input.map(t=>({x:t.x,z:t.z,height:t.height,yaw:t.yaw})),f=fixture(input),{pastoral,S}=runReplace(input,f);
 assert.equal(pastoral.trees.length,input.length);
 const q=new T.Quaternion(),s=new T.Vector3(),v=new T.Vector3(),UP=new T.Vector3(0,1,0);
 nativeCPU(()=>place(T,input,{groundH:(x,z)=>3+x*.012-z*.004},q,s,v,UP));
 for(let i=0;i<input.length;i++){
  const t=input[i],old=before[i];assert.deepEqual({x:t.x,z:t.z,height:t.height,yaw:t.yaw},old);assert.equal(t.source,S);
  const pos=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();t.matrix.decompose(pos,rotation,scale);
  assert.equal(pos.x,old.x);assert.equal(pos.z,old.z);assert(Math.abs(scale.x-old.height/HEIGHT)<1e-12);
  assert(Math.abs(scale.x-scale.y)<1e-12&&Math.abs(scale.y-scale.z)<1e-12);
  assert(Math.abs(rotation.angleTo(new T.Quaternion().setFromAxisAngle(UP,old.yaw)))<1e-7);
  const foot=new T.Vector3(0,FOOT,0).applyMatrix4(t.matrix);
  assert(Math.abs(foot.y-(3+old.x*.012-old.z*.004-.07))<1e-12);
 }
 evidence.checks.originalRootMatrix=true;
});

test('actual replacement guard rejects unsafe ownership and route contacts before changing source',{skip:CORE_ONLY},()=>{
 const cases=[
  {name:'no matching circle',circles:[]},
  ...[{r:1.201},{r:NaN},{r:0},{r:-1},{precise:true},{landform:true},{plant:true},{decor:true},{id:'owner'},{climb:true},{terrainCliff:true},{authoredWoodlandEdge:true}].map(v=>({name:JSON.stringify(v),circles:[{x:111,z:-110,r:.8,...v}]})),
  {name:'path',setup:f=>{f.W.pathDist=()=>4.8;}},
  {name:'track',setup:f=>{f.G.worldPaths.trackDist=()=>4.8;}},
  {name:'on course',override:{window:{__onCourse:()=>true}}},
  {name:'race corridor',override:{routes:[[[110,-110],[120,-110]]],segmentDistance:()=>6.8}},
  {name:'wall',setup:f=>{f.W.walls=[{x1:110,z1:-110,x2:120,z2:-110}];},override:{segmentDistance:()=>2.6}},
  {name:'reserved village',override:{cottonwoodReserved:()=>true}},
  {name:'existing solid',setup:f=>{f.W.solidWorld.resolve=p=>{p.x+=.02;return 1;};}},
 ];
 for(const c of cases){const input=[site()],f=fixture(input,{circles:c.circles});c.setup?.(f);const before=JSON.stringify(f.W.colliders);assert.equal(runReplace(input,f,c.override).pastoral.trees.length,0,c.name);assert.equal(input[0].source,'canopy-broadleaf');assert.equal(JSON.stringify(f.W.colliders),before);}
 evidence.checks.guardRejected=cases.length;
});

test('9–14m upright wood uses the complete resident source and all boxes clear registry cutoff',{skip:CORE_ONLY},()=>{
 const raw=fs.readFileSync(modelPath);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),MODEL_SHA);assert.equal(SHA,MODEL_SHA,'proxy provenance must track the full-crown source');assert.equal(BOXES.length,1060);
 const minY=Math.min(...BOXES.map(b=>(b.max[1]-b.min[1])*9/HEIGHT));assert(minY>=.02);
 const records=[9,9.7,11.3,12.6,14].map((height,i)=>site(i,{x:i*12,z:0,height,yaw:i*.771,source:source()}));
 const f=fixture(records),q=new T.Quaternion(),s=new T.Vector3(),v=new T.Vector3(),UP=new T.Vector3(0,1,0);
 nativeCPU(()=>place(T,records,f.W,q,s,v,UP));
 const pastoral={trees:records};records.forEach((t,i)=>{t.pastoralLegacyCircles=[f.W.colliders[i]];t.pastoralGrove='fixture';});
 commit(pastoral,f);
 assert.equal(f.world.stats().parts,records.length*1060);assert.equal(pastoral.collision.registeredParts,5300);assert.equal(f.group.children[0].children.length,0);
 const detail=new T.Group(),card=new T.Group();f.scene.add(detail,card);
 const hit=()=>records.map(t=>{const p=new T.Vector3(t.x,0,t.z),contacts=f.world.resolve(p,slab);assert(contacts>0);assert(p.toArray().every(Number.isFinite));return {contacts,p:p.toArray()};});
 detail.visible=true;card.visible=false;const high=nativeCPU(hit);
 for(const tier of ['medium','low']){detail.visible=false;card.visible=true;assert.deepEqual(nativeCPU(hit),high,`${tier} render visibility changed physical wood`);}
 const owner=f.group.children[0];f.world.unregister(owner);assert.equal(f.world.stats().parts,0);
 evidence.checks.minimumScaleAndLOD={registeredParts:5300,minWorldBoxY:minY,heights:records.map(t=>t.height)};
});

test('actual collision commit preserves collider identities/order and all forest-point bytes',{skip:CORE_ONLY},()=>{
 const input=[site(0,{x:111,z:-110,height:9}),site(1,{x:119,z:-110,height:14})],f=fixture(input);
 const unrelated={x:999,z:999,r:2,precise:true,id:'unrelated'};f.W.colliders.splice(1,0,unrelated);
 const originals=f.W.colliders.slice(),unrelatedJSON=JSON.stringify(unrelated),forestJSON=JSON.stringify(f.W.forestPoints);
 const {pastoral,S}=runReplace(input,f);assert.equal(pastoral.trees.length,2);
 nativeCPU(()=>place(T,input,f.W,new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Vector3(0,1,0)));
 commit(pastoral,f,S);
 assert.equal(f.W.colliders.length,originals.length);f.W.colliders.forEach((c,i)=>assert.equal(c,originals[i]));
 assert.equal(JSON.stringify(unrelated),unrelatedJSON);assert.equal(JSON.stringify(f.W.forestPoints),forestJSON);assert.equal(f.invalidations.count,1);
 for(const t of pastoral.trees){const c=t.pastoralLegacyCircles[0];assert(c.precise&&c.trunk);assert.equal(c.r,t.lowWoodRadius);assert.equal(c.height,t.height);}
 evidence.checks.originalCollections=true;
});

test('a partial solid registration rolls back before touching legacy circles or forest points',{skip:CORE_ONLY},()=>{
 const input=[site()],f=fixture(input),{pastoral,S}=runReplace(input,f);
 nativeCPU(()=>place(T,input,f.W,new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Vector3(0,1,0)));
 const circles=JSON.stringify(f.W.colliders),forest=JSON.stringify(f.W.forestPoints),original=f.world.register;
 f.world.register=owner=>original(owner)-1;
 assert.throws(()=>commit(pastoral,f,S),/Incomplete pastoral wood contacts/);
 assert.equal(f.world.stats().parts,0);assert.equal(f.group.children.length,0);assert.equal(f.invalidations.count,0);
 assert.equal(JSON.stringify(f.W.colliders),circles);assert.equal(JSON.stringify(f.W.forestPoints),forest);
 evidence.checks.atomicRegistrationFailure=true;
});

test('grounded cardinal and diagonal approaches contact wood and finish with no residual overlap',{skip:CORE_ONLY},()=>{
 let totalContacts=0,maxStep=0,queries=0;
 for(const [height,yaw] of [[9,0],[9,1.71],[14,-.64],[14,2.4]]){
  const input=[site(0,{x:0,z:0,height,yaw,source:source()})],f=fixture(input),t=input[0];
  t.pastoralLegacyCircles=[f.W.colliders[0]];
  place(T,input,f.W,new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Vector3(0,1,0));commit({trees:input},f);
  for(let direction=0;direction<8;direction++){
   const a=direction*Math.PI/4,p=new T.Vector3(Math.cos(a)*3.5,0,Math.sin(a)*3.5),check=p.clone();
   assert.equal(f.world.resolve(check,slab),0);let contacts=0;
   for(let tick=0;tick<80;tick++){
    const previous={x:p.x,z:p.z,bottom:slab.bottom,top:slab.top},d=Math.hypot(p.x,p.z);
    p.x-=p.x/d*.071;p.z-=p.z/d*.071;
    contacts+=f.world.resolve(p,{...slab,previous});queries++;
    assert(p.toArray().every(Number.isFinite));assert(Math.hypot(p.x,p.z)>.1);
    maxStep=Math.max(maxStep,Math.hypot(p.x-previous.x,p.z-previous.z));
    check.copy(p);assert.equal(f.world.resolve(check,slab),0,'resolved grounded step must be free of residual wood contact');
    assert.deepEqual(check.toArray(),p.toArray());
   }
   assert(contacts>0);totalContacts+=contacts;
  }
 }
 assert(maxStep<.10,'ordinary small movement cannot teleport out of wood');
 evidence.checks.groundedApproaches={directions:32,queries,totalContacts,maxStep};
});

test('maximum allowed cohort registers without dropped fragments; CPU contact timing is measured',{skip:CORE_ONLY},()=>{
 const input=Array.from({length:PASTORAL_UPRIGHT_LIMIT},(_,i)=>site(i,{x:(i%10)*10,z:Math.floor(i/10)*10,height:9+(i%6),yaw:i*.43,source:source()}));
 const f=fixture(input);input.forEach((t,i)=>{t.pastoralLegacyCircles=[f.W.colliders[i]];t.pastoralGrove='stress';});
 nativeCPU(()=>place(T,input,f.W,new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Vector3(0,1,0)));
 const pastoral={trees:input},start=performance.now();
 commit(pastoral,f);
 const registerMs=performance.now()-start;assert.equal(f.world.stats().parts,PASTORAL_UPRIGHT_LIMIT*1060);
 const queryStart=performance.now();let contacts=0,queries=0;
 nativeCPU(()=>{for(let loop=0;loop<10;loop++)for(const t of input){const p=new T.Vector3(t.x,0,t.z);contacts+=f.world.resolve(p,slab);queries++;assert(p.toArray().every(Number.isFinite));}});
 assert(contacts>0);
 evidence.cpuCost={parts:f.world.stats().parts,registerMs,queries,queryMs:performance.now()-queryStart,contacts,scope:'CPU fixture timing only; not a game frame or GPU benchmark'};
});
