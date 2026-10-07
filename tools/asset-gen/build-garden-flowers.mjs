// Import four complete CC0 periwinkle specimens with the author's opacity map.
// First run fetch-world-realism.py periwinkle_plant; use package.json dependencies.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const req=createRequire(process.env.GLTF_PIPELINE_MODULES?path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json'):import.meta.url);
const imp=async name=>import(pathToFileURL(req.resolve(name)));
const {NodeIO}=await imp('@gltf-transform/core'),{ALL_EXTENSIONS}=await imp('@gltf-transform/extensions');
const {prune,dedup,weld,simplify,textureCompress}=await imp('@gltf-transform/functions');
const {MeshoptSimplifier}=await imp('meshoptimizer'),sharp=req('sharp');await MeshoptSimplifier.ready;
const id='periwinkle_plant',base='/tmp/meadowlark-realism-sources/'+id,dir='assets/models/world/gardens';
const source=JSON.parse(await fs.readFile(base+'/source.json','utf8'));
for(const f of source.sourceFiles)if(createHash('sha256').update(await fs.readFile(path.join(base,f.file))).digest('hex')!==f.sha256)throw Error('Source checksum changed');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(base+'/'+id+'.gltf'),root=doc.getRoot();
const tris=node=>node.getMesh().listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0);
const nodes=root.listScenes()[0].listChildren().slice().sort((a,b)=>tris(a)-tris(b));
for(const n of nodes.slice(4))n.dispose();
for(const n of nodes.slice(0,4))n.setTranslation([0,0,0]);
await doc.transform(prune(),weld(),dedup());
const before=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);
const alpha=source.sourceFiles.find(f=>f.file.includes('_opacity_'));if(!alpha)throw Error('Missing author opacity');
for(const mat of root.listMaterials()){
 const tex=mat.getBaseColorTexture(),meta=await sharp(tex.getImage()).metadata();
 const mask=await sharp(path.join(base,alpha.file)).resize(meta.width,meta.height).extractChannel(0).png().toBuffer();
 const rgb=await sharp(tex.getImage()).removeAlpha().png().toBuffer();
 tex.setImage(await sharp(rgb).joinChannel(mask).png().toBuffer()).setMimeType('image/png');
 mat.setAlphaMode('MASK').setAlphaCutoff(.38).setDoubleSided(true).setMetallicFactor(0).setRoughnessFactor(1);
}
await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:.34,error:.002,lockBorder:true}),
 textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture/,resize:[1024,1024],quality:92}),
 textureCompress({encoder:sharp,targetFormat:'webp',slots:/normalTexture/,resize:[1024,1024],quality:96}),
 textureCompress({encoder:sharp,targetFormat:'webp',slots:/metallicRoughnessTexture|occlusionTexture/,resize:[512,512],quality:94}),prune(),dedup());
for(const mat of root.listMaterials()){
 const stats=await sharp(mat.getBaseColorTexture().getImage()).stats();if(stats.channels[3]?.min!==0||stats.channels[3]?.max!==255)throw Error('Opacity lost');
}
await fs.mkdir(dir,{recursive:true});const file=dir+'/'+id+'.glb';await io.write(file,doc);const data=await fs.readFile(file);
const after=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);
const record={...source,output:{file:id+'.glb',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),specimens:4,trianglesBefore:before,triangles:after},processing:'Four smallest complete author specimens, gallery translations removed. Border-preserving simplification; original 1K diffuse with author opacity, 1K OpenGL normal and 512px ARM. WebP in GLB, no runtime decoder.'};
await fs.writeFile(dir+'/manifest.json',JSON.stringify([record],null,2)+'\n');console.log(JSON.stringify(record.output));
