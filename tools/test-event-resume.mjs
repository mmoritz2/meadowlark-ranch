import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Execute production resume/save/staging functions against isolated storage and
// scene boundaries. These fixtures never touch a player save or create WebGL.
const ladder=fs.readFileSync(new URL('../assets/features/events2-ladder.js',import.meta.url),'utf8');
const disciplines=fs.readFileSync(new URL('../assets/features/events2-disciplines.js',import.meta.url),'utf8');
const pvp=fs.readFileSync(new URL('../assets/features/events-pvp.js',import.meta.url),'utf8');
function part(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
const unfinished=part(ladder,' let runWrite=0,',' /* ================================================================= weekly boards');
const startHook=part(ladder," G.on('courseStart',c=>{"," G.on('courseTick',(c,dt,t)=>{");
const fieldCode=part(ladder,' function spawnField(c){',' function clearField(){');
const tidy=part(ladder," G.on('tick',(dt,t)=>{",' /* ================================================================= boot + state');
const vec=(x=0,y=0,z=0)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});}});
const scalarField=[{n:'Oak',target:50,pen:1,prog:.7,slowT:2,done:false,i:3},{n:'Elm',target:65,pen:2,prog:.6,slowT:0,done:false,i:2},{n:'Ash',target:75,pen:0,prog:.5,slowT:0,done:false,i:2}];
const baseRecord=()=>({version:2,runId:'round-1',seq:3,ev:'rr',rev:'_r2',di:2,t:31.5,idx:2,lap:2,laps:2,faults:1,
 grades:['perfect','fault','refusal'],lineOff:1.25,refusals:1,insp:1,off:2,tix:true,rematch:true,at:100,
 riding:{stam:.12,blown:true,boostT:2.25,shieldT:1.75,slipT:.8},
 discipline:{judging:{fenceFaults:8,lastRef:0,xcTime:0,xcJump:31,gateSum:1,gateN:2,hazHits:1,refuseAt:{'1:1':1},elim:false,watch:null},ghosts:[]},
 field:structuredClone(scalarField),items:[{x:10,z:5,type:'boost',visible:false,cd:2}],hazards:[{x:20,z:5,cd:1.2,seen:true}]});
function fixture(options={}){
 const trace={toasts:[],starts:0,writes:0,hide:0,cancel:0,stage:0,refresh:0},hooks={};
 let stored={runSaved:structuredClone(options.record??baseRecord()),tix:{n:2}},current=options.current??null;
 let readFail=false,writeFail=false,failReadAfterWrite=false;
 const player={pos:vec(200,0,300),heading:1,speed:0,y:0,flying:false,onFoot:false,mesh:{position:vec(200,0,300),rotation:{y:1}}};
 const rig={ready:true,loadingBreed:false,heroMotion:{state:{}}},parked={};
 const record=stored.runSaved,ev={id:'rr',name:'Ranch Race',race:true,route:'loop',laps:2},events=[ev];
 const T={EVENTS3:events,NEIGHBOURS:[['Ash',1],['Elm',1],['Oak',1],['Pine',1]],RACE_ROUTES:{loop:[[0,0],[20,0],[40,0],[60,0]]},RACE_ITEMS:{ladSlick:{col:1},ladBale:{col:2}}};
 const old=new Map(),PVP={rivals:{}};
 const G={horse:{player,RIG:()=>rig},social:{},photoPause:false,cam:{isFree:()=>false},worldPkg:{vehicle:()=>false},
  onFoot:{on:false,horseActionTarget:()=>rig,state:()=>({horse:player.onFoot?parked:null}),mount(){G.onFoot.on=false;player.onFoot=false;return true;}},
  save:{fresh(){return readFail?null:structuredClone(stored);},sync(fn){const value=structuredClone(stored);fn(value);if(!writeFail){stored=value;trace.writes++;}if(failReadAfterWrite)readFail=true;}},
  course:{get:()=>current,routeRev:()=>options.rev??'_r2',eventPar:()=>40,GRADE:{perfect:{},good:{},late:{},early:{},fault:{},refusal:{}},
   startCourse(event){trace.starts++;if(options.reject)return;
    Object.assign(player,{stam:1,blown:false,boostT:0,shieldT:0,slipT:0});
    current={ev:event,idx:0,t:0,cd:3.6,started:false,jumps:Array.from({length:5},(_,i)=>({x:i*20,z:0,rotY:0,kind:'gate'})),
     ce:{di:2,lap:1,laps:2,grades:[],lineOff:0,off:0,diff:{k:'elite'}},race:true,par:40,
     items:[{x:10,z:5,type:'boost',m:{visible:true}}],hazards:[{x:20,z:5,cd:0,_ev2:0}]};
    G.run('courseStart',current);},
   cancelCourse(){trace.cancel++;current=null;}},
  events2:{snapshotResume:c=>structuredClone(c.discipline||record.discipline),resumeCourse(c,saved){trace.stage++;if(options.stageFailure)return false;c.discipline=structuredClone(saved);player.pos.set(c.jumps[c.idx].x,0,-10);return true;},startLanes:()=>[]},
  on(name,fn){(hooks[name]??=[]).push(fn);},run(name,...args){let out;for(const fn of hooks[name]||[]){const r=fn(...args);if(r&&out===undefined)out=r;}return out;},
  hidePanels(){trace.hide++;},followCam:{reset(){}},ui:{rerender(){},renderLB(){}},money:{refreshWallet(){trace.refresh++;}},time:{weekKey:()=>options.week??'new-week'}};
 const bindings={G,T,player,W:{groundH:()=>0},E:()=>({spendTicket(){},TIX_MAX:12,PVP}),
  evById:id=>events.find(e=>e.id===id),toast:m=>trace.toasts.push(m),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),s1:String,
  FIELD_N:{elite:3},FIELD_SPREAD:{elite:.94},REMATCH_TIGHTEN:.93,
  ghostField:()=>null,ghostProj:()=>0,loopOf:()=>({len:100}),hash:()=>.25,
  rivalMesh:()=>({position:vec(),rotation:{y:0}}),atDist:(_loop,d)=>({x:d,z:0,h:0}),
  ladHud:{classList:{add(){},remove(){}},innerHTML:''}};
 const api=new Function(...Object.keys(bindings),
  'let FIELD=null,lastC=null,pendingRematch=null,cardT=null;function clearField(){FIELD=null;}\n'+fieldCode+startHook+unfinished+tidy+
  'return {resumeRun,dropRun,checkpoint,clearRun,resumeBusy,courseLayout,FIELD:()=>FIELD,setLast(c){lastC=c;},last:()=>lastC};')(...Object.values(bindings));
 return {api,G,trace,player,rig,parked,T,ev,hooks,get course(){return current;},set course(c){current=c;},get save(){return structuredClone(stored);},
  set readFail(v){readFail=v;},set writeFail(v){writeFail=v;},set failReadAfterWrite(v){failReadAfterWrite=v;},setRecord(r){stored.runSaved=structuredClone(r);}};
}

test('refused entry preserves the checkpoint and never overwrites an active course',()=>{
 const f=fixture({reject:true}),saved=f.save.runSaved;assert.equal(f.api.resumeRun(),false);
 assert.deepEqual(f.save.runSaved,saved);assert.equal(f.trace.hide,0);assert.equal(f.trace.writes,0);
 const current={ev:{id:'different'},idx:1,t:12,ce:{grades:['good']}},busy=fixture({current});
 assert.equal(busy.api.resumeRun(),false);assert.equal(busy.course,current);assert.deepEqual(current,{ev:{id:'different'},idx:1,t:12,ce:{grades:['good']}});
 assert.equal(busy.trace.starts,0);assert.equal(busy.trace.writes,0);
});

test('physical and presentation entry guards refuse before course construction or relocation',()=>{
 const cases=[f=>f.rig.ready=false,f=>f.rig.loadingBreed=true,f=>f.player.flying=true,f=>f.player.y=.2,
  f=>f.rig.heroJumpAge=0,f=>f.rig.heroMotion.state.action={type:'rear'},f=>f.G.worldPkg.vehicle=()=>true,
  f=>f.G.photoPause=true,f=>f.G.cam.isFree=()=>true,f=>f.G.social.spectate={},f=>f.G.social.tour={},
  f=>{f.player.onFoot=true;f.parked.pending='liedown';},f=>{f.player.onFoot=true;f.parked.departure='mount';},
  f=>{f.player.onFoot=true;f.rig.heroMotion.state.transitioning=true;}];
 for(const set of cases){const f=fixture(),saved=f.save;set(f);assert.equal(f.api.resumeRun(),false,set.toString());
  assert.equal(f.trace.starts,0);assert.deepEqual(f.save,saved);assert.deepEqual([f.player.pos.x,f.player.pos.z],[200,300]);}
});

test('successful recovery preserves scoring, rematch identity, field and proof through countdown',()=>{
 const f=fixture(),r=f.save.runSaved;assert.equal(f.api.resumeRun(),true);const c=f.course;
 assert.equal(c.ladRunId,r.runId);assert.equal(c.resumedStarted,true);assert.equal(c.tixSpent,true);assert.equal(c.ladRematch,true);
 assert.deepEqual([c.idx,c.t,c.faults,c.ce.lap,c.ce.lineOff,c.ce.off],[2,31.5,1,2,1.25,2]);
 assert.deepEqual(c.ce.grades,r.grades);assert.deepEqual(c.discipline,r.discipline);
 assert.deepEqual(Object.fromEntries(Object.keys(r.riding).map(k=>[k,f.player[k]])),r.riding);
 assert.equal(c.items[0].m.visible,false);assert.equal(c.items[0].cd,2);assert.equal(c.hazards[0]._ev2,1);
 assert.deepEqual(f.api.FIELD().rivals.map(({n,target,pen,prog,slowT,done,i})=>({n,target,pen,prog,slowT,done,i})),r.field);
 assert.deepEqual(f.save.runSaved,r);assert.equal(f.save.tix.n,2);assert.equal(f.trace.starts,1);assert.equal(f.trace.stage,1);
 f.G.run('tick',0,10);assert.deepEqual(f.save.runSaved,r);assert.equal(f.api.FIELD().c,c);
 c.started=true;assert.equal(f.api.checkpoint(c),true);assert.equal(f.save.runSaved.seq,r.seq+1);
 assert.equal(f.save.runSaved.runId,r.runId);assert.equal(f.save.runSaved.rematch,true);assert.equal(f.save.runSaved.off,2);
 assert.deepEqual(f.save.runSaved.riding,r.riding);
});

test('saved fatigue and event effects are restored with finite bounded values',()=>{
 const r=baseRecord();r.riding={stam:-10,blown:true,boostT:9999,shieldT:NaN,slipT:-2};
 const f=fixture({record:r});assert.equal(f.api.resumeRun(),true);
 assert.deepEqual([f.player.stam,f.player.blown,f.player.boostT,f.player.shieldT,f.player.slipT],[0,true,120,0,0]);
 f.course.started=true;f.player.stam=NaN;f.player.boostT=Infinity;
 assert.equal(f.api.checkpoint(f.course),true);assert.equal(f.save.runSaved.riding.stam,1);assert.equal(f.save.runSaved.riding.boostT,0);
});

test('recovery countdown neither heals fatigue nor consumes effects, and releases the hold at GO',()=>{
 const f=fixture(),saved=f.save.runSaved;assert.equal(f.api.resumeRun(),true);const c=f.course;
 // The real riding loop regenerates stamina and spends effects before ladder's
 // tick hook. Reproduce that boundary while the recovered course is counting.
 Object.assign(f.player,{stam:.8,blown:false,boostT:0,shieldT:0,slipT:0});
 f.G.run('tick',1.5,10);
 assert.deepEqual(Object.fromEntries(Object.keys(saved.riding).map(k=>[k,f.player[k]])),saved.riding);
 assert.deepEqual(f.save.runSaved,saved);assert.equal(c.t,saved.t);
 c.started=true;const riding={stam:.13,blown:true,boostT:2.2,shieldT:1.7,slipT:.75};Object.assign(f.player,riding);
 f.G.run('tick',.05,11);
 assert.equal(c.resumeCondition,undefined);
 assert.deepEqual(Object.fromEntries(Object.keys(riding).map(k=>[k,f.player[k]])),riding,'normal condition updates resume after GO');
});

test('recovery retains fallback rival identity across a changed week',()=>{
 const f=fixture({week:'another-week'});assert.equal(f.api.resumeRun(),true);
 assert.deepEqual(f.api.FIELD().rivals.map(r=>r.n),['Oak','Elm','Ash']);
 assert.deepEqual(f.api.FIELD().rivals.map(r=>r.target),[50,65,75]);
});

test('stale course cleanup cannot erase a new recovered run or field',()=>{
 const f=fixture();f.api.setLast({ev:{id:'old'},ladRunId:'old-run'});assert.equal(f.api.resumeRun(),true);
 const c=f.course,r=f.save.runSaved;f.G.run('tick',0,100);
 assert.equal(f.api.last(),c);assert.equal(f.api.FIELD().c,c);assert.deepEqual(f.save.runSaved,r);
 f.G.course.cancelCourse();f.G.run('tick',0,101);assert.equal(f.save.runSaved,null);
});

test('unavailable staging keeps proof and rolls back the relocation',()=>{
 const f=fixture({stageFailure:true}),r=f.save.runSaved;assert.equal(f.api.resumeRun(),false);
 assert.equal(f.course,null);assert.deepEqual(f.save.runSaved,r);assert.deepEqual([f.player.pos.x,f.player.pos.z],[200,300]);
 f.G.run('tick',0,10);assert.deepEqual(f.save.runSaved,r);assert.match(f.trace.toasts.at(-1),/checkpoint is kept/);
});

test('legacy checkpoints recover known progress without claiming unavailable exact field state',()=>{
 const r=baseRecord();for(const k of ['version','runId','seq','discipline','field','rematch','items','hazards','off'])delete r[k];
 const f=fixture({record:r});assert.equal(f.api.resumeRun(),true);
 assert.equal(f.course.t,31.5);assert.equal(f.course.idx,2);assert.equal(f.course.tixSpent,true);assert.equal(f.course.ladRematch,false);
 assert.equal(f.course.ladRunId,'legacy:rr:100');assert.deepEqual(f.save.runSaved,r);
 assert.match(f.trace.toasts.at(-1),/Earlier field positions and detailed judging were not saved/);
});

test('changed route layout or revision refuses without consuming the old checkpoint',()=>{
 const f=fixture();const r=f.save.runSaved;r.layout=f.api.courseLayout(f.ev);f.setRecord(r);f.ev.route='different-season';
 assert.equal(f.api.resumeRun(),false);assert.deepEqual(f.save.runSaved,r);assert.equal(f.trace.starts,0);
 const changed=fixture({rev:'_r3'});assert.equal(changed.api.resumeRun(),false);assert.equal(changed.trace.writes,0);
});

test('checkpoint writes and explicit drop require confirmation; refund and removal are atomic',()=>{
 const f=fixture(),r=f.save.runSaved;f.writeFail=true;assert.equal(f.api.dropRun(),false);
 assert.deepEqual(f.save,{runSaved:r,tix:{n:2}});assert.equal(f.trace.refresh,0);
 f.failReadAfterWrite=true;assert.equal(f.api.dropRun(),false);assert.equal(f.trace.refresh,0);
 assert.equal(f.api.clearRun(r),false,'a null reread does not confirm deletion');
 f.failReadAfterWrite=false;f.readFail=false;f.writeFail=false;
 assert.equal(f.api.dropRun(),true);assert.equal(f.save.runSaved,null);assert.equal(f.save.tix.n,3);assert.equal(f.trace.refresh,1);
 assert.equal(f.api.dropRun(),false);assert.equal(f.save.tix.n,3);
 const save=fixture();save.api.resumeRun();save.course.started=true;save.writeFail=true;
 assert.equal(save.api.checkpoint(save.course),false);assert.equal(save.save.runSaved.seq,3);
 save.writeFail=false;save.failReadAfterWrite=true;assert.equal(save.api.checkpoint(save.course),false);
});

test('cleanup only removes the matching checkpoint',()=>{
 const f=fixture();assert.equal(f.api.clearRun('another-run'),true);assert.equal(f.save.runSaved.runId,'round-1');
 f.api.setLast({ladRunId:'different',ev:{id:'rr'}});f.G.run('tick',0,1);assert.equal(f.save.runSaved.runId,'round-1');
});

function disciplineFixture(options={}){
 const trace={placed:[],reset:0,release:0},CUR={c:null,refuseAt:{}},GH={on:true,run:10,fin:200,list:[]};
 const c={ev:{id:'rr',race:true},idx:2,t:31.5,ce:{lap:2,grades:['fault','refusal'],refusals:1},jumps:Array.from({length:4},(_,i)=>({x:i*40,z:0,rotY:0,kind:'gate',ring:{material:{color:{set(){}}}}}))};CUR.c=c;
 const player={pos:vec(300,0,300),heading:2,speed:9,y:0,vy:0,mesh:{position:vec(),rotation:{y:0}}};
 GH.list=[{nm:'Oak',s:-10,v:5,lat:4,rt:0,slowT:0,done:false,ft:null,cool:0}];
 let blocked=false;
 const bindings={CUR,GH,player,G:{scene:{},riding:{releaseAll(){trace.release++;}},followCam:{reset(){trace.reset++;}}},
  W:{groundH:()=>0,pushOut(){}},wrapA:a=>Math.atan2(Math.sin(a),Math.cos(a)),aboard:()=>false,toast(){},showBox(){},
  ringOf:()=>null,inRing:()=>true,clearRun:()=>true,findSpot:(_c,x,z)=>blocked?null:options.at||[x,z],discOf:()=>({k:'race'}),
  placeGhost:g=>trace.placed.push({...g}),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),caption(){}};
 const marshal=part(disciplines,' function lineUp(c,',' /* A test has no first obstacle');
 const restore=part(disciplines,' const RESUME_JUDGING=',' function addFx(g)');
 const api=new Function(...Object.keys(bindings),marshal+restore+'return {snapshotResume,resumeCourse,marshal};')(...Object.values(bindings));
 return {api,CUR,GH,c,player,trace,set blocked(v){blocked=v;}};
}

test('production recovery stages at the actual next gate and restores judges and native rivals',()=>{
 const f=disciplineFixture(),saved=baseRecord().discipline;
 saved.ghosts=[{nm:'Oak',s:70,v:6,lat:4.4,rt:31.5,slowT:1.2,done:false,ft:null,cool:0}];
 assert.equal(f.api.resumeCourse(f.c,saved),true);
 assert.deepEqual([f.player.pos.x,f.player.pos.z,f.player.heading],[80,-10,0]);
 assert.equal(f.CUR.start.idx,2);assert.equal(f.CUR.lastIdx,2);assert.equal(f.CUR.lastGrades,2);
 assert.deepEqual(f.api.snapshotResume(f.c),saved);assert.equal(f.trace.release,1);assert.equal(f.trace.reset,1);
 assert(f.c.jumps.every(j=>j.prevSide===0&&!j.approached));
});

test('missing safe recovery line cannot teleport or claim a restored course',()=>{
 const f=disciplineFixture();f.blocked=true;assert.equal(f.api.resumeCourse(f.c,baseRecord().discipline),false);
 assert.deepEqual([f.player.pos.x,f.player.pos.z],[300,300]);assert.equal(f.trace.release,0);
});

test('Cottonwood recovery leaves the horse rear inside the arena, without bypassing safety checks',()=>{
 const code=part(disciplines,' function inRing(',' /* the last resort')+part(disciplines,' function findSpot(',' /* The three guards');
 const safety={stand:true,reach:true};
 const api=new Function('RING_M','standable','clearRun','intoRing',code+'return {findSpot,inRing};')(.9,()=>safety.stand,()=>safety.reach,(_r,p)=>p);
 const j={x:-19.636676978195915,z:-113.6234298751789,rotY:-2.8411446337553494},R={x:-6,z:-116,A:20,B:15};
 const bx=Math.sin(j.rotY),bz=Math.cos(j.rotY),x=j.x-bx*10,z=j.z-bz*10;
 const base={ring:R,sides:[0],strict:true};
 const centerOnly=api.findSpot({},x,z,j.rotY,j,[j.x,j.z],8,base);
 assert(centerOnly);assert(api.inRing(R,...centerOnly));
 assert.equal(api.inRing(R,centerOnly[0]-bx*1.4,centerOnly[1]-bz*1.4),false,'the old candidate clips the rear through the rail');
 const recovery=api.findSpot({},x,z,j.rotY,j,[j.x,j.z],8,{...base,rearFootprint:1.4});
 assert(recovery);assert(api.inRing(R,...recovery));assert(api.inRing(R,recovery[0]-bx*1.4,recovery[1]-bz*1.4));
 assert(Math.hypot(recovery[0]-j.x,recovery[1]-j.z)<Math.hypot(centerOnly[0]-j.x,centerOnly[1]-j.z));
 safety.stand=false;assert.equal(api.findSpot({},x,z,j.rotY,j,[j.x,j.z],8,{...base,rearFootprint:1.4}),null);
 safety.stand=true;safety.reach=false;assert.equal(api.findSpot({},x,z,j.rotY,j,[j.x,j.z],8,{...base,rearFootprint:1.4}),null);
});

test('non-cardinal fence staging tolerates roundoff at four metres but not shorter approaches',()=>{
 const j={x:-19.636676978195915,z:-113.6234298751789,rotY:-2.8411446337553494,kind:'fence'};
 const at=[j.x-Math.sin(j.rotY)*4,j.z-Math.cos(j.rotY)*4],f=disciplineFixture({at});
 Object.assign(f.c.jumps[2],j);assert(Math.hypot(at[0]-j.x,at[1]-j.z)<4,'exact geometry rounds below four');
 assert.equal(f.api.marshal(f.c,2,true),true);
 const near=disciplineFixture({at:[j.x-Math.sin(j.rotY)*3.999,j.z-Math.cos(j.rotY)*3.999]});Object.assign(near.c.jumps[2],j);
 assert.equal(near.api.marshal(near.c,2,true),false);
});

test('saved gate watch settles its measured approach instead of gaining teleport accuracy',()=>{
 const f=disciplineFixture(),saved=baseRecord().discipline;saved.judging.watch={idx:1,min:2.4};
 f.api.resumeCourse(f.c,saved);assert.equal(f.CUR.gateSum,3.4);assert.equal(f.CUR.gateN,3);assert.equal(f.CUR.watch,null);
});

test('legacy judging does not replay every refusal at the resumed obstacle',()=>{
 const f=disciplineFixture();f.c.ce.grades=['refusal','good','refusal','fault','refusal'];f.c.ce.refusals=3;
 assert.equal(f.api.resumeCourse(f.c,null),true);assert.equal(f.CUR.lastGrades,5);assert.deepEqual(f.CUR.refuseAt,{});
 assert.equal(f.CUR.fenceFaults,16);assert.equal(f.CUR.xcJump,71);assert(f.GH.list[0].s>100);
});

test('a saved fallback field never silently turns into a newly generated ghost field',()=>{
 const code=part(disciplines,' function buildGhosts(c){',' /* On the loop:');
 const GH={list:[{}],on:true};
 const build=new Function('GH','G',code+'return buildGhosts;')(GH,{ladder:{resumeContext:()=>({version:2,discipline:{ghosts:[]},field:scalarField})}});
 build({ev:{id:'rr'}});assert.equal(GH.on,false);assert.deepEqual(GH.list,[]);
});

test('ticket refund hook distinguishes a new countdown from an already-started recovered round',()=>{
 const code=part(pvp," G.on('tick',(dt,t)=>{",'  lastCourse=c;')+'  lastCourse=c;\n });';
 for(const resumedStarted of [false,true]){
  let refunds=0,handler;const lastCourse={tixSpent:true,started:false,finished:false,resumedStarted};
  const G={course:{get:()=>null},on(_name,fn){handler=fn;}};
  new Function('G','lastCourse','clearHazards','refundTicket','toast','pvpHud',code)(G,lastCourse,()=>{},()=>refunds++,()=>{},{classList:{remove(){}}});
  handler(0,0);assert.equal(refunds,resumedStarted?0:1);
 }
});
