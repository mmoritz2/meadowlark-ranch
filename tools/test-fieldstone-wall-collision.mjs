import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {installCoursedFieldWalls as install,createCoursedFieldWallGeometry as create} from '../assets/coursed-field-wall.mjs';
import {installCoursedFieldWalls as historicalInstall} from './meadow-relief-wall-historical.mjs';
const record=(x=0,z=0,yaw=0,rows=[0,1,2,3,4])=>({x,z,tx:Math.cos(yaw),tz:Math.sin(yaw),nx:-Math.sin(yaw),nz:Math.cos(yaw),legacyRows:rows});
const wall=(x1,z1,x2,z2)=>({x1,z1,x2,z2});
function options(records=[record()],walls=[]){
 const scene=new T.Scene(),legacy=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial(),records.length*5+1);
 for(const r of records)for(const i of r.legacyRows)legacy.setMatrixAt(i,new T.Matrix4().makeTranslation(r.x,.5,r.z));
 legacy.setMatrixAt(records.length*5,new T.Matrix4().makeTranslation(90,.5,90));scene.add(legacy);
 return {THREE:{...T,TextureLoader:class{async loadAsync(){return new T.Texture();}}},scene,legacy,records,groundH:()=>0,walls};
}
const original195=()=>Array.from({length:195},(_,i)=>wall(20+i,30,20+i,33));
test('Historical b1 slab: a singleton gap gets its exact jumpable source span; all original195 refs, bodies and order remain',async()=>{
 const install=historicalInstall;
 const walls=original195(),refs=walls.slice(),bodies=structuredClone(walls),r=record(77.77848460817359,-122.74421833313178,2.015553883);
 const state=await install(options([r],walls)),added=walls.at(-1);
 assert.equal(walls.length,196);assert(walls.slice(0,195).every((w,i)=>w===refs[i]));assert.deepEqual(walls.slice(0,195),bodies);
 assert.deepEqual(Object.keys(added),['x1','z1','x2','z2']);
 assert.deepEqual(added,wall(r.x-r.tx*.575,r.z-r.tz*.575,r.x+r.tx*.575,r.z+r.tz*.575));
 assert.deepEqual(state.jumpableCoverage,{originalSegmentCount:195,addedSegmentCount:1,activeSegmentCount:1});
 assert.equal(state.mesh.geometry.index.count,840);assert.equal(state.drawCalls,1);
});
test('exact continuous capsule union skips covered old lines and detects curved or endpoint holes',async()=>{
 const cases=[
  {name:'same old line',walls:[wall(-1,0,1,0)],added:0},
  {name:'within five centimetres',walls:[wall(-1,.049,1,.049)],added:0},
  {name:'endpoint disks close short existing end margins',walls:[wall(-.54,0,.54,0)],added:0},
  {name:'two old halves continuously cover',walls:[wall(-1,0,0,0),wall(0,0,1,0)],added:0},
  {name:'capsule endpoint union covers a short join',walls:[wall(-1,0,-.04,0),wall(.04,0,1,0)],added:0},
  {name:'curved centre departs from old chord',walls:[wall(-1,.372,1,.372)],added:1},
  {name:'covered centre but missing endpoints',walls:[wall(-.2,0,.2,0)],added:1},
  {name:'covered endpoints but missing interior',walls:[wall(-1,0,-.20,0),wall(.20,0,1,0)],added:1},
  {name:'crossing old line covers only a small interior interval',walls:[wall(0,-2,0,2)],added:1},
  {name:'near threshold outside body',walls:[wall(-1,.051,1,.051)],added:1},
  {name:'zero length old entries do not claim coverage',walls:[wall(0,0,0,0)],added:1},
 ];
 for(const c of cases){const original=c.walls.slice(),state=await install(options([record()],c.walls));assert.equal(state.jumpableCoverage.addedSegmentCount,c.added,c.name);assert.equal(c.walls.length,original.length+c.added,c.name);assert(c.walls.slice(0,original.length).every((w,i)=>w===original[i]));}
 // A narrow uncovered interval between quarter samples defeats sparse probing.
 const walls=[wall(-1,0,.11,0),wall(.23,0,1,0)],state=await install(options([record()],walls));
 assert.equal(state.jumpableCoverage.addedSegmentCount,1,'A twenty-millimetre continuous coverage hole requires a supplement');
});
test('arbitrary rotated capsule coverage is rigid-transform invariant without source or geometry changes',async()=>{
 for(const yaw of [0,.317,1.6,-2.7]){
  const r=record(65,-128,yaw),to=(along,normal)=>[r.x+r.tx*along+r.nx*normal,r.z+r.tz*along+r.nz*normal];
  for(const offset of [.03,.07]){const walls=[wall(...to(-1,offset),...to(1,offset))],state=await install(options([r],walls));assert.equal(state.jumpableCoverage.addedSegmentCount,offset<.05?0:1);}
  const plain=create([r],()=>0),withOptions=create([r],()=>0);assert.deepEqual(plain,withOptions);
 }
});
test('neighbor ownership uses only original snapshot and removes only the newly cleared unit identity',async()=>{
 const walls=original195(),refs=walls.slice(),records=[record(),record(0,0,0,[5,6,7,8,9])],o=options(records,walls),state=await install(o);
 assert.equal(state.jumpableCoverage.addedSegmentCount,2,'A coincident neighbor cannot borrow another new unit barrier');
 const first=walls[195],second=walls[196];state.beforeCourseClear();o.legacy.setMatrixAt(2,new T.Matrix4().makeScale(0,0,0));state.afterCourseClear();
 assert.equal(state.units[0].visible,false);assert.equal(state.units[1].visible,true);assert(!walls.includes(first));assert(walls.includes(second));assert.equal(walls.length,196);
 assert.deepEqual(state.jumpableCoverage,{originalSegmentCount:195,addedSegmentCount:2,activeSegmentCount:1});assert(walls.slice(0,195).every((w,i)=>w===refs[i]));
 state.beforeCourseClear();state.afterCourseClear();assert(!walls.includes(first),'No barrier or unit regrows after a later clear');assert(walls.includes(second));
 // Removing a supplementary ref elsewhere cannot splice an unrelated object.
 walls.splice(walls.indexOf(second),1);state.beforeCourseClear();o.legacy.setMatrixAt(7,new T.Matrix4().makeScale(0,0,0));state.afterCourseClear();assert.equal(walls.length,195);assert(walls.every((w,i)=>w===refs[i]));
});
test('real future course clearing removes owned barriers along with the entire visible replacement',async()=>{
 const o=options([record()],original195()),refs=o.walls.slice(),state=await install(o),owned=o.walls.at(-1);
 const {install:clear}=await import('../assets/features/course-clear.js'),oldWindow=globalThis.window;globalThis.window={};
 try{
  const G={THREE:T,scene:o.scene,tables:{RACE_ROUTES:{test:[[100,100],[110,100]]},EVENTS3:[]},world:{colliders:[],walls:o.walls},worldPaths:{fieldWallArt:state},on(){}};
  clear(G);assert(o.walls.includes(owned));G.tables.RACE_ROUTES.test=[[-8,0],[8,0]];G.courseClear.rebuild();
  assert.equal(state.activeUnitCount,0);assert.equal(state.jumpableCoverage.activeSegmentCount,0);assert(!o.walls.includes(owned));assert(o.walls.every((w,i)=>w===refs[i]));
  G.courseClear.rebuild();assert.equal(o.walls.length,195,'A future course rebuild cannot revive hidden supplementary geometry or barriers');
 }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});
test('texture failure, clearing during load and precleared units leave old jumpable list exactly unchanged',async()=>{
 const o=options([record()],original195()),refs=o.walls.slice(),bodies=structuredClone(o.walls);
 o.THREE={...T,TextureLoader:class{async loadAsync(){throw Error('Missing texture');}}};await assert.rejects(install(o),/Missing texture/);assert.deepEqual(o.walls,bodies);assert(o.walls.every((w,i)=>w===refs[i]));
 for(const clearDuringLoad of [false,true]){
  const o=options([record()],original195()),refs=o.walls.slice(),pending=[];
  o.THREE={...T,TextureLoader:class{loadAsync(){return new Promise(resolve=>pending.push(()=>resolve(new T.Texture())));}}};
  if(!clearDuringLoad)o.legacy.setMatrixAt(2,new T.Matrix4().makeScale(0,0,0));const ready=install(o);
  if(clearDuringLoad)o.legacy.setMatrixAt(2,new T.Matrix4().makeScale(0,0,0));pending.forEach(resolve=>resolve());const state=await ready;
  assert.equal(state.unitCount,0);assert.equal(o.walls.length,195);assert(o.walls.every((w,i)=>w===refs[i]));
 }
});
test('enabling actual missing-wall coverage changes no constructor RNG stream or geometry/material resources',async()=>{
 async function capture(enabled){
  const o=options([record()],original195());if(!enabled)delete o.walls;
  const old=Math.random;let seed=812347,calls=0;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  Math.random=()=>{calls++;return next();};let state;
  try{state=await install(o);}finally{Math.random=old;}
  return {o,state,calls,future:Array.from({length:24},next)};
 }
 const before=await capture(false),after=await capture(true);
 assert.equal(after.state.jumpableCoverage.addedSegmentCount,1);assert.equal(before.state.jumpableCoverage.addedSegmentCount,0);
 assert.equal(after.calls,before.calls);assert.deepEqual(after.future,before.future);
 for(const key of ['position','normal','uv','color'])assert.deepEqual(after.state.mesh.geometry.attributes[key].array,before.state.mesh.geometry.attributes[key].array);
 assert.deepEqual(after.state.mesh.geometry.index.array,before.state.mesh.geometry.index.array);assert.deepEqual(after.o.legacy.instanceMatrix.array,before.o.legacy.instanceMatrix.array);
 assert.equal(after.o.scene.children.length,before.o.scene.children.length);assert.equal(after.state.drawCalls,before.state.drawCalls);
 for(const key of ['color','normalScale'])assert.deepEqual(after.state.mesh.material[key].toArray(),before.state.mesh.material[key].toArray());
 for(const key of ['roughness','envMapIntensity','metalness','vertexColors'])assert.equal(after.state.mesh.material[key],before.state.mesh.material[key]);
 assert(after.state.mesh.material.map&&after.state.mesh.material.normalMap&&after.state.mesh.material.roughnessMap);assert.equal(after.state.mesh.material.aoMap,null);
});
test('the actual current riding controller blocks both ground approaches and retains jump phase/height clearance',async()=>{
 const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
 const start=source.indexOf(' const jumpAir=(RIG.heroJumpAge!==null&&RIG.heroJumpAge<1.25)||(RIG.heroJumpGrace>0);   // from the button'),end=source.indexOf(' const foot=',start);
 assert(start>0&&end>start);const resolve=new Function('THREE','player','RIG','walls',source.slice(start,end));
 const o=options(),state=await install(o);assert.equal(state.jumpableCoverage.addedSegmentCount,1);
 for(const side of [-1,1]){
  const p={pos:{x:0,z:side*2.4},y:0};for(let i=0;i<40;i++){p.pos.z-=side*.14;resolve(T,p,{heroJumpAge:null,heroJumpGrace:0},o.walls);}assert(p.pos.z*side>=.649999,'Original real ground controller cannot walk through the unit');
 }
 for(const [y,rig]of [[0,{heroJumpAge:.7,heroJumpGrace:0}],[0,{heroJumpAge:null,heroJumpGrace:.1}],[.7,{heroJumpAge:null,heroJumpGrace:0}]]){
  const p={pos:{x:0,z:.04},y};resolve(T,p,rig,o.walls);assert.equal(p.pos.z,.04,'Original real jump/height condition still clears low walls');
 }
 const open={pos:{x:2,z:.04},y:0};resolve(T,open,{heroJumpAge:null,heroJumpGrace:0},o.walls);assert.equal(open.pos.z,.04,'No invented connection closes the adjacent open gap');
});
