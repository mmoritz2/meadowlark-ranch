import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.env.WORLD_HORSE_SOURCE_ROOT?pathToFileURL(process.env.WORLD_HORSE_SOURCE_ROOT+'/'):new URL('../',import.meta.url);
export const THREE=await import(new URL('assets/vendor/three/build/three.module.js',root));
const {GLTFLoader}=await import(new URL('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js',root));
const {clone}=await import(new URL('assets/vendor/three/examples/jsm/utils/SkeletonUtils.js',root));
const {NATIVE_BREED_PROFILES}=await import(new URL('assets/native-breed-profiles.js',root));
const {applyNativeRosterShape}=await import(new URL('assets/native-roster.js',root));
// The actual GLTF parser retains every source accessor, animation sampler,
// hierarchy and bind. Remove only image/material payloads for CPU-only QA.
async function parse(file){const original=fs.readFileSync(new URL(file,root)),length=original.readUInt32LE(12),doc=JSON.parse(original.subarray(20,20+length));delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials||[]).map(()=>({pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]},doubleSided:true}));const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const binary=original.subarray(20+length),out=Buffer.alloc(20+padded.length+binary.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);binary.copy(out,20+padded.length);return new Promise((resolve,reject)=>new GLTFLoader().parse(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'',resolve,reject));}
export async function greyFixture(){
 const source=await parse('review/native-trot-reference-kit/white/model.glb'),motion=await parse('assets/models/horse-motions/white-western.glb'),variant=JSON.parse(fs.readFileSync(new URL('assets/models/native-roster/manifest.json',root))).breeds.grey;
 const profile={...NATIVE_BREED_PROFILES['white-western'],id:'grey',nativeRoster:true,nativeVariant:variant,fitScale:variant.actorScale,withersM:variant.withersM,nativeRosterColors:{body:'#b9bec6',mane:'#787f8a'},nativeSourceSeat:variant.sourceSeat};
 const shape=fs.readFileSync(new URL('assets/models/native-roster/grey.bin',root));applyNativeRosterShape({THREE,gltf:source,spec:profile,binary:shape.buffer.slice(shape.byteOffset,shape.byteOffset+shape.byteLength),coat:new THREE.Texture()});
 const normalized=new THREE.Group();normalized.position.fromArray(profile.nativeTranslation);normalized.add(source.scene);const scene=new THREE.Group();scene.add(normalized);const replaced=new Set(motion.animations.map(a=>a.name));
 const asset={key:'grey',scene,profile,animations:[...source.animations.filter(a=>!replaced.has(a.name)),...motion.animations]};
 function instantiate(a){const scene=clone(a.scene),materials=[],copies=new Map();scene.traverse(o=>{if(o.isMesh){const copy=m=>{if(!copies.has(m)){copies.set(m,m.clone());materials.push(copies.get(m));}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);}});scene.scale.setScalar(a.profile.fitScale);let skin=null;scene.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count===16159)skin=o;});return{...a,scene,nativeRoot:scene.children[0].children[0],skin,bones:skin.skeleton.bones,materials,baseMat:skin.material};}
 return{asset,instantiate};
}
