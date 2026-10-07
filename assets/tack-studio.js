import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createBreedLibrary} from './breed-models.js?v=native-tack-fit-1';
import {initGameHero,tickGameHero,startGameHeroJump,disposeMountedRig,getNativeHorseCapabilities,finishNativeHorseGrooms} from './game-hero-horse.js?v=native-tack-optional-20261007';
import {createTackCollection} from './tack-collection-models.js?v=native-tack-reins-20261007';
import {TACK_COLLECTIONS,TACK_PIECES,TACK_SLOTS,getTackPiece} from './tack-collection.mjs?v=native-tack-optional-20261007';
import {premiumTackSet} from './premium-tack.mjs';
import {registerRosterPreviews} from './features/horse-roster.js?v=native-tack-fit-1';
import {registerClubHorsePreviews} from './features/clubs-boards.js?v=native-tack-fit-1';
import {registerMarketHorsePreviews} from './features/market-summon-keys-pets.js?v=native-tack-fit-1';
import {registerNewBreedPreviews} from './features/new-breeds.js?v=native-tack-fit-1';
import {configureNativeCustomization} from './native-horse-customization.js?v=native-roster-1';

// Use exact public game profiles: the loader's permissive fallback is not a fitting-room option.
export const studioIsStaticHost=hostname=>hostname==='github.io'||hostname.endsWith('.github.io');
export const DEFAULT_STUDIO_HORSE='bay-sporthorse-native';
const ORIGINAL_HORSES=[DEFAULT_STUDIO_HORSE,'white-western','bay-western'];
const COLLECTION_HORSES={rainbow:'bay-sporthorse-native',starlight:'black',dragonfire:'bay-western',blossom:'grey',glacier:'white-western',forestguardian:'pinto'};
export function studioHorseOptions(manifest){
 return Object.entries(manifest?.breeds||{}).filter(([,p])=>p.nativeBreed&&p.nativeKind==='horse'&&!p.nativeDragon&&p.file).map(([key,p])=>({key,label:p.label||p.name||key,group:ORIGINAL_HORSES.includes(key)?'Original horses':(p.family==='fantasy'||p.nativeRosterAppearance?.coat||p.nativeRosterAppearance?.horn||p.nativeRosterAppearance?.wings)?'Fantasy horses':'Ranch breeds'})).sort((a,b)=>{
  const rank=k=>ORIGINAL_HORSES.includes(k)?ORIGINAL_HORSES.indexOf(k):3;
  return rank(a.key)-rank(b.key)||a.group.localeCompare(b.group)||a.label.localeCompare(b.label);
 });
}
export function studioInitialHorse(requested,collection,options){
 const supported=new Set(options.map(p=>p.key));
 if(requested&&supported.has(requested))return {key:requested,unavailable:false};
 const preferred=requested?DEFAULT_STUDIO_HORSE:COLLECTION_HORSES[collection]||DEFAULT_STUDIO_HORSE;
 return {key:supported.has(preferred)?preferred:DEFAULT_STUDIO_HORSE,unavailable:!!requested};
}
export function studioSupportsGait(name,cap){
 return name==='idle'||name==='walk'&&cap?.supportedModes?.includes('walk')||name==='gallop'&&cap?.canGallop||name==='jump'&&cap?.canJump;
}
export function studioGaitSpeed(name,cap){
 return name==='walk'?cap?.gaitSpeeds?.walk||0:name==='gallop'?cap?.gaitSpeeds?.gallopLeft||0:0;
}

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),capture=query.has('capture'),qa=query.has('qa');
const staticStore=studioIsStaticHost(location.hostname);
if(capture)document.body.classList.add('capture');
const library=createBreedLibrary({THREE,GLTFLoader,clone}),stage=$('stage');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:capture||qa});
renderer.setPixelRatio(capture?1:Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
renderer.domElement.setAttribute('aria-label','Your horse wearing the selected tack');stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#e5e8df');scene.fog=new THREE.Fog('#e5e8df',18,35);
// Large softboxes give polished metal and leather readable, soft reflections.
const reflectionRoom=new THREE.Scene();reflectionRoom.background=new THREE.Color('#979f98').multiplyScalar(.55);
const reflectionObjects=[];
for(const [x,y,z,w,h,color] of [[-4,4,2,4,5,'#fff4dc'],[4,3,-2,3,4,'#dce9ff'],[0,6,0,6,5,'#ffffff']]){
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));panel.material.color.multiplyScalar(.55);panel.position.set(x,y,z);panel.lookAt(0,1,0);reflectionRoom.add(panel);reflectionObjects.push(panel);
}
const pmrem=new THREE.PMREMGenerator(renderer),reflectionMap=pmrem.fromScene(reflectionRoom,.07);
scene.environment=reflectionMap.texture;
for(const panel of reflectionObjects){panel.geometry.dispose();panel.material.dispose();}pmrem.dispose();
const camera=new THREE.OrthographicCamera(-2,2,1.5,-1.5,.01,70),mount=new THREE.Group();scene.add(mount);
scene.add(new THREE.HemisphereLight(0xf2f5ff,0x69785b,2.05));
const key=new THREE.DirectionalLight(0xfff0d8,3);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-4,near:.1,far:20});key.shadow.bias=-.0001;key.shadow.normalBias=.013;scene.add(key);
const fill=new THREE.DirectionalLight(0xe1e9ff,1.6);fill.position.set(4,3,-2);scene.add(fill);
const rim=new THREE.DirectionalLight(0xfff3dc,.8);rim.position.set(-4,2,-2);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#d3dbc8',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const clock=new THREE.Clock(),baseBounds=new THREE.Box3(),size=new THREE.Vector3(),target=new THREE.Vector3();
const state={ready:false,error:null,horse:DEFAULT_STUDIO_HORSE,equipped:{},gait:'idle',focus:'horse',rig:null,kit:null};
const detailBounds=new THREE.Box3();
let serial=0,theta=1.03,zoom=1,drag=null,healthAge=0,auditing=false;
const labels={saddle:'Saddle',pad:'Saddle pad',bridle:'Bridle',shoes:'Legwear'};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let horseOptions=[],previewRows=new Map();
$('horse').disabled=true;
$('collection').add(new Option('Choose a collection',''));
for(const c of TACK_COLLECTIONS)$('collection').add(new Option(c.name,c.id));
$('piece-pickers').innerHTML=TACK_SLOTS.map(slot=>'<label class="piece-field" for="piece-'+slot+'"><span class="piece-meta"><span>'+labels[slot]+'</span><span class="piece-swatch" id="swatch-'+slot+'" aria-hidden="true"></span></span><select id="piece-'+slot+'"><option value="">No '+labels[slot].toLowerCase()+'</option>'+TACK_PIECES.filter(p=>p.slot===slot).map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select></label>').join('');

function paintInfo(){
 const pieces=TACK_SLOTS.map(slot=>state.equipped[slot]).filter(Boolean),sets=new Set(pieces.map(p=>p.collectionId)),single=sets.size===1?TACK_COLLECTIONS.find(c=>c.id===pieces[0].collectionId):null;
 $('look-name').textContent=single?single.name:pieces.length?'Your signature mix':'No tack equipped';
 $('look-description').textContent=single?single.description:pieces.length?'Different collections. One look that is yours.':'A bare horse. Choose a matching collection or add only the pieces you want.';
 $('collection').options[0].text=pieces.length?'Custom mix':'Choose a collection';
 $('collection').value=single?single.id:'';
 $('piece-count').textContent=pieces.length+' piece'+(pieces.length===1?'':'s')+' in this look';
 const paidSets=[...new Set(pieces.map(p=>p.premiumProduct).filter(Boolean))].map(premiumTackSet),premium=paidSets.length>0,coins=pieces.reduce((sum,p)=>sum+(p.priceCoins||0),0);
 const freeOnly=pieces.length>0&&pieces.every(p=>p.free);
 const paidTotal=paidSets.reduce((sum,set)=>sum+set.cents,0),price=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(paidTotal/100);
 $('total-price').textContent=freeOnly?'Free':!pieces.length?'Bare horse':[premium?price+' USD · '+(staticStore?'draft set price':paidSets.length+' set'+(paidSets.length===1?'':'s')):'',coins?coins.toLocaleString()+' coins':''].filter(Boolean).join(' + ');
 for(const slot of TACK_SLOTS){const p=state.equipped[slot];$('piece-'+slot).value=p?.id||'';const sw=$('swatch-'+slot),d=p?.design;sw.style.setProperty('--leather',d?.leather||'#deded0');sw.style.setProperty('--cloth',d?.cloth||'#deded0');sw.style.setProperty('--metal',d?.metal||'#deded0');}
 $('details').innerHTML=pieces.length?(premium?'<p>'+paidSets.map(set=>esc(set.name)).join(' + ')+': four matching pieces. Each piece fits one horse at a time. '+(staticStore?'Preview only; purchases are not available on this site.':'Test checkout — no real charge.')+'</p>':freeOnly?'<p>Optional original saddle, pad and bridle. No legwear included. Equip this set free in the boutique.</p>':'<p>Preview only. Own pieces in the boutique to equip them on your saved horse.</p>'):'';
 $('shop-link').href=premium&&!staticStore?'store.html?tab=tack'+(paidSets.length===1?'&product='+encodeURIComponent(paidSets[0].productId):''):'ranch3d.html?shop=tackcollection'+(single?'&collection='+encodeURIComponent(single.id):'');
 $('shop-link').textContent=freeOnly?'Equip Classic Western in the boutique ↗':!pieces.length?'Explore the boutique ↗':premium&&staticStore?'View collection in the boutique ↗':premium?(paidSets.length===1?'View '+paidSets[0].name+' set ↗':'Browse these sets ↗'):'Find these in the boutique ↗';
}
function paintHorseCredit(profile){
 for(const [id,label,url] of [['horse-artist',profile.artist,profile.sourceUrl],['horse-license',profile.license,profile.licenseUrl]]){
  const link=$(id);link.textContent=label||'Source credit unavailable';
  if(/^https:\/\//.test(url||''))link.href=url;else link.removeAttribute('href');
 }
 $('horse-source-note').textContent=profile.nativeRoster?'Breed shape and coat adapted for Meadowlark Ranch.':'Game movement and collection fitting by Meadowlark Ranch.';
}
function health(){
 const rig=state.rig,kit=state.kit;let finite=!!rig;
 rig?.scene.updateMatrixWorld(true);if(rig)finite=rig.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite));
 kit?.root?.traverse(o=>{if(o.isMesh){finite&&=o.matrixWorld.elements.every(Number.isFinite);const p=o.geometry?.attributes.position;if(p)for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i])){finite=false;break;}}});
 $('preview-health').textContent=JSON.stringify({ready:state.ready,error:state.error,horse:state.horse,pieces:TACK_SLOTS.map(slot=>state.equipped[slot]?.id).filter(Boolean),gait:state.gait,animation:rig?.heroMotion?.mode,focus:state.focus,finite,stats:kit?.stats||null});
}
function applyLook(){
 paintInfo();if(!state.kit)return;
 try{state.kit.apply(state.equipped);state.kit.update(0);state.error=null;updateDetailBounds();health();render();}catch(error){state.error=error.message;$('status').textContent='This look could not load. Try another collection.';health();}
}
function selectCollection(id){const c=TACK_COLLECTIONS.find(c=>c.id===id);if(!c)return;state.equipped=Object.fromEntries(TACK_PIECES.filter(p=>p.collectionId===id).map(p=>[p.slot,p]));applyLook();}
function updateDetailBounds(){
 detailBounds.makeEmpty();if(!state.rig||state.focus==='horse')return;
 const slots=state.focus==='saddle'?['saddle','pad']:state.focus==='bridle'?['bridle']:['shoes'];
 state.rig.scene.updateWorldMatrix(true,false);state.rig.scene.updateMatrixWorld(true);state.kit?.update(0);
 for(const slot of slots){const node=state.kit?.root.getObjectByName('Collection '+slot);if(node)detailBounds.union(new THREE.Box3().setFromObject(node,true));}
 if(!detailBounds.isEmpty())detailBounds.translate(new THREE.Vector3(0,-mount.position.y,0));
 if(state.focus==='bridle')for(const name of ['muzzle','poll']){
  const anchor=state.rig.profile?.anchors?.[name]?.[0];if(!anchor)continue;
  const p=new THREE.Vector3(...anchor).multiplyScalar(state.rig.fitScale||1);p.y+=state.rig.fitY||0;
  detailBounds.expandByPoint(p.clone().add(new THREE.Vector3(.17,.13,.14)));
  detailBounds.expandByPoint(p.clone().add(new THREE.Vector3(-.17,-.13,-.10)));
 }
 if(detailBounds.isEmpty()){
  baseBounds.getSize(size);baseBounds.getCenter(target);
  const c=target.clone();if(state.focus==='saddle')c.y=baseBounds.min.y+size.y*.66;
  if(state.focus==='bridle'){c.y=baseBounds.min.y+size.y*.77;c.z=baseBounds.max.z-size.z*.14;}
  if(state.focus==='shoes')c.y=baseBounds.min.y+size.y*.18;
  const span=state.focus==='saddle'?new THREE.Vector3(.9,.75,1.0):state.focus==='bridle'?new THREE.Vector3(.55,.70,.65):new THREE.Vector3(.65,.70,size.z*.65);
  detailBounds.setFromCenterAndSize(c,span);
 }
}
function focusView(name){
 if(name!=='horse'&&state.ready){gait('idle');mount.position.y=0;}
 state.focus=name;zoom=1;theta=name==='bridle'?.74:name==='shoes'?1.33:1.03;
 for(const b of document.querySelectorAll('[data-focus]'))b.setAttribute('aria-pressed',String(b.dataset.focus===name));
 $('side').setAttribute('aria-pressed','false');updateDetailBounds();health();render();
}
function render(){
 const detail=state.focus!=='horse'&&!detailBounds.isEmpty(),bounds=detail?detailBounds:baseBounds;
 const aspect=stage.clientWidth/Math.max(1,stage.clientHeight);bounds.getSize(size);bounds.getCenter(target);
 const extra=state.gait==='jump'?1.45:0;target.y+=detail?(mount.position.y||0):extra*.45;
 const vertical=Math.max(detail?.68:2.45,size.y*(detail?1.45:1.25)+(!detail?extra:0),Math.hypot(size.x,size.z)*(detail?1.32:1.10)/Math.max(.2,aspect))/zoom;
 camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.updateProjectionMatrix();
 camera.position.copy(target).add(new THREE.Vector3(Math.sin(theta)*7,1.0,Math.cos(theta)*7));camera.lookAt(target);renderer.render(scene,camera);
}
function gait(name){
 const cap=getNativeHorseCapabilities(state.rig);
 if(!state.rig||!studioSupportsGait(name,cap))return;state.gait=name;state.rig.heroJumpAge=null;mount.position.y=0;
 state.rig.heroMotion.reset();
 if(name==='jump')startGameHeroJump(state.rig);else tickGameHero(state.rig,studioGaitSpeed(name,cap),0);
 finishNativeHorseGrooms();
 for(const b of document.querySelectorAll('[data-gait]'))b.setAttribute('aria-pressed',String(b.dataset.gait===name));
 state.kit?.update(0);clock.getDelta();health();render();
}
async function chooseHorse(key){
 if(!horseOptions.some(p=>p.key===key)||library.resolve(key)!==key){$('horse-notice').hidden=false;$('horse-notice').textContent='This horse is not available in the fitting room. Choose a horse from the list.';return;}
 const request=++serial;state.ready=false;state.error=null;$('status').textContent='Fitting your tack…';
 for(const button of document.querySelectorAll('[data-gait]'))button.disabled=true;
 try{
  const asset=await library.load(key);if(request!==serial)return;
  state.kit?.dispose();if(state.rig){mount.remove(state.rig.scene);disposeMountedRig(state.rig);}
  state.rig=library.instantiate(asset);state.rig.modelKey=asset.key;
  const row=previewRows.get(key);if(row){const flags=row[7];configureNativeCustomization({THREE,rig:state.rig,horse:{id:'studio:'+key,breed:key,colors:{body:row[5],mane:flags.maneCol||row[6]},mark:flags.mark||'none',markCol:flags.markCol,coat:flags.coat},defaults:row});}
 state.horse=key;mount.position.y=0;mount.add(state.rig.scene);initGameHero(THREE,state.rig);
  tickGameHero(state.rig,0,0);finishNativeHorseGrooms();state.rig.scene.updateMatrixWorld(true);baseBounds.setFromObject(state.rig.scene,true);
  state.kit=createTackCollection({THREE,rig:state.rig,mount,equippedDesigns:state.equipped});
  state.kit.update(0);state.ready=true;$('horse').value=key;$('status').textContent='';
  for(const button of document.querySelectorAll('[data-gait]'))button.disabled=!studioSupportsGait(button.dataset.gait,getNativeHorseCapabilities(state.rig));
  paintHorseCredit(asset.profile);
  gait('idle');updateDetailBounds();paintInfo();health();render();
 }catch(error){if(request!==serial)return;state.error=String(error.message||error);$('status').textContent='The fitting room could not load. Refresh to try again.';health();}
}
$('collection').onchange=()=>selectCollection($('collection').value);
for(const slot of TACK_SLOTS)$('piece-'+slot).onchange=()=>{const p=getTackPiece($('piece-'+slot).value);if(p)state.equipped[slot]=p;else delete state.equipped[slot];applyLook();};
$('clear').onclick=()=>{state.equipped={};applyLook();};
$('horse').onchange=()=>{$('horse-notice').hidden=true;chooseHorse($('horse').value);};
for(const button of document.querySelectorAll('[data-gait]'))button.onclick=()=>gait(button.dataset.gait);
$('side').onclick=()=>{const side=$('side').getAttribute('aria-pressed')!=='true';theta=side?Math.PI/2:1.03;$('side').setAttribute('aria-pressed',String(side));render();};
$('reset').onclick=()=>{focusView('horse');gait('idle');};
for(const button of document.querySelectorAll('[data-focus]'))button.onclick=()=>focusView(button.dataset.focus);
renderer.domElement.addEventListener('pointerdown',e=>{drag=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(drag===null)return;theta-=(e.clientX-drag)*.007;drag=e.clientX;$('side').setAttribute('aria-pressed','false');render();});
for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom-e.deltaY*.0007,.75,1.6);render();},{passive:false});
new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight,false);render();}).observe(stage);
document.addEventListener('visibilitychange',()=>clock.getDelta());
renderer.setAnimationLoop(()=>{const dt=Math.min(.04,clock.getDelta());if(!state.ready)return;
 if(!capture&&!auditing){tickGameHero(state.rig,studioGaitSpeed(state.gait,getNativeHorseCapabilities(state.rig)),dt);mount.position.y=state.rig.heroJumpExtra||0;finishNativeHorseGrooms();state.kit.update(dt);}
 if(state.gait==='jump'&&state.rig.heroJumpAge===null)gait('idle');
 healthAge+=dt;if(healthAge>.7){healthAge=0;health();}render();
});
baseBounds.set(new THREE.Vector3(-.5,0,-1.5),new THREE.Vector3(.5,2,1.5));
const initialItem=getTackPiece(query.get('item')),initialCollection=TACK_COLLECTIONS.find(c=>c.id===query.get('collection'));
if(initialItem){state.equipped={[initialItem.slot]:initialItem};paintInfo();}else if(initialCollection)selectCollection(initialCollection.id);else paintInfo();
try{
 const manifest=await library.manifestReady;previewRows=new Map([registerRosterPreviews,registerNewBreedPreviews,registerClubHorsePreviews,registerMarketHorsePreviews].flatMap(register=>register(library)).map(row=>[row[0],row]));horseOptions=studioHorseOptions(manifest);
 for(const label of ['Original horses','Ranch breeds','Fantasy horses']){
  const group=document.createElement('optgroup');group.label=label;
  for(const horse of horseOptions.filter(h=>h.group===label))group.append(new Option(horse.label,horse.key));
  if(group.children.length)$('horse').append(group);
 }
 if(!horseOptions.some(p=>p.key===DEFAULT_STUDIO_HORSE))throw new Error('Native horse catalog unavailable');
 $('horse').disabled=false;
 const initial=studioInitialHorse(query.get('horse'),initialItem?.collectionId||initialCollection?.id,horseOptions);
 if(initial.unavailable){$('horse-notice').hidden=false;$('horse-notice').textContent='That horse is not available in this fitting room. Showing Bay Sporthorse; choose another horse above.';}
 await chooseHorse(initial.key);
}catch(error){state.error=String(error.message||error);$('status').textContent='The horse catalog could not load. Refresh to try again.';health();}

// Developer-only fitting check. It uses the same visible renderer, changes no
// account/save, and reports a fixed-pose pixel comparison for every collection piece.
if(qa){
 const box=document.createElement('aside');box.style.cssText='padding:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
 const button=document.createElement('button');button.id='audit-tack';button.textContent='Audit all '+TACK_PIECES.length+' pieces';
 const output=document.createElement('output');output.id='audit-result';output.textContent='Ready to check fitted pieces.';box.append(button,output);document.querySelector('main').append(box);
 button.onclick=async()=>{
  if(!state.ready||auditing)return;const saved={...state.equipped},savedFocus=state.focus;auditing=true;button.disabled=true;focusView('horse');
  const checksum=()=>{const data=renderer.domElement.toDataURL('image/png');let h=2166136261;for(let i=0;i<data.length;i++)h=Math.imul(h^data.charCodeAt(i),16777619);return(h>>>0).toString(16);};
  const rows=[];
  try{
   gait('idle');mount.position.y=0;theta=1.03;zoom=1;state.kit.apply({});state.kit.update(0);render();const baseline=checksum();
   for(const piece of TACK_PIECES){
    state.kit.apply({[piece.slot]:piece});state.kit.update(0);render();health();const data=JSON.parse($('preview-health').textContent),pixels=checksum();
    rows.push({id:piece.id,slot:piece.slot,finite:data.finite,pixels,visibleChange:pixels!==baseline,stats:structuredClone(state.kit.stats)});
    output.textContent='Checked '+rows.length+' / '+TACK_PIECES.length;await new Promise(requestAnimationFrame);
   }
   const passed=rows.every(r=>r.finite&&r.visibleChange)&&new Set(rows.map(r=>r.pixels)).size===TACK_PIECES.length;
   output.textContent=JSON.stringify({passed,horse:state.horse,total:rows.length,uniqueImages:new Set(rows.map(r=>r.pixels)).size,rows});
  }catch(error){output.textContent=JSON.stringify({passed:false,error:error.message,rows});}
  finally{state.equipped=saved;applyLook();focusView(savedFocus);auditing=false;button.disabled=false;clock.getDelta();}
 };
}
