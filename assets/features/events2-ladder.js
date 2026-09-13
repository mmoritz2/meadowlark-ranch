/* Feature package 'events2-ladder'. Owned by that package: edit only this file and the inline hot spots
   assigned to it. See index.js for the contract. Nothing runs at import time.

   What lives here — the part of a competition that happens AFTER the clock stops, and the part
   that makes a single round feel like one rung of something longer:

     the field       a solo race in this game used to be a time trial against nobody. Three or four
                     named rivals from the valley now stand in the box with you, ride the same route
                     at a pace drawn from their ranch's strength, and finish above or below you. The
                     placing is real, it moves while you ride, and it settles on the card.
     the result card one panel at the end of a round with everything on it — the rosette, the time
                     against the allowance, the discipline's own score sheet, the field, the purse,
                     the racing points, the rank bar and what to ride next. The engine already
                     computed all of it; it was being thrown at the player as seven transient toasts,
                     the important one arriving half a minute after they had ridden away.
     the weekly board course-engine sets RB.gold on its own ribbon object, and awardRibbons hands
                     back a FRESH object that does not carry it, so the weekly leaderboard could
                     never see a gold ribbon and never recorded a single time. We catch the gold on
                     the 'ribbons' hook instead, write the board ourselves, and publish it.
     the ladder tab  ranks, tickets, the four featured events with the reasons you cannot ride them,
                     your band on the prize ladder, the ribbon tally and the championship path — all
                     of it existed in the save and none of it was ever shown to anybody.
     ribbons         s.ribbons is a per-event BEST, so an event stops paying ribbons forever once it
                     has given four. That stays (the cards draw it), and a separate running tally
                     accumulates every finish, which is what the boards and the week now count.
     the unfinished  a browser tab is more fragile than a phone. A course in progress is written to
     round          the save every couple of seconds and offered back after a reload, and a ticket
                     spent on a race that a crash ate is handed straight back.

   Nothing in here is behind a wall. Tickets are the one scarce thing on the racing side and this
   package adds no new use for them that gates anything: the rematch is opt-in upside on a race you
   have already ridden for free. */
export const id='events2-ladder';
export function install(G){
 const THREE=G.THREE, $=G.$, T=G.tables, W=G.world, player=G.horse.player;
 const toast=(...a)=>G.toast(...a);          // called through G so a QA run (and our own filter) can listen in
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const evById=k=>T.EVENTS3.find(e=>e.id===k);
 const ridden=()=>G.horse.ridden();
 const E=()=>G.events||{};                   // events-pvp is a sibling, not a dependency: feature-detect everything
 function hash(str){let h=0x811c9dc5|0;for(let i=0;i<String(str).length;i++){h^=String(str).charCodeAt(i);h=Math.imul(h,0x01000193);}return ((h>>>8)&0xffff)/0xffff;}
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 const s1=v=>(Math.round(v*10)/10).toFixed(1);
 const pc=v=>Math.round((v||0)*100);
 const DIFFS=()=>G.course.DIFFS||[{k:'open',label:'Open',icon:'🏇',parMul:1,rewMul:1}];
 const diffOf=k=>DIFFS().find(d=>d.k===k)||DIFFS()[1]||DIFFS()[0];

 /* ================================================================= data ================= */
 /* Three rivals is a field you can read at a glance on a HUD that has to stay under 44vw; four
    on Elite, because the whole point of picking Elite is the company you keep. */
 const FIELD_N={novice:3,open:3,elite:4};
 const FIELD_SPREAD={novice:1.08,open:1.0,elite:0.94};      // how hard the field rides at each grade
 const REMATCH_TIGHTEN=0.93, REMATCH_PTS=2;                 // a ticket buys a faster field and double points
 const RIB_TIERS=[[25,{c:400,p:20}],[75,{g:4,k:1,p:40}],[150,{g:8,k:2,gear:'Epic',p:80}],[300,{g:14,k:3,gear:'Legendary',p:140}]];
 const RUN_KEEP=20*60000;                                   // an unfinished round is worth offering back for twenty minutes

 /* ================================================================= save ================= */
 G.save.ensure(s=>{
  const L=s.lad=s.lad||{};
  L.rib=L.rib||{total:0,byEv:{},week:'',wkTotal:0};
  L.wk=L.wk||{week:'',times:{},gold:{},score:{}};
  L.tiers=L.tiers||{}; L.titles=L.titles||[]; L.champion=L.champion||null;
  L.races=L.races||0; L.wins=L.wins||0; L.podiums=L.podiums||0;
  if(s.lastRun===undefined)s.lastRun=null;
  if(s.runSaved===undefined)s.runSaved=null;
  const wk=G.time.weekKey();
  if(L.rib.week!==wk){L.rib.week=wk;L.rib.wkTotal=0;}
  if(L.wk.week!==wk){L.wk={week:wk,times:{},gold:{},score:{}};}
  /* ensureWeek (ranch3d) throws the whole s.weekly object away when the week turns, which takes
     the leaderboard times with it before Monday's settlement has had a chance to read them. Our
     own copy is the survivor, and it is put back only when the board is genuinely empty so a test
     or a package that writes s.weekly.times deliberately is never second-guessed. */
  s.weekly=s.weekly||{}; s.weekly.times=s.weekly.times||{}; s.weekly.gold=s.weekly.gold||{};
  if(s.weekly.week===wk&&!Object.keys(s.weekly.times).length){
   for(const k in L.wk.times)s.weekly.times[k]=L.wk.times[k];
   for(const k in L.wk.gold)s.weekly.gold[k]=L.wk.gold[k];
  }
 });
 const lad=s=>(s&&s.lad)||{rib:{total:0,byEv:{}},wk:{times:{},gold:{},score:{}},titles:[]};

 /* ================================================================= the real par ========= */
 /* eventPar falls back to ev.n*9 and then to a flat 40, and not one racing row carries either —
    so every race and every cross-country event in the game advertised '56s allowed', six gates and
    twelve alike, while the course itself handed out the length of the route divided by 7.2. The
    number is knowable at install time from the route the gates are built from, so we write it once
    onto the row and eventPar, eventTimeAllowed and ui2-compete's own spec grid all tell the truth
    afterwards with no edit to any of them. */
 function routeLen(key){
  const pts=T.RACE_ROUTES[key]; if(!pts||pts.length<2)return 0;
  let len=0; for(let i=0;i<pts.length;i++){const n=pts[(i+1)%pts.length];len+=Math.hypot(n[0]-pts[i][0],n[1]-pts[i][1]);}
  return len;
 }
 function fixRacePars(){
  for(const ev of T.EVENTS3){
   if(!ev.race||!ev.route||ev.par||ev.friendly)continue;
   const len=routeLen(ev.route); if(!(len>0))continue;
   ev.par=+(len/(ev.xc?6.5:7.2)).toFixed(1);      // the same two constants course-engine uses at the start box
  }
 }
 fixRacePars();

 /* ================================================================= styles + HUD ========= */
 const style=document.createElement('style');
 style.textContent='#ladHud{display:none;position:fixed;top:96px;right:10px;z-index:9;background:var(--dark,#3b2d1e);color:#fff8ea;padding:6px 10px;border-radius:12px;font-size:11.5px;font-weight:600;max-width:44vw;text-align:right;line-height:1.5}'
  +'#ladHud.on{display:block}#ladHud .me{color:#ffd166}#ladHud i{font-style:normal;opacity:.65;margin-left:5px}'
  +'#resultPanel{gap:8px}'
  +'.ladCard{width:100%;font-size:11px;color:#6b5a45;line-height:1.5;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}'
  +'.ladCard b{color:#3d2f22}.ladCard button{font-size:10.5px;padding:3px 8px}'
  +'.ladChip{font-size:11px;padding:3px 8px;border-radius:999px;background:#f0e7d6;color:#6b5a45;white-space:nowrap}'
  +'.ladChip.on{background:#d9edc4;color:#3f5f2c}.ladChip.me{background:#ffe9b8;color:#7a5a1e}.ladChip.bad{background:#f3ddd6;color:#8a4a30}'
  +'.ladRos{font-size:34px;line-height:1;letter-spacing:-2px;transform:scale(.4);opacity:0;transition:transform .45s cubic-bezier(.2,1.6,.4,1),opacity .3s}'
  +'.ladRos.in{transform:scale(1);opacity:1}'
  +'.ladBar{position:relative;height:9px;border-radius:999px;background:rgba(59,42,30,.12);overflow:hidden;flex:1;min-width:60px}'
  +'.ladBar>i{display:block;height:100%;background:linear-gradient(90deg,#e9bb52,#ffd97a)}'
  +'.ladGrid{display:flex;gap:5px;flex-wrap:wrap;width:100%}'
  +'.ladSheet{width:100%;font-size:11px;color:#6b5a45}.ladSheet div{display:flex;justify-content:space-between;gap:8px;padding:1px 0}';
 document.head.appendChild(style);
 const ladHud=document.createElement('div'); ladHud.id='ladHud'; document.body.appendChild(ladHud);

 /* ================================================================= the gold we were losing */
 /* course-engine decides the gold ribbon on the RB0 object that awardRibbons runs the hook over,
    and then awardRibbons returns a brand new {rib,stars,featured,msg} that does not carry it. Every
    reader downstream therefore saw RB.gold === undefined. Catching it here costs one hook. */
 /* Once the gold is caught, events-pvp's else-branch is telling a player who has just taken one
    that they have not — its own condition can never be true, so the false line fires on every
    featured finish. That branch lives in a file this package may not edit, so the one literal is
    filtered out on its way to the queue and replaced with the placing. Everything else passes
    through untouched, and what does pass is also kept for the result card's recap, which is how
    the card can print the whole finish instead of the player watching it drip out of a
    single-slot toast queue over the next half minute. */
 const DENIAL='🎀 Featured — but only a 🥇 gold ribbon is ranked on the weekly board.';
 let capture=null, captureAt=0, wasGold=false;
 {const inner=G.toast;
  G.toast=function(msg){
   const m=String(msg);
   if(capture&&Date.now()-captureAt>6000)capture=null;      // a finish that never produced a card
   if(wasGold&&m===DENIAL)return;                           // it was gold; the card and our own toast say so
   if(capture&&capture.length<14)capture.push(m);
   return inner.apply(this,arguments);
  };}
 let lastRB=null, preFinish=null;
 G.on('ribbons',RB0=>{
  try{
   lastRB={id:RB0.ev&&RB0.ev.id,gold:!!RB0.gold,rib:RB0.rib,stars:RB0.stars,acc:+RB0.acc||0,
    diff:RB0.diff||'open',faults:RB0.faults||0,refusals:RB0.refusals||0,lineOff:+RB0.lineOff||0,at:Date.now()};
   /* Everything the finish pays lands between this hook and the card, from half a dozen packages
      whose sums we have no business re-deriving. Snapshot the wallet here and subtract later. */
   const s=G.save.fresh()||{};
   preFinish={coins:s.coins||0,gems:s.gems||0,keys:s.keys||0,pts:(s.racing&&s.racing.pts)||0,at:Date.now()};
   wasGold=!!RB0.gold; capture=[]; captureAt=Date.now();
  }catch(e){}
 });
 const goldOf=(ev,RB)=>!!((RB&&RB.gold)||(lastRB&&lastRB.id===(ev&&ev.id)&&lastRB.gold));

 /* ================================================================= the synthetic field === */
 /* Every race in this game was run against a clock and nothing else: pvpField only ever reads live
    MQTT riders, so unless a second human happens to be in your club the track is empty, the
    placement HUD never lights and the whole placement half of the ladder does not exist. The
    neighbours already have names and strengths in T.NEIGHBOURS and already stand in on every other
    board in the game; they can stand on the track too. */
 let FIELD=null, lastC=null, pendingRematch=null;
 function loopOf(c){
  const pts=c.jumps.map(j=>({x:j.x,z:j.z})), seg=[]; let len=0;
  for(let i=0;i<pts.length;i++){const n=pts[(i+1)%pts.length], d=Math.hypot(n.x-pts[i].x,n.z-pts[i].z); seg.push(d); len+=d;}
  return {pts,seg,len:len||1};
 }
 function atDist(L,d){
  let x=((d%L.len)+L.len)%L.len;
  for(let i=0;i<L.seg.length;i++){
   if(x<=L.seg[i]||i===L.seg.length-1){
    const a=L.pts[i], b=L.pts[(i+1)%L.pts.length], f=L.seg[i]>0?clamp(x/L.seg[i],0,1):0;
    return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,h:Math.atan2(b.x-a.x,b.z-a.z)};
   }
   x-=L.seg[i];
  }
  return {x:L.pts[0].x,z:L.pts[0].z,h:0};
 }
 const RIVAL_COLS=[['#6b4a2e','#2a1f17'],['#3c3a38','#141210'],['#c9a06a','#f0e3cc'],['#8a5a3a','#3a2a1e'],['#d8d2c6','#9a9188'],['#5a4030','#a08050']];
 function rivalMesh(i,name){
  let g=null;
  try{ const col=RIVAL_COLS[i%RIVAL_COLS.length];
   const parts=G.horse.makeHorse({colors:{body:col[0],mane:col[1]},seed:(i*3)%9});
   g=parts.group;
  }catch(e){ g=null; }
  if(!g){ try{ g=new THREE.Group(); W.box(1.0,1.1,2.2,'#6b4a2e',0,1.1,0,g); W.box(0.5,0.9,0.5,'#6b4a2e',0,1.9,1.0,g); }catch(e2){ return null; } }
  try{ const sp=G.nameSprite('🐴 '+name); sp.position.y=2.8; sp.scale.set(1.6,0.42,1); g.add(sp); }catch(e){}
  try{ G.scene.add(g); }catch(e){ return null; }
  return g;
 }
 function disposeGroup(g){
  if(!g)return;
  try{ G.scene.remove(g); g.traverse(o=>{ if(o.isMesh&&o.geometry)o.geometry.dispose(); if(o.isSprite&&o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();} }); }catch(e){}
 }
 function spawnField(c){
  const ev=c.ev, S=c.ce||{}, dk=(S.diff&&S.diff.k)||'open';
  const n=FIELD_N[dk]||3, wk=G.time.weekKey(), tighten=(FIELD_SPREAD[dk]||1)*(c.ladRematch?REMATCH_TIGHTEN:1);
  const loop=loopOf(c), laps=Math.max(1,S.laps||1), par=Math.max(4,c.par||G.course.eventPar(ev)||40);
  /* Deterministic per event, per week, per difficulty: the same four ranches turn up for the same
     race all week, which is what makes beating one of them mean anything. */
  const pool=T.NEIGHBOURS.slice().sort((a,b)=>hash('fld'+ev.id+wk+a[0])-hash('fld'+ev.id+wk+b[0])).slice(0,n);
  const rivals=pool.map(([nm,str],i)=>{
   const h=hash('pace'+ev.id+wk+dk+nm);
   const target=par*laps*(0.90+0.42*h)/clamp(str,0.78,1.28)*tighten;
   return {n:nm,str,target:+target.toFixed(1),pen:0,prog:0,slowT:0,done:false,i:0,g:rivalMesh(i,nm),y:hash('bob'+nm)*6};
  });
  FIELD={c,loop,laps,rivals,total:c.jumps.length*laps};
  /* The two aggressive pick-ups are downgraded to carrots when there is nobody to use them on.
     There is somebody now — but events-pvp's own mud and bale talk to the club over chat, so the
     solo race gets its own pair that act on the field that is actually here. */
  /* ranch3d bakes a pick-up's colour into its material from the type it was SPAWNED as, so a
     re-tag after the fact leaves a shield-blue crystal that hands out a mud slick. Repaint it. */
  try{
   const items=(c.items||[]).filter(it=>it.type!=='pad'&&!it.pad);
   items.forEach((it,k)=>{ const t=k%4===3?'ladSlick':k%7===5?'ladBale':null; if(!t)return;
    it.type=t; const col=T.RACE_ITEMS[t].col;
    try{it.m.material.color.setHex(col);it.m.material.emissive.setHex(col);}catch(e){} });
  }catch(e){}
  ladHud.classList.add('on');
 }
 function clearField(){
  if(!FIELD)return;
  for(const r of FIELD.rivals)disposeGroup(r.g);
  FIELD=null; ladHud.classList.remove('on'); ladHud.innerHTML='';
 }
 function playerProg(c){
  const S=c.ce||{}, laps=Math.max(1,S.laps||1), total=c.jumps.length*laps;
  const abs=((S.lap||1)-1)*c.jumps.length+(c.idx||0);
  return {abs,frac:total?clamp(abs/total,0,1):0,total};
 }
 function fieldRows(c){
  if(!FIELD)return [];
  const P=playerProg(c), t=Math.max(0.2,c.t||0.2);
  const mine=P.frac>0.02?t/P.frac:Math.max(t,c.par||40);        // where this pace puts you at the line
  const rows=FIELD.rivals.map(r=>({n:r.n,proj:r.target+r.pen,prog:r.prog,done:r.done,slow:r.slowT>0}));
  rows.push({n:'You',proj:mine,prog:P.frac,me:true});
  rows.sort((a,b)=>(b.prog-a.prog)||(a.proj-b.proj));
  return rows;
 }
 function slowField(kind){
  /* These two land on any race, because ranch3d draws the pick-up types straight off the keys of
     RACE_ITEMS. With no field to throw them at they do what events-pvp's downgrade does — become
     a carrot — rather than firing a club message at nobody. */
  if(!FIELD){
   const c0=G.course.get();
   if(c0&&(c0.pvp||c0.friendly)){const base=T.RACE_ITEMS[kind==='bale'?'bale':'mud'];if(base&&base.fx){base.fx();return;}}
   player.boostT=3; player.stam=Math.min(1,(player.stam||0)+0.3);
   toast('🥕 Nobody behind you to throw it at — you take the pace instead.');
   return;
  }
  const c=FIELD.c, P=playerProg(c); let hit=0;
  for(const r of FIELD.rivals){
   if(r.done||r.prog>P.frac)continue;                           // it goes backwards, at the riders behind you
   if(kind==='bale'){r.pen+=1.5;}else{r.slowT=2.0;r.pen+=0.6;}
   hit++;
  }
  if(hit){toast(kind==='bale'?('🌾 Bale down — '+hit+' rider'+(hit>1?'s':'')+' behind you have to go round it.')
   :('🪣 Mud slick — '+hit+' rider'+(hit>1?'s':'')+' behind you are wearing it.'));return;}
  /* Nobody behind you is very nearly always because you are LAST, not because you are first: the
     player's progress is counted in gates crossed and sits at zero until the first one, while the
     field moves continuously from the drop — which is exactly where the opening pick-ups lie. The
     old line congratulated a rider in P4/4 on being out in front. Say what is true and give the
     same carrot the no-field case gives, so the pick-up is never a dud. */
  player.boostT=3; player.stam=Math.min(1,(player.stam||0)+0.3);
  toast('🥕 Nobody behind you to throw it at — you take the pace instead.');
 }
 T.RACE_ITEMS.ladSlick={col:0x7a5a3a,label:'🪣 Mud slick!',fx:()=>slowField('mud')};
 T.RACE_ITEMS.ladBale={col:0xd9a441,label:'🌾 Hay bale!',fx:()=>slowField('bale')};

 /* ================================================================= course hooks ========== */
 G.on('courseStart',c=>{
  if(!c)return;
  try{
   /* tixSpent is what the crash-saver reads to decide whether a round the game never tidied up
      owes the player a ticket back, and events-pvp only ever sets it on a challenge. The rematch
      is the one other place a ticket leaves the book, so it has to say so — otherwise the single
      ticket a solo rider can lose to a reload is the only one the refund does not cover. */
   if(pendingRematch&&c.ev&&pendingRematch.ev===c.ev.id&&Date.now()-pendingRematch.at<8000){c.ladRematch=true;c.tixSpent=true;pendingRematch=null;}
   else pendingRematch=null;
   clearField();
   /* A gauntlet is a trial against a hard limit and a dressage test is judged alone; neither wants
      a field. A challenge or friendly race already has one, and it is made of real people. */
   if(!c.race||c.dressage||c.pvp||c.friendly||c.ev.friendly||c.ev.gauntlet)return;
   if(!c.jumps||c.jumps.length<3)return;
   spawnField(c);
   const n=FIELD?FIELD.rivals.length:0;
   if(n)toast('🏁 '+n+' riders line up beside you — '+FIELD.rivals.map(r=>r.n).join(', ')+(c.ladRematch?' · rematch, and they are riding for it':''));
  }catch(e){ console.error('ladder courseStart',e); }
 });
 G.on('courseTick',(c,dt,t)=>{
  if(!FIELD||FIELD.c!==c||!c.started)return;
  const P=playerProg(c);
  for(const r of FIELD.rivals){
   if(r.done)continue;
   if(r.slowT>0)r.slowT-=dt;
   const span=Math.max(1,r.target+r.pen);
   r.prog=clamp(r.prog+dt/span*(r.slowT>0?0.45:1),0,1);
   if(r.prog>=1)r.done=true;
   r.i=Math.floor(r.prog*FIELD.total);
   if(r.g){
    const p=atDist(FIELD.loop,r.prog*FIELD.loop.len*FIELD.laps);
    let y=0; try{y=W.groundH(p.x,p.z);}catch(e){}
    r.y+=dt*9;
    r.g.position.set(p.x,y+Math.abs(Math.sin(r.y))*0.13,p.z);
    r.g.rotation.y=p.h;
    r.g.visible=!r.done;
   }
   /* The rivals are riders, not ghosts: pvpField merges PVP.rivals, so anything else in the game
      that asks who else is on this track gets a straight answer. */
   try{const P2=E().PVP; if(P2&&P2.rivals)P2.rivals[r.n]={n:r.n,i:r.i,t:+(r.prog*(r.target+r.pen)).toFixed(1),done:r.done,ai:true};}catch(e){}
  }
  const rows=fieldRows(c), me=rows.findIndex(x=>x.me);
  FIELD.place=me+1; FIELD.n=FIELD.rivals.length;
  /* The list is in track order, so the gap has to be in track order too: how far up or down the
     route a rider is, priced in seconds at the course's own par pace. A projected finish time read
     against a position-ordered list gives a leader who appears to be losing. */
  const paceSpan=Math.max(4,(c.par||40)*FIELD.laps);
  ladHud.classList.add('on');
  ladHud.innerHTML='🏁 <b>P'+(me+1)+'/'+(FIELD.rivals.length+1)+'</b>'+(c.ladRematch?' · rematch':'')+'<br>'
   +rows.slice(0,5).map((r,i)=>{
     const gap=clamp((r.prog-P.frac)*paceSpan,-99,99);
     return '<span class="'+(r.me?'me':'')+'">'+(i+1)+' '+esc(r.n)+(r.slow?' 🪣':'')
      +'<i>'+(r.me?'—':(gap>=0?'+':'')+s1(gap)+'s')+'</i></span>';
    }).join('<br>')
   +((player.shieldT||0)>0?'<br>🛡️ '+s1(player.shieldT):'');
 });

 /* ================================================================= the unfinished round == */
 /* 'let course=null' is module-local in ranch3d and never reaches the save, so a reload in the
    middle of a twelve-gate race threw the round, the ribbon and — because the refund only runs on
    a frame that a reload never gets to — the ticket as well. SE's own reviews are full of this. */
 let runWrite=0;
 G.on('courseTick',(c,dt,t)=>{
  if(!c||!c.started||c.dressage||c.done)return;
  if(t-runWrite<2)return; runWrite=t;
  const S=c.ce||{};
  try{ G.save.sync(s=>{ s.runSaved={ev:c.ev.id,di:S.di==null?1:S.di,t:+(c.t||0).toFixed(1),idx:c.idx|0,
    lap:S.lap||1,laps:S.laps||1,faults:c.faults||0,grades:(S.grades||[]).slice(0,40),lineOff:+(S.lineOff||0).toFixed(2),
    refusals:S.refusals||0,insp:S.insp||0,tix:!!c.tixSpent,at:Date.now()}; }); }catch(e){}
 });
 const clearRun=()=>{try{G.save.sync(s=>{s.runSaved=null;});}catch(e){}};
 function resumeRun(){
  const s=G.save.fresh()||{}, r=s.runSaved;
  if(!r){toast('🏁 Nothing to pick up.');return;}
  const ev=evById(r.ev); if(!ev){clearRun();return;}
  clearRun(); G.hidePanels();
  G.course.startCourse(ev,r.di);
  const c=G.course.get();
  if(!c){toast('🏁 That round cannot be picked up from here — ride it again from 🏆 Events.');return;}
  c.t=r.t; c.idx=clamp(r.idx,0,Math.max(0,c.jumps.length-1)); c.faults=r.faults||0;
  if(c.ce)Object.assign(c.ce,{lap:clamp(r.lap,1,c.ce.laps||1),grades:(r.grades||[]).slice(),lineOff:r.lineOff||0,refusals:r.refusals||0,insp:r.insp||0});
  toast('⏪ Picked up where you left off — gate '+(c.idx+1)+' of '+c.jumps.length+' at '+s1(c.t)+'s.');
 }
 function dropRun(refund){
  const s=G.save.fresh()||{}, r=s.runSaved;
  if(r&&r.tix&&E().spendTicket){try{G.save.sync(x=>{x.tix=x.tix||{n:0};x.tix.n=Math.min(E().TIX_MAX||12,(x.tix.n||0)+1);});G.money.refreshWallet();toast('🎟️ That race never finished — your ticket is back.');}catch(e){}}
  clearRun(); G.ui.rerender('ladderPanel');
  try{G.ui.renderLB();}catch(e){}
  if(!refund)toast('🏁 Round let go.');
 }

 /* ================================================================= weekly boards ========= */
 const weekLeft=()=>{
  const d=new Date(), o=new Date(d.getFullYear(),0,1), w=Math.floor((d-o)/864e5/7), end=+o+(w+1)*7*864e5;
  const ms=Math.max(0,end-Date.now());
  return Math.floor(ms/864e5)+'d '+(Math.floor(ms/36e5)%24)+'h';
 };
 const featuredNow=()=>{try{return G.course.weeklyFeatured()||[];}catch(e){return [];}};
 /* The four featured events are drawn from show jumping and racing only, in ranch3d, and neither
    the six dressage tests nor the three showmanship classes can ever appear in them — a third of
    the competition table has no weekly loop at all. This is a FIFTH board rather than a fifth
    featured slot, because the four are what pays the 1.5x purse and that pick is inline. */
 function judgedOfWeek(){
  const pool=T.EVENTS3.filter(e=>e.dressage&&e.id!=='dance'&&!e.friendly);
  if(!pool.length)return null;
  const wk=G.time.weekKey();
  return pool.slice().sort((a,b)=>hash('jd'+wk+a.id)-hash('jd'+wk+b.id))[0];
 }
 /* The same synthetic valley the other boards use, so a judged board reads like a judged board:
    percentages, best first, instead of a column of seconds. */
 function judgedRows(ev,s){
  const wk=G.time.weekKey();
  const rows=T.NEIGHBOURS.map(([nm,str])=>({n:nm,v:+clamp(0.60+0.30*hash('jr'+ev.id+nm+wk)*Math.min(1.25,str),0,0.99).toFixed(3)}));
  const mine=lad(s).wk.score[ev.id];
  if(mine!=null)rows.push({n:'You',v:mine,me:true});
  rows.sort((a,b)=>b.v-a.v);
  return rows;
 }
 const placeIn=rows=>{const i=rows.findIndex(r=>r.me);return i<0?0:i+1;};
 function bandLabel(place,n){
  const P=E().prizeFor;
  if(!P||!place)return '';
  try{const p=P(place);return p?p.label:'';}catch(e){return '';}
 }
 /* One writer for the weekly board, here, using the gold we caught on the ribbon hook. */
 function writeWeekly(ev,c,gold,dressage,pct){
  const wk=G.time.weekKey(); let best=null, sc=null;
  G.save.sync(s=>{
   const L=s.lad; L.wk=L.wk||{week:wk,times:{},gold:{},score:{}}; L.wk.week=wk;
   s.weekly=s.weekly||{}; s.weekly.times=s.weekly.times||{}; s.weekly.gold=s.weekly.gold||{};
   if(dressage){
    const v=+((pct==null?0:pct).toFixed(3));
    if(L.wk.score[ev.id]==null||v>L.wk.score[ev.id]){L.wk.score[ev.id]=v;sc=v;}
   }else{
    const v=+(c.t||0).toFixed(1);
    L.wk.gold[ev.id]=true; s.weekly.gold[ev.id]=true;
    const prev=s.weekly.times[ev.id];
    if(prev==null||v<prev){s.weekly.times[ev.id]=v;L.wk.times[ev.id]=v;best=v;}
    else L.wk.times[ev.id]=prev;
   }
  });
  if(best!=null){try{G.net.publish('lb/wk_'+wk+'_'+ev.id+'/'+G.net.myName(),{v:best},{retain:true});}catch(e){}}
  return {best,sc};
 }

 /* ================================================================= the ribbon tally ====== */
 /* s.ribbons is a per-event high-water mark, so the fourth ribbon an event ever gives is the last
    one it will ever give and the week's 16-ribbon tiers are finished on day one. That stays — the
    cards draw it as a badge — and this is the running count the boards and the week now read. */
 function tallyRibbons(ev,rib){
  if(!rib||ev.friendly||ev.id==='dance'||ev.id==='fr')return 0;
  let total=0;
  G.save.sync(s=>{
   const L=s.lad; const wk=G.time.weekKey();
   if(L.rib.week!==wk){L.rib.week=wk;L.rib.wkTotal=0;}
   L.rib.total=(L.rib.total||0)+rib; L.rib.wkTotal=(L.rib.wkTotal||0)+rib;
   L.rib.byEv[ev.id]=(L.rib.byEv[ev.id]||0)+rib;
   total=L.rib.total;
  });
  return total;
 }
 function ribTierReady(s){
  const L=lad(s), t=L.rib.total||0, out=[];
  RIB_TIERS.forEach(([need,r],i)=>{ if(t>=need&&!(L.tiers||{})[i])out.push(i); });
  return out;
 }
 function claimRibTier(i){
  const row=RIB_TIERS[i]; if(!row)return;
  let ok=false;
  G.save.sync(s=>{
   const L=s.lad; L.tiers=L.tiers||{};
   if(L.tiers[i]||(L.rib.total||0)<row[0])return;
   L.tiers[i]=Date.now(); G.money.payReward(s,row[1]); ok=true;
  });
  if(ok){G.money.refreshWallet();try{G.horse.refreshTack();}catch(e){}G.sGem();
   toast('🎀 '+row[0]+' ribbons — '+G.money.rewardLabel(row[1]));
   try{G.ui.renderLB();}catch(e){}}
  else toast('🎀 Not yet.');
 }
 /* A friendly race and the Dance of Harmony are not in the events table at all, so their ribbons
    can never be seen on a card — but they were still counted into s.ribbonTotal, the week's Star
    Points and the 'five gold ribbons' achievement. No stakes means no stakes. */
 function stripResidue(ev){
  setTimeout(()=>{ try{ G.save.sync(s=>{
   const r=(s.ribbons||{})[ev.id]||0;
   if(s.ribbons)delete s.ribbons[ev.id];
   if(s.ribbonGold)delete s.ribbonGold[ev.id];
   if(s.bestAcc)delete s.bestAcc[ev.id];
   if(s.ribbonsBy)for(const k of Object.keys(s.ribbonsBy))if(k.indexOf(ev.id+':')===0)delete s.ribbonsBy[k];
   if(r)s.ribbonTotal=Math.max(0,(s.ribbonTotal||0)-r);
   /* awardRibbons also runs the ribbons through addSP, which is the week's Star Point tally and
      the wage it pays — take those back too, or a friendly race with no stakes is still the
      cheapest Star Points in the game. s.ribbons[ev.id] is deleted on every one of these, so the
      high-water mark is always exactly what this round handed out and r is never an over-count. */
   if(r){ if(s.sp)s.sp.pts=Math.max(0,(s.sp.pts||0)-r); if(s.wk)s.wk.sp=Math.max(0,(s.wk.sp||0)-r); }
   if(s.weekly&&s.weekly.rib)delete s.weekly.rib[ev.id];
   s.lad=s.lad||{}; s.lad.danced=(s.lad.danced||0)+(ev.id==='dance'?1:0);
  }); }catch(e){} },30);
 }

 /* ================================================================= the championship ====== */
 /* The game tells you for ten levels that you are working toward the Basin Championship and then
    hands you a slightly richer jumping round with nothing at the end of it. The Final gets a
    standings table, a season, and a title that is written down and can be defended. */
 function seasonKey(){ try{const sn=G.time.seasonNow();return (sn&&sn.def&&sn.def.id||'season')+'-'+new Date().getFullYear();}catch(e){return 'season';} }
 function finalStandings(myScore){
  const k=seasonKey();
  const rows=T.NEIGHBOURS.map(([nm,str])=>({n:nm,v:+clamp(0.58+0.36*hash('champ'+k+nm)*Math.min(1.25,str),0,0.99).toFixed(3)}));
  rows.push({n:'You',v:+clamp(myScore,0,1).toFixed(3),me:true});
  rows.sort((a,b)=>b.v-a.v);
  return rows;
 }
 function champPath(s){
  const C=E().champQualified;
  if(!C)return null;
  try{const q=C(s); return q;}catch(e){return null;}
 }
 /* Naming the event is the useful half of this line, but the Events panel prints it above a list
    of rows that renderers find by matching their own names against row text — so in that one place
    the hint stops at the town. Everywhere else it says exactly which round to go and ride. */
 function nextVenueHint(s,venueOnly){
  const q=champPath(s); if(!q||q.ok)return '';
  const town=Object.keys(q.venues).find(t=>!q.venues[t]); if(!town)return '';
  if(venueOnly)return '🎫 '+town+' is the next venue to sign off — two ribbons at any of its events does it.';
  const rows=T.EVENTS3.filter(e=>e.town===town&&!e.champ);
  const ok=rows.filter(e=>{try{return G.course.eventOk(e,ridden()).ok;}catch(err){return true;}});
  const pick=(ok.length?ok:rows).sort((a,b)=>(a.lvl||1)-(b.lvl||1))[0];
  return pick?('🎫 '+town+' is the next venue to sign off — ride '+pick.name):'';
 }

 /* ================================================================= the finish ============ */
 let LAST=null, cardT=null;
 G.on('courseFinish',payload=>{
  const {c,ev,stars,RB,pay,dressage,pct}=payload||{};
  if(!c||!ev)return;
  try{
   const gold=goldOf(ev,RB);
   const S=(c&&c.ce)||{}, d=diffOf(S.diff&&S.diff.k||(c.rb&&c.rb.diff)||'open');
   const feat=!!(RB&&RB.featured);
   const before=preFinish&&Date.now()-preFinish.at<8000?preFinish:(()=>{const s=G.save.fresh()||{};return {coins:s.coins||0,gems:s.gems||0,pts:(s.racing&&s.racing.pts)||0};})();
   /* the field, settled on projected finish time: who actually crossed before you */
   let place=0, field=0, rows=[];
   if(FIELD&&FIELD.c===c){
    field=FIELD.rivals.length;
    rows=FIELD.rivals.map(r=>({n:r.n,proj:+(r.target+r.pen).toFixed(1)}));
    rows.push({n:'You',proj:+(c.t||0).toFixed(1),me:true});
    rows.sort((a,b)=>a.proj-b.proj);
    place=placeIn(rows);
   }else if((c.pvp||c.friendly)&&E().PVP){ place=E().PVP.place||0; field=E().PVP.field||0; }
   /* the weekly board — the thing that has been silently doing nothing */
   let wkNote='', wkPlace=0, wkRows=[];
   const judged=judgedOfWeek();
   if(feat&&gold&&!dressage){
    const w=writeWeekly(ev,c,gold,false,null), s2=G.save.fresh()||{};
    try{wkRows=E().weeklyRows?E().weeklyRows(ev,s2):[];wkPlace=E().myPlace?E().myPlace(wkRows):0;}catch(e){}
    wkNote='🥇 Gold — '+s1(c.t)+'s'+(wkPlace?(' · ranked #'+wkPlace+' of '+wkRows.length+' on this week\'s '+ev.name+' board'):' is on this week\'s board');
    toast(wkNote+(w.best==null?' (your best still stands)':''));
   }else if(feat&&!gold&&!dressage){ wkNote='Featured — a 🥇 gold ribbon (95% accuracy, nothing down) is what ranks you.'; }
   if(judged&&judged.id===ev.id&&dressage&&gold){
    writeWeekly(ev,c,gold,true,pct);
    const s2=G.save.fresh()||{}; wkRows=judgedRows(ev,s2); wkPlace=placeIn(wkRows);
    wkNote='🥇 '+pc(pct)+'% — ranked #'+wkPlace+' of '+wkRows.length+' on this week\'s judged board';
    toast(wkNote);
   }else if(judged&&judged.id===ev.id&&dressage&&!gold){ wkNote='This week\'s judged class — 95% takes the gold and the board.'; }
   /* racing points for the field we just built: events-pvp pays the rival term from a field of
      live humans, which for a solo race is always zero */
   let aiPts=0, rankBefore=0, rankAfter=0;
   if(field&&!c.pvp&&!c.friendly){
    aiPts=Math.round(15*Math.max(0,field-(place-1))*(c.ladRematch?REMATCH_PTS:1));
    G.save.sync(s=>{
     s.racing=s.racing||{pts:0,races:0,wins:0,pvp:0,claimed:{}};
     rankBefore=E().rankIdx?E().rankIdx(s.racing.pts||0):0;
     s.racing.pts=(s.racing.pts||0)+aiPts;
     rankAfter=E().rankIdx?E().rankIdx(s.racing.pts||0):0;
     const L=s.lad; L.races=(L.races||0)+1;
     if(place===1)L.wins=(L.wins||0)+1;
     if(place<=3)L.podiums=(L.podiums||0)+1;
    });
    if(aiPts)toast('🏇 +'+aiPts+' racing points for finishing P'+place+' of '+(field+1)+(c.ladRematch?' — rematch, doubled':''));
    if(place<=3)G.quest.dailyEvt('ladpodium',1);
   }
   /* the championship */
   let champ=null;
   if(ev.champ){
    const my=dressage?(pct||0):(c.rb&&c.rb.acc)||0;
    const st=finalStandings(my), cp=placeIn(st), key=seasonKey();
    champ={rows:st,place:cp,season:key,score:my};
    G.save.sync(s=>{
     const L=s.lad; L.champion={season:key,place:cp,t:+(c.t||0).toFixed(1),score:+my.toFixed(3),at:Date.now()};
     if(cp===1&&L.titles.indexOf(key)<0)L.titles.push(key);
    });
    if(cp===1)toast('🏆 Basin Champion — you take the Final for '+key+'.');
    else toast('🏆 The Final — you finish '+cp+' of '+st.length+' this season.');
   }
   const ribTotal=tallyRibbons(ev,(RB&&RB.rib)||0);
   if(ev.friendly||ev.id==='dance'||ev.id==='fr')stripResidue(ev);
   LAST={ev:{id:ev.id,name:ev.name,town:ev.town,race:!!ev.race,xc:!!ev.xc,dressage:!!ev.dressage,show:ev.kind==='show',
     champ:!!ev.champ,friendly:!!ev.friendly,gauntlet:!!ev.gauntlet,reward:ev.reward||0},
    t:+(c.t||0).toFixed(1),par:+((c.par||0)).toFixed(1),allowed:+((S.timeAllowed||0)).toFixed(1),
    faults:c.faults||0,acc:dressage?(pct||0):((c.rb&&c.rb.acc)||0),grades:(S.grades||[]).slice(),
    timeFaults:S.timeFaults||0,lineOff:+(S.lineOff||0).toFixed(1),refusals:S.refusals||0,insp:S.insp||0,off:S.off||0,
    diff:d.k,diffLabel:d.label,diffIcon:d.icon,stars:stars||1,rib:(RB&&RB.rib)||0,gold:gold,featured:feat,
    pay:pay||0,dressage:!!dressage,pct:pct==null?null:+pct.toFixed(3),
    figs:(c.figs||[]).map(f=>({text:f.text,score:f.score,at:f.at})),
    turnout:c.turnout==null?null:+c.turnout.toFixed(3),
    turnoutParts:(c.turnoutParts||[]).map(x=>({icon:x.p.icon,label:x.p.label,v:+x.v.toFixed(2)})),
    place,field,rows,rematch:!!c.ladRematch,aiPts,rankBefore,rankAfter,
    wkNote,wkPlace,wkRows:wkRows.slice(0,8).map(r=>({n:r.n,v:r.v,me:!!r.me})),
    traitMatch:(c.traitMatch||[]).slice(),traitMul:+(c.traitMul||1).toFixed(3),
    champ,ribTotal,coins0:before.coins||0,gems0:before.gems||0,pts0:before.pts||0,
    notes:[],at:Date.now()};
   clearRun();
   G.save.sync(s=>{ s.lastRun={ev:LAST.ev.id,name:LAST.ev.name,t:LAST.t,rib:LAST.rib,gold:LAST.gold,
    place:LAST.place,field:LAST.field,acc:+LAST.acc.toFixed(3),pay:LAST.pay,at:LAST.at}; });
   if(cardT)clearTimeout(cardT);
   cardT=setTimeout(()=>{ cardT=null; openCard(); },350);
  }catch(e){ console.error('ladder courseFinish',e); }
 });
 function openCard(){
  if(!LAST)return;
  try{
   const now=G.save.fresh()||{};
   LAST.coins1=now.coins||0; LAST.gems1=now.gems||0; LAST.pts1=(now.racing&&now.racing.pts)||0;
   LAST.notes=(capture||[]).slice(); capture=null; wasGold=false;
   CARD={mode:'result'};
   G.ui.open('resultPanel');
   const ros=$('resultPanel')&&$('resultPanel').querySelector('.ladRos');
   if(ros)setTimeout(()=>ros.classList.add('in'),30);
   if(LAST.gold||LAST.place===1){try{G.sGem();G.sChime();}catch(e){}}
  }catch(e){ console.error('ladder card',e); capture=null; wasGold=false; }
 }

 /* ================================================================= the result card ======= */
 let CARD={mode:'result',ev:null};
 const GR=()=>G.course.GRADE||{};
 function gradeLine(L){
  if(!L.grades||!L.grades.length)return '';
  const cnt={}; for(const g of L.grades)cnt[g]=(cnt[g]||0)+1;
  const GRD=GR();
  return Object.keys(cnt).map(k=>'<span class="ladChip'+(k==='perfect'?' on':(k==='fault'||k==='refusal')?' bad':'')+'">'
   +((GRD[k]&&GRD[k].icon)||'•')+' '+((GRD[k]&&GRD[k].text)||k)+' ×'+cnt[k]+'</span>').join('');
 }
 function scoreSheet(L){
  if(L.ev.show){
   return '<div class="ladSheet"><b>🧼 Turnout '+pc(L.turnout)+'%</b>'
    +L.turnoutParts.map(p=>'<div><span>'+p.icon+' '+esc(p.label)+'</span><span>'+pc(p.v)+'%</span></div>').join('')
    +'<div><span>🎽 The pattern</span><span>'+pc(Math.max(0,(L.pct*2)-(L.turnout||0)))+'%</span></div>'
    +'<div><b>Final mark</b><b>'+pc(L.pct)+'%</b></div></div>';
  }
  if(L.dressage){
   return '<div class="ladSheet"><b>🎽 The test, figure by figure</b>'
    +L.figs.map(f=>'<div><span>'+esc(f.at||'')+' · '+esc(f.text||'')+'</span><span>'+(f.score==null?'—':f.score+'/10')+'</span></div>').join('')
    +'<div><b>Final mark</b><b>'+pc(L.pct)+'%</b></div></div>';
  }
  let h='<div class="ladGrid"><span class="ladChip">🎯 Accuracy '+pc(L.acc)+'%</span>'+gradeLine(L);
  if(L.refusals)h+='<span class="ladChip bad">🛑 Refusals ×'+L.refusals+'</span>';
  if(L.timeFaults)h+='<span class="ladChip bad">⏱ Over time +'+L.timeFaults+' faults</span>';
  if(L.lineOff>=1)h+='<span class="ladChip bad">📏 Off the line '+L.lineOff+'s</span>';
  if(L.insp)h+='<span class="ladChip on">✨ Inspiring ×'+L.insp+'</span>';
  if(L.off)h+='<span class="ladChip">↪️ Off the approach ×'+L.off+'</span>';
  h+='</div><div class="ladBar" style="margin-top:6px"><i style="width:'+clamp(pc(L.acc),2,100)+'%"></i></div>';
  return h;
 }
 function fieldBlock(L){
  if(!L.field)return '';
  return '<div class="ph"><b>🏁 The field — you finished P'+L.place+' of '+(L.field+1)+'</b>'
   +(L.rematch?'<span class="ladChip me">🎟️ rematch</span>':'')+'</div>'
   +'<div class="ladSheet">'+L.rows.map((r,i)=>'<div'+(r.me?' style="font-weight:800;color:#3d2f22"':'')+'><span>'
    +(i===0?'👑':i===1?'🥈':i===2?'🥉':'#'+(i+1))+' '+esc(r.n)+'</span><span>'+s1(r.proj)+'s</span></div>').join('')+'</div>';
 }
 function rankBlock(L,s){
  const RR=E().RACE_RANKS, ri=E().rankIdx;
  if(!RR||!ri)return '';
  const pts=(s.racing&&s.racing.pts)||0, i=ri(pts), nx=RR[i+1]||null;
  const gained=Math.max(0,(L.pts1||0)-(L.pts0||0));
  const rose=ri(L.pts1||0)>ri(L.pts0||0);          // every package's points are in the snapshot, not just ours
  const span=nx?Math.max(1,nx.at-RR[i].at):1, into=nx?clamp((pts-RR[i].at)/span,0,1):1;
  let h='<div class="ph"><b>'+RR[i].icon+' '+esc(RR[i].label)+'</b><span style="font-size:11px;color:#8c7a63">'+pts+' racing points'+(gained?' (+'+gained+' just now)':'')+'</span></div>'
   +'<div class="ladBar"><i style="width:'+Math.round(into*100)+'%"></i></div>'
   +'<div class="sub">'+(nx?('Next: <b>'+esc(nx.label)+'</b> at '+nx.at+' — '+Math.max(0,nx.at-pts)+' to go, and it pays '+esc(G.money.rewardLabel(nx.r)||'—')+'.')
     :'You are at the top of the ladder.')+'</div>';
  const claimed=(s.racing&&s.racing.claimed)||{};
  for(let k=0;k<RR.length;k++){
   if(pts<RR[k].at||claimed[k]||!Object.keys(RR[k].r||{}).length)continue;
   h+='<button class="claimBtn" data-fx="lad:rank:'+k+'">'+RR[k].icon+' Claim '+esc(RR[k].label)+' — '+esc(G.money.rewardLabel(RR[k].r))+'</button>';
  }
  /* A rank-up used to be one transient toast in a stack of seven. It is the payoff for the whole
     grind, so it gets the top of the card and the claim button in the same breath. */
  if(rose)h='<div class="evrow" style="background:linear-gradient(180deg,#fff4e0,#ffe9c4);flex-wrap:wrap">'
   +'<span class="ladRos in" style="font-size:26px">'+RR[i].icon+'</span>'
   +'<b style="flex:1;min-width:120px">Racing rank up — '+esc(RR[i].label)+'</b></div>'+h;
  return h;
 }
 function previewCard(ev,s,h){
  const di=s.evDiff==null?1:s.evDiff, d=DIFFS()[di]||DIFFS()[1]||DIFFS()[0];
  let gate={ok:true,missing:[]}; try{gate=G.course.eventOk(ev,h)||gate;}catch(e){}
  const feat=featuredNow().some(f=>f.id===ev.id);
  const purse=Math.round((ev.reward||0)*(d.rewMul||1)*(feat?1.5:1));
  const base=Math.max(8,Math.round((ev.reward||0)/7));
  const sx=ev.dressage?{agility:base,accel:Math.round(base*0.6)}:ev.xc?{stamina:base,jump:Math.round(base*0.8)}
   :ev.race?{speed:base,stamina:Math.round(base*0.7)}:{jump:base,agility:Math.round(base*0.8)};
  const allowed=(()=>{try{return G.course.eventTimeAllowed(ev,di);}catch(e){return ev.par||0;}})();
  const tm=E().traitMatches?E().traitMatches(ev,h)||[]:[];
  const mul=E().raceTraitMul?E().raceTraitMul(ev,h):1;
  const L=lad(s), rib=(L.rib.byEv||{})[ev.id]||0;
  const i=T.EVENTS3.indexOf(ev);
  let html='<div class="ph"><b>'+(ev.dressage?'🎽':ev.xc?'🌲':ev.race?'🏁':'⤴️')+' '+esc(ev.name)+'</b>'
   +'<button data-fx="close:resultPanel" style="margin-left:auto">✖</button></div>'
   +'<div class="sub">📍 '+esc(ev.town)+' · needs Lv '+(ev.lvl||1)+(feat?' · <b>featured this week</b>':'')+'</div>';
  html+='<div class="ladGrid"><span class="ladChip">'+(ev.dressage?'🎯 Score to beat ':'⏱ Time allowed ')+(ev.dressage?'—':s1(allowed)+'s')+'</span>'
   +'<span class="ladChip">'+d.icon+' '+esc(d.label)+'</span>'
   +(ev.laps>1?'<span class="ladChip">🔁 '+ev.laps+' laps</span>':'')
   +(ev.line?'<span class="ladChip">📏 line riding</span>':'')
   +(ev.race&&!ev.gauntlet&&!ev.friendly?'<span class="ladChip">🏁 field of '+((FIELD_N[d.k]||3)+1)+'</span>':'')
   +'</div>';
  if(ev.traits&&ev.traits.length){
   html+='<div class="ph"><b>🏇 What this race favours</b></div><div class="ladGrid">'
    +ev.traits.map(k=>'<span class="ladChip'+(tm.indexOf(k)>=0?' on':'')+'">'+esc(T.STAT_LBL[k]||k)+' '+(tm.indexOf(k)>=0?'✓':'▫️')+'</span>').join('')
    +'<span class="ladChip'+(mul>1?' me':'')+'">+'+Math.round((mul-1)*100)+'% pace on '+esc((h&&h.name)||'this horse')+'</span></div>';
  }
  html+='<div class="ph"><b>🎁 What it pays</b></div><div class="ladGrid">'
   +'<span class="ladChip">'+purse+'🪙'+(feat?' ×1.5':'')+'</span><span class="ladChip">'+Math.round((ev.reward||0)/8)+' XP</span>'
   +Object.keys(sx).map(k=>'<span class="ladChip">'+sx[k]+' '+esc((T.STAT_LBL[k]||k).replace(/^\S+\s/,''))+' XP</span>').join('')
   +'<span class="ladChip">50 pass pts</span><span class="ladChip">1–5💎</span>'
   +(ev.race?'<span class="ladChip">🏇 racing points</span>':'')+'</div>';
  html+='<div class="ph"><b>🎀 Your record here</b></div><div class="ladGrid">'
   +'<span class="ladChip">'+rib+' ribbon'+(rib===1?'':'s')+' won here</span>'
   +(s.bestAcc&&s.bestAcc[ev.id]?'<span class="ladChip">best 🎯 '+pc(s.bestAcc[ev.id])+'%</span>':'')
   +(s.bestTimes&&s.bestTimes[ev.id]?'<span class="ladChip">best ⏱ '+s1(s.bestTimes[ev.id])+'s</span>':'')
   +(s.trophies&&s.trophies[ev.id]?'<span class="ladChip on">🏆 won</span>':'')+'</div>';
  if(!gate.ok)html+='<div class="sub">🔒 '+esc(gate.missing.map(m=>(m[0]==='level'?'Lv '+m[1]:(T.STAT_LBL[m[0]]||m[0])+' '+m[1])+' (have '+m[2]+')').join(' · '))+'</div>';
  else if(i>=0)html+='<button class="claimBtn" data-fx="lad:again:'+esc(ev.id)+'">Enter · '+purse+'🪙</button>';
  return html;
 }
 G.ui.panel({id:'resultPanel',title:'🏅 Round result',sys:true,render(p,s){
  s=s||G.save.fresh()||{};
  if(CARD.mode==='preview'){ const ev=evById(CARD.ev); if(ev)return previewCard(ev,s,ridden()); }
  const L=LAST;
  if(!L){
   const r=s.lastRun;
   return '<div class="ph"><b>🏅 Round result</b><button data-fx="close:resultPanel" style="margin-left:auto">✖</button></div>'
    +'<div class="sub">'+(r?('Your last round: '+esc(r.name)+' — '+s1(r.t)+'s, '+r.rib+' ribbon'+(r.rib===1?'':'s')+(r.gold?' including the 🥇':'')+'.'):'Nothing ridden yet.')+'</div>';
  }
  const ros=L.gold?'🥇':'🎀'.repeat(Math.max(1,Math.min(3,L.rib)));
  const dcoin=Math.max(0,(L.coins1||0)-(L.coins0||0)), dgem=Math.max(0,(L.gems1||0)-(L.gems0||0));
  let h='<div class="ph"><b>'+(L.place===1&&L.field?'🏆 ':'')+esc(L.ev.name)+'</b><button data-fx="close:resultPanel" style="margin-left:auto">✖</button></div>'
   +'<div class="evrow" style="flex-wrap:wrap;gap:10px"><span class="ladRos">'+ros+'</span>'
   +'<span style="flex:1;min-width:120px"><b style="font-size:15px">'+(L.dressage?pc(L.pct)+'%':s1(L.t)+'s')+'</b>'
   +'<span style="font-size:11px;color:#8c7a63"><br>'+esc(L.ev.town)+' · '+L.diffIcon+' '+esc(L.diffLabel)
   +(L.dressage?'':' · allowance '+s1(L.allowed)+'s')+(L.featured?' · featured':'')+'</span></span>'
   +'<span class="ladChip'+(L.gold?' on':'')+'">'+(L.gold?'🥇 Gold ribbon':L.rib+' ribbon'+(L.rib===1?'':'s'))+'</span>'
   +'<span class="ladChip">'+'⭐'.repeat(clamp(L.stars,1,3))+'</span></div>';
  h+=fieldBlock(L);
  h+='<div class="ph"><b>📋 The score</b></div>'+scoreSheet(L);
  h+='<div class="ph"><b>💰 What the round paid</b></div><div class="ladGrid">'
   +'<span class="ladChip">Purse '+L.pay+'🪙</span>'
   +(dcoin?'<span class="ladChip on">+'+dcoin+'🪙 in the hand</span>':'')
   +(dgem?'<span class="ladChip on">+'+dgem+'💎</span>':'')
   +(L.aiPts?'<span class="ladChip">+'+L.aiPts+' racing points for the placing</span>':'')
   +'<span class="ladChip">🎀 '+L.ribTotal+' ribbons won all told</span></div>';
  if(L.ev.race||L.ev.gauntlet)h+=rankBlock(L,s);
  if(L.wkNote){
   h+='<div class="ph"><b>📅 This week\'s board</b><span style="font-size:11px;color:#8c7a63">'+weekLeft()+' left</span></div>'
    +'<div class="sub">'+esc(L.wkNote)+'</div>';
   if(L.wkRows.length)h+='<div class="ladSheet">'+L.wkRows.map((r,i)=>'<div'+(r.me?' style="font-weight:800;color:#3d2f22"':'')+'><span>#'+(i+1)+' '+esc(r.n)+'</span><span>'+(L.dressage?pc(r.v)+'%':s1(r.v)+'s')+'</span></div>').join('')+'</div>';
   if(L.wkPlace){const b=bandLabel(L.wkPlace);if(b)h+='<div class="sub">🏅 That is the <b>'+esc(b)+'</b> rung of the prize ladder as things stand. It settles when the week turns.</div>';}
  }
  if(L.champ){
   h+='<div class="ph"><b>🏆 The Basin Championship · '+esc(L.champ.season)+'</b></div>'
    +'<div class="ladSheet">'+L.champ.rows.slice(0,6).map((r,i)=>'<div'+(r.me?' style="font-weight:800;color:#3d2f22"':'')+'><span>'+(i===0?'👑':'#'+(i+1))+' '+esc(r.n)+'</span><span>'+pc(r.v)+'%</span></div>').join('')+'</div>'
    +'<div class="sub">'+(L.champ.place===1?'<b>You are the Basin Champion.</b> The title is on your profile until somebody takes the Final off you next season.':'Ride it again this season and the standings will take your best.')+'</div>';
  }
  if(L.notes.length)h+='<div class="ph"><b>📝 Also this round</b></div><div class="sub">'+L.notes.map(n=>esc(n)).join('<br>')+'</div>';
  /* what to ride next: a round that ends with nothing to do next is where a ladder stops being one */
  {const feat=featuredNow().filter(e=>e.id!==L.ev.id&&(()=>{try{return G.course.eventOk(e,ridden()).ok;}catch(err){return true;}})());
   const gold=(s.weekly&&s.weekly.gold)||{}, want=feat.find(e=>!gold[e.id])||feat[0];
   h+='<div class="ph"><b>➡️ Next on the ladder</b></div><div class="sub">'
    +(want?('<b>'+esc(want.name)+'</b> is featured this week'+(gold[want.id]?' and you are already on its board':' and still wants a gold ribbon from you')+' — '+weekLeft()+' left. ')
      :'Nothing featured is inside this horse\'s reach today. ')
    +esc(nextVenueHint(s))+'</div>';
   if(want)h+='<div class="ladGrid"><button data-fx="lad:again:'+esc(want.id)+'">Ride '+esc(want.name)+'</button>'
    +'<button data-fx="lad:why:'+esc(want.id)+'">What it pays</button></div>';}
  h+='<div class="ladGrid" style="margin-top:6px">'
   +'<button class="claimBtn" data-fx="lad:again:'+esc(L.ev.id)+'">Ride it again</button>';
  if(L.ev.race&&!L.ev.gauntlet&&!L.ev.friendly&&(E().tix?E().tix(s):0)>0)
   h+='<button data-fx="lad:rematch:'+esc(L.ev.id)+'" title="A ticket buys a faster field and double racing points — the ordinary race is always free">🎟️ Rematch · faster field, double points</button>';
  h+='<button data-fx="lad:boards">🏅 The ladder</button><button data-fx="close:resultPanel">Close</button></div>';
  return h;
 }});

 /* ================================================================= the ladder tab ======== */
 /* Priority one: everything below already existed in the save and not one line of it was ever
    drawn anywhere a player could find it. */
 G.ui.lbTab({id:'ladder',label:'🏆 Ladder',pos:1,render(s){
  s=s||{}; const L=lad(s), h=ridden();
  const RR=E().RACE_RANKS||[], ri=E().rankIdx||(()=>0);
  const pts=(s.racing&&s.racing.pts)||0, i=ri(pts), nx=RR[i+1]||null;
  const span=RR.length?Math.max(1,(nx?nx.at:RR[i].at+1)-RR[i].at):1;
  let html='<div class="passCard"><div class="ph"><b>'+((RR[i]&&RR[i].icon)||'🏇')+' '+esc((RR[i]&&RR[i].label)||'Unranked')+'</b>'
   +'<span style="font-size:11px;color:#8c7a63">'+pts+' racing points · '+(L.races||0)+' race'+((L.races||0)===1?'':'s')+' with a field · '+(L.wins||0)+' won</span></div>'
   +'<div class="cbar"><div class="cfill" style="width:'+Math.round(clamp(nx?(pts-RR[i].at)/span:1,0,1)*100)+'%"></div></div>'
   +'<div class="sub">'+(nx?('<b>'+esc(nx.label)+'</b> at '+nx.at+' points — '+Math.max(0,nx.at-pts)+' to go. It pays '+esc(G.money.rewardLabel(nx.r)||'—')+'.')
    :'Top of the ladder. Every race still pays points and ribbons.')
   +' Points come from every race you finish: ten to start, five a star, and fifteen for every rider you beat — and there is a field in every race now, so that last term is no longer always zero.</div>';
  const claimed=(s.racing&&s.racing.claimed)||{};
  html+='<div class="crow" style="flex-wrap:wrap;gap:4px">'+RR.map((t,k)=>{
   const has=pts>=t.at, any=Object.keys(t.r||{}).length;
   return '<span class="bE'+(has?' me':'')+'">'+t.icon+' '+esc(t.label)+' · '+t.at+'</span>';
  }).join('')+'</div>';
  for(let k=0;k<RR.length;k++){
   if(pts<RR[k].at||claimed[k]||!Object.keys(RR[k].r||{}).length)continue;
   html+='<button class="claimBtn" data-fx="lad:rank:'+k+'">'+RR[k].icon+' Claim '+esc(RR[k].label)+' — '+esc(G.money.rewardLabel(RR[k].r))+'</button>';
  }
  html+='</div>';
  /* tickets — one book, one name, one glyph */
  const tx=E().tix?E().tix(s):0, mx=E().TIX_MAX||12, dl=E().TIX_DAILY||3;
  html+='<div class="passCard"><div class="ph"><b>🎟️ Race tickets · '+tx+' of '+mx+'</b><span style="font-size:11px;color:#8c7a63">'+dl+' more tomorrow</span></div>'
   +'<div class="sub">Tickets are for racing other people — hosting or joining a challenge takes one. <b>Nothing in the ladder is behind them.</b> Riding any event on your own, against the valley\'s own riders, for ribbons, points, purse and a place on the weekly board, is free and always will be. The one extra thing a ticket buys here is a rematch: the same race with a faster field and double points, offered on the result card.</div></div>';
  /* the four featured events, with the reason you cannot ride one */
  const feat=featuredNow();
  html+='<div class="passCard"><div class="ph"><b>📅 This week\'s featured events</b><span style="font-size:11px;color:#8c7a63">'+weekLeft()+' left</span></div>'
   +'<div class="sub">Half as much again in coins, and a 🥇 gold ribbon — 95% accuracy with nothing down — puts your time on the board. Where you stand when the week turns is what the prize ladder pays.</div>';
  for(const ev of feat){
   let gate={ok:true,missing:[]}; try{gate=G.course.eventOk(ev,h)||gate;}catch(e){}
   let rows=[],place=0; try{rows=E().weeklyRows?E().weeklyRows(ev,s):[];place=E().myPlace?E().myPlace(rows):0;}catch(e){}
   const mine=(s.weekly&&s.weekly.times&&s.weekly.times[ev.id]);
   html+='<div class="bRow"><div class="bHead"><span>'+esc(ev.name)+'</span><span class="rk">'+(place?('#'+place+' of '+rows.length):(gate.ok?'unranked':'locked'))+'</span></div>'
    +'<div class="bList">'+rows.slice(0,3).map((r,k)=>'<span class="bE'+(r.me?' me':'')+(r.club?' club':'')+'">'+(k===0?'👑':k===1?'🥈':'🥉')+' '+esc(r.n)+' '+s1(r.v)+'s</span>').join('')
    +(place>3?'<span class="bE me">#'+place+' You '+s1(mine||0)+'s</span>':'')
    +'</div><div class="sub">'
    +(!gate.ok?('🔒 '+esc(gate.missing.map(m=>(m[0]==='level'?'Lv '+m[1]:(T.STAT_LBL[m[0]]||m[0])+' '+m[1])+' (have '+m[2]+')').join(' · '))+' — this one is not yours to ride yet.')
     :place?('🏅 '+esc(bandLabel(place))+' on the prize ladder as things stand.')
     :mine?'Ridden, but not gold yet — the board only takes gold.':'Not ridden yet this week.')
    +'</div>'
    +(gate.ok?'<button data-fx="lad:again:'+esc(ev.id)+'">Ride it</button> <button data-fx="lad:why:'+esc(ev.id)+'">What it pays</button>':'')
    +'</div>';
  }
  const rideable=feat.filter(ev=>{try{return G.course.eventOk(ev,h).ok;}catch(e){return true;}}).length;
  if(rideable<feat.length)html+='<div class="sub">'+rideable+' of '+feat.length+' are inside this horse\'s reach today. The rotation is drawn from the whole table, not from what you have unlocked, so an early week can show you a board you cannot enter — ride the ones you can and the tiers still fill.</div>';
  /* Two other tabs in this panel also say 'week', which is one too many names for one thing. Say
     plainly which is which rather than leaving the player to guess. */
  html+='<div class="sub">These are the same four events the <b>📅 Weekly</b> and <b>📅 Week!</b> tabs list. Weekly ranks on your best time whether or not it was gold and pays a placing band; Week! is the gold-only board above, with the prize ladder. This tab is the short version of both.</div>';
  html+='</div>';
  /* the judged class of the week — the half of the competition table the four never reach */
  const jd=judgedOfWeek();
  if(jd){
   const rows=judgedRows(jd,s), place=placeIn(rows), mine=L.wk.score[jd.id];
   html+='<div class="passCard"><div class="ph"><b>🎽 Judged class of the week · '+esc(jd.name)+'</b><span style="font-size:11px;color:#8c7a63">ranked by score</span></div>'
    +'<div class="sub">Every dressage test and every showmanship class sits outside the four featured events, so a judged rider had no weekly loop at all. This is theirs: one class a week, ranked by <b>mark</b> rather than by the clock, on the same gold-ribbon rule.</div>'
    +'<div class="bList">'+rows.slice(0,3).map((r,k)=>'<span class="bE'+(r.me?' me':'')+'">'+(k===0?'👑':k===1?'🥈':'🥉')+' '+esc(r.n)+' '+pc(r.v)+'%</span>').join('')
    +(place>3?'<span class="bE me">#'+place+' You '+pc(mine||0)+'%</span>':'')+'</div>'
    +'<div class="sub">'+(place?('🏅 You are #'+place+' of '+rows.length+'.'):'Take a 🥇 gold (95%) in it and you are on the board.')+'</div>'
    +'<button data-fx="lad:again:'+esc(jd.id)+'">Ride it</button> <button data-fx="lad:why:'+esc(jd.id)+'">What it pays</button></div>';
  }
  /* ribbons that accumulate */
  const tiers=ribTierReady(s);
  html+='<div class="passCard"><div class="ph"><b>🎀 Ribbons won · '+(L.rib.total||0)+'</b><span style="font-size:11px;color:#8c7a63">'+(L.rib.wkTotal||0)+' this week</span></div>'
   +'<div class="sub">The pips on an event card are that event\'s best round and they stop at four. This is every ribbon you have ever been handed, and it never stops — ride the same course again and it still counts.</div>'
   +'<div class="crow" style="flex-wrap:wrap;gap:4px">'+RIB_TIERS.map(([need,r],k)=>{
     const done=(L.tiers||{})[k], has=(L.rib.total||0)>=need;
     return done?'<span class="bE me">✅ '+need+'🎀</span>':has?'<button class="claimBtn" data-fx="lad:ribtier:'+k+'">Claim '+need+'🎀 · '+esc(G.money.rewardLabel(r))+'</button>'
      :'<span class="bE">🔒 '+need+'🎀 → '+esc(G.money.rewardLabel(r))+'</span>';
    }).join('')+'</div></div>';
  /* the championship path */
  const q=champPath(s);
  if(q){
   html+='<div class="passCard"><div class="ph"><b>🏆 The road to the Basin Championship</b><span style="font-size:11px;color:#8c7a63">'+q.n+'/4 venues</span></div>'
    +'<div class="cbar"><div class="cfill" style="width:'+Math.round(q.n/4*100)+'%"></div></div>'
    +'<div class="crow" style="flex-wrap:wrap;gap:4px;margin-top:5px">'+Object.keys(q.venues).map(t=>'<span class="bE'+(q.venues[t]?' me':'')+'">'+(q.venues[t]?'✓':'▫️')+' '+esc(t)+'</span>').join('')+'</div>'
    +'<div class="sub">'+(q.ok?'All four signed off — the <b>Basin Championship Final</b> at Hollowpeak will take your entry.':esc(nextVenueHint(s))||'Two ribbons, or one gold, at any event in a town signs that town off.')+'</div>';
   if(L.champion)html+='<div class="sub">🏆 Last Final: you finished <b>#'+L.champion.place+'</b> in '+esc(L.champion.season)+'.'+((L.titles||[]).length?' Titles held: '+(L.titles||[]).length+'.':'')+'</div>';
   html+='</div>';
  }
  /* an unfinished round, and the last one */
  if(s.runSaved&&Date.now()-s.runSaved.at<RUN_KEEP){
   const ev=evById(s.runSaved.ev);
   html+='<div class="passCard" style="background:linear-gradient(180deg,#fff4e0,#ffe9c4)"><div class="ph"><b>⏪ An unfinished round</b></div>'
    +'<div class="sub">You were '+(s.runSaved.idx+1)+' of '+(ev?'the':'the')+' course through <b>'+esc((ev&&ev.name)||s.runSaved.ev)+'</b> at '+s1(s.runSaved.t)+'s when the game closed. A crash never costs you a ticket here.</div>'
    +'<button class="claimBtn" data-fx="lad:resume">Pick it up</button> <button data-fx="lad:drop">Let it go</button></div>';
  }
  if(s.lastRun)html+='<div class="sub">Your last round: <b>'+esc(s.lastRun.name)+'</b> — '+s1(s.lastRun.t)+'s. <button data-fx="lad:card">Open the result card</button></div>';
  return html;
 }});

 /* ================================================================= actions =============== */
 G.ui.action('lad',(a)=>{
  const k=a[0];
  if(k==='again'){ const ev=evById(a[1]); if(!ev)return; G.hidePanels(); G.course.startCourse(ev); }
  else if(k==='rematch'){
   const ev=evById(a[1]); if(!ev)return;
   if(!E().spendTicket){toast('🎟️ Tickets are not available just now.');return;}
   if(!E().spendTicket())return;
   pendingRematch={ev:ev.id,at:Date.now()};
   G.hidePanels(); G.course.startCourse(ev);
  }
  else if(k==='rank'){ if(E().claimRank)E().claimRank(+a[1]); try{G.ui.renderLB();}catch(e){} G.ui.rerender('resultPanel'); }
  else if(k==='ribtier')claimRibTier(+a[1]);
  else if(k==='why'){ CARD={mode:'preview',ev:a[1]}; G.ui.open('resultPanel'); }
  else if(k==='card'){ CARD={mode:'result'}; G.ui.open('resultPanel'); }
  else if(k==='resume')resumeRun();
  else if(k==='drop')dropRun(true);
  else if(k==='boards'){ try{G.ui.renderLB();}catch(e){} G.ui.open('lbPanel'); const b=$('lbPanel')&&$('lbPanel').querySelector('[data-lbtab="ladder"]'); if(b)b.click(); }
 });

 /* ================================================================= the event rows ======== */
 /* ui2-compete gathers every leftover node on an event row into one .c2-evExtra block and hides the
    whole block when it holds no control — which it never did, so the favoured traits, the reward
    line, the qualifier badge and the showmanship turnout preview were all computed correctly and
    then set to display:none on every row in the game. A single button in this block is enough to
    keep all of it on screen, and the button is worth having anyway. */
 G.ui.eventRow((ev,s,h)=>{
  s=s||{}; const L=lad(s), bits=[];
  const rib=(L.rib.byEv||{})[ev.id]||0;
  if(rib)bits.push('🎀 <b>'+rib+'</b> won here');
  if(ev.race&&!ev.gauntlet&&!ev.friendly){
   const d=DIFFS()[s.evDiff==null?1:s.evDiff]||DIFFS()[1]||DIFFS()[0];
   bits.push('🏁 field of <b>'+((FIELD_N[d.k]||3)+1)+'</b>');
  }
  if(featuredNow().some(f=>f.id===ev.id)){
   let place=0; try{place=E().myPlace?E().myPlace(E().weeklyRows(ev,s)):0;}catch(e){}
   bits.push(place?('🏅 board <b>#'+place+'</b> · '+esc(bandLabel(place))):'🏅 not on this week\'s board yet');
  }
  const jd=judgedOfWeek();
  if(jd&&jd.id===ev.id)bits.push('🎽 <b>judged class of the week</b>');
  if(ev.champ&&L.champion)bits.push('🏆 last Final: <b>#'+L.champion.place+'</b>');
  return '<div class="ladCard">'+(bits.length?'<span style="flex:1;min-width:120px">'+bits.join(' · ')+'</span>':'<span style="flex:1"></span>')
   +'<button data-fx="lad:why:'+esc(ev.id)+'" title="Time allowed, favoured traits, the whole reward line and your record here">ℹ️ Full card</button></div>';
 });
 /* the Events panel: the path, and anything waiting */
 G.ui.eventCard((s,h)=>{
  s=s||{}; const L=lad(s);
  let html='';
  if(s.runSaved&&Date.now()-s.runSaved.at<RUN_KEEP){
   const ev=evById(s.runSaved.ev);
   html+='<div class="evrow" style="flex-wrap:wrap;background:linear-gradient(180deg,#fff4e0,#ffe9c4)"><b style="width:100%">⏪ An unfinished round</b>'
    +'<span class="ladCard">You were at gate '+(s.runSaved.idx+1)+' of <b>'+esc((ev&&ev.name)||s.runSaved.ev)+'</b> on '+s1(s.runSaved.t)+'s when the game closed. Pick it up where it stopped — a crash never costs you a round or a ticket here.</span>'
    +'<span class="ladGrid"><button class="claimBtn" data-fx="lad:resume">Pick it up</button><button data-fx="lad:drop">Let it go</button></span></div>';
  }
  const tiers=ribTierReady(s);
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🏆 Where this sits on the ladder</b>'
   +'<span class="ladCard" style="display:block">Every round you ride moves four things at once: <b>ribbons</b> ('+(L.rib.total||0)+' won, '+(L.rib.wkTotal||0)+' this week), your <b>racing rank</b> ('+((s.racing&&s.racing.pts)||0)+' points), this week\'s <b>leaderboard</b> ('+weekLeft()+' to go) and the four <b>championship venues</b> ('+((champPath(s)||{}).n||0)+'/4). '+esc(nextVenueHint(s,true))+'</span>'
   +'<span class="ladGrid"><button data-fx="lad:boards">🏅 Open the ladder</button>'
   +(s.lastRun?'<button data-fx="lad:card">🏅 Last result</button>':'')
   +(tiers.length?'<button class="claimBtn" data-fx="lad:ribtier:'+tiers[0]+'">🎀 '+RIB_TIERS[tiers[0]][0]+' ribbons — claim</button>':'')
   +'</span></div>';
  return html;
 });
 G.ui.profileSection((name,r)=>{
  try{
   const s=G.save.fresh()||{}, L=lad(s);
   if(!L.champion&&!(L.rib.total))return '';
   return '<div class="crow"><span class="lbl">🏆 Ladder</span><span>'+(L.rib.total||0)+' ribbons'
    +(L.champion?(' · Final #'+L.champion.place+' ('+esc(L.champion.season)+')'):'')
    +((L.titles||[]).length?(' · '+L.titles.length+'× Basin Champion'):'')+'</span></div>';
  }catch(e){return '';}
 });

 /* ================================================================= tidy up =============== */
 G.on('tick',(dt,t)=>{
  const c=G.course.get();
  if(lastC&&lastC!==c){
   clearField();
   try{const P=E().PVP; if(P&&P.rivals)for(const k in P.rivals)if(P.rivals[k]&&P.rivals[k].ai)delete P.rivals[k];}catch(e){}
   runWrite=0;
   /* A quit is a decision, not a crash. The saved round exists only for the case where no frame
      ever ran again — so any frame that sees the course gone throws it away, and what survives a
      reload is exactly what the game never got to tidy up. */
   try{if(G.save.fresh().runSaved)clearRun();}catch(e){}
  }
  lastC=c;
 });

 /* ================================================================= boot + state ========== */
 G.on('boot',s=>{
  try{
   fixRacePars();                                   // sister packages push their racing rows during install
   const sv=s||G.save.fresh()||{};
   if(sv.runSaved&&Date.now()-sv.runSaved.at<RUN_KEEP){
    const ev=evById(sv.runSaved.ev);
    setTimeout(()=>toast('⏪ '+((ev&&ev.name)||'A round')+' was still running when you closed the game — pick it up from 🏆 Events.'),3000);
   }else if(sv.runSaved){ dropRun(true); }
   const tiers=ribTierReady(sv);
   if(tiers.length)setTimeout(()=>toast('🎀 '+RIB_TIERS[tiers[0]][0]+' ribbons won — there is a reward waiting in 🏅 Boards → 🏆 Ladder.'),5200);
  }catch(e){ console.error('ladder boot',e); }
 });
 G.on('state',o=>{
  try{
   const s=G.save.fresh()||{}, L=lad(s), c=G.course.get();
   const jd=judgedOfWeek();
   o.ladder={ribbons:L.rib.total||0,ribbonsWeek:L.rib.wkTotal||0,races:L.races||0,wins:L.wins||0,podiums:L.podiums||0,
    weekLeft:weekLeft(),weekTimes:Object.keys((s.weekly&&s.weekly.times)||{}).length,
    judged:jd?jd.id:null,judgedScore:L.wk.score[jd&&jd.id]||null,
    champion:L.champion||null,titles:(L.titles||[]).length,
    runSaved:s.runSaved?{ev:s.runSaved.ev,idx:s.runSaved.idx,t:s.runSaved.t}:null,
    lastRun:s.lastRun||null,card:!!($('resultPanel')&&$('resultPanel').style.display==='flex'),
    tickets:E().tix?E().tix(s):0};
   if(o.course&&c&&FIELD&&FIELD.c===c){
    const rows=fieldRows(c), me=rows.findIndex(x=>x.me);
    o.course.aiField=FIELD.rivals.length; o.course.aiPlace=me+1;
    if(!c.pvp&&!c.friendly){ o.course.field=FIELD.rivals.length; o.course.place=me+1; }
    o.course.rivals=rows.map(r=>({n:r.n,proj:+r.proj.toFixed(1),me:!!r.me}));
   }
  }catch(e){}
 });

 /* ================================================================= quests + boards ======= */
 W.addBoard({k:'ribbons',g:'ride',label:'Ribbons won',rate:6,val:s=>((s.lad&&s.lad.rib&&s.lad.rib.total)||0)});
 G.quest.addDaily({type:'ladpodium',icon:'🏅',label:'Finish on the podium in a race',goal:1,r:{c:220,tickets:1,p:20}});
 G.quest.addAch({id:'rib60',icon:'🎀',label:'A wall of ribbons',desc:'Win 60 ribbons all told',v:s=>((s.lad&&s.lad.rib&&s.lad.rib.total)||0),goal:60,r:{g:5,k:2}});
 G.quest.addAch({id:'ladwin10',icon:'🏁',label:'Front runner',desc:'Win 10 races against a field',v:s=>((s.lad&&s.lad.wins)||0),goal:10,r:{c:900,g:4}});
 G.quest.addAch({id:'champion1',icon:'🏆',label:'Basin Champion',desc:'Win the Basin Championship Final',v:s=>((s.lad&&s.lad.titles&&s.lad.titles.length)||0),goal:1,r:{g:10,k:3,gear:'Legendary'}});
 G.quest.addAch({id:'wkboard',icon:'📅',label:'On the board',desc:'Put a gold time on three weekly leaderboards',v:s=>Object.keys((s.weekly&&s.weekly.gold)||{}).length,goal:3,r:{g:6,k:2}});

 /* handles for QA and sister packages */
 G.ladder={FIELD:()=>FIELD,fieldRows,judgedOfWeek,judgedRows,placeIn,weekLeft,routeLen,goldOf,
  writeWeekly,tallyRibbons,RIB_TIERS,claimRibTier,ribTierReady,finalStandings,champPath,nextVenueHint,
  resumeRun,dropRun,openCard,last:()=>LAST,FIELD_N,featuredNow};
}
