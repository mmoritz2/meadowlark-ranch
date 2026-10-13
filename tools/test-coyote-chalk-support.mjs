import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture as f} from './coyote-macro-fixture.mjs';
const {site}=JSON.parse(fs.readFileSync(new URL('./fixtures/coyote-macro-8042555/chalk-site.json',import.meta.url)));
const theta=Math.atan2(site.x,site.z),ax=Math.cos(theta),az=-Math.sin(theta),ox=Math.sin(theta),oz=Math.cos(theta);
const frame=(u,v)=>[site.x+ax*u+ox*v,site.z+az*u+oz*v];
const quad=[[-site.len/2,-site.depth/2],[site.len/2,-site.depth/2],[site.len/2,site.depth/2],[-site.len/2,site.depth/2]].map(p=>frame(...p));
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function clip(poly,a,b){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],fp=cross(a,b,p),fq=cross(a,b,q);if(fp>=0)out.push(p);if((fp>=0)!==(fq>=0)){const t=fp/(fp-fq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out;}
const area=poly=>Math.abs(poly.reduce((sum,p,i)=>sum+p[0]*poly[(i+1)%poly.length][1]-p[1]*poly[(i+1)%poly.length][0],0))/2;

test('complete actual accepted Chalk quad has zero overlap with changed terrain triangles and remains clear of new physical contour circles',()=>{
 assert.equal(site.x,-68.98);assert.equal(site.z,213.41);assert.equal(site.sited,true);
 const changed=new Set(f.changed),cells=new Set();for(const id of changed){const ix=id%f.n,iz=Math.floor(id/f.n);for(const [x,z]of [[ix,iz],[ix-1,iz],[ix,iz-1],[ix-1,iz-1]])if(x>=0&&z>=0&&x<f.n-1&&z<f.n-1)cells.add(z*f.n+x);}
 let checked=0,overlap=0,maxArea=0;for(const id of cells){for(const ids of [[id,id+f.n,id+1],[id+1,id+f.n,id+f.n+1]]){
  if(!ids.some(i=>changed.has(i)))continue;let poly=ids.map(i=>[i%f.n*f.step-500,Math.floor(i/f.n)*f.step-500]);for(let k=0;k<4&&poly.length;k++)poly=clip(poly,quad[k],quad[(k+1)%4]);const a=poly.length?area(poly):0;maxArea=Math.max(maxArea,a);if(a>1e-9)overlap++;checked++;
 }}assert(checked>5000);assert.equal(overlap,0,'no changed triangle can influence any point of the original downland rectangle');assert.equal(maxArea,0);
 const {T}=f,scene=new T.Scene(),material=new T.MeshStandardMaterial(),colliders=[],land=f.next.createCanyonLandscape({THREE:T,scene,heightAt:f.height,terrainStep:f.step,material,colliders});let gap=Infinity;
 for(const c of land.barriers){const dx=c.x-site.x,dz=c.z-site.z,u=dx*ax+dz*az,v=dx*ox+dz*oz,d=Math.hypot(Math.max(0,Math.abs(u)-site.len/2),Math.max(0,Math.abs(v)-site.depth/2));gap=Math.min(gap,d-c.r);}
 assert(gap>1.8,'restored downland cannot overlap any new physical terrain contour circle');console.log('ACTUAL_CHALK_COMPLETE_GRID_SUPPORT',JSON.stringify({site,changedTrianglesChecked:checked,positiveAreaIntersections:overlap,maxOverlapArea:maxArea,minPhysicalCircleGap:gap}));
});
