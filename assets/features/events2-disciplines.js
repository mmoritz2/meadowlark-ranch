/* Feature package 'events2-disciplines'. Owned by that package: edit only this file and the inline hot spots
   assigned to it. See index.js for the contract. Nothing runs at import time.

   What lives here — the six disciplines as six different sports, and everything a rider is
   told about one before, during and after a round. course-engine grades a crossing and
   events-pvp pays for it; neither of them ever said what SORT of round you were riding.

     the card      every routed event now carries its real par, so the time allowed printed on
                   the card is the time the course actually gives you (the Grand Loop advertised
                   56 s and allowed 207); the whole information card is made interactive so the
                   compete skin keeps it on screen instead of folding it away as a duplicate;
                   and a full card panel lays out the discipline, the obstacles, the
                   prerequisites, the reward and the three difficulties side by side
     show jumping  a course designer's hand: verticals, oxers, walls, planks, a gate, a water
                   tray and a brush instead of the same blue-and-white rail twelve times, picked
                   deterministically per event so a course is the same every time you ride it,
                   with the classical fault currency (4 a rail, 4/8 a refusal, out after three
                   at the same fence) counted and shown
     cross country a discipline of its own: an optimum time rather than a time allowed, 0.4
                   penalties a second over it, 20 and 40 for refusals at a solid obstacle, and
                   ditches, banks, brush and corners instead of one log repeated
     races         a line and gate discipline as well as a clock — how close to the middle of
                   each gate you were, and what you hit on the way — so the gold ribbon that
                   gates the weekly board is no longer a second reading of the stopwatch
     dressage      Novice, Open and Elite now ask for different things: holds a second shorter
                   or longer, a lengthening dropped or an extra figure added, and a judge who is
                   kind or strict about a wrong gait. The tests also go to the town on the card:
                   Cottonwood's test is ridden at Cottonwood, not in the ranch arena
     showmanship   judged as a presentation: the turnout mark events-pvp already takes, plus a
                   handling mark for standing still and square through a halt and walking when
                   the pattern says walk, fed into the engine's own per-figure marks, with the
                   judge's card as a card you can read
     the start     every event marshals you to a start line instead of starting the clock
                   wherever you happened to be standing: a start box ten metres behind the first
                   obstacle, square to it and facing it, for anything with obstacles, and the
                   arena entrance at A facing down the centre line to C for a test or a
                   showmanship class. The spot is tested against the river, the colliders, the
                   fence walls and the slope of the ground before a rider is put on it, and she
                   is told in a line of text where she has been taken
     the gauntlet  one loop with four names becomes four loops: each season its own shape, its
                   own length, its own limit, its own décor and its own best time — and one
                   clock, since the row advertised 150 s, counted against 113 and cut you off
                   at 150
     the field     a solo race is no longer ridden alone: two to four pace-setters from the
                   valley's own ranches ride the loop at a pace drawn from the same hash the
                   weekly board uses, named as what they are, worth a placing and nothing else
     the result    every round ends on a card — the sheet in the discipline's own currency, the
                   figure marks for a test, the ribbons, the purse and the round again — instead
                   of a line of text queued behind three others
     the furniture race hazards that were sitting on top of the world's speed pads are lifted,
                   and the five routes that had none get a deterministic set

   Two things this package deliberately does NOT do. It does not re-price the green ribbons: a
   sister suite pins a one-fault round at three ribbons, and moving that is the ladder owner's
   call, so a fault's price here is the gold ribbon, the accuracy, the fault line and the
   elimination rule. And it does not touch the inline dressage scorer — it feeds that scorer
   evidence in its own currency (f.good / f.total) instead, which is why handling and strictness
   land on the mark without a single edit to ranch3d.html. */
export const id='events2-disciplines';
export function install(G){
 const THREE=G.THREE, $=G.$, T=G.tables, W=G.world, player=G.horse.player;
 const toast=(...a)=>G.toast(...a);          // through G, so a QA probe that wraps G.toast hears us
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const fmtT=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
 const ridden=()=>G.horse.ridden();
 const evById=k=>T.EVENTS3.find(e=>e.id===k);
 const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
 function hash(str){let h=0x811c9dc5|0;const s=String(str);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return ((h>>>8)&0xffff)/0xffff;}
 const DIFFS=(G.course&&G.course.DIFFS)||[{k:'open',label:'Open',icon:'🏇',parMul:1,rewMul:1,fence:1,lvlAdd:0,desc:'the course as set'}];
 const DI_OPEN=Math.min(1,DIFFS.length-1);
 const diffAt=di=>DIFFS[di==null?DI_OPEN:clamp(Math.round(di),0,DIFFS.length-1)];

 /* ================================================================= disciplines ========== */
 const DISCS={
  jump:    {k:'jump',    icon:'⤴️',label:'Show jumping',   sub:'rails that fall',        stats:['jump','agility']},
  xc:      {k:'xc',      icon:'🌲',label:'Cross country',  sub:'solid fences, an optimum time',stats:['stamina','jump']},
  race:    {k:'race',    icon:'🏁',label:'Race',           sub:'gates, line and clock',  stats:['speed','stamina']},
  dressage:{k:'dressage',icon:'🎽',label:'Dressage',       sub:'figures marked out of ten',stats:['agility','accel']},
  show:    {k:'show',    icon:'🧼',label:'Showmanship',    sub:'turnout + pattern',      stats:['agility','accel']},
  gauntlet:{k:'gauntlet',icon:'⏳',label:'Seasonal gauntlet',sub:'ten mixed obstacles',  stats:['agility','jump']},
 };
 const DISC_ORDER=['jump','xc','race','dressage','show','gauntlet'];
 function discOf(ev){
  if(!ev)return DISCS.jump;
  if(ev.gauntlet||ev.kind==='gauntlet')return DISCS.gauntlet;
  if(ev.kind==='show')return DISCS.show;
  if(ev.dressage)return DISCS.dressage;
  if(ev.xc)return DISCS.xc;
  if(ev.race)return DISCS.race;
  return DISCS.jump;
 }
 /* How many things are between the start and the finish, said the way the discipline says it. */
 function obstacleCount(ev){
  const d=discOf(ev);
  if(d.k==='dressage'||d.k==='show')return ((G.course.DRESSAGE_TESTS||{})[ev.id]||[]).length;
  if(d.k==='xc')return ((T.RACE_ROUTES[ev.route]||[]).length)*2;
  if(d.k==='race'||d.k==='gauntlet')return (T.RACE_ROUTES[ev.route]||[]).length;
  return (ev.n||0)*(ev.laps||1);
 }
 function discDetail(ev){
  const d=discOf(ev), n=obstacleCount(ev);
  if(d.k==='dressage')return n+' figures';
  if(d.k==='show')return 'turnout + '+n+' figures';
  if(d.k==='xc')return n+' obstacles';
  if(d.k==='gauntlet')return n+' mixed obstacles · '+Math.round(ev.limit||ev.time||150)+'s limit';
  if(d.k==='race')return (T.RACE_ROUTES[ev.route]||[]).length+' gates'+(ev.rev?' · reversed':'');
  return (ev.n||0)+' fences'+(ev.laps>1?' × '+ev.laps+' laps':'');
 }

 /* ================================================================= real pars ============= */
 /* eventPar fell through to a flat 40 for anything built from a route, because a routed row has
    neither ev.par nor ev.n. Everything downstream — the card's time allowed, ui2-compete's spec
    grid, the weekly board's neighbour times — read that 40 while the course itself measured the
    route and allowed up to 207 s. Measuring the route here, once, at install, makes the card and
    the course agree by construction rather than by coincidence: startCourse uses len/7.2 and
    course-engine re-measures cross country at len/6.5, so those are the divisors. */
 function routeLen(key){
  const pts=T.RACE_ROUTES[key]||[]; let len=0;
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];len+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
  return len;
 }
 function fixPars(){
  for(const ev of T.EVENTS3){
   if(!ev.route||ev.par!=null)continue;                  // a row that names its own par is left alone
   const len=routeLen(ev.route); if(!len)continue;
   ev.par=+(len/(ev.xc?6.5:7.2)).toFixed(1);
  }
 }
 fixPars();

 /* ================================================================= the tables ============ */
 /* The programme's own flags stay exactly as they are — the engines depend on dressage:true for
    a showmanship class and race:true for the gauntlet. ev.disc is the display truth beside them. */
 for(const ev of T.EVENTS3)ev.disc=discOf(ev).k;
 /* One clock for the gauntlet. The row advertised a 150 s limit, showed a 113 s allowance in the
    HUD and started charging time faults at 113 while the trial was still running. */
 for(const ev of T.EVENTS3)if(ev.gauntlet&&ev.limit)ev.time=ev.limit;
 /* Dressage and showmanship rows had no venue, so every class in the valley was ridden in the
    ranch arena whatever town the card named. world.js only assigns ev.at to jumping rows. */
 const VENUE_OF={};
 for(const ev of T.EVENTS3)if(ev.at&&ev.town&&!VENUE_OF[ev.town])VENUE_OF[ev.town]=ev.at.slice();
 try{for(const rg of (T.REGIONS||[]))if(rg.venue&&rg.id!=='ranch'){const nm=rg.name.slice(rg.name.indexOf(' ')+1).split(' ')[0];if(!VENUE_OF[nm])VENUE_OF[nm]=[rg.venue.x,rg.venue.z];}}catch(e){}
 for(const ev of T.EVENTS3){ if(ev.at||!ev.dressage)continue; const at=VENUE_OF[ev.town]; if(at)ev.at=at.slice(); }
 /* The blurb the flat renderer prints, now that a row knows its own discipline. */
 for(const ev of T.EVENTS3)ev.blurb=discOf(ev).icon+' '+discOf(ev).label.toLowerCase()+' · '+discDetail(ev);

 /* ================================================================= save ================= */
 G.save.ensure(s=>{ s.ev2=s.ev2||{}; s.ev2.xcBest=s.ev2.xcBest||{}; s.ev2.handling=s.ev2.handling||{}; s.ev2.gaunt=s.ev2.gaunt||{}; s.ev2.clean=s.ev2.clean||0; });

 /* ================================================================= fence building ======== */
 const M=()=>W.mats;
 function grp(x,z,rotY){const g=new THREE.Group();g.position.set(x,W.groundH(x,z),z);g.rotation.y=rotY||0;G.scene.add(g);return g;}
 function disposeGroup(g){
  if(!g)return; G.scene.remove(g);
  g.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose();if(o.isSprite&&o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});
 }
 const POLE='#f4f0e6';
 /* Every fence is built in the group's own frame: local X runs along the rails, local Z is the
    direction of travel. The crossing test in course-engine fires inside |along|<1.8 and
    |across|<1.3, so a spread never reaches further than ±0.6 in Z — a real oxer to look at and
    to ride, and not one millimetre outside the judging window the sister file owns. */
 const FENCE_TYPES=[
  {k:'vertical',label:'vertical',icon:'▮',spread:0,mul:1,build(g,f){
   for(const s of[-1,1])W.box(0.17,1.15*f,0.17,M().paintMat('#2e86c1'),s*1.6,0.58*f,0,g);
   W.box(3.2,0.13,0.1,M().whitePaintMat,0,0.6*f,0,g); W.box(3.2,0.13,0.1,M().whitePaintMat,0,0.95*f,0,g);
  }},
  {k:'oxer',label:'oxer',icon:'▯▯',spread:0.55,mul:1.25,build(g,f){
   for(const s of[-1,1])for(const z of[-0.55,0.55])W.box(0.17,1.2*f,0.17,M().paintMat('#c0392b'),s*1.6,0.6*f,z,g);
   W.box(3.2,0.13,0.1,M().whitePaintMat,0,0.62*f,-0.55,g);
   W.box(3.2,0.13,0.1,M().whitePaintMat,0,1.0*f,0.55,g);
   W.box(3.2,0.13,0.1,M().whitePaintMat,0,0.66*f,0.55,g);
  }},
  {k:'wall',label:'wall',icon:'🧱',spread:0.3,mul:1.2,build(g,f){
   for(let r=0;r<3;r++)W.box(2.9-r*0.15,0.28*f,0.5,M().paintMat(r%2?'#b5633a':'#c9784a'),0,0.16*f+r*0.29*f,0,g);
   W.box(3.05,0.1,0.6,M().paintMat('#8a5030'),0,0.94*f,0,g);
   for(const s of[-1,1])W.box(0.16,1.0*f,0.16,M().paintMat('#8a5030'),s*1.65,0.5*f,0,g);
  }},
  {k:'planks',label:'planks',icon:'▤',spread:0,mul:1.1,build(g,f){
   for(const s of[-1,1])W.box(0.17,1.2*f,0.17,M().paintMat('#6b4a2f'),s*1.6,0.6*f,0,g);
   for(let r=0;r<3;r++)W.box(3.0,0.26,0.07,M().paintMat(r%2?'#f4f0e6':'#e6d6b8'),0,0.38*f+r*0.3*f,0,g);
  }},
  {k:'gate',label:'gate',icon:'⛩️',spread:0,mul:1.15,build(g,f){
   for(const s of[-1,1])W.box(0.17,1.25*f,0.17,M().paintMat('#5a3d22'),s*1.6,0.62*f,0,g);
   W.box(3.0,0.12,0.08,M().whitePaintMat,0,0.95*f,0,g); W.box(3.0,0.12,0.08,M().whitePaintMat,0,0.42*f,0,g);
   for(const x of[-0.9,0,0.9])W.box(0.11,0.55*f,0.07,M().whitePaintMat,x,0.68*f,0,g);
  }},
  {k:'water',label:'water tray',icon:'💧',spread:0.6,mul:1.35,build(g,f){
   const tray=W.box(3.2,0.05,1.2,M().paintMat('#4aa3d8'),0,0.03,0.25,g); tray.receiveShadow=true;
   W.box(3.3,0.1,0.12,M().paintMat('#e6d6b8'),0,0.06,-0.38,g); W.box(3.3,0.1,0.12,M().paintMat('#e6d6b8'),0,0.06,0.88,g);
   for(const s of[-1,1])W.box(0.16,0.85*f,0.16,M().paintMat('#2e8b57'),s*1.6,0.43*f,-0.5,g);
   W.box(3.1,0.12,0.09,M().whitePaintMat,0,0.62*f,-0.5,g);
  }},
  {k:'brush',label:'brush',icon:'🌿',spread:0.35,mul:1.1,build(g,f){
   for(const s of[-1,1])W.box(0.17,1.0*f,0.17,M().paintMat('#6b4a2f'),s*1.6,0.5*f,0,g);
   W.box(3.0,0.5*f,0.45,M().paintMat('#4f7a3a'),0,0.3*f,0,g);
   for(const x of[-1.0,-0.35,0.35,1.0]){const b=W.box(0.7,0.32,0.42,M().paintMat('#6aa15a'),x,0.66*f,0,g);b.rotation.z=0.12;}
   W.box(3.1,0.11,0.08,M().whitePaintMat,0,0.82*f,-0.22,g);
  }},
 ];
 /* Cross country asks a different question: nothing here falls down, so the fences are the
    ground itself — a ditch, a step up onto a bank, a corner and brush over a log. */
 const XC_TYPES=[
  {k:'log',label:'log',icon:'🪵',mul:1,build(g,f){
   const log=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.19,3.4,10),M().plankBrownMat); log.rotation.z=Math.PI/2; log.position.y=0.86*f; g.add(log);
   for(const s of[-1,1])W.box(0.22,1.0*f,0.22,M().plankBrownMat,s*1.6,0.5*f,0,g);
   W.box(3.2,0.1,0.1,M().whitePaintMat,0,0.45*f,0,g);
  }},
  {k:'ditch',label:'ditch',icon:'〰️',mul:1.3,build(g,f){
   W.box(3.4,0.5,1.0,M().paintMat('#2b2118'),0,-0.24,0.1,g);
   W.box(3.4,0.12,0.16,M().plankBrownMat,0,0.06,-0.45,g); W.box(3.4,0.12,0.16,M().plankBrownMat,0,0.06,0.65,g);
   const rail=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,3.4,8),M().plankBrownMat); rail.rotation.z=Math.PI/2; rail.position.set(0,0.62*f,-0.5); g.add(rail);
   for(const s of[-1,1])W.box(0.2,0.7*f,0.2,M().plankBrownMat,s*1.6,0.35*f,-0.5,g);
  }},
  {k:'bank',label:'bank',icon:'⬆️',mul:1.2,build(g,f){
   W.box(3.6,0.44*f,1.3,M().paintMat('#7a6a4a'),0,0.22*f,0,g);
   W.box(3.8,0.12,1.4,M().paintMat('#5d8a4a'),0,0.48*f,0,g);
   W.box(3.6,0.14,0.2,M().plankBrownMat,0,0.5*f,-0.62,g);
  }},
  {k:'corner',label:'corner',icon:'📐',mul:1.35,build(g,f){
   const a=W.box(2.4,0.15,0.13,M().plankBrownMat,-0.55,0.8*f,0.2,g); a.rotation.y=0.36;
   const b=W.box(2.4,0.15,0.13,M().plankBrownMat,0.55,0.8*f,-0.2,g); b.rotation.y=-0.36;
   W.box(2.6,0.4*f,0.5,M().paintMat('#4f7a3a'),0,0.22*f,0,g);
   for(const s of[-1,1])W.box(0.2,0.9*f,0.2,M().plankBrownMat,s*1.65,0.45*f,s*0.4,g);
  }},
  {k:'brush',label:'brush',icon:'🌿',mul:1.15,build(g,f){
   const log=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,3.4,8),M().plankBrownMat); log.rotation.z=Math.PI/2; log.position.y=0.5*f; g.add(log);
   for(const x of[-1.1,-0.4,0.4,1.1]){const b=W.box(0.8,0.36,0.4,M().paintMat('#5d9e4f'),x,0.85*f,0,g);b.rotation.z=-0.1;}
   for(const s of[-1,1])W.box(0.2,0.75*f,0.2,M().plankBrownMat,s*1.7,0.38*f,0,g);
  }},
 ];
 /* A course designer walks a whole set before repeating one, so no course is five verticals by
    accident, and the opener is always inviting. The order is a hash of the event id, so the
    Cottonwood Welcome Jump is the same five fences every time you ride it. */
 function fenceSet(ev,n,types){
  const order=types.map((t,i)=>[t,hash(ev.id+'|f'+i)]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
  const out=[]; for(let i=0;i<n;i++)out.push(order[i%order.length]);
  if(out.length)out[0]=types[0];                          // fence one is a plain vertical, or a log
  return out;
 }
 function numberSprite(g,i,h,inv){ const sp=G.nameSprite(String(i+1)); sp.position.y=h; sp.scale.set(1.1,0.34/(inv||1),1); g.add(sp); return sp; }
 function reskinFences(c,types,numbered){
  const f=(c.ce&&c.ce.diff&&c.ce.diff.fence)||1;
  const targets=c.jumps.filter(j=>j.kind!=='gate');
  const set=fenceSet(c.ev,targets.length,types);
  let n=0;
  for(let i=0;i<c.jumps.length;i++){
   const j=c.jumps[i]; if(j.kind==='gate')continue;
   const ft=set[n++]; disposeGroup(j.g);
   const g=grp(j.x,j.z,j.rotY);
   try{ft.build(g,1);}catch(e){console.error('ev2 fence '+ft.k,e);}
   g.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
   /* the difficulty raises the whole fence the way course-engine raises a rail — the number on
      it is counter-scaled so an Elite course does not stretch its own signage */
   g.scale.y=f;
   if(numbered)numberSprite(g,i,1.75,f);
   j.g=g; j.fenceType=ft.k; j.fenceLabel=ft.label; j.fenceMul=ft.mul||1; j.fenceIcon=ft.icon;
  }
 }

 /* ================================================================= the seasonal trials === */
 /* One loop, four names was the whole of the seasonal programme. Each season now gets its own
    shape, its own length, its own limit and its own décor, all inside the ground the original
    loop already proved is ridable — the waypoints are that loop scaled and turned about its own
    centre, so nothing lands in the river or inside a barn. */
 const GT_BASE=[[-20,-24],[-42,-46],[-72,-54],[-100,-44],[-116,-20],[-108,6],[-84,26],[-54,32],[-30,22],[-18,0]];
 const GT_CX=GT_BASE.reduce((a,p)=>a+p[0],0)/GT_BASE.length, GT_CZ=GT_BASE.reduce((a,p)=>a+p[1],0)/GT_BASE.length;
 function gtLoop(scale,turn,extra){
  const out=GT_BASE.map(p=>{
   const dx=p[0]-GT_CX, dz=p[1]-GT_CZ, co=Math.cos(turn), si=Math.sin(turn);
   return [+(GT_CX+(dx*co-dz*si)*scale).toFixed(1),+(GT_CZ+(dx*si+dz*co)*scale).toFixed(1)];
  });
  if(extra){ for(let k=0;k<extra;k++){ const i=Math.floor((k+1)*out.length/(extra+1)); const a=out[i], b=out[(i+1)%out.length];
   out.splice(i+1,0,[+((a[0]+b[0])/2).toFixed(1),+((a[1]+b[1])/2).toFixed(1)]); } }
  return out;
 }
 const GAUNTLET_SEASONS={
  bloom:{route:'gt_bloom',pts:gtLoop(1,0,2),   limit:165,decor:'petal',twist:'Two extra elements on the soft ground, and a kinder clock.'},
  sun:  {route:'gt_sun',  pts:gtLoop(1.08,0.5,0),limit:150,decor:'dust', twist:'The long loop, opened out, in the heat.'},
  ember:{route:'gt_ember',pts:gtLoop(0.94,2.1,1),limit:140,decor:'leaf', twist:'Leaves across the line and a tighter limit.'},
  frost:{route:'gt_frost',pts:gtLoop(0.85,3.6,0),limit:130,decor:'frost',twist:'Short, hard ground, and the shortest clock of the year.'},
 };
 const DECOR_COL={petal:['#ffd1e8','#ffb3d9'],dust:['#d9c49a','#c9ab7a'],leaf:['#c9772f','#a8541f'],frost:['#dff1ff','#bcd9ef']};
 /* events-pvp's GTD is not a copy of the live season's row, it IS GAUNTLETS[whatever season was
    running when the page loaded]. Writing the new season's name through GTD therefore overwrites
    that row for good, and the year comes round to a spring loop still calling itself the frost
    one. Take the four names before anybody has had a chance to smudge them. */
 const GT_NAMES={};
 try{ const GS=(G.events&&G.events.GAUNTLETS)||{}; for(const k in GS)GT_NAMES[k]={name:GS[k].name,icon:GS[k].icon,blurb:GS[k].blurb}; }catch(e){}
 function seasonKey(){ try{return G.time.seasonNow().def.id;}catch(e){return 'bloom';} }
 function gauntletDef(k){ return GAUNTLET_SEASONS[k]||GAUNTLET_SEASONS.bloom; }
 function applyGauntletSeason(k){
  const ev=T.EVENTS3.find(e=>e.gauntlet); if(!ev)return null;
  const def=gauntletDef(k);
  T.RACE_ROUTES[def.route]=def.pts.map(p=>p.slice());
  Object.assign(ev,{route:def.route,limit:def.limit,time:def.limit,par:+(routeLen(def.route)/7.2).toFixed(1)});
  /* events-pvp holds the season's name object by reference and prints it in its own toasts and
     its Events card; writing the new season into that same object keeps them in step without
     reaching into its file. */
  try{ const S=GT_NAMES[k];
   if(S&&G.events.GTD){Object.assign(G.events.GTD,S);ev.name=S.name;} }catch(e){}
  ev.blurb=discOf(ev).icon+' '+discOf(ev).label.toLowerCase()+' · '+discDetail(ev);
  return def;
 }
 applyGauntletSeason(seasonKey());
 G.on('seasonRoll',(s,prev,next)=>{
  const k=next||seasonKey(); const def=applyGauntletSeason(k); if(!def)return;
  const ev=T.EVENTS3.find(e=>e.gauntlet);
  toast('⏳ The seasonal trial has changed — '+(ev?ev.name:'a new loop')+': '+def.twist);
 });
 function buildDecor(c,kind,pts){
  const cols=DECOR_COL[kind]||DECOR_COL.petal, g=new THREE.Group();
  for(let i=0;i<48;i++){
   const a=pts[i%pts.length], b=pts[(i+1)%pts.length], f=hash('d'+kind+i);
   const x=a[0]+(b[0]-a[0])*f+(hash('dx'+i)-0.5)*7, z=a[1]+(b[1]-a[1])*f+(hash('dz'+i)-0.5)*7;
   const m=W.box(0.5+hash('s'+i)*0.5,kind==='frost'?0.06:0.12,0.5+hash('t'+i)*0.5,W.mats.paintMat(cols[i%2]),x,W.groundH(x,z)+0.05,z,g);
   m.rotation.y=hash('r'+i)*Math.PI;
  }
  G.scene.add(g); return g;
 }

 /* ================================================================= the start ============= */
 /* Every round started wherever the rider happened to be standing with the clock already
    running. Barleyfold's cross country begins 217 units from its first gate on a 54 s par — and
    only a race or a cross country was ever marshalled, so a show jumping round, a seasonal
    trial, a dressage test and a showmanship class all still began with a long hack across the
    valley to find out where the first fence was. Every kind of event is carried to a line now:
    behind the first obstacle for anything with obstacles, and outside A facing C for a test,
    because that is where a test actually begins. */
 function buildStartBox(x,z,rotY){
  const g=grp(x,z,rotY), m=W.mats.whitePaintMat;
  for(const s of[-1,1]){
   for(const dz of[-3.2,-1.6,0])W.box(0.14,1.05,0.14,m,s*3.1,0.52,dz,g);
   for(const dz of[-2.4,-0.8]){const r=W.box(1.7,0.1,0.08,m,s*3.1,0.92,dz,g);r.rotation.y=Math.PI/2;}
  }
  W.box(6.4,0.05,0.45,m,0,0.04,0.1,g);
  const sp=G.nameSprite('🏁 START'); sp.position.set(0,1.9,-3.2); sp.scale.set(2.2,0.5,1); g.add(sp);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.userData.ev2StartBox=true;
  return g;
 }
 /* One start box for the life of the page, not one a round. It used to be handed to addFx and
    thrown away with the rest of the course furniture, which cost eleven geometries and a 512×128
    canvas sign every time anybody entered anything — and nameSprite keeps a reference to every
    sprite it has ever made, so each disposed sign stayed on that list until the tab closed. Now
    the same box is moved to wherever the rider has been lined up and parked out of sight between
    rounds, which is also the only honest reading of 'reuse the mesh, do not build a second one'. */
 let SBOX=null;
 function showBox(x,z,rotY){
  try{
   if(!SBOX)SBOX=buildStartBox(x,z,rotY);
   if(!SBOX.parent)G.scene.add(SBOX);
   SBOX.position.set(x,W.groundH(x,z),z); SBOX.rotation.y=rotY; SBOX.visible=true;
  }catch(e){ console.error('ev2 start box',e); }
  return null;                                           // deliberately not addFx's to dispose
 }
 function hideBox(){ if(SBOX)SBOX.visible=false; }
 /* Whether a horse can stand somewhere. The water tests are the world's own numbers — the river
    channel runs about five units either side of riverZ, Sparrow Creek about four either side of
    streamX until it joins at z≈160, and Loon Lake is a circle at (20,16) — widened a little here
    because a rider dropped on the bank of a river is still a rider in the wrong place. The
    collider and wall tests are the ones world.js's own follower AI uses to keep a foal out of the
    barn and on the right side of a fence. The last is the ground itself: if the ground three
    metres away is three metres up or down, this is a cliff face, and dropping a rider onto one is
    worse than leaving her where she was. Everything is wrapped, because a world that has not
    finished building must cost a course start nothing rather than throw inside it. */
 function wet(x,z){
  try{ if(Math.abs(z-W.riverZ(x))<7)return true; }catch(e){}
  try{ if(Math.hypot(x-20,z-16)<8)return true; }catch(e){}
  try{ if(z<163&&Math.abs(x-W.streamX(z))<5)return true; }catch(e){}
  return false;
 }
 function onWall(x,z,pad){
  try{ for(const w of (W.walls||[])){
   const dx=w.x2-w.x1, dz=w.z2-w.z1, l2=dx*dx+dz*dz;
   let t=l2>0?((x-w.x1)*dx+(z-w.z1)*dz)/l2:0; t=t<0?0:t>1?1:t;
   if(Math.hypot(x-(w.x1+dx*t),z-(w.z1+dz*t))<pad)return true;
  } }catch(e){}
  return false;
 }
 function standable(c,x,z,skip){
  if(wet(x,z))return false;
  try{ for(const col of (W.colliders||[]))if(Math.hypot(x-col.x,z-col.z)<col.r+1.6)return false; }catch(e){}
  if(onWall(x,z,1.6))return false;
  try{ for(const j of (c.jumps||[]))if(j!==skip&&Math.hypot(x-j.x,z-j.z)<5)return false; }catch(e){}
  try{ const h=W.groundH(x,z);
   for(const d of[[3,0],[-3,0],[0,3],[0,-3]])if(Math.abs(W.groundH(x+d[0],z+d[1])-h)>3)return false; }catch(e){}
  return true;
 }
 /* Somewhere to stand, starting at the ideal and giving ground grudgingly. The whole line of
    setbacks is tried before a single metre is given up sideways, because standing back costs
    nothing and standing to one side costs the rider her approach: she is square to the fence, so
    a metre and a half off the line is a metre and a half off the middle of a fence 3.2 m wide.
    Backing off is free in the other sense too: an arena course is a ring, the track curves away
    from the tangent, and every extra metre behind fence one is measurably further from fence
    twelve — at Hollowpeak's twelve-fence course ten metres back leaves 4.2 m of the last fence
    and twelve metres leaves 6.0. It does go as far as six metres sideways in the end, because
    the valley scatters its scenery afresh every boot and findClear can drop the Barleyfold arena
    straight onto Sparrow Creek: a rider six metres off the approach has to turn to her fence,
    but a rider stood in the creek is standing in a creek. If nothing at all is clear the ideal
    wins anyway; an awkward start line still beats no start line and a hack across the valley. */
 /* Standing somewhere is not the same as being able to LEAVE it. standable() asks only about the
    patch of ground under the horse, and backing off is the first thing findSpot tries — which is
    how a rider was set down twenty metres behind fence one of the Twilight Cup, on the grass, on
    the far side of the ranch arena's own east rail, facing a fence she could not reach: holding
    forward she scraped along the rail and stalled eight metres short with the round clock running.
    The same thing put the two Basin Freestyles two metres outside the south rail while the judge
    waited at A inside it. So a candidate must also have a clear RUN to the obstacle: walk the
    straight line and refuse the spot if a wall stands across it. */
 function clearRun(c,px,pz,tx,tz,skip){
  const d=Math.hypot(tx-px,tz-pz); if(!(d>0.01))return true;
  /* WALLS only, and only the part of the run that is not the obstacle itself. The first version of
     this asked about colliders too and stopped three metres short of nothing: a fence's own
     standards are colliders, so every candidate was rejected on its last stride and the search
     fell back to whatever was nearest, which moved the start line at a dozen events that were
     never broken. What actually stranded a rider at the Twilight Cup and the two Basin Freestyles
     was a RAIL — a wall, standing across the whole approach — and a wall is also the only thing
     here a horse cannot simply go around. */
  const stop=Math.max(0,d-3.5), n=Math.max(4,Math.min(40,Math.ceil(stop/1.2)));
  for(let i=1;i<=n;i++){
   const f=(stop/d)*(i/n), x=px+(tx-px)*f, z=pz+(tz-pz)*f;
   if(onWall(x,z,1.0))return false;
  }
  return true;
 }
 /* minT is the closest the search may stand to what it is aiming at. A jumping line does not care
    — four metres off a fence is a tight but legal start — but a test does: tickDressage closes a
    figure the moment the rider is inside 3.5 m of its letter, so a rider marshalled to 1 m from A
    is handed the opening figure before the judge has looked up. The ideal for a test is 7 m back
    and BACKS reaches -6, which lands exactly there whenever the valley has scattered the venue
    somewhere too cramped to stand further out. Caller's rule, not this function's. */
 function findSpot(c,x,z,rotY,skip,target,minT){
  const bx=Math.sin(rotY), bz=Math.cos(rotY), ax=Math.cos(rotY), az=-Math.sin(rotY);
  /* Where she is meant to be riding TO. The jumping start line is drawn ten metres back from its
     fence and a test's is seven back from A, so the caller says which rather than this guessing. */
  const tx=target?target[0]:x+bx*10, tz=target?target[1]:z+bz*10;
  /* Negative setbacks come last and stand the rider CLOSER than the ideal ten metres. Inside a
     railed arena there is often nowhere further back to go, and a start line six metres out that
     she can ride from beats a textbook one she cannot. */
  const BACKS=[0,2,4,6,8,10,12,-2,-4,-6];
  const tooClose=(px,pz)=>minT>0&&Math.hypot(px-tx,pz-tz)<minT;
  for(const side of[0,-1.5,1.5,-3,3,-4.5,4.5,-6,6])for(const back of BACKS){
   const px=x-bx*back+ax*side, pz=z-bz*back+az*side;
   if(tooClose(px,pz))continue;
   if(standable(c,px,pz,skip)&&clearRun(c,px,pz,tx,tz,skip))return [px,pz];
  }
  /* Nothing had both. Take standable-and-reachable off the table and settle for reachable: being
     able to start the round matters more than the ground being pretty. */
  for(const side of[0,-1.5,1.5,-3,3])for(const back of BACKS){
   const px=x-bx*back+ax*side, pz=z-bz*back+az*side;
   if(tooClose(px,pz))continue;
   if(clearRun(c,px,pz,tx,tz,skip))return [px,pz];
  }
  return [x,z];
 }
 /* The three guards the race start has always carried are all still right: a rider who is already
    at the line does not want to be shuffled two metres sideways, a rider in the air is flying on
    purpose, and a passenger on the balloon or the ferry is not the one steering. That last one
    only half worked — the vehicle lives on world.js's own package state and nothing has ever set
    player.veh — so ask G.worldPkg as well, and keep the old field for whoever starts writing it. */
 function aboard(){ try{ return !!(player.veh||(G.worldPkg&&G.worldPkg.veh)); }catch(e){ return !!player.veh; } }
 /* A silent teleport is a glitch; the same teleport with a line of text is a feature. Say where
    she has been taken and what is in front of her, and only when she has actually been moved. */
 function lineUp(c,x,z,rotY,ahead){
  /* Being near the line is not the same as being ON it: 'already lined up' has to mean pointing
     down the approach as well as standing beside it. Distance alone is what let the seasonal
     trial begin with the rider sitting in the ranch yard — five metres off the approach, turned
     a hundred and sixty degrees away from element one, the first fence literally behind her and
     the start box standing over there without her — because the yard falls inside the twelve
     metre courtesy. That courtesy is for a rider who has walked up to the line herself, and a
     rider who has walked up to the line is facing down it. */
  const askew=Math.abs(wrapA(player.heading-rotY))>0.35;
  const moved=(Math.hypot(player.pos.x-x,player.pos.z-z)>12||askew)&&!player.flying&&!aboard();
  if(moved){
   player.pos.set(x,0,z); player.y=0; player.vy=0; player.speed=0; player.heading=rotY;
   try{ if(W.pushOut)W.pushOut(player,0.7); }catch(e){}    // world.js's own push-out, for anything the search missed
   x=player.pos.x; z=player.pos.z;
   toast('🏁 Lined up at '+(c.ev.town||'the arena')+' — '+ahead);
  }
  let y=0; try{y=+W.groundH(x,z).toFixed(2);}catch(e){}
  CUR.start={x:+x.toFixed(2),z:+z.toFixed(2),y,heading:+rotY.toFixed(3),moved};
  return showBox(x,z,rotY);
 }
 const AHEAD={race:'the first gate is ahead.',xc:'the first obstacle is ahead.',
  gauntlet:'the first element is ahead.',jump:'the first fence is ahead.'};
 function marshal(c){
  const j=c.jumps&&c.jumps[0]; if(!j)return null;
  const at=findSpot(c,j.x-Math.sin(j.rotY)*10,j.z-Math.cos(j.rotY)*10,j.rotY,j,[j.x,j.z]);
  return lineUp(c,at[0],at[1],j.rotY,AHEAD[discOf(c.ev).k]||AHEAD.jump);
 }
 /* A test has no first obstacle to line up behind — it has a letter. Every test in the game opens
    'enter at A', the judge sits at C, and the centre line between them is the direction the horse
    faces. tickDressage closes a figure the moment the rider is inside 3.5 m of its letter, so
    standing her ON A would hand her the opening figure for nothing; she is put two horse-lengths
    outside the short side instead and walks in, which is the movement that figure is asking for.
    The letters are read live rather than from ARENA_HOME because shiftArena has already carried
    them to the town on the card, and a Cottonwood test is ridden at Cottonwood. */
 function marshalTest(c,show){
  const AL=G.course.ARENA_LETTERS, A=AL&&AL.A, C=AL&&AL.C; if(!A||!C)return null;
  const dx=C[0]-A[0], dz=C[1]-A[1], d=Math.hypot(dx,dz)||1, rotY=Math.atan2(dx/d,dz/d);
  /* 2.5 m: enough that she is never marshalled onto the letter itself, with the arrow bobbing at
     her feet and nothing to ride. It deliberately does NOT try to clear the 3.5 m a figure closes
     at — tickDressage now wants a metre and a half of travel before it will close one, so no
     distance hands her the opening figure, and a player can park on A herself anyway. Holding out
     for 4.5 here cost more than it bought: the ranch's own arena has barely four metres between
     its short-side rail and A, so the search had to step off the centre line to obey, and the
     centre line is the thing a test is ridden down. */
  const at=findSpot(c,A[0]-dx/d*7,A[1]-dz/d*7,rotY,null,[A[0],A[1]],2.5);
  return lineUp(c,at[0],at[1],rotY,show?'walk in at A — the judge is waiting at C.'
                                       :'walk in at A and ride the centre line to C.');
 }

 /* ================================================================= pace-setters ========== */
 /* A race with nobody in it is not a race. PvP needs a club, a connection and a human awake at
    the same moment, so a solo rider has always ridden an empty track with a HUD that read P1/1.
    These are pace-setters, not people: the valley's own ranches, riding the same loop at a pace
    drawn from the same deterministic hash the weekly board already uses for their times, labelled
    as what they are. Beating one is worth the placing and nothing else — a ghost can never be a
    PvP win, because c.pvp stays false and no racing point is minted here. */
 const GHOST_COATS=[['#6b4a2f','#3a2a1c'],['#b5895a','#4a3524'],['#8a8f96','#2e3238'],['#d6c4a1','#7a6248'],['#4a3a2e','#241a12']];
 const GH={list:[],cum:[],len:0,laps:1,on:false};
 function ghostPace(c,len,nm,str,k){
  const wk=G.time.weekKey(), par=c.par||len/7.2;
  const f=1.0+0.55*hash('gs'+c.ev.id+wk+nm+k);                 // 1.00–1.55 of par before the ranch's own form
  return len/(par*f/Math.max(0.9,Math.min(1.25,str||1)));      // metres a second, held all the way round
 }
 function buildGhosts(c){
  GH.list=[]; GH.on=false;
  if(!G.horse.makeHorse||c.pvp||c.friendly)return;
  try{ if(Object.keys(G.horse.remotes||{}).length)return; }catch(e){}   // a real field is already out there
  let pts=(T.RACE_ROUTES[c.ev.route]||[]).map(p=>p.slice()); if(pts.length<3)return;
  if(c.ev.rev)pts=pts.reverse();
  GH.cum=[0]; GH.len=0;
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];GH.len+=Math.hypot(b[0]-a[0],b[1]-a[1]);GH.cum.push(GH.len);}
  GH.pts=pts; GH.laps=(c.ce&&c.ce.laps)||1;
  const wk=G.time.weekKey(), pool=(T.NEIGHBOURS||[]).slice();
  const n=Math.min(pool.length,2+Math.floor(hash('gn'+c.ev.id+wk)*3));
  for(let k=0;k<n;k++){
   const pick=Math.floor(hash('gp'+c.ev.id+wk+k)*pool.length)%pool.length;
   const row=pool.splice(pick,1)[0]; if(!row)break;
   const nm=row[0], str=row[1]||1, col=GHOST_COATS[Math.floor(hash('gc'+nm)*GHOST_COATS.length)%GHOST_COATS.length];
   let parts=null; try{parts=G.horse.makeHorse({colors:{body:col[0],mane:col[1]},seed:Math.floor(hash('gd'+nm)*9)});}catch(e){parts=null;}
   if(!parts||!parts.group)continue;
   const sp=G.nameSprite('🐴 '+nm+' · pace-setter'); sp.position.y=2.9; sp.scale.set(3.2,0.5,1); parts.group.add(sp);
   G.scene.add(parts.group);
   GH.list.push({nm,parts,s:0,v:ghostPace(c,GH.len,nm,str,k),phase:hash('gf'+nm)*6,done:false});
  }
  GH.on=GH.list.length>0;
 }
 function ghostAt(s){
  const pts=GH.pts, cum=GH.cum, L=GH.len; s=((s%L)+L)%L;
  let i=0; while(i<cum.length-2&&cum[i+1]<s)i++;
  const a=pts[i], b=pts[(i+1)%pts.length], seg=Math.max(0.001,cum[i+1]-cum[i]), f=(s-cum[i])/seg;
  return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,Math.atan2(b[0]-a[0],b[1]-a[1])];
 }
 function tickGhosts(c,dt,t){
  if(!GH.on||!c.started)return;
  const total=GH.len*GH.laps, RS=G.ranchSys;
  for(const g of GH.list){
   if(!g.done){g.s+=g.v*dt; if(g.s>=total){g.s=total;g.done=true;}}
   const [x,z,rot]=ghostAt(g.s);
   g.parts.group.position.set(x,W.groundH(x,z),z); g.parts.group.rotation.y=rot;
   g.phase+=dt*(g.done?1.6:7.5);
   try{ if(RS&&RS.animateHorse)RS.animateHorse(g.parts,g.phase,g.done?0.25:0.9,(RS.GAITS||{})[g.done?'walk':'gallop'],true,t,0); }catch(e){}
  }
 }
 function clearGhosts(){ for(const g of GH.list){try{G.scene.remove(g.parts.group);}catch(e){}} GH.list=[]; GH.on=false; }
 /* where the rider is round the loop, so the placing is the same arithmetic for everyone */
 function playerArc(c){
  const j=c.jumps[c.idx]; if(!j||!GH.cum.length)return 0;
  const lap=((c.ce&&c.ce.lap)||1)-1, rem=Math.hypot(player.pos.x-j.x,player.pos.z-j.z);
  return Math.max(0,lap*GH.len+(GH.cum[Math.min(c.idx,GH.cum.length-1)]||0)-rem);
 }
 function ghostPlace(c){
  if(!GH.on)return null;
  const me=playerArc(c); let ahead=0;
  for(const g of GH.list)if(g.s>me)ahead++;
  return {place:ahead+1,field:GH.list.length+1};
 }

 /* ================================================================= styles + HUD chips ==== */
 const style=document.createElement('style');
 style.textContent='#ev2Call{position:fixed;top:calc(36% + 62px);left:50%;transform:translateX(-50%);z-index:8;display:none;'
  +'font-family:var(--display,inherit);font-size:15px;font-weight:700;color:#fff8ea;text-shadow:0 3px 14px rgba(40,25,5,.6);text-align:center;pointer-events:none;line-height:1.4}'
  +'#ev2Call.on{display:block}'
  +'.ev2card{width:100%;font-size:11px;color:#6b5a45;line-height:1.5}.ev2card b{color:#3d2f22}'
  +'.ev2chip{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:#f0e7d6;color:#6b5a45;margin-right:5px}'
  +'.ev2chip.jump{background:#dde9f7;color:#24506e}.ev2chip.xc{background:#e2efdc;color:#3f5f2c}.ev2chip.race{background:#ffe9c4;color:#8a6413}'
  +'.ev2chip.dressage{background:#efe2f7;color:#5c3f7a}.ev2chip.show{background:#fde8ee;color:#8a3f5a}.ev2chip.gauntlet{background:#e7e2d6;color:#6b5a45}'
  +'.ev2grid{display:flex;gap:5px;flex-wrap:wrap;width:100%;margin-top:3px}'
  +'.ev2grid button{font-size:11px;padding:4px 9px}.ev2grid button.on{background:#3f8f4c;color:#fff8ea}'
  +'.evrow.ev2hide{display:none!important}'
  +'.ev2sheet{width:100%;font-size:12px;line-height:1.6;color:#4a3526}'
  +'.ev2sheet .r{display:flex;gap:8px;align-items:center;border-bottom:1px dashed #e6d6b8;padding:3px 0}'
  +'.ev2sheet .r b{flex:1}.ev2sheet .v{font-variant-numeric:tabular-nums;font-weight:800}';
 document.head.appendChild(style);
 const callEl=document.createElement('div'); callEl.id='ev2Call'; document.body.appendChild(callEl);

 /* ================================================================= per-course state ====== */
 const CUR={c:null,disc:null,fx:[],fenceFaults:0,refuseAt:{},lastRef:0,lastGrades:0,elim:false,
  xcTime:0,xcJump:0,gateSum:0,gateN:0,watch:null,hazHits:0,raceAcc:null,lastIdx:0,
  show:null,fig:-1,figQ:null,handling:0,turnout0:0,camT:0,goldBefore:false,hud:''};
 function resetCur(c){
  CUR.c=c||null; CUR.disc=c?discOf(c.ev).k:null; CUR.fx=[]; CUR.fenceFaults=0; CUR.refuseAt={}; CUR.lastRef=0; CUR.lastGrades=0;
  CUR.elim=false; CUR.xcTime=0; CUR.xcJump=0; CUR.gateSum=0; CUR.gateN=0; CUR.watch=null; CUR.hazHits=0; CUR.raceAcc=null;
  CUR.lastIdx=0; CUR.place=null; CUR.gold=false; CUR.rib=0; CUR.show=null; CUR.fig=-1; CUR.figQ=null; CUR.handling=0; CUR.turnout0=0; CUR.camT=0; CUR.hud=''; CUR.demoted=false; CUR.lifted=0; CUR.start=null;
 }
 function addFx(g){ if(g)CUR.fx.push(g); }
 function clearFx(){ for(const g of CUR.fx)disposeGroup(g); CUR.fx=[]; }

 /* ================================================================= the arena travels ===== */
 /* tickDressage reads ARENA_LETTERS straight out of the inline table every frame, so the honest
    way to hold a class at Cottonwood is to move the letters — the table, the posts standing in
    the world, and the judge's idea of where X is, together — and put them back afterwards. */
 const ARENA_HOME={}; for(const L in (G.course.ARENA_LETTERS||{}))ARENA_HOME[L]=G.course.ARENA_LETTERS[L].slice();
 let letterShift=null;
 function shiftArena(dx,dz){
  const AL=G.course.ARENA_LETTERS; if(!AL)return;
  for(const L in ARENA_HOME)AL[L]=[+(ARENA_HOME[L][0]+dx).toFixed(2),+(ARENA_HOME[L][1]+dz).toFixed(2)];
  letterShift=[dx,dz];
 }
 function homeArena(){
  if(!letterShift)return; const AL=G.course.ARENA_LETTERS;
  for(const L in ARENA_HOME)AL[L]=ARENA_HOME[L].slice();
  letterShift=null;
 }
 function placeLetters(c){
  const AL=G.course.ARENA_LETTERS, keys=Object.keys(ARENA_HOME);
  if(!c.letters||c.letters.length!==keys.length)return;
  keys.forEach((L,i)=>{ const g=c.letters[i], p=AL[L]; if(!g||!p)return; g.position.set(p[0],W.groundH(p[0],p[1]),p[1]); });
 }

 /* ================================================================= difficulty on a test == */
 /* Difficulty used to move the purse and nothing else on the nine judged classes: the same six
    figures, the same holds, the same par, and 2.14x the money for the identical ride. */
 const DIFF_EXTRA={
  dressage:[{at:'B',gait:'canter',circle:true,text:'Elite: a second circle at B'},{at:'H',gait:'canter',fast:true,text:'Elite: lengthen down the long side to H'},{at:'E',gait:'trot',text:'Elite: collect back to a trot at E'}],
  show:[{at:'M',gait:'walk',text:'Elite: walk on to M for the second look'},{at:'C',gait:'halt',hold:3,text:'Elite: stand square at C for the judge'}],
 };
 function bendTest(c){
  const S=c.ce, d=(S&&S.diff)||DIFFS[DI_OPEN], k=d.k, show=!!(c.ev.kind==='show');
  c.ev2Diff=k;
  if(k==='novice'){
   for(const f of c.figs){ if(f.hold)f.hold=Math.max(1,f.hold-1); if(f.fast)f.fast=false; }
  }else if(k==='elite'){
   for(const f of c.figs){ if(f.hold)f.hold=f.hold+1; }
   const pool=DIFF_EXTRA[show?'show':'dressage'];
   const add=pool[Math.floor(hash('x'+c.ev.id)*pool.length)%pool.length];
   const at=Math.max(1,c.figs.length-1);
   c.figs.splice(at,0,Object.assign({good:0,total:0,sweep:0,lastAng:null,holdT:0,score:null},add));
  }
  /* finishDressage reads ev.par, not c.par, for its star equivalence, and ev.par is the card's
     number — so the level is felt in the marks themselves rather than by moving a shared field. */
 }

 /* ================================================================= courseStart =========== */
 G.on('courseStart',c=>{
  if(!c)return;
  clearFx(); clearGhosts(); homeArena(); hideBox(); resetCur(c);
  try{const sv=G.save.fresh()||{};CUR.goldBefore=!!(sv.ribbonGold||{})[c.ev.id];}catch(e){}
  const S=c.ce||null;
  /* ---- the judged classes ---- */
  if(c.dressage){
   const show=!!(c.show||c.ev.kind==='show');
   try{bendTest(c);}catch(e){console.error('ev2 bendTest',e);}
   if(c.ev.at){ const X=ARENA_HOME.X||[2,1]; shiftArena(c.ev.at[0]-X[0],c.ev.at[1]-X[1]); placeLetters(c); }
   /* after the arena has travelled, never before: A is wherever the letters have just been put */
   try{addFx(marshalTest(c,show));}catch(e){console.error('ev2 marshalTest',e);}
   if(show){
    CUR.show={still:0,fidget:0,square:0,crooked:0,rush:0,quiet:0};
    CUR.turnout0=c.turnout==null?0:c.turnout;
    CUR.camT=3.0;                                        // the inspection beat, before the first stride
    openJudgeSheet(c);
   }
   caption(c);
   return;
  }
  if(!S)return;                                          // a course nobody graded — leave it alone
  /* ---- the obstacles ---- */
  if(S.kind==='jump'&&!c.ev.gauntlet){ try{reskinFences(c,FENCE_TYPES,true);}catch(e){console.error('ev2 fences',e);} }
  if(S.kind==='xc'){
   try{reskinFences(c,XC_TYPES,false);}catch(e){console.error('ev2 xc',e);}
   S.xcModel=true; S.xcOpt=c.par;                        // an optimum time, not an allowance
  }
  /* ---- the gauntlet's season ---- */
  if(c.ev.gauntlet){
   const def=gauntletDef(seasonKey()); addFx(buildDecor(c,def.decor,T.RACE_ROUTES[c.ev.route]||GT_BASE));
   if(c.ev.limit)S.timeAllowed=c.ev.limit;               // the hard limit IS the clock, at every level
  }
  /* ---- the start line, the hazards, the field ---- */
  /* Unconditional now. It used to read `if(c.race||c.ev.xc)`, which is why the nine jumping
     rounds were the only events in the game you had to hack to. Anything that reaches here with
     a first obstacle gets the race's own treatment; marshal answers null for anything that does
     not, so a course kind a sister package invents tomorrow costs nothing. */
  /* wrapped because the hazards, the field and the countdown caption all come after it, and a
     start line nobody could build must not cost the rider the rest of her round */
  try{addFx(marshal(c));}catch(e){console.error('ev2 marshal',e);}
  if(c.race)tidyHazards(c);                              // events-pvp laid its own set two hooks ago
  if(S.kind==='race'&&!c.ev.gauntlet)buildGhosts(c);
  caption(c);
 });
 /* The countdown was a bare 110px numeral over an empty field. Say what is being called. */
 function caption(c){
  const d=discOf(c.ev), S=c.ce, diff=(S&&S.diff)||null;
  callEl.innerHTML=d.icon+' <b>'+c.ev.name+'</b><br>'+d.label+' · '+c.ev.town
   +(diff?' · '+diff.icon+' '+diff.label:'')+(c.pvp||c.friendly?' · a field is on the line':'')
   +(GH.on?'<br>🏁 '+GH.list.length+' pace-setters from the valley: '+GH.list.map(g=>g.nm).join(', '):'');
  callEl.classList.add('on');
 }

 /* ================================================================= hazards =============== */
 /* Two packages built different things at the same two coordinates: course-engine's permanent
    speed pads and events-pvp's fallen logs, on the level-one race. The pad promises a boost and
    the log takes a second and most of the speed. The runtime filter is the safe fix — a sister
    package may lay more pads tomorrow. */
 function padPoints(c){
  const out=[];
  try{for(const t of (W.things||[]))if(t&&t.kind==='pad')out.push([t.x,t.z]);}catch(e){}
  for(const it of (c.items||[]))if(it&&it.pad)out.push([it.x,it.z]);
  return out;
 }
 function makeHazardLog(x,z,seed){
  const g=new THREE.Group(), m=W.mats.plankBrownMat;
  const log=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,2.8,8),m); log.rotation.z=Math.PI/2; log.position.y=0.26; g.add(log);
  g.position.set(x,W.groundH(x,z),z); g.rotation.y=hash(seed)*Math.PI; G.scene.add(g);
  return {x,z,g,cd:0,bale:false};
 }
 function clearOf(x,z){
  try{ if(Math.abs(z-W.riverZ(x))<10)return false; }catch(e){}
  try{ for(const col of (W.colliders||[]))if(Math.hypot(x-col.x,z-col.z)<col.r+1.5)return false; }catch(e){}
  return true;
 }
 function tidyHazards(c){
  if(!c||G.course.get()!==c)return;
  const pads=padPoints(c);
  let lifted=0;
  if(c.hazards&&c.hazards.length){
   const keep=[];
   for(const h of c.hazards){
    if(!h.bale&&pads.some(p=>Math.hypot(h.x-p[0],h.z-p[1])<3.5)){disposeGroup(h.g);lifted++;continue;}
    keep.push(h);
   }
   c.hazards=keep;
  }
  /* five of the eleven routes had no hand-placed hazards at all, so a rider who worked up to the
     Ridge Chase found a blanker track than the beginner's pasture dash. */
  const pts=T.RACE_ROUTES[c.ev.route]||[];
  if(pts.length&&(!c.hazards||c.hazards.length<3)){
   c.hazards=c.hazards||[];
   /* every leg is offered several places to put a log, and the first that is clear of the gates,
      the pads, the water and anything solid takes it — the legs are short on some loops */
   const FRACS=[0.3,0.7,0.44,0.85,0.18];
   for(let i=0;i<pts.length&&c.hazards.length<7;i++){
    const a=pts[i], b=pts[(i+1)%pts.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<10)continue;
    const off=Math.floor(hash('hz'+c.ev.route+i)*FRACS.length);
    for(let k=0;k<FRACS.length;k++){
     const f=FRACS[(off+k)%FRACS.length];
     const x=+(a[0]+(b[0]-a[0])*f).toFixed(1), z=+(a[1]+(b[1]-a[1])*f).toFixed(1);
     if(Math.min(f,1-f)*len<4.5)continue;
     if(!clearOf(x,z))continue;
     if(pads.some(q=>Math.hypot(x-q[0],z-q[1])<4))continue;
     if(c.jumps.some(j=>Math.hypot(x-j.x,z-j.z)<4.5))continue;
     if((c.hazards||[]).some(h=>Math.hypot(x-h.x,z-h.z)<10))continue;
     c.hazards.push(makeHazardLog(x,z,'gen'+c.ev.route+i));
     break;
    }
   }
  }
  CUR.lifted=lifted;
 }

 /* ================================================================= the judge's sheet ===== */
 let sheetFor=null;
 function turnoutParts(c){ return (c&&c.turnoutParts)||[]; }
 const RAISE={coat:'brush her until she shines — 🧺 Care',hair:'plait the mane and bang the tail — 🎀 Wardrobe',
  tack:'four pieces of tack, one in every slot',set:'four pieces from one set, not four sets',manner:'ride with her — manners are bond'};
 function sheetHtml(){
  const c=sheetFor; if(!c)return '<div class="ph"><b>🧼 The judge\'s card</b><button data-fx="close:ev2SheetPanel" style="margin-left:auto">✖</button></div><span class="ev2card">No class on the card.</span>';
  const parts=turnoutParts(c), tn=CUR.turnout0||c.turnout||0, hd=CUR.handling;
  let h='<div class="ph"><b>🧼 '+c.ev.name+' — the judge\'s card</b><button data-fx="close:ev2SheetPanel" style="margin-left:auto">✖</button></div>';
  h+='<div class="ev2sheet">';
  for(const x of parts){
   const v=Math.round((x.v||0)*100), w=Math.round((x.p.w||0)*100);
   h+='<div class="r">'+x.p.icon+' <b>'+x.p.label+'</b><span class="v">'+v+'%</span><span style="flex:none;font-size:10px;color:#8c7a63">weight '+w+'%</span></div>';
   if(v<90)h+='<div style="font-size:11px;color:#8c7a63;margin:-2px 0 4px 22px">to raise it: '+(RAISE[x.p.k]||'ride her better')+'</div>';
  }
  h+='<div class="r"><b>🧼 Turnout, all told</b><span class="v">'+Math.round(tn*100)+'%</span></div>';
  h+='<div class="r"><b>🤲 Handling in the ring</b><span class="v">'+(CUR.show?Math.round(hd*100)+'%':'—')+'</span>'
   +'<span style="flex:none;font-size:10px;color:#8c7a63">stand still, stand square, walk when the pattern says walk</span></div>';
  h+='</div><span class="ev2card">Half the class is how she is presented and half is the pattern. Standing square through a halt and holding a quiet walk between the letters is marked into the pattern figure by figure — a jog at the wrong moment costs the mark, not the clock.</span>';
  return h;
 }
 G.ui.panel({id:'ev2SheetPanel',title:'🧼 Judge\'s card',render(){return sheetHtml();}});
 function openJudgeSheet(c){ sheetFor=c; try{G.ui.open('ev2SheetPanel');}catch(e){} }

 /* ================================================================= the result ============ */
 /* There was no results screen. A round ended, #courseHud went to display:none, and the line
    that said what had happened joined a toast queue that shows one message at a time — measured
    at twenty-six seconds behind the finish on a featured win. The result is the point of the
    round, so it is a card, it is up before the horse has pulled up, and it is written in the
    currency of the discipline that was just ridden. */
 let RESULT=null;
 function resultHtml(){
  const R=RESULT;
  if(!R)return '<div class="ph"><b>🏁 Result</b><button data-fx="close:ev2ResultPanel" style="margin-left:auto">✖</button></div><span class="ev2card">Nothing ridden yet.</span>';
  let h='<div class="ph"><b>'+R.icon+' '+R.name+'</b><span class="chip" style="font-size:12px;padding:3px 10px">'+R.stars+'</span>'
   +'<button data-fx="close:ev2ResultPanel" style="margin-left:auto">✖</button></div>';
  h+='<div class="evrow" style="flex-wrap:wrap"><span class="ev2chip '+R.disc+'">'+R.icon+' '+R.label+'</span>'
   +'<span class="ev2card" style="width:100%">📍 '+R.town+(R.diff?' · '+R.diff:'')+'</span></div>';
  h+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">📋 The sheet</b><div class="ev2sheet">'
   +R.rows.map(r=>'<div class="r"><b>'+r[0]+'</b><span class="v">'+r[1]+'</span></div>').join('')+'</div></div>';
  if(R.figs&&R.figs.length)
   h+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎽 Figure by figure</b><div class="ev2sheet">'
    +R.figs.map(f=>'<div class="r"><b>'+f[0]+'</b><span class="v">'+f[1]+'/10</span></div>').join('')+'</div></div>';
  h+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎀 Ribbons and purse</b><span class="ev2card">'
   +R.ribbons+'<br>🎁 '+R.pay+'</span></div>';
  h+='<div class="evrow"><button data-fx="ev2:again:'+R.id+'">Ride it again</button><button data-fx="close:ev2ResultPanel">Close</button></div>';
  return h;
 }
 G.ui.panel({id:'ev2ResultPanel',title:'🏁 Result',render(){return resultHtml();}});
 function starsOf(n){ return n>=3?'⭐⭐⭐':n>=2?'⭐⭐':'⭐'; }
 function buildResult(c,ev,stars,RB,pay,dressage,pct){
  const d=discOf(ev), S=(c&&c.ce)||{}, rows=[];
  const diff=(S.diff&&(S.diff.icon+' '+S.diff.label))||(c&&c.ev2Diff)||'';
  if(dressage){
   const total=(c.figs||[]).reduce((a,f)=>a+(f.score||0),0), outOf=10*((c.figs||[]).length||1);
   rows.push(['Score',Math.round((pct||0)*100)+'%']);
   rows.push(['Figures',total+'/'+outOf]);
   if(CUR.show){
    rows.push(['🧼 Turnout',Math.round((CUR.turnout0||0)*100)+'%']);
    rows.push(['🤲 Handling',Math.round(CUR.handling*100)+'%']);
    for(const x of turnoutParts(c))rows.push([x.p.icon+' '+x.p.label,Math.round((x.v||0)*100)+'%']);
   }
   rows.push(['Band',(pct>=0.95?'🥇 gold':pct>=0.9?'⭐⭐⭐':pct>=0.75?'⭐⭐':pct>=0.6?'a finish':'under the band')]);
  }else if(S.xcModel){
   rows.push(['⏱ Time',(c.t||0).toFixed(1)+'s against a '+Math.round(S.xcOpt||0)+'s optimum']);
   rows.push(['Time penalties',CUR.xcTime.toFixed(1)]);
   rows.push(['Jumping penalties',String(CUR.xcJump)]);
   rows.push(['XC score',(CUR.xcTime+CUR.xcJump).toFixed(1)+((CUR.xcTime+CUR.xcJump)===0?' — a clear inside the time':'')]);
  }else if(S.kind==='race'){
   rows.push(['⏱ Time',(c.t||0).toFixed(1)+'s of '+Math.round(S.timeAllowed||0)+'s allowed']);
   if(GH.on)rows.push(['Placing','P'+(GH.list.filter(g=>g.done).length+1)+'/'+(GH.list.length+1)+' — '+GH.list.map(g=>g.nm).join(', ')]);
   rows.push(['Gates',Math.round(gateClean()*100)+'% through the middle']);
   rows.push(['Line',(S.lineOff||0)<1?'clean':'off for '+(S.lineOff||0).toFixed(1)+'s']);
   rows.push(['Hazards hit',String(CUR.hazHits)]);
   rows.push(['🎯 Score',Math.round((CUR.raceAcc==null?0:CUR.raceAcc)*100)+'%'+(CUR.demoted?' — short of the gold':'')]);
  }else{
   rows.push(['⏱ Time',(c.t||0).toFixed(1)+'s of '+Math.round(S.timeAllowed||0)+'s allowed']);
   rows.push(['Faults',String(CUR.fenceFaults)+(CUR.fenceFaults?'':' — clear round')]);
   if(S.refusals)rows.push(['Refusals',String(S.refusals)]);
   if(S.grades&&S.grades.length){const cnt={};for(const g of S.grades)cnt[g]=(cnt[g]||0)+1;
    rows.push(['Fences',Object.keys(cnt).map(k=>((GRADE[k]||{}).icon||k)+'×'+cnt[k]).join(' ')]);}
   rows.push(['🎯 Accuracy',Math.round(((RB&&RB.acc)||(c.rb&&c.rb.acc)||0)*100)+'%']);
   if(S.lineOff>=1)rows.push(['Line','off for '+S.lineOff.toFixed(1)+'s']);
  }
  const rib=(RB&&RB.rib)||CUR.rib||0, gold=CUR.gold&&!dressage?true:!!(RB&&RB.gold);
  RESULT={id:ev.id,name:ev.name,town:ev.town,disc:d.k,label:d.label,icon:d.icon,diff,
   stars:starsOf(stars||1),rows,
   figs:dressage&&c.figs?c.figs.map(f=>[f.text,f.score==null?0:f.score]):null,
   ribbons:(rib?'🎀'.repeat(Math.max(0,Math.min(3,rib-(gold?1:0))))+(gold?' 🥇 gold ribbon':''):'none this time')
    +((RB&&RB.featured)?' · featured this week':'')+((RB&&RB.msg&&/new best/.test(RB.msg))?' · a new best':''),
   pay:(pay?pay+'🪙':'no purse')+((RB&&RB.featured)?' · featured this week ×1.5':'')};
 }

 /* ================================================================= the full event card === */
 let cardFor=null;
 function statXpFor(ev){
  const base=Math.max(8,Math.round(ev.reward/7)), d=discOf(ev).k;
  if(d==='dressage'||d==='show')return {agility:base,accel:Math.round(base*0.6)};
  if(d==='xc')return {stamina:base,jump:Math.round(base*0.8)};
  if(d==='race'||d==='gauntlet')return {speed:base,stamina:Math.round(base*0.7)};
  return {jump:base,agility:Math.round(base*0.8)};
 }
 function rewardLine(ev,di){
  const d=diffAt(di), sx=statXpFor(ev), parts=[Math.round(ev.reward*d.rewMul)+'🪙',Math.round(ev.reward/8)+' XP'];
  for(const k in sx)parts.push(sx[k]+' '+String(T.STAT_LBL[k]||k).split(' ').pop()+' XP');
  parts.push('50 pass pts','1–5💎');
  return parts.join(' · ');
 }
 function allowedLine(ev,di){
  const d=discOf(ev);
  if(ev.gauntlet&&ev.limit)return fmtT(ev.limit)+' hard limit';
  if(d.k==='dressage'||d.k==='show')return 'a percentage, not a clock';
  try{ if(G.course.eventTimeAllowed)return fmtT(G.course.eventTimeAllowed(ev,di))+' allowed'; }catch(e){}
  return fmtT((ev.time||G.course.eventPar(ev)*1.4)*diffAt(di).parMul)+' allowed';
 }
 const SCORE_BANDS='60% finishes · 75% ⭐⭐ · 90% ⭐⭐⭐ · 95% 🥇';
 function reqLine(ev,h){
  const bits=[]; const lvl=(h&&h.level)||1;
  bits.push((lvl>=ev.lvl?'✅':'🔒')+' Level '+ev.lvl+' (you are '+lvl+')');
  if(ev.req)for(const k in ev.req){ let have=0; try{have=(h&&h.stats&&h.stats[k])||0;}catch(e){}
   bits.push((have>=ev.req[k]?'✅':'🔒')+' '+(T.STAT_LBL[k]||k)+' '+ev.req[k]+' (you have '+have+')'); }
  return bits.join('<br>');
 }
 function cardHtml(){
  const ev=cardFor; let s={},h=null;
  try{s=G.save.fresh()||{};}catch(e){}
  try{h=ridden();}catch(e){}
  if(!ev)return '<div class="ph"><b>ℹ️ Event card</b><button data-fx="close:ev2CardPanel" style="margin-left:auto">✖</button></div>';
  const d=discOf(ev), di=s.evDiff==null?DI_OPEN:s.evDiff, judged=(d.k==='dressage'||d.k==='show');
  let html='<div class="ph"><b>'+d.icon+' '+ev.name+'</b><button data-fx="close:ev2CardPanel" style="margin-left:auto">✖</button></div>';
  html+='<div class="evrow" style="flex-wrap:wrap"><span class="ev2chip '+d.k+'">'+d.icon+' '+d.label+'</span>'
   +'<span class="ev2card" style="width:100%">📍 '+ev.town+' · '+discDetail(ev)+' · '+d.sub
   +'<br>Asks for '+d.stats.map(k=>T.STAT_LBL[k]||k).join(' and ')+'</span></div>';
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">⏱ The round</b><span class="ev2card">'
   +(judged?'Marked out of ten a figure. <b>'+SCORE_BANDS+'</b>'+(s.bestScore&&s.bestScore[ev.id]?'<br>Your best here: <b>'+Math.round(s.bestScore[ev.id]*100)+'%</b>':'')
           :'<b>'+allowedLine(ev,di)+'</b>'+(ev.laps>1?' · '+ev.laps+' laps':'')+(ev.line?' · 📏 ride the marked line':'')
            +(d.k==='xc'?'<br>Cross country is scored the eventing way: an <b>optimum time of '+fmtT(ev.par||0)+'</b>, 0.4 penalties a second over it, 20 for a refusal and 40 for a second at the same obstacle.':'')
            +(d.k==='race'?'<br>Judged on the clock, on how near the middle of each gate you were, and on what you hit.':'')
            +(d.k==='jump'?'<br>4 faults a rail, 4 for a refusal and 8 for the second — three at one fence and you are out.':'')
            +(s.bestTimes&&s.bestTimes[ev.id]?'<br>Your best here: <b>'+s.bestTimes[ev.id]+'s</b>':''))
   +'</span></div>';
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🚪 To get in</b><span class="ev2card">'+reqLine(ev,h)+'</span></div>';
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎁 What it pays · '+diffAt(di).label+'</b><span class="ev2card">'+rewardLine(ev,di)+'</span></div>';
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎚️ The three levels</b>';
  for(let i=0;i<DIFFS.length;i++){
   const D=DIFFS[i], rb=(s.ribbonsBy||{})[ev.id+':'+D.k]||0;
   html+='<div class="evrow" style="width:100%">'+D.icon+' <b>'+D.label+'</b><span style="font-size:11px">'
    +Math.round(ev.reward*D.rewMul)+'🪙 · '+(judged?('holds '+(D.k==='novice'?'a second shorter':D.k==='elite'?'a second longer, one extra figure, a stricter judge':'as written')):allowedLine(ev,i))
    +(D.lvlAdd?' · opens at Lv '+(ev.lvl+D.lvlAdd):'')+' · '+D.desc+(rb?' · '+'🎀'.repeat(Math.min(3,rb)):'')+'</span></div>';
  }
  html+='</div>';
  const r=(s.ribbons||{})[ev.id]||0, gold=!!(s.ribbonGold||{})[ev.id];
  html+='<div class="evrow"><span class="ev2card">🎀 Ribbons here: '+(r?'🎀'.repeat(Math.min(3,r-(gold?1:0)))+(gold?'🥇':''):'none yet')
   +(s.ev2&&s.ev2.xcBest&&s.ev2.xcBest[ev.id]!=null?' · best XC score '+s.ev2.xcBest[ev.id]:'')+'</span>'
   +'<button data-fx="close:ev2CardPanel">Close</button></div>';
  return html;
 }
 G.ui.panel({id:'ev2CardPanel',title:'ℹ️ Event card',render(){return cardHtml();}});

 /* ================================================================= the programme rows ==== */
 /* ui2-compete sweeps whatever the row renderers left over into a .c2-evExtra block and hides it
    as a duplicate unless it contains something interactive. Everything the game knows about an
    event was in that block at display:none. One real button in it and the whole card — ours,
    course-engine's and events-pvp's together — is on screen again. */
 G.ui.eventRow((ev,s,h)=>{
  const d=discOf(ev);
  return '<div class="ev2card" data-ev2="'+ev.id+'">'
   +'<span class="ev2chip '+d.k+'">'+d.icon+' '+d.label+'</span>'+discDetail(ev)+' · '+d.sub
   +'<br>'+(d.k==='dressage'||d.k==='show'?'🎯 '+SCORE_BANDS:'⏱ '+allowedLine(ev,s&&s.evDiff))
   +'<span class="ev2grid"><button data-fx="ev2:card:'+ev.id+'" title="The whole card before you commit">ℹ️ Full card</button></span></div>';
 });
 let FILTER=null;
 function discCounts(){ const out={}; for(const ev of T.EVENTS3)out[discOf(ev).k]=(out[discOf(ev).k]||0)+1; return out; }
 G.ui.eventCard((s,h)=>{
  const n=discCounts();
  return '<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🏇 The programme · '+T.EVENTS3.length+' classes</b>'
   +'<span class="ev2card">Six disciplines, and they are not the same sport. Filter the programme:</span>'
   +'<span class="ev2grid">'+DISC_ORDER.filter(k=>n[k]).map(k=>'<button class="'+(FILTER===k?'on':'')+'" data-fx="ev2:filter:'+k+'">'+DISCS[k].icon+' '+DISCS[k].label+' '+n[k]+'</button>').join('')
   +'<button class="'+(FILTER==='open'?'on':'')+'" data-fx="ev2:filter:open">✅ Can enter now</button>'
   +'<button class="'+(FILTER?'':'on')+'" data-fx="ev2:filter:all">All</button></span></div>';
 });
 G.ui.action('ev2',(a)=>{
  const k=a[0];
  if(k==='card'){ cardFor=evById(a[1]); if(cardFor)G.ui.open('ev2CardPanel'); return; }
  if(k==='sheet'){ G.ui.open('ev2SheetPanel'); return; }
  if(k==='again'){ const ev=evById(a[1]); G.hidePanels(); if(ev)setTimeout(()=>{try{G.course.startCourse(ev);}catch(e){}},60); return; }
  if(k==='filter'){ FILTER=(a[1]==='all'||FILTER===a[1])?null:a[1]; try{G.ui.openEvents();G.ui.openEvents();}catch(e){} try{fixRows();}catch(e){} return; }
 });
 function eventOfRow(row){
  let nm=''; const t=row.querySelector('.c2-evTitle');
  if(t)nm=(t.textContent||'').trim();
  else{ const b=row.querySelector(':scope > b'); nm=b?(b.textContent||'').trim():''; }
  if(!nm)return null;
  return T.EVENTS3.find(e=>e.name===nm)||null;
 }
 /* The compete skin writes the discipline line and the spec grid from its own idea of what an
    event is: a showmanship class reads 'Dressage', the gauntlet reads 'Race', and a dressage
    class advertises its score as a number of seconds. That file belongs to another package, so
    the row is corrected where it is drawn instead. */
 function fixRows(){
  const p=$('eventsPanel'); if(!p||p.style.display==='none')return;
  const rows=p.querySelectorAll('.evrow');
  for(const row of rows){
   try{
    const ev=eventOfRow(row); if(!ev)continue;
    const d=discOf(ev);
    const stage=row.dataset.c2||'-';
    if(row.dataset.ev2row!==ev.id||row.dataset.ev2c2!==stage){
     const where=row.querySelector('.c2-evWhere');
     if(where)where.innerHTML='📍 '+ev.town+' · '+d.label+' · '+discDetail(ev);
     if(d.k==='dressage'||d.k==='show'){
      row.querySelectorAll('.c2-spec').forEach(sp=>{
       const kk=sp.querySelector('.c2-k'), vv=sp.querySelector('.c2-v');
       if(!kk||!vv)return;
       if(/score to beat/i.test(kk.textContent||'')){ kk.textContent='To beat'; vv.textContent='75% ⭐⭐ · 90% ⭐⭐⭐'; vv.title=SCORE_BANDS; }
      });
     }
     row.dataset.ev2row=ev.id; row.dataset.ev2c2=stage; row.dataset.ev2disc=d.k;
     let ok=true; try{ok=!G.course.eventOk||G.course.eventOk(ev,ridden()).ok;}catch(e){}
     row.dataset.ev2ok=ok?'1':'0';
    }
   }catch(e){}
  }
  applyFilter();
 }
 function applyFilter(){
  const p=$('eventsPanel'); if(!p)return;
  p.querySelectorAll('.evrow').forEach(row=>{
   const d=row.dataset.ev2disc; if(!d)return;
   const hide=FILTER?(FILTER==='open'?row.dataset.ev2ok!=='1':d!==FILTER):false;
   row.classList.toggle('ev2hide',hide);
  });
 }

 /* ================================================================= showmanship =========== */
 /* events-pvp routes a showmanship class straight into the dressage engine, which scores it on
    time-in-the-right-gait. Nothing judged standing square and nothing judged manners. The class
    keeps that engine — it is a good one — and is fed the missing evidence in its own currency. */
 const baseShow=G.course.kinds&&G.course.kinds.show;
 G.course.kinds.show=ev=>{
  const h=ridden();
  if(!h){toast('🧼 Pick a horse to show first.');return;}
  if(baseShow)baseShow(ev); else G.course.startDressage(ev);
 };
 function showFrame(c,dt){
  const f=c.figs&&c.figs[c.fi]; if(!f||c.done)return 1;
  const SH=CUR.show; if(!SH)return 1;
  const AL=G.course.ARENA_LETTERS, at=AL&&AL[f.at]; if(!at)return 1;
  const d=Math.hypot(player.pos.x-at[0],player.pos.z-at[1]), sp=Math.abs(player.speed);
  let q=1;
  if(f.gait==='halt'){
   if(d<6){
    if(sp<0.14){SH.still+=dt;}else{SH.fidget+=dt;q=0.25;}
    /* square: standing straight on the arena's centre line, either way up it */
    const X=AL.X||[2,1], C=AL.C||[2,17], axis=Math.atan2(C[0]-X[0],C[1]-X[1]);
    const err=Math.min(Math.abs(wrapA(player.heading-axis)),Math.abs(wrapA(player.heading-axis-Math.PI)));
    if(err<0.4){SH.square+=dt;}else{SH.crooked+=dt;q=Math.min(q,0.55);}
   }
  }else{
   const want=f.gait==='walk'?2.8:f.gait==='trot'?7:99;
   if(sp>want+1.6){SH.rush+=dt;q=0.3;}else{SH.quiet+=dt;}
  }
  const good=SH.still+SH.square+SH.quiet, bad=SH.fidget+SH.crooked+SH.rush;
  CUR.handling=clamp(good/Math.max(0.6,good+bad*1.6),0,1);
  return q;
 }

 /* ================================================================= the round ============= */
 const GRADE=(G.course&&G.course.GRADE)||{};
 function fenceOf(c){ return c.jumps&&c.jumps[c.idx]; }
 function nextName(c){
  const j=fenceOf(c); if(!j)return '';
  if(j.gtKind)return j.gtKind;
  if(j.fenceLabel)return j.fenceLabel;
  return j.kind==='gate'?'gate':'fence';
 }
 /* course-engine pushes a grade per crossing; the classical fault currency is read off that same
    list so the two never disagree about what happened. */
 function priceGrades(c){
  const S=c.ce; if(!S||!S.grades)return;
  for(let i=CUR.lastGrades;i<S.grades.length;i++){
   const g=S.grades[i];
   /* a refusal leaves the index where it was; every other grade has already advanced it, so the
      fence that earned the grade is the one behind us */
   const at=g==='refusal'?c.idx:(c.idx-1+c.jumps.length)%c.jumps.length;
   const j=c.jumps[at], mul=(j&&j.fenceMul)||1;
   if(g==='fault'){ CUR.fenceFaults+=Math.round(4*mul); CUR.xcJump+=Math.round(11*mul); }
   else if(g==='refusal'){
    const key=(S.lap||1)+':'+at; CUR.refuseAt[key]=(CUR.refuseAt[key]||0)+1;
    const n=CUR.refuseAt[key];
    CUR.fenceFaults+=n===1?4:8; CUR.xcJump+=n===1?20:40;
    if(n>=3&&!CUR.elim)eliminate(c);
   }
  }
  CUR.lastGrades=S.grades.length;
 }
 function eliminate(c){
  CUR.elim=true;
  toast('🛑 Three refusals at the same obstacle — eliminated. 60🪙 for the try; walk her home and come back.');
  try{G.money.addCoins(60);}catch(e){}
  setTimeout(()=>{try{G.course.cancelCourse();}catch(e){}},0);
 }
 /* A gate cannot be marked on the range at which it scores. course-engine rings the gate and
    advances the course the instant the rider is inside 4.6 units of it, so 4.6 is the closest
    range anyone is ever observed at while the gate is still the live one — which marked a rider
    galloping dead through the middle at 3% and put the gold ribbon out of everybody's reach.
    She passes the middle a few frames AFTER the ring lights, so the gate is kept under watch
    until she is clear of it and the mark is the nearest she actually came to the flag. */
 function watchGate(j){ CUR.watch={j,min:Math.hypot(player.pos.x-j.x,player.pos.z-j.z)}; }
 function tickWatch(){
  const w=CUR.watch; if(!w)return;
  const d=Math.hypot(player.pos.x-w.j.x,player.pos.z-w.j.z);
  if(d<w.min)w.min=d; else if(d>w.min+0.6||d>9)commitGate();      // she is going away again: that was the nearest
 }
 function commitGate(){ const w=CUR.watch; if(!w)return; CUR.gateSum+=Math.min(4.6,w.min); CUR.gateN++; CUR.watch=null; }
 function gateClean(){ return CUR.gateN?clamp(1-(CUR.gateSum/CUR.gateN)/4.6,0,1):1; }
 function raceScore(c){
  const S=c.ce||{}, t=c.t||0, par=c.par||1;
  const clock=clamp(par/Math.max(0.1,t),0,1);
  const clean=clamp(1-CUR.hazHits*0.08,0,1);
  const line=Math.min(0.2,(S.lineOff||0)*0.02);
  return clamp(clock*0.5+gateClean()*0.3+clean*0.2-line,0,1);
 }
 G.on('courseTick',(c,dt,t)=>{
  if(!c||G.course.get()!==c)return;
  const S=c.ce;
  /* ---- judged classes: feed the inline scorer what it cannot see ---- */
  if(c.dressage){
   const f=c.figs&&c.figs[c.fi];
   if(f&&!c.done){
    const d=(S&&S.diff)||DIFFS[DI_OPEN];
    if(CUR.show){ const q=showFrame(c,dt); f.total+=dt*0.6; f.good+=dt*0.6*q; }
    /* a kind judge and a strict one: the same wrong gait costs half again at Elite and is
       half forgiven at Novice, in the engine's own good/total currency */
    if(d.k!=='open'&&f.gait!=='halt'){
     const sp=Math.abs(player.speed), g=sp<0.3?'halt':sp<2.8?'walk':sp<7?'trot':'canter';
     if(g!==f.gait){ if(d.k==='elite')f.total+=dt*0.5; else f.good+=dt*0.5; }
    }
   }
   dressHud(c);
   return;
  }
  if(!S)return;
  priceGrades(c);
  /* ---- races: gate cleanliness, hazards hit ---- */
  if(S.kind==='race'||S.kind==='xc'){
   if(c.idx!==CUR.lastIdx){
    const was=c.jumps[CUR.lastIdx];
    commitGate();                                        // whatever was still being watched is finished with
    if(was&&was.kind==='gate')watchGate(was);
    CUR.lastIdx=c.idx;
   }
   tickWatch();
   for(const h of (c.hazards||[])){ if(h.cd>2.9&&!h._ev2)  {h._ev2=1;CUR.hazHits++;} if(h.cd<=0)h._ev2=0; }
  }
  if(S.kind==='race'){ CUR.raceAcc=raceScore(c); S.raceAcc=CUR.raceAcc; S.gateClean=gateClean(); tickGhosts(c,dt,t); CUR.place=ghostPlace(c); }
  /* ---- cross country: the eventing score ---- */
  if(S.xcModel){
   const over=Math.max(0,(c.t||0)-(S.xcOpt||0));
   CUR.xcTime=Math.round(over*0.4*10)/10;
   S.xcPen=+(CUR.xcTime+CUR.xcJump).toFixed(1);
  }
  hud(c);
 });
 function dressHud(c){
  const f=c.figs&&c.figs[c.fi]; const S=c.ce, d=(S&&S.diff)||null;
  const done=c.fi||0, sofar=c.figs.slice(0,done).reduce((a,x)=>a+(x.score||0),0);
  const pct=done?Math.round(100*sofar/(10*done)):null;
  const base=CUR.show?'🧼 Showmanship':'🎽 Dressage';
  let line=base+(d?' · '+d.icon+' '+d.label:'')+' · figure '+Math.min(done+1,c.figs.length)+'/'+c.figs.length;
  if(CUR.show)line+=' · 🧼 turnout '+Math.round((CUR.turnout0||0)*100)+'% · 🤲 handling '+Math.round(CUR.handling*100)+'%';
  if(pct!=null)line+=' · 🎯 '+pct+'%';
  if(f)line+=' — '+f.text+(f.hold?' ('+f.holdT.toFixed(1)+'/'+f.hold+'s)':'');
  const el=$('courseHudTxt'); if(el)el.textContent=line;
  CUR.hud=line;
 }
 function hud(c){
  const S=c.ce; if(!S)return;
  const el=$('courseHudTxt'); if(!el)return;
  const t=(c.t||0).toFixed(1), lim=Math.round(S.timeAllowed||0), nx=nextName(c), n=c.jumps.length;
  const lap=S.laps>1?' · Lap '+S.lap+'/'+S.laps:'';
  let line='';
  if(c.ev.gauntlet){
   line='⏳ '+(c.ev.name||'Trial')+' · '+(nx?nx+' ':'')+(c.idx+1)+'/'+n+' · ⏱ '+t+'/'+Math.round(c.ev.limit||lim)+'s'
    +(CUR.fenceFaults?' · ⚠️ '+CUR.fenceFaults:'');
  }else if(S.kind==='xc'){
   const over=Math.max(0,(c.t||0)-(S.xcOpt||0));
   line='🌲 Obstacle '+(c.idx+1)+'/'+n+lap+' · next '+nx+' · ⏱ '+t+'/'+Math.round(S.xcOpt||0)+'s optimum'
    +(over>0?' (+'+CUR.xcTime.toFixed(1)+')':'')+(CUR.xcJump?' · 🛑 '+CUR.xcJump:'')
    +' · XC '+((CUR.xcTime+CUR.xcJump).toFixed(1));
  }else if(S.kind==='race'){
   line='🏁 Gate '+(c.idx+1)+'/'+n+lap+(CUR.place?' · P'+CUR.place.place+'/'+CUR.place.field:'')
    +' · ⏱ '+t+'/'+lim+'s · 🎯 '+Math.round((CUR.raceAcc==null?1:CUR.raceAcc)*100)+'%'
    +(CUR.gateN?' · gates '+Math.round((S.gateClean||1)*100)+'%':'')+(CUR.hazHits?' · 🪵×'+CUR.hazHits:'');
  }else{
   line='⤴️ Fence '+(c.idx+1)+'/'+n+lap+' · next '+nx+' · Faults '+CUR.fenceFaults+' · ⏱ '+t+'/'+lim+'s'
    +(S.lastGrade&&GRADE[S.lastGrade]?' · '+GRADE[S.lastGrade].icon:'');
  }
  el.textContent=line; CUR.hud=line;
 }

 /* ================================================================= ribbons + finish ====== */
 G.on('ribbons',RB=>{
  const c=G.course.get(), S=c&&c.ce, ev=RB&&RB.ev;
  if(!ev||!S||S.dressage)return;
  if(S.kind==='race'&&c.started){
   /* a race's accuracy used to be its time restated, so the gold ribbon — the price of a place
      on the weekly board — was the stopwatch read twice. Gate discipline counts now. */
   commitGate();
   const acc=raceScore(c); CUR.raceAcc=acc; S.raceAcc=acc; S.gateClean=gateClean();
   RB.acc=+acc.toFixed(3); if(c.rb)c.rb.acc=RB.acc;
   const want=RB.acc>=0.95&&(RB.faults||0)===0&&(RB.refusals||0)===0&&(RB.lineOff||0)<1&&gateClean()>=0.9;
   if(RB.gold&&!want){
    RB.gold=false; RB.rib=Math.max(1,(RB.rib|0)-1); CUR.demoted=true;
    if(!CUR.goldBefore)G.save.sync(s=>{if(s.ribbonGold)delete s.ribbonGold[ev.id];});
   }
  }
  if(S.xcModel){ RB.xcTime=CUR.xcTime; RB.xcJump=CUR.xcJump; RB.xcTotal=+(CUR.xcTime+CUR.xcJump).toFixed(1); }
  RB.faultPoints=CUR.fenceFaults;
  CUR.gold=!!RB.gold; CUR.rib=RB.rib|0;
 });
 function showResult(c,ev,stars,RB,pay,dressage,pct){
  try{buildResult(c,ev,stars,RB,pay,dressage,pct);G.ui.open('ev2ResultPanel');}catch(e){console.error('ev2 result',e);}
 }
 G.on('courseFinish',({c,ev,stars,RB,pay,dressage,pct})=>{
  if(!c)return;
  const S=c.ce;
  if(dressage){
   if(CUR.show){
    G.save.sync(s=>{s.ev2=s.ev2||{};s.ev2.handling=s.ev2.handling||{};
     if(!s.ev2.handling[ev.id]||CUR.handling>s.ev2.handling[ev.id])s.ev2.handling[ev.id]=+CUR.handling.toFixed(3);});
    sheetFor=c;
    if(CUR.handling>=0.9)G.quest.dailyEvt('ev2hand',1);
   }
   showResult(c,ev,stars,RB,pay,true,pct);
   return;
  }
  if(!S)return;
  if(S.xcModel){
   const total=+(CUR.xcTime+CUR.xcJump).toFixed(1);
   G.save.sync(s=>{s.ev2=s.ev2||{};s.ev2.xcBest=s.ev2.xcBest||{};
    if(s.ev2.xcBest[ev.id]==null||total<s.ev2.xcBest[ev.id])s.ev2.xcBest[ev.id]=total;});
   toast('🌲 '+ev.name+' — '+CUR.xcTime.toFixed(1)+' time · '+CUR.xcJump+' jumping · total '+total+(total===0?' — a clear inside the optimum!':''));
   if(total===0)G.quest.dailyEvt('ev2clear',1);
  }else if(S.kind==='jump'){
   if(!CUR.fenceFaults&&!(S.refusals||0)){G.save.sync(s=>{s.ev2=s.ev2||{};s.ev2.clean=(s.ev2.clean||0)+1;});G.quest.dailyEvt('ev2clear',1);}
   else toast('⤴️ '+ev.name+' — '+CUR.fenceFaults+' faults'+(S.refusals?' · '+S.refusals+' refusal'+(S.refusals>1?'s':''):''));
  }else if(S.kind==='race'&&CUR.raceAcc!=null){
   const home=GH.on?(' · P'+(GH.list.filter(g=>g.done).length+1)+'/'+(GH.list.length+1)+' of the field'):'';
   toast('🏁 Gates '+Math.round((S.gateClean||1)*100)+'%'+home+' · '+((S.lineOff||0)<1?'line clean':'line +'+Math.floor((S.lineOff||0)/2)+'s')
    +' · '+CUR.hazHits+' hazard'+(CUR.hazHits===1?'':'s')+(CUR.demoted?' — not tidy enough for the gold':''));
  }
  if(ev.gauntlet)G.save.sync(s=>{s.ev2=s.ev2||{};s.ev2.gaunt=s.ev2.gaunt||{};const k=seasonKey();
   if(s.ev2.gaunt[k]==null||c.t<s.ev2.gaunt[k])s.ev2.gaunt[k]=+c.t.toFixed(1);});
  showResult(c,ev,stars,RB,pay,false,null);
 });

 /* ================================================================= per frame ============= */
 let lastCourse=null, uiT=0;
 G.on('camera',({dt})=>{
  if(!(CUR.camT>0)||!player.mesh)return false;
  const cam=G.camera, m=player.mesh, a=CUR.camT*1.1;
  cam.position.lerp(new THREE.Vector3(m.position.x+Math.sin(a)*4.2,m.position.y+2.2,m.position.z+Math.cos(a)*4.2),1-Math.exp(-6*dt));
  cam.lookAt(m.position.x,m.position.y+1.5,m.position.z);
  return true;
 });
 G.on('tick',(dt,t)=>{
  const c=G.course.get();
  if(lastCourse&&lastCourse!==c){ clearFx(); clearGhosts(); homeArena(); hideBox(); callEl.classList.remove('on'); if(!c)resetCur(null); }
  lastCourse=c;
  if(c&&!c.started)callEl.classList.add('on'); else callEl.classList.remove('on');
  if(CUR.camT>0&&c&&!c.started)CUR.camT-=dt; else CUR.camT=0;
  /* the Events panel is rebuilt from scratch every time it opens, so the corrections and the
     filter are re-applied whenever it is on screen */
  uiT+=dt;
  if(uiT>0.3){ uiT=0; try{fixRows();}catch(e){} }
 });

 /* ================================================================= quests ================ */
 G.quest.addDaily({type:'ev2clear',icon:'✨',label:'Go clear — a round with no faults',goal:1,r:{c:180,p:18}});
 G.quest.addDaily({type:'ev2hand',icon:'🤲',label:'Handle a showmanship class at 90%',goal:1,r:{c:200,p:20}});
 G.quest.addAch({id:'ev2clean5',icon:'✨',label:'Clear round',desc:'Five jumping rounds with no faults at all',v:s=>(s.ev2&&s.ev2.clean)||0,goal:5,r:{c:600,g:2}});
 G.quest.addAch({id:'ev2xc0',icon:'🌲',label:'Inside the time',desc:'Finish a cross country on a zero score',v:s=>Object.values((s.ev2&&s.ev2.xcBest)||{}).filter(v=>v===0).length,goal:1,r:{c:700,g:3}});
 G.quest.addAch({id:'ev2hand9',icon:'🤲',label:'Quiet hands',desc:'A 90% handling mark in a showmanship class',v:s=>Math.round(100*Math.max(0,...[0].concat(Object.values((s.ev2&&s.ev2.handling)||{})))),goal:90,r:{g:3,k:1}});

 /* ================================================================= state ================= */
 G.on('state',o=>{
  const c=G.course.get(), S=c&&c.ce;
  o.ev2={filter:FILTER,gauntlet:{season:seasonKey(),route:(T.EVENTS3.find(e=>e.gauntlet)||{}).route,limit:(T.EVENTS3.find(e=>e.gauntlet)||{}).limit},
   arenaShift:letterShift?letterShift.slice():null,
   pars:T.EVENTS3.filter(e=>e.route).reduce((a,e)=>{a[e.id]=e.par;return a;},{})};
  if(c){
   o.ev2.hud=CUR.hud; o.ev2.disc=discOf(c.ev).k;
   o.ev2.faults=CUR.fenceFaults; o.ev2.elim=CUR.elim;
   o.ev2.fenceTypes=c.jumps?c.jumps.map(j=>j.fenceType||j.gtKind||j.kind):[];
   if(S&&S.xcModel)o.ev2.xc={opt:+(S.xcOpt||0).toFixed(1),time:CUR.xcTime,jump:CUR.xcJump,total:+(CUR.xcTime+CUR.xcJump).toFixed(1)};
   if(S&&S.kind==='race')o.ev2.race={acc:CUR.raceAcc==null?null:+CUR.raceAcc.toFixed(3),gates:+(S.gateClean==null?1:S.gateClean).toFixed(3),hazards:CUR.hazHits,
    field:GH.on?GH.list.length+1:1,place:CUR.place?CUR.place.place:1,pacers:GH.list.map(g=>({n:g.nm,s:+g.s.toFixed(1),v:+g.v.toFixed(2)}))};
   if(c.dressage)o.ev2.judged={show:!!CUR.show,handling:+CUR.handling.toFixed(3),turnout:+(CUR.turnout0||0).toFixed(3),
    figures:c.figs?c.figs.length:0,holds:c.figs?c.figs.map(f=>f.hold||0):[],diff:c.ev2Diff||null,par:c.par};
   /* the box is its own long-lived mesh now, so the flag reads its visibility as well as the
      per-course furniture the gauntlet's décor still goes through */
   /* Two different facts, reported separately. They were briefly ORed into one field when the
      start box stopped going through addFx, which kept a start-box check passing but made a
      DECOR check — a different suite asking whether the gauntlet still lays its season's
      scenery — true no matter what, since a box is up at every start. */
   o.ev2.startBox=!!(SBOX&&SBOX.visible);      // the start box mesh is standing
   o.ev2.fx=CUR.fx.length>0;                   // course scenery groups are laid
   /* where the rider was put, whether she was carried there at all, and the height of the ground
      under her — enough for a headless check to see the fast travel without reading the scene */
   o.ev2.start=CUR.start||null;
  }
 });

 /* handles for QA and sister packages */
 G.events2={DISCS,discOf,discDetail,obstacleCount,FENCE_TYPES,XC_TYPES,GAUNTLET_SEASONS,gauntletDef,applyGauntletSeason,
  routeLen,fixPars,rewardLine,allowedLine,SCORE_BANDS,reqLine,openCard(id){cardFor=evById(id);if(cardFor)G.ui.open('ev2CardPanel');},
  openSheet(){G.ui.open('ev2SheetPanel');},setFilter(k){FILTER=k;applyFilter();},filter:()=>FILTER,fixRows,applyFilter,
  state:CUR,shiftArena,homeArena,ARENA_HOME,tidyHazards,marshal,marshalTest,findSpot,standable,wet,onWall,
  startBox:()=>SBOX,hideBox,ghosts:GH,ghostPlace,playerArc};
}
