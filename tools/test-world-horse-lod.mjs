import test from 'node:test';
import assert from 'node:assert/strict';
import {greyFixture,THREE} from './world-horse-lod-fixture.mjs';
import {bakeWorldHorsePoses,withHorseVisualRandom,morphPackedBytes,poseEnvelope,worldHorseWantsFull} from '../assets/world-horse-lod.mjs';
const fixture=await greyFixture();
const source=()=>{const rows=[];fixture.asset.scene.traverse(o=>{if(o.isSkinnedMesh)rows.push([o.name,Object.keys(o.geometry.attributes),Buffer.from(o.geometry.attributes.position.array.buffer).toString('base64'),o.geometry.uuid]);});return rows;};
let template;
test('actual approved grey bake has shared plain-mesh poses, source UV/index copies and complete buffer accounting',()=>{
 const before=source();let draws=0;const previous=Math.random;Math.random=()=>{draws++;return .417;};
 try{template=bakeWorldHorsePoses({THREE,...fixture});}finally{Math.random=previous;}
 assert.equal(draws,0);assert.deepEqual(source(),before);assert.equal(template.rows.length,3);assert.equal(template.vertices,41701);assert.equal(template.triangles,58768);
 assert.equal(template.targets,6);assert.equal(template.residentBytes,2*template.baseBytes+2*template.morphBytes+2*template.packedBytes);
 for(const row of template.rows){assert.equal(row.geometry.morphAttributes.position.length,6);assert.equal(row.geometry.morphAttributes.normal.length,6);assert.equal(row.geometry.attributes.skinIndex,undefined);assert.equal(row.geometry.attributes.skinWeight,undefined);assert.equal(row.source,undefined);assert(row.geometry.boundingSphere.radius>0);const mesh=new THREE.Mesh(row.geometry,row.material);assert.equal(mesh.isSkinnedMesh,undefined);for(const pose of row.geometry.morphAttributes.position)assert(pose.array.every(Number.isFinite));for(const normal of row.geometry.morphAttributes.normal)for(let i=0;i<normal.count;i+=17)assert(Math.abs(new THREE.Vector3().fromBufferAttribute(normal,i).length()-1)<1e-5);let original;fixture.asset.scene.traverse(o=>{if(o.name===row.name)original=o;});assert.notEqual(row.geometry.index,original.geometry.index);assert.deepEqual(row.geometry.index.array,original.geometry.index.array);for(const name of ['uv','uv1','uv2'])if(original.geometry.attributes[name]){assert.notEqual(row.geometry.attributes[name],original.geometry.attributes[name]);assert.deepEqual(row.geometry.attributes[name].array,original.geometry.attributes[name].array);}}
});
test('actual authored graze target moves the muzzle while source feet retain their standing floor',()=>{
 const body=template.rows.find(row=>row.geometry.attributes.position.count===16159),rest=body.geometry.morphAttributes.position[4],graze=body.geometry.morphAttributes.position[5];let moved=0,feet=0,maxFoot=0;
 for(let i=0;i<rest.count;i++){const a=new THREE.Vector3().fromBufferAttribute(rest,i).applyMatrix4(body.matrix),b=new THREE.Vector3().fromBufferAttribute(graze,i).applyMatrix4(body.matrix);moved=Math.max(moved,a.distanceTo(b));if(a.y<.18){feet++;maxFoot=Math.max(maxFoot,a.distanceTo(b));}}
 assert(moved>.6,'head lowers materially');assert(feet>20);assert(maxFoot<.008,'all actual low sole/body samples remain supported');
});
test('hysteresis retains full near anatomy, promotes interactions and never treats far visibility as removal',()=>{
 assert.equal(worldHorseWantsFull('far',{distance:57,projectedHeight:0}),true);assert.equal(worldHorseWantsFull('far',{distance:65,projectedHeight:0}),false);assert.equal(worldHorseWantsFull('full',{distance:65,projectedHeight:0}),true);assert.equal(worldHorseWantsFull('full',{distance:81,projectedHeight:0}),false);assert.equal(worldHorseWantsFull('far',{distance:240,interacting:true}),true);assert.equal(worldHorseWantsFull('far',{distance:240,projectedHeight:40}),true);
});
test('synchronous visual RNG restores gameplay stream even on throw and never spans async continuation',async()=>{
 const previous=Math.random;let draws=0;Math.random=()=>{draws++;return .271;};
 try{withHorseVisualRandom('one',()=>{new THREE.Group();throw Error('fixture');});}catch(e){assert.equal(e.message,'fixture');}
 assert.equal(draws,0);const saved=Math.random;assert.throws(()=>withHorseVisualRandom('async',async()=>{}),/synchronous/);assert.equal(Math.random,saved);
 const result=withHorseVisualRandom('promise',()=>Promise.resolve().then(()=>Math.random()));assert.equal(await result,.271);assert.equal(draws,1);Math.random=previous;
});
test('cache accounting includes both morph VBOs and packed CPU/GPU texture arrays',()=>{
 assert.equal(morphPackedBytes(16159,6,16384),3145728);assert.equal(morphPackedBytes(2028,6,16384),389376);assert.equal(morphPackedBytes(23514,6,16384),4718592);assert.equal(poseEnvelope(0),0);assert.equal(poseEnvelope(.4),1);assert(Math.abs(poseEnvelope(1))<1e-12);
});
const {createWorldHorseLOD,warmWorldHorsePoses}=await import('../assets/world-horse-lod.mjs');
const {retireWorldHorse}=await import('../assets/world-horse-lifecycle.mjs');
function fakeRenderer(){let target=null,cube=0,mip=0,viewport=new THREE.Vector4(0,0,800,600),scissor=viewport.clone(),clear=new THREE.Color('#123456'),alpha=.7;return{capabilities:{maxTextureSize:16384},domElement:{height:900},xr:{enabled:true},shadowMap:{enabled:true},autoClear:false,getRenderTarget:()=>target,getActiveCubeFace:()=>cube,getActiveMipmapLevel:()=>mip,getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>true,getClearColor:c=>c.copy(clear),getClearAlpha:()=>alpha,setRenderTarget(t,c=0,m=0){target=t;cube=c;mip=m;},setViewport(...v){viewport=v.length===1?v[0].clone():new THREE.Vector4(...v);},setScissor(v){scissor=v.clone();},setScissorTest(){},setClearColor(c,a){clear.copy(c);alpha=a;},render(){},getContext:()=>({getError:()=>0}),snapshot(){return{target,cube,mip,viewport:viewport.toArray(),scissor:scissor.toArray(),clear:clear.toArray(),alpha,xr:this.xr.enabled,shadows:this.shadowMap.enabled,auto:this.autoClear};}};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('real morph prewarm restores renderer state and consumes no gameplay constructor UUID draws',()=>{
 const renderer=fakeRenderer(),before=renderer.snapshot(),random=Math.random;let draws=0;Math.random=()=>{draws++;return .53;};try{warmWorldHorsePoses({THREE,renderer,template});}finally{Math.random=random;}
 assert.equal(draws,0);assert.deepEqual(renderer.snapshot(),before);
});
test('far actors share actual baked geometry with zero skeletons, independent phase, exact cache leases and retirement',async()=>{
 const scene=new THREE.Group(),camera=new THREE.PerspectiveCamera(52,1,.1,1000),player={pos:new THREE.Vector3()},renderer=fakeRenderer();let fullTicks=0;
 const api=createWorldHorseLOD({THREE,models:{get:()=>fixture.asset,resolve:key=>key},...fixture,renderer,camera,player,fullDress(ent,parts){if(!ent.rig){ent.rig=fixture.instantiate(fixture.asset);parts.group.add(ent.rig.scene);}},fullTick(){fullTicks++;},undress(ent){ent.rig?.scene.removeFromParent();ent.rig=null;},getFallback:()=>fixture.asset,getDefinition:()=>null});
 const actor=(x,phase)=>{const group=new THREE.Group();group.position.x=x;scene.add(group);return{parts:{group},pos:new THREE.Vector3(x,0,0),phase};};const a=actor(129,0),b=actor(226,2);
 const update=e=>api.update(e,e.parts,{body:'#b9bec6',mane:'#787f8a'},{breed:'grey'},1.1,1/60,0,0);
 update(a);update(b);await flush();update(a);update(b);assert.equal(api.stats().farActors,2);assert.equal(api.stats().entries[0].refs,2);assert(api.stats().cacheBytes<=api.stats().budgetBytes);let bones=0,skins=0;for(const e of[a,b])e.worldHorseLOD.group.traverse(o=>{if(o.isBone)bones++;if(o.isSkinnedMesh)skins++;});assert.equal(bones,0);assert.equal(skins,0);const ma=a.worldHorseLOD.group.children[0],mb=b.worldHorseLOD.group.children[0];assert.equal(ma.geometry,mb.geometry);assert.notEqual(ma.material.uuid,mb.material.uuid);assert.notDeepEqual(ma.morphTargetInfluences,mb.morphTargetInfluences);assert(ma.customDepthMaterial&&ma.customDistanceMaterial);
 const geometry=ma.geometry;api.release(a);retireWorldHorse(a);update(a);assert.equal(a.worldHorseLOD,null);assert.equal(api.stats().entries[0].refs,1);assert.equal(b.worldHorseLOD.group.children[0].geometry,geometry);
 for(let i=0;i<8;i++){b.pos.x=b.parts.group.position.x=57;update(b);assert(b.rig);b.pos.x=b.parts.group.position.x=67;update(b);assert(b.rig);b.pos.x=b.parts.group.position.x=90;update(b);assert.equal(b.rig,null);assert(b.worldHorseLOD.group);assert.equal(api.stats().entries[0].refs,1);}
 assert(fullTicks>0);api.release(b);retireWorldHorse(b);assert.equal(api.stats().entries[0].refs,0);assert.equal(api.stats().actors,0);
});
test('full transitions isolate lazy skin/depth resources and late completion obeys current far intent',async()=>{
 const group=new THREE.Group();group.position.x=129;const ent={parts:{group},pos:new THREE.Vector3(129,0,0),phase:0},renderer=fakeRenderer(),camera=new THREE.PerspectiveCamera(52,1,.1,1000),player={pos:new THREE.Vector3()};let ready=false,constructed=0,requested=0,api;
 const options={breed:'grey'},colors={body:'#b9bec6',mane:'#787f8a'};
 api=createWorldHorseLOD({THREE,models:{get:()=>fixture.asset,resolve:key=>key,load:async(key,construct)=>{await Promise.resolve();return construct(()=>{new THREE.Group();return fixture.asset;});}},...fixture,renderer,camera,player,fullDress(e,parts){if(!ready){requested++;return;}if(!e.rig){constructed++;e.rig=fixture.instantiate(fixture.asset);parts.group.add(e.rig.scene);api.fullReady(e);}},fullTick(){},undress(e){e.rig?.scene.removeFromParent();e.rig=null;},getFallback:()=>fixture.asset,getDefinition:()=>null});
 const update=()=>api.update(ent,ent.parts,colors,options,1.1,1/60,0,0);update();await flush();update();assert(ent.worldHorseLOD.group);
 const previous=Math.random;let draws=0;Math.random=()=>{draws++;return .29;};
 try{
  ent.pos.x=group.position.x=57;update();assert(requested>0);ent.pos.x=group.position.x=129;update();ready=true;assert.equal(api.resumeFull(ent,ent.parts,colors,options),true);assert.equal(constructed,0);assert.equal(ent.rig,undefined);assert(ent.worldHorseLOD.group);
  ent.pos.x=group.position.x=57;update();assert.equal(constructed,1);assert(ent.rig.worldLODResourcesReady);let skins=0;ent.rig.scene.traverse(mesh=>{if(mesh.isSkinnedMesh){skins++;assert(mesh.skeleton.boneTexture);}if(mesh.isMesh){assert(mesh.customDepthMaterial);assert(mesh.customDistanceMaterial);}});assert(skins>0);assert.equal(ent.worldHorseLOD.group,null);assert.equal(api.stats().entries[0].refs,0);
  assert.equal(await api.loadFull('grey'),fixture.asset);assert.equal(draws,0);
 }finally{Math.random=previous;api.release(ent);}
});
test('scope admits ordinary equines and retains dragons/fantasy variants on their original branch',()=>{
 const api=createWorldHorseLOD({THREE,models:{profile:key=>({nativeKind:key==='dragon'?'dragon':'horse',family:key==='winged'?'fantasy':'sport'})},...fixture,renderer:fakeRenderer(),camera:new THREE.PerspectiveCamera(),player:{pos:new THREE.Vector3()},fullDress(){},fullTick(){},undress(){}});
 assert.equal(api.supportsBreed('grey'),true);assert.equal(api.supportsBreed('fjord'),true);assert.equal(api.supportsBreed('dragon'),false);assert.equal(api.supportsBreed('winged'),false);
});
