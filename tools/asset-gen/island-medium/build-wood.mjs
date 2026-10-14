import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const req=createRequire(process.env.GLTF_PIPELINE_MODULES?path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json'):import.meta.url);
const meshoptEntry=req.resolve('meshoptimizer');
assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(meshoptEntry),'package.json'),'utf8')).version,'1.2.0','Pinned simplifier version');
const {MeshoptSimplifier}=await import(pathToFileURL(meshoptEntry));
import {readGLB,primitiveData,floatAttribute,boundsOf,serializePart,assembleGLB,SOURCE_SHA,sha} from './glb-utils.mjs';

const sourceFile=fileURLToPath(new URL('../../../assets/models/world/realism/island_tree_01.glb',import.meta.url));
assert(process.argv[2],'Usage: node build-wood.mjs OUTPUT_DIRECTORY');
const out=path.resolve(process.argv[2])+path.sep;fs.mkdirSync(out,{recursive:true});const doc=readGLB(sourceFile);assert.equal(doc.sha256,SOURCE_SHA);
await MeshoptSimplifier.ready;
const sourceParts=doc.json.meshes.flatMap(m=>m.primitives.map(p=>primitiveData(doc,p))),wood=sourceParts.filter(p=>!/leaves|twig/.test(p.material));
const fullBounds=sourceParts.map(p=>boundsOf(floatAttribute(p.attributes.POSITION))),sourceBounds={min:[0,1,2].map(k=>Math.min(...fullBounds.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...fullBounds.map(b=>b.max[k])))};
const directions=[];for(let elevation of[-.7,0,.7])for(let azimuth=0;azimuth<32;azimuth++){const a=azimuth/32*Math.PI*2;directions.push([Math.cos(a)*Math.sqrt(1-elevation*elevation),elevation,Math.sin(a)*Math.sqrt(1-elevation*elevation)]);}directions.push([0,1,0],[0,-1,0]);
function support(P,ids,d){let best=-Infinity,index=-1;for(const i of ids){const v=P[i*3]*d[0]+P[i*3+1]*d[1]+P[i*3+2]*d[2];if(v>best){best=v;index=i;}}return {distance:best,index};}
function prepare(part){
 const p=floatAttribute(part.attributes.POSITION),normal=floatAttribute(part.attributes.NORMAL),uv=floatAttribute(part.attributes.TEXCOORD_0),attrs=new Float32Array(p.length/3*5),used=[...new Set(part.indices)],lock=new Uint8Array(p.length/3);
 for(let i=0;i<p.length/3;i++){attrs.set(normal.subarray(i*3,i*3+3),i*5);attrs.set(uv.subarray(i*2,i*2+2),i*5+3);}
 // Root collar and source directional silhouette supports remain actual source
 // vertices. No new positions, UV interpolation, loose pruning or branch rebuild.
 const low=Math.min(...used.map(i=>p[i*3+1]));for(const i of used)if(p[i*3+1]<=low+.035)lock[i]=1;
 for(const d of directions)lock[support(p,used,d).index]=1;
 return {part,p,attrs,used,lock};
}
const prepared=wood.map(prepare),oldTriangles=wood.reduce((n,p)=>n+p.indices.length/3,0),trials=[];
function simplify(totalTarget,errorLimit){
 const parts=[],metrics=[];
 for(const {part,p,attrs,used,lock}of prepared){
  const old=part.indices.length/3,target=Math.max(100,Math.round(totalTarget*old/oldTriangles)),protectedFaces=[],freeFaces=[];
  for(let i=0;i<part.indices.length;i+=3){const face=Array.from(part.indices.subarray(i,i+3));(face.some(v=>lock[v])?protectedFaces:freeFaces).push(...face);}
  const seamLock=lock.slice(),protectedVertices=new Set(protectedFaces),freeVertices=new Set(freeFaces);
  for(const id of protectedVertices)if(freeVertices.has(id))seamLock[id]=1;
  const [simplified,error]=MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(freeFaces),p,3,attrs,5,[.2,.2,.2,.6,.6],seamLock,Math.max(3,target*3-protectedFaces.length),errorLimit,['LockBorder']);
  const indices=Uint32Array.from([...protectedFaces,...simplified]),ids=[...new Set(indices)],map=new Map(ids.map((v,i)=>[v,i])),attributes={};
  for(const [semantic,a]of Object.entries(part.attributes)){const width=a.array.length/(p.length/3),array=new a.array.constructor(ids.length*width);for(let i=0;i<ids.length;i++)array.set(a.array.subarray(ids[i]*width,ids[i]*width+width),i*width);attributes[semantic]={...a,array};}
  const output={materialIndex:part.materialIndex,material:part.material,attributes,indices:Uint32Array.from(indices,i=>map.get(i)),sourceVertexIndices:ids};
  const after=indices.length/3,scale=MeshoptSimplifier.getScale(p,3),bounds=boundsOf(p,indices),oldBounds=boundsOf(p,part.indices),supportLoss=Math.max(...directions.map(d=>support(p,used,d).distance-support(p,ids,d).distance));
  const retainedPositions=new Set(ids.map(i=>[p[i*3],p[i*3+1],p[i*3+2]].join(',')));
  for(const id of used)if(lock[id])assert(retainedPositions.has([p[id*3],p[id*3+1],p[id*3+2]].join(',')),'Protected original root/silhouette face omitted');
  for(const [semantic,a]of Object.entries(attributes)){const original=part.attributes[semantic],width=a.array.length/ids.length;for(let i=0;i<ids.length;i++)for(let k=0;k<width;k++)assert.equal(a.array[i*width+k],original.array[ids[i]*width+k]);}
  assert.deepEqual(bounds,oldBounds,'Original solid wood AABB extrema must survive');assert(supportLoss<1e-8);
  metrics.push({material:part.material,sourceTriangles:old,targetTriangles:target,triangles:after,errorNormalized:error,errorSourceMeters:error*scale,protectedOriginalTriangles:protectedFaces.length/3,lockedVertices:lock.reduce((n,x)=>n+x,0),sourceVertices:p.length/3,vertices:ids.length,sourceBounds:oldBounds,bounds,directionalSupportLoss:supportLoss,allRetainedAttributesExactSourceSubset:true});parts.push(output);
 }
 return {target:totalTarget,errorLimit,triangles:parts.reduce((n,p)=>n+p.indices.length/3,0),maxErrorSourceMeters:Math.max(...metrics.map(m=>m.errorSourceMeters)),parts,metrics};
}
for(const target of[1500,2000,2500])for(const error of[.006,.012,.025])trials.push(simplify(target,error));
const feasible=trials.filter(t=>t.triangles<=2500&&t.triangles>=1400);assert(feasible.length,'No source-preserving medium wood trial met actual budget');
// Within the actual1500–2500 budget select the smallest measured error; do not
// remove extra branch detail merely to hit a round2000 triangle number.
const chosen=feasible.sort((a,b)=>a.maxErrorSourceMeters-b.maxErrorSourceMeters||b.triangles-a.triangles)[0];
const geometry={sourceFile:'assets/models/world/realism/island_tree_01.glb',sourceSHA256:SOURCE_SHA,sourceBounds,sourceHeight:sourceBounds.max[1]-sourceBounds.min[1],normalization:'Raw original meters, +Y up, identity scene/node; no recenter/scale. Gallery must use original full source bounds/height, not derivative bounds.',woodParts:chosen.parts.map(serializePart)};
const geometryPath=out+'wood-geometry.json';fs.writeFileSync(geometryPath,JSON.stringify(geometry)+'\n');
const glb=assembleGLB({source:doc,woodParts:chosen.parts,output:out+'island_tree_01_medium_wood.glb',extras:{sourceFile:'island_tree_01.glb',sourceSHA256:SOURCE_SHA,sourceBounds,sourceHeight:geometry.sourceHeight,mediumWoodOnly:true}});
const receipt={status:'CPU_WOOD_READY_NATIVE_ART_PENDING',sourceFile,sourceSHA256:SOURCE_SHA,license:'Poly Haven Island Tree01, CC0-1.0, existing repo manifest',software:'Meshoptimizer1.2.0, existing pinned asset-gen dependency',sourceWoodTriangles:oldTriangles,selected:{target:chosen.target,errorLimit:chosen.errorLimit,triangles:chosen.triangles,maxErrorSourceMeters:chosen.maxErrorSourceMeters,parts:chosen.metrics},trials:trials.map(({parts,...t})=>t),geometry:{file:geometryPath,sha256:sha(fs.readFileSync(geometryPath))},glb:{file:glb.file,sha256:glb.sha256,bytes:glb.bytes},checks:{sourceFileUnchanged:readGLB(sourceFile).sha256===SOURCE_SHA,sourceRootAnd98DirectionalSupportsRetained:true,woodAABBExtremaExact:true,allRetainedPositionNormalUVAndOtherAttributesExactSourceSubset:true,originalWoodMaterialTextureBytesPreserved:true,sourceSceneFrameAndTransformsPreserved:true,noNewPositionOrUVs:true,noLoosePruneOrStockWood:true},limits:['Meshopt error is an approximate simplification metric, not an independent Hausdorff bound.','Directional convex support and AABB retention do not prove all thin branch silhouette details; native gallery must inspect bark/branch appearance.','Wood-only GLB is a component preview, not a complete tree or runtime replacement.']};
fs.writeFileSync(out+'wood-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({selected:receipt.selected,geometry:receipt.geometry,glb:receipt.glb,trialSummary:trials.map(t=>({target:t.target,error:t.errorLimit,triangles:t.triangles,maxMeters:t.maxErrorSourceMeters}))},null,2));
