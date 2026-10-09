import {POST_DEFINITION,isSoloPostRide,createPostRun,createPostGuide,advancePostGuide,postDistance,postInteraction,observePostRun,actOnPostRun,postFinishProof,sanitizePostSave,savePostFinish} from './cottonwood-post-rules.mjs?v=cottonwood-post-1';
import {COTTONWOOD_ROUTES} from '../cottonwood-routes.mjs?v=cottonwood-post-1';
export const id='cottonwood-post';
export function install(G){
 if(G.cottonwoodPost)return;
 const S=G.save,W=G.world,H=G.horse,P=H.player,T=G.THREE,D=POST_DEFINITION;
 let active=null,records=sanitizePostSave(S.fresh()?.cottonwoodPost),lastResult=null,serial=0,art=null;
 // Collision-surveyed roads lead through the open arena gate, never across its rail.
 const pins=(points,labels)=>points.map(([x,z],i)=>({x,z,label:labels[i],radius:z===-22?1.2:x===-3&&z===-16?2:3}));
 const guides={
  pines:pins(COTTONWOOD_ROUTES.out,['North gate approach','North gate','Outside the north gate','Meadow road','Pines turn','Pines trail','Hollowpeak Pines']),
  road:pins(COTTONWOOD_ROUTES.road,['Pines trail','Meadow road','Cottonwood turn','Cottonwood Village','Ada’s post stop']),
  woodland:pins(COTTONWOOD_ROUTES.woodland,['Pines trail','Woodland turn','Woodland trail','Low log approach','Jump the low log','Cottonwood trail','Village entrance','Ada’s post stop']),
  return:pins(COTTONWOOD_ROUTES.home,['Cottonwood Village','Meadow road','Home Ranch turn','North gate approach','North gate','Inside the north gate','Wren’s post stop'])
 };
 S.ensure(s=>{s.cottonwoodPost=sanitizePostSave(s.cottonwoodPost);});
 const paused=()=>!!G.input?.blocked?.()||!!G.photoPause||!!G.cam?.isFree?.()||document.hidden||document.body.classList.contains('freecam')||document.body.classList.contains('posing');
 function ridingReady(){const rig=H.RIG?.(),motion=rig?.heroMotion?.state;
  return !P.onFoot&&!G.onFoot?.on&&!P.flying&&!G.worldPkg?.vehicle?.()&&!!rig?.ready&&!rig.loadingBreed&&!rig.emote&&!motion?.action;
 }
 function ready(){return ridingReady()&&!P.landing&&(P.y||0)<.15&&!H.RIG?.()?.heroMotion?.state?.transitioning;}
 function canJump(){const rig=H.RIG?.(),p=rig?.profile;
  if(p?.nativeBreed||p?.referenceMotion){const flight=!!p.nativeCanFly||!!((p.referenceMotion||p.nativeRoster)&&(rig.nativeCanFly||rig.nativeFantasy?.pair||rig.fantasyAppearance?.wings));return !!p.nativeJump&&!flight;}
  return true;
 }
 function npc(id,fallback){const n=W.npcList?.find(n=>n.def?.id===id),p=n?.g?.position||n?.def;return p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?{...fallback,x:p.x,z:p.z}:{...fallback};}
 function target(){
  if(active?.run.stage==='pines')return {...D.pines};
  if(active?.run.stage==='deliver')return npc('ada',{x:39,z:-39,label:'Ada · Cottonwood Village'});
  return npc('wren',{x:-11,z:-15.8,label:'Grandpa Wren · Home Ranch'});
 }
 function context(){if(!active)return null;return postInteraction(active.run,{distance:postDistance(P.pos,target()),speed:P.speed,blocked:paused(),ready:ready()});}
 function guideTarget(){return active?.guide?.points[active.guide.index]||target();}
 function resetGuide(){if(!active)return;active.guideStage=active.run.stage;active.guide=createPostGuide(guides[active.run.stage==='deliver'?active.route:active.run.stage]||[]);}
 function setRoute(route){
  if(!active||active.run.stage!=='deliver'||paused()||!ridingReady()||!['road','woodland'].includes(route)||!guides[route].length)return false;
  if(route==='woodland'&&!canJump()){G.toast('This mount cannot jump the woodland log. Take the clear Meadow road.');return false;}
  if(active.route===route)return true;active.route=route;resetGuide();updateArt();paint();G.run('postRoute',snapshot().active);return true;
 }
 function snapshot(){const A=active,i=context(),at=target(),woodlandAvailable=canJump(),woodlandCue=A?.run.stage==='deliver'&&!i?.inReach?(!woodlandAvailable?'Your mount cannot jump this log. Follow the clear Meadow road to Ada.':A.route==='woodland'?'Follow the woodland trail. Canter toward the low log; press Space or Jump before you reach it.':null):null;return {definition:D,records:{completions:records.completions,bestTime:records.bestTime},lastResult,
  active:A?{runId:A.run.runId,stage:A.run.stage,savePending:A.run.stage==='savePending',target:at,guide:{...guideTarget()},route:A.route,woodlandAvailable,elapsed:Math.round(A.run.elapsed*100)/100,
   distance:Math.round(A.run.distance*100)/100,carrying:A.run.picked&&!A.run.returned?(A.run.exchanged?'reply':'post'):null,
   horseId:A.run.horseId,horseName:A.run.horseName,interaction:i,cue:A.run.stage==='pines'||A.proof?A.cue:woodlandCue||i?.reason||A.cue||'',paused:paused()||!ridingReady()}:null};}
 const style=document.createElement('style');style.textContent=`
 #cottonwoodPostHud{position:fixed;left:18px;bottom:115px;z-index:8;width:min(352px,calc(100vw - 36px));box-sizing:border-box;background:#173e35f5;color:#fff9e9;border:1px solid #f6eac34d;border-radius:15px;padding:14px 16px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 10px 25px #142d2735;display:none}
 #cottonwoodPostHud *{box-sizing:border-box}#cottonwoodPostHud strong{display:block;font-size:18px;line-height:1.2;margin:5px 0 8px}#postEyebrow{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#dfd0a7}#postDetails{font-size:12px;color:#d9e7d2}#postCue{margin:8px 0 12px;min-height:2.8em}#postButtons,#postRoutes{display:flex;gap:8px}#postRoutes{margin:0 0 10px}#cottonwoodPostHud button{min-height:44px;border:1px solid #e1dfc575;border-radius:8px;padding:9px 12px;font:650 12px system-ui,sans-serif;background:#f2dfad;color:#263f32;cursor:pointer}#postRoutes button{flex:1;background:transparent;color:#fff9e9}#postRoutes button[aria-pressed="true"]{background:#f2dfad;color:#263f32}#postCancel{background:transparent!important;color:#fff9e9!important}#cottonwoodPostHud button:disabled{opacity:.55;cursor:default}#cottonwoodPostHud button:focus-visible{outline:3px solid #f1c978;outline-offset:3px}#cottonwoodPostHud [hidden]{display:none!important}
 body.post-active :is(#seGoal,#questTrack,#sgFocus,#seWay,#rushQuick){display:none!important}body.se-screen-open #cottonwoodPostHud,body.freecam #cottonwoodPostHud,body.posing #cottonwoodPostHud{display:none!important}
 @media(max-width:700px){#cottonwoodPostHud{left:14px;top:calc(134px + env(safe-area-inset-top));bottom:auto;width:min(352px,calc(100vw - 28px));padding:11px 13px}#postCue{margin:6px 0 8px;min-height:0}#cottonwoodPostHud strong{font-size:16px;margin:4px 0 6px}}
 @media(max-height:500px){#cottonwoodPostHud{top:calc(9px + env(safe-area-inset-top));bottom:auto;left:50%;transform:translateX(-50%);width:300px;padding:9px 11px}#cottonwoodPostHud strong{font-size:15px;margin:3px 0}#postCue{font-size:11px;margin:5px 0;min-height:0}#postDetails{font-size:10px}#postEyebrow{font-size:9px}}
 `;document.head.appendChild(style);
 const hud=document.createElement('section');hud.id='cottonwoodPostHud';hud.setAttribute('aria-label','Cottonwood delivery');hud.innerHTML='<div id="postEyebrow">Cottonwood Post Run</div><strong id="postTitle"></strong><div id="postDetails"></div><p id="postCue" role="status"></p><div id="postRoutes" role="group" aria-label="Route to Cottonwood"><button id="postRoad" type="button" aria-pressed="true">Meadow road</button><button id="postWoodland" type="button" aria-pressed="false">Woodland jump</button></div><div id="postButtons"><button id="postAction" type="button"></button><button id="postCancel" type="button">End ride</button></div>';document.body.appendChild(hud);
 const $=id=>document.getElementById(id),ui={title:$('postTitle'),details:$('postDetails'),cue:$('postCue'),action:$('postAction'),cancel:$('postCancel'),routes:$('postRoutes'),road:$('postRoad'),woodland:$('postWoodland')};
 const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 function paint(){const s=snapshot(),a=s.active;document.body.classList.toggle('post-active',!!a);hud.style.display=a||lastResult?'block':'none';if(!a&&!lastResult)return;
  hud.dataset.stage=a?.stage||'complete';
  ui.routes.hidden=a?.stage!=='deliver';ui.road.setAttribute('aria-pressed',String(a?.route==='road'));ui.woodland.setAttribute('aria-pressed',String(a?.route==='woodland'));ui.road.disabled=!!a?.paused;ui.woodland.disabled=!!a?.paused||!a?.woodlandAvailable;ui.woodland.title=a?.woodlandAvailable?'A shorter woodland path with one low log to jump.':'This mount cannot jump the log. The Meadow road is clear.';
  if(a){
   text(ui.title,{collect:'Collect Wren’s post',pines:'Ride through the pines',deliver:'Exchange the post with Ada',return:'Bring Ada’s reply home',savePending:'Your delivery is complete'}[a.stage]);
   const meters=Math.round(postDistance(P.pos,a.guide));text(ui.details,a.savePending?'Reward not yet confirmed':`${a.carrying==='reply'?'Reply aboard':a.carrying==='post'?'Post aboard':'Pouch waiting'} · ${meters} m to ${a.guide.label}`);
   text(ui.cue,a.savePending?active.cue||'Keep this tab open. Retry saving your completed delivery.':a.paused?'Mount up and return to riding to continue.':a.cue);
   ui.action.hidden=a.stage==='pines';ui.action.disabled=!a.interaction?.eligible;text(ui.action,a.interaction?.label||'Follow the trail');
   ui.cancel.disabled=a.savePending;ui.cancel.title=a.savePending?'Save your completed delivery before leaving.':'';text(ui.cancel,'End ride');
  }else{
   text(ui.title,'Post delivered. Reply home.');text(ui.details,`${lastResult.time.toFixed(1)} s · ${lastResult.newBest?'New personal best':'Delivery complete'}`);
   text(ui.cue,'Saved: 450 coins, 2 gems and 28 pass points. Wren sends his thanks.');ui.action.hidden=true;ui.cancel.disabled=false;ui.cancel.title='';text(ui.cancel,'Back to riding');
  }
 }
 // Pointer choices return movement keys to the world. Keyboard activation keeps
 // focus so Tab/Enter/Space navigation continues to work as a normal button group.
 const pointerAction=fn=>e=>{const result=fn();if(e?.detail>0)e.currentTarget.blur();return result;};
 ui.action.onclick=pointerAction(()=>active?.run.stage==='savePending'?retrySave():interact());
 ui.road.onclick=pointerAction(()=>setRoute('road'));ui.woodland.onclick=pointerAction(()=>setRoute('woodland'));
 ui.cancel.onclick=pointerAction(()=>{if(active)cancel();else{lastResult=null;paint();}});
 hud.addEventListener('keydown',e=>{if(e.target.closest('button')&&['Enter','Space'].includes(e.code))e.stopPropagation();});
 const map={x:0,z:0,glyph:'✉',label:D.name,kind:'post',hidden:()=>!active};
 const mini={x:0,z:0,col:'#ebd39c',r:4,hidden:()=>!active};W.mapMarkers?.push(map);W.miniMarkers?.push(mini);
 function makeArt(){
  disposeArt();const group=new T.Group();group.name='Cottonwood post delivery';
  const leather=new T.MeshStandardMaterial({color:0x95673f,roughness:.9}),paper=new T.MeshStandardMaterial({color:0xf3e4b9,roughness:.9}),trim=new T.MeshStandardMaterial({color:0x50371f,roughness:.9});
  const parcel=new T.Group();parcel.name='Courier post pouch';
  const box=(w,h,d,m,x=0,y=0,z=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;parcel.add(o);return o;};
  box(.36,.30,.18,leather);box(.375,.10,.20,leather,0,.11,.015);box(.06,.32,.195,trim);box(.13,.075,.008,paper,.105,.04,.108);
  group.add(parcel);const ring=new T.Mesh(new T.RingGeometry(D.reach-.10,D.reach,64),new T.MeshBasicMaterial({color:0xe9ca7e,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;group.add(ring);G.scene.add(group);
  const log=new T.Group();log.name='Cottonwood optional woodland log';
  const bark=new T.MeshStandardMaterial({color:0x72523b,roughness:1}),cut=new T.MeshStandardMaterial({color:0xc39b68,roughness:1});
  const crate=new T.Mesh(new T.BoxGeometry(.52,.42,.38),bark);crate.name='Wren’s post crate';crate.castShadow=true;crate.receiveShadow=true;group.add(crate);
  const strapGeometry=new T.BoxGeometry(.04,1,.018),straps=[-1,1].map(()=>{const strap=new T.Mesh(strapGeometry,trim);strap.name='Post pouch saddle strap';strap.castShadow=true;group.add(strap);return strap;});
  const timber=new T.Mesh(new T.CylinderGeometry(.25,.25,3.4,12,1,false),[bark,cut,cut]);timber.rotation.x=Math.PI/2;timber.position.y=.25;timber.castShadow=true;timber.receiveShadow=true;log.add(timber);
  for(const z of [-1.705,1.705])for(const radius of [.07,.135,.2]){const grain=new T.Mesh(new T.TorusGeometry(radius,.006,4,22),bark);grain.position.set(.008,.25,z);log.add(grain);}
  for(const angle of [.3,1.6,2.8,4.1,5.3]){const ridge=new T.Mesh(new T.CylinderGeometry(.007,.012,3.25,5),trim);ridge.rotation.x=Math.PI/2;ridge.position.set(Math.sin(angle)*.249,.25+Math.cos(angle)*.249,0);log.add(ridge);}
  const limb=new T.Mesh(new T.CylinderGeometry(.035,.07,.35,7),[bark,cut,cut]);limb.rotation.z=-Math.PI/3;limb.position.set(.25,.28,.7);limb.castShadow=true;log.add(limb);
  log.position.set(-7,W.groundH(-7,-53),-53);group.add(log);
  art={group,parcel,ring,log,crate,straps,wall:{x1:-7,z1:-54.7,x2:-7,z2:-51.3,courier:true},wallAdded:false,materials:[leather,paper,trim,ring.material,bark,cut],seat:new T.Vector3(),anchor:new T.Vector3(),end:new T.Vector3(),direction:new T.Vector3(),up:new T.Vector3(0,1,0)};updateArt();
 }
 function showLog(show){if(!art)return;art.log.visible=show;
  if(show&&!art.wallAdded&&W.walls){W.walls.push(art.wall);art.wallAdded=true;}
  else if(!show&&art.wallAdded){const index=W.walls.indexOf(art.wall);if(index>=0)W.walls.splice(index,1);art.wallAdded=false;}
 }
 function disposeArt(){if(!art)return;showLog(false);G.scene.remove(art.group);const geometries=new Set();art.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geometry of geometries)geometry.dispose();for(const m of art.materials)m.dispose();art=null;}
 function updateArt(){if(!art||!active)return;const at=target(),guide=guideTarget(),A=active.run,gy=W.groundH(at.x,at.z);map.x=mini.x=guide.x;map.z=mini.z=guide.z;art.ring.position.set(at.x,gy+.065,at.z);art.ring.visible=A.stage!=='savePending';
  showLog(A.stage==='deliver'&&active.route==='woodland');
  const arrow=G.trail.arrow;if(arrow){arrow.visible=A.stage!=='savePending';arrow.position.set(guide.x,W.groundH(guide.x,guide.z)+2.8,guide.z);}
  const carried=A.picked&&!A.returned;
  if(carried){const rig=H.RIG?.(),follower=rig?.nativeSeatFollower||rig?.nativeContacts?.seatFollower;
   if(!P.onFoot&&follower?.getWorldPosition){follower.getWorldPosition(art.seat);}
   else art.seat.set(P.pos.x,W.groundH(P.pos.x,P.pos.z)+(P.onFoot?1:1.7),P.pos.z);
   const heading=P.heading||0,c=Math.cos(heading),s=Math.sin(heading),shape=rig?.profile?.nativeVariant;
   // The pouch's thin side rests against the barrel; its long face follows the
   // horse. Two visible straps run back to the actual moving saddle contact.
   const lateral=P.onFoot?.26:Math.max(.26,Math.min(.52,.24*(shape?.sculptTargets?.barrel_width||1)*(shape?.actorScale||1)+.09));
   const fromSeat=(v,x,y,z)=>v.set(art.seat.x+c*x+s*z,art.seat.y+y,art.seat.z-s*x+c*z);
   fromSeat(art.parcel.position,lateral,-.27,-.36);art.parcel.rotation.y=heading+Math.PI/2;
   for(let i=0;i<art.straps.length;i++){const strap=art.straps[i],aft=-.36+(i===0?-.12:.12);fromSeat(art.anchor,lateral-.19,-.025,aft);fromSeat(art.end,lateral,-.12,aft);art.direction.copy(art.end).sub(art.anchor);strap.position.copy(art.anchor).add(art.end).multiplyScalar(.5);strap.scale.y=art.direction.length();strap.quaternion.setFromUnitVectors(art.up,art.direction.normalize());}
  }else{const w=npc('wren',{x:-11,z:-15.8}),ground=W.groundH(w.x+1,w.z);art.crate.position.set(w.x+1,ground+.21,w.z);art.parcel.position.set(w.x+1,ground+.57,w.z);art.parcel.rotation.y=0;}
  art.crate.visible=!carried&&A.stage!=='savePending';for(const strap of art.straps)strap.visible=carried&&A.stage!=='savePending';
  art.parcel.visible=A.stage!=='savePending';
 }
 function syncStage(){if(!active)return;if(active.guideStage!==active.run.stage)resetGuide();advancePostGuide(active.guide,P.pos,{paused:paused(),ready:ridingReady()});const r=active.ride;const old=r.idx;r.idx={collect:0,pines:1,deliver:2,return:3,savePending:4}[active.run.stage];r.t=active.run.elapsed;
  if(r.idx!==old&&r.idx<r.pts.length)G.run('trailStop',r,r.pts[Math.max(0,r.idx-1)]);
  updateArt();paint();
 }
 function clear(){active=null;disposeArt();if(G.trail.arrow)G.trail.arrow.visible=false;paint();}
 function cancel(){if(!active)return false;if(active.proof){G.toast('Retry saving your completed delivery before ending the ride.');return false;}return G.trail.stop?.()!==false;}
 function invalidate(reason){if(!active||active.proof)return;G.toast(reason);cancel();}
 function start(){const expedition=G.social?.EXPEDITIONS?.find(e=>e.id===D.id);if(!expedition)return false;
  return G.trail.start(expedition.stops.map(p=>p.slice()),G.net?.myName?.(),{exped:D.id,soloExpedition:true,name:D.name})===true;
 }
 function begin(r){
  if(r?.exped!==D.id||r.soloExpedition!==true||r.clubRideId)return;
  if(!isSoloPostRide(r)||active){G.toast('This delivery route is unavailable.');G.trail.stop?.();return;}
  if(G.course?.get?.()||G.course?.drillActive?.()){G.toast('Finish or leave your event before collecting the post.');G.trail.stop?.();return;}
  if(!ready()){G.toast('Mount your horse and let it get ready before starting the post ride.');G.trail.stop?.();return;}
  const horse=H.ridden?.(),run=createPostRun({id:Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,8),at:Date.now(),position:P.pos,horseId:horse?.id,horseName:horse?.name});
  if(!run){G.trail.stop?.();return;}
  r.managed=D.managed;active={ride:r,run,route:'road',guide:null,proof:null,confirmed:null,cue:'Ride to Wren, stop beside him, and collect the post.'};lastResult=null;makeArt();syncStage();G.run('postStart',snapshot().active);
 }
 function interact(){if(!active||G.trail.ride!==active.ride)return false;const i=context();if(!i?.eligible)return false;
  if(i.action==='save')return retrySave();
  if(!actOnPostRun(active.run,{distance:postDistance(P.pos,target()),speed:P.speed,blocked:paused(),ready:ready()}))return false;
  active.cue={pines:'The post is aboard. Ride toward Hollowpeak Pines, then on to Cottonwood.',return:'Ada’s reply is aboard. Ride back to Wren; stop beside him to hand it over.',savePending:'The reply is home. Saving your delivery…'}[active.run.stage]||'';
  if(active.run.stage==='savePending'){
   active.proof=postFinishProof(active.run);
   if(!active.proof){active.run.stage='return';active.run.returned=false;active.cue='Ride the full delivery route before handing over the reply.';syncStage();return false;}
  }
  G.sChime?.();syncStage();G.run('postProgress',snapshot().active);if(active?.proof)return retrySave();return true;
 }
 function retrySave(){
  if(!active?.proof||paused())return false;
  const A=active,out=savePostFinish(S,A.proof,(s,reward,points)=>{G.money.payReward(s,reward);G.xp.addSP(s,points,'trail');});
  if(!out.ok){A.cue=out.reason;paint();G.run('postSavePending',snapshot().active);return false;}
  A.confirmed=out.result;records=sanitizePostSave(out.saved.cottonwoodPost);
  if(!G.trail.finishManaged?.(A.ride)){A.cue='Your reward is saved. Retry to close the delivery.';paint();return false;}
  lastResult=Object.freeze(out.result);clear();G.money.refreshWallet();G.sGem?.();G.quest.dailyEvt('trail',1);G.quest.dailyEvt('exped',1);G.run('postFinish',lastResult);paint();return true;
 }
 G.on('trailStart',begin);
 G.on('trailTick',(r,dt)=>{
  if(r?.managed!==D.managed)return;
  if(!active||r!==active.ride)return true;
  if(active.proof){updateArt();paint();return true;}
  if(P.flying||G.worldPkg?.vehicle?.()){invalidate('The post ride ended when you started another journey. You can collect a fresh pouch from Wren.');return true;}
  const observed=observePostRun(active.run,{position:P.pos,dt,speed:P.speed,paused:paused(),ready:ridingReady()});
  if(observed.invalid){invalidate('The post ride ended after fast travel. Start again to ride the delivery route.');return true;}
  if(observed.changed){active.cue='The pines are behind you. Ride on to Ada in Cottonwood and stop to exchange the post.';G.sChime?.();}
  if(active.route==='woodland'&&!canJump()){active.route='road';resetGuide();G.toast('This mount cannot jump the log. Follow the Meadow road instead.');}
  syncStage();return true;
 });
 G.on('trailCancel',r=>{if(!active||r!==active.ride)return false;if(active.proof){G.toast('Retry saving your completed delivery first.');return true;}const runId=active.run.runId;clear();G.run('postCancel',{runId});return false;});
 G.on('trailFinishReady',r=>!!active&&r===active.ride&&r.managed===D.managed&&!!active.confirmed&&active.confirmed.runId===active.run.runId&&r.idx===r.pts.length);
 function gate(){if(!active)return;G.toast(active.proof?'Retry saving your completed delivery first.':'Finish or end your post ride before starting another activity.');return true;}
 G.on('activityGate',gate);G.on('travelGate',gate);
 G.on('tick',()=>{if(active&&!active.proof&&G.trail.ride!==active.ride)clear();});
 G.on('state',s=>{s.cottonwoodPost=snapshot();});
 G.cottonwoodPost={snapshot,context,start,interact,retrySave,cancel,setRoute};
}
