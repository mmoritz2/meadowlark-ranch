import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createGeology} from '../assets/geology.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
import {loadHollowpeakCohortPayload} from '../assets/hollowpeak-cohort-payload.mjs';
import {applyHollowpeakCanonicalField,HOLLOWPEAK_CANONICAL_FIELD} from '../assets/hollowpeak-canonical-field.mjs';
export {T};
export const hash=b=>createHash('sha256').update(b).digest('hex');

// Read and authenticate the actual resident cohort. This is a canonical PATCH
// inside a full test grid; zero-valued exterior nodes are explicitly synthetic.
// The manifest's finalFieldSHA256 identifies its reviewed production authority,
// and is never claimed to be the SHA of this mixed component-test grid.
export const packetBytes=fs.readFileSync(new URL('../assets/hollowpeak-cohort-1.bin',import.meta.url));
export const authenticatePacket=bytes=>loadHollowpeakCohortPayload({cryptoImpl:webcrypto,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)})});
export const payload=await authenticatePacket(packetBytes);
export const fieldHash=payload.finalFieldSHA256;
export const fixtureScope=Object.freeze({canonicalPatchAuthenticated:true,gridSize:513,patchNodes:HOLLOWPEAK_CANONICAL_FIELD.nodes,exterior:'synthetic zero-height test nodes',wholeGridIsReviewedProductionField:false,runtimeAdmission:'Isolated ready/anchor/ecology flags for component testing, not a live game readiness certificate'});

// A saved test pose only. Production seating uses each actual placed owner's
// matrix and actual canonical grid; no pose literal enters the runtime module.
const TEST_POSE=[-.4110980034247775,0,-.82006050309551,0,0,.9173335255822167,0,0,.82006050309551,0,-.4110980034247775,0,-182.3735044346476,6.811864398877741,-240.80179570622732,1];
const blob=fs.readFileSync(new URL('../assets/models/world/realism/rock_moss_set_01.glb',import.meta.url));
if(hash(blob)!=='0d03a00efdf2ac68c5bd3a604e952afd0ccbd7ca8452ece076d91cc578f88f84')throw Error('Resident boulder model pin changed');
const jsonLength=blob.readUInt32LE(12),gltf=JSON.parse(blob.subarray(20,20+jsonLength)),binary=blob.subarray(28+jsonLength);
function accessor(i){
 const a=gltf.accessors[i],view=gltf.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3}[a.type],Ctor={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];
 if(!n||!Ctor)throw Error('Unsupported resident fixture accessor');
 const out=new Ctor(a.count*n),width=Ctor.BYTES_PER_ELEMENT,offset=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||n*width;
 for(let j=0;j<a.count;j++)for(let k=0;k<n;k++){const at=offset+j*stride+k*width;out[j*n+k]=a.componentType===5126?binary.readFloatLE(at):a.componentType===5123?binary.readUInt16LE(at):binary.readUInt32LE(at);}
 return{array:out,itemSize:n};
}
export function fixture({placement=null}={}){
 const heights=new Float32Array(513*513);applyHollowpeakCanonicalField(heights,payload.fieldBytes);
 const terrainH=(x,z)=>{const step=1000/512,gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,n=iz*513+ix,a=heights[n],b=heights[n+1],c=heights[n+513],d=heights[n+514];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);};
 const scene=new T.Scene(),geology=createGeology({THREE:T,loadTextures:false}),mesh=geology.makeBoulder(1,9204);
 if(placement){const{x,z,s=1,yaw=.7}=placement;mesh.scale.setScalar(s);mesh.rotation.y=yaw;mesh.position.set(x,terrainH(x,z)-.025,z);}else new T.Matrix4().fromArray(TEST_POSE).decompose(mesh.position,mesh.quaternion,mesh.scale);
 scene.add(mesh);mesh.updateWorldMatrix(true,false);
 const node=gltf.nodes[3];if(node.mesh!==3||node.matrix||node.rotation||node.scale)throw Error('Resident collection transform changed');
 // pieces(collection=true) discards the gallery translation; this node has no
 // rotation/scale to bake. Parse its actual GLB buffers without texture loaders.
 const primitive=gltf.meshes[node.mesh].primitives[0],geo=new T.BufferGeometry();
 for(const[key,name]of[['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=accessor(primitive.attributes[key]);geo.setAttribute(name,new T.BufferAttribute(a.array,a.itemSize));}
 const index=accessor(primitive.indices);geo.setIndex(new T.BufferAttribute(index.array,1));geo.computeBoundingBox();geo.computeBoundingSphere();
 const piece={geo,mat:new T.MeshStandardMaterial({name:'rock_moss_set_01'}),bounds:geo.boundingBox.clone()};
 const collider={x:mesh.position.x,z:mesh.position.z,r:mesh.scale.x*1.05},beforeCircle={x:900,z:900,r:1},afterCircle={x:901,z:901,r:1},source={index:3,seed:9204,mesh,collider};
 const solidWorld=createSolidWorld({THREE:T}),groundSurfaces=[],runtime={status:'ready',payload:{...payload},ecology:{status:'applied',trees:{status:'applied'}},collision:{legacyReplaced:true},anchorGrounding:{status:'applied-same-owner',id:'snowpeak'},queries:{},heights};
 const world={terrainH,groundH:(x,z)=>groundSurfaces.reduce((h,f)=>Math.max(h,f(x,z)),terrainH(x,z)),groundSurfaces,solidWorld,colliders:[beforeCircle,collider,afterCircle],hollowpeakRuntime:runtime,fallsLandscape:{ownedQueries:runtime.queries}};
 return{G:{THREE:T,scene,world},source,piece,runtime,mesh,circle:collider,solidWorld,groundSurfaces,world,heights,fixtureScope};
}

// Read the current product constructor as evidence. The test overlay adds one
// metadata push AFTER its existing circle push; it adds no Three constructors,
// shape choices or random draws. This is a source-phase component reproduction,
// not a claim that these seeded poses are the full live world's random state.
export const rawHTML=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const begin=rawHTML.indexOf('let snowpeakBoulderSource=null;'),end=rawHTML.indexOf('/* procedurally carved river, bridge, reeds & wheat field */',begin);
if(begin<0||end<0)throw Error('Current actual raw boulder block missing');
export const constructorSource=rawHTML.slice(begin,end);
const captureLine=' if(sourceCircle)colliders.push(sourceCircle);';
if(constructorSource.split(captureLine).length!==2)throw Error('Current raw capture edge changed');
const runConstructor=new Function('geology','groundH','cottonwoodReserved','scene','colliders','captured',constructorSource+'\nreturn snowpeakBoulderSource;');
const runCaptured=new Function('geology','groundH','cottonwoodReserved','scene','colliders','captured',constructorSource.replace(captureLine,captureLine+'\n captured.push({index:i,seed:i+9201,mesh:m,collider:sourceCircle});')+'\nreturn snowpeakBoulderSource;');
export function withSeed(seed,fn){
 const prior=Math.random;let n=0,s=seed>>>0;Math.random=()=>{n++;s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 try{const value=fn();return{value,draws:n,state:s,next:Math.random()};}finally{Math.random=prior;}
}
export function rawFixture({seed=1,capture=true,reserved=()=>false,fullField=null}={}){
 const common=withSeed(seed^0x51a7,()=>({f:fixture(),geology:createGeology({THREE:T,loadTextures:false})})).value;
 const f=common.f;f.G.scene.remove(f.mesh);f.world.colliders.length=0;
 if(fullField){if(!(fullField instanceof Float32Array)||fullField.length!==f.heights.length)throw Error('Actual full field length');f.heights.set(fullField);}
 const captured=[],geology=common.geology;
 const rng=withSeed(seed,()=> (capture?runCaptured:runConstructor)(geology,f.world.groundH,reserved,f.G.scene,f.world.colliders,captured));
 const sources=capture?captured:f.G.scene.children.filter(m=>m.userData.geology?.kind==='boulder').map(mesh=>({index:mesh.userData.geology.seed-9201,seed:mesh.userData.geology.seed,mesh,collider:f.world.colliders.find(c=>c.x===mesh.position.x&&c.z===mesh.position.z)||null}));
 f.G.scene.updateMatrixWorld(true);
 return{...f,sources,rng,seed,constructorSHA:hash(constructorSource)};
}
export function sourceSnapshot(f){return{rng:{draws:f.rng.draws,state:f.rng.state,next:f.rng.next},sources:f.sources.map(s=>({index:s.index,seed:s.seed,uuid:s.mesh.uuid,geometryUUID:s.mesh.geometry.uuid,materialUUID:s.mesh.material.uuid,matrix:s.mesh.matrixWorld.elements.slice(),positions:hash(new Uint8Array(s.mesh.geometry.attributes.position.array.buffer)),indices:hash(new Uint8Array(s.mesh.geometry.index.array.buffer)),circle:s.collider?{...s.collider}:null})),colliders:f.world.colliders.map(c=>({...c}))};}
export function fakeScheduler(){let n=0;const jobs=new Map();return{schedule:fn=>{const id=++n;jobs.set(id,fn);return id;},cancel:id=>jobs.delete(id),jobs,run(){const first=jobs.entries().next().value;if(!first)return false;jobs.delete(first[0]);first[1]();return true;}};}

export const recordedPoses=JSON.parse(fs.readFileSync(new URL('./fixtures/packed-static-boulder-poses.json',import.meta.url)));
export function recordedCohort(seed=1){
 const records=recordedPoses.cohorts.find(c=>c.seed===seed);if(!records)throw Error('Unknown recorded cohort');const f=rawFixture({seed}),B=f.piece.bounds,center=[(B.min.x+B.max.x)/2,(B.min.z+B.max.z)/2];
 const owners=records.rows.map(row=>{
  const source=f.sources.find(s=>s.index===row.index),mesh=source.mesh;mesh.position.y=row.matrix[13];mesh.updateWorldMatrix(true,false);
  if(!mesh.matrixWorld.elements.every((v,i)=>Object.is(v,row.matrix[i])))throw Error('Current actual constructor pose differs from recorded source');
  const geometry=f.piece.geo.clone();geometry.translate(-center[0],-B.min.y,-center[1]);geometry.scale(row.localScale,row.localScale,row.localScale);geometry.translate(0,row.localYShift,0);geometry.computeBoundingBox();geometry.computeBoundingSphere();const oldGeometry=mesh.geometry;mesh.geometry=geometry;
  return{source,mesh,geometry,oldGeometry,row};
 });
 return{...f,owners,records,restoreVisuals(){for(const o of owners){o.mesh.geometry=o.oldGeometry;o.geometry.dispose();}}};
}
