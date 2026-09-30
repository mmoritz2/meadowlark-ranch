import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const req=createRequire(process.env.GLTF_PIPELINE_MODULES?path.join(process.env.GLTF_PIPELINE_MODULES,'../package.json'):import.meta.url);
const sharp=req('sharp'),folder='assets/textures/scanned';
const records=JSON.parse(await fs.readFile(folder+'/manifest.json','utf8'));
const cache='/tmp/meadowlark-ground-sources';await fs.mkdir(cache,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const asset of records)for(const file of asset.files){
  const dest=path.join(folder,file.file.replace('.jpg','.webp')),original=path.join(cache,file.file);
  let source;
  try{source=await fs.readFile(original);}catch{source=await fs.readFile(path.join(folder,file.file));await fs.writeFile(original,source);}
  if(sha(source)!==file.sha256)throw Error('Unexpected source '+file.file);
  const normal=file.file.includes('_nor_gl'),arm=file.file.includes('_arm');
  const quality=normal?96:90,size=arm?512:normal?1024:2048;
  const data=await sharp(source).resize(size,size).webp({quality,effort:5}).toBuffer();
  await fs.writeFile(dest,data);
  file.output={file:path.basename(dest),bytes:data.length,sha256:sha(data),processing:'WebP '+quality+', '+size+'px; no recoloring'};
  await fs.rm(path.join(folder,file.file),{force:true});
  console.log(file.file,Math.round(source.length/1024)+' KB -> '+Math.round(data.length/1024)+' KB');
}
await fs.writeFile(folder+'/manifest.json',JSON.stringify(records,null,2)+'\n');
