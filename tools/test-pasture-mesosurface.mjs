import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createTerrainSurface} from '../assets/terrain-realism.js';
import {patchOuterRegions} from '../assets/outer-landscape.js';
import {PASTURE_MESO,pastureMesoAt,patchPastureMesoSurface} from '../assets/pasture-mesosurface.mjs';
const source=readFileSync(new URL('../assets/pasture-mesosurface.mjs',import.meta.url),'utf8');
const shader=()=>({vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}});
let material,pixels;const previousDocument=globalThis.document;
const context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:p=>{pixels=p;},getImageData:()=>pixels,fillRect(){},createRadialGradient:()=>({addColorStop(){}}),beginPath(){},lineTo(){},moveTo(){},stroke(){}};
globalThis.document={createElement:()=>({getContext:()=>context})};
try{material=createTerrainSurface({THREE:{...T,TextureLoader:class{load(){return new T.Texture();}}},renderer:{capabilities:{getMaxAnisotropy:()=>4}},grass:new T.Texture(),bump:new T.Texture()}).material;}
finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
const main=shader();material.onBeforeCompile(main);const outer={...main,uniforms:{...main.uniforms}};assert.equal(patchOuterRegions(outer),true);
const count=(s,p)=>s.split(p).length-1;
test('main and outer use one coherent meso field after their final substrate and normal responses',()=>{
 for(const sh of[main,outer]){
  assert.equal(count(sh.fragmentShader,'PASTURE_MESOSURFACE_V2'),1);
  assert.equal(count(sh.fragmentShader,'vec4 pastureMesoGrowth('),1);
  assert(sh.fragmentShader.indexOf('float pastureCover=')>sh.fragmentShader.indexOf('soilWeight*=soilReady;'));
  assert(sh.fragmentShader.indexOf('vec3 pastureGradient=')>sh.fragmentShader.indexOf('normal=normalize(mix(normal,normalize(mat3(viewMatrix)*powderNormal),coldPowder));'));
  assert(sh.fragmentShader.indexOf('reflectedLight.indirectDiffuse*=1.0-')>sh.fragmentShader.indexOf('#include <aomap_fragment>'));
 }
 assert(outer.fragmentShader.indexOf('float pastureCover=')>outer.fragmentShader.indexOf('if(outerBank>.003)'));
 assert(outer.fragmentShader.indexOf('vec3 pastureGradient=')>outer.fragmentShader.indexOf('vec3 outerRelief='));
 assert(outer.fragmentShader.includes('OUTER_GROUND_GRAIN_V4'));
 assert(outer.fragmentShader.includes('outerGroundGrain(outerGroundAlbedo(terrainSoil,soilUV*3.0'));
});
test('meso response creates no texture/resource, changes no vertex source and retains opacity',()=>{
 assert(!/texture2D|sampler2D|TextureLoader|new\s+.*Texture|gl_FragColor|diffuseColor\.a|discard\s*;/.test(source));
 assert.equal(material.transparent,false);assert.equal(material.opacity,1);assert.equal(material.depthWrite,true);
 assert.equal(outer.vertexShader,main.vertexShader);assert.deepEqual(Object.keys(outer.uniforms),Object.keys(main.uniforms));for(const name of Object.keys(main.uniforms))assert.equal(outer.uniforms[name],main.uniforms[name]);
 assert(source.includes('reflectedLight.indirectDiffuse*='));assert(!source.includes('reflectedLight.direct'));
});
test('repeated and incomplete patching is atomic',()=>{
 const repeated={...main};assert.equal(patchPastureMesoSurface(repeated),false);assert.equal(repeated.fragmentShader,main.fragmentShader);
 // Strip only the known hook additions by rebuilding the owner's unpatched
 // source is unnecessary: a missing prerequisite must leave any input intact.
 for(const anchor of ['#include <aomap_fragment>','      soilWeight*=soilReady;']){
  const partial={...main,fragmentShader:main.fragmentShader.replace('PASTURE_MESOSURFACE_V2','removed-marker').replace(anchor,'')};const initial=partial.fragmentShader;assert.equal(patchPastureMesoSurface(partial),false);assert.equal(partial.fragmentShader,initial);
 }
});
test('analytic gradients agree with independent central differences of physical tuft height',()=>{
 const epsilon=1e-5;let tested=0;
 for(let z=-615;z<=615;z+=41.7)for(let x=-615;x<=615;x+=37.1)for(const footprint of[0,.6,2])for(const managed of[0,1]){
  const a=pastureMesoAt(x,z,footprint,managed),dx=(pastureMesoAt(x+epsilon,z,footprint,managed).height-pastureMesoAt(x-epsilon,z,footprint,managed).height)/(2*epsilon),dz=(pastureMesoAt(x,z+epsilon,footprint,managed).height-pastureMesoAt(x,z-epsilon,footprint,managed).height)/(2*epsilon);
  assert(Math.abs(a.dx-dx)<2e-7);assert(Math.abs(a.dz-dz)<2e-7);assert(a.crown>=0&&a.crown<=1);assert(a.filter>=0&&a.filter<=1);tested++;
 }
 assert(tested>5000);
});
test('field filtering removes subpixel response and managed turf has shallower coherent relief',()=>{
 for(let i=0;i<100;i++){
  const x=i*13.7,z=i*-29.3,full=pastureMesoAt(x,z),managed=pastureMesoAt(x,z,0,1),far=pastureMesoAt(x,z,PASTURE_MESO.groupFilter[1]);
  assert.equal(full.crown,managed.crown);assert.equal(full.envelope,managed.envelope);assert(Math.abs(managed.filter-full.filter*PASTURE_MESO.managedMaterial)<1e-12);assert(Math.abs(managed.height-full.height*PASTURE_MESO.managedHeight)<1e-12);
  assert(Math.abs(managed.dx-full.dx*PASTURE_MESO.managedHeight)<1e-12);assert(Math.abs(managed.dz-full.dz*PASTURE_MESO.managedHeight)<1e-12);
  assert.equal(Math.abs(far.dx),0);assert.equal(Math.abs(far.dz),0);assert.equal(far.filter,0);
 }
});
test('projected normal relief stays finite, bounded and neutral for zero gradient',()=>{
 for(const raw of[[0,1,0],[1,0,0],[0,0,1],[.2,.8,.1]])for(const previous of[[0,1,0],[1,0,0],[-1,0,0],[.5,.5,.5]])for(let i=0;i<40;i++){
  const n=new T.Vector3(...raw).normalize(),old=new T.Vector3(...previous).normalize(),f=pastureMesoAt(i*31.3,i*-15.7),g=new T.Vector3(f.dx,0,f.dz);g.addScaledVector(n,-g.dot(n));g.multiplyScalar(Math.min(1,PASTURE_MESO.normalLimit/Math.max(g.length(),.00001)));
  assert(g.length()<=PASTURE_MESO.normalLimit+1e-12);const result=old.clone().sub(g);assert(result.length()>=1-PASTURE_MESO.normalLimit-1e-12);result.normalize();assert(result.toArray().every(Number.isFinite));assert(Math.abs(result.length()-1)<1e-12);
  assert(old.clone().sub(new T.Vector3()).normalize().distanceTo(old)<1e-12);
 }
});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
test('non-pasture substrates suppress the response and cavity shading cannot remove direct light',()=>{
 const cover=(other,canopy,wear,bank,canyon,soil)=>(1-smooth(.04,.58,other))*(1-smooth(.02,.68,canopy))*(1-smooth(.02,.62,Math.max(wear,bank)))*(1-smooth(.02,.65,canyon))*(1-Math.max(0,Math.min(1,soil)));
 assert.equal(cover(0,0,0,0,0,0),1);
 for(let i=0;i<6;i++){const shares=[0,0,0,0,0,0];shares[i]=1;assert.equal(cover(...shares),0);}
 for(const hollow of[0,.25,1])for(const material of[0,.5,1]){const ambient=1-PASTURE_MESO.rootOcclusion*hollow*material;assert(ambient>=.86&&ambient<=1);}
 for(const text of ['max(max(snow,coldPowder),max(rocky,quarters))','*(1.0-smoothstep(.02,.68,canopy))','*(1.0-smoothstep(.02,.65,canyon))','*(1.0-clamp(soilWeight,0.0,1.0))'])assert(source.includes(text));
});


test('the broad growth envelope leaves calm and fuller patches without another noise band',()=>{
 assert.equal(count(source,'vec3 local=pastureMesoNoise('),1);assert.equal(count(source,'vec3 group=pastureMesoNoise('),1);
 assert(source.includes('+crown*envelopeGradient)'));
 let quiet=0,full=0,total=0;
 for(let z=-500;z<=500;z+=5.3)for(let x=-500;x<=500;x+=5.7){const p=pastureMesoAt(x,z);assert(p.envelope>=PASTURE_MESO.calmHeight&&p.envelope<=1);if(p.envelope<.25)quiet++;if(p.envelope>.75)full++;total++;}
 assert(quiet>total*.20,'open pasture needs connected calm patches');assert(full>total*.10,'fuller sward must remain represented');
 for(let i=0;i<30;i++){const a=pastureMesoAt(i*19.3,i*-13.7,0),b=pastureMesoAt(i*19.3,i*-13.7,.8);assert(b.filter<=a.filter,'local detail must filter out rather than grow with distance');}
});
