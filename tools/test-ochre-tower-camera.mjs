import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {register} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
register(new URL('./fixtures/ochre-camera-loader.mjs',import.meta.url));
const ROOT=process.env.MEADOWLARK_TEST_ROOT||fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const T=await import(pathToFileURL(ROOT+'/assets/vendor/three/build/three.module.js'));
const {mergeGeometries}=await import(pathToFileURL(ROOT+'/assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'));
const {createRanchArchitecture}=await import(pathToFileURL(ROOT+'/assets/ranch-architecture.js'));
const {setQuarterPrimitiveUV}=await import(pathToFileURL(ROOT+'/assets/quarter-surfaces.mjs'));
const {createFollowCamera}=await import(pathToFileURL(ROOT+'/assets/follow-camera.js'));
const {createSolidWorld}=await import(pathToFileURL(ROOT+'/assets/solid-collisions.js'));
const currentSource=fs.readFileSync(new URL('../assets/regional-workshops.mjs',import.meta.url),'utf8');
const originalSource=fs.readFileSync(new URL('./fixtures/regional-workshops-before-camera.mjs',import.meta.url),'utf8');
// Fresh module closure per isolated boot: exact actual source body, one pure
// merge import injected; factoryEpoch starts at1 in both independent worlds.
const workshopFactory=s=>Function('mergeGeometries',s.replace(/^import .*\n/,'').replace(/^export /gm,'')+'\nreturn createRegionalWorkshopArt;')(mergeGeometries);
const current={createRegionalWorkshopArt:options=>workshopFactory(currentSource)(options)},original={createRegionalWorkshopArt:options=>workshopFactory(originalSource)(options)};
const {createOchreTowerCameraAdmission}=await import('../assets/ochre-tower-camera.mjs');
const source=fs.readFileSync(new URL('../assets/features/world-quarters.js',import.meta.url),'utf8');
const before=JSON.parse(fs.readFileSync(new URL('./fixtures/ochre-tower-original-sections.json',import.meta.url)));
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const run=(code,env,value)=>Function(...Object.keys(env),code+'\nreturn '+value)(...Object.values(env));
const hash=a=>crypto.createHash('sha256').update(a).digest('hex');
const proof={scope:'Actual current primitive/tower/bake blocks, actual workshop/Three/follow-camera/solid-world CPU execution. No native/GPU or actual normal-orbit certification.',cases:[]};
function geometry(root){const rows=[];root.traverse(o=>{if(o.isMesh)rows.push({geometryUUID:o.geometry.uuid,meshUUID:o.uuid,materialUUID:o.material.uuid,index:o.geometry.index?hash(Buffer.from(o.geometry.index.array.buffer)):null,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([n,a])=>[n,hash(Buffer.from(a.array.buffer))])),matrix:o.matrixWorld.toArray(),cast:o.castShadow,receive:o.receiveShadow});});return rows;}
function tracked(make){let state=928451,calls=0;const old=Math.random;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{return{value:make(),calls,state};}finally{Math.random=old;}}
function env(candidate=true,{hook=true,location=[-325.2,.1,298.6],yaw=2.3086113869153615,alias=true,registration=null}={}){
 const A=createRanchArchitecture({THREE:T,loadTextures:false}),mat=name=>new T.MeshStandardMaterial({name,color:'#887052',roughness:1}),materials={aged:mat('weathered timber'),oak:mat('oiled oak'),iron:mat('iron'),steel:mat('steel'),stone:mat('stone')};
 const camera=createFollowCamera({THREE:T,groundHeight:()=>-100}),solidWorld=createSolidWorld({THREE:T}),raw=camera.register;
 if(alias)camera.registerCameraOnly=registration||raw;
 let wrappedCalls=0;camera.register=root=>{wrappedCalls++;raw(root);solidWorld.register(root,{primitives:true});};
 const W={followCamera:camera,solidWorld,groundSurfaces:[()=>-Infinity],colliders:[],walls:[],ranchBuilderArt:{materials},ranchArchitecture:A},G={THREE:T,world:W},admission=createOchreTowerCameraAdmission({THREE:T,camera});
 let capture=null,callbackCount=0;
 const onStaticTowerReady=input=>{capture=input;callbackCount++;return admission.admit(input);};
 const workshop=(candidate?current:original).createRegionalWorkshopArt({G,...(hook?{onStaticTowerReady}:{})});
 const P={draws:0,mergedFrom:0},scene=new T.Scene(),solid=new T.Group(),cache=new Map(),mt=c=>{if(!cache.has(c))cache.set(c,new T.MeshStandardMaterial({color:c}));return cache.get(c);};
 const groundH=()=>location[1],e={THREE:T,G,W,P,scene,solid,mt,workshop,quarterSigns:{prepareBake(){},omit(){return false;}},setQuarterPrimitiveUV,mergeGeometries,own:o=>o,groundH,pad:()=>[location[0],location[2]],collide:(x,z,r)=>W.colliders.push({x,z,r}),T_DARK:'#5a4634',T_MID:'#7d6245',F:{yaw,at:()=>[location[0],location[2]]},G_BOX:new T.BoxGeometry(1,1,1),G_CYL:new T.CylinderGeometry(1,1,1,9),G_TAP:new T.CylinderGeometry(.55,1,1,8),G_CONE:new T.ConeGeometry(1,1,8),G_LUMP:new T.IcosahedronGeometry(1,1)};
 Object.assign(e,run(before.primitives,e,'{put,bx,cy,tp,cn,lp,beam}'));
 Object.assign(e,run(before.place,e,'{place}'));
 e.bake=run(candidate?section(source,' function bake(',' /* Anything that repeats.'):before.bake,e,'bake');
 const bodyBefore=solidWorld.stats(),surfacesBefore=solidWorld.surfaceStats(),callbacks=W.groundSurfaces.slice();
 const result=run(candidate?section(source,'  const mill=pad(F.at(2,4)','  const fan=new THREE.Group();'):before.tower,e,'{wg,mill,MYAW}');
 return{...e,...result,camera,solidWorld,admission,bodyBefore,surfacesBefore,callbacks,capture:()=>capture,callbackCount:()=>callbackCount,wrappedCalls:()=>wrappedCalls};
}
const local=(root,p)=>new T.Vector3(...p).applyMatrix4(root.matrixWorld);
function firstTriangle(root,from,to){const direction=to.clone().sub(from),length=direction.length(),ray=new T.Ray(from,direction.normalize()),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3();let best=Infinity;root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,ix=o.geometry.index;for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i)).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,ix.getX(i+1)).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,ix.getX(i+2)).applyMatrix4(o.matrixWorld);if(ray.intersectTriangle(a,b,c,false,hit)){const d=from.distanceTo(hit);if(d>1e-8&&d<length-1e-8)best=Math.min(best,d);}}});return Number.isFinite(best)?best:null;}

test('actual FINAL tower callback runs after24 braces and before source queue release/bake',()=>{
 const e=env(),positions=e.wg.children.map(o=>o.geometry?.attributes.position.array.slice()),root=e.wg;
 assert.equal(e.callbackCount(),0);assert.equal(root.children.length,17);const token=e.workshop.prepareBake(e.solid);
 assert.equal(e.callbackCount(),1);assert.equal(e.capture().root,root);assert.equal(root.children.length,18);assert.equal(e.capture().braceParts.length,24);assert.equal(e.admission.stats.admitted,1);assert.equal(e.camera.obstacleCount,41);assert.equal(token.legacyMeshes,17);assert.equal(token.legacyDraws,84);
 for(let i=0;i<17;i++)assert.deepEqual(root.children[i].geometry.attributes.position.array,positions[i]);
 assert.equal(e.workshop.prepareBake(e.solid),null);assert.equal(e.callbackCount(),1);assert.equal(e.camera.obstacleCount,41);
 assert.equal(e.admission.admit(e.capture()).status,'already-attempted-no-retry');assert.equal(e.camera.obstacleCount,41);
 proof.cases.push({case:'final-source-timing',parts:e.camera.obstacleCount,originalParts:17,braceParts:24,token});
});
test('actual original/candidate constructor+bake preserve every render buffer/material slot and ambient RNG',()=>{
 const constructorBefore=tracked(()=>env(false)),constructorAfter=tracked(()=>env(true)),a=constructorBefore.value,b=constructorAfter.value,old=tracked(()=>a.bake(a.solid,true)),next=tracked(()=>b.bake(b.solid,true));
 assert.equal(constructorAfter.calls,constructorBefore.calls);assert.equal(constructorAfter.state,constructorBefore.state);assert.equal(b.wg.uuid,a.wg.uuid);assert.deepEqual(b.wg.children.map(o=>[o.uuid,o.geometry?.uuid||null,o.material?.uuid||null]),a.wg.children.map(o=>[o.uuid,o.geometry?.uuid||null,o.material?.uuid||null]));
 assert.equal(next.calls,old.calls);assert.equal(next.state,old.state);assert.equal(old.calls,84);assert.equal(old.value.length,next.value.length);
 // Fresh independent module closures match the actual first-boot factory epoch;
 // private baked UUIDs and every rendered numeric attribute/index must agree.
 const rows=x=>x.map(o=>({meshUUID:o.uuid,geometryUUID:o.geometry.uuid,materialUUID:o.material.uuid,color:o.material.color.toArray(),attrs:Object.fromEntries(Object.entries(o.geometry.attributes).map(([n,a])=>[n,{length:a.array.length,SHA256:hash(Buffer.from(a.array.buffer))}])),index:{length:o.geometry.index.array.length,SHA256:hash(Buffer.from(o.geometry.index.array.buffer))},cast:o.castShadow,receive:o.receiveShadow}));
 assert.deepEqual(rows(next.value),rows(old.value));assert.equal(b.wrappedCalls(),0);assert.equal(b.camera.obstacleCount,41);assert.deepEqual(b.W.colliders,a.W.colliders);assert.deepEqual(b.W.walls,a.W.walls);assert.deepEqual(b.solidWorld.stats(),b.bodyBefore);assert.deepEqual(b.solidWorld.surfaceStats(),b.surfacesBefore);assert.deepEqual(b.W.groundSurfaces,b.callbacks);
 proof.cases.push({case:'render-and-rng-parity',ambientConstructorDraws:constructorBefore.calls,ambientBakeDraws:old.calls,bakedMeshes:old.value.length,geometryHashes:next.value.map(o=>hash(Buffer.from(o.geometry.attributes.position.array.buffer))),bodyStats:b.solidWorld.stats()});
});
test('camera-only alias excludes dual body wrapper and uses no resource UUID/global RNG draws',()=>{
 const e=env(),original=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('unexpected ambient draw');};
 try{e.workshop.prepareBake(e.solid);assert.equal(draws,0);}finally{Math.random=original;}
 assert.equal(e.wrappedCalls(),0);assert.equal(e.solidWorld.stats().owners,0);assert.equal(e.solidWorld.surfaceStats().owners,0);assert.equal(e.camera.obstacleCount,41);assert(!e.wg.userData.solidParts);for(const o of e.wg.children)assert(!o.userData.solidParts);
});
test('independent rendered triangle hits are blocked while open tower gaps remain clear over arbitrary final poses',()=>{
 for(const[location,yaw]of[[[0,0,0],0],[[-325.2,.1,298.6],2.3086113869153615],[[27,4,-36],-.71]]){
  const e=env(true,{location,yaw});e.workshop.prepareBake(e.solid);const root=e.wg;
  for(const[from,to,label]of[[[0,1.64,4],[0,1.64,-4],'diagonal braces'],[[1.230769230769,2,4],[1.230769230769,2,-4],'tapered leg'],[[0,6.5,0],[0,9,0],'top platform']]){
   const a=local(root,from),b=local(root,to),out=new T.Vector3();assert(firstTriangle(root,a,b),label+' actual rendered hit');const f=e.camera.resolve(a,b,out);assert(f<1&&f>0,label+' retracts');assert.equal(firstTriangle(root,a,out),null,label+' resolved line misses rendered triangles');
  }
  for(const y of[.65,2.3]){const a=local(root,[0,y,4]),b=local(root,[0,y,-4]);assert.equal(firstTriangle(root,a,b),null,'authored centre gap has no triangle');assert(e.camera.isClear(a,b),'authored centre gap remains clear');}
 }
});
test('unregistered baseline genuinely permits opaque tower rays; same exact source with41 OBBs retracts',()=>{
 const e=env(true,{location:[0,0,0],yaw:0});e.workshop.prepareBake(e.solid);const old=createFollowCamera({THREE:T,groundHeight:()=>-100}),a=local(e.wg,[0,1.64,4]),b=local(e.wg,[0,1.64,-4]);assert(firstTriangle(e.wg,a,b));assert(old.isClear(a,b));assert(!e.camera.isClear(a,b));
});
test('all final rendered tower vertices lie in their own oriented camera record before clearance padding',()=>{
 const e=env();e.workshop.prepareBake(e.solid);const parts=e.admission.stats.records[0].parts,source=e.capture(),v=new T.Vector3();let tested=0,maxOutside=0;
 const check=(mesh,start,count,part)=>{const inverse=new T.Matrix4().fromArray(part.matrix).invert(),p=mesh.geometry.attributes.position;for(let i=start;i<start+count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);for(let a=0;a<3;a++)maxOutside=Math.max(maxOutside,part.min[a]-v.getComponent(a),v.getComponent(a)-part.max[a]);tested++;}};
 for(let i=0;i<17;i++)check(e.wg.children[i],0,e.wg.children[i].geometry.attributes.position.count,parts[i]);
 for(let i=0;i<24;i++)check(source.bracesRoot.children[0],source.braceParts[i].firstVertex,24,parts[i+17]);
 assert(tested>1500);assert(maxOutside<1e-10,'only measured Float64 transform cancellation remains, well inside existing camera clearance');proof.vertexCoverage={tested,maxOutside};
});
test('camera records survive actual bake source drop without retaining live source transforms',()=>{
 const e=env();e.bake(e.solid,true);const row=e.admission.stats.records[0],copy=JSON.stringify(row),a=local(e.wg,[0,1.64,4]),b=local(e.wg,[0,1.64,-4]);assert(!e.camera.isClear(a,b));assert.equal(e.wg.parent,e.solid);assert.equal(e.solid.parent,null);e.wg.position.x+=100;e.wg.updateWorldMatrix(true,true);assert(!e.camera.isClear(a,b));assert.equal(JSON.stringify(row),copy,'copied records are not live source references');
});
test('missing camera-only alias retains render and never falls back to wrapped registration',()=>{
 const e=env(true,{alias:false});const result=e.bake(e.solid,true);assert.equal(result.length,3);assert.equal(e.camera.obstacleCount,0);assert.equal(e.wrappedCalls(),0);assert.equal(e.admission.stats.admitted,0);assert.equal(e.admission.stats.rejected,1);assert.equal(e.solidWorld.stats().owners,0);assert.equal(e.wg.children.length,18);
});
test('misbound wrapped alias is rejected before camera or body registration',()=>{const e=env();e.camera.registerCameraOnly=e.camera.register;e.bake(e.solid,true);assert.equal(e.camera.obstacleCount,0);assert.equal(e.wrappedCalls(),0);assert.equal(e.solidWorld.stats().owners,0);assert.match(e.admission.stats.records[0].reason,/Distinct raw/);});
test('premature/final provenance corruption rejects before any camera or body append',()=>{
 const e=env();assert.equal(e.admission.admit({root:e.wg,bracesRoot:e.wg.children[0],braceParts:[]}).status,'retained-render-camera-unadmitted');
 const raw=e.camera.registerCameraOnly;let input;e.camera.registerCameraOnly=()=>{throw Error('must not reach registration');};
 const sourceOnly=env(true,{hook:false});sourceOnly.workshop.prepareBake(sourceOnly.solid);assert.equal(sourceOnly.camera.obstacleCount,0);
 // Capture final records through the actual optional callback without admitting.
 const k=env();k.camera.registerCameraOnly=()=>{throw Error('injected before append');};k.workshop.prepareBake(k.solid);input=k.capture();
 const bad={...input,braceParts:input.braceParts.map(p=>({...p,matrix:p.matrix.slice()}))};bad.braceParts[1].firstVertex=bad.braceParts[0].firstVertex;
 const gate=createOchreTowerCameraAdmission({THREE:T,camera:e.camera});assert.match(gate.admit(bad).reason,/Overlapping/);assert.equal(e.camera.obstacleCount,0);assert.equal(e.wrappedCalls(),0);e.camera.registerCameraOnly=raw;
});
test('raw registration failure before append and injected partial append remain truthful/no retry',()=>{
 for(const partial of[false,true]){const e=env();const raw=e.camera.registerCameraOnly;e.camera.registerCameraOnly=proxy=>{if(partial)raw({...proxy,userData:{solidParts:[proxy.userData.solidParts[0]]}});throw Error('injected raw registration fault');};const baked=e.bake(e.solid,true);assert.equal(baked.length,3);assert.equal(e.admission.stats.admitted,0);assert.equal(e.admission.stats.errors.length,1);const r=e.admission.stats.errors[0];assert.equal(r.rollbackClaimed,false);assert.equal(r.registeredParts,partial?1:0);assert.equal(r.status,partial?'registration-failed-incomplete-no-retry':'registration-failed-no-camera-append');assert.equal(e.admission.admit(e.capture()).status,'already-attempted-no-retry');assert.equal(e.camera.obstacleCount,partial?1:0);assert.equal(e.wrappedCalls(),0);}
});
test('opaque camera callback source-buffer/attribute/index/material mutation is detected without resetting source or claiming rollback',()=>{
 for(const mutation of['buffer','attribute','index','material']){
  const e=env(),raw=e.camera.registerCameraOnly,mesh=e.wg.children[0],array=mesh.geometry.attributes.position.array,first=array[0];
  e.camera.registerCameraOnly=proxy=>{if(mutation==='buffer')array[0]=first+.01;if(mutation==='attribute')mesh.geometry.setAttribute('position',mesh.geometry.attributes.position.clone());if(mutation==='index')mesh.geometry.setIndex(mesh.geometry.index.clone());if(mutation==='material')mesh.material.opacity=.7;raw(proxy);};
  e.bake(e.solid,true);assert.equal(e.admission.stats.admitted,0);assert.equal(e.admission.stats.errors.length,1);assert.match(e.admission.stats.errors[0].reason,/Source changed/);assert.equal(e.admission.stats.errors[0].registeredParts,41);assert.equal(e.admission.stats.errors[0].rollbackClaimed,false);assert.equal(e.camera.obstacleCount,41);if(mutation==='buffer')assert.equal(array[0],Math.fround(first+.01));if(mutation==='material')assert.equal(mesh.material.opacity,.7);assert.equal(e.wrappedCalls(),0);
 }
});
test('nonfinite or singular child timber transforms reject before registration and remain caller-visible',()=>{
 for(const invalid of['singular','nonfinite']){const e=env(),m=e.wg.children[0];if(invalid==='singular')m.scale.x=0;else m.position.z=NaN;e.workshop.prepareBake(e.solid);assert.equal(e.admission.stats.admitted,0);assert.equal(e.admission.stats.rejected,1);assert.match(e.admission.stats.records[0].reason,/Finite nonsingular/);assert.equal(e.camera.obstacleCount,0);assert.equal(e.wrappedCalls(),0);if(invalid==='singular')assert.equal(m.scale.x,0);else assert(Number.isNaN(m.position.z));}
});
test('opaque final callback failure cannot repeat upgrade or suppress source bake',()=>{
 const e=env(true,{hook:false});let calls=0;const w=current.createRegionalWorkshopArt({G:e.G,onStaticTowerReady(){calls++;throw Error('injected callback');}});w.queue(e.wg,'tower');const result=w.prepareBake(e.solid);assert(result);assert.equal(calls,1);assert.equal(e.wg.children.length,18);assert.equal(w.stats.cameraAdmissionErrors[0].rollbackClaimed,false);assert.equal(w.prepareBake(e.solid),null);assert.equal(calls,1);
});
test('HTML exposes exact raw camera entry before dual wrapper; all render/physical/source-sign constructors stay exact',()=>{
 const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),alias='followCamera.registerCameraOnly=registerCamera;',capture='const registerCamera=followCamera.register;',wrap='followCamera.register=root=>{registerCamera(root);solidWorld.register(root,{primitives:true});};';assert.equal(html.split(alias).length-1,1);assert(html.indexOf(capture)<html.indexOf(alias)&&html.indexOf(alias)<html.indexOf(wrap));
 const camera={register:x=>{camera.rawCalls=(camera.rawCalls||0)+1;},rawCalls:0},body={register:()=>{body.calls=(body.calls||0)+1;},calls:0};Function('followCamera','solidWorld',capture+'\n'+alias+'\n'+wrap)(camera,body);camera.registerCameraOnly({});assert.equal(camera.rawCalls,1);assert.equal(body.calls,0);camera.register({});assert.equal(camera.rawCalls,2);assert.equal(body.calls,1);
 for(const[k,a,b]of[['primitives',' function put(',' /* A pitched roof:'],['place',' function place(',' /* Where a point local'],['bake',' function bake(',' /* Anything that repeats.'],['tower','  const mill=pad(F.at(2,4)','  const fan=new THREE.Group();']])assert.equal(section(source,a,b),before[k],k+' source exact');
 assert(source.includes("quarter-sign-joinery.mjs?v=quarter-sign-final-support-4"));assert(source.includes('P.signJoinery=quarterSigns.finalize()'));assert(!source.includes('registerCameraOnly('),'only helper owns the scoped admission');
});
test('portable scoped receipt is serializable and source-only results are labelled',()=>{assert.equal(proof.cases.length,2);const data=JSON.stringify(proof,null,2)+'\n';if(process.env.OCHRE_CAMERA_AUDIT_OUTPUT)fs.writeFileSync(process.env.OCHRE_CAMERA_AUDIT_OUTPUT,data);assert.equal(JSON.parse(data).cases[0].parts,41);});
