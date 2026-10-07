import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createGrassTuftGeometry} from '../assets/meadow-cover.js';
import {createReedGeometry,createReedBeds} from '../assets/reed-beds.js';
function inspect(g){
 for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));
 const p=g.attributes.position,n=g.attributes.normal,A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();
 for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
 for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k));assert.ok(ids.every(k=>k<p.count));A.fromBufferAttribute(p,ids[0]);B.fromBufferAttribute(p,ids[1]);C.fromBufferAttribute(p,ids[2]);assert.ok(B.sub(A).cross(C.sub(A)).length()>1e-8,'non-degenerate triangle');}
 assert.ok(g.boundingBox.min.y>=0&&g.boundingBox.max.y<=1.2);
}
test('curved grass and reeds have finite, normalized, non-degenerate bounded geometry',()=>{
 for(const g of[createGrassTuftGeometry(T),createGrassTuftGeometry(T,{bladeCount:4,segments:2}),createReedGeometry(T)])inspect(g);
 const a=createReedGeometry(T),b=createReedGeometry(T);assert.deepEqual(a.attributes.position.array,b.attributes.position.array);assert.ok(a.index.count/3<=350);
 assert.equal(createGrassTuftGeometry(T).index.count/3,40);
});
function fixture(){
 const scene=new T.Scene(),source=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({transparent:true}),600),m=new T.Matrix4();
 source.position.set(3,0,4);scene.add(source);
 for(let i=0;i<source.count;i++){const angle=i*2.39996,r=Math.sqrt(i)*1.2;source.setMatrixAt(i,m.makeTranslation(Math.sin(angle)*r,0,Math.cos(angle)*r));source.setColorAt(i,new T.Color('#e9e5d0'));}
 source.setMatrixAt(599,new T.Matrix4().makeScale(0,0,0));let tier='high';const player={pos:new T.Vector3(3,0,4)},beds=createReedBeds({THREE:T,scene,sources:[source],player,getQuality:()=>tier});
 return{beds,scene,source,player,tier:q=>tier=q};
}
test('reed batches retain all nonzero world placements, enforce tier budgets and restore on return',()=>{
 const f=fixture(),{beds:b,source:s,player:p}=f;assert.equal(b.records.length,599);assert.equal(s.visible,false);assert.ok(s.userData.replacedGroundReeds);
 const before=Array.from(b.detail.instanceMatrix.array.slice(0,b.detail.count*16));
 for(const [tier,cap]of[['low',80],['medium',180],['high',320]]){f.tier(tier);b.update(.1,1);assert.equal(b.detail.count,cap);assert.ok(!b.far.material.transparent);assert.ok(b.detail.receiveShadow&&b.far.receiveShadow);}
 const m=new T.Matrix4();for(let i=0;i<b.detail.count;i++){b.detail.getMatrixAt(i,m);assert.ok(b.records.some(r=>r.matrix.elements.every((v,k)=>Math.abs(v-m.elements[k])<1e-5)));}
 p.pos.set(500,0,500);b.update(.1,2);assert.equal(b.detail.count,0);assert.equal(b.far.count,0);assert.equal(b.detail.visible,false);
 p.pos.set(3,0,4);b.update(.1,3);assert.deepEqual(Array.from(b.detail.instanceMatrix.array.slice(0,b.detail.count*16)),before);
 b.dispose();assert.equal(s.visible,true);assert.equal(s.userData.replacedGroundReeds,undefined);assert.equal(b.detail.parent,null);
});
test('subthreshold movement does not separate the fade origin from its packed batch',()=>{
 const {beds:b,player:p}=fixture(),shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};b.detail.material.onBeforeCompile(shader,{});const start=shader.uniforms.reedEye.value.clone();
 p.pos.x+=.5;b.update(.1,1);assert.ok(shader.uniforms.reedEye.value.equals(start));assert.equal(shader.uniforms.reedTime.value,1);
 p.pos.x+=.3;b.update(.1,2);assert.equal(shader.uniforms.reedEye.value.x,p.pos.x);b.dispose();
});
