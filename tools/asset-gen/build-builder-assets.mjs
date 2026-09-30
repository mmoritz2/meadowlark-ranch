// Original CC0 materials retained; no baked lighting or palette flattening.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const req=createRequire(process.env.GLTF_PIPELINE_MODULES?path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json'):import.meta.url);
const imp=async n=>import(pathToFileURL(req.resolve(n)));
const {NodeIO}=await imp('@gltf-transform/core'),{ALL_EXTENSIONS}=await imp('@gltf-transform/extensions');
const {weld,dedup,prune,simplify,textureCompress}=await imp('@gltf-transform/functions');
const {MeshoptSimplifier}=await imp('meshoptimizer'),sharp=req('sharp');
await MeshoptSimplifier.ready;
const sha=b=>createHash('sha256').update(b).digest('hex');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const dest='assets/models/world/builder';await fs.mkdir(dest,{recursive:true});
const records=[];
for(const id of ['wine_barrel_01','wooden_picnic_table','planter_box_01','wooden_lantern_01','tree_stump_01','flower_gazania','wild_rooibos_bush']){
 const src='/tmp/meadowlark-realism-sources/'+id;
 const record=JSON.parse(await fs.readFile(src+'/source.json','utf8'));
 const doc=await io.read(src+'/'+id+'.gltf');
 const count=()=>doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0);
 const before=count();
 for(const m of doc.getRoot().listMaterials()){
  const alpha=record.sourceFiles.find(f=>f.file.includes('_alpha_'));
  if(alpha&&m.getBaseColorTexture()){
   const tex=m.getBaseColorTexture(),meta=await sharp(tex.getImage()).metadata();
   const mask=await sharp(path.join(src,alpha.file)).resize(meta.width,meta.height).extractChannel(0).toBuffer();
   const rgb=await sharp(tex.getImage()).removeAlpha().png().toBuffer();
   tex.setImage(await sharp(rgb).joinChannel(mask).png().toBuffer()).setMimeType('image/png');
   m.setAlphaMode('MASK').setAlphaCutoff(.38).setDoubleSided(true);
  }
 }
 const target=id==='flower_gazania'?5500:id==='wild_rooibos_bush'?10000:14000;
 await doc.transform(weld(),dedup(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,target/before),error:.003,lockBorder:true}),
  textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture/,resize:[1024,1024],quality:92}),
  textureCompress({encoder:sharp,targetFormat:'webp',slots:/normalTexture/,resize:[1024,1024],quality:96}),
  textureCompress({encoder:sharp,targetFormat:'webp',slots:/metallicRoughnessTexture|occlusionTexture/,resize:[512,512],quality:94}),prune(),dedup());
  for(const mat of doc.getRoot().listMaterials())if(mat.getAlphaMode()==='MASK'){
    const tex=mat.getBaseColorTexture();
    if(!tex||(await sharp(tex.getImage()).metadata()).hasAlpha!==true)throw Error('Missing foliage alpha: '+id+' '+mat.getName());
    const alpha=(await sharp(tex.getImage()).stats()).channels[3];
    if(alpha.min!==0||alpha.max!==255)throw Error('Foliage transparency was flattened: '+id);
  }
 await io.write(dest+'/'+id+'.glb',doc);const data=await fs.readFile(dest+'/'+id+'.glb');
 record.output={file:id+'.glb',bytes:data.length,sha256:sha(data),trianglesBefore:before,triangles:count(),materials:doc.getRoot().listMaterials().length};
 record.processing='Preserved original albedo, normal, metallic, roughness and AO. 1K color/normal, 512px ARM WebP; simplified to about 14K triangles. No color grading.';
 records.push(record);console.log(id,record.output);
}
await fs.writeFile(dest+'/manifest.json',JSON.stringify(records,null,2)+'\n');
const src='/tmp/meadowlark-builder-materials',out='assets/textures/builder';await fs.mkdir(out,{recursive:true});
const materials=JSON.parse(await fs.readFile(src+'/manifest.json','utf8'));
for(const asset of materials)for(const file of asset.files){
 const bytes=await fs.readFile(src+'/'+file.file);if(sha(bytes)!==file.sha256)throw Error('Source changed');
 const normal=file.file.includes('_nor_gl'),arm=file.file.includes('_arm'),size=arm?512:normal?1024:2048;
 const data=await sharp(bytes).resize(size,size).webp({quality:normal?96:92}).toBuffer();
 const name=file.file.replace('.jpg','.webp');await fs.writeFile(out+'/'+name,data);
 file.output={file:name,bytes:data.length,sha256:sha(data),size};
}
await fs.writeFile(out+'/manifest.json',JSON.stringify(materials,null,2)+'\n');
