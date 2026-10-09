// Original outer surface relief. Reuses the terrain's resident textures and
// uniforms. Full outer cover uses four samples per active turf/soil material;
// its transition also reads the original albedo to preserve the seam exactly.
// At most three nearby normal samples; the unmatched turf detail fades out.
// No new sampler uniforms or texture assets.
// Geometry, riding ground, lighting, fog and resource ownership are untouched.
export const OUTER_GROUND_CACHE='outer-ground-grain-4';
// Exact source means are measured after sRGB decoding, in the shader's linear
// working space. Far terrain keeps the scan's energy, but not its repeated
// broad light tracks; the existing landform/grove fields own that larger scale.
export const OUTER_GROUND_PHOTOS=Object.freeze({
 soil:Object.freeze({source:'textures/dry-ground/sandy_gravel_02_diff_1k.jpg',sha256:'c9d143db07db9a6be2eba285fae961d868520422ee5fa4d38d55da24f9968d51',mean:Object.freeze([.324470161,.174060729,.086463402]),scale:3.0,nearContrast:.50,farContrast:.02}),
 turf:Object.freeze({source:'textures/pasture/grass_diff.webp',sha256:'4e1835cb0773b6786a4318bf16081d6bc6f243b2da81d97e41288fa0744bfc5e',mean:Object.freeze([.128665800,.163481132,.035452736]),scale:1.5,nearContrast:.72,farContrast:.035}),
});
const photoResponse=(kind,sample)=>{const p=OUTER_GROUND_PHOTOS[kind];return `outerGroundGrain(${sample},vec3(${p.mean.join(',')}),${p.nearContrast},${p.farContrast},outerFootprint)`;};
const field=`
      // Value and analytic gradient of the same smooth field; no finite-difference
      // texture reads. Derivatives vanish at cell boundaries on both axes.
      vec3 outerGroundField(vec2 q){
        vec2 cell=floor(q),f=fract(q),s=f*f*(3.0-2.0*f),ds=6.0*f*(1.0-f);
        float a=tHash(cell),b=tHash(cell+vec2(1.0,0.0));
        float c=tHash(cell+vec2(0.0,1.0)),d=tHash(cell+vec2(1.0));
        return vec3(mix(mix(a,b,s.x),mix(c,d,s.x),s.y),
          mix(b-a,d-c,s.y)*ds.x,mix(c-a,d-b,s.x)*ds.y);
      }
`;
const albedo=`
      // OUTER_GROUND_STOCHASTIC_V3: adjacent cells share their corner samples,
      // so orientation and phase change continuously rather than forming rows.
      // Gradients are captured before any branch or hashed coordinate change.
      vec3 outerGroundAlbedo(sampler2D source,vec2 q,vec2 qDx,vec2 qDy){
        vec2 cell=floor(q*.42),f=fract(q*.42);
        f=f*f*(3.0-2.0*f);
        float footprint=max(length(qDx),length(qDy));
        // Mips integrate photographed grain before it becomes subpixel noise.
        // Preserve anisotropy; an isotropic maximum would smear grazing slopes.
        float mipScale=exp2(.65*smoothstep(.08,.65,footprint));
        vec3 color=vec3(0.0);
        for(int y=0;y<=1;y++)for(int x=0;x<=1;x++){
          vec2 corner=vec2(float(x),float(y));
          float weight=(x==1?f.x:1.0-f.x)*(y==1?f.y:1.0-f.y);
          vec2 seed=tHash2(cell+corner+vec2(17.3,41.7));
          float turn=floor(seed.x*4.0),scale=.90+.20*seed.y;
          vec2 sampleUV=turfQuarterTurn(q*scale,turn)+seed*61.7;
          #ifdef texture2DGradEXT
            color+=texture2DGradEXT(source,sampleUV,
              turfQuarterTurn(qDx*scale*mipScale,turn),
              turfQuarterTurn(qDy*scale*mipScale,turn)).rgb*weight;
          #else
            // WebGL1 without explicit gradients retains its native mip chain.
            color+=texture2D(source,sampleUV,log2(mipScale)).rgb*weight;
          #endif
        }
        return color;
      }
      // OUTER_GROUND_GRAIN_V4: photographed gravel/grass remains local grain.
      // Broad scan markings fade before becoming screen-space lines. The scan's
      // measured mean preserves energy; this is not an arbitrary flat tint.
      vec3 outerGroundGrain(vec3 sampled,vec3 average,float nearContrast,float farContrast,float footprint){
        float resolved=1.0-smoothstep(.035,.20,footprint);
        return mix(average,sampled,mix(farContrast,nearContrast,resolved));
      }
`;
const fields=`
      // OUTER_GROUND_RELIEF_V2: metre-scaled structure survives distant mips.
      float outerSurfaceBlend=smoothstep(15.0,145.0,length(max(abs(p)-vec2(500.0),vec2(0.0))));
      // The first visible outer slopes are 60-80 m from the riding boundary.
      // Finish de-tiling there; climate and broad relief retain their long fade.
      float outerTileBlend=smoothstep(15.0,60.0,length(max(abs(p)-vec2(500.0),vec2(0.0))));
      float outerFootprint=max(length(dFdx(p)),length(dFdy(p)));
      vec3 outerTuft=outerGroundField(p/8.0+vec2(7.3,29.1));
      vec3 outerFold=outerGroundField(p/30.0+vec2(51.6,-11.4));
      float outerTuftFilter=1.0-smoothstep(1.0,3.5,outerFootprint);
      float outerFoldFilter=1.0-smoothstep(4.0,14.0,outerFootprint);
      float outerDetailFade=(1.0-smoothstep(.12,.75,outerFootprint))*outerSurfaceBlend;
      vec2 uv=p/1.4+outerSurfaceBlend*(vec2(outerFold.x,outerTuft.x)-.5)*.27;
`;
const normal=`#include <normal_fragment_maps>
      // Sub-metre resident normals fade before their footprint becomes noise.
      // The broad 8/30 m analytic relief remains independently filtered.
      vec3 outerDetail=vec3(0.0,0.0,1.0);
      if(outerDetailFade>.005){
        // A rotated albedo cannot share the old unrotated meadow normal.
        // Retain its coherent seam response, then use the analytic relief;
        // litter and rock still use their matching photographed coordinates.
        if(outerTileBlend<1.0)outerDetail=mix(texture2D(meadowDetail,uv).xyz*2.0-1.0,vec3(0.0,0.0,1.0),outerTileBlend);
        if(canopy>.003)outerDetail=mix(outerDetail,texture2D(litterDetail,earthUV).xyz*2.0-1.0,canopy);
        if(rocky>.003)outerDetail=mix(outerDetail,texture2D(stoneDetail,rockUVy).xyz*2.0-1.0,rocky);
        outerDetail.xy*=1.0-clamp(soilWeight,0.0,1.0);
      }
      vec2 outerHeightGradient=outerTuft.yz*(.32/8.0)*outerTuftFilter*(1.0-outerGrove*.45)
        +outerFold.yz*(.60/30.0)*outerFoldFilter;
      vec3 outerGradient=vec3(outerHeightGradient.x,0.0,outerHeightGradient.y);
      outerGradient-=wn*dot(wn,outerGradient);
      vec3 outerTangent=cross(vec3(0.0,0.0,1.0),wn);
      if(dot(outerTangent,outerTangent)<.0001)outerTangent=cross(vec3(1.0,0.0,0.0),wn);
      outerTangent=normalize(outerTangent);
      vec3 outerBitangent=normalize(cross(wn,outerTangent));
      vec3 outerRelief=normalize(wn-outerGradient+.24*outerDetailFade*
        (outerDetail.x*outerTangent+outerDetail.y*outerBitangent));
      if(outerSurfaceBlend>0.0)normal=normalize(mix(normal,mat3(viewMatrix)*outerRelief,outerSurfaceBlend));
`;
export function patchOuterGroundSurface(shader){
 const edits=[
  ['      // Right-angle UV rotations keep footprint area',field+'      // Right-angle UV rotations keep footprint area'],
  ['      vec2 uv = p / 1.4;',fields],
  ['        return vec2(v.y,-v.x);\n      }','        return vec2(v.y,-v.x);\n      }'+albedo],
  ['      vec3 turf;',`      vec2 outerTurfDx=dFdx(uv),outerTurfDy=dFdy(uv);
      vec3 turf;`],
  ['        turf = texture2D(map,uv).rgb;',`        if(outerTileBlend<=0.0)turf=texture2D(map,uv).rgb;
        else{
          turf=${photoResponse('turf',`outerGroundAlbedo(map,uv*${OUTER_GROUND_PHOTOS.turf.scale},outerTurfDx*${OUTER_GROUND_PHOTOS.turf.scale},outerTurfDy*${OUTER_GROUND_PHOTOS.turf.scale})`)};
          if(outerTileBlend<1.0)turf=mix(texture2D(map,uv).rgb,turf,outerTileBlend);
        }`],
  ['      vec2 soilUV  = mat2(.819,-.574,.574,.819)*p/2.53;',`      vec2 soilUV=mat2(.819,-.574,.574,.819)*p/2.53;
      vec2 outerSoilDx=dFdx(soilUV),outerSoilDy=dFdy(soilUV);`],
  ['      if(bank>0.003||canyon>0.003) sand=texture2D(terrainSoil,soilUV).rgb*1.45;',`      if(bank>0.003||canyon>0.003||outerBank>0.003){
        if(outerTileBlend<=0.0)sand=texture2D(terrainSoil,soilUV).rgb;
        else{
          sand=${photoResponse('soil',`outerGroundAlbedo(terrainSoil,soilUV*${OUTER_GROUND_PHOTOS.soil.scale}.0,outerSoilDx*${OUTER_GROUND_PHOTOS.soil.scale}.0,outerSoilDy*${OUTER_GROUND_PHOTOS.soil.scale}.0)`)};
          if(outerTileBlend<1.0)sand=mix(texture2D(terrainSoil,soilUV).rgb,sand,outerTileBlend);
        }
        sand*=1.45;
      }`],
  ['canopy*0.60);','canopy*mix(.60,.85,outerSurfaceBlend));'],
  ['      soilWeight*=soilReady;',`      if(outerBank>.003){
        surface=mix(surface,sand*vec3(.78,.80,.73)*(.90+.12*outerFold.x),outerBank);
        soilWeight=mix(soilWeight,1.0,outerBank);
      }
      soilWeight*=soilReady;`],
  ['      roughnessFactor=mix(roughnessFactor,.43,clamp(wet*.42+rainWet,0.0,.85));',`      float outerRoughness=mix(.97,.87,outerBank);
      outerRoughness=mix(outerRoughness,.90+.08*outerTuft.x,rocky);
      outerRoughness=mix(outerRoughness,.98,canopy*.65);
      roughnessFactor=mix(roughnessFactor,outerRoughness,outerSurfaceBlend);
      roughnessFactor=mix(roughnessFactor,.43,clamp(wet*.42+rainWet,0.0,.85));`],
  ['#include <normal_fragment_maps>',normal],
 ];
 let fragment=shader.fragmentShader;
 // All-or-nothing replacement keeps the old complete terrain hook available
 // if the upstream shader changes; it never leaves half a material installed.
 for(const [anchor,replacement]of edits){if(fragment.split(anchor).length!==2)return false;fragment=fragment.replace(anchor,replacement);}
 shader.fragmentShader=fragment;
 return true;
}
