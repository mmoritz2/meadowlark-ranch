import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// Runs from the game checkout; no browser, network, or generated QA fixtures.
const asset=name=>pathToFileURL(resolve('assets',name)).href;
const {loadHollowpeakCohortPayload,decodeHollowpeakCohortPayload,HOLLOWPEAK_COHORT_PAYLOAD_SHA256:packetSHA}=await import(asset('hollowpeak-cohort-payload.mjs'));
const {prepareHollowpeakRuntime}=await import(asset('hollowpeak-field-runtime.mjs'));
const {decodeHollowpeakCanonicalField,HOLLOWPEAK_CANONICAL_FIELD:C}=await import(asset('hollowpeak-canonical-field.mjs'));
const {readOwnedHollowpeakWater}=await import(asset('hollowpeak-water-behavior.mjs'));
const bytes=await readFile(resolve('assets/hollowpeak-cohort-1.bin'));
const buffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const fetchBytes=b=>async()=>({ok:true,arrayBuffer:async()=>buffer(b)});
const digest=b=>createHash('sha256').update(b).digest('hex');
const field=()=>Float32Array.from({length:513*513},(_,i)=>2+Math.sin(i*.017));

test('authenticated local package requests its content-versioned URL and forwards cancellation',async()=>{
 const signal=new AbortController().signal;let request;
 const payload=await loadHollowpeakCohortPayload({cryptoImpl:webcrypto,signal,fetchImpl:async(url,options)=>{request={url,options};return fetchBytes(bytes)();}});
 assert.equal(digest(bytes),packetSHA);
 assert.deepEqual([...request.url.searchParams],[['v',packetSHA]]);
 assert.equal(request.options.signal,signal);
 assert.equal(payload.authenticated,true);
 assert.equal(payload.payloadSHA256,packetSHA);
 assert.equal(decodeHollowpeakCohortPayload(buffer(bytes)).authenticated,false);
 assert.deepEqual(payload.waters.map(w=>[w.id,w.index.length/3]),[['upper-tarn',2754],['plunge-pool',3414],['upper-cleft',1356],['lower-source',830]]);
 assert.equal(payload.shoreGeometry.index.length/3,6352);
});

test('corrupt, truncated, failed and unauthenticated downloads cannot be installed',async()=>{
 const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;
 for(const bad of [corrupt,bytes.subarray(0,bytes.length-4)]){
  const heights=field(),before=heights.slice();
  await assert.rejects(prepareHollowpeakRuntime({heights,fetchImpl:fetchBytes(bad)}),/integrity mismatch/);
  assert.deepEqual(heights,before);
 }
 await assert.rejects(loadHollowpeakCohortPayload({fetchImpl:fetchBytes(bytes),cryptoImpl:{}}),/requires WebCrypto/);
 await assert.rejects(loadHollowpeakCohortPayload({fetchImpl:async()=>({ok:false})}),/could not load/);
});

test('one complete field changes only the owned rectangle; construction reference retains its historical nodes',async()=>{
 const heights=field(),before=heights.slice();
 const runtime=await prepareHollowpeakRuntime({heights,outsideHeightAt:()=>123,fetchImpl:fetchBytes(bytes)});
 const patch=decodeHollowpeakCanonicalField(runtime.payload.fieldBytes),historical=decodeHollowpeakCanonicalField(runtime.payload.constructionBytes);
 let changed=0,outside=0;
 for(let z=0;z<513;z++)for(let x=0;x<513;x++){
  const i=z*513+x,owned=x>=C.ix0&&x<C.ix0+C.nx&&z>=C.iz0&&z<C.iz0+C.nz;
  if(owned){assert.equal(heights[i],patch[(z-C.iz0)*C.nx+x-C.ix0]);changed++;}
  else{assert.equal(heights[i],before[i]);outside++;}
 }
 assert.equal(changed,12648);assert.equal(outside,250521);
 assert.equal(runtime.installation.additionalGroundSurfaces,0);
 assert.equal(runtime.queries.registered,false);
 for(let z=1;z<C.nz-1;z+=9)for(let x=1;x<C.nx-1;x+=11){
  const px=C.originX+(C.ix0+x)*C.step,pz=C.originZ+(C.iz0+z)*C.step;
  assert.equal(runtime.construction.heightAt(px,pz),historical[z*C.nx+x]);
 }
 assert.equal(runtime.construction.heightAt(600,600),123);
 assert.equal(runtime.queries.shoreContact(0,0),-Infinity);
});

test('mounted and walking water queries respect actual composed dry support',async()=>{
 const runtime=await prepareHollowpeakRuntime({heights:field(),fetchImpl:fetchBytes(bytes)}),q=runtime.queries,x=-156,z=-229.5;
 const wet=q.waterAt(x,z),world={fallsLandscape:{ownedQueries:q},groundH:q.ownedSupportHeightAt};
 assert.equal(wet.id,'plunge-pool');assert.equal(wet.insideSurface,true);assert(wet.supportDepth>.45);
 assert.deepEqual(readOwnedHollowpeakWater(world,x,z),{depth:wet.supportDepth,surface:wet.level});
 world.groundH=()=>wet.level+1;
 assert.equal(readOwnedHollowpeakWater(world,x,z),null,'A bridge or other dry floor must cover the water');
 assert.equal(readOwnedHollowpeakWater({fallsLandscape:{}},x,z),null);
 world.groundH=q.ownedSupportHeightAt;
 assert.equal(readOwnedHollowpeakWater(world,0,0),null,'Exclusion padding is not a water surface');
});
