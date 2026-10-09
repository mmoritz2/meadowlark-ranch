/* Real ceremony state machine + THREE scene objects, isolated DOM and save. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const clone=x=>structuredClone(x);let checks=0;
const check=(ok,label)=>{assert(ok,label);checks++;};
function fakeDOM(){
 const listeners={},document={activeElement:null};
 class Element{
  constructor(tag='button'){this.tagName=tag.toUpperCase();this.dataset={};this.style={};this.attrs={};this.controls=[];this.children=[];this.hidden=false;this.isConnected=true;this.tabIndex=0;this.listeners={};const classes=new Set();this.classList={add:(...x)=>x.forEach(c=>classes.add(c)),remove:(...x)=>x.forEach(c=>classes.delete(c)),contains:c=>classes.has(c),toggle:(c,on)=>{if(on??!classes.has(c))classes.add(c);else classes.delete(c);}};}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;}
  appendChild(el){this.children.push(el);el.parentElement=this;return el;}
  append(...els){els.forEach(el=>this.appendChild(el));}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  focus(){document.activeElement=this;}
  blur(){if(document.activeElement===this)document.activeElement=null;}
  getClientRects(){return this.hidden?[]:[{}];}
  contains(el){return el===this||this.controls.includes(el)||this.children.some(c=>c.contains(el));}
  matches(selector){return selector.split(',').some(s=>s.trim().toUpperCase()===this.tagName);}
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  get innerHTML(){return this.html||'';}
  set innerHTML(html){this.html=html;this.controls=[];for(const m of html.matchAll(/<(button|select|input|textarea|h2)\b([^>]*)>/g)){const el=new Element(m[1]);el.parentElement=this;el.disabled=/\bdisabled\b/.test(m[2]);const tab=m[2].match(/tabindex="(-?\d+)"/);el.tabIndex=tab?Number(tab[1]):m[1]==='h2'?-1:0;for(const a of m[2].matchAll(/data-([\w-]+)(?:="([^"]*)")?/g))el.dataset[a[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[2]||'';this.controls.push(el);}}
  querySelector(selector){const key=selector.match(/\[data-([\w-]+)\]/)?.[1]?.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key?this.controls.find(e=>key in e.dataset)||null:this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(){return this.controls.filter(e=>!e.disabled&&e.tabIndex>=0);}
 }
 document.body=new Element('body');document.createElement=tag=>new Element(tag);document.addEventListener=(name,fn)=>(listeners[name]??=[]).push(fn);document.dispatchEvent=e=>{for(const fn of listeners[e.type]||[])fn(e);return true;};
 document.activeElement=new Element('button');document.body.appendChild(document.activeElement);
 const key=(code,target=document.activeElement,extras={})=>{const e={type:'keydown',code,key:code==='Escape'?'Escape':code==='Tab'?'Tab':code.replace(/^Key/,''),target,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;},...extras};document.dispatchEvent(e);return e;};
 return {document,Element,key};
}
(async()=>{
 const threeURL=require('node:url').pathToFileURL(path.join(__dirname,'../assets/vendor/three/build/three.module.js')).href;
 require('node:module').register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),require('node:url').pathToFileURL(__filename).href);
 const [THREE,C,R,showcaseModule]=await Promise.all([import(threeURL),import('../assets/tack-collection.mjs'),import('../assets/tack-summon.mjs'),import('../assets/tack-summon-showcase.js')]);
 const source=fs.readFileSync(path.join(__dirname,'../assets/features/tack-summon-ceremony.js'),'utf8').replace(/^import .*;$/gm,'').replace(/export const /g,'const ').replace(/export function /g,'function ');
 function fixture({onFoot=false,reduced=false,distant=false,persist=true,modelFailure=false,aspect=1.5}={}){
  const dom=fakeDOM(),hooks={},locks=new Set(['other-system']),calls={summon:0,equip:0,travel:0,reset:0,release:0,return:0,model:0,dispose:0},messages=[];
  let save={coins:1000,tack:[],horses:[{id:'a',name:'Clover',breed:'bay',gear:{pad:'legacy'}},{id:'b',name:'Fern',breed:'bay',gear:{}}],rider:{made:true}},slot='all',horseId='b',travelAllowed=true;
  const player={pos:new THREE.Vector3(distant?33:-27.5,0,distant?21:-8.2),heading:.37,y:0,vy:0,speed:0,onFoot,mesh:new THREE.Group()};player.mesh.visible=!onFoot;const walker=onFoot?new THREE.Group():null;
  const camera=new THREE.PerspectiveCamera(57,aspect,.1,2000);camera.position.set(3,7,12);camera.rotation.set(.1,.4,0);
  const stall={on:false,cam:false,grp:new THREE.Group(),doorL:new THREE.Group(),doorR:new THREE.Group(),glow:new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#ab3495',opacity:.17,transparent:true})),light:new THREE.PointLight('#7398ab',.63)};stall.grp.position.set(-27.5,2,-4.5);stall.grp.rotation.y=Math.PI;stall.doorL.rotation.y=.12;stall.doorR.rotation.y=-.07;stall.grp.add(stall.doorL,stall.doorR,stall.glow,stall.light);stall.grp.updateMatrixWorld(true);
  const footState={on:onFoot,air:false,climbing:false,rolling:false};
  const G={THREE,camera,horse:{player},summon:{state:stall,STALL:{x:-27.5,z:-4.5}},world:{addFT:e=>G.tables.FT.push(e),travelTo(index){calls.travel++;if(!travelAllowed)return false;const f=G.tables.FT[index];if(!f)return false;player.pos.set(f[1],0,f[2]);player.heading=f[3];player.speed=0;return true;}},tables:{FT:[]},renderer:{xr:{isPresenting:false}},course:{get:()=>null,drillActive:()=>false},roundup:{state:()=>({on:false})},worldPkg:{vehicle:()=>null},cam:{isFree:()=>false},onFoot:{state:()=>footState,walker:()=>walker},input:{reset:()=>calls.reset++},riding:{releaseAll:()=>calls.release++,lock:(reason,on)=>on?locks.add(reason):locks.delete(reason)},save:{fresh:()=>clone(save)},hidePanels(){},seHud:{close(){}},followCam:{reset(){}},toast:message=>messages.push(message),sGem(){},on:(name,fn)=>(hooks[name]??=[]).push(fn)};
  const horseOf=s=>(s?.horses||[]).find(h=>h.id===horseId)||s?.horses?.[0],rewardOf=s=>C.getTackPiece(s?.tackSummon?.lastCatalogId);
  const options={getSlot:()=>slot,setSlot:v=>slot=v,setHorseId:v=>horseId=v,canFit:h=>!h.foal&&!h.egg,horseOf,rewardOf,onReturn:()=>calls.return++,summon(){calls.summon++;const next=clone(save),r=R.summonTackPiece(next,{slot,roll:.37});if(!r.ok)return r;if(persist)save=next;const item=C.ownedTackPiece(save,r.piece.id);return item&&save.tackSummon?.lastCatalogId===r.piece.id?r:{ok:false,code:'save-unavailable'};},equip(){calls.equip++;const p=rewardOf(save),h=horseOf(save);return C.equipTackPiece(save,p.id,h.id);}};
  const makeModel=(_G,piece)=>{calls.model++;check(save.tack.some(t=>t.catalogId===piece.id)&&save.coins===1000-calls.summon*200,'model creation only after charged reward is saved');if(modelFailure)throw Error('model unavailable');const model=showcaseModule.createTackSummonShowcase({THREE},piece);return {...model,dispose(){calls.dispose++;model.dispose();}};};
  const install=vm.runInNewContext(source+'\ninstallTackSummonCeremony',{...C,...R,createTackSummonShowcase:makeModel,document:dom.document,Event,matchMedia:()=>({matches:reduced})});
  const ceremony=install(G,options);G.tackSummon={ceremony};
  const click=key=>{const target=ceremony.dialog.querySelector('[data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']')||Object.assign(new dom.Element('button'),{dataset:{[key]:''}});for(const fn of ceremony.dialog.listeners.click||[])fn({target});};
  const change=(key,value)=>{for(const fn of ceremony.dialog.listeners.change||[])fn({target:{dataset:{[key]:''},value}});};
  const snapshot=()=>({position:player.pos.toArray(),heading:player.heading,y:player.y,vy:player.vy,meshVisible:player.mesh.visible,walkerVisible:walker?.visible,camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,doors:[stall.doorL.rotation.y,stall.doorR.rotation.y],glow:[stall.glow.material.opacity,stall.glow.material.color.getHex()],light:[stall.light.intensity,stall.light.color.getHex()]});
  return {G,dom,hooks,locks,calls,messages,player,walker,footState,stall,camera,ceremony,click,change,snapshot,read:()=>clone(save),edit:fn=>fn(save),denyTravel:()=>travelAllowed=false};
 }
 const restored=(f,initial)=>{assert.deepEqual(f.snapshot(),initial,'all saved scene/player/camera properties restored');check(!f.ceremony.active&&!f.locks.has('tack-ceremony')&&f.locks.has('other-system'),'only ceremony lock is released');check(f.ceremony.dialog.hidden&&!f.dom.document.body.classList.contains('tack-summoning'),'world dialog and body state close');assert.equal(f.stall.on,false);assert.equal(f.stall.cam,false);};
 for(const onFoot of [false,true]){
  const f=fixture({onFoot}),initial=f.snapshot(),horses=f.read().horses;
  check(f.ceremony.open().ok,'nearby rider opens original stall without travel');assert.equal(f.read().coins,1000);assert.equal(f.calls.summon,0);check(!f.player.mesh.visible&&(!f.walker||!f.walker.visible),'mounted and walking actors hidden independently');
  check(f.locks.has('tack-ceremony')&&f.ceremony.state.phase==='choosing','chooser owns riding input');check(f.ceremony.start().ok,'one call saves reward');assert.equal(f.read().coins,800);assert.equal(f.read().tack.length,1);assert.equal(f.ceremony.state.phase,'charging');
  assert.equal(f.ceremony.start().code,'busy');assert.equal(f.ceremony.visit().code,'busy');assert.equal(f.calls.summon,1,'repeated start and visit never charge again');
  for(let n=0;n<40;n++)f.ceremony.tick(.1);f.ceremony.camera(.1,4,new THREE.Vector3());check(f.stall.doorL.rotation.y>initial.doors[0]&&f.stall.doorR.rotation.y<initial.doors[1],'original doors open');check(f.camera.fov===44&&f.camera.position.distanceTo(new THREE.Vector3(...initial.camera))>1,'cinematic camera changes actual frame');assert.deepEqual(f.read().horses,horses,'cinematic reveal never equips or switches horse');
  check(f.dom.key('Escape').stopped&&f.ceremony.state.phase==='revealed','Escape skips to saved result');assert.equal(f.calls.summon,1);check(f.ceremony.dialog.innerHTML.includes('SAVED TO YOUR LOCKER'),'skip shows owned saved result');
  f.click('twClose');restored(f,initial);assert.equal(f.calls.dispose,1);assert.equal(f.calls.return,1);assert.equal(f.read().coins,800);assert.equal(f.ceremony.close(),false,'repeat close is inert');
 }
 console.log('PASS mounted/on-foot snapshot restoration, save-before-animation, one charge, real door/camera state, Escape reveal and complete cleanup');
 // The portrait shot must clear its physical approach without removing actors,
 // changing their flags permanently, or hiding unrelated floating labels.
 function addScenery(f){
  const scene=new THREE.Group(),groups=[],herd=[];
  const actor=(x=-27.5,z=-6,visible=true)=>{
   const group=new THREE.Group();group.position.set(x,1,z);group.visible=visible;
   const label=new THREE.Sprite();label.name='horse name';group.add(label);scene.add(group);groups.push(group);
   return {parts:{group},label};
  };
  const near=actor(),hidden=actor(-28,-7,false),far=actor(70,70),barn=actor(-30,-13),standing=actor(-29,-10),remote=actor(-25,-8),visitor=actor(-26,-9);
  herd.push(near,hidden,far,null,{parts:null},{parts:{group:{}}});
  const bench=new THREE.Group(),benchLabel=new THREE.Sprite();bench.position.set(-27.2,0,-11.55);bench.add(benchLabel);scene.add(bench);
  const unrelated=new THREE.Sprite();unrelated.position.set(-28,3,-6);scene.add(unrelated);
  f.G.world.things=[null,{id:'tack-summon-stall',g:bench},{id:'other',g:unrelated}];
  f.G.horse.herd=()=>herd;f.G.ranch={standing:()=>[standing]};f.G.ranchSys={barnHorses:()=>[barn]};f.G.horse.remotes={peer:remote};f.G.world.visitors=[visitor];
  const roots=[bench,...groups],before=roots.map(g=>({root:g,visible:g.visible,parent:g.parent,position:g.position.toArray(),quaternion:g.quaternion.toArray(),scale:g.scale.toArray()}));
  const effective=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  return {scene,actor,herd,near,hidden,far,barn,standing,remote,visitor,bench,benchLabel,unrelated,before,effective};
 }
 for(const exit of ['cancel','reveal','failed-save']){
  const f=fixture({aspect:390/844,persist:exit!=='failed-save'}),props=addScenery(f),beforeSave=f.read();
  check(f.ceremony.open().ok,'cluttered portrait stall still opens');
  const masked=[props.near,props.hidden,props.barn,props.standing,props.remote,props.visitor];
  check(!props.bench.visible&&!props.effective(props.benchLabel),'workbench and its child label leave the shot together');
  check(masked.every(a=>!a.parts.group.visible&&!props.effective(a.label)),'nearby known horse roots and child nameplates are hidden');
  check(props.far.parts.group.visible&&props.unrelated.visible&&f.stall.grp.visible,'far horse, unrelated sprite and source stall remain visible');
  assert.deepEqual(f.read(),beforeSave,'clearing scenery never changes the save');
  props.near.parts.group.visible=true;props.bench.visible=true; // normal culling can write again
  f.ceremony.camera(.016,0,new THREE.Vector3());
  check(!props.near.parts.group.visible&&!props.bench.visible,'final camera pass reapplies mask after ordinary visibility writers');
  if(exit!=='cancel'){
   const result=f.ceremony.start();check(result.ok===(exit==='reveal'),'visibility does not alter successful or failed charging');
   if(exit==='reveal'){f.ceremony.skip();f.ceremony.tick(.016);check(!props.near.parts.group.visible&&f.ceremony.state.phase==='revealed','reward phase retains clear view');}
  }
  f.ceremony.close();
  for(const item of props.before){assert.equal(item.root.visible,item.visible);assert.equal(item.root.parent,item.parent);assert.deepEqual(item.root.position.toArray(),item.position);assert.deepEqual(item.root.quaternion.toArray(),item.quaternion);assert.deepEqual(item.root.scale.toArray(),item.scale);}
  check(props.hidden.parts.group.visible===false&&props.near.parts.group.visible===true,'exit restores exact prior visible and hidden flags');
  check(props.benchLabel.visible&&props.near.label.visible&&props.unrelated.visible,'child and unrelated sprite flags are never mutated');
  assert.deepEqual(f.read().horses,beforeSave.horses,'cinematic mask never changes owned horses');
  props.near.parts.group.visible=false;f.ceremony.open();f.ceremony.close();
  check(!props.near.parts.group.visible,'new ceremony captures fresh flags after prior mask was cleared');
 }
 const dynamic=fixture(),props=addScenery(dynamic);dynamic.ceremony.open();
 const entering=props.actor(60,60);props.herd.push(entering);dynamic.ceremony.tick(.016);check(entering.parts.group.visible,'late distant horse is left alone');
 entering.parts.group.position.set(-27.5,1,-7);dynamic.ceremony.tick(.016);check(!entering.parts.group.visible,'horse entering reveal area is masked on the next active tick');
 const replaced=props.near.parts.group;replaced.removeFromParent();props.herd.splice(props.herd.indexOf(props.near),1);
 const replacement=props.actor(-27, -7,false);props.herd.push(replacement);dynamic.ceremony.camera(.016,0,new THREE.Vector3());
 check(!replacement.parts.group.visible,'rebuilt actor is tracked independently without showing an originally hidden horse');
 dynamic.G.ranch.standing=()=>{throw Error('optional actor list unavailable');};dynamic.G.ranchSys.barnHorses=()=>null;dynamic.G.world.visitors={};dynamic.G.horse.remotes=null;
 assert.doesNotThrow(()=>dynamic.ceremony.tick(.016),'optional invalid actor readers cannot strand the ceremony');
 dynamic.ceremony.close();
 check(entering.parts.group.visible&&!replacement.parts.group.visible&&replaced.visible&&replaced.parent===null,'late/replaced/removed roots restore flags without being moved or reattached');
 console.log('PASS clear ceremony view, precise visibility restoration, child labels, culling writes, late actors and safe optional readers');
 // These actors live outside H.herd(): the player's parked mount, active
 // pet, legacy stray and following world-herd member. Their roots can sit just
 // beyond the stall radius but beside the portrait camera (e.g. broad wings).
 const extras=fixture({aspect:390/844}),extraProps=addScenery(extras),extraActors=Array.from({length:5},(_,i)=>extraProps.actor(-28+i*.2,-22,i!==4));
 extras.G.onFoot.horse=()=>({group:extraActors[0].parts.group});
 extras.G.pets={comp:()=>extraActors[1]};extras.G.petComp=()=>extraActors[1];
 extras.G.wild={get:()=>extraActors[2]};extras.G.worldPkg.herds=[{members:[extraActors[3],extraActors[4]]},null,{}];
 check(extraActors.every(a=>a.parts.group.position.distanceTo(new THREE.Vector3(-27.5,1,-4.5))>14),'extra actor fixture is outside the original stall radius');
 extras.ceremony.open();
 check(extraActors.every(a=>!a.parts.group.visible),'known parked/pet/wild roots beside ceremony camera are hidden even beyond stall radius');
 extras.ceremony.close();
 check(extraActors.slice(0,4).every(a=>a.parts.group.visible)&&!extraActors[4].parts.group.visible,'duplicate pet APIs and extra actor lists restore exact original flags');
 const unavailable=fixture();unavailable.G.onFoot.horse=()=>{throw Error('parked horse unavailable');};unavailable.G.pets={comp:()=>{throw Error('pet unavailable');}};unavailable.G.wild={get:()=>null};unavailable.G.worldPkg.herds=[{members:null}];
 assert.doesNotThrow(()=>{unavailable.ceremony.open();unavailable.ceremony.tick(.016);unavailable.ceremony.close();});
 check(!unavailable.ceremony.active,'missing optional actor APIs cannot strand the ceremony');
 console.log('PASS separate parked/pet/wild actors, near-camera coverage and exact restoration');
 // Project real world points through a portrait THREE camera. These are scene
 // and screen-space requirements, not assertions about a chosen camera pose/FOV.
 const portrait=fixture({aspect:390/844}),portraitInitial=portrait.snapshot(),portraitProjection=portrait.camera.projectionMatrix.clone();
 const settlePortrait=()=>{for(let i=0;i<120;i++)portrait.ceremony.camera(1/60,i/60,new THREE.Vector3());portrait.camera.updateMatrixWorld(true);portrait.stall.grp.updateMatrixWorld(true);};
 const projectWorld=point=>point.clone().project(portrait.camera);
 const framed=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&Math.abs(p.x)<1&&p.z>-1&&p.z<1;
 // Original Summoning Stall front corners: 4.6 m wide, 3.2 m deep.
 const barnSides=[-2.3,2.3].map(x=>portrait.stall.grp.localToWorld(new THREE.Vector3(x,1.7,1.6)));
 portrait.ceremony.open();
 const openingCamera=portrait.camera.position.clone(),openingQuaternion=portrait.camera.quaternion.clone();
 portrait.camera.updateMatrixWorld(true);
 check(barnSides.map(projectWorld).every(framed),'first visible portrait chooser frame already contains both barn sides');
 settlePortrait();
 check(portrait.camera.position.distanceTo(openingCamera)<1e-10&&portrait.camera.quaternion.angleTo(openingQuaternion)<1e-7,'chooser enters at its established shot with no travel through intervening scenery');
 check(barnSides.map(projectWorld).every(framed),'portrait chooser keeps both barn sides horizontally within the camera frustum');
 portrait.ceremony.start();for(let i=0;i<55;i++)portrait.ceremony.tick(.1);
 const beforeRevealMove=portrait.camera.position.clone();portrait.ceremony.camera(1/60,5,new THREE.Vector3());const firstRevealMove=portrait.camera.position.distanceTo(beforeRevealMove);settlePortrait();
 check(firstRevealMove>0&&firstRevealMove<portrait.camera.position.distanceTo(beforeRevealMove)*.2,'charging/reveal camera keeps smooth easing after the one-time entry snap');
 const rewardRoot=portrait.stall.grp.getObjectByName('Summoned '+portrait.ceremony.state.result.piece.name);
 check(portrait.ceremony.state.phase==='revealed'&&rewardRoot?.visible,'portrait camera regression uses the fully revealed actual reward sculpture');
 const rewardPoints=[];rewardRoot.traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.getAttribute('position');for(let i=0;i<a.count;i++)rewardPoints.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld));});
 const rewardScreen=rewardPoints.map(projectWorld);
 check(rewardScreen.length>0&&rewardScreen.every(framed),'portrait reveal keeps the entire actual reward geometry horizontally in frame');
 // Reserve the bottom 40% for the wrapped phone card (equip selector, buttons,
 // status and bottom safe space), so the sculpture cannot hide beneath it.
 check(rewardScreen.every(p=>p.y<1&&(1-p.y)/2<.6),'portrait revealed tack stays fully above the bottom control-card region');
 portrait.ceremony.close();restored(portrait,portraitInitial);
 check(portrait.camera.projectionMatrix.equals(portraitProjection),'closing portrait reveal restores the original camera projection as well as pose and FOV');
 console.log('PASS 390×844 portrait barn/reward projection, control-card clearance and original-camera restoration');
 const failed=fixture({persist:false});failed.ceremony.open();const failedBefore=failed.snapshot(),failedSave=failed.read();const failure=failed.ceremony.start();assert.equal(failure.code,'save-unavailable');assert.deepEqual(failed.read(),failedSave);assert.equal(failed.calls.model,0);assert.equal(failed.ceremony.state.phase,'choosing');assert.deepEqual(failed.snapshot(),failedBefore);check(failed.ceremony.dialog.innerHTML.includes('could not be saved'),'failed storage remains in chooser with error');failed.ceremony.close();
 const unreadable=fixture(),unreadablePose=unreadable.snapshot();unreadable.G.save.fresh=()=>null;check(!unreadable.ceremony.open().ok,'unreadable save rejects before hiding actors');assert.deepEqual(unreadable.snapshot(),unreadablePose);check(!unreadable.ceremony.active&&!unreadable.locks.has('tack-ceremony'),'read failure cannot leave an invisible locked rider');
 const lostRead=fixture();lostRead.ceremony.open();lostRead.G.save.fresh=()=>null;check(!lostRead.ceremony.start().ok&&lostRead.calls.summon===0,'save becoming unreadable blocks confirmation before charge');check(lostRead.ceremony.dialog.innerHTML.includes('tw-close'),'unreadable chooser retains an exit');lostRead.ceremony.close();
 const interrupted=fixture();const interruptedInitial=interrupted.snapshot();interrupted.ceremony.open();interrupted.ceremony.start();interrupted.ceremony.close();restored(interrupted,interruptedInitial);assert.equal(interrupted.read().coins,800);assert.equal(interrupted.read().tack.length,1);check(C.ownedTackPiece(JSON.parse(JSON.stringify(interrupted.read())),interrupted.read().tackSummon.lastCatalogId),'closing mid-charge keeps the saved recoverable reward');
 const equip=fixture();equip.ceremony.open();equip.ceremony.start();equip.ceremony.skip();equip.click('twEquip');const acquired=equip.read().tack[0];assert.equal(equip.read().horses[1].gear[acquired.slot],acquired.id);assert.equal(equip.read().horses[0].gear.pad,'legacy');assert.equal(equip.read().coins,800);equip.ceremony.close();check(equip.read().horses[1].gear[acquired.slot]===acquired.id,'explicit selected-horse equip survives return');
 const displayFailure=fixture({modelFailure:true});displayFailure.ceremony.open();check(displayFailure.ceremony.start().ok,'display failure cannot cancel saved ownership');displayFailure.ceremony.skip();check(displayFailure.ceremony.dialog.innerHTML.includes('3D display could not load'),'display failure remains understandable');displayFailure.ceremony.close();assert.equal(displayFailure.read().tack.length,1);
 console.log('PASS failed-save no animation, mid-charge exit/reload safety, explicit equip and model-failure ownership preservation');
 for(const [name,block] of Object.entries({horse:f=>f.stall.on=true,vr:f=>f.G.renderer.xr.isPresenting=true,event:f=>f.G.course.get=()=>({}),drill:f=>f.G.course.drillActive=()=>true,roundup:f=>f.G.roundup.state=()=>({on:true}),vehicle:f=>f.G.worldPkg.vehicle=()=>({}),photo:f=>f.G.cam.isFree=()=>true,flying:f=>f.player.flying=true,air:f=>f.player.y=.4,footAir:f=>f.footState.air=true,climbing:f=>f.footState.climbing=true,rolling:f=>f.footState.rolling=true,loading:f=>f.stall.doorR=null})){
  const f=fixture();block(f);const before=f.read();check(!f.ceremony.open().ok&&!f.ceremony.visit().ok,name+' rejects before entering');assert.equal(f.calls.summon,0);assert.equal(f.calls.travel,0);assert.deepEqual(f.read(),before);check(!f.ceremony.active,name+' leaves ceremony inactive');
 }
 const lateHorse=fixture();lateHorse.ceremony.open();lateHorse.stall.on=true;check(!lateHorse.ceremony.start().ok&&lateHorse.calls.summon===0,'horse summon appearing before confirmation prevents charge');lateHorse.stall.on=false;lateHorse.ceremony.close();
 const travel=fixture({onFoot:true,distant:true});const pretravel=travel.read();check(travel.ceremony.visit().ok&&travel.calls.travel===1,'visit uses guarded original-stall fast travel');assert.deepEqual(travel.read(),pretravel,'visit is free');assert.equal(travel.player.onFoot,true);travel.ceremony.close();assert.deepEqual(travel.player.pos.toArray(),[-27.5,0,-8.2],'return stays at safe stall approach after deliberate visit');
 const denied=fixture({distant:true});denied.denyTravel();const deniedPose=denied.snapshot();assert.equal(denied.ceremony.visit().code,'travel-blocked');assert.deepEqual(denied.snapshot(),deniedPose);assert.equal(denied.calls.summon,0);
 const reduced=fixture({reduced:true});reduced.ceremony.open();reduced.ceremony.start();for(let i=0;i<13;i++)reduced.ceremony.tick(.1);assert.equal(reduced.ceremony.state.phase,'revealed');reduced.ceremony.close();
 console.log('PASS horse/VR/event/vehicle/photo/air gates, free guarded travel, unchanged locomotion mode and reduced-motion reveal');
 const keys=fixture();const origin=keys.dom.document.activeElement;keys.ceremony.open();const button=keys.ceremony.dialog.querySelector('[data-tw-summon]');
 check(keys.dom.key('KeyH',button).stopped,'active dialog button cannot leak a ranch hotkey');
 const select=keys.ceremony.dialog.querySelector('[data-tw-slot]'),selectionKey=keys.dom.key('KeyB',select);check(selectionKey.stopped&&!selectionKey.prevented,'native selection typing remains while game hotkeys are isolated');
 const fields=keys.ceremony.dialog.querySelectorAll('button,select');fields.at(-1).focus();check(keys.dom.key('Tab').prevented&&keys.dom.document.activeElement===fields[0],'Tab wraps within the dialog');keys.dom.key('Tab',fields[0],{shiftKey:true});check(keys.dom.document.activeElement===fields.at(-1),'Shift+Tab wraps backward');
 keys.ceremony.close();check(keys.dom.document.activeElement===origin,'focus returns to the original usable control');
 console.log('PASS dialog hotkey isolation and focus restoration');
 const core=fs.readFileSync(path.join(__dirname,'../ranch3d.html'),'utf8'),horseStart=core.slice(core.indexOf('function startSummon(tier){'),core.indexOf('/* The suspense:',core.indexOf('function startSummon(tier){')));
 check(horseStart.startsWith('function startSummon(tier){'),'actual core horse summon entry is available');
 for(const [horseActive,tackActive]of[[false,true],[true,false]]){let reads=0;const startHorse=new Function('SUMMON','G','freshSave',horseStart+';return startSummon;')({on:horseActive},{tackSummon:{ceremony:{active:tackActive}}},()=>{reads++;throw Error('parallel purchase attempted');});startHorse({gems:50});check(reads===0,'actual horse summon cannot charge during either active ceremony');}
 const inputStart=core.indexOf('function gameInputBlocked(){'),inputEnd=core.indexOf('\nconst ridingInput=',inputStart),inputSource=core.slice(inputStart,inputEnd);check(inputSource.includes('function gameInputBlocked(){'),'actual input guard is available');
 const blocked=new Function('G',inputSource+';return gameInputBlocked;')({tackSummon:{ceremony:{active:true}}});check(blocked()===true,'actual core input guard recognizes the tack ceremony before DOM menus');
 console.log('PASS actual core horse-summon mutual exclusion and ceremony input guard');
 console.log('PASS '+checks+' ceremony checks with real THREE scene objects');
})().catch(error=>{console.error(error);process.exitCode=1;});
