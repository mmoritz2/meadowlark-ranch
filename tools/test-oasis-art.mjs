import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createOasisPalms,createOasisBank} from '../assets/oasis-art.js';
const groundH=(x,z)=>x*.035+Math.sin(z*.1)*.2,options={THREE,groundH,x:-200,z:158,radius:7,loadTextures:false};
test('palms retain seven grounded collision sites with outward bark and bounded geometry',()=>{
 const g=createOasisPalms(options),copy=createOasisPalms(options),meta=g.userData.oasisPalms;
 assert.equal(meta.palms.length,7);assert(meta.triangles<12000);assert.equal(g.children.length,2);
 for(const m of g.children){for(const a of Object.values(m.geometry.attributes))assert([...a.array].every(Number.isFinite));assert(m.castShadow&&m.receiveShadow);}
 assert.deepEqual(g.children[0].geometry.attributes.position.array,copy.children[0].geometry.attributes.position.array);
 const bark=g.children[1].geometry,p=bark.attributes.position,n=bark.attributes.normal;
 for(let k=0;k<7;k++){
  const site=meta.palms[k],i=k*25*11;
  assert(Math.abs(p.getY(i)-(groundH(site.x,site.z)-groundH(options.x,options.z)))<1e-6);
  assert(Math.abs(Math.hypot(site.x-options.x,site.z-options.z)-8.6)<1e-6);
  assert(n.getX(i)>.8,'stem normals must point outwards');
 }
});
test('shoreline faces the sky and meets terrain around its complete outer rim',()=>{
 const bank=createOasisBank(options),p=bank.geometry.attributes.position,n=bank.geometry.attributes.normal;
 for(let i=162;i<p.count;i++)assert(Math.abs(p.getY(i)-(groundH(options.x+p.getX(i),options.z+p.getZ(i))-groundH(options.x,options.z)+.028))<1e-6);
 assert([...n.array].every(Number.isFinite));assert(n.getY(0)>.8);
 bank.updateMatrixWorld(true);
 assert(new THREE.Raycaster(new THREE.Vector3(8,10,0),new THREE.Vector3(0,-1,0)).intersectObject(bank).length>0);
});
