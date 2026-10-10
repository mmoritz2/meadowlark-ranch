import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NORTH_VALLEY_WOODLAND_GROUPS as groups,NORTH_VALLEY_WOODLAND_MAX as cap,northValleyWoodlandCandidates as candidates,northValleyWoodlandPlants as plants} from '../assets/north-valley-woodland.mjs';

test('the authored groups are repeatable without touching the shared random stream',()=>{
 const random=Math.random;Math.random=()=>{throw Error('World RNG consumed');};
 try{assert.deepEqual(candidates(),candidates());assert.deepEqual(plants(candidates()),plants(candidates()));}finally{Math.random=random;}
 assert(Object.isFrozen(groups)&&groups.every(g=>Object.isFrozen(g)&&Object.isFrozen(g.lobes)&&g.lobes.every(Object.isFrozen)));
 assert.equal(groups.reduce((n,g)=>n+g.cap,0),cap);assert(cap<=44);
});

test('unequal bounded shoulders leave the middle pasture open',()=>{
 const rows=candidates(),unique=new Set();assert(rows.length>cap);
 for(const t of rows){
  const group=groups.find(g=>g.id===t.grove),[x,z,rx,rz,h]=group.lobes[t.lobe];
  assert([t.x,t.z,t.height,t.yaw].every(Number.isFinite));
  assert(((t.x-x)/rx)**2+((t.z-z)/rz)**2<=1.000001);
  assert(t.height>=h*.84&&t.height<=h*1.04);assert(t.yaw>=0&&t.yaw<Math.PI*2);
  assert(t.x< -30||t.x>25,'authored candidate enters the open centre');
  assert(t.z< -348&&t.z> -495,'tree reaches the foreground swale or terrain edge');
  const key=t.x.toFixed(6)+','+t.z.toFixed(6);assert(!unique.has(key));unique.add(key);
 }
 assert(groups[0].cap>groups[1].cap&&groups[1].cap>groups[2].cap);
 assert(Math.max(...rows.filter(t=>t.grove===groups[0].id).map(t=>t.z))>Math.max(...rows.filter(t=>t.grove===groups[1].id).map(t=>t.z))+20,'two sides have become a symmetric row');
});

test('understory is bounded around accepted trees and uses resident plant assets',()=>{
 assert.deepEqual(plants([]),[]);
 const trees=candidates().slice(0,cap),rows=plants(trees);assert.equal(rows.length,cap*5);
 rows.forEach(([asset,x,z,height,yaw],i)=>{
  const t=trees[Math.floor(i/5)],radius=Math.hypot(x-t.x,z-t.z);
  assert(['fern_02','shrub_03','shrub_04'].includes(asset));assert([x,z,height,yaw].every(Number.isFinite));
  assert(radius>=2.9999&&radius<=5.7001);assert(height>=.70&&height<=1.83);
 });
});

test('actual runtime selection respects rejection, per-group caps and shared edge ownership',()=>{
 const source=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8');
 const start=source.indexOf('    const northValley=state.northValleyWoodland=');
 const end=source.indexOf('    state.villageEvergreens=',start);assert(start>=0&&end>start);
 const body=source.slice(start,end)+'return northValley;';
 const run=new Function('state','NORTH_VALLEY_WOODLAND_PROFILE','NORTH_VALLEY_WOODLAND_GROUPS','NORTH_VALLEY_WOODLAND_MAX','northValleyWoodlandCandidates','uprightSource','matureLeafSource','edgeWoodRadius','settlementRiderRadius','settlementFootRejection','add','trees','edge',body);
 const state={},trees=[],edge={trees:[]},upright={},mature={},blocked=new Set(candidates().filter((_,i)=>i%4===0).map(s=>s.x));
 const got=run(state,'test',groups,cap,candidates,upright,mature,()=>5,()=>({radius:2,fullRadius:5,maxGroundRise:1}),site=>blocked.has(site.x)?'reserved test area':null,t=>trees.push(t),trees,edge);
 assert.equal(got.trees.length,cap);assert.deepEqual(got.trees,edge.trees);assert.deepEqual(got.trees,trees);
 assert(got.trees.every(t=>!blocked.has(t.x)&&t.authoredWoodlandEdge&&t.authoredNorthValley));
 assert(got.skipped.length>0&&got.skipped.every(t=>t.reason==='reserved test area'));
 for(const g of groups)assert.equal(got.trees.filter(t=>t.grove===g.id).length,g.cap);
});
