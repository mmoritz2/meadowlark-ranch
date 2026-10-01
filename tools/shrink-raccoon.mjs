/* Raccoon scan: 19 chunks of one 1.89M-triangle mesh -> one welded, simplified mesh with its UVs, textures resized.
   How assets/models/pets/raccoon.glb was made from Pigcraft's "Realistic Raccoon 3D Model" (realistic_raccoon_3d_model.glb,
   sha256 cd8bd77f..., see raccoon.provenance.json), kept here so it can be made again:
     node tools/shrink-raccoon.mjs realistic_raccoon_3d_model.glb assets/models/pets/raccoon.glb 20000
   It needs @gltf-transform/core and meshoptimizer where Node can import them (they are not part of the game; run it from a
   folder whose node_modules has them) and ImageMagick's `magick`. WORK=<dir> holds the intermediate images (default: the
   system temp folder). NRM_SCALE (default 0.25) is the normal map's strength: at full strength its noisy normals caught the
   game's rim light and frosted the fur. */
import {NodeIO,Document,VertexLayout} from '@gltf-transform/core';
import {MeshoptSimplifier as MS} from 'meshoptimizer';
import fs from 'fs';import os from 'os';import path from 'path';import {execFileSync} from 'child_process';
await MS.ready;
const SRC=process.argv[2],OUT=process.argv[3],TARGET=+(process.argv[4]||20000);
const BASE_PX=+(process.env.BASE_PX||2048),NRM_PX=+(process.env.NRM_PX||1024),Q=+(process.env.JPEG_Q||86);
const S=path.join(process.env.WORK||path.join(os.tmpdir(),'shrink-raccoon'),'/');fs.mkdirSync(S,{recursive:true});
const io=new NodeIO();const doc=await io.read(SRC);const R=doc.getRoot();
/* 1. every chunk baked into the scene frame and concatenated */
const P=[],N=[],U=[],I=[];let base=0;
const mul=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o;};
for(const node of R.listNodes()){const mesh=node.getMesh();if(!mesh)continue;const M=node.getWorldMatrix();
 for(const p of mesh.listPrimitives()){const pos=p.getAttribute('POSITION'),nor=p.getAttribute('NORMAL'),uv=p.getAttribute('TEXCOORD_0'),ix=p.getIndices();const n=pos.getCount(),v=[],w=[],t=[];
  for(let i=0;i<n;i++){pos.getElement(i,v);nor.getElement(i,w);uv.getElement(i,t);const x=v[0],y=v[1],z=v[2];
   P.push(M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14]);
   const a=M[0]*w[0]+M[4]*w[1]+M[8]*w[2],b=M[1]*w[0]+M[5]*w[1]+M[9]*w[2],c=M[2]*w[0]+M[6]*w[1]+M[10]*w[2],L=Math.hypot(a,b,c)||1;N.push(a/L,b/L,c/L);U.push(t[0],t[1]);}
  const ia=ix.getArray();for(let i=0;i<ia.length;i++)I.push(ia[i]+base);base+=n;}}
console.log('joined',base,'verts',I.length/3,'tris');
/* turned about the vertical so the body's long axis (hips to chest, 13 degrees off in the scan) lies along +Z, the hips over x=0 */
{const th=-(+(process.env.ROT_DEG||13))*Math.PI/180,c=Math.cos(th),s=Math.sin(th),dx=+(process.env.DX||0.019);
 for(let i=0;i<base;i++){const x=P[3*i],z=P[3*i+2];P[3*i]=x*c+z*s+dx;P[3*i+2]=-x*s+z*c;const a=N[3*i],b=N[3*i+2];N[3*i]=a*c+b*s;N[3*i+2]=-a*s+b*c;}}
/* 2. weld: one vertex per position and UV (the chunks' shared edges and duplicates), normals averaged */
const key=new Map(),remap=new Uint32Array(base);const P2=[],N2=[],U2=[];let m=0;const q=a=>Math.round(a*1e6);
for(let i=0;i<base;i++){const k=q(P[3*i])+','+q(P[3*i+1])+','+q(P[3*i+2])+','+Math.round(U[2*i]*1e6)+','+Math.round(U[2*i+1]*1e6);let j=key.get(k);
 if(j===undefined){j=m++;key.set(k,j);P2.push(P[3*i],P[3*i+1],P[3*i+2]);N2.push(N[3*i],N[3*i+1],N[3*i+2]);U2.push(U[2*i],U[2*i+1]);}else{N2[3*j]+=N[3*i];N2[3*j+1]+=N[3*i+1];N2[3*j+2]+=N[3*i+2];}remap[i]=j;}
for(let j=0;j<m;j++){const L=Math.hypot(N2[3*j],N2[3*j+1],N2[3*j+2])||1;N2[3*j]/=L;N2[3*j+1]/=L;N2[3*j+2]/=L;}
let ix=new Uint32Array(I.length);for(let i=0;i<I.length;i++)ix[i]=remap[I[i]];
/* drop degenerate triangles */
{const o=[];for(let t=0;t<ix.length;t+=3){const a=ix[t],b=ix[t+1],c=ix[t+2];if(a!==b&&b!==c&&a!==c)o.push(a,b,c);}ix=Uint32Array.from(o);}
console.log('welded',m,'verts',ix.length/3,'tris');
/* 3. simplify, the normals and the UVs counted in the error so the texture charts keep their shape */
const pos=Float32Array.from(P2),att=new Float32Array(m*5);for(let j=0;j<m;j++){att[5*j]=N2[3*j];att[5*j+1]=N2[3*j+1];att[5*j+2]=N2[3*j+2];att[5*j+3]=U2[2*j];att[5*j+4]=U2[2*j+1];}
const flags=(process.env.FLAGS||'Prune').split(',').filter(Boolean);
const [dst,err]=MS.simplifyWithAttributes(ix,pos,3,att,5,[0.15,0.15,0.15,+(process.env.UVW||1),+(process.env.UVW||1)],null,Math.floor(TARGET)*3,+(process.env.ERR||0.05),flags);
console.log('simplified',dst.length/3,'tris, error',err,'(relative), scale',MS.getScale(pos,3));
/* 4. compact */
const map=new Int32Array(m).fill(-1);let k=0;const fi=new Uint32Array(dst.length);for(let i=0;i<dst.length;i++){if(map[dst[i]]<0)map[dst[i]]=k++;fi[i]=map[dst[i]];}
const fp=new Float32Array(k*3),fn=new Float32Array(k*3),fu=new Float32Array(k*2);
for(let j=0;j<m;j++){const o=map[j];if(o<0)continue;fp.set(P2.slice(3*j,3*j+3),3*o);fn.set(N2.slice(3*j,3*j+3),3*o);fu.set(U2.slice(2*j,2*j+2),2*o);}
console.log('final',k,'verts',fi.length/3,'tris');
fs.writeFileSync(S+'mesh.json',JSON.stringify({n:k,tris:fi.length/3}));
/* 5. textures: base colour JPEG, normal map JPEG, roughness from the scan's own map (G) folded to a factor */
const mt=R.listMaterials()[0];
fs.writeFileSync(S+'base_src.jpg',mt.getBaseColorTexture().getImage());fs.writeFileSync(S+'nrm_src.png',mt.getNormalTexture().getImage());
execFileSync('magick',[S+'base_src.jpg','-filter','Lanczos','-resize',BASE_PX+'x'+BASE_PX,'-quality',String(Q),'-sampling-factor','4:2:0','-strip',S+'base.jpg']);
execFileSync('magick',[S+'nrm_src.png','-filter','Lanczos','-resize',NRM_PX+'x'+NRM_PX,'-quality','90','-strip',S+'nrm.jpg']);
/* 6. the game copy */
const d=new Document();const buf=d.createBuffer();
const tb=d.createTexture('raccoon_base').setImage(fs.readFileSync(S+'base.jpg')).setMimeType('image/jpeg');
const tn=d.createTexture('raccoon_normal').setImage(fs.readFileSync(S+'nrm.jpg')).setMimeType('image/jpeg');
const mat=d.createMaterial('raccoon_fur').setBaseColorTexture(tb).setNormalTexture(tn).setNormalScale(+(process.env.NRM_SCALE||0.25)).setMetallicFactor(0).setRoughnessFactor(0.84).setDoubleSided(false);
const prim=d.createPrimitive().setMaterial(mat)
 .setAttribute('POSITION',d.createAccessor().setType('VEC3').setArray(fp).setBuffer(buf))
 .setAttribute('NORMAL',d.createAccessor().setType('VEC3').setArray(fn).setBuffer(buf))
 .setAttribute('TEXCOORD_0',d.createAccessor().setType('VEC2').setArray(fu).setBuffer(buf))
 .setIndices(d.createAccessor().setType('SCALAR').setArray(k<65536?Uint16Array.from(fi):fi).setBuffer(buf));
const mesh=d.createMesh('raccoon').addPrimitive(prim);const node=d.createNode('raccoon').setMesh(mesh);d.createScene('Scene').addChild(node);
d.getRoot().getAsset().generator='Meadowlark Ranch shrink-raccoon.mjs';
await new NodeIO().setVertexLayout(VertexLayout.SEPARATE).write(OUT,d);console.log('wrote',OUT,fs.statSync(OUT).size,'bytes; base.jpg',fs.statSync(S+'base.jpg').size,'nrm.jpg',fs.statSync(S+'nrm.jpg').size);
