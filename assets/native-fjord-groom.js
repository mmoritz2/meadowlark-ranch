/* Two-tone Fjord crest on original, skinned hair cards. The immutable card mask
 * follows the authored trim; it never recolors eyes, eyelashes, tail or tack. */
const VERSION='fjord-native-card-color-1';
export const FJORD_GROOM_COLORS=Object.freeze({center:'#342b20',outer:'#e5d4a0'});

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

export function applyNativeFjordGroom({THREE,rig}={}){
 const profile=rig?.profile,cards=profile?.nativeVariant?.groom?.uprightCrest?.colorCards;
 if(!THREE||!profile?.nativeRoster||profile.nativeKind!=='horse'||profile.nativeVariant?.id!=='fjord'||rig.nativeFantasy||!rig.scene)return null;
 const mask=fjordCardColorMask(profile.hairVertexCount,cards);if(!mask)return null;
 const owned=new Set(rig.materials||[]),seen=new Set();let count=0;
 rig.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.geometry.attributes.position.count!==profile.hairVertexCount)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(materials.some(m=>!owned.has(m)||m.name!=='M_Hair'))return;
  // Every native roster geometry is already private to its prepared variant;
  // sharing this immutable scalar mask among its actors avoids geometry copies.
  if(mesh.geometry.userData.nativeFjordGroom!==VERSION){
   mesh.geometry.setAttribute('nativeFjordCard',new THREE.BufferAttribute(mask,1));
   mesh.geometry.userData.nativeFjordGroom=VERSION;
  }
  for(const material of materials){
   if(seen.has(material))continue;seen.add(material);count++;
   if(material.userData.nativeFjordGroom===VERSION)continue;
   const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
   const colors={fjCenter:{value:new THREE.Color(FJORD_GROOM_COLORS.center)},fjOuter:{value:new THREE.Color(FJORD_GROOM_COLORS.outer)}};
   material.onBeforeCompile=function(shader){
    previous?.call(this,shader);Object.assign(shader.uniforms,colors);
    // Saved dyes clone this material and call its prior hook with the clone as
    // `this`. Reuse the live override uniform so choosing/restoring a mane color
    // immediately takes precedence without patching the customization system.
    shader.uniforms.fjManeOverride=this.userData.nativeRosterHair?.nrManeOn||{value:0};
    shader.vertexShader='attribute float nativeFjordCard;varying float fjCard;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfjCard=nativeFjordCard;');
    shader.fragmentShader='uniform vec3 fjCenter,fjOuter;uniform float fjManeOverride;varying float fjCard;\n'+shader.fragmentShader.replace('#include <map_fragment>',`if(fjCard>.5&&fjManeOverride<.5){diffuseColor.rgb=mix(fjCenter,fjOuter,clamp(fjCard-1.,0.,1.));}
     #include <map_fragment>` );
    // Applied before map_fragment: original strand detail and alpha are intact,
    // and the existing saved-color shader still runs after the texture sample.
   };
   material.customProgramCacheKey=()=>previousKey+'|'+VERSION;
   material.userData.nativeFjordGroom=VERSION;material.needsUpdate=true;
  }
 });
 return count?{version:VERSION,materials:count,cards:cards.length}:null;
}
