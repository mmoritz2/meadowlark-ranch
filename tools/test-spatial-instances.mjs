import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {partitionStaticInstances} from '../assets/spatial-instances.js';

function fixture(){
 const geo=new THREE.BoxGeometry(22,9,17),mat=new THREE.MeshStandardMaterial();
 const source=new THREE.InstancedMesh(geo,mat,7),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
 source.name='foliage_boundary';source.castShadow=true;source.receiveShadow=true;source.frustumCulled=false;
 source.customDepthMaterial=new THREE.MeshDepthMaterial();source.layers.set(2);source.renderOrder=3;
 source.position.set(13,2,-7);source.rotation.y=.23;source.updateMatrixWorld(true);
 [[-49,0,-20],[-.1,0,-20],[47.8,0,-20],[48.1,0,-20],[96,0,-20],[300,0,40],[400,0,-20]].forEach((xyz,i)=>{
  q.setFromAxisAngle(new THREE.Vector3(0,1,0),i*.7);scale.set(1+i*.15,1,i===6?0:1);
  source.setMatrixAt(i,matrix.compose(new THREE.Vector3(...xyz),q,scale));source.setColorAt(i,new THREE.Color(i/7,.5,.8));
 });
 return source;
}

test('cells retain exact live matrices, colors, transforms and shared materials',()=>{
 const source=fixture();source.count=6;const cells=partitionStaticInstances(THREE,source);
 assert.equal(cells.reduce((n,c)=>n+c.count,0),6);assert.ok(cells.length>1);
 const found=[],a=new THREE.Matrix4(),b=new THREE.Matrix4(),ca=new THREE.Color(),cb=new THREE.Color();
 for(const cell of cells){
  assert.equal(cell.geometry,source.geometry);assert.equal(cell.material,source.material);
  assert.equal(cell.customDepthMaterial,source.customDepthMaterial);assert.equal(cell.layers.mask,source.layers.mask);
  assert.equal(cell.castShadow,true);assert.equal(cell.receiveShadow,true);assert.equal(cell.frustumCulled,true);
  assert.equal(cell.renderOrder,3);cell.updateMatrixWorld(true);assert.deepEqual(cell.matrixWorld.elements,source.matrixWorld.elements);
  for(const [i,original]of cell.userData.sceneryCell.sourceIndices.entries()){
   source.getMatrixAt(original,a);cell.getMatrixAt(i,b);assert.deepEqual(a.elements,b.elements);
   source.getColorAt(original,ca);cell.getColorAt(i,cb);assert.deepEqual(ca,cb);found.push(original);
  }
 }
 assert.deepEqual(found.sort((a,b)=>a-b),[0,1,2,3,4,5]);
});

test('camera and shadow frusta never reject a cell containing a visible edge instance',()=>{
 const source=fixture(),cells=partitionStaticInstances(THREE,source),matrix=new THREE.Matrix4();
 source.geometry.computeBoundingSphere();cells.forEach(c=>c.updateMatrixWorld(true));
 const cameras=[new THREE.PerspectiveCamera(55,1.8,.1,500),new THREE.OrthographicCamera(-24,24,24,-24,.1,600)];
 let visible=0,culled=0;
 for(const camera of cameras)for(let x=-140;x<=340;x+=24){
  camera.position.set(x,25,70);camera.lookAt(x+7,0,-30);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  for(const cell of cells){
   if(!frustum.intersectsObject(cell))culled++;
   for(const original of cell.userData.sceneryCell.sourceIndices){
    source.getMatrixAt(original,matrix);matrix.premultiply(source.matrixWorld);
    const sphere=source.geometry.boundingSphere.clone().applyMatrix4(matrix);
    if(frustum.intersectsSphere(sphere)){visible++;assert.ok(frustum.intersectsObject(cell),'Complete geometry crossing a cell/frustum border must remain visible');}
   }
  }
 }
 assert.ok(visible>50);assert.ok(culled>50,'Offscreen cells can actually be skipped');
});

test('empty batches, hidden batches and invalid static use are handled explicitly',()=>{
 const source=fixture();source.count=0;assert.deepEqual(partitionStaticInstances(THREE,source),[]);
 source.count=1;source.visible=false;assert.equal(partitionStaticInstances(THREE,source)[0].visible,false);
 assert.throws(()=>partitionStaticInstances(THREE,source,{cellSize:0}),RangeError);
 source.morphTexture={};assert.throws(()=>partitionStaticInstances(THREE,source),/Morphing/);
});
