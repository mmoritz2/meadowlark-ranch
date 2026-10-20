import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const runtime=process.env.RANCH_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url));
const fixture=new URL('./fixtures/hollowpeak-eastern-headwall-05b1/',import.meta.url);
const meta=JSON.parse(fs.readFileSync(new URL('established-native.json',fixture)));
const helperOwner=process.env.HOLLOWPEAK_HEADWALL_SOURCE||path.join(runtime,'assets/hollowpeak-eastern-headwall.mjs');
const macroOwner=process.env.HOLLOWPEAK_HEADWALL_MACRO_SOURCE||path.join(runtime,'assets/hollowpeak-macroshape.mjs');
const fallsOwner=process.env.HOLLOWPEAK_HEADWALL_FALLS_SOURCE||path.join(runtime,'assets/falls-landscape.js');
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const url=f=>pathToFileURL(path.join(runtime,f)).href,read=f=>fs.readFileSync(f,'utf8');
const helper=await import(pathToFileURL(helperOwner)),sculpt=helper.sculptEasternHeadwall;
const macroSource=read(macroOwner),fallsSource=read(fallsOwner),helperSource=read(helperOwner);
const macroImport="import {sculptEasternHeadwall} from './hollowpeak-eastern-headwall.mjs?v=hollowpeak-eastern-headwall-2';\n";
const publicMacro='export function hollowpeakMacroshape(x,z,original,protection=1){';
const privateMacro='function establishedHollowpeakMacroshape(x,z,original,protection=1){';
const macroWrapper='\nexport function hollowpeakMacroshape(x,z,original,protection=1){return sculptEasternHeadwall(x,z,establishedHollowpeakMacroshape(x,z,original,protection),protection);}\n';
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'One exact additive integration edge: '+a);return s.replace(a,b);};
function establishedMacro(s){assert(s.startsWith(macroImport),'One prepend-only helper import');s=s.slice(macroImport.length);s=once(s,macroWrapper,'');s=once(s,privateMacro,publicMacro);assert.equal(sha(s),meta.macroSourceSHA256,'Exact established complete macro owner, including existing gully and bench body');return s;}
const oldMacroSource=establishedMacro(macroSource);
function establishedFalls(s){if(sha(s)!==meta.fallsSourceSHA256)s=once(s,"'./hollowpeak-macroshape.mjs?v=hollowpeak-eastern-headwall-2'","'./hollowpeak-macroshape.mjs?v=hollowpeak-macroshape-1'");assert.equal(sha(s),meta.fallsSourceSHA256,'Falls changes are limited to the explicit physical macro cache edge');return s;}
const oldFallsSource=establishedFalls(fallsSource);
function moduleURL(source,owner,resolve=()=>null){return'data:text/javascript;base64,'+Buffer.from(source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,spec)=>'from '+JSON.stringify(resolve(spec)||new URL(spec,pathToFileURL(owner)).href))).toString('base64');}
const oldMacroURL=moduleURL(oldMacroSource,macroOwner),newMacroURL=moduleURL(macroSource,macroOwner,spec=>spec.startsWith('./hollowpeak-eastern-headwall.mjs')?pathToFileURL(helperOwner).href:null);
const A=await import(moduleURL(oldFallsSource,fallsOwner,spec=>spec.startsWith('./hollowpeak-macroshape.mjs')?oldMacroURL:null));
const B=await import(moduleURL(fallsSource,fallsOwner,spec=>spec.startsWith('./hollowpeak-macroshape.mjs')?newMacroURL:null));
const T=await import(url('assets/vendor/three/build/three.module.js'));
const {pastureRise}=await import(url('assets/pastoral-fields.mjs'));
const {canyonRelief,canyonMacroPlanningRelief}=await import(url('assets/canyon-landscape.js'));
const {oasisTerrainHeight}=await import(url('assets/oasis-art.js'));
const {configureRiverBanks,legacyRiverBankHeight,riverBankTerrainHeight}=await import(url('assets/riverbank-terrain.mjs'));
const {loonLakeTerrainHeight,legacyLoonLakeTerrainHeight}=await import(url('assets/loon-lake.mjs'));
const {createHollowpeakPlacementPlan,legacyFallsTerrainHeight}=await import(url('assets/hollowpeak-placement-reference.mjs'));
const {buildHollowpeakShoreData}=await import(url('assets/hollowpeak-shore.mjs'));
const {createWaterfallArt}=await import(url('assets/waterfall-art.js'));
const {forTerrainIntersections,exactSweptClearance}=await import(url('tools/terrain-water-contact.mjs'));
const html=read(path.join(runtime,'ranch3d.html')),start=html.indexOf('function ihash(ix,iz){'),end=html.indexOf('/* ===== Roads =====');
assert(start>=0&&end>start);const rawSource=html.slice(start,end);
// Every rawH default dependency is explicit, including current physical Loon
// Lake. Historical planting instead passes legacy Lake/River/Falls samplers.
const raw=F=>new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight','loonLakeTerrainHeight',rawSource+'return rawH;')(T,pastureRise,canyonRelief,oasisTerrainHeight,F,riverBankTerrainHeight,loonLakeTerrainHeight);
const oldRaw=raw(A.fallsTerrainHeight),newRaw=raw(B.fallsTerrainHeight),legacyRaw=raw(legacyFallsTerrainHeight);
configureRiverBanks({terrainStep:meta.step,rawHeightAt:(x,z)=>oldRaw(x,z,A.fallsTerrainHeight,canyonMacroPlanningRelief,legacyRiverBankHeight,legacyLoonLakeTerrainHeight),heightAt:()=>{throw Error('Unexpected river reference fallback');}});
const nativeGzip=fs.readFileSync(new URL('canonical-terrain.f32.gz',fixture)),nativeBytes=gunzipSync(nativeGzip);
const before=new Float32Array(nativeBytes.buffer,nativeBytes.byteOffset,nativeBytes.byteLength/4),after=before.slice(),oldGrid=new Float32Array(before.length),newGrid=new Float32Array(before.length);
const {step,size:N}=meta,changes=[],rawNativeDifferences=[],eligible=new Set(meta.eligibleNodes.map(([ix,iz])=>iz*N+ix));
let maximumCut=0;
for(let iz=0;iz<N;iz++)for(let ix=0;ix<N;ix++){
 const i=iz*N+ix,x=ix*step-500,z=iz*step-500;oldGrid[i]=oldRaw(x,z);newGrid[i]=newRaw(x,z);
 if(oldGrid[i]!==before[i])rawNativeDifferences.push(i);
 if(newGrid[i]!==oldGrid[i]){changes.push({i,ix,iz,x,z,before:before[i],after:newGrid[i],cut:oldGrid[i]-newGrid[i]});after[i]=newGrid[i];maximumCut=Math.max(maximumCut,oldGrid[i]-newGrid[i]);}
}
function sample(grid,x,z){if(x<=-500||x>=500||z<=-500||z>=500)throw Error('Canonical proof is bounded to the real terrain');const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*N+ix,a=grid[i],b=grid[i+N],c=grid[i+N+1],d=grid[i+1];return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);}
const oldHeight=(x,z)=>sample(before,x,z),height=(x,z)=>sample(after,x,z);
const stats={scope:'Native05b1 final field plus full current rawH differential; no browser or art-quality claim',baselineCommit:meta.baselineCommit,sources:{helper:sha(helperSource),macro:sha(macroSource),falls:sha(fallsSource),raw:sha(rawSource)},nativeCanonicalSHA256:sha(nativeBytes),candidateCanonicalSHA256:sha(bytes(after)),rawCanonicalSHA256:sha(bytes(oldGrid)),unchangedRemoteLatePatchNodes:rawNativeDifferences.length,changedCanonicalVertices:changes.length,maximumCut,changedNodes:changes,barrierTopChanges:[]};
function controlled(fn){const previous=Math.random;let state=0x5173c84a,draws=0;Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const value=fn(),count=draws,future=Array.from({length:16},()=>Math.random());return{value,draws:count,future};}finally{Math.random=previous;}}
function produce(F,heightAt){return controlled(()=>{const scene=new T.Scene(),colliders=[],waterMaterial=new T.MeshPhysicalMaterial();waterMaterial.userData.plainShader=()=>{};return{landscape:F.createFallsLandscape({THREE:T,scene,heightAt,terrainStep:step,waterMaterial,colliders,loadTextures:false}),colliders,waterMaterial};});}
const builtA=produce(A,oldHeight),builtB=produce(B,height),shoreA=buildHollowpeakShoreData(oldHeight),shoreB=buildHollowpeakShoreData(height);

test('the physical extension has exactly three additive macro edges and retains the established source owners',()=>{
 assert.equal(helper.HOLLOWPEAK_EASTERN_HEADWALL_PROFILE,'hollowpeak-eastern-headwall-2');assert.equal(helper.MAX_CUT,5);
 assert.equal(establishedMacro(macroImport+once(oldMacroSource,publicMacro,privateMacro)+macroWrapper),oldMacroSource);
 assert.throws(()=>establishedMacro(macroSource.replace('original,protection),protection);','original,1),protection);')),/One exact additive integration edge/);
 assert.equal(sha(read(path.join(runtime,'assets/hollowpeak-placement-reference.mjs'))),meta.historicalPlantingSourceSHA256,'Historical planting source stays byte-exact');
 assert.equal(sha(read(path.join(runtime,'assets/willowmere-landscape.js'))),meta.latePatchSourceSHA256,'Remote late physical patch owner stays byte-exact');
 assert.equal(sha(rawSource),meta.rawSourceSHA256);assert.equal(sha(oldFallsSource),meta.fallsSourceSHA256);
 assert.equal(B.alpineRelief(-194,-355),A.alpineRelief(-194,-355),'Accepted V6 upper ridge remains the same physical sampler');
});

test('actual current rawH replays the native edit region and discloses the exact preexisting remote final-grid patch',(t)=>{
 assert.equal(sha(nativeGzip),meta.nativeGzipSHA256);assert.equal(sha(nativeBytes),meta.nativeCanonicalSHA256);assert.equal(before.length,N*N);
 assert.equal(sha(bytes(oldGrid)),meta.rawCanonicalSHA256,'Current full raw source replay, including physical Lake and configured River');
 assert.deepEqual(rawNativeDifferences,meta.latePatch.rawToFinalMismatchIndices,'Only accepted Willowmere late W.patchTerrain nodes differ from initial rawH');
 assert.equal(rawNativeDifferences.length,372);
 for(const i of rawNativeDifferences){const ix=i%N,iz=Math.floor(i/N);assert(ix>=400&&ix<=427&&iz>=400&&iz<=423);assert.equal(after[i],before[i]);}
 for(const i of eligible)assert.equal(oldGrid[i],before[i],'Headwall raw terrain is independently bound to accepted native terrain');
 t.diagnostic(JSON.stringify({nativeSHA256:sha(nativeBytes),rawSHA256:sha(bytes(oldGrid)),nativeRawExactNodes:before.length-rawNativeDifferences.length,remoteLatePatchNodes:rawNativeDifferences.length}));
});

test('full canonical differential changes only the reviewed connected single-pier envelope and leaves all other bytes exact',(t)=>{
 assert.equal(eligible.size,56);assert(changes.length>3,'A visible physical face, not a subpixel/no-op change');assert(changes.length<=eligible.size);
 for(const c of changes){assert(eligible.has(c.i),`Unapproved canonical support ${c.ix},${c.iz}`);assert.equal(oldGrid[c.i],before[c.i]);assert(c.cut>0&&c.cut<=helper.MAX_CUT+2e-6);assert(Number.isFinite(c.after));assert(A.fallsRelief(c.x,c.z)>10);assert(B.fallsRelief(c.x,c.z)>=10);}
 for(let i=0;i<before.length;i++)if(!eligible.has(i))assert.equal(after[i],before[i],`Exact physical exterior node${i}`);
 assert(maximumCut>1&&maximumCut<=5.000002,'Bounded material erosion survives Float32 packing');
 for(const[ix,iz]of meta.ledgeCellNodes)assert.equal(after[iz*N+ix],before[iz*N+ix]);
 const east=meta.easternCrest;assert.equal(after[east.iz*N+east.ix],before[east.iz*N+east.ix]);
 for(let iz=0;iz<=100;iz++)for(let ix=0;ix<N;ix++)assert.equal(after[iz*N+ix],before[iz*N+ix],'Entire accepted upper ridge and its physical hem');
 for(const point of meta.attribution.slice(1))assert.equal(height(...point.physicalXZ),point.support.height,'Reviewed inner ledge ray remains exact');
 const tip=meta.attribution[0],loss=tip.support.height-height(...tip.physicalXZ);assert(loss>1&&loss<=5.000002,'Actual attributed tip triangle changes materially');stats.attributedTipCut=loss;
 t.diagnostic(JSON.stringify({changedVertices:changes.length,maxCut:maximumCut,tipCut:loss,candidateSHA256:stats.candidateCanonicalSHA256}));
});

test('pure sculpt is finite, bounded, preserves basal/protection/exterior edges and consumes no ambient RNG',()=>{
 const random=Math.random;let draws=0;Math.random=()=>{draws++;throw Error('Scene RNG touched');};
 try{
  for(let z=-282;z<=-246;z+=.37)for(let x=-141;x<=-108;x+=.41)for(const h of[-3,0,3,6,10,10.00001,14,20,40,100])for(const protection of[0,.25,1]){const y=sculpt(x,z,h,protection);assert(Number.isFinite(y));assert(y<=h&&y>=h-5-1e-12);if(h<=10||protection===0||x<=-137||x>=-112||z<=-279||z>=-249)assert.equal(y,h);if(h>10)assert(y>=10);}
  assert.equal(draws,0);
 }finally{Math.random=random;}
 for(const bad of[NaN,Infinity,-Infinity])for(const args of[[bad,-265,25,1],[-125,bad,25,1],[-125,-265,bad,1],[-125,-265,25,bad]])assert.throws(()=>sculpt(...args),/Finite/);
 for(const[x,z,dx,dz]of[[-137,-265,1,0],[-112,-265,1,0],[-125,-277.34375,0,1],[-125,-250,0,1]]){const e=1e-4;assert(Math.abs(sculpt(x-dx*e,z-dz*e,25)-sculpt(x+dx*e,z+dz*e,25))<1e-7,'No compact boundary discontinuity');}
});

test('actual water, shore, waterfall and route contact support remains exact',(t)=>{
 assert.deepEqual(B.HOLLOWPEAK,A.HOLLOWPEAK);assert.deepEqual(B.ALPINE_BOUNDS,A.ALPINE_BOUNDS);
 for(const group of Object.values(meta.protectedContactGroups))for(const[ix,iz]of group.nodes)assert.equal(after[iz*N+ix],before[iz*N+ix]);
 for(const key of['pool','tarn','stream']){
  const a=builtA.value.landscape[key],b=builtB.value.landscape[key],native=meta.nativeWaterFingerprints.find(p=>p.name===a.name);assert(native);
  assert.deepEqual(a.geometry.index.array,b.geometry.index.array);assert.equal(sha(bytes(new Uint32Array(a.geometry.index.array))),native.indexSHA256);
  for(const attr of Object.keys(a.geometry.attributes))assert.deepEqual(b.geometry.attributes[attr].array,a.geometry.attributes[attr].array,key+':'+attr);
  for(const attr of['position','normal','uv'])assert.equal(sha(bytes(new Float32Array(a.geometry.attributes[attr].array))),native[attr+'SHA256'],'Actual native water buffer binding');
 }
 for(const key of['bank','water'])for(const attr of Object.keys(shoreA[key]))assert.deepEqual(shoreB[key][attr],shoreA[key][attr],key+':'+attr);
 assert.deepEqual(shoreB.terrainOwners,shoreA.terrainOwners);
 const F=B.HOLLOWPEAK,fall=createWaterfallArt({THREE:T}).fall({x:F.x,z:F.z,top:F.top,bottom:F.level+.04,width:F.width,run:F.run,name:'Hollowpeak Falls',flowProfile:'hollowpeak-cataract-1'}).children[0],g=fall.geometry;
 try{const args={position:g.attributes.position.array,index:g.index.array,motion:g.attributes.cascadeMotion.array,step},a=exactSweptClearance({...args,height:oldHeight}),b=exactSweptClearance({...args,height});assert.deepEqual(a,meta.waterfallClearance,'Native swept-envelope baseline binding');assert.deepEqual(b,a,'Entire continuous animated sweep retains exact accepted clearance');stats.waterfall=b;}finally{fall.parent.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});}
 const trail=[[-160,-215],[-173.0439,-225.4024],[-187.0279,-235.9788],[-200.6802,-244.8582],[-260,-280]];
 for(let j=1;j<trail.length;j++){const a=trail[j-1],b=trail[j],d=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let q=0;q<=100;q++)for(const offset of[-4,0,4]){const t=q/100,x=a[0]+(b[0]-a[0])*t-(b[1]-a[1])/d*offset,z=a[1]+(b[1]-a[1])*t+(b[0]-a[0])/d*offset;assert.equal(height(x,z),oldHeight(x,z));}}
 t.diagnostic(JSON.stringify({shoreTriangles:shoreB.bank.index.length/3,continuousWaterfallClearance:stats.waterfall.min}));
});

test('no new3m contour, radius, order or course-authority change; live topY changes are disclosed',(t)=>{
 const a=builtA.value.colliders,b=builtB.value.colliders;assert.deepEqual(a,meta.nativeBarriers,'Actual complete native collider baseline binding');assert.equal(b.length,a.length);assert.equal(a.length,306);
 for(let i=0;i<a.length;i++){assert.deepEqual({...b[i],topY:a[i].topY},a[i],`Exact barrier${i}XZ/radius/flags/order`);assert(b[i].topY<=a[i].topY+1e-6);if(b[i].topY!==a[i].topY)stats.barrierTopChanges.push({index:i,x:b[i].x,z:b[i].z,before:a[i].topY,after:b[i].topY});assert(b[i].topY>=height(b[i].x,b[i].z));}
 // Dense analytic checks ensure compact cuts cannot introduce fresh low-foot
 // crossings between the canonical nodes that the raw grid proof covers.
 for(let z=-281;z<=-247;z+=.19)for(let x=-139;x<=-110;x+=.21){const a=A.fallsRelief(x,z),b=B.fallsRelief(x,z);assert.equal(a>3,b>3);if(a<=10)assert.equal(b,a);}
 t.diagnostic(JSON.stringify({barriers:b.length,changedLiveTopY:stats.barrierTopChanges.length,maxTopDrop:Math.max(0,...stats.barrierTopChanges.map(c=>c.before-c.after))}));
});

test('rock and shadow share the revised triangle field; derived visual changes are disclosed without a false6m halo',(t)=>{
 const a=builtA.value.landscape,b=builtB.value.landscape;assert.equal(builtA.draws,builtB.draws);assert.deepEqual(builtA.future,builtB.future);assert.equal(a.group.children.length,b.group.children.length);
 assert.deepEqual(a.shadow.geometry.index.array,b.shadow.geometry.index.array,'Full physical shadow topology stays exact');
 stats.visual={};
 for(const key of['rock','shadow']){const ap=a[key].geometry.attributes.position,bp=b[key].geometry.attributes.position;assert.equal(ap.count,bp.count);for(let i=0;i<bp.count;i++){assert.equal(bp.getX(i),ap.getX(i));assert.equal(bp.getZ(i),ap.getZ(i));assert(Math.abs(bp.getY(i)-height(bp.getX(i),bp.getZ(i))-.012)<1e-5);}
  const g=b[key].geometry,n=g.attributes.normal;for(const i of new Set(g.index.array)){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert(Number.isFinite(length)&&Math.abs(length-1)<2e-6);}
  const changed={};for(const[name,attr]of Object.entries(g.attributes)){const aa=a[key].geometry.attributes[name].array,bb=attr.array,indices=[];assert.equal(aa.length,bb.length);for(let i=0;i<attr.count;i++)if(Array.from({length:attr.itemSize},(_,k)=>aa[i*attr.itemSize+k]!==bb[i*attr.itemSize+k]).some(Boolean))indices.push(i);if(indices.length){changed[name]={vertices:indices.length,bounds:{x:[Math.min(...indices.map(i=>bp.getX(i))),Math.max(...indices.map(i=>bp.getX(i)))],z:[Math.min(...indices.map(i=>bp.getZ(i))),Math.max(...indices.map(i=>bp.getZ(i)))]}};}}
  stats.visual[key]={vertices:bp.count,trianglesBefore:a[key].geometry.index.count/3,trianglesAfter:g.index.count/3,changed};
 }
 t.diagnostic(JSON.stringify(stats.visual));
});

test('historical planning sampler, occupancy and RNG sequence remain independent of the new physical field',()=>{
 const historical=(x,z)=>legacyRaw(x,z,legacyFallsTerrainHeight,canyonRelief,legacyRiverBankHeight,legacyLoonLakeTerrainHeight);
 const a=controlled(()=>createHollowpeakPlacementPlan({rawHeightAt:historical,heightAt:oldHeight,terrainStep:step})),b=controlled(()=>createHollowpeakPlacementPlan({rawHeightAt:historical,heightAt:height,terrainStep:step}));
 assert.equal(a.draws,0);assert.equal(b.draws,0);assert.deepEqual(a.future,b.future);assert.deepEqual(a.value.stats,b.value.stats);assert.deepEqual(a.value.collidersForPlanning([],[]),b.value.collidersForPlanning([],[]));
 for(let z=-430;z<-198;z+=2.21)for(let x=-290;x<-17;x+=2.17)assert.equal(a.value.heightAt(x,z),b.value.heightAt(x,z));
 stats.historicalPlanning=a.value.stats;
 if(process.env.HOLLOWPEAK_HEADWALL_AUDIT_OUTPUT)fs.writeFileSync(process.env.HOLLOWPEAK_HEADWALL_AUDIT_OUTPUT,JSON.stringify(stats,null,2)+'\n');
 for(const built of[builtA,builtB]){built.value.landscape.group.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});built.value.waterMaterial.dispose();}
});
