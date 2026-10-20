import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.ESTATE_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const modulePath=process.env.ESTATE_SHELTERS_MODULE||path.join(root,'assets/estate-shelters.mjs');
const T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')));
const {createRanchArchitecture}=await import(pathToFileURL(path.join(root,'assets/ranch-architecture.js')));
const moduleCode=fs.readFileSync(modulePath,'utf8').replace(/from '(\.\/[^']+)'/g,(_,rel)=>'from '+JSON.stringify(pathToFileURL(path.join(root,'assets',rel.split('?')[0])).href+(rel.includes('?')?'?'+rel.split('?')[1]:'')));
const {buildEstateShelter,createEstateShelterDresser}=await import('data:text/javascript;base64,'+Buffer.from(moduleCode).toString('base64'));
const architecture=createRanchArchitecture({THREE:T,loadTextures:false});

function seeded(fn){
  const previous=Math.random;let state=0x30205030,calls=0;
  Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  try{const result=fn(),consumed=calls,future=Array.from({length:32},()=>Math.random());return{result,calls:consumed,future};}finally{Math.random=previous;}
}
function ray(root,origin,direction,far){return new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction),0,far).intersectObject(root,true);}

for(const type of['shelter','stall'])test(type+' has bounded finite batched geometry, old mono-pitch roof and the intended open front',()=>{
  const result=seeded(()=>buildEstateShelter({THREE:T,architecture,type})),g=result.result,r=g.userData.estateShelter;
  assert.equal(result.calls,0,'new construction must leave world randomness untouched');
  assert.equal(r.kind,type);assert.equal(r.drawCalls,8);assert.equal(g.children.length,8);
  assert(r.triangles>6000&&r.triangles<35000);assert(r.geometryBytes<4500000);
  assert.equal(g.userData.solidParts,undefined,'authored old root keeps body and camera authority');
  assert.deepEqual(r.roof.centre,[0,3.31,0]);assert.equal(r.roof.rotationX,-.07);
  assert.equal(r.roof.width,4.5);assert.equal(r.roof.depth,3.75);assert.equal(r.roof.height,.12);
  assert(r.roof.courses.rows>25);assert(r.roof.courses.joints>20);assert.equal(r.roof.courses.style,'slate');
  g.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(g);
  assert(bounds.min.x>=-2.276&&bounds.max.x<=2.276);
  assert(bounds.min.y>=-.046&&bounds.max.y<=3.51);
  assert(bounds.min.z>=-1.947&&bounds.max.z<=1.914);
  for(const mesh of g.children){
    const geo=mesh.geometry,p=geo.attributes.position,n=geo.attributes.normal;
    assert.equal(geo.userData.estateShelterResident,true);assert(mesh.castShadow&&mesh.receiveShadow);
    assert.equal(mesh.material.transparent,false,'opaque panes never create full transparent cards');
    for(const[attr,a]of Object.entries(geo.attributes))for(const v of a.array)assert(Number.isFinite(v),attr+' in '+mesh.name);
    for(const i of geo.index.array)assert(i<p.count);
    for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
    for(let i=0;i<geo.index.count;i+=3){
      const ids=[0,1,2].map(k=>geo.index.getX(i+k)),v=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j));
      const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])),sum=new T.Vector3();
      assert(normal.length()>1e-10,'no degenerate triangle '+mesh.name);
      for(const j of ids)sum.add(new T.Vector3().fromBufferAttribute(n,j));
      assert(normal.dot(sum)>0,'outward winding '+mesh.name);
    }
  }
  // Body and follow-camera approach above the old slab keep an open right bay.
  for(const x of[0,.50,1,1.55])for(const y of[.40,1.05,1.75,2.45,2.85])
    assert.equal(ray(g,[x,y,2.20],[0,0,-1],2.20).length,0,'clear front/right bay '+[x,y]);
  if(type==='shelter')for(const x of[-1.5,-.75])for(const y of[.4,1,1.65,2.45])
    assert.equal(ray(g,[x,y,2.20],[0,0,-1],2.20).length,0,'run-in full-width approach');
  if(type==='stall'){
    assert(ray(g,[-1,.75,2.20],[0,0,-1],.65).length>0,'existing left half-door stays visibly closed');
    for(const x of[-1.5,-1,-.5])assert.equal(ray(g,[x,1.25,2.20],[0,0,-1],1.5).length,0,'clear above the retained low door');
  }
  const slate=g.children.find(o=>o.material.name.includes('slate')),p=slate.geometry.attributes.position;
  const inverse=new T.Matrix4().makeRotationX(.07).multiply(new T.Matrix4().makeTranslation(0,-3.31,0));
  for(let i=0;i<p.count;i++){
    const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(inverse);
    assert(Math.abs(v.x)<=2.250001&&Math.abs(v.z)<=1.875001&&v.y<=.060001&&v.y>=-.060001,'cover relief inside exact old roof box');
  }
  const low=ray(slate,[0,4,-1.72],[0,-1,0],1)[0].point.y,high=ray(slate,[0,4,1.72],[0,-1,0],1)[0].point.y;
  assert(high-low>.22&&high-low<.26,'the former roof slope and runoff direction are retained');
  const material=g.children.find(o=>o.material.name.includes('sage')).material;
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('estateShelterGrain'));assert(shader.fragmentShader.includes('ranchTimberSample( normalMap'));
  g.userData.dispose();
});

test('nested old divider geometry/proxies remain while residents share resources across reload and dispose once',()=>{
  const root=new T.Group(),nested=new T.Group(),oldMaterial=new T.MeshStandardMaterial();
  const oldDirect=new T.Mesh(new T.BoxGeometry(1,1,1),oldMaterial),oldNested=new T.Mesh(new T.BoxGeometry(.085,1.5,3.25),oldMaterial);nested.add(oldNested);root.add(oldDirect,nested);
  root.userData.solidParts=[{min:[-2.085,0,1.54],max:[-1.915,3.25,1.71],matrix:new T.Matrix4().toArray()}];
  root.position.set(-59,.7,-19);root.rotation.y=2.2;root.scale.x=1.5;
  const previous={uuid:root.uuid,pose:[root.position.toArray(),root.quaternion.toArray(),root.scale.toArray()],parts:root.userData.solidParts,json:JSON.stringify(root.userData)};
  const dresser=createEstateShelterDresser({THREE:T,architecture});
  assert.equal(seeded(()=>dresser(root)).calls,0);dresser(root);
  assert.equal(root.uuid,previous.uuid);assert.deepEqual([root.position.toArray(),root.quaternion.toArray(),root.scale.toArray()],previous.pose);
  assert.equal(root.userData.solidParts,previous.parts);assert.equal(oldDirect.visible,false);assert.equal(oldNested.visible,false);
  assert.equal(root.children[1],nested);assert.equal(nested.children[0],oldNested);assert.equal(root.children.length,10);
  const reloaded=new T.Group();dresser(reloaded);
  for(let i=0;i<8;i++){assert.equal(root.children[i+2].geometry,reloaded.children[i].geometry);assert.equal(root.children[i+2].material,reloaded.children[i].material);}
  let retired=0,materialDisposed=0;const shared=new Set(root.children.filter(o=>o.isMesh).map(o=>o.geometry));shared.add(oldNested.geometry);
  for(const g of shared)g.addEventListener('dispose',()=>retired++);
  for(const m of new Set(reloaded.children.map(o=>o.material)))m.addEventListener('dispose',()=>materialDisposed++);
  root.traverse(o=>{if(o.isMesh&&!o.geometry.userData.builderScan&&!o.geometry.userData.estateGrandstandResident&&!o.geometry.userData.estateShelterResident)o.geometry.dispose();});
  assert.equal(retired,2,'only the legacy fallback geometries retire');
  dresser.dispose();assert.equal(retired,10);assert.equal(materialDisposed,8);dresser.dispose();assert.equal(retired,10);
  assert.throws(()=>dresser.clone(root),/disposed/);assert.throws(()=>dresser(root),/disposed/);
});

test('template and ghost clones preserve every legacy RNG draw while new resident UUIDs remain unique',()=>{
  const root=new T.Group(),nested=new T.Group(),oldA=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial()),oldB=new T.Mesh(new T.BoxGeometry(.085,1.5,3.25),new T.MeshStandardMaterial());
  nested.add(oldB);root.add(oldA,nested);root.userData.solidParts=[{min:[0,0,0],max:[1,1,1],matrix:new T.Matrix4().toArray()}];
  const baseline=root.clone(true),dresser=createEstateShelterDresser({THREE:T,architecture});dresser(root,'stall');
  const oldClone=seeded(()=>baseline.clone(true)),newClone=seeded(()=>dresser.clone(root));
  assert.equal(newClone.calls,oldClone.calls);assert.deepEqual(newClone.future,oldClone.future);
  for(const path of[[],[0],[1],[1,0]]){
    let a=oldClone.result,b=newClone.result;for(const index of path){a=a.children[index];b=b.children[index];}assert.equal(a.uuid,b.uuid);
  }
  assert.deepEqual(newClone.result.userData.solidParts,oldClone.result.userData.solidParts);
  const next=dresser.clone(root),residents=[...newClone.result.children,...next.children].filter(o=>o.geometry?.userData.estateShelterResident);
  assert.equal(residents.length,16);assert.equal(new Set(residents.map(o=>o.uuid)).size,16,'persistent independent stream never repeats resident identities');
  function ghost(template,enhanced){
    const out=enhanced?dresser.clone(template):template.clone(true),cache=new Map();
    out.traverse(o=>{if(!o.isMesh)return;const m=o.material;if(!cache.has(m)){
      const copy=enhanced&&o.geometry.userData.estateShelterResident?dresser.isolated(()=>m.clone()):m.clone();
      copy.transparent=true;copy.opacity=.48;copy.depthWrite=false;copy.onBeforeCompile=m.onBeforeCompile;copy.customProgramCacheKey=m.customProgramCacheKey;cache.set(m,copy);
    }o.material=cache.get(m);});return out;
  }
  const oldGhost=seeded(()=>ghost(baseline,false)),newGhost=seeded(()=>ghost(root,true));
  assert.equal(newGhost.calls,oldGhost.calls);assert.deepEqual(newGhost.future,oldGhost.future);
  assert.equal(newGhost.result.children[0].material.uuid,oldGhost.result.children[0].material.uuid);
  assert.equal(newGhost.result.children[1].children[0].material.uuid,oldGhost.result.children[1].children[0].material.uuid);
  for(const child of newGhost.result.children.filter(o=>o.geometry?.userData.estateShelterResident)){
    assert(child.material.transparent);assert.equal(child.material.depthWrite,false);assert.equal(child.material.opacity,.48);
    const original=root.children.find(o=>o.geometry===child.geometry).material;
    assert.equal(child.material.onBeforeCompile,original.onBeforeCompile);assert.equal(child.material.customProgramCacheKey,original.customProgramCacheKey);
  }
  const random=Math.random;
  assert.throws(()=>dresser.isolated(()=>{throw Error('expected failure');}),/expected failure/);assert.equal(Math.random,random);
  const originalClone=root.children.at(-1).clone;root.children.at(-1).clone=()=>{throw Error('expected resident failure');};
  assert.throws(()=>dresser.clone(root),/expected resident failure/);assert.equal(Math.random,random);root.children.at(-1).clone=originalClone;
  dresser.dispose();
});

test('borrowed textures never become owned/disposed and constructor failure restores caller RNG',()=>{
  const fakeArchitecture=createRanchArchitecture({THREE:T,loadTextures:false}),resident=new T.Texture();let disposed=0;resident.addEventListener('dispose',()=>disposed++);
  for(const material of fakeArchitecture.materials.values())material.map=resident;
  const strawMaterial=fakeArchitecture.materials.get('Ranch | oiled oak doors');
  const g=buildEstateShelter({THREE:T,architecture:fakeArchitecture,strawMaterial});assert(g.children.filter(o=>o.material.map===resident).length>=5);
  assert.equal(g.children.find(o=>o.material.name.includes('oat fibres')).material.map,resident);
  g.userData.dispose();assert.equal(disposed,0);
  const random=Math.random;
  assert.throws(()=>buildEstateShelter({THREE:{...T,Group:class{constructor(){throw Error('expected constructor failure');}}},architecture}),/expected constructor failure/);
  assert.equal(Math.random,random);
  assert.throws(()=>buildEstateShelter({THREE:T,architecture,type:'other'}),/shelter or stall/);
});
