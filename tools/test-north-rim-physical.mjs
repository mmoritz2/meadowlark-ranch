import fs from 'node:fs';
import crypto from 'node:crypto';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{undoNorthRimSource:normalizeNorthRimSource}=require('./north-rim-source-guard.cjs');
const root=process.env.NORTH_RIM_SOURCE_ROOT?pathToFileURL(process.env.NORTH_RIM_SOURCE_ROOT+'/'):new URL('../',import.meta.url);
const dep=p=>import(new URL(p,root));
const T=await dep('assets/vendor/three/build/three.module.js');
const old=await import('./fixtures/north-rim-planar-22b72cc/physical/fixtures/baseline/canyon-landscape.js');
const next=await import('../assets/canyon-landscape.js');
const {pastureRise}=await dep('assets/pastoral-fields.mjs');
const {oasisTerrainHeight}=await dep('assets/oasis-art.js');
const {fallsTerrainHeight}=await dep('assets/falls-landscape.js');
const {configureRiverBanks,riverBankTerrainHeight,legacyRiverBankHeight}=await dep('assets/riverbank-terrain.mjs?v=river-banks-1');
const read=p=>fs.readFileSync(new URL(p.startsWith('./assets/')?'../'+p.slice(2):'./fixtures/north-rim-planar-22b72cc/physical/'+p.slice(2),import.meta.url)),json=p=>JSON.parse(read(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),arraySHA=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const contract=json('./fixtures/contract.json'),native=json('./fixtures/native-preservation.json'),buf=read('./fixtures/terrain-grid.f32'),before=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),afterGrid=before.slice(),n=513,step=1000/512,rawCode=read('./fixtures/raw-terrain-source.txt').toString();
function height(A,x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,k=iz*n+ix,a=A[k],b=A[k+n],c=A[k+n+1],d=A[k+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const oldHeight=(x,z)=>height(before,x,z),newHeight=(x,z)=>height(afterGrid,x,z),raw=relief=>new Function('THREE','pastureRise','canyonRelief','oasisTerrainHeight','fallsTerrainHeight','riverBankTerrainHeight',rawCode+'return rawH;')(T,pastureRise,relief,oasisTerrainHeight,fallsTerrainHeight,riverBankTerrainHeight),oldRaw=raw(old.canyonRelief),newRaw=raw(next.canyonRelief);
configureRiverBanks({terrainStep:step,rawHeightAt:(x,z)=>oldRaw(x,z,fallsTerrainHeight,old.canyonMacroPlanningRelief,legacyRiverBankHeight),heightAt:oldHeight});
const oldBootGrid=new Float32Array(before.length),newBootGrid=new Float32Array(before.length);
const changed=[],changes=[],proof={scope:'CPU current constructor, actual native Float32 grid/route/collider inputs and shared hoof parity. Native candidate pixels and actual full-scene reanchoring remain pending.',baseCommit:contract.baseCommit};
let mismatchedBase=0,wholeRawMismatches=0,minDelta=0,maxDelta=0;
const noRNG=fn=>{const previous=Math.random;Math.random=()=>assert.fail('Numeric field consumed scene RNG');try{return fn();}finally{Math.random=previous;}};
noRNG(()=>{for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){const i=iz*n+ix,x=ix*step-500,z=iz*step-500,a=Math.fround(oldRaw(x,z)),b=Math.fround(newRaw(x,z));oldBootGrid[i]=a;newBootGrid[i]=b;if(a!==before[i])wholeRawMismatches++;if(a!==b){if(a!==before[i])mismatchedBase++;afterGrid[i]=b;}if(afterGrid[i]!==before[i]){changed.push(i);const delta=afterGrid[i]-before[i];changes.push({i,x,z,delta});minDelta=Math.min(minDelta,delta);maxDelta=Math.max(maxDelta,delta);}}});
function build(module,h){let calls=0,state=17143;const previous=Math.random;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const scene=new T.Scene(),material=new T.MeshStandardMaterial(),colliders=[],art=module.createCanyonLandscape({THREE:T,scene,heightAt:h,terrainStep:step,material,colliders}),future=Array.from({length:32},Math.random);return{scene,material,colliders,art,calls:calls-32,future};}finally{Math.random=previous;}}
const oldBootHeight=(x,z)=>height(oldBootGrid,x,z),newBootHeight=(x,z)=>height(newBootGrid,x,z);
const A=build(old,oldBootHeight),B=build(next,newBootHeight),oldPlan=old.createCanyonPlacementPlan({terrainStep:step,rawHeightAt:(x,z)=>oldRaw(x,z,fallsTerrainHeight,old.canyonPlanningRelief,legacyRiverBankHeight),macroRawHeightAt:(x,z)=>oldRaw(x,z,fallsTerrainHeight,old.canyonMacroPlanningRelief),heightAt:oldHeight}),plan=next.createCanyonPlacementPlan({terrainStep:step,rawHeightAt:(x,z)=>newRaw(x,z,fallsTerrainHeight,next.canyonPlanningRelief,legacyRiverBankHeight),macroRawHeightAt:(x,z)=>newRaw(x,z,fallsTerrainHeight,next.canyonMacroPlanningRelief),heightAt:newHeight});
const stats=art=>art.fields.map(f=>({id:f.id,vertices:f.mesh.geometry.attributes.position.count,triangles:f.mesh.geometry.index.count/3,bytes:f.mesh.geometry.index.array.byteLength+Object.values(f.mesh.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)}));
function support(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),i=iz*n+ix,ids=gx-ix+gz-iz<=1?[i,i+1,i+n]:[i+1,i+n,i+n+1];for(const k of ids)assert.equal(afterGrid[k],before[k],`Protected support${k} at${x},${z}`);}
const currentNative=json('./native-current-routes.json');assert.equal(sha(fs.readFileSync(new URL(currentNative.baselineRelativePath,import.meta.url))),currentNative.baselineSHA256);const actualNative=JSON.parse(fs.readFileSync(new URL(currentNative.baselineRelativePath,import.meta.url)));assert(Object.values(actualNative.checks).every(Boolean));assert.equal(actualNative.snapshot.terrain.sha256,sha(buf));assert.deepEqual(currentNative.tracks,actualNative.snapshot.tracks);assert.deepEqual(currentNative.races,actualNative.snapshot.races);const staticFive=new Function(read('./fixtures/races-source.txt').toString()+'return RACE_ROUTES;')();assert.deepEqual(currentNative.races.slice(0,5),Object.entries(staticFive).map(([id,pts])=>({id:'race:'+id,pts:[...pts,pts[0]]})));const routes=[...currentNative.tracks,...currentNative.races];
function tube(pts,w){let samples=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(!L)continue;const k=Math.ceil(L/.35);for(let j=0;j<=k;j++)for(const q of[-w,0,w]){support(a[0]+dx*j/k-dz/L*q,a[1]+dz*j/k+dx/L*q);samples++;}}return samples;}
function routeDistance(x,z){let min=Infinity;for(const r of routes)for(let i=1;i<r.pts.length;i++){const a=r.pts[i-1],b=r.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));min=Math.min(min,Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u));}return min;}

test('frozen current native owner inputs and precise original three-group source delta are pinned',()=>{
 for(const [f,h]of Object.entries(contract.fixtureFiles))assert.equal(sha(read('./'+f)),h,f);
 for(const [f,h]of Object.entries(contract.dependencySources))assert.equal(sha(normalizeNorthRimSource(fs.readFileSync(new URL(f,root),'utf8'),f)),h,f);
 assert.equal(sha(buf),contract.actualNativeFiles['terrain-grid.f32'].sha256);
 assert.equal(sha(read('./assets/coyote-macroform.mjs')),contract.runtimeCandidateSHA256);
 let source=read('./assets/coyote-macroform.mjs').toString();const cs=json('./numeric-source-changes.json');assert.equal(cs.length,5);for(const c of cs.toReversed()){assert.equal(source.split(c.after).length,2);source=source.replace(c.after,c.before);}assert.equal(source,read('./fixtures/baseline/coyote-macroform.mjs').toString());
 assert.equal(normalizeNorthRimSource(read('./assets/canyon-landscape.js').toString(),'assets/canyon-landscape.js'),read('./fixtures/baseline/canyon-landscape.js').toString(),'Only exact accepted cache edge differs; actual next constructor imported above');
 assert(!/Math\.random|new\s+[A-Za-z_$][\w.$]*\s*\(|fetch\(|window\./.test(read('./assets/coyote-macroform.mjs').toString()));
});
test('the actual canonical grid changes substantially only within North-rim with exact native preimage',()=>{
 assert.equal(mismatchedBase,0,'actual native grid matches the old physical recipe at every changed cell');assert(changed.length>1500&&changed.length<4000);assert(Math.max(-minDelta,maxDelta)>8&&Math.max(-minDelta,maxDelta)<12);
 for(const c of changes){assert(c.x>=-362&&c.x<=-148&&c.z>=-4&&c.z<=82);assert(Number.isFinite(afterGrid[c.i]));}
 for(let i=0;i<before.length;i++)if(!changed.includes(i))assert.equal(afterGrid[i],before[i]);
 proof.terrain={changed:changed.length,minDelta,maxDelta,maxChangedNativeBaseError:mismatchedBase,wholeRawMismatches,originalSHA256:arraySHA(before),newSHA256:arraySHA(afterGrid),bounds:{minX:Math.min(...changes.map(c=>c.x)),maxX:Math.max(...changes.map(c=>c.x)),minZ:Math.min(...changes.map(c=>c.z)),maxZ:Math.max(...changes.map(c=>c.z))}};
});
test('all seven actual tracks and ten current closed race tubes, river water, outpost and fixed scan supports stay exact',()=>{
 let routeSamples=0;assert.equal(currentNative.tracks.length,7);assert.equal(currentNative.races.length,10);for(const r of routes)routeSamples+=tube(r.pts,3);
 let waterSamples=0;for(let x=-380;x<-95;x+=.8)for(const offset of[-13,-7,0,7,13]){support(x,120+Math.sin(x*.012)*45+offset);waterSamples++;}
 for(let z=130;z<=150.390625;z+=.4)for(let x=-158;x<-119;x+=.4)support(x,z);
 for(let x=-249;x<=-201;x+=1.2)for(let z=109;z<=133;z+=1.2)support(x,z);
 for(let x=-265;x<=-211;x+=1.2)for(let z=200;z<=240;z+=1.2)support(x,z);
 proof.protected={actualTracks:7,currentClosedRaces:10,routeTubeWidth:3,routeSupportSamples:routeSamples,waterSamples,fixedOasisScan:true};
});
test('four real skin owners, material and future constructor RNG remain; all three other bank buffers exact',()=>{
 assert.equal(A.calls,B.calls);assert.equal(B.calls,48);assert.deepEqual(A.future,B.future);assert.equal(B.art.fields.length,4);assert.equal(B.art.group.children.length,4);
 for(let i=0;i<4;i++){const a=A.art.fields[i].mesh,b=B.art.fields[i].mesh;assert.equal(a.uuid,b.uuid);assert.equal(a.geometry.uuid,b.geometry.uuid);assert.equal(a.material.uuid,b.material.uuid);assert.equal(a.material.onBeforeCompile.toString(),b.material.onBeforeCompile.toString());assert.equal(a.material.customProgramCacheKey(),b.material.customProgramCacheKey());assert.equal(a.geometry.attributes.position.count,b.geometry.attributes.position.count);assert.equal(a.castShadow,b.castShadow);assert.equal(a.receiveShadow,b.receiveShadow);
  if(A.art.fields[i].id!=='north-rim'){for(const k of Object.keys(a.geometry.attributes))assert.equal(arraySHA(a.geometry.attributes[k].array),arraySHA(b.geometry.attributes[k].array));assert.equal(arraySHA(a.geometry.index.array),arraySHA(b.geometry.index.array));}
 }
 assert(B.art.fields.every(f=>f.mesh.material===B.art.fields[0].mesh.material));proof.resources={old:stats(A.art),candidate:stats(B.art),drawOwners:4,sharedMaterials:1,newTextures:0,newSamplers:0,constructorRandomDraws:B.calls,future32Exact:true};
});
test('every actual skin vertex, edge and triangle interior agrees with canonical hoof triangles at12mm',()=>{
 let samples=0,min=Infinity,max=-Infinity,triangles=0,minArea=Infinity;
 for(const {mesh}of B.art.fields){const g=mesh.geometry,P=g.attributes.position,I=g.index,N=g.attributes.normal;for(const a of Object.values(g.attributes))for(const v of a.array)assert(Number.isFinite(v));for(let t=0;t<I.count;t+=3){const ids=[I.getX(t),I.getX(t+1),I.getX(t+2)];for(const w of[[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[.5,0,.5],[0,.5,.5],[1/3,1/3,1/3],[.15,.25,.6]]){const[x,y,z]=[0,1,2].map(k=>ids.reduce((s,id,j)=>s+P.array[id*3+k]*w[j],0)),gap=y-newHeight(x,z);assert(Math.abs(gap-.012)<.000015);min=Math.min(min,gap);max=Math.max(max,gap);samples++;}
  const a=new T.Vector3().fromBufferAttribute(P,ids[0]),b=new T.Vector3().fromBufferAttribute(P,ids[1]),c=new T.Vector3().fromBufferAttribute(P,ids[2]),area=b.sub(a).cross(c.sub(a)).length()/2;assert(area>1);minArea=Math.min(minArea,area);for(const id of ids)assert(Math.abs(Math.hypot(N.getX(id),N.getY(id),N.getZ(id))-1)<.000002);triangles++;}}
 proof.skin={triangles,samples,minOffsetM:min,maxOffsetM:max,minArea};assert(triangles<20000);
});
test('all original native contour inputs bind through one declared baseline-only1ULP projection; new North circles rebuild and other owners stay exact',()=>{
 assert.equal(A.art.barriers.length,414);
 const historic=contract.observedOldNativeNodeRoundoff,normalized=A.art.barriers.map(c=>({...c}));assert.equal(native.colliders[historic.index][historic.key],historic.browserValue);assert.equal(normalized[historic.index][historic.key],historic.nodeValue);assert.equal(Math.abs(historic.nodeValue-historic.browserValue),historic.ulp);normalized[historic.index][historic.key]=historic.browserValue;assert.deepEqual(normalized,native.colliders.slice(0,414));
 proof.nativeInputBinding={all414CirclesExactAfterOneDeclaredBaselineEngineProjection:historic,candidateNativePreservation:'Pending same-engine native comparison; not waived.'};const isNorth=c=>c.x>=-362&&c.x<=-148&&c.z>=-4&&c.z<=82;
 assert.deepEqual(B.art.barriers.filter(c=>!isNorth(c)),A.art.barriers.filter(c=>!isNorth(c)));assert.notDeepEqual(B.art.barriers.filter(isNorth),A.art.barriers.filter(isNorth));let minRoute=Infinity;
 for(const c of B.art.barriers){assert(Number.isFinite(c.x+c.z+c.topY));assert(c.r===1.05&&c.height===80&&c.landform&&c.terrainCliff);assert(c.topY>=newHeight(c.x,c.z)+.29999);const gap=routeDistance(c.x,c.z)-c.r;assert(gap>3);minRoute=Math.min(minRoute,gap);}
 proof.barriers={original:A.art.barriers.length,candidate:B.art.barriers.length,oldNorth:A.art.barriers.filter(isNorth).length,newNorth:B.art.barriers.filter(isNorth).length,minRouteClearanceM:minRoute,otherOwnersExact:true};
});
test('actual retained mounted circle law stops at new barriers and permits deliberate above-top flight',()=>{
 const source=read('./fixtures/legacy-collider-source.txt').toString(),html=fs.readFileSync(new URL('ranch3d.html',root),'utf8');assert.equal(html.split(source).length,2);const resolve=new Function('player','colliders','groundH',source+'return player;');let contacts=0;
 for(const c of B.art.barriers.filter((_,i)=>i%3===0))for(const angle of[0,.7,1.8,3.1,4.9]){const d=c.r+.3,x=c.x+Math.sin(angle)*d,z=c.z+Math.cos(angle)*d,p={pos:{x,z},y:0,heading:angle};resolve(p,[c],newHeight);assert(Math.abs(Math.hypot(p.pos.x-c.x,p.pos.z-c.z)-(c.r+.55))<1e-10);contacts++;const fly={pos:{x,z},y:Math.max(0,c.topY-newHeight(x,z))+.01,heading:angle};resolve(fly,[c],newHeight);assert.deepEqual(fly.pos,{x,z});}
 proof.retainedMountedLaw={contacts,aboveTopCases:contacts,scope:'Actual current main inline legacy circle law; does not certify every riding controller or gait.'};
});
test('historical decision heights/admission grids remain exact while affected physical root heights change',()=>{
 assert.deepEqual(plan.bounds,oldPlan.bounds);assert.deepEqual(plan.grid,oldPlan.grid);assert.deepEqual(plan.macroGrids,oldPlan.macroGrids);assert.deepEqual(plan.barriers,oldPlan.barriers);let queries=0,moved=0;
 noRNG(()=>{for(let z=-15;z<210;z+=1.31)for(let x=-375;x<-110;x+=1.47){assert.equal(next.canyonPlanningRelief(x,z),old.canyonPlanningRelief(x,z));assert.equal(next.canyonMacroPlanningRelief(x,z),old.canyonMacroPlanningRelief(x,z));assert.equal(plan.heightAt(x,z),oldPlan.heightAt(x,z));assert.equal(plan.cliffAt(x,z),oldPlan.cliffAt(x,z));queries++;}});
 for(const t of native.treeSites){const a=oldHeight(t.x,t.z),b=newHeight(t.x,t.z);if(a!==b){assert(t.x>=-364&&t.x<=-146&&t.z>=-6&&t.z<=84);moved++;}}
 assert(moved>0);proof.planning={queries,oldGridBytes:plan.grid.bytes,macroGridBytes:plan.macroGrids.reduce((s,g)=>s+g.bytes,0),actualNativeTreeRootsAffected:moved,decisionMatricesAndRNGScope:'Historical decision functions/grids unchanged. Full native scanned tree/model reanchoring still required.'};
});
test('original numeric contour seams are continuous and finite, with materially unequal crown and south-facing terraces',async()=>{
 const module=await import('../assets/coyote-macroform.mjs');let samples=0,maxSeam=0;
 noRNG(()=>{for(let a=-32;a<=173;a+=.43)for(let q=-1.1;q<=1.1;q+=.09){const h=module.coyoteNorthMacroHeight(Math.abs(q),q,a,Math.abs(q));assert(Number.isFinite(h)&&h>=0&&h<29);samples++;}for(const a of module.COYOTE_MACRO_CONTROLS.northCrown.map(n=>n[0]))for(const q of[-.75,-.3,0,.3,.75]){const h=1e-4,mid=module.coyoteNorthMacroHeight(Math.abs(q),q,a,Math.abs(q)),left=module.coyoteNorthMacroHeight(Math.abs(q),q,a-h,Math.abs(q)),right=module.coyoteNorthMacroHeight(Math.abs(q),q,a+h,Math.abs(q)),jump=Math.max(Math.abs(mid-left),Math.abs(right-mid));maxSeam=Math.max(maxSeam,jump);assert(jump<.001);}for(const a of[23,77,95,132])for(const q of[-1.08,1.08])assert.equal(module.coyoteNorthMacroHeight(1.08,q,a,1.08),0);});
 const crowns=[23,77,95,132].map(a=>module.coyoteNorthMacroHeight(0,0,a,0));assert(crowns[0]>crowns[1]+10&&crowns[2]>crowns[3]+10);proof.numeric={samples,maxCrownSeamChangeAt01mm:maxSeam,crowns};
});

test('actual existing flora tree writer reanchors physical roots while preserving XZ, proportions, colors, occupancy and future seed stream',()=>{
 const flora=fs.readFileSync(new URL('assets/features/world-flora.js',root),'utf8'),a=flora.indexOf(' function tree('),b=flora.indexOf(' function snag(',a);assert(a>0&&b>a);const code=flora.slice(a,b);
 function world(h){const geo=new T.BoxGeometry(),mat=new T.MeshBasicMaterial(),BANK={pine:{im:new T.InstancedMesh(geo,mat,80),n:0,cap:80},trunk:{im:new T.InstancedMesh(geo,mat,80),n:0,cap:80}},F={treeOwners:[]},W={sceneryArt:{containsWaterfall:()=>false},colliders:[],forestPoints:[]},occ=[];let state=0x9e3779b9,draws=0;const rnd=()=>{draws++;state|=0;state=state+0x6D2B79F5|0;let t=Math.imul(state^state>>>15,1|state);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const put=new Function('G','W','BANK','groundH','F','TREE','BARK','_e','_q','_sc','_v','_m','_col','rnd','addOcc',code+'return tree;')({vistas:{clearZones:[]}},W,BANK,h,F,{pine:'#dfeccd'},{pine:'#cdc2ad'},new T.Euler(),new T.Quaternion(),new T.Vector3(),new T.Vector3(),new T.Matrix4(),new T.Color(),rnd,(...v)=>occ.push(v));return{put,BANK,W,F,occ,rnd,draws:()=>draws};}
 const A=world(oldHeight),B=world(newHeight),sites=changed.filter((_,i)=>i%31===0).slice(0,60);for(const i of sites){const x=i%n*step-500,z=Math.floor(i/n)*step-500;assert(A.put('pine',x,z,6.7,.72));assert(B.put('pine',x,z,6.7,.72));}
 assert.equal(A.draws(),B.draws());assert.deepEqual(Array.from({length:24},A.rnd),Array.from({length:24},B.rnd));assert.deepEqual(A.W.colliders,B.W.colliders);assert.deepEqual(A.W.forestPoints,B.W.forestPoints);assert.deepEqual(A.occ,B.occ);let moved=0;
 for(const kind of['pine','trunk']){const a=A.BANK[kind],b=B.BANK[kind];assert.equal(a.n,b.n);assert.deepEqual(a.im.instanceColor.array,b.im.instanceColor.array);for(let i=0;i<a.n;i++){const aa=a.im.instanceMatrix.array.subarray(i*16,i*16+16),bb=b.im.instanceMatrix.array.subarray(i*16,i*16+16);for(let k=0;k<16;k++)if(k!==13)assert.equal(aa[k],bb[k]);assert.equal(bb[13],Math.fround(newHeight(bb[12],bb[14])-.05*6.7));if(aa[13]!==bb[13])moved++;}}
 assert.equal(moved,sites.length*2);proof.floraWriter={source:'Actual existing tree function',syntheticAffectedSites:sites.length,canopyTrunkRootsMoved:moved,drawsExact:A.draws(),future24Exact:true,footprintsColorsOccupancyExact:true,nativeScannedModelReanchoring:'Still pending root native comparison.'};
});

after(()=>{if(process.env.NORTH_RIM_CPU_OUTPUT)fs.writeFileSync(process.env.NORTH_RIM_CPU_OUTPUT,JSON.stringify(proof,null,2)+'\n');});
