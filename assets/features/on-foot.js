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
  /* she steps down on the near side, the horse's left, a metre out */
  const lx=Math.cos(hd),lz=-Math.sin(hd);
  player.pos.x=x+lx*1.05; player.pos.z=z+lz*1.05; player.heading=hd;
  ST.R=player.rider; ST.mesh=player.mesh;
  ST.W=new THREE.Group(); ST.W.name='on-foot rider'; ST.W.scale.setScalar(ST.R.walkScale||RIDER_H); scene.add(ST.W);   // the character is her own size already
  ST.W.add(ST.R.g);
  player.mesh.visible=false;
  player.onFoot=true; ST.on=true; ST.snap=true; ST.cam=null; ST.camYaw=null; ST.ph=0; ST.amp=0; ST.run=0;
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
 G.on('ride',RIDE=>{
  if(!ST.on)return;
  RIDE.target=RIDE.fwd?(RIDE.gallop?3.3:1.45):(RIDE.back?-0.9:0);
  RIDE.acMul=2.6; RIDE.agMul=1.8; RIDE.noJump=true; RIDE.drain=0;
  ST.target=RIDE.target;
 });
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
  ST.W.position.set(player.pos.x,Wd.groundH(player.pos.x,player.pos.z),player.pos.z);
  ST.W.rotation.y=player.heading;
  ST.run+=(clamp((sp-1.9)/1.1,0,1)-ST.run)*Math.min(1,dt*6);
  ST.amp+=((sp<0.08?0:Math.min(1,sp/1.1))-ST.amp)*Math.min(1,dt*8);
  const stride=1.25+0.85*ST.run;                                   // metres a full cycle (two steps)
  ST.ph+=(player.speed<0?-1:1)*sp*dt/stride*Math.PI*2;
  if(sp<0.08)ST.ph+=(Math.round(ST.ph/Math.PI)*Math.PI-ST.ph)*Math.min(1,dt*5);   // come to rest feet together
  ST.look+=(Math.sin(t*0.5)*0.18*(1-ST.amp)-ST.look)*Math.min(1,dt*1.5);
  /* the character walks with the animation library's own idle, walk and jog; the old sculpt is posed */
  if(R.locomote)R.locomote(dt,{speed:player.speed,look:ST.look}); else pose(R,ST.ph,ST.amp,ST.run,t,ST.look);
  tickHorse(dt,t);
 });

 /* ---------------------------------------------------------------- the parked horse ------ */
 function tickHorse(dt,t){
  const e=ST.horse; if(!e)return;
  let sp=0;
  if(ST.call){
   let dx=player.pos.x-e.x,dz=player.pos.z-e.z,d=Math.hypot(dx,dz)||0.001;
   if(d>90){e.x=player.pos.x-dx/d*45;e.z=player.pos.z-dz/d*45;dx=player.pos.x-e.x;dz=player.pos.z-e.z;d=Math.hypot(dx,dz)||0.001;}
   if(d>2.4&&ST.call.t>0){
    e.heading+=angDiff(Math.atan2(dx,dz)-e.heading)*Math.min(1,dt*3.5);
    sp=d>18?8.5:d>6?4.4:2.0;
    e.x+=Math.sin(e.heading)*sp*dt; e.z+=Math.cos(e.heading)*sp*dt; ST.call.t-=dt;
   }else{
    ST.call=null;
    if(ST.mountOnArrive){ST.mountOnArrive=false;mount();return;}
    toast('🐴 '+name()+' trots up — press E to ride');
   }
  }
  /* keep off the buildings and the trees on the way over */
  if(sp>0)for(const c of Wd.colliders){if(c.onFoot)continue;const ox=e.x-c.x,oz=e.z-c.z,r=c.r+0.9,d2=ox*ox+oz*oz;if(d2<r*r&&d2>1e-6){const d=Math.sqrt(d2);e.x=c.x+ox/d*r;e.z=c.z+oz/d*r;}}
  e.speed+=(sp-e.speed)*Math.min(1,dt*4);
  /* standing about it grazes now and then */
  if(e.speed<0.3){e.grazeT-=dt;if(e.grazeT<=0){e.graze=e.graze?0:1;e.grazeT=e.graze?5+Math.random()*7:3+Math.random()*6;}}else e.graze=0;
  e.parts.group.position.set(e.x,Wd.groundH(e.x,e.z),e.z); e.parts.group.rotation.y=e.heading;
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
  _at.set(px,gy+1.22,pz);
  _eye.set(px-Math.sin(ST.camYaw)*3.4,gy+1.95,pz-Math.cos(ST.camYaw)*3.4);
  try{Wd.followCamera.resolve(_at,_eye,_eye);}catch(e){}
  if(!ST.cam||ST.snap){ST.cam=_eye.clone();ST.snap=false;}else ST.cam.lerp(_eye,1-Math.exp(-7*dt));
  cam.position.copy(ST.cam); cam.lookAt(_at);
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
   +'body.on-foot #seJump,body.on-foot #flyBtn,body.on-foot #breathBtn,body.on-foot #tJump{display:none!important}'
   +'body.se-ov-open #seMount,body.posing #seMount{display:none!important}'
   +'@media (max-width:760px){#seMount{width:52px;height:52px;right:calc(150px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom))}}';
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
  walker:()=>ST.W,state:()=>({on:ST.on,horse:ST.horse?{x:+ST.horse.x.toFixed(2),z:+ST.horse.z.toFixed(2)}:null,calling:!!ST.call})};
 G.on('state',o=>{o.onFoot=G.onFoot.state();});
}
