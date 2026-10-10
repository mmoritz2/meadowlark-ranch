import {createAdoptedRescueMount} from './rescue-adopted-mount.mjs?v=rescue-handoff-1';
import {RESCUE_DEFINITION,RESCUE_APPROACH,sanitizeRescueSave,canAdoptClover,pendingRescueFinish,saveRescueFinish,saveCloverAdoption,mirrorRescueHorseXp,calmAfter,isTravelJump,rescueInteraction,rescueRetreatCandidates,insideRescueRetreat} from './rescue-rules.mjs?v=rescue-save-confirmed-1';
export const id='rescue-rides';
export function install(G){
 const H=G.horse,W=G.world,S=G.save,THREE=G.THREE,player=H.player,definition=RESCUE_DEFINITION;
 const colors={body:'#e9ddcb',mane:'#39291f'};
 let active=null,lastResult=null,serial=0,records,worldGroup=null,marker=null,prints=[],horse=null,adoptionPending=null;
 S.ensure(s=>{s.rescueRides=sanitizeRescueSave(s.rescueRides);});
 function refresh(saved=S.fresh()){if(!saved&&records)return;const s=sanitizeRescueSave(saved?.rescueRides);records={...s,canAdopt:canAdoptClover(s)};}
 refresh();
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 const point=([x,z],label)=>({x,z,label});
 // Mission labels are owned here. The game's global nameSprite list keeps permanent
 // town signs alive, so replayable rescue labels must not be added to that registry.
 function nameplate(text){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const c=canvas.getContext('2d');c.fillStyle='#f3fff7';c.beginPath();c.roundRect(14,17,484,94,24);c.fill();
  c.strokeStyle='#316458';c.lineWidth=4;c.stroke();c.textAlign='center';c.textBaseline='middle';c.fillStyle='#163e34';
  let size=44;c.font=`700 ${size}px sans-serif`;while(c.measureText(text).width>450&&size>20)c.font=`700 ${--size}px sans-serif`;c.fillText(text,256,64);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=THREE.LinearFilter;
  return new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
 }
 function wallDistance(x,z,w){const dx=w.x2-w.x1,dz=w.z2-w.z1,q=dx*dx+dz*dz,t=q?Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/q)):0;return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);}
 function clear(x,z,pad=.85){return !(W.colliders||[]).some(c=>Math.hypot(x-c.x,z-c.z)<c.r+pad)&&!(W.walls||[]).some(w=>wallDistance(x,z,w)<pad)&&!G.worldPkg?.lockedAt?.(x,z);}
 function safePoint(base){
  const guess=G.worldPkg?.findClear?.(base[0],base[1],.85,6)||base;
  if(Math.hypot(guess[0]-base[0],guess[1]-base[1])<5&&clear(...guess))return guess;
  for(let r=0;r<=3;r+=.5)for(let k=0;k<16;k++){const a=k*Math.PI/8,x=base[0]+Math.cos(a)*r,z=base[1]+Math.sin(a)*r;if(clear(x,z))return [x,z];}
  return null;
 }
 function clearRetreatSegment(a,b){
  const n=Math.max(1,Math.ceil(dist(a,b)/.4));
  for(let i=0;i<=n;i++){const f=i/n,p={x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f};if(!insideRescueRetreat(p,active.path[3])||!clear(p.x,p.z,1))return false;}
  return true;
 }
 const inputPaused=()=>!!G.input?.blocked?.()||document.hidden||!!G.cam?.isFree?.()||document.body.classList.contains('freecam')||document.body.classList.contains('posing');
 function interaction(){return active?.stage==='calm'&&horse?rescueInteraction({distance:dist(player.pos,horse.pos),speed:player.speed||0,retreating:!!active.retreat,
  settling:active.settling,blocked:inputPaused()}):null;}
 function startRetreat(){
  const A=active;A.spookArmed=false;A.calm=Math.max(0,A.calm-35);A.settling=RESCUE_APPROACH.settleSeconds;
  const destination=rescueRetreatCandidates(horse.pos,player.pos,A.path[3]).find(p=>clearRetreatSegment(horse.pos,p));
  if(destination){A.retreat={...destination,time:0};A.cue='Clover startled and stepped away. Slow down and give her room.';}
  else A.cue='Clover is nervous. Slow down and give her room to settle.';
 }
 function tickRetreat(dt){
  const A=active,goal=A.retreat;if(!goal)return 0;
  goal.time+=dt;
  if(dist(horse.pos,goal)<.8||goal.time>3){A.retreat=null;A.settling=RESCUE_APPROACH.settleSeconds;return 0;}
  const desired=Math.atan2(goal.x-horse.pos.x,goal.z-horse.pos.z),turn=Math.atan2(Math.sin(desired-horse.heading),Math.cos(desired-horse.heading));
  // Turn before stepping: the source horse may initially face the pasture fence.
  if(Math.abs(turn)>.5){horse.heading+=Math.sign(turn)*Math.min(Math.abs(turn),dt*3);return 0;}
  const before={x:horse.pos.x,z:horse.pos.z};
  W.steer(horse,goal.x,goal.z,dt,RESCUE_APPROACH.retreatSpeed,{stop:.8,base:2.2,gain:.5,turn:8,pad:1});
  if(!clearRetreatSegment(before,horse.pos)){
   horse.pos.x=before.x;horse.pos.z=before.z;A.retreat=null;A.settling=RESCUE_APPROACH.settleSeconds;return 0;
  }
  return dist(before,horse.pos)/dt;
 }
 const mapMark={x:0,z:0,glyph:'♡',label:'Clover rescue',kind:'rescue',hidden:()=>!active};
 const miniMark={x:0,z:0,col:'#79dec2',r:4,hidden:()=>!active};
 W.mapMarkers.push(mapMark);W.miniMarkers.push(miniMark);
 function blocked(){
  if(G.course.get())return 'Finish or leave your event before rescuing Clover.';
  if(G.roundup?.state?.().active||G.$('roundHud')?.style.display==='block')return 'Finish your roundup before starting a rescue.';
  if(G.course.drillActive?.())return 'Finish your training drill before starting a rescue.';
  if(G.trail?.ride)return 'Finish or leave your trail ride first.';
  if(G.onFoot?.on)return 'Get back on your horse before starting the rescue.';
  if(player.flying||(player.y||0)>.2)return 'Land before starting the rescue.';
  if(G.worldPkg?.vehicle?.())return 'Finish your ferry or balloon trip first.';
  const rig=H.RIG?.(),motion=rig?.heroMotion?.state,footAction=G.onFoot?.state?.()?.horse;
  if(!rig?.ready||rig.loadingBreed)return 'Your horse is still getting ready.';
  if(document.body.classList.contains('posing')||rig?.emote||motion?.action||motion?.transitioning||footAction?.action||footAction?.pending||footAction?.departure)return 'Finish your horse’s action before starting the rescue.';
  return '';
 }
 function dispose(){
  if(horse){
   // Remove first: pending breed loads check group.parent before attaching a rig.
   G.scene.remove(horse.parts.group);G.ranchSys?.disposeHorseEnt?.(horse);
   for(const geometry of horse.ownedGeometry)geometry.dispose();
   for(const material of horse.ownedMaterial)material.dispose();
   horse.label?.material?.map?.dispose();horse.label?.material?.dispose();horse=null;
  }
  if(worldGroup){G.scene.remove(worldGroup);const mats=new Set();worldGroup.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});for(const m of mats){m.map?.dispose();m.dispose();}}
  worldGroup=null;marker=null;prints=[];
 }
 function build(){
  worldGroup=new THREE.Group();worldGroup.name='Clover rescue trail';G.scene.add(worldGroup);
  const mat=new THREE.MeshBasicMaterial({color:0x5fe3be,transparent:true,opacity:.78,depthWrite:false});
  marker=new THREE.Group();worldGroup.add(marker);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.9,.09,6,44),mat);ring.rotation.x=Math.PI/2;ring.position.y=.16;marker.add(ring);
  const tag=nameplate('Clover’s trail');tag.position.y=2.1;tag.scale.set(3.2,.8,1);marker.add(tag);marker.userData.label=tag;
  const printMat=new THREE.MeshBasicMaterial({color:0xbfe4c5,transparent:true,opacity:.8,depthWrite:false});
  const route=active.path.slice(0,4);
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],len=dist(a,b),steps=Math.max(1,Math.floor(len/6)),heading=Math.atan2(b.x-a.x,b.z-a.z);
   for(let k=1;k<=steps;k++)for(const side of [-1,1]){
    const f=k/steps,x=a.x+(b.x-a.x)*f+Math.cos(heading)*side*.35,z=a.z+(b.z-a.z)*f-Math.sin(heading)*side*.35;
    const m=new THREE.Mesh(new THREE.TorusGeometry(.19,.055,5,12,Math.PI*1.4),printMat);m.rotation.set(-Math.PI/2,0,heading);m.position.set(x,W.groundH(x,z)+.1,z);m.userData.leg=i;worldGroup.add(m);prints.push(m);
   }
  }
  const at=active.path[3],parts=H.makeHorse({colors,seed:6,breed:'pinto'});
  // Capture procedural resources before a rig adds shared model geometry. SphereGeometry
  // comes from makeHorse's shared SPH primitive; coats and mane materials are cached too.
  const ownedGeometry=new Set(),ownedMaterial=new Set([parts.shadowM.material]);
  parts.group.traverse(o=>{if(o.isMesh&&o.geometry.type!=='SphereGeometry')ownedGeometry.add(o.geometry);});
  for(const leg of parts.legs)for(const mesh of leg.knee.children)if(mesh.geometry?.type==='CylinderGeometry'&&mesh.geometry.parameters?.radialSegments===10)ownedMaterial.add(mesh.material);
  horse={parts,ownedGeometry,ownedMaterial,pos:new THREE.Vector3(at.x,0,at.z),heading:Math.PI,phase:0,rest:1};
  horse.label=nameplate('Clover');horse.label.position.y=2.7;horse.label.scale.set(1.8,.55,1);parts.group.add(horse.label);
  parts.group.name='Clover rescue horse';parts.group.position.set(at.x,W.groundH(at.x,at.z),at.z);G.scene.add(parts.group);
  H.dressWithRig(horse,parts,colors,{breed:'pinto'});
 }
 function start(){
  if(active)return false;
  const why=blocked();if(why){G.toast(why);return false;}
  const resolved=definition.route.map(safePoint);
  if(resolved.some(p=>!p)){G.toast('Clover’s trail is blocked. Clear the home pasture and try again.');return false;}
  dispose();G.riding?.releaseAll();G.hidePanels();
  const home=resolved[0];player.pos.set(home[0],0,home[1]);player.y=0;player.vy=0;player.speed=0;
  player.heading=Math.atan2(resolved[1][0]-home[0],resolved[1][1]-home[1]);W.pushOut?.(player,.75);
  active={runId:`clover-${Date.now().toString(36)}-${++serial}-${Math.random().toString(36).slice(2,7)}`,stage:'find',clues:0,elapsed:0,calm:0,returnStep:0,
   path:resolved.map((p,i)=>point(p,['Home pasture','Fresh hoofprints','Tracks by the fence','Clover','Pasture bend','Homeward trail','Bring Clover home'][i])),
   previous:{x:player.pos.x,z:player.pos.z},breadcrumbs:[],cue:'Follow the hoofprints along the pasture.',waiting:false,spooked:false,finished:false,
   retreat:null,settling:RESCUE_APPROACH.settleSeconds,spookArmed:true};
  lastResult=null;build();updateMarker();G.run('rescueStart',snapshot().active);return true;
 }
 function target(){if(!active)return null;return active.stage==='find'?active.path[active.clues+1]:active.stage==='calm'?{x:horse.pos.x,z:horse.pos.z,label:'Approach Clover gently'}:active.path[Math.min(6,4+active.returnStep)];}
 function updateMarker(){
  const at=target();if(!at||!marker)return;
  marker.position.set(at.x,W.groundH(at.x,at.z),at.z);mapMark.x=miniMark.x=at.x;mapMark.z=miniMark.z=at.z;
  const old=marker.userData.label;marker.remove(old);old.material?.map?.dispose();old.material?.dispose();
  const label=nameplate(at.label);label.position.y=2.1;label.scale.set(3.2,.8,1);marker.add(label);marker.userData.label=label;
  marker.visible=active.stage!=='calm';
  for(const p of prints)p.visible=active.stage==='find'&&p.userData.leg===active.clues+1;
 }
 function cancel(reason='Rescue paused. Clover will be waiting when you try again.'){
  if(active?.finished){G.toast('Clover is home, but this rescue has not been saved. Keep this tab open and retry saving.');return false;}
  if(!active)return false;const previous=active;active=null;dispose();G.run('rescueCancel',{id:definition.id,runId:previous.runId,reason});return true;
 }
 function reassure(){
  const ready=interaction();if(!ready?.eligible)return false;
  const A=active;A.calm=100;A.stage='escort';A.spooked=false;A.retreat=null;
  A.breadcrumbs=[{x:player.pos.x,z:player.pos.z}];A.cue='She trusts you! Lead Clover home at a comfortable trot.';
  G.sChime?.();updateMarker();return true;
 }
 function finish(){
  if(!active||active.finished||!horse)return;
  active.completion=pendingRescueFinish(active,H.ridden?.()?.id);if(!active.completion)return;
  active.finished=true;active.waiting=false;updateMarker();retrySave();
 }
 function retrySave(){
  if(!active?.finished||!active.completion||inputPaused())return false;
  const outcome=saveRescueFinish(S,active.completion,(s,reward,horseId)=>{
   G.money.payReward(s,{c:reward.c});
   // A retry may follow a stable visit. XP belongs to the horse that brought Clover home.
   G.xp.applyXp(s,s.horses.find(h=>h.id===horseId),reward.xp);
  });
  if(!outcome.ok){active.cue='Clover is safely home, but your reward could not be saved. Keep this tab open and retry saving.';return false;}
  const result=outcome.result;
  mirrorRescueHorseXp(H.myHorses,outcome.saved,active.completion.horseId);
  active=null;dispose();refresh(outcome.saved);
  G.money.refreshWallet();G.sChime?.();lastResult=Object.freeze(result);G.run('rescueFinish',result);return true;
 }
 function adopt(){
  const pending=adoptionPending||(adoptionPending={horseId:null,notices:[]});
  const outcome=saveCloverAdoption(S,pending,s=>{
   // Acquisition hooks still populate the real horse. Clover already has a name;
   // defer synchronous mastery notices until storage confirms the acquisition.
   // This scoped replacement is restored before any event-loop task can run.
   const toast=G.toast;pending.notices=[];G.toast=(...args)=>pending.notices.push(args);
   try{return H.grantHorse(s,'pinto',{name:'Clover',noName:true,colors:{...colors},bond:35,src:'rescue',stats:{speed:4,stamina:5,jump:4,accel:4,agility:5},extra:{rescueClover:true,sex:'f'}});}
   finally{G.toast=toast;}
  });
  if(!outcome.ok){if(outcome.attempted)G.toast('Clover’s adoption could not be saved. Keep this tab open and try welcoming her again.');else{adoptionPending=null;refresh();}return false;}
  adoptionPending=null;refresh(outcome.saved);H.reloadHorses();for(const args of pending.notices)G.toast(...args);G.sChime?.();G.toast('Clover has joined your stable.');G.run('rescueAdopt',{id:outcome.horse.id,name:outcome.horse.name});return true;
 }
 function animate(movement,dt,t){
  horse.phase+=dt*(movement>5?6:movement>.2?3:1.2);
  const gait=movement>8?'canter':movement>3.5?'trot':'walk',amp=movement>.2?.6:.04,calm=movement>.2?0:1;
  G.anim?.animateHorse(horse.parts,horse.phase,amp,G.anim.GAITS[gait]||G.anim.GAITS.walk,true,t,calm,dt);
  H.dressWithRig(horse,horse.parts,colors,{breed:'pinto'});G.anim?.tickRig(horse,movement,dt,t,calm);
  horse.parts.group.position.set(horse.pos.x,W.groundH(horse.pos.x,horse.pos.z),horse.pos.z);horse.parts.group.rotation.y=horse.heading;
 }
 G.on('tick',(rawDt,t)=>{
  if(!active||!horse)return;const dt=Math.min(.1,Math.max(0,rawDt||0));if(!dt)return;
  if(active.finished){if(!inputPaused())animate(0,dt,t);return;}
  const A=active,step=dist(player.pos,A.previous);A.previous={x:player.pos.x,z:player.pos.z};
  if(isTravelJump(step,rawDt,player.speed)){cancel('Fast travel ends the rescue. Start again to follow Clover’s trail.');return;}
  if(G.course.get()||G.trail?.ride||G.worldPkg?.vehicle?.()||G.roundup?.state?.().active||G.course.drillActive?.()||player.flying){cancel('Rescue ended when you started another activity.');return;}
  if(inputPaused())return;
  A.elapsed+=dt;let movement=0;const distance=dist(player.pos,horse.pos),speed=Math.abs(player.speed||0);A.spooked=distance<RESCUE_APPROACH.spookDistance&&speed>RESCUE_APPROACH.spookSpeed;
  if(A.stage==='find'){
   if(dist(player.pos,target())<3.5){A.clues++;G.sCoin?.();A.cue=A.clues<2?'Fresh tracks! Follow them toward the south fence.':'Clover is just ahead. Slow down and approach gently.';
    if(A.clues===2)A.stage='calm';updateMarker();}
  }else if(A.stage==='calm'){
   if(speed<RESCUE_APPROACH.stopSpeed||distance>12)A.spookArmed=true;
   if(A.spooked&&A.spookArmed&&!A.retreat)startRetreat();
   movement=tickRetreat(dt);A.spooked=A.spooked||!!A.retreat;
   if(A.retreat||distance<RESCUE_APPROACH.spookDistance&&speed>=RESCUE_APPROACH.stopSpeed)A.settling=RESCUE_APPROACH.settleSeconds;
   else A.settling=Math.max(0,A.settling-dt);
   A.calm=calmAfter(A.calm,{distance,speed:A.retreat?RESCUE_APPROACH.spookSpeed+1:speed,dt});
   if(!A.retreat&&distance<RESCUE_APPROACH.reach&&speed<RESCUE_APPROACH.stopSpeed){
    const desired=Math.atan2(player.pos.x-horse.pos.x,player.pos.z-horse.pos.z),turn=Math.atan2(Math.sin(desired-horse.heading),Math.cos(desired-horse.heading));horse.heading+=turn*Math.min(1,dt*2);
   }
   A.cue=interaction().reason;
   mapMark.x=miniMark.x=horse.pos.x;mapMark.z=miniMark.z=horse.pos.z;
  }else if(A.stage==='escort'){
   A.waiting=distance>28;
   const last=A.breadcrumbs.at(-1);if(!last||dist(last,player.pos)>1.5)A.breadcrumbs.push({x:player.pos.x,z:player.pos.z});
   // Follow the actual ridden line, not a shortcut through the pasture fence.
   while(A.breadcrumbs.length>1&&dist(horse.pos,A.breadcrumbs[0])<1.8)A.breadcrumbs.shift();
   if(A.breadcrumbs.length>300){cancel('Clover lost the trail. Start the rescue again.');return;}
   const lead=A.breadcrumbs[0];if(!A.waiting&&lead&&distance>3)movement=W.steer(horse,lead.x,lead.z,dt,12,{stop:.8,base:2.5,gain:1.2,turn:5,pad:.65});
   A.cue=A.waiting?'Clover is waiting. Ride back toward her.':distance>13?'Ease up — give Clover time to catch you.':'Stay together and follow the homeward trail.';
   const at=target();if(dist(player.pos,at)<6&&dist(horse.pos,at)<7&&distance<10){A.returnStep++;G.sCoin?.();if(A.returnStep===3){finish();return;}updateMarker();}
  }
  if(horse)animate(movement,dt,t);
 });
 function snapshot(){
  const A=active;return {definition,records:{...records},lastResult,
   active:A?{id:definition.id,runId:A.runId,name:definition.name,stage:A.stage,savePending:!!A.finished,clues:A.clues,totalClues:2,target:{...target()},
    horse:{x:horse.pos.x,z:horse.pos.z,distance:dist(player.pos,horse.pos),calm:A.calm,waiting:A.waiting,spooked:A.spooked,retreating:!!A.retreat,settling:Math.max(0,A.settling)},interaction:interaction(),elapsed:Math.round(A.elapsed*100)/100,
    returnStep:A.returnStep,totalReturnSteps:3,cue:A.cue}:null};
 }
 const adoptedRiding=createAdoptedRescueMount(G,{active:()=>!!active,adoptionPending:()=>!!adoptionPending});
 G.rescueRide={definition,start,cancel,snapshot,reassure,retrySave,adopt,...adoptedRiding,pendingHorseId:()=>active?.finished?active.completion?.horseId??null:null};G.on('state',s=>{s.rescueRide=snapshot();});
}
