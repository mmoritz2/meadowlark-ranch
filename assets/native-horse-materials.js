/* Surface finish for the approved native equines. Run on private actor materials,
 * before fantasy artwork or saved dyes are applied. Source textures, UVs, rig,
 * original position/normal/UV/skin arrays and tack materials remain unchanged.
 * A cached rest-position appearance attribute anchors short coat fibers. */
export const NATIVE_HORSE_MATERIAL_VERSION='native-surface-7';
export const NATIVE_HORSE_MATERIAL_FINISH=Object.freeze({
 body:Object.freeze({roughness:.60,specularIntensity:.55,envMapIntensity:.70,metalness:0,sheen:.08,sheenRoughness:.86,sheenColor:'#f0e7d8'}),
 hair:Object.freeze({roughness:.58,specularIntensity:.52,envMapIntensity:.62,metalness:0,alphaCutoff:.18,darkLift:.40}),
 eye:Object.freeze({roughness:.12,specularIntensity:.55,envMapIntensity:.18,metalness:0,clearcoat:.25,clearcoatRoughness:.065,color:'#a57545'}),
});
// A shared neutral atlas separates painted anatomy from coat pigment. Lift its
// middle shadows, not near-black nostrils/hooves, and compress the deepest coat
// contrast. Source atlas pixels stay unchanged. Draft legs also use one cached
// appearance scalar; neither treatment needs per-frame CPU work or a new texture.
export const NATIVE_COAT_SHADING=Object.freeze({exponent:.72,maxGain:1.55,skinStart:.018,skinEnd:.085});
// Area-weighted pivots measured from the unchanged neutral atlas on the three
// draft leg skins. Compress around their mean, instead of simply brightening a
// groove. Max delta is in linear light; pigment is still applied afterward.
export const NATIVE_LEG_COAT_SHADING=Object.freeze({strength:.42,maxDelta:.055,foreMean:.2722,hindMean:.3831});
export const NATIVE_COAT_REALISM=Object.freeze({tonePivot:.46,toneStrength:.24,maxToneDelta:.07,fiberHeightM:.000025,roughnessVariation:.10});
const draftLegCoatMasks=new WeakMap(),coatRestPositions=new WeakMap();
function prepareCoatRestPosition(THREE,rig,mesh){
 const geometry=mesh.geometry,a=geometry?.attributes;
 if(!mesh.isSkinnedMesh||mesh!==rig.skin||a?.position?.count!==16159||!a.skinIndex||!a.skinWeight||mesh.skeleton?.bones.length!==677)return null;
 if(coatRestPositions.has(geometry))return coatRestPositions.get(geometry);
 // The first private instance still has the prepared source rest pose. Share
 // only immutable appearance data, never the actor's animated state.
 rig.scene.updateWorldMatrix(true,false);rig.scene.updateMatrixWorld(true);mesh.skeleton.update();
 const toRest=new THREE.Matrix4().copy(rig.scene.matrixWorld).invert().multiply(mesh.matrixWorld),point=new THREE.Vector3(),values=new Float32Array(a.position.count*3);
 for(let i=0;i<a.position.count;i++){
  mesh.getVertexPosition(i,point).applyMatrix4(toRest);
  if(!Number.isFinite(point.x+point.y+point.z))return null;
  point.toArray(values,i*3);
 }
 const attribute=new THREE.BufferAttribute(values,3);geometry.setAttribute('nativeCoatRest',attribute);
 const report={vertices:a.position.count,attribute};coatRestPositions.set(geometry,report);return report;
}
function layerNativeCoatFibers(material,rest){
 if(!rest)return false;
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader){
  previous?.call(this,shader);
  shader.vertexShader='attribute vec3 nativeCoatRest;varying vec3 ncCoatRest;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nncCoatRest=nativeCoatRest;');
  shader.fragmentShader=`varying vec3 ncCoatRest;
float ncFiberHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ncFiberNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(ncFiberHash(i),ncFiberHash(i+vec2(1,0)),f.x),mix(ncFiberHash(i+vec2(0,1)),ncFiberHash(i+vec2(1,1)),f.x),f.y);}
`+shader.fragmentShader
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 // Short, directionally laid hair follows rest anatomy while the horse moves.
 // Derivative filtering removes subpixel grain instead of sparkling at distance.
 float ncLegLay=1.0-smoothstep(.62,1.03,ncCoatRest.y);
 vec2 ncFiberUV=mix(vec2(ncCoatRest.y*610.0+ncCoatRest.x*120.0,ncCoatRest.z*82.0),vec2(ncCoatRest.x*540.0+ncCoatRest.z*320.0,ncCoatRest.y*88.0),ncLegLay);
 float ncFiberFilter=1.0-smoothstep(.35,1.35,max(length(dFdx(ncFiberUV)),length(dFdy(ncFiberUV))));
 float ncFiber=ncFiberNoise(ncFiberUV)*.75+ncFiberNoise(ncFiberUV*vec2(.47,.61)+17.0)*.25;
 float ncFur=smoothstep(.13,.24,ncCoatRest.y);
 roughnessFactor=clamp(roughnessFactor+(ncFiber-.5)*${NATIVE_COAT_REALISM.roughnessVariation.toFixed(4)}*ncFiberFilter*ncFur,.46,.82);`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 // Micrometre-scale fiber relief changes only shading, never anatomy/normals
 // stored in the mesh. No procedural grooves or displaced silhouette.
 float ncHeight=(ncFiber-.5)*${NATIVE_COAT_REALISM.fiberHeightM.toFixed(8)}*ncFiberFilter*ncFur;
 vec3 ncDx=dFdx(-vViewPosition),ncDy=dFdy(-vViewPosition);
 vec3 ncR1=cross(ncDy,normal),ncR2=cross(normal,ncDx);
 float ncDet=dot(ncDx,ncR1);
 vec3 ncGrad=sign(ncDet)*(dFdx(ncHeight)*ncR1+dFdy(ncHeight)*ncR2);
 if(abs(ncDet)>1e-12)normal=normalize(abs(ncDet)*normal-ncGrad);`);
 };
 material.customProgramCacheKey=()=>previousKey+'|native-short-coat-1';return true;
}
const c2=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(6*t-15)+10);};
function draftLegCoatMask(THREE,rig,mesh){
 if(!rig.profile.nativeRoster||!['percheron','shire','clyde'].includes(rig.profile.nativeVariant?.id)||mesh!==rig.skin)return null;
 const geometry=mesh.geometry,attrs=geometry?.attributes,bones=mesh.skeleton?.bones;
 if(attrs?.position?.count!==16159||attrs.skinIndex?.itemSize!==4||attrs.skinWeight?.itemSize!==4||bones?.length!==677)return null;
 if(draftLegCoatMasks.has(geometry))return draftLegCoatMasks.get(geometry);
 // Cached prepared geometry is shared by instances. Add only this appearance
 // scalar once, before the first animation; positions/normals/UV/skin stay exact.
 const roles=bones.map(b=>/^(fingers_|hand_|wrist_|elbow_|lowerarm_|upperarm_)/.test(b.name)?1:/^(toes_|foot_|ankle_|knee_|lowerleg_|upperleg_)/.test(b.name)?-1:0);
 if(!roles.includes(1)||!roles.includes(-1))return null;
 rig.scene.updateWorldMatrix(true,false);rig.scene.updateMatrixWorld(true);mesh.skeleton.update();
 const toSource=new THREE.Matrix4().copy(rig.scene.matrixWorld).invert().multiply(mesh.matrixWorld),point=new THREE.Vector3(),values=new Float32Array(attrs.position.count);
 let foreVertices=0,hindVertices=0;
 for(let i=0;i<values.length;i++){
  let fore=0,hind=0;
  for(let j=0;j<4;j++){const role=roles[attrs.skinIndex.getComponent(i,j)],weight=attrs.skinWeight.getComponent(i,j);if(role===1)fore+=weight;else if(role===-1)hind+=weight;}
  if(fore<=.10&&hind<=.10)continue;
  mesh.getVertexPosition(i,point).applyMatrix4(toSource);
  const low=c2(.30,.43,point.y),f=c2(.10,.72,fore)*low*(1-c2(.98,1.18,point.y)),h=c2(.10,.72,hind)*low*(1-c2(1.08,1.35,point.y));
  values[i]=f>=h?f:-h;if(f>.01)foreVertices++;if(h>.01)hindVertices++;
 }
 geometry.setAttribute('nativeLegCoat',new THREE.BufferAttribute(values,1));
 const report={version:1,foreVertices,hindVertices,vertices:foreVertices+hindVertices};draftLegCoatMasks.set(geometry,report);return report;
}
function softenNativeCoat(material,neutral,legMask){
 if(!neutral?.isTexture)return false;
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 const {exponent,maxGain,skinStart,skinEnd}=NATIVE_COAT_SHADING;
 material.onBeforeCompile=function(shader){
  previous?.call(this,shader);
  shader.uniforms.nativeCoatNeutral={value:neutral};
  if(legMask){
   shader.vertexShader='attribute float nativeLegCoat;varying float ncLegMask;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nncLegMask=nativeLegCoat;');
   shader.fragmentShader='varying float ncLegMask;\n'+shader.fragmentShader;
  }
  shader.fragmentShader='uniform sampler2D nativeCoatNeutral;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
#ifdef USE_MAP
 // Apply before map sampling and before saved color/markings. Their existing
 // factory can keep its map-fragment seam and paint white markings afterward.
 float ncL=clamp(dot(texture2D(nativeCoatNeutral,vMapUv).rgb,vec3(.2126,.7152,.0722)),0.0,1.0);
 float ncGain=min(${maxGain.toFixed(4)},pow(max(ncL,.0001),${exponent.toFixed(4)})/max(ncL,.0001));
 float ncSkin=smoothstep(${skinStart.toFixed(4)},${skinEnd.toFixed(4)},ncL);
 float ncSoft=ncL*mix(1.0,ncGain,ncSkin);
 // Compress both painted highlights and dark grooves around a measured middle
 // reflectance. Black skin/hooves remain protected; authored pigment and saved
 // white markings still run afterward. The reviewed draft-leg treatment stays
 // intact at full leg influence instead of stacking two contrast corrections.
 float ncTone=clamp((${NATIVE_COAT_REALISM.tonePivot.toFixed(4)}-ncSoft)*${NATIVE_COAT_REALISM.toneStrength.toFixed(4)},-${NATIVE_COAT_REALISM.maxToneDelta.toFixed(4)},${NATIVE_COAT_REALISM.maxToneDelta.toFixed(4)});
 ncSoft+=ncTone*ncSkin*${legMask?'(1.0-abs(ncLegMask))':'1.0'};
 ${legMask?`// Signed original leg skin ownership: positive fore, negative hind.
 float ncPivot=mix(${NATIVE_LEG_COAT_SHADING.hindMean.toFixed(4)},${NATIVE_LEG_COAT_SHADING.foreMean.toFixed(4)},step(0.0,ncLegMask));
 float ncDelta=clamp((ncPivot-ncSoft)*${NATIVE_LEG_COAT_SHADING.strength.toFixed(4)},-${NATIVE_LEG_COAT_SHADING.maxDelta.toFixed(4)},${NATIVE_LEG_COAT_SHADING.maxDelta.toFixed(4)});
 ncSoft+=ncDelta*abs(ncLegMask)*ncSkin;`:''}
 diffuseColor.rgb*=ncL>.0001?ncSoft/ncL:1.0;
#endif
#include <map_fragment>`);
 };
 material.customProgramCacheKey=()=>previousKey+'|native-coat-satin-4'+(legMask?'|native-leg-coat-1':'');
 return true;
}
function finishNativeEye(material){
 if(!material.map)return;
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader){
  previous?.call(this,shader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 // The source atlas depicts a silver-blue iris. Use its fibers/pupil as
 // luminance, with restrained brown reflectance instead of a metallic ring.
 float neIrisL=clamp(dot(diffuseColor.rgb/max(diffuse,vec3(.0001)),vec3(.2126,.7152,.0722)),0.0,1.0);
 diffuseColor.rgb=diffuse*neIrisL*(.48+.16*neIrisL);`)
 .replace('#include <opaque_fragment>',`
 // A small soft reflection supplements the physical tear film. Its strength
 // follows the actual shaded eye, so it cannot become an unlit white dot in
 // shadow/night. Preserve the authored iris fibers and horizontal pupil.
 vec3 neView=normalize(vViewPosition);
 vec3 neHalf=normalize(neView+normalize(vec3(-.45,.65,1.0)));
 float neCatch=pow(max(0.0,dot(normal,neHalf)),80.0);
 neCatch*=smoothstep(.12,.6,dot(normal,neView));
 float neLit=clamp(dot(max(outgoingLight,vec3(0.0)),vec3(.2126,.7152,.0722)),0.0,1.0);
 outgoingLight+=vec3(1.0,.97,.90)*neCatch*min(.22,neLit*.36);
#include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>previousKey+'|native-eye-corneal-7';
}
export function nativeHorseMaterialRole(material){
 return material?.name==='M_Body'?'body':material?.name==='M_Hair'?'hair':material?.name==='M_Eye'?'eye':null;
}
export function applyNativeHorseMaterials({THREE,rig,enabled=true}={}){
 if(!enabled||!THREE||!rig?.profile?.nativeBreed||rig.profile.nativeKind!=='horse'||rig.profile.nativeDragon||!rig.scene)return null;
 // The asset cache and every other horse share source maps and geometry, but
 // must never share a mutable material treatment.
 const owned=new Set(rig.materials||[]),seen=new Set(),counts={body:0,hair:0,eye:0,softCoat:0,legCoatVertices:0,coatFiberVertices:0};
 rig.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(!owned.has(material)||seen.has(material))continue;seen.add(material);
   const role=nativeHorseMaterialRole(material);if(!role||!material.isMeshPhysicalMaterial)continue;
   counts[role]++;if(material.userData.nativeHorseSurfaceVersion===NATIVE_HORSE_MATERIAL_VERSION)continue;
   const finish=NATIVE_HORSE_MATERIAL_FINISH[role];
   material.roughness=finish.roughness;material.specularIntensity=finish.specularIntensity;
   material.envMapIntensity=finish.envMapIntensity;material.metalness=finish.metalness;
   if(role==='body'){
    material.sheen=finish.sheen;material.sheenRoughness=finish.sheenRoughness;material.sheenColor.set(finish.sheenColor);
    // Roster and saved aliases (including Belgian) already share the neutral
    // atlas. Raw colored originals retain pigment and receive the PBR finish.
    const legMask=rig.nativeNeutralCoat?draftLegCoatMask(THREE,rig,mesh):null;
    if(legMask)counts.legCoatVertices=legMask.vertices;
    if(softenNativeCoat(material,rig.nativeNeutralCoat,legMask))counts.softCoat++;
    const rest=prepareCoatRestPosition(THREE,rig,mesh);
    if(layerNativeCoatFibers(material,rest))counts.coatFiberVertices+=rest.vertices;
   }else if(role==='hair'){
    // Lift only naturally dark source pigment, without flattening the hair map.
    // Saved mane/tail dyes run later and keep their exact selected colors.
    const luminance=material.color.r*.2126+material.color.g*.7152+material.color.b*.0722;
    material.color.multiplyScalar(1+finish.darkLift*(1-Math.min(1,Math.max(0,luminance)/.25)));
    if(material.alphaTest>0){material.alphaTest=Math.min(material.alphaTest,finish.alphaCutoff);material.alphaToCoverage=true;}
   }else if(role==='eye'){
    // The shared eye atlas is a pale silver iris, not a white sclera. A warm
    // dark tint preserves its radial fibers and horizontal pupil; the small
    // ring remains brown while a tiny corneal glint and the physical tear film
    // provide readable highlights, without replacing the source pupil.
    material.color.set(finish.color);material.clearcoat=finish.clearcoat;material.clearcoatRoughness=finish.clearcoatRoughness;
    finishNativeEye(material);
   }
   // Surface properties survive clone(). The coat hook chains prior artwork
   // and is itself chained by saved-color/marking customization.
   material.userData.nativeHorseSurfaceVersion=NATIVE_HORSE_MATERIAL_VERSION;material.needsUpdate=true;
  }
 });
 const summary={version:NATIVE_HORSE_MATERIAL_VERSION,...counts};rig.nativeMaterialPolish=summary;return summary;
}
