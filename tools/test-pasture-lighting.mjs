import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createGrassTuftGeometry} from '../assets/meadow-cover.js';
import {pastureLightVisibility,pastureDiffuseResponse,installPastureLighting} from '../assets/pasture-lighting.mjs';

const standardShader=()=>({uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader});
test('dense roots have bounded sky occlusion; exposed leaves retain sky and all direct light',()=>{
 let previous=0;
 for(let i=-100;i<=200;i++){
  const value=pastureLightVisibility(i/100);
  assert(value.sky>=.72&&value.sky<=1&&value.sun===1);
  assert(value.sky>=previous);previous=value.sky;
 }
 assert.deepEqual(pastureLightVisibility(1),{sky:1,sun:1});
 for(const n of [NaN,Infinity,-Infinity])assert.throws(()=>pastureLightVisibility(n));
});

test('thin-leaf incidence keeps reflection stronger than transmission without black edges',()=>{
 assert.equal(pastureDiffuseResponse(1),.85);
 assert.equal(pastureDiffuseResponse(-1),.32);
 assert.equal(pastureDiffuseResponse(0),.13);
 for(let i=0;i<=100;i++){
  const front=pastureDiffuseResponse(i/100),back=pastureDiffuseResponse(-i/100);
  assert(front>=back&&front<=.85&&back>=.13);
 }
 assert.equal(pastureDiffuseResponse(2),pastureDiffuseResponse(1));
 assert.equal(pastureDiffuseResponse(-2),pastureDiffuseResponse(-1));
 for(const n of [NaN,Infinity,-Infinity])assert.throws(()=>pastureDiffuseResponse(n));
});

test('material patch chains existing wind exactly once and preserves opaque coverage',()=>{
 for(const seed of [false,true]){
  const material=new THREE.MeshStandardMaterial({alphaTest:.5,side:THREE.DoubleSide,roughness:1});
  material.alphaToCoverage=true;
  const wind={value:3};let chained=0;
  material.onBeforeCompile=shader=>{chained++;shader.uniforms.wind=wind;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x+=.1*transformed.y;');};
  const fields=['transparent','depthWrite','depthTest','side','alphaTest','alphaToCoverage','opacity','roughness','metalness','map','normalMap'];
  const before=Object.fromEntries(fields.map(key=>[key,material[key]]));
  installPastureLighting(material,{seed});installPastureLighting(material,{seed});
  const shader=standardShader();material.onBeforeCompile(shader,{});
  assert.equal(chained,1);assert.equal(shader.uniforms.wind,wind);
  assert(shader.vertexShader.includes('transformed.x+=.1*transformed.y;'));
  assert.equal((shader.vertexShader.match(/varying float pastureLeafHeight/g)||[]).length,1);
  for(const [key,value] of Object.entries(before))assert.equal(material[key],value,key);
  assert(material.customProgramCacheKey().includes(seed?'seed':'leaf'));
  material.dispose();
 }
});

test('diffuse wrapper uses only shadowed incident radiance and retains standard specular',()=>{
 const material=new THREE.MeshStandardMaterial();installPastureLighting(material);
 const shader=standardShader();material.onBeforeCompile(shader,{});
 const functionStart=shader.fragmentShader.indexOf('void RE_Direct_Pasture(');
 const functionEnd=shader.fragmentShader.indexOf('#undef RE_Direct',functionStart);
 const wrapper=shader.fragmentShader.slice(functionStart,functionEnd);
 assert(wrapper.includes('RE_Direct_Physical(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight)'));
 assert(wrapper.includes('reflectedLight.directDiffuse=previousDiffuse+pastureDiffuse*directLight.color*BRDF_Lambert(material.diffuseColor)'));
 assert(!wrapper.includes('directSpecular='));assert(!wrapper.includes('emissive'));assert(!wrapper.includes('directionalLights'));assert(!wrapper.includes('uniform'));
 assert(shader.fragmentShader.indexOf('#define RE_Direct RE_Direct_Pasture')<shader.fragmentShader.indexOf('#include <lights_fragment_begin>'));
 // The existing light loop supplies shadow attenuation before calling the
 // replaced response; the wrapper never reads the original unshadowed lights.
 const loop=THREE.ShaderChunk.lights_fragment_begin;
 const directionalStart=loop.indexOf('getDirectionalLightInfo(');
 const shadowAt=loop.indexOf('directLight.color *=',directionalStart);
 const callAt=loop.indexOf('RE_Direct(',directionalStart);
 assert(directionalStart>=0&&shadowAt>directionalStart&&shadowAt<callAt);
 // Check actual emitted GLSL coefficients against the portable response across
 // incidence angles, including the zero-radiance (fully shadowed) endpoint.
 const coefficients=wrapper.match(/float pastureDiffuse=([.\d]+)\*max\(pastureIncidence,0\.0\)\+([.\d]+)\*max\(-pastureIncidence,0\.0\)\+([.\d]+)\*\(1\.0-abs\(pastureIncidence\)\)/);
 assert(coefficients);const [front,back,edge]=coefficients.slice(1).map(Number);
 for(let i=-100;i<=100;i++){
  const n=i/100,response=front*Math.max(n,0)+back*Math.max(-n,0)+edge*(1-Math.abs(n));
  assert(Math.abs(response-pastureDiffuseResponse(n))<1e-12);
  for(const incoming of [0,.12,1,3.35]){
   const outgoing=response*incoming;
   assert(Number.isFinite(outgoing)&&outgoing>=0&&outgoing<=incoming);
   if(incoming===0)assert.equal(outgoing,0);
  }
 }
 const rootPatch=shader.fragmentShader.slice(shader.fragmentShader.indexOf('float pastureDepth'),shader.fragmentShader.indexOf('#include <opaque_fragment>'));
 assert(rootPatch.includes('reflectedLight.indirectDiffuse*=pastureSkyVisibility'));
 assert(!rootPatch.includes('reflectedLight.directDiffuse*='));
 assert(!rootPatch.includes('diffuseColor.rgb*='));assert(!rootPatch.includes('discard'));assert(!rootPatch.includes('texture2D'));assert(!rootPatch.includes('gl_FragColor'));
 material.dispose();
});

for(const blades of [4,6,8])test(`${blades}-leaf middle grass normals follow the indexed physical surface`,()=>{
 const geometry=createGrassTuftGeometry(THREE,{bladeCount:blades,segments:2,profile:'middle-natural-v1'});
 const p=geometry.attributes.position,n=geometry.attributes.normal,indices=geometry.index.array;
 assert.equal(p.count,blades*5);assert.equal(indices.length/3,blades*3);
 assert.equal(n.count,p.count);
 const sum=new Float64Array(p.count*3);
 // Independent area-weighted triangle crosses from the stored Float32 points.
 // No call to computeVertexNormals is used to construct the expectation.
 for(let i=0;i<indices.length;i+=3){
  const ids=Array.from(indices.subarray(i,i+3)),[a,b,c]=ids;
  assert(ids.every(k=>k>=0&&k<p.count));
  const ux=p.getX(b)-p.getX(a),uy=p.getY(b)-p.getY(a),uz=p.getZ(b)-p.getZ(a);
  const vx=p.getX(c)-p.getX(a),vy=p.getY(c)-p.getY(a),vz=p.getZ(c)-p.getZ(a);
  const cross=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
  assert(Math.hypot(...cross)>1e-8,'Each triangle has nonzero area');
  for(const k of ids)for(let axis=0;axis<3;axis++)sum[k*3+axis]+=cross[axis];
 }
 let vertical=0;
 for(let i=0;i<n.count;i++){
  const areaNormal=Array.from(sum.subarray(i*3,i*3+3)),length=Math.hypot(...areaNormal);
  assert(length>0);const expected=areaNormal.map(v=>v/length),actual=[n.getX(i),n.getY(i),n.getZ(i)];
  assert(actual.every(Number.isFinite));assert(Math.abs(Math.hypot(...actual)-1)<1e-6);
  for(let axis=0;axis<3;axis++)assert(Math.abs(actual[axis]-expected[axis])<1e-5,'Stored normal matches the modeled leaf');
  vertical+=Math.abs(actual[1]);
 }
 assert(vertical/n.count<.6,'Upright leaves must not carry the old predominantly upward lighting normals');
 geometry.dispose();
});
