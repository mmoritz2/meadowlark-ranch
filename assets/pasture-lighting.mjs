// Original thin-leaf lighting. Keep the physical surface normal while allowing
// weaker light through the back of each blade and scattering along its edge.
// Incident radiance is already shadowed by Three; no glow or unlit color floor.
export const PASTURE_LIGHT_VISIBILITY = Object.freeze({skyExtinction:.32,sunExtinction:0,base:0,exposed:.38,front:.85,back:.32,edge:.13});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function pastureLightVisibility(height){
 if(!Number.isFinite(height))throw new TypeError('Finite leaf height required');
 const q=PASTURE_LIGHT_VISIBILITY,t=clamp((height-q.base)/(q.exposed-q.base),0,1),depth=1-t*t*(3-2*t);
 return {sky:Math.exp(-q.skyExtinction*depth),sun:1};
}
export function pastureDiffuseResponse(normalDotLight){
 if(!Number.isFinite(normalDotLight))throw new TypeError('Finite incidence required');
 const n=clamp(normalDotLight,-1,1),q=PASTURE_LIGHT_VISIBILITY;
 return q.front*Math.max(n,0)+q.back*Math.max(-n,0)+q.edge*(1-Math.abs(n));
}
export function installPastureLighting(material,{seed=false}={}){
 if(material.userData.pastureLighting)return material;
 const before=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=function(shader,renderer){
  before.call(this,shader,renderer);
  if(!shader.vertexShader.includes('#include <begin_vertex>')||!shader.fragmentShader.includes('#include <aomap_fragment>')||!shader.fragmentShader.includes('#include <lights_physical_pars_fragment>'))throw Error('Pasture shading requires standard surface hooks');
  shader.vertexShader='varying float pastureLeafHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   pastureLeafHeight=clamp(${seed?'position.y / .24':'uv.y'},0.0,1.0);`);
  shader.fragmentShader='varying float pastureLeafHeight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
   void RE_Direct_Pasture(const in IncidentLight directLight,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){
    vec3 previousDiffuse=reflectedLight.directDiffuse;
    RE_Direct_Physical(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
    float pastureIncidence=clamp(dot(geometryNormal,directLight.direction),-1.0,1.0);
    float pastureDiffuse=.85*max(pastureIncidence,0.0)+.32*max(-pastureIncidence,0.0)+.13*(1.0-abs(pastureIncidence));
    reflectedLight.directDiffuse=previousDiffuse+pastureDiffuse*directLight.color*BRDF_Lambert(material.diffuseColor);
   }
   #undef RE_Direct
   #define RE_Direct RE_Direct_Pasture
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
   float pastureDepth=1.0-smoothstep(0.0,.38,pastureLeafHeight);
   float pastureSkyVisibility=exp(-.32*pastureDepth);
   reflectedLight.indirectDiffuse*=pastureSkyVisibility;
   reflectedLight.indirectSpecular*=pastureSkyVisibility;`);
 };
 material.customProgramCacheKey=()=>cache()+'-pasture-thin-leaf-2-'+(seed?'seed':'leaf');
 material.userData.pastureLighting={version:2,seed,...PASTURE_LIGHT_VISIBILITY};
 material.needsUpdate=true;
 return material;
}
