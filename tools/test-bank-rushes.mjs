// ribbon-falls-2: restore only exact parent Water for this historical source contract.
import{normalizeRibbonFallsSource as ribbonParent}from'./ribbon-falls-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createBankRushGeometry,BANK_RUSH_PROFILE} from '../assets/bank-rushes.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const old=read('./fixtures/bank-rushes-7908e80/world-water.js'),next=ribbonParent(read('../assets/features/world-water.js'),'assets/features/world-water.js');
const changes=JSON.parse(read('./fixtures/bank-rushes-7908e80/declared-source-changes.json'));
const native=JSON.parse(read('./fixtures/bank-rushes-7908e80/native-bank-reeds.json')).owner;
const approvedOwners=JSON.parse(read('./fixtures/river-combined-source-7908e80.json'));
function restoreApprovedOwners(source,edits){for(const {after,before}of edits){assert.equal(source.split(after).length,2,'Exactly one declared owner addition: '+after.slice(0,90));source=source.replace(after,before);}return source;}

const bytes=g=>g.index.array.byteLength+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);
function previousGeometry(){return new Function('THREE',changes.geometry.before+'return reedGeo;')(T);}
function seededGeometry(factory){let seed=7281,draws=0,constructors=0;const random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},prior=Math.random;
 const D={...T,BufferGeometry:class extends T.BufferGeometry{constructor(){super();constructors++;}}};
 try{Math.random=random;const geometry=factory(D),atFactory=draws,future=Array.from({length:16},random);return{geometry,constructors,atFactory,future};}finally{Math.random=prior;}
}

test('original physical clump uses72nondegenerate triangles, narrow leaves, real stem/head surfaces and finite physical normals',()=>{
 const g=createBankRushGeometry(T),p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;
 assert.equal(g.index.count/3,72);assert.equal(p.count,71);assert.equal(BANK_RUSH_PROFILE.triangles,72);assert.equal(bytes(g),2988);
 for(const a of Object.values(g.attributes))assert(Array.from(a.array).every(Number.isFinite));
 for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);
 assert(Array.from(c.array).every(v=>v>0&&v<1),'Actual vertex colors are populated, not a missing black attribute');
 let area=Infinity;
 for(let i=0;i<g.index.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,g.index.getX(i)),b=new T.Vector3().fromBufferAttribute(p,g.index.getX(i+1)),d=new T.Vector3().fromBufferAttribute(p,g.index.getX(i+2));area=Math.min(area,b.sub(a).cross(d.sub(a)).length()/2);}
 assert(area>1e-9);
 // The four main leaves have independent root/middle/tip cross-sections and
 // narrow folded facets; none is the previous metre-wide crossed card.
 for(let leaf=0;leaf<4;leaf++){const k=17+leaf*7,a=new T.Vector3().fromBufferAttribute(p,k),b=new T.Vector3().fromBufferAttribute(p,k+1),l=new T.Vector3().fromBufferAttribute(p,k+4),r=new T.Vector3().fromBufferAttribute(p,k+5),root=a.clone().add(b).multiplyScalar(.5),mid=l.clone().add(r).multiplyScalar(.5),tip=new T.Vector3().fromBufferAttribute(p,k+6);
  assert(a.distanceTo(b)<.02);assert(l.distanceTo(r)<.028);assert(mid.distanceTo(root)>.30);assert(mid.clone().sub(root).cross(tip.clone().sub(root)).length()>.01,'Actual curved contour, not a planar broad card');
 }
 const tallRings=[0,3,6].map(k=>Array.from({length:3},(_,i)=>new T.Vector3().fromBufferAttribute(p,k+i)).reduce((a,v)=>a.add(v),new T.Vector3()).multiplyScalar(1/3));
 assert(tallRings[1].distanceTo(tallRings[0].clone().lerp(tallRings[2],.5))>.005,'Tall stem has two unequal physical segments');
});

test('new actual geometry fits the old physical envelope and preserves exact source sphere/height/root contacts for all461native rows',()=>{
 const a=previousGeometry();a.computeBoundingSphere();a.computeBoundingBox();const b=createBankRushGeometry(T),p=b.attributes.position;
 assert.deepEqual(b.boundingSphere.center.toArray(),native.geometry.sphere.center);assert.equal(b.boundingSphere.radius,native.geometry.sphere.radius);assert.equal(b.boundingSphere.radius,a.boundingSphere.radius);
 assert.equal(b.boundingBox.min.y,0);assert.equal(b.boundingBox.max.y,1);
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);assert(b.boundingSphere.containsPoint(v));assert(a.boundingBox.containsPoint(v));}
 assert.equal(native.count,461);assert.equal(native.instanceCapacity,461);
 const roots=new T.Vector3(),m=new T.Matrix4();
 for(let row=0;row<native.count;row++){m.fromArray(native.instanceMatrix,row*16);const oldRadius=a.boundingSphere.radius*m.getMaxScaleOnAxis(),newRadius=b.boundingSphere.radius*m.getMaxScaleOnAxis();assert.equal(newRadius,oldRadius,'Course gather R/TALL/LOW thresholds stay exact');
  roots.set(0,0,0).applyMatrix4(m);assert.equal(roots.y,native.instanceMatrix[row*16+13]);let lo=Infinity,hi=-Infinity;for(let i=0;i<p.count;i++){const y=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m).y;lo=Math.min(lo,y);hi=Math.max(hi,y);}
  assert.equal(lo,roots.y);assert.equal(hi,roots.y+native.instanceMatrix[row*16+5]);
 }
});

test('replacement consumes exactly the original geometry constructor UUID draws and leaves the entire future global random sequence exact',()=>{
 const a=seededGeometry(D=>new Function('THREE',changes.geometry.before+'return reedGeo;')(D)),b=seededGeometry(createBankRushGeometry);
 assert.equal(a.constructors,1);assert.equal(b.constructors,1);assert.equal(a.atFactory,4);assert.equal(b.atFactory,4);assert.equal(a.geometry.uuid,b.geometry.uuid);assert.deepEqual(b.future,a.future);
 const other=createBankRushGeometry(T);assert.deepEqual(Array.from(other.attributes.position.array),Array.from(b.geometry.attributes.position.array));assert.deepEqual(Array.from(other.attributes.color.array),Array.from(b.geometry.attributes.color.array));assert.deepEqual(Array.from(other.index.array),Array.from(b.geometry.index.array));
});

test('entire texture/scatter/RNG/layout/instance/contact/physics/cleanup/tick body is byte exact after only individually approved bank/reed/ramp replacements',()=>{
 let restored=restoreApprovedOwners(next,approvedOwners.bankAndRamp);assert.equal(restored.split(changes.import).length,2);restored=restored.replace(changes.import,'');
 for(const key of ['geometry','comment','material']){assert.equal(restored.split(changes[key].after).length,2);restored=restored.replace(changes[key].after,changes[key].before);}
 assert.equal(restored,old);assert(next.includes("P.reedMesh=instance(reedGeo,reedMat,reeds,'Water | bank reeds',false)"));
 const texture=s=>s.slice(s.indexOf(' const reedTex='),s.indexOf(' /* ---- shared prototype geometries ---- */'));assert.equal(texture(next),texture(old));
 const placements=s=>s.slice(s.indexOf(' const pebbles=[],reeds=[],roots=[];'),s.indexOf(' /* ================= 9. one tick'));assert.equal(placements(restored),placements(old),'All seeded river/lake/dock rows and source ownership are unaltered');
 assert.equal((next.match(/new THREE\.MeshStandardMaterial\(/g)||[]).length,(old.match(/new THREE\.MeshStandardMaterial\(/g)||[]).length);assert.equal((next.match(/Math\.random\(/g)||[]).length,(old.match(/Math\.random\(/g)||[]).length);
});

test('same material constructor now uses complete opaque physical colors and no card alpha map; source texture construction survives',()=>{
 const mat=new Function('THREE',changes.material.after+'return reedMat;')(T),g=createBankRushGeometry(T);
 assert.equal(mat.map,null);assert.equal(mat.vertexColors,true);assert.equal(mat.transparent,false);assert.equal(mat.opacity,1);assert.equal(mat.alphaTest,.5);assert.equal(mat.depthWrite,true);assert.equal(mat.side,T.DoubleSide);assert.equal(mat.roughness,.9);assert.equal(mat.metalness,0);
 assert.equal(g.attributes.color.count,g.attributes.position.count);assert.equal(mat.onBeforeCompile,T.Material.prototype.onBeforeCompile);assert(next.includes(' const reedTex=canvasTex(64,128,'));
 assert.equal(native.cast,false);assert.equal(native.receive,true);assert.equal(native.instanceColor.length,native.count*3);
});

test('honest prototype/submission cost is bounded with unchanged instance/source capacity and material/texture/draw populations',()=>{
 const oldGeo=previousGeometry(),nextGeo=createBankRushGeometry(T);assert.equal(bytes(oldGeo),420);assert.equal(bytes(nextGeo)-bytes(oldGeo),2568);
 assert.equal(native.count*(nextGeo.index.count/3-oldGeo.index.count/3),30426);assert.equal(native.count*nextGeo.index.count/3,33192);
 assert.equal(native.instanceMatrix.length,461*16);assert.equal(native.instanceColor.length,461*3);assert.equal(BANK_RUSH_PROFILE.stems,2);assert.equal(BANK_RUSH_PROFILE.seedHeads,1);
});
