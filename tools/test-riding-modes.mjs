import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {install} from '../assets/features/mastery-style.js';

// Isolated save + real feature. No browser/player save or network access.
const clone=v=>JSON.parse(JSON.stringify(v)),noop=()=>{},checks=[];
const cssClasses=new Set();
globalThis.document={body:{classList:{toggle(k,on){on?cssClasses.add(k):cssClasses.delete(k);},contains:k=>cssClasses.has(k)}}};
function client(initial={},flags={}){
 let data={horses:[{id:1,breed:'epic',name:'Willow',colors:{body:'#777777',mane:'#222222'}}],mastery:{epic:9},wildMode:false,...clone(initial)},index=0,course=null;
 const hooks={},ensures=[],toasts=[],nativeModes=[],remoteModes=[];let writes=0,changes=0,canceled=0;
 const G={THREE,$:()=>null,toast:t=>toasts.push(t),scene:new THREE.Scene(),renderer:{xr:{isPresenting:false}},
  on:(k,f)=>(hooks[k]||=[]).push(f),run(k,...a){let out;for(const f of hooks[k]||[]){const r=f(...a);if(r!==undefined&&out===undefined)out=r;}if(k==='ridingModeChanged')changes++;return out;},
  tables:{BREEDS3:[['bay','Bay','Common',0,0,'#aa6644','#111111',{}],['epic','Epic horse','Epic',0,0,'#cccccc','#222222',{}],['fantasy','Fantasy horse','Legendary',0,0,'#abcdef','#333333',{coat:'moonlit'}]],MASTERY_UNLOCKS:{},HAIR_STYLES:{mane:[],tail:[]},RARITIES:[],STUD_COLS:[]},
  save:{fresh:()=>clone(data),ensure:f=>{ensures.push(f);f(data);},sync(fn){try{const draft=clone(data);ensures.forEach(f=>f(draft));fn(draft);if(flags.failWrite)throw Error('quota');data=draft;writes++;}catch{}}},
  xp:{masteryOf:(s,b)=>s?.mastery?.[b]||0},addMul:noop,
  quest:{dailyEvt:(...a)=>G.run('daily',...a),addDaily:noop,addAch:noop},
  ui:{panel:noop,action:noop,questTab:noop,stableRow:noop,rerender:noop},
  course:{get:()=>course,cancelCourse(){course=null;canceled++;}},key:()=> 'KeyY',
 };
 const rig={ready:false,profile:{nativeKind:'horse'},heroMotion:{state:{action:null,transitioning:false},actionDescriptor:type=>({dismountedOnly:type==='liedown'})}};
 const saddle={visible:true,userData:{}},bridle={visible:true},player={rider:{g:{visible:true}},mesh:new THREE.Group(),onFoot:false};
 G.horse={player,myHorses:clone(data.horses),rideIdx:()=>index,ridden:()=>G.horse.myHorses[index],RIG:()=>rig,TACK:()=>({saddle,bridle}),herd:()=>[],breedLabel:b=>G.tables.BREEDS3.find(r=>r[0]===b)?.[1]||b,
  setNativeRidingMode:m=>nativeModes.push(m),applyNativeRemoteMode:(r,m)=>remoteModes.push({r,m})};
 install(G);
 return {G,flags,toasts,rig,saddle,bridle,player,nativeModes,remoteModes,data:()=>clone(data),writes:()=>writes,changes:()=>changes,canceled:()=>canceled,
  setCourse:v=>course=v,switchHorse(i){index=i;G.run('rebuild');},reload(){return client(data);}};
}
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};

check('Mode options expose accurate natural, Epic, and fantasy unlocks',()=>{
 const common=client({horses:[{id:1,breed:'bay'}],mastery:{bay:8}}),epic=client(),fantasy=client({horses:[{id:1,breed:'fantasy'}],mastery:{fantasy:5}});
 assert.equal(common.G.mastery.ridingModeStatus().mode,'saddled');assert.equal(common.G.mastery.ridingModeStatus().options.find(o=>o.id==='bareback').available,false);
 common.G.save.sync(s=>s.mastery.bay=9);assert.equal(common.G.mastery.ridingModeStatus().options.find(o=>o.id==='bareback').available,true);assert.equal(common.G.mastery.ridingModeStatus().options.find(o=>o.id==='wild').available,false);
 for(const c of [epic,fantasy])assert(c.G.mastery.ridingModeStatus().options.every(o=>o.available));
 assert.equal(fantasy.G.mastery.ridingModeStatus().max,5);assert.equal(epic.G.mastery.ridingModeStatus().max,10);
});
check('Bareback retains rider and bridle, persists, and does not remove owned equipment',()=>{
 const c=client({horses:[{id:1,breed:'epic',gear:{saddle:77},tack:'#884422'}]});assert.equal(c.G.mastery.setBareback(true),true);
 assert.equal(c.data().horses[0].bareback,true);assert.equal(c.G.mastery.ridingModeStatus().mode,'bareback');assert.equal(c.player.rider.g.visible,true);assert.equal(c.saddle.visible,false);assert.equal(c.bridle.visible,true);assert.equal(c.nativeModes.at(-1),'bareback');
 assert.deepEqual(c.data().horses[0].gear,{saddle:77});assert.equal(c.data().horses[0].tack,'#884422');const r=c.reload();r.G.run('boot');assert.equal(r.G.mastery.ridingModeStatus().mode,'bareback');
});
check('Wild hides rider and tack; keyboard toggle returns to the previous bareback preference',()=>{
 const c=client();c.G.mastery.setBareback(true);assert.equal(c.G.mastery.selectRidingMode('wild'),true);
 assert.equal(c.player.rider.g.visible,false);assert.equal(c.saddle.visible,false);assert.equal(c.bridle.visible,false);assert.equal(c.nativeModes.at(-1),'wild');assert.equal(c.data().horses[0].bareback,true);
 assert.equal(c.G.mastery.toggleWild(),true);assert.equal(c.G.mastery.ridingModeStatus().mode,'bareback');assert.equal(c.data().wildMode,false);
 assert.equal(c.G.mastery.selectRidingMode('saddled'),true);assert.equal(c.data().horses[0].bareback,false);assert.equal(c.saddle.visible,true);
});
check('Locked modes, unknown selections, on-foot entry, VR and active courses reject without mutation',()=>{
 const locked=client({mastery:{epic:8}}),before=locked.data();assert.equal(locked.G.mastery.selectRidingMode('wild'),false);assert.equal(locked.G.mastery.setBareback(true),false);assert.equal(locked.G.mastery.selectRidingMode('unknown'),false);assert.deepEqual(locked.data(),before);
 const c=client();c.player.onFoot=true;assert.equal(c.G.mastery.selectRidingMode('wild'),false);assert.match(c.toasts.at(-1),/Mount your horse/);c.player.onFoot=false;
 c.G.renderer.xr.isPresenting=true;assert.equal(c.G.mastery.selectRidingMode('wild'),false);c.G.renderer.xr.isPresenting=false;
 c.setCourse({});assert.equal(c.G.mastery.selectRidingMode('wild'),false);assert.equal(c.data().wildMode,false);assert.equal(c.player.rider.g.visible,true);
});
check('Storage failure never changes visible mode, records a quest or reports success',()=>{
 const c=client({}, {failWrite:true});let quests=0;c.G.on('daily',()=>quests++);const before=c.data();assert.equal(c.G.mastery.selectRidingMode('wild'),false);assert.equal(c.G.mastery.setBareback(true),false);
 assert.deepEqual(c.data(),before);assert.equal(c.player.rider.g.visible,true);assert.equal(c.saddle.visible,true);assert.equal(quests,0);assert.equal(c.changes(),0);
 c.flags.failWrite=false;assert.equal(c.G.mastery.selectRidingMode('wild'),true);assert.equal(quests,1);
});
check('Switching to an ineligible horse clears global wild without altering the other horse preference',()=>{
 const c=client({horses:[{id:1,breed:'epic',bareback:true},{id:2,breed:'bay'}]});c.G.run('boot');c.G.mastery.selectRidingMode('wild');c.switchHorse(1);
 assert.equal(c.G.mastery.isWild(),false);assert.equal(c.data().wildMode,false);assert.equal(c.G.mastery.ridingModeStatus().mode,'saddled');assert.equal(c.player.rider.g.visible,true);assert.equal(c.data().horses[0].bareback,true);
});
check('Boot and asynchronous tack attachment honor eligible saved wild, but clear stale locked modes',()=>{
 const c=client({wildMode:true,horses:[{id:1,breed:'epic',bareback:true}]});c.G.run('attachTack');assert.equal(c.G.mastery.isWild(),true);c.G.run('boot');assert.equal(c.G.mastery.isWild(),true);assert.equal(c.player.rider.g.visible,false);
 const locked=client({wildMode:true,mastery:{epic:3},horses:[{id:1,breed:'epic',bareback:true}]});locked.G.run('boot');assert.equal(locked.G.mastery.isWild(),false);assert.equal(locked.data().wildMode,false);assert.equal(locked.data().horses[0].bareback,false);
});
check('Native lie-down and its return blend block mode exit and event entry until the horse stands',()=>{
 const c=client();c.G.mastery.selectRidingMode('wild');c.rig.heroMotion.state={action:{type:'liedown'},transitioning:true};
 assert.equal(c.G.mastery.selectRidingMode('saddled'),false);assert.equal(c.G.mastery.setBareback(true),false);assert.equal(c.G.run('courseGate'),true);assert.match(c.G.mastery.ridingModeStatus().options[0].reason,/get back up/);
 c.rig.heroMotion.state={action:null,transitioning:true};assert.equal(c.G.mastery.toggleWild(),false);assert.equal(c.G.run('courseGate'),true);
 c.rig.heroMotion.state={action:null,transitioning:false};assert.equal(c.G.run('courseGate'),false);assert.equal(c.G.mastery.toggleWild(),true);
});
check('Ordinary gait transitions do not block mode exit',()=>{const c=client();c.G.mastery.selectRidingMode('wild');c.rig.heroMotion.state={action:null,transitioning:true};assert.equal(c.G.mastery.toggleWild(),true);});
check('Course start restores the prior riding style; failed persistence cancels entry',()=>{
 const c=client();c.G.mastery.setBareback(true);c.G.mastery.selectRidingMode('wild');c.setCourse({});c.G.run('courseStart',{});assert.equal(c.G.mastery.ridingModeStatus().mode,'bareback');assert.equal(c.data().wildMode,false);assert.match(c.toasts.at(-1),/bareback for the course/);
 const failed=client();failed.G.mastery.selectRidingMode('wild');failed.flags.failWrite=true;failed.setCourse({});failed.G.run('courseStart',{});assert.equal(failed.canceled(),1);assert.equal(failed.G.mastery.isWild(),true);
});
check('Remote mode is applied on every packet, including cleared flags and repeated styles',()=>{
 const c=client(),r={rider:{g:{visible:true}},rig:{saddle:{visible:true}}};c.G.run('remote',{wm:1,bb:1},r);c.G.run('remote',{wm:1,bb:1},r);c.G.run('remote',{},r);
 assert.equal(c.remoteModes.length,3);assert.deepEqual(c.remoteModes.at(-1).m,{bareback:false,wild:false});assert.equal(r.rider.g.visible,true);assert.equal(r.rig.saddle.visible,true);
 const p={};c.G.mastery.setBareback(true);c.G.mastery.selectRidingMode('wild');c.G.run('netPos',p,c.data(),c.data().horses[0]);assert.equal(p.bb,1);assert.equal(p.wm,1);
});
check('On-foot production guard blocks wild dismount; parked build forwards the saved bareback preference',()=>{
 const source=fs.readFileSync(new URL('../assets/features/on-foot.js',import.meta.url),'utf8'),why=source.slice(source.indexOf(' function why(){'),source.indexOf(' function dismount(){'));
 const c=client(),ST={on:false};c.player.rider.sk={};c.G.mastery.selectRidingMode('wild');const guard=Function('ST','G','player','document',why+';return why;')(ST,c.G,c.player,document);assert.match(guard(),/Leave Wild Mode/);
 c.G.mastery.selectRidingMode('bareback');assert.equal(guard(),'');
 const build=source.slice(source.indexOf(' function buildHorse('),source.indexOf(" G.on('ridingModeChanged'"));let options;
 const H={myHorses:[{id:1,breed:'epic',bareback:true,colors:{}}],rideIdx:()=>0,makeHorse:()=>({group:new THREE.Group()}),dressWithRig:(e,p,col,opts)=>{options=opts;}};
 Function('H','RS','player','Wd','scene',build+';return buildHorse;')(H,{},c.player,{groundH:()=>0},new THREE.Scene())(0,0,0);assert.equal(options.bareback,true);assert.equal(options.saddle,true);
});
console.log(`${checks.length} riding-mode checks passed. No real saves or WebSocket connections.`);
