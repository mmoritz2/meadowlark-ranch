import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const own=process.env.FLOW_SOURCE_ROOT?pathToFileURL(process.env.FLOW_SOURCE_ROOT+'/'):new URL('../',import.meta.url);
const dep=process.env.FLOW_DEPENDENCY_ROOT?pathToFileURL(process.env.FLOW_DEPENDENCY_ROOT+'/'):own;
const {createWaterfallArt}=await import(new URL('assets/waterfall-art.js',own));
const {HOLLOWPEAK_CATARACT_PROFILE,hollowpeakCataractPoint}=await import(new URL('assets/hollowpeak-cataract.mjs',own));
const T=await import(new URL('assets/vendor/three/build/three.module.js',dep));
const cascade=await import(new URL('assets/cascade-flow.mjs',dep));
const {createWaterfallEffects}=await import(new URL('assets/waterfall-effects.js',dep));
const {exactSweptClearance}=await import(new URL('tools/terrain-water-contact.mjs',dep));
const fixture=new URL('tools/fixtures/hollowpeak-cataract-0ba4900/',own);
const edits=JSON.parse(fs.readFileSync(new URL('source-edits.json',fixture)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(new URL('assets/waterfall-art.js',own),'utf8');
let parent=source;
for(const e of [...edits.changes['assets/waterfall-art.js'].edits].reverse()){
 assert.equal(parent.split(e.after).length-1,e.occurrences);parent=parent.replace(e.after,e.before);
}
assert.equal(sha(parent),edits.changes['assets/waterfall-art.js'].beforeSHA256);
const args=['createWaterfallEffects','CASCADE_FLOW_PROFILE','CASCADE_VEIL_WEIGHTS','cascadeRim','cascadeSpread','sampleCascadeVeil','cascadeFlowRate','cascadeMotionAmplitude'];
const baselineArt=new Function(...args,parent.replace(/^import .*;\n/gm,'').replace('export function createWaterfallArt','function createWaterfallArt')+'\nreturn createWaterfallArt;')(...args.map(k=>k==='createWaterfallEffects'?createWaterfallEffects:cascade[k]));
const flow={x:-150,z:-242.2,top:14.2,bottom:-.06,width:2.45,run:7.8,name:'Hollowpeak Falls'};
const proof={profile:HOLLOWPEAK_CATARACT_PROFILE,sourceSHA256:sha(source),parentSHA256:sha(parent)};
function buffers(g){return Object.fromEntries([...Object.entries(g.attributes),['index',g.index]].map(([k,a])=>[k,Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)]));}
function construct(factory,options){const save=Math.random;let state=92771,calls=0;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const art=factory({THREE:T}),fall=art.fall(options);const suffix=Array.from({length:8},()=>Math.random());return{art,fall,mesh:fall.children[0],calls,suffix};}finally{Math.random=save;}}
const before=construct(baselineArt,flow),plain=construct(createWaterfallArt,flow),selected=construct(createWaterfallArt,{...flow,flowProfile:HOLLOWPEAK_CATARACT_PROFILE});
test('unselected factory preserves exact historical source, all default geometry, metadata, shaders and RNG',()=>{
 assert.deepEqual(buffers(plain.mesh.geometry),buffers(before.mesh.geometry));assert.deepEqual(plain.fall.userData,before.fall.userData);
 assert.equal(plain.calls,before.calls);assert.deepEqual(plain.suffix,before.suffix);assert.equal(selected.calls,before.calls);assert.deepEqual(selected.suffix,before.suffix);
 for(const art of[plain.art,selected.art]){const a={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader},b={uniforms:{},vertexShader:a.vertexShader,fragmentShader:a.fragmentShader};art.material.onBeforeCompile(a);before.art.material.onBeforeCompile(b);assert.equal(a.vertexShader,b.vertexShader);assert.equal(a.fragmentShader,b.fragmentShader);assert.equal(art.material.customProgramCacheKey(),before.art.material.customProgramCacheKey());}
 proof.constructorRNGCalls=before.calls-8;
});
test('explicit Hollowpeak profile creates physical depth with original resources, footprint, endpoints and attributes',()=>{
 const a=before.mesh.geometry,b=selected.mesh.geometry,ap=a.attributes.position,bp=b.attributes.position;
 assert.equal(bp.count,2925);assert.equal(b.index.count/3,4608);assert.equal(selected.fall.children.length,1);assert.equal(selected.fall.userData.waterfallArt.profile,HOLLOWPEAK_CATARACT_PROFILE);
 for(const k of Object.keys(a.attributes))if(!['position','normal'].includes(k))assert.deepEqual(buffers(b)[k],buffers(a)[k]);assert.deepEqual(buffers(a).index,buffers(b).index);
 let changed=0,max=0;for(let i=0;i<bp.count;i++){assert.equal(bp.getX(i),ap.getX(i));assert.equal(bp.getY(i),ap.getY(i));const delta=bp.getZ(i)-ap.getZ(i);assert(delta>=-1e-5&&delta<=.58+1e-5);if(delta>1e-5)changed++;max=Math.max(max,delta);assert(bp.getZ(i)>=flow.z-1e-5&&bp.getZ(i)<=flow.z+flow.run+1e-5);if(a.attributes.uv.getY(i)===0||a.attributes.uv.getY(i)===1)assert.equal(delta,0);const n=b.attributes.normal;assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);}
 assert(changed>2700&&max>.5);assert.equal(b.index.array.byteLength,a.index.array.byteLength);assert.equal(selected.fall.userData.waterfallArt.geometryGPUBytes,before.fall.userData.waterfallArt.geometryGPUBytes);proof.depth={changed,maxM:max,vertices:bp.count,triangles:b.index.count/3};
});
test('whole-width depth keeps all truly joined veil boundaries continuous and roots and feet anchored',()=>{
 let joins=0;for(let boundary=1;boundary<9;boundary++)for(let j=0;j<=512;j++){const s=j/512;if(cascade.cascadeBoundaryGap(boundary,s)!==0)continue;const a=hollowpeakCataractPoint(flow,s,cascade.sampleCascadeVeil(flow,boundary-1,s,1)),b=hollowpeakCataractPoint(flow,s,cascade.sampleCascadeVeil(flow,boundary,s,0));assert(Math.hypot(...a.map((v,k)=>v-b[k]))<1e-10);joins++;}assert.equal(joins,2960);for(const s of[0,1]){const p=cascade.sampleCascadeVeil(flow,3,s,.4);assert.equal(hollowpeakCataractPoint(flow,s,p),p);}proof.joinedSamples=joins;
});
test('complete 4608 physical faces and all shader motion phases clear captured canonical terrain triangles',()=>{
 const meta=JSON.parse(fs.readFileSync(new URL('tools/fixtures/hollowpeak-shore-bc2866a/terrain-tile.json',dep))),bytes=fs.readFileSync(new URL('tools/fixtures/hollowpeak-shore-bc2866a/terrain-tile.f32',dep));assert.equal(sha(bytes),meta.tileSHA256);const grid=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
 function height(x,z){let gx=(x-meta.worldOrigin[0])/meta.step,gz=(z-meta.worldOrigin[1])/meta.step;assert(gx>=-1e-8&&gz>=-1e-8&&gx<meta.width-1+1e-8&&gz<meta.height-1+1e-8);gx=Math.max(0,Math.min(meta.width-1-1e-9,gx));gz=Math.max(0,Math.min(meta.height-1-1e-9,gz));const ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,k=iz*meta.width+ix,a=grid[k],b=grid[k+meta.width],c=grid[k+meta.width+1],d=grid[k+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
 const g=selected.mesh.geometry;proof.clearance=exactSweptClearance({position:g.attributes.position.array,index:g.index.array,motion:g.attributes.cascadeMotion.array,step:meta.step,height});assert.equal(proof.clearance.triangles,4608);assert(proof.clearance.min>.02,JSON.stringify(proof.clearance));assert.equal(proof.clearance.emptyFacets,0);proof.terrainTileSHA256=sha(bytes);
});
test('clock-only animation keeps physical buffers stable and unknown profiles cannot silently change other falls',()=>{
 const a=buffers(selected.mesh.geometry),save=Math.random;Math.random=()=>{throw Error('Unexpected frame RNG');};try{for(let i=0;i<300;i++)selected.art.update(i/60);}finally{Math.random=save;}assert.deepEqual(buffers(selected.mesh.geometry),a);assert.equal(selected.art.time.value,299/60);assert.throws(()=>selected.art.fall({...flow,flowProfile:'unknown'}),/Unknown waterfall flow profile/);
 const html=fs.readFileSync(new URL('ranch3d.html',dep),'utf8'),flag=edits.changes['ranch3d.html'].edits[0];assert.equal(html.split(flag.before).length+html.split(flag.after).length-2,1);proof.frameBuffersExact=true;
});
test('bound CPU proof is available without claiming native appearance or whole-world completion',()=>{if(process.env.FLOW_PROOF_OUTPUT)fs.writeFileSync(process.env.FLOW_PROOF_OUTPUT,JSON.stringify(proof,null,2)+'\n');});
