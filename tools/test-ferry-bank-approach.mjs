// ribbon-falls-2: restore only exact parent Water for this historical source contract.
import{normalizeRibbonFallsSource as ribbonParent}from'./ribbon-falls-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
import {createFollowCamera} from '../assets/follow-camera.js';
import {resolveGroundedContact} from '../assets/grounded-contact.mjs';
import {planFerryBankApproach,createFerryBankApproach,installFerryBankApproach,clearFerryApproachPlants} from '../assets/ferry-bank-approach.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),site=JSON.parse(read('./fixtures/ferry-bank-7908e80/site.json'));
const buffer=fs.readFileSync(new URL('./fixtures/ferry-bank-7908e80/terrain-grid.f32',import.meta.url)),grid=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4),N=513,step=1000/512;
function terrainH(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*N+ix,a=grid[i],b=grid[i+N],c=grid[i+N+1],d=grid[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const options={dock:site.dock,terrainH,colliders:site.colliders,walls:site.walls},plan=planFerryBankApproach(options),material=new T.MeshStandardMaterial({name:'Existing aged ferry deck'});material.userData.metres=.7;
const meshData=()=>createFerryBankApproach(T,plan,material,terrainH);
const approvedOwners=JSON.parse(read('./fixtures/river-combined-source-7908e80.json'));
function restoreApprovedOwners(source,edits){for(const {after,before}of edits){assert.equal(source.split(after).length,2,'Exactly one declared owner addition: '+after.slice(0,90));source=source.replace(after,before);}return source;}


test('actual native-grid endpoint is the shortest clear bounded gentle approach with a full mounted-radius deck overlap',()=>{
 assert.equal(plan.run,7.5);assert(plan.dryV-plan.startV>.64);assert(plan.dryV-plan.startV>.55);
 assert(Math.abs(plan.world(0,plan.endV).z-181.8688610426534)<1e-6);assert(Math.abs(plan.heightAt(...Object.values(plan.world(0,plan.endV)))-(terrainH(...Object.values(plan.world(0,plan.endV)))+.025))<1e-6);
 assert(plan.minGroundGap>=.012);let maxGrade=0,minGap=Infinity;
 for(let j=0;j<=100;j++)for(let i=0;i<=24;i++){const u=(i/24-.5)*2.5999,v=plan.startV+(plan.endV-plan.startV)*j/100,q=plan.world(u,v),h=plan.heightAt(q.x,q.z);assert(Number.isFinite(h));minGap=Math.min(minGap,h-terrainH(q.x,q.z));
  if(j>2&&j<99){const a=plan.world(u,v-.01),b=plan.world(u,v+.01);maxGrade=Math.max(maxGrade,Math.abs(plan.heightAt(b.x,b.z)-plan.heightAt(a.x,a.z))/.02);}
 }
 assert(minGap>.02);assert(maxGrade<.36);assert(Math.abs(plan.heightAt(site.dock.x,site.dock.z+site.dock.length/2)-site.dock.y)<1e-6);
 const blocked={x:134,z:177,r:1};assert.throws(()=>planFerryBankApproach({...options,colliders:[blocked]}),/No clear bounded/);
});

test('every walkable sampler hit matches the actual connected top triangles; finite closed floor/supports reuse the exact material',()=>{
 const out=meshData(),p=out.mesh.geometry.attributes.position,idx=out.mesh.geometry.index,solid=createSolidWorld({THREE:T});out.mesh.updateMatrixWorld(true);const added=solid.registerSurface(out.mesh);assert.equal(added,idx.count/3);assert.equal(out.mesh.material,material);assert(out.mesh.castShadow&&out.mesh.receiveShadow);
 assert(Array.from(p.array).every(Number.isFinite));assert.equal(p.count,out.mesh.geometry.attributes.uv.count);assert.equal(p.count,out.mesh.geometry.attributes.normal.count);let error=0,minArea=Infinity;
 for(let row=0;row<100;row++)for(let col=0;col<40;col++){const u=(-.5+(col+.37)/40)*2.6,v=plan.startV+(row+.41)/100*(plan.endV-plan.startV),q=plan.world(u,v);error=Math.max(error,Math.abs(solid.surfaceHeight(q.x,q.z,out.mesh)-out.heightAt(q.x,q.z)));}
 for(let i=0;i<idx.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,idx.getX(i)),b=new T.Vector3().fromBufferAttribute(p,idx.getX(i+1)),c=new T.Vector3().fromBufferAttribute(p,idx.getX(i+2));minArea=Math.min(minArea,b.sub(a).cross(c.sub(a)).length()/2);}
 assert(error<1e-7);assert(minArea>1e-7);assert.equal(solid.register(out.mesh,{primitives:true}),0,'No tall whole-ramp primitive AABB blocks the lane');assert.equal(solid.surfaceStats().owners,1);
 assert.equal(plan.heightAt(0,0),-Infinity);assert.equal(plan.contains(0,0),false);
});

test('the original mounted body controller crosses the whole actual ramp in both directions with no sideways rejection or slab overlap',()=>{
 const out=meshData(),solid=createSolidWorld({THREE:T});solid.registerSurface(out.mesh);const heightAt=(x,z)=>Math.max(terrainH(x,z),out.heightAt(x,z));
 for(const side of[-.75,0,.75])for(const reverse of[false,true]){let previous=null;for(let i=0;i<=160;i++){const t=reverse?1-i/160:i/160,v=plan.startV+.07+(plan.endV-plan.startV-.14)*t,q=plan.world(side,v),position={...q},foot=heightAt(q.x,q.z);
   resolveGroundedContact(solid,position,{heightAt,previous});assert(Math.hypot(position.x-q.x,position.z-q.z)<1e-7);assert.equal(solid.surfaceContacts(position,{bottom:foot+.38,top:foot+2.65,radius:.55,previous}).length,0);previous={x:q.x,z:q.z,bottom:foot+.38,top:foot+2.65};
  }}
 for(const z of[174.469,174.681,174.897])assert(plan.heightAt(134,z)>terrainH(134,z)+.35,'Original catch points now have actual timber support');
});

test('all geometry/mesh UUIDs use synchronous private randomness and consume zero shared future draws; no material/texture owners are added',()=>{
 let seed=42,draws=0;const random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},original=Math.random;
 try{Math.random=random;const baseline=Array.from({length:24},random);seed=42;draws=0;const a=meshData(),b=meshData();assert.equal(draws,0);assert.equal(Math.random,random);assert.deepEqual(Array.from({length:24},random),baseline);assert.equal(a.mesh.uuid,b.mesh.uuid);assert.equal(a.mesh.geometry.uuid,b.mesh.geometry.uuid);assert.equal(a.mesh.material,material);assert.equal(b.mesh.material,material);}
 finally{Math.random=original;}
});

test('late footprint clearing changes only positive named herbaceous bases and preserves old zeros, source counts/colors/roots/exterior/woody owners',()=>{
 const scene=new T.Scene(),geometry=new T.BoxGeometry(),meshes=[];
 for(const name of['flora_tuft','flora_reed','flora_petal','flora_pine','Water | bank reeds']){const m=new T.InstancedMesh(geometry,material,4);m.name=name;scene.add(m);meshes.push(m);for(let row=0;row<4;row++){const q=plan.world(row===3?3:0,plan.dryV+2);m.setMatrixAt(row,new T.Matrix4().makeTranslation(q.x,terrainH(q.x,q.z),q.z));m.setColorAt(row,new T.Color('#7f9153'));}m.setMatrixAt(2,new T.Matrix4().makeScale(0,0,0));}
 const before=meshes.map(m=>({matrix:Array.from(m.instanceMatrix.array),color:Array.from(m.instanceColor.array),count:m.count})),changed=clearFerryApproachPlants({scene},meshData());assert.equal(changed.length,4);
 meshes.forEach((m,k)=>{assert.equal(m.count,before[k].count);assert.deepEqual(Array.from(m.instanceColor.array),before[k].color);if(m.name==='flora_pine'){assert.deepEqual(Array.from(m.instanceMatrix.array),before[k].matrix);return;}
  for(let row=0;row<4;row++)for(let axis=0;axis<16;axis++){const o=row*16+axis,value=m.instanceMatrix.array[o];if(row<2&&[0,1,2,4,5,6,8,9,10].includes(axis))assert.equal(value,0);else assert.equal(value,before[k].matrix[o]);}
 });assert.equal(clearFerryApproachPlants({scene},meshData()).length,0);
});

test('actual installer ordering waits late packages, course startup and Chalk capture before any new ground/scene/camera/solid ownership',async()=>{
 let finishCourse,finishChalk,finishUnder;const scene=new T.Scene(),dock=new T.Group();dock.position.set(site.dock.x,site.dock.y,site.dock.z);dock.userData.sceneryArt={kind:'dock',width:2.6,length:7.8};const solid=createSolidWorld({THREE:T}),surfaces=[],camera=createFollowCamera({THREE:T,groundHeight:terrainH});
 const registerCamera=camera.register;let cameraCalls=0;camera.register=root=>{cameraCalls++;registerCamera(root);solid.register(root,{primitives:true});};
 const G={THREE:T,scene,waterPkg:{excludesPlants:(x,z)=>x===4&&z===5},worldPkg:{FERRY:{docks:[{id:'farbank',g:dock}]}},horse:{player:{pos:{x:134,z:173}}},followCam:{invalidateTrees(){}},courseClear:{ready:new Promise(r=>finishCourse=r)},world:{terrainH,colliders:site.colliders.slice(),walls:site.walls,groundSurfaces:surfaces,solidWorld:solid,followCamera:camera,ranchBuilderArt:{materials:{aged:material}},chalkCoverReady:new Promise(r=>finishChalk=r)}};
 const ready=installFerryBankApproach(G);assert.equal(installFerryBankApproach(G),ready);G.undergrowth={ready:new Promise(r=>finishUnder=r)};await Promise.resolve();assert.equal(scene.children.length,0);assert.equal(surfaces.length,0);assert.equal(solid.surfaceStats().owners,0);
 finishCourse();finishChalk();await Promise.resolve();await Promise.resolve();assert.equal(scene.children.length,0);finishUnder();const out=await ready;
 assert.equal(scene.children.length,1);assert.equal(surfaces.length,1);assert.equal(camera.obstacleCount,1);assert.equal(cameraCalls,1);assert.equal(G.followCam.register,undefined);assert.equal(solid.stats().parts,0);assert.equal(solid.surfaceStats().owners,1);assert.equal(out.mesh.parent,scene);assert.equal(out.mesh.material,material);assert(G.waterPkg.excludesPlants(4,5));assert(G.waterPkg.excludesPlants(134,176));assert(!G.waterPkg.excludesPlants(0,0));assert.deepEqual(G.world.colliders,site.colliders);
});

test('only exact individually approved bank/reed/deferred-ramp additions change the entire Water body',()=>{
 const old=read('./fixtures/ferry-bank-7908e80/world-water.js'),next=restoreApprovedOwners(ribbonParent(read('../assets/features/world-water.js'),'assets/features/world-water.js'),approvedOwners.bankAndReed),imported="import {installFerryBankApproach} from '../ferry-bank-approach.mjs?v=ferry-bank-approach-2';\n",tail=' // Register the new bank approach only after every original layout/course capture.\n installFerryBankApproach(G);\n';
 assert.equal(next.split(imported).length,2);assert.equal(next.split(tail).length,2);assert.equal(next.replace(imported,'').replace(tail,''),old);
});

test('public camera binding matches the actual world API and the original wrong adaptor call is rejected',async()=>{
 const helper=read('../assets/ferry-bank-approach.mjs'),html=read('../ranch3d.html');assert(helper.includes('W.followCamera.register(out.mesh)'));assert(!helper.includes('G.followCam.register('));assert(html.includes('pathDist,followCamera,puffDust'));assert(html.includes('solidWorld.register(root,{primitives:true})'));
 const source=helper.replace('W.followCamera.register(out.mesh)','G.followCam.register(out.mesh)'),bad=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const dock=new T.Group();dock.position.set(site.dock.x,site.dock.y,site.dock.z);dock.userData.sceneryArt={kind:'dock',width:2.6,length:7.8};const G={THREE:T,scene:new T.Scene(),waterPkg:{},worldPkg:{FERRY:{docks:[{id:'farbank',g:dock}]}},followCam:{invalidateTrees(){}},horse:{player:{pos:{x:0,z:0}}},world:{terrainH,colliders:site.colliders,walls:site.walls,groundSurfaces:[],ranchBuilderArt:{materials:{aged:material}},followCamera:createFollowCamera({THREE:T,groundHeight:terrainH}),solidWorld:createSolidWorld({THREE:T})}};
 await assert.rejects(bad.installFerryBankApproach(G),/G\.followCam\.register is not a function/);
});
