/* course-engine package check.
   Boots ranch3d.html?qa=course-engine, waits for the horse, then drives every feature of the package
   through window.__features and render_game_to_text: gaits (sprint / dash / blown), stamina costs and
   breed regen, bond tricks (fast sprint, sliding stop), jump timing grades and refusals, laps, the line
   penalty, inspiring-jump stamina refunds, speed pads, cross country, difficulty, accuracy + gold ribbons,
   stat prerequisites, the event card and the first-person camera.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-course-engine.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=course-engine&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();
const ready=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(ready,null,{timeout:150000,polling:250});
 stage('horseReady');
 /* shared in-page helpers */
 await page.evaluate(()=>{
  const G=window.__features; const st=()=>JSON.parse(render_game_to_text());
  window.__qa={
   st,
   key(code,down=true){window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code}));},
   release(){for(const c of['ArrowUp','ShiftLeft','ShiftRight','KeyS','KeyX','Space'])this.key(c,false);},
   passCountdown(){window.advanceTime(4000);},
   /* stand in the approach box for a frame, then step across the fence plane in the air */
   crossFence(j,age){const p=G.horse.player,R=G.horse.RIG();
    p.pos.set(j.x-Math.sin(j.rotY)*6,0,j.z-Math.cos(j.rotY)*6);p.heading=j.rotY;p.speed=0;p.y=0;p.vy=0;window.advanceTime(17);
    p.pos.set(j.x-Math.sin(j.rotY)*0.9,0,j.z-Math.cos(j.rotY)*0.9);p.speed=8;
    if(age!=null){if(R.heroMotion)R.heroJumpAge=age;else{p.y=age>=0.5&&age<=1?1.1:age<0.42?0.5:0.7;p.vy=0.1;}}
    window.advanceTime(250);},
   toGate(j){const p=G.horse.player;p.pos.set(j.x,0,j.z);p.speed=0;window.advanceTime(120);},
   ev(id){return G.tables.EVENTS3.find(e=>e.id===id);},
  };
 });
 const r=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};const p=G.horse.player;
  out.installed=G.installed.includes('course-engine'); out.errors=G.errors.slice();
  /* ---- tables and save fields ---- */
  const E=G.tables.EVENTS3;
  out.tables={x2:!!Q.ev('x2'),a2xc:!!(Q.ev('a2').xc&&Q.ev('a2').route==='xc1'),xc1:G.tables.RACE_ROUTES.xc1.length,xc2:G.tables.RACE_ROUTES.xc2.length,diffs:G.course.DIFFS.length,h2laps:Q.ev('h2').laps,h2req:Q.ev('h2').req,lineRows:E.filter(e=>e.line).length};
  const s0=G.save.fresh(); out.save={bestAcc:!!s0.bestAcc,ribbonGold:!!s0.ribbonGold,ribbonsBy:!!s0.ribbonsBy,evDiff:s0.evDiff};
  out.quests={daily:['lineclean','gold','xc'].every(t=>G.quest.DAILYQ.some(d=>d.type===t)),ach:['acc95','gold5','slide10','xc3','elite1'].every(i=>G.quest.ACHS.some(a=>a.id===i)),types:typeof G.quest.types.gold==='function'&&typeof G.quest.types.ribbons==='function'};
  out.worldPads=G.world.things.filter(t=>t.kind==='pad').length;
  /* ---- a level-10 horse with modest stats: prerequisites gate the events ---- */
  const h=G.horse.ridden(); h.level=10; for(const k of G.tables.STAT_KEYS)h.stats[k]=3; h.bond=10;
  G.save.sync(s=>{const hh=s.horses[G.horse.rideIdx()];hh.level=10;for(const k of G.tables.STAT_KEYS)hh.stats[k]=3;hh.bond=10;});
  document.getElementById('eventsBtn').click();
  const panel=document.getElementById('eventsPanel');
  const rowOf=id=>[...panel.querySelectorAll('.evrow')].find(r=>r.textContent.includes(Q.ev(id).name));
  out.panelOpen=panel.style.display==='flex';
  const a2=rowOf('a2'), h1=rowOf('h1');
  out.card={h1:h1&&h1.textContent,a2locked:a2&&!a2.querySelector('button[data-ev]')&&/needs/.test(a2.textContent)&&/Stamina 5/.test(a2.textContent)&&!!a2.querySelector('button[data-drill="stamina"]'),
   h1btns:h1&&[...h1.querySelectorAll('button[data-ev]')].map(b=>b.dataset.ev),
   allRows:[...panel.querySelectorAll('.evrow')].filter(r=>r.querySelector('button[data-ev]')).every(r=>/⏱ \d+:\d\d/.test(r.textContent)&&/XP/.test(r.textContent)&&/pass pts/.test(r.textContent)),
   anyBad:[...panel.querySelectorAll('button[data-ev]')].some(b=>!/^\d+:[012]$/.test(b.dataset.ev)),
   legend:/gold/.test(panel.textContent)};
  /* the gate holds when startCourse is called directly (the VR path) */
  G.course.startCourse(Q.ev('a2')); out.gateBlocked=Q.st().mode==='free_roam';
  G.hidePanels();
  /* ---- stats up: everything opens ---- */
  for(const k of G.tables.STAT_KEYS)h.stats[k]=10; G.save.sync(s=>{const hh=s.horses[G.horse.rideIdx()];for(const k of G.tables.STAT_KEYS)hh.stats[k]=10;});
  document.getElementById('eventsBtn').click(); const a2b=rowOf('a2'); out.a2open=!!(a2b&&a2b.querySelectorAll('button[data-ev]').length===3); G.hidePanels();
  /* ---- difficulty scales par ---- */
  G.course.startCourse(Q.ev('h1'),0); const cN=G.course.get(); const parN=cN.par, dN=cN.ce.diff.k, hN=cN.jumps[0].g.scale.y;
  G.course.startCourse(Q.ev('h1'),2); const cE=G.course.get(); const parE=cE.par, dE=cE.ce.diff.k, hE=cE.jumps[0].g.scale.y;
  G.course.startCourse(Q.ev('h1'),1); const parO=G.course.get().par;
  out.diff={dN,dE,ratioN:+(parN/parO).toFixed(2),ratioE:+(parE/parO).toFixed(2),hN,hE,evDiff:G.save.fresh().evDiff};
  G.course.cancelCourse();
  return out;
 });
 check('package installed without error',r.installed&&r.errors.length===0,r.errors);
 check('EVENTS3 gains x2, a2 becomes cross country, xc routes, laps/req/line flags',r.tables.x2&&r.tables.a2xc&&r.tables.xc1===7&&r.tables.xc2===7&&r.tables.diffs===3&&r.tables.h2laps===2&&r.tables.h2req&&r.tables.h2req.jump===2&&r.tables.lineRows>=10,r.tables);
 check('save ensures (bestAcc, ribbonGold, ribbonsBy, evDiff)',r.save.bestAcc&&r.save.ribbonGold&&r.save.ribbonsBy&&r.save.evDiff===1,r.save);
 check('dailies, achievements, story types registered',r.quests.daily&&r.quests.ach&&r.quests.types,r.quests);
 check('three world speed pads on the ranch track',r.worldPads===3,r.worldPads);
 check('event card: time allowed, XP, pass pts on every open row',r.panelOpen&&r.card.allRows&&r.card.legend,r.card.h1);
 check('stat prerequisite locks a2 with a "needs" line and no Enter',r.card.a2locked,r.card.h1);
 check('three difficulty buttons per open event (i:di)',r.card.h1btns&&r.card.h1btns.length===3&&!r.card.anyBad,r.card.h1btns);
 check('startCourse refuses a locked event (VR path covered)',r.gateBlocked);
 check('training the stats opens the event',r.a2open);
 check('difficulty: novice par x1.3 / elite x0.85, rails scaled, last pick remembered',r.diff.dN==='novice'&&r.diff.dE==='elite'&&r.diff.ratioN===1.3&&r.diff.ratioE===0.85&&r.diff.hN<1&&r.diff.hE>1&&r.diff.evDiff===1,r.diff);

 /* ---- jump timing, refusals, laps, accuracy on h2 (6 fences x 2 laps) ---- */
 stage('show jumping');
 const J=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};const p=G.horse.player;
  /* jump sits below its cap so the finish can pay Jump XP into it */
  G.horse.ridden().stats.jump=5; G.save.sync(s=>{const hh=s.horses[G.horse.rideIdx()];hh.stats.jump=5;hh.sxp=hh.sxp||{};hh.sxp.jump=0;});
  G.course.startCourse(Q.ev('h2'),1); Q.passCountdown();
  let c=G.course.get(); out.start={started:c.started,laps:c.ce.laps,lap:c.ce.lap,total:c.jumps.length,timeAllowed:c.ce.timeAllowed};
  out.grades=[];
  for(let i=0;i<6;i++){Q.crossFence(c.jumps[c.idx],0.7);const s=Q.st();out.grades.push([s.course.lastGrade,s.course.index,s.course.lap]);}
  const s1=Q.st(); out.afterLap1={lap:s1.course.lap,index:s1.course.index,acc:s1.course.accuracy,mode:s1.mode};
  /* a refusal: run at fence 1 of lap 2 without asking for the jump (after the last jump has landed) */
  window.advanceTime(1500); const j=c.jumps[0]; p.pos.set(j.x-Math.sin(j.rotY)*3,0,j.z-Math.cos(j.rotY)*3); p.heading=j.rotY; p.speed=6; Q.key('ArrowUp'); for(let k=0;k<20&&Q.st().course.refusals===0;k++)window.advanceTime(50); Q.key('ArrowUp',false); window.advanceTime(17);
  const s2=Q.st(); out.refusal={grade:s2.course.lastGrade,refusals:s2.course.refusals,index:s2.course.index,speed:s2.player.speed};
  /* then take it late */
  Q.crossFence(c.jumps[0],0.12); const s3=Q.st(); out.late={grade:s3.course.lastGrade,index:s3.course.index};
  /* knock one down: walk through the rails with no jump at all */
  window.advanceTime(1500); const j2=c.jumps[1]; p.pos.set(j2.x-Math.sin(j2.rotY)*6,0,j2.z-Math.cos(j2.rotY)*6); p.heading=j2.rotY; p.speed=0; window.advanceTime(17);
  p.pos.set(j2.x-Math.sin(j2.rotY)*0.5,0,j2.z-Math.cos(j2.rotY)*0.5); p.speed=2.2; window.advanceTime(800);
  const s4=Q.st(); out.fault={grade:s4.course.lastGrade,faults:s4.course.faults,index:s4.course.index};
  const coins0=Q.st().wallet.coins;
  for(let i=0;i<4;i++){window.advanceTime(1200);Q.crossFence(c.jumps[c.idx],0.7);}
  const s5=Q.st(); const sv=G.save.fresh();
  out.finish={mode:s5.mode,bestAcc:sv.bestAcc.h2,ribbons:sv.ribbons.h2,gold:!!sv.ribbonGold.h2,by:sv.ribbonsBy['h2:open'],coinsUp:s5.wallet.coins>coins0,jumpXp:sv.horses[0].sxp&&sv.horses[0].sxp.jump};
  return out;
 });
 check('h2 starts with 2 laps, 6 fences, a time allowed',J.start.started&&J.start.laps===2&&J.start.lap===1&&J.start.total===6&&J.start.timeAllowed>60,J.start);
 check('six perfect crossings graded perfect and counted',J.grades.every(g=>g[0]==='perfect')&&J.grades[4][1]===5,J.grades);
 check('lap 2 begins with the index reset (no finish after lap 1)',J.afterLap1.lap===2&&J.afterLap1.index===0&&J.afterLap1.mode==='course'&&J.afterLap1.acc===1,J.afterLap1);
 check('refusal: horse stops in front, index unchanged',J.refusal.grade==='refusal'&&J.refusal.refusals===1&&J.refusal.index===0&&J.refusal.speed<1,J.refusal);
 check('late take-off graded late and clears',J.late.grade==='late'&&J.late.index===1,J.late);
 check('walking through the rails is a fault and advances',J.fault.grade==='fault'&&J.fault.faults===1&&J.fault.index===2,J.fault);
 check('finish: accuracy persisted below 95%, 3 green ribbons, no gold, ribbonsBy[h2:open], stat XP paid',J.finish.mode==='free_roam'&&J.finish.bestAcc>0.5&&J.finish.bestAcc<0.95&&J.finish.ribbons===3&&!J.finish.gold&&J.finish.by===3&&J.finish.coinsUp&&J.finish.jumpXp>0,J.finish);

 /* ---- a clean round on h1 earns the gold ribbon; the row shows it ---- */
 stage('gold ribbon');
 const Gd=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};
  G.course.startCourse(Q.ev('h1'),1); Q.passCountdown(); const c=G.course.get();
  for(let i=0;i<5;i++)Q.crossFence(c.jumps[c.idx],0.7);
  const sv=G.save.fresh(); out.ribbons=sv.ribbons.h1; out.gold=!!sv.ribbonGold.h1; out.acc=sv.bestAcc.h1; out.mode=Q.st().mode;
  document.getElementById('eventsBtn').click(); const row=[...document.querySelectorAll('#eventsPanel .evrow')].find(r=>r.textContent.includes(Q.ev('h1').name)); out.rowGold=row&&row.textContent.includes('🥇'); G.hidePanels();
  return out;
 });
 check('clean perfect round: 4 ribbons incl. gold, accuracy 100%, 🥇 in the events row',Gd.mode==='free_roam'&&Gd.ribbons===4&&Gd.gold&&Gd.acc>=0.95&&Gd.rowGold,Gd);

 /* ---- inspiring jump refunds stamina; line penalty on a race; speed pads ---- */
 stage('line + pads');
 const L=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};const p=G.horse.player;
  G.course.startCourse(Q.ev('bd'),1); Q.passCountdown(); const c=G.course.get();
  out.line={hasLine:!!c.ce.line,legs:c.ce.line&&c.ce.line.length};
  Q.toGate(c.jumps[0]);
  const pts=G.tables.RACE_ROUTES.bd; const cx=pts.reduce((a,q)=>a+q[0],0)/pts.length, cz=pts.reduce((a,q)=>a+q[1],0)/pts.length;
  p.pos.set(cx,0,cz); p.heading=0; Q.key('ArrowUp'); window.advanceTime(3000); Q.key('ArrowUp',false);
  const s1=Q.st(); out.off={lineOff:s1.course.lineOff,index:s1.course.index};
  /* pads on the legs */
  const pad=c.items.find(i=>i.pad); out.pads=c.items.filter(i=>i.pad).length;
  p.pos.set(pad.x,0,pad.z); p.speed=5; window.advanceTime(100); const b1=Q.st().player.boost;
  p.pos.set(pad.x+30,0,pad.z+30); p.speed=0; window.advanceTime(4600); const b2=Q.st().player.boost;
  p.pos.set(pad.x,0,pad.z); p.speed=5; window.advanceTime(100); const b3=Q.st().player.boost;
  const boost=c.items.find(i=>i.type==='boost'); p.pos.set(boost.x,0,boost.z); p.speed=0; window.advanceTime(50); const v1=boost.m.visible;
  p.pos.set(boost.x+30,0,boost.z); window.advanceTime(4600); p.pos.set(boost.x,0,boost.z); window.advanceTime(50); const v2=boost.m.visible;
  out.pad={b1,b2,b3,boostOnce:!v1&&!v2};
  for(let i=1;i<c.jumps.length;i++)Q.toGate(c.jumps[i]);
  const sv=G.save.fresh(); const cc=G.course.get(); out.done={mode:Q.st().mode,bestAcc:sv.bestAcc.bd,ribbons:sv.ribbons.bd,idx:cc&&cc.idx,total:cc&&cc.jumps.length,started:cc&&cc.started,t:cc&&cc.t};
  return out;
 });
 check('race carries an ideal line (one leg per gate)',L.line.hasLine&&L.line.legs===7,L.line);
 check('riding the middle of the loop accrues a line penalty',L.off.lineOff>2&&L.off.index===1,L.off);
 check('speed pads: one per leg, boost fires, fires again after the cooldown; a boost pickup is single use',L.pads===7&&L.pad.b1&&!L.pad.b2&&L.pad.b3&&L.pad.boostOnce,L.pad);
 check('race finishes through the gates, accuracy recorded',L.done.mode==='free_roam'&&L.done.bestAcc>0&&L.done.ribbons>=1,L.done);

 /* ---- cross country: gates and natural fences alternating along the Barleyfold loop ---- */
 stage('cross country');
 const X=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};const p=G.horse.player;
  G.course.startCourse(Q.ev('a2'),1); Q.passCountdown(); const c=G.course.get();
  const kinds=c.jumps.map(j=>j.kind);
  out.build={n:c.jumps.length,alt:kinds.every((k,i)=>k===(i%2?'fence':'gate')),outside:c.jumps.every(j=>Math.abs(j.x)>25||Math.abs(j.z)>20),onGround:c.jumps.every(j=>Math.abs(j.g.position.y-G.world.groundH(j.x,j.z))<0.5),par:c.par,timeAllowed:c.ce.timeAllowed,pads:c.items.filter(i=>i.pad).length};
  let stamAfter=null, gateOk=true, fenceOk=true;
  while(G.course.get()){
   const cc=G.course.get(); const j=cc.jumps[cc.idx]; const idx=cc.idx;
   if(j.kind==='gate'){Q.toGate(j); if(G.course.get()&&G.course.get().idx!==idx+1)gateOk=false;}
   else{ p.stam=0.5; Q.crossFence(j,0.7); if(stamAfter===null)stamAfter=p.stam; if(G.course.get()&&G.course.get().idx!==idx+1)fenceOk=false; }
  }
  const sv=G.save.fresh(); out.run={gateOk,fenceOk,stamAfter,mode:Q.st().mode,gold:!!sv.ribbonGold.a2,xc:sv.stats.xc,ribbons:sv.ribbons.a2,acc:sv.bestAcc.a2};
  return out;
 });
 check('XC builds 14 obstacles, gate/fence alternating, outside the arena, on the ground, pads on legs',X.build.n===14&&X.build.alt&&X.build.outside&&X.build.onGround&&X.build.pads===7&&X.build.par>20,X.build);
 check('gates pass by proximity, fences by a jump; a perfect fence refunds stamina (0.5 -> >=0.66)',X.run.gateOk&&X.run.fenceOk&&X.run.stamAfter>=0.66,X.run);
 check('XC finish: gold ribbon on a clean round, xc counter, accuracy',X.run.mode==='free_roam'&&X.run.gold&&X.run.xc===1&&X.run.ribbons===4,X.run);

 /* ---- gaits: gallop, sprint (double-tap Shift), dash, blown ---- */
 stage('gaits');
 const Sp=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};const p=G.horse.player; const h=G.horse.ridden();
  h.bond=10; h.level=3; G.save.sync(s=>{s.horses[G.horse.rideIdx()].level=3;}); p.pos.set(-70,0,-10); p.heading=0; p.speed=0; p.stam=1; p.blown=false; p.boostT=0; window.advanceTime(1500);
  Q.key('ArrowUp'); Q.key('ShiftLeft'); window.advanceTime(1000); const st1=p.stam; window.advanceTime(1500); const st2=p.stam;
  const A=Q.st().player.speed; out.gallopRate=(st1-st2)/1.5;
  Q.key('ShiftLeft'); Q.key('ShiftLeft');   // double-tap
  window.advanceTime(1500); const s=Q.st(); const B=s.player.speed; out.sprintRate=(st2-p.stam)/1.5; out.sprint={A,B,flag:s.player.sprint,icon:document.getElementById('gaitEl').textContent,boostA:Q.st().player.boost,stam:p.stam};
  Q.key('Space'); window.advanceTime(100); const d1=Q.st(); Q.key('Space',false); window.advanceTime(200); const d2=Q.st();
  out.dash={flag:d1.player.dash,speed:d2.player.speed,B,jumping:d1.jumping};
  window.advanceTime(16000); const bl=Q.st(); out.blown={flag:bl.player.blown,speed:bl.player.speed,stam:bl.stamina};
  Q.release(); window.advanceTime(500); h.level=10; G.save.sync(s=>{s.horses[G.horse.rideIdx()].level=10;});
  return out;
 });
 check('sprint after a double-tap of Shift: >10% faster than the gallop, flag + ⚡ icon',Sp.sprint.B>Sp.sprint.A*1.1&&Sp.sprint.flag&&Sp.sprint.icon==='⚡',Sp.sprint);
 check('sprint drains stamina at least 1.8x the gallop rate',Sp.sprintRate>Sp.gallopRate*1.8,{gallop:Sp.gallopRate,sprint:Sp.sprintRate});
 check('dash: Space while sprinting bursts past the sprint speed without a jump',Sp.dash.flag&&Sp.dash.speed>Sp.dash.B*1.05&&!Sp.dash.jumping,Sp.dash);
 check('blown: sprinting empties the bar and caps the horse at a canter',Sp.blown.flag&&Sp.blown.speed<=5.6&&Sp.blown.stam<=0.35,Sp.blown);

 /* ---- stamina: jumps cost it; Friesian regen with Epic tack; bond tricks ---- */
 stage('stamina + bond tricks');
 const Bd=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};const p=G.horse.player; const h=G.horse.ridden(); const RS=G.course.rideState;
  p.speed=0; p.blown=false; p.stam=0.9; Q.key('Space'); window.advanceTime(50); Q.key('Space',false); const sJ=p.stam; window.advanceTime(250); out.jumpCost={after:sJ,later:p.stam};
  /* regen baseline vs Friesian wearing two Epic pieces */
  p.speed=0; p.y=0; window.advanceTime(2000); p.stam=0.5; window.advanceTime(2000); const base=p.stam-0.5;
  const g1=G.horse.genGear('Epic','saddle'), g2=G.horse.genGear('Epic','bridle');
  G.save.sync(s=>{s.tack=s.tack||[];s.tack.push(g1,g2);const hh=s.horses[G.horse.rideIdx()];hh.gear=Object.assign(hh.gear||{},{saddle:g1.id,bridle:g2.id});hh.breed='black';});
  const breed0=h.breed; h.breed='black'; h.gear=Object.assign(h.gear||{},{saddle:g1.id,bridle:g2.id}); RS.tackAt=0;
  p.stam=0.5; window.advanceTime(2000); const fr=p.stam-0.5; h.breed=breed0;
  G.save.sync(s=>{const hh=s.horses[G.horse.rideIdx()];hh.breed=breed0;});
  out.regen={base:+base.toFixed(3),friesian:+fr.toFixed(3),ratio:+(fr/base).toFixed(2)};
  /* fast sprint + sliding stop with bond 80 vs bond 10 */
  const gallop=()=>{p.pos.set(-70,0,-10);p.heading=0;p.speed=0;p.stam=1;p.blown=false;Q.key('ArrowUp');Q.key('ShiftLeft');window.advanceTime(3000);const v=Q.st().player.speed;return v;};
  h.bond=10; const v10=gallop(); Q.release(); Q.key('KeyX'); window.advanceTime(500); const slide10=Q.st().player; Q.key('KeyX',false); window.advanceTime(1500);
  h.bond=79; G.save.sync(s=>{s.horses[G.horse.rideIdx()].bond=79;}); const v80=gallop(); Q.release(); Q.key('KeyX'); window.advanceTime(100); const sl=Q.st().player; const icon=document.getElementById('gaitEl').textContent; window.advanceTime(400); const sl2=Q.st().player; Q.key('KeyX',false); window.advanceTime(1200); const sl3=Q.st().player;
  out.tricks={v10,v80,ratio:+(v80/v10).toFixed(3),slide10:slide10.slide,speed10:slide10.speed,slide80:sl.slide,icon,speed80:sl2.speed,stopped:sl3.speed,slides:(G.save.fresh().stats||{}).slides};
  /* S from a gallop also slides at bond 3+ */
  gallop(); Q.key('ArrowUp',false); Q.key('ShiftLeft',false); Q.key('KeyS'); window.advanceTime(100); out.sSlide=Q.st().player.slide; Q.key('KeyS',false); window.advanceTime(1200); Q.release();
  G.ui.openCare(); const care=document.getElementById('carePanel').textContent; out.care={tricks:/Bond tricks/.test(care),perks:/Riding perks/.test(care),unlocked:/✅ 🛑 Sliding stop/.test(care)}; G.hidePanels();
  return out;
 });
 check('a jump costs stamina (0.9 -> <=0.89 after 300 ms, stamina-10 horse pays 0.05)',Bd.jumpCost.after<=0.86&&Bd.jumpCost.later<=0.89,Bd.jumpCost);
 check('Friesian with two Epic pieces regenerates ~20% faster at halt',Bd.regen.ratio>=1.15&&Bd.regen.ratio<=1.25,Bd.regen);
 check('fast sprint: bond 79 (level 3) gallops ~8% faster than bond 10',Bd.tricks.ratio>=1.06&&Bd.tricks.ratio<=1.1,Bd.tricks);
 check('sliding stop needs bond level 3: none at bond 10, slides to a halt at bond 79 (X and S)',!Bd.tricks.slide10&&Bd.tricks.speed10>3&&Bd.tricks.slide80&&Bd.tricks.icon==='🛑'&&Bd.tricks.speed80<1.5&&Bd.tricks.stopped<0.2&&Bd.tricks.slides>=1&&Bd.sSlide,Bd.tricks);
 check('care panel lists bond tricks and riding perks with unlock state',Bd.care.tricks&&Bd.care.perks&&Bd.care.unlocked,Bd.care);

 /* ---- first-person camera ---- */
 stage('first person');
 const F=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa,out={};const p=G.horse.player;
  p.pos.set(2,0,-8); p.heading=0; p.speed=0; window.advanceTime(300);
  Q.key('KeyT'); window.advanceTime(600); const s=Q.st();
  out.fp={mode:s.camera.mode,dist:+Math.hypot(s.camera.x-s.player.x,s.camera.z-s.player.z).toFixed(2),dy:+(s.camera.y-s.player.y).toFixed(2),rider:p.rider&&p.rider.g?p.rider.g.visible:null,fov:s.camera.fov,hint:getComputedStyle(document.getElementById('fpHint')).display};
  Q.key('ArrowUp'); window.advanceTime(2000); const s2=Q.st(); Q.key('ArrowUp',false); out.ride={dist:+Math.hypot(s2.camera.x-s2.player.x,s2.camera.z-s2.player.z).toFixed(2),moved:s2.player.z!==s.player.z||s2.player.x!==s.player.x};
  Q.key('KeyT'); window.advanceTime(2500); const s3=Q.st(); out.back={mode:s3.camera.mode,dist:+Math.hypot(s3.camera.x-s3.player.x,s3.camera.z-s3.player.z).toFixed(2),rider:p.rider&&p.rider.g?p.rider.g.visible:null};
  return out;
 });
 check('KeyT: camera at the rider\'s eyes (<0.8 m, 1.6–2.6 m up), rider hidden, hint shown',F.fp.mode==='fp'&&F.fp.dist<0.8&&F.fp.dy>1.6&&F.fp.dy<2.6&&F.fp.rider===false&&F.fp.hint==='block',F.fp);
 check('first person tracks the horse while riding',F.ride.dist<0.8&&F.ride.moved,F.ride);
 check('KeyT again: back to the orbit camera, rider visible',F.back.mode==='orbit'&&F.back.dist>3&&F.back.rider===true,F.back);

 console.log(await page.evaluate(()=>render_game_to_text()));
 check('no console/page errors',errors.length===0,errors.slice(0,5));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
