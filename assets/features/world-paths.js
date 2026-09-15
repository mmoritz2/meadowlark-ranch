/* Feature package 'world-paths' — the ground between places.

   The basin already had six worn tracks baked into ranch3d.html, and every one of them stops at
   the old fence line. Past that the four new quarters are reached by pointing the horse at the
   horizon and riding for two minutes across grass that never changes, which is the difference
   between a world and a field. This package lays the roads that were missing — Barleyfold out to
   Amberwood, the river bridge west to Coyote Canyon and on to Ochre Reach, the pines up over the
   shoulder to Hollowpeak and down to Frostpine, and the north meadow out to Willowmere — and then
   dresses them the way a road is actually dressed: fingerposts where they fork, hedges and dry
   stone and post-and-rail where the farmland starts, gates you can ride through, a ford where the
   Barleyfold road has been crossing Sparrow Creek all this time with nothing to show for it, and
   the small evidence of other people — a woodpile, a trough, a cart nobody came back for.

   Everything that repeats is instanced. The whole road surface, all eleven hundred metres of it,
   is one BufferGeometry and one draw call; every post, rail, stone, log, wheel and cobble in the
   package shares three InstancedMeshes between them. Nothing here allocates after install.

   Owned by this package: this file only. Nothing runs at import time. */
export const id='world-paths';
export function install(G){
 const {THREE,scene}=G;
 const W=G.world, T=G.tables, S=G.save, H=G.horse, toast=G.toast;
 const gh=W.groundH, riverZ=W.riverZ, streamX=W.streamX;
 const P={}; G.worldPaths=P;                                  // this package's live state, for QA
 const hyp=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
 const sstep=(x,a,b)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 /* One deterministic hash for every scatter decision in the file, so two boots of the same world
    put the same cart in the same place and a screenshot can be compared with yesterday's. */
 const hash01=(a,b)=>{const s=Math.sin(a*127.1+b*311.7+17.3)*43758.5453;return s-Math.floor(s);};

 /* ================= 1. the roads themselves =================
    Coarse waypoints only. The line that gets built is the one that comes back out of the
    relaxation below, which is why these read as intent rather than survey. Each road stops sixty
    metres short of its quarter's centre: the quarter's own package owns what stands in the middle
    of it, and a road that drove straight into somebody else's market square would be the seventh
    time this codebase has had two packages claim one patch of ground. */
 const ROADS=[
  {id:'barley',name:'Barley Road',to:'AMBERWOOD',w:2.85,
   pts:[[223,-150],[231,-170],[238,-192],[247,-214],[257,-234],[268,-248]]},
  {id:'riverwest',name:'River Road West',to:'COYOTE CANYON',w:2.85,
   pts:[[0,132],[-28,135],[-60,131],[-95,125],[-130,120],[-165,120],[-197,126],[-219,133]]},
  {id:'ochre',name:'Ochre Trail',to:'OCHRE REACH',w:2.35,
   pts:[[-222,140],[-243,162],[-257,190],[-267,218],[-274,244],[-280,262]]},
  {id:'highfell',name:'Highfell Road',to:'HOLLOWPEAK',w:2.6,
   pts:[[-31,-61],[-52,-80],[-74,-104],[-97,-130],[-120,-156],[-141,-182],[-155,-201]]},
  {id:'frostpine',name:'Frostpine Track',to:'FROSTPINE',w:2.25,
   pts:[[-160,-215],[-187,-236],[-214,-253],[-238,-268],[-256,-278]]},
  {id:'marsh',name:'Marsh Road',to:'WILLOWMERE',w:2.7,
   pts:[[83,184],[116,196],[150,211],[184,227],[216,243],[243,256],[258,264]]},
 ];

 /* ---- resample, then let the line find its own way across the country ----
    A cart track goes round the hill, not over it, and round the boulder rather than through it.
    Each interior sample looks a few metres to either side and moves toward whichever offset makes
    the climb between its neighbours gentler; then the whole line is smoothed, because a track that
    contours perfectly is a staircase and no horse can gallop down a staircase. Drift from the
    surveyed line is capped so a road cannot wander off and miss the town it was going to. */
 const STEP=2.6, DRIFT=15;
 function resample(pts,step){
  const out=[];
  const at=i=>pts[Math.max(0,Math.min(pts.length-1,i))];
  for(let i=0;i<pts.length-1;i++){
   const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);
   const seg=Math.max(1,Math.round(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/step));
   for(let k=0;k<seg;k++){
    const t=k/seg,t2=t*t,t3=t2*t;
    out.push([0,1].map(c=>0.5*((2*p1[c])+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t3)));
   }
  }
  out.push(pts[pts.length-1].slice());
  return out;
 }
 function smooth(pts,k){
  for(let i=1;i<pts.length-1;i++)for(const c of [0,1])
   pts[i][c]+=((pts[i-1][c]+pts[i+1][c])*0.5-pts[i][c])*k;
 }
 function contour(pts,home){
  for(let i=1;i<pts.length-1;i++){
   const a=pts[i-1],b=pts[i],c=pts[i+1];
   let tx=c[0]-a[0],tz=c[1]-a[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
   const nx=-tz,nz=tx;
   let bestF=0,bestC=1e9;
   for(const f of [-5,-2.5,0,2.5,5]){
    const x=b[0]+nx*f,z=b[1]+nz*f;
    const cost=Math.abs(gh(x,z)-gh(a[0],a[1]))+Math.abs(gh(c[0],c[1])-gh(x,z))+Math.abs(f)*0.10;
    if(cost<bestC){bestC=cost;bestF=f;}
   }
   b[0]+=nx*bestF*0.45; b[1]+=nz*bestF*0.45;
   const dx=b[0]-home[i][0],dz=b[1]-home[i][1],d=Math.hypot(dx,dz);
   if(d>DRIFT){b[0]=home[i][0]+dx/d*DRIFT;b[1]=home[i][1]+dz/d*DRIFT;}
  }
 }
 /* The mesas of Coyote Canyon and the trees of the pines were placed long before this package
    existed, so the road asks them where they are rather than assuming empty ground. Endpoints are
    allowed to shuffle too — a junction that lands inside a pine helps nobody — but only far enough
    to get clear, never far enough to stop meeting the road it was supposed to meet. */
 function avoid(pts,home,margin,pinMax){
  for(let pass=0;pass<4;pass++){
   let moved=0;
   for(let i=0;i<pts.length;i++){
    const pin=(i===0||i===pts.length-1)?3.5:(pinMax||DRIFT);
    for(const c of W.colliders){
     if(c.decor||c.r<0.3)continue;
     const dx=pts[i][0]-c.x,dz=pts[i][1]-c.z; let d=Math.hypot(dx,dz);
     const need=c.r+margin;
     if(d>=need)continue;
     if(d<0.01){pts[i][0]=c.x+need;continue;}
     pts[i][0]=c.x+dx/d*need; pts[i][1]=c.z+dz/d*need; moved++;
    }
    const ddx=pts[i][0]-home[i][0],ddz=pts[i][1]-home[i][1],dd=Math.hypot(ddx,ddz);
    if(dd>pin){pts[i][0]=home[i][0]+ddx/dd*pin;pts[i][1]=home[i][1]+ddz/dd*pin;}
   }
   if(!moved)break;
  }
 }
 /* Water is not an obstacle a road detours around by accident; it is crossed on purpose or kept
    away from entirely. None of these six roads is meant to ford anything, so all six stay out of
    the channel, and the one real crossing in the package is built by hand further down. */
 function dryLand(pts){
  for(const p of pts){
   const d=p[1]-riverZ(p[0]);
   if(Math.abs(d)<11)p[1]=riverZ(p[0])+(d<0?-11:11);
   const dl=hyp(p[0],p[1],20,16); if(dl<13){const a=Math.atan2(p[1]-16,p[0]-20);p[0]=20+Math.cos(a)*13;p[1]=16+Math.sin(a)*13;}
   const rr=Math.hypot(p[0],p[1]); if(rr>440){p[0]*=440/rr;p[1]*=440/rr;}
  }
 }
 const TRACKS=[];
 for(const rd of ROADS){
  const pts=resample(rd.pts,STEP);
  const home=pts.map(p=>p.slice());
  for(let k=0;k<3;k++){contour(pts,home);smooth(pts,0.36);}
  /* Three rounds, each allowed to wander further than the last. A mesa in Coyote Canyon can carry
     a twenty-metre collider, and the first pass — capped at the same drift the contouring uses —
     could not get the road clear of one. The last pass is allowed thirty metres and runs after the
     water and basin clamps, because those can shove a sample back into whatever it just escaped. */
  avoid(pts,home,3.2,DRIFT); smooth(pts,0.22); avoid(pts,home,3.0,26); dryLand(pts); avoid(pts,home,2.8,30);
  let len=0; const run=[0];
  for(let i=1;i<pts.length;i++){len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);run.push(len);}
  TRACKS.push(Object.assign({},rd,{pts,run,len}));
 }
 P.tracks=TRACKS; P.metres=Math.round(TRACKS.reduce((a,t)=>a+t.len,0));
 /* Anything solid close enough to crowd a rider on the centre line. The game itself pushes at
    c.r + 0.55, so this asks for six tenths of a metre more than it has to and reports "tight"
    rather than "impassable" — which is the number worth watching, because tight is where a rider
    at a gallop clips something they never saw. Measured twice: once here, where every hit is an
    obstacle that was in the basin before this package existed and that the relaxation could not
    get clear of, and once at the end of install, where a new hit is this package's own fault. */
 const tight=()=>{
  const out=[];
  for(const tr of TRACKS)for(let i=0;i<tr.pts.length;i+=2){
   const p=tr.pts[i];
   for(const c of W.colliders){
    if(c.decor||c.r<0.3)continue;
    if(hyp(p[0],p[1],c.x,c.z)<c.r+1.15)out.push({road:tr.id,x:Math.round(p[0]),z:Math.round(p[1]),r:Math.round(c.r*10)/10});
   }
  }
  return out;
 };
 P.preExistingTight=tight();

 /* A coarse bucket grid so anything else in the package — and any package that comes later — can
    ask "am I standing on a road" without walking eleven hundred metres of samples to find out. */
 const CELL=24, GRID=new Map();
 const key=(i,j)=>i*10007+j;
 TRACKS.forEach((tr,ti)=>tr.pts.forEach((p,pi)=>{
  const i=Math.floor(p[0]/CELL),j=Math.floor(p[1]/CELL);
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
   const k=key(i+di,j+dj); let a=GRID.get(k); if(!a)GRID.set(k,a=[]); a.push([ti,pi]);
  }
 }));
 function trackDist(x,z){
  const a=GRID.get(key(Math.floor(x/CELL),Math.floor(z/CELL)));
  if(!a)return 1e9;
  let best=1e9;
  for(const [ti,pi] of a){const p=TRACKS[ti].pts[pi];const d=(p[0]-x)*(p[0]-x)+(p[1]-z)*(p[1]-z);if(d<best)best=d;}
  return Math.sqrt(best);
 }
 P.trackDist=trackDist;
 /* Off-road for this package means off MY roads and off the six the game already had, because a
    bench dropped in the middle of the Cottonwood track would be exactly as annoying either way. */
 const onAnyRoad=(x,z,m)=>trackDist(x,z)<m||W.pathDist(x,z)<m;

 /* ================= 2. the road surface =================
    One texture, drawn once: dry earth with two darker wheel ruts, a strip of grass surviving down
    the middle where no hoof falls, a wandering edge and an alpha that fades to nothing at the
    verge so the track dissolves into the meadow instead of ending at a ruled line. */
 const TW=256,TH=128;
 function lattice(L){                                          // wraps in u so the road has no seam
  const rows=Math.ceil(TH/(TW/L))+2, a=new Float32Array(L*rows);
  for(let j=0;j<rows;j++)for(let i=0;i<L;i++)a[j*L+i]=hash01(i*3.1+L*7.7,j*5.3+L*2.9);
  return {a,L,rows,cs:TW/L};
 }
 const LAT=[lattice(6),lattice(20),lattice(64)];
 function vn(n,i,j){
  const x=i/n.cs,y=j/n.cs,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),L=n.L;
  const g=(a,b)=>n.a[Math.min(n.rows-1,b)*L+(((a%L)+L)%L)];
  const p=g(ix,iy),q=g(ix+1,iy),r=g(ix,iy+1),s=g(ix+1,iy+1);
  return p+(q-p)*sx+(r-p)*sy+(p-q-r+s)*sx*sy;
 }
 const roadTex=(()=>{
  const c=document.createElement('canvas');c.width=TW;c.height=TH;
  const ctx=c.getContext('2d'),img=ctx.createImageData(TW,TH),d=img.data;
  for(let j=0;j<TH;j++){
   const fy=j/(TH-1), across=Math.abs(fy*2-1);
   for(let i=0;i<TW;i++){
    const blot=vn(LAT[0],i,j), grain=vn(LAT[1],i,j), fine=vn(LAT[2],i,j);
    const edge=0.74+0.20*vn(LAT[0],i,4);                       // the verge wanders down the road
    let a=1-sstep(across,edge-0.34,edge+0.05);
    a*=0.66+0.40*blot;
    const rut=Math.max(Math.exp(-Math.pow((fy-0.325)/0.085,2)),Math.exp(-Math.pow((fy-0.675)/0.085,2)))
             *(0.5+0.55*vn(LAT[1],i,2));
    const med=Math.exp(-Math.pow((fy-0.5)/0.070,2))*sstep(vn(LAT[0],i,9),0.42,0.78);
    let L=0.58+0.26*grain+0.20*blot+0.10*fine;
    L*=1-rut*0.34;                                             // the ruts hold the damp and stay dark
    let r=L*1.00,g=L*0.895,b=L*0.735;
    r+=(L*0.50-r)*med*0.85; g+=(L*0.66-g)*med*0.85; b+=(L*0.34-b)*med*0.85;
    if(fine>0.93&&a>0.4){const s=0.72+fine*0.3;r=s;g=s*0.97;b=s*0.92;}   // pebbles brought up by wheels
    const o=(j*TW+i)*4;
    d[o]=Math.min(255,r*255);d[o+1]=Math.min(255,g*255);d[o+2]=Math.min(255,b*255);
    d[o+3]=Math.max(0,Math.min(1,a))*255;
   }
  }
  ctx.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace; t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
  try{t.anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());}catch(e){}
  return t;
 })();
 /* Which country the road is passing through, mirrored off the smoothsteps in terrain-realism.js
    so a track through Ochre Reach is red dust and a track over Frostpine is grey grit.

    The desert and snow tints are DARKER than the ground they cross, not merely differently hued.
    The first pass tinted the Ochre Trail a redder version of the sand it runs over and the track
    all but vanished into it — a worn road is compacted and damper than the loose stuff either side
    of it, and it is that difference in value, not in colour, that makes it read at a distance. */
 function tintAt(x,z){
  let r=1,g=0.97,b=0.90;
  const mix=(tr,tg,tb,k)=>{if(k<=0.002)return;r+=(tr-r)*k;g+=(tg-g)*k;b+=(tb-b)*k;};
  mix(0.90,0.67,0.49,(1-sstep(hyp(x,z,-220,130),96,176))*0.90);   // Coyote: sand beaten flat
  mix(0.86,0.60,0.44,(1-sstep(hyp(x,z,-330,300),70,134))*0.95);   // Ochre Reach: red dust, darker
  mix(0.76,0.80,0.85,(1-sstep(hyp(x,z,-160,-210),84,162))*0.85);  // Hollowpeak: grey trodden snow
  mix(0.74,0.78,0.84,(1-sstep(hyp(x,z,-300,-320),70,134))*0.92);  // Frostpine, colder still
  mix(1.02,0.80,0.53,(1-sstep(hyp(x,z,300,-300),74,140))*0.88);   // Amberwood leaf litter
  mix(0.72,0.77,0.68,(1-sstep(hyp(x,z,310,300),66,128))*0.90);    // Willowmere, wet and dark
  return [r,g,b];
 }
 /* A road stops at the water rather than being painted across it, and it does not end on a cut
    edge either. Both are per-vertex alpha, which is why the colour attribute below carries four
    components and not three. Getting this wrong was visible: the first build drew the track
    straight over Sparrow Creek and the creek simply disappeared under it. */
 const creekNear=(x,z)=>z>163?0:1-sstep(Math.abs(x-streamX(z)),1.7,4.2);
 const riverNear=(x,z)=>1-sstep(Math.abs(z-riverZ(x)),5.0,9.5);
 /* Nine columns across the ribbon rather than two, because a road crossing a slope has to drape
    over it — sample the ground at every vertex and the track lies on the hillside instead of
    hovering off one edge of it. */
 {
  const COLS=9, REPEAT=9.0, pos=[],uv=[],col=[],idx=[];
  let base=0;
  for(const tr of TRACKS){
   const N=tr.pts.length;
   for(let i=0;i<N;i++){
    const p=tr.pts[i], a=tr.pts[Math.max(0,i-1)], b=tr.pts[Math.min(N-1,i+1)];
    let tx=b[0]-a[0],tz=b[1]-a[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
    const nx=-tz,nz=tx;
    const w=tr.w*(0.86+0.26*hash01(p[0]*0.31,p[1]*0.29));      // the width breathes; roads are not extrusions
    const c=tintAt(p[0],p[1]);
    const ends=Math.min(sstep(tr.run[i],0,2.2),1-sstep(tr.run[i],tr.len-3.5,tr.len));
    for(let j=0;j<COLS;j++){
     const f=j/(COLS-1)*2-1, x=p[0]+nx*w*f, z=p[1]+nz*w*f;
     const a4=ends*(1-0.80*Math.max(creekNear(x,z),riverNear(x,z)));
     pos.push(x,gh(x,z)+0.055,z); uv.push(tr.run[i]/REPEAT,j/(COLS-1)); col.push(c[0],c[1],c[2],a4);
    }
   }
   for(let i=0;i<N-1;i++)for(let j=0;j<COLS-1;j++){
    const a=base+i*COLS+j,b2=a+1,c2=a+COLS,d2=c2+1;
    idx.push(a,b2,c2, b2,d2,c2);                               // wound so the face looks up
   }
   base+=N*COLS;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,4));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const mat=new THREE.MeshStandardMaterial({map:roadTex,vertexColors:true,transparent:true,roughness:1,
   metalness:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-6});
  const mesh=new THREE.Mesh(geo,mat);
  /* Ahead of the river and the creek in the transparent pass: both of those also draw with
     depthWrite off, and whichever goes last wins. The road goes first and the water covers it. */
  mesh.receiveShadow=true; mesh.castShadow=false; mesh.frustumCulled=true; mesh.renderOrder=-2;
  mesh.name='worldPathsSurface';
  scene.add(mesh);
  P.surface=mesh; P.tris=idx.length/3;
 }

 /* ================= 3. one batch for every stick and stone =================
    Posts, rails, gate bars, logs, cart wheels, cobbles, cairn stones, bench legs — a few thousand
    small solid things, and if each were a Mesh this package alone would double the draw calls.
    They are collected here and become three InstancedMeshes at the end of install. */
 const BAT={box:[],stone:[],cyl:[]};
 const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_s=new THREE.Vector3();
 function put(kind,x,y,z,sx,sy,sz,rx,ry,rz,col){
  _e.set(rx||0,ry||0,rz||0);_q.setFromEuler(_e);_v.set(x,y,z);_s.set(sx,sy,sz);
  BAT[kind].push({m:new THREE.Matrix4().compose(_v,_q,_s),c:new THREE.Color(col)});
 }
 const TIMBER='#8d7148', TIMBER2='#6f5a3c', PALE='#cdbb96', STONE='#9c968a', STONE2='#877f72',
       LEAF='#5c7a44', LEAF2='#4a6838', IRON='#4a4038', CANVAS='#c8bda2';

 /* ================= 4. fingerposts =================
    Every arm of one post shares one canvas and one mesh, so a fingerpost with three destinations
    on it is a single draw call. The boards are pointed at the far end — the point IS the arrow,
    which reads at a gallop in a way a painted glyph does not. */
 const SIGNS=[
  {id:'ranchfork',  x:35,  z:-29,  arms:[['COTTONWOOD',44,-46],['THE RANCH',0,2],['RIVER BRIDGE',0,112]]},
  {id:'cottonwood', x:57,  z:-62,  arms:[['BARLEYFOLD',215,-105],['COTTONWOOD',47,-50],['THE RANCH',0,0]]},
  {id:'fordwest',   x:99,  z:-70,  arms:[['SPARROW FORD',118,-76],['COTTONWOOD',47,-50]]},
  {id:'barleygate', x:227, z:-155, arms:[['AMBERWOOD',300,-300],['BARLEYFOLD',215,-105]]},
  {id:'amberwood',  x:271, z:-251, arms:[['AMBERWOOD',300,-300],['BARLEYFOLD',215,-105]]},
  {id:'bridgefoot', x:6,   z:136,  arms:[['COYOTE CANYON',-220,130],['WILLOWMERE',310,300],['THE RANCH',0,0]]},
  {id:'meadowfork', x:87,  z:188,  arms:[['WILLOWMERE',310,300],['RIVER BRIDGE',0,120]]},
  {id:'pinesturn',  x:-35, z:-64,  arms:[['HOLLOWPEAK',-160,-210],['HOME PASTURE',-71,-10],['THE RANCH',0,0]]},
  {id:'hollowpeak', x:-157,z:-218, arms:[['FROSTPINE',-300,-320],['HOLLOWPEAK',-160,-210],['THE FALLS',-150,-232]]},
  {id:'coyote',     x:-225,z:137,  arms:[['OCHRE REACH',-330,300],['RIVER BRIDGE',0,120],['THE OASIS',-200,158]]},
  {id:'ochre',      x:-283,z:265,  arms:[['OCHRE REACH',-330,300],['COYOTE CANYON',-220,130]]},
  {id:'frostpine',  x:-259,z:-281, arms:[['FROSTPINE',-300,-320],['HOLLOWPEAK',-160,-210]]},
  {id:'willowmere', x:261, z:267,  arms:[['WILLOWMERE',310,300],['RIVER BRIDGE',0,120]]},
 ];
 const BW=2.45, BH=0.40;                                       // board, metres
 function buildSign(sp){
  const n=sp.arms.length, CW=512, CH=112;
  const c=document.createElement('canvas'); c.width=CW; c.height=CH*n;
  const ctx=c.getContext('2d');
  ctx.clearRect(0,0,CW,CH*n);
  for(let i=0;i<n;i++){
   const y0=i*CH, tip=CW-6, tail=6, notch=CH*0.5;
   ctx.beginPath();                                            // a board with one pointed end
   ctx.moveTo(tail,y0+8); ctx.lineTo(tip-notch,y0+8); ctx.lineTo(tip,y0+CH/2);
   ctx.lineTo(tip-notch,y0+CH-8); ctx.lineTo(tail,y0+CH-8); ctx.closePath();
   ctx.fillStyle='#3a4a40'; ctx.fill();
   ctx.strokeStyle='#b6a97d'; ctx.lineWidth=3.5; ctx.stroke();
   ctx.fillStyle='#f0e8d4'; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.font='600 '+Math.round(CH*0.46)+'px Georgia';
   ctx.fillText(sp.arms[i][0],(tail+tip-notch)/2+6,y0+CH/2+2,CW-notch-40);
  }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  try{tex.anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());}catch(e){}
  const pos=[],uv=[],idx=[]; let v=0;
  for(let i=0;i<n;i++){
   const [,tx,tz]=sp.arms[i];
   const yaw=Math.atan2(tx-sp.x,tz-sp.z);                      // the point aims at the place named
   const dx=Math.sin(yaw),dz=Math.cos(yaw);
   const y=2.62-i*0.50, cxp=dx*(BW/2+0.09), czp=dz*(BW/2+0.09);
   const u0=0,u1=1,v0=1-(i+1)/n,v1=1-i/n;
   for(const side of [1,-1]){                                  // both faces painted, both read forwards
    const ox=-dz*0.035*side, oz=dx*0.035*side;
    const ax=dx*BW/2, az=dz*BW/2;
    const c0=[cxp-ax+ox,y-BH/2,czp-az+oz], c1=[cxp+ax+ox,y-BH/2,czp+az+oz];
    const c2=[cxp+ax+ox,y+BH/2,czp+az+oz], c3=[cxp-ax+ox,y+BH/2,czp-az+oz];
    pos.push(...c0,...c1,...c2,...c3);
    if(side===1)uv.push(u0,v0, u1,v0, u1,v1, u0,v1); else uv.push(u1,v0, u0,v0, u0,v1, u1,v1);
    if(side===1)idx.push(v,v+1,v+2, v,v+2,v+3); else idx.push(v,v+2,v+1, v,v+3,v+2);
    v+=4;
   }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:0.45,roughness:0.92,side:THREE.FrontSide}));
  m.castShadow=false; m.receiveShadow=false; m.name='sign:'+sp.id;
  const y=gh(sp.x,sp.z); m.position.set(sp.x,y,sp.z); scene.add(m);
  put('cyl',sp.x,y+1.55,sp.z,0.13,3.10,0.13,0,0,0,TIMBER2);    // the post the boards hang off
  put('box',sp.x,y+3.14,sp.z,0.30,0.14,0.30,0,Math.PI*0.25,0,PALE);
  W.colliders.push({x:sp.x,z:sp.z,r:0.42});
  return m;
 }
 /* A signpost planted in the middle of its own junction is a bollard. Each one is walked out of
    the road before it is built — far enough that a horse passes it, near enough to read. */
 for(const sp of SIGNS){
  for(let k=0;k<14;k++){
   const d=Math.min(trackDist(sp.x,sp.z),W.pathDist(sp.x,sp.z));
   if(d>=4.4)break;
   let bx=0,bz=0,bd=d;
   for(let a=0;a<8;a++){
    const th=a/8*Math.PI*2, x=sp.x+Math.cos(th)*1.2, z=sp.z+Math.sin(th)*1.2;
    const dd=Math.min(trackDist(x,z),W.pathDist(x,z));
    if(dd>bd){bd=dd;bx=Math.cos(th)*1.2;bz=Math.sin(th)*1.2;}
   }
   if(!bx&&!bz)break;
   sp.x+=bx; sp.z+=bz;
  }
 }
 P.signs=SIGNS.map(sp=>{try{return buildSign(sp);}catch(e){console.error('signpost '+sp.id,e);return null;}}).filter(Boolean);

 /* ================= 5. field boundaries =================
    Open grass either side of a road is countryside; a hedge with a gate in it is farmland, and
    that single difference is most of what makes the Barleyfold approach read as somewhere people
    grow things. Every run is registered in W.walls rather than W.colliders, which means a horse at
    a canter jumps it and a horse at a walk has to go round to the gate — which is exactly right,
    and is why the gaps below are real gaps and not decoration. */
 function along(tr,t){                                         // a point and a heading at a fraction of a road
  const want=t*tr.len; let i=1;
  while(i<tr.run.length-1&&tr.run[i]<want)i++;
  const a=tr.pts[i-1],b=tr.pts[i];
  const f=(want-tr.run[i-1])/Math.max(0.001,tr.run[i]-tr.run[i-1]);
  const x=a[0]+(b[0]-a[0])*f, z=a[1]+(b[1]-a[1])*f;
  let tx=b[0]-a[0],tz=b[1]-a[1];const tl=Math.hypot(tx,tz)||1;
  return {x,z,tx:tx/tl,tz:tz/tl,nx:-tz/tl,nz:tx/tl};
 }
 /* Fences hung off the six original tracks as well as the new ones, because the oldest road in the
    game — the ranch out to Cottonwood — has never had a field edge on it either. */
 const OLD={
  ranchcott:{pts:resample([[13,-11],[28,-30],[44,-46],[50,-53]],STEP)},
  cottbarley:{pts:resample([[53,-57],[96,-70],[140,-84],[184,-97],[214,-105]],STEP)},
 };
 for(const k in OLD){const t=OLD[k];let l=0;t.run=[0];for(let i=1;i<t.pts.length;i++){l+=Math.hypot(t.pts[i][0]-t.pts[i-1][0],t.pts[i][1]-t.pts[i-1][1]);t.run.push(l);}t.len=l;}
 const FIELDS=[
  {tr:OLD.cottbarley, kind:'hedge', side: 1, off:11.5, t0:0.42, t1:0.96, gates:[0.60,0.86]},
  {tr:OLD.cottbarley, kind:'rail',  side:-1, off:12.0, t0:0.46, t1:0.93, gates:[0.72]},
  {tr:OLD.cottbarley, kind:'stone', side: 1, off:12.5, t0:0.06, t1:0.24, gates:[0.16]},
  {tr:OLD.ranchcott,  kind:'rail',  side: 1, off:10.5, t0:0.20, t1:0.90, gates:[0.55]},
  {tr:OLD.ranchcott,  kind:'hedge', side:-1, off:11.0, t0:0.52, t1:0.95, gates:[0.76]},
  {tr:TRACKS[0],      kind:'stone', side:-1, off:11.0, t0:0.04, t1:0.34, gates:[0.20]},
  {tr:TRACKS[0],      kind:'stone', side: 1, off:11.5, t0:0.05, t1:0.28, gates:[]},
  {tr:TRACKS[5],      kind:'rail',  side: 1, off:11.0, t0:0.04, t1:0.26, gates:[0.15]},
  {tr:TRACKS[5],      kind:'hedge', side:-1, off:11.5, t0:0.06, t1:0.22, gates:[]},
  {tr:TRACKS[1],      kind:'hedge', side: 1, off:12.0, t0:0.05, t1:0.26, gates:[0.16]},
  {tr:TRACKS[1],      kind:'rail',  side:-1, off:11.5, t0:0.07, t1:0.23, gates:[0.15]},
  {tr:TRACKS[3],      kind:'stone', side: 1, off:10.5, t0:0.03, t1:0.17, gates:[0.10]},
  /* Two lines parallel to a road make a corridor, not a field. These strike off the roadside
     boundary at a right angle and run out into the country, and that third direction is the whole
     reason the Barleyfold approach now reads as somewhere with crops in it. */
  {tr:OLD.cottbarley, kind:'hedge', side: 1, off:11.5, cross:{t:0.52,len:34}, gates:[0.55]},
  {tr:OLD.cottbarley, kind:'hedge', side: 1, off:11.5, cross:{t:0.75,len:30}, gates:[]},
  {tr:OLD.cottbarley, kind:'rail',  side:-1, off:12.0, cross:{t:0.57,len:28}, gates:[]},
  {tr:OLD.cottbarley, kind:'rail',  side:-1, off:12.0, cross:{t:0.83,len:32}, gates:[0.5]},
  {tr:OLD.ranchcott,  kind:'rail',  side: 1, off:10.5, cross:{t:0.40,len:24}, gates:[]},
  {tr:OLD.ranchcott,  kind:'rail',  side: 1, off:10.5, cross:{t:0.74,len:26}, gates:[0.55]},
  {tr:TRACKS[0],      kind:'stone', side:-1, off:11.0, cross:{t:0.14,len:26}, gates:[]},
  {tr:TRACKS[5],      kind:'rail',  side: 1, off:11.0, cross:{t:0.12,len:24}, gates:[]},
 ];
 const GATE_W=5.0;
 let fenceM=0, gateN=0;
 P.gateAt=[];                                                  // so QA can stand at one and check it opens
 function fiveBarGate(x,z,y,yaw,swing){
  /* Hung open against its post, which is how a gate on a working farm spends most of its life and
     also means nothing this package builds ever stands across a road. */
  const a=yaw+swing, dx=Math.sin(a), dz=Math.cos(a);
  for(let k=0;k<5;k++)put('box',x+dx*1.3,y+0.35+k*0.26,z+dz*1.3,2.60,0.075,0.055,0,a,0,PALE);
  put('box',x+dx*1.3,y+0.83,z+dz*1.3,2.58,0.075,0.05,0,a,0.38,PALE);
  put('box',x+dx*0.06,y+0.72,z+dz*0.06,0.11,1.45,0.11,0,a,0,TIMBER2);
  put('box',x+dx*2.58,y+0.72,z+dz*2.58,0.10,1.32,0.10,0,a,0,TIMBER2);
  put('cyl',x+dx*0.06,y+1.02,z+dz*0.06,0.05,0.14,0.05,Math.PI/2,a,0,IRON);
  gateN++; P.gateAt.push([Math.round(x*10)/10,Math.round(z*10)/10]);
 }
 function gatePost(x,z,yaw){                                   // heavier than the line posts, and capped
  const y=gh(x,z);
  put('box',x,y+0.98,z,0.26,1.96,0.26,0,yaw,0,TIMBER2);
  put('box',x,y+2.03,z,0.36,0.14,0.36,0,yaw+0.35,0,PALE);
 }
 /* The line a boundary follows, in world space: either sampled along a road at a fixed offset, or
    struck off one of those at a right angle and run into the field. Everything downstream just
    walks a list of points, so both shapes share one builder. */
 function lineOf(f){
  const out=[], step=f.kind==='stone'?1.15:f.kind==='hedge'?1.30:2.55;
  if(f.cross){
   const s=along(f.tr,f.cross.t), n=Math.max(2,Math.round(f.cross.len/step));
   for(let i=0;i<=n;i++){const d=f.off+f.cross.len*i/n;out.push([s.x+s.nx*d*f.side,s.z+s.nz*d*f.side]);}
  }else{
   const n=Math.max(2,Math.round((f.t1-f.t0)*f.tr.len/step));
   for(let i=0;i<=n;i++){const s=along(f.tr,f.t0+(f.t1-f.t0)*i/n);out.push([s.x+s.nx*f.off*f.side,s.z+s.nz*f.off*f.side]);}
  }
  return out;
 }
 function runFence(f){
  const kind=f.kind, line=lineOf(f), n=line.length-1;
  let total=0; const cum=[0];
  for(let i=1;i<=n;i++){total+=Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]);cum.push(total);}
  /* Gate positions are given as fractions of the road for a roadside run and of the run itself for
     a cross one, and either way end up as metres along this line. */
  const gaps=(f.gates||[]).map(g=>f.cross?g*total:((g-f.t0)/(f.t1-f.t0))*total).filter(d=>d>3&&d<total-3);
  let lastX=null,lastZ=null,lastOpen=false;
  /* Where the current unbroken stretch of fence began. A wall is still only emitted every third
     sample — one long segment costs the per-frame sweep exactly what a short one does — but it now
     spans the whole stretch since the last emission instead of only the last step. Emitting
     lastX->x meant two samples in three carried no wall at all, and the holes that left were wider
     than the 0.65 m the player is pushed away from a wall: measured on the built world, the median
     distance from one wall end to the next was 2.58 m and seventy-three of them were over 4 m, so
     a horse at a walk rode through the hedge wherever she liked and the five-bar gates were
     decoration. closeRun() ends the stretch at the last solid sample, which is what a gate mouth
     and a thin patch of hedge both need. */
  let runX=null,runZ=null;
  const closeRun=()=>{if(runX!==null&&lastX!==null&&(runX!==lastX||runZ!==lastZ))W.walls.push({x1:runX,z1:runZ,x2:lastX,z2:lastZ});runX=null;};
  for(let i=0;i<=n;i++){
   const p=line[i], pa=line[Math.max(0,i-1)], pb=line[Math.min(n,i+1)];
   let ttx=pb[0]-pa[0],ttz=pb[1]-pa[1];const tl2=Math.hypot(ttx,ttz)||1;ttx/=tl2;ttz/=tl2;
   const s={tx:ttx,tz:ttz,nx:-ttz,nz:ttx};
   const x=p[0], z=p[1], y=gh(x,z), dist=cum[i];
   const inGate=gaps.some(g=>Math.abs(dist-g)<GATE_W/2);
   if(inGate){
    /* The gateposts stand at the mouth, the gate itself swung back out of the way. */
    if(!lastOpen&&lastX!==null){gatePost(lastX,lastZ,Math.atan2(s.tx,s.tz));fiveBarGate(lastX,lastZ,gh(lastX,lastZ),Math.atan2(s.tx,s.tz),1.5);}
    closeRun(); lastOpen=true; lastX=x; lastZ=z; continue;
   }
   if(lastOpen){gatePost(x,z,Math.atan2(s.tx,s.tz));lastOpen=false;lastX=x;lastZ=z;continue;}
   const yaw=Math.atan2(s.tx,s.tz), jit=hash01(x*0.7,z*0.7);
   if(kind==='rail'){
    put('box',x,y+0.66,z,0.16,1.32,0.16,0,yaw+(jit-0.5)*0.12,0,PALE);
    if(lastX!==null){
     const mx=(x+lastX)/2,mz=(z+lastZ)/2,l=Math.hypot(x-lastX,z-lastZ),ry=Math.atan2(x-lastX,z-lastZ)+Math.PI/2;
     const my=(y+gh(lastX,lastZ))/2, pitch=Math.atan2(gh(lastX,lastZ)-y,l);
     put('box',mx,my+1.02,mz,l,0.105,0.075,0,ry,pitch,PALE);
     put('box',mx,my+0.62,mz,l,0.095,0.068,0,ry,pitch,PALE);
    }
   }else if(kind==='stone'){
    /* Two courses and a capstone, every stone turned a different way; a dry stone wall that
       repeats reads as a row of boxes, and this one is only twenty triangles a stone anyway. */
    for(let r=0;r<2;r++)for(let k2=0;k2<2;k2++){
     const jx=(hash01(i*3+r*7+k2,1.7)-0.5)*0.42, jz=(hash01(i*5+r*3+k2,2.3)-0.5)*0.30;
     put('stone',x+s.tx*(k2?0.30:-0.30)+s.nx*jz,y+0.24+r*0.36,z+s.tz*(k2?0.30:-0.30)+s.nz*jz,
      0.56+jx*0.3,0.40,0.62+jz*0.4,hash01(i,r)*0.5,hash01(i,r+9)*3.1,hash01(i,r+4)*0.4,r?STONE2:STONE);
    }
    put('stone',x,y+0.86,z,1.15,0.22,0.72,0,yaw+(jit-0.5)*0.3,0,STONE2);
   }else{
    /* A hedge that repeats reads as a caterpillar, which is what the first build looked like from
       above. Every bush gets its own width, height and lean, one in nine is missing where the
       hedge has gone thin, and one in eleven has been let grow up into a standard — which is what
       a real hedgerow does when nobody lays it for a few years. */
    const thin=hash01(i*4.3,6.1);
    if(thin>0.90){closeRun();lastX=x;lastZ=z;continue;}
    const bushy=0.72+thin*0.62;
    for(let k2=0;k2<2;k2++){
     const jx=hash01(i*9+k2,4.1), jy=hash01(i*5+k2,8.3);
     const bw=(0.80+jx*0.62)*bushy, bh=(0.70+jy*0.52)*bushy;
     put('stone',x+s.tx*(k2?0.34:-0.34),y+bh*0.86,z+s.tz*(k2?0.34:-0.34),
      bw,bh*1.15,bw*1.04,(jy-0.5)*0.16,hash01(i,k2)*3.1,(jx-0.5)*0.16,
      jx>0.82?'#6c7a3e':(hash01(i,k2+5)>0.5?LEAF:LEAF2));
     put('stone',x+s.tx*(k2?0.30:-0.30),y+bh*1.66,z+s.tz*(k2?0.30:-0.30),
      bw*0.78,bh*0.80,bw*0.82,0,hash01(i,k2+2)*3.1,0,jy>0.86?'#7d7a44':LEAF2);
    }
    if(hash01(i*7.7,2.9)>0.91){                                 // a standard left to grow out of the line
     put('cyl',x,y+1.15,z,0.10,2.30,0.10,0,0,0,TIMBER2);
     put('stone',x,y+2.55,z,1.50,1.35,1.46,0,hash01(i,9)*3.1,0,LEAF);
     put('stone',x+0.3,y+3.20,z-0.2,1.05,0.95,1.02,0,hash01(i,11)*3.1,0,LEAF2);
    }
    if(i%9===4)put('cyl',x,y+0.55,z,0.07,1.10,0.07,0,0,0,TIMBER2);   // the old fence the hedge grew over
   }
   if(lastX!==null&&!lastOpen){
    fenceM+=Math.hypot(x-lastX,z-lastZ);
    if(runX===null){runX=lastX;runZ=lastZ;}
    if(i%3===0||i===n){W.walls.push({x1:runX,z1:runZ,x2:x,z2:z});runX=x;runZ=z;}
   }
   lastX=x; lastZ=z;
  }
 }
 for(const f of FIELDS){try{runFence(f);}catch(e){console.error('fence',e);}}
 P.fenceMetres=Math.round(fenceM); P.gates=gateN;

 /* ================= 6. what other people left behind =================
    A woodpile costs eleven boxes and does more for the feeling that somebody lives here than any
    building in the package. Placed off the riding line by at least five metres, never on one of
    the older tracks either, and seeded so they do not move between boots. */
 const TRACES={
  woodpile(x,z,y,yaw){
   for(let r=0;r<3;r++)for(let k=0;k<4-r;k++)
    put('cyl',x+Math.sin(yaw+Math.PI/2)*(k*0.26-0.35+r*0.13),y+0.16+r*0.25,z+Math.cos(yaw+Math.PI/2)*(k*0.26-0.35+r*0.13),
     0.12,1.30,0.12,Math.PI/2,yaw,0,hash01(k,r)>0.5?TIMBER:TIMBER2);
   put('box',x+Math.sin(yaw+Math.PI/2)*0.85,y+0.45,z+Math.cos(yaw+Math.PI/2)*0.85,0.09,0.92,0.09,0,yaw,0,TIMBER2);
   put('box',x-Math.sin(yaw+Math.PI/2)*0.85,y+0.45,z-Math.cos(yaw+Math.PI/2)*0.85,0.09,0.92,0.09,0,yaw,0,TIMBER2);
   return 1.05;
  },
  trough(x,z,y,yaw){
   put('box',x,y+0.34,z,1.90,0.42,0.68,0,yaw,0,TIMBER);
   put('box',x,y+0.53,z,1.72,0.06,0.52,0,yaw,0,'#4e7f86');       // standing water, gone green at the edge
   for(const sx of [-0.78,0.78])for(const sz of [-0.24,0.24])
    put('box',x+Math.sin(yaw)*sx+Math.cos(yaw)*sz,y+0.13,z+Math.cos(yaw)*sx-Math.sin(yaw)*sz,0.12,0.26,0.12,0,yaw,0,TIMBER2);
   put('cyl',x+Math.sin(yaw)*1.35,y+0.70,z+Math.cos(yaw)*1.35,0.08,1.40,0.08,0,0,0,TIMBER2);
   W.addThing({kind:'trough',id:'wp:trough:'+Math.round(x)+','+Math.round(z),g:null,x,z,reach:3.4,
    label:()=>'💧 Let your horse drink (E)',
    use(){let ok=false;S.sync(s=>{const h=s.horses&&s.horses[H.rideIdx()];if(!h)return;h.needs=h.needs||{};h.needs.thirst=Math.min(100,(h.needs.thirst||0)+30);ok=true;});
     if(ok){toast('💧 A long drink at the roadside trough. +30 thirst');G.sChime();}}});
   return 1.15;
  },
  cart(x,z,y,yaw){
   const sx=Math.sin(yaw),cz=Math.cos(yaw);
   put('box',x,y+0.74,z,2.10,0.46,1.10,0,yaw,0.06,TIMBER);
   put('box',x,y+1.00,z,2.06,0.34,0.07,0,yaw,0.06,TIMBER2);
   for(const s2 of [-1,1])put('cyl',x+cz*0.62*s2,y+0.58,z-sx*0.62*s2,0.58,0.12,0.58,0,0,Math.PI/2,TIMBER2);
   for(const s2 of [-1,1])put('box',x+sx*1.55+cz*0.34*s2,y+0.72,z+cz*1.55-sx*0.34*s2,0.09,0.09,1.70,0,yaw,0.16,TIMBER2);
   put('stone',x-sx*0.40,y+1.08,z-cz*0.40,0.52,0.42,0.46,0,yaw,0,CANVAS);   // a sack still in the bed
   return 1.30;
  },
  bench(x,z,y,yaw){
   put('box',x,y+0.46,z,1.70,0.09,0.42,0,yaw,0,TIMBER);
   put('box',x-Math.sin(yaw+Math.PI/2)*0.20,y+0.78,z-Math.cos(yaw+Math.PI/2)*0.20,1.70,0.30,0.06,0,yaw,0.14,TIMBER);
   for(const s2 of [-0.70,0.70])put('box',x+Math.sin(yaw)*s2,y+0.23,z+Math.cos(yaw)*s2,0.10,0.46,0.34,0,yaw,0,TIMBER2);
   return 0.85;
  },
  leanpost(x,z,y,yaw){
   put('box',x,y+0.60,z,0.15,1.30,0.15,0.26,yaw,0.12,TIMBER2);
   put('box',x+Math.sin(yaw+1.4)*0.9,y+0.22,z+Math.cos(yaw+1.4)*0.9,1.5,0.07,0.05,0,yaw+1.4,0.3,PALE);
   return 0;
  },
  cairn(x,z,y){
   for(let k=0;k<5;k++)put('stone',x+(hash01(k,x)-0.5)*0.22,y+0.18+k*0.26,z+(hash01(k,z)-0.5)*0.22,
    (0.78-k*0.10),0.32,(0.74-k*0.09),hash01(k,3)*0.4,hash01(k,7)*3.1,hash01(k,5)*0.4,k%2?STONE:STONE2);
   return 0.62;
  },
  barrels(x,z,y,yaw){
   for(let k=0;k<2;k++){
    const bx=x+Math.sin(yaw)*(k*0.66-0.33), bz=z+Math.cos(yaw)*(k*0.66-0.33);
    put('cyl',bx,y+0.42,bz,0.30,0.84,0.30,0,0,0,TIMBER);
    put('cyl',bx,y+0.24,bz,0.32,0.06,0.32,0,0,0,IRON);
    put('cyl',bx,y+0.62,bz,0.32,0.06,0.32,0,0,0,IRON);
   }
   return 0.72;
  },
 };
 const TRACE_BY_COUNTRY={
  meadow:['woodpile','trough','bench','cart','leanpost','barrels'],
  farm:['cart','barrels','trough','woodpile','bench','leanpost'],
  mountain:['cairn','woodpile','leanpost','bench','cairn'],
  desert:['barrels','cairn','cart','trough','leanpost'],
 };
 function countryAt(x,z){
  if(hyp(x,z,-160,-210)<150||hyp(x,z,-300,-320)<150)return 'mountain';
  if(hyp(x,z,-220,130)<150||hyp(x,z,-330,300)<140)return 'desert';
  if(hyp(x,z,215,-105)<110)return 'farm';
  return 'meadow';
 }
 /* What each of these puts in the collider list, known before it is built, because whether there
    is room for it depends on how fat it is. Getting this wrong put a cart's 1.3 m collider three
    metres off the centre of the Barley Road — far enough to look fine and near enough that the
    end-of-install check called the road blocked, intermittently, depending on where the trees
    landed that boot. trackDist answers with the distance to the nearest SAMPLE and the samples are
    2.6 m apart, so the clearance asked for carries that slack on top of the radius. */
 const TRACE_R={woodpile:1.05,trough:1.15,cart:1.30,bench:0.85,leanpost:0,cairn:0.62,barrels:0.72};
 let traceN=0;
 function scatter(tr,every){
  for(let d=22;d<tr.len-20;d+=every){
   const t=d/tr.len, s=along(tr,t), r1=hash01(tr.id.length*13+d,7.7);
   if(r1>0.88)continue;                                        // not at every interval, or it is a parade
   const side=hash01(d,3.3)>0.5?1:-1, off=6.2+hash01(d,9.1)*2.8;
   const x=s.x+s.nx*off*side, z=s.z+s.nz*off*side;
   const pool=TRACE_BY_COUNTRY[countryAt(x,z)];
   const kind=pool[Math.floor(hash01(d,5.5)*pool.length)%pool.length];
   if(onAnyRoad(x,z,4.5+(TRACE_R[kind]||0)))continue;
   if(SIGNS.some(sp=>hyp(x,z,sp.x,sp.z)<7))continue;
   if(W.colliders.some(c=>!c.decor&&c.r>0.3&&hyp(x,z,c.x,c.z)<c.r+2.2))continue;
   const yaw=Math.atan2(s.tx,s.tz)+(hash01(d,11.3)-0.5)*1.2;
   let rad=0; try{rad=TRACES[kind](x,z,gh(x,z),yaw)||0;}catch(e){console.error('trace '+kind,e);continue;}
   if(rad>0)W.colliders.push({x,z,r:rad});
   traceN++;
  }
 }
 for(const tr of TRACKS)scatter(tr,25);
 for(const k in OLD)scatter(Object.assign({id:k},OLD[k]),30);
 /* Hay in the fields either side of Barleyfold, which is the one thing a farm cannot do without.
    These build their own merged geometry, so a handful of them and no more. */
 try{
  for(const [hx,hz] of [[168,-78],[196,-124],[152,-96]]){
   const g=W.arrivalArt.buildHayStack({seed:Math.round(hx)});
   g.position.set(hx,gh(hx,hz),hz); g.rotation.y=hash01(hx,hz)*3.1;
   g.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
   scene.add(g); W.followCamera.register(g); W.colliders.push({x:hx,z:hz,r:1.2});
  }
 }catch(e){console.error('haystacks',e);}

 /* ================= 7. milestones =================
    Small, low, and carrying the one fact a rider in open country actually wants: how much further.
    Distance is measured along the road rather than as the crow flies, because the crow is not the
    one doing the climbing. */
 const MILE=[];
 function milestone(x,z,name,metres){
  const c=document.createElement('canvas'); c.width=256; c.height=128;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#b9b2a4'; ctx.fillRect(0,0,256,128);
  ctx.fillStyle='#4a453c'; ctx.textAlign='center';
  ctx.font='700 40px Georgia'; ctx.fillText(name,128,58,232);
  ctx.font='600 46px Georgia'; ctx.fillText(metres+' m',128,108,232);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(0.80,0.40),new THREE.MeshStandardMaterial({map:tex,roughness:1}));
  m.name='worldPaths:milestone';                               // named like the rest, so QA can find it
  const y=gh(x,z);
  m.position.set(x,y+0.62,z); m.lookAt(0,y+0.62,0); scene.add(m);
  put('stone',x,y+0.42,z,0.98,0.94,0.46,0,m.rotation.y,0,'#a8a294');
  MILE.push(m);
 }
 for(const tr of TRACKS){
  for(const t of [0.34,0.68]){
   const s=along(tr,t), side=hash01(tr.len,t*100)>0.5?1:-1;
   const x=s.x+s.nx*5.4*side, z=s.z+s.nz*5.4*side;
   if(onAnyRoad(x,z,4.4))continue;
   try{milestone(x,z,tr.to,Math.round((1-t)*tr.len/5)*5);}catch(e){console.error('milestone',e);}
  }
 }
 P.milestones=MILE.length;

 /* ================= 8. Sparrow Ford =================
    The Cottonwood–Barleyfold road has crossed this creek since the day both were drawn and has
    never acknowledged it. The channel is shallow enough to ride — the bed sits about six tenths of
    a metre under the water — so what belongs here is a ford and not a bridge: a cobbled apron you
    can see through the water, marker posts on both banks so you know where the bottom is firm, a
    depth gauge, and a plank footbridge a few metres downstream for whoever is on foot.

    A bridge was the other option and would have been wrong. groundH is fixed in ranch3d.html and
    knows nothing about anything this package builds, so a raised deck would be a deck the horse
    walks straight through on its way down into the water. */
 (function ford(){
  let fz=null,best=1e9;
  for(let z=-300;z<=150;z+=0.5){const d=W.pathDist(streamX(z),z);if(d<best){best=d;fz=z;}}
  if(fz===null||best>4){P.ford=null;return;}
  const fx=streamX(fz), y=gh(fx,fz);
  /* Cobbles laid, not scattered: flat, close-packed and all much of a size, which is the whole
     difference between a made crossing and a patch of loose rock somebody gave up on. They sit
     four centimetres proud of the bed, so the creek runs over them and you can see them through it. */
  for(let u=-4.4;u<=4.4;u+=0.55)for(let v=-3.1;v<=3.1;v+=0.55){
   const edge=1-sstep(Math.abs(u)/4.4,0.58,1.0);
   if(hash01(u*11,v*13)>0.18+edge*0.86)continue;                // the apron frays at its outer edge
   const x=fx+u+(hash01(u,v)-0.5)*0.26, z=fz+v+(hash01(v,u)-0.5)*0.26;
   const s2=0.46+hash01(x,z)*0.14;
   put('stone',x,gh(x,z)+0.045,z,s2,0.13,s2*(0.86+hash01(z,x)*0.24),
    0,hash01(u*3,v*3)*3.1,0,hash01(u,v+4)>0.55?'#8c8b82':'#7d8884');
  }
  for(const sx of [-6.6,6.6])for(const sz of [-4.0,4.0]){
   const x=fx+sx, z=fz+sz, py=gh(x,z);
   put('cyl',x,py+0.70,z,0.10,1.40,0.10,0,0,0,TIMBER2);
   put('box',x,py+1.46,z,0.24,0.18,0.24,0,0.7,0,'#c2452f');     // red caps: the line the carts take
  }
  {const x=fx-1.9,z=fz+3.9,py=gh(x,z);                          // depth gauge, banded like a real one
   put('cyl',x,py+0.90,z,0.09,1.80,0.09,0,0,0,'#efe7d4');
   for(let k=0;k<4;k++)put('box',x,py+0.32+k*0.42,z,0.20,0.16,0.20,0,0,0,k%2?'#c2452f':'#efe7d4');}
  {const bz=fz+7.5;                                             // the footbridge, well off the riding line
   for(const sx of [-3.1,3.1]){const x=fx+sx,py=gh(x,bz);
    put('box',x,py+0.62,bz,0.20,1.24,0.20,0,0,0,TIMBER2);
    W.colliders.push({x,z:bz,r:0.34});}
   const deckY=Math.max(gh(fx-3.1,bz),gh(fx+3.1,bz))+0.30;
   for(let k=-7;k<=7;k++)put('box',fx+k*0.42,deckY,bz,0.38,0.09,1.30,0,0,0,TIMBER);
   for(const sz of [-0.62,0.62]){
    put('box',fx,deckY+0.55,bz+sz,6.40,0.07,0.07,0,0,0,PALE);
    for(const sx of [-2.6,0,2.6])put('box',fx+sx,deckY+0.30,bz+sz,0.08,0.60,0.08,0,0,0,TIMBER2);
   }}
  W.addThing({kind:'ford',id:'wp:ford',g:null,x:fx,z:fz,reach:5.5,
   label:()=>'💧 Let your horse drink at the ford (E)',
   use(){let ok=false;S.sync(s=>{const h=s.horses&&s.horses[H.rideIdx()];if(!h)return;h.needs=h.needs||{};h.needs.thirst=Math.min(100,(h.needs.thirst||0)+35);ok=true;});
    if(ok){toast('💧 Cold creek water at Sparrow Ford. +35 thirst');G.sChime();}}});
  /* id and biome are spelled out because this region joins the table after the world package has
     stamped its metadata onto everything else, and a region with a null id fails qa-world-features'
     metadata check — the same reason horse-roster.js spells them out for the Loon Lake shallows. */
  try{W.addRegion({name:'🌊 Sparrow Ford',x:fx,z:fz,r:15,id:'ford',biome:'river'});}catch(e){}
  W.mapMarkers.push({x:fx,z:fz,glyph:'🌊',label:'Sparrow Ford'});
  P.ford={x:Math.round(fx*10)/10,z:fz,dist:Math.round(best*100)/100};
 })();

 /* ================= 9. where the road runs out =================
    Two stone gateposts either side of the track at each quarter's rim: punctuation that says the
    road brought you somewhere, and a nine-metre mouth between them so it cannot possibly stop you
    riding through. Whatever the quarter packages build inland starts from here. */
 for(const tr of TRACKS){
  if(!/^(barley|ochre|frostpine|marsh)$/.test(tr.id))continue;
  const s=along(tr,0.985);
  for(const side of [-1,1]){
   const x=s.x+s.nx*4.6*side, z=s.z+s.nz*4.6*side, y=gh(x,z);
   for(let k=0;k<3;k++)put('stone',x,y+0.30+k*0.52,z,1.10-k*0.13,0.56,1.06-k*0.12,0,hash01(x,k)*3.1,0,k%2?STONE:STONE2);
   put('stone',x,y+1.92,z,1.02,0.26,0.98,0,hash01(z,2)*3.1,0,STONE2);
   W.colliders.push({x,z,r:0.75});
  }
  W.mapMarkers.push({x:s.x,z:s.z,glyph:'🚧',label:tr.to.replace(/\b\w+/g,w=>w[0]+w.slice(1).toLowerCase())+' road'});
 }

 /* ================= 10. the roads on the minimap =================
    A dotted line the player can follow with one eye while riding with the other. The minimap
    already rejects anything more than 140 m away before it does any work, so a few dozen dots
    along a road cost a handful of comparisons a frame and nothing else. */
 for(const tr of TRACKS){
  for(let d=0;d<tr.len;d+=11){
   const s=along(tr,d/tr.len);
   W.miniMarkers.push({x:s.x,z:s.z,col:'rgba(214,190,150,0.95)',r:1.5});
  }
 }
 P.miniDots=W.miniMarkers.length;

 /* ================= 11. the three instanced meshes =================
    Everything above resolves to this: one draw call for all the timber, one for all the stone and
    greenery, one for everything round. Built at exact size, uploaded once, never touched again. */
 const stoneGeo=(()=>{                                          // an icosahedron knocked out of true
  const g=new THREE.IcosahedronGeometry(0.5,0), p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*(0.78+hash01(i,1)*0.42),p.getY(i)*(0.80+hash01(i,2)*0.38),p.getZ(i)*(0.78+hash01(i,3)*0.42));
  g.computeVertexNormals(); return g;
 })();
 const GEOS={box:new THREE.BoxGeometry(1,1,1),stone:stoneGeo,cyl:new THREE.CylinderGeometry(0.5,0.5,1,8)};
 P.instances={};
 for(const kind in BAT){
  const rows=BAT[kind]; if(!rows.length)continue;
  const im=new THREE.InstancedMesh(GEOS[kind],new THREE.MeshStandardMaterial({roughness:kind==='stone'?1:0.9,metalness:0}),rows.length);
  rows.forEach((r,i)=>{im.setMatrixAt(i,r.m);im.setColorAt(i,r.c);});
  im.instanceMatrix.needsUpdate=true; if(im.instanceColor)im.instanceColor.needsUpdate=true;
  im.castShadow=true; im.receiveShadow=true; im.name='worldPaths:'+kind;
  im.computeBoundingSphere();
  scene.add(im); P.instances[kind]=rows.length;
 }
 P.traces=traceN;

 /* ================= 12. the check that matters =================
    A road a horse cannot follow is worse than no road, so before this package calls itself done it
    walks every sample of every track and asks whether anything solid ended up close enough to stop
    a rider. This should always be zero; if it is not, something placed above needs moving, and QA
    reads it out of render_game_to_text rather than waiting for somebody to notice on a hack. */
 P.blocked=tight();
 /* Only the hits this package added are its problem; the rest were a mesa or a pine the road had
    to squeeze past and could not fully escape, and the horse still gets through those — the ride
    check in tools walks every road and finds nothing pushing it off. */
 P.mine=P.blocked.length-P.preExistingTight.length;
 if(P.mine>0)console.warn('world-paths: '+P.mine+' road sample(s) crowded by something this package placed',P.blocked.slice(0,6));

 G.on('state',o=>{o.paths={metres:P.metres,roads:TRACKS.length,signs:P.signs.length,gates:P.gates,
  fenceMetres:P.fenceMetres,traces:P.traces,milestones:P.milestones,ford:P.ford,
  tight:P.blocked.length,tightPreExisting:P.preExistingTight.length,tightMine:P.mine,
  instances:P.instances,tris:P.tris};});
}
