/* Ground materials authored for Star Ranch. Distances and texture scales are metres. */
export function createTerrainSurface({THREE, renderer, grass, bump}) {
  const loader = new THREE.TextureLoader();
  function load(name) {
    const t = loader.load(`./assets/textures/realism/${name}_albedo.jpg`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0,0,512,512);
  const forest = new THREE.CanvasTexture(canvas);
  forest.colorSpace = THREE.NoColorSpace;
  const uniforms = {terrainRock:{value:load('rock')}, terrainForest:{value:load('forest_floor')}, forestMask:{value:forest}};
  for(const [key,path] of [['terrainSoil','./assets/textures/ground_sand.jpg'],['terrainSnow','./assets/textures/ground_snow.jpg']]){
    const t=loader.load(path);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;uniforms[key]={value:t};
  }
  const material = new THREE.MeshStandardMaterial({map:grass,vertexColors:true,roughness:.96,bumpMap:bump,bumpScale:.045});
  material.envMapIntensity = .45;
  material.customProgramCacheKey = () => 'terrain-biomes-v2';
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 terrainPosition; varying vec3 terrainNormal;\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      terrainPosition = (modelMatrix * vec4(position,1.0)).xyz;
      terrainNormal = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = `varying vec3 terrainPosition; varying vec3 terrainNormal;
      uniform sampler2D terrainRock; uniform sampler2D terrainForest; uniform sampler2D forestMask;
      uniform sampler2D terrainSoil; uniform sampler2D terrainSnow;
      float tHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      vec2 tHash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      float tNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(tHash(i),tHash(i+vec2(1,0)),f.x),mix(tHash(i+vec2(0,1)),tHash(i+vec2(1,1)),f.x),f.y);}
      ` + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',`
      vec2 p = terrainPosition.xz;
      vec2 uv = p / 4.2;
      vec3 turf;
      #ifdef CHEAP_GROUND
        turf = texture2D(map,uv).rgb;
      #else
        vec2 cell = floor(uv*.22), f=fract(uv*.22); f=f*f*(3.0-2.0*f);
        turf=vec3(0.0);
        for(int y=0;y<=1;y++)for(int x=0;x<=1;x++){
          vec2 corner=vec2(float(x),float(y));
          float w=(x==1?f.x:1.0-f.x)*(y==1?f.y:1.0-f.y);
          turf += texture2D(map,uv+tHash2(cell+corner)*61.7).rgb*w;
        }
      #endif
      float macro=tNoise(p*.017)*.65+tNoise(p*.047+11.0)*.35;
      turf *= mix(vec3(.54,.66,.57),vec3(.86,.82,.64),macro);
      float riverDistance=abs(p.y-(120.0+sin(p.x*.012)*45.0));
      float streamDistance=abs(p.x-(118.0+sin(p.y*.03)*14.0+sin(p.y*.011+3.0)*8.0));
      float bank=1.0-smoothstep(5.0,10.5,riverDistance);
      bank=max(bank,(1.0-smoothstep(1.5,4.8,streamDistance))*(1.0-smoothstep(158.0,166.0,p.y)));
      float canopy=texture2D(forestMask,vec2((p.x+500.0)/1000.0,(500.0-p.y)/1000.0)).r;
      vec3 earth=texture2D(terrainForest,p/2.0).rgb;
      vec3 surface=mix(turf,earth,smoothstep(.12,.82,canopy)*.9);
      surface=mix(surface,earth*vec3(.81,.88,.86),bank*.93);
      vec3 wn=normalize(terrainNormal);
      float slope=1.0-abs(wn.y);
      float stone=smoothstep(.14,.42,slope+(macro-.5)*.075);
      vec3 rock;
      #ifdef CHEAP_GROUND
        rock=texture2D(terrainRock,p/3.2).rgb;
      #else
        vec3 w=pow(abs(wn),vec3(5.0)); w/=max(dot(w,vec3(1.0)),.001);
        rock=texture2D(terrainRock,terrainPosition.yz/3.2).rgb*w.x
           +texture2D(terrainRock,p/3.2).rgb*w.y
           +texture2D(terrainRock,terrainPosition.xy/3.2).rgb*w.z;
      #endif
      surface=mix(surface,rock,stone);
      float canyon=1.0-smoothstep(96.0,176.0,length(p-vec2(-220.0,130.0)));
      vec2 soilUV=mat2(.819,-.574,.574,.819)*p/3.7;
      vec3 sand=texture2D(terrainSoil,soilUV+tHash2(floor(p/21.0))*.014).rgb*vec3(.74,.79,.79);
      surface=mix(surface,mix(sand,rock*vec3(1.07,.94,.82),stone),canyon*.96);
      float snowRegion=1.0-smoothstep(84.0,162.0,length(p-vec2(-160.0,-210.0)));
      float snow=snowRegion*(1.0-smoothstep(.25,.58,slope));
      vec3 snowColor=texture2D(terrainSnow,p/7.1).rgb*vec3(.86,.91,.94)*(0.94+macro*.09);
      surface=mix(surface,snowColor,snow*.98);
      /* The four quarters opened up beyond the old fence. Each re-tints ground the shader
         already samples, so a new country costs a smoothstep rather than another texture. */
      float amber=1.0-smoothstep(74.0,140.0,length(p-vec2(300.0,-300.0)));
      vec3 amberCol=texture2D(terrainForest,p/2.9).rgb*vec3(1.34,.94,.55)*(0.95+macro*.12);
      surface=mix(surface,amberCol,amber*.9);
      float marsh=1.0-smoothstep(66.0,128.0,length(p-vec2(310.0,300.0)));
      vec3 marshCol=texture2D(terrainForest,p/3.6).rgb*vec3(.72,.86,.66)*(0.80+macro*.10);
      surface=mix(surface,marshCol,marsh*.92*(1.0-smoothstep(.30,.62,slope)));
      float tundra=1.0-smoothstep(70.0,134.0,length(p-vec2(-300.0,-320.0)));
      vec3 tundraCol=mix(texture2D(terrainSnow,p/9.4).rgb*vec3(.90,.94,.93),rock*vec3(1.02,1.0,.96),0.42)*(0.96+macro*.08);
      surface=mix(surface,tundraCol,tundra*.88);
      float ochre=1.0-smoothstep(70.0,134.0,length(p-vec2(-330.0,300.0)));
      vec3 ochreCol=texture2D(terrainSoil,soilUV*1.24).rgb*vec3(1.22,.72,.52)*(0.95+macro*.10);
      surface=mix(surface,mix(ochreCol,rock*vec3(1.18,.80,.62),stone),ochre*.94);
      diffuseColor.rgb*=surface;
    `);
  };
  function setTrees(trees) {
    ctx.fillStyle='#000';ctx.fillRect(0,0,512,512);
    ctx.globalCompositeOperation='lighten';
    for(const tree of trees){
      const x=(tree.x+500)*.512,y=(tree.z+500)*.512,r=(5.5+(tree.s||1)*2.2)*.512;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(255,255,255,.96)');g.addColorStop(.35,'rgba(245,245,245,.88)');g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    ctx.globalCompositeOperation='source-over';forest.needsUpdate=true;
  }
  return {material,setTrees};
}

export function createRiverMaterial({THREE, map}) {
  const time={value:0};
  const material=new THREE.MeshStandardMaterial({map,color:0x54756d,roughness:.18,metalness:.04,side:THREE.DoubleSide,transparent:true,opacity:.97,depthWrite:false});
  material.envMapIntensity=1.3;
  const shader=fade=>sh=>{
    sh.uniforms.waterTime=time;
    sh.vertexShader='varying vec3 waterWorld;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      waterWorld=(modelMatrix*vec4(position,1.0)).xyz;`);
    sh.fragmentShader='varying vec3 waterWorld; uniform float waterTime;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`
      // Two advecting wave fields produce moving specular reflections at real world scale.
      float wx=waterWorld.x, wz=waterWorld.z, wt=waterTime;
      float rip=sin(wx*2.7+wz*1.4-wt*1.8)*sin(wx*.7-wz*3.2-wt*.85);
      diffuseColor.rgb*=.90+rip*.045;
    `);
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float dx=.045*cos(wx*2.7+wz*1.4-wt*1.8)+.025*cos(wx*6.7-wz*3.1+wt*2.1);
      float dz=.038*cos(wx*1.2+wz*4.1-wt*1.3)+.018*sin(wx*4.3+wz*7.1-wt*2.4);
      normal=normalize(mat3(viewMatrix)*vec3(-dx,1.0,-dz));
    `);
    if(fade) sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      diffuseColor.a*=smoothstep(0.0,.14,vMapUv.y)*(1.0-smoothstep(1.86,2.0,vMapUv.y));`);
  };
  material.onBeforeCompile=shader(true);
  material.userData.plainShader=shader(false);
  material.userData.waterTime=time;
  material.customProgramCacheKey=()=> 'ripple-water-v2';
  return material;
}
