/* Feature package 'world-water' — the wet half of Kestrel Basin.

   The river was a flat blue ribbon laid on the ground: a hard straight line where the water met
   the sand, one depth everywhere, and nothing growing at the edge. Water is the most legible
   thing in any landscape because everyone already knows what it does — it pools on the outside
   of a bend and shallows on the straight, it drops gravel where it slows and undercuts roots
   where it does not, and it makes noise where the ground falls away. This package puts that
   behaviour back: a bed under the surface so depth can be seen, banks that differ from station
   to station for the reason real banks differ, a ford, a weir, a run of rapids, a waterfall in
   the eastern gorge, a shore and a jetty at Loon Lake, and a spring that feeds a stock trough.

   Owned by this package: this file. It touches nothing inline, and it places nothing outside the
   water corridor — the river channel, Sparrow Creek, Loon Lake and their banks.

   Everything is built once at install. Nothing in the tick allocates, and everything that moves
   moves in a shader driven by one uniform, so a hundred falling strands of water cost one float
   write a frame rather than a hundred matrix composes. */
export const id='world-water';
export function install(G){
 const {THREE,scene}=G;
 const W=G.world;
 const groundH=W.groundH, riverZ=W.riverZ, riverLevel=W.riverLevel, streamX=W.streamX;
 const box=W.box, tube=W.tube;
 const P={}; G.waterPkg=P;                        // this package's live state, for QA to look at

 /* ================= 0. plumbing ================= */
 /* A seeded generator, because a river you can give directions along has to be the same river
    every time the page loads. Math.random would reshuffle every pebble on every boot and make
    a before/after screenshot pair meaningless. */
 let _s=0x9e3779b9>>>0;
 const rnd=()=>{_s=Math.imul(_s^(_s>>>15),0x2c1b3c6d)>>>0;_s=Math.imul(_s^(_s>>>12),0x297a2d39)>>>0;return ((_s^(_s>>>15))>>>0)/4294967296;};
 const rr=(a,b)=>a+rnd()*(b-a);
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 const smooth=(v,a,b)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
 /* Six other packages are building into this world at the same time. Anything of mine that gets
    a collider, or that a rider could walk into, asks first whether somebody already owns that
    circle — a quiet skip is far better than two objects in one place. */
 const free=(x,z,r)=>{for(const c of W.colliders){const dx=x-c.x,dz=z-c.z;if(dx*dx+dz*dz<(c.r+r)*(c.r+r))return false;}return true;};
 const skipped=P.skipped={};
 const claim=(x,z,r,why)=>{if(free(x,z,r))return true;skipped[why]=(skipped[why]||0)+1;return false;};

 /* Scratch objects, allocated here and reused for the whole install and every later frame. */
 const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),
       _sc=new THREE.Vector3(),_m=new THREE.Matrix4(),_c=new THREE.Color();

 function canvasTex(w,h,draw){
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  draw(cv.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
 }

 /* The river's own material is not handed out on G, but it is in the scene and it is the only
    material in there carrying a plainShader function in userData — the pond's copy lost it,
    because Material.copy round-trips userData through JSON and functions do not survive that.
    Finding it rather than rebuilding it means every sheet of water in this package ripples with
    exactly the same wave field, on the same clock ranch3d.html already advances. */
 let riverMat=null;
 scene.traverse(o=>{if(!riverMat&&o.material&&o.material.userData&&typeof o.material.userData.plainShader==='function')riverMat=o.material;});
 P.foundRiverMat=!!riverMat;
 /* A clone keeps the colour response and the ripple normals and picks up the live time uniform
    through the original's closure, but it must NOT reuse the river's program cache key: that key
    names the ribbon's edge-fade variant, and handing it to a surface compiled from plainShader
    would silently hand back the wrong program. One key of our own, one extra compile, shared by
    every plain sheet in here. */
 const PLAIN_KEY=()=>'water-plain-v1';
 function waterSkin(tex,tint,opacity,extra){
  let m;
  if(riverMat){
   m=riverMat.clone();
   m.map=tex||null; m.color.set(tint); m.opacity=opacity;
   m.onBeforeCompile=riverMat.userData.plainShader;
   m.customProgramCacheKey=PLAIN_KEY;
  }else{
   m=new THREE.MeshStandardMaterial({map:tex||null,color:tint,roughness:0.18,metalness:0.05,
    side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false});
  }
  if(extra)Object.assign(m,extra);
  m.needsUpdate=true;
  return m;
 }

 /* The scrolling that makes a sheet of water look like it is going somewhere. Four floats a
    frame each, and the list is fixed at install. */
 const scrolls=[];
 const scroll=(tex,sx,sy)=>{scrolls.push({t:tex,sx,sy});return tex;};

 /* Everything that moves in a shader shares one clock, so the tick writes one number. */
 const uT={value:0};
 function motionMat(opts,inject){
  const m=new THREE.MeshBasicMaterial(opts);
  m.onBeforeCompile=sh=>{sh.uniforms.uT=uT;inject(sh);};
  m.customProgramCacheKey=()=>inject.key;
  return m;
 }

 /* ---- textures, drawn once ---- */
 const gravelTex=canvasTex(256,256,(c,w,h)=>{
  c.fillStyle='#8f8b7e';c.fillRect(0,0,w,h);
  for(let i=0;i<1400;i++){
   const r=1+Math.random()*5.5, g=180+Math.random()*60|0;
   c.fillStyle='rgba('+g+','+(g-6)+','+(g-24)+','+(0.12+Math.random()*0.4)+')';
   c.beginPath();c.ellipse(Math.random()*w,Math.random()*h,r,r*(0.6+Math.random()*0.5),Math.random()*3,0,7);c.fill();
  }
  for(let i=0;i<260;i++){               // the dark wet ones between the pale ones
   c.fillStyle='rgba(58,54,46,'+(0.10+Math.random()*0.30)+')';
   c.beginPath();c.ellipse(Math.random()*w,Math.random()*h,1+Math.random()*4,1+Math.random()*3,0,0,7);c.fill();
  }
 });
 /* The bank apron fades out landward through its own alpha, so the geometry can run straight
    into the grass without a cut line. v=0 is the waterline, v=1 is dry ground. */
 const apronTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=256;
  const c=cv.getContext('2d');
  c.clearRect(0,0,256,256);
  /* A mid grey-brown ground, not white. The first version filled this canvas white and let the
     vertex tint do all the work, which under a midday sun and ACES tonemapping turned every
     riverbank in the basin into a blown-out beach. */
  c.fillStyle='#6b6657';c.fillRect(0,0,256,256);
  for(let i=0;i<1700;i++){
   const g=92+Math.random()*96|0;
   c.fillStyle='rgba('+g+','+(g-4)+','+(g-16)+','+(0.20+Math.random()*0.55)+')';
   c.beginPath();c.ellipse(Math.random()*256,Math.random()*256,1+Math.random()*5,1+Math.random()*3.4,Math.random()*3,0,7);c.fill();
  }
  for(let i=0;i<400;i++){                              // darker wet patches between the stones
   c.fillStyle='rgba(48,44,36,'+(0.12+Math.random()*0.36)+')';
   c.beginPath();c.ellipse(Math.random()*256,Math.random()*256,2+Math.random()*9,1+Math.random()*5,0,0,7);c.fill();
  }
  c.globalCompositeOperation='destination-out';
  const gr=c.createLinearGradient(0,0,0,256);          // v runs across the bank, not along it
  gr.addColorStop(0.00,'rgba(0,0,0,0.45)');            // a little see-through where it dips under water
  gr.addColorStop(0.12,'rgba(0,0,0,0.10)');
  gr.addColorStop(0.42,'rgba(0,0,0,0.28)');
  gr.addColorStop(0.70,'rgba(0,0,0,0.66)');            // the fade has to span metres, not centimetres:
  gr.addColorStop(1.00,'rgba(0,0,0,1)');               // a short one leaves a ruled line across the sand
  c.fillStyle=gr;c.fillRect(0,0,256,256);
  for(let i=0;i<420;i++){                              // ragged edge: bank margins are not ruled lines
   c.fillStyle='rgba(0,0,0,'+(0.25+Math.random()*0.75)+')';
   const y=180+Math.random()*76;
   c.beginPath();c.ellipse(Math.random()*256,y,6+Math.random()*22,4+Math.random()*12,0,0,7);c.fill();
  }
  c.globalCompositeOperation='source-over';
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
 })();
 const foamTex=(()=>{
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;
  const c=cv.getContext('2d');c.clearRect(0,0,256,64);
  for(let i=0;i<300;i++){
   c.fillStyle='rgba(255,255,255,'+(0.12+Math.random()*0.62)+')';
   c.beginPath();c.arc(Math.random()*256,32+(Math.random()-0.5)*54,1.5+Math.random()*7,0,7);c.fill();
  }
  c.globalCompositeOperation='destination-out';
  const g=c.createLinearGradient(0,0,0,64);
  g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(0.38,'rgba(0,0,0,0)');
  g.addColorStop(0.62,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,1)');
  c.fillStyle=g;c.fillRect(0,0,256,64);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
 })();
 const whiteTex=(()=>{                                 // broken water: streaks, not bubbles
  const cv=document.createElement('canvas');cv.width=256;cv.height=128;
  const c=cv.getContext('2d');c.clearRect(0,0,256,128);
  for(let i=0;i<190;i++){
   c.strokeStyle='rgba(255,255,255,'+(0.10+Math.random()*0.55)+')';
   c.lineWidth=1+Math.random()*4.5;
   const x=Math.random()*256,y=Math.random()*128,l=6+Math.random()*34;
   c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+l*0.5,y+(Math.random()-0.5)*9,x+l,y+(Math.random()-0.5)*5);c.stroke();
  }
  for(let i=0;i<70;i++){
   c.fillStyle='rgba(255,255,255,'+(0.2+Math.random()*0.5)+')';
   c.beginPath();c.arc(Math.random()*256,Math.random()*128,2+Math.random()*7,0,7);c.fill();
  }
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
 })();
 const dropTex=canvasTex(32,64,(c,w,h)=>{
  c.clearRect(0,0,w,h);
  const g=c.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.3,'rgba(232,248,255,0.9)');
  g.addColorStop(0.72,'rgba(206,238,255,0.6)');g.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=g;c.fillRect(w*0.28,0,w*0.44,h);
 });
 const mistTex=canvasTex(64,64,(c,w,h)=>{
  const g=c.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,0.86)');g.addColorStop(0.45,'rgba(255,255,255,0.3)');
  g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
 });
 const reedTex=canvasTex(64,128,(c,w,h)=>{
  c.clearRect(0,0,w,h);
  for(let i=0;i<9;i++){
   const x=6+Math.random()*(w-12), lean=(Math.random()-0.5)*18;
   const gg=c.createLinearGradient(0,h,0,0);
   gg.addColorStop(0,'rgba(84,104,54,1)');gg.addColorStop(0.55,'rgba(124,148,74,1)');gg.addColorStop(1,'rgba(156,172,96,0.9)');
   c.strokeStyle=gg;c.lineWidth=2+Math.random()*3;c.lineCap='round';
   c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+lean*0.4,h*0.45,x+lean,6+Math.random()*24);c.stroke();
  }
  for(let i=0;i<3;i++){                                // a few brown seed heads
   c.fillStyle='rgba(112,78,44,0.85)';
   c.beginPath();c.ellipse(10+Math.random()*(w-20),14+Math.random()*26,2.6,8,0,0,7);c.fill();
  }
 });

 /* ---- shared prototype geometries ---- */
 const pebbleGeo=(()=>{                                // 20 triangles, squashed and irregular
  const g=new THREE.IcosahedronGeometry(1,0), p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   const k=1+Math.sin(x*4.1+z*2.7+y*3.3)*0.22;
   p.setXYZ(i,x*k,(y*0.5+0.5)*k*0.72,z*k*0.88);
  }
  g.computeVertexNormals();return g;
 })();
 const reedGeo=(()=>{                                  // three crossed cards: 6 triangles a clump
  const g=new THREE.BufferGeometry(),pos=[],uv=[],idx=[];
  for(let k=0;k<3;k++){
   const a=k*Math.PI/3, ca=Math.cos(a),sa=Math.sin(a),o=pos.length/3;
   pos.push(-ca*0.5,0,-sa*0.5, ca*0.5,0,sa*0.5, ca*0.5,1,sa*0.5, -ca*0.5,1,-sa*0.5);
   uv.push(0,0, 1,0, 1,1, 0,1);
   idx.push(o,o+1,o+2,o,o+2,o+3);
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();return g;
 })();
 const rootGeo=(()=>{                                  // an undercut root, arcing out and dipping
  const pts=[];
  for(let i=0;i<=6;i++){const t=i/6;pts.push(new THREE.Vector3(t*1.25,0.12-Math.pow(t,1.7)*0.75,Math.sin(t*2.4)*0.16));}
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),7,0.052,4,false);
 })();

 /* No vertexColors on any of these. An InstancedMesh tints itself through instanceColor, which
    three.js enables on its own; asking for vertexColors as well switches on USE_COLOR, whose
    `color` attribute these prototype geometries do not have — and an absent vertex attribute reads
    as (0,0,0), so the first version of this file grew a riverbank full of pure black reeds. */
 const pebbleMat=new THREE.MeshStandardMaterial({map:gravelTex,color:0xffffff,roughness:0.93,metalness:0});
 const reedMat=new THREE.MeshStandardMaterial({map:reedTex,alphaTest:0.5,side:THREE.DoubleSide,roughness:0.9,metalness:0});
 const rootMat=new THREE.MeshStandardMaterial({color:0x6b5540,roughness:0.95,metalness:0});
 const rockMat=new THREE.MeshStandardMaterial({map:gravelTex,color:0x9a958a,roughness:0.95,metalness:0});
 const wetRockMat=new THREE.MeshStandardMaterial({map:gravelTex,color:0x6e6f68,roughness:0.42,metalness:0.05});
 const timberMat=(W.mats&&W.mats.plankBrownMat)||new THREE.MeshStandardMaterial({color:0x8a6a44,roughness:0.9});

 /* An InstancedMesh filled from a list built during install, then frozen. Returns null rather
    than an empty mesh when nothing qualified, so a draw call is never spent on nothing. */
 function instance(geo,mat,rows,name,shadow){
  if(!rows.length)return null;
  const im=new THREE.InstancedMesh(geo,mat,rows.length);
  im.name=name;
  for(let i=0;i<rows.length;i++){
   const r=rows[i];
   _e.set(r.rx||0,r.ry||0,r.rz||0);_q.setFromEuler(_e);
   _v.set(r.x,r.y,r.z);_sc.set(r.sx,r.sy,r.sz);
   _m.compose(_v,_q,_sc);im.setMatrixAt(i,_m);
   if(r.c!==undefined){_c.setHex(r.c);if(r.cm)_c.multiplyScalar(r.cm);im.setColorAt(i,_c);}
  }
  im.instanceMatrix.needsUpdate=true;
  if(im.instanceColor)im.instanceColor.needsUpdate=true;
  im.castShadow=!!shadow;im.receiveShadow=true;
  im.computeBoundingSphere();
  scene.add(im);
  return im;
 }
 /* Static clusters — a stone weir, a jetty, a trough — are one object to a player and should be one
    object to the renderer too. The first version of this file built the weir out of twenty-six
    separate boxes and paid twenty-six draw calls plus twenty-six more in the shadow pass for a
    thing you look at once. This bakes a list of {geometry, matrix} into a single buffer. Only
    position/normal/uv are carried, which is all any of these parts has. */
 function merge(parts,mat,name,shadow){
  const pos=[],nor=[],uv=[],idx=[];
  const nm=new THREE.Matrix3();
  for(const part of parts){
   const g=part.g, m=part.m, base=pos.length/3;
   nm.getNormalMatrix(m);
   const gp=g.getAttribute('position'), gn=g.getAttribute('normal'), gu=g.getAttribute('uv');
   for(let i=0;i<gp.count;i++){
    _v.fromBufferAttribute(gp,i).applyMatrix4(m);pos.push(_v.x,_v.y,_v.z);
    if(gn){_v.fromBufferAttribute(gn,i).applyMatrix3(nm).normalize();nor.push(_v.x,_v.y,_v.z);}
    else nor.push(0,1,0);
    uv.push(gu?gu.getX(i):0,gu?gu.getY(i):0);
   }
   const gi=g.getIndex();
   if(gi)for(let i=0;i<gi.count;i++)idx.push(base+gi.getX(i));
   else for(let i=0;i<gp.count;i++)idx.push(base+i);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeBoundingSphere();
  const m=new THREE.Mesh(g,mat);m.name=name;
  m.castShadow=shadow!==false;m.receiveShadow=true;
  scene.add(m);return m;
 }
 /* A part for merge(), positioned and scaled without ever creating a Mesh. */
 const part=(g,x,y,z,sx,sy,sz,ry,rx,rz)=>{
  _e.set(rx||0,ry||0,rz||0);_q.setFromEuler(_e);_v.set(x,y,z);_sc.set(sx,sy,sz);
  return {g,m:new THREE.Matrix4().compose(_v,_q,_sc)};
 };
 /* Real rock, from the generator the rest of the valley's geology already uses, reduced to three
    prototype shapes so every boulder in this package is one of three instanced draws rather than
    sixty meshes. A box with a stone texture on it reads as a concrete block, which is exactly what
    the first version of the waterfall looked like. */
 const boulderProtos=(()=>{
  const out=[];
  try{
   for(const seed of[7741,9127,3308]){
    const m=W.geology.makeBoulder(1,seed);
    out.push({g:m.geometry,mat:m.material});
   }
  }catch(e){out.length=0;}
  return out.length?out:[{g:pebbleGeo,mat:rockMat}];
 })();
 const boulderRows=boulderProtos.map(()=>[]);
 const boulder=(x,y,z,s,squat)=>{
  const k=Math.floor(rnd()*boulderProtos.length);
  boulderRows[k].push({x,y,z,sx:s*rr(0.85,1.25),sy:s*(squat||rr(0.6,1.05)),sz:s*rr(0.85,1.25),
   ry:rnd()*6.28,rz:rr(-0.12,0.12)});
 };

 /* A longitudinal strip with any number of columns across it, vertex-coloured. This is how every
    bank, bed and foam line in here is drawn: one mesh, one draw call, following the real ground. */
 function band(rows,cols,mat,name){
  const pos=[],uv=[],col=[],idx=[],n=rows.length;
  for(let i=0;i<n;i++){
   const r=rows[i];
   for(let j=0;j<cols;j++){
    const p=r.p[j],c=r.c[j]||r.c[0];
    pos.push(p[0],p[1],p[2]);uv.push(r.u,j/(cols-1));col.push(c[0],c[1],c[2]);
   }
  }
  for(let i=0;i<n-1;i++)for(let j=0;j<cols-1;j++){
   const a=i*cols+j,b=a+cols;
   idx.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=false;m.receiveShadow=true;
  scene.add(m);return m;
 }

 /* ================= 1. the bed: why one reach looks deep and the next does not =================
    The channel is graded to one depth for its whole length — the terrain gives the same 0.8 m
    everywhere — so depth cannot be measured here, only read. It is read off the bed: pale gravel
    close under the surface says shallow, dark silt says you cannot see the bottom. Rivers put
    those two in a pattern anybody recognises without being told, the pool-and-riffle sequence:
    the water digs a pool against the outside of every bend and drops its gravel on the straight
    between them. riverZ is a sine, so its bends are exactly where |sin| peaks, and that one term
    places every pool and every riffle in this basin correctly. */
 const X0=-400,X1=400,DX=3;
 const bendPhase=x=>Math.sin(x*0.012);
 const poolness=x=>clamp(Math.abs(bendPhase(x))*0.88+0.16*Math.sin(x*0.031+1.7),0,1);
 P.poolness=poolness;
 {
  const rows=[];
  for(let x=X0;x<=X1;x+=DX){
   const zc=riverZ(x), y=riverLevel(x)-0.34, pl=poolness(x);
   /* silt is dark and slightly green, gravel is pale and warm; the mix is the whole trick */
   const deep=[0.115,0.150,0.140], shal=[0.560,0.520,0.430];
   const k=pl*pl;
   const mid=[deep[0]*k+shal[0]*(1-k),deep[1]*k+shal[1]*(1-k),deep[2]*k+shal[2]*(1-k)];
   const edge=[mid[0]*1.35+0.06,mid[1]*1.32+0.06,mid[2]*1.28+0.05];   // the bed lifts and pales at the margins
   rows.push({u:x*0.06,p:[[x,y+0.42,zc-5.0],[x,y+0.10,zc-2.6],[x,y,zc],[x,y+0.10,zc+2.6],[x,y+0.42,zc+5.0]],
              c:[edge,mid,mid,mid,edge]});
  }
  P.bed=band(rows,5,new THREE.MeshStandardMaterial({map:gravelTex,vertexColors:true,roughness:0.88,metalness:0,
   side:THREE.DoubleSide}),'Water | river bed');
  P.bed.material.map.repeat.set(1,1);
 }
 /* With a bed underneath worth seeing, the surface can stop being paint. The ribbon was 97%
    opaque, which is why it read as a strip of vinyl rather than as water lying in a channel.
    This is the one property of the shared river material the package changes, and it changes it
    for the same reason the bed exists: so that shallow and deep look different. */
 const RIVER_OPACITY=0.80;
 if(riverMat){P.riverOpacityWas=riverMat.opacity;riverMat.opacity=RIVER_OPACITY;}

 /* ================= 2. the banks ================= */
 /* A bend has two different banks and always the same two. On the inside the water is slow and
    drops what it is carrying, so you get a low shingle spit you could walk a horse onto. On the
    outside it is fast and undercuts, so you get a steep lip with tree roots hanging out of it.
    bendPhase tells us which side is which, and the whole river gets both. */
 const pebbles=[],reeds=[],roots=[];
 /* Kept narrow on purpose. A wet margin is the metre or two either side of the waterline where the
    ground is bare and darker; run it out to eight metres and it stops being a bank and becomes a
    beach, which is what the first attempt did to the whole length of the river. */
 const BANK_COLS=[3.2,4.4,5.8,8.2];                    // offsets from the centreline, waterline outward
 for(const sgn of[-1,1]){
  const rows=[];
  for(let x=X0;x<=X1;x+=DX){
   const zc=riverZ(x), lvl=riverLevel(x);
   const inside=Math.sign(bendPhase(x))===sgn?0:1;     // 1 = point bar on this side, 0 = cut bank
   const pl=poolness(x);
   const bar=inside*(1-pl*0.55);                       // shingle is strongest on the inside of the strongest bend
   const mud=(1-inside)*0.55+0.25*(1-bar);
   const p=[],c=[];
   for(let j=0;j<4;j++){
    const off=BANK_COLS[j]*(1+bar*0.55);               // point bars reach further out
    const z=zc+sgn*off;
    const gy=groundH(x,z);
    /* the first column is pinned just under the water so the apron never floats over the ribbon */
    p.push([x,j===0?Math.min(gy,lvl)-0.05:gy+0.025,z]);
    const shing=[0.88,0.83,0.72], silt=[0.46,0.39,0.30];
    const wetK=j===0?0.52:j===1?0.72:j===2?0.92:1;     // wet gravel is darker than dry gravel
    const w=bar+mud||1;
    c.push([(shing[0]*bar+silt[0]*mud)/w*wetK,
            (shing[1]*bar+silt[1]*mud)/w*wetK,
            (shing[2]*bar+silt[2]*mud)/w*wetK]);
   }
   rows.push({u:x*0.11,p,c});

   /* Loose stone on the bars, sized down as it goes up the beach the way graded sediment does. */
   if(bar>0.3&&x>X0+6&&x<X1-6){
    const n=Math.round(rr(1,4)*bar);
    for(let i=0;i<n;i++){
     const off=rr(3.0,6.4)*(1+bar*0.5), px=x+rr(-1.4,1.4), pz=zc+sgn*off;
     const s=rr(0.09,0.34)*(1.35-smooth(off,3,7));
     pebbles.push({x:px,y:groundH(px,pz)+s*0.24,z:pz,sx:s*rr(0.9,1.5),sy:s*rr(0.5,0.85),sz:s*rr(0.9,1.4),
      ry:rnd()*6.28,rz:rr(-0.2,0.2),c:0xffffff,cm:rr(0.72,1.12)});
    }
   }
   /* Reeds stand in the slack water at the tail of a bar, not on dry land — that is the part the
      riparian scatter already on the upper lip cannot do, because it refuses anything inside 4.6 m. */
   if(bar>0.25&&rnd()<0.42){
    const n=2+Math.round(rnd()*3);
    for(let i=0;i<n;i++){
     const off=rr(3.4,5.2), px=x+rr(-1.3,1.3), pz=zc+sgn*off;
     const gy=groundH(px,pz), h=rr(0.75,1.5);
     reeds.push({x:px,y:Math.min(gy,riverLevel(px))-0.1,z:pz,sx:rr(0.5,0.85),sy:h,sz:rr(0.5,0.85),
      ry:rnd()*6.28,c:0xffffff,cm:rr(0.72,1.15)});
    }
   }
   /* Roots only where the water is cutting: the outside of the bend, hanging over the lip. */
   if(inside===0&&pl>0.45&&rnd()<0.30){
    const px=x+rr(-1,1), off=rr(4.3,5.2), pz=zc+sgn*off;
    const gy=groundH(px,pz);
    if(gy>riverLevel(px)-0.1){
     const n=1+Math.round(rnd()*2);
     for(let i=0;i<n;i++)
      roots.push({x:px+rr(-0.5,0.5),y:gy+rr(-0.25,0.05),z:pz+rr(-0.3,0.3),
       sx:rr(0.7,1.3),sy:rr(0.7,1.2),sz:rr(0.7,1.3),ry:(sgn>0?Math.PI/2:-Math.PI/2)+rr(-0.7,0.7)});
    }
   }
  }
  const apronMat=new THREE.MeshStandardMaterial({map:apronTex,vertexColors:true,transparent:true,
   opacity:0.74,roughness:0.94,metalness:0,side:THREE.DoubleSide,depthWrite:false,
   polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const m=band(rows,4,apronMat,'Water | riverbank '+(sgn<0?'north':'south'));
  m.renderOrder=1;
  (P.aprons=P.aprons||[]).push(m);
 }


 /* ================= 3. Kingfisher Ford =================
    A hard gravel bar running right across the channel: the one place between the bridge and the
    canyon where you can put a horse in the water and know where the bottom is. The ferry works the
    reach from x=16 to x=134 and the bridge owns x=0, so this goes well west of both. */
 const FORD_X=-104;
 {
  const zc=riverZ(FORD_X);
  /* the bar itself: pale gravel laid over the bed, right up at the surface in the middle */
  const rows=[];
  for(let x=FORD_X-9;x<=FORD_X+9;x+=1){
   const t=Math.abs(x-FORD_X)/9, lift=(1-t*t)*0.30;
   const z0=riverZ(x), l=riverLevel(x);
   const pale=[0.92,0.86,0.73], damp=[0.58,0.53,0.44];
   rows.push({u:x*0.22,p:[[x,l-0.30+lift*0.3,z0-6.2],[x,l-0.14+lift,z0-3],[x,l-0.10+lift,z0],
                          [x,l-0.14+lift,z0+3],[x,l-0.30+lift*0.3,z0+6.2]],
              c:[damp,pale,pale,pale,damp]});
  }
  P.fordBar=band(rows,5,new THREE.MeshStandardMaterial({map:gravelTex,vertexColors:true,roughness:0.86,
   metalness:0,side:THREE.DoubleSide}),'Water | ford bar');
  /* broken water over the bar: the surface riffles wherever it shallows */
  const fr=[];
  for(let x=FORD_X-8;x<=FORD_X+8;x+=1){
   const z0=riverZ(x), l=riverLevel(x)+0.035, t=Math.abs(x-FORD_X)/8;
   const a=(1-t*t)*0.9, h=[a*0.5,a*0.5,a*0.5];
   fr.push({u:x*0.5,p:[[x,l,z0-4.4],[x,l,z0],[x,l,z0+4.4]],c:[h,[a,a,a],h]});
  }
  const riffleMat=new THREE.MeshBasicMaterial({map:scroll(whiteTex.clone(),0.10,0),transparent:true,
   opacity:0.42,depthWrite:false,side:THREE.DoubleSide,vertexColors:true,blending:THREE.AdditiveBlending});
  riffleMat.map.repeat.set(9,1.4);
  P.fordRiffle=band(fr,3,riffleMat,'Water | ford riffle');
  P.fordRiffle.renderOrder=3;
  /* the loose gravel of the bar, and the big stones you would actually step on */
  for(let i=0;i<34;i++){
   const x=FORD_X+rr(-8,8), z=riverZ(x)+rr(-5.6,5.6), s=rr(0.16,0.52);
   pebbles.push({x,y:riverLevel(x)-0.14+rr(0,0.14),z,sx:s*rr(1,1.5),sy:s*rr(0.45,0.8),sz:s*rr(1,1.4),
    ry:rnd()*6.28,c:0xffffff,cm:rr(0.95,1.3)});
  }
  for(let i=0;i<5;i++){
   const x=FORD_X-7+i*3.1, z=riverZ(x)-rr(1,3.4), s=rr(0.42,0.68);
   if(!claim(x,z,s*0.8,'ford-stone'))continue;
   boulder(x,riverLevel(x)-0.12,z,s,0.62);
  }
  /* the worn approaches: bare earth where a century of hooves came down to the water */
  for(const sgn of[-1,1]){
   const ar=[];
   for(let d=0;d<=7;d++){
    const z=zc+sgn*(4.0+d*1.7), t=d/7;
    const w=2.6+t*2.4, c=[0.50-t*0.14,0.43-t*0.12,0.33-t*0.09], e=[c[0],c[1],c[2]];
    ar.push({u:d*0.3,p:[[FORD_X-w,groundH(FORD_X-w,z)+0.03,z],[FORD_X,groundH(FORD_X,z)+0.03,z],[FORD_X+w,groundH(FORD_X+w,z)+0.03,z]],
             c:[e,c,e]});
   }
   const am=new THREE.MeshStandardMaterial({map:apronTex,vertexColors:true,transparent:true,opacity:0.8,
    roughness:0.95,metalness:0,side:THREE.DoubleSide,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
   band(ar,3,am,'Water | ford approach').renderOrder=1;
  }
  /* a marker post, so the crossing is something you can be told about and then find */
  {
   const px=FORD_X-2.6, pz=zc-6.6;
   if(claim(px,pz,0.8,'ford-post')){
    const g=new THREE.Group();
    tube(0.09,0.11,2.1,'#9a8365',0,1.05,0,g);
    box(0.62,0.26,0.07,'#d8c79c',0,1.86,0,g);
    g.position.set(px,groundH(px,pz),pz);g.rotation.y=0.4;
    scene.add(g);
    W.colliders.push({x:px,z:pz,r:0.4});
   }
  }
  W.mapMarkers.push({x:FORD_X,z:zc,glyph:'🪨',label:'Kingfisher Ford',kind:'water'});
  W.miniMarkers.push({x:FORD_X,z:zc,col:'#cdd9e4'});
  P.ford={x:FORD_X,z:zc};
 }

 /* ================= 4. the old mill weir =================
    A stone sill laid across the channel a long time ago and never repaired. Water slides over its
    whole width and drops half a metre into a standing line of foam. One end is breached, so a rider
    still gets through — a weir you cannot pass is a wall, and this valley already has a bridge for
    that argument. */
 const WEIR_X=-250;
 const BREACH_A=2.4, BREACH_B=5.2;                     // the gap, as an offset from the centreline
 if(claim(WEIR_X,riverZ(WEIR_X),9,'weir')){
  const zc=riverZ(WEIR_X), lvl=riverLevel(WEIR_X), sill=lvl+0.55;
  const inBreach=z=>z>zc+BREACH_A&&z<zc+BREACH_B;
  /* the sill: rough courses of stone, all of it one mesh */
  {
   const parts=[],bg=new THREE.BoxGeometry(1,1,1);
   for(let i=0;i<26;i++){
    const z=zc-6.5+i*0.52;
    if(inBreach(z))continue;
    const h=rr(1.15,1.45);
    parts.push(part(bg,WEIR_X+rr(-0.1,0.1),sill-h/2,z,1.5,h,rr(0.42,0.5),rr(-0.05,0.05)));
   }
   merge(parts,rockMat,'Water | mill weir sill',true);
   /* the abutment at each end. These were two big grey boxes and read as poured concrete; stacked
      rock from the same generator the gorge uses says 'somebody piled this here' instead. */
   for(const sgn of[-1,1]){
    const az=zc+sgn*7.0;
    if(!claim(WEIR_X,az,1.9,'weir-abutment'))continue;
    const g0=groundH(WEIR_X,az);
    for(let k=0;k<3;k++)boulder(WEIR_X+rr(-0.7,0.7),g0-0.1+k*0.75,az+rr(-0.8,0.8),rr(1.0,1.5),rr(0.7,1.0));
    W.colliders.push({x:WEIR_X,z:az,r:1.7});
   }
  }
  /* the overfall: a thin sheet leaving the lip, throwing forward as it drops. The breach carries
     vertices but no faces, so there is no pane of glass hanging over the gap. */
  {
   const pos=[],uv=[],idx=[],SEG=8,N=24,zs=[];
   for(let i=0;i<=N;i++){
    const z=zc-6.5+i*(11.5/N);zs.push(z);
    for(let j=0;j<=SEG;j++){
     const v=j/SEG;
     pos.push(WEIR_X+0.70+Math.pow(v,1.7)*0.55,sill-v*0.62,z);
     uv.push(i/N*3,v*1.6);
    }
   }
   for(let i=0;i<N;i++){
    if(inBreach(zs[i])||inBreach(zs[i+1]))continue;
    for(let j=0;j<SEG;j++){const a=i*(SEG+1)+j,b=a+SEG+1;idx.push(a,b,a+1,a+1,b,b+1);}
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(idx);geo.computeVertexNormals();
   const t=scroll(whiteTex.clone(),0,-0.55);t.repeat.set(3,1.8);
   const sheet=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:t,color:0xe6f6ff,roughness:0.14,
    metalness:0.04,transparent:true,opacity:0.88,side:THREE.DoubleSide,emissive:0x8fc4e8,
    emissiveIntensity:0.16,depthWrite:false}));
   sheet.renderOrder=2;scene.add(sheet);P.weirSheet=sheet;
  }
  /* the foam apron below it, standing still while the texture runs through it */
  {
   const fr=[];
   for(let z=zc-7;z<=zc+7;z+=0.7){
    const o=inBreach(z)?0.25:1;
    fr.push({u:z*0.35,p:[[WEIR_X+1.0,lvl+0.03,z],[WEIR_X+2.3,lvl+0.03,z],[WEIR_X+4.2,lvl+0.02,z]],
             c:[[o,o,o],[o*0.8,o*0.8,o*0.8],[0,0,0]]});
   }
   const fm=new THREE.MeshBasicMaterial({map:scroll(foamTex.clone(),0.05,0),transparent:true,opacity:0.5,
    depthWrite:false,side:THREE.DoubleSide,vertexColors:true,blending:THREE.AdditiveBlending});
   fm.map.repeat.set(4,1);
   band(fr,3,fm,'Water | weir foam').renderOrder=3;
  }
  /* the ruin of the sluice frame standing in the breach, one mesh */
  {
   const fz=zc+(BREACH_A+BREACH_B)/2, fy=groundH(WEIR_X,fz), bg=new THREE.BoxGeometry(1,1,1);
   const parts=[part(bg,WEIR_X,fy+2.5,fz,0.3,0.26,2.6,0),
                part(bg,WEIR_X+0.1,fy+1.1,fz,0.16,1.5,2.0,0,0,0.22)];
   for(const s of[-1,1])parts.push(part(bg,WEIR_X,fy+1.3,fz+s*1.1,0.24,2.6,0.24,0));
   merge(parts,timberMat,'Water | weir sluice',true);
  }
  /* loose stone thrown out below the drop, where the plunge has scoured the bed */
  for(let i=0;i<10;i++)boulder(WEIR_X+rr(2,6),lvl-0.1,zc+rr(-6,6),rr(0.25,0.6),0.55);
  W.mapMarkers.push({x:WEIR_X,z:zc,glyph:'🧱',label:'The old mill weir',kind:'water'});
  P.weir={x:WEIR_X,z:zc};
 }

 /* ================= 5. Sparrow Creek rapids =================
    The creek falls about four metres in every hundred between z=-215 and z=-140 — by a long way the
    steepest water in the basin that is not a waterfall. Steep water is loud and white and full of
    rock, so that is what goes there. */
 {
  const Z0=-215,Z1=-140;
  const wr=[];
  for(let z=Z0;z<=Z1;z+=1.5){
   const cx=streamX(z), gy=groundH(cx,z);
   const a=0.55+0.45*Math.sin(z*0.42)*Math.sin(z*0.13);   // the white comes in trains, not evenly
   const e=[a*0.45,a*0.45,a*0.45];
   wr.push({u:z*0.5,p:[[cx-1.5,gy+0.30,z],[cx,gy+0.34,z],[cx+1.5,gy+0.30,z]],c:[e,[a,a,a],e]});
  }
  const wm=new THREE.MeshBasicMaterial({map:scroll(whiteTex.clone(),0,0.42),transparent:true,opacity:0.40,
   depthWrite:false,side:THREE.DoubleSide,vertexColors:true,blending:THREE.AdditiveBlending});
  wm.map.repeat.set(1.6,7);
  P.rapids=band(wr,3,wm,'Water | Sparrow rapids');
  P.rapids.renderOrder=3;
  const spray=[];
  for(let i=0;i<26;i++){
   const z=rr(Z0,Z1), cx=streamX(z)+rr(-1.7,1.7), s=rr(0.22,0.72);
   boulder(cx,groundH(cx,z)+s*0.16,z,s,0.7);
   if(s>0.5&&spray.length<18)spray.push({x:cx,y:groundH(cx,z)+0.45,z:z+0.9,s:rr(0.5,1.0)});
  }
  P.rapidSpray=puffs(spray,0.55,1.1,'Water | rapid spray',0.26);
  W.mapMarkers.push({x:streamX(-178),z:-178,glyph:'💦',label:'Sparrow Creek rapids',kind:'water'});
 }

 /* Drifting spray and mist. Every puff rises, spreads and fades on its own phase, all of it in the
    vertex shader off one uniform — the CPU never touches these again after install. */
 function puffs(list,rise,spread,name,opacity){
  if(!list.length)return null;
  const ph=new Float32Array(list.length*2);
  const rows=list.map((p,i)=>{ph[i*2]=rnd();ph[i*2+1]=rr(0.10,0.26);
   return {x:p.x,y:p.y,z:p.z,sx:p.s*1.7,sy:p.s*1.7,sz:1,ry:rr(-0.3,0.3)};});
  const inject=sh=>{
   sh.vertexShader='attribute vec2 aPuff; uniform float uT; varying float vP;\n'+
    sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float pp=fract(uT*aPuff.y+aPuff.x);
      transformed.xy*=0.45+pp*${spread.toFixed(2)};
      transformed.y+=pp*${rise.toFixed(2)};
      vP=sin(pp*3.14159);`);
   sh.fragmentShader='varying float vP;\n'+sh.fragmentShader
    .replace('#include <dithering_fragment>','#include <dithering_fragment>\n gl_FragColor.a*=vP;');
  };
  inject.key='water-puff-'+rise.toFixed(2)+'-'+spread.toFixed(2);
  const mat=motionMat({map:mistTex,transparent:true,opacity:opacity==null?0.28:opacity,
   depthWrite:false,side:THREE.DoubleSide},inject);
  const im=instance(new THREE.PlaneGeometry(1,1),mat,rows,name,false);
  if(im){im.geometry.setAttribute('aPuff',new THREE.InstancedBufferAttribute(ph,2));
   im.renderOrder=4;im.frustumCulled=false;}
  return im;
 }

 /* ================= 6. Ribbon Falls =================
    At x=342 the gorge wall has a real break in it. The ground sits on a plateau at y≈5.2 all the
    way from z=54 to z=64, then falls off a cliff edge: 4.55 at z=66, 3.12 at z=68, 1.30 at z=70,
    and into the river by z=76. Eight metres of drop in ten metres of ground, with flat standing
    room along the top of it — which is as close to a waterfall as terrain this package may not
    touch is ever going to offer.

    So the water comes over a rock lip built three metres proud of that edge (the cliff is built
    rather than carved, the same trick Hollowpeak Falls uses at ranch3d.html:4310), free-falls onto
    a shelf, and then runs the rest of the natural face as a cascade into the river. Two earlier
    attempts failed here and both are worth naming: the first put the lip at the top of the hill
    where the crest hid it completely, and the second put it in a lane with a mature oak standing
    squarely in front of the drop. */
 const FALL_X=342;
 {
  const zc=riverZ(FALL_X), lvl=riverLevel(FALL_X);
  const LIP_Z=65.5, SHELF_Z=67.9, TOE_Z=76.0;
  const lipBase=groundH(FALL_X,LIP_Z);
  const lipY=lipBase+2.95;                            // the top of the built rock
  const shelfY=groundH(FALL_X,SHELF_Z)+0.35;
  P.falls={x:FALL_X,z:zc,lipY:+lipY.toFixed(2),shelfY:+shelfY.toFixed(2),toeY:+lvl.toFixed(2),
           free:+(lipY-shelfY).toFixed(2),total:+(lipY-lvl).toFixed(2)};
  /* the buttress: two courses of stacked rock with a notch cut through it, plus returns running
     downstream on each side so the fall is standing in something rather than on it */
  {
   const NOTCH=1.75;
   for(let i=0;i<11;i++){
    const bx=FALL_X+(i/10-0.5)*17.5;
    if(Math.abs(bx-FALL_X)<NOTCH+0.9)continue;
    const bz=LIP_Z+rr(-0.7,0.7), g0=groundH(bx,bz);
    boulder(bx,g0-0.15,bz,rr(1.5,1.9),1.0);
    if(rnd()<0.75)boulder(bx+rr(-0.8,0.8),g0+1.55,bz+rr(-0.5,0.5),rr(1.05,1.35),1.0);
    if(claim(bx,bz,1.4,'falls-rock'))W.colliders.push({x:bx,z:bz,r:1.4});
   }
   for(const s of[-1,1])for(let i=0;i<4;i++){        // the returns, stepping down beside the chute
    const bz=LIP_Z+1.6+i*1.9, bx=FALL_X+s*(2.6+i*0.55);
    boulder(bx,groundH(bx,bz)-0.1,bz,rr(0.9,1.5),rr(0.75,1.1));
   }
  }
  /* the free fall: a tongue that leaves the notch, widens, thins and breaks up before the shelf */
  {
   const FS=15,FJ=8,FW=1.35;
   const pos=[],uv=[],idx=[];
   for(let r=0;r<=FS;r++){
    const v=r/FS;
    const w=FW*(1+v*0.45), th=Math.max(0.10,(0.48-0.25*v)*(1+0.42*Math.sin(v*6.4)));
    const y=lipY-0.30-(lipY-shelfY-0.15)*Math.pow(v,1.04);
    const z0=LIP_Z+0.55+v*v*(SHELF_Z-LIP_Z-0.7);
    for(let j=0;j<=FJ;j++){
     const a=j/FJ*Math.PI*2, cu=Math.cos(a), su=Math.sin(a);
     const wob=1+0.11*Math.sin(a*3+v*8.4);
     pos.push(FALL_X+cu*w*wob,y+su*th*0.28,z0+su*th);
     uv.push(j/FJ*1.5,v*2.4);
    }
   }
   for(let r=0;r<FS;r++)for(let j=0;j<FJ;j++){
    const a=r*(FJ+1)+j,b=a+FJ+1;idx.push(a,b,a+1,a+1,b,b+1);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(idx);geo.computeVertexNormals();
   const t=scroll(whiteTex.clone(),0,-1.35);t.repeat.set(1.3,2.6);
   const fall=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:t,color:0xe4f4ff,roughness:0.15,
    metalness:0.05,transparent:true,opacity:0.95,side:THREE.DoubleSide,emissive:0x9fd0ee,
    emissiveIntensity:0.3,depthWrite:false}));
   fall.renderOrder=2;fall.frustumCulled=false;scene.add(fall);P.fallSheet=fall;
   /* The roll of water going over the lip, so the top of the fall is a crest and not a cut edge.
      It was twice this fat and sat proud of the rock, where from the river it read as a white bar
      hanging in the air above the notch; it is now tucked down into the gap with the sheet's own
      top overlapping it, and only the front of the roll shows. */
   const crest=new THREE.Mesh(new THREE.CylinderGeometry(0.20,0.17,FW*1.75,10,1,true),
    new THREE.MeshStandardMaterial({color:0xf2fbff,roughness:0.28,transparent:true,opacity:0.85,
     emissive:0xcfe8ff,emissiveIntensity:0.28,side:THREE.DoubleSide,depthWrite:false}));
   crest.rotation.z=Math.PI/2;crest.position.set(FALL_X,lipY-0.46,LIP_Z+0.46);scene.add(crest);
  }
  /* below the shelf the water stops falling and starts running: a cascade down the rest of the
     natural face into the river. Tinted toward water rather than left pure white — the first
     version of this ran as a ribbon of snow down a green hillside. */
  {
   const rows=[];
   for(let i=0;i<=24;i++){
    const t=i/24, z=SHELF_Z+(TOE_Z-SHELF_Z)*t;
    const gy=groundH(FALL_X,z)+0.22;
    const w=1.35+t*2.5;
    const a=0.55+0.34*Math.sin(t*13);                 // steps: white where it breaks, glassy between
    const e=[a*0.5,a*0.56,a*0.6];
    rows.push({u:i*0.4,p:[[FALL_X-w,gy+0.16,z],[FALL_X,gy,z],[FALL_X+w,gy+0.16,z]],c:[e,[a,a,a],e]});
   }
   const cm=new THREE.MeshStandardMaterial({map:scroll(whiteTex.clone(),0,0.8),color:0xc9e6f4,
    vertexColors:true,roughness:0.16,metalness:0.05,transparent:true,opacity:0.95,
    side:THREE.DoubleSide,emissive:0x77b0d4,emissiveIntensity:0.20,depthWrite:false});
   cm.map.repeat.set(1.5,6);
   P.chute=band(rows,3,cm,'Water | falls chute');
   P.chute.renderOrder=2;
   for(let i=0;i<20;i++){                             // rock either side of the chute
    const t=rnd(), z=SHELF_Z+1+(TOE_Z-SHELF_Z-1)*t;
    const side=rnd()<0.5?-1:1, bx=FALL_X+side*rr(2.2,5.2)*(1+t*0.5);
    boulder(bx,groundH(bx,z)-0.08,z,rr(0.35,0.95),rr(0.6,1.05));
   }
  }
  /* Where it lands. The first version put a four-metre disc of darker water on the river here and
     the disc showed its own outline from every angle — a perfect circle stamped on a ribbon reads
     as a sticker, not a plunge pool. This is a span of the channel instead: churn strongest against
     the near bank where the water actually arrives, fading to nothing upstream, downstream and out
     across the middle, so it has no edge anywhere. */
  {
   const rows=[];
   for(let i=0;i<=16;i++){
    const t=i/16, x=FALL_X-6+t*12;
    const a=Math.sin(Math.PI*t), z0=riverZ(x), l=riverLevel(x)+0.045;
    rows.push({u:i*0.55,p:[[x,l,z0-5.0],[x,l,z0-2.4],[x,l,z0+1.2]],
               c:[[a,a,a],[a*0.62,a*0.62,a*0.62],[0,0,0]]});
   }
   const pm=new THREE.MeshBasicMaterial({map:scroll(whiteTex.clone(),0.05,0.18),transparent:true,
    opacity:0.6,depthWrite:false,side:THREE.DoubleSide,vertexColors:true,blending:THREE.AdditiveBlending});
   pm.map.repeat.set(4,2);
   P.plunge=band(rows,3,pm,'Water | falls plunge');
   P.plunge.renderOrder=3;
   const foam=new THREE.Mesh(new THREE.RingGeometry(0.7,2.4,20),
    new THREE.MeshBasicMaterial({map:scroll(foamTex.clone(),0.04,0),transparent:true,opacity:0.5,
     depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
   foam.material.map.repeat.set(5,1);
   foam.rotation.x=-Math.PI/2;foam.position.set(FALL_X,lvl+0.09,TOE_Z-0.6);foam.renderOrder=3;scene.add(foam);
  }
  /* falling strands that break off the sheet, and mist where it lands. The mist was three times
     this strong to begin with and whited out half the frame — spray you cannot see the rock
     through is fog, and the point of it is that you can see the rock through it. */
  {
   const DN=40, a=new Float32Array(DN*3), rows=[];
   for(let i=0;i<DN;i++){
    a[i*3]=rnd();a[i*3+1]=rr(0.34,0.66);a[i*3+2]=(lipY-shelfY)+rr(-0.3,0.4);
    rows.push({x:FALL_X+rr(-1.7,1.7),y:lipY-0.4,z:LIP_Z+rr(0.4,1.9),sx:1,sy:1,sz:1,ry:rr(-0.25,0.25)});
   }
   const inject=sh=>{
    sh.vertexShader='attribute vec3 aDrop; uniform float uT; varying float vD;\n'+
     sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
       float pp=fract(uT*aDrop.y+aDrop.x);
       transformed.y-=pp*aDrop.z;
       vD=sin(pp*3.14159)*0.9;`);
    sh.fragmentShader='varying float vD;\n'+sh.fragmentShader
     .replace('#include <dithering_fragment>','#include <dithering_fragment>\n gl_FragColor.a*=vD;');
   };
   inject.key='water-drop-v1';
   const im=instance(new THREE.PlaneGeometry(0.15,1.3),
    motionMat({map:dropTex,transparent:true,opacity:0.6,depthWrite:false,side:THREE.DoubleSide,
     blending:THREE.AdditiveBlending},inject),rows,'Water | falls drops',false);
   if(im){im.geometry.setAttribute('aDrop',new THREE.InstancedBufferAttribute(a,3));
    im.renderOrder=3;im.frustumCulled=false;P.fallDrops=im;}
   const mist=[];
   for(let i=0;i<12;i++)mist.push({x:FALL_X+rr(-2.2,2.2),y:shelfY-rr(0,0.8),z:SHELF_Z+rr(-0.8,1.0),s:rr(0.8,1.5)});
   for(let i=0;i<7;i++)mist.push({x:FALL_X+rr(-2.4,2.4),y:lvl+rr(0,0.5),z:TOE_Z+rr(-1.4,1.2),s:rr(0.9,1.6)});
   P.fallMist=puffs(mist,1.7,1.2,'Water | falls mist',0.17);
  }
  /* A waterfall nobody can get to is scenery. This one goes on the map and on the fast-travel bar,
     and the arrival point is on the flat bank below it rather than halfway up the wall. */
  const ftAt=[FALL_X-7,zc-9.5];
  W.addFT(['💧 Ribbon Falls',ftAt[0],ftAt[1]]);
  /* world.js walks T.FT once at its own install and pushes one compass marker per stop
     (world.js:369). This package installs eleven entries later, so a stop added here would have
     no marker on the map and would quietly break the invariant that every fast-travel stop is
     findable — which is exactly what tools/qa-world-features.cjs asserts with kinds.ft===FT.length.
     Same shape, same offset, added by hand. */
  W.mapMarkers.push({x:ftAt[0],z:ftAt[1]-7,glyph:'🧭',alpha:0.85,kind:'ft'});
  W.mapMarkers.push({x:FALL_X,z:LIP_Z,glyph:'💧',label:'Ribbon Falls',kind:'water'});
  W.miniMarkers.push({x:FALL_X,z:LIP_Z,col:'#bfe6ff'});
  W.addRegion({name:'💧 Ribbon Falls',x:FALL_X,z:zc-10,r:22,id:'ribbonfalls',biome:'river'});
 }
 /* ================= 7. Loon Lake =================
    The lake is a four-metre disc of water lying two centimetres above the ground, which is why it
    reads as a wet patch and not a lake. It cannot be made deeper from here — the terrain is not
    this package's to carve — so it gets the things that say 'lake' instead: a shingle and silt shore
    the water disappears into, reed beds on the margin, a fishing stage out over the water and a
    punt tied to it. */
 const LK={x:20,z:16,r:4.5};
 {
  const surf=0.04;
  P.lake={surface:surf,ground:+groundH(LK.x,LK.z).toFixed(3)};
  /* BUG, and not one this package can fix at source: ranch3d.html:4525 hangs the lake's shore foam
     ring at groundH(20,16)+0.62 and :4540 puts all 54 lily pads and their 14 flowers at
     groundH(20,16)+0.60, while the water disc at :6136 sits at a flat y=0.04. groundH there is
     0.022, so pads, flowers and foam all float 60 cm above their own lake, which from the shore is
     the most conspicuous thing about Loon Lake. Those three lines want the lake surface, not the
     ground. Until they get it the offenders are brought down to the water here — matched by their
     exact geometry rather than by position, because the pads and flowers live in instance matrices
     on a mesh that sits at the origin, and a looser test would drag a fence post down with them. */
  let lowered=0;
  {
   const mm=new THREE.Matrix4();
   const isPad=g=>g&&g.type==='CircleGeometry'&&g.parameters&&g.parameters.thetaLength<6.2&&g.parameters.radius<0.5;
   const isFlower=g=>g&&g.type==='SphereGeometry'&&g.parameters&&g.parameters.radius<0.07;
   const isFoam=g=>g&&g.type==='RingGeometry'&&g.parameters&&g.parameters.outerRadius>5&&g.parameters.outerRadius<7;
   scene.traverse(o=>{
    if(o.isInstancedMesh&&(isPad(o.geometry)||isFlower(o.geometry))){
     let touched=false;
     for(let i=0;i<o.count;i++){
      o.getMatrixAt(i,mm);
      const x=mm.elements[12],y=mm.elements[13],z=mm.elements[14];
      if(Math.hypot(x-LK.x,z-LK.z)>LK.r+1.5)continue;
      if(y<surf+0.45||y>surf+1.1)continue;
      mm.elements[13]=surf+0.014;o.setMatrixAt(i,mm);touched=true;lowered++;
     }
     if(touched){o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();}
    }else if(o.isMesh&&isFoam(o.geometry)&&Math.hypot(o.position.x-LK.x,o.position.z-LK.z)<2&&
             o.position.y>surf+0.3&&o.position.y<surf+1.1){
     o.position.y=surf+0.02;lowered++;
    }
   });
  }
  P.lakePadsLowered=lowered;
  /* the shore: shingle running down under the waterline all the way round */
  {
   const rows=[],N=48;
   for(let i=0;i<=N;i++){
    const a=i/N*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
    const p=[],c=[];
    for(const[off,tone] of [[LK.r-1.3,0.50],[LK.r+0.15,0.86],[LK.r+1.4,0.74],[LK.r+2.9,0.54]]){
     const x=LK.x+ca*off, z=LK.z+sa*off, g0=groundH(x,z);
     p.push([x,off<LK.r?Math.min(g0,surf)-0.03:g0+0.02,z]);
     const k=tone*(0.86+0.2*Math.sin(a*5.3));
     c.push([k,k*0.94,k*0.80]);
    }
    rows.push({u:i*0.26,p,c});
   }
   const sm=new THREE.MeshStandardMaterial({map:apronTex,vertexColors:true,transparent:true,opacity:0.88,
    roughness:0.93,metalness:0,side:THREE.DoubleSide,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
   P.lakeShore=band(rows,4,sm,'Water | Loon Lake shore');
   P.lakeShore.renderOrder=1;
  }
  /* Reed beds on the north and west margins, where nobody fishes from. Seventy of them at full
     height ringed the whole pond and you could not see the water for the reeds — on a lake four
     metres across that is a thicket, not a margin. Half as many, shorter, and kept off the arc the
     jetty stands on so there is still something to look at. */
  for(let i=0;i<32;i++){
   const a=rr(2.15,4.75), off=rr(LK.r-1.1,LK.r+1.0);
   const x=LK.x+Math.cos(a)*off, z=LK.z+Math.sin(a)*off;
   reeds.push({x,y:Math.min(groundH(x,z),surf)-0.06,z,sx:rr(0.34,0.58),sy:rr(0.55,1.02),sz:rr(0.34,0.58),
    ry:rnd()*6.28,c:0xffffff,cm:rr(0.72,1.12)});
  }
  for(let i=0;i<40;i++){
   const a=rnd()*6.28, off=rr(LK.r+0.2,LK.r+2.4);
   const x=LK.x+Math.cos(a)*off, z=LK.z+Math.sin(a)*off, s=rr(0.08,0.26);
   pebbles.push({x,y:groundH(x,z)+s*0.22,z,sx:s*rr(1,1.5),sy:s*rr(0.5,0.85),sz:s*rr(1,1.4),
    ry:rnd()*6.28,c:0xffffff,cm:rr(0.8,1.2)});
  }
  /* The fishing stage wants a clear piece of shore, and the obvious spot turned out to have
     something of somebody else's standing 1.8 m away, so it asks the shore a few times over
     instead of insisting on one bearing. */
  let jx=0,jz=0,jok=false;
  for(const a of[2.55,2.95,2.2,3.4,1.85,3.8,1.45]){
   const cx=LK.x+Math.cos(a)*(LK.r+0.9), cz=LK.z+Math.sin(a)*(LK.r+0.9);
   if(free(cx,cz,1.7)&&free(LK.x+Math.cos(a)*1.4,LK.z+Math.sin(a)*1.4,1.2)){jx=cx;jz=cz;jok=true;break;}
  }
  if(!jok)skipped.jetty=(skipped.jetty||0)+1;
  if(jok){
   const deckY=surf+0.42;
   const dl=Math.hypot(LK.x-jx,LK.z-jz);
   const dirX=(LK.x-jx)/dl, dirZ=(LK.z-jz)/dl;         // out toward the middle of the lake
   /* Four planks butted into a slab read as a garden table from the shore, which is what the first
      one looked like. A stage is two stringers, boards laid across with daylight between them, and
      posts that stand above the deck — the gaps and the post tops are the whole silhouette. */
   const bg=new THREE.BoxGeometry(1,1,1), cg=new THREE.CylinderGeometry(1,1,1,6);
   const yaw=Math.atan2(dirX,dirZ), LEN=5.0, parts=[];
   for(const s of[-1,1])
    parts.push(part(bg,jx+dirX*LEN/2+dirZ*s*0.5,deckY-0.085,jz+dirZ*LEN/2-dirX*s*0.5,0.11,0.09,LEN,yaw));
   for(let i=0;i<13;i++){
    const t=0.04+i*0.0775, px=jx+dirX*t*LEN, pz=jz+dirZ*t*LEN;
    parts.push(part(bg,px,deckY,pz,1.26,0.05,0.26,yaw));
   }
   for(let i=0;i<4;i++){
    const t=i/3, px=jx+dirX*t*LEN, pz=jz+dirZ*t*LEN;
    for(const s of[-1,1]){
     const lx=px+dirZ*s*0.58, lz=pz-dirX*s*0.58, lg=groundH(lx,lz)-0.25;
     const top=deckY+(i===0||i===3?0.42:0.06);
     parts.push(part(cg,lx,(top+lg)/2,lz,0.072,top-lg,0.072,0));
    }
   }
   parts.push(part(cg,jx+dirZ*0.95,deckY+0.5,jz-dirX*0.95,0.105,1.2,0.105,0));
   merge(parts,timberMat,'Water | Loon Lake jetty',true);
   W.colliders.push({x:jx,z:jz,r:0.5});
   W.mapMarkers.push({x:jx,z:jz,glyph:'🎣',label:'Loon Lake jetty',kind:'water'});
   /* and a flat-bottomed punt moored to it — the only thing at this lake that moves by hand */
   const pp=[part(bg,0,0.12,0,0.95,0.3,2.5,0),
             part(bg,0,0.3,0.2,0.88,0.06,0.3,0),
             part(bg,0.2,0.32,-0.2,0.06,0.04,1.8,0.18)];
   for(const s of[-1,1])pp.push(part(bg,s*0.46,0.24,0,0.08,0.24,2.5,0));
   for(const e of[-1,1])pp.push(part(bg,0,0.24,e*1.22,0.95,0.28,0.09,0,e*0.3));
   const punt=merge(pp,timberMat,'Water | punt',true);
   punt.position.set(jx+dirX*3.4+dirZ*1.25,surf-0.03,jz+dirZ*3.4-dirX*1.25);
   punt.rotation.y=Math.atan2(dirX,dirZ)+0.25;
   P.punt=punt;P.puntY=punt.position.y;
  }
  /* a few more lilies out where the existing scatter left a gap, sitting on the water this time */
  {
   const pads=[];
   for(let i=0;i<26;i++){
    const a=rr(-1.1,1.6), off=rr(0.8,3.6);
    const x=LK.x+Math.cos(a)*off, z=LK.z+Math.sin(a)*off, s=rr(0.16,0.34);
    pads.push({x,y:surf+0.014,z,sx:s,sy:s,sz:s,rx:-Math.PI/2,ry:rnd()*6.28,c:0xffffff,cm:rr(0.78,1.15)});
   }
   instance(new THREE.CircleGeometry(1,14,0.2,Math.PI*2-0.4),
    new THREE.MeshStandardMaterial({color:0x44803c,roughness:0.7,metalness:0,side:THREE.DoubleSide}),
    pads,'Water | extra lilies',false);
  }
 }

 /* ================= 8. small water =================
    A spring on the shoulder above the ford, a hollowed-log flume carrying it to a stone trough, and
    the overflow finding its own way back down to the river. The smallest water in the basin and
    probably the most domestic-looking thing in it. */
 {
  const sx0=-116, sz0=riverZ(-116)-16;
  if(claim(sx0,sz0,3.2,'spring')){
   const sy=groundH(sx0,sz0);
   P.spring={x:sx0,z:sz0,y:+sy.toFixed(2)};
   for(let i=0;i<5;i++)                                // the mossy head the water comes out of
    boulder(sx0+rr(-0.7,0.7),sy+rr(0,0.35),sz0+rr(-0.5,0.5),rr(0.45,0.95),rr(0.45,0.85));
   W.colliders.push({x:sx0,z:sz0,r:1.1});
   const pool=new THREE.Mesh(new THREE.CircleGeometry(1.15,18),
    waterSkin(scroll(whiteTex.clone(),0.006,0.01),0x35696a,0.84));
   pool.material.map.repeat.set(1.4,1.4);
   pool.rotation.x=-Math.PI/2;pool.position.set(sx0+0.2,sy+0.10,sz0+1.35);pool.receiveShadow=true;scene.add(pool);
   /* the flume: a split log on two trestles, running downhill to the trough */
   const tx=sx0+4.6, tz=sz0+3.4, ty=groundH(tx,tz);
   const headY=sy+0.62, tailY=ty+0.95;
   const ax=sx0+0.6, az=sz0+1.5;
   const len=Math.hypot(tx-ax,tz-az);
   const yaw=-Math.atan2(tz-az,tx-ax), pitch=Math.atan2(headY-tailY,len);
   const bg=new THREE.BoxGeometry(1,1,1), cg=new THREE.CylinderGeometry(1,1,1,5);
   {
    const fp=[part(bg,0,0,0,len,0.05,0.26,0)];
    for(const s of[-1,1])fp.push(part(bg,0,0.07,s*0.13,len,0.13,0.06,0));
    const flume=merge(fp,timberMat,'Water | spring flume',true);
    flume.position.set((ax+tx)/2,(headY+tailY)/2,(az+tz)/2);
    flume.rotation.y=yaw;flume.rotation.z=pitch;
    const wchan=new THREE.Mesh(new THREE.PlaneGeometry(len,0.19),
     waterSkin(scroll(whiteTex.clone(),0.5,0),0x4a8f92,0.8));
    wchan.material.map.repeat.set(6,1);
    wchan.rotation.x=-Math.PI/2;wchan.position.y=0.05;flume.add(wchan);
   }
   {
    const tp=[];
    for(const t of[0.15,0.62]){
     const px=ax+(tx-ax)*t, pz=az+(tz-az)*t;
     const g0=groundH(px,pz), top=headY+(tailY-headY)*t;
     for(const s of[-1,1])tp.push(part(cg,px,(top+g0)/2,pz+s*0.14,0.055,top-g0,0.055,0));
    }
    merge(tp,timberMat,'Water | flume trestles',true);
   }
   /* the trough, and the strand of water falling into it */
   const tw=0.75,tl=2.1,th=0.62;
   {
    const tp=[part(bg,0,0.06,0,tl,0.12,tw,0)];
    for(const s of[-1,1]){
     tp.push(part(bg,0,th/2,s*tw/2,tl,th,0.11,0));
     tp.push(part(bg,s*tl/2,th/2,0,0.11,th,tw,0));
    }
    const trough=merge(tp,rockMat,'Water | stock trough',true);
    trough.position.set(tx,ty,tz);trough.rotation.y=rr(-0.2,0.2);
    const tw2=new THREE.Mesh(new THREE.PlaneGeometry(tl-0.2,tw-0.2),
     waterSkin(scroll(whiteTex.clone(),0.004,0.006),0x37676b,0.9));
    tw2.material.map.repeat.set(2,1);
    tw2.rotation.x=-Math.PI/2;tw2.position.y=th-0.12;trough.add(tw2);
    W.colliders.push({x:tx,z:tz,r:1.1});
   }
   {
    const strand=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.055,tailY-(ty+th),6,1,true),
     new THREE.MeshStandardMaterial({map:scroll(whiteTex.clone(),0,-2.0),color:0xdff2ff,transparent:true,
      opacity:0.8,side:THREE.DoubleSide,roughness:0.16,emissive:0x8fc4e8,emissiveIntensity:0.24,depthWrite:false}));
    strand.material.map.repeat.set(1,2);
    strand.position.set(tx-tl/2+0.35,(tailY+ty+th)/2,tz);scene.add(strand);
   }
   /* and the overflow, a thin wet line finding the river */
   {
    const rows=[];
    for(let i=0;i<=16;i++){
     const t=i/16;
     const px=tx+t*(FORD_X+9-tx)*0.35, pz=tz+t*(riverZ(FORD_X)-4-tz);
     const g0=groundH(px,pz), w=0.11+t*0.22, a=0.72-t*0.30, e=[a*0.35,a*0.35,a*0.35];
     rows.push({u:i*0.5,p:[[px-w,g0+0.025,pz],[px,g0+0.02,pz],[px+w,g0+0.025,pz]],c:[e,[a,a,a],e]});
    }
    /* Wet ground with a thread of water in it, which is what an overflow actually is. At full
       saturation and half a metre wide this was a blue stripe painted across the desert. */
    const rm=waterSkin(scroll(whiteTex.clone(),0,0.35),0x4a6b64,0.42,{vertexColors:true});
    rm.map.repeat.set(1,8);
    band(rows,3,rm,'Water | spring runnel').renderOrder=2;
   }
   W.mapMarkers.push({x:sx0,z:sz0,glyph:'⛲',label:'Kingfisher spring',kind:'water'});
  }
 }

 /* Puddles. The game runs a real weather cycle and puts four hundred rain drops in the air for half
    a minute at a time, and then the ground it fell on stays exactly as dry as it was. These sit in
    the hollows and come up as it rains and go off slowly afterwards; the whole system is one
    instanced disc and one opacity write a frame. */
 let puddleMesh=null;
 {
  const rows=[];
  const want=(x,z)=>{
   if(Math.abs(z-riverZ(x))<5.6)return false;           // not in the river
   const h=groundH(x,z);
   const s=Math.abs(groundH(x+1.2,z)-h)+Math.abs(groundH(x,z+1.2)-h);
   return s<0.22&&h>riverLevel(x)-0.2;                  // flat, and not underwater already
  };
  for(let i=0;i<150;i++){
   const x=rr(-320,320), sgn=rnd()<0.5?-1:1, z=riverZ(x)+sgn*rr(6,26);
   if(!want(x,z))continue;
   const s=rr(0.6,2.6);
   rows.push({x,y:groundH(x,z)+0.035,z,sx:s,sy:s*rr(0.6,1.3),sz:1,rx:-Math.PI/2,ry:rnd()*6.28});
  }
  for(let i=0;i<26;i++){                                 // and in the churned ground at the ford
   const x=FORD_X+rr(-14,14), sgn=rnd()<0.5?-1:1, z=riverZ(x)+sgn*rr(6,15);
   if(!want(x,z))continue;
   const s=rr(0.5,1.7);
   rows.push({x,y:groundH(x,z)+0.035,z,sx:s,sy:s*rr(0.6,1.2),sz:1,rx:-Math.PI/2,ry:rnd()*6.28});
  }
  puddleMesh=instance(new THREE.CircleGeometry(1,14),waterSkin(null,0x6f8a92,0,{side:THREE.DoubleSide}),
   rows,'Water | puddles',false);
  if(puddleMesh){puddleMesh.visible=false;puddleMesh.renderOrder=1;}
  P.puddles=rows.length;
 }

 /* Everything scattered above goes in now, one mesh per kind and three for all the rock. */
 P.pebbleMesh=instance(pebbleGeo,pebbleMat,pebbles,'Water | bank shingle',false);
 P.reedMesh=instance(reedGeo,reedMat,reeds,'Water | bank reeds',false);
 P.rootMesh=instance(rootGeo,rootMat,roots,'Water | undercut roots',false);
 P.boulderMeshes=boulderProtos.map((p,i)=>instance(p.g,p.mat,boulderRows[i],'Water | boulders '+i,true)).filter(Boolean).length;
 P.counts={pebbles:pebbles.length,reeds:reeds.length,roots:roots.length,
           boulders:boulderRows.reduce((a,r)=>a+r.length,0),scrolls:scrolls.length};

 /* ================= 9. one tick =================
    Texture offsets, the wetness of the world, and the clock every shader-driven thing reads.
    Nothing here allocates and nothing here builds geometry. */
 let wet=0;
 const apronBase=[],apronMats=(P.aprons||[]).map(m=>m.material);
 for(const m of apronMats)apronBase.push(m.color.clone());
 /* Named and kept on P so QA can time this package's own per-frame work directly. On a machine
    shared with six other headless browsers the wall clock is quantised to dropped vsync intervals
    and says nothing; calling this a few thousand times and taking the floor does. */
 function waterTick(dt,t){
  uT.value=t;
  for(let i=0;i<scrolls.length;i++){
   const s=scrolls[i];
   s.t.offset.x+=dt*s.sx;
   s.t.offset.y+=dt*s.sy;
  }
  const raining=(window._weather&&window._weather.mode==='rain')?1:0;
  const k=raining?0.25:0.055;
  wet+=(raining-wet)*Math.min(1,dt*k);
  if(puddleMesh){
   const vis=wet>0.02;
   if(puddleMesh.visible!==vis)puddleMesh.visible=vis;
   if(vis)puddleMesh.material.opacity=0.12+wet*0.52;
  }
  /* wet gravel is darker gravel — the banks go down a third of a stop in the rain */
  for(let i=0;i<apronMats.length;i++){
   const b=apronBase[i], f=1-wet*0.32;
   apronMats[i].color.setRGB(b.r*f,b.g*f,b.b*f);
  }
  if(P.punt){P.punt.position.y=P.puntY+Math.sin(t*1.1)*0.012;P.punt.rotation.z=Math.sin(t*0.83)*0.017;}
  P.wet=wet;
 }
 P.tick=waterTick;
 G.on('tick',waterTick);

 P.ok=true;
}
