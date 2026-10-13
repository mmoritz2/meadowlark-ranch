import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createCoursedFieldWallGeometry as create,installCoursedFieldWalls as install} from './meadow-relief-wall-historical.mjs';
import {normalizeMeadowReliefWallSource} from './meadow-relief-wall-source-guard.cjs';
import {createCoursedFieldWallGeometry as before,installCoursedFieldWalls as installBefore} from './fixtures/fieldstone-wall-a78ed79/coursed-field-wall-before.mjs';
const record=(x,z,yaw)=>({x,z,tx:Math.cos(yaw),tz:Math.sin(yaw),nx:-Math.sin(yaw),nz:Math.cos(yaw),legacyRows:[20,21,22,23,24]});
const records=Array.from({length:128},(_,i)=>record(Math.sin(i*7.13)*310,Math.cos(i*11.71)*310,i*.317));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const bytes=d=>['positions','normals','uvs','colors','indices'].reduce((sum,k)=>sum+d[k].byteLength,0);
const point=(d,id)=>Array.from(d.positions.subarray(id*3,id*3+3));
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
test('Historical b1 slab: actual slab geometry preserves complete source records, unit ranges, resources and zero RNG',()=>{
 const frozen=structuredClone(records),old=Math.random;let calls=0,samples=0;
 Math.random=()=>{calls++;throw Error('Unexpected placement RNG');};
 let d;
 try{d=create(records,(x,z)=>{samples++;return x*.14-z*.098;});}finally{Math.random=old;}
 assert.equal(calls,0);assert.equal(samples,records.length*14*4);
 assert.deepEqual(records,frozen);assert.equal(d.triangles,records.length*280);
 assert.equal(d.positions.length/3,records.length*504);assert.equal(bytes(d),records.length*25536);
 const original=before(records,(x,z)=>x*.14-z*.098);
 assert.deepEqual(d.units,original.units,'Authored root, tangent, normal, legacy rows, index range, footprint and height metadata are exact');
 for(const k of ['positions','normals','uvs','colors'])assert(d[k].every(Number.isFinite));
 assert(d.indices.every(i=>i<d.positions.length/3));
 assert.deepEqual(d.colors,original.colors,'Existing deterministic per-stone variation retained');
});

test('Historical b1 slab: every new stone is a closed convex outward slab with physically planar fan normals',()=>{
 for(const slope of [0,.14,-.14]){
  const d=create(records,(x,z)=>x*slope-z*slope*.7);
  for(let stone=0;stone<records.length*14;stone++){
   const vertexStart=stone*36,indexStart=stone*60,unique=new Map(),edges=new Map();
   const corners=Array.from({length:12},(_,i)=>point(d,vertexStart+i));
   const centre=corners.reduce((s,p)=>s.map((v,k)=>v+p[k]/12),[0,0,0]);
   let volume=0;
   for(let at=indexStart;at<indexStart+60;at+=3){
    const ids=Array.from(d.indices.subarray(at,at+3)),ps=ids.map(id=>point(d,id));
    const normal=cross(sub(ps[1],ps[0]),sub(ps[2],ps[0])),area=Math.hypot(...normal);
    assert(area>1e-6,'Narrow half-stones have no collapsed triangles');
    for(const id of ids){const n=Array.from(d.normals.subarray(id*3,id*3+3));assert(Math.abs(Math.hypot(...n)-1)<1e-6);assert(dot(normal,n)>area*.995,'Actual fan triangle agrees with full planar face normal');}
    assert(dot(normal,sub(ps[0],centre))>0,'All triangles face away from their own solid interior');
    const faceNormal=Array.from(d.normals.subarray(ids[0]*3,ids[0]*3+3));
    assert(corners.every(p=>dot(faceNormal,sub(p,ps[0]))<=5e-5),'Every corner remains inside its whole polygon face plane within Float32 world-coordinate precision');
    const idsWelded=ps.map(p=>{const key=p.join(',');if(!unique.has(key))unique.set(key,unique.size);return unique.get(key);});
    for(let k=0;k<3;k++){const edge=[idsWelded[k],idsWelded[(k+1)%3]].sort((a,b)=>a-b).join(':');edges.set(edge,(edges.get(edge)||0)+1);}
    volume+=dot(sub(ps[0],centre),cross(sub(ps[1],centre),sub(ps[2],centre)))/6;
   }
   assert.equal(unique.size,12);assert.equal(edges.size,30);assert([...edges.values()].every(n=>n===2),'Closed manifold has no missing or double faces');
   assert.equal(unique.size-edges.size+20,2);assert(volume>1e-5,'Closed outward solid has positive physical volume');
  }
 }
});

function profile(d,r,stone){
 const p=Array.from({length:6},(_,k)=>{const [x,y,z]=point(d,stone*36+k);return {x:(x-r.x)*r.tx+(z-r.z)*r.tz,y};}).sort((a,b)=>a.y-b.y);
 const left=Math.min(...p.map(p=>p.x)),right=Math.max(...p.map(p=>p.x)),span=right-left;
 const bottom=p.slice(0,2).sort((a,b)=>a.x-b.x),crown=p.slice(4).sort((a,b)=>a.x-b.x);
 return {foot:(bottom[1].x-bottom[0].x)/span,crown:(crown[1].x-crown[0].x)/span,asymmetry:Math.abs((bottom[0].x-left)-(right-bottom[1].x))/span,span,crest:Math.max(...p.map(p=>p.y)),bearingTilt:Math.abs(bottom[0].y-bottom[1].y)};
}
test('Historical b1 slab: broad seated bearings, pronounced unequal shoulders and varied coping break the old rectangles',()=>{
 let newFoot=0,oldFoot=0,asymmetry=0,copingWidths=[],copingCreasts=[];
 for(const r of records.slice(0,64)){
  const d=create([r],()=>0),old=before([r],()=>0);
  for(let stone=0;stone<14;stone++){
   const p=profile(d,r,stone),o=profile(old,r,stone);
   assert(p.foot>.70&&p.foot<.97,'Flat foot remains broad, with real lower shoulders');
   assert(p.crown>.60&&p.crown<.90,'Broad coping/bearing top has real upper shoulders');
   assert(p.bearingTilt<.008,'Broad flat seating retains the authored sub-eight-millimetre corner nicks');
   newFoot+=p.foot;oldFoot+=o.foot;asymmetry+=p.asymmetry;
   if(stone>=10){copingWidths.push(p.span);copingCreasts.push(p.crest);assert(p.crest>.89&&p.crest<.952);}
  }
 }
 assert(oldFoot-newFoot>64*14*.09,'Average lower shoulder cut changes actual geometry substantially');
 assert(asymmetry/(64*14)>.025,'Seeded lower shoulders are measurably asymmetric');
 assert(Math.max(...copingWidths)-Math.min(...copingWidths)>.025,'Coping widths vary within the old quarter slots');
 assert(Math.max(...copingCreasts)-Math.min(...copingCreasts)>.045,'Coping skyline varies physically');
});

function options(){
 const scene=new T.Scene(),legacy=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial(),6);
 for(let i=0;i<6;i++)legacy.setMatrixAt(i,new T.Matrix4().makeTranslation(i===5?20:(i-2)*.2,.5,i===5?20:0));
 scene.add(legacy);const loaded=[];
 return {loaded,THREE:{...T,TextureLoader:class{async loadAsync(url){loaded.push(url);return new T.Texture();}}},scene,legacy,records:[{...record(0,0,0),legacyRows:[0,1,2,3,4]}],groundH:()=>0,anisotropy:7};
}
async function rngInstall(factory){
 const o=options(),old=Math.random;let state=123456789,calls=0;
 const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 Math.random=()=>{calls++;return next();};
 let wall;try{wall=await factory(o);}finally{Math.random=old;}
 return {o,wall,calls,future:Array.from({length:24},next)};
}
test('Historical b1 slab: actual installer keeps constructor RNG stream, three resident maps and one mesh draw owner',async()=>{
 const old=await rngInstall(installBefore),now=await rngInstall(install);
 assert.equal(now.calls,old.calls);assert.deepEqual(now.future,old.future,'No future seeded constructor stream drift');
 assert.deepEqual(now.o.loaded,old.o.loaded);assert.equal(now.o.loaded.length,3);
 const material=now.wall.mesh.material;
 assert.equal(new Set([material.map,material.normalMap,material.roughnessMap]).size,3);
 for(const map of [material.map,material.normalMap,material.roughnessMap]){assert.equal(map.wrapS,T.RepeatWrapping);assert.equal(map.wrapT,T.RepeatWrapping);assert.equal(map.anisotropy,7);}
 assert.equal(material.map.colorSpace,T.SRGBColorSpace);assert.equal(material.normalMap.colorSpace,T.NoColorSpace);assert.equal(material.roughnessMap.colorSpace,T.NoColorSpace);
 assert.equal(material.aoMap,null);assert.equal(material.metalness,0);assert.equal(material.roughness,1);assert.equal(material.envMapIntensity,.5);
 assert.equal(material.color.getHexString(),'c6c2b6');assert.deepEqual(material.normalScale.toArray(),[.42,.42]);
 const shader={fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('diffuseColor.rgb,.72)'));assert(!shader.fragmentShader.includes('texture2D('),'No added texture fetch or alpha card shading');
 assert.equal(material.customProgramCacheKey(),'coursed-fieldstone-v3');
 assert.equal(now.wall.mesh.name,'worldPaths:coursedFieldWalls');assert(now.wall.mesh.castShadow&&now.wall.mesh.receiveShadow);
 assert.equal(now.o.scene.children.length,2);assert.equal(now.wall.drawCalls,1);
 assert.equal(now.wall.submittedAddedTriangles,280);assert.equal(now.wall.legacySubmittedTriangles,72,'Retired legacy instance slots remain submitted');
 assert.equal(bytes(create(now.o.records,()=>0)),25536);
});

test('Historical b1 slab: only reviewed stone shape, PBR fields and child cache differ; entire original owner bodies restore',()=>{
 const directory=new URL('./fixtures/fieldstone-wall-a78ed79/',import.meta.url);
 const changes=JSON.parse(fs.readFileSync(new URL('source-changes.json',directory)));
 const hashes=JSON.parse(fs.readFileSync(new URL('preimage-SHA.json',directory)));
 for(const file of Object.keys(hashes)){
  let source=normalizeMeadowReliefWallSource(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),file);
  for(const c of changes.filter(c=>c.file===file).toReversed()){
   assert.equal(source.split(c.after).length,2,'Exact approved replacement once: '+file);source=source.replace(c.after,c.before);
  }
  assert.equal(sha(source),hashes[file],'Full a78 owner body restored; no route, RNG, collision, course policy or lifecycle elision: '+file);
 }
});
