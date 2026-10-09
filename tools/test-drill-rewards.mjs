import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Execute the actual completion/save functions and shared stat-XP calculation.
// No browser, live player save, WebGL scene, or replacement reward implementation.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,'production function boundary: '+start);
 return source.slice(a,b);
}
const completion=section('function endDrill(done){','function tickDrill(dt,t){');
const grant=section('function grantStatXp(s,h,k,xp,why){','/* Tack as gear.');
function fixture(options={}){
 const horse={id:'trained',name:'Willow',level:1,stats:{speed:2},sxp:{speed:0},...options.horse};
 let stored=JSON.stringify({coins:100,stats:{drills:2,earned:0},pass:{pts:5},horses:[horse,{id:'other',name:'Fern',stats:{speed:1},sxp:{speed:0}}]});
 const trace={events:[],toasts:[],writes:0,refresh:0,reload:0,chime:0,coin:0,removed:0,geometry:0,material:0,texture:0,sharedGeometry:0,unrelatedMaterial:0,cleared:0,practice:[]};
 let failure=options.failure,readsFail=false;
 const cone={isMesh:true,geometry:{dispose(){trace.geometry++;}},material:{dispose(){trace.material++;}}};
 const spriteGeometry={dispose(){trace.sharedGeometry++;}};
 const numberSprite={isSprite:true,geometry:spriteGeometry,material:{map:{dispose(){trace.texture++;}},dispose(){trace.material++;}}};
 const unrelatedSprite={isSprite:true,geometry:spriteGeometry,material:{dispose(){trace.unrelatedMaterial++;}}};
 const nameSprites=[unrelatedSprite,numberSprite];
 const group={children:[cone,numberSprite],traverse(fn){fn(this);this.children.forEach(fn);},clear(){trace.cleared++;this.children.forEach(o=>o.parent=null);this.children=[];}};
 cone.parent=group;numberSprite.parent=group;
 const DRILL={on:true,idx:8,t:10,elapsed:45,stat:'speed',runId:'run-one',horseId:'trained',horseName:'Willow',cones:[{}],grp:group,...options.drill};
 const hud={style:{display:'block'}},arrow={visible:true};
 const localStorage={setItem(key,value){
  if(failure==='write')throw Error('storage full');
  stored=value;trace.writes++;
  if(failure==='after-write')throw Error('wrapper failed after write');
 },getItem(){if(readsFail)throw Error('read unavailable');return stored;}};
 const freshSave=()=>{try{return JSON.parse(localStorage.getItem());}catch{return null;}};
 const bindings={setPracticeJumps:on=>trace.practice.push(on),DRILL,DRILL_N:8,DRILL_TIME:55,nameSprites,scene:{remove(){trace.removed++;}},$:()=>hud,course:null,arrow,
  myHorses:JSON.parse(stored).horses,rideIdx:options.rideIdx??0,STAT_LBL:{speed:'💨 Speed'},
  VIPON:!!options.vip,VIP_PASS:1.5,freshSave,localStorage,SAVE_KEY:'isolated-fixture',
  ensureStats:h=>{h.sxp??={};},statCap:()=>options.cap??4,statCeil:()=>options.cap??4,
  statNeed:v=>20+10*v,mulOf:()=>options.multiplier??1,addSP:(s,n)=>{s.starPoints=(s.starPoints||0)+n;},
  logEarn:(s,n)=>{s.stats.earned+=n;},refreshWallet:()=>trace.refresh++,reloadHorses:()=>trace.reload++,
  sChime:()=>trace.chime++,sCoin:()=>trace.coin++,toast:m=>trace.toasts.push(m),
  G:{run:(name,result)=>trace.events.push({name,result:structuredClone(result)})}};
 const api=new Function(...Object.keys(bindings),grant+completion+'return {endDrill,retryDrillSave};')(...Object.values(bindings));
 return {api,DRILL,trace,hud,arrow,nameSprites,numberSprite,unrelatedSprite,group,get save(){return JSON.parse(stored);},set failure(v){failure=v;},set readsFail(v){readsFail=v;},
  removeHorse(){const s=JSON.parse(stored);s.horses=s.horses.filter(h=>h.id!==horse.id);stored=JSON.stringify(s);}};
}

test('a completed drill saves stat XP, coins, drill count and pass points together',()=>{
 const f=fixture();assert.equal(f.api.endDrill(true),true);
 const s=f.save,h=s.horses[0],r=s.lastTraining;
 assert.equal(f.trace.writes,1);assert.equal(h.stats.speed,3);assert.equal(h.sxp.speed,6);
 assert.equal(s.coins,164);assert.equal(s.stats.drills,3);assert.equal(s.stats.earned,64);assert.equal(s.pass.pts,17);
 assert.deepEqual(r.before,{value:2,xp:0,cap:4});assert.deepEqual(r.after,{value:3,xp:6,cap:4});
 assert.equal(r.statXp,46);assert.equal(r.statRaised,1);assert.equal(r.saved,true);assert.equal(r.horseId,'trained');
 assert.match(f.trace.toasts[0],/Clear round!.*\+46 Speed XP.*\+64 coins.*Speed → 3/);
 assert.equal(f.trace.chime,1);assert.deepEqual(f.trace.events.map(e=>e.name),['drillFinish']);
 assert.equal(f.DRILL.pending,null);assert.equal(f.DRILL.on,false);assert.equal(f.arrow.visible,false);
 assert.deepEqual(f.trace.practice,[true]);assert.equal(f.hud.style.display,'none');assert.equal(f.trace.removed,1);
 assert.deepEqual([f.trace.geometry,f.trace.material,f.trace.texture],[1,2,1],'unique cone and label resources are disposed');
});

test('cleanup removes only training labels and preserves shared sprite geometry',()=>{
 const f=fixture();f.api.endDrill(true);
 assert.deepEqual(f.nameSprites,[f.unrelatedSprite],'the unrelated world label remains registered');
 assert.equal(f.numberSprite.parent,null);assert.deepEqual(f.group.children,[]);
 assert.equal(f.trace.cleared,1);assert.equal(f.trace.sharedGeometry,0);
 assert.equal(f.trace.unrelatedMaterial,0);
 assert.deepEqual([f.trace.geometry,f.trace.material,f.trace.texture],[1,2,1]);
 f.api.endDrill(true);
 assert.deepEqual([f.trace.geometry,f.trace.material,f.trace.texture,f.trace.cleared],[1,2,1,1],'repeated completion does not dispose again');
});

test('partial practice pays only crossed cones and gives no completion or false stat-up message',()=>{
 const f=fixture({drill:{idx:3,t:0,elapsed:55}});assert.equal(f.api.endDrill(false),true);
 const s=f.save;assert.equal(s.horses[0].sxp.speed,9);assert.equal(s.coins,124);
 assert.equal(s.stats.drills,2);assert.equal(s.pass.pts,9);assert.equal(s.lastTraining.completed,false);
 assert.match(f.trace.toasts[0],/3\/8.*\+9 Speed XP.*\+24 coins/);assert(!f.trace.toasts[0].includes('→'));
 assert.equal(f.trace.chime,0);assert.equal(f.trace.coin,1);
});

test('the starting horse receives rewards even if the selected horse changes',()=>{
 const f=fixture({rideIdx:1});f.api.endDrill(true);
 assert.equal(f.save.horses[0].stats.speed,3);assert.equal(f.save.horses[1].stats.speed,1);
 assert.equal(f.save.horses[1].sxp.speed,0);assert.equal(f.save.lastTraining.horseName,'Willow');
});

test('actual retained XP reflects multipliers and discards cap overflow',()=>{
 const boosted=fixture({multiplier:2});boosted.api.endDrill(true);
 assert.equal(boosted.save.lastTraining.statXp,90,'40 + 50 XP reach the cap; overflow is not claimed');
 assert.equal(boosted.save.lastTraining.statRaised,2);assert.equal(boosted.save.horses[0].sxp.speed,0);
 const nearCap=fixture({horse:{stats:{speed:3},sxp:{speed:45}}});nearCap.api.endDrill(true);
 assert.equal(nearCap.save.lastTraining.statXp,5);assert.equal(nearCap.save.lastTraining.after.value,4);
 const capped=fixture({horse:{stats:{speed:4},sxp:{speed:0}}});capped.api.endDrill(true);
 assert.equal(capped.save.lastTraining.statXp,0);assert.equal(capped.save.lastTraining.statRaised,0);
 assert.equal(capped.save.coins,164,'riding the cones still earns its actual coin reward');
});

test('failed storage preserves the earned proof and emits no paid result or success sound',()=>{
 const f=fixture({failure:'write'});assert.equal(f.api.endDrill(true),false);
 assert.equal(f.save.coins,100);assert.equal(f.save.horses[0].stats.speed,2);assert.equal(f.save.pass.pts,5);
 assert.equal(f.DRILL.pending.runId,'run-one');assert.equal(f.DRILL.pending.baseXp,46);
 assert.equal(f.DRILL.pending.saved,false);assert.equal(f.DRILL.pending.reason,'storage full');
 assert.deepEqual(f.trace.events.map(e=>e.name),['drillSavePending']);assert.equal(f.trace.chime+f.trace.coin,0);
 assert(!f.trace.toasts.some(t=>t.includes('Clear round')));
 f.failure=null;assert.equal(f.api.retryDrillSave(),true);
 assert.equal(f.save.coins,164);assert.equal(f.save.stats.drills,3);assert.equal(f.save.pass.pts,17);
 assert.equal(f.DRILL.pending,null);assert.deepEqual(f.trace.events.map(e=>e.name),['drillSavePending','drillFinish']);
 assert.equal(f.api.retryDrillSave(),false);assert.equal(f.trace.writes,1);
});

test('retry acknowledges a saved run after a wrapper throws without double payment',()=>{
 const f=fixture({failure:'after-write'});assert.equal(f.api.endDrill(true),false);
 assert.equal(f.save.coins,164);assert.equal(f.DRILL.pending.saved,false);assert.equal(f.trace.writes,1);
 f.failure=null;assert.equal(f.api.retryDrillSave(),true);
 assert.equal(f.trace.writes,1);assert.equal(f.save.coins,164);assert.equal(f.save.pass.pts,17);
 assert.equal(f.save.stats.drills,3);assert.equal(f.trace.events.filter(e=>e.name==='drillFinish').length,1);
});

test('missing horse or unavailable save never redirects rewards to another horse',()=>{
 const missing=fixture();missing.removeHorse();assert.equal(missing.api.endDrill(true),false);
 assert.equal(missing.save.coins,100);assert.equal(missing.save.horses[0].id,'other');assert.equal(missing.save.horses[0].sxp.speed,0);
 assert.match(missing.DRILL.pending.reason,/horse.*unavailable/);assert.equal(missing.trace.writes,0);
 const unreadable=fixture();unreadable.readsFail=true;assert.equal(unreadable.api.endDrill(true),false);
 assert.match(unreadable.DRILL.pending.reason,/save is unavailable/);assert.equal(unreadable.trace.writes,0);
});

test('zero-cone cancellation and repeated completion cannot claim rewards',()=>{
 const cancelled=fixture({drill:{idx:0}});cancelled.api.endDrill(false);
 assert.equal(cancelled.trace.writes,0);assert.equal(cancelled.DRILL.pending,undefined);assert.equal(cancelled.trace.events.length,0);
 const completed=fixture({vip:true});completed.api.endDrill(true);completed.api.endDrill(true);
 assert.equal(completed.trace.writes,1);assert.equal(completed.save.pass.pts,23);assert.equal(completed.trace.events.length,1);
});
