import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {NORTH_PASTURE_BOUNDS,northPastureAt,applyNorthPastureGrazingPixels} from '../assets/north-pasture.mjs';
import * as fields from '../assets/pastoral-fields.mjs';
import * as cover from '../assets/meadow-cover.js';

// Remove only this feature for the comparison. Accepted flowers, field bands,
// climate and grass geometry remain the current production implementations.
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const resolve=(s,u)=>s.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,(_,a,p,b)=>a+new URL(p,u).href+b);
const withoutPasture=s=>s.replace(/import\s+\{northPastureAt\}\s+from\s+'\.\/north-pasture\.mjs\?[^']+';/,'const northPastureAt=()=>({cut:0,uncut:0});');
const fieldsURL=new URL('../assets/pastoral-fields.mjs',import.meta.url),coverURL=new URL('../assets/meadow-cover.js',import.meta.url);
const oldFieldsURL=data(resolve(withoutPasture(readFileSync(fieldsURL,'utf8')),fieldsURL)),oldFields=await import(oldFieldsURL);
const oldCover=await import(data(resolve(withoutPasture(readFileSync(coverURL,'utf8')).replace(/'\.\/pastoral-fields\.mjs\?[^']*'/,JSON.stringify(oldFieldsURL)),coverURL)));
const palette=(f,x,z)=>f({setHSL:(...v)=>v},x,z,.43);

test('an unequal broad opening is bounded, connected and continuous without random scatter',()=>{
 assert.equal(northPastureAt(-7,-304).cut,1);
 assert.deepEqual(northPastureAt(-34,-315),{cut:0,uncut:1});
 assert.deepEqual(northPastureAt(23,-290),{cut:0,uncut:.62});
 const b=NORTH_PASTURE_BOUNDS;
 for(let t=0;t<=1;t+=.05)for(const [x,z] of [[b.minX,b.minZ+(b.maxZ-b.minZ)*t],[b.maxX,b.minZ+(b.maxZ-b.minZ)*t],[b.minX+(b.maxX-b.minX)*t,b.minZ],[b.minX+(b.maxX-b.minX)*t,b.maxZ]])assert.deepEqual(northPastureAt(x,z),{cut:0,uncut:0});
 const random=Math.random;let cut=0,uncut=0;
 try{Math.random=()=>{throw Error('Pasture composition cannot consume ambient RNG');};
  for(let z=-355;z<-230;z+=1.37)for(let x=-55;x<45;x+=1.21){const p=northPastureAt(x,z);assert(p.cut>=0&&p.uncut>=0&&p.cut+p.uncut<=1);if(p.cut>.8)cut++;if(p.uncut>.5)uncut++;for(const [dx,dz] of [[.001,0],[0,.001]]){const q=northPastureAt(x+dx,z+dz);assert(Math.abs(q.cut-p.cut)<.002&&Math.abs(q.uncut-p.uncut)<.002);}}
 }finally{Math.random=random;}
 assert(cut>1000&&uncut>900,'both an open field interior and two retained stands are sampled');
});

test('only local grass response changes; terrain, flowers and all legacy eligibility remain exact',()=>{
 let unchanged=0,shortened=0,raised=0;
 for(let z=-490;z<490;z+=4.13)for(let x=-490;x<490;x+=3.91){
  const p=northPastureAt(x,z),a=oldCover.meadowGrowthAt(x,z),b=cover.meadowGrowthAt(x,z);
  assert(Number.isFinite(b)&&b>0&&b<=1.37*1.22*1.20);
  for(const fn of ['pastureRise','cloverApproachRelief','meadowGrazingAt','meadowOpeningAt','meadowBloomAt'])assert.equal(fields[fn](x,z),oldFields[fn](x,z));
  if(!p.cut&&!p.uncut){assert.equal(a,b);assert.equal(fields.meadowSwardGrazingAt(x,z),oldFields.meadowSwardGrazingAt(x,z));assert.deepEqual(palette(cover.meadowBladeColor,x,z),palette(oldCover.meadowBladeColor,x,z));unchanged++;}
  if(p.cut>.95&&b<a*.65)shortened++;if(p.uncut>.95&&b>a*1.19)raised++;
 }
 assert(unchanged>50000&&shortened>100&&raised>20);
 for(const fn of ['createGrassTuftGeometry','createLupinGeometry','createMeadowDistance'])assert.equal(cover[fn].toString(),oldCover[fn].toString(),'source geometry/placement code exact');
});

test('actual middle LOD retains membership and roots, changing only local positive scale and palette',()=>{
 for(const low of [false,true]){
  const config={THREE:T,low,canGrow:(x,z)=>Math.floor(x/7)%5!==0,heightAt:(x,z)=>2+.01*x-.007*z,managedAt:()=>0};
  const a=oldCover.createMeadowDistance({...config,scene:new T.Scene()}),b=cover.createMeadowDistance({...config,scene:new T.Scene()});
  a.tick(1,0,-275);b.tick(1,0,-275);assert.equal(a.mesh.count,b.mesh.count);assert.equal(a.mesh.geometry.index.count,b.mesh.geometry.index.count);
  const p=a.mesh.instanceMatrix.array,q=b.mesh.instanceMatrix.array,ca=a.mesh.instanceColor.array,cb=b.mesh.instanceColor.array;let affected=0;
  for(let i=0,o=0;o<p.length;i++,o+=16){
   for(const axis of [3,7,11,12,13,14,15])assert.equal(p[o+axis],q[o+axis]);
   const mask=northPastureAt(p[o+12],p[o+14]);
   const live=Math.hypot(p[o],p[o+1],p[o+2])>0;assert.equal(live,Math.hypot(q[o],q[o+1],q[o+2])>0);
   if(!mask.cut&&!mask.uncut){assert.deepEqual(p.subarray(o,o+16),q.subarray(o,o+16));assert.deepEqual(ca.subarray(i*3,i*3+3),cb.subarray(i*3,i*3+3));}
   else if(live){affected++;for(let col=0;col<3;col++){const k=o+col*4,ap=Math.hypot(p[k],p[k+1],p[k+2]),bp=Math.hypot(q[k],q[k+1],q[k+2]);assert(ap>0&&bp>0);for(let n=0;n<3;n++)assert(Math.abs(p[k+n]/ap-q[k+n]/bp)<3e-7);}}
  }
  assert(affected>300);for(const m of [a,b]){m.mesh.geometry.dispose();m.mesh.material.dispose();m.mesh.removeFromParent();}
 }
});

test('the shared grazing mask changes blue only, inside the actual cut opening',()=>{
 const size=256,pixels=new Uint8ClampedArray(size*size*4);for(let i=0;i<pixels.length;i++)pixels[i]=(i*37)%256;
 const original=pixels.slice();assert(applyNorthPastureGrazingPixels(pixels,size)>100);
 for(let i=0;i<pixels.length;i++){
  if(i%4!==2)assert.equal(pixels[i],original[i]);
  else if(pixels[i]!==original[i]){const k=Math.floor(i/4),x=-500+(k%size+.5)*1000/size,z=-500+(Math.floor(k/size)+.5)*1000/size;assert(northPastureAt(x,z).cut>0);assert(pixels[i]>original[i]);}
 }
 assert.equal(applyNorthPastureGrazingPixels(pixels,size),0,'repeated redraw must be idempotent');
});
