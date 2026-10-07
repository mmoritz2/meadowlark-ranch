// All catalog reward sculptures, using actual Three geometry without browser/canvas.
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const Core=await import(threeURL);
const {createTackSummonShowcase}=await import('../assets/tack-summon-showcase.js');
const {TACK_PIECES}=await import('../assets/tack-collection.mjs');
const slotProfiles=new Map(),fingerprints=new Set(),geometryHashes=new Set();let maxTriangles=0,maxMeshes=0;
for(const piece of TACK_PIECES){
 const allocated=[];
 const THREE={...Core,MeshStandardMaterial:class extends Core.MeshStandardMaterial{constructor(p){super(p);this._qaDisposed=0;this.addEventListener('dispose',()=>this._qaDisposed++);allocated.push(this);}}};
 const kit=createTackSummonShowcase({THREE},piece),root=kit.root;
 assert.equal(root.userData.catalogId,piece.id);assert.equal(kit.stats.catalogId,piece.id);assert.equal(kit.stats.profile,piece.design.profile);
 assert.equal(root.children.length,kit.stats.meshes);assert(root.children.length>0&&root.children.length<20);
 assert.deepEqual(root.position.toArray(),[0,0,0]);assert.deepEqual(root.scale.toArray(),[1,1,1]);
 const box=new Core.Box3().setFromObject(root),center=box.getCenter(new Core.Vector3()),size=box.getSize(new Core.Vector3());
 assert(center.length()<1e-6,piece.id+' centered');assert(Math.max(...size.toArray())<=1.800001);assert(Math.min(...size.toArray())>.035,'actual 3D depth');
 assert.deepEqual(kit.stats.dimensions,size.toArray());
 const hash=createHash('sha256');let triangles=0;const finalGeometry=[];
 for(const mesh of root.children){
  assert(mesh.isMesh&&!mesh.isSkinnedMesh&&!mesh.isSprite,'real standalone geometry');assert(!mesh.material.map,'no texture dependency');
  const g=mesh.geometry,a=g.attributes;assert.equal(a.position.count,a.normal.count);assert.equal(a.position.count,a.uv.count);assert(a.position.count>0);
  for(const attribute of Object.values(a))assert(attribute.array.every(Number.isFinite),piece.id+' finite attribute');
  let zero=0;for(let i=0;i<a.normal.count;i++)if(new Core.Vector3().fromBufferAttribute(a.normal,i).lengthSq()<.1)zero++;
  assert.equal(zero,0,piece.id+' no unlit zero-normal vertices');
  triangles+=(g.index?.count||a.position.count)/3;hash.update(new Uint8Array(a.position.array.buffer,a.position.array.byteOffset,a.position.array.byteLength));
  let disposed=0;g.addEventListener('dispose',()=>disposed++);finalGeometry.push(()=>assert.equal(disposed,1,'each final geometry released exactly once'));
  const name=mesh.material.name,key={'Reward | leather':'leather','Reward | woven cloth':'cloth','Reward | lining':'lining','Reward | bound trim':'accent','Reward | cast hardware':'metal','Reward | inset stones':'accent'}[name];
  if(key)assert.equal(mesh.material.color.getHexString(),new Core.Color(piece.design[key]).getHexString(),piece.id+' exact '+key+' color');
 }
 assert.equal(triangles,kit.stats.triangles);assert(triangles<80000,piece.id+' triangle budget');maxTriangles=Math.max(maxTriangles,triangles);maxMeshes=Math.max(maxMeshes,root.children.length);
 if(piece.design.rainbow)for(let i=0;i<6;i++){const m=root.children.find(m=>m.material.name==='Reward | rainbow '+i);assert(m,piece.id+' rainbow '+i);assert.equal(m.material.color.getHexString(),new Core.Color(piece.design.palette[i]).getHexString());}
 fingerprints.add(kit.stats.fingerprint);geometryHashes.add(hash.digest('hex'));
 const profiles=slotProfiles.get(piece.slot)||new Set();profiles.add(piece.design.profile);slotProfiles.set(piece.slot,profiles);
 const scene=new Core.Scene();scene.add(root);kit.dispose();kit.dispose();assert.equal(root.parent,null);assert.equal(root.children.length,0);finalGeometry.forEach(fn=>fn());for(const material of allocated)assert.equal(material._qaDisposed,1,'including unused palette materials');
}
assert.equal(fingerprints.size,TACK_PIECES.length);assert.equal(geometryHashes.size,TACK_PIECES.length,'every authored item has distinct actual geometry');
for(const [slot,profiles]of slotProfiles)assert.equal(profiles.size,5,slot+' five profile silhouettes');
assert.throws(()=>createTackSummonShowcase({THREE:Core},{slot:'cape',design:{}}),TypeError);
console.log('PASS',TACK_PIECES.length,'unique 3D reward sculptures, all20 slot profiles, exact catalog colors/Rainbow, finite normals, centered1.8m bounds, no canvas/textures and complete idempotent disposal');
console.log('BUDGET',JSON.stringify({maxMeshes,maxTriangles}));
