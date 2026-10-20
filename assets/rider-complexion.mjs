// Material-only finish for the existing authored rider head and eyes. Geometry,
// skin weights, saved appearance and the shared material lifecycle stay intact.
export function patchStylizedHead(material,u,asset,body){
 material.map=null;material.normalMap=null;material.roughness=.62;material.ior=1.40;material.specularIntensity=.32;
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 uFaceBind; varying vec3 vHead;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHead=(uFaceBind*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
uniform vec3 uSkin;varying vec3 vHead;
// Head-local pigment follows the same authored skin in every pose.
// The lower neck keeps the body's exact tint, roughness and geometric normal.
float riderSkinHash(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float riderSkinNoise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(riderSkinHash(i),riderSkinHash(i+vec3(1,0,0)),f.x),mix(riderSkinHash(i+vec3(0,1,0)),riderSkinHash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(riderSkinHash(i+vec3(0,0,1)),riderSkinHash(i+vec3(1,0,1)),f.x),mix(riderSkinHash(i+vec3(0,1,1)),riderSkinHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float front=smoothstep(.045,.077,vHead.z),face=smoothstep(.015,.040,vHead.y)*front;
   float cheeks=exp(-pow((abs(vHead.x)-.051)/.023,2.0)-pow((vHead.y-${body==='f'?'.063':'.065'})/.026,2.0));
   vec3 skin=mix(uSkin,uSkin*vec3(1.025,.89,.87),cheeks*face*${body==='f'?'.32':'.22'});
   // Modest low-frequency complexion variation is pigment, never baked light.
   float complexion=riderSkinNoise(vHead*vec3(84.0,76.0,89.0)+vec3(4.8,1.3,9.7))-.5;
   skin*=1.0+complexion*.025*face;
   float lipY=vHead.y-${(asset.config.mouth+(body==='f'?.0025:.001)).toFixed(5)};
   float lip=exp(-pow(abs(vHead.x)/${body==='f'?'.026':'.0304'},4.0)-pow(lipY/.0085,4.0))*face;
   vec3 lipColor=uSkin*vec3(.90,.51,.54)+vec3(.008,.0008,.0016);
   diffuseColor.rgb=mix(skin,lipColor,lip*.72);
   float forehead=exp(-pow(vHead.x/.043,4.0)-pow((vHead.y-.137)/.036,4.0));
   float nose=exp(-pow(vHead.x/.019,4.0)-pow((vHead.y-.070)/.039,4.0));
   float tZone=max(forehead,nose)*face;
   // Keep the authored smooth normals; only roughness has filtered microvariation.
   float poreNoise=riderSkinNoise(vHead*vec3(1650.0,1570.0,1730.0));
   float skinDetailVisibility=1.0-smoothstep(.00030,.00085,length(fwidth(vHead)));`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float skinRoughness=mix(.62,.64,cheeks*face);
   skinRoughness=mix(skinRoughness,.44,tZone*.85);
   skinRoughness=mix(skinRoughness,.40,lip*.78);
   roughnessFactor=clamp(skinRoughness+(poreNoise-.5)*.022*skinDetailVisibility*face,.38,.66);`);

 };
 material.customProgramCacheKey=()=>'rider-artist-head-natural-surface-3-'+body;
 material.userData.riderNaturalSkin={version:3,scope:'head material only',neckTransitionUnchanged:true,geometryUnchanged:true,authoredNormals:true,filteredPoreRelief:false,spatialRoughness:true,bakedFaceShadows:false};
}
export function patchStylizedEyes(material,u,asset,body){
 material.map=null;material.normalMap=null;material.roughness=.25;material.ior=1.376;material.specularIntensity=.48;material.clearcoat=.48;material.clearcoatRoughness=.12;
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 uFaceBind;varying vec3 vEyeHead;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeHead=(uFaceBind*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uEye;varying vec3 vEyeHead;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 e=vec2(abs(vEyeHead.x)-${(body==='f'?.03431453:.03320741).toFixed(6)},vEyeHead.y-${(body==='f'?.09881232:.09402493).toFixed(6)});
   float radius=${asset.adultFace98?(body==='f'?'.00835':'.00855'):(body==='f'?'.0102':'.0096')},r=length(e),edgeAA=max(fwidth(r),.00018);
   float iris=1.0-smoothstep(radius-edgeAA,radius+edgeAA,r);
   iris*=smoothstep(${(asset.config.target[2]+.0056).toFixed(5)},${(asset.config.target[2]+.0064).toFixed(5)},vEyeHead.z);
   float pupil=1.0-smoothstep(.0039-edgeAA,.0039+edgeAA,r);
   float limbus=smoothstep(radius-.0015,radius-.0003,r);
   float angle=atan(e.y,e.x+.0000001),radial=r/radius;
   float finePhase=angle*79.0+sin(radial*23.0)*.65;
   float coarsePhase=angle*31.0-radial*17.0;
   float fineVisible=1.0-smoothstep(.7,2.5,fwidth(finePhase));
   float coarseVisible=1.0-smoothstep(.7,2.5,fwidth(coarsePhase));
   float fibers=sin(finePhase)*.060*fineVisible+sin(coarsePhase)*.065*coarseVisible;
   float collarette=exp(-pow((radial-.48)/.14,2.0));
   float irisL=dot(uEye,vec3(.2126,.7152,.0722));
   vec3 eyeColor=mix(vec3(irisL),uEye,.93);
   vec3 irisColor=eyeColor*(.70+.23*sin(clamp(radial,0.0,1.0)*3.14159265)+fibers);
   irisColor=mix(irisColor,eyeColor*vec3(1.12,.92,.65),collarette*.16);
   irisColor=mix(irisColor,eyeColor*.26,limbus*.82);
   irisColor=mix(irisColor,vec3(.002,.003,.004),pupil);
   // Warm tissue is confined to the sclera corners. Reflected light comes
   // entirely from the physical surface and moves with the scene's lights.
   float corner=smoothstep(radius*.95,radius*2.15,abs(e.x));
   vec3 sclera=mix(vec3(.73,.725,.695),vec3(.62,.45,.41),corner*.28);
   diffuseColor.rgb=mix(sclera,irisColor,iris);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.36,.20,iris);');
 };material.customProgramCacheKey=()=>'rider-artist-eyes-natural-surface-3-'+body+(asset.adultFace98?'-adult98':'');
 material.userData.riderNaturalEyes={version:3,geometryUnchanged:true,selectedEyeColorPreserved:true,filteredIrisFibers:true,paintedHighlights:false,physicalHighlights:true};
}

export function finishRiderComplexion(rig){
 if(!rig?.face?.material||!rig?.eyes?.material||!rig?.kit?.headAsset||!rig.u)return rig;
 if(rig.face.material.userData.riderNaturalSkin?.version===3&&rig.eyes.material.userData.riderNaturalEyes?.version===3)return rig;
 patchStylizedHead(rig.face.material,rig.u,rig.kit.headAsset,rig.kit.body);
 patchStylizedEyes(rig.eyes.material,rig.u,rig.kit.headAsset,rig.kit.body);
 rig.face.material.needsUpdate=true;rig.eyes.material.needsUpdate=true;
 return rig;
}
