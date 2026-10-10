import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {ISLAND_LEAF_SOURCE,ISLAND_LEAF_FACTOR,growIslandLeafArrays,applyIslandLeafSurfaces} from '../assets/island-leaf-surfaces.mjs';
import {readFileSync} from 'node:fs';
function readIslandLeafSource(url=new URL('../assets/models/world/realism/island_tree_01.glb',import.meta.url)){
 const file=readFileSync(url),jsonLength=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+jsonLength).toString()),binary=20+jsonLength+8;
 const material=gltf.materials.findIndex(m=>m.name==='island_tree_01_leaves'),primitive=gltf.meshes.flatMap(m=>m.primitives).find(p=>p.material===material);
 function read(id){const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],out=a.componentType===5126?new Float32Array(a.count*width):new Uint32Array(a.count*width),stride=v.byteStride||width*size,start=binary+(v.byteOffset||0)+(a.byteOffset||0);for(let i=0;i<a.count;i++)for(let j=0;j<width;j++){const at=start+i*stride+j*size;out[i*width+j]=a.componentType===5126?file.readFloatLE(at):a.componentType===5125?file.readUInt32LE(at):file.readUInt16LE(at);}return out;}
 return {file,gltf,primitive,positions:read(primitive.attributes.POSITION),normals:read(primitive.attributes.NORMAL),uv:read(primitive.attributes.TEXCOORD_0),indices:read(primitive.indices)};
}

const source=readIslandLeafSource(),grown=growIslandLeafArrays(source.positions,source.indices);
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const directions=[[1,0,0],[0,1,0],[0,0,1],...Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4),0,-Math.sin(i*Math.PI/4)])];
function extrema(p){return directions.map(d=>{let min=Infinity,max=-Infinity;for(let i=0;i<p.length;i+=3){const v=p[i]*d[0]+p[i+1]*d[1]+p[i+2]*d[2];min=Math.min(min,v);max=Math.max(max,v);}return [min,max];});}
function geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(source.positions.slice(),3));g.setAttribute('normal',new T.BufferAttribute(source.normals.slice(),3));g.setAttribute('uv',new T.BufferAttribute(source.uv.slice(),2));g.setIndex(new T.BufferAttribute(source.indices.slice(),1));g.computeBoundingBox();g.computeBoundingSphere();return g;}
function face(p,at){const a=source.indices[at]*3,b=source.indices[at+1]*3,c=source.indices[at+2]*3,u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];}

test('growth is restricted to the reviewed original Island leaf source and connected quads',()=>{
 assert.equal(createHash('sha256').update(source.file).digest('hex'),ISLAND_LEAF_SOURCE.modelSha256);
 assert.deepEqual(source.gltf.nodes,[{name:'island_tree_01_LOD0',mesh:0}]);
 assert.equal(source.positions.length/3,176672);assert.equal(source.indices.length/3,88336);assert.equal(ISLAND_LEAF_FACTOR,1.25);
 for(let q=0;q<44168;q++){const v=q*4;assert.deepEqual([...source.indices.subarray(q*6,q*6+6)],[v,v+1,v+2,v,v+3,v+1]);}
 assert.equal(grown.positions.length,source.positions.length);assert(grown.positions.every(Number.isFinite));
 const untouched=readIslandLeafSource();assert.deepEqual(bytes(source.positions),bytes(untouched.positions));assert.deepEqual(bytes(source.indices),bytes(untouched.indices));
});

test('all global XYZ bounds and eight view support planes remain exactly unchanged',()=>{
 assert.deepEqual(extrema(grown.positions),extrema(source.positions));
 assert.equal(grown.stats.quads,44168);assert.equal(grown.stats.vertices,176672);assert.equal(grown.stats.triangles,88336);
 assert(grown.stats.fullFactorQuads>44000,'the retained source actually receives the requested surface growth');
 assert(grown.stats.heldQuads>=6,'extremal surfaces remain held at their original extents');
 assert(grown.stats.maxDisplacement<.014);assert(grown.stats.maxCenterError<2e-7);
});

test('every quad keeps its center and shape with one bounded uniform scale',()=>{
 const p=source.positions,r=grown.positions;
 for(let start=0;start<p.length;start+=12){
  const c=[0,0,0],n=[0,0,0];for(let v=0;v<4;v++)for(let a=0;a<3;a++){c[a]+=p[start+v*3+a]*.25;n[a]+=r[start+v*3+a]*.25;}
  for(let a=0;a<3;a++)assert(Math.abs(c[a]-n[a])<2e-7,'original leaf center retained');
  let numerator=0,denominator=0;for(let v=0;v<4;v++)for(let a=0;a<3;a++){const d=p[start+v*3+a]-c[a];numerator+=d*(r[start+v*3+a]-c[a]);denominator+=d*d;}
  const factor=numerator/denominator;assert(factor>1-1e-6&&factor<1.25+3e-5);
  for(let v=0;v<4;v++)for(let a=0;a<3;a++)assert(Math.abs(r[start+v*3+a]-(c[a]+(p[start+v*3+a]-c[a])*factor))<4e-7,'one scale retains source shape');
 }
});

test('all triangles preserve finite nondegenerate area, winding and geometric normal direction',()=>{
 let oldArea=0,newArea=0;
 for(let i=0;i<source.indices.length;i+=3){const a=face(source.positions,i),b=face(grown.positions,i),la=Math.hypot(...a),lb=Math.hypot(...b);assert(la>1e-9&&lb>1e-9);assert(a.reduce((n,v,j)=>n+v*b[j],0)/(la*lb)>.999999);assert(lb/la>1-1e-4&&lb/la<1.563);oldArea+=la;newArea+=lb;}
 assert(newArea/oldArea>1.55&&newArea/oldArea<=1.5625+1e-5,'uniform1.25 surface area gain is present without triangle inflation');
});

test('in-place application preserves source normals, UV, indices, geometry identity and RNG',()=>{
 const g=geometry(),uuid=g.uuid,id=g.id,normal=g.attributes.normal,uv=g.attributes.uv,index=g.index,oldPosition=g.attributes.position,bounds=g.boundingBox.clone(),random=Math.random;
 let result;try{Math.random=()=>{throw Error('leaf preparation must not allocate a random UUID');};result=applyIslandLeafSurfaces(T,g);assert.equal(applyIslandLeafSurfaces(T,g),result);}finally{Math.random=random;}
 assert.equal(g.uuid,uuid);assert.equal(g.id,id);assert.equal(g.attributes.normal,normal);assert.equal(g.attributes.uv,uv);assert.equal(g.index,index);assert.notEqual(g.attributes.position,oldPosition);
 assert.deepEqual(bytes(oldPosition.array),bytes(source.positions));assert.deepEqual(bytes(normal.array),bytes(source.normals));assert.deepEqual(bytes(uv.array),bytes(source.uv));assert.deepEqual(bytes(index.array),bytes(source.indices));assert(g.boundingBox.equals(bounds));
 assert.deepEqual(bytes(g.attributes.position.array),bytes(grown.positions));g.dispose();
});

test('unexpected buffers or late canopy application fail without changing geometry',()=>{
 const altered=source.positions.slice();altered[0]+=.001;assert.throws(()=>growIslandLeafArrays(altered,source.indices),/unknown position/);
 assert.throws(()=>growIslandLeafArrays(new Float64Array(source.positions),source.indices),/POSITION/);
 const g=geometry(),position=g.attributes.position;g.setAttribute('canopyShade',new T.BufferAttribute(new Float32Array(source.positions.length/3).fill(1),1));assert.throws(()=>applyIslandLeafSurfaces(T,g),/before canopy/);assert.equal(g.attributes.position,position);g.dispose();
});
