import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createOuterLandscape as candidate} from '../assets/outer-landscape.js';
import {createOuterRockData,retainRockClearWoodland,installOuterRockClusters,createOuterRockGroundSampler} from '../assets/outer-rock-clusters.mjs';
import {OUTER_ROCK_SOURCE} from '../assets/outer-rock-source.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),sha=a=>crypto.createHash('sha256').update(a).digest('hex');
const utility=fs.readFileSync(new URL('../assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href}'`);
const {mergeGeometries}=await import('data:text/javascript;base64,'+Buffer.from(utility).toString('base64'));
test('Scenic rock clusters retain the scanned geometry, exact ground and surviving outer roots',()=>{
function fixture(){const g=new T.PlaneGeometry(1000,1000,512,512);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[];const heightAt=(x,z)=>.003*x-.007*z+Math.sin(x*.021)*1.7+Math.cos(z*.017)*2.2;
 for(let i=0;i<p.count;i++){p.setY(i,heightAt(p.getX(i),p.getZ(i)));colors.push(.91,.96,.89);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return{THREE:T,scene:new T.Scene(),heightAt,groundMesh:new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true}))};}
const args=fixture(),next=candidate(args),savedRandom=Math.random;
const groundBefore=Object.fromEntries(Object.entries(next.mesh.geometry.attributes).map(([k,a])=>[k,sha(a.array)]));
const data=next.rockClusterData,ground=createOuterRockGroundSampler(next.mesh.geometry.attributes.position.array,next.mesh.geometry.index.array);
// Woodland identities are now anchored to the original sampling topology and
// reseated onto the refined terrain. Test rock filtering independently of that
// selection owner, which has its own watershed identity/grounding contracts.
const originalSites=[...next.woodlandSites,...next.rockClusters.excludedRoots];
assert.equal(new Set(originalSites.map(r=>r.x+':'+r.z)).size,4200);
const probes=[...data.records.map(r=>({x:r.x,z:r.z})),{x:1500,z:1500}];
const probeResult=retainRockClearWoodland(probes,data);
assert.deepEqual(probeResult.kept,[probes.at(-1)]);
assert.equal(probeResult.excluded.length,data.records.length);
assert.equal(next.woodlandSites.length+next.rockClusters.excludedRoots.length,4200);assert(next.rockClusters.excludedRoots.length>0&&next.rockClusters.excludedRoots.length<100);
for(const r of next.woodlandSites){assert.equal(data.intersectsRoot(r),false);assert(Math.abs(r.y-ground(r.x,r.z).height)<1e-8);}
for(const r of next.rockClusters.excludedRoots){assert.equal(data.intersectsRoot(r),true);}
Math.random=()=>{throw Error('Unexpected RNG in pure placement');};try{const again=createOuterRockData({positions:next.mesh.geometry.attributes.position.array,index:next.mesh.geometry.index.array});assert.deepEqual(again.records,data.records);assert.deepEqual(retainRockClearWoodland(originalSites,again).kept,next.woodlandSites);}finally{Math.random=savedRandom;}
// Decode the real resident GLB so the emitted mesh contract uses full scan arrays.
const raw=fs.readFileSync(ROOT+'/assets/models/world/realism/rock_moss_set_01.glb');assert.equal(sha(raw),OUTER_ROCK_SOURCE.sha256);const len=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+len).toString()),bin=raw.subarray(28+len);
function attribute(i){const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],[Typed,width]=({5126:[Float32Array,4],5125:[Uint32Array,4],5123:[Uint16Array,2],5121:[Uint8Array,1]})[a.componentType],array=new Typed(a.count*count),offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||width*count,view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength),read=({5126:'getFloat32',5125:'getUint32',5123:'getUint16',5121:'getUint8'})[a.componentType];for(let r=0;r<a.count;r++)for(let c=0;c<count;c++)array[r*count+c]=view[read](offset+r*stride+c*width,true);return new T.BufferAttribute(array,count,a.normalized||false);}
const material=new T.MeshStandardMaterial();material.name=gltf.materials[0].name;
const parts=gltf.meshes.map(m=>{const p=m.primitives[0],geo=new T.BufferGeometry();assert.equal(p.material,0);for(const [name,i]of Object.entries(p.attributes)){const key={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TANGENT:'tangent',COLOR_0:'color'}[name];assert(key,name);geo.setAttribute(key,attribute(i));}geo.setIndex(attribute(p.indices));geo.computeBoundingBox();return{geo,mat:material,bounds:geo.boundingBox.clone()};});
const sourceHashes=parts.map(p=>({attributes:Object.fromEntries(Object.entries(p.geo.attributes).map(([k,a])=>[k,sha(a.array)])),index:sha(p.geo.index.array)}));
const G={THREE:T,scene:new T.Scene(),world:{outerLandscape:next}};installOuterRockClusters(G,parts,mergeGeometries);assert.equal(next.rockClusters.ready,true);const mesh=next.rockClusters.mesh;assert.equal(mesh.material,material);assert.equal(mesh.geometry.groups.length,0);assert.equal(mesh.geometry.index.count/3,40488);assert.equal(mesh.geometry.attributes.position.count,23489);assert.equal(mesh.visible,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,true);assert.equal(G.scene.children.length,1);installOuterRockClusters(G,parts,mergeGeometries);assert.equal(G.scene.children.length,1);
const afterHashes=parts.map(p=>({attributes:Object.fromEntries(Object.entries(p.geo.attributes).map(([k,a])=>[k,sha(a.array)])),index:sha(p.geo.index.array)}));assert.deepEqual(sourceHashes,afterHashes);
let vertex=0,minMargin=Infinity,maxFootGap=-Infinity,minDoubleArea=Infinity,maxNormalError=0;
const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv,index=mesh.geometry.index;
for(const r of data.records){const part=parts[r.part],matrix=new T.Matrix4().fromArray(r.matrix),nm=new T.Matrix3().getNormalMatrix(matrix);assert(matrix.determinant()>0);assert(r.maxFootGap<=-r.sink+1e-8);maxFootGap=Math.max(maxFootGap,r.maxFootGap);
 for(let i=0;i<part.geo.attributes.position.count;i++){const expected=new T.Vector3().fromBufferAttribute(part.geo.attributes.position,i).applyMatrix4(matrix),actual=new T.Vector3().fromBufferAttribute(position,vertex+i);assert(expected.distanceTo(actual)<1e-4);assert.equal(uv.getX(vertex+i),part.geo.attributes.uv.getX(i));assert.equal(uv.getY(vertex+i),part.geo.attributes.uv.getY(i));minMargin=Math.min(minMargin,Math.max(Math.abs(actual.x),Math.abs(actual.z))-500);const en=new T.Vector3().fromBufferAttribute(part.geo.attributes.normal,i).applyNormalMatrix(nm),an=new T.Vector3().fromBufferAttribute(normal,vertex+i);maxNormalError=Math.max(maxNormalError,en.distanceTo(an));}
 vertex+=part.geo.attributes.position.count;
}
assert(minMargin>26);assert(maxNormalError<1e-6);for(const a of Object.values(mesh.geometry.attributes))for(const n of a.array)assert(Number.isFinite(n));
for(let i=0;i<index.count;i+=3){const a=new T.Vector3().fromBufferAttribute(position,index.getX(i)),b=new T.Vector3().fromBufferAttribute(position,index.getX(i+1)),c=new T.Vector3().fromBufferAttribute(position,index.getX(i+2));minDoubleArea=Math.min(minDoubleArea,b.sub(a).cross(c.sub(a)).length());}assert(minDoubleArea>1e-6,'No transformed scan triangle degenerates');
// The source integration remains exact except for cached resident parts and a
// late installation, after all original asynchronous placement passes complete.
const scan=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8');assert(scan.indexOf('installOuterRockClusters(G,outerRockParts,mergeGeometries)')>scan.indexOf('for(const install of [installRocks'));assert(scan.includes('state.willows?.update();state.thunderOak?.update();updateTrees();\n    try{installOuterRockClusters'));assert(!scan.includes('outerRockParts,range'));

assert.deepEqual(Object.fromEntries(Object.entries(next.mesh.geometry.attributes).map(([k,a])=>[k,sha(a.array)])),groundBefore);

});
