import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.ESTATE_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const modulePath=process.env.ESTATE_ARRIVAL_MASK_MODULE||path.join(root,'assets/ranch-arrival-landscape.mjs');
const T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')));
const {installArrivalCoverMask,arrivalHardscapeAt}=await import(pathToFileURL(modulePath));
const code=fs.readFileSync(modulePath,'utf8');

function sceneFixture(withShelter=true){
  const scene=new T.Scene(),world={};let shelter;
  if(withShelter){shelter=new T.Group();shelter.name='Pasture | run-in shelter';shelter.position.set(-59,3.7,-19);shelter.rotation.y=2.2;shelter.scale.x=1.5;scene.add(shelter);}
  const priorCalls=[];
  const material=label=>{
    const m=new T.MeshStandardMaterial();m.name=label;
    m.onBeforeCompile=function(shader){assert.equal(this,m);priorCalls.push(label);shader.fragmentShader+='\n// chained '+label;};
    m.customProgramCacheKey=function(){assert.equal(this,m);return label+'-prior';};return m;
  };
  const grass=new T.InstancedMesh(new T.PlaneGeometry(.2,.5),material('fine grass'),3);grass.name='fixture seed grass';grass.count=2;
  grass.customDepthMaterial=material('grass depth');grass.customDistanceMaterial=material('grass distance');
  grass.position.set(3,0,-4);grass.rotation.y=.38;grass.scale.set(1.1,1,1.1);
  for(let i=0;i<3;i++){grass.setMatrixAt(i,new T.Matrix4().makeTranslation(i*4,0,i*2));grass.setColorAt(i,new T.Color(.3+i*.1,.5,.2));}
  scene.add(grass);world.seedGrass=grass;
  const nonInstanced=new T.Mesh(new T.PlaneGeometry(.2,.4),material('fine static cover'));nonInstanced.name='static fine cover';nonInstanced.userData.fineGroundCover=true;scene.add(nonInstanced);
  const tree=new T.Mesh(new T.BoxGeometry(1,5,1),material('tree canopy'));tree.name='Photoscan tree canopy';scene.add(tree);
  return{G:{THREE:T,scene,world},shelter,grass,nonInstanced,tree,priorCalls};
}
function compile(material){const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader,{});return shader;}
const discarded=(world,inverse)=>{const local=world.clone().applyMatrix4(inverse);return Math.abs(local.x)<2&&Math.abs(local.z)<1.625;};

test('one static inverse uses the actual run-in yaw/scale and exactly its 4 x 3.25 m local footprint',()=>{
  const{G,shelter,grass}=sceneFixture(),mask=installArrivalCoverMask(G),shader=compile(grass.material),inverse=shader.uniforms.estateShelterWorldInverse.value;
  assert.equal(mask.pastureShelterFootprint,true);
  const expected=shelter.matrixWorld.clone().invert();assert.deepEqual(inverse.elements,expected.elements);
  for(const x of[-1.999,-1,0,1,1.999])for(const z of[-1.624,-.5,0,.5,1.624])for(const y of[0,1,4])
    assert(discarded(new T.Vector3(x,y,z).applyMatrix4(shelter.matrixWorld),inverse),'root inside original slab '+[x,y,z]);
  for(const x of[-2.001,2.001])for(const z of[-1.62,0,1.62])assert(!discarded(new T.Vector3(x,0,z).applyMatrix4(shelter.matrixWorld),inverse));
  for(const z of[-1.626,1.626])for(const x of[-1.99,0,1.99])assert(!discarded(new T.Vector3(x,0,z).applyMatrix4(shelter.matrixWorld),inverse));
  for(const p of[[0,0,0],[-59,0,-10],[-50,0,-19]])assert(!discarded(new T.Vector3(...p),inverse),'unrelated pasture remains');
  // Six metres in world width follows the preexisting 1.5 X scale.
  const a=new T.Vector3(-2,0,0).applyMatrix4(shelter.matrixWorld),b=new T.Vector3(2,0,0).applyMatrix4(shelter.matrixWorld);assert(Math.abs(a.distanceTo(b)-6)<1e-12);
  mask.dispose();
});

test('current instance root follows refills, retains the existing court GLSL and chains main/depth/distance callbacks',()=>{
  const{G,shelter,grass,nonInstanced,tree,priorCalls}=sceneFixture();
  const meshMaterials=[grass.material,grass.customDepthMaterial,grass.customDistanceMaterial,nonInstanced.material];
  const old=meshMaterials.map(m=>({m,callback:m.onBeforeCompile,key:m.customProgramCacheKey})),treeState={callback:tree.material.onBeforeCompile,key:tree.material.customProgramCacheKey};
  const snapshot={rows:grass.instanceMatrix.array.slice(),colors:grass.instanceColor.array.slice(),count:grass.count,world:Object.keys(G.world),tree:tree.matrix.toArray()};
  const random=Math.random;let calls=0;Math.random=()=>{calls++;return .5;};let mask;
  try{mask=installArrivalCoverMask(G);}finally{Math.random=random;}
  assert.equal(calls,0,'no object, texture or material construction consumes randomness');
  assert.equal(mask.matrixRowsChanged,0);assert.equal(mask.newMaterials,0);assert.equal(mask.newTextures,0);assert.equal(mask.materials,4);
  assert.deepEqual(grass.instanceMatrix.array,snapshot.rows);assert.deepEqual(grass.instanceColor.array,snapshot.colors);assert.equal(grass.count,snapshot.count);assert.deepEqual(Object.keys(G.world),snapshot.world);assert.deepEqual(tree.matrix.toArray(),snapshot.tree);
  assert.equal(tree.material.onBeforeCompile,treeState.callback);assert.equal(tree.material.customProgramCacheKey,treeState.key);
  for(const{m}of old){
    const shader=compile(m);assert(shader.fragmentShader.includes('// chained '+m.name));
    assert(shader.vertexShader.includes('estateCoverRoot=instanceMatrix*estateCoverRoot;'));
    assert(shader.vertexShader.includes('estateShelterWorldInverse*modelMatrix*estateCoverRoot'));
    assert(shader.fragmentShader.includes('if(estateHardscape(vEstateCoverRoot)>.5)discard;'));
    assert(shader.fragmentShader.includes('if(abs(vEstateShelterRoot.x)<2.0&&abs(vEstateShelterRoot.y)<1.625)discard;'));
    assert.equal(Object.keys(shader.uniforms).filter(k=>k==='estateShelterWorldInverse').length,1);
    assert(m.customProgramCacheKey().includes('|pasture-shelter-floor-1'));
  }
  assert.equal(priorCalls.length,4);
  // Evaluate precisely the generated current-root expression after recycling a
  // near-cover instance. No saved row list or startup root enters the shader.
  G.scene.updateMatrixWorld(true);
  const inverse=compile(grass.material).uniforms.estateShelterWorldInverse.value;
  for(const [local,expected]of[[[0,0,0],true],[[2.05,0,0],false],[[.9,0,-1.4],true]]){
    const desiredWorld=new T.Vector3(...local).applyMatrix4(shelter.matrixWorld),instanceLocal=desiredWorld.clone().applyMatrix4(grass.matrixWorld.clone().invert());
    grass.setMatrixAt(0,new T.Matrix4().makeTranslation(...instanceLocal.toArray()));
    const current=new T.Matrix4();grass.getMatrixAt(0,current);const worldRoot=new T.Vector3(0,0,0).applyMatrix4(current).applyMatrix4(grass.matrixWorld);
    assert.equal(discarded(worldRoot,inverse),expected);
  }
  assert(arrivalHardscapeAt(0,25));assert(arrivalHardscapeAt(-16,-26));assert(!arrivalHardscapeAt(-59,-19));
  mask.dispose();mask.dispose();for(const{m,callback,key}of old){assert.equal(m.onBeforeCompile,callback);assert.equal(m.customProgramCacheKey,key);}
  // The existing court function body and CPU helper are untouched by this patch.
  const baselinePath=path.join(root,'assets/ranch-arrival-landscape.mjs'),baseline=fs.readFileSync(baselinePath,'utf8');
  const field=s=>s.slice(s.indexOf('export function arrivalHardscapeAt'),s.indexOf('export function installArrivalCoverMask'));
  assert.equal(field(code),field(baseline));
});

test('a missing pasture shelter preserves the prior cover shader/cache behavior',()=>{
  const{G,grass}=sceneFixture(false),mask=installArrivalCoverMask(G),shader=compile(grass.material);
  assert.equal(mask.pastureShelterFootprint,false);assert.equal(shader.uniforms.estateShelterWorldInverse,undefined);
  assert(!shader.vertexShader.includes('vEstateShelterRoot'));assert(!shader.fragmentShader.includes('vEstateShelterRoot'));
  assert.equal(grass.material.customProgramCacheKey(),'fine grass-prior|estate-hardscape-mask-1');
  assert(shader.fragmentShader.includes('if(estateHardscape(vEstateCoverRoot)>.5)discard;'));mask.dispose();
});
