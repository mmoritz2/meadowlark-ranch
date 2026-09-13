/* Feature package 'events2-disciplines' — headless verification.
   Boots ranch3d.html?qa=events2-disciplines, waits for the horse, then rides every discipline
   through window.__features (G) and asserts what a PLAYER would see: the text in the Events
   panel and whether it is actually on screen, the fences standing on the course, the HUD line
   while riding, where the arena is, and what the save remembers afterwards.

   Usage:  QA_URL=http://127.0.0.1:8551 NODE_PATH=$(npm root -g) node tools/qa-events2-disciplines.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8551').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=events2-disciplines&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 stage('horseReady');
 /* keep every toast: #toasts only holds the one on screen and the queue drains on real timers */
 await page.evaluate(()=>{const G=window.__features;window.__toasts=[];const t0=G.toast;G.toast=m=>{window.__toasts.push(String(m));return t0(m);};
  /* a horse good enough to be let into everything, so the gate never masks a discipline test */
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];h.level=12;h.stats=h.stats||{};for(const k of G.tables.STAT_KEYS)h.stats[k]=10;h.bond=90;h.needs=h.needs||{};h.needs.clean=100;});
  G.horse.reloadHorses();
  window.__qa2={
   st:()=>JSON.parse(render_game_to_text()),
   ev:id=>G.tables.EVENTS3.find(e=>e.id===id),
   go(){window.advanceTime(4200);},                       // past the countdown
   gate(j){G.horse.player.pos.set(j.x,0,j.z);G.horse.player.speed=6;window.advanceTime(120);},
   cross(j,age){const p=G.horse.player,R=G.horse.RIG();age=age==null?0.7:age;
    for(const d of[-2.4,-1.0,-0.4,0.4,1.0,2.4]){
     p.pos.set(j.x+Math.sin(j.rotY)*d,0,j.z+Math.cos(j.rotY)*d);
     if(R.heroMotion)R.heroJumpAge=age; else {p.y=age>=0.5&&age<=1?1.1:0.5;p.vy=0.1;}
     p.speed=7; window.advanceTime(20);
    }
    if(!R.heroMotion){p.y=0;p.vy=0;}},
   hud:()=>(document.getElementById('courseHudTxt')||{}).textContent||'',
  };
 });
 const toasted=re=>page.evaluate(r=>(window.__toasts||[]).some(t=>new RegExp(r).test(t)),re);

 /* ---------------------------------------------------------------- 1. install + pars --- */
 stage('pars');
 const r1=await page.evaluate(()=>{
  const G=window.__features,T=G.tables,Q=window.__qa2,out={};
  out.installed=G.installed.includes('events2-disciplines');
  out.errors=G.errors.slice();
  out.pars={}; out.cards={}; out.course={};
  const ids=['rr','r1','r2','pp','bd','wt','a2','x2','gt','h1','a1'];
  for(const id of ids){
   const ev=Q.ev(id); if(!ev)continue;
   out.pars[id]=ev.par==null?null:ev.par; if(ev.gauntlet)out.pars.gtLimit=ev.limit;
   out.cards[id]=+G.course.eventTimeAllowed(ev,1).toFixed(1);
   G.course.startCourse(ev,1);
   const c=G.course.get();
   out.course[id]=c&&c.ce?+c.ce.timeAllowed.toFixed(1):null;
   G.course.cancelCourse(); window.advanceTime(40);
  }
  out.mismatch=ids.filter(id=>out.course[id]!=null&&Math.abs(out.cards[id]-out.course[id])>0.6);
  return out;
 });
 check('package installed with no errors',r1.installed&&!r1.errors.some(e=>e.id==='events2-disciplines'),r1.errors);
 check('the time allowed on the card is the time the course gives you, on every routed event',
  r1.mismatch.length===0,{card:r1.cards,course:r1.course});
 check('the Kestrel Grand Loop advertises its real 200s+ allowance, not the old flat 56s',
  r1.cards.r1>200&&r1.cards.rr>60&&r1.cards.rr<90,{r1:r1.cards.r1,rr:r1.cards.rr});
 check('the gauntlet shows one clock: card, course and hard limit agree',
  r1.cards.gt===r1.course.gt&&r1.cards.gt===r1.pars.gtLimit,{card:r1.cards.gt,course:r1.course.gt,limit:r1.pars.gtLimit});

 /* ---------------------------------------------------------------- 2. the card ---------- */
 stage('event card');
 const r2=await page.evaluate(async()=>{
  const G=window.__features,out={};
  document.getElementById('eventsBtn').click();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  G.events2.fixRows();
  const p=document.getElementById('eventsPanel');
  const rows=[...p.querySelectorAll('.evrow')].filter(r=>r.dataset.ev2disc);
  out.rows=rows.length;
  out.hiddenExtras=0; out.visibleExtras=0; out.noExtras=0;
  for(const r of rows){
   const ex=r.querySelector('.c2-evExtra');
   if(!ex){out.noExtras++;continue;}
   if(getComputedStyle(ex).display==='none')out.hiddenExtras++; else out.visibleExtras++;
  }
  const find=id=>rows.find(r=>r.dataset.ev2row===id);
  const where=id=>{const r=find(id);const w=r&&r.querySelector('.c2-evWhere');return w?w.textContent.trim():(r?r.textContent.slice(0,90):null);};
  out.whereShow=where('s1'); out.whereGt=where('gt'); out.whereXc=where('a2'); out.whereRace=where('pp');
  const d1=find('d1');
  out.d1Specs=d1?[...d1.querySelectorAll('.c2-spec')].map(s=>((s.querySelector('.c2-k')||{}).textContent||'')+'='+((s.querySelector('.c2-v')||{}).textContent||'')):[];
  out.cardBtn=!!(find('h1')&&find('h1').querySelector('[data-fx="ev2:card:h1"]'));
  /* the row carries the reward line course-engine writes, and it is on screen */
  const h1=find('h1'); out.h1Text=h1?h1.innerText.replace(/\s+/g,' '):'';
  /* open the full card */
  find('h1').querySelector('[data-fx="ev2:card:h1"]').click();
  const cp=document.getElementById('ev2CardPanel');
  out.cardOpen=cp&&cp.style.display==='flex';
  out.cardText=cp?cp.innerText.replace(/\s+/g,' '):'';
  G.hidePanels();
  return out;
 });
 check('every programme row is tagged with its discipline',r2.rows>=20,{rows:r2.rows});
 check('the information card is on screen instead of display:none',
  r2.visibleExtras>=20&&r2.hiddenExtras===0,{visible:r2.visibleExtras,hidden:r2.hiddenExtras,none:r2.noExtras});
 check('the row carries the reward line and the time allowed a player can read',
  /🎁/.test(r2.h1Text)&&/allowed/.test(r2.h1Text),r2.h1Text.slice(0,200));
 check('a showmanship class reads as Showmanship, not Dressage',/Showmanship/.test(r2.whereShow||'')&&!/· Dressage/.test(r2.whereShow||''),r2.whereShow);
 check('the seasonal gauntlet reads as a gauntlet, not a Race',/Seasonal gauntlet/.test(r2.whereGt||''),r2.whereGt);
 check('cross country and races keep their own labels',/Cross country/.test(r2.whereXc||'')&&/Race/.test(r2.whereRace||''),{xc:r2.whereXc,race:r2.whereRace});
 check('a dressage class advertises a percentage, not a number of seconds',
  r2.d1Specs.some(s=>/To beat=.*%/.test(s))&&!r2.d1Specs.some(s=>/Score to beat=\d+s/.test(s)),r2.d1Specs);
 check('the ℹ️ full card opens with the prize, the prerequisites and the three levels',
  r2.cardBtn&&r2.cardOpen&&/Novice/.test(r2.cardText)&&/Elite/.test(r2.cardText)&&/🪙/.test(r2.cardText)&&/Level 1/.test(r2.cardText),
  {open:r2.cardOpen,text:(r2.cardText||'').slice(0,260)});

 /* ---------------------------------------------------------------- 3. the filter -------- */
 stage('filter');
 const r3=await page.evaluate(async()=>{
  const G=window.__features,out={};
  document.getElementById('eventsBtn').click();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  G.events2.fixRows();
  const p=document.getElementById('eventsPanel');
  const count=()=>[...p.querySelectorAll('.evrow')].filter(r=>r.dataset.ev2disc&&!r.classList.contains('ev2hide')).length;
  out.all=count();
  const btn=p.querySelector('[data-fx="ev2:filter:dressage"]');
  out.hasChips=!!btn&&!!p.querySelector('[data-fx="ev2:filter:show"]');
  if(btn)btn.click();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  G.events2.fixRows();
  const p2=document.getElementById('eventsPanel');
  const shown=[...p2.querySelectorAll('.evrow')].filter(r=>r.dataset.ev2disc&&!r.classList.contains('ev2hide'));
  out.dressage=shown.length; out.discs=[...new Set(shown.map(r=>r.dataset.ev2disc))];
  out.stateFilter=JSON.parse(render_game_to_text()).ev2.filter;
  G.events2.setFilter(null);
  G.hidePanels();
  return out;
 });
 check('the programme has a discipline filter strip',r3.hasChips&&r3.all>=20,{all:r3.all});
 check('filtering to dressage leaves only the dressage rows on screen',
  r3.dressage>=6&&r3.dressage<r3.all&&r3.discs.length===1&&r3.discs[0]==='dressage',{shown:r3.dressage,of:r3.all,discs:r3.discs});

 /* ---------------------------------------------------------------- 4. show jumping ------ */
 stage('show jumping');
 const r4=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  G.course.startCourse(Q.ev('h1'),1); Q.go();
  const c=G.course.get();
  out.types=c.jumps.map(j=>j.fenceType);
  out.distinct=[...new Set(out.types)].length;
  out.meshes=c.jumps.map(j=>{let n=0;j.g.traverse(o=>{if(o.isMesh)n++;});return n;});
  out.meshSpread=[...new Set(out.meshes)].length;
  out.spritesKept=c.jumps.every(j=>{let s=0;j.g.traverse(o=>{if(o.isSprite)s++;});return s===1;});
  out.hud0=Q.hud();
  /* two clean fences, then walk through the third's rails */
  Q.cross(c.jumps[0],0.9); Q.cross(c.jumps[1],0.9);
  out.hudMid=Q.hud();
  const j=c.jumps[c.idx];
  p.pos.set(j.x-Math.sin(j.rotY)*0.6,0,j.z-Math.cos(j.rotY)*0.6); p.heading=j.rotY; p.y=0; p.speed=2.2; window.advanceTime(600);
  out.hudFault=Q.hud(); out.faults=JSON.parse(render_game_to_text()).ev2.faults;
  G.course.cancelCourse(); window.advanceTime(60);
  return out;
 });
 check('a jumping course is built from several kinds of fence, not one rail repeated',
  r4.distinct>=3&&r4.meshSpread>=3,{types:r4.types,meshes:r4.meshes});
 check('every fence keeps its number',r4.spritesKept,r4.meshes);
 check('the HUD names the discipline and the fence that is coming',
  /^⤴️ Fence 1\/5/.test(r4.hud0)&&/next /.test(r4.hud0),r4.hud0);
 check('knocking a rail down is priced in faults and shown',
  r4.faults>=4&&/Faults [1-9]/.test(r4.hudFault),{faults:r4.faults,hud:r4.hudFault});

 /* three refusals at the same fence and you are out */
 const r4b=await page.evaluate(async()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  G.course.startCourse(Q.ev('h1'),1); Q.go();
  const c=G.course.get(), j=c.jumps[0];
  out.seen=0;
  for(let n=0;n<3&&G.course.get();n++){
   p.heading=j.rotY;
   for(let k=0;k<25;k++){const d=2.6-k*0.1;p.pos.set(j.x-Math.sin(j.rotY)*d,0,j.z-Math.cos(j.rotY)*d);p.y=0;p.speed=6;window.advanceTime(34);}
   p.pos.set(j.x-Math.sin(j.rotY)*5,0,j.z-Math.cos(j.rotY)*5); p.speed=0; window.advanceTime(2300);
   const s2=JSON.parse(render_game_to_text()); out.seen=s2.course?s2.course.refusals:out.seen;
  }
  await new Promise(r=>setTimeout(r,120));
  const st=JSON.parse(render_game_to_text());
  out.mode=st.mode; out.refusals=out.seen;
  out.elim=(window.__toasts||[]).some(t=>/eliminated/i.test(t));
  if(G.course.get())G.course.cancelCourse();
  return out;
 });
 check('three refusals at the same fence eliminates the round',r4b.elim&&r4b.mode==='free_roam',r4b);

 /* ---------------------------------------------------------------- 5. cross country ----- */
 stage('cross country');
 const r5=await page.evaluate(async()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  G.course.startCourse(Q.ev('a2'),1); Q.go();
  let c=G.course.get();
  out.types=[...new Set(c.jumps.filter(j=>j.kind==='fence').map(j=>j.fenceType))];
  out.onGround=c.jumps.every(j=>Math.abs(j.g.position.y-G.world.groundH(j.x,j.z))<0.5);
  let st=JSON.parse(render_game_to_text());
  out.opt=st.ev2.xc&&st.ev2.xc.opt; out.allowed=c.ce.timeAllowed;
  out.hud=Q.hud();
  /* push past the optimum: the clock is the discipline's own */
  c.t=out.opt+30; window.advanceTime(40);
  st=JSON.parse(render_game_to_text());
  out.over=st.ev2.xc; out.hudOver=Q.hud();
  /* then ride it home */
  out.steps=[];
  for(let k=0;k<40&&G.course.get();k++){
   const cc=G.course.get(), j=cc.jumps[cc.idx], i=cc.idx;
   if(j.kind==='gate')Q.gate(j); else Q.cross(j,0.9);
   const nc=G.course.get(); out.steps.push([i,j.kind,nc?nc.idx:'done']);
   if(nc&&nc.idx===i)break;
  }
  await new Promise(r=>setTimeout(r,150));
  const sv=G.save.fresh();
  out.best=sv.ev2&&sv.ev2.xcBest&&sv.ev2.xcBest.a2;
  out.mode=JSON.parse(render_game_to_text()).mode;
  out.tail=(window.__toasts||[]).slice(-4);
  return out;
 });
 check('cross country is built from solid obstacles of several kinds, all on the ground',
  r5.types.length>=3&&r5.onGround,{types:r5.types});
 check('cross country rides to an optimum time, not a time allowed',
  r5.opt>20&&Math.abs(r5.allowed-r5.opt*1.4)<1&&/optimum/.test(r5.hud),{opt:r5.opt,allowed:r5.allowed,hud:r5.hud});
 check('seconds over the optimum become eventing penalties on the HUD',
  r5.over&&r5.over.time>=11&&/\+1[0-9]/.test(r5.hudOver),{over:r5.over,hud:r5.hudOver});
 check('the finish records an XC score in the save and says it',
  typeof r5.best==='number'&&r5.mode==='free_roam'&&await toasted('jumping · total'),
  {best:r5.best,mode:r5.mode,steps:r5.steps,tail:r5.tail});

 /* ---------------------------------------------------------------- 6. races ------------- */
 stage('races');
 const r6=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  /* the level-one race had two hazards sitting on top of two world speed pads */
  const pads=G.world.things.filter(t=>t.kind==='pad').map(t=>[t.x,t.z]);
  out.pads=pads.length;
  p.pos.set(-7,0,9);
  G.course.startCourse(Q.ev('pp'),1);
  const c=G.course.get();
  out.hazOnPad=(c.hazards||[]).filter(h=>pads.some(q=>Math.hypot(h.x-q[0],h.z-q[1])<3.5)).length;
  out.haz=(c.hazards||[]).length;
  /* the start box: marshalled to the line instead of starting from the yard */
  const j=c.jumps[0];
  out.distToGate1=+Math.hypot(p.pos.x-j.x,p.pos.z-j.z).toFixed(1);
  out.startBox=JSON.parse(render_game_to_text()).ev2.startBox;
  Q.go(); out.hud=Q.hud();
  /* ride it wide of every gate: the gates score badly */
  for(let i=0;i<c.jumps.length&&G.course.get();i++){
   const g=G.course.get().jumps[G.course.get().idx];
   p.pos.set(g.x+3.6,0,g.z+2.4); p.speed=9; window.advanceTime(120);
  }
  const sv=G.save.fresh();
  out.sloppyAcc=sv.bestAcc&&sv.bestAcc.pp; out.sloppyGold=!!(sv.ribbonGold||{}).pp;
  return out;
 });
 check('the world speed pads are no longer buried under race hazards',r6.pads===3&&r6.hazOnPad===0&&r6.haz>=3,
  {pads:r6.pads,onPad:r6.hazOnPad,hazards:r6.haz});
 check('a race marshals you to a start box behind gate 1',r6.distToGate1<12&&r6.startBox,{dist:r6.distToGate1,box:r6.startBox});
 check('the race HUD counts gates and says how clean they were',/^🏁 Gate 1\//.test(r6.hud||''),r6.hud);
 check('a sloppy run through the gates does not take the gold ribbon',!r6.sloppyGold&&r6.sloppyAcc<0.95,
  {acc:r6.sloppyAcc,gold:r6.sloppyGold});

 const r6b=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  /* dead through the middle of every gate: the gate mark is clean */
  G.course.startCourse(Q.ev('pp'),1); Q.go();
  let c=G.course.get();
  for(let i=0;i<c.jumps.length&&G.course.get();i++){const g=G.course.get().jumps[G.course.get().idx];Q.gate(g);}
  const sv=G.save.fresh();
  out.tidyAcc=sv.bestAcc&&sv.bestAcc.pp;
  /* the five routes that had no hand-placed hazards at all */
  const empt={};
  for(const id of ['r2','x2','wt']){
   G.course.startCourse(Q.ev(id),1);
   const cc=G.course.get(); empt[id]=(cc.hazards||[]).length;
   G.course.cancelCourse(); window.advanceTime(40);
  }
  out.empty=empt;
  return out;
 });
 check('a tidy run through the middle of every gate scores better than a wide one',
  r6b.tidyAcc>r6.sloppyAcc,{tidy:r6b.tidyAcc,sloppy:r6.sloppyAcc});
 check('the routes that carried no hazards now carry some',
  Object.values(r6b.empty).every(n=>n>=3),r6b.empty);

 /* ---------------------------------------------------------------- 6c. the field -------- */
 const r6c=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  const wins0=(G.save.fresh().racing||{}).wins||0;
  G.course.startCourse(Q.ev('rr'),1);
  out.caption=(document.getElementById('ev2Call')||{}).innerText||'';
  out.field=JSON.parse(render_game_to_text()).ev2.race;
  out.inScene=G.events2.ghosts.list.filter(g=>g.parts&&g.parts.group&&g.parts.group.parent).length;
  Q.go(); window.advanceTime(4000);
  const mid=JSON.parse(render_game_to_text()).ev2.race;
  out.moved=mid.pacers.every(g=>g.s>5);
  out.hud=Q.hud();
  /* dawdle at the line: the field goes past and the placing says so */
  window.advanceTime(9000);
  out.place=JSON.parse(render_game_to_text()).ev2.race.place;
  G.course.cancelCourse(); window.advanceTime(200);
  out.left=G.events2.ghosts.list.length;
  out.wins=((G.save.fresh().racing||{}).wins||0)-wins0;
  return out;
 });
 check('a solo race has a field of pace-setters on the track, named before the gate drops',
  r6c.field&&r6c.field.field>=3&&r6c.inScene===r6c.field.field-1&&/pace-setters/.test(r6c.caption),
  {field:r6c.field&&r6c.field.field,inScene:r6c.inScene,caption:r6c.caption});
 check('the pace-setters ride the loop and the HUD carries your placing',
  r6c.moved&&/P\d\/\d/.test(r6c.hud||''),{hud:r6c.hud});
 check('sitting on the line drops you down the field',r6c.place>1,{place:r6c.place});
 check('the field leaves with the course and never counts as a PvP win',r6c.left===0&&r6c.wins===0,
  {left:r6c.left,wins:r6c.wins});

 /* ---------------------------------------------------------------- 7. dressage ---------- */
 stage('dressage');
 const r7=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,out={};
  const read=di=>{
   G.course.startCourse(Q.ev('d1'),di); Q.go(); window.advanceTime(200);
   const st=JSON.parse(render_game_to_text()).ev2.judged;
   const c=G.course.get();
   const o={figs:st.figures,holds:st.holds.slice(),diff:st.diff,hold:st.holds.reduce((a,b)=>a+b,0),hud:Q.hud()};
   G.course.cancelCourse(); window.advanceTime(40);
   return o;
  };
  out.novice=read(0); out.open=read(1); out.elite=read(2);
  return out;
 });
 check('difficulty changes the test itself, not just the purse',
  r7.elite.figs>r7.open.figs&&r7.elite.hold>r7.open.hold&&r7.novice.hold<r7.open.hold,
  {novice:{f:r7.novice.figs,h:r7.novice.hold},open:{f:r7.open.figs,h:r7.open.hold},elite:{f:r7.elite.figs,h:r7.elite.hold}});
 check('the dressage HUD says which level you are riding',/Novice/.test(r7.novice.hud)&&/Elite/.test(r7.elite.hud),
  {novice:r7.novice.hud,elite:r7.elite.hud});

 /* the same scripted ride marks differently under a strict judge */
 const r7b=await page.evaluate(async()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  const band=g=>g==='walk'?1.8:g==='trot'?4.6:9;
  async function rideTest(di){
   G.save.sync(s=>{if(s.bestScore)delete s.bestScore.d1;});
   G.course.startCourse(Q.ev('d1'),di); Q.go();
   for(let n=0;n<14&&G.course.get();n++){
    const c=G.course.get(), f=c.figs[c.fi]; if(!f)break;
    const at=G.course.ARENA_LETTERS[f.at];
    if(f.gait!=='halt'){                                   // a second in the wrong gait, out of the corner
     for(let k=0;k<20;k++){p.pos.set(at[0]+11,0,at[1]+11);p.speed=f.gait==='canter'?1.6:9;window.advanceTime(34);}
    }
    if(f.circle){
     for(let k=0;k<44;k++){const a=k/44*2.2*Math.PI;p.pos.set(at[0]+Math.cos(a)*6,0,at[1]+Math.sin(a)*6);p.speed=band(f.gait);window.advanceTime(34);}
    }else if(f.gait==='halt'){
     p.pos.set(at[0],0,at[1]); p.speed=0; window.advanceTime((f.hold||1)*1000+500);
    }else{
     for(let k=0;k<24;k++){p.pos.set(at[0],0,at[1]);p.speed=band(f.gait);window.advanceTime(34);}
    }
   }
   await new Promise(r=>setTimeout(r,140));
   if(G.course.get())G.course.cancelCourse();
   return (G.save.fresh().bestScore||{}).d1;
  }
  out.novice=await rideTest(0);
  out.elite=await rideTest(2);
  return out;
 });
 check('a kind judge and a strict one mark the same ride differently',
  typeof r7b.novice==='number'&&typeof r7b.elite==='number'&&r7b.novice>r7b.elite,r7b);

 /* ---------------------------------------------------------------- 8. the arena travels -- */
 stage('arena');
 const r8=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  const home=G.events2.ARENA_HOME.X.slice();
  out.home=home;
  p.pos.set(-7,0,9);
  G.course.startCourse(Q.ev('d1'),1);
  let c=G.course.get();
  out.cott={X:G.course.ARENA_LETTERS.X.slice(),letter0:[+c.letters[0].position.x.toFixed(1),+c.letters[0].position.z.toFixed(1)],
   at:Q.ev('d1').at,player:[+p.pos.x.toFixed(1),+p.pos.z.toFixed(1)]};
  out.cottDist=+Math.hypot(p.pos.x-Q.ev('d1').at[0],p.pos.z-Q.ev('d1').at[1]).toFixed(1);
  G.course.cancelCourse(); window.advanceTime(40);
  out.backHome=G.course.ARENA_LETTERS.X.slice();
  G.course.startCourse(Q.ev('d5'),1);
  c=G.course.get();
  out.holl={X:G.course.ARENA_LETTERS.X.slice(),letter0:[+c.letters[0].position.x.toFixed(1),+c.letters[0].position.z.toFixed(1)]};
  G.course.cancelCourse(); window.advanceTime(40);
  out.s1at=!!Q.ev('s1').at; out.danceAt=!!Q.ev('d2').at;
  return out;
 });
 check('a Cottonwood test is ridden at Cottonwood, and the rider is taken there',
  Math.hypot(r8.cott.X[0]-r8.cott.at[0],r8.cott.X[1]-r8.cott.at[1])<0.1&&r8.cottDist<45,
  {X:r8.cott.X,at:r8.cott.at,dist:r8.cottDist});
 check('the arena letters actually stand in the town, and come home afterwards',
  Math.hypot(r8.cott.letter0[0]-r8.home[0],r8.cott.letter0[1]-r8.home[1])>20&&
  Math.abs(r8.backHome[0]-r8.home[0])<0.01&&Math.abs(r8.backHome[1]-r8.home[1])<0.01,
  {letter:r8.cott.letter0,back:r8.backHome,home:r8.home});
 check('Hollowpeak is somewhere else again, and a basin class stays at the ranch arena',
  Math.hypot(r8.holl.X[0]-r8.cott.X[0],r8.holl.X[1]-r8.cott.X[1])>40&&r8.s1at&&!r8.danceAt,
  {cott:r8.cott.X,holl:r8.holl.X});

 /* ---------------------------------------------------------------- 9. showmanship ------- */
 stage('showmanship');
 const r9=await page.evaluate(async()=>{
  const G=window.__features,Q=window.__qa2,out={};const p=G.horse.player;
  async function ride(quiet){
   G.save.sync(s=>{if(s.bestScore)delete s.bestScore.s1;});
   G.course.startCourse(Q.ev('s1'),1);
   const sheet=document.getElementById('ev2SheetPanel');
   out.sheetOpen=sheet&&sheet.style.display==='flex';
   out.sheetText=sheet?sheet.innerText.replace(/\s+/g,' '):'';
   Q.go();
   const AL=G.course.ARENA_LETTERS, X=AL.X, C=AL.C;
   const axis=Math.atan2(C[0]-X[0],C[1]-X[1]);
   for(let n=0;n<40&&G.course.get();n++){
    const c=G.course.get(), f=c.figs[c.fi]; if(!f)break;
    const at=AL[f.at];
    p.pos.set(at[0],0,at[1]);
    p.heading=quiet?axis:axis+1.4;                      // square to the judge, or stood across him
    p.speed=f.gait==='halt'?(quiet?0:0.22):(quiet?1.5:2.6);
    window.advanceTime((f.hold?f.hold*1000:0)+1000);
   }
   await new Promise(r=>setTimeout(r,140));
   const st=JSON.parse(render_game_to_text());
   const hand=(G.save.fresh().ev2||{}).handling||{};
   if(G.course.get())G.course.cancelCourse();
   return {score:(G.save.fresh().bestScore||{}).s1,handling:hand.s1,hud:out.lastHud};
  }
  /* the HUD mid-class */
  G.course.startCourse(Q.ev('s1'),1); Q.go(); window.advanceTime(200);
  out.hud=Q.hud();
  G.course.cancelCourse(); window.advanceTime(40);
  G.save.sync(s=>{s.ev2=s.ev2||{};s.ev2.handling={};});
  out.quiet=await ride(true);
  G.save.sync(s=>{s.ev2=s.ev2||{};s.ev2.handling={};});
  out.rough=await ride(false);
  const res=document.getElementById('ev2ResultPanel');
  out.resultOpen=res&&res.style.display==='flex';
  out.finishSheet=res?res.innerText.replace(/\s+/g,' '):'';
  G.hidePanels();
  return out;
 });
 check('a showmanship class says it is showmanship and shows both marks while you ride',
  /^🧼 Showmanship/.test(r9.hud||'')&&/turnout/.test(r9.hud||'')&&/handling/.test(r9.hud||''),r9.hud);
 check('the judge\'s card is a card, with the five parts and what would raise them',
  r9.sheetOpen&&/Coat/.test(r9.sheetText)&&/Tack turnout/.test(r9.sheetText)&&/Handling in the ring/.test(r9.sheetText),
  (r9.sheetText||'').slice(0,220));
 check('standing still and square is judged: a quiet handler scores above a fidgety one',
  r9.quiet.handling>r9.rough.handling+0.1&&r9.quiet.score>r9.rough.score,
  {quiet:{h:r9.quiet.handling,s:r9.quiet.score},rough:{h:r9.rough.handling,s:r9.rough.score}});
 check('the finish puts up a result card with turnout, handling and the figure marks',
  r9.resultOpen&&/Turnout/.test(r9.finishSheet||'')&&/Handling/.test(r9.finishSheet||'')&&/Figure by figure/.test(r9.finishSheet||''),
  (r9.finishSheet||'').slice(0,220));

 /* ---------------------------------------------------------------- 10. the gauntlet ----- */
 stage('gauntlet');
 const r10=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,T=G.tables,out={};
  const gt=T.EVENTS3.find(e=>e.gauntlet);
  out.row={id:gt.id,route:gt.route,time:gt.time,limit:gt.limit,name:gt.name};
  out.oneClock=gt.time===gt.limit;
  out.seasons=Object.keys(G.events2.GAUNTLET_SEASONS).map(k=>({k,route:G.events2.GAUNTLET_SEASONS[k].route,
   pts:G.events2.GAUNTLET_SEASONS[k].pts.length,limit:G.events2.GAUNTLET_SEASONS[k].limit}));
  out.distinctRoutes=new Set(out.seasons.map(s=>JSON.stringify(T.RACE_ROUTES[s.route]||G.events2.GAUNTLET_SEASONS[s.k].pts))).size;
  G.course.startCourse(gt,1); Q.go();
  const c=G.course.get();
  out.allowed=c.ce.timeAllowed; out.hud=Q.hud(); out.hazards=(c.hazards||[]).length;
  out.obstacles=c.jumps.length;
  out.decor=JSON.parse(render_game_to_text()).ev2.startBox;
  G.course.cancelCourse(); window.advanceTime(40);
  return out;
 });
 check('the gauntlet keeps one clock — the hard limit — in the row, the course and the HUD',
  r10.oneClock&&r10.allowed===r10.row.limit&&new RegExp('/'+r10.row.limit+'s').test(r10.hud||''),
  {row:r10.row,allowed:r10.allowed,hud:r10.hud});
 check('each season has its own loop and its own limit',
  r10.seasons.length===4&&r10.distinctRoutes===4&&new Set(r10.seasons.map(s=>s.limit)).size>=3&&r10.seasons.every(s=>s.pts>=10),
  r10.seasons);
 check('the seasonal trial is dressed and has hazards of its own',r10.hazards>=4&&r10.obstacles>=10,
  {hazards:r10.hazards,obstacles:r10.obstacles});

 /* ---------------------------------------------------------------- 11. the HUDs --------- */
 stage('hud identity');
 const r11=await page.evaluate(()=>{
  const G=window.__features,Q=window.__qa2,out={};
  for(const id of ['h1','a2','pp','gt','d1','s1']){
   G.course.startCourse(Q.ev(id),1); Q.go(); window.advanceTime(120);
   out[id]=Q.hud();
   G.course.cancelCourse(); window.advanceTime(40);
  }
  out.prefixes=Object.values(out).map(t=>String(t).slice(0,2));
  return out;
 });
 check('every discipline rides under its own HUD line',
  new Set(['h1','a2','pp','gt','d1','s1'].map(k=>String(r11[k]).slice(0,2))).size>=5,
  {h1:r11.h1,a2:r11.a2,pp:r11.pp,gt:r11.gt,d1:r11.d1,s1:r11.s1});

 /* ---------------------------------------------------------------- 11b. result card ----- */
 stage('result card');
 const r12=await page.evaluate(async()=>{
  const G=window.__features,Q=window.__qa2,out={};
  G.hidePanels();
  G.course.startCourse(Q.ev('h1'),1); Q.go();
  let c=G.course.get();
  for(let i=0;i<5&&G.course.get();i++)Q.cross(G.course.get().jumps[G.course.get().idx],0.9);
  await new Promise(r=>setTimeout(r,150));
  const p=document.getElementById('ev2ResultPanel');
  out.open=p&&p.style.display==='flex';
  out.text=p?p.innerText.replace(/\s+/g,' '):'';
  out.again=!!(p&&p.querySelector('[data-fx="ev2:again:h1"]'));
  /* it rides again straight from the card */
  if(out.again)p.querySelector('[data-fx="ev2:again:h1"]').click();
  await new Promise(r=>setTimeout(r,200));
  out.restarted=JSON.parse(render_game_to_text()).mode;
  if(G.course.get())G.course.cancelCourse();
  window.advanceTime(60);
  return out;
 });
 check('a round ends on a result card, not twenty-six seconds of toast queue',
  r12.open&&/Show jumping/.test(r12.text)&&/Faults 0 — clear round/.test(r12.text)&&/Accuracy 100%/.test(r12.text)
  &&/gold ribbon/.test(r12.text)&&/🪙/.test(r12.text),
  (r12.text||'').slice(0,240));
 check('the result card offers the round again and starts it',r12.again&&r12.restarted==='course',
  {again:r12.again,mode:r12.restarted});

 /* ---------------------------------------------------------------- 12. errors ----------- */
 check('no console or page errors',errors.length===0,errors.slice(0,5));

 const bad=checks.filter(c=>!c.ok);
 console.log('');
 console.log(bad.length?('FAILED '+bad.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED')+' in '+((Date.now()-t0)/1000).toFixed(1)+'s');
 await browser.close();
 process.exit(bad.length?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
