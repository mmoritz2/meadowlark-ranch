/* Feature package 'world-vistas' — distance, and the things that draw the eye.

   Kestrel Basin's horizon was trees and haze. assets/world-art.js already lays three soft
   rings of hills out at 725, 920 and 1300 metres, but they are deliberately smooth and
   deliberately anonymous: nothing on that skyline is a shape you could name, point at or
   steer by. This package puts six named massifs in front of and above those rings, on six
   different bearings, and eight places inside the basin tall enough to be seen from a long
   way off and worth the ride once you get there.

   Two rules shaped every line of it. Everything distant must be free: the massifs are one
   merged mesh apiece, built once, never touched again, no shadows, no per-frame work.
   Everything near must be one draw call too — a water tower assembled out of ninety little
   meshes is ninety draw calls and ninety more in the shadow pass — so every landmark goes
   through an accumulator that welds it into a single buffer with vertex colours before it
   ever reaches the scene. Fifteen meshes and one rotating windmill fan is the whole cost of
   this file.

   Compass, since the source is inconsistent about it: the minimap draws +z downward and puts
   N at the top, so -z is north, +x is east. Bearings here are atan2(dx,dz) like the rest of
   the codebase, which makes 0 south and PI north.

   Owned by this package: this file only. Nothing runs at import time. */
export const id='world-vistas';
export function install(G){
 /* ?novistas boots the world without any of this, so a before-and-after pair can be shot from
    one identical build in one session instead of from two checkouts a reviewer has to take on
    trust. Nothing else reads it and it costs one string compare at install. */
 if(location.search.indexOf('novistas')>=0)return;
 const {THREE,scene,$,toast}=G;
 const W=G.world,T=G.tables,H=G.horse,S=G.save,M=G.money,Q=G.quest,UI=G.ui;
 const player=H.player,groundH=W.groundH;
 const hyp=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
 const COMPASS=['S','SE','E','NE','N','NW','W','SW'];
 const compass=b=>COMPASS[Math.round((((b%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8];
 const P={};G.vistas=P;                                   // this package's live state, for QA

 /* Deterministic value noise. The skyline has to be the same shape on every boot: a mountain
    that moves between sessions is not a landmark, and a rider who has learned to steer by the
    Wolf Tooth would be very badly served by one that wandered. */
 function hash2(x,z){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
 function noise2(x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  const a=hash2(ix,iz),b=hash2(ix+1,iz),c=hash2(ix,iz+1),d=hash2(ix+1,iz+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;}
 const fbm=(x,z)=>noise2(x,z)*0.55+noise2(x*2.13+17,z*2.13-8)*0.28+noise2(x*4.31-5,z*4.31+31)*0.17;
 const ridged=(x,z)=>1-Math.abs(fbm(x,z)*2-1);            // creases rather than blobs: spurs and gullies

 /* ============================================================================
    0. the accumulator — how a landmark becomes one draw call
    ============================================================================ */
 /* Every piece of every landmark is a unit box, cylinder, cone, sphere or torus pushed
    through here with a transform and a colour, and comes out the other end as one
    non-indexed buffer with a colour attribute. The unit geometries are converted to
    non-indexed once and cached: the ruined keep alone asks for eight hundred blocks, and
    cloning a geometry eight hundred times to throw it away is the shape of waste
    ranch3d.html:8066 is a monument to. */
 const UNIT_BOX=new THREE.BoxGeometry(1,1,1);
 const UNIT_SPH=new THREE.SphereGeometry(0.5,10,7);
 const _cyl={},_cone={},_tor={},_ni=new WeakMap();
 const unitCyl=s=>_cyl[s]||(_cyl[s]=new THREE.CylinderGeometry(0.5,0.5,1,s));
 const unitCone=s=>_cone[s]||(_cone[s]=new THREE.ConeGeometry(0.5,1,s));
 const unitTor=(tube,seg)=>{const k=tube.toFixed(4)+'|'+seg;return _tor[k]||(_tor[k]=new THREE.TorusGeometry(1,tube,6,seg));};
 const nonIdx=g=>{if(!g.index)return g;let c=_ni.get(g);if(!c){c=g.toNonIndexed();_ni.set(g,c);}return c;};
 /* One material behind every landmark. Sharing it saves no draw call — different geometry is
    a different call whatever the material — but it saves the shader compile and the state
    change, and the whole set can be retuned from this line. */
 const LM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.92,metalness:0.02});
 LM.envMapIntensity=0.58;

 function Acc(seed,ox,oy,oz){
  const pos=[],nor=[],col=[];
  const c=new THREE.Color(),v=new THREE.Vector3();
  const m=new THREE.Matrix4(),nm=new THREE.Matrix3(),q=new THREE.Quaternion(),e=new THREE.Euler();
  const tr=new THREE.Vector3(),sc=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0),dir=new THREE.Vector3();
  let n=(seed||1)>>>0;
  const rnd=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  const rr=(a,b)=>a+rnd()*(b-a);
  function putQ(geo,hex,px,py,pz,sx,sy,sz,quat,shade,keep){
   tr.set(px,py,pz);sc.set(sx,sy,sz);m.compose(tr,quat,sc);nm.getNormalMatrix(m);
   const g=keep?nonIdx(geo):(geo.index?geo.toNonIndexed():geo);
   const p=g.attributes.position,gn=g.attributes.normal;
   c.set(hex);const s=(shade==null?1:shade)*(0.95+rnd()*0.10);   // every piece a shade apart, or it reads as plastic
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).applyMatrix4(m);pos.push(v.x,v.y,v.z);
    v.fromBufferAttribute(gn,i).applyMatrix3(nm).normalize();nor.push(v.x,v.y,v.z);
    col.push(c.r*s,c.g*s,c.b*s);
   }
   if(!keep&&g!==geo)g.dispose();
   return A;
  }
  const put=(geo,hex,px,py,pz,sx,sy,sz,rx,ry,rz,shade)=>{e.set(rx||0,ry||0,rz||0);q.setFromEuler(e);return putQ(geo,hex,px,py,pz,sx,sy,sz,q,shade,true);};
  const A={
   rnd,rr,
   box:(w,h,d,hex,x,y,z,rx,ry,rz,shade)=>put(UNIT_BOX,hex,x,y,z,w,h,d,rx,ry,rz,shade),
   sph:(sx,sy,sz,hex,x,y,z,rx,ry,rz,shade)=>put(UNIT_SPH,hex,x,y,z,sx*2,sy*2,sz*2,rx,ry,rz,shade),
   cone:(r,h,seg,hex,x,y,z,rx,ry,rz,shade)=>put(unitCone(seg),hex,x,y,z,r*2,h,r*2,rx,ry,rz,shade),
   tor:(R,r,seg,hex,x,y,z,rx,ry,rz,shade)=>put(unitTor(r/R,seg),hex,x,y,z,R,R,R,rx,ry,rz,shade),
   cyl(r1,r2,h,seg,hex,x,y,z,rx,ry,rz,shade){
    if(Math.abs(r1-r2)<1e-5)return put(unitCyl(seg),hex,x,y,z,r1*2,h,r1*2,rx,ry,rz,shade);
    const g=new THREE.CylinderGeometry(r1,r2,1,seg);e.set(rx||0,ry||0,rz||0);q.setFromEuler(e);
    putQ(g,hex,x,y,z,1,h,1,q,shade,false);g.dispose();return A;
   },
   /* A member between two points: legs, braces, rafters, roots, branches. It is a function
      because a lattice tower is nothing but forty of these, and spelling each one out as a
      midpoint plus two euler angles is exactly how a windmill ends up bent. */
   strut(ax,ay,az,bx,by,bz,r1,r2,hex,seg,shade){
    dir.set(bx-ax,by-ay,bz-az);const len=dir.length();if(len<1e-4)return A;
    q.setFromUnitVectors(UP,dir.divideScalar(len));
    const mx=(ax+bx)/2,my=(ay+by)/2,mz=(az+bz)/2,r2b=r2==null?r1:r2;
    if(Math.abs(r1-r2b)<1e-5)return putQ(unitCyl(seg||6),hex,mx,my,mz,r1*2,len,r1*2,q,shade,true);
    const g=new THREE.CylinderGeometry(r2b,r1,1,seg||6);putQ(g,hex,mx,my,mz,1,len,1,q,shade,false);g.dispose();return A;
   },
   /* A triangle list already in the landmark's local frame, flat-shaded off the face normal,
      for the two things the primitives cannot say: the worn ground and the chalk figure.
      Winding decides which side you see, so both callers below derive it rather than guess. */
   tris(a,hex,shade){
    c.set(hex);const s=(shade==null?1:shade);
    for(let i=0;i<a.length;i+=9){
     const ux=a[i+3]-a[i],uy=a[i+4]-a[i+1],uz=a[i+5]-a[i+2];
     const wx=a[i+6]-a[i],wy=a[i+7]-a[i+1],wz=a[i+8]-a[i+2];
     let nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;
     const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
     for(let k=0;k<3;k++){pos.push(a[i+k*3],a[i+k*3+1],a[i+k*3+2]);nor.push(nx,ny,nz);col.push(c.r*s,c.g*s,c.b*s);}
    }
    return A;
   },
   /* Ground worn bare by hooves. It has to follow groundH: over ten metres of even this
      gentle terrain a flat disc sinks at one edge and floats at the other. The rim is
      jittered because a perfect circle of dirt reads as a decal rather than as a place
      people stand. (a,t) has a negative Jacobian, hence the winding below.) */
   patch(cx,cz,r,hex,rim,lift,segs,rings){
    segs=segs||20;rings=rings||3;lift=lift==null?0.08:lift;
    const base=new THREE.Color(hex),edge=new THREE.Color(rim||hex),cc=new THREE.Color();
    const at=(a,t)=>{const jr=r*(0.80+noise2(Math.cos(a)*3.1+cx*0.05,Math.sin(a)*3.1+cz*0.05)*0.40)*t;
     const x=cx+Math.cos(a)*jr,z=cz+Math.sin(a)*jr;
     return [x,groundH(ox+x,oz+z)-oy+lift,z];};
    for(let j=0;j<rings;j++)for(let i=0;i<segs;i++){
     const a0=i/segs*Math.PI*2,a1=(i+1)/segs*Math.PI*2,t0=j/rings,t1=(j+1)/rings;
     const p00=at(a0,t0),p10=at(a1,t0),p01=at(a0,t1),p11=at(a1,t1);
     cc.copy(base).lerp(edge,t1);const hx='#'+cc.getHexString();
     A.tris([p00[0],p00[1],p00[2],p11[0],p11[1],p11[2],p01[0],p01[1],p01[2]],hx,1);
     if(j)A.tris([p00[0],p00[1],p00[2],p10[0],p10[1],p10[2],p11[0],p11[1],p11[2]],hx,1);
    }
    return A;
   },
   verts:()=>pos.length/3,
   mesh(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    g.computeBoundingSphere();
    const me=new THREE.Mesh(g,LM);me.castShadow=true;me.receiveShadow=true;return me;
   },
  };
  return A;
 }

 /* Somewhere with room. Every site below came off a scored sweep of the basin, but trees are
    sown at random and one can still be standing exactly where a monolith wants to go, so each
    site asks for its clearance and shuffles if it has to. Deliberately not world.js's
    findClear: this package should not break when that one is refactored, and this one also
    keeps off the worn paths and off Sparrow Creek, whose bed runs perched above the meadow in
    the north and which fooled the first pass at siting all of this. */
 function clearAt(cx,cz,need,maxR){
  const legal=(x,z)=>W.pathDist(x,z)>need*0.5+6&&Math.abs(z-W.riverZ(x))>need+14&&(z>172||Math.abs(x-W.streamX(z))>need+14);
  const room=(x,z)=>{let m=1e9;for(const c of W.colliders){const q=hyp(x,z,c.x,c.z)-c.r;if(q<m)m=q;}return m;};
  /* Take the roomiest point rather than the first legal one, with a small penalty for
     wandering. First-fit put a nine-stone circle down with the nearest oak sixteen metres off
     when there was a forty-metre clearing twenty metres away, and a landmark that cannot be
     seen for trees is not a landmark. */
  let best=null,bestScore=-1e9;
  for(let r=0;r<=(maxR||48);r+=6)for(let k=0;k<(r?16:1);k++){
   const a=k/16*Math.PI*2+r*0.37,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
   if(!legal(x,z))continue;
   const sc=Math.min(room(x,z),need*2.4)-r*0.22;
   if(sc>bestScore){bestScore=sc;best=[x,z];}
  }
  return best||[cx,cz];
 }

 /* ============================================================================
    1. the far skyline — six named massifs beyond the basin
    ============================================================================ */
 /* Where they can go is decided for us. The rideable basin stops at 455 m, and a two-hundred
    metre peak parked at 550 would be a wall in the face of anybody who rode out to the fence,
    so nothing here starts nearer than about 620. That also puts every foot past the corner of
    the 1000 m terrain plate and out onto the horizon disc at y=-8, and they are hemmed in at
    y=-26 so whatever ground is under them buries the join. */
 const SKY_BASE=-18;
 const rockMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
 rockMat.envMapIntensity=0.5;
 /* FogExp2 at 0.00125 leaves a peak at 900 m seventy per cent washed toward the sky colour,
    which is not aerial perspective, it is erasure — world-art.js had to soften the same fog
    for the rings standing behind these, for the same reason. This is that cheat with a weaker
    hand, because these stand nearer than those do: at 800 m a ridge keeps most of its own
    colour, by 1300 m it is two thirds sky, and the far rings stay hazier still, so the depth
    ordering of the whole skyline comes out in the right order. */
 rockMat.onBeforeCompile=sh=>{
  sh.fragmentShader=sh.fragmentShader.replace('#include <fog_fragment>',`
#ifdef USE_FOG
 #ifdef FOG_EXP2
  float vistaFog = 1.0 - exp(-fogDensity*fogDensity*vFogDepth*vFogDepth*0.19);
 #else
  float vistaFog = smoothstep(fogNear,fogFar,vFogDepth)*0.6;
 #endif
 gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, min(0.66, vistaFog));
#endif`);
 };
 rockMat.customProgramCacheKey=()=>'vista-massif-v1';

 /* A massif is a patch of heightfield laid along a bearing: u runs along the range, v across
    it, and the summits are named points on that ridgeline rather than wherever the noise
    happened to pile up. Placing the peaks by hand is the entire point — a skyline you can
    steer by needs the sharp one to be in the same place as the word "north". */
 function massif(cfg){
  const nu=cfg.nu||108,nv=cfg.nv||14,b=cfg.bearing,dist=cfg.dist,span=cfg.span,depth=cfg.depth;
  const ax=Math.cos(b),az=-Math.sin(b);                   // along the range
  const ox=Math.sin(b),oz=Math.cos(b);                    // outward, away from the basin
  const rock=new THREE.Color(cfg.rock),high=new THREE.Color(cfg.high||cfg.rock);
  const foot=new THREE.Color(cfg.foot||cfg.rock),snow=new THREE.Color(cfg.snow||'#e7eef2');
  const crest=cfg.crest||0.5,back=cfg.backfall==null?0.55:cfg.backfall,sd=cfg.seed||1;
  const tall=cfg.summits.reduce((m,s)=>Math.max(m,s.h),1);
  /* The tallest summit that reaches this far along, so the saddles between them fall out of
     the arithmetic instead of being placed by hand. A summit with a flat set is clipped short
     of its own apex, which is what makes a mesa a mesa rather than a cone. */
  const ridge=u=>{let h=cfg.swell||0;
   for(const s of cfg.summits){const d=(u-s.u)/s.w,g=Math.exp(-d*d*(s.k||1.2));
    h=Math.max(h,s.h*clamp(s.flat?g/s.flat:g,0,1));}
   return h;};
  const pos=[],col=[],idx=[],snowAmt=[],c=new THREE.Color();
  for(let j=0;j<=nv;j++){
   const t=j/nv,v=(t-0.5)*depth;
   for(let i=0;i<=nu;i++){
    const u=(i/nu-0.5)*span,hr=ridge(u);
    /* The crest wanders across the band instead of running parallel to it, so the range has a
       front and a back rather than a centre line drawn with a compass. */
    const lc=clamp(crest+Math.sin(u*0.0042+sd)*0.09+Math.sin(u*0.011-sd)*0.04,0.18,0.82);
    const prof=t<=lc?Math.pow(t/lc,1.25):1-back*Math.pow((t-lc)/(1-lc),1.5);
    const g1=ridged((u+sd*137)*0.0105,(v+sd*91)*0.0105); // spurs and gullies down the flanks
    const g3=ridged((u+sd*211)*0.030,(v+sd*77)*0.030);   // and the teeth along the crest itself
    const g2=fbm((u+sd*57)*0.042,(v-sd*33)*0.042);       // the small break-up on top of both
    const r=dist+v+(g1-0.5)*depth*0.26;                  // the range advances and retreats
    const wx=ox*r+ax*u,wz=oz*r+az*u;
    let y=SKY_BASE+hr*Math.max(0,prof)*(0.58+g1*0.44+g3*0.20)+(g2-0.5)*hr*0.08;
    if(t<0.055)y=SKY_BASE-8;                             // the inner hem, buried under the far ground
    pos.push(wx,y,wz);
    const up=clamp((y-SKY_BASE)/tall,0,1);
    /* Rock stays dark. The first pass lightened the upper slopes most of the way to a pale
       blue-grey and every peak came out the colour of the sky it was standing against — a
       distant mountain is dark, and it is the fog that lifts it, not the paint. */
    c.copy(foot).lerp(rock,smooth(0.04,0.38,up));c.lerp(high,smooth(0.34,1.0,up)*0.50);
    c.multiplyScalar(0.84+g1*0.16+g3*0.10);
    col.push(c.r,c.g,c.b);
    snowAmt.push(cfg.snowAt==null?0:smooth(cfg.snowAt,cfg.snowAt+(cfg.snowBand||36),y));
   }
  }
  const row=nu+1;
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const p=j*row+i;idx.push(p,p+1,p+row,p+1,p+row+1,p+row);}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  geo.setIndex(idx);geo.computeVertexNormals();geo.computeBoundingSphere();
  /* Snow lies on shoulders and ledges and slides off cliffs, and a distant peak is mostly
     cliff. Without this rule the height test alone dips the whole summit in white and the
     Kestrel Horn comes out a scoop of ice cream — which is exactly what the first pass got.
     The same normal darkens steep rock, and that shading is where a silhouette gets its
     ridges from at a kilometre. */
  {const na=geo.getAttribute('normal'),ca=geo.getAttribute('color');
   for(let i=0;i<na.count;i++){
    const ny=Math.abs(na.getY(i));
    c.fromBufferAttribute(ca,i).multiplyScalar(0.74+0.34*ny);
    if(snowAmt[i]>0)c.lerp(snow,clamp(snowAmt[i]*smooth(0.42,0.80,ny),0,1));
    ca.setXYZ(i,c.r,c.g,c.b);
   }}
  const me=new THREE.Mesh(geo,rockMat);
  me.name='vista:'+cfg.id;me.castShadow=false;me.receiveShadow=false;
  me.matrixAutoUpdate=false;me.updateMatrix();            // it will never move; stop three asking every frame
  scene.add(me);
  return {id:cfg.id,label:cfg.label,bearing:b,dist,height:tall,mesh:me,tris:nu*nv*2};
 }

 /* Six silhouettes you could pick out of a line-up, on six bearings, so wherever you stand in
    the basin at least two of them are in front of you. The Horn is due north because that is
    the direction a rider most needs a fixed point in, and it is the only one that carries
    snow all the way down the year. */
 const MASSIFS=[
  {id:'horn',label:'⛰️ The Kestrel Horn',bearing:2.98,dist:920,span:780,depth:440,seed:11,nu:150,nv:16,
   rock:'#47566a',high:'#6b7a8e',foot:'#2c3c44',snow:'#f0f5f8',snowAt:205,snowBand:55,
   summits:[{u:0,h:338,w:150,k:2.0},{u:-255,h:208,w:185,k:1.4},{u:250,h:162,w:155,k:1.6}]},
  {id:'sisters',label:'⛰️ The Sisters’ Wall',bearing:-1.52,dist:810,span:1020,depth:380,seed:29,nu:152,nv:16,
   rock:'#3e5251',high:'#5c6f66',foot:'#293a2f',snow:'#eaf1f2',snowAt:190,snowBand:48,
   summits:[{u:-335,h:238,w:152},{u:-40,h:292,w:162,k:1.6},{u:292,h:224,w:150}]},
  {id:'ambersgate',label:'⛰️ Ambersgate',bearing:1.66,dist:850,span:820,depth:420,seed:47,nu:140,nv:16,
   rock:'#6e4a37',high:'#95684c',foot:'#4a352b',backfall:0.35,
   summits:[{u:-235,h:170,w:215,flat:0.55},{u:155,h:198,w:235,flat:0.50}]},
  {id:'longgrey',label:'⛰️ The Long Grey',bearing:0.10,dist:1120,span:1120,depth:460,seed:71,nu:144,nv:16,
   rock:'#41526a',high:'#5f7089',foot:'#32435a',snow:'#e8eff4',snowAt:165,snowBand:45,
   summits:[{u:-390,h:180,w:235},{u:0,h:216,w:255},{u:405,h:170,w:230}]},
  {id:'wolftooth',label:'⛰️ The Wolf Tooth',bearing:2.30,dist:1180,span:380,depth:240,seed:97,nu:96,nv:16,
   rock:'#3b4759',high:'#5c6a80',foot:'#2e3847',snow:'#eef4f8',snowAt:215,snowBand:55,
   summits:[{u:0,h:322,w:98,k:2.1},{u:-128,h:158,w:92}]},
  {id:'barrowback',label:'⛰️ Barrowback Down',bearing:-0.89,dist:840,span:920,depth:300,seed:131,nu:132,nv:16,
   rock:'#3e5238',high:'#5b6c45',foot:'#2c3a2a',backfall:0.45,
   summits:[{u:-265,h:98,w:215},{u:125,h:126,w:245},{u:385,h:90,w:185}]},
 ].map(cfg=>{try{return massif(cfg);}catch(e){console.error('massif '+cfg.id,e);return null;}}).filter(Boolean);
 P.MASSIFS=MASSIFS;
 P.skylineTris=MASSIFS.reduce((a,m)=>a+m.tris,0);
 const bearingOf=id=>{const m=MASSIFS.find(q=>q.id===id);return m?m.bearing:0;};

 /* ============================================================================
    2. the landmarks — eight places tall enough to see, and worth arriving at
    ============================================================================ */
 const LAND=[];
 /* Build one: find clear ground, run the builder into an accumulator, weld it, stand it on
    the terrain, hang a sign on it, put it on both maps, and make arriving count.
    Deliberately NOT registered with followCamera: the whole landmark is one merged mesh, so
    its bounding box is a solid slab the size of the water tower and the chase camera would
    shove itself out of a volume that is nine tenths air. */
 function landmark(def){
  const at=clearAt(def.x,def.z,def.clear||6,def.maxR||54);
  const x=at[0],z=at[1],y=groundH(x,z);
  const A=Acc(def.seed||1,x,y,z);
  try{def.build(A,{x,z,y});}catch(e){console.error('landmark '+def.id,e);}
  const me=A.mesh();me.name='vista:'+def.id;
  const g=new THREE.Group();g.add(me);g.position.set(x,y,z);scene.add(g);
  if(def.label){const sp=G.nameSprite(def.label);sp.position.set(0,def.labelY||7,0);sp.scale.set(def.labelW||5.0,(def.labelW||5.0)/4.2,1);g.add(sp);}
  for(const c of def.colliders||[])W.colliders.push({x:x+c[0],z:z+c[1],r:c[2]});
  const L={id:def.id,name:def.name,glyph:def.glyph,x,y,z,g,mesh:me,reach:def.reach||14,
   blurb:def.blurb,arrive:def.arrive,tall:def.tall||0,verts:A.verts()};
  LAND.push(L);
  /* Arriving is the reward. Ride within reach and it logs itself — a landmark you have to
     hunt for a button at is a chore — and E reads the marker whenever you want it again. */
  W.addThing({kind:'vista',id:def.id,g:null,x,z,reach:L.reach,
   label:()=>(seen(def.id)?'📖 Read the marker at '+def.name+' (E)':'🧭 '+def.name+' (E)'),
   use:()=>{if(!seen(def.id))visit(L);card(L);},
   tick(dt,t,d){if(d<L.reach){if(!L.hit){L.hit=true;visit(L);}}else if(d>L.reach*1.6)L.hit=false;}});
  W.mapMarkers.push({x,z,glyph:def.glyph,label:def.mapLabel||null,labelDz:def.labelDz||0,kind:'vista',id:def.id});
  W.miniMarkers.push({x,z,col:def.mini||'#f2e3b8',r:3});
  return L;
 }
 S.ensure(s=>{s.vistas=s.vistas||{};});
 const seen=id=>{const s=S.fresh()||{};return !!(s.vistas&&s.vistas[id]);};
 function card(L){
  const d=$('dlg');if(!d)return;
  d.innerHTML='<b>'+L.glyph+' '+L.name+'</b><p style="font-style:italic">'+L.blurb+'</p>'+
   (L.arrive?'<div style="font-size:12px;color:#8c7a63">'+L.arrive+'</div>':'')+
   '<button id="dlgBtn">Back to the saddle 🐴</button>';
  d.style.display='block';const b=$('dlgBtn');if(b)b.onclick=()=>{d.style.display='none';};
 }
 /* Logged on arrival with a toast rather than a dialogue: a card that opens itself in the
    middle of a canter is an interruption, and the marker is still there to read. */
 function visit(L){
  if(seen(L.id))return;
  let n=0,all=false;
  S.sync(s=>{s.vistas=s.vistas||{};s.vistas[L.id]=Date.now();n=Object.keys(s.vistas).length;
   M.payReward(s,{c:140,p:14});
   if(n>=LAND.length&&!(s.setsDone&&s.setsDone.vistas)){s.setsDone=s.setsDone||{};s.setsDone.vistas=true;M.payReward(s,{g:4,k:1});all=true;}});
  M.refreshWallet();G.sChime();G.xp.addXp3D(22);G.xp.passAdd(14);
  toast(L.glyph+' '+L.name+' — '+n+'/'+LAND.length+' landmarks. +140🪙 · press E to read the marker'+(all?' — and that is every one of them! +4💎 +1🗝️':''));
  if(all)G.sGem();
 }

 /* ---- palettes, so the whole set looks quarried out of one valley ---- */
 const STONE='#8d8a80',STONE_D='#6e6b62',STONE_L='#a9a69a',MOSS='#6f7a52';
 const TIMBER='#7a5c3c',TIMBER_D='#57422c',IRON='#59606a',IRON_D='#3f454e';
 const DIRT='#8a7a5e',DIRT_RIM='#7d8a5a',CHALK='#efebdc';

 /* A rough stone. A squashed sphere is a pebble and a box is a brick; two overlapping boxes at
    a slight angle read as quarried rock from any distance anybody will see one from. */
 function rock(A,x,y,z,w,h,d,hex,rot){
  const r=rot==null?A.rr(0,Math.PI):rot;
  A.box(w,h,d,hex,x,y,z,A.rr(-0.06,0.06),r,A.rr(-0.06,0.06),0.97);
  A.box(w*0.78,h*0.86,d*1.08,hex,x+A.rr(-0.08,0.08)*w,y+h*0.10,z,0,r+A.rr(-0.5,0.5),0,1.04);
  return A;
 }
 /* A cairn: stones getting smaller as they go up, each turned a little, finished with a
    pointed capstone so the silhouette ends in something rather than simply stopping. */
 function cairn(A,x,z,h,n,hex){
  const k=h/4.2;let y=0;
  for(let i=0;i<n;i++){
   const t=i/(n-1),w=(1.5-t*1.05)*k,th=(0.40-t*0.16)*k;
   rock(A,x+A.rr(-0.12,0.12),y+th/2,z+A.rr(-0.12,0.12),w,th,w*0.85,i%3?hex:STONE_D);
   y+=th*0.86;
  }
  A.cone(0.30*k,0.62*k,6,STONE_L,x,y+0.25*k,z,0,A.rr(0,2),0);
  return y;
 }
 /* A branch that forks twice. The dead oak and the bluff pine are the same routine with
    different arguments, which is the only reason it is a routine. */
 function bough(A,x,y,z,dx,dy,dz,r,hex,depth){
  const bx=x+dx,by=y+dy,bz=z+dz;
  A.strut(x,y,z,bx,by,bz,r,r*0.55,hex,5);
  if(depth>0)for(let k=0;k<2;k++){
   const s=0.60+A.rr(0,0.22),a=A.rr(-1.0,1.0);
   bough(A,bx,by,bz,(dx*Math.cos(a)-dz*Math.sin(a))*s,dy*s*0.72+A.rr(0,0.5),(dx*Math.sin(a)+dz*Math.cos(a))*s,r*0.55,hex,depth-1);
  }
  return [bx,by,bz];
 }

 /* ---- 2a. Larkspur Head: the roof of the basin, and the only thing that names the skyline ---- */
 /* A sweep of groundH puts the highest honest ground in Kestrel Basin here — eleven metres,
    six and a half above its own surroundings, a hundred and seventy west of the ranch gate and
    gentle enough to canter up. A cairn to mark it, a finger-post that tells you what the climb
    bought, and a horseshoe of drystone to get out of the wind in. */
 landmark({
  id:'larkspur',name:'Larkspur Head',glyph:'⛰️',mapLabel:'⛰️ Larkspur Head',labelDz:-15,
  x:-172,z:-4,clear:9,seed:1207,label:'⛰️ Larkspur Head',labelY:6.4,tall:11,reach:16,mini:'#e8d7a8',
  colliders:[[0,0,2.0],[-8,-2.5,4.0]],
  blurb:'The highest honest ground in Kestrel Basin, and no sort of hill at all by the standards of anything on the skyline — but it is the one you can ride up. On a clear morning the whole valley lies under you: the ranch weathervane, the pale bend of the river, the Cottonwood roofs, and the Kestrel Horn standing over the lot of it. Somebody has been adding a stone to the cairn for a very long time.',
  arrive:'The finger-post names six things and swears the Kestrel Horn is forty miles off.',
  build(A,at){
   A.patch(0,0,13,DIRT,DIRT_RIM,0.07,22,3);
   cairn(A,0,0,4.4,11,STONE);
   /* The finger-post. Each arm is turned to the true bearing of the thing it names, so a rider
      who believes it and sets off is actually pointed at what they were promised. */
   const px=4.6,pz=1.8;
   A.cyl(0.20,0.24,5.6,8,TIMBER,px,2.80,pz);
   A.sph(0.26,0.26,0.26,TIMBER_D,px,5.70,pz);
   const arms=[[bearingOf('horn'),1.05],[bearingOf('sisters'),0.90],[bearingOf('ambersgate'),0.90],
    [Math.atan2(-at.x,-at.z),1.00],[Math.atan2(47-at.x,-50-at.z),0.84],[Math.atan2(20-at.x,16-at.z),0.76]];
   arms.forEach((a,i)=>{
    const b=a[0],yy=5.00-i*0.62,len=2.45*a[1];
    A.box(len,0.40,0.075,'#efe9d6',px+Math.sin(b)*(len/2+0.20),yy,pz+Math.cos(b)*(len/2+0.20),0,b+Math.PI/2,0,1);
    A.box(len*0.82,0.10,0.085,TIMBER_D,px+Math.sin(b)*(len*0.44+0.20),yy-0.11,pz+Math.cos(b)*(len*0.44+0.20),0,b+Math.PI/2,0,0.9);
    A.cone(0.21,0.44,4,'#efe9d6',px+Math.sin(b)*(len+0.42),yy,pz+Math.cos(b)*(len+0.42),Math.PI/2,b+Math.PI/2,0,0.96);
   });
   /* The shelter: a horseshoe of drystone open toward the ranch, so it breaks the westerly and
      you can still see the thing you came up here to look at. */
   const open=Math.atan2(-at.x,-at.z),cx=-8,cz=-2.5;
   for(let k=0;k<30;k++){
    const a=k/30*Math.PI*2;
    if(Math.abs(((a-open+Math.PI*3)%(Math.PI*2))-Math.PI)>2.35)continue;
    const rr=3.5+Math.sin(k*2.1)*0.14,hh=1.05+Math.sin(k*1.3)*0.16;
    const sx=cx+Math.cos(a)*rr,sz=cz+Math.sin(a)*rr,gy=groundH(at.x+sx,at.z+sz)-at.y;
    for(let c2=0;c2<3;c2++)rock(A,sx,gy+hh*(c2+0.5)/3,sz,1.0,hh/3,0.62,c2%2?STONE:STONE_D,Math.PI/2-a+A.rr(-0.1,0.1));
   }
   rock(A,cx,groundH(at.x+cx,at.z+cz)-at.y+0.26,cz,2.3,0.34,1.0,STONE_L,0.3);   // the table stone inside it
   for(let k=0;k<9;k++){const a=A.rr(0,6.3),r2=A.rr(5,12),sx=Math.cos(a)*r2,sz=Math.sin(a)*r2;
    A.sph(A.rr(0.2,0.5),A.rr(0.12,0.3),A.rr(0.2,0.5),k%2?MOSS:STONE_D,sx,groundH(at.x+sx,at.z+sz)-at.y+0.12,sz);}
  }});

 /* ---- 2b. the Chalk Mare, on a bluff that had to be built to hold her ---- */
 /* There is no slope in this basin steep enough for a hill figure. Every face the sweep turned
    up belonged to Sparrow Creek, whose bed runs perched above the meadow in the north, and a
    chalk horse in a streambed is not a landmark, it is a mistake. So the bluff is built: a
    crescent of raised ground ninety-six metres along with a thirty-six degree scarp on the
    side that faces the middle of the valley, the mare laid on that scarp as flat triangles a
    hand's breadth off it. A horse cannot climb it, which is right — you ride to the foot, and
    then you ride back out to the stone, because up close she is only a white smear. */
 const SCARP={x:-76,z:172,len:112,depth:76,h:26,crest:0.40};
 {
  const at=clearAt(SCARP.x,SCARP.z,18,44);SCARP.x=at[0];SCARP.z=at[1];
  const face=Math.atan2(SCARP.x,SCARP.z);                 // outward: away from the middle of the basin
  const ax=Math.cos(face),az=-Math.sin(face),ox=Math.sin(face),oz=Math.cos(face);
  const y0=groundH(SCARP.x,SCARP.z);
  /* The mound in its own frame: u along the crest, t across it, 0 at the toe of the scarp and
     1 at the back. Twenty-one metres of rise over twenty-four of run is a thirty-eight degree
     face, which is about what a chalk down does; behind the crest it lets itself down slowly
     so the thing reads as a landform rather than as a wall dropped on the grass. */
  const prof=t=>t<=SCARP.crest?Math.pow(t/SCARP.crest,0.80):1-0.90*Math.pow((t-SCARP.crest)/(1-SCARP.crest),1.6);
  /* Flat-topped over the middle forty metres rather than lens-shaped end to end: the figure
     needs level ground under it, and the first pass curved the crest away under her so she
     came out bent round a pudding. */
  const along=u=>{const q=Math.max(0,Math.abs(u)-30)/(SCARP.len/2-30);
   return Math.max(0,1-q*q*0.94)*(0.90+ridged(u*0.023+9,4.4)*0.20);};
  const surf=(u,t)=>{
   const v=(t-0.5)*SCARP.depth;
   const wx=SCARP.x+ox*v+ax*u,wz=SCARP.z+oz*v+az*u;
   /* Gullies down the face and a rumpled crown. The first mound had none of this and read as
      a blancmange; relief is most of what tells a landform from a lump. */
   const relief=(ridged(u*0.052+3,t*7.5+1)-0.5)*SCARP.h*0.30*prof(t)
    +(fbm(u*0.10+13,v*0.10-7)-0.5)*SCARP.h*0.11*prof(t);
   const lift=SCARP.h*prof(t)*along(u)+relief;
   return [wx,groundH(wx,wz)+Math.max(0,lift),wz];
  };
  const A=Acc(5501,SCARP.x,y0,SCARP.z);
  const NU=64,NV=22,turf=new THREE.Color('#6a7a4a'),bareC=new THREE.Color('#d8d2bd'),cc=new THREE.Color();
  const loc=p=>[p[0]-SCARP.x,p[1]-y0,p[2]-SCARP.z];
  /* (u,v) is orientation-preserving whatever the bearing, so clockwise in parameter space is
     the face you see. Get this the wrong way round and the whole bluff is invisible. */
  for(let j=0;j<NV;j++)for(let i=0;i<NU;i++){
   const u0=(i/NU-0.5)*SCARP.len*1.02,u1=((i+1)/NU-0.5)*SCARP.len*1.02,t0=j/NV,t1=(j+1)/NV;
   const p00=loc(surf(u0,t0)),p10=loc(surf(u1,t0)),p01=loc(surf(u0,t1)),p11=loc(surf(u1,t1));
   /* Turf, the whole way up, and nothing else. Two goes at scattering chalk scars over the
      face ended as horizontal stripes and then as a white hill with green patches, and both
      of them buried the only white thing here that is supposed to mean anything. Uffington
      works because the down is green: the figure is the only chalk showing. The variation is
      just sun-bleached grass on the steep ground. */
   const bleach=smooth(0.06,0.34,t0)*smooth(SCARP.crest+0.16,SCARP.crest*0.7,t0);
   cc.copy(turf).lerp(bareC,clamp(bleach*0.20+ridged(u0*0.10+3,t0*24)*0.10,0,1))
    .multiplyScalar(0.88+ridged(u0*0.16,t0*31)*0.20);
   const hx='#'+cc.getHexString();
   A.tris([p00[0],p00[1],p00[2],p11[0],p11[1],p11[2],p10[0],p10[1],p10[2]],hx,1);
   A.tris([p00[0],p00[1],p00[2],p01[0],p01[1],p01[2],p11[0],p11[1],p11[2]],hx,1);
  }
  /* The mare, in convex pieces fanned from their first point. An outline would want a
     triangulator, and a triangulator that gives up leaves a blank hillside; a fan cannot fail.
     The lists run clockwise, which is the winding the mound established above. */
  const FIG=[
   [[-8.5,4.2],[-3,5.2],[3,5.2],[6.6,4.4],[7.8,2.9],[6.4,1.9],[0,1.4],[-6.6,1.7],[-8.5,2.8]],   // barrel
   [[5.6,4.6],[8.2,7.0],[10.4,8.4],[11.9,7.2],[9.6,5.6],[7.6,3.6]],                      // neck, thrown out level
   [[10.8,8.4],[14.6,9.2],[15.6,8.0],[14.2,6.9],[11.4,7.0]],                             // head, muzzle forward
   [[13.4,9.1],[13.9,10.6],[14.7,9.1]],                                                  // ear
   /* Every limb is rooted a good way inside the barrel rather than butted against it: the
      pieces sit on a curved surface, and two edges that only just meet in figure coordinates
      open into a green seam once they are laid on the hill. */
   [[-6.5,3.6],[-12.4,7.4],[-14.6,7.0],[-13.0,5.2],[-7.4,1.9]],                          // tail, streaming up
   [[5.2,2.6],[9.8,-1.6],[11.0,-0.4],[7.0,2.8]],                                         // off fore, reaching
   [[2.2,2.6],[3.4,-3.0],[4.8,-2.8],[4.0,2.7]],                                          // near fore, gathered
   [[-6.4,2.6],[-11.4,-1.2],[-10.6,-2.5],[-5.2,2.3]],                                    // off hind, trailing
   [[-3.2,2.6],[-5.2,-2.8],[-3.8,-3.3],[-1.9,2.4]],                                      // near hind
  ];
  /* Drawn tall and narrow on purpose. Seen from the valley floor the face is heavily
     foreshortened — sixty metres out and twenty below the lip, a metre of height on that slope
     covers about two thirds of a metre on screen — so a mare laid out in true proportion comes
     out a slug. Every hill figure ever cut is distorted for the same reason. */
  const U0=-1,H0=8.5,SCALE=0.86,VS=1.24;
  /* Laying her out in (along-crest, across-band) squashed the legs and stretched the head,
     because how far up the face a given t reaches is a power curve, not a ruler. So the figure
     is laid out in metres of actual height and the band coordinate is solved for: a dozen
     bisections a point, once, at install. This is how a hill figure is really set out — you
     peg the outline at heights up the slope, not at fractions of the hill. */
  const tAtHeight=(u,want)=>{
   let lo=0.012,hi=SCARP.crest;
   const at=t=>surf(u,t)[1]-groundH(surf(u,t)[0],surf(u,t)[2]);
   if(at(hi)<want)return hi;
   for(let k=0;k<14;k++){const mid=(lo+hi)/2;if(at(mid)<want)lo=mid;else hi=mid;}
   return (lo+hi)/2;
  };
  const nrm=(u,t)=>{                                      // the surface normal, so she lies on the slope
   const a=surf(u-0.6,t),b=surf(u+0.6,t),c=surf(u,t-0.006),d=surf(u,t+0.006);
   const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=d[0]-c[0],vy=d[1]-c[1],vz=d[2]-c[2];
   let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
   const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
   return ny<0?[-nx,-ny,-nz]:[nx,ny,nz];
  };
  /* Normalise the winding instead of trusting nine hand-typed outlines to agree about it. The
     first version of this list had the barrel, neck, head and ear clockwise and all four legs
     and the tail anticlockwise, so five of the nine pieces came out back-facing and were
     culled — which left a white shape on the hillside that was, unmistakably, a swan. */
  const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a;};
  for(const raw of FIG){
   const poly=area(raw)>0?raw.slice().reverse():raw;
   const pts=poly.map(([fx,fy])=>{
    const u=U0+fx*SCALE,t=tAtHeight(u,H0+fy*VS);
    const p=loc(surf(u,t)),n=nrm(u,t);
    return [p[0]+n[0]*0.36,p[1]+n[1]*0.36,p[2]+n[2]*0.36];
   });
   for(let i=1;i<pts.length-1;i++)
    A.tris([pts[0][0],pts[0][1],pts[0][2],pts[i][0],pts[i][1],pts[i][2],pts[i+1][0],pts[i+1][1],pts[i+1][2]],CHALK,1);
  }
  /* Chalk spoil where the cutting goes over the lip, and a scatter of it fallen to the toe. */
  for(let k=0;k<16;k++){const u=A.rr(-30,30),t=A.rr(0.02,0.07);
   const p=loc(surf(u,t));A.sph(A.rr(0.5,1.4),A.rr(0.25,0.6),A.rr(0.5,1.2),CHALK,p[0],p[1]+0.2,p[2],0,0,0,0.94);}
  const me=A.mesh();me.name='vista:chalkscarp';me.castShadow=false;me.receiveShadow=true;
  const g=new THREE.Group();g.add(me);g.position.set(SCARP.x,y0,SCARP.z);scene.add(g);
  /* Colliders over the raised part. A circle is the only shape the collision system speaks,
     so two rows of them follow the crescent and leave the grass at the toe free to ride. */
  for(let k=0;k<9;k++){const u=(k/8-0.5)*SCARP.len*0.90;
   for(const t of [0.17,0.50]){const v=(t-0.5)*SCARP.depth;
    W.colliders.push({x:SCARP.x+ax*u+ox*v,z:SCARP.z+az*u+oz*v,r:10});}}
  P.SCARP=SCARP;
  /* The viewing stone, sixty metres off the toe of the scarp. That distance is the whole point
     of it: from the foot she is a white smear, and from here she is a horse. */
  const vx=SCARP.x-ox*95,vz=SCARP.z-oz*95;
  landmark({
   id:'chalkmare',name:'The Chalk Mare',glyph:'🐎',mapLabel:'🐎 The Chalk Mare',labelDz:16,
   x:vx,z:vz,clear:5,maxR:18,seed:812,label:'🐎 The Chalk Mare',labelY:3.6,labelW:4.4,tall:19,reach:17,mini:'#f4f0e0',
   colliders:[[0,0,1.2]],
   blurb:'Forty-odd metres of galloping mare scoured into the chalk of Whitehorse Scarp, and nobody at the ranch will tell you who cut her. Grandpa Wren says the grass has to be pared back every spring or she closes over in a season; that somebody always does it; and that in seventy years he has never once seen who.',
   arrive:'Stand at the stone to look. Any nearer and she is a white smear on a hillside.',
   build(A,a2){
    A.patch(0,0,7,DIRT,DIRT_RIM,0.07,16,2);
    rock(A,0,0.85,0,1.5,1.7,0.9,STONE,face+Math.PI/2);
    A.box(0.86,0.56,0.09,'#cfc7ae',ox*0.52,1.30,oz*0.52,0.22,face+Math.PI/2,0,1.06);
    const bx=-ox*2.6,bz=-oz*2.6;                          // a bench, because the only thing to do here is look
    A.box(0.34,0.44,0.34,STONE_D,bx+ax*0.95,0.22,bz+az*0.95);
    A.box(0.34,0.44,0.34,STONE_D,bx-ax*0.95,0.22,bz-az*0.95);
    A.box(2.4,0.12,0.48,TIMBER,bx,0.50,bz,0,face+Math.PI/2,0,1.04);
    A.box(2.4,0.40,0.10,TIMBER_D,bx-ox*0.26,0.86,bz-oz*0.26,0,face+Math.PI/2,0,1.0);
    for(let k=0;k<7;k++){const a3=A.rr(0,6.3),r2=A.rr(3,7),sx=Math.cos(a3)*r2,sz=Math.sin(a3)*r2;
     A.sph(A.rr(0.16,0.34),A.rr(0.1,0.22),A.rr(0.16,0.34),MOSS,sx,groundH(a2.x+sx,a2.z+sz)-a2.y+0.1,sz);}
   }});
 }

 /* ---- 2c. Kestrel Water Tower: the tallest thing anybody out here ever built ---- */
 landmark({
  id:'watertower',name:'Kestrel Water Tower',glyph:'🗼',mapLabel:'🗼 Water Tower',labelDz:-15,
  x:308,z:-20,clear:8,seed:3301,label:'🗼 Kestrel Water Tower',labelY:9.2,tall:26,reach:16,mini:'#cfd8e0',
  colliders:[[4,4,0.9],[-4,4,0.9],[4,-4,0.9],[-4,-4,0.9],[4.6,2.6,2.3]],
  blurb:'Twenty-six metres of riveted steel on four splayed legs, in the middle of nowhere in particular, filled by a windpump that gave up years ago. The valley uses it as a landmark and for nothing else: from Larkspur Head it is the only vertical line east of the river, and every set of directions anybody gives you out here begins "make for the tower".',
  arrive:'The trough under it still fills. Somebody keeps it that way.',
  build(A){
   A.patch(0,0,9.5,'#9a8c72',DIRT_RIM,0.06,20,3);
   const TOP=15.4,SPL=4.0,TSPL=1.7,K=Math.SQRT2;
   for(let f=0;f<4;f++){
    const a=f*Math.PI/2+Math.PI/4;
    const fx=Math.cos(a)*SPL*K,fz=Math.sin(a)*SPL*K,tx=Math.cos(a)*TSPL*K,tz=Math.sin(a)*TSPL*K;
    A.box(1.3,0.5,1.3,'#9a958c',fx,0.18,fz);              // a concrete pad under each leg
    A.strut(fx,0.3,fz,tx,TOP,tz,0.25,0.17,IRON,7);
   }
   /* Cross-bracing: an X on all four faces at four heights, and the horizontal at each level.
      Forty-eight members, every one of them into the same buffer. */
   for(let lvl=0;lvl<4;lvl++){
    const t0=lvl/4,t1=(lvl+1)/4;
    const r0=SPL+(TSPL-SPL)*t0,r1=SPL+(TSPL-SPL)*t1,y0=0.3+(TOP-0.3)*t0,y1=0.3+(TOP-0.3)*t1;
    for(let f=0;f<4;f++){
     const a0=f*Math.PI/2+Math.PI/4,a1=(f+1)*Math.PI/2+Math.PI/4;
     const p0=[Math.cos(a0)*r0*K,y0,Math.sin(a0)*r0*K],p1=[Math.cos(a1)*r0*K,y0,Math.sin(a1)*r0*K];
     const q0=[Math.cos(a0)*r1*K,y1,Math.sin(a0)*r1*K],q1=[Math.cos(a1)*r1*K,y1,Math.sin(a1)*r1*K];
     A.strut(p0[0],p0[1],p0[2],q1[0],q1[1],q1[2],0.055,0.055,IRON_D,5);
     A.strut(p1[0],p1[1],p1[2],q0[0],q0[1],q0[2],0.055,0.055,IRON_D,5);
     A.strut(q0[0],q0[1],q0[2],q1[0],q1[1],q1[2],0.065,0.065,IRON_D,5);
    }
   }
   /* The tank, its hoops, a conical roof, and a kestrel on the vane. */
   A.cyl(4.05,4.05,6.9,20,'#9fb0ab',0,TOP+3.45,0,0,0,0,1.02);
   for(const yy of [0.6,3.45,6.3])A.cyl(4.14,4.14,0.26,20,IRON,0,TOP+yy,0,0,0,0,0.9);
   A.cyl(4.2,4.2,0.34,20,IRON_D,0,TOP+0.1,0,0,0,0,0.88);
   A.cone(4.05,1.5,20,IRON_D,0,TOP-0.55,0,Math.PI,0,0,0.86);   // the dished bottom; without it the tank is a hole
   A.cone(4.42,2.0,20,'#8b3f33',0,TOP+7.9,0,0,0,0,1.02);
   A.sph(0.32,0.42,0.32,'#c9a13c',0,TOP+9.1,0);
   A.cyl(0.05,0.05,1.5,5,IRON,0,TOP+9.9,0);
   A.box(1.15,0.42,0.045,IRON_D,0.45,TOP+10.5,0,0,0.5,0,1.1);
   A.cone(0.22,0.5,4,IRON_D,-0.55,TOP+10.5,0.30,Math.PI/2,0.5,0);
   /* The catwalk and the ladder up to it. You cannot climb either — but a tower with no way up
      reads as a prop, and the ladder is what makes it a building instead. */
   A.tor(4.55,0.07,18,IRON,0,TOP+2.02,0,Math.PI/2,0,0,0.95);
   A.tor(4.55,0.05,18,IRON,0,TOP+2.92,0,Math.PI/2,0,0,0.95);
   /* Boards wide enough to meet their neighbours. At half a metre they stood out round the
      tank like the spokes of a wheel instead of reading as a deck you could walk. */
   for(let k=0;k<18;k++){const a=k/18*Math.PI*2;
    A.box(1.35,0.07,1.62,'#6b6f66',Math.cos(a)*4.45,TOP+1.02,Math.sin(a)*4.45,0,-a,0,0.94);
    A.cyl(0.045,0.045,1.0,4,IRON,Math.cos(a)*4.55,TOP+1.55,Math.sin(a)*4.55);
    A.strut(Math.cos(a)*4.6,TOP+0.96,Math.sin(a)*4.6,Math.cos(a)*4.1,TOP-0.2,Math.sin(a)*4.1,0.04,0.04,IRON_D,4);}   // brackets, so the deck hangs off something
   for(const dx of [-0.28,0.28])A.cyl(0.055,0.055,TOP+1.0,5,IRON,dx,(TOP+1.0)/2,-4.3);
   for(let k=0;k<Math.floor((TOP+0.6)/0.62);k++)A.box(0.62,0.045,0.045,IRON_D,0,0.9+k*0.62,-4.3);
   /* The downpipe, and the trough it still feeds. */
   A.cyl(0.13,0.13,TOP-0.8,6,IRON_D,3.0,(TOP-0.8)/2+0.6,1.6);
   A.cyl(0.13,0.13,2.0,6,IRON_D,3.8,0.9,2.1,0,0,1.1);
   A.box(3.6,0.66,1.5,TIMBER,4.6,0.34,2.6,0,0.2,0);
   A.box(3.3,0.10,1.25,'#4f7f93',4.6,0.66,2.6,0,0.2,0,1.25);
   for(const pz of [1.0,4.2])A.box(0.14,1.3,0.14,TIMBER_D,6.9,0.65,pz);
   A.cyl(0.07,0.07,3.3,6,TIMBER,6.9,1.22,2.6,Math.PI/2,0,0);
  }});

 /* ---- 2d. the Thunder Oak ---- */
 landmark({
  id:'thunderoak',name:'The Thunder Oak',glyph:'⚡',mapLabel:'⚡ The Thunder Oak',labelDz:15,
  x:4,z:-188,clear:7,seed:6607,label:'⚡ The Thunder Oak',labelY:6.6,tall:17,reach:15,mini:'#9a7a5a',
  colliders:[[0,0,2.5],[3.4,2.2,1.0]],
  blurb:'It was the biggest oak between the ranch and the pines until the storm in the spring of the flood, and it is still the biggest thing standing on this stretch of meadow. The lightning went straight down the heart of it and opened the bole like a log split for the fire. Both halves are alive at the tips; one bough on the south side leafs out every year as though nothing had happened. People have been tying things to it ever since.',
  arrive:'Somebody has left a ribbon. There are a very great many ribbons.',
  build(A,at){
   A.patch(0,0,13,'#4d4033','#77804e',0.07,24,3);        // the burn, still bare after all this time
   /* The split. Both halves start a metre apart on the root plate and lean away hard: the
      first pass had them almost touching all the way up and the tree read as one trunk, which
      throws away the only thing about it worth riding out to see. The charcoal runs up the
      inside faces, which is the way the lightning went. */
   const LEAN=[1.30,1.05,0.78,0.50];
   for(const side of [-1,1]){
    let x=side*0.95,y=1.05,z=0,r=1.28;
    for(let k=0;k<4;k++){
     const nx=x+side*LEAN[k],ny=y+3.5-k*0.55,nz=z+(k===1?0.6*side:k===2?-0.45*side:0);
     A.strut(x,y,z,nx,ny,nz,r,r*0.66,'#5c4a38',9);
     A.strut(x-side*(r*0.62),y,z,nx-side*(r*0.62),ny,nz,r*0.46,r*0.30,k<2?'#241d18':'#3a2e23',6);
     x=nx;y=ny;z=nz;r*=0.66;
    }
    for(let b=0;b<4;b++){
     const a=side*(0.6+b*0.5)+A.rr(-0.3,0.3);
     bough(A,x,y-A.rr(0,1.2),z,Math.sin(a)*A.rr(2.2,4.0),A.rr(1.2,3.0),Math.cos(a)*A.rr(2.2,4.0),r*0.8,'#57462f',2);
    }
   }
   for(let k=0;k<9;k++){const a=k/9*Math.PI*2+0.3;       // roots, so it grows rather than stands planted
    A.strut(Math.sin(a)*0.7,1.15,Math.cos(a)*0.7,Math.sin(a)*A.rr(2.4,3.8),0.05,Math.cos(a)*A.rr(2.4,3.8),0.38,0.14,'#5c4a38',6);}
   A.cyl(2.4,3.1,1.3,14,'#584634',0,0.5,0,0,0,0,0.94);   // the root plate the two halves stand on
   /* The one bough that still leafs, and the stub of the one that does not. Fourteen small
      canopies spread along its length: a pile of them at the tip reads as a bunch of grapes,
      which is what the first pass got, and a full crown would cost as much as a real tree. */
   const tip=bough(A,1.6,6.4,0.7,3.6,2.6,2.4,0.38,'#57462f',1);
   for(let k=0;k<14;k++){const t=0.25+A.rr(0,0.85);
    A.sph(A.rr(0.55,1.15),A.rr(0.40,0.72),A.rr(0.55,1.15),k%3?'#4f6d39':'#5f8043',
     1.6+(tip[0]-1.6)*t+A.rr(-1.3,1.3),6.4+(tip[1]-6.4)*t+A.rr(-0.5,1.0),0.7+(tip[2]-0.7)*t+A.rr(-1.3,1.3));}
   /* The shrine at the foot: a boulder, three posts, and the ribbons. */
   rock(A,3.4,0.62,2.2,1.9,1.25,1.5,STONE,0.7);
   for(let k=0;k<3;k++){const px=2.0+k*1.4,pz=4.4-k*0.5;
    A.cyl(0.08,0.10,1.9,6,TIMBER_D,px,0.95,pz);
    for(let r2=0;r2<4;r2++)A.box(0.06,A.rr(0.5,1.0),0.02,['#b8433a','#3a6a9a','#d8b24a','#6a9a5a'][r2],px+A.rr(-0.1,0.1),1.55-r2*0.12,pz+A.rr(-0.12,0.12),0,A.rr(0,3),A.rr(-0.25,0.25),1.15);}
   for(let k=0;k<5;k++){const a=A.rr(0,6.3),r2=A.rr(4,9),sx=Math.cos(a)*r2,sz=Math.sin(a)*r2;
    rock(A,sx,groundH(at.x+sx,at.z+sz)-at.y+0.16,sz,A.rr(0.5,1.1),A.rr(0.3,0.5),A.rr(0.5,1.0),STONE_D);}
  }});

 /* ---- 2e. the Whistling Windmill ---- */
 const MILL=landmark({
  id:'windmill',name:'The Whistling Windmill',glyph:'🌀',mapLabel:'🌀 The Windmill',labelDz:-15,
  x:330,z:-120,clear:8,seed:4409,label:'🌀 The Whistling Windmill',labelY:8.4,tall:21,reach:16,mini:'#d8cfa8',
  colliders:[[1.9,1.9,0.8],[-1.9,1.9,0.8],[1.9,-1.9,0.8],[-1.9,-1.9,0.8],[5.2,0,3.6]],
  blurb:'A steel windpump on a lattice tower, hauling water out of the ground for a stock tank nobody has driven cattle to in years. The head bearing has a flat spot in it, and every third turn it lets out a note like somebody blowing across a bottle. That is how you find the place in fog, and why nobody who has camped here twice camps here again.',
  arrive:'The tank is full and clean. Your horse has opinions about that.',
  build(A){
   A.patch(0,0,8,'#8a7a5e',DIRT_RIM,0.06,18,3);
   const TOP=14.6,B0=1.9,B1=0.62,K=Math.SQRT2;
   for(let f=0;f<4;f++){
    const a=f*Math.PI/2+Math.PI/4;
    const fx=Math.cos(a)*B0*K,fz=Math.sin(a)*B0*K,tx=Math.cos(a)*B1*K,tz=Math.sin(a)*B1*K;
    A.box(0.9,0.4,0.9,'#9a958c',fx,0.14,fz);
    A.strut(fx,0.25,fz,tx,TOP,tz,0.14,0.10,IRON,6);
   }
   for(let lvl=0;lvl<5;lvl++){
    const t0=lvl/5,t1=(lvl+1)/5;
    const y0=0.25+(TOP-0.25)*t0,y1=0.25+(TOP-0.25)*t1,s0=B0+(B1-B0)*t0,s1=B0+(B1-B0)*t1;
    for(let f=0;f<4;f++){
     const a0=f*Math.PI/2+Math.PI/4,a1=(f+1)*Math.PI/2+Math.PI/4;
     const p0=[Math.cos(a0)*s0*K,y0,Math.sin(a0)*s0*K],p1=[Math.cos(a1)*s0*K,y0,Math.sin(a1)*s0*K];
     const q0=[Math.cos(a0)*s1*K,y1,Math.sin(a0)*s1*K],q1=[Math.cos(a1)*s1*K,y1,Math.sin(a1)*s1*K];
     A.strut(p0[0],p0[1],p0[2],q1[0],q1[1],q1[2],0.04,0.04,IRON_D,4);
     A.strut(p1[0],p1[1],p1[2],q0[0],q0[1],q0[2],0.04,0.04,IRON_D,4);
     A.strut(q0[0],q0[1],q0[2],q1[0],q1[1],q1[2],0.05,0.05,IRON_D,4);
    }
   }
   A.box(2.0,0.10,2.0,'#6b6f66',0,TOP+0.05,0,0,0,0,0.95);
   for(let f=0;f<4;f++){const a=f*Math.PI/2+Math.PI/4;A.cyl(0.04,0.04,0.9,4,IRON,Math.cos(a)*B1*K,TOP+0.5,Math.sin(a)*B1*K);}
   A.box(1.3,0.9,1.0,IRON,0,TOP+0.9,0,0,0,0,1.04);        // the gearbox the whistle lives in
   A.cyl(0.18,0.18,1.1,8,IRON_D,0,TOP+0.9,0.9,Math.PI/2,0,0);
   A.box(0.09,0.14,2.8,IRON_D,0,TOP+0.95,-1.7);           // the tail boom
   A.box(0.06,1.8,2.2,'#b8563f',0,TOP+1.25,-3.4,0,0,0,1.06);
   A.box(0.07,0.24,2.2,IRON,0,TOP+2.2,-3.4);
   A.cyl(0.05,0.05,TOP,5,IRON,0,TOP/2,0.25);              // the pump rod
   A.cyl(0.11,0.11,1.3,6,IRON_D,0,0.65,0.25);
   A.cyl(0.10,0.10,4.4,6,IRON_D,2.6,0.75,0.12,0,0,Math.PI/2);
   A.cyl(3.3,3.4,1.25,16,'#5c6b6f',5.2,0.62,0,0,0,0,1.0);
   A.cyl(3.1,3.1,0.10,16,'#4f7f93',5.2,1.22,0,0,0,0,1.3);
   A.tor(3.38,0.08,16,IRON_D,5.2,1.22,0,Math.PI/2,0,0,0.9);
   for(let k=0;k<6;k++){const a=A.rr(0,6.3),r2=A.rr(4.2,5.4);
    A.sph(A.rr(0.2,0.4),A.rr(0.08,0.16),A.rr(0.2,0.4),'#5e5040',5.2+Math.cos(a)*r2,0.06,Math.sin(a)*r2);}
  }});
 /* The fan turns, so it is the one piece that cannot be welded into the rest of the mill.
    Eighteen blades and two rims on a hub, built once at install, driven by a single rotation
    write per frame — and only when somebody is inside four hundred metres to see it turn. */
 const FAN=(()=>{
  const A=Acc(90210,MILL.x,MILL.y,MILL.z);
  A.cyl(0.42,0.42,0.5,10,IRON,0,0,0,Math.PI/2,0,0);
  A.tor(2.72,0.055,24,IRON_D,0,0,0);
  A.tor(1.15,0.05,20,IRON_D,0,0,0);
  for(let k=0;k<18;k++){const a=k/18*Math.PI*2;
   A.box(0.60,1.62,0.035,'#c2c7c2',Math.cos(a)*1.95,Math.sin(a)*1.95,0,0,0,a+Math.PI/2,0.96+(k%3)*0.03);
   A.strut(Math.cos(a)*0.42,Math.sin(a)*0.42,0.16,Math.cos(a)*2.68,Math.sin(a)*2.68,0,0.03,0.025,IRON_D,4);}
  const me=A.mesh();me.receiveShadow=false;
  me.position.set(MILL.x,MILL.y+15.5,MILL.z+1.35);
  scene.add(me);return me;
 })();
 P.FAN=FAN;
 {
  let spin=0;
  G.on('tick',dt=>{
   if(hyp(player.pos.x,player.pos.z,MILL.x,MILL.z)>400)return;   // one hypot is this landmark's whole per-frame cost
   spin+=dt*1.15;FAN.rotation.z=spin;
  });
 }

 /* ---- 2f. Wrenfell Keep ---- */
 /* A round tower whose height varies round the circle, so it is built and ruined in the same
    loop: a course of blocks is laid only where the wall still stands that high. The doorway is
    an angular window everything skips, which means you can ride in through it — the collider
    ring has the same gap in it. */
 landmark({
  id:'wrenfell',name:'Wrenfell Keep',glyph:'🏰',mapLabel:'🏰 Wrenfell Keep',labelDz:-15,
  x:-280,z:-90,clear:9,seed:8821,label:'🏰 Wrenfell Keep',labelY:9.0,tall:22,reach:17,mini:'#b8b0a0',
  blurb:'Nobody in Cottonwood can tell you who the Wrenfells were, only that the tower was here before the ranch, the village, the bridge and the road, and that the stone is not from this valley. Twenty-two metres on the north side, five on the south where it came down, and a doorway you can ride a horse through without ducking. Whatever it was built to watch for is not coming.',
  arrive:'The stair climbs seven steps and then goes nowhere at all.',
  build(A,at){
   const R=5.2,TH=1.15,DOOR=Math.PI*0.5,N=30;
   const inDoor=a=>Math.abs(((a-DOOR+Math.PI*3)%(Math.PI*2))-Math.PI)>Math.PI-0.30;
   /* Tall on one bearing and fallen away round to the other. A plain cosine gave a perfectly
      even rake all the way round and the tower read as a spiral staircase; the two noise
      octaves break the top into courses that end where they happen to end, which is what a
      ruin looks like. */
   const hAt=a=>Math.max(2.4,3.8+8.4*(1+Math.cos(a-Math.PI*1.45))
    +ridged(Math.cos(a)*9+11,Math.sin(a)*9)*5.6+ridged(Math.cos(a)*23+5,Math.sin(a)*23)*2.4-2.8);
   for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2,top=hAt(a),dr=inDoor(a);
    /* Merlons on the stretch that is still nearly full height — three teeth left of a parapet
       is the difference between a broken tower and a chimney. Seated on the last course the
       wall actually reaches rather than at top+0.9, which left them hanging in the air. */
    if(top>17.5&&k%2===0){const last=0.30+(Math.floor(top/0.85)-1)*0.85;
     A.box(1.26,1.5,TH*0.9,STONE_L,Math.cos(a)*R,last+1.12,Math.sin(a)*R,0,Math.PI/2-a,0,1.03);}
    for(let c2=0;c2<Math.floor(top/0.85);c2++){
     const y=0.30+c2*0.85;
     if(dr&&y<3.7)continue;                               // the doorway
     if(Math.abs(((a-DOOR-1.9+Math.PI*3)%(Math.PI*2))-Math.PI)>Math.PI-0.09&&y>7.5&&y<9.6)continue;   // a window slit
     const jr=R+A.rr(-0.06,0.06);
     A.box(1.36,0.80,TH,c2%2?STONE:STONE_D,Math.cos(a)*jr,y,Math.sin(a)*jr,A.rr(-0.02,0.02),Math.PI/2-a,A.rr(-0.02,0.02),c2%3?1:0.93);
    }
    if(dr){                                               // the arch over it
     A.box(1.40,0.42,TH*1.1,STONE_L,Math.cos(a)*R,3.80,Math.sin(a)*R,0,Math.PI/2-a,0,1.05);
     A.box(1.40,0.36,TH*1.05,STONE_D,Math.cos(a)*R,4.22,Math.sin(a)*R,0,Math.PI/2-a,0,0.96);
    }
   }
   A.cyl(R+0.5,R+0.9,0.55,26,STONE_D,0,0.18,0,0,0,0,0.92);
   for(let k=0;k<9;k++){const a=Math.PI*1.2+k*0.30,r2=R-TH-0.55;   // the stair, up the inside of the wall
    A.box(1.5,0.22,0.95,STONE_L,Math.cos(a)*r2,0.85+k*0.62,Math.sin(a)*r2,0,Math.PI/2-a,0,1.02);}
   A.strut(-3.2,5.8,1.0,2.6,4.4,-2.0,0.20,0.20,TIMBER_D,6);        // a floor beam, fallen
   for(let k=0;k<26;k++){                                // rubble, piled where the wall is lowest
    const a=A.rr(Math.PI*0.1,Math.PI*1.05),r2=R+A.rr(1.2,9.5),sx=Math.cos(a)*r2,sz=Math.sin(a)*r2;
    rock(A,sx,groundH(at.x+sx,at.z+sz)-at.y+A.rr(0.16,0.34),sz,A.rr(0.6,1.4),A.rr(0.35,0.75),A.rr(0.5,1.2),k%3?STONE:STONE_D);
   }
   for(const [a,len] of [[Math.PI*1.7,9],[Math.PI*0.05,7]]){       // two stubs of an outer wall, going nowhere
    for(let k=0;k<len;k++){const r2=R+2.5+k*1.25,sx=Math.cos(a)*r2,sz=Math.sin(a)*r2,hh=Math.max(0.5,2.3-k*0.22);
     A.box(1.3,hh,0.85,k%2?STONE:STONE_D,sx,groundH(at.x+sx,at.z+sz)-at.y+hh/2,sz,0,-a,0);}
   }
   for(let k=0;k<10;k++){const a=A.rr(Math.PI*1.15,Math.PI*1.85);  // ivy, on the side still standing
    A.sph(A.rr(0.5,1.1),A.rr(0.4,0.9),A.rr(0.3,0.6),'#44603c',Math.cos(a)*(R+0.3),A.rr(1,7),Math.sin(a)*(R+0.3),0,0,0,0.9);}
   for(let k=0;k<14;k++){const a=k/14*Math.PI*2;
    if(Math.abs(((a-DOOR+Math.PI*3)%(Math.PI*2))-Math.PI)>Math.PI-0.36)continue;
    W.colliders.push({x:at.x+Math.cos(a)*R,z:at.z+Math.sin(a)*R,r:1.5});}
  }});

 /* ---- 2g. the Nine Sisters ---- */
 landmark({
  id:'ninesisters',name:'The Nine Sisters',glyph:'🗿',mapLabel:'🗿 The Nine Sisters',labelDz:15,
  x:-40,z:330,clear:16,seed:2299,label:'🗿 The Nine Sisters',labelY:7.6,tall:9,reach:21,mini:'#c8c2b4',
  blurb:'Nine stones in a ring on the open ground south of the river, and a tenth standing off on its own that the ring points at. It is the same rock as Wrenfell Keep and nobody knows where either of them came from. Ilse will tell you, at length and for free, that the King Stone lines up with midsummer sunrise. Grandpa Wren says it lines up with the pub at Barleyfold.',
  arrive:'Count them. Everybody counts them. Everybody gets nine.',
  build(A,at){
   const R=12.5;
   A.patch(0,0,17,'#7d8a52','#7d8a5a',0.05,26,3);
   for(let k=0;k<9;k++){
    const a=k/9*Math.PI*2+0.22,sx=Math.cos(a)*R,sz=Math.sin(a)*R;
    const gy=groundH(at.x+sx,at.z+sz)-at.y,hh=3.7+((k*2)%5)*0.62,tilt=A.rr(-0.055,0.055);
    A.box(1.55,hh,0.92,k%2?STONE:STONE_L,sx,gy+hh/2,sz,tilt,Math.PI/2-a+A.rr(-0.2,0.2),tilt*0.7,0.98);
    A.box(1.22,hh*0.34,0.80,STONE_D,sx,gy+hh*0.90,sz,tilt,Math.PI/2-a+A.rr(-0.3,0.3),tilt,1.04);
    A.sph(0.6,0.16,0.5,MOSS,sx,gy+0.12,sz,0,Math.PI/2-a,0,0.95);
    W.colliders.push({x:at.x+sx,z:at.z+sz,r:1.1});
   }
   const ka=0.22+Math.PI*0.5,kx=Math.cos(ka)*24,kz=Math.sin(ka)*24,kgy=groundH(at.x+kx,at.z+kz)-at.y;
   A.box(2.0,8.2,1.15,STONE,kx,kgy+4.1,kz,0.07,Math.PI/2-ka,0.04,1.02);       // the King Stone, leaning
   A.box(1.6,1.5,1.0,STONE_D,kx+0.3,kgy+7.6,kz,0.07,Math.PI/2-ka+0.3,0.04,0.94);
   W.colliders.push({x:at.x+kx,z:at.z+kz,r:1.5});
   const fa=0.22+Math.PI*1.33,fx=Math.cos(fa)*(R+1.5),fz=Math.sin(fa)*(R+1.5);   // one sister down, where she fell
   A.box(4.6,0.85,1.3,STONE_L,fx,groundH(at.x+fx,at.z+fz)-at.y+0.45,fz,0.04,Math.PI/2-fa+1.3,0.03,1.0);
   for(let k=0;k<12;k++){const a=A.rr(0,6.3),r2=A.rr(2,16),sx=Math.cos(a)*r2,sz=Math.sin(a)*r2;
    A.sph(A.rr(0.2,0.5),A.rr(0.1,0.25),A.rr(0.2,0.5),k%2?MOSS:STONE_D,sx,groundH(at.x+sx,at.z+sz)-at.y+0.1,sz);}
  }});

 /* ---- 2h. Harrier Knowe: the second viewpoint, and the far one ---- */
 landmark({
  id:'harrier',name:'Harrier Knowe',glyph:'🪶',mapLabel:'🪶 Harrier Knowe',labelDz:15,
  x:164,z:348,clear:8,seed:7717,label:'🪶 Harrier Knowe',labelY:5.8,tall:12,reach:16,mini:'#e0d0a8',
  blurb:'Three hundred and eighty metres from the ranch gate and a long way from anything else, which is the point of it. Whoever put the bench here set it facing back up the valley instead of out at the quarters, and they were right: from this seat the ranch, the bridge, the water tower and the Chalk Mare are all in one view, and a hen harrier quarters the grass below on most evenings.',
  arrive:'There is a name carved into the bench, worn down past reading.',
  build(A,at){
   A.patch(0,0,10,DIRT,DIRT_RIM,0.06,20,3);
   const look=Math.atan2(-at.x,-at.z);                    // the bench faces back down the valley
   const lx=Math.sin(look),lz=Math.cos(look),tx=Math.cos(look),tz=-Math.sin(look);
   /* The bench. Bigger than it wants to be on paper: at two and a half metres it vanished
      under the pine from thirty metres off, and this is the one thing here you arrive at. */
   for(const s of [-1,1]){rock(A,tx*s*1.35,0.30,tz*s*1.35,0.60,0.62,0.74,STONE_D,look);
    A.box(0.16,0.95,0.16,TIMBER_D,tx*s*1.35-lx*0.26,0.80,tz*s*1.35-lz*0.26,0,look,0,1.0);}
   A.box(3.2,0.16,0.62,TIMBER,0,0.64,0,0,look,0,1.06);
   A.box(3.2,0.16,0.60,TIMBER,0,0.50,-lx*0.02,0,look,0,0.96);
   A.box(3.2,0.46,0.11,TIMBER_D,-lx*0.32,1.06,-lz*0.32,0.16,look,0,1.02);
   /* The pine, bent the way the wind goes. The needles are tiers threaded onto the trunk line
      itself and overlapping the tier below, not cones hung off branch ends: hung off branches
      they came apart into a handful of green darts floating beside the tree. */
   /* Off to one side and a little behind the seat, not in front of it. Planted at a fixed
      local offset the pine happened to stand exactly on the sight line from the bench, and a
      viewpoint whose own tree blocks the view is a joke at the rider's expense. Its collider
      goes in from here too, since where it stands depends on which way the bench faces. */
   const px=tx*5.4-lx*1.2,pz=tz*5.4-lz*1.2;
   W.colliders.push({x:at.x+px,z:at.z+pz,r:1.2});
   let bx=px,by=0.6,bz=pz,br=0.52;
   for(let k=0;k<5;k++){const nx=bx+0.50+k*0.26,ny=by+2.7-k*0.30,nz=bz+0.16;
    A.strut(bx,by,bz,nx,ny,nz,br,br*0.72,'#5e4a33',7);bx=nx;by=ny;bz=nz;br*=0.72;}
   const root=[px,0.6,pz];
   for(let k=0;k<7;k++){
    const t=0.17+k*0.138;
    const cx2=root[0]+(bx-root[0])*t,cy=root[1]+(by-root[1])*t,cz2=root[2]+(bz-root[2])*t;
    A.cone(2.7-t*2.1,2.4-t*1.0,8,k%2?'#31502e':'#3d5f37',cx2,cy+0.55,cz2,0,A.rr(0,2),0.17,0.98);
   }
   for(let k=0;k<4;k++){const a=A.rr(-0.4,1.0),len=A.rr(1.4,2.4),y0=by-A.rr(1.5,5.0);
    A.strut(bx-0.4,y0,bz,bx+Math.sin(a+0.7)*len,y0+A.rr(0.1,0.6),bz+Math.cos(a+0.7)*len*0.6,0.09,0.05,'#5e4a33',5);}
   cairn(A,-tx*3.8-lx*0.6,-tz*3.8-lz*0.6,2.6,8,STONE);
   /* A rail along the lip, so the edge reads as an edge. */
   for(let k=0;k<5;k++){const rx=lx*3.4+tx*(k-2)*1.5,rz=lz*3.4+tz*(k-2)*1.5;
    A.cyl(0.075,0.09,1.15,6,TIMBER_D,rx,groundH(at.x+rx,at.z+rz)-at.y+0.55,rz);}
   for(const yy of [0.62,0.96]){
    const ax0=lx*3.4-tx*3.0,az0=lz*3.4-tz*3.0,ax1=lx*3.4+tx*3.0,az1=lz*3.4+tz*3.0;
    A.strut(ax0,groundH(at.x+ax0,at.z+az0)-at.y+yy,az0,ax1,groundH(at.x+ax1,at.z+az1)-at.y+yy,az1,0.045,0.045,TIMBER,5);}
  }});

 /* ============================================================================
    3. the log — what a rider has stood on, and what the finger-post promised
    ============================================================================ */
 P.LAND=LAND;
 P.landVerts=LAND.reduce((a,l)=>a+l.verts,0);
 Q.addAch({id:'vistas',icon:'🧭',label:'Every horizon',desc:'Visit all '+LAND.length+' of the basin’s landmarks',
  v:s=>Object.keys(s.vistas||{}).length,goal:LAND.length,r:{c:700,g:3,k:1}});
 Q.addAch({id:'vistahigh',icon:'⛰️',label:'Roof of the basin',desc:'Stand on Larkspur Head and Harrier Knowe',
  v:s=>((s.vistas||{}).larkspur?1:0)+((s.vistas||{}).harrier?1:0),goal:2,r:{c:300,g:1}});

 /* Its own tab rather than a row in world.js's Collection: registering an existing tab id
    overrides it, and quietly eating another package's panel is this codebase's recurring bug,
    not a tidy-up. */
 UI.questTab({id:'vistalog',label:'🧭 Horizons',render(s){
  const been=s.vistas||{},px=player.pos.x,pz=player.pos.z;
  let html='<span style="font-size:12px;color:#8c7a63">'+LAND.length+' things in Kestrel Basin you can see from a long way off. Ride to one and it logs itself — +140🪙 and +14 pass points each, and rather more once you have stood at every one.</span>';
  for(const L of LAND){
   const d=Math.round(hyp(px,pz,L.x,L.z)),b=Math.atan2(L.x-px,L.z-pz),got=!!been[L.id];
   html+='<div class="qrow'+(got?' claimed':'')+'"><span class="qico">'+L.glyph+'</span><span class="qmain"><b>'+L.name+'</b>'+
    '<span style="font-size:11px;color:#8c7a63;font-weight:600">'+(got?L.blurb.slice(0,104)+'…':'Not yet visited — '+d+' m to the '+compass(b))+'</span>'+
    '<span class="qbar"><span class="qfill" style="width:'+(got?100:0)+'%"></span></span></span>'+
    '<span style="font-size:11px;color:#8c7a63">'+(got?'✅':d+' m')+'</span></div>';
  }
  /* And the skyline, which you will never reach. Half the pleasure of it is that. */
  html+='<div class="qrow"><span class="qico">⛰️</span><span class="qmain"><b>Beyond the basin</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+
   MASSIFS.map(m=>m.label.slice(2)+' — '+compass(m.bearing)+', '+(Math.round(m.dist/100)/10)+' km out, '+Math.round(m.height)+' m high').join('<br>')+
   '</span></span></div>';
  return html;
 }});

 /* What QA asks this package, and what the commit message quotes. */
 P.stats=()=>({massifs:MASSIFS.length,skylineTris:P.skylineTris,landmarks:LAND.length,
  landmarkVerts:P.landVerts,addedDraws:MASSIFS.length+LAND.length+2,
  sites:LAND.map(l=>({id:l.id,x:Math.round(l.x),z:Math.round(l.z),h:Math.round(l.y*10)/10,reach:l.reach}))});
 G.on('state',o=>{o.vistas={landmarks:LAND.length,visited:Object.keys((S.fresh()||{}).vistas||{}).length,massifs:MASSIFS.length};});
}
