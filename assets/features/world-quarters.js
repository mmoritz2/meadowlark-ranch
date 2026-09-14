/* Feature package 'world-quarters' — four empty circles of map given somewhere to go.
   Amberwood, Willowmere, Frostpine and Ochre Reach opened yesterday and received a biome colour
   and a scatter of trees and nothing else: each is a hundred and thirty metres of open country
   with a fast-travel stop in the middle of it and not one building, person or landmark inside
   the whole circle. You arrive, you turn round, you leave. This package puts a settlement in
   every one of them — Amberwood Mill, Willowmere, Frostpine Station and Ochre Reach — each with
   buildings whose doors open onto something, people with an opinion about the place they live
   in, something tall enough to steer by from the far side of the basin, and water for the horse
   when you get there. Cottonwood and Barleyfold are the bar; these are meant to stand beside
   them and read as the same valley worked by a different trade.

   Owned by this package: this file and nothing else. Nothing runs at import time —
   mergeGeometries is a pure geometry utility off the page's own import map and touches no game
   state at all.

   On performance, because a settlement is where it goes wrong. Cottonwood's four buildings are
   a hundred-odd little meshes and every one of them is a draw call, twice over once the shadow
   pass is counted. So each site here is assembled into a throwaway group and then BAKED:
   geometries merged per material, the group dropped, a dozen meshes left behind — the same
   trick ranch3d.html plays on its trees at :3174, for the same reason. Anything that repeats is
   an InstancedMesh instead: logs, reeds, leaf litter, saplings, drifts, rubble, lamps. What is
   left moving in the whole package is seven objects — four smoke columns, a mill wheel, a
   windmill fan and a bell — and not one of them allocates so much as a vector during a frame.
   The four sites sit six hundred metres apart, so the frustum only ever holds one of them. */
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const id='world-quarters';
export function install(G){
 const {THREE,scene,toast}=G;
 const W=G.world,H=G.horse,S=G.save,UI=G.ui;
 const player=H.player,groundH=W.groundH;
 const P={sites:{},draws:0,mergedFrom:0,inst:0,instItems:0,buildings:0,npcs:0,things:0,colliders:0,anim:[],objs:[]};
 G.quartersPkg=P;
 /* Every object this package puts in the scene, kept in one list. It is what lets a QA run
    measure what the four settlements cost by switching them off and on again inside one
    browser session — the only way to get a draw-call delta that is not swamped by the
    world's own Math.random scatter falling differently on each boot. */
 const own=o=>{if(o)P.objs.push(o);return o;};
 const hyp=(ax,az,bx2,bz)=>Math.hypot(ax-bx2,az-bz);
 /* One seeded stream for the whole package. Math.random would scatter a different village for
    every player and, more to the point while this was being built, a different one every time
    I went back to photograph the same corner of it. */
 let _rs=0x5eed1a7e; const rnd=()=>{_rs=(Math.imul(_rs,1664525)+1013904223)>>>0;return _rs/4294967296;};
 const rr=(a,b)=>a+rnd()*(b-a);

 /* ================= 1. the kit: materials, unit geometry, primitives ================= */
 /* Materials are cached by colour, because a second material is a second merged mesh and
    therefore a second draw call. Each settlement keeps to about a dozen colours and gets about
    a dozen meshes out the other end. */
 const MAT={};
 function mt(c,o){const k=c+(o?JSON.stringify(o):'');if(!MAT[k]){const m=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.92},o||{}));m.envMapIntensity=0.6;MAT[k]=m;}return MAT[k];}
 /* Unit primitives built once and scaled per mesh. ranch3d.html's box() allocates a fresh
    BoxGeometry on every call, which is right for a dozen fence posts and wrong for nine hundred
    leaves — and the bake throws the meshes away regardless, so there is nothing to be gained by
    giving each one its own. */
 /* mergeGeometries refuses a batch that mixes indexed and non-indexed geometry, so the bake
    skips anything without an index — and three builds IcosahedronGeometry, alone among the
    primitives here, without one. Every organic lump in four settlements was therefore being
    built, dropped at the merge and never seen: Amberwood's maples came out as bare poles, the
    mesas lost their buttresses and their talus, the herons lost their bodies. A trivial index —
    every vertex once, in order — is all it takes to let them through. */
 function indexed(g){
  if(!g.index){const n=g.attributes.position.count,a=n>65535?new Uint32Array(n):new Uint16Array(n);
   for(let i=0;i<n;i++)a[i]=i;g.setIndex(new THREE.BufferAttribute(a,1));}
  return g;
 }
 const G_BOX=indexed(new THREE.BoxGeometry(1,1,1));
 const G_CYL=indexed(new THREE.CylinderGeometry(1,1,1,9));
 const G_TAP=indexed(new THREE.CylinderGeometry(0.55,1,1,8));
 const G_CONE=indexed(new THREE.ConeGeometry(1,1,8));
 const G_LUMP=indexed(new THREE.IcosahedronGeometry(1,1));   // 80 triangles against the shared sphere's 476
 const G_DISC=indexed(new THREE.CircleGeometry(1,28));
 const G_PLANE=indexed(new THREE.PlaneGeometry(1,1));
 const G_SKIRT=indexed(new THREE.CylinderGeometry(1,1.26,1,28,1,true));
 const G_FLARE=indexed(new THREE.CylinderGeometry(0.78,1,1,20,1,true));         // a talus slope, worn out from the foot of a cliff
 const G_LOG=indexed(new THREE.CylinderGeometry(1,1,1,9).rotateZ(Math.PI/2));   // lies along X, so scale reads (length,r,r)
 const G_FLAKE=indexed(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2));       // a leaf, a sled groove, anything lying on the ground
 const G_BLADE=indexed(new THREE.PlaneGeometry(1,1).translate(0,0.5,0));
 /* Two quads crossed at a right angle. Anything soft and volumetric — reeds, smoke, mist — is
    built out of this rather than out of a billboard, because a billboard has to be re-aimed at
    the camera every frame and the one frame it is guaranteed to get wrong is the one somebody
    photographs from a camera the game did not put there. Crossed quads look the same from
    everywhere and cost one extra triangle pair. */
 const G_CROSS=mergeGeometries([G_PLANE.clone(),G_PLANE.clone().rotateY(Math.PI/2)],false);
 const G_TUFT=mergeGeometries([G_BLADE.clone(),G_BLADE.clone().rotateY(Math.PI/2)],false);
 const WHITE=mt('#ffffff',{roughness:1});               // the base for anything coloured per instance
 function put(geo,c,sx,sy,sz,x,y,z,g,o){const m=new THREE.Mesh(geo,mt(c,o));m.scale.set(sx,sy,sz);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 const bx=(g,c,x,y,z,w,h,d)=>put(G_BOX,c,w,h,d,x,y,z,g);
 const cy=(g,c,x,y,z,r,h)=>put(G_CYL,c,r,h,r,x,y,z,g);
 const tp=(g,c,x,y,z,r,h)=>put(G_TAP,c,r,h,r,x,y,z,g);
 const cn=(g,c,x,y,z,r,h)=>put(G_CONE,c,r,h,r,x,y,z,g);
 const lp=(g,c,x,y,z,sx,sy,sz)=>put(G_LUMP,c,sx,sy,sz,x,y,z,g);
 /* A stick between two points. Written as a look-at rather than as trigonometry, because I get
    the trigonometry wrong on the diagonals and a brace that misses its post is the first thing
    anyone sees. */
 const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_d=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
 function beam(g,c,ax,ay,az,b2x,b2y,b2z,th){
  const m=new THREE.Mesh(G_CYL,mt(c));
  _a.set(ax,ay,az);_b.set(b2x,b2y,b2z);_d.subVectors(_b,_a);
  m.position.copy(_a).addScaledVector(_d,0.5);
  m.scale.set(th,_d.length(),th);
  m.quaternion.setFromUnitVectors(_up,_d.normalize());
  m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
 }
 /* A pitched roof: two slabs leaning on a ridge. Every roof in this package is this one at a
    different width, which is most of what lets four settlements built by four trades still read
    as one valley. */
 function roof(g,c,w,d,rise,y,over){
  over=over==null?0.3:over;const half=d/2+over,slope=Math.hypot(half,rise),th=Math.atan2(rise,half);
  for(const s of [-1,1]){const m=bx(g,c,0,y+rise/2,s*half/2,w+over*2,0.13,slope);m.rotation.x=s*th;}
  bx(g,c,0,y+rise+0.05,0,w+over*2+0.12,0.13,0.24);
 }
 /* Four walls with a doorway punched in the +z face — the shape of every shack, shed, hut and
    cabin below. The opening is made of wall segments rather than of a hole, because a merged
    mesh has no CSG and a doorway built from three boxes costs nothing. */
 function shack(g,c,w,d,h,dw,dh,y0){
  y0=y0||0;const t=0.12,side=(w-dw)/2;
  bx(g,c,0,y0+h/2,-d/2,w,h,t); bx(g,c,-w/2,y0+h/2,0,t,h,d); bx(g,c,w/2,y0+h/2,0,t,h,d);
  bx(g,c,-(dw+side)/2,y0+h/2,d/2,side,h,t); bx(g,c,(dw+side)/2,y0+h/2,d/2,side,h,t);
  if(dh<h)bx(g,c,0,y0+(dh+h)/2,d/2,dw,h-dh,t);
  bx(g,'#2a2420',0,y0+dh/2,d/2-0.06,dw,dh,0.05);                    // the dark of an open doorway
 }
 /* Everything is modelled at the origin facing +z and then set down, so no builder ever has to
    think in world coordinates or in yaw. */
 function place(parent,g,x,z,yaw,dy){g.position.set(x,groundH(x,z)+(dy||0),z);g.rotation.y=yaw||0;parent.add(g);return g;}
 /* Where a point local to a placed group ends up in the world — needed for the few things that
    must be positioned against a group's insides, like a mill wheel on a mill's gable. */
 const world=(x,z,yaw,px,pz)=>[x+px*Math.cos(yaw)+pz*Math.sin(yaw),z-px*Math.sin(yaw)+pz*Math.cos(yaw)];

 /* ================= 2. baking and instancing ================= */
 /* Groups go in, one mesh per material comes out, the originals are dropped. Shadow casting is
    carried per material exactly as mergeStatics does it, so a settlement's water and its walls
    end up in different meshes and only the walls cast. Nothing baked can ever move again, which
    is why everything that turns, swings or drifts is built outside the bake. */
 function bake(g,shadow){
  g.updateMatrixWorld(true);
  const byMat=new Map();let n=0;
  g.traverse(o=>{
   if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;
   const geo=o.geometry;if(!geo.index||!geo.attributes.normal||!geo.attributes.uv)return;
   const c=geo.clone().applyMatrix4(o.matrixWorld);
   for(const k of Object.keys(c.attributes))if(k!=='position'&&k!=='normal'&&k!=='uv')c.deleteAttribute(k);
   const e=byMat.get(o.material)||{list:[],cast:false};
   e.list.push(c);e.cast=e.cast||o.castShadow;byMat.set(o.material,e);n++;
  });
  const out=[];
  for(const [m,e] of byMat){
   const merged=mergeGeometries(e.list,false);e.list.forEach(c=>c.dispose());if(!merged)continue;
   const mesh=own(new THREE.Mesh(merged,m));mesh.name='quarter_baked';
   mesh.castShadow=shadow!==false&&e.cast;mesh.receiveShadow=true;
   scene.add(mesh);out.push(mesh);
  }
  if(g.parent)g.parent.remove(g);
  P.mergedFrom+=n;P.draws+=out.length;
  return out;
 }
 /* Anything that repeats. Colour variety comes off instanceColor rather than out of a second
    material, and the bounding sphere is computed from the instances so a settlement's litter
    culls with the settlement instead of being submitted from across the valley. */
 const _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_sc=new THREE.Vector3(),_col=new THREE.Color();
 /* Ground litter — leaves, cobbles, sled grooves, reed clumps, rubble — is sub-pixel long before
    it is out of the frustum, and the frustum is no help at all when you are standing at the
    ranch looking down the valley at Amberwood four hundred metres away. Anything registered here
    is switched off past its own radius by one throttled loop that does nothing but compare
    squared distances. */
 const FADE=[];
 const fade=(o,x,z,r)=>{if(o)FADE.push({o,x,z,r2:r*r});};
 function scatter(geo,material,items,shadow,fadeAt){
  if(!items.length)return null;
  const im=new THREE.InstancedMesh(geo,material,items.length);
  im.castShadow=!!shadow;im.receiveShadow=true;
  for(let i=0;i<items.length;i++){
   const it=items[i];
   _e.set(it.rx||0,it.ry||0,it.rz||0);_q.setFromEuler(_e);
   _v.set(it.x,it.y,it.z);
   _sc.set(it.sx==null?(it.s==null?1:it.s):it.sx,it.sy==null?(it.s==null?1:it.s):it.sy,it.sz==null?(it.s==null?1:it.s):it.sz);
   im.setMatrixAt(i,_m4.compose(_v,_q,_sc));
   if(it.c){_col.set(it.c);im.setColorAt(i,_col);}
  }
  im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;
  try{im.computeBoundingSphere();}catch(e){}
  im.name='quarter_inst';scene.add(own(im));P.inst++;P.draws++;P.instItems+=items.length;
  if(fadeAt&&im.boundingSphere)fade(im,im.boundingSphere.center.x,im.boundingSphere.center.z,fadeAt+im.boundingSphere.radius);
  return im;
 }
 let fadeT=0;
 function tickFade(dt){
  fadeT+=dt;if(fadeT<0.4)return;fadeT=0;
  const px=player.pos.x,pz=player.pos.z;
  for(const f of FADE){const dx=px-f.x,dz=pz-f.z;f.o.visible=dx*dx+dz*dz<f.r2;}
 }

 /* ================= 3. siting: flat ground, clear of what is already out there ============= */
 /* A building's stone foundation is 24 cm tall, so a pad whose corners differ by more than a
    third of a metre shows daylight under one of them or buries another. The terrain also
    planted several hundred trees out here before we arrived and gave each one a collider; a
    wall through a trunk is the kind of thing nobody notices until the screenshot. */
 const SPREAD=[[0,0],[-1,-1],[1,-1],[-1,1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
 function spread(x,z,h){let lo=1e9,hi=-1e9;for(const o of SPREAD){const y=groundH(x+o[0]*h,z+o[1]*h);if(y<lo)lo=y;if(y>hi)hi=y;}return hi-lo;}
 function clearAt(x,z,need){
  if(Math.hypot(x,z)>446-need)return false;              // WORLD_R is 455, and a wall on the fence is a wall you cannot ride round
  if(Math.abs(z-W.riverZ(x))<need+8)return false;
  for(const c of W.colliders)if(hyp(x,z,c.x,c.z)<c.r+need)return false;
  return true;
 }
 /* The asked-for spot if it will do, else the nearest ring position that will, and on a second
    sweep the same rings with the flatness test relaxed — a village on a slight slope is a
    village, a building dropped into a tree is a bug. Offsetting the ring angle by the radius
    stops the search always resolving due east and lining four buildings up like teeth. */
 function pad(x,z,need,flat){
  flat=flat||0.34;
  for(const f of [flat,flat*2.2]){
   if(clearAt(x,z,need)&&spread(x,z,need*0.8)<=f)return [x,z];
   for(let r=3;r<=36;r+=3)for(let k=0;k<12;k++){
    const a=k/12*Math.PI*2+r*0.41,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;
    if(clearAt(px,pz,need)&&spread(px,pz,need*0.8)<=f)return [px,pz];
   }
  }
  return [x,z];
 }
 /* People stand where they were put unless somebody has already built there. */
 function clearSpot(x,z){
  if(clearAt(x,z,1.1))return [x,z];
  for(let r=2;r<=14;r+=2)for(let k=0;k<10;k++){const a=k/10*Math.PI*2+r,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(clearAt(px,pz,1.1))return [px,pz];}
  return [x,z];
 }
 function collide(x,z,r){W.colliders.push({x,z,r});P.colliders++;}
 /* A rail fence goes in walls[] rather than colliders[], because walls[] is the list a horse is
    allowed to jump and a corral rail is exactly that. */
 function fence(pts){for(let i=1;i<pts.length;i++)W.walls.push({x1:pts[i-1][0],z1:pts[i-1][1],x2:pts[i][0],z2:pts[i][1]});}

 /* ================= 4. water, in a valley whose ground cannot be dug ================= */
 /* The terrain is an analytic height field and nothing in a feature package can cut a hole in
    it, so a pool takes its level from the highest ground inside it and then wears a skirt: a
    bevelled collar from the waterline out and down to meet the ground, which is mud at a mill
    pond, silt at a mere and drifted snow at a tarn. The shallow side then reads as a reedy edge
    and the deep side as water, which is what standing water looks like anyway. */
 function waterLevel(x,z,r){let hi=groundH(x,z);for(let k=0;k<20;k++){const a=k/20*Math.PI*2;for(const f of [0.5,0.8,1]){const y=groundH(x+Math.cos(a)*r*f,z+Math.sin(a)*r*f);if(y>hi)hi=y;}}return hi;}
 const WATER_OPT={roughness:0.14,metalness:0.3,transparent:true,opacity:0.88};
 function pool(g,x,z,r,col,bank){
  const y=waterLevel(x,z,r)+0.06;
  const w=put(G_DISC,col,r,r,1,x,y,z,g,WATER_OPT);
  w.rotation.x=-Math.PI/2;w.castShadow=false;
  const drop=Math.max(0.4,y-groundH(x+r*1.15,z)+0.3);
  const sk=put(G_SKIRT,bank,r,drop,r,x,y-drop/2,z,g);sk.castShadow=false;
  return {x,z,r,y};
 }

 /* ================= 5. things to do when you get there ================= */
 /* A door: stand near a building and press E for the panel it houses. Same shape as world.js's,
    because a player who has learned Cottonwood should not have to learn Amberwood. */
 function door(id,x,z,r,label,open){P.things++;return W.addThing({kind:'door',id:'q:'+id,x,z,g:null,reach:r,label:()=>label+' (E)',use:()=>{try{open();}catch(e){console.error('quarters door '+id,e);}}});}
 /* Water for the horse. All four have one, because the honest answer to "why ride two hundred
    metres out there" has to be something you wanted when you arrive. */
 function trough(id,x,z,reach,label,line){
  P.things++;
  return W.addThing({kind:'qdrink',id:'q:'+id,x,z,g:null,reach,label:()=>label+' (E)',use:()=>{
   let ok=false;S.sync(s=>{const h=s.horses[H.rideIdx()];if(!h)return;h.needs=h.needs||{};h.needs.thirst=Math.min(100,(h.needs.thirst||0)+40);ok=true;});
   if(ok){toast(line.replace('%',H.ridden().name)+' +40 thirst');G.sChime();}
  }});
 }
 function npc(def){try{const at=clearSpot(def.x,def.z);def.x=at[0];def.z=at[1];W.addNPC(def);P.npcs++;}catch(err){console.error('quarters npc '+def.id,err);}}
 /* A building goes through pad() first, so the coordinates it ends up on are the ones every
    label, marker and chimney afterwards has to use — hence the returned pair. */
 function building(o){
  const at=pad(o.x,o.z,o.r+1.6,o.flat||0.34);
  try{own(W.addBuilding({x:at[0],z:at[1],rot:o.rot||0,r:o.r,label:o.label,build:o.build}));P.buildings++;P.colliders++;}
  catch(e){console.error('quarters building '+o.id,e);}
  if(o.open)door(o.id,at[0],at[1],o.r+2.7,o.door||o.label,o.open);
  return at;
 }
 const cottage=v=>()=>W.ranchArchitecture.buildCottage({variant:v||0});
 const barn=()=>W.ranchArchitecture.buildBarn();
 const outbuilding=o=>()=>W.ranchArchitecture.buildOutbuilding(Object.assign({width:4.8,depth:3.4,height:3.3,animatedDoorOpening:{width:1.1,height:1.95}},o||{}));
 function signboard(g,text,w){
  w=w||3.4;
  try{const s=W.arrivalArt.buildSign({text,width:w,height:0.5});s.position.y=2.9;g.add(s);}catch(e){}
  cy(g,'#6b5334',-w/2-0.2,1.45,0,0.09,2.9);cy(g,'#6b5334',w/2+0.2,1.45,0,0.09,2.9);
  bx(g,'#6b5334',0,3.34,0,w+0.7,0.14,0.16);
 }

 /* ================= 6. woodsmoke, the thing that carries furthest ================= */
 /* Smoke is what tells you a place is lived in from four hundred metres away, long before a
    roof resolves out of the treeline. Nine crossed quads on one instanced mesh per chimney,
    rising and swelling and fading on a loop. The matrices are rewritten in place into
    preallocated temporaries — the comment at ranch3d.html:8066 is about what happens when they
    are not. */
 let PUFF=null;
 const SMOKE=[];
 function puffTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const gr=x.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,'rgba(255,255,255,0.95)');gr.addColorStop(0.45,'rgba(244,244,242,0.5)');gr.addColorStop(1,'rgba(238,238,236,0)');
  x.fillStyle=gr;x.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 function smoke(x,y,z,opts){
  opts=opts||{};
  if(!PUFF)PUFF=puffTexture();
  const mat=new THREE.MeshBasicMaterial({map:PUFF,transparent:true,depthWrite:false,side:THREE.DoubleSide,opacity:opts.op||0.46,color:opts.col||'#f2f0ea'});
  const n=10,im=new THREE.InstancedMesh(G_CROSS,mat,n);
  im.frustumCulled=false;im.castShadow=false;im.renderOrder=3;
  im.name='quarter_smoke';im.position.set(x,y,z);scene.add(own(im));
  SMOKE.push({im,n,rise:opts.rise||3.2,h:opts.h||12,drift:opts.drift||1.1,x,z,t:rnd()*10});
  P.draws++;P.anim.push('smoke');
 }
 function tickSmoke(dt){
  for(const s of SMOKE){
   if(hyp(player.pos.x,player.pos.z,s.x,s.z)>320){s.im.visible=false;continue;}
   s.im.visible=true;s.t+=dt;
   for(let i=0;i<s.n;i++){
    const u=((s.t*s.rise/s.h)+i/s.n)%1;
    const sz=(1.4+u*5.2)*Math.sin(u*Math.PI);
    _e.set(0,i*0.7,0);_q.setFromEuler(_e);
    _v.set(Math.sin(u*4.1+i)*s.drift*u*2.4,u*s.h,Math.cos(u*3.3+i*1.7)*s.drift*u*2.4);
    _sc.set(sz*1.3,sz*0.82,sz*1.3);                 // a rising puff spreads wider than it grows tall
    s.im.setMatrixAt(i,_m4.compose(_v,_q,_sc));
   }
   s.im.instanceMatrix.needsUpdate=true;
  }
 }
 /* Reed and sedge blades, on an alpha-cut texture that both the marsh and the mill pond draw
    from. Built once, the first time something asks for it. */
 let REED=null;
 function reedTexture(){
  if(REED)return REED;
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.clearRect(0,0,64,64);
  for(let i=0;i<11;i++){
   const b0=3+i*5.6,w=1.6+(i%3)*0.7,lean=i%2?1:-1;
   x.fillStyle=['#7f9250','#93a55f','#68803f','#a5ad63'][i%4];
   x.beginPath();x.moveTo(b0,64);x.quadraticCurveTo(b0+lean*5,30,b0+lean*9,3+((i*7)%16));
   x.lineTo(b0+lean*9+w,5+((i*7)%16));x.quadraticCurveTo(b0+lean*7,32,b0+w,64);x.closePath();x.fill();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  REED=new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:0.45,side:THREE.DoubleSide,roughness:1});
  return REED;
 }

 /* ================= 7. the local frame each quarter is laid out in ================= */
 /* Every quarter's fast-travel stop sits four hundred and thirty-odd metres out and the ride
    limit is 455, so a village laid out on a compass would put half its buildings against the
    invisible fence. Each site instead gets an axis pointing back at the ranch: a is metres
    inward, b is metres along. Lay out in (a,b) and nothing lands outside the basin by accident,
    and every settlement faces the way you will arrive from. */
 function frame(cx,cz){
  const r=Math.hypot(cx,cz),ux=-cx/r,uz=-cz/r,vx=-uz,vz=ux;
  return {cx,cz,r,ux,uz,vx,vz,yaw:Math.atan2(ux,uz),at:(a,b)=>[cx+ux*a+vx*b,cz+uz*a+vz*b]};
 }

 /* ================= 8. AMBERWOOD MILL — the turning wood, and what is done with it =========
    Timber. A lodge, a water-driven sawmill on the one hollow for two hundred metres, a collier
    burning charcoal at the edge of the clearing, and a fire lookout on legs you can pick out
    from the Barleyfold road. The wood itself is already over — ranch3d.html:4042 turns the
    whole stand here rather than a tree here and there — so the ground work is drifts of leaves
    and the stumps of everything that has already gone through the saw. */
 function buildAmberwood(){
  const F=frame(300,-300),solid=new THREE.Group(),flat=new THREE.Group();
  const T_DARK='#4e3a26',T_MID='#7a5a3a',T_PALE='#a8834e',T_BONE='#c6ab7c',IRON='#3a3d40',STONE='#7d7468',MOSS='#4f5c34',SOOT='#31281f',RUST='#8e4a2a';

  /* The hollow inward of the stop is the only dip out here, which is why the mill is on it and
     not anywhere else. */
  const pnd=F.at(30,-20),pat=pad(pnd[0],pnd[1],12,1.1);
  const POND=pool(solid,pat[0],pat[1],12.5,'#41564a',MOSS);
  /* Logs floated in the pond waiting for the saw, and a boom of chained trunks holding them in. */
  const floats=[];
  for(let i=0;i<9;i++){const a=rr(0,6.28),d=rr(2,8.5);floats.push({x:POND.x+Math.cos(a)*d,y:POND.y-0.05,z:POND.z+Math.sin(a)*d,sx:rr(3.4,6.2),sy:0.26,sz:0.26,ry:rr(0,6.28),c:i%3?'#6b5336':'#7d6340'});}
  for(let i=0;i<11;i++){const a=i/11*2.1-0.4;floats.push({x:POND.x+Math.cos(a)*11.5,y:POND.y-0.02,z:POND.z+Math.sin(a)*11.5,sx:3.6,sy:0.3,sz:0.3,ry:a+Math.PI/2,c:'#5d4830'});}
  scatter(G_LOG,WHITE,floats,false,190);
  /* Sedge round the waterline, which is what turns a disc of water into a pond. */
  const sedge=[];
  for(let i=0;i<220;i++){const a=rr(0,6.28),d=POND.r*rr(0.9,1.4),x=POND.x+Math.cos(a)*d,z=POND.z+Math.sin(a)*d;
   sedge.push({x,y:Math.min(groundH(x,z),POND.y)-0.08,z,sx:rr(0.34,0.58),sy:rr(0.7,1.4),sz:rr(0.34,0.58),ry:rr(0,6.28),c:rnd()<0.4?'#b5a25e':'#ffffff'});}
  scatter(G_TUFT,reedTexture(),sedge,false,170);

  /* The sawmill: stone footings out of the bank, a plank shed, a loading apron, and a launder
     carrying pond water across to the wheel. The wheel is the one thing in Amberwood that
     moves, so it is built outside the bake and hung on the gable afterwards. */
  const mil=pad(F.at(17,-16)[0],F.at(17,-16)[1],6,0.7),mg=new THREE.Group(),MYAW=F.yaw+0.15;
  bx(mg,STONE,0,0.55,0,7.6,1.1,5.6); bx(mg,STONE,0,1.4,-2.6,7.6,0.8,0.5);
  shack(mg,T_PALE,6.8,4.8,3.6,1.6,2.3,1.1); roof(mg,T_DARK,6.8,4.8,1.5,4.7);
  bx(mg,T_MID,0,1.16,3.2,6.8,0.14,1.6);
  for(const s of [-1,1])beam(mg,T_MID,s*3.1,1.2,3.0,s*3.1,4.5,-1.0,0.09);
  bx(mg,T_DARK,-4.3,2.3,0,0.9,0.5,4.4);                              // the launder, running in off the pond
  bx(mg,'#2f4c46',-4.3,2.46,0,0.72,0.06,4.2);                        // and the water standing in it
  for(let i=0;i<4;i++)beam(mg,T_MID,-4.3,0.2,-1.9+i*1.3,-4.3,2.1,-1.9+i*1.3,0.07);
  place(solid,mg,mil[0],mil[1],MYAW);
  collide(mil[0],mil[1],4.7);
  const wh=new THREE.Group();
  for(const s of [-1,1])for(let k=0;k<16;k++){
   const a=k/16*Math.PI*2,a2=(k+1)/16*Math.PI*2;
   beam(wh,T_DARK,Math.cos(a)*2.5,Math.sin(a)*2.5,s*0.62,Math.cos(a2)*2.5,Math.sin(a2)*2.5,s*0.62,0.09);}
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2;
   const m=bx(wh,T_PALE,Math.cos(a)*2.15,Math.sin(a)*2.15,0,0.34,0.95,1.5);m.rotation.z=a;
   beam(wh,T_MID,0,0,0,Math.cos(a)*2.4,Math.sin(a)*2.4,0,0.06);}
  cy(wh,IRON,0,0,0,0.16,1.7).rotation.x=Math.PI/2;
  const wpt=world(mil[0],mil[1],MYAW,-4.3,-2.9);
  wh.position.set(wpt[0],groundH(mil[0],mil[1])+2.5,wpt[1]);wh.rotation.y=MYAW;
  wh.name='quarter_wheel';scene.add(own(wh));P.draws+=3;P.anim.push('mill wheel');
  G.on('tick',dt=>{if(hyp(player.pos.x,player.pos.z,wpt[0],wpt[1])<220)wh.rotation.z-=dt*0.35;});

  /* The three buildings you can walk into. */
  const lodge=building({id:'amber:lodge',x:F.at(9,-13)[0],z:F.at(9,-13)[1],rot:F.yaw+0.5,r:5.4,label:'🛏️ The Amberwood Lodge',build:barn,
   open:()=>UI.openCare(),door:'🛏️ Rest your horse at the lodge'});
  const office=building({id:'amber:office',x:F.at(-2,13)[0],z:F.at(-2,13)[1],rot:F.yaw-0.55,r:2.9,label:'📋 Amberwood mill office',build:outbuilding({width:5.0,depth:3.4,height:3.2}),
   open:()=>UI.openQuests(),door:'📋 Read the mill\'s work board'});
  const cott=building({id:'amber:cottage',x:F.at(17,17)[0],z:F.at(17,17)[1],rot:F.yaw+2.5,r:2.7,label:'🏠 The cutter\'s cottage',build:cottage(1)});

  /* The collier's camp: a turf-clad kiln four days into a burn, a bark lean-to, cordwood
     stacked to season, and the smoke that gives the whole quarter away from a mile off. */
  const kil=pad(F.at(-6,27)[0],F.at(-6,27)[1],5,1.0),kg=new THREE.Group();
  lp(kg,SOOT,0,1.4,0,4.2,2.0,4.2); lp(kg,'#4a3a26',0,1.9,0,3.3,1.9,3.3);
  cy(kg,SOOT,0,3.1,0,0.55,0.9); bx(kg,SOOT,0,0.4,3.9,2.6,0.8,1.1);
  for(let k=0;k<7;k++){const a=k/7*Math.PI*2;cy(kg,'#5a4a34',Math.cos(a)*4.4,0.25,Math.sin(a)*4.4,0.3,0.5);}
  place(solid,kg,kil[0],kil[1],0);
  collide(kil[0],kil[1],3.6);
  const lean=F.at(-9,34),lg=new THREE.Group();
  for(const s of [-1,1]){cy(lg,T_MID,s*1.8,1.15,-1.3,0.1,2.3);cy(lg,T_MID,s*1.8,0.6,1.3,0.1,1.2);}
  bx(lg,'#5b4a30',0,1.55,0,4.0,0.12,3.2).rotation.x=-0.42;
  bx(lg,T_DARK,0,0.35,-1.2,3.4,0.7,0.5); cy(lg,IRON,1.3,0.35,0.9,0.4,0.7);
  place(solid,lg,lean[0],lean[1],F.yaw+1.1);
  smoke(kil[0],groundH(kil[0],kil[1])+3.3,kil[1],{rise:2.2,h:17,drift:1.7,op:0.3,col:'#d6cfc0'});
  smoke(cott[0],groundH(cott[0],cott[1])+4.2,cott[1],{rise:3.0,h:11,drift:0.9});

  /* The fire lookout: twenty-two metres of raking legs and cross-bracing with a cab on top and
     a rust-red roof, because the point of a landmark is that you can pick it out of a treeline
     from the far side of the basin. The stone plinth runs well below the base so the metre of
     slope under it is buried rather than argued with. */
  const twr=pad(F.at(-15,-5)[0],F.at(-15,-5)[1],4,1.4),tg=new THREE.Group();
  const LEG=2.7,TOP=1.35,TH=19;
  /* Four stone piers under the feet rather than one round pad: the pad was three metres across
     and stood half a metre proud, so from anywhere on the clearing the tower appeared to be
     standing on a concrete helipad. Each pier is buried two metres, which is what buys the
     tolerance for the slope. */
  for(const sx of [-1,1])for(const sz of [-1,1])bx(tg,STONE,sx*LEG,-0.85,sz*LEG,1.15,2.4,1.15);
  const legF=y=>LEG+(TOP-LEG)*(y/TH);
  for(const sx of [-1,1])for(const sz of [-1,1])beam(tg,T_MID,sx*LEG,0,sz*LEG,sx*TOP,TH,sz*TOP,0.17);
  for(let k=0;k<5;k++){
   const y0=k*TH/5,y1=(k+1)*TH/5,f0=legF(y0),f1=legF(y1);
   for(const [ax,az,b2x,b2z] of [[-1,-1,1,-1],[1,-1,1,1],[1,1,-1,1],[-1,1,-1,-1]]){
    beam(tg,T_DARK,ax*f0,y0,az*f0,b2x*f1,y1,b2z*f1,0.055);            // one diagonal per face per lift
    if(k)beam(tg,T_DARK,ax*f0,y0,az*f0,b2x*f0,y0,b2z*f0,0.06);        // and a girt round it
   }
  }
  bx(tg,T_PALE,0,TH+0.12,0,4.0,0.22,4.0);
  const cab=new THREE.Group();
  shack(cab,T_BONE,3.2,3.2,2.0,1.0,1.8);roof(cab,RUST,3.2,3.2,0.95,2.0,0.45);
  cab.position.y=TH+0.23;tg.add(cab);
  for(let k=0;k<4;k++){const a=k/4*Math.PI*2+0.78;cy(tg,IRON,Math.cos(a)*1.9,TH+0.8,Math.sin(a)*1.9,0.05,1.1);}
  bx(tg,IRON,0,TH+1.35,0,4.0,0.06,0.06);bx(tg,IRON,0,TH+1.35,0,0.06,0.06,4.0);
  place(solid,tg,twr[0],twr[1],F.yaw+0.3);
  collide(twr[0],twr[1],3.3);

  /* The log deck, the sawpit trestles with the blade leaning where it was left, and the stumps
     of what has already been through. */
  /* The log deck: six courses of small stuff stacked square on bearers, not a heap. Thin logs —
     the first pass had them at nearly a metre through and the deck read as a cairn of boulders. */
  const deck=F.at(12,-3),dy=groundH(deck[0],deck[1]),logs=[],BARK=['#6b5336','#7b6340','#5f4a2e','#83694a'];
  for(let row=0;row<6;row++)for(let i=0;i<7-row;i++){
   const off=(i-(6-row)/2+0.5)*0.64,w2=world(deck[0],deck[1],F.yaw,off,row*0.05);
   logs.push({x:w2[0],y:dy+0.42+row*0.58,z:w2[1],sx:rr(4.4,6.2),sy:0.29,sz:0.29,ry:F.yaw+Math.PI/2+rr(-0.02,0.02),c:BARK[(row+i)%4]});}
  for(const s of [-1,1]){const w2=world(deck[0],deck[1],F.yaw,s*2.3,0.7);logs.push({x:w2[0],y:dy+0.16,z:w2[1],sx:0.3,sy:0.3,sz:4.6,ry:F.yaw,c:'#4e3a26'});}
  const deck2=F.at(-4,21),d2y=groundH(deck2[0],deck2[1]);
  for(let row=0;row<4;row++)for(let i=0;i<5-row;i++)logs.push({x:deck2[0]+(i-(4-row)/2+0.5)*0.56,y:d2y+0.34+row*0.5,z:deck2[1]+row*0.05,sx:rr(2.0,2.7),sy:0.25,sz:0.25,ry:0.2,c:BARK[(row+i)%4]});
  scatter(G_LOG,WHITE,logs,true,260);
  const yard=F.at(6,2),yg=new THREE.Group();
  for(const s of [-1,1]){bx(yg,T_MID,s*1.5,0.5,0,0.24,1.0,0.24);bx(yg,T_MID,s*1.5,0.5,1.4,0.24,1.0,0.24);}
  bx(yg,T_PALE,0,1.05,0.7,3.6,0.16,1.9);
  cy(yg,IRON,0,1.4,0.7,0.62,0.05).rotation.x=Math.PI/2;
  place(solid,yg,yard[0],yard[1],F.yaw+0.8);
  const stumps=[];
  for(let i=0;i<38;i++){const a=rr(0,6.28),d=rr(14,64),x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>448)continue;
   stumps.push({x,y:groundH(x,z)+0.02,z,sx:rr(0.34,0.62),sy:rr(0.4,0.9),sz:rr(0.34,0.62),ry:rr(0,6.28),c:i%2?'#6b5336':'#7a6142'});}
  scatter(G_TAP,WHITE,stumps,true,260);
  const fallen=[];
  for(let i=0;i<24;i++){const a=rr(0,6.28),d=rr(12,50),x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>448)continue;
   fallen.push({x,y:groundH(x,z)+0.2,z,sx:rr(2.4,5.2),sy:0.33,sz:0.33,ry:rr(0,6.28),rz:rr(-0.05,0.05),c:i%3?'#6b5336':'#7d6340'});}
  scatter(G_LOG,WHITE,fallen,true,240);

  /* The turned maples. ranch3d.html tints its instanced canopy toward amber inside this circle,
     but the tint lands on the cheap backdrop foliage and the trees that actually stand in the
     clearing still came out green — which left a quarter called Amberwood with no amber in it.
     Fourteen big broadleaves of my own round the rim of the clearing settle the argument: a
     leaning trunk, four limbs and seven lumps of canopy each, all of it baked flat into the
     settlement's own meshes. */
  const AMBER=['#d2792a','#e0a63a','#b84e26','#c9922f','#a8571f','#e8c352'];
  {const mp=new THREE.Group();
   for(let i=0;i<26;i++){
    /* Out at the rim of the clearing and NOT across the approach. Two earlier passes planted a
       tidy ring of canopies and both times the ring stood squarely between the rider and the
       village it was meant to frame — so the arc breaks for forty degrees either side of the
       line back to the ranch, which is both how you would come in and where a track would have
       worn the trees out. */
    const a=i/26*Math.PI*2+rr(-0.14,0.14),d=rr(30,70);
    if(Math.cos(a)*F.ux+Math.sin(a)*F.uz>0.76)continue;
    const x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
    if(Math.hypot(x,z)>446||!clearAt(x,z,3.0))continue;
    const s=rr(0.9,1.5),lean=rr(-0.06,0.06),tone=AMBER[(rnd()*AMBER.length)|0],y0=groundH(x,z);
    const tg2=new THREE.Group();
    tp(tg2,'#5f4a33',0,3.1*s,0,0.42*s,6.2*s).rotation.z=lean;
    for(let k=0;k<4;k++){const la=k/4*Math.PI*2+i;beam(tg2,'#5f4a33',0,4.4*s,0,Math.cos(la)*2.6*s,7.2*s,Math.sin(la)*2.6*s,0.16*s);}
    for(let k=0;k<7;k++){const la=rr(0,6.28),ld=rr(0.4,3.2)*s;
     lp(tg2,k?tone:AMBER[(rnd()*AMBER.length)|0],Math.cos(la)*ld,(7.4+rr(-0.7,1.5))*s,Math.sin(la)*ld,rr(1.9,3.2)*s,rr(1.3,2.0)*s,rr(1.9,3.2)*s);}
    tg2.position.set(x,y0,z);tg2.rotation.y=rr(0,6.28);mp.add(tg2);
    collide(x,z,0.9);}
   solid.add(mp);}

  /* Leaf litter. One instanced mesh, eleven hundred quads, six autumn colours off instanceColor,
     thickest under the wood and thinning out across the yard. */
  const leaves=[];
  for(let i=0;i<1100;i++){
   const a=rr(0,6.28),d=Math.sqrt(rnd())*76,x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>452)continue;
   leaves.push({x,y:groundH(x,z)+0.07+rnd()*0.03,z,sx:rr(0.3,0.55),sy:1,sz:rr(0.24,0.42),ry:rr(0,6.28),c:AMBER[(rnd()*AMBER.length)|0]});}
  scatter(G_FLAKE,WHITE,leaves,false,150);

  /* A hitching rail, a sign to arrive under, and three people. */
  const rail=F.at(3,-6),rg=new THREE.Group();
  for(const s of [-1,1])cy(rg,T_MID,s*1.7,0.62,0,0.11,1.25);
  cy(rg,T_PALE,0,1.1,0,0.075,3.4).rotation.z=Math.PI/2;
  place(solid,rg,rail[0],rail[1],F.yaw+0.4);
  const sgn=F.at(-9,2),sg=new THREE.Group();signboard(sg,'AMBERWOOD MILL',3.6);place(solid,sg,sgn[0],sgn[1],F.yaw+Math.PI);
  bake(solid,true);bake(flat,false);

  trough('amber:pond',POND.x,POND.z,POND.r+3.4,'🪣 Let your horse drink at the mill pond','🪣 % drinks deep at the mill pond.');
  P.things++;
  W.addThing({kind:'qlook',id:'q:amber:tower',x:twr[0],z:twr[1],g:null,reach:6.6,label:()=>'🔭 The Amberwood fire lookout (E)',
   use:()=>toast('🔭 The ladder is padlocked at the second lift. Sten has the key, and Sten is out raking leaves.')});
  npc({id:'qa_mattis',name:'Mattis',icon:'🧔',x:mil[0]+3.0,z:mil[1]+3.6,hat:'#4a4237',shirt:'#6f5a3c',folk:true,
   idle:'Blade is off for filing. Forty-one teeth and every one of them by hand, so no, it will not be today.'});
  npc({id:'qa_ruda',name:'Ruda',icon:'👩',x:kil[0]+5.0,z:kil[1]+1.4,hat:'#8a4a34',shirt:'#5a4a38',folk:true,
   idle:'A burn takes seven days and you cannot sleep through any of them. Open the kiln early and all you have is a week of smoke.'});
  npc({id:'qa_sten',name:'Sten',icon:'🧑',x:rail[0]+3.4,z:rail[1]-2.6,hat:'#b08a4a',shirt:'#5a7a4a',folk:true,
   idle:'They set me to raking leaves. It is a wood, and it is autumn. I have said this to three people now.'});

  W.mapMarkers.push({x:mil[0],z:mil[1],glyph:'🪵',kind:'landmark',id:'q:amber:mill'});
  W.mapMarkers.push({x:twr[0],z:twr[1],glyph:'🔭',kind:'landmark',id:'q:amber:tower'});
  W.mapMarkers.push({x:POND.x,z:POND.z,glyph:'💧',alpha:0.85,kind:'landmark',id:'q:amber:pond'});
  for(const p of [lodge,office,cott,kil])W.miniMarkers.push({x:p[0],z:p[1],col:'#d98f3a',r:2.4});
  P.sites.amberwood={mill:[mil[0]|0,mil[1]|0],lodge:[lodge[0]|0,lodge[1]|0],tower:[twr[0]|0,twr[1]|0],pond:[POND.x|0,POND.z|0],level:+POND.y.toFixed(2)};
 }

 /* ================= 9. WILLOWMERE — a village that gave up on dry ground ===================
    The marsh has no flat acre to offer, so nothing here stands on the ground: the houses are up
    on posts over the pools and the street is a boardwalk that steps down the slope a plank at a
    time. The water comes as half a dozen separate pools rather than one lake, which is both
    what a marsh actually is and the only thing this terrain will carry. */
 function buildWillowmere(){
  const F=frame(310,300),solid=new THREE.Group(),flat=new THREE.Group();
  const T_DARK='#4a4034',T_MID='#6f6048',T_PALE='#9c8c6a',T_GREY='#8c8a7e',IRON='#3a3d40',WILLOW='#6f8f52',LAMP='#ffcf7a';

  /* The pools, each sited by the same flatness search the buildings use so that none of them
     ends up as a disc of water standing proud of a slope. */
  const POOLS=[];
  for(const [a,b,r] of [[6,-18,7.5],[-4,-4,8.5],[-12,14,6.5],[4,16,5.5],[-14,-14,5],[9,5,4.5],[-18,1,5.5]]){
   const p0=F.at(a,b),at=pad(p0[0],p0[1],r,0.6);
   POOLS.push(pool(solid,at[0],at[1],r,'#46685e','#5a5a42'));
  }
  const MERE=POOLS[1];

  /* Reed beds. Two crossed blades per clump on an alpha-cut texture — two thousand of them on
     one draw call, thickest at every waterline and thinning out across the flats. They were
     built at a metre across on the first pass and the marsh looked like a salad; a reed clump
     is a hand's width, not a bush. */
  const reeds=[];
  for(const p of POOLS)for(let i=0;i<190;i++){
   const a=rr(0,6.28),d=p.r*rr(0.84,1.5),x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d;
   if(Math.hypot(x,z)>452)continue;
   reeds.push({x,y:Math.min(groundH(x,z),p.y)-0.08,z,sx:rr(0.3,0.52),sy:rr(0.8,1.6),sz:rr(0.3,0.52),ry:rr(0,6.28),c:rnd()<0.3?'#c2ae72':'#ffffff'});}
  for(let i=0;i<520;i++){const a=rr(0,6.28),d=rr(14,64),x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>452)continue;
   reeds.push({x,y:groundH(x,z)-0.05,z,sx:rr(0.26,0.44),sy:rr(0.6,1.2),sz:rr(0.26,0.44),ry:rr(0,6.28),c:rnd()<0.35?'#c2ae72':'#ffffff'});}
  scatter(G_TUFT,reedTexture(),reeds,false,180);

  /* Willows. Six of them, and their silhouette is half the reason you can tell Willowmere from
     four hundred metres: a short thick bole, limbs that reach out rather than up, a heavy mass
     of canopy over them and a curtain of whips off the edge of it down toward the water. Two
     passes on this: cones pointing up gave six stands of asparagus, and cones merely flipped
     gave six green hedgehogs. A willow is a mass with a fringe, so it is built as one. */
  function willow(){
   const g=new THREE.Group();
   tp(g,'#584734',0,2.2,0,0.8,4.4);
   for(let k=0;k<6;k++){const a=k/6*Math.PI*2+rr(-0.25,0.25),d=rr(2.4,3.8);
    beam(g,'#584734',0,3.5,0,Math.cos(a)*d,5.5+rr(-0.4,0.5),Math.sin(a)*d,0.2);}
   for(let k=0;k<13;k++){const a=rr(0,6.28),d=rr(0.4,2.8);         // the mass, domed rather than flat
    lp(g,k%3?WILLOW:'#75984f',Math.cos(a)*d,5.9-d*0.42+rr(-0.5,0.5),Math.sin(a)*d,rr(1.7,2.9),rr(1.2,2.0),rr(1.7,2.9));}
   /* The fringe. Thin: at a quarter-metre through they stopped being whips and became a
      colonnade, and six willows turned into six parasols standing on pillars. */
   for(let k=0;k<56;k++){
    const a=k/56*Math.PI*2*3.3+rr(-0.2,0.2),d=rr(1.2,4.1),len=rr(1.6,4.4),top=6.0-d*0.5+rr(-0.3,0.3);
    const m=tp(g,k%3?WILLOW:'#87a862',Math.cos(a)*d,top-len/2,Math.sin(a)*d,rr(0.05,0.11),len);
    m.rotation.x=Math.PI;m.rotation.z=rr(-0.1,0.1);}
   return g;
  }
  for(const [a,b] of [[10,-24],[-8,-21],[-20,9],[2,25],[-16,24],[15,10]]){
   const p0=F.at(a,b),at=pad(p0[0],p0[1],3.2,1.6);
   place(solid,willow(),at[0],at[1],rr(0,6.28));collide(at[0],at[1],1.0);
  }

  /* The boardwalk. It follows the ground rather than fighting it — each span sits six hundred
     millimetres above whatever is under its midpoint and the posts go down to meet it. That is
     the entire reason a marsh village has a boardwalk and not a street. */
  const WALK=[[12,-24],[6,-16],[2,-6],[-2,2],[-6,10],[-11,18],[-15,25]].map(p=>F.at(p[0],p[1]));
  const SPUR=[[[-3,1],[-10,4]],[[3,-8],[9,-12]],[[-5,7],[2,14]]].map(s=>s.map(p=>F.at(p[0],p[1])));
  const lamps=[];
  function boardwalk(pts,w){
   for(let i=1;i<pts.length;i++){
    const [x0,z0]=pts[i-1],[x1,z1]=pts[i],span=Math.hypot(x1-x0,z1-z0),n=Math.max(2,Math.round(span/1.6)),yaw=Math.atan2(x1-x0,z1-z0);
    for(let k=0;k<n;k++){
     const f=(k+0.5)/n,x=x0+(x1-x0)*f,z=z0+(z1-z0)*f,y=groundH(x,z)+0.62;
     bx(solid,'#8a7550',x,y,z,w,0.1,span/n+0.1).rotation.y=yaw;
     if(k%2===0)for(const s of [-1,1]){
      const px=x+Math.cos(yaw)*s*(w/2-0.14),pz=z-Math.sin(yaw)*s*(w/2-0.14),gy=groundH(px,pz);
      cy(solid,T_DARK,px,(gy+y)/2-0.1,pz,0.09,y-gy+0.3);}
     if(k%7===3){
      const px=x+Math.cos(yaw)*(w/2+0.18),pz=z-Math.sin(yaw)*(w/2+0.18);
      cy(solid,T_MID,px,y+1.2,pz,0.07,2.5);
      bx(solid,IRON,px,y+2.5,pz,0.3,0.06,0.3);
      lamps.push({x:px,y:y+2.34,z:pz,s:0.2});}
    }
   }
  }
  boardwalk(WALK,2.2);for(const s of SPUR)boardwalk(s,1.6);
  scatter(G_LUMP,mt(LAMP,{emissive:LAMP,emissiveIntensity:1.0,roughness:0.4}),lamps,false,240);

  /* A house on posts: a deck at a metre above whatever the water gets to, six legs down to
     whatever is underneath, a narrow steep-roofed cabin and a ladder. Nothing touches the
     ground, which is the whole idea. */
  function stilthouse(x,z,yaw,w,d,h,deckW){
   const g=new THREE.Group(),y0=groundH(x,z);
   const deck=Math.max(0,waterLevel(x,z,Math.max(w,d)/2+1.4)-y0)+1.05;
   for(let ix=-1;ix<=1;ix++)for(const iz of [-1,1]){
    const px=ix*(deckW/2-0.34),pz=iz*(d/2+0.55),wp=world(x,z,yaw,px,pz),gy=groundH(wp[0],wp[1])-y0;
    cy(g,T_DARK,px,(gy+deck)/2-0.2,pz,0.13,deck-gy+0.7);}
   bx(g,'#8a7550',0,deck,0,deckW,0.14,d+1.7);
   shack(g,T_PALE,w,d,h,1.0,2.0,deck+0.07);
   roof(g,'#5c4b33',w,d,h*0.6,deck+0.07+h,0.34);
   for(let k=0;k<5;k++)bx(g,T_MID,deckW/2+0.24,deck-0.16-k*0.24,d/2+0.3,0.72,0.06,0.1);
   for(const s of [-1,1])bx(g,T_MID,s*(deckW/2-0.07),deck+0.55,d/2+0.62,0.08,0.9,0.08);
   bx(g,T_MID,0,deck+0.96,d/2+0.62,deckW-0.12,0.07,0.07);
   place(solid,g,x,z,yaw);
   return y0+deck;
  }
  const eel=F.at(-8,6),cotA=F.at(-6,-16),cotB=F.at(3,18),hide=F.at(-15,25);
  const eelDeck=stilthouse(eel[0],eel[1],F.yaw+0.2,5.6,4.4,3.4,7.4);collide(eel[0],eel[1],3.7);
  const deckA=stilthouse(cotA[0],cotA[1],F.yaw-0.5,3.6,3.0,2.7,5.0);collide(cotA[0],cotA[1],2.6);
  stilthouse(cotB[0],cotB[1],F.yaw+1.4,3.4,2.8,2.6,4.6);collide(cotB[0],cotB[1],2.5);
  stilthouse(hide[0],hide[1],F.yaw+2.3,2.4,2.2,2.0,3.4);collide(hide[0],hide[1],2.0);
  smoke(eel[0],eelDeck+5.6,eel[1],{rise:2.6,h:10,drift:0.8});
  smoke(cotA[0],deckA+4.3,cotA[1],{rise:2.4,h:8,drift:0.7});
  {const g=new THREE.Group();signboard(g,'THE EEL HOUSE',3.0);const s=world(eel[0],eel[1],F.yaw+0.2,0,5.2);place(solid,g,s[0],s[1],F.yaw+0.2+Math.PI);}

  /* The boathouse is the one building on dry land, because a slipway needs a bank to run up. */
  const bh=building({id:'willow:boathouse',x:F.at(8,-11)[0],z:F.at(8,-11)[1],rot:F.yaw+0.7,r:3.0,flat:0.5,
   label:'🛶 Willowmere boathouse',build:outbuilding({width:5.4,depth:3.6,height:3.4,animatedDoorOpening:{width:1.9,height:2.3}}),
   open:()=>UI.openShop('food'),door:'🧺 Buy feed at the boathouse'});
  door('willow:eelhouse',eel[0],eel[1],5.9,'🏠 Go up into the eel house',()=>UI.openOnline());

  /* Punts tied up, nets drying on a frame, and four herons that have no opinion about any of it. */
  const bg=new THREE.Group();
  for(let i=0;i<3;i++){
   const p=POOLS[i*2%POOLS.length],a=rr(0,6.28),px=p.x+Math.cos(a)*p.r*0.55,pz=p.z+Math.sin(a)*p.r*0.55,pg=new THREE.Group();
   bx(pg,'#7a6242',0,0.12,0,1.0,0.22,4.2);bx(pg,'#8e7550',0,0.3,0,0.9,0.12,4.0);
   for(const s of [-1,1])bx(pg,'#7a6242',s*0.48,0.3,0,0.08,0.34,4.0);
   bx(pg,'#6b5336',0,0.34,-1.2,0.8,0.08,0.5);
   cy(pg,'#8e7550',0.3,0.5,0.6,0.045,3.2).rotation.set(0.1,0,1.35);
   pg.position.set(px,p.y-0.06,pz);pg.rotation.y=rr(0,6.28);bg.add(pg);}
  for(let i=0;i<4;i++){
   const p=POOLS[(i*2+1)%POOLS.length],a=rr(0,6.28),hx=p.x+Math.cos(a)*p.r*0.78,hz=p.z+Math.sin(a)*p.r*0.78,hg=new THREE.Group();
   for(const s of [-1,1])cy(hg,'#c6ba9a',s*0.06,0.34,0,0.028,0.72);
   lp(hg,'#b9c2c6',0,0.88,0,0.17,0.26,0.4);tp(hg,'#b9c2c6',0,1.26,0.02,0.07,0.62);
   lp(hg,'#e2e8ea',0,1.54,0.07,0.09,0.09,0.13);
   cn(hg,'#e0b050',0,1.52,0.26,0.045,0.34).rotation.x=Math.PI/2+0.2;
   lp(hg,'#7d8a90',0,0.92,-0.25,0.13,0.2,0.3);
   hg.position.set(hx,Math.max(groundH(hx,hz),p.y)-0.07,hz);hg.rotation.y=rr(0,6.28);bg.add(hg);}
  const nets=F.at(10,-4),ny=groundH(nets[0],nets[1]);
  for(const s of [-1,1])cy(bg,T_MID,nets[0]+s*1.6,ny+1.1,nets[1],0.08,2.2);
  {const m=bx(bg,'#a8a482',nets[0],ny+1.5,nets[1],3.2,1.4,0.05);m.material=mt('#a8a482',{transparent:true,opacity:0.55,side:THREE.DoubleSide,roughness:1});m.castShadow=false;}
  solid.add(bg);

  /* The lamp mast: fifteen metres of pole on a cairn in the shallows with a lit head and a heron
     for a weather-vane. It is what you steer by coming in off the meadows at dusk. */
  const mast=F.at(-13,-3),mg=new THREE.Group();
  for(let k=0;k<14;k++){const a=rr(0,6.28),d=rr(0.2,2.0);lp(mg,T_GREY,Math.cos(a)*d,rr(0.1,0.6),Math.sin(a)*d,rr(0.3,0.75),rr(0.2,0.45),rr(0.3,0.75));}
  tp(mg,'#5a4a38',0,7.3,0,0.27,14.6);
  for(let k=0;k<3;k++){const a=k/3*Math.PI*2;beam(mg,T_MID,0,9.2,0,Math.cos(a)*3.3,0.5,Math.sin(a)*3.3,0.05);}
  bx(mg,IRON,0,14.5,0,0.95,0.12,0.95);
  put(G_LUMP,LAMP,0.42,0.54,0.42,0,15.0,0,mg,{emissive:LAMP,emissiveIntensity:1.6,roughness:0.35});
  bx(mg,IRON,0,15.5,0,0.72,0.1,0.72);
  lp(mg,IRON,0,15.85,0,0.1,0.14,0.36);bx(mg,IRON,0,15.9,-0.45,0.03,0.26,0.5);tp(mg,IRON,0,16.1,0.16,0.05,0.3);
  place(solid,mg,mast[0],mast[1],0.5);
  collide(mast[0],mast[1],1.7);

  const sgn=F.at(12,-19),sg=new THREE.Group();signboard(sg,'WILLOWMERE',3.0);place(solid,sg,sgn[0],sgn[1],F.yaw+Math.PI+0.3);
  bake(solid,true);bake(flat,false);

  /* Ground mist: eight broad soft banks drifting over the pools, no depth write and a low
     opacity, so the whole effect costs a few thousand shaded pixels rather than a second scene.
     Crossed quads again rather than billboards, for the reason given up at the smoke. */
  const mc=document.createElement('canvas');mc.width=128;mc.height=64;
  {const x=mc.getContext('2d');const g2=x.createRadialGradient(64,32,4,64,32,62);
   g2.addColorStop(0,'rgba(255,255,255,0.72)');g2.addColorStop(0.55,'rgba(248,250,250,0.3)');g2.addColorStop(1,'rgba(248,250,250,0)');
   x.fillStyle=g2;x.fillRect(0,0,128,64);}
  /* A third of an opacity, not a half: at a half the banks stopped being mist over the water and
     started being a white wash over the village. */
  const mistMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(mc),transparent:true,depthWrite:false,side:THREE.DoubleSide,opacity:0.3});
  const mistItems=[];
  for(let i=0;i<6;i++){const p=POOLS[i%POOLS.length];mistItems.push({x:p.x+rr(-6,6),y:p.y+0.9,z:p.z+rr(-6,6),sx:rr(15,24),sy:rr(1.7,2.8),sz:rr(15,24),ry:rr(0,6.28)});}
  const mist=scatter(G_CROSS,mistMat,mistItems,false);
  if(mist){
   mist.renderOrder=2;mist.frustumCulled=false;P.anim.push('mist');
   const base=mistItems.map(m=>({x:m.x,y:m.y,z:m.z,sx:m.sx,sy:m.sy,sz:m.sz,ry:m.ry,ph:rnd()*6.28}));
   G.on('tick',(dt,t)=>{
    if(hyp(player.pos.x,player.pos.z,F.cx,F.cz)>240){mist.visible=false;return;}
    mist.visible=true;
    for(let i=0;i<base.length;i++){const b0=base[i];
     _e.set(0,b0.ry,0);_q.setFromEuler(_e);
     _v.set(b0.x+Math.sin(t*0.05+b0.ph)*5,b0.y+Math.sin(t*0.13+b0.ph)*0.2,b0.z+Math.cos(t*0.043+b0.ph)*5);
     _sc.set(b0.sx,b0.sy,b0.sz);
     mist.setMatrixAt(i,_m4.compose(_v,_q,_sc));}
    mist.instanceMatrix.needsUpdate=true;});
  }

  trough('willow:mere',MERE.x,MERE.z,MERE.r+3.2,'💧 Let your horse drink at the mere','💧 % drinks at the mere.');
  npc({id:'qw_teiko',name:'Teiko',icon:'🎣',x:WALK[1][0]+1.6,z:WALK[1][1]+1.4,hat:'#5a6a70',shirt:'#4a6a5a',folk:true,
   idle:'Eels, mostly. People want to look at them or they want to eat them. Rarely the same people.'});
  npc({id:'qw_bram',name:'Bram',icon:'🧔',x:bh[0]+3.4,z:bh[1]+2.8,hat:'#3f4a52',shirt:'#7a6a4a',folk:true,
   idle:'That punt has been sinking for six years. I keep patching it because hauling it out would settle the argument.'});
  npc({id:'qw_nel',name:'Nel',icon:'👧',x:WALK[4][0]-1.8,z:WALK[4][1]+1.2,hat:'#e0c05a',shirt:'#7a8fbf',folk:true,
   idle:'Twelve lamps on the walk. By the time I have finished the far end the first one wants trimming.'});

  W.mapMarkers.push({x:eel[0],z:eel[1],glyph:'🛶',kind:'landmark',id:'q:willow:eel'});
  W.mapMarkers.push({x:mast[0],z:mast[1],glyph:'🏮',kind:'landmark',id:'q:willow:mast'});
  W.mapMarkers.push({x:MERE.x,z:MERE.z,glyph:'💧',alpha:0.85,kind:'landmark',id:'q:willow:mere'});
  for(const p of [bh,eel,cotA,cotB])W.miniMarkers.push({x:p[0],z:p[1],col:'#7fb0a0',r:2.4});
  P.sites.willowmere={eel:[eel[0]|0,eel[1]|0],boathouse:[bh[0]|0,bh[1]|0],mast:[mast[0]|0,mast[1]|0],pools:POOLS.length,level:+MERE.y.toFixed(2),walk:WALK.length};
 }

 /* ================= 10. FROSTPINE STATION — the last roof before the snowfield ==============
    A warden's bunkhouse and store on the flat below the Hollowpeak shoulder, a tarn frozen hard
    enough to walk on with a hole cut in it, a bell tower on the rise that gets rung at dusk so
    anything still out has a line to walk back on, and the cordwood it takes to get a winter out
    of the way. */
 function buildFrostpine(){
  const F=frame(-300,-320),solid=new THREE.Group(),flat=new THREE.Group();
  const T_DARK='#3f3527',T_MID='#66543a',T_PALE='#9a8462',STONE='#7a7871',SNOW='#eef4f8',ICE='#b4d2de',IRON='#33383c',PINE='#2f4a38',BRASS='#b08a3a';

  /* The tarn. Ice has to be flat, so it is small, it is sited on the flattest ground the search
     can find, and its rim is banked with drifted snow to bury the lip on the low side. */
  /* The tarn wants to be a short walk from the door, so the flatness test here is loose and the
     snow bank round the rim is left to take up whatever slack the ground leaves. Asked for
     level ground it wandered forty metres off and split the settlement in two. */
  const tat=pad(F.at(4,-21)[0],F.at(4,-21)[1],11,1.6);
  const lvl=waterLevel(tat[0],tat[1],10)+0.05;
  /* The ice reads a good deal bluer than snow on purpose. At the colour it started, it was white
     on white from thirty metres and the tarn did not exist until you rode onto it. */
  put(G_DISC,'#7fa8bd',10.6,10.6,1,tat[0],lvl-0.02,tat[1],solid,{roughness:0.5}).rotation.x=-Math.PI/2;
  put(G_DISC,ICE,10,10,1,tat[0],lvl,tat[1],solid,{roughness:0.06,metalness:0.4,transparent:true,opacity:0.82}).rotation.x=-Math.PI/2;
  {const drop=Math.max(0.55,lvl-groundH(tat[0]+11,tat[1])+0.35);
   put(G_SKIRT,SNOW,10.6,drop,10.6,tat[0],lvl-drop/2,tat[1],solid).castShadow=false;}
  /* Wind scour runs the way the wind runs. At eleven streaks laid at independently random
     angles they crossed each other in the middle of the ice and read as a painted X on a
     tennis court rather than as weather; a rider standing on the bank saw a marked-out rink.
     One bearing for the whole tarn with a few degrees of wander, thinner ribbons, and enough
     transparency that the ice still shows through, and they read as drift again. */
  const scourA=rr(0,6.28);
  for(let k=0;k<11;k++){const a=rr(0,6.28),d=rr(1,8);
   const m=bx(solid,'#e4f2f7',tat[0]+Math.cos(a)*d,lvl+0.02,tat[1]+Math.sin(a)*d,rr(3,7),0.02,rr(0.12,0.3));
   m.material=mt('#e4f2f7',{transparent:true,opacity:0.5,roughness:0.35});
   m.rotation.y=scourA+rr(-0.09,0.09);m.castShadow=false;}
  /* Boot-and-hoof-packed snow round the rim, so the tarn has an edge you can see. */
  for(let k=0;k<26;k++){const a=k/26*Math.PI*2+rr(-0.06,0.06);
   lp(solid,'#f4f9fc',tat[0]+Math.cos(a)*rr(10.4,11.6),lvl-0.35,tat[1]+Math.sin(a)*rr(10.4,11.6),rr(1.2,2.6),rr(0.35,0.7),rr(1.2,2.2)).castShadow=false;}
  const hole=[tat[0]+2.6,tat[1]-1.7];
  put(G_DISC,'#dfeef4',1.2,1.2,1,hole[0],lvl+0.018,hole[1],solid).rotation.x=-Math.PI/2;
  put(G_DISC,'#12343f',0.8,0.8,1,hole[0],lvl+0.024,hole[1],solid,{roughness:0.1,metalness:0.5}).rotation.x=-Math.PI/2;
  {const ih=new THREE.Group();
   shack(ih,'#8a5c3a',1.9,1.7,1.9,0.8,1.5);roof(ih,T_DARK,1.9,1.7,0.7,1.9,0.2);
   for(let k=0;k<4;k++)cy(ih,T_MID,(k<2?-1:1)*0.82,0.22,(k%2?-1:1)*0.72,0.06,0.45);
   ih.position.set(hole[0]-2.8,lvl,hole[1]+1.3);ih.rotation.y=0.6;solid.add(ih);}
  {const sg=new THREE.Group();
   for(const s of [-1,1])for(const s2 of [-1,1])cy(sg,T_MID,s*0.16,0.2,s2*0.16,0.035,0.4);
   bx(sg,T_PALE,0,0.42,0,0.46,0.06,0.46);cy(sg,IRON,0.62,0.16,0.32,0.18,0.32);
   beam(sg,'#6b5336',0.1,0.5,0.1,1.9,0.18,-1.5,0.03);
   sg.position.set(hole[0]-1.0,lvl,hole[1]+0.6);solid.add(sg);}

  /* The two buildings you can walk into, and the woodshed between them. */
  const bunk=building({id:'frost:bunk',x:F.at(2,-8)[0],z:F.at(2,-8)[1],rot:F.yaw+0.35,r:2.8,flat:0.45,
   label:'🔥 The Frostpine bunkhouse',build:cottage(0),open:()=>UI.openCare(),door:'🔥 Warm up in the bunkhouse'});
  const store=building({id:'frost:store',x:F.at(4,9)[0],z:F.at(4,9)[1],rot:F.yaw-0.4,r:3.0,flat:0.45,
   label:'🐎 Warden\'s winter store',build:outbuilding({width:5.0,depth:3.6,height:3.3}),open:()=>UI.openShop('tack'),door:'🐎 Winter studs at the warden\'s store'});
  smoke(bunk[0],groundH(bunk[0],bunk[1])+4.4,bunk[1],{rise:2.8,h:14,drift:0.9});

  const shed=pad(F.at(-3,17)[0],F.at(-3,17)[1],4,0.7),shy=F.yaw+0.9,sg3=new THREE.Group();
  for(const s of [-1,1]){cy(sg3,T_MID,s*2.2,1.3,-1.4,0.12,2.6);cy(sg3,T_MID,s*2.2,0.95,1.4,0.12,1.9);}
  bx(sg3,T_DARK,0,2.0,0,5.0,0.12,3.5).rotation.x=-0.22;
  bx(sg3,SNOW,0,2.15,0,5.0,0.1,3.5).rotation.x=-0.22;
  bx(sg3,T_MID,0,0.9,-1.75,4.6,1.8,0.12);
  place(solid,sg3,shed[0],shed[1],shy);
  collide(shed[0],shed[1],2.6);
  /* Cordwood, split and stacked — the one honest measure of how long a winter is expected to be. */
  const shedY=groundH(shed[0],shed[1]),cord=[];
  for(let row=0;row<5;row++)for(let i=0;i<7;i++){
   const wp=world(shed[0],shed[1],shy,(i-3)*0.34,0.1);
   cord.push({x:wp[0],y:shedY+0.3+row*0.32,z:wp[1],sx:1.5,sy:0.3,sz:0.3,ry:shy+Math.PI/2,c:row%2?'#7d6340':'#6b5336'});}
  const cord2=F.at(-7,11),c2y=groundH(cord2[0],cord2[1]);
  for(let row=0;row<4;row++)for(let i=0;i<6;i++)cord.push({x:cord2[0]+(i-2.5)*0.33,y:c2y+0.28+row*0.31,z:cord2[1]+row*0.03,sx:1.4,sy:0.29,sz:0.29,ry:0.3,c:row%2?'#7d6340':'#6b5336'});
  scatter(G_LOG,WHITE,cord,true,220);
  /* A sled stood on its end against the shed, and the two grooves it left coming down. */
  {const sl=new THREE.Group();
   for(const s of [-1,1])bx(sl,'#8a5c3a',s*0.34,0.9,0,0.09,1.8,0.26).rotation.x=0.1;
   for(let k=0;k<4;k++)bx(sl,T_PALE,0,0.32+k*0.45,0.06,0.8,0.07,0.2);
   const sp=world(shed[0],shed[1],shy,2.9,1.2);
   sl.position.set(sp[0],groundH(sp[0],sp[1]),sp[1]);sl.rotation.y=shy+0.5;sl.rotation.z=0.16;solid.add(sl);}
  const tracks=[];
  for(let k=0;k<46;k++){const t2=k/46,p0=F.at(-14+t2*22,26-t2*32+Math.sin(t2*5)*2.4);
   for(const s of [-1,1]){const px=p0[0]+s*0.3,pz=p0[1];tracks.push({x:px,y:groundH(px,pz)+0.055,z:pz,sx:0.18,sy:1,sz:1.6,ry:F.yaw+1.1+Math.sin(t2*5)*0.2,c:'#dbe7ee'});}}
  scatter(G_FLAKE,WHITE,tracks,false,160);

  /* The bell tower, up on the shoulder so it clears the pines: stone to shoulder height, timber
     above, a shingled cap, and a bell you can ring. The plinth runs a metre and a half below the
     base because the rise it stands on is not level and a tower with daylight under one corner
     is a tower nobody believes. */
  /* Twenty metres to the finial. The pines out here run past twenty-five, and at the first
     pass's thirteen the tower was a shed with a hat on it and could not be picked out from the
     rim at all — a landmark that does not clear the treeline is not a landmark. */
  const twr=pad(F.at(15,-2)[0],F.at(15,-2)[1],4,1.8),tg=new THREE.Group();
  cy(tg,STONE,0,-1.5,0,2.6,3.6);
  /* Sixteen courses of battered rubble rather than five grey slabs, and the tones spread wide
     enough to read as stone from the rim. At the first pass the base was blocks nearly a metre
     deep; at the second the courses were right but all three greys were within a hair of each
     other and from any distance it turned back into one smooth concrete silo. */
  const COURSE=['#968d80','#645c52','#847a6e','#564f46','#9e9488','#6e655b'];
  /* Alternate courses stand a few centimetres proud, because what makes masonry read as
     masonry at fifty metres is the shadow line between the courses and not the colour of the
     stone: sixteen flush courses in six close greys came out as one smooth concrete silo. */
  for(let k=0;k<16;k++){const w2=4.3-k*0.075+(k%2?0.07:-0.03);bx(tg,COURSE[(k*3+k*k)%COURSE.length],0,0.2+k*0.4,0,w2,0.4,w2);}
  bx(tg,'#a89d8e',0,6.75,0,4.1,0.34,4.1);                                          // the string course under the belfry
  for(const sx of [-1,1])for(const sz of [-1,1])cy(tg,'#a89d8e',sx*1.96,3.2,sz*1.96,0.32,6.5);  // dressed quoins down the corners
  bx(tg,'#2a2420',0,1.4,1.96,1.0,2.4,0.12);                                        // the doorway into the base
  for(const s of [-1,1])bx(tg,'#241f1c',s*1.0,4.6,1.98,0.26,1.1,0.1);              // and two slit lights above it
  const tf=y=>1.6-((y-6.9)/8.6)*0.3;
  for(const sx of [-1,1])for(const sz of [-1,1])beam(tg,T_MID,sx*1.6,6.8,sz*1.6,sx*1.3,15.6,sz*1.3,0.19);
  for(let k=0;k<5;k++){
   const y0=7.3+k*1.7,y1=y0+1.7,f0=tf(y0),f1=tf(y1);
   for(const [ax,az,b2x,b2z] of [[-1,-1,1,-1],[1,-1,1,1],[1,1,-1,1],[-1,1,-1,-1]]){
    beam(tg,T_DARK,ax*f0,y0,az*f0,b2x*f1,y1,b2z*f1,0.07);
    beam(tg,T_DARK,ax*f0,y0,az*f0,b2x*f0,y0,b2z*f0,0.07);}}
  bx(tg,T_PALE,0,15.7,0,3.3,0.24,3.3);
  roof(tg,'#5c4b33',3.3,3.3,1.8,15.8,0.5);
  cy(tg,IRON,0,18.3,0,0.07,1.6);tp(tg,BRASS,0,19.3,0,0.16,0.6);
  place(solid,tg,twr[0],twr[1],F.yaw+0.25);
  collide(twr[0],twr[1],3.1);
  /* The bell hangs outside the bake so that it can swing when you ring it. */
  const bell=new THREE.Group();
  tp(bell,BRASS,0,-0.62,0,0.74,1.3);lp(bell,BRASS,0,-1.28,0,0.2,0.26,0.2);
  bell.position.set(twr[0],groundH(twr[0],twr[1])+14.6,twr[1]);
  bell.name='quarter_bell';scene.add(own(bell));P.draws++;P.anim.push('bell');
  let swing=0;
  G.on('tick',dt=>{if(swing>0.002){swing*=Math.pow(0.4,dt);bell.rotation.z=Math.sin(performance.now()*0.007)*swing;}else if(bell.rotation.z){bell.rotation.z=0;swing=0;}});
  P.things++;
  W.addThing({kind:'qbell',id:'q:frost:bell',x:twr[0],z:twr[1],g:null,reach:5.4,label:()=>'🔔 Ring the Frostpine bell (E)',
   use:()=>{swing=0.6;G.sChime();toast('🔔 The bell carries a long way over snow. Somewhere out in the pines, somebody turns for home.');}});

  /* Snow-laden saplings, drifts and marker cairns: the ground work that turns bare white terrain
     into somewhere with a path through it. Three cones a tree, one draw call for the lot. */
  /* Saplings: five narrow tiers each, a metre and a half to three and a half tall, snow only on
     the top two. The first pass built them at three cones and nearly six metres and the
     snowfield filled up with Christmas-tree emoji. */
  const sap=[];
  for(let i=0;i<96;i++){
   const a=rr(0,6.28),d=rr(14,70),x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>450||hyp(x,z,tat[0],tat[1])<11)continue;
   const s=rr(0.45,0.95),y=groundH(x,z),ry=rr(0,6.28),lean=rr(-0.04,0.04);
   cy(solid,'#4a3a2a',x,y+0.35*s,z,0.09*s,0.7*s);
   for(let k=0;k<5;k++)sap.push({x,y:y+0.62*s+k*0.58*s,z,sx:(1.15-k*0.19)*s,sy:1.0*s,sz:(1.15-k*0.19)*s,ry,rz:lean,c:k>=3?'#dbe8f0':(k===2?'#3a5a44':PINE)});}
  scatter(G_CONE,WHITE,sap,true);
  /* Drifts: long, shallow and barely brighter than the ground. At the first pass they were
     round and bright and the snowfield looked like it had been rained on. */
  const drifts=[];
  for(let i=0;i<54;i++){const a=rr(0,6.28),d=rr(12,64),x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>452)continue;
   drifts.push({x,y:groundH(x,z)-0.3,z,sx:rr(2.4,6.5),sy:rr(0.32,0.6),sz:rr(1.0,2.2),ry:rr(0,6.28),c:i%3?'#eef4f8':'#e4edf2'});}
  scatter(G_LUMP,WHITE,drifts,false,220);
  {const cg=new THREE.Group();
   for(let i=0;i<6;i++){const p0=F.at(-16+i*7,26-i*9),cy0=groundH(p0[0],p0[1]);
    for(let k=0;k<5;k++)lp(cg,k===4?SNOW:STONE,p0[0],cy0+0.2+k*0.3,p0[1],0.46-k*0.065,0.2,0.46-k*0.065);}
   solid.add(cg);}

  const sgn=F.at(-9,-5),sg4=new THREE.Group();signboard(sg4,'FROSTPINE STATION',3.8);place(solid,sg4,sgn[0],sgn[1],F.yaw+Math.PI-0.2);
  bake(solid,true);bake(flat,false);

  trough('frost:hole',hole[0],hole[1],4.6,'🧊 Break the ice for your horse','🧊 % drinks from the fishing hole.');
  npc({id:'qf_ivar',name:'Ivar',icon:'🧔',x:store[0]+3.2,z:store[1]+2.6,hat:'#3a4650',shirt:'#5a6f8a',folk:true,
   idle:'Nine inches on the middle of the tarn and three at the inflow. Ride the middle, or ride round.'});
  npc({id:'qf_sanna',name:'Sanna',icon:'🧣',x:hole[0]-3.8,z:hole[1]+2.6,hat:'#e0e8ee',shirt:'#8a5a7a',folk:true,
   idle:'Four hours, one perch. I have had worse mornings and better dinners.'});
  npc({id:'qf_ebbe',name:'Ebbe',icon:'👴',x:twr[0]-3.6,z:twr[1]+2.4,hat:'#6a6258',shirt:'#4a5a5a',folk:true,
   idle:'I ring it at dusk so anything still out in the trees has a line to walk back on. Some winters that is the whole of the job.'});

  W.mapMarkers.push({x:twr[0],z:twr[1],glyph:'🔔',kind:'landmark',id:'q:frost:tower'});
  W.mapMarkers.push({x:bunk[0],z:bunk[1],glyph:'🛖',kind:'landmark',id:'q:frost:bunk'});
  W.mapMarkers.push({x:tat[0],z:tat[1],glyph:'🧊',alpha:0.85,kind:'landmark',id:'q:frost:tarn'});
  for(const p of [bunk,store,shed])W.miniMarkers.push({x:p[0],z:p[1],col:'#cfe4ee',r:2.4});
  P.sites.frostpine={bunk:[bunk[0]|0,bunk[1]|0],store:[store[0]|0,store[1]|0],tower:[twr[0]|0,twr[1]|0],tarn:[tat[0]|0,tat[1]|0],ice:+lvl.toFixed(2)};
 }

 /* ================= 11. OCHRE REACH — red rock, and what it costs to live on it =============
    The flattest, emptiest ground in the basin, which means every bit of relief out here has to
    be built: three mesas and an arch give the quarter a skyline, a trading post, a horse
    trader's barn, a windmill and a tank on a trestle give it a reason, and a dry wash runs
    through the middle so there is somewhere for the water to not be. */
 function buildOchre(){
  const F=frame(-330,300),solid=new THREE.Group(),flat=new THREE.Group();
  const ROCK='#8a5238',ROCK2='#6e3c28',ROCK3='#a87552',BONE='#c9bda0',T_DARK='#5a4634',T_MID='#7d6245',IRON='#454a4c',TIN='#8e9296';
  const STRATA=['#8a5238','#6e3c28','#9c6544','#5e3324','#7d4a30','#a87552','#79432c'];

  /* The mesas. Fourteen shallow strata under a harder cap, seven buttresses running the full
     height of the face, and a talus of the mesa's own spoil heaped round the foot. Two earlier
     passes got this wrong in two different ways worth recording: seven clean drums stepping
     evenly inward came out as stacked cake tins, and then a rib per drum came out as a wall of
     barnacles. A buttress has to run top to bottom or it is not a buttress. */
  function mesa(x,z,r,h,seed){
   const mg=new THREE.Group(),n=14;
   for(let k=0;k<n;k++){
    const f=1-k/n*0.19+Math.sin(k*2.7+seed*1.7)*0.022,y=h*k/n,hh=h/n*1.07;
    cy(mg,STRATA[(k+seed)%STRATA.length],Math.sin(k*2.1+seed)*r*0.025,y+hh/2,Math.cos(k*1.7+seed)*r*0.025,r*f,hh).rotation.y=k*0.19+seed;}
   for(let j=0;j<7;j++){const a=j/7*Math.PI*2+seed,rb=r*rr(0.86,0.93);
    tp(mg,STRATA[(j+seed+3)%STRATA.length],Math.cos(a)*rb,h*0.44,Math.sin(a)*rb,r*rr(0.11,0.17),h*rr(0.8,0.92));}
   cy(mg,'#4f2a1b',0,h*1.01,0,r*0.78,h*0.05);
   put(G_FLARE,'#7d4a30',r*1.32,h*0.3,r*1.32,0,h*0.15,0,mg).receiveShadow=true;
   for(let k=0;k<18;k++){const a=rr(0,6.28),d=r*rr(1.2,1.6);   // and the blocks that have come off the front of it
    lp(mg,k%2?ROCK2:ROCK,Math.cos(a)*d,rr(0.1,1.1),Math.sin(a)*d,rr(0.9,2.8),rr(0.6,1.6),rr(0.9,2.8));}
   place(solid,mg,x,z,0);
   collide(x,z,r*0.95);
  }
  const M1=F.at(-24,-18),M2=F.at(-10,34),M3=F.at(40,-46);
  mesa(M1[0],M1[1],22,30,0);
  mesa(M2[0],M2[1],15,20,3);
  mesa(M3[0],M3[1],11,14,1);

  /* The arch: a half torus flattened into a span with two eroded legs under it, wide enough and
     high enough that riding through is the point of it. */
  const arc=F.at(18,-27),ARCYAW=F.yaw+0.5,ag=new THREE.Group();
  {const t=new THREE.Mesh(new THREE.TorusGeometry(8,2.1,7,16,Math.PI),mt(ROCK));
   t.scale.set(1,1.3,1.5);t.position.y=0.2;t.castShadow=true;t.receiveShadow=true;ag.add(t);}
  /* A bare torus reads as rubber. Lumps along the span and down the haunches give it the weather
     that put a hole through it in the first place. */
  for(let k=0;k<11;k++){const th=k/10*Math.PI,cx2=Math.cos(th)*8,cy2=Math.sin(th)*10.4+0.2;
   lp(ag,STRATA[k%STRATA.length],cx2,cy2,rr(-1.1,1.1),rr(1.6,2.9),rr(1.5,2.4),rr(1.9,3.4));}
  for(const s of [-1,1]){
   lp(ag,ROCK2,s*8.4,2.4,0,3.2,3.2,3.5);lp(ag,ROCK,s*8.9,0.9,0,3.8,1.7,4.1);
   for(let k=0;k<6;k++){const a=rr(0,6.28),d=rr(3.4,6.4);
    lp(ag,k%2?ROCK3:ROCK2,s*8.4+Math.cos(a)*d,rr(0.2,0.9),Math.sin(a)*d,rr(0.7,1.9),rr(0.4,1.1),rr(0.7,1.9));}}
  place(solid,ag,arc[0],arc[1],ARCYAW);
  for(const s of [-1,1]){const lg=world(arc[0],arc[1],ARCYAW,s*8.7,0);collide(lg[0],lg[1],3.4);}

  /* The dry wash: a pale ribbon of scoured sand with the cobbles the last flood left in it. The
     ribbon sits a hundred millimetres up because the ground is not perfectly level and a decal
     flush with it half disappears. */
  const wash=[],cobbles=[];
  for(let k=0;k<26;k++)wash.push(F.at(34+Math.sin(k/25*4.2)*6,-42+(k/25)*84));
  for(let k=1;k<wash.length;k++){
   const [x0,z0]=wash[k-1],[x1,z1]=wash[k],mx=(x0+x1)/2,mz=(z0+z1)/2;
   const m=bx(flat,'#cfae7c',mx,groundH(mx,mz)+0.1,mz,rr(5.5,8),0.14,Math.hypot(x1-x0,z1-z0)+0.6);
   m.rotation.y=Math.atan2(x1-x0,z1-z0);m.castShadow=false;
   for(let i=0;i<6;i++){const f=rnd(),x=x0+(x1-x0)*f+rr(-3.4,3.4),z=z0+(z1-z0)*f+rr(-3.4,3.4);
    cobbles.push({x,y:groundH(x,z)+0.14,z,sx:rr(0.22,0.66),sy:rr(0.16,0.4),sz:rr(0.22,0.66),ry:rr(0,6.28),c:i%2?'#b09776':'#93765a'});}}
  scatter(G_LUMP,WHITE,cobbles,false,170);

  /* The post and the barn: the two doors on the reach. */
  const post=building({id:'ochre:post',x:F.at(11,-9)[0],z:F.at(11,-9)[1],rot:F.yaw+0.4,r:3.0,
   label:'🤝 Ochre Reach trading post',build:outbuilding({width:5.6,depth:3.8,height:3.4,animatedDoorOpening:{width:1.3,height:2.1}}),
   open:()=>UI.openShop('market'),door:'🤝 Trade at the Ochre post'});
  const bn=building({id:'ochre:barn',x:F.at(15,13)[0],z:F.at(15,13)[1],rot:F.yaw-0.5,r:5.3,
   label:'🐴 Juno\'s string',build:barn,open:()=>UI.openShop('horses'),door:'🐴 Look over the trader\'s string'});

  /* The windmill and the tank: eleven hundred gallons on six legs and a fan that turns, which
     out here is the whole difference between a settlement and a place people died at. */
  const mill=pad(F.at(2,4)[0],F.at(2,4)[1],4,0.6),MYAW=F.yaw,wg=new THREE.Group();
  for(const sx of [-1,1])for(const sz of [-1,1])beam(wg,T_DARK,sx*1.5,0,sz*1.5,sx*0.45,7.8,sz*0.45,0.13);
  for(let k=1;k<4;k++){const y=k*1.95,f=1.5+(0.45-1.5)*(y/7.8);
   for(const [ax,az,b2x,b2z] of [[-1,-1,1,-1],[1,-1,1,1],[1,1,-1,1],[-1,1,-1,-1]])beam(wg,T_MID,ax*f,y,az*f,b2x*f,y,b2z*f,0.05);}
  bx(wg,T_MID,0,7.9,0,1.5,0.2,1.5);
  place(solid,wg,mill[0],mill[1],MYAW);
  collide(mill[0],mill[1],2.2);
  const fan=new THREE.Group();
  for(let k=0;k<14;k++){const a=k/14*Math.PI*2;
   bx(fan,TIN,Math.cos(a)*1.55,Math.sin(a)*1.55,0,0.46,1.0,0.05).rotation.z=a+0.5;
   beam(fan,IRON,0,0,0,Math.cos(a)*1.95,Math.sin(a)*1.95,0,0.025);}
  cy(fan,IRON,0,0,-0.24,0.18,0.55).rotation.x=Math.PI/2;
  fan.position.set(mill[0],groundH(mill[0],mill[1])+8.7,mill[1]);fan.rotation.y=MYAW+0.3;
  fan.name='quarter_fan';scene.add(own(fan));P.draws+=2;P.anim.push('windmill');
  {const tail=new THREE.Group();
   bx(tail,TIN,0,0,-2.5,0.06,1.1,2.0);beam(tail,IRON,0,0,-0.5,0,0,-1.9,0.04);
   tail.position.set(mill[0],groundH(mill[0],mill[1])+8.6,mill[1]);tail.rotation.y=MYAW+0.3;
   tail.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(own(tail));P.draws++;}
  G.on('tick',dt=>{if(hyp(player.pos.x,player.pos.z,mill[0],mill[1])<260)fan.rotation.z-=dt*1.6;});
  const tank=pad(F.at(-2,10)[0],F.at(-2,10)[1],4,0.6),TYAW=F.yaw+0.6,kg=new THREE.Group();
  for(const sx of [-1,1])for(const sz of [-1,1]){cy(kg,T_DARK,sx*1.7,1.62,sz*1.7,0.14,3.24);beam(kg,T_MID,sx*1.7,0.4,sz*1.7,sx*0.35,3.0,sz*0.35,0.05);}
  bx(kg,T_MID,0,3.3,0,4.3,0.16,4.3);
  for(let k=0;k<9;k++)cy(kg,k%2?'#8a7a5a':'#9c8a66',0,3.55+k*0.36,0,2.05,0.36);
  cy(kg,'#6f5f44',0,6.95,0,2.16,0.18);
  put(G_DISC,'#3f6f78',1.9,1.9,1,0,6.88,0,kg,{roughness:0.15,metalness:0.3,transparent:true,opacity:0.9}).rotation.x=-Math.PI/2;
  beam(kg,IRON,1.9,3.4,0,3.3,1.05,0,0.06);
  bx(kg,T_DARK,3.7,0.45,0,1.1,0.9,3.0);bx(kg,T_MID,3.7,0.94,0,0.96,0.12,2.86);
  put(G_DISC,'#3f6f78',1.4,1.4,1,3.7,0.9,0,kg,{roughness:0.15,metalness:0.3,transparent:true,opacity:0.9}).rotation.x=-Math.PI/2;
  place(solid,kg,tank[0],tank[1],TYAW);
  collide(tank[0],tank[1],2.7);
  const tro=world(tank[0],tank[1],TYAW,3.7,0);

  /* The stage office: bleached timber, a shaded porch, and a bench nobody is on because it is
     the middle of the afternoon. */
  const office=pad(F.at(23,-5)[0],F.at(23,-5)[1],4,0.6),og=new THREE.Group();
  shack(og,BONE,4.6,3.2,3.0,1.1,2.1);roof(og,'#8a7a5c',4.6,3.2,1.1,3.0,0.5);
  for(const s of [-1,1])cy(og,T_MID,s*1.9,1.35,2.5,0.1,2.7);
  bx(og,'#9a8a68',0,2.85,2.6,4.8,0.1,2.4).rotation.x=-0.1;
  bx(og,T_MID,0,0.3,2.4,4.6,0.14,2.0);
  bx(og,T_DARK,1.3,0.74,1.9,1.5,0.1,0.44);for(const s of [-1,1])bx(og,T_DARK,1.3+s*0.6,0.42,1.9,0.1,0.58,0.42);
  place(solid,og,office[0],office[1],F.yaw+Math.PI-0.3);
  collide(office[0],office[1],2.8);
  {const g=new THREE.Group(),sp=world(office[0],office[1],F.yaw+Math.PI-0.3,-1.0,4.4);
   signboard(g,'OCHRE REACH',3.2);place(solid,g,sp[0],sp[1],F.yaw+Math.PI);}

  /* The corral, a hitching rail and the barrels and crates a trading post accumulates. */
  const corral=F.at(27,17),cpts=[];
  for(let k=0;k<=14;k++){const a=k/14*Math.PI*2*0.88+0.5;cpts.push([corral[0]+Math.cos(a)*13,corral[1]+Math.sin(a)*13]);}
  for(let k=1;k<cpts.length;k++){
   const [x0,z0]=cpts[k-1],[x1,z1]=cpts[k],mx=(x0+x1)/2,mz=(z0+z1)/2,len=Math.hypot(x1-x0,z1-z0),yaw=Math.atan2(x1-x0,z1-z0);
   cy(solid,T_MID,x1,groundH(x1,z1)+0.62,z1,0.09,1.28);
   for(const y of [0.55,1.02])bx(solid,BONE,mx,groundH(mx,mz)+y,mz,0.06,0.09,len).rotation.y=yaw;
  }
  fence(cpts);
  const rl=F.at(14,-2),rly=groundH(rl[0],rl[1]);
  for(const s of [-1,1]){const rp=world(rl[0],rl[1],F.yaw,s*2.0,0);cy(solid,T_MID,rp[0],rly+0.62,rp[1],0.1,1.26);}
  cy(solid,BONE,rl[0],rly+1.1,rl[1],0.07,4.0).rotation.set(0,F.yaw,Math.PI/2);
  {const clutter=new THREE.Group();
   for(let i=0;i<10;i++){const p0=F.at(rr(6,21),rr(-16,16)),cy0=groundH(p0[0],p0[1]);
    if(rnd()<0.5)cy(clutter,i%2?'#7d6245':'#8e7a52',p0[0],cy0+0.45,p0[1],0.42,0.9);
    else bx(clutter,'#9c8a66',p0[0],cy0+0.32,p0[1],0.8,0.64,0.7).rotation.y=rr(0,6.28);}
   solid.add(clutter);}
  /* Bleached timber and red rubble across the reach. */
  const bones=[],rocks=[];
  for(let i=0;i<32;i++){const a=rr(0,6.28),d=rr(14,72),x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>452)continue;
   bones.push({x,y:groundH(x,z)+0.14,z,sx:rr(1.4,3.4),sy:rr(0.14,0.26),sz:rr(0.14,0.26),ry:rr(0,6.28),rz:rr(-0.1,0.1),c:i%3?'#c9bda0':'#ddd3b8'});}
  scatter(G_LOG,WHITE,bones,false,200);
  /* Red rubble: a lot of small stuff, a few big blocks, and every third one a slab lying the way
     it broke. Two earlier passes were wrong in opposite directions — flattened to a fifth they
     were painted circles on the sand, and then all at one size and one shape they were a field
     of identical buns. Size goes as the square of a uniform draw so the small ones dominate. */
  for(let i=0;i<130;i++){const a=rr(0,6.28),d=rr(10,84),x=F.cx+Math.cos(a)*d,z=F.cz+Math.sin(a)*d;
   if(Math.hypot(x,z)>458)continue;
   const u=rnd(),s=0.25+u*u*1.15,slab=i%3===0;   // nothing big enough to look solid: rubble has no collider and a horse rides through it
   rocks.push({x,y:groundH(x,z)-s*(slab?0.12:0.3),z,
    sx:s*rr(0.9,1.5)*(slab?1.5:1),sy:s*rr(0.55,1.05)*(slab?0.42:1),sz:s*rr(0.9,1.5)*(slab?1.4:1),
    ry:rr(0,6.28),rx:rr(-0.28,0.28),rz:rr(-0.28,0.28),
    c:['#96512f','#7a3d26','#b3724b','#a06a44','#6d3521','#c08658'][(rnd()*6)|0]});}
  scatter(G_LUMP,WHITE,rocks,true,300);
  bake(solid,true);
  for(const m of bake(flat,false))fade(m,F.cx,F.cz,220);

  trough('ochre:tank',tro[0],tro[1],4.8,'🚰 Water your horse from the tank','🚰 % drinks from the tank trough.');
  npc({id:'qo_hollis',name:'Hollis',icon:'🤠',x:post[0]+3.6,z:post[1]+2.8,hat:'#5a4632',shirt:'#a8683a',folk:true,
   idle:'Everything on those shelves came up the wash on a mule. The price is mostly the mule.'});
  npc({id:'qo_perrin',name:'Perrin',icon:'🧑',x:tank[0]+3.8,z:tank[1]-2.4,hat:'#c9a86a',shirt:'#6a7a8a',folk:true,
   idle:'Tank holds eleven hundred gallons and the wind fills it about four days in seven. The other three we all get thoughtful.'});
  npc({id:'qo_juno',name:'Juno',icon:'👩',x:corral[0]-9.5,z:corral[1]-5.5,hat:'#8a4a2a',shirt:'#c9a86a',folk:true,
   idle:'I sell what walks in off the reach. Half of them walk back out again, so look at the feet before you look at the colour.'});

  W.mapMarkers.push({x:post[0],z:post[1],glyph:'🏪',kind:'landmark',id:'q:ochre:post'});
  W.mapMarkers.push({x:M1[0],z:M1[1],glyph:'⛰️',kind:'landmark',id:'q:ochre:mesa'});
  W.mapMarkers.push({x:arc[0],z:arc[1],glyph:'🌉',alpha:0.9,kind:'landmark',id:'q:ochre:arch'});
  for(const p of [post,bn,office,mill])W.miniMarkers.push({x:p[0],z:p[1],col:'#d97a4a',r:2.4});
  P.sites.ochre={post:[post[0]|0,post[1]|0],barn:[bn[0]|0,bn[1]|0],mill:[mill[0]|0,mill[1]|0],mesa:[M1[0]|0,M1[1]|0],arch:[arc[0]|0,arc[1]|0],corral:[corral[0]|0,corral[1]|0]};
 }

 /* ================= 12. build them, and the one per-frame pass ================= */
 for(const [name,fn] of [['amberwood',buildAmberwood],['willowmere',buildWillowmere],['frostpine',buildFrostpine],['ochre',buildOchre]])
  try{fn();}catch(e){console.error('quarter '+name,e);}
 /* One tick for the package and it does one thing: the smoke. The mill wheel, the fan, the bell
    and the mist hang their own one-line handlers off G.on('tick') beside their geometry, which
    keeps each of them next to the thing it moves. */
 G.on('tick',dt=>{try{tickSmoke(dt);tickFade(dt);}catch(e){}});

 /* The first time you ride into one of the four, say what it is rather than leaving the region
    name to carry the whole arrival. Once each, ever. */
 const ARRIVE={
  amberwood:'🍂 Amberwood — the saw is down at the mill pond and the collier is burning at the far side of the clearing.',
  willowmere:'🪻 Willowmere — mind the boardwalk. The lamps get lit from the far end back.',
  frostpine:'❄️ Frostpine Station — the warden keeps the store, and the bell goes at dusk.',
  ochre:'🏜️ Ochre Reach — the water comes off the windmill and everything else comes up the wash.'};
 G.on('region',rg=>{
  const line=rg&&ARRIVE[rg.id];if(!line)return;
  const s=S.fresh();if(!s||!S.flag(s,'q-seen-'+rg.id))return;
  S.sync(sv=>{sv.flags=sv.flags||{};sv.flags['q-seen-'+rg.id]=1;});
  setTimeout(()=>{try{toast(line);}catch(e){}},1500);
 });

 G.on('state',o=>{o.quarters={sites:P.sites,draws:P.draws,mergedFrom:P.mergedFrom,instanced:P.inst,instanceItems:P.instItems,
  buildings:P.buildings,npcs:P.npcs,things:P.things,colliders:P.colliders,moving:P.anim.length};});
}
