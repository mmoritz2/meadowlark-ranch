import assert from 'node:assert/strict';
import {TACK_STATS,tackPieceStats,tackStatTotals,tackRidingPerformance,formatTackStat} from '../assets/tack-stats.js';
const horse={stats:Object.fromEntries(TACK_STATS.map(k=>[k,3])),gear:{saddle:'s',pad:'p'}};
const inventory=[{id:'s',slot:'saddle',lvl:2,primary:'speed',secondary:'accel',bonus:{speed:3,accel:1},set:'Trail'},
 {id:'p',slot:'pad',lvl:1,primary:'speed',bonus:{speed:3},set:'Trail'},
 {id:'b',slot:'bridle',lvl:1,primary:'speed',bonus:{speed:3},set:'Trail'},
 {id:'h',slot:'shoes',lvl:1,primary:'speed',bonus:{speed:3},set:'Trail'}];
const sets={Trail:{two:{speed:1},four:{speed:2,accel:1}}};
const original=JSON.stringify({horse,inventory});
const paired=tackStatTotals(horse,inventory,sets);
assert.equal(paired.gear.speed,6.5);assert.equal(paired.sets.speed,1);assert.equal(paired.total.speed,10.5);
assert.equal(paired.total.accel,4.25);assert.equal(paired.tack.accel,1.25);
assert.equal(JSON.stringify({horse,inventory}),original,'Computing equipped stats must not train or mutate inventory');
assert.deepEqual(tackStatTotals(horse,inventory,sets),paired,'Repeated evaluation does not stack bonuses');
const full=tackStatTotals({...horse,gear:{...horse.gear,bridle:'b',shoes:'h'}},inventory,sets);
assert.equal(full.sets.speed,2,'A four-piece tier replaces the two-piece tier');
assert.equal(full.total.speed,17.5);
const off=tackStatTotals({...horse,gear:{}},inventory,sets);assert.deepEqual(off.total,horse.stats);
const wrong=tackStatTotals({...horse,gear:{saddle:'s',pad:'s',shoes:'missing'}},inventory,sets);
assert.equal(wrong.gear.speed,3.5);assert.equal(wrong.sets.speed,0,'Missing/wrong-slot IDs do not create a set');
for(const pattern of [[1],[2],[3,1],[4,4],[5,5,2]]){
 const piece={bonus:Object.fromEntries(pattern.map((v,i)=>[['speed','accel','jump'][i],v])),primary:'speed',secondary:pattern.length>1?'accel':null};
 let previous=tackPieceStats({...piece,lvl:1});
 for(let lvl=2;lvl<=8;lvl++){
  const next=tackPieceStats({...piece,lvl});
  assert.equal(next.speed-previous.speed,.5,'Every paid upgrade improves its primary');
  if(piece.secondary)assert.equal(next.accel-previous.accel,.25);
  for(const [k,base]of Object.entries(piece.bonus)){
   const legacy=base+(k===piece.primary?Math.floor((lvl-1)/2):0)+(k===piece.secondary?Math.floor((lvl-1)/4):0);
   assert(next[k]>=legacy,'Existing upgraded tack never loses bonus points');
  }
  previous=next;
 }
}
assert.equal(formatTackStat(4.25),'4.25');assert.equal(formatTackStat(3.5),'3.5');
for(const k of ['speed','accel','agility','jump']){
 const low=tackRidingPerformance({[k]:10})[k],high=tackRidingPerformance({[k]:20})[k],higher=tackRidingPerformance({[k]:40})[k];
 assert(high>low&&higher>high,k+' gear remains useful beyond the training range');
}
let previous=Infinity;
for(const stamina of [1,3,7,10,10.25,20,40,1000]){
 const drain=tackRidingPerformance({stamina}).staminaDrain;
 assert(drain>0&&drain<=previous,'Stamina gear reduces positive drain and cannot generate stamina');previous=drain;
}
console.log('Tack upgrades, set totals, replacement/removal, legacy levels and bounded riding benefits passed.');
