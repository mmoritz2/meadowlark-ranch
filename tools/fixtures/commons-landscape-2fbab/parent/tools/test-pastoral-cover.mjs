import {normalizeRanchModelSource} from './ranch-model-source-guard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import * as P from '../assets/pastoral-cover.mjs?v=pastoral-cover-1';
import {refreshPastoralCover,installPastoralCoverRefresh} from '../assets/pastoral-cover-refresh.mjs?v=pastoral-cover-1';
import {createGrassTuftGeometry} from '../assets/meadow-cover.js';
import {createGrassFamilyGeometry} from '../assets/grass-families.mjs';
import {createGrazedSwardGeometry} from '../assets/grazed-sward.mjs';
import {readSwardSpecimens,MIXED_SWARD} from '../assets/mixed-sward.mjs';
const fixture=new URL('./fixtures/pastoral-cover-source-7fbd127.json',import.meta.url);
const contract=JSON.parse(fs.readFileSync(fixture));
const defaults={terrainH:()=>0,riverZ:()=>120,riverLevel:()=>-1,streamX:()=>118};
const noRandom=run=>{const old=Math.random;Math.random=()=>{throw Error('Submitted grazing consumed gameplay RNG');};try{return run();}finally{Math.random=old;}};
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const digest=a=>crypto.createHash('sha256').update(a).digest('hex');
const basis=a=>Math.hypot(...a.slice(0,3))+Math.hypot(...a.slice(4,7))+Math.hypot(...a.slice(8,11));

test('field import is inert and exact outside response precedes configuration',()=>{
 assert.equal(P.getPastoralCoverField(),null);assert.deepEqual(P.pastoralCoverAt(0,30),{cut:0,cap:Infinity});
 const a=new Float32Array(16);a[0]=a[5]=a[10]=a[15]=1;const old=a.slice();
 assert.equal(noRandom(()=>P.respondPastoralGrassMatrix(a,0,{},()=>0)),1);assert.deepEqual(a,old);
});
test('open pasture uses varied low physical caps and keeps unequal tall seeded margins',()=>{
 const f=noRandom(()=>P.configurePastoralCover(defaults));
 const cores=[[0,30],[0,80],[65,-145],[90,-110],[180,40],[245,140],[20,230]];
 const caps=cores.map(([x,z])=>f.at(x,z).cap);assert(caps.every(h=>h>=.25&&h<=.40));assert(Math.max(...caps)-Math.min(...caps)>.03);
 for(const[x,z]of[[59,-172],[178,6],[46,207],[251,113]]){const q=f.at(x,z);assert(q.cut<.15&&q.cap>2,'Golden source band must retain tall volume');}
 for(const[x,z]of[[-200,130],[-160,-210],[-300,-320],[310,300],[400,0],[200,-100],[20,16],[118,-60],[0,120]])assert.equal(f.at(x,z).cut,0);
 assert.equal(f.stats.gridBytes,233120);assert.equal(f.stats.gridVertices,29140);
});
test('protected crop and wet-strip subcell interiors never receive interpolated grazing',()=>{
 const f=P.createPastoralCoverField({...defaults,terrainH:()=>-1,riverLevel:()=>0});
 for(let x=173.001;x<176;x+=.087)for(const z of[-152.999,-150.4,-57.001])assert.equal(f.at(x,z).cut,0);
 for(let z=110.401;z<110.6;z+=.007)for(const x of[0.14,78.17,243.82])assert.equal(f.at(x,z).cut,0);
 for(let x=114.301;x<114.5;x+=.009)for(const z of[-80.13,42.87,160.99])assert.equal(f.at(x,z).cut,0);
});
test('actual dense forest metadata keeps groves tall without mowing their source trees',()=>{
 const trees=[{x:0,z:60,s:1},{x:2,z:61,s:1},{x:-2,z:59,s:1},{x:1,z:63,s:1}],before=structuredClone(trees);
 const clear=P.createPastoralCoverField(defaults),wood=P.createPastoralCoverField({...defaults,forestPoints:trees});
 assert(clear.at(0,60).cut>.9);assert.equal(wood.at(0,60).cut,0);assert(wood.at(18,60).cut>.9);assert.deepEqual(trees,before);
});
test('whole finite Chalk and actual wet domains stay byte-exterior even at boundaries',()=>{
 const chalkAt=(x,z)=>x>=-30&&x<=20&&z>=170&&z<=240,wetAt=(x,z)=>Math.hypot(x-184,z-43)<=5;
 const f=P.createPastoralCoverField({...defaults,chalkAt,wetAt});
 for(let z=170;z<=240;z+=.25)for(const x of[-30,0,20])assert.equal(f.at(x,z).cut,0);
 for(let a=0;a<6.3;a+=.031){const x=184+Math.cos(a)*4.99,z=43+Math.sin(a)*4.99;assert.equal(f.at(x,z).cut,0);}
});
test('original source cells are immutable and cut/cap cache honors version/count/field revision',()=>{
 P.configurePastoralCover(defaults);const c={version:4,count:2,matrices:new Float32Array(32),colors:new Float32Array(6)};
 for(let i=0;i<2;i++){const o=i*16;c.matrices[o]=c.matrices[o+5]=c.matrices[o+10]=c.matrices[o+15]=1;c.matrices[o+12]=i;c.matrices[o+14]=60;}
 const old=bytes(c.matrices).toString('hex'),q=noRandom(()=>P.pastoralSourceRows(c));assert.equal(P.pastoralSourceRows(c),q);
 c.version++;const q2=P.pastoralSourceRows(c);assert.notEqual(q,q2);assert.deepEqual(q2.caps,q.caps);
 c.count=1;assert.equal(P.pastoralSourceRows(c).cuts.length,1);P.configurePastoralCover(defaults);assert.notEqual(P.pastoralSourceRows(c),q2);
 assert.equal(bytes(c.matrices).toString('hex'),old);
});
test('every real grass prototype honors the same cap/contact, old zeros, yaw and Float32 idempotence',()=>{
 const glb=fs.readFileSync(new URL('../assets/models/world/grass_medium_02_specimens.glb',import.meta.url)),models=readSwardSpecimens(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength));
 const geometries=[createGrassTuftGeometry(T,{profile:'near-folded-v1'}),...[4,6,8].map(bladeCount=>createGrassTuftGeometry(T,{bladeCount,segments:2,profile:'middle-natural-v1'})),...[0,1,2].map(f=>createGrassFamilyGeometry(T,f)),createGrazedSwardGeometry(T),...models.map(s=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(s.positions,3));return g;})];
 const field=P.configurePastoralCover(defaults),root={x:0,z:60},cap=field.at(root.x,root.z).cap;
 for(const g of geometries){g.computeBoundingBox();const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.91),m=new T.Matrix4().compose(new T.Vector3(root.x,-.03,root.z),q,new T.Vector3(1.6,2.8,1.6)),a=new Float32Array(m.elements),old=a.slice();
  noRandom(()=>P.respondPastoralGrassMatrix(a,0,g,()=>0));assert.equal(a[12],old[12]);assert.equal(a[14],old[14]);assert.equal(a[15],old[15]);
  const factor=a[5]/old[5],height=a[5]*(g.boundingBox.max.y-g.boundingBox.min.y);assert(height<=cap+1e-6);assert(factor<=1&&factor>0);assert(Math.abs(a[13]-old[13]*factor)<1e-8);
  assert(Math.abs(a[0]/old[0]-factor)<1e-7&&Math.abs(a[8]/old[8]-factor)<1e-7);
  const first=a.slice();for(let i=0;i<8;i++)noRandom(()=>P.respondPastoralGrassMatrix(a,0,g,()=>0));assert.deepEqual(a,first);
  const zero=old.slice();for(const c of[0,4,8])zero.fill(0,c,c+3);const zold=zero.slice();P.respondPastoralGrassMatrix(zero,0,g,()=>0);assert.deepEqual(zero,zold);g.dispose();
 }
 assert.equal(MIXED_SWARD.maxTriangleRatio,1.20);assert.equal(MIXED_SWARD.richTriangles,70);
});
test('pastoral blue is MAX after original skirts, idempotent, and preserves all other channels',()=>{
 const f=P.configurePastoralCover(defaults),size=512,a=new Uint8ClampedArray(size*size*4);for(let i=0;i<a.length;i++)a[i]=(i*43+17)%256;const old=a.slice();
 assert(noRandom(()=>f.applyGrazingPixels(a,size))>3000);const first=a.slice();assert.equal(f.applyGrazingPixels(a,size),0);assert.deepEqual(a,first);
 for(let i=0;i<a.length;i++){if(i%4!==2)assert.equal(a[i],old[i]);else assert(a[i]>=old[i]);}
 const s=fs.readFileSync(new URL('../assets/terrain-realism.js',import.meta.url),'utf8');assert(s.indexOf('extendWoodlandMask(woodedPixels.data')<s.indexOf('applyPastoralGrazingPixels(woodedPixels.data'));
});
test('portable whole-source receipt allows only precise submitted-response additions',()=>{
 const files=[...new Set(contract.changes.map(c=>c.file))];for(const file of files){let s=normalizeRanchModelSource(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),file);for(const c of contract.changes.filter(c=>c.file===file).reverse()){assert.equal(s.split(c.after).length-1,1,file);s=s.replace(c.after,c.before);}assert.equal(digest(s),contract.baselineSHA256[file],file);}
});
test('actual late installer order waits course, Chalk and ferry before one grass-only response',async()=>{
 const scene=new T.Scene(),g=createGrassTuftGeometry(T,{profile:'near-folded-v1'}),mat=new T.MeshStandardMaterial(),seed=new T.InstancedMesh(g,mat,2),m=new T.Matrix4().makeScale(2,2,2);m.elements[14]=60;seed.setMatrixAt(0,m);m.makeScale(0,0,0);m.elements[14]=60;seed.setMatrixAt(1,m);seed.setColorAt(0,new T.Color());seed.setColorAt(1,new T.Color());scene.add(seed);
 const events=[],W={...defaults,seedGrass:seed,groundH:()=>0,forestPoints:[],nearGroundCover:{invalidate(){events.push('near invalidate');},tick(){events.push('near tick');}},mixedSward:{ready:Promise.resolve(),refreshEligibility(){events.push('mixed invalidate');},tick(){events.push('mixed tick');}}};
 const G={scene,world:W,horse:{player:{pos:{x:0,z:60}}},floraPkg:{refreshPastoralCover(){events.push('flora');return{tuft:1};}},courseClear:{},waterPkg:{}};
 let course, chalk, ferry;G.courseClear.ready=new Promise(r=>course=r);W.chalkCoverReady=new Promise(r=>chalk=r);
 const old=seed.instanceMatrix.array.slice(),colors=seed.instanceColor.array.slice(),ready=installPastoralCoverRefresh(G);G.waterPkg.ferryBankApproachReady=new Promise(r=>ferry=r);
 await Promise.resolve();course();chalk();await new Promise(r=>setImmediate(r));assert.equal(events.length,0);assert.deepEqual(seed.instanceMatrix.array,old);
 ferry();const result=await ready;assert(result.seed>0);assert.deepEqual(events,['flora','near invalidate','near tick','mixed invalidate','mixed tick']);
 assert.deepEqual(seed.instanceMatrix.array.slice(16),old.slice(16));assert.deepEqual(seed.instanceColor.array,colors);assert.equal(seed.count,2);
 const first=seed.instanceMatrix.array.slice();assert.equal(refreshPastoralCover(G),result);assert.deepEqual(seed.instanceMatrix.array,first);assert.equal(installPastoralCoverRefresh(G),ready);
 g.dispose();mat.dispose();seed.dispose();
});
