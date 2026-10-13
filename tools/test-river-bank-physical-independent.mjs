import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {T,repo,baseline,sha} from './river-preservation-fixture.mjs';
const pkg=process.env.RIVER_BANK_PACKAGE||repo;
const mod=await import(pathToFileURL(path.join(pkg,'assets/riverbank-terrain.mjs')).href+'?v=river-banks-1');
const {pastureRise}=await import(pathToFileURL(path.join(repo,'assets/pastoral-fields.mjs'))),{oasisTerrainHeight}=await import(pathToFileURL(path.join(repo,'assets/oasis-art.js'))),{fallsTerrainHeight}=await import(pathToFileURL(path.join(repo,'assets/falls-landscape.js'))),{canyonRelief}=await import(pathToFileURL(path.join(repo,'assets/canyon-landscape.js')));
const oldHTML=fs.readFileSync(new URL('ranch3d.html',baseline),'utf8'),nextHTML=fs.readFileSync(path.join(pkg,'ranch3d.html'),'utf8');
const originalGridFile=process.env.RIVER_BASE_GRID||new URL('./fixtures/river-7908e80/terrain-grid.f32',import.meta.url),protectedFile=process.env.RIVER_PROTECTED_SUPPORTS||new URL('./fixtures/river-7908e80/river-protected-supports.json',import.meta.url);
const gridBytes=fs.readFileSync(originalGridFile),grid=new Float32Array(gridBytes.buffer,gridBytes.byteOffset,gridBytes.byteLength/4),supports=JSON.parse(fs.readFileSync(protectedFile,'utf8'));
const N=513,STEP=1000/512,after=Float32Array.from(grid),changed=[];assert.equal(grid.length,N*N);assert.equal(supports.terrainSHA256,sha(gridBytes));
function sample(a,x,z){const gx=(x+500)/STEP,gz=(z+500)/STEP,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*N+ix,v=a[i],b=a[i+N],c=a[i+N+1],d=a[i+1];return fx+fz<=1?v+(d-v)*fx+(b-v)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const extract=s=>{const a=s.indexOf('function ihash(ix,iz){'),b=s.indexOf('/* ===== Roads =====',a);assert(a>=0&&b>a);return s.slice(a,b);};
const compile=(s,river)=>new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight',extract(s)+'return{rawH,riverZ,riverLevel,streamX,streamLevel};')(T,pastureRise,canyonRelief,oasisTerrainHeight,fallsTerrainHeight,river);
const old=compile(oldHTML,mod.legacyRiverBankHeight),next=compile(nextHTML,mod.riverBankTerrainHeight);
const oldRandom=Math.random;let plan,maxOldRawErrorAtChanged=0,maxDelta=0;
try{
 Math.random=()=>assert.fail('Numeric riverbank terrain/plan consumed gameplay or resource UUID RNG');
 plan=mod.configureRiverBanks({terrainStep:STEP,rawHeightAt:old.rawH,heightAt:(x,z)=>sample(grid,x,z)});
 for(let iz=0;iz<N;iz++)for(let ix=0;ix<N;ix++){
  const i=iz*N+ix,x=ix*STEP-500,z=iz*STEP-500,a=Math.fround(old.rawH(x,z)),b=Math.fround(next.rawH(x,z));
  assert(Number.isFinite(a+b));if(a===b)continue;maxOldRawErrorAtChanged=Math.max(maxOldRawErrorAtChanged,Math.abs(a-grid[i]));after[i]=b;changed.push(i);maxDelta=Math.max(maxDelta,Math.abs(b-grid[i]));
 }
}finally{Math.random=oldRandom;}
const proof={source:{base:'7908e80',moduleSHA:sha(fs.readFileSync(path.join(pkg,'assets/riverbank-terrain.mjs'))),htmlSHA:sha(nextHTML),nativeGridSHA:sha(gridBytes)},grid:{changed:changed.length,maxDelta,maxOldRawErrorAtChanged,afterSHA:sha(Buffer.from(after.buffer))},plan:{rows:plan.referenceRows,valueBytes:plan.referenceValueBytes,protected:plan.protectedVertices},scope:'Actual original native Float32 terrain plus production rawH reconstruction at every vertex. Approved bank cells may change; complete wet/route support cells and exterior must remain original. No GPU or mounted appearance claim.'};
test('production raw terrain reconstruction changes genuine authored bank cells and exactly matches original native cells before those edits',()=>{
 assert(changed.length>100,'Meaningful physical bank sculpture required');assert.equal(maxOldRawErrorAtChanged,0,'Raw source must reproduce original native physical cells being changed');assert(maxDelta>.1&&maxDelta<=1.450001);assert.equal(Math.random,oldRandom);
});
test('all6652 original wet-line and bridge/ford/weir/ferry/actual path support vertices remain bit-exact',()=>{
 const union=new Set();for(const [name,ids]of Object.entries(supports.categories)){for(const i of ids){assert.equal(after[i],grid[i],name+' supporting vertex '+i);union.add(i);}}assert.equal(union.size,supports.uniqueVertices);assert.equal(union.size,6652);proof.supports=Object.fromEntries(Object.entries(supports.categories).map(([k,v])=>[k,v.length]));
});
test('every changed physical vertex stays inside the three approved dry-bank domains and leaves other sectors exact',()=>{
 const changedSet=new Set(changed);for(let i=0;i<grid.length;i++){const x=i%N*STEP-500,z=Math.floor(i/N)*STEP-500;if(changedSet.has(i)){assert(mod.riverBankDomainAt(x,z),'Changed exterior cell '+i);assert(Math.abs(z-old.riverZ(x))>4.6&&Math.abs(z-old.riverZ(x))<12.4);}else assert.equal(after[i],grid[i]);}
 for(const [x,z]of [[-68.98,213.41],[310,300],[-150,-242],[342,67.9],[0,120],[-104,old.riverZ(-104)],[-250,old.riverZ(-250)],[16,136.587],[134,172.969]])assert.equal(sample(after,x,z),sample(grid,x,z));
});
test('reference planning sampler matches the actual original terrain triangle at every retained grid vertex and dense subcell decisions',()=>{
 let vertices=0,samples=0;for(const b of plan.boxes)for(let iz=b.iz0;iz<=b.iz1;iz++)for(let ix=b.ix0;ix<=b.ix1;ix++){const x=ix*STEP-500,z=iz*STEP-500;assert.equal(plan.heightAt(x,z),grid[iz*N+ix]);vertices++;}
 for(const i of changed.filter((_,i)=>i%11===0)){const x=i%N*STEP-500,z=Math.floor(i/N)*STEP-500;for(const [dx,dz]of [[.18,.22],[.85,.21],[.92,.93],[1.31,.77]]){assert.equal(plan.heightAt(x+dx,z+dz),sample(grid,x+dx,z+dz));samples++;}}
 assert(vertices>1000&&samples>100);proof.planning={vertices,samples,originalTriangleExact:true};
});
test('original center/water elevation and complete creek influence supports remain exact',()=>{
 for(let x=-495;x<=495;x+=.73){assert.equal(next.riverZ(x),old.riverZ(x));assert.equal(next.riverLevel(x),old.riverLevel(x));assert.equal(next.rawH(x,old.riverZ(x)),old.rawH(x,old.riverZ(x)));}
 for(let z=-330;z<=163;z+=1.21)for(const off of [-10,-7,-3,0,3,7,10]){const x=old.streamX(z)+off;assert.equal(next.streamLevel(z),old.streamLevel(z));assert.equal(sample(after,x,z),sample(grid,x,z),`Creek support at ${x},${z},offset${off}`);}
});
test('reference construction is scene-free, bounded and rejects an invalid physical grid or nonfinite source',()=>{
 assert(plan.referenceRows<10000&&plan.referenceValueBytes<40000);assert.equal(plan.referenceValueBytes,plan.referenceRows*4);assert.equal(plan.profile,'river-bank-landforms-1');const restore=Math.random;Math.random=()=>assert.fail('No constructor/random in numeric reference');try{assert.throws(()=>mod.configureRiverBanks({rawHeightAt:old.rawH,heightAt:()=>0,terrainStep:2}),/grid/);assert.throws(()=>mod.configureRiverBanks({rawHeightAt:()=>NaN,heightAt:()=>0,terrainStep:STEP}),/Nonfinite/);}finally{Math.random=restore;}
});
test('all authored physical triangle interiors and edges use the same finalized grid as hoof sampling',()=>{
 let samples=0,maxError=0;for(const i of changed){const ix=i%N,iz=Math.floor(i/N);if(ix>=512||iz>=512)continue;for(const ids of [[i,i+1,i+N],[i+1,i+N+1,i+N]])for(const w of [[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]]){const x=ids.reduce((sum,id,j)=>sum+(id%N*STEP-500)*w[j],0),z=ids.reduce((sum,id,j)=>sum+(Math.floor(id/N)*STEP-500)*w[j],0),y=ids.reduce((sum,id,j)=>sum+after[id]*w[j],0);maxError=Math.max(maxError,Math.abs(y-sample(after,x,z)));samples++;}}
 assert(samples>800);assert(maxError<1e-10);proof.triangleContacts={samples,maxError};
});
test('read-only default tests keep source/proof attribution and do not create repository audit logs',()=>{if(process.env.RIVER_BANK_AUDIT_OUTPUT)fs.writeFileSync(process.env.RIVER_BANK_AUDIT_OUTPUT,JSON.stringify(proof,null,2)+'\n');});
