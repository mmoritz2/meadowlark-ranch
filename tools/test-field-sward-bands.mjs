import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {FIELD_SWARD_BANDS,FIELD_SWARD_RECOVERY,FIELD_SWARD_HEIGHT_BOOST,fieldSwardAt} from '../assets/field-sward-bands.mjs';
import * as fields from '../assets/pastoral-fields.mjs';
import * as cover from '../assets/meadow-cover.js';
import {coyoteCoverDryWeight} from '../assets/biome-weights.mjs';

// A scoped counterfactual removes only the new field-band dependency. It keeps
// the current production noise, flower policy, geometry and LOD controller,
// so unrelated accepted improvements do not invalidate these contracts.
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
function resolved(source,url){return source.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,(_,a,p,b)=>a+new URL(p,url).href+b);}
const fieldsURL=new URL('../assets/pastoral-fields.mjs',import.meta.url),coverURL=new URL('../assets/meadow-cover.js',import.meta.url);
const noBand="const fieldSwardAt=()=>({cover:0,seed:0}),FIELD_SWARD_RECOVERY=.92,FIELD_SWARD_HEIGHT_BOOST=.22;";
const replaceBand=source=>source.replace(/import\s+\{[^}]+\}\s+from\s+'\.\/field-sward-bands\.mjs\?[^']+';/,noBand);
const oldFieldsURL=data(resolved(replaceBand(readFileSync(fieldsURL,'utf8')),fieldsURL));
const oldFields=await import(oldFieldsURL);
const oldCover=await import(data(resolved(replaceBand(readFileSync(coverURL,'utf8')).replace(/'\.\/pastoral-fields\.mjs\?[^']*'/,JSON.stringify(oldFieldsURL)),coverURL)));
const palette=(fn,x,z,v=.5)=>{const c={setHSL(...hsl){this.hsl=hsl;return this;}};assert.equal(fn(c,x,z,v),c);return c.hsl;};
const byteEqual=(a,b)=>assert.deepEqual(Buffer.from(a.buffer,a.byteOffset,a.byteLength),Buffer.from(b.buffer,b.byteOffset,b.byteLength));
// Test each compact ribbon in isolation with the actual production kernel.
// Overlapping authored bands may intentionally cover another band's open end.
const bandSource=readFileSync(new URL('../assets/field-sward-bands.mjs',import.meta.url),'utf8');
const isolatedBands=new Map(await Promise.all(FIELD_SWARD_BANDS.map(async band=>{
 const source=bandSource.replace(/const authored=\[[\s\S]*?\n\];/,()=> 'const authored='+JSON.stringify([[band.id,band.nodes]])+';');
 assert.notEqual(source,bandSource,'one authored input declaration');
 return [band.id,(await import(data(source))).fieldSwardAt];
})));


test('original field ribbons have finite immutable compact support and leave grazed centers open',()=>{
 assert.equal(FIELD_SWARD_BANDS.length,7);assert(Object.isFrozen(FIELD_SWARD_BANDS));
 assert.equal(FIELD_SWARD_RECOVERY,.92);assert.equal(FIELD_SWARD_HEIGHT_BOOST,.22);
 for(const b of FIELD_SWARD_BANDS){
  assert(Object.isFrozen(b)&&Object.isFrozen(b.nodes)&&Object.isFrozen(b.bounds));assert(b.length>24&&b.length<120);
  const {minX,maxX,minZ,maxZ}=b.bounds;
  for(const n of b.nodes){assert(Object.isFrozen(n));assert(n.every(Number.isFinite));assert(n[2]>=2&&n[2]<=9);assert(n[3]>=0&&n[3]<=1);}
  for(let t=0;t<=1;t+=.05)for(const p of [[minX,minZ+(maxZ-minZ)*t],[maxX,minZ+(maxZ-minZ)*t],[minX+(maxX-minX)*t,minZ],[minX+(maxX-minX)*t,maxZ]])assert.deepEqual(isolatedBands.get(b.id)(...p),{cover:0,seed:0});
 }
 for(const c of fields.MEADOW_OPENINGS){assert.equal(fieldSwardAt(c.x,c.z).cover,0);assert.equal(cover.meadowGrowthAt(c.x,c.z),oldCover.meadowGrowthAt(c.x,c.z));}
 // The new shoulders frame a real eight-metre grazing lane; neither flank
 // raises the grass in front of the saddle or across the old Clover center.
 for(let x=84;x<=92;x+=.5)for(let z=-140;z>=-169;z-=.5)assert.equal(fieldSwardAt(x,z).cover,0,'open Clover riding lane '+[x,z]);
 for(const p of [[0,0],[-54,43],[70,-50],[-220,130],[-160,-210],[490,490]])assert.deepEqual(fieldSwardAt(...p),{cover:0,seed:0});
});

test('each ribbon is connected along its authored spine and tapers through open ends',()=>{
 for(const b of FIELD_SWARD_BANDS){
  const at=isolatedBands.get(b.id);
  assert.equal(at(...b.nodes[0]).cover,0);assert.equal(at(...b.nodes.at(-1)).cover,0);
  let gold=0,green=0;
  for(const s of b.segments)for(let d=.25;d<s.span;d+=.25){
   const t=d/s.span,x=s.a[0]+s.dx*t,z=s.a[1]+s.dz*t,along=s.start+d,m=at(x,z);
   assert(m.cover>0,'connected uncut margin '+b.id);assert(m.seed>=0&&m.seed<=m.cover);
   if(along>9&&along<b.length-9)assert(m.cover>.99,'fuller connected heart '+b.id);
   if(m.seed/m.cover>.85)gold++;if(m.seed/m.cover<.6)green++;
  }
  assert(gold>(b.length>40?20:8)&&green>(b.length>40?10:6),'connected ripening gradient rather than one uniform tint');
 }
 for(let x=-20;x<=280;x+=1.47)for(let z=-290;z<=250;z+=1.83){
  const m=fieldSwardAt(x,z);assert(Number.isFinite(m.cover)&&Number.isFinite(m.seed));assert(m.cover>=0&&m.cover<=1&&m.seed>=0&&m.seed<=m.cover);
  assert(Math.abs(fieldSwardAt(x+.001,z).cover-fieldSwardAt(x-.001,z).cover)<.002);
  assert(Math.abs(fieldSwardAt(x,z+.001).seed-fieldSwardAt(x,z-.001).seed)<.002);
 }
});

test('growth and palette change only inside band support while physical and flower fields stay exact',()=>{
 let changed=0,unchanged=0;
 for(let x=-480.17;x<=480;x+=3.7)for(let z=-480.31;z<=480;z+=4.1){
  const m=fieldSwardAt(x,z),h=cover.meadowGrowthAt(x,z),old=oldCover.meadowGrowthAt(x,z);
  for(const fn of ['pastureRise','cloverApproachRelief','meadowGrazingAt','meadowOpeningAt','meadowMarginAt','westMeadowSwardAt','meadowBloomAt'])assert.equal(fields[fn](x,z),oldFields[fn](x,z),fn+' independent from uncut ribbons');
  assert(Number.isFinite(h)&&h>=.23*.62&&h<=1.37*1.22);assert(h>=old-1e-15);
  if(m.cover===0){assert.equal(h,old);for(const v of [0,.5,1])assert.deepEqual(palette(cover.meadowBladeColor,x,z,v),palette(oldCover.meadowBladeColor,x,z,v));unchanged++;}
  else {assert.equal(coyoteCoverDryWeight(x,z),0,'authored green pasture does not reinterpret dry ecology');if(h>old+.01)changed++;}
 }
 assert(changed>150&&unchanged>50000,'survey covers new stand interiors and unchanged world');
});

test('seed-bearing hearts are visibly taller and warmer while keeping bounded natural palette',()=>{
 for(const b of FIELD_SWARD_BANDS){
  const [x,z]=b.nodes[2],a=palette(oldCover.meadowBladeColor,x,z),c=palette(cover.meadowBladeColor,x,z);
  assert(cover.meadowGrowthAt(x,z)>oldCover.meadowGrowthAt(x,z)*1.18,'taller seed-bearing heart '+b.id);
  assert(c[0]<a[0]-.025,'warmer seed canopy '+b.id);assert(c[2]>a[2]+.025,'sunlit canopy remains distinguishable '+b.id);
  assert(c[0]>.12&&c[0]<.21&&c[1]>.5&&c[1]<.65&&c[2]>.2&&c[2]<.27);
 }
});

test('actual middle LOD keeps membership, roots, basis and repeated travel in high and low quality',()=>{
 for(const low of [false,true]){
  let quality=low?'low':'high';
  const config={THREE:T,canGrow:(x,z)=>x>15&&z<0&&(Math.floor(x/6)+Math.floor(z/6))%7!==0,heightAt:(x,z)=>2+.006*x-.01*z+.0002*x*z,managedAt:(x,z)=>Math.abs(z+150)<3?.9:0,low,getQuality:()=>quality};
  const a=oldCover.createMeadowDistance({...config,scene:new T.Scene()}),b=cover.createMeadowDistance({...config,scene:new T.Scene()});let changed=0;
  for(const tier of low?['low']:['high','medium','low']){
   quality=tier;a.invalidate();b.invalidate();a.tick(5,70,-151);b.tick(5,70,-151);
   assert.equal(a.mesh.count,b.mesh.count);assert.equal(a.mesh.instanceMatrix.array.length,b.mesh.instanceMatrix.array.length);
   const p=a.mesh.instanceMatrix.array,q=b.mesh.instanceMatrix.array,ca=a.mesh.instanceColor.array,cb=b.mesh.instanceColor.array;
   for(let o=0,i=0;o<p.length;o+=16,i++){
    for(const j of [3,7,11,12,13,14,15])assert.equal(q[o+j],p[o+j],'translation/homogeneous basis stays exact');
    const live=Math.hypot(p[o],p[o+1],p[o+2])>0,m=fieldSwardAt(p[o+12],p[o+14]).cover;
    assert.equal(Math.hypot(q[o],q[o+1],q[o+2])>0,live);
    if(!live||m===0)byteEqual(q.subarray(o,o+16),p.subarray(o,o+16));
    if(m===0)byteEqual(cb.subarray(i*3,i*3+3),ca.subarray(i*3,i*3+3));
    if(live&&m>0){
     for(let col=0;col<3;col++){
      const at=o+col*4,pa=Math.hypot(p[at],p[at+1],p[at+2]),qa=Math.hypot(q[at],q[at+1],q[at+2]);assert(qa>=pa-1e-6);
      for(let j=0;j<3;j++)assert(Math.abs(p[at+j]/pa-q[at+j]/qa)<3e-7,'yaw/tilt basis preserved');
     }
     if(Math.abs(q[o+5]-p[o+5])>.03)changed++;
    }
   }
   const pose=p.slice(),newPose=q.slice(),colors=cb.slice();a.tick(6,180,30);b.tick(6,180,30);a.tick(7,70,-151);b.tick(7,70,-151);byteEqual(a.mesh.instanceMatrix.array,pose);byteEqual(b.mesh.instanceMatrix.array,newPose);byteEqual(b.mesh.instanceColor.array,colors);
  }
  assert(changed>50,'controller exercises retained roots inside ribbons');
  for(const f of [a,b]){f.mesh.geometry.dispose();f.mesh.material.dispose();f.mesh.removeFromParent();}
 }
});

test('tuft and flower geometry, material and random ownership remain unchanged by field composition',()=>{
 for(const options of [{profile:'near-folded-v1'},{bladeCount:8,segments:2,profile:'middle-natural-v1'}]){
  const a=cover.createGrassTuftGeometry(T,options),b=oldCover.createGrassTuftGeometry(T,options);byteEqual(a.index.array,b.index.array);
  for(const key of Object.keys(a.attributes)){byteEqual(a.attributes[key].array,b.attributes[key].array);assert([...a.attributes[key].array].every(Number.isFinite));}assert(a.index.count/3<=40);a.dispose();b.dispose();
 }
 const a=cover.createLupinGeometry(T),b=oldCover.createLupinGeometry(T);assert.equal(a.index.count/3,238);byteEqual(a.index.array,b.index.array);for(const key of Object.keys(a.attributes))byteEqual(a.attributes[key].array,b.attributes[key].array);a.dispose();b.dispose();
 const previous=Math.random;try{Math.random=()=>{throw new Error('field composition must not consume generator randomness');};for(const b of FIELD_SWARD_BANDS)for(const [x,z] of b.nodes){fieldSwardAt(x,z);cover.meadowGrowthAt(x,z);palette(cover.meadowBladeColor,x,z);fields.meadowBloomAt(x,z);}}finally{Math.random=previous;}
});
