import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.ARRIVAL_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const modulePath=process.env.ARRIVAL_MODULE||path.join(root,'assets/arrival-stable.mjs');
const T=await import(pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')));
const {createRanchArchitecture}=await import(pathToFileURL(path.join(root,'assets/ranch-architecture.js')));
// This optional path lets the author exercise the exact staged source before
// root installs it. Only dependency URLs are changed; the source body is raw.
const code=fs.readFileSync(modulePath,'utf8').replace(/from '(\.\/[^']+)'/g,(_,relative)=>
  'from '+JSON.stringify(pathToFileURL(path.join(root,'assets',relative.split('?')[0])).href+((relative.split('?')[1]&&'?'+relative.split('?')[1])||'')));
const {buildArrivalStable}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('original gatehouse stable has a clear deep entry apron, finite PBR geometry, bounded footprint and fixed draw cost',()=>{
  const architecture=createRanchArchitecture({THREE:T,loadTextures:false});
  const originalRandom=Math.random;let draws=0;Math.random=()=>{draws++;return .5;};
  let g;try{g=buildArrivalStable({THREE:T,architecture});}finally{Math.random=originalRandom;}
  assert.equal(draws,0,'visual construction must leave seeded world randomness alone');
  const data=g.userData.arrivalStable;
  assert.equal(data.drawCalls,9);assert.equal(g.children.length,9);
  assert(data.triangles>10000&&data.triangles<60000);
  assert(data.geometryBytes<6000000);assert.equal(data.physicalSlateCourses,4);
  assert.equal(data.ridgeHeight,6.12);
  assert.deepEqual(data.door,{x:0,z:1.65,width:1.9,height:2.66,closedLeaves:true});
  assert.equal(g.userData.solidParts,undefined,'the original root owns the collision parts');
  g.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(g);
  assert(bounds.min.x>=-3.93&&bounds.max.x<=3.93);
  assert(bounds.min.z>=-3.23&&bounds.max.z<=3.23);
  assert(bounds.min.y>=-.001&&bounds.max.y<=6.25);
  for(const mesh of g.children){
    const geo=mesh.geometry;
    for(const[name,a]of Object.entries(geo.attributes))for(const v of a.array)assert(Number.isFinite(v),mesh.name+' '+name);
    for(const i of geo.index.array)assert(i<geo.attributes.position.count);
    const n=geo.attributes.normal;
    for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
    assert.equal(mesh.material.transparent,false);assert(mesh.castShadow&&mesh.receiveShadow);
  }
  // The old doors remain at the old plane. In front, all nine points across
  // the real 1 m sheltered apron must be empty all the way to its outside.
  for(const x of[-.85,0,.85])for(const y of[.35,1.5,2.70]){
    const ray=new T.Raycaster(new T.Vector3(x,y,1.78),new T.Vector3(0,0,1),0,1.02);
    assert.equal(ray.intersectObject(g,true).length,0,'entry apron blocked at '+x+','+y);
  }
  const sage=g.children.find(m=>m.material.name.includes('sage')).material;
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  sage.onBeforeCompile(shader);
  assert(shader.fragmentShader.includes('arrivalGrain'));
  assert(shader.fragmentShader.includes('ranchTimberSample( normalMap'));
  assert.equal(sage.customProgramCacheKey(),'arrival-sage-painted-board-v1');
});
