import {normalizeCoyoteMacroSource} from './coyote-macroform-source-guard.mjs';
import {normalizeGrassRibbonSource} from './grass-ribbon-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {normalizeLupinSource} from './lupin-source-guard.mjs';
import {repo,T,moduleAt,sha,sourceSlice,withoutRandom,createNearReplay,cellsDigest,transformedVerticalBounds} from './pastoral-production-fixture.mjs';
const fixture=new URL('./fixtures/lupin-e8b5cf4/',import.meta.url),read=n=>fs.readFileSync(new URL(n,fixture),'utf8');
const contract=JSON.parse(read('source.json')),native=JSON.parse(read('native-prototype.json')),views=JSON.parse(read('native-rows.json'));
const original=await import(new URL('../lupin-original-e8b5cf4.mjs',fixture)),current=await moduleAt('assets/meadow-flowers.mjs');
const source=fs.readFileSync(path.join(repo,'ranch3d.html'),'utf8'),course=fs.readFileSync(path.join(repo,'assets/features/course-clear.js'),'utf8');
const old=original.createMeadowLupinGeometry(T),next=current.createMeadowLupinGeometry(T);
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const rows=v=>{const b=fs.readFileSync(new URL(v.file,fixture));assert.equal(sha(b),v.sha256);return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};
const nearBlock=s=>{s=normalizeGrassRibbonSource(s,'ranch3d.html');return sourceSlice(s,' const gh=',' const crossGeo=')+sourceSlice(s,' const okGrass=',' let swardAccentColliders=');};
const meshPacket=m=>({count:m.count,matrix:sha(bytes(m.instanceMatrix.array)),color:sha(bytes(m.instanceColor.array)),matrixVersion:m.instanceMatrix.version,colorVersion:m.instanceColor.version});
function replayPacket(r){return{meshes:Object.fromEntries(['near','flow','fern','reed','rock','lupin'].map(k=>[k,meshPacket(r[k])])),cells:[r.grassCells,r.lupinCells,r.reedCells].map(c=>({digest:cellsDigest(c),counts:c.map(v=>v.count)})),origin:r.cellOrigin(),version:r.sourceVersion(),colliders:r.D.G.world.colliders};}
test('frozen runtime and genuine previous native geometry bind exactly; colony policy, constructors and physical source stay unchanged',()=>{
 for(const [file,hash] of Object.entries(contract.runtimeSHA256))assert.equal(sha(normalizeCoyoteMacroSource(fs.readFileSync(path.join(repo,file),'utf8'),file)),hash,file);
 assert.equal(sha(read('../lupin-original-e8b5cf4.mjs')),contract.flowerSHA256);assert.equal(sha(normalizeLupinSource(fs.readFileSync(path.join(repo,'assets/meadow-cover.js'),'utf8'),'assets/meadow-cover.js')),contract.coverSHA256);
 assert.equal(sha(course),contract.courseSHA256);assert.equal(nearBlock(source),contract.near);
 assert.equal(sourceSlice(source,'const lupinTex=','const fernTex='),contract.canvas,'legacy unused texture/RNG factory survives');
 const before=read('../lupin-original-e8b5cf4.mjs'),after=fs.readFileSync(path.join(repo,'assets/meadow-flowers.mjs'),'utf8');
 assert.equal(after.slice(0,after.indexOf('// Original rounded pea raceme:')),before.slice(0,before.indexOf('// Long raceme lupin:')));
 for(const [k,v] of Object.entries(native.attributes))assert.equal(sha(bytes(old.attributes[k].array)),v.sha256,k+' exact native original');
 assert.equal(sha(bytes(old.index.array)),native.index.sha256);assert.deepEqual(old.boundingBox.min.toArray(),native.bounds.min);assert.deepEqual(old.boundingBox.max.toArray(),native.bounds.max);assert.equal(old.boundingSphere.radius,native.sphere.radius);
 assert.deepEqual(next.boundingBox,old.boundingBox);assert.deepEqual(next.boundingSphere,old.boundingSphere);
});
test('geometry remains one synchronous allocation with the same future gameplay RNG and no additional scene/material/texture resources',()=>{
 function make(factory){let state=87391,calls=0;const prev=Math.random;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const stats={geometry:0,color:0};const forbidden=class{constructor(){throw Error('unexpected presentation resource');}};const C={...T,BufferGeometry:class extends T.BufferGeometry{constructor(){super();stats.geometry++;}},Color:class extends T.Color{constructor(){super();stats.color++;}},Mesh:forbidden,InstancedMesh:forbidden,Texture:forbidden,TextureLoader:forbidden,MeshStandardMaterial:forbidden};try{const g=factory(C),future=Array.from({length:16},()=>Math.random());return {g,stats,calls,future};}finally{Math.random=prev;}}
 const a=make(original.createMeadowLupinGeometry),b=make(current.createMeadowLupinGeometry);assert.deepEqual(b.stats,a.stats);assert.deepEqual(b.future,a.future);assert.equal(b.calls,20);assert.deepEqual(b.stats,{geometry:1,color:1});a.g.dispose();b.g.dispose();
});
test('actual High/Low near-cell admission, all six submissions and source caches stay exact across travel/revisits/course exclusions',()=>{
 const paths=[[13,115],[43,-151],[88,-157],[-68,213],[342,69],[13,115],[13.1,115.1]];
 for(const quality of ['high','low']){
  const bindings={window:{__onCourse:(x,z,w)=>Math.abs(x-16)<w&&z>100&&z<130},G:{world:{colliders:[],walls:[]},photoscans:{excludesGroundCover:(x,z)=>Math.hypot(x-48,z+157)<1.1}},biomeAt:(x,z)=>z>190?'snow':x>280?'desert':'meadow'};
  const a=createNearReplay(source,{quality,bindings}),b=createNearReplay(source,{quality,bindings});a.lupin.geometry.dispose();a.lupin.geometry=original.createMeadowLupinGeometry(T);
  let visible=0;for(const p of paths){withoutRandom(()=>{a.update(...p);b.update(...p);});assert.deepEqual(replayPacket(b),replayPacket(a));visible+=b.lupin.count;}
  assert(visible>100,'production hash and admission produce real flowers');assert.equal(b.lupin.instanceMatrix.count,quality==='low'?3136:8624);
  const stable=replayPacket(b);withoutRandom(()=>b.update(13.2,115.2));assert.deepEqual(replayPacket(b),stable,'same cell performs no upload/cache mutation');
  for(const r of[a,b])r.dispose();
 }
});
test('actual near VR submission changes only existing grass count; flower source/top/root/color and upload ownership stay identical',()=>{
 const a=createNearReplay(source),b=createNearReplay(source);a.lupin.geometry.dispose();a.lupin.geometry=original.createMeadowLupinGeometry(T);a.D.grassVR=b.D.grassVR=true;
 withoutRandom(()=>{a.update(13,115);b.update(13,115);});assert.deepEqual(replayPacket(b),replayPacket(a));assert.equal(b.near.count,Math.floor(b.grassCells.reduce((n,c)=>n+c.count,0)*.5));assert.equal(b.lupin.count,b.lupinCells.reduce((n,c)=>n+c.count,0));a.dispose();b.dispose();
});
function courseResult(g,a){const scene=new T.Scene(),material=new T.MeshBasicMaterial(),mesh=new T.InstancedMesh(g,material,a.length/19);mesh.name='Modelled meadow lupins';for(let i=0;i<mesh.count;i++)mesh.instanceMatrix.array.set(a.subarray(i*19,i*19+16),i*16);scene.add(mesh);const D={G:{scene},THREE:T,instances:[],_m:new T.Matrix4(),_p:new T.Vector3(),_q:new T.Quaternion(),_s:new T.Vector3(),_z:new T.Matrix4().makeScale(0,0,0),nameChain:o=>o.name,onCharacter:()=>false,fineCover:()=>false,SEED_WOOD_SPECIES:new Set(),SOLID_PLANT:/tree|stone|rock/i,SOFT_COVER:/grass|flower|lupin/i,dirty:new Set(),stats:{instancesHidden:0},courseDist:(x,z)=>Math.abs(x-16),LOW:3.4,TALL:6.2,zones:()=>[()=>true],inZone:(x,z)=>z===77};D.hideInst=it=>{it.o.setMatrixAt(it.i,D._z);D.dirty.add(it.o);it.R=-1;D.stats.instancesHidden++;};const gather=sourceSlice(course,' function gatherInstances(){',' const dirty='),mow=sourceSlice(course,' function mow(){',' function clear(routes)');withoutRandom(()=>new Function('D','with(D){'+gather+mow+'gatherInstances();mow();}')(D));const result={rows:D.instances.map(({i,x,z,R,canOwnCollider})=>({i,x,z,R,canOwnCollider})),matrix:sha(bytes(mesh.instanceMatrix.array)),hidden:D.stats.instancesHidden};assert(D.instances.every(r=>!r.canOwnCollider));mesh.dispose();material.dispose();return result;}
test('actual course gather/mow preserves every captured native radius/soft ownership/hidden mask and adversarial broadphase boundary',()=>{
 let samples=0;for(const view of views){const a=rows(view),prior=sha(bytes(a));assert.deepEqual(courseResult(next,a),courseResult(old,a));assert.equal(sha(bytes(a)),prior);samples+=a.length/19;}assert(samples>1000);
 const list=[];for(const scale of [.8999/old.boundingSphere.radius,.9001/old.boundingSphere.radius,0])for(const x of [16,19.39,19.41,22.84,22.86,30]){const m=new T.Matrix4().compose(new T.Vector3(x,2,77),new T.Quaternion(),new T.Vector3(scale,scale,scale));list.push(...m.elements,1,1,1);}const a=new Float32Array(list),c=courseResult(next,a);assert.deepEqual(c,courseResult(old,a));assert(c.hidden>0&&c.rows.some(r=>r.R>0),'mow/zone controls hit and retain samples');
});
test('every actual previously drawn tilted flower retains root and maximum/minimum world height despite rounded interior geometry',()=>{
 let count=0,max=0;for(const v of views){const a=rows(v);for(let i=0;i<a.length;i+=19){const m=a.subarray(i,i+16),b=transformedVerticalBounds(old,m),c=transformedVerticalBounds(next,m);max=Math.max(max,Math.abs(c.min-b.min),Math.abs(c.max-b.max));assert.equal(c.min,b.min);assert.equal(c.max,b.max);count++;}}assert(count>1000);assert.equal(max,0);
});
function actualMaterial(factory){const scene=new T.Scene(),material=new T.MeshBasicMaterial(),geometry=new T.BufferGeometry(),D={THREE:T,scene,quality:'high',NG_W:14,NG_LU:44,NG_R:42,createLupinGeometry:factory,near:new T.Mesh(geometry,material),flow:new T.Mesh(geometry,material),fern:new T.Mesh(geometry,material),reed:new T.Mesh(geometry,material),rock:new T.Mesh(geometry,material)};let seed=93231,calls=0;const prev=Math.random;Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{const r=new Function('D','with(D){'+contract.windy+contract.material+'return {luMat,lupin};}')(D),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};r.luMat.onBeforeCompile(shader);return{...r,scene,material,geometry,shader,calls,future:Array.from({length:8},()=>Math.random())};}finally{Math.random=prev;}}
test('actual one InstancedMesh and stock PBR/wind owner survives with no extra material/texture or constructor RNG',()=>{
 const a=actualMaterial(original.createMeadowLupinGeometry),b=actualMaterial(current.createMeadowLupinGeometry);assert.equal(a.calls,b.calls);assert.deepEqual(a.future,b.future);assert.equal(a.lupin.uuid,b.lupin.uuid);assert.equal(a.luMat.uuid,b.luMat.uuid);assert.equal(a.lupin.geometry.uuid,b.lupin.geometry.uuid);assert.equal(a.scene.children.length,b.scene.children.length);assert.equal(b.scene.children.filter(o=>o===b.lupin).length,1);assert.equal(b.lupin.instanceMatrix.count,8624);assert.equal(b.lupin.count,a.lupin.count);assert.deepEqual(b.shader.vertexShader,a.shader.vertexShader);assert.deepEqual(b.shader.fragmentShader,a.shader.fragmentShader);assert.equal(b.shader.fragmentShader,T.ShaderLib.standard.fragmentShader);for(const k of['map','side','roughness','envMapIntensity','transparent','opacity','depthWrite','vertexColors'])assert.equal(b.luMat[k],a.luMat[k],k);assert.equal(b.luMat.map,null);assert.equal(b.luMat.roughness,.86);assert(!b.lupin.castShadow&&b.lupin.receiveShadow&&!b.lupin.frustumCulled);for(const r of[a,b]){r.lupin.dispose();r.lupin.geometry.dispose();r.luMat.dispose();r.geometry.dispose();r.material.dispose();}
});
test('geometry and actual active-prefix cost are explicit; capacity is not reported as a zero-cost distant flower budget',()=>{
 const size=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+g.index.array.byteLength;assert.equal(old.index.count/3,238);assert.equal(next.index.count/3,646);assert.equal(size(old),20580);assert.equal(size(next),32100);assert.equal(next.attributes.position.count,784);const max=Math.max(...views.map(v=>v.bytes/76));assert.equal(max,377);assert.equal(max*(next.index.count-old.index.count)/3,153816);assert.equal(8624*646,5571104);old.dispose();next.dispose();
});
