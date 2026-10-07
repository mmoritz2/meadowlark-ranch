import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../assets/vendor/three/build/three.module.js';
import {pastureRise,FIELD_RISES,FIELD_ANCHORS,meadowBloomAt,MEADOW_OPENINGS,meadowOpeningAt,inMeadowOpening,FLOWER_DRIFTS,meadowGrazingAt} from '../assets/pastoral-fields.mjs';
import {createGrassTuftGeometry,createLupinGeometry,meadowGrowthAt,meadowBladeColor} from '../assets/meadow-cover.js';
import {coyoteCoverDryWeight} from '../assets/biome-weights.mjs';

test('field earthworks preserve all protected building and arena footprints',()=>{
 for(const [x,z,r] of FIELD_ANCHORS)for(let a=0;a<Math.PI*2;a+=.2)for(const f of[0,.25,.5,.99])
  assert.equal(pastureRise(x+Math.cos(a)*r*f,z+Math.sin(a)*r*f),0);
 for(const [x,z] of[[-490,0],[0,-490],[490,490],[-220,130],[-160,-210]])assert.equal(pastureRise(x,z),0);
 assert(FIELD_RISES.slice(0,4).every(c=>pastureRise(c.x,c.z)>9));
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
 for(const [make,max] of[[createGrassTuftGeometry,48],[createLupinGeometry,150]]){
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
  if(grazed>.95){assert(h<.61,'maintained pasture stays low');managed++;}
  if(grazed<.001&&arid===0){assert(h>=.42,'ungrazed green margins retain long growth');wild++;}
  if(arid>.95){assert(h<=1.37*.64,'dry basin growth remains below lush pasture height');dry++;}
  assert(Math.abs(meadowGrowthAt(x+.001,z)-meadowGrowthAt(x-.001,z))<.001);
  assert(Math.abs(meadowGrowthAt(x,z+.001)-meadowGrowthAt(x,z-.001))<.001);
  meadowBladeColor(color,x,z,.5);assert(color.toArray().every(n=>Number.isFinite(n)&&n>=0&&n<=1));
 }
 assert(managed>20&&wild>100&&dry>100,'fixture covers grazed pasture, wild margins and dry ground');
 assert(Math.max(...values)-Math.min(...values)>.6);
});
