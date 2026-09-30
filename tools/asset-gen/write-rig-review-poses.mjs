// Bake the real Three AnimationMixer's deformed vertices into review-only GLBs.
// Materials, source UVs and images stay original; temporary static poses are
// deliberately separate from source receipts and animated runtime assets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const candidate=process.argv[2];
if(!['ikkiz-unicorn','horse-skeleton','arabian-sculpt','fjord-sculpt','pastel-unicorn'].includes(candidate))throw Error('Expected a registered converted candidate');
const base=path.join(root,'assets/models/horse-imports',candidate,'game');
const profile=JSON.parse(fs.readFileSync(path.join(base,'profile.json')));
const bytes=fs.readFileSync(path.join(base,profile.file));
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==profile.sha256)throw Error('Converted asset hash mismatch');
const original=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const binOffset=20+bytes.readUInt32LE(12),originalBin=bytes.subarray(binOffset+8,binOffset+8+bytes.readUInt32LE(binOffset));
const threeUrl=pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href;
const THREE=await import(threeUrl),module=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const utils=module(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'),'utf8').replace("from 'three'",`from '${threeUrl}'`));
const loaderModule=module(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),'utf8').replace("from 'three'",`from '${threeUrl}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`));
const{GLTFLoader}=await import(loaderModule),loader=new GLTFLoader();
loader.register(()=>({name:'GEOMETRY_REVIEW_ONLY',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const mixer=new THREE.AnimationMixer(gltf.scene),meshes=[];
gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
if(!meshes.length)throw Error('No real skinned surfaces');
const selected=[['Rest',0],['Walk',.19],['Gallop_Left',.22],['Jump',.82]];
const out='/private/tmp/horse-import-tools/'+candidate+'-poses';fs.mkdirSync(out,{recursive:true});
const reports=[];
for(const[name,time]of selected){
 mixer.stopAllAction();const clip=THREE.AnimationClip.findByName(gltf.animations,name);if(!clip)throw Error('Missing clip '+name);
 const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(time);
 gltf.scene.updateMatrixWorld(true);
 const doc=structuredClone(original);let binary=Buffer.from(originalBin);
 function append(values,type,width){
  binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
  const data=Buffer.from(new Float32Array(values).buffer),view=doc.bufferViews.length;
  doc.bufferViews.push({buffer:0,byteOffset:binary.length,byteLength:data.length});binary=Buffer.concat([binary,data]);
  const a={bufferView:view,componentType:5126,count:values.length/width,type};
  if(type==='VEC3'){a.min=[0,1,2].map(k=>{let n=Infinity;for(let i=k;i<values.length;i+=3)n=Math.min(n,values[i]);return n;});a.max=[0,1,2].map(k=>{let n=-Infinity;for(let i=k;i<values.length;i+=3)n=Math.max(n,values[i]);return n;});}
  doc.accessors.push(a);return doc.accessors.length-1;
 }
 const staticMeshes=[],bounds=new THREE.Box3(),point=new THREE.Vector3();let vertices=0;
 for(const mesh of meshes){
  const assoc=gltf.parser.associations.get(mesh);if(assoc?.meshes===undefined||assoc?.primitives===undefined)throw Error('No original primitive association');
  const p=structuredClone(original.meshes[assoc.meshes].primitives[assoc.primitives]),g=mesh.geometry,positions=[],normals=[];
  const matrix=new THREE.Matrix4(),sum=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),normal=new THREE.Vector3();
  for(let i=0;i<g.attributes.position.count;i++){
   mesh.getVertexPosition(i,point);mesh.localToWorld(point);if(!point.toArray().every(Number.isFinite))throw Error('Nonfinite actual deformation');bounds.expandByPoint(point);positions.push(...point.toArray());vertices++;
   sum.elements.fill(0);
   for(let k=0;k<4;k++){const w=g.attributes.skinWeight.getComponent(i,k),index=g.attributes.skinIndex.getComponent(i,k);if(!w)continue;matrix.multiplyMatrices(mesh.skeleton.bones[index].matrixWorld,mesh.skeleton.boneInverses[index]);for(let c=0;c<16;c++)sum.elements[c]+=matrix.elements[c]*w;}
   matrix.multiplyMatrices(mesh.bindMatrixInverse,sum).multiply(mesh.bindMatrix).premultiply(mesh.matrixWorld);normalMatrix.setFromMatrix4(matrix);
   normal.fromBufferAttribute(g.attributes.normal,i).applyMatrix3(normalMatrix).normalize();normals.push(...normal.toArray());
  }
  p.attributes.POSITION=append(positions,'VEC3',3);p.attributes.NORMAL=append(normals,'VEC3',3);
  delete p.attributes.TANGENT;for(const key of Object.keys(p.attributes))if(/^(JOINTS|WEIGHTS)_/.test(key))delete p.attributes[key];delete p.targets;
  staticMeshes.push({name:mesh.name,primitives:[p]});
 }
 doc.meshes=staticMeshes;doc.nodes=staticMeshes.map((m,i)=>({name:m.name,mesh:i}));doc.scenes=[{nodes:doc.nodes.map((_,i)=>i)}];doc.scene=0;delete doc.animations;delete doc.skins;
 doc.extras={reviewOnly:true,animatedSha256:sha,clip:name,time,method:'Actual vendored Three AnimationMixer plus SkinnedMesh.getVertexPosition, no generative image tools'};
 binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);doc.buffers[0].byteLength=binary.length;
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
 const file=path.join(out,name+'.glb');fs.writeFileSync(file,Buffer.concat([header,jh,json,bh,binary]));reports.push({name,time,file,vertices,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
}
const report={animatedSha256:sha,candidate,actualAnimationMixer:true,sourceMaterialsAndUvsPreserved:true,poses:reports};
fs.writeFileSync(path.join(base,'actual-deformed-review-poses.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
