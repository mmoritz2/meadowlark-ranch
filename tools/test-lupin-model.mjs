// CPU contracts for the current pea-flower model. Native views judge its art.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createLupinGeometry} from '../assets/meadow-cover.js';
import {PROTOTYPE as PREVIOUS_CUP_CONSTRUCTOR} from './fixtures/lupin-model-source.mjs';
const previous=await import('data:text/javascript;base64,'+Buffer.from(PREVIOUS_CUP_CONSTRUCTOR).toString('base64'));
function make(constructor){
 const prior=Math.random,stats={geometry:0,color:0,random:0};
 Math.random=()=>{stats.random++;return .375;};
 const forbidden=class{constructor(){throw Error('Lupin geometry must not create scene, material or texture resources');}};
 const cpu={...T,BufferGeometry:class extends T.BufferGeometry{constructor(...a){super(...a);stats.geometry++;}},Color:class extends T.Color{constructor(...a){super(...a);stats.color++;}},Texture:forbidden,TextureLoader:forbidden,Mesh:forbidden,InstancedMesh:forbidden,MeshStandardMaterial:forbidden};
 try{return{geometry:constructor(cpu),stats};}finally{Math.random=prior;}
}
const before=make(previous.createLupinGeometry),after=make(createLupinGeometry),g=after.geometry;
const point=i=>new T.Vector3().fromBufferAttribute(g.attributes.position,i);
const face=i=>new T.Triangle(...Array.from({length:3},(_,k)=>point(g.index.array[i*3+k])));
const faces=Array.from({length:g.index.count/3},(_,i)=>face(i)),stem=faces.slice(0,10);

// Connect faces by their actual emitted positions, independent of vertex IDs.
// Petal folds deliberately duplicate vertices to keep their shading creases.
function components(first,last){
 const keys=p=>p.toArray().map(n=>n.toFixed(7)).join(','),owners=new Map(),adj=new Map();
 for(let i=first;i<last;i++){
  adj.set(i,new Set());
  for(const p of [faces[i].a,faces[i].b,faces[i].c]){const key=keys(p);if(!owners.has(key))owners.set(key,[]);owners.get(key).push(i);}
 }
 for(const ids of owners.values())for(const a of ids)for(const b of ids)if(a!==b)adj.get(a).add(b);
 const seen=new Set(),groups=[];
 for(let i=first;i<last;i++)if(!seen.has(i)){
  const group=[],todo=[i];seen.add(i);
  while(todo.length){const id=todo.pop();group.push(id);for(const j of adj.get(id))if(!seen.has(j)){seen.add(j);todo.push(j);}}
  groups.push(group);
 }
 return groups;
}
function touchesStem(group){
 const closest=new T.Vector3(),hit=new T.Vector3();
 for(const id of group){
  const f=faces[id],vertices=[f.a,f.b,f.c];
  for(const p of vertices)if(stem.some(s=>s.closestPointToPoint(p,closest).distanceTo(p)<1e-7))return true;
  // Petal folds and the closed bud may meet the real stalk by a surface-edge
  // intersection; they need not pin a duplicated vertex exactly to a face.
  for(let k=0;k<3;k++){
   const a=vertices[k],b=vertices[(k+1)%3],delta=b.clone().sub(a),length=delta.length();
   if(!length)continue;const ray=new T.Ray(a,delta.divideScalar(length));
   for(const s of stem)if(ray.intersectTriangle(s.a,s.b,s.c,false,hit)&&hit.distanceTo(a)<=length+1e-7)return true;
  }
 }
 return false;
}

test('one geometry and the same resource/RNG behavior fit the 240-triangle stalk budget',()=>{
 assert.deepEqual(after.stats,before.stats);assert.equal(after.stats.geometry,1);assert.equal(after.stats.color,1);
 assert.equal(g.index.count/3,238);assert(g.index.count/3<=240);
 assert.deepEqual(Object.keys(g.attributes),Object.keys(before.geometry.attributes));
 for(const attribute of Object.values(g.attributes))assert([...attribute.array].every(Number.isFinite));
 for(const id of g.index.array)assert(id>=0&&id<g.attributes.position.count);
});

test('two palmate whorls connect twelve leaflets through actual petioles to the stalk',()=>{
 // Stem+foliage retain their exact38-triangle allocation, now arranged as two
 // petiole quads and twelve leaflets instead of fourteen independent leaves.
 assert.deepEqual(g.index.array.slice(0,38*3),before.geometry.index.array.slice(0,38*3));
 const groups=components(10,38);assert.equal(groups.length,2);
 for(const group of groups){
  assert.equal(group.length,14);assert(touchesStem(group),'Palmate whorl does not meet the stalk');
  const first=Math.min(...group),petioleStart=g.index.array[first*3];
  const joint=point(petioleStart+3);
  for(let leaf=0;leaf<6;leaf++)assert(joint.distanceTo(point(petioleStart+4+leaf*4))<1e-7,'Leaflet misses its common palmate joint');
  const height=joint.y;assert(height>.15&&height<.4,'Low palmate foliage leaves an exposed flowering stem');
 }
 const c=g.attributes.color;
 for(let i=0;i<76;i++)assert(c.getY(i)>c.getX(i)&&c.getY(i)>c.getZ(i),'Stem/leaf colors remain green');
 assert.equal(g.attributes.position.count,532,'No vertices added to the stalk budget');
});

test('real triangle normals are finite, unit and agree with every incident face winding',()=>{
 const normal=g.attributes.normal;
 for(let i=0;i<normal.count;i++)assert(Math.abs(new T.Vector3().fromBufferAttribute(normal,i).length()-1)<1e-6);
 for(let i=0;i<faces.length;i++){
  const triangle=faces[i],n=triangle.getNormal(new T.Vector3());assert(triangle.getArea()>1e-10,'Degenerate triangle '+i);
  for(let k=0;k<3;k++)assert(n.dot(new T.Vector3().fromBufferAttribute(normal,g.index.array[i*3+k]))>.5,'Winding/normal disagreement at triangle '+i);
 }
});

test('all twenty-four pea florets and the closed green tip contact actual stalk faces',()=>{
 const groups=components(38,faces.length);assert.equal(groups.length,25);
 for(const group of groups){
  assert.equal(group.length,8);assert(touchesStem(group),'Floating flower/bud component starts at triangle '+Math.min(...group));
  if(Math.max(...group)<faces.length-8){
   const closest=new T.Vector3(),vertices=group.flatMap(id=>[faces[id].a,faces[id].b,faces[id].c]);
   const root=vertices.find(p=>stem.some(s=>s.closestPointToPoint(p,closest).distanceTo(p)<1e-7));
   assert(root,'Each floret root must touch an actual emitted stalk face');
   // Infer the emitted stalk's centreline from its two pentagonal rings.
   // The attachment proof therefore follows the actual longer bent stem.
   const height=Math.max(...stem.flatMap(f=>[f.a.y,f.b.y,f.c.y]));
   const ring=stem.flatMap(f=>[f.a,f.b,f.c]).filter(p=>Math.abs(p.y-height)<1e-7);
   const centre=ring.reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(1/ring.length);
   const radial=new T.Vector3(root.x-centre.x*root.y/height,0,root.z-centre.z*root.y/height).normalize();
   for(const id of group)assert(faces[id].getNormal(new T.Vector3()).dot(radial)>0,'Pea petal faces into the stalk');
  }
 }
 const tip=groups.find(group=>group.includes(faces.length-1)),edges=new Map();
 const key=p=>p.toArray().map(n=>n.toFixed(7)).join(',');
 for(const id of tip){const vertices=[faces[id].a,faces[id].b,faces[id].c];for(let k=0;k<3;k++){const edge=[key(vertices[k]),key(vertices[(k+1)%3])].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}}
 assert([...edges.values()].every(count=>count===2),'Terminal bud must be a closed surface');
 // Long exposed stalk and palmate foliage remain metre-scale plants. The
 // caller preserves established colony top height; authored cores vary locally.
 assert(g.boundingBox.min.y===0&&g.boundingBox.max.y>1.1&&g.boundingBox.max.y<1.15);
 assert(g.boundingBox.max.x-g.boundingBox.min.x<.55);
 assert(g.boundingBox.max.z-g.boundingBox.min.z<.45);
 const petalVertices=Array.from({length:24*18},(_,i)=>point(76+i));
 assert(Math.min(...petalVertices.map(p=>p.y))>.56,'Colored florets must leave a green lower stem exposed');

});

test('geometry generation is deterministic and does not mutate its previous model fixture',()=>{
 const again=make(createLupinGeometry),oldAgain=make(previous.createLupinGeometry);
 for(const key of Object.keys(g.attributes))assert.deepEqual(g.attributes[key].array,again.geometry.attributes[key].array);
 assert.deepEqual(g.index.array,again.geometry.index.array);assert.deepEqual(again.stats,after.stats);
 for(const key of Object.keys(before.geometry.attributes))assert.deepEqual(before.geometry.attributes[key].array,oldAgain.geometry.attributes[key].array);
});
