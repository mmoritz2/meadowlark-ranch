import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {treeImpostor} from '../assets/tree-impostors.js';
import {installOuterCanopyShade,createOuterCanopyShadePixels} from '../assets/outer-canopy-shade.mjs';
import {installYoungOuterWoodland} from '../assets/young-outer-woodland.mjs';
import {patchOuterFog} from '../assets/outer-landscape.js';

const heightAt=(x,z)=>.013*x-.021*z;
function fixture(){
 const geometry=new THREE.PlaneGeometry(2000,2000,8,8);geometry.rotateX(-Math.PI/2);
 const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,heightAt(p.getX(i),p.getZ(i)));geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial(),originalFootprint={x:-700,z:-700,radius:10,source:'original'};
 const outer={mesh:new THREE.Mesh(geometry,material),woodlandSites:[],rockClusterData:{intersectsRoot:()=>false},canopyFootprints:[originalFootprint]};
 let finish;const ready=new Promise(resolve=>{finish=resolve;});
 const G={THREE,scene:new THREE.Scene(),world:{outerLandscape:outer},photoscans:{ready}};
 const sources=['broadleaf','canopy-broadleaf'].map(key=>{
  const albedo=new THREE.Texture(),normals=new THREE.Texture();
  const card=treeImpostor({THREE,albedo,normals,width:5,height:5.5,bottom:-.3,normalProfile:'view-facing-material-v1'});
  return{key,card,normalTexture:normals,sourceHeight:5,bottom:-.3,crownSpan:4};
 });
 const base=sources[1].card.mat,outerMaterial=base.clone();outerMaterial.userData={...base.userData};
 outerMaterial.onBeforeCompile=(shader,renderer)=>{base.onBeforeCompile(shader,renderer);patchOuterFog(shader);};
 outerMaterial.customProgramCacheKey=()=>base.customProgramCacheKey()+'-outer-haze';sources[1].outerMaterial=outerMaterial;
 return{G,outer,sources,finish,originalFootprint};
}
function assertOriginalShelter(outer,originalFootprint,texture){
 assert.deepEqual(outer.canopyFootprints,[originalFootprint]);assert.equal(outer.canopyShelter.texture,texture);
 assert.deepEqual(texture.image.data,createOuterCanopyShadePixels([originalFootprint]).data);
}
const renderer={getContext:()=>({getContextAttributes:()=>({antialias:false})}),getRenderTarget:()=>null,capabilities:{maxSamples:0}};
async function withoutWarning(fn){const warn=console.warn;console.warn=()=>{};try{return await fn();}finally{console.warn=warn;}}

test('young cards allocate only after old owners, share protected source resources, and dispose their own resources',async()=>{
 const{G,outer,sources,finish,originalFootprint}=fixture();
 const groundBefore=Object.fromEntries(Object.entries(outer.mesh.geometry.attributes).map(([k,a])=>[k,a.array.slice()]));
 const cardsBefore=sources.map(s=>s.card.geo.attributes.position.array.slice());
 let state;const random=Math.random;Math.random=()=>{throw Error('Unexpected early UUID or ambient RNG allocation');};
 try{state=installYoungOuterWoodland(G,sources);}finally{Math.random=random;}
 assert.equal(state.ready,false);assert.equal(G.scene.children.length,0);assert(outer.canopyFootprints.length>1);
 installOuterCanopyShade(G);const texture=outer.canopyShelter.texture;finish();assert.equal(await state.pending,state);
 assert.equal(state.ready,true);assert.deepEqual(state.errors,[]);assert(state.records.length>0&&state.records.length<=180);
 assert(state.meshes.length<=6);assert.equal(state.stats.triangles,state.records.length*2);
 for(const mesh of state.meshes){
  const source=sources.find(s=>s.key===mesh.userData.youngWoodland.source);
  assert.equal(mesh.geometry,source.card.geo);assert.equal(mesh.material.map,source.card.mat.map);
  assert.equal(mesh.customDepthMaterial,source.card.mat.userData.scanDepth);assert.equal(mesh.receiveShadow,false);
  assert.equal(mesh.material.alphaTest,.22);assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.depthWrite,true);
  assert.equal(mesh.material.blendSrcAlpha,THREE.ZeroFactor);assert.equal(mesh.material.blendDstAlpha,THREE.OneFactor);
  if(source.outerMaterial)assert.equal(mesh.material,source.outerMaterial);else assert.notEqual(mesh.material,source.card.mat);
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
  mesh.material.onBeforeCompile(shader,renderer);assert.equal(shader.uniforms.treeNormals.value,source.normalTexture);
  for(const token of ['treeLength2>1e-6','canopyLength2>1e-6','foliageMultisample','outerFogBlend'])assert(shader.fragmentShader.includes(token));
  assert.equal(shader.fragmentShader.split('uniform bool foliageMultisample;').length-1,1);
  const matrix=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);const root=new THREE.Vector3(0,source.bottom,0).applyMatrix4(matrix);
   assert(Math.abs(root.y-(heightAt(root.x,root.z)-.035))<2e-5);assert(matrix.determinant()>0);
  }
 }
 for(const [k,a]of Object.entries(outer.mesh.geometry.attributes))assert.deepEqual(a.array,groundBefore[k]);
 sources.forEach((s,i)=>assert.deepEqual(s.card.geo.attributes.position.array,cardsBefore[i]));
 assert.deepEqual(texture.image.data,createOuterCanopyShadePixels(outer.canopyFootprints).data);
 assert.equal(installYoungOuterWoodland(G,sources),state);
 let sharedDisposed=0,ownedDisposed=0,meshDisposed=0;
 for(const source of sources)for(const resource of [source.card.geo,source.card.mat,source.card.mat.map,source.normalTexture,source.card.mat.userData.scanDepth,source.outerMaterial].filter(Boolean))resource.addEventListener('dispose',()=>sharedDisposed++);
 const owned=new Set(state.meshes.map(m=>m.material).filter(m=>!sources.some(s=>s.outerMaterial===m||s.card.mat===m)));
 for(const material of owned)material.addEventListener('dispose',()=>ownedDisposed++);
 const meshes=[...state.meshes];for(const mesh of meshes)mesh.addEventListener('dispose',()=>meshDisposed++);
 state.dispose();state.dispose();assert.equal(G.scene.children.length,0);assert.equal(sharedDisposed,0);
 assert.equal(ownedDisposed,1);assert.equal(meshDisposed,meshes.length);assertOriginalShelter(outer,originalFootprint,texture);
});

test('disposing pending pockets cancels allocation and removes only their speculative shelter',async()=>{
 const{G,outer,sources,finish,originalFootprint}=fixture(),state=installYoungOuterWoodland(G,sources);
 installOuterCanopyShade(G);const texture=outer.canopyShelter.texture;state.dispose();finish();await state.pending;
 assert.equal(state.ready,false);assert.equal(G.scene.children.length,0);assert.deepEqual(state.errors,[]);
 assertOriginalShelter(outer,originalFootprint,texture);
});

test('late allocation failure settles, releases the owned material, and restores original shelter',async()=>{
 const{G,outer,sources,finish,originalFootprint}=fixture(),state=installYoungOuterWoodland(G,sources);
 installOuterCanopyShade(G);const texture=outer.canopyShelter.texture;
 // The source was valid during synchronous planning; invalidate the second
 // reference while waiting so failure occurs after the first owned clone.
 let ownedDisposed=0;const clone=sources[0].card.mat.clone.bind(sources[0].card.mat);
 sources[0].card.mat.clone=()=>{const material=clone();material.addEventListener('dispose',()=>ownedDisposed++);return material;};
 sources[1].outerMaterial=null;sources[1].card=null;
 await withoutWarning(async()=>{finish();assert.equal(await state.pending,state);});
 assert.equal(state.ready,false);assert.equal(state.disposed,true);assert.equal(state.errors.length,1);
 assert.equal(ownedDisposed,1);assert.equal(G.scene.children.length,0);assertOriginalShelter(outer,originalFootprint,texture);
});

test('synchronous sampler and metadata failures return settled state instead of rejecting the photo owner',async()=>{
 for(const mode of ['missing-face','missing-source','nonfinite-height']){
  const{G,outer,sources,originalFootprint}=fixture();installOuterCanopyShade(G);const texture=outer.canopyShelter.texture;
  if(mode==='missing-face'){outer.mesh.geometry=new THREE.PlaneGeometry(1,1);outer.mesh.geometry.rotateX(-Math.PI/2);}
  if(mode==='missing-source')sources.pop();if(mode==='nonfinite-height')sources[0].sourceHeight=NaN;
  const state=await withoutWarning(async()=>{let result;assert.doesNotThrow(()=>{result=installYoungOuterWoodland(G,sources);});assert.equal(await result.pending,result);return result;});
  assert.equal(state.ready,false);assert.equal(state.disposed,true);assert.equal(state.errors.length,1);
  assert.equal(G.scene.children.length,0);assertOriginalShelter(outer,originalFootprint,texture);
 }
});
