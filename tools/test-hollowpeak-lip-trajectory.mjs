import test,{after}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';
import{auditSweptSurfaceOverlap}from'./water-surface-overlap.mjs';
import{createLipTrajectoryProof,validateLipTrajectoryProof,recoverOwner,bytes,sha,geometryOwner,materialState}from'./lip-trajectory-physical-proof.mjs';
const p=await createLipTrajectoryProof(),{meta,stats:s}=p,K=p.BC.HOLLOWPEAK_CATARACT_TRAJECTORY_K;
after(()=>{if(process.env.LIP_TRAJECTORY_PROOF_OUT){assert(!fs.existsSync(process.env.LIP_TRAJECTORY_PROOF_OUT),'Do not replace a frozen proof');fs.writeFileSync(process.env.LIP_TRAJECTORY_PROOF_OUT,JSON.stringify(s,null,2)+'\n');}p.dispose();});
const attrs=g=>Object.fromEntries([...Object.entries(g.attributes),['index',g.index]].map(([k,a])=>[k,{itemSize:a.itemSize,count:a.count,type:a.array.constructor.name,normalized:a.normalized,data:bytes(a.array)}]));

test('four exact current-cohort source inverses preserve the accepted factory/helper/cataract/entry and every physical source',()=>{
 for(const k of['factory','helper','cataract'])assert.equal(recoverOwner(meta,k,p.sources[k]),p.oldSources[k]);
 const html=fs.readFileSync(process.env.LIP_TRAJECTORY_HTML_SOURCE||path.join(p.runtime,'ranch3d.html'),'utf8');assert.equal(sha(recoverOwner(meta,'html',html)),meta.preimages.html);
 assert.throws(()=>recoverOwner(meta,'cataract',p.sources.cataract.replace('TRAJECTORY_K=.35','TRAJECTORY_K=.36')),/exact|Complete/);
 assert.throws(()=>recoverOwner(meta,'helper',p.sources.helper+'\n// unreviewed extra\n'),/Complete/);
 assert.equal(p.BC.HOLLOWPEAK_CATARACT_PROFILE,'hollowpeak-cataract-2');assert.equal(p.BH.HOLLOWPEAK_FALLING_WATER_PROFILE,'hollowpeak-falling-water-trajectory-1');assert.equal(K,.35);
 for(const[f,h]of Object.entries(meta.physicalOwnersSHA256))assert.equal(sha(fs.readFileSync(path.join(p.runtime,'assets',f))),h,f+' remains exact');
 assert(!p.sources.helper.includes('if(!gl_FrontFacing) diffuseColor.a*='),'Rejected V11 alpha patch is absent');
});

test('the compact native fixture reconstructs the entire accepted59 field and independently replays all current raw heights',(t)=>{
 assert.equal(meta.nativeFinalNodes.length,15);assert.equal(p.field.length,263169);assert.equal(sha(bytes(p.field)),meta.canonicalSHA256);assert.equal(sha(bytes(p.rawGrid)),meta.rawCanonicalSHA256);assert.deepEqual(p.rawGrid,p.expectedRaw);assert.equal(s.lateRemotePatchNodes,372);assert.equal(s.terrainRandomCalls,0);assert.equal(s.moduleRandomCalls,0);
 t.diagnostic(JSON.stringify({native:s.canonicalSHA256,raw:s.rawCanonicalSHA256,fixtureBytes:fs.statSync(new URL('baseline.json',p.fixture)).size,oldNativeReused:true}));
});

test('the before fall is byte-bound to the actual uploaded V10 owner, with unchanged resource layout and exact finite endpoints',()=>{
 assert.deepEqual(p.oldOwner,meta.nativeSelectedFall);assert.deepEqual(p.old.value.selected.userData.waterfallArt,meta.nativeSelectedGeometryProfile);assert.deepEqual(materialState(p.oldMesh.material),meta.nativeSelectedMaterial);
 const a=p.oldMesh.geometry,b=p.mesh.geometry;assert.equal(b.attributes.position.count,2925);assert.equal(b.index.count/3,4608);assert.deepEqual(b.index.array,a.index.array);assert.deepEqual(Object.keys(b.attributes),Object.keys(a.attributes));
 for(const[k,v]of Object.entries(a.attributes)){assert.equal(b.attributes[k].itemSize,v.itemSize);assert.equal(b.attributes[k].count,v.count);assert.equal(b.attributes[k].normalized,v.normalized);assert.equal(b.attributes[k].array.constructor,v.array.constructor);}
 for(let veil=0;veil<9;veil++)for(const row of[0,64])for(let col=0;col<5;col++){const i=veil*325+row*5+col;for(const axis of['X','Y','Z'])assert.equal(b.attributes.position['get'+axis](i),a.attributes.position['get'+axis](i));assert.equal(b.attributes.uv.getY(i),a.attributes.uv.getY(i));}
 assert.equal(p.expectedNative.selectedFall.key,meta.nativeSelectedFall.key);assert.deepEqual(p.expectedNative.selectedFall.matrix,meta.nativeSelectedFall.matrix);assert.deepEqual(p.expectedNative.selectedFall.drawRange,meta.nativeSelectedFall.drawRange);
});

test('every selected vertex couples its real Y drop and UVq to the same coefficient while XZ, joins and full motion amplitudes remain exact',async()=>{
 const a=p.oldMesh.geometry,b=p.mesh.geometry,h=p.flow.top-p.flow.bottom;let changed=0;
 for(let i=0;i<b.attributes.position.count;i++){const row=Math.floor(i/5)%65,t=row/64,q=t*t+K*t*(1-t),old=a.attributes.position.getY(i),y=b.attributes.position.getY(i);assert.equal(b.attributes.position.getX(i),a.attributes.position.getX(i));assert.equal(b.attributes.position.getZ(i),a.attributes.position.getZ(i));assert(Math.abs(y-(old-h*K*t*(1-t)))<1.5e-6);assert(Math.abs(b.attributes.uv.getY(i)-q)<3e-8);assert(Math.abs(((p.flow.top-y)/h-b.attributes.uv.getY(i))-((p.flow.top-old)/h-t*t))<2e-7,'Principal UVq preserves the inherited microfold Y residual, within two packed-coordinate roundings');if(y!==old)changed++;for(const name of['cascadeAcross','cascadePhase','cascadeMotion'])assert.equal(b.attributes[name].getX(i),a.attributes[name].getX(i));const n=b.attributes.normal;assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<2e-6);}
 assert.equal(changed,9*63*5);assert(s.selectedGeometry.maximumCenterlineLoweringM>1&&s.selectedGeometry.maximumCenterlineLoweringM<1.3);
 const cascade=await import(new URL('assets/cascade-flow.mjs',new URL('file://'+p.runtime+'/')));let joins=0;for(let v=1;v<9;v++)for(let row=0;row<=64;row++){if(cascade.cascadeBoundaryGap(v,row/64)!==0)continue;const left=(v-1)*325+row*5+4,right=v*325+row*5;for(const axis of['X','Y','Z'])assert.equal(b.attributes.position['get'+axis](left),b.attributes.position['get'+axis](right));assert.equal(b.attributes.uv.getY(left),b.attributes.uv.getY(right));assert.equal(b.attributes.cascadeAcross.getX(left),b.attributes.cascadeAcross.getX(right));joins++;}assert(joins>300);
});

function emittedElapsed(){
 const fragment=p.selectedShader.fragmentShader,start=fragment.indexOf('   float trajectoryK='),end=fragment.indexOf('   float currentBend=',start);assert(start>=0&&end>start);let body=fragment.slice(start,end).replace(/\bfloat\s+/g,'let ').replace(/fuv\.y/g,'q').replace(/waterfallTime/g,'time').replace(/cascadeTravelSpeed/g,'rate');return new Function('q','time','rate','sqrt','max',body+'\nreturn {elapsed:fallElapsed,travel:fallTravel};');
}
test('actual emitted inverseq tracks the real drop continuously and the actual selected rate retains gravity with finite outflow speed',()=>{
 const fn=emittedElapsed(),rate=p.next.value.selected.userData.waterfallArt.rate,oldRate=p.old.value.selected.userData.waterfallArt.rate,h=p.flow.top-p.flow.bottom;
 assert(Math.abs(rate-oldRate/Math.sqrt(1-K))<1e-15);assert.equal(p.selectedShader.fragmentShader.match(/float trajectoryK=([0-9.]+);/)[1],K.toFixed(8));
 for(let row=0;row<=64;row++){const t=row/64,q=p.mesh.geometry.attributes.uv.getY(row*5),r=fn(q,0,rate,Math.sqrt,Math.max);assert(Number.isFinite(r.elapsed)&&Math.abs(r.elapsed-t)<1e-7);}
 let tracks=0;for(const t0 of[0,.03,.17,.41])for(const dt of[.001,.03,.12]){const t1=t0+rate*dt;if(t1>=1)continue;const q=t=>t*t+K*t*(1-t),a=fn(q(t0),0,rate,Math.sqrt,Math.max),b=fn(q(t1),dt,rate,Math.sqrt,Math.max);assert(Math.abs(a.travel-b.travel)<1e-14);const e=.0001,drop=t=>h*q(t0+rate*t),acc=(drop(dt+e)-2*drop(dt)+drop(dt-e))/(e*e);assert(Math.abs(acc-9.8)<1e-6);tracks++;}
 const initialSpeed=h*K*rate;assert(initialSpeed>3&&initialSpeed<4);assert(Math.abs(2*(1-K)*h*rate*rate-9.8)<1e-12);assert(Math.abs(2*(1-K)*h*oldRate*oldRate-9.8)>3,'Unretuned old speed is a meaningful gravity negative control');assert(Math.abs(Math.sqrt(.25+K*.25)-.5)>.05,'Old sqrt(q) is not the new elapsed coordinate');assert(tracks>8);
});

test('the complete new conservative swept hull and every original50904XY constraint clear the fixed terrain without missing coverage',(t)=>{
 for(const k of['min','worst','triangles','facets','emptyFacets','clippedVertices'])assert.deepEqual(s.beforeSweep[k],meta.baselineSweep[k]);assert.equal(s.afterSweep.triangles,4608);assert.equal(s.afterSweep.emptyFacets,0);assert(s.afterSweep.min>=.075);assert.equal(s.originalConstraintReplay.count,50904);assert.equal(s.originalConstraintReplay.unmapped,0);assert(s.originalConstraintReplay.min>=.075);assert(Math.abs(s.originalConstraintReplay.min-s.afterSweep.min)<1e-10);
 t.diagnostic(JSON.stringify({oldConstraints:s.beforeSweep.clippedVertices,newConstraints:s.afterSweep.clippedVertices,originalConstraintsReevaluated:s.originalConstraintReplay.count,newMinimum:s.afterSweep.min}));
});

test('fall-only clearance rejects an excessive trajectory drop; endpoint/source and unchanged terrain remain independent contracts',async()=>{
 const{exactSweptClearance}=await import(new URL('tools/terrain-water-contact.mjs',new URL('file://'+p.runtime+'/'))),g=p.mesh.geometry,position=g.attributes.position.array.slice();for(let i=1;i<position.length;i+=3)position[i]-=.2;const bad=exactSweptClearance({position,index:g.index.array,motion:g.attributes.cascadeMotion.array,step:meta.step,height:p.height});assert(bad.min<.075);assert(s.afterSweep.min>=.075);assert.equal(sha(bytes(p.field)),meta.canonicalSHA256);
});

test('every unselected factory path, photo/fallback material and full vertex shader remains exact; selected fragment changes only inverse advection',()=>{
 for(const[a,b]of[[p.old,p.next],[p.oldFallback,p.nextFallback]]){for(const key of['unselected','ribbon']){assert.deepEqual(attrs(a.value[key].children[0].geometry),attrs(b.value[key].children[0].geometry));assert.deepEqual(a.value[key].userData,b.value[key].userData);assert.equal(b.value[key].children[0].material,b.value.art.material);}assert.deepEqual(materialState(a.value.art.material),materialState(b.value.art.material));const baseA=p.compile(a.value.art.material),baseB=p.compile(b.value.art.material);assert.equal(baseA.vertexShader,baseB.vertexShader);assert.equal(baseA.fragmentShader,baseB.fragmentShader);const selectedA=p.compile(a.value.selected.children[0].material),selectedB=p.compile(b.value.selected.children[0].material);assert.equal(selectedA.vertexShader,selectedB.vertexShader);assert.deepEqual(Object.keys(selectedA.uniforms).sort(),Object.keys(selectedB.uniforms).sort());assert.equal(selectedB.uniforms.waterfallTime,b.value.art.time);assert.equal(selectedB.uniforms.waterfallFlowMap?.value,selectedA.uniforms.waterfallFlowMap?.value);assert.equal(b.value.selected.children[0].material,b.value.selectedAgain.children[0].material);assert.equal(b.value.materialCount,2);}
 const before=meta.edges.helper.find(e=>e.before.includes('sqrt(max(fuv.y')).before,after=meta.edges.helper.find(e=>e.before.includes('sqrt(max(fuv.y')).after.replace('${HOLLOWPEAK_CATARACT_TRAJECTORY_K.toFixed(8)}',K.toFixed(8));assert.equal(p.selectedShader.fragmentShader.split(after).length,2);assert.equal(p.selectedShader.fragmentShader.replace(after,before),p.oldShader.fragmentShader,'Entire selected RGB/alpha/normal/roughness field exact after the sole emitted inverse-q edge');
 for(const key of['pool','impact','effects','update'])assert.equal(p.next.value.art[key].toString(),p.old.value.art[key].toString());
});

test('constructor ambient RNG/resources, subsequent particles and frame updates preserve ownership without new buffers, textures or clocks',()=>{
 for(const[a,b]of[[p.old,p.next],[p.oldFallback,p.nextFallback]]){assert.equal(a.draws,b.draws);assert.deepEqual(a.future,b.future);assert.equal(a.value.materialCount,b.value.materialCount);assert.deepEqual(a.value.effects.stats,b.value.effects.stats);assert.equal(a.value.effects.meshes.length,b.value.effects.meshes.length);for(let i=0;i<a.value.effects.meshes.length;i++)assert.deepEqual(attrs(a.value.effects.meshes[i].geometry),attrs(b.value.effects.meshes[i].geometry));assert.deepEqual(attrs(a.value.impact.geometry),attrs(b.value.impact.geometry));}
 const before=attrs(p.mesh.geometry),previous=Math.random;Math.random=()=>{throw Error('Frame RNG drift');};try{for(const t of[0,.1,1.5,5.5,9.5,600])p.next.value.art.update(t);}finally{Math.random=previous;}assert.deepEqual(attrs(p.mesh.geometry),before);assert.equal(p.compile(p.mesh.material).uniforms.waterfallTime,p.next.value.art.time);assert.equal(p.next.value.art.time.value,600);
});

test('the final native bridge is the actual constructed selected owner and this cohort passes every bounded physical contract',()=>{
 validateLipTrajectoryProof(p);assert(s.pass);assert.deepEqual(p.expectedNative.selectedFall,geometryOwner(p.mesh,meta.nativeSelectedFall.key));assert.deepEqual(p.expectedNative.selectedGeometryProfile,p.next.value.selected.userData.waterfallArt);assert.equal(p.expectedNative.canonicalSHA256,meta.canonicalSHA256);assert.equal(p.expectedNative.selectedMaterial.forceSinglePass,true);assert.equal(p.expectedNative.selectedMaterial.side,2);assert.equal(p.expectedNative.selectedFall.attributes.cascadeMotion.sha256,meta.nativeSelectedFall.attributes.cascadeMotion.sha256);assert.equal(p.expectedNative.selectedFall.index.sha256,meta.nativeSelectedFall.index.sha256);
});


test('the entire moving fall clears actual installed shoal faces and preserves its existing reflecting-plane landing',async(t)=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('installed-shore-surfaces.json',p.fixture),'utf8')),url=f=>new URL('assets/'+f,new URL('file://'+p.runtime+'/'));
 assert(fixture.registered);assert.equal(sha(fs.readFileSync(url('hollowpeak-shore.mjs'))),fixture.sourceOwnerSHA256);assert.equal(sha(fs.readFileSync(url('terrain-realism.js'))),fixture.reflectingMaterialOwnerSHA256);
 const{buildHollowpeakShoreData}=await import(url('hollowpeak-shore.mjs')),data=buildHollowpeakShoreData(p.height),results={};
 for(const[key,f]of[['bank',fixture.meshes[0]],['water',fixture.meshes[1]]]){
  const a=data[key];assert(f.visible);assert.deepEqual(f.matrix,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);assert.deepEqual(f.drawRange,{start:0,count:null});assert.equal(a.position.constructor.name,f.position.type);assert.equal(a.position.length/3,f.position.count);assert.equal(sha(bytes(a.position)),f.position.sha256);assert.equal(a.index.constructor.name,f.index.type);assert.equal(a.index.length,f.index.count);assert.equal(sha(bytes(a.index)),f.index.sha256);
  const run=g=>auditSweptSurfaceOverlap({position:g.attributes.position.array,index:g.index.array,motion:g.attributes.cascadeMotion.array,staticPosition:a.position,staticIndex:a.index});
  const before=run(p.oldMesh.geometry),after=run(p.mesh.geometry);assert.equal(after.staticTriangles,a.index.length/3);assert.equal(after.degenerateStaticTriangles,0);assert.equal(after.emptyMovingTriangles,0);assert(after.overlappingStaticTriangles>0);assert(after.clippedVertices>after.overlappingMovingTriangles);assert.deepEqual(after.staticFaceIndices,before.staticFaceIndices,'Same complete XZ swept envelope intersects the same fixed triangle owners');
  if(key==='bank'){assert(after.min>=fixture.policy.solidShoalMinimumM);assert(after.min>8,'Full actual shoal overlap is high on the fall, not at its low foot');}else{assert.equal(after.min,before.min);assert(after.min>0);assert(Math.abs(after.min-(p.flow.bottom-fixture.reflectingLevel))<1e-8);assert(a.position.every((v,i)=>i%3!==1||Math.abs(v-fixture.reflectingLevel)<2e-9));}
  results[key]={before,after};
 }
 // This actual reflecting material's animation changes colour/normal only. Its
 // complete emitted vertex difference only exports world/UV varyings.
 const{createRiverMaterial}=await import(url('terrain-realism.js')),m=createRiverMaterial({THREE:p.T,map:null});try{const sh={uniforms:{},vertexShader:p.T.ShaderLib.physical.vertexShader,fragmentShader:p.T.ShaderLib.physical.fragmentShader};m.userData.plainShader(sh);assert.equal(sh.vertexShader,'varying vec3 waterWorld; varying vec2 waterBankUV;\n'+p.T.ShaderLib.physical.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n      waterWorld=(modelMatrix*vec4(position,1.0)).xyz;waterBankUV=uv;'));}finally{m.dispose();}
 s.fixedSurfaceSweep={fixtureSHA256:sha(fs.readFileSync(new URL('installed-shore-surfaces.json',p.fixture))),surfaces:results,pass:true};
 t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{staticTriangles:v.after.staticTriangles,overlapTriangles:v.after.overlappingStaticTriangles,oldMinimum:v.before.min,newMinimum:v.after.min}]))));
});

test('triangle-overlap proof detects interior collisions and lateral-only sweep contact without relying on moving-vertex samples',()=>{
 const position=new Float32Array([0,1,0,2,1,0,0,1,2]),index=new Uint16Array([0,1,2]),staticIndex=new Uint16Array([0,1,2]),staticPosition=new Float64Array([.5,0,.5,1.25,1.2,.5,.5,0,1.25]);
 const inside=auditSweptSurfaceOverlap({position,index,motion:new Float32Array(3),staticPosition,staticIndex});assert(Math.abs(inside.min+.2)<1e-12);assert.deepEqual(inside.worst,{x:1.25,y:1,z:.5,surfaceY:1.2,movingFace:0,staticFace:0});assert.equal(inside.overlappingStaticTriangles,1);assert(inside.clippedVertices>=3);
 // None of these fixed-face points is under the original moving triangle;
 // only the shader's conservative horizontal envelope reaches it.
 const lateral=new Float64Array([-.4,1.3,.2,-.2,1.3,.2,-.4,1.3,.4]),args={position,index,staticPosition:lateral,staticIndex};const still=auditSweptSurfaceOverlap(args),moving=auditSweptSurfaceOverlap({...args,motion:new Float32Array([.5,.5,.5])});assert.equal(still.min,null);assert.equal(still.overlapPolygons,0);assert(Math.abs(moving.min+.3)<1e-12);assert.equal(moving.overlappingMovingTriangles,1);
 assert.throws(()=>auditSweptSurfaceOverlap({...args,motion:new Float32Array([NaN,0,0])}),/Finite nonnegative/);assert.throws(()=>auditSweptSurfaceOverlap({...args,index:new Uint16Array([0,1])}),/Complete indexed/);
});
