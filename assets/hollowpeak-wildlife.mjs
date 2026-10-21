/* The three existing Hollowpeak goat actors keep their original AI and transforms.
 * Licensed source and existing skeletal gait: models/pets/manifest.json + pet-library.js. */
import {createPetLibrary} from './pet-library.js?v=hollowpeak-wildlife-1';
import {GLTFLoader} from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from './vendor/three/examples/jsm/utils/SkeletonUtils.js';

export const HOLLOWPEAK_WILDLIFE_PROFILE='hollowpeak-wildlife-1';
export const HOLLOWPEAK_GOAT_SOURCE_SHA256='841de814cf55880530ab6ec8e5aafbd0b540230d5fd0f830a22be406cedc34ca';
export const HOLLOWPEAK_GOAT_HEIGHT=1.05;
const owners=new WeakMap(),caches=new WeakMap();
let resourceSeed=0x6726a8d1;
function construct(run){
 const previous=Math.random;
 Math.random=()=>{resourceSeed=(Math.imul(resourceSeed,1664525)+1013904223)>>>0;return resourceSeed/4294967296;};
 try{const value=run();if(value&&typeof value.then==='function')throw Error('Goat resource scope must be synchronous');return value;}
 finally{Math.random=previous;}
}
function destroySource(asset){
 const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
 asset.scene.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of [].concat(o.material)){materials.add(m);for(const k in m)if(m[k]?.isTexture)textures.add(m[k]);}});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
 for(const t of textures){if(t.image)images.add(t.image);t.dispose();}for(const image of images)if(typeof image.close==='function')image.close();
}
async function loadSource(T,{fetcher=fetch,Loader=GLTFLoader,cloneScene=clone}={}){
 const manifestURL=new URL('./models/pets/manifest.json',import.meta.url),response=await fetcher(manifestURL,{cache:'no-store'});
 if(!response.ok)throw Error('Goat model manifest HTTP '+response.status);
 const manifest=await response.json(),original=manifest?.pets?.goat;
 if(original?.sha256!==HOLLOWPEAK_GOAT_SOURCE_SHA256||original.file!=='goat.glb'||original.license!=='CC-BY-4.0'||!original.boneGait)throw Error('Unexpected licensed goat source');
 const adult=JSON.parse(JSON.stringify(original));delete adult.boneScale;
 const library=construct(()=>createPetLibrary({THREE:T,GLTFLoader:Loader,clone:cloneScene,manifest:{pets:{goat:adult}},manifestURL,construct}));
 const asset=await library.load('goat',{height:HOLLOWPEAK_GOAT_HEIGHT});
 return {library,asset};
}
function acquire(T,options){
 let cache=caches.get(T);
 if(!cache){cache={users:0,value:null,promise:null};caches.set(T,cache);
  cache.promise=loadSource(T,options).then(value=>{cache.value=value;if(cache.users===0){destroySource(value.asset);if(caches.get(T)===cache)caches.delete(T);}return value;},error=>{if(caches.get(T)===cache)caches.delete(T);throw error;});}
 cache.users++;return cache;
}
function release(T,cache){
 if(--cache.users===0&&cache.value){destroySource(cache.value.asset);if(caches.get(T)===cache)caches.delete(T);}
}

/** Only the exact pre-existing region-owned records are eligible. No actors are spawned. */
export function installHollowpeakGoats({THREE:T,W,camera,getQuality=()=> 'high',loadOptions}={}){
 if(!T||!W||!camera||!Array.isArray(W.critters))throw Error('Missing Hollowpeak goat context');
 const previous=owners.get(W);if(previous&&!previous.disposed)return previous;
 const records=W.critters.filter(c=>c.key==='goat'&&c.home?.x===-168&&c.home?.z===-206&&c.home?.r===30);
 if(records.length!==3)throw Error('Expected the three existing Hollowpeak goats');
 const entries=records.map((record,index)=>({record,index,instance:null,anchor:null,old:null,elapsed:0,lastHeading:record.heading,removed:null,status:'loading'}));
 let disposed=false,status='waiting',error=null,cache=null,released=false,settleReady;
 const ready=new Promise(resolve=>{settleReady=resolve;});
 const releaseOnce=()=>{if(cache&&!released){released=true;release(T,cache);}};
 const cameraPoint=construct(()=>new T.Vector3());
 const renderDistance=()=>getQuality()==='low'?80:getQuality()==='medium'?120:160;
 function retire(e){
  if(e.instance){e.instance.dispose();e.instance=null;}if(e.anchor){e.anchor.removeFromParent();e.anchor=null;}
  if(e.old){e.record.p.body.visible=e.old.body;e.record.p.shadow.visible=e.old.shadow;for(let i=0;i<e.record.p.legs.length;i++)e.record.p.legs[i].visible=e.old.legs[i];e.old=null;}
  if(e.removed)e.record.p.group.removeEventListener('removed',e.removed);e.removed=null;
  e.status='disposed';
 }
 const handle={profile:HOLLOWPEAK_WILDLIFE_PROFILE,sourceSHA256:HOLLOWPEAK_GOAT_SOURCE_SHA256,entries,
  get disposed(){return disposed;},get status(){return status;},get error(){return error;},ready,
  update(dt){
   if(disposed||!Number.isFinite(dt)||dt<0)return;
   camera.getWorldPosition(cameraPoint);
   const distanceLimit=renderDistance();
   if(status==='waiting'){if(entries.some(e=>Math.hypot(cameraPoint.x-e.record.x,cameraPoint.z-e.record.z)<distanceLimit))beginLoad();return;}
   if(status!=='ready')return;
   construct(()=>{for(const e of entries){
    const c=e.record,I=e.instance;if(!I||!c.p.group.parent)continue;
    const distance=Math.hypot(cameraPoint.x-c.x,cameraPoint.z-c.z);e.anchor.visible=distance<distanceLimit;c.p.shadow.visible=e.old.shadow&&e.anchor.visible;
    if(!e.anchor.visible||!c.p.group.visible){e.elapsed=0;e.lastHeading=c.heading;continue;}
    e.elapsed+=dt;if(distance>45&&e.elapsed<.1)continue;
    const step=Math.min(.25,e.elapsed),turn=step>0?Math.atan2(Math.sin(c.heading-e.lastHeading),Math.cos(c.heading-e.lastHeading))/step:0;
    e.elapsed=0;e.lastHeading=c.heading;
    const speed=Math.max(0,c.speed||0),move=Math.min(1,Math.max(speed/.55,Math.abs(turn)*.3)),run=Math.max(0,Math.min(1,(speed-2.8)/2.4));
    I.update(step,{w:{idle:1-move,walk:move*(1-run),run:move*run},mps:speed,turn,fade:.16});
    // Existing native idle supplies body life; a small neck-only graze does not move the actor.
    if(c.mode==='graze'&&speed<.05)I.look(0,.24);
   }});
  },
  dispose(){if(disposed)return;disposed=true;status='disposed';for(const e of entries)retire(e);releaseOnce();settleReady(handle);if(owners.get(W)===handle)owners.delete(W);}
 };
 owners.set(W,handle);
 function beginLoad(){
  if(disposed||cache)return;status='loading';cache=acquire(T,loadOptions);
  cache.promise.then(({library,asset})=>{
  if(disposed)return handle;
  try{construct(()=>{for(const e of entries){
   const p=e.record.p,s=p.group.scale;
   if(!p.shadow||p.shadow.parent!==p.group)throw Error('Missing original goat contact owner');
   if(!p.group.parent||!Number.isFinite(s.x)||s.x<=0||s.x!==s.y||s.x!==s.z)throw Error('Unexpected goat actor transform');
   const I=library.instantiate(asset),anchor=new T.Group();e.instance=I;e.anchor=anchor;
   anchor.name='Hollowpeak adult goat '+(e.index+1);anchor.userData.hollowpeakWildlife={profile:HOLLOWPEAK_WILDLIFE_PROFILE,sourceSHA256:HOLLOWPEAK_GOAT_SOURCE_SHA256,index:e.index,worldHeight:HOLLOWPEAK_GOAT_HEIGHT};
   anchor.scale.setScalar(1/s.x);anchor.add(I.root);p.group.add(anchor);
   I.root.name='Licensed adult goat';I.update(0,{w:{idle:1},snap:true});
   // SkeletonUtils clones a wrapper for each primitive. This source uses one skin:
   // share only wrappers whose exact cloned bones and inverse matrices already agree.
   const skeletons=[];I.model.traverse(o=>{if(!o.isSkinnedMesh)return;const s=o.skeleton,same=skeletons.find(a=>a.bones.length===s.bones.length&&a.bones.every((b,i)=>b===s.bones[i]&&a.boneInverses[i].equals(s.boneInverses[i])));if(same&&same!==s){s.dispose();o.skeleton=same;}else if(!same)skeletons.push(s);});for(const skeleton of skeletons)if(!skeleton.boneTexture)skeleton.computeBoneTexture();
   e.old={body:p.body.visible,shadow:p.shadow.visible,legs:p.legs.map(l=>l.visible)};p.body.visible=false;for(const leg of p.legs)leg.visible=false;
   e.removed=()=>retire(e);p.group.addEventListener('removed',e.removed);e.status='ready';
  }});status='ready';return handle;}
  catch(failure){for(const e of entries)retire(e);releaseOnce();status='failed';error=String(failure?.message||failure);return handle;}
 },failure=>{releaseOnce();if(!disposed){status='failed';error=String(failure?.message||failure);}return handle;}).then(settleReady);
 }
 handle.update(0);
 return handle;
}
