import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixture,hash,fieldHash,payload} from './snowpeak-boulder-fixture.mjs';
import {applyHollowpeakCanonicalField,HOLLOWPEAK_CANONICAL_FIELD as C} from '../assets/hollowpeak-canonical-field.mjs';
import {planSnowpeakBoulderSeating as fit} from '../assets/snowpeak-boulder-seating.mjs';
import {replaceSnowpeakBoulderContact as apply} from '../assets/snowpeak-boulder-contact.mjs';

const stampBytes=fs.readFileSync(new URL('./fixtures/snowpeak-boulder-resource-stamp.json',import.meta.url));
assert.equal(hash(stampBytes),'7de0a0bfa681719cc13271ade3ad9e7f67eff9c3ac938a67287f1d5a8b7c7848','Exact tiny local e11 fixture pin');
const stamp=JSON.parse(stampBytes);
const patchMatrix=[.512955964687927,0,-.48967437292044985,0,0,.7091578196734191,0,0,.48967437292044985,0,.512955964687927,0,-160,14.557221565246586,-250,1];
const bytes=g=>Object.fromEntries([...Object.entries(g.attributes).map(([k,a])=>[k,hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))]),['index',hash(new Uint8Array(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength))]]);
const snapshot=f=>({geometry:f.mesh.geometry,material:f.mesh.material,matrix:f.mesh.matrixWorld.toArray(),position:f.mesh.position.toArray(),scale:f.mesh.scale.toArray(),quaternion:f.mesh.quaternion.toArray(),circleOwner:f.source.collider,circles:f.world.colliders.slice(),circle:{...f.circle},precise:Object.getOwnPropertyDescriptor(f.circle,'precise'),stats:f.solidWorld.surfaceStats(),support:f.groundSurfaces.slice(),field:hash(new Uint8Array(f.heights.buffer)),sourceBytes:bytes(f.mesh.geometry),scanBytes:bytes(f.piece.geo)});
function footprint(f){
 const original=f.mesh.geometry.attributes.position.array,scan=f.piece.geo.attributes.position.array;
 const bounds=a=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.length;i++){lo[i%3]=Math.min(lo[i%3],a[i]);hi[i%3]=Math.max(hi[i%3],a[i]);}return{lo,hi};};
 const a=bounds(original),b=bounds(scan),q=Math.max(a.hi[0]-a.lo[0],a.hi[2]-a.lo[2])/Math.max(b.hi[0]-b.lo[0],b.hi[2]-b.lo[2]),cx=(b.lo[0]+b.hi[0])/2,cz=(b.lo[2]+b.hi[2])/2,m=f.mesh.matrixWorld.elements;
 const box={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(let i=0;i<scan.length;i+=3){const x=Math.fround(Math.fround(scan[i]-cx)*q),z=Math.fround(Math.fround(scan[i+2]-cz)*q),X=m[0]*x+m[8]*z+m[12],Z=m[2]*x+m[10]*z+m[14];box.minX=Math.min(box.minX,X);box.maxX=Math.max(box.maxX,X);box.minZ=Math.min(box.minZ,Z);box.maxZ=Math.max(box.maxZ,Z);}
 return{ix0:Math.floor((box.minX+500)/C.step),ix1:Math.floor((box.maxX+500)/C.step),iz0:Math.floor((box.minZ+500)/C.step),iz1:Math.floor((box.maxZ+500)/C.step)};
}
function runBoundedCase(name){
 assert(['local-e11-stamp','authenticated-patch'].includes(name));
 const f=fixture(),matrix=name==='local-e11-stamp'?stamp.matrix:patchMatrix;
 // Match real raw28 constructor operations. Matrix decomposition can introduce
 // one-ULP nonuniform scale, which is not an actual source constructor pose.
 f.mesh.scale.setScalar(matrix[5]);f.mesh.rotation.set(0,Math.atan2(matrix[8],matrix[0]),0);f.mesh.position.set(matrix[12],matrix[13],matrix[14]);f.mesh.updateWorldMatrix(true,false);
 Object.assign(f.circle,{x:matrix[12],z:matrix[14],r:matrix[5]*1.05});
 f.heights.fill(NaN);const touched=footprint(f);
 if(name==='local-e11-stamp'){
  assert.equal(stamp.sourceFieldSHA256,fieldHash);assert.equal(stamp.sourceGeometrySeed,9204);assert.equal(stamp.sourceIndex,3);assert.equal(stamp.residentPart,3);
  const g=stamp.grid;assert.equal(g.nodes.length,g.nx*g.nz);assert(g.nodes.every(Number.isFinite));
  assert.deepEqual(touched,stamp.coveredCellBounds);assert(touched.ix0>=g.ix0&&touched.ix1+1<g.ix0+g.nx&&touched.iz0>=g.iz0&&touched.iz1+1<g.iz0+g.nz,'Every touched canonical cell has all four exact saved nodes');
  for(let iz=0;iz<g.nz;iz++)for(let ix=0;ix<g.nx;ix++)f.heights[(g.iz0+iz)*513+g.ix0+ix]=g.nodes[iz*g.nx+ix];
 }else{
  applyHollowpeakCanonicalField(f.heights,payload.fieldBytes);
  assert(touched.ix0>=C.ix0&&touched.ix1+1<C.ix0+C.nx&&touched.iz0>=C.iz0&&touched.iz1+1<C.iz0+C.nz,'Every touched cell lies inside the authenticated canonical patch');
 }
 // NaN exterior makes an unaccounted terrain-cell read fail rather than silently
 // using a synthetic floor. This is not a certificate for the entire e11 field.
 const before=snapshot(f),input={sourcePositions:f.mesh.geometry.attributes.position.array,sourceIndex:f.mesh.geometry.index.array,scanPositions:f.piece.geo.attributes.position.array,scanIndex:f.piece.geo.index.array,matrixWorld:f.mesh.matrixWorld.elements,heights:f.heights};
 let ambient=0,plan,error,state;const random=Math.random;
 try{
  Math.random=()=>{ambient++;throw Error('Resource rejection touched ambient RNG');};
  plan=fit(input);assert.equal(plan.accepted,false);assert.equal(plan.resourceBound,true);assert.equal(plan.status,'RETAIN_ORIGINAL_VISIBILITY_RESOURCE_BUDGET_EXCEEDED');
  assert.equal(plan.metrics.visibility.budget.kind,'transientPieces');assert.equal(plan.metrics.visibility.budget.value,2049);assert.equal(plan.metrics.visibility.budget.limits.transientPieces,2048);
  assert.deepEqual(snapshot(f),before);
  assert.throws(()=>apply(f),e=>{error=e;assert(e instanceof Error);assert(e.cause instanceof Error);assert.equal(e.rollbackRestored,true);assert.equal(e.admission.resourceBound,true);assert.equal(e.admission.status,plan.status);assert.deepEqual(e.admission.visibilityBudget,plan.metrics.visibility.budget);return true;});
  assert.deepEqual(snapshot(f),before);
  const text=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8'),begin=text.indexOf('  state.installSnowpeakBoulderContact='),end=text.indexOf('  let youngOuterSources',begin),bridge=text.slice(begin,end),photoscans={};
  assert(begin>=0&&end>begin);new Function('state','outerRockParts','replaceSnowpeakBoulderContact','G',bridge)(photoscans,[null,null,null,f.piece],apply,f.G);
  state=photoscans.installSnowpeakBoulderContact({source:f.source,runtime:f.runtime});
  assert.equal(state.status,'retained-original');assert.equal(state.rollbackRestored,true);assert.equal(state.admission.resourceBound,true);assert.equal(state.admission.status,plan.status);assert.deepEqual(state.admission.visibilityBudget,error.admission.visibilityBudget);assert(state.cause instanceof Error);assert(state.cause.cause instanceof Error);assert.match(state.reason,/resource budget exceeded/);
  assert.deepEqual(snapshot(f),before);assert.equal(ambient,0);
 }finally{Math.random=random;}
 return{case:name,status:state.status,admissionStatus:state.admission.status,resourceBound:state.admission.resourceBound,budget:state.admission.visibilityBudget,touchedCanonicalCells:touched,ambientDraws:ambient,originalSourceUnchanged:true,wholeFieldE11Claim:false};
}
if(process.argv[2]==='--bounded-case'){
 process.stdout.write(JSON.stringify(runBoundedCase(process.argv[3]))+'\n');
}else{
 for(const name of ['local-e11-stamp','authenticated-patch'])test('bounded optional rejection preserves source/contact/RNG using '+name,()=>{
  // Isolate the dangerous regression so a missing resource guard fails this test
  // under a bounded V8 heap and process deadline instead of hanging the suite.
  const out=execFileSync(process.execPath,['--max-old-space-size=128',fileURLToPath(import.meta.url),'--bounded-case',name],{timeout:5000,encoding:'utf8',stdio:'pipe'});
  const result=JSON.parse(out);assert.equal(result.status,'retained-original');assert.equal(result.resourceBound,true);assert.equal(result.originalSourceUnchanged,true);assert.equal(result.ambientDraws,0);
 });
}
