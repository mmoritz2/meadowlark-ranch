import {TACK_SUMMON_COST,getTackSummonPool} from '../tack-summon.mjs?v=tack-ceremony-20261007';
import {TACK_SLOTS,TACK_SLOT_LABELS} from '../tack-collection.mjs?v=tack-ceremony-20261007';
import {createTackSummonShowcase} from '../tack-summon-showcase.js?v=tack-ceremony-20261007';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const TACK_STALL_ARRIVAL=Object.freeze({x:-27.5,z:-8.2,heading:0});
export function installTackSummonCeremony(G,{summon,equip,horseOf,rewardOf,onReturn,getSlot,setSlot,setHorseId,canFit}){
 const T=G.THREE,H=G.horse,W=G.world,stall=G.summon?.state;
 const state={active:false,phase:'idle',t:0,result:null,snapshot:null,reduced:false,shown:false,error:''};
 let stage=null,ring=null,particles=null,showcase=null,dialog=document.createElement('section');
 dialog.id='tackStallDialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Tack at the Summoning Stall');dialog.setAttribute('aria-modal','true');dialog.hidden=true;document.body.appendChild(dialog);
 const entry=['Summoning Stall',TACK_STALL_ARRIVAL.x,TACK_STALL_ARRIVAL.z,TACK_STALL_ARRIVAL.heading];
 W.addFT?.(entry);const travelIndex=()=>G.tables?.FT?.findIndex(f=>f===entry||f[0]===entry[0])??-1;
 const player=()=>H.player;
 const readSave=()=>{try{return G.save.fresh();}catch{return null;}};
 function gate(){
  if(!readSave())return 'Your ranch save could not be read. Please try again.';
  if(stall?.on)return 'A horse is being summoned. Wait for the stall to finish.';
  if(G.renderer?.xr?.isPresenting)return 'Leave VR to watch this stall reveal.';
  if(G.course?.get?.()||G.course?.drillActive?.()||G.roundup?.state?.()?.on)return 'Finish your current event before visiting the stall.';
  if(G.worldPkg?.vehicle?.())return 'Finish your balloon or ferry ride first.';
  if(G.cam?.isFree?.())return 'Leave photo mode before visiting the stall.';
  const p=player(),foot=G.onFoot?.state?.();if(p?.flying||Math.abs(p?.y||0)>.15||foot?.air||foot?.climbing||foot?.rolling)return 'Land on the ground before visiting the stall.';
  if(!stall?.grp||!stall.doorL||!stall.doorR)return 'The stall is still loading. Try again in a moment.';
  return '';
 }
 const notify=message=>{G.toast?.(message);return {ok:false,code:'unavailable',message};};
 function resetInput(){G.input?.reset?.();G.riding?.releaseAll?.();}
 function buildStage(){
  if(stage)return;stage=new T.Group();stage.name='Tack reveal | moonlit dais';stage.visible=false;stall.grp.add(stage);
  const metal=new T.MeshStandardMaterial({color:'#9faebf',metalness:.7,roughness:.32}),inlay=new T.MeshStandardMaterial({color:'#293c57',metalness:.3,roughness:.48});
  for(const [r,h,y,mat]of[[1.07,.09,.05,metal],[.98,.07,.12,inlay]]){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,64),mat);m.position.set(0,y,2.7);m.receiveShadow=true;stage.add(m);}
  ring=new T.Mesh(new T.TorusGeometry(.91,.017,6,64),new T.MeshBasicMaterial({color:'#b7f2df',transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false}));ring.position.set(0,1.78,2.63);stage.add(ring);
  const p=new Float32Array(32*3);for(let i=0;i<32;i++){const a=i/32*Math.PI*2;p[i*3]=Math.cos(a)*(1.05+(i%3)*.09);p[i*3+1]=1.7+Math.sin(a)*1.1;p[i*3+2]=2.65+(i%4)*.055;}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(p,3));particles=new T.Points(geometry,new T.PointsMaterial({color:'#dfcdfa',size:.045,transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false}));stage.add(particles);
 }
 function capture(){
  const p=player(),walker=G.onFoot?.walker?.();return {position:p.pos.clone(),heading:p.heading,y:p.y,vy:p.vy,mesh:p.mesh,meshVisible:p.mesh?.visible,walker,walkerVisible:walker?.visible,camera:G.camera.position.clone(),quaternion:G.camera.quaternion.clone(),fov:G.camera.fov,doors:[stall.doorL.rotation.y,stall.doorR.rotation.y],glowOpacity:stall.glow?.material.opacity,glowColor:stall.glow?.material.color.clone(),lightIntensity:stall.light?.intensity,lightColor:stall.light?.color.clone(),focus:document.activeElement};
 }
 function hideActors(){const s=state.snapshot;if(s.mesh)s.mesh.visible=false;if(s.walker)s.walker.visible=false;}
 function showDialog(){dialog.hidden=false;paint();}
 function paint(){
  const s=readSave()||{horses:[],tack:[],coins:0},slot=getSlot(),pool=getTackSummonPool(s,slot),h=horseOf(s);
  if(state.phase==='choosing')dialog.innerHTML=`<div class="tw-heading"><div><p>THE SUMMONING STALL</p><h2>Call forth your next look</h2></div><button type="button" data-tw-close aria-label="Leave tack stall">×</button></div><div class="tw-choose"><label>Choose your tack<select data-tw-slot aria-label="Stall tack category"><option value="all" ${slot==='all'?'selected':''}>All tack</option>${TACK_SLOTS.map(x=>`<option value="${x}" ${x===slot?'selected':''}>${TACK_SLOT_LABELS[x]}</option>`).join('')}</select></label><button type="button" class="tw-primary" data-tw-summon ${!pool.length||(s.coins||0)<TACK_SUMMON_COST?'disabled':''}>Summon tack · ${TACK_SUMMON_COST} coins</button></div><p class="tw-odds">${pool.length?`${pool.length} unowned pieces · equal odds, 1 in ${pool.length} each · no duplicates.`:'All pieces in this category collected. No coins will be spent.'} Paid sets are separate.</p><p class="tw-status" role="status">${esc(state.error)||`${Math.floor(s.coins||0).toLocaleString()} earned coins available`}</p>`;
  else if(state.phase==='charging')dialog.innerHTML='<div class="tw-charging"><div><p>THE STALL IS ANSWERING</p><h2>Something beautiful is taking shape…</h2></div><button type="button" data-tw-skip>Skip reveal</button></div>';
  else if(state.phase==='revealed'){
   const p=state.result?.piece||rewardOf(s),item=state.result?.item,wearing=h?.gear?.[p.slot]===item?.id&&!(p.slot==='saddle'&&h.bareback),horses=(s.horses||[]).filter(canFit);
   dialog.innerHTML=`<div class="tw-heading"><div><p>NEW TACK · SAVED TO YOUR LOCKER</p><h2 tabindex="-1" data-tw-title>${esc(p.name)}</h2></div><button type="button" data-tw-close aria-label="Return to ranch">×</button></div><div class="tw-reward-actions"><label>Equip on<select data-tw-horse aria-label="Horse for revealed tack">${horses.length?horses.map(x=>`<option value="${esc(x.id)}" ${x===h?'selected':''}>${esc(x.name||'Horse')}</option>`).join(''):'<option>No adult horses</option>'}</select></label><button type="button" class="tw-primary" data-tw-equip ${!h||wearing?'disabled':''}>${wearing?'Equipped on '+esc(h.name):'Equip tack'}</button><button type="button" data-tw-close>Back to ranch</button></div><p class="tw-status" role="status">${esc(state.error)||'One new piece · 200 earned coins · yours to keep.'}</p>`;
  }
 }
 function open(){
  if(state.active)return {ok:false,code:'busy'};const why=gate();if(why)return notify(why);
  const p=player();if(Math.hypot(p.pos.x-G.summon.STALL.x,p.pos.z-G.summon.STALL.z)>6)return notify('Visit the Summoning Stall west of the barn first.');
  G.hidePanels?.();G.seHud?.close?.(false);resetInput();
  state.snapshot=capture();state.active=true;state.phase='choosing';state.t=0;state.result=null;state.shown=false;state.error='';state.reduced=!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  G.riding?.lock?.('tack-ceremony',true);document.body.classList.add('tack-summoning');hideActors();buildStage();stage.visible=true;ring.visible=false;particles.visible=false;showDialog();dialog.querySelector('[data-tw-slot]')?.focus({preventScroll:true});return {ok:true,code:'opened'};
 }
 function visit(){if(state.active)return {ok:false,code:'busy'};const why=gate();if(why)return notify(why);G.hidePanels?.();G.seHud?.close?.(false);if(Math.hypot(player().pos.x-G.summon.STALL.x,player().pos.z-G.summon.STALL.z)>6){if(typeof W.travelTo!=='function'||!W.travelTo(travelIndex()))return {ok:false,code:'travel-blocked'};}return open();}
 function start(){
  if(!state.active||state.phase!=='choosing')return {ok:false,code:'busy'};const why=gate();if(why){state.error=why;paint();return {ok:false,code:'unavailable'};}
  const result=summon();if(!result.ok){state.error=result.message||'The call could not be saved. No new tack was granted.';paint();return result;}
  state.result=result;state.phase='charging';state.t=0;state.error='';
  try{showcase=createTackSummonShowcase({THREE:T},result.piece);showcase.root.name='Summoned '+result.piece.name;showcase.root.position.set(0,2.05,2.7);showcase.root.visible=false;stage.add(showcase.root);}catch(e){state.error='Your tack is saved. The 3D display could not load.';}
  ring.material.color.set(result.piece.design.accent);particles.material.color.set(result.piece.design.accent);ring.visible=true;particles.visible=!state.reduced;paint();return result;
 }
 function reveal(){if(!state.active||!state.result)return;state.phase='revealed';state.shown=true;state.t=Math.max(state.t,4.7);paint();dialog.querySelector('[data-tw-title]')?.focus({preventScroll:true});G.sGem?.();}
 function skip(){if(state.phase==='charging'){reveal();return true;}if(state.active){close();return true;}return false;}
 function close(){
  if(!state.active)return false;const s=state.snapshot;state.active=false;state.phase='idle';dialog.hidden=true;
  if(stage)stage.visible=false;if(showcase){showcase.root.removeFromParent();showcase.dispose();showcase=null;}
  const p=player();p.pos.copy(s.position);p.heading=s.heading;p.y=s.y;p.vy=s.vy;p.speed=0;
  if(s.mesh)s.mesh.visible=s.meshVisible;if(s.walker)s.walker.visible=s.walkerVisible;
  stall.doorL.rotation.y=s.doors[0];stall.doorR.rotation.y=s.doors[1];
  if(stall.glow){stall.glow.material.opacity=s.glowOpacity;stall.glow.material.color.copy(s.glowColor);}if(stall.light){stall.light.intensity=s.lightIntensity;stall.light.color.copy(s.lightColor);}
  G.camera.position.copy(s.camera);G.camera.quaternion.copy(s.quaternion);G.camera.fov=s.fov;G.camera.updateProjectionMatrix();
  resetInput();G.riding?.lock?.('tack-ceremony',false);document.body.classList.remove('tack-summoning');document.dispatchEvent(new Event('game-input-change'));G.followCam?.reset?.();onReturn?.();if(s.focus?.isConnected&&s.focus.getClientRects?.().length)s.focus.focus?.({preventScroll:true});else G.renderer?.domElement?.focus?.({preventScroll:true});return true;
 }
 function tick(dt){
  if(!state.active)return;hideActors();const p=player();p.pos.copy(state.snapshot.position);p.speed=0;p.y=state.snapshot.y;p.vy=0;
  if(state.phase==='choosing')return;state.t+=Math.min(.1,Math.max(0,dt||0))*(state.reduced?4:1);
  const t=state.t,open=Math.max(0,Math.min(1,(t-2.25)/1.05)),charge=Math.min(1,t/2.25);
  stall.doorL.rotation.y=state.snapshot.doors[0]+open*1.42;stall.doorR.rotation.y=state.snapshot.doors[1]-open*1.42;
  if(stall.glow){stall.glow.material.color.set(state.result.piece.design.accent);stall.glow.material.opacity=.1+charge*.38*(1-open)+open*.07;}
  if(stall.light){stall.light.color.set(state.result.piece.design.accent);stall.light.intensity=charge*(1-open)*7+open*2;}
  ring.scale.setScalar(Math.max(.01,open));ring.rotation.z=state.reduced?0:t*.12;ring.material.opacity=.3+open*.35;particles.rotation.z=state.reduced?0:-t*.045;
  if(showcase){showcase.root.visible=t>3.15;const scale=Math.max(.001,Math.min(1,(t-3.15)/.9));showcase.root.scale.setScalar(scale*.76);showcase.root.position.y=2.05+(state.reduced?0:Math.sin(t*1.5)*.045);const angle=state.result.piece.slot==='saddle'?-.75:-.28;showcase.root.rotation.y=angle+(state.reduced?0:Math.sin((t-4.2)*.16)*.20);}
  if(t>4.5&&!state.shown)reveal();
 }
 function camera(dt,_t,camLook){
  if(!state.active)return false;hideActors();const progress=state.phase==='choosing'?0:Math.min(1,state.t/4.5),goal=new T.Vector3(2.3-progress*.35,2.9,8.6-progress*2.1),look=new T.Vector3(0,2.0,2.6);stall.grp.localToWorld(goal);stall.grp.localToWorld(look);
  const k=state.reduced?1:1-Math.exp(-4*Math.min(.1,Math.max(.001,dt||0)));G.camera.position.lerp(goal,k);camLook?.lerp(look,k);G.camera.lookAt(look);G.camera.fov=44;G.camera.updateProjectionMatrix();return true;
 }
 dialog.addEventListener('change',e=>{if('twSlot'in e.target.dataset){setSlot(e.target.value);paint();dialog.querySelector('[data-tw-slot]')?.focus({preventScroll:true});}else if('twHorse'in e.target.dataset){setHorseId(e.target.value);paint();}});
 dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if('twSummon'in d)start();else if('twSkip'in d)skip();else if('twClose'in d)close();else if('twEquip'in d){const r=equip();state.error=r.ok?'Tack equipped. Your horse will be wearing it when you return.':'Your tack could not be equipped. Please try again.';paint();}});
 // The small world dialog owns controls while the scenery remains visible.
 document.addEventListener('keydown',e=>{if(!state.active)return;if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();skip();return;}e.stopImmediatePropagation();if(e.code==='Tab'){const fields=[...dialog.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]')];const i=fields.indexOf(document.activeElement),next=e.shiftKey?(i<=0?fields.length-1:i-1):(i<0||i===fields.length-1?0:i+1);e.preventDefault();fields[next]?.focus();}else if(!e.target?.matches?.('button,input,select,textarea'))e.preventDefault();},true);
 G.on('tick',tick);G.on('ride',r=>{if(state.active){r.target=0;r.noJump=true;}});G.on('escape',()=>state.active?skip():false);G.on('travelGate',()=>state.active?true:undefined);
 return {get active(){return state.active;},open,visit,start,skip,close,camera,tick,state,dialog};
}
