#!/usr/bin/env node
/* Prepare a downloaded realistic pet model for the game (no Blender, no npm install needed).

   It reads a .glb, or a .gltf with its .bin and texture files, and:
     1. reports what is inside: clips (name, length, what they move), skins and joints, triangles, draw
        calls, textures (format and size), glTF extensions, and anything the game cannot decode
        (Draco, meshopt, KTX2/Basis are not vendored);
     2. resizes textures larger than 1024 px (sharp when it is installed, else ImageMagick or macOS sips;
        with none of them it only reports the sizes);
     3. optionally keeps only the clips the game will use (--trim) and repacks the buffer;
     4. writes assets/models/pets/<key>.glb (or --out) and prints a suggested manifest entry for
        assets/models/pets/manifest.json, with the clip map guessed from the clip names.

   Usage:
     node tools/prepare-pet-glb.mjs <file.glb|scene.gltf> --key fox [--out path.glb] [--max 1024]
          [--trim] [--inspect] [--json] [--check] [--morph-every N] [--morph-loop S] [--quantize-morph]
          [--keep clipA,clipB] [--jpeg 85] [--specgloss] [--lean]
   --keep keeps exactly the named clips. --jpeg Q stores every texture that no material blends by alpha
   as a JPEG of quality Q (ImageMagick), at most --max px. --specgloss turns a KHR_materials_pbrSpecularGlossiness
   material (which three.js r160 no longer reads) into metallic-roughness. --lean drops animation
   channels that never change.
   --inspect only reports (writes nothing). --json prints the report as JSON. --check then runs the game's
   own pet library on the written file (fit, turn, grounding, clips) and prints what it measured.
   A model animated by one morph target per frame (a vertex cache, no skeleton): --morph-every N keeps
   every Nth frame, --morph-loop S eases the last S seconds back onto the first frame so the clip loops,
   --quantize-morph stores the frames as normalised bytes (KHR_mesh_quantization); see morphFlipbook().
   Nothing here touches the network. The original download is never modified. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
/* the in-game heights (metres, SPECIES h x grow in assets/features/pet-models.js), for the suggested fit */
export const PET_HEIGHT={dog:.63,fox:.52,cat:.46,bunny:.38,corgi:.47,duck:.495,chick:.486,piglet:.44,goat:.68,raccoon:.44,fennec:.40,snowhare:.42,owl:.50,lamb:.60,glimmerfox:.562};
export const PET_KIND={duck:'bird',chick:'bird',owl:'bird',bunny:'bunny',snowhare:'bunny'};
const UNSUPPORTED=['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_meshopt_compression','KHR_texture_basisu'];
const COMP_SIZE={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},TYPE_N={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};

/* ------------------------------------------------------------------ reading and writing -------- */
export function readGLTF(file){
 const buf=fs.readFileSync(file);
 if(buf.readUInt32LE(0)===0x46546c67){   // 'glTF'
  let off=12,json=null,bin=Buffer.alloc(0);
  while(off<buf.length){const len=buf.readUInt32LE(off),type=buf.readUInt32LE(off+4),data=buf.subarray(off+8,off+8+len);
   if(type===0x4e4f534a)json=JSON.parse(data.toString('utf8').replace(/\0+$/,''));else if(type===0x004e4942)bin=Buffer.from(data);off+=8+len;}
  if(!json)throw new Error('no JSON chunk in '+file);
  return {json,bin};
 }
 /* .gltf: every buffer merged into one, and every image file embedded */
 const json=JSON.parse(buf.toString('utf8')),dir=path.dirname(file),parts=[],starts=[];let size=0;
 const fetchURI=uri=>{if(/^data:/.test(uri))return Buffer.from(uri.split(',')[1],'base64');if(/^[a-z]+:\/\//i.test(uri))throw new Error('refusing a remote uri: '+uri);return fs.readFileSync(path.join(dir,decodeURIComponent(uri)));};
 for(const b of json.buffers||[]){const d=b.uri!=null?fetchURI(b.uri):Buffer.alloc(0);starts.push(size);const pad=(4-d.length%4)%4;parts.push(d,Buffer.alloc(pad));size+=d.length+pad;}
 for(const bv of json.bufferViews||[]){bv.byteOffset=(bv.byteOffset||0)+starts[bv.buffer||0];bv.buffer=0;}
 for(const im of json.images||[]){if(im.uri==null)continue;const d=fetchURI(im.uri),mime=im.mimeType||sniff(d);const pad=(4-d.length%4)%4;
  json.bufferViews=json.bufferViews||[];json.bufferViews.push({buffer:0,byteOffset:size,byteLength:d.length});parts.push(d,Buffer.alloc(pad));size+=d.length+pad;
  im.bufferView=json.bufferViews.length-1;im.mimeType=mime;delete im.uri;}
 const bin=Buffer.concat(parts);json.buffers=[{byteLength:bin.length}];
 return {json,bin};
}
export function writeGLB(json,bin){
 json.buffers=bin.length?[{byteLength:bin.length}]:[];
 const js=Buffer.from(JSON.stringify(json),'utf8'),jp=Buffer.alloc((4-js.length%4)%4,0x20),bp=Buffer.alloc((4-bin.length%4)%4,0);
 const total=12+8+js.length+jp.length+(bin.length?8+bin.length+bp.length:0),h=Buffer.alloc(12);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(total,8);
 const jh=Buffer.alloc(8);jh.writeUInt32LE(js.length+jp.length,0);jh.writeUInt32LE(0x4e4f534a,4);
 const out=[h,jh,js,jp];if(bin.length){const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length+bp.length,0);bh.writeUInt32LE(0x004e4942,4);out.push(bh,bin,bp);}
 return Buffer.concat(out);
}
function sniff(d){if(d[0]===0x89&&d[1]===0x50)return 'image/png';if(d[0]===0xff&&d[1]===0xd8)return 'image/jpeg';if(d.toString('ascii',0,4)==='RIFF'&&d.toString('ascii',8,12)==='WEBP')return 'image/webp';if(d.toString('ascii',4,8)==='ftyp')return 'image/avif';return 'application/octet-stream';}
export function imageSize(d){
 const m=sniff(d);
 if(m==='image/png')return {mime:m,w:d.readUInt32BE(16),h:d.readUInt32BE(20)};
 if(m==='image/jpeg'){let o=2;while(o<d.length){if(d[o]!==0xff){o++;continue;}const t=d[o+1],len=d.readUInt16BE(o+2);if(t>=0xc0&&t<=0xcf&&t!==0xc4&&t!==0xc8&&t!==0xcc)return {mime:m,w:d.readUInt16BE(o+7),h:d.readUInt16BE(o+5)};o+=2+len;}return {mime:m,w:0,h:0};}
 if(m==='image/webp'){const f=d.toString('ascii',12,16);if(f==='VP8X')return {mime:m,w:1+d.readUIntLE(24,3),h:1+d.readUIntLE(27,3)};if(f==='VP8L'){const b=d.readUInt32LE(21);return {mime:m,w:1+(b&0x3fff),h:1+((b>>14)&0x3fff)};}return {mime:m,w:d.readUInt16LE(26)&0x3fff,h:d.readUInt16LE(28)&0x3fff};}
 return {mime:m,w:0,h:0};
}
const viewData=(json,bin,i)=>{const bv=json.bufferViews[i];return bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);};
function readAccessor(json,bin,i){const a=json.accessors[i];if(a.bufferView==null)return new Float32Array(a.count*TYPE_N[a.type]);const bv=json.bufferViews[a.bufferView],n=TYPE_N[a.type],cs=COMP_SIZE[a.componentType],stride=bv.byteStride||n*cs,base=(bv.byteOffset||0)+(a.byteOffset||0),out=new Float32Array(a.count*n);
 const rd={5126:o=>bin.readFloatLE(o),5125:o=>bin.readUInt32LE(o),5123:o=>bin.readUInt16LE(o),5122:o=>bin.readInt16LE(o),5121:o=>bin.readUInt8(o),5120:o=>bin.readInt8(o)}[a.componentType];
 for(let k=0;k<a.count;k++)for(let j=0;j<n;j++)out[k*n+j]=rd(base+k*stride+j*cs);return out;}

/* ------------------------------------------------------------------ what is inside ------------- */
export function inspect(json,bin){
 const r={asset:json.asset||{},extensionsUsed:json.extensionsUsed||[],extensionsRequired:json.extensionsRequired||[],meshes:0,primitives:0,triangles:0,skins:[],clips:[],textures:[],materials:(json.materials||[]).map(m=>m.name||'(unnamed)'),nodes:(json.nodes||[]).length,problems:[]};
 for(const m of json.meshes||[]){r.meshes++;for(const p of m.primitives||[]){r.primitives++;const mode=p.mode==null?4:p.mode;const n=p.indices!=null?json.accessors[p.indices].count:json.accessors[p.attributes.POSITION].count;if(mode===4)r.triangles+=n/3;else if(mode===5||mode===6)r.triangles+=Math.max(0,n-2);}}
 r.triangles=Math.round(r.triangles);
 for(const s of json.skins||[])r.skins.push({name:s.name||'',joints:s.joints.length,names:s.joints.slice(0,200).map(j=>json.nodes[j].name||('#'+j))});
 for(const a of json.animations||[]){let dur=0;const nodes=new Set(),paths=new Set();
  for(const ch of a.channels){const s=a.samplers[ch.sampler],inp=json.accessors[s.input];dur=Math.max(dur,inp.max?inp.max[0]:0);if(ch.target.node!=null)nodes.add(json.nodes[ch.target.node].name||('#'+ch.target.node));paths.add(ch.target.path);}
  r.clips.push({name:a.name||'(unnamed)',duration:+dur.toFixed(3),channels:a.channels.length,nodes:nodes.size,paths:[...paths]});}
 (json.images||[]).forEach((im,i)=>{let s={mime:im.mimeType||'?',w:0,h:0},bytes=0;if(im.bufferView!=null){const d=viewData(json,bin,im.bufferView);bytes=d.length;s=imageSize(d);}r.textures.push({index:i,name:im.name||'',mime:s.mime,w:s.w,h:s.h,bytes});});
 for(const e of r.extensionsRequired.concat(r.extensionsUsed))if(UNSUPPORTED.includes(e)&&!r.problems.some(p=>p.includes(e)))r.problems.push(e+' is not decoded by the game (no decoder vendored): decompress it first');
 r.morphTargets=Math.max(0,...(json.meshes||[]).flatMap(m=>(m.primitives||[]).map(p=>(p.targets||[]).length)));
 if(!r.skins.length)r.problems.push(r.morphTargets&&r.clips.some(c=>c.paths.includes('weights'))?'no skin: animated by '+r.morphTargets+' morph targets (a vertex cache, one pose per frame); no bones to drive, see --morph-every/--quantize-morph':'no skin: the model is not rigged');
 if(!r.clips.length)r.problems.push('no animation clips');
 if(r.triangles>25000)r.problems.push('triangles '+r.triangles+' over the 25k budget (decimate before shipping)');
 for(const s of r.skins)if(s.joints>128)r.problems.push('skin "'+s.name+'" has '+s.joints+' joints, over the 128 budget');
 return r;
}
/* the game's clip states guessed from the clip names; the first good match wins, one clip per state */
const GUESS=[['takeoff',/take_?off|lift_?off|launch/],['land',/(^|[^a-z])land(ing)?($|[^a-z])|touch_?down/],['glide',/glide|soar/],['fly',/fly|flap|flight|hover/],['swim',/swim|paddle/],
 ['run',/run|gallop|sprint/],['trot',/trot|jog|canter/],['walk',/walk/],['hop',/hop|bounce/],['sit',/sit(?!.*(up|stand))|sitting/],['lie',/lie|lay|sleep/],['eat',/eat|graze|sniff|peck|drink/],['jump',/jump|pounce|leap/],['idle',/idle|breath|stand|rest/]];
export function guessClips(names,key){
 const map={},used=new Set(),clean=n=>String(n).toLowerCase().replace(/^.*[|:]/,'');
 const bad=/(_?(start|end|in|out|begin|to_|back|left|right|turn)$)|turn|backward|attack|death|die|hit|damage/;
 for(const [state,re] of GUESS){const cands=names.filter(n=>!used.has(n)&&re.test(clean(n)));if(!cands.length)continue;cands.sort((a,b)=>(bad.test(clean(a))-bad.test(clean(b)))||clean(a).length-clean(b).length);map[state]=cands[0];used.add(cands[0]);}
 if(!map.idle&&names.length===1)map.idle=names[0];
 if(PET_KIND[key]==='bunny'&&!map.hop&&map.jump){map.hop=map.jump;}
 return map;
}

/* ------------------------------------------------------------------ changing it ---------------- */
function resizer(){
 const tries=[path.join(ROOT,'node_modules','sharp'),path.join(ROOT,'tools','asset-gen','node_modules','sharp')];
 for(const t of tries)if(fs.existsSync(t))return {name:'sharp',path:t};
 for(const b of ['magick','sips']){try{execFileSync('/usr/bin/which',[b],{stdio:'pipe'});return {name:b};}catch(e){}}
 return null;
}
async function resize(tool,data,mime,max){
 if(tool.name==='sharp'){const sharp=(await import(pathToFileURL(path.join(tool.path,'lib','index.js')).href)).default;let s=sharp(data).resize(max,max,{fit:'inside',withoutEnlargement:true});s=mime==='image/png'?s.png():mime==='image/webp'?s.webp({quality:90}):s.jpeg({quality:90});return await s.toBuffer();}
 const ext={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[mime];if(!ext)return null;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'petglb-')),a=path.join(dir,'in'+ext),b=path.join(dir,'out'+ext);fs.writeFileSync(a,data);
 try{if(tool.name==='magick')execFileSync('magick',[a,'-resize',max+'x'+max+'>',...(mime==='image/png'?[]:['-quality','90']),b],{stdio:'pipe'});
  else{if(mime==='image/webp')return null;execFileSync('sips',['-Z',String(max),a,'--out',b],{stdio:'pipe'});}
  return fs.readFileSync(b);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
/* keep only what is referenced (after --trim drops clips, or a vertex cache drops frames) and write it
   into one fresh buffer: a tightly packed accessor is copied on its own (so dropped data sharing its view
   with kept data goes), a strided view, a sparse accessor's views and an image are copied whole */
function repack(json,bin,replaced){
 const usedAcc=new Set(),use=i=>{if(i!=null)usedAcc.add(i);};
 for(const m of json.meshes||[])for(const p of m.primitives||[]){Object.values(p.attributes||{}).forEach(use);use(p.indices);for(const t of p.targets||[])Object.values(t).forEach(use);}
 for(const s of json.skins||[])use(s.inverseBindMatrices);
 for(const a of json.animations||[])for(const s of a.samplers){use(s.input);use(s.output);}
 const accMap=new Map(),accs=[];(json.accessors||[]).forEach((a,i)=>{if(usedAcc.has(i)){accMap.set(i,accs.length);accs.push(a);}});
 const bvs=[],parts=[],whole=new Map();let off=0;
 const add=(d,src)=>{const pad=(4-off%4)%4;if(pad){parts.push(Buffer.alloc(pad));off+=pad;}const nb=Object.assign({},src,{buffer:0,byteOffset:off,byteLength:d.length});bvs.push(nb);parts.push(d);off+=d.length;return bvs.length-1;};
 const keepWhole=i=>{if(!whole.has(i))whole.set(i,add(replaced.get(i)||viewData(json,bin,i),json.bufferViews[i]));return whole.get(i);};
 for(const a of accs){
  if(a.sparse){a.sparse.indices.bufferView=keepWhole(a.sparse.indices.bufferView);a.sparse.values.bufferView=keepWhole(a.sparse.values.bufferView);}
  if(a.bufferView==null)continue;const bv=json.bufferViews[a.bufferView];
  if(bv.byteStride&&bv.byteStride!==TYPE_N[a.type]*COMP_SIZE[a.componentType]){a.bufferView=keepWhole(a.bufferView);continue;}
  const len=a.count*TYPE_N[a.type]*COMP_SIZE[a.componentType],st=(bv.byteOffset||0)+(a.byteOffset||0);const src=Object.assign({},bv);delete src.byteStride;
  a.bufferView=add(Buffer.from(bin.subarray(st,st+len)),src);delete a.byteOffset;}
 for(const im of json.images||[])if(im.bufferView!=null)im.bufferView=keepWhole(im.bufferView);
 const ra=i=>i==null?i:accMap.get(i);
 for(const m of json.meshes||[])for(const p of m.primitives||[]){for(const k in p.attributes)p.attributes[k]=ra(p.attributes[k]);if(p.indices!=null)p.indices=ra(p.indices);for(const t of p.targets||[])for(const k in t)t[k]=ra(t[k]);}
 for(const s of json.skins||[])if(s.inverseBindMatrices!=null)s.inverseBindMatrices=ra(s.inverseBindMatrices);
 for(const a of json.animations||[])for(const s of a.samplers){s.input=ra(s.input);s.output=ra(s.output);}
 json.accessors=accs;json.bufferViews=bvs;
 return Buffer.concat(parts);
}
/* ------------------------------------------------------------------ a vertex-cache clip ----------
   Some Sketchfab uploads (the Animated Fox among them) come with no skeleton: the artist's animation is
   baked into one morph target per frame, played as a flipbook (weights one-hot per key). That is most of
   the file (the fox: 134 frames x 10,374 vertices x 12 bytes = 16.7 MB). This keeps every Nth frame (the
   in-between is linear, as the flipbook's own keys are), closes the loop by easing the last loopS seconds
   onto the first frame, and with quantize stores each frame's offsets as normalised bytes
   (KHR_mesh_quantization, decoded by the vendored GLTFLoader with no extra decoder): the mesh node is
   scaled by the largest offset so the bytes use their whole range (the fox: 0.6 mm steps in the game). */
function readFloats(json,bin,i){return readAccessor(json,bin,i);}
export function morphFlipbook(json,bin,{every=1,loopS=0,quantize=false}={}){
 const notes=[],parts=[];let off=bin.length+((4-bin.length%4)%4);const base=off;
 const push=(buf,stride)=>{const pad=(4-off%4)%4;if(pad){parts.push(Buffer.alloc(pad));off+=pad;}const bv={buffer:0,byteOffset:off,byteLength:buf.length};if(stride)Object.assign(bv,{byteStride:stride,target:34962});json.bufferViews.push(bv);parts.push(buf);off+=buf.length;return json.bufferViews.length-1;};
 const floatAcc=(arr,type,minmax)=>{const b=Buffer.from(new Float32Array(arr).buffer);const a={bufferView:push(b),componentType:5126,count:arr.length/TYPE_N[type],type};if(minmax){const n=TYPE_N[type],mn=Array(n).fill(Infinity),mx=Array(n).fill(-Infinity);for(let i=0;i<arr.length;i++){mn[i%n]=Math.min(mn[i%n],arr[i]);mx[i%n]=Math.max(mx[i%n],arr[i]);}a.min=mn;a.max=mx;}json.accessors.push(a);return json.accessors.length-1;};
 for(const anim of json.animations||[])for(const ch of anim.channels){
  if(ch.target.path!=='weights'||ch.target.node==null)continue;const node=json.nodes[ch.target.node],mesh=json.meshes[node.mesh];if(!mesh)continue;
  const s=anim.samplers[ch.sampler],times=readFloats(json,bin,s.input),W=readFloats(json,bin,s.output),K=times.length,T=W.length/K;
  const act=[];let flip=true;for(let k=0;k<K;k++){let a=-1,n=0;for(let j=0;j<T;j++){const v=W[k*T+j];if(v>1e-4){n++;if(Math.abs(v-1)<1e-3)a=j;}}if(n>1||(n===1&&a<0)){flip=false;break;}act.push(a);}
  if(!flip){notes.push('clip "'+(anim.name||'')+'" blends its morph targets (not a flipbook): left as it is');continue;}
  if(mesh.primitives.some(p=>p.attributes.JOINTS_0!=null))quantize=false;
  const keep=[];for(let k=0;k<K;k+=Math.max(1,every|0))keep.push(k);if(keep.at(-1)!==K-1)keep.push(K-1);
  const tNew=keep.map(k=>times[k]),m=keep.length-1,tEnd=tNew[m];
  let mxOff=0;const prims=[];
  for(const p of mesh.primitives){
   const names=Object.keys((p.targets||[])[0]||{}),N=json.accessors[p.attributes.POSITION].count;
   const tg={};for(const nm of names)tg[nm]=p.targets.map(t=>t[nm]);
   const frames={};for(const nm of names){const zero=new Float32Array(N*3),cache=new Map(),get=j=>{if(!cache.has(j))cache.set(j,readFloats(json,bin,tg[nm][j]));return cache.get(j);};
    frames[nm]=keep.map(k=>act[k]<0?zero:get(act[k]).slice());
    if(loopS>0){const first=frames[nm][0],last=frames[nm][m].slice();for(let f=1;f<=m;f++){const u=(tNew[f]-(tEnd-loopS))/loopS;if(u<=0)continue;const e=Math.min(1,u)**2*(3-2*Math.min(1,u)),F=frames[nm][f]=frames[nm][f].slice();for(let i=0;i<F.length;i++)F[i]+=e*(first[i]-last[i]);}}}
   prims.push({p,names,N,frames});
   if(quantize&&frames.POSITION)for(let f=0;f<m;f++)for(const v of frames.POSITION[f])mxOff=Math.max(mxOff,Math.abs(v));}
  const scale=mxOff>0?mxOff:1;
  /* the frames that play (the last is the first again); a frame with no offset is the bare mesh */
  const uniq=[];for(let f=0;f<m;f++){const nz=prims.some(P=>P.names.some(nm=>P.frames[nm][f].some(v=>v!==0)));uniq.push(nz);}
  const tIndex=[];let nT=0;for(let f=0;f<m;f++)tIndex.push(uniq[f]?nT++:-1);
  for(const P of prims){
   const {p,names,N,frames}=P;p.targets=[];for(let f=0;f<m;f++)if(uniq[f])p.targets.push({});
   for(const nm of names){
    if(quantize&&nm==='POSITION'){
     const buf=Buffer.alloc(nT*N*4);let t=0;const acc=[];
     for(let f=0;f<m;f++){if(!uniq[f])continue;const F=frames[nm][f],mn=[127,127,127],mx=[-127,-127,-127];
      for(let i=0;i<N;i++)for(let c=0;c<3;c++){const q=Math.max(-127,Math.min(127,Math.round(F[3*i+c]/scale*127)));buf.writeInt8(q,(t*N+i)*4+c);mn[c]=Math.min(mn[c],q);mx[c]=Math.max(mx[c],q);}
      acc.push({byteOffset:t*N*4,min:mn,max:mx});t++;}
     const bv=push(buf,4);let ti=0;for(let f=0;f<m;f++){if(!uniq[f])continue;const a=acc[ti];json.accessors.push({bufferView:bv,byteOffset:a.byteOffset,componentType:5120,normalized:true,count:N,type:'VEC3',min:a.min,max:a.max});p.targets[ti][nm]=json.accessors.length-1;ti++;}
    }else{let ti=0;for(let f=0;f<m;f++){if(!uniq[f])continue;p.targets[ti][nm]=floatAcc(frames[nm][f],'VEC3',true);ti++;}}}
   if(quantize&&scale!==1){const pos=readFloats(json,bin,p.attributes.POSITION);for(let i=0;i<pos.length;i++)pos[i]/=scale;p.attributes.POSITION=floatAcc(pos,'VEC3',true);}
   if(!p.targets.length)delete p.targets;}
  if(quantize&&scale!==1){if(node.matrix){for(let i=0;i<12;i++)if(i%4!==3)node.matrix[i]*=scale;}else node.scale=(node.scale||[1,1,1]).map(v=>v*scale);
   if(node.children&&node.children.length)notes.push('node "'+(node.name||'')+'" has children: they are scaled with the quantised mesh');}
  mesh.weights=Array(nT).fill(0);if(mesh.extras&&mesh.extras.targetNames)mesh.extras.targetNames=Array.from({length:nT},(_,i)=>'frame'+i);
  const Wn=new Float32Array((m+1)*nT);for(let f=0;f<=m;f++){const ti=tIndex[f===m?0:f];if(ti>=0)Wn[f*nT+ti]=1;}
  s.input=floatAcc(tNew,'SCALAR',true);s.output=floatAcc(Wn,'SCALAR',false);s.interpolation='LINEAR';
  notes.push('clip "'+(anim.name||'')+'": '+T+' morph frames -> '+nT+' (every '+every+(loopS?', loop closed over the last '+loopS+' s':'')+(quantize?', offsets as normalised bytes, node scaled x'+scale.toFixed(4):'')+')');
  if(quantize){for(const k of ['extensionsUsed','extensionsRequired']){json[k]=json[k]||[];if(!json[k].includes('KHR_mesh_quantization'))json[k].push('KHR_mesh_quantization');}}
 }
 const pad=Buffer.alloc(base-bin.length);return {bin:Buffer.concat([bin,pad,...parts]),notes};
}
/* the height of the model in its rest pose, from the mesh bounds (for the report; the game measures the posed skin itself) */
function roughBounds(json){let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];for(const m of json.meshes||[])for(const p of m.primitives||[]){const a=json.accessors[p.attributes.POSITION];if(a&&a.min&&a.max)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],a.min[k]);mx[k]=Math.max(mx[k],a.max[k]);}}return {min:mn,max:mx};}

/* ------------------------------------------------------------------ the game's own check -------
   --check runs the game's pet library (assets/pet-library.js) on the written GLB, here in Node with the
   vendored three.js: the same fit, turn, grounding, root-motion strip and clip map the game will use,
   then a few frames of each state. Images are stood in for (Node cannot decode them), which is fine:
   nothing here depends on the pixels. */
export async function checkInGame(file,key,entry){
 const {register}=await import('node:module');
 const three=pathToFileURL(path.join(ROOT,'assets/vendor/three/build/three.module.js')).href,addons=pathToFileURL(path.join(ROOT,'assets/vendor/three/examples/jsm/')).href;
 register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return n(${JSON.stringify(three)},c);if(s.startsWith('three/addons/'))return n(${JSON.stringify(addons)}+s.slice(13),c);return n(s,c);}`),import.meta.url);
 if(typeof globalThis.createImageBitmap==='undefined')globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 if(typeof globalThis.self==='undefined')globalThis.self=globalThis;
 const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js');
 const {createPetLibrary}=await import(pathToFileURL(path.join(ROOT,'assets/pet-library.js')).href);
 const warns=[];
 class Loader extends GLTFLoader{loadAsync(url){const b=fs.readFileSync(fileURLToPath(url.split('?')[0]));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}}
 const manifest={pets:{[key]:Object.assign({available:true},entry,{file:pathToFileURL(path.resolve(file)).href})}};
 const lib=createPetLibrary({THREE,GLTFLoader:Loader,clone,manifest,manifestURL:pathToFileURL(path.resolve(file)).href,warn:m=>warns.push(m)});
 const oe=console.error,ow=console.warn;console.error=(...a)=>warns.push(a.join(' '));console.warn=(...a)=>warns.push(a.join(' '));
 try{
  const asset=await lib.load(key,{height:PET_HEIGHT[key]||0.5,mustFly:PET_KIND[key]==='bird'}),inst=lib.instantiate(asset),holder=new THREE.Group();holder.add(inst.root);
  const box=()=>{holder.updateMatrixWorld(true);const b=new THREE.Box3(),v=new THREE.Vector3();inst.root.traverse(o=>{if(o.isSkinnedMesh||(o.isMesh&&o.geometry.morphAttributes.position)){const pa=o.geometry.attributes.position;for(let i=0;i<pa.count;i+=2){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);b.expandByPoint(v);}}});return b;};
  const out={restOnly:asset.restOnly,morphFrames:asset.morphFrames,ears:asset.ears?asset.ears.sides.length:0,dims:asset.dims,yawDeg:+(asset.yaw*180/Math.PI).toFixed(1),scale:+asset.scale.toFixed(4),clips:inst.clips,strides:inst.info().strides,groundCurves:Object.keys(asset.curves),stats:asset.stats,states:{}};
  for(const s of ['idle','walk','trot','run','hop','swim','sit','takeoff','fly','glide','land']){const k=inst.pick(s);if(!k)continue;let lo=Infinity,hi=-Infinity,sig=new Set();
   for(let i=0;i<24;i++){inst.update(1/24,{w:{[k]:1},snap:true,phase:i/24,phased:['walk','trot','run','hop'].includes(k)?[k]:null,restart:i===0&&['takeoff','land','jump'].includes(k)?k:null});const b=box();lo=Math.min(lo,b.min.y);hi=Math.max(hi,b.max.y);let q='';inst.model.traverse(o=>{if(o.isBone)q+=o.quaternion.toArray().map(v=>v.toFixed(2)).join()+o.position.toArray().map(v=>v.toFixed(2)).join();else if(o.morphTargetInfluences)q+=o.morphTargetInfluences.map(v=>v.toFixed(2)).join();});sig.add(q);}
   out.states[s]={clip:k===s?inst.clips[k]:k+' (fallback)',lowest:+lo.toFixed(3),highest:+hi.toFixed(3),poses:sig.size};}
  inst.dispose();return {ok:true,out,warns};
 }catch(e){return {ok:false,error:e.message,warns};}
 finally{console.error=oe;console.warn=ow;}
}

/* ------------------------------------------------------------------ main ----------------------- */
async function main(){
 const argv=process.argv.slice(2),opt={},files=[];
 for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2);if(['inspect','trim','json','check','quantize-morph','specgloss','lean'].includes(k))opt[k]=true;else opt[k]=argv[++i];}else files.push(a);}
 if(!files.length){console.log(fs.readFileSync(fileURLToPath(import.meta.url),'utf8').split('*/')[0]);process.exit(2);}
 const src=path.resolve(files[0]),key=opt.key||path.basename(src).replace(/\.(glb|gltf)$/i,'').toLowerCase(),max=+(opt.max||1024);
 const {json,bin}=readGLTF(src),r=inspect(json,bin);
 const clipMap=guessClips(r.clips.map(c=>c.name),key);
 const log=(...a)=>{if(!opt.json)console.log(...a);};
 log('Model   '+src+'  ('+(fs.statSync(src).size/1048576).toFixed(2)+' MB)');
 log('Asset   '+[r.asset.generator,r.asset.copyright].filter(Boolean).join(' | '));
 log('Meshes  '+r.meshes+' ('+r.primitives+' draw calls), '+r.triangles+' triangles, '+r.materials.length+' materials: '+r.materials.join(', '));
 for(const s of r.skins)log('Skin    "'+s.name+'" '+s.joints+' joints: '+s.names.slice(0,24).join(', ')+(s.names.length>24?' ...':''));
 log('Clips   '+r.clips.length);for(const c of r.clips)log('        '+c.name.padEnd(36)+(c.duration+'s').padStart(8)+'  '+c.channels+' channels on '+c.nodes+' nodes ('+c.paths.join(',')+')');
 log('Images  '+r.textures.length);for(const t of r.textures)log('        #'+t.index+' '+(t.name||'').padEnd(24)+' '+t.mime.padEnd(11)+' '+t.w+'x'+t.h+'  '+(t.bytes/1024).toFixed(0)+' KB'+(Math.max(t.w,t.h)>max?'  (over '+max+')':''));
 log('Ext     used: '+(r.extensionsUsed.join(', ')||'none')+'   required: '+(r.extensionsRequired.join(', ')||'none'));
 for(const p of r.problems)log('NOTE    '+p);
 log('Clip map guessed: '+JSON.stringify(clipMap));
 const fatal=r.problems.filter(p=>/not decoded/.test(p));
 if(opt.inspect){if(opt.json)console.log(JSON.stringify({report:r,clipMap},null,1));return;}
 if(fatal.length){console.error('Cannot prepare: '+fatal.join('; '));process.exit(1);}
 /* a specular-glossiness material (three.js r160 no longer reads it) as metallic-roughness */
 if(opt.specgloss)for(const m of json.materials||[]){const sg=m.extensions&&m.extensions.KHR_materials_pbrSpecularGlossiness;if(!sg)continue;
  const pb=m.pbrMetallicRoughness=m.pbrMetallicRoughness||{};if(sg.diffuseTexture)pb.baseColorTexture=sg.diffuseTexture;if(sg.diffuseFactor)pb.baseColorFactor=sg.diffuseFactor;
  pb.metallicFactor=0;pb.roughnessFactor=+(1-(sg.glossinessFactor!=null?sg.glossinessFactor:1)).toFixed(3);delete m.extensions.KHR_materials_pbrSpecularGlossiness;if(!Object.keys(m.extensions).length)delete m.extensions;
  log('Material "'+(m.name||'')+'" specular-glossiness -> metallic-roughness (roughness '+pb.roughnessFactor+')');}
 if(opt.specgloss)for(const k of ['extensionsUsed','extensionsRequired'])if(json[k]){json[k]=json[k].filter(x=>x!=='KHR_materials_pbrSpecularGlossiness');if(!json[k].length)delete json[k];}
 /* --keep a,b,c: exactly these clips (by name) instead of the guessed map */
 if(opt.keep&&json.animations){const keep=new Set(String(opt.keep).split(',').map(x=>x.trim()));const before=json.animations.length;json.animations=json.animations.filter(a=>keep.has(a.name||'(unnamed)'));log('Keep    '+json.animations.length+' of '+before+' clips: '+json.animations.map(a=>a.name).join(', '));if(!json.animations.length)delete json.animations;}
 /* --lean: animation channels that never change are dropped (a still bone keeps its rest value, or takes
    the value every clip holds it at), which is most of a face rig's channels */
 if(opt.lean&&json.animations){const acc=i=>{const a=json.accessors[i];if(!a||a.componentType!==5126||a.sparse)return null;const bv=json.bufferViews[a.bufferView],n=TYPE_N[a.type],st=bv.byteStride||n*4;if(st!==n*4)return null;return {n,c:a.count,f:new Float32Array(bin.buffer.slice(bin.byteOffset+(bv.byteOffset||0)+(a.byteOffset||0),bin.byteOffset+(bv.byteOffset||0)+(a.byteOffset||0)+a.count*n*4))};};
  const constOf=(an,ch)=>{const sm=an.samplers[ch.sampler];if(sm.interpolation==='CUBICSPLINE')return null;const o=acc(sm.output);if(!o)return null;for(let i=1;i<o.c;i++)for(let k=0;k<o.n;k++)if(Math.abs(o.f[i*o.n+k]-o.f[k])>1e-5)return null;return Array.from(o.f.slice(0,o.n));};
  const REST={translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]},same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<1e-5||(b.length===4&&Math.abs(v+b[i])<1e-5&&a.every((w,j)=>Math.abs(w+b[j])<1e-5)));
  const byKey=new Map();for(const an of json.animations)for(const ch of an.channels){if(ch.target.node==null||ch.target.path==='weights')continue;const k=ch.target.node+'|'+ch.target.path;if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push([an,ch,constOf(an,ch)]);}
  let dropped=0,total=0;const drop=new Set();
  for(const [k,list] of byKey){total+=list.length;const [ni,pth]=k.split('|'),node=json.nodes[+ni],rest=node[pth]||REST[pth];
   const allConst=list.length===json.animations.length&&list.every(x=>x[2]&&same(x[2],list[0][2]));
   if(allConst){if(!same(list[0][2],rest)){if(node.matrix)continue;node[pth]=list[0][2];}for(const x of list)drop.add(x[1]);continue;}
   for(const x of list)if(x[2]&&same(x[2],rest))drop.add(x[1]);}
  for(const an of json.animations){const keepCh=an.channels.filter(ch=>!drop.has(ch));dropped+=an.channels.length-keepCh.length;const used=[...new Set(keepCh.map(ch=>ch.sampler))],map=new Map(used.map((si,i)=>[si,i]));an.samplers=used.map(si=>an.samplers[si]);an.channels=keepCh.map(ch=>Object.assign({},ch,{sampler:map.get(ch.sampler)}));}
  json.animations=json.animations.filter(an=>an.channels.length);if(!json.animations.length)delete json.animations;
  log('Lean    dropped '+dropped+' of '+total+' animation channels that never change');}
 /* textures down to the budget; --jpeg Q also stores every texture no material blends by alpha as a JPEG */
 const replaced=new Map(),tool=resizer(),resized=[];
 if(opt.jpeg&&tool&&tool.name==='magick'){const q=Math.max(40,Math.min(98,+opt.jpeg||85)),alpha=new Set();
  for(const m of json.materials||[]){if(m.alphaMode&&m.alphaMode!=='OPAQUE'&&m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorTexture){const tx=json.textures[m.pbrMetallicRoughness.baseColorTexture.index];if(tx)alpha.add(tx.source);}}
  for(const t of r.textures){if(alpha.has(t.index))continue;const im=json.images[t.index],d=viewData(json,bin,im.bufferView);
   const dir=fs.mkdtempSync(path.join(os.tmpdir(),'petglb-')),a=path.join(dir,'in'),b=path.join(dir,'out.jpg');fs.writeFileSync(a,d);
   try{execFileSync('magick',[a,'-resize',max+'x'+max+'>','-background','white','-alpha','remove','-quality',String(q),b],{stdio:'pipe'});const out=fs.readFileSync(b);
    replaced.set(im.bufferView,out);im.mimeType='image/jpeg';const s2=imageSize(out);resized.push('#'+t.index+' '+t.w+'x'+t.h+' '+t.mime+' -> '+s2.w+'x'+s2.h+' JPEG q'+q+' ('+(d.length/1024|0)+' KB -> '+(out.length/1024|0)+' KB)');}
   finally{fs.rmSync(dir,{recursive:true,force:true});}}}
 const big=r.textures.filter(t=>Math.max(t.w,t.h)>max&&!replaced.has(json.images[t.index].bufferView));
 if(big.length&&!tool)log('Resize  skipped: no resizer here (sharp is not installed; no ImageMagick or sips). Sizes above are what ships.');
 for(const t of big){if(!tool)break;const im=json.images[t.index],d=viewData(json,bin,im.bufferView);let out=null;try{out=await resize(tool,d,t.mime,max);}catch(e){log('Resize  #'+t.index+' failed with '+tool.name+': '+e.message);}
  if(out&&out.length){replaced.set(im.bufferView,out);const s=imageSize(out);resized.push('#'+t.index+' '+t.w+'x'+t.h+' -> '+s.w+'x'+s.h+' ('+(d.length/1024|0)+' KB -> '+(out.length/1024|0)+' KB)');}
  else log('Resize  #'+t.index+' '+t.mime+' left as it is ('+tool.name+' cannot write it)');}
 for(const s of resized)log('Resize  '+tool.name+': '+s);
 /* only the clips the game uses */
 if(opt.trim&&json.animations){const keep=new Set(Object.values(clipMap));const before=json.animations.length;json.animations=json.animations.filter(a=>keep.has(a.name||'(unnamed)'));log('Trim    kept '+json.animations.length+' of '+before+' clips');if(!json.animations.length)delete json.animations;}
 /* a texture with no mipmaps sparkles on a small pet seen from the saddle: trilinear instead */
 for(const sm of json.samplers||[])if(sm.minFilter===9729||sm.minFilter===9728){log('Sampler minFilter '+(sm.minFilter===9729?'LINEAR':'NEAREST')+' -> LINEAR_MIPMAP_LINEAR (mipmapped, so the coat does not sparkle at riding distance)');sm.minFilter=9987;}
 let packBin=bin;
 if(opt['morph-every']||opt['morph-loop']||opt['quantize-morph']){const mf=morphFlipbook(json,bin,{every:+(opt['morph-every']||1),loopS:+(opt['morph-loop']||0),quantize:!!opt['quantize-morph']});packBin=mf.bin;for(const n of mf.notes)log('Morph   '+n);}
 const out=writeGLB(json,repack(json,packBin,replaced));
 const dest=path.resolve(opt.out||path.join(ROOT,'assets','models','pets',key+'.glb'));
 if(dest===src){console.error('Refusing to overwrite the source file');process.exit(1);}
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,out);
 const sha=crypto.createHash('sha256').update(out).digest('hex'),rel=path.relative(path.join(ROOT,'assets','models','pets'),dest).split(path.sep).join('/');
 log('Wrote   '+dest+'  ('+(out.length/1048576).toFixed(2)+' MB, sha256 '+sha.slice(0,16)+'...)');
 const b=roughBounds(json),h=b.max[1]-b.min[1];
 const clips={};for(const [s,n] of Object.entries(clipMap))clips[s]=n;
 const entry={available:true,file:rel,bytes:out.length,sha256:sha,license:'TODO e.g. CC-BY-4.0',licenseUrl:'TODO',creator:'TODO',creatorUrl:'TODO',sourceUrl:'TODO',restrictions:[],
  fit:{height:PET_HEIGHT[key]||null,yawDeg:null,groundOffset:0},clips,materials:{envMapIntensity:0.5}};
 if(PET_KIND[key]==='bird'&&!clips.fly)log('WARN    '+key+' flies with you on a winged horse: without a fly clip it stays drawn');
 if(PET_KIND[key]==='bunny'&&!clips.hop&&!clips.run&&!clips.walk)log('WARN    no hop, run or walk clip: the bunny cannot move');
 if(!clips.idle&&!clips.walk)log('WARN    neither an idle nor a walk clip was recognised: name them in the clip map by hand');
 log('Rest-pose mesh height '+(isFinite(h)?h.toFixed(3):'?')+' (node scales not applied; the game fits the posed body to '+(PET_HEIGHT[key]||'?')+' m)');
 log('\nSuggested entry for assets/models/pets/manifest.json -> "pets":');
 const txt=JSON.stringify({[key]:entry},null,1);
 console.log(opt.json?JSON.stringify({report:r,clipMap,resized,out:dest,entry:{[key]:entry}},null,1):txt.slice(1,-1).trim());
 if(opt.check){const c=await checkInGame(dest,key,entry);log('\nIn-game check (assets/pet-library.js on '+path.basename(dest)+'):');console.log(JSON.stringify(c,null,1));if(!c.ok)process.exit(1);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
