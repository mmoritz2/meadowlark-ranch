import test from 'node:test';
import assert from 'node:assert/strict';
import {retireHiddenHollowpeakSeed} from '../assets/hollowpeak-mown-seeds.mjs';
const bounds={x0:-274,x1:-32,z0:-414,z1:-214};
function fixture(){
 const point=Object.freeze({x:-117.64790275090185,z:-276.9614113924209,s:1.5817762145306915,r:1.8193570774221453});
 const owned=Object.freeze({x:point.x,z:point.z,r:.8,height:point.s*7.2});
 const near=Object.freeze({...owned,x:point.x+.001});
 const cliff=Object.freeze({...owned,landform:true,terrainCliff:true});
 const tagged=Object.freeze({...owned,trunk:true});
 const sameRootOtherPoint=Object.freeze({...point});
 const world={colliders:[near,cliff,owned,tagged],forestPoints:[sameRootOtherPoint,point],
  terrainH:()=>9,hollowpeakPlacement:{heightAt:()=>6}};
 return {world,point,owned,near,cliff,tagged,sameRootOtherPoint};
}
test('hidden local seed retires only its exact untagged trunk and original forest object',()=>{
 const f=fixture(),before=f.world.colliders.slice(),oldRandom=Math.random;
 let result;try{Math.random=()=>{throw Error('No random placement may be consumed');};
  result=retireHiddenHollowpeakSeed(f.world,f.point,'snowpine',true,bounds);
 }finally{Math.random=oldRandom;}
 assert(result);assert.equal(result.x,f.point.x);assert.equal(result.originalHeight,6);assert.equal(result.height,9);
 assert.deepEqual(f.world.colliders,[f.near,f.cliff,f.tagged]);
 assert.deepEqual(f.world.forestPoints,[f.sameRootOtherPoint]);
 assert.deepEqual(before,[f.near,f.cliff,f.owned,f.tagged]);
 assert.equal(retireHiddenHollowpeakSeed(f.world,f.point,'snowpine',true,bounds),null,'repeat is a no-op');
});
test('visible trees, unchanged or outside ground, invalid samples, and unowned records are untouched',()=>{
 const scenarios=[
  f=>({hidden:false}),f=>{f.world.terrainH=()=>6;return{};},
  f=>{f.world.terrainH=()=>NaN;return{};},f=>{f.world.hollowpeakPlacement.heightAt=()=>Infinity;return{};},
  f=>({bounds:{...bounds,x0:-100}}),f=>({point:{...f.point}}),
  f=>({species:'willow'}),f=>{delete f.world.hollowpeakPlacement;return{};}
 ];
 for(const scenario of scenarios){const f=fixture(),args={point:f.point,species:'snowpine',hidden:true,bounds,...scenario(f)};
  const colliders=f.world.colliders.slice(),forest=f.world.forestPoints.slice();
  assert.equal(retireHiddenHollowpeakSeed(f.world,args.point,args.species,args.hidden,args.bounds),null);
  assert.deepEqual(f.world.colliders,colliders);assert.deepEqual(f.world.forestPoints,forest);
 }
});
test('missing, wrong-height, tagged, and ambiguous circles never claim seed ownership',()=>{
 for(const kind of ['missing','height','tagged','duplicate']){
  const f=fixture();f.world.colliders=f.world.colliders.filter(c=>c!==f.owned);
  if(kind==='height')f.world.colliders.push({...f.owned,height:f.owned.height+.01});
  if(kind==='tagged')f.world.colliders.push({...f.owned,keep:true});
  if(kind==='duplicate')f.world.colliders.push(f.owned,{...f.owned});
  const before=f.world.colliders.slice(),forest=f.world.forestPoints.slice();
  assert.equal(retireHiddenHollowpeakSeed(f.world,f.point,'snowpine',true,bounds),null);
  assert.deepEqual(f.world.colliders,before);assert.deepEqual(f.world.forestPoints,forest);
 }
});
