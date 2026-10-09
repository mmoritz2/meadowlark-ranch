import assert from 'node:assert/strict';
import test from 'node:test';
import {createCoursedFieldWallGeometry} from '../assets/coursed-field-wall.mjs';
const record=(x,z,yaw)=>({x,z,tx:Math.cos(yaw),tz:Math.sin(yaw),nx:-Math.sin(yaw),nz:Math.cos(yaw),legacyRows:[20,21,22,23,24]});
test('coursed kits are deterministic, finite and within the 280 triangle budget',()=>{
 const records=[record(65,-128,.75),record(-13,4,-2)];
 const a=createCoursedFieldWallGeometry(records,()=>0),b=createCoursedFieldWallGeometry(records,()=>0);
 assert.deepEqual(a,b);assert.equal(a.triangles,560);assert(a.units.every(u=>u.triangles===280));
 for(const key of ['positions','normals','uvs','colors'])assert(a[key].every(Number.isFinite));
 assert(a.indices.every(i=>i<a.positions.length/3));
 for(let i=0;i<a.normals.length;i+=3)assert(Math.abs(Math.hypot(...a.normals.slice(i,i+3))-1)<1e-6);
});
test('wall silhouettes stay inside the old collision footprint at arbitrary yaw',()=>{
 for(const yaw of[0,.3,1.5,2.5,-3]){
  const r=record(65,-128,yaw),a=createCoursedFieldWallGeometry([r],()=>3);
  for(let i=0;i<a.positions.length;i+=3){const [x,y,z]=a.positions.slice(i,i+3),dx=x-r.x,dz=z-r.z;
   assert(Math.abs(dx*r.tx+dz*r.tz)<.576);assert(Math.abs(dx*r.nx+dz*r.nz)<.351);
   assert(y>2.93&&y<3.96);
  }
 }
});
test('all triangles have outward consistent winding, area and normals',()=>{
 const a=createCoursedFieldWallGeometry([record(2,3,.9)],()=>0);
 for(let k=0;k<a.indices.length;k+=3){const ps=[0,1,2].map(i=>Array.from(a.positions.slice(a.indices[k+i]*3,a.indices[k+i]*3+3))),A=ps[1].map((v,i)=>v-ps[0][i]),B=ps[2].map((v,i)=>v-ps[0][i]);
  const N=[A[1]*B[2]-A[2]*B[1],A[2]*B[0]-A[0]*B[2],A[0]*B[1]-A[1]*B[0]],n=a.normals.slice(a.indices[k]*3,a.indices[k]*3+3);
  assert(Math.hypot(...N)>1e-6);assert(N.reduce((s,v,i)=>s+v*n[i],0)>0);
 }
});
test('sloped units stay seated and do not exceed one metre above their local terrain',()=>{
 const ground=(x,z)=>x*.15-z*.12,r=record(65,-128,.7),a=createCoursedFieldWallGeometry([r],ground);
 let min=Infinity,max=-Infinity;for(let i=0;i<a.positions.length;i+=3){const [x,y,z]=a.positions.slice(i,i+3);min=Math.min(min,y-ground(x,z));max=Math.max(max,y-ground(x,z));}
 assert(min<0&&min>-.24);assert(max<.96&&max>.85);
});
test('geometry creation consumes no random numbers and keeps authored records exact',()=>{
 const records=[record(65,-128,.7)],before=structuredClone(records),old=Math.random;let calls=0;Math.random=()=>{calls++;throw Error('random consumption');};
 try{createCoursedFieldWallGeometry(records,()=>0);}finally{Math.random=old;}
 assert.equal(calls,0);assert.deepEqual(records,before);
});

import * as THREE from '../assets/vendor/three/build/three.module.js';
import {installCoursedFieldWalls} from '../assets/coursed-field-wall.mjs';
import {install as installCourseClear} from '../assets/features/course-clear.js';
const fakeThree={...THREE,TextureLoader:class{async loadAsync(){return new THREE.Texture();}}};
function legacyScene(){
 const scene=new THREE.Scene(),legacy=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial(),6);
 for(let i=0;i<6;i++)legacy.setMatrixAt(i,new THREE.Matrix4().makeTranslation(i===5?20:(i-2)*.2,.5,i===5?20:0));
 scene.add(legacy);const r={...record(0,0,0),legacyRows:[0,1,2,3,4]};
 return {THREE:fakeThree,scene,legacy,records:[r],groundH:()=>0};
}
const matrixAt=(legacy,i)=>{const m=new THREE.Matrix4();legacy.getMatrixAt(i,m);return m;};
test('real course-clear rebuild retires the corresponding new wall while preserving row references',async()=>{
 const options=legacyScene(),unrelated=matrixAt(options.legacy,5).toArray(),state=await installCoursedFieldWalls(options);
 assert.equal(state.unitCount,1);assert(state.retiredRows.every(i=>matrixAt(options.legacy,i).determinant()===0));
 assert.equal(state.visibleSourceTrianglesRetired,60);assert.equal(state.legacySubmittedTriangles,72);
 const oldWindow=globalThis.window;globalThis.window={};
 try{
  const G={THREE,scene:options.scene,tables:{RACE_ROUTES:{test:[[100,100],[110,100]]},EVENTS3:[]},world:{colliders:[]},worldPaths:{fieldWallArt:state},on(){}};
  installCourseClear(G);assert.equal(state.activeUnitCount,1);
  G.tables.RACE_ROUTES.test=[[-8,0],[8,0]];G.courseClear.rebuild();
  assert.equal(state.activeUnitCount,0);assert.equal(state.visibleTriangles,0);assert.equal(state.units[0].visible,false);
  const unit=state.units[0],index=state.mesh.geometry.index;
  assert(Array.from(index.array.slice(unit.indexStart,unit.indexStart+unit.indexCount)).every(i=>i===index.getX(unit.indexStart)));
  assert.deepEqual(matrixAt(options.legacy,5).toArray(),unrelated);
  G.courseClear.rebuild();assert.equal(state.activeUnitCount,0,'cleared walls must not regrow');
 }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});
test('partial clearing removes the full replacement and preserves only original surviving rocks',async()=>{
 const options=legacyScene(),saved=[0,1,2,3,4].map(i=>matrixAt(options.legacy,i).toArray()),state=await installCoursedFieldWalls(options);
 state.beforeCourseClear();options.legacy.setMatrixAt(2,new THREE.Matrix4().makeScale(0,0,0));state.afterCourseClear();
 assert.equal(state.activeUnitCount,0);assert.equal(state.skipped.at(-1).status,'partially-cleared');
 for(const i of[0,1,3,4])assert.deepEqual(matrixAt(options.legacy,i).toArray(),saved[i]);
 assert.equal(matrixAt(options.legacy,2).determinant(),0);
 state.beforeCourseClear();state.afterCourseClear();assert.equal(matrixAt(options.legacy,2).determinant(),0);
});
test('failed texture loading leaves all legacy visibility and the scene unchanged',async()=>{
 const options=legacyScene(),saved=options.legacy.instanceMatrix.array.slice(),count=options.scene.children.length;
 options.THREE={...THREE,TextureLoader:class{async loadAsync(){throw Error('test missing texture');}}};
 await assert.rejects(installCoursedFieldWalls(options),/test missing texture/);
 assert.deepEqual(options.legacy.instanceMatrix.array,saved);assert.equal(options.scene.children.length,count);
});
test('clearing while textures load cannot reintroduce the retired unit',async()=>{
 const options=legacyScene(),pending=[];
 options.THREE={...THREE,TextureLoader:class{loadAsync(){return new Promise(resolve=>pending.push(()=>resolve(new THREE.Texture())));}}};
 const ready=installCoursedFieldWalls(options);
 options.legacy.setMatrixAt(2,new THREE.Matrix4().makeScale(0,0,0));pending.forEach(resolve=>resolve());
 const state=await ready;assert.equal(state.unitCount,0);assert.equal(options.scene.children.length,1);
 assert.equal(matrixAt(options.legacy,2).determinant(),0);
});


test('small bevels and narrow end stones retain planar outward triangles across regression seeds',()=>{
 const seeds=[
  [223.86042334721745,-183.8439625411234,-1.261903447],
  [238.13363077737867,-156.59045934756398,.75],
  [240.73481296433908,-163.25631397551928,1.3],
  [208.71398089220747,-29.732302373740822,-.4],
 ];
 for(let i=0;i<96;i++)seeds.push([Math.sin(i*7.13)*310,Math.cos(i*11.71)*310,i*.317]);
 for(const slope of[0,.14]){
  const a=createCoursedFieldWallGeometry(seeds.map(([x,z,yaw])=>record(x,z,yaw)),(x,z)=>x*slope-z*slope*.7);
  for(let k=0;k<a.indices.length;k+=3){
   const ps=[0,1,2].map(j=>Array.from(a.positions.subarray(a.indices[k+j]*3,a.indices[k+j]*3+3)));
   const u=ps[1].map((v,j)=>v-ps[0][j]),v=ps[2].map((v,j)=>v-ps[0][j]);
   const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],area=Math.hypot(...cross);
   const normal=a.normals.subarray(a.indices[k]*3,a.indices[k]*3+3),alignment=cross.reduce((sum,n,j)=>sum+n*normal[j],0);
   assert(area>1e-6,'No bevel triangle collapses');
   assert(alignment>area*.95,'Every fan triangle agrees with its complete planar face normal');
  }
 }
});
