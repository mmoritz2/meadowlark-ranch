const $=id=>document.getElementById(id),frame=$('game'),SAVE='starRanchFable_v1',MARK='first-rides-qa-owned',MARK_VALUE='disposable genuine first-rides review';
const PREFIXES=['adventure:','journey:','rush:','herd:'],BUTTON_IDS=new Set(['rescueReassure','rescueRetrySave','adventureCancel','rushChoose','rushQuickStart','chSave']);
const KEYS={forward:'KeyW',left:'KeyA',right:'KeyD',back:'KeyS'},held={},proxyNodes=new Map(),errors=[];
let networkStopped=false;const scenery={},roundupTrace=[],rushTrace=[];let tracedRun=null,lastTraceElapsed=-1;
let rushCourse=null,lastRushTraceElapsed=-1,lastRushTraceKey='',jumpTimer=null;
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
function key(code,on){if(!w||held[code]===on)return;held[code]=on;w.document.dispatchEvent(new w.KeyboardEvent(on?'keydown':'keyup',{code,key:{KeyW:'w',KeyA:'a',KeyD:'d',KeyS:'s',Space:' '}[code],bubbles:true,cancelable:true}));}
function release(){if(jumpTimer)clearTimeout(jumpTimer);jumpTimer=null;for(const code of Object.keys(held))key(code,false);G?.riding?.releaseAll();}
function pulseJump(){key('Space',true);if(jumpTimer)clearTimeout(jumpTimer);jumpTimer=setTimeout(()=>{jumpTimer=null;key('Space',false);},120);}
function manualJump(){if(networkStopped||!ready||blocked()){status('Close the current game dialog before asking for a jump.');return;}stop();w.document.activeElement?.blur?.();pulseJump();status('Pressed Space through ordinary input. Production decides whether the horse can jump.');recordRush('manual Space');report();}
function blocked(){return !ready||G.input?.blocked?.()||G.photoPause||w.document.hidden||w.document.body.classList.contains('freecam');}
function stop(){if(manualTimer)clearTimeout(manualTimer);if(driver)clearInterval(driver);manualTimer=null;driver=null;driverStatus='off';release();}
function manual(code){if(networkStopped){status('This playtest stopped after an unexpected network connection.');return;}if(!ready||blocked()){status('Finish or close the current game dialog before riding.');return;}stop();w.document.activeElement?.blur?.();const seconds=Number($('duration').value);if(![.25,.5,1,2].includes(seconds))return;key(code,true);status('Holding '+code.replace('Key','')+' for '+seconds+' seconds through normal input.');manualTimer=setTimeout(()=>{manualTimer=null;release();status('Key released.');report();},seconds*1000);}
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
  grades:[...(c.ce?.grades||[])],lastGrade:c.ce?.lastGrade||null,refusals:c.ce?.refusals||0};
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
function startRoundupDriver(){
 if(networkStopped||!ready||!G.roundup?.state().active||G.roundup.state().shared||G.roundup.state().mode!=='beginner'){status('Start a solo beginner roundup through a visible production button first.');return;}
 stop();w.document.activeElement?.blur?.();driverStatus='running beginner roundup';status('Herding through ordinary riding keys; no horse position or pen-count injection.');
 driver=setInterval(()=>{try{
  const s=G.roundup.state(),p=G.horse.player,h=s.target;
  if(!s.active){stop();status('Roundup ended. Inspect the saved result.');report();return;}
  if(blocked()||s.paused||s.pending||s.countdown>0){release();driverStatus='waiting for countdown, UI or save';return;}
  if(!h){release();driverStatus='waiting for a loose horse';return;}
  const dx=s.pen.x-h.x,dz=s.pen.z-h.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
  const px=p.pos.x-h.x,pz=p.pos.z-h.z,along=px*ux+pz*uz,side=px*(-uz)+pz*ux;
  let x=h.standX,z=h.standZ;
  const spacing=Number($('herdSpacing').value),markerDistance=Math.hypot(x-h.x,z-h.z);
  // A skill comparison uses the same steering controls and real collision path.
  // Only the rider's aiming point changes; loose horses still own their motion.
  if(spacing===7.5&&along<-6&&Math.abs(side)<5&&Number.isFinite(markerDistance)&&markerDistance>0){x=h.x+(x-h.x)*spacing/markerDistance;z=h.z+(z-h.z)*spacing/markerDistance;}
  if(along>-5){const sign=Math.sign(side)||1;x=h.x-ux*8-uz*sign*17;z=h.z-uz*8+ux*sign*17;}
  if(!Number.isFinite(x)||!Number.isFinite(z)){release();driverStatus='no clear marker: manual steering needed';driverTarget={horse:h.name,blocked:true};return;}
  const distance=Math.hypot(x-p.pos.x,z-p.pos.z),angle=Math.atan2(x-p.pos.x,z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
  G.riding.selectGait(distance>15?'trot':'walk');
  key('KeyA',delta>.035);key('KeyD',delta<-.035);key('KeyW',Math.abs(delta)<.6&&distance>.8);key('KeyS',Math.abs(delta)>1&&p.speed>1.2);
  driverSteps++;driverStatus='running beginner roundup';driverTarget={x,z,distance,horse:h.name,pressure:h.pressure,spacing,approachBlocked:h.approachBlocked};
 }catch(e){stop();fail(e);}},100);
}
async function boot(){
 if(loading||ready)return;loading=true;$('boot').disabled=true;const safety=await fetch('./review.js',{method:'HEAD',cache:'no-store'});if(safety.headers.get('X-First-Rides-Offline')!=='1')throw Error('Use the dedicated offline serve.py; normal HTTP servers do not isolate multiplayer.');claimOrigin();status('Loading the genuine default ranch. Complete onboarding in the game; the fixture will not dismiss it.');
 const before=frame.contentWindow.document;frame.src='/ranch3d.html?review=first-rides&diagnostics=qa&v='+Date.now();
 await waitFor(()=>{w=frame.contentWindow;G=w.__features;return w.document!==before&&G?.rescueRide&&G?.riderJourney&&G?.ranchRush&&G.horse?.RIG().ready&&!w.document.getElementById('load');},'production horse and activity features');
 w.addEventListener('error',e=>fail(e.error||e.message));w.addEventListener('unhandledrejection',e=>fail(e.reason));
 for(const [name,source] of Object.entries({undergrowth:G.undergrowth,photoscans:G.photoscans,worldDetails:G.worldDetails,builder:G.world?.ranchBuilderArt})){scenery[name]='pending';Promise.resolve(source?.ready).then(()=>scenery[name]='settled',e=>{scenery[name]='failed';fail(e);});}
 ready=true;loading=false;for(const id of ['gait','forward','left','right','back','jump','jumpAssist','stop','drive','driveRush','driveRoundup'])$(id).disabled=false;
 status('Ready. Inspect and complete the real onboarding before choosing an activity.');report();
}
function snapshot(){
 const controls=renderProxies(),base={ready,loading,status:$('status').textContent,controls,lastClick,errors:[...errors],method:'Production-created save and normal wall-time keys; no fixture writes to progression, position, heading, or clock.'};
 if(!G)return base;
 if(G.net?.net.client?.connected&&!networkStopped){networkStopped=true;stop();G.net.net.client.end(true);status('STOPPED: an unexpected network connection appeared and was disconnected. Do not continue this offline playtest.');}
 const p=G.horse.player,s=storageOwned?readSave():null,roundState=G.roundup?.state();recordRush();
 if(roundState?.active){
  if(tracedRun!==roundState.runId){tracedRun=roundState.runId;roundupTrace.length=0;lastTraceElapsed=-1;}
  if(roundState.elapsed-lastTraceElapsed>=.75){const h=roundState.target;roundupTrace.push({elapsed:roundState.elapsed,penned:roundState.penned,horse:h?.name,x:h?.x,z:h?.z,pressure:h?.pressure,distance:h?.distance,speed:h?.speed,approachBlocked:h?.approachBlocked,playerX:p.pos.x,playerZ:p.pos.z,playerSpeed:p.speed});if(roundupTrace.length>250)roundupTrace.shift();lastTraceElapsed=roundState.elapsed;}
 }
 return {...base,rescue:G.rescueRide?.snapshot(),journey:G.riderJourney?.snapshot(),rush:G.ranchRush?.snapshot(),rushCourse:readRush(),rushTrace:[...rushTrace],roundup:roundState,roundupTrace:[...roundupTrace],scenery:{...scenery},adoptedMount:G.rescueRide?.adoptedMount?.()||null,player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,rigReady:G.horse.RIG().ready,horseId:G.horse.ridden?.()?.id,horseName:G.horse.ridden?.()?.name,breed:G.horse.ridden?.()?.breed,modelKey:G.horse.RIG().modelKey,loadingBreed:!!G.horse.RIG().loadingBreed},ui:{blocked:!!G.input?.blocked?.(),bodyClasses:w.document.body.className,dialogVisible:!!w.document.getElementById('dlg')?.getClientRects().length},driver:{active:!!driver,status:driverStatus,steps:driverSteps,target:driverTarget},networkConnected:!!G.net?.net.client?.connected,networkStopped,featureErrors:G.errors||[],saveSummary:s?{horseCount:s.horses?.length||0,riderCreated:!!s.rider?.made,ridingHorseId:s.ridingHorseId,horseNames:s.horses?.map(h=>({id:h.id,name:h.name,breed:h.breed})),totalRaces:s.totalRaces||0,rescue:{completions:s.rescueRides?.completions||0,adopted:!!s.rescueRides?.adopted},journey:s.riderJourney||null,rush:s.ranchRush?.records||null}:null};
}
function report(){try{$('report').textContent=JSON.stringify(snapshot(),null,2);}catch(e){$('report').textContent='Diagnostics unavailable: '+String(e);}}
$('boot').onclick=()=>boot().catch(fail);$('reportNow').onclick=report;for(const [id,code]of Object.entries(KEYS))$(id).onclick=()=>manual(code);
$('jump').onclick=manualJump;$('jumpAssist').onchange=()=>{if($('jumpAssist').value==='off'){if(jumpTimer)clearTimeout(jumpTimer);jumpTimer=null;key('Space',false);}recordRush('assistance changed');report();};
$('stop').onclick=()=>{stop();status('All fixture riding keys released.');report();};$('drive').onclick=startDriver;$('driveRush').onclick=startRushDriver;$('driveRoundup').onclick=startRoundupDriver;$('gait').onchange=()=>{if(ready&&['walk','trot','canter'].includes($('gait').value))G.riding.selectGait($('gait').value);};
window.addEventListener('pagehide',stop);window.addEventListener('blur',()=>{if(manualTimer){clearTimeout(manualTimer);manualTimer=null;release();}});
try{guard();setInterval(()=>{if(ready&&blocked())release();report();},1000);report();}catch(e){$('boot').disabled=true;fail(e);}
