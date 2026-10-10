import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import * as T from '../assets/vendor/three/build/three.module.js';
import {setTimberBoxUV,timberSampleUV,TIMBER_STRIP_CENTRES,TIMBER_STRIP_WIDTH,applyTimberGrain} from '../assets/timber-cladding.mjs';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const {createRanchBuilderArt}=await import('../assets/ranch-builder-art.js');
const THREE={...T,TextureLoader:class{load(path){const t=new T.Texture();t.name=path;return t;}}};
const GLTFLoader=class{loadAsync(){return new Promise(()=>{});}};
const equal=(a,b)=>assert(Math.abs(a-b)<2e-6,`${a} != ${b}`);

test('siding grain follows height at 30 cm board pitch without changing solid geometry',()=>{
 const g=new T.BoxGeometry(2.4,4,.18),p=g.attributes.position,n=g.attributes.normal;
 const positions=p.array.slice(),normals=n.array.slice(),indices=g.index.array.slice();
 setTimberBoxUV(g,{width:2.4,height:4,depth:.18,x:.45,y:2,siding:true});
 assert.deepEqual(p.array,positions);assert.deepEqual(n.array,normals);assert.deepEqual(g.index.array,indices);
 for(let i=0;i<p.count;i++)if(Math.abs(n.getZ(i))>.99){equal(g.attributes.uv.getX(i),(p.getY(i)+2)/2.4);equal(g.attributes.uv.getY(i),(p.getX(i)+.45)/.30);}
 // Narrow battens must stay within one scanned board, not split at its center.
 const batten=new T.BoxGeometry(.038,4,.029);setTimberBoxUV(batten,{width:.038,height:4,depth:.029,x:.6,y:2,siding:true});
 const rows=new Set(Array.from({length:24},(_,i)=>i).filter(i=>Math.abs(batten.attributes.normal.getZ(i))>.99).map(i=>Math.floor(batten.attributes.uv.getY(i))));assert.equal(rows.size,1);
});

test('horizontal rails and diagonal-brace stock retain grain along their local length',()=>{
 for(const dims of [[2,.1,.07],[.078,2.2,.035],[.09,.08,2]]) {
  const g=new T.BoxGeometry(...dims);setTimberBoxUV(g,{width:dims[0],height:dims[1],depth:dims[2],x:1.3,y:.6,z:-2});
  const axis=dims.indexOf(Math.max(...dims)),p=g.attributes.position,u=g.attributes.uv;
  for(let i=0;i<p.count;i++)equal(u.getX(i),(p.array[i*3+axis]+[1.3,.6,-2][axis])/2.4);
  for(const attr of Object.values(g.attributes))assert(Array.from(attr.array).every(Number.isFinite));
 }
});

test('negative and positive board indices sample photographed interiors deterministically',()=>{
 // Normalized V of resident photographed joints, inspected on the hashed 2048 px source.
 const joints=[77,235,391,550,708,865,1024,1182,1338,1496,1651,1808,1968].map(y=>1-y/2048);
 for(let board=-100;board<=100;board++)for(const f of [.001,.25,.5,.75,.999]) {
  const uv=timberSampleUV(.337,board+f);assert.deepEqual(uv,timberSampleUV(.337,board+f));
  assert(uv.every(Number.isFinite));assert(TIMBER_STRIP_CENTRES.some(c=>Math.abs(uv[1]-c)<=TIMBER_STRIP_WIDTH/2+1e-9));
  assert(joints.every(y=>Math.abs(uv[1]-y)>.009),'sample plus bounded filter stays clear of scanned joints');
 }
});

test('PBR channels share strip coordinates while existing sampler count and tangent basis remain',()=>{
 const m=applyTimberGrain(new T.MeshStandardMaterial(),T),shader={fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);
 for(const [sampler,uv]of[['map','vMapUv'],['normalMap','vNormalMapUv'],['roughnessMap','vRoughnessMapUv'],['aoMap','vAoMapUv']]) {
  assert(shader.fragmentShader.includes(`ranchTimberSample( ${sampler}, ${uv} )`));
  assert(!shader.fragmentShader.includes(`texture2D( ${sampler}, ${uv} )`));
 }
 assert.equal((shader.fragmentShader.match(/uniform sampler/g)||[]).length,(T.ShaderLib.standard.fragmentShader.match(/uniform sampler/g)||[]).length);
 assert(shader.fragmentShader.includes('normal = normalize( tbn * mapN )'));
 assert(shader.fragmentShader.includes('#include <normal_fragment_begin>'));
});

test('architecture keeps real recessed windows, mounted entrances and its existing batch budget',()=>{
 const a=createRanchArchitecture({THREE,loadTextures:false});
 const barn=a.buildBarn();barn.updateMatrixWorld(true);
 assert.equal(barn.userData.architecture.triangles,5104);assert.equal(barn.userData.architecture.drawCalls,12);
 const glass=new T.Raycaster(new T.Vector3(2.45,2.38,8),new T.Vector3(0,0,-1)).intersectObject(barn,true)[0];assert.equal(glass.object.material.name,'Ranch | window glass');assert(glass.point.z<2.71);
 const shop=a.buildOutbuilding({exterior:'village',animatedDoorOpening:{width:2.3,height:2.7}});shop.updateMatrixWorld(true);
 const world=createSolidWorld({THREE});world.register(shop);const body={bottom:.38,top:2.65,radius:.55};
 for(let z=3.8;z>1;z-=.12)assert.equal(world.resolve({x:0,z},body),0);
 assert(world.resolve({x:1.8,z:1.7},body)>0);
});

test('placed timber and placement previews use the same grain shader and geometry',()=>{
 const architecture=createRanchArchitecture({THREE,loadTextures:false});
 const builder=createRanchBuilderArt({THREE,GLTFLoader,architecture,deferModels:true});
 for(const kind of ['fence','shelter','stall','arena_entry']) {
  const placed=builder.create(kind),preview=builder.create(kind,true);assert(placed&&preview);
  const p=[],q=[];placed.traverse(o=>{if(o.isMesh)p.push(o);});preview.traverse(o=>{if(o.isMesh)q.push(o);});assert.equal(p.length,q.length);
  for(let i=0;i<p.length;i++) {
   assert.equal(p[i].geometry,q[i].geometry);if(p[i].material.userData.timberGrain){assert.equal(q[i].material.onBeforeCompile,p[i].material.onBeforeCompile);assert.equal(q[i].material.customProgramCacheKey(),p[i].material.customProgramCacheKey());}
   for(const attr of Object.values(p[i].geometry.attributes))assert(Array.from(attr.array).every(Number.isFinite));
  }
  assert.equal(preview.userData.collisionIgnore,true);
 }
});
