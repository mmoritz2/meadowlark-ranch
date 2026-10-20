import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createWaterJointProof,validatePhysicalProof,recoverEstablishedFalls,bytes,sha,fingerprints} from './water-joint-physical-proof.mjs';

const p=await createWaterJointProof(),{meta,H,stats:s}=p,N=meta.size,step=meta.step;
const observationBytes=fs.readFileSync(new URL('native-resident-baseline.json',p.fixture)),observation=JSON.parse(observationBytes);
const treeGzip=fs.readFileSync(new URL('native-tree-inventory.json.gz',p.fixture)),treeRows=JSON.parse(gunzipSync(treeGzip));
after(()=>{if(process.env.TERMINAL_WATER_PROOF_OUT){const out=process.env.TERMINAL_WATER_PROOF_OUT;assert(!fs.existsSync(out),'Do not replace a frozen proof');fs.writeFileSync(out,JSON.stringify(s,null,2)+'\n');}p.dispose();});

test('one post-height wrapper preserves the complete accepted367 source, watercourse, owners and early returns',()=>{
 assert.equal(H.HOLLOWPEAK_TERMINAL_BED_PROFILE,'terminal-water-bed-1');assert.equal(sha(p.establishedSource),meta.sourceOwnersSHA256['falls-landscape.js']);
 assert.deepEqual(H.HOLLOWPEAK_TERMINAL_BED_COURSE,p.A.HOLLOWPEAK.channel.slice(-2));assert(Object.isFrozen(H.HOLLOWPEAK_TERMINAL_BED_COURSE)&&H.HOLLOWPEAK_TERMINAL_BED_COURSE.every(Object.isFrozen));
 assert.deepEqual(p.B.HOLLOWPEAK,p.A.HOLLOWPEAK);assert.deepEqual(p.B.ALPINE_BOUNDS,p.A.ALPINE_BOUNDS);
 for(const[owner,expected]of Object.entries(meta.sourceOwnersSHA256))if(owner!=='falls-landscape.js')assert.equal(sha(fs.readFileSync(path.join(p.runtime,'assets',owner))),expected,owner);
 assert.throws(()=>recoverEstablishedFalls(p.fallsSource.replace('establishedFallsTerrainHeight(x,z,height));','establishedFallsTerrainHeight(x+1,z,height));'),meta.sourceOwnersSHA256['falls-landscape.js']),/exact additive source edge/);
 assert.equal(s.moduleRandomCalls,0);assert.equal(sha(p.rawSource),meta.rawSourceSHA256);
});

test('all263169 current raw heights replay native9a02 with only the exact372 inherited distant late patches',(t)=>{
 assert.equal(sha(p.gzip),meta.nativeGzipSHA256);assert.equal(sha(p.nativeBytes),meta.nativeCanonicalSHA256);assert.equal(p.before.length,N*N);
 assert.deepEqual(p.oldGrid,p.expectedRaw);assert.equal(sha(bytes(p.oldGrid)),meta.rawCanonicalSHA256);assert.deepEqual(p.rawNativeDifferences,meta.latePatch.rawToFinalMismatchIndices);assert.equal(p.rawNativeDifferences.length,372);
 for(const i of p.rawNativeDifferences){assert(i%N>=400&&i%N<=427&&Math.floor(i/N)>=400&&Math.floor(i/N)<=423);assert.equal(p.after[i],p.before[i]);}
 assert.equal(s.terrainRandomCalls,0);t.diagnostic(JSON.stringify({baseline:s.canonicalBeforeSHA256,candidate:s.canonicalAfterSHA256,rawBefore:s.rawBeforeSHA256,rawAfter:s.rawAfterSHA256}));
});

test('the measured wet/flank cohort owns every changed vertex and complete incident cell while forward pool and V4 dry bank stay exact',(t)=>{
 const allowed=new Set(meta.ownedWetNodes.map(([x,z])=>z*N+x)),changed=new Set(p.changes.map(c=>c.i));assert.equal(allowed.size,15);assert(p.changes.length>0);assert.deepEqual(p.ownedCells,meta.ownedIncidentCells);
 for(const c of p.changes){assert(allowed.has(c.i),`Unreviewed canonical change ${c.ix},${c.iz}`);assert(c.rise>0&&c.rise<=meta.policy.maximumAbsoluteRiseM+2e-6);assert.equal(p.before[c.i],p.oldGrid[c.i]);}
 for(let i=0;i<p.before.length;i++)if(!allowed.has(i))assert.equal(p.after[i],p.before[i]);
 let intentionalOldWetOwners=0;for(const[ix,iz]of meta.oldV9ProtectedNodes){const i=iz*N+ix;if(changed.has(i))intentionalOldWetOwners++;else assert.equal(p.after[i],p.before[i]);}assert(intentionalOldWetOwners>0,'This is explicitly a new wet cohort; the V9 protected-wet golden is not silently reused');
 for(let iz=0;iz<N;iz++)for(let ix=0;ix<N;ix++){const i=iz*N+ix;if(iz<=130||iz>=133||ix>=183)assert.equal(p.after[i],p.before[i]);}
 for(const c of p.changes)for(const[dx,dz]of[[-1,-1],[-1,0],[0,-1],[0,0]])assert(p.ownedCells.some(q=>q[0]===c.ix+dx&&q[1]===c.iz+dz));
 t.diagnostic(JSON.stringify({nodes:p.changes.length,incidentCells:p.ownedCells.length,bounds:s.continuousPhysicalBounds,maxRise:s.maximumRise}));
});

test('the finite continuous helper has smooth compact seams, finite guarded inputs and bounded pure upward support',()=>{
 const b=H.HOLLOWPEAK_TERMINAL_BED_BOUNDS,old=Math.random;let calls=0;Math.random=()=>{calls++;throw Error('Terminal joint touched ambient RNG');};
 try{
  for(const x of[b.x0-1,b.x0,-157.5,-150,-142.5,b.x1,b.x1+1])for(const z of[b.z0-1,b.z0,-244.35,-242.2,-242.1,b.z1,b.z1+1])for(const h of[-3,0,3,8,14,30,100]){const w=H.terminalBedSupport(x,z),y=H.seatHollowpeakTerminalWaterBed(x,z,h);assert(Number.isFinite(w)&&w>=0&&w<=1);assert(Number.isFinite(y)&&y>=h&&y<=h+12+1e-12);if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1)assert.equal(y,h);}
  assert.equal(calls,0);
 }finally{Math.random=old;}
 for(const bad of[NaN,Infinity,-Infinity]){assert.throws(()=>H.terminalBedSupport(bad,-243),/Finite/);assert.throws(()=>H.terminalWaterLevel(bad),/Finite/);assert.throws(()=>H.seatHollowpeakTerminalWaterBed(-150,-243,bad),/Finite/);}
 const e=1e-4;for(const[x,z,dx,dz]of[[b.x0,-243,1,0],[b.x1,-243,1,0],[-150,b.z0,0,1],[-150,b.z1,0,1]])assert(Math.abs(H.seatHollowpeakTerminalWaterBed(x-dx*e,z-dz*e,0)-H.seatHollowpeakTerminalWaterBed(x+dx*e,z+dz*e,0))<1e-7,'No compact seam height step');
 for(let z=-249;z<=-239;z+=.125){const a=H.HOLLOWPEAK_TERMINAL_BED_COURSE[0],b=H.HOLLOWPEAK_TERMINAL_BED_COURSE[1],u=Math.max(0,Math.min(1,(z-a[1])/(b[1]-a[1])));assert.equal(H.terminalWaterLevel(z),a[2]+u*(b[2]-a[2]));}
});

test('every conservative animated facet clears the new shallow joint and preserves the stronger unchanged-exterior contract',(t)=>{
 for(const key of['min','worst','triangles','facets','emptyFacets','clippedVertices'])assert.deepEqual(s.water.sweepBefore[key],meta.waterfallClearance[key]);
 assert(s.water.sweepAfter.min>=meta.policy.minimumOwnedMovingWaterClearanceM);assert.equal(s.water.sweepAfter.outsideMin,s.water.sweepBefore.outsideMin);assert(s.water.sweepAfter.outsideMin>=meta.policy.minimumExteriorMovingWaterClearanceM-1e-12);assert.equal(s.water.sweepAfter.outsideFieldChanges,0);
 assert.equal(s.water.sweepAfter.emptyFacets,0);assert.equal(s.water.sweepAfter.clippedVertices,50904);assert(s.water.rootGapAfter.min>=.075&&s.water.rootGapAfter.max<=meta.policy.maximumRootGapM);
 assert(s.water.rootGapBefore.min>8&&s.water.rootGapBefore.max>10,'Old cutaway before-state fails the actual root-seating criterion');
 t.diagnostic(JSON.stringify({minimum:s.water.sweepAfter.min,exteriorMinimum:s.water.sweepAfter.outsideMin,root:s.water.rootGapAfter,cutawayBefore:s.water.rootGapBefore}));
});

test('fixed source/fall/pool/tarn geometry and motion remain exact, with source clearance and pool cores protected',()=>{
 for(const key of['stream','pool','tarn']){const a=p.builtA.value.landscape[key],b=p.builtB.value.landscape[key],native=meta.nativeWaterFingerprints.find(w=>w.name===a.name);assert(native);assert.deepEqual(a.geometry.index.array,b.geometry.index.array);assert.equal(sha(bytes(new Uint32Array(a.geometry.index.array))),native.indexU32SHA256);for(const[k,v]of Object.entries(a.geometry.attributes)){assert.deepEqual(b.geometry.attributes[k].array,v.array);if(native.attributes[k])assert.equal(sha(bytes(v.array)),native.attributes[k].sha256);}}
 for(const[k,v]of Object.entries(meta.nativeWaterfallGeometry.attributes))assert.equal(sha(bytes(p.geometry.attributes[k].array)),v.sha256);
 assert(s.water.fixedWaterClearance.stream.after.min>=.075);for(const key of['pool','tarn','reflectingPool']){assert.deepEqual(s.water.fixedWaterClearance[key].after,s.water.fixedWaterClearance[key].before);assert(s.water.fixedWaterClearance[key].after.min>0);}
 assert.deepEqual(p.shoreB.water,p.shoreA.water,'Entire reflecting-water source payload exact');
});

test('actual awaited native shore normals match source replay; every re-clipped payload is explicitly owned and exterior contact is exact',(t)=>{
 assert.equal(sha(observationBytes),meta.nativeObservationSHA256);assert.equal(observation.files['canonical-terrain.bin'],meta.nativeCanonicalSHA256);assert.equal(observation.shore.status,'ready');assert(observation.shore.actualReadyPromiseResolved&&observation.shore.hookSameInstalledState&&observation.shore.contact.registered);
 assert.equal(sha(fs.readFileSync(new URL('shore-source-baseline.json',p.fixture))),meta.shoreFixtureSHA256);assert.deepEqual(fingerprints(p.shoreA.bank),p.shoreFixture.sourceData.bank);assert.deepEqual(fingerprints(p.installedA.bank),p.shoreFixture.expectedInstalled.bank);
 assert.deepEqual(p.shoreA.terrainOwners,observation.shore.terrainOwners);for(const[key,name]of[['bank','Hollowpeak shore | shoals'],['water','Hollowpeak shore | reflecting plunge water']]){const mesh=observation.shore.meshes.find(m=>m.name===name),expected=fingerprints(p.installedA[key]);assert(mesh);for(const[k,v]of Object.entries(expected))assert.equal(k==='index'?mesh.index.sha256:mesh.attributes[k].sha256,v.sha256,'Native installed '+key+' '+k);}
 for(const point of observation.shore.contact.receiptPoints){assert.equal(p.oldHeight(point.x,point.z),point.terrain);const y=p.contactA(point.x,point.z);assert.equal(Number.isFinite(y)?y:null,point.shore.finite?point.shore.value:null);}
 const allowed=new Set(meta.policy.allowedShoreOwnerGroups.map(q=>q.join(',')));for(const g of s.shore.changedOwnerGroups){assert(allowed.has(g.owner.join(',')));const[ix,iz]=g.owner;for(const group of[g.before,g.after])if(group)for(const face of group.faces)for(const vertex of face.payload){assert(vertex[0]>=ix*step-500-1e-5&&vertex[0]<=(ix+1)*step-500+1e-5);assert(vertex[2]>=iz*step-500-1e-5&&vertex[2]<=(iz+1)*step-500+1e-5);}}
 assert.equal(s.shore.outsideContactChanges,0);assert(s.shore.sourceFacesOutside>5000);assert(s.shore.reflectingWaterExact);assert.equal(s.shore.receiptContacts.length,46);
 t.diagnostic(JSON.stringify({faces:[s.shore.facesBefore,s.shore.facesAfter],changedGroups:s.shore.changedOwnerGroups.map(g=>({owner:g.owner,before:g.before?.triangles||0,after:g.after?.triangles||0})),outsideContactChanges:0}));
});

test('both banks retain continuous V4 containment and freeboard, including the pre-existing finite lip exception',()=>{
 assert.equal(p.lateral.rows,88);for(const side of Object.values(p.lateral.sides))for(const[threshold,result]of Object.entries(side.thresholds)){assert.deepEqual(result.newLostContainmentZ,[]);assert.deepEqual(result.newLostCoreZ,[]);if(Number(threshold)===.15)assert(result.afterSupportedZ.length);}
 assert(p.lateral.sides.west.thresholds['0'].baselineUnsupportedZ.length,'The inherited west terminal lip is recorded rather than falsely classified as a regression');
});

test('measured source wood normal fans stay exact and the adjacent taller pine is excluded by an actual shared-source foot bound',()=>{
 for(const t of s.wood){assert(t.normalFanExact);for(const q of t.supports)assert.equal(q.after,q.before);}
 assert.equal(sha(treeGzip),observation.treeInventory.gzipSHA256);assert.equal(treeRows.length,2779);assert.equal(sha(JSON.stringify(treeRows)),observation.treeInventory.sourceInventorySHA256);
 const nearby=treeRows.filter(t=>t.x>=-175&&t.x<=-130&&t.z>=-263&&t.z<=-225);assert.deepEqual(nearby.map(t=>t.id),[368,385]);
 const a=meta.wood.rows.find(t=>t.id===385),b=treeRows.find(t=>t.id===368);assert.equal(a.source,b.source);const f=a.foot.footBounds,sourceRadius=Math.max(...[f.x0,f.x1].flatMap(x=>[f.z0,f.z1].map(z=>Math.hypot(x-a.x,z-a.z))))/Math.hypot(a.matrix[0],a.matrix[2]),radius=sourceRadius*Math.hypot(b.matrix[0],b.matrix[2]);
 assert(.22/b.matrix[5]<=.22/a.matrix[5],'Taller native transform uses a subset of the measured source foot band');
 const bounds={x0:b.x-radius-1,x1:b.x+radius+1,z0:b.z-radius-1,z1:b.z+radius+1};for(const[ix,iz]of p.ownedCells){const x=ix*step-500,z=iz*step-500;assert(bounds.x1<x||bounds.x0>x+step||bounds.z1<z||bounds.z0>z+step,'Actual368 root plus1m grade margin cannot touch the new incident-cell field');}
});

test('physical render meshes, all306 live barriers, low-foot endpoints and ambient RNG retain their established ownership',()=>{
 validatePhysicalProof(p);assert(s.pass);assert.deepEqual(p.builtB.value.colliders,p.builtA.value.colliders);assert.deepEqual(p.builtA.value.colliders,meta.nativeBarriers);assert.equal(p.builtA.draws,p.builtB.draws);assert.deepEqual(p.builtA.future,p.builtB.future);
 for(const name of['rock','shadow']){const a=p.builtA.value.landscape[name].geometry,b=p.builtB.value.landscape[name].geometry;assert.equal(a.attributes.position.count,b.attributes.position.count);assert.equal(s.renderStats[name].positionsChanged,p.changes.length);assert.equal(b.index.count,a.index.count);}
 assert.equal(s.renderStats.shadow.indexExact,true);
});

test('a forward-row overextension passes falling-water clearance but fails the independently clipped reflecting-pool core gate',()=>{
 const bad=p.after.slice();for(const[ix,iz]of meta.negativeControls.forwardRow133Bed.nodes)bad[iz*N+ix]=meta.negativeControls.forwardRow133Bed.absoluteHeightM;const height=(x,z)=>p.sample(bad,x,z),fall=p.scopedSweep(height),pool=p.staticClearance(p.shoreB.water,height,.91);
 assert(fall.min>=.075,'Fall-only test is insufficient to protect the basin');assert(pool.min<-.5,'The reflecting-water gate detects a real pool obstruction');assert(s.water.fixedWaterClearance.reflectingPool.after.min>0);
});
