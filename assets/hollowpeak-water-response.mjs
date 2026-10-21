// Selected Hollowpeak optical response only. No geometry, contacts, textures,
// clock, RNG, registrations, source water uniforms or other waterways change.
export const HOLLOWPEAK_WATER_RESPONSE_PROFILE='hollowpeak-optical-response-1';
function replaceOnce(source,before,after){if(source.split(before).length!==2)throw Error('Selected Hollowpeak water shader contract changed');return source.replace(before,after);}
export function configureHollowpeakWaterResponse(material,{pool=false}={}){
 if(!material?.isMeshPhysicalMaterial)throw Error('Existing owned physical water clone required');
 // The plain source has a strong coherent reflection plus clearcoat. Its
 // roughness does not blur the separately sampled reflection texture. Keep
 // moving reflection highlights while allowing the depth tint/bed to read.
 material.roughness=pool?.26:.23;material.clearcoat=.10;material.clearcoatRoughness=.30;
 material.envMapIntensity=.68;material.specularIntensity=.48;
}
export function patchHollowpeakWaterResponse(shader,{pool=false,landingX=-150,landingZ=-232.1}={}){
 if(![landingX,landingZ].every(Number.isFinite)||!shader.fragmentShader.includes('varying float hydroFittedDepth;'))throw Error('Actual owned depth and finite fall landing required');
 const perturb=`
      // World-scale, uneven short waves disturb the optical surface only.
      // The accepted finite mesh and its depth/support data stay untouched.
      float hpVisibleMicro=1.0-smoothstep(24.0,80.0,length(vViewPosition));
      float hpPatch=.66+.34*sin(wx*.71+wz*.43+sin(wx*.19-wz*.31)*1.7-wt*.31);
      float hpFineA=wx*2.13+wz*1.27-wt*1.58+sin(wz*.54)*.8;
      float hpFineB=wx*.93-wz*3.17+wt*1.21+sin(wx*.41)*.65;
      dx+=hpVisibleMicro*hpPatch*(.018*cos(hpFineA)+.013*cos(hpFineB));
      dz+=hpVisibleMicro*hpPatch*(.011*cos(hpFineA)-.022*cos(hpFineB));
      ${pool?`vec2 hpFromFall=waterWorld.xz-vec2(${landingX.toFixed(6)},${landingZ.toFixed(6)});
      float hpFallRadius=sqrt(dot(hpFromFall,hpFromFall)+.35);
      vec2 hpOutflow=hpFromFall/hpFallRadius;
      float hpImpact=exp(-hpFallRadius*.25);
      float hpImpactBreak=cos(hpFallRadius*5.2-wt*4.1+sin(wx*.81+wz*.43)*1.15);
      dx+=hpVisibleMicro*hpOutflow.x*hpImpact*hpImpactBreak*.022;
      dz+=hpVisibleMicro*hpOutflow.y*hpImpact*hpImpactBreak*.022;`:''}
      normal=normalize(mat3(viewMatrix)*vec3(-dx,1.0,-dz));
      #include <clearcoat_normal_fragment_maps>`;
 shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',perturb);
 // Use the perturbed physical normal for the selected reflection response.
 // This removes the constant28% mirror wash; the existing finite reflection
 // plane, map, projection and live uniform owners remain authoritative.
 shader.fragmentShader=replaceOnce(shader.fragmentShader,
  'outgoingLight=mix(outgoingLight,reflected,edge*(.28+.58*fresnel)*localReflection);',
  `float hpViewCos=clamp(abs(dot(normal,normalize(vViewPosition))),0.0,1.0);
        float hpReflectionFresnel=pow(1.0-hpViewCos,5.0);
        float hpDepthVisibility=mix(.78,1.0,smoothstep(.05,1.15,hydroFittedDepth));
        float hpReflectionWeight=mix(.06,.36,hpReflectionFresnel)*hpDepthVisibility;
        outgoingLight=mix(outgoingLight,reflected,edge*hpReflectionWeight*localReflection);`);
 shader.fragmentShader=replaceOnce(shader.fragmentShader,
  'vec2 reflectionUV=projected.xy/max(projected.w,.001)+vec2(dx,dz)*.009;',
  'vec2 reflectionUV=projected.xy/max(projected.w,.001)+vec2(dx,dz)*.025;');
 shader.fragmentShader=replaceOnce(shader.fragmentShader,
  'diffuseColor.rgb*=.86+rip*.025+swell*.035;',
  `diffuseColor.rgb*=.86+rip*.025+swell*.035;
      // Retain the actual depth vertex tint; a restrained sediment/water
      // response warms the shallows without repainting geometry buffers.
      diffuseColor.rgb*=mix(vec3(1.12,1.08,.91),vec3(.92,1.03,.98),smoothstep(.05,1.4,hydroFittedDepth));`);
 shader.fragmentShader=replaceOnce(shader.fragmentShader,
  '#include <roughnessmap_fragment>',
  `#include <roughnessmap_fragment>
      roughnessFactor=max(roughnessFactor,mix(.30,.23,smoothstep(.05,1.25,hydroFittedDepth)));`);
}
