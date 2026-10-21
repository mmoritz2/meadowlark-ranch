import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fixture,T,hash,fixtureScope,payload,packetBytes,authenticatePacket,fieldHash} from './snowpeak-boulder-fixture.mjs';
import {replaceSnowpeakBoulderContact as apply} from '../assets/snowpeak-boulder-contact.mjs';
import {createGeology} from '../assets/geology.js';
const geometryBytes=g=>Object.fromEntries([...Object.entries(g.attributes).map(([k,a])=>[k,hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))]),['index',hash(new Uint8Array(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength))]]);
const pose=f=>({geometry:f.mesh.geometry,material:f.mesh.material,matrix:f.mesh.matrixWorld.toArray(),circles:f.world.colliders.slice(),circle:{...f.circle},precise:Object.getOwnPropertyDescriptor(f.circle,'precise'),surfaces:f.solidWorld.surfaceStats(),support:f.groundSurfaces.slice(),field:hash(new Uint8Array(f.heights.buffer)),meshBytes:geometryBytes(f.mesh.geometry),pieceBytes:geometryBytes(f.piece.geo)});
test('fresh transaction/seating/packet module construction consumes no ambient RNG',()=>{
 const url=new URL('../assets/snowpeak-boulder-contact.mjs',import.meta.url).href;
 const code='Math.random=()=>{throw Error("Module touched ambient RNG")};await import('+JSON.stringify(url)+');';
 execFileSync(process.execPath,['--input-type=module','-e',code],{stdio:'pipe'});
});
test('actual scan replaces only source3 visual/body/support and rollback preserves exact owners',()=>{
 const f=fixture(),before=pose(f),random=Math.random;let ambient=0,s;
 try{Math.random=()=>{ambient++;throw Error('Ambient RNG touched');};s=apply(f);}finally{Math.random=random;}
 assert.equal(ambient,0);assert.equal(s.privateConstructorDraws,4);assert.equal(s.triangles,4499);assert.equal(s.status,'applied-same-mesh-triangle-body-support');
 assert.equal(s.mesh,f.mesh);assert.equal(f.mesh.parent,f.G.scene);assert.deepEqual(f.mesh.matrixWorld.toArray(),before.matrix);assert.deepEqual(f.world.colliders,before.circles);assert.equal(f.circle.precise,true);assert.equal(f.groundSurfaces.filter(x=>x===s.support).length,1);assert(f.solidWorld.hasSurface(f.mesh));assert.equal(f.solidWorld.surfaceStats().triangles,4499);assert.equal(pose(f).field,before.field);assert.equal(apply(f),s,'idempotent');
 const p=f.mesh.geometry.attributes.position,I=f.mesh.geometry.index.array,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3(),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
 const B=s.supportIndexStats.bounds;let valid=0,air=0,covered=0,bodyContacts=0;
 for(let ix=0;ix<=20;ix++)for(let iz=0;iz<=20;iz++){
  const x=B.minX-.2+(B.maxX-B.minX+.4)*ix/20,z=B.minZ-.2+(B.maxZ-B.minZ+.4)*iz/20;ray.origin.set(x,100,z);let top=-Infinity;
  for(let k=0;k<I.length;k+=3){a.fromBufferAttribute(p,I[k]).applyMatrix4(f.mesh.matrixWorld);b.fromBufferAttribute(p,I[k+1]).applyMatrix4(f.mesh.matrixWorld);c.fromBufferAttribute(p,I[k+2]).applyMatrix4(f.mesh.matrixWorld);if(ray.intersectTriangle(a,b,c,false,hit))top=Math.max(top,hit.y);}
  const registered=f.solidWorld.surfaceHeight(x,z,f.mesh),privateHeight=s.rawHeightAt(x,z);assert(top===registered||Math.abs(top-registered)<1e-8);assert(top===privateHeight||Math.abs(top-privateHeight)<1e-8);valid++;
  const canonical=f.world.terrainH(x,z),support=s.support(x,z);assert.equal(support,top>canonical?privateHeight:-Infinity);assert(Math.abs(f.world.groundH(x,z)-Math.max(canonical,top))<1e-8);if(top===-Infinity)air++;if(support>-Infinity)covered++;
  const h=f.world.groundH(x,z),opts={bottom:h+.38,top:h+2.65,radius:.55};if(f.solidWorld.surfaceContacts({x,z},opts).length)bodyContacts++;
 }
 assert(valid===441&&air>20&&covered>20&&bodyContacts>0);
 const high=f.solidWorld.surfaceHeight(f.mesh.position.x,f.mesh.position.z,f.mesh);assert(Number.isFinite(high));assert(f.solidWorld.limitVertical(f.mesh.position.x,f.mesh.position.z,high+3,high-3,2.3,.01)>=high-.01);
 let disposed=0;s.geometry.addEventListener('dispose',()=>disposed++);s.rollback();s.rollback();assert.equal(disposed,1);assert.deepEqual(pose(f),before);assert(!f.solidWorld.hasSurface(f.mesh));
});
test('different actual source transform fits the explicitly synthetic exterior without a QA pose guard',()=>{
 const f=fixture({placement:{x:120,z:185,s:1.1,yaw:1.13}}),matrix=f.mesh.matrixWorld.toArray(),s=apply(f);assert.equal(s.status,'applied-same-mesh-triangle-body-support');assert.deepEqual(f.mesh.matrixWorld.toArray(),matrix);assert.equal(f.circle.precise,true);assert(s.fit.accepted);s.rollback();
});
for(const[label,mutate]of[
 ['unfinished anchor',f=>{f.runtime.anchorGrounding.status='waiting';}],['unauthenticated field',f=>{f.runtime.payload.authenticated=false;}],['pruned source circle',f=>{f.world.colliders.splice(1,1);}],['duplicate source circle',f=>{f.world.colliders.push({...f.circle});}],['already precise unrelated authority',f=>{f.circle.precise=true;}],['previous surface owner',f=>{f.solidWorld.registerSurface(f.mesh);}],['wrong source geometry',f=>{f.mesh.geometry.attributes.position.array[0]+=.1;}],['wrong cached part',f=>{f.piece.geo.attributes.position.array[0]+=.1;}],['hidden source',f=>{f.mesh.visible=false;}]
 ])test('rejects '+label+' before resource/contact mutation',()=>{
 const expected={
  'unfinished anchor':/Late successful Snowpeak anchor finalizer/,'unauthenticated field':/Final admitted canonical\/runtime owner/,
  'pruned source circle':/One exact retained source circle/,'duplicate source circle':/One exact retained source circle/,'already precise unrelated authority':/One exact retained source circle/,
  'previous surface owner':/Fresh static surface owner/,'wrong source geometry':/Raw28 source geometry changed/,'wrong cached part':/Exact resident rock_moss_set_01 part3/,'hidden source':/Exact admitted raw28 index3 Mesh/
 };
 const f=fixture();mutate(f);const before=pose(f);assert.throws(()=>apply(f),expected[label]);assert.deepEqual(pose(f),before);
});
for(const where of ['register-before','register-after','support-after-push','material-after-swap','precise-after-set'])test('atomic rollback after '+where,()=>{
 const f=fixture();let fail=true;
 if(where==='precise-after-set'){const proxy=new Proxy(f.circle,{set(target,key,value){target[key]=value;if(key==='precise'&&fail){fail=false;throw Error('injected');}return true;}});f.circle=f.source.collider=f.world.colliders[1]=proxy;}
 const before=pose(f);
 if(where.startsWith('register')){const register=f.solidWorld.registerSurface;f.solidWorld.registerSurface=(...args)=>{if(fail&&where==='register-before'){fail=false;throw Error('injected');}const n=register(...args);if(fail){fail=false;throw Error('injected');}return n;};}
 if(where==='support-after-push'){const push=f.groundSurfaces.push;f.groundSurfaces.push=function(...args){const n=push.apply(this,args);if(fail){fail=false;throw Error('injected');}return n;};}
 if(where==='material-after-swap'){let material=f.mesh.material;Object.defineProperty(f.mesh,'material',{configurable:true,get:()=>material,set:v=>{material=v;if(fail){fail=false;throw Error('injected');}}});}
 assert.throws(()=>apply(f),error=>{assert.equal(error.rollbackRestored,true);assert.match(error.cause.message,/injected/);return true;});assert.equal(fail,false,'The intended injected stage was reached');assert.deepEqual(pose(f),before);assert(!f.solidWorld.hasSurface(f.mesh));
});
test('installed entry selects versioned seams and invokes the synchronous bridge after anchor finalization',()=>{
 const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),photoscans=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8');
 assert(html.includes('finalizeHollowpeakAnchorGrounding({G,runtime:value});G.photoscans?.installSnowpeakBoulderContact?.({source:snowpeakBoulderSource,runtime:value});hollowpeakStartupReady=true;'));
 assert.match(html,/"\.\/assets\/world-photoscans\.js\?v=hollowpeak-upper-source-roots-1": "\.\/assets\/world-photoscans\.js\?v=snowpeak-boulder-contact-\d+"/);
 assert.match(html,/"\.\/assets\/features\/course-clear\.js\?v=fine-meadows-1-mown-course-turf-4-loon-lake-4": "\.\/assets\/features\/course-clear\.js\?v=snowpeak-boulder-contact-\d+"/);
 assert.match(html,/'\.\/assets\/solid-collisions\.js\?v=snowpeak-boulder-contact-\d+'/);
 const begin=photoscans.indexOf('  state.installSnowpeakBoulderContact='),end=photoscans.indexOf('  let youngOuterSources',begin),bridge=photoscans.slice(begin,end);
 assert(begin>=0&&end>begin);assert(!/\bawait\b/.test(bridge));assert(!bridge.includes('async'));assert.equal(typeof fixture().solidWorld.hasSurface,'function');
});
test('original raw28 construction and capture-only successor preserve UUID/RNG/layout/collider order',()=>{
 const successor=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
 const captureAddition=' const sourceCircle=s>0.6?{x,z,r:s*1.05}:null;\n if(sourceCircle)colliders.push(sourceCircle);\n if(i===3)snowpeakBoulderSource={index:i,seed:i+9201,mesh:m,collider:sourceCircle};';
 assert.equal(successor.split(captureAddition).length-1,1,'Inverse only this owner-capture addition');
 const original=successor.replace(captureAddition,' if(s>0.6)colliders.push({x,z,r:s*1.05});');
 const block=text=>text.slice(text.indexOf('for(let i=0;i<28;i++){'),text.indexOf('/* procedurally carved river, bridge, reeds & wheat field */'));
 const run=(text,capture)=>{
  const prior=Math.random;let state=0x4d4c4553,draws=0;Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  try{
   const geology=createGeology({THREE:T,loadTextures:false}),scene=new T.Scene(),colliders=[];
   const captured=new Function('geology','groundH','cottonwoodReserved','scene','colliders','let snowpeakBoulderSource=null;'+text+';return snowpeakBoulderSource;')(geology,()=>0,()=>false,scene,colliders);
   if(capture){assert.equal(captured.index,3);assert.equal(captured.seed,9204);assert.equal(captured.mesh,scene.children.find(m=>m.userData.geology.seed===9204));if(captured.collider){assert(colliders.includes(captured.collider));assert.equal(captured.collider.x,captured.mesh.position.x);assert.equal(captured.collider.z,captured.mesh.position.z);assert.equal(captured.collider.r,captured.mesh.scale.x*1.05);}else assert(captured.mesh.scale.x<=.6);}
   const future=Array.from({length:16},Math.random);
   return{draws,state,future,colliders,meshes:scene.children.map(m=>({meshUUID:m.uuid,geometryUUID:m.geometry.uuid,materialUUID:m.material.uuid,seed:m.userData.geology.seed,position:m.position.toArray(),quaternion:m.quaternion.toArray(),scale:m.scale.toArray(),positionBytes:hash(new Uint8Array(m.geometry.attributes.position.array.buffer))}))};
  }finally{Math.random=prior;}
 };
 assert.deepEqual(run(block(original),false),run(block(successor),true));
});
test('optional resident bridge catches unavailable source and internal errors without load rejection',()=>{
 const text=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8'),begin=text.indexOf('  state.installSnowpeakBoulderContact='),end=text.indexOf('  let youngOuterSources',begin),bridge=text.slice(begin,end);
 const make=(parts,replace)=>{const state={};new Function('state','outerRockParts','replaceSnowpeakBoulderContact','G',bridge)(state,parts,replace,{});return state;};
 const empty=make(null,()=>{throw Error('should not run');});assert.equal(empty.installSnowpeakBoulderContact({source:null,runtime:null}).status,'retained-original-unavailable');
 const failed=make([0,1,2,{}],()=>{throw Error('optional failure');});assert.equal(failed.installSnowpeakBoulderContact({source:{mesh:{}},runtime:{}}).status,'retained-original');
 const rollback=make([0,1,2,{}],()=>{const e=Error('rollback failure');e.rollbackRestored=false;throw e;});assert.throws(()=>rollback.installSnowpeakBoulderContact({source:{mesh:{}},runtime:{}}),/rollback failure/);assert.equal(rollback.snowpeakBoulderContact.status,'rollback-failed');
});
test('detached source stops private support exactly like registered triangle owner',()=>{
 const f=fixture(),s=apply(f),x=f.mesh.position.x,z=f.mesh.position.z;assert(Number.isFinite(s.support(x,z)));f.G.scene.remove(f.mesh);assert.equal(f.solidWorld.surfaceHeight(x,z,f.mesh),-Infinity);assert.equal(s.support(x,z),-Infinity);s.rollback();
});
test('incomplete real registration rollback is surfaced as unsafe, never optional-retained',()=>{
 const f=fixture(),register=f.solidWorld.registerSurface,unregister=f.solidWorld.unregisterSurface;f.solidWorld.registerSurface=(...args)=>{register(...args);throw Error('register-after fault');};f.solidWorld.unregisterSurface=()=>{throw Error('rollback removal fault');};
 assert.throws(()=>apply(f),e=>{assert.equal(e.rollbackRestored,false);assert.match(e.rollbackError.cause.message,/rollback removal fault/);return true;});f.solidWorld.unregisterSurface=unregister;unregister(f.mesh);
});
for(const afterMutation of [false,true])test('applied rollback failure is truthful and retryable '+afterMutation,()=>{
 const f=fixture(),before=pose(f),s=apply(f),unregister=f.solidWorld.unregisterSurface;f.solidWorld.unregisterSurface=(...args)=>{if(afterMutation)unregister(...args);throw Error('persistent unregister fault');};
 assert.throws(()=>s.rollback(),e=>{assert.equal(e.rollbackRestored,false);assert.equal(e.rollbackPhase,'unregister-surface');assert.match(e.cause.message,/persistent unregister fault/);return true;});assert.equal(s.status,'rollback-failed');assert.equal(s.rollbackRestored,false);assert.equal(f.groundSurfaces.filter(g=>g===s.support).length,1);assert.equal(f.mesh.geometry,s.geometry);assert.equal(f.circle.precise,true);assert.equal(f.solidWorld.surfaceStats().triangles,afterMutation?0:4499);
 f.solidWorld.unregisterSurface=unregister;s.rollback();assert.equal(s.status,'rolled-back');assert.deepEqual(pose(f),before);
});

test('fixture authenticates actual patch while explicitly keeping exterior synthetic',async()=>{
 const f=fixture();assert.equal(payload.authenticated,true);assert.equal(fixtureScope.canonicalPatchAuthenticated,true);assert.equal(fixtureScope.wholeGridIsReviewedProductionField,false);assert.equal(f.heights[0],0);assert.notEqual(hash(new Uint8Array(f.heights.buffer)),fieldHash,'Mixed component grid is not the full reviewed production field');
 assert(Math.abs(f.world.terrainH(-182.3735044346476,-240.80179570622732)-6.836864398877742)<1e-12);
 const bad=Buffer.from(packetBytes);bad[bad.length-1]^=1;await assert.rejects(()=>authenticatePacket(bad),/payload integrity mismatch/);
});
