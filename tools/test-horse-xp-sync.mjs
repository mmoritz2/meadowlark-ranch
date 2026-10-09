import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Run the real level loop and live-mirror wrapper against disposable saves.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const start=source.indexOf('function applyXp(s,h,n){'),end=source.indexOf('/* ================= terrain height',start);
assert(start>=0&&end>start,'production horse XP boundary');
const code=source.slice(start,end),keys=['speed','stamina','jump','accel','agility'];
const makeHorse=(id,overrides={})=>({id,name:id,level:1,xp:99,stats:{speed:3,stamina:4,jump:4,accel:4,agility:4},sxp:{speed:7},foal:false,...overrides});
function fixture(options={}){
 const target=makeHorse('willow',options.horse),other=makeHorse('fern',{xp:13});
 let saved={coins:100,stats:{earned:0},horses:options.reordered?[other,target]:[target,other]},api;
 const live=[structuredClone(target),structuredClone(other)],trace={writes:0,toasts:[],gem:0,neigh:0,reload:0,wallet:0,multiplied:[]};
 const bindings={MAX_LEVEL:50,STAT_KEYS:keys,rideIdx:0,myHorses:live,
  statCap:h=>Math.min(10,4+Math.floor((h.level||1)/5)),statCeil:()=>8,ensureStats:h=>{h.sxp??={};},
  addSP:(s,n)=>{s.sp=(s.sp||0)+n;},mulOf:(type,s,h)=>{trace.multiplied.push(h.id);return options.multiplier??1;},
  syncSave(fn){const s=structuredClone(saved);fn(s);if(!options.failWrite){saved=s;trace.writes++;}options.afterSync?.(api);},
  freshSave:()=>options.failRead?null:structuredClone(saved),logEarn:(s,n)=>{s.logged=(s.logged||0)+n;},
  refreshWallet:()=>trace.wallet++,sGem:()=>trace.gem++,sNeigh:()=>trace.neigh++,toast:msg=>trace.toasts.push(msg),reloadHorses:()=>trace.reload++};
 api=Function(...Object.keys(bindings),code+';return {addXp3D,setRiding(i){rideIdx=i;},get riding(){return rideIdx;}};')(...Object.values(bindings));
 return {api,trace,live,get save(){return structuredClone(saved);}};
}

test('a saved level-up immediately mirrors its bonus stat, stat XP and level into the live horse',()=>{
 const f=fixture(),original=f.live[0],other=structuredClone(f.live[1]);f.api.addXp3D(1,{coinsPerLevel:50});
 const h=f.save.horses.find(h=>h.id==='willow');
 assert.equal(h.level,2);assert.equal(h.xp,0);assert.equal(h.stats.speed,4);
 assert.equal(f.live[0],original,'the rig and listeners retain the same live horse object');
 assert.deepEqual(f.live[0],h);assert.deepEqual(f.live[1],other);assert.equal(f.save.coins,150);
 assert.equal(f.trace.gem,1);assert.equal(f.trace.wallet,1);assert.equal(f.trace.reload,0);
 assert.match(f.trace.toasts[0],/willow trained up to level 2/);
 assert.equal(f.live[0].stats.speed<Math.min(10,4+Math.floor(f.live[0].level/5)),false,'training gate immediately sees the cap');
});
test('XP follows the ridden identity when persisted horse order differs',()=>{
 const f=fixture({reordered:true}),other=structuredClone(f.save.horses[0]);f.api.addXp3D(1);
 assert.equal(f.save.horses[1].level,2);assert.deepEqual(f.save.horses[0],other);
 assert.deepEqual(f.live[0],f.save.horses[1]);assert.deepEqual(f.trace.multiplied,['willow']);
});
test('a live reorder and selection change during the save cannot redirect the mirror',()=>{
 let f;f=fixture({afterSync(api){f.live.reverse();api.setRiding(0);}});f.api.addXp3D(1);
 assert.equal(f.api.riding,0);assert.equal(f.live[0].id,'fern');assert.equal(f.live[0].xp,13);
 assert.deepEqual(f.live[1],f.save.horses.find(h=>h.id==='willow'));
});
test('XP below a level threshold retains the existing multiplier and no level-up effects',()=>{
 const f=fixture({horse:{xp:10},multiplier:1.5});f.api.addXp3D(4);
 assert.equal(f.save.horses[0].xp,16);assert.equal(f.live[0].xp,16);assert.equal(f.live[0].level,1);
 assert.equal(f.trace.gem,0);assert.deepEqual(f.trace.toasts,[]);assert.equal(f.trace.reload,0);
});
test('failed save or unavailable readback never mirrors or announces a proposed level-up',()=>{
 for(const failure of [{failWrite:true},{failRead:true}]){
  const f=fixture(failure),before=structuredClone(f.live);f.api.addXp3D(1);
  assert.deepEqual(f.live,before);assert.equal(f.trace.gem,0);assert.equal(f.trace.neigh,0);
  assert.deepEqual(f.trace.toasts,[]);assert.equal(f.trace.reload,0);
 }
});
test('a missing ridden horse is not replaced by another horse at its array index',()=>{
 const f=fixture();f.live[0].id='missing';const before=f.save;f.api.addXp3D(100);
 assert.deepEqual(f.save,before);assert.deepEqual(f.trace.multiplied,[]);assert.deepEqual(f.trace.toasts,[]);
 f.api.setRiding(8);f.api.addXp3D(100);assert.deepEqual(f.save,before);
});
test('saved foal growth still refreshes the rig and preserves its announcement',()=>{
 const f=fixture({horse:{level:2,xp:149,foal:true}});f.api.addXp3D(1);
 assert.equal(f.save.horses[0].foal,false);assert.equal(f.live[0].level,3);assert.equal(f.live[0].xp,0);
 assert.equal(f.trace.reload,1);assert.equal(f.trace.neigh,1);assert.equal(f.save.stats.grown,1);
 assert(f.trace.toasts.some(t=>t.includes('grew into a beautiful horse')));
});
