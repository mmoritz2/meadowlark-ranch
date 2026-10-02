// Input: official ambientCG Grass004_2K-JPG.zip, its four JPG maps extracted
// to /tmp/meadowlark-pasture-source. Only texture data is used from the archive.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const req=createRequire(process.env.GLTF_PIPELINE_MODULES?path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json'):import.meta.url);
const sharp=req('sharp'),source='/tmp/meadowlark-pasture-source',out='assets/textures/pasture';
await fs.mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const maps={},records=[];
for(const type of ['Color','NormalGL','AmbientOcclusion','Roughness']){
  const file=`Grass004_2K-JPG_${type}.jpg`,data=await fs.readFile(path.join(source,file));
  maps[type]=data;records.push({file,bytes:data.length,sha256:hash(data)});
}
const outputs=[];
async function save(file,data){await fs.writeFile(path.join(out,file),data);outputs.push({file,bytes:data.length,sha256:hash(data)});}
await save('grass_diff.webp',await sharp(maps.Color).resize(2048,2048).webp({quality:90,effort:5}).toBuffer());
await save('grass_nor_gl.webp',await sharp(maps.NormalGL).resize(1024,1024).webp({quality:96,effort:5}).toBuffer());
const ao=await sharp(maps.AmbientOcclusion).resize(512,512).extractChannel(0).raw().toBuffer();
const rough=await sharp(maps.Roughness).resize(512,512).extractChannel(0).raw().toBuffer();
const arm=Buffer.alloc(512*512*3);for(let i=0;i<ao.length;i++){arm[i*3]=ao[i];arm[i*3+1]=rough[i];}
await save('grass_arm.webp',await sharp(arm,{raw:{width:512,height:512,channels:3}}).webp({quality:94,effort:5}).toBuffer());
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({
  asset:'Grass004',author:'ambientCG / Lennart Demes',page:'https://ambientcg.com/view?id=Grass004',
  download:'https://ambientcg.com/get?file=Grass004_2K-JPG.zip',license:'CC0-1.0',
  licenseURL:'https://docs.ambientcg.com/license/',retrieved:'2026-10-02',tileMetres:1.4,
  sourceFiles:records,outputs,processing:'Original albedo preserved. WebP 2048px color, 1024px OpenGL normal, 512px packed AO/roughness/zero metalness.'
},null,2)+'\n');
console.log(outputs);
