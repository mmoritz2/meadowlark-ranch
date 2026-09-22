/* Feature package 'world-flora' — the planting pass over Kestrel Basin.
   Owned by that package: edit only this file and the inline hot spots assigned to it. See
   index.js for the contract. Nothing runs at import time.

   The basin was planted the way a random number generator plants: five hundred trees thrown at a
   disc, two hundred and eighty bushes thrown at the same disc, and grass everywhere in between.
   From the saddle that reads as a municipal park — isolated lollipops standing on mown lawn —
   because real country is never evenly spaced. It is clumped. Woods come in copses with a scrubby
   margin; field boundaries are hedges with the odd standard oak left in them; a pasture has one
   tree in the middle of it and nothing else for eighty metres; reeds come in beds, not a fringe;
   bracken takes the slope and stops at the bottom. That clumping is the whole of this file.

   It is also where the four new quarters get their identity. They opened with a ground colour and
   a share of the same scattered oak, which is why Amberwood reads as brown dirt and Ochre Reach as
   an empty beach. Here they are planted as four different places: turning broadleaf and deadwood
   in Amberwood, willow and reed and sedge at Willowmere, snow-laden conifer at Frostpine, agave
   and sage and silvered snags on the Ochre.

   Everything is instanced, one draw call per kind, built once at install: about forty-two thousand
   plants in sixteen instanced meshes, measured at nineteen extra draw calls and 0.48 M triangles
   (+4%) against a 2,570-call, 12 M-triangle frame, and at no median or p95 frame time this machine
   can measure — six alternating A/B samples in one page came back 100 ms / 150 ms both with the
   planting and without it. Every plant is made of the same two primitives — a tapered tube and a
   flat card — merged into one geometry per kind, which is what keeps that possible. Nothing here
   allocates after install; the tick hook writes two values into shared uniforms and reads the
   quality tier.

   Placement is seeded, so the wood is in the same place on every load and a screenshot taken today
   can be compared with one taken tomorrow. It keeps out of the arena, the river and the creek, the
   lake, the roads, the bridge and everything that has already put a collider on the map — which
   includes every town building world.js placed — and it leaves a clear circle at each town centre
   and at the exact centre of each of the four quarters, because six other packages are building
   there and a barn dropped into a thicket helps nobody. */
import {getFoliageTexture} from '../world-art.js';
export const id='world-flora';
export function install(G){
 const {THREE,scene}=G, W=G.world, T=G.tables;
 const groundH=W.groundH, riverZ=W.riverZ, streamX=W.streamX, pathDist=W.pathDist;
 const F={};                                             // this package's live state, exposed for QA
 G.floraPkg=F;

 /* ================= 0. determinism, noise, geometry of the basin ================= */
 /* Math.random would move every copse on every reload, which makes a before/after screenshot
    worthless and makes the world feel like it is being re-rolled under the player. */
 let _sd=0x9e3779b9;
 const rnd=()=>{_sd|=0;_sd=_sd+0x6D2B79F5|0;let t=Math.imul(_sd^_sd>>>15,1|_sd);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
 const rr=(a,b)=>a+rnd()*(b-a);
 const pick=a=>a[(rnd()*a.length)|0];
 const hsh=(i,j)=>{let h=(Math.imul(i|0,374761393)+Math.imul(j|0,668265263))|0;h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967295;};
 const vn=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
  const a=hsh(ix,iz),b=hsh(ix+1,iz),c=hsh(ix,iz+1),d=hsh(ix+1,iz+1);return a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz;};
 const hyp=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
 /* How steep the ground is here, from the same surface the horse walks on. Bracken wants this
    and trees do not want the top of it. */
 const slopeAt=(x,z)=>Math.hypot(groundH(x+2,z)-groundH(x-2,z),groundH(x,z+2)-groundH(x,z-2))/4;

 /* The regions whose planting differs, spelled the way ranch3d.html spells them so a plant and
    the ground colour underneath it always agree about which country they are in. */
 const AMBER={x:300,z:-300,r:130}, MARSH={x:310,z:300,r:120}, TUNDRA={x:-300,z:-320,r:125},
       BADLAND={x:-330,z:300,r:125}, DESERT={x:-220,z:130,r:150}, SNOW={x:-160,z:-210,r:150};
 const inC=(c,x,z,k)=>hyp(x,z,c.x,c.z)<c.r*(k||1);
 const biomeAt=(x,z)=>inC(DESERT,x,z)?'desert':inC(SNOW,x,z)?'snow':inC(AMBER,x,z)?'amber':
  inC(MARSH,x,z)?'marsh':inC(TUNDRA,x,z)?'tundra':inC(BADLAND,x,z)?'badland':'meadow';
 const BRA=riverZ(0)-7.5, BRB=riverZ(0)+7.5;

 /* ================= 1. where a plant may not go ================= */
 /* Circles other people own. The town centres come out of world.js's own table when it is there,
    so moving a town moves the clearing with it, and the four quarter centres are reserved by hand
    for whatever the quarters package decides to build on them. */
 const KEEP=[[0,0,34],[20,16,12],[0,120,24],[-150,-232,28],[-200,158,13],[-71,-10,44],
             [300,-300,30],[310,300,30],[-300,-320,30],[-330,300,30]];
 try{for(const tn of (G.worldPkg&&G.worldPkg.TOWNS)||[])KEEP.push([tn.cx,tn.cz,30]);}catch(e){}
 try{for(const rg of T.REGIONS)if(rg.id==='cottonwood')KEEP.push([rg.x,rg.z,20]);}catch(e){}
 /* Barleyfold is a working farm inside a wall: wheat, not woodland. Hedges and copses stop at it. */
 const inFarm=(x,z)=>x>174&&x<262&&z>-152&&z<-58;
 /* Fast-travel stops and the town arenas too: stepping off a fast travel into the middle of a
    thicket is the sort of thing only the person who planted the thicket ever forgives. */
 try{for(const f of T.FT)if(f&&f.length>2)KEEP.push([f[1],f[2],15]);}catch(e){}
 try{for(const rg of T.REGIONS)if(rg.venue)KEEP.push([rg.venue.x,rg.venue.z,32]);}catch(e){}
 const inKeep=(x,z)=>{for(let i=0;i<KEEP.length;i++){const k=KEEP[i],dx=x-k[0],dz=z-k[1];if(dx*dx+dz*dz<k[2]*k[2])return true;}return false;};
 /* Keeping the trunks out of a clearing is not the same as leaving the clearing visible. A circle
    of thirty metres at the centre of Cottonwood stops a tree standing in the street and does
    nothing about the wood that grows to the edge of it: from the rise south of the village, six
    cottages and their name labels went behind a wall of conifer, and the bridge and the ferry dock
    went behind one oak. So a copse — which is a knot of trees up to twenty-two metres across, not
    a single trunk — is measured as a disc against these circles rather than as a point, and given
    room besides. Scrub, bracken, reeds and flowers are unaffected: they are knee-high and hide
    nothing. */
 const keepClear=(x,z,pad)=>{for(let i=0;i<KEEP.length;i++){const k=KEEP[i],dx=x-k[0],dz=z-k[1],R=k[2]+pad;if(dx*dx+dz*dz<R*R)return true;}return false;};
 /* The race routes are lines the game will gallop a horse down at speed with a following camera.
    Trees carry colliders, so a copse grown across one turns a race into a pinball table; the
    corridor is kept clear of anything with a trunk. Same cheap bounding-box reject as pathDist. */
 const RSEG=[];
 try{for(const k in T.RACE_ROUTES){const pl=T.RACE_ROUTES[k];
  for(let i=0;i<pl.length-1;i++){const a=pl[i],b=pl[i+1],dx=b[0]-a[0],dz=b[1]-a[1];
   RSEG.push({ax:a[0],az:a[1],dx,dz,l2:dx*dx+dz*dz||1e-6,lo:Math.min(a[0],b[0])-11,hi:Math.max(a[0],b[0])+11,zlo:Math.min(a[1],b[1])-11,zhi:Math.max(a[1],b[1])+11});}}}catch(e){}
 const onRace=(x,z)=>{for(let i=0;i<RSEG.length;i++){const s=RSEG[i];
  if(x<s.lo||x>s.hi||z<s.zlo||z>s.zhi)continue;
  let t=((x-s.ax)*s.dx+(z-s.az)*s.dz)/s.l2; t=t<0?0:t>1?1:t;
  const px=s.ax+s.dx*t-x, pz=s.az+s.dz*t-z; if(px*px+pz*pz<81)return true;}
  return false;};

 /* Everything already standing on the map, in a 16-unit grid so asking "is this spot taken" is a
    look at nine buckets instead of a walk down a list of nine hundred. The grid is fed as this
    package plants, too, so two of my own trees never end up inside one another. */
 const HC=16, occ=new Map();
 const key=(i,j)=>i*8192+j;
 const addOcc=(x,z,r)=>{const i0=Math.floor((x-r)/HC),i1=Math.floor((x+r)/HC),j0=Math.floor((z-r)/HC),j1=Math.floor((z+r)/HC);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=key(i,j);let a=occ.get(k);if(!a)occ.set(k,a=[]);a.push(x,z,r);}};
 for(const c of W.colliders)addOcc(c.x,c.z,c.r);
 const taken=(x,z,pad)=>{const i=Math.floor(x/HC),j=Math.floor(z/HC);
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const a=occ.get(key(i+di,j+dj));if(!a)continue;
   for(let n=0;n<a.length;n+=3){const dx=x-a[n],dz=z-a[n+1],r=a[n+2]+pad;if(dx*dx+dz*dz<r*r)return true;}}
  return false;};
 /* Woodiness: how many slim trunks stand within R of here. This is how the undergrowth finds the
    existing five hundred and sixty trees without being told where they are — thick under a stand,
    thicker still at its edge, nothing out in the open. */
 const woodAt=(x,z,R)=>{const i0=Math.floor((x-R)/HC),i1=Math.floor((x+R)/HC),j0=Math.floor((z-R)/HC),j1=Math.floor((z+R)/HC);let n=0;
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const a=occ.get(key(i,j));if(!a)continue;
   for(let k=0;k<a.length;k+=3){if(a[k+2]>1.4)continue;const dx=x-a[k],dz=z-a[k+1];if(dx*dx+dz*dz<R*R)n++;}}
  return n;};

 /* Water, roads and the arena. Two tiers: dry ground wants to be well clear of the channel, and
    grass and reed are allowed right down the bank. */
 const inBasin=(x,z)=>x*x+z*z<448*448;
 const onWater=(x,z,m)=>Math.abs(z-riverZ(x))<m||(z<166&&Math.abs(x-streamX(z))<m*0.8)||hyp(x,z,20,16)<m+2;
 const okGround=(x,z)=>{
  if(!inBasin(x,z))return false;
  if(Math.abs(x)<32&&Math.abs(z)<28)return false;          // the arena and its run-off stay sand
  if(Math.abs(x)<5&&z>BRA-3&&z<BRB+3)return false;         // never on the bridge deck
  return pathDist(x,z)>3.4;                                // the roads are worn, and stay worn
 };
 const okDry=(x,z,pad)=>okGround(x,z)&&!onWater(x,z,9)&&!inKeep(x,z)&&!onRace(x,z)&&!taken(x,z,pad===undefined?1.2:pad);
 const okSoft=(x,z)=>okGround(x,z)&&!onWater(x,z,5.4)&&!taken(x,z,0.35);   // grass, flowers, litter

 /* ================= 2. textures ================= */
 /* Two of these are the game's own twig sprays, so a copse of mine standing beside one of the
    Weber-Penn trees is made of the same leaves. The other six are drawn here because nothing in
    the basin looked like a bulrush, a snow-loaded spruce or a sagebrush yet. */
 /* `gutter` is the colour left under the transparent texels. A canvas clears to rgba(0,0,0,0), and
    the moment a mip level is built the renderer averages that black in with the leaf edges: from
    forty metres a sage bush stops being grey-green and becomes a dark speck. world-art.js solves
    exactly this for the game's own twig sprays. Bytes go in and out of the canvas as sRGB, so the
    hex is unpacked by hand rather than through THREE.Color, which would convert it to linear. */
 const hexB=h=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];};
 const cvt=(w,h,draw,gutter)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const cx2=cv.getContext('2d');draw(cx2,w,h);
  if(gutter){const im=cx2.getImageData(0,0,w,h),d=im.data,gb=hexB(gutter);
   for(let i=0;i<d.length;i+=4)if(d[i+3]<20){d[i]=gb[0];d[i+1]=gb[1];d[i+2]=gb[2];}
   cx2.putImageData(im,0,0);}
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;};
 const oakTex=getFoliageTexture(THREE,'oak'), birchTex=getFoliageTexture(THREE,'birch'), pineTex=getFoliageTexture(THREE,'pine');
 /* A spruce spray with snow sitting on top of it. Drawn pale so the instance tint can only ever
    cool it further: a white conifer cannot be made by multiplying a green one. */
 const coldTex=cvt(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);
  const spray=(x,y,ang,len,col,lw)=>{c.strokeStyle=col;c.lineWidth=lw;c.lineCap='round';
   c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.sin(ang)*len,y-Math.cos(ang)*len);c.stroke();};
  c.strokeStyle='#5d5a4a';c.lineWidth=5;c.beginPath();c.moveTo(128,250);c.quadraticCurveTo(126,140,130,18);c.stroke();
  for(let i=0;i<52;i++){const t=i/52,y=248-t*232,len=(1-t)*0.72*92+20;
   for(const s of[-1,1]){const a=s*(1.02+t*0.28);
    spray(128,y,a,len,['#7d9284','#6b8474','#8fa394'][i%3],5.2-t*2.1);
    spray(128,y,a*0.9,len*0.70,'#e8f2f4',2.4);             // the snow line along the top of each bough
    spray(128+Math.sin(a)*len*0.5,y-Math.cos(a)*len*0.5,a*1.5,len*0.34,['#8fa394','#728a7c'][i%2],3.0);
   }}
  for(let i=0;i<26;i++){const x=28+Math.random()*200,y=40+Math.random()*190;
   c.fillStyle='rgba(244,250,252,0.88)';c.beginPath();c.ellipse(x,y,5+Math.random()*7,2.6+Math.random()*2.4,0,0,7);c.fill();}
 },'#8fa394');
 /* Rush and sedge: straight strokes with a bulrush head on some of them. The card is taller than
    it is wide, so a reedbed reads as vertical from across the water. */
 const reedTex=cvt(128,256,(c,w,h)=>{c.clearRect(0,0,w,h);
  for(let i=0;i<20;i++){const x=10+Math.random()*108,lean=(Math.random()-0.5)*26,top=10+Math.random()*96;
   c.strokeStyle=['#7f9a55','#9db068','#67853f','#b4bb72'][i%4];c.lineWidth=4.6;c.lineCap='round';
   c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+lean*0.35,(h+top)/2,x+lean,top);c.stroke();
   if(i%4===1){c.fillStyle='#6b4a2e';c.beginPath();c.ellipse(x+lean,top+20,4.4,15,lean*0.012,0,7);c.fill();}}
 },'#8aa35e');
 /* A fan of blades for the tussocks that fill the band between the near-field grass and the trees.
    Bigger and coarser than a near-field blade on purpose: at eighty metres a half-metre blade is
    below a pixel and a metre-high tussock is not. */
 const tuftTex=cvt(160,160,(c,w,h)=>{c.clearRect(0,0,w,h);
  for(let i=0;i<26;i++){const x=16+Math.random()*128,tall=h*(0.42+Math.random()*0.56),lean=(Math.random()-0.5)*70;
   const g=c.createLinearGradient(0,h,0,h-tall);g.addColorStop(0,'#587a3c');g.addColorStop(0.55,'#7d9c50');g.addColorStop(1,i%5?'#a9c070':'#cdd28e');
   c.fillStyle=g;c.beginPath();c.moveTo(x-3.4,h);c.quadraticCurveTo(x+lean*0.4,h-tall*0.55,x+lean,h-tall);
   c.quadraticCurveTo(x+lean*0.4+3,h-tall*0.5,x+3.4,h);c.closePath();c.fill();}
 },'#74924a');
 /* Meadow flowers, drawn as a little spray of five heads rather than one bloom, so a drift of them
    reads as colour at distance instead of confetti. White here; the drift colour is per instance. */
 const petalTex=cvt(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);
  for(let i=0;i<7;i++){const x=22+Math.random()*84,y=16+Math.random()*64;
   c.strokeStyle='#6f8a4a';c.lineWidth=2.6;c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+(Math.random()-0.5)*18,(h+y)/2,x,y+7);c.stroke();
   for(let k=0;k<5;k++){const a=k/5*Math.PI*2;c.fillStyle=k%2?'#ffffff':'#f3f3ea';
    c.beginPath();c.ellipse(x+Math.cos(a)*5.4,y+Math.sin(a)*5.4,4.4,3.1,a,0,7);c.fill();}
   c.fillStyle='#ffe07a';c.beginPath();c.arc(x,y,3.1,0,7);c.fill();}
 },'#eff0e2');
 /* Sagebrush: a grey-green haze of very small leaves. Nothing in the basin's foliage set is this
    colour, and it is the single thing that makes a badland read as a badland rather than a beach. */
 const sageTex=cvt(160,160,(c,w,h)=>{c.clearRect(0,0,w,h);
  for(let i=0;i<11;i++){const bx=22+Math.random()*116,ba=(-0.5+Math.random())*0.9;
   c.strokeStyle='#8a8163';c.lineWidth=2.4;c.beginPath();c.moveTo(80,h);c.lineTo(bx,h*0.22+Math.random()*44);c.stroke();}
  /* Packed tight and biased to the middle. Nine scattered sprigs on a transparent card read, at
     forty metres and an alpha test of 0.28, as a handful of dark scraps rather than a bush. */
  for(let k=0;k<420;k++){
   const a=Math.random()*Math.PI*2, r=Math.pow(Math.random(),0.55)*66;
   const x=80+Math.cos(a)*r, y=h-14-Math.abs(Math.sin(a))*r*0.55-Math.pow(Math.random(),0.6)*72;
   c.fillStyle=['#a9b490','#94a37c','#bcc4a4','#7f8e68','#c6ccb0'][k%5];
   c.beginPath();c.ellipse(x,y,3.6,1.8,Math.random()*3,0,7);c.fill();}
 },'#a4b08c');
 /* Willow: long strands that hang rather than stand. Drawn tip-down so a card hung from a bough
    has its leaves the right way up. */
 const willowTex=cvt(128,256,(c,w,h)=>{c.clearRect(0,0,w,h);
  for(let i=0;i<13;i++){const x=10+Math.random()*108,sway=(Math.random()-0.5)*34,len=110+Math.random()*138;
   c.strokeStyle='#8d9b55';c.lineWidth=1.9;c.beginPath();c.moveTo(x,0);c.quadraticCurveTo(x+sway*0.5,len*0.55,x+sway,len);c.stroke();
   for(let k=2;k<16;k++){const t=k/16,px=x+sway*t*t,py=len*t;
    c.fillStyle=['#a6b76a','#8fa456','#c0c983'][k%3];
    c.beginPath();c.ellipse(px+(k%2?4:-4),py,2.2,7.4,(k%2?0.5:-0.5),0,7);c.fill();}}
 },'#a2b268');
 /* One tapering blade, tip up, for the agave rosettes and the ocotillo whips. Without it the
    succulent material has no map at all and every blade renders as the rectangle the card actually
    is, which from the saddle read as pale paper cut-outs stuck in the sand. */
 const bladeTex=cvt(64,128,(c,w,h)=>{c.clearRect(0,0,w,h);
  const g=c.createLinearGradient(0,h,0,0);g.addColorStop(0,'#6f8a68');g.addColorStop(0.45,'#9ab894');g.addColorStop(1,'#cdd9b4');
  c.fillStyle=g;c.beginPath();c.moveTo(w*0.5-13,h);c.quadraticCurveTo(w*0.5-11,h*0.36,w*0.5,2);
  c.quadraticCurveTo(w*0.5+11,h*0.36,w*0.5+13,h);c.closePath();c.fill();
  c.strokeStyle='rgba(255,255,255,0.32)';c.lineWidth=1.6;c.beginPath();c.moveTo(w*0.5,h);c.lineTo(w*0.5,6);c.stroke();
  c.strokeStyle='rgba(120,96,62,0.55)';c.lineWidth=1.2;                 // the dry spine down each edge
  c.beginPath();c.moveTo(w*0.5-12.4,h);c.quadraticCurveTo(w*0.5-10,h*0.36,w*0.5,4);c.stroke();
  c.beginPath();c.moveTo(w*0.5+12.4,h);c.quadraticCurveTo(w*0.5+10,h*0.36,w*0.5,4);c.stroke();
 },'#9ab894');
 /* Bark, for the trunks and the dead timber. One texture, tinted per instance: a birch is the same
    stripes lightened, a silvered desert snag the same stripes drained. Drawn pale on purpose. The first pass used a dark bark and a near-white tint and every trunk
    in Amberwood came out charcoal against a gold canopy, which read as a burnt wood rather than an
    autumn one. Instance colour can only ever darken a texture, so the texture has to start light. */
 const barkTex=cvt(128,256,(c,w,h)=>{c.fillStyle='#a2937c';c.fillRect(0,0,w,h);
  for(let i=0;i<130;i++){const x=Math.random()*w;c.strokeStyle='rgba(74,62,48,'+(0.05+Math.random()*0.15)+')';
   c.lineWidth=0.5+Math.random()*2.6;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+(Math.random()-0.5)*10,h*0.34,x+(Math.random()-0.5)*8,h*0.7,x+(Math.random()-0.5)*7,h);c.stroke();}
  for(let i=0;i<46;i++){c.fillStyle='rgba(228,214,184,0.3)';c.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*22,0.8+Math.random()*2.2);}
 });
 barkTex.wrapS=barkTex.wrapT=THREE.RepeatWrapping;

 /* ================= 3. materials ================= */
 /* One shared time uniform for the sway. three r160 keys a compiled program on the material's
    parameters and customProgramCacheKey but NOT on the source of onBeforeCompile, so two of these
    would otherwise share one program and one of the two swaying amounts would silently be lost. */
 const uT={value:0}, uCam={value:new THREE.Vector3()};
 /* `duck` collapses a plant toward its own base as the camera closes on it. The chase camera rides
    about two metres up and five behind the horse, which puts it straight through the middle of any
    bush the horse has just brushed past: the first pass photographed the river bank from inside a
    hedge, four leaves filling the frame. Everything below knee-to-chest height ducks; trees do not,
    because riding under a canopy and seeing leaves is the point of riding under a canopy. */
 const windy=(mat,amt,tag,duck)=>{
  mat.onBeforeCompile=sh=>{sh.uniforms.uFT=uT;sh.uniforms.uCam=uCam;
   sh.vertexShader='uniform float uFT; uniform vec3 uCam;\n'+sh.vertexShader.replace('#include <begin_vertex>',
`#include <begin_vertex>
#ifdef USE_INSTANCING
 vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
 float ph=ip.x*0.31+ip.z*0.23;
 transformed.x+=(sin(uFT*1.15+ph)*${amt.toFixed(3)}+sin(uFT*2.73+ph*1.9)*${(amt*0.34).toFixed(3)})*transformed.y;
 transformed.z+=cos(uFT*0.93+ph)*transformed.y*${(amt*0.55).toFixed(3)};
${duck?' transformed*=max(smoothstep(4.0,9.0,uCam.y-ip.y),smoothstep(0.7,3.1,distance(ip.xz,uCam.xz)));':''}
#endif`);};
  mat.customProgramCacheKey=()=>'flora:'+tag;
  return mat;};
 /* Ground cover ducks out of the camera's way by collapsing; a tree cannot, because collapsing a
    whole oak as you ride under it is far more noticeable than the leaves it was hiding. Nineteen
    hundred new trees means the chase camera now sometimes settles inside a crown — one screenshot
    came back with the rider completely hidden behind leaves — so the canopy dissolves its own
    fragments within about two metres of the eye instead. The alpha test does the cutting, which is
    already running on these materials, and the shadow pass uses its own depth material and is not
    affected, so the tree goes on casting the shadow it should. */
 const nearFade=(mat,tag)=>{
  const prev=mat.onBeforeCompile;
  mat.onBeforeCompile=sh=>{
   if(prev)prev(sh);                                      // windy declares uCam and does the sway
   sh.uniforms.uCam=uCam;
   sh.vertexShader=sh.vertexShader
    .replace('#include <common>','#include <common>\nvarying float vFloraD;')
    .replace('#include <project_vertex>',
`vec4 _fp=vec4(transformed,1.0);
#ifdef USE_INSTANCING
 _fp=instanceMatrix*_fp;
#endif
vFloraD=distance((modelMatrix*_fp).xyz,uCam);
#include <project_vertex>`);
   sh.fragmentShader=sh.fragmentShader
    .replace('#include <common>','#include <common>\nvarying float vFloraD;')
    .replace('#include <alphatest_fragment>','diffuseColor.a*=smoothstep(0.85,2.9,vFloraD);\n\t#include <alphatest_fragment>');
  };
  mat.customProgramCacheKey=()=>'flora:'+tag+':fade';
  return mat;};
 const leafMat=(map,tag,sway,at,duck)=>nearFade(windy(Object.assign(new THREE.MeshStandardMaterial({map,side:THREE.DoubleSide,
   roughness:1,vertexColors:true,alphaTest:at||0.34,alphaToCoverage:true}),{envMapIntensity:0.72}),sway,tag,duck),tag);
 /* Ground cover was tried on MeshLambertMaterial: it is a good deal cheaper per fragment, and on a
    six-frame A/B ping-pong it saved nothing this machine could measure — while visibly darkening
    every tussock in the basin, because Lambert does not take scene.environment and the sky is where
    half the light in this valley comes from. Standard it is; what actually cost something was the
    shadow sampling and the per-sample alpha coverage, and both of those are off down here. */
 const coverMat=(map,tag,sway,at,noDuck)=>windy(Object.assign(new THREE.MeshStandardMaterial({map,
   side:THREE.DoubleSide,roughness:1,vertexColors:true,alphaTest:at||0.34}),{envMapIntensity:0.72}),sway,tag,noDuck?0:1);
 const M={
  bark  :Object.assign(new THREE.MeshStandardMaterial({map:barkTex,roughness:1,vertexColors:true}),{envMapIntensity:0.5}),
  oak   :leafMat(oakTex,'oak',0.030),
  birch :leafMat(birchTex,'birch',0.036),
  pine  :leafMat(pineTex,'pine',0.018,0.22),
  cold  :leafMat(coldTex,'cold',0.016,0.22),
  willow:leafMat(willowTex,'willow',0.055,0.30),
  scrub :coverMat(oakTex,'scrub',0.052,0.34),
  juni  :coverMat(pineTex,'juni',0.030,0.22),
  sage  :coverMat(sageTex,'sage',0.040,0.28),
  brack :coverMat(oakTex,'brack',0.048,0.34),
  reed  :coverMat(reedTex,'reed',0.085,0.30),
  tuft  :coverMat(tuftTex,'tuft',0.070,0.34),
  petal :coverMat(petalTex,'petal',0.045,0.40),
  succ  :coverMat(bladeTex,'succ',0.014,0.42,1),
 };
 F.mats=M;

 /* ================= 4. two primitives, and every plant made of them ================= */
 /* A writer that knows a tapered tube and a flat card and nothing else. Vertex colours are baked
    in as shading — the interior of a canopy darker than its sunlit rim — which also matters
    because the leaf and bark materials run with vertexColors on and a geometry without the
    attribute would render black. */
 function W3(){
  const P=[],N=[],U=[],C=[],I=[];
  const _a=new THREE.Vector3(),_r=new THREE.Vector3(),_f=new THREE.Vector3(),_n=new THREE.Vector3(),_p=new THREE.Vector3();
  const tube=(ax,ay,az,bx,by,bz,r0,r1,sides,sh)=>{
   _a.set(bx-ax,by-ay,bz-az);const len=_a.length();if(len<0.004)return;_a.divideScalar(len);
   _r.set(0,1,0).cross(_a);if(_r.lengthSq()<0.0008)_r.set(1,0,0);_r.normalize();_f.copy(_a).cross(_r).normalize();
   const base=P.length/3;
   for(let ring=0;ring<2;ring++)for(let i=0;i<=sides;i++){
    const a=i/sides*Math.PI*2;_n.copy(_r).multiplyScalar(Math.cos(a)).addScaledVector(_f,Math.sin(a));
    _p.set(ring?bx:ax,ring?by:ay,ring?bz:az).addScaledVector(_n,ring?r1:r0);
    P.push(_p.x,_p.y,_p.z);N.push(_n.x,_n.y,_n.z);U.push(i/sides,ring*len*0.6);
    const s=sh*(ring?0.98:0.84);C.push(s,s,s);}
   for(let i=0;i<sides;i++){const a=base+i,b=a+sides+1;I.push(a,a+1,b,a+1,b+1,b);}
  };
  /* A quad standing on (x,y,z): width w, height h, yawed and then tilted away from vertical. `down`
     hangs it instead, for a willow. The normal is mostly up with a little of the card's own facing
     mixed in, which is what stops a field of cards flickering between lit and unlit as you ride. */
  const card=(x,y,z,yaw,tilt,w,h,sh,down)=>{
   const cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
   const base=P.length/3, sgn=down?-1:1;
   const nx=-sy*0.42+cy*st*0.5, ny=down?0.55:0.88, nz=cy*0.42+sy*st*0.5;
   const nl=Math.hypot(nx,ny,nz)||1;
   for(const [u,v] of [[-0.5,0],[0.5,0],[0.5,1],[-0.5,1]]){
    const lx=u*w, ly=v*h*ct*sgn, lo=v*h*st;
    P.push(x+lx*cy+lo*sy, y+ly, z-lx*sy+lo*cy);
    N.push(nx/nl,ny/nl,nz/nl);U.push(u+0.5,down?1-v:v);
    const s=sh*(0.86+0.14*v);C.push(s,s,s);}
   I.push(base,base+1,base+2,base,base+2,base+3);
  };
  const finish=()=>{const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
   g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
   g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
   g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
   g.setIndex(I);g.computeBoundingSphere();return g;};
  return {tube,card,finish};
 }
 /* Every plant is modelled one unit tall with its base on y=0, so the instance scale is simply the
    height in metres and the width multiplier its spread. */
 const trunkGeo=(()=>{const w=W3();
  w.tube(0,0,0,0.018,0.30,0.012,0.033,0.025,5,1.0);
  w.tube(0.018,0.30,0.012,0.030,0.55,0.020,0.025,0.017,5,1.0);
  /* The forks stop short. Taller ones poked out of the top of a small canopy and the tree read as
     dead with a wig on, which is exactly how Willowmere looked on the first pass. */
  for(let k=0;k<3;k++){const a=k*2.2+0.4;
   w.tube(0.030,0.55,0.020,0.030+Math.cos(a)*0.09,0.72,0.020+Math.sin(a)*0.09,0.016,0.007,4,0.95);}
  return w.finish();})();
 const snagGeo=(()=>{const w=W3();                        // dead timber: bare, broken, slightly leaning
  w.tube(0,0,0,0.05,0.5,0.03,0.055,0.034,5,0.99);
  w.tube(0.05,0.5,0.03,0.07,0.92,0.04,0.034,0.014,5,0.99);
  w.tube(0.05,0.44,0.03,0.30,0.66,-0.10,0.024,0.006,4,0.92);
  w.tube(0.04,0.30,0.02,-0.24,0.52,0.14,0.022,0.006,4,0.92);
  w.tube(0.06,0.70,0.035,0.20,0.80,0.16,0.016,0.005,4,0.90);
  return w.finish();})();
 /* A crown is many small twig sprays, not a few enormous ones. The artwork on the leaf texture is
    drawn at about seventy centimetres to a card; the first pass hung cards four metres across on an
    eight-metre oak and every leaf came out the size of a saddle. These are sized so a card lands
    near a metre of world at the heights these trees are planted at, which takes a lot more of them
    — still under a hundred triangles a tree, and a tree is drawn once for the whole basin. */
 const domeCanopy=(n,cx,cy,cz,rx,ryy,rz,sz,seedShift)=>{const w=W3();
  for(let i=0;i<n;i++){const a=i*2.39996+seedShift, t=(i+0.5)/n, ph=Math.acos(1-2*t);
   const j=0.78+hsh(i,3)*0.34;                           // the shell is lumpy, not a smooth ball
   const x=cx+Math.sin(ph)*Math.cos(a)*rx*j, y=cy+Math.cos(ph)*ryy*j, z=cz+Math.sin(ph)*Math.sin(a)*rz*j;
   const sh=0.58+0.40*Math.min(1,Math.hypot((x-cx)/rx,(z-cz)/rz)*0.7+(y-cy+ryy)/(2*ryy)*0.5);
   w.card(x,y-sz*0.5,z,a*1.7,(hsh(i,7)-0.5)*1.1,sz*1.12,sz,sh);}
  return w.finish();};
 const oakGeo=domeCanopy(56,0,0.70,0,0.46,0.27,0.46,0.155,0.0);
 const birchGeo=domeCanopy(44,0,0.72,0,0.31,0.31,0.31,0.135,1.3);
 const blossomGeo=domeCanopy(48,0,0.66,0,0.42,0.25,0.42,0.15,2.6);
 const coneCanopy=tiers=>{const w=W3();
  for(let t=0;t<tiers;t++){const f=t/tiers, y=0.10+f*0.84, rad=Math.pow(1-f,0.82)*0.38+0.03, n=7;
   for(let i=0;i<n;i++){const a=i/n*Math.PI*2+t*1.1, j=0.74+hsh(t*13+i,5)*0.52;
    w.card(Math.cos(a)*rad*0.58,y,Math.sin(a)*rad*0.58,a,0.86+hsh(i,t+2)*0.3,0.15*(1-f*0.45)*j,0.16*(1-f*0.4)*j,0.6+0.34*f);}}
  w.card(0,0.92,0,0.7,0.1,0.10,0.11,0.99);
  return w.finish();};
 const pineGeo=coneCanopy(9);
 const willowGeo=(()=>{const w=W3();                      // a broad low dome, and strands hung off it
  for(let i=0;i<26;i++){const a=i*2.39996, t=(i+0.5)/26, ph=Math.acos(1-2*t);
   w.card(Math.sin(ph)*Math.cos(a)*0.44,0.72+Math.cos(ph)*0.22,Math.sin(ph)*Math.sin(a)*0.44,a*1.7,0.5,0.19,0.17,0.84);}
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2+0.3, r=0.28+hsh(i,3)*0.26;
   w.card(Math.cos(a)*r,0.74+hsh(i,9)*0.14,Math.sin(a)*r,a+0.6,0.06,0.18,0.34+hsh(i,5)*0.28,0.80,true);}
  return w.finish();})();
 /* Scrub: five cards crossing through a common base. This is the workhorse — hedge, thicket edge,
    woodland margin, dry brush, sallow. Ten triangles, and there are eight thousand of them. */
 const scrubGeo=(()=>{const w=W3();
  for(let i=0;i<7;i++){const a=i*2.39996+0.2, t=(i+0.4)/7;
   w.card(Math.cos(a)*(0.10+t*0.16),0.02+t*0.34,Math.sin(a)*(0.10+t*0.16),a*1.4,0.30+hsh(i,11)*0.34,0.56,0.58+hsh(i,4)*0.24,0.62+t*0.36);}
  return w.finish();})();
 /* Bracken and fallen-leaf litter: the same idea splayed outward so it lies low and covers ground. */
 const brackGeo=(()=>{const w=W3();
  for(let i=0;i<7;i++){const a=i*0.8976+0.4;
   w.card(Math.cos(a)*0.12,0.01,Math.sin(a)*0.12,a,0.70+hsh(i,13)*0.28,0.62,0.54,0.62+i*0.05);}
  return w.finish();})();
 const crossGeo=(n,wid,lean)=>{const w=W3();
  for(let i=0;i<n;i++){const a=i/n*Math.PI+0.3;w.card(0,0,0,a,lean*(hsh(i,17)-0.4),wid,1,0.70+i*0.09);}
  return w.finish();};
 const reedGeo=crossGeo(3,0.46,0.16), tuftGeo=crossGeo(3,1.15,0.24), petalGeo=crossGeo(2,0.52,0.10);
 /* An agave rosette. Scaled tall and thin by its instance it becomes an ocotillo, which is the only
    other silhouette a red-rock badland really needs. */
 /* Agave blades stand up and splay; the first pass leaned them to sixty degrees and from a rise the
    whole colony read as green starfish lying on the sand. */
 const succGeo=(()=>{const w=W3();
  for(let i=0;i<13;i++){const a=i*2.39996, lean=0.18+hsh(i,23)*0.52;
   w.card(0,0.02,0,a,lean,0.24,0.96-hsh(i,29)*0.26,0.66+hsh(i,31)*0.32);}
  return w.finish();})();

 /* ================= 5. the instanced banks ================= */
 const LOW=G.gfx&&G.gfx.get&&G.gfx.get()==='low';
 const N=n=>Math.max(8,Math.round(n*(LOW?0.45:1)));
 const BANK={};
 const bank=(name,geo,mat,cap,shadow)=>{
  const im=new THREE.InstancedMesh(geo,mat,cap);
  im.name='flora_'+name; im.castShadow=!!shadow; im.frustumCulled=false;
  /* A knee-high plant that samples a 4096 shadow map with soft PCF per fragment costs real time and
     buys a shadow nobody has ever noticed on a tussock; the ground it stands on is already shaded.
     Trees keep it, because a wood with unshaded trunks looks wrong straight away. */
  im.receiveShadow=!!shadow;
  im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  scene.add(im);   // deliberately not registered with followCamera: the camera should push through a hedge
  return BANK[name]={im,n:0,cap};
 };
 /* Trunks and canopies cast; nothing below knee height does. A shadow map pass over forty thousand
    alpha-tested cards would cost more than the planting is worth, and at the sizes involved nobody
    would see the difference. A canopy that does cast needs a depth material that respects the alpha
    or the wood throws rectangles: the default depth pass ignores the map entirely. */
 const depthOf=mat=>{const d=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:THREE.DoubleSide});
  d.customProgramCacheKey=()=>'floradepth:'+mat.customProgramCacheKey();return d;};
 bank('trunk',trunkGeo,M.bark,N(2750),true);
 bank('snag',snagGeo,M.bark,N(430),true);
 bank('oak',oakGeo,M.oak,N(1080),true);
 bank('blossom',blossomGeo,M.oak,N(260),true);
 bank('birch',birchGeo,M.birch,N(380),true);
 bank('pine',pineGeo,M.pine,N(300),true);
 bank('cold',pineGeo,M.cold,N(680),true);
 bank('willow',willowGeo,M.willow,N(170),true);
 bank('scrub',scrubGeo,M.scrub,N(11000),false);
 bank('juni',scrubGeo,M.juni,N(2500),false);
 bank('sage',scrubGeo,M.sage,N(4200),false);
 bank('brack',brackGeo,M.brack,N(3700),false);
 bank('reed',reedGeo,M.reed,N(4800),false);
 bank('tuft',tuftGeo,M.tuft,N(12500),false);
 bank('petal',petalGeo,M.petal,N(9000),false);
 bank('succ',succGeo,M.succ,N(1500),false);
 for(const k of ['oak','blossom','birch','pine','cold','willow'])BANK[k].im.customDepthMaterial=depthOf(BANK[k].im.material);
 /* The ground cover is flat colour under a sky light; the physical BRDF, the environment term and
    the specular lobe are all invisible on a tussock and are paid for on every one of the many
    thousand fragments they cover. Lambert draws the same picture for a fraction of the fragment. */
 F.bank=BANK;

 const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_sc=new THREE.Vector3(),_col=new THREE.Color();
 /* One plant. h is its height in metres, wid its spread relative to that, and sink how far its base
    is pushed under the analytic ground — a stem that hovers a centimetre on a crest is the first
    thing the eye finds. */
 function put(name,x,z,h,wid,col,lean,sink){
  const b=BANK[name]; if(!b||b.n>=b.cap)return false;
  _e.set((rnd()-0.5)*(lean||0),rnd()*Math.PI*2,(rnd()-0.5)*(lean||0));
  _q.setFromEuler(_e); _sc.set(h*wid,h,h*wid);
  _v.set(x,groundH(x,z)-(sink===undefined?0.04:sink)*h,z);
  _m.compose(_v,_q,_sc); b.im.setMatrixAt(b.n,_m);
  _col.set(col).offsetHSL((rnd()-0.5)*0.035,(rnd()-0.5)*0.13,(rnd()-0.5)*0.13);
  b.im.setColorAt(b.n,_col); b.n++; return true;
 }
 /* A tree is a trunk and a canopy sharing one transform, plus a collider, because a horse should
    not walk through a trunk and because the packages that build after this one call findClear
    against the same list and will site their barns in the clearings instead. */
 const TREE={oak:'#dff0c8',blossom:'#ffe8ee',birch:'#e6f2d0',pine:'#dfeccd',cold:'#eef7fb',willow:'#f2f7d8'};
 const BARK={oak:'#e4dac6',blossom:'#e2d6c4',birch:'#fbf8f0',pine:'#cdc2ad',cold:'#d2d6d4',willow:'#ddd2bd'};
 function tree(kind,x,z,h,wid,leafCol,barkCol,noColl){
  const b=BANK[kind]; if(!b||b.n>=b.cap)return false;
  const y=groundH(x,z)-0.05*h;
  _e.set((rnd()-0.5)*0.06,rnd()*Math.PI*2,(rnd()-0.5)*0.06);_q.setFromEuler(_e);
  _sc.set(h*wid,h,h*wid);_v.set(x,y,z);_m.compose(_v,_q,_sc);
  b.im.setMatrixAt(b.n,_m);_col.set(leafCol||TREE[kind]).offsetHSL((rnd()-0.5)*0.03,(rnd()-0.5)*0.12,(rnd()-0.5)*0.11);
  b.im.setColorAt(b.n,_col);b.n++;
  const tb=BANK.trunk;
  if(tb.n<tb.cap){tb.im.setMatrixAt(tb.n,_m);_col.set(barkCol||BARK[kind]||'#ddd2ba').offsetHSL(0,(rnd()-0.5)*0.10,(rnd()-0.5)*0.22);tb.im.setColorAt(tb.n,_col);tb.n++;}
  if(!noColl){const r=Math.max(0.55,h*0.055);W.colliders.push({x,z,r});addOcc(x,z,r);}
  /* And onto forestPoints, the list the follow camera reads to keep its eye and its sight line out
     of the trees. Every copse this package planted had a collider for the horse and was invisible
     to the camera, which only knew the valley's first trees; that stayed hidden while the eye rode
     three metres up and put trunks straight across the shot once it came down to eye level. Its
     crown model is an ~8 m tree at scale 1, so s is the height over eight. */
  if(!noColl&&h>3&&W.forestPoints)W.forestPoints.push({x,z,s:h/8});
  return true;
 }
 function snag(x,z,h,col){
  const b=BANK.snag; if(b.n>=b.cap)return false;
  _e.set((rnd()-0.5)*0.12,rnd()*Math.PI*2,(rnd()-0.5)*0.12);_q.setFromEuler(_e);
  _sc.set(h*0.9,h,h*0.9);_v.set(x,groundH(x,z)-0.06*h,z);_m.compose(_v,_q,_sc);
  b.im.setMatrixAt(b.n,_m);_col.set(col||'#efe9db').offsetHSL(0,(rnd()-0.5)*0.08,(rnd()-0.5)*0.12);b.im.setColorAt(b.n,_col);b.n++;
  W.colliders.push({x,z,r:0.5});addOcc(x,z,0.5);return true;
 }

 /* ================= 6. the planting ================= */
 /* Colours are given as what the leaf texture is multiplied by, so they can only tint and darken —
    which is why the snowy conifer has a texture of its own rather than a white tint. */
 const UNDER={meadow:'#d2e2b4',amber:'#f0a54e',marsh:'#c6dda2',
  tundra:'#b6c9b4',badland:'#d8bc88',desert:'#dcc189',snow:'#c7d6c8'};
 const AUT=['#ffa851','#e8842f','#ffc763','#d2642c'];
 /* Roughly how far the plant should be from open water, by kind. */
 const site=(cx,cz,spread,pad,test)=>{                    // a point near (cx,cz) that passes `test`
  for(let k=0;k<14;k++){const a=rnd()*Math.PI*2, r=spread*Math.sqrt(rnd());
   const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
   if(test(x,z,pad))return [x,z];}
  return null;};

 /* The four quarters are planted FIRST and deliberately. Several of these banks fill up — the
    meadow is enormous and will happily take every tussock there is — and the quarters are both
    the emptiest ground in the basin and the reason anyone is reading this file, so they get first
    call on the budget rather than whatever the meadow leaves behind. */
 const COPSE=[];
 /* ---- 6a. the four quarters, each planted as itself ----------------------------------------- */
 /* ---- Amberwood: a wood that has gone over, not a green one with a brown floor ---------------- */
 for(let i=0,made=0;i<4200&&made<25;i++){
  const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.55)*122;
  const cx=AMBER.x+Math.cos(a)*r, cz=AMBER.z+Math.sin(a)*r;
  if(!okDry(cx,cz,7)||slopeAt(cx,cz)>0.7)continue;
  made++;
  const R=rr(11,26), n=Math.round(8+R*1.5); COPSE.push([cx,cz,R]);
  for(let k=0;k<n;k++){
   const p=site(cx,cz,R*Math.pow(rnd(),0.6),2.6,okDry); if(!p)continue;
   const birch=rnd()<0.3;
   tree(birch?'birch':'oak',p[0],p[1],rr(6,11.5),rr(0.85,1.2),pick(AUT),birch?'#fcf8ee':'#e6d8bd');
  }
  for(let k=0;k<Math.round(n*4);k++){
   const a2=rnd()*Math.PI*2, r2=R*rr(0.25,1.9), x=cx+Math.cos(a2)*r2, z=cz+Math.sin(a2)*r2;
   if(!okSoft(x,z))continue;
   rnd()<0.42?put('brack',x,z,rr(0.4,1.0),rr(1.1,1.7),pick(['#d59440','#c07a2e','#e0ae55']),0.24)
             :put('scrub',x,z,rr(0.7,1.9),rr(0.95,1.45),pick(AUT),0.14);
  }
 }
 for(let i=0,made=0;i<900&&made<70;i++){                  // dead standing timber through the wood
  const a=rnd()*Math.PI*2,r=Math.pow(rnd(),0.6)*122,x=AMBER.x+Math.cos(a)*r,z=AMBER.z+Math.sin(a)*r;
  if(!okDry(x,z,2.2))continue; made++; snag(x,z,rr(3.4,7.2),'#e9dfcb');
 }

 /* ---- Willowmere: willow, sallow, sedge and standing rush ------------------------------------- */
 for(let i=0,made=0;i<3200&&made<26;i++){
  const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.5)*108;
  const cx=MARSH.x+Math.cos(a)*r, cz=MARSH.z+Math.sin(a)*r;
  if(!okDry(cx,cz,6))continue;
  made++;
  const R=rr(9,20); COPSE.push([cx,cz,R]);
  for(let k=0,t=Math.round(2+R*0.34);k<t;k++){
   const p=site(cx,cz,R*0.7,2.8,okDry); if(!p)continue;
   tree(rnd()<0.7?'willow':'birch',p[0],p[1],rr(5.5,9.5),rr(1.05,1.45),null,'#e0d5bd');
  }
  bedAt(cx,cz,R*1.35,Math.round(R*R*0.22),'#d7e9ae',true);
  for(let k=0;k<Math.round(R*3.4);k++){
   const a2=rnd()*Math.PI*2, r2=R*rr(0.4,1.9), x=cx+Math.cos(a2)*r2, z=cz+Math.sin(a2)*r2;
   if(!okSoft(x,z))continue;
   rnd()<0.45?put('tuft',x,z,rr(0.8,1.7),rr(1.1,1.5),'#c9de9e',0.16)
             :put('scrub',x,z,rr(0.7,1.8),rr(1.0,1.5),'#bdd8a0',0.14);
  }
 }
 for(let i=0,made=0;i<500&&made<26;i++){                  // drowned spars standing in the wet
  const a=rnd()*Math.PI*2,r=Math.pow(rnd(),0.6)*112,x=MARSH.x+Math.cos(a)*r,z=MARSH.z+Math.sin(a)*r;
  if(!okDry(x,z,2.2))continue; made++; snag(x,z,rr(3,6),'#d9d6c4');
 }

 /* ---- Frostpine: a treeline, and the same treeline drawn round the Hollowpeak snowfield -------- */
 function conifers(cx,cz,R,count,col){
  for(let k=0;k<count;k++){
   const p=site(cx,cz,R*Math.pow(rnd(),0.55),2.7,okDry); if(!p)continue;
   tree('cold',p[0],p[1],rr(7,14),rr(0.62,0.86),col||'#eef7fb','#cfd6da');
   for(let j=0;j<3;j++){const a2=rnd()*Math.PI*2,r2=rr(1.6,5.5),x=p[0]+Math.cos(a2)*r2,z=p[1]+Math.sin(a2)*r2;
    if(okSoft(x,z))put('juni',x,z,rr(0.4,1.3),rr(1.1,1.7),'#bfd0c4',0.2);}
  }
 }
 for(let i=0,made=0;i<3600&&made<28;i++){
  const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.5)*118;
  const cx=TUNDRA.x+Math.cos(a)*r, cz=TUNDRA.z+Math.sin(a)*r;
  if(!okDry(cx,cz,7))continue; made++;
  conifers(cx,cz,rr(10,22),Math.round(rr(7,16)));
 }
 for(let i=0,made=0;i<2200&&made<70;i++){                 // singles, so the stands are not islands
  const a=rnd()*Math.PI*2,r=Math.pow(rnd(),0.45)*122,x=TUNDRA.x+Math.cos(a)*r,z=TUNDRA.z+Math.sin(a)*r;
  if(!okDry(x,z,3.2))continue; made++;
  tree('cold',x,z,rr(6,11),rr(0.6,0.84),'#eef7fb','#cfd6da');
 }
 for(let k=0;k<26;k++){                                   // the tree line ringing the snowfield
  const a=k/26*Math.PI*2+0.3, r=SNOW.r*rr(0.72,0.98);
  const cx=SNOW.x+Math.cos(a)*r, cz=SNOW.z+Math.sin(a)*r;
  if(!okDry(cx,cz,6))continue;
  conifers(cx,cz,rr(7,15),Math.round(rr(4,10)),'#e4f0f4');
 }
 for(let i=0,made=0;i<600&&made<34;i++){
  const a=rnd()*Math.PI*2,r=Math.pow(rnd(),0.6)*118,x=TUNDRA.x+Math.cos(a)*r,z=TUNDRA.z+Math.sin(a)*r;
  if(!okDry(x,z,2.2))continue; made++; snag(x,z,rr(3.2,6.4),'#e2e6ea');
 }
 for(let i=0;i<7000;i++){                                 // low scrub on thin soil, clumped in the lee
  const a=rnd()*Math.PI*2,r=Math.pow(rnd(),0.5)*122,x=TUNDRA.x+Math.cos(a)*r,z=TUNDRA.z+Math.sin(a)*r;
  if(!okSoft(x,z))continue;
  if(vn(x*0.05+41,z*0.05+7)<0.46||rnd()>0.5)continue;
  put('juni',x,z,rr(0.3,1.1),rr(1.1,1.8),'#b4c6ba',0.22);
 }

 /* ---- Ochre Reach: agave, sage, ocotillo and silvered deadwood ------------------------------- */
 /* Desert plants do not scatter evenly either — they crowd the washes, where what rain there is
    runs, and thin to nothing on the pans between. The wash here is a wandering line of noise. */
 const dryOK=(x,z)=>okGround(x,z)&&!inKeep(x,z)&&!onWater(x,z,7);
 /* Colonies, and then singles between them. A sprinkle at one plant to a hundred square metres is
    what the first pass gave, and from a rise it read as litter on a beach; desert scrub grows in
    stands where the ground holds water and leaves the pans between them genuinely bare, which is a
    far stronger picture and costs the same number of instances. */
 function desert(C,cols,agN,sageN,ocoN,snagN,sageCol){
  for(let k=0,made=0;k<cols*30&&made<cols;k++){
   const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.5)*(C.r*0.92), cx=C.x+Math.cos(a)*r, cz=C.z+Math.sin(a)*r;
   if(!dryOK(cx,cz))continue;
   const wash=vn(cx*0.026+61,cz*0.026+13);
   if(rnd()>0.1+wash*wash*1.7)continue;                   // colonies crowd the washes
   made++;
   const R=rr(5,17), n=Math.round(R*rr(1.3,2.6));
   for(let i=0;i<n;i++){
    const a2=rnd()*Math.PI*2, r2=R*Math.pow(rnd(),0.62), x=cx+Math.cos(a2)*r2, z=cz+Math.sin(a2)*r2;
    if(!dryOK(x,z))continue;
    if(rnd()<0.16){ if(!taken(x,z,0.9))put('succ',x,z,rr(0.5,1.1),rr(1.2,1.7),pick(['#cfe2d0','#e2efdc','#bcd6c6','#dfe8cc']),0.05,0.02); }
    else if(!taken(x,z,0.35))put('sage',x,z,rr(0.6,2.0),rr(1.1,1.7),sageCol,0.24);
   }
   if(rnd()<0.5&&!taken(cx,cz,2.0))snag(cx+rr(-R,R),cz+rr(-R,R),rr(2.4,5.2),'#f2ecdc');
  }
  for(let i=0,made=0;i<agN*40&&made<agN;i++){             // and the odd plant out on the open pan
   const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.5)*(C.r*0.94), x=C.x+Math.cos(a)*r, z=C.z+Math.sin(a)*r;
   if(!dryOK(x,z)||taken(x,z,1.0))continue; made++;
   put('succ',x,z,rr(0.5,1.1),rr(1.2,1.7),pick(['#cfe2d0','#e2efdc','#bcd6c6','#dfe8cc']),0.05,0.02);
  }
  for(let i=0,made=0;i<sageN*30&&made<sageN;i++){
   const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.5)*C.r, x=C.x+Math.cos(a)*r, z=C.z+Math.sin(a)*r;
   if(!dryOK(x,z)||taken(x,z,0.4))continue;
   if(rnd()>0.3+vn(x*0.028+61,z*0.028+13)*0.7)continue; made++;
   put('sage',x,z,rr(0.6,1.9),rr(1.1,1.7),sageCol,0.24);
  }
  for(let i=0,made=0;i<ocoN*40&&made<ocoN;i++){           // the same rosette stretched into a whip
   const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.55)*(C.r*0.9), x=C.x+Math.cos(a)*r, z=C.z+Math.sin(a)*r;
   if(!dryOK(x,z)||taken(x,z,1.4))continue; made++;
   put('succ',x,z,rr(3.2,5.6),rr(0.42,0.62),pick(['#b6c48e','#c8d29c','#a3b47c']),0.03,0.01);
  }
  for(let i=0,made=0;i<snagN*30&&made<snagN;i++){
   const a=rnd()*Math.PI*2, r=Math.pow(rnd(),0.6)*(C.r*0.92), x=C.x+Math.cos(a)*r, z=C.z+Math.sin(a)*r;
   if(!dryOK(x,z)||taken(x,z,2.0))continue; made++;
   snag(x,z,rr(2.4,5.2),'#f2ecdc');
  }
 }
 desert(BADLAND,40,180,1600,230,110,'#e3dcc0');
 desert(DESERT,28,110,950,150,70,'#e8dcbc');


 /* ---- 6b. copses: the meadow stops being a park ---------------------------------------------
    A copse is a knot of trees with its density falling off from the middle, a scrubby collar that
    reaches half again past the last trunk, and bracken on whichever side the ground falls away.
    That collar is the part that matters: a wood without a margin looks like trees on a lawn. */
 for(let attempt=0,made=0;attempt<2600&&made<54;attempt++){
  const a=rnd()*Math.PI*2, r=52+Math.pow(rnd(),0.62)*370;
  const cx=Math.cos(a)*r, cz=Math.sin(a)*r;
  const B=biomeAt(cx,cz);
  if(B==='desert'||B==='badland'||B==='tundra'||B==='snow')continue;   // those quarters are planted their own way
  if(inFarm(cx,cz)||!okDry(cx,cz,7)||slopeAt(cx,cz)>0.62)continue;
  if(COPSE.some(c=>hyp(cx,cz,c[0],c[1])<c[2]+34))continue;             // copses are separate things, not one wood
  const R=rr(8,22);
  if(keepClear(cx,cz,R+22))continue;                                  // a wood may not close over a landmark
  COPSE.push([cx,cz,R]); made++;
  const autumn=B==='amber', wet=B==='marsh';
  const n=Math.round(5+R*1.05);
  for(let i=0;i<n;i++){
   const p=site(cx,cz,R*Math.pow(rnd(),0.62),2.6,okDry); if(!p)continue;
   const kind=wet?(rnd()<0.42?'willow':'oak'):autumn?(rnd()<0.22?'birch':'oak'):
    rnd()<0.12?'pine':rnd()<0.22?'birch':rnd()<0.26?'blossom':'oak';
   const h=rr(5.2,9.4)*(kind==='pine'?1.18:1);
   tree(kind,p[0],p[1],h,rr(0.85,1.18),autumn&&kind!=='pine'?pick(AUT):null,kind==='birch'?'#fbf8f0':null);
  }
  const collar=Math.round(n*3.4);
  for(let i=0;i<collar;i++){
   const a2=rnd()*Math.PI*2, r2=R*rr(0.5,1.55);
   const x=cx+Math.cos(a2)*r2, z=cz+Math.sin(a2)*r2;
   if(!okSoft(x,z))continue;
   put('scrub',x,z,rr(0.8,1.9),rr(0.9,1.4),autumn?pick(AUT):UNDER[biomeAt(x,z)]||UNDER.meadow,0.14);
  }
  for(let i=0;i<Math.round(n*1.3);i++){
   const a2=rnd()*Math.PI*2, r2=R*rr(0.3,1.25);
   const x=cx+Math.cos(a2)*r2, z=cz+Math.sin(a2)*r2;
   if(!okSoft(x,z))continue;
   put('brack',x,z,rr(0.45,1.0),rr(1.0,1.5),autumn?'#d59a4a':'#b9cf94',0.2);
  }
 }
 F.copses=COPSE.length; F.copseList=COPSE;

 /* ---- 6c. hedgerows: the meadow gets field boundaries ----------------------------------------
    A line that wanders, thickens and thins, breaks where a road or the river crosses it, and keeps
    one standard tree every dozen metres or so — a hedge that was laid round a field a century ago
    and has had trees grow out of it since. None of it takes a collider: a hedge you cannot ride
    through would cut the basin into compartments and would sit across the race routes. */
 let hedgeN=0;
 for(let hgi=0;hgi<19;hgi++){
  let hx,hz,ok=false;
  for(let k=0;k<200&&!ok;k++){const a=rnd()*Math.PI*2,r=60+rnd()*350;hx=Math.cos(a)*r;hz=Math.sin(a)*r;
   const B=biomeAt(hx,hz); ok=(B==='meadow'||B==='amber')&&!inFarm(hx,hz)&&okDry(hx,hz,4);}
  if(!ok)continue;
  let hd=rnd()*Math.PI*2, sinceTree=rr(0,12);
  const len=rr(70,190);
  for(let d=0;d<len;d+=1.15){
   hd+=(rnd()-0.5)*0.05;
   hx+=Math.sin(hd)*1.15; hz+=Math.cos(hd)*1.15;
   const B=biomeAt(hx,hz);
   if(B==='desert'||B==='snow'||B==='tundra'||B==='badland')break;
   const thick=0.62+0.38*vn(hx*0.05,hz*0.05);             // the hedge is not the same all the way along
   for(let k=0;k<(rnd()<thick?2:1);k++){
    const jx=hx+Math.cos(hd)*rr(-1.05,1.05), jz=hz-Math.sin(hd)*rr(-1.05,1.05);
    if(!okSoft(jx,jz))continue;
    put('scrub',jx,jz,rr(1.0,1.9)*thick+0.35,rr(0.85,1.35),B==='amber'?pick(AUT):UNDER.meadow,0.1);
    hedgeN++;
   }
   sinceTree+=1.15;
   if(sinceTree>rr(11,20)&&okDry(hx,hz,2.4)&&!inFarm(hx,hz)){
    sinceTree=0;
    tree(rnd()<0.28?'birch':'oak',hx,hz,rr(6.5,10.5),rr(0.9,1.2),B==='amber'?pick(AUT):null);
   }
  }
 }
 F.hedge=hedgeN;

 /* ---- 6d. the lone tree in a field ----------------------------------------------------------
    Nothing within twenty-five metres, a big crown, and a skirt of scrub at the foot where the mower
    never reached. One of the most recognisable shapes in open country and the basin had none. */
 for(let i=0,made=0;i<900&&made<38;i++){
  const a=rnd()*Math.PI*2, r=55+rnd()*350, x=Math.cos(a)*r, z=Math.sin(a)*r;
  const B=biomeAt(x,z);
  if(B!=='meadow'&&B!=='amber')continue;
  if(inFarm(x,z)||!okDry(x,z,4)||woodAt(x,z,25)>0||slopeAt(x,z)>0.5)continue;
  made++;
  tree(rnd()<0.55?'blossom':'oak',x,z,rr(9,13),rr(1.15,1.45),B==='amber'?pick(AUT):null);
  for(let k=0;k<14;k++){const a2=rnd()*Math.PI*2,r2=rr(1.8,5.4),px=x+Math.cos(a2)*r2,pz=z+Math.sin(a2)*r2;
   if(okSoft(px,pz))put('scrub',px,pz,rr(0.6,1.5),rr(1.0,1.5),B==='amber'?pick(AUT):UNDER.meadow,0.16);}
  for(let k=0;k<10;k++){const a2=rnd()*Math.PI*2,r2=rr(2.5,8),px=x+Math.cos(a2)*r2,pz=z+Math.sin(a2)*r2;
   if(okSoft(px,pz))put('tuft',px,pz,rr(0.7,1.3),rr(0.9,1.3),'#e2eec6',0.12);}
 }

 /* ---- 6e. undergrowth at the woodland margins ------------------------------------------------
    This one never names a tree. It samples the basin, asks how many slim trunks are within a dozen
    metres, and plants in proportion — which puts brush under the five hundred and sixty trees that
    were already there, thickest where they bunch, and nothing out in the open. */
 for(let i=0;i<12000;i++){
  const a=rnd()*Math.PI*2, r=34+Math.pow(rnd(),0.55)*400, x=Math.cos(a)*r, z=Math.sin(a)*r;
  const B=biomeAt(x,z);
  if(B==='desert'||B==='badland')continue;
  if(!okSoft(x,z)||inFarm(x,z))continue;
  const w=woodAt(x,z,13); if(!w)continue;
  if(rnd()>Math.min(0.72,0.17*w))continue;
  const cold=B==='snow'||B==='tundra';
  if(cold)put('juni',x,z,rr(0.55,1.5),rr(1.0,1.5),'#c3d3c6',0.18);
  else if(rnd()<0.34)put('brack',x,z,rr(0.4,1.05),rr(1.0,1.6),B==='amber'?'#d08c3e':'#adc78c',0.22);
  else put('scrub',x,z,rr(0.6,1.8),rr(0.9,1.45),B==='amber'?pick(AUT):UNDER[B]||UNDER.meadow,0.15);
 }

 /* ---- 6f. reedbeds --------------------------------------------------------------------------
    Beds, not a fringe: a stretch of bank thick with rush, then thirty metres of open shingle, then
    another bed. Both banks of the river, both sides of Sparrow Creek, all the way round the lake,
    and the oasis out in the canyon. */
 function bedAt(x,z,R,dens,col,sedge){
  for(let k=0;k<dens;k++){
   const a=rnd()*Math.PI*2, r=R*Math.sqrt(rnd()), px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r;
   if(!okGround(px,pz)||taken(px,pz,0.3))continue;
   if(Math.abs(pz-riverZ(px))<4.4)continue;               // standing in the channel, not on the bank
   put('reed',px,pz,rr(1.0,2.0),rr(0.8,1.25),col||'#dfeec0',0.10,0.08);
   if(sedge&&rnd()<0.42)put('tuft',px,pz+rr(-1,1),rr(0.8,1.5),rr(1.0,1.4),'#cfe0a8',0.14);
  }
 }
 for(let x=-430;x<430;x+=rr(22,46)){                      // the river, bed by bed, alternating banks
  const z0=riverZ(x);
  for(const side of[-1,1]){
   if(rnd()<0.34)continue;
   const bz=z0+side*rr(6.6,9.2);
   if(!okGround(x,bz)||inKeep(x,bz))continue;
   bedAt(x,bz,rr(5,11),Math.round(rr(14,34)),null,true);
  }
 }
 for(let z=-290;z<156;z+=rr(20,42)){                      // Sparrow Creek
  const x0=streamX(z);
  for(const side of[-1,1]){
   if(rnd()<0.4)continue;
   const bx=x0+side*rr(4.6,7.4);
   if(!okGround(bx,z)||inKeep(bx,z))continue;
   bedAt(bx,z,rr(3.5,7),Math.round(rr(8,20)),null,true);
  }
 }
 for(let k=0;k<12;k++){const a=k/12*Math.PI*2+0.2;bedAt(20+Math.cos(a)*8.4,16+Math.sin(a)*8.4,3.2,12,null,true);}
 for(let k=0;k<7;k++){const a=k/7*Math.PI*2;bedAt(-200+Math.cos(a)*9.6,158+Math.sin(a)*9.6,2.6,9,'#cfd99a',false);}

 /* ---- 6g. bracken on the slopes -------------------------------------------------------------
    Bracken takes a hillside and stops where the ground flattens, which is a free way to make the
    terrain's own shape legible from a distance: the green changes where the gradient does. */
 for(let i=0;i<13000;i++){
  const a=rnd()*Math.PI*2, r=40+Math.pow(rnd(),0.6)*400, x=Math.cos(a)*r, z=Math.sin(a)*r;
  const B=biomeAt(x,z); if(B==='desert'||B==='badland')continue;
  if(!okSoft(x,z)||inFarm(x,z))continue;
  const sl=slopeAt(x,z); if(sl<0.30||sl>1.25)continue;
  if(vn(x*0.022+11,z*0.022+5)<0.42)continue;              // and it comes in stands even so
  if(rnd()>0.42)continue;
  put('brack',x,z,rr(0.5,1.15),rr(1.0,1.6),B==='amber'?'#cf8f42':B==='snow'||B==='tundra'?'#b7c4b2':'#a8c284',0.24);
 }

 /* ---- 6h. wildflower meadows ----------------------------------------------------------------
    Drifts, each mostly one colour, because a real meadow is one species winning a patch rather than
    a spilt paintbox. Seen from the ridge they are what turns a flat green plain into a field. */
 const DRIFT=['#ffffff','#ffe9a3','#f6b9d3','#cbb4f2','#ffd08a','#e8f0b0','#f7a9a0'];
 for(let d=0,made=0;d<600&&made<13;d++){
  const a=rnd()*Math.PI*2, r=48+rnd()*340, cx=Math.cos(a)*r, cz=Math.sin(a)*r;
  const B=biomeAt(cx,cz);
  if(B==='desert'||B==='badland'||B==='snow'||B==='tundra')continue;
  if(!okSoft(cx,cz)||woodAt(cx,cz,16)>1||inFarm(cx,cz))continue;
  made++;
  const R=rr(15,30), c1=pick(DRIFT), c2=rnd()<0.6?c1:pick(DRIFT);
  const n=Math.round(R*R*0.62);
  for(let i=0;i<n;i++){
   const a2=rnd()*Math.PI*2, r2=R*Math.pow(rnd(),0.62), x=cx+Math.cos(a2)*r2, z=cz+Math.sin(a2)*r2;
   if(!okSoft(x,z))continue;
   put('petal',x,z,rr(0.28,0.55),rr(0.9,1.3),rnd()<0.72?c1:c2,0.1);
  }
  for(let i=0;i<Math.round(n*0.3);i++){
   const a2=rnd()*Math.PI*2, r2=R*rr(0.2,1.15), x=cx+Math.cos(a2)*r2, z=cz+Math.sin(a2)*r2;
   if(okSoft(x,z))put('tuft',x,z,rr(0.6,1.2),rr(1.0,1.4),'#dcecbe',0.14);
  }
 }

 /* ---- 6i. the middle distance ---------------------------------------------------------------
    The near-field grass travels with the rider and dies out at fifty-four metres; the far blades are
    one per thirty square metres and half a metre tall, which at eighty metres is nothing at all. In
    between the ground was a painted plane. Tussocks fix that: metre-high, clumped by a slow noise so
    there are lush hollows and bare ridges, and dense enough to change the colour of a hillside. */
 for(let i=0;i<30000;i++){
  const a=rnd()*Math.PI*2, r=26+Math.pow(rnd(),0.52)*418, x=Math.cos(a)*r, z=Math.sin(a)*r;
  const B=biomeAt(x,z);
  if(B==='desert'||B==='badland'||B==='snow')continue;
  if(!okSoft(x,z))continue;
  const lush=vn(x*0.016+3,z*0.016+19);
  if(rnd()>lush*lush*1.25)continue;
  const col=B==='amber'?'#e2c48a':B==='marsh'?'#cfe3a6':B==='tundra'?'#c3cfb2':'#dcecbe';
  put('tuft',x,z,rr(0.6,1.35)*(0.75+lush*0.6),rr(0.9,1.35),col,0.16);
 }

 /* ================= 7. hand the banks to the renderer ================= */
 let total=0;
 for(const k in BANK){const b=BANK[k];
  b.im.count=b.n; total+=b.n;
  b.im.instanceMatrix.needsUpdate=true;
  if(b.im.instanceColor)b.im.instanceColor.needsUpdate=true;
  b.im.computeBoundingSphere&&b.im.computeBoundingSphere();
 }
 F.total=total;
 F.counts=Object.keys(BANK).reduce((o,k)=>(o[k]=BANK[k].n,o),{});
 console.log('world-flora: planted',total,'in',Object.keys(BANK).length,'draws',JSON.stringify(F.counts));

 /* ================= 8. wind, and the quality tier ================= */
 /* One float a frame. The tier check is a getter call; when the frame-time watchdog steps the game
    down it takes the same share off every bank, which is the cheapest thing this package can do
    for a machine that is struggling. */
 let qual=G.gfx&&G.gfx.get?G.gfx.get():'high';
 const applyTier=q=>{const k=q==='low'?0.42:q==='medium'?0.82:1;
  for(const name in BANK){const b=BANK[name];b.im.count=Math.round(b.n*k);}};
 applyTier(qual);
 G.on('tick',(dt,t)=>{
  uT.value=t; uCam.value.copy(G.camera.position);
  if(G.gfx&&G.gfx.get){const q=G.gfx.get();if(q!==qual){qual=q;applyTier(q);}}
 });
 /* Everything this package knows, for the headless checks. */
 G.on('state',o=>{o.flora={planted:total,copses:F.copses,counts:F.counts};});
}
