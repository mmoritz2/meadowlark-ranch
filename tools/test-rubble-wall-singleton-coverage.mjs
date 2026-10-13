import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {installCoursedFieldWalls as install,createCoursedFieldWallGeometry as create} from '../assets/coursed-field-wall.mjs';
const record=(x=0,z=0,yaw=0,rows=[0,1,2,3,4])=>({x,z,tx:Math.cos(yaw),tz:Math.sin(yaw),nx:-Math.sin(yaw),nz:Math.cos(yaw),legacyRows:rows});
const wall=(x1,z1,x2,z2)=>({x1,z1,x2,z2});
function options(records=[record()],walls=[]){
 const scene=new T.Scene(),legacy=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial(),records.length*5+1);
 for(const r of records)for(const i of r.legacyRows)legacy.setMatrixAt(i,new T.Matrix4().makeTranslation(r.x,.5,r.z));
 legacy.setMatrixAt(records.length*5,new T.Matrix4().makeTranslation(90,.5,90));scene.add(legacy);
 return {THREE:{...T,TextureLoader:class{async loadAsync(){return new T.Texture();}}},scene,legacy,records,groundH:()=>0,walls};
}
const original195=()=>Array.from({length:195},(_,i)=>wall(20+i,30,20+i,33));
test('actual rubble singleton gets its exact jumpable source span; all original195 refs, bodies and order remain',async()=>{
 const walls=original195(),refs=walls.slice(),bodies=structuredClone(walls),r=record(77.77848460817359,-122.74421833313178,2.015553883);
 const state=await install(options([r],walls)),added=walls.at(-1);
 assert.equal(walls.length,196);assert(walls.slice(0,195).every((w,i)=>w===refs[i]));assert.deepEqual(walls.slice(0,195),bodies);
 assert.deepEqual(Object.keys(added),['x1','z1','x2','z2']);
 assert.deepEqual(added,wall(r.x-r.tx*.575,r.z-r.tz*.575,r.x+r.tx*.575,r.z+r.tz*.575));
 assert.deepEqual(state.jumpableCoverage,{originalSegmentCount:195,addedSegmentCount:1,activeSegmentCount:1});
 assert.equal(state.mesh.geometry.index.count,1656);assert.equal(state.drawCalls,1);
});
