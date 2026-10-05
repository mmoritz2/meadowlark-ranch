/* Feature package 'on-foot' — getting off the horse and walking about.

   In the riding game this one is modelled on, a small saddle button beside the jump lets you
   step down, and then you are a person: you walk, you jog, you go up to things, and your horse
   stands where you left it until you whistle it over or walk back and get on. Here the rider
   never left the saddle.

   Getting off leaves two things where there was one:
     the horse   — a stand-in of the horse being ridden, dressed on the same rig with a saddle
                   and bridle, parked where she stopped. It stands and grazes, comes at a trot
                   when whistled, and carries an E prompt: "Ride <name>".
     the rider   — the player's own rider, lifted out of the saddle into a group of her own and
                   stood up: the character (assets/rider-model.js) walks with the animation
                   library's idle, walk and jog, blended by speed; the old sculpt, if it is the one
                   loaded, has its legs re-aimed straight down bone by bone with a walk or jog cycle
                   laid over. Her hair, clothes and helmet come with her: it is the same rider.

   The game's player position follows her, so everything that asks where the player is — the
   E prompts, the minimap, the quests, the NPCs, the collisions — asks about her. The mounted
   horse keeps following that position too, hidden, which is what lets getting back on be one
   step. Walking and jogging go in through the 'ride' hook (target speed, turning, no jumping),
   the camera through the 'camera' hook, and three one-line guards inline (driveRider, the
   hoofbeats and the riding distance) keep the saddle out of it.

   On foot W walks, Shift (or the run toggle) runs flat out on the animation library's sprint, and
   Space (or the jump button) jumps: a person's hop along a true arc, in the library's in-air pose,
   landing in its crouch.

   Getting back on: E at the horse, the saddle button, or F. From far off, the saddle button
   whistles the horse over and puts her up when it arrives. Changing horse while on foot — the
   Horse Overview, or E beside a pasture horse — puts her straight up on the new one. A course
   or event starting also puts her back up, at the start line.

   Nothing runs at import time. */
export const id='on-foot';
export function install(G){
 const THREE=G.THREE, H=G.horse, Wd=G.world, RS=G.ranchSys||{};
 if(!THREE||!H||!H.player||!G.scene||!Wd)return;
 const $=id=>document.getElementById(id);
 const player=H.player, scene=G.scene;
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 const angDiff=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const toast=m=>{try{G.toast(m);}catch(e){}};
 const RIDER_H=0.91;                  // walker scale: the rider stands about 1.62 m in it
 /* sculpt units: ankle to toe, wrist to knuckles (the 'R' side; the L side mirrors x), and
    ankle to sole in the rider group's own units (0.125 of sculpt times the 0.74 fit) */
 const TOE=[0.022,-0.125,0.280], KNUCKLE=[-0.032,0.008,0.092], SOLE=0.0925;
 const ST={on:false,W:null,R:null,mesh:null,horse:null,thing:null,cols:[],mini:null,
  ph:0,amp:0,run:0,look:0,cam:null,camYaw:null,snap:false,call:null,mountOnArrive:false,idx:-1};

 /* ---------------------------------------------------------------- standing her up -------- */
 const _q=new THREE.Quaternion(),_wq=new THREE.Quaternion(),_pq=new THREE.Quaternion(),_gq=new THREE.Quaternion();
 const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_v=new THREE.Vector3();
 function aim(bone,from,to){
  if(from.lengthSq()<1e-10)return;
  _q.setFromUnitVectors(from.normalize(),to.normalize());
  bone.getWorldQuaternion(_wq); _wq.premultiply(_q);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_wq));
  bone.updateMatrixWorld(true);
 }
 const seg=(b0,b1)=>{b0.getWorldPosition(_a);b1.getWorldPosition(_b);return _b.sub(_a);};
 const tip=(bone,off,s)=>{bone.getWorldPosition(_a);_b.set(off[0]*s,off[1],off[2]);bone.localToWorld(_b);return _b.sub(_a);};
 const dir=(x,y,z)=>_v.set(x,y,z).normalize().applyQuaternion(_gq);   // her own frame (x out to her 'R' side, y up, z ahead) to world
 /* One pose a frame: every bone home, then the chain aimed limb by limb in world space. Aiming
    rather than rotating by fixed angles is what makes a seated sculpt stand: nobody has to know
    which way the thigh bone's own axes happen to point in a figure modelled on a horse. */
 function pose(R,ph,amp,run,t,look){
  const B=R.sk.by;
  R.g.position.set(0,0,0); R.g.rotation.set(0,0,0);
  R._rest();
  const still=1-Math.min(1,amp), breathe=Math.sin(t*1.5)*0.02*still;
  B.spine.rotation.set(0.09*run+breathe*0.4,0,0);
  B.chest.rotation.set(0.04*run+breathe,0,0);
  /* the sculpt studies its own hands; standing, she looks where she is going */
  B.neck.rotation.set(-0.13-0.05*run,look*0.35,0);
  B.head.rotation.set(-0.05,look*0.5,0);
  R.fitG.updateMatrixWorld(true);
  R.g.getWorldQuaternion(_gq);
  for(const s of [1,-1]){
   const S=s>0?'R':'L', p=ph+(s>0?0:Math.PI), sw=Math.sin(p), lift=Math.max(0,Math.cos(p));
   const th=amp*(0.40+0.16*run)*sw;                                           // thigh swing, ahead positive
   const knee=0.07+amp*(0.52+0.60*run)*lift+amp*0.10*Math.max(0,-sw);         // clears the ground coming through, a little at push-off
   aim(B['thigh'+S],seg(B['thigh'+S],B['shin'+S]),dir(s*0.075,-Math.cos(th),Math.sin(th)));
   aim(B['shin'+S],seg(B['shin'+S],B['foot'+S]),dir(s*0.02,-Math.cos(th-knee),Math.sin(th-knee)));
   const toe=0.30+amp*0.45*Math.max(0,-sw)*(1-lift);                         // the toe drops at push-off behind her
   aim(B['foot'+S],tip(B['foot'+S],TOE,s),dir(s*0.06,-toe,1));
   const as=-amp*(0.30+0.24*run)*sw;                                          // arms swing against the legs
   aim(B['arm'+S],seg(B['arm'+S],B['fore'+S]),dir(s*0.20,-1,Math.tan(as)));
   aim(B['fore'+S],seg(B['fore'+S],B['hand'+S]),dir(s*0.10,-1,Math.tan(as)+0.30+0.95*run));   // the elbows bend to run
   aim(B['hand'+S],tip(B['hand'+S],KNUCKLE,s),dir(s*0.05,-1,Math.tan(as)+0.28+0.6*run));
  }
  /* her feet on the ground: the lower sole wherever the stride has put it */
  let lo=1e9; for(const S of ['R','L']){B['foot'+S].getWorldPosition(_a);R.g.worldToLocal(_a);if(_a.y<lo)lo=_a.y;}
  R.g.position.y=-lo+SOLE;
 }

 /* ---------------------------------------------------------------- the horse left standing - */
 const name=()=>{const h=H.myHorses[H.rideIdx()];return h?h.name:'your horse';};
 function buildHorse(x,z,heading){
  const i=H.rideIdx(), h=H.myHorses[i]; if(!h)return null;
  const parts=H.makeHorse({colors:h.colors,horn:h.horn,wings:h.wings,dragon:h.dragon,coat:h.coat,tack:h.tack||'#7a583a',bridle:true,seed:h.id||0,breed:h.breed});
  const g=parts.group; g.rotation.order='YXZ';
  let sc=1; try{sc=RS.horseScale?RS.horseScale(h):(player.mesh?player.mesh.scale.x:1);}catch(e){}
  g.scale.setScalar(sc); g.position.set(x,Wd.groundH(x,z),z); g.rotation.y=heading; scene.add(g);
  const e={parts,x,z,heading,sc,idx:i,id:h.id,phase:Math.random()*6,speed:0,graze:0,grazeT:3+Math.random()*5};
  e.dress=()=>{try{H.dressWithRig(e,parts,h.colors,{breed:h.breed,mine:true,foal:h.foal,coat:h.coat,dragon:h.dragon,tailCol:h.tailCol,mark:h.mark,markCol:h.markCol,mark2:h.mark2,seed:h.id,saddle:true});}catch(err){}};
  e.dress();
  return e;
 }
 function dropHorse(){
  const e=ST.horse; ST.horse=null; if(!e)return;
  try{if(RS.disposeHorseEnt)RS.disposeHorseEnt(e);else scene.remove(e.parts.group);}catch(err){try{scene.remove(e.parts.group);}catch(x){}}
 }
 /* Two circles along its length, so she walks round the horse instead of through it. */
 function placeHorseCols(){
  const e=ST.horse; if(!e)return;
  if(!ST.cols.length){ST.cols=[{x:0,z:0,r:0.42*e.sc,onFoot:true},{x:0,z:0,r:0.42*e.sc,onFoot:true}];for(const c of ST.cols)Wd.colliders.push(c);}
  const fx=Math.sin(e.heading),fz=Math.cos(e.heading),L=0.62*e.sc;
  ST.cols[0].x=e.x+fx*L;ST.cols[0].z=e.z+fz*L;ST.cols[1].x=e.x-fx*L;ST.cols[1].z=e.z-fz*L;
 }
 function dropHorseCols(){for(const c of ST.cols){const k=Wd.colliders.indexOf(c);if(k>=0)Wd.colliders.splice(k,1);}ST.cols=[];}

 /* ---------------------------------------------------------------- fences ---------------- */
 /* Does the straight line a->b cross a fence rail (G.world.walls, the arena and pasture rails)? The game only keeps a
    rider out of a rail she walks into; a step that starts on the far side of it is simply on the far side. */
 function crossWall(ax,az,bx,bz){
  for(const w of (Wd.walls||[])){
   const ex=w.x2-w.x1,ez=w.z2-w.z1, fx=bx-ax,fz=bz-az;
   const d1=ex*(az-w.z1)-ez*(ax-w.x1), d2=ex*(bz-w.z1)-ez*(bx-w.x1);
   const d3=fx*(w.z1-az)-fz*(w.x1-ax), d4=fx*(w.z2-az)-fz*(w.x2-ax);
   if(d1*d2<0&&d3*d4<0)return w;
  }
  return null;
 }
 /* where she steps down: the near side, a metre out, unless a rail or a building is there. Beside the arena's north rail
    the near side is the far side of the fence, and she used to land outside the arena, the rail between her and her horse. */
 function stepDownSpot(x,z,hd){
  const lx=Math.cos(hd),lz=-Math.sin(hd), fx=Math.sin(hd),fz=Math.cos(hd);
  const solid=(px,pz)=>Wd.colliders.some(c=>!c.onFoot&&!c.climb&&Math.hypot(px-c.x,pz-c.z)<c.r+0.45);
  for(const [a,b] of [[1.05,0],[-1.05,0],[0.75,0],[-0.75,0],[0,-1.5],[0,1.7]]){
   const px=x+lx*a+fx*b, pz=z+lz*a+fz*b;
   if(!crossWall(x,z,px,pz)&&!solid(px,pz))return [px,pz];
  }
  return [x+lx*0.45,z+lz*0.45];   // hemmed in on every side: right beside her
 }

 /* ---------------------------------------------------------------- off and on ------------ */
 function why(){
  if(ST.on)return 'already on foot';
  try{if(G.course&&G.course.get&&G.course.get())return 'Finish the course first';}catch(e){}
  if(player.flying||(player.y||0)>0.05)return 'Land first';
  try{if(G.worldPkg&&G.worldPkg.vehicle&&G.worldPkg.vehicle())return 'Not from up here';}catch(e){}
  if(document.body.classList.contains('fpv'))return 'Not in first person';
  if(!player.rider||!player.rider.sk||!player.mesh)return 'One moment…';
  return '';
 }
 function dismount(){
  const w=why(); if(w){toast('🐴 '+w);return false;}
  const x=player.pos.x,z=player.pos.z,hd=player.heading;
  player.speed=0; player.vy=0; player.y=0;
  ST.horse=buildHorse(x,z,hd); if(!ST.horse){toast('🐴 One moment…');return false;}
  ST.idx=H.rideIdx();
  /* she steps down on the near side, the horse's left, a metre out, or wherever there is room on this side of the fence */
  const spot=stepDownSpot(x,z,hd);
  player.pos.x=spot[0]; player.pos.z=spot[1]; player.heading=hd;
  ST.R=player.rider; ST.mesh=player.mesh;
  ST.W=new THREE.Group(); ST.W.name='on-foot rider'; ST.W.scale.setScalar(ST.R.walkScale||RIDER_H); scene.add(ST.W);   // the character is her own size already
  ST.W.add(ST.R.g);
  player.mesh.visible=false;
  player.onFoot=true; ST.on=true; ST.snap=true; ST.cam=null; ST.camYaw=null; ST.ph=0; ST.amp=0; ST.run=0;
  resetBody();
  document.body.classList.add('on-foot');
  placeHorseCols();
  ST.thing={kind:'mount',id:'on-foot-horse',g:null,x:ST.horse.x,z:ST.horse.z,reach:2.9,label:()=>'🐴 Ride '+name()+' (E)',use:()=>mount()};
  Wd.things.push(ST.thing);
  try{if(Wd.miniMarkers){ST.mini={x:ST.horse.x,z:ST.horse.z,col:'#f5d63d',r:3};Wd.miniMarkers.push(ST.mini);}}catch(e){}
  syncButton();
  toast('🚶 On foot — walk with W A S D, hold Shift to jog. Press E at '+name()+' to ride again.');
  return true;
 }
 function mount(opt){
  if(!ST.on)return false;
  const e=ST.horse;
  dropHorseCols();
  if(opt&&opt.here){/* the course or the new horse has already put her where she should be */}
  else if(e){player.pos.x=e.x;player.pos.z=e.z;player.heading=e.heading;}
  player.speed=0;
  if(ST.R&&ST.R.g&&ST.R.g.parent===ST.W)ST.W.remove(ST.R.g);
  const R=player.rider;
  if(R&&R.g&&player.mesh&&R.g.parent!==player.mesh)player.mesh.add(R.g);
  if(R&&R.g)R.g.scale.set(1,1,1);
  if(player.mesh)player.mesh.visible=true;
  dropHorse();
  if(ST.W){scene.remove(ST.W);ST.W=null;}
  if(ST.thing){const k=Wd.things.indexOf(ST.thing);if(k>=0)Wd.things.splice(k,1);ST.thing=null;}
  if(ST.mini&&Wd.miniMarkers){const k=Wd.miniMarkers.indexOf(ST.mini);if(k>=0)Wd.miniMarkers.splice(k,1);ST.mini=null;}
  player.onFoot=false; ST.on=false; ST.call=null; ST.mountOnArrive=false; ST.R=null; ST.mesh=null;
  document.body.classList.remove('on-foot');
  syncButton();
  try{G.sNeigh&&G.sNeigh();}catch(err){}
  return true;
 }
 /* E at the horse or the saddle button from close by gets her up; from further off the saddle
    button whistles first and puts her up when the horse arrives. */
 function callHorse(andMount){
  const e=ST.horse; if(!ST.on||!e)return;
  const d=Math.hypot(e.x-player.pos.x,e.z-player.pos.z);
  if(d<3.2){if(andMount)mount();else toast('🐴 '+name()+' is right here — press E to ride');return;}
  ST.call={t:40}; ST.mountOnArrive=!!andMount;
  try{G.sChime&&G.sChime();}catch(err){}
  toast('🎵 '+name()+' is coming!');
 }
 function toggle(){ if(ST.on)callHorse(true); else dismount(); }

 /* The rider or the mount can be rebuilt under us — the stable turning a horse out, a new horse
    picked in the Horse Overview, E beside a pasture horse. A different horse means she is riding
    it now, so she goes straight up on it; the same horse just means a fresh rider to stand up. */
 function resync(){
  const i=H.rideIdx(), h=H.myHorses[i];
  if(ST.horse&&(ST.idx!==i||(h&&ST.horse.id!==h.id))){
   if(ST.R&&ST.R.g&&ST.R.g.parent===ST.W)ST.W.remove(ST.R.g);
   ST.R=player.rider; ST.mesh=player.mesh;
   mount({here:true});
   toast('🐴 Riding '+name()+'!');
   return;
  }
  if(ST.R&&ST.R.g&&ST.R.g.parent===ST.W)ST.W.remove(ST.R.g);
  ST.R=player.rider; ST.mesh=player.mesh;
  if(ST.R&&ST.R.g)ST.W.add(ST.R.g);
  if(ST.R&&ST.W)ST.W.scale.setScalar(ST.R.walkScale||RIDER_H);
  if(player.mesh)player.mesh.visible=false;
 }

 /* ---------------------------------------------------------------- walking -------------- */
 /* ---------------------------------------------------------------- moving about --------- */
 /* Walking, running, jumping, falling, climbing, wading and swimming are one body in the world: ST.fy
    is where her feet are and ST.vy how fast that is changing, and each frame she stands on whatever is
    under her — the ground, a rock she has climbed, the bed of a river she is wading, or the surface of
    water too deep to stand in.
      W walks, Shift (or the run toggle) runs flat out, Space (or the jump button) jumps.
      Walk into rock (the meadow outcrops, and whatever else is in G.world.climbables) and keep walking:
      she climbs it, hands and feet, and stands on top. Let go, or walk off an edge, and she falls; a
      long drop ends in a roll.
      Water: past her knees it slows her, and deeper than her thighs she swims, treading water or
      stroking when she moves: the river's channel and the middle of Loon Lake. */
 const WALK=1.45, RUN=5.5, SWIM=1.35, SWIM_FAST=2.2, SWIM_D=0.72, WADE_D=0.3, STEP=0.45, CLIMB=1.25, GRAV=9.8;   // the river runs about 0.8 m deep: she swims it, as the horse does
 const LAKE={x:20,z:16,r:4.5};
 /* the river's bed is carved into the terrain; Loon Lake is a disc laid on the ground, so its depth is
    the one the horse swims it at (horse-roster) and the ground itself hides whatever is below */
 function waterAt(x,z){
  let depth=0,surface=0;
  const dl=Math.hypot(x-LAKE.x,z-LAKE.z);
  if(dl<LAKE.r){const d=0.35+0.9*(1-dl/LAKE.r);if(d>depth){depth=d;surface=Wd.groundH(LAKE.x,LAKE.z)+0.02;}}
  try{const rz=Wd.riverZ(x);if(Math.abs(z-rz)<9){const th=Wd.terrainH(x,z);if(Wd.groundH(x,z)<=th+0.3){const lv=Wd.riverLevel(x);if(lv-th>depth){depth=lv-th;surface=lv;}}}}catch(e){}
  return depth>0.02?{depth,surface}:null;
 }
 const ray=new THREE.Raycaster(), _ro=new THREE.Vector3(), _rd=new THREE.Vector3(0,-1,0);
 function rockAt(x,z){            // the top of any climbable rock under (x,z), and which rock
  let best=-Infinity,hit=null;
  for(const c of (Wd.climbables||[])){const dx=x-c.x,dz=z-c.z;if(dx*dx+dz*dz>c.r*c.r)continue;
   _ro.set(x,(c.y||0)+c.r*2+4,z);ray.set(_ro,_rd);ray.far=c.r*2+10;
   const hs=ray.intersectObject(c.mesh,false);if(hs.length&&hs[0].point.y>best){best=hs[0].point.y;hit=c;}}
  return hit?{h:best,c:hit}:null;
 }
 /* where her feet would rest at (x,z) */
 function footing(x,z){
  const wa=waterAt(x,z), rk=rockAt(x,z);
  let h=Wd.groundH(x,z),kind='ground',rock=null;
  if(wa){kind=wa.depth>SWIM_D?'swim':wa.depth>WADE_D?'wade':'ground';h=kind==='swim'?wa.surface:wa.surface-wa.depth;}
  if(rk&&rk.h>h){h=rk.h;kind='rock';rock=rk.c;}
  return {h,kind,rock,water:wa};
 }
 G.on('ride',RIDE=>{
  if(!ST.on)return;
  const m=ST.mode||'ground';
  let tg=RIDE.fwd?(RIDE.gallop?RUN:WALK):(RIDE.back?-0.9:0);
  if(m==='swim')tg=RIDE.fwd?(RIDE.gallop?SWIM_FAST:SWIM):(RIDE.back?-0.5:0);
  else if(m==='wade')tg*=0.6;
  if(ST.climbing)tg=RIDE.fwd?0.9:0;                      // pressed to the rock, the push is what climbs
  /* on the rock face: S lets go, Space pushes off it */
  if(ST.climbing&&(RIDE.back||(RIDE.jump&&!ST.jumpHeld)))ST.letGo=RIDE.back?'drop':'push';
  RIDE.target=tg; RIDE.acMul=m==='swim'?1.4:2.6; RIDE.agMul=m==='swim'?1.1:1.8; RIDE.noJump=true; RIDE.drain=0;
  ST.target=tg;
  /* her own jump, one per press, from anything she is standing on */
  if(RIDE.jump&&!ST.jumpHeld&&(m==='ground'||m==='rock')&&!ST.air&&!ST.climbing&&!ST.roll){
   const run=clamp((Math.abs(player.speed||0)-1.5)/3.5,0,1);
   ST.vy=3.3+0.6*run; ST.air=true; ST.fallFrom=ST.fy;
   try{G.beep&&G.beep(380,720,0.12,'sine',0.06);}catch(e){}   // a lighter hop than the horse's jump
  }
  ST.jumpHeld=!!RIDE.jump;
 });
 /* ripples round her in the water */
 const ripples=[]; let rippleT=0;
 function ripple(x,y,z,big){
  let r=ripples.find(q=>q.life<=0);
  if(!r){if(ripples.length>=8)return;const m=new THREE.Mesh(new THREE.RingGeometry(0.82,1,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
   m.rotation.x=-Math.PI/2;m.renderOrder=3;scene.add(m);r={m,life:0,big:false};ripples.push(r);}
  r.life=1;r.big=!!big;r.m.position.set(x,y+0.03,z);r.m.scale.setScalar(0.3);r.m.visible=true;
 }
 function tickRipples(dt){for(const r of ripples){if(r.life<=0)continue;r.life-=dt/(r.big?1.4:1.1);const k=1-Math.max(0,r.life);
  r.m.scale.setScalar(0.3+k*(r.big?2.4:1.4));r.m.material.opacity=Math.max(0,r.life)*(r.big?0.75:0.5);if(r.life<=0)r.m.visible=false;}}
 function resetBody(){ST.fy=Wd.groundH(player.pos.x,player.pos.z);ST.vy=0;ST.air=false;ST.climbing=false;ST.land=null;ST.roll=null;
  ST.swimW=0;ST.airW=0;ST.climbW=0;ST.climbPh=0;ST.mode='ground';ST.prev=null;ST.fallFrom=null;}
 G.on('tick',(dt,t)=>{
  if(!ST.on)return;
  dt=Math.min(dt||0.016,0.1);
  /* an event or a course puts her back in the saddle where it wants her */
  try{if(G.course&&G.course.get&&G.course.get()){mount({here:true});return;}}catch(e){}
  if(player.rider!==ST.R||player.mesh!==ST.mesh){resync();if(!ST.on)return;}
  if(player.mesh)player.mesh.visible=false;
  const R=ST.R; if(!R||!R.sk)return;
  /* A person pulls up in a stride or two, not in the three lengths a horse takes. The movement
     code slows everything at a horse's rate, so the rest of the stop is taken here. */
  if(Math.abs(ST.target||0)<Math.abs(player.speed||0)){player.speed+=((ST.target||0)-player.speed)*Math.min(1,dt*7);if(Math.abs(player.speed)<0.05&&!ST.target)player.speed=0;}
  const sp=Math.abs(player.speed||0);
  if(ST.fy==null)resetBody();
  /* Put somewhere, not walked there (fast travel, a quest, a story scene): three metres in one frame is
     more than she can run. Without this the body kept the height of where she had been (in the air
     over a meadow, or under a hill), and landing inside a rock's footprint read as walking into its
     face, which sent her straight back where she came from. She stands on whatever is under her now. */
  if(ST.prev&&Math.hypot(player.pos.x-ST.prev.x,player.pos.z-ST.prev.z)>3){resetBody();const f0=footing(player.pos.x,player.pos.z);ST.fy=f0.h;ST.mode=f0.kind==='swim'?'swim':f0.kind;}
  const prev=ST.prev||{x:player.pos.x,z:player.pos.z};
  let f=footing(player.pos.x,player.pos.z);
  /* a face of rock where she is stepping: she cannot walk into it, so back she goes — and if she is
     pushing on, up she climbs (from a jump too: she grabs it) until the rock ahead is a step, not a wall */
  const wasClimbing=ST.climbing; ST.climbing=false;
  /* too steep to walk is steeper than about 48 degrees, or a sudden step higher than her knee */
  const moved=Math.hypot(player.pos.x-prev.x,player.pos.z-prev.z), rise=f.h-ST.fy;
  if(f.kind==='rock'&&rise>0.02&&(rise>STEP||rise>moved*1.1)){
   player.pos.x=prev.x; player.pos.z=prev.z;
   if((ST.target||0)>0.05||(wasClimbing&&RIDE_FWD())){ST.climbing=true;ST.air=false;ST.vy=0;ST.fy+=CLIMB*dt;ST.climbPh+=dt*6.2;}
   f=footing(prev.x,prev.z);
  }
  /* not pushing, but still on the face: she hangs on where she is, until S or Space */
  if(!ST.climbing&&wasClimbing&&!ST.air&&!ST.letGo&&(ST.target||0)<=0.05){   // (pushing on over rock she can walk is walking)
   const fa=footing(player.pos.x+Math.sin(player.heading)*0.4,player.pos.z+Math.cos(player.heading)*0.4);
   if(fa.kind==='rock'&&fa.h>ST.fy-0.05){ST.climbing=true;ST.vy=0;}
  }
  if(ST.letGo){
   if(wasClimbing||ST.climbing){ST.climbing=false;ST.air=true;ST.fallFrom=ST.fy;ST.vy=ST.letGo==='push'?2.6:0;
    if(ST.letGo==='push'){player.pos.x-=Math.sin(player.heading)*0.35;player.pos.z-=Math.cos(player.heading)*0.35;f=footing(player.pos.x,player.pos.z);}}
   ST.letGo=null;
  }
  const floor=f.h, stick=0.05+sp*dt;
  if(ST.climbing){ ST.mode='climb'; }
  else if(ST.air){                                                  // off the ground: gravity
   ST.vy-=GRAV*dt; ST.fy+=ST.vy*dt;
   if(ST.fy<=floor){
    const wet=f.water&&f.water.depth>WADE_D, drop=(ST.fallFrom!=null?ST.fallFrom:ST.fy)-floor, hit=-ST.vy;
    ST.fy=floor; ST.vy=0; ST.air=false; ST.fallFrom=null;
    if(wet){ripple(player.pos.x,f.water.surface,player.pos.z,true);try{G.beep&&G.beep(260,120,0.18,'sine',0.07);}catch(e){}}
    else if(drop>2.2||hit>7.2)ST.roll={t:0,dur:1.05};
    else if(hit>2.4)ST.land={t:0,dur:0.42};
   }
  }
  else if(f.water&&f.water.depth>WADE_D){                           // in the water: she floats to her level, no falling
   ST.vy=0; ST.fy+=(floor-ST.fy)*Math.min(1,dt*(ST.fy>floor?2.6:6));
  }
  else if(ST.fy>floor+stick){ ST.air=true; ST.vy=Math.min(ST.vy||0,0); ST.fallFrom=ST.fy; }   // stepped off an edge
  else ST.fy+=(floor-ST.fy)*Math.min(1,dt*14);                       // on her feet: up a step, down a slope
  if(!ST.climbing&&!ST.air)ST.mode=f.kind;
  ST.rockOn=ST.mode==='rock'?f.rock:null;
  if(ST.land){ST.land.t+=dt;if(ST.land.t>=ST.land.dur)ST.land=null;}
  if(ST.roll){ST.roll.t+=dt;if(ST.roll.t>=ST.roll.dur)ST.roll=null;}
  ST.prev={x:player.pos.x,z:player.pos.z};
  ST.W.position.set(player.pos.x,ST.fy,player.pos.z);
  ST.W.rotation.y=player.heading;
  /* the water rings round her as she moves through it */
  if(f.water&&f.water.depth>WADE_D&&!ST.air){rippleT+=dt;if(rippleT>(sp>0.3?0.42:1.1)){rippleT=0;ripple(player.pos.x,f.water.surface,player.pos.z,false);}}
  tickRipples(dt);
  ST.run+=(clamp((sp-1.9)/1.1,0,1)-ST.run)*Math.min(1,dt*6);
  ST.amp+=((sp<0.08?0:Math.min(1,sp/1.1))-ST.amp)*Math.min(1,dt*8);
  const stride=1.25+0.85*ST.run;                                   // metres a full cycle (two steps)
  ST.ph+=(player.speed<0?-1:1)*sp*dt/stride*Math.PI*2;
  if(sp<0.08)ST.ph+=(Math.round(ST.ph/Math.PI)*Math.PI-ST.ph)*Math.min(1,dt*5);   // come to rest feet together
  ST.look+=(Math.sin(t*0.5)*0.18*(1-ST.amp)-ST.look)*Math.min(1,dt*1.5);
  const ease=(w,to,k)=>w+(to-w)*Math.min(1,dt*k);
  ST.swimW=ease(ST.swimW||0,ST.mode==='swim'?1:0,5);
  ST.airW=ease(ST.airW||0,ST.air&&!ST.climbing&&!(f.water&&f.water.depth>WADE_D)?1:0,10);
  ST.climbW=ease(ST.climbW||0,ST.climbing?1:0,8);
  /* the character: the animation library's clips, blended by what she is doing; the old sculpt is posed */
  if(R.locomote)R.locomote(dt,{speed:ST.climbing?0:player.speed,look:ST.look,air:ST.airW,
   land:ST.land?ST.land.t/ST.land.dur:null,roll:ST.roll?ST.roll.t/ST.roll.dur:null,
   swim:ST.swimW,swimMove:clamp(sp/1.1,0,1),climb:ST.climbW,climbPh:ST.climbPh});
  else pose(R,ST.ph,ST.amp,ST.run,t,ST.look);
  tickHorse(dt,t);
 });
 const RIDE_FWD=()=>(ST.target||0)>0.05;

 /* ---------------------------------------------------------------- the parked horse ------ */
 function tickHorse(dt,t){
  const e=ST.horse; if(!e)return;
  let sp=0;
  if(ST.call){
   let dx=player.pos.x-e.x,dz=player.pos.z-e.z,d=Math.hypot(dx,dz)||0.001;
   if(d>90){e.x=player.pos.x-dx/d*45;e.z=player.pos.z-dz/d*45;dx=player.pos.x-e.x;dz=player.pos.z-e.z;d=Math.hypot(dx,dz)||0.001;}
   if(d>2.4&&ST.call.t>0){
    if(!e.hop)e.heading+=angDiff(Math.atan2(dx,dz)-e.heading)*Math.min(1,dt*3.5);
    sp=d>18?8.5:d>6?4.4:2.0;
    /* a rail across her way: she jumps it, as the rider's horse would, instead of walking through it */
    if(!e.hop&&crossWall(e.x,e.z,e.x+Math.sin(e.heading)*1.9,e.z+Math.cos(e.heading)*1.9))e.hop={t:0,dur:0.8};
    if(e.hop)sp=Math.max(sp,4.6);
    e.x+=Math.sin(e.heading)*sp*dt; e.z+=Math.cos(e.heading)*sp*dt; ST.call.t-=dt;
   }else if(e.hop){
    sp=4.6; e.x+=Math.sin(e.heading)*sp*dt; e.z+=Math.cos(e.heading)*sp*dt;   // a jump already begun is finished, not frozen over the rail
   }else{
    ST.call=null;
    if(ST.mountOnArrive){ST.mountOnArrive=false;mount();return;}
    toast('🐴 '+name()+' trots up — press E to ride');
   }
  }
  /* keep off the buildings and the trees on the way over */
  if(sp>0)for(const c of Wd.colliders){if(c.onFoot)continue;const ox=e.x-c.x,oz=e.z-c.z,r=c.r+0.9,d2=ox*ox+oz*oz;if(d2<r*r&&d2>1e-6){const d=Math.sqrt(d2);e.x=c.x+ox/d*r;e.z=c.z+oz/d*r;}}
  /* and out of the rails, the way the game keeps the ridden horse out of them, except in the air over one */
  let hopY=0;
  if(e.hop){e.hop.t+=dt;const k=e.hop.t/e.hop.dur;if(k>=1)e.hop=null;else hopY=Math.sin(k*Math.PI)*1.15*(e.sc||1);}
  else if(sp>0)for(const w of (Wd.walls||[])){
   const ex=w.x2-w.x1,ez=w.z2-w.z1,tt=clamp(((e.x-w.x1)*ex+(e.z-w.z1)*ez)/(ex*ex+ez*ez||1),0,1);
   const cx=w.x1+ex*tt,cz=w.z1+ez*tt,ox=e.x-cx,oz=e.z-cz,d2=ox*ox+oz*oz,r=0.7;
   if(d2<r*r&&d2>1e-6){const d=Math.sqrt(d2);e.x=cx+ox/d*r;e.z=cz+oz/d*r;}
  }
  e.speed+=(sp-e.speed)*Math.min(1,dt*4);
  /* standing about it grazes now and then */
  if(e.speed<0.3){e.grazeT-=dt;if(e.grazeT<=0){e.graze=e.graze?0:1;e.grazeT=e.graze?5+Math.random()*7:3+Math.random()*6;}}else e.graze=0;
  e.parts.group.position.set(e.x,Wd.groundH(e.x,e.z)+hopY,e.z); e.parts.group.rotation.y=e.heading;
  if(!e.rig)e.dress();
  try{
   const A=G.anim||RS, gait=A.gaitFor?A.gaitFor(e.speed):A.GAITS.walk;
   e.phase+=e.speed>0.3?(e.speed*dt/(gait.len||2.5))*Math.PI*2:dt*0.9;
   A.animateHorse(e.parts,e.phase,e.speed>0.3?gait.amp:0.05,gait,true,t,e.graze,dt);
   A.tickRig(e,e.speed,dt,t,e.graze);
  }catch(err){}
  placeHorseCols();
  if(ST.thing){ST.thing.x=e.x;ST.thing.z=e.z;}
  if(ST.mini){ST.mini.x=e.x;ST.mini.z=e.z;}
 }

 /* ---------------------------------------------------------------- the camera ------------ */
 const _eye=new THREE.Vector3(),_at=new THREE.Vector3();
 G.on('camera',c=>{
  if(!ST.on)return false;
  /* Every camera hook runs every frame and the last one to move the camera wins, so this one has to
     stand aside by name for anything else that frames a shot: the Horse Overview, first person,
     watching a club mate, the balloon and the ferry. Photo mode has no camera of its own, so she
     keeps this one there. */
  const bc=document.body.classList;
  if(bc.contains('se-ov-open')||bc.contains('fpv'))return false;
  try{if(G.social&&G.social.spectate)return false;}catch(e){}
  try{if(G.worldPkg&&G.worldPkg.vehicle&&G.worldPkg.vehicle())return false;}catch(e){}
  const cam=G.camera, dt=Math.min(c.dt||0.016,0.1);
  const px=player.pos.x,pz=player.pos.z,gy=Wd.groundH(px,pz);
  if(ST.camYaw==null||ST.snap)ST.camYaw=player.heading;
  ST.camYaw+=angDiff(player.heading-ST.camYaw)*(1-Math.exp(-(3.2+Math.abs(player.speed))*dt));
  /* The same hands as in the saddle: drag to turn the view round her, the wheel to come in close or
     stand back (the riding camera's own orbit, G.world.camOrbit, which swings back behind her as she
     walks on, as it does behind the horse). Its riding numbers scaled to a person: 6.2 m and 0.27 rad
     behind a horse is 3.4 m and 0.21 behind her. */
  const O=Wd.camOrbit, yawOff=O?O.yaw:0, pitch=O?Math.max(0.02,O.pitch-0.06):0.21, dist=O?O.dist*0.55:3.4;
  const ang=ST.camYaw+yawOff, hd=dist*Math.cos(pitch);
  const fy=ST.fy!=null?ST.fy:gy, lookH=fy+(ST.mode==='swim'?0.4:1.22);   // up a rock or down in the water, the camera is on her
  _at.set(px,lookH,pz);
  _eye.set(px-Math.sin(ang)*hd,lookH+dist*Math.sin(pitch),pz-Math.cos(ang)*hd);
  try{Wd.followCamera.resolve(_at,_eye,_eye);}catch(e){}
  if(!ST.cam||ST.snap){ST.cam=_eye.clone();ST.snap=false;}else ST.cam.lerp(_eye,1-Math.exp(-7*dt));
  cam.position.copy(ST.cam);
  // A clear destination can still be reached by smoothing through a wall.
  Wd.followCamera.resolve(_at,cam.position,cam.position);
  ST.cam.copy(cam.position);cam.lookAt(_at);
  if(Math.abs(cam.fov-55)>0.05){cam.fov+=(55-cam.fov)*Math.min(1,dt*4);cam.updateProjectionMatrix();}
  return true;
 });

 /* ---------------------------------------------------------------- keys ------------------ */
 /* F gets off and on. On a winged horse that is moving or aloft, F is still fly. */
 G.on('key',e=>{
  if(e.code!=='KeyF'||e.repeat)return false;
  if(ST.on){toggle();return true;}
  const h=H.myHorses[H.rideIdx()];
  if(h&&h.wings&&(player.flying||Math.abs(player.speed||0)>0.6))return false;
  dismount(); return true;
 });
 /* On foot the horse's own keys have nothing to act on: the tricks, the emotes, the breath.
    The whistle calls the horse she left standing rather than one from the pasture. */
 window.addEventListener('keydown',e=>{
  if(!ST.on)return;
  const tag=document.activeElement&&document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  const wh=(G.key&&G.key('whistle'))||'KeyH';
  if(e.code===wh){e.stopImmediatePropagation();e.preventDefault();if(!e.repeat)callHorse(false);return;}
  if(/^Digit[1-8]$/.test(e.code)||['KeyQ','KeyR','KeyV','KeyB','KeyX'].includes(e.code)){e.stopImmediatePropagation();}
 },true);

 /* ---------------------------------------------------------------- the saddle button ----- */
 const INK='#f6ecd2',GLASS='rgba(18,22,36,0.46)',RIM='rgba(246,236,210,0.82)';
 const saddle='<path d="M3.6 10.2c3.1.4 4.9-2.5 8.4-2.5s5.3 2.9 8.4 2.5"/><path d="M5.8 10.9c.5 3 2.9 4.9 6.2 4.9s5.7-1.9 6.2-4.9"/><path d="M12 15.8v2.4M9.8 21a2.2 2.2 0 0 1 4.4 0z"/>';
 const walker='<circle cx="12.4" cy="4.6" r="1.8"/><path d="M11.8 8.2l-1.6 5.4 2.9 2.4.9 4.6M10.4 12.6l-2.6 2.2M12.2 9.4l3.3 1.7 1.6 2.3M10.2 13.6l-2 6.8"/>';
 const svg=p=>'url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="'+GLASS+'" stroke="'+RIM+'" stroke-width="2"/><g transform="translate(9.6 9.6) scale(1.2)" fill="none" stroke="'+INK+'" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'+p+'</g></svg>')+'")';
 if(!$('onFootCss')){
  const st=document.createElement('style'); st.id='onFootCss';
  st.textContent='#seMount{position:fixed;width:62px;height:62px;right:calc(210px + env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));'
   +'border:0;padding:0;border-radius:50%;background-color:transparent;background-size:100% 100%;background-repeat:no-repeat;cursor:pointer;pointer-events:auto;z-index:7}'
   +'#seMount:hover{filter:drop-shadow(0 2px 4px rgba(0,0,0,.35)) brightness(1.15)}#seMount:active{transform:scale(.94)}'
   +'body.on-foot #flyBtn,body.on-foot #breathBtn{display:none!important}'   // the jump button stays: she can jump
   +'body.se-ov-open #seMount,body.posing #seMount{display:none!important}'
   /* on a phone the stick keeps the bottom-left (se-hud): the saddle sits just left of the jump, out of the stick's ring */
   +'@media (max-width:760px){#seMount{width:52px;height:52px;right:calc(122px + env(safe-area-inset-right));bottom:calc(96px + env(safe-area-inset-bottom))}}';
  document.head.appendChild(st);
 }
 const btn=document.createElement('button'); btn.id='seMount'; btn.type='button';
 (($('seHudRoot'))||document.body).appendChild(btn);
 function syncButton(){
  const t=ST.on?'Ride '+name()+' (F)':'Get off and walk (F)';
  btn.title=t; btn.setAttribute('aria-label',t);
  btn.style.backgroundImage=svg(ST.on?saddle:walker);
 }
 syncButton();
 btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggle();});
 /* the HUD whistle calls the parked horse while she is on foot */
 document.addEventListener('click',e=>{
  if(!ST.on)return; const t=e.target; if(!t||!t.closest)return;
  if(t.closest('#seWhistle')||t.closest('#whistleBtn')){e.stopPropagation();e.preventDefault();callHorse(false);}
 },true);

 G.onFoot={get on(){return ST.on;},dismount,mount,toggle,callHorse,pose:(R,ph,amp,run,t,look)=>R&&R.locomote?R.locomote(0.016,{speed:0,look}):pose(R,ph,amp,run,t,look),
  horse:()=>ST.horse?{x:ST.horse.x,z:ST.horse.z,heading:ST.horse.heading,sc:ST.horse.sc,group:ST.horse.parts.group}:null,
  walker:()=>ST.W,footing:(x,z)=>footing(x,z),waterAt:(x,z)=>waterAt(x,z),standingOn:()=>ST.on&&ST.mode==='rock'?ST.rockOn:null,
  state:()=>({on:ST.on,horse:ST.horse?{x:+ST.horse.x.toFixed(2),z:+ST.horse.z.toFixed(2),hop:!!ST.horse.hop}:null,calling:!!ST.call,
   mode:ST.mode||null,feet:ST.fy!=null?+(ST.fy-Wd.groundH(player.pos.x,player.pos.z)).toFixed(2):null,climbing:!!ST.climbing,air:!!ST.air,rolling:!!ST.roll})};
 G.on('state',o=>{o.onFoot=G.onFoot.state();});
}
