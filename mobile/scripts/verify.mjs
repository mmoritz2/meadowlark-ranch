import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../www');
const manifest=JSON.parse(await readFile(path.join(base,'bundle-manifest.json'),'utf8'));
const failures=[];
for(const row of manifest.files){
 const file=path.join(base,row.path),data=await readFile(file),sha=createHash('sha256').update(data).digest('hex');
 if(sha!==row.sha256)failures.push('Hash mismatch: '+row.path);
 if(!/\.(?:m?js|html)$/.test(row.path)||row.path.includes('/vendor/'))continue;
 const code=data.toString();
 for(const match of code.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){
  const relative=match[1].split('?')[0];if(!relative.startsWith('.'))continue;
  try{await access(path.resolve(path.dirname(file),relative));}catch{failures.push('Missing import: '+row.path+' -> '+relative);}
 }
}
const html=await readFile(path.join(base,'index.html'),'utf8');
if(!html.includes('const SOCIAL=false;'))failures.push('Native social guard missing');
if(!html.includes('await window.MeadowlarkNative.ready;'))failures.push('Save hydration barrier missing');
if(html.includes('localStorage'))failures.push('Unadapted game storage reference');
if(!html.includes('window.MeadowlarkNative.attachGame'))failures.push('Native lifecycle hook missing');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Verified '+manifest.files.length+' hashes, relative module imports, native save bootstrap, offline social guard, and lifecycle seam. Device execution remains unverified.');
