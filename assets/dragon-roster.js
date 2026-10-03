/* Dragon identities stay in the save; only their rendered body changes. Both
 * creator rigs retain their skin weights, texture detail, clips and credits. */
export const DRAGON_VARIANTS=Object.freeze({
 frostdrake:  {name:'Frostwing Dragon', model:'european-dragon',theme:'ice',body:'#9fc8d7',accent:'#e5f3f3'},
 emberdrake:  {name:'Emberflight Dragon',model:'european-dragon',theme:'fire',body:'#8b3021',accent:'#ed974d'},
 amethyst:    {name:'Amethyst Dragon',model:'european-dragon',theme:'galaxy',body:'#69508f',accent:'#c8a7dd'},
 stormdrake:  {name:'Storm Dragon',model:'black-dragon-native',theme:'shadow',body:'#343142',accent:'#8b7bac'},
 verdant:     {name:'Verdant Dragon',model:'european-dragon',theme:'aurora',body:'#276e61',accent:'#94b99b'},
 glimmerdrake:{name:'Glimmerflight Dragon',model:'european-dragon',theme:'glimmer',body:'#987438',accent:'#e5cb82'},
 thorndrake:  {name:'Thornflight Dragon',model:'european-dragon',theme:'thorn',body:'#446335',accent:'#9daa61'},
 tidedrake:   {name:'Tideflight Dragon',model:'european-dragon',theme:'tide',body:'#276982',accent:'#8fcbd2'},
 gloomdrake:  {name:'Gloomflight Dragon',model:'black-dragon-native',theme:'gloom',body:'#38283f',accent:'#957ab0'},
 ancientdrake:{name:'Elder Dragon',model:'black-dragon-native',scale:1.14,theme:'eclipse',body:'#2d2829',accent:'#b97645'},
 blossomdrake:{name:'Blossom Dragon',model:'european-dragon',theme:'petal',body:'#914c65',accent:'#e0b2bc'},
 heliosdrake: {name:'Helios Dragon',model:'european-dragon',theme:'solar',body:'#a05c2a',accent:'#f2cd83'},
 polarisdrake:{name:'Polaris Dragon',model:'black-dragon-native',theme:'moonlit',body:'#344e70',accent:'#c0d8eb'}
});
export const DRAGON_ELEMENTS={fire:'fire',ice:'ice',aurora:'water',galaxy:'arcane',shadow:'shadow',tide:'water',thorn:'water',glimmer:'fire',gloom:'shadow',moonlit:'arcane',petal:'water',solar:'fire'};
export function dragonBreathElement(h,profile){
 return h&&(h.dragon||profile?.nativeDragon)?(DRAGON_ELEMENTS[h.coat||profile?.dragonVariant?.theme]||'fire'):null;
}
export function dragonProfile(sources,key,row){
 const variant=DRAGON_VARIANTS[key]||(row?.[7]?.dragon?{name:row[1],model:'european-dragon',theme:row[7].coat,body:row[5],accent:row[6]}:null);
 if(!variant)return null;
 const source=sources[variant.model];
 return {...source,id:key,name:row?.[1]||variant.name,label:row?.[1]||variant.name,family:'dragon',
  fitScale:variant.scale||(source.nativeKind==='european-dragon'?1.65:1),
  nativeDragon:true,nativeDarkAppearance:false,dragonVariant:{...variant},dragonBaseModel:variant.model,
  dragonDefaultColors:row?{body:row[5],mane:row[6]}:null,
  coat:variant.theme,description:'Detailed dragon with articulated wings, walk, run, takeoff, hovering flight, landing and elemental breath.'};
}
export function dragonProfiles(sources){return Object.fromEntries(Object.keys(DRAGON_VARIANTS).map(key=>[key,dragonProfile(sources,key)]));}

export function configureDragonAppearance(THREE,rig,horse,defaults){
 const variant=rig.profile?.dragonVariant;if(!variant)return;
 const base=rig.profile.dragonDefaultColors||{body:defaults?.[5],mane:defaults?.[6]};
 const custom=(value,original)=>value&&original&&new THREE.Color(value).getHex()!==new THREE.Color(original).getHex();
 const body=custom(horse?.colors?.body,base.body)?horse.colors.body:variant.body;
 const accent=custom(horse?.colors?.mane,base.mane)?horse.colors.mane:variant.accent;
 for(const material of rig.materials||[]){
  const palette=material.userData.dragonPalette;if(palette){palette.body.value.set(body);palette.accent.value.set(accent);continue;}
  // Keep teeth and eyes in the creator's materials. The skin and membrane retain
  // their original albedo variation, normals, roughness maps and UVs.
  if(!['Low_Poly_Bake','Game_dragon','Game_dragon.001'].includes(material.name))continue;
  const uniforms={body:{value:new THREE.Color(body)},accent:{value:new THREE.Color(accent)},membrane:{value:material.name==='Game_dragon'?.72:0}};
  material.userData.dragonPalette=uniforms;material.color.set(0xffffff);
  material.opacity=1;material.transparent=false;material.depthWrite=true;
  material.metalness=Math.min(material.metalness,.08);material.roughness=Math.max(material.roughness,.62);
  if('transmission'in material)material.transmission=0;
  material.onBeforeCompile=shader=>{
   shader.uniforms.uDragonBody=uniforms.body;shader.uniforms.uDragonAccent=uniforms.accent;shader.uniforms.uDragonMembrane=uniforms.membrane;
   shader.fragmentShader='uniform vec3 uDragonBody;uniform vec3 uDragonAccent;uniform float uDragonMembrane;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float dragonLum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    float dragonShade=clamp(pow(max(.001,dragonLum),.55)*1.6,.18,1.3);
    float dragonAccent=max(uDragonMembrane,smoothstep(.25,.8,dragonLum)*.40);
    diffuseColor.rgb=mix(uDragonBody,uDragonAccent,dragonAccent)*dragonShade;`);
  };
  material.customProgramCacheKey=()=> 'native-dragon-palette-v1';material.needsUpdate=true;
 }
}

export function attachDragonBreath(THREE,rig){
 if(!rig.profile?.nativeDragon)return null;
 const name=THREE.PropertyBinding.sanitizeNodeName(rig.profile.nativeHeadBone);
 const bone=rig.nativeRoot.getObjectByName(name);if(!bone)throw Error('Dragon head anchor missing: '+rig.key);
 // Source-space points measured between the lips of each original bind pose.
 // Store in head-local space once, so all native clips carry the emitter along.
 const source=rig.profile.nativeKind==='black-dragon'?[0,4.416,3.556]:[0,.672,.232];
 rig.scene.updateWorldMatrix(true,true);
 const origin=rig.nativeRoot.localToWorld(new THREE.Vector3(...source));
 const forward=new THREE.Vector3(0,-.06,1).transformDirection(rig.nativeRoot.matrixWorld);
 const tip=bone.worldToLocal(origin.clone().add(forward));bone.worldToLocal(origin);
 return {bone,origin,direction:tip.sub(origin).normalize()};
}
export function dragonBreathPose(rig,origin,direction){
 const anchor=rig?.nativeBreath;if(!anchor)return false;
 anchor.bone.updateWorldMatrix(true,false);
 origin.copy(anchor.origin).applyMatrix4(anchor.bone.matrixWorld);
 direction.copy(anchor.direction).transformDirection(anchor.bone.matrixWorld);
 return true;
}
