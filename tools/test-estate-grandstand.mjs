import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.ESTATE_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const modulePath=process.env.ESTATE_GRANDSTAND_MODULE||path.join(root,'assets/estate-grandstand.mjs');
const T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')));
const {createRanchArchitecture}=await import(pathToFileURL(path.join(root,'assets/ranch-architecture.js')));
const {RANCH_ROOF_PHOTO_PROFILES}=await import(pathToFileURL(path.join(root,'assets/ranch-roof-courses.mjs')));
const code=fs.readFileSync(modulePath,'utf8').replace(/from '(\.\/[^']+)'/g,(_,relative)=>
  'from '+JSON.stringify(pathToFileURL(path.join(root,'assets',relative.split('?')[0])).href+((relative.split('?')[1]&&'?'+relative.split('?')[1])||'')));
const {buildEstateGrandstand,createEstateGrandstandDresser}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const architecture=createRanchArchitecture({THREE:T,loadTextures:false});

test('estate stand has finite watertight primitives, a bounded roof, open seating and an unobstructed spectator eye line',()=>{
  const oldRandom=Math.random;let calls=0;Math.random=()=>{calls++;return .5;};
  let g;try{g=buildEstateGrandstand({THREE:T,architecture});}finally{Math.random=oldRandom;}
  assert.equal(calls,0,'model construction must not perturb world RNG');
  const receipt=g.userData.estateGrandstand;
  assert.equal(receipt.drawCalls,8);assert.equal(g.children.length,8);
  assert(receipt.triangles>5000&&receipt.triangles<30000);assert(receipt.geometryBytes<5000000);
  assert.equal(receipt.roof.type,'hipped');assert.equal(receipt.roof.ridgeHeight,4.82);assert(receipt.roof.physicalCourses>60);
  assert.deepEqual(receipt.supportPoints,[-5.85,-1.8,1.8,5.85].flatMap(x=>[.35,-3.15].map(z=>[x,z])));
  assert.deepEqual(receipt.deckLevels,[.18,.62,1.06]);assert.equal(receipt.centreAisleWidth,1.10);
  assert.equal(g.userData.solidParts,undefined,'original builder root retains all collision authority');
  g.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(g);
  assert(bounds.min.x>=-6.56&&bounds.max.x<=6.56);
  assert(bounds.min.z>=-3.88&&bounds.max.z<=1.08);
  assert(bounds.min.y>=-.061&&bounds.max.y<=4.90);
  for(const mesh of g.children){
    const geometry=mesh.geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
    for(const[attr,a]of Object.entries(geometry.attributes))for(const v of a.array)assert(Number.isFinite(v),mesh.name+' '+attr);
    for(const i of geometry.index.array)assert(i<p.count);
    for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
    for(let i=0;i<geometry.index.count;i+=3){
      const ids=[0,1,2].map(k=>geometry.index.getX(i+k)),vertices=ids.map(k=>new T.Vector3().fromBufferAttribute(p,k));
      const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
      assert(normal.length()>1e-9,'no degenerate faces in '+mesh.name);
      const sum=new T.Vector3();for(const id of ids)sum.add(new T.Vector3().fromBufferAttribute(n,id));
      assert(normal.dot(sum)>0,'outward geometry winding in '+mesh.name);
    }
    assert.equal(mesh.material.transparent,false);assert(mesh.castShadow&&mesh.receiveShadow);
    assert.equal(geometry.userData.estateGrandstandResident,true,'shared geometry must survive template retirement');
  }
  for(const start of[[0,3,-3],[0,2.72,-3],[0,2.30,-2.65]]){
    const ray=new T.Raycaster(new T.Vector3(...start),new T.Vector3(7.5,-1.5,28.5).normalize(),0,10);
    assert.equal(ray.intersectObject(g,true).length,0,'seated eye line must face arena unobstructed');
  }
  // The staircase keeps a body-height clear lane above the existing treads.
  for(let i=0;i<5;i++)for(const x of[-.43,0,.43]){
    const h=.18+i*.22,z=.45-i*.55;
    const ray=new T.Raycaster(new T.Vector3(x,h+.09,z),new T.Vector3(0,1,0),0,2.0);
    assert.equal(ray.intersectObject(g,true).length,0,'central staircase headroom');
  }
  // The two long planes and both real hips drain from ridge to all four eaves.
  const roof=g.children.filter(o=>/slate|forged iron/.test(o.material.name));
  function roofY(x,z){const ray=new T.Raycaster(new T.Vector3(x,6,z),new T.Vector3(0,-1,0),0,3);return ray.intersectObjects(roof,true)[0]?.point.y;}
  assert(roofY(0,-1.4)-roofY(0,.91)>.70);
  assert(roofY(0,-1.4)-roofY(0,-3.71)>.70);
  assert(roofY(4.05,-1.4)-roofY(6.44,-1.4)>.70);
  assert(roofY(-4.05,-1.4)-roofY(-6.44,-1.4)>.70);
  const oak=g.children.find(o=>o.material.name.includes('oak')).geometry.attributes.position;
  for(let i=0;i<oak.count;i++)if(oak.getY(i)>4.04){
    const top=4.04+.78*Math.min(1,(6.50-Math.abs(oak.getX(i)))/2.35,(2.35-Math.abs(oak.getZ(i)+1.4))/2.35);
    assert(oak.getY(i)<top-.095,'timber truss must stay beneath all hipped roof faces '+JSON.stringify([oak.getX(i),oak.getY(i),oak.getZ(i),top]));
  }
  const slate=g.children.find(o=>o.material.name.includes('slate')).geometry,p=slate.attributes.position,u=slate.attributes.uv;
  let photographedLaps=0;
  for(let i=0;i<p.count;i++){
    const t=1-Math.abs(p.getZ(i)+1.4)/2.35,above=p.getY(i)-(4.04+.78*t);
    if(above<.0139||above>.0141||t<1e-5||t>1-1e-5||slate.attributes.normal.getY(i)<.5)continue;
    const imageY=((1-u.getY(i))%1+1)%1*1024;
    assert(Math.min(...RANCH_ROOF_PHOTO_PROFILES.slate.butts.map(v=>Math.abs(v-imageY)))<.004,'physical slate butt follows photographed row phase');
    photographedLaps++;
  }
  assert(photographedLaps>60);
  const sage=g.children.find(o=>o.material.name.includes('sage')).material;
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  sage.onBeforeCompile(shader);assert(shader.fragmentShader.includes('estateGrain'));assert(shader.fragmentShader.includes('ranchTimberSample( normalMap'));
  g.userData.dispose();
});

test('template dressing preserves the authored collision records, pose, UUID and open-root layout while sharing resources through reload and ghosts',()=>{
  const original=new T.Group(),oldMesh=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial());original.add(oldMesh);
  original.userData.solidParts=[{min:[-.55,0,-.4],max:[.55,.18,.4],matrix:new T.Matrix4().toArray()}];
  original.userData.arenaArt={kind:'grandstand',version:1,seatRows:3};
  original.position.set(-28.5,.7,7.5);original.rotation.y=Math.PI/2;original.scale.set(1.2,.95,1.2);
  const state={uuid:original.uuid,position:original.position.toArray(),quaternion:original.quaternion.toArray(),scale:original.scale.toArray(),parts:original.userData.solidParts,partsJSON:JSON.stringify(original.userData.solidParts)};
  const dresser=createEstateGrandstandDresser({THREE:T,architecture}),previous=Math.random;let calls=0;
  Math.random=()=>{calls++;return .5;};
  try{assert.equal(dresser(original),original);dresser(original);}finally{Math.random=previous;}
  assert.equal(calls,0,'decoration and cloning must not perturb future procedural placements');
  assert.equal(original.uuid,state.uuid);assert.deepEqual(original.position.toArray(),state.position);assert.deepEqual(original.quaternion.toArray(),state.quaternion);assert.deepEqual(original.scale.toArray(),state.scale);
  assert.equal(original.userData.solidParts,state.parts);assert.equal(JSON.stringify(original.userData.solidParts),state.partsJSON);
  assert.deepEqual(original.userData.arenaArt,{kind:'grandstand',version:1,seatRows:3});
  assert.equal(oldMesh.visible,false);assert.equal(original.children.length,9);assert(original.children.every(c=>c.isMesh));
  const rebuiltTemplate=new T.Group();dresser(rebuiltTemplate);
  assert.equal(rebuiltTemplate.children.length,8);
  for(let i=0;i<8;i++){
    assert.equal(rebuiltTemplate.children[i].geometry,original.children[i+1].geometry);
    assert.equal(rebuiltTemplate.children[i].material,original.children[i+1].material);
  }
  const allGeometry=new Set(original.children.map(c=>c.geometry));let retired=0;
  for(const g of allGeometry)g.addEventListener('dispose',()=>retired++);
  // Exact proposed factory retirement policy, while the rebuilt template lives.
  original.traverse(o=>{if(o.isMesh&&!o.geometry.userData.builderScan&&!o.geometry.userData.estateGrandstandResident)o.geometry.dispose();});
  assert.equal(retired,1,'only old fallback geometry retires');
  const ghost=rebuiltTemplate.clone(true);
  for(let i=0;i<8;i++){
    assert.equal(ghost.children[i].geometry,rebuiltTemplate.children[i].geometry);
    const material=ghost.children[i].material.clone();material.transparent=true;material.opacity=.48;material.depthWrite=false;ghost.children[i].material=material;
    assert.equal(ghost.children[i].geometry,original.children[i+1].geometry);
  }
  dresser.dispose();assert.equal(retired,9);dresser.dispose();assert.equal(retired,9);
});

test('construction errors always restore the caller RNG function',()=>{
  const random=Math.random;
  assert.throws(()=>buildEstateGrandstand({THREE:{...T,Group:class{constructor(){throw Error('expected failure');}}},architecture}),/expected failure/);
  assert.equal(Math.random,random);
});

test('factory copies and resident ghost material conversion preserve the original UUID stream and keep new object UUIDs unique',()=>{
  const source=new T.Group();source.userData.solidParts=[{min:[-.1,0,-.1],max:[.1,3,.1],matrix:new T.Matrix4().toArray()}];
  const legacyA=new T.Mesh(new T.BoxGeometry(.2,3,.2),new T.MeshStandardMaterial());
  const legacyGroup=new T.Group(),legacyB=new T.Mesh(new T.BoxGeometry(.8,.1,.4),new T.MeshStandardMaterial());legacyGroup.add(legacyB);source.add(legacyA,legacyGroup);
  const originalTemplate=source.clone(true),dresser=createEstateGrandstandDresser({THREE:T,architecture});dresser(source);
  function seeded(fn){
    const random=Math.random;let state=0x39479341,calls=0;
    Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    try{const result=fn(),consumed=calls,future=Array.from({length:32},()=>Math.random());return{result,calls:consumed,future};}finally{Math.random=random;}
  }
  const baseline=seeded(()=>originalTemplate.clone(true)),candidate=seeded(()=>dresser.clone(source));
  assert.equal(candidate.calls,baseline.calls);assert.deepEqual(candidate.future,baseline.future);
  assert.equal(candidate.result.uuid,baseline.result.uuid);
  assert.equal(candidate.result.children[0].uuid,baseline.result.children[0].uuid);
  assert.equal(candidate.result.children[1].uuid,baseline.result.children[1].uuid);
  assert.equal(candidate.result.children[1].children[0].uuid,baseline.result.children[1].children[0].uuid);
  assert.deepEqual(candidate.result.userData.solidParts,baseline.result.userData.solidParts);
  const resident=candidate.result.children.filter(c=>c.geometry?.userData.estateGrandstandResident),again=dresser.clone(source).children.filter(c=>c.geometry?.userData.estateGrandstandResident);
  assert.equal(resident.length,8);assert.equal(new Set([...resident,...again].map(c=>c.uuid)).size,16);
  for(let i=0;i<8;i++){assert.equal(resident[i].geometry,again[i].geometry);assert.equal(resident[i].material,again[i].material);}
  function ghostCopy(template,enhanced){
    const out=enhanced?dresser.clone(template):template.clone(true),ghosts=new Map();
    out.traverse(o=>{
      if(!o.isMesh)return;
      const m=o.material;
      if(!ghosts.has(m)){
        const c=enhanced&&o.geometry.userData.estateGrandstandResident?dresser.isolated(()=>m.clone()):m.clone();
        c.transparent=true;c.opacity=.48;c.depthWrite=false;c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;ghosts.set(m,c);
      }
      o.material=ghosts.get(m);
    });
    return out;
  }
  const oldGhost=seeded(()=>ghostCopy(originalTemplate,false)),newGhost=seeded(()=>ghostCopy(source,true));
  assert.equal(newGhost.calls,oldGhost.calls);assert.deepEqual(newGhost.future,oldGhost.future);
  assert.equal(newGhost.result.uuid,oldGhost.result.uuid);
  assert.equal(newGhost.result.children[0].material.uuid,oldGhost.result.children[0].material.uuid);
  assert.equal(newGhost.result.children[1].children[0].material.uuid,oldGhost.result.children[1].children[0].material.uuid);
  const newMaterials=newGhost.result.children.filter(c=>c.geometry?.userData.estateGrandstandResident).map(c=>c.material);
  assert.equal(new Set(newMaterials.map(m=>m.uuid)).size,8);
  const previous=Math.random;
  assert.throws(()=>dresser.isolated(()=>{throw Error('expected clone failure');}),/expected clone failure/);assert.equal(Math.random,previous);
  const originalClone=source.children.at(-1).clone;source.children.at(-1).clone=()=>{throw Error('expected resident failure');};
  assert.throws(()=>dresser.clone(source),/expected resident failure/);assert.equal(Math.random,previous);source.children.at(-1).clone=originalClone;
  dresser.dispose();
});
