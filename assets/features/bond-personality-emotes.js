/* Feature package 'bond-personality-emotes'.
   Bond levels, the six personalities and their behaviour template, horse emotes on the artist
   rig (rear, kick, lie down, bow, nuzzle, head toss), petting animations that grow with bond,
   the whistle, magnificent ribbons, exhaustion reactions, wildlife spooks, coat dirt and the
   brush emote, rider emotes and the campfire guitar.

   Schema other packages read:
     G.horse.bondLevel(h)  0..5 (h defaults to the ridden horse)      G.horse.persOf(h)
     G.horse.addBond(s,h,x,kind) -> gain (kinds feed water groom pet ride ribbon)
     G.horse.horseEmotes.apply(rig,emote,env,t)   G.horse.riderEmote(type)   G.horse.RIDER_EMOTES
     RIG.emote = {type,t,dur}  on the ridden rig; remote rigs mirror it through the /pos packet (em, rem).
   Nothing runs at import time. */
export const id='bond-personality-emotes';

/* ---- the personality behaviour template ------------------------------------------------ */
const PERS_DEFAULT={feed:1,water:1,groom:1,pet:1,ride:1,ribbon:1,whistleLv:1,exhaust:'slow',exhaustEmote:'toss',fearless:false,spookMul:1,spookShort:false,recover:1};
const PERS_FILL={
 energetic:{ride:1.5,feed:1.3,ribbon:1,whistleLv:0,exhaust:'balk',exhaustEmote:'toss',fearless:false,recover:1.15,
  desc:'quick off the mark and eats like a horse; bonds on the trail, blows hard when spent, comes to any whistle'},
 relaxed:{groom:2,ride:1,ribbon:1,whistleLv:0,exhaust:'slow',fearless:true,recover:1,
  desc:'calm and steady; loves a grooming, never spooks, comes to any whistle'},
 social:{pet:2,feed:1.5,ride:1,ribbon:0.5,whistleLv:0,exhaust:'slow',fearless:false,
  desc:'bonds fast over petting and treats; cares little for ribbons, comes to any whistle'},
 alert:{ride:1.2,pet:1,ribbon:1,whistleLv:1,exhaust:'slow',fearless:false,spookMul:1.6,spookShort:true,
  desc:'notices everything and turns a shade sharper; shies easily but settles fast'},
 aloof:{ribbon:2.5,feed:1.5,ride:0.25,pet:0.5,whistleLv:2,exhaust:'stop',exhaustEmote:'toss',fearless:true,bondLow:0.6,spBond:1.06,
  desc:'slow to trust; bonds over magnificent ribbons and food, barely over riding; ignores the whistle until bond Lv 2; plants its feet when blown; unafraid of wildlife'},
 challenging:{ride:1.3,ribbon:1.5,pet:0.7,whistleLv:2,exhaust:'stop',exhaustEmote:'rear',fearless:false,agLow:0.9,agHigh:1.12,
  desc:'tests the rider: awkward until the bond is there, then brilliant; bonds on hard rides and ribbons; ignores the whistle until bond Lv 2; rears when blown'},
};
const BOND_LEVELS=[0,20,40,60,80,100];
const BOND_NAMES=['Stranger','Acquaintance','Companion','Partner','Kindred','Heart-bonded'];
const BOND_UNLOCKS={1:'Whistle answers (most temperaments) · 🦵 Kick trick',2:'💨 Sprint burst · 🙇 Bow trick · withers-scratch petting',3:'🛑 Sliding stop · 😴 Lie-down trick · aloof horses answer the whistle',4:'Treat-bow petting · 8% less stamina drain',5:'Lie-down cuddle · heart sparkle at the gallop · 10% less stamina drain'};
const RIDE_BOND_CAP=8;          // bond a day from riding alone
const PET_ANIMS=[{id:'stroke',lvl:0,em:'nuzzle',label:'Stroke the neck'},{id:'scratch',lvl:2,em:'toss',label:'Withers scratch'},{id:'treat',lvl:4,em:'bow',label:'Treat bow'},{id:'cuddle',lvl:5,em:'liedown',label:'Lie-down cuddle'}];

/* ---- horse emote poses on the artist rig ------------------------------------------------
   Additive pitch (about the horse's own lateral axis, positive = nose down / hoof back) and
   yaw per named joint, blended by the emote envelope. The mount's own lift and pitch for each
   emote stay in EMOTES (lift/pitch) and are applied to the mesh by the game. */
const POSES={
 rear:{FLupperarm:-1.05,FLforearm:1.35,FLcannon:0.7,FRupperarm:-0.85,FRforearm:1.45,FRcannon:0.55,HLthigh:-0.3,HRthigh:-0.3,necklower:-0.3,neckupper:-0.2,head:-0.15},
 bow:{FLupperarm:-0.75,FLforearm:-0.15,FRupperarm:0.35,FRforearm:1.35,FRcannon:0.85,necklower:0.45,neckupper:0.3,head:0.25},
 liedown:{FLupperarm:0.35,FLforearm:1.5,FLcannon:1.05,FRupperarm:0.35,FRforearm:1.5,FRcannon:1.05,HLthigh:0.55,HLshin:-1.15,HLcannon:1.35,HRthigh:0.55,HRshin:-1.15,HRcannon:1.35,necklower:0.12},
 nuzzle:{necklower:0.35,neckupper:0.2,head:0.1,yaw:{necklower:0.55,neckupper:0.35,head:0.25}},
 toss:{necklower:-0.22,osc:{head:0.38,neckupper:0.14}},
 kick:{HLthigh:1.05,HLshin:-0.35,HLcannon:0.65,HRthigh:1.0,HRshin:-0.35,HRcannon:0.6,necklower:0.3,neckupper:0.15,head:0.1},
};
/* the old index-based hero rig, should one ever come back: head 6, spine 2, legs by chain */
const HERO_IDX={head:6,neckupper:5,necklower:4,FLupperarm:14,FLforearm:15,FLcannon:16,FRupperarm:8,FRforearm:9,FRcannon:10,HLthigh:28,HLshin:29,HLcannon:30,HRthigh:23,HRshin:24,HRcannon:25};

export function install(G){
 const {THREE,$}=G;
 const LOG=[]; const toast=m=>{LOG.push(String(m));if(LOG.length>30)LOG.shift();try{G.toast(m);}catch(e){}};
 const PERS=G.tables.PERS, EMOTES=G.tables.EMOTES, KEYMAP=G.tables.KEYMAP;
 const player=G.horse.player;
 for(const k in PERS_FILL){PERS[k]=PERS[k]||{};Object.assign(PERS[k],PERS_FILL[k]);}
 const persOf=h=>Object.assign({},PERS_DEFAULT,(h&&PERS[h.pers])||{});
 const ridden=()=>G.horse.ridden();
 const bondLevel=h=>{h=h===undefined?ridden():h;return Math.max(0,Math.min(5,Math.floor(((h&&h.bond)||0)/20)));};
 const persWhistleOk=h=>bondLevel(h)>=persOf(h).whistleLv;
 const persTraits=h=>{const P=persOf(h);const src=[['ribbon','ribbons'],['feed','food'],['ride','riding'],['pet','petting'],['groom','grooming']].filter(x=>(P[x[0]]||1)>=1.3).map(x=>x[1]);
  return 'Bonds from: '+(src.length?src.join(', '):'everything evenly')+' · '+(P.whistleLv<=0?'always answers the whistle':'answers the whistle from bond Lv '+P.whistleLv)+' · when blown: '+({stop:'stops dead and sulks',balk:'balks for a moment',slow:'slows to a walk'}[P.exhaust]||'slows')+' · '+(P.fearless?'unafraid of wildlife':P.spookMul>1?'spooks easily':'can spook');};

 /* ---- save fields ---------------------------------------------------------------------- */
 G.save.ensure(s=>{s.emotes=s.emotes||{};if(s.magnif==null)s.magnif=0;if(s.whistleHorse===undefined)s.whistleHorse=null;if(s.dirtSeen==null)s.dirtSeen=0;});
 G.save.ensureHorse(h=>{if(h.bondDay===undefined)h.bondDay=null;});

 /* ---- bond ------------------------------------------------------------------------------ */
 const levelToasts=[];
 function addBond(s,h,x,kind){
  if(!h)return 0;
  const before=bondLevel(h), g=G.horse.bondGain(h,x,kind);
  h.bond=Math.min(100,(h.bond||0)+g);
  const live=G.horse.myHorses.find(m=>m.id===h.id); if(live&&live!==h)live.bond=h.bond;
  const after=bondLevel(h);
  if(after>before)levelToasts.push('❤️ '+h.name+' is now '+BOND_NAMES[after]+' (bond Lv '+after+'): '+(BOND_UNLOCKS[after]||''));
  return g;
 }
 function flushToasts(){while(levelToasts.length){try{toast(levelToasts.shift());}catch(e){}}}
 function ensureBondDay(h){const d=new Date().toDateString();if(!h.bondDay||h.bondDay.date!==d)h.bondDay={date:d,n:0};return h.bondDay;}
 let rideAcc=0;
 function bondRide(){
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];if(!h)return;const bd=ensureBondDay(h);if(bd.n>=RIDE_BOND_CAP)return;
   const g=Math.min(RIDE_BOND_CAP-bd.n,addBond(s,h,1,'ride'));bd.n+=g;});
  flushToasts();
 }
 const lastLv={};
 function syncLiveBond(){const s=G.save.fresh();const i=G.horse.rideIdx();const hs=s&&s.horses[i],live=G.horse.myHorses[i];if(!hs||!live)return;
  const was=lastLv[hs.id]==null?bondLevel(live):lastLv[hs.id];live.bond=hs.bond;live.bondDay=hs.bondDay;if(hs.needs)live.needs=hs.needs;const now=bondLevel(hs);lastLv[hs.id]=now;
  if(now>was)levelToasts.push('❤️ '+hs.name+' is now '+BOND_NAMES[now]+' (bond Lv '+now+'): '+(BOND_UNLOCKS[now]||''));flushToasts();}
 G.addMul('stamDrain',(s,h)=>{const lv=bondLevel(h||ridden());return 1-0.02*lv;});   // 'only the worthy' — 2% per bond level

 /* ---- emotes: unlocks + the artist-rig pose pass ----------------------------------------- */
 EMOTES.kick={dur:1.25,fa:0,fk:0,ha:-0.9,hk:0.8,neck:0.25,pitch:0.22,lift:0.04,lean:-0.2,label:'🦵 Kick'};
 const EMOTE_LOCK={kick:{bond:1},bow:{bond:2},liedown:{bond:3}};
 for(const k in EMOTE_LOCK){const L=EMOTE_LOCK[k];EMOTES[k].locked=h=>bondLevel(h)<L.bond;EMOTES[k].lockHint='Unlocks at bond Lv '+L.bond+' ('+BOND_NAMES[L.bond]+')';EMOTES[k].unlock=L;}
 const emoteUnlocked=(h,k)=>!(EMOTES[k]&&EMOTES[k].locked&&EMOTES[k].locked(h));
 G.on('emoteGate',(type,h)=>{if(!emoteUnlocked(h,type)){toast('🔒 '+EMOTES[type].label+' — '+EMOTES[type].lockHint);return true;}});
 const QR=new THREE.Quaternion(),QP=new THREE.Quaternion(),QD=new THREE.Quaternion(),Q1=new THREE.Quaternion(),AX=new THREE.Vector3();
 function boneOf(rig,name){
  if(!rig._emBones)rig._emBones={};
  if(rig._emBones[name]!==undefined)return rig._emBones[name];
  let b=null;
  if(rig.boneMap)b=rig.boneMap[name]||null;
  if(!b&&rig.bones)b=rig.bones.find(x=>x.name.replace(/[.\s]/g,'')===name)||null;
  if(!b&&rig.profile&&rig.profile.hero&&rig.bones&&HERO_IDX[name]!=null)b=rig.bones[HERO_IDX[name]]||null;
  rig._emBones[name]=b; return b;
 }
 function rotBone(rig,name,angle,yaw){
  const b=boneOf(rig,name); if(!b||!angle||!b.parent)return;
  rig.scene.getWorldQuaternion(QR); AX.set(yaw?0:1,yaw?1:0,0).applyQuaternion(QR);
  QD.setFromAxisAngle(AX,angle);
  b.parent.getWorldQuaternion(QP);
  Q1.copy(QP).invert().multiply(QD).multiply(QP);
  b.quaternion.premultiply(Q1);
 }
 function applyRigEmote(rig,em,ee,t){
  const P=POSES[em.type]; if(!P||!rig||!rig.scene||!rig.bones)return;
  for(const k in P){ if(k==='yaw'||k==='osc')continue; rotBone(rig,k,P[k]*ee,false); }
  if(P.yaw)for(const k in P.yaw)rotBone(rig,k,P.yaw[k]*ee,true);
  if(P.osc){const w=Math.sin((t||0)*9.5+em.t*3)*ee;for(const k in P.osc)rotBone(rig,k,P.osc[k]*w,true);}
  rig.scene.updateMatrixWorld(true);
 }
 const emEnv=em=>{const p=Math.min(1,em.t/em.dur);const e=p<0.22?p/0.22:p>0.78?(1-p)/0.22:1;return e*e*(3-2*e);};
 const horseEmotes={apply:(rig,em,env,t)=>applyRigEmote(rig,em,env==null?emEnv(em):env,t),POSES,emEnv};
 G.on('rigEmote',(rig,em,dt,t)=>{applyRigEmote(rig,em,emEnv(em),t);});
 G.on('remoteTick',(r,dt,t)=>{
  if(r.rig&&r.rig.emote){const em=r.rig.emote;em.t+=dt;if(em.t>=em.dur)r.rig.emote=null;else if(r.rig.heroMotion)applyRigEmote(r.rig,em,emEnv(em),t);}
  if(r.riderEmote){const e=r.riderEmote;e.t+=dt;if(e.t>=e.dur){r.riderEmote=null;hideGuitar(r.rider);}else if(r.rider&&r.rider.sk)poseRiderEmote(r.rider,e,t,dt,r.parts&&r.parts.group);}
 });
 G.on('netPos',(payload)=>{const RIG=G.horse.RIG();payload.em=RIG.emote?RIG.emote.type:null;payload.rem=player.riderEmote?player.riderEmote.type:null;});
 G.on('remote',(m,r)=>{
  if(m.em&&EMOTES[m.em]&&r.rig&&!(r.rig.emote&&r.rig.emote.type===m.em)&&r._lastEm!==m.em){r.rig.emote={type:m.em,t:0,dur:EMOTES[m.em].dur};}
  r._lastEm=m.em||null;
  if(m.rem&&RIDER_EMOTES[m.rem]&&!(r.riderEmote&&r.riderEmote.type===m.rem)&&r._lastRem!==m.rem){r.riderEmote={type:m.rem,t:0,dur:RIDER_EMOTES[m.rem].dur};}
  r._lastRem=m.rem||null;
 });
 G.on('key',e=>{
  if(e.repeat)return;
  if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
  if(e.code===G.key('kick')){G.horse.horseEmote('kick');return true;}
  if(e.code===G.key('brush')){riderEmote('brush');return true;}
  if(e.code===G.key('guitar')){riderEmote('guitar');return true;}
  if(e.code===G.key('whistle')){doWhistle();return true;}
  if(e.code===G.key('pet')){petNearby();return true;}
 });
 /* the photo pose bar gets the kick */
 try{const pb=$('poseBar');if(pb&&!pb.querySelector('[data-pose="kick"]')){const b=document.createElement('button');b.dataset.pose='kick';b.textContent='🦵 Kick';b.onclick=()=>{G.horse.horseEmote('kick');};pb.insertBefore(b,$('shotTimer'));}}catch(e){}

 /* ---- hearts / sparkle burst -------------------------------------------------------------- */
 const bursts=[]; let heartTex=null,starTex=null;
 function glyphTex(ch){const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');c.font='48px serif';c.textAlign='center';c.textBaseline='middle';c.fillText(ch,32,34);const tx=new THREE.CanvasTexture(cv);tx.minFilter=THREE.LinearFilter;tx.generateMipmaps=false;return tx;}
 function burst(x,y,z,kind,n){
  const tex=kind==='star'?(starTex=starTex||glyphTex('✨')):(heartTex=heartTex||glyphTex('💗'));
  const g=new THREE.Group();
  for(let i=0;i<(n||10);i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));sp.scale.setScalar(0.28);sp.position.set((Math.random()-0.5)*0.9,Math.random()*0.4,(Math.random()-0.5)*0.9);sp.userData.v=0.9+Math.random()*0.8;g.add(sp);}
  g.position.set(x,y,z);G.scene.add(g);bursts.push({g,t:0,dur:1.3});
 }
 function tickBursts(dt){
  for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.t+=dt;const p=b.t/b.dur;
   for(const sp of b.g.children){sp.position.y+=sp.userData.v*dt;sp.material.opacity=1-p;}
   if(p>=1){G.scene.remove(b.g);for(const sp of b.g.children)sp.material.dispose();bursts.splice(i,1);}}
 }
 function headPos(){const RIG=G.horse.RIG();const v=new THREE.Vector3();const hb=RIG.headBone||(RIG.bones&&boneOf(RIG,'head'));if(hb){hb.getWorldPosition(v);return v;}v.copy(player.pos);v.y=G.world.groundH(player.pos.x,player.pos.z)+1.6;return v;}

 /* ---- petting ------------------------------------------------------------------------------ */
 function petAnimFor(h){const lv=bondLevel(h);return PET_ANIMS.filter(p=>p.lvl<=lv).pop();}
 function playPet(h){
  const RIG=G.horse.RIG(); const p=petAnimFor(h);
  if(Math.abs(player.speed)<=0.6&&player.y<=0&&!player.flying&&!RIG.emote){
   if(G.horse.horseEmote(p.em,{force:true})){RIG.emote.pet=true;}
  }
  const hp=headPos(); burst(hp.x,hp.y+0.2,hp.z,'heart');
  if(!playPet._hint){playPet._hint=1;const nx=PET_ANIMS.find(q=>q.lvl>p.lvl);toast('💗 '+p.label+(nx?' · next petting animation at bond Lv '+nx.lvl:''));}
 }
 G.on('careDone',(k,ok,h)=>{
  syncLiveBond();
  if(!ok)return;
  if(k==='pet'){try{$('carePanel').style.display='none';}catch(e){}playPet(ridden());}
  if(k==='groom'){applyDirt();const hp=headPos();burst(hp.x,hp.y-0.3,hp.z,'star');}
 });
 function petNearby(){
  if(player.y>0||Math.abs(player.speed)>=2)return;
  let best=null,bd=3.2;
  for(const a of G.horse.herd()){const d=Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z);if(d<bd){bd=d;best=a;}}
  if(!best){toast('Walk up to a pasture horse and press '+G.key('pet').replace('Key','')+' to pet it');return;}
  const hh=G.horse.myHorses[best.idx]; if(!hh)return;
  if(petNearby._t&&Date.now()-petNearby._t<2500)return; petNearby._t=Date.now();
  let g=0; G.save.sync(s=>{const h=s.horses.find(x=>x.id===hh.id);if(!h)return;h.needs=h.needs||{};h.needs.happy=Math.min(100,(h.needs.happy||0)+8);g=addBond(s,h,2,'pet');});
  best.rest=Math.max(best.rest,2.5); best.earA=0.6; best.called=false;
  burst(best.pos.x,G.world.groundH(best.pos.x,best.pos.z)+1.5,best.pos.z,'heart');
  toast('💗 '+hh.name+' leans into the scratch · +'+g+' bond'); G.quest.dailyEvt('pet',1); flushToasts();
  try{G.sChime();}catch(e){}
 }

 /* ---- whistle ------------------------------------------------------------------------------- */
 const whistle={target:null,t:0,cd:0};
 const sWhistle=()=>{G.beep(1400,1900,0.18,'sine',0.08);G.beep(1900,1500,0.22,'sine',0.08,0.2);};
 function whistleTarget(s){
  const herd=G.horse.herd(); if(!herd.length)return null;
  const fav=s&&s.whistleHorse!=null?herd.find(a=>G.horse.myHorses[a.idx]&&G.horse.myHorses[a.idx].id===s.whistleHorse):null;
  if(fav)return fav;
  return herd.slice().sort((a,b)=>((G.horse.myHorses[b.idx]||{}).bond||0)-((G.horse.myHorses[a.idx]||{}).bond||0))[0];
 }
 function doWhistle(){
  if(whistle.cd>0)return false;
  sWhistle();
  const s=G.save.fresh(); const a=whistleTarget(s);
  if(!a){whistle.cd=2;toast('🎵 Nobody in the pasture to call — turn a horse out in the 🐎 Stable');return false;}
  const h=G.horse.myHorses[a.idx],P=persOf(h);
  if(!persWhistleOk(h)){whistle.cd=4;a.earA=0.6;toast((P.emoji||'🐴')+' '+h.name+' flicks an ear and ignores you (bond Lv '+P.whistleLv+' needed)');return false;}
  whistle.target=a; whistle.t=25; whistle.cd=8; a.rest=0; a.called=true;
  toast('🎵 '+h.name+' is coming!'); return true;
 }
 function tickWhistle(dt){
  whistle.cd=Math.max(0,whistle.cd-dt);
  const a=whistle.target; if(!a)return;
  if(!G.horse.herd().includes(a)){whistle.target=null;return;}
  const dx=player.pos.x-a.pos.x,dz=player.pos.z-a.pos.z,d=Math.hypot(dx,dz)||0.001;
  if(d>60){a.pos.x=player.pos.x-dx/d*45;a.pos.z=player.pos.z-dz/d*45;}
  a.tx=player.pos.x-dx/d*2.4; a.tz=player.pos.z-dz/d*2.4; a.rest=0; a.called=true;
  whistle.t-=dt;
  if(d<3.2||whistle.t<=0){
   a.called=false; a.rest=2.5; whistle.target=null;
   if(d<3.2){const h=G.horse.myHorses[a.idx];toast('🐴 '+h.name+' trots up — press E to ride');G.quest.dailyEvt('whistle',1);}
  }
 }
 try{const b=document.createElement('button');b.id='whistleBtn';b.title='Whistle for a horse ('+String(G.key('whistle')||'').replace('Key','')+')';b.textContent='🎵';b.onclick=doWhistle;const st=$('stableBtn');if(st&&st.parentNode)st.after(b);else $('dock').appendChild(b);}catch(e){}

 /* ---- exhaustion ----------------------------------------------------------------------------- */
 let wasBlown=false, moodSprite=null, recovMul=1;
 function refreshRecov(){try{const s=G.save.fresh();const h=ridden();recovMul=persOf(h).recover*((h&&G.xp.masteryOf(s,h.breed)>=7)?1.3:1);}catch(e){recovMul=1;}}
 G.tables.MASTERY_UNLOCKS[7]='Second wind: recover from blown 30% faster';
 function onBlown(){
  const h=ridden(); if(!h)return; const P=persOf(h);
  if(P.exhaust==='stop'){player.exhaustT=2.4;G.horse.horseEmote(P.exhaustEmote||'toss',{force:true});toast((P.emoji||'😤')+' '+h.name+' is blown and plants its feet!');}
  else if(P.exhaust==='balk'){player.exhaustT=0.8;toast('😤 '+h.name+' is blowing hard');}
  else toast('😮‍💨 '+h.name+' needs a breather');
  try{G.sNeigh();}catch(e){}
  showMood(true);
 }
 function showMood(on){
  if(on){if(!moodSprite){moodSprite=G.nameSprite('😤');moodSprite.scale.multiplyScalar(0.6);}
   if(player.mesh&&moodSprite.parent!==player.mesh){player.mesh.add(moodSprite);}moodSprite.position.set(0,2.5,0.9);moodSprite.visible=true;}
  else if(moodSprite)moodSprite.visible=false;
 }
 G.on('ride',(R,dt)=>{
  const h=ridden();
  if(player.blown&&!wasBlown)onBlown(); wasBlown=!!player.blown;
  if(player.exhaustT>0){player.exhaustT=Math.max(0,player.exhaustT-dt);R.target=0;if(player.exhaustT<=0)showMood(false);}
  if(player.blown)R.regen*=recovMul;
  if(spook.t>0){spook.t-=dt;R.target=Math.min(R.target,0);player.heading+=spook.dir*dt*1.4;}
  if(player.riderEmote&&RIDER_EMOTES[player.riderEmote.type].still)R.target=Math.min(R.target,0);
 });
 G.on('rebuild',()=>{refreshRecov();wasBlown=false;player.exhaustT=0;showMood(false);});

 /* ---- wildlife spooks ------------------------------------------------------------------------ */
 const spook={t:0,cd:0,dir:1};
 function trySpook(c){
  const h=ridden(); if(!h)return; const P=persOf(h);
  if(P.fearless){spook.cd=3;return;}
  const chance=0.35*P.spookMul*(1-0.5*Math.min(1,(h.bond||0)/100));
  if(Math.random()>chance){spook.cd=6;return;}
  spook.t=P.spookShort?0.6:1.1; spook.cd=25; spook.dir=Math.sign(player.pos.x-c.x)||1;
  player.speed*=0.3;
  G.horse.horseEmote('toss',{force:true});
  try{G.sNeigh();}catch(e){}
  toast('😱 '+h.name+' shies at a '+((c.def&&(c.def.name||c.def.key))||c.key||'critter')+'!');
  G.quest.dailyEvt('spook',1);
 }
 function tickSpooks(dt){
  spook.cd=Math.max(0,spook.cd-dt);
  if(spook.cd>0||spook.t>0||player.flying||Math.abs(player.speed)<3)return;
  const crs=G.world.critters; if(!crs)return;
  const course=G.course.get(); if(course&&course.started&&course.race)return;
  for(const c of crs){
   if(c.mode==='flee'){ if(!c._sp){c._sp=true; if(Math.hypot(player.pos.x-c.x,player.pos.z-c.z)<4.5){trySpook(c);if(spook.cd>0)break;}} }
   else c._sp=false;
  }
 }

 /* ---- magnificent ribbons -------------------------------------------------------------------- */
 let lastRib=null;
 G.on('ribbons',RB0=>{RB0.magnif=RB0.stars>=3&&(RB0.faults||0)===0;lastRib={ev:RB0.ev,magnif:RB0.magnif,rib:RB0.rib};});
 G.on('courseFinish',({ev,RB})=>{
  const R=lastRib&&lastRib.ev===ev?lastRib:{magnif:false,rib:(RB&&RB.rib)||1}; lastRib=null;
  let g=0,mag=0;
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];if(R.magnif){s.magnif=(s.magnif||0)+1;mag=s.magnif;}if(h)g=addBond(s,h,R.magnif?6:R.rib,'ribbon');});
  if(R.magnif){toast('🏵️ Magnificent ribbon! +'+g+' bond');G.quest.dailyEvt('magnif',1);try{G.sGem();}catch(e){}}
  else if(g>0)toast('🎀 +'+g+' bond for the ribbon');
  syncLiveBond(); flushToasts();
 });
 G.ui.eventRow((ev,s)=>(s.ribbons&&s.ribbons[ev.id]>=4)?'<span title="Magnificent ribbon: under par with no faults">🏵️</span>':'');
 G.quest.addAch({id:'magnif5',icon:'🏵️',label:'Magnificent',desc:'Earn 5 magnificent ribbons (under par, no faults)',v:s=>s.magnif||0,goal:5,r:{g:3,k:1}});
 G.quest.addAch({id:'spook10',icon:'🧘',label:'Bombproof',desc:'Settle your horse after 10 spooks',v:s=>(s.life&&s.life.spook)||0,goal:10,r:{c:250}});
 G.quest.addAch({id:'emote25',icon:'🎭',label:'Show pony',desc:'Show off 25 tricks and emotes',v:s=>(s.life&&s.life.emote)||0,goal:25,r:{c:200,g:1}});
 G.quest.addAch({id:'bond5',icon:'💞',label:'Heart-bonded',desc:'Reach bond Lv 5 with any horse',v:s=>Math.max(0,...s.horses.map(h=>bondLevel(h))),goal:5,r:{g:5,k:1}});
 G.quest.addDaily({type:'magnif',icon:'🏵️',label:'Win a magnificent ribbon',goal:1,r:{c:200,g:3,p:25}});
 G.quest.addDaily({type:'emote',icon:'🎭',label:'Show off 3 tricks or emotes',goal:3,r:{c:60,g:1,p:5}});
 G.quest.addDaily({type:'whistle',icon:'🎵',label:'Whistle a horse over',goal:1,r:{c:50,g:1,p:5}});
 G.world.addBoard({k:'magnif',g:'events',label:'🏵️ Magnificent ribbons',rate:0.4,val:s=>s.magnif||0});

 /* ---- coat dirt (no chores required) ---------------------------------------------------------- */
 const DIRT=new THREE.Color('#6b5438');
 function applyDirt(){
  const RIG=G.horse.RIG(); const h=ridden(); if(!RIG||!RIG.skin||!h)return;
  const dirt=1-Math.min(1,((h.needs&&h.needs.clean)==null?100:h.needs.clean)/100);
  const mats=Array.isArray(RIG.skin.material)?RIG.skin.material:[RIG.skin.material];
  for(const m of mats){ if(!m||!m.color)continue; if(!m.userData.cleanColor)m.userData.cleanColor=m.color.clone();
   m.color.copy(m.userData.cleanColor).lerp(DIRT,dirt*0.4); m.userData.dirt=dirt; }
 }
 G.on('coat',()=>{const s=G.save.fresh();const live=ridden();const hs=s&&s.horses[G.horse.rideIdx()];if(hs&&live)live.needs=hs.needs;setTimeout(applyDirt,0);applyDirt();});
 G.on('interval30',()=>{const s=G.save.fresh();const live=ridden();const hs=s&&s.horses[G.horse.rideIdx()];if(hs&&live)live.needs=hs.needs;applyDirt();});

 /* ---- rider emotes + guitar ------------------------------------------------------------------- */
 const RIDER_EMOTES={
  wave:{dur:2.2,label:'👋 Wave',tier:'free'},
  point:{dur:1.8,label:'👉 Point',tier:'free'},
  laugh:{dur:2.4,label:'😂 Laugh',tier:'free'},
  cry:{dur:2.6,label:'😢 Cry',tier:'free'},
  bow:{dur:2.4,label:'🙇 Bow',tier:'free'},
  dismiss:{dur:1.8,label:'🙄 Dismissive',tier:'free'},
  what:{dur:2.0,label:'🤷 What?',tier:'free'},
  dance:{dur:4.5,label:'💃 Dance',tier:'free'},
  thumbs:{dur:2.0,label:'👍 Thumbs up',tier:'earn',hint:'Earn 60 ribbons',own:s=>(s.ribbonTotal||0)>=60},
  cheer:{dur:2.6,label:'🙌 Cheer',tier:'earn',hint:'Win a magnificent ribbon',own:s=>(s.magnif||0)>=1},
  selfie:{dur:2.6,label:'🤳 Selfie',tier:'earn',hint:'Reach mastery 5 with any breed',own:s=>Object.values(s.mastery||{}).some(v=>v>=5)},
  come:{dur:2.0,label:'👐 Come here',tier:'earn',hint:'Reach bond Lv 2 with any horse',own:s=>s.horses.some(h=>bondLevel(h)>=2)},
  airguitar:{dur:4.0,label:'🎸 Air guitar',tier:'earn',hint:'Win a race trophy',own:s=>!!(s.trophies&&Object.keys(s.trophies).some(k=>/^r/.test(k)))},
  backflip:{dur:1.6,label:'🤸 Backflip',tier:'earn',hint:'Reach bond Lv 4 with any horse',own:s=>s.horses.some(h=>bondLevel(h)>=4)},
  brush:{dur:2.6,label:'🧽 Brush horse',tier:'free',still:true},
  guitar:{dur:6.0,label:'🎸 Strum the guitar',tier:'earn',hint:'Season pass free track tier 20',still:true,prop:'guitar'},
 };
 G.money.rewardKind('emote',(s,v)=>{s.emotes=s.emotes||{};s.emotes[v]=1;},v=>'🎭 '+((RIDER_EMOTES[v]&&RIDER_EMOTES[v].label)||v));
 try{const PF=G.tables.PASS_FREE;if(PF&&PF[19])PF[19].emote='guitar';}catch(e){}
 const emoteOwned=(s,k)=>{const E=RIDER_EMOTES[k];if(!E)return false;if(E.tier==='free')return true;if(s&&s.emotes&&s.emotes[k])return true;return !!(E.own&&s&&E.own(s));};
 const sStrum=()=>{[196,247,294,392].forEach((f,i)=>G.beep(f,f*0.98,0.35,'triangle',0.08,i*0.06));};
 function riderEmote(type){
  const E=RIDER_EMOTES[type]; if(!E)return false;
  const s=G.save.fresh();
  if(!emoteOwned(s,type)){toast('🔒 '+E.label+' — '+E.hint);return false;}
  if(!player.rider||!player.rider.sk){toast('Your rider is still saddling up…');return false;}
  if(Math.abs(player.speed)>0.6||player.y>0||player.flying){toast('Come to a halt first.');return false;}
  if(player.riderEmote)return false;
  player.riderEmote={type,t:0,dur:E.dur,strum:0};
  if(type==='guitar'){sStrum();}else if(type==='cheer'||type==='laugh'){try{G.sChime();}catch(e){}}
  G.quest.dailyEvt('emote',1);
  if(type==='brush')G.quest.dailyEvt('brush',1);
  return true;
 }
 /* arm poses: [armR, foreR, armL, foreL] Euler additions, plus head/spine; f(p,t) may animate */
 function poseRiderEmote(R,e,t,dt,mount){
  const B=R.sk.by; if(!B)return false; const p=e.t/e.dur, env=p<0.15?p/0.15:p>0.85?(1-p)/0.15:1, w=Math.sin((t||0)*9);
  const ty=e.type;
  const set=(bone,x,y,z)=>{const b=B[bone];if(!b)return;b.rotation.x+=x*env;b.rotation.y+=y*env;b.rotation.z+=z*env;};
  if(ty==='wave'){set('armR',-2.6,0,0.5);set('foreR',-0.4,0,w*0.45);set('head',0,0.3,0);}
  else if(ty==='point'){set('armR',-1.5,-0.2,0.15);set('foreR',-0.1,0,0);set('head',0,-0.25,0);}
  else if(ty==='laugh'){set('spine',-0.18+Math.sin(t*11)*0.06,0,0);set('head',-0.3+Math.sin(t*11)*0.08,0,0);set('armR',-0.6,0,0.6);set('armL',-0.6,0,-0.6);set('foreR',-1.4,0,0);set('foreL',-1.4,0,0);}
  else if(ty==='cry'){set('head',0.45,0,0);set('spine',0.15,0,0);set('armR',-1.2,0,0.1);set('foreR',-1.9,0,0.2);set('armL',-1.2,0,-0.1);set('foreL',-1.9,0,-0.2);}
  else if(ty==='bow'){set('spine',0.55,0,0);set('chest',0.35,0,0);set('head',0.25,0,0);set('armR',0.4,0,0.3);set('armL',0.4,0,-0.3);}
  else if(ty==='dismiss'){set('armR',-1.0,0,0.9+w*0.15);set('foreR',-0.5,0,0.4);set('head',0,-0.5,0.1);}
  else if(ty==='what'){set('armR',-0.9,0,0.9);set('armL',-0.9,0,-0.9);set('foreR',-1.2,0,0.6);set('foreL',-1.2,0,-0.6);set('head',0,0.35,0.2);}
  else if(ty==='dance'||ty==='airguitar'){const s1=Math.sin(t*7),s2=Math.cos(t*7);set('spine',0,s1*0.2,s2*0.12);set('armR',-1.6+s1*0.5,0,0.6);set('armL',-1.6-s1*0.5,0,-0.6);set('foreR',-0.6+s2*0.5,0,0);set('foreL',-0.6-s2*0.5,0,0);set('head',0,s1*0.2,0);}
  else if(ty==='thumbs'){set('armR',-1.4,0,0.2);set('foreR',-1.3,0,0);set('head',0,0.15,0);}
  else if(ty==='cheer'){set('armR',-2.8+w*0.15,0,0.5);set('armL',-2.8-w*0.15,0,-0.5);set('spine',-0.15,0,0);set('head',-0.3,0,0);}
  else if(ty==='selfie'){set('armR',-2.4,0.4,0.3);set('foreR',-0.9,0,0);set('head',-0.15,0.35,0.15);}
  else if(ty==='come'){set('armR',-1.3,0,0.3);set('foreR',-1.2+w*0.4,0,0);set('armL',-1.3,0,-0.3);set('foreL',-1.2-w*0.4,0,0);}
  else if(ty==='backflip'){const a=Math.sin(Math.PI*p);set('spine',-a*1.4,0,0);set('chest',-a*0.6,0,0);set('armR',-2.6*a,0,0.4);set('armL',-2.6*a,0,-0.4);if(R.g)R.g.position.y+=a*0.9;}
  else if(ty==='brush'){const sw=Math.sin(p*Math.PI*5);set('spine',0.45,0.25,0.3);set('chest',0.2,0.2,0.2);set('head',0.35,0.35,0);set('armR',-0.5+sw*0.35,0.4,0.9);set('foreR',-0.9+sw*0.3,0,0.3);}
  else if(ty==='guitar'){set('armL',-0.9,0.55,-0.7);set('foreL',-1.15,0,-0.35);set('armR',-0.45,-0.3,0.55);set('foreR',-0.85+Math.sin(t*14)*0.35,0,0.2);set('head',0.25,-0.3,0);showGuitar(R,true,t);}
  return true;
 }
 function buildGuitar(){
  const g=new THREE.Group(); g.name='guitar';
  const wood=new THREE.MeshStandardMaterial({color:0xb9772e,roughness:0.55}), dark=new THREE.MeshStandardMaterial({color:0x3a2416,roughness:0.6});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.05,20),wood); body.scale.set(1,1,1.25); body.rotation.x=Math.PI/2; g.add(body);
  const waist=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.052,20),wood); waist.rotation.x=Math.PI/2; waist.position.y=0.17; g.add(waist);
  const hole=new THREE.Mesh(new THREE.CircleGeometry(0.035,16),dark); hole.position.set(0,0.04,0.027); g.add(hole);
  const neck=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.42,0.02),dark); neck.position.set(0,0.44,0.012); g.add(neck);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.09,0.02),dark); head.position.set(0,0.69,0.012); g.add(head);
  const sm=new THREE.LineBasicMaterial({color:0xe8e2d0}); const strings=[];
  for(let i=0;i<6;i++){const x=-0.014+i*0.0056;const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,-0.1,0.03),new THREE.Vector3(x,0.66,0.026)]);const l=new THREE.Line(geo,sm);g.add(l);strings.push(l);}
  g.userData.strings=strings; g.visible=false; return g;
 }
 function showGuitar(R,on,t){
  if(!R._guitar){R._guitar=buildGuitar();(R.g||R.fitG).add(R._guitar);R._guitar.position.set(0.05,0.62,0.30);R._guitar.rotation.set(0.35,0,-1.1);}
  R._guitar.visible=!!on;
  if(on){const s=Math.sin((t||0)*40)*0.004;for(const l of R._guitar.userData.strings)l.position.z=s;}
 }
 function hideGuitar(R){if(R&&R._guitar)R._guitar.visible=false;}
 G.on('riderPose',(R,tm,dt)=>{
  const e=player.riderEmote; if(!e)return false;
  e.t+=dt||0.016;
  if(e.type==='guitar'){e.strum+=dt||0.016;if(e.strum>=0.9){e.strum=0;sStrum();}}
  if(e.t>=e.dur){player.riderEmote=null;hideGuitar(R);if(e.type==='brush')finishBrush();return false;}
  return poseRiderEmote(R,e,tm,dt,player.mesh);
 });
 function finishBrush(){
  try{G.ui.renderCare();const b=document.querySelector('#carePanel [data-care="groom"]');if(b)b.click();}catch(e){}
 }
 /* the campfire by the ranch house: a place to sit and play */
 try{
  const gh=G.world.groundH(4,9); const g=new THREE.Group(); g.position.set(4,gh,9);
  const logM=new THREE.MeshStandardMaterial({color:0x5a3d24,roughness:0.9});
  for(let i=0;i<6;i++){const l=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.55,7),logM);l.rotation.z=Math.PI/2;l.rotation.y=i*Math.PI/3;l.position.set(Math.cos(i*Math.PI/3)*0.32,0.09,Math.sin(i*Math.PI/3)*0.32);g.add(l);}
  for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.3,0.22,10),new THREE.MeshStandardMaterial({color:0x8d8378,roughness:1}));s.position.set(Math.cos(i*2.1)*1.3,0.11,Math.sin(i*2.1)*1.3);g.add(s);}
  const flame=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.5,8),new THREE.MeshStandardMaterial({color:0xffa030,emissive:0xff6a10,emissiveIntensity:1.4,transparent:true,opacity:0.9}));flame.position.y=0.32;g.add(flame);
  const light=new THREE.PointLight(0xffa040,0.9,7);light.position.y=0.6;g.add(light);
  G.scene.add(g); G.world.colliders.push({x:4,z:9,r:0.8});
  G.world.addThing({kind:'camp',id:'ranchfire',x:4,z:9,g:null,label:()=>'🎸 Play a tune by the fire (E)',use:()=>{riderEmote(emoteOwned(G.save.fresh(),'guitar')?'guitar':'airguitar');},tick:(dt,t)=>{flame.scale.y=1+Math.sin(t*9)*0.12;flame.rotation.y=t*2;}});
 }catch(e){console.warn('campfire',e);}

 /* ---- emote panel ----------------------------------------------------------------------- */
 G.ui.action('bpe',(args)=>{
  const [what,a1]=args;
  if(what==='rem'){G.hidePanels();riderEmote(a1);}
  else if(what==='hem'){G.hidePanels();G.horse.horseEmote(a1);}
  else if(what==='whistleHorse'){G.save.sync(s=>{s.whistleHorse=s.whistleHorse===+a1?null:+a1;});G.ui.renderStable();}
  else if(what==='pet'){const b=document.querySelector('#carePanel [data-care="pet"]');if(b)b.click();}
  else if(what==='brush'){G.hidePanels();riderEmote('brush');}
  else if(what==='whistle'){G.hidePanels();doWhistle();}
 });
 G.ui.panel({id:'emotePanel',title:'🎭 Emotes',dock:{label:'🎭',after:'chatBtn',title:'Emotes & tricks ('+String(G.key('emoteBar')||'').replace('Key','')+')'},hotkey:G.key('emoteBar'),
  render(p,s){
   const h=s.horses[G.horse.rideIdx()]||{};
   const rider=Object.keys(RIDER_EMOTES).map(k=>{const E=RIDER_EMOTES[k];const own=emoteOwned(s,k);return '<button data-fx="bpe:rem:'+k+'" '+(own?'':'style="opacity:.55" title="'+E.hint+'"')+'>'+(own?'':'🔒 ')+E.label+'</button>';}).join('');
   const horse=Object.keys(EMOTES).map(k=>{const E=EMOTES[k];const ok=emoteUnlocked(h,k);return '<button data-fx="bpe:hem:'+k+'" '+(ok?'':'style="opacity:.55" title="'+E.lockHint+'"')+'>'+(ok?'':'🔒 ')+E.label+'</button>';}).join('');
   return '<div class="ph">🎭 Emotes <button data-fx="close" style="margin-left:auto">✖</button></div>'
   +'<div style="font-size:12px;color:#8c7a63">Rider emotes play from a halt. Free ones are yours; the rest are earned in play. Club mates see them.</div>'
   +'<div class="crow" style="gap:5px;flex-wrap:wrap">'+rider+'</div>'
   +'<div class="ph" style="font-size:14px;margin-top:6px">🐴 '+(h.name||'Horse')+"'s tricks <span style=\"color:#8c7a63;font-size:12px;font-weight:600\">bond Lv "+bondLevel(h)+' · keys 1–6</span></div>'
   +'<div class="crow" style="gap:5px;flex-wrap:wrap">'+horse+'</div>'
   +'<div class="crow" style="gap:5px;flex-wrap:wrap;margin-top:4px"><button data-fx="bpe:whistle">🎵 Whistle</button><button data-fx="bpe:brush">🧽 Brush</button></div>';
  }});

 /* ---- Care / Stable surfaces ---------------------------------------------------------------- */
 G.ui.careHeader((s,h)=>{
  const lv=bondLevel(h),P=persOf(h);
  return '<div style="font-size:12.5px"><b>❤️ Bond Lv '+lv+' · '+BOND_NAMES[lv]+'</b> · '+(h.bond||0)+'/100'+(lv<5?' · next at '+BOND_LEVELS[lv+1]+': '+BOND_UNLOCKS[lv+1]:' · every unlock earned')+'</div>'
  +'<div style="font-size:11px;color:#8c7a63">'+persTraits(h)+' · ride '+RIDE_BOND_CAP+' bond/day ('+((h.bondDay&&h.bondDay.date===new Date().toDateString())?h.bondDay.n:0)+' today)'+(P.exhaust==='stop'?' · stops when blown':'')+'</div>';
 });
 G.ui.careSection((s,h)=>{
  const lv=bondLevel(h); const pa=petAnimFor(h);
  return '<div class="crow" style="gap:5px;flex-wrap:wrap;margin-top:4px"><span class="lbl" style="font-size:11px">Bond</span>'
  +'<button data-fx="bpe:pet" title="'+pa.label+'">💗 '+pa.label+'</button><button data-fx="bpe:brush" title="Brush '+h.name+' ('+String(G.key('brush')||'').replace('Digit','key ')+')">🧽 Brush</button><button data-fx="bpe:whistle">🎵 Whistle</button><button data-fx="open:emotePanel">🎭 Emotes</button></div>'
  +'<div style="font-size:11px;color:#8c7a63">'+[1,2,3,4,5].map(l=>(lv>=l?'✅':'🔒')+' Lv '+l+' '+BOND_NAMES[l]+': '+BOND_UNLOCKS[l]).join('<br>')+'</div>';
 });
 G.ui.stableRow((h,i)=>{const s=G.save.fresh()||{};const fav=s.whistleHorse===h.id;return (i===G.horse.rideIdx()?'':'<button data-fx="bpe:whistleHorse:'+h.id+'"'+(fav?' class="claimBtn"':'')+' title="The horse your whistle calls">'+(fav?'🎵 Whistle ✓':'🎵')+'</button>')+'<span style="font-size:11px;color:#8c7a63">bond Lv '+bondLevel(h)+'</span>';});

 /* ---- per-frame ------------------------------------------------------------------------------- */
 let hintT=0,petHinted=false,sparkT=0;
 G.on('tick',(dt,t)=>{
  tickBursts(dt);
  /* heart-bonded: a little heart sparkle streams off a Lv 5 horse at the gallop */
  if(Math.abs(player.speed)>8&&player.y<=0&&!player.flying&&bondLevel()>=5){sparkT-=dt;if(sparkT<=0){sparkT=0.35;if(bursts.length<6)burst(player.pos.x-Math.sin(player.heading)*1.4,G.world.groundH(player.pos.x,player.pos.z)+1.2,player.pos.z-Math.cos(player.heading)*1.4,'heart',2);}}
  tickWhistle(dt);
  tickSpooks(dt);
  if(!player.flying&&Math.abs(player.speed)>0.5){rideAcc+=Math.abs(player.speed)*dt;if(rideAcc>=200){rideAcc-=200;bondRide();}}
  if(player.riderEmote&&Math.abs(player.speed)>1.5){player.riderEmote=null;hideGuitar(player.rider);}
  if(t-hintT>45&&player.y<=0&&Math.abs(player.speed)<2){hintT=t;for(const a of G.horse.herd()){if(Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z)<3.2){if(!petHinted){petHinted=true;toast('💗 Press '+String(G.key('pet')||'G').replace('Key','')+' to pet '+((G.horse.myHorses[a.idx]||{}).name||'the horse'));}break;}}}
 });
 G.on('state',o=>{
  const h=ridden()||{}; const RIG=G.horse.RIG();
  o.horse=o.horse||{}; o.horse.bondLevel=bondLevel(h); o.horse.emote=RIG.emote?RIG.emote.type:null; o.horse.clean=h.needs?Math.round(h.needs.clean):null; o.horse.persTraits=h.pers?persTraits(h):null;
  o.player=o.player||{}; o.player.blown=!!player.blown; o.player.exhaustT=Number((player.exhaustT||0).toFixed(2));
  o.spook={t:Number(spook.t.toFixed(2)),cd:Number(spook.cd.toFixed(1))};
  o.whistle={target:whistle.target?whistle.target.idx:null,t:Number(whistle.t.toFixed(1)),cd:Number(whistle.cd.toFixed(1))};
  o.riderEmote=player.riderEmote?player.riderEmote.type:null;
  o.bondDay=h.bondDay||null;
 });
 G.on('boot',()=>{refreshRecov();syncLiveBond();});

 /* ---- exports for the other packages ---------------------------------------------------------- */
 Object.assign(G.horse,{bondLevel,persOf,addBond,persWhistleOk,persTraits,horseEmotes,riderEmote,emoteOwned,emoteUnlocked,doWhistle,petNearby,RIDER_EMOTES,PET_ANIMS,BOND_LEVELS,BOND_NAMES,BOND_UNLOCKS,PERS_DEFAULT,spook,whistle,applyDirt,flushBondToasts:flushToasts,syncLiveBond,log:LOG});
}
