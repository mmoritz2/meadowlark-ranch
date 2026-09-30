/* Test fixtures for the realistic-pet path (assets/pet-library.js), made here from nothing: no download.
   Two small rigged, animated models written as GLB with the vendored three.js (maths and shapes only;
   GLTFExporter is not vendored, so the glTF is assembled by hand with tools/prepare-pet-glb.mjs's writer):

     fixture-quad.glb  a four-legged animal, built the awkward way real downloads arrive: a Sketchfab-style
                       Z-up root pair, an FBX-style Armature at 0.01 scale with bones in centimetres,
                       facing +X instead of +Z, floating 20 cm above its floor, 1.5 units tall, a 2048 px
                       texture, and root motion in its Walk and Run. Clips: Idle, Walk, Run, Armature|Sit.
     fixture-bird.glb  a bird facing +Z, 0.8 units tall. Clips: Idle, Walk (hops), Fly, TakeOff
                       (no Glide and no Land, so the fallbacks are exercised).
     broken.glb        not a model at all (a load that must fail quietly, with no 404).

   The game has to fit, turn, ground, strip and animate both. Run:  node tools/fixtures/pets/make-fixtures.mjs */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../../assets/vendor/three/build/three.module.js';
import {writeGLB} from '../../prepare-pet-glb.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ a PNG, by hand -------------- */
const CRC=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c;});
const crc=b=>{let c=-1;for(const x of b)c=CRC[(c^x)&255]^(c>>>8);return (c^-1)>>>0;};
function png(w,h,fn){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const [r,g,b]=fn(x/w,y/h);const o=y*(w*3+1)+1+x*3;raw[o]=r;raw[o+1]=g;raw[o+2]=b;}}
 const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
 const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;ih[10]=0;ih[11]=0;ih[12]=0;
 return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}

/* ------------------------------------------------------------------ a glTF, by hand ------------- */
function gltfBuilder(){
 const J={asset:{version:'2.0',generator:'Meadowlark Ranch fixture maker'},scenes:[{nodes:[]}],scene:0,nodes:[],meshes:[],skins:[],accessors:[],bufferViews:[],animations:[],materials:[],textures:[],images:[],samplers:[]},parts=[];let off=0;
 const view=(buf,target)=>{const pad=(4-off%4)%4;if(pad){parts.push(Buffer.alloc(pad));off+=pad;}const bv={buffer:0,byteOffset:off,byteLength:buf.length};if(target)bv.target=target;J.bufferViews.push(bv);parts.push(buf);off+=buf.length;return J.bufferViews.length-1;};
 const acc=(arr,type,comp,target,minmax)=>{const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type];const buf=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength);const a={bufferView:view(buf,target),componentType:comp,count:arr.length/n,type};
  if(minmax){a.min=[];a.max=[];for(let k=0;k<n;k++){let mn=Infinity,mx=-Infinity;for(let i=k;i<arr.length;i+=n){mn=Math.min(mn,arr[i]);mx=Math.max(mx,arr[i]);}a.min.push(mn);a.max.push(mx);}}J.accessors.push(a);return J.accessors.length-1;};
 const node=(o,parent)=>{J.nodes.push(o);const i=J.nodes.length-1;if(parent==null)J.scenes[0].nodes.push(i);else (J.nodes[parent].children=J.nodes[parent].children||[]).push(i);return i;};
 return {J,acc,view,node,bin:()=>Buffer.concat(parts)};
}
/* pieces of a body, each rigidly on one bone (or blended between two along an axis), merged into one mesh */
function body(){const P=[],N=[],U=[],JN=[],WT=[],I=[];
 return {add(g,m,skin){g=g.toNonIndexed?g.index?g.toNonIndexed():g:g;g.applyMatrix4(m);const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,base=P.length/3;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);P.push(x,y,z);N.push(n.getX(i),n.getY(i),n.getZ(i));U.push(uv?uv.getX(i):0,uv?uv.getY(i):0);const s=skin(x,y,z);JN.push(s[0],s[1]||0,0,0);WT.push(s[2]==null?1:s[2],s[2]==null?0:1-s[2],0,0);I.push(base+i);}},
  arrays(){return {P:new Float32Array(P),N:new Float32Array(N),U:new Float32Array(U),J:new Uint16Array(JN),W:new Float32Array(WT),I:new Uint32Array(I)};}};}
const M=(x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
const qz=a=>{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),a);return [q.x,q.y,q.z,q.w];};
const qy=a=>{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),a);return [q.x,q.y,q.z,q.w];};
const qx=a=>{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),a);return [q.x,q.y,q.z,q.w];};
const qmul=(a,b)=>{const q=new THREE.Quaternion(...a).multiply(new THREE.Quaternion(...b));return [q.x,q.y,q.z,q.w];};
/* a rig from absolute rest positions: {name:[x,y,z,parent]} -> bones with local translations */
function rig(G,defs,parentNode){const idx={},world={},bones=[];
 for(const [name,[x,y,z,par]] of Object.entries(defs)){const pw=par?world[par]:[0,0,0];world[name]=[x,y,z];const i=G.node({name,translation:[x-pw[0],y-pw[1],z-pw[2]]},par?idx[par]:parentNode);idx[name]=i;bones.push(name);}
 return {idx,world,bones};}
/* inverse bind matrices from the node hierarchy: joint space from the skinned mesh's own space (its
   vertices are in the Armature's centimetres, so the 0.01 goes into every inverse bind matrix, as in an
   FBX-converted download) */
function ibms(G,jointIdx,meshNode){const objs=G.J.nodes.map(n=>{const o=new THREE.Object3D();if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
 G.J.nodes.forEach((n,i)=>{for(const c of n.children||[])objs[i].add(objs[c]);});for(const r of G.J.scenes[0].nodes)objs[r].updateMatrixWorld(true);
 const out=new Float32Array(jointIdx.length*16);const mw=objs[meshNode].matrixWorld;jointIdx.forEach((j,k)=>{new THREE.Matrix4().copy(objs[j].matrixWorld).invert().multiply(mw).toArray(out,k*16);});return {out,objs};}
function clip(G,name,dur,tracks,fps=30){const n=Math.round(dur*fps)+1,times=new Float32Array(n).map((_,i)=>i/fps*(dur*fps/(n-1)));const a={name,channels:[],samplers:[]};
 const tIn=G.acc(times,'SCALAR',5126,null,true);
 for(const [node,pathName,fn] of tracks){const w=pathName==='rotation'?4:3,v=new Float32Array(n*w);for(let i=0;i<n;i++){const r=fn(times[i]/dur,times[i]);for(let k=0;k<w;k++)v[i*w+k]=r[k];}
  a.samplers.push({input:tIn,output:G.acc(v,w===4?'VEC4':'VEC3',5126),interpolation:'LINEAR'});a.channels.push({sampler:a.samplers.length-1,target:{node,path:pathName}});}
 G.J.animations.push(a);}
function finishMesh(G,B,name,material,skinIdx,parentNode){const A=B.arrays();
 const prim={attributes:{POSITION:G.acc(A.P,'VEC3',5126,34962,true),NORMAL:G.acc(A.N,'VEC3',5126,34962),TEXCOORD_0:G.acc(A.U,'VEC2',5126,34962),JOINTS_0:G.acc(A.J,'VEC4',5123,34962),WEIGHTS_0:G.acc(A.W,'VEC4',5126,34962)},indices:G.acc(A.I,'SCALAR',5125,34963),material};
 G.J.meshes.push({name,primitives:[prim]});return G.node({name,mesh:G.J.meshes.length-1,skin:skinIdx},parentNode);}

/* ================================================================== the four-legged one ========= */
function quad(){
 const G=gltfBuilder(),TAU=Math.PI*2;
 /* Sketchfab's Z-up pair (net identity), then an FBX Armature in centimetres */
 const sk=G.node({name:'Sketchfab_model',rotation:qx(-Math.PI/2)}),rn=G.node({name:'RootNode',rotation:qx(Math.PI/2)},sk),arm=G.node({name:'Armature',scale:[0.01,0.01,0.01]},rn);
 const Y0=20;   // its floor is 20 cm below the paws: it floats
 const D={Root:[0,0,0,null],Hips:[-25,95,0,'Root'],Chest:[25,100,0,'Hips'],Neck:[45,112,0,'Chest'],Head:[62,130,0,'Neck'],Tail1:[-45,100,0,'Hips'],Tail2:[-72,96,0,'Tail1']};
 for(const [L,x,z,par] of [['FL',25,12,'Chest'],['FR',25,-12,'Chest'],['HL',-25,12,'Hips'],['HR',-25,-12,'Hips']]){D[L+'_Upper']=[x,90,z,par];D[L+'_Lower']=[x,58,z,L+'_Upper'];D[L+'_Paw']=[x,Y0+10,z,L+'_Lower'];}
 const R=rig(G,D,arm),J=R.bones,ji=n=>J.indexOf(n);
 const B=body();
 B.add(new THREE.SphereGeometry(1,24,16),M(0,98,0,46,23,19),(x)=>[ji('Hips'),ji('Chest'),Math.min(1,Math.max(0,0.5-x/60))]);
 B.add(new THREE.CylinderGeometry(9,12,26,12),M(50,116,0,1,1,1,0,0,-0.9),()=>[ji('Neck')]);
 B.add(new THREE.SphereGeometry(16,18,12),M(64,132,0),()=>[ji('Head')]);
 B.add(new THREE.ConeGeometry(8,22,12),M(82,126,0,1,1,1,0,0,-Math.PI/2),()=>[ji('Head')]);   // the muzzle
 for(const s of [1,-1])B.add(new THREE.ConeGeometry(5,14,8),M(60,148,s*8),()=>[ji('Head')]);   // ears
 B.add(new THREE.CylinderGeometry(3,8,30,10),M(-58,98,0,1,1,1,0,0,Math.PI/2+0.1),()=>[ji('Tail1')]);
 B.add(new THREE.ConeGeometry(7,26,10),M(-84,94,0,1,1,1,0,0,Math.PI/2),()=>[ji('Tail2')]);
 for(const L of ['FL','FR','HL','HR']){const [x,,z]=D[L+'_Upper'];
  B.add(new THREE.CylinderGeometry(6,7,32,10),M(x,74,z),()=>[ji(L+'_Upper')]);
  B.add(new THREE.CylinderGeometry(4.5,5.5,30,10),M(x,44,z),()=>[ji(L+'_Lower')]);
  B.add(new THREE.SphereGeometry(1,12,8),M(x+3,Y0+5,z,8,5,6),()=>[ji(L+'_Paw')]);}
 /* a 2048 px coat (smooth, so the file stays small): russet back, cream belly, dark socks */
 const tex=png(2048,2048,(u,v)=>{const s=0.5+0.5*Math.sin(u*TAU*24)*Math.sin(v*TAU*6);const belly=v>0.62?1:0;return belly?[240,226,200]:[Math.round(196+30*s),Math.round(96+20*s),Math.round(40+10*s)];});
 G.J.images.push({name:'coat',mimeType:'image/png',bufferView:G.view(tex)});G.J.samplers.push({magFilter:9729,minFilter:9987});G.J.textures.push({source:0,sampler:0});
 G.J.materials.push({name:'Coat',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:0.85}});
 const joints=J.map(n=>R.idx[n]);
 const skin={name:'QuadSkin',joints,skeleton:R.idx.Root};G.J.skins.push(skin);
 const qm=finishMesh(G,B,'QuadBody',0,0,arm);
 skin.inverseBindMatrices=G.acc(ibms(G,joints,qm).out,'MAT4',5126);
 /* clips: the legs swing about +Z (forward is +X); Walk and Run carry the Root forward (root motion) */
 const T=n=>R.idx[n],rest=n=>G.J.nodes[R.idx[n]].translation;
 const hipsRest=rest('Hips');
 const legs=(amp,off,bend)=>['FL','FR','HL','HR'].flatMap((L,i)=>[[T(L+'_Upper'),'rotation',u=>qz(Math.sin(TAU*(u+off[i]))*amp)],[T(L+'_Lower'),'rotation',u=>qz(-Math.max(0,Math.cos(TAU*(u+off[i])))*bend*(i<2?-1:1))]]);
 clip(G,'Idle',2,[[T('Neck'),'rotation',u=>qz(Math.sin(TAU*u)*0.08)],[T('Tail1'),'rotation',u=>qy(Math.sin(TAU*u*2)*0.4)],[T('Hips'),'translation',u=>[hipsRest[0],hipsRest[1]+Math.sin(TAU*u)*1.0,hipsRest[2]]]]);
 clip(G,'Walk',1,[[T('Root'),'translation',u=>[90*u,0,0]],[T('Hips'),'translation',u=>[hipsRest[0],hipsRest[1]+Math.abs(Math.sin(TAU*u))*2,hipsRest[2]]],...legs(0.38,[0.25,0.75,0,0.5],0.5),[T('Tail1'),'rotation',u=>qy(Math.sin(TAU*u)*0.25)]]);
 clip(G,'Run',0.5,[[T('Root'),'translation',u=>[160*u,0,0]],[T('Hips'),'translation',u=>[hipsRest[0],hipsRest[1]+Math.abs(Math.sin(TAU*u))*6,hipsRest[2]]],...legs(0.75,[0,0.06,0.5,0.56],0.9),[T('Chest'),'rotation',u=>qz(Math.sin(TAU*u)*0.08)]]);
 clip(G,'Armature|Sit',1,[[T('Hips'),'translation',()=>[hipsRest[0],hipsRest[1]-26,hipsRest[2]]],[T('Hips'),'rotation',()=>qz(0.45)],[T('HL_Upper'),'rotation',()=>qz(1.2)],[T('HR_Upper'),'rotation',()=>qz(1.2)],[T('FL_Upper'),'rotation',()=>qz(-0.45)],[T('FR_Upper'),'rotation',()=>qz(-0.45)],[T('Neck'),'rotation',()=>qz(-0.3)]]);
 return writeGLB(G.J,G.bin());
}

/* ================================================================== the bird ==================== */
function bird(){
 const G=gltfBuilder(),TAU=Math.PI*2;
 const top=G.node({name:'Bird'}),arm=G.node({name:'Armature'},top);
 const D={Root:[0,0,0,null],Body:[0,0.36,0,'Root'],Neck:[0,0.56,0.04,'Body'],Head:[0,0.64,0.07,'Neck'],Tail:[0,0.3,-0.18,'Body'],
  WingL1:[0.13,0.5,0,'Body'],WingL2:[0.42,0.5,0,'WingL1'],WingR1:[-0.13,0.5,0,'Body'],WingR2:[-0.42,0.5,0,'WingR1'],LegL:[0.06,0.22,0.02,'Body'],FootL:[0.06,0.04,0.03,'LegL'],LegR:[-0.06,0.22,0.02,'Body'],FootR:[-0.06,0.04,0.03,'LegR']};
 const R=rig(G,D,arm),J=R.bones,ji=n=>J.indexOf(n),B=body();
 B.add(new THREE.SphereGeometry(1,20,14),M(0,0.4,0,0.16,0.22,0.17),()=>[ji('Body')]);
 B.add(new THREE.SphereGeometry(0.1,16,12),M(0,0.68,0.06),()=>[ji('Head')]);
 B.add(new THREE.ConeGeometry(0.025,0.07,8),M(0,0.66,0.17,1,1,1,Math.PI/2,0,0),()=>[ji('Head')]);
 B.add(new THREE.BoxGeometry(0.16,0.02,0.2),M(0,0.28,-0.26,1,1,1,0.3,0,0),()=>[ji('Tail')]);
 for(const [s,a,b] of [[1,'WingL1','WingL2'],[-1,'WingR1','WingR2']]){B.add(new THREE.BoxGeometry(0.3,0.02,0.16),M(s*0.27,0.5,-0.02),()=>[ji(a)]);B.add(new THREE.BoxGeometry(0.3,0.015,0.13),M(s*0.57,0.5,-0.04),()=>[ji(b)]);}
 for(const [s,l,f] of [[1,'LegL','FootL'],[-1,'LegR','FootR']]){B.add(new THREE.CylinderGeometry(0.012,0.012,0.18,6),M(s*0.06,0.13,0.02),()=>[ji(l)]);B.add(new THREE.BoxGeometry(0.05,0.02,0.08),M(s*0.06,0.01,0.05),()=>[ji(f)]);}
 G.J.materials.push({name:'Feathers',pbrMetallicRoughness:{baseColorFactor:[0.78,0.62,0.42,1],metallicFactor:0,roughnessFactor:0.9}});
 const joints=J.map(n=>R.idx[n]),skin={name:'BirdSkin',joints,skeleton:R.idx.Root};G.J.skins.push(skin);
 const bm=finishMesh(G,B,'BirdBody',0,0,arm);skin.inverseBindMatrices=G.acc(ibms(G,joints,bm).out,'MAT4',5126);
 const T=n=>R.idx[n],fold=0.0;
 const wings=(f)=>[[T('WingL1'),'rotation',f(1)],[T('WingR1'),'rotation',f(-1)],[T('WingL2'),'rotation',u=>qz(0)],[T('WingR2'),'rotation',u=>qz(0)]];
 const folded=s=>()=>qmul(qy(s*1.4),qz(s*-0.3));
 const flap=(s,amp)=>u=>qz(s*Math.sin(TAU*u)*amp+s*0.1);
 clip(G,'Idle',2,[[T('Head'),'rotation',u=>qy(Math.sin(TAU*u)*0.6)],...wings(folded)]);
 clip(G,'Walk',0.6,[[T('Body'),'translation',u=>[0,0.36+Math.max(0,Math.sin(TAU*u))*0.05,0]],[T('LegL'),'rotation',u=>qx(Math.sin(TAU*u)*0.4)],[T('LegR'),'rotation',u=>qx(-Math.sin(TAU*u)*0.4)],...wings(folded)]);
 clip(G,'Fly',0.4,[...wings(s=>flap(s,0.9)),[T('LegL'),'rotation',()=>qx(-1.2)],[T('LegR'),'rotation',()=>qx(-1.2)],[T('Root'),'translation',u=>[0,0,0.6*u]]]);   // with a little forward drift, as flying loops often have
 clip(G,'TakeOff',0.8,[...wings(s=>u=>u<0.3?qmul(qy(s*1.4*(1-u/0.3)),qz(-s*0.3*(1-u/0.3))):qz(s*Math.sin(TAU*(u-0.3)*2.5)*1.0)),[T('Root'),'translation',u=>[0,0.4*u*u,0]]]);
 return writeGLB(G.J,G.bin());
}

fs.writeFileSync(path.join(HERE,'fixture-quad.glb'),quad());
fs.writeFileSync(path.join(HERE,'fixture-bird.glb'),bird());
fs.writeFileSync(path.join(HERE,'broken.glb'),Buffer.from('this is not a glTF file: the game must keep the drawn pet and only warn\n'));
for(const f of ['fixture-quad.glb','fixture-bird.glb','broken.glb'])console.log(f,fs.statSync(path.join(HERE,f)).size,'bytes');
