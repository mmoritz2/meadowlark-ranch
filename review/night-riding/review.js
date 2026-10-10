const $=id=>document.getElementById(id),frame=$('game');
const SAVE='starRanchFable_v1',MARK='night-riding-qa-owned',MARK_VALUE='disposable local night readability review';
const TIMES=Object.freeze({midnight:0,dawn:.16,noon:.5,dusk:.84});
const VIEWS=Object.freeze({pasture:{x:-55,z:-15,heading:Math.atan2(11,7)},pastureOpposite:{x:-55,z:-15,heading:Math.atan2(11,7)+Math.PI},trail:{x:-14,z:-41,heading:Math.atan2(-16,-17)},village:{x:27,z:-31,heading:Math.atan2(12,-8)}});
let w=null,G=null,ready=false,loading=false,switchingHorse=false,holdTimer=null,rideTimer=null,heldForward=false,targetTime=TIMES.midnight;const errors=[];
function guard(){if(location.protocol!=='http:'||!['localhost','127.0.0.1'].includes(location.hostname)||location.port!=='18798')throw Error('Use only http://127.0.0.1:18798/review/night-riding/.');}
function status(s){$('status').textContent=s;}
function fail(e){errors.push(String(e?.stack||e));if(errors.length>12)errors.shift();status('FAILED: '+String(e?.message||e));report();}
function seed(){
 guard();const existing=localStorage.getItem(SAVE),old=existing?JSON.parse(existing):null;
 if(localStorage.length&&(localStorage.getItem(MARK)!==MARK_VALUE||old?.qaNightRiding?.owned!==true))throw Error('Refusing unrelated storage. Use a fresh browser profile on port 18798; nothing was deleted.');
 const at=Date.now(),s=old||{v:2,ranchName:'Visual QA Ranch',founded:at,coins:150,gems:3,items:{carrot:10,apple:2,hay:3},nextId:1,horses:[],decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:true,lastSeen:at,lastDaily:new Date().toDateString(),questDate:'',quests:[],totalRaces:0,started:true};
 if(s.playerName||s.club||s.ridingClub||s.clubPriv||Object.keys(s.clubRecords||{}).length)throw Error('This marked save has online identity or club data. Use a new profile; the fixture will not replace it.');
 s.qaNightRiding={...s.qaNightRiding,owned:true,purpose:'local visual comparison'};s.playerName='';s.quality=$('quality').value;s.qualityLocked=true;s.muted=true;s.pubWorld=false;
 localStorage.setItem(MARK,MARK_VALUE);localStorage.setItem(SAVE,JSON.stringify(s));if(JSON.parse(localStorage.getItem(SAVE))?.qaNightRiding?.owned!==true)throw Error('QA seed could not be verified.');
}
async function waitFor(fn,label){for(let i=0;i<2400;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out waiting for '+label);}
function closeScreens(){G.hidePanels();const dlg=w.document.getElementById('dlg');if(dlg)dlg.style.display='none';G.seFrame?.settle?.();w.document.activeElement?.blur?.();}
function setTime(){if(!ready)return;targetTime=TIMES[$('time').value];w._setDay(targetTime);report();}
function setQuality(){if(!ready)return;const q=$('quality').value;if(!['low','medium','high'].includes(q))return;G.gfx.apply(q);G.save.sync(s=>{s.quality=q;s.qualityLocked=true;});report();}
function stage(){
 if(!ready)return;stopRide();closeScreens();const v=VIEWS[$('view').value];if(!v)return;
 const p=G.horse.player;p.pos.set(v.x,0,v.z);p.speed=0;p.y=0;p.vy=0;p.heading=v.heading;
 p.mesh.position.set(v.x,G.world.groundH(v.x,v.z),v.z);p.mesh.rotation.y=v.heading;G.world.camOrbit.yaw=0;G.followCam?.reset?.();G.riding.selectGait('walk');
 status('Visual staging: '+$('view').selectedOptions[0].textContent+'. Time held; production animation running.');report();
}
function assertOwned(s){guard();if(localStorage.getItem(MARK)!==MARK_VALUE||s?.qaNightRiding?.owned!==true)throw Error('Horse review is restricted to this marked disposable save.');}
async function selectHorse(){
 if(!ready||switchingHorse)return;const choice=$('horse').value;if(!['starter','white-western','shire'].includes(choice))return;
 const initial=JSON.parse(localStorage.getItem(SAVE)||'null');assertOwned(initial);stopRide();closeScreens();switchingHorse=true;$('horse').disabled=true;$('ride').disabled=true;status('Preparing the selected native review horse…');
 try{
  G.save.sync(s=>{
   assertOwned(s);const q=s.qaNightRiding;q.reviewHorseIds=q.reviewHorseIds||{};
   if(!s.horses.some(h=>h.id===q.starterId))q.starterId=(s.horses.find(h=>h.breed==='bay'&&!h.foal)||s.horses.find(h=>h.id===s.ridingHorseId&&!h.foal)||s.horses.find(h=>!h.foal))?.id;
   if(q.starterId==null)throw Error('The owned starter horse is unavailable.');
   if(choice==='starter')return;
   if(!G.tables.BREEDS3.some(b=>b[0]===choice))throw Error('The native review breed is unavailable: '+choice);
   let h=s.horses.find(h=>h.id===q.reviewHorseIds[choice]&&h.breed===choice&&!h.foal)||s.horses.find(h=>h.breed===choice&&!h.foal);
   if(!h)h=G.horse.grantHorse(s,choice,{name:choice==='shire'?'QA Shire':'QA White Western',noName:true,silent:true,src:'visual-review'});
   q.reviewHorseIds[choice]=h.id;
  });
  const saved=JSON.parse(localStorage.getItem(SAVE)||'null');assertOwned(saved);const id=choice==='starter'?saved.qaNightRiding.starterId:saved.qaNightRiding.reviewHorseIds?.[choice];
  if(id==null||!saved.horses.some(h=>h.id===id&&(choice==='starter'||h.breed===choice)))throw Error('The review horse could not be confirmed in the disposable save.');
  G.horse.reloadHorses();const index=G.horse.myHorses.findIndex(h=>h.id===id),select=w.document.getElementById('horseSel');
  if(index<0||typeof select?.onchange!=='function')throw Error('The production horse selector is unavailable.');
  select.value=String(index);select.onchange();
  await waitFor(()=>{const rig=G.horse.RIG();return G.horse.ridden()?.id===id&&rig.ready&&!rig.loadingBreed&&rig.attachedTo===G.horse.player.mesh;},'selected native review horse');
  stage();status('Review horse: '+G.horse.ridden().name+' · '+G.horse.ridden().breed+'. Visual staging only.');
 }finally{switchingHorse=false;$('horse').disabled=false;$('ride').disabled=false;report();}
}
function key(on){if(!w||heldForward===on)return;heldForward=on;w.document.dispatchEvent(new w.KeyboardEvent(on?'keydown':'keyup',{code:'KeyW',key:'w',bubbles:true}));}
function stopRide(){if(rideTimer)clearTimeout(rideTimer);rideTimer=null;key(false);G?.riding?.releaseAll();$('stop').disabled=true;if(ready)$('ride').disabled=false;}
function ride(){if(!ready)return;stopRide();closeScreens();G.riding.selectGait('walk');key(true);$('ride').disabled=true;$('stop').disabled=false;status('Walking normally for two seconds; selected time remains held.');rideTimer=setTimeout(()=>{stopRide();status('Walk complete. Reset viewpoint to repeat the same framing.');report();},2000);}
async function boot(){
 if(loading||ready)return;loading=true;$('boot').disabled=true;seed();status('Loading production horse and scenery…');
 const before=frame.contentWindow.document;frame.src='/ranch3d.html?qa=night-riding&v='+Date.now();
 await waitFor(()=>{w=frame.contentWindow;G=w.__features;return w.document!==before&&G?.atmos&&G?.gfx&&G.horse?.RIG().ready&&!w.document.getElementById('load');},'native horse and features');
 w.addEventListener('error',e=>fail(e.error||e.message));w.addEventListener('unhandledrejection',e=>fail(e.reason));
 await Promise.all([G.undergrowth?.ready,G.photoscans?.ready,G.worldDetails?.ready,G.world?.ranchBuilderArt?.ready].filter(Boolean));
 if(G.net?.net.client){G.net.net.client.end(true);throw Error('Unexpected online client: this fixture requires an offline save.');}
 ready=true;loading=false;G.audio?.setMuted(true);for(const id of ['time','quality','view','horse','stage','ride','reportNow'])$(id).disabled=false;
 const saved=G.save.fresh(),ridden=G.horse.ridden();$('horse').value=['white-western','shire'].includes(ridden?.breed)?ridden.breed:'starter';
 setQuality();setTime();holdTimer=setInterval(()=>{if(ready)w._setDay(targetTime);},50);stage();report();
}
function color(c){return c?.isColor?'#'+c.getHexString():null;}
function report(){
 const out={status:$('status').textContent,ready,visualOnly:true,selectedReviewHorse:$('horse').value,switchingHorse,stagedView:$('view').value,requestedTime:$('time').value,targetDayT:targetTime,errors:[...errors]};
 if(ready){const p=G.horse.player,lights=[];G.scene.traverse(o=>{if(o.isLight&&(o.isDirectionalLight||o.isHemisphereLight||o.isAmbientLight||o.position.distanceTo(p.mesh.position)<65)&&lights.length<40)lights.push({name:o.name||o.type,type:o.type,color:color(o.color),groundColor:color(o.groundColor),intensity:o.intensity,visible:o.visible,castShadow:o.castShadow,position:o.position.toArray()});});Object.assign(out,{dayT:G.time.dayT(),quality:G.gfx.get(),bloom:G.gfx.bloom(),renderer:{frames:G.renderer.info.render.frame,pixelRatio:G.renderer.getPixelRatio(),exposure:G.renderer.toneMappingExposure},horse:{name:G.horse.ridden()?.name,breed:G.horse.ridden()?.breed,colors:G.horse.ridden()?.colors,modelKey:G.horse.RIG().modelKey,requestedBreed:G.horse.RIG().requestedBreed,loadingBreed:G.horse.RIG().loadingBreed||null},player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,rigReady:G.horse.RIG().ready},camera:{position:G.camera.position.toArray(),fov:G.camera.fov},atmosphere:{found:G.atmos.found,rain:G.atmos.rain,cloud:G.atmos.cloud},fog:{color:color(G.scene.fog?.color),density:G.scene.fog?.density},lights,networkConnected:!!G.net?.net.client?.connected,featureErrors:G.errors||[]});}
 $('report').textContent=JSON.stringify(out,null,2);
}
$('boot').onclick=()=>boot().catch(fail);$('time').onchange=setTime;$('quality').onchange=setQuality;$('view').onchange=stage;$('horse').onchange=()=>selectHorse().catch(fail);$('stage').onclick=stage;$('ride').onclick=ride;$('stop').onclick=()=>{stopRide();status('Riding controls released.');report();};$('reportNow').onclick=report;
window.addEventListener('pagehide',()=>{stopRide();if(holdTimer)clearInterval(holdTimer);});
try{guard();setInterval(report,1000);report();}catch(e){$('boot').disabled=true;fail(e);}
