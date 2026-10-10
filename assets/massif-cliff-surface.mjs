// Named distant massifs borrow Hollowpeak's already-resident Poly Haven / Amal
// Kumar CC0 marble cliff maps. No textures, loaders, geometry or RNG are created.
// Signed right-handed projection frames match the independently tested crag
// shader; surface gradients preserve the underlying normal on sloping faces.
import {CRAG_PLANES} from './crag-mineral-surface.mjs';
export const MASSIF_CLIFF_CACHE='massif-cliff-surface-2';
// Resident images may queue behind the world's other scans on a cold/mobile
// load. Keep the complete existing material while this bounded window remains
// open; a slow successful download must not permanently lose its cliff detail.
export const MASSIF_CLIFF_LOAD_TIMEOUT_MS=120000;
const vec=v=>`vec3(${v.map(x=>x.toFixed(1)).join(',')})`;
const frames=CRAG_PLANES.map((p,i)=>{
  const s=`cliffSigns.${p.axis}`;
  return `vec3 cliffU${i}=${vec(p.u)}${p.signed==='u'?`*${s}`:''};
    vec3 cliffV${i}=${vec(p.v)}${p.signed==='v'?`*${s}`:''};
    vec2 cliffUv${i}=vec2(dot(landPosition,cliffU${i}),dot(landPosition,cliffV${i}))/cliffMetres;`;
}).join('\n');
const blend=name=>`${name}0*cliffWeights.x+${name}1*cliffWeights.y+${name}2*cliffWeights.z`;
const samples=(sampler,name)=>CRAG_PLANES.map((p,i)=>`vec3 ${name}${i}=texture2D(${sampler},cliffUv${i}).rgb;`).join('\n');
const gradients=CRAG_PLANES.map((p,i)=>`vec3 cliffN${i}=texture2D(cliffNormal,cliffUv${i}).xyz*2.0-1.0;
    vec3 cliffG${i}=-(cliffU${i}*cliffN${i}.x+cliffV${i}*cliffN${i}.y)*cliffStrength/max(cliffN${i}.z,.25);`).join('\n');
function replaceOnce(body,anchor,replacement){
  if(body.split(anchor).length!==2)throw new Error('Missing or repeated massif cliff shader anchor: '+anchor);
  return body.replace(anchor,replacement);
}
const readyImage=texture=>{
  const image=texture?.image;
  return !!image&&(image.naturalWidth??image.width)>0&&(image.naturalHeight??image.height)>0;
};

export function dressMassifCliffSurface({material,source,metres=36,strength=1.05,timeoutMs=MASSIF_CLIFF_LOAD_TIMEOUT_MS}={}){
  if(!material||typeof material.onBeforeCompile!=='function')throw new Error('Massif cliff requires a dressed landscape material');
  if(!(metres>0&&Number.isFinite(metres)&&strength>=0&&Number.isFinite(strength)))throw new Error('Invalid massif cliff scale or strength');
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  const maps=[source?.map,source?.normalMap,source?.roughnessMap];
  const state={loaded:0,failed:false,status:'loading',errors:[],source:source?.name||'missing resident Hollowpeak material',
    metres,strength,textureObjects:3,newTextures:0,extraTextureFetches:9,normalMethod:'signed triplanar surface gradient'};
  material.userData.cliffSurface=state;
  let resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  // Promise is available to QA without entering material serialization or receipts.
  Object.defineProperty(state,'ready',{value:ready,enumerable:false});
  const failed=message=>{state.failed=true;state.status='fallback';state.errors.push(message);resolveReady(state);};
  if(maps.some(t=>!t)){failed('Resident cliff texture unavailable; existing landscape shader retained');return material;}
  const uniforms={cliffAlbedo:{value:maps[0]},cliffNormal:{value:maps[1]},cliffArm:{value:maps[2]},
    cliffMetres:{value:metres},cliffStrength:{value:strength}};
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    if(state.loaded!==3||state.failed)return;
    // Keep the existing complete shader as the fallback if a future Three update
    // changes its anchors. Build on a shallow copy before committing this pass.
    const sh={...shader,uniforms:{...shader.uniforms}};
    try{
      Object.assign(sh.uniforms,uniforms);
      sh.vertexShader='varying vec3 cliffWorldNormal;\n'+sh.vertexShader;
      sh.vertexShader=replaceOnce(sh.vertexShader,'#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
        cliffWorldNormal=normalize(transformedNormal*mat3(viewMatrix));`);
      sh.fragmentShader=`varying vec3 cliffWorldNormal;
        uniform sampler2D cliffAlbedo,cliffNormal,cliffArm;
        uniform float cliffMetres,cliffStrength;\n`+sh.fragmentShader;
      sh.fragmentShader=replaceOnce(sh.fragmentShader,'diffuseColor.rgb*=relief;',`diffuseColor.rgb*=relief;
        vec3 cliffGeometryNormal=normalize(cliffWorldNormal);
        #ifdef DOUBLE_SIDED
          cliffGeometryNormal*=gl_FrontFacing?1.0:-1.0;
        #endif
        vec3 cliffSigns=step(vec3(0.0),cliffGeometryNormal)*2.0-1.0;
        vec3 cliffWeights=pow(abs(cliffGeometryNormal),vec3(4.0));
        cliffWeights/=max(dot(cliffWeights,vec3(1.0)),.000001);
        ${frames}
        ${samples('cliffAlbedo','cliffA')}
        ${samples('cliffArm','cliffR')}
        vec3 cliffRock=${blend('cliffA')};
        vec3 cliffPbr=${blend('cliffR')};
        // Weathered cliff plates appear on exposed flanks. Living toes and white
        // snow retain their established material and the existing atmospheric fog.
        float cliffSlope=smoothstep(.025,.24,1.0-abs(cliffGeometryNormal.y));
        float cliffGreen=smoothstep(.003,.028,vColor.g-max(vColor.r,vColor.b));
        float cliffSnow=smoothstep(.46,.72,min(vColor.r,min(vColor.g,vColor.b)));
        float cliffCover=(.35+.65*cliffSlope)*(1.0-cliffGreen*.80)*(1.0-cliffSnow);
        float cliffGrey=dot(cliffRock,vec3(.2126,.7152,.0722));
        vec3 cliffTint=mix(vec3(1.0),clamp(cliffRock/max(cliffGrey,.025),vec3(.80),vec3(1.22)),.36);
        float cliffPlate=clamp(.38+cliffGrey*2.35,.42,1.45);
        diffuseColor.rgb*=mix(vec3(1.0),cliffTint*cliffPlate,cliffCover);`);
      sh.fragmentShader=replaceOnce(sh.fragmentShader,'#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor*=mix(1.0,clamp(cliffPbr.g,.74,1.0),cliffCover);`);
      sh.fragmentShader=replaceOnce(sh.fragmentShader,'#include <lights_physical_fragment>',`
        ${gradients}
        vec3 cliffGradient=${blend('cliffG')};
        cliffGradient-=cliffGeometryNormal*dot(cliffGeometryNormal,cliffGradient);
        vec3 cliffDetailedNormal=normalize(cliffGeometryNormal-cliffGradient);
        normal=normalize(mix(normal,mat3(viewMatrix)*cliffDetailedNormal,cliffCover));
        #include <lights_physical_fragment>`);
      sh.fragmentShader=replaceOnce(sh.fragmentShader,'#include <aomap_fragment>',`#include <aomap_fragment>
        float cliffOcclusion=mix(1.0,cliffPbr.r,cliffCover*.42);
        reflectedLight.indirectDiffuse*=cliffOcclusion;
        #if defined( USE_ENVMAP ) && defined( STANDARD )
          float cliffDotNV=saturate(dot(geometryNormal,geometryViewDir));
          reflectedLight.indirectSpecular*=computeSpecularOcclusion(cliffDotNV,cliffOcclusion,material.roughness);
        #endif`);
      shader.uniforms=sh.uniforms;shader.vertexShader=sh.vertexShader;shader.fragmentShader=sh.fragmentShader;
    }catch(error){failed(String(error.message));}
  };
  material.customProgramCacheKey=()=>previousKey.call(material)+(state.loaded===3&&!state.failed?'-'+MASSIF_CLIFF_CACHE:'');
  const start=Date.now();
  function inspect(){
    state.loaded=maps.filter(readyImage).length;
    if(state.loaded===3){state.status='ready';material.needsUpdate=true;resolveReady(state);return;}
    if(Date.now()-start>=timeoutMs){failed('Resident cliff images did not finish loading; existing landscape shader retained');return;}
    // Bounded startup readiness check only: never part of the frame/update loop.
    setTimeout(inspect,40);
  }
  inspect();
  return material;
}
