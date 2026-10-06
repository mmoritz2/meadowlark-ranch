import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createWorldShadows} from '../assets/world-shadows.js';

const light=new THREE.DirectionalLight();
const ground=(x,z)=>9+Math.sin(x*.07)*5+Math.cos(z*.03)*3;
const shadows=createWorldShadows({THREE,renderer:{capabilities:{maxTextureSize:4096}},light,heightAt:ground});
const point=new THREE.Vector3();
let samples=0;
for(const tier of ['low','medium','high']){
 shadows.setQuality(tier);
 for(const elevation of [.09,.5,.82])for(let i=0;i<100;i++){
  const rider=new THREE.Vector3(78+i*.3,0,-151+i*.2);
  const direction=new THREE.Vector3(.7,elevation,.5).normalize();
  shadows.update(rider,direction,1-elevation);
  light.updateMatrixWorld();light.target.updateMatrixWorld();light.shadow.updateMatrices(light);
  // The rider and ground nearby must stay inside the shadow volume while
  // travelling over a slope, even when long evening shadows widen the map.
  for(const [dx,dz] of [[0,0],[-10,-10],[10,10]]){
   point.set(rider.x+dx,ground(rider.x+dx,rider.z+dz),rider.z+dz).project(light.shadow.camera);
   assert(point.toArray().every(v=>Number.isFinite(v)&&Math.abs(v)<1),'Ground remains inside the moving shadow volume');
  }
  assert(Math.abs(light.target.position.y-ground(rider.x,rider.z))<.15,'Hilltop contact follows terrain');
  samples++;
 }
}
// The light-space grid must not slide when the rider moves less than a texel.
shadows.setQuality('high');
const direction=new THREE.Vector3(.7,.8,.5).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
shadows.update(new THREE.Vector3(),direction);
const before=light.target.position.dot(right),step=shadows.state.span/shadows.state.mapSize;
shadows.update(right.clone().multiplyScalar(step*.05),direction);
assert(Math.abs(light.target.position.dot(right)-before)<1e-8,'Small rider movement keeps the shadow texel grid fixed');

let disposed=false;light.shadow.map={dispose(){disposed=true;}};
shadows.setQuality('low');assert(disposed&&light.shadow.map===null,'Quality change releases the old GPU shadow target');
const limitedLight=new THREE.DirectionalLight();
const limited=createWorldShadows({THREE,renderer:{capabilities:{maxTextureSize:2048}},light:limitedLight,heightAt:ground});
assert.equal(limited.state.mapSize,2048,'High respects the device texture limit');
console.log(`Shadow volume and hill contact passed for ${samples} moving rider samples; texel stability, GPU disposal and device limits passed.`);
