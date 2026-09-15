/* Feature package 'world-atmosphere' — the light, the sky and the weather over Kestrel Basin.
   A full day cycle already existed in ranch3d.html; what it did not have was colour. Noon was
   fine and every other hour was the same flat overcast afternoon with a fog machine going: at
   golden hour the sun sat at seven degrees and the picture still read grey. This package takes
   the grade — key colour, fill colour, sky gradient, fog tint and fog density — and hangs the
   weather that belongs to each quarter off the same clock: cloud shadows drifting over the
   turf, ground mist lying in the hollows and thick over Willowmere at dawn, heat haze shaking
   over Ochre Reach at noon, snow in Frostpine and on Hollowpeak, a skein of birds crossing
   high up, and a night sky with a Milky Way in it.
   Owned by this package: this file. No inline hot spots — everything here reaches the world
   through G.scene and the objects the game already put in it. Nothing runs at import time. */
export const id='world-atmosphere';
export function install(G){
 const {THREE,scene,camera,renderer}=G;
 const W=G.world,H=G.horse;
 const player=H.player, groundH=W.groundH;
 const A={};                                             // this package's live state, exposed as G.atmos for QA
 G.atmos=A;
 const cl=(v,a,b)=>v<a?a:v>b?b:v;
 const sstep=(v,a,b)=>{const t=cl((v-a)/(b-a||1e-6),0,1);return t*t*(3-2*t);};
 const lerp=(a,b,t)=>a+(b-a)*t;
 /* A weight that is 1 inside a circle and falls off through its rim, used for every one of the
    quarters. Distances rather than G.world.regionAt on purpose: six other packages are adding
    regions right now and a weather system should not change behaviour because one of them
    inserted a region ahead of another in the list. */
 const near=(x,z,cx,cz,r)=>1-sstep(Math.hypot(x-cx,z-cz),r*0.52,r*1.04);

 /* ================= 1. the objects the game already built ================= */
 /* Everything this package grades belongs to ranch3d.html, which hands out no references to
    any of it, so they are found in the scene graph once at install. Each is optional: a miss
    must cost its own effect and nothing else. */
 let sun=null,hemi=null,sky=null,oldStars=null,ground=null,valeMist=null;
 scene.traverse(o=>{
  if(o.isDirectionalLight&&o.castShadow&&!sun)sun=o;
  else if(o.isHemisphereLight&&!hemi)hemi=o;
  else if(o.isMesh&&o.material&&o.material.name==='Meadowlark daylight')sky=o;
  else if(o.isPoints&&!oldStars&&o.geometry.attributes.position&&o.geometry.attributes.position.count>600)oldStars=o;
  else if(o.name==='Pasture terrain')ground=o;
  /* The valley mist is an InstancedMesh of 34 soft quads at render order 5. It is the single
     worst thing in the golden-hour picture — opacity 0.30 of flat white laid over the whole
     middle distance — so it is dimmed and warmed below rather than left to make milk. */
  else if(o.isInstancedMesh&&o.renderOrder===5&&o.count===34&&!valeMist)valeMist=o;
 });
 A.found={sun:!!sun,hemi:!!hemi,sky:!!sky,ground:!!ground,mist:!!valeMist};
 const SU=sky&&sky.material&&sky.material.uniforms;

 /* ================= 2. the clock ================= */
 /* ranch3d derives everything from one elevation curve; this reads the same clock so the two
    never disagree about what hour it is. morning separates the two ends of the day, because a
    dawn and a dusk at the same sun height are not the same colour — dawn is rose over cold
    ground, dusk is amber over ground that has been in the sun all day. */
 const K={elev:30,day:1,night:0,low:0,horizon:0,morning:0,dawn:0,dusk:0,t:0};
 function readClock(){
  const d=(G.time.dayT&&G.time.dayT())||0.34;
  const elev=-12+66*(0.5-0.5*Math.cos(d*Math.PI*2));
  K.elev=elev;
  K.day=sstep(elev,-3,15);
  K.night=cl(-elev/9,0,1);
  K.low=cl(1-elev/24,0,1);
  /* A bell around four degrees rather than a triangle: the golden band wants to arrive and
     leave smoothly or the sky visibly steps as the sun crosses it. */
  K.horizon=Math.exp(-Math.pow((elev-4)/10,2));
  K.morning=d<0.5?1:0;
  K.dawn=K.horizon*K.morning;
  K.dusk=K.horizon*(1-K.morning);
  return K;
 }

 /* ================= 3. the palette ================= */
 /* Keyframes by sun elevation. Read them as a photographer's ramp: the disc on the horizon is
    deep orange, six degrees up is the golden hour proper, and by thirty degrees the light is
    white with only a trace of warmth left in it. Two ramps because the morning is cooler. */
 const C=h=>new THREE.Color(h);
 const SUN_DAWN=[[-6,'#7d90bd'],[-1,'#e8794f'],[3,'#ffa477'],[8,'#ffc99b'],[16,'#ffe8cf'],[34,'#fff8ef']];
 const SUN_DUSK=[[-6,'#7d90bd'],[-1,'#ff6a2e'],[3,'#ff8c3e'],[8,'#ffb060'],[16,'#ffdcaf'],[34,'#fff7ec']];
 /* Two horizons, because the two ends of the day are not the same colour. Dawn is rose over
    cold ground and its band is narrow; dusk is amber over ground that has had the sun on it
    all day and runs much further up the sky. Sharing one ramp was why the after-shots of dawn
    and dusk were indistinguishable. */
 const HOR_DAWN=[[-8,'#1c2740'],[-1,'#cf90a0'],[4,'#e7b3ae'],[12,'#cdd6de'],[26,'#b6d1de'],[50,'#aecbdd']];
 const HOR_DUSK=[[-8,'#1c2740'],[-1,'#e09071'],[4,'#eebd93'],[12,'#d2d7cf'],[26,'#b6d1de'],[50,'#aecbdd']];
 const ZEN_DAWN=[[-8,'#0a1024'],[-1,'#334478'],[4,'#42639e'],[14,'#3579ad'],[34,'#2c76b0'],[54,'#2a72ae']];
 const ZEN_DUSK=[[-8,'#0a1024'],[-1,'#2a4d7e'],[4,'#31659c'],[14,'#3178ac'],[34,'#2c76b0'],[54,'#2a72ae']];
 const GLOW_DAWN=[[-4,'#5b4a68'],[0,'#ffa295'],[6,'#ffbda8'],[16,'#e8cdb4']];
 const GLOW_DUSK=[[-4,'#5f3c52'],[0,'#ff7a35'],[6,'#ff9c4e'],[16,'#f0c898']];
 /* Built once. A ramp is walked with two comparisons and one lerp per frame, which is the
    whole point of pre-resolving the hex strings here instead of parsing them in the loop. */
 const bake=r=>r.map(e=>[e[0],C(e[1])]);
 const R_SUN_DAWN=bake(SUN_DAWN),R_SUN_DUSK=bake(SUN_DUSK),R_HOR_DAWN=bake(HOR_DAWN),R_HOR_DUSK=bake(HOR_DUSK),
       R_ZEN_DAWN=bake(ZEN_DAWN),R_ZEN_DUSK=bake(ZEN_DUSK),R_GLOW_DAWN=bake(GLOW_DAWN),R_GLOW_DUSK=bake(GLOW_DUSK);
 function ramp(out,r,e){
  if(e<=r[0][0])return out.copy(r[0][1]);
  for(let i=1;i<r.length;i++)if(e<=r[i][0])return out.copy(r[i-1][1]).lerp(r[i][1],(e-r[i-1][0])/(r[i][0]-r[i-1][0]));
  return out.copy(r[r.length-1][1]);
 }
 const _sun=C('#ffffff'),_sun2=C('#ffffff'),_hor=C('#ffffff'),_zen=C('#ffffff'),
       _glow=C('#ffffff'),_glow2=C('#ffffff'),_fog=C('#ffffff'),_tmp=C('#ffffff');
 /* The fill is the sky, and at the horizon hours the sky AWAY from the sun is still blue —
    that opposition is the whole of what makes a golden-hour photograph look like one. The
    first pass warmed the fill to match the key and the result was a single peach wash with no
    colour left in it, so the sky half of the hemisphere light stays cool and only the ground
    bounce goes warm. */
 const C_HEMI_DAWN=C('#93abd4'),C_HEMI_GOLD=C('#a9bcdc'),C_HEMI_NOON=C('#c3d8ef'),C_HEMI_NIGHT=C('#5a6d95');
 const C_GRND_DAWN=C('#6a6354'),C_GRND_GOLD=C('#9a6f45'),C_GRND_NOON=C('#8d8868'),C_GRND_NIGHT=C('#2e3640');
 const C_NIGHT_TOP=C('#05091a'),C_NIGHT_HOR=C('#19294a'),WHITE=C('#ffffff');

 /* ================= 4. cloud shadows ================= */
 /* The same field is evaluated on the GPU for the pattern on the turf and on the CPU for the
    dimming of the key light, so a patch that darkens the ground under the horse darkens the
    horse too. That is why it is three sines rather than a hash noise: fract(sin(dot(...))*k)
    is a different number in GLSL and in JavaScript — the precision of sin at a large argument
    is not specified — and the two would have drifted apart into a scene that dims while the
    ground beneath it stays bright. */
 const CLOUD_GLSL=`float atmosCloudField(vec2 q){
   return 0.50*sin(q.x*0.0181+q.y*0.0107)
        + 0.33*sin(q.x*-0.0092+q.y*0.0246+2.1)
        + 0.22*sin(q.x*0.0331+q.y*0.0288+4.7)
        + 0.13*sin(q.x*0.0605-q.y*0.0511+1.3);}`;
 const cloudField=(x,z)=>0.50*Math.sin(x*0.0181+z*0.0107)
                        +0.33*Math.sin(x*-0.0092+z*0.0246+2.1)
                        +0.22*Math.sin(x*0.0331+z*0.0288+4.7)
                        +0.13*Math.sin(x*0.0605-z*0.0511+1.3);
 const CLOUD_U={uCloudAmt:{value:0},uCloudOff:{value:new THREE.Vector2()}};
 const cloudShade=(x,z)=>1-0.42*sstep(cloudField(x-CLOUD_U.uCloudOff.value.x,z-CLOUD_U.uCloudOff.value.y),0.14,0.66);
 if(ground&&ground.material){
  const gm=ground.material,prev=gm.onBeforeCompile,prevKey=gm.customProgramCacheKey;
  /* Chained, never replaced: the original compile is what blends four biomes into the turf,
     and a package that overwrote it would silently un-colour half the map. */
  gm.onBeforeCompile=sh=>{
   if(prev)prev.call(gm,sh);
   Object.assign(sh.uniforms,CLOUD_U);
   sh.fragmentShader='uniform float uCloudAmt; uniform vec2 uCloudOff;\n'+CLOUD_GLSL+'\n'+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('diffuseColor.rgb*=surface;',
    `diffuseColor.rgb*=surface;
     diffuseColor.rgb*=1.0-uCloudAmt*smoothstep(0.14,0.66,atmosCloudField(p-uCloudOff));`);
  };
  const patched=gm.onBeforeCompile;
  gm.customProgramCacheKey=()=>(prevKey?prevKey.call(gm):'')+(gm.userData.atmosOff?'':'|atmos-cloudshadow-v1');
  gm.needsUpdate=true;
  /* The one part of this package that is not a mesh, and so cannot be measured by hiding it.
     Being able to put the terrain back on its original program mid-run is how the shader's
     cost gets a number instead of an assurance. QA drives this; nothing in the game does. */
  A.cloudShader=on=>{gm.userData.atmosOff=!on;gm.onBeforeCompile=on?patched:prev;gm.needsUpdate=true;};
 }

 /* ================= 5. ground mist ================= */
 /* Flat quads lying on the ground rather than the billboards the valley mist uses. A billboard
    stands up and reads as smoke; a horizontal sheet seen from the saddle reads as fog lying in
    a field, which is the thing worth having at dawn. Instances that land on high ground are
    scaled to nothing, so the mist fills the hollows by itself without a map of them. */
 const MIST_N=46;   // more and fainter: a handful of strong sheets reads as spilled milk, many weak ones as fog
 const softBlob=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=128;
  const c=cv.getContext('2d'),g=c.createRadialGradient(64,64,4,64,64,63);
  g.addColorStop(0,'rgba(255,255,255,0.95)');g.addColorStop(0.42,'rgba(255,255,255,0.55)');
  g.addColorStop(0.74,'rgba(255,255,255,0.16)');g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g;c.fillRect(0,0,128,128);
  const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;return tx;
 })();
 const mistGeo=new THREE.PlaneGeometry(1,1);mistGeo.rotateX(-Math.PI/2);
 const mistMat=new THREE.MeshBasicMaterial({map:softBlob,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,fog:true});
 /* A sheet with no thickness seen edge-on collapses its whole gradient into one row of pixels
    and draws a hard bright line across the middle distance — the first pass put two of them
    across Willowmere. Fading the sheet out as the eye approaches its own plane is the fix, and
    it is four lines of injected shader rather than a custom material that would have to
    re-implement instancing and fog from scratch. */
 /* Two fades, and the distance one is the important half. A flat sheet a hundred metres out,
    seen from a saddle, projects its whole gradient into a few pixels and draws a hard bright
    line across the middle distance — Willowmere had two of them. Near the rider a ground fog
    sheet reads correctly; far away it never can, so it simply stops, and the fog and the
    valley mist carry the distance instead. */
 mistMat.onBeforeCompile=sh=>{
  sh.vertexShader='varying vec3 vAtmosW;\n'+sh.vertexShader.replace('#include <project_vertex>',
`#include <project_vertex>
#ifdef USE_INSTANCING
 vAtmosW=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
#else
 vAtmosW=(modelMatrix*vec4(transformed,1.0)).xyz;
#endif`);
  sh.fragmentShader='varying vec3 vAtmosW;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',
`#include <opaque_fragment>
 vec3 atmosV=vAtmosW-cameraPosition;
 gl_FragColor.a*=smoothstep(0.05,0.45,abs(normalize(atmosV).y));
 gl_FragColor.a*=1.0-smoothstep(34.0,78.0,length(atmosV));`);
 };
 mistMat.customProgramCacheKey=()=>'atmos-groundmist-v1';
 const mistM=new THREE.InstancedMesh(mistGeo,mistMat,MIST_N);
 mistM.frustumCulled=false;mistM.renderOrder=4;mistM.visible=false;scene.add(mistM);
 const mistP=new Float32Array(MIST_N*5);                  // x, z, radius, phase, ground height
 let mistX=1e9,mistZ=1e9;
 function seatMist(px,pz){
  mistX=px;mistZ=pz;
  for(let i=0;i<MIST_N;i++){
   const a=(i/MIST_N)*Math.PI*2+Math.random()*0.9, rr=9+Math.pow(Math.random(),0.6)*54;   // all inside the distance fade above
   const x=px+Math.cos(a)*rr, z=pz+Math.sin(a)*rr;
   mistP[i*5]=x;mistP[i*5+1]=z;mistP[i*5+2]=16+Math.random()*20;   // a sheet, now that it is one in both axes, needs a fraction of the span a ribbon did
   mistP[i*5+3]=Math.random()*6.28;mistP[i*5+4]=groundH(x,z);
  }
 }

 /* ================= 6. heat haze over Ochre Reach ================= */
 /* Not refraction — a screen-space distortion would want its own full-screen pass and this is
    a browser game on one thread. Overlapping bands of warm air standing on the red rock,
    shivering out of phase with each other, buy most of the read for one draw call. */
 const HAZE_N=18;
 /* A clean linear gradient gave every band a straight top and a straight bottom, and eighteen
    of them stacked up read as ruled lines across the badland rather than as air. Blobs with
    no straight edge anywhere in them is the whole trick. */
 const hazeTex=(()=>{
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;
  const c=cv.getContext('2d');
  for(let i=0;i<26;i++){
   const cx=Math.random()*256, cy=44+Math.random()*26, rr=12+Math.random()*26;
   const g=c.createRadialGradient(cx,cy,0,cx,cy,rr);
   g.addColorStop(0,'rgba(255,224,182,0.42)');g.addColorStop(0.5,'rgba(255,232,198,0.16)');
   g.addColorStop(1,'rgba(255,240,214,0)');
   c.fillStyle=g;c.beginPath();c.arc(cx,cy,rr,0,7);c.fill();
  }
  c.globalCompositeOperation='destination-out';       // feather every edge so the quad never shows
  const e=c.createLinearGradient(0,0,256,0);
  e.addColorStop(0,'rgba(0,0,0,1)');e.addColorStop(0.20,'rgba(0,0,0,0)');
  e.addColorStop(0.80,'rgba(0,0,0,0)');e.addColorStop(1,'rgba(0,0,0,1)');
  c.fillStyle=e;c.fillRect(0,0,256,64);
  const v=c.createLinearGradient(0,0,0,64);
  v.addColorStop(0,'rgba(0,0,0,1)');v.addColorStop(0.30,'rgba(0,0,0,0)');
  v.addColorStop(0.92,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,0.85)');
  c.fillStyle=v;c.fillRect(0,0,256,64);
  const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;return tx;
 })();
 const hazeMat=new THREE.MeshBasicMaterial({map:hazeTex,transparent:true,opacity:0,depthWrite:false,
  blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false});
 const hazeM=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),hazeMat,HAZE_N);
 hazeM.frustumCulled=false;hazeM.renderOrder=6;hazeM.visible=false;scene.add(hazeM);
 const hazeP=new Float32Array(HAZE_N*4);   // fan offset, distance, phase, height scale
 for(let i=0;i<HAZE_N;i++){hazeP[i*4]=(i/HAZE_N-0.5)*1.15+(Math.random()-0.5)*0.12;hazeP[i*4+1]=26+Math.random()*104;
  hazeP[i*4+2]=Math.random()*6.28;hazeP[i*4+3]=0.9+Math.random()*2.4;}

 /* ================= 7. snow ================= */
 /* Points, not quads: a flake needs no orientation and a Points cloud of five hundred is one
    buffer write a frame. It follows the rider and only exists where the ground is white. */
 const SNOW_N=720;
 const flakeTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=32;
  const c=cv.getContext('2d'),g=c.createRadialGradient(16,16,0,16,16,16);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.4,'rgba(248,252,255,0.7)');
  g.addColorStop(1,'rgba(240,248,255,0)');
  c.fillStyle=g;c.fillRect(0,0,32,32);
  const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;return tx;
 })();
 const snowPos=new Float32Array(SNOW_N*3),snowVar=new Float32Array(SNOW_N*3);
 for(let i=0;i<SNOW_N;i++){
  snowPos[i*3]=(Math.random()-0.5)*46;snowPos[i*3+1]=Math.random()*20;snowPos[i*3+2]=(Math.random()-0.5)*46;
  snowVar[i*3]=0.6+Math.random()*1.3;snowVar[i*3+1]=Math.random()*6.28;snowVar[i*3+2]=0.5+Math.random()*0.9;
 }
 const snowGeo=new THREE.BufferGeometry();
 snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
 /* Five hundred flakes spread over a forty-metre cube read as a dusting of specks in the sky;
    the same five hundred packed into a twenty-metre one read as snow falling, because what
    sells snowfall is flakes near the lens crossing the frame fast. */
 const snowM=new THREE.Points(snowGeo,new THREE.PointsMaterial({map:flakeTex,size:0.115,sizeAttenuation:true,
  transparent:true,opacity:0,depthWrite:false,fog:true}));
 snowM.frustumCulled=false;snowM.visible=false;scene.add(snowM);

 /* ================= 8. the skein ================= */
 /* One InstancedMesh and no bones. The flap is a scale on the instance's Y: the wingtips sit
    above the body in the geometry, so squashing the bird vertically drops them and stretching
    it raises them, which at sixty metres up is exactly what a wingbeat looks like. */
 const BIRD_N=22;
 const birdGeo=(()=>{
  const v=[],g=new THREE.BufferGeometry();
  const wing=s=>{ const a=[0,0,0.30],b=[0,0,-0.22],c=[s*1.02,0.27,-0.36],d=[s*0.92,0.25,0.04];
   v.push(...a,...b,...c, ...a,...c,...d); };
  wing(-1);wing(1);
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  return g;
 })();
 const birdM=new THREE.InstancedMesh(birdGeo,new THREE.MeshBasicMaterial({color:0x33332f,side:THREE.DoubleSide,
  transparent:true,opacity:0.85,fog:true}),BIRD_N);
 birdM.frustumCulled=false;birdM.castShadow=false;birdM.receiveShadow=false;scene.add(birdM);
 const flock={x:0,z:0,th:0,r:150,alt:66,drift:0,lx:0,ly:0,lz:0};
 A.flock=flock;                                          // so a screenshot script can aim at the skein
 const birdPh=new Float32Array(BIRD_N);
 for(let i=0;i<BIRD_N;i++)birdPh[i]=Math.random()*6.28;

 /* ================= 9. the night sky ================= */
 /* The game already had eleven hundred identical white dots. Identical is the problem: a real
    sky is mostly faint stars with a handful of bright ones, it has colour in it, and it has a
    band. Two thirds of these are pulled toward a tilted great circle so the band is made of
    stars rather than painted on, and the paint below only fills in between them. */
 const STAR_N=2600;
 const GAX=new THREE.Vector3(0.42,0.80,-0.43).normalize();   // pole of the galactic band
 const starPos=new Float32Array(STAR_N*3),starSize=new Float32Array(STAR_N),
       starCol=new Float32Array(STAR_N*3),starPh=new Float32Array(STAR_N);
 {
  const v=new THREE.Vector3(),perpA=new THREE.Vector3(),perpB=new THREE.Vector3();
  perpA.set(1,0,0).cross(GAX).normalize();perpB.copy(GAX).cross(perpA).normalize();
  const tint=new THREE.Color();
  for(let i=0;i<STAR_N;i++){
   if(i%3){                                   // two in three sit near the band
    const a=Math.random()*Math.PI*2, off=(Math.random()+Math.random()+Math.random()-1.5)*0.30;
    v.copy(perpA).multiplyScalar(Math.cos(a)).addScaledVector(perpB,Math.sin(a)).addScaledVector(GAX,off).normalize();
   }else{
    const a=Math.random()*Math.PI*2,y=Math.random()*2-1,rr=Math.sqrt(1-y*y);
    v.set(Math.cos(a)*rr,y,Math.sin(a)*rr);
   }
   if(v.y<0.02)v.y=0.02+Math.random()*0.10;    // nothing below the horizon: it would show through the terrain's edge
   v.normalize().multiplyScalar(2500);
   starPos[i*3]=v.x;starPos[i*3+1]=v.y;starPos[i*3+2]=v.z;
   /* Magnitudes distributed the way a real sky is — mostly faint, a few that carry it. */
   const m=Math.pow(Math.random(),3.1);
   starSize[i]=0.9+m*4.4;
   starPh[i]=Math.random()*6.28;
   const k=Math.random();
   tint.setHex(k<0.08?0xffd2a0:k<0.20?0xfff0d8:k<0.72?0xf4f7ff:0xcfdcff);
   starCol[i*3]=tint.r;starCol[i*3+1]=tint.g;starCol[i*3+2]=tint.b;
  }
 }
 const starGeo=new THREE.BufferGeometry();
 starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));
 starGeo.setAttribute('aSize',new THREE.BufferAttribute(starSize,1));
 starGeo.setAttribute('aTint',new THREE.BufferAttribute(starCol,3));
 starGeo.setAttribute('aPh',new THREE.BufferAttribute(starPh,1));
 const starMat=new THREE.ShaderMaterial({
  uniforms:{uOp:{value:0},uTime:{value:0},uPix:{value:renderer.getPixelRatio()}},
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false,
  vertexShader:`attribute float aSize; attribute vec3 aTint; attribute float aPh;
   uniform float uOp,uTime,uPix; varying vec3 vT; varying float vA;
   void main(){ vT=aTint;
    /* Scintillation, not a blink: the faint ones swim and the bright ones barely move. */
    float tw=0.80+0.20*sin(uTime*(1.3+fract(aPh)*2.2)+aPh*7.0);
    vA=uOp*tw*(0.40+0.60*smoothstep(0.9,4.0,aSize));
    gl_PointSize=aSize*uPix;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`varying vec3 vT; varying float vA;
   void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d);
    if(r>0.25)discard;
    gl_FragColor=vec4(vT,vA*(1.0-smoothstep(0.04,0.25,r))); }`
 });
 const starM=new THREE.Points(starGeo,starMat);
 starM.frustumCulled=false;starM.visible=false;starM.renderOrder=-2;scene.add(starM);
 /* The band itself: one inverted sphere whose only job is to put a faint mottled glow between
    the stars that are already there. Drawn only when the sun is down. */
 const wayMat=new THREE.ShaderMaterial({
  uniforms:{uOp:{value:0},uAxis:{value:GAX.clone()}},
  side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false,
  vertexShader:`varying vec3 vD; void main(){vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec3 vD; uniform float uOp; uniform vec3 uAxis;
   float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
   void main(){ vec3 d=normalize(vD);
    /* Mottle FIRST and perturb the angle with it, then take the band. Multiplying the noise
       in afterwards left the cone's own boundary visible as a straight edge across the sky,
       which read as the leading edge of a cloud bank rather than as a galaxy. */
    float m=n(d.xz*11.0)*0.44+n(d.xy*23.0)*0.30+n(d.yz*47.0)*0.18+n(d.xz*97.0)*0.08;
    float b=abs(dot(d,uAxis))+(m-0.5)*0.13;
    float band=smoothstep(0.26,0.0,b);
    band*=band;                                   /* squared: a core with a long faint skirt */
    band*=0.30+1.10*m;
    band*=1.0-0.60*smoothstep(0.055,0.0,abs(dot(d,uAxis)))*smoothstep(0.34,0.72,n(d.xz*5.0+11.0));
    band*=smoothstep(-0.02,0.30,d.y);
    vec3 col=mix(vec3(0.58,0.66,0.92),vec3(1.0,0.93,0.80),smoothstep(0.45,0.95,m));
    gl_FragColor=vec4(col,band*uOp); }`
 });
 const wayM=new THREE.Mesh(new THREE.SphereGeometry(2450,28,18),wayMat);
 wayM.frustumCulled=false;wayM.visible=false;wayM.renderOrder=-3;scene.add(wayM);
 /* A shooting star every minute or so. Almost always invisible, which is the point of it. */
 const shootTex=(()=>{
  const cv=document.createElement('canvas');cv.width=128;cv.height=8;
  const c=cv.getContext('2d'),g=c.createLinearGradient(0,0,128,0);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.72,'rgba(230,240,255,0.55)');
  g.addColorStop(0.96,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g;c.fillRect(0,0,128,8);
  const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;return tx;
 })();
 const shootM=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shootTex,
  transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,side:THREE.DoubleSide}));
 shootM.frustumCulled=false;shootM.visible=false;shootM.renderOrder=-1;scene.add(shootM);
 const shoot={wait:14+Math.random()*40,t:-1,a:0,b:0,arc:0};

 /* ================= 10. per-frame: the things that move ================= */
 const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_v=new THREE.Vector3(),_s=new THREE.Vector3(),
       _e=new THREE.Euler(),_up=new THREE.Vector3(0,1,0);
 A.dt=0.016;A.cloud=1;A.rain=0;A.t=0;
 const REG={marsh:0,snow:0,badland:0,amber:0};
 /* One size for the old star field, set once. It was competing with the new one at its own
    size and the sky read as two grids laid over each other. */
 if(oldStars)oldStars.material.size=0.9;
 G.on('tick',(dt,t)=>{
  A.dt=dt;A.t=t;
  readClock();
  const px=player.pos.x,pz=player.pos.z;
  /* Where the rider is, as four soft weights. Hollowpeak counts as snow country too — it has
     been white since long before Frostpine opened and never had weather over it. */
  REG.marsh=near(px,pz,310,300,120);
  REG.snow=Math.max(near(px,pz,-300,-320,125),near(px,pz,-160,-210,120));
  REG.badland=Math.max(near(px,pz,-330,300,125),near(px,pz,-220,130,120));
  REG.amber=near(px,pz,300,-300,130);
  A.reg=REG;
  const rain=(window._weather&&window._weather.mode==='rain')?1:0;
  A.rain=rain;

  /* -- cloud shadows drift downwind, and stop existing when there is no sun to cast them -- */
  CLOUD_U.uCloudOff.value.x+=dt*3.1;CLOUD_U.uCloudOff.value.y+=dt*1.15;
  const cover=cl(0.30+0.55*K.day,0,1)*(1-rain*0.75)*(1-K.night);
  CLOUD_U.uCloudAmt.value+=(cover*0.40-CLOUD_U.uCloudAmt.value)*Math.min(1,dt*0.9);
  A.cloud=cloudShade(px,pz);

  /* -- ground mist -- */
  const mistOp=cl((0.30*K.dawn+0.13*K.dusk+0.05*K.night)*(1-rain*0.5)
   +REG.marsh*(0.16+0.34*K.dawn+0.14*K.dusk)*(1-K.day*0.45)
   +REG.snow*0.10*(1-K.day*0.4),0,0.52);
  mistM.visible=mistOp>0.012;
  mistMat.opacity=mistOp*0.62;
  if(mistM.visible){
   if(Math.hypot(px-mistX,pz-mistZ)>18)seatMist(px,pz);
   for(let i=0;i<MIST_N;i++){
    const o=i*5,gy=mistP[o+4],ph=mistP[o+3];
    /* Thicker the lower the ground is: the mist finds the hollows without being told where
       they are, and a sheet that lands on a ridge shrinks to nothing instead of floating. */
    const low=cl((6.5-gy)/10,0,1)*0.8+0.2+REG.marsh*0.5;
    const rr=mistP[o+2]*low*(0.86+0.14*Math.sin(t*0.21+ph));
    /* X and Z, not X and Y. The rotation into the ground plane is baked into the geometry, so
       by the time the instance matrix is applied the quad has no Y extent left to scale: the
       obvious (rr,rr,1) gave every sheet a width of forty metres and a depth of one, and what
       lay over Willowmere was a set of bright white ribbons rather than fog. */
    _s.set(rr,1,rr);
    _e.set(0,ph+t*0.012,0);_q.setFromEuler(_e);
    _v.set(mistP[o]+Math.sin(t*0.08+ph)*4.0,gy+0.45+0.5*Math.sin(t*0.13+ph*2),mistP[o+1]+Math.cos(t*0.06+ph)*3.0);
    _m.compose(_v,_q,_s);mistM.setMatrixAt(i,_m);
   }
   mistM.instanceMatrix.needsUpdate=true;
  }
  /* -- heat haze -- */
  const hazeAmt=REG.badland*sstep(K.elev,22,44)*(1-rain);
  hazeM.visible=hazeAmt>0.02;
  hazeMat.opacity=hazeAmt*0.58;
  if(hazeM.visible){
   const cp=camera.position;
   /* Spread across the view rather than round a full ring. A ring of eighteen puts two or
      three in a 52-degree frame and the badland got one lonely smudge; a fan in front puts
      all of them where they can overlap, which is what makes the air look like it is moving. */
   camera.getWorldDirection(_v);
   const fwd=Math.atan2(_v.x,_v.z);
   for(let i=0;i<HAZE_N;i++){
    const o=i*4,a=fwd+hazeP[o]+Math.sin(t*0.05+hazeP[o+2])*0.04,
          d=hazeP[o+1],ph=hazeP[o+2],sc=hazeP[o+3];
    const x=cp.x+Math.sin(a)*d,z=cp.z+Math.cos(a)*d;
    const gy=groundH(x,z);
    /* Each band shivers on its own clock, and the vertical stretch is what sells it: the air
       column above hot rock is taller one instant and shorter the next. */
    const wob=Math.sin(t*(2.4+sc)+ph),wob2=Math.sin(t*(3.7+sc*0.6)+ph*2.1);
    _s.set(d*0.62*(1+wob2*0.07),sc*(1.5+wob*0.46),1);
    _q.setFromAxisAngle(_up,a+Math.PI);      // turn the band's face back down the fan at the camera
    _v.set(x,gy+_s.y*0.42+wob*0.14,z);
    _m.compose(_v,_q,_s);hazeM.setMatrixAt(i,_m);
   }
   hazeM.instanceMatrix.needsUpdate=true;
  }

  /* -- snow -- */
  const snowAmt=REG.snow*(1-rain*0.6);
  snowM.visible=snowAmt>0.03;
  snowM.material.opacity=snowAmt*(0.55+0.35*K.day);
  if(snowM.visible){
   const cp=camera.position,arr=snowGeo.attributes.position.array;
   for(let i=0;i<SNOW_N;i++){
    const o=i*3;
    arr[o+1]-=dt*snowVar[o]*1.7;
    arr[o]+=dt*Math.sin(t*0.7+snowVar[o+1])*snowVar[o+2];
    arr[o+2]+=dt*Math.cos(t*0.5+snowVar[o+1])*snowVar[o+2]*0.8;
    /* Respawn in a column over the camera rather than the rider: what the player sees is
       flakes near the lens, and following the rider leaves a hole when the camera swings. */
    if(arr[o+1]<cp.y-7||Math.abs(arr[o]-cp.x)>13||Math.abs(arr[o+2]-cp.z)>13){
     arr[o]=cp.x+(Math.random()-0.5)*24;
     arr[o+1]=cp.y+2+Math.random()*11;
     arr[o+2]=cp.z+(Math.random()-0.5)*24;
    }
   }
   snowGeo.attributes.position.needsUpdate=true;
  }

  /* -- the skein -- */
  const birdAmt=cl(1-K.night*1.6,0,1);
  birdM.visible=birdAmt>0.08;
  birdM.material.opacity=0.85*birdAmt;
  if(birdM.visible){
   /* The flock wanders on its own and is only nudged toward the rider when it would otherwise
      leave the basin behind — birds that orbit the player look like a hat, not like birds. */
   if(Math.hypot(flock.x-px,flock.z-pz)>230){flock.x+=(px-flock.x)*0.02;flock.z+=(pz-flock.z)*0.02;}
   flock.drift+=dt*0.031;
   flock.th+=dt*0.045;
   const cx=flock.x+Math.sin(flock.drift)*46, cz=flock.z+Math.cos(flock.drift*0.77)*46;
   const lx=cx+Math.cos(flock.th)*flock.r, lz=cz+Math.sin(flock.th)*flock.r;
   const head=flock.th+Math.PI/2;
   const fx=Math.cos(head),fz=Math.sin(head),rx=-fz,rz=fx;
   const alt=groundH(lx,lz)+flock.alt;
   flock.lx=lx;flock.ly=alt;flock.lz=lz;
   for(let i=0;i<BIRD_N;i++){
    const rank=Math.floor(i/2)+1, side=(i%2)?1:-1;
    const back=rank*5.2, out=rank*3.1*side;
    const ph=birdPh[i];
    /* A skein is ragged: every bird lags its own amount and rides its own slow bob, so the
       V wavers instead of holding a formation drawn with a ruler. */
    const jitter=Math.sin(t*0.37+ph)*1.9;
    const x=lx-fx*(back+jitter)+rx*(out+Math.cos(t*0.29+ph)*1.4);
    const z=lz-fz*(back+jitter)+rz*(out+Math.cos(t*0.29+ph)*1.4);
    const y=alt+Math.sin(t*0.51+ph)*2.2-rank*0.35;
    const flap=0.42+0.86*(0.5+0.5*Math.sin(t*6.4+ph*3.0));
    _s.set(1.35,1.35*flap,1.35);
    _e.set(0,-head+Math.sin(t*0.24+ph)*0.11,0);_q.setFromEuler(_e);
    _v.set(x,y,z);
    _m.compose(_v,_q,_s);birdM.setMatrixAt(i,_m);
   }
   birdM.instanceMatrix.needsUpdate=true;
  }

  /* -- the night sky -- */
  const nightSky=cl(K.night*1.25,0,1)*(1-rain*0.8);
  A.nightSky=nightSky;
  starM.visible=nightSky>0.02;starM.material.uniforms.uOp.value=nightSky;
  starM.material.uniforms.uTime.value=t;
  starM.material.uniforms.uPix.value=renderer.getPixelRatio();   // the quality picker changes it under us
  if(starM.visible)starM.position.copy(camera.position);
  /* 0.15, not the 0.52 this started at: additive over a sky this dark, half opacity was a
     white wedge you could not look past. It should be something you notice on the second
     glance, not the brightest thing in the frame. */
  wayM.visible=nightSky>0.05;wayMat.uniforms.uOp.value=nightSky*0.15;
  if(wayM.visible)wayM.position.copy(camera.position);
  if(shoot.t>=0){
   shoot.t+=dt;
   const k=shoot.t/0.85;
   if(k>=1){shoot.t=-1;shootM.visible=false;}
   else{
    const a=shoot.a+ (shoot.b-shoot.a)*k;
    const el=0.62-k*0.34;
    _v.set(Math.cos(a)*Math.cos(el),Math.sin(el),Math.sin(a)*Math.cos(el)).multiplyScalar(2100).add(camera.position);
    shootM.position.copy(_v);
    shootM.lookAt(camera.position);
    shootM.rotateZ(shoot.arc);
    shootM.scale.set(230,11,1);
    shootM.material.opacity=nightSky*Math.sin(k*Math.PI)*0.95;
   }
  }else if(nightSky>0.5){
   shoot.wait-=dt;
   if(shoot.wait<=0){
    shoot.wait=26+Math.random()*64;
    shoot.a=Math.random()*Math.PI*2;shoot.b=shoot.a+(Math.random()-0.5)*0.8;
    shoot.arc=(Math.random()-0.5)*1.4;shoot.t=0;shootM.visible=true;
   }
  }
 });

 /* ================= 11. the grade ================= */
 /* This has to run after ranch3d's own day-cycle block, which writes the sun colour, the hemi
    colours, the sky uniforms and the fog outright every frame — and that block runs a couple
    of hundred lines AFTER G.run('tick'). scene.onBeforeRender is the one callback left: the
    renderer fires it on the scene object immediately before it draws, so whatever is written
    here is what actually reaches the frame. */
 const SHADOW_LOW=74,SHADOW_HIGH=44;
 let shadowSpan=SHADOW_HIGH;
 /* Every smoothed value is smoothed in a variable this package owns and then written to the
    light outright. Lerping the light itself would fight ranch3d's own lerp toward its own
    target, and the two together settle somewhere between the two palettes — most of this
    grade would simply never arrive. */
 const SM={key:2.6,fill:1.1,fogD:0.00125,vale:1};
 const _fogSm=C('#b8d8e9');
 const prevOBR=scene.onBeforeRender;
 scene.onBeforeRender=function(){
  if(prevOBR)prevOBR.apply(this,arguments);
  readClock();
  const e=K.elev,rain=A.rain||0,dt=Math.min(0.05,A.dt||0.016);
  const pm=1-K.morning;
  ramp(_sun ,R_SUN_DAWN,e);ramp(_sun2,R_SUN_DUSK,e);_sun.lerp(_sun2,pm);
  ramp(_hor ,R_HOR_DAWN,e);ramp(_tmp ,R_HOR_DUSK,e);_hor.lerp(_tmp,pm);
  ramp(_zen ,R_ZEN_DAWN,e);ramp(_tmp ,R_ZEN_DUSK,e);_zen.lerp(_tmp,pm);
  ramp(_glow,R_GLOW_DAWN,e);ramp(_glow2,R_GLOW_DUSK,e);_glow.lerp(_glow2,pm);

  /* -- key light. The old grade gave golden hour a key of 1.9 against a fill of 1.0, which is
     why a seven-degree sun produced a picture with no shadows in it. The ratio is the whole
     effect: push the key at the horizon hours and pull the fill down to meet it. -- */
  if(sun){
   const keyDay=lerp(2.55,3.00,sstep(e,10,40));
   const key=(rain?1.25:lerp(keyDay,3.85,K.horizon))*(1-K.night*0.72)+0.80*K.night;
   SM.key+=(key-SM.key)*Math.min(1,dt*3.5);
   sun.intensity=SM.key*(0.74+0.26*(A.cloud||1));   // a cloud passing over dims the world, not only the turf
   sun.color.copy(_sun);
   /* Long shadows need somewhere to land. The ortho box is 44 half-metres wide, which a fence
      post overshoots before the sun is down to ten degrees, and the shadow was simply cut
      off. Widen it as the sun drops and take the softer texel back — at that hour the
      shadows are long and soft anyway. */
   const span=lerp(SHADOW_HIGH,SHADOW_LOW,K.low);
   if(Math.abs(span-shadowSpan)>3){
    shadowSpan=span;
    const c=sun.shadow.camera;
    c.left=-span;c.right=span;c.top=span;c.bottom=-span;c.updateProjectionMatrix();
    sun.shadow.normalBias=0.018*(span/SHADOW_HIGH);
   }
  }
  /* -- fill. Warm at dusk, cold at dawn, and never the same grey it used to be. -- */
  if(hemi){
   const h=K.horizon;
   _tmp.copy(C_HEMI_NOON).lerp(C_HEMI_GOLD,h*pm).lerp(C_HEMI_DAWN,h*K.morning);
   hemi.color.copy(C_HEMI_NIGHT).lerp(_tmp,K.day);
   _tmp.copy(C_GRND_NOON).lerp(C_GRND_GOLD,h*pm).lerp(C_GRND_DAWN,h*K.morning);
   hemi.groundColor.copy(C_GRND_NIGHT).lerp(_tmp,K.day);
   /* The floor matters more than it looks: below about 0.7 the near grass at dawn goes to a
      murky olive and the whole quarter reads as underexposed rather than as early. */
   const fill=rain?1.05:lerp(1.22,0.66,K.horizon)*K.day+0.78*(1-K.day);
   SM.fill+=(fill-SM.fill)*Math.min(1,dt*3.5);
   hemi.intensity=SM.fill;
  }
  /* The valley mist ranch3d already had is the loudest thing in the golden-hour frame: flat
     white at opacity 0.30, laid across the whole middle distance. Its own tick writes that
     opacity a couple of hundred lines above here, so this is the only place the number can be
     taken back. Cut it hard and let the hour tint it, so it warms with everything else. */
  if(valeMist){
   valeMist.material.opacity*=0.38;
   valeMist.material.color.copy(_hor).lerp(_glow,K.horizon*0.55).lerp(WHITE,0.28);
  }
  /* -- sky. The shader mixes its dusk colour in by the golden uniform and only near the
     horizon, so both the colour and the amount are ours to set; the built-in value is a
     narrow triangle that barely opens. -- */
  if(SU){
   SU.zenith.value.copy(_zen);
   SU.horizon.value.copy(_hor);
   SU.dusk.value.copy(_glow);
   SU.golden.value=Math.max(SU.golden.value,K.horizon*(0.55+0.45*(1-K.morning)));
   SU.darkTop.value.copy(C_NIGHT_TOP);
   SU.darkHorizon.value.copy(C_NIGHT_HOR);
  }
  /* -- fog. It has two jobs and the old one only did the first: it has to be the colour the
     sky is at the horizon, or the hills sit on the sky like cut paper, and it has to be thin
     enough at noon that distance still reads as distance. Pulling it a fifth of the way
     toward the zenith is the aerial perspective — far things go blue, not merely pale. -- */
  if(scene.fog){
   _fog.copy(_hor).lerp(_zen,0.24);
   if(K.horizon>0.02)_fog.lerp(_glow,K.horizon*0.34);
   const lum=lerp(0.13,1.0,sstep(e,-6,8));
   _fog.multiplyScalar(lum*(rain?0.80:1));
   if(REG.snow>0.02)_fog.lerp(_tmp.setHex(0xdfe8f0).multiplyScalar(lum),REG.snow*0.45);
   _fogSm.lerp(_fog,Math.min(1,dt*2.2));      // so a shower arriving is a change in weather, not a cut
   scene.fog.color.copy(_fogSm);
   /* Trimmed from the first pass: at 0.00105 of extra haze the golden-hour ridges dissolved
      into the glow behind them and the basin lost its depth at exactly the hour it should
      have the most. Enough haze to separate the ridges, not enough to eat them. */
   let d=rain?0.0052:0.00092+0.00062*K.horizon+0.00060*K.dawn+0.00045*K.night;
   d+=REG.marsh*0.00110*(1-K.day*0.4)+REG.snow*0.00075+REG.amber*0.00030-REG.badland*0.00022;
   SM.fogD+=(Math.max(0.0006,d)-SM.fogD)*Math.min(1,dt*1.1);
   /* Not in VR. ranch3d pulls the fog right in to 0.0075 on entering VR (ranch3d.html:2359) so
      that far less world is drawn for two eyes on a headset, and restores whatever it found on
      the way out. Writing our density here every frame would quietly undo that clamp on the one
      platform that can least afford it — a fifth of the fog and the whole basin drawn twice. The
      colour above still applies, because tinting the fog costs nothing; only the distance is left
      to the game. */
   if(!(renderer.xr&&renderer.xr.isPresenting))scene.fog.density=SM.fogD;
  }
 };

 /* QA and anything else that wants to know what the weather is doing. */
 G.on('state',o=>{o.atmos={elev:+K.elev.toFixed(1),day:+K.day.toFixed(2),night:+K.night.toFixed(2),
  horizon:+K.horizon.toFixed(2),cloud:+(A.cloud||1).toFixed(2),fogD:scene.fog?+scene.fog.density.toFixed(5):0,
  mist:+mistMat.opacity.toFixed(3),snow:snowM.visible,haze:hazeM.visible,birds:birdM.visible,stars:starM.visible};});
}
