import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture as f} from './coyote-macro-fixture.mjs';
import {COYOTE_MACRO_CONTROLS,coyoteNorthMacroHeight,coyoteOasisMacroBlend,coyoteOasisMacroHeight} from '../assets/coyote-macroform.mjs';
const {T,old,next,before,after,n,step}=f;
const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
const pins=JSON.parse(read('./fixtures/coyote-macro-8042555/source.json'));
const changes=JSON.parse(read('./fixtures/coyote-macro-8042555/source-changes.json'));
function build(module,height){let draws=0;const previous=Math.random;Math.random=()=>{draws++;return .27;};try{const scene=new T.Scene(),material=new T.MeshStandardMaterial(),colliders=[],art=module.createCanyonLandscape({THREE:T,scene,heightAt:height,terrainStep:step,material,colliders});return{scene,material,colliders,art,draws,future:Array.from({length:32},()=>Math.random())};}finally{Math.random=previous;}}
const a=build(old,f.oldHeight),b=build(next,f.height);
function support(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),i=iz*n+ix;const ids=gx-ix+gz-iz<=1?[i,i+n,i+1]:[i+1,i+n,i+n+1];for(const id of ids)assert.equal(after[id],before[id],`Protected support vertex${id} at${x},${z}`);}
function ribbon(points,width=3){let samples=0;for(let i=1;i<points.length;i++){const A=points[i-1],B=points[i],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz);if(!L)continue;const k=Math.ceil(L/.25);for(let j=0;j<=k;j++)for(const o of[-width,0,width]){support(A[0]+dx*j/k-dz/L*o,A[1]+dz*j/k+dx/L*o);samples++;}}return samples;}
function distance(x,z,route){let d=Infinity;for(let i=1;i<route.length;i++){const A=route[i-1],B=route[i],dx=B[0]-A[0],dz=B[1]-A[1],q=Math.max(0,Math.min(1,((x-A[0])*dx+(z-A[1])*dz)/(dx*dx+dz*dz||1)));d=Math.min(d,Math.hypot(x-A[0]-dx*q,z-A[1]-dz*q));}return d;}

test('fresh804 native grid is pinned, source reconstruction matches every changed vertex, and only the two finite owners change',()=>{
 assert.equal(f.sha(before),pins.terrainSHA256);assert.equal(f.maxBaseError,0);assert(f.changed.length>2500&&f.changed.length<3100,'substantial two-owner macro change');assert(f.maxDelta>15&&f.maxDelta<17);
 let north=0,oasis=0;for(const id of f.changed){const x=id%n*step-500,z=Math.floor(id/n)*step-500;if(x>=-363&&x<=-147&&z>=-5&&z<=85)north++;else{assert(x>=-190&&x<=-107&&z>150.390625&&z<199,'all other region vertices stay exact');oasis++;}assert(Number.isFinite(after[id]));}
 assert(north>2000&&oasis>300,'both actual photographed owners change materially');
});

test('whole source bodies normalize to804 only through precise declared height/planning/cache changes',()=>{
 for(const [file,hash]of Object.entries(pins.runtimeSHA256)){
  let source=normalizeStarterTackSource(read('../'+file),file);for(const change of changes.filter(c=>c.file===file).reverse()){
   if(change.kind==='prefix'){assert(source.startsWith(change.after));source=source.slice(change.after.length);}else{assert.equal(source.split(change.after).length,2,'exact-one declared hook '+file);source=source.replace(change.after,change.before);}
  }assert.equal(f.digest(source),hash,file+' unexplained source edit');
 }
 const source=read('../assets/canyon-landscape.js'),baseline=read('./fixtures/coyote-macro-8042555/canyon-landscape.js');assert.equal(source.slice(source.indexOf('export function createCanyonLandscape')),baseline.slice(baseline.indexOf('export function createCanyonLandscape')),'same mesh/material/normal/physical contour construction');
 assert(!/Math\.random|new\s+[A-Za-z_$][\w.$]*\s*\(|fetch\(|THREE|window\./.test(read('../assets/coyote-macroform.mjs')),'pure numeric original contour helper');
});

test('original804 physical macro recipe and older historical planning relief remain exact without scene RNG',()=>{
 const previous=Math.random;Math.random=()=>assert.fail('numeric field consumes RNG');try{
  for(let z=-15;z<222;z+=1.1)for(let x=-375;x<-101;x+=1.1){assert.equal(next.canyonMacroPlanningRelief(x,z),old.canyonRelief(x,z));assert.equal(next.canyonPlanningRelief(x,z),old.canyonPlanningRelief(x,z));}
 }finally{Math.random=previous;}
 const p=next.createCanyonPlacementPlan({rawHeightAt:f.planningRaw,macroRawHeightAt:f.macroPlanningRaw,heightAt:f.height,terrainStep:step}),q=old.createCanyonPlacementPlan({rawHeightAt:f.planningRaw,heightAt:f.oldHeight,terrainStep:step});
 assert.deepEqual(p.grid,q.grid);assert.deepEqual(p.bounds,q.bounds);assert.deepEqual(p.barriers,q.barriers);assert.equal(p.grid.bytes,11440);assert.equal(p.macroGrids.reduce((s,g)=>s+g.bytes,0),30252);
 for(const g of p.macroGrids){for(let iz=0;iz<g.nz;iz++)for(let ix=0;ix<g.nx;ix++)assert.equal(g.heights[iz*g.nx+ix],before[(iz+g.iz0)*n+ix+g.ix0]);
  for(let z=g.iz0*step-500;z<(g.iz0+g.nz-1)*step-500;z+=.91)for(let x=g.ix0*step-500;x<(g.ix0+g.nx-1)*step-500;x+=.91)assert.equal(p.heightAt(x,z),q.heightAt(x,z),'actual initial admission ground exact');
 }
});

test('all actual route3m hoof strips, Derby, water beds, landmarks and fixed principal scan-foot supports stay exact',()=>{
 assert(f.routes.length>5);for(const route of f.routes)assert(ribbon(route.pts)>30);
 assert(ribbon([[-196,200],[-200,262],[-262,280],[-305,255],[-300,212],[-262,198],[-226,190],[-196,200]])>3000);
 for(let z=130;z<=150.390625;z+=.25)for(let x=-158;x<-119;x+=.25)support(x,z);
 for(let angle=0;angle<Math.PI*2;angle+=.05)for(const radius of[0,4,8,12,16])support(-200+Math.cos(angle)*radius,158+Math.sin(angle)*radius);
 for(let x=-360;x<-100;x+=.75)for(let o=-13;o<=13;o+=.5)support(x,120+Math.sin(x*.012)*45+o);
 for(let x=-249;x<=-201;x+=2)for(let z=109;z<=133;z+=2)support(x,z);for(let x=-265;x<=-211;x+=2)for(let z=200;z<=240;z+=2)support(x,z);
});

test('same real four skin meshes and constructor stream retain resources and untouched West/East buffers',()=>{
 assert.equal(a.draws,b.draws);assert.equal(b.draws,48);assert.deepEqual(b.future,a.future);assert.equal(b.art.fields.length,4);assert.equal(b.art.group.children.length,4);
 for(const id of ['western-wall','eastern-wall']){const A=a.art.fields.find(f=>f.id===id).mesh.geometry,B=b.art.fields.find(f=>f.id===id).mesh.geometry;for(const key of Object.keys(A.attributes))assert.deepEqual(B.attributes[key].array,A.attributes[key].array);assert.deepEqual(B.index.array,A.index.array);}
 for(let i=0;i<4;i++){const A=a.art.fields[i].mesh,B=b.art.fields[i].mesh;assert.equal(A.geometry.attributes.position.count,B.geometry.attributes.position.count);assert.equal(A.geometry.uuid,B.geometry.uuid);assert.equal(A.uuid,B.uuid);assert.deepEqual(A.geometry.attributes.uv.array,B.geometry.attributes.uv.array);assert.deepEqual(A.geometry.attributes.oasisTone.array,B.geometry.attributes.oasisTone.array);assert.equal(A.material.uuid,B.material.uuid);assert.equal(A.material.customProgramCacheKey(),B.material.customProgramCacheKey());}
 assert.equal(a.art.triangles,6772);assert.equal(b.art.triangles,7230);const bytes=art=>art.fields.reduce((s,{mesh:{geometry:g}})=>s+Object.values(g.attributes).reduce((s,v)=>s+v.array.byteLength,0)+g.index.array.byteLength,0);assert.equal(bytes(b.art)-bytes(a.art),2748);
});

test('every visible stone triangle matches the physical grid and has finite unit normals, with no floating toe or independent height proxy',()=>{
 let samples=0;for(const field of b.art.fields){const g=field.mesh.geometry,p=g.attributes.position,norm=g.attributes.normal,used=new Set(g.index.array);
  for(let i=0;i<p.count;i++){assert(Math.abs(p.getY(i)-f.height(p.getX(i),p.getZ(i))-.012)<1e-5);const length=Math.hypot(norm.getX(i),norm.getY(i),norm.getZ(i));assert(Number.isFinite(length));if(used.has(i))assert(Math.abs(length-1)<2e-6);else assert.equal(length,0,'unused grid vertices do not submit a normal');}
  for(let k=0;k<g.index.count;k+=3){const ids=Array.from(g.index.array.slice(k,k+3)),P=ids.map(id=>new T.Vector3().fromBufferAttribute(p,id));assert(new T.Triangle(...P).getArea()>1e-8);for(const weights of [[1/3,1/3,1/3],[.7,.1,.2],[.1,.7,.2]]){const point=new T.Vector3();P.forEach((v,i)=>point.addScaledVector(v,weights[i]));assert(Math.abs(point.y-f.height(point.x,point.z)-.012)<1e-5);samples++;}}
 }assert(samples>21000);
});

test('rebuilt actual cliff contacts stay finite, follow dependent ground heights and retain all real riding clearances',()=>{
 assert.equal(b.art.barriers.length,414);for(const c of b.art.barriers){assert(c.terrainCliff&&c.landform&&c.r===1.05&&Number.isFinite(c.topY));let top=f.height(c.x,c.z);for(let a=0;a<8;a++)for(const d of[6,12,20])top=Math.max(top,f.height(c.x+Math.cos(a*Math.PI/4)*d,c.z+Math.sin(a*Math.PI/4)*d));assert.equal(c.topY,top+.3);}
 for(const route of f.routes){let gap=Infinity;for(const c of b.art.barriers)gap=Math.min(gap,distance(c.x,c.z,route.pts)-c.r);assert(gap>3,route.id+' hoof tube intersects a cliff contact');}
});

test('new forms have unequal connected crowns, recessed curved benches and smooth exact scan-foot response',()=>{
 assert(Object.isFrozen(COYOTE_MACRO_CONTROLS));const crowns=COYOTE_MACRO_CONTROLS.northCrown.filter((_,i)=>i>2&&i<10).map(([along])=>coyoteNorthMacroHeight(0,0,along,0));assert(Math.max(...crowns)-Math.min(...crowns)>7,'unequal main crowns');
 const levels=[.15,.30,.48,.62,.76,.95].map(q=>coyoteOasisMacroHeight(-146,163+q*19,Math.abs(q),Math.abs(q)));assert(levels[0]>levels[2]+5&&levels[2]>levels[4]+4&&levels[4]>levels[5],'two recessed faces and a grounded lower toe');
 for(const z of[145,149,150.390625])assert.equal(coyoteOasisMacroBlend(-146,z,.2,.2),0);const a=coyoteOasisMacroBlend(-146,150.390626,.2,.2),b=coyoteOasisMacroBlend(-146,150.391626,.2,.2);assert(a<1e-12&&b<1e-10,'no hard blade boundary at retained footing');
 assert.equal(coyoteOasisMacroBlend(-146,199,.2,.2),0);assert.equal(coyoteNorthMacroHeight(1.1,1.1,60,1.1),0);
});
