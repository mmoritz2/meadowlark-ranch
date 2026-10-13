import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {flatRaceSegmentClear} from '../assets/flat-race-guidance.mjs';
import {rushRecoverySegmentClear} from '../assets/features/course-guide.js';
const source=fs.readFileSync(new URL('../review/first-rides/review.js',import.meta.url),'utf8');
const section=(a,b)=>{const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert(x>=0&&y>x,a);return source.slice(x,y);};
const driver=section('function h1CourseSupported(c){','// Only ordinary flat gate races');
const controls=section('function key(code,on){','function manualJump(){')+section('function blocked(){','function manual(code){');
const keyup=source.split('\n').find(line=>line.trim().startsWith("w.addEventListener('keyup',"));
const copy=value=>structuredClone(value);
function course(){return {ev:{id:'h1',name:'Cottonwood Welcome Jump'},started:true,cd:0,t:2,idx:0,faults:0,ce:{kind:'jump',diff:{k:'open'},lap:1,laps:1,timeAllowed:60,grades:[],refusals:0},
 jumps:[{kind:'fence',x:0,z:0,rotY:0},{kind:'fence',x:40,z:20,rotY:0},{kind:'fence',x:40,z:0,rotY:0},{kind:'fence',x:20,z:-30,rotY:0},{kind:'fence',x:-20,z:20,rotY:0}]};}
function fixture(){
 let now=100000,current=course(),horse={id:17,name:'Bramble',breed:'bay-sporthorse'},cue='early',published=null,timerId=0;
 const mesh={},player={pos:{x:0,z:-10},mesh,heading:0,speed:3.5,y:0,onFoot:false,flying:false},rig={ready:true,loadingBreed:false,attachedTo:mesh,heroMotion:{},heroJumpAge:null};
 const world={colliders:[],walls:[],groundH:()=>0},save={coins:100,story:{idx:7,prog:0},ribbons:{},horses:[copy(horse)]};
 const flags={input:false,photo:false,onFoot:false,vehicle:null},timers=new Map(),listeners=new Map();
 const trace={events:[],gaits:[],writes:[],forbidden:[],statuses:[],reports:0,releases:0,errors:[]},seen=new WeakMap();
 function readonly(value,label){if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);const p=new Proxy(value,{get(t,k){return readonly(Reflect.get(t,k),label+'.'+String(k));},set(_t,k){trace.writes.push(label+'.'+String(k));throw Error('driver wrote game state');},deleteProperty(_t,k){trace.writes.push(label+'.'+String(k));throw Error('driver deleted game state');}});seen.set(value,p);return p;}
 const forbid=name=>()=>{trace.forbidden.push(name);throw Error('forbidden '+name);};
 const w={document:{hidden:false,activeElement:{blur(){}},body:{classList:{contains:()=>false}},dispatchEvent(e){trace.events.push({type:e.type,code:e.code});for(const fn of listeners.get(e.type)||[])fn(e);}},
  KeyboardEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},addEventListener(type,fn){const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows);},advanceTime:forbid('advanceTime')};
 const G={world:readonly(world,'world'),horse:{player:readonly(player,'player'),ridden:()=>readonly(horse,'horse'),RIG:()=>readonly(rig,'rig')},
  course:{get:()=>readonly(current,'course'),startCourse:forbid('startCourse'),cancelCourse:forbid('cancelCourse'),finishCourse:forbid('finishCourse')},
  courseGuide:{target:()=>published??(current?.jumps[current.idx]?[current.jumps[current.idx].x,current.jumps[current.idx].z]:null),jumpCue:()=>cue,isEnabled:()=>true,recovery:()=>null,plan:forbid('plan')},
  input:{blocked:()=>flags.input},get photoPause(){return flags.photo;},onFoot:{get on(){return flags.onFoot;}},worldPkg:{vehicle:()=>flags.vehicle},
  riding:{selectGait:g=>trace.gaits.push(g),releaseAll(){trace.releases++;}},save:{fresh:()=>readonly(save,'save'),sync:forbid('save.sync')}};
 const clock=class extends Date{static now(){return now;}};
 const api=Function('G','w','Date','setInterval','clearInterval','setTimeout','clearTimeout','flatRaceSegmentClear','rushRecoverySegmentClear','trace',
  `let ready=true,storageOwned=true,networkStopped=false,manualTimer=null,jumpTimer=null,driver=null,driverStatus='off',driverSteps=0,driverTarget=null,h1Course=null,h1Horse=null,h1LastTraceKey='',h1LastTraceAt=-Infinity;const held={},h1Trace=[];const $=()=>({value:'on'});const status=s=>trace.statuses.push(s),report=()=>trace.reports++,fail=e=>trace.errors.push(String(e));`+
  controls+driver+keyup+`return {startH1Driver,readH1Course,state:()=>({active:!!driver,status:driverStatus,target:driverTarget,held:{...held}}),setSafety(k,v){if(k==='ready')ready=v;if(k==='storageOwned')storageOwned=v;if(k==='networkStopped')networkStopped=v;},trace:()=>structuredClone(h1Trace)};`)(
   G,w,clock,(fn)=>{const id=++timerId;timers.set(id,{kind:'interval',fn});return id;},id=>timers.delete(id),fn=>{const id=++timerId;timers.set(id,{kind:'timeout',fn});return id;},id=>timers.delete(id),flatRaceSegmentClear,rushRecoverySegmentClear,trace);
 return {G,w,api,player,rig,world,flags,trace,save,timers,get course(){return current;},set course(v){current=v;},get horse(){return horse;},set horse(v){horse=v;},set cue(v){cue=v;},set published(v){published=v;},
  observations:()=>copy({course:current,player,rig,horse,save}),tick(ms=100){now+=ms;for(const item of [...timers.values()])if(item.kind==='interval')item.fn();},flushJump(){for(const [id,item]of [...timers])if(item.kind==='timeout'){timers.delete(id);item.fn();}}};
}
function clean(f){assert.deepEqual(f.trace.writes,[]);assert.deepEqual(f.trace.forbidden,[]);assert.deepEqual(f.trace.errors,[]);}
function stopped(f,pattern){assert.equal(f.api.state().active,false);assert.match(f.api.state().status,pattern);assert.equal(!!f.api.state().held.KeyW,false);clean(f);}

test('h1 first attempt uses only ordinary keys/gait and leaves all observed game state untouched',()=>{
 const f=fixture(),before=f.observations();f.api.startH1Driver();f.tick();assert.equal(f.api.state().held.KeyW,true);assert.deepEqual(f.trace.gaits,['trot']);
 assert.deepEqual(f.observations(),before);assert.deepEqual([f.api.state().target.x,f.api.state().target.z],[0,0]);clean(f);
});
test('only actual h1 formal five-fence rounds on an owned local origin are accepted',()=>{
 for(const edit of [c=>c.ev.id='h2',c=>c.rush=true,c=>c.ev.rush=true,c=>c.ce.kind='race',c=>c.race=true,c=>c.dressage=true,c=>c.ev.kind='custom',c=>c.jumps.pop(),c=>c.jumps[0].kind='gate',c=>c.jumps[0].x=NaN]){
  const f=fixture();edit(f.course);f.api.startH1Driver();assert.equal(f.api.state().active,false);assert.deepEqual(f.trace.events,[]);clean(f);
 }
 for(const [key,value]of [['ready',false],['storageOwned',false],['networkStopped',true]]){const f=fixture();f.api.setSafety(key,value);f.api.startH1Driver();assert.equal(f.api.state().active,false);clean(f);}
});
test('Ready card and genuine countdown wait without key events, dismissal, or clock writes',()=>{
 const f=fixture();f.course.started=false;f.course.cd=3.6;f.flags.input=true;const before=f.observations();f.api.startH1Driver();f.tick(1000);
 assert.equal(f.api.state().active,true);assert.match(f.api.state().status,/real Ready\/countdown/);assert.deepEqual(f.trace.events,[]);assert.deepEqual(f.observations(),before);
 f.flags.input=false;f.course.started=true;f.course.cd=0;f.tick();assert.equal(f.api.state().held.KeyW,true);clean(f);
});
test('current perfect cue sends one Space pulse; production alone starts the native jump',()=>{
 const f=fixture();f.cue='perfect';const before=f.observations();f.api.startH1Driver();f.tick();f.tick();
 assert.equal(f.trace.events.filter(e=>e.type==='keydown'&&e.code==='Space').length,1);assert.equal(f.rig.heroJumpAge,null);assert.deepEqual(f.observations(),before);
 f.rig.heroJumpAge=.25;f.tick();f.flushJump();assert.equal(f.api.state().held.Space,false);assert.equal(f.trace.events.filter(e=>e.type==='keydown'&&e.code==='Space').length,1);clean(f);
});
test('a previous-fence cue cannot trigger Space for the new fence before its target is published',()=>{
 const f=fixture();f.api.startH1Driver();f.tick();f.course.idx=1;f.published=[0,0];f.cue='perfect';f.tick();
 assert.equal(f.api.state().active,true);assert.equal(f.api.state().held.KeyW,false);assert.equal(f.trace.events.some(e=>e.code==='Space'),false);assert.match(f.api.state().status,/current published fence/);
 f.published=[40,20];f.cue='early';f.tick();assert.equal(f.api.state().active,true);assert.equal(f.api.state().target.checkpoint,2);clean(f);
});
test('a scored airborne crossing keeps the prior alignment and real input until landing, then checks the next ground corridor',()=>{
 const f=fixture();f.api.startH1Driver();f.tick();f.rig.heroJumpAge=.98;f.player.y=.4;f.player.pos.z=.8;f.course.ce.grades.push('perfect');f.course.idx=1;
 // The new target is to the right, and a real wall blocks its direct ground
 // approach. Neither may turn/stop the rider before the already scored flight.
 f.world.walls.push({x1:10,z1:-10,x2:10,z2:30});f.cue='perfect';const airborne=f.observations();f.tick();
 assert.equal(f.api.state().active,true);assert.equal(f.api.state().target.phase,'landing');assert.equal(f.api.state().held.KeyW,true);assert.equal(!!f.api.state().held.KeyA,false);assert.equal(!!f.api.state().held.KeyD,false);assert.equal(!!f.api.state().held.Space,false);assert.match(f.api.state().status,/scored jump to land/);assert.deepEqual(f.observations(),airborne);
 f.player.pos.z=2;f.rig.heroJumpAge=1.3;f.tick();assert.equal(f.api.state().target.phase,'landing');assert.deepEqual(f.course.ce.grades,['perfect']);
 // A null age alone is insufficient while height is still above the ground.
 f.rig.heroJumpAge=null;f.player.y=.08;f.tick();assert.equal(f.api.state().target.phase,'landing');
 f.player.y=0;const landed=f.observations();f.tick();stopped(f,/approach is blocked/);assert.deepEqual(f.observations(),landed);assert.equal(f.trace.events.some(e=>e.code==='Space'),false);clean(f);
});
test('a scored airborne transition stays bounded and retains UI, identity and invalid-state stops',()=>{
 for(const change of [f=>f.flags.input=true,f=>f.horse={...f.horse,id:18},f=>f.rig.heroJumpAge=NaN,f=>f.course.idx=2]){
  const f=fixture();f.api.startH1Driver();f.tick();f.course.idx=1;f.rig.heroJumpAge=1;f.player.y=.3;f.tick();assert.equal(f.api.state().target.phase,'landing');change(f);f.tick();stopped(f,/blocked|unavailable|invalid|sequence/);
 }
 const f=fixture();f.api.startH1Driver();f.tick();f.course.idx=1;f.rig.heroJumpAge=1;f.player.y=.3;f.tick();f.tick(2501);stopped(f,/did not land within 2.5 seconds/);assert.deepEqual(f.course.ce.grades,[]);
});

test('first refusal and wrong-side pass stop without invoking a synthetic recovery or changing grade',()=>{
 const refusal=fixture();refusal.api.startH1Driver();refusal.tick();refusal.course.ce.refusals=1;refusal.course.ce.grades.push('refusal');const before=refusal.observations();refusal.tick();stopped(refusal,/first actual formal refusal/);assert.deepEqual(refusal.observations(),before);
 const wrong=fixture();wrong.api.startH1Driver();wrong.player.pos={x:3,z:.2};wrong.tick();stopped(wrong,/behind the rider/);assert.equal(wrong.course.idx,0);assert.deepEqual(wrong.course.ce.grades,[]);
});
test('invalid/missed cue and absent or stale published target cannot become invented guidance',()=>{
 for(const cue of ['forged','lineup','late']){const f=fixture();f.cue=cue;f.api.startH1Driver();f.tick();stopped(f,/cue/);}
 const stale=fixture();stale.published=[8,8];stale.api.startH1Driver();stale.tick();assert.equal(!!stale.api.state().held.KeyW,false);stale.tick(1001);stopped(stale,/target was not published/);
 const disabled=fixture();disabled.G.courseGuide.isEnabled=()=>false;disabled.api.startH1Driver();disabled.tick();stopped(disabled,/guidance is unavailable/);
});
test('actual production clearance validators reject walls, other course rails and no-displacement positive contacts',()=>{
 const wall=fixture();wall.world.walls.push({x1:-10,z1:-5,x2:10,z2:-5});wall.api.startH1Driver();wall.tick();stopped(wall,/approach is blocked/);
 const rail=fixture();rail.course.jumps[1]={kind:'fence',x:0,z:-5,rotY:0};rail.api.startH1Driver();rail.tick();stopped(rail,/approach is blocked/);
 const contact=fixture();contact.world.solidWorld={resolve:()=>1};contact.api.startH1Driver();contact.tick();stopped(contact,/approach is blocked/);assert.deepEqual(contact.trace.gaits,[]);
});
test('no native jump after Space and five seconds of held W without displacement both stop',()=>{
 const absent=fixture();absent.cue='perfect';absent.api.startH1Driver();absent.tick();absent.tick(801);stopped(absent,/no native jump began/);
 const stalled=fixture();stalled.api.startH1Driver();stalled.tick();stalled.tick(5001);stopped(stalled,/no physical progress/);
});
test('model/mount/attachment/vehicle/UI changes stop the same fixed course and horse',()=>{
 for(const change of [f=>f.rig.ready=false,f=>f.rig.loadingBreed=true,f=>f.rig.attachedTo={},f=>f.horse={...f.horse,id:18},f=>f.player.onFoot=true,f=>f.player.flying=true,f=>f.flags.vehicle={},f=>f.flags.input=true]){
  const f=fixture();f.api.startH1Driver();f.tick();change(f);const before=f.observations();f.tick();stopped(f,/unavailable|blocked/);assert.deepEqual(f.observations(),before);
 }
 const ended=fixture();ended.api.startH1Driver();ended.tick();ended.course=null;ended.tick();stopped(ended,/ended/);assert.equal(ended.api.readH1Course().active,false);
});
test('production key release clears the fixture intent cache so the next real keydown is not suppressed',()=>{
 const f=fixture();f.api.startH1Driver();f.tick();assert.equal(f.api.state().held.KeyW,true);
 f.w.document.dispatchEvent(new f.w.KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
 assert.equal(f.api.state().held.KeyW,false);f.tick();assert.equal(f.trace.events.filter(e=>e.type==='keydown'&&e.code==='KeyW').length,2);clean(f);
});
test('both guarded review pages expose the explicit h1 first-attempt control',()=>{
 for(const page of ['index.html','native-preview.html']){const html=fs.readFileSync(new URL('../review/first-rides/'+page,import.meta.url),'utf8');assert.match(html,/id="driveH1" disabled>Drive Welcome Jump · first attempt/);assert.match(html,/review.js\?v=h1-landing-input-2/);}
 assert.match(source,/location.port!=='18800'/);assert.match(source,/X-First-Rides-Offline/);assert.match(source,/Refusing unmarked storage/);
});
