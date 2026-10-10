import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createOuterLandscape} from '../assets/outer-landscape.js';
import {YOUNG_OUTER_POCKETS,YOUNG_OUTER_WOODLAND_LIMITS,youngPocketAt,planYoungOuterWoodland} from '../assets/young-outer-woodland.mjs';
const digest=g=>{const h=createHash('sha256');for(const a of [g.index,...Object.values(g.attributes)])h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));return h.digest('hex');};
const scene=new T.Scene(),ground=new T.PlaneGeometry(1000,1000,64,64);ground.rotateX(-Math.PI/2);ground.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(ground.attributes.position.count*3).fill(.9),3));const inner=new T.Mesh(ground,new T.MeshStandardMaterial({vertexColors:true}));
const outer=createOuterLandscape({THREE:T,scene,heightAt:()=>0,groundMesh:inner}),g=outer.mesh.geometry,args={positions:g.attributes.position.array,index:g.index.array,trees:outer.woodlandSites,rockData:outer.rockClusterData};
const before={outer:digest(g),inner:digest(ground),trees:JSON.stringify(outer.woodlandSites),rocks:JSON.stringify(outer.rockClusterData.records)},rows=planYoungOuterWoodland(args);
test('young pockets use a deterministic isolated hash without altering existing world data',()=>{
 const random=Math.random;Math.random=()=>{throw Error('Unexpected ambient randomness');};try{assert.deepEqual(planYoungOuterWoodland(args),rows);}finally{Math.random=random;}
 assert.equal(digest(g),before.outer);assert.equal(digest(ground),before.inner);assert.equal(JSON.stringify(outer.woodlandSites),before.trees);assert.equal(JSON.stringify(outer.rockClusterData.records),before.rocks);
});
test('every young root has a valid independently reconstructed emitted terrain face and height',()=>{
 const p=args.positions,index=args.index;
 for(const r of rows){const ids=[index[r.triangle*3],index[r.triangle*3+1],index[r.triangle*3+2]],[a,b,c]=ids.map(i=>Array.from(p.slice(i*3,i*3+3))),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]),wa=((b[2]-c[2])*(r.x-c[0])+(c[0]-b[0])*(r.z-c[2]))/den,wb=((c[2]-a[2])*(r.x-c[0])+(a[0]-c[0])*(r.z-c[2]))/den,wc=1-wa-wb;
  assert(Math.min(wa,wb,wc)>-1e-8);assert(Math.abs(r.y-(wa*a[1]+wb*b[1]+wc*c[1]))<1e-8);
  const n=new T.Vector3().crossVectors(new T.Vector3(...b).sub(new T.Vector3(...a)),new T.Vector3(...c).sub(new T.Vector3(...a))).normalize();if(n.y<0)n.negate();assert(n.distanceTo(new T.Vector3(...r.normal))<1e-8);assert(r.slope<.62);
 }
});
test('new pockets retain finite support and basal clearances with bounded model heights',()=>{
 const seen=new Set();for(const r of rows){assert(Object.values(r).filter(v=>typeof v==='number').every(Number.isFinite));assert(!seen.has(r.x+':'+r.z));seen.add(r.x+':'+r.z);assert(youngPocketAt(r.x,r.z,YOUNG_OUTER_POCKETS[r.pocket])>=.035);assert(Math.max(Math.abs(r.x),Math.abs(r.z))>538);assert(!outer.rockClusterData.intersectsRoot(r));assert(r.height>=3.2&&r.height<=8.85000001);assert(['broadleaf','canopy-broadleaf'].includes(r.source));for(const old of outer.woodlandSites)assert(Math.hypot(r.x-old.x,r.z-old.z)>=2.3+old.height*.02);}
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(rows[i].pocket===rows[j].pocket)assert(Math.hypot(rows[i].x-rows[j].x,rows[i].z-rows[j].z)>=2.55);
 for(const p of YOUNG_OUTER_POCKETS)assert.equal(youngPocketAt(p.x+100,p.z+100,p),0);
});
test('six unequal pockets remain within the whole-scene180-tree360-triangle6-draw ceiling',()=>{
 assert(rows.length>0);assert(rows.length<=YOUNG_OUTER_WOODLAND_LIMITS.trees);assert(rows.length*2<=YOUNG_OUTER_WOODLAND_LIMITS.triangles);const groups=new Set(rows.map(r=>r.sector+':'+r.source));assert(groups.size<=YOUNG_OUTER_WOODLAND_LIMITS.draws);for(let p=0;p<YOUNG_OUTER_POCKETS.length;p++)assert(rows.filter(r=>r.pocket===p).length<=YOUNG_OUTER_WOODLAND_LIMITS.pocket);assert(new Set(YOUNG_OUTER_POCKETS.map(p=>JSON.stringify(p.lobes))).size>1);
});
