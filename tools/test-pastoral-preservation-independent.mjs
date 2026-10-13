import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {repo,sha,createNearReplay,cellsDigest,withoutRandom,positive} from './pastoral-production-fixture.mjs';
const fixture=new URL('./fixtures/pastoral-7fbd127/',import.meta.url),oldHTML=fs.readFileSync(new URL('ranch3d.html',fixture),'utf8'),html=fs.readFileSync(path.join(repo,'ranch3d.html'),'utf8');
const contracts=JSON.parse(fs.readFileSync(new URL('./fixtures/pastoral-7fbd127/untouched-source-contract.json',import.meta.url)));
test('current unchanged physical/contact/controller and resident grass-source bytes survive the presentation pass',()=>{
 for(const[file,row]of Object.entries(contracts.files))assert.equal(sha(fs.readFileSync(path.join(repo,file))),row.sha256,file);
});
test('actual production near admissions preserve every original source row/color/count across quality and cell recycling without gameplay RNG',()=>{
 for(const quality of['high','low']){
  const a=createNearReplay(oldHTML,{quality}),b=createNearReplay(html,{quality});
  try{for(const[x,z]of[[44,-84],[82,-148],[176,35],[274,269],[233,129],[44,-84]]){
   withoutRandom(()=>{a.update(x,z);b.update(x,z);});assert.equal(cellsDigest(b.grassCells),cellsDigest(a.grassCells),'source accepted matrices/colors at '+[x,z]);assert.deepEqual(b.grassCells.map(c=>[c.count,c.version]),a.grassCells.map(c=>[c.count,c.version]));assert.equal(b.near.count,a.near.count);assert.equal(b.sourceVersion(),a.sourceVersion());
   for(const[key,width]of[['instanceMatrix',16],['instanceColor',3]]){if(width===3)assert.deepEqual(b.near[key].array,a.near[key].array);else for(let i=0;i<a.near.count;i++){const old=a.near[key].array.subarray(i*16,i*16+16),next=b.near[key].array.subarray(i*16,i*16+16);for(const k of[3,7,11,12,14,15])assert.equal(next[k],old[k]);assert.equal(positive(next),positive(old));}}
   const version=b.near.instanceMatrix.version,rows=b.near.instanceMatrix.array.slice();withoutRandom(()=>b.update(x,z));assert.equal(b.near.instanceMatrix.version,version);assert.deepEqual(b.near.instanceMatrix.array,rows);
  }}finally{a.dispose();b.dispose();}
 }
});
