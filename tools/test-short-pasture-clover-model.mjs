import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import * as live from '../assets/course-turf.mjs';
const previousSource=fs.readFileSync(new URL('./fixtures/course-turf-density3.mjs',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(sha(previousSource),'8c924367ce0be49b16f1cba6bbe11d48a9506157de3afbd40f14b618e7cf1903');
const previous=await import('./fixtures/course-turf-density3.mjs');
const vector=(a,i)=>new T.Vector3().fromBufferAttribute(a,i);
const area=(g,project=false)=>{let area=0;const p=g.attributes.position;for(let i=0;i<g.index.count;i+=3){const ids=Array.from(g.index.array.subarray(i,i+3)),[a,b,c]=ids.map(id=>vector(p,id)),cross=b.sub(a).cross(c.sub(a));area+=(project?Math.abs(cross.y):cross.length())*.5;}return area;};
const bytes=g=>Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+g.index.array.byteLength;

test('actual original clover underlayer has32 real vertices and24triangles, rooted3leaf canopy, finite UV/color and real computed normals',()=>{
 const g=live.createMownCourseTurfGeometry(T),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 try{
  assert.equal(p.count,32);assert.equal(g.index.count/3,24);assert.equal(bytes(g),1552);assert.deepEqual([g.userData.mownCourseTurf.leaves,g.userData.mownCourseTurf.grassLeaves,g.userData.mownCourseTurf.cloverLeaves],[4,1,3]);
  for(const a of Object.values(g.attributes)){assert.equal(a.count,p.count);assert(Array.from(a.array).every(Number.isFinite));}assert(Array.from(uv.array).every(v=>v>=0&&v<=1));
  const sums=Array.from({length:p.count},()=>new T.Vector3()),used=new Set();
  for(let i=0;i<g.index.count;i+=3){const ids=Array.from(g.index.array.subarray(i,i+3));assert(ids.every(id=>id>=0&&id<p.count));const[a,b,c]=ids.map(id=>vector(p,id)),cross=b.sub(a).cross(c.sub(a));assert(cross.length()>1e-7);for(const id of ids){used.add(id);sums[id].add(cross);assert(cross.clone().normalize().dot(vector(n,id))>.5,'Computed vertex normal remains on every physical face side');}}
  assert.equal(used.size,p.count);for(let i=0;i<p.count;i++){assert(Math.abs(vector(n,i).length()-1)<1e-6);assert(vector(n,i).distanceTo(sums[i].normalize())<1e-6);}
  const saved=n.array.slice();g.computeVertexNormals();assert.deepEqual(n.array,saved);
  for(const r of g.userData.mownCourseTurf.leafRanges){assert.equal(p.getY(r.vertexStart),0);assert.equal(p.getY(r.vertexStart+1),0);if(r.kind==='clover'){assert.equal(r.vertexCount,9);assert.equal(r.indexCount,21);assert(p.getY(r.vertexStart+8)>p.getY(r.vertexStart+2));assert(p.getY(r.vertexStart+5)<p.getY(r.vertexStart+4),'Real heart notch lies below its neighboring lobe');}}
 }finally{g.dispose();}
});
test('the canopy has materially more projected leaf area while keeping actual8cm cap, animatedR.34 bound and no added model budget',()=>{
 const old=previous.createMownCourseTurfGeometry(T),g=live.createMownCourseTurfGeometry(T);
 try{const p=g.attributes.position;assert.equal(g.boundingBox.min.y,0);assert.equal(g.boundingBox.max.y,old.boundingBox.max.y);let radius=0;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));assert(radius<.14);assert(radius*1.10+.08+.08*1.10*.70+.08*Math.hypot(.31,.16)<.34);assert(area(g,true)>area(old,true)*1.75,'Actual broad short leaf area increases, not a hidden bounds proxy');assert(area(g)>.004);assert.equal(g.index.count,old.index.count);assert(bytes(g)<bytes(old));assert.equal(bytes(old),1904);}finally{g.dispose();old.dispose();}
});
test('the exact density3 planner, packer, readiness, resource, RNG and disposal suffix is byte-preserved',()=>{
 let source=fs.readFileSync(new URL('../assets/course-turf.mjs',import.meta.url),'utf8');for(const[after,before]of [["profile:'mown-course-turf-4'","profile:'mown-course-turf-3'"],['triangles:24,leaves:4,sourceHeight:.08','triangles:24,leaves:8,sourceHeight:.08']]){assert.equal(source.split(after).length,2);source=source.replace(after,before);}const marker='// canRoot applies';assert.equal(source.slice(source.indexOf(marker)),previousSource.slice(previousSource.indexOf(marker)));assert.equal(source.slice(0,source.indexOf('export function createMownCourseTurfGeometry(T)')),previousSource.slice(0,previousSource.indexOf('export function createMownCourseTurfGeometry(T)')));assert.equal(live.MOWN_COURSE_TURF.profile,'mown-course-turf-4');assert.equal(live.MOWN_COURSE_TURF.leaves,4);for(const key of Object.keys(previous.MOWN_COURSE_TURF).filter(k=>!['profile','leaves'].includes(k)))assert.equal(live.MOWN_COURSE_TURF[key],previous.MOWN_COURSE_TURF[key],key+' retained density3 setting');
});
test('actual current packing on sloping and curved ground keeps complete canopy buried roots and3–8cm row caps',()=>{
 for(const ground of [(x,z)=>.22*x-.18*z,(x,z)=>.10*x-.04*z+.001*x*x+.0015*z*z]){
  const plan=live.createMownCourseTurfPlanner({canRoot:()=>true,heightAt:ground,colorAt:()=>[.3,.5,.2],courseDistance:(x,z)=>Math.abs(z)}).plan(0,0),mat=new T.MeshStandardMaterial(),mesh=live.createMownCourseTurfMesh(T,mat);assert(plan.rows.length>0);const stats=live.packMownCourseTurf(mesh,plan);assert.equal(mesh.material,mat);assert.equal(stats.triangles,plan.rows.length*24);assert.equal(stats.instanceBytes,760000);
  for(let i=0;i<Math.min(400,plan.rows.length);i++){const m=new T.Matrix4().fromArray(mesh.instanceMatrix.array,i*16);assert(m.determinant()>0);for(let j=0;j<mesh.geometry.attributes.position.count;j++){const p=vector(mesh.geometry.attributes.position,j).applyMatrix4(m);assert(p.y-ground(p.x,p.z)<=.08002);assert(p.y-ground(p.x,p.z)>=-.004);}}
  mesh.geometry.dispose();mesh.dispose();mat.dispose();
 }
});
test('actual canopy and mesh construction preserve global gameplay RNG and share one existing material',()=>{
 const mat=new T.MeshStandardMaterial(),saved=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('Global gameplay RNG touched');};
 try{const mesh=live.createMownCourseTurfMesh(T,mat);assert.equal(mesh.material,mat);assert.equal(draws,0);assert.equal(Math.random!==saved,true);assert.equal(mesh.instanceMatrix.count,10000);assert.equal(mesh.geometry.index.count/3,24);mesh.geometry.dispose();mesh.dispose();assert.equal(draws,0);}finally{Math.random=saved;mat.dispose();}
});

test('actual physical sides remain finite through terrain basis, local-Y wind and short-height parting transforms',()=>{
 const g=live.createMownCourseTurfGeometry(T),p=g.attributes.position,n=g.attributes.normal;
 try{for(const ys of [.375,1])for(const spread of [.85,1.1])for(const angle of [0,.71,2.2])for(const [wx,wz,sy]of [[0,0,1],[.31,-.16,.70],[-.2,.25,.82]]){
  const terrain=new T.Matrix4().makeRotationFromEuler(new T.Euler(.18,angle,-.22)),scale=new T.Matrix4().makeScale(spread,ys,spread),wind=new T.Matrix4().set(1,wx,0,0,0,sy,0,0,0,wz,1,0,0,0,0,1),matrix=terrain.clone().multiply(scale).multiply(wind),normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
  for(let i=0;i<g.index.count;i+=3){const ids=Array.from(g.index.array.subarray(i,i+3)),[a,b,c]=ids.map(id=>vector(p,id).applyMatrix4(matrix)),face=b.sub(a).cross(c.sub(a));assert(face.length()>1e-8);face.normalize();for(const id of ids){const normal=vector(n,id).applyMatrix3(normalMatrix).normalize();assert(normal.toArray().every(Number.isFinite));assert(face.dot(normal)>0,'Real drawn physical side survives conservative animation/terrain transforms');}}
 }}finally{g.dispose();}
});


test('declared pasture leaf metadata equals actual real leaf ranges and species counts',()=>{const g=live.createMownCourseTurfGeometry(T);try{assert.equal(live.MOWN_COURSE_TURF.leaves,g.userData.mownCourseTurf.leafRanges.length);assert.equal(g.userData.mownCourseTurf.profile,live.MOWN_COURSE_TURF.profile);assert.equal(g.userData.mownCourseTurf.leaves,g.userData.mownCourseTurf.grassLeaves+g.userData.mownCourseTurf.cloverLeaves);assert.equal(g.userData.mownCourseTurf.leafRanges.filter(r=>r.kind==='clover').length,3);assert.equal(g.userData.mownCourseTurf.leafRanges.filter(r=>r.kind==='clipped-grass').length,1);}finally{g.dispose();}});
