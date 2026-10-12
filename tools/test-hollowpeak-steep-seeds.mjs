import test from 'node:test';
import assert from 'node:assert/strict';
import {retireSteepFallsSeed} from '../assets/hollowpeak-steep-seeds.mjs';
import {readFileSync} from 'node:fs';
function fixture(){
 const point=Object.freeze({x:-163.56868367844748,z:-249.19441293366472,s:1.5090446763206273,r:5.189411959243627});
 const owned=Object.freeze({x:point.x,z:point.z,r:.8,height:point.s*7.2});
 const sameSiteCliff=Object.freeze({...owned,landform:true,terrainCliff:true});
 const sameRootPoint=Object.freeze({...point});
 const terrainH=(x,z)=>9.31416645151227+2.268193545185734*(x-point.x);
 const world={terrainH,hollowpeakPlacement:{heightAt:()=>21.02436124368545},forestPoints:[sameRootPoint,point],colliders:[sameSiteCliff,owned]};
 return{point,owned,sameSiteCliff,sameRootPoint,world};
}
test('the actual exposed front snowpine retires only its own original forest point and seed collider',()=>{
 const f=fixture(),before=Math.random;
 let result;try{Math.random=()=>assert.fail('No scene random state may be consumed');result=retireSteepFallsSeed(f.world,f.point,'snowpine');}
 finally{Math.random=before;}
 assert(result);assert.equal(result.x,f.point.x);assert.equal(result.z,f.point.z);assert(Math.abs(result.grade-2.268193545185734)<1e-9);
 assert.deepEqual(f.world.colliders,[f.sameSiteCliff]);assert.deepEqual(f.world.forestPoints,[f.sameRootPoint]);
 assert.equal(retireSteepFallsSeed(f.world,f.point,'snowpine'),null,'Repeated retirement is a no-op');
});
test('gentler soil, rear catchment woodland, other species and unrelated ownership remain untouched',()=>{
 const cases=[
  f=>{f.world.terrainH=()=>9;return{};},
  f=>{f.world.terrainH=(x,z)=>9+1.8*(x-f.point.x);return{};},
  f=>({point:{...f.point,z:-276.9614113924209}}),
  f=>({point:{...f.point,x:200}}),
  f=>({species:'oak'}),f=>({species:'cold'}),
  f=>({point:{...f.point}}),
  f=>{f.world.colliders.push({...f.owned});return{};},
  f=>{f.world.colliders=f.world.colliders.filter(c=>c!==f.owned);return{};},
  f=>{f.world.terrainH=()=>NaN;return{};},
  f=>{f.world.hollowpeakPlacement.heightAt=f.world.terrainH;return{};}
 ];
 for(const scenario of cases){const f=fixture(),args={point:f.point,species:'snowpine',...scenario(f)},colliders=f.world.colliders.slice(),forest=f.world.forestPoints.slice();
  assert.equal(retireSteepFallsSeed(f.world,args.point,args.species),null);assert.deepEqual(f.world.colliders,colliders);assert.deepEqual(f.world.forestPoints,forest);
 }
});
test('retirement precedes scan adoption and hides both original seed layers coherently',()=>{
 const source=readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8');
 const start=source.indexOf('const cliffSeed=retireSteepFallsSeed(W,p,kind);'),end=source.indexOf('add({x:p.x,z:p.z',start),block=source.slice(start,end);
 assert(start>0&&end>start);assert(block.includes('stem.setMatrixAt(i,zero);leaves.setMatrixAt(i,zero);'));
 assert(block.includes('state.hollowpeakCliffSeeds.push(cliffSeed);'));assert(block.includes('return;'));
 assert(source.includes('stem.instanceMatrix.needsUpdate=leaves.instanceMatrix.needsUpdate=true;'));
 assert(source.includes('setTrees?.(W.forestPoints)'),'Surviving forest points regenerate terrain litter');
});
