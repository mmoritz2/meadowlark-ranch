import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {frostpineTransitionAt as field,FROSTPINE_TRANSITION_BOUNDS as bounds,FROSTPINE_TRANSITION_GLSL as glsl,FROSTPINE_TRANSITION_PROFILE as profile} from '../assets/frostpine-transition.mjs';
import * as cold from '../assets/cold-woodland.mjs';
import {buildFrostpineTarn,frostpinePackedSupport} from '../assets/frostpine-village.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const fixture=JSON.parse(read('tools/fixtures/frostpine-transition-95db0ef/actual-inputs.json'));
const recipe=JSON.parse(read('tools/fixtures/frostpine-transition-95db0ef/source-edits.json'));
const recover=entry=>{let s=read(entry.path);assert.equal(sha(s),entry.sha256);for(const e of entry.edits.slice().reverse()){assert.equal(s.split(e.new).length-1,e.count);s=s.replace(e.new,e.old);}assert.equal(sha(s),entry.preimageSHA256);return s;};
const oldSources=Object.fromEntries(recipe.files.map(e=>[e.path,recover(e)]));
const oldCold=await import('data:text/javascript;base64,'+Buffer.from(oldSources['assets/cold-woodland.mjs']).toString('base64'));
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const actualTerrain=JSON.parse(read('tools/fixtures/frostpine-village-f2ecb9c/actual-inputs.json'));
const stats={profile,sourceParent:fixture.parent,geometryPolicy:'No geometry, physical surface, water, route or tree source modification; existing decorative floor policies and fragment surface only.'};

test('exact functional preimages recover while physical, tree and existing consumer bodies remain unchanged',()=>{
 assert.equal(recipe.files.length,2);
 for(const name of ['coldWoodlandWeights','coldWoodlandProfile'])assert.equal(cold[name].toString(),oldCold[name].toString());
 for(const path of ['assets/falls-landscape.js','assets/frostpine-village.mjs','assets/features/world-quarters.js','assets/world-photoscans.js']){
  // Cache ancestors may acquire queries independently. Their functional body
  // stays exactly this current source; compare after stripping import queries.
  const s=read(path).replace(/\?v=[^'"\s]+/g,'');assert.equal(sha(s),fixture.functionalOwnerHashes[path],path);
 }
 for(const [path,blocks]of Object.entries(fixture.consumerBlocks))for(const b of blocks){const s=read(path),a=s.indexOf(b.begin),z=s.indexOf(b.end,a);assert.ok(a>=0&&z>a);assert.equal(sha(s.slice(a,z)),b.sha256,path+' '+b.begin);}
 assert.equal(field(-150,-232).weight,0);assert.equal(field(-160,-210).weight,0);assert.equal(field(-150,-333).weight,0);
});

test('shared field is finite, bounded, compact and independent of visitation or global RNG',()=>{
 let calls=0;const previous=Math.random;Math.random=()=>{calls++;throw Error('Field consumed RNG');};
 try{for(let z=-520;z<=520;z+=7)for(let x=-520;x<=520;x+=7){const f=field(x,z);for(const v of Object.values(f))assert.ok(Number.isFinite(v)&&v>=0&&v<=1);if(x<=bounds.x0||x>=bounds.x1||z<=bounds.z0||z>=bounds.z1)assert.deepEqual(f,{weight:0,deposit:0,pasture:1,scour:0});assert.deepEqual(f,field(x,z));}}finally{Math.random=previous;}assert.equal(calls,0);
 for(const [x,z]of [[NaN,-300],[-300,Infinity],[Infinity,Infinity]])assert.equal(field(x,z).weight,0);
});

test('regional shape has connected thaw corridors, unequal snow banks and a continuous mixed boundary',()=>{
 let active=0,weightedArea=0,fullSnow=0,thaw=0,maxStep=0;const open=new Set(),dryPoints=[];
 for(let z=-478;z<=-190;z+=2)for(let x=-468;x<=-212;x+=2){const a=field(x,z);if(a.weight===0)continue;active++;weightedArea+=a.weight*4;if(a.deposit>.7)fullSnow+=4;if(a.weight>.8&&a.deposit<.25){thaw+=4;open.add(x+','+z);dryPoints.push([x,z]);}for(const[dx,dz]of [[.1,0],[0,.1]]){const b=field(x+dx,z+dz);maxStep=Math.max(maxStep,Math.abs(a.weight*a.deposit-b.weight*b.deposit));}}
 let largest=0,components=0;const pending=new Set(open);while(pending.size){components++;const key=pending.values().next().value,stack=[key];pending.delete(key);let size=0;while(stack.length){const p=stack.pop(),[x,z]=p.split(',').map(Number);size++;for(const[dx,dz]of [[2,0],[-2,0],[0,2],[0,-2]]){const k=(x+dx)+','+(z+dz);if(pending.delete(k))stack.push(k);}}largest=Math.max(largest,size);}
 assert.ok(weightedArea>35000&&weightedArea<55000);assert.ok(fullSnow>20000);assert.ok(thaw>3500&&thaw<10000);assert.ok(largest/open.size>.88,'Thaw is scattered islands rather than connected ground');assert.ok(maxStep<.025,'Visible weighted field has an abrupt seam');
 const a=field(-400,-310),b=field(-350,-370);assert.ok(a.deposit>b.deposit+.5,'Unequal flank/deposit silhouette missing');
 stats.field={activeGridSites:active,weightedAreaM2:weightedArea,fullSnowAreaM2:fullSnow,connectedLowDepositAreaM2:thaw,largestThawComponentFraction:largest/open.size,components,maxWeightedSnowStepAtPoint1m:maxStep,actualViewSite:field(...fixture.native.view.player)};
});

test('actual shader field evaluates the same deposit, cover and influence as the CPU consumers',()=>{
 let body=glsl.slice(glsl.indexOf('{')+1,glsl.lastIndexOf('}'));
 body=body.replace('vec2 d=p+vec2(314.0,334.0);','let d=vec2(p.x+314.0,p.y+334.0);').replace('length(d/vec2(150.0,143.0))','Math.hypot(d.x/150.0,d.y/143.0)').replace(/\bfloat\s+/g,'let ');
 const run=new Function('p','vec2','vec3','dot','sin','abs','max','clamp','smoothstep',body),v2=(x,y)=>({x,y}),v3=(x,y,z)=>[x,y,z];
 let maxError=0;for(let z=-490;z<=-180;z+=3.7)for(let x=-480;x<=-200;x+=3.9){const a=field(x,z),b=run(v2(x,z),v2,v3,(a,b)=>a.x*b.x+a.y*b.y,Math.sin,Math.abs,Math.max,(v,a,b)=>Math.max(a,Math.min(b,v)),smooth);for(const [i,k]of ['deposit','pasture','weight'].entries()){maxError=Math.max(maxError,Math.abs(a[k]-b[i]));assert.ok(Math.abs(a[k]-b[i])<1e-12);}}
 stats.sharedShaderCPU={actualGLSLBodyExecuted:true,arithmetic:'JS-number evaluation of actual GLSL scalar body, with only two explicit vec2 operator translations; native Float32 compiler pending',maxError};
});

test('all 351 actual native tree profile inputs retain their exact original outputs',()=>{
 assert.equal(fixture.actualTrees.length,351);let calls=0;const previous=Math.random;Math.random=()=>{calls++;throw Error('Profile consumed RNG');};
 try{for(const t of fixture.actualTrees){for(const grade of [0,.3,.8]){const s={x:t.x,z:t.z,source:t.source,height:t.height,elevation:t.matrix[13],grade};assert.deepEqual(cold.coldWoodlandProfile(s),oldCold.coldWoodlandProfile(s));}assert.deepEqual(cold.coldWoodlandWeights(t.x,t.z),oldCold.coldWoodlandWeights(t.x,t.z));}}finally{Math.random=previous;}assert.equal(calls,0);
 stats.actualTrees={count:fixture.actualTrees.length,sourceHeightProfileOutputs:'exact parent at actual input coordinates/elevation and three grades',sourceXZAndMatrices:'unchanged source and native baseline input; final native binding required'};
});

test('existing floor APIs preserve every outside result and place dormant cover in actual scours',()=>{
 let outside=0,changed=0,maxStep=0;for(let z=-500;z<500;z+=5)for(let x=-500;x<500;x+=5){const a=field(x,z),c=cold.coldPastureCover(x,z);assert.ok(Number.isFinite(c)&&c>=0&&c<=1);if(a.weight===0){outside++;assert.equal(c,oldCold.coldPastureCover(x,z));for(const kind of ['tuft','petal','brack','reed','scrub','juni','sage'])assert.deepEqual(cold.coldCoverProfile(x,z,kind),oldCold.coldCoverProfile(x,z,kind));}else{if(c!==oldCold.coldPastureCover(x,z))changed++;for(const kind of ['tuft','petal','brack','reed','scrub','juni','sage']){const p=cold.coldCoverProfile(x,z,kind);if(p){assert.ok(p.density>=0&&p.density<=1&&p.size>0&&p.size<=1);if(kind==='petal')assert.equal(p.density,0);if(a.weight===1&&a.deposit>=.82)assert.equal(p.density,0);}}}maxStep=Math.max(maxStep,Math.abs(c-cold.coldPastureCover(x+.1,z+.1)));}
 assert.ok(outside>37000&&changed>1000);assert.ok(cold.coldPastureCover(-300,-320)>.1&&cold.coldPastureCover(-300,-320)<.4);assert.ok(cold.coldCoverProfile(-300,-320,'scrub').tintAmount>.45);assert.ok(maxStep<.025);stats.floor={outsideSamplesExact:outside,changedSamples:changed,maxStepAtPoint1m:maxStep};
});

test('actual existing static winter postpass keeps outside bytes, proposed XZ and grounded roots without random draws',()=>{
 const source=read('assets/features/world-flora.js'),start=source.indexOf(' /* ---- 6l. winter woodland floor'),end=source.indexOf(' /* ---- 6m. the shared grazed field interiors',start),run=new Function('THREE','BANK','_m','_v','_q','_sc','_col','hsh','groundH','coldCoverProfile','F',source.slice(start,end));
 const points=[...fixture.actualTrees.slice(0,32).map(t=>[t.x,t.z]),[-300,-320],[-400,-310],[15.123,35.287],[300,-300],[-150,-232]];
 const groundH=(x,z)=>Math.sin(x*.03)*.12+Math.cos(z*.04)*.18,hsh=(x,z)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};
 const geo=new THREE.BoxGeometry(.1,1,.1),mat=new THREE.MeshBasicMaterial({vertexColors:true}),BANK={},before={};const m=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(),c=new THREE.Color();
 for(const kind of ['tuft','petal','brack','reed','scrub','juni','sage','trunk']){const im=new THREE.InstancedMesh(geo,mat,points.length);before[kind]=[];points.forEach(([x,z],i)=>{q.setFromEuler(new THREE.Euler(.03,i*.71,.02));m.compose(v.set(x,groundH(x,z)+.03,z),q,s.set(.7,.9,.8));im.setMatrixAt(i,m);c.setRGB(.32,.47,.21);im.setColorAt(i,c);before[kind].push({m:Array.from(im.instanceMatrix.array.slice(i*16,i*16+16)),c:Array.from(im.instanceColor.array.slice(i*3,i*3+3))});});BANK[kind]={im,n:points.length};}
 let randomCalls=0;const previous=Math.random,F={};Math.random=()=>{randomCalls++;throw Error('Postpass consumed RNG');};try{run(THREE,BANK,new THREE.Matrix4(),new THREE.Vector3(),new THREE.Quaternion(),new THREE.Vector3(),new THREE.Color(),hsh,groundH,cold.coldCoverProfile,F);}finally{Math.random=previous;}assert.equal(randomCalls,0);
 let outside=0,retained=0;for(const[kind,b]of Object.entries(BANK)){const originals=new Map(before[kind].map(t=>[t.m[12]+','+t.m[14],t]));for(let i=0;i<b.n;i++){const a=Array.from(b.im.instanceMatrix.array.slice(i*16,i*16+16)),color=Array.from(b.im.instanceColor.array.slice(i*3,i*3+3)),old=originals.get(a[12]+','+a[14]);assert.ok(old,'An original root moved');const change=kind==='trunk'?null:cold.coldCoverProfile(a[12],a[14],kind);if(!change){assert.deepEqual(a,old.m);assert.deepEqual(color,old.c);outside++;}else{const h=groundH(a[12],a[14]);assert.ok(Math.abs(a[13]-(h+(old.m[13]-h)*change.size))<2e-6);retained++;}}}
 assert.ok(outside>20&&retained>15&&F.winterCover.removed>15);stats.staticPostpass={outsideBytesExact:outside,retainedChanged:retained,...F.winterCover,randomCalls};
});

function terrainHarness(source){
 const prefix=source.slice(source.indexOf('export const COLD_SNOW_SURFACE'),source.indexOf('/* Ground materials authored')).replace(/export /g,''),constants=new Function(prefix+';return {COLD_SNOW_SURFACE,COLD_SNOW_GLSL};')();
 const start=source.indexOf('export function createTerrainSurface'),end=source.indexOf('export function createRiverMaterial',start),body=source.slice(start,end).replace('export function createTerrainSurface','function createTerrainSurface');
 const noOp=()=>0,globals={normalizeGroundRouteEntries:a=>a,applyChalkGrazingPixels:noOp,applyPastoralGrazingPixels:noOp,PASTORAL_COVER_PROFILE:'same-parent',HOLLOWPEAK_SNOW_GLSL:'// same-parent-Hollowpeak\n',HOLLOWPEAK_SNOW_PROFILE:'same-parent',applyNorthPastureGrazingPixels:noOp,NORTH_PASTURE_PROFILE:'same-parent',patchPastureMesoSurface:noOp,PASTURE_MESO_CACHE:'same-parent',createMeadowGrazingPixels:n=>new Uint8ClampedArray(n*n*4),extendWoodlandMask:()=>({texelsRaised:0}),cottonwoodReserved:()=>false,COYOTE_DRY_GLSL:'// same-parent-Coyote\n',FROSTPINE_TRANSITION_GLSL:glsl,FROSTPINE_TRANSITION_PROFILE:profile,...constants};
 const scheduled=[],paths=[],textures=[];const ctx={putImageData(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createRadialGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},lineTo(){},moveTo(){},stroke(){}};
 const document={createElement:()=>({getContext:()=>ctx})};class Loader{load(path,onload){const t=new THREE.Texture();t.userData.path=path;paths.push(path);textures.push(t);if(onload)scheduled.push(onload);return t;}}
 const T={...THREE,TextureLoader:Loader},make=new Function(...Object.keys(globals),'document','queueMicrotask','performance',body+';return createTerrainSurface;')(...Object.values(globals),document,f=>scheduled.push(f),{now:()=>0});
 let state=0x739a20fb,calls=0;const previous=Math.random;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 try{const out=make({THREE:T,renderer:{capabilities:{getMaxAnisotropy:()=>8}},grass:null,bump:null});while(scheduled.length)scheduled.shift()();const allocations=calls,future=Array.from({length:24},()=>Math.random()),sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};out.material.onBeforeCompile(sh);return{out,sh,paths,textures,allocations,future};}finally{Math.random=previous;}
}

test('actual material factory preserves constructors, future RNG, texture identities/paths and immutable borrowed maps',()=>{
 const a=terrainHarness(oldSources['assets/terrain-realism.js']),b=terrainHarness(read('assets/terrain-realism.js'));
 assert.equal(a.allocations,b.allocations);assert.deepEqual(a.future,b.future);assert.deepEqual(a.paths,b.paths);assert.equal(a.textures.length,b.textures.length);assert.equal(a.out.material.type,b.out.material.type);
 for(let i=0;i<a.textures.length;i++){const x=a.textures[i],y=b.textures[i];for(const k of ['colorSpace','wrapS','wrapT','anisotropy'])assert.equal(x[k],y[k]);assert.deepEqual(x.repeat.toArray(),y.repeat.toArray());assert.deepEqual(x.offset.toArray(),y.offset.toArray());assert.deepEqual(x.matrix.toArray(),y.matrix.toArray());}
 const snow=b.out.material.userData.snowSurface.color;assert.equal(snow,b.sh.uniforms.terrainSnow);assert.equal(snow.value.userData.path,'./assets/textures/cold/snow_02_diff_2k.webp');assert.ok(b.sh.fragmentShader.includes(glsl));assert.ok(b.out.material.customProgramCacheKey().endsWith(profile));
 stats.material={actualFactoryExecuted:true,textureIO:'resident THREE objects with a loader recorder; no GPU/network',textureAllocations:b.textures.length,globalConstructorRandomCalls:b.allocations,future24Exact:true,newTextures:0,newGeometry:0,newMeshes:0,borrowedMapTransformsUnchanged:true,profileKey:b.out.material.customProgramCacheKey()};
});

test('shader snow albedo and powder normals use the same packed-path-adjusted deposit fraction on all tiers',()=>{
 const {sh}=terrainHarness(read('assets/terrain-realism.js')),s=sh.fragmentShader;
 assert.ok(s.includes('float frostDeposit=frostFloor.x*(1.0-wear*.72);'));assert.ok(s.includes('float frostPowderAmount=mix(frostDeposit,.30,wear*.65);'));assert.ok(s.includes('coldPowder=mix(coldPowder,frostPowderAmount,frostFloor.z);'));assert.ok(s.includes('vec3 frostSurface=mix(frostHeath,frostPowder,frostDeposit);'));assert.ok(s.includes('frostSurface=mix(frostSurface,frostPackedSurface,wear*.65);'));
 const region=s.slice(s.indexOf('vec3 frostFloor='),s.indexOf('float quarters ='));assert.ok(region.includes('#ifndef OUTER_LANDSCAPE'));assert.ok(!region.includes('CHEAP_GROUND'),'Low/High use different snow coverage');assert.ok(!/\b(?:float|vec[234])\s+(?:packed|input|output|sample|filter|active)\b/.test(glsl+s.slice(s.indexOf('vec3 frostFloor='),s.indexOf('soilWeight*=soilReady;'))),'New shader declaration uses a reserved GLSL identifier');assert.ok(s.includes('earth=texture2D(terrainForest,earthUV).rgb'));assert.ok(s.includes('powderNormal'), 'Existing analytic snow normal field disappeared');
 let maxError=0;for(let d=0;d<=1;d+=.05)for(let wear=0;wear<=1;wear+=.05){const deposit=d*(1-wear*.72),materialSnow=deposit*(1-wear*.65)+.30*wear*.65,powderAmount=deposit+(.30-deposit)*wear*.65;maxError=Math.max(maxError,Math.abs(materialSnow-powderAmount));assert.ok(Math.abs(materialSnow-powderAmount)<1e-14);}
 stats.powderNormal={actualShaderFractionMatched:true,maxAlgebraicError:maxError,tierCoverage:'identical CPU/GLSL field; native Low/High pixels pending'};
});

test('accepted actual tarn packed geometry/support and terrain solver stay independent of the floor field',()=>{
 assert.equal(sha(readFileSync(new URL('../assets/frostpine-village.mjs',import.meta.url))),fixture.sourceOwners['assets/frostpine-village.mjs']);const input=actualTerrain.canonicalTerrain;
 const model=buildFrostpineTarn({center:actualTerrain.anchors.tat,level:actualTerrain.anchors.lvl,approach:actualTerrain.anchors.bunk,terrain:input});
 const support=frostpinePackedSupport(model.topFaces),ice=frostpinePackedSupport(model.iceFaces),before=sha(Buffer.from(support.positions.buffer));let finite=0,icePoints=0;
 for(let z=model.center[1]-15;z<=model.center[1]+15;z+=.5)for(let x=model.center[0]-15;x<=model.center[0]+15;x+=.5){const a=support.heightAt(x,z),w=ice.heightAt(x,z);field(x,z);cold.coldPastureCover(x,z);cold.coldCoverProfile(x,z,'scrub');assert.equal(support.heightAt(x,z),a);assert.equal(ice.heightAt(x,z),w);if(Number.isFinite(a))finite++;if(Number.isFinite(w))icePoints++;}
 assert.ok(finite>700&&icePoints>300);assert.equal(sha(Buffer.from(support.positions.buffer)),before);stats.physical={actualProtectedFixture:true,supportQueries:3721,finiteSupport:finite,icePoints,supportTriangles:support.triangles,supportBufferSHA256:before,canonicalNativeSHA256:fixture.native.canonicalSHA256,physics:'No changed height or support authority; existing exact ice-only pond predicate is outside author scope'};
});

test('resident photographic materials are the existing files with no new download or image transform',()=>{
 for(const[path,proof]of Object.entries(fixture.residentTextures)){const b=readFileSync(new URL('../'+path,import.meta.url));assert.equal(b.length,proof.bytes);assert.equal(sha(b),proof.sha256);}
 stats.residentTextures=fixture.residentTextures;
});

test.after(()=>{if(process.env.FROSTPINE_STATS)writeFileSync(process.env.FROSTPINE_STATS,JSON.stringify(stats,null,2)+'\n');});
