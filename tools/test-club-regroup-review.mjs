import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {regroupDriverDecision} from '../review/club-regroup/driver.mjs';
const read=name=>readFileSync(new URL('../review/club-regroup/'+name,import.meta.url),'utf8');
const source=read('client.js'),parentSource=read('review.js'),server=read('serve.py');
const section=(text,a,b)=>{const start=text.indexOf(a),end=text.indexOf(b,start);assert(start>=0&&end>start,`Source section ${a}`);return text.slice(start,end);};
const token='regroup-1234567890123456',marker=JSON.stringify({version:1,role:'host',token}),SAVE='starRanchFable_v1',MARK='club-regroup-review-owned';
function originFixture(entries=[],location={protocol:'http:',hostname:'127.0.0.1',port:'18822'}){
 const map=new Map(entries),writes=[];
 const localStorage={get length(){return map.size;},getItem:key=>map.get(key)??null,setItem:(key,value)=>{writes.push([key,value]);map.set(key,value);}};
 const ctx=vm.createContext({localStorage,location,role:'host',token});
 vm.runInContext(`const PORTS={host:'18822',guest:'18823'},SAVE=${JSON.stringify(SAVE)},MARK=${JSON.stringify(MARK)};`+section(source,'function guard(){','function status('),ctx);
 return {ctx,map,writes,claim:()=>vm.runInContext('claimOrigin()',ctx)};
}
test('a fresh origin writes only the exact own marker; a reload leaves the production save unchanged',()=>{
 const f=originFixture();f.claim();assert.deepEqual(f.writes,[[MARK,marker]]);
 const save=JSON.stringify({name:'Actual rider',coins:1500,clubMeta:{pub:false},horses:[{id:42,xp:125}]});
 const owned=originFixture([[MARK,marker],[SAVE,save]]);owned.claim();assert.deepEqual(owned.writes,[[MARK,marker]]);assert.equal(owned.map.get(SAVE),save);
});
test('unrelated markers/storage, wrong ports/tokens, and public saves are refused without any write or deletion',()=>{
 for(const entries of [[['unrelated','keep']],[[MARK,JSON.stringify({version:1,role:'guest',token})]],[[MARK,marker],[SAVE,JSON.stringify({pubWorld:true})]],[[MARK,marker],[SAVE,JSON.stringify({clubMeta:{pub:true}})]]]){
  const f=originFixture(entries);assert.throws(f.claim);assert.deepEqual(f.writes,[]);assert.deepEqual([...f.map],entries);
 }
 for(const location of [{protocol:'https:',hostname:'127.0.0.1',port:'18822'},{protocol:'http:',hostname:'127.0.0.1',port:'18820'},{protocol:'http:',hostname:'example.com',port:'18822'}]){const f=originFixture([],location);assert.throws(f.claim);assert.deepEqual(f.writes,[]);}
 const f=originFixture();vm.runInContext('token="bad"',f.ctx);assert.throws(f.claim);assert.deepEqual(f.writes,[]);
});
test('the new fixture exposes no mutation, arbitrary-selector, controller or packet endpoint',()=>{
 assert.equal((source.match(/localStorage\.setItem\(/g)||[]).length,1);assert.doesNotMatch(source,/localStorage\.(removeItem|clear)|G\.(clubRides|trail)\.(host|join|ready|start|readyAtStop|continueTogether|continueAlone|receive|finish)|\.pos\.(set|copy)|\.idx\s*=|\.xp\s*=|\.coins\s*=|\.publish\(|eval\(|new Function/);
 assert.match(source,/normalInput\(f\.elements\.namedItem\('name'\),name\)/);assert.match(source,/f\.requestSubmit\(button\)/);assert.match(source,/button\.click\(\)/);
 assert.doesNotMatch(source,/\?qa=|&qa=/);assert.match(source,/diagnostics=qa/);assert.match(server,/18822 if args\.role=='host' else 18823/);assert.match(server,/X-Club-Regroup-Review/);
});
function controlsFixture(){
 const errors=[],publications=[],buttons=[],wrapper={click(){buttons.push('wrapper');}},form={click(){buttons.push('form');}};
 const button={id:'clubRegroupReady',dataset:{},tagName:'BUTTON',textContent:'Ready for next leg',hidden:false,disabled:false,getClientRects:()=>[{}],ownerDocument:{defaultView:{getComputedStyle:()=>({visibility:'visible'})}},matches:()=>false,getAttribute:()=>null,closest:()=>null,click:()=>buttons.push('ready')};
 const parent={},listeners={};
 const ctx=vm.createContext({parent,parentOrigin:'http://127.0.0.1:18822',token,window:{addEventListener:(type,fn)=>listeners[type]=fn},$:id=>id==='boot'?wrapper:form,w:{document:{querySelectorAll:()=>[button]}},submitForm:()=>buttons.push('form'),publish:options=>publications.push(options),rememberError:error=>errors.push(String(error)),lastCommand:null});
 vm.runInContext(section(source,'const WRAPPERS=','const held=')+section(source,'function visible(','function formReady(')+section(source,'function regroupCommand(','async function openClub(')+section(source,"window.addEventListener('message',e=>{",'for(const command of WRAPPERS)'),ctx);
 return {ctx,parent,listeners,button,buttons,errors,publications,command:command=>listeners.message({source:parent,origin:'http://127.0.0.1:18822',data:{type:'club-regroup-review-command',token,command}})};
}
test('only exact new regroup/normal club controls and fixed HUD IDs pass the real allowlist',()=>{
 const f=controlsFixture();for(const action of ['social-host-regroup','social-join','social-ready','social-start','social-resume','social-alone','social-leave']){f.button.id='';f.button.dataset={chub:action};assert.equal(vm.runInContext('allowed(w.document.querySelectorAll()[0])',f.ctx),true);}
 for(const action of ['social-host','social-cancel','social-request','claim','teleport']){f.button.id='';f.button.dataset={chub:action};assert.equal(vm.runInContext('allowed(w.document.querySelectorAll()[0])',f.ctx),false);}
 f.button.id='';f.button.dataset={fx:'clubs:claim:anything'};assert.equal(vm.runInContext('allowed(w.document.querySelectorAll()[0])',f.ctx),false);
 for(const id of ['clubRegroupReady','clubRegroupContinue']){f.button.id=id;f.button.dataset={};assert.equal(vm.runInContext('allowed(w.document.querySelectorAll()[0])',f.ctx),true);}
});
test('real command handler requires the exact currently visible enabled descriptor and refuses arbitrary requests',()=>{
 const f=controlsFixture(),key=vm.runInContext('descriptor(w.document.querySelectorAll()[0]).key',f.ctx);f.command({kind:'game',key});assert.deepEqual(f.buttons,['ready']);
 f.button.disabled=true;f.command({kind:'game',key});assert.deepEqual(f.buttons,['ready']);f.button.disabled=false;
 f.command({kind:'game',key:'button'});f.command({kind:'controller',action:'readyAtStop'});f.command({kind:'wrapper',command:'teleport'});assert.deepEqual(f.buttons,['ready']);assert.equal(f.errors.length,4);
 f.button.getClientRects=()=>[];f.command({kind:'game',key});assert.deepEqual(f.buttons,['ready']);
});
test('wrapper message handling checks parent source, independent origin and exact token before any command',()=>{
 const f=controlsFixture(),key=vm.runInContext('descriptor(w.document.querySelectorAll()[0]).key',f.ctx),base={source:f.parent,origin:'http://127.0.0.1:18822',data:{type:'club-regroup-review-command',token,command:{kind:'game',key}}};
 for(const event of [{...base,source:{}},{...base,origin:'http://127.0.0.1:18823'},{...base,data:{...base.data,token:'regroup-foreign'}},{...base,data:{...base.data,type:'synthetic-packet'}}])f.listeners.message(event);
 assert.deepEqual(f.buttons,[]);f.listeners.message(base);assert.deepEqual(f.buttons,['ready']);
});
test('parent reports also require matching source, origin, role and token for each independent client',()=>{
 const frames={host:{contentWindow:{}},guest:{contentWindow:{}}},latest={},listeners={};
 const ctx=vm.createContext({roles:['host','guest'],origins:{host:'http://127.0.0.1:18822',guest:'http://127.0.0.1:18823'},$:id=>frames[id],token,latest,lastDiagnostics:{},diagnosticRequest:null,show(){},finishDownload(){},window:{addEventListener:(type,fn)=>listeners[type]=fn}});
 vm.runInContext(section(parentSource,"window.addEventListener('message',e=>{", "$('load').onclick="),ctx);
 const data={type:'club-regroup-review-report',token,role:'host',report:{at:42}};
 for(const event of [{source:frames.host.contentWindow,origin:'http://127.0.0.1:18823',data},{source:frames.guest.contentWindow,origin:'http://127.0.0.1:18822',data},{source:frames.host.contentWindow,origin:'http://127.0.0.1:18822',data:{...data,role:'guest'}},{source:frames.host.contentWindow,origin:'http://127.0.0.1:18822',data:{...data,token:'other'}}])listeners.message(event);
 assert.deepEqual(latest,{});listeners.message({source:frames.host.contentWindow,origin:'http://127.0.0.1:18822',data});assert.equal(latest.host.at,42);
});
function driveFixture(){return {sessionId:'actual-session',snapshot:{connected:true,current:{id:'actual-session',mode:'regroup-v1',status:'riding',regroup:{stopIndex:1,arrived:false,ready:false,reason:'Follow the golden marker.',target:{x:20,z:16,radius:8},people:[{id:'host',online:true},{id:'guest',online:true}]}}},trail:{idx:1,clubRideId:'actual-session',clubRegroup:'regroup-v1',pts:[['Home',0,5],['Lake',20,16],['Pasture',-70,-10],['Home',0,5]]},player:{x:0,z:5,heading:Math.atan2(20,11),speed:2,y:0,ready:true},world:{groundH:()=>0,colliders:[],walls:[]}};}
test('bounded driver selects normal input toward the published lake shore6.5m from centre without mutating any snapshot',()=>{
 const f=driveFixture(),before=JSON.stringify(f),d=regroupDriverDecision(f);assert.equal(d.type,'drive');assert.equal(d.keys.KeyW,true);assert.ok(Math.abs(Math.hypot(d.target.x-20,d.target.z-16)-6.5)<1e-9);assert.equal(d.target.radius,8);assert.equal(d.target.stopIndex,1);assert.equal(JSON.stringify(f),before);
});
test('actual production ground clearance blocks a wall/collider or lake-interior approach and invents no detour',()=>{
 for(const world of [{groundH:()=>0,colliders:[{x:7,z:8.85,r:2}],walls:[]},{groundH:()=>0,colliders:[],walls:[{x1:7,z1:0,x2:7,z2:16}]}]){const f=driveFixture();f.world=world;const d=regroupDriverDecision(f);assert.equal(d.type,'stop');assert.equal(d.keys.KeyW,false);assert.match(d.reason,/blocked/);}
});
test('Ready and physical arrival wait with only ordinary brake input, never automatically Ready/Continue or credit a stop',()=>{
 for(const change of [f=>f.snapshot.current.regroup.arrived=true,f=>f.snapshot.current.regroup.ready=true,f=>{f.player.x=14;f.player.z=13;}]){const f=driveFixture(),before=f.trail.idx;change(f);const d=regroupDriverDecision(f);assert.equal(d.type,'wait');assert.equal(d.keys.KeyW,false);assert.equal(d.keys.KeyS,true);assert.equal(f.trail.idx,before);}
});
test('driver pauses safely on missing/freshness/menu/mount state and stops on session or real-cursor mismatch',()=>{
 for(const change of [f=>f.blocked=true,f=>f.snapshot.connected=false,f=>f.snapshot.current.regroup.people[1].online=false,f=>delete f.snapshot.current.regroup.people,f=>f.player.onFoot=true,f=>f.player.flying=true,f=>f.player.landing=true,f=>f.player.ready=false,f=>f.player.loading=true,f=>f.player.y=.2]){const f=driveFixture();change(f);assert.equal(regroupDriverDecision(f).type,'pause');}
 for(const change of [f=>f.sessionId='other',f=>f.trail.idx=2,f=>delete f.snapshot.current.regroup.target,f=>f.snapshot.current.regroup.target.radius=12,f=>f.elapsed=180000,f=>f.snapshot.current.finished=true]){const f=driveFixture();change(f);assert.equal(regroupDriverDecision(f).type,'stop');}
});
test('ordinary keyup updates only fixture-held intent and allows re-press after a production release',()=>{
 const listener={},events=[],w={KeyboardEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},document:{dispatchEvent:event=>events.push(event)}};
 const ctx=vm.createContext({w});vm.runInContext('const held={};'+section(source,'function rememberReleasedKey(','function release('),ctx);
 vm.runInContext("key('KeyW',true);rememberReleasedKey({code:'KeyW'});key('KeyW',true)",ctx);assert.equal(events.filter(e=>e.type==='keydown'&&e.code==='KeyW').length,2);
 vm.runInContext("rememberReleasedKey({code:'Escape'})",ctx);assert.equal(vm.runInContext("Object.hasOwn(held,'Escape')",ctx),false);
 assert.match(source,/w\.addEventListener\('keyup',rememberReleasedKey\)/);
});
function manualFixture(){
 let now=0,nextId=0;const timers=new Map(),events=[],keys={},nodes=new Map(),messages=[],trace={releaseAll:0,blur:0,publish:0};
 const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:id,disabled:false});return nodes.get(id);};
 const w={KeyboardEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},document:{hidden:false,activeElement:{blur(){trace.blur++;}},dispatchEvent(event){events.push({at:now,type:event.type,code:event.code});keys[event.code]=event.type==='keydown';}}};
 const G={clubRides:{snapshot:()=>({current:{}})},input:{blocked:()=>false},riding:{releaseAll:()=>trace.releaseAll++}};
 const ctx=vm.createContext({$,w,G,Date:{now:()=>now},setTimeout:(fn,ms)=>{const id=++nextId;timers.set(id,{at:now+ms,ms,fn});return id;},clearTimeout:id=>timers.delete(id),clearInterval(){},status:message=>messages.push(message),publish:()=>trace.publish++});
 vm.runInContext(section(source,'const MANUAL_INPUTS=','const held=')+'const held={};let booted=true,manualTimer=null,jumpTimer=null,driver=null,driverSession=null,driverStatus=null,lastCommand=null;'+section(source,'function rememberReleasedKey(','function manualEscape(')+section(source,'function manualMove(','function drive('),ctx);
 const advance=to=>{for(;;){const next=[...timers].filter(([,row])=>row.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=to;};
 return {ctx,nodes,timers,events,keys,G,w,trace,messages,advance,move:(command,...args)=>vm.runInContext(`manualMove(${JSON.stringify(command)}${args.map(arg=>','+JSON.stringify(arg)).join('')})`,ctx)};
}
test('fine/long wrapper commands have exact fixed key durations and ordinary keyup release, ignoring arbitrary extra duration arguments',()=>{
 for(const [command,code,ms]of [['leftFine','KeyA',120],['rightFine','KeyD',120],['forwardLong','KeyW',2000],['brakeLong','KeyS',1000]]){
  const f=manualFixture();f.move(command,999999);assert.equal(f.keys[code],true);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].ms,ms);assert.equal(f.nodes.get('stop').disabled,false);
  f.advance(ms-1);assert.equal(f.keys[code],true);f.advance(ms);assert.equal(f.keys[code],false);assert.equal(f.timers.size,0);assert.equal(f.nodes.get('stop').disabled,true);assert.deepEqual(f.events,[{at:0,type:'keydown',code},{at:ms,type:'keyup',code}]);assert.equal(f.trace.publish,1);assert.equal(f.trace.blur,1);
 }
});
test('Stop or a replacement command cancels the preceding fixed hold and releases its key before new input',()=>{
 const f=manualFixture();f.move('forwardLong');f.advance(50);f.move('leftFine');assert.equal(f.keys.KeyW,false);assert.equal(f.keys.KeyA,true);assert.equal(f.timers.size,1);f.advance(170);assert.equal(f.keys.KeyA,false);f.advance(2000);assert.equal(f.events.filter(e=>e.code==='KeyW'&&e.type==='keyup').length,1);
 const g=manualFixture();g.move('forwardLong');g.advance(30);vm.runInContext('stopDriver()',g.ctx);assert.equal(g.keys.KeyW,false);assert.equal(g.timers.size,0);g.advance(3000);assert.equal(g.events.length,2);assert.equal(g.nodes.get('stop').disabled,true);
});
test('fine/long manual inputs still refuse blocked/hidden/unbooted riding and unknown command names before any key is pressed',()=>{
 for(const change of [f=>f.G.input.blocked=()=>true,f=>f.w.document.hidden=true,f=>vm.runInContext('booted=false',f.ctx)]){const f=manualFixture();change(f);assert.throws(()=>f.move('forwardLong'),/ordinary riding/);assert.equal(f.events.length,0);assert.equal(f.timers.size,0);}
 const f=manualFixture();for(const command of ['forwardForever','manualDuration','__proto__','constructor'])assert.throws(()=>f.move(command),/exact fixed/);assert.equal(f.events.length,0);
});
test('new controls create explicit labeled wrapper buttons and appear in both fixed parent/client allowlists',()=>{
 const created=[],left={parentElement:{appendChild:button=>created.push(button)}},ctx=vm.createContext({document:{createElement:()=>({})},$:()=>left});
 vm.runInContext(section(source,"for(const [id,label]of [['leftFine'",'function guard(){'),ctx);
 assert.deepEqual(created.map(b=>[b.id,b.textContent,b.disabled]),[['leftFine','Turn A · 120 ms',true],['rightFine','Turn D · 120 ms',true],['forwardLong','Hold W · 2 s',true],['brakeLong','Brake S · 1 s',true]]);
 const parent=vm.createContext({});vm.runInContext(section(parentSource,'const wrappers=','$(\'identity\')')+section(parentSource,'function permitted(','function commandKey('),parent);
 const client=controlsFixture();for(const command of ['leftFine','rightFine','forwardLong','brakeLong']){assert.equal(vm.runInContext(`permitted({kind:'wrapper',command:${JSON.stringify(command)}})`,parent),true);assert.equal(vm.runInContext(`WRAPPERS.has(${JSON.stringify(command)})`,client.ctx),true);}
 assert.equal(vm.runInContext("permitted({kind:'wrapper',command:'customDuration'})",parent),false);
});
test('actual reporting projects real trail cursor/stops, physical rider and own saved counters with named errors separately',()=>{
 const saved={coins:1700,gems:11,sp:{pts:18},stats:{trails:2,expeditions:1},expDone:{basin:1}},trail={idx:2,pts:[['Home',0,5],['Lake',20,16],['Pasture',-70,-10],['Home',0,5]],t:35,clubRideId:'actual',clubRegroup:'regroup-v1',exped:'basin'};
 const before=structuredClone({saved,trail}),ctx=vm.createContext({Date,role:'host',token,location:{origin:'http://127.0.0.1:18822'},localStorage:{getItem:()=>marker},MARK,marker:()=>marker,booted:true,window:{scrollY:0},$:id=>id==='status'?{textContent:'Normal ready'}:{getBoundingClientRect:()=>({bottom:1400})},controls:()=>({}),copy:v=>v==null?v:JSON.parse(JSON.stringify(v)),readSave:()=>saved,runtimeErrors:['runtime-proof'],fixtureErrors:['fixture-proof'],driver:null,driverStatus:'waiting',steps:3,lastAim:null,
  G:{clubs:{identity:()=>({code:'mr-owned',name:'Private',pub:false})},clubRides:{snapshot:()=>({current:{id:'actual',regroup:{stopIndex:2}}})},horse:{player:{pos:{x:-62,z:-10},heading:1,speed:0,y:0},RIG:()=>({ready:true})},trail:{ride:trail},net:{net:{id:'actual-identity',club:'mr-owned',client:{connected:true}},myName:()=> 'Normal rider'},errors:[{id:'world-terrain',error:'world proof'},{id:'other',error:'separate proof'}]}});
 vm.runInContext(section(source,'function sample(){','function transitionSummary('),ctx);const row=vm.runInContext('sample()',ctx);
 assert.equal(row.origin,'http://127.0.0.1:18822');assert.equal(row.trail.idx,2);assert.equal(row.trail.pts.length,4);assert.equal(row.player.x,-62);assert.equal(row.player.heading,1);assert.equal(row.player.speed,0);assert.equal(row.save.coins,1700);assert.equal(row.save.trails,2);assert.equal(row.save.expDone.basin,1);assert.equal(row.worldErrors[0].id,'world-terrain');assert.equal(row.errors.length,2);assert.equal(row.runtimeErrors[0],'runtime-proof');assert.equal(row.fixtureErrors[0],'fixture-proof');assert.deepEqual({saved,trail},before);
});
test('automatic observation reporting remains bounded to one publication per second despite frequent production change events',()=>{
 let now=0,sequence=0;const timers=new Map(),sent=[],ctx=vm.createContext({Date:{now:()=>now},setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{at:now+ms,fn});return id;},publish:()=>sent.push(now)});
 vm.runInContext('const reporting={automaticRequests:0,triggerCounts:{}};let reportTimer=null,lastAutomaticAt=0;'+section(source,'function scheduleAutomatic(','function publish('),ctx);
 const advance=to=>{for(;;){const next=[...timers].filter(([,row])=>row.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=to;};
 for(let at=0;at<6000;at+=150){advance(at);vm.runInContext("scheduleAutomatic('clubRideChanged')",ctx);}advance(6500);
 assert.equal(sent.length,6);for(let i=1;i<sent.length;i++)assert.ok(sent[i]-sent[i-1]>=1000);assert.equal(vm.runInContext('reporting.automaticRequests',ctx),40);
});
