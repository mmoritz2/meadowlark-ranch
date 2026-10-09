import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Execute the production trail and keyboard seams with inert scene/network
// boundaries. These tests never open a browser or touch a player's save.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'production boundary: '+start);return source.slice(a,b);}
const trailCode=section('let trailRide=null,','let party=null,');
const keyCode=section(" if(e.code==='KeyE'&&(postInteractionHeld", " if(e.code==='KeyP'&&!e.repeat)");
const releaseCode=section("addEventListener('keyup',e=>{if(e.code==='KeyE')postInteractionHeld=false;",'// turnA/goA');
const resetCode=section('function resetGameInput(){',"addEventListener('blur',resetGameInput)");
const trailDisplay=section(" +(trailRide?'<div class=\"evrow\">",' +(trailOffer').trim().slice(1);
const vec=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}});
function fixture(){
 const trace={events:[],coins:0,pass:0,sp:0,daily:0,toasts:[]},hooks={},player={pos:vec()},arrow={visible:false,position:vec()};
 const save={stats:{trails:0}},G={
  on(name,fn){(hooks[name]??=[]).push(fn);},
  run(name,...args){trace.events.push({name,args});let out;for(const fn of hooks[name]||[]){const r=fn(...args);if(r&&out===undefined)out=r;}return out;}
 };
 const bindings={G,TRAIL_STOPS:[],arrow,player,course:null,net:{},myName:()=> 'Rider',groundH:()=>0,
  toast:m=>trace.toasts.push(m),sChime(){},sCoin(){},sGem(){},addCoins:n=>trace.coins+=n,passAdd:n=>trace.pass+=n,
  syncSave:fn=>fn(save),addSP:(_s,n)=>trace.sp+=n,dailyEvt:()=>trace.daily++};
 const api=new Function(...Object.keys(bindings),trailCode+'return {startTrail,stopTrail,finishManagedTrail,tickTrail};')(...Object.values(bindings));
 const points=[['Start',0,0],['Finish',30,0]];
 return {api,G,trace,player,arrow,save,points,start(opts={}){assert.equal(api.startTrail(points,'Rider',opts),true);return G.trail.ride;}};
}

test('unconfirmed or incomplete managed finish retains the trail and emits no completion',()=>{
 const f=fixture(),r=f.start({managed:'cottonwood-post'});r.idx=r.pts.length;f.arrow.visible=true;
 f.G.on('trailFinishReady',()=>false);
 assert.equal(f.api.finishManagedTrail(r),false);assert.equal(f.G.trail.ride,r);assert.equal(f.arrow.visible,true);
 assert.equal(r.finishNotified,undefined);assert.equal(f.trace.events.filter(e=>e.name==='trailDone').length,0);
 assert.deepEqual([f.trace.coins,f.trace.pass,f.trace.sp,f.save.stats.trails],[0,0,0,0]);
 const g=fixture(),incomplete=g.start({managed:'cottonwood-post'});g.G.on('trailFinishReady',()=>true);
 assert.equal(g.api.finishManagedTrail(incomplete),false);assert.equal(g.G.trail.ride,incomplete);
});

test('confirmed managed finish uses the exact current object and notifies once before releasing it',()=>{
 const f=fixture(),r=f.start({managed:'cottonwood-post'});r.idx=r.pts.length;r.t=30;f.arrow.visible=true;
 const seen=[];f.G.on('trailFinishReady',candidate=>candidate===r);
 f.G.on('trailDone',candidate=>{seen.push(candidate);assert.equal(f.G.trail.ride,r);assert.equal(candidate.finishNotified,true);assert.equal(f.api.finishManagedTrail(candidate),false,'nested completion cannot repeat');});
 assert.equal(f.api.finishManagedTrail({...r}),false,'a copied receipt is not the current trail');
 assert.equal(f.api.finishManagedTrail(r),true);assert.deepEqual(seen,[r]);assert.equal(f.G.trail.ride,null);assert.equal(f.arrow.visible,false);
 assert.equal(f.api.finishManagedTrail(r),false);assert.equal(seen.length,1);
 assert.deepEqual([f.trace.coins,f.trace.pass,f.trace.sp],[0,0,0],'managed mission remains the only payout owner');
});

test('pending save cancellation protects Stop, the public setter, and replacement starts',()=>{
 const f=fixture(),r=f.start({managed:'cottonwood-post'});let pending=true;f.arrow.visible=true;
 f.G.on('trailCancel',candidate=>candidate===r&&pending);
 assert.equal(f.api.stopTrail(),false);assert.equal(f.G.trail.ride,r);
 f.G.trail.ride=null;assert.equal(f.G.trail.ride,r);assert.equal(f.arrow.visible,true);
 assert.equal(f.api.startTrail(f.points,'Other'),false);assert.equal(f.G.trail.ride,r);
 pending=false;assert.equal(f.api.stopTrail(),true);assert.equal(f.G.trail.ride,null);assert.equal(f.arrow.visible,false);
});

test('managed trail tick owns progression and cannot accidentally invoke proximity completion',()=>{
 const f=fixture(),r=f.start({managed:'cottonwood-post'});r.idx=r.pts.length;
 f.G.on('trailTick',candidate=>candidate===r);
 assert.doesNotThrow(()=>f.api.tickTrail(.25));assert.equal(f.G.trail.ride,r);assert.equal(r.t,0);
 assert.equal(f.trace.events.filter(e=>e.name==='trailDone').length,0);assert.equal(f.save.stats.trails,0);
});

test('ordinary trail still advances its real stops and receives the existing core fallback reward once',()=>{
 const f=fixture(),r=f.start();f.G.on('trailTick',()=>undefined);
 f.api.tickTrail(.25);assert.equal(r.idx,1);assert.equal(r.t,.25);assert.equal(f.G.trail.ride,r);
 assert.equal(f.trace.events.filter(e=>e.name==='trailStop').length,1);
 f.player.pos.x=30;f.api.tickTrail(.25);
 assert.equal(r.idx,2);assert.equal(r.t,.5);assert.equal(f.G.trail.ride,null);assert.equal(f.arrow.visible,false);
 assert.deepEqual([f.trace.coins,f.trace.pass,f.trace.sp,f.save.stats.trails,f.trace.daily],[80,30,3,1,1]);
 f.api.tickTrail(.25);assert.equal(f.save.stats.trails,1);
});

test('ordinary trail still lets the existing social payout suppress the core fallback',()=>{
 const f=fixture(),r=f.start();let socialPaid=0;
 f.G.on('trailDone',candidate=>{assert.equal(candidate,r);assert.equal(f.G.trail.ride,r);socialPaid++;return true;});
 f.api.tickTrail(.1);f.player.pos.x=30;f.api.tickTrail(.1);
 assert.equal(socialPaid,1);assert.equal(f.trace.coins,0);assert.equal(f.trace.pass,0);assert.equal(f.G.trail.ride,null);
});

test('a trailStart listener that refuses its new ride is reported as a refused start',()=>{
 const f=fixture();f.G.on('trailStart',()=>{f.G.trail.ride=null;});
 assert.equal(f.api.startTrail(f.points,'Rider'),false);assert.equal(f.G.trail.ride,null);
});

test('legacy Club trail summary renders a completed pending-save ride without indexing beyond its final stop',()=>{
 const render=new Function('trailRide','return '+trailDisplay+';');
 const ride={managed:'cottonwood-post',pts:[['Wren',0,0],['Pines',1,1],['Ada',2,2],['Wren',0,0]],idx:4};
 const pending=render(ride);
 assert.match(pending,/save pending/i);assert.doesNotMatch(pending,/undefined|next:/);
 assert.match(pending,/data-tr="stop"/,'existing Stop still uses its pending-save guard');
 const riding=render({...ride,idx:2});assert.match(riding,/next: Ada/);assert.doesNotMatch(riding,/save pending/i);
 assert.equal(render(null),'');
});

function keyboardFixture(){
 const trace={post:0,npc:0,thing:0,prevented:0,resets:0},keys={},listeners={},state={near:true};
 const G={cottonwoodPost:{context:()=>({inReach:state.near}),interact(){trace.post++;state.near=false;}},run(){}};
 const bindings={G,keys,nearNPC:{},nearThing:null,nearMount:-1,openDlg:()=>trace.npc++,useThing:()=>trace.thing++,
  addEventListener:(name,fn)=>listeners[name]=fn,releaseAllRidingControls(){trace.resets++;for(const k in keys)keys[k]=false;},player:{},$:()=>null};
 const api=new Function(...Object.keys(bindings),'let postInteractionHeld=false;\nfunction key(e){'+keyCode+'}\n'+releaseCode+resetCode+'return {key,resetGameInput,held:()=>postInteractionHeld};')(...Object.values(bindings));
 const event=(code='KeyE',repeat=false)=>({code,repeat,preventDefault(){trace.prevented++;}});
 return {api,trace,keys,state,press:(repeat=false)=>api.key(event('KeyE',repeat)),release:()=>listeners.keyup(event())};
}

test('one held E handoff cannot repeat or open NPC dialogue after the courier stage changes',()=>{
 const f=keyboardFixture();f.press();assert.equal(f.trace.post,1);assert.equal(f.api.held(),true);assert.equal(f.keys.KeyE,undefined);
 f.press(true);f.press(true);assert.equal(f.trace.post,1);assert.equal(f.trace.npc,0);
 f.release();assert.equal(f.api.held(),false);assert.equal(f.keys.KeyE,false);
 f.press();assert.equal(f.trace.npc,1,'new press can talk to Wren normally outside a handoff');
});

test('input reset releases the courier latch and unrelated movement keys remain normal',()=>{
 const f=keyboardFixture();f.press();f.api.resetGameInput();assert.equal(f.api.held(),false);assert.equal(f.trace.resets,1);
 f.press();assert.equal(f.trace.npc,1);
 f.api.key({code:'KeyW',repeat:false,preventDefault(){}});assert.equal(f.keys.KeyW,true);assert.equal(f.trace.post,1);
});
