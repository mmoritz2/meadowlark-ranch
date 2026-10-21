/* Import the CC BY 4.0 Canino character downloaded from the credited Fab listing.
 * Usage: node tools/asset-gen/import-canino-rider.mjs /path/to/free_stylized_cartoon_girl_rigged_character.glb
 * Meshes are converted into the existing canonical65 bind pose; textures/UVs stay authored.
 */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../../assets/vendor/three/build/three.module.js';
import {refineRiderProportions} from '../../assets/rider-proportions.js';
const source=process.argv[2];if(!source)throw Error('Pass the downloaded source GLB path');
const sourceSHA256=createHash('sha256').update(fs.readFileSync(source)).digest('hex');
if(sourceSHA256!=='50f27128499cb90fb1ebc309349ffd69bade0133d0b39009d3ad75b775ef5e1c')throw Error('The source asset has changed; review its rig and license before importing');
const target=new URL('../../assets/models/rider/rider-f.glb',import.meta.url);
const out=new URL('../../assets/models/rider/canino-f.glb',import.meta.url);
// The vendored browser modules use bare three imports. Resolve only those imports
// for this offline Node process; no network, image decoding or model scripts run.
const three=new URL('../../assets/vendor/three/build/three.module.js',import.meta.url).href;
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const utils=moduleURL(fs.readFileSync(new URL('../../assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js',import.meta.url),'utf8').replace("from 'three'",'from '+JSON.stringify(three)));
const loader=fs.readFileSync(new URL('../../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js',import.meta.url),'utf8').replace("from 'three'",'from '+JSON.stringify(three)).replace("'../utils/BufferGeometryUtils.js'",JSON.stringify(utils));
const {GLTFLoader}=await import(moduleURL(loader));
function read(path){const b=fs.readFileSync(path),n=b.readUInt32LE(12);return{j:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
function glb(j,bin){const s=JSON.stringify(j),a=Buffer.from(s.padEnd(Math.ceil(Buffer.byteLength(s)/4)*4,' ')),b=Buffer.alloc(Math.ceil(bin.length/4)*4);bin.copy(b);const o=Buffer.alloc(28+a.length+b.length);o.writeUInt32LE(0x46546c67);o.writeUInt32LE(2,4);o.writeUInt32LE(o.length,8);o.writeUInt32LE(a.length,12);o.writeUInt32LE(0x4e4f534a,16);a.copy(o,20);o.writeUInt32LE(b.length,20+a.length);o.writeUInt32LE(0x004e4942,24+a.length);b.copy(o,28+a.length);return o;}
async function load(data){const j=structuredClone(data.j);delete j.materials;delete j.images;delete j.textures;for(const m of j.meshes)for(const p of m.primitives)delete p.material;const b=glb(j,data.bin);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const src=read(source),dst=read(target),sg=await load(src),tg=await load(dst);let skin;
tg.scene.traverse(n=>{if(n.name==='Superhero_Female')skin=n;});
refineRiderProportions(T,tg.scene,skin,'f');tg.scene.updateMatrixWorld(true);sg.scene.updateMatrixWorld(true);
const targets=skin.skeleton.bones,names=targets.map(b=>b.name),by=Object.fromEntries(targets.map(b=>[b.name,b]));
const sources=[];sg.scene.traverse(n=>{if(n.isBone)sources.push(n);});
function canonical(name){
 const s=/CC_Base_([LR])_/.exec(name),side=s?'_'+s[1].toLowerCase():'';
 const n=name.replace(/^CC_Base_/,'').replace(/_[0-9]+(?:_[0-9]+)?$/,'');
 if(/BoneRoot/.test(n))return'root';
 if(/^(Hip|Pelvis)$/.test(n))return'pelvis';
 if(/^Waist/.test(n))return'spine_01';if(/^Spine01/.test(n))return'spine_02';if(/^Spine02/.test(n))return'spine_03';
 if(/^Neck/.test(n))return'neck_01';
 if(!side&&/Head|Facial|Jaw|Teeth|Tongue/.test(n)||/Eye/.test(n))return'Head';
 for(const[a,b]of[['Clavicle','clavicle'],['Upperarm','upperarm'],['Forearm','lowerarm'],['Elbow','lowerarm'],['Hand','hand'],['Thigh','thigh'],['Calf','calf'],['Knee','calf'],['Foot','foot'],['Toe','ball']])if(n.includes(a))return b+side;
 for(const[a,b]of[['Index','index'],['Mid','middle'],['Ring','ring'],['Pinky','pinky'],['Thumb','thumb']]){const m=new RegExp(a+'([123])').exec(n);if(m)return b+'_0'+m[1]+side;}
 if(/Ribs|Breast/.test(n))return'spine_03';
 if(/BigToe|IndexToe|MidToe|RingToe|PinkyToe/.test(n))return'ball'+side;
 throw Error('Unmapped source joint '+name);
}
const anchors={};
for(const n of sources){const k=canonical(n.name);const score=(/Twist|Share|Ribs|Breast|Facial|Jaw|Teeth|Tongue|Eye/.test(n.name)?10:0)+(/_[0-9]+_[0-9]+$/.test(n.name)?1:0)+(k==='pelvis'&&!/^CC_Base_Hip_/.test(n.name)?2:0);if(!anchors[k]||score<anchors[k].score)anchors[k]={bone:n,score};}
const position=b=>b.getWorldPosition(new T.Vector3()),child={root:'pelvis',pelvis:'spine_01',spine_01:'spine_02',spine_02:'spine_03',spine_03:'neck_01',neck_01:'Head'};
for(const s of ['l','r']){for(const[a,b]of[['clavicle','upperarm'],['upperarm','lowerarm'],['lowerarm','hand'],['hand','middle_01'],['thigh','calf'],['calf','foot'],['foot','ball']])child[a+'_'+s]=b+'_'+s;for(const f of ['index','middle','ring','pinky','thumb'])for(let i=1;i<3;i++)child[f+'_0'+i+'_'+s]=f+'_0'+(i+1)+'_'+s;}
const transforms={},report={source,canonicalNames:names,joints:{},meshes:[]};
function frame(a,b){const y=b.clone().sub(a).normalize(),z=new T.Vector3(0,0,1).addScaledVector(y,-y.z).normalize(),x=new T.Vector3().crossVectors(y,z).normalize();return new T.Matrix4().makeBasis(x,y,z);}
for(const k of Object.keys(anchors)){
 if(!by[k])throw Error('Target missing '+k);
 const a=position(anchors[k].bone),b=position(by[k]),next=child[k],sa=next&&anchors[next]?position(anchors[next].bone):a.clone().add(new T.Vector3(0,.1,0)),ta=next&&by[next]?position(by[next]):b.clone().add(new T.Vector3(0,.1,0));
 // Meter-space anatomical frames preserve the artist's shape across the A/T rest poses.
 const length=next?T.MathUtils.clamp(b.distanceTo(ta)/Math.max(.001,a.distanceTo(sa)),.65,1.6):1;
 const cross=k==='Head'?1:k.includes('hand')||/index|middle|ring|pinky|thumb/.test(k)?1.02:1.04;
 const m=new T.Matrix4().makeTranslation(...b.toArray()).multiply(frame(b,ta)).multiply(new T.Matrix4().makeScale(cross,length,cross)).multiply(frame(a,sa).invert()).multiply(new T.Matrix4().makeTranslation(...a.clone().negate().toArray()));
 transforms[k]=m;report.joints[k]={source:anchors[k].bone.name,from:a.toArray(),to:b.toArray(),length,cross};
}
const j={extensionsUsed:src.j.extensionsUsed,asset:{version:'2.0',generator:'Meadowlark Ranch Canino canonical65 adapter',copyright:'Canino3d Studio; CC BY 4.0. See canino-LICENSE.txt',extras:{source:'https://www.fab.com/listings/fe501f98-a9bb-4acb-b96e-e5b65d8f0d00',license:'https://creativecommons.org/licenses/by/4.0/',sourceSHA256,modifications:'Canonical65 anatomical rest-frame adaptation; authored normals and UVs retained; riding skirt/shoes removed; eye and lash material repairs; long hair anchored to Head.'}},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],skins:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}],materials:structuredClone(src.j.materials),textures:structuredClone(src.j.textures),samplers:structuredClone(src.j.samplers||[]),images:structuredClone(src.j.images)};
const chunks=[];let offset=0;
function bytes(b){const pad=Buffer.alloc((4-offset%4)%4);if(pad.length){chunks.push(pad);offset+=pad.length;}const id=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:b.length});chunks.push(b);offset+=b.length;return id;}
function attribute(a,type,componentType=5126){const v=bytes(Buffer.from(a.buffer,a.byteOffset,a.byteLength)),d={bufferView:v,componentType,count:a.length/({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type]),type};if(type==='VEC3'){d.min=[Infinity,Infinity,Infinity];d.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.length;i++) {d.min[i%3]=Math.min(d.min[i%3],a[i]);d.max[i%3]=Math.max(d.max[i%3],a[i]);}}const id=j.accessors.length;j.accessors.push(d);return id;}
for(let i=0;i<j.images.length;i++){const view=src.j.bufferViews[src.j.images[i].bufferView];j.images[i].bufferView=bytes(src.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));}
const ids=new Map();targets.forEach((b,i)=>{ids.set(b,i);j.nodes.push({name:b.name,matrix:b.matrixWorld.toArray()});j.scenes[0].nodes.push(i);});
const inv=new Float32Array(targets.flatMap(b=>b.matrixWorld.clone().invert().toArray()));j.skins.push({joints:targets.map((_,i)=>i),inverseBindMatrices:attribute(inv,'MAT4')});
const meshes=[];sg.scene.traverse(n=>{if(n.isSkinnedMesh)meshes.push(n);});
for(const mesh of meshes){
 const sourceNode=src.j.nodes.find(n=>n.name===mesh.name),sourceMesh=src.j.meshes[sourceNode.mesh],material=sourceMesh.primitives[0].material;
 // The riding wardrobe supplies trousers and boots. Keep the authored top and hair.
 if([19,21,22].includes(material))continue;
 const g=mesh.geometry.clone(),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,newP=new Float32Array(p.count*3),newN=new Float32Array(p.count*3),newJ=new Uint16Array(p.count*4),newW=new Float32Array(p.count*4),v=new T.Vector3(),q=new T.Vector3(),sum=new T.Vector3();
 const srcNormal=mesh.skeleton.bones.map((b,i)=>new T.Matrix3().getNormalMatrix(new T.Matrix4().multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse).multiply(b.matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix)));
 const dstNormal=Object.fromEntries(Object.entries(transforms).map(([k,m])=>[k,new T.Matrix3().getNormalMatrix(m)])),ns=new T.Vector3(),nn=new T.Vector3(),nq=new T.Vector3();
 for(let i=0;i<p.count;i++){
  const originalNormal=new T.Vector3().fromBufferAttribute(g.attributes.normal,i);ns.set(0,0,0);for(let c=0;c<4;c++){const w=sw.array[i*4+c];if(w)ns.addScaledVector(nq.copy(originalNormal).applyMatrix3(srcNormal[si.array[i*4+c]]).normalize(),w);}ns.normalize();nn.set(0,0,0);
  mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);sum.set(0,0,0);const weights=new Map();
  for(let c=0;c<4;c++){const w=sw.array[i*4+c];if(!w)continue;const k=material===20?'Head':canonical(mesh.skeleton.bones[si.array[i*4+c]].name);sum.addScaledVector(q.copy(v).applyMatrix4(transforms[material===20?'Head':k]),w);const idx=names.indexOf(k);weights.set(idx,(weights.get(idx)||0)+w);nn.addScaledVector(nq.copy(ns).applyMatrix3(dstNormal[k]).normalize(),w);}
  sum.toArray(newP,i*3);nn.normalize().toArray(newN,i*3);let c=0;for(const[idx,w]of weights){newJ[i*4+c]=idx;newW[i*4+c++]=w;}
 }
 g.setAttribute('position',new T.BufferAttribute(newP,3));g.setAttribute('normal',new T.BufferAttribute(newN,3));
 const attrs={POSITION:attribute(newP,'VEC3'),NORMAL:attribute(g.attributes.normal.array,'VEC3'),JOINTS_0:attribute(newJ,'VEC4',5123),WEIGHTS_0:attribute(newW,'VEC4')};
 if(g.attributes.uv)attrs.TEXCOORD_0=attribute(g.attributes.uv.array,'VEC2');
 const idx=g.index?new Uint32Array(g.index.array):Uint32Array.from({length:p.count},(_,i)=>i),mi=j.meshes.length,label='Canino_'+(src.j.materials[material].name||material);
 j.meshes.push({name:label,primitives:[{attributes:attrs,indices:attribute(idx,'SCALAR',5125),material}]});j.nodes.push({name:label,mesh:mi,skin:0});j.scenes[0].nodes.push(j.nodes.length-1);
 const box=new T.Box3().setFromBufferAttribute(g.attributes.position);report.meshes.push({name:label,material,vertices:p.count,min:box.min.toArray(),max:box.max.toArray()});
}
// Conversion repairs: authored lashes are texture cutouts; the right eye is opaque.
j.materials[7].alphaMode='MASK';j.materials[7].alphaCutoff=.3;j.materials[7].doubleSided=true;
j.materials[10].pbrMetallicRoughness.baseColorFactor=[1,1,1,1];j.materials[10].alphaMode='OPAQUE';
for(const i of [11,13,14,15,16,17])j.materials[i].doubleSided=true;
j.buffers[0].byteLength=offset;fs.writeFileSync(out,glb(j,Buffer.concat(chunks)));console.log('Converted',report.meshes.length,'meshes,',fs.statSync(out).size,'bytes');
