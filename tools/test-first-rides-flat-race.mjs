import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../review/first-rides/review.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing production boundary ${start}`);return source.slice(a,b);}
const driverCode=section('function flatRaceCourse(c){','function startRoundupDriver(){');
const controlCode=section('function key(code,on){','function pulseJump(){')+section('function blocked(){','function manual(code){');
const keyupObserver=source.split('\n').find(line=>line.trim().startsWith("w.addEventListener('keyup',"));assert(keyupObserver,'actual window keyup observer must exist');
const copy=value=>structuredClone(value);
function race(){return {ev:{id:'rr',name:'River Run',race:true,disc:'race'},race:true,started:true,cd:0,t:12,idx:0,faults:0,
 ce:{kind:'race',lap:1,laps:2,diff:{k:'beginner'},timeAllowed:90,lineOff:0,acc:.91,raceAcc:.96},
 jumps:[{kind:'gate',x:0,z:40},{kind:'gate',x:18,z:62}]};}
function fixture(){
 let now=100000,current=race(),ridden={id:7,name:'Juniper',breed:'bay'},timerId=0;
 const player={pos:{x:0,z:0},heading:0,speed:0,y:0,onFoot:false,flying:false},rig={ready:true,loadingBreed:false};
 const saved={coins:100,gems:3,totalRaces:0,horses:[copy(ridden)],riderJourney:{claimed:{}}};
 const timers=new Map(),listeners=new Map(),flags={input:false,photo:false,freecam:false,onFoot:false,vehicle:null},dialog={visible:false,text:''};
 const trace={events:[],gaits:[],releases:0,blurs:0,status:[],reports:0,errors:[],writes:[],forbidden:[]},seen=new WeakMap();
 // Production observations are read-only proxies; tests change their backing
 // objects to represent external game updates. Even write-then-restore is caught.
 function observe(value,label){if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);const out=new Proxy(value,{get(t,k){return observe(Reflect.get(t,k),label+'.'+String(k));},set(_t,k){trace.writes.push(label+'.'+String(k));throw Error('fixture driver wrote a production observation');},deleteProperty(_t,k){trace.writes.push(label+'.'+String(k));throw Error('fixture driver deleted a production observation');}});seen.set(value,out);return out;}
 const forbidden=name=>()=>{trace.forbidden.push(name);throw Error('forbidden production mutation: '+name);};
 const w={document:{hidden:false,activeElement:{blur(){trace.blurs++;}},body:{classList:{contains:k=>k==='freecam'&&flags.freecam}},getElementById:id=>id==='dlg'?{getClientRects:()=>dialog.visible?[{}]:[],get textContent(){return dialog.text;}}:null,
 dispatchEvent(event){trace.events.push({type:event.type,code:event.code});if(event.bubbles)for(const fn of listeners.get(event.type)||[])fn(event);return true;}},
 KeyboardEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},addEventListener(type,fn){const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows);},advanceTime:forbidden('advanceTime')};
 const G={course:{get:()=>observe(current,'course'),startCourse:forbidden('startCourse'),cancelCourse:forbidden('cancelCourse')},
 horse:{player:observe(player,'player'),RIG:()=>observe(rig,'rig'),ridden:()=>observe(ridden,'horse')},
 riding:{selectGait:gait=>trace.gaits.push(gait),releaseAll(){trace.releases++;}},input:{blocked:()=>flags.input},get photoPause(){return flags.photo;},onFoot:{get on(){return flags.onFoot;}},worldPkg:{vehicle:()=>flags.vehicle},
 save:{fresh:()=>observe(saved,'save'),sync:forbidden('save.sync')}};
 const clock=class extends Date{static now(){return now;}};
 const api=Function('G','w','Date','setInterval','clearInterval','clearTimeout','trace',
  'let ready=true,storageOwned=true,networkStopped=false,driver=null,manualTimer=null,jumpTimer=null,eventCourse=null,eventCourseHorse=null,driverSteps=0,driverStatus="off",driverTarget=null;const held={};function status(s){trace.status.push(s);}function report(){trace.reports++;}function fail(e){trace.errors.push(String(e));}\n'+controlCode+'\n'+driverCode+'\n'+keyupObserver+'\nreturn {flatRaceCourse,readEventCourse,startFlatRaceDriver,haltFlatRace,key,stop,state:()=>({active:!!driver,status:driverStatus,steps:driverSteps,target:driverTarget,held:{...held}}),configure(p){if("ready"in p)ready=p.ready;if("storageOwned"in p)storageOwned=p.storageOwned;if("networkStopped"in p)networkStopped=p.networkStopped;}};')(
  G,w,clock,(fn,ms)=>{assert.equal(ms,100);timers.set(++timerId,fn);return timerId;},id=>timers.delete(id),()=>{},trace);
 return {G,w,api,player,rig,saved,flags,dialog,trace,timers,get course(){return current;},set course(value){current=value;},get ridden(){return ridden;},set ridden(value){ridden=value;},tick(ms=100){now+=ms;for(const fn of [...timers.values()])fn();},emitWindow(type,event){for(const fn of listeners.get(type)||[])fn(event);},observations:()=>copy({course:current,player,rig,saved,ridden})};
}
function clean(f){assert.deepEqual(f.trace.writes,[]);assert.deepEqual(f.trace.forbidden,[]);assert.deepEqual(f.trace.errors,[]);}
function halted(f,pattern){assert.equal(f.api.state().active,false);assert.equal(f.timers.size,0);assert(Object.values(f.api.state().held).every(value=>value===false));assert.match(f.api.state().status,pattern);clean(f);}

test('only an actual all-gate flat race is eligible; other disciplines and malformed layouts never start',()=>{
 const good=fixture();assert.equal(good.api.flatRaceCourse(good.course),true);good.course.ev.disc=undefined;assert.equal(good.api.flatRaceCourse(good.course),true);
 const changes=[c=>{c.race=false;},c=>{c.race=1;},c=>{c.ev.race=false;},c=>{c.ev.id='';},c=>{c.ev.id=7;},c=>{c.rush=true;},c=>{c.ev.rush=true;},c=>{c.dressage=true;},c=>{c.ev.dressage=true;},c=>{c.xc=true;},c=>{c.ev.xc=true;},c=>{c.ev.gauntlet=true;},c=>{c.ev.kind='custom';},c=>{c.ev.disc='showmanship';},c=>{c.ce.kind='xc';},c=>{delete c.ce;},c=>{c.jumps=[];},c=>{c.jumps={};},c=>{c.jumps[1].kind='fence';},c=>{c.jumps[0].x=NaN;},c=>{c.jumps[0].z=Infinity;},c=>{c.jumps=[null];},c=>{c.jumps=new Array(2);}];
 for(const change of changes){const f=fixture();change(f.course);assert.equal(f.api.flatRaceCourse(f.course),false,change.toString());const before=f.observations();f.api.startFlatRaceDriver();assert.equal(f.timers.size,0);assert.deepEqual(f.trace.gaits,[]);assert.deepEqual(f.trace.events,[]);assert.deepEqual(f.observations(),before);clean(f);}
 for(const value of [null,{},[]])assert.equal(good.api.flatRaceCourse(value),false);
});

test('start admission respects the offline owned-origin and visible unblocked game guards',()=>{
 for(const change of [f=>f.api.configure({ready:false}),f=>f.api.configure({storageOwned:false}),f=>f.api.configure({networkStopped:true}),f=>{f.flags.input=true;},f=>{f.w.document.hidden=true;}]){const f=fixture();change(f);const before=f.observations();f.api.startFlatRaceDriver();assert.equal(f.timers.size,0);assert.deepEqual(f.trace.events,[]);assert.deepEqual(f.trace.gaits,[]);assert.deepEqual(f.observations(),before);clean(f);}
});

test('countdown releases keys while production alone owns the clock and gate index',()=>{
 const f=fixture();f.course.started=false;f.course.cd=3;f.course.t=0;const before=f.observations();f.api.startFlatRaceDriver();f.api.key('KeyW',true);for(let i=0;i<3;i++)f.tick(2500);assert.equal(f.api.state().active,true);assert.match(f.api.state().status,/countdown/);assert.equal(f.api.state().held.KeyW,false);assert.deepEqual(f.trace.gaits,[]);assert.deepEqual(f.observations(),before);
 f.course.started=true;f.course.cd=0;const started=f.observations();f.tick();assert.equal(f.api.state().held.KeyW,true);assert.equal(f.trace.gaits.at(-1),'gallop');assert.deepEqual(f.observations(),started);clean(f);
});

test('real numbered gate centres select ordinary gaits and steering without writing game observations',()=>{
 const cases=[{x:0,z:40,gait:'gallop',forward:true,left:false,right:false,back:false},{x:0,z:12,gait:'canter',forward:true,left:false,right:false,back:false},{x:0,z:5,gait:'trot',forward:true,left:false,right:false,back:false},{x:40,z:0,gait:'trot',forward:false,left:true,right:false,back:true},{x:-40,z:0,gait:'trot',forward:false,left:false,right:true,back:true}];
 for(const row of cases){const f=fixture();Object.assign(f.course.jumps[0],{x:row.x,z:row.z});f.player.speed=3;const before=f.observations();f.api.startFlatRaceDriver();f.tick();const s=f.api.state();assert.equal(s.active,true);assert.equal(s.steps,1);assert.deepEqual([s.target.x,s.target.z],[row.x,row.z]);assert.equal(s.target.checkpoint,1);assert.equal(s.target.gait,row.gait);assert.equal(f.trace.gaits.at(-1),row.gait);assert.equal(s.held.KeyW,row.forward);assert.equal(s.held.KeyA,row.left);assert.equal(s.held.KeyD,row.right);assert.equal(s.held.KeyS,row.back);assert(!f.trace.events.some(e=>e.code==='Space'||e.code==='KeyE'));assert.deepEqual(f.observations(),before);clean(f);}
});

test('UI, background, flight, unmounted state and rig loading stop an already running driver',()=>{
 const changes=[f=>{f.flags.input=true;},f=>{f.flags.photo=true;},f=>{f.w.document.hidden=true;},f=>{f.flags.freecam=true;},f=>f.api.configure({ready:false}),f=>{f.player.flying=true;},f=>{f.player.onFoot=true;},f=>{f.flags.onFoot=true;},f=>{f.flags.vehicle={};},f=>{f.rig.ready=false;},f=>{f.rig.loadingBreed=true;}];
 for(const change of changes){const f=fixture();f.api.startFlatRaceDriver();f.tick();assert.equal(f.api.state().held.KeyW,true);change(f);const before=f.observations();f.tick();halted(f,/blocked|unavailable/);assert.deepEqual(f.observations(),before);}
});

test('course, event and mount identity changes halt rather than adopting another run',()=>{
 const changes=[f=>{f.course=copy(f.course);},f=>{f.course.ev=copy(f.course.ev);},f=>{f.course.ev.id='r1';},f=>{f.course.jumps[0].kind='fence';},f=>{f.ridden={id:8,name:'Clover',breed:'pinto'};},f=>{f.ridden=null;}];
 for(const change of changes){const f=fixture();f.api.startFlatRaceDriver();f.tick();change(f);const before=f.observations();f.tick();halted(f,/changed|unavailable/);assert.deepEqual(f.observations(),before);}
});

test('a missing originally ridden horse cannot provide a valid mounted-race identity',()=>{
 const f=fixture();f.ridden=null;const before=f.observations();f.api.startFlatRaceDriver();f.tick();assert.equal(f.api.state().active,false);assert.deepEqual(f.trace.gaits,[]);assert.deepEqual(f.observations(),before);clean(f);
});

test('missing gates, invalid rider telemetry and invalid clocks halt without course repair or completion injection',()=>{
 const changes=[f=>{f.course.idx=2;},f=>{f.course.idx=-1;},f=>{f.course.idx=.5;},f=>{f.course.jumps[0]=null;},f=>{f.player.pos.x=NaN;},f=>{f.player.pos.z=Infinity;},f=>{f.player.heading=NaN;},f=>{f.player.speed=Infinity;},f=>{f.course.t=NaN;},f=>{f.course.cd=Infinity;}];
 for(const change of changes){const f=fixture();f.api.startFlatRaceDriver();f.tick();change(f);const before=f.observations();f.tick();halted(f,/unavailable|unsupported/);assert.deepEqual(f.observations(),before);}
 const f=fixture();f.api.startFlatRaceDriver();f.tick();f.course=null;f.tick();halted(f,/ended/);assert.equal(f.saved.totalRaces,0);
});

test('five seconds of held-forward physical stall stops input; observed movement resets that deadline',()=>{
 const stalled=fixture();stalled.api.startFlatRaceDriver();stalled.tick(5000);assert.equal(stalled.api.state().active,true);stalled.tick(1);halted(stalled,/no physical progress for five seconds/);assert.equal(stalled.course.idx,0);assert.equal(stalled.course.t,12);
 const moving=fixture();moving.api.startFlatRaceDriver();moving.tick(4900);moving.player.pos.z=.3;moving.tick(100);moving.tick(4900);assert.equal(moving.api.state().active,true);moving.tick(101);halted(moving,/no physical progress/);
});

test('diagnostics preserve the course horse and actual result data after the course ends',()=>{
 const f=fixture(),before=f.observations(),first=f.api.readEventCourse();assert.equal(first.active,true);assert.deepEqual(first.horse,{id:7,name:'Juniper',breed:'bay'});assert.equal(first.id,'rr');assert.equal(first.difficulty,'beginner');assert.equal(first.accuracy,.91);assert.equal(first.raceAccuracy,.96);assert.deepEqual(first.target,{kind:'gate',x:0,z:40,distance:40});assert.deepEqual(f.observations(),before);
 delete f.course.ce.acc;f.course.rb={acc:.87};assert.equal(f.api.readEventCourse().accuracy,.87);assert.equal(f.api.readEventCourse().raceAccuracy,.96);f.ridden={id:8,name:'Clover',breed:'pinto'};f.course=null;f.dialog.visible=true;f.dialog.text='  Actual production result: finished River Run.  ';const last=f.api.readEventCourse();assert.equal(last.active,false);assert.deepEqual(last.horse,first.horse);assert.equal(last.resultText,'Actual production result: finished River Run.');assert.equal(f.saved.totalRaces,0);clean(f);
});

test('a real window keyup clears intent so the next forward request dispatches another keydown',()=>{
 const f=fixture();f.api.key('KeyW',true);f.api.key('KeyW',true);assert.equal(f.trace.events.filter(e=>e.type==='keydown'&&e.code==='KeyW').length,1);f.emitWindow('keyup',{code:'KeyW'});assert.equal(f.api.state().held.KeyW,false);f.api.key('KeyW',true);assert.equal(f.trace.events.filter(e=>e.type==='keydown'&&e.code==='KeyW').length,2);f.emitWindow('keyup',{code:'KeyQ'});assert.equal(Object.hasOwn(f.api.state().held,'KeyQ'),false);clean(f);
});

test('stamina diagnostics report actual raw exhaustion and landing values without changing them',()=>{
 const f=fixture(),fields=player=>({stam:player.stam,blown:player.blown,exhaustT:player.exhaustT,landT:player.landT});
 Object.assign(f.player,{stam:17.5,blown:true,exhaustT:2.4,landT:.65});let before=f.observations();assert.deepEqual(fields(f.api.readEventCourse().player),{stam:17.5,blown:true,exhaustT:2.4,landT:.65});assert.deepEqual(f.observations(),before);
 Object.assign(f.player,{stam:0,blown:false,exhaustT:0,landT:0});before=f.observations();assert.deepEqual(fields(f.api.readEventCourse().player),{stam:0,blown:false,exhaustT:0,landT:0});assert.deepEqual(f.observations(),before);
 for(const invalid of [undefined,null,NaN,Infinity,-Infinity,'2.4']){Object.assign(f.player,{stam:invalid,blown:undefined,exhaustT:invalid,landT:invalid});before=f.observations();assert.deepEqual(fields(f.api.readEventCourse().player),{stam:null,blown:false,exhaustT:0,landT:0});assert.deepEqual(f.observations(),before);}
 assert.deepEqual(f.trace.gaits,[]);assert.deepEqual(f.trace.events,[]);assert.equal(f.timers.size,0);clean(f);
});
