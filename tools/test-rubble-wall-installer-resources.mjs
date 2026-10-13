import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createCoursedFieldWallGeometry as create,installCoursedFieldWalls as install} from '../assets/coursed-field-wall.mjs';
import {installCoursedFieldWalls as installBefore} from './fixtures/fieldstone-wall-a78ed79/coursed-field-wall-before.mjs';
const record=(x,z,yaw)=>({x,z,tx:Math.cos(yaw),tz:Math.sin(yaw),nx:-Math.sin(yaw),nz:Math.cos(yaw),legacyRows:[20,21,22,23,24]});
const bytes=d=>['positions','normals','uvs','colors','indices'].reduce((sum,k)=>sum+d[k].byteLength,0);
function options(){
 const scene=new T.Scene(),legacy=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial(),6);
 for(let i=0;i<6;i++)legacy.setMatrixAt(i,new T.Matrix4().makeTranslation(i===5?20:(i-2)*.2,.5,i===5?20:0));
 scene.add(legacy);const loaded=[];
 return {loaded,THREE:{...T,TextureLoader:class{async loadAsync(url){loaded.push(url);return new T.Texture();}}},scene,legacy,records:[{...record(0,0,0),legacyRows:[0,1,2,3,4]}],groundH:()=>0,anisotropy:7};
}
async function rngInstall(factory){
 const o=options(),old=Math.random;let state=123456789,calls=0;
 const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 Math.random=()=>{calls++;return next();};
 let wall;try{wall=await factory(o);}finally{Math.random=old;}
 return {o,wall,calls,future:Array.from({length:24},next)};
}
test('actual rubble installer keeps constructor RNG stream, three resident maps and one mesh draw owner',async()=>{
 const old=await rngInstall(installBefore),now=await rngInstall(install);
 assert.equal(now.calls,old.calls);assert.deepEqual(now.future,old.future,'No future seeded constructor stream drift');
 assert.deepEqual(now.o.loaded,old.o.loaded);assert.equal(now.o.loaded.length,3);
 const material=now.wall.mesh.material;
 assert.equal(new Set([material.map,material.normalMap,material.roughnessMap]).size,3);
 for(const map of [material.map,material.normalMap,material.roughnessMap]){assert.equal(map.wrapS,T.RepeatWrapping);assert.equal(map.wrapT,T.RepeatWrapping);assert.equal(map.anisotropy,7);}
 assert.equal(material.map.colorSpace,T.SRGBColorSpace);assert.equal(material.normalMap.colorSpace,T.NoColorSpace);assert.equal(material.roughnessMap.colorSpace,T.NoColorSpace);
 assert.equal(material.aoMap,null);assert.equal(material.metalness,0);assert.equal(material.roughness,1);assert.equal(material.envMapIntensity,.5);
 assert.equal(material.color.getHexString(),'c6c2b6');assert.deepEqual(material.normalScale.toArray(),[.42,.42]);
 const shader={fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('diffuseColor.rgb,.72)'));assert(!shader.fragmentShader.includes('texture2D('),'No added texture fetch or alpha card shading');
 assert.equal(material.customProgramCacheKey(),'coursed-fieldstone-v3');
 assert.equal(now.wall.mesh.name,'worldPaths:coursedFieldWalls');assert(now.wall.mesh.castShadow&&now.wall.mesh.receiveShadow);
 assert.equal(now.o.scene.children.length,2);assert.equal(now.wall.drawCalls,1);
 assert.equal(now.wall.submittedAddedTriangles,552);assert.equal(now.wall.legacySubmittedTriangles,72,'Retired legacy instance slots remain submitted');
 assert.equal(bytes(create(now.o.records,()=>0)),79488);
});
