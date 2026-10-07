import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {CANYON_RIDGES,canyonRelief,createCanyonLandscape} from '../assets/canyon-landscape.js';
const step=1000/512,n=513,heights=Float32Array.from({length:n*n},(_,i)=>{const x=i%n*step-500,z=Math.floor(i/n)*step-500;return x*.014+z*.025+canyonRelief(x,z);});
function ground(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*n+ix,a=heights[i],b=heights[i+n],c=heights[i+n+1],d=heights[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const colliders=[],art=createCanyonLandscape({THREE:T,scene:new T.Scene(),heightAt:ground,terrainStep:step,material:new T.MeshStandardMaterial(),colliders});
test('four connected sandstone banks have substantial relief within a bounded footprint',()=>{
 for(const r of CANYON_RIDGES)assert(Math.max(...r.points.map(p=>canyonRelief(...p)))>8,r.id);
 for(const p of [[0,0],[58,-60],[-92,-173],[-380,150],[250,120]])assert.equal(canyonRelief(...p),0);
 assert(art.triangles>5000&&art.triangles<16000);assert.equal(art.fields.length,4);
 for(const f of art.fields){assert(f.mesh.castShadow&&f.mesh.receiveShadow);for(const a of Object.values(f.mesh.geometry.attributes))assert([...a.array].every(Number.isFinite));}
});
test('oasis, settlement, arena and river approaches stay outside the terrain changes',()=>{
 for(let i=0;i<36;i++)for(let d=0;d<=19;d++){const a=i*Math.PI/18;assert.equal(canyonRelief(-200+Math.cos(a)*d,158+Math.sin(a)*d),0);}
 for(let x=-249;x<=-201;x+=3)for(let z=109;z<=133;z+=3)assert.equal(canyonRelief(x,z),0);
 for(let x=-265;x<=-211;x+=3)for(let z=200;z<=240;z+=3)assert.equal(canyonRelief(x,z),0);
 for(let x=-360;x< -100;x+=2)for(const bank of[-19,0,19])assert.equal(canyonRelief(x,120+Math.sin(x*.012)*45+bank),0);
});
test('the sandstone skin follows exactly the same terrain triangles as hoof contact',()=>{
 art.group.updateMatrixWorld(true);let samples=0;
 for(const {mesh} of art.fields){const g=mesh.geometry,p=g.attributes.position,idx=g.index;for(let i=0;i<idx.count;i+=Math.max(3,Math.floor(idx.count/90/3)*3)){
  const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2),x=(p.getX(a)+p.getX(b)+p.getX(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;
  const hit=new T.Raycaster(new T.Vector3(x,150,z),new T.Vector3(0,-1,0)).intersectObject(mesh)[0];assert(hit);assert(Math.abs(hit.point.y-ground(x,z)-.012)<.001);samples++;
 }}assert(samples>300);
});
test('cliff collision contours remain finite and leave protected approaches open',()=>{
 assert(colliders.length>200&&colliders.length<600);
 for(const c of colliders){assert(Number.isFinite(c.x+c.z+c.topY));assert(c.terrainCliff&&c.landform);assert(c.topY>ground(c.x,c.z)+2);assert(Math.hypot(c.x+200,c.z-158)>20);}
});
