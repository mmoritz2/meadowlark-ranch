import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createBreedLibrary} from '../../assets/breed-models.js?v=horse-art-20261009b';
import {createNativeHorseMotion} from '../../assets/native-horse-motion.js?v=horse-art-20261009b';
import {nativeGroomFacade} from '../../assets/game-hero-horse.js?v=horse-art-20261009b';
import {configureNativeCustomization} from '../../assets/native-horse-customization.js?v=natural-mane-20261009';
import {registerNewBreedPreviews} from '../../assets/features/new-breeds.js?v=horse-quality-1';
import {registerRosterPreviews} from '../../assets/features/horse-roster.js?v=natural-mane-20261009';
import {registerClubHorsePreviews} from '../../assets/features/clubs-boards.js?v=native-tack-fit-1';
import {registerMarketHorsePreviews} from '../../assets/features/market-summon-keys-pets.js?v=native-tack-fit-1';
import {EXPANSION_HORSE_BREEDS} from '../../assets/expansion-horses.js?v=horses-expansion-1';
import {registerExpansionHorseCoats} from '../../assets/expansion-horse-coats.js?v=horses-expansion-1';
import {NATIVE_HORSE_MATERIAL_VERSION,NATIVE_HORSE_MATERIAL_FINISH} from '../../assets/native-horse-materials.js?v=native-surface-2';
import {createStoreZip} from './capture-zip.mjs';

const $=id=>document.getElementById(id),WIDTH=640,HEIGHT=480;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(WIDTH,HEIGHT);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('stage').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#d8d9d2');
const camera=new THREE.PerspectiveCamera(35,WIDTH/HEIGHT,.03,70);
const envWidth=128,envHeight=64,envData=new Uint8Array(envWidth*envHeight*4);
for(let y=0;y<envHeight;y++)for(let x=0;x<envWidth;x++){
 const sky=Math.max(0,Math.cos(y/(envHeight-1)*Math.PI)),softbox=Math.exp(-((x/envWidth-.22)**2/.025+(y/envHeight-.35)**2/.06)),i=(y*envWidth+x)*4;
 envData[i]=Math.min(255,130+sky*65+softbox*35);envData[i+1]=Math.min(255,132+sky*65+softbox*35);envData[i+2]=Math.min(255,128+sky*70+softbox*35);envData[i+3]=255;
}
const envTexture=new THREE.DataTexture(envData,envWidth,envHeight);envTexture.mapping=THREE.EquirectangularReflectionMapping;envTexture.colorSpace=THREE.SRGBColorSpace;envTexture.needsUpdate=true;
const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(envTexture);scene.environment=environment.texture;envTexture.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xf4f6ff,0x8b8977,2.2));
const sun=new THREE.DirectionalLight(0xfff1df,2.4);sun.position.set(-3,7,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:15});sun.shadow.normalBias=.014;sun.shadow.bias=-.0001;scene.add(sun);
const fill=new THREE.DirectionalLight(0xe8f0ff,1.15);fill.position.set(4,3,-2);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xb4b8aa,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const lib=createBreedLibrary({THREE,GLTFLoader,clone}),rows=new Map();
registerExpansionHorseCoats();
for(const row of [...registerNewBreedPreviews(lib),...registerRosterPreviews(lib),...registerClubHorsePreviews(lib),...registerMarketHorsePreviews(lib),...EXPANSION_HORSE_BREEDS]){
 rows.set(row[0],row);if(row[7]?.body)lib.alias(row[0],row[7].body,row);
}
let allKeys=[],priorKeys=[],current=null,running=false,cancel=false,downloadURL=null;
const fatalErrors=[];
renderer.debug.onShaderError=(gl,program)=>{fatalErrors.push('Shader compilation failed: '+gl.getProgramInfoLog(program));};
window.addEventListener('error',event=>fatalErrors.push(event.message||'Page error'));
window.addEventListener('unhandledrejection',event=>fatalErrors.push(String(event.reason?.message||event.reason)));
const tick=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const log=value=>{$('log').textContent+=value+'\n';$('log').scrollTop=$('log').scrollHeight;};
function release(){
 if(!current)return;const {horse,inst,motion,groom}=current;
 motion?.dispose();groom?.dispose();inst.nativeCustomization?.dispose();inst.nativeFantasy?.dispose();scene.remove(horse);
 const skeletons=new Set();inst.scene.traverse(mesh=>{if(mesh.isSkinnedMesh)skeletons.add(mesh.skeleton);});for(const skeleton of skeletons)skeleton.dispose();
 for(const material of inst.materials||[])material.dispose();
 // Only this isolated capture owns active actors. Release GPU buffers between
 // portraits; immutable cached CPU geometry remains available to instantiate.
 const geometries=new Set();inst.scene.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry)geometries.add(mesh.geometry);});for(const geometry of geometries)geometry.dispose();
 renderer.renderLists.dispose();current=null;
}
function pointsFor(horse){
 const points=[],box=new THREE.Box3(),bones=new Set(),meshes=[],point=new THREE.Vector3();let finite=true;
 horse.updateWorldMatrix(true,true);horse.updateMatrixWorld(true);
 const add=()=>{finite&&=point.toArray().every(Number.isFinite);box.expandByPoint(point);points.push(point.x,point.y,point.z);};
 horse.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  const positions=mesh.geometry.attributes.position;meshes.push({name:mesh.name,vertices:positions.count,skinned:!!mesh.isSkinnedMesh});
  if(mesh.isSkinnedMesh){mesh.skeleton.update();for(const bone of mesh.skeleton.bones){bones.add(bone);finite&&=bone.matrixWorld.elements.every(Number.isFinite);}}
  if(mesh.isInstancedMesh){mesh.computeBoundingBox();const b=mesh.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){point.set(x,y,z).applyMatrix4(mesh.matrixWorld);add();}}
  else for(let i=0;i<positions.count;i++){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);add();}
 });
 if(!finite||box.isEmpty()||bones.size!==677)throw Error('Expected one finite677-joint equine');
 return {points:new Float32Array(points),box,bones:bones.size,meshes};
}
function frame(geometry){
 const target=geometry.box.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(-.84,.12,.55).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
 const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),p=new THREE.Vector3();let distance=1.4;
 for(let i=0;i<geometry.points.length;i+=3){p.fromArray(geometry.points,i).sub(target);const depth=p.dot(direction);distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tan*camera.aspect*.88),depth+Math.abs(p.dot(up))/(tan*.86));}
 camera.position.copy(target).addScaledVector(direction,distance*1.025);camera.lookAt(target);camera.updateMatrixWorld(true);
 const projected={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity};
 for(let i=0;i<geometry.points.length;i+=3){p.fromArray(geometry.points,i).project(camera);projected.left=Math.min(projected.left,p.x);projected.right=Math.max(projected.right,p.x);projected.bottom=Math.min(projected.bottom,p.y);projected.top=Math.max(projected.top,p.y);}
 if(Object.values(projected).some(v=>!Number.isFinite(v))||projected.left<-.99||projected.right>.99||projected.top>.99||projected.bottom<-.99)throw Error('Horse framing failed');
 return {projected,camera:camera.position.toArray(),target:target.toArray(),bounds:{min:geometry.box.min.toArray(),max:geometry.box.max.toArray()}};
}
async function capture(key){
 release();const asset=await lib.load(key),inst=lib.instantiate(asset),spec=inst.profile;
 if(spec.nativeKind!=='horse'||spec.nativeDragon)throw Error('Non-equine profile: '+key);
 const horse=new THREE.Group();horse.add(inst.scene);scene.add(horse);horse.updateMatrixWorld(true);current={horse,inst,motion:null,groom:null};
 const row=rows.get(key);
 if(row&&!row[7]?.coat)configureNativeCustomization({THREE,rig:inst,defaults:row,horse:{id:'thumbnail-'+key,breed:key,colors:{body:row[5],mane:row[7]?.maneCol||row[6]},mark:row[7]?.mark,markCol:row[7]?.markCol}});
 const motion=createNativeHorseMotion({THREE,root:inst.nativeRoot,clips:inst.animations,profile:spec});current.motion=motion;motion.set('rest');motion.update(0);inst.nativeFantasy?.update(0);
 const groom=nativeGroomFacade({THREE,scene:inst.scene,skin:inst.skin,mount:inst.scene,profile:spec});
 current={horse,inst,motion,groom};horse.updateMatrixWorld(true);
 const geometry=pointsFor(horse),framing=frame(geometry);await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
 if(fatalErrors.length)throw Error(fatalErrors[fatalErrors.length-1]);
 const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/webp',.93));
 if(!blob||blob.type!=='image/webp'||blob.size<5000)throw Error('WebP portrait encoding failed');
 const bytes=new Uint8Array(await blob.arrayBuffer()),body=inst.skin.geometry.attributes.position.array;
 const record={key,name:spec.name,sha256:await digest(bytes),bytes:bytes.length,bones:geometry.bones,vertices:geometry.meshes.reduce((n,m)=>n+m.vertices,0),projectedBounds:framing.projected,
  framing,asset:{file:spec.file,sha256:spec.sha256,variant:spec.nativeVariant?{id:spec.nativeVariant.id,sha256:spec.nativeVariant.sha256,headShape:spec.nativeVariant.headShape?.family||null,groom:spec.nativeVariant.groom?.uprightCrest?.style||null}:null,
   geometryHash:await digest(new Uint8Array(body.buffer,body.byteOffset,body.byteLength)),artist:spec.artist,license:spec.license,conformation:spec.conformation,coat:spec.coat,sourceWesternTack:true},
  material:inst.nativeMaterialPolish,groom:groom.stats,customization:inst.nativeCustomization?.applied||null,pose:motion.snapshot()};
 $('current').textContent=spec.name+' · '+geometry.bones+' joints · '+bytes.length.toLocaleString()+' bytes';
 await tick();return {name:'assets/breed-thumbnails/'+key+'.webp',data:bytes,record};
}
async function start(){
 if(running)return;let keys=allKeys;
 const requested=$('subset').value.trim();if(requested){keys=[...new Set(requested.split(/[\s,]+/).filter(Boolean))];const invalid=keys.filter(k=>!allKeys.includes(k));if(invalid.length){$('status').textContent='Unknown equine IDs: '+invalid.join(', ');return;}}
 running=true;cancel=false;$('start').disabled=true;$('cancel').disabled=false;$('subset').disabled=true;$('download').hidden=true;$('log').textContent='';
 if(downloadURL){URL.revokeObjectURL(downloadURL);downloadURL=null;}
 $('progress').max=keys.length;$('progress').value=0;fatalErrors.length=0;
 const entries=[],records=[],errors=[];const startedAt=new Date().toISOString();
 try{
  for(const key of keys){
   if(cancel)break;$('status').textContent=`${records.length+1} of ${keys.length}: ${lib.profile(key).name}`;await tick();
   try{const result=await capture(key);entries.push({name:result.name,data:result.data});records.push(result.record);log('✓ '+key+' · '+Math.round(result.data.length/1024)+' KB');$('progress').value=records.length;}
   catch(error){errors.push({key,message:String(error?.message||error)});log('Failed '+key+': '+errors.at(-1).message);break;}
  }
  const complete=!cancel&&!errors.length&&!fatalErrors.length&&records.length===keys.length;
  const report={schemaVersion:1,render:'Actual production native677 library, current materials and groom, source Western tack, standing rest pose',startedAt,completedAt:new Date().toISOString(),complete,
   width:WIDTH,height:HEIGHT,background:'#d8d9d2',materialVersion:NATIVE_HORSE_MATERIAL_VERSION,materialFinish:NATIVE_HORSE_MATERIAL_FINISH,
   requestedKeys:keys,capturedKeys:records.map(r=>r.key),excluded:'Creator dragons and artist-study; existing files/index entries retained',errors:[...errors,...fatalErrors.map(message=>({message}))],records};
  if(records.length){
   entries.push({name:'assets/breed-thumbnails/index.json',data:JSON.stringify([...new Set([...priorKeys,...records.map(r=>r.key)])],null,2)+'\n'});
   entries.push({name:'assets/models/native-roster/thumbnail-review.json',data:JSON.stringify(report,null,2)+'\n'});
   const zip=createStoreZip(entries);downloadURL=URL.createObjectURL(zip);$('download').href=downloadURL;$('download').download=`horse-portraits-${complete?'complete':'partial'}-${records.length}.zip`;$('download').hidden=false;
   $('download').textContent=`Download ${records.length} portraits ZIP`;
  }
  $('status').textContent=complete?`Complete: ${records.length} portraits. Ready to download.`:`Stopped after ${records.length} of ${keys.length}. ${errors[0]?.message||'Partial ZIP available.'}`;
 }finally{running=false;$('start').disabled=false;$('cancel').disabled=true;$('subset').disabled=false;}
}
$('start').addEventListener('click',()=>start().catch(error=>{$('status').textContent='Capture failed: '+error.message;log(String(error.stack||error));}));
$('cancel').addEventListener('click',()=>{cancel=true;$('status').textContent='Stopping after this portrait…';});
try{
 const [manifest,index]=await Promise.all([lib.manifestReady,fetch('../../assets/breed-thumbnails/index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Thumbnail index HTTP '+r.status);return r.json();})]);
 priorKeys=Array.isArray(index)?index:[];allKeys=Object.entries(manifest.breeds).filter(([key,p])=>key!=='artist-study'&&p.nativeBreed&&p.nativeKind==='horse'&&!p.nativeDragon&&!p.dragonVariant).map(([key])=>key).sort();
 if(!allKeys.length)throw Error('No native equines in current catalog');
 $('keys').textContent=allKeys.join(', ');$('status').textContent=`Ready: ${allKeys.length} equines.`;$('current').textContent='Press Start to render the first horse.';$('start').disabled=false;
 $('subset').value=new URLSearchParams(location.search).get('horses')||'';
}catch(error){$('status').textContent='Catalog failed: '+error.message;log(String(error.stack||error));}
window.addEventListener('pagehide',()=>{release();if(downloadURL)URL.revokeObjectURL(downloadURL);environment.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();});
