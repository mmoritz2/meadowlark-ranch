import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
import * as C from '../assets/solid-collisions.js';
import * as T from '../assets/vendor/three/build/three.module.js';
const near=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<=eps,`${a} != ${b}`);
function mesh(triangles){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(triangles.flat(2),3));
 const root=new T.Mesh(g,new T.MeshBasicMaterial());root.updateMatrixWorld(true);return root;
}
const vertical=[[[0,0,-2],[0,4,-2],[0,0,2]],[[0,4,-2],[0,4,2],[0,0,2]]];
function world(){return C.createSolidWorld({THREE:T});}
function assertClear(w,p,opts){assert.equal(w.surfaceContacts(p,opts).length,0,JSON.stringify({p,opts,hits:w.surfaceContacts(p,opts)}));}
test('vertical face two-sided, finite, independent visibility; exact-plane prior side retained',()=>{
 const w=world(),root=mesh(vertical);w.registerSurface(root);root.visible=false;
 const opts={bottom:.38,top:2.65,radius:.55};
 for(const x of [-.4,-.02,0,.02,.4]){const p=new T.Vector3(x,0,0),prev=new T.Vector3(x||-.3,0,0);assert(w.resolve(p,{...opts,previous:prev})>0);assertClear(w,p,opts);assert.equal(Math.sign(p.x),Math.sign(prev.x));near(Math.abs(p.x),.552);near(p.z,0);}
 const above=new T.Vector3(.1,0,0);assert.equal(w.resolve(above,{...opts,bottom:4.1,top:6.3}),0);
 w.unregisterSurface(root);assert.equal(w.surfaceStats().triangles,0);assert.equal(w.resolve(new T.Vector3(.1,0,0),opts),0);
});
test('slab clipping preserves actual taper/air, and subdivided slope contacts clear',()=>{
 const tri=[[0,0,-2],[0,4,0],[0,0,2]],w=world();w.registerSurface(mesh([tri]));
 const low={bottom:.2,top:1,radius:.1},high={bottom:3.2,top:3.8,radius:.1};
 assert(w.resolve(new T.Vector3(.02,0,1.3),low)>0);
 assert.equal(w.resolve(new T.Vector3(.02,0,1.3),high),0,'upper taper does not fill lower bounding rectangle');
 const tiles=[];for(let i=0;i<8;i++){const a=i*.5,b=a+.5;tiles.push([[a,a,-2],[b,b,-2],[a,a,2]],[[b,b,-2],[b,b,2],[a,a,2]]);}
 const s=world();s.registerSurface(mesh(tiles));
 for(const x of [.25,1,2,2.8]){const opts={bottom:x-.3,top:x+.7,radius:.55},p=new T.Vector3(x,0,.1);s.resolve(p,opts);assertClear(s,p,opts);}
});
test('vertical sweep sees radius footprint, slopes, ceilings, holes and either winding',()=>{
 const tri=[[-3,-3,-3],[3,3,-3],[-3,-3,3]];
 for(const v of [tri,tri.slice().reverse()]){const range=C.triangleDiskYRange(v,-.5,-.5,.55);near(range.min,-1.05);near(range.max,.05);}
 const w=world();w.registerSurface(mesh([tri]));near(w.limitVertical(-.5,-.5,4,-4,2.3,.55),.05);
 const ceiling=world();ceiling.registerSurface(mesh([[[-3,4,-3],[3,4,-3],[-3,4,3]]]));near(ceiling.limitVertical(-.5,-.5,0,3,2.3,.55),1.7);
 assert.equal(ceiling.limitVertical(4,4,0,3,2.3,.55),3,'open edge/air is not filled by bounds');
 const verticalRange=C.triangleDiskYRange(vertical[0],.1,0,.55);assert(verticalRange&&verticalRange.min===0&&verticalRange.max>1.4);
 assert.equal(C.triangleDiskYRange(vertical[0],1,0,.55),null);
});
test('world matrix is applied once, source remains exact, unregister and static re-register',()=>{
 const root=mesh(vertical),scene=new T.Scene();scene.add(root);root.position.set(-153,20,158);root.scale.setScalar(1.5);root.rotation.y=-.72664234;root.updateWorldMatrix(true,false);
 const p=root.geometry.attributes.position.array.slice(),w=world();assert.equal(w.registerSurface(root),2);
 const explicit=world();assert.equal(explicit.registerSurface(root,root.geometry,root.matrixWorld),2);assert.deepEqual(w.surfaceStats(),explicit.surfaceStats());
 const q=new T.Vector3(.1,1,0).applyMatrix4(root.matrixWorld),r=q.clone(),opts={bottom:20.38,top:22.65,radius:.55};assert.equal(w.resolve(q,opts),explicit.resolve(r,opts));assert.deepEqual(q.toArray(),r.toArray());assert.deepEqual(root.geometry.attributes.position.array,p);
 w.unregister(root);assert.equal(w.surfaceStats().triangles,0);root.position.x+=1;root.updateWorldMatrix(true,false);w.registerSurface(root);assert.equal(w.surfaceStats().triangles,2);
 scene.remove(root);assert.equal(w.resolve(new T.Vector3(root.position.x,20,158),opts),0,'removed scene owner cannot leave contact');
});
function sourceGeometry(){
 const b=fs.readFileSync(path.join(ROOT,'assets/models/world/realism/namaqualand_cliff_02.glb')),jl=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+jl)),bin=b.subarray(28+jl),pr=j.meshes[0].primitives[0];assert.equal(j.nodes.length,1);assert(!j.nodes[0].matrix&&!j.nodes[0].translation&&!j.nodes[0].rotation&&!j.nodes[0].scale);
 function read(id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],n=a.type==='SCALAR'?1:3,bytes=a.componentType===5123?2:4,A=a.componentType===5123?Uint16Array:Float32Array,out=new A(a.count*n),stride=v.byteStride||bytes*n;for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){const p=(v.byteOffset||0)+(a.byteOffset||0)+i*stride+k*bytes;out[i*n+k]=bytes===2?bin.readUInt16LE(p):bin.readFloatLE(p);}return out;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(read(pr.attributes.POSITION),3));g.setIndex(new T.BufferAttribute(read(pr.indices),1));assert.equal(g.index.count,71994);return g;
}
test('actual23998-triangle scan static index/body/air contacts; no RNG or source mutation during registration/query',()=>{
 const g=sourceGeometry(),root=new T.Mesh(g,new T.MeshBasicMaterial()),P=g.attributes.position.array.slice(),I=g.index.array.slice();root.position.set(-153,20,158);root.scale.setScalar(30/(10.54635238647461+9.681148529052734));root.rotation.y=-.72664234;root.updateWorldMatrix(true,false);
 const w=world(),rng=Math.random;let calls=0;Math.random=()=>{calls++;throw Error('unexpected RNG');};
 try{
  assert.equal(w.registerSurface(root),23998);assert.equal(calls,0);
  const triangles=[],v=new T.Vector3();for(let k=0;k<I.length;k+=3){const triangle=[];for(let l=0;l<3;l++)triangle.push(v.fromBufferAttribute(g.attributes.position,I[k+l]).applyMatrix4(root.matrixWorld).toArray());triangles.push(triangle);}
  let hit=0;for(let k=0;k<triangles.length;k+=149){const tri=triangles[k],x=tri.reduce((n,a)=>n+a[0],0)/3,z=tri.reduce((n,a)=>n+a[2],0)/3,y=tri.reduce((n,a)=>n+a[1],0)/3,opts={bottom:y-.3,top:y+.7,radius:.55};const contacts=w.surfaceContacts({x,z},opts);assert(contacts.length,'source-face-centre has contact');for(const c of contacts)assert(Number.isFinite(c.x+c.z));hit++;}
  assert(hit>150);
  let approachCount=0,steps=0,blockedSteps=0,maxStepDistance=0;
  for(let k=19;k<triangles.length;k+=1297){
   const tri=triangles[k],a=tri[0],b=tri[1],c=tri[2],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
   let nx=uy*vz-uz*vy,nz=ux*vy-uy*vx,l=Math.hypot(nx,nz);if(l<1e-5)continue;nx/=l;nz/=l;
   const x=tri.reduce((n,a)=>n+a[0],0)/3,z=tri.reduce((n,a)=>n+a[2],0)/3,y=tri.reduce((n,a)=>n+a[1],0)/3,opts={bottom:y-.8,top:y+1.47,radius:.55};let start=null,sign=1,distance=0;
   for(const d of [2,4,8,16]){for(const side of [1,-1]){const q=new T.Vector3(x+nx*d*side,0,z+nz*d*side);if(!w.surfaceContacts(q,opts).length){start=q;sign=side;distance=d;break;}}if(start)break;}
   if(!start)continue;
   const p=start.clone();for(let t=0;t<Math.ceil((distance+.8)/.2);t++){const previous=p.clone();p.x-=nx*.2*sign;p.z-=nz*.2*sign;w.resolve(p,{...opts,previous});assertClear(w,p,opts);const distance=p.distanceTo(previous);assert(distance<=.20200001,'contact must not teleport farther than requested substep');maxStepDistance=Math.max(maxStepDistance,distance);if(distance===0)blockedSteps++;steps++;}approachCount++;
  }
  assert(approachCount>=15);console.log('ACTUAL_SCAN_APPROACHES',JSON.stringify({approachCount,steps,blockedSteps,maxStepDistance}));
  assert.deepEqual(g.attributes.position.array,P);assert.deepEqual(g.index.array,I);assert.equal(w.surfaceContacts({x:-130,z:180},{bottom:0,top:80,radius:.55}).length,0,'air outside real source extent');
  const stats=w.surfaceStats();assert(stats.cells<250);console.log('ACTUAL_SCAN_INDEX',JSON.stringify(stats));
 }finally{Math.random=rng;}
});
test('invalid data rejects atomically and degenerate physical triangles are excluded',()=>{
 const w=world(),root=mesh(vertical);w.registerSurface(root);const before=w.surfaceStats();root.geometry.attributes.position.array[0]=NaN;assert.throws(()=>w.registerSurface(root),/Nonfinite/);assert.deepEqual(w.surfaceStats(),before);
 const deg=mesh([[[0,0,0],[1,1,1],[2,2,2]]]);assert.equal(w.registerSurface(deg),0);
});

test('changing ground-height fallback certifies prior absolute slab rather than candidate slab',()=>{
 const w=world(),root=mesh([[[-5,3,-5],[5,3,-5],[-5,3,5]],[[5,3,-5],[5,3,5],[-5,3,5]]]);w.registerSurface(root);
 const previous={x:0,z:0,bottom:.38,top:2.65},p=new T.Vector3(.2,0,0),newSlab={bottom:1.38,top:3.65,radius:.55,previous};
 assert.equal(w.surfaceContacts(previous,{bottom:previous.bottom,top:previous.top,radius:.55}).length,0);
 assert(w.surfaceContacts(previous,newSlab).length>0,'same xz at new terrain height would not be the prior pose');
 assert(w.resolve(p,newSlab)>0);near(p.x,previous.x);near(p.z,previous.z);
 assertClear(w,p,{bottom:previous.bottom,top:previous.top,radius:.55});
});

test('targeted exact supporting height: highest surface, either side/winding, holes and vertical faces',()=>{
 const w=world(),lower=mesh([[[-2,2,-2],[2,2,-2],[-2,2,2]]]),upper=mesh([[[-2,4,-2],[2,4,-2],[-2,4,2]].reverse()]),wall=mesh(vertical);
 w.registerSurface(lower);w.registerSurface(upper);w.registerSurface(wall);
 near(w.surfaceHeight(-.5,-.5),4);near(w.surfaceHeight(-.5,-.5,lower),2);near(w.surfaceHeight(-.5,-.5,upper),4);
 assert.equal(w.surfaceHeight(1.5,1.5),-Infinity,'triangle projection hole inside AABB stays open');
 assert.equal(w.surfaceHeight(0,0,wall),-Infinity,'parallel vertical face is not a fabricated top');
 upper.visible=false;near(w.surfaceHeight(-.5,-.5,upper),4);w.unregisterSurface(upper);near(w.surfaceHeight(-.5,-.5),2);
});
test('actual scan supporting-height query matches independent vendor two-sided ray triangles',()=>{
 const geometry=sourceGeometry(),root=new T.Mesh(geometry,new T.MeshBasicMaterial());root.position.set(-139,20,145);root.scale.setScalar(30/(10.54635238647461+9.681148529052734));root.rotation.y=Math.atan2(11,19);root.updateWorldMatrix(true,false);
 const w=world();w.registerSurface(root);const p=geometry.attributes.position,I=geometry.index.array,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3(),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
 let hits=0,misses=0;
 for(let ix=0;ix<7;ix++)for(let iz=0;iz<7;iz++){
  const x=-157+ix*6,z=127+iz*6;ray.origin.set(x,80,z);let expected=-Infinity;
  for(let k=0;k<I.length;k+=3){a.fromBufferAttribute(p,I[k]).applyMatrix4(root.matrixWorld);b.fromBufferAttribute(p,I[k+1]).applyMatrix4(root.matrixWorld);c.fromBufferAttribute(p,I[k+2]).applyMatrix4(root.matrixWorld);if(ray.intersectTriangle(a,b,c,false,hit))expected=Math.max(expected,hit.y);}
  const actual=w.surfaceHeight(x,z,root);if(expected===-Infinity){assert.equal(actual,-Infinity);misses++;}else{near(actual,expected,1e-7);hits++;}
 }
 assert(hits>=3&&misses>=30);console.log('ACTUAL_HEIGHT_RAYS',JSON.stringify({hits,misses}));
});

test('a higher point support cannot lift the mounted body through a cliff ledge',()=>{
 const w=world(),root=mesh([[[0,3,-2],[2,3,-2],[0,3,2]],[[2,3,-2],[2,3,2],[0,3,2]]]);w.registerSurface(root);
 const previous={x:-.1,z:0,bottom:.38,top:2.65},p=new T.Vector3(.1,0,0),ground=w.surfaceHeight(p.x,p.z,root);
 assert.equal(ground,3);assertClear(w,previous,{bottom:previous.bottom,top:previous.top,radius:.55});
 assert(w.resolve(p,{bottom:ground+.38,top:ground+2.65,radius:.55,previous})>0);
 assert(p.x<0,'horizontal move must stop before it adopts the ledge height');
 assert(Math.hypot(p.x-previous.x,p.z-previous.z)<=.20200001,'ledge contact cannot teleport the rider');
 assert.equal(w.surfaceHeight(p.x,p.z,root),-Infinity);assertClear(w,p,{bottom:previous.bottom,top:previous.top,radius:.55});
});
test('grounded ascent along a shallow scanned ramp remains traversable',()=>{
 const w=world(),root=mesh([[[-3,.7,-2],[3,1.3,-2],[-3,.7,2]],[[3,1.3,-2],[3,1.3,2],[-3,.7,2]]]);w.registerSurface(root);let x=-2;
 for(let i=0;i<20;i++){
  const priorFoot=w.surfaceHeight(x,0,root),foot=w.surfaceHeight(x+.2,0,root),previous={x,z:0,bottom:priorFoot+.38,top:priorFoot+2.65},p=new T.Vector3(x+.2,0,0);
  assert.equal(w.resolve(p,{bottom:foot+.38,top:foot+2.65,radius:.55,previous}),0);near(p.x,x+.2);near(p.z,0);x=p.x;
 }
});
