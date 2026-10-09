// Fabric and sewn/grip details use bind coordinates, so they deform with the
// actual breeches and preserve the existing shirt/boot coverage shader.
export function finishBreeches(T,kit,material,geometry,{color='#626c76'}={}){
 geometry.computeBoundingBox();const waist=geometry.boundingBox.max.y,knee=kit.zones.bootY+.070;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();material.color.set(color);material.roughness=.88;
 material.onBeforeCompile=sh=>{previous(sh);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBreechesCloth;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBreechesCloth=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 vBreechesCloth;
 float ridingLine(float d,float width){float aa=max(fwidth(d),.00015);return 1.0-smoothstep(width-aa,width+aa,d);}
 float ridingGrip(vec3 p){vec2 gripUv=vec2((abs(p.x)-.066)/.033,(p.y-${(knee+.035).toFixed(7)})/.130);float d=length(gripUv);return (1.0-smoothstep(.95,1.02,d))*smoothstep(-.013,.012,p.z);}
 `).replace('#include <map_fragment>',`#include <map_fragment>
 vec3 bc=vBreechesCloth;
 float grip=ridingGrip(bc);
 float warp=(bc.x+bc.y*.45)*2800.0,weft=(bc.y-bc.x*.45)*2600.0;
 float resolved=1.0-smoothstep(.8,3.0,max(fwidth(warp),fwidth(weft)));
 diffuseColor.rgb*=1.0+sin(warp)*sin(weft)*resolved*.021;
 diffuseColor.rgb*=mix(1.0,.81,grip);
 float front=smoothstep(.008,.035,bc.z),pocketT=(bc.y-${(waist-.153).toFixed(7)})/.106;
 float pocketX=.058+.077*pocketT+.012*sin(clamp(pocketT,0.0,1.0)*3.14159265);
 float pocket=ridingLine(abs(abs(bc.x)-pocketX),.00072)*smoothstep(0.0,.035,pocketT)*(1.0-smoothstep(.965,1.0,pocketT))*front;
 float flyY=smoothstep(${(waist-.165).toFixed(7)},${(waist-.155).toFixed(7)},bc.y)*(1.0-smoothstep(${(waist-.037).toFixed(7)},${(waist-.030).toFixed(7)},bc.y));
 float fly=ridingLine(abs(bc.x-.004),.00042)*flyY*front;
 float waistband=ridingLine(abs(bc.y-${(waist-.031).toFixed(7)}),.00065);
 float seam=max(pocket,max(fly,waistband));
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.69,seam*.75);
 `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.97,ridingGrip(vBreechesCloth));');
 };
 material.customProgramCacheKey=()=>key+'-tailored-breeches1';material.needsUpdate=true;
 const evidence={finish:'fine woven breeches with pocket/fly/waist seams and matte knee grip',waistY:waist,kneeY:knee,geometryChanged:false,sourceCoveragePreserved:true,color};material.userData.breechesFinish=evidence;return evidence;
}
