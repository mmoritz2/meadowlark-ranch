import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import {register} from 'node:module';
register(new URL('./fixtures/three-workshop-loader.mjs',import.meta.url));
const {createRanchBuilderArt}=await import('../assets/ranch-builder-art.js');
import {dressTimberBox,installLimedTimberFinish} from '../assets/ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {setTimberBoxUV,applyTimberGrain} from '../assets/timber-cladding.mjs?v=timber-cladding-1';
import {recordSolidPart,createSolidWorld} from '../assets/solid-collisions.js?v=solid-world-1';
const {mergeGeometries}=await import('../assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js');
import {createDeferredLoad} from '../assets/deferred-load.js';
import {applySaplingSnowShader} from '../assets/sapling-snow.mjs?v=nursery-snow-1';

const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/ranch-model-b5d22a6/ranch-timber-contract.json',import.meta.url)));
const baseline=rel=>{const s=fs.readFileSync(new URL('./fixtures/ranch-model-b5d22a6/'+rel,import.meta.url),'utf8');assert.equal(crypto.createHash('sha256').update(s).digest('hex'),contract.originalSHA256['assets/'+rel]);return s;};
const originalArchitecture=new Function('setTimberBoxUV','applyTimberGrain','recordSolidPart','return ('+baseline('ranch-architecture.js').split('export function ')[1].replace(/^createRanchArchitecture/,'function createRanchArchitecture')+');')(setTimberBoxUV,applyTimberGrain,recordSolidPart);
const originalBuilder=new Function('setTimberBoxUV','applyTimberGrain','recordSolidPart','mergeGeometries','createDeferredLoad','applySaplingSnowShader','return ('+baseline('ranch-builder-art.js').split('export function ')[1].replace(/^createRanchBuilderArt/,'function createRanchBuilderArt')+');')(setTimberBoxUV,applyTimberGrain,recordSolidPart,mergeGeometries,createDeferredLoad,applySaplingSnowShader);
const seeded=fn=>{const previous=Math.random;let state=0xa625d713,calls=0;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const result=fn(),used=calls,future=Array.from({length:32},()=>Math.random());return{result,calls:used,future};}finally{Math.random=previous;}};
const meshList=root=>{const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
const measured=root=>{let triangles=0,bytes=0;const meshes=meshList(root);for(const m of meshes){const g=m.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;bytes+=(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0);}return{draws:meshes.length,triangles,attributeIndexBytes:bytes};};
const constructors=[
 ['barn',f=>f.buildBarn()],['open-stall',f=>f.buildOpenStall()],
 ['cottage-0',f=>f.buildCottage()],['cottage-1',f=>f.buildCottage({variant:1})],
 ['townhouse',f=>f.buildTownhouse()],['shop',f=>f.buildTownhouse({store:true,width:6.1,depth:4.4})],
 ['coaching-inn',f=>f.buildCoachingInn()],['outbuilding',f=>f.buildOutbuilding()],
 ['short-open-outbuilding',f=>f.buildOutbuilding({width:3.2,depth:2.6,height:2.4,animatedDoorOpening:{width:.9,height:1.7}})],
 ['marsh-0',f=>f.buildMarshHouse()],['marsh-1',f=>f.buildMarshHouse({variant:1})],
 ['run-in',f=>f.detailRunIn(new T.Group())],
];
let pair;
test('all twelve real building variants keep UUID stream, material draws, exact physical snapshots, roots and non-siding surfaces',()=>{
 const make=factory=>seeded(()=>{const f=factory({THREE:T,loadTextures:false});return{factory:f,buildings:constructors.map(([name,build])=>({name,root:build(f)}))};});
 const a=make(originalArchitecture),b=make(createRanchArchitecture);pair={a:a.result,b:b.result};
 assert.equal(b.calls,a.calls);assert.deepEqual(b.future,a.future);
 for(let k=0;k<constructors.length;k++){
  const before=a.result.buildings[k].root,after=b.result.buildings[k].root;
  assert.equal(after.uuid,before.uuid);assert.deepEqual(after.userData.solidParts,before.userData.solidParts);
  assert.deepEqual(after.position,before.position);assert.deepEqual(after.quaternion.toArray(),before.quaternion.toArray());assert.deepEqual(after.scale,before.scale);
  const am=meshList(before),bm=meshList(after);assert.equal(bm.length,am.length);
  assert.deepEqual(new T.Box3().setFromObject(after),new T.Box3().setFromObject(before));
  for(let j=0;j<am.length;j++){
   const x=am[j],y=bm[j];assert.equal(y.uuid,x.uuid);assert.equal(y.geometry.uuid,x.geometry.uuid);assert.equal(y.material.uuid,x.material.uuid);assert.equal(y.material.name,x.material.name);
   assert.equal(y.castShadow,x.castShadow);assert.equal(y.receiveShadow,x.receiveShadow);
   if(x.material!==a.result.factory.sidingMaterial){assert.deepEqual(y.geometry.index?.array,x.geometry.index?.array);for(const attr of Object.keys(x.geometry.attributes))assert.deepEqual(y.geometry.attributes[attr].array,x.geometry.attributes[attr].array);}
  }
  const old=measured(before),now=measured(after);assert.equal(now.draws,old.draws);assert(now.triangles>=old.triangles);assert(now.triangles<15000);assert(now.triangles-old.triangles<10000);
 }
});

test('authored siding consists of closed disconnected solid boards, real planar normals and metre grain rather than texture-only grooves',()=>{
 for(const spec of [{width:7,height:3.62,depth:.18,x:0,y:1.81,z:2.7},{width:1.81,height:.52,depth:.085,x:-1.1,y:.3,z:.6},{width:.038,height:3.4,depth:.029,x:.9,y:1.7,z:0}]){
  const g=new T.BoxGeometry(spec.width,spec.height,spec.depth),id=g.uuid,previous=Math.random;Math.random=()=>{throw Error('Presentation geometry consumes gameplay RNG');};
  try{dressTimberBox(T,g,{...spec,radius:.003,siding:true,lengthMetres:2.4});}finally{Math.random=previous;}
  assert.equal(g.uuid,id);const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;assert.equal(n.count,p.count);assert.equal(u.count,p.count);
  const vertices=new Map(),edges=new Map(),adjacency=new Map();let faceCount=0;
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].join(',');
  for(let i=0;i<g.index.count;i+=3){
   const ids=[0,1,2].map(k=>g.index.getX(i+k)),v=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j)),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));assert(normal.length()>1e-9);normal.normalize();faceCount++;
   for(const j of ids){const nv=new T.Vector3().fromBufferAttribute(n,j);assert(Math.abs(nv.length()-1)<1e-6);assert(normal.dot(nv)>.99999);assert(Number.isFinite(u.getX(j))&&Number.isFinite(u.getY(j)));vertices.set(key(j),j);if(Math.abs(nv.z)>.99999){assert(Math.abs(u.getX(j)-(p.getY(j)+spec.y)/2.4)<2e-7);}}
   for(let j=0;j<3;j++){const a=key(ids[j]),b=key(ids[(j+1)%3]),e=[a,b].sort().join('|');edges.set(e,(edges.get(e)||0)+1);if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a).add(b);adjacency.get(b).add(a);}
  }
  assert([...edges.values()].every(count=>count===2),'each board is a watertight closed solid');
  const visited=new Set();let components=0;for(const key of vertices.keys())if(!visited.has(key)){components++;const pending=[key];while(pending.length){const at=pending.pop();if(visited.has(at))continue;visited.add(at);pending.push(...adjacency.get(at));}}
  if(spec.width>1)assert(components>=6,'wide panel has multiple physically separated boards');else assert.equal(components,1);
  assert.equal(faceCount,components*44);assert.deepEqual(g.boundingBox.min.toArray(),[-spec.width/2,-spec.height/2,-spec.depth/2].map(Math.fround));assert.deepEqual(g.boundingBox.max.toArray(),[spec.width/2,spec.height/2,spec.depth/2].map(Math.fround));
 }
});

test('every actual new siding face remains finite, nondegenerate, outward, UV-complete, and inside the unchanged model bounds',()=>{
 assert(pair);for(let i=0;i<pair.b.buildings.length;i++)for(const m of meshList(pair.b.buildings[i].root))if(m.material===pair.b.factory.sidingMaterial){const g=m.geometry,p=g.attributes.position,n=g.attributes.normal;
  assert.equal(n.count,p.count);assert.equal(g.attributes.uv.count,p.count);for(const a of Object.values(g.attributes))assert(Array.from(a.array).every(Number.isFinite));
  for(let j=0;j<g.index.count;j+=3){const ids=[0,1,2].map(k=>g.index.getX(j+k)),v=ids.map(k=>new T.Vector3().fromBufferAttribute(p,k)),cross=v[1].sub(v[0]).cross(v[2].sub(v[0]));assert(cross.length()>1e-9);const sum=new T.Vector3();for(const id of ids)sum.add(new T.Vector3().fromBufferAttribute(n,id));assert(cross.dot(sum)>0);}
 }
});

test('actual transformed mounted contacts remain exact around every building; barn inset bays and door/window depth stay clear',()=>{
 const mounted={radius:.55,bottom:2.38,top:4.65};
 for(let k=0;k<constructors.length;k++){
  const a=pair.a.buildings[k].root,b=pair.b.buildings[k].root;for(const root of [a,b]){root.position.set(76,2,-74);root.rotation.y=.61;root.updateMatrixWorld(true);}
  const wa=createSolidWorld({THREE:T}),wb=createSolidWorld({THREE:T});wa.register(a,{primitives:true});wb.register(b,{primitives:true});assert.deepEqual(wb.stats(),wa.stats());
  for(let x=-8;x<=8;x+=.57)for(let z=-6;z<=6;z+=.61){const w=a.localToWorld(new T.Vector3(x,0,z)),pa={x:w.x,z:w.z},pb={...pa};const ca=wa.resolve(pa,mounted),cb=wb.resolve(pb,mounted);assert.equal(cb,ca);assert.deepEqual(pb,pa);}
 }
 const barn=createRanchArchitecture({THREE:T,loadTextures:false}).buildBarn();barn.updateMatrixWorld(true);const solid=createSolidWorld({THREE:T});solid.register(barn,{primitives:true});
 for(const x of [-2.23,0,2.23])for(let z=3.8;z>=2.449;z-=.05)assert.equal(solid.resolve({x,z},{radius:.55,bottom:.38,top:2.65}),0);
 const ray=(x,y)=>new T.Raycaster(new T.Vector3(x,y,6),new T.Vector3(0,0,-1)).intersectObject(barn,true)[0];const door=ray(.35,1.4);assert.equal(door.object.material.name,'Ranch | oiled oak doors');assert(door.point.z>1.60&&door.point.z<1.9);for(const x of [-2.30,2.30]){const window=ray(x+.06,2.4);assert(window.point.z>1.5&&window.point.z<1.8);}
});

globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
const FakeT={...T,TextureLoader:class{load(){return new T.Texture();}}};
const builderTypes=['fence','stall','shelter','haybale','post','barrel','stump','planter','grandstand','judges_pavilion','windmill_tower','windmill_rotor'];
test('real architecture→builder order retains original mapped colors and composes a bounded pigment finish, while every placed and preview geometry remains shared and identical',()=>{
 const Loader=class{loadAsync(){throw Error('Deferred loader must not start');}};
 const make=(architecture,builder)=>seeded(()=>{const a=architecture({THREE:FakeT}),b=builder({THREE:FakeT,GLTFLoader:Loader,architecture:a,deferModels:true});return{a,b,roots:builderTypes.flatMap(type=>[b.create(type),b.create(type,true),b.create(type,true)])};});
 const a=make(originalArchitecture,originalBuilder),b=make(createRanchArchitecture,createRanchBuilderArt);assert.equal(b.calls,a.calls);assert.deepEqual(b.future,a.future);assert.equal(b.result.b.loaded,false);assert.equal(b.result.b.errors.length,0);
 for(let i=0;i<a.result.roots.length;i++){
  const x=a.result.roots[i],y=b.result.roots[i];assert.deepEqual(y.userData,x.userData);const xm=meshList(x),ym=meshList(y);assert.equal(ym.length,xm.length);for(let j=0;j<xm.length;j++){assert.equal(ym[j].geometry.uuid,xm[j].geometry.uuid);assert.equal(ym[j].material.uuid,xm[j].material.uuid);assert.deepEqual(ym[j].geometry.index?.array,xm[j].geometry.index?.array);for(const attr of Object.keys(xm[j].geometry.attributes))assert.deepEqual(ym[j].geometry.attributes[attr].array,xm[j].geometry.attributes[attr].array);}
 }
 for(let i=0;i<b.result.roots.length;i+=3){const placed=meshList(b.result.roots[i]),ghost=meshList(b.result.roots[i+1]),again=meshList(b.result.roots[i+2]);assert.equal(b.result.roots[i+1].userData.collisionIgnore,true);for(let k=0;k<placed.length;k++){assert.equal(ghost[k].geometry,placed[k].geometry);assert.equal(again[k].geometry,placed[k].geometry);assert.equal(again[k].material,ghost[k].material);assert(ghost[k].material.transparent&&ghost[k].material.opacity<=.48);assert.equal(ghost[k].material.depthWrite,false);}}
 for(const [name,m]of b.result.a.materials){const old=a.result.a.materials.get(name);for(const slot of ['map','normalMap','roughnessMap','aoMap'])assert.equal(m[slot]?.uuid,old[slot]?.uuid);assert.equal(m.roughness,old.roughness);assert.deepEqual(m.color,old.color);if(m!==b.result.a.sidingMaterial){assert.equal(m.onBeforeCompile.toString(),old.onBeforeCompile.toString());assert.equal(m.customProgramCacheKey(),old.customProgramCacheKey());}else{assert.equal(m.userData.limedTimberFinish.amount,.91);const shader={fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader);assert(shader.fragmentShader.includes('ranchTimberUV'));assert(shader.fragmentShader.includes('ranchTimberSample( map, vMapUv )'));assert(shader.fragmentShader.includes('ranchCreamPigment,0.91000'));assert(m.customProgramCacheKey().includes('ranch-timber-board-interiors-v1|limed-timber-2:0.91'));const key=m.customProgramCacheKey();installLimedTimberFinish(m,{amount:.91});assert.equal(m.customProgramCacheKey(),key);}}
 const paint=meshList(b.result.roots[0]).find(o=>o.material.name==='Builder | limed timber').material;assert.equal(paint.userData.limedTimberFinish.amount,.88);const shader={fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};paint.onBeforeCompile(shader);assert(shader.fragmentShader.includes('ranchCreamPigment,0.88000'));assert(paint.customProgramCacheKey().includes('|limed-timber-2:0.88'));
});

test('delayed actual builder upgrade retains placed root pose and preview exclusion, retires only old geometry, and shares resident resources',async()=>{
 const pending=[];let loads=0;class Loader{loadAsync(){loads++;return new Promise(resolve=>pending.push(resolve));}}
 const a=createRanchArchitecture({THREE:FakeT}),b=createRanchBuilderArt({THREE:FakeT,GLTFLoader:Loader,architecture:a,deferModels:true});
 const placed=b.create('barrel'),preview=b.create('barrel',true);placed.position.set(4,3,-8);placed.rotation.y=.73;placed.scale.set(1.1,.9,1.1);const oldGeometry=meshList(placed)[0].geometry;let retired=0;oldGeometry.addEventListener('dispose',()=>retired++);
 const placedUUID=placed.uuid,previewUUID=preview.uuid;assert.equal(loads,0);const done=b.startLoading();assert.equal(loads,10);assert.equal(b.startLoading(),done);
 const source=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(1,1.5,1),new T.MeshStandardMaterial({name:'resident source'}));source.add(mesh);let sourceDisposed=0;mesh.geometry.addEventListener('dispose',()=>sourceDisposed++);
 for(const resolve of pending)resolve({scene:source});await done;await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(placed.uuid,placedUUID);assert.equal(preview.uuid,previewUUID);assert.deepEqual(placed.position.toArray(),[4,3,-8]);assert(Math.abs(placed.rotation.y-.73)<1e-12);assert.deepEqual(placed.scale.toArray(),[1.1,.9,1.1]);assert.equal(preview.userData.collisionIgnore,true);assert.equal(placed.userData.scanned,true);assert.equal(retired,1);assert.equal(sourceDisposed,0);
 const real=meshList(placed).find(o=>o.geometry.userData.builderScan),ghost=meshList(preview).find(o=>o.geometry.userData.builderScan);assert(real&&ghost);assert.equal(real.geometry,ghost.geometry);assert.equal(real.geometry,mesh.geometry);assert.notEqual(real.material,ghost.material);assert.equal(ghost.material.depthWrite,false);assert.equal(ghost.material.opacity,.48);
});

test('real copied translucent preview hook retains stock diffuse tint signal and cream WYSIWYG with one shared program and no resource changes',()=>{
 const Loader=class{loadAsync(){throw Error('No optional model request');}},a=createRanchArchitecture({THREE:FakeT}),b=createRanchBuilderArt({THREE:FakeT,GLTFLoader:Loader,architecture:a,deferModels:true});
 const placed=b.create('fence'),preview=b.create('fence',true),m=meshList(placed).find(o=>o.material.userData.limedTimberFinish)?.material,g=meshList(preview).find(o=>o.material.userData.limedTimberFinish)?.material;assert(m&&g);assert.equal(g.onBeforeCompile,m.onBeforeCompile);assert.equal(g.customProgramCacheKey,m.customProgramCacheKey);assert.equal(g.transparent,true);assert.equal(g.opacity,.48);assert.equal(g.depthWrite,false);
 const shader={fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{diffuse:{value:g.color}}};g.onBeforeCompile(shader);const match=shader.fragmentShader.match(/ranchCoatTint=clamp\(diffuse\/vec3\(([^)]+)\),0\.0,4\.0\)/);assert(match,'actual stock diffuse uniform reaches the pigment');const base=match[1].split(',').map(Number),original=m.color.toArray().map(Math.fround);assert.deepEqual(base.map(Math.fround),original);assert(shader.fragmentShader.includes('ranchCreamPigment=clamp('));assert(shader.fragmentShader.includes('*ranchCoatTint,0.0,1.0)'));assert(shader.fragmentShader.includes('diffuseColor.rgb=mix(diffuseColor.rgb,ranchCreamPigment,0.88000)'));assert(shader.fragmentShader.includes('diffuseColor = vec4( diffuse, opacity )'));
 const pigment=[.78,.74,.65],map=[.31,.21,.14],amount=.88;
 // Evaluate the actual stock-colour and pure hue endpoints as a separate
 // signal contract. The former constant-colour coating is the negative control.
 const finish=diffuse=>{const mapped=map.map((v,i)=>v*diffuse[i]),wear=Math.min(1,Math.max(0,2*(mapped[0]*.2126+mapped[1]*.7152+mapped[2]*.0722))),scale=.90+.10*Math.sqrt(wear);return mapped.map((v,i)=>v*(1-amount)+amount*Math.min(1,pigment[i]*scale*Math.min(4,Math.max(0,diffuse[i]/base[i]))));};
 const neutral=finish(original);assert(neutral.every((v,i)=>v>map[i]*original[i]&&v<1));for(const [diffuse,channel]of [[[1,0,0],0],[[0,1,0],1],[[0,0,1],2]]){const out=finish(diffuse);assert(out[channel]>.6);for(let k=0;k<3;k++)if(k!==channel)assert.equal(out[k],0);const oldConstant=map.map((v,i)=>v*diffuse[i]*(1-amount)+amount*pigment[i]*.9);assert(oldConstant.some((v,i)=>i!==channel&&v>.4),'negative control demonstrates old coating erased colour signal');}
 const key=g.customProgramCacheKey(),geometry=meshList(preview)[0].geometry,uuid=g.uuid,previous=Math.random;Math.random=()=>{throw Error('Uniform preview colour change allocated resources');};try{for(const rgb of [[1,0,0],[0,1,0],original]){g.color.setRGB(...rgb);assert.equal(g.customProgramCacheKey(),key);}assert.equal(g.uuid,uuid);assert.equal(meshList(preview)[0].geometry,geometry);assert.equal(g.opacity,.48);}finally{Math.random=previous;}
});

test('independent resource receipt remains opt-in and tied to exact runtime and original baseline bodies',()=>{
 const sha=x=>crypto.createHash('sha256').update(x).digest('hex');for(const [file,hash]of Object.entries(contract.runtimeFiles)){let raw=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.equal(sha(raw),hash);for(const change of contract.sourceChanges.filter(p=>p.file===file).reverse()){assert.equal(raw.split(change.after).length,2);raw=raw.replace(change.after,change.before);}if(contract.originalSHA256[file])assert.equal(sha(raw),contract.originalSHA256[file]);}const output=process.env.RANCH_MODEL_AUDIT_OUTPUT;if(!output)return;
 const sources=Object.fromEntries(['ranch-architecture.js','ranch-builder-art.js','ranch-timber-joinery.mjs'].map(file=>[file,sha(fs.readFileSync(new URL('../assets/'+file,import.meta.url)))]));
 fs.writeFileSync(output,JSON.stringify({sources,originalSources:Object.fromEntries(['ranch-architecture.js','ranch-builder-art.js'].map(file=>[file,sha(baseline(file))])),buildings:pair.b.buildings.map((entry,i)=>({name:entry.name,before:measured(pair.a.buildings[i].root),after:measured(entry.root)})),nativeVisualAcceptance:'pending parent GPU review'},null,2)+'\n');
});
