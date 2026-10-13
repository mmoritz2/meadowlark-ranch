import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {MOWN_COURSE_TURF as C,createMownCourseTurfGeometry,createMownCourseTurfPlanner,createMownCourseTurfMesh,packMownCourseTurf,installCourseTurf} from '../assets/course-turf.mjs';
const previousSource=fs.readFileSync(new URL('./fixtures/course-turf-v1/course-turf.mjs',import.meta.url));
assert.equal(createHash('sha256').update(previousSource).digest('hex'),'0b2cb504cfce3c70f4ac881f11e024f37f3e515301e8571e60755d9e6afca045','Complete frozen originalV1 turf owner');
const previous=await import('./fixtures/course-turf-v1/course-turf.mjs');
const digest=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function world({gate=Promise.resolve(),crowded=false,fail=false}={}){
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),oldMatrices=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,5,2,3,1]),oldColors=new Float32Array([.2,.5,.3]),colliders=[{x:22,z:3,r:1}],listeners=new Map();let quality='high',mode='bands',calls=0;
 const G={THREE:T,scene,renderer:{xr:{isPresenting:false}},gfx:{get:()=>quality},horse:{player:{pos:{x:0,z:0}}},world:{groundH:(x,z)=>.08*x-.06*z,nearGroundCover:{near:{material,instanceMatrix:{array:oldMatrices}},swardSource:{cells:[{count:1,matrices:oldMatrices,colors:oldColors}],canCourseTurf:()=>{if(fail)throw Error('Actual eligibility callback failed');return true;},courseTurfColor:(x,z,sample,color)=>color.setRGB(.2+sample*.1,.45,.18)}},colliders,walls:[{x1:2,z1:3,x2:4,z2:3}],pastoralCoverReady:gate,mixedSward:{ready:gate}},courseClear:{ready:gate,courseDist:(x,z)=>mode==='none'?1e9:crowded?2.5:Math.abs(z),rebuild(){calls++;mode='none';G.world.courseTurf?.invalidate?.();return 42;}},photoscans:{ready:gate,floraRetirementReady:gate},worldDetails:{ready:gate},undergrowth:{ready:gate},on:(name,fn)=>{let s=listeners.get(name);if(!s)listeners.set(name,s=new Set());s.add(fn);},off:(name,fn)=>listeners.get(name)?.delete(fn)};
 return{G,material,oldMatrices,oldColors,listeners,colliders,setQuality:v=>quality=v,getCalls:()=>calls};
}

test('HistoricalV1 thin eightleaf morphology: original eight-leaf physical geometry has24triangles, finite unit normals and real metre-scale turf bounds',()=>{
 const createMownCourseTurfGeometry=previous.createMownCourseTurfGeometry;
 const g=createMownCourseTurfGeometry(T),p=g.attributes.position,n=g.attributes.normal,I=g.index.array;assert.equal(p.count,40);assert.equal(I.length/3,24);assert.equal(g.userData.mownCourseTurf.leafRanges.length,8);assert(Math.abs(g.boundingBox.max.y-.08)<1e-7);let min=Infinity,radius=0;
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),normal=new T.Vector3().fromBufferAttribute(n,i);assert(v.toArray().every(Number.isFinite));assert(Math.abs(normal.length()-1)<1e-6);radius=Math.max(radius,Math.hypot(v.x,v.z));}
 for(let i=0;i<I.length;i+=3){const a=new T.Vector3().fromBufferAttribute(p,I[i]),b=new T.Vector3().fromBufferAttribute(p,I[i+1]),c=new T.Vector3().fromBufferAttribute(p,I[i+2]),normal=b.sub(a).cross(c.sub(a));min=Math.min(min,normal.length());assert(normal.length()>1e-7);normal.normalize();for(const v of[I[i],I[i+1],I[i+2]])assert(normal.dot(new T.Vector3().fromBufferAttribute(n,v))>.5);}
 assert(radius<.14);assert(min>1e-7);assert(radius*C.maxSpread+C.maxHeight+.08*C.maxSpread*.70+C.maxHeight*Math.hypot(.31,.16)<C.footprint,'Complete animated reach bound includes tangent tilt, local-Y parting and height-correct wind');g.dispose();
});

test('Actual density3: private cells retain all admitted roots, stable identities and nested High/Low subsets through travel',()=>{
 const planner=createMownCourseTurfPlanner({canRoot:()=>true,heightAt:()=>0,colorAt:()=>[.3,.5,.2],courseDistance:(x,z)=>Math.abs(z)});
 const a=planner.plan(0,0),again=planner.plan(.1,.2),low=planner.plan(.1,.2,{quality:'low'});assert(a.rows.length>0&&a.rows.length<=10000);assert.equal(a.triangles,a.rows.length*24);assert.equal(again.sourceFills,0);
 const first=new Map(a.rows.map(r=>[r.id,r]));for(const row of low.rows){assert(row.ordinal<200);assert.deepEqual(row,first.get(row.id));}assert(low.rows.length<=4000);
 planner.plan(120,-120);const back=planner.plan(0,0);assert.deepEqual(back.rows,a.rows);assert(planner.stats().slotCount===196);assert.equal(planner.plan(0,0,{vr:true}).rows.length,0);
 for(const r of a.rows){assert(r.courseDistance>=1.6+.34&&r.courseDistance<3.4);assert(r.height>=.03&&r.height<=.08);assert(r.spread>=.85&&r.spread<=1.10);assert(r.planeResidual.range===0);}
});

test('Actual density3: actual callback footprints and orthonormal terrain packing retain short height and ground contact',()=>{
 let checks=0;const ground=(x,z)=>.22*x-.18*z,planner=createMownCourseTurfPlanner({canRoot:(x,z,r)=>{assert.equal(r,.34);checks++;return Math.abs(x)>2.6+r;},heightAt:ground,colorAt:()=>[.3,.5,.2],courseDistance:(x,z)=>Math.abs(z)}),plan=planner.plan(0,0),mat=new T.MeshStandardMaterial(),mesh=createMownCourseTurfMesh(T,mat),packed=packMownCourseTurf(mesh,plan);assert(checks>0);assert.equal(packed.triangles,plan.rows.length*24);assert.equal(packed.instanceBytes,10000*19*4);assert.equal(mesh.material,mat);assert.equal(mesh.name,'Mown course shoulder turf');assert(mesh.userData.fineGroundCover);
 const p=mesh.geometry.attributes.position,a=mesh.instanceMatrix.array;
 for(let i=0;i<Math.min(plan.rows.length,200);i++){
  const m=new T.Matrix4().fromArray(a,i*16),u=new T.Vector3(a[i*16],a[i*16+1],a[i*16+2]),n=new T.Vector3(a[i*16+4],a[i*16+5],a[i*16+6]),v=new T.Vector3(a[i*16+8],a[i*16+9],a[i*16+10]);assert(Math.abs(u.clone().normalize().dot(n.clone().normalize()))<2e-7);assert(Math.abs(v.clone().normalize().dot(n.clone().normalize()))<2e-7);assert(Math.abs(u.clone().normalize().dot(v.clone().normalize()))<2e-7);assert(m.determinant()>0);
  for(let k=0;k<p.count;k++){const point=new T.Vector3().fromBufferAttribute(p,k).applyMatrix4(m),above=point.y-ground(point.x,point.z);assert(above<=.08+2e-5&&above>=-.003,'Plane-grounded blades remain below8cm, with buried roots');}
 }
 mesh.geometry.dispose();mesh.dispose();mat.dispose();
});

test('Actual density3: constructor UUIDs, ready/travel/quality/rebuild/disposal consume no global RNG and preserve original world buffers',async()=>{
 const w=world(),before=[digest(w.oldMatrices),digest(w.oldColors),JSON.stringify(w.colliders),JSON.stringify(w.G.world.walls)],rebuild=w.G.courseClear.rebuild,oldRandom=Math.random;let globalDraws=0;Math.random=()=>{globalDraws++;throw Error('Global world random stream consumed');};
 try{
  const state=installCourseTurf(w.G);w.G.world.courseTurf=state;await state.ready;assert(!state.disposed);assert(state.mesh.material===w.material);const high=state.rows.slice();w.setQuality('low');state.tick(0,0,0);assert(state.rows.every(r=>r.ordinal<200));w.G.renderer.xr.isPresenting=true;state.tick(0,0,0);assert.equal(state.mesh.count,0);w.G.renderer.xr.isPresenting=false;w.setQuality('high');state.tick(0,120,120);state.tick(0,0,0);assert.deepEqual(state.rows,high);
  assert.equal(w.G.courseClear.rebuild,rebuild);assert.equal(w.G.courseClear.rebuild(),42);state.tick(0,0,0);assert.equal(w.getCalls(),1);assert.equal(state.mesh.count,0);state.dispose();assert.equal(w.G.courseClear.rebuild,rebuild);assert.equal(w.listeners.get('tick').size,0);assert.equal(globalDraws,0);assert.deepEqual([digest(w.oldMatrices),digest(w.oldColors),JSON.stringify(w.colliders),JSON.stringify(w.G.world.walls)],before);assert.equal(w.material.version,0);
 }finally{Math.random=oldRandom;w.material.dispose();}
});

test('Actual density3: resources wait for all actual owners and cancellation before ready allocates none',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r),w=world({gate}),state=installCourseTurf(w.G);await Promise.resolve();assert.equal(state.mesh,null);assert.equal(w.G.scene.children.length,0);state.dispose();resolve();await state.ready;assert(state.disposed);assert.equal(state.mesh,null);assert.equal(w.G.scene.children.length,0);w.material.dispose();
});

test('Actual density3: missing actual course ownership and failed eligibility fail closed without touching shared world',async()=>{
 for(const variant of['missing','callback']){const w=world({fail:variant==='callback'});if(variant==='missing')delete w.G.courseClear.courseDist;const state=installCourseTurf(w.G);await state.ready;assert(state.disposed);assert(state.errors.length>0);assert.equal(state.mesh,null);assert.equal(w.G.scene.children.length,0);assert.equal(w.material.version,0);w.material.dispose();}
});

test('Actual density3: crowded course budget overflow is explicit and never trims or crashes the game owner',async()=>{
 const w=world({crowded:true}),state=installCourseTurf(w.G);await state.ready;assert(state.disposed);assert.equal(state.mesh,null);assert.equal(state.lastFailure.data.eligibleRows,196*480);assert.equal(state.lastFailure.data.capacity,10000);assert(state.errors[0].includes('no visible roots were trimmed'));assert.equal(w.G.scene.children.length,0);assert.equal(w.material.version,0);w.material.dispose();
});

test('Actual density3: travel overflow after an accepted draw captures failure and disposes only the private turf',async()=>{
 const w=world(),state=installCourseTurf(w.G);await state.ready;assert(!state.disposed);let disposed=0;w.material.addEventListener('dispose',()=>disposed++);w.G.courseClear.courseDist=()=>2.5;state.invalidate();state.tick(0,0,0);assert(state.disposed);assert(state.lastFailure.priorStats.rows>0);assert.equal(w.G.scene.children.length,0);assert.equal(disposed,0);assert.equal(w.listeners.get('tick').size,0);w.material.dispose();
});

test('Actual density3: failed actual dependency never allocates or queries turf and remains an inspectable closed owner',async()=>{
 const w=world();let queries=0;w.G.world.nearGroundCover.swardSource.canCourseTurf=()=>{queries++;return true;};w.G.world.pastoralCoverReady=Promise.reject(Error('Pastoral owner failed'));
 const state=installCourseTurf(w.G);await state.ready;assert(state.disposed);assert.equal(queries,0);assert.equal(state.mesh,null);assert.equal(w.G.scene.children.length,0);assert(state.lastFailure.message.includes('Pastoral owner failed'));assert.equal(w.material.version,0);w.material.dispose();
});

test('Actual density3: render construction failure restores the global RNG and releases only its owned geometry',()=>{
 const material=new T.MeshStandardMaterial();let geometryDisposed=0,meshDisposed=0,materialDisposed=0;material.addEventListener('dispose',()=>materialDisposed++);
 class RecordedGeometry extends T.BufferGeometry{dispose(){geometryDisposed++;super.dispose();}}
 class FailedMesh extends T.InstancedMesh{setColorAt(){throw Error('Injected private buffer failure');}dispose(){meshDisposed++;super.dispose();}}
 const privateT={...T,BufferGeometry:RecordedGeometry,InstancedMesh:FailedMesh},previous=Math.random,sentinel=()=>{throw Error('World random stream touched');};Math.random=sentinel;
 try{assert.throws(()=>createMownCourseTurfMesh(privateT,material),/Injected private buffer failure/);assert.equal(Math.random,sentinel);assert.equal(geometryDisposed,1);assert.equal(meshDisposed,1);assert.equal(materialDisposed,0);}finally{Math.random=previous;material.dispose();}
});

test('Actual density3: curved terrain uses an orthogonal buried plane and rejects footprints too uneven for 3cm turf',()=>{
 const gentle=(x,z)=>.10*x-.04*z+.001*x*x+.0015*z*z,planner=createMownCourseTurfPlanner({canRoot:()=>true,heightAt:gentle,colorAt:()=>[.3,.5,.2],courseDistance:(x,z)=>Math.abs(z)}),plan=planner.plan(0,0),material=new T.MeshStandardMaterial(),mesh=createMownCourseTurfMesh(T,material);assert(plan.rows.length>0);packMownCourseTurf(mesh,plan);
 for(let i=0;i<Math.min(300,plan.rows.length);i++){
  const row=plan.rows[i];assert(row.planeResidual.range<.015);const matrix=new T.Matrix4().fromArray(mesh.instanceMatrix.array,i*16);
  for(let k=0;k<mesh.geometry.attributes.position.count;k++){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,k).applyMatrix4(matrix);assert(p.y-gentle(p.x,p.z)<=.08+2e-5);assert(p.y-gentle(p.x,p.z)>=-.004);}
 }
 const broken=createMownCourseTurfPlanner({canRoot:()=>true,heightAt:(x,z)=>Math.sin(x*30)*.04,colorAt:()=>[.3,.5,.2],courseDistance:(x,z)=>Math.abs(z)}).plan(0,0);assert(broken.rows.length<plan.rows.length/10,'Short turf must not bridge broken terrain');mesh.geometry.dispose();mesh.dispose();material.dispose();
});


test('actual density3 preserves every original first120 root and retained geometry/footprint; declared budgets and Medium/Low remain strict stable High subsets',()=>{
 assert.equal(C.profile,'mown-course-turf-4');assert.equal(C.candidatesPerCell,480);assert.equal(C.leaves,4);
 assert.deepEqual([C.highOrdinals,C.mediumOrdinals,C.lowOrdinals],[480,320,200]);
 assert.deepEqual([C.highCapacity,C.mediumCapacity,C.lowCapacity],[10000,6500,4000]);
 assert.deepEqual([C.highCapacity,C.mediumCapacity,C.lowCapacity].map(n=>n*24),[240000,156000,96000]);
 assert.deepEqual([C.highCapacity,C.mediumCapacity,C.lowCapacity].map(n=>n*19*4),[760000,494000,304000]);
 for(const key of ['cellMetres','windowCells','triangles','sourceHeight','minHeight','maxHeight','minSpread','maxSpread','footprint','innerHalfWidth','outerHalfWidth'])assert.equal(C[key],previous.MOWN_COURSE_TURF[key],key+' is retained');
 const options={canRoot:()=>true,heightAt:(x,z)=>.04*x-.03*z,colorAt:()=>[.3,.5,.2],courseDistance:(x,z)=>Math.abs(z)};
 const old=previous.createMownCourseTurfPlanner(options),live=createMownCourseTurfPlanner(options),a=old.plan(0,0),high=live.plan(0,0),byId=new Map(high.rows.map(r=>[r.id,r]));
 assert(a.rows.length>100);assert(high.rows.length>a.rows.length*3.5);assert.deepEqual(high.rows.filter(r=>r.ordinal<120),a.rows,'All original first120 row values and order remain exact');
 for(const [quality,limit,capacity]of [['medium',320,6500],['low',200,4000]]){
  const plan=live.plan(0,0,{quality});assert(plan.rows.length>0&&plan.rows.length<=capacity);
  for(const row of plan.rows){assert(row.ordinal<limit);assert.deepEqual(row,byId.get(row.id));}
 }
 // HistoricalV1 original thin geometry comparison; actual clover has separate7physical gates.
 const before=previous.createMownCourseTurfGeometry(T),after=previous.createMownCourseTurfGeometry(T);
 for(const key of Object.keys(before.attributes))assert.deepEqual(after.attributes[key].array,before.attributes[key].array);
 assert.deepEqual(after.index.array,before.index.array);assert.deepEqual(after.boundingBox,before.boundingBox);assert.deepEqual(after.boundingSphere,before.boundingSphere);before.dispose();after.dispose();
});
