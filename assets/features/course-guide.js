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
const TO_PERFECT=[0.58,0.96], TO_GOOD=[0.42,1.12], TO_SHOW=2.2;
const JUMP_CUES={early:'Wait',good:'Jump',perfect:'Jump now',late:'Too close',lineup:'Line up'};
// Predict the same forward fence crossing that course-engine scores. A nearby
// checkpoint, a reverse approach or a path beside the rails is not a jump window.
export function jumpCue(j,player){
 if(!j||j.kind!=='fence'||player.flying||player.y>=0.05||!(player.speed>0.8))return '';
 const dx=player.pos.x-j.x,dz=player.pos.z-j.z,speed=player.speed;
 if(Math.hypot(dx,dz)/speed>TO_SHOW)return '';
 const rot=j.rotY||0,sn=Math.sin(rot),cs=Math.cos(rot);
 const across=dx*sn+dz*cs,along=dx*cs-dz*sn,angle=(player.heading||0)-rot;
 const forward=speed*Math.cos(angle);
 if(across>=0||forward<=0.8)return 'lineup';
 const time=-across/forward,crossing=along+speed*Math.sin(angle)*time;
 if(Math.abs(crossing)>=1.8)return 'lineup';
 if(time>TO_SHOW)return '';
 if(time>=TO_PERFECT[0]&&time<=TO_PERFECT[1])return 'perfect';
 if(time>=TO_GOOD[0]&&time<=TO_GOOD[1])return 'good';
 return time<TO_GOOD[0]?'late':'early';
}
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
 /* A circle figure gets a circle. 'Canter a circle at B' used to be sent at B itself, with the
    same two-metre ring round the letter — and ranch3d.html only counts a circle ridden between 2.5
    and 12 m from the letter, so a rider who cantered faithfully round the ring she was shown
    scored 0% (the same circle at six metres completed the figure). So the figure draws the circle
    it is asking for: 6.5 m across the middle, enclosing the letter, its centre set 3.7 m in from
    the letter toward X. That keeps every point of it 2.8-10.2 m from the letter, inside the band
    that is scored, and puts the side nearest the rail only 2.8 m beyond the letter, so it fits in
    the home arena and in a town ring. It is a band of short quads rather than a flat RingGeometry
    because an arena floor is not always level, and each vertex is set on the ground under it —
    once per figure, when the circle is placed, never in the tick. */
 const CIRC={r:6.5,inset:3.7,seg:72};
 function bandGeo(w){
  const n=CIRC.seg, pos=new Float32Array((n+1)*2*3), idx=[];
  for(let i=0;i<n;i++){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(idx);
  g.userData.w=w; return g;
 }
 const bigLitGeo=bandGeo(0.2), bigDarkGeo=bandGeo(0.36);
 const bigRing=new THREE.Group(), bigDark=new THREE.Mesh(bigDarkGeo,ringDarkMat), bigLit=new THREE.Mesh(bigLitGeo,ringLitMat);
 bigDark.renderOrder=2; bigLit.renderOrder=3; bigDark.frustumCulled=bigLit.frustumCulled=false;
 bigRing.add(bigDark); bigRing.add(bigLit); bigRing.visible=false; G.scene.add(bigRing);
 const BIG={key:'',cx:0,cz:0,r:0};
 function placeBigRing(cx,cz,r){
  const key=cx.toFixed(2)+','+cz.toFixed(2)+','+r;
  if(key===BIG.key)return; BIG.key=key; BIG.cx=cx; BIG.cz=cz; BIG.r=r;
  for(const [g,dy] of [[bigLitGeo,0],[bigDarkGeo,-0.03]]){
   const P=g.attributes.position.array, w=g.userData.w;
   for(let i=0;i<=CIRC.seg;i++){const a=i/CIRC.seg*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
    for(let k=0;k<2;k++){const rr=r+(k?w:-w), x=cx+ca*rr, z=cz+sa*rr, o=(i*2+k)*3;P[o]=x;P[o+1]=groundH(x,z)+LIFT+dy;P[o+2]=z;}}
   g.attributes.position.needsUpdate=true; g.computeBoundingSphere();
  }
 }

 /* ---------------------------------------------------------------- the takeoff window --- */
 /* Jumping in this game has always been a timing skill and has never once said so. The rails
    are judged on the horse's height as she crosses them — under 0.4 m knocks them down — and
    that height is decided entirely by WHEN the rider pressed jump. course-engine grades the
    crossing off heroJumpAge and has done all along: 0.58-0.96 s from take-off is 'perfect',
    0.42-1.12 s is 'good', anything else is early or late. So the skill, the window and the
    grades are all real; the only thing missing was any way to see the window before committing
    to it. A rider could ride a hundred rounds and never learn what she was doing differently on
    the clears, because the feedback arrived after the decision and never named the cause.

    The ring predicts time to the fence plane along the horse's current heading, using the
    same forward crossing and 1.8 m lateral limit as course-engine. Green and amber retain its
    existing timing bands. The HUD names the action so color is not the only cue; an approach
    that would miss the rails asks the rider to line up instead of advertising a perfect jump.
    If gradeCrossing changes, the timing bands above must change with it. */
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
 let toGrade='',toCue='';
 function tickReticle(dt,t){
  let show='',cue='';
  try{
   const c=G.course.get();
   const j=c&&!c.dressage&&c.jumps?c.jumps[c.idx]:null;
   if(j&&enabled&&c.started&&!closing){
    cue=jumpCue(j,player);
    if(cue&&cue!=='lineup'){
     show=cue==='perfect'||cue==='good'?cue:'miss';
     reticleMat.color.setHex(show==='perfect'?C_PERFECT:show==='good'?C_GOOD:C_MISS);
     const k=show==='perfect'?1.25+0.1*Math.sin(t*9):show==='good'?1.45:1.7;
     reticle.scale.set(k,k,1);
     reticleMat.opacity=show==='miss'?0.55:0.95;
     reticle.position.set(j.x,groundH(j.x,j.z)+2.35,j.z);
    }
   }
  }catch(e){}
  reticle.visible=!!show; toGrade=show; toCue=cue;
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
 const SP={wx:[0,0,0,0,0],wz:[0,0,0,0,0],cum:[0,0,0,0,0],ang:[0,0,0,0],n:0,len:0,spacing:3,built:0,pad:PAD,
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
 const PL={pts:[[0,0],[0,0],[0,0],[0,0],[0,0]],n:0,tx:0,tz:0,scored:false,mode:-1,a:-1,b:-1,ok:false,
  circle:false,cx:0,cz:0,cr:0,letter:'',dir:1};
 function plan(c){
  PL.ok=false;
  if(!c)return PL;
  /* A judged class has no fences: the next thing asked for is a letter, and ARENA_LETTERS is
     read live because events2-disciplines moves the whole arena to the town on the card. */
  if(c.dressage){
   if(c.done||!c.figs)return PL;
   const f=c.figs[c.fi]; if(!f)return PL;
   const AL=G.course.ARENA_LETTERS, at=AL&&AL[f.at]; if(!at)return PL;
   PL.circle=false; PL.letter=f.at;
   if(f.circle){
    /* the circle round the letter (CIRC above), and where she is against it */
    const X=AL.X||[at[0],at[1]], ix=X[0]-at[0], iz=X[1]-at[1], il=Math.hypot(ix,iz)||1;
    const cx=at[0]+ix/il*CIRC.inset, cz=at[1]+iz/il*CIRC.inset, r=CIRC.r;
    const rx=player.pos.x-cx, rz=player.pos.z-cz, rd=Math.hypot(rx,rz)||0.001, th=Math.atan2(rz,rx);
    PL.circle=true; PL.cx=cx; PL.cz=cz; PL.cr=r; PL.tx=at[0]; PL.tz=at[1]; PL.scored=false; PL.a=c.fi|0; PL.ok=true;
    /* Two edges, not one: onto the arc inside 2.0 m of the circle, off it again only past 2.6 m.
       With a single line at 2.2 m a rider cantering round a shade wide, wobbling a hand's width,
       saw the guide swap between the two pictures thirty-six times in three seconds. */
    const off=Math.abs(rd-r);
    if(PL.mode===4?off>2.6:off>=2.0){
     /* off the circle: onto it along a tangent, so she arrives already turning the way the circle
        goes rather than square to it; from inside it, straight out to the nearest point */
     const ta=rd>r?th+PL.dir*Math.acos(r/rd):th;
     PL.pts[0][0]=player.pos.x; PL.pts[0][1]=player.pos.z; PL.pts[1][0]=cx+Math.cos(ta)*r; PL.pts[1][1]=cz+Math.sin(ta)*r;
     PL.n=2; PL.mode=3; PL.b=-1;
    }else{
     /* on it: the next third of the circle ahead of her, the way she is already going round, as
        four thirty-degree chords (none more than 22 cm off the true circle). Laid from the chord
        boundary behind her, so it is re-laid once per thirty degrees ridden and she is always on
        its first chord. Which way round is read off her heading, with a margin so that standing
        square to the circle does not flip it every frame. */
     const h=player.heading||0, going=Math.cos(h+th);   // + means round with the angle increasing
     if(going>0.3)PL.dir=1; else if(going<-0.3)PL.dir=-1;
     const st=Math.PI/6, k=Math.floor(th/st), a0=(PL.dir>0?k:k+1)*st;
     for(let i=0;i<5;i++){const a=a0+PL.dir*i*st;PL.pts[i][0]=cx+Math.cos(a)*r;PL.pts[i][1]=cz+Math.sin(a)*r;}
     PL.n=5; PL.mode=4; PL.b=k*2+(PL.dir>0?1:0);
    }
    return PL;
   }
   PL.pts[0][0]=player.pos.x; PL.pts[0][1]=player.pos.z; PL.pts[1][0]=at[0]; PL.pts[1][1]=at[1];
   PL.n=2; PL.tx=at[0]; PL.tz=at[1]; PL.scored=false; PL.mode=0; PL.a=c.fi|0; PL.b=0; PL.ok=true;
   return PL;
  }
  const j=c.jumps&&c.jumps[c.idx]; if(!j)return PL;
  PL.circle=false;
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
 let circ=null;                                           // the circle being asked for, as PL left it, or null
 /* A new course means a new first leg whatever the indices happen to say, and the finish means
    the ribbon should already be going before cancelCourse pulls the course object out from under
    it on the next turn of the loop. */
 G.on('courseStart',()=>{SP.mode=-1;SP.a=-1;SP.b=-1;closing=false;STATS.lays=0;});
 /* Sister packages replay a finish without a live course object to re-pay a round; only the
    finish of the course actually being ridden should take the ribbon down. */
 G.on('courseFinish',o=>{const c=o&&o.c;if(!c||c===G.course.get())closing=true;});
 function hide(){
  core.count=rim.count=0; core.visible=rim.visible=ring.visible=bigRing.visible=false; tx=tz=null; circ=null;
  reticle.visible=false; toGrade=''; toCue='';
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
    if(!redo&&!P.scored&&P.mode!==4&&reT>0.12){reT=0;project(player.pos.x,player.pos.z);if(_pr.d>1.6)redo=true;}   // a stretch of circle is laid on the circle, not from her
    if(redo){SP.mode=P.mode;SP.a=P.a;SP.b=P.b;reT=0;layGuide(P);}
    tx=P.tx; tz=P.tz; circ=P.circle?P:null;
    if(circ)placeBigRing(P.cx,P.cz,P.cr);
   }
   /* Riding the leg costs one projection and an integer: the matrices are already where they
      belong, so all that changes is how many of them are drawn. */
   if(SP.built>0&&tx!==null){
    project(player.pos.x,player.pos.z);
    const n=clamp(Math.floor((SP.len-SP.pad-_pr.s-NEAR)/SP.spacing)+1,0,SP.built);
    core.count=rim.count=n;
   }
   const vis=fade>0.01;
   core.visible=rim.visible=vis&&core.count>0; ring.visible=vis&&tx!==null&&!circ; bigRing.visible=vis&&!!circ;
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
     /* a circle has no distance to ride to: what it needs is its size, since the small one is scored
        as nothing — and only its size. The line beside this already says 'Canter a circle at B',
        and on a phone every word here is squeezed out of that line: the long version squeezed it to
        130 px and three or four lines, the last of them under the green stamina bar. */
     distEl.textContent=circ?'· big circle':toCue?'· '+JUMP_CUES[toCue]:'· 📍 '+(d<10?d.toFixed(1):String(Math.round(d)))+' m';
     if(distEl.style.display!=='')distEl.style.display='';}
    else if(distEl.style.display!=='none')distEl.style.display='none';
   }
  }catch(e){broke++;if(broke===1)console.warn('course-guide stood down',e);hide();}
 });

 /* ---------------------------------------------------------------- state + handles ------ */
 G.on('state',o=>{
  o.guide={on:fade>0.01,fade:+fade.toFixed(2),chevrons:core.count,built:SP.built,
   takeoff:toGrade||null,takeoffShown:reticle.visible,jumpCue:toCue||null,
   spacing:+SP.spacing.toFixed(2),legLen:+SP.len.toFixed(1),onScoredLine:!SP.free&&SP.n>0,
   lays:STATS.lays,target:tx===null?null:[+tx.toFixed(1),+tz.toFixed(1)],
   dist:tx===null?null:+Math.hypot(player.pos.x-tx,player.pos.z-tz).toFixed(1),
   readout:distEl&&distEl.style.display!=='none'?distEl.textContent:null,
   circle:circ&&bigRing.visible?{letter:circ.letter,centre:[+BIG.cx.toFixed(1),+BIG.cz.toFixed(1)],r:BIG.r}:null};
 });
 /* Handles for QA and for anyone who needs the guide out of the way (a cinematic, a timing run).
    setEnabled is the honest way to measure what the ribbon costs: the same page, the same
    course, the feature on and off. */
 G.courseGuide={core,rim,ring,bigRing,CIRC,reticle,SP,STATS,plan,
  takeoff:()=>toGrade||null,jumpCue:()=>toCue||null,TO_PERFECT,TO_GOOD,TO_SHOW,
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
    contract: the sweep is anchored on the horse rather than the aim point, and the final
    recheck is applied after smoothing to keep the lens on the rider's side of a wall.

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
  dist:6.3,   distSp:0.8,                                // metres along the slant from horse to eye. 8.3 made the horse a small thing in a big field; laid beside the reference she needed to be ~1.35x larger again. 6.3 is that size once the eye went up over her head
  pitch:0.47, pitchSp:-0.03,                             // radians above the horizon — see "over her head" below for why 0.30 had to go
  off:0.16,   offSp:-0.04,                               // RADIANS round the horse, not metres — see below
  lookY:1.40, lookYSp:-0.15,                             // aim this far above her feet — with the eye up at three metres this is what keeps her hooves in the picture
  LOOK_MIN:1.18,                                         // and this far when a wall has squeezed the shot in
  NARROW_DIST:0.3, NARROW_PITCH:0.05, WIDE_MIN:0.8,      // a portrait phone: a little further back and higher, and most of the sideways sweep kept
  NUDGE:[[0.05,0],[0.10,0],[0.10,0.06],[0.10,0.12]],     // extra pitch and extra sweep tried, in order, when her body hides the next obstacle
  NUDGE_UP:4.0, NUDGE_FALL:0.06, NUDGE_LOOK:0.6,         // how fast it comes in, how slowly it lets go (rad/s), and how much of the extra rise the aim gives back
  lead:3.20,  leadSp:4.20,                               // and this far along where she is actually going
  fov:52,     fovSp:5.5,
  GALLOP:11.5,                                           // the speed that counts as "all of it"
  LAG:3.1, LAG_GAIN:3.0, LAG_MAX:0.80,                   // heading filter: rate, self-limit, hard clamp
  BIAS:0.72, LOOK_INTO:0.45, LEAD_TIGHT:0.60,            // how a corner is shared out — see below
  EASE:5.0, LOOK_EASE:7.0, UP:2.4, DOWN:1.15,            // position, look point, and the speed number
  TUCK:0.14,                                            // shorten the arm while turning
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

    Over her head. The rig used to sit at shoulder height — 5.4 m out at 0.30 rad puts the eye
    1.6 m above the ground, and at a gallop the flatter pitch brought it down to 1.25 m. The
    rider's head is at 2.47 m. So the horizon ran straight through her back, and anything you
    were riding at sat behind her: fired from the lens at the next fence or gate 8-20 m out on
    four courses, the ray hit the horse or rider in 64 of 64 tries on a portrait phone and 1 of
    64 on a monitor. The eye is now about 2.85 m up at a halt and 3.0 m at a gallop (3.3-3.5 m
    on a phone), which puts the horizon and the next obstacle above her head. The aim point
    came DOWN as the eye went up, because a high eye aimed at a high point slides her hooves off
    the bottom of the frame. What stays the same is the sweep round her: still nine degrees.

    A phone in portrait is the hard case, because the field of view is vertical and the picture
    is a quarter as wide: the sideways part of the shot used to be shrunk to 0.28 of its desktop
    size there to keep the horse in frame, which was right for the old thirty-degree sweep and
    left the lens dead astern for the nine-degree one — so the rider stood exactly on the line
    to whatever was ahead. At nine degrees the horse fits across a phone with room to spare, so
    most of the sweep is kept (WIDE_MIN), and a narrow screen gets a little more height and
    distance on top.

    And when her body still hides the next obstacle — a fence downhill, a gate just off the eye's
    side of her, a pony-sized frame on a Clydesdale — the rig notices and lifts. Each frame of a
    course it asks whether the straight line from the eye to the next fence, gate or letter
    passes through three boxes standing in for barrel, neck and rider (sized off the rider's own
    height, so a pony and a Clydesdale are both measured as themselves). If it does, it tries a
    little more height, then a little more sweep, and eases toward the first one that clears.
    It comes in over a quarter of a second and lets go over a few, so it never bobs.

    Why a corner is shared out three ways. A camera that simply lagged the heading swings to the
    OUTSIDE of a right-hand turn and gets a glorious near-broadside — and swings straight
    through the spine on a left-hand one and ends up looking up her tail, which is the very
    thing this is here to fix. So BIAS gives most of the turn back to the orbit angle, leaving
    about a quarter of it as a visible swing; the three-quarter then only breathes between
    roughly 16° and 41° instead of crossing zero. LOOK_INTO swings the aim into the turn, and
    LEAD_TIGHT shortens the look-ahead as the turn tightens, because in a tight turn you are not
    going anywhere far ahead and a long lead would drag the horse off the side of the frame. */
 /* The stand-in for horse and rider, in her own frame: x across her, y up from her hooves, z along
    her heading, in metres for a horse whose rider's head is at 2.47 m. Measured off the game's own
    meshes: HorseBody is +/-0.31 wide and 2.08 tall to the ears, the seated rider 1.02-2.47 m with
    her boots +/-0.42 out. Boxes a little generous, because a ray that grazes a boot still reads as
    "behind her" to the player. */
 const HER=[[0.42,0,1.65,-1.3,0.8],[0.24,1.2,2.12,0.35,1.35],[0.28,1.35,2.5,-0.34,0.32]];
 const HER_H=2.47;
 /* Her size, read once per horse off the rider's own bounding box (a yaw never changes a height, so
    the world box is honest). No rider, or a reading that makes no sense, falls back to the mesh
    scale against the 1.131 the boxes were measured at. */
 const PX={mesh:null,rider:null,s:1}, _bx=new THREE.Box3();
 function herScale(){
  const r=player.rider&&player.rider.g;
  if(player.mesh===PX.mesh&&r===PX.rider)return PX.s;
  PX.mesh=player.mesh; PX.rider=r;
  let s=player.mesh&&player.mesh.scale?clamp(player.mesh.scale.y/1.131,0.55,1.7):1;
  try{if(r){_bx.setFromObject(r);const top=_bx.max.y-(W.groundH(player.pos.x,player.pos.z)+(player.y||0));if(top>1.2&&top<4.6)s=top/HER_H;}}catch(e){}
  PX.s=s; return s;
 }
 /* Does the straight line from (ax,ay,az) to (bx,by,bz) pass through her? Both ends are taken into
    her frame and divided by her size, then a slab test against each box: a handful of multiplies,
    cheap enough to run several times a frame. fy is the height of her hooves. */
 function hidesBehindHer(ax,ay,az,bx,by,bz,fy){
  const s=herScale(), h=player.heading||0, sn=Math.sin(h), cs=Math.cos(h), px=player.pos.x, pz=player.pos.z;
  const a0=((ax-px)*cs-(az-pz)*sn)/s, a1=(ay-fy)/s, a2=((ax-px)*sn+(az-pz)*cs)/s;
  const d0=((bx-px)*cs-(bz-pz)*sn)/s-a0, d1=(by-fy)/s-a1, d2=((bx-px)*sn+(bz-pz)*cs)/s-a2;
  for(const B of HER){
   let t0=0,t1=1,ok=true;
   for(let k=0;k<3&&ok;k++){
    const o=k===0?a0:k===1?a1:a2, d=k===0?d0:k===1?d1:d2;
    const lo=k===0?-B[0]:k===1?B[1]:B[3], hi=k===0?B[0]:k===1?B[2]:B[4];
    if(Math.abs(d)<1e-9){if(o<lo||o>hi)ok=false;continue;}
    let u=(lo-o)/d,v=(hi-o)/d; if(u>v){const w=u;u=v;v=w;}
    if(u>t0)t0=u; if(v<t1)t1=v; if(t0>t1)ok=false;
   }
   if(ok)return true;
  }
  return false;
 }
 /* The thing the rider is being sent at next, as a point to see: a gate's ring, the middle of a
    fence's rails, a judged class's letter board. Written into T, or false when there is none. */
 const T={x:0,y:0,z:0};
 function nextSight(){
  const c=G.course&&G.course.get&&G.course.get(); if(!c||c.done)return false;
  if(c.dressage){const f=c.figs&&c.figs[c.fi], AL=G.course.ARENA_LETTERS, at=f&&AL&&AL[f.at]; if(!at)return false;
   T.x=at[0];T.z=at[1];T.y=W.groundH(at[0],at[1])+1.0;return true;}
  const j=c.jumps&&c.jumps[c.idx]; if(!j)return false;
  T.x=j.x;T.z=j.z;T.y=W.groundH(j.x,j.z)+(j.kind==='gate'?1.6:0.8);return true;
 }
 /* live state: the eased speed number, the lagging heading, and the player's own look-around */
 const F={u:0,head:null,yaw:0,pitch:0,zoom:1,occ:1,drag:null,placed:false,own:false,broke:0,frames:0,
  nudgeP:0,nudgeO:0,wantP:0,wantO:0,hidden:false,walk:1};
 const _eye=new THREE.Vector3(), _look=new THREE.Vector3(), _anchor=new THREE.Vector3();
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
    look-up costs nine cells rather than a walk over six hundred trees.

    But forestPoints is written once, at boot, and course-clear then takes trees OFF the courses —
    it zero-scales their instances and hides their meshes — without touching this list. So the eye
    went on dodging trees that were no longer there: on the Welcome Jump's second fence it walked
    itself in to 2.3 m from the horse, 1.26 m off the ground, round a tree course-clear had removed
    from the middle of the Cottonwood arena, and the rider stood between the lens and the fence. So
    a tree on or beside a course (courseDist under ten metres) is only kept if something tree-sized
    is actually still drawn within a metre or two of it. Everywhere else the list is trusted as it
    was. One pass over the instanced meshes, about 6 ms, run when the list is first asked for and
    again a beat after boot, once course-clear has finished its own second pass. */
 const TG={cell:16,map:null,ghosts:0};
 const _gp=new THREE.Vector3(), _gw=new THREE.Vector3();
 function drawnTrees(){
  /* where something tree-sized is still drawn, in one-metre buckets. Tree-sized is a bounding radius
     of two metres: every tree, trunk and snag in the valley is 2.5 or more, and the tufts, sage and
     scrub that also stand beside a course are all under 1.6 */
  const live=new Map(), put=(x,z)=>{const k=Math.floor(x)+','+Math.floor(z);live.set(k,(live.get(k)||0)+1);};
  const shown=o=>{for(let e=o;e;e=e.parent)if(!e.visible)return false;return true;};
  G.scene.traverse(o=>{
   if(o.isInstancedMesh){
    if(!o.count||!o.geometry||!shown(o))return;
    if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
    const gr=(o.geometry.boundingSphere&&o.geometry.boundingSphere.radius)||0.5, ws=o.matrixWorld.getMaxScaleOnAxis()||1, e=o.instanceMatrix.array;
    for(let i=0;i<o.count;i++){const k=i*16, sc=Math.hypot(e[k],e[k+1],e[k+2]); if(sc<1e-4||gr*sc*ws<2.0)continue;
     _gp.set(e[k+12],e[k+13],e[k+14]).applyMatrix4(o.matrixWorld); put(_gp.x,_gp.z);}
   }else if(o.isMesh&&/^Natural /.test(o.name||'')&&shown(o)){o.getWorldPosition(_gw);put(_gw.x,_gw.z);}
  });
  return live;
 }
 function treeGrid(){
  if(TG.map)return TG.map;
  const pts=(W.forestPoints||[]); const m=new Map();
  const cd=G.courseClear&&G.courseClear.courseDist;
  let live=null; try{if(cd)live=drawnTrees();}catch(e){live=null;}
  const drawnNear=(x,z)=>{const i=Math.floor(x),j=Math.floor(z);
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)if(live.get((i+a)+','+(j+b)))return true;return false;};
  TG.ghosts=0;
  for(const t of pts){ if(!t||t.x==null)continue;
   if(live&&cd(t.x,t.z)<10&&!drawnNear(t.x,t.z)){TG.ghosts++;continue;}   // course-clear took this one away
   const k=((t.x/TG.cell)|0)+','+((t.z/TG.cell)|0);
   let a=m.get(k); if(!a){a=[];m.set(k,a);}
   a.push(t); }
  TG.map=m; return m;
 }
 G.on('rebuild',()=>{TG.map=null;});
 G.on('boot',()=>setTimeout(()=>{TG.map=null;},1200));
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
 /* How bad an eye is, for the walk-in's last resort: 0 in the clear, 1 with a crown across the view
    of her shoulders, and 1 plus the depth when the lens itself is in the leaves. */
 function eyeCost(x,y,z,hx,hy,hz){const b=inCanopy(x,y,z);return b>0?1+b:sightBlocked(x,y,z,hx,hy,hz)?1:0;}
 G.on('tick',()=>{if(!F.own&&LENS.hid.size)clearPeople();F.own=false;F.frames++;if(G.camera)_seen.copy(G.camera.position);});
 /* ---- people in the lens ------------------------------------------------------------------
    The villagers are not architecture: nobody registered them with followCamera, and rightly —
    a camera that backed off every passer-by would never settle in a town. But that leaves the
    eye free to end up inside one. Beside Bram the Saddler's stall in Cottonwood the picture was
    his hat and his arm, with the horse somewhere behind them. So anyone standing within a stride
    and a half of the lens, or on the line from the lens to the horse and short of her, is simply
    not drawn until the eye has moved on; a margin on the way back stops them flickering at the
    edge. Only people this rig hid are ever shown again, and all of them come back the moment
    another camera takes over. Forty-odd distance checks a frame.

    Race gates get the same treatment for the same reason, and it is the raised eye that made
    them need it. A gate's ring is a torus 1.6 m round its centre, standing 0-3.2 m high (the next
    one breathes up to 1.3 times that). The old eye at 1.25-1.6 m followed the horse through the
    hole in the middle; an eye at three metres follows her through the top of the ring, and for a
    frame or two as it crosses the whole picture is a green or gold tube 13 cm from the lens. So a
    ring the lens is about to pass through — within 0.9 m of its tube — is not drawn until the lens
    is past it. By then the horse went through it a moment earlier, so it is a gate already
    ridden. */
 const LENS={hid:new Set(),count:0};
 function clearPeople(){
  if(!LENS.hid.size)return;
  for(const g of LENS.hid){if(g.userData.cgLens){g.userData.cgLens=false;g.visible=true;}}
  LENS.hid.clear(); LENS.count=0;
 }
 const _rl=new THREE.Vector3();
 function tickPeople(cp){
  tickRings(cp);
  const L=W.npcList; if(!L||!L.length)return;
  const vx=player.pos.x-cp.x, vz=player.pos.z-cp.z, l2=vx*vx+vz*vz||1;
  for(const q of L){
   const g=q&&q.g; if(!g||!g.parent)continue;
   const dx=g.position.x-cp.x, dz=g.position.z-cp.z, d2=dx*dx+dz*dz, was=!!g.userData.cgLens, pad=was?0.35:0;
   let hide=false;
   if(d2<36){
    if(d2<(1.5+pad)*(1.5+pad))hide=true;
    else{const t=(dx*vx+dz*vz)/l2;if(t>0&&t<0.85){const ox=dx-vx*t, oz=dz-vz*t;if(ox*ox+oz*oz<(0.75+pad)*(0.75+pad))hide=true;}}
   }
   if(hide&&!was){if(!g.visible)continue;g.visible=false;g.userData.cgLens=true;LENS.hid.add(g);}   // hidden by someone else already: theirs, not ours
   else if(!hide&&was){g.userData.cgLens=false;g.visible=true;LENS.hid.delete(g);}
  }
  LENS.count=LENS.hid.size;
 }
 let ringCourse=null;
 function tickRings(cp){
  const c=G.course&&G.course.get&&G.course.get();
  /* a finished or cancelled course takes its gates with it: let go of any ring still held */
  if(c!==ringCourse){ringCourse=c;for(const o of [...LENS.hid])if(o.userData.cgRing){o.userData.cgLens=false;o.visible=true;LENS.hid.delete(o);}}
  if(!c||!c.jumps)return;
  for(const j of c.jumps){
   const r=j&&j.ring; if(!r||!r.isMesh||!r.parent)continue;
   const was=!!r.userData.cgLens;
   let hide=false;
   if((cp.x-j.x)*(cp.x-j.x)+(cp.z-j.z)*(cp.z-j.z)<16){
    /* the lens in the ring's own frame: the torus lies in its local XY plane, 1.6 across the middle */
    r.worldToLocal(_rl.copy(cp));
    const k=r.scale.x||1, d=Math.hypot(Math.hypot(_rl.x,_rl.y)-1.6,_rl.z)*k;
    hide=d<(was?1.2:0.9);
   }
   if(hide&&!was){if(!r.visible)continue;r.visible=false;r.userData.cgLens=true;r.userData.cgRing=true;LENS.hid.add(r);}
   else if(!hide&&was){r.userData.cgLens=false;r.visible=true;LENS.hid.delete(r);}
  }
 }

 const angDiff=a=>Math.atan2(Math.sin(a),Math.cos(a));

 G.on('camera',c=>{
  if(F.broke>2||!player.mesh)return false;
  try{
   if(foreignCam()||!G.camera.position.equals(_seen)){F.own=false;clearPeople();return false;}
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
   /* The field of view is VERTICAL, so a tall thin window is a far narrower window sideways:
      78 degrees across at 1440x900, 26 degrees in portrait on a phone. The old thirty-degree
      sweep that sat the horse elegantly off-centre on a monitor therefore threw her off the side
      of a phone entirely — measured at -0.595 of half-width, i.e. outside the frame — so the
      sideways part of the shot is scaled by how much sideways room there actually is, against
      the desktop shape it was tuned on. At nine degrees the floor is WIDE_MIN rather than 0.28:
      0.28 of nine degrees is two and a half, which is dead astern, and dead astern on a phone put
      the rider squarely between the lens and every fence on the course. */
   const aspect=(G.camera&&G.camera.aspect)||1.6;
   const hHalf=Math.atan(Math.tan(((G.camera&&G.camera.fov)||52)*Math.PI/360)*aspect);
   const wideRaw=Math.tan(hHalf)/Math.tan(Math.atan(Math.tan(52*Math.PI/360)*1.6));
   const wide=clamp(wideRaw,CAM.WIDE_MIN,1), narrow=clamp((1-wideRaw)/0.71,0,1);   // narrow: 0 on a monitor, 1 on a phone held upright
   // A dragon's folded wings and tail already fill a horse-sized orbit; a
   // flight stroke can put a whole membrane across the lens. Keep its zoom
   // and canopy walk-in outside that larger body, including scaled variants.
   const profile=G.horse.RIG()?.profile, dragon=!!profile?.nativeDragon;
   const dragonScale=(player.mesh.scale.x||1)*(profile?.fitScale||1);
   const blackDragon=profile?.nativeKind==='black-dragon';
   const frameScale=dragon?Math.max(1,(blackDragon?1.5:1.15)*dragonScale):1;
   const minArm=dragon?(blackDragon?(player.flying?8.5:7):(player.flying?5:4))*dragonScale:0;
   const minWalkIn=dragon?Math.max(2.2,minArm*.8):2.2;
   const lookLift=dragon?(blackDragon ? .65 : .2)*dragonScale:0;
   const R=Math.max(minArm,(CAM.dist+CAM.distSp*F.u+CAM.NARROW_DIST*narrow)*F.zoom*(1-CAM.TUCK*tight)*frameScale);
   const pitch0=CAM.pitch+CAM.pitchSp*F.u+CAM.NARROW_PITCH*narrow+F.pitch;
   /* The orbit angle is the lagged heading, plus the player's own drag, plus the three-quarter
      sweep — and the sweep carries most of the turn back, which is the BIAS above. */
   const ang0=F.head+F.yaw+(CAM.off+CAM.offSp*F.u)*wide+lag*CAM.BIAS, side=CAM.off<0?-1:1;
   /* The eye used to follow four fifths of her height. Over a fence that is the right
      instinct — it damps the pogo, and a fifth of a 1.5 m jump is 30 cm nobody can see. On a
      winged horse it is a disaster: a fifth of fifty metres is ten, so the further she climbed
      the further the camera sank beneath her, until the shot was her belly against the sky. So
      damp the first two metres, which covers every fence in the game, and follow one for one
      above that, which is flight. */
   const py=player.y||0, lift=py<=2?py*0.8:1.6+(py-2);
   const foot=W.groundH(player.pos.x,player.pos.z)+lift;
   /* Is she standing between the lens and the next thing she is being sent at? Asked of the eye
      this frame would have WITHOUT any lift, so the answer is about the course and not about the
      lift itself; then each step of CAM.NUDGE in turn until one clears. Only for a target ahead of
      her and more than five metres out — inside that she is on top of it and the take-off ring,
      which draws over everything, is what she should be looking at. Not while a thumb is dragging
      the view round: a deliberate look is the player's, not this. */
   let wantP=0, wantO=0, hid=false;
   if(!F.drag&&nextSight()){
    const dx=T.x-player.pos.x, dz=T.z-player.pos.z, dd=Math.hypot(dx,dz);
    if(dd>5&&dd<70&&dx*Math.sin(head)+dz*Math.cos(head)>0){
     const fy=W.groundH(player.pos.x,player.pos.z)+py;
     const blocked=(dp,dO)=>{
      const p2=clamp(pitch0+dp,0.08,1.12), r2=R*Math.cos(p2), a2=ang0+dO*side;
      const x2=player.pos.x-Math.sin(a2)*r2, z2=player.pos.z-Math.cos(a2)*r2;
      return hidesBehindHer(x2,Math.max(foot+R*Math.sin(p2),W.groundH(x2,z2)+1.25),z2,T.x,T.y,T.z,fy);
     };
     if(blocked(0,0)){
      hid=true;
      const N=CAM.NUDGE; wantP=N[N.length-1][0]; wantO=N[N.length-1][1];
      for(const n of N){if(!blocked(n[0],n[1])){wantP=n[0];wantO=n[1];break;}}
     }
    }
   }
   /* Straight up to what is wanted, and a slow walk back down from it: the target falls at
      NUDGE_FALL radians a second and the lift eases after it, so a fence that blinks in and out
      from behind her mane on a bumpy approach does not bob the whole picture. */
   F.hidden=hid;
   F.wantP=Math.max(wantP,F.wantP-CAM.NUDGE_FALL*dt); F.wantO=Math.max(wantO,F.wantO-CAM.NUDGE_FALL*dt);
   const kN=1-Math.exp(-CAM.NUDGE_UP*dt);
   F.nudgeP+=(F.wantP-F.nudgeP)*kN; F.nudgeO+=(F.wantO-F.nudgeO)*kN;
   const pitch=clamp(pitch0+F.nudgeP,0.08,1.12);
   const run=R*Math.cos(pitch), rise=R*Math.sin(pitch);
   const nudgeRise=Math.max(0,rise-R*Math.sin(clamp(pitch0,0.08,1.12)));   // what the lift added, which the aim partly gives back
   /* How much of the shot we are actually getting. When a wall or a gatepost has squeezed the
      eye in to half its arm, an aim point three metres past the horse and nearly two metres up
      is a steep look down PAST her and she slides off the bottom of the frame — measured at
      the arena gate, where the clearance sweep pulls the eye to four metres and the horse's
      box centre fell to 0.65 of the way down the picture. So the closer the shot is forced,
      the more it aims at the horse herself. One frame stale, which nobody can see. */
   const got=clamp(Math.hypot(cam.position.x-player.pos.x,cam.position.z-player.pos.z)/Math.max(1,run),0,1);
   const ang=ang0+F.nudgeO*side;
   const fx=Math.sin(ang), fz=Math.cos(ang);
   let ex=player.pos.x-fx*run, ez=player.pos.z-fz*run;
   let ey=Math.max(foot+rise,W.groundH(ex,ez)+1.25);
   /* If that lands in a canopy, walk the eye back along its own arm toward the horse until it
      is clear. Coming IN rather than going round keeps the three-quarter framing the whole
      point of this rig — a shorter version of the good shot beats a long version of a bad one.
      Each step tries the eye at its full height first and only then ducks it under the crowns,
      because ducking it is what put the lens back at the rider's shoulders: the walk-in used to
      shrink the height with the arm, so every tree beside a course brought the camera down to
      1.25 m and 2.2 m back, looking up the horse's tail with the fence behind the rider.
      It still walks all the way in to 2.2 m, though. Stopping at three metres and keeping the
      closest full-height eye when the wood never opened put the lens INSIDE a crown in 48 of 90
      spots among ordinary trees off any course, against 1 in 90 before — the picture was leaves.
      So when neither eye clears at any step, the last resort is ranked by eyeCost: first the
      farthest eye right down at the floor (1.25 m over the ground under the lens, but never under
      half a metre over her feet, which on a slope falling away behind her would be looking up at
      her belly) that sees her clean, then the closest and lowest eye with only a branch across the
      view, and only then a lens in the leaves, the shallowest one. A low eye with a branch across
      it still shows her; a lens inside a crown shows nothing. */
   const hx=player.pos.x, hy=foot+1.4+lookLift, hz=player.pos.z;                 // her shoulders: what the shot must see
   F.walk=1;
   if(inCanopy(ex,ey,ez)>0||sightBlocked(ex,ey,ez,hx,hy,hz)){
    let r2=run, bb=1e9, bx=ex, by=ey, bz=ez, ok=false;
    for(let k=0;k<7&&!ok&&r2*0.8>minWalkIn;k++){
     r2*=0.8;
     const nx=player.pos.x-fx*r2, nz=player.pos.z-fz*r2, gnd=W.groundH(nx,nz)+1.25;
     const hiY=Math.max(foot+rise,gnd), loY=Math.max(foot+rise*(r2/Math.max(0.001,run)),gnd), flY=Math.max(foot+0.5,gnd);
     for(let h=0;h<3;h++){                                              // full height, ducked under the crowns, and the floor (last resort only)
      if(h===2&&loY<=flY)break;
      const ny=h===0?hiY:h===1?loY:flY, s=eyeCost(nx,ny,nz,hx,hy,hz);
      if(!s&&h<2){ex=nx;ey=ny;ez=nz;ok=true;break;}
      if(s<bb||s===bb&&s>0){bb=s;bx=nx;by=ny;bz=nz;}                    // a clear floor eye keeps the farthest; anything worse, the closest
     }
    }
    if(!ok&&bb<1e9){ex=bx;ey=by;ez=bz;}
    F.walk=Math.hypot(ex-player.pos.x,ez-player.pos.z)/Math.max(0.001,run);
   }
   _eye.set(ex,ey,ez);

   /* Aim above her and ahead of her. Above is what drops her into the lower third and lets the
      valley have the top two thirds. Ahead is the look-ahead, swung part of the way into the
      turn and shortened as the turn tightens — and shortened again by a drag, because someone
      who has pulled the view round to look at her wants her in the middle of it, not a lead
      pointing off at where she would have been going. */
   const lead=(CAM.lead+CAM.leadSp*F.u)*(1-CAM.LEAD_TIGHT*tight)*(1-0.85*Math.min(1,Math.abs(F.yaw)/1.2))*got;
   const la=F.head+lag*CAM.LOOK_INTO;
   const lookY=CAM.LOOK_MIN+(CAM.lookY+CAM.lookYSp*F.u-CAM.NUDGE_LOOK*nudgeRise-CAM.LOOK_MIN)*got+lookLift;
   _look.set(player.pos.x+Math.sin(la)*lead,foot+lookY,player.pos.z+Math.cos(la)*lead);
   c.camLook.lerp(_look,F.placed?1-Math.exp(-CAM.LOOK_EASE*dt):1);

   /* The clearance sweep is anchored on the HORSE, not on the aim point. followCamera pulls the
      eye TOWARD whatever origin it is given when something blocks the line, and the aim point
      here is metres out in front of her — so anchoring on it put the camera in front of the
      horse the first time she cornered under trees, and the shot lost her completely. The
      origin is the subject; where the lens happens to be pointing is a separate question. */
   _anchor.set(player.pos.x,foot+1.45+lookLift,player.pos.z);
   c.camDesired.copy(_eye);
   W.followCamera.frame(_anchor,c.camDesired,c.camSafe,dt);
   /* A cut, not a dolly, when the horse has plainly teleported — fast travel, a ferry landing,
      the first frame after boot. Easing across half the basin is a long slow drift through
      other people's scenery. */
   if(!F.placed||cam.position.distanceTo(c.camSafe)>CAM.SNAP){cam.position.copy(c.camSafe);F.placed=true;}
   else cam.position.lerp(c.camSafe,1-Math.exp(-CAM.EASE*dt));
   // The predictive sweep above smooths the orbit and retraction. The final
   // safety check must be exact: easing its collision fraction let the lens
   // cross a wall for several frames, showing a solid dark panel on screen.
   F.occ=W.followCamera.resolve(_anchor,cam.position,cam.position);
   tickPeople(cam.position);
   const shake=sp>7&&c.grounded?0.010:0;
   cam.lookAt(c.camLook.x+Math.sin(c.t*23)*shake,c.camLook.y+Math.sin(c.t*31)*shake,c.camLook.z+Math.cos(c.t*27)*shake);
   const fovT=CAM.fov+CAM.fovSp*F.u;
   if(Math.abs(cam.fov-fovT)>0.05){cam.fov+=(fovT-cam.fov)*Math.min(1,dt*2.5);cam.updateProjectionMatrix();}
   F.own=true;
   return true;
  }catch(e){
   /* A camera that throws every frame is worse than a camera that is merely too close, so
      this stands down for good and hands the built-in rig back. */
   F.broke++;F.own=false;try{clearPeople();}catch(x){}
   if(F.broke===1)console.warn('course-guide follow camera stood down',e);
   return false;
  }
 });

 G.on('state',o=>{
  o.followCam={own:F.own,speedMix:+F.u.toFixed(2),lag:F.head===null?0:+angDiff(player.heading-F.head).toFixed(3),
   yaw:+F.yaw.toFixed(3),pitch:+F.pitch.toFixed(3),zoom:+F.zoom.toFixed(2),
   dist:+Math.hypot(G.camera.position.x-player.pos.x,G.camera.position.z-player.pos.z).toFixed(2),
   rise:+(G.camera.position.y-(W.groundH(player.pos.x,player.pos.z)+(player.y||0))).toFixed(2),
   fov:+G.camera.fov.toFixed(1),occ:+F.occ.toFixed(2),yielded:foreignCam(),frames:F.frames,broke:F.broke,
   nextHidden:F.hidden,nudge:[+F.nudgeP.toFixed(3),+F.nudgeO.toFixed(3)],lensHidden:LENS.count,ghostTrees:TG.ghosts,walkIn:+F.walk.toFixed(2)};
 });
 /* Handles for QA and for anyone framing a shot: CAM is live, so a cinematic can widen the
    rig and put it back without this file knowing. reset() is what a teleport should call. */
 G.followCam={CAM,state:F,isOwner:()=>F.own,yielding:()=>foreignCam(),
  reset(){F.placed=false;F.head=null;F.u=0;F.yaw=0;F.pitch=0;F.occ=1;F.nudgeP=F.nudgeO=F.wantP=F.wantO=0;F.hidden=false;},
  hidesBehindHer,nextSight:()=>nextSight()?[T.x,T.y,T.z]:null,herScale};
}
