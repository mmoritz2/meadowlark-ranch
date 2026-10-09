/* A small, continuously skinned Fjord crest. Original cards supply fine fringe,
 * while one rounded surface gives pale sides and an unbroken dark center. */
const VERSION='fjord-brushed-crest-4';
export const FJORD_GROOM_COLORS=Object.freeze({center:'#342b20',outer:'#d6c69c'});

export function fjordCardColorMask(vertexCount,cards){
 if(!Number.isInteger(vertexCount)||vertexCount<1||!Array.isArray(cards)||!cards.length)return null;
 const mask=new Float32Array(vertexCount);
 for(const card of cards){
  const {start,count,outer}=card||{};
  if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<1||start+count>vertexCount||!Number.isFinite(outer)||outer<0||outer>1)return null;
  for(let i=start;i<start+count;i++){if(mask[i])return null;mask[i]=1+outer;}
 }
 return mask;
}

/** Read the compact added surface on the original, unchanged hair skeleton. */
export function prepareNativeFjordCrest({THREE,gltf,spec,binary}={}){
 const shell=spec?.nativeVariant?.groom?.uprightCrest?.shell;
 if(spec?.nativeVariant?.id!=='fjord'||!shell)return null;
 let hair,existing;gltf.scene.traverse(mesh=>{if(mesh.userData?.nativeFjordCrest)existing=mesh;if(mesh.isSkinnedMesh&&mesh.geometry.attributes.position.count===spec.hairVertexCount)hair=mesh;});
 if(existing)return existing;
 if(!hair||!Number.isInteger(shell.vertexCount)||shell.vertexCount<4||shell.vertexCount>2048||shell.indexCount>12000)throw Error('Invalid native Fjord crest');
 const read=(name,Type,itemSize)=>{
  const info=shell[name],count=name==='index'?shell.indexCount:shell.vertexCount*itemSize;
  if(!info||info.count!==count||info.itemSize!==itemSize||!Number.isInteger(info.byteOffset)||info.byteOffset<0||info.byteOffset%4||info.byteOffset+count*Type.BYTES_PER_ELEMENT>binary.byteLength)throw Error('Invalid native Fjord crest '+name);
  const values=new Type(binary,info.byteOffset,count);
  if(!values.every(Number.isFinite))throw Error('Non-finite native Fjord crest '+name);
  // Geometry owns its arrays; skin normalization must not mutate the cached
  // variant binary shared with later actors or fantasy aliases.
  return new THREE.BufferAttribute(values.slice(),itemSize);
 };
 const geometry=new THREE.BufferGeometry();
 for(const [attribute,field,Type,size] of [['position','position',Float32Array,3],['normal','normal',Float32Array,3],['uv','uv',Float32Array,2],['skinIndex','skinIndex',Uint16Array,4],['skinWeight','skinWeight',Float32Array,4],['nativeFjordOuter','outer',Float32Array,1],['nativeFjordSourceVertex','sourceVertex',Uint16Array,1]])geometry.setAttribute(attribute,read(field,Type,size));
 geometry.setIndex(read('index',Uint16Array,1));
 if(geometry.index.array.some(i=>i>=shell.vertexCount)||geometry.attributes.skinIndex.array.some(i=>i>=hair.skeleton.bones.length))throw Error('Native Fjord crest index out of bounds');
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const original=Array.isArray(hair.material)?hair.material[0]:hair.material,material=original.clone();
 material.name='M_FjordCrest';material.map=null;material.alphaMap=null;material.alphaTest=0;material.alphaToCoverage=false;material.transparent=false;material.depthWrite=true;
 material.color.set(0xffffff);material.roughness=.83;material.metalness=0;material.specularIntensity=.32;material.envMapIntensity=.42;material.side=THREE.FrontSide;
 const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Native Fjord continuous crest';mesh.userData.nativeFjordCrest=true;
 mesh.position.copy(hair.position);mesh.quaternion.copy(hair.quaternion);mesh.scale.copy(hair.scale);mesh.bindMode=hair.bindMode;mesh.bind(hair.skeleton,hair.bindMatrix);
 // GLTFLoader normalizes every source skin after decoding. Match that exact
 // step so donor weights remain bit-for-bit equal to the loaded native hair.
 mesh.normalizeSkinWeights();
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;hair.parent.add(mesh);return mesh;
}

export function applyNativeFjordGroom({THREE,rig}={}){
 const profile=rig?.profile,cards=profile?.nativeVariant?.groom?.uprightCrest?.colorCards;
 if(!THREE||!profile?.nativeRoster||profile.nativeKind!=='horse'||profile.nativeVariant?.id!=='fjord'||!rig.scene)return null;
 const mask=fjordCardColorMask(profile.hairVertexCount,cards);if(!mask)return null;
 const owned=new Set(rig.materials||[]),seen=new Set();let count=0,hairMesh,crestMesh;
 rig.scene.traverse(mesh=>{
  if(mesh.userData?.nativeFjordCrest)crestMesh=mesh;
  if(!mesh.isSkinnedMesh||mesh.geometry.attributes.position.count!==profile.hairVertexCount)return;
  hairMesh=mesh;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(rig.nativeFantasy||materials.some(m=>!owned.has(m)||m.name!=='M_Hair'))return;
  if(mesh.geometry.userData.nativeFjordGroom!==VERSION){mesh.geometry.setAttribute('nativeFjordCard',new THREE.BufferAttribute(mask,1));mesh.geometry.userData.nativeFjordGroom=VERSION;}
  for(const material of materials){
   if(seen.has(material))continue;seen.add(material);count++;
   if(material.userData.nativeFjordGroom===VERSION)continue;
   const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
   const colors={fjCenter:{value:new THREE.Color(FJORD_GROOM_COLORS.center)},fjOuter:{value:new THREE.Color(FJORD_GROOM_COLORS.outer)}};
   material.onBeforeCompile=function(shader){
    previous?.call(this,shader);Object.assign(shader.uniforms,colors);
    shader.uniforms.fjManeOverride=this.userData.nativeRosterHair?.nrManeOn||{value:0};
    shader.vertexShader='attribute float nativeFjordCard;varying float fjCard;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfjCard=nativeFjordCard;');
    shader.fragmentShader='uniform vec3 fjCenter,fjOuter;uniform float fjManeOverride;varying float fjCard;\n'+shader.fragmentShader.replace('#include <map_fragment>',`if(fjCard>.5&&fjManeOverride<.5){diffuseColor.rgb=mix(fjCenter,fjOuter,clamp(fjCard-1.,0.,1.));}\n#include <map_fragment>`);
   };
   material.customProgramCacheKey=()=>previousKey+'|'+VERSION;material.userData.nativeFjordGroom=VERSION;material.needsUpdate=true;
  }
 });
 if(crestMesh&&hairMesh&&owned.has(crestMesh.material)){
  const material=crestMesh.material;
  if(material.userData.nativeFjordGroom!==VERSION){
   const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
   const state={fjCrestCenter:{value:new THREE.Color(FJORD_GROOM_COLORS.center)},fjCrestOuter:{value:new THREE.Color(FJORD_GROOM_COLORS.outer)},fjCrestDye:{value:new THREE.Color()},fjCrestNatural:{value:1}};
   const sync=()=>{
    const hair=Array.isArray(hairMesh.material)?hairMesh.material[0]:hairMesh.material,custom=hair.userData.nativeRosterHair;
    const dyed=!!custom?.nrManeOn?.value;state.fjCrestNatural.value=dyed||rig.nativeFantasy?0:1;
    state.fjCrestDye.value.copy(dyed?custom.nrMane.value:hair.color);
   };
   material.onBeforeCompile=function(shader){
    previous?.call(this,shader);Object.assign(shader.uniforms,state);
    shader.vertexShader='attribute float nativeFjordOuter;varying float fjCrestBlend;varying vec2 fjCrestUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfjCrestBlend=nativeFjordOuter;fjCrestUv=uv;');
    shader.fragmentShader='uniform vec3 fjCrestCenter,fjCrestOuter,fjCrestDye;uniform float fjCrestNatural;varying float fjCrestBlend;varying vec2 fjCrestUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     vec3 fjCoat=mix(fjCrestDye,mix(fjCrestCenter,fjCrestOuter,clamp(fjCrestBlend,0.,1.)),fjCrestNatural);
     float fjAcross=fjCrestUv.y*225.;
     float fjPhase=fjAcross*6.283185+sin(fjCrestUv.x*12.56637)*.45;
     float fjFilter=1.-smoothstep(.65,1.35,fwidth(fjAcross));
     float fjFiber=.77+.15*(.5+.5*sin(fjPhase))+.08*fract(sin(floor(fjAcross)*91.317)*43758.5453);
     float fjLockAcross=fjCrestUv.y*45.;
     float fjLockPhase=fjLockAcross*6.283185+sin(fjCrestUv.x*6.283185)*.45;
     float fjLockFilter=1.-smoothstep(.7,1.4,fwidth(fjLockAcross));
     float fjLocks=.5+.3*sin(fjLockPhase)+.2*sin(fjCrestUv.y*53.*6.283185+sin(fjCrestUv.x*12.56637)*.3);
     float fjBundleShade=mix(1.,.91+.12*fjLocks,fjLockFilter);
     diffuseColor.rgb=fjCoat*mix(.88,fjFiber,fjFilter)*fjBundleShade;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec3 fjFiberAxis=dFdx(vViewPosition)*dFdy(fjCrestUv.x)-dFdy(vViewPosition)*dFdx(fjCrestUv.x);
     float fjAxisLength=length(fjFiberAxis);
     if(fjAxisLength>.000001){normal=normalize(normal+(fjFiberAxis/fjAxisLength)*(cos(fjPhase)*.16*fjFilter+cos(fjLockPhase)*.055*fjLockFilter));}`);
   };
   material.customProgramCacheKey=()=>previousKey+'|'+VERSION+'-shell';material.userData.nativeFjordGroom=VERSION;material.userData.nativeFjordCrestUniforms=state;material.needsUpdate=true;
   const previousRender=crestMesh.onBeforeRender;crestMesh.onBeforeRender=function(...args){sync();previousRender?.apply(this,args);};sync();
  }
 }
 return count||crestMesh?{version:VERSION,materials:count,cards:cards.length,crestVertices:crestMesh?.geometry.attributes.position.count||0}:null;
}
