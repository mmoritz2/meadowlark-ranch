// Portable, read-only CPU verification of the actual massif constructor.
// node verify-horn-geometry.mjs --runtime-root REPO --before WORLD_VISTAS_JS
//   --after CANDIDATE_WORLD_VISTAS_JS --before-helper BASELINE_HORN_RELIEF_MJS
//   --helper CANDIDATE_HORN_RELIEF_MJS [--native MASSIFS_JSON]
//   [--output REPORT_JSON]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
for(const key of ['runtime-root','before','after','before-helper','helper'])assert(args[key],`Missing --${key}`);
const root=resolve(args['runtime-root']),sha=v=>createHash('sha256').update(v).digest('hex');
const THREE=await import(pathToFileURL(join(root,'assets/vendor/three/build/three.module.js')));
const {regionalProfileAt}=await import(pathToFileURL(join(root,'assets/regional-landscape.mjs')));
const {hornRelief:beforeRelief}=await import(pathToFileURL(resolve(args['before-helper'])));
const {hornRelief}=await import(pathToFileURL(resolve(args.helper)));
const before=readFileSync(args.before,'utf8'),after=readFileSync(args.after,'utf8');
const report={scope:'Actual source constructor, CPU only. No native rendering or visual acceptance is inferred.',source:{before:sha(before),after:sha(after),beforeHelper:sha(readFileSync(args['before-helper'])),helper:sha(readFileSync(args.helper))},checks:[],metrics:{}};
function check(name,fn){const detail=fn();report.checks.push({name,pass:true,...(detail?{detail}:{})});}
function split(raw){
 const start=raw.indexOf(' const SKY_BASE='),end=raw.indexOf('\n P.MASSIFS=MASSIFS;');
 assert(start>0&&end>start,'Massif source section is identifiable');
 const ns=raw.indexOf(' function hash2('),ne=raw.indexOf('\n /* ============================================================================',ns);
 const cs=raw.indexOf(' const clamp='),ce=raw.indexOf(' const COMPASS=',cs);
 assert(ns>0&&ne>ns&&cs>0&&ce>cs);
 return {prefix:raw.slice(0,start),section:raw.slice(start,end),suffix:raw.slice(end),noise:raw.slice(ns,ne),clamps:raw.slice(cs,ce)};
}
const old=split(before),next=split(after);
function build(parts,relief=hornRelief,seed=123){
 const scene=new THREE.Scene(),dressing=[];let randomCalls=0,noiseCalls=0,noiseDigest=2166136261,state=seed;
 const oldRandom=Math.random;
 const recordNoise=(x,z)=>{noiseCalls++;noiseDigest=Math.imul(noiseDigest^(x|0),16777619);noiseDigest=Math.imul(noiseDigest^(z|0),16777619);};
 const noise=parts.noise.replace('function hash2(x,z){','function hash2(x,z){recordNoise(x,z);');
 assert.notEqual(noise,parts.noise,'Noise instrumentation must attach to production hash');
 Math.random=()=>{randomCalls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 try{
  const make=new Function('THREE','scene','G','dressLandscape','regionalProfileAt','hornRelief','recordNoise',parts.clamps+noise+parts.section+'\nreturn MASSIFS;');
  const massifs=make(THREE,scene,{renderer:{capabilities:{getMaxAnisotropy:()=>8}}},a=>dressing.push({wooded:a.wooded,regional:a.regional,fogScale:a.fogScale,fogCap:a.fogCap,bumpStrength:a.bumpStrength,anisotropy:a.anisotropy}),regionalProfileAt,relief,recordNoise);
  assert.equal(massifs.length,6,'All actual constructors succeed');
  return {massifs,scene,dressing,randomCalls,randomState:state,noiseCalls,noiseDigest:noiseDigest>>>0};
 } finally {Math.random=oldRandom;}
}
const a=build(old,beforeRelief),b=build(next,hornRelief),ah=a.massifs.find(m=>m.id==='horn'),bh=b.massifs.find(m=>m.id==='horn');
const g=bh.mesh.geometry,p=g.attributes.position,ix=g.index.array;
check('Only the background section and its one helper import changed',()=>{
 const strip=s=>s.replace(/^import \{hornRelief\} from '[^']+';\n/m,'');
 assert.equal(strip(next.prefix),strip(old.prefix));assert.equal(next.suffix,old.suffix);assert.equal(next.noise,old.noise);assert.equal(next.clamps,old.clamps);
});
check('Original mesh, material, navigation and triangle budgets remain fixed',()=>{
 assert.deepEqual(a.dressing,b.dressing);assert.equal(b.scene.children.length,6);
 for(let i=0;i<a.massifs.length;i++){
  const x=a.massifs[i],y=b.massifs[i];for(const k of ['id','label','bearing','dist','tris'])assert.equal(y[k],x[k]);
  assert.equal(y.mesh.geometry.index.count,x.mesh.geometry.index.count);assert.equal(y.mesh.geometry.attributes.position.count,x.mesh.geometry.attributes.position.count);
  assert.equal(y.mesh.material,bh.mesh.material);assert.equal(y.mesh.castShadow,false);assert.equal(y.mesh.receiveShadow,false);assert.equal(y.mesh.matrixAutoUpdate,false);
  assert.equal(y.mesh.userData.solidParts,undefined);for(const k of ['type','roughness','metalness','side','transparent','opacity','depthWrite','envMapIntensity','vertexColors'])assert.equal(y.mesh.material[k],x.mesh.material[k]);
 }
 assert.equal(ix.length/3,18816);assert.equal(p.count,9633);
});
check('Horn XZ, indices, winding and buried inner hem remain exact',()=>{
 assert.deepEqual(ix,ah.mesh.geometry.index.array);const ap=ah.mesh.geometry.attributes.position;
 for(let i=0;i<p.count;i++){assert.equal(p.getX(i),ap.getX(i));assert.equal(p.getZ(i),ap.getZ(i));if(Math.floor(i/169)/56<.055)assert.equal(p.getY(i),ap.getY(i));}
});
check('Other five massif attributes and emitted guide heights are byte exact',()=>{
 for(let j=1;j<a.massifs.length;j++){
  const x=a.massifs[j],y=b.massifs[j];assert.equal(x.id,y.id);assert.equal(y.height,x.height);
  assert.deepEqual(y.mesh.geometry.index.array,x.mesh.geometry.index.array);
  assert.deepEqual(Object.keys(y.mesh.geometry.attributes),Object.keys(x.mesh.geometry.attributes));
  for(const k of Object.keys(x.mesh.geometry.attributes))assert.deepEqual(y.mesh.geometry.attributes[k].array,x.mesh.geometry.attributes[k].array);
 }
});
check('All actual geometry attributes are finite and normals match triangle cross products',()=>{
 let minDoubleArea=Infinity,maxNormalError=0,minNormalLength=Infinity,maxNormalLength=0;
 for(const m of b.massifs){
  const gg=m.mesh.geometry,pp=gg.attributes.position,nn=gg.attributes.normal,indices=gg.index.array,acc=new Float64Array(pp.count*3);
  for(const attr of Object.values(gg.attributes))assert(attr.array.every(Number.isFinite));
  for(let i=0;i<indices.length;i+=3){
   const ia=indices[i],ib=indices[i+1],ic=indices[i+2],ux=pp.getX(ib)-pp.getX(ia),uy=pp.getY(ib)-pp.getY(ia),uz=pp.getZ(ib)-pp.getZ(ia),vx=pp.getX(ic)-pp.getX(ia),vy=pp.getY(ic)-pp.getY(ia),vz=pp.getZ(ic)-pp.getZ(ia);
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area=Math.hypot(nx,ny,nz);minDoubleArea=Math.min(minDoubleArea,area);assert(area>1e-6,'No degenerate triangle');
   for(const j of [ia,ib,ic]){acc[j*3]+=nx;acc[j*3+1]+=ny;acc[j*3+2]+=nz;}
  }
  for(let i=0;i<pp.count;i++){
   const l=Math.hypot(acc[i*3],acc[i*3+1],acc[i*3+2]),nl=Math.hypot(nn.getX(i),nn.getY(i),nn.getZ(i));assert(l>1e-8);minNormalLength=Math.min(minNormalLength,nl);maxNormalLength=Math.max(maxNormalLength,nl);
   const e=Math.hypot(nn.getX(i)-acc[i*3]/l,nn.getY(i)-acc[i*3+1]/l,nn.getZ(i)-acc[i*3+2]/l);maxNormalError=Math.max(maxNormalError,e);assert(e<1e-5,'Normals follow independently recomputed triangle cross products');assert(Math.abs(nl-1)<1e-6);
  }
 }
 return {minDoubleArea,maxNormalError,minNormalLength,maxNormalLength};
});
check('Every Horn boundary is buried and its actual height guide follows the vertices',()=>{
 let maximum=-Infinity,minimum=Infinity,nearest=Infinity,boundaryMax=-Infinity;
 for(let i=0;i<p.count;i++){
  const col=i%169,row=Math.floor(i/169),y=p.getY(i);maximum=Math.max(maximum,y);minimum=Math.min(minimum,y);nearest=Math.min(nearest,Math.hypot(p.getX(i),p.getZ(i)));
  if(col===0||col===168||row===0||row===56){boundaryMax=Math.max(boundaryMax,y);assert(y<=-18);}
 }
 assert.equal(bh.height,Math.round(maximum+18));assert(nearest>620);assert(Number.isFinite(maximum));assert.equal(minimum,-26);
 report.metrics.horn={maximum,minimum,nearest,boundaryMax,guideHeight:bh.height};return report.metrics.horn;
});
check('Only Horn interior geometry changes, without an art-quality assertion',()=>{
 const ap=ah.mesh.geometry.attributes.position;let changed=0,oldAbove80=0,newAbove80=0,oldMax=-Infinity;
 for(let i=0;i<p.count;i++){if(p.getY(i)!==ap.getY(i))changed++;if(ap.getY(i)>80)oldAbove80++;if(p.getY(i)>80)newAbove80++;oldMax=Math.max(oldMax,ap.getY(i));}
 assert(changed>0,'The intended Horn geometry changes');return {changed,oldAbove80,newAbove80,oldMax};
});
check('World random stream and existing terrain-noise invocation sequence are unchanged',()=>{
 for(const k of ['randomCalls','randomState','noiseCalls','noiseDigest'])assert.equal(b[k],a[k]);
 const c=build(next,hornRelief,456);for(let i=0;i<b.massifs.length;i++)for(const k of Object.keys(b.massifs[i].mesh.geometry.attributes))assert.deepEqual(c.massifs[i].mesh.geometry.attributes[k].array,b.massifs[i].mesh.geometry.attributes[k].array);
 return {randomCalls:b.randomCalls,noiseCalls:b.noiseCalls,noiseDigest:b.noiseDigest};
});
check('Pure helper remains deterministic, finite, nonnegative and buried at its boundaries',()=>{
 const prior=Math.random;Math.random=()=>{throw new Error('Relief must not consume ambient randomness');};let max=0;
 try{
  for(let i=0;i<=188;i++)for(let j=0;j<=112;j++){const u=-470+940*i/188,t=j/112,h=hornRelief(u,t);assert(Number.isFinite(h)&&h>=0);assert.equal(h,hornRelief(u,t));max=Math.max(max,h);}
  for(let j=0;j<=112;j++){assert.equal(hornRelief(-470,j/112),0);assert.equal(hornRelief(470,j/112),0);}
  for(let i=0;i<=188;i++){assert.equal(hornRelief(-470+940*i/188,0),0);assert.equal(hornRelief(-470+940*i/188,1),0);}
  return {maximumSampled:max};
 }finally{Math.random=prior;}
});
if(args.native)check('CPU constructor buffers match native submitted massif buffers',()=>{
 const native=JSON.parse(readFileSync(args.native,'utf8'));
 const fnv=array=>{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let h=2166136261;for(const byte of bytes)h=Math.imul(h^byte,16777619);return (h>>>0).toString(16);};
 for(const m of b.massifs){const n=native.find(x=>x.id===m.id);assert(n);assert.equal(n.height,m.height);assert.equal(n.index,fnv(m.mesh.geometry.index.array));for(const k of Object.keys(n.attributes))assert.equal(n.attributes[k],fnv(m.mesh.geometry.attributes[k].array),m.id+'/'+k);}
});
report.passed=report.checks.every(c=>c.pass);if(args.output)writeFileSync(args.output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
