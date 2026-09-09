// Native visual QA exports the actual Three bridle into the authored Blender frame.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const out=path.resolve(process.argv[2]||'output/artist-bridle-native');fs.mkdirSync(out,{recursive:true});
const url=p=>pathToFileURL(path.resolve(p)).href;
const dataModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
async function cpuLoader(){
 const three=url('assets/vendor/three/build/three.module.js');
 const utils=dataModule(fs.readFileSync('assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js','utf8').replace("from 'three'",`from '${three}'`));
 const source=fs.readFileSync('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js','utf8').replace("from 'three'",`from '${three}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`);
 return {THREE:await import(three),GLTFLoader:(await import(dataModule(source))).GLTFLoader};
}
function geometryOnlyGLB(file){
 const b=fs.readFileSync(file),jsonLength=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jsonLength).toString());
 for(const mesh of g.meshes||[])for(const primitive of mesh.primitives)delete primitive.material;
 const text=Buffer.from(JSON.stringify(g)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
 const binary=b.subarray(20+jsonLength),result=Buffer.alloc(20+padded.length+binary.length);
 result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);binary.copy(result,20+padded.length);
 return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);
}
(async()=>{
 const {THREE,GLTFLoader}=await cpuLoader(),{createArtistBridle}=await import(url('assets/artist-horse-bridle.js'));
 const manifest=JSON.parse(fs.readFileSync('assets/models/artist-breeds/manifest.json','utf8')),loader=new GLTFLoader(),report=[];
 for(const key of ['bay-sporthorse','chestnut','shire']){
  const profile=manifest.breeds[key],gltf=await new Promise((res,rej)=>loader.parse(geometryOnlyGLB(path.resolve('assets/models/artist-breeds',profile.file)),'',res,rej));
  let skin;gltf.scene.traverse(o=>{if(o.isSkinnedMesh&&o.name==='HorseBody')skin=o;});
  const rig={skin,profile,key,scene:gltf.scene},bridle=createArtistBridle(THREE,rig),inv=new THREE.Matrix4().fromArray(bridle.userData.fit.bindToHead).invert(),meshes=[];
  bridle.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,positions=[];o.updateMatrix();
   for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrix).applyMatrix4(inv);positions.push([v.x,-v.z,v.y]);}
   meshes.push({name:o.name,positions,indices:o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:p.count},(_,i)=>i),material:{color:o.material.color.toArray(),metalness:o.material.metalness,roughness:o.material.roughness}});
  });
  const crown=bridle.userData.fit.rawPaths.find(p=>p.name==='Crownpiece').points,center=new THREE.Vector3(...crown[0]).add(new THREE.Vector3(...crown.at(-1))).multiplyScalar(.5),bodyPos=skin.geometry.attributes.position,bodyIndex=skin.geometry.index;
  const ray=new THREE.Ray(),hit=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),throatClearance={minimumM:Infinity,insideVertices:0,vertices:0,missingRays:0};
  for(const p of meshes.find(m=>m.name==='Throatlatch').positions){
   const point=new THREE.Vector3(p[0],p[2],-p[1]),distance=point.distanceTo(center);ray.set(center,point.clone().sub(center).normalize());let surface=Infinity;
   for(let j=0;j<(bodyIndex?.count||bodyPos.count);j+=3){a.fromBufferAttribute(bodyPos,bodyIndex?bodyIndex.getX(j):j);b.fromBufferAttribute(bodyPos,bodyIndex?bodyIndex.getX(j+1):j+1);c.fromBufferAttribute(bodyPos,bodyIndex?bodyIndex.getX(j+2):j+2);if(ray.intersectTriangle(a,b,c,false,hit)){const d=hit.distanceTo(center);if(d>1e-5)surface=Math.min(surface,d);}}
   throatClearance.vertices++;if(!Number.isFinite(surface)){throatClearance.missingRays++;continue;}const gap=distance-surface;throatClearance.minimumM=Math.min(throatClearance.minimumM,gap);if(gap<-.0001)throatClearance.insideVertices++;
  }
  const record={key,profile,fit:bridle.userData.fit,meshes,throatClearance,moduleSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync('assets/artist-horse-bridle.js')).digest('hex')};
  fs.writeFileSync(path.join(out,key+'.json'),JSON.stringify(record));report.push({key,meshes:meshes.length,vertices:meshes.reduce((n,m)=>n+m.positions.length,0),throatClearance,moduleSha256:record.moduleSha256});
 }
 fs.writeFileSync(path.join(out,'export-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
