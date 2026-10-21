// Actual asset/animation integration for the replacement anatomical head.
// Textures are CPU placeholders; source geometry, bones, garments and public
// rider methods are the production implementations. No browser or network.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {register} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const root=process.env.RIDER_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url)),prefix=pathToFileURL(root.endsWith('/')?root:root+'/').href,threeURL=prefix+'assets/vendor/three/build/three.module.js';
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeURL)},shortCircuit:true};if(s.startsWith('three/addons/'))return{url:${JSON.stringify(prefix+'assets/vendor/three/examples/jsm/')}+s.slice(13),shortCircuit:true};let u;try{u=new URL(s,c.parentURL);}catch{}if(u?.href.startsWith(${JSON.stringify(prefix)})){u.search='';return{url:u.href,shortCircuit:true};}return n(s,c);}`));
const T=await import(threeURL),{GLTFLoader}=await import(prefix+'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),{clone}=await import(prefix+'assets/vendor/three/examples/jsm/utils/SkeletonUtils.js'),{createRiderLibrary}=await import(prefix+'assets/rider-model.js'),{createRiderMaterialLifecycle}=await import(prefix+'assets/rider-material-lifecycle.js');
class CPUAssets extends GLTFLoader{
 constructor(){super();this.register(parser=>({name:'CPU_MATERIALS',loadMaterial(i){const m=new T.MeshStandardMaterial();m.name=parser.json.materials[i].name||'';return Promise.resolve(m);}}));}
 load(url,ok,_progress,no){this.loadAsync(url).then(ok,no);}
 async loadAsync(url){const b=fs.readFileSync(fileURLToPath(url));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
}
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),RJ=vm.runInNewContext('('+read('ranch3d.html').match(/const RJ=(\{[\s\S]*?\n\});/)[1]+')'),connectedData=Object.fromEntries(fs.readdirSync(path.join(root,'assets/models/rider/connected')).filter(f=>f.endsWith('.json')).map(f=>[f.slice(0,-5),JSON.parse(read('assets/models/rider/connected/'+f))]));
const values=(a,i)=>Array.from({length:a.itemSize},(_,k)=>a[['getX','getY','getZ','getW'][k]](i)),compile=m=>{const s={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};m.onBeforeCompile(s);return s;};
for(const body of ['f','m'])test(`${body}: anatomical head joins the exact body seam, follows animations, and keeps appearance/lifetime`,async()=>{
 const lifecycle=createRiderMaterialLifecycle(),lib=createRiderLibrary({THREE:T,GLTFLoader:CPUAssets,clone,RJ,connectedData,riderMaterialLifecycle:lifecycle}),kit=await lib.kit(body),fit={body,outfit:'riding',hairStyle:'long',helmet:'none',skin:'#e3a37d',eyes:'hazel',hair:'#4a2e1c',shirt:'#3d4a6e',pants:'#cfc6ae'},rig=lib.build(kit,fit);
 try{
  assert.equal(kit.skin.skeleton.bones.length,65);assert.equal(lifecycle.inspect().liveRigs,1);assert(kit.headAsset.portrait99);const head=rig.face.geometry,skin=kit.skin.geometry,meta=head.userData.portrait99;
  assert.equal(meta.oldFaceDeformationsApplied,false);assert.equal(meta.neckBodyVertices,84);assert(head.attributes.position.count>22000);
  for(let k=0;k<84;k++){const hi=head.userData.neckBoundary[k],bi=head.userData.neckBodyBoundary[k];for(const key of ['position','normal','skinIndex','skinWeight'])assert.deepEqual(values(head.attributes[key],hi),values(skin.attributes[key],bi),'Exact stitched body '+key);}
  for(let i=0;i<head.attributes.position.count;i++){assert(values(head.attributes.position,i).every(Number.isFinite));assert(Math.abs(values(head.attributes.skinWeight,i).reduce((a,b)=>a+b,0)-1)<1e-6);assert(values(head.attributes.skinIndex,i).every(j=>j>=0&&j<65));}
  for(const eye of kit.headAsset.portrait99.eyes)assert(eye.radius>.011&&eye.radius<.013,'Human scale globe');
  const eyePosition=rig.eyes.geometry.attributes.position,half=eyePosition.count/2,centers=[];
  for(let side=0;side<2;side++){const box=new T.Box3();for(let i=side*half;i<(side+1)*half;i++)box.expandByPoint(new T.Vector3().fromBufferAttribute(eyePosition,i).applyMatrix4(rig.u.uFaceBind.value));const size=box.getSize(new T.Vector3());assert(size.x>.022&&size.x<.027);centers.push(box.getCenter(new T.Vector3()));}
  assert(centers[0].distanceTo(centers[1])>.060&&centers[0].distanceTo(centers[1])<.070,'Adult eye separation');
  const skinUniform=rig.u.uSkin,eyeUniform=rig.u.uEye,bodyPositions=Array.from(rig.body.geometry.attributes.position.array);
  for(const action of ['idle','walk','sprint']){rig.mixer.stopAllAction();rig.action(action).reset().play();rig.mixer.setTime(.4);rig.root.updateMatrixWorld(true);rig.face.skeleton.update();for(const i of [0,1000,head.attributes.position.count-1])assert(rig.face.getVertexPosition(i,new T.Vector3()).toArray().every(Number.isFinite));}
  rig.setLook({...fit,skin:'#744c3a',eyes:'blue',hair:'#8a4a25'});assert(rig.u.uSkin.value.equals(new T.Color('#744c3a')));assert(rig.u.uEye.value.equals(new T.Color('#4a7ec0')));assert.equal(compile(rig.face.material).uniforms.uSkin,skinUniform);assert.equal(compile(rig.eyes.material).uniforms.uEye,eyeUniform);
  for(const outfit of ['polo','riding'])await new Promise((resolve,reject)=>{try{rig.setOutfit(outfit,()=>{try{assert(lifecycle.has(rig));assert(rig.hair99.evidence().installed);resolve();}catch(e){reject(e);}});}catch(e){reject(e);}});
  assert.deepEqual(Array.from(rig.body.geometry.attributes.position.array),bodyPositions,'Changing outfit never reshapes body');
 }finally{rig.dispose();assert.equal(lifecycle.inspect().liveRigs,0);lifecycle.dispose();}
});
