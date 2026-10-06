import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../assets/vendor/three/build/three.module.js';
import {pastureRise,FIELD_RISES,FIELD_ANCHORS,meadowBloomAt} from '../assets/pastoral-fields.mjs';
import {createGrassTuftGeometry,createLupinGeometry} from '../assets/meadow-cover.js';

test('field earthworks preserve all protected building and arena footprints',()=>{
 for(const [x,z,r] of FIELD_ANCHORS)for(let a=0;a<Math.PI*2;a+=.2)for(const f of[0,.25,.5,.99])
  assert.equal(pastureRise(x+Math.cos(a)*r*f,z+Math.sin(a)*r*f),0);
 for(const [x,z] of[[-490,0],[0,-490],[490,490],[-220,130],[-160,-210]])assert.equal(pastureRise(x,z),0);
 assert(FIELD_RISES.every(c=>pastureRise(c.x,c.z)>6));
});
test('new rises have bounded continuous slopes and no raised edge seams',()=>{
 for(let x=-100;x<340;x+=3)for(let z=-220;z<310;z+=3){
  const y=pastureRise(x,z),dx=(pastureRise(x+.05,z)-pastureRise(x-.05,z))/.1,dz=(pastureRise(x,z+.05)-pastureRise(x,z-.05))/.1;
  assert(Number.isFinite(y)&&y>=0&&y<=11);assert(Math.hypot(dx,dz)<.49);
 }
 for(const c of FIELD_RISES)for(let a=0;a<6.28;a+=.2){
  const x=c.x+Math.cos(a)*c.rx,z=c.z+Math.sin(a)*c.rz;
  assert(Math.abs(pastureRise(x+.001,z)-pastureRise(x-.001,z))<.001);
 }
});
test('flower colonies are deterministic and continuous across grass-cell boundaries',()=>{
 assert(meadowBloomAt(-52,44)>.9);assert.equal(meadowBloomAt(0,0),0);
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
