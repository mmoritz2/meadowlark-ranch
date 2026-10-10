import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createOuterCanopyShadePixels,patchOuterCanopyShade,installOuterCanopyShade} from '../assets/outer-canopy-shade.mjs';

test('actual crown footprints produce bounded smooth shelter, with clear meadow and riding seam',()=>{
 const footprint={x:650,z:-620,radius:9};
 const a=createOuterCanopyShadePixels([footprint]),b=createOuterCanopyShadePixels([footprint]);
 assert.deepEqual(a.data,b.data);assert.equal(a.size,1024);assert.equal(a.data.byteLength,1024*1024);
 const pixel=(x,z)=>a.data[Math.floor((z+a.extent)/a.step)*a.size+Math.floor((x+a.extent)/a.step)];
 assert(pixel(650,-620)>150);assert(pixel(650,-620)>pixel(655,-620));assert(pixel(655,-620)>pixel(659,-620));
 assert.equal(pixel(680,-620),0);assert.equal(pixel(500,-500),0);
 const overlap=createOuterCanopyShadePixels([footprint,footprint]);
 assert(overlap.maximum>a.maximum);assert(overlap.maximum<=255);
 const near=createOuterCanopyShadePixels([{x:532,z:0,radius:15}]);
 for(let z=0;z<near.size;z++)for(let x=0;x<near.size;x++){
  const wx=-near.extent+(x+.5)*near.step,wz=-near.extent+(z+.5)*near.step;
  if(Math.hypot(Math.max(0,Math.abs(wx)-500),Math.max(0,Math.abs(wz)-500))<=26)assert.equal(near.data[z*near.size+x],0);
 }
 assert.throws(()=>createOuterCanopyShadePixels([{x:NaN,z:0,radius:3}]));
});

test('shader uses ambient occlusion without replacing direct light, shadows, or failed shader sources',()=>{
 const texture={},shader={uniforms:{existing:{value:1}},fragmentShader:'before\n#include <aomap_fragment>\nafter'};
 assert(patchOuterCanopyShade(shader,texture));assert.equal(shader.uniforms.outerCanopyShelter.value,texture);
 assert(shader.fragmentShader.includes('reflectedLight.indirectDiffuse*='));
 assert(!shader.fragmentShader.includes('reflectedLight.directDiffuse*='));
 assert(shader.fragmentShader.includes('#include <aomap_fragment>'));
 const missing={uniforms:{},fragmentShader:'no anchor'},before=structuredClone(missing);
 assert.equal(patchOuterCanopyShade(missing,texture),false);assert.deepEqual(missing,before);
});

test('late install reuses the outer material and geometry, adds no draw, and disposes only its texture once',()=>{
 const geometry=new THREE.PlaneGeometry(),material=new THREE.MeshStandardMaterial();
 material.onBeforeCompile=shader=>{shader.fragmentShader='base\n'+shader.fragmentShader;};
 material.customProgramCacheKey=()=> 'original-outer-key';
 const mesh=new THREE.Mesh(geometry,material),scene=new THREE.Scene();scene.add(mesh);
 const outer={mesh,canopyFootprints:[{x:650,z:-620,radius:9}]},G={THREE,scene,world:{outerLandscape:outer}};
 installOuterCanopyShade(G);const shelter=outer.canopyShelter;
 assert.equal(outer.mesh.geometry,geometry);assert.equal(outer.mesh.material,material);assert.equal(scene.children.length,1);
 assert.equal(shelter.newDraws,0);assert.equal(shelter.newSamplers,1);assert.equal(shelter.texture.format,THREE.RedFormat);
 assert(shelter.texture.generateMipmaps);assert.equal(shelter.texture.colorSpace,THREE.NoColorSpace);
 const shader={uniforms:{},fragmentShader:'#include <aomap_fragment>'};material.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('base'));assert(shader.fragmentShader.includes('OUTER_CANOPY_SHELTER_V1'));
 assert(material.customProgramCacheKey().startsWith('original-outer-key-'));
 installOuterCanopyShade(G);assert.equal(outer.canopyShelter,shelter);
 let textureDisposed=0,geometryDisposed=0;shelter.texture.addEventListener('dispose',()=>textureDisposed++);geometry.addEventListener('dispose',()=>geometryDisposed++);
 material.dispose();shelter.dispose();assert.equal(textureDisposed,1);assert.equal(geometryDisposed,0);
});
