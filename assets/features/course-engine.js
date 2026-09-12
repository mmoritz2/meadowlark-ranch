/* Feature package 'course-engine'. Owned by that package: edit only this file and the inline hot spots
   assigned to it. See index.js for the contract. Nothing runs at import time.

   What lives here — the riding model and the competition engine, as one series:
     gaits        walk / canter / gallop (Shift) / sprint (double-tap Shift) / dash (Space while sprinting)
     stamina      jumps cost it, sprinting burns it, breed and perk rules bend it, blown horses stumble
     bond tricks  fast sprint (bond level 2) and the sliding stop (bond level 3, X or a hard S from a gallop)
     jump timing  every fence is graded perfect / good / late / early / knockdown / refusal at the crossing
     line riding  courses carry an ideal line; cutting it costs seconds and accuracy
     inspiring    a perfect fence gives time back and refunds stamina — cross country runs on it
     speed pads   ground pads on race legs (and three on the ranch track) that fire again every four seconds
     show jumping laps, a time allowed, time faults
     cross country routes through Barleyfold and Hollowpeak with gates and natural fences alternating
     scoring      accuracy % + faults + time; gold ribbon at 95% with nothing down
     ribbons      three green (finish, two stars, three stars) and one gold; story types 'ribbons' and 'gold'
     difficulty   Novice / Open / Elite on every event; ribbons count at any of them
     event card   time allowed, laps, stat prerequisites and the full reward line before you enter
     first person KeyT rides from the saddle */
export const id='course-engine';
export function install(G){
 const THREE=G.THREE, $=G.$, toast=G.toast, T=G.tables, W=G.world, player=G.horse.player;
 const keys=window._k||{}, touch=window._touch||{};
 const ridden=()=>G.horse.ridden();
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const fmtT=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};

 /* ---------------------------------------------------------------- data ---------------- */
 const DIFFS=[
  {k:'novice',label:'Novice',icon:'🌱',parMul:1.3,rewMul:0.7,fence:0.85,lvlAdd:0,desc:'lower rails, a slower clock, 70% of the purse'},
  {k:'open',label:'Open',icon:'🏇',parMul:1,rewMul:1,fence:1,lvlAdd:0,desc:'the course as set'},
  {k:'elite',label:'Elite',icon:'🔥',parMul:0.85,rewMul:1.5,fence:1.15,lvlAdd:2,desc:'taller rails, a tighter clock, half as much again'},
 ];
 const BOND_TRICKS={
  sprint:{lvl:2,mul:1.08,icon:'💨',label:'Fast sprint',desc:'Gallop and sprint 8% faster'},
  slide:{lvl:3,icon:'🛑',label:'Sliding stop',desc:'X (or a hard S) from a gallop plants her hind feet and slides to a halt'},
 };
 const RIDE_PERKS={
  forwardMomentum:{lvl:4,icon:'🏃',label:'Forward Momentum',desc:'Stamina trickles back even at a gallop',regenMoving:0.008},
  durableDashes:{lvl:7,icon:'🚀',label:'Durable Dashes',desc:'Dashes last half as long again',dashMul:1.5},
  secondWind:{lvl:10,icon:'🌬️',label:'Second Wind',desc:'A blown horse gallops again at a quarter tank instead of a third',blownAt:0.25},
 };
 /* Breed riding rules, looked up by the ridden horse's breed key; BREEDS3 rows are untouched. */
 const BREED_RIDE_MODS={
  black:{regenPerHighTack:0.10},sport:{regenPerHighTack:0.10},aether:{regenPerHighTack:0.10},   // the Friesians: +10% regen per Epic-or-better piece worn
  palomino:{xcStamMul:0.75},                                                                     // the Palomino Mustang tires on cross country
  thoro:{sprintMul:1.04},eclipse:{sprintMul:1.04},                                               // Thoroughbreds sprint a touch faster
  iceland:{regenMul:1.08},fjord:{regenMul:1.08},                                                 // the northern ponies get their wind back sooner
  kestrel:{xcStamMul:1.15},                                                                      // the Silver Kestrel was bred for the ridge
 };
 const GRADE={perfect:{s:1.0,icon:'✨',text:'Perfect!'},good:{s:0.92,icon:'👍',text:'Good'},late:{s:0.75,icon:'⏳',text:'Chipped in late'},early:{s:0.70,icon:'⏩',text:'Took off early'},fault:{s:0.40,icon:'💥',text:'Rails down'},refusal:{s:0.30,icon:'🛑',text:'Refusal'}};
 const GRADE_KEYS=Object.keys(GRADE);
 const LINE_TOL={jump:6,race:14};
 const SPRINT_MUL=1.18, SPRINT_DRAIN=2.2, DASH_MUL=1.35, DASH_DUR=0.9, DASH_CD=2.5, DASH_COST=0.12;

 /* Event table additions: laps, time allowed, stat prerequisites, the line-riding flag, and the two
    cross-country routes. Rows are mutated in place so every renderer sees the same objects. */
 const EV_EXTRA={
  h1:{time:60},
  h2:{laps:2,time:120,req:{jump:2,agility:1}},
  a1:{line:true,req:{jump:3}},
  a2:{xc:true,race:true,route:'xc1',line:true,req:{stamina:5,jump:5},name:'Barleyfold Cross Country'},
  b1:{laps:2,line:true,req:{jump:5,agility:4}},
  b2:{line:true,req:{speed:6,agility:6}},
  w1:{line:true,req:{jump:7,agility:6}},
  w2:{laps:2,line:true,req:{jump:8,agility:8,speed:8}},
  tc:{laps:2,line:true,req:{jump:7,accel:6}},
  r1:{line:true,req:{speed:4}},
  r2:{line:true,req:{speed:7,stamina:7}},
  bd:{line:true,req:{speed:5,stamina:4}},
  wt:{line:true,req:{stamina:6,accel:5}},
  d2:{req:{agility:7,accel:6}},
 };
 for(const ev of T.EVENTS3){const x=EV_EXTRA[ev.id];if(x)Object.assign(ev,x);}
 delete T.EVENTS3.find(e=>e.id==='a2').n;
 if(!T.EVENTS3.some(e=>e.id==='x2'))T.EVENTS3.push({id:'x2',town:'Hollowpeak',name:'Hollowpeak Ridge Chase',lvl:7,xc:true,race:true,route:'xc2',line:true,req:{stamina:7,jump:6},reward:950});
 /* Cross-country loops. Both sit well clear of the river (z≈75–165) and the Barleyfold stream (x≈118±22). */
 T.RACE_ROUTES.xc1=T.RACE_ROUTES.xc1||[[190,-80],[240,-60],[280,-95],[275,-145],[235,-175],[185,-160],[165,-120]];
 T.RACE_ROUTES.xc2=T.RACE_ROUTES.xc2||[[-120,-160],[-150,-190],[-195,-200],[-215,-245],[-180,-270],[-135,-250],[-105,-205]];

 /* ---------------------------------------------------------------- save ---------------- */
 G.save.ensure(s=>{ s.bestAcc=s.bestAcc||{}; s.ribbonGold=s.ribbonGold||{}; s.ribbonsBy=s.ribbonsBy||{}; if(s.evDiff==null)s.evDiff=1; s.gradeLog=s.gradeLog||{}; });

 /* ---------------------------------------------------------------- helpers ------------- */
 const bondLevel=h=>typeof G.horse.bondLevel==='function'?G.horse.bondLevel(h):Math.min(5,Math.floor(((h&&h.bond)||0)/20));
 const hasTrick=(h,k)=>bondLevel(h)>=BOND_TRICKS[k].lvl;
 const hasPerk=(h,k)=>((h&&h.level)||1)>=RIDE_PERKS[k].lvl;
 const breedMod=h=>BREED_RIDE_MODS[(h&&h.breed)||'']||{};
 function eventOk(ev,h){
  h=h||ridden(); if(!h)return {ok:false,missing:[]};
  const lvl=h.level||1, missing=[];
  if(lvl<ev.lvl)missing.push(['level',ev.lvl,lvl]);
  if(ev.req){ G.xp.ensureStats(h); for(const k in ev.req){const have=(h.stats&&h.stats[k])||0; if(have<ev.req[k])missing.push([k,ev.req[k],have]);} }
  return {ok:!missing.length,missing};
 }
 const missingText=m=>m.map(([k,need,have])=>(k==='level'?'Lv '+need:T.STAT_LBL[k]+' '+need)+' (have '+have+')').join(' · ');
 function eventTimeAllowed(ev,di){const d=DIFFS[di==null?1:di]||DIFFS[1];return ev.dressage?ev.par:(ev.time||G.course.eventPar(ev)*1.4)*d.parMul;}
 function eventRewardLine(ev,di){
  const d=DIFFS[di==null?1:di]||DIFFS[1]; const c=Math.round(ev.reward*d.rewMul), xp=Math.round(ev.reward/8);
  const sx=statXpFor(ev); const parts=[c+'🪙',xp+' XP'];
  for(const k in sx)parts.push(sx[k]+' '+T.STAT_LBL[k].split(' ')[1]+' XP');
  parts.push('50 pass pts','1–5💎');
  return parts.join(' · ');
 }
 function statXpFor(ev){
  const base=Math.max(8,Math.round(ev.reward/7));
  if(ev.dressage)return {agility:base,accel:Math.round(base*0.6)};
  if(ev.xc)return {stamina:base,jump:Math.round(base*0.8)};
  if(ev.race)return {speed:base,stamina:Math.round(base*0.7)};
  return {jump:base,agility:Math.round(base*0.8)};
 }
 function ribbonStr(s,id){const r=(s.ribbons||{})[id]||0,gold=!!(s.ribbonGold||{})[id];return '🎀'.repeat(Math.min(3,r-(gold?1:0)))+(gold?'🥇':'');}
 const rig=()=>G.horse.RIG();
 const jumpingNow=()=>{const R=rig();return (R.heroMotion&&R.heroJumpAge!==null)||player.y>0.05||player.vy>0;};

 /* ---------------------------------------------------------------- styles + HUD -------- */
 const style=document.createElement('style');
 style.textContent='#stamWrap.insp #stamFill{background:linear-gradient(90deg,#ffd166,#fff3b0);box-shadow:0 0 8px #ffd166}'
  +'#stamWrap.sprint{border-color:#ffd166}'
  +'#fpHint{display:none;position:fixed;bottom:calc(14px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:9;background:var(--dark);color:#fff8ea;padding:7px 14px;border-radius:999px;font-size:12px;font-weight:600}'
  +'body.fpv #fpHint{display:block}body.fpv #dock{opacity:.35}'
  +'#gradeFlash{position:fixed;top:36%;left:50%;transform:translate(-50%,-50%);z-index:8;font-family:var(--display);font-size:38px;font-weight:700;color:#fff8ea;text-shadow:0 4px 18px rgba(40,25,5,.55);opacity:0;pointer-events:none;transition:opacity .25s}'
  +'#gradeFlash.on{opacity:1}'
  +'.evcard{width:100%;font-size:11px;color:#6b5a45;line-height:1.5}.evcard b{color:#3d2f22}'
  +'.evdiff{display:flex;gap:4px;flex:none;flex-wrap:wrap;justify-content:flex-end}.evdiff button{font-size:11px;padding:4px 8px}'
  +'#tSpr{opacity:.6}';
 document.head.appendChild(style);
 const fpHint=document.createElement('div'); fpHint.id='fpHint'; fpHint.textContent='👁️ First person · drag to look around · T back to the saddle camera'; document.body.appendChild(fpHint);
 const gradeFlash=document.createElement('div'); gradeFlash.id='gradeFlash'; document.body.appendChild(gradeFlash);
 let flashT=0;
 function flash(txt){gradeFlash.textContent=txt;gradeFlash.classList.add('on');flashT=0.9;}
 /* Touch: a sprint toggle beside the gallop button. */
 {const tg=$('tGal'); if(tg&&!$('tSpr')){const b=document.createElement('button');b.id='tSpr';b.textContent='⚡';b.title='Sprint';tg.after(b);b.addEventListener('click',()=>{touch.spr=!touch.spr;b.style.opacity=touch.spr?'1':'0.6';});}}

 /* ---------------------------------------------------------------- the ride ------------ */
 const R={sprintOn:false,lastTap:0,dashT:0,dashCd:0,slide:null,blownHold:0,blownToast:false,lastJumpAge:null,wasAir:false,highTack:0,tackAt:0,sprintHeld:false};
 const sprintKey=()=>G.key('sprint')||'ShiftLeft';
 G.on('key',e=>{
  if(e.repeat)return;
  const h=ridden();
  if(e.code===sprintKey()||e.code==='ShiftRight'){ const now=performance.now(); if(now-R.lastTap<400)R.sprintOn=true; R.lastTap=now; return; }
  if(e.code===G.key('slide')){ trySlide(h); return; }
  if(e.code===G.key('firstPerson')){ setFP(!FP.on); e.preventDefault(); return true; }
 });
 G.on('keyup',e=>{ if(e.code===sprintKey()||e.code==='ShiftRight')R.sprintOn=false; });
 function trySlide(h){
  h=h||ridden();
  if(R.slide||player.flying||player.y>0.05)return false;
  if(!hasTrick(h,'slide')){ if(Math.abs(player.speed)>8)toast('🛑 Sliding stop needs bond level '+BOND_TRICKS.slide.lvl+' with '+(h?h.name:'her')); return false; }
  if(Math.abs(player.speed)<=8)return false;
  R.slide={t:0,dur:0.8,v0:player.speed,dust:0};
  G.beep(70,140,0.2,'sawtooth',0.07);
  return true;
 }
 G.on('ride',(RIDE,dt)=>{
  const h=ridden(); const bm=breedMod(h); const c=G.course.get();
  const sprintInput=R.sprintOn||touch.spr;
  R.dashCd=Math.max(0,R.dashCd-dt);
  /* sliding stop: X, or S from a gallop */
  if(!R.slide&&(keys.KeyS||touch.brake)&&Math.abs(player.speed)>8&&player.y<=0.05&&!player.flying&&hasTrick(h,'slide'))trySlide(h);
  if(R.slide){
   const s=R.slide; s.t+=dt; const p=Math.min(1,s.t/s.dur);
   player.speed=s.v0*(1-p)*(1-p)*(1-p);
   RIDE.target=0; RIDE.noJump=true;
   if(p>=1){R.slide=null;player.speed=0;G.money.statBump('slides',1);G.quest.dailyEvt('trick',1);}
   return;
  }
  const galloping=RIDE.gallop&&RIDE.fwd&&!player.flying;
  if(galloping&&hasTrick(h,'sprint'))RIDE.target*=BOND_TRICKS.sprint.mul*(bm.sprintMul||1);
  /* sprint: faster than a gallop and hungrier for it */
  if(galloping&&sprintInput&&!player.blown&&player.stam>0.2){R.sprinting=true;RIDE.target*=SPRINT_MUL;RIDE.drain*=SPRINT_DRAIN;}
  else R.sprinting=false;
  if(R.sprinting&&(keys.Space||touch.jump)&&player.y<=0.05&&R.dashCd<=0&&!R.dashHeld){
   R.dashT=DASH_DUR*(hasPerk(h,'durableDashes')?RIDE_PERKS.durableDashes.dashMul:1); R.dashCd=DASH_CD; player.stam=Math.max(0,player.stam-DASH_COST);
   G.beep(420,90,0.1,'triangle',0.06); flash('🚀 Dash!');
  }
  R.dashHeld=!!(keys.Space||touch.jump);
  if(R.sprinting)RIDE.noJump=true;                       // while sprinting, Space is the dash
  if(R.dashT>0){R.dashT-=dt;RIDE.target*=DASH_MUL;RIDE.noJump=true;}
  /* breed + perk stamina rules */
  if(bm.regenMul)RIDE.regen*=bm.regenMul;
  if(bm.regenPerHighTack)RIDE.regen*=1+bm.regenPerHighTack*highTackCount(h);
  if(c&&c.ev&&c.ev.xc&&bm.xcStamMul)RIDE.drain/=bm.xcStamMul;
  if(galloping&&hasPerk(h,'forwardMomentum'))player.stam=Math.min(1,player.stam+dt*RIDE_PERKS.forwardMomentum.regenMoving);
  if(player.blown&&hasPerk(h,'secondWind')&&player.stam>RIDE_PERKS.secondWind.blownAt)player.blown=false;
  /* exhaustion: a blown horse asked to gallop for a second and a half stumbles */
  if(player.blown&&galloping){R.blownHold+=dt; if(R.blownHold>1.5){R.blownHold=0;player.landT=0.3;player.speed*=0.6;if(!R.blownToast){R.blownToast=true;toast('😮‍💨 '+((h&&h.name)||'She')+' is blown — let her walk');}}}
  else R.blownHold=0;
  if(!player.blown)R.blownToast=false;
 });
 function highTackCount(h){
  const now=performance.now(); if(now-R.tackAt<2000)return R.highTack; R.tackAt=now;
  try{const s=G.save.fresh(); const inv=(s&&s.tack)||[]; let n=0; for(const sl of T.GEAR_SLOTS){const id=h&&h.gear&&h.gear[sl]; const it=id&&inv.find(t=>t.id===id); if(it&&T.RARITIES.indexOf(it.rarity)>=3)n++;} R.highTack=n;}catch(e){R.highTack=0;}
  return R.highTack;
 }

 /* ---------------------------------------------------------------- first person -------- */
 const FP={on:false,yaw:0,pitch:0,drag:null,eye:new THREE.Vector3(),look:new THREE.Vector3(),tmp:new THREE.Vector3()};
 function setFP(on){
  FP.on=!!on; document.body.classList.toggle('fpv',FP.on);
  if(!FP.on){ if(player.rider&&player.rider.g)player.rider.g.visible=true; FP.yaw=0; FP.pitch=0; }
  else toast('👁️ First person — T to go back');
 }
 addEventListener('pointerdown',e=>{ if(!FP.on||e.target!==G.renderer.domElement)return; FP.drag={x:e.clientX,y:e.clientY}; });
 addEventListener('pointermove',e=>{ if(!FP.on||!FP.drag)return; FP.yaw=clamp(FP.yaw-(e.clientX-FP.drag.x)*0.006,-2.4,2.4); FP.pitch=clamp(FP.pitch-(e.clientY-FP.drag.y)*0.004,-0.6,0.6); FP.drag={x:e.clientX,y:e.clientY}; });
 addEventListener('pointerup',()=>{FP.drag=null;});
 G.on('camera',({dt,sp})=>{
  if(!FP.on||!player.mesh)return false;
  const cam=G.camera, m=player.mesh, sc=m.scale.x||1;
  if(player.rider&&player.rider.g&&player.rider.g.visible)player.rider.g.visible=false;
  const bob=Math.sin((player.phase||0)*2)*0.03*Math.min(1,sp/4);
  FP.eye.set(m.position.x+Math.sin(player.heading)*0.35*sc,m.position.y+2.15*sc+bob,m.position.z+Math.cos(player.heading)*0.35*sc);
  cam.position.lerp(FP.eye,1-Math.exp(-28*dt));
  if(!FP.drag&&Math.abs(player.speed)>0.5){FP.yaw+=(0-FP.yaw)*Math.min(1,dt*1.5);}
  const yaw=player.heading+FP.yaw;
  FP.look.set(cam.position.x+Math.sin(yaw)*Math.cos(FP.pitch),cam.position.y+Math.sin(FP.pitch)+0.05,cam.position.z+Math.cos(yaw)*Math.cos(FP.pitch));
  cam.lookAt(FP.look);
  const fovT=66; if(Math.abs(cam.fov-fovT)>0.1){cam.fov+=(fovT-cam.fov)*Math.min(1,dt*3);cam.updateProjectionMatrix();}
  return true;
 });

 /* ---------------------------------------------------------------- events + gate ------- */
 let pendingDi=null;
 G.on('courseGate',(ev,di)=>{
  const h=ridden(); const ok=eventOk(ev,h);
  if(!ok.ok){toast('🔒 '+ev.name+' needs '+missingText(ok.missing)+' — train in the drills');return true;}
  let use=di; if(use==null){try{use=G.save.fresh().evDiff;}catch(e){} if(use==null)use=1;}
  use=clamp(Math.round(use),0,DIFFS.length-1);
  if(DIFFS[use].lvlAdd&&(h.level||1)<ev.lvl+DIFFS[use].lvlAdd){toast('🔥 Elite '+ev.name+' opens at Lv '+(ev.lvl+DIFFS[use].lvlAdd));return true;}
  pendingDi=use; G.save.sync(s=>{s.evDiff=use;});
  return false;
 });
 G.on('eventGate',(ev,h)=>{ const r=eventOk(ev,h); const first=r.missing.find(m=>m[0]!=='level');
  return {ok:r.ok,missing:r.missing,html:r.ok?'':' <span style="font-size:11px;color:#8c7a63">needs '+missingText(r.missing)+'</span>'+(first?' <button data-drill="'+first[0]+'" style="font-size:11px;padding:3px 8px" title="Train '+T.STAT_LBL[first[0]]+' in a drill">Drill</button>':'')}; });
 G.on('eventEnter',(ev,i,ctx)=>{
  const h=ridden(), lvl=(h&&h.level)||1;
  return '<span class="evdiff">'+DIFFS.map((d,di)=>{
   const locked=d.lvlAdd&&lvl<ev.lvl+d.lvlAdd; const pay=Math.round(ev.reward*d.rewMul*(ctx.isF?1.5:1));
   return locked?'<span style="font-size:11px;color:#b8a98a">🔒 '+d.label+' Lv '+(ev.lvl+d.lvlAdd)+'</span>':'<button data-ev="'+i+':'+di+'" title="'+d.desc+'">'+d.icon+' '+d.label+' · '+pay+'🪙</button>';
  }).join('')+'</span>';
 });
 G.ui.eventRow((ev,s,h)=>{
  const di=s.evDiff==null?1:s.evDiff; const ok=eventOk(ev,h);
  const rb=(s.ribbonsBy||{}); const by=DIFFS.map(d=>rb[ev.id+':'+d.k]?d.icon+'🎀'.repeat(Math.min(3,rb[ev.id+':'+d.k])):'').filter(Boolean).join(' ');
  return '<div class="evcard">⏱ <b>'+fmtT(eventTimeAllowed(ev,di))+'</b> allowed'+(ev.laps>1?' · <b>'+ev.laps+' laps</b>':'')+(ev.line?' · 📏 line riding':'')+(ev.xc?' · 🫀 stamina course':'')
   +' · needs Lv '+ev.lvl+(ev.req?Object.entries(ev.req).map(([k,v])=>' · '+T.STAT_LBL[k]+' '+v).join(''):'')
   +'<br>🎁 '+eventRewardLine(ev,di)+(s.bestAcc&&s.bestAcc[ev.id]?' · best 🎯 '+Math.round(s.bestAcc[ev.id]*100)+'%':'')+(by?' · '+by:'')+'</div>';
 });
 G.ui.eventCard((s,h)=>{
  const di=s.evDiff==null?1:s.evDiff;
  return '<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎯 How a round is scored</b><span class="evcard">Every fence is graded at the crossing — <b>perfect</b> in the middle of the arc, <b>good</b> either side, <b>late</b> or <b>early</b> at the edges, rails down is a fault and a horse that runs up to a fence without being asked to jump refuses. Cutting the line between fences costs seconds. Three green ribbons for finishing, two stars and three stars; the <b>🥇 gold</b> needs 95% accuracy with nothing down. Difficulty: '+DIFFS.map(d=>d.icon+' <b>'+d.label+'</b> '+d.desc).join(' · ')+'. Last ridden: '+DIFFS[di].label+'.</span></div>';
 });
 G.ui.careSection((s,h)=>{
  const bl=bondLevel(h), lvl=h.level||1;
  return '<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🤝 Bond tricks · level '+bl+'</b><span class="evcard">'
   +Object.values(BOND_TRICKS).map(t=>(bl>=t.lvl?'✅ ':'🔒 ')+t.icon+' <b>'+t.label+'</b> (bond level '+t.lvl+') — '+t.desc).join('<br>')
   +'</span><b style="width:100%">🏇 Riding perks · Lv '+lvl+'</b><span class="evcard">'
   +Object.values(RIDE_PERKS).map(p=>(lvl>=p.lvl?'✅ ':'🔒 ')+p.icon+' <b>'+p.label+'</b> (Lv '+p.lvl+') — '+p.desc).join('<br>')
   +'<br>Gaits: W canter · Shift gallop · double-tap Shift to sprint · Space while sprinting dashes · Ctrl collects to a walk · T first person</span></div>';
 });

 /* ---------------------------------------------------------------- course build -------- */
 const disc=new THREE.CylinderGeometry(0.45,0.45,0.04,12);
 const lineMat=new THREE.MeshBasicMaterial({color:0xffd166,transparent:true,opacity:0.45});
 const padGeo=new THREE.CylinderGeometry(1.4,1.4,0.08,16);
 const padMat=new THREE.MeshStandardMaterial({color:0x9be7ff,emissive:0x5ac8ff,emissiveIntensity:0.8,roughness:0.35});
 function makePad(x,z){const m=new THREE.Mesh(padGeo,padMat);m.position.set(x,W.groundH(x,z)+0.05,z);G.scene.add(m);return m;}
 function makeLogFence(x,z,rotY,fence){
  const g=new THREE.Group(); const mats=W.mats;
  W.box(0.22,1.0*fence,0.22,mats.plankBrownMat,-1.6,0.5*fence,0,g); W.box(0.22,1.0*fence,0.22,mats.plankBrownMat,1.6,0.5*fence,0,g);
  const log=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.19,3.4,10),mats.plankBrownMat); log.rotation.z=Math.PI/2; log.position.y=0.86*fence; g.add(log);
  W.box(3.2,0.1,0.1,mats.whitePaintMat,0,0.45*fence,0,g);
  g.position.set(x,W.groundH(x,z),z); g.rotation.y=rotY; G.scene.add(g); return g;
 }
 G.on('courseStart',c=>{
  if(!c||c.dressage||(c.ev.kind&&G.course.kinds[c.ev.kind])){ if(c&&c.dressage){c.ce={dressage:true,diff:DIFFS[pendingDi==null?1:pendingDi]}; c.rb={diff:c.ce.diff.k}; c.payMul=c.ce.diff.rewMul; } pendingDi=null; return; }
  const ev=c.ev, di=pendingDi==null?1:pendingDi, diff=DIFFS[di]; pendingDi=null;
  const S=c.ce={diff,di,lap:1,laps:ev.laps||1,timeAllowed:0,acc:1,grades:[],lineOff:0,refusals:0,insp:0,off:0,lastGrade:null,lineWarned:false,legIdx:-1,line:null,lineMesh:null,timeFaults:0,kind:ev.xc?'xc':ev.race?'race':'jump'};
  c.par*=diff.parMul; S.timeAllowed=(ev.time?ev.time*diff.parMul:c.par*1.4);
  /* difficulty: rail height */
  for(const j of c.jumps){ if(!j.ring&&j.g)j.g.scale.y=diff.fence; j.kind=j.ring?'gate':'fence'; j.refuseCd=0; }
  /* cross country: a natural fence in the middle of every leg, gate–fence–gate–fence */
  if(ev.xc){
   const gates=c.jumps.slice(); const out=[];
   gates.forEach((g,i)=>{ const nx=gates[(i+1)%gates.length]; out.push(g);
    const mx=(g.x+nx.x)/2, mz=(g.z+nx.z)/2, rotY=Math.atan2(nx.x-g.x,nx.z-g.z);
    out.push({x:mx,z:mz,rotY,g:makeLogFence(mx,mz,rotY,diff.fence),prevSide:0,kind:'fence',refuseCd:0}); });
   c.jumps.length=0; for(const j of out)c.jumps.push(j);
   let len=0; gates.forEach((g,i)=>{const nx=gates[(i+1)%gates.length];len+=Math.hypot(nx.x-g.x,nx.z-g.z);});
   c.par=len/6.5*diff.parMul; S.timeAllowed=c.par*1.4;
  }
  /* speed pads at 0.55 of every race leg */
  if(ev.race){ const gates=c.jumps.filter(j=>j.kind==='gate'); gates.forEach((g,i)=>{const nx=gates[(i+1)%gates.length]; const x=g.x+(nx.x-g.x)*0.55, z=g.z+(nx.z-g.z)*0.55; c.items.push({x,z,type:'pad',pad:true,cd:0,m:makePad(x,z)});}); }
  /* the ideal line: legs between consecutive obstacles (fences get a 6 m approach point) */
  if(ev.line){ S.line=c.jumps.map((j,i)=>{ const p=c.jumps[(i-1+c.jumps.length)%c.jumps.length]; const ax=j.kind==='fence'?j.x-Math.sin(j.rotY)*6:j.x, az=j.kind==='fence'?j.z-Math.cos(j.rotY)*6:j.z; return {x1:p.x,z1:p.z,x2:ax,z2:az,tol:j.kind==='fence'&&!ev.xc?LINE_TOL.jump:LINE_TOL.race}; });
   S.lineMesh=new THREE.InstancedMesh(disc,lineMat,24); S.lineMesh.count=0; G.scene.add(S.lineMesh); }
  c.payMul=diff.rewMul; c.rb={acc:1,lineOff:0,refusals:0,diff:diff.k,par:c.par};
  const total=c.jumps.length*S.laps;
  toast((ev.xc?'🌲 ':ev.race?'🏁 ':'🏇 ')+diff.icon+' '+diff.label+' · '+fmtT(S.timeAllowed)+' allowed'+(S.laps>1?' · '+S.laps+' laps':'')+(ev.line?' · stay on the line':'')+' · '+total+' to go');
 });

 /* ---------------------------------------------------------------- course tick --------- */
 const _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_v=new THREE.Vector3(),_s=new THREE.Vector3(1,1,1);
 function accuracy(S){
  let acc=S.grades.length?S.grades.reduce((a,g)=>a+GRADE[g].s,0)/S.grades.length:1;
  if(S.kind!=='jump'&&!S.grades.length&&S.par>0)acc=1;
  acc-=S.refusals*0.08+Math.min(0.2,S.lineOff*0.02)+S.off*0.05;
  return clamp(acc,0,1);
 }
 function raceAccuracy(c,S){ const base=c.t>0?clamp(c.par/c.t,0,1):1; return clamp(base-Math.min(0.2,S.lineOff*0.02),0,1); }
 function gradeCrossing(){
  const Rg=rig();
  if(Rg.heroMotion){ const a=Rg.heroJumpAge; if(a==null||a>1.25)return player.y>0.4?'good':'fault'; if(a>=0.58&&a<=0.96)return 'perfect'; if(a>=0.42&&a<=1.12)return 'good'; return a<0.42?'late':'early'; }
  const y=player.y; if(y<=0.4)return 'fault'; if(y>0.85&&y<1.7)return 'perfect'; if(y>0.62)return 'good'; return player.vy<0?'early':'late';
 }
 function segDist(px,pz,L){const abx=L.x2-L.x1,abz=L.z2-L.z1;const l2=abx*abx+abz*abz||1;const tt=clamp(((px-L.x1)*abx+(pz-L.z1)*abz)/l2,0,1);return Math.hypot(px-(L.x1+abx*tt),pz-(L.z1+abz*tt));}
 function layLine(S,L){
  const n=S.lineMesh.count=24, dx=(L.x2-L.x1)/n, dz=(L.z2-L.z1)/n;
  for(let i=0;i<n;i++){const x=L.x1+dx*(i+0.5),z=L.z1+dz*(i+0.5);_v.set(x,W.groundH(x,z)+0.06,z);_m4.compose(_v,_q,_s);S.lineMesh.setMatrixAt(i,_m4);}
  S.lineMesh.instanceMatrix.needsUpdate=true;
 }
 function finalize(c,S){
  c.t+=Math.floor(S.lineOff/2);
  if(c.t>S.timeAllowed){S.timeFaults=Math.ceil((c.t-S.timeAllowed)/4);c.faults=(c.faults||0)+S.timeFaults;}
  S.acc=S.kind==='jump'||S.grades.length?accuracy(S):raceAccuracy(c,S);
  c.insp=S.insp; c.off=S.off;
  c.rb={acc:S.acc,lineOff:S.lineOff,refusals:S.refusals,diff:S.diff.k,par:c.par,timeFaults:S.timeFaults,grades:S.grades.slice()};
 }
 function advance(c,S){
  c.idx++;
  if(c.idx<c.jumps.length)return false;
  if(S.lap<S.laps){S.lap++;c.idx=0;for(const j of c.jumps){j.prevSide=0;j.approached=false;if(j.ring)j.ring.material.color.set(0xffd166);}toast('🔁 Lap '+S.lap+' of '+S.laps);G.sChime();return false;}
  finalize(c,S); G.course.finishCourse(); return true;
 }
 G.on('courseTick',(c,dt,t)=>{
  const S=c.ce; if(!S||S.dressage)return false;
  /* pickups and pads */
  for(const it of c.items){
   if(it.pad){ if(it.cd>0){it.cd-=dt;const k=1+0.15*Math.sin(it.cd*9);it.m.scale.set(k,1,k);if(it.cd<=0)it.m.scale.set(1,1,1);continue;}
    it.m.rotation.y+=dt*0.8; if(Math.hypot(player.pos.x-it.x,player.pos.z-it.z)<1.6&&Math.abs(player.speed)>1){it.cd=4;player.boostT=Math.max(player.boostT||0,2.2);G.sCoin();flash('⚡ Speed pad!');} continue; }
   if(!it.m.visible)continue; it.m.rotation.y+=dt*3;
   if(Math.hypot(player.pos.x-it.x,player.pos.z-it.z)<2.4){it.m.visible=false;T.RACE_ITEMS[it.type].fx();G.sCoin();toast(T.RACE_ITEMS[it.type].label);}
  }
  const j=c.jumps[c.idx];
  if(j&&j.kind==='gate'){
   if(Math.hypot(player.pos.x-j.x,player.pos.z-j.z)<4.6){ j.ring.material.color.set(0x69db7c); G.sCoin(); if(advance(c,S))return true; }
  }else if(j){
   const lx=player.pos.x-j.x,lz=player.pos.z-j.z;
   const along=lx*Math.cos(j.rotY)-lz*Math.sin(j.rotY);
   const across=lx*Math.sin(j.rotY)+lz*Math.cos(j.rotY);
   const side=across>0?1:-1;
   if(Math.abs(across)>2&&Math.abs(across)<9&&Math.abs(along)<2.6)j.approached=true;
   j.refuseCd=Math.max(0,(j.refuseCd||0)-dt);
   /* a refusal: running up to the rails without asking for the jump */
   if(across<0&&across>-1.4&&Math.abs(along)<1.8&&Math.abs(player.speed)>2.5&&!jumpingNow()&&j.refuseCd<=0&&!player.flying){
    j.refuseCd=2.0; S.refusals++; S.lastGrade='refusal'; S.grades.push('refusal');
    player.speed=0; player.pos.x=j.x+Math.sin(j.rotY)*-1.7; player.pos.z=j.z+Math.cos(j.rotY)*-1.7;
    G.beep(90,120,0.18,'square',0.09); flash('🛑 Refusal'); toast('🛑 Refusal — ask for the jump with Space as you meet the fence');
   }
   else if(j.prevSide!==0&&side!==j.prevSide&&Math.abs(along)<1.8&&Math.abs(across)<1.3){
    if(side>0){
     const g=gradeCrossing(); S.lastGrade=g; S.grades.push(g);
     const insp=g==='perfect', offline=!j.approached;
     if(g==='fault'){ c.faults=(c.faults||0)+1; G.beep(90,120,0.18,'square',0.09); flash('💥 Rails down'); }
     else{ G.sChime(); G.money.statBump('jumps',1); flash(GRADE[g].icon+' '+GRADE[g].text); }
     if(insp){ S.insp++; c.t=Math.max(0,c.t-0.8); player.stam=Math.min(1,player.stam+0.18); R.inspFlash=0.4; G.xp.passAdd(2); toast('✨ Inspiring jump! −0.8 s · stamina back'); }
     if(offline){ S.off++; c.t+=1.0; toast('↪️ Off the line — +1 s'); }
     j.approached=false;
     if(advance(c,S))return true;
    }
   }
   j.prevSide=Math.abs(across)>0.05?side:j.prevSide;
  }
  /* the line between obstacles */
  if(S.line&&c.idx>0){
   const L=S.line[c.idx];
   if(S.legIdx!==c.idx){S.legIdx=c.idx;S.lineWarned=false;layLine(S,L);}
   if(Math.abs(player.speed)>1&&segDist(player.pos.x,player.pos.z,L)>L.tol){ S.lineOff+=dt; if(!S.lineWarned&&S.lineOff>=1){S.lineWarned=true;toast('📏 Line penalty — ride the marked line between obstacles');} }
  }else if(S.lineMesh&&S.lineMesh.count){S.lineMesh.count=0;}
  /* arrow + hud */
  for(const cj of c.jumps)if(cj.ring)cj.ring.rotation.z+=dt*1.6;
  const nj=c.jumps[c.idx];
  if(nj){
   const arrow=G.course.arrow; if(arrow){arrow.visible=true;arrow.position.set(nj.x,W.groundH(nj.x,nj.z)+(nj.kind==='gate'?3.4:2.6)+Math.sin(t*4)*0.18,nj.z);}
   const acc=S.kind==='jump'||S.grades.length?accuracy(S):raceAccuracy(c,S);
   $('courseHudTxt').textContent='🏆 '+c.ev.name+(S.laps>1?' · Lap '+S.lap+'/'+S.laps:'')+(nj.kind==='gate'?' · Gate ':' · Jump ')+(c.idx+1)+'/'+c.jumps.length+' · ⏱ '+c.t.toFixed(1)+'/'+Math.round(S.timeAllowed)+'s · 🎯 '+Math.round(acc*100)+'%'+(c.faults?' · 💥'+c.faults:'')+(S.lastGrade?' · '+GRADE[S.lastGrade].icon:'');
  }
  return true;
 });

 /* ---------------------------------------------------------------- ribbons + finish ---- */
 G.on('ribbons',RB=>{
  const acc=RB.acc||0, gold=acc>=0.95&&(RB.faults||0)===0&&(RB.refusals||0)===0&&(RB.lineOff||0)<1;
  RB.gold=gold; RB.rib=1+(RB.stars>=2?1:0)+(RB.stars>=3?1:0)+(gold?1:0);
  const ev=RB.ev, rib=RB.rib, diff=RB.diff||'open';
  G.save.sync(s=>{ s.ribbonGold=s.ribbonGold||{}; s.ribbonsBy=s.ribbonsBy||{}; if(gold)s.ribbonGold[ev.id]=true; const k=ev.id+':'+diff; s.ribbonsBy[k]=Math.max(s.ribbonsBy[k]||0,rib); });
  G.quest.questEvt('ribbons',rib); if(gold){G.quest.questEvt('gold',ev.id);G.quest.dailyEvt('gold',1);}
 });
 G.quest.types.ribbons=(m,val,prog)=>prog+(typeof val==='number'?val:1);
 G.quest.types.gold=(m,val,prog)=>(!m.ev||val===m.ev)?m.goal:prog;
 G.on('courseFinish',({c,ev,RB,pay,dressage,pct})=>{
  const acc=dressage?pct:(c.rb&&c.rb.acc)||0; const S=c.ce||{};
  G.save.sync(s=>{ s.bestAcc=s.bestAcc||{}; if(!s.bestAcc[ev.id]||acc>s.bestAcc[ev.id])s.bestAcc[ev.id]=+acc.toFixed(3);
   const h=s.horses[G.horse.rideIdx()]; if(h){const sx=statXpFor(ev); const mul=(S.diff&&S.diff.rewMul)||1; for(const k in sx)G.xp.grantStatXp(s,h,k,Math.round(sx[k]*mul*Math.max(0.3,acc)));}
   if(ev.xc)s.stats.xc=(s.stats.xc||0)+1; });
  if(!dressage){
   const parts=['🎯 '+Math.round(acc*100)+'% accuracy'];
   if(S.grades&&S.grades.length){const cnt={};for(const g of S.grades)cnt[g]=(cnt[g]||0)+1;parts.push(GRADE_KEYS.filter(k=>cnt[k]).map(k=>GRADE[k].icon+'×'+cnt[k]).join(' '));}
   if(S.timeFaults)parts.push('⏱ over time +'+S.timeFaults+' faults');
   if(S.lineOff>=1)parts.push('📏 line +'+Math.floor(S.lineOff/2)+' s');
   parts.push((S.diff||DIFFS[1]).icon+' '+(S.diff||DIFFS[1]).label);
   if(RB&&RB.gold)parts.push('🥇 GOLD RIBBON');
   toast(parts.join(' · '));
   if(S.lineOff<1)G.quest.dailyEvt('lineclean',1);
   if(ev.xc)G.quest.dailyEvt('xc',1);
  }else if(RB&&RB.gold)toast('🥇 Gold ribbon — a '+Math.round(acc*100)+'% test');
 });

 /* ---------------------------------------------------------------- world speed pads ---- */
 for(const [i,[x,z]] of [[-26,-18],[-115,-10],[-48,32]].entries()){
  const m=makePad(x,z); const pad={cd:0};
  W.addThing({kind:'pad',id:'pad'+i,g:m,x,z,label:()=>'⚡ Speed pad — ride over it',use:()=>{},
   tick(dt,t,dist){ if(pad.cd>0){pad.cd-=dt;const k=1+0.15*Math.sin(pad.cd*9);m.scale.set(k,1,k);if(pad.cd<=0)m.scale.set(1,1,1);return;} m.rotation.y+=dt*0.8; if(dist<1.6&&Math.abs(player.speed)>1){pad.cd=4;player.boostT=Math.max(player.boostT||0,2.2);G.sCoin();flash('⚡ Speed pad!');} }});
 }

 /* ---------------------------------------------------------------- per frame ----------- */
 let lastCourse=null;
 G.on('tick',(dt,t)=>{
  const c=G.course.get(); const h=ridden(); const Rg=rig();
  /* course visuals come down with the course */
  if(lastCourse&&lastCourse!==c&&lastCourse.ce&&lastCourse.ce.lineMesh){G.scene.remove(lastCourse.ce.lineMesh);lastCourse.ce.lineMesh.dispose();lastCourse.ce.lineMesh=null;}
  lastCourse=c;
  /* jumping costs stamina */
  const age=Rg.heroMotion?Rg.heroJumpAge:null;
  const jumpStart=Rg.heroMotion?(age!==null&&R.lastJumpAge===null):(player.vy>0&&!R.wasAir&&!player.flying);
  if(jumpStart&&!player.flying){player.stam=Math.max(0,player.stam-(((h&&h.stats&&h.stats.stamina)||3)>=7?0.05:0.08));}
  R.lastJumpAge=age; R.wasAir=player.y>0.05||player.vy>0;
  /* sliding stop pose */
  if(R.slide&&player.mesh){const p=Math.min(1,R.slide.t/R.slide.dur),env=Math.sin(p*Math.PI); player.mesh.rotation.x+=-0.22*env; player.mesh.position.y-=0.12*env;
   R.slide.dust+=dt; if(R.slide.dust>0.1&&W.puffDust){R.slide.dust=0;const gy=W.groundH(player.pos.x,player.pos.z);for(const sgn of[-1,1])W.puffDust(player.pos.x-Math.sin(player.heading)*0.9+Math.cos(player.heading)*0.3*sgn,gy,player.pos.z-Math.cos(player.heading)*0.9-Math.sin(player.heading)*0.3*sgn);}}
  /* HUD: gait icon, stamina bar states, grade flash */
  const ge=$('gaitEl'); if(ge&&!player.flying){ if(R.slide)ge.textContent='🛑'; else if(R.dashT>0)ge.textContent='🚀'; else if(R.sprinting)ge.textContent='⚡'; }
  const sw=$('stamWrap'); if(sw){ if(R.sprinting||R.dashT>0){sw.style.display='block';$('stamFill').style.width=Math.round(player.stam*100)+'%';} sw.classList.toggle('sprint',!!R.sprinting); if(R.inspFlash>0){R.inspFlash-=dt;sw.classList.add('insp');sw.style.display='block';}else sw.classList.remove('insp'); }
  if(flashT>0){flashT-=dt;if(flashT<=0)gradeFlash.classList.remove('on');}
  if(FP.on&&player.rider&&player.rider.g&&player.rider.g.visible)player.rider.g.visible=false;
 });

 /* ---------------------------------------------------------------- quests -------------- */
 G.quest.addDaily({type:'lineclean',icon:'📏',label:'Finish a course on the line',goal:1,r:{c:150,p:15}});
 G.quest.addDaily({type:'gold',icon:'🥇',label:'Earn a gold ribbon',goal:1,r:{c:300,g:2,p:25}});
 G.quest.addDaily({type:'xc',icon:'🌲',label:'Ride a cross-country course',goal:1,r:{c:200,p:20}});
 G.quest.addAch({id:'acc95',icon:'🎯',label:'Clockwork',desc:'Finish a round at 95% accuracy',v:s=>Object.values(s.bestAcc||{}).filter(a=>a>=0.95).length,goal:1,r:{c:400,k:1}});
 G.quest.addAch({id:'gold5',icon:'🥇',label:'Gold standard',desc:'Earn 5 gold ribbons',v:s=>Object.keys(s.ribbonGold||{}).length,goal:5,r:{g:4,k:2}});
 G.quest.addAch({id:'slide10',icon:'🛑',label:'Reiner',desc:'Slide to a stop 10 times',v:s=>(s.stats&&s.stats.slides)||0,goal:10,r:{c:250}});
 G.quest.addAch({id:'xc3',icon:'🌲',label:'Ridge rider',desc:'Finish 3 cross-country courses',v:s=>(s.stats&&s.stats.xc)||0,goal:3,r:{c:500,g:2}});
 G.quest.addAch({id:'elite1',icon:'🔥',label:'Elite company',desc:'Win a ribbon at Elite difficulty',v:s=>Object.keys(s.ribbonsBy||{}).filter(k=>k.endsWith(':elite')).length,goal:1,r:{c:600,g:3}});

 /* ---------------------------------------------------------------- state --------------- */
 G.on('state',o=>{
  const c=G.course.get(); const S=c&&c.ce;
  if(o.course&&S&&!S.dressage)Object.assign(o.course,{kind:S.kind,diff:S.diff.k,lap:S.lap,laps:S.laps,timeAllowed:Number(S.timeAllowed.toFixed(1)),accuracy:Number((S.kind==='jump'||S.grades.length?accuracy(S):raceAccuracy(c,S)).toFixed(3)),lastGrade:S.lastGrade,grades:S.grades.slice(),lineOff:Number(S.lineOff.toFixed(2)),refusals:S.refusals,inspiring:S.insp,offLine:S.off,par:Number(c.par.toFixed(1)),jumpKinds:c.jumps.map(j=>j.kind)});
  if(o.player)Object.assign(o.player,{sprint:!!R.sprinting,dash:R.dashT>0,slide:!!R.slide,blown:!!player.blown,boost:(player.boostT||0)>0});
  if(o.camera)o.camera.mode=FP.on?'fp':'orbit';
 });
 /* handles for QA and for sister packages (events-pvp reads DIFFS and eventOk) */
 G.course.DIFFS=DIFFS; G.course.eventOk=eventOk; G.course.eventTimeAllowed=eventTimeAllowed; G.course.ribbonStr=ribbonStr; G.course.BOND_TRICKS=BOND_TRICKS; G.course.RIDE_PERKS=RIDE_PERKS; G.course.BREED_RIDE_MODS=BREED_RIDE_MODS; G.course.GRADE=GRADE; G.course.setFP=setFP; G.course.trySlide=trySlide; G.course.rideState=R;
}
