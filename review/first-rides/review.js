import {flatRaceSegmentClear} from '../../assets/flat-race-guidance.mjs?v=flat-race-guide-1';
import {rushRecoverySegmentClear} from '../../assets/features/course-guide.js?v=flat-race-guide-1';
const $=id=>document.getElementById(id),frame=$('game'),SAVE='starRanchFable_v1',MARK='first-rides-qa-owned',MARK_VALUE='disposable genuine first-rides review';
const PREFIXES=['adventure:','journey:','rush:','herd:'],BUTTON_IDS=new Set(['rescueReassure','rescueRetrySave','adventureCancel','rushChoose','rushQuickStart','chSave']);
const KEYS={forward:'KeyW',left:'KeyA',right:'KeyD',back:'KeyS',interact:'KeyE'},held={},proxyNodes=new Map(),errors=[];
let networkStopped=false;const scenery={},roundupTrace=[],rushTrace=[];let tracedRun=null,lastTraceElapsed=-1;
let rushCourse=null,lastRushTraceElapsed=-1,lastRushTraceKey='',jumpTimer=null,eventCourse=null,eventCourseHorse=null;
const eventTrace=[];let eventTracedCourse=null,eventTracedElapsed=-Infinity,eventTracedKey='';
const h1Trace=[];let h1Course=null,h1Horse=null,h1LastTraceKey='',h1LastTraceAt=-Infinity;
const ridingDistance={frames:0,travel:0,ground:0,gallop:0,bond:0,fastStationarySeconds:0};
let w=null,G=null,ready=false,loading=false,manualTimer=null,driver=null,driverSteps=0,driverStatus='off',driverTarget=null,lastClick=null,storageOwned=false;
function guard(){if(location.protocol!=='http:'||!['localhost','127.0.0.1'].includes(location.hostname)||location.port!=='18800')throw Error('Use only http://127.0.0.1:18800/review/first-rides/.');}
function readSave(){return JSON.parse(localStorage.getItem(SAVE)||'null');}
function claimOrigin(){
 guard();if(localStorage.length&&localStorage.getItem(MARK)!==MARK_VALUE)throw Error('Refusing unmarked storage. Nothing was deleted; use a fresh profile on port 18800.');
 const s=readSave();if(s?.club||s?.clubPriv||s?.ridingClub)throw Error('Refusing a save with a club identity. Use a fresh profile; this save is unchanged.');
 // The only fixture write: production creates and owns every ranch-save field.
 localStorage.setItem(MARK,MARK_VALUE);storageOwned=localStorage.getItem(MARK)===MARK_VALUE;if(!storageOwned)throw Error('The disposable origin marker could not be verified.');
}
function status(s){$('status').textContent=s;}
function fail(e){errors.push(String(e?.stack||e));if(errors.length>20)errors.shift();status('FAILED: '+String(e?.message||e));report();}
async function waitFor(fn,label){for(let i=0;i<2400;i++){if(fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out waiting for '+label);}
function visible(button){return !!button&&button.tagName==='BUTTON'&&!button.hidden&&button.getClientRects().length>0&&!['hidden','collapse'].includes(button.ownerDocument.defaultView.getComputedStyle(button).visibility);}
function disabled(button){return !!button.disabled||button.matches(':disabled')||button.getAttribute('aria-disabled')==='true';}
function allowed(button){return BUTTON_IDS.has(button.id)||PREFIXES.some(prefix=>(button.dataset.fx||'').startsWith(prefix));}
function productionButtons(){return w?[...w.document.querySelectorAll('button')].filter(b=>allowed(b)&&visible(b)):[];}
function descriptor(b){return {key:BUTTON_IDS.has(b.id)?'id:'+b.id:'fx:'+b.dataset.fx,id:BUTTON_IDS.has(b.id)?b.id:null,action:b.dataset.fx||null,label:b.textContent.trim(),disabled:disabled(b)};}
function renderProxies(){
 const rows=productionButtons().map(descriptor),seen=new Set();for(const row of rows){if(seen.has(row.key))continue;seen.add(row.key);let button=proxyNodes.get(row.key);if(!button){button=document.createElement('button');button.type='button';button.dataset.proxy=row.key;button.onclick=()=>{const actual=productionButtons().find(b=>descriptor(b).key===row.key);if(networkStopped||!actual||disabled(actual)){lastClick={ok:false,reason:'That visible control is unavailable or disabled.'};report();return;}lastClick={ok:true,label:actual.textContent.trim()};actual.click();report();};proxyNodes.set(row.key,button);$('proxies').appendChild(button);}button.textContent=row.label;button.disabled=networkStopped||row.disabled;}
 for(const [key,button]of proxyNodes)if(!seen.has(key)){button.remove();proxyNodes.delete(key);}return rows;
}
function key(code,on){if(!w||held[code]===on)return;held[code]=on;w.document.dispatchEvent(new w.KeyboardEvent(on?'keydown':'keyup',{code,key:{KeyW:'w',KeyA:'a',KeyD:'d',KeyS:'s',KeyE:'e',Space:' '}[code],bubbles:true,cancelable:true}));}
function release(){if(jumpTimer)clearTimeout(jumpTimer);jumpTimer=null;for(const code of Object.keys(held))key(code,false);G?.riding?.releaseAll();}
function pulseJump(){key('Space',true);if(jumpTimer)clearTimeout(jumpTimer);jumpTimer=setTimeout(()=>{jumpTimer=null;key('Space',false);},120);}
function manualJump(){if(networkStopped||!ready||blocked()){status('Close the current game dialog before asking for a jump.');return;}if(!manualTimer||!held.KeyW)stop();w.document.activeElement?.blur?.();pulseJump();status('Pressed Space through ordinary input. Production decides whether the horse can jump.');recordRush('manual Space');report();}
function manualRideJump(){if(!ready||blocked()||networkStopped)return;const seconds=Number($('duration').value);if(![1,2].includes(seconds)){status('Choose at least 1 second for the bounded W then Space input.');return;}manual('KeyW');const timer=manualTimer;setTimeout(()=>{if(manualTimer===timer&&held.KeyW&&!blocked()&&!networkStopped){pulseJump();status('Pressed Space after 0.35 seconds of bounded ordinary W input.');report();}},350);}
function blocked(){return !ready||G.input?.blocked?.()||G.photoPause||w.document.hidden||w.document.body.classList.contains('freecam');}
function stop(){if(manualTimer)clearTimeout(manualTimer);if(driver)clearInterval(driver);manualTimer=null;driver=null;driverStatus='off';release();}
function manual(code){if(networkStopped){status('This playtest stopped after an unexpected network connection.');return;}if(!ready||blocked()){status('Finish or close the current game dialog before riding.');return;}stop();w.document.activeElement?.blur?.();const seconds=Number($('duration').value);if(![.1,.25,.5,1,2].includes(seconds))return;key(code,true);status('Holding '+code.replace('Key','')+' for '+seconds+' seconds through normal input.');manualTimer=setTimeout(()=>{manualTimer=null;release();status('Key released.');report();},seconds*1000);}
function startDriver(){
 if(networkStopped){status('This playtest stopped after an unexpected network connection.');return;}if(!ready||!G.rescueRide?.snapshot().active){status('Start Clover’s rescue through a visible production button first.');return;}
 stop();w.document.activeElement?.blur?.();driverStatus='running';status('Following the active rescue target with ordinary riding keys in real wall time.');
 driver=setInterval(()=>{
  try{
   const a=G.rescueRide.snapshot().active,p=G.horse.player;
   if(!a){stop();status('Rescue route ended. Inspect the production result and saved records.');report();return;}
   if(blocked()||a.savePending){release();driverStatus=a.savePending?'paused for save confirmation':'paused by game UI';return;}
   if(a.stage==='calm'&&a.interaction?.eligible){release();driverStatus='waiting for your Reassure Clover click';status('Clover is ready. Click the real Reassure Clover button; the route driver will resume afterward.');return;}
   const target=a.horse.waiting?{x:a.horse.x,z:a.horse.z}:a.target;if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z)){release();driverStatus='waiting for published target';return;}
   const distance=Math.hypot(target.x-p.pos.x,target.z-p.pos.z),angle=Math.atan2(target.x-p.pos.x,target.z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
   const halt=a.stage==='calm'?distance<4:a.stage==='escort'?distance<3:distance<1.5;
   const gait=a.stage==='find'&&distance>14?'canter':a.stage==='escort'&&distance>12&&a.horse.distance<14?'trot':'walk';G.riding.selectGait(gait);
   key('KeyA',!halt&&delta>.04);key('KeyD',!halt&&delta<-.04);key('KeyW',!halt&&Math.abs(delta)<.7);key('KeyS',(halt||Math.abs(delta)>1)&&p.speed>1.2);
   driverSteps++;driverStatus='running';driverTarget={x:target.x,z:target.z,distance,stage:a.stage,gait};
  }catch(e){stop();fail(e);}
 },100);
}
function readRush(){
 const current=G?.course?.get?.(),a=G?.ranchRush?.snapshot?.().active||null;
 if(current?.rush&&current!==rushCourse){rushCourse=current;rushTrace.length=0;lastRushTraceElapsed=-1;lastRushTraceKey='';}
 const c=current?.rush?current:rushCourse;if(!c)return null;
 const j=c.jumps?.[c.idx],p=G.horse.player,rot=j?.rotY||0,sn=Math.sin(rot),cs=Math.cos(rot);
 const dx=j?p.pos.x-j.x:0,dz=j?p.pos.z-j.z:0;
 const recovery=current===c?G.courseGuide?.recovery?.()||null:null;
 return {id:c.ev?.id,name:a?.name||c.ev?.name,active:current===c&&!!a,elapsed:c.t,countdown:c.cd,index:c.idx,total:c.jumps?.length||0,
  target:j?{kind:j.kind,label:j.fenceLabel||j.kind,x:j.x,z:j.z,heading:rot,distance:Math.hypot(dx,dz),across:dx*sn+dz*cs,lateral:dx*cs-dz*sn}:null,
  cue:current===c?G.courseGuide?.jumpCue?.()||null:null,recovery,
  player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,height:p.y,jumpAge:G.horse.RIG().heroJumpAge??null},
  grades:[...(c.ce?.grades||[])],lastGrade:c.ce?.lastGrade||null,refusals:c.ce?.refusals||0,lastJumpTiming:c.ce?.lastJumpTiming?{...c.ce.lastJumpTiming}:null};
}
function recordRush(event=null){
 const row=readRush();if(!row)return;
 const traceKey=JSON.stringify([row.active,row.index,row.cue,row.recovery?.phase,row.grades.length,row.refusals,row.player.jumpAge!=null]);
 if(event||traceKey!==lastRushTraceKey||row.elapsed-lastRushTraceElapsed>=.5){
  rushTrace.push({...row,event,assistance:$('jumpAssist').value==='on',driverStatus});
  if(rushTrace.length>300)rushTrace.shift();lastRushTraceElapsed=row.elapsed;lastRushTraceKey=traceKey;
 }
}
function haltRush(reason){stop();driverStatus=reason;status(reason+' All fixture keys released; inspect the real course and use manual controls or resume.');recordRush('driver stopped');report();}
function startRushDriver(){
 const a=G?.ranchRush?.snapshot?.().active,c=G?.course?.get?.();
 if(networkStopped||!ready||!storageOwned||!a||!c?.rush||c.ev?.id!==a.id){status('Start a Ranch Rush through a visible production button first.');return;}
 stop();w.document.activeElement?.blur?.();const course=c,runId=a.id;
 let refusals=c.ce?.refusals||0,jumpIndex=-1,jumpRequestedAt=0,jumpSeen=false;
 let lastMovedAt=Date.now(),lastPosition={x:G.horse.player.pos.x,z:G.horse.player.pos.z};
 driverStatus='running '+a.name;status('Riding the actual '+a.name+' with ordinary keys and the visible production jump cue. Refusals stop input for inspection.');recordRush('driver started');
 driver=setInterval(()=>{try{
  const active=G.ranchRush.snapshot().active,current=G.course.get(),p=G.horse.player;
  if(!active||!current){recordRush('course ended');stop();driverStatus='course ended';status('Ranch Rush ended. Inspect the actual grades and production result.');report();return;}
  if(current!==course||!current.rush||active.id!==runId){haltRush('Stopped: the active course changed');return;}
  recordRush();
  if(blocked()){haltRush('Stopped: the game is blocked by UI or background state');return;}
  if(!active.started){release();lastMovedAt=Date.now();driverStatus='waiting for production countdown';return;}
  if(p.flying||G.onFoot?.on){haltRush('Stopped: ordinary mounted ground riding is unavailable');return;}
  const newRefusals=current.ce?.refusals||0;
  if(newRefusals>refusals){refusals=newRefusals;haltRush('Stopped after an actual log refusal');return;}
  const j=current.jumps[current.idx];
  if(!j||!['gate','fence'].includes(j.kind)||![j.x,j.z,j.rotY||0,p.pos.x,p.pos.z,p.heading,p.speed].every(Number.isFinite)){haltRush('Stopped: the course target is unavailable or unexpected');return;}
  if(jumpIndex!==current.idx){jumpIndex=current.idx;jumpRequestedAt=0;jumpSeen=false;lastMovedAt=Date.now();}
  if(jumpRequestedAt&&G.horse.RIG().heroJumpAge!=null)jumpSeen=true;
  if(jumpRequestedAt&&!jumpSeen&&Date.now()-jumpRequestedAt>800){haltRush('Stopped: Space was requested but no native jump began');return;}
  const sn=Math.sin(j.rotY||0),cs=Math.cos(j.rotY||0),dx=p.pos.x-j.x,dz=p.pos.z-j.z,across=dx*sn+dz*cs,lateral=dx*cs-dz*sn;
  const recovery=G.courseGuide?.recovery?.()||null;
  let x=j.x+sn*2,z=j.z+cs*2;
  if(recovery){
   if(!recovery.target||![recovery.target.x,recovery.target.z].every(Number.isFinite)){haltRush('Stopped: production recovery has no clear route');return;}
   x=recovery.target.x;z=recovery.target.z;
  }else if(j.kind==='fence'&&across< -8&&Math.abs(lateral)>1){x=j.x-sn*8;z=j.z-cs*8;}
  const distance=Math.hypot(x-p.pos.x,z-p.pos.z),angle=recovery?.phase==='lineup'?(j.rotY||0):Math.atan2(x-p.pos.x,z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
  const gait=recovery?'walk':distance>18&&Math.abs(delta)<.2?'canter':'trot';G.riding.selectGait(gait);
  key('KeyA',delta>.04);key('KeyD',delta<-.04);key('KeyW',recovery?.phase!=='lineup'&&Math.abs(delta)<.65);key('KeyS',Math.abs(delta)>1&&p.speed>1.2);
  const cue=G.courseGuide?.jumpCue?.()||null;
  if(!recovery&&j.kind==='fence'&&$('jumpAssist').value==='on'&&!jumpRequestedAt&&['perfect','good'].includes(cue)&&G.horse.RIG().heroJumpAge==null&&p.y<.05){pulseJump();jumpRequestedAt=Date.now();recordRush('Space from '+cue+' cue');}
  if(!held.KeyW||Math.hypot(p.pos.x-lastPosition.x,p.pos.z-lastPosition.z)>.25){lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};}
  if(held.KeyW&&Date.now()-lastMovedAt>5000&&distance>1){haltRush('Stopped: forward input made no physical progress');return;}
  driverSteps++;driverStatus='running '+active.name+(recovery?' · '+recovery.phase:'');
  driverTarget={x,z,distance,checkpoint:current.idx+1,total:current.jumps.length,kind:j.kind,gait,cue,recovery,jumpRequested:!!jumpRequestedAt};
 }catch(e){stop();fail(e);}},100);
}
// This bounded first attempt follows the published formal fence target. It does
// not invent a refusal recovery route or call the guide's mutable plan() API.
function h1CourseSupported(c){
 return !!(c&&!c.done&&c.ev?.id==='h1'&&!c.race&&!c.ev.race&&!c.rush&&!c.ev.rush&&!c.dressage&&!c.ev.dressage&&!c.xc&&!c.ev.xc&&!c.ev.kind&&c.ce?.kind==='jump'&&
  Number.isInteger(c.idx)&&c.idx>=0&&c.idx<5&&Array.isArray(c.jumps)&&c.jumps.length===5&&c.jumps.every(j=>j?.kind==='fence'&&[j.x,j.z,j.rotY].every(Number.isFinite)));
}
function readH1Course(){
 const current=G?.course?.get?.();
 if(h1CourseSupported(current)&&current!==h1Course){h1Course=current;const h=G.horse.ridden?.();h1Horse=h?{id:h.id,name:h.name,breed:h.breed}:null;h1Trace.length=0;h1LastTraceKey='';h1LastTraceAt=-Infinity;}
 const c=h1Course;if(!c)return null;const active=current===c,j=c.jumps?.[c.idx],p=G.horse.player,rig=G.horse.RIG(),target=active?G.courseGuide?.target?.():null;
 const dx=j?p.pos.x-j.x:0,dz=j?p.pos.z-j.z:0,sn=Math.sin(j?.rotY||0),cs=Math.cos(j?.rotY||0);
 return {id:c.ev?.id,name:c.ev?.name,active,started:!!c.started,countdown:c.cd,elapsed:c.t,index:c.idx,total:c.jumps?.length||0,
  difficulty:c.ce?.diff?.k||null,timeAllowed:c.ce?.timeAllowed??null,lap:c.ce?.lap||1,laps:c.ce?.laps||1,horse:h1Horse,
  target:j?{x:j.x,z:j.z,heading:j.rotY,kind:j.kind,label:j.fenceLabel||'fence',distance:Math.hypot(dx,dz),across:dx*sn+dz*cs,lateral:dx*cs-dz*sn}:null,
  publishedTarget:target?{x:target[0],z:target[1]}:null,formalApproach:active?G.courseGuide?.formalApproach?.()||null:null,cue:active?G.courseGuide?.jumpCue?.()||null:null,
  player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,height:p.y,jumpAge:rig.heroJumpAge??null},
  grades:[...(c.ce?.grades||[])],lastGrade:c.ce?.lastGrade||null,refusals:c.ce?.refusals||0,faults:c.faults||0,
  lastJumpTiming:c.ce?.lastJumpTiming?{...c.ce.lastJumpTiming}:null,ribbons:c.rb?.rib??null,accuracy:c.rb?.acc??c.ce?.acc??null};
}
function recordH1(event=null){
 const row=readH1Course();if(!row)return;
 const signature=JSON.stringify([row.active,row.index,row.cue,row.refusals,row.grades.length,row.player.jumpAge!=null,driverTarget?.routeClear,driverTarget?.phase]);
 if(event||signature!==h1LastTraceKey||Date.now()-h1LastTraceAt>=500){h1Trace.push({...row,event,assistance:$('jumpAssist').value==='on',driverStatus});if(h1Trace.length>300)h1Trace.shift();h1LastTraceKey=signature;h1LastTraceAt=Date.now();}
}
function haltH1(reason){stop();driverStatus=reason;status(reason+' Fixture keys released. Inspect the actual course; formal refusals need a manual reapproach.');recordH1('driver stopped');report();}
function h1DirectRouteClear(c,j,from,to,skipCurrent=true){
 // Two existing production validators: registered scenery/positive contacts,
 // then other course rails. Only this intended jump is exempt from the rail test.
 return flatRaceSegmentClear(from,to,{world:G.world})&&rushRecoverySegmentClear(from,to,{world:G.world,course:c,skip:skipCurrent?j:null});
}
function h1FormalMatches(guide,c,j){
 return !!guide&&guide.courseId===c.ev.id&&guide.index===c.idx&&guide.lap===(c.ce.lap??1)&&Number.isInteger(guide.lap)&&guide.lap>0&&guide.fence?.kind==='fence'&&guide.fence.x===j.x&&guide.fence.z===j.z&&guide.fence.rotY===j.rotY&&Number.isInteger(guide.revision)&&guide.revision>0;
}
function startH1Driver(){
 const c=G?.course?.get?.(),h=G?.horse?.ridden?.();
 if(networkStopped||!ready||!storageOwned||h?.id==null||!h1CourseSupported(c)){status('Enter Cottonwood Welcome Jump through its actual Events card first.');return;}
 if(blocked()&&c.started){status('Close the current game dialog before driving the active round.');return;}
 stop();w.document.activeElement?.blur?.();const course=c,event=c.ev,horseId=h.id,breed=h.breed,usesFormal=typeof G.courseGuide?.formalApproach==='function';
 let lastIndex=c.idx,refusals=c.ce.refusals||0,jumpRequestedAt=0,jumpSeen=false,guideWaitingAt=null,landing=null,routeKey='';
 let lastMovedAt=Date.now(),lastPosition={x:G.horse.player.pos.x,z:G.horse.player.pos.z},routeCheckedAt=-Infinity,startedAt=null;
 readH1Course();driverStatus='waiting for real Ready/countdown';status('First attempt only: click the production Ready button if its card is open. Ordinary keys follow the real target and jump cue.');recordH1('driver started');
 driver=setInterval(()=>{try{
  const current=G.course.get(),p=G.horse.player,rig=G.horse.RIG(),mount=G.horse.ridden?.();
  if(!current){haltH1('Welcome Jump ended. Inspect the production result');return;}
  if(current!==course||current.ev!==event||!h1CourseSupported(current)){haltH1('Stopped: the formal course changed');return;}
  if(p.flying||p.onFoot||G.onFoot?.on||G.worldPkg?.vehicle?.()||!rig?.ready||rig.loadingBreed||!rig.heroMotion||rig.attachedTo!==p.mesh||mount?.id!==horseId||mount.breed!==breed){haltH1('Stopped: the original native mounted horse is unavailable');return;}
  if(![current.cd,current.t,p.pos.x,p.pos.z,p.heading,p.speed,p.y].every(Number.isFinite)||rig.heroJumpAge!=null&&!Number.isFinite(rig.heroJumpAge)){haltH1('Stopped: the actual course or rider state is invalid');return;}
  recordH1();
  if(!current.started||current.cd>0){release();lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};driverStatus='waiting for real Ready/countdown';return;}
  if(blocked()){haltH1('Stopped: the round is blocked by UI or background state');return;}
  startedAt??=Date.now();if(Date.now()-startedAt>180000){haltH1('Stopped: the bounded three-minute input run expired');return;}
  const nextRefusals=current.ce.refusals||0;if(nextRefusals>refusals){refusals=nextRefusals;haltH1('Stopped after the first actual formal refusal');return;}
  const j=current.jumps[current.idx];
  if(lastIndex!==current.idx){
   if(current.idx!==lastIndex+1||landing){haltH1('Stopped: the formal fence sequence changed unexpectedly');return;}
   // A fence is scored at its plane while the native jump is still in flight.
   // Keep the cleared fence's alignment until real landing; a ground corridor
   // to the next fence would otherwise test the airborne rider too early.
   if(rig.heroJumpAge!=null||p.y>=.05)landing={index:lastIndex,nextIndex:current.idx,heading:current.jumps[lastIndex].rotY,beganAt:Date.now()};
   lastIndex=current.idx;jumpRequestedAt=0;jumpSeen=false;routeCheckedAt=-Infinity;lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};
  }
  if(landing){
   if(Date.now()-landing.beganAt>2500){haltH1('Stopped: the scored native jump did not land within 2.5 seconds');return;}
   if(rig.heroJumpAge!=null||p.y>=.05){
    const delta=Math.atan2(Math.sin(landing.heading-p.heading),Math.cos(landing.heading-p.heading));
    G.riding.selectGait('trot');key('KeyA',delta>.04);key('KeyD',delta<-.04);key('KeyW',true);key('KeyS',false);
    if(Math.hypot(p.pos.x-lastPosition.x,p.pos.z-lastPosition.z)>.25){lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};}
    if(held.KeyW&&Date.now()-lastMovedAt>5000){haltH1('Stopped: forward input made no physical progress for five seconds');return;}
    driverSteps++;driverStatus='waiting for scored jump to land';driverTarget={phase:'landing',checkpoint:landing.index+1,nextCheckpoint:landing.nextIndex+1,heading:landing.heading,gait:'trot'};recordH1();return;
   }
   landing=null;routeCheckedAt=-Infinity;lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};recordH1('prior scored jump landed');
  }
  if(jumpRequestedAt&&rig.heroJumpAge!=null)jumpSeen=true;
  if(jumpRequestedAt&&!jumpSeen&&Date.now()-jumpRequestedAt>800){haltH1('Stopped: Space was requested but no native jump began');return;}
  const sn=Math.sin(j.rotY),cs=Math.cos(j.rotY),dx=p.pos.x-j.x,dz=p.pos.z-j.z,across=dx*sn+dz*cs,lateral=dx*cs-dz*sn;
  const published=G.courseGuide?.target?.(),cue=G.courseGuide?.jumpCue?.()||'',formal=usesFormal?G.courseGuide.formalApproach?.():null;
  if(G.courseGuide?.isEnabled?.()!==true||G.courseGuide?.recovery?.()){haltH1('Stopped: ordinary formal guidance is unavailable');return;}
  // Production hides its ground guide during a genuine native jump. Continue
  // only the already-requested flight, never invent a route or another Space.
  if(usesFormal&&jumpSeen&&(rig.heroJumpAge!=null||p.y>=.05)){
   if(Date.now()-jumpRequestedAt>2500){haltH1('Stopped: the requested native jump did not finish within 2.5 seconds');return;}
   const delta=Math.atan2(Math.sin(j.rotY-p.heading),Math.cos(j.rotY-p.heading));
   G.riding.selectGait('trot');key('KeyA',delta>.04);key('KeyD',delta<-.04);key('KeyW',true);key('KeyS',false);
   driverSteps++;driverStatus='waiting for actual native jump crossing';driverTarget={phase:'jumping',checkpoint:current.idx+1,total:5,heading:j.rotY,gait:'trot'};recordH1();return;
  }
  // The guide runs before the crossing judge. Changed idx/lap/rail metadata or
  // target can lag by one frame: release input until the real publication agrees.
  const matching=!usesFormal||h1FormalMatches(formal,current,j);
  if(usesFormal&&matching&&['blocked','paused'].includes(formal.phase)){haltH1('Stopped: the production formal approach is '+formal.phase);return;}
  const phase=usesFormal?formal?.phase:'run-in',centre=phase==='run-in'||phase==='lineup';
  const validTarget=Array.isArray(published)&&published.length===2&&[published[0],published[1]].every(Number.isFinite)&&(!usesFormal||formal?.target&&[formal.target.x,formal.target.z].every(Number.isFinite)&&Math.hypot(published[0]-formal.target.x,published[1]-formal.target.z)<.001);
  const validRoute=!usesFormal||['approach','around','lineup','run-in'].includes(phase)&&Array.isArray(formal.waypoints)&&Array.from(formal.waypoints).every(q=>q&&[q.x,q.z].every(Number.isFinite))&&(!['approach','around'].includes(phase)||formal.waypoints.length>0&&formal.waypoints[0].x===formal.target?.x&&formal.waypoints[0].z===formal.target?.z);
  if(!matching||!validTarget||!validRoute||centre&&Math.hypot(published[0]-j.x,published[1]-j.z)>.001){
   release();guideWaitingAt??=Date.now();lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};driverTarget=null;driverStatus='waiting for current published fence target';
   if(Date.now()-guideWaitingAt>(usesFormal?2000:1000))haltH1('Stopped: the current fence target was not published');return;
  }
  guideWaitingAt=null;
  if(across>.05&&(!usesFormal||phase==='run-in')){haltH1('Stopped: the current fence is behind the rider without a scored crossing');return;}
  if(!['','early','good','perfect','late','lineup'].includes(cue)){haltH1('Stopped: the published jump cue is invalid');return;}
  if((!usesFormal||phase==='run-in')&&(cue==='lineup'||cue==='late'&&!jumpRequestedAt&&$('jumpAssist').value==='on')){haltH1('Stopped: the published cue requires a manual reapproach');return;}
  const x=published[0],z=published[1],distance=Math.hypot(x-p.pos.x,z-p.pos.z),nextRouteKey=JSON.stringify([current.idx,current.ce.lap??1,phase,x,z,j.x,j.z,j.rotY]);
  if(nextRouteKey!==routeKey||Date.now()-routeCheckedAt>=350){
   routeKey=nextRouteKey;routeCheckedAt=Date.now();if(!h1DirectRouteClear(current,j,{x:p.pos.x,z:p.pos.z},{x,z},centre)){haltH1('Stopped: the direct published approach is blocked');return;}
  }
  const angle=phase==='lineup'||distance<.4?j.rotY:Math.atan2(x-p.pos.x,z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading)),gait=phase==='run-in'?'trot':'walk';
  G.riding.selectGait(gait);key('KeyA',delta>.04);key('KeyD',delta<-.04);key('KeyW',phase!=='lineup'&&Math.abs(delta)<.65);key('KeyS',phase==='lineup'?p.speed>.4:Math.abs(delta)>1&&p.speed>1.2);
  if(phase==='run-in'&&$('jumpAssist').value==='on'&&!jumpRequestedAt&&['perfect','good'].includes(cue)&&rig.heroJumpAge==null&&p.y<.05){pulseJump();jumpRequestedAt=Date.now();recordH1('Space from current '+cue+' cue');}
  if(jumpSeen&&rig.heroJumpAge==null&&p.y<.05){haltH1('Stopped: the native jump ended before this fence was scored');return;}
  if(!held.KeyW||Math.hypot(p.pos.x-lastPosition.x,p.pos.z-lastPosition.z)>.25){lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};}
  if(held.KeyW&&Date.now()-lastMovedAt>5000){haltH1('Stopped: forward input made no physical progress for five seconds');return;}
  driverSteps++;driverStatus='running Welcome Jump first attempt';driverTarget={x,z,distance,checkpoint:current.idx+1,total:5,kind:'fence',gait,phase,cue,across,lateral,routeClear:true,formalRevision:formal?.revision??null,jumpRequested:!!jumpRequestedAt};
 }catch(e){stop();fail(e);}},100);
}

// Only ordinary flat gate races belong to this driver. It never accepts a
// labelled race that actually contains jumping/dressage/custom obstacles.
function flatRaceCourse(c){
 const ev=c?.ev;
 return !!(c&&c.race===true&&ev?.race===true&&typeof ev.id==='string'&&ev.id&&
  !c.rush&&!ev.rush&&!c.dressage&&!ev.dressage&&!c.xc&&!ev.xc&&!ev.gauntlet&&!ev.kind&&
  (!ev.disc||ev.disc==='race')&&c.ce?.kind==='race'&&Array.isArray(c.jumps)&&c.jumps.length&&
  Array.from(c.jumps).every(j=>j?.kind==='gate'&&Number.isFinite(j.x)&&Number.isFinite(j.z)));
}
function readEventCourse(){
 const current=G?.course?.get?.();
 if(flatRaceCourse(current)&&current!==eventCourse){eventCourse=current;const h=G.horse.ridden?.();eventCourseHorse=h?{id:h.id,name:h.name,breed:h.breed}:null;}
 const c=eventCourse;if(!c)return null;
 const active=current===c,j=c.jumps?.[c.idx],p=G.horse.player,dlg=w.document.getElementById('dlg');
 return {id:c.ev?.id,name:c.ev?.name,active,started:!!c.started,countdown:c.cd,elapsed:c.t,index:c.idx,total:c.jumps?.length||0,
  lap:c.ce?.lap||1,laps:c.ce?.laps||1,difficulty:c.ce?.diff?.k||c.rb?.diff||null,timeAllowed:c.ce?.timeAllowed??null,
  target:j?{kind:j.kind,x:j.x,z:j.z,distance:Math.hypot(j.x-p.pos.x,j.z-p.pos.z)}:null,
  gateGuide:active?G.courseGuide?.gateGuide?.()??null:null,
  faults:c.faults||0,lineOff:c.ce?.lineOff||0,accuracy:c.ce?.acc??c.rb?.acc??null,raceAccuracy:c.ce?.raceAcc??null,horse:eventCourseHorse,
  player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,stam:Number.isFinite(p.stam)?p.stam:null,blown:!!p.blown,exhaustT:Number.isFinite(p.exhaustT)?p.exhaustT:0,landT:Number.isFinite(p.landT)?p.landT:0},
  resultText:!active&&dlg?.getClientRects().length?dlg.textContent.trim().slice(0,2500):null};
}
function recordEventTrace(){
 const c=G?.course?.get?.();if(!flatRaceCourse(c))return;
 if(c!==eventTracedCourse){eventTracedCourse=c;eventTrace.length=0;eventTracedElapsed=-Infinity;eventTracedKey='';}
 const guide=G.courseGuide?.gateGuide?.(),key=c.idx+':'+c.ce.lap+':'+guide?.phase+':'+guide?.revision;
 if(key===eventTracedKey&&c.t-eventTracedElapsed<.5)return;
 const p=G.horse.player,meter=G.horse.frameTravel;
 eventTrace.push({elapsed:c.t,index:c.idx,lap:c.ce.lap,guide:guide?{phase:guide.phase,gateIndex:guide.gateIndex,target:guide.target,waypoints:guide.waypoints}:null,player:{x:p.pos.x,z:p.pos.z,speed:p.speed},frameTravel:meter||null,driver:driverStatus});
 if(eventTrace.length>350)eventTrace.shift();eventTracedElapsed=c.t;eventTracedKey=key;
}
function haltFlatRace(reason){stop();driverStatus=reason;status(reason+' All fixture keys released; inspect the actual event before resuming.');report();}
function startFlatRaceDriver(){
 const c=G?.course?.get?.(),mounted=G?.horse?.ridden?.();
 if(networkStopped||!ready||!storageOwned||mounted?.id==null||!flatRaceCourse(c)){status('Start a flat gate race through the production Events screen first.');return;}
 if(blocked()){status('Close the event card or menu before starting the flat-race driver.');return;}
 stop();w.document.activeElement?.blur?.();const course=c,event=c.ev,eventId=c.ev.id,horseId=mounted.id;
 let lastMovedAt=Date.now(),lastPosition={x:G.horse.player.pos.x,z:G.horse.player.pos.z},lastIndex=c.idx,lastLap=c.ce.lap,guideWaitingAt=null;
 readEventCourse();driverStatus='running '+event.name;status('Following '+event.name+' gates with ordinary riding keys. Production owns the clock, crossings and result.');
 driver=setInterval(()=>{try{
  const current=G.course.get(),p=G.horse.player;
  if(!current){haltFlatRace('Flat race ended. Inspect the production result');return;}
  if(current!==course||current.ev!==event||current.ev.id!==eventId||!flatRaceCourse(current)){haltFlatRace('Stopped: the active flat race changed or contains unsupported obstacles');return;}
  if(blocked()){haltFlatRace('Stopped: the game is blocked by UI or background state');return;}
  const rig=G.horse.RIG();
  if(p.flying||p.onFoot||G.onFoot?.on||G.worldPkg?.vehicle?.()||!rig?.ready||rig.loadingBreed||G.horse.ridden?.()?.id!==horseId){haltFlatRace('Stopped: the original mounted ground-riding horse is unavailable');return;}
  if(!Number.isFinite(current.cd)||!Number.isFinite(current.t)){haltFlatRace('Stopped: the actual course clock is unavailable');return;}
  if(!current.started||current.cd>0){release();lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};driverStatus='waiting for production countdown';return;}
  const j=current.jumps[current.idx];
  if(!j||j.kind!=='gate'||![j.x,j.z,p.pos.x,p.pos.z,p.heading,p.speed].every(Number.isFinite)){haltFlatRace('Stopped: the current gate or rider position is unavailable');return;}
  // Follow only the production scenery-validated steering aim for this gate.
  const guide=G.courseGuide?.gateGuide?.();
  if(!guide||guide.gateIndex!==current.idx||guide.gate?.x!==j.x||guide.gate?.z!==j.z||!['direct','detour'].includes(guide.phase)||![guide.target?.x,guide.target?.z].every(Number.isFinite)){
   release();guideWaitingAt??=Date.now();lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};driverTarget=null;driverStatus='waiting for current production gate route';
   if(Date.now()-guideWaitingAt>2000)haltFlatRace('Stopped: a safe production gate route is unavailable');return;
  }
  guideWaitingAt=null;
  const x=guide.target.x,z=guide.target.z,distance=Math.hypot(x-p.pos.x,z-p.pos.z),angle=Math.atan2(x-p.pos.x,z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
  const gait=distance>18&&Math.abs(delta)<.2?'gallop':distance>9&&Math.abs(delta)<.45?'canter':'trot';G.riding.selectGait(gait);
  key('KeyA',delta>.04);key('KeyD',delta<-.04);key('KeyW',Math.abs(delta)<.65);key('KeyS',Math.abs(delta)>1&&p.speed>1.2);
  if(current.idx!==lastIndex||current.ce.lap!==lastLap){lastIndex=current.idx;lastLap=current.ce.lap;lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};}
  if(!held.KeyW||Math.hypot(p.pos.x-lastPosition.x,p.pos.z-lastPosition.z)>.25){lastMovedAt=Date.now();lastPosition={x:p.pos.x,z:p.pos.z};}
  if(held.KeyW&&Date.now()-lastMovedAt>5000){haltFlatRace('Stopped: forward input made no physical progress for five seconds');return;}
  driverSteps++;driverStatus='running '+event.name;driverTarget={x,z,distance,checkpoint:current.idx+1,total:current.jumps.length,lap:current.ce.lap||1,kind:'gate',gait,guidePhase:guide.phase};
 }catch(e){stop();fail(e);}},100);
}
function startRoundupDriver(){
 const initial=G?.roundup?.state();
 if(networkStopped||!ready||!initial?.active||initial.shared||!['beginner','full'].includes(initial.mode)){status('Start a solo roundup through a visible production button first.');return;}
 const runId=initial.runId,mode=initial.mode;let blockedSince=0;
 stop();w.document.activeElement?.blur?.();driverStatus='running '+mode+' roundup';status('Herding through ordinary riding keys; no horse position or pen-count injection.');
 driver=setInterval(()=>{try{
  const s=G.roundup.state(),p=G.horse.player,h=s.target;
  if(!s.active){stop();status('Roundup ended. Inspect the saved result.');report();return;}
  if(s.shared||s.runId!==runId||s.mode!==mode){stop();status('Stopped: the roundup changed. Inspect before resuming.');report();return;}
  if(blocked()||s.paused||s.pending||s.countdown>0){release();driverStatus='waiting for countdown, UI or save';return;}
  if(!h){release();driverStatus='waiting for a loose horse';return;}
  if(h.approachBlocked||!Number.isFinite(h.standX)||!Number.isFinite(h.standZ)){
   release();blockedSince=blockedSince||Date.now();driverStatus='waiting for a clear production herd route';driverTarget={horse:h.name,blocked:true};
   if(Date.now()-blockedSince>2000){stop();status('Stopped: the production herd marker has no clear approach. Manual steering needed.');report();}return;
  }
  blockedSince=0;
  const dx=s.pen.x-h.x,dz=s.pen.z-h.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
  const px=p.pos.x-h.x,pz=p.pos.z-h.z,along=px*ux+pz*uz,side=px*(-uz)+pz*ux;
  const routed=!!h.approachTarget;
  let x=routed?h.approachTarget.x:h.standX,z=routed?h.approachTarget.z:h.standZ;
  const spacing=Number($('herdSpacing').value),markerDistance=Math.hypot(x-h.x,z-h.z);
  // A skill comparison uses the same steering controls and real collision path.
  // Only the rider's aiming point changes; loose horses still own their motion.
  if(!routed&&spacing===7.5&&along<-6&&Math.abs(side)<5&&Number.isFinite(markerDistance)&&markerDistance>0){x=h.x+(x-h.x)*spacing/markerDistance;z=h.z+(z-h.z)*spacing/markerDistance;}
  if(!routed&&along>-5){const sign=Math.sign(side)||1;x=h.x-ux*8-uz*sign*17;z=h.z-uz*8+ux*sign*17;}
  if(!Number.isFinite(x)||!Number.isFinite(z)){release();driverStatus='no clear marker: manual steering needed';driverTarget={horse:h.name,blocked:true};return;}
  const distance=Math.hypot(x-p.pos.x,z-p.pos.z),angle=Math.atan2(x-p.pos.x,z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
  const keepingFullPace=mode==='full'&&Math.abs(delta)<.35&&((h.pressure==='guiding'&&h.speed>2.2)||(h.approachPhase==='pressure'&&along<-6&&distance>1.4));
  G.riding.selectGait(distance>(mode==='full'?8:15)||keepingFullPace?'trot':'walk');
  key('KeyA',delta>.035);key('KeyD',delta<-.035);key('KeyW',Math.abs(delta)<.6&&distance>.8);key('KeyS',Math.abs(delta)>1&&p.speed>1.2);
  driverSteps++;driverStatus='running '+mode+' roundup';driverTarget={x,z,distance,horse:h.name,pressure:h.pressure,spacing,approachBlocked:h.approachBlocked,approachPhase:h.approachPhase,planMs:h.approachPlanMs};
 }catch(e){stop();fail(e);}},100);
}
async function boot(){
 if(loading||ready)return;loading=true;$('boot').disabled=true;const safety=await fetch('./review.js',{method:'HEAD',cache:'no-store'});if(safety.headers.get('X-First-Rides-Offline')!=='1')throw Error('Use the dedicated offline serve.py; normal HTTP servers do not isolate multiplayer.');claimOrigin();status('Loading the genuine default ranch. Complete onboarding in the game; the fixture will not dismiss it.');
 const before=frame.contentWindow.document;
 if(frame.dataset.entry==='native')frame.src='/mobile/www/ranch3d.html?review=first-rides&diagnostics=qa&v='+Date.now();
 else frame.src='/ranch3d.html?review=first-rides&diagnostics=qa&v='+Date.now();
 await waitFor(()=>{w=frame.contentWindow;G=w.__features;return w.document!==before&&G?.rescueRide&&G?.riderJourney&&G?.ranchRush&&G.horse?.RIG().ready&&!w.document.getElementById('load');},'production horse and activity features');
 w.addEventListener('error',e=>fail(e.error||e.message));w.addEventListener('unhandledrejection',e=>fail(e.reason));
 for(const [name,source] of Object.entries({undergrowth:G.undergrowth,photoscans:G.photoscans,worldDetails:G.worldDetails,builder:G.world?.ranchBuilderArt})){scenery[name]='pending';Promise.resolve(source?.ready).then(()=>scenery[name]='settled',e=>{scenery[name]='failed';fail(e);});}
 // Production may release input while opening a panel or pausing. Keep only
 // the fixture's key-intent cache aligned so a later normal keydown is sent.
 w.addEventListener('keyup',e=>{if(Object.prototype.hasOwnProperty.call(held,e.code))held[e.code]=false;});
 // Observe the immutable frame metric only; the fixture never calls a reward method.
 G.on('tick',dt=>{recordEventTrace();recordH1();const meter=G.horse.frameTravel;if(!meter)return;ridingDistance.frames++;for(const key of ['travel','ground','gallop','bond'])if(Number.isFinite(meter[key])&&meter[key]>0)ridingDistance[key]+=meter[key];if(Number.isFinite(dt)&&dt>0&&meter.travel===0&&Math.abs(G.horse.player.speed)>2&&!blocked())ridingDistance.fastStationarySeconds+=dt;});
 ready=true;loading=false;for(const id of ['gait','forward','left','right','back','interact','jump','rideJump','jumpAssist','stop','drive','driveRush','driveRace','driveH1','driveRoundup'])$(id).disabled=false;
 status('Ready. Inspect and complete the real onboarding before choosing an activity.');report();
}
function roundupGeometry(){
 const bounds={x1:-110,x2:-33,z1:-45,z2:25},W=G?.world;if(!W)return null;
 const near=c=>Number.isFinite(c.x)&&Number.isFinite(c.z)&&Number.isFinite(c.r)&&c.r>=0&&c.x+c.r>=bounds.x1-2&&c.x-c.r<=bounds.x2+2&&c.z+c.r>=bounds.z1-2&&c.z-c.r<=bounds.z2+2;
 return {bounds,colliders:(W.colliders||[]).filter(near).map(c=>({x:c.x,z:c.z,r:c.r,precise:!!c.precise})),walls:(W.walls||[]).filter(w=>[w.x1,w.z1,w.x2,w.z2].every(Number.isFinite)&&Math.max(w.x1,w.x2)>=bounds.x1-2&&Math.min(w.x1,w.x2)<=bounds.x2+2&&Math.max(w.z1,w.z2)>=bounds.z1-2&&Math.min(w.z1,w.z2)<=bounds.z2+2).map(w=>({x1:w.x1,z1:w.z1,x2:w.x2,z2:w.z2}))};
}
function storySnapshot(s){
 const Q=G?.quest,idx=Q?.storyIdx?.(),prog=Q?.storyProg?.(),m=Q?.STORY?.[idx];
 const track=w?.document.getElementById('questTrack');
 const guidance=track?{text:track.textContent,accessibleLabel:track.getAttribute('aria-label')}:null;
 const target=m?G?.storyGuidance?.target?.(m,s,prog>=m.goal):null;
 return {index:idx,progress:prog,saved:s?.story?{index:s.story.idx,progress:s.story.prog,name:s.story.name||null,era:s.story.era,clues:[...(s.story.clues||[])]}:null,
  mission:m?{label:m.label,type:m.type,goal:m.goal,npc:m.npc||'wren',talk:m.talk||null}:null,guidance,
  target:target?.position?{id:target.id||null,x:target.position.x,z:target.position.z}:null};
}
function snapshot(){
 const controls=renderProxies(),base={ready,loading,status:$('status').textContent,controls,lastClick,errors:[...errors],method:'Production-created save and normal wall-time keys; no fixture writes to progression, position, heading, or clock.'};
 if(!G)return base;
 if(G.net?.net.client?.connected&&!networkStopped){networkStopped=true;stop();G.net.net.client.end(true);status('STOPPED: an unexpected network connection appeared and was disconnected. Do not continue this offline playtest.');}
 const p=G.horse.player,s=storageOwned?readSave():null,roundState=G.roundup?.state();recordRush();
 if(roundState?.active){
  if(tracedRun!==roundState.runId){tracedRun=roundState.runId;roundupTrace.length=0;lastTraceElapsed=-1;}
  if(roundState.elapsed-lastTraceElapsed>=.75){const h=roundState.target;roundupTrace.push({elapsed:roundState.elapsed,penned:roundState.penned,horse:h?.name,x:h?.x,z:h?.z,heading:h?.heading,avoidSide:h?.avoidSide,pressure:h?.pressure,distance:h?.distance,speed:h?.speed,approachBlocked:h?.approachBlocked,approachPhase:h?.approachPhase,approachTarget:h?.approachTarget,planMs:h?.approachPlanMs,playerX:p.pos.x,playerZ:p.pos.z,playerSpeed:p.speed});if(roundupTrace.length>250)roundupTrace.shift();lastTraceElapsed=roundState.elapsed;}
 }
 return {...base,edition:frame.dataset.entry==='native'?'native-browser-preview':'production-web',socialInstalled:!!G.social,training:G.course?.drillState?.()||null,nativePlatform:w.MeadowlarkNative?{mode:w.MeadowlarkNative.mode,native:w.MeadowlarkNative.native,paused:w.MeadowlarkNative.paused}:null,cottonwoodPost:G.cottonwoodPost?.snapshot()||null,ranchStatus:s&&G.ranchSys?{points:G.ranchSys.ranchPts(s),level:G.ranchSys.ranchLevel(s),regionalLevel:G.worldPkg?.ranchLevel?.(s),regions:(G.tables.REGIONS||[]).filter(r=>r.unlock).map(r=>({id:r.id,unlocked:!!G.worldPkg?.regionUnlocked?.(r,s),permanent:!!s.unlocked?.[r.id]}))}:null,ridingDistance:{...ridingDistance,frame:G.horse.frameTravel||null,gait:G.horse.RIG().heroMotion?.state?.gait||null},story:storySnapshot(s),rescue:G.rescueRide?.snapshot(),journey:G.riderJourney?.snapshot(),rush:G.ranchRush?.snapshot(),rushCourse:readRush(),h1Course:readH1Course(),h1Trace:[...h1Trace],eventCourse:readEventCourse(),eventTrace:[...eventTrace],rushTrace:[...rushTrace],roundup:roundState,roundupGeometry:roundupGeometry(),roundupTrace:[...roundupTrace],scenery:{...scenery},adoptedMount:G.rescueRide?.adoptedMount?.()||null,player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,height:p.y,jumpAge:G.horse.RIG().heroJumpAge??null,stam:Number.isFinite(p.stam)?p.stam:null,blown:!!p.blown,exhaustT:Number.isFinite(p.exhaustT)?p.exhaustT:0,landT:Number.isFinite(p.landT)?p.landT:0,rigReady:G.horse.RIG().ready,horseId:G.horse.ridden?.()?.id,horseName:G.horse.ridden?.()?.name,breed:G.horse.ridden?.()?.breed,modelKey:G.horse.RIG().modelKey,loadingBreed:!!G.horse.RIG().loadingBreed},ui:{blocked:!!G.input?.blocked?.(),bodyClasses:w.document.body.className,dialogVisible:!!w.document.getElementById('dlg')?.getClientRects().length},driver:{active:!!driver,status:driverStatus,steps:driverSteps,target:driverTarget},networkConnected:!!G.net?.net.client?.connected,networkStopped,featureErrors:G.errors||[],saveSummary:s?{coins:s.coins,gems:s.gems,keys:Number.isFinite(s.keys)?s.keys:null,keysGiven:!!s.keysGiven,starterStallOpened:!!s.doors?.starter,postReceipts:s.cottonwoodPost||null,activityProgress:{trails:s.stats?.trails||0,expeditions:s.stats?.expeditions||0,cottonwood:s.expDone?.cottonwood||0,passPoints:s.pass?.pts||0,starPoints:s.sp?.pts||0},bestTimes:s.bestTimes||{},ribbons:s.ribbons||{},ribbonsBy:s.ribbonsBy||{},ribbonGold:s.ribbonGold||{},ribbonAwards:s.ribbonAwards||null,breedingWeek:s.brw?{week:s.brw.wk,ribbons:s.brw.n}:null,horseCount:s.horses?.length||0,riderCreated:!!s.rider?.made,ridingHorseId:s.ridingHorseId,horseNames:s.horses?.map(h=>({id:h.id,name:h.name,breed:h.breed,level:h.level,xp:h.xp,bond:h.bond,stats:{...h.stats},sxp:{...h.sxp}})),totalRaces:s.totalRaces||0,racing:{races:s.racing?.races||0,points:s.racing?.pts||0,wins:s.racing?.wins||0,pvp:s.racing?.pvp||0},fieldRacing:{races:s.lad?.races||0,wins:s.lad?.wins||0,podiums:s.lad?.podiums||0},ribbonTotal:s.ribbonTotal||0,ladderRibbonTotal:s.lad?.rib?.total||0,rescue:{completions:s.rescueRides?.completions||0,adopted:!!s.rescueRides?.adopted},journey:s.riderJourney||null,rush:s.ranchRush?.records||null}:null};
}
function report(){try{$('report').textContent=JSON.stringify(snapshot(),null,2);}catch(e){$('report').textContent='Diagnostics unavailable: '+String(e);}}
$('boot').onclick=()=>boot().catch(fail);$('reportNow').onclick=report;for(const [id,code]of Object.entries(KEYS))$(id).onclick=()=>manual(code);
$('jump').onclick=manualJump;$('rideJump').onclick=manualRideJump;$('jumpAssist').onchange=()=>{if($('jumpAssist').value==='off'){if(jumpTimer)clearTimeout(jumpTimer);jumpTimer=null;key('Space',false);}recordRush('assistance changed');report();};
$('stop').onclick=()=>{stop();status('All fixture riding keys released.');report();};$('drive').onclick=startDriver;$('driveRush').onclick=startRushDriver;$('driveRace').onclick=startFlatRaceDriver;$('driveH1').onclick=startH1Driver;$('driveRoundup').onclick=startRoundupDriver;$('gait').onchange=()=>{if(ready&&['walk','trot','canter','gallop'].includes($('gait').value))G.riding.selectGait($('gait').value);};
window.addEventListener('pagehide',stop);window.addEventListener('blur',()=>{if(manualTimer){clearTimeout(manualTimer);manualTimer=null;release();}});
try{guard();setInterval(()=>{if(ready&&blocked())release();report();},1000);report();}catch(e){$('boot').disabled=true;fail(e);}
