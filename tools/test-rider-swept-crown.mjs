import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const runtime=process.env.RIDER_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url));
const owner=process.env.RIDER_SWEPT_CROWN_SOURCE||path.join(runtime,'assets/rider-swept-crown.mjs');
const T=await import(pathToFileURL(path.join(runtime,'assets/vendor/three/build/three.module.js')));
const text=readFileSync(owner,'utf8').replace("'./rider-hairstyles.js?v=rider-details-20261009'",JSON.stringify(pathToFileURL(path.join(runtime,'assets/rider-hairstyles.js')).href+'?v=rider-details-20261009'));
const {installSweptCrown,createSweptCrownGeometry}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),created=[];
function kitFor(body='f'){
 const h=body==='f'?{cx:0,cy:.140,cz:0,rx:.087,ry:.104,rz:.091,top:.242,browTop:.131}:{cx:0,cy:.144,cz:.010,rx:.090,ry:.108,rz:.098,top:.250,browTop:.134};
 const kit={body,head:h,samples:0},center=V(h.cx,h.cy,h.cz),radii=V(h.rx,h.ry,h.rz);
 kit.hairSurface={sample(target,lift){kit.samples++;const d=target.clone().sub(center).normalize(),q=d.clone().divide(radii),p=center.clone().addScaledVector(d,1/q.length()),n=p.clone().sub(center).divide(radii.clone().multiply(radii)).normalize();return p.addScaledVector(n,lift);}};
 return kit;
}
function remember(g){created.push(g);return g;}
function sourceGeometry(){return remember(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,.01,0,0,0,.01,0],3)).setIndex([0,1,2]));}
function fixtureRig(){
 const kit=kitFor(),fringe=sourceGeometry(),scalp=sourceGeometry();scalp.setAttribute('hairFade',new T.Float32BufferAttribute([1,1,1],1));kit.gatheredCrown=fringe;kit.scalps={gathered:scalp};
 const rig={kit,hair:null,disposed:false,setHairCalls:0,disposeCalls:0,generations:[],depth:new T.MeshDepthMaterial(),u:{uHair:{value:new T.Color('#4a2e1c')},uHelmet:{value:0}}};
 function drop(group){group?.traverse(m=>{if(!m.isMesh)return;if(m.userData.ownMat)m.material.dispose();if(m.userData.ownGeo)m.geometry.dispose();});}
 rig.setHair=function(style='ponytail'){
  this.setHairCalls++;drop(this.hair);const group=new T.Group();group.name='hair-'+style;
  const capMaterial=new T.MeshPhysicalMaterial({alphaToCoverage:true});capMaterial.onBeforeCompile=shader=>{shader.uniforms.uHair=this.u.uHair;shader.uniforms.uHelmet=this.u.uHelmet;};
  const cap=new T.Mesh(scalp,capMaterial),front=new T.Mesh(fringe,new T.MeshPhysicalMaterial()),tail=new T.Mesh(sourceGeometry(),new T.MeshPhysicalMaterial());
  cap.customDepthMaterial=this.depth;cap.castShadow=false;cap.userData.ownMat=true;front.userData.ownMat=true;tail.userData={ownMat:true,ownGeo:true};tail.position.set(.004,-.1,-.06);
  const generation={group,cap,front,tail,capMaterial,capShader:capMaterial.onBeforeCompile,tailGeometry:tail.geometry,tailPosition:tail.position.clone()};
  for(const m of [cap,front,tail])m.name=style;
  if(style==='long'){front.geometry=sourceGeometry();front.userData.ownGeo=true;group.add(front);capMaterial.dispose();tail.material.dispose();tail.geometry.dispose();}
  else group.add(front,cap,tail);
  this.generations.push(generation);this.hair=group;
 };
 rig.dispose=function(){this.disposeCalls++;this.disposed=true;drop(this.hair);this.hair=null;};rig.setHair();return rig;
}

test('female and male crowns are one outward connected disk with only a single hairline boundary',()=>{
 for(const body of ['f','m']){
  const kit=kitFor(body),g=remember(createSweptCrownGeometry(T,kit)),p=g.attributes.position,n=g.attributes.normal,tangent=g.attributes.tangent,uv=g.attributes.uv;
  for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite));
  assert.equal(g.userData.sweptCrown.connectedShell,true);assert(g.index.count/3<8000);
  const welded=new Map(),ids=[],edges=new Map(),adjacency=new Map();
  for(let i=0;i<p.count;i++){const q=V().fromBufferAttribute(p,i),key=q.toArray().map(v=>Math.round(v*1e6)).join(',');if(!welded.has(key))welded.set(key,welded.size);ids[i]=welded.get(key);
   const normal=V().fromBufferAttribute(n,i),tan=V(tangent.getX(i),tangent.getY(i),tangent.getZ(i));assert(Math.abs(normal.length()-1)<1e-5);assert(Math.abs(tan.length()-1)<1e-5);assert(Math.abs(normal.dot(tan))<1e-5);assert.equal(Math.abs(tangent.getW(i)),1);
   const normalized=q.clone().sub(V(kit.head.cx,kit.head.cy,kit.head.cz)).divide(V(kit.head.rx,kit.head.ry,kit.head.rz));assert(normalized.length()>.80,'Only the bounded cranial ear envelope may enter the fitting proxy');assert(normalized.length()<1.18);
  }
  let minArea=Infinity;
  for(let i=0;i<g.index.count;i+=3){const original=[0,1,2].map(k=>g.index.getX(i+k)),tri=original.map(j=>ids[j]),q=original.map(j=>V().fromBufferAttribute(p,j)),normal=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0])),center=q[0].clone().add(q[1]).add(q[2]).multiplyScalar(1/3).sub(V(kit.head.cx,kit.head.cy,kit.head.cz));
   minArea=Math.min(minArea,normal.length()*.5);assert(normal.dot(center)>0,'Every emitted face points out of the skull');
   for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a).add(b);if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(b).add(a);}
  }
  assert(minArea>1e-10);assert([...edges.values()].every(n=>n===1||n===2),'No nonmanifold joins');
  const boundary=[...edges].filter(([,n])=>n===1);assert.equal(boundary.length,g.userData.sweptCrown.columns);assert.equal(welded.size-edges.size+g.index.count/3,1,'Disk Euler characteristic');
  const visited=new Set(),pending=[0];while(pending.length){const id=pending.pop();if(visited.has(id))continue;visited.add(id);pending.push(...adjacency.get(id));}assert.equal(visited.size,welded.size);
  const C=g.userData.sweptCrown.columns;for(let row=0;row<g.userData.sweptCrown.rows;row++){const a=1+row*(C+1),b=a+C;for(let k=0;k<3;k++)assert.equal(p.array[a*3+k],p.array[b*3+k]);for(let k=0;k<3;k++)assert.equal(n.array[a*3+k],n.array[b*3+k]);for(const frequency of [47,420])assert(Math.abs(Math.sin(uv.getX(a)*frequency)-Math.sin(uv.getX(b)*frequency))<.0005,'Existing comb phases close across the geometric seam');assert(Math.abs(uv.getY(a)-uv.getY(b))<1e-6);}
 }
});

test('the fitted shape has an asymmetric sweep, broad relief, temple points and independent per-rider buffers',()=>{
 const kit=kitFor(),a=remember(createSweptCrownGeometry(T,kit)),samples=kit.samples,b=remember(createSweptCrownGeometry(T,kit));assert.equal(kit.samples,samples,'A second style/rider reuses the CPU fitting template');
 for(const key of Object.keys(a.attributes)){assert.notEqual(a.attributes[key].array,b.attributes[key].array);assert.deepEqual(a.attributes[key].array,b.attributes[key].array);}
 const p=a.attributes.position,C=a.userData.sweptCrown.columns,R=a.userData.sweptCrown.rows,at=(row,theta)=>1+(row-1)*(C+1)+Math.round((theta+Math.PI)/(Math.PI*2)*C);
 const left=at(R,-.43),right=at(R,.43);assert(Math.abs(p.getY(left)-p.getY(right))>.005,'The front edge is a designed asymmetric sweep');
 assert(p.getY(at(R,1.19))<p.getY(at(R,1.55))-.010,'Temple point tapers below the over-ear rim');
 const h=kit.head,center=V(h.cx,h.cy,h.cz),radii=V(h.rx,h.ry,h.rz),lifts=[];
 for(let col=0;col<C;col++){const id=1+(Math.floor(R*.50)-1)*(C+1)+col,q=V().fromBufferAttribute(p,id),d=q.clone().sub(center).normalize(),surface=center.clone().addScaledVector(d,1/d.clone().divide(radii).length());lifts.push(q.distanceTo(surface));}
 assert(Math.max(...lifts)-Math.min(...lifts)>.0015,'The connected shell carries broad sculpted lock relief');
 const value=b.attributes.position.getX(0);a.attributes.position.setX(0,99);assert.equal(b.attributes.position.getX(0),value,'Rider-owned mutation cannot corrupt shared template/source');
});

test('replacement retains tail objects, appearance/helmet material and depth hooks, and never disposes cached source geometry',()=>{
 const rig=fixtureRig(),generation=rig.generations[0],shared=[rig.kit.gatheredCrown,rig.kit.scalps.gathered];let sharedDisposals=0,fringeDisposals=0,depthDisposals=0;
 for(const g of shared)g.addEventListener('dispose',()=>sharedDisposals++);generation.front.material.addEventListener('dispose',()=>fringeDisposals++);rig.depth.addEventListener('dispose',()=>depthDisposals++);
 const oldTailIndex=generation.tail.geometry.index.array.slice(),oldTailPosition=generation.tail.geometry.attributes.position.array.slice();
 installSweptCrown(T,rig);const cap=generation.cap,geometry=cap.geometry;
 assert.equal(rig.hair,generation.group);assert.equal(generation.front.parent,null);assert.equal(cap.material,generation.capMaterial);assert.equal(cap.material.onBeforeCompile,generation.capShader);assert.equal(cap.customDepthMaterial,rig.depth);assert.equal(cap.userData.ownGeo,true);assert.equal(cap.castShadow,true);
 assert.equal(generation.tail.parent,rig.hair);assert.equal(generation.tail.geometry,generation.tailGeometry);assert.deepEqual(generation.tail.position,generation.tailPosition);assert.deepEqual(generation.tail.geometry.index.array,oldTailIndex);assert.deepEqual(generation.tail.geometry.attributes.position.array,oldTailPosition);
 assert.equal(fringeDisposals,1);assert.equal(sharedDisposals,0);assert.equal(depthDisposals,0);
 const shader={uniforms:{}};cap.material.onBeforeCompile(shader);assert.equal(shader.uniforms.uHair,rig.u.uHair);assert.equal(shader.uniforms.uHelmet,rig.u.uHelmet);rig.u.uHair.value.set('#d7b28b');rig.u.uHelmet.value=1;assert.equal(shader.uniforms.uHelmet.value,1);
 const setter=rig.setHair;installSweptCrown(T,rig);assert.equal(rig.setHair,setter);assert.equal(cap.geometry,geometry);assert.equal(rig.sweptCrown.inspect().rebuilds,1);
 rig.dispose();rig.depth.dispose();assert.equal(sharedDisposals,0);assert.equal(fringeDisposals,1);assert.equal(depthDisposals,1);
});

test('hair rebuilds and disposal retire each new crown exactly once and leave loose styles untouched',()=>{
 const rig=installSweptCrown(T,fixtureRig()),first=rig.generations[0].cap.geometry;let firstDisposals=0,secondDisposals=0;first.addEventListener('dispose',()=>firstDisposals++);
 rig.setHair('braid');const second=rig.generations[1].cap.geometry;second.addEventListener('dispose',()=>secondDisposals++);assert.equal(firstDisposals,1);assert.notEqual(first,second);assert.equal(rig.sweptCrown.inspect().rebuilds,2);
 rig.setHair('long');const loose=rig.hair.children[0],looseGeometry=loose.geometry;assert.equal(secondDisposals,1);assert.equal(rig.sweptCrown.inspect().active,false);assert.equal(rig.hair.children.length,1);assert.equal(loose.geometry,looseGeometry);assert(!loose.geometry.userData.sweptCrown);
 rig.dispose();rig.dispose();assert.equal(rig.disposeCalls,1);assert.equal(firstDisposals,1);assert.equal(secondDisposals,1);assert.equal(rig.sweptCrown.inspect().disposed,true);rig.depth.dispose();
 assert.equal(installSweptCrown(T,null),null);const fallback={kit:{}};assert.equal(installSweptCrown(T,fallback),fallback);
});

test('folded ear samples stay inside the cranial guard instead of creating hair shards on cartilage',()=>{
 const plain=kitFor(),folded=kitFor(),sample=folded.hairSurface.sample,H=folded.head;let folds=0;
 folded.hairSurface.sample=(target,lift)=>{const p=sample(target,lift),side=H.rx*.85*Math.sqrt(Math.max(.2,1-Math.pow((p.y-H.cy)/.13,2)-Math.pow((p.z-H.cz)/.16,2)));if(p.y<H.browTop+.012&&Math.abs(p.z-H.cz)<.065&&Math.abs(p.x)>side){p.x*=1.35;folds++;}return p;};
 const a=remember(createSweptCrownGeometry(T,plain)),b=remember(createSweptCrownGeometry(T,folded));assert(folds>100,'The fitting source exercises a folded outer-ear region');
 assert.equal(a.attributes.position.count,b.attributes.position.count);let maxDelta=0;
 for(let i=0;i<a.attributes.position.count;i++)maxDelta=Math.max(maxDelta,V().fromBufferAttribute(a.attributes.position,i).distanceTo(V().fromBufferAttribute(b.attributes.position,i)));
 assert(maxDelta<1e-7,'Exaggerated cartilage must not alter the emitted crown');
});

test('helmet toggles retain the exact original source crown and scalp, then restore the connected bare-head model',()=>{
 const rig=installSweptCrown(T,fixtureRig()),bare=rig.hair.getObjectByName('Rider_Swept_Crown').geometry;let retired=0,sourceDisposed=0;bare.addEventListener('dispose',()=>retired++);for(const g of [rig.kit.gatheredCrown,rig.kit.scalps.gathered])g.addEventListener('dispose',()=>sourceDisposed++);
 rig.u.uHelmet.value=1;rig.setHair('ponytail');const helmet=rig.generations.at(-1);
 assert.equal(retired,1);assert.equal(helmet.cap.geometry,rig.kit.scalps.gathered);assert.equal(helmet.front.geometry,rig.kit.gatheredCrown);assert.equal(helmet.front.parent,rig.hair);assert.equal(helmet.cap.castShadow,false);assert.equal(rig.sweptCrown.inspect().active,false);
 const samples=rig.kit.samples;rig.u.uHelmet.value=0;rig.setHair('ponytail');const next=rig.generations.at(-1);
 assert(next.cap.geometry.userData.sweptCrown);assert.equal(next.front.parent,null);assert.equal(rig.sweptCrown.inspect().active,true);assert.equal(rig.kit.samples,samples,'Removing the helmet reuses the immutable fitted template');assert.equal(sourceDisposed,0);
 rig.dispose();rig.depth.dispose();assert.equal(sourceDisposed,0);
});

test('added UUID resources never consume or replace the world random stream, including failed construction',()=>{
 const previous=Math.random;let calls=0;const ambient=()=>{calls++;return .314159265;};
 const rig=fixtureRig(),baseline=fixtureRig();let a,b;
 Math.random=ambient;
 try{
  const kit=kitFor();a=remember(createSweptCrownGeometry(T,kit));b=remember(createSweptCrownGeometry(T,kit));
  assert.equal(calls,0);assert.equal(Math.random,ambient);assert.notEqual(a.uuid,b.uuid,'Persistent private state gives every new geometry a unique identity');
  installSweptCrown(T,rig);assert.equal(calls,0,'Installation adds no ambient draws');
  const start=calls;baseline.setHair('braid');const sourceDraws=calls-start;
  const before=calls;rig.setHair('braid');assert.equal(calls-before,sourceDraws,'Rebuild adds no draws beyond original hair construction');
  assert.equal(Math.random,ambient);
  const throwing={...T,BufferGeometry:class{constructor(){Math.random();throw Error('Intentional constructor failure');}}};
  const beforeThrow=calls;assert.throws(()=>createSweptCrownGeometry(throwing,kit),/Intentional constructor failure/);assert.equal(calls,beforeThrow);assert.equal(Math.random,ambient,'The ambient generator is restored on exceptions');
 }finally{Math.random=previous;rig.dispose();baseline.dispose();rig.depth.dispose();baseline.depth.dispose();}
});

test.after(()=>{for(const g of created)g.dispose();});
