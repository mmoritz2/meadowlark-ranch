import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createTerrainSurface} from '../assets/terrain-realism.js';
import {PASTURE_MESO,PASTURE_MESO_CACHE,pastureMesoAt,patchPastureMesoSurface} from '../assets/pasture-mesosurface.mjs';
const source=readFileSync(new URL('../assets/pasture-mesosurface.mjs',import.meta.url),'utf8');
const native=JSON.parse(readFileSync(new URL('./fixtures/managed-turf-native-points-b1.json',import.meta.url),'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex'),count=(s,p)=>s.split(p).length-1;
const fields=['crown','envelope','height','dx','dz','filter'];
const unit=v=>{const length=Math.hypot(...v);return v.map(x=>x/length);};
let textureLoads=0,pixels;const previousDocument=globalThis.document;
const context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:p=>{pixels=p;},getImageData:()=>pixels,fillRect(){},createRadialGradient:()=>({addColorStop(){}}),beginPath(){},lineTo(){},moveTo(){},stroke(){}};
let material;
try{
 globalThis.document={createElement:()=>({getContext:()=>context})};
 material=createTerrainSurface({THREE:{...T,TextureLoader:class{load(){textureLoads++;return new T.Texture();}}},renderer:{capabilities:{getMaxAnisotropy:()=>4}},grass:new T.Texture(),bump:new T.Texture()}).material;
}finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
await Promise.resolve(); // Finish the owner's existing deferred soil texture allocation.
const beforeLoads=textureLoads,properties=Object.fromEntries(['transparent','opacity','depthWrite','depthTest','side','roughness','map','bumpMap','envMapIntensity'].map(k=>[k,material[k]]));
const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
material.onBeforeCompile(shader);
const fragment=shader.fragmentShader;

test('current maintained-turf owner adopts one physical PMS4 response without textures, vertex or depth changes',()=>{
 assert.equal(PASTURE_MESO_CACHE,'pasture-mesosurface-4');
 assert.equal(count(fragment,'PASTURE_MESOSURFACE_V4'),1);assert.equal(count(fragment,'vec4 pastureMesoGrowth('),1);
 assert(!fragment.includes('PASTURE_MESOSURFACE_V2'));assert(!fragment.includes('PASTURE_MESOSURFACE_V3'));
 assert(material.customProgramCacheKey().includes(PASTURE_MESO_CACHE));
 assert.equal(textureLoads,beforeLoads);assert.equal(beforeLoads,11,'Existing terrain loader resources only');
 for(const[k,v]of Object.entries(properties))assert.equal(material[k],v,k);
 assert.equal(material.transparent,false);assert.equal(material.opacity,1);assert.equal(material.depthWrite,true);
 assert(!/texture2D|sampler2D|TextureLoader|new\s+.*Texture|new\s+.*Geometry|\.vertexShader\s*=|gl_FragColor|diffuseColor\.a|discard\s*;/.test(source));
 assert(fragment.indexOf('float pastureCover=')>fragment.indexOf('soilWeight*=soilReady;'));
 assert(fragment.indexOf('vec3 pastureGradient=')>fragment.indexOf('normal=normalize(mix(normal,normalize(mat3(viewMatrix)*powderNormal),coldPowder));'));
 const repeat={...shader,uniforms:{...shader.uniforms}},vertex=repeat.vertexShader,uniforms=Object.keys(repeat.uniforms);
 assert.equal(patchPastureMesoSurface(repeat),false);assert.equal(repeat.fragmentShader,fragment);assert.equal(repeat.vertexShader,vertex);assert.deepEqual(Object.keys(repeat.uniforms),uniforms);
});

test('the prior independently verified physical field is exact and CPU/shader scales remain coupled',()=>{
 const first=source.indexOf('const fract='),last=source.indexOf('const f=n=>');assert(first>=0&&last>first);
 assert.equal(hash(source.slice(first,last)),native.priorPhysicalFieldSHA256,'PMS4 retains the complete PMS3 analytic field, including helper hash and product rule');
 const physical={...PASTURE_MESO};delete physical.rootOcclusion;assert.deepEqual(physical,native.priorPhysicalConstants);
 assert(fragment.includes(`localBasis*p/${PASTURE_MESO.localMetres}`));assert(fragment.includes(`groupBasis*p/${PASTURE_MESO.groupMetres}`));
 assert(fragment.includes(`float calm=mix(${PASTURE_MESO.calmHeight},${PASTURE_MESO.managedCalmHeight},managed)`));
 assert(fragment.includes('float envelope=mix(calm,1.0,gt*gt*(3.0-2.0*gt))'));
 assert(fragment.includes('*(1.0-calm)*6.0*gt*(1.0-gt)'));assert(fragment.includes('+crown*envelopeGradient)'));
 assert.equal(native.priorIndependentPhysicalProof.finiteDifferenceCases,40920);
});

test('actual analytic gradients agree with independent central differences through cropped and filtered states',()=>{
 const epsilon=1e-5;let cases=0,maxError=0;
 for(let iz=0;iz<21;iz++)for(let ix=0;ix<23;ix++)for(const managed of[0,.25,.5,.75,1])for(const footprint of[0,.12,.22,.439,.44,1.2,2.5,3.8]){
  const x=-550+ix*47.17,z=-540+iz*51.11,a=pastureMesoAt(x,z,footprint,managed),dx=(pastureMesoAt(x+epsilon,z,footprint,managed).height-pastureMesoAt(x-epsilon,z,footprint,managed).height)/(2*epsilon),dz=(pastureMesoAt(x,z+epsilon,footprint,managed).height-pastureMesoAt(x,z-epsilon,footprint,managed).height)/(2*epsilon);
  assert(Object.values(a).every(Number.isFinite));const error=Math.max(Math.abs(a.dx-dx),Math.abs(a.dz-dz));maxError=Math.max(maxError,error);assert(error<2e-7);
  assert(a.crown>=0&&a.crown<=1);assert(a.filter>=0&&a.filter<=1);
  const floor=PASTURE_MESO.calmHeight+(PASTURE_MESO.managedCalmHeight-PASTURE_MESO.calmHeight)*managed;
  assert(a.envelope>=floor-1e-12&&a.envelope<=1);assert(a.height>=0&&a.height<=PASTURE_MESO.height*(1+(PASTURE_MESO.managedHeight-1)*managed)+1e-12);
  if(footprint>=PASTURE_MESO.groupFilter[1])assert(a.dx===0&&a.dz===0&&a.filter===0);
  cases++;
 }
 assert.equal(cases,19320);assert(maxError<2e-7);
});

test('actual local and group cell seams retain continuous height and first derivative',()=>{
 let cases=0;
 for(const kind of['local','group'])for(let i=-15;i<=15;i++)for(const managed of[0,.5,1]){
  const basis=kind==='local'?[.8,.6]:[.6,-.8],metres=kind==='local'?PASTURE_MESO.localMetres:PASTURE_MESO.groupMetres,offset=kind==='local'?[19.1,-7.7]:[-37.3,11.9],u=i-offset[0],v=.37-offset[1],x=metres*(basis[0]*u-basis[1]*v),z=metres*(basis[1]*u+basis[0]*v);
  const a=pastureMesoAt(x-basis[0]*1e-6,z-basis[1]*1e-6,0,managed),b=pastureMesoAt(x+basis[0]*1e-6,z+basis[1]*1e-6,0,managed);
  assert(Math.abs(a.height-b.height)<2e-6);assert(Math.hypot(a.dx-b.dx,a.dz-b.dz)<5e-6);cases++;
 }
 assert.equal(cases,186);
});

test('all captured native points retain finite relief and continuous managed/filter transitions',()=>{
 assert.equal(native.capturedPoints.length,18);let cases=0;
 for(const p of native.capturedPoints){
  const[x,,z]=p.point,m=p.mask[2],q=pastureMesoAt(x,z,0,m);assert(Object.values(q).every(Number.isFinite));assert(q.filter>=0&&q.filter<=1);
  assert.deepEqual(pastureMesoAt(x,z,0,-1),pastureMesoAt(x,z,0,0));assert.deepEqual(pastureMesoAt(x,z,0,2),pastureMesoAt(x,z,0,1));
  for(const managed of[0,.25,.5,.75,1]){
   const a=pastureMesoAt(x,z,0,managed-1e-7),b=pastureMesoAt(x,z,0,managed+1e-7);assert(Math.max(...fields.map(k=>Math.abs(a[k]-b[k])))<1e-6);cases++;
  }
  for(const footprint of[...PASTURE_MESO.localFilter,...PASTURE_MESO.groupFilter])for(const managed of[0,1]){
   const a=pastureMesoAt(x,z,footprint-1e-7,managed),b=pastureMesoAt(x,z,footprint+1e-7,managed);assert(Math.max(...fields.map(k=>Math.abs(a[k]-b[k])))<1e-6);cases++;
  }
 }
 assert.equal(cases,234);
 const wide=native.capturedPoints.filter(p=>p.view==='clover-masonry-owner');assert.equal(wide.length,6);
 for(const p of wide){assert.deepEqual(p.mask,[0,0,1]);const q=pastureMesoAt(p.point[0],p.point[2],0,1);assert(Math.abs(q.filter-.4756)<1e-12);assert.equal(p.baseline.filter,.08800000000000001);}
});

test('new terrain gradients stay bounded on steep surfaces and fully excluded substrates retain exact zero response',()=>{
 assert.equal(PASTURE_MESO.normalLimit,.30);let cases=0;
 for(const surface of[[0,1,0],[1,0,0],[0,0,1],[.2,.8,.1]])for(const previous of[[0,1,0],[1,0,0],[-1,0,0],[.5,.5,.5]])for(let i=0;i<100;i++){
  const n=unit(surface),old=unit(previous),q=pastureMesoAt(i*13.17,i*-9.11,0,1),g=[q.dx,0,q.dz],dot=g.reduce((s,x,k)=>s+x*n[k],0),p=g.map((x,k)=>x-n[k]*dot),scale=Math.min(1,PASTURE_MESO.normalLimit/Math.max(Math.hypot(...p),.00001));
  for(const cover of[0,.5,1]){const next=old.map((x,k)=>x-p[k]*scale*cover),length=Math.hypot(...next);assert(length>=.70-1e-12&&Number.isFinite(length));if(cover===0)assert.deepEqual(next,old);cases++;}
 }
 assert.equal(cases,4800);
 const s=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const cover=(other,canopy,wear,bank,canyon,soil)=>(1-s(.04,.58,other))*(1-s(.02,.68,canopy))*(1-s(.02,.62,Math.max(wear,bank)))*(1-s(.02,.65,canyon))*(1-Math.max(0,Math.min(1,soil)));
 assert.equal(cover(0,0,0,0,0,0),1);for(let i=0;i<6;i++){const p=[0,0,0,0,0,0];p[i]=1;assert.equal(cover(...p),0);}
 for(const text of['max(max(snow,coldPowder),max(rocky,quarters))','*(1.0-smoothstep(.02,.68,canopy))','*(1.0-smoothstep(.02,.65,canyon))','*(1.0-clamp(soilWeight,0.0,1.0))'])assert(source.includes(text));
});

test('actual emitted crown/root tint, matte roughness and ambient visibility remain bounded and vanish with zero pasture cover',()=>{
 const tint=fragment.match(/surface\*=mix\(vec3\(1\.0\),mix\(vec3\(([^)]+)\),vec3\(([^)]+)\),pastureGrowth\.x\),pastureMaterial\);/);assert(tint);
 const low=tint[1].split(',').map(Number),high=tint[2].split(',').map(Number);assert.deepEqual(low,[.80,.89,.75]);assert.deepEqual(high,[1.075,1.05,.99]);
 const cavity=fragment.match(/reflectedLight\.indirectDiffuse\*=1\.0-([\d.]+)\*pastureHollow\*pastureMaterial/);assert(cavity);assert.equal(Number(cavity[1]),PASTURE_MESO.rootOcclusion);assert.equal(PASTURE_MESO.rootOcclusion,.30);
 const rough=fragment.match(/roughnessFactor=mix\(roughnessFactor,([\d.]+)\+([\d.]+)\*pastureHollow,pastureMaterial\*\(1\.0-rainWet\)\)/);assert(rough);const r0=Number(rough[1]),r1=Number(rough[2]);assert.equal(r0,.89);assert.equal(r1,.10);
 const rootWarm=fragment.match(/surface=mix\(surface,surface\*vec3\(([^)]+)\),pastureHollow\*pastureMaterial\*([\d.]+)\*\(1\.0-pastureManaged\*([\d.]+)\)\)/);assert(rootWarm);const warm=rootWarm[1].split(',').map(Number),warmWeight=Number(rootWarm[2]),managedSuppression=Number(rootWarm[3]);
 for(let i=0;i<=100;i++)for(const material of[0,.25,.5,.75,1])for(const managed of[0,1]){
  const crown=i/100,hollow=(1-crown)**2,ao=1-Number(cavity[1])*hollow*material;assert(ao>=.70&&ao<=1);
  const multiplier=low.map((v,k)=>(1-material)+(v+(high[k]-v)*crown)*material).map((v,k)=>v*(1+(warm[k]-1)*hollow*material*warmWeight*(1-managed*managedSuppression)));
  assert(multiplier.every(v=>Number.isFinite(v)&&v>.73&&v<1.10));
  if(material===0){assert.equal(ao,1);assert.deepEqual(multiplier,[1,1,1]);}
  const target=r0+r1*hollow;assert(target>=.89&&target<=.99);
  for(const base of[.43,.65,.96,1])for(const rainWet of[0,.5,1]){
   const amount=material*(1-rainWet),value=base*(1-amount)+target*amount;assert(value>=.43&&value<=1);if(material===0||rainWet===1)assert.equal(value,base);
  }
 }
 assert(!/reflectedLight\.direct|emissive|directionalLights|gl_FragColor|discard\s*;/.test(source));
 assert(fragment.indexOf('reflectedLight.indirectDiffuse*=1.0-')>fragment.indexOf('#include <aomap_fragment>'));
});

test('repeated and missing-prerequisite material patches are atomic',()=>{
 assert.equal(patchPastureMesoSurface({...shader}),false);
 for(const anchor of['#include <aomap_fragment>','      soilWeight*=soilReady;']){
  const partial={...shader,uniforms:{...shader.uniforms},fragmentShader:fragment.replace('PASTURE_MESOSURFACE_V4','removed-marker').replace(anchor,'')},before=partial.fragmentShader,vertex=partial.vertexShader,uniforms=Object.keys(partial.uniforms);
  assert.equal(patchPastureMesoSurface(partial),false);assert.equal(partial.fragmentShader,before);assert.equal(partial.vertexShader,vertex);assert.deepEqual(Object.keys(partial.uniforms),uniforms);
 }
});
