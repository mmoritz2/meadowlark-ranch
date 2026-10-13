import {createWaterfallEffects} from './waterfall-effects.js?v=hollowpeak-cascades-1';
import {CASCADE_FLOW_PROFILE,CASCADE_VEIL_WEIGHTS,cascadeRim,cascadeSpread,sampleCascadeVeil,cascadeFlowRate,cascadeMotionAmplitude} from './cascade-flow.mjs?v=hollowpeak-cascades-1';
/* Thin lit liquid, not a pair of full-width curtains. Nine unequal veils
   accelerate over one finite lip; one merged geometry/material owns the draw.
   UV.y is fraction of vertical drop; phase remains a compatibility attribute,
   cascadeSpeed is its gravity travel rate. Independently grounded chute meshes
   use the material defaults and are never displaced by this shader. */
export function createWaterfallArt({THREE:T,flowTexture=null}){
 const time={value:0},mistMaterials=[],effectGroups=[];
 const material=new T.MeshPhysicalMaterial({name:'Water | flowing waterfall',color:'#b0c9c9',roughness:.46,metalness:0,ior:1.333,clearcoat:.015,clearcoatRoughness:.46,specularIntensity:.14,transparent:true,opacity:.88,depthWrite:false,side:T.DoubleSide,envMapIntensity:.9});
 material.forceSinglePass=true;
 material.defaultAttributeValues={...material.defaultAttributeValues,cascadePhase:[0],cascadeSpeed:[.6],cascadeAcross:[-1],cascadeMotion:[0]};
 material.onBeforeCompile=sh=>{
  sh.uniforms.waterfallTime=time;if(flowTexture)sh.uniforms.waterfallFlowMap={value:flowTexture};
  sh.vertexShader='attribute float cascadePhase;attribute float cascadeSpeed;attribute float cascadeAcross;attribute float cascadeMotion;uniform float waterfallTime;varying float cascadeLayer;varying float cascadeTravelSpeed;varying float cascadeWholeAcross;varying float cascadeChute;varying vec2 cascadeUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncascadeUV=uv;cascadeLayer=cascadePhase;cascadeTravelSpeed=cascadeSpeed;cascadeWholeAcross=cascadeAcross>=0.0?cascadeAcross:uv.x;cascadeChute=cascadeAcross<0.0?1.0:0.0;\nif(cascadeMotion>0.0)transformed.x+=cascadeMotion*(.70*sin(waterfallTime*1.1+cascadeWholeAcross*7.0+uv.y*8.0)+.30*sin(waterfallTime*1.9+cascadeWholeAcross*13.0+uv.y*17.0));');
  sh.fragmentShader=`varying vec2 cascadeUV;varying float cascadeLayer;varying float cascadeTravelSpeed;varying float cascadeWholeAcross;varying float cascadeChute;uniform float waterfallTime;${flowTexture?'uniform sampler2D waterfallFlowMap;':''}
   float fallHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
   float fallNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fallHash(i),fallHash(i+vec2(1,0)),f.x),mix(fallHash(i+vec2(0,1)),fallHash(i+vec2(1,1)),f.x),f.y);}
   `+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 fuv=cascadeUV;
   float fy=sqrt(max(fuv.y,.0001))-waterfallTime*cascadeTravelSpeed;
   float fx=cascadeWholeAcross;
   // One whole-field current flows through intermittently joined veils.
   // Roots remain quiet water; entrained air builds down the accelerating fall.
   float drift=fallNoise(vec2(fx*3.0,fy*2.5));
   float folds=fallNoise(vec2(fx*9.0+drift*1.2,fy*8.0));
   float mist=fallNoise(vec2(fx*23.0,fy*31.0));
   float fine=fallNoise(vec2(fx*51.0,fy*73.0));
   ${flowTexture?`// Two half-cycle flows crossfade before either scroll resets. RGB is
   // neutral foam density, never a full static curtain or source colour wash.
   float photoPhase=fract(waterfallTime*cascadeTravelSpeed*.32);
   float photoPhaseB=fract(photoPhase+.5);
   float photoBlend=abs(photoPhase-.5)*2.0;
   vec2 photoBase=vec2(fx*1.15+drift*.012,sqrt(max(fuv.y,0.0))*1.35);
   vec4 photoA=texture2D(waterfallFlowMap,fract(photoBase-vec2(0.0,photoPhase)));
   vec4 photoB=texture2D(waterfallFlowMap,fract(photoBase-vec2(.17,photoPhaseB)));
   float densityA=photoA.a*dot(photoA.rgb,vec3(.2126,.7152,.0722));
   float densityB=photoB.a*dot(photoB.rgb,vec3(.2126,.7152,.0722));
   float photoFoam=mix(densityA,densityB,photoBlend);`:'float photoFoam=smoothstep(.22,.76,folds*.68+mist*.25+fine*.07);'}
   float entrainment=mix(cascadeChute*.64,1.0,smoothstep(.005,.36,fuv.y));
   float aeration=entrainment*(.24+.76*photoFoam);
   // Shared boundaries have identical field values; no per-strip alpha bevel.
   float outerEdge=smoothstep(0.0,.008,fx)*smoothstep(0.0,.008,1.0-fx);
   diffuseColor.rgb=mix(vec3(.19,.33,.33),vec3(.84,.91,.91),aeration);
   diffuseColor.a*=outerEdge*mix(.13,.96,aeration);
  `);
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(.28,.58,aeration);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize(normal+vec3((fine-.5)*.025,(mist-.5)*.022,0.0));`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
   #ifdef USE_CLEARCOAT
     clearcoatNormal=normal;
   #endif`);
 };
 material.customProgramCacheKey=()=> 'flowing-waterfall-joining-veils-v5-'+(flowTexture?'photo':'original-noise');
 function fall(options){
  const {x,z,top,bottom,width,run=2.6,name='waterfall',footHeightAt,footWidth}=options,flow={x,z,top,bottom,width,run,footHeightAt,footWidth};
  const root=new T.Group();root.name='Water | '+name;const p=[],uv=[],phases=[],speeds=[],acrossValues=[],motion=[],ix=[],R=64,C=4,rate=cascadeFlowRate(top,bottom);
  function vertex(point,u,v,phase,s){p.push(...point);uv.push(u,v);phases.push(phase);speeds.push(rate);const spread=cascadeSpread(flow,s);acrossValues.push(.5+(point[0]-x)/(2*width*spread));motion.push(Math.min(cascadeMotionAmplitude(width,s),Math.max(0,width*1.29-Math.abs(point[0]-x))));}
  // Veil roots meet the incoming channel at its exact finite endpoint.
  // The obsolete pale crest band and both rear curtains are absent.
  for(let veil=0;veil<CASCADE_VEIL_WEIGHTS.length;veil++){
   const offset=p.length/3;
   for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){const s=j/R,u=i/C;vertex(sampleCascadeVeil(flow,veil,s,u),u,s*s,veil*.1731+.043,s);}
   for(let j=0;j<R;j++)for(let i=0;i<C;i++){const a=offset+j*(C+1)+i,b=a+C+1;ix.push(a,b,a+1,a+1,b,b+1);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('cascadePhase',new T.Float32BufferAttribute(phases,1));geo.setAttribute('cascadeSpeed',new T.Float32BufferAttribute(speeds,1));geo.setAttribute('cascadeAcross',new T.Float32BufferAttribute(acrossValues,1));geo.setAttribute('cascadeMotion',new T.Float32BufferAttribute(motion,1));geo.setIndex(ix);geo.computeVertexNormals();geo.computeBoundingSphere();const maxMotion=Math.max(...motion);geo.boundingSphere.radius+=maxMotion;
  const mesh=new T.Mesh(geo,material);mesh.renderOrder=2;mesh.name='Water | '+name+' liquid veils';root.add(mesh);
  const attributeBytes=Object.values(geo.attributes).reduce((n,a)=>n+a.array.byteLength,0),indexBytes=geo.index.array.byteLength;
  root.userData.waterfallArt={top,bottom,width,run,profile:CASCADE_FLOW_PROFILE,veils:CASCADE_VEIL_WEIGHTS.length,vertices:p.length/3,triangles:ix.length/3,draws:1,attributeBytes,indexBytes,geometryCPUBytes:attributeBytes+indexBytes,geometryGPUBytes:attributeBytes+indexBytes,footContact:!!footHeightAt,footWidth:footWidth||null,flowTexture:!!flowTexture,rate,maxLateralMotionM:maxMotion,lipZRange:[z,z]};return root;
 }
 function pool({x,z,y,radius=7.4}){
  const g=new T.CircleGeometry(radius,80),p=g.attributes.position;
  for(let i=1;i<p.count;i++){const a=Math.atan2(p.getY(i),p.getX(i)),scale=1+.09*Math.sin(a*5)+.04*Math.cos(a*9);p.setXYZ(i,p.getX(i)*scale,p.getY(i)*scale*.87,0);}
  const m=new T.MeshStandardMaterial({name:'Water | feathered plunge pool',color:'#618b88',roughness:.18,metalness:.17,transparent:true,opacity:.75,depthWrite:false});
  m.onBeforeCompile=sh=>{sh.uniforms.waterfallTime=time;sh.vertexShader='varying vec2 poolUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npoolUV=uv;');sh.fragmentShader='varying vec2 poolUV;uniform float waterfallTime;\n'+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float radius=length(poolUV-.5)*2.0;
    diffuseColor.a*=1.0-smoothstep(.68,1.0,radius);
    float ripple=sin(radius*91.0-waterfallTime*3.4)*sin(poolUV.x*110.0+waterfallTime*.7);
    diffuseColor.rgb*=.93+.07*ripple;
   `);};m.customProgramCacheKey=()=> 'feathered-falls-pool-v1';
  const out=new T.Mesh(g,m);out.name='Water | irregular plunge pool';out.rotation.x=-Math.PI/2;out.position.set(x,y,z);out.receiveShadow=true;return out;
 }
 function impact({x,y,z,radius=3,heightAt=null,surfaceOffset=.10}){
  const mat=new T.MeshStandardMaterial({name:'Water | aerated impact foam',color:'#dce6e2',roughness:.72,transparent:true,opacity:.74,depthWrite:false});
  mat.onBeforeCompile=sh=>{sh.uniforms.waterfallTime=time;sh.vertexShader='varying vec2 splashUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsplashUV=uv;');sh.fragmentShader=`varying vec2 splashUV;uniform float waterfallTime;
    float foamHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
    float foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);}
    `+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 sp=(splashUV-.5)*2.0;
    // Irregular foam patches drift with the surface current. Noise
    // breaks both the bubble walls and the footprint, avoiding concentric discs.
    float sr=length(sp*vec2(1.0,.88));
    vec2 drift=sp+vec2(waterfallTime*.035,-waterfallTime*.065);
    float breakup=foamNoise(sp*5.0+vec2(waterfallTime*.08,-waterfallTime*.06));
    float cells=foamNoise(drift*23.0+breakup*2.1);
    float smallCells=foamNoise(drift*51.0);
    float bubbles=(1.0-smoothstep(.025,.135,abs(cells-.52)))*mix(.38,1.0,smallCells);
    float core=(1.0-smoothstep(.10,.67,sr))*(.57+.43*bubbles);
    float scattered=bubbles*smoothstep(.35,.65,breakup)*.54;
    diffuseColor.a*=(1.0-smoothstep(.40,1.0,sr+(breakup-.5)*.18))*max(core,scattered);
   `);};mat.customProgramCacheKey=()=> 'aerated-impact-v3-natural-footprint';
  const footprint=new T.CircleGeometry(radius,64),points=footprint.attributes.position;for(let i=1;i<points.count;i++){const angle=Math.atan2(points.getY(i),points.getX(i)),fray=1+.075*Math.sin(angle*3+.8)+.045*Math.cos(angle*5-1.4)+.035*Math.sin(angle*8+.3);points.setXYZ(i,points.getX(i)*fray,points.getY(i)*fray*.83,0);}if(heightAt){for(let i=0;i<points.count;i++)points.setZ(i,heightAt(x+points.getX(i),z-points.getY(i))+surfaceOffset-y);footprint.computeVertexNormals();}footprint.computeBoundingSphere();
  const out=new T.Mesh(footprint,mat);out.rotation.x=-Math.PI/2;out.position.set(x,y,z);out.renderOrder=3;out.name='Water | soft impact foam';out.userData.waterfallFoam={groundFollowing:!!heightAt,surfaceOffset:heightAt?surfaceOffset:null,triangles:footprint.index.count/3};return out;
 }
 function effects(options){const result=createWaterfallEffects({THREE:T,time,...options});mistMaterials.push(...result.materials);effectGroups.push(result);return result;}
 return {fall,pool,impact,effects,mistMaterials,effectGroups,material,time,update(t){time.value=t;}};
}
