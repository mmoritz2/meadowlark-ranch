import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createOasisPalms,createOasisBank,createOasisWater,OASIS,oasisTerrainHeight,oasisContainsWater,oasisRadius} from '../assets/oasis-art.js';
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
 for(let i=0;i<p.count;i++)assert(Math.abs(p.getY(i)-(groundH(options.x+p.getX(i),options.z+p.getZ(i))-groundH(options.x,options.z)+.012))<1e-5);
 assert([...n.array].every(Number.isFinite));assert(n.getY(0)>.8);
 bank.updateMatrixWorld(true);
 assert(new THREE.Raycaster(new THREE.Vector3(8,10,0),new THREE.Vector3(0,-1,0)).intersectObject(bank).length>0);
});

test('oasis basin is submerged at its centre and leaves the surrounding world unchanged',()=>{
 assert(oasisTerrainHeight(OASIS.x,OASIS.z,8)<OASIS.level-.7);
 for(const [x,z] of [[0,0],[-220,130],[-180,160],[-200,140]])assert.equal(oasisTerrainHeight(x,z,8),8);
 for(let k=0;k<360;k++){const a=k*Math.PI/180;for(let d=0;d<18;d+=.1)assert(Number.isFinite(oasisTerrainHeight(OASIS.x+Math.cos(a)*d,OASIS.z+Math.sin(a)*d,4)));}
});

test('oasis water uses nondegenerate upward faces and a closed centre',()=>{
 const material=new THREE.MeshPhysicalMaterial();material.userData.plainShader=()=>{};
 const water=createOasisWater({...options,waterMaterial:material}),g=water.geometry,p=g.attributes.position,idx=g.index,normal=g.attributes.normal;
 for(let i=0;i<normal.count;i++)assert(normal.getY(i)>.99);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<idx.count;i+=3){a.fromBufferAttribute(p,idx.getX(i));b.fromBufferAttribute(p,idx.getX(i+1));c.fromBufferAttribute(p,idx.getX(i+2));assert(b.sub(a).cross(c.sub(a)).length()>1e-6);}
 water.material.side=THREE.FrontSide;water.updateMatrixWorld(true);assert(new THREE.Raycaster(new THREE.Vector3(0,20,0),new THREE.Vector3(0,-1,0)).intersectObject(water).length>0);
});

test('dry-prop boundary follows the irregular water edge with root clearance',()=>{
 assert(oasisContainsWater(OASIS.x,OASIS.z));assert(!oasisContainsWater(0,0));
 for(let i=0;i<360;i++){const a=i*Math.PI/180,r=oasisRadius(a);for(const [d,padding,wet] of [[r-.01,0,true],[r+.01,0,false],[r+.6,.7,true],[r+.8,.7,false]])assert.equal(oasisContainsWater(OASIS.x+Math.cos(a)*d,OASIS.z+Math.sin(a)*d,padding),wet);}
});
