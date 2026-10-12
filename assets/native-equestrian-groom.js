/* Original closed draft-horse locks on exact native hair donor influences.
 * The original cards remain fine fringe; no source rig or UV is replaced. */
export const NATIVE_EQUESTRIAN_GROOM_VERSION='equestrian-locks-2';
const DRAFTS=new Set(['percheron','shire','clyde']);
export function nativeEquestrianGroomProfile(profile){return profile?.nativeRoster&&profile.nativeKind==='horse'&&DRAFTS.has(profile.nativeVariant?.id)?profile.nativeVariant?.groom?.equestrian:null;}
function cardMask(count,cards){
 if(!Array.isArray(cards)||!cards.length)throw Error('Missing equestrian groom cards');
 const mask=new Float32Array(count);
 for(const c of cards){if(!Number.isInteger(c.start)||!Number.isInteger(c.count)||c.start<0||c.count<1||c.start+c.count>count)throw Error('Invalid equestrian groom card');for(let i=c.start;i<c.start+c.count;i++){if(mask[i])throw Error('Overlapping equestrian groom cards');mask[i]=1;}}
 return mask;
}
export function prepareNativeEquestrianGroom({THREE,gltf,spec,binary}={}){
 const authored=nativeEquestrianGroomProfile(spec),shell=authored?.shell;if(!shell)return null;
 let hair,existing;gltf.scene.traverse(mesh=>{if(mesh.userData?.nativeEquestrianGroom)existing=mesh;if(mesh.isSkinnedMesh&&mesh.geometry.attributes.position.count===spec.hairVertexCount)hair=mesh;});
 if(existing)return existing;
 if(!hair||shell.version!==1||shell.space!=='native-source-mesh'||!Number.isInteger(shell.vertexCount)||shell.vertexCount<16||shell.vertexCount>2048||!Number.isInteger(shell.indexCount)||shell.indexCount<3||shell.indexCount>15000||shell.indexCount%3)throw Error('Invalid equestrian groom surface');
 const read=(name,Type,itemSize)=>{
  const info=shell[name],count=name==='index'?shell.indexCount:shell.vertexCount*itemSize;
  if(!info||info.count!==count||info.itemSize!==itemSize||!Number.isInteger(info.byteOffset)||info.byteOffset<0||info.byteOffset%4||info.byteOffset+count*Type.BYTES_PER_ELEMENT>binary.byteLength)throw Error('Invalid equestrian groom '+name);
  const data=new Type(binary,info.byteOffset,count);if(!data.every(Number.isFinite))throw Error('Nonfinite equestrian groom '+name);
  return new THREE.BufferAttribute(data.slice(),itemSize);
 };
 const geometry=new THREE.BufferGeometry();
 for(const [attribute,field,Type,size] of [['position','position',Float32Array,3],['normal','normal',Float32Array,3],['uv','uv',Float32Array,2],['skinIndex','skinIndex',Uint16Array,4],['skinWeight','skinWeight',Float32Array,4],['nativeTailDye','outer',Float32Array,1],['nativeEquestrianSourceVertex','sourceVertex',Uint16Array,1]])geometry.setAttribute(attribute,read(field,Type,size));
 geometry.setIndex(read('index',Uint16Array,1));
 if(geometry.index.array.some(i=>i>=shell.vertexCount)||geometry.attributes.skinIndex.array.some(i=>i>=677)||geometry.attributes.nativeTailDye.array.some(p=>p!==0&&p!==1))throw Error('Invalid equestrian groom index/part');
 const donorMask=cardMask(spec.hairVertexCount,authored.cards);
 if(geometry.attributes.nativeEquestrianSourceVertex.array.some(i=>!donorMask[i]))throw Error('Unapproved equestrian groom donor');
 const lashes=cardMask(spec.hairVertexCount,authored.eyelashCards);hair.geometry.setAttribute('nativeEquestrianLash',new THREE.BufferAttribute(lashes,1));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const base=Array.isArray(hair.material)?hair.material[0]:hair.material,material=base.clone();material.name='M_EquestrianGroom';material.map=null;material.alphaMap=null;material.alphaTest=0;material.alphaToCoverage=false;material.transparent=false;material.depthWrite=true;material.side=THREE.FrontSide;
 material.roughness=.53;material.metalness=0;material.specularIntensity=.52;material.envMapIntensity=.58;
 const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Native equestrian mane and tail locks';mesh.userData.nativeEquestrianGroom=true;
 mesh.position.copy(hair.position);mesh.quaternion.copy(hair.quaternion);mesh.scale.copy(hair.scale);mesh.bindMode=hair.bindMode;mesh.bind(hair.skeleton,hair.bindMatrix);mesh.normalizeSkinWeights();
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;hair.parent.add(mesh);return mesh;
}
export function applyNativeEquestrianGroom({THREE,rig}={}){
 const authored=nativeEquestrianGroomProfile(rig?.profile);if(!THREE||!authored||!rig?.scene)return null;
 const owned=new Set(rig.materials||[]);let hair,locks;
 rig.scene.traverse(mesh=>{if(mesh.userData?.nativeEquestrianGroom)locks=mesh;if(mesh.isSkinnedMesh&&mesh.geometry.attributes.position.count===rig.profile.hairVertexCount)hair=mesh;});
 if(!hair||!locks||!owned.has(locks.material))return null;
 for(const material of Array.isArray(hair.material)?hair.material:[hair.material]){
  if(!owned.has(material)||material.userData.equestrianLashes===NATIVE_EQUESTRIAN_GROOM_VERSION)continue;
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader){previous?.call(this,shader);shader.uniforms.eqLashColor={value:new THREE.Color('#30231c')};shader.vertexShader='attribute float nativeEquestrianLash;varying float eqLash;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\neqLash=nativeEquestrianLash;');shader.fragmentShader='uniform vec3 eqLashColor;varying float eqLash;\n'+shader.fragmentShader.replace('#include <map_fragment>','diffuseColor.rgb=mix(diffuseColor.rgb,eqLashColor,eqLash);\n#include <map_fragment>');};
  material.customProgramCacheKey=()=>key+'|'+NATIVE_EQUESTRIAN_GROOM_VERSION+'-lashes';material.userData.equestrianLashes=NATIVE_EQUESTRIAN_GROOM_VERSION;material.needsUpdate=true;
 }
 const material=locks.material;
 if(material.userData.equestrianLocks!==NATIVE_EQUESTRIAN_GROOM_VERSION){
  material.color.copy((Array.isArray(hair.material)?hair.material[0]:hair.material).color);
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader){previous?.call(this,shader);
   shader.vertexShader='varying vec2 eqLockUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\neqLockUv=uv;');
   shader.fragmentShader='varying vec2 eqLockUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float eqAcross=eqLockUv.x*70.;float eqPhase=eqAcross*6.283185+sin(eqLockUv.y*9.)*.3;
    float eqFilter=1.-smoothstep(.7,1.4,fwidth(eqAcross));
    float eqFiber=.87+.075*sin(eqPhase)*eqFilter;
    float eqBundle=.94+.05*sin(eqLockUv.x*5.*6.283185+sin(eqLockUv.y*3.)*.3);
    diffuseColor.rgb*=eqFiber*eqBundle*mix(.88,1.0,smoothstep(0.,.8,eqLockUv.y));`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 eqAxis=dFdx(vViewPosition)*dFdy(eqLockUv.y)-dFdy(vViewPosition)*dFdx(eqLockUv.y);
    float eqAxisLength=length(eqAxis);if(eqAxisLength>.000001)normal=normalize(normal+eqAxis/eqAxisLength*(cos(eqPhase)*.10*eqFilter));`);
  };material.customProgramCacheKey=()=>key+'|'+NATIVE_EQUESTRIAN_GROOM_VERSION;material.userData.equestrianLocks=NATIVE_EQUESTRIAN_GROOM_VERSION;material.needsUpdate=true;
 }
 return {version:NATIVE_EQUESTRIAN_GROOM_VERSION,vertices:locks.geometry.attributes.position.count,triangles:locks.geometry.index.count/3,maneLocks:authored.maneLocks,forelockLocks:authored.forelockLocks,tailLocks:authored.tailLocks};
}
