// Portable CPU verification; no browser, GPU, source mutation or bundled baseline.
// node verify-backdrop-geometry.mjs --runtime-root REPO --before WORLD_ART_JS
//   --after CANDIDATE_WORLD_ART_JS [--helper CANDIDATE_HELPER_MJS]
//   [--target-layers 1,2] [--native BACKDROP_JSON] [--output REPORT_JSON]
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
for(const key of ['runtime-root','before','after'])assert(args[key],`Missing --${key}`);
const targetLayers=String(args['target-layers']??args['target-layer']??'').split(',').filter(Boolean).map(Number);
assert(targetLayers.every(x=>[0,1,2].includes(x)));
const root=resolve(args['runtime-root']),sha=v=>createHash('sha256').update(v).digest('hex');
const THREE=await import(pathToFileURL(join(root,'assets/vendor/three/build/three.module.js')));
const before=readFileSync(args.before,'utf8'),after=readFileSync(args.after,'utf8');
const helper=args.helper?await import(pathToFileURL(resolve(args.helper))):null;
const report={scope:'CPU geometry and source preservation only. Metrics do not establish art quality or native render safety.',source:{before:sha(before),after:sha(after),...(args.helper?{helper:sha(readFileSync(args.helper))}:{})},checks:[],layers:[]};
function check(name,fn){const detail=fn();report.checks.push({name,pass:true,...(detail?{detail}:{})});}
const importPattern=/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm;
function split(raw){
 const start=raw.indexOf('export function installBackdrop('),end=raw.indexOf('\nconst foliageTextures =');
 assert(start>0&&end>start,'Background source boundaries must remain explicit');
 const imports=[...raw.matchAll(importPattern)].map(m=>({line:m[0],names:m[1].split(',').map(s=>s.trim()),specifier:m[2]}));
 return {imports,prefix:raw.slice(0,start),body:raw.slice(start,end),foliage:raw.slice(end)};
}
const old=split(before),next=split(after);
async function constructor(parts,path){
 const names=[],values=[];
 for(const entry of parts.imports){
  let file=resolve(dirname(resolve(path)),entry.specifier.split('?')[0]);
  const hasOverride=helper&&entry.names.every(n=>Object.hasOwn(helper,n.split(/\s+as\s+/)[0]));
  if(!existsSync(file))file=resolve(root,'assets',entry.specifier.split('?')[0]);
  const module=hasOverride?helper:await import(pathToFileURL(file));
  for(const binding of entry.names){const [exported,local=exported]=binding.split(/\s+as\s+/);assert(Object.hasOwn(module,exported),`Missing import ${exported}`);names.push(local);values.push(module[exported]);}
 }
 const code=(parts.prefix+parts.body).replace(importPattern,'').replace('export function installBackdrop','function installBackdrop');
 assert(!/^import\s/m.test(code),'Unexpected unhandled import');
 return new Function(...names,code+'\nreturn installBackdrop;')(...values);
}
const makeBefore=await constructor(old,args.before),makeAfter=await constructor(next,args.after);
const originalLoad=THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
function build(make,seed=177){
 const scene=new THREE.Scene(),originalRandom=Math.random;let state=seed,randomCalls=0;
 Math.random=()=>{randomCalls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 try{return {group:make({THREE,scene}),scene,randomCalls,randomState:state};}finally{Math.random=originalRandom;}
}
let a,b,c;
try{
 // Populate the shared texture cache before comparing the constructor RNG stream.
 // Texture decoding is not part of this CPU geometry check.
 build(makeBefore);build(makeAfter);a=build(makeBefore);b=build(makeAfter);c=build(makeAfter,947);
}finally{THREE.TextureLoader.prototype.load=originalLoad;}
const byteHash=arr=>sha(new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength));
const fnv=arr=>{let h=2166136261;for(const byte of new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength))h=Math.imul(h^byte,16777619);return (h>>>0).toString(16);};
check('Foliage implementation and shared pre-constructor utilities are byte exact',()=>{
 assert.equal(next.foliage,old.foliage);
 assert.equal(next.prefix.slice(0,next.prefix.indexOf('import ')),old.prefix.slice(0,old.prefix.indexOf('import ')));
 assert.equal(next.prefix.slice(next.prefix.indexOf('const TAU =')),old.prefix.slice(old.prefix.indexOf('const TAU =')));
 for(const entry of old.imports)assert(next.imports.some(x=>x.line===entry.line),'Existing dependency import changed');
 return {foliageSha256:sha(next.foliage),sharedUtilitiesSha256:sha(next.prefix.slice(next.prefix.indexOf('const TAU =')))};
});
check('Three static rendering-only owners retain their mesh and buffer budgets',()=>{
 assert.equal(b.group.name,a.group.name);assert.equal(b.group.children.length,3);assert.equal(b.scene.children.length,1);
 for(let j=0;j<3;j++){
  const oldMesh=a.group.children[j],mesh=b.group.children[j],g=mesh.geometry;
  assert.equal(mesh.name,oldMesh.name);assert.equal(mesh.userData.regionalLayer,j);assert.equal(mesh.matrixAutoUpdate,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.userData.solidParts,undefined);
  assert.deepEqual(mesh.matrix.elements,oldMesh.matrix.elements);assert.equal(g.index.count/3,49152);assert.equal(g.attributes.position.count,25137);
  assert.equal(g.index.array.constructor,oldMesh.geometry.index.array.constructor);assert.equal(g.index.array.byteLength,oldMesh.geometry.index.array.byteLength);
  assert.deepEqual(Object.keys(g.attributes),Object.keys(oldMesh.geometry.attributes));
  for(const [name,attribute]of Object.entries(g.attributes)){const previous=oldMesh.geometry.attributes[name];assert.equal(attribute.itemSize,previous.itemSize);assert.equal(attribute.array.constructor,previous.array.constructor);assert.equal(attribute.array.byteLength,previous.array.byteLength);}
 }
});
if(targetLayers.length)check('Untargeted layers remain byte exact',()=>{
 for(let j=0;j<3;j++)if(!targetLayers.includes(j)){const x=a.group.children[j].geometry,y=b.group.children[j].geometry;assert.deepEqual(y.index.array,x.index.array);for(const key of Object.keys(x.attributes))assert.deepEqual(y.attributes[key].array,x.attributes[key].array);}
 return {targetLayers};
});
if(helper?.northernFoothillWeight&&helper?.northernFoothillRelief)check('Northern targeted-ring edits stay inside their masks and preserve exterior neighbours',()=>{
 const rows=[];
 for(const layer of targetLayers.length?targetLayers:[2]){
  const weight=angle=>helper.northernFoothillWeight(angle,layer),relief=(angle,t)=>helper.northernFoothillRelief(angle,t,layer),oldG=a.group.children[layer].geometry,g=b.group.children[layer].geometry;let outsideVertices=0,exteriorAttributeVertices=0,maximumSampled=0;
  for(let col=0;col<=512;col++){
   const angle=col===512?0:col/512*Math.PI*2,w=weight(angle);assert(Number.isFinite(w)&&w>=0&&w<=1);
   assert(Math.abs(weight(angle+Math.PI*2)-w)<1e-12);assert(Math.abs(weight(angle-Math.PI*2)-w)<1e-12);
   const outside=w===0,isolated=outside&&weight(angle-Math.PI*2/512)===0&&weight(angle+Math.PI*2/512)===0;
   for(let row=0;row<=48;row++){
    const i=row*513+col,h=relief(angle,row/48);assert(Number.isFinite(h)&&h>=0);assert(Math.abs(relief(angle+Math.PI*2,row/48)-h)<1e-10);maximumSampled=Math.max(maximumSampled,h);
    if(row===0||row===48)assert.equal(h,0);
    if(outside){outsideVertices++;assert.equal(g.attributes.position.getY(i),oldG.attributes.position.getY(i));}
    // A zero-weight vertex adjacent to changed relief can correctly receive a
    // changed averaged normal. Full attributes are exact beyond that one-cell halo.
    if(isolated){exteriorAttributeVertices++;for(const [name,attr]of Object.entries(g.attributes))for(let k=0;k<attr.itemSize;k++)assert.equal(attr.array[i*attr.itemSize+k],oldG.attributes[name].array[i*attr.itemSize+k]);}
   }
  }
  assert.equal(weight(-Math.PI/2),1);for(const angle of[0,Math.PI,Math.PI/2])assert.equal(weight(angle),0);
  rows.push({layer,outsideVertices,exteriorAttributeVertices,maximumSampled});
 }
 return {layers:rows};
});
check('Every ring retains exact XZ positions, indices and upward winding',()=>{
 for(let j=0;j<3;j++){
  const oldG=a.group.children[j].geometry,g=b.group.children[j].geometry,p=g.attributes.position,oldP=oldG.attributes.position,index=g.index.array;
  assert.deepEqual(index,oldG.index.array);
  for(let i=0;i<p.count;i++){assert.equal(p.getX(i),oldP.getX(i));assert.equal(p.getZ(i),oldP.getZ(i));}
  for(let i=0;i<index.length;i+=3){const x=index[i],y=index[i+1],z=index[i+2];const up=(p.getZ(y)-p.getZ(x))*(p.getX(z)-p.getX(x))-(p.getX(y)-p.getX(x))*(p.getZ(z)-p.getZ(x));assert(up>1e-6,'Triangle retains a positive horizontal footprint');}
 }
});
check('Position, colour and normal close the full angular wrap exactly',()=>{
 for(const mesh of b.group.children)for(const attr of Object.values(mesh.geometry.attributes))for(let row=0;row<=48;row++)for(let k=0;k<attr.itemSize;k++)assert.equal(attr.array[row*513*attr.itemSize+k],attr.array[(row*513+512)*attr.itemSize+k]);
});
check('Both radial hems remain buried outside the riding basin',()=>{
 for(let layer=0;layer<3;layer++){
  const p=b.group.children[layer].geometry.attributes.position;let minRadius=Infinity,boundaryMax=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<p.count;i++){const y=p.getY(i);minRadius=Math.min(minRadius,Math.hypot(p.getX(i),p.getZ(i)));minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(i<513||i>=48*513){boundaryMax=Math.max(boundaryMax,y);assert(y<=-14.99,'Hem remains below distant ground');}}
  assert(minRadius>700);report.layers.push({layer,minRadius,minY,maxY,boundaryMax,attributes:Object.fromEntries(Object.entries(b.group.children[layer].geometry.attributes).map(([k,v])=>[k,byteHash(v.array)])),index:byteHash(b.group.children[layer].geometry.index.array)});
 }
});
check('All geometry is finite and normals agree with independent triangle cross products',()=>{
 let minDoubleArea=Infinity,maxNormalError=0,maxLengthError=0;
 for(const mesh of b.group.children){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,idx=g.index.array,acc=new Float64Array(p.count*3);
  for(const attr of Object.values(g.attributes))assert(attr.array.every(Number.isFinite));
  for(let i=0;i<idx.length;i+=3){
   const a=idx[i],b=idx[i+1],c=idx[i+2],ux=p.getX(b)-p.getX(a),uy=p.getY(b)-p.getY(a),uz=p.getZ(b)-p.getZ(a),vx=p.getX(c)-p.getX(a),vy=p.getY(c)-p.getY(a),vz=p.getZ(c)-p.getZ(a);
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area=Math.hypot(nx,ny,nz);assert(area>1e-6);minDoubleArea=Math.min(minDoubleArea,area);
   for(const k of[a,b,c]){acc[k*3]+=nx;acc[k*3+1]+=ny;acc[k*3+2]+=nz;}
  }
  for(let i=0;i<p.count;i++){const len=Math.hypot(acc[i*3],acc[i*3+1],acc[i*3+2]);assert(len>1e-9);for(let k=0;k<3;k++)acc[i*3+k]/=len;}
  // Existing wrap contract averages the two independently normalized side
  // limits. This checks the closed seam without trusting computeVertexNormals.
  for(let row=0;row<=48;row++){const a=row*513,b=a+512;const x=acc[a*3]+acc[b*3],y=acc[a*3+1]+acc[b*3+1],z=acc[a*3+2]+acc[b*3+2],len=Math.hypot(x,y,z);for(const i of[a,b]){acc[i*3]=x/len;acc[i*3+1]=y/len;acc[i*3+2]=z/len;}}
  for(let i=0;i<p.count;i++){const error=Math.hypot(n.getX(i)-acc[i*3],n.getY(i)-acc[i*3+1],n.getZ(i)-acc[i*3+2]),lengthError=Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1);maxNormalError=Math.max(maxNormalError,error);maxLengthError=Math.max(maxLengthError,lengthError);assert(error<1e-5);assert(lengthError<1e-6);}
 }
 return {minDoubleArea,maxNormalError,maxLengthError};
});
check('Material shaders, samplers and opaque rendering flags remain unchanged',()=>{
 for(let j=0;j<3;j++){
  const old=a.group.children[j].material,now=b.group.children[j].material;
  for(const key of['type','roughness','metalness','envMapIntensity','vertexColors','side','fog','transparent','opacity','depthWrite','depthTest','alphaTest','blending'])assert.equal(now[key],old[key]);
  const compile=m=>{const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(s);return s;};
  const x=compile(old),y=compile(now);assert.equal(y.vertexShader,x.vertexShader);assert.equal(y.fragmentShader,x.fragmentShader);assert.deepEqual(Object.keys(y.uniforms),Object.keys(x.uniforms));for(const key of Object.keys(y.uniforms))assert.equal(y.uniforms[key].value,x.uniforms[key].value);
  assert.equal(now.transparent,false);assert.equal(now.opacity,1);assert.equal(now.depthWrite,true);assert(y.fragmentShader.includes('if(abs(ldet)>.000001)'),'Existing derivative guard retained');
 }
});
check('Geometry ignores ambient RNG seed and constructor random consumption stays equal',()=>{
 assert.equal(b.randomCalls,a.randomCalls);assert.equal(b.randomState,a.randomState);
 for(let j=0;j<3;j++){const x=b.group.children[j].geometry,y=c.group.children[j].geometry;assert.deepEqual(y.index.array,x.index.array);for(const k of Object.keys(x.attributes))assert.deepEqual(y.attributes[k].array,x.attributes[k].array);}
 return {randomCalls:b.randomCalls};
});
if(args.native)check('Actual native ring buffers and flags match CPU construction',()=>{
 const data=JSON.parse(readFileSync(args.native,'utf8'));assert.equal(data.length,3);
 for(let j=0;j<3;j++){
  const mesh=b.group.children[j],g=mesh.geometry,native=data.find(n=>n.layer===j);assert(native);assert.equal(native.name,mesh.name);assert.equal(native.triangles,g.index.count/3);assert.equal(native.vertices,g.attributes.position.count);assert.equal(native.index,fnv(g.index.array));
  for(const key of Object.keys(native.attributes))assert.equal(native.attributes[key],fnv(g.attributes[key].array),`layer${j}/${key}`);
  assert.equal(native.finite,true);assert.equal(native.static,true);assert.equal(native.cast,false);assert.equal(native.receive,false);
 }
 return {nativeSha256:sha(readFileSync(args.native))};
});
report.passed=report.checks.every(c=>c.pass);if(args.output)writeFileSync(args.output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
