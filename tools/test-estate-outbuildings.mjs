import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.ESTATE_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const modulePath=process.env.ESTATE_MODULE||path.join(root,'assets/estate-outbuildings.mjs');
const T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')));
const {createRanchArchitecture}=await import(pathToFileURL(path.join(root,'assets/ranch-architecture.js')));
const source=fs.readFileSync(modulePath,'utf8').replace(/from '(\.\/[^']+)'/g,(_,relative)=>
  'from '+JSON.stringify(pathToFileURL(path.join(root,'assets',relative.split('?')[0])).href+
    (relative.includes('?')?'?'+relative.split('?')[1]:'')));
const {buildEstateOutbuilding,dressEstateOutbuilding,installEstateOutbuildings}=
  await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const specs=[
  {name:'summoning stall',width:4.6,depth:3.2,height:3.4,animatedDoorOpening:{width:2.3,height:2.5}},
  {name:'tack room and feed shed',width:3.2,depth:2.6,height:2.4,animatedDoorOpening:{width:.9,height:1.7}},
  {name:'old stall',width:3.4,depth:2.8,height:2.5,animatedDoorOpening:{width:1.0,height:1.8}},
  {name:'foaling barn',width:4.2,depth:3.2,height:2.9,animatedDoorOpening:{width:1.3,height:2.0}},
  {name:'offset saddlery opening',width:5.2,depth:3.4,height:3.2,animatedDoorOpening:{x:.36,width:1.1,height:1.9}},
];
const arch=()=>createRanchArchitecture({THREE:T,loadTextures:false});
const visibleMeshes=g=>g.children.filter(c=>c.isMesh&&c.visible);

test('all gameplay shell variants have finite opaque geometry, bounded roofs and true preserved door apertures',()=>{
  const architecture=arch();
  for(const spec of specs){
    let draws=0;const random=Math.random;Math.random=()=>{draws++;return .5;};
    let g;try{g=buildEstateOutbuilding({THREE:T,architecture,...spec});}finally{Math.random=random;}
    assert.equal(draws,0,spec.name+' must not consume world random values');
    const data=g.userData.estateOutbuilding;
    assert.equal(data.drawCalls,9);assert.equal(g.children.length,9);assert.equal(data.physicalSlateCourses,3);
    assert(data.triangles>4500&&data.triangles<35000,spec.name+' triangle budget '+data.triangles);
    assert(data.geometryBytes<3000000,spec.name+' geometry budget');
    assert.equal(g.userData.solidParts,undefined,'only the original root authors physics');
    const door=spec.animatedDoorOpening;
    assert.deepEqual(data.animatedDoorOpening,{x:door.x||0,width:door.width,height:door.height,bottomY:0,frontZ:spec.depth/2});
    assert.equal(data.ridgeHeight,spec.height+Math.min(1.15,spec.depth*.31));
    g.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(g);
    assert(bounds.min.x>=-spec.width/2-.33&&bounds.max.x<=spec.width/2+.33,spec.name+' width envelope');
    assert(bounds.min.z>=-spec.depth/2-.34&&bounds.max.z<=spec.depth/2+.34,spec.name+' depth envelope');
    assert(bounds.min.y>=-.041&&bounds.max.y<=data.ridgeHeight+.10,spec.name+' height envelope');
    for(const mesh of g.children){
      const geo=mesh.geometry;
      for(const[name,a]of Object.entries(geo.attributes))for(const v of a.array)assert(Number.isFinite(v),mesh.name+' '+name);
      for(const i of geo.index.array)assert(i<geo.attributes.position.count);
      const normals=geo.attributes.normal;
      for(let i=0;i<normals.count;i++)assert(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<1e-5);
      assert.equal(mesh.material.transparent,false);assert(mesh.castShadow&&mesh.receiveShadow);
    }
    // Cross the exact old front wall thickness at 25 points in each doorway.
    // The old sill/floor lies below.22 m; all usable aperture remains open.
    for(const xf of[-.46,-.25,0,.25,.46])for(const yf of[.25,.40,.60,.80,.96]){
      const x=(door.x||0)+xf*door.width,y=Math.max(.25,yf*door.height),z=spec.depth/2+.34;
      const ray=new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,0,-1),0,.65);
      assert.equal(ray.intersectObject(g,true).length,0,spec.name+' blocked door at '+x+','+y);
    }
    // Front glass must sit behind the face. A ray through a casement resolves
    // glass/recess, never an unbroken cladding panel at the former wall plane.
    for(const o of data.windows.front){
      const ray=new T.Raycaster(new T.Vector3(o.x+o.w*.18,o.y+o.h*.20,spec.depth/2+.32),new T.Vector3(0,0,-1),0,.70),hits=ray.intersectObject(g,true);
      assert(hits.length,'front casement should reveal its real inset backing');
      assert(hits[0].object.material.name.includes('glass'),spec.name+' front window is not a true recess');
      assert(hits[0].point.z<spec.depth/2-.10);
    }
    g.userData.dispose();
  }
});

test('installer keeps original collision arrays, architecture metadata, root transform, independent sibling doors and old seeded consumption',()=>{
  const architecture=arch(),spec=specs[0];
  // Observe the original root without changing its factory construction.
  const original=architecture.buildOutbuilding;let observed;
  architecture.buildOutbuilding=function(...args){const g=original.apply(this,args);g.position.set(7,2,-9);g.rotation.y=.72;
    observed={g,parts:g.userData.solidParts,partsJSON:JSON.stringify(g.userData.solidParts),architecture:g.userData.architecture,
      architectureJSON:JSON.stringify(g.userData.architecture),matrix:g.matrix.clone(),originalMeshes:g.children.slice()};return g;};
  const hookedOriginal=architecture.buildOutbuilding;
  let baselineDraws=0,wrappedDraws=0;const random=Math.random;
  try{
    Math.random=()=>{baselineDraws++;return .42;};hookedOriginal(spec);
    const state=installEstateOutbuildings({THREE:T,architecture});
    assert.equal(installEstateOutbuildings({THREE:T,architecture}),state,'installation is idempotent');
    Math.random=()=>{wrappedDraws++;return .42;};const g=architecture.buildOutbuilding(spec);
    assert.equal(wrappedDraws,baselineDraws,'extra render construction must leave the original RNG draw count intact');
    assert.equal(g,observed.g);assert.equal(g.userData.solidParts,observed.parts);
    assert.equal(JSON.stringify(g.userData.solidParts),observed.partsJSON);
    assert.equal(g.userData.architecture,observed.architecture);
    assert.equal(JSON.stringify(g.userData.architecture),observed.architectureJSON);
    assert.deepEqual(g.position.toArray(),[7,2,-9]);assert.equal(g.rotation.y,.72);
    assert(observed.originalMeshes.every(m=>m.parent===g&&!m.visible));
    assert.equal(visibleMeshes(g).length,9);assert(g.children.every(c=>!c.isGroup),'no nested batch AABB can close the aperture');
    const parent=new T.Group(),door=new T.Mesh(new T.BoxGeometry(1.14,2.5,.10),new T.MeshStandardMaterial());
    door.position.set(.57,1.25,1.62);door.rotation.y=.8;parent.add(g,door);
    const doorState={position:door.position.toArray(),rotation:door.rotation.toArray(),geometry:door.geometry,material:door.material};
    dressEstateOutbuilding({THREE:T,architecture,root:g});
    assert.equal(g.children.length,observed.originalMeshes.length+9,'dressing is idempotent');
    assert.deepEqual(door.position.toArray(),doorState.position);assert.deepEqual(door.rotation.toArray(),doorState.rotation);
    assert.equal(door.geometry,doorState.geometry);assert.equal(door.material,doorState.material);
    assert.equal(state.replacements,1);
    const village=architecture.buildOutbuilding({...spec,exterior:'village'});
    assert.equal(village.userData.estateOutbuilding,undefined);assert(village.children.every(m=>m.visible));
    assert.equal(state.replacements,1,'village facades retain their existing model');
    state.uninstall();assert.equal(architecture.buildOutbuilding,hookedOriginal);
    assert.equal(architecture.estateOutbuildings,undefined);
  }finally{Math.random=random;}
});

test('materials borrow resident texture identities, grain hook composes correctly, and disposal releases only owned resources',()=>{
  const architecture=arch(),texture=new T.Texture(),normal=new T.Texture(),roughness=new T.Texture();
  for(const material of architecture.materials.values()){material.map=texture;material.normalMap=normal;material.roughnessMap=roughness;}
  let sourceDisposed=0;for(const t of[texture,normal,roughness])t.addEventListener('dispose',()=>sourceDisposed++);
  const g=buildEstateOutbuilding({THREE:T,architecture,...specs[1]});
  for(const mesh of g.children)for(const key of['map','normalMap','roughnessMap']){
    if(mesh.material[key])assert([texture,normal,roughness].includes(mesh.material[key]),'no new texture or clone');
  }
  const timber=g.children.find(m=>m.material.name.includes('sage')).material,
    shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  timber.onBeforeCompile(shader);
  assert(shader.fragmentShader.includes('estateBoardGrain'));
  assert(shader.fragmentShader.includes('ranchTimberSample( normalMap'));
  assert.equal(timber.customProgramCacheKey(),'estate-service-sage-small-v1');
  let geometryDisposals=0,materialDisposals=0;
  for(const mesh of g.children){mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);mesh.material.addEventListener('dispose',()=>materialDisposals++);}
  const root=new T.Group();root.add(...g.children.slice());g.userData.dispose();g.userData.dispose();
  assert.equal(geometryDisposals,9);assert.equal(materialDisposals,9);assert.equal(sourceDisposed,0);
});

test('the world RNG is restored after a constructor failure as well as success',()=>{
  const architecture=arch(),random=Math.random;
  const broken={...T,MeshStandardMaterial:class{constructor(){throw Error('injected constructor failure');}}};
  assert.throws(()=>buildEstateOutbuilding({THREE:broken,architecture}),/injected constructor failure/);
  assert.equal(Math.random,random);
  assert.throws(()=>buildEstateOutbuilding({THREE:T,architecture,width:3.2,animatedDoorOpening:{width:9,height:1.7}}),/fitted/);
  assert.equal(Math.random,random);
});

test('repeated models retain distinct object and resource UUIDs without consuming world randomness',()=>{
  const architecture=arch(),random=Math.random,models=[],identities=new Set();let draws=0;
  const callerRandom=()=>{draws++;return .37;};Math.random=callerRandom;
  try{
    for(let i=0;i<8;i++){
      const g=buildEstateOutbuilding({THREE:T,architecture,...specs[i%specs.length]});models.push(g);
      const uuids=[g.uuid,...g.children.flatMap(mesh=>[mesh.uuid,mesh.geometry.uuid,mesh.material.uuid])];
      for(const uuid of uuids){assert(!identities.has(uuid),'reused generated UUID '+uuid);identities.add(uuid);}
    }
    assert.equal(draws,0,'independent UUID construction must not advance the world generator');
    assert.equal(Math.random,callerRandom,'factory must restore the caller generator');
  }finally{Math.random=random;for(const g of models)g.userData.dispose();}
  assert.equal(identities.size,8*(1+9*3));
});
