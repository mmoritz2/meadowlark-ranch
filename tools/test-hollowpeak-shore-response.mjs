import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {loadHollowpeakCohortPayload} from '../assets/hollowpeak-cohort-payload.mjs';
import {applyHollowpeakCanonicalField} from '../assets/hollowpeak-canonical-field.mjs';
import {HOLLOWPEAK_DESIGN as D} from '../assets/hollowpeak-design.mjs';
import {createOwnedHollowpeakQueries} from '../assets/owned-hollowpeak-queries.mjs';
import {installHollowpeakShore} from '../assets/hollowpeak-shore.mjs';
import {createHollowpeakShoreOpticalAttributes} from '../assets/hollowpeak-shore-attributes.mjs';
import {createHollowpeakShoreWetness,configureHollowpeakShoreResponse,patchHollowpeakShoreResponse,HOLLOWPEAK_SHORE_HEM_POLICY as P} from '../assets/hollowpeak-shore-response.mjs';

// Authenticate the real resident package. Unknown outside nodes stay NaN: no
// historical capture, synthetic terrain, network, or machine path is needed.
const packet=await readFile(new URL('../assets/hollowpeak-cohort-1.bin',import.meta.url));
const payload=await loadHollowpeakCohortPayload({cryptoImpl:webcrypto,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>packet.buffer.slice(packet.byteOffset,packet.byteOffset+packet.byteLength)})});
const {size:N,step:S,originX:OX,originZ:OZ}=D.grid,heights=new Float32Array(N*N).fill(NaN);
applyHollowpeakCanonicalField(heights,payload.fieldBytes);
const source={...payload.shoreGeometry,heights},q=createOwnedHollowpeakQueries({...source,...payload});
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),hash=a=>createHash('sha256').update(bytes(a)).digest('hex');
const originalHashes=Object.fromEntries(Object.entries(source).map(([k,a])=>[k,hash(a)]));
const p=source.position,I=source.index,point=i=>[p[i*3],p[i*3+1],p[i*3+2]];
// Independent global cell/barycentric lookup, never the attribute helper's
// supplied owner plane. The actual fit query must agree with this lookup.
function ground(x,z){
  const gx=(x-OX)/S,gz=(z-OZ)/S,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,n=iz*N+ix;
  const ids=u+v<=1?[n,n+1,n+N]:[n+N+1,n+N,n+1],w=u+v<=1?[1-u-v,u,v]:[u+v-1,1-u,1-v];
  assert(ids.every(i=>Number.isFinite(heights[i])),'shore stays inside authenticated canonical rectangle');
  return ids.reduce((sum,i,k)=>sum+heights[i]*w[k],0);
}
function distance(x,z,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz);}
function residentSource(){
  const group=new T.Group(),pool=new T.Mesh(new T.CircleGeometry(9.8,32),new T.MeshPhysicalMaterial());pool.name='Hollowpeak | plunge pool';group.add(pool);
  const rock=new T.MeshStandardMaterial({map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture()});
  for(const texture of[rock.map,rock.normalMap,rock.roughnessMap])texture.image={width:8,height:8};
  const state=installHollowpeakShore({THREE:T,world:{terrainH:q.design.heightAt,groundSurfaces:[],colliders:[],fallsLandscape:{group,pool,rock:{material:rock},waters:[pool]}}});
  return {state,base:state.meshes[0].material,geometry:state.meshes[0].geometry};
}
const fixture=residentSource(),candidate=fixture.base.clone();
const shader={uniforms:{resident:{value:42}},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
fixture.base.onBeforeCompile(shader);configureHollowpeakShoreResponse(candidate);patchHollowpeakShoreResponse(shader);
// Evaluate the ACTUAL selected GLSL coverage expressions, not a second copied
// implementation that could silently drift when the material changes.
const formula=shader.fragmentShader.match(/float shoreLowHem=[\s\S]*?diffuseColor\.a\*=shoreCoverage;/)?.[0];
assert(formula,'selected shader must expose its coverage before alpha testing');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const evaluate=new Function('shoreLiftV','shoreOuterDistanceV','shoreHemEligibleV','smoothstep','step','mix','max',formula.replace(/\bfloat\b/g,'const').replace('diffuseColor.a*=shoreCoverage;','return shoreCoverage;'));
const coverage=(l,d,e)=>evaluate(l,d,e,smooth,(a,x)=>x<a?0:1,(a,b,t)=>a+(b-a)*t,Math.max);

test('actual packed shore keeps raised contact opaque and fades only its real low outer hem',t=>{
  const previous=Math.random;let draws=0,a;Math.random=()=>{draws++;throw Error('Optical attributes cannot consume world randomness');};
  try{a=createHollowpeakShoreOpticalAttributes(source);}finally{Math.random=previous;}
  assert.equal(draws,0);assert.equal(P.maximumDeclaredLiftM,.020);assert(P.maximumFadeLiftM<P.maximumDeclaredLiftM);assert(P.maximumFadeLiftM-P.rockSkinLiftM<.008);
  for(const field of['canonicalLift','outerDistance','hemEligible'])assert(a[field] instanceof Float32Array&&a[field].length===p.length/3&&a[field].every(Number.isFinite));
  // Independently identify finite mesh boundary edges. The contact owner must
  // witness solid shore inside and empty space outside each accepted segment.
  const edges=new Map(),key=v=>v[0]+','+v[2];
  for(let f=0;f<I.length;f+=3)for(let k=0;k<3;k++){
    const a=point(I[f+k]),b=point(I[f+(k+1)%3]),id=[key(a),key(b)].sort().join('|');
    const e=edges.get(id);if(e)e.count++;else edges.set(id,{a,b,count:1});
  }
  const boundary=[...edges.values()].filter(e=>{
    if(e.count!==1)return false;const dx=e.b[0]-e.a[0],dz=e.b[2]-e.a[2],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
    return [.2,.5,.8].every(t=>{const x=e.a[0]+dx*t,z=e.a[2]+dz*t;return Number.isFinite(q.shoreContact(x-nx*1e-6,z-nz*1e-6))&&q.shoreContact(x+nx*5e-5,z+nz*5e-5)===-Infinity;});
  });
  assert(boundary.length>0);let samples=0,faded=0,raised=0,eligible=0,maxSeparation=-Infinity;
  for(let f=0;f<I.length;f+=3){
    const ids=Array.from(I.subarray(f,f+3)),v=ids.map(point),e=a.hemEligible[ids[0]];
    assert([0,1].includes(e));assert(ids.every(i=>a.hemEligible[i]===e));
    const [ix,iz,half]=source.owners.subarray(f,f+3);
    for(const [x,y,z]of v){const u=(x-OX)/S-ix,w=(z-OZ)/S-iz;assert(u>=-2e-13&&u<=1+2e-13&&w>=-2e-13&&w<=1+2e-13&&(half?u+w>=1-2e-13:u+w<=1+2e-13));if(e)assert(y-ground(x,z)<=P.maximumFadeLiftM);}
    // One SAME true boundary segment must explain all three distance bounds.
    // Convexity then guarantees the interpolated distance bounds every point
    // of the affine face, including points not in the sample lattice below.
    const segment=e?boundary.find(b=>ids.every((id,k)=>{const d=distance(v[k][0],v[k][2],b.a,b.b),bound=a.outerDistance[id];return bound>=d-1e-10&&bound-d<.000025;})):null;
    if(e){eligible++;assert(segment,'eligible face must reference a physical exterior segment');}
    for(let j=0;j<=8;j++)for(let k=0;k<=8-j;k++){
      const w=[j/8,k/8,1-(j+k)/8],xyz=[0,1,2].map(c=>v.reduce((sum,p,n)=>sum+p[c]*w[n],0)),[x,y,z]=xyz;
      const lift=y-ground(x,z),attr=ids.reduce((sum,id,n)=>sum+a.canonicalLift[id]*w[n],0),d=ids.reduce((sum,id,n)=>sum+a.outerDistance[id]*w[n],0),alpha=coverage(attr,d,e);
      assert(Math.abs(q.design.heightAt(x,z)-ground(x,z))<3e-11);assert(lift-attr<3e-11);assert(Number.isFinite(alpha)&&alpha>=0&&alpha<=1);
      if(lift>.020){assert.equal(alpha,1);raised++;}
      if(alpha<1){faded++;const separation=lift-P.rockSkinLiftM;maxSeparation=Math.max(maxSeparation,separation);assert(lift<=P.maximumFadeLiftM+3e-11);assert(separation<.008);assert(distance(x,z,segment.a,segment.b)<=P.outerWidthM+3e-11);assert(distance(x,z,segment.a,segment.b)<=d+3e-11);}
      samples++;
    }
  }
  assert.equal(eligible,a.stats.eligibleFaces);assert(faded>0&&raised>0);assert(a.stats.holeAndPackingCrackEdgesExcluded>0&&a.stats.nearPackingOrTJunctionEdgesExcluded>0);assert.equal(a.stats.nonmanifoldEdges,0);assert.equal(a.stats.openOrAmbiguousEdges,0);
  const again=createHollowpeakShoreOpticalAttributes(source);for(const field of['canonicalLift','outerDistance','hemEligible'])assert.equal(hash(again[field]),hash(a[field]));
  for(const[k,input]of Object.entries(source))assert.equal(hash(input),originalHashes[k],k+' input bytes unchanged');
  t.diagnostic(JSON.stringify({faces:I.length/3,barycentricSamples:samples,eligibleFaces:eligible,fadedSamples:faded,opaqueRaisedSamples:raised,maxFadedSkinSeparationM:maxSeparation}));
});

test('wrong actual source owners remain opaque and malformed topology fails closed',()=>{
  const a=createHollowpeakShoreOpticalAttributes(source),f=Array.from({length:I.length/3},(_,f)=>f).find(f=>a.hemEligible[I[f*3]]===1);assert(Number.isInteger(f));
  for(const invalidHalf of[false,true]){
    const owners=source.owners.slice();if(invalidHalf)owners[f*3+2]=2;else owners[f*3]=(owners[f*3]+1)%512;
    const rejected=createHollowpeakShoreOpticalAttributes({...source,owners});
    for(const id of I.subarray(f*3,f*3+3)){assert.equal(rejected.hemEligible[id],0);assert.equal(coverage(rejected.canonicalLift[id],0,rejected.hemEligible[id]),1);}
    assert(rejected.stats.invalidOwnerFacesOpaque>a.stats.invalidOwnerFacesOpaque);
  }
  const duplicate=I.slice();duplicate[1]=duplicate[0];const reversed=I.slice();[reversed[0],reversed[1]]=[reversed[1],reversed[0]];const nonfinite=p.slice();nonfinite[0]=NaN;
  for(const bad of[{...source,index:duplicate},{...source,index:reversed},{...source,position:nonfinite},{...source,owners:source.owners.subarray(1)},{...source,heights:heights.subarray(1)}])assert.throws(()=>createHollowpeakShoreOpticalAttributes(bad));
  for(const[k,input]of Object.entries(source))assert.equal(hash(input),originalHashes[k]);
});

test('resident PBR clone preserves maps, normals, UVs and source state; actual alpha coverage precedes discard',()=>{
  const {base,geometry}=fixture,attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([k,a])=>[k,{array:a.array,hash:hash(a.array)}])),baseState={color:base.color.toArray(),vertexColors:base.vertexColors,transparent:base.transparent,alphaTest:base.alphaTest,depthWrite:base.depthWrite,normalScale:base.normalScale.toArray()};
  const clone=base.clone(),originalShader=base.onBeforeCompile,key=base.customProgramCacheKey,uniform={value:7},s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{resident:uniform}};
  const previous=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('Selected material response cannot consume world randomness');};
  try{configureHollowpeakShoreResponse(clone);base.onBeforeCompile(s);patchHollowpeakShoreResponse(s);}finally{Math.random=previous;}
  assert.equal(draws,0);for(const channel of['map','normalMap','roughnessMap','aoMap'])assert.equal(clone[channel],base[channel]);
  for(const field of['roughness','metalness','envMapIntensity','side'])assert.equal(clone[field],base[field]);assert.deepEqual(clone.normalScale.toArray(),base.normalScale.toArray());
  assert.deepEqual({color:base.color.toArray(),vertexColors:base.vertexColors,transparent:base.transparent,alphaTest:base.alphaTest,depthWrite:base.depthWrite,normalScale:base.normalScale.toArray()},baseState);assert.equal(base.onBeforeCompile,originalShader);assert.equal(base.customProgramCacheKey,key);
  for(const[k,before]of Object.entries(attributes)){assert.equal(geometry.attributes[k].array,before.array);assert.equal(hash(before.array),before.hash);}
  const wet=createHollowpeakShoreWetness(p,D);assert.equal(wet.length,p.length/3);assert(wet.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.equal(hash(p),originalHashes.position);
  assert.equal(clone.color.getHex(),0xffffff);assert.equal(clone.vertexColors,false);assert.equal(clone.transparent,true);assert.equal(clone.depthTest,true);assert.equal(clone.depthWrite,true);assert.equal(clone.alphaTest,P.alphaTest);assert.equal(s.uniforms.resident,uniform);assert.deepEqual(Object.keys(s.uniforms),['resident']);
  assert.equal(s.fragmentShader.split('#include <normal_fragment_maps>').length,2);assert.equal(s.fragmentShader.split('#include <alphatest_fragment>').length,2);
  const expanded=s.fragmentShader.replace('#include <alphatest_fragment>',T.ShaderChunk.alphatest_fragment);assert(expanded.indexOf('diffuseColor.a*=shoreCoverage;')<expanded.indexOf('discard;'));assert(!s.vertexShader.includes('position+=')&&!s.vertexShader.includes('transformed+='));
  assert.equal(coverage(.020,0,1),1);assert.equal(coverage(P.minimumLiftM,0,0),1);assert.equal(coverage(P.minimumLiftM,0,1),0);
  assert.throws(()=>configureHollowpeakShoreResponse({}));assert.throws(()=>patchHollowpeakShoreResponse({vertexShader:'',fragmentShader:'',uniforms:{}}));
  fixture.state.dispose();
});
