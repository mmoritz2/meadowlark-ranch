import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createBreedLibrary} from '../../assets/breed-models.js';
import {createNativeHorseMotion} from '../../assets/native-horse-motion.js';
const lib=createBreedLibrary({THREE,GLTFLoader,clone});await lib.manifestReady;
const sources={};
const baselineFiles={'white-western':'../native-horse-kit/model.glb','bay-western':'../native-bay-kit/model.glb','bay-sporthorse-native':'../native-bay-sporthorse-kit/model.glb'};
for(const [key,file]of Object.entries(baselineFiles)){
 const asset=await new GLTFLoader().loadAsync(file),profile=lib.profile(key),scene=new THREE.Group(),normalization=new THREE.Group();
 normalization.position.fromArray(profile.nativeTranslation);normalization.scale.setScalar(profile.nativeScale);normalization.add(asset.scene);scene.add(normalization);
 sources[key]={nativeRoot:asset.scene,scene,animations:asset.animations,profile};
}
const ice=await new GLTFLoader().loadAsync('../native-iceland-kit/model.glb');
const anchors=await(await fetch('../native-iceland-kit/anchors.json')).json();
ice.scene.position.fromArray(anchors.sourceToGameTranslation);
sources.iceland={nativeRoot:ice.scene,scene:ice.scene,animations:ice.animations,profile:{nativeBreed:true,nativeKind:'horse',id:'private-iceland',nativeGaits:anchors.gaits,nativeMaxSpeedMps:Math.max(...Object.values(anchors.gaits).map(r=>r.nominalSpeedMps))}};
const v=new THREE.Vector3();
function spectrum(values,harmonic){const mean=values.reduce((a,b)=>a+b,0)/values.length;let c=0,s=0;for(let i=0;i<values.length;i++){const t=i/values.length*2*Math.PI*harmonic;c+=(values[i]-mean)*Math.cos(t);s+=(values[i]-mean)*Math.sin(t);}c*=2/values.length;s*=2/values.length;return{harmonic,amplitudeM:Math.hypot(c,s),phaseRadians:Math.atan2(-s,c)};}
function region(values){return{minimumM:Math.min(...values),maximumM:Math.max(...values),spanM:Math.max(...values)-Math.min(...values),harmonics:[1,2,4].map(n=>spectrum(values,n))};}
window.measureHeadCycles=()=>Object.entries(sources).map(([key,rig])=>{
 const root=rig.nativeRoot,head=root.getObjectByName('head_019'),trunk=root.getObjectByName('spine_04_012');
 if(!head||!trunk)throw Error('Native head/trunk landmarks missing');
 const motion=createNativeHorseMotion({THREE,root,clips:rig.animations,profile:rig.profile});motion.set('walk');motion.update(.2);
 const action=motion.mixer.clipAction(THREE.AnimationClip.findByName(rig.animations,motion.clip)),headY=[],trunkY=[];
 for(let i=0;i<128;i++){action.time=i/128*action.getClip().duration;motion.mixer.update(0);rig.scene.updateMatrixWorld(true);headY.push(head.getWorldPosition(v).y);trunkY.push(trunk.getWorldPosition(v).y);}
 const h=region(headY),t=region(trunkY),difference=((h.harmonics[1].phaseRadians-t.harmonics[1].phaseRadians+Math.PI*3)%(Math.PI*2))-Math.PI;
 const result={key,clip:motion.clip,head:h,trunk:t,secondHarmonicPhaseDifferenceDeg:difference*180/Math.PI,secondHarmonicStrideOffset:Math.abs(difference)/(4*Math.PI),finite:[...headY,...trunkY].every(Number.isFinite),rows:headY.map((y,i)=>({phase:i/128,headY:y,trunkY:trunkY[i]}))};motion.dispose();return result;
});
window.headCycleReady=true;document.querySelector('#status').textContent='Native horse measurement ready';
