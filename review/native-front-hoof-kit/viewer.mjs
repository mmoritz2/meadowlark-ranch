import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNativeHorseMotion} from '../../assets/native-horse-motion.js?v=native-hoof-flex-2';
import {NATIVE_BREED_PROFILES} from '../../assets/native-breed-profiles.js?v=native-hoof-flex-2';
const stage=document.querySelector('#stage'),status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#45574b');stage.appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.02,100);
scene.add(new THREE.HemisphereLight(0xe8efff,0x665140,2));
const sun=new THREE.DirectionalLight(0xffefdc,3);sun.position.set(4,7,5);scene.add(sun);
const fill=new THREE.DirectionalLight(0xd8e4fa,1);fill.position.set(-4,3,-3);scene.add(fill);scene.add(new THREE.GridHelper(10,20,0x889789,0x627565));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x5e725d,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.004;scene.add(ground);
const config=await(await fetch('./config.json?v=native-hoof-view-2')).json();
let rigs={},active='candidate',comparing=true,playing=true,phase=0,last=0,close=true,key='white-western',loadSerial=0;
const horse=document.querySelector('#horse'),gait=document.querySelector('#gait'),slider=document.querySelector('#phase');
function draw(name,x,width){
 for(const[n,r]of Object.entries(rigs))r.actor.visible=n===name;
 camera.aspect=width/stage.clientHeight;camera.updateProjectionMatrix();
 renderer.setViewport(x,0,width,stage.clientHeight);renderer.setScissor(x,0,width,stage.clientHeight);renderer.render(scene,camera);
}
function render(){
 renderer.setScissorTest(true);
 if(comparing){const half=Math.floor(stage.clientWidth/2);draw('baseline',0,half);draw('candidate',half,stage.clientWidth-half);}
 else draw(active,0,stage.clientWidth);
 renderer.setScissorTest(false);
}
function poseCamera(){
 if(close){camera.position.set(3.3,1,.65);camera.lookAt(0,.6,.65);}
 else{camera.position.set(comparing?8.5:5.3,2.2,.1);camera.lookAt(0,1.1,0);}
 render();
}
function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight);poseCamera();}
function select(name){
 active=name;comparing=false;document.querySelector('#labels').hidden=true;
 document.querySelector('#compare').setAttribute('aria-pressed','false');
 document.querySelector('#before').setAttribute('aria-pressed',String(name==='baseline'));
 document.querySelector('#after').setAttribute('aria-pressed',String(name==='candidate'));poseCamera();
}
function compare(){comparing=true;document.querySelector('#labels').hidden=false;document.querySelector('#compare').setAttribute('aria-pressed','true');for(const id of ['before','after'])document.querySelector('#'+id).setAttribute('aria-pressed','false');poseCamera();}
function seek(p){
 phase=((p%1)+1)%1;
 for(const r of Object.values(rigs)){const clip=r.profile.nativeGaits[gait.value].clip,action=r.motion.mixer._actions.find(a=>a.getClip().name===clip);action.time=phase*action.getClip().duration;r.motion.update(0);}
 slider.value=phase;render();
}
function chooseGait(){for(const r of Object.values(rigs)){r.motion.reset();const canter=gait.value.startsWith('canter');r.motion.set(canter?'canter':gait.value,{lead:gait.value==='canterRight'?'right':'left'});r.motion.update(.2);}seek(0);}
function destroy(r){
 r.motion.dispose();scene.remove(r.actor);const textures=new Set(),materials=new Set(),geometries=new Set();
 r.root.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 for(const x of textures)x.dispose();for(const x of materials)x.dispose();for(const x of geometries)x.dispose();
}
async function load(nextKey){
 const serial=++loadSerial;status.textContent='Loading…';horse.disabled=gait.disabled=true;for(const r of Object.values(rigs))destroy(r);rigs={};key=nextKey;
 const profile=NATIVE_BREED_PROFILES[key],next={};
 try{
  for(const name of ['baseline','candidate']){const ownProfile={...profile,nativeHoofFlex:name==='candidate'||config[key].baselineHoofFlex===true},asset=await new GLTFLoader().loadAsync(config[key][name]),root=asset.scene,actor=new THREE.Group();actor.position.fromArray(profile.nativeTranslation);actor.add(root);scene.add(actor);const motion=createNativeHorseMotion({THREE,root,clips:asset.animations,profile:ownProfile});next[name]={profile:ownProfile,root,actor,motion};}
  if(serial!==loadSerial){for(const r of Object.values(next))destroy(r);return;}rigs=next;chooseGait();if(comparing)compare();else select(active);
  status.textContent='Both horses play the same stride together';document.querySelector('#studio').href='../../breeds.html?horse='+key+'&v=native-hoof-flex-2';
  window.hoofPreview={get rigs(){return rigs;},seek,select,compare,render,get phase(){return phase;},get key(){return key;},get comparing(){return comparing;},renderer,camera,scene};
 }catch(error){status.textContent='Could not load horse';console.error(error);for(const r of Object.values(next))destroy(r);}
 finally{if(serial===loadSerial)horse.disabled=gait.disabled=false;}
}
function setPlaying(value){playing=value;document.querySelector('#play').textContent=playing?'Pause':'Play';}
horse.onchange=()=>load(horse.value);gait.onchange=chooseGait;
document.querySelector('#before').onclick=()=>select('baseline');document.querySelector('#after').onclick=()=>select('candidate');document.querySelector('#compare').onclick=compare;
document.querySelector('#play').onclick=()=>setPlaying(!playing);slider.oninput=()=>{setPlaying(false);seek(Number(slider.value));};
document.querySelector('#peak').onclick=()=>{setPlaying(false);seek({walk:.061,trot:.6976,canterLeft:.156,canterRight:.916}[gait.value]);};
document.querySelector('#close').onclick=()=>{close=!close;document.querySelector('#close').textContent=close?'Whole horse':'Hoof close-up';poseCamera();};
window.addEventListener('resize',resize);resize();
const query=new URLSearchParams(location.search);if(config[query.get('horse')])horse.value=query.get('horse');if(['walk','trot','canterLeft','canterRight'].includes(query.get('gait')))gait.value=query.get('gait');await load(horse.value);
function frame(t){
 const dt=last?Math.min((t-last)/1000,.05):0;last=t;
 if(playing&&Object.keys(rigs).length){for(const r of Object.values(rigs))r.motion.update(dt,{rate:Number(document.querySelector('#speed').value)});phase=rigs.candidate.motion.snapshot().phase01;slider.value=phase;render();}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
