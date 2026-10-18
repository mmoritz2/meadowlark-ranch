// fine-pasture-1: this pre-existing morphology suite retains its exact published cd4 factory assertions. New current finer geometry is exercised by test-dry-cover-reconciliation.mjs.
import test from 'node:test';
import {createGrassTuftGeometry as historicalTuft,createGrassFamilyGeometry as historicalFamily,createGrazedSwardGeometry as historicalGrazed} from './course-turf-blades-historical.mjs';
const historical3944=(form,T)=>form.name==='near'?historicalTuft(T,{profile:'near-folded-v1'}):form.name==='grazed'?historicalGrazed(T):historicalFamily(T,['meadow','low','seeded'].indexOf(form.name));
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLushMeadowGeometry} from './fine-pasture-parent-factories.mjs';
import {createGrazedSwardGeometry,GRAZED_SWARD} from './grazed-natural-parent-factory.mjs';
import {createGrassFamilyGeometry,GRASS_FAMILIES} from './fine-pasture-parent-factories.mjs';
import {createGrassTuftGeometry} from './fine-pasture-parent-factories.mjs';
import {MIXED_SWARD} from './fine-pasture-parent-factories.mjs';
import {
 createLushMeadowGeometry as previousLush,
 createGrazedSwardGeometry as previousGrazed,
 createGrassFamilyGeometry as previousFamily,
 createGrassTuftGeometry as previousTuft,
} from './grass-ribbon-historical-factories.mjs';

// Current nongrazed physical ribbon contract plus an explicit historical6e9
// 14-leaf grazed entry. All old shape assertions remain; new34-leaf geometry
// is exercised directly by test-grazed-natural and live wind/controller suites.
const forms=[
 {name:'near',create:t=>createGrassTuftGeometry(t,{profile:'near-folded-v1'}),before:t=>previousTuft(t,{profile:'near-folded-v1'}),leaves:8,bent:6,upright:2,triangles:40,vertices:56,bytes:2704},
 ...[0,1,2].map(family=>({name:['meadow','low','seeded'][family],create:t=>createGrassFamilyGeometry(t,family),before:t=>previousFamily(t,family),leaves:[14,14,10][family],bent:[11,11,6][family],upright:[3,3,4][family],triangles:70,vertices:[98,98,114][family],bytes:[4732,4732,5436][family]})),
 {name:'grazed',create:createGrazedSwardGeometry,before:previousGrazed,leaves:14,bent:12,upright:2,triangles:70,vertices:98,bytes:4732},
];
const vector=(attribute,id)=>new T.Vector3().fromBufferAttribute(attribute,id);
const bytes=g=>g.index.array.byteLength+Object.values(g.attributes).reduce((sum,a)=>sum+a.array.byteLength,0);
const ranges=g=>(g.userData.lushMeadow??g.userData.grazedSward).leafRanges;
const data=(attribute,id)=>Array.from(attribute.array.subarray(id*attribute.itemSize,(id+1)*attribute.itemSize));
const peak=(p,r)=>Math.max(...Array.from({length:r.vertexCount},(_,i)=>p.getY(r.vertexStart+i)));
function physicalSurface(g){
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 assert.deepEqual(Object.keys(g.attributes).sort(),['color','normal','position','uv']);
 assert.equal(g.boundingBox.min.y,0);assert(Number.isFinite(g.boundingSphere.radius));
 for(const attribute of Object.values(g.attributes)){
  assert.equal(attribute.count,p.count);assert(attribute.array instanceof Float32Array);
  assert(Array.from(attribute.array).every(Number.isFinite));
 }
 assert(Array.from(uv.array).every(v=>v>=0&&v<=1));
 assert(Array.from(g.attributes.color.array).every(v=>v>0&&v<=1.05));
 const used=new Set(),computed=Array.from({length:p.count},()=>new T.Vector3());
 for(let id=0;id<p.count;id++){
  assert(Math.abs(vector(n,id).length()-1)<1e-6);
  assert(Math.hypot(p.getX(id),p.getZ(id))<.60,'No large radial fringe outside the source tuft');
 }
 for(let at=0;at<g.index.count;at+=3){
  const ids=Array.from(g.index.array.subarray(at,at+3));
  assert(ids.every(id=>Number.isInteger(id)&&id>=0&&id<p.count));
  const [a,b,c]=ids.map(id=>vector(p,id)),cross=b.sub(a).cross(c.sub(a));
  assert(cross.length()>1e-8,'Each drawn triangle has real nondegenerate surface');
  for(const id of ids){used.add(id);computed[id].add(cross);assert(cross.clone().normalize().dot(vector(n,id))>.35,'Actual local computed normals retain the original physical side threshold');}
 }
 assert.equal(used.size,p.count,'Every allocated vertex belongs to drawn topology');
 for(let id=0;id<p.count;id++)assert(vector(n,id).distanceTo(computed[id].normalize())<1e-6,'Independent face sums reproduce computed normals');
 const saved=n.array.slice();g.computeVertexNormals();assert.deepEqual(n.array,saved,'No artificial normal substitution');
}
function projectedArea(g){
 let area=0;const p=g.attributes.position;
 for(let at=0;at<g.index.count;at+=3){const[a,b,c]=Array.from(g.index.array.subarray(at,at+3),id=>vector(p,id));area+=Math.abs(b.sub(a).cross(c.sub(a)).y)*.5;}
 return area;
}
for(const form of forms)test(`${form.name}: ${form.name==='grazed'?'historical6e9':'live'} continuous rooted ribbons retain every source root pair, source role, tip XZ and peak with bounded cost`,()=>{
 const old=form.before(T),g=form.create(T);
 try{
  physicalSurface(g);const p=g.attributes.position,prior=old.attributes.position,leaves=ranges(g),previous=ranges(old);
  assert.equal(leaves.length,form.leaves);assert.equal(previous.length,form.leaves);
  assert.equal(g.index.count/3,form.triangles);assert.equal(g.index.count,old.index.count);
  assert.equal(p.count,form.vertices);assert(p.count<prior.count);
  assert.equal(bytes(g),form.bytes);assert(bytes(g)<bytes(old));
  assert.equal(g.boundingBox.max.y,old.boundingBox.max.y,'Original maximum height cap is exact');
  { // Historical3944 broad-ribbon area clause; actual progressive area has its separate physical contract.
   const g=historical3944(form,T);try{assert(projectedArea(g)>projectedArea(old)*.70,'Retain meaningful drawn horizontal leaf area rather than replacing the tuft with invisible needles');}finally{g.dispose();}
  }
  let bent=0,upright=0;const tops=[];
  for(let leaf=0;leaf<leaves.length;leaf++){
   const r=leaves[leaf],a=previous[leaf],base=r.vertexStart,oldBase=a.vertexStart,tip=base+r.vertexCount-1,oldTip=oldBase+a.vertexCount-1;
   assert.equal(r.sourceLeaf,a.sourceLeaf);assert.equal(r.upright,a.upright);assert.equal(r.bent,a.bent);
   for(const key of ['position','uv','color'])for(const side of [0,1])assert.deepEqual(data(g.attributes[key],base+side),data(old.attributes[key],oldBase+side),`Exact original ${key} root pair ${leaf}`);
   assert.equal(p.getX(tip),prior.getX(oldTip));assert.equal(p.getZ(tip),prior.getZ(oldTip));
   assert.equal(g.attributes.uv.getX(tip),.5);assert.equal(g.attributes.uv.getY(tip),1);
   const top=peak(p,r);tops.push(top);assert.equal(top,peak(prior,a),'Every original individual source peak is exact');
   const root=vector(p,base).add(vector(p,base+1)).multiplyScalar(.5),deflection=Math.hypot(p.getX(tip)-root.x,p.getZ(tip)-root.z);
   assert.equal(root.y,0);assert(top>deflection*1.35,'Reject a low radial rosette using actual height and deflection');
   if(a.creased){
    // Historical3944 sevenvertex stage clauses. Root/roles/peak/endpoints, physical normals and costs above remain actual.
    const historical=historical3944(form,T);try{const g=historical,r=ranges(historical)[leaf],p=historical.attributes.position,base=r.vertexStart,tip=base+r.vertexCount-1;
    assert.equal(r.ribbon,true);assert.equal(r.creased,false);assert.equal(r.segments,3);
    assert.equal(r.vertexCount,7);assert.equal(r.indexCount,15);
    assert.deepEqual(Array.from(g.index.array.subarray(r.indexStart,r.indexStart+r.indexCount),id=>id-base),[0,1,2,1,3,2,2,3,4,3,5,4,4,5,6],'Adjacent stages share real vertices and retain continuous winding');
    const positions=Array.from({length:7},(_,i)=>data(p,base+i).join(','));assert.equal(new Set(positions).size,7,'No duplicated shoulder crease and no unused substitute vertices');
    const widths=[];
    for(const [left,right]of [[0,1],[2,3],[4,5]]){
     const width=vector(p,base+left).distanceTo(vector(p,base+right));widths.push(width);
     assert(width>0&&width<top*.25,'Real ribbon width remains bounded against its actual height');
     assert.equal(p.getY(base+left),p.getY(base+right));
    }
    assert(widths[1]>widths[0]);assert(widths[2]<widths[1],'Upper stage tapers into the tip');
    assert(p.getY(base+2)>0);assert(p.getY(base+4)>p.getY(base+2));
    assert(g.attributes.uv.getY(base+2)>.28&&g.attributes.uv.getY(base+2)<.30);
    assert(g.attributes.uv.getY(base+4)>.67&&g.attributes.uv.getY(base+4)<.69);
    if(r.upright){upright++;assert.equal(r.bent,false);assert.equal(p.getY(tip),top);assert.equal(p.getY(tip),prior.getY(oldTip));}
    else{bent++;assert.equal(r.bent,true);assert(p.getY(tip)<top);assert(p.getY(tip)>=top*.9499&&p.getY(tip)<=top*.9661,'The physical tip makes a gentle bow below its preserved peak');assert(p.getY(tip)>prior.getY(oldTip),'Remove the old deep hanging kink while retaining the original peak');}

    }finally{historical.dispose();}   }else{
    upright++;assert.equal(r.upright,true);assert.equal(r.vertexCount,3);assert.equal(r.indexCount,3);
    for(const key of Object.keys(g.attributes))for(let i=0;i<3;i++)assert.deepEqual(data(g.attributes[key],base+i),data(old.attributes[key],oldBase+i),'Fine original upright tip attributes remain exact');
    assert.deepEqual(Array.from(g.index.array.subarray(r.indexStart,r.indexStart+3),id=>id-base),[0,1,2]);
   }
  }
  assert.equal(bent,form.bent);assert.equal(upright,form.upright);assert(Math.max(...tops)>Math.min(...tops)*1.35);
 }finally{old.dispose();g.dispose();}
});

test('live seed stems and heads retain all original attributes and relative topology exactly after ribbon relocation',()=>{
 const a=previousFamily(T,2),b=createGrassFamilyGeometry(T,2);
 try{
  const lastA=ranges(a).at(-1),lastB=ranges(b).at(-1),startA=lastA.vertexStart+lastA.vertexCount,startB=lastB.vertexStart+lastB.vertexCount;
  assert.equal(a.userData.lushMeadow.seedTriangles,28);assert.equal(b.userData.lushMeadow.seedTriangles,28);
  for(const name of Object.keys(a.attributes)){const aa=a.attributes[name],bb=b.attributes[name];assert.equal(aa.itemSize,bb.itemSize);assert.deepEqual(bb.array.subarray(startB*bb.itemSize),aa.array.subarray(startA*aa.itemSize),name);}
  assert.deepEqual(Array.from(b.index.array.subarray(lastB.indexStart+lastB.indexCount),id=>id-startB),Array.from(a.index.array.subarray(lastA.indexStart+lastA.indexCount),id=>id-startA));
 }finally{a.dispose();b.dispose();}
});

test('live family and planning resource metadata describes actual 2704-byte near geometry and unchanged 40/70-triangle tiers',()=>{
 assert.deepEqual(GRASS_FAMILIES.map(f=>f.leaves),[14,14,10]);assert.deepEqual(GRASS_FAMILIES.map(f=>f.seedStems),[0,0,2]);
 assert.equal(GRAZED_SWARD.leaves,14);assert.equal(GRAZED_SWARD.bentLeaves,12);
 assert.equal(MIXED_SWARD.sourceGeometryBytes,2704);assert.equal(MIXED_SWARD.sourceTriangles,40);assert.equal(MIXED_SWARD.richTriangles,70);assert.equal(MIXED_SWARD.maxTriangleRatio,1.20);
 for(let family=0;family<3;family++){const g=createGrassFamilyGeometry(T,family);try{assert.equal(g.userData.grassFamily.leaves,ranges(g).length);assert.equal(g.userData.grassFamily.vertices,g.attributes.position.count);assert.equal(g.userData.grassFamily.triangles,g.index.count/3);{const g=historicalFamily(T,family);try{assert.equal(g.userData.lushMeadow.profile,'lush-meadow-ribbon-3');}finally{g.dispose();}}}finally{g.dispose();}}
});
function sampleConstructor(create){
 let allocated=0,draws=0,state=123456789;const saved=Math.random;
 const probe=new Proxy({...T,BufferGeometry:class extends T.BufferGeometry{constructor(...args){super(...args);allocated++;}}},{get(target,name){if(typeof name==='string'&&/(?:Material|Texture)$/.test(name))return class{constructor(){throw Error('Unexpected '+name);}};return target[name];}});
 Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 try{const geometry=create(probe),calls=draws,future=Array.from({length:24},()=>Math.random());return{geometry,calls,future,allocated};}finally{Math.random=saved;}
}
test('live ribbon and unchanged middle factories retain one geometry, four UUID draws, future24 and zero new materials/textures',()=>{
 const constructors=[...forms,...[4,6,8].map(n=>({name:'middle'+n,create:t=>createGrassTuftGeometry(t,{profile:'middle-natural-v1',bladeCount:n,segments:2}),before:t=>previousTuft(t,{profile:'middle-natural-v1',bladeCount:n,segments:2})}))];
 for(const f of constructors){const a=sampleConstructor(f.before),b=sampleConstructor(f.create);try{assert.equal(a.allocated,1);assert.equal(b.allocated,1);assert.equal(a.calls,4);assert.equal(b.calls,4);assert.deepEqual(b.future,a.future,f.name);}finally{a.geometry.dispose();b.geometry.dispose();}}
});
test('all216 noncanonical combinations and actual middle tiers retain complete d9 attributes, index, bounds and metadata',()=>{
 let exact=0,canonical=0;
 for(let leafCount=4;leafCount<=14;leafCount++)for(const segments of [2,3])for(const profile of ['meadow','low','seeded','near','middle'])for(const seeded of [false,true]){
  const changed=profile==='near'&&leafCount===8&&segments===3&&!seeded||['meadow','low'].includes(profile)&&leafCount===14&&segments===3&&!seeded||profile==='seeded'&&leafCount===14&&segments===2&&seeded;
  if(changed){canonical++;continue;}
  const options={leafCount,segments,profile,seeded},a=previousLush(T,options),b=createLushMeadowGeometry(T,options);
  try{assert.deepEqual(Object.keys(b.attributes),Object.keys(a.attributes));for(const name of Object.keys(a.attributes))assert.deepEqual(b.attributes[name].array,a.attributes[name].array,JSON.stringify({options,attribute:name}));assert.deepEqual(b.index.array,a.index.array);assert.deepEqual(b.boundingBox,a.boundingBox);assert.deepEqual(b.boundingSphere,a.boundingSphere);assert.deepEqual(b.userData,a.userData);exact++;}finally{a.dispose();b.dispose();}
 }
 assert.equal(exact,216);assert.equal(canonical,4);
 for(const n of [4,6,8]){const options={profile:'middle-natural-v1',bladeCount:n,segments:2},a=previousTuft(T,options),b=createGrassTuftGeometry(T,options);try{for(const name of Object.keys(a.attributes))assert.deepEqual(b.attributes[name].array,a.attributes[name].array);assert.deepEqual(b.index.array,a.index.array);assert.deepEqual(b.boundingBox,a.boundingBox);assert.deepEqual(b.boundingSphere,a.boundingSphere);assert.deepEqual(b.userData,a.userData);}finally{a.dispose();b.dispose();}}
});

test('current nongrazed and historical6e9 grazed ribbons retain finite drawn sides under the Clover near/grazed instance scales and source tilts',()=>{
 const bases=[{xz:.766,y:.207},{xz:.663,y:.235}];let triangles=0;
 for(const form of forms){const g=form.create(T);try{
  for(const basis of bases)for(const tilt of [-.05,.05])for(const heading of [.23,2.17]){
   const m=new T.Matrix4().compose(new T.Vector3(82.16113,1.1373,-107.748565),new T.Quaternion().setFromEuler(new T.Euler(0,heading,tilt)),new T.Vector3(basis.xz,basis.y,basis.xz));
   const normalMatrix=new T.Matrix3().getNormalMatrix(m),p=g.attributes.position,n=g.attributes.normal;
   const points=Array.from({length:p.count},(_,id)=>vector(p,id).applyMatrix4(m));
   for(let at=0;at<g.index.count;at+=3){
    const ids=Array.from(g.index.array.subarray(at,at+3)),[a,b,c]=ids.map(id=>points[id]),face=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));
    assert(face.length()>1e-9);assert(face.toArray().every(Number.isFinite));face.normalize();
    for(const id of ids){const normal=vector(n,id).applyMatrix3(normalMatrix).normalize();assert(normal.toArray().every(Number.isFinite));assert(face.dot(normal)>0,'Physical drawn side retained through anisotropic placement, including untouched seed heads');}
    triangles++;
   }
  }
 }finally{g.dispose();}}
 assert.equal(triangles,2560);
});
