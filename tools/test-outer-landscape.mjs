import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createOuterLandscape} from '../assets/outer-landscape.js';
const scene=new T.Scene(),geometry=new T.PlaneGeometry(1000,1000,512,512),heightAt=(x,z)=>.002*x-.004*z+Math.sin(z*.012)*.3;
geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position,colors=[];
for(let i=0;i<p.count;i++){p.setY(i,heightAt(p.getX(i),p.getZ(i)));colors.push(.91+p.getX(i)*.00001,.96,.89);}
geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
const ground=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true}));ground.material.defaultAttributeValues={chalkRelief:[0]};const before=new Float32Array(p.array);
const art=createOuterLandscape({THREE:T,scene,heightAt,groundMesh:ground});art.mesh.updateMatrixWorld(true);
test('the fixed riding terrain is untouched and the shared edge is continuous',()=>{
 assert.deepEqual(p.array,before);const pos=art.mesh.geometry.attributes.position;
 for(let i=0;i<art.edgeCount;i++){const x=pos.getX(i),z=pos.getZ(i);assert.equal(Math.max(Math.abs(x),Math.abs(z)),500);assert(Math.abs(pos.getY(i)-heightAt(x,z))<1e-6);}
 for(let i=0;i<pos.count;i++)assert(Math.max(Math.abs(pos.getX(i)),Math.abs(pos.getZ(i)))>=500);
 assert.equal(art.mesh.matrixAutoUpdate,false);assert.equal(art.mesh.castShadow,false);
});
test('coarser outer bands cover the whole annulus without gaps or inverted triangles',()=>{
 const g=art.mesh.geometry,p=g.attributes.position,idx=g.index;let area=0;
 for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2),cross=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));assert(cross>0);area+=cross*.5;}
 assert(Math.abs(area-4*(1700**2-500**2))<.1);
 for(let a=.037;a<Math.PI*2;a+=.29)for(const d of[2,9,35,95,180,390,740,1150]){
  const radius=(500+d)/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),x=Math.cos(a)*radius,z=Math.sin(a)*radius;
  assert.equal(new T.Raycaster(new T.Vector3(x,200,z),new T.Vector3(0,-1,0)).intersectObject(art.mesh).length,1);
 }
 assert(art.stats.triangles<25000);assert(Object.values(g.attributes).every(a=>Array.from(a.array).every(Number.isFinite)));
});
test('woodland roots match the actual triangles and remain outside riding space',()=>{
 assert(art.woodlandSites.length>250&&art.woodlandSites.length<4500);
 for(let i=0;i<art.woodlandSites.length;i+=7){const p=art.woodlandSites[i],hit=new T.Raycaster(new T.Vector3(p.x,200,p.z),new T.Vector3(0,-1,0)).intersectObject(art.mesh)[0];assert(hit);assert(Math.abs(p.y-hit.point.y)<1e-6);assert(Math.max(Math.abs(p.x),Math.abs(p.z))>540);}
});
