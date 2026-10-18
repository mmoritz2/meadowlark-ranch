// fine-pasture-1: this pre-existing morphology suite retains its exact published cd4 factory assertions. New current finer geometry is exercised by test-dry-cover-reconciliation.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLushMeadowGeometry} from './fine-pasture-parent-factories.mjs';
import {createGrassFamilyGeometry,GRASS_FAMILIES} from './fine-pasture-parent-factories.mjs';
import {createGrazedSwardGeometry,GRAZED_SWARD} from './grazed-natural-parent-factory.mjs';
import {createGrassTuftGeometry} from './fine-pasture-parent-factories.mjs';

// Current nongrazed progressive profile gates, plus the explicit historical6e9
// 14-leaf grazed entry. New34-leaf geometry and actual wind/controller/response
// gates import production directly in test-grazed-natural and the live suites.
const fixtureBytes=fs.readFileSync(new URL('./fixtures/grass-ribbon-3944-model.json',import.meta.url));
assert.equal(crypto.createHash('sha256').update(fixtureBytes).digest('hex'),'d2d96833e3d279c1bc5f042edb912bfea5c7d73fbe3eab38dd90651df9181e58');
const fixture=JSON.parse(fixtureBytes);
const forms=[
 {name:'near',create:t=>createGrassTuftGeometry(t,{profile:'near-folded-v1'}),leaves:8,counts:{3:2,7:2,9:4},vertices:56,triangles:40,bytes:2704},
 ...[0,1,2].map(i=>({name:['meadow','low','seeded'][i],create:t=>createGrassFamilyGeometry(t,i),leaves:[14,14,10][i],counts:[{3:3,7:5,9:6},{3:3,7:5,9:6},{3:4,7:2,9:4}][i],vertices:[98,98,114][i],triangles:70,bytes:[4732,4732,5436][i]})),
 {name:'grazed',create:createGrazedSwardGeometry,leaves:14,counts:{3:2,7:8,9:4},vertices:98,triangles:70,bytes:4732},
];
const ranges=g=>(g.userData.lushMeadow??g.userData.grazedSward).leafRanges;
const vector=(a,id)=>new T.Vector3().fromBufferAttribute(a,id);
const data=(a,id)=>Array.from(a.array.subarray(id*a.itemSize,(id+1)*a.itemSize));
const oldData=(f,name,id)=>f.attributes[name].array.slice(id*f.attributes[name].itemSize,(id+1)*f.attributes[name].itemSize);
const peak=(a,r)=>Math.max(...Array.from({length:r.vertexCount},(_,i)=>a.getY(r.vertexStart+i)));
const oldPeak=(f,r)=>Math.max(...Array.from({length:r.vertexCount},(_,i)=>f.attributes.position.array[(r.vertexStart+i)*3+1]));
const bytes=g=>g.index.array.byteLength+Object.values(g.attributes).reduce((v,a)=>v+a.array.byteLength,0);
const patterns={3:[0,1,2],7:[0,1,2,1,3,2,2,3,4,3,5,4,4,5,6],9:[0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6,6,7,8]};
function area(g,projected=false){const p=g.attributes?.position;let sum=0;const ids=g.index?.array??g.indices;const pos=id=>typeof p?.getX==='function'?vector(p,id):new T.Vector3().fromArray(g.attributes.position.array,id*3);for(let i=0;i<ids.length;i+=3){const[a,b,c]=Array.from(ids.slice(i,i+3),pos),cross=b.sub(a).cross(c.sub(a));sum+=(projected?Math.abs(cross.y):cross.length())*.5;}return sum;}
function diskTopology(g,r){
 const p=g.attributes.position,base=r.vertexStart,faces=Array.from(g.index.array.slice(r.indexStart,r.indexStart+r.indexCount),id=>id-base),edges=new Map(),adj=Array.from({length:r.vertexCount},()=>new Set()),used=new Set();
 const unique=new Set(Array.from({length:r.vertexCount},(_,i)=>data(p,base+i).join(',')));
 assert.equal(unique.size,r.vertexCount,'Every leaf vertex is a unique physical point');
 for(let i=0;i<faces.length;i+=3){const tri=faces.slice(i,i+3);assert.equal(new Set(tri).size,3);for(let side=0;side<3;side++){const a=tri[side],b=tri[(side+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);assert(a>=0&&a<r.vertexCount);used.add(a);adj[a].add(b);adj[b].add(a);const row=edges.get(key)??[];row.push(a<b?1:-1);edges.set(key,row);}}
 assert.equal(used.size,r.vertexCount);let boundary=0;const boundaryAdj=Array.from({length:r.vertexCount},()=>[]);
 for(const[key,signs]of edges){assert(signs.length===1||signs.length===2,'No nonmanifold edge');if(signs.length===2)assert.equal(signs[0]+signs[1],0,'Interior faces have opposing edge winding');else{boundary++;const[a,b]=key.split(':').map(Number);boundaryAdj[a].push(b);boundaryAdj[b].push(a);}}
 assert.equal(boundary,r.vertexCount,'One physical blade has one complete perimeter');assert(boundaryAdj.every(a=>a.length===2),'Every perimeter point has degree two');
 const reached=new Set([0]),queue=[0];for(let k=0;k<queue.length;k++)for(const id of adj[queue[k]])if(!reached.has(id)){reached.add(id);queue.push(id);}assert.equal(reached.size,r.vertexCount,'One connected leaf surface');
 assert.equal(r.vertexCount-edges.size+faces.length/3,1,'Orientable open 2D disk, not a volumetric solid');
}
function physicalNormals(g){const p=g.attributes.position,n=g.attributes.normal,sum=Array.from({length:p.count},()=>new T.Vector3()),used=new Set();
 assert.deepEqual(Object.keys(g.attributes).sort(),['color','normal','position','uv']);
 for(const a of Object.values(g.attributes)){assert(a.array instanceof Float32Array);assert.equal(a.count,p.count);assert(a.array.every(Number.isFinite));}
 assert(g.attributes.uv.array.every(v=>v>=0&&v<=1));assert(g.attributes.color.array.every(v=>v>0&&v<=1.05));
 for(let at=0;at<g.index.count;at+=3){const ids=Array.from(g.index.array.slice(at,at+3));assert(ids.every(id=>Number.isInteger(id)&&id>=0&&id<p.count));const[a,b,c]=ids.map(id=>vector(p,id)),cross=b.sub(a).cross(c.sub(a));assert(cross.length()>1e-8,'Actual nondegenerate triangle');for(const id of ids){used.add(id);sum[id].add(cross);assert(cross.clone().normalize().dot(vector(n,id))>.35,'Unchanged local physical normal cone, without exceptions');}}
 assert.equal(used.size,p.count,'No sentinel or unused extent point');for(let id=0;id<p.count;id++){assert(Math.abs(vector(n,id).length()-1)<1e-6);assert(vector(n,id).distanceTo(sum[id].normalize())<1e-6,'Normals equal independent physical face sums');assert(Math.hypot(p.getX(id),p.getZ(id))<.60);}
 const before=n.array.slice();g.computeVertexNormals();assert.deepEqual(n.array,before,'No substituted lighting normal');
}
for(const form of forms){
 test(`${form.name}: ${form.name==='grazed'?'historical6e9':'actual'} mixed progressive topology retains exact source endpoints, caps, envelopes and complete rendering budget`,()=>{
  const g=form.create(T),f=fixture.forms[form.name];try{
   const p=g.attributes.position,rs=ranges(g),counts={};assert.equal(rs.length,form.leaves);assert.equal(p.count,form.vertices);assert.equal(g.index.count/3,form.triangles);assert.equal(bytes(g),form.bytes);
   assert.deepEqual(g.boundingBox.min.toArray(),f.bounds.min);assert.deepEqual(g.boundingBox.max.toArray(),f.bounds.max);assert.deepEqual(g.boundingSphere.center.toArray(),f.sphere.center);assert.equal(g.boundingSphere.radius,f.sphere.radius);
   assert.equal(g.boundingBox.min.y,0);assert(Number.isFinite(g.boundingSphere.radius));
   let nextVertex=0,nextIndex=0;
   for(const r of rs){const old=f.leafRanges.find(a=>a.sourceLeaf===r.sourceLeaf);assert(old);assert.equal(r.vertexStart,nextVertex);assert.equal(r.indexStart,nextIndex);assert.equal(r.upright,old.upright);assert.equal(r.bent,old.bent);counts[r.vertexCount]=(counts[r.vertexCount]??0)+1;
    for(const name of ['position','uv','color'])for(const[id,j]of[[r.vertexStart,old.vertexStart],[r.vertexStart+1,old.vertexStart+1],[r.vertexStart+r.vertexCount-1,old.vertexStart+old.vertexCount-1]])assert.deepEqual(data(g.attributes[name],id),oldData(f,name,j),`Exact source ${name} root/tip ${r.sourceLeaf}`);
    assert.equal(peak(p,r),oldPeak(f,old));assert.equal(r.indexCount,(r.vertexCount-2)*3);assert.deepEqual(Array.from(g.index.array.slice(r.indexStart,r.indexStart+r.indexCount),id=>id-r.vertexStart),patterns[r.vertexCount]);diskTopology(g,r);
    if(r.upright){assert.equal(r.vertexCount,3);assert.equal(r.segments,1);assert.equal(r.bent,false);assert.equal(p.getY(r.vertexStart+2),peak(p,r));}
    else{assert.equal(r.ribbon,true);assert.equal(r.creased,false);assert.equal(r.segments,r.vertexCount===9?4:3);assert.equal(r.progressive===true,r.vertexCount===9);}
    nextVertex+=r.vertexCount;nextIndex+=r.indexCount;
   }
   assert.deepEqual(counts,form.counts);assert.equal(nextVertex,form.name==='seeded'?62:p.count);assert.equal(nextIndex,form.name==='seeded'?126:g.index.count);
   assert.equal((g.userData.lushMeadow??g.userData.grazedSward).profile,form.name==='grazed'?'grazed-sward-progressive-4':'lush-meadow-progressive-4');
  }finally{g.dispose();}
 });
 test(`${form.name}: ${form.name==='grazed'?'historical6e9':'actual'} progressive rising stations taper and roll into real source tips rather than the former broad shoulder fan`,()=>{
  const g=form.create(T),p=g.attributes.position;try{
   for(const r of ranges(g)){if(!r.bent)continue;const h=peak(p,r),base=r.vertexStart,stations=r.vertexCount===9?[[2,3,.29],[4,5,.55],[6,7,.72]]:[[2,3,.29],[4,5,.68]];let priorY=0,priorWidth=Infinity;
    for(const[left,right,t]of stations){const y=(p.getY(base+left)+p.getY(base+right))*.5,width=Math.hypot(p.getX(base+left)-p.getX(base+right),p.getZ(base+left)-p.getZ(base+right));assert(y>priorY);assert(width>0&&width<h*.25);assert(width<priorWidth,'Physical successive blade widths taper');assert.notEqual(p.getY(base+left),p.getY(base+right),'Real transverse roll');for(const side of[left,right])assert(Math.abs(g.attributes.uv.getY(base+side)-t)<1e-6);priorY=y;priorWidth=width;}
    if(r.vertexCount===9){assert(Math.abs((p.getY(base+2)+p.getY(base+3))/(2*h)-.45)<1e-6,'First progressive shoulder reaches45%, not former78%');assert(Math.abs((p.getY(base+4)+p.getY(base+5))/(2*h)-.84)<1e-6);const d1=p.getY(base+2)-p.getY(base+3),d2=p.getY(base+4)-p.getY(base+5),d3=p.getY(base+6)-p.getY(base+7);assert(d1*d2<0&&d2*d3<0,'Successive transverse rolls change the physical ribbon plane');}
    else assert((p.getY(base+2)+p.getY(base+3))/(2*h)<.766);
    const tipY=p.getY(base+r.vertexCount-1);assert(tipY<h);assert(tipY>=h*.9499&&tipY<=h*.9661);assert(p.getY(base+2)<tipY);assert(p.getY(base+3)<tipY);
   }
   const ratio=area(g,true)/area(fixture.forms[form.name],true),surfaceRatio=area(g)/area(fixture.forms[form.name]);assert(ratio>.45&&ratio<.65,'New narrower-profile physical coverage interval relative to actual3944; former area gate remains historical');assert(surfaceRatio>.50&&surfaceRatio<.70,'Actual physical surface remains substantial at the new slender profile');
  }finally{g.dispose();}
 });
 test(`${form.name}: ${form.name==='grazed'?'historical6e9':'actual'} triangles retain computed normal cones and finite facing through wind and original full-size anisotropic placement`,()=>{
  const g=form.create(T);try{physicalNormals(g);const p=g.attributes.position,n=g.attributes.normal;
   for(const basis of[{xz:.766,y:.207},{xz:.663,y:.235}])for(const tilt of[-.05,.05])for(const heading of[.23,2.17])for(const wind of[[0,0],[.31,-.16],[-.31,.16]])for(const fade of[1]){
    const ratio=basis.y/basis.xz,xf=Math.sqrt(fade),shear=new T.Matrix4().set(xf,wind[0]*ratio*fade,0,0,0,fade,0,0,0,wind[1]*ratio*fade,xf,0,0,0,0,1),base=new T.Matrix4().compose(new T.Vector3(82.16113,1.1373,-107.748565),new T.Quaternion().setFromEuler(new T.Euler(0,heading,tilt)),new T.Vector3(basis.xz,basis.y,basis.xz)),matrix=base.multiply(shear),normalMatrix=new T.Matrix3().getNormalMatrix(matrix),points=Array.from({length:p.count},(_,id)=>vector(p,id).applyMatrix4(matrix));
    for(let at=0;at<g.index.count;at+=3){const ids=Array.from(g.index.array.slice(at,at+3)),[a,b,c]=ids.map(id=>points[id]),face=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));assert(face.length()>1e-12);assert(face.toArray().every(Number.isFinite));face.normalize();for(const id of ids){const normal=vector(n,id).applyMatrix3(normalMatrix).normalize();assert(normal.toArray().every(Number.isFinite));assert(face.dot(normal)>0,JSON.stringify({message:'Physical facing retained, no upright/seed exception',form:form.name,tri:at/3,id,dot:face.dot(normal),basis,fade,wind,tilt,heading}));}}
   }
   // The original physical-facing gate is full-size. Positive-fade seed tube
   // normals are independently preserved; no all-retirement facing claim.
   for(const fade of[0,.01,.5,1])for(const wind of[[.31,-.16],[-.31,.16]])for(let id=0;id<p.count;id++){
    const v=vector(p,id),xf=Math.sqrt(fade),y=v.y*fade,ratio=.207/.766;
    const drawn=[v.x*xf+wind[0]*ratio*y,y,v.z*xf+wind[1]*ratio*y];
    assert(drawn.every(Number.isFinite),'Actual shader retirement positions remain finite, including zero fade');
   }
  }finally{g.dispose();}
 });
}

test('actual seeded fine leaves, stems, grain heads and all relative seed indices remain exact',()=>{
 const g=createGrassFamilyGeometry(T,2),f=fixture.forms.seeded;try{const last=ranges(g).at(-1),oldLast=f.leafRanges.at(-1),start=last.vertexStart+last.vertexCount,oldStart=oldLast.vertexStart+oldLast.vertexCount,indexStart=last.indexStart+last.indexCount,oldIndexStart=oldLast.indexStart+oldLast.indexCount;assert.equal(start,62);assert.equal(oldStart,62);assert.equal(g.userData.lushMeadow.seedTriangles,28);
  for(const name of Object.keys(g.attributes)){const a=g.attributes[name],old=f.attributes[name];assert.deepEqual(Array.from(a.array.slice(start*a.itemSize)),old.array.slice(oldStart*old.itemSize));}
  assert.deepEqual(Array.from(g.index.array.slice(indexStart),id=>id-start),f.indices.slice(oldIndexStart).map(id=>id-oldStart));
  for(const id of[14,17]){const r=ranges(g).find(r=>r.sourceLeaf===id),old=f.leafRanges.find(r=>r.sourceLeaf===id);for(const name of Object.keys(g.attributes))for(let i=0;i<3;i++)assert.deepEqual(data(g.attributes[name],r.vertexStart+i),oldData(f,name,old.vertexStart+i));}
 }finally{g.dispose();}
});

test('the exact near min-X is owned by a drawn lower sheath edge with new progressive Y/Z, not an extent sentinel',()=>{
 const g=createGrassTuftGeometry(T,{profile:'near-folded-v1'}),f=fixture.forms.near;try{const r=ranges(g).find(r=>r.sourceLeaf===8),old=f.leafRanges.find(r=>r.sourceLeaf===8),id=r.vertexStart+3,a=g.attributes.position;assert.equal(a.getX(id),f.attributes.position.array[(old.vertexStart+3)*3]);assert.equal(a.getX(id),g.boundingBox.min.x);assert.notEqual(a.getY(id),f.attributes.position.array[(old.vertexStart+3)*3+1]);assert.notEqual(a.getZ(id),f.attributes.position.array[(old.vertexStart+3)*3+2]);let used=0;for(let at=0;at<g.index.count;at+=3)if(Array.from(g.index.array.slice(at,at+3)).includes(id))used++;assert.equal(used,3);}finally{g.dispose();}
});

function sampleConstructor(create){let allocated=0,calls=0,state=123456789;const saved=Math.random;const t=new Proxy({...T,BufferGeometry:class extends T.BufferGeometry{constructor(...args){super(...args);allocated++;}}},{get(target,name){if(typeof name==='string'&&/(?:Material|Texture)$/.test(name))return class{constructor(){throw Error('Unexpected '+name);}};return target[name];}});Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const geometry=create(t),count=calls,future=Array.from({length:24},()=>Math.random());return{geometry,calls:count,future,allocated};}finally{Math.random=saved;}}
test('current nongrazed and historical6e9 grazed geometry allocates one source, four UUID draws, unchanged future24 and zero materials/textures',()=>{
 let state=123456789;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};for(let i=0;i<4;i++)rng();const future=Array.from({length:24},rng);
 for(const f of forms){const a=sampleConstructor(f.create);try{assert.equal(a.allocated,1);assert.equal(a.calls,4);assert.deepEqual(a.future,future);}finally{a.geometry.dispose();}}
 assert.deepEqual(GRASS_FAMILIES.map(f=>f.leaves),[14,14,10]);assert.equal(GRAZED_SWARD.leaves,14);assert.equal(GRAZED_SWARD.bentLeaves,12);
});

test('invalid actual factory requests fail before geometry allocation',()=>{
 const t={...T,BufferGeometry:class extends T.BufferGeometry{constructor(){throw Error('Unexpected geometry allocation');}}};
 for(const options of[{leafCount:3},{leafCount:15},{leafCount:4.5},{segments:4},{profile:'unknown'}])assert.throws(()=>createLushMeadowGeometry(t,options),/Invalid lush meadow geometry/);
 for(const id of[-1,3,1.5,NaN])assert.throws(()=>createGrassFamilyGeometry(t,id),/Unknown grass family/);
});
