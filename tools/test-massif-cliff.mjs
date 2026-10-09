import test from 'node:test';
import assert from 'node:assert/strict';
import {dressMassifCliffSurface,MASSIF_CLIFF_CACHE} from '../assets/massif-cliff-surface.mjs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {dressLandscape} from '../assets/landscape-surface.js';
import {CRAG_PLANES} from '../assets/crag-mineral-surface.mjs';
const shape=()=>({uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader});
function fixture(ready=true){
 const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1,metalness:0});
 class Loader{load(){return {anisotropy:4};}}
 dressLandscape({THREE:{...T,TextureLoader:Loader},material,wooded:true,regional:true,fogScale:.78,fogCap:.96,bumpStrength:.12});
 const image=ready?{width:1024,height:1024}:undefined;
 const source={name:'resident cliff',map:{image},normalMap:{image},roughnessMap:{image}};
 return {material,source};
}
function noRandom(fn){const random=Math.random;Math.random=()=>{throw Error('Unexpected RNG/resource allocation');};try{return fn();}finally{Math.random=random;}}
function compile(material){const s=shape();material.onBeforeCompile(s);return s;}
test('all three resident maps activate the actual dressed Standard shader with zero RNG/resources',async()=>{
 const {material,source}=fixture();const before=compile(material),key=material.customProgramCacheKey(),uuid=material.uuid;
 const sourceState=JSON.stringify(source);
 noRandom(()=>dressMassifCliffSurface({material,source}));
 const state=await material.userData.cliffSurface.ready;
 assert.equal(state.loaded,3);assert.equal(state.failed,false);assert.equal(state.newTextures,0);
 assert.equal(Object.keys(state).includes('ready'),false);assert.equal(JSON.stringify(source),sourceState);
 const after=noRandom(()=>compile(material));
 assert.equal(material.uuid,uuid);assert.equal(material.side,T.DoubleSide);assert.equal(material.roughness,1);assert.equal(material.metalness,0);
 assert.equal(material.customProgramCacheKey(),key+'-'+MASSIF_CLIFF_CACHE);
 assert.equal(after.uniforms.cliffAlbedo.value,source.map);assert.equal(after.uniforms.cliffNormal.value,source.normalMap);assert.equal(after.uniforms.cliffArm.value,source.roughnessMap);
 assert.equal((after.fragmentShader.match(/texture2D\(/g)||[]).length-(before.fragmentShader.match(/texture2D\(/g)||[]).length,9);
 for(const t of ['cliffGeometryNormal*=gl_FrontFacing?1.0:-1.0','cliffGradient-=cliffGeometryNormal*dot(cliffGeometryNormal,cliffGradient)','roughnessFactor*=mix','computeSpecularOcclusion(cliffDotNV'])assert.ok(after.fragmentShader.includes(t));
 assert.ok(after.vertexShader.includes('transformedNormal*mat3(viewMatrix)'));
 for(const anchor of ['roughnessmap_fragment','aomap_fragment','lights_physical_fragment'])assert.equal(after.fragmentShader.split('#include <'+anchor+'>').length,2);
 assert.equal(before.fragmentShader.slice(before.fragmentShader.lastIndexOf('#ifdef USE_FOG')),after.fragmentShader.slice(after.fragmentShader.lastIndexOf('#ifdef USE_FOG')));
});
test('pending resident images preserve exact existing shader until all three complete',async()=>{
 const {material,source}=fixture(false);const before=compile(material),key=material.customProgramCacheKey();
 dressMassifCliffSurface({material,source,timeoutMs:200});
 assert.deepEqual(compile(material),before);assert.equal(material.customProgramCacheKey(),key);
 source.map.image={width:1024,height:1024};source.normalMap.image={width:1024,height:1024};
 await new Promise(r=>setTimeout(r,45));assert.equal(material.userData.cliffSurface.loaded,2);assert.deepEqual(compile(material),before);
 source.roughnessMap.image={width:1024,height:1024};await material.userData.cliffSurface.ready;
 assert.equal(material.userData.cliffSurface.loaded,3);assert.notEqual(compile(material).fragmentShader,before.fragmentShader);
});
test('missing maps and failed image readiness retain exact complete fallback shader',async()=>{
 for(const available of [false,true]){
  const {material,source}=fixture(false);const before=compile(material),key=material.customProgramCacheKey();
  dressMassifCliffSurface({material,source:available?source:{},timeoutMs:0});
  const state=await material.userData.cliffSurface.ready;
  assert.equal(state.failed,true);assert.equal(state.status,'fallback');assert.equal(state.errors.length,1);
  assert.deepEqual(compile(material),before);assert.equal(material.customProgramCacheKey(),key);
 }
});
test('changed upstream anchors fail atomically to the original shader',async()=>{
 const {material,source}=fixture();const original=material.onBeforeCompile;
 material.onBeforeCompile=s=>{original(s);s.fragmentShader=s.fragmentShader.replace('diffuseColor.rgb*=relief;','diffuseColor.rgb *= relief;');};
 const before=compile(material);dressMassifCliffSurface({material,source});
 assert.deepEqual(compile(material),before);assert.equal(material.userData.cliffSurface.failed,true);assert.match(material.userData.cliffSurface.errors[0],/shader anchor/);
});
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),scale=(a,s)=>a.map(v=>v*s),add=(a,b)=>a.map((v,i)=>v+b[i]),norm=a=>scale(a,1/Math.hypot(...a));
function gradient(n,samples){n=norm(n);const w=n.map(x=>Math.abs(x)**4),sum=w.reduce((a,b)=>a+b);let g=[0,0,0];for(let i=0;i<3;i++){const p=CRAG_PLANES[i],sg=n[i]>=0?1:-1,u=scale(p.u,p.signed==='u'?sg:1),v=scale(p.v,p.signed==='v'?sg:1),s=samples[i];g=add(g,scale(add(scale(u,s[0]),scale(v,s[1])),-1.05/Math.max(s[2],.25)*w[i]/sum));}g=add(g,scale(n,-dot(n,g)));return norm(add(n,scale(g,-1)));}
test('neutral triplanar samples retain all sloped normals and signed samples stay finite',()=>{
 for(let x=-1;x<=1;x+=.25)for(let y=-1;y<=1;y+=.25)for(let z=-1;z<=1;z+=.25){
  if(!x&&!y&&!z)continue;const n=norm([x,y,z]),out=gradient(n,[[0,0,1],[0,0,1],[0,0,1]]);out.forEach((v,i)=>assert.ok(Math.abs(v-n[i])<1e-12));
  const detail=gradient(n,[[.3,-.7,.1],[-.2,.5,0],[.2,.7,.4]]);assert.ok(detail.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...detail)-1)<1e-12);
 }
});
