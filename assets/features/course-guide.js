/* Feature package 'course-guide'. Owned by that package: edit only this file and the inline hot
   spots assigned to it. See index.js for the contract. Nothing runs at import time.

   What lives here — the line on the ground that says where to go next, on every kind of round.

   A rider was told where the next obstacle was by one small gold cone floating over it. That
   cone is fine once you have found it and useless before: it is a single point in a basin that
   is six hundred metres across, it is gold on a course that may be run over autumn leaves or
   the red rock of Ochre Reach, and in first person it sits above the top of the screen for the
   last twenty metres of every approach. So the next obstacle is also a run of chevrons laid
   along the ground, tapering and brightening toward the thing you are being sent at, with a
   ring round the target itself. The cone stays exactly as it was — this package never touches
   G.course.arrow, never hides it and never draws a second one.

   Three rules it rides by.

   Where course-engine has laid a scored line, the guide follows THAT line. Events carrying
   line:true have twenty-four instanced markers along the current leg and charge a second for
   every two spent more than the tolerance off it, so a guide that routed straight to the fence
   would be inviting the rider to pay for following it. The chevrons sit on the same segment,
   including the last hop from the approach point to the fence: that point is six metres out
   along the fence's own normal and the jumping tolerance is six, so nothing on the run is ever
   further from the scored segment than the penalty allows. Where there is no scored line — the
   first leg of anything, a lap roll, show jumping, the gauntlet, a judged class — it routes
   from the rider to the target and is free to.

   It draws and it never drives. Another package marshals the rider to a start box; two
   packages moving one horse is the collision this codebase keeps producing, so nothing in here
   writes player.pos, player.heading or player.speed, and there is no hook that could.

   And it allocates nothing per frame. The chevron run is an InstancedMesh whose matrices are
   composed once per LEG, anchored to the target rather than to the rider: instance 0 always
   sits at the obstacle and the run walks backwards from it, so riding the leg changes only the
   instance count. A frame costs one projection onto a three-point polyline, an integer, and two
   opacity writes. ranch3d.html:8066 records what the last piece of per-frame geometry in this
   game cost; this one is answered before it is asked. */
export const id='course-guide';
export function install(G){
 const THREE=G.THREE, $=G.$, W=G.world, player=G.horse&&G.horse.player;
 if(!THREE||!G.scene||!W||!player)return;                 // nothing to draw on or nobody to draw for
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const groundH=(x,z)=>{try{const h=W.groundH(x,z);return h===h?h:0;}catch(e){return 0;}};

 /* ---------------------------------------------------------------- the look ------------- */
 /* Six biomes and four seasons of ground under one ribbon: meadow green, farm stubble, forest
    floor, marsh, the snow of Frostpine and the red rock of Ochre Reach, plus whatever the
    season has scattered over them. No single colour survives all of that, so the chevron is
    two-tone — a near-black rim under a cyan-to-white core. The rim carries the contrast on pale
    ground and the core carries it on dark, and cyan is the one hue the valley never grows.
    toneMapped:false keeps ACES from pulling the bright end back down into the grass. */
 const MAXC=40;                                           // the most chevrons a leg is ever given
 const PAD=1.2;                                           // the nearest one stops short of the obstacle
 const LIFT=0.105;                                        // above course-engine's own 0.06 markers
 const FADE_IN=0.45, FADE_OUT=0.32;
 const C_NEAR=new THREE.Color(0xeafdff), C_FAR=new THREE.Color(0x0d9ad2);
 function chevronGeo(w,d,t,lift){
  /* A flat V lying in the ground plane and pointing along local +Z, six points and four
     triangles, written out rather than extruded so the whole thing is one small buffer.
     DoubleSide because a first-person eye can meet it nearly edge on and nobody should have to
     reason about winding for a decal. */
  const p=[[-w,lift,-d],[0,lift,d],[w,lift,-d],[w,lift,-d-t],[0,lift,d-t],[-w,lift,-d-t]];
  const tri=[0,1,4,0,4,5,1,2,4,2,3,4];
  const pos=new Float32Array(tri.length*3), nrm=new Float32Array(tri.length*3);
  for(let i=0;i<tri.length;i++){const q=p[tri[i]];pos[i*3]=q[0];pos[i*3+1]=q[1];pos[i*3+2]=q[2];nrm[i*3+1]=1;}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.BufferAttribute(nrm,3));
  return g;
 }
 const coreGeo=chevronGeo(0.95,0.62,0.52,0), rimGeo=chevronGeo(1.25,0.92,0.94,-0.03);
 const coreMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const rimMat=new THREE.MeshBasicMaterial({color:0x061419,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const core=new THREE.InstancedMesh(coreGeo,coreMat,MAXC), rim=new THREE.InstancedMesh(rimGeo,rimMat,MAXC);
 core.count=rim.count=0; core.renderOrder=3; rim.renderOrder=2;
 /* An InstancedMesh works out its bounding sphere once and keeps it, and these instances move to
    a different town between courses — so culling is turned off rather than left to a stale
    sphere that would blink the whole run out of existence at the Barleyfold arena. */
 core.frustumCulled=rim.frustumCulled=false;
 core.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(MAXC*3),3);
 G.scene.add(rim); G.scene.add(core);
 /* The target end gets a ring on the ground as well as the run pointing at it, because "which
    end of this line am I meant to be going to" is the one question a line cannot answer by
    itself. It is on the floor and the arrow is three metres up, so the two read as one sign
    rather than as two. */
 const ringLitMat=new THREE.MeshBasicMaterial({color:0xf2feff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const ringDarkMat=new THREE.MeshBasicMaterial({color:0x061419,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const ringLitGeo=new THREE.RingGeometry(1.62,2.02,30), ringDarkGeo=new THREE.RingGeometry(1.46,2.2,30);
 ringLitGeo.rotateX(-Math.PI/2); ringDarkGeo.rotateX(-Math.PI/2);
 const ring=new THREE.Group(), ringDark=new THREE.Mesh(ringDarkGeo,ringDarkMat), ringLit=new THREE.Mesh(ringLitGeo,ringLitMat);
 ringDark.position.y=-0.03; ringDark.renderOrder=2; ringLit.renderOrder=3;
 ring.add(ringDark); ring.add(ringLit); ring.visible=false; ring.frustumCulled=false; G.scene.add(ring);

 /* ---------------------------------------------------------------- the readout ---------- */
 /* G.ui has panels, dock buttons, tabs and wallet chips, and nothing that owns the course HUD —
    so rather than float a box of its own over a screen that already carries five, the distance
    goes into #courseHud itself, as a second span beside the one course-engine and
    events2-disciplines both rewrite every frame. Neither of them touches anything but
    #courseHudTxt.textContent, so the two never collide. */
 const hudBox=$('courseHud'), hudTxt=$('courseHudTxt');
 let distEl=null;
 if(hudBox&&hudTxt&&!document.getElementById('cgDist')){
  const st=document.createElement('style');
  st.textContent='#cgDist{font-variant-numeric:tabular-nums;font-size:13px;font-weight:700;opacity:.82;letter-spacing:.01em;white-space:nowrap}';
  document.head.appendChild(st);
  distEl=document.createElement('span'); distEl.id='cgDist'; distEl.style.display='none'; hudTxt.after(distEl);
 }

 /* ---------------------------------------------------------------- the spine ------------ */
 /* SP is the leg being ridden, as a polyline of at most three points with its arc lengths.
    Everything is a plain array reused in place; the only new objects made after install are the
    ones THREE hands back. */
 const SP={wx:[0,0,0],wz:[0,0,0],cum:[0,0,0],ang:[0,0],n:0,len:0,spacing:3,built:0,
  mode:-1,a:-1,b:-1,free:true};
 const _v=new THREE.Vector3(), _q=new THREE.Quaternion(), _sc=new THREE.Vector3(1,1,1), _m=new THREE.Matrix4(), _up=new THREE.Vector3(0,1,0), _col=new THREE.Color();
 const _p={x:0,z:0,a:0}, _pr={s:0,d:0};
 function segAt(s){
  s=clamp(s,0,SP.len);
  let i=0; while(i<SP.n-2&&SP.cum[i+1]<s)i++;
  const t=(s-SP.cum[i])/Math.max(0.001,SP.cum[i+1]-SP.cum[i]);
  _p.x=SP.wx[i]+(SP.wx[i+1]-SP.wx[i])*t; _p.z=SP.wz[i]+(SP.wz[i+1]-SP.wz[i])*t; _p.a=SP.ang[i];
 }
 function project(x,z){
  let bd=1e9,bs=0;
  for(let i=0;i<SP.n-1;i++){
   const ax=SP.wx[i],az=SP.wz[i],dx=SP.wx[i+1]-ax,dz=SP.wz[i+1]-az,l2=dx*dx+dz*dz||1;
   let t=((x-ax)*dx+(z-az)*dz)/l2; t=t<0?0:t>1?1:t;
   const qx=ax+dx*t-x,qz=az+dz*t-z,d=qx*qx+qz*qz;
   if(d<bd){bd=d;bs=SP.cum[i]+t*Math.sqrt(l2);}
  }
  _pr.s=bs; _pr.d=Math.sqrt(bd);
 }
 const STATS={lays:0};
 function layGuide(P){
  SP.n=P.n; SP.free=!P.scored;
  let len=0;
  for(let i=0;i<P.n;i++){
   SP.wx[i]=P.pts[i][0]; SP.wz[i]=P.pts[i][1]; SP.cum[i]=len;
   if(i<P.n-1){const dx=P.pts[i+1][0]-P.pts[i][0],dz=P.pts[i+1][1]-P.pts[i][1];SP.ang[i]=Math.atan2(dx,dz);len+=Math.hypot(dx,dz);}
  }
  SP.cum[P.n-1]=len; SP.len=len;
  /* The spacing opens out on a long leg so the run always reaches back to the rider rather than
     giving up forty chevrons short of her, and closes to two and a half metres on a short one. */
  SP.spacing=clamp((len-PAD)/(MAXC-1),2.45,12);
  SP.built=clamp(Math.floor((len-PAD)/SP.spacing)+1,0,MAXC);
  if(SP.built<=0){core.count=rim.count=0;STATS.lays++;return;}
  /* The ramp is spread over the run that was actually built rather than over the forty slots the
     mesh could hold, so a twelve-metre leg between two fences tapers and cools exactly as much as
     a sixty-metre one down a race track. Colours are written here, once a leg, beside the
     matrices — never in the tick. */
  const span=Math.max(1,SP.built-1);
  for(let i=0;i<SP.built;i++){
   const s=len-PAD-i*SP.spacing; segAt(s);
   /* the taper: widest and whitest at the obstacle, narrowing and cooling to cyan back toward the
      rider, which is what says which end of this line is the end you are being sent to */
   const k=i/span, sc=1.3-0.52*k;
   /* The ground is asked at the chevron's own feet rather than interpolated from a table of
      samples down the leg: forty lookups into the terrain grid is the cheaper of the two anyway,
      and on the rolling ground at Barleyfold the interpolated version sat centimetres proud of
      the grass, which on a decal is the difference between painted on and hovering. */
   _v.set(_p.x,groundH(_p.x,_p.z)+LIFT,_p.z); _q.setFromAxisAngle(_up,_p.a); _sc.set(sc,1,sc);
   _m.compose(_v,_q,_sc); core.setMatrixAt(i,_m); rim.setMatrixAt(i,_m);
   _col.lerpColors(C_NEAR,C_FAR,k); core.setColorAt(i,_col);
  }
  core.instanceMatrix.needsUpdate=rim.instanceMatrix.needsUpdate=core.instanceColor.needsUpdate=true;
  STATS.lays++;
 }

 /* ---------------------------------------------------------------- reading the course --- */
 /* PL is filled in place every frame; a plan that allocated its own waypoints would be three
    arrays and a string of garbage sixty times a second for the length of a cross country run. */
 const PL={pts:[[0,0],[0,0],[0,0]],n:0,tx:0,tz:0,scored:false,mode:-1,a:-1,b:-1,ok:false};
 function plan(c){
  PL.ok=false;
  if(!c)return PL;
  /* A judged class has no fences: the next thing asked for is a letter, and ARENA_LETTERS is
     read live because events2-disciplines moves the whole arena to the town on the card. */
  if(c.dressage){
   if(c.done||!c.figs)return PL;
   const f=c.figs[c.fi]; if(!f)return PL;
   const AL=G.course.ARENA_LETTERS, at=AL&&AL[f.at]; if(!at)return PL;
   PL.pts[0][0]=player.pos.x; PL.pts[0][1]=player.pos.z; PL.pts[1][0]=at[0]; PL.pts[1][1]=at[1];
   PL.n=2; PL.tx=at[0]; PL.tz=at[1]; PL.scored=false; PL.mode=0; PL.a=c.fi|0; PL.b=0; PL.ok=true;
   return PL;
  }
  const j=c.jumps&&c.jumps[c.idx]; if(!j)return PL;
  const S=c.ce, lap=(S&&S.lap)||1;
  const L=S&&S.line&&c.idx>0?S.line[c.idx]:null;    // the same condition course-engine lays and penalises on
  if(L){
   PL.pts[0][0]=L.x1; PL.pts[0][1]=L.z1; PL.pts[1][0]=L.x2; PL.pts[1][1]=L.z2; PL.n=2;
   /* a fence's scored leg ends six metres out; the run carries on to the rails themselves so the
      last thing a rider sees is the take-off, and that hop is inside the tolerance by geometry */
   if(Math.hypot(j.x-L.x2,j.z-L.z2)>0.5){PL.pts[2][0]=j.x;PL.pts[2][1]=j.z;PL.n=3;}
   PL.scored=true; PL.mode=1;
  }else{
   PL.pts[0][0]=player.pos.x; PL.pts[0][1]=player.pos.z; PL.pts[1][0]=j.x; PL.pts[1][1]=j.z; PL.n=2;
   PL.scored=false; PL.mode=2;
  }
  PL.tx=j.x; PL.tz=j.z; PL.a=lap; PL.b=c.idx|0; PL.ok=true;
  return PL;
 }

 /* ---------------------------------------------------------------- per frame ------------ */
 let fade=0, lastCourse=null, closing=false, reT=0, hudT=0, enabled=true, broke=0;
 let tx=null, tz=null;                                    // where the guide is currently pointing
 /* A new course means a new first leg whatever the indices happen to say, and the finish means
    the ribbon should already be going before cancelCourse pulls the course object out from under
    it on the next turn of the loop. */
 G.on('courseStart',()=>{SP.mode=-1;SP.a=-1;SP.b=-1;closing=false;STATS.lays=0;});
 /* Sister packages replay a finish without a live course object to re-pay a round; only the
    finish of the course actually being ridden should take the ribbon down. */
 G.on('courseFinish',o=>{const c=o&&o.c;if(!c||c===G.course.get())closing=true;});
 function hide(){
  core.count=rim.count=0; core.visible=rim.visible=ring.visible=false; tx=tz=null;
  if(distEl&&distEl.style.display!=='none')distEl.style.display='none';
 }
 G.on('tick',(dt,t)=>{
  if(broke>2)return;
  try{
   if(!enabled){if(fade!==0){fade=0;hide();}return;}
   const c=G.course.get();
   if(lastCourse!==c){lastCourse=c;SP.mode=-1;SP.a=-1;SP.b=-1;if(c)closing=false;}
   const P=c&&!closing?plan(c):null;
   const want=!!(P&&P.ok);
   fade=clamp(fade+(want?dt/FADE_IN:-dt/FADE_OUT),0,1);
   if(!want&&fade<=0){hide();return;}
   if(want){
    let redo=P.mode!==SP.mode||P.a!==SP.a||P.b!==SP.b;
    /* A free route is anchored where the rider was standing when it was drawn. Once she has
       drifted off it the line is pointing from somewhere she is not, so it is re-laid — rate
       limited, because laying it is the only thing in this package that costs anything. */
    reT+=dt;
    if(!redo&&!P.scored&&reT>0.12){reT=0;project(player.pos.x,player.pos.z);if(_pr.d>1.6)redo=true;}
    if(redo){SP.mode=P.mode;SP.a=P.a;SP.b=P.b;reT=0;layGuide(P);}
    tx=P.tx; tz=P.tz;
   }
   /* Riding the leg costs one projection and an integer: the matrices are already where they
      belong, so all that changes is how many of them are drawn. */
   if(SP.built>0&&tx!==null){
    project(player.pos.x,player.pos.z);
    const n=clamp(Math.floor((SP.len-PAD-_pr.s-0.8)/SP.spacing)+1,0,SP.built);
    core.count=rim.count=n;
   }
   const vis=fade>0.01;
   core.visible=rim.visible=vis&&core.count>0; ring.visible=vis&&tx!==null;
   const pulse=0.86+0.14*Math.sin(t*3.2);
   coreMat.opacity=0.95*fade*pulse; rimMat.opacity=0.62*fade;
   ringLitMat.opacity=0.9*fade*pulse; ringDarkMat.opacity=0.62*fade;
   if(ring.visible){ring.position.set(tx,groundH(tx,tz)+LIFT,tz);const k=1+0.075*Math.sin(t*3.2);ring.scale.set(k,1,k);}
   /* The readout is eight times a second, not sixty: it is a number of metres and nobody can
      read the second decimal of one at a gallop. */
   hudT+=dt;
   if(distEl&&hudT>0.12){
    hudT=0;
    if(vis&&tx!==null){const d=Math.hypot(player.pos.x-tx,player.pos.z-tz);
     distEl.textContent='· 📍 '+(d<10?d.toFixed(1):String(Math.round(d)))+' m';
     if(distEl.style.display!=='')distEl.style.display='';}
    else if(distEl.style.display!=='none')distEl.style.display='none';
   }
  }catch(e){broke++;if(broke===1)console.warn('course-guide stood down',e);hide();}
 });

 /* ---------------------------------------------------------------- state + handles ------ */
 G.on('state',o=>{
  o.guide={on:fade>0.01,fade:+fade.toFixed(2),chevrons:core.count,built:SP.built,
   spacing:+SP.spacing.toFixed(2),legLen:+SP.len.toFixed(1),onScoredLine:!SP.free&&SP.n>0,
   lays:STATS.lays,target:tx===null?null:[+tx.toFixed(1),+tz.toFixed(1)],
   dist:tx===null?null:+Math.hypot(player.pos.x-tx,player.pos.z-tz).toFixed(1),
   readout:distEl&&distEl.style.display!=='none'?distEl.textContent:null};
 });
 /* Handles for QA and for anyone who needs the guide out of the way (a cinematic, a timing run).
    setEnabled is the honest way to measure what the ribbon costs: the same page, the same
    course, the feature on and off. */
 G.courseGuide={core,rim,ring,SP,STATS,plan,
  mats:{core:coreMat,rim:rimMat,ringLit:ringLitMat,ringDark:ringDarkMat},
  setEnabled(b){enabled=!!b;if(!enabled){fade=0;hide();}},
  isEnabled:()=>enabled,isOn:()=>fade>0.01,fadeNow:()=>fade,
  target:()=>tx===null?null:[tx,tz],
  chevronAt(i){if(i<0||i>=core.count)return null;core.getMatrixAt(i,_m);return [_m.elements[12],_m.elements[13],_m.elements[14]];},
 };
}
