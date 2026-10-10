const $=id=>document.getElementById(id),frame=$('game'),SAVE='starRanchFable_v1',MARK='first-rides-qa-owned',MARK_VALUE='disposable genuine first-rides review';
const PREFIXES=['adventure:','journey:','rush:'],BUTTON_IDS=new Set(['rescueReassure','rescueRetrySave','adventureCancel','rushChoose','rushQuickStart','chSave']);
const KEYS={forward:'KeyW',left:'KeyA',right:'KeyD',back:'KeyS'},held={},proxyNodes=new Map(),errors=[];
let networkStopped=false;const scenery={};
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
function key(code,on){if(!w||held[code]===on)return;held[code]=on;w.document.dispatchEvent(new w.KeyboardEvent(on?'keydown':'keyup',{code,key:{KeyW:'w',KeyA:'a',KeyD:'d',KeyS:'s'}[code],bubbles:true}));}
function release(){for(const code of Object.keys(held))key(code,false);G?.riding?.releaseAll();}
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
function startRushDriver(){
 if(networkStopped||!ready||G.ranchRush?.snapshot().active?.id!=='rush-pasture'){status('Start Pasture Dash through a visible production button first.');return;}
 stop();w.document.activeElement?.blur?.();driverStatus='running Pasture Dash';status('Riding the actual Pasture Dash gates with normal keys; no crossing or result injection.');
 driver=setInterval(()=>{try{
  const a=G.ranchRush.snapshot().active,c=G.course.get(),p=G.horse.player;
  if(a?.id!=='rush-pasture'||!c?.rush){stop();status('Pasture Dash ended. Inspect the real result.');report();return;}
  if(blocked()||!a.started){release();driverStatus='waiting for the game countdown or UI';return;}
  const gate=c.jumps[c.idx];if(!gate||gate.kind!=='gate'){release();driverStatus='waiting for a course gate';return;}
  const x=gate.x+Math.sin(gate.rotY)*2,z=gate.z+Math.cos(gate.rotY)*2;
  const distance=Math.hypot(x-p.pos.x,z-p.pos.z),angle=Math.atan2(x-p.pos.x,z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
  G.riding.selectGait(distance>18&&Math.abs(delta)<.2?'canter':'trot');
  key('KeyA',delta>.04);key('KeyD',delta<-.04);key('KeyW',Math.abs(delta)<.65);key('KeyS',Math.abs(delta)>1&&p.speed>1.2);
  driverSteps++;driverStatus='running Pasture Dash';driverTarget={x,z,distance,gate:c.idx+1,total:c.jumps.length};
 }catch(e){stop();fail(e);}},100);
}
async function boot(){
 if(loading||ready)return;loading=true;$('boot').disabled=true;const safety=await fetch('./review.js',{method:'HEAD',cache:'no-store'});if(safety.headers.get('X-First-Rides-Offline')!=='1')throw Error('Use the dedicated offline serve.py; normal HTTP servers do not isolate multiplayer.');claimOrigin();status('Loading the genuine default ranch. Complete onboarding in the game; the fixture will not dismiss it.');
 const before=frame.contentWindow.document;frame.src='/ranch3d.html?review=first-rides&diagnostics=qa&v='+Date.now();
 await waitFor(()=>{w=frame.contentWindow;G=w.__features;return w.document!==before&&G?.rescueRide&&G?.riderJourney&&G?.ranchRush&&G.horse?.RIG().ready&&!w.document.getElementById('load');},'production horse and activity features');
 w.addEventListener('error',e=>fail(e.error||e.message));w.addEventListener('unhandledrejection',e=>fail(e.reason));
 for(const [name,source] of Object.entries({undergrowth:G.undergrowth,photoscans:G.photoscans,worldDetails:G.worldDetails,builder:G.world?.ranchBuilderArt})){scenery[name]='pending';Promise.resolve(source?.ready).then(()=>scenery[name]='settled',e=>{scenery[name]='failed';fail(e);});}
 ready=true;loading=false;for(const id of ['gait','forward','left','right','back','stop','drive','driveRush'])$(id).disabled=false;
 status('Ready. Inspect and complete the real onboarding before choosing an activity.');report();
}
function snapshot(){
 const controls=renderProxies(),base={ready,loading,status:$('status').textContent,controls,lastClick,errors:[...errors],method:'Production-created save and normal wall-time keys; no fixture writes to progression, position, heading, or clock.'};
 if(!G)return base;
 if(G.net?.net.client?.connected&&!networkStopped){networkStopped=true;stop();G.net.net.client.end(true);status('STOPPED: an unexpected network connection appeared and was disconnected. Do not continue this offline playtest.');}
 const p=G.horse.player,s=storageOwned?readSave():null;return {...base,rescue:G.rescueRide?.snapshot(),journey:G.riderJourney?.snapshot(),rush:G.ranchRush?.snapshot(),scenery:{...scenery},adoptedMount:G.rescueRide?.adoptedMount?.()||null,player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,rigReady:G.horse.RIG().ready,horseId:G.horse.ridden?.()?.id,horseName:G.horse.ridden?.()?.name,breed:G.horse.ridden?.()?.breed,modelKey:G.horse.RIG().modelKey,loadingBreed:!!G.horse.RIG().loadingBreed},ui:{blocked:!!G.input?.blocked?.(),bodyClasses:w.document.body.className,dialogVisible:!!w.document.getElementById('dlg')?.getClientRects().length},driver:{active:!!driver,status:driverStatus,steps:driverSteps,target:driverTarget},networkConnected:!!G.net?.net.client?.connected,networkStopped,featureErrors:G.errors||[],saveSummary:s?{horseCount:s.horses?.length||0,riderCreated:!!s.rider?.made,ridingHorseId:s.ridingHorseId,horseNames:s.horses?.map(h=>({id:h.id,name:h.name,breed:h.breed})),totalRaces:s.totalRaces||0,rescue:{completions:s.rescueRides?.completions||0,adopted:!!s.rescueRides?.adopted},journey:s.riderJourney||null,rush:s.ranchRush?.records||null}:null};
}
function report(){try{$('report').textContent=JSON.stringify(snapshot(),null,2);}catch(e){$('report').textContent='Diagnostics unavailable: '+String(e);}}
$('boot').onclick=()=>boot().catch(fail);$('reportNow').onclick=report;for(const [id,code]of Object.entries(KEYS))$(id).onclick=()=>manual(code);
$('stop').onclick=()=>{stop();status('All fixture riding keys released.');report();};$('drive').onclick=startDriver;$('driveRush').onclick=startRushDriver;$('gait').onchange=()=>{if(ready&&['walk','trot','canter'].includes($('gait').value))G.riding.selectGait($('gait').value);};
window.addEventListener('pagehide',stop);window.addEventListener('blur',()=>{if(manualTimer){clearTimeout(manualTimer);manualTimer=null;release();}});
try{guard();setInterval(()=>{if(ready&&blocked())release();report();},1000);report();}catch(e){$('boot').disabled=true;fail(e);}
