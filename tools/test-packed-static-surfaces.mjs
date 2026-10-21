// Production backend tests: actual assets/solid-collisions.js versus a fixture-only legacy oracle.
// Optional numeric support-index API is tested; no shared support callback is installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {T,fixture,recordedCohort,recordedPoses} from './packed-static-fixture.mjs';
import {createSolidWorld as oldWorld} from './fixtures/packed-static-legacy.mjs';
import {createSolidWorld as packedWorld,recordSolidPart} from '../assets/solid-collisions.js';
import {supportIndex} from './fixtures/packed-static-support-legacy.mjs';
const engines=()=>({a:oldWorld({THREE:T}),b:packedWorld({THREE:T})});
function equal(a,b,message){assert.deepEqual(b,a,message);}
function prepare(b,owner,{slice=256,support=true}={}){const p=b.prepareSurface(owner.mesh,owner.geometry,owner.mesh.matrixWorld,{supportStep:support?.2:null,limits:{vertices:3000,triangles:5000,cells:1024,references:50000}}),times=[];let steps=0,totalOps=0;while(true){const t=performance.now(),r=p.step({maximumOperations:slice});times.push(performance.now()-t);assert(r.operations<=slice);steps++;totalOps+=r.operations;if(r.done)break;assert(steps<2000);}const t=performance.now();assert.equal(p.commit(),4499);return{steps,totalOps,maxSliceMs:Math.max(...times),commitMs:performance.now()-t,stats:p.stats()};}
const point=(o,index)=>new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,index).applyMatrix4(o.mesh.matrixWorld).toArray();
function probes(o){const I=o.geometry.index,all=[];for(const t of[0,499,1499,2499,3999]){const[a,b,c]=[0,1,2].map(k=>point(o,I.getX(t*3+k)));for(const[u,v]of[[1,0],[0,1],[0,0],[.5,.5],[.5,0],[1/3,1/3],[1+1e-10,-1e-10],[1-1e-10,1e-10]]){const w=1-u-v;all.push({x:u*a[0]+v*b[0]+w*c[0],y:u*a[1]+v*b[1]+w*c[1],z:u*a[2]+v*b[2]+w*c[2]});}}return all;}
function compareQueries(a,b,o,{full=true}={}){
 let rays=0,slabs=0,resolves=0,verticals=0;
 const P=probes(o);for(const p of P){equal(a.surfaceHeight(p.x,p.z),b.surfaceHeight(p.x,p.z),'global ray');equal(a.surfaceHeight(p.x,p.z,o.mesh),b.surfaceHeight(p.x,p.z,o.mesh),'owner ray');rays+=2;}
 if(full)for(const p of P.filter((p,i)=>i%5===0))for(const radius of[.0,.55]){
  const previous={x:p.x-.32,z:p.z+.13,bottom:p.y-.6,top:p.y+1,centerY:p.y+.2},opts={bottom:p.y-.25,top:p.y+1.45,radius,previous};equal(a.surfaceContacts(p,opts),b.surfaceContacts(p,opts),'ordered slab hits');slabs++;
  const x={x:p.x,z:p.z},y={...x};equal(a.resolve(x,opts),b.resolve(y,opts),'resolve count');equal(x,y,'resolved coordinates');resolves++;
  equal(a.limitVertical(p.x,p.z,p.y+3,p.y-3,1.7,radius),b.limitVertical(p.x,p.z,p.y+3,p.y-3,1.7,radius),'downward cylinder');equal(a.limitVertical(p.x,p.z,p.y-3,p.y+3,1.7,radius),b.limitVertical(p.x,p.z,p.y-3,p.y+3,1.7,radius),'upward cylinder');verticals+=2;
 }return{rays,slabs,resolves,verticals};
}
for(const {seed}of recordedPoses.cohorts)test('packed API numerical/order parity for recorded actual cohort '+seed,()=>{
 const f=recordedCohort(seed),{a,b}=engines(),supports=new Map();for(const o of f.owners){assert.equal(a.registerSurface(o.mesh,o.geometry,o.mesh.matrixWorld),4499);prepare(b,o);supports.set(o.mesh,supportIndex(o.geometry,o.mesh.matrixWorld));}equal(a.surfaceStats(),b.surfaceStats(),'same owners, exact full facet count and global cells');
 for(const o of f.owners){compareQueries(a,b,o);for(const p of probes(o)){equal(supports.get(o.mesh).heightAt(p.x,p.z),b.surfaceSupportHeight(p.x,p.z,o.mesh),'packed support ray');const expected=Math.max(...[...supports.values()].map(s=>s.heightAt(p.x,p.z)));equal(expected,b.surfaceSupportHeight(p.x,p.z),'shared support dispatch');}}
 for(const o of f.owners){a.unregisterSurface(o.mesh);b.unregisterSurface(o.mesh);equal(a.surfaceStats(),b.surfaceStats());}assert.deepEqual(b.surfaceStorageStats(),{owners:0,bodyCells:0,supportCells:0,bodyReferences:0,supportReferences:0,typedBytes:0});f.restoreVisuals();
});
test('registration order/replacement and overlapping owners preserve ordered contacts and resolution',()=>{
 const f=recordedCohort(),o=f.owners[0],p=f.owners[1],{a,b}=engines();p.mesh.position.copy(o.mesh.position);p.mesh.updateWorldMatrix(true,false);for(const s of[o,p]){a.registerSurface(s.mesh,s.geometry,s.mesh.matrixWorld);prepare(b,s);}compareQueries(a,b,o);a.registerSurface(o.mesh,o.geometry,o.mesh.matrixWorld);prepare(b,o);compareQueries(a,b,o);equal(a.surfaceStats(),b.surfaceStats());f.restoreVisuals();
});
test('visibility, detach, collisionBatched, unregister and explicit complete matrix retain original behavior',()=>{
 const f=recordedCohort(),o=f.owners[0],{a,b}=engines();a.registerSurface(o.mesh,o.geometry,o.mesh.matrixWorld);prepare(b,o);o.mesh.visible=false;compareQueries(a,b,o,{full:false});f.G.scene.remove(o.mesh);compareQueries(a,b,o);o.mesh.userData.collisionBatched=true;compareQueries(a,b,o);o.mesh.userData.collisionBatched=false;f.G.scene.add(o.mesh);o.mesh.visible=true;
 const override=new T.Matrix4().makeTranslation(12,30,-9);a.registerSurface(o.mesh,o.geometry,override);const prep=b.prepareSurface(o.mesh,o.geometry,override);while(!prep.step().done){}assert.equal(prep.commit(),4499);equal(a.surfaceStats(),b.surfaceStats());for(const[x,z]of[[12,-9],[12.5,-8.6],[0,0]])equal(a.surfaceHeight(x,z),b.surfaceHeight(x,z));a.unregister(o.mesh);b.unregister(o.mesh);equal(a.surfaceStats(),b.surfaceStats());f.restoreVisuals();
});
test('private incremental preparations are bounded, cancellable and invisible until complete commit',()=>{
 const f=recordedCohort(),o=f.owners[0],{b}=engines(),prep=b.prepareSurface(o.mesh,o.geometry,o.mesh.matrixWorld,{supportStep:.2});let n=0;for(let i=0;i<12;i++){const r=prep.step({maximumOperations:17});assert.equal(r.operations,17);n+=r.operations;assert.equal(b.hasSurface(o.mesh),false);assert.equal(b.surfaceHeight(o.mesh.position.x,o.mesh.position.z),-Infinity);}assert.equal(prep.stats().totalOperations,n);assert.throws(()=>prep.commit(),/Complete private/);prep.dispose();assert.equal(prep.stats().temporaryBytes,0);assert.equal(prep.stats().retainedBytes,0);assert.throws(()=>prep.step(),/no longer active/);assert.equal(b.surfaceStats().owners,0);f.restoreVisuals();
});
for(const change of['position-data','index-data','attribute','root-matrix','parent'])test('changed '+change+' rejects prepared snapshot and preserves prior registered owner',()=>{
 const f=recordedCohort(),o=f.owners[0],{a,b}=engines();a.registerSurface(o.mesh,o.geometry,o.mesh.matrixWorld);b.registerSurface(o.mesh,o.geometry,o.mesh.matrixWorld);const before=b.surfaceStats(),h=b.surfaceHeight(o.mesh.position.x,o.mesh.position.z),prep=b.prepareSurface(o.mesh,o.geometry,o.mesh.matrixWorld,{supportStep:.2});while(!prep.step().done){}
 if(change==='position-data')o.geometry.attributes.position.array[0]+=.01;else if(change==='index-data')o.geometry.index.array[0]=o.geometry.index.array[0]===0?1:0;else if(change==='attribute')o.geometry.setAttribute('position',o.geometry.attributes.position.clone());else if(change==='root-matrix'){o.mesh.position.x+=1;o.mesh.updateWorldMatrix(true,false);}else f.G.scene.remove(o.mesh);
 assert.throws(()=>prep.commit(),/changed/);equal(before,b.surfaceStats());if(change!=='parent')equal(h,b.surfaceHeight(o.row.matrix[12],o.row.matrix[14]));assert.equal(b.surfaceStorageStats().supportCells,0);prep.dispose();f.restoreVisuals();
});
test('invalid/nonfinite/oversize preparation preserves existing owner; unused nonfinite vertices follow original semantics',()=>{
 const f=fixture(),{a,b}=engines();for(const s of[a,b])s.registerSurface(f.mesh,f.piece.geo,f.mesh.matrixWorld);const bad=f.piece.geo.clone();bad.attributes.position.array[bad.index.array[0]*3]=NaN;assert.throws(()=>a.registerSurface(f.mesh,bad),/Nonfinite/);assert.throws(()=>b.registerSurface(f.mesh,bad),/Nonfinite/);equal(a.surfaceStats(),b.surfaceStats());assert.throws(()=>b.prepareSurface(f.mesh,f.piece.geo,null,{limits:{triangles:1}}),/resource bound/);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,NaN,NaN,NaN],3));geo.setIndex([0,1,2]);assert.equal(a.registerSurface(f.mesh,geo),1);assert.equal(b.registerSurface(f.mesh,geo),1);equal(a.surfaceStats(),b.surfaceStats());for(const[x,z]of[[0,0],[.1,0],[1,0]])equal(a.surfaceHeight(x,z),b.surfaceHeight(x,z));
});
test('vertical/coplanar/degenerate/nonindexed faces and bounded skipped-support loops match old queries',()=>{
 const f=fixture(),{a,b}=engines(),geo=new T.BufferGeometry(),v=[];for(let i=0;i<100;i++)v.push(0,0,0,0,1,0,0,0,1);v.push(1,1,1,1,1,1,1,1,1,0,0,0,1,0,0,0,0,1);geo.setAttribute('position',new T.Float32BufferAttribute(v,3));const root=f.mesh;root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);root.updateWorldMatrix(true,false);assert.equal(a.registerSurface(root,geo),101);const prep=b.prepareSurface(root,geo,null,{supportStep:.2});while(true){const r=prep.step({maximumOperations:3});assert(r.operations<=3);if(r.done)break;}assert.equal(prep.commit(),101);equal(a.surfaceStats(),b.surfaceStats());for(const p of[{x:0,z:.3,y:.4},{x:.2,z:.2,y:0},{x:0,z:0,y:0}]){equal(a.surfaceHeight(p.x,p.z),b.surfaceHeight(p.x,p.z));for(const previous of[null,{x:-1,z:0,centerY:.5}])equal(a.surfaceContacts(p,{bottom:-.1,top:.9,radius:.55,previous}),b.surfaceContacts(p,{bottom:-.1,top:.9,radius:.55,previous}));}
});
test('OBB primitive and moving owner source sections remain byte-exact and behavior agrees with mixed surfaces',()=>{
 const old=fs.readFileSync(new URL('./fixtures/packed-static-legacy.mjs',import.meta.url),'utf8'),packed=fs.readFileSync(new URL('../assets/solid-collisions.js',import.meta.url),'utf8');for(const[start,end]of[[' const keysFor=b=>',' function resolve('],[' function resolve(',' function limitVertical(']])equal(old.slice(old.indexOf(start),old.indexOf(end)),packed.slice(packed.indexOf(start),packed.indexOf(end)));
 const f=recordedCohort(),o=f.owners[0],{a,b}=engines();a.registerSurface(o.mesh,o.geometry,o.mesh.matrixWorld);prepare(b,o);const box=new T.Mesh(new T.BoxGeometry(2,2,2),f.piece.mat);box.position.copy(o.mesh.position);box.position.x+=1;box.userData.sceneryArt={kind:'rowboat'};recordSolidPart(T,box,box.geometry,box.material,new T.Matrix4());f.G.scene.add(box);a.register(box);b.register(box);compareQueries(a,b,o);box.position.z+=.5;a.updateDynamic();b.updateDynamic();equal(a.stats(),b.stats());compareQueries(a,b,o);f.G.scene.remove(box);a.refresh();b.refresh();equal(a.stats(),b.stats());f.restoreVisuals();
});


test('Float64 world snapshots match projective overrides and large translated small facets without float truncation',()=>{
 const f=fixture(),{a,b}=engines(),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float64Array([0,0,0,.0001,.00002,0,0,.00003,.0001,0,.0001,0,.0001,.00012,0,0,.00013,.0001]),3));
 for(const M of[new T.Matrix4().makeTranslation(1000000.123456789,12345.87654321,-1000000.987654321),new T.Matrix4().set(1.3,.1,.2,2,.2,.9,.1,3,.1,.1,1.1,-2,.001,.002,.003,1)]){assert.equal(a.registerSurface(f.mesh,geo,M),2);assert.equal(b.registerSurface(f.mesh,geo,M),2);equal(a.surfaceStats(),b.surfaceStats());for(let i=0;i<6;i++){const p=new T.Vector3().fromBufferAttribute(geo.attributes.position,i).applyMatrix4(M);for(const[x,z]of[[p.x,p.z],[p.x+1e-11,p.z-1e-11]]){equal(a.surfaceHeight(x,z),b.surfaceHeight(x,z));equal(a.surfaceContacts({x,z},{bottom:p.y-.01,top:p.y+.01,radius:.001}),b.surfaceContacts({x,z},{bottom:p.y-.01,top:p.y+.01,radius:.001}));}}}
});
test('malformed counts and unsafe hard-limit overrides reject before any published authority changes',()=>{
 const f=fixture(),{b}=engines();b.registerSurface(f.mesh,f.piece.geo,f.mesh.matrixWorld);const stats=b.surfaceStats(),geo=f.piece.geo.clone();geo.attributes.position.count=3.5;assert.throws(()=>b.prepareSurface(f.mesh,geo),/Invalid static/);assert.throws(()=>b.prepareSurface(f.mesh,f.piece.geo,null,{limits:{references:Infinity}}),/hard resource limits/);equal(stats,b.surfaceStats());
});

// Review regression: owner envelope is strict even though face barycentric
// acceptance retains its existing 1e-10 tolerance. Vertical faces do not widen it.
function nextFloat(value,direction){if(value===0)return direction>0?Number.MIN_VALUE:-Number.MIN_VALUE;const f=new Float64Array([value]),u=new BigUint64Array(f.buffer);u[0]+=BigInt((value>0?1:-1)*direction);return f[0];}
function registerSupport(b,mesh,geometry=mesh.geometry){const p=b.prepareSurface(mesh,geometry,mesh.matrixWorld,{supportStep:.2});while(!p.step().done){}p.commit();}
test('strict support owner bounds reject tiny outward probes and exclude vertical-only extents',()=>{
 const f=fixture(),{b}=engines(),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float64Array([0,1,0,1,1,0,0,1,1,100,0,0,100,1,0,100,0,1]),3));g.setIndex([0,1,2,3,4,5]);const m=new T.Mesh(g,f.piece.mat);f.G.scene.add(m);m.updateWorldMatrix(true,false);const legacy=supportIndex(g,m.matrixWorld);registerSupport(b,m,g);
 equal(legacy.stats.bounds,{minX:0,maxX:1,minZ:0,maxZ:1});for(const[x,z]of[[1,0],[0,1],[0,0],[1+1e-11,0],[0,1+1e-11],[-1e-11,0],[0,-1e-11],[nextFloat(1,1),0],[0,nextFloat(1,1)]])equal(legacy.heightAt(x,z),b.surfaceSupportHeight(x,z,m),'strict envelope parity');assert.equal(b.surfaceSupportHeight(1+1e-11,0,m),-Infinity);b.unregisterSurface(m);
});
test('actual seed1 source2 support envelope rejects each one-ULP outward boundary probe',()=>{
 const f=recordedCohort(1),o=f.owners.find(o=>o.row.index===2),{b}=engines();assert(o);const legacy=supportIndex(o.geometry,o.mesh.matrixWorld);prepare(b,o);const vertices=[];for(let i=0;i<o.geometry.attributes.position.count;i++)vertices.push(point(o,i));let checked=0;
 for(const[axis,bound,direction]of[[0,'minX',-1],[0,'maxX',1],[2,'minZ',-1],[2,'maxZ',1]]){const v=vertices.find(v=>Object.is(v[axis],legacy.stats.bounds[bound]));assert(v);const p=v.slice();p[axis]=nextFloat(p[axis],direction);assert.equal(legacy.heightAt(p[0],p[2]),-Infinity);assert.equal(b.surfaceSupportHeight(p[0],p[2],o.mesh),-Infinity,bound);checked++;}assert.equal(checked,4);b.unregisterSurface(o.mesh);f.restoreVisuals();
});
test('injected owner-map publication mutation restores prior authority and unregister removes every reference',async()=>{
 const {createPackedStaticSurfaces}=await import('../assets/packed-static-surfaces.mjs?v=packed-static-backend-1'),f=fixture();for(const prior of[false,true]){
  const raw=createPackedStaticSurfaces(),make=y=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,y,0,1,y,0,0,y,1],3));g.setIndex([0,1,2]);return g;},old=make(0),newer=make(7),m=new T.Mesh(old,f.piece.mat);f.G.scene.add(m);m.updateWorldMatrix(true,false);if(prior)registerSupport(raw,m,old);const oldPacket=raw.surfaceOwners.get(m),p=raw.prepareSurface(m,newer,m.matrixWorld,{supportStep:.2});while(!p.step().done){}const nativeSet=raw.surfaceOwners.set;raw.surfaceOwners.set=function(...args){nativeSet.apply(this,args);throw Error('injected owner map mutation then throw');};assert.throws(()=>p.commit(),e=>e.phase==='surface-owner-publication'&&e.rollbackRestored===true&&e.cause.message==='injected owner map mutation then throw');assert.equal(raw.surfaceOwners.get(m),oldPacket);assert.equal(raw.surfaceHeight(.2,.2),prior?0:-Infinity);assert.equal(raw.surfaceSupportHeight(.2,.2),prior?0:-Infinity);raw.surfaceOwners.set=nativeSet;raw.unregisterSurface(m);equal(raw.storageStats(),{owners:0,bodyCells:0,supportCells:0,bodyReferences:0,supportReferences:0,typedBytes:0});assert.equal(raw.surfaceHeight(.2,.2),-Infinity);assert.equal(raw.surfaceSupportHeight(.2,.2),-Infinity);p.dispose();
 }
});
