import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {HOLLOWPEAK_ROCK_GLSL} from '../assets/hollowpeak-rock-surface.mjs';
import {HOLLOWPEAK_SHORE_PROJECTION_GLSL,patchHollowpeakShoreResponse,configureHollowpeakShoreResponse} from '../assets/hollowpeak-shore-response.mjs';
const normalise=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const times=(a,s)=>a.map(x=>x*s);
const close=(a,b,tol=1e-12)=>assert(Math.hypot(...a.map((x,i)=>x-b[i]))<tol,JSON.stringify({a,b}));
const sourceGrey='float shoreGrey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(shoreGrey),diffuseColor.rgb,.035);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10),.25);';
// The selected parent bank adds this retained response after the stock map chunk.
// Coverage/wetness geometry is exercised separately by the existing shore-response suite.
const stitched=()=>({uniforms:{resident:{value:42}},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+sourceGrey)});

test('projection core is the accepted cliff algebra and exact 6.8m scale',()=>{
 let core=HOLLOWPEAK_ROCK_GLSL;
 core=core.slice(core.indexOf('varying vec3 rockWorld,rockNormal;')).replaceAll('rockWorld','shoreWorld').replaceAll('rockNormal','shoreWorldNormal').replaceAll('hollowRock','shoreMineral');
 assert.equal(HOLLOWPEAK_SHORE_PROJECTION_GLSL,core);
 assert(HOLLOWPEAK_SHORE_PROJECTION_GLSL.includes('return p/6.8+'));
});

test('actual shoreline stitch routes albedo and ARM maps across every axis',()=>{
 const s=stitched(),uniforms=Object.fromEntries(['vertexShader','fragmentShader'].map(k=>[k,[...s[k].matchAll(/\buniform\s+[^;]+;/g)].map(v=>v[0]).sort()]));patchHollowpeakShoreResponse(s);
 for(const projection of ['shoreWorld.zy','shoreWorld.xz','shoreWorld.xy'])assert(s.fragmentShader.includes('shoreMineralUV('+projection+')'));
 for(const sampler of ['map','roughnessMap','metalnessMap'])assert(s.fragmentShader.includes('shoreMineralTri('+sampler+')'));
 for(const suffix of ['X','Y','Z'])assert(s.fragmentShader.includes('texture2D(normalMap,shoreUv'+suffix+')'));
 const stock=T.ShaderChunk;
 assert(stock.roughnessmap_fragment.includes('roughnessFactor *= texelRoughness.g;'));
 assert(stock.metalnessmap_fragment.includes('metalnessFactor *= texelMetalness.b;'));
 assert(s.fragmentShader.includes(stock.map_fragment.replace('texture2D( map, vMapUv )','shoreMineralTri(map)')));
 assert(s.fragmentShader.includes('roughnessFactor*=texelRoughness.g;'));
 assert(s.fragmentShader.includes('metalnessFactor*=texelMetalness.b;'));
 assert(s.fragmentShader.includes('float roughnessFactor=roughness;'));
 assert(s.fragmentShader.includes('float metalnessFactor=metalness;'));
 assert(s.fragmentShader.includes('#ifdef DECODE_VIDEO_TEXTURE'));
 for(const k of ['vertexShader','fragmentShader'])assert.deepEqual([...s[k].matchAll(/\buniform\s+[^;]+;/g)].map(v=>v[0]).sort(),uniforms[k],'No added material uniforms');
 assert(!/texture2D\(aoMap/.test(s.fragmentShader),'Do not add AO behavior absent from selected original material');
 assert(s.vertexShader.includes('transformedNormal*mat3(viewMatrix)'));
 assert(s.fragmentShader.includes('mat3(viewMatrix)*normalize(shoreNx*shoreW.x+shoreNy*shoreW.y+shoreNz*shoreW.z)'));
});
test('actual compile hook and configuration consume no RNG or new uniforms',()=>{
 const material=new T.MeshStandardMaterial({roughness:.96,metalness:0});
 material.normalScale.set(.12,.12);
 const s=stitched(),uniforms=s.uniforms,resident=s.uniforms.resident;
 const previous=Math.random;let draws=0;
 Math.random=()=>{draws++;throw Error('Shore projection hooks may not consume world randomness');};
 try{configureHollowpeakShoreResponse(material);patchHollowpeakShoreResponse(s);}finally{Math.random=previous;material.dispose();}
 assert.equal(draws,0);assert.equal(s.uniforms,uniforms);assert.equal(s.uniforms.resident,resident);assert.deepEqual(Object.keys(s.uniforms),['resident']);
 assert(s.vertexShader.includes('shoreWorldNormal=normalize(transformedNormal*mat3(viewMatrix));'));
 assert(s.fragmentShader.includes('shoreMineralTri(roughnessMap)'));
 assert(s.fragmentShader.includes('shoreMineralTri(metalnessMap)'));
 assert(s.fragmentShader.includes('shoreCoverage=mix(1.0,shoreOuterFade,shoreLowHem)'));
});

test('missing or repeated shader contracts fail rather than silently skipping a channel',()=>{
 for(const anchor of ['defaultnormal_vertex','project_vertex']){
  const s=stitched();s.vertexShader=s.vertexShader.replace('#include <'+anchor+'>','');assert.throws(()=>patchHollowpeakShoreResponse(s));
  const repeated=stitched();repeated.vertexShader+='\n#include <'+anchor+'>';assert.throws(()=>patchHollowpeakShoreResponse(repeated));
 }
 for(const anchor of ['map_fragment','roughnessmap_fragment','metalnessmap_fragment','normal_fragment_maps']){
  const s=stitched();s.fragmentShader=s.fragmentShader.replace('#include <'+anchor+'>','');assert.throws(()=>patchHollowpeakShoreResponse(s));
  const repeated=stitched();repeated.fragmentShader+='\n#include <'+anchor+'>';assert.throws(()=>patchHollowpeakShoreResponse(repeated));
 }
});

// CPU algebra checks are independent of a GPU/compiler. They exercise the
// cotangent-frame identities with known plane fields; they are not a claim
// that these JavaScript calculations executed inside a fragment shader.
function projectedNormal({n,q0,q1,du,dv,map,scale=[1,1]}){
 const q1p=cross(q1,n),q0p=cross(n,q0);
 const tangent=add(times(q1p,du[0]),times(q0p,du[1]));
 const bitangent=add(times(q1p,dv[0]),times(q0p,dv[1]));
 const inverse=1/Math.sqrt(Math.max(dot(tangent,tangent),dot(bitangent,bitangent),1e-12));
 return normalise(add(times(add(times(tangent,map[0]*scale[0]),times(bitangent,map[1]*scale[1])),inverse),times(n,Math.max(map[2],.08))));
}
const axes=[
 {n:[1,0,0],q0:[0,1,0],q1:[0,0,1],du:[0,1/6.8],dv:[1/6.8,0],u:[0,0,1],v:[0,1,0]},
 {n:[-1,0,0],q0:[0,1,0],q1:[0,0,-1],du:[0,-1/6.8],dv:[1/6.8,0],u:[0,0,1],v:[0,1,0]},
 {n:[0,1,0],q0:[1,0,0],q1:[0,0,-1],du:[1/6.8,0],dv:[0,-1/6.8],u:[1,0,0],v:[0,0,1]},
 {n:[0,-1,0],q0:[1,0,0],q1:[0,0,1],du:[1/6.8,0],dv:[0,1/6.8],u:[1,0,0],v:[0,0,1]},
 {n:[0,0,1],q0:[1,0,0],q1:[0,1,0],du:[1/6.8,0],dv:[0,1/6.8],u:[1,0,0],v:[0,1,0]},
 {n:[0,0,-1],q0:[1,0,0],q1:[0,-1,0],du:[1/6.8,0],dv:[0,-1/6.8],u:[1,0,0],v:[0,1,0]}
];
test('neutral map preserves all six signed geometric normals and general slopes',()=>{
 for(const a of axes)close(projectedNormal({...a,map:[0,0,1]}),a.n);
 for(const v of [[1,2,3],[-1,2,3],[1,-2,3],[1,2,-3],[-3,-2,-1],[.01,1,.01]]){
  const n=normalise(v),q0=normalise(cross(n,[.3,.9,-.1])),q1=cross(n,q0);
  close(projectedNormal({n,q0,q1,du:[.14,-.02],dv:[.03,.17],map:[0,0,1]}),n);
 }
});
test('tilted normal maps point toward the known positive UV axes on both face signs',()=>{
 for(const a of axes){
  for(const [mx,my] of [[.3,0],[0,.4],[.3,-.2],[-.25,.3]]){
   const map=[mx,my,1],expected=normalise(add(a.n,add(times(a.u,mx),times(a.v,my))));
   close(projectedNormal({...a,map}),expected);
  }
 }
});
test('borrowed warp has positive Jacobian and its gradients retain all signed-axis frames',()=>{
 const minimumU=1/6.8-.11*.08,minimumV=1/6.8-.11*.07;
 assert(minimumU>0&&minimumV>0&&minimumU*minimumV>.019,'Analytic global no-fold bound');
 for(const a of axes)for(const [x,y]of [[-400,-300],[-151,-232],[0,0],[300,400]]){
  const phase=x*.08+y*.045,J=[1/6.8+.0088*Math.cos(phase),.00495*Math.cos(phase),0,1/6.8-.0077*Math.sin(y*.07)];
  const du=a.du.map((v,i)=>v*6.8*J[0]+a.dv[i]*6.8*J[1]);
  const dv=a.du.map((v,i)=>v*6.8*J[2]+a.dv[i]*6.8*J[3]);
  const uGradient=add(times(a.u,J[0]),times(a.v,J[1])),vGradient=add(times(a.u,J[2]),times(a.v,J[3]));
  const frameScale=1/Math.max(Math.hypot(...uGradient),Math.hypot(...vGradient));
  const expected=normalise(add(a.n,times(add(times(uGradient,.3),times(vGradient,-.2)),frameScale)));
  close(projectedNormal({...a,du,dv,map:[.3,-.2,1]}),expected);
 }
});
test('nonuniform normalScale and neutral weighted blending preserve original scalar intent',()=>{
 const shader=stitched();patchHollowpeakShoreResponse(shader);
 const roughnessExpression=shader.fragmentShader.match(/roughnessFactor\s*\*=([^;]+);/)?.[1],metalnessExpression=shader.fragmentShader.match(/metalnessFactor\s*\*=([^;]+);/)?.[1];
 assert(roughnessExpression&&metalnessExpression,'Evaluate the actual selected shader factors');
 const actualRoughness=new Function('roughness','texelRoughness','let roughnessFactor=roughness;roughnessFactor*='+roughnessExpression+';return roughnessFactor;');
 const actualMetalness=new Function('metalness','texelMetalness','let metalnessFactor=metalness;metalnessFactor*='+metalnessExpression+';return metalnessFactor;');
 for(const a of axes)close(projectedNormal({...a,map:[.3,-.2,1],scale:[.12,.24]}),normalise(add(a.n,add(times(a.u,.036),times(a.v,-.048)))));
 for(const n0 of [[1,2,3],[-1,2,3],[1,-2,-3]]){
  const n=normalise(n0),raw=n.map(v=>Math.abs(v)**6),sum=raw.reduce((a,b)=>a+b),w=raw.map(v=>v/sum);
  close(normalise(w.reduce((a,v)=>add(a,times(n,v)),[0,0,0])),n);
  const texels=[[.11,.47,.83],[.17,.23,.67],[.31,.59,.91]],g=texels.reduce((s,v,i)=>s+w[i]*v[1],0),blue=texels.reduce((s,v,i)=>s+w[i]*v[2],0);
  const rgba={r:texels.reduce((s,v,i)=>s+w[i]*v[0],0),g,b:blue,a:1};
  for(const roughness of[.3,.96,1])assert.equal(actualRoughness(roughness,rgba),roughness*g);
  for(const metalness of[0,.37,1])assert.equal(actualMetalness(metalness,rgba),metalness*blue);
  assert.equal(actualMetalness(0,rgba),0,'Existing selected metalness remains exactly zero');
 }
});
test('configuration retains normal strength and roughness/metalness/map identities',()=>{
 const mat=new T.MeshStandardMaterial({roughness:.96,metalness:0,map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture(),envMapIntensity:.58});mat.normalScale.set(.12,.12);
 const before={roughness:mat.roughness,metalness:mat.metalness,normalScale:mat.normalScale,map:mat.map,normalMap:mat.normalMap,roughnessMap:mat.roughnessMap,envMapIntensity:mat.envMapIntensity};
 configureHollowpeakShoreResponse(mat);
 for(const [key,value]of Object.entries(before))assert.equal(mat[key],value,key);
 assert.deepEqual(mat.normalScale.toArray(),[.12,.12]);assert.equal(mat.metalness,0);
 for(const map of[mat.map,mat.normalMap,mat.roughnessMap])map.dispose();mat.dispose();
});
