// Conditional mineral detail for Countryside scanned crags. Existing Poly Haven
// CC0 cliff_side textures are borrowed from geology.canyonMaterial (1.83 m).
// No loads, THREE constructors, resource disposal, RNG, or per-frame work.
export const CRAG_MINERAL_CACHE='countryside-crag-mineral-1';
export const CRAG_MINERAL_METRES=1.83;

// Each signed projection is right handed: U cross V = outward axis N.
// Values also drive the GLSL below, preventing a separate normal/UV convention.
export const CRAG_PLANES=Object.freeze([
  {axis:'x',u:[0,0,-1],v:[0,1,0],signed:'u'},
  {axis:'y',u:[1,0,0],v:[0,0,-1],signed:'v'},
  {axis:'z',u:[1,0,0],v:[0,1,0],signed:'u'}
].map(p=>Object.freeze({...p,u:Object.freeze(p.u),v:Object.freeze(p.v)})));
const vec=v=>`vec3(${v.map(x=>x.toFixed(1)).join(',')})`;
const frames=CRAG_PLANES.map((p,i)=>{
  const a=['x','y','z'][i],s=`cragSigns.${a}`;
  return `vec3 cragU${i}=${vec(p.u)}${p.signed==='u'?`*${s}`:''};
    vec3 cragV${i}=${vec(p.v)}${p.signed==='v'?`*${s}`:''};
    vec2 cragUv${i}=vec2(dot(cragWorldPosition,cragU${i}),dot(cragWorldPosition,cragV${i}))/cragMetres;`;
}).join('\n');
const samples=(sampler,name,type)=>CRAG_PLANES.map((p,i)=>
  `${type} ${name}${i}=texture2D(${sampler},cragUv${i}).${type==='vec3'?'rgb':'rgba'};`).join('\n');
const blend=name=>`${name}0*cragWeights.x+${name}1*cragWeights.y+${name}2*cragWeights.z`;
const gradients=CRAG_PLANES.map((p,i)=>`vec3 cragN${i}=texture2D(cragNormal,cragUv${i}).xyz*2.0-1.0;
    vec3 cragG${i}=-(cragU${i}*cragN${i}.x+cragV${i}*cragN${i}.y)*cragStrength/max(cragN${i}.z,.25);`).join('\n');
function replaceOnce(body,anchor,replacement){
  if(body.split(anchor).length!==2)throw new Error('Missing or repeated crag shader anchor: '+anchor);
  return body.replace(anchor,replacement);
}

export function dressCragMineral({material,source,metres=CRAG_MINERAL_METRES,strength=.65}={}){
  if(!material?.map||!source?.map||!source.normalMap||!source.roughnessMap)
    throw new Error('Crag mineral detail requires the existing atlas and canyon PBR textures');
  if(!(metres>0&&Number.isFinite(metres)&&strength>=0&&Number.isFinite(strength)))
    throw new Error('Invalid crag mineral scale or normal strength');
  // Preserve the existing clone and all of its render flags/scalars. These
  // wrappers borrow the three resident texture objects without modifying them.
  const uniforms={cragAlbedo:{value:source.map},cragNormal:{value:source.normalMap},
    cragArm:{value:source.roughnessMap},cragMetres:{value:metres},cragStrength:{value:strength}};
  material.userData.cragMineral={metres,strength,source:source.name,textureObjects:3,
    newTextures:0,textureFetches:10,normalMethod:'signed triplanar surface gradient'};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 cragWorldPosition,cragWorldNormal;\n'+shader.vertexShader;
    // transformedNormal has already passed Three's inverse-transpose normal
    // matrix (including instance scaling). View rotation is undone here.
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
      cragWorldNormal=normalize(transformedNormal*mat3(viewMatrix));`);
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <project_vertex>',`#include <project_vertex>
      vec4 cragVertex=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        cragVertex=instanceMatrix*cragVertex;
      #endif
      cragWorldPosition=(modelMatrix*cragVertex).xyz;`);
    shader.fragmentShader=`varying vec3 cragWorldPosition,cragWorldNormal;
      uniform sampler2D cragAlbedo,cragNormal,cragArm;
      uniform float cragMetres,cragStrength;\n`+shader.fragmentShader;
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <map_fragment>',`
      vec3 cragGeometryNormal=normalize(cragWorldNormal);
      #ifdef DOUBLE_SIDED
        cragGeometryNormal*=gl_FrontFacing?1.0:-1.0;
      #endif
      vec3 cragSigns=step(vec3(0.0),cragGeometryNormal)*2.0-1.0;
      vec3 cragWeights=pow(abs(cragGeometryNormal),vec3(4.0));
      cragWeights/=max(dot(cragWeights,vec3(1.0)),.000001);
      ${frames}
      ${samples('cragAlbedo','cragA','vec3')}
      ${samples('cragArm','cragR','vec3')}
      vec3 cragFine=${blend('cragA')};
      vec3 cragPbr=${blend('cragR')};
      // Fine material supplies the detail. Only a restrained broad atlas tint
      // remains, so large photographed mottles do not dominate the enlarged face.
      vec4 cragMacro=texture2D(map,vMapUv);
      float cragFineGrey=dot(cragFine,vec3(.2126,.7152,.0722));
      float cragMacroGrey=dot(cragMacro.rgb,vec3(.2126,.7152,.0722));
      vec3 cragNeutral=mix(vec3(cragFineGrey),cragFine,.20);
      float cragMacroVariation=mix(1.0,clamp(.72+cragMacroGrey*.70,.82,1.18),.12);
      diffuseColor.rgb*=cragNeutral*vec3(1.35,1.32,1.26)*cragMacroVariation;
      diffuseColor.a*=cragMacro.a;`);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <normal_fragment_maps>',`
      ${gradients}
      vec3 cragGradient=${blend('cragG')};
      // Project the gradient onto the actual surface. Neutral normal maps
      // therefore preserve every slanted geometric normal, including blend seams.
      cragGradient-=cragGeometryNormal*dot(cragGeometryNormal,cragGradient);
      vec3 cragDetailedNormal=normalize(cragGeometryNormal-cragGradient);
      normal=normalize(mat3(viewMatrix)*cragDetailedNormal);`);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <roughnessmap_fragment>',`
      float roughnessFactor=roughness*clamp(cragPbr.g,.72,1.0);`);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <metalnessmap_fragment>',`
      float metalnessFactor=metalness*cragPbr.b;`);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <aomap_fragment>',`
      float cragOcclusion=mix(1.0,cragPbr.r,.28);
      reflectedLight.indirectDiffuse*=cragOcclusion;
      #if defined( USE_CLEARCOAT )
        clearcoatSpecularIndirect*=cragOcclusion;
      #endif
      #if defined( USE_SHEEN )
        sheenSpecularIndirect*=cragOcclusion;
      #endif
      #if defined( USE_ENVMAP ) && defined( STANDARD )
        float cragDotNV=saturate(dot(geometryNormal,geometryViewDir));
        reflectedLight.indirectSpecular*=computeSpecularOcclusion(cragDotNV,cragOcclusion,material.roughness);
      #endif`);
  };
  material.customProgramCacheKey=()=>CRAG_MINERAL_CACHE;
  material.needsUpdate=true;
  return material;
}
