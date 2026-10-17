// mesa-landforms-1: exact historical source reads; actual factory geometry stays raw.
import{normalizeMesaLandformsSource as mesaParent}from'./mesa-landforms-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createGeology} from '../assets/geology.js';
import {dressCanyonSurface} from '../assets/canyon-surface.js?v=countryside-banks-1';
import {dressLandscape} from '../assets/landscape-surface.js?v=regional-relief-1';
import {canyonReplacesFormation} from '../assets/canyon-landscape.js';
import {COTTONWOOD_PUBLIC} from '../assets/cottonwood-layout.js';
import {COTTONWOOD_TRACKS} from '../assets/cottonwood-routes.mjs';
import {needsPastoralFieldstone,groundPastoralFieldstone} from '../assets/ranch-fieldstones.mjs?v=ranch-fieldstones-1';
import {forTerrainIntersections} from './terrain-water-contact.mjs';
import {normalizeRanchModelSource} from './ranch-model-source-guard.mjs';
import {normalizeLupinSource} from './lupin-source-guard.mjs';

const fixture=new URL('./fixtures/ranch-model-b5d22a6/',import.meta.url),read=rel=>fs.readFileSync(new URL(rel,fixture));
const contract=JSON.parse(read('fieldstone-contract.json')),oldSource=read('geology.js').toString();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(sha(oldSource),contract.sourceSHA256['assets/geology.js']);
const oldGeology=new Function('dressCanyonSurface','dressLandscape','return ('+oldSource.split('export function ')[1].replace(/^createGeology/,'function createGeology')+');')(dressCanyonSurface,dressLandscape);
const bytes=read('terrain-grid.f32');assert.equal(sha(bytes),contract.nativeTerrainGridSHA256);const grid=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),step=1000/512;
function terrain(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,k=iz*513+ix,A=grid[k],B=grid[k+513],C=grid[k+514],D=grid[k+1];return u+v<=1?A+(D-A)*u+(B-A)*v:C+(B-C)*(1-u)+(D-C)*(1-v);}
const paths=new Function('COTTONWOOD_TRACKS','COTTONWOOD_PUBLIC',contract.sourceSnippets.paths+'const villageGroundZones=COTTONWOOD_PUBLIC.map(q=>({...q}));'+contract.sourceSnippets.segments+'return pathDist;')(COTTONWOOD_TRACKS,COTTONWOOD_PUBLIC);
const randomSection=fn=>{const old=Math.random;let s=0x754e9af1,calls=0;Math.random=()=>{calls++;s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};try{const value=fn(),used=calls,future=Array.from({length:32},()=>Math.random());return{value,calls:used,future};}finally{Math.random=old;}};
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function formationSection(s){const start=s.indexOf(' /* Sedimentary mesas and weathered spires');return s.slice(start,s.indexOf(' /* ===== Dawn mist, and dust',start));}
const run=(factory,body)=>randomSection(()=>{const scene=new T.Scene(),geology=factory({THREE:T,scene,groundH:terrain,loadTextures:false}),colliders=[];new Function('CANYON','pathDist','riverZ','canyonReplacesFormation','geology','colliders',body)({x:-220,z:130},paths,x=>120+Math.sin(x*.012)*45,canyonReplacesFormation,geology,colliders);return{scene,geology,colliders};});
let pair;

test('frozen combined source binds only the exact twelve model and cache literals; original whole geology and main world bodies remain',()=>{
 for(const [file,expected]of Object.entries(contract.runtimeSHA256)){
  const current=mesaParent(fs.readFileSync(new URL('../'+file,import.meta.url)),file);assert.equal(sha(normalizeLupinSource(current.toString(),file)),expected);
  if(contract.sourceSHA256[file])assert.equal(sha(normalizeRanchModelSource(current.toString(),file)),contract.sourceSHA256[file]);
 }
 assert.equal(contract.approvedNewSourceChanges.length,12);
});

test('actual full production placement loop retains all accepted sites, private RNG and constructor future stream; only two native circle heights change',()=>{
 const a=run(oldGeology,contract.sourceSnippets.formation),b=run(createGeology,formationSection(source));pair={a:a.value,b:b.value};assert.equal(b.calls,a.calls);assert.deepEqual(b.future,a.future);assert.equal(b.value.scene.children.length,a.value.scene.children.length);assert.equal(b.value.colliders.length,a.value.colliders.length);
 const actual=contract.actualNativeHoodoos;assert.equal(actual.length,11);let changed=0;
 for(let i=0;i<a.value.colliders.length;i++){
  const old=a.value.colliders[i],next=b.value.colliders[i];assert.deepEqual({...next,height:old.height},old);
  const original=a.value.scene.children[i],newRoot=b.value.scene.children[i],x=original.children[0],y=newRoot.children[0];assert.equal(newRoot.uuid,original.uuid);assert.equal(y.uuid,x.uuid);assert.equal(y.geometry.uuid,x.geometry.uuid);assert.deepEqual(newRoot.position,original.position);assert.deepEqual(newRoot.quaternion.toArray(),original.quaternion.toArray());
  if(newRoot.userData.geology.fieldstone){changed++;assert(needsPastoralFieldstone(old.x,old.z));assert(next.height>=y.geometry.boundingBox.max.y&&next.height<y.geometry.boundingBox.max.y+.03);assert(next.height>0&&next.height<2);assert.equal(y.material,b.value.geology.material);assert.equal(y.geometry.index.count/3,912);assert.equal(newRoot.userData.geology.legacyHeight,old.height);}
  else{assert.equal(next.height,old.height);assert.equal(y.material.uuid,x.material.uuid);assert.deepEqual(y.geometry.index.array,x.geometry.index.array);
   if(newRoot.userData.geology.kind==='layered mesa'){
    // Actual current factory remains raw. Only the declared upper mesa surface
    // changes; the source band's positions/UVs and all placement/physics stay.
    const a=x.geometry,b=y.geometry,A=a.attributes.position.array,B=b.attributes.position.array,reference=a.userData.groundReference,ceiling=Math.max(3.8,original.userData.geology.height*.23+.05);
    assert.deepEqual(Object.keys(b.attributes),Object.keys(a.attributes));for(const k of Object.keys(a.attributes)){assert.equal(b.attributes[k].count,a.attributes[k].count);assert.equal(b.attributes[k].itemSize,a.attributes[k].itemSize);assert.equal(b.attributes[k].array.byteLength,a.attributes[k].array.byteLength);}assert.deepEqual(b.attributes.color.array,a.attributes.color.array);
    let moved=0,normalChanges=0,uvChanges=0,protectedVertices=0;
    for(let v=0;v<a.attributes.position.count;v++){const k=v*3,u=v*2;if(reference[k+1]<=ceiling){protectedVertices++;for(let j=0;j<3;j++)assert.equal(B[k+j],A[k+j]);for(let j=0;j<2;j++)assert.equal(b.attributes.uv.array[u+j],a.attributes.uv.array[u+j]);}if(Math.hypot(B[k]-A[k],B[k+1]-A[k+1],B[k+2]-A[k+2])>1e-6)moved++;for(let j=0;j<3;j++){assert(Number.isFinite(b.attributes.normal.array[k+j]));if(b.attributes.normal.array[k+j]!==a.attributes.normal.array[k+j])normalChanges++;}for(let j=0;j<2;j++){assert(Number.isFinite(b.attributes.uv.array[u+j]));if(b.attributes.uv.array[u+j]!==a.attributes.uv.array[u+j])uvChanges++;}}
    assert(protectedVertices>500);assert(moved>500&&normalChanges>0&&uvChanges>0,'intentional upper mesa shape/normal/metricUV changed, not a source-normalized old factory');
    const oldMeta=original.userData.geology,newMeta=newRoot.userData.geology;assert.deepEqual({...newRoot.userData,geology:{...newMeta,min:oldMeta.min,max:oldMeta.max}},original.userData);for(let axis=0;axis<3;axis++){assert(b.boundingBox.min.getComponent(axis)>=a.boundingBox.min.getComponent(axis)-1e-5);assert(b.boundingBox.max.getComponent(axis)<=a.boundingBox.max.getComponent(axis)+1e-5);}
   }else{for(const n of Object.keys(x.geometry.attributes))assert.deepEqual(y.geometry.attributes[n].array,x.geometry.attributes[n].array);assert.deepEqual(newRoot.userData,original.userData);}
  }
  if(!old.landform)assert(actual.some(c=>c.x===old.x&&c.z===old.z&&c.r===old.r&&c.height===old.height),'actual original native circle equals source execution');
 }
 assert.equal(changed,2);assert.equal(contract.sites.filter(s=>s.kind==='hoodoo'&&needsPastoralFieldstone(s.x,s.z)).length,2);
});

test('actual two fieldstone shapes retain radius/collision ownership, finite unit normals, outward faces and ten closed physical masses',()=>{
 let tested=0;for(let k=0;k<pair.b.scene.children.length;k++){
  const root=pair.b.scene.children[k];if(!root.userData.geology.fieldstone)continue;tested++;const g=root.children[0].geometry,p=g.attributes.position,n=g.attributes.normal,I=g.index,adj=new Map(),edges=new Map(),verts=new Set(),profile=root.userData.geology;
  assert.deepEqual(profile.min,g.boundingBox.min.toArray());assert.deepEqual(profile.max,g.boundingBox.max.toArray());assert.equal(profile.height,g.boundingBox.max.y);assert(profile.collisionHeight>=profile.height&&profile.collisionHeight<profile.height+.03);assert.equal(profile.vertices,p.count);assert.equal(profile.triangles,I.count/3);assert.equal(profile.previousTriangles,4968);assert.equal(n.count,p.count);assert.equal(g.attributes.uv.count,p.count);assert.equal(g.attributes.color.count,p.count);
  for(const a of Object.values(g.attributes))assert(Array.from(a.array).every(Number.isFinite));for(let i=0;i<n.count;i++)assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].join(',');
  for(let t=0;t<I.count;t+=3){const ids=[0,1,2].map(j=>I.getX(t+j)),v=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i)),cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));assert(cross.length()>1e-9);const sum=new T.Vector3();for(const i of ids)sum.add(new T.Vector3().fromBufferAttribute(n,i));assert(cross.dot(sum)>0);
   for(let j=0;j<3;j++){const a=key(ids[j]),b=key(ids[(j+1)%3]);verts.add(a);verts.add(b);const e=[a,b].sort().join('|');edges.set(e,(edges.get(e)||0)+1);if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);}
  }
  assert([...edges.values()].every(count=>count===2),'each authored volume closes every edge');const seen=new Set();let components=0;for(const vertex of verts)if(!seen.has(vertex)){components++;const queue=[vertex];while(queue.length){const at=queue.pop();if(seen.has(at))continue;seen.add(at);queue.push(...adj.get(at));}}assert.equal(components,10);
  for(let i=0;i<p.count;i++)assert(Math.hypot(p.getX(i),p.getZ(i))<pair.b.colliders[k].r-.0149,'every actual face remains inside original circle');
 }
 assert.equal(tested,2);
});

test('actual full-grid terrain seats all source contact vertices, repeated grounding is byte-idempotent, and every contact triangle is audited continuously',()=>{
 const stats=[];for(const root of pair.b.scene.children){if(!root.userData.geology.fieldstone)continue;const g=root.children[0].geometry,p=g.attributes.position,I=g.index,original=g.userData.groundReference;let contactCount=0,min=Infinity,max=-Infinity,top=-Infinity,wholeTriangles=0,clippedVertices=0;
  for(let i=0;i<p.count;i++)if(original[i*3+1]<-.02799){contactCount++;const x=root.position.x+p.getX(i),z=root.position.z+p.getZ(i),y=root.position.y+p.getY(i);assert(Math.abs(y-terrain(x,z)+.028)<2e-6);}
  for(let t=0;t<I.count;t+=3){const ids=[0,1,2].map(k=>I.getX(t+k));const face=ids.map(i=>[root.position.x+p.getX(i),root.position.z+p.getZ(i),root.position.y+p.getY(i)]);forTerrainIntersections(face,step,poly=>{for(const point of poly)top=Math.max(top,point[2]-terrain(point[0],point[1]));});if(!ids.every(i=>original[i*3+1]<-.02799))continue;wholeTriangles++;const triangle=ids.map(i=>[root.position.x+p.getX(i),root.position.z+p.getZ(i),root.position.y+p.getY(i)]);forTerrainIntersections(triangle,step,poly=>{for(const point of poly){clippedVertices++;const gap=point[2]-terrain(point[0],point[1]);min=Math.min(min,gap);max=Math.max(max,gap);}});}
  assert(root.userData.geology.collisionHeight>=top,'circle cap conservatively covers every triangle above its actual local terrain');assert(contactCount>90);assert.equal(wholeTriangles,152);assert(clippedVertices>wholeTriangles*3);assert(max<.02,'buried source feet do not become visible floating shelves');const before=p.array.slice();groundPastoralFieldstone({group:root,groundH:terrain,x:root.position.x,z:root.position.z});assert.equal(sha(new Uint8Array(p.array.buffer)),sha(new Uint8Array(before.buffer)));stats.push({site:[root.position.x,root.position.z],contactCount,wholeTriangles,clippedVertices,minM:min,maxM:max,maximumTopAboveLocalGroundM:top,collisionHeightM:root.userData.geology.collisionHeight});
 }
 if(process.env.FIELDSTONE_AUDIT_OUTPUT)fs.writeFileSync(process.env.FIELDSTONE_AUDIT_OUTPUT,JSON.stringify({scope:'actual original source loop + actual baseline terrain; no GPU/visual claim',sources:{geology:sha(fs.readFileSync(new URL('../assets/geology.js',import.meta.url))),helper:sha(fs.readFileSync(new URL('../assets/ranch-fieldstones.mjs',import.meta.url)))},contactTriangles:stats},null,2)+'\n');
});

test('actual production legacy controller preserves ground blocking and exterior footprints, while only the two measured tops permit deliberate overflight',()=>{
 const start=source.indexOf(' /* Legacy trunks and rocks retain their footprints; authored structures use part geometry. */'),current=source.slice(source.indexOf(' for(const c of colliders){',start),source.indexOf(' /* A fence',start));assert.equal(current,contract.sourceSnippets.legacyColliders);const resolve=new Function('player','colliders','groundH',current+'return player.pos;');
 for(let i=0;i<pair.a.colliders.length;i++){
  const old=pair.a.colliders[i],next=pair.b.colliders[i],changed=next.height!==old.height;
  for(let angle=0;angle<Math.PI*2;angle+=.19)for(const radius of [.01,old.r*.3,old.r+.2,old.r+.55,old.r+.9]){
   const x=old.x+Math.sin(angle)*radius,z=old.z+Math.cos(angle)*radius,a={pos:{x,z},heading:angle,y:0},b={pos:{x,z},heading:angle,y:0};resolve(a,[old],terrain);resolve(b,[next],terrain);assert.deepEqual(b.pos,a.pos);
   if(!changed){a.y=b.y=3;resolve(a,[old],terrain);resolve(b,[next],terrain);assert.deepEqual(b.pos,a.pos);}
  }
  if(changed){const x=old.x+.1,z=old.z,a={pos:{x,z},heading:0,y:next.height+.01},b={pos:{x,z},heading:0,y:next.height+.01};resolve(a,[old],terrain);resolve(b,[next],terrain);assert.deepEqual(b.pos,{x,z});assert.notDeepEqual(a.pos,b.pos);}
 }
});
