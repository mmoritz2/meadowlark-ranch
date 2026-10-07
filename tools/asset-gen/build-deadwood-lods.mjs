import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const req=createRequire(process.env.GLTF_PIPELINE_MODULES?path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json'):import.meta.url);
const imp=async n=>import(pathToFileURL(req.resolve(n)));
const {NodeIO}=await imp('@gltf-transform/core'),{ALL_EXTENSIONS}=await imp('@gltf-transform/extensions');
const {simplifyPrimitive,weld,compactPrimitive}=await imp('@gltf-transform/functions'),{MeshoptSimplifier}=await imp('meshoptimizer');
await MeshoptSimplifier.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),variants=[];
for(const id of ['island_tree_01','tree_small_02']){
 const file='assets/models/world/realism/'+id+'.glb',source=await fs.readFile(file),levels=[];
 for(const [level,target,error]of [['near',Infinity,0],['far',400,.12]]){
  const doc=await io.read(file);await doc.transform(weld());const parts=[];
  for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()||[]){
   const material=primitive.getMaterial().getName();if(/leaves|twig/.test(material))continue;
   const n=primitive.getIndices().getCount()/3;
   simplifyPrimitive(primitive,{simplifier:MeshoptSimplifier,ratio:Math.min(1,target/n),error});compactPrimitive(primitive);
   const attributes={};for(const name of ['POSITION','NORMAL','TEXCOORD_0'])attributes[name]=Array.from(primitive.getAttribute(name).getArray(),v=>Number(v.toFixed(6)));
   parts.push({material,matrix:node.getWorldMatrix(),attributes,index:Array.from(primitive.getIndices().getArray())});
  }
  levels.push({level,triangles:parts.reduce((n,p)=>n+p.index.length/3,0),parts});
 }
 variants.push({id,source:id+'.glb',sourceSHA256:createHash('sha256').update(source).digest('hex'),sourcePage:'https://polyhaven.com/a/'+id,license:'CC0-1.0',levels});
}
await fs.writeFile('assets/models/world/realism/deadwood-lods.json',JSON.stringify({variants})+'\n');console.log(variants.map(v=>({id:v.id,levels:v.levels.map(l=>({level:l.level,triangles:l.triangles}))})));
