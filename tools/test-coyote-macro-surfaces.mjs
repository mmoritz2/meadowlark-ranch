import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture as f} from './coyote-macro-fixture.mjs';
import {createSolidWorld} from '../assets/solid-collisions.js';
const {T,next,old,step}=f;
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const callbackSource=source.match(/surfaceHeightAt:(\(x,z,h\)=>\{for\(const sample of groundSurfaces\)h=Math\.max\(h,sample\(x,z\)\);return h;\})/);
assert(callbackSource,'production callback must retain the original max registered-surfaces ground rule');
const groundSurfaces=[];
const surfaceHeightAt=new Function('groundSurfaces','return '+callbackSource[1])(groundSurfaces);
const originalGround=(x,z)=>surfaceHeightAt(x,z,f.oldHeight(x,z));
const preserved=next.createCanyonPlacementPlan({rawHeightAt:f.planningRaw,macroRawHeightAt:f.macroPlanningRaw,surfaceHeightAt,heightAt:originalGround,terrainStep:step});
const prior=old.createCanyonPlacementPlan({rawHeightAt:f.planningRaw,heightAt:originalGround,terrainStep:step});
const missing=next.createCanyonPlacementPlan({rawHeightAt:f.planningRaw,macroRawHeightAt:f.macroPlanningRaw,heightAt:originalGround,terrainStep:step});
function actualPrincipalGeometry(){
 const buf=fs.readFileSync(new URL('../assets/models/world/realism/namaqualand_cliff_02.glb',import.meta.url));
 const length=buf.readUInt32LE(12),json=JSON.parse(buf.subarray(20,20+length)),bin=buf.subarray(28+length),p=json.meshes[0].primitives[0];assert.equal(json.nodes.length,1);assert(!json.nodes[0].matrix&&!json.nodes[0].translation&&!json.nodes[0].rotation&&!json.nodes[0].scale);
 const read=id=>{const a=json.accessors[id],v=json.bufferViews[a.bufferView],n=a.type==='SCALAR'?1:3,bytes=a.componentType===5123?2:4,A=a.componentType===5123?Uint16Array:Float32Array,out=new A(a.count*n),stride=v.byteStride||bytes*n;
  for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){const offset=(v.byteOffset||0)+(a.byteOffset||0)+i*stride+k*bytes;out[i*n+k]=bytes===2?bin.readUInt16LE(offset):bin.readFloatLE(offset);}return out;};
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(read(p.attributes.POSITION),3));g.setIndex(new T.BufferAttribute(read(p.indices),1));g.computeBoundingBox();assert.equal(g.index.count/3,23998);return g;
}

test('actual late23998-triangle fixed scan preserves original decision-ground max while macro terrain stays independent',()=>{
 const before=f.sha(f.after),scene=new T.Scene(),geometry=actualPrincipalGeometry(),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material),solid=createSolidWorld({THREE:T}),face=next.OASIS_FACE;
 const bounds=geometry.boundingBox,scale=face.width/(bounds.max.x-bounds.min.x),cx=(bounds.min.x+bounds.max.x)/2,cz=(bounds.min.z+bounds.max.z)/2,co=Math.cos(face.yaw),sn=Math.sin(face.yaw);
 mesh.matrixAutoUpdate=false;mesh.matrix.set(scale*co,0,scale*sn,face.x-scale*(co*cx+sn*cz),0,scale,0,face.baseY,-scale*sn,0,scale*co,face.z-scale*(-sn*cx+co*cz),0,0,0,1);scene.add(mesh);mesh.updateWorldMatrix(true,false);
 // The original installer creates these plans before any Photoscans surfaces
 // are registered. Every pre-registration value must already match804.
 for(let x=-156;x<-121;x+=2)for(let z=132;z<160;z+=2)assert.equal(preserved.heightAt(x,z),prior.heightAt(x,z));
 const previous=Math.random;Math.random=()=>assert.fail('surface registration/query consumes RNG');let positive=0,negativeControl=0;
 try{
  assert.equal(solid.registerSurface(mesh),23998);groundSurfaces.push((x,z)=>solid.surfaceHeight(x,z,mesh));
  for(let x=-155;x<-123;x+=.71)for(let z=132;z<161;z+=.73){const expected=prior.heightAt(x,z);assert.equal(preserved.heightAt(x,z),expected,'registered triangle tops must still participate in old groundH contract');if(expected>f.oldHeight(x,z)+.1){positive++;if(missing.heightAt(x,z)!==expected)negativeControl++;}}
 }finally{Math.random=previous;}
 assert(positive>50&&negativeControl===positive,'V1 missing callback fails on the actual positive source surfaces '+JSON.stringify({positive,negativeControl}));console.log('ACTUAL_LATE_SCAN_DECISION_GROUND',JSON.stringify({positive,negativeControl}));assert.equal(f.sha(f.after),before,'decision callback cannot edit physical terrain');
 groundSurfaces.length=0;for(const p of [[-142,146],[-167,171],[-300,45],[10,20]])assert.equal(preserved.heightAt(...p),prior.heightAt(...p),'removal is live, without stale cached surface tops');
 solid.unregisterSurface(mesh);geometry.dispose();material.dispose();
});
