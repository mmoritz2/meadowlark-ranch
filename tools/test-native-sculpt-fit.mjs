/* Real source loader and production controller. Baseline files are deliberately
 * external: this reports fit changes without rewriting historical geometry pins.
 * Usage: node tools/test-native-sculpt-fit.mjs --baseline-dir=/tmp/... [--ids=percheron,shire,clyde] [--report=/tmp/fit.json]
 * Contact neighborhoods are numerical fit proxies; visible containment still
 * needs front/side/quarter review with the actual rendered eye and tack. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('='),baselineDir=arg('baseline-dir');
assert(baselineDir,'Supply the fixed pre-sculpt baseline directory; no automatic rebaseline');
const baseline=JSON.parse(fs.readFileSync(resolve(baselineDir,'manifest.json'))),current=JSON.parse(fs.readFileSync(new URL('assets/models/native-roster/manifest.json',root)));
const ids=arg('ids')?.split(',')||Object.keys(current.breeds),hash=a=>createHash('sha256').update(a).digest('hex');
const threeURL=new URL('assets/vendor/three/build/three.module.js',root).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`));
const THREE=await import(threeURL),{GLTFLoader}=await import(new URL('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js',root)),{clone}=await import(new URL('assets/vendor/three/examples/jsm/utils/SkeletonUtils.js',root));
const {createBreedLibrary}=await import(new URL('assets/breed-models.js',root)),{createNativeHorseMotion}=await import(new URL('assets/native-horse-motion.js',root));
const snapshot=new Map();for(const id of ids){const row=baseline.breeds[id];assert(row,id+' baseline missing');const b=fs.readFileSync(resolve(baselineDir,id+'.bin'));assert.equal(hash(b),row.sha256,id+' immutable baseline digest');snapshot.set(row.sha256,b);}
let chosenManifest=baseline;const originalFetch=global.fetch;
global.fetch=async input=>{const url=new URL(input);assert.equal(url.protocol,'file:','No network');if(url.pathname.endsWith('/models/native-roster/manifest.json'))return new Response(JSON.stringify(chosenManifest));const old=snapshot.get(url.searchParams.get('build'));return new Response(old||fs.readFileSync(fileURLToPath(url)));};
class SourceLoader extends GLTFLoader{constructor(manager){super(manager);this.register(()=>({name:'CPU_IMAGE_ONLY',loadTexture(){return Promise.resolve(new THREE.Texture());}}));}async loadAsync(input){const b=fs.readFileSync(fileURLToPath(new URL(input)));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}}
const cpuTHREE={...THREE,TextureLoader:class{async loadAsync(){return new THREE.Texture();}}};
const oldLibrary=createBreedLibrary({THREE:cpuTHREE,GLTFLoader:SourceLoader,clone});await oldLibrary.manifestReady;chosenManifest=current;
const newLibrary=createBreedLibrary({THREE:cpuTHREE,GLTFLoader:SourceLoader,clone});await newLibrary.manifestReady;
const vec=()=>new THREE.Vector3(),skins=rig=>{const rows=[];rig.nativeRoot.traverse(m=>{if(m.isSkinnedMesh&&[16159,2028,13895,5092].includes(m.geometry.attributes.position.count))rows.push(m);});return rows;};
function points(mesh){const p=mesh.geometry.attributes.position,out=new Float64Array(p.count*3),v=vec();for(let i=0;i<p.count;i++){mesh.getVertexPosition(i,v);mesh.localToWorld(v);assert(v.toArray().every(Number.isFinite),'Finite actual posed skin');v.toArray(out,i*3);}return out;}
const at=(a,i)=>vec().fromArray(a,i*3),distance=(a,i,b,j)=>Math.hypot(a[i*3]-b[j*3],a[i*3+1]-b[j*3+1],a[i*3+2]-b[j*3+2]);
const collarRanges=[[0,43],[76,196],[426,531],[754,976],[3348,3428],[3601,3823],[4053,4158],[5369,5393],[5517,5690],[5826,5999],[7416,7646],[8356,8586],[9508,9738],[9782,9802],[9810,9855],[9892,10064],[11392,11412],[11522,11542],[12073,12224]];
const inCollar=i=>collarRanges.some(([a,b])=>i>=a&&i<=b),quantile=(a,t)=>a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*t))];
function nearestPairs(from,ids,to,targets){return ids.map(i=>{let best=Infinity,j=-1;for(const k of targets){const d=distance(from,i,to,k);if(d<best){best=d;j=k;}}return {i,j,restDistanceM:best};});}
function landmarks(rig,rest){
 const body=rig.skin,eye=skins(rig).find(m=>m.geometry.attributes.position.count===2028),tack=rig.nativeContacts.tack,bodyP=rest.get(body),eyeP=rest.get(eye),tackP=rest.get(tack),scale=rig.profile.fitScale;
 const bodyIds=Array.from({length:bodyP.length/3},(_,i)=>i),names=body.skeleton.bones.map(b=>b.name),lid=names.map((n,i)=>/^(upper|lower)eyelid_[lr]_/.test(n)?i:-1).filter(i=>i>=0),lidWeight=(mesh,i)=>{const a=mesh.geometry.attributes;let w=0;for(let c=0;c<4;c++)if(lid.includes(a.skinIndex.getComponent(i,c)))w+=a.skinWeight.getComponent(i,c);return w;};
 const lidIds=bodyIds.filter(i=>lidWeight(body,i)>.95),globeIds=Array.from({length:eyeP.length/3},(_,i)=>i).filter(i=>lidWeight(eye,i)<.001);
 assert(lidIds.length>15&&globeIds.length>100,'Real lid and globe vertices identified');
 const headIds=bodyIds.filter(i=>bodyP[i*3+2]>.75*scale&&bodyP[i*3+1]>1.15*scale),headTack=Array.from({length:tackP.length/3},(_,i)=>i).filter(i=>!inCollar(i)&&tackP[i*3+2]>.75*scale&&tackP[i*3+1]>1.15*scale).filter((_,i)=>i%17===0);
 const bodyTack=Array.from({length:tackP.length/3},(_,i)=>i).filter(inCollar).filter((_,i)=>i%29===0);
 const head=nearestPairs(tackP,headTack,bodyP,headIds).filter(p=>p.restDistanceM<.045),collar=nearestPairs(tackP,bodyTack,bodyP,bodyIds).filter(p=>p.restDistanceM<.080),eyes=nearestPairs(bodyP,lidIds,eyeP,globeIds);
 assert(head.length>20&&collar.length>20,'Actual close-fitting tack neighborhoods');
 const seat=rig.nativeSeatFollower.getWorldPosition(vec()),seatBody=bodyIds.reduce((best,i)=>seat.distanceTo(at(bodyP,i))<seat.distanceTo(at(bodyP,best))?i:best,0);
 return{eye,tack,head,collar,eyes,seatBody};
}
function summarizePairs(pairs,from,to){const ds=pairs.map(p=>distance(from,p.i,to,p.j));return{maxM:Math.max(...ds),p95M:quantile(ds,.95),medianM:quantile(ds,.5),distances:ds};}
function mappedDrift(pairs,oldA,oldB,newA,newB){let max=0;for(const p of pairs){const old=at(oldA,p.i).sub(at(oldB,p.j)),now=at(newA,p.i).sub(at(newB,p.j));max=Math.max(max,now.sub(old).length());}return max;}
function sourceState(rig){const h=createHash('sha256');h.update(JSON.stringify({bones:rig.bones.map(b=>[b.name,b.parent?.name,b.position.toArray(),b.quaternion.toArray(),b.scale.toArray()]),binds:rig.skin.skeleton.boneInverses.map(b=>b.toArray())}));for(const c of rig.animations){h.update(c.name+':'+c.duration);for(const t of c.tracks){h.update(t.name+':'+t.ValueTypeName+':'+t.createInterpolant.toString());for(const a of [t.times,t.values])h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}}return h.digest('hex');}
const started=performance.now(),report={baselineDir:resolve(baselineDir),gates:{addedHeadstallP95M:.010,addedCollarP95M:.015,addedLidGlobeP95M:.004,seatNeighborhoodOffsetM:.015,newBodyFloorPenetrationM:.006},scope:'Actual posed lid/globe and mapped tack neighborhoods; source clips and contacts preserved; numerical fit requires rendered review.',rows:[],failures:[]};
try{for(const id of ids){
 const old=oldLibrary.instantiate(await oldLibrary.load(id),{materialPolish:false}),now=newLibrary.instantiate(await newLibrary.load(id),{materialPolish:false});
 const oldMeshes=skins(old),newMeshes=skins(now);assert.equal(oldMeshes.length,4);assert.equal(newMeshes.length,4);assert.equal(old.bones.length,677);assert.equal(sourceState(old),sourceState(now),id+' original rig/poses/clips changed');
 assert.equal(hash(fs.readFileSync(new URL('assets/'+current.breeds[id].file,root))),current.breeds[id].sha256,id+' candidate manifest matches current binary');
 for(let m=0;m<oldMeshes.length;m++){const a=oldMeshes[m],b=newMeshes[m],count=a.geometry.attributes.position.count;assert.equal(b.geometry.attributes.position.count,count);assert.deepEqual(b.geometry.index.array,a.geometry.index.array,id+' topology unchanged');for(const name of ['uv','skinIndex','skinWeight']){const aa=a.geometry.attributes[name],bb=b.geometry.attributes[name];if(!aa)continue;for(let i=0;i<aa.count;i++){if(count===13895&&inCollar(i)&&name!=='uv')continue;for(let k=0;k<aa.itemSize;k++)assert.equal(bb.getComponent(i,k),aa.getComponent(i,k),id+' protected '+name);}}}
 for(const rig of [old,now])rig.scene.updateMatrixWorld(true);
 const rest=new Map(oldMeshes.map(m=>[m,points(m)])),L=landmarks(old,rest),newEye=newMeshes.find(m=>m.geometry.attributes.position.count===2028),newTack=now.nativeContacts.tack;
 const row={id,baselineSha:baseline.breeds[id].sha256,candidateSha:current.breeds[id].sha256,points:{headstall:L.head.length,collar:L.collar.length,lids:L.eyes.length},poses:0,maxima:{},minimumBodyFloorM:Infinity,rest:{}};report.rows.push(row);
 // Identical deterministic expression seeds remove unrelated per-actor ear/breath offsets.
 now.nativeRoot.uuid=old.nativeRoot.uuid;
 const motions=[old,now].map(rig=>createNativeHorseMotion({THREE,root:rig.nativeRoot,clips:rig.animations,profile:rig.profile}));
 const update=dt=>{for(let i=0;i<2;i++){motions[i].update(dt);[old,now][i].scene.updateMatrixWorld(true);}};
 function measure(context){
  const a=points(old.skin),b=points(now.skin),ae=points(L.eye),be=points(newEye),atack=points(L.tack),btack=points(newTack);
  let oldFloor=Infinity,newFloor=Infinity;for(let i=1;i<a.length;i+=3){oldFloor=Math.min(oldFloor,a[i]);newFloor=Math.min(newFloor,b[i]);}
  const metrics={bodyFloorM:newFloor,baselineBodyFloorM:oldFloor,addedFloorPenetrationM:Math.max(0,oldFloor-newFloor),headstallFitDeltaM:mappedDrift(L.head,atack,a,btack,b),collarFitDeltaM:mappedDrift(L.collar,atack,a,btack,b),lidGlobeFitDeltaM:mappedDrift(L.eyes,a,ae,b,be)};
  for(const [name,pairs,aa,ab,ba,bb]of [['headstall',L.head,atack,a,btack,b],['collar',L.collar,atack,a,btack,b],['lidGlobe',L.eyes,a,ae,b,be]]){const before=summarizePairs(pairs,aa,ab),after=summarizePairs(pairs,ba,bb);metrics[name+'P95M']=after.p95M;metrics[name+'AddedGapP95M']=quantile(after.distances.map((v,i)=>v-before.distances[i]),.95);}
  metrics.seatSkinFitDeltaM=now.nativeSeatFollower.getWorldPosition(vec()).sub(at(b,L.seatBody)).sub(old.nativeSeatFollower.getWorldPosition(vec()).sub(at(a,L.seatBody))).length();
  for(const [name,ranges]of [['bit',[[7894,8124],[6954,7184]]],['stirrup',[[2792,2845],[2716,2769]]]]){let drift=0;for(const[lo,hi]of ranges)for(let i=lo;i<=hi;i++)drift=Math.max(drift,distance(atack,i,btack,i));metrics[name+'PositionDeltaM']=drift;}
  row.poses++;row.minimumBodyFloorM=Math.min(row.minimumBodyFloorM,newFloor);if(row.baselineSha===row.candidateSha)for(const key of ['headstallFitDeltaM','collarFitDeltaM','lidGlobeFitDeltaM','seatSkinFitDeltaM','bitPositionDeltaM','stirrupPositionDeltaM'])assert(metrics[key]<1e-8,id+' identical prepared assets must have exact matching contacts: '+key);if(context.mode==='rest')row.rest={...metrics};for(const [key,value]of Object.entries(metrics)){assert(Number.isFinite(value),id+' finite '+key);if(!row.maxima[key]||value>row.maxima[key].value)row.maxima[key]={value,...context};}
  if(newFloor<Math.min(-.006,oldFloor-.006))report.failures.push({id,...context,issue:'New body-floor penetration',oldFloor,newFloor});
  for(const [key,limit]of [['headstallAddedGapP95M',.010],['collarAddedGapP95M',.015],['lidGlobeAddedGapP95M',.004],['seatSkinFitDeltaM',.015]])if(metrics[key]>limit)report.failures.push({id,...context,issue:key,value:metrics[key],limit});
 }
 for(const mode of ['rest','walk','trot','canterLeft','canterRight','gallopLeft','gallopRight','jump']){
  for(const m of motions){m.reset();m.set(mode);m.update(.25,{rate:0});}for(const rig of [old,now])rig.scene.updateMatrixWorld(true);
  const duration=mode==='rest'?0:mode==='jump'?now.profile.nativeJump.durationS:now.profile.nativeGaits[mode].durationS;
  let at=0;for(const phase of mode==='rest'?[0]:Array.from({length:17},(_,i)=>i/16)){while(at<duration*phase-1e-9){const dt=Math.min(1/60,duration*phase-at);update(dt);at+=dt;}measure({mode,phase});}
 }
 for(const type of ['graze','rear']){for(const m of motions){m.reset();assert(m.startAction(type));}const duration=motions[1].actionDescriptor(type).durationS;let at=0;for(const phase of [0,.125,.2,.25,.375,.5,.625,.75,.875,.98]){while(at<duration*phase-1e-9){const dt=Math.min(1/60,duration*phase-at);update(dt);at+=dt;}measure({mode:type,phase});}}
 for(const m of motions)m.dispose();console.log(JSON.stringify({id,poses:row.poses,maxima:row.maxima}));
 }
 report.pass=!report.failures.length;report.elapsedMs=performance.now()-started;if(arg('report'))fs.writeFileSync(arg('report'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,horses:report.rows.length,poses:report.rows.reduce((n,r)=>n+r.poses,0),failures:report.failures.slice(0,25)},null,2));if(!report.pass)process.exitCode=1;
}finally{global.fetch=originalFetch;}
