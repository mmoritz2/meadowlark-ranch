import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NORTH_VALLEY_BOUNDS,northValleyRelief} from '../assets/north-valley-relief.mjs';
import {ALPINE_BOUNDS,fallsRelief} from '../assets/falls-landscape.js';
import {pastureRise} from '../assets/pastoral-fields.mjs';

const creekX=z=>118+Math.sin(z*.03)*14+Math.sin(z*.011+3)*8;
const eps=1e-10;

test('relief is finite, nonnegative and compact, retaining the original foreground and world seam',()=>{
 const b=NORTH_VALLEY_BOUNDS;let changed=0,max=0;
 for(let z=-510;z<=-320;z+=1.1)for(let x=-155;x<=105;x+=1.3){
  const h=northValleyRelief(x,z);assert(Number.isFinite(h)&&h>=0&&h<=9+eps);
  if(x<=b.minX||x>=b.maxX||z<=b.minZ||z>=b.maxZ)assert.equal(h,0);
  if(h>eps){changed++;max=Math.max(max,h);}
 }
 assert(changed>10000&&max>8.8,'both shoulders must remain a real landform');
 for(let t=0;t<=1;t+=.017){
  const x=b.minX+(b.maxX-b.minX)*t,z=b.minZ+(b.maxZ-b.minZ)*t;
  for(const [px,pz,dx,dz] of [[b.minX,z,1,0],[b.maxX,z,-1,0],[x,b.minZ,0,1],[x,b.maxZ,0,-1]]){
   assert.equal(northValleyRelief(px,pz),0);
   assert(northValleyRelief(px+dx*.001,pz+dz*.001)<1e-6,'no cliff at support edge');
  }
 }
});

test('existing alpine relief and a twelve-metre approach apron remain exact',()=>{
 const b=ALPINE_BOUNDS,offsets=[[0,0],[12,0],[-12,0],[0,12],[0,-12],[8.48,8.48],[-8.48,8.48],[8.48,-8.48],[-8.48,-8.48]];
 let protectedPoints=0;
 for(let z=b.z0;z<=b.z1;z+=2)for(let x=b.x0;x<=b.x1;x+=2){
  if(fallsRelief(x,z)<=.0001)continue;
  for(const [dx,dz] of offsets){assert.equal(northValleyRelief(x+dx,z+dz),0);protectedPoints++;}
 }
 assert(protectedPoints>20000);
});

test('the real winding creek retains a twenty-metre protection corridor',()=>{
 for(let z=-505;z<=-320;z+=.37)for(const dx of[-20,-14,-5,0,5,14,20])
  assert.equal(northValleyRelief(creekX(z)+dx,z),0);
});

test('sampled gradients and emitted-grid relief slopes exclude narrow terrain trenches',()=>{
 const b=NORTH_VALLEY_BOUNDS,d=.05;let maxGradient=0;
 for(let z=b.minZ;z<=b.maxZ;z+=.5)for(let x=b.minX;x<=b.maxX;x+=.5){
  const gx=(northValleyRelief(x+d,z)-northValleyRelief(x-d,z))/(2*d);
  const gz=(northValleyRelief(x,z+d)-northValleyRelief(x,z-d))/(2*d);
  maxGradient=Math.max(maxGradient,Math.hypot(gx,gz));
 }
 assert(maxGradient<.65,`steep analytic relief gradient: ${maxGradient}`);
 const step=1000/512;let maxTriangle=0;
 for(let iz=0;iz<512;iz++){const z=iz*step-500;if(z<b.minZ-step||z>b.maxZ)continue;
  for(let ix=0;ix<512;ix++){const x=ix*step-500;if(x<b.minX-step||x>b.maxX)continue;
   const h=[[x,z],[x+step,z],[x,z+step],[x+step,z+step]].map(p=>Math.fround(northValleyRelief(...p)));
   maxTriangle=Math.max(maxTriangle,Math.hypot(h[1]-h[0],h[2]-h[0])/step,Math.hypot(h[2]-h[3],h[1]-h[3])/step);
  }
 }
 assert(maxTriangle<.65,`steep triangulated relief gradient: ${maxTriangle}`);
});

test('pasture terrain includes exactly this relief and retains all heights outside its support',async()=>{
 const url=new URL('../assets/pastoral-fields.mjs',import.meta.url);
 // Remove only this feature from the current terrain owner. No old fixture,
 // frozen HTML hash or copy of the other field implementation is required.
 let source=readFileSync(url,'utf8');
 const importLine=/import\s+\{northValleyRelief\}\s+from\s+['"]\.\/north-valley-relief\.mjs(?:\?[^'"]*)?['"];?/;
 assert(importLine.test(source),'terrain owner must explicitly import the relief');
 source=source.replace(importLine,'const northValleyRelief=()=>0;');
 source=source.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,(_,a,p,b)=>a+new URL(p,url).href+b);
 const without=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let local=0,unchanged=0;
 for(let z=-520;z<=520;z+=7.7)for(let x=-520;x<=520;x+=7.3){
  const h=northValleyRelief(x,z),before=without.pastureRise(x,z),after=pastureRise(x,z);
  assert(Math.abs(after-before-h)<eps);
  if(h===0){assert.equal(after,before);unchanged++;}else local++;
 }
 assert(local>250&&unchanged>18000);
});
