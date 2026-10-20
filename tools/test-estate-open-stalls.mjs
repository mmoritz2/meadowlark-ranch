import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.ESTATE_STALL_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url)),
  modulePath=process.env.ESTATE_STALL_MODULE||path.join(root,'assets/estate-open-stalls.mjs'),
  T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js'))),
  {createRanchArchitecture}=await import(pathToFileURL(path.join(root,'assets/ranch-architecture.js'))),
  source=fs.readFileSync(modulePath,'utf8').replace(/from '(\.\/[^']+)'/g,(_,relative)=>
    'from '+JSON.stringify(pathToFileURL(path.join(root,'assets',relative.split('?')[0])).href+
      (relative.includes('?')?'?'+relative.split('?')[1]:''))),
  {installEstateOpenStalls}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const make=glowPanes=>createRanchArchitecture({THREE:T,loadTextures:false,glowPanes}),
  visible=root=>root.children.filter(mesh=>mesh.isMesh&&mesh.visible),
  rays=(meshes,origin,dir,far)=>new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...dir),0,far).intersectObjects(meshes,false),
  bounds=meshes=>{const box=new T.Box3();for(const mesh of meshes){mesh.updateWorldMatrix(true,false);box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));}return box;};

test('the replacement is finite and opaque with retained roof bounds, truly open front and rear window recess',()=>{
  const architecture=make(),original=architecture.buildOpenStall(),oldBounds=bounds(original.children),state=installEstateOpenStalls({THREE:T,architecture}),
    root=architecture.buildOpenStall(),meshes=visible(root),meta=root.userData.estateOpenStall,box=bounds(meshes);
  assert.equal(meshes.length,7);assert.equal(meta.drawCalls,7);assert.equal(meta.sharedResources,true);
  assert(meta.triangles>4000&&meta.triangles<18000,'bounded detailed stall '+meta.triangles);
  assert(meta.geometryBytes<1300000);assert(meta.physicalSlateCourses>20);
  for(const axis of['x','y','z']){
    assert(box.min[axis]>=oldBounds.min[axis]-1e-5,axis+' minimum stays within original envelope');
    assert(box.max[axis]<=oldBounds.max[axis]+1e-5,axis+' maximum stays within original envelope');
  }
  assert.deepEqual(meta.roofCenter,root.userData.architecture.roofCenter);
  assert.equal(meta.roofRotationZ,root.userData.architecture.roofRotationZ);
  for(const mesh of meshes){
    assert.equal(mesh.parent,root);assert(mesh.castShadow&&mesh.receiveShadow);assert.equal(mesh.material.transparent,false);
    const geometry=mesh.geometry;
    for(const attribute of Object.values(geometry.attributes))for(const value of attribute.array)assert(Number.isFinite(value));
    for(const i of geometry.index.array)assert(i<geometry.attributes.position.count);
    const normal=geometry.attributes.normal;
    for(let i=0;i<normal.count;i++)assert(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5);
  }
  root.updateMatrixWorld(true);
  // Every clear front probe crosses the old front plane to the horse's local
  // standing position(-.1,0,0); no cosmetic front gate or merged wall is added.
  for(const z of[-1.25,-.75,0,.75,1.25])for(const y of[.32,.75,1.2,1.7,2.05])
    assert.equal(rays(meshes,[-1.4,y,z],[1,0,0],1.28).length,0,'open front '+y+','+z);
  // External oblique window rays first meet opaque glass184 mm behind the
  // old outside wall face, not a board painted like a window.
  for(const y of[1.19,1.62])for(const z of[-.31,.31]){
    const hits=rays(meshes,[1.4,y,z],[-1,0,0],.8);
    assert(hits.length);assert.equal(hits[0].object.material.name,'Estate stalls | recessed live evening window');
    assert(Math.abs(hits[0].point.x-.806)<1e-6);
  }
  for(const z of[-1.16,1.16])assert(rays(meshes,[1.4,1.4,z],[-1,0,0],.7).some(h=>h.object.material.name.includes('sage')));
  state.dispose();
});

test('installation preserves original root, solidParts, metadata, transform and world random consumption',()=>{
  const architecture=make(),original=architecture.buildOpenStall;let observed;
  architecture.buildOpenStall=function(...args){const root=original.apply(this,args);root.position.set(-30.5,2,-31.5);root.rotation.y=.42;root.scale.set(1.1,.95,1.08);
    observed={root,parts:root.userData.solidParts,partsJSON:JSON.stringify(root.userData.solidParts),architecture:root.userData.architecture,
      architectureJSON:JSON.stringify(root.userData.architecture),meshes:root.children.slice(),position:root.position.toArray(),rotation:root.rotation.toArray(),scale:root.scale.toArray()};return root;};
  const hooked=architecture.buildOpenStall,random=Math.random;let baseline=0,candidate=0;
  try{
    Math.random=()=>{baseline++;return .42;};hooked();
    const state=installEstateOpenStalls({THREE:T,architecture});assert.equal(installEstateOpenStalls({THREE:T,architecture}),state);
    const caller=()=>{candidate++;return .42;};Math.random=caller;
    const root=architecture.buildOpenStall();assert.equal(candidate,baseline);assert.equal(Math.random,caller);
    assert.equal(root,observed.root);assert.equal(root.userData.solidParts,observed.parts);assert.equal(JSON.stringify(root.userData.solidParts),observed.partsJSON);
    assert.equal(root.userData.architecture,observed.architecture);assert.equal(JSON.stringify(root.userData.architecture),observed.architectureJSON);
    assert.deepEqual(root.position.toArray(),observed.position);assert.deepEqual(root.rotation.toArray(),observed.rotation);assert.deepEqual(root.scale.toArray(),observed.scale);
    assert(observed.meshes.every(mesh=>!mesh.visible));assert.equal(state.liveInstances,1);
    const count=root.children.length;state.dress(root);assert.equal(root.children.length,count);assert.equal(state.replacements,1);
    state.dispose();assert.equal(architecture.buildOpenStall,hooked);assert.equal(root.children.length,observed.meshes.length);assert(observed.meshes.every(mesh=>mesh.visible));
    assert.equal(root.userData.estateOpenStall,undefined);assert.equal(state.liveInstances,0);
  }finally{Math.random=random;}
});

test('24 stalls share one resource set, unique visual object UUIDs and safe per-root release',()=>{
  const architecture=make(),state=installEstateOpenStalls({THREE:T,architecture}),models=[],identities=new Set();
  for(let i=0;i<24;i++){
    const root=architecture.buildOpenStall();root.position.set(-30.5,0,-31.5+i*3.3);models.push(root);
    const meshes=visible(root);
    for(let k=0;k<meshes.length;k++){
      const mesh=meshes[k];assert(!identities.has(mesh.uuid));identities.add(mesh.uuid);
      assert.equal(mesh.geometry,state.resources.batches[k].geometry);assert.equal(mesh.material,state.resources.batches[k].material);
    }
  }
  assert.equal(state.liveInstances,24);assert.equal(state.resources.batches.length,7);assert.equal(identities.size,168);
  assert.equal(new Set(state.resources.batches.map(b=>b.geometry.uuid)).size,7);
  assert.equal(new Set(state.resources.batches.map(b=>b.material.uuid)).size,7);
  let disposed=0;for(const{geometry,material}of state.resources.batches){geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);}
  const release=models[0].userData.disposeEstateOpenStall;assert.equal(release(),true);assert.equal(release(),false);assert.equal(disposed,0);
  assert.equal(state.liveInstances,23);assert(models.slice(1).every(g=>visible(g).length===7));
  state.dispose();state.dispose();assert.equal(disposed,14);assert.equal(state.liveInstances,0);
});

test('resident maps and live dusk color are borrowed without cloning or extra lighting controllers',()=>{
  const glowPanes=[],architecture=make(glowPanes),texture=new T.Texture(),normal=new T.Texture(),roughness=new T.Texture();
  for(const material of architecture.materials.values()){material.map=texture;material.normalMap=normal;material.roughnessMap=roughness;}
  let borrowedDisposals=0;for(const map of[texture,normal,roughness])map.addEventListener('dispose',()=>borrowedDisposals++);
  const sourceInterior=glowPanes.find(row=>row.mat.name==='Ranch | window interior');assert(sourceInterior);
  sourceInterior.mat.addEventListener('dispose',()=>borrowedDisposals++);
  const count=glowPanes.length,state=installEstateOpenStalls({THREE:T,architecture}),root=architecture.buildOpenStall(),
    glass=visible(root).find(mesh=>mesh.material.name.includes('evening window')).material;
  assert.equal(root.userData.estateOpenStall.inheritedWindowLighting,true);assert.equal(glowPanes.length,count);
  assert.equal(glass.emissive,sourceInterior.mat.color);assert.equal(glass.emissiveIntensity,.70);
  for(const row of['day','night']){sourceInterior.mat.color.copy(sourceInterior[row]);assert.deepEqual(glass.emissive.toArray(),sourceInterior[row].toArray());}
  for(const mesh of visible(root))for(const key of['map','normalMap','roughnessMap'])if(mesh.material[key])assert([texture,normal,roughness].includes(mesh.material[key]));
  const sage=visible(root).find(mesh=>mesh.material.name.includes('sage')).material,
    shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  sage.onBeforeCompile(shader);assert(shader.fragmentShader.includes('estateStallGrain'));assert(shader.fragmentShader.includes('ranchTimberSample( normalMap'));
  assert.equal(sage.customProgramCacheKey(),'estate-open-stall-sage-v1');
  state.dispose();assert.equal(borrowedDisposals,0);
});

test('shared roof has a recessed overlap instead of coincident cover surfaces at row spacing3.3m',()=>{
  const architecture=make(),state=installEstateOpenStalls({THREE:T,architecture}),a=architecture.buildOpenStall(),b=architecture.buildOpenStall();b.position.z=3.3;
  a.updateMatrixWorld(true);b.updateMatrixWorld(true);
  const roofA=visible(a).find(m=>m.material.name.includes('slate')),roofB=visible(b).find(m=>m.material.name.includes('slate'));
  for(const x of[-.67,.13,.73])for(const z of[1.57,1.61,1.66,1.71,1.74]){
    const from=[x,4,z],topA=rays([roofA],from,[0,-1,0],3)[0],topB=rays([roofB],from,[0,-1,0],3)[0];
    assert(topA&&topB);assert(topA.point.y>topB.point.y+.020,'top underlap avoids roof plane conflict');
    const bottomA=rays([roofA],[x,1,z],[0,1,0],3)[0],bottomB=rays([roofB],[x,1,z],[0,1,0],3)[0];
    assert(bottomA&&bottomB);assert(bottomB.point.y>bottomA.point.y+.004,'underside underlap avoids coincident faces');
  }
  state.dispose();
});

test('presentation RNG is restored even if an extra mesh constructor fails',()=>{
  const architecture=make(),random=Math.random,broken={...T,Mesh:class{constructor(){throw new Error('injected visual mesh failure');}}},
    state=installEstateOpenStalls({THREE:broken,architecture});
  let calls=0;const caller=()=>{calls++;return .42;};Math.random=caller;
  try{assert.throws(()=>architecture.buildOpenStall(),/injected visual mesh failure/);assert.equal(Math.random,caller);assert.equal(state.liveInstances,0);}
  finally{Math.random=random;state.dispose();}
});
