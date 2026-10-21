import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {RANCH_TURF_YARDS,RANCH_TURF_HEIGHT,RANCH_TURF_REACH,ranchTurfAt,ranchTurfHeightAt,ranchTurfReachAt,managedGroundsAt,ranchLandcoverTurfAt} from '../assets/ranch-grounds.mjs';
import {createMeadowDistance,createGrassTuftGeometry,meadowGrowthAt,meadowBladeColor} from '../assets/meadow-cover.js';
import {createMeadowGrazingPixels} from '../assets/meadow-landcover.mjs';
import {meadowGrazingAt} from '../assets/pastoral-fields.mjs';
import {coldPastureCover} from '../assets/cold-woodland.mjs';
import {hollowpeakThawFloorAt,respondHollowpeakThawMatrix,respondHollowpeakThawColor} from '../assets/hollowpeak-thaw-floor.mjs';
import {ranchTurfAt as originalTurfAt,RANCH_TURF_YARDS as originalYards} from './fixtures/ranch-grounds-before-farm.mjs';

test('groundskeeping belongs to inhabited yards and leaves wild fields and landscape landmarks intact',()=>{
 assert.equal(RANCH_TURF_YARDS.length,6);
 for(const[x,z]of [[-10,25],[7,30],[-34,-15],[51,-35.5]]){
  assert.equal(ranchTurfAt(x,z),1);assert(Math.abs(ranchTurfHeightAt(x,z)-RANCH_TURF_HEIGHT)<1e-14);assert(Math.abs(ranchTurfReachAt(x,z)-RANCH_TURF_REACH)<1e-14);
 }
 for(const[x,z]of [[88,-157],[-69,36],[95,-172],[53,231],[172,34],[16,129],[-160,-210],[-330,300],[300,-300]]){
  assert.equal(ranchTurfAt(x,z),0);assert.equal(ranchTurfHeightAt(x,z),1);assert.equal(ranchTurfReachAt(x,z),1);assert.equal(managedGroundsAt(x,z,.274),.274);
 }
});

test('mown lawns taper smoothly into their rough margin without cell or LOD sampling dependence',()=>{
 let partial=0,full=0;
 const random=Math.random;Math.random=()=>{throw Error('Placement RNG consumed');};
 try{
  for(let z=-50;z<55;z+=.7)for(let x=-60;x<70;x+=.7){
   const w=ranchTurfAt(x,z);assert(w>=0&&w<=1);assert.equal(w,ranchTurfAt(x,z));
   assert(Math.abs(w-ranchTurfAt(x+.001,z))<.001);assert(Math.abs(w-ranchTurfAt(x,z+.001))<.001);
   assert.equal(managedGroundsAt(x,z,.4),Math.max(.4,w));if(w>0&&w<1)partial++;if(w===1)full++;
  }
 }finally{Math.random=random;}
 assert(partial>3000);assert(full>3000);
});

test('maintained ground shares the source turf field while sand and remote landcover pixels remain exact',()=>{
 const size=256,data=createMeadowGrazingPixels(size),step=1000/size;
 let changed=0;
 for(let row=0;row<size;row++)for(let column=0;column<size;column++){
  const x=-500+(column+.5)*step,z=-500+(row+.5)*step,i=(row*size+column)*4;
  const legacy=Math.round(meadowGrazingAt(x,z)*255),expected=Math.round(Math.max(meadowGrazingAt(x,z),ranchLandcoverTurfAt(x,z))*255);
  assert.equal(data[i+2],expected);assert.equal(data[i],0);assert.equal(data[i+1],0);assert.equal(data[i+3],255);
  if(expected!==legacy){changed++;assert(ranchTurfAt(x,z)>0);assert(!(Math.abs(x)<25&&Math.abs(z)<20));}
 }
 assert(changed>100);assert.equal(ranchLandcoverTurfAt(0,0),0);
});

test('middle grass preserves deterministic source roots, colour, yaw and counts through quality and recycled cells',()=>{
 let quality='high';const scene=new T.Scene();
 const ground=(x,z)=>.02*x-.01*z;
 const f=createMeadowDistance({THREE:T,scene,canGrow:(x,z)=>!(Math.abs(x)<25&&Math.abs(z)<20),heightAt:ground,managedAt:(x,z)=>managedGroundsAt(x,z,1),getQuality:()=>quality});
 f.tick(0,0,0);const rows=f.mesh.instanceMatrix.array.slice(),colors=f.mesh.instanceColor.array.slice();
 assert.equal(f.mesh.count,18*18*120);
 const maxHeight=f.mesh.geometry.boundingBox.max.y;let maintained=0,wild=0;
 for(let i=0;i<f.mesh.count;i++){
  const at=i*16,x=rows[at+12],z=rows[at+14],scaleY=rows[at+5];
  if(Math.abs(x)<25&&Math.abs(z)<20){assert.equal(scaleY,0);continue;}
  assert(Math.abs(rows[at+13]-(ground(x,z)-.03))<1e-6);
  const w=ranchTurfAt(x,z);if(w===1){maintained++;assert(maxHeight*scaleY<.17);}
  if(w===0)wild++;
 }
 assert(maintained>500);assert(wild>10000);
 for(const q of ['low','medium','high']){quality=q;f.tick(1,0,0);assert.deepEqual(f.mesh.instanceMatrix.array,rows);assert.deepEqual(f.mesh.instanceColor.array,colors);}
 f.tick(2,60,48);f.tick(3,0,0);assert.deepEqual(f.mesh.instanceMatrix.array,rows);assert.deepEqual(f.mesh.instanceColor.array,colors);
 f.mesh.geometry.dispose();f.mesh.material.dispose();f.mesh.removeFromParent();
});

test('actual near-cell producer retains counted grounded roots and authored eligibility while shortening the working turf',()=>{
 const html=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
 const start=html.indexOf('const fillCell=(ci,cj,slot)=>{'),end=html.indexOf('  for(let k=0;k<NG_F;k++){',start);
 assert(start>0&&end>start);
 const source=html.slice(start,end)+'\n };return fillCell;';
 const gh=(ix,iz)=>{let h=(Math.imul(ix|0,374761393)+Math.imul(iz|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
 const cells=Array.from({length:196},()=>({count:0,matrices:new Float32Array(240*16),colors:new Float32Array(240*3)}));
 const geometryMax=1.1682,near={geometry:createGrassTuftGeometry(T,{profile:'near-folded-v1'})};assert(near.geometry.boundingBox.max.y<=geometryMax);
 const make=new Function('NG_CELL','NG_K','grassCells','gh','okGrass','managedGrass','meadowGrowthAt','coldPastureCover','e','q','sc','v','m4','groundH','meadowBladeColor','bcol','winterGrassTint','ranchTurfReachAt','ranchTurfHeightAt','terrainH','hollowpeakThawFloorAt','respondHollowpeakThawMatrix','respondHollowpeakThawColor','near',source);
 const ground=(x,z)=>.02*x-.01*z;
 const fill=make(6,240,cells,gh,(x,z)=>!(Math.abs(x)<25&&Math.abs(z)<20),(x,z)=>managedGroundsAt(x,z,1),meadowGrowthAt,coldPastureCover,new T.Euler(),new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Matrix4(),ground,meadowBladeColor,new T.Color(),new T.Color(),ranchTurfReachAt,ranchTurfHeightAt,ground,hollowpeakThawFloorAt,respondHollowpeakThawMatrix,respondHollowpeakThawColor,near);
 const random=Math.random;Math.random=()=>{throw Error('Near producer consumed RNG');};
 let count=0,short=0;
 try{for(let j=-7;j<7;j++)for(let i=-7;i<7;i++){
  const slot=(i+7)+(j+7)*14;fill(i,j,slot);const c=cells[slot];count+=c.count;
  for(let r=0;r<c.count;r++){
   const at=r*16,x=c.matrices[at+12],z=c.matrices[at+14];assert(!(Math.abs(x)<25&&Math.abs(z)<20));assert(Math.abs(c.matrices[at+13]-(ground(x,z)-.02))<1e-6);
   const sy=Math.hypot(c.matrices[at+4],c.matrices[at+5],c.matrices[at+6]);if(ranchTurfAt(x,z)===1){assert(geometryMax*sy<.19);short++;}
  }
 }}finally{Math.random=random;}
 assert(count>30000);assert(short>12000);
 // Same extracted current producer at the farm, with all of its actual helper dependencies.
 // These isolated eligibility/plane inputs are a component fixture, not live route clearance.
 let farmCount=0,farmShort=0;
 try{Math.random=()=>{throw Error('Farm near producer consumed RNG');};
  for(let j=-7;j<7;j++)for(let i=-7;i<7;i++){
   const slot=(i+7)+(j+7)*14;fill(37+i,-21+j,slot);const c=cells[slot];farmCount+=c.count;
   for(let r=0;r<c.count;r++){
    const at=r*16,x=c.matrices[at+12],z=c.matrices[at+14];
    assert(Math.abs(c.matrices[at+13]-(ground(x,z)-.02))<1e-6);
    if(ranchTurfAt(x,z)===1){const sy=Math.hypot(c.matrices[at+4],c.matrices[at+5],c.matrices[at+6]);assert(geometryMax*sy<.19);farmShort++;}
   }
  }
 }finally{Math.random=random;near.geometry.dispose();}
 assert.equal(farmCount,196*240);assert(farmShort>500);

 assert(html.includes('s*(.78-.40*managedGrass(x,z))*growth*ranchTurfHeightAt(x,z)'));
 assert(html.includes("meadow=gh(ci*3,cj*5)>.62&&managedGrass(x,z)<.58"));
 assert(html.includes("managedGrass(x,z)<.58"));
});


test('farm green and gate approach have compact distinct support and preserve all old yard definitions',()=>{
 assert.deepEqual(RANCH_TURF_YARDS.map(q=>q.id),['arena-lawns','entrance-green','stable-working-yard','cottonwood-cottage-lawns','barleyfold-arrival-green','barleyfold-gate-approach']);
 assert.deepEqual(RANCH_TURF_YARDS.slice(0,4),originalYards);assert(Object.isFrozen(RANCH_TURF_YARDS));assert(RANCH_TURF_YARDS.every(Object.isFrozen));
 for(const[x,z]of[[220,-110],[223,-120],[223,-130],[223,-140],[223,-146]]){
  assert.equal(ranchTurfAt(x,z),1);assert(Math.abs(ranchTurfHeightAt(x,z)-RANCH_TURF_HEIGHT)<1e-14);assert(Math.abs(ranchTurfReachAt(x,z)-RANCH_TURF_REACH)<1e-14);
 }
 for(const p of[[196,-118],[236,-120],[200,-86],[180,-96],[180,-82]])assert.equal(ranchTurfAt(...p),originalTurfAt(...p),'Other farm buildings/gates retain original field');
});

test('farm turf changes stay inside authored support, feather continuously and consume no RNG',()=>{
 const random=Math.random;Math.random=()=>{throw Error('Ground field consumed placement randomness');};let outside=0,changed=0,feather=0;
 try{
  for(let z=-500;z<=500;z+=.75)for(let x=-500;x<=500;x+=.75){
   const a=originalTurfAt(x,z),b=ranchTurfAt(x,z);assert(Number.isFinite(b)&&b>=0&&b<=1);
   if(x<210.5||x>229.5||z< -149||z> -100){assert.equal(b,a);outside++;}
   if(b!==a){changed++;assert(b>a);assert(x>=210.5&&x<=229.5&&z>=-149&&z<=-100);}
   if(b>0&&b<1&&x>200){feather++;assert(Math.abs(b-ranchTurfAt(x+.001,z))<.001);assert(Math.abs(b-ranchTurfAt(x,z+.001))<.001);}
  }
 }finally{Math.random=random;}
 assert.equal(outside,1777906);assert.equal(changed,1218);assert.equal(feather,683);
});
