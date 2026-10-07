import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createForageArt} from '../assets/forage-art.js';
const items=['carrot','lettuce','pumpkin','orange','truffle','sweetpea','berries','cress','watermelon','strawberry','apple','honey','pricklypear','corn','snowmoss','grapes','daikon','chestnut','zucchini','royaljelly'];
const art=createForageArt({THREE});
test('all harvest species have bounded finite geometry at plant scale',()=>{
 let total=0;
 for(const item of items){
  const plant=art.make(item),data=plant.userData.harvestArt;assert.equal(data.item,item);assert(plant.children.length<=3);assert(data.triangles<10000);total+=data.triangles;
  const bounds=new THREE.Box3().setFromObject(plant),size=bounds.getSize(new THREE.Vector3());
  assert(bounds.min.y>=-.18&&bounds.max.y<1.6,item+' ground/height');assert(size.x<1&&size.z<1,item+' footprint');
  plant.traverse(o=>{if(!o.isMesh)return;assert(o.castShadow&&o.receiveShadow);
   for(const a of Object.values(o.geometry.attributes))assert(Array.from(a.array).every(Number.isFinite),item+' finite attribute');
   const n=o.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.95,item+' valid normals');
  });
 }
 assert(total<55000,'shared plant-template geometry stays bounded');console.log({species:items.length,templateTriangles:total});
});
test('pickup clones share GPU assets and keep independent visibility and transforms',()=>{
 const a=art.make('strawberry'),b=art.make('strawberry');assert.notEqual(a,b);assert.equal(a.children[0].geometry,b.children[0].geometry);assert.equal(a.children[0].material,b.children[0].material);
 a.visible=false;a.position.set(100,20,40);assert(b.visible);assert.deepEqual(b.position.toArray(),[0,0,0]);assert.equal(b.userData.harvestArt.leaves,44);
 assert.throws(()=>art.make('missing'),/Unknown harvest model/);
});
