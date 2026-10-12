import test from 'node:test';
import assert from 'node:assert/strict';
import {createHollowpeakPlacementPlan,legacyFallsTerrainHeight,HOLLOWPEAK_PLACEMENT_PROFILE} from '../assets/hollowpeak-placement-reference.mjs';

const STEP=1000/512;
// A curved surface distinguishes both terrain-cell diagonals and exposes a
// sampler that accidentally interpolates unrounded analytic values.
const field=(x,z)=>Math.sin(x*.043)*9+Math.cos(z*.019)*5+x*z*.000037;
function expectedTriangle(x,z){
 const gx=(x+500)/STEP,gz=(z+500)/STEP,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
 const x0=ix*STEP-500,z0=iz*STEP-500;
 const a=Math.fround(field(x0,z0)),b=Math.fround(field(x0,z0+STEP));
 const c=Math.fround(field(x0+STEP,z0+STEP)),d=Math.fround(field(x0+STEP,z0));
 return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
}
function make(options={}){return createHollowpeakPlacementPlan({terrainStep:STEP,rawHeightAt:field,heightAt:(x,z)=>100+x*.01-z*.02,...options});}

test('local planting samples use cached finite Float32 triangles on both cell halves',()=>{
 let rawCalls=0,liveCalls=0;
 const plan=make({rawHeightAt:(x,z)=>{rawCalls++;return field(x,z);},heightAt:()=>{liveCalls++;throw Error('Unexpected live fallback inside local grid');}});
 assert.equal(plan.profile,HOLLOWPEAK_PLACEMENT_PROFILE);
 assert.equal(rawCalls,plan.stats.gridVertices);
 assert.equal(plan.stats.gridBytes,plan.stats.gridVertices*Float32Array.BYTES_PER_ELEMENT);
 assert(plan.stats.gridBytes<65536,'the planting reference must remain a small local grid');
 let samples=0;
 for(let iz=59;iz<141;iz+=7)for(let ix=121;ix<231;ix+=9){
  for(const [u,v] of [[.11,.23],[.79,.66],[.5,.5],[0,0]]){
   const x=(ix+u)*STEP-500,z=(iz+v)*STEP-500;
   const actual=plan.heightAt(x,z),expected=expectedTriangle(x,z);
   assert(Number.isFinite(actual));assert(Math.abs(actual-expected)<1e-11);
   samples++;
  }
 }
 assert(samples>500);assert.equal(liveCalls,0);
 assert.equal(rawCalls,plan.stats.gridVertices,'queries must use the cached reference');
 assert(Object.isFrozen(plan)&&Object.isFrozen(plan.stats)&&Object.isFrozen(plan.stats.bounds));
});

test('outside the local grid the sampler calls current live ground rather than a stale snapshot',()=>{
 let revision=1,calls=[];
 const live=(x,z)=>{calls.push([x,z,revision]);return revision*100+x*.01-z*.02;};
 const plan=make({heightAt:live}),b=plan.stats.bounds;
 const sites=[[b.x0-STEP,-300],[b.x1+STEP,-300],[-150,b.z0-STEP],[-150,b.z1+STEP],[0,0]];
 for(const revisionValue of [1,3]){
  revision=revisionValue;
  for(const [x,z] of sites)assert.equal(plan.heightAt(x,z),revision*100+x*.01-z*.02);
 }
 assert.equal(calls.length,sites.length*2);
});

test('historical contours affect only the returned planning list, preserving live object identity',()=>{
 const plan=make(),ordinary=Object.freeze({x:10,z:20,r:2}),liveBarrier=Object.freeze({x:-150,z:-240,r:1.05});
 // Equal numeric coordinates are not proof that another owner's collider is a
 // Hollowpeak barrier: substitution must use membership of the supplied list.
 const separateOwner=Object.freeze({...liveBarrier});
 const live=Object.freeze([ordinary,liveBarrier,separateOwner]),barriers=Object.freeze([liveBarrier]);
 const before=JSON.stringify(live),result=plan.collidersForPlanning(live,barriers);
 assert.notEqual(result,live);assert.equal(result[0],ordinary);assert.equal(result[1],separateOwner);
 assert(!result.includes(liveBarrier));assert.equal(JSON.stringify(live),before);
 assert.equal(barriers[0],liveBarrier);
 const contours=result.slice(2);
 assert.equal(contours.length,288,'73ec33a historical contour survey');
 assert.equal(contours.length,plan.stats.barriers);
 assert(contours.every(c=>Number.isFinite(c.x+c.z+c.r)&&c.r>0&&c.x>=-274&&c.x<=-32&&c.z>=-414&&c.z<=-214));
 assert(contours.some(c=>c.x<-230)&&contours.some(c=>c.x>-110),'planning obstacles span both original mountain flanks');
 result.length=0;assert.equal(live.length,3,'a consumer may edit its planning array without changing runtime collisions');
 const second=plan.collidersForPlanning(live,barriers);
 assert.equal(second.length,290);assert.equal(second[0],ordinary);assert.equal(second[1],separateOwner);
});

test('historical water/steep-ground exclusion is local and uses the supplied reference ground',()=>{
 const flat=make({rawHeightAt:(x,z)=>legacyFallsTerrainHeight(x,z,0),heightAt:()=>0});
 assert.equal(flat.excludesDryPlants(-150,-230.4),true,'plunge pool remains excluded');
 assert.equal(flat.excludesDryPlants(-147,-284),true,'source tarn remains excluded');
 assert.equal(flat.excludesDryPlants(0,0),false,'other regions are not claimed by this reference');
 assert.equal(legacyFallsTerrainHeight(0,0,7.25),7.25,'the historical terrain modifier has compact support');
 const steep=make({rawHeightAt:(x,z)=>x*2+z,heightAt:()=>0});
 assert.equal(steep.excludesDryPlants(-164,-345),true,'slope exclusion must sample the caller’s cached planting surface');
});

test('invalid callbacks and sampled heights fail explicitly; valid construction consumes no ambient RNG',()=>{
 for(const bad of [{rawHeightAt:null},{heightAt:null},{terrainStep:0},{terrainStep:-1},{terrainStep:NaN}])assert.throws(()=>make(bad),/Invalid Hollowpeak planting sampler/);
 for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>make({rawHeightAt:()=>value}),/Nonfinite historical Hollowpeak planting ground/);
 const random=Math.random;
 try{Math.random=()=>{throw Error('Ambient RNG must not be consumed');};const plan=make();assert(Number.isFinite(plan.heightAt(-170,-310)));assert.equal(plan.collidersForPlanning([],[]).length,288);}
 finally{Math.random=random;}
});
