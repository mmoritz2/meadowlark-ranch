import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {auditChannelLateralContainment,subtractIntervals} from './channel-lateral-containment.mjs';

const runtime=process.env.RANCH_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url));
const fixture=new URL('./fixtures/hollowpeak-spillway-bank-66c7cba/',import.meta.url);
const read=f=>fs.readFileSync(f,'utf8'),json=f=>JSON.parse(read(f));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const url=f=>pathToFileURL(path.join(runtime,f)).href;
const meta=json(new URL('established-native.json',fixture));
const maskBytes=fs.readFileSync(new URL('protected-support.json',fixture)),mask=JSON.parse(maskBytes);
const helperOwner=process.env.HOLLOWPEAK_SPILLWAY_SOURCE||path.join(runtime,'assets/hollowpeak-spillway-bank.mjs');
const fallsOwner=process.env.HOLLOWPEAK_SPILLWAY_FALLS_SOURCE||path.join(runtime,'assets/falls-landscape.js');
const helperSource=read(helperOwner),fallsSource=read(fallsOwner);
const importEdge="import {sculptSpillwayBankRelief} from './hollowpeak-spillway-bank.mjs?v=hollowpeak-spillway-bank-4';\n";
const wrapper='export function fallsRelief(x,z){return sculptSpillwayBankRelief(x,z,establishedFallsRelief(x,z));}\n';
const privateName='function establishedFallsRelief(x,z){',publicName='export function fallsRelief(x,z){';
function once(s,a,b){assert.equal(s.split(a).length,2,'One exact additive source edge: '+a);return s.replace(a,b);}
function recoverEstablished(s){
 assert(s.startsWith(importEdge),'Prepend-only physical helper import');s=s.slice(importEdge.length);
 s=once(s,wrapper,'');s=once(s,privateName,publicName);
 assert.equal(sha(s),meta.sourceOwnersSHA256['falls-landscape.js'],'Complete established falls owner, including every early return, remains exact');return s;
}
const establishedSource=recoverEstablished(fallsSource);
function moduleURL(s,owner,resolve=()=>null){return'data:text/javascript;base64,'+Buffer.from(s.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,spec)=>'from '+JSON.stringify(resolve(spec)||new URL(spec,owner).href))).toString('base64');}
// Dependencies resolve against the runtime repository, even when only these
// two candidate owners are explicitly routed from a staging directory.
const runtimeFalls=pathToFileURL(path.join(runtime,'assets/falls-landscape.js'));
const helperURL=moduleURL(helperSource,pathToFileURL(helperOwner));
const H=await import(helperURL),A=await import(moduleURL(establishedSource,runtimeFalls));
const B=await import(moduleURL(fallsSource,runtimeFalls,s=>s.startsWith('./hollowpeak-spillway-bank.mjs')?helperURL:null));
const T=await import(url('assets/vendor/three/build/three.module.js'));
const {pastureRise}=await import(url('assets/pastoral-fields.mjs'));
const {canyonRelief,canyonMacroPlanningRelief}=await import(url('assets/canyon-landscape.js'));
const {oasisTerrainHeight}=await import(url('assets/oasis-art.js'));
const {configureRiverBanks,legacyRiverBankHeight,riverBankTerrainHeight}=await import(url('assets/riverbank-terrain.mjs'));
const {loonLakeTerrainHeight,legacyLoonLakeTerrainHeight}=await import(url('assets/loon-lake.mjs'));
const {createHollowpeakPlacementPlan,legacyFallsTerrainHeight}=await import(url('assets/hollowpeak-placement-reference.mjs'));
const {buildHollowpeakShoreData}=await import(url('assets/hollowpeak-shore.mjs'));
const {createWaterfallArt}=await import(url('assets/waterfall-art.js'));
const {exactSweptClearance}=await import(url('tools/terrain-water-contact.mjs'));
const html=read(path.join(runtime,'ranch3d.html')),start=html.indexOf('function ihash(ix,iz){'),end=html.indexOf('/* ===== Roads =====');
assert(start>=0&&end>start);const rawSource=html.slice(start,end);
const raw=F=>new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight','loonLakeTerrainHeight',rawSource+'return rawH;')(T,pastureRise,canyonRelief,oasisTerrainHeight,F,riverBankTerrainHeight,loonLakeTerrainHeight);
const oldRaw=raw(A.fallsTerrainHeight),newRaw=raw(B.fallsTerrainHeight),legacyRaw=raw(legacyFallsTerrainHeight);
configureRiverBanks({terrainStep:meta.step,rawHeightAt:(x,z)=>oldRaw(x,z,A.fallsTerrainHeight,canyonMacroPlanningRelief,legacyRiverBankHeight,legacyLoonLakeTerrainHeight),heightAt:()=>{throw Error('Unexpected river reference fallback');}});
const nativeGzip=fs.readFileSync(new URL('canonical-terrain.f32.gz',fixture)),nativeBytes=gunzipSync(nativeGzip);
const before=new Float32Array(nativeBytes.buffer,nativeBytes.byteOffset,nativeBytes.byteLength/4),afterGrid=before.slice();
const oldGrid=new Float32Array(before.length),newGrid=new Float32Array(before.length),{step,size:N}=meta;
const eligible=new Set(mask.domains.find(d=>d.name==='expanded-connected-bank-study').capConnectedKeys.map(([ix,iz])=>iz*N+ix));
const protectedNodes=new Set(mask.protectedNodes.map(p=>p.iz*N+p.ix));
const changes=[],rawNativeDifferences=[];
let terrainRandomCalls=0;const ambient=Math.random;Math.random=()=>{terrainRandomCalls++;throw Error('Physical field consumed ambient RNG');};
try{for(let iz=0;iz<N;iz++)for(let ix=0;ix<N;ix++){
 const i=iz*N+ix,x=ix*step-500,z=iz*step-500;oldGrid[i]=oldRaw(x,z);newGrid[i]=newRaw(x,z);
 if(before[i]!==oldGrid[i])rawNativeDifferences.push(i);
 if(newGrid[i]!==oldGrid[i]){changes.push({i,ix,iz,x,z,before:before[i],after:newGrid[i],drop:oldGrid[i]-newGrid[i]});afterGrid[i]=newGrid[i];}
}}finally{Math.random=ambient;}
function sample(grid,x,z){
 assert(x>-500&&x<500&&z>-500&&z<500,'Proof sample stays inside actual canonical terrain');
 const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*N+ix;
 const a=grid[i],b=grid[i+N],c=grid[i+N+1],d=grid[i+1];
 return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
}
const oldHeight=(x,z)=>sample(before,x,z),height=(x,z)=>sample(afterGrid,x,z);
function controlled(fn){const previous=Math.random;let state=0x3174e9b2,draws=0;Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const value=fn(),count=draws,future=Array.from({length:16},()=>Math.random());return{value,draws:count,future};}finally{Math.random=previous;}}
function build(F,heightAt){return controlled(()=>{const scene=new T.Scene(),colliders=[],waterMaterial=new T.MeshPhysicalMaterial();waterMaterial.userData.plainShader=()=>{};return{scene,colliders,waterMaterial,landscape:F.createFallsLandscape({THREE:T,scene,heightAt,terrainStep:step,waterMaterial,colliders,loadTextures:false})};});}
const builtA=build(A,oldHeight),builtB=build(B,height),shoreA=buildHollowpeakShoreData(oldHeight),shoreB=buildHollowpeakShoreData(height);
const stats={scope:'Current66 native final terrain plus complete current raw differential. Physical regression only; no native art-quality claim.',baselineCommit:meta.baselineCommit,sources:{helper:sha(helperSource),falls:sha(fallsSource),establishedFalls:sha(establishedSource),raw:sha(rawSource)},canonicalBeforeSHA256:sha(nativeBytes),canonicalAfterSHA256:sha(bytes(afterGrid)),rawBeforeSHA256:sha(bytes(oldGrid)),rawAfterSHA256:sha(bytes(newGrid)),changedNodes:changes.length,changes,maximumDrop:Math.max(0,...changes.map(c=>c.drop)),lateRemotePatchNodes:rawNativeDifferences.length,terrainRandomCalls,liveTopChanges:[],wood:[]};

test('one additive falls wrapper retains the complete established owner and all six prior physical module owners',()=>{
 assert.equal(H.HOLLOWPEAK_SPILLWAY_BANK_PROFILE,'hollowpeak-spillway-bank-4');assert.equal(H.HOLLOWPEAK_SPILLWAY_MAX_CUT,7);
 assert.deepEqual(H.HOLLOWPEAK_SPILLWAY_CHANNEL,A.HOLLOWPEAK.channel,'Calibrated bank-floor stations remain bound to the authoritative fixed watercourse');
 assert(Object.isFrozen(H.HOLLOWPEAK_SPILLWAY_CHANNEL)&&H.HOLLOWPEAK_SPILLWAY_CHANNEL.every(Object.isFrozen));
 assert.equal(recoverEstablished(importEdge+once(establishedSource,publicName,privateName).replace('export function fallsTerrainHeight(x,z,height){',wrapper+'export function fallsTerrainHeight(x,z,height){')),establishedSource);
 assert.throws(()=>recoverEstablished(fallsSource.replace('establishedFallsRelief(x,z));','establishedFallsRelief(x+1,z));')),/One exact additive source edge/);
 for(const[owner,expected]of Object.entries(meta.sourceOwnersSHA256))if(owner!=='falls-landscape.js')assert.equal(sha(read(path.join(runtime,'assets',owner))),expected,owner+' remains byte-exact');
 assert.equal(sha(rawSource),meta.rawSourceSHA256);assert.deepEqual(B.HOLLOWPEAK,A.HOLLOWPEAK);assert.deepEqual(B.ALPINE_BOUNDS,A.ALPINE_BOUNDS);
});

test('the entire current raw field independently replays accepted native terrain with only the disclosed372 remote late-patch nodes',(t)=>{
 assert.equal(sha(nativeGzip),meta.nativeGzipSHA256);assert.equal(sha(nativeBytes),meta.nativeCanonicalSHA256);assert.equal(before.length,N*N);
 assert.equal(sha(maskBytes),meta.protectedSupportSHA256);assert.equal(mask.canonicalSHA256,meta.nativeCanonicalSHA256);
 const expectedRaw=before.slice();for(let j=0;j<meta.latePatch.rawToFinalMismatchIndices.length;j++)expectedRaw[meta.latePatch.rawToFinalMismatchIndices[j]]=meta.latePatch.rawValues[j];
 assert.equal(sha(bytes(expectedRaw)),meta.rawCanonicalSHA256);assert.deepEqual(oldGrid,expectedRaw,'Complete actual current66 raw reference');
 assert.deepEqual(rawNativeDifferences,meta.latePatch.rawToFinalMismatchIndices);assert.equal(rawNativeDifferences.length,372);
 for(const i of rawNativeDifferences){assert(i%N>=400&&i%N<=427&&Math.floor(i/N)>=400&&Math.floor(i/N)<=423);assert.equal(afterGrid[i],before[i]);}
 for(const i of eligible)assert.equal(oldGrid[i],before[i]);
 t.diagnostic(JSON.stringify({nativeSHA256:stats.canonicalBeforeSHA256,currentRawSHA256:stats.rawBeforeSHA256,remoteLatePatchNodes:rawNativeDifferences.length}));
});

test('the full canonical change stays in the connected201-node cap/face and preserves every protected/exterior/accepted-upper byte',(t)=>{
 assert.equal(eligible.size,201);assert(changes.length>20&&changes.length<=eligible.size,'A connected physical bank change survives Float32 packing');
 for(const c of changes){assert(eligible.has(c.i),`Outside cap-connected support${c.ix},${c.iz}`);assert(!protectedNodes.has(c.i),`Protected contact node${c.ix},${c.iz}`);assert.equal(c.before,oldGrid[c.i]);assert(Number.isFinite(c.after));assert(c.drop>0&&c.drop<=H.HOLLOWPEAK_SPILLWAY_MAX_CUT+2e-6);}
 for(let i=0;i<before.length;i++){if(protectedNodes.has(i)||!eligible.has(i))assert.equal(afterGrid[i],before[i]);if(Math.floor(i/N)*step-500< -329)assert.equal(afterGrid[i],before[i],'Accepted V6 upper field');}
 assert(stats.maximumDrop>1&&stats.maximumDrop<=7.000002);
 t.diagnostic(JSON.stringify({changedNodes:changes.length,maxPackedDrop:stats.maximumDrop,candidateCanonicalSHA256:stats.canonicalAfterSHA256}));
});

test('the continuous support protects closed cells and basal/exterior seams without ambient RNG or nonfinite values',()=>{
 const previous=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('Sculpt touched scene RNG');};
 try{
  for(const r of mask.nearBankProtectedRectanglesExactUnion)for(const x of[r.x0,(r.x0+r.x1)/2,r.x1])for(const z of[r.z0,(r.z0+r.z1)/2,r.z1]){assert.equal(H.spillwayBankSupport(x,z),0);assert.equal(H.sculptSpillwayBankRelief(x,z,100),100);}
  const b=H.HOLLOWPEAK_SPILLWAY_BANK_BOUNDS;
  for(const x of[b.x0-1,b.x0,(b.x0+b.x1)/2,b.x1,b.x1+1])for(const z of[b.z0-1,b.z0,(b.z0+b.z1)/2,b.z1,b.z1+1])for(const h of[-3,0,3,8,8.001,10,20,100]){
   const y=H.sculptSpillwayBankRelief(x,z,h),w=H.spillwayBankSupport(x,z);assert(Number.isFinite(y)&&w>=0&&w<=1);assert(y<=h&&y>=h-7-1e-12);if(h<=8||x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1)assert.equal(y,h);if(h>8)assert(y>=8);
  }
  for(let z=-287;z<=-228;z+=.71)for(let x=-150;x<=-123;x+=.67){const a=A.fallsRelief(x,z),b=B.fallsRelief(x,z);assert(Number.isFinite(b));assert.equal(a>3,b>3,'No new analytic3m low-foot crossing');if(a<=8)assert.equal(a,b);}
  assert.equal(draws,0);assert.equal(terrainRandomCalls,0);
 }finally{Math.random=previous;}
 for(const bad of[NaN,Infinity,-Infinity]){assert.throws(()=>H.spillwayBankSupport(bad,-250),/Finite/);assert.throws(()=>H.sculptSpillwayBankRelief(-139,-250,bad),/Finite/);assert.throws(()=>H.sculptSpillwayBankRelief(-139,bad,20),/Finite/);}
 const b=H.HOLLOWPEAK_SPILLWAY_BANK_BOUNDS,e=1e-4;
 for(const[x,z,dx,dz]of[[b.x0,-255,1,0],[b.x1,-255,1,0],[-139,b.z0,0,1],[-139,b.z1,0,1]])assert(Math.abs(H.sculptSpillwayBankRelief(x-dx*e,z-dz*e,100)-H.sculptSpillwayBankRelief(x+dx*e,z+dz*e,100))<1e-7,'Smooth compact outer seam');
});

test('actual wet/shore/route full-cell supports, all water buffers and the continuous animated waterfall sweep stay exact',(t)=>{
 for(const cell of mask.protectedCells)for(const[dx,dz]of[[0,0],[1,0],[0,1],[1,1]])assert.equal(afterGrid[(cell.iz+dz)*N+cell.ix+dx],before[(cell.iz+dz)*N+cell.ix+dx]);
 for(const key of['pool','tarn','stream']){
  const a=builtA.value.landscape[key],b=builtB.value.landscape[key],native=meta.nativeWaterFingerprints.find(p=>p.name===a.name);assert(native);
  assert.deepEqual(b.geometry.index.array,a.geometry.index.array);assert.equal(sha(bytes(new Uint32Array(a.geometry.index.array))),native.indexSHA256);assert.equal(a.geometry.index.count,native.indexCount);
  for(const[attr,data]of Object.entries(a.geometry.attributes)){assert.deepEqual(b.geometry.attributes[attr].array,data.array,key+':'+attr);if(native[attr+'SHA256']){assert.equal(sha(bytes(new Float32Array(data.array))),native[attr+'SHA256']);assert.equal(data.array.length,native[attr+'Count']);}}
 }
 assert.deepEqual(shoreB,shoreA,'Complete shore water/bank/terrainOwners');
 const F=B.HOLLOWPEAK,art=createWaterfallArt({THREE:T}),fall=art.fall({x:F.x,z:F.z,top:F.top,bottom:F.level+.04,width:F.width,run:F.run,name:'Hollowpeak Falls',flowProfile:'hollowpeak-cataract-1'}),g=fall.children[0].geometry;
 try{const args={position:g.attributes.position.array,index:g.index.array,motion:g.attributes.cascadeMotion.array,step};const a=exactSweptClearance({...args,height:oldHeight}),b=exactSweptClearance({...args,height});assert.deepEqual(a,meta.waterfallClearance);assert.deepEqual(b,a);stats.waterfall=b;}finally{const materials=new Set();fall.traverse(m=>{if(m.isMesh){m.geometry.dispose();materials.add(m.material);}});materials.add(art.material);for(const m of materials)m.dispose();}
 t.diagnostic(JSON.stringify({fixedWaterMeshes:3,completeShoreExact:true,continuousSweptClearance:stats.waterfall.min}));
});

test('all original3m interpolation edges and the complete native barrier ownership stay exact while live tops follow the revised field',(t)=>{
 let endpointSamples=0;for(const edge of mask.originalContourEdges)for(const p of edge.endpoints){assert.equal(A.fallsRelief(p.x,p.z),p.relief);assert.equal(B.fallsRelief(p.x,p.z),p.relief);assert.equal(height(p.x,p.z),oldHeight(p.x,p.z));endpointSamples++;}
 assert.equal(endpointSamples,598);
 const a=builtA.value.colliders,b=builtB.value.colliders;assert.deepEqual(a,meta.nativeBarriers,'Complete actual306 native barrier baseline');assert.equal(b.length,a.length);assert.equal(a.length,306);
 for(let i=0;i<a.length;i++){assert.deepEqual({...b[i],topY:a[i].topY},a[i],'BarrierXZ/radius/order/flags'+i);assert(b[i].topY<=a[i].topY+1e-6);assert(b[i].topY>=height(b[i].x,b[i].z));if(a[i].topY!==b[i].topY)stats.liveTopChanges.push({index:i,x:a[i].x,z:a[i].z,before:a[i].topY,after:b[i].topY});}
 t.diagnostic(JSON.stringify({originalContourEndpointSamples:endpointSamples,barriers:b.length,changedLiveTopY:stats.liveTopChanges.length,maxTopDrop:Math.max(0,...stats.liveTopChanges.map(p=>p.before-p.after))}));
});

test('all three native source-wood foot triangles and complete normal fans retain their shared placement support',(t)=>{
 assert.equal(meta.wood.totalNativeTreeRows,2779);assert.deepEqual(meta.wood.rows.map(t=>t.id),[385,2651,2665]);
 for(const tree of meta.wood.rows){
  const proof=mask.woodNormalFanSupports.find(p=>p.id===tree.id);assert(proof);assert.deepEqual(proof.matrix,tree.matrix);assert.deepEqual(proof.footBounds,tree.foot.footBounds);
  // One full cell ring around every actual lowest22cm source-wood AABB cell
  // preserves every foot triangle and every incident face of its vertex normals.
  for(const[ix,iz]of proof.baseCells)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)assert(proof.protectedNormalFanCells.some(p=>p[0]===ix+dx&&p[1]===iz+dz));
  for(const[ix,iz]of proof.protectedNormalFanCells)for(const[dx,dz]of[[0,0],[1,0],[0,1],[1,1]])assert.equal(afterGrid[(iz+dz)*N+ix+dx],before[(iz+dz)*N+ix+dx]);
  const fb=tree.foot.footBounds;for(const x of[fb.x0,(fb.x0+fb.x1)/2,fb.x1])for(const z of[fb.z0,(fb.z0+fb.z1)/2,fb.z1])assert.equal(height(x,z),oldHeight(x,z));
  for(const[dx,dz]of[[0,0],[-1,0],[1,0],[0,-1],[0,1]]){assert.equal(height(tree.x+dx,tree.z+dz),oldHeight(tree.x+dx,tree.z+dz));assert.equal(B.fallsRelief(tree.x+dx,tree.z+dz),A.fallsRelief(tree.x+dx,tree.z+dz));}
  const[x,y,z]=tree.foot.worst.point;assert.equal(y-height(x,z),tree.foot.maxGapM);stats.wood.push({id:tree.id,normalFanCells:proof.protectedNormalFanCells.length,maximumGapBefore:tree.foot.maxGapM,maximumGapAfter:y-height(x,z)});
 }
 t.diagnostic(JSON.stringify(stats.wood));
});

test('rock and shadow use the same revised triangles with stable owners/resources and unchanged constructor RNG suffix',(t)=>{
 assert.equal(builtA.draws,builtB.draws);assert.deepEqual(builtA.future,builtB.future);
 const inventory=x=>{const rows=[];x.traverse(m=>rows.push([m.type,m.name,m.children.length,m.isMesh?m.material.type:null,m.isMesh?m.geometry.attributes.position.count:null]));return rows;};
 assert.deepEqual(inventory(builtB.value.scene),inventory(builtA.value.scene),'No extra scene, geometry or material owners');
 stats.renderStats={};
 for(const key of['rock','shadow']){
  const a=builtA.value.landscape[key].geometry,b=builtB.value.landscape[key].geometry,p=b.attributes.position,n=b.attributes.normal;assert.equal(p.count,a.attributes.position.count);
  for(let i=0;i<p.count;i++){assert.equal(p.getX(i),a.attributes.position.getX(i));assert.equal(p.getZ(i),a.attributes.position.getZ(i));assert(Math.abs(p.getY(i)-height(p.getX(i),p.getZ(i))-.012)<1e-5);}
  for(const i of new Set(b.index.array)){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert(Number.isFinite(length)&&Math.abs(length-1)<2e-6);}
  if(key==='shadow')assert.deepEqual(b.index.array,a.index.array);
  stats.renderStats[key]={vertices:p.count,trianglesBefore:a.index.count/3,trianglesAfter:b.index.count/3};
 }
 stats.constructorRandomCalls=builtA.draws;t.diagnostic(JSON.stringify({render:stats.renderStats,constructorRandomCalls:builtA.draws,terrainRandomCalls}));
});

test('historical planting positions, planning occupancy and RNG remain independent of the physical bank',()=>{
 const historical=(x,z)=>legacyRaw(x,z,legacyFallsTerrainHeight,canyonRelief,legacyRiverBankHeight,legacyLoonLakeTerrainHeight);
 const a=controlled(()=>createHollowpeakPlacementPlan({rawHeightAt:historical,heightAt:oldHeight,terrainStep:step})),b=controlled(()=>createHollowpeakPlacementPlan({rawHeightAt:historical,heightAt:height,terrainStep:step}));
 assert.equal(a.draws,0);assert.equal(b.draws,0);assert.deepEqual(a.future,b.future);assert.deepEqual(a.value.stats,b.value.stats);assert.deepEqual(a.value.collidersForPlanning([],[]),b.value.collidersForPlanning([],[]));
 for(let z=-430;z<-198;z+=2.21)for(let x=-290;x<-17;x+=2.17)assert.equal(a.value.heightAt(x,z),b.value.heightAt(x,z));stats.historicalPlanning=a.value.stats;
});

test('continuous lateral bank containment survives the full canonical blends, with only the explicit baseline waterfall-lip exception',(t)=>{
 const policy=meta.lateralContainment,positions=builtA.value.landscape.stream.geometry.attributes.position.array;
 const options={before,after:afterGrid,positions,size:N,step,outwardM:policy.outwardM,endpointLipM:policy.endpointLipM,thresholds:[0,policy.minimumCoreFreeboardM]};
 const report=auditChannelLateralContainment(options);
 function equalIntervals(actual,expected){assert.equal(actual.length,expected.length);for(let i=0;i<actual.length;i++)for(let j=0;j<2;j++)assert(Math.abs(actual[i][j]-expected[i][j])<1e-8);}
 for(const side of['west','east']){
  const r=report.sides[side],core=[[r.zDomain[0],r.lastLip[0]]];
  for(const threshold of options.thresholds){const support=r.thresholds[threshold];
   equalIntervals(support.beforeSupportedZ,policy.baselineSupportedZ[side][threshold]);
   assert.deepEqual(subtractIntervals(core,support.afterSupportedZ),[],`${side} bank keeps physical${threshold}m freeboard continuously, including between source-water rows`);
   assert.deepEqual(support.newLostCoreZ,[],`${side} loses no prior containment outside the final${policy.endpointLipM}m lip`);
   for(const[a,b]of support.baselineUnsupportedZ)assert(a>=r.lastLip[0]&&b<=r.lastLip[1],'The accepted unsupported baseline is confined to the published waterfall lip');
  }
 }
 // The compact delta reconstructs the actual rejected first trial. This
 // negative control catches the exact missing condition that wet-underlay
 // and water-buffer preservation alone previously failed to detect.
 const rejected=before.slice();for(const[i,value]of policy.rejectedV1.compactNativeDelta)rejected[i]=value;
 assert.equal(sha(bytes(rejected)),policy.rejectedV1.canonicalSHA256);
 const regression=auditChannelLateralContainment({...options,after:rejected});
 equalIntervals(regression.sides.east.thresholds[0].newLostCoreZ,policy.rejectedV1.expectedEastLostCoreZ);
 const lost=regression.sides.east.thresholds[0].newLostCoreZ;assert(lost.reduce((sum,[a,b])=>sum+b-a,0)>6,'The rejected candidate has a genuine long perched segment');
 assert.deepEqual(regression.sides.west.thresholds[0].newLostCoreZ,[]);
 assert.equal(sha(bytes(before)),stats.canonicalBeforeSHA256);assert.equal(sha(bytes(afterGrid)),stats.canonicalAfterSHA256,'The audit never changes either physical field');
 stats.channelLateralContainment=report;stats.rejectedV1ChannelCoreLoss=lost;
 t.diagnostic(JSON.stringify({bothBanksCoreFreeboardM:policy.minimumCoreFreeboardM,explicitLipM:policy.endpointLipM,clippedTriangles:report.sides.west.clippedTriangles+report.sides.east.clippedTriangles,rejectedV1EastLostCoreZ:lost}));
});

test('the finite channel bank rolls into its lower dry face without spending the prior water-core support',(t)=>{
 const prior=json(new URL('./fixtures/hollowpeak-spillway-bank-v3-endpoint.json',import.meta.url)),v3=before.slice(),planeOnly=before.slice();
 assert.equal(prior.canonicalBeforeSHA256,stats.canonicalBeforeSHA256);
 for(const[i,value]of prior.priorV3CompactNativeDelta)v3[i]=value;
 assert.equal(sha(bytes(v3)),prior.priorV3CanonicalSHA256,'Actual prior native cohort is reconstructed independently');
 for(const[i,value]of meta.lateralContainment.rejectedV1.compactNativeDelta)planeOnly[i]=value;
 const courseEnd=A.HOLLOWPEAK.channel.at(-1)[1],landingEnd=courseEnd+prior.endpointPolicy.dryLandingM,rollEnd=landingEnd+prior.endpointPolicy.retentionEndRollCells*step;
 const lastPreservedRow=Math.floor((landingEnd+500)/step),delta=[],streamPositions=builtA.value.landscape.stream.geometry.attributes.position;
 const nativeChannelEndZ=streamPositions.getZ(streamPositions.count-1);
 for(let i=0;i<before.length;i++){
  const iz=Math.floor(i/N),z=iz*step-500;
  if(iz<=lastPreservedRow)assert.equal(afterGrid[i],v3[i],'Entire actual channel/side-belt canonical input stays exactly priorV3');
  if(z>=rollEnd)assert.equal(afterGrid[i],planeOnly[i],'Retained finite-channel bank cannot extend past the two-cell end roll');
  if(afterGrid[i]!==v3[i]){assert(afterGrid[i]<v3[i],'The forward correction only removes unneeded bank retention');assert((iz-1)*step-500>nativeChannelEndZ,'Every changed incident triangle is south of the finite source mesh');delta.push({ix:i%N,iz,before:v3[i],after:afterGrid[i]});}
 }
 assert(delta.length>0,'The prior unbounded forward bank is an explicit negative control, not an accepted no-op');
 const positions=builtA.value.landscape.stream.geometry.attributes.position.array,options={before:v3,after:afterGrid,positions,size:N,step,outwardM:meta.lateralContainment.outwardM,endpointLipM:meta.lateralContainment.endpointLipM,thresholds:[0,meta.lateralContainment.minimumCoreFreeboardM]};
 const lateral=auditChannelLateralContainment(options);
 for(const side of['west','east'])for(const value of Object.values(lateral.sides[side].thresholds))assert.deepEqual(value.afterSupportedZ,value.beforeSupportedZ,'The complete continuous bank-support intervals are exactly priorV3');
 stats.finiteChannelEndpoint={priorV3CanonicalSHA256:prior.priorV3CanonicalSHA256,courseEnd,landingEnd,rollEnd,lastPreservedRow,changes:delta};
 t.diagnostic(JSON.stringify({priorV3CanonicalSHA256:prior.priorV3CanonicalSHA256,forwardOnlyChangedNodes:delta.length,lastPreservedRow,continuousChannelSupportExact:true}));
});

after(()=>{
 if(process.env.HOLLOWPEAK_SPILLWAY_AUDIT_OUTPUT)fs.writeFileSync(process.env.HOLLOWPEAK_SPILLWAY_AUDIT_OUTPUT,JSON.stringify(stats,null,2)+'\n');
 for(const built of[builtA,builtB]){const geometry=new Set(),materials=new Set([built.value.waterMaterial]);built.value.scene.traverse(m=>{if(m.isMesh){geometry.add(m.geometry);materials.add(m.material);}});for(const g of geometry)g.dispose();for(const m of materials)m.dispose();}
});
