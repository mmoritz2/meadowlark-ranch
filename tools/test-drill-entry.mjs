import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Run the production entry/countdown/tick functions. Rendering and input surfaces
// are inert fixtures; no browser, live save, or substitute training state machine.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,'production function boundary: '+start);
 return source.slice(a,b);
}
const entry=section('const DRILL_N=8,','function endDrill(done){');
const tick=section('function tickDrill(dt,t){','function openEvents(){');
const vec=(x=0,y=0,z=0)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});return this;}});
function fixture(options={}){
 const trace={events:[],toasts:[],home:0,mount:0,added:[],release:0,gaits:[],hidden:0,chime:0,coin:0,end:[],practice:[]};
 const state={blocked:false,hidden:false,vehicle:false,activityRefused:false};
 const locks=new Set(),hooks={};
 const horse={id:'willow',name:'Willow',level:2,stats:{speed:2,stamina:2},sxp:{speed:0},...options.horse};
 const player={pos:vec(88,0,76),mesh:{position:vec(88,0,76),rotation:{y:1}},heading:1,speed:4,y:0,onFoot:false,flying:false};
 const rig={ready:true,loadingBreed:false,heroMotion:{state:{action:null,transitioning:false}}};
 const parkedRig={heroMotion:{state:{action:null,transitioning:false}}};
 const parked={pending:null,departure:null};
 const onFoot={on:false,horseActionTarget:()=>parkedRig,state:()=>({horse:onFoot.on?parked:null}),mount(){trace.mount++;if(options.mountQueued)return true;onFoot.on=false;player.onFoot=false;return true;}};
 class Group{constructor(){this.children=[];}add(o){this.children.push(o);}}
 class Geometry{}
 class Material{constructor(props){Object.assign(this,props);this.color={set(){}};this.emissive={set(){}};}}
 class Mesh{constructor(geometry,material){Object.assign(this,{geometry,material,position:vec()});}}
 const G={input:{blocked:()=>state.blocked},photoPause:false,onFoot,social:{},trail:{},
  worldPkg:{vehicle:()=>state.vehicle},events2:{homeArena:()=>trace.home++},
  riding:{lock(name,on){on?locks.add(name):locks.delete(name);}},seFrame:{settle(){}},
  on(name,fn){(hooks[name]??=[]).push(fn);},
  run(name,...args){trace.events.push({name,args});if(name==='activityGate'&&state.activityRefused)return true;for(const fn of hooks[name]||[]){const r=fn(...args);if(r)return r;}}
 };
 const hud={style:{display:'none'}},arrow={visible:false,position:vec()};
 const bindings={setPracticeJumps:on=>trace.practice.push(on),G,player,RIG:rig,myHorses:[horse],rideIdx:0,course:null,freeCam:false,
  document:{get hidden(){return state.hidden;}},STAT_LBL:{speed:'💨 Speed',stamina:'🔋 Stamina'},
  ensureStats(){},statCap:()=>options.cap??9,statCeil:(_h,stat)=>options.ceil?.[stat]??9,
  toast:message=>trace.toasts.push(message),releaseAllRidingControls:()=>trace.release++,
  selectRidingGait:gait=>trace.gaits.push(gait),groundH:()=>0,camYaw:1,camPitch:1,camLook:vec(),
  THREE:{Group,ConeGeometry:Geometry,MeshStandardMaterial:Material,Mesh},
  nameSprite:()=>({position:vec(),scale:vec()}),scene:{add:group=>trace.added.push(group)},
  hidePanels:()=>{trace.hidden++;state.blocked=false;},$:()=>hud,arrow,
  sChime:()=>trace.chime++,sCoin:()=>trace.coin++,recordEnd:done=>trace.end.push(done)};
 const api=new Function(...Object.keys(bindings),entry+
  'function endDrill(done){recordEnd(done);DRILL.on=false;}\n'+tick+
  'return {startDrill,tickDrill,drillState,drillPaused,DRILL,cancelDrill,setCourse(v){course=v;},setFreeCam(v){freeCam=v;},setHorse(v){myHorses[0]=v;}};')(...Object.values(bindings));
 return {api,trace,state,G,player,rig,parkedRig,parked,onFoot,horse,locks,hud,arrow};
}
function untouched(f){
 assert.deepEqual([f.player.pos.x,f.player.pos.y,f.player.pos.z],[88,0,76]);
 assert.deepEqual([f.player.mesh.position.x,f.player.mesh.position.z],[88,76]);
 assert.equal(f.api.DRILL.on,false);assert.equal(f.api.DRILL.countdown,0);
 assert.equal(f.api.DRILL.stat,null);assert.equal(f.api.DRILL.t,0);
 assert.equal(f.trace.home,0);assert.deepEqual(f.trace.practice,[]);assert.equal(f.trace.added.length,0);
 assert.equal(f.trace.hidden,0);assert.equal(f.locks.size,0);
 assert.equal(f.trace.events.filter(e=>e.name==='drillStart').length,0);
}

test('entry stages the selected horse, starts a separate countdown and captures its identity',()=>{
 const f=fixture();f.state.blocked=true;
 assert.equal(f.api.startDrill('speed'),true);
 assert.deepEqual([f.player.pos.x,f.player.pos.z],[-9.5,-12]);
 assert.deepEqual([f.player.mesh.position.x,f.player.mesh.position.z],[-9.5,-12]);
 assert.equal(f.player.speed,0);assert.equal(f.player.heading,0);
 assert.equal(f.api.DRILL.horseId,'willow');assert.equal(f.api.DRILL.horseName,'Willow');
 assert.equal(f.api.DRILL.cones.length,8);assert.equal(f.trace.added[0].children.length,16);
 assert.equal(f.api.DRILL.countdown,3);assert.equal(f.api.DRILL.t,55);
 assert.deepEqual(f.trace.practice,[false]);assert.deepEqual(f.trace.gaits,['trot']);assert(f.locks.has('training-countdown'));
 assert.equal(f.api.drillPaused(),false,'countdown riding lock does not pause its own clock');
 assert.equal(f.trace.events.filter(e=>e.name==='drillStart').length,1);
});

test('busy, unloaded or airborne entry is refused before relocation or timer creation',()=>{
 const cases=[
  f=>f.state.activityRefused=true,f=>f.api.DRILL.pending={runId:'earned'},
  f=>f.api.setCourse({}),f=>f.G.trail.ride={},f=>f.api.setFreeCam(true),
  f=>f.G.photoPause=true,f=>f.G.social.spectate={},f=>f.G.social.tour={},
  f=>f.player.flying=true,f=>f.player.y=.2,
  f=>f.rig.heroJumpAge=0,f=>f.state.vehicle=true,f=>f.rig.ready=false,
  f=>f.rig.loadingBreed=true,f=>f.rig.heroMotion.state.action={type:'rear'},f=>f.rig.emote={type:'bow'}
 ];
 for(const setup of cases){const f=fixture();setup(f);assert.equal(f.api.startDrill('speed'),false,setup.toString());untouched(f);}
});

test('parked action, queued action, departure and return blend never queue a mount or move the walker',()=>{
 const cases=[f=>f.parkedRig.heroMotion.state.action={type:'liedown'},f=>f.parked.pending='liedown',
  f=>f.parked.departure='mount',f=>f.parkedRig.heroMotion.state.transitioning=true];
 for(const setup of cases){const f=fixture();f.onFoot.on=true;f.player.onFoot=true;setup(f);
  assert.equal(f.api.startDrill('speed'),false);untouched(f);assert.equal(f.trace.mount,0);}
});

test('entry confirms an actual mount before staging, including the defensive queued-mount path',()=>{
 const queued=fixture({mountQueued:true});queued.onFoot.on=true;queued.player.onFoot=true;
 assert.equal(queued.api.startDrill('speed'),false);untouched(queued);assert.equal(queued.trace.mount,1);
 const mounted=fixture();mounted.onFoot.on=true;mounted.player.onFoot=true;
 assert.equal(mounted.api.startDrill('speed'),true);assert.equal(mounted.trace.mount,1);
 assert.equal(mounted.player.onFoot,false);assert.equal(mounted.api.DRILL.on,true);
});

test('each stat respects its own breed ceiling rather than the generic level cap',()=>{
 const f=fixture({horse:{stats:{speed:3,stamina:2}},ceil:{speed:3,stamina:6},cap:9});
 assert.equal(f.api.startDrill('speed'),false);untouched(f);assert.match(f.trace.toasts[0],/Speed.*ceiling/);
 assert.equal(f.api.startDrill('stamina'),true);assert.equal(f.api.DRILL.stat,'stamina');
});

test('menus and background pause countdown and riding time without crediting nearby cones',()=>{
 const f=fixture();f.api.startDrill('speed');const cone=f.api.DRILL.cones[0];f.player.pos.set(cone.x,0,cone.z);
 f.state.blocked=true;f.api.tickDrill(10,0);
 assert.deepEqual([f.api.DRILL.countdown,f.api.DRILL.t,f.api.DRILL.elapsed,f.api.DRILL.idx],[3,55,0,0]);
 f.state.blocked=false;f.state.hidden=true;f.api.tickDrill(10,0);
 assert.equal(f.api.DRILL.countdown,3);f.state.hidden=false;
 f.api.tickDrill(1,0);assert.equal(f.api.DRILL.countdown,2);assert.equal(f.api.DRILL.idx,0);
 f.api.tickDrill(2,0);assert.deepEqual([f.api.DRILL.countdown,f.api.DRILL.t,f.api.DRILL.elapsed,f.api.DRILL.idx],[0,55,0,0]);
 assert(!f.locks.has('training-countdown'));
 f.state.blocked=true;f.api.tickDrill(10,0);
 assert.deepEqual([f.api.DRILL.t,f.api.DRILL.elapsed,f.api.DRILL.idx],[55,0,0]);
 f.state.blocked=false;f.G.photoPause=true;f.api.tickDrill(10,0);assert.equal(f.api.DRILL.t,55);
 f.G.photoPause=false;f.api.setFreeCam(true);f.api.tickDrill(10,0);assert.equal(f.api.DRILL.t,55);
 f.api.setFreeCam(false);f.api.tickDrill(.25,0);
 assert.deepEqual([f.api.DRILL.t,f.api.DRILL.elapsed,f.api.DRILL.idx],[54.75,.25,1]);
});

test('changing horse or leaving the mounted activity cancels and releases countdown input lock',()=>{
 const cases=[f=>f.api.setHorse({...f.horse,id:'fern'}),f=>f.player.onFoot=true,
  f=>f.player.flying=true,f=>f.state.vehicle=true,f=>f.api.setCourse({})];
 for(const setup of cases){const f=fixture();f.api.startDrill('speed');setup(f);f.api.tickDrill(.1,0);
  assert.equal(f.api.DRILL.on,false);assert(!f.locks.has('training-countdown'));
  assert.deepEqual(f.trace.end,[false]);assert.equal(f.api.DRILL.horseId,'willow');}
});

test('an expired clock clamps elapsed time and cannot pay a full-clear result',()=>{
 const f=fixture();f.api.startDrill('speed');f.api.tickDrill(3,0);
 f.api.DRILL.t=.1;f.api.DRILL.elapsed=54.9;f.api.tickDrill(.5,1);
 assert.equal(f.api.DRILL.t,0);assert.equal(f.api.DRILL.elapsed,55);
 assert.equal(f.api.DRILL.idx,0);assert.deepEqual(f.trace.end,[false]);
});
