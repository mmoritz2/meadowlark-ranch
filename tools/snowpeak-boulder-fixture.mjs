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
