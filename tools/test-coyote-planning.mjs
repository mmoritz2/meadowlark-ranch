import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture as f} from './coyote-bank-fixture.mjs';
import {createDesertArt} from '../assets/desert-art.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const original=JSON.parse(read('./fixtures/coyote-planning-11fb567.json'));
const rawFlora=process.env.COYOTE_PLANNING_FLORA_RUNTIME?fs.readFileSync(process.env.COYOTE_PLANNING_FLORA_RUNTIME,'utf8'):read('../assets/features/world-flora.js'),html=read('../ranch3d.html'),{T,old,next}=f;
// Approved ownership-only edits are separately exercised by the nine retirement
// fixtures. Their exact declared literals may coexist with these planning tests.
let flora=once(rawFlora,"import {canyonCliffAt} from '../canyon-landscape.js?v=regional-landmarks-1';","import {canyonCliffAt} from '../canyon-landscape.js?v=countryside-banks-1';");if(flora.includes(' F.treeOwners=[];'))for(const [after,before]of original.approvedNonRandomOwnershipEdits)flora=once(flora,after,before);
const plan=next.createCanyonPlacementPlan({rawHeightAt:f.oldRaw,heightAt:f.oldHeight,terrainStep:f.step});
function build(module,height){const scene=new T.Scene(),material=new T.MeshStandardMaterial(),colliders=[];return module.createCanyonLandscape({THREE:T,scene,heightAt:height,terrainStep:f.step,material,colliders});}
const prior=build(old,f.oldHeight),live=build(next,f.height);
const riverZ=x=>120+Math.sin(x*.012)*45,CANYON={x:-220,z:130,r:140};
function once(source,after,before){assert.equal(source.split(after).length,2);return source.replace(after,before);}

test('historical numeric planning grid and interpolation match all captured baseline vertices without RNG or scene construction',()=>{
 const previous=Math.random;let p;try{Math.random=()=>assert.fail('Planning consumed scene RNG');p=next.createCanyonPlacementPlan({rawHeightAt:f.oldRaw,heightAt:f.oldHeight,terrainStep:f.step});}finally{Math.random=previous;}
 let vertices=0;for(let iz=0;iz<p.grid.nz;iz++)for(let ix=0;ix<p.grid.nx;ix++){assert.equal(p.grid.heights[iz*p.grid.nx+ix],f.before[(iz+p.grid.iz0)*f.n+ix+p.grid.ix0]);vertices++;}
 assert.equal(vertices,2860);assert.equal(p.grid.bytes,11440);
 for(let z=90;z<245;z+=.75)for(let x=-335;x<-183;x+=.75){assert.equal(next.canyonPlanningRelief(x,z),old.canyonRelief(x,z));assert.equal(p.heightAt(x,z),f.oldHeight(x,z));assert.equal(p.cliffAt(x,z),old.canyonCliffAt(x,z,f.oldHeight));}
 for(const [x,z]of [[0,28],[-300,-320],[300,-300],[310,300],[-150,-242]])assert.equal(p.heightAt(x,z),f.oldHeight(x,z),'Exterior decision sampler delegates unchanged');
});

test('historical occupancy circles reproduce the actual original canyon contour recipe exactly',()=>{
 assert.deepEqual(plan.barriers,prior.barriers.map(({x,z,r})=>({x,z,r})));
 assert.notDeepEqual(live.barriers.map(({x,z,r})=>({x,z,r})),plan.barriers,'New physical contacts must not be substituted for old planting decisions');
 assert(plan.barriers.every(c=>Object.keys(c).sort().join(',')==='r,x,z'));
});

function occupancy(source,W,planning){const start=source.indexOf(' const HC=16, occ=new Map();'),end=source.indexOf(' /* Woodiness:',start);return new Function('W','planning',source.slice(start,end)+'return{taken,occ};')(W,planning);}
test('actual flora occupancy replaces only exact live Canyon owners, after the independent Falls replacement',()=>{
 const other={x:-245,z:172,r:.48,plant:true},coincidentCopy={...live.barriers[0]},fallLive={x:-150,z:-237,r:1.05,terrainCliff:true},fallOriginal={x:-151,z:-236,r:1.05};
 const physical=[other,...live.barriers,coincidentCopy,fallLive],before=physical.slice();
 const mountain={collidersForPlanning(cs,owned){const owners=new Set(owned);return [...cs.filter(c=>!owners.has(c)),fallOriginal];}};
 const historical=[other,...prior.barriers,coincidentCopy,fallLive];
 const a=occupancy(original.worldFlora,{colliders:historical,fallsLandscape:{barriers:[fallLive]}},mountain);
 const b=occupancy(flora,{colliders:physical,fallsLandscape:{barriers:[fallLive]},canyonLandscape:{barriers:live.barriers},canyonPlacement:plan},mountain);
 const replaced=plan.collidersForPlanning(physical,live.barriers);assert.deepEqual(physical,before);assert.equal(replaced[0],other);assert.equal(replaced[1],coincidentCopy);assert.equal(replaced[2],fallLive);assert(!live.barriers.some(c=>replaced.includes(c)));assert.equal(replaced.length,3+plan.barriers.length);
 for(let x=-335;x<-180;x+=1.25)for(let z=110;z<235;z+=1.25)for(const pad of [.35,1.2,3])assert.equal(b.taken(x,z,pad),a.taken(x,z,pad),`Original seeded occupancy differs at ${x},${z}`);
});

function decisions(source,W,cliff){const a=source.slice(source.indexOf(' const planning='),source.indexOf(' const F={}'));const slope=source.slice(source.indexOf(' const slopeAt='),source.indexOf(' /* The regions'));const b=source.slice(source.indexOf(' const inBasin='),source.indexOf(' const okDry='));return new Function('G','W','groundH','fallsExcludesDryPlants','canyonCliffAt','pathDist','BRA','BRB',a+slope+b+'return{height:planningH,slope:slopeAt,ok:okGround};')({vistas:{}},W,W.groundH,()=>false,cliff,()=>1000,-100,-90);}
test('actual flora ground/cliff/slope decisions remain historical while all root writers retain live ground',()=>{
 const mountain={heightAt:f.oldHeight,excludesDryPlants:()=>false},a=decisions(original.worldFlora,{groundH:f.oldHeight,hollowpeakPlacement:mountain},old.canyonCliffAt),b=decisions(flora,{groundH:f.height,hollowpeakPlacement:mountain,canyonPlacement:plan},next.canyonCliffAt);
 for(let z=110;z<235;z+=1.25)for(let x=-335;x<-180;x+=1.25){assert.equal(b.height(x,z),a.height(x,z));assert.equal(b.slope(x,z),a.slope(x,z));assert.equal(b.ok(x,z),a.ok(x,z));}
 const tree=s=>s.slice(s.indexOf(' function tree('),s.indexOf(' function snag('));assert.equal(tree(flora),tree(original.worldFlora));assert(tree(flora).includes('const y=groundH(x,z)-0.05*h'));
 const planted=(source,height,x,z)=>{const geo=new T.BoxGeometry(),mat=new T.MeshBasicMaterial(),BANK={pine:{im:new T.InstancedMesh(geo,mat,2),n:0,cap:2},trunk:{im:new T.InstancedMesh(geo,mat,2),n:0,cap:2}},W={sceneryArt:{containsWaterfall:()=>false},colliders:[],forestPoints:[]},occupancy=[];let draws=0;
  const put=new Function('G','W','BANK','groundH','TREE','BARK','_e','_q','_sc','_v','_m','_col','rnd','addOcc',tree(source)+'return tree;')({vistas:{clearZones:[]}},W,BANK,height,{pine:'#dfeccd'},{pine:'#cdc2ad'},new T.Euler(),new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Matrix4(),new T.Color(),()=>{draws++;return .47;},(...p)=>occupancy.push(p));assert(put('pine',x,z,6,.7));return{BANK,W,occupancy,draws};};
 for(const i of f.changed.filter((_,i)=>i%59===0)){const x=i%f.n*f.step-500,z=Math.floor(i/f.n)*f.step-500,a=planted(original.worldFlora,f.oldHeight,x,z),b=planted(flora,f.height,x,z);assert.equal(a.draws,b.draws);assert.deepEqual(b.W.colliders,a.W.colliders);assert.deepEqual(b.W.forestPoints,a.W.forestPoints);assert.deepEqual(b.occupancy,a.occupancy);for(const kind of ['pine','trunk']){const aa=Array.from(a.BANK[kind].im.instanceMatrix.array),bb=Array.from(b.BANK[kind].im.instanceMatrix.array);assert.equal(bb[13],Math.fround(f.height(x,z)-.3));assert.equal(aa[13],Math.fround(f.oldHeight(x,z)-.3));assert.deepEqual(bb.filter((_,i)=>i!==13),aa.filter((_,i)=>i!==13));assert.deepEqual(Array.from(b.BANK[kind].im.instanceColor.array),Array.from(a.BANK[kind].im.instanceColor.array));}}
 let clean=once(flora,'const underlyingPlanningH=W.canyonPlacement?.heightAt||planning?.heightAt||groundH;','const underlyingPlanningH=planning?.heightAt||groundH;');
 clean=once(clean,' const mountainPlanning=planning?.collidersForPlanning(W.colliders,W.fallsLandscape?.barriers)||W.colliders;\n const decisionColliders=W.canyonPlacement?.collidersForPlanning(mountainPlanning,W.canyonLandscape?.barriers)||mountainPlanning;\n for(const c of decisionColliders)addOcc(c.x,c.z,c.r);',' for(const c of planning?.collidersForPlanning(W.colliders,W.fallsLandscape?.barriers)||W.colliders)addOcc(c.x,c.z,c.r);');
 clean=once(clean,' const planningCliffAt=W.canyonPlacement?.cliffAt||canyonCliffAt;\n','');clean=once(clean,'planningCliffAt(x,z,planningH)','canyonCliffAt(x,z,planningH)');assert.equal(clean,original.worldFlora,'No unrelated seeded planting, texture, model/resource, row or physics body change');
});

const youngLoop=html.slice(html.indexOf('for(let i=0;i<14;i++){\n const x=-150'),html.indexOf('const windmills=[];'));
function young(source,seed,physical=false){let state=seed>>>0,draws=0;const random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const objects=[],colliders=[],pineSeeds=[];const previous=Math.random;
 try{Math.random=random;const desertArt=createDesertArt({THREE:T}),scene={add(o){objects.push({name:o.name,x:o.position.x,z:o.position.z,y:o.position.y,uuid:o.uuid});}},groundH=physical?f.height:f.oldHeight;
  const makePine=s=>{const model=new T.Group();model.name='CPU following pine constructor';pineSeeds.push({scale:s,seed:(Math.random()*65536)|0});return model;};
  new Function('CANYON','riverZ','pathDist','canyonCliffAt','terrainH','canyonPlacement','groundH','desertArt','scene','colliders','makePine',source)(CANYON,riverZ,()=>1000,physical?next.canyonCliffAt:old.canyonCliffAt,physical?f.height:f.oldHeight,plan,groundH,desertArt,scene,colliders,makePine);
  return{objects,colliders,pineSeeds,draws,future:Array.from({length:20},random)};
 }finally{Math.random=previous;}}
test('actual cactus loop retains original accepted constructor order and future seeded draws while roots follow the new physical ground',()=>{
 assert.equal(once(youngLoop,'canyonPlacement.cliffAt(x,z)','canyonCliffAt(x,z,terrainH)'),original.youngCactusAndPineLoop);
 let moved=0,wrongPhysicalHasDrift=false;for(const seed of [91,824,1463,20260929,0x9e3779b9,44,772]){const a=young(original.youngCactusAndPineLoop,seed),b=young(youngLoop,seed,true),wrong=young(original.youngCactusAndPineLoop,seed,true);wrongPhysicalHasDrift||=JSON.stringify(wrong.future)!==JSON.stringify(a.future);assert.equal(b.draws,a.draws);assert.deepEqual(b.future,a.future);assert.deepEqual(b.pineSeeds,a.pineSeeds);assert.deepEqual(b.colliders,a.colliders);assert.deepEqual(b.objects.map(({y,...o})=>o),a.objects.map(({y,...o})=>o));for(const o of b.objects){assert.equal(o.y,f.height(o.x,o.z)-(o.name==='Desert | young cactus'?.01:0));if(o.y!==a.objects[b.objects.indexOf(o)].y)moved++;}}
 assert(moved>0,'At least one retained source root must intentionally re-ground to changed terrain');
 assert(wrongPhysicalHasDrift,'Negative control must expose constructor/UUID RNG drift when decision skips use the new physical cliff');
});

const seedLoop=html.slice(html.indexOf('for(let i=0;i<90;i++){'),html.indexOf("for(const name of ['oak','birch','blossom','pine','snowpine'])for(let i=FOLIAGE[name].length-1"));
function cactus(source,seed){let sd=seed>>>0,draws=0;const random=()=>{draws++;sd=(Math.imul(sd,1664525)+1013904223)>>>0;return sd/4294967296;},FOLIAGE={cactus:[],cactus2:[]},colliders=[],previous=Math.random;try{Math.random=random;new Function('FOLIAGE','CANYON','riverZ','pathDist','canyonCliffAt','terrainH','canyonPlacement','colliders',source)(FOLIAGE,CANYON,riverZ,()=>1000,old.canyonCliffAt,f.oldHeight,plan,colliders);return{FOLIAGE,colliders,draws,future:Array.from({length:20},random)};}finally{Math.random=previous;}}
test('actual generated cactus pruning preserves original keyed survivors, collider ownership and sequential RNG',()=>{
 assert.equal(once(seedLoop,'canyonPlacement.cliffAt(p.x,p.z)','canyonCliffAt(p.x,p.z,terrainH)'),original.seedCactusScatterAndPrune);
 for(const seed of [91,824,1463,20260929,0x9e3779b9]){const a=cactus(original.seedCactusScatterAndPrune,seed),b=cactus(seedLoop,seed);assert.deepEqual(b,a);for(const name of ['cactus','cactus2'])for(const p of b.FOLIAGE[name])assert(b.colliders.includes(p.col));}
});

test('actual raw terrain and installer binding route reference decisions separately from physical ground',()=>{
 assert(html.includes('function rawH(x,z,fallsHeight=fallsTerrainHeight,canyonHeight=canyonRelief)'));assert(html.includes('h+=canyonHeight(x,z)'));
 assert(html.includes('rawHeightAt:(x,z)=>rawH(x,z,fallsTerrainHeight,canyonPlanningRelief),heightAt:hollowpeakPlacement.heightAt'));
 assert(html.includes('terrainH,riverZ'));assert(html.includes('hollowpeakPlacement,canyonPlacement,canyonLandscape'));
 assert.equal(f.sha(f.before),'d02a78010bd9cccc401f52e5862cb200578eee51f172230c0e109a2844b2de38');assert.equal(f.maxBaseError,0);assert.equal(f.sha(f.after),'671b0df3976c1002dcc18c683b36c5a7d0385c1df48115eddad23641341fd40f');
});
