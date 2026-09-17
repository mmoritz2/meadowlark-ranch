/* Feature package 'course-guide' — headless verification of the guidance line.

   Boots ranch3d.html?qa=course-guide, waits for the horse, then rides one course of every
   discipline the programme has — show jumping, cross country, a race, the seasonal gauntlet, a
   dressage test and a showmanship class — and asserts what a PLAYER would see rather than what
   the module exports: how many chevrons are standing, where in the world each one is, that the
   near end of the run sits on the obstacle and the far end at the rider's feet, that the run
   never leaves the line course-engine scores you on, that the floating arrow is still there and
   still over the right thing, what #courseHud actually says, and that the whole thing fades in
   and out instead of popping.

   It also measures the thing the feature is most likely to be wrong about. The ribbon is drawn
   every frame of the most expensive thing in the game, so the last section rides the same race
   twice — once with the guide on and once with it off — through the real animation loop and
   compares the median and the p95 frame time. The method is tools/qa-horse-performance.cjs's:
   150 requestAnimationFrame spans after a thirty-frame warm-up. On this Mac the honest number is
   about 16.7 ms median and 33.3 ms p95; a reading in the thousands means chromium fell back to
   the software rasteriser and nothing in that section means anything, which is why the backend
   comes from tools/qa-platform.cjs and is never spelled out here.

   Usage:  QA_URL=http://127.0.0.1:8602 NODE_PATH=$(npm root -g) node tools/qa-guide-line.cjs */
const QA=require('./qa-platform.cjs');
const {chromium}=QA;
const base=(process.env.QA_URL||QA.BASE).replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=course-guide&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:[QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 stage('horseReady');

 /* The harness is allowed to put the horse where a player would have ridden her; the PACKAGE is
    not, and the last section of this file checks that it never did. */
 await page.evaluate(()=>{
  const G=window.__features, p=G.horse.player;
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];h.level=14;h.stats=h.stats||{};for(const k of G.tables.STAT_KEYS)h.stats[k]=10;h.bond=90;h.needs=h.needs||{};h.needs.clean=100;});
  G.horse.reloadHorses(); G.hidePanels();
  window.__cg={
   ev:id=>G.tables.EVENTS3.find(e=>e.id===id),
   start(id,ms){G.hidePanels();G.course.startCourse(window.__cg.ev(id),1);window.advanceTime(ms==null?4400:ms);},
   stop(){if(G.course.get())G.course.cancelCourse();window.advanceTime(600);},
   /* a gate scores on proximity, a fence on a crossing in the air — the two ways a course advances */
   gate(j){p.pos.set(j.x,0,j.z);p.speed=6;window.advanceTime(140);},
   /* ranch3d.html pushes the rider out of every collider while player.y<2.5 and does it in the
      movement pass, before the course is ticked — so a fence that happens to be laid near a
      tree or a grandstand post shoves the sweep off its own line and the crossing never
      registers. A horse in the air over the fence is exempt from all of that, which is both
      what the game means by soaring and what makes this check about the guide instead of about
      where findClear happened to put the arena this boot. */
   cross(j,side){const R=G.horse.RIG();
    for(const d of[-2.4,-1.4,-0.8,-0.35,0.35,0.8,1.4,2.4]){
     p.pos.set(j.x+Math.sin(j.rotY)*d+Math.cos(j.rotY)*(side||0),0,j.z+Math.cos(j.rotY)*d-Math.sin(j.rotY)*(side||0));
     if(R.heroMotion)R.heroJumpAge=0.7; p.y=2.6; p.vy=0.1; p.speed=7; window.advanceTime(20);}
    p.y=0; p.vy=0;},
   /* course-engine only counts a fence when the rider crosses inside a narrow window, and a
      sweep that lands a frame either side of it simply does not register — so the harness
      re-presents at the obstacle the way a rider who missed it would, and says how many
      attempts it took rather than quietly passing on the first. */
   pass(){
    const at=()=>{const c=G.course.get();return c?((c.ce&&c.ce.lap||1)*1000+c.idx):-1;};
    const was=at();
    const sides=[0,1.1,-1.1,0];
    for(let k=1;k<=sides.length;k++){
     const c=G.course.get(); if(!c)return k;
     const j=c.jumps[c.idx]; if(!j)return k;
     if(j.kind==='gate')window.__cg.gate(j); else window.__cg.cross(j,sides[k-1]);
     window.advanceTime(80);
     if(at()!==was)return k;
    }
    return 0;                                              // 0 means it never went past
   },
   target(){const c=G.course.get();if(!c)return null;
    if(c.dressage){const f=c.figs&&c.figs[c.fi];const at=f&&G.course.ARENA_LETTERS[f.at];return at?[at[0],at[1]]:null;}
    const j=c.jumps[c.idx];return j?[j.x,j.z]:null;},
   chevs(){const CG=G.courseGuide,out=[];for(let i=0;i<CG.core.count;i++)out.push(CG.chevronAt(i));return out;},
   segDist(x,z,L){const ax=L.x2-L.x1,az=L.z2-L.z1,l2=ax*ax+az*az||1;
    let t=((x-L.x1)*ax+(z-L.z1)*az)/l2;t=t<0?0:t>1?1:t;
    return Math.hypot(x-(L.x1+ax*t),z-(L.z1+az*t));},
   /* everything a player could point at on screen, for one moment of one course */
   look(){
    const CG=G.courseGuide, c=G.course.get(), st=JSON.parse(render_game_to_text());
    const tgt=window.__cg.target(), ch=window.__cg.chevs(), el=document.getElementById('cgDist');
    const dTo=q=>Math.hypot(q[0]-tgt[0],q[2]-tgt[1]);
    const o={n:ch.length,guide:st.guide,mode:st.mode,
     visible:!!(CG.core.visible&&CG.rim.visible),ringVisible:!!CG.ring.visible,
     target:tgt,riderDist:tgt?+Math.hypot(p.pos.x-tgt[0],p.pos.z-tgt[1]).toFixed(2):null,
     readout:el&&el.style.display!=='none'?el.textContent:null,
     hudText:(document.getElementById('courseHudTxt')||{}).textContent||'',
     arrowVisible:!!(G.course.arrow&&G.course.arrow.visible),
     arrowOff:tgt&&G.course.arrow?+Math.hypot(G.course.arrow.position.x-tgt[0],G.course.arrow.position.z-tgt[1]).toFixed(2):null,
     arrowHeight:G.course.arrow?+(G.course.arrow.position.y-G.world.groundH(G.course.arrow.position.x,G.course.arrow.position.z)).toFixed(2):null,
     lap:c&&c.ce?c.ce.lap:null,idx:c?c.idx:null,jumps:c?c.jumps.length:0,figs:c&&c.figs?c.figs.length:0};
    if(ch.length){
     o.nearTarget=+dTo(ch[0]).toFixed(2);
     o.farTarget=+dTo(ch[ch.length-1]).toFixed(2);
     o.farFromRider=+Math.hypot(ch[ch.length-1][0]-p.pos.x,ch[ch.length-1][2]-p.pos.z).toFixed(2);
     o.monotone=ch.every((q,i)=>i===0||dTo(q)>dTo(ch[i-1])-0.01);
     /* on the ground, not hovering: every chevron within two centimetres of the terrain it sits on */
     o.grounded=ch.every(q=>Math.abs(q[1]-(G.world.groundH(q[0],q[2])+0.105))<0.03);
     o.tapers=CG.core.count<2||true;
    }
    return o;
   },
  };
 });
 const look=()=>page.evaluate(()=>window.__cg.look());

 /* ---------------------------------------------------------------- 1. every discipline --- */
 /* Six sports, ten courses. The ids are the programme's own: h1/a1 show jumping, pp/r1 races,
    a2/x2 cross country, gt the seasonal gauntlet, d1/d2 dressage, s1 a showmanship class. */
 stage('every discipline');
 const KINDS=[['h1','show jumping'],['a1','show jumping, scored line'],['pp','race'],['r1','race, scored line'],
  ['a2','cross country'],['x2','cross country'],['gt','seasonal gauntlet'],['d1','dressage'],['d2','dressage'],['s1','showmanship']];
 const seen={};
 for(const [id,label] of KINDS){
  await page.evaluate(id=>window.__cg.start(id),id);
  const L=await look();
  seen[id]=L;
  /* The run has to have extent — a line, not a cluster — but two metres of it is a number this
     suite could only ever ask of a long leg. A judged class opens with the walk in from the start
     to A, which at the ranch's own arena is three metres end to end; take off the pad at the
     letter and the clearance the ride pass keeps under the horse and there are 1.45 m left to
     lay anything in. Asking for 2 m there is asking for arithmetic, not for a guide. So: two
     metres, or nearly half the leg when the leg is shorter than that. */
  const wantSpread=Math.min(2,(L.guide.legLen||0)*0.45);
  check('['+id+' · '+label+'] a run of chevrons is standing on the ground, pointing at the next obstacle',
   L.visible&&L.n>=3&&L.grounded&&L.monotone&&L.nearTarget<=2.6&&L.farTarget-L.nearTarget>=wantSpread,
   {chevrons:L.n,visible:L.visible,grounded:L.grounded,monotone:L.monotone,nearest:L.nearTarget,
    furthest:L.farTarget,spread:+(L.farTarget-L.nearTarget).toFixed(2),wanted:+wantSpread.toFixed(2),leg:L.guide.legLen});
  check('['+id+'] the far end of the line is at the rider, and the near end is the target',
   L.ringVisible&&L.farFromRider<=L.guide.spacing+1.4&&L.nearTarget<L.farTarget,
   {farFromRider:L.farFromRider,spacing:L.guide.spacing,ring:L.ringVisible});
  check('['+id+'] the floating arrow is untouched and still over the next obstacle',
   L.arrowVisible&&L.arrowOff<0.6&&L.arrowHeight>2,
   {visible:L.arrowVisible,offTarget:L.arrowOff,height:L.arrowHeight});
  check('['+id+'] #courseHud carries the distance to it, and the number is the real one',
   /📍\s*[\d.]+\s*m/.test(L.readout||'')&&Math.abs(parseFloat((L.readout||'').replace(/[^\d.]/g,''))-L.riderDist)<1.6,
   {readout:L.readout,realDistance:L.riderDist});
  await page.evaluate(()=>window.__cg.stop());
 }

 /* ---------------------------------------------------------------- 2. the scored line ---- */
 /* course-engine lays 24 markers along the current leg on a line:true event and charges a second
    for every two spent off it. A guide that routed straight at the fence would be telling the
    rider to pay for following it, so on those legs the chevrons must sit on that same segment. */
 stage('the scored line');
 for(const [id,label] of [['a1','show jumping'],['r1','race'],['a2','cross country']]){
  const r=await page.evaluate(id=>{
   const G=window.__features,Q=window.__cg;
   Q.start(id);
   const c=G.course.get(); const tries=Q.pass(); window.advanceTime(260);
   const L=c.ce&&c.ce.line?c.ce.line[c.idx]:null;
   const ch=Q.chevs();
   const out={idx:c.idx,tries,haveLine:!!L,tol:L?L.tol:null,n:ch.length,
    onScoredLine:JSON.parse(render_game_to_text()).guide.onScoredLine,
    markers:c.ce&&c.ce.lineMesh?c.ce.lineMesh.count:0};
   if(L)out.worst=+Math.max(...ch.map(q=>Q.segDist(q[0],q[2],L))).toFixed(2);
   Q.stop();
   return out;
  },id);
  check('['+id+' · '+label+'] past the first obstacle the guide rides course-engine\'s own scored line, inside its tolerance',
   r.idx>0&&r.haveLine&&r.n>=2&&r.onScoredLine&&r.worst<=r.tol,
   {leg:r.idx,attempts:r.tries,chevrons:r.n,worstOffLine:r.worst,tolerance:r.tol,engineMarkers:r.markers});
 }
 /* And where there is no scored line it is free to route straight to the thing. */
 const free=await page.evaluate(()=>{
  const G=window.__features,Q=window.__cg,p=G.horse.player;
  Q.start('h1'); const c=G.course.get(); const tries=Q.pass(); window.advanceTime(260);
  const ch=Q.chevs(), j=c.jumps[c.idx];
  const out={idx:c.idx,tries,n:ch.length,scored:JSON.parse(render_game_to_text()).guide.onScoredLine,
   line:!!(c.ce&&c.ce.line),
   straight:ch.every(q=>{const ax=j.x-p.pos.x,az=j.z-p.pos.z,l2=ax*ax+az*az||1;
    let t=((q[0]-p.pos.x)*ax+(q[2]-p.pos.z)*az)/l2;t=t<0?0:t>1?1:t;
    return Math.hypot(q[0]-(p.pos.x+ax*t),q[2]-(p.pos.z+az*t))<1.2;})};
  Q.stop(); return out;
 });
 check('an event with no scored line is routed straight from the rider to the obstacle',
  free.idx>0&&!free.line&&!free.scored&&free.n>=3&&free.straight,free);

 /* ---------------------------------------------------------------- 3. it follows along --- */
 stage('legs and laps');
 const legs=await page.evaluate(()=>{
  const G=window.__features,Q=window.__cg;
  Q.start('a1');
  const c=G.course.get(), out={targets:[],chevrons:[],tries:[]};
  for(let k=0;k<3;k++){
   const t=Q.target(); out.targets.push([+t[0].toFixed(1),+t[1].toFixed(1)]);
   out.chevrons.push(G.courseGuide.core.count);
   out.tries.push(Q.pass()); window.advanceTime(200);
  }
  out.finalTarget=Q.target().map(v=>+v.toFixed(1));
  out.idx=c.idx;
  Q.stop(); return out;
 });
 check('after each obstacle the line swings to the next one',
  legs.idx===3&&new Set(legs.targets.map(String)).size===3&&String(legs.finalTarget)!==String(legs.targets[2])
  &&legs.chevrons.every(n=>n>0),
  legs);
 const laps=await page.evaluate(()=>{
  const G=window.__features,Q=window.__cg;
  Q.start('h2');                                            // two laps of six fences
  const c=G.course.get(), n=c.jumps.length;
  const before={lap:c.ce.lap,target:Q.target().map(v=>+v.toFixed(1)),lays:G.courseGuide.STATS.lays};
  for(let i=0;i<n;i++){Q.pass();window.advanceTime(120);}
  window.advanceTime(200);
  const live=G.course.get();
  const after=live?{lap:live.ce.lap,idx:live.idx,target:Q.target().map(v=>+v.toFixed(1)),
   lays:G.courseGuide.STATS.lays,n:G.courseGuide.core.count,fence0:[+live.jumps[0].x.toFixed(1),+live.jumps[0].z.toFixed(1)]}:null;
  Q.stop(); return {before,after,jumps:n};
 });
 check('a lap rolls the line back to obstacle one instead of leaving it on the last fence',
  laps.after&&laps.after.lap===2&&laps.after.idx===0&&String(laps.after.target)===String(laps.after.fence0)&&laps.after.n>0
  &&laps.after.lays>laps.before.lays,
  laps);

 /* ---------------------------------------------------------------- 4. it goes away ------- */
 stage('fade in and out');
 const fadeIn=await page.evaluate(()=>{
  const G=window.__features,Q=window.__cg,CG=G.courseGuide;
  G.hidePanels(); G.course.startCourse(Q.ev('h1'),1);
  window.advanceTime(60); const early=+CG.fadeNow().toFixed(2);
  window.advanceTime(700); const full=+CG.fadeNow().toFixed(2);
  const opFull=+CG.mats.core.opacity.toFixed(2);
  return {early,full,opFull,visible:CG.core.visible};
 });
 /* The core's opacity breathes between 0.82 and 0.95 of full once it is up, which is why the
    floor here is 0.65 and not 0.94 — a tighter number would be testing the phase of a sine. */
 check('the line fades in over half a second rather than popping on',
  fadeIn.early>0.05&&fadeIn.early<0.5&&fadeIn.full===1&&fadeIn.opFull>0.65&&fadeIn.visible,fadeIn);
 const cancel=await page.evaluate(()=>{
  const G=window.__features,CG=G.courseGuide;
  G.course.cancelCourse();
  window.advanceTime(80); const mid={fade:+CG.fadeNow().toFixed(2),op:+CG.mats.core.opacity.toFixed(2),visible:CG.core.visible};
  window.advanceTime(700);
  const el=document.getElementById('cgDist');
  const gone={fade:CG.fadeNow(),count:CG.core.count,coreVisible:CG.core.visible,rimVisible:CG.rim.visible,
   ringVisible:CG.ring.visible,readout:el?el.style.display:'(no element)',guide:JSON.parse(render_game_to_text()).guide.on};
  return {mid,gone};
 });
 check('cancelling a course takes the line away — fading, then gone, with the readout hidden',
  cancel.mid.fade>0.1&&cancel.mid.fade<1&&cancel.gone.fade===0&&cancel.gone.count===0
  &&!cancel.gone.coreVisible&&!cancel.gone.rimVisible&&!cancel.gone.ringVisible
  &&cancel.gone.readout==='none'&&!cancel.gone.guide,cancel);
 const fin=await page.evaluate(async()=>{
  const G=window.__features,Q=window.__cg,CG=G.courseGuide;
  Q.start('h1'); const c=G.course.get();
  for(let i=0;i<c.jumps.length;i++){if(!G.course.get())break;Q.pass();window.advanceTime(60);}
  await new Promise(r=>setTimeout(r,200)); window.advanceTime(800);
  const el=document.getElementById('cgDist');
  const out={mode:JSON.parse(render_game_to_text()).mode,fade:CG.fadeNow(),count:CG.core.count,
   coreVisible:CG.core.visible,ringVisible:CG.ring.visible,readout:el?el.style.display:'(no element)'};
  G.hidePanels(); return out;
 });
 check('finishing a round takes it away too, and leaves nothing on screen',
  fin.mode==='free_roam'&&fin.fade===0&&fin.count===0&&!fin.coreVisible&&!fin.ringVisible&&fin.readout==='none',fin);

 /* ---------------------------------------------------------------- 5. first person ------- */
 /* In the saddle the floating cone is above the top of the screen for the last stretch of every
    approach, so the line on the ground is the only thing left saying where to go. What matters
    is not that every chevron is in shot — the eye is two metres up and the very nearest one is
    under the horse's nose, below the bottom of a 66° frame — but that the run reaches into the
    rider's view within a stride or two and carries on to the target. */
 stage('first person');
 const fp=await page.evaluate(()=>{
  const G=window.__features,Q=window.__cg,T=G.THREE,p=G.horse.player,CG=G.courseGuide;
  Q.start('a1');
  const t=Q.target(); p.heading=Math.atan2(t[0]-p.pos.x,t[1]-p.pos.z);    // harness: face the way a rider would
  G.course.setFP(true); window.advanceTime(1200);
  const cam=G.camera; cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const fr=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
  const inShot=q=>{const v=new T.Vector3(q[0],q[1],q[2]);return fr.containsPoint(v)&&v.clone().applyMatrix4(cam.matrixWorldInverse).z<0;};
  let seen=0,nearest=1e9;
  for(let i=0;i<CG.core.count;i++){const q=CG.chevronAt(i);
   if(q&&inShot(q)){seen++;nearest=Math.min(nearest,Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z));}}
  const far=CG.chevronAt(0);
  const out={mode:JSON.parse(render_game_to_text()).camera.mode,count:CG.core.count,inShot:seen,
   nearestInShot:nearest===1e9?null:+nearest.toFixed(2),targetInShot:!!far&&inShot(far),
   camY:+cam.position.y.toFixed(2),riderDist:+Math.hypot(p.pos.x-t[0],p.pos.z-t[1]).toFixed(1)};
  G.course.setFP(false); window.advanceTime(300); Q.stop();
  return out;
 });
 check('in first person the line is in shot a stride ahead of the horse and runs all the way to the target',
  fp.mode==='fp'&&fp.count>0&&fp.inShot>=3&&fp.nearestInShot<=8&&fp.targetInShot,fp);

 /* ---------------------------------------------------------------- 6. collisions --------- */
 stage('collisions');
 const coll=await page.evaluate(()=>{
  const G=window.__features,CG=G.courseGuide,out={};
  out.installed=G.installed.includes('course-guide');
  out.errors=(G.errors||[]).filter(e=>e&&e.id==='course-guide');
  /* one arrow in the whole game, and it is not one of ours */
  out.oneArrow=!!(G.trail&&G.trail.arrow===G.course.arrow);
  out.notOurs=CG.core!==G.course.arrow&&CG.rim!==G.course.arrow&&CG.ring!==G.course.arrow;
  out.instanced=!!(CG.core.isInstancedMesh&&CG.rim.isInstancedMesh);
  /* the readout is a second span inside the game's own course HUD, not a floating box of its own */
  const el=document.getElementById('cgDist');
  out.inHud=!!(el&&el.parentElement&&el.parentElement.id==='courseHud');
  out.hudSiblings=el&&el.parentElement?[...el.parentElement.children].map(c=>c.id||c.tagName):null;
  /* two-tone, so the ribbon carries its own contrast onto snow, ochre and autumn leaves alike */
  const lum=c=>0.21*c.r+0.72*c.g+0.07*c.b;
  out.rimLum=+lum(CG.mats.rim.color).toFixed(3);
  const col=CG.core.instanceColor, first={r:col.getX(0),g:col.getY(0),b:col.getZ(0)};
  out.coreNearLum=+lum(first).toFixed(3);
  out.toneMapped=CG.mats.core.toneMapped||CG.mats.rim.toneMapped;
  return out;
 });
 check('the package is installed and recorded no error',coll.installed&&coll.errors.length===0,coll.errors);
 check('the golden arrow is still the only one, and none of it belongs to this package',
  coll.oneArrow&&coll.notOurs&&coll.instanced,coll);
 check('the distance sits inside the game\'s own #courseHud rather than in chrome of its own',
  coll.inHud,{siblings:coll.hudSiblings});
 check('the chevron is two-tone — a dark rim under a bright core — so no biome can swallow it',
  coll.rimLum<0.05&&coll.coreNearLum>0.55&&!coll.toneMapped,
  {rimLuminance:coll.rimLum,coreLuminance:coll.coreNearLum,toneMapped:coll.toneMapped});

 /* ---------------------------------------------------------------- 7. it never drives ---- */
 /* Another package marshals the rider to the start box. Two packages moving one horse is the
    collision this codebase keeps producing, so the guide must move nothing at all. */
 stage('it never moves the horse');
 const still=await page.evaluate(()=>{
  const G=window.__features,Q=window.__cg,p=G.horse.player,CG=G.courseGuide;
  Q.start('a1');
  const t=Q.target();
  p.pos.set(t[0]-40,0,t[1]+34); p.speed=0; p.heading=1.234;   // deliberately nowhere near the line
  const before={x:+p.pos.x.toFixed(3),z:+p.pos.z.toFixed(3),h:+p.heading.toFixed(3),s:+p.speed.toFixed(3)};
  window.advanceTime(2000);
  const after={x:+p.pos.x.toFixed(3),z:+p.pos.z.toFixed(3),h:+p.heading.toFixed(3),s:+p.speed.toFixed(3)};
  const out={before,after,chevrons:CG.core.count,lays:CG.STATS.lays};
  Q.stop(); return out;
 });
 check('the guide draws a line to a rider standing forty metres off it and never moves her',
  still.before.x===still.after.x&&still.before.z===still.after.z&&still.before.h===still.after.h&&still.chevrons>0,
  still);

 /* ---------------------------------------------------------------- 8. no per-frame work -- */
 /* Every matrix this package writes is written inside one function, and that function bumps
    STATS.lays. An InstancedBufferAttribute's version bumps once per needsUpdate. If the two
    deltas are equal over four seconds of riding then nothing was composed per frame. */
 stage('allocation');
 const alloc=await page.evaluate(()=>{
  const G=window.__features,Q=window.__cg,p=G.horse.player,CG=G.courseGuide;
  Q.start('r1');
  const g0=CG.core.geometry, a0=CG.core.instanceMatrix, geo0=G.renderer.info.memory.geometries;
  const lays0=CG.STATS.lays, ver0=CG.core.instanceMatrix.version;
  const t=Q.target(); const dx=t[0]-p.pos.x, dz=t[1]-p.pos.z, L=Math.hypot(dx,dz)||1;
  let frames=0;
  for(let i=0;i<240;i++){p.pos.x+=dx/L*0.08;p.pos.z+=dz/L*0.08;p.speed=8;window.advanceTime(16);frames++;}
  const out={frames,lays:CG.STATS.lays-lays0,version:CG.core.instanceMatrix.version-ver0,
   sameGeometry:CG.core.geometry===g0,sameAttribute:CG.core.instanceMatrix===a0,
   rendererGeometries:G.renderer.info.memory.geometries-geo0,chevrons:CG.core.count};
  Q.stop(); return out;
 });
 check('four seconds of riding composes no geometry and no matrices beyond the lays it declares',
  alloc.sameGeometry&&alloc.sameAttribute&&alloc.version===alloc.lays&&alloc.lays<=3&&alloc.frames===240,
  alloc);

 /* ---------------------------------------------------------------- 9. frame time --------- */
 /* The same race, framed twice through the real animation loop, with the ribbon on and off.
    tools/qa-horse-performance.cjs's method: 150 rAF spans after thirty frames of warm-up.

    The rider is parked, and that is the whole point. An earlier version of this held the gallop
    down through both runs, which meant the two runs were looking at different parts of the
    valley by the time they were measured and reported a 16.7/33.3 split that was the scenery,
    not the ribbon — the same shape of mistake as timing against a control that never started.
    Standing still on a sixty-metre leg puts the whole run of chevrons across the screen and
    renders the identical picture in both halves of the pair, so the only difference left is the
    thing being measured. The moving case is covered by the stepped measure below, which nudges
    the rider by the same amount in both runs. */
 stage('frame time');
 async function ride(on){
  await page.evaluate(on=>{
   const G=window.__features,Q=window.__cg,p=G.horse.player;
   Q.stop(); G.courseGuide.setEnabled(on);
   Q.start('r1',4400);
   const t=Q.target();
   p.pos.set(t[0]-60,0,t[1]); p.heading=Math.atan2(t[0]-p.pos.x,t[1]-p.pos.z); p.speed=0;
   window.advanceTime(700);
   window.resumeGame();
  },on);
  const t=await page.evaluate(()=>new Promise(resolve=>{
   const spans=[];let last=performance.now(),warmup=30;
   function frame(now){if(warmup>0)warmup--;else spans.push(now-last);last=now;
    if(spans.length<150)requestAnimationFrame(frame);
    else{spans.sort((a,b)=>a-b);resolve({medianMs:+spans[75].toFixed(2),p95Ms:+spans[142].toFixed(2),frames:spans.length});}}
   requestAnimationFrame(frame);
  }));
  const after=await page.evaluate(()=>{
   const G=window.__features, st=JSON.parse(render_game_to_text());
   return {mode:st.mode,chevrons:st.guide?st.guide.chevrons:0,on:st.guide?st.guide.on:false,
    calls:G.renderer.info.render.calls,lays:G.courseGuide.STATS.lays};
  });
  return Object.assign(t,after);
 }
 await ride(true);                                          // a warm-up run, thrown away
 const ON=[],OFF=[];
 for(let i=0;i<3;i++){ON.push(await ride(true));OFF.push(await ride(false));}
 console.log('   rAF frame spans — on  '+JSON.stringify(ON.map(r=>[r.medianMs,r.p95Ms]))+' draw calls '+JSON.stringify(ON.map(r=>r.calls)));
 console.log('   rAF frame spans — off '+JSON.stringify(OFF.map(r=>[r.medianMs,r.p95Ms]))+' draw calls '+JSON.stringify(OFF.map(r=>r.calls)));
 /* A control run that never started passes against nothing: every run has to have been a live
    course, and the guide has to have been drawing in one set and not in the other. */
 check('the timing runs are real — every run rode the course, the guide drew in one set and not the other',
  ON.every(r=>r.mode==='course'&&r.chevrons>0&&r.on)&&OFF.every(r=>r.mode==='course'&&r.chevrons===0&&!r.on),
  {on:ON.map(r=>[r.mode,r.chevrons]),off:OFF.map(r=>[r.mode,r.chevrons])});
 /* A frame the compositor holds for vsync can be stretched by anything else on the machine and
    never squeezed, so the least-disturbed run of each set is the honest reading of the pair. */
 const medOn=Math.min(...ON.map(r=>r.medianMs)), medOff=Math.min(...OFF.map(r=>r.medianMs));
 const p95On=Math.min(...ON.map(r=>r.p95Ms)), p95Off=Math.min(...OFF.map(r=>r.p95Ms));
 check('the numbers came off a GPU, not the software rasteriser',medOn<100&&medOff<100,
  {medianOn:medOn,medianOff:medOff,note:'thousands of ms means SwiftShader and this whole section is meaningless'});
 check('on the real animation loop the guide costs no measurable frame time',
  medOn<=medOff+1.5&&p95On<=p95Off+6,
  {medianOn:medOn,medianOff:medOff,p95On:p95On,p95Off:p95Off});
 /* And the same question again with vsync taken out of it, and with the rider moving. advanceTime
    steps the simulation and renders without waiting for a frame, so 300 of them measure what a
    frame actually costs rather than how long the compositor held it — which is the only way a few
    hundred microseconds of ribbon could show up at all. The nudge is the same arithmetic in both
    halves of the pair, so the re-laying a drifting rider provokes is inside the measurement
    without the two runs ever looking at different scenery. */
 stage('frame cost off the vsync clock');
 async function stepped(on){
  return page.evaluate(on=>{
   const G=window.__features,Q=window.__cg,p=G.horse.player;
   Q.stop(); G.courseGuide.setEnabled(on); Q.start('r1',4400);
   const t=Q.target(); const sx=t[0]-60, sz=t[1];
   p.pos.set(sx,0,sz); p.heading=Math.atan2(t[0]-sx,t[1]-sz); p.speed=0;
   window.advanceTime(500);
   const dx=(t[0]-sx)/60, dz=(t[1]-sz)/60;               // a sixtieth of the leg, then a drift across it
   const step=i=>{p.pos.x=sx+dx*i*0.12+Math.sin(i*0.07)*2.2;p.pos.z=sz+dz*i*0.12+Math.cos(i*0.07)*2.2;p.speed=8;window.advanceTime(16);};
   for(let i=0;i<60;i++)step(i);
   const t0=performance.now();
   for(let i=60;i<360;i++)step(i);
   return {msPerFrame:+((performance.now()-t0)/300).toFixed(3),chevrons:G.courseGuide.core.count,
    on:G.courseGuide.isOn(),lays:G.courseGuide.STATS.lays};
  },on);
 }
 await stepped(true);                                      // warm-up
 const sON=[],sOFF=[];
 for(let i=0;i<4;i++){sON.push(await stepped(true));sOFF.push(await stepped(false));}
 await page.evaluate(()=>{const G=window.__features;G.courseGuide.setEnabled(true);window.__cg.stop();});
 const ms=a=>a.map(r=>r.msPerFrame).sort((x,y)=>x-y), mid=a=>a[Math.floor(a.length/2)];
 const on=ms(sON), off=ms(sOFF);
 console.log('   stepped ms/frame — on  '+JSON.stringify(on)+' lays '+JSON.stringify(sON.map(r=>r.lays)));
 console.log('   stepped ms/frame — off '+JSON.stringify(off));
 /* This measure has a spread of about a millisecond run to run on a machine with anything else
    happening on it, so a tenth of a frame is the tightest honest threshold — and the spread is
    printed beside the delta so a reader can see which of the two is bigger. */
 const delta=mid(on)-mid(off), spread=Math.max(on[on.length-1]-on[0],off[off.length-1]-off[0]);
 check('with vsync out of the way, and the rider drifting across the leg, the ribbon costs under a tenth of a frame',
  sON.every(r=>r.chevrons>0)&&sOFF.every(r=>r.chevrons===0)&&delta<1.5,
  {onMedian:mid(on),offMedian:mid(off),delta:+delta.toFixed(3),runToRunSpread:+spread.toFixed(3),
   chevronsDrawn:sON[0].chevrons,relays:sON.map(r=>r.lays)});

 /* ---------------------------------------------------------------- 10. errors ------------ */
 check('no console or page errors',errors.length===0,errors.slice(0,5));

 const bad=checks.filter(c=>!c.ok);
 console.log('');
 console.log(bad.length?('FAILED '+bad.length+'/'+checks.length+' in '+((Date.now()-t0)/1000).toFixed(1)+'s')
  :('ALL '+checks.length+' CHECKS PASSED in '+((Date.now()-t0)/1000).toFixed(1)+'s'));
 await browser.close();
 process.exit(bad.length?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
