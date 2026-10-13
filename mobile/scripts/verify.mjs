import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyBundleFreshness,sourcePath} from './bundle-freshness.mjs';
const mobile=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(mobile),base=path.join(mobile,'www');
const manifest=JSON.parse(await readFile(path.join(base,'bundle-manifest.json'),'utf8'));
const failures=await verifyBundleFreshness({root,base,manifest});
for(const row of Array.isArray(manifest.files)?manifest.files:[]){
 let file;try{file=sourcePath(base,row.path);}catch{continue;}
 if(!/\.(?:m?js|html)$/.test(row.path)||row.path.includes('/vendor/'))continue;
 let code;try{code=await readFile(file,'utf8');}catch{continue;}
 for(const match of code.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){
  const relative=match[1].split('?')[0];if(!relative.startsWith('.'))continue;
  const target=path.resolve(path.dirname(file),relative);
  if(!target.startsWith(base+path.sep)){failures.push('Import escapes native bundle: '+row.path+' -> '+relative);continue;}
  try{await access(target);}catch{failures.push('Missing import: '+row.path+' -> '+relative);}
 }
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Verified '+manifest.files.length+' generated hashes, current raw source and Git revision, required runtime inventory, native compiler inputs, relative imports, reward/save bootstrap, offline social guard, and lifecycle seam. Device execution remains unverified.');
