import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {CRAG_PLANES,CRAG_MINERAL_CACHE,dressCragMineral} from '../assets/crag-mineral-surface.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const T=await import(pathToFileURL(path.join(ROOT,'assets/vendor/three/build/three.module.js')));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const scale=(a,s)=>a.map(x=>x*s);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>scale(a,1/Math.hypot(...a));
const close=(a,b,e=1e-12)=>a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<=e,`${a} != ${b}`));
function basis(p,sign){return {u:scale(p.u,p.signed==='u'?sign:1),v:scale(p.v,p.signed==='v'?sign:1)};}
// Analytic interpretation of the emitted surface-gradient expression. These
// numerical checks are not a claim that GLSL was linked or rendered on a GPU.
function gradientNormal(n,samples,strength=.65){
  n=norm(n);let g=[0,0,0];const weights=n.map(x=>Math.abs(x)**4),sum=weights.reduce((a,b)=>a+b);
  for(let i=0;i<3;i++){
    const {u,v}=basis(CRAG_PLANES[i],n[i]>=0?1:-1),s=samples[i];
    const gi=scale(add(scale(u,s[0]),scale(v,s[1])),-strength/Math.max(s[2],.25));
    g=add(g,scale(gi,weights[i]/sum));
  }
  g=add(g,scale(n,-dot(n,g)));
  return norm(add(n,scale(g,-1)));
}
function fixture(){
  const textures=[new T.Texture(),new T.Texture(),new T.Texture(),new T.Texture()];
  const material=new T.MeshStandardMaterial({map:textures[0],normalMap:textures[1],roughnessMap:textures[2],metalness:0,side:T.DoubleSide});
  const source={name:'existing canyon',map:textures[1],normalMap:textures[2],roughnessMap:textures[3]};
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  return {material,source,shader,textures};
}
test('all six signed projections are orthogonal, right handed and metre aligned',()=>{
  for(let i=0;i<3;i++)for(const s of [-1,1]){
    const {u,v}=basis(CRAG_PLANES[i],s),axis=[0,0,0];axis[i]=s;
    close(cross(u,v),axis);assert.equal(dot(u,v),0);
    const p=scale(u,1.83);close([dot(p,u)/1.83,dot(p,v)/1.83],[1,0]);
  }
  close(basis(CRAG_PLANES[0],1).u,[0,0,-1]);
  close(basis(CRAG_PLANES[1],1).v,[0,0,-1]);
  close(basis(CRAG_PLANES[2],-1).u,[-1,0,0]);
});
test('neutral maps preserve arbitrary surface normals and sampled tilt follows signed U/V',()=>{
  const flat=[[0,0,1],[0,0,1],[0,0,1]];
  for(const n of [[1,0,0],[-1,0,0],[.2,.7,-.4],[1e-12,-1,1e-9],[-.4,-.3,-.8]])close(gradientNormal(n,flat),norm(n));
  for(let i=0;i<3;i++)for(const sign of [-1,1])for(const which of ['u','v']){
    const n=[0,0,0];n[i]=sign;const samples=flat.map(x=>x.slice());samples[i][which==='u'?0:1]=.2;
    const actual=gradientNormal(n,samples),direction=basis(CRAG_PLANES[i],sign)[which];
    assert.ok(dot(actual,direction)>0);assert.ok(dot(actual,n)>.98);
  }
});
test('blend seams and grazing normal samples stay finite and normalized',()=>{
  for(let x=-1;x<=1;x+=.2)for(let z=-1;z<=1;z+=.2){
    const n=gradientNormal([x,.1,z],[[.9,-.3,0],[-.2,.9,-.1],[.3,.2,.7]]);
    assert.ok(n.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...n)-1)<1e-12);
  }
});
test('actual Standard shader hook borrows resident maps with ten fetches and preserves flags',()=>{
  const {material,source,shader,textures}=fixture();
  const original={map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,side:material.side,metalness:material.metalness,uuid:material.uuid};
  const textureStates=textures.map(t=>({uuid:t.uuid,version:t.version,wrapS:t.wrapS,wrapT:t.wrapT,colorSpace:t.colorSpace,anisotropy:t.anisotropy}));
  const random=Math.random;Math.random=()=>{throw Error('Unexpected RNG/allocation');};
  try{dressCragMineral({material,source});material.onBeforeCompile(shader);}finally{Math.random=random;}
  for(const [key,value]of Object.entries(original))assert.equal(material[key],value);
  assert.deepEqual(textures.map(t=>({uuid:t.uuid,version:t.version,wrapS:t.wrapS,wrapT:t.wrapT,colorSpace:t.colorSpace,anisotropy:t.anisotropy})),textureStates);
  assert.equal(shader.uniforms.cragAlbedo.value,source.map);assert.equal(shader.uniforms.cragNormal.value,source.normalMap);
  assert.equal(shader.uniforms.cragArm.value,source.roughnessMap);assert.equal(shader.uniforms.cragMetres.value,1.83);
  assert.equal(material.customProgramCacheKey(),CRAG_MINERAL_CACHE);
  assert.equal((shader.fragmentShader.match(/texture2D\(/g)||[]).length,10);
  for(const anchor of ['map_fragment','normal_fragment_maps','roughnessmap_fragment','metalnessmap_fragment','aomap_fragment'])
    assert.ok(!shader.fragmentShader.includes(`#include <${anchor}>`));
  assert.ok(shader.vertexShader.includes('transformedNormal*mat3(viewMatrix)'));
  assert.ok(shader.fragmentShader.includes('cragGradient-=cragGeometryNormal*dot(cragGeometryNormal,cragGradient)'));
  assert.ok(shader.fragmentShader.includes('computeSpecularOcclusion(cragDotNV,cragOcclusion,material.roughness)'));
});
test('missing maps, invalid scale and missing shader anchors reject rather than silently degrade',()=>{
  const {material,source,shader}=fixture();
  assert.throws(()=>dressCragMineral({material,source:{},metres:1.83}),/existing atlas/);
  assert.throws(()=>dressCragMineral({material,source,metres:0}),/Invalid/);
  dressCragMineral({material,source});shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','');
  assert.throws(()=>material.onBeforeCompile(shader),/Missing or repeated/);
});
