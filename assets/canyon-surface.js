// Two warped, incommensurate scales keep the photographed bedding from
// repeating as equally spaced rings on a tall cliff. All PBR maps share UVs.
export function dressCanyonSurface(THREE,material) {
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=`
      float canyonHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float canyonNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(canyonHash(i),canyonHash(i+vec2(1,0)),f.x),mix(canyonHash(i+vec2(0,1)),canyonHash(i+vec2(1,1)),f.x),f.y);}
      vec4 canyonSample(sampler2D surface,vec2 uv){
        vec2 p=uv/3.0;
        p+=vec2(canyonNoise(p*.31),canyonNoise(p*.29+7.4))*.80;
        return mix(texture2D(surface,p),texture2D(surface,p*.713+vec2(.43,.72)),.44);
      }
    `+shader.fragmentShader;
    for(const [chunk,sampler,uv]of[['map_fragment','map','vMapUv'],['normal_fragment_maps','normalMap','vNormalMapUv'],['roughnessmap_fragment','roughnessMap','vRoughnessMapUv']]){
      const body=THREE.ShaderChunk[chunk].replace(new RegExp('texture2D\\( '+sampler+', '+uv+' \\)','g'),'canyonSample( '+sampler+', '+uv+' )');
      shader.fragmentShader=shader.fragmentShader.replace('#include <'+chunk+'>',body);
    }
  };
  material.customProgramCacheKey=()=> 'canyon-stratified-surface-v1';
}
