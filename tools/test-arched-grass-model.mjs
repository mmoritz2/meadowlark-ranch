import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLushMeadowGeometry} from './grass-ribbon-historical-factories.mjs';
import {createGrazedSwardGeometry,GRAZED_SWARD} from './grass-ribbon-historical-factories.mjs';
import {createGrassFamilyGeometry,GRASS_FAMILIES} from './grass-ribbon-historical-factories.mjs';
import {createGrassTuftGeometry} from './grass-ribbon-historical-factories.mjs';
import {
 createLushMeadowGeometry as baselineLush,
 createGrazedSwardGeometry as baselineGrazed,
 createGrassTuftGeometry as baselineTuft,
} from './grass-arch-historical-factories.mjs';

// Historical d9 creased-arch assertions keep their original thresholds.
// The actual continuous ribbon model has separate production-import contracts.
const forms=[
 {name:'near',create:t=>createGrassTuftGeometry(t,{profile:'near-folded-v1'}),before:t=>baselineTuft(t,{profile:'near-folded-v1'}),leaves:8,arched:6,upright:2,triangles:40,vertices:64,bytes:3056,cap:1.1446000337600708},
 ...[0,1,2].map(family=>({name:['meadow','low','seeded'][family],create:t=>createGrassFamilyGeometry(t,family),before:t=>baselineLush(t,{leafCount:14,segments:family===2?2:3,profile:['meadow','low','seeded'][family],seeded:family===2}),leaves:[14,14,10][family],arched:[11,11,6][family],upright:[3,3,4][family],triangles:70,vertices:[112,112,122][family],bytes:[5348,5348,5788][family],cap:[1.1446000337600708,.6753140091896057,1.5850000381469727][family]})),
 {name:'grazed',create:createGrazedSwardGeometry,before:baselineGrazed,leaves:14,arched:12,upright:2,triangles:70,vertices:112,bytes:5348,cap:.5199999809265137},
];
const vec=(attribute,id)=>new T.Vector3().fromBufferAttribute(attribute,id);
const bytes=g=>g.index.array.byteLength+Object.values(g.attributes).reduce((sum,a)=>sum+a.array.byteLength,0);
const ranges=g=>(g.userData.lushMeadow??g.userData.grazedSward).leafRanges;
function priorRootCentres(g,name){
 const p=g.attributes.position;
 const centre=k=>[(p.getX(k)+p.getX(k+1))*.5,(p.getZ(k)+p.getZ(k+1))*.5];
 if(name!=='grazed')return g.userData.lushMeadow.leafRanges.map(r=>centre(r.vertexStart));
 assert.equal(g.userData.grazedSward.leaves,46,'Pinned original cropped turf has46 leaves');
 const result=[];let vertex=0;
 for(let leaf=0;leaf<46;leaf++){result.push(centre(vertex));vertex+=leaf<12?5:3;}
 assert.equal(vertex,p.count);return result;
}
function physicalSurface(g){
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 assert.deepEqual(Object.keys(g.attributes).sort(),['color','normal','position','uv']);
 for(const attribute of Object.values(g.attributes)){
  assert.equal(attribute.count,p.count);assert(attribute.array instanceof Float32Array);
  assert(Array.from(attribute.array).every(Number.isFinite));
 }
 assert(Array.from(uv.array).every(v=>v>=0&&v<=1));
 assert(Array.from(g.attributes.color.array).every(v=>v>0&&v<=1.05));
 assert.equal(g.boundingBox.min.y,0);assert(Number.isFinite(g.boundingSphere.radius));
 for(let id=0;id<p.count;id++){
  assert(Math.abs(vec(n,id).length()-1)<1e-6);
  assert(Math.hypot(p.getX(id),p.getZ(id))<.60,'Physical blade stays inside bounded local tuft');
 }
 for(let at=0;at<g.index.count;at+=3){
  const ids=Array.from(g.index.array.subarray(at,at+3));
  assert(ids.every(id=>Number.isInteger(id)&&id>=0&&id<p.count));
  const [a,b,c]=ids.map(id=>vec(p,id)),face=b.sub(a).cross(c.sub(a));
  assert(face.length()>1e-8,'Every drawn triangle is finite and nondegenerate');face.normalize();
  for(const id of ids)assert(face.dot(vec(n,id))>.35,'Computed vertex normal stays on its actual triangle side');
 }
 const saved=n.array.slice();g.computeVertexNormals();
 assert.deepEqual(n.array,saved,'Normals come from actual geometry, with no lighting-normal substitution');
}
for(const form of forms)test(`Historical d9 morphology: ${form.name}: rooted creased arches, few upright tips, preserved source cap and triangle budget`,()=>{
 const old=form.before(T),g=form.create(T);
 try{
  physicalSurface(g);const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,leaves=ranges(g),roots=priorRootCentres(old,form.name);
  assert.equal(leaves.length,form.leaves);assert.equal(g.index.count/3,form.triangles);
  assert.equal(g.index.count,old.index.count);assert.equal(p.count,form.vertices);assert(p.count<=old.attributes.position.count);
  assert.equal(bytes(g),form.bytes);assert(bytes(g)<=bytes(old));
  assert.equal(g.boundingBox.max.y,form.cap);assert.equal(g.boundingBox.max.y,old.boundingBox.max.y,'Original source height cap retained');
  let arches=0,uprights=0;const tops=[];
  for(const r of leaves){
   const base=r.vertexStart,tip=base+r.vertexCount-1,root=vec(p,base).add(vec(p,base+1)).multiplyScalar(.5);
   assert.equal(p.getY(base),0);assert.equal(p.getY(base+1),0);
   assert(roots.some(q=>Math.hypot(root.x-q[0],root.z-q[1])<1e-8),'Each internal root retains an original source centre');
   assert.equal(uv.getY(base),0);assert.equal(uv.getY(base+1),0);assert.equal(uv.getY(tip),1);assert.equal(uv.getX(tip),.5);
   const peak=Math.max(...Array.from({length:r.vertexCount},(_,k)=>p.getY(base+k))),deflection=Math.hypot(p.getX(tip)-root.x,p.getZ(tip)-root.z);tops.push(peak);
   assert(p.getY(tip)>0);assert(peak>deflection*1.35,'Reject low radial rosettes despite the physical arch');
   const pairs=r.creased?[[0,1],[2,3],[5,6]]:[[0,1]];
   for(const[a,b]of pairs){const width=vec(p,base+a).distanceTo(vec(p,base+b));assert(width>0&&width<peak*.25,'Leaf remains narrow relative to its real height');}
   if(r.creased){
    assert.equal(r.vertexCount,8);assert.equal(r.indexCount,15);assert.equal(r.segments,2);
    assert.deepEqual(Array.from(g.index.array.subarray(r.indexStart,r.indexStart+r.indexCount),id=>id-base),[0,1,4,1,3,4,3,2,4,2,0,4,5,6,7],'Lower ridge and upper tip keep physical winding');
    for(const[a,b]of [[2,5],[3,6]]){
     assert.deepEqual(vec(p,base+a).toArray(),vec(p,base+b).toArray(),'Coincident shoulder sides carry independent computed normals');
     assert.deepEqual([uv.getX(base+a),uv.getY(base+a)],[uv.getX(base+b),uv.getY(base+b)]);
    }
    if(r.upright){uprights++;assert.equal(r.bent,false);assert(p.getY(tip)===peak);}
    else{
     arches++;assert.equal(r.bent,true);assert(p.getY(tip)<peak*.86,'Tip physically falls below the shoulder');
     assert(vec(n,base+2).dot(vec(n,base+5))<.80,'Lower and hanging upper surfaces have a real computed crease');
    }
   }else{
    uprights++;assert.equal(r.upright,true);assert.equal(r.vertexCount,3);assert.equal(r.indexCount,3);
    assert.deepEqual(Array.from(g.index.array.subarray(r.indexStart,r.indexStart+3),id=>id-base),[0,1,2]);
   }
  }
  assert.equal(arches,form.arched);assert.equal(uprights,form.upright);
  assert(Math.max(...tops)>Math.min(...tops)*1.35,'Unequal tops retain an irregular rooted stand');
 }finally{old.dispose();g.dispose();}
});

test('Historical d9 morphology: current family metadata agrees with actual physical leaves and seed stems',()=>{
 assert.deepEqual(GRASS_FAMILIES.map(f=>f.leaves),[14,14,10]);
 assert.deepEqual(GRASS_FAMILIES.map(f=>f.seedStems),[0,0,2]);
 assert.equal(GRAZED_SWARD.leaves,14);assert.equal(GRAZED_SWARD.bentLeaves,12);assert.equal(GRAZED_SWARD.maximumRadius,.60);
 for(let family=0;family<3;family++){
  const g=createGrassFamilyGeometry(T,family);
  try{assert.equal(g.userData.grassFamily.leaves,ranges(g).length);assert.equal(g.userData.lushMeadow.leaves,ranges(g).length);assert.equal(g.userData.grassFamily.triangles,g.index.count/3);assert.equal(g.userData.grassFamily.vertices,g.attributes.position.count);}
  finally{g.dispose();}
 }
});

test('Historical d9 morphology: seeded model preserves original seed stem/head attributes and relative topology exactly',()=>{
 const a=baselineLush(T,{leafCount:14,segments:2,profile:'seeded',seeded:true}),b=createGrassFamilyGeometry(T,2);
 try{
  const lastA=ranges(a).at(-1),lastB=ranges(b).at(-1),startA=lastA.vertexStart+lastA.vertexCount,startB=lastB.vertexStart+lastB.vertexCount;
  assert.equal(a.userData.lushMeadow.seedTriangles,28);assert.equal(b.userData.lushMeadow.seedTriangles,28);
  assert.equal(a.index.count-lastA.indexStart-lastA.indexCount,84);assert.equal(b.index.count-lastB.indexStart-lastB.indexCount,84);
  for(const name of Object.keys(a.attributes)){
   const aa=a.attributes[name],bb=b.attributes[name];assert.equal(aa.itemSize,bb.itemSize);
   assert.deepEqual(bb.array.subarray(startB*bb.itemSize),aa.array.subarray(startA*aa.itemSize),`Actual source seed ${name} is unchanged`);
  }
  assert.deepEqual(Array.from(b.index.array.subarray(lastB.indexStart+lastB.indexCount),id=>id-startB),Array.from(a.index.array.subarray(lastA.indexStart+lastA.indexCount),id=>id-startA));
 }finally{a.dispose();b.dispose();}
});

function sampledConstructor(create){
 let allocated=0,draws=0,state=123456789;const saved=Math.random;
 const probe=new Proxy({...T,BufferGeometry:class extends T.BufferGeometry{constructor(...args){super(...args);allocated++;}}},{get(target,name){if(typeof name==='string'&&/(?:Material|Texture)$/.test(name))return class{constructor(){throw Error(`Grass factory allocated unexpected ${name}`);}};return target[name];}});
 Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 try{const geometry=create(probe),calls=draws,future=Array.from({length:24},()=>Math.random());return{geometry,calls,future,allocated};}
 finally{Math.random=saved;}
}
test('Historical d9 morphology: each production factory keeps one geometry, four UUID draws and the future24 random sequence without material/texture allocation',()=>{
 const constructors=[...forms,...[4,6,8].map(n=>({name:`middle${n}`,create:t=>createGrassTuftGeometry(t,{profile:'middle-natural-v1',bladeCount:n,segments:2}),before:t=>baselineTuft(t,{profile:'middle-natural-v1',bladeCount:n,segments:2})}))];
 for(const form of constructors){
  const a=sampledConstructor(form.before),b=sampledConstructor(form.create);
  try{assert.equal(a.allocated,1);assert.equal(b.allocated,1);assert.equal(a.calls,4);assert.equal(b.calls,4);assert.deepEqual(b.future,a.future,form.name);}
  finally{a.geometry.dispose();b.geometry.dispose();}
 }
});

test('Historical d9 morphology: all216 noncanonical public combinations, including middle tiers, retain every original attribute/index/bound and metadata byte',()=>{
 let exact=0,canonical=0;
 for(let leafCount=4;leafCount<=14;leafCount++)for(const segments of [2,3])for(const profile of ['meadow','low','seeded','near','middle'])for(const seeded of [false,true]){
  const changed=profile==='near'&&leafCount===8&&segments===3&&!seeded||['meadow','low'].includes(profile)&&leafCount===14&&segments===3&&!seeded||profile==='seeded'&&leafCount===14&&segments===2&&seeded;
  if(changed){canonical++;continue;}
  const options={leafCount,segments,profile,seeded},a=baselineLush(T,options),b=createLushMeadowGeometry(T,options);
  try{
   assert.deepEqual(Object.keys(b.attributes),Object.keys(a.attributes));
   for(const name of Object.keys(a.attributes))assert.deepEqual(b.attributes[name].array,a.attributes[name].array,JSON.stringify({options,attribute:name}));
   assert.deepEqual(b.index.array,a.index.array);assert.deepEqual(b.boundingBox,a.boundingBox);assert.deepEqual(b.boundingSphere,a.boundingSphere);assert.deepEqual(b.userData,a.userData);exact++;
  }finally{a.dispose();b.dispose();}
 }
 assert.equal(exact,216);assert.equal(canonical,4);
});
