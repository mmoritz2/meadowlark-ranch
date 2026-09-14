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
  /* One mask texture carries two independent fields in two channels: red is tree cover, green is
     ground that gets walked on. Packing wear into the spare channel of a texture the shader
     already fetches is the whole reason a worn bridleway costs nothing here — the alternative
     was a second sampler and a second fetch on every square metre of the basin to serve a
     feature that touches maybe two per cent of it. Canvas has no way to clear one channel and
     leave the other, so both lists are kept and the whole mask is redrawn whenever either
     changes; that happens twice in a session, at boot. */
  const MASK = 1024, MPM = MASK / 1000;                   // pixels per metre: the basin is 1000 m across
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = MASK;
  const ctx = canvas.getContext('2d');
  let treeList = [], pathList = [];
  const forest = new THREE.CanvasTexture(canvas);
  forest.colorSpace = THREE.NoColorSpace;
  function redrawMask() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,MASK,MASK);
    /* 'lighten' is a per-channel max, so a red-only blob never touches the green field and two
       overlapping paths do not darken each other into a bruise at the crossing. */
    ctx.globalCompositeOperation = 'lighten';
    for(const tree of treeList){
      const x=(tree.x+500)*MPM, y=(tree.z+500)*MPM, r=(5.5+(tree.s||1)*2.2)*MPM;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(255,0,0,.96)');g.addColorStop(.35,'rgba(255,0,0,.88)');g.addColorStop(1,'rgba(255,0,0,0)');
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    ctx.lineCap='round'; ctx.lineJoin='round';
    for(const {pts,width,strength} of pathList){
      /* Two strokes: a broad faint shoulder where the grass is merely thinned, and a narrower
         core where it has gone. A single stroke gives a hard-edged stripe, which is the decal
         look this is here to cure. */
      for(const [mul,alpha] of [[2.9,0.34],[1.15,1.0]]){
        ctx.strokeStyle='rgba(0,'+Math.round(255*Math.min(1,alpha*strength))+',0,1)';
        ctx.lineWidth=Math.max(1,width*mul*MPM);
        ctx.beginPath();
        for(let i=0;i<pts.length;i++){
          const x=(pts[i][0]+500)*MPM, y=(pts[i][1]+500)*MPM;
          if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y);
        }
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation='source-over';
    forest.needsUpdate=true;
  }
  redrawMask();
  const uniforms = {terrainRock:{value:load('rock')}, terrainForest:{value:load('forest_floor')}, forestMask:{value:forest}};
  for(const [key,path] of [['terrainSoil','./assets/textures/ground_sand.jpg'],['terrainSnow','./assets/textures/ground_snow.jpg']]){
    const t=loader.load(path);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;uniforms[key]={value:t};
  }
  const material = new THREE.MeshStandardMaterial({map:grass,vertexColors:true,roughness:.96,bumpMap:bump,bumpScale:.045});
  material.envMapIntensity = .45;
  material.customProgramCacheKey = () => 'terrain-biomes-v3';
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 terrainPosition; varying vec3 terrainNormal;\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      terrainPosition = (modelMatrix * vec4(position,1.0)).xyz;
      terrainNormal = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = `varying vec3 terrainPosition; varying vec3 terrainNormal;
      uniform sampler2D terrainRock; uniform sampler2D terrainForest; uniform sampler2D forestMask;
      uniform sampler2D terrainSoil; uniform sampler2D terrainSnow;
      /* A multiply-and-fract hash rather than fract(sin(dot(...))). It is a handful of cheap
         arithmetic ops instead of a transcendental, which matters once the ground asks for eight
         noise lookups a pixel and the ground is most of the screen; it is also better behaved
         out at the rim of the basin, where sin's argument gets large enough to lose bits. */
      float tHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      vec2 tHash2(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
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

      /* Read the surface, not just the point on it. grade is the true gradient — rise over run —
         because the old thresholds were written against 1-|n.y|, and in this basin that number
         has a median of 0.0014 and a 99th percentile of 0.15. Asking it for 0.14 before showing
         any stone meant stone appeared on well under one per cent of the map, which is why the
         hillsides here have always been grass all the way up. */
      vec3 wn = normalize(terrainNormal);
      float grade = length(wn.xz)/max(abs(wn.y),1e-3);
      float hgt = terrainPosition.y;
      float upClose = 1.0-smoothstep(14.0,74.0,distance(terrainPosition,cameraPosition));

      /* Four scales, shared by everything below. region is the drift across the whole basin,
         macro the field-sized mottle this shader already had, stand the size of one stand of
         rushes, grain the size of a hoofprint — and grain is only fetched where the eye could
         resolve it, because a metre-scale pattern seen from two hundred metres is just aliasing.
         'patch' would have been the obvious name for the mid scale. It is a reserved word in
         GLSL ES 3 and the shader will not compile with it, which is worth a line here so the
         next person does not rediscover that from a wall of driver output. */
      float region = tNoise(p*0.0041+31.0);
      float macro  = tNoise(p*0.017)*0.62 + tNoise(p*0.047+11.0)*0.38;
      float stand  = tNoise(p*0.055+53.0)*0.62 + tNoise(p*0.185+7.0)*0.38;
      float grain  = 0.5; if(upClose>0.004) grain = tNoise(p*0.63+5.0);
      /* Two more fields exist for one purpose: to break boundaries. Adding noise to a distance
         BEFORE the smoothstep, rather than softening the smoothstep, is what turns a gradient
         into an ecotone — fingers of the new country reaching out into the old, islands of the
         old left stranded inside it. Six regions share these two lookups, mixed in different
         proportions so that no two boundaries in the basin bulge in the same places. */
      float edgeLo = tNoise(p*0.0165+71.0);
      float edgeHi = tNoise(p*0.074+13.0);
      float ecoA = (edgeLo-0.5)*62.0+(edgeHi-0.5)*19.0;
      float ecoB = (edgeHi-0.5)*52.0+(edgeLo-0.5)*24.0;

      /* Pasture is not a ramp from green to straw; it is patches of different things growing
         next to each other. Dryness drifts with the basin and the field; the smoothstep rather
         than a plain sum is there because two noise fields added together pile up around their
         mean and the result was a landscape that varied on paper and read as one colour from
         forty metres — this pushes the common middle out towards both ends. */
      float dryness = smoothstep(0.17,0.83, macro*0.55 + region*0.45);
      vec3 tint = mix(vec3(.40,.60,.42), vec3(1.02,.89,.58), dryness);
      /* How heavy the sward is, which the eye reads as VALUE rather than hue: thin turf over
         hard ground is paler and greyer, a deep bite of grass is darker. This is the term that
         carries the middle distance — forty to two hundred metres, where the albedo has mipped
         to a flat colour and the near-field tufts have already stopped — and without it that
         whole band goes back to being one painted green however much the hue drifts. */
      float vigour = smoothstep(0.34,0.70, stand*0.66+macro*0.34);
      tint *= mix(1.13,0.86,vigour);
      tint = mix(tint, tint*vec3(.90,1.04,.93), vigour*0.55);
      /* A distinct clump of something coarser, off edgeHi rather than stand so it does not
         simply repeat the vigour pattern — and it is free, because edgeHi is already fetched
         for the region boundaries below. */
      float clump = smoothstep(0.54,0.66,edgeHi)*(1.0-dryness*0.45);
      tint = mix(tint, tint*vec3(.74,.95,.82)*1.10, clump*0.70);
      tint *= 1.0+(grain-0.5)*0.30*upClose;
      /* Water runs downhill and stands in the flats. The low ground of this basin is within a
         couple of metres of the river's own level and should read damp: darker, greener, not
         bleached. The ridges go the other way and burn off first, and burn off faster where
         they are also steep enough to shed what rain they get. */
      float damp = (1.0-smoothstep(-2.8,1.7,hgt))*(1.0-smoothstep(0.09,0.33,grade));
      float dry  = smoothstep(3.4,8.6,hgt)*(0.5+0.5*smoothstep(0.03,0.19,grade));
      tint = mix(tint, tint*vec3(.67,.85,.70), damp*0.55);
      tint = mix(tint, tint*vec3(1.18,1.11,0.90), dry*0.45);
      turf *= tint;

      /* One fetch, two fields — see the mask canvas above. The canopy edge is pushed around by
         stand so the treeline on the ground is ragged rather than a set of soft circles. */
      vec2 mask = texture2D(forestMask, vec2((p.x+500.0)/1000.0,(500.0-p.y)/1000.0)).rg;
      float canopy = smoothstep(.10,.80, mask.r + (stand-0.5)*0.30);
      float wear = mask.g;

      /* The jitter is deliberately most of a metre either way at the water and several metres at
         the top of the bank, so the shingle line wanders in and out of the grass the way a real
         one does instead of running parallel to the channel. */
      float riverDistance = abs(p.y-(120.0+sin(p.x*.012)*45.0)) + (edgeHi-0.5)*5.4 + (grain-0.5)*1.1;
      float streamDistance = abs(p.x-(118.0+sin(p.y*.03)*14.0+sin(p.y*.011+3.0)*8.0)) + (edgeHi-0.5)*2.6;
      float streamLive = 1.0-smoothstep(158.0,166.0,p.y);
      float bank = max(1.0-smoothstep(3.8,9.8,riverDistance),(1.0-smoothstep(1.3,5.0,streamDistance))*streamLive);
      float wet  = max(1.0-smoothstep(1.0,3.4,riverDistance),(1.0-smoothstep(0.5,2.0,streamDistance))*streamLive);

      /* Rock is a slope story. rough makes the stone/grass line ragged instead of a contour, and
         scree is the band of loose gravel that always sits below bare rock on a real hillside. */
      float rough = (macro-0.5)*0.30+(stand-0.5)*0.36;
      float scree = smoothstep(0.22,0.58, grade+rough*0.24);
      float stone = smoothstep(0.42,1.00, grade+rough*0.30);
      float rocky = max(scree,stone);

      float canyon = 1.0-smoothstep(96.0,172.0, length(p-vec2(-220.0,130.0))+ecoB*0.9);
      float snowRegion = 1.0-smoothstep(88.0,158.0, length(p-vec2(-160.0,-210.0))+ecoA*0.8);
      /* Snow lies on the rises and melts out of the hollows where the meltwater collects. */
      float snow = snowRegion*(1.0-smoothstep(0.20,0.58,grade))*smoothstep(-1.6,2.6,hgt+(stand-0.5)*3.6);
      float amber  = 1.0-smoothstep(86.0,132.0, length(p-vec2( 300.0,-300.0))+ecoA);
      float marsh  = 1.0-smoothstep(76.0,124.0, length(p-vec2( 310.0, 300.0))+ecoB);
      float tundra = 1.0-smoothstep(80.0,128.0, length(p-vec2(-300.0,-320.0))+ecoB*0.85+ecoA*0.40);
      float ochre  = 1.0-smoothstep(80.0,128.0, length(p-vec2(-330.0, 300.0))+ecoA*0.90+ecoB*0.35);
      float quarters = amber+marsh+tundra+ochre;

      /* Fifteen texture fetches a pixel, everywhere, was this shader's real cost: forest floor,
         rock three ways, canyon sand, snow and all four quarters were sampled on every square
         metre of ordinary pasture and then multiplied by a weight of zero. Every one of those
         grounds is a contiguous patch tens of metres across, so a whole quad of fragments takes
         the same branch and the divergence that normally makes this a bad trade does not happen.
         Every UV is computed OUTSIDE its branch on purpose — a texture fetch whose coordinate
         was only computed on the lanes that took the branch has no well-defined derivative, and
         picks its mip level out of a hat. Ordinary pasture now costs five fetches, not fifteen. */
      vec2 rockUVy = p/3.2, rockUVx = terrainPosition.yz/3.2, rockUVz = terrainPosition.xy/3.2;
      vec2 soilUV  = mat2(.819,-.574,.574,.819)*p/3.7 + tHash2(floor(p/21.0))*.014;
      vec2 earthUV = p/2.0, snowUV = p/7.1, amberUV = p/2.9, marshUV = p/3.6, ochreUV = soilUV*1.24;
      vec3 earth=vec3(0.0), rock=vec3(0.0), sand=vec3(0.0), snowTex=vec3(0.0);
      if(canopy>0.003||bank>0.003||wear>0.004) earth=texture2D(terrainForest,earthUV).rgb;
      if(rocky>0.003||canyon>0.003||tundra>0.003||ochre>0.003){
        #ifdef CHEAP_GROUND
          rock=texture2D(terrainRock,rockUVy).rgb;
        #else
          vec3 w=pow(abs(wn),vec3(5.0)); w/=max(dot(w,vec3(1.0)),.001);
          rock=texture2D(terrainRock,rockUVx).rgb*w.x
             +texture2D(terrainRock,rockUVy).rgb*w.y
             +texture2D(terrainRock,rockUVz).rgb*w.z;
        #endif
        /* One albedo, three ways — otherwise a whole cliff is a single flat pale grey that
           reads as poured concrete. The value swing comes from the field-scale noise so it
           varies across a face rather than per pixel, and the two beds are warm and cool
           rather than light and dark, which is what makes stratified rock look like rock. */
        rock*=(0.80+0.34*macro)*mix(vec3(1.08,1.00,0.90),vec3(0.90,0.95,1.05),stand);
      }
      if(bank>0.003||canyon>0.003) sand=texture2D(terrainSoil,soilUV).rgb;
      if(snow>0.003||tundra>0.003) snowTex=texture2D(terrainSnow,snowUV).rgb;

      /* Under the trees the ground is litter rather than grass, and it is in shade. */
      vec3 surface = turf;
      if(canopy>0.003) surface = mix(turf, earth*(0.78+0.26*stand), canopy*0.92);
      /* The margin in three parts rather than one painted stripe: wet silt at the waterline,
         pale shingle above it with a coarse speckle of stones, and a ragged line where the grass
         gives up. The jitter is already in riverDistance, so the line wanders. */
      if(bank>0.003){
        vec3 shingle = sand*vec3(.99,.96,.90)*(0.90+0.46*smoothstep(0.54,0.74,stand));
        vec3 silt    = earth*vec3(.60,.65,.60);
        surface = mix(surface, mix(shingle,silt,wet), bank*0.95);
      }
      /* Where hooves go, grass does not. The bridleway is already a ribbon mesh laid on top of
         the ground, and without this the grass runs up to its edge untouched and the whole thing
         reads as a decal on a lawn. This is the shoulder: thinned grass over trodden soil. */
      if(wear>0.004) surface = mix(surface, earth*vec3(0.90,0.86,0.78), wear*0.78);
      /* Gravel first, then bare rock standing out of it. Scree is only half stone by weight:
         the other half is whatever was growing there, which is what stops a hillside going from
         meadow to quarry in the space of one smoothstep. */
      if(rocky>0.003){
        surface = mix(surface, mix(surface,rock,0.50)*vec3(1.02,1.01,0.96), scree*0.72);
        surface = mix(surface, rock, stone*0.94);
      }
      if(canyon>0.003){
        vec3 dust = sand*vec3(.74,.79,.79)*(0.86+0.30*macro);
        surface = mix(surface, mix(dust, rock*vec3(1.07,.94,.82), max(stone,scree*0.55)), canyon*0.96);
      }
      /* Lying snow is drifted, not poured: deeper in the lee and scoured thin on the crowns.
         Without a value swing at these scales the snow texture's own tiling grid is the only
         thing the eye can find in a hundred metres of white. */
      /* Snow reads as paper unless it is cold. This albedo is very nearly neutral, and against a
         warm sky the eye needs the blue put back — it belongs in the shadowed hollows, which is
         what damp is already measuring. */
      if(snow>0.003){
        vec3 c=snowTex*vec3(.84,.90,.99)*(0.82+0.32*(stand*0.55+macro*0.45));
        c=mix(c,c*vec3(.84,.91,1.08),damp*0.7);
        surface=mix(surface,c,snow*0.98);
      }
      /* The four quarters past the old fence. Each re-tints ground the shader already samples,
         so a new country still costs a smoothstep rather than another download — and the whole
         block is skipped on the nine tenths of the basin that is none of them. */
      if(quarters>0.003){
        if(amber>0.003){
          /* Leaf drift, banked deeper in the low sheltered ground the way it actually falls. */
          vec3 c=texture2D(terrainForest,amberUV).rgb*vec3(1.34,.94,.55)*(0.90+macro*0.18);
          c=mix(c,c*vec3(.84,.80,.72),damp*0.55);
          surface=mix(surface,c,amber*0.90);
        }
        if(marsh>0.003){
          /* Standing water in the hollows is what makes a marsh a marsh, so the damp field does
             most of the work here and the slope term keeps it off anything that drains. */
          vec3 c=texture2D(terrainForest,marshUV).rgb*vec3(.72,.86,.66)*(0.76+macro*0.14);
          c=mix(c,c*vec3(.52,.66,.60),damp*0.85);
          surface=mix(surface,c,marsh*0.92*(1.0-smoothstep(0.28,0.60,grade)));
        }
        if(tundra>0.003){
          /* Snow where it can lie, scoured rock where the wind gets at it. */
          vec3 c=mix(snowTex*vec3(.80,.88,1.00),rock*vec3(.95,.97,1.05),0.34+0.46*smoothstep(0.06,0.36,grade+rough*0.3));
          c*=0.78+0.36*(stand*0.6+macro*0.4);
          c=mix(c,c*vec3(.83,.90,1.08),damp*0.75);
          surface=mix(surface,c,tundra*0.88);
        }
        if(ochre>0.003){
          /* A badland cuts itself into bands, and the bands only show where there is a face to
             show them on — hence the slope term on an otherwise purely height-driven stripe. */
          vec3 c=texture2D(terrainSoil,ochreUV).rgb*vec3(1.22,.72,.52)*(0.90+macro*0.16);
          c*=1.0+sin(hgt*2.3+region*6.2)*0.11*smoothstep(0.05,0.30,grade);
          surface=mix(surface,mix(c,rock*vec3(1.18,.80,.62),stone),ochre*0.94);
        }
      }
      diffuseColor.rgb*=surface;
    `);
  };
  function setTrees(trees) { treeList = trees || []; redrawMask(); }
  /* For whoever lays out the tracks. Give it the polylines in world metres — the same shape
     ranch3d.html's PATHS has, [[x,z],[x,z],...] — and the ground under and beside them goes to
     trodden soil. width is the metres of the worn core; the soft shoulder is about three times
     that. Also hung on material.userData so a feature package can reach it without an inline
     change: G.scene.getObjectByName('Pasture terrain').material.userData.setPaths(lines, 2.9). */
  function setPaths(polylines, width = 2.9, strength = 1) {
    pathList = (polylines || []).filter(pl => pl && pl.length > 1).map(pts => ({pts, width, strength}));
    redrawMask();
  }
  material.userData.setPaths = setPaths;
  material.userData.setTrees = setTrees;
  return {material, setTrees, setPaths};
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
