// Preserve every material and PBR channel. GLB + WebP needs no geometry decoder.
// npm install in this directory, or set GLTF_PIPELINE_MODULES to an existing
// node_modules directory containing the same dependencies as package.json.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {simplifyNeedleRibbons} from './simplify-needle-ribbons.mjs';
import {clusterPineNeedles} from './cluster-pine-needles.mjs';
const req=createRequire(process.env.GLTF_PIPELINE_MODULES ? path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json') : import.meta.url);
const imp=async name=>import(pathToFileURL(req.resolve(name)));
const {NodeIO}=await imp('@gltf-transform/core');
const {ALL_EXTENSIONS,KHRMeshQuantization}=await imp('@gltf-transform/extensions');
const {dedup,prune,weld,simplifyPrimitive,textureCompress,quantize,compactPrimitive}=await imp('@gltf-transform/functions');
const {MeshoptSimplifier}=await imp('meshoptimizer');
const sharp=req('sharp');
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out=path.resolve('assets/models/world/realism');await fs.mkdir(out,{recursive:true});
const records=[];
const tris=p=>(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3;
for(const id of process.argv.slice(2)){
  const base=path.join('/tmp/meadowlark-realism-sources',id);
  const source=JSON.parse(await fs.readFile(path.join(base,'source.json'),'utf8'));
  const doc=await io.read(path.join(base,id+'.gltf')),root=doc.getRoot();
  // One mature specimen is sufficient for the new canopy class. Preserve the
  // first author's complete tree, removing the source file's gallery copies.
  if(id==='pine_tree_01'){
    const scene=root.listScenes()[0];for(const node of scene.listChildren().slice(1))node.dispose();
    scene.listChildren()[0].setTranslation([0,0,0]);await doc.transform(prune());
  }
  if(id==='pine_tree_01')for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
    const colors=p.getAttribute('COLOR_0');if(colors){
      if(!colors.getArray().every(v=>v===255))throw Error('Unexpected non-white source vertex colors');
      p.setAttribute('COLOR_0',null);
    }
  }
  const before=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+tris(p),0);
  const needles=[];
  if(['fir_sapling_medium','pine_tree_01'].includes(id))for(const mesh of root.listMeshes())for(const primitive of mesh.listPrimitives())
    if(/twig/.test(primitive.getMaterial()?.getName()||''))needles.push(id==='pine_tree_01'?clusterPineNeedles(doc,primitive):simplifyNeedleRibbons(doc,primitive));
  const leafCards=[];
  if(id==='island_tree_01')for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives())
    if(/leaves/.test(p.getMaterial()?.getName()||''))leafCards.push(simplifyNeedleRibbons(doc,p,{triangles:24,vertices:21}));
  if(id==='island_tree_01'&&leafCards.reduce((n,p)=>n+p.ribbons,0)!==44168)throw Error('Expected every authored leaf to survive');
  console.log(id,'foliage conversion',JSON.stringify({needles,leafCards}));
  // Normalize collection layouts at runtime; keep individual rocks and saplings.
  await doc.transform(weld(),dedup());
  for(const m of root.listMaterials()){
    const foliage=/leaves|twig/.test(m.getName());
    if(foliage){
      const alpha=source.sourceFiles.find(f=>f.file.includes('_alpha_'));
      if(alpha){
        const tex=m.getBaseColorTexture(),meta=await sharp(tex.getImage()).metadata();
        const mask=await sharp(path.join(base,alpha.file)).resize(meta.width,meta.height).extractChannel(0).toBuffer();
        const rgb=await sharp(tex.getImage()).removeAlpha().png().toBuffer();
        tex.setImage(await sharp(rgb).joinChannel(mask).png().toBuffer()).setMimeType('image/png');
      }
      m.setAlphaMode('MASK').setAlphaCutoff(.38).setDoubleSided(true);
    }
    m.setMetallicFactor(0);
  }
  const metrics=[];
  for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
    const n=tris(p),name=p.getMaterial()?.getName()||'';
    // Leaves get a much higher budget than solid objects. Aggressive blanket
    // decimation deletes the crown of an archviz tree instead of simplifying it.
    const target=id==='pine_tree_01'?(/twig/.test(name)?85000:/bark/.test(name)?4000:4500):
      id==='island_tree_01'?(/leaves/.test(name)?n:/branches/.test(name)?7000:9000):
      id==='tree_small_02'?(/leaves/.test(name)?110000:7000):
      id==='pine_sapling_small'?(/twig/.test(name)?16000:1000):
      id==='fir_sapling_medium'?(/twig/.test(name)?120000:3500):
      id==='namaqualand_cliff_02'?24000:id==='rock_moss_set_01'?4500:8500;
    simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio:Math.min(1,target/n),error:.012,lockBorder:['fir_sapling_medium','pine_tree_01'].includes(id)&&/twig/.test(name)});
    compactPrimitive(p);
    metrics.push({material:name,before:n,after:tris(p)});
  }
  await doc.transform(prune(),dedup(),
    textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture/,resize:[1024,1024],quality:90}),
    textureCompress({encoder:sharp,targetFormat:'webp',slots:/normalTexture/,resize:[1024,1024],quality:96}),
    textureCompress({encoder:sharp,targetFormat:'webp',slots:/metallicRoughnessTexture|occlusionTexture/,resize:[512,512],quality:94}),
    prune(),dedup());
  for(const mat of doc.getRoot().listMaterials())if(mat.getAlphaMode()==='MASK'){
    const tex=mat.getBaseColorTexture();
    if(!tex||(await sharp(tex.getImage()).metadata()).hasAlpha!==true)throw Error('Missing foliage alpha: '+id+' '+mat.getName());
    const alpha=(await sharp(tex.getImage()).stats()).channels[3];
    if(alpha.min!==0||alpha.max!==255)throw Error('Foliage transparency was flattened: '+id);
  }
  if(id==='pine_tree_01'){
    await doc.transform(quantize({pattern:/NORMAL|TEXCOORD/,quantizeNormal:8,quantizeTexcoord:12}),prune());
    // Pruning sees no extension properties when only normals/UVs are quantized.
    // The BYTE normals still require this document-level glTF declaration.
    doc.createExtension(KHRMeshQuantization).setRequired(true);
  }
  const file=path.join(out,id+'.glb');await io.write(file,doc);
  const data=await fs.readFile(file);
  const record={...source,output:{file:id+'.glb',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),
    trianglesBefore:before,...(leafCards.length?{leafCards}:{}),...(needles.length?{needles}:{}),triangles:metrics.reduce((n,p)=>n+p.after,0),primitives:metrics,
    materials:root.listMaterials().length,textures:root.listTextures().length},
    processing:(id==='island_tree_01'?'Every one of 44,168 source leaves fitted to an original-UV quad, preserving its centre and orientation; ':'')+(id==='pine_tree_01'?'First author specimen; constant white vertex colors removed; 8-bit normals and 12-bit UVs; source needle clusters replaced with the original photographed twig sprays; ':'')+(needles.length&&id!=='pine_tree_01'?'Preserve all needle ribbons as fitted textured quads; ':'')+'Per-material mesh simplification; original albedo/normal/roughness/AO; separate author leaf alpha; 1024px albedo and normals, 512px ARM; WebP. No painterly color grading.'};
  records.push(record);console.log(id,JSON.stringify(record.output));
}
const manifest=path.join(out,'manifest.json');
const prior=JSON.parse(await fs.readFile(manifest,'utf8').catch(()=> '[]'));
await fs.writeFile(manifest,JSON.stringify([...prior.filter(r=>!records.some(n=>n.id===r.id)),...records],null,2)+'\n');
