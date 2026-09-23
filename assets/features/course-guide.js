/* Feature package 'course-guide'. Owned by that package: edit only this file and the inline hot
   spots assigned to it. See index.js for the contract. Nothing runs at import time.

   What lives here — the line on the ground that says where to go next, on every kind of round,
   and the follow camera that decides what the rider is looking at while she rides it. Two halves
   of one question: where am I being sent, and can I see anything. The camera is the second
   section of this file and keeps entirely to itself — its own state, its own hooks, and no line
   of it touches the guide.

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
 const NEAR=0.8;                                          // ...and the run stops short of the horse: nothing is drawn under her nose
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

 /* ---------------------------------------------------------------- the takeoff window --- */
 /* Jumping in this game has always been a timing skill and has never once said so. The rails
    are judged on the horse's height as she crosses them — under 0.4 m knocks them down — and
    that height is decided entirely by WHEN the rider pressed jump. course-engine grades the
    crossing off heroJumpAge and has done all along: 0.58-0.96 s from take-off is 'perfect',
    0.42-1.12 s is 'good', anything else is early or late. So the skill, the window and the
    grades are all real; the only thing missing was any way to see the window before committing
    to it. A rider could ride a hundred rounds and never learn what she was doing differently on
    the clears, because the feedback arrived after the decision and never named the cause.

    So: a ring over the fence that says press NOW. Take-off is the press, and the crossing comes
    one flight-time later, so pressing at range d and speed v lands the crossing at age d/v —
    which is exactly the number course-engine is about to grade. The bands below are ITS bands,
    read straight off gradeCrossing rather than retuned here; if that function is ever
    rebalanced this ring must be corrected with it or it will start lying. Green is the perfect
    window, amber the wider clear, and red is everything that ends in rails on the floor. */
 const TO_PERFECT=[0.58,0.96], TO_GOOD=[0.42,1.12];   // seconds of flight — course-engine's gradeCrossing
 const TO_SHOW=2.2;                                   // start showing it about two strides out
 const C_PERFECT=0x4ade5e, C_GOOD=0xf0b429, C_MISS=0xe4574c;
 const reticleTex=(()=>{
  const cv=document.createElement('canvas'); cv.width=cv.height=128;
  const g=cv.getContext('2d');
  g.strokeStyle='#fff'; g.lineWidth=15; g.beginPath(); g.arc(64,64,44,0,Math.PI*2); g.stroke();
  g.strokeStyle='rgba(0,0,0,0.55)'; g.lineWidth=4;
  g.beginPath(); g.arc(64,64,52,0,Math.PI*2); g.stroke();
  g.beginPath(); g.arc(64,64,36,0,Math.PI*2); g.stroke();
  const t=new THREE.CanvasTexture(cv); t.needsUpdate=true; return t;
 })();
 const reticleMat=new THREE.SpriteMaterial({map:reticleTex,transparent:true,opacity:0,depthWrite:false,depthTest:false,toneMapped:false});
 const reticle=new THREE.Sprite(reticleMat);
 reticle.renderOrder=6; reticle.visible=false; reticle.frustumCulled=false; reticle.scale.set(1.5,1.5,1);
 G.scene.add(reticle);
 let toGrade='';                                      // what the ring is saying this frame, for QA
 /* Where the ring sits and what colour it is. Returns '' when there is nothing to time. */
 function tickReticle(dt,t){
  let show='';
  try{
   const c=G.course.get();
   const j=c&&!c.dressage&&c.jumps?c.jumps[c.idx]:null;
   /* nothing to time while she is already in the air — the decision has been made */
   if(j&&enabled&&player.y<0.05){
    const d=Math.hypot(player.pos.x-j.x,player.pos.z-j.z);
    const v=Math.abs(player.speed||0);
    const tc=v>0.8?d/v:99;                            // at a standstill there is no window to show
    if(tc<=TO_SHOW){
     show=(tc>=TO_PERFECT[0]&&tc<=TO_PERFECT[1])?'perfect':(tc>=TO_GOOD[0]&&tc<=TO_GOOD[1])?'good':'miss';
     reticleMat.color.setHex(show==='perfect'?C_PERFECT:show==='good'?C_GOOD:C_MISS);
     /* it tightens as the window closes, so the eye is drawn to the moment and not the ring */
     const k=show==='perfect'?1.25+0.1*Math.sin(t*9):show==='good'?1.45:1.7;
     reticle.scale.set(k,k,1);
     reticleMat.opacity=show==='miss'?0.55:0.95;
     reticle.position.set(j.x,groundH(j.x,j.z)+2.35,j.z);
    }
   }
  }catch(e){}
  reticle.visible=!!show; toGrade=show;
 }


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
 const SP={wx:[0,0,0],wz:[0,0,0],cum:[0,0,0],ang:[0,0],n:0,len:0,spacing:3,built:0,pad:PAD,
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
     giving up forty chevrons short of her, and closes right down on a short one.

     A fixed 2.45 m floor and a fixed 1.2 m pad were fine while every leg was a hack to the next
     fence, and stopped reading the moment judged classes arrived: a test's first leg is the walk
     in from the start to A, three to seven metres, and a three-metre leg came out as ONE chevron
     sitting 1.2 m from the letter. One mark is not a line — it says nothing about direction, it
     is the same picture whichever way the arena faces, and there is no far end of it to be at the
     rider. So: count first, then divide. Three is the fewest that draws a direction, the pad
     gives way on a short leg rather than eating half of it, and the spacing is whatever makes the
     run span from the rider to a stride short of the target. On anything long enough to have
     wanted 2.45 m this lands on the same numbers it always did. */
  const pad=Math.min(PAD,len*0.25), usable=len-pad;
  SP.pad=pad;
  SP.spacing=clamp(usable/(MAXC-1),2.45,12);
  SP.built=clamp(Math.floor(usable/SP.spacing)+1,0,MAXC);
  /* Only a leg too short to hold three at 2.45 m is re-divided; every leg that could already is
     laid on exactly the numbers it was before, down to the last decimal. The short one is divided
     over the span that will actually be DRAWN rather than the whole leg: the ride pass below
     keeps NEAR metres clear under the horse, so a third chevron laid behind that line is built
     and then immediately culled, which is how a re-divided leg still came out as one mark. */
  if(usable>NEAR+0.65&&SP.built<3){SP.built=3;SP.spacing=(usable-NEAR-0.05)/2;}   // the 5 cm keeps the last one clear of the cull as she rolls forward
  if(SP.built<=0||usable<=0){core.count=rim.count=0;STATS.lays++;return;}
  /* The ramp is spread over the run that was actually built rather than over the forty slots the
     mesh could hold, so a twelve-metre leg between two fences tapers and cools exactly as much as
     a sixty-metre one down a race track. Colours are written here, once a leg, beside the
     matrices — never in the tick. */
  const span=Math.max(1,SP.built-1);
  for(let i=0;i<SP.built;i++){
   const s=usable-i*SP.spacing; segAt(s);
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
  reticle.visible=false; toGrade='';
  if(distEl&&distEl.style.display!=='none')distEl.style.display='none';
 }
 G.on('tick',(dt,t)=>{
  if(broke>2)return;
  /* ahead of every early return below: the take-off ring is about the NEXT fence, not about
     whether the line to it happens to be drawn, and a ring left burning over a fence the rider
     has already jumped is worse than no ring at all. */
  tickReticle(dt,t);
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
    const n=clamp(Math.floor((SP.len-SP.pad-_pr.s-NEAR)/SP.spacing)+1,0,SP.built);
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
   takeoff:toGrade||null,takeoffShown:reticle.visible,
   spacing:+SP.spacing.toFixed(2),legLen:+SP.len.toFixed(1),onScoredLine:!SP.free&&SP.n>0,
   lays:STATS.lays,target:tx===null?null:[+tx.toFixed(1),+tz.toFixed(1)],
   dist:tx===null?null:+Math.hypot(player.pos.x-tx,player.pos.z-tz).toFixed(1),
   readout:distEl&&distEl.style.display!=='none'?distEl.textContent:null};
 });
 /* Handles for QA and for anyone who needs the guide out of the way (a cinematic, a timing run).
    setEnabled is the honest way to measure what the ribbon costs: the same page, the same
    course, the feature on and off. */
 G.courseGuide={core,rim,ring,reticle,SP,STATS,plan,
  takeoff:()=>toGrade||null,TO_PERFECT,TO_GOOD,TO_SHOW,
  mats:{core:coreMat,rim:rimMat,ringLit:ringLitMat,ringDark:ringDarkMat},
  setEnabled(b){enabled=!!b;if(!enabled){fade=0;hide();}},
  isEnabled:()=>enabled,isOn:()=>fade>0.01,fadeNow:()=>fade,
  target:()=>tx===null?null:[tx,tz],
  chevronAt(i){if(i<0||i>=core.count)return null;core.getMatrixAt(i,_m);return [_m.elements[12],_m.elements[13],_m.elements[14]];},
 };

 /* ================================================================ the follow camera ===== */
 /* The other half of telling a rider where she is: where she is SEEN from.

    The built-in rig sits 6.0 m behind the horse on her exact centreline and 2.35 m up, and it
    never moves. Measured on the arena sand at a halt, the horse's own bounding box covers 44%
    of the frame, centred, and every bit of that 44% is hindquarters, tail and the back of the
    rider's coat. You cannot see the horse's head, her shoulder, her expression or her gait —
    the three things the whole game is about — and at a gallop the animal is a brown lozenge in
    the middle of the picture with the world hidden behind it. The one genuinely handsome frame
    in a whole screenshot set was an accident: mid-turn, the rig had not caught up with the
    heading yet and the horse was briefly in three-quarter view. So this package makes that
    accident the rule.

    Four things, and nothing else:

    The eye goes back, up and ROUND. It sits about thirty degrees off the spine, so we are
    looking across her rather than up her tail: shoulder, barrel, head and the far hind leg all
    read, and the tail stops being a vertical smear down the middle of the screen. She sits a
    little left of centre with the world she is riding into open on the right.

    It aims ABOVE and AHEAD of her, not at her. That is what puts the horse in the lower third
    and the horizon where a landscape wants it. The look-ahead lengthens with speed, so a
    gallop shows you more of what is coming and a halt shows you more of your horse.

    It breathes. Distance, pitch, orbit angle and field of view all ride one eased speed
    number: closer and higher at a halt, further back and flatter at a gallop, wider lens with
    it. Nothing in here steps — every one of those is a first-order filter, and the speed
    number itself climbs faster than it falls so that pulling up feels like settling rather
    than like the camera chasing you.

    And the heading it is built on LAGS the horse's. That is the cornering feel: turn and the
    eye swings wide while the aim swings the other way, into the turn. The lag is self-limiting
    — the harder she turns the harder the filter pulls — and hard-clamped besides, so a spin on
    the spot can never end up broadside.

    Terrain and buildings are not this package's problem to solve twice: followCamera.frame()
    already sweeps the clearance volume against the registered architecture and orbits round
    what it finds, and resolve() rechecks the interpolated position afterwards, which is what
    stops a corner from being cut through a barn wall. Both are called here, on the same
    contract — with two differences that the longer arm forced and that are argued where they
    happen: the sweep is anchored on the horse rather than on the aim point, and the recheck is
    applied at a bounded speed instead of all at once.

    What it does NOT fix, and cannot from here: trees. followCamera only knows the architecture
    somebody registered with it, and the valley's tree canopies are registered with nothing at
    all, so a canopy can sit between the eye and the horse and neither rig will move for it.
    That hole is the built-in one's too — in a before-and-after pair shot on the same wooded
    path, the old camera's frame is 55% flat green tree with the horse nowhere in it, and this
    one at least has her in shot behind leaves. It wants either canopy volumes registered, or
    foliage that fades when the eye is inside it. Both live in files this package does not own.

    ---- yielding ----------------------------------------------------------------------------
    'camera' is the hook this codebase has most reason to be careful with. G.run does NOT stop
    at the first truthy hook — it runs every one of them and returns the first truthy RESULT —
    and course-guide installs twenty-first, after all four packages that already own the camera
    somewhere. Returning true unconditionally would therefore not "win" the camera, it would
    silently stamp on first person, the grandstand, the ferry and the balloon, and spectating,
    every one of which had already placed the eye microseconds earlier in the same G.run.

    So this yields two ways round. First, by asking each of them directly: course-engine puts
    'fpv' on the body, world exposes G.worldPkg.vehicle(), social-play exposes G.social.spectate
    as a live getter. events-pvp's grandstand is the one with no live getter at all, and its
    seat is unreachable in the built world anyway (social-play splices the thing out and keeps
    one stand), so the only door left into it is the G.events.setSpectate it publishes for QA —
    which is read here, not changed. Second, and for anything that arrives later: the camera's
    position is noted at the end of every frame, and if it has already moved by the time this
    hook runs then somebody earlier in the list is driving and this one stands down. That net
    catches a package nobody has written yet. VR, the summon stall and free-cam need no check —
    they are branches ABOVE the G.run in ranch3d.html, so the hook is never called at all.

    Drag-to-look is answered here rather than deferred to, because camYaw/camPitch/camDist are
    locals of ranch3d.html that no package can read. The listeners below are deliberate copies
    of the built-in ones — same element, same one-pointer rule, same clamps — so a thumb on the
    on-screen stick still never reaches them; the built-in's copy of the state goes unused
    while this rig owns the eye, and is recomputed from scratch the moment it does not. */

 const CAM={
  /* the rig at a halt, and how far each number travels by a flat gallop */
  dist:5.4,   distSp:0.8,                                // metres along the slant from horse to eye. 8.3 made the horse a small thing in a big field; laid beside the reference she needed to be ~1.35x larger again
  pitch:0.30, pitchSp:-0.08,                             // radians above the horizon; flatter at speed (was 0.40: looked down on her, and horizon-high like the reference is 0.30)
  off:0.16,   offSp:-0.04,                               // RADIANS round the horse, not metres — see below
  lookY:1.70, lookYSp:0.30,                              // aim this far above her feet — puts her low in frame
  LOOK_MIN:1.18,                                         // and this far when a wall has squeezed the shot in
  lead:3.20,  leadSp:4.20,                               // and this far along where she is actually going
  fov:52,     fovSp:5.5,
  GALLOP:11.5,                                           // the speed that counts as "all of it"
  LAG:3.1, LAG_GAIN:3.0, LAG_MAX:0.80,                   // heading filter: rate, self-limit, hard clamp
  BIAS:0.72, LOOK_INTO:0.45, LEAD_TIGHT:0.60,            // how a corner is shared out — see below
  EASE:5.0, LOOK_EASE:7.0, UP:2.4, DOWN:1.15,            // position, look point, and the speed number
  OCC_IN:18, OCC_OUT:9, TUCK:0.14,                       // metres a second the obstruction pull may move the eye
  ZOOM_MIN:0.62, ZOOM_MAX:1.75, SNAP:60,                 // wheel range, and the jump that warrants a cut
 };
 /* Why 'off' is an angle. The first go at this put the eye a fixed number of METRES off the
    spine, and on screen it did almost nothing: 2.1 m at 6 m back is 19° round the horse, which
    is still a rear view with a hint of flank. What makes an animal read as an animal is the
    angle you see it from, and that angle is what a lateral offset stops controlling the moment
    the distance changes. Sweeping the eye round the horse by a fixed 30° instead holds the
    three-quarter at a halt, at a gallop, zoomed in and zoomed out, and it is one addition to
    the orbit angle rather than a second basis vector to get the sign of wrong (which, for the
    record, is exactly what happened: the first version had the horse on the wrong side).

    That sweep was 0.52 rad — a fixed thirty degrees — and everything below is still written
    for it. It is nine degrees now, because the owner of this game plays it and said the camera
    veers off to the side. Thirty is a lovely still and a poor thing to steer from: the horse
    you are aiming is not where the stick says she is, and every fence is met at an angle you
    did not choose. Nine keeps her fractionally off dead centre — enough that her head is not
    sitting on the vanishing point, enough that the corner swing below never visibly flips from
    one shoulder to the other — while what you see down her neck is where she is actually
    going. Raise it back toward 0.5 for the cinematic framing; nothing else in the rig changed
    and a corner is still shared out exactly as described.

    Why a corner is shared out three ways. A camera that simply lagged the heading swings to the
    OUTSIDE of a right-hand turn and gets a glorious near-broadside — and swings straight
    through the spine on a left-hand one and ends up looking up her tail, which is the very
    thing this is here to fix. So BIAS gives most of the turn back to the orbit angle, leaving
    about a quarter of it as a visible swing; the three-quarter then only breathes between
    roughly 16° and 41° instead of crossing zero. LOOK_INTO swings the aim into the turn, and
    LEAD_TIGHT shortens the look-ahead as the turn tightens, because in a tight turn you are not
    going anywhere far ahead and a long lead would drag the horse off the side of the frame. */
 /* live state: the eased speed number, the lagging heading, and the player's own look-around */
 const F={u:0,head:null,yaw:0,pitch:0,zoom:1,occ:1,drag:null,placed:false,own:false,broke:0,frames:0};
 const _eye=new THREE.Vector3(), _look=new THREE.Vector3(), _anchor=new THREE.Vector3();
 const _raw=new THREE.Vector3(), _tmp=new THREE.Vector3();
 const _seen=new THREE.Vector3(NaN,NaN,NaN);

 /* Copies of ranch3d.html's own orbit listeners, for the reason in the header. One pointer id
    only: on a phone the second thumb arriving is the normal case, and without the id test it
    overwrites the drag origin and the view lurches every time either thumb moves.

    And a drag only counts while this rig is the one driving. The built-in listener has the same
    rule — it hands a drag straight to freeCam and returns — but this copy originally only
    checked first person, so a pan in photo mode, a look round from the grandstand or a spin in
    the balloon basket was quietly winding up F.yaw the whole time. Measured: entering the free
    camera, panning 400 px and pressing C to come back left the follow rig at yaw -2.16 rad, so
    the rider was suddenly being watched from 124 degrees round the wrong side of her own
    horse — and at a halt nothing unwinds it, because the unwind only runs above 0.6 m/s. The
    test goes in pointermove as well as pointerdown, since photo mode can be entered with the
    button held. */
 const dragBlocked=()=>{try{return foreignCam()||(G.cam&&G.cam.isFree());}catch(e){return false;}};
 if(G.renderer&&G.renderer.domElement)G.renderer.domElement.addEventListener('pointerdown',e=>{
  if(F.drag||dragBlocked())return;
  F.drag={id:e.pointerId,x:e.clientX,y:e.clientY};
 });
 addEventListener('pointermove',e=>{
  if(!F.drag||e.pointerId!==F.drag.id)return;
  if(dragBlocked()){F.drag.x=e.clientX;F.drag.y=e.clientY;return;}   // follow the pointer, move nothing
  F.yaw-=(e.clientX-F.drag.x)*0.006;
  F.pitch=clamp(F.pitch+(e.clientY-F.drag.y)*0.004,-0.30,0.62);
  F.drag.x=e.clientX;F.drag.y=e.clientY;
 });
 const camDragEnd=e=>{if(F.drag&&(!e||e.pointerId===F.drag.id))F.drag=null;};
 addEventListener('pointerup',camDragEnd);
 addEventListener('pointercancel',camDragEnd);
 addEventListener('wheel',e=>{F.zoom=clamp(F.zoom+e.deltaY*0.0014,CAM.ZOOM_MIN,CAM.ZOOM_MAX);},{passive:true});

 /* events-pvp's grandstand is the one camera owner with no live getter. Wrap the entry point
    it publishes so the flag is honest, rather than guess from the outside. Read-only: the
    original is still what does the work. */
 let pvpSeat=false;
 try{
  const ev=G.events;
  if(ev&&typeof ev.setSpectate==='function'){
   const orig=ev.setSpectate;
   ev.setSpectate=on=>{pvpSeat=!!on;return orig(on);};
  }
 }catch(e){}
 function foreignCam(){
  if(pvpSeat)return true;                                                      // events-pvp, the grandstand
  if(document.body.classList.contains('fpv'))return true;                      // course-engine, first person
  if(document.body.classList.contains('se-ov-open'))return true;               // se-care, the Horse Overview
  if(document.body.classList.contains('on-foot'))return true;                  // on-foot, walking beside the horse
  try{if(G.worldPkg&&G.worldPkg.vehicle&&G.worldPkg.vehicle())return true;}catch(e){}   // world, ferry or balloon
  try{if(G.social&&G.social.spectate)return true;}catch(e){}                   // social-play, watching a rider
  return false;
 }
 /* The whole of the safety net, in one line. 'tick' runs a couple of hundred lines before the
    camera block, so the position noted here is where the eye finished LAST frame: if it has
    moved by the time the 'camera' hook runs, somebody earlier in the same G.run moved it and
    this rig is not the owner. And ownership is CLEARED here rather than only set in the hook,
    because VR, the summon cinematic and free-cam are branches above the G.run where the hook is
    never called at all — a flag that only ever got set would go on claiming this rig was
    driving a camera it had not touched in ten seconds. */
 /* ---- the wood, in buckets -------------------------------------------------------------
    followCamera sweeps the eye against the architecture and knows nothing about trees, which
    are not colliders because a rider goes straight through them. So an orbit angle that reads
    beautifully in open meadow put the eye inside a canopy and filled the frame with leaves:
    measured over twenty-six places around the basin, the horse was completely hidden at five
    of them against three for the old dead-astern rig, and during one ride through ordinary
    scattered meadow it happened in four shots out of eight.
    G.world.forestPoints is every tree as {x,z,s}. Bucketed into sixteen-metre cells once, a
    look-up costs nine cells rather than a walk over six hundred trees. */
 const TG={cell:16,map:null};
 function treeGrid(){
  if(TG.map)return TG.map;
  const pts=(W.forestPoints||[]); const m=new Map();
  for(const t of pts){ if(!t||t.x==null)continue;
   const k=((t.x/TG.cell)|0)+','+((t.z/TG.cell)|0);
   let a=m.get(k); if(!a){a=[];m.set(k,a);}
   a.push(t); }
  TG.map=m; return m;
 }
 G.on('rebuild',()=>{TG.map=null;});
 /* How far INTO a canopy a point is, in metres, or 0 when it is in the clear. A canopy is
    taken as a disc of radius 2.4*scale whose underside is at 2.0*scale — under that you are
    below the branches looking up through the trunks, which is a fine shot. */
 /* Is the line from the eye to the horse running through a crown? inCanopy asks only about the eye
    itself, and only from the crown's base upward — which caught every problem while the eye sat
    3 m up, and caught nothing once the camera came down to eye level: at 1.6-2.2 m the eye rides
    among the trunks and low limbs, under the height that test starts looking, and what spoils the
    shot there is a limb BETWEEN camera and horse rather than foliage round the lens. So sample the
    sight line itself, against the low part of every crown near it. */
 function sightBlocked(ex,ey,ez,tx,ty,tz){
  const m=treeGrid();
  for(let i=1;i<=5;i++){
   const f=i/6, x=ex+(tx-ex)*f, y=ey+(ty-ey)*f, z=ez+(tz-ez)*f;
   const cx=(x/TG.cell)|0, cz=(z/TG.cell)|0;
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
    const L=m.get((cx+a)+','+(cz+b)); if(!L)continue;
    for(const t of L){ const sc=t.s||1, g=W.groundH(t.x,t.z);
     if(y<g+1.15*sc||y>g+7.5*sc)continue;                       // low limbs down to ~1.2 m, up through the crown
     if(Math.hypot(x-t.x,z-t.z)<2.1*sc)return true; }
   }
  }
  return false;
 }
 function inCanopy(x,y,z){
  const m=treeGrid(), cx=(x/TG.cell)|0, cz=(z/TG.cell)|0; let worst=0;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
   const a=m.get((cx+i)+','+(cz+j)); if(!a)continue;
   for(const t of a){ const sc=t.s||1, r=2.4*sc;
    if(y<W.groundH(t.x,t.z)+2.0*sc)continue;                 // below the crown
    const d=Math.hypot(x-t.x,z-t.z); if(d<r){const bite=r-d; if(bite>worst)worst=bite;} }
  }
  return worst;
 }
 G.on('tick',()=>{F.own=false;F.frames++;if(G.camera)_seen.copy(G.camera.position);});

 const angDiff=a=>Math.atan2(Math.sin(a),Math.cos(a));

 G.on('camera',c=>{
  if(F.broke>2||!player.mesh)return false;
  try{
   if(foreignCam()||!G.camera.position.equals(_seen)){F.own=false;return false;}
   const cam=G.camera, dt=Math.min(c.dt,0.1), sp=Math.abs(player.speed)||0;
   const head=player.heading;
   if(F.head===null){F.head=head;}

   /* The heading the EYE is built on chases the horse's, and the harder she is turning the
      harder it chases — so the lag grows into a three-quarter view and then stops growing
      instead of winding on round to broadside. The clamp is the belt to that brace, for a
      spin on the spot where the filter alone would still be catching up. */
   let lag=angDiff(head-F.head);
   F.head+=lag*(1-Math.exp(-(CAM.LAG+CAM.LAG_GAIN*Math.abs(lag))*dt));
   lag=angDiff(head-F.head);
   if(lag>CAM.LAG_MAX)F.head=head-CAM.LAG_MAX; else if(lag<-CAM.LAG_MAX)F.head=head+CAM.LAG_MAX;

   /* One number does all the breathing. It climbs about twice as fast as it falls: opening
      the shot up as she takes off should feel immediate, closing it back down as she pulls up
      should feel like the camera settling rather than pouncing. */
   const u=clamp(sp/CAM.GALLOP,0,1);
   F.u+=(u-F.u)*(1-Math.exp(-(u>F.u?CAM.UP:CAM.DOWN)*dt));

   /* Drag yaw unwinds while she is going forward, the way the built-in rig's did — a look
      around is a moment, not a mode — but more slowly, so a deliberate one survives a beat. */
   if(!F.drag&&sp>0.6)F.yaw+=(0-F.yaw)*Math.min(1,dt*1.2);

   /* A corner tucks the shot in a little. Partly because that is what a camera operator does
      on a turn, and partly because the eye is on a nine-metre arm: at a hard gallop the horse
      swings through three radians a second and every metre of that arm is another thirty
      centimetres a frame of camera travel. */
   const tight=Math.min(1,Math.abs(lag)/CAM.LAG_MAX);
   const R=(CAM.dist+CAM.distSp*F.u)*F.zoom*(1-CAM.TUCK*tight);
   const pitch=clamp(CAM.pitch+CAM.pitchSp*F.u+F.pitch,0.08,1.12);
   const run=R*Math.cos(pitch), rise=R*Math.sin(pitch);
   /* How much of the shot we are actually getting. When a wall or a gatepost has squeezed the
      eye in to half its arm, an aim point three metres past the horse and nearly two metres up
      is a steep look down PAST her and she slides off the bottom of the frame — measured at
      the arena gate, where the clearance sweep pulls the eye to four metres and the horse's
      box centre fell to 0.65 of the way down the picture. So the closer the shot is forced,
      the more it aims at the horse herself. One frame stale, which nobody can see. */
   const got=clamp(Math.hypot(cam.position.x-player.pos.x,cam.position.z-player.pos.z)/Math.max(1,run),0,1);
   /* The orbit angle is the lagged heading, plus the player's own drag, plus the three-quarter
      sweep — and the sweep carries most of the turn back, which is the BIAS above. */
   /* The field of view is VERTICAL, so a tall thin window is a far narrower window sideways:
      78 degrees across at 1440x900, 26 degrees in portrait on a phone. The three-quarter
      sweep that sits the horse elegantly off-centre on a monitor therefore threw her off
      the side of a phone entirely — measured at -0.595 of half-width, i.e. outside the
      frame. Scale the sideways part of the shot by how much sideways room there actually
      is, against the desktop shape it was tuned on. */
   const aspect=(G.camera&&G.camera.aspect)||1.6;
   const hHalf=Math.atan(Math.tan(((G.camera&&G.camera.fov)||52)*Math.PI/360)*aspect);
   const wide=clamp(Math.tan(hHalf)/Math.tan(Math.atan(Math.tan(52*Math.PI/360)*1.6)),0.28,1);
   const ang=F.head+F.yaw+(CAM.off+CAM.offSp*F.u)*wide+lag*CAM.BIAS;
   const fx=Math.sin(ang), fz=Math.cos(ang);
   /* The eye used to follow four fifths of her height. Over a fence that is the right
      instinct — it damps the pogo, and a fifth of a 1.5 m jump is 30 cm nobody can see. On a
      winged horse it is a disaster: a fifth of fifty metres is ten, so the further she climbed
      the further the camera sank beneath her, until the shot was her belly against the sky. So
      damp the first two metres, which covers every fence in the game, and follow one for one
      above that, which is flight. */
   const py=player.y||0, lift=py<=2?py*0.8:1.6+(py-2);
   const foot=W.groundH(player.pos.x,player.pos.z)+lift;
   let ex=player.pos.x-fx*run, ez=player.pos.z-fz*run;
   let ey=Math.max(foot+rise,W.groundH(ex,ez)+1.25);
   /* If that lands in a canopy, walk the eye back along its own arm toward the horse until it
      is clear. Coming IN rather than going round keeps the three-quarter framing the whole
      point of this rig — a shorter version of the good shot beats a long version of a bad one.
      Six steps at a fifth of the arm each; if the wood never opens, take the closest tried. */
   const hx=player.pos.x, hy=foot+1.4, hz=player.pos.z;                 // her shoulders: what the shot must see
   if(inCanopy(ex,ey,ez)>0||sightBlocked(ex,ey,ez,hx,hy,hz)){
    let r2=run;
    for(let k=0;k<7&&r2>2.2;k++){
     r2*=0.8;
     const nx=player.pos.x-fx*r2, nz=player.pos.z-fz*r2;
     const ny=Math.max(foot+rise*(r2/Math.max(0.001,run)),W.groundH(nx,nz)+1.25);
     ex=nx; ez=nz; ey=ny;
     if(inCanopy(nx,ny,nz)<=0&&!sightBlocked(nx,ny,nz,hx,hy,hz))break;
    }
   }
   _eye.set(ex,ey,ez);

   /* Aim above her and ahead of her. Above is what drops her into the lower third and lets the
      valley have the top two thirds. Ahead is the look-ahead, swung part of the way into the
      turn and shortened as the turn tightens — and shortened again by a drag, because someone
      who has pulled the view round to look at her wants her in the middle of it, not a lead
      pointing off at where she would have been going. */
   const lead=(CAM.lead+CAM.leadSp*F.u)*(1-CAM.LEAD_TIGHT*tight)*(1-0.85*Math.min(1,Math.abs(F.yaw)/1.2))*got;
   const la=F.head+lag*CAM.LOOK_INTO;
   const lookY=CAM.LOOK_MIN+(CAM.lookY+CAM.lookYSp*F.u-CAM.LOOK_MIN)*got;
   _look.set(player.pos.x+Math.sin(la)*lead,foot+lookY,player.pos.z+Math.cos(la)*lead);
   c.camLook.lerp(_look,F.placed?1-Math.exp(-CAM.LOOK_EASE*dt):1);

   /* The clearance sweep is anchored on the HORSE, not on the aim point. followCamera pulls the
      eye TOWARD whatever origin it is given when something blocks the line, and the aim point
      here is metres out in front of her — so anchoring on it put the camera in front of the
      horse the first time she cornered under trees, and the shot lost her completely. The
      origin is the subject; where the lens happens to be pointing is a separate question. */
   _anchor.set(player.pos.x,foot+1.45,player.pos.z);
   c.camDesired.copy(_eye);
   W.followCamera.frame(_anchor,c.camDesired,c.camSafe,dt);
   /* A cut, not a dolly, when the horse has plainly teleported — fast travel, a ferry landing,
      the first frame after boot. Easing across half the basin is a long slow drift through
      other people's scenery. */
   if(!F.placed||cam.position.distanceTo(c.camSafe)>CAM.SNAP){cam.position.copy(c.camSafe);F.placed=true;}
   else cam.position.lerp(c.camSafe,1-Math.exp(-CAM.EASE*dt));
   /* Recheck the interpolated point: both ends of a lerp can be clear of a barn and the path
      between them still go through it. But applying that recheck AT FULL STRENGTH the frame it
      fires is a snap, and on a nine-metre arm it is a big one — measured at 6.7 m in a single
      frame, where the built-in rig's worst was 0.9, because a longer arm swung out to one side
      crosses far more fence rail and jump standard than a short one straight astern. Nearly all
      of those crossings last two or three frames: a rail whips through the line and is gone.
      So the pull-in is eased, hard enough that riding into a barn closes the shot in about a
      sixth of a second and gently enough that a rail flicking past costs a dip of a few
      centimetres instead of yanking the eye onto the horse's shoulder and back. */
   _raw.copy(cam.position);
   const occWant=W.followCamera.resolve(_anchor,_raw,_tmp);
   /* Rate-limited in METRES a second rather than as a filter constant, because the same filter
      constant on a nine-metre arm moves the eye three times as far per frame as it does on a
      three-metre one — which is precisely how the snap got to 6.7 m. Divide the allowance by
      the arm and the worst frame is bounded no matter how far back the shot happens to be. */
   const arm=Math.max(0.5,_raw.distanceTo(_anchor));
   const cap=(occWant<F.occ?CAM.OCC_IN:CAM.OCC_OUT)*dt/arm;
   F.occ=clamp(F.occ+clamp(occWant-F.occ,-cap,cap),0,1);
   cam.position.copy(_anchor).lerp(_tmp.copy(_raw).setY(Math.max(_raw.y,W.groundH(_raw.x,_raw.z)+0.7)),F.occ);
   const shake=sp>7&&c.grounded?0.010:0;
   cam.lookAt(c.camLook.x+Math.sin(c.t*23)*shake,c.camLook.y+Math.sin(c.t*31)*shake,c.camLook.z+Math.cos(c.t*27)*shake);
   const fovT=CAM.fov+CAM.fovSp*F.u;
   if(Math.abs(cam.fov-fovT)>0.05){cam.fov+=(fovT-cam.fov)*Math.min(1,dt*2.5);cam.updateProjectionMatrix();}
   F.own=true;
   return true;
  }catch(e){
   /* A camera that throws every frame is worse than a camera that is merely too close, so
      this stands down for good and hands the built-in rig back. */
   F.broke++;F.own=false;
   if(F.broke===1)console.warn('course-guide follow camera stood down',e);
   return false;
  }
 });

 G.on('state',o=>{
  o.followCam={own:F.own,speedMix:+F.u.toFixed(2),lag:F.head===null?0:+angDiff(player.heading-F.head).toFixed(3),
   yaw:+F.yaw.toFixed(3),pitch:+F.pitch.toFixed(3),zoom:+F.zoom.toFixed(2),
   dist:+Math.hypot(G.camera.position.x-player.pos.x,G.camera.position.z-player.pos.z).toFixed(2),
   rise:+(G.camera.position.y-(W.groundH(player.pos.x,player.pos.z)+(player.y||0))).toFixed(2),
   fov:+G.camera.fov.toFixed(1),occ:+F.occ.toFixed(2),yielded:foreignCam(),frames:F.frames,broke:F.broke};
 });
 /* Handles for QA and for anyone framing a shot: CAM is live, so a cinematic can widen the
    rig and put it back without this file knowing. reset() is what a teleport should call. */
 G.followCam={CAM,state:F,isOwner:()=>F.own,yielding:()=>foreignCam(),
  reset(){F.placed=false;F.head=null;F.u=0;F.yaw=0;F.pitch=0;F.occ=1;}};
}
