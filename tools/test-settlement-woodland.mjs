import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SETTLEMENT_WOODLAND_BELTS,SETTLEMENT_WOODLAND_MAX,settlementWoodlandCandidates,settlementWoodlandPlants,terrainAwareWoodEnvelope} from '../assets/settlement-woodland.mjs';

const boxes=[
 {min:[-.2,0,-.2],max:[.2,5,.2]},
 {min:[2.5,7,-.2],max:[3.5,7.4,.2]},
];
const base={x:0,z:0,height:10,sourceHeight:10,sourceBottom:0,boxes,terrainStep:1};
const envelope=patch=>terrainAwareWoodEnvelope({...base,...patch});
const distanceToSegment=(x,z,a,b)=>{
 const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
 return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
};

test('authored woodland is repeatable without consuming the world random stream',()=>{
 const random=Math.random;
 Math.random=()=>{throw Error('The shared random stream must remain untouched');};
 try{
  const first=settlementWoodlandCandidates();
  assert.deepEqual(first,settlementWoodlandCandidates());
  assert.deepEqual(settlementWoodlandPlants(first),settlementWoodlandPlants(first));
 }finally{Math.random=random;}
});

test('adding or reordering a belt cannot re-roll previously reviewed margins',()=>{
 const current=settlementWoodlandCandidates();
 assert.deepEqual(settlementWoodlandCandidates([...SETTLEMENT_WOODLAND_BELTS].reverse()),current);
 const retained=new Set(['western-field-back','western-river-shoulder','clover-far-shoulder','eastern-field-back']);
 const rows=current.filter(s=>retained.has(s.belt)).map(s=>[s.belt,s.x,s.z,s.height,s.yaw,s.upright,s.priority,s.station])
  .map(row=>row.map(v=>typeof v==='number'?Math.round(v*1e8)/1e8:v));
 assert.equal(rows.length,144);
 // Captured from the independently rendered first candidate, before adding
 // Cottonwood's two side groups. Every retained position, size and source form
 // must remain identical; eight decimal places avoid irrelevant libm ulps.
 assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),'68aa4514ece3e74dca694fc914301376a62bb8825cbf8f302ec99a8bfc842975');
});

test('bounded tree candidates remain inside their authored belts',()=>{
 const candidates=settlementWoodlandCandidates(),ids=new Set();
 assert.equal(SETTLEMENT_WOODLAND_BELTS.reduce((n,b)=>n+b.cap,0),SETTLEMENT_WOODLAND_MAX);
 assert(SETTLEMENT_WOODLAND_MAX<=46);
 for(const site of candidates){
  const belt=SETTLEMENT_WOODLAND_BELTS.find(b=>b.id===site.belt);
  assert(belt);assert([site.x,site.z,site.height,site.yaw].every(Number.isFinite));
  assert(site.height>=belt.height*.85&&site.height<=belt.height*1.07);
  assert(site.height>=9&&site.height<15);assert(site.yaw>=0&&site.yaw<Math.PI*2);
  const distance=Math.min(...belt.points.slice(1).map((b,i)=>distanceToSegment(site.x,site.z,belt.points[i],b)));
  assert(distance<=belt.width*.55+.701,'candidate wandered out of its woodland margin');
  const key=site.x.toFixed(4)+','+site.z.toFixed(4);assert(!ids.has(key));ids.add(key);
 }
 assert(candidates.length>SETTLEMENT_WOODLAND_MAX);
});

test('only the two village side groups can occupy an opening and they leave its centre clear',()=>{
 const permitted=new Set(['cottonwood-left-frame','cottonwood-right-frame']);
 for(const site of settlementWoodlandCandidates()){
  assert.equal(site.allowMeadowMargin,permitted.has(site.belt));
  if(site.allowMeadowMargin)assert(!(site.x>52&&site.x<71&&site.z> -108&&site.z< -79),'central approach would acquire an opening override');
 }
});

test('collars use bounded existing plant assets at accepted tree sites only',()=>{
 const trees=settlementWoodlandCandidates().slice(0,5),plants=settlementWoodlandPlants(trees);
 assert.equal(settlementWoodlandPlants([]).length,0);assert.equal(plants.length,trees.length*7);
 for(let i=0;i<plants.length;i++){
  const [asset,x,z,height,yaw]=plants[i],tree=trees[Math.floor(i/7)];
  assert(['fern_02','shrub_03','shrub_04'].includes(asset));assert([x,z,height,yaw].every(Number.isFinite));
  const radius=Math.hypot(x-tree.x,z-tree.z);assert(radius>=3.799&&radius<=6.201);assert(height>=.65&&height<=1.75);
 }
});

test('flat ground permits overhead branches but retains their full building envelope',()=>{
 const flat=envelope({heightAt:()=>0});
 assert.equal(flat.radius,1.35);assert.equal(flat.maxGroundRise,0);assert.equal(flat.clearanceHeight,4.2);
 assert(flat.fullRadius>3.5,'upper branch disappeared from the full solid/building footprint');
});

test('uphill terrain beneath a branch expands the rider envelope',()=>{
 const rise=envelope({heightAt:(x,z)=>Math.max(0,4-(x-3)**2-z*z)});
 assert.equal(rise.maxGroundRise,4);assert.equal(rise.clearanceHeight,8.2);
 assert.equal(rise.radius,rise.fullRadius,'a branch within uphill rider clearance was treated as overhead');
});

test('the enclosing terrain cells are sampled even when the trunk lies between grid vertices',()=>{
 const edge=envelope({x:.25,z:.25,heightAt:(x,z)=>x===4&&z===0?5:0});
 assert.equal(edge.maxGroundRise,5);assert.equal(edge.radius,edge.fullRadius);
});

test('source translation and world elevation do not alter relative wood clearance',()=>{
 const heightAt=(x,z)=>Math.max(0,4-(x-3)**2-z*z),reference=envelope({heightAt});
 const elevated=envelope({heightAt:(x,z)=>heightAt(x,z)+100});
 assert.deepEqual(elevated,reference);
 const translated=envelope({sourceBottom:30,boxes:boxes.map(b=>({min:[b.min[0],b.min[1]+30,b.min[2]],max:[b.max[0],b.max[1]+30,b.max[2]]})),heightAt});
 assert.deepEqual(translated,reference);
});

test('invalid terrain inputs fail rather than silently certifying a tree',()=>{
 for(const patch of[{terrainStep:0},{sourceHeight:0},{height:-1},{x:Infinity}])assert.throws(()=>envelope({...patch,heightAt:()=>0}));
 assert.throws(()=>envelope({heightAt:()=>NaN}));
});
