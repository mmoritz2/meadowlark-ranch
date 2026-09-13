/* Feature package 'events2-disciplines' — the start line, headless verification.

   Boots ranch3d.html?qa=start-line, waits for the horse, then enters EVERY kind of event in the
   game from the ranch yard and asserts what a PLAYER would see: where the rider is standing when
   the countdown begins, which way she is pointing, the start box standing on the ground under
   her, that the ground is ground and not the river or the inside of a barn, and the line of text
   on screen telling her where she has been taken. Nothing here asks whether a function exists.

   Usage:  QA_URL=http://127.0.0.1:8601 NODE_PATH=$(npm root -g) node tools/qa-start-line.cjs */
const {chromium}=require('playwright');
const QA=require('./qa-platform.cjs');   // the backend comes from the platform, never baked in
const base=(process.env.QA_URL||'http://127.0.0.1:8601').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=start-line&fresh='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();

(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling',QA.ANGLE,'--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})(),null,{timeout:180000,polling:250});
 stage('horseReady');

 await page.evaluate(()=>{
  const G=window.__features;
  /* #toasts only holds the one on screen and the queue drains on real timers, so keep them all */
  window.__toasts=[]; const t0=G.toast; G.toast=m=>{window.__toasts.push(String(m));return t0(m);};
  /* A horse good enough to be let into every class, and a ribbon at every venue, so no entry gate
     masks a discipline — the Championship Final will not take an entry until the four towns have
     signed you off, and a start line you cannot reach proves nothing. */
  G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];h.level=14;h.stats=h.stats||{};for(const k of G.tables.STAT_KEYS)h.stats[k]=10;h.bond=95;h.needs=h.needs||{};h.needs.clean=100;
   s.ribbons=s.ribbons||{}; for(const e of G.tables.EVENTS3)if(!e.champ)s.ribbons[e.id]=Math.max(s.ribbons[e.id]||0,3);
   if((s.horses||[]).filter(x=>!x.egg&&!x.foal).length<2)G.horse.grantHorse(s,'bay',{name:'Shadow',src:'qa'});
   const mate=(s.horses||[]).map((x,i)=>({x,i})).filter(o=>o.i!==G.horse.rideIdx()&&!o.x.egg)[0];
   if(mate)mate.x.out=true;});
  G.horse.reloadHorses();
  const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
  const YARD=[-7,9];                                     // where a rider actually stands when she opens 🏆 Events
  window.__sl={
   wrap,YARD,
   ev:id=>G.tables.EVENTS3.find(e=>e.id===id),
   list:()=>G.tables.EVENTS3.map(e=>({id:e.id,town:e.town,disc:e.disc,at:e.at?e.at.slice():null})),
   /* Enter one event from `from` and photograph the moment the countdown starts. */
   async enter(id,opts){
    opts=opts||{};
    const p=G.horse.player, W=G.world, out={id};
    if(G.course.get())G.course.cancelCourse();
    window.advanceTime(60);
    window.__toasts.length=0;
    const from=opts.from||YARD;
    p.pos.set(from[0],0,from[1]); p.speed=0; p.heading=0; p.y=0; p.vy=0; p.flying=!!opts.flying;
    out.from=from.slice();
    /* the vehicle flag is set and cleared without a frame in between, so no vehicle tick runs */
    if(opts.veh)try{G.worldPkg.veh={kind:'balloon',t:0,dur:45};}catch(e){}
    try{G.course.startCourse(window.__sl.ev(id),1);}catch(e){out.threw=String(e&&e.message||e);}
    if(opts.veh)try{G.worldPkg.veh=null;}catch(e){}
    p.flying=false;
    const c=G.course.get();
    out.started=!!c;
    out.pos=[+p.pos.x.toFixed(2),+p.pos.z.toFixed(2)];
    out.heading=+p.heading.toFixed(3);
    out.moveddist=+Math.hypot(p.pos.x-from[0],p.pos.z-from[1]).toFixed(1);
    const st=JSON.parse(render_game_to_text()).ev2||{};
    out.start=st.start||null; out.startBox=!!st.startBox; out.fx=!!st.fx; out.disc=st.disc||null;
    out.toasts=window.__toasts.slice();
    /* the box itself, as it stands in the scene: eleven white members and one 🏁 START sprite —
       and it is one mesh for the life of the page, so count every one the scene is carrying */
    out.boxes=G.scene.children.filter(o=>o.userData&&o.userData.ev2StartBox).length;
    const g=G.events2.startBox&&G.events2.startBox();
    if(g){let sprites=0,meshes=0;g.traverse(o=>{if(o.isSprite)sprites++;if(o.isMesh)meshes++;});
     out.box={x:+g.position.x.toFixed(2),y:+g.position.y.toFixed(2),z:+g.position.z.toFixed(2),
      rotY:+g.rotation.y.toFixed(3),sprites,meshes,inScene:g.parent===G.scene,visible:g.visible};
     out.boxOffRider=+Math.hypot(g.position.x-p.pos.x,g.position.z-p.pos.z).toFixed(2);}
    else out.box=null;
    /* Can she actually RIDE to it? This suite measured where she was put and never whether she
       could leave, which is how a start line outside the arena's own rail passed ninety-five
       checks while the horse stalled against it with the clock running. Walk the straight line
       and count walls standing across it, ignoring the last 3.5 m, which is the obstacle's own
       footprint. Walls only: a rail spans the whole approach, a collider is gone round. */
    const wallsAcross=(tx,tz)=>{ const W2=G.world; const d=Math.hypot(tx-p.pos.x,tz-p.pos.z);
     if(!(d>0.01))return 0; const stop=Math.max(0,d-3.5), n=Math.max(4,Math.ceil(stop/1.2)); let hit=0;
     for(let i=1;i<=n;i++){ const f=(stop/d)*(i/n), x=p.pos.x+(tx-p.pos.x)*f, z=p.pos.z+(tz-p.pos.z)*f;
      for(const w of (W2.walls||[])){ const dx=w.x2-w.x1,dz=w.z2-w.z1,l2=dx*dx+dz*dz;
       let t=l2>0?((x-w.x1)*dx+(z-w.z1)*dz)/l2:0; t=t<0?0:t>1?1:t;
       if(Math.hypot(x-(w.x1+dx*t),z-(w.z1+dz*t))<1.0){hit++;break;} } }
     return hit; };
    /* the obstacle she is pointed at */
    if(c&&c.jumps&&c.jumps.length){
     const j=c.jumps[0], d=Math.hypot(p.pos.x-j.x,p.pos.z-j.z);
     out.j0=[+j.x.toFixed(2),+j.z.toFixed(2),+j.rotY.toFixed(3)];
     out.distJ0=+d.toFixed(2);
     out.square=+Math.abs(wrap(p.heading-j.rotY)).toFixed(3);
     out.facing=d>0.01?+((Math.sin(p.heading)*(j.x-p.pos.x)+Math.cos(p.heading)*(j.z-p.pos.z))/d).toFixed(3):0;
     /* how far off the middle of the fence she is, measured along its own rails: a fence is
        3.2 m wide, so anything under 1.6 has her between the wings */
     out.offLine=+Math.abs((j.x-p.pos.x)*Math.cos(j.rotY)-(j.z-p.pos.z)*Math.sin(j.rotY)).toFixed(2);
     out.blockedJ0=wallsAcross(j.x,j.z);
     out.nearOther=c.jumps.length>1?+Math.min.apply(null,c.jumps.slice(1).map(q=>Math.hypot(p.pos.x-q.x,p.pos.z-q.z))).toFixed(2):999;
    }
    /* or the letters she is pointed down */
    if(c&&c.dressage){
     const AL=G.course.ARENA_LETTERS, A=AL.A, C=AL.C;
     out.A=A.slice(); out.C=C.slice();
     out.distA=+Math.hypot(p.pos.x-A[0],p.pos.z-A[1]).toFixed(2);
     out.distC=+Math.hypot(p.pos.x-C[0],p.pos.z-C[1]).toFixed(2);
     out.blockedA=wallsAcross(A[0],A[1]);
     out.AC=+Math.hypot(C[0]-A[0],C[1]-A[1]).toFixed(2);
     const ac=Math.atan2(C[0]-A[0],C[1]-A[1]);
     out.square=+Math.abs(wrap(p.heading-ac)).toFixed(3);
     out.offLine=+Math.abs((A[0]-p.pos.x)*Math.cos(ac)-(A[1]-p.pos.z)*Math.sin(ac)).toFixed(2);
     out.letters=c.letters?c.letters.length:0;
     out.fig0=c.figs&&c.figs[0]?c.figs[0].at:null;
    }
    /* the ground she was put on, measured with the world's own numbers rather than the package's */
    const x=p.pos.x,z=p.pos.z,h=W.groundH(x,z);
    out.groundY=+h.toFixed(2);
    out.river=+Math.abs(z-W.riverZ(x)).toFixed(2);
    out.lake=+Math.hypot(x-20,z-16).toFixed(2);
    out.creek=z<163?+Math.abs(x-W.streamX(z)).toFixed(2):999;
    out.inCollider=(W.colliders||[]).filter(col=>Math.hypot(x-col.x,z-col.z)<col.r+0.4).length;
    out.onWall=(W.walls||[]).filter(w=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,l2=dx*dx+dz*dz;let t=l2>0?((x-w.x1)*dx+(z-w.z1)*dz)/l2:0;t=t<0?0:t>1?1:t;
     return Math.hypot(x-(w.x1+dx*t),z-(w.z1+dz*t))<0.9;}).length;
    out.slope=+Math.max.apply(null,[[3,0],[-3,0],[0,3],[0,-3]].map(d=>Math.abs(W.groundH(x+d[0],z+d[1])-h))).toFixed(2);
    if(out.box)out.boxOnGround=+Math.abs(out.box.y-W.groundH(out.box.x,out.box.z)).toFixed(3);
    /* and the screen */
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const call=document.getElementById('ev2Call'), hud=document.getElementById('courseHud');
    const sheet=document.getElementById('ev2SheetPanel');
    out.sheetShown=!!(sheet&&getComputedStyle(sheet).display!=='none');
    out.callShown=!!(call&&getComputedStyle(call).display!=='none');
    out.call=call?(call.textContent||'').replace(/\s+/g,' ').trim():'';
    out.hudShown=!!(hud&&getComputedStyle(hud).display!=='none');
    return out;
   },
  };
 });
 const enter=(id,opts)=>page.evaluate(a=>window.__sl.enter(a.id,a.opts),{id,opts:opts||null});
 const lined=r=>(r.toasts||[]).some(t=>/^🏁 Lined up at /.test(t));
 const linedAt=(r,town)=>(r.toasts||[]).some(t=>t.indexOf('🏁 Lined up at '+town)===0);
 /* one measurement, reused: was she carried, is she square, is the box under her, is it ground */
 function landing(name,r,opts){
  opts=opts||{};
  check(name+' — carried to the line and told about it',
   r.started&&r.moveddist>12&&lined(r),
   {moved:r.moveddist,pos:r.pos,toast:(r.toasts||[]).filter(t=>/Lined up/.test(t))[0]||null});
  check(name+' — a start box is standing on the ground under her, and it is the only one in the scene',
   !!r.box&&r.boxes===1&&r.box.inScene&&r.box.visible&&r.box.sprites===1&&r.box.meshes>=10
   &&r.boxOffRider<1.2&&r.boxOnGround<0.01&&Math.abs(r.box.rotY-r.heading)<0.02,
   {box:r.box,boxes:r.boxes,off:r.boxOffRider,onGround:r.boxOnGround});
  check(name+' — the ground she is on is ground: out of the water, clear of colliders and walls, not a cliff',
   r.river>6&&r.lake>7&&r.creek>4&&r.inCollider===0&&r.onWall===0&&r.slope<3,
   {river:r.river,lake:r.lake,creek:r.creek,collider:r.inCollider,wall:r.onWall,slope:r.slope});
  if(opts.obstacle){
   /* Ten metres is the ideal, not the invariant. Inside a railed arena there is often nowhere
      further back to stand, and a line four metres out that she can ride from beats a textbook
      one on the wrong side of a rail — which is exactly what this check used to wave through.
      So: square, on the approach, far enough to get going, and NOTHING standing across the run. */
   check(name+' — behind the first obstacle, square to it, on its approach, with a clear run to it',
    r.distJ0>=3&&r.distJ0<=24&&r.square<0.02&&r.offLine<=6.1&&r.blockedJ0===0,
    {dist:r.distJ0,squareErr:r.square,offCentre:r.offLine,facing:r.facing,wallsAcross:r.blockedJ0});
   check(name+' — the box is not planted on top of another obstacle',
    r.nearOther>=5,{nearest:r.nearOther});
  }
  check(name+' — the countdown names the venue on screen',
   r.callShown&&r.hudShown&&r.call.indexOf(opts.town||'')>=0,
   {shown:r.callShown,hud:r.hudShown,call:(r.call||'').slice(0,110)});
 }

 /* ---------------------------------------------------------------- 0. the programme ----- */
 const prog=await page.evaluate(()=>window.__sl.list());
 const byDisc={}; for(const e of prog)byDisc[e.disc]=(byDisc[e.disc]||[]).concat(e.id);
 check('every discipline the game has is on the programme and about to be tested',
  ['jump','xc','race','dressage','show','gauntlet'].every(k=>(byDisc[k]||[]).length),byDisc);

 /* ---------------------------------------------------------------- 0b. on the screen ---- */
 /* Toasts queue and drain on real timers, one at a time, so this is done first: after ninety
    course starts the backlog would be minutes long and this would be reading the boot notices. */
 stage('the line reaches the screen');
 await enter('h1');
 const onScreen=await page.waitForFunction(()=>{
  const t=document.getElementById('toasts');
  /* the HUD skin lifts the leading emoji into its own element, so the space after it is gone
     from textContent — match the words, not the spacing */
  return !!(t&&/🏁\s*Lined up at Cottonwood/.test(t.textContent||''));
 },null,{timeout:120000,polling:200}).then(()=>true).catch(()=>false);
 const toastText=await page.evaluate(()=>((document.getElementById('toasts')||{}).textContent||'').trim());
 check('the line actually reaches the toast on screen, not just the queue',onScreen,toastText);

 /* ---------------------------------------------------------------- 1. show jumping ------ */
 stage('show jumping');
 const h1=await enter('h1');
 landing('show jumping · Cottonwood Welcome Jump',h1,{obstacle:true,town:'Cottonwood'});
 check('show jumping · the hack across the valley is gone: the yard is 100 m+ from the line',
  h1.moveddist>100&&linedAt(h1,'Cottonwood')&&/first fence is ahead/.test((h1.toasts||[]).join('|')),
  {from:h1.from,to:h1.pos,moved:h1.moveddist});
 const w2=await enter('w2');
 landing('show jumping · Basin Championship Final (12 fences, Hollowpeak)',w2,{obstacle:true,town:'Hollowpeak'});
 const tc=await enter('tc');
 landing('show jumping · Twilight Cup (the ranch arena)',tc,{obstacle:true,town:'Kestrel Basin'});

 /* ---------------------------------------------------------------- 2. races ------------- */
 stage('races');
 const pp=await enter('pp');
 landing('race · Pasture Pony Dash',pp,{obstacle:true,town:'Meadowlark Ranch'});
 /* the race start is the one this file already shipped and it must not have moved: ten metres
    back on gate one's own approach line, or — if the valley scattered a tree onto that spot this
    boot — further back along the very same line, never off to the side of it */
 check('race · the start is still the ten metres behind gate one it always was',
  (Math.abs(pp.distJ0-10)<0.6||(pp.distJ0>10&&pp.offLine<=1.6))&&/first gate is ahead/.test((pp.toasts||[]).join('|')),
  {dist:pp.distJ0,offCentre:pp.offLine});
 const r1=await enter('r1');
 landing('race · Kestrel Grand Loop',r1,{obstacle:true,town:'Kestrel Basin'});
 const bd=await enter('bd');
 landing('race · Coyote Desert Derby',bd,{obstacle:true,town:'Coyote'});
 const wt=await enter('wt');
 landing('race · Hollowpeak Snow Trail',wt,{obstacle:true,town:'Hollowpeak'});

 /* ---------------------------------------------------------------- 3. cross country ----- */
 stage('cross country');
 const a2=await enter('a2');
 landing('cross country · Barleyfold Cross Country',a2,{obstacle:true,town:'Barleyfold'});
 check('cross country · Barleyfold no longer begins 217 units from its first gate',
  a2.distJ0<17&&/first obstacle is ahead/.test((a2.toasts||[]).join('|')),{dist:a2.distJ0});
 const x2=await enter('x2');
 landing('cross country · Hollowpeak Ridge Chase',x2,{obstacle:true,town:'Hollowpeak'});

 /* ---------------------------------------------------------------- 4. the gauntlet ------ */
 stage('gauntlet');
 const gt=await enter('gt');
 landing('gauntlet · the seasonal trial',gt,{obstacle:true,town:'Meadowlark Ranch'});
 check('gauntlet · the line is at the first element of this season\'s own route, and the décor is still laid',
  /first element is ahead/.test((gt.toasts||[]).join('|'))&&gt.fx,
  {toast:(gt.toasts||[]).filter(t=>/Lined up/.test(t))[0]||null,dist:gt.distJ0});

 /* ---------------------------------------------------------------- 5. dressage ---------- */
 stage('dressage');
 const dressIds=prog.filter(e=>e.disc==='dressage').map(e=>e.id);
 const d1=await enter('d1');
 landing('dressage · Cottonwood Preliminary Test',d1,{town:'Cottonwood'});
 check('dressage · she is put outside A on the centre line, facing C',
  d1.distA>=6&&d1.distA<=20&&d1.square<0.02&&d1.offLine<=6.1&&d1.distC>d1.AC,
  {A:d1.A,C:d1.C,distA:d1.distA,distC:d1.distC,AC:d1.AC,squareErr:d1.square,offCentre:d1.offLine});
 check('dressage · the opening figure is not handed to her: A is further than the 3.5 m a figure closes at',
  d1.fig0==='A'&&d1.distA>3.5,{fig0:d1.fig0,distA:d1.distA});
 check('dressage · the letters travelled to Cottonwood and she was taken to the letters, not to the ranch',
  Math.hypot(d1.A[0]-2,d1.A[1]+15)>20&&d1.letters>=9,{A:d1.A,letters:d1.letters});
 const d2=await enter('d2');
 landing('dressage · Basin Freestyle (the ranch arena, which never moves)',d2,{town:'Kestrel Basin'});
 check('dressage · the home arena test lines up at the home A',
  Math.hypot(d2.A[0]-2,d2.A[1]+15)<0.1&&d2.distA>=2.5&&d2.distA<=20&&d2.square<0.02&&d2.offLine<=6.1&&d2.blockedA===0,
  {A:d2.A,distA:d2.distA,squareErr:d2.square,offCentre:d2.offLine,wallsAcross:d2.blockedA});
 const dExtra=dressIds.filter(id=>id!=='d1'&&id!=='d2');
 const dRest=[]; for(const id of dExtra)dRest.push(await enter(id));
 check('dressage · every other test in the programme lines up outside its own A too',
  dRest.length>0&&dRest.every(r=>r.started&&r.distA>=2.5&&r.distA<=21&&r.square<0.02&&r.offLine<=6.1&&r.inCollider===0&&r.river>6&&r.blockedA===0&&lined(r)),
  dRest.map(r=>({id:r.id,distA:r.distA,sq:r.square,off:r.offLine,coll:r.inCollider,river:r.river,wallsAcross:r.blockedA})));

 /* ---------------------------------------------------------------- 6. showmanship ------- */
 stage('showmanship');
 const showIds=prog.filter(e=>e.disc==='show').map(e=>e.id);
 const s1=await enter('s1');
 landing('showmanship · Cottonwood Showmanship',s1,{town:'Cottonwood'});
 check('showmanship · she is stood outside A facing the judge at C, and told so',
  s1.distA>=6&&s1.distA<=20&&s1.square<0.02&&s1.offLine<=6.1&&s1.distC>s1.AC&&/the judge is waiting at C/.test((s1.toasts||[]).join('|')),
  {distA:s1.distA,squareErr:s1.square,offCentre:s1.offLine,toast:(s1.toasts||[]).filter(t=>/Lined up/.test(t))[0]||null});
 check('showmanship · the turnout is still taken and the judge\'s card is on screen behind the line',
  (s1.toasts||[]).some(t=>/^🧼 Turnout/.test(t))&&s1.sheetShown,
  {sheet:s1.sheetShown,toasts:(s1.toasts||[]).slice(0,4)});
 const sRest=[]; for(const id of showIds.filter(i=>i!=='s1'))sRest.push(await enter(id));
 check('showmanship · Barleyfold and Hollowpeak line up at their own arenas, on solid ground',
  sRest.length>=2&&sRest.every(r=>r.started&&r.distA>=6&&r.distA<=21&&r.square<0.02&&r.offLine<=6.1&&r.inCollider===0&&r.onWall===0&&r.river>6&&r.slope<3&&lined(r)),
  sRest.map(r=>({id:r.id,pos:r.pos,distA:r.distA,off:r.offLine,coll:r.inCollider,slope:r.slope})));

 /* ---------------------------------------------------------------- 7. every venue ------- */
 stage('every venue');
 const all=[h1,w2,tc,pp,r1,bd,wt,a2,x2,gt,d1,d2,s1].concat(dRest,sRest);
 const towns={}; for(const r of all)if(r.started)towns[(prog.find(e=>e.id===r.id)||{}).town]=true;
 check('every town that hosts an event was entered and landed on standable ground',
  ['Cottonwood','Barleyfold','Coyote','Hollowpeak','Kestrel Basin','Meadowlark Ranch'].every(t=>towns[t])
  &&all.every(r=>r.started&&r.inCollider===0&&r.onWall===0&&r.river>6&&r.lake>7&&r.creek>4&&r.slope<3),
  {towns:Object.keys(towns),bad:all.filter(r=>r.inCollider||r.onWall||r.river<=6||r.lake<=7||r.creek<=4||r.slope>=3).map(r=>({id:r.id,pos:r.pos,coll:r.inCollider,wall:r.onWall,river:r.river,slope:r.slope}))});
 /* stepping off the line is the last thing the search spends, so it should be spending it almost
    never: a valley that needed it on half the programme would mean the ideal is wrong */
 check('the line is what she is given: all but a couple of the programme start dead on the approach',
  all.filter(r=>r.offLine!=null&&r.offLine<0.01).length>=all.length-2,
  all.map(r=>({id:r.id,off:r.offLine})).filter(r=>!(r.off<0.01)));
 check('every event in the programme carried her and built exactly one start box',
  all.every(r=>r.started&&lined(r)&&r.boxes===1&&r.startBox),
  all.filter(r=>!(r.started&&lined(r)&&r.boxes===1)).map(r=>({id:r.id,boxes:r.boxes,started:r.started})));

 /* ---------------------------------------------------------------- 8. the guards -------- */
 stage('guards');
 const guards=await page.evaluate(async()=>{
  const G=window.__features,S=window.__sl,p=G.horse.player,out={};
  /* already at the line: she is not shuffled two metres sideways for the sake of it */
  const first=await S.enter('pp');
  const at=first.pos.slice();
  const near=await S.enter('pp',{from:[at[0]+4,at[1]+3]});
  out.nearPos=near.pos.slice(); out.nearFrom=[at[0]+4,at[1]+3];
  out.nearMoved=near.moveddist; out.nearToast=(near.toasts||[]).some(t=>/Lined up/.test(t));
  out.nearBox=!!near.box;
  /* flying on purpose */
  const fly=await S.enter('pp',{flying:true});
  out.flyMoved=fly.moveddist; out.flyToast=(fly.toasts||[]).some(t=>/Lined up/.test(t)); out.flyBox=!!fly.box;
  /* a passenger on the balloon is not the one steering */
  const veh=await S.enter('pp',{veh:true});
  out.vehMoved=veh.moveddist; out.vehToast=(veh.toasts||[]).some(t=>/Lined up/.test(t)); out.vehBox=!!veh.box;
  if(G.course.get())G.course.cancelCourse();
  window.advanceTime(60);
  return out;
 });
 check('a rider already at the line is left where she is standing, and is not told she was moved',
  guards.nearMoved<0.01&&!guards.nearToast&&guards.nearBox,guards);
 check('a rider who is flying is left flying',
  guards.flyMoved<0.01&&!guards.flyToast&&guards.flyBox,{moved:guards.flyMoved,toast:guards.flyToast});
 check('a passenger aboard the balloon is not yanked off it',
  guards.vehMoved<0.01&&!guards.vehToast&&guards.vehBox,{moved:guards.vehMoved,toast:guards.vehToast});

 /* ---------------------------------------------------------------- 9. the companion ----- */
 stage('the companion');
 const comp=await page.evaluate(async()=>{
  const G=window.__features,S=window.__sl,out={};
  const sv=G.save.fresh(), me=G.horse.rideIdx();
  const mate=(sv.horses||[]).map((h,i)=>({h,i})).filter(o=>o.i!==me&&!o.h.egg)[0];
  if(!mate){out.skip=true;return out;}
  G.save.sync(s=>{s.horses[mate.i].out=true;s.companion=s.horses[mate.i].id;});
  G.horse.reloadHorses();
  await new Promise(r=>setTimeout(r,900));               // world.js re-finds the companion twice a second
  const find=()=>{const H=G.horse;for(const a of H.herd()){const hh=H.myHorses[a.idx];if(hh&&hh.id===G.save.fresh().companion)return a;}return null;};
  const a0=find(); out.found=!!a0;
  if(!a0)return out;
  const r=await S.enter('w2');                            // the far side of the valley
  out.rider=r.pos.slice();
  out.gapBefore=+Math.hypot(a0.pos.x-r.pos[0],a0.pos.z-r.pos[1]).toFixed(1);
  for(let i=0;i<40;i++){window.advanceTime(100);await new Promise(rr=>requestAnimationFrame(rr));}
  const a1=find();
  out.gapAfter=a1?+Math.hypot(a1.pos.x-G.horse.player.pos.x,a1.pos.z-G.horse.player.pos.z).toFixed(1):null;
  if(G.course.get())G.course.cancelCourse();
  window.advanceTime(60);
  return out;
 });
 check('the companion catches up to the start line through the game\'s own fast-travel snap',
  comp.skip||(comp.found&&comp.gapBefore>60&&comp.gapAfter!=null&&comp.gapAfter<25),comp);

 /* ---------------------------------------------------------------- 10. nothing broke ---- */
 stage('the round still rides');
 const ride=await page.evaluate(async()=>{
  const G=window.__features,S=window.__sl,out={};const p=G.horse.player,R=G.horse.RIG();
  /* the same crossing the sister suite uses for a clean round, met near the top of the arc */
  async function clean(){
   G.hidePanels();
   G.save.sync(s=>{if(s.ribbonGold)delete s.ribbonGold.h1;if(s.bestAcc)delete s.bestAcc.h1;});
   await S.enter('h1');
   window.advanceTime(4200);                              // past the countdown, from the start box
   const c=G.course.get();
   out.startedFromBox=!!c&&c.started;
   out.startedAt=out.startedAt||(c?[+p.pos.x.toFixed(1),+p.pos.z.toFixed(1)]:null);
   for(let n=0;n<40&&G.course.get();n++){
    const cc=G.course.get(), j=cc.jumps[cc.idx]; if(!j)break;
    for(const d of[-2.4,-1.0,-0.4,0.4,1.0,2.4]){
     p.pos.set(j.x+Math.sin(j.rotY)*d,0,j.z+Math.cos(j.rotY)*d);
     if(R.heroMotion)R.heroJumpAge=0.9; else {p.y=1.1;p.vy=0.1;}
     p.speed=7; window.advanceTime(20);
    }
    if(!R.heroMotion){p.y=0;p.vy=0;}
   }
   await new Promise(r=>setTimeout(r,200));
   return !!(G.save.fresh().ribbonGold||{}).h1;
  }
  /* one fence met a frame early is a rider's bad luck, not a regression: ride it twice */
  out.tries=1; if(!await clean()){out.tries=2; if(G.course.get())G.course.cancelCourse(); window.advanceTime(60); await clean();}
  const sv=G.save.fresh();
  out.gold=!!(sv.ribbonGold||{}).h1; out.acc=(sv.bestAcc||{}).h1;
  const live=G.course.get();
  out.stillRunning=!!live; out.idx=live?live.idx:null; out.lap=live&&live.ce?live.ce.lap:null;
  out.grades=live&&live.ce?live.ce.grades.slice():((G.events2.state.c&&G.events2.state.c.ce)?G.events2.state.c.ce.grades.slice():null);
  out.faults=G.events2.state.fenceFaults; out.elim=G.events2.state.elim; out.toastsTail=(window.__toasts||[]).slice(-6);
  const rp=document.getElementById('ev2ResultPanel');
  out.resultDisplay=rp?rp.style.display:null;
  out.result=rp?(rp.textContent||'').replace(/\s+/g,' '):'';
  if(G.course.get())G.course.cancelCourse();
  window.advanceTime(60);
  return out;
 });
 check('a tidy round ridden from the new start line still earns the gold ribbon',
  ride.startedFromBox&&ride.gold&&ride.acc>=0.95&&/gold ribbon/.test(ride.result),
  {gold:ride.gold,acc:ride.acc,tries:ride.tries,startedAt:ride.startedAt,faults:ride.faults,
   grades:ride.grades,elim:ride.elim,result:(ride.result||'').slice(0,160)});

 /* ---------------------------------------------------------------- 11. errors ----------- */
 check('no console or page errors',errors.length===0,errors.slice(0,5));

 const bad=checks.filter(c=>!c.ok);
 console.log('');
 console.log(bad.length?('FAILED '+bad.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED')+' in '+((Date.now()-t0)/1000).toFixed(1)+'s');
 await browser.close();
 process.exit(bad.length?1:0);
})().catch(async e=>{console.error(e);try{if(browser)await browser.close();}catch(x){}process.exit(2);});
