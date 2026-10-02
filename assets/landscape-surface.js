// World-space mineral detail for distant relief and the chalk down. Textures
// are shared with the terrain; no extra geometry passes or per-frame updates.
const textures=new Map();
export function dressLandscape({THREE,material,anisotropy=4,fogScale=.34,fogCap=.82,meadow=false}) {
  const loader=new THREE.TextureLoader();
  const load=path=>{
    if(textures.has(path)){const t=textures.get(path);t.anisotropy=Math.max(t.anisotropy,anisotropy);return t;}
    const t=loader.load(path);t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=anisotropy;textures.set(path,t);return t;
  };
  const stone=load('./assets/textures/scanned/rock_boulder_cracked_diff.webp');
  const turf=meadow?load('./assets/textures/pasture/grass_diff.webp'):null;
  material.onBeforeCompile=sh=>{
    sh.uniforms.landStone={value:stone};if(turf)sh.uniforms.landTurf={value:turf};
    sh.vertexShader='varying vec3 landPosition, landNormal;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      landPosition=(modelMatrix*vec4(position,1.0)).xyz;
      landNormal=normalize(mat3(modelMatrix)*normal);`);
    sh.fragmentShader=`varying vec3 landPosition,landNormal;
      uniform sampler2D landStone;
      ${meadow?'uniform sampler2D landTurf;':''}
      float landHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float landNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(landHash(i),landHash(i+vec2(1,0)),f.x),mix(landHash(i+vec2(0,1)),landHash(i+vec2(1,1)),f.x),f.y);}
      `+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 lw=pow(abs(landNormal),vec3(4.0));lw/=max(dot(lw,vec3(1.0)),.001);
      vec3 lp=landPosition/18.0;
      vec3 mineral=texture2D(landStone,lp.yz).rgb*lw.x+texture2D(landStone,lp.xz).rgb*lw.y+texture2D(landStone,lp.xy).rgb*lw.z;
      float large=landNoise(landPosition.xz*.013+landPosition.y*.004);
      float fracture=landNoise(vec2(landPosition.x+landPosition.z*.63,landPosition.y*1.8)*.063);
      float weathering=smoothstep(.23,.77,large*.6+fracture*.4);
      float rockGrain=dot(mineral,vec3(.2126,.7152,.0722));
      // Light and dark mineral seams remain legible after mip filtering.
      float relief=mix(.61,1.18,weathering)*clamp(.40+rockGrain*2.8,.48,1.42);
      float landHeight=rockGrain*.28+fracture*2.4;
      ${meadow?`
        // Vertex colours separate the green down from its white chalk figure.
        float living=smoothstep(.008,.06,vColor.g-vColor.b)*
          (1.0-smoothstep(.32,.60,max(vColor.r,max(vColor.g,vColor.b))));
        vec3 blades=texture2D(landTurf,landPosition.xz/1.4).rgb;
        float turfGrain=dot(blades,vec3(.2126,.7152,.0722));
        float turfRelief=(.61+large*.43+fracture*.26)*clamp(.64+turfGrain*1.3,.64,1.20);
        relief=mix(1.0,turfRelief,living);
        landHeight=living*(turfGrain*.07+fracture*.3);
      `:''}
      diffuseColor.rgb*=relief;`);
    // Screen derivatives supply a stable bump gradient on all three projection
    // axes. This adds fine light-catching relief without displacing the mesh.
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 ldx=dFdx(-vViewPosition),ldy=dFdy(-vViewPosition);
      vec3 lr1=cross(ldy,normal),lr2=cross(normal,ldx);
      float ldet=dot(ldx,lr1);
      if(abs(ldet)>.000001){
        vec3 grad=sign(ldet)*(dFdx(landHeight)*lr1+dFdy(landHeight)*lr2);
        normal=normalize(abs(ldet)*normal-grad);
      }`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <fog_fragment>',`
      #ifdef USE_FOG
        #ifdef FOG_EXP2
          float landFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth*${fogScale.toFixed(3)});
        #else
          float landFog=smoothstep(fogNear,fogFar,vFogDepth);
        #endif
        gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,min(${fogCap.toFixed(3)},landFog));
      #endif`);
  };
  material.customProgramCacheKey=()=>`landscape-surface-v1-${meadow}-${fogScale}-${fogCap}`;
  material.needsUpdate=true;
}
