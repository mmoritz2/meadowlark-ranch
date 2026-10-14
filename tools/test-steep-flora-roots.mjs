import {normalizeCountrysideVistaSource} from './countryside-vista-source-guard.cjs';
import {activeWorldTree} from '../assets/countryside-vista-owners.mjs';
import {normalizeCoyoteMacroSource} from './coyote-macroform-source-guard.mjs';
import {normalizePastoralSource} from './pastoral-source-guard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {fixture as terrain} from './contour-fixture.mjs';
import {retireSteepFallsFloraTrees} from '../assets/hollowpeak-flora-roots.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
function exactCache(source,pairs){for(const [after,before]of pairs){assert.equal(source.split(after).length,2,'Final regional cache edge must occur exactly once: '+after);source=source.replace(after,before);}return source;}
// Approved post-layout Chalk response is independently exercised against actual
// native rows. Remove only these exact additions from the older layout guard.
function withoutChalkRenderResponse(source){
 for(const added of ["import {applyChalkGrassMesh,applyChalkFlowerMesh} from '../chalk-grazing.mjs?v=chalk-grazing-1';\n"," // Keep original submitted plant sizes through the course-clear gather/mow.\n // Final cover readiness invokes this response after clearing; existing zero\n // rows, source counts/colours, planting decisions and outside bytes stay exact.\n F.refreshChalkGrazing=()=>F.chalkGrazing={\n  tuft:applyChalkGrassMesh(BANK.tuft.im,groundH,BANK.tuft.n),\n  brack:applyChalkGrassMesh(BANK.brack.im,groundH,BANK.brack.n),\n  petal:applyChalkFlowerMesh(BANK.petal.im,BANK.petal.n)};\n\n"]){
  assert.equal(source.split(added).length,2,'Exactly one declared Chalk render addition');
  source=source.replace(added,added.startsWith(' //')?'\n':'');
 }
 // Only the declared River decision-sampler prefix is normalized here.
 // Independent river fixtures exercise its actual reference grid and seating.
 const river='W.riverBankPlacement?.heightAt||W.canyonPlacement?.heightAt';
 assert.equal(source.split(river).length,2,'Exactly one original-planning River adapter');
 return source.replace(river,'W.canyonPlacement?.heightAt');
}
const source=exactCache(withoutChalkRenderResponse(normalizePastoralSource(read('../assets/features/world-flora.js'),'assets/features/world-flora.js')),[["import {canyonCliffAt} from '../canyon-landscape.js?v=regional-landmarks-1';","import {canyonCliffAt} from '../canyon-landscape.js?v=countryside-banks-1';"]]),baseline=read('./fixtures/steep-flora-11fb567/world-flora.js');
const actualPhoto=read('../assets/world-photoscans.js'),photo=exactCache(normalizeCoyoteMacroSource(normalizeCountrysideVistaSource(actualPhoto,'assets/world-photoscans.js'),'assets/world-photoscans.js'),[["import {retireSteepFallsFloraTrees} from './hollowpeak-flora-roots.mjs?v=regional-landmarks-1';","import {retireSteepFallsFloraTrees} from './hollowpeak-flora-roots.mjs?v=steep-flora-roots-1';"],["import {OASIS_FACE} from './canyon-landscape.js?v=regional-landmarks-1';","import {OASIS_FACE} from './canyon-landscape.js?v=countryside-banks-1';"]]),oldPhoto=read('./fixtures/steep-flora-11fb567/world-photoscans.js');
function fixture(body=source,{height=terrain.height,planned=terrain.oldHeight,capacity=40}={}){
 const geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial(),BANK={};for(const kind of ['pine','cold','oak','trunk'])BANK[kind]={im:new T.InstancedMesh(geometry,material,capacity),n:0,cap:capacity};
 const W={colliders:[],forestPoints:[],sceneryArt:{containsWaterfall:()=>false},terrainH:height,hollowpeakPlacement:{heightAt:planned}},G={world:W,vistas:{clearZones:[]},floraPkg:{bank:BANK,treeOwners:[]}},F=G.floraPkg;
 let seed=0x9e3779b9,draws=0;const rnd=()=>{draws++;seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;},occupancy=[];
 const text=body.slice(body.indexOf(' function tree('),body.indexOf(' function snag(')),tree=new Function('G','W','BANK','groundH','F','TREE','BARK','_e','_q','_sc','_v','_m','_col','rnd','addOcc',text+'return tree;')(G,W,BANK,height,F,{pine:'#dfeccd',cold:'#eef7fb',oak:'#dff0c8'},{pine:'#cdc2ad',cold:'#d2d6d4',oak:'#e4dac6'},new T.Euler(),new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Matrix4(),new T.Color(),rnd,(...p)=>occupancy.push(p));
 return{G,W,F,BANK,tree,rnd,draws:()=>draws,occupancy};
}
function scan(o){return{x:Math.fround(o.x),z:Math.fround(o.z),height:5.639597798629273,kind:o.kind,source:{key:'pine-1',triangles:70},stem:o.trunk,stemIndex:o.trunkIndex,leaves:o.canopy,index:o.canopyIndex,floraOwner:o,matrix:new T.Matrix4().makeTranslation(Math.fround(o.x),terrain.height(o.x,o.z),Math.fround(o.z)),tint:new T.Color(.5,.7,.4)};}
const actual={x:-195.62458998476825,z:-268.0701770336269,h:7.182703861268237};
function planted(options={}){const f=fixture(source,options);f.tree('cold',actual.x,actual.z,actual.h,.71);const owner=f.F.treeOwners[0];return{...f,owner,record:scan(owner)};}
const zero=new T.Matrix4().makeScale(0,0,0);
function bytes(mesh){return{matrix:Array.from(mesh.instanceMatrix.array),color:mesh.instanceColor&&Array.from(mesh.instanceColor.array),count:mesh.count,capacity:mesh.instanceMatrix.count};}
test('actual tree() metadata leaves every seeded draw, accepted row, colour, occupancy and physics value exact',()=>{
 const a=fixture(baseline),b=fixture(source);for(let i=0;i<50;i++){const kind=i%3===0?'cold':i%3===1?'pine':'oak',args=[kind,80+i*3,-330+i*2,5+i*.13,.7+i*.003,null,null,i%8===0];assert.equal(a.tree(...args),b.tree(...args));}
 assert.equal(a.draws(),b.draws());assert.deepEqual(Array.from({length:20},()=>a.rnd()),Array.from({length:20},()=>b.rnd()));assert.deepEqual(a.occupancy,b.occupancy);assert.deepEqual(a.W.colliders,b.W.colliders);assert.deepEqual(a.W.forestPoints,b.W.forestPoints);
 for(const kind of Object.keys(a.BANK)){assert.equal(a.BANK[kind].n,b.BANK[kind].n);assert.deepEqual(bytes(a.BANK[kind].im),bytes(b.BANK[kind].im));}
 for(const o of b.F.treeOwners){assert.equal(o.canopy,b.BANK[o.kind].im);if(o.trunkIndex===null)assert.equal(o.trunk,null);else assert.equal(o.trunk,b.BANK.trunk.im);if(o.collider)assert(b.W.colliders.includes(o.collider));if(o.forestPoint)assert(b.W.forestPoints.includes(o.forestPoint));}
});
test('exact current native-grid steep cold tree retires its original double-coordinate owners and both source rows without RNG',()=>{
 const f=planted(),beforeForest=f.W.forestPoints.slice(),beforeCollider=f.W.colliders.slice(),colours=Array.from(f.owner.canopy.instanceColor.array),counts=[f.BANK.cold.n,f.BANK.trunk.n],matrices=Object.fromEntries(Object.entries(f.BANK).map(([k,b])=>[k,bytes(b.im)]));
 assert(Math.abs(Math.hypot(terrain.height(actual.x+1,actual.z)-terrain.height(actual.x-1,actual.z),terrain.height(actual.x,actual.z+1)-terrain.height(actual.x,actual.z-1))*.5-2.36586005405)<1e-8);assert.notEqual(f.owner.x,f.record.x);assert.notEqual(f.owner.z,f.record.z);
 const previous=Math.random;Math.random=()=>assert.fail('Retirement consumed UUID/global RNG');let result;try{result=retireSteepFallsFloraTrees(f.G,[f.record],zero);}finally{Math.random=previous;}
 assert.equal(result.retired.length,1);assert.equal(f.record.retiredFallsFlora,true);assert.equal(result.retired[0].x,actual.x);assert.deepEqual(result.retired[0].collider,beforeCollider[0]);assert.deepEqual(result.retired[0].forestPoint,beforeForest[0]);assert.equal(f.W.colliders.length,0);assert.equal(f.W.forestPoints.length,0);
 assert.deepEqual([f.BANK.cold.n,f.BANK.trunk.n],counts);assert.deepEqual(Array.from(f.owner.canopy.instanceColor.array),colours);for(const kind of ['cold','trunk']){assert.equal(f.BANK[kind].im.instanceMatrix.count,matrices[kind].capacity);assert.deepEqual(Array.from(f.BANK[kind].im.instanceMatrix.array.subarray(0,16)),zero.elements);assert.deepEqual(Array.from(f.BANK[kind].im.instanceMatrix.array.subarray(16)),matrices[kind].matrix.slice(16));}assert.deepEqual(bytes(f.BANK.oak.im),matrices.oak);
 assert.equal(retireSteepFallsFloraTrees(f.G,[f.record],zero).retired.length,0);
});
test('a near-identical unrelated collider/forest record survives; copied ownership and ambiguous scan ownership cannot retire',()=>{
 const f=planted(),nearCollider={...f.owner.collider,x:f.owner.x+.000001},nearPoint={...f.owner.forestPoint,x:f.owner.x+.000001};f.W.colliders.unshift(nearCollider);f.W.forestPoints.unshift(nearPoint);const result=retireSteepFallsFloraTrees(f.G,[f.record],zero);assert.equal(result.retired.length,1);assert.deepEqual(f.W.colliders,[nearCollider]);assert.deepEqual(f.W.forestPoints,[nearPoint]);
 for(const mutation of [g=>g.owner.collider={...g.owner.collider},g=>g.owner.forestPoint={...g.owner.forestPoint},g=>g.record.stemIndex++,g=>g.record.source.key='canopy-broadleaf',g=>g.W.colliders[0].trunk=true]){const g=planted(),was=g.W.colliders.slice(),matrix=bytes(g.owner.canopy);mutation(g);assert.equal(retireSteepFallsFloraTrees(g.G,[g.record],zero).retired.length,0);assert.deepEqual(g.W.colliders,was);assert.deepEqual(bytes(g.owner.canopy),matrix);}
 const g=planted();assert.equal(retireSteepFallsFloraTrees(g.G,[g.record,{...g.record}],zero).retired.length,0);
});
test('unchanged terrain, healthy slopes, broadleaf owners and out-of-front conifers remain intact',()=>{
 for(const options of [{height:terrain.height,planned:terrain.height},{height:()=>12,planned:()=>1}]){const f=planted(options),before=bytes(f.owner.canopy);assert.equal(retireSteepFallsFloraTrees(f.G,[f.record],zero).retired.length,0);assert.deepEqual(bytes(f.owner.canopy),before);assert.equal(f.W.colliders.length,1);}
 for(const[kind,x,z]of [['oak',actual.x,actual.z],['cold',-300,-350],['pine',25,28]]){const f=fixture();f.tree(kind,x,z,8,.7);const o=f.F.treeOwners[0];assert.equal(retireSteepFallsFloraTrees(f.G,[scan(o)],zero).retired.length,0);assert(f.W.colliders.includes(o.collider));}
});
function selectorContext(trees,mode='high',camera={x:0,z:0}){const renderer={xr:{isPresenting:false}},state={},H={player:{pos:camera}},G={gfx:{get:()=>mode}},WHITE=new T.Color(1,1,1),geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();material.name='leaves';const model=new T.InstancedMesh(geometry,material,20),card=new T.InstancedMesh(geometry,material,20);
 // Run the actual current updater; the projected photo above serves only the
 // unchanged historical resource/layout comparisons and retirement seam.
 const actualCrownHelpers=actualPhoto.slice(actualPhoto.indexOf('// Pure CPU projection of existing leaf geometry bounds.'),actualPhoto.indexOf('export function installWorldPhotoscans(')).replace(/export (?=function )/g,'');
 const body=actualPhoto.slice(actualPhoto.indexOf('  let previousSelection=new Set()'),actualPhoto.indexOf('  state.ready='));const wrap=new Function('THREE','trees','treeMeshes','treeCards','H','G','renderer','state','WHITE','activeWorldTree',actualCrownHelpers+body+'return{run:updateTrees,force(){previousMode=null;}};');return{...wrap(T,trees,[{mesh:model,records:trees}],[{mesh:card,records:trees}],H,G,renderer,state,WHITE,activeWorldTree),model,card,state,renderer};}
test('actual updateTrees removes a retired source from both selected models and far/XR cards while keeping original records/capacities',()=>{
 const f=planted(),live=[f.record,...Array.from({length:7},(_,i)=>({...f.record,x:f.record.x+3+i*4,z:f.record.z,floraOwner:undefined,matrix:new T.Matrix4().makeTranslation(f.record.x+3+i*4,0,f.record.z)}))];const r=selectorContext(live,'low',{x:f.record.x,z:f.record.z});r.run();assert.equal(r.model.count,4);const sourceCount=live.length,capacity=r.card.instanceMatrix.count;
 f.record.retiredFallsFlora=true;r.state.hollowpeakCliffFlora={retired:[f.record]};r.force();r.run();assert.equal(live.length,sourceCount);assert.equal(r.card.instanceMatrix.count,capacity);assert.equal(r.model.count,4);assert.equal(r.card.count,3);assert.equal(r.state.distantTrees,3);const submission=mesh=>Array.from({length:mesh.count},(_,i)=>mesh.instanceMatrix.array[i*16+12]);assert(!submission(r.model).includes(Math.fround(actual.x)));assert(!submission(r.card).includes(Math.fround(actual.x)));
 r.renderer.xr.isPresenting=true;r.run();assert.equal(r.model.count,0);assert.equal(r.card.count,7);assert.equal(r.state.distantTrees,7);assert(!submission(r.card).includes(Math.fround(actual.x)));
});
test('the source diff is limited to ownership/retirement/submission, and retirement follows every world layout installer',()=>{
 assert(photo.indexOf('state.hollowpeakCliffFlora=retireSteepFallsFloraTrees')>photo.indexOf('installYoungOuterWoodland(G,youngOuterSources)'));assert(photo.indexOf('state.hollowpeakCliffFlora=retireSteepFallsFloraTrees')>photo.indexOf('installOuterCanopyShade(G)'));assert(photo.indexOf('state.hollowpeakCliffFlora=retireSteepFallsFloraTrees')>photo.indexOf('installOuterSunShadows(G)'));assert(photo.includes('Promise.allSettled([state.ready,G.worldDetails?.ready,G.undergrowth?.ready])'));assert(!photo.slice(photo.indexOf('  state.ready='),photo.indexOf('  state.floraRetirementReady=')).includes('await G.worldDetails'));assert(!photo.includes('if(t.retiredFallsFlora)clear('));
 const a=source.slice(source.indexOf(' /* ================= 6. the planting'),source.indexOf(' /* ================= 7. hand the banks'));const b=baseline.slice(baseline.indexOf(' /* ================= 6. the planting'),baseline.indexOf(' /* ================= 7. hand the banks'));assert.equal(a,b,'Whole seeded planting and all subsequent cover/layout policy bodies remain byte exact');
 const start=photo.indexOf('  function updateTrees(){');assert(photo.slice(start).includes('!t.retiredFallsFlora&&distance(t)'));assert(photo.slice(start).includes('!t.retiredFallsFlora&&!set.has(t)'));assert(photo.includes('G.followCam.invalidateTrees();previousMode=null;updateTrees();'));
});
test('actual deferred retirement waits scan, detail and undergrowth captures without making scans await details',async()=>{
 const f=planted(),events=[],forestViews=[];let finishScans,finishDetails,finishCover;
 f.G.photoscans={ready:new Promise(r=>finishScans=r)};f.G.worldDetails={ready:new Promise(r=>finishDetails=r)};f.G.undergrowth={ready:new Promise(r=>finishCover=r)};f.G.followCam={invalidateTrees(){events.push('camera-invalidated');}};
 const trees=[f.record],state={...f.G.photoscans,treePositions:[{x:f.record.x,z:f.record.z}],trees:1,conifers:1,matureTrees:0},ctx={state,G:f.G,W:f.W,trees,zero,COTTONWOOD_TREES:[],scene:{getObjectByName(){return{material:{userData:{setTrees(points){forestViews.push([...points]);}}}};}},previousMode:'high:false',retireSteepFallsFloraTrees(G,records,empty){events.push('retire');return retireSteepFallsFloraTrees(G,records,empty);},updateTrees(){events.push('rows-rebuilt');}};
 const start=photo.indexOf('  state.floraRetirementReady='),end=photo.indexOf('  let timer=',start),body=photo.slice(start,end);new Function('ctx','with(ctx){'+body+'}')(ctx);
 finishScans();await Promise.resolve();await Promise.resolve();assert(f.W.colliders.includes(f.owner.collider));assert.deepEqual(events,[]);
 finishDetails();await Promise.resolve();await Promise.resolve();assert(f.W.colliders.includes(f.owner.collider));assert.deepEqual(events,[]);
 // This late exact layout still sees the original collider/point, as production
 // undergrowth does. Only after its capture finishes may the tree disappear.
 const lateLayout=[...f.W.colliders],lateForest=[...f.W.forestPoints];finishCover();const result=await state.floraRetirementReady;
 assert.equal(result.retired.length,1);assert.equal(lateLayout[0],f.owner.collider);assert.equal(lateForest[0],f.owner.forestPoint);assert.deepEqual(events,['retire','camera-invalidated','rows-rebuilt']);assert.equal(ctx.previousMode,null);assert.equal(state.treePositions.length,0);assert.equal(state.trees,0);assert.equal(forestViews[0].length,0);
});
test('all existing layout, resource construction and loader bodies are byte exact after only the declared additions are removed',()=>{
 let flora=source.replace(' F.bank=BANK;\n // Exact references are captured without altering seeded planting or occupancy.\n // Retirement runs after the full world/scan layout, never inside tree().\n F.treeOwners=[];',' F.bank=BANK;')
 .replace('  const tb=BANK.trunk,trunkIndex=tb.n<tb.cap?tb.n:null;','  const tb=BANK.trunk;')
 .replace('  let collider=null,forestPoint=null;\n','')
 .replace('  if(!noColl){const r=Math.max(0.55,h*0.055);collider={x,z,r,height:h};W.colliders.push(collider);addOcc(x,z,r);}','  if(!noColl){const r=Math.max(0.55,h*0.055);W.colliders.push({x,z,r,height:h});addOcc(x,z,r);}')
 .replace('  if(!noColl&&h>3&&W.forestPoints){forestPoint={x,z,s:h/8};W.forestPoints.push(forestPoint);}\n  F.treeOwners.push({kind,x,z,height:h,canopy:b.im,canopyIndex:b.n-1,\n   trunk:trunkIndex===null?null:tb.im,trunkIndex,collider,forestPoint});','  if(!noColl&&h>3&&W.forestPoints)W.forestPoints.push({x,z,s:h/8});');
 // Exact approved Coyote planning edits preserve the original body equality.
 for(const [after,before]of [["const underlyingPlanningH=W.canyonPlacement?.heightAt||planning?.heightAt||groundH;","const underlyingPlanningH=planning?.heightAt||groundH;"],[" const mountainPlanning=planning?.collidersForPlanning(W.colliders,W.fallsLandscape?.barriers)||W.colliders;\n const decisionColliders=W.canyonPlacement?.collidersForPlanning(mountainPlanning,W.canyonLandscape?.barriers)||mountainPlanning;\n for(const c of decisionColliders)addOcc(c.x,c.z,c.r);"," for(const c of planning?.collidersForPlanning(W.colliders,W.fallsLandscape?.barriers)||W.colliders)addOcc(c.x,c.z,c.r);"],[" const planningCliffAt=W.canyonPlacement?.cliffAt||canyonCliffAt;\n",""],["planningCliffAt(x,z,planningH)","canyonCliffAt(x,z,planningH)"]]){assert.equal(flora.split(after).length,2,after.slice(0,90));flora=flora.replace(after,before);}
 assert.equal(flora,baseline);
 const start=photo.indexOf('  // Keep the narrow scan/detail dependency contract:'),end=photo.indexOf('  let timer=',start);
 let clean=(photo.slice(0,start)+photo.slice(end)).replace("import {retireSteepFallsFloraTrees} from './hollowpeak-flora-roots.mjs?v=steep-flora-roots-1';\n",'')
 .replace('    const banks=G.floraPkg?.bank,stems=new Map(),floraCanopies=[],floraOwners=new Map();\n    for(const owner of G.floraPkg?.treeOwners||[]){\n      if(!floraOwners.has(owner.canopy))floraOwners.set(owner.canopy,new Map());\n      floraOwners.get(owner.canopy).set(owner.canopyIndex,owner);\n    }','    const banks=G.floraPkg?.bank,stems=new Map(),floraCanopies=[];')
 .replace('index:i,floraOwner:floraOwners.get(bank.im)?.get(i)','index:i')
 .replace('!t.retiredFallsFlora&&distance(t)','distance(t)').replace('!t.retiredFallsFlora&&!set.has(t)','!set.has(t)')
 .replace('trees.length-(state.hollowpeakCliffFlora?.retired.length||0)-selected.length','trees.length-selected.length');
 assert.equal(clean,oldPhoto);
});

test('actual photoscans-before-undergrowth installer order defers promise capture and waits the subsequently installed cover',async()=>{
 const f=planted(),events=[];let finishScans,finishDetails,finishCover;
 // Production installs WorldDetails, then WorldPhotoscans, then Undergrowth
 // in one synchronous script task. The scan installer cannot capture the last
 // dependency immediately, because its package does not exist yet.
 f.G.worldDetails={ready:new Promise(r=>finishDetails=r)};
 f.G.photoscans={ready:new Promise(r=>finishScans=r)};
 delete f.G.undergrowth;
 f.G.followCam={invalidateTrees(){events.push('camera-invalidated');}};
 const state={...f.G.photoscans},trees=[f.record],ctx={state,G:f.G,W:f.W,trees,zero,COTTONWOOD_TREES:[],scene:{getObjectByName(){return{material:{userData:{setTrees(){events.push('forest-mask');}}}};}},previousMode:'high:false',retireSteepFallsFloraTrees(G,records,empty){events.push('retire');return retireSteepFallsFloraTrees(G,records,empty);},updateTrees(){events.push('rows-rebuilt');}};
 const start=photo.indexOf('  state.floraRetirementReady='),end=photo.indexOf('  let timer=',start);
 new Function('ctx','with(ctx){'+photo.slice(start,end)+'}')(ctx);
 assert.equal(f.G.undergrowth,undefined);assert.deepEqual(events,[]);
 f.G.undergrowth={ready:new Promise(r=>finishCover=r)};
 finishScans();finishDetails();
 // Flush the dependency-capture microtask and any incorrectly early retirement.
 await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.deepEqual(events,[],'No retirement may occur while subsequently installed undergrowth is pending');assert(f.W.colliders.includes(f.owner.collider));assert(f.W.forestPoints.includes(f.owner.forestPoint));
 const lateCoverCollider=f.W.colliders[0],lateCoverPoint=f.W.forestPoints[0];finishCover();
 const result=await state.floraRetirementReady;
 assert.equal(lateCoverCollider,f.owner.collider);assert.equal(lateCoverPoint,f.owner.forestPoint);assert.equal(result.retired.length,1);assert.deepEqual(events,['retire','forest-mask','camera-invalidated','rows-rebuilt']);assert.equal(f.W.colliders.length,0);assert.equal(f.W.forestPoints.length,0);
});
