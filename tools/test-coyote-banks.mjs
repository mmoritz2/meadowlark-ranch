import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture as f} from './coyote-bank-fixture.mjs';
import {OASIS,createOasisWater} from '../assets/oasis-art.js';
const {T,old,next,before,after,n,step}=f;
function source(path){return fs.readFileSync(new URL(path,import.meta.url),'utf8');}
function build(module,height){let randomDraws=0;const previous=Math.random;const scene=new T.Scene(),material=new T.MeshStandardMaterial(),colliders=[];Math.random=()=>{randomDraws++;return .25;};try{return{art:module.createCanyonLandscape({THREE:T,scene,heightAt:height,terrainStep:step,material,colliders}),randomDraws};}finally{Math.random=previous;}}
const baseline=build(old,f.oldHeight),candidate=build(next,f.height);
function retainedTriangle(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),i=iz*n+ix;const ids=gx-ix+gz-iz<=1?[i,i+n,i+1]:[i+1,i+n,i+n+1];for(const k of ids)assert.equal(after[k],before[k],`Protected contact support moved at ${x},${z},vertex${k}`);}
function ribbon(points,width){let count=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(!L)continue;const steps=Math.ceil(L/.25);for(let j=0;j<=steps;j++)for(const offset of[-width,0,width]){retainedTriangle(a[0]+dx*j/steps-dz/L*offset,a[1]+dz*j/steps+dx/L*offset);count++;}}return count;}
function across(id,along,offset,module){const r=old.CANYON_RIDGES.find(r=>r.id===id),a=r.points[0],b=r.points[1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;return module.canyonRelief(a[0]+along*dx-dz*offset,a[1]+along*dz+dx*offset);}
test('captured11fb terrain is pinned and only changed source-bank cells are rebuilt',()=>{
 assert.equal(f.digest(source('./fixtures/coyote-banks-11fb567/assets/canyon-landscape.js')),'d32e6424db088bec3bf70133ba2466a9274ff72c73185908168d75033babfd23');assert.equal(f.sha(before),'d02a78010bd9cccc401f52e5862cb200578eee51f172230c0e109a2844b2de38');assert.equal(f.maxBaseError,0);assert(f.changed.length>300&&f.changed.length<1200);assert(f.maxDelta>4&&f.maxDelta<12);
 // Later quarter pool carving is a real existing physical owner. Retain it,
 // rather than rebuilding every unchanged cell from source-only rawH.
 assert(f.maxWholeRawDifference>1&&f.maxWholeRawDifference<2);
 for(let i=0;i<after.length;i++){assert(Number.isFinite(after[i]));const x=i%n*step-500,z=Math.floor(i/n)*step-500;if(x< -302||x> -215||z<137||z>202)assert.equal(after[i],before[i]);}
});
test('both old front cones lower substantially while crowns become broader and unequal',()=>{
 assert(across('eastern-wall',0,0,old)-across('eastern-wall',0,0,next)>4);
 assert(across('western-wall',0,-3,old)-across('western-wall',0,-3,next)>4);
 const western=[-2,-1,0,1].map(o=>across('western-wall',10,o,next)),east=[-1,0,1,2,3].map(o=>across('eastern-wall',5,o,next));
 assert(Math.max(...western)-Math.min(...western)<.3);assert(Math.max(...east)-Math.min(...east)<.3);
 const oldWest=[-2,-1,0,1].map(o=>across('western-wall',10,o,old)),oldEast=[-1,0,1,2,3].map(o=>across('eastern-wall',5,o,old));assert(Math.max(...oldWest)-Math.min(...oldWest)>2.5);assert(Math.max(...oldEast)-Math.min(...oldEast)>2.5);
 assert(Math.max(...western)>Math.max(...east)+2,'Western crown should remain higher than eastern');
});
test('actual final River Road/Ochre route supporting triangles and3m riding strips remain exact',()=>{
 const counts=f.routes.map(route=>({id:route.id,samples:ribbon(route.pts,3)}));assert(counts.every(r=>r.samples>1000));console.log('actual route support samples',JSON.stringify(counts));
});
test('authored Derby, oasis, outpost, arena and river protections retain physical contact',()=>{
 const derby=[[-196,200],[-200,262],[-262,280],[-305,255],[-300,212],[-262,198],[-226,190],[-196,200]];assert(ribbon(derby,3)>3000);
 // The spring is physically seven metres across its radial domain. Prove the
 // complete rendered footprint using the conservative source-water AABB and
 // every underlying triangle corner; the unrelated dry 19 m mask halo may move.
 const water=createOasisWater({THREE:T,groundH:f.height,x:OASIS.x,z:OASIS.z,radius:OASIS.r,waterMaterial:new T.MeshPhysicalMaterial()});water.geometry.computeBoundingBox();const box=water.geometry.boundingBox;
 const ix0=Math.floor((OASIS.x+box.min.x+500)/step),ix1=Math.ceil((OASIS.x+box.max.x+500)/step),iz0=Math.floor((OASIS.z+box.min.z+500)/step),iz1=Math.ceil((OASIS.z+box.max.z+500)/step);
 for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++)assert.equal(after[iz*n+ix],before[iz*n+ix],'Every spring-water support vertex must remain exact');
 for(let a=0;a<Math.PI*2;a+=.07)for(const radius of[0,8,16])retainedTriangle(OASIS.x+Math.cos(a)*radius,OASIS.z+Math.sin(a)*radius);
 water.geometry.dispose();water.material.dispose();
 for(let x=-249;x<=-201;x+=2)for(let z=109;z<=133;z+=2)retainedTriangle(x,z);
 for(let x=-265;x<=-211;x+=2)for(let z=200;z<=240;z+=2)retainedTriangle(x,z);
 for(let x=-360;x<=-100;x+=1)// Actual water is +/-5.1 m and the largest source bank apron is
 //8.2*(1+.55)=12.71 m. A13 m physical support band covers both.
 for(const side of Array.from({length:53},(_,i)=>-13+i*.5))retainedTriangle(x,120+Math.sin(x*.012)*45+side);
});
test('rebuilt source cliff barriers remain outside all actual route and Derby riding strips',()=>{
 const derby={id:'derby',pts:[[-196,200],[-200,262],[-262,280],[-305,255],[-300,212],[-262,198],[-226,190],[-196,200]]};
 for(const route of[...f.routes,derby]){let gap=Infinity;for(const c of candidate.art.barriers)for(let i=1;i<route.pts.length;i++){const a=route.pts[i-1],b=route.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((c.x-a[0])*dx+(c.z-a[1])*dz)/(dx*dx+dz*dz||1)));gap=Math.min(gap,Math.hypot(c.x-a[0]-dx*t,c.z-a[1]-dz*t)-c.r);}assert(gap>3,route.id+' protected riding strip intersects a new cliff barrier');console.log(route.id+' minimum cliff circle clearance metres',gap);}
});
test('north-rim/oasis shape resources and every unrelated field buffer remain exact',()=>{
 assert.deepEqual(next.CANYON_RIDGES,old.CANYON_RIDGES);for(const id of ['north-rim','oasis-butte']){const a=baseline.art.fields.find(f=>f.id===id).mesh.geometry,b=candidate.art.fields.find(f=>f.id===id).mesh.geometry;for(const key of Object.keys(a.attributes))assert.equal(f.sha(a.attributes[key].array),f.sha(b.attributes[key].array));assert.equal(f.sha(a.index.array),f.sha(b.index.array));}
 const a=source('./fixtures/coyote-banks-11fb567/assets/canyon-landscape.js'),b=source('../assets/canyon-landscape.js');assert.equal(a.slice(a.indexOf('export function createCanyonLandscape')),b.slice(b.indexOf('export function createCanyonLandscape')),'No new shader/material/mesh/collider installation recipe');
});
test('changed rock and physical terrain share complete triangles, finite normals and bounded rebuilt contacts',()=>{
 for(const field of candidate.art.fields){const p=field.mesh.geometry.attributes.position,normal=field.mesh.geometry.attributes.normal,index=field.mesh.geometry.index;for(let i=0;i<p.count;i++){assert(Math.abs(p.getY(i)-f.height(p.getX(i),p.getZ(i))-.012)<.00001);assert(Number.isFinite(normal.getX(i)+normal.getY(i)+normal.getZ(i)));}
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=ids.reduce((v,k)=>v+p.getX(k)/3,0),z=ids.reduce((v,k)=>v+p.getZ(k)/3,0),y=ids.reduce((v,k)=>v+p.getY(k)/3,0);assert(Math.abs(y-f.height(x,z)-.012)<.00001);}}
 assert(candidate.art.barriers.length>250&&candidate.art.barriers.length<600);for(const c of candidate.art.barriers){assert(Number.isFinite(c.x+c.z+c.topY));assert(c.terrainCliff&&c.landform);assert(c.topY>f.height(c.x,c.z)+2);}
});
test('numeric shaping allocates no scene resources and original factory draw/resource/RNG counts remain bounded',()=>{
 assert.equal(candidate.randomDraws,baseline.randomDraws);assert.equal(candidate.art.fields.length,4);assert.equal(candidate.art.group.children.length,baseline.art.group.children.length);
 for(let i=0;i<4;i++){const a=baseline.art.fields[i].mesh.geometry,b=candidate.art.fields[i].mesh.geometry;assert.equal(a.attributes.position.count,b.attributes.position.count);assert.equal(a.attributes.position.array.byteLength,b.attributes.position.array.byteLength);assert.deepEqual(Array.from(a.attributes.position.array).filter((_,i)=>i%3!==1),Array.from(b.attributes.position.array).filter((_,i)=>i%3!==1));}
 assert(candidate.art.triangles<10000);
});
