import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../assets/vendor/three/build/three.module.js';
import {pastureRise,FIELD_RISES,FIELD_ANCHORS,meadowBloomAt,MEADOW_OPENINGS,meadowOpeningAt,inMeadowOpening,FLOWER_DRIFTS,meadowGrazingAt,westMeadowSwardAt,cloverApproachRelief} from '../assets/pastoral-fields.mjs';
import {createGrassTuftGeometry,createLupinGeometry,meadowGrowthAt,meadowBladeColor} from '../assets/meadow-cover.js';
import {coyoteCoverDryWeight} from '../assets/biome-weights.mjs';
import {cottonwoodReserved} from '../assets/cottonwood-layout.js';
import {readFileSync} from 'node:fs';
import {LEGACY_FIELDS_SOURCE} from './fixtures/west-meadow-baseline.mjs';
const legacy=await import('data:text/javascript;base64,'+Buffer.from(LEGACY_FIELDS_SOURCE).toString('base64'));


test('field earthworks preserve all protected building and arena footprints',()=>{
 // The old village circle protected unused field south of actual foundations.
 // Clover now shapes that field; every other authored anchor still stays flat.
 for(const [x,z,r] of FIELD_ANCHORS.filter(([x,z])=>x!==47||z!==-50))for(let a=0;a<Math.PI*2;a+=.2)for(const f of[0,.25,.5,.99])
  assert.equal(pastureRise(x+Math.cos(a)*r*f,z+Math.sin(a)*r*f),0);
 for(const [x,z] of[[-490,0],[0,-490],[490,490],[-220,130],[-160,-210]])assert.equal(pastureRise(x,z),0);
 for(let x=18;x<=90;x+=.5)for(let z=-84;z<=-21;z+=.5)if(cottonwoodReserved(x,z,4))assert.equal(pastureRise(x,z),0,'actual town footing '+[x,z]);
 assert(FIELD_RISES.slice(0,4).every(c=>pastureRise(c.x,c.z)>9));
});
test('Clover relief is compact, finite and joins continuously to unchanged far fields',()=>{
 let positive=0;
 for(let x=-480;x<=480;x+=2.5)for(let z=-480;z<=480;z+=2.5){
  const h=cloverApproachRelief(x,z);assert(Number.isFinite(h)&&h>=0&&h<=3.3);
  if(x<=38||x>=104||z<=-137||z>=-83){assert.equal(h,0);assert.equal(pastureRise(x,z),legacy.pastureRise(x,z));}
  if(h>.1)positive++;
 }
 assert(positive>60,'broad connected field support');
 assert(cloverApproachRelief(57,-105)>3);assert(cloverApproachRelief(76,-98)>2);
 const h=.02;
 for(const [axis,edge,lo,hi]of [['x',38,-137,-83],['x',104,-137,-83],['z',-137,38,104],['z',-83,38,104]])for(let t=lo;t<=hi;t+=1){
  const at=n=>axis==='x'?cloverApproachRelief(n,t):cloverApproachRelief(t,n);
  assert.equal(at(edge),0);assert(Math.abs((at(edge+h)-at(edge-h))/(2*h))<1e-5);
  assert(Math.abs((at(edge+h)-2*at(edge)+at(edge-h))/(h*h))<.001);
 }
});
test('Clover preserves the actual Grand Loop hoof corridor including terrain-cell interpolation',()=>{
 const html=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
 const match=html.match(/const RACE_ROUTES=(\{[\s\S]*?\n\});/);assert(match,'actual route definition');
 const route=new Function('return ('+match[1]+').r1;')();assert(route.length>5);
 const step=1000/512,halo=Math.SQRT2*step;
 const deltaAt=(x,z)=>{
  const u=(x+500)/step,v=(z+500)/step,ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz;
  const sample=(dx,dz)=>Math.fround(cloverApproachRelief(-500+(ix+dx)*step,-500+(iz+dz)*step));
  return fx+fz<=1?sample(0,0)*(1-fx-fz)+sample(1,0)*fx+sample(0,1)*fz:sample(1,1)*(fx+fz-1)+sample(1,0)*(1-fz)+sample(0,1)*(1-fx);
 };
 let probes=0;
 for(let i=0;i<route.length;i++){
  const a=route[i],b=route[(i+1)%route.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  for(let d=0;d<=length;d+=1.5)for(const off of [-4,0,4]){
   const x=a[0]+dx*d/length+nx*off,z=a[1]+dz*d/length+nz*off;
   assert.equal(deltaAt(x,z),0,'canonical hoof corridor '+[x,z]);probes++;
  }
 }
 assert(probes>1000);assert(6.8>=4+halo,'protection includes a whole diagonal terrain cell');
});
test('new rises have bounded continuous slopes and no raised edge seams',()=>{
 for(let x=-100;x<340;x+=3)for(let z=-220;z<310;z+=3){
  const y=pastureRise(x,z),dx=(pastureRise(x+.05,z)-pastureRise(x-.05,z))/.1,dz=(pastureRise(x,z+.05)-pastureRise(x,z-.05))/.1;
  assert(Number.isFinite(y)&&y>=0&&y<=15);assert(Math.hypot(dx,dz)<.52);
 }
 for(const c of FIELD_RISES)for(let a=0;a<6.28;a+=.2){
  const u=Math.cos(a)*c.rx,v=Math.sin(a)*c.rz,co=Math.cos(c.yaw||0),si=Math.sin(c.yaw||0);
  const x=c.x+u*co-v*si,z=c.z+u*si+v*co;
  assert(Math.abs(pastureRise(x+.001,z)-pastureRise(x-.001,z))<.001);
 }
});
test('flower colonies fill wild margins, retreat from managed pasture, and remain continuous',()=>{
 // The old fixed point is now grazed pasture; use actual planted colony centers
 // to exercise both flowering margins and maintained field interiors.
 let wild=0,managed=0;
 for(const [x,z]of FLOWER_DRIFTS){
  const grazing=meadowGrazingAt(x,z),bloom=meadowBloomAt(x,z);
  assert(bloom>0&&bloom<=1,'each authored colony retains some flowering');
  if(grazing<.1){assert(bloom>.9,'wild colony centers retain dense flowers');wild++;}
  if(grazing>.9){assert(bloom<.15,'grazed colony centers retain sparse flowers');managed++;}
 }
 assert(wild>=3&&managed>=3,'fixture exercises wild margins and managed colonies');
 assert.equal(meadowGrazingAt(-52,44),1);assert(meadowBloomAt(-52,44)<.05);
 assert.equal(meadowBloomAt(0,0),0);
 for(let x=-100;x<300;x+=6)for(let z=-220;z<300;z+=6){
  const value=meadowBloomAt(x,z);assert(value>=0&&value<=1);assert.equal(value,meadowBloomAt(x,z));
  assert(Math.abs(meadowBloomAt(x-.001,z)-meadowBloomAt(x+.001,z))<.002);
 }
});
test('grass and fully modelled flowers stay inside geometry budgets with valid normals',()=>{
 // Rounded cups retain27 florets; the reviewed per-stalk budget is200 triangles.
 for(const [make,max] of[[createGrassTuftGeometry,48],[createLupinGeometry,200]]){
  const g=make(T);assert(g.index.count/3<=max);assert(g.boundingBox?.max.y<1||make===createGrassTuftGeometry);
  for(const name of['position','normal','color'])assert([...g.attributes[name].array].every(Number.isFinite));
  const n=g.attributes.normal;for(let i=0;i<n.count;i++)assert(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.8);
  g.dispose();
 }
});

test('pasture openings have soft irregular boundaries and leave distant woodland intact',()=>{
 for(const c of MEADOW_OPENINGS){assert(inMeadowOpening(c.x,c.z));assert(meadowOpeningAt(c.x,c.z)>.99);}
 for(const [x,z]of [[0,0],[-71,-10],[-160,-210],[-300,-320],[300,-300],[310,300],[-220,130]])assert.equal(meadowOpeningAt(x,z),0);
 for(let x=-50;x<310;x+=3)for(let z=-210;z<300;z+=3){
  const m=meadowOpeningAt(x,z);assert(m>=0&&m<=1);
  assert(Math.abs(meadowOpeningAt(x+.001,z)-meadowOpeningAt(x-.001,z))<.001);
 }
});


test('grass patches are stable, bounded and continuous at travelling cell boundaries',()=>{
 const color=new T.Color(),values=[];let managed=0,wild=0,dry=0;
 for(let x=-350;x<=350;x+=6)for(let z=-350;z<=350;z+=6){
  const h=meadowGrowthAt(x,z),grazed=meadowGrazingAt(x,z),arid=coyoteCoverDryWeight(x,z);
  values.push(h);assert(Number.isFinite(h)&&h>=.23*.62&&h<=1.37);assert.equal(h,meadowGrowthAt(x,z));
  if(grazed>.95&&westMeadowSwardAt(x,z)===0){assert(h<.61,'maintained pasture outside the recovered west sward stays low');managed++;}
  if(grazed<.001&&arid===0){assert(h>=.42,'ungrazed green margins retain long growth');wild++;}
  if(arid>.95){assert(h<=1.37*.64,'dry basin growth remains below lush pasture height');dry++;}
  assert(Math.abs(meadowGrowthAt(x+.001,z)-meadowGrowthAt(x-.001,z))<.001);
  assert(Math.abs(meadowGrowthAt(x,z+.001)-meadowGrowthAt(x,z-.001))<.001);
  meadowBladeColor(color,x,z,.5);assert(color.toArray().every(n=>Number.isFinite(n)&&n>=0&&n<=1));
 }
 assert(managed>20&&wild>100&&dry>100,'fixture covers grazed pasture, wild margins and dry ground');
 assert(Math.max(...values)-Math.min(...values)>.6);
});
