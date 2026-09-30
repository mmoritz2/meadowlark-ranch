// Independently compare source glTF scene vertices through the site's Three loader.
// CPU geometry only: images are not loaded and no browser/source script is used.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'assets/models/horse-imports/bluemesh-draft');
const mod=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const url=p=>pathToFileURL(path.join(root,p)).href;
async function loader(){
 const three=url('assets/vendor/three/build/three.module.js');
 const utils=mod(fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'),'utf8').replace("from 'three'",`from '${three}'`));
 const source=fs.readFileSync(path.join(root,'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'),'utf8').replace("from 'three'",`from '${three}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`);
 return{THREE:await import(three),GLTFLoader:(await import(mod(source))).GLTFLoader};
}
function geometryOnly(b){
 const len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len).toString());
 for(const mesh of g.meshes)for(const p of mesh.primitives)delete p.material;
 const json=Buffer.from(JSON.stringify(g)),pad=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(pad);
 const bin=b.subarray(20+len),out=Buffer.alloc(20+pad.length+bin.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(pad.length,12);out.writeUInt32LE(0x4e4f534a,16);pad.copy(out,20);bin.copy(out,20+pad.length);
 return{g,data:out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength)};
}
(async()=>{
 const receipt=JSON.parse(fs.readFileSync(path.join(base,'source/receipt.json'))),raw=fs.readFileSync(path.join(root,receipt.path)),hash=crypto.createHash('sha256').update(raw).digest('hex');
 if(hash!==receipt.sha256)throw Error('Source hash mismatch');
 const{THREE,GLTFLoader}=await loader(),{g,data}=geometryOnly(raw),gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(data,'',resolve,reject));
 gltf.scene.updateMatrixWorld(true);const expected=fs.readFileSync(process.argv[2]),meshes=[];let off=0,maxError=0,count=0;
 gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const objects=[];gltf.scene.traverse(o=>{if(o.isMesh)objects.push(o);});
 objects.sort((a,b)=>gltf.parser.associations.get(a).nodes-gltf.parser.associations.get(b).nodes);
 for(const o of objects){const p=o.geometry.attributes.position,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let error=0;
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);const values=v.toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],values[k]);max[k]=Math.max(max[k],values[k]);error=Math.max(error,Math.abs(values[k]-expected.readDoubleLE(off)));off+=8;}count++;}
  maxError=Math.max(maxError,error);meshes.push({name:o.name,node:gltf.parser.associations.get(o).nodes,vertices:p.count,bounds:[min,max],maxPythonVsThreeError:error});
 }
 if(off!==expected.length||maxError>2e-6)throw Error(`Source pose mismatch ${maxError}; ${off}/${expected.length}`);
 const report={sourceSha256:hash,method:'site-vendored GLTFLoader, source scene0 node pose, SkinnedMesh.applyBoneTransform then matrixWorld; independent all-vertex comparison with Python glTF skin decoder',vertexCount:count,maxPythonVsThreeError:maxError,passed:true,meshes};
 const out=path.join(base,'work/canonical-rig');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-three-pose-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
