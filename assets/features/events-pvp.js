/* Feature package 'events-pvp'. Owned by that package: edit only this file and the inline hot spots
   assigned to it. See index.js for the contract. Nothing runs at import time.

   What lives here — everything that is built ON TOP of a course once course-engine has graded it:

     championship   every event is a qualifier for the Basin Championship; four regional venues
                    (Cottonwood, Barleyfold, Coyote, Hollowpeak) must each yield two ribbons
                    before the Final at Hollowpeak will let you in
     showmanship    three judged turnout classes: half the mark is how the horse is presented
                    (coat, mane and tail, tack, a matching set, manners) and half is a quiet
                    walked pattern between the arena letters
     dressage       four more scored tests (d3–d6) with a 'lengthen' figure, and the Dance of
                    Harmony — a shared routine any club rider can call and everyone scores at home
     freestyle      the arena letters stand up on their own with no clock, six formation calls
                    that go out over the club, and a seat in the grandstand to watch from
     gauntlet       a seasonal trial: one mixed obstacle loop per season (gates, rails, cones,
                    weaves and logs) against a hard time limit
     weekly boards  the four featured events rank by completion time — but only a GOLD ribbon
                    puts you on the board — and settle on Monday into a seven-step prize ladder
     pvp racing     host or join a live race over the club: a shared countdown, live placement,
                    hazards on the track, six pick-up items (two of which are used on rivals),
                    race tickets, a six-rank ladder, breeding tokens and stat XP for a result
     friendly races no-stakes challenges to whoever is riding nearby
     bundles        four themed kits — a horse, a full tack set, an outfit and a hamper — earned
                    by taking the trophies of a whole region */
export const id='events-pvp';
export function install(G){
 const THREE=G.THREE, $=G.$, T=G.tables, W=G.world, player=G.horse.player;
 const toast=(...a)=>G.toast(...a);          // called through G so a QA run can listen in
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const fmtT=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
 const ridden=()=>G.horse.ridden();
 const evById=k=>T.EVENTS3.find(e=>e.id===k);
 function hash(str){let h=0x811c9dc5|0;for(let i=0;i<String(str).length;i++){h^=String(str).charCodeAt(i);h=Math.imul(h,0x01000193);}return ((h>>>8)&0xffff)/0xffff;}
 const nowWeek=()=>G.time.weekKey();

 /* ================================================================= data ================= */
 /* --- the championship ------------------------------------------------------------------ */
 const CHAMP_VENUES=[['Cottonwood','🏘️'],['Barleyfold','🌾'],['Coyote','🤠'],['Hollowpeak','🏔️']];
 const CHAMP_NEED=2;                                        // two ribbons at a venue qualifies it

 /* --- showmanship ----------------------------------------------------------------------- */
 /* Turnout is judged before you move off. Five parts, weighted, and they add to one. */
 const SHOW_PARTS=[
  {k:'coat',  w:0.32,icon:'🧼',label:'Coat & grooming', v:(s,h)=>clamp(((h.needs&&h.needs.clean)||0)/100,0,1)},
  {k:'hair',  w:0.16,icon:'🎀',label:'Mane & tail',     v:(s,h)=>{const a=h.hair||{};return (a.mane&&a.mane!=='natural'?0.5:0.25)+(a.tail&&a.tail!=='natural'?0.5:0.3);}},
  {k:'tack',  w:0.26,icon:'🐴',label:'Tack turnout',    v:(s,h)=>{let n=0;for(const sl of T.GEAR_SLOTS)if(h.gear&&h.gear[sl])n++;return n/4;}},
  {k:'set',   w:0.12,icon:'✨',label:'A matching set',  v:(s,h)=>{try{const b=G.horse.setBonus(h)||{};const c=b._counts||{};const best=Math.max(0,...Object.values(c));return best>=4?1:best>=2?0.6:0;}catch(e){return 0;}}},
  {k:'manner',w:0.14,icon:'🤝',label:'Manners (bond)',  v:(s,h)=>clamp(((h.bond)||0)/100,0,1)},
 ];
 const SHOW_TESTS={
  s1:[{at:'A',gait:'walk',text:'Walk in at A and present'},{at:'X',gait:'halt',hold:3,text:'Halt at X for the judge'},{at:'C',gait:'walk',text:'Walk on to C'},{at:'B',gait:'halt',hold:2,text:'Halt at B for the inspection'},{at:'A',gait:'walk',text:'Walk quietly back to A'}],
  s2:[{at:'A',gait:'walk',text:'Walk in at A'},{at:'X',gait:'halt',hold:3,text:'Halt and salute at X'},{at:'K',gait:'walk',text:'Walk the long side to K'},{at:'E',gait:'halt',hold:2,text:'Stand square at E'},{at:'M',gait:'walk',text:'Walk across to M'},{at:'C',gait:'halt',hold:3,text:'Final halt at C'},{at:'A',gait:'walk',text:'Walk out at A'}],
  s3:[{at:'A',gait:'walk',text:'Enter at A on a loose rein'},{at:'X',gait:'halt',hold:4,text:'Halt at X, four seconds'},{at:'F',gait:'walk',text:'Walk to F'},{at:'B',gait:'trot',text:'Trot up for the judge to B'},{at:'E',gait:'halt',hold:2,text:'Halt at E'},{at:'H',gait:'walk',text:'Walk to H'},{at:'C',gait:'halt',hold:3,text:'Stand for the ribbon at C'},{at:'A',gait:'walk',text:'Walk out at A'}],
 };
 const SHOW_EVENTS=[
  {id:'s1',town:'Cottonwood',name:'Cottonwood Showmanship',lvl:3,kind:'show',dressage:true,par:80,reward:350},
  {id:'s2',town:'Barleyfold',name:'Barleyfold Halter Classic',lvl:6,kind:'show',dressage:true,par:100,reward:650},
  {id:'s3',town:'Hollowpeak',name:'Hollowpeak Best In Show',lvl:9,kind:'show',dressage:true,par:120,reward:1100},
 ];

 /* --- more dressage, and the Dance of Harmony ------------------------------------------- */
 const NEW_TESTS={
  d3:[{at:'A',gait:'trot',text:'Enter at A at a working trot'},{at:'K',gait:'trot',text:'Serpentine: trot to K'},{at:'E',gait:'walk',text:'Walk the loop at E'},{at:'H',gait:'trot',text:'Pick the trot up again to H'},{at:'C',gait:'canter',text:'Canter on to C'},{at:'X',gait:'halt',hold:2,text:'Halt at X and salute'}],
  d4:[{at:'A',gait:'canter',text:'Enter at A in canter'},{at:'B',gait:'canter',circle:true,text:'Canter a circle at B'},{at:'E',gait:'canter',circle:true,text:'Change the rein — circle at E'},{at:'M',gait:'canter',fast:true,text:'Lengthen the stride to M'},{at:'C',gait:'trot',text:'Come back to a trot at C'},{at:'X',gait:'halt',hold:3,text:'Halt at X, three seconds'}],
  d5:[{at:'A',gait:'trot',text:'Enter at A at a medium trot'},{at:'X',gait:'halt',hold:2,text:'Halt at X and salute'},{at:'F',gait:'trot',text:'Trot to F'},{at:'B',gait:'canter',circle:true,text:'Canter a circle at B'},{at:'M',gait:'canter',fast:true,text:'Lengthen across the diagonal to M'},{at:'H',gait:'trot',text:'Collect back to a trot at H'},{at:'E',gait:'canter',circle:true,text:'Canter a circle at E'},{at:'K',gait:'walk',text:'Free walk to K'},{at:'C',gait:'trot',text:'Trot on to C'},{at:'A',gait:'walk',text:'Walk home to A'},{at:'X',gait:'halt',hold:3,text:'Final halt at X'}],
  d6:[{at:'A',gait:'walk',text:'Enter at A — freestyle to music'},{at:'X',gait:'halt',hold:2,text:'Open with a halt at X'},{at:'E',gait:'canter',circle:true,text:'Canter a circle at E'},{at:'F',gait:'trot',text:'Trot the diagonal to F'},{at:'B',gait:'canter',circle:true,text:'Canter a circle at B'},{at:'H',gait:'canter',fast:true,text:'Lengthen down the long side to H'},{at:'C',gait:'walk',text:'Walk to C'},{at:'X',gait:'halt',hold:3,text:'Salute at X'}],
  dance:[{at:'X',gait:'halt',hold:2,text:'Form up and halt at X'},{at:'B',gait:'canter',circle:true,text:'Circle at B together'},{at:'E',gait:'canter',circle:true,text:'Mirror the circle at E'},{at:'C',gait:'trot',text:'Trot up the centre to C'},{at:'X',gait:'halt',hold:2,text:'Close the dance at X'}],
 };
 const NEW_DRESSAGE=[
  {id:'d3',town:'Barleyfold',name:'Barleyfold Serpentine Test',lvl:4,dressage:true,par:75,reward:450},
  {id:'d4',town:'Coyote',name:'Coyote Canyon Canter Test',lvl:5,dressage:true,par:85,reward:560},
  {id:'d5',town:'Hollowpeak',name:'Hollowpeak Medium Test',lvl:8,dressage:true,par:110,reward:900},
  {id:'d6',town:'Kestrel Basin',name:'Basin Freestyle to Music',lvl:9,dressage:true,par:120,reward:1100},
 ];
 const DANCE_EV={id:'dance',town:'Meadowlark Ranch',name:'Dance of Harmony',lvl:1,dressage:true,par:60,reward:220};
 const FIGURE_CALLS=['Circle at B','Circle at E','Serpentine A to C','Halt at X','Down the centre line','Half-pass to M','Change the rein at X'];

 /* --- the seasonal gauntlet -------------------------------------------------------------- */
 const GT_ROUTE=[[-20,-24],[-42,-46],[-72,-54],[-100,-44],[-116,-20],[-108,6],[-84,26],[-54,32],[-30,22],[-18,0]];
 const GT_KINDS=['gate','fence','cone','weave','log'];      // cycled along the loop
 const GAUNTLETS={
  bloom:{name:'Blossom Trials',icon:'🌸',blurb:'Petals on the rails and the ground still soft.'},
  sun:  {name:'Long Sun Trials',icon:'☀️',blurb:'Dust, heat, and a clock that does not care.'},
  ember:{name:'Ember Trials',icon:'🍂',blurb:'Leaves across the line and an early dark.'},
  frost:{name:'Frostmane Trials',icon:'❄️',blurb:'Hard ground, cold rails, and breath on the air.'},
 };
 const GT_LIMIT=150;                                        // hard time limit, seconds

 /* --- races: favoured traits, hazards, items, tickets, ranks ---------------------------- */
 const RACE_TRAITS={rr:['speed'],r1:['stamina','speed'],r2:['stamina','agility'],pp:['accel'],
  bd:['speed','stamina','agility'],wt:['stamina','jump'],a2:['stamina','jump'],x2:['stamina','jump','agility'],gt:['agility','jump']};
 const TRAIT_MATCH_AT=7;                                    // a stat of 7+ counts as a match
 /* Natural hazards laid on the track: a fallen log, a rut, a puddle. Hit one and you lose a
    second and most of your speed — unless you are carrying a shield. */
 const RACE_HAZARDS={
  rr:[[0,94],[30,148],[90,145],[40,40]],
  r1:[[0,94],[100,150],[148,40],[60,-130],[-115,-50],[-45,70]],
  pp:[[-26,-18],[-70,-50],[-115,-10],[-90,32],[-45,26]],
  bd:[[-90,55],[-160,80],[-232,116],[-160,156],[-88,104]],
  wt:[[-70,-90],[-136,-146],[-196,-202],[-186,-242],[-64,-140]],
  gt:[[-31,-35],[-86,-49],[-112,-7],[-69,29],[-24,11]],
 };
 const HAZ_TIME=1.0, HAZ_SLOW=0.4;
 const TIX_DAILY=3, TIX_MAX=12, TIX_PRICE=60;
 const RACE_RANKS=[
  {k:'paddock',label:'Paddock Pony',icon:'🐴',at:0,   r:{}},
  {k:'bronze', label:'Bronze Bit',  icon:'🥉',at:100, r:{c:300,tickets:3}},
  {k:'silver', label:'Silver Stirrup',icon:'🥈',at:300,r:{g:5,gear:'Rare'}},
  {k:'gold',   label:'Gold Girth',  icon:'🥇',at:700, r:{g:10,k:2,tickets:5}},
  {k:'colours',label:'Kestrel Colours',icon:'🪶',at:1200,r:{g:14,btok:1,tickets:6}},
  {k:'champion',label:'Basin Champion',icon:'🏆',at:2000,r:{g:20,gear:'Epic',tickets:8,btok:1}},
 ];

 /* --- the weekly leaderboard prize ladder ------------------------------------------------ */
 /* The ladder is Star Equestrian's shape, in Meadowlark's money. Three thousand gems is two
    hundred times this game's whole economy, so the gem numbers are scaled by LB_GEM_SCALE and
    the key numbers by LB_KEY_SCALE — the ladder is printed as it stands and paid as it fits. */
 const LB_GEM_SCALE=0.01, LB_KEY_SCALE=0.3;
 const LB_PRIZES=[
  {place:1,   label:'1st',      excl:1,   g:0,    k:0},
  {place:2,   label:'2nd',      excl:0.5, g:3000, k:0},
  {place:3,   label:'3rd',      excl:0.25,g:2500, k:0},
  {place:10,  label:'4th–10th', excl:0,   g:0,    k:10},
  {place:25,  label:'11th–25th',excl:0,   g:0,    k:5},
  {place:100, label:'26th–100th',excl:0,  g:0,    k:3},
  {place:1000,label:'101st–1000th',excl:0,g:0,    k:2},
 ];
 const EXCL_BREEDS=['kestrel','aurora','tempest','meadowlight'];

 /* --- themed bundles --------------------------------------------------------------------- */
 const BUNDLES3=[
  {id:'bounty',label:'Coyote Bounty',emoji:'🤠',need:['b1','b2','bd','d4'],horse:'palomino',set:'Coyote',rarity:'Legendary',
   outfit:{shirt:'#b34a4a',pants:'#8a6745',helmet:'#b3622f'},items:{carrot:20,pumpkin:6},c:600,
   blurb:'Canyon leather, a dust-coloured mustang and a hamper for the long ride home.'},
  {id:'trail',label:'Kestrel Trailblazer',emoji:'🪶',need:['rr','r1','r2','pp'],horse:'thoro',set:'Kestrel',rarity:'Legendary',
   outfit:{shirt:'#4a7ab3',pants:'#cfc6ae',helmet:'#2e4a70'},items:{oats:8,apple:10},c:600,
   blurb:'The fastest tack in the basin and a thoroughbred to hang it on.'},
  {id:'deluxe',label:'Arena Dressage Deluxe',emoji:'🎽',need:['d1','d2','d3','s1'],horse:'lipiz',set:'Champion',rarity:'Legendary',
   outfit:{shirt:'#e8d9b8',pants:'#f4f0e6',helmet:'#2e2e38'},items:{truffle:4,lettuce:8},c:900,
   blurb:'Whites, a grey with a neck like a wave, and what a winner wears.'},
  {id:'ridge',label:'Hollowpeak Ridge Kit',emoji:'🏔️',need:['w1','wt','x2','s3'],horse:'fjord',set:'Aurora',rarity:'Legendary',
   outfit:{shirt:'#8aa0b8',pants:'#4a5a70',helmet:'#c8d8e8'},items:{hay:12,oats:6},c:900,
   blurb:'Everything the ridge asks for, and a pony that has never once slipped on it.'},
 ];

 /* ================================================================= save ================= */
 G.save.ensure(s=>{
  s.racing=s.racing||{pts:0,races:0,wins:0,pvp:0,claimed:{}};
  const d=G.time.dateKey();
  if(!s.tix||s.tix.date!==d)s.tix={date:d,n:Math.max(TIX_DAILY,(s.tix&&s.tix.n)||0)};
  if(s.tickets){s.tix.n=Math.min(TIX_MAX,(s.tix.n||0)+s.tickets);delete s.tickets;}   // the 'tickets' reward kind pays into s.tickets
  s.weekly=s.weekly||{}; s.weekly.times=s.weekly.times||{}; s.weekly.gold=s.weekly.gold||{};
  s.lbLast=s.lbLast||null;
  s.bundles=s.bundles||{}; s.showPerfect=s.showPerfect||{}; s.showBest=s.showBest||{};
 });
 const tix=s=>((s&&s.tix&&s.tix.n)||0);

 /* ================================================================= tables in ============ */
 for(const row of SHOW_EVENTS)if(!evById(row.id))T.EVENTS3.push(row);
 for(const row of NEW_DRESSAGE)if(!evById(row.id))T.EVENTS3.push(row);
 for(const k in SHOW_TESTS)G.course.DRESSAGE_TESTS[k]=G.course.DRESSAGE_TESTS[k]||SHOW_TESTS[k];
 for(const k in NEW_TESTS)G.course.DRESSAGE_TESTS[k]=G.course.DRESSAGE_TESTS[k]||NEW_TESTS[k];
 /* the gauntlet row, named for the season it is being ridden in */
 const season=G.time.seasonNow(), GTD=GAUNTLETS[season.def.id]||GAUNTLETS.bloom;
 T.RACE_ROUTES.gt=T.RACE_ROUTES.gt||GT_ROUTE.map(p=>p.slice());
 if(!evById('gt'))T.EVENTS3.push({id:'gt',town:'Meadowlark Ranch',name:GTD.name,lvl:3,kind:'gauntlet',race:true,route:'gt',
  gauntlet:true,reward:600,time:GT_LIMIT*0.75,limit:GT_LIMIT,line:false});
 else Object.assign(evById('gt'),{name:GTD.name});
 /* blurbs: openEvents prints ev.blurb instead of guessing the kind from its flags */
 const gtEv=evById('gt');
 gtEv.blurb=GTD.icon+' seasonal gauntlet · '+GT_ROUTE.length+' mixed obstacles · '+GT_LIMIT+'s limit';
 for(const row of SHOW_EVENTS)evById(row.id).blurb='🧼 showmanship · groom and tack up first · '+SHOW_TESTS[row.id].length+' figures';
 for(const row of NEW_DRESSAGE)evById(row.id).blurb='🎽 dressage · '+NEW_TESTS[row.id].length+' figures';
 /* favoured traits on every racing row */
 for(const k in RACE_TRAITS){const e=evById(k);if(e)e.traits=e.traits||RACE_TRAITS[k];}
 /* the Final is a championship event */
 if(evById('w2'))evById('w2').champ=true;

 /* two more race pick-ups, one defensive and one thrown at the rider behind you */
 T.RACE_ITEMS.shield={col:0x9ad0ff,label:'🛡️ Kestrel feather — shielded!',fx:()=>{player.shieldT=6;}};
 T.RACE_ITEMS.mud={col:0x7a5a3a,label:'🪣 Mud slick — thrown!',fx:()=>{sendRaceHit('mud');}};
 T.RACE_ITEMS.bale={col:0xd9a441,label:'🌾 Hay bale — dropped on the track!',fx:()=>{dropBale();}};
 const ITEM_HELP=[['🥕','Carrot boost','three seconds of pace and a little wind back'],
  ['⏱️','Clock back','a second and a half off your time'],['🍀','Second wind','the stamina bar filled'],
  ['🛡️','Kestrel feather','six seconds proof against mud, bales and hazards'],
  ['🪣','Mud slick','every rival without a shield loses most of their speed for two seconds'],
  ['🌾','Hay bale','drops where you stand; rivals who hit it lose a second and a half']];

 /* ================================================================= styles =============== */
 const style=document.createElement('style');
 style.textContent='#stamWrap.shield{border-color:#9ad0ff;box-shadow:0 0 10px #9ad0ff}'
  +'#stamWrap.slip{border-color:#7a5a3a}'
  +'#pvpHud{display:none;position:fixed;top:96px;right:10px;z-index:9;background:var(--dark,#3b2d1e);color:#fff8ea;padding:6px 11px;border-radius:12px;font-size:12px;font-weight:600;max-width:44vw;text-align:right}'
  +'#pvpHud.on{display:block}'
  +'.epvpCard{width:100%;font-size:11px;color:#6b5a45;line-height:1.5}.epvpCard b{color:#3d2f22}'
  +'.epvpGrid{display:flex;gap:5px;flex-wrap:wrap;width:100%}'
  +'.epvpChip{font-size:11px;padding:3px 8px;border-radius:999px;background:#f0e7d6;color:#6b5a45}'
  +'.epvpChip.on{background:#d9edc4;color:#3f5f2c}.epvpChip.me{background:#ffe9b8;color:#7a5a1e}';
 document.head.appendChild(style);
 const pvpHud=document.createElement('div'); pvpHud.id='pvpHud'; document.body.appendChild(pvpHud);

 /* ================================================================= championship ========= */
 function champVenue(s,town){
  const rb=s.ribbons||{}, gold=s.ribbonGold||{};
  return T.EVENTS3.some(e=>e.town===town&&!e.champ&&((rb[e.id]||0)>=CHAMP_NEED||gold[e.id]));
 }
 function champQualified(s){
  const venues={}; let n=0;
  for(const [town] of CHAMP_VENUES){const ok=champVenue(s,town);venues[town]=ok;if(ok)n++;}
  return {ok:n>=CHAMP_VENUES.length,n,venues};
 }
 function champHtml(s){
  const q=champQualified(s);
  return '<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🏆 Basin Championship · qualifiers '+q.n+'/'+CHAMP_VENUES.length+'</b>'
   +'<span class="epvpCard">Every event in the valley is a qualifier. Take '+CHAMP_NEED+' ribbons (or one gold) at a venue and that venue is signed off; sign off all four and the <b>Basin Championship Final</b> at Hollowpeak will take your entry.</span>'
   +'<span class="epvpGrid">'+CHAMP_VENUES.map(([town,ic])=>'<span class="epvpChip'+(q.venues[town]?' on':'')+'">'+ic+' '+town+' '+(q.venues[town]?'✓':'▫️')+'</span>').join('')+'</span></div>';
 }

 /* ================================================================= showmanship ========== */
 function turnoutOf(s,h){
  const parts=[]; let total=0;
  for(const p of SHOW_PARTS){let v=0;try{v=clamp(p.v(s,h)||0,0,1);}catch(e){v=0;}parts.push({p,v});total+=v*p.w;}
  return {total:clamp(total,0,1),parts};
 }
 G.course.kinds.show=ev=>{
  const s=G.save.fresh(), h=ridden();
  if(!h){toast('🧼 Pick a horse to show first.');return;}
  const tn=turnoutOf(s,h);
  showPending=tn;
  G.course.startDressage(ev);
 };
 let showPending=null;

 /* ================================================================= freestyle arena ====== */
 let arenaLetters=null, freestyle=false, freeT=0, freeMin=0, callIdx=0;
 function buildArenaLetters(){
  if(arenaLetters)return arenaLetters;
  const out=[];
  for(const L in G.course.ARENA_LETTERS){
   const [x,z]=G.course.ARENA_LETTERS[L], g=new THREE.Group();
   W.box(0.16,1.0,0.16,'#f4f0e6',0,0.5,0,g);
   const sp=G.nameSprite(L); sp.position.y=1.35; sp.scale.set(0.9,0.36,1); g.add(sp);
   g.position.set(x,W.groundH(x,z),z); G.scene.add(g); out.push(g);
  }
  arenaLetters=out; return out;
 }
 function clearArenaLetters(){
  if(!arenaLetters)return;
  for(const g of arenaLetters){G.scene.remove(g);g.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose();if(o.isSprite&&o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});}
  arenaLetters=null;
 }
 function setFreestyle(on){
  if(G.course.get()&&on){toast('🎽 Finish the course you are on first.');return;}
  freestyle=!!on;
  if(freestyle){buildArenaLetters();freeT=0;freeMin=0;$('courseHud').style.display='flex';
   $('courseHudTxt').textContent='🎽 Freestyle arena · Ctrl walks · Shift canters · 9 (or the Call button) calls a figure';
   toast('🎽 The arena letters are up. No clock, no judge — ride what you like.');}
  else{clearArenaLetters();$('courseHud').style.display='none';toast('🎽 Letters away.');}
 }
 function callFigure(){
  if(!freestyle){toast('🎽 Open the freestyle arena first (🏆 Events).');return;}
  const fig=FIGURE_CALLS[callIdx%FIGURE_CALLS.length]; callIdx++;
  toast('🎽 You call: '+fig);
  G.net.sendChat('🎽 calls '+fig,{fig});
 }

 /* the grandstand seat ------------------------------------------------------------------- */
 let spectate=false;
 const SEAT={x:-28.5,z:0};
 function setSpectate(on){
  spectate=!!on;
  if(spectate){toast('👀 In the grandstand — any movement key gets you back on.');player.speed=0;}
 }
 W.addThing({kind:'stand',id:'grandstand',g:null,x:SEAT.x,z:SEAT.z,
  label:()=>spectate?'👀 Stand up (E)':'👀 Sit in the grandstand (E)',
  use:()=>setSpectate(!spectate)});
 G.on('camera',({dt})=>{
  if(!spectate)return false;
  const cam=G.camera;
  cam.position.lerp(new THREE.Vector3(SEAT.x-2.6,W.groundH(SEAT.x-2.6,SEAT.z)+3.4,SEAT.z),1-Math.exp(-6*dt));
  cam.lookAt(2,1.2,1);
  return true;
 });
 G.on('key',e=>{
  if(spectate&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Escape'].includes(e.code)){setSpectate(false);return true;}
 });
 G.ui.hotkey('Digit9',()=>callFigure());

 /* ================================================================= the gauntlet ========= */
 /* The gauntlet rides as a race so course-engine grades it — but every other element on the
    loop is swapped for a different obstacle before the first stride. */
 G.course.kinds.gauntlet=ev=>{
  G.course.startCourse(Object.assign({},ev,{kind:null}));
 };
 function coneMesh(x,z,n){
  const g=new THREE.Group();
  for(let i=0;i<n;i++){
   const off=(i-(n-1)/2)*2.1, c=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.95,10),new THREE.MeshStandardMaterial({color:i%2?0xffd166:0xe0603c,roughness:0.7}));
   c.position.set(off,0.47,0); c.castShadow=true; g.add(c);
  }
  g.position.set(x,W.groundH(x,z),z); G.scene.add(g); return g;
 }
 function logMesh(x,z,rotY){
  const g=new THREE.Group(), m=W.mats.plankBrownMat;
  const log=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,4.2,10),m); log.rotation.z=Math.PI/2; log.position.y=0.34; g.add(log);
  W.box(0.3,0.5,0.3,m,-2.1,0.25,0,g); W.box(0.3,0.5,0.3,m,2.1,0.25,0,g);
  g.position.set(x,W.groundH(x,z),z); g.rotation.y=rotY; G.scene.add(g); return g;
 }
 function railMesh(x,z,rotY,h){
  const g=new THREE.Group();
  W.box(0.17,1.2*h,0.17,W.mats.paintMat('#2e86c1'),-1.6,0.6*h,0,g);
  W.box(0.17,1.2*h,0.17,W.mats.paintMat('#2e86c1'),1.6,0.6*h,0,g);
  W.box(3.2,0.13,0.1,W.mats.whitePaintMat,0,0.58*h,0,g);
  W.box(3.2,0.13,0.1,W.mats.whitePaintMat,0,0.95*h,0,g);
  g.position.set(x,W.groundH(x,z),z); g.rotation.y=rotY; G.scene.add(g); return g;
 }
 function disposeGroup(g){
  if(!g)return;
  G.scene.remove(g);
  g.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose();if(o.isSprite&&o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});
 }
 function convertGauntlet(c){
  const diffF=(c.ce&&c.ce.diff&&c.ce.diff.fence)||1;
  c.gauntlet=true; c.gtKinds={};
  c.jumps.forEach((j,i)=>{
   const k=GT_KINDS[i%GT_KINDS.length];
   if(k==='gate'){j.gtKind='gate';return;}
   disposeGroup(j.g); j.ring=null;
   if(k==='fence'){j.g=railMesh(j.x,j.z,j.rotY,diffF);j.kind='fence';j.gtKind='fence';}
   else if(k==='log'){j.g=logMesh(j.x,j.z,j.rotY);j.kind='fence';j.gtKind='log';}
   else if(k==='cone'){j.g=coneMesh(j.x,j.z,1);j.kind='gate';j.gtKind='cone';j.ring=null;}
   else{j.g=coneMesh(j.x,j.z,3);j.kind='gate';j.gtKind='weave';}
   j.prevSide=0; j.approached=false; j.refuseCd=0;
  });
  /* a gate with no ring: course-engine colours j.ring on a pass, so give the cones a stand-in */
  for(const j of c.jumps)if(j.kind==='gate'&&!j.ring)j.ring={material:{color:{set(){}}},rotation:{z:0}};
  const counts={}; for(const j of c.jumps)counts[j.gtKind]=(counts[j.gtKind]||0)+1;
  toast(GTD.icon+' '+GTD.name+' — '+c.jumps.length+' obstacles, '+GT_LIMIT+'s. '+Object.keys(counts).map(k=>counts[k]+' '+k).join(' · '));
 }

 /* ================================================================= race hazards ========= */
 function buildHazards(c){
  const list=RACE_HAZARDS[c.ev.route]||[];
  c.hazards=list.map(([x,z])=>{
   const g=new THREE.Group(), m=W.mats.plankBrownMat;
   const log=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,2.8,8),m); log.rotation.z=Math.PI/2; log.position.y=0.26; g.add(log);
   g.position.set(x,W.groundH(x,z),z); g.rotation.y=hash('hz'+x+z)*Math.PI; G.scene.add(g);
   return {x,z,g,cd:0,bale:false};
  });
 }
 function dropBale(){
  const c=G.course.get(); if(!c)return;
  const x=+player.pos.x.toFixed(1), z=+player.pos.z.toFixed(1);
  addBale(x,z);
  G.net.sendChat('🌾 dropped a bale on the track',{race:{hz:[x,z]}});
 }
 function addBale(x,z){
  const c=G.course.get(); if(!c)return;
  const g=new THREE.Group();
  W.box(1.5,1.0,1.0,'#d9a441',0,0.5,0,g); W.box(1.55,0.1,1.05,'#b8862f',0,0.72,0,g);
  g.position.set(x,W.groundH(x,z),z); G.scene.add(g);
  c.hazards=c.hazards||[]; c.hazards.push({x,z,g,cd:0,bale:true});
 }
 function clearHazards(c){ if(!c||!c.hazards)return; for(const h of c.hazards)disposeGroup(h.g); c.hazards=null; }

 /* ================================================================= trait matching ======= */
 function traitMatches(ev,h){
  if(!ev||!ev.traits||!h)return [];
  let HS={}; try{HS=G.xp.effStats(h)||{};}catch(e){}
  return ev.traits.filter(k=>((HS[k]||0)>=TRAIT_MATCH_AT));
 }
 function raceTraitMul(ev,h){
  if(!ev||!ev.traits||!h)return 1;
  let HS={}; try{HS=G.xp.effStats(h)||{};}catch(e){}
  let m=1; for(const k of ev.traits)m+=Math.max(0,(HS[k]||3)-5)*0.015;
  return Math.min(1.12,m);
 }

 /* ================================================================= race tickets ========= */
 function spendTicket(){
  let ok=false;
  G.save.sync(s=>{ if(tix(s)<1)return; s.tix.n--; ok=true; });
  if(!ok)toast('🎟️ No race tickets left — '+TIX_DAILY+' more tomorrow, or earn them from 📜 Quests and the rank ladder.');
  else G.money.refreshWallet();
  return ok;
 }
 function refundTicket(){ G.save.sync(s=>{s.tix.n=Math.min(TIX_MAX,tix(s)+1);}); G.money.refreshWallet(); }

 /* ================================================================= PvP lobby ============ */
 const PVP={offer:null,pending:null,seed:0,rivals:{},settleT:0,place:0,field:0};
 const pvpRaces=()=>T.EVENTS3.filter(e=>e.race&&!e.gauntlet);
 function hostPvp(evId){
  const ev=evById(evId); if(!ev)return;
  if(!G.net.SOCIAL||!G.net.net.client||!G.net.net.client.connected){toast('🌐 Connect in 🌐 Club first — a challenge race needs a club.');return;}
  const gate=G.course.eventOk?G.course.eventOk(ev):{ok:true};
  if(!gate.ok){toast('🔒 '+ev.name+' is above this horse just now.');return;}
  if(!spendTicket())return;
  PVP.seed=Math.floor(Math.random()*1e6); PVP.pending={ev,at:Date.now()+9000,seed:PVP.seed,host:true};
  G.net.sendChat('🏁 challenges the club to '+ev.name+' — 9 seconds!',{race:{e:ev.id,at:PVP.pending.at,seed:PVP.seed}});
  toast('🏁 Challenge sent — the gate drops in 9 seconds.');
  startPvpWhenDue();
 }
 function joinPvp(){
  const o=PVP.offer; if(!o){toast('🏁 No challenge is open.');return;}
  if(Date.now()>o.at+4000){toast('🏁 That race has already gone.');PVP.offer=null;return;}
  if(!spendTicket())return;
  PVP.pending={ev:o.ev,at:o.at,seed:o.seed,host:false}; PVP.offer=null;
  toast('🏁 You are in — line up!');
  startPvpWhenDue();
 }
 function startPvpWhenDue(){
  const p=PVP.pending; if(!p)return;
  PVP.rivals={}; PVP.place=0; PVP.field=0;
  pvpStart=p; G.course.startCourse(p.ev);
  PVP.pending=null;
 }
 let pvpStart=null;
 function startFriendly(route){
  const base=pvpRaces().find(e=>e.route===route)||pvpRaces()[0]; if(!base)return;
  const seed=Math.floor(Math.random()*1e6);
  const ev={id:'fr',town:base.town,name:'Friendly · '+base.name,lvl:1,race:true,route:base.route,rev:!!base.rev,reward:0,friendly:true,traits:base.traits};
  PVP.seed=seed; pvpStart={ev,at:Date.now()+8000,seed,host:true,friendly:true};
  PVP.rivals={};
  if(G.net.SOCIAL)G.net.sendChat('🏁 calls a friendly race — '+base.name,{race:{e:'fr',rt:base.route,at:pvpStart.at,seed,fr:1}});
  G.course.startCourse(ev);
 }
 function sendRaceHit(kind){
  const c=G.course.get(); if(!c)return;
  G.net.sendChat('🪣 threw a mud slick',{race:{hit:kind}});
 }
 /* chat piggy-back: challenges, friendly calls, hits, bales, finishes and formation calls */
 G.on('chat',(m,nm)=>{
  if(m.fig){toast('🎽 '+nm+' calls: '+String(m.fig).slice(0,40));return;}
  if(m.dance){startDance(nm,true);return;}
  const r=m.race; if(!r)return;
  const c=G.course.get();
  if(r.hit){
   if(!c||!(c.pvp||c.friendly))return;
   if((player.shieldT||0)>0){toast('🛡️ '+nm+'\'s mud slid right off.');}
   else{player.slipT=2.2;toast('🪣 '+nm+' slicked the track — hold on!');}
   return;
  }
  if(r.hz&&c&&(c.pvp||c.friendly)){addBale(+r.hz[0]||0,+r.hz[1]||0);toast('🌾 '+nm+' dropped a bale ahead.');return;}
  if(r.done!=null){
   PVP.rivals[nm]={i:9999,t:+r.done||0,done:true,n:nm};
   if(c&&(c.pvp||c.friendly))toast('🏁 '+nm+' is home in '+(+r.done).toFixed(1)+'s');
   return;
  }
  if(r.e){
   const ev=r.fr?{id:'fr',town:'Kestrel Basin',name:'Friendly race',lvl:1,race:true,route:r.rt||'pp',reward:0,friendly:true}:evById(r.e);
   if(!ev)return;
   PVP.offer={ev,at:+r.at||Date.now()+9000,seed:r.seed||0,by:nm,friendly:!!r.fr};
   toast('🏁 '+nm+' challenges you to '+ev.name+' — join from 🏁 Race Club');
   G.ui.hud.pips();
  }
 });
 /* live placement rides on the position packet */
 G.on('netPos',(payload)=>{
  const c=G.course.get();
  if(c&&(c.pvp||c.friendly)&&c.started)payload.rc={e:c.ev.id,i:c.idx,t:+c.t.toFixed(1)};
 });
 G.on('remote',(m,r)=>{ if(m.rc)r.rc=m.rc; });
 function pvpField(c){
  const out=[];
  for(const id in G.horse.remotes){const r=G.horse.remotes[id];if(r&&r.rc&&r.rc.e===c.ev.id)out.push({n:r.name||'Rider',i:r.rc.i|0,t:+r.rc.t||0});}
  for(const nm in PVP.rivals)if(!out.some(o=>o.n===nm))out.push(PVP.rivals[nm]);
  return out;
 }
 function pvpPlace(c){
  const field=pvpField(c); let ahead=0;
  for(const f of field){ if(f.done)ahead++; else if(f.i>c.idx||(f.i===c.idx&&f.t<c.t))ahead++; }
  PVP.field=field.length; PVP.place=ahead+1;
  return PVP.place;
 }

 /* ================================================================= Dance of Harmony ===== */
 function startDance(by,remote){
  if(G.course.get()){if(!remote)toast('💃 Finish what you are riding first.');return;}
  if(freestyle)setFreestyle(false);
  G.course.startDressage(DANCE_EV);
  toast('💃 Dance of Harmony'+(by?' — called by '+by:'')+': five figures, everyone at once.');
  if(!remote&&G.net.SOCIAL)G.net.sendChat('💃 calls the Dance of Harmony at the arena!',{dance:1});
 }

 /* ================================================================= course hooks ========= */
 /* entry: tickets for a challenge race, the championship lock */
 G.on('courseGate',(ev)=>{
  const h=ridden();
  if(ev.champ){
   const s=G.save.fresh()||{}, q=champQualified(s);
   if(!q.ok){toast('🔒 The Final takes qualified riders only — '+q.n+'/'+CHAMP_VENUES.length+' venues signed off.');return true;}
  }
  if(ev.friendly)return false;
  if(pvpStart&&pvpStart.ev&&pvpStart.ev.id===ev.id)return false;    // the ticket was taken at the lobby
  return false;
 });
 G.on('courseStart',c=>{
  if(!c)return;
  /* showmanship: the turnout mark is taken before the first stride */
  if(c.ev.kind==='show'){
   const s=G.save.fresh(), h=ridden(), tn=showPending||turnoutOf(s,h); showPending=null;
   c.turnout=tn.total; c.turnoutParts=tn.parts; c.show=true;
   toast('🧼 Turnout '+Math.round(tn.total*100)+'% — '+tn.parts.map(x=>x.p.icon+' '+Math.round(x.v*100)+'%').join(' · '));
   return;
  }
  if(c.dressage)return;
  /* the gauntlet swaps every other gate for a different obstacle */
  if(c.ev.gauntlet)convertGauntlet(c);
  if(!c.race)return;
  /* favoured traits */
  const h=ridden();
  c.traitMul=raceTraitMul(c.ev,h); c.traitMatch=traitMatches(c.ev,h);
  if(c.ev.traits&&c.ev.traits.length)toast('🏇 Favours '+c.ev.traits.map(k=>T.STAT_LBL[k]).join(', ')+(c.traitMatch.length?' — '+c.traitMatch.length+' matched, +'+Math.round((c.traitMul-1)*100)+'% pace':''));
  /* hazards, and a PvP or friendly context if one was being set up */
  buildHazards(c);
  player.shieldT=0; player.slipT=0;
  if(pvpStart&&(pvpStart.ev.id===c.ev.id)){
   c.pvp=!pvpStart.friendly; c.friendly=!!pvpStart.friendly; c.seed=pvpStart.seed;
   c.cd=Math.max(1,(pvpStart.at-Date.now())/1000);           // both riders leave the box together
   c.tixSpent=!pvpStart.friendly;
   pvpStart=null;
   pvpHud.classList.add('on');
  }else{
   c.pvp=false; c.friendly=!!c.ev.friendly;
   /* a mud slick with nobody to throw it at is just a carrot */
   for(const it of c.items||[])if(it.type==='mud'||it.type==='bale')it.type='boost';
  }
  lastCourse=c;                                    // seen now, so a course quit before the first frame still tidies up
 });
 /* ride: the trait bonus, the mud slick and the shield */
 G.on('ride',(RIDE,dt)=>{
  if(spectate){RIDE.target=0;RIDE.noJump=true;return;}
  const c=G.course.get();
  if(c&&c.race&&c.traitMul)RIDE.target*=c.traitMul;
  if(player.slipT>0){player.slipT-=dt;RIDE.target*=0.55;}
  if(player.shieldT>0)player.shieldT-=dt;
 });
 /* per-frame: hazards, the PvP placement HUD, the gauntlet clock */
 G.on('courseTick',(c,dt,t)=>{
  if(!c||c.dressage)return;
  /* hazards */
  if(c.hazards){
   for(const h of c.hazards){
    if(h.cd>0){h.cd-=dt;continue;}
    h.g.rotation.y+=dt*0.2;
    if(Math.hypot(player.pos.x-h.x,player.pos.z-h.z)<1.7&&Math.abs(player.speed)>1.5){
     h.cd=3;
     if((player.shieldT||0)>0){toast('🛡️ Straight through it.');}
     else{player.speed*=HAZ_SLOW;c.t+=HAZ_TIME;toast((h.bale?'🌾 Hay bale':'🪵 Hazard')+' — +'+HAZ_TIME.toFixed(1)+'s');G.beep(80,110,0.16,'square',0.07);}
    }
   }
  }
  /* the gauntlet's hard limit */
  if(c.gauntlet&&c.started&&c.t>(c.ev.limit||GT_LIMIT)&&!c.done){
   c.done=true;
   toast('⏳ '+GTD.name+' — out of time at '+Math.round(c.t)+'s. 80🪙 for the try.');
   G.money.addCoins(80);
   setTimeout(()=>G.course.cancelCourse(),0);
   return;
  }
  /* the PvP board */
  if((c.pvp||c.friendly)&&c.started){
   const place=pvpPlace(c);
   pvpHud.classList.add('on');
   pvpHud.innerHTML='🏁 P'+place+'/'+(PVP.field+1)+(c.friendly?' · friendly':'')
    +((player.shieldT||0)>0?' · 🛡️'+player.shieldT.toFixed(1):'')
    +((player.slipT||0)>0?' · 🪣':'');
  }
 });
 /* the finish: weekly boards, racing points, breeding tokens, PvP settling */
 G.on('courseFinish',({c,ev,stars,RB,pay,dressage,pct})=>{
  c.finished=true;
  /* --- showmanship: a perfect turn-out is worth gems and a note in the save --- */
  if(c.show){
   const showPct=pct==null?0:pct;
   G.save.sync(s=>{ s.showBest=s.showBest||{}; if(!s.showBest[ev.id]||showPct>s.showBest[ev.id])s.showBest[ev.id]=+showPct.toFixed(3);
    if(showPct>=0.98){s.showPerfect=s.showPerfect||{};s.showPerfect[ev.id]=true;} });
   if(showPct>=0.98){G.money.addGems(2);toast('🏵️ A perfect turnout — the judges could not fault her. +2💎');}
   toast('🧼 Turnout '+Math.round((c.turnout||0)*100)+'% · handling '+Math.round(((showPct*2)-(c.turnout||0))*100)+'% · final '+Math.round(showPct*100)+'%');
   G.quest.dailyEvt('show',1);
  }
  /* --- the weekly leaderboard: a gold ribbon is the price of a place --- */
  const featured=RB&&RB.featured;
  if(featured&&RB.gold&&!dressage){
   const wk=nowWeek(); let best=null;
   G.save.sync(s=>{ s.weekly=s.weekly||{}; s.weekly.times=s.weekly.times||{}; s.weekly.gold=s.weekly.gold||{};
    s.weekly.gold[ev.id]=true;
    const prev=s.weekly.times[ev.id];
    if(prev==null||c.t<prev){s.weekly.times[ev.id]=+c.t.toFixed(1);best=+c.t.toFixed(1);} });
   if(best!=null){
    toast('🥇 Gold — '+best.toFixed(1)+'s is on this week\'s '+ev.name+' board.');
    G.net.publish('lb/wk_'+wk+'_'+ev.id+'/'+G.net.myName(),{v:best},{retain:true});
   }
  }else if(featured&&!dressage&&!(RB&&RB.gold)){
   toast('🎀 Featured — but only a 🥇 gold ribbon is ranked on the weekly board.');
  }
  /* --- racing: points, rank, breeding tokens, PvP result --- */
  if(ev.race||ev.gauntlet){
   let place=1, field=0;
   if(c.pvp||c.friendly){ place=pvpPlace(c); field=PVP.field;
    G.net.sendChat('🏁 finished '+ev.name+' in '+c.t.toFixed(1)+'s',{race:{done:+c.t.toFixed(1),e:ev.id}}); }
   const matched=(c.traitMatch||[]).length;
   const gained=Math.round((10+5*(stars||1)+15*Math.max(0,field-(place-1)))*(ev.friendly?0.4:1));
   let rankBefore=0,rankAfter=0;
   G.save.sync(s=>{
    s.racing=s.racing||{pts:0,races:0,wins:0,pvp:0,claimed:{}};
    rankBefore=rankIdx(s.racing.pts||0);
    s.racing.races++; s.racing.pts=(s.racing.pts||0)+gained;
    if(c.pvp||c.friendly)s.racing.pvp=(s.racing.pvp||0)+1;
    if(place===1&&field>0)s.racing.wins=(s.racing.wins||0)+1;
    rankAfter=rankIdx(s.racing.pts);
    /* breeding tokens: one for a three-star race, one for winning a challenge */
    let bt=0; if(!ev.friendly&&(stars>=3))bt++; if(place===1&&field>0)bt++;
    if(bt){s.btok=(s.btok||0)+bt;s.life=s.life||{};s.life.breedToken=(s.life.breedToken||0)+bt;}
    c.btGained=bt;
   });
   if(c.btGained)toast('💞 +'+c.btGained+' breeding token'+(c.btGained>1?'s':'')+' from the race.');
   if(matched&&!ev.friendly){const bonus=Math.round(pay*0.05*matched);if(bonus>0){G.money.addCoins(bonus);toast('🏇 '+matched+' favoured trait'+(matched>1?'s':'')+' matched — +'+bonus+'🪙');}}
   toast('🏇 +'+gained+' racing points'+((c.pvp||c.friendly)?' · finished P'+place+'/'+(field+1):''));
   if(rankAfter>rankBefore)toast(RACE_RANKS[rankAfter].icon+' Racing rank up — '+RACE_RANKS[rankAfter].label+'! Claim it in 🏁 Race Club.');
   G.quest.dailyEvt('race',1);
   if(c.pvp&&place===1&&field>0)G.quest.dailyEvt('pvpwin',1);
   G.money.refreshWallet();
  }
  if(ev.gauntlet)G.save.sync(s=>{s.stats=s.stats||{};s.stats.gauntlet=(s.stats.gauntlet||0)+1;});
  /* a friendly race leaves nothing behind but the story of it */
  if(ev.friendly)setTimeout(()=>G.save.sync(s=>{if(s.trophies)delete s.trophies[ev.id];if(s.bestTimes)delete s.bestTimes[ev.id];}),0);
  pvpHud.classList.remove('on');
 });
 /* tidy up when a course goes away, and hand a ticket back if it was never ridden */
 let lastCourse=null;
 G.on('tick',(dt,t)=>{
  const c=G.course.get();
  if(lastCourse&&lastCourse!==c){
   clearHazards(lastCourse);
   if(lastCourse.tixSpent&&!lastCourse.finished&&!lastCourse.started){refundTicket();toast('🎟️ Ticket returned — that race never started.');}
   pvpHud.classList.remove('on');
  }
  lastCourse=c;
  if(freestyle){
   freeT+=dt;
   if(freeT>=60){freeT-=60;freeMin++;G.quest.dailyEvt('freestyle',1);}
   if(c)setFreestyle(false);
  }
  const sw=$('stamWrap');
  if(sw){sw.classList.toggle('shield',(player.shieldT||0)>0);sw.classList.toggle('slip',(player.slipT||0)>0);}
  /* the challenge offer expires quietly */
  if(PVP.offer&&Date.now()>PVP.offer.at+5000)PVP.offer=null;
 });

 /* ================================================================= racing ranks ========= */
 function rankIdx(pts){let i=0;for(let k=0;k<RACE_RANKS.length;k++)if(pts>=RACE_RANKS[k].at)i=k;return i;}
 function rankNext(pts){const i=rankIdx(pts);return RACE_RANKS[i+1]||null;}
 function claimRank(i){
  const tier=RACE_RANKS[i]; if(!tier)return;
  let ok=false;
  G.save.sync(s=>{
   s.racing=s.racing||{pts:0,races:0,wins:0,claimed:{}};
   if(s.racing.claimed[i]||(s.racing.pts||0)<tier.at||!Object.keys(tier.r).length)return;
   s.racing.claimed[i]=true; G.money.payReward(s,tier.r); ok=true;
  });
  if(ok){G.money.refreshWallet();G.horse.refreshTack();G.sGem();toast(tier.icon+' '+tier.label+' claimed — '+G.money.rewardLabel(tier.r));G.ui.rerender('pvpPanel');}
 }

 /* ================================================================= weekly boards ======== */
 function weeklyRows(ev,s){
  const wk=nowWeek(), par=G.course.eventPar(ev)||40;
  const rows=T.NEIGHBOURS.map(([nm,str])=>({n:nm,v:+(par*(0.80+0.50*hash(ev.id+nm+wk))/Math.max(0.75,str)).toFixed(1)}));
  const club=(G.net.lbData||{})['wk_'+wk+'_'+ev.id]||{};
  for(const nm in club)if(typeof club[nm]==='number')rows.push({n:nm,v:club[nm],club:true});
  const mine=s.weekly&&s.weekly.gold&&s.weekly.gold[ev.id]&&s.weekly.times&&s.weekly.times[ev.id];
  if(mine)rows.push({n:'You',v:s.weekly.times[ev.id],me:true});
  rows.sort((a,b)=>a.v-b.v);
  return rows;
 }
 const myPlace=rows=>{const i=rows.findIndex(r=>r.me);return i<0?0:i+1;};
 function prizeFor(place){ for(const p of LB_PRIZES)if(place<=p.place)return p; return null; }
 function prizeLabel(p){
  const bits=[];
  if(p.excl>=1)bits.push('an exclusive (horse or Legendary tack)');
  else if(p.excl>0)bits.push(Math.round(p.excl*100)+'% chance of the exclusive');
  if(p.g)bits.push(p.g+'💎 (paid as '+Math.max(1,Math.round(p.g*LB_GEM_SCALE))+'💎)');
  if(p.k)bits.push(p.k+'🗝️ (paid as '+Math.max(1,Math.round(p.k*LB_KEY_SCALE))+'🗝️)');
  return bits.join(' · ')||'—';
 }
 /* Monday. Work out where last week's gold rounds placed and put the prizes aside. */
 function settleWeek(s,write){
  const wk=nowWeek();
  if(!s||!s.weekly||s.weekly.week===wk||!s.weekly.times)return null;
  if(s.lbLast&&s.lbLast.week===s.weekly.week)return null;
  const prizes=[];
  for(const id in s.weekly.times){
   if(!s.weekly.gold[id])continue;
   const ev=evById(id); if(!ev)continue;
   const rows=weeklyRows(ev,s), place=myPlace(rows)||rows.length;
   const p=prizeFor(place); if(!p)continue;
   prizes.push({ev:id,name:ev.name,place,tier:p.label,excl:p.excl,g:p.g,k:p.k});
  }
  const rec={week:s.weekly.week,prizes,claimed:!prizes.length};
  if(write)s.lbLast=rec;
  return rec;
 }
 function grantExclusive(s,seedStr){
  const roll=hash('excl'+seedStr+(s.pid||''));
  if(roll<0.5){
   const breed=EXCL_BREEDS[Math.floor(hash('b'+seedStr)*EXCL_BREEDS.length)%EXCL_BREEDS.length];
   const h=G.horse.grantHorse(s,breed,{src:'leaderboard',level:3,bond:30});
   return '🐴 '+(h.name||'a horse')+' — the week\'s exclusive';
  }
  const sets=['Champion','Kestrel','Aurora','Meadowlark'];
  const set=sets[Math.floor(hash('t'+seedStr)*sets.length)%sets.length];
  s.tack=s.tack||[];
  const it=G.horse.genGear('Legendary',undefined,{set}); it.excl=seedStr;
  s.tack.push(it);
  return '🏅 '+(it.name||'Legendary tack')+' — the week\'s exclusive';
 }
 function claimLbPrizes(){
  let msg='',ok=false;
  G.save.sync(s=>{
   const L=s.lbLast; if(!L||L.claimed||!L.prizes||!L.prizes.length)return;
   const bits=[];
   for(const p of L.prizes){
    if(p.excl>0&&(p.excl>=1||hash('x'+L.week+p.ev+(s.pid||''))<p.excl))bits.push(grantExclusive(s,L.week+p.ev));
    else if(p.excl>0&&p.g){const g=Math.max(1,Math.round(p.g*LB_GEM_SCALE));G.money.grantGems(s,g);bits.push(g+'💎');}
    if(p.k){const k=Math.max(1,Math.round(p.k*LB_KEY_SCALE));s.keys=(s.keys||0)+k;bits.push(k+'🗝️');}
   }
   L.claimed=true; ok=true; msg=bits.join(' · ');
  });
  if(ok){G.money.refreshWallet();G.horse.refreshTack();G.horse.reloadHorses();G.sGem();toast('🏅 Leaderboard prizes: '+msg);G.ui.rerender('lbPanel');try{G.ui.renderLB();}catch(e){}}
  else toast('🏅 Nothing to collect.');
 }

 /* ================================================================= themed bundles ======= */
 function bundleHave(s,b){const tr=s.trophies||{};return b.need.filter(id=>tr[id]).length;}
 function claimBundle(bid){
  const b=BUNDLES3.find(x=>x.id===bid); if(!b)return;
  let ok=false,hn='';
  G.save.sync(s=>{
   s.bundles=s.bundles||{};
   if(s.bundles[bid])return;
   if(bundleHave(s,b)<b.need.length)return;
   s.bundles[bid]=Date.now();
   const h=G.horse.grantHorse(s,b.horse,{src:'bundle',level:3,bond:30}); hn=h.name;
   s.tack=s.tack||[];
   for(const sl of T.GEAR_SLOTS){const it=G.horse.genGear(b.rarity,sl,{set:b.set});it.bundle=bid;s.tack.push(it);}
   s.rider=Object.assign(s.rider||{},b.outfit);
   s.items=s.items||{}; for(const k in b.items)s.items[k]=(s.items[k]||0)+b.items[k];
   s.coins+=b.c;
   ok=true;
  });
  if(ok){G.money.refreshWallet();G.horse.refreshTack();G.horse.reloadHorses();G.sGem();
   toast(b.emoji+' '+b.label+' unlocked — '+hn+', the full '+b.set+' set, the outfit and the hamper.');
   G.ui.rerender('pvpPanel'); try{G.ui.openEvents();G.ui.openEvents();}catch(e){}}
 }

 /* ================================================================= UI =================== */
 G.ui.action('epvp',(a)=>{
  const k=a[0];
  if(k==='rank')claimRank(+a[1]);
  else if(k==='bundle')claimBundle(a[1]);
  else if(k==='lbclaim')claimLbPrizes();
  else if(k==='free')setFreestyle(!freestyle);
  else if(k==='call')callFigure();
  else if(k==='dance'){G.hidePanels();startDance(null,false);}
  else if(k==='host'){G.hidePanels();hostPvp(a[1]);}
  else if(k==='join'){G.hidePanels();joinPvp();}
  else if(k==='friendly'){G.hidePanels();startFriendly(a[1]);}
  else if(k==='buytix'){
   let ok=false;
   G.save.sync(s=>{ if(s.coins<TIX_PRICE){toast('Not enough coins — '+TIX_PRICE+'🪙');return;} if(tix(s)>=TIX_MAX){toast('🎟️ Your ticket book is full.');return;} s.coins-=TIX_PRICE; s.tix.n++; ok=true; });
   if(ok){G.money.refreshWallet();G.sCoin();toast('🎟️ Race ticket bought.');G.ui.rerender('pvpPanel');}
  }
 });

 /* the Events panel gains the championship card, the seasonal trial, the freestyle arena and
    the bundles; course-engine owns the event rows themselves. */
 G.ui.eventCard((s,h)=>{
  let html=champHtml(s);
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">'+GTD.icon+' '+GTD.name+' · seasonal trial</b>'
   +'<span class="epvpCard">'+GTD.blurb+' One loop of '+GT_ROUTE.length+' mixed obstacles — gates, rails, cones, a weave and logs — inside '+GT_LIMIT+' seconds. Best time is kept per season. Enter it from the event list below.</span></div>';
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎽 Freestyle arena &amp; the Dance of Harmony</b>'
   +'<span class="epvpCard">The letters go up with no clock and no judge. Call a figure and everyone in your club hears it; sit in the grandstand on the west rail (E) to watch instead of ride.</span>'
   +'<span class="epvpGrid"><button data-fx="epvp:free">'+(freestyle?'Put the letters away':'🎽 Open the freestyle arena')+'</button>'
   +'<button data-fx="epvp:call">📣 Call a figure (9)</button>'
   +'<button data-fx="epvp:dance">💃 Dance of Harmony</button></span></div>';
  /* bundles */
  html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎁 Themed kits</b>'
   +'<span class="epvpCard">Take the trophy at every event in a set and the whole kit comes to you — a horse, four matching pieces of tack, the outfit and a hamper. Nothing here costs real money; it is won.</span>';
  for(const b of BUNDLES3){
   const have=bundleHave(s,b), done=!!(s.bundles||{})[b.id];
   html+='<div class="evrow" style="width:100%">'+b.emoji+' <b>'+b.label+'</b><span style="font-size:11px">'+b.blurb+'<br>'+b.need.map(id=>((s.trophies||{})[id]?'🏆':'▫️')+' '+((evById(id)||{}).name||id)).join(' · ')+'<br>🎁 '+(G.horse.breedLabel?G.horse.breedLabel(b.horse):b.horse)+' · the '+b.set+' set ('+b.rarity+') · an outfit · '+Object.keys(b.items).map(k=>b.items[k]+'×'+k).join(', ')+' · '+b.c+'🪙</span>'
    +(done?'<span style="flex:none;color:#3f5f2c">✅ claimed</span>':have>=b.need.length?'<button data-fx="epvp:bundle:'+b.id+'">Claim</button>':'<span style="flex:none;font-size:11px;color:#b8a98a">🔒 '+have+'/'+b.need.length+'</span>')+'</div>';
  }
  html+='</div>';
  return html;
 });
 /* the event rows themselves: turnout hints, favoured traits, the qualifier badge */
 G.ui.eventRow((ev,s,h)=>{
  const bits=[];
  if(ev.champ)bits.push('🏆 <b>THE FINAL</b> — '+champQualified(s).n+'/'+CHAMP_VENUES.length+' venues qualified');
  else if(CHAMP_VENUES.some(v=>v[0]===ev.town))bits.push('🎫 qualifier · '+ev.town);
  if(ev.traits&&ev.traits.length){
   const m=traitMatches(ev,h);
   bits.push('🏇 favours '+ev.traits.map(k=>(m.includes(k)?'<b style="color:#3f5f2c">'+T.STAT_LBL[k]+' ✓</b>':T.STAT_LBL[k])).join(', ')+(m.length?' · +'+Math.round((raceTraitMul(ev,h)-1)*100)+'% pace':''));
  }
  if(ev.kind==='show'){
   const tn=turnoutOf(s,h);
   bits.push('🧼 turnout now <b>'+Math.round(tn.total*100)+'%</b> · '+tn.parts.map(x=>x.p.icon+Math.round(x.v*100)+'%').join(' ')+(s.showBest&&s.showBest[ev.id]?' · best '+Math.round(s.showBest[ev.id]*100)+'%':''));
  }
  if(ev.gauntlet)bits.push('⏳ hard limit '+GT_LIMIT+'s · gates, rails, cones, weave, logs');
  if(ev.friendly)bits.push('🤝 no stakes');
  return bits.length?'<div class="epvpCard">'+bits.join('<br>')+'</div>':'';
 });

 /* the Race Club panel */
 G.ui.panel({id:'pvpPanel',title:'🏁 Race Club',
  dock:{label:'🏁',after:'eventsBtn',title:'Race Club — tickets, ranks, challenges',pip:()=>{try{const s=G.save.fresh();let n=PVP.offer?1:0;for(let i=0;i<RACE_RANKS.length;i++)if((s.racing.pts||0)>=RACE_RANKS[i].at&&!s.racing.claimed[i]&&Object.keys(RACE_RANKS[i].r).length)n++;return n;}catch(e){return 0;}}},
  render(p,s){
   s=s||{}; const R=s.racing||{pts:0,races:0,wins:0,claimed:{}};
   const ri=rankIdx(R.pts||0), nx=rankNext(R.pts||0);
   let html='<div class="ph">🏁 Race Club<span class="chip" style="font-size:12px;padding:3px 10px">'+RACE_RANKS[ri].icon+' '+RACE_RANKS[ri].label+' · '+(R.pts||0)+' pts</span><button data-fx="close:pvpPanel" style="margin-left:auto">✖</button></div>';
   /* tickets */
   html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎟️ Race tickets · '+tix(s)+'</b>'
    +'<span class="epvpCard">A challenge race against other riders takes one ticket. '+TIX_DAILY+' are waiting for you every day, quests and the rank ladder pay more, and the book holds '+TIX_MAX+'. <b>Riding a course on your own is always free</b> — tickets are only for racing people.</span>'
    +'<span class="epvpGrid"><button data-fx="epvp:buytix">Buy one · '+TIX_PRICE+'🪙</button></span></div>';
   /* the challenge lobby */
   const off=PVP.offer;
   html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🏇 Challenge races</b>'
    +'<span class="epvpCard">Everyone in your club gets nine seconds\' warning and the same gate drop. Placement is live, hazards are on the track, and two of the six pick-ups are thrown at the riders behind you.</span>'
    +(off?'<span class="epvpGrid"><button data-fx="epvp:join">Join '+off.by+'\'s '+off.ev.name+'</button></span>':'<span class="epvpCard">No open challenge right now.</span>')
    +'<span class="epvpGrid">'+pvpRaces().map(e=>'<button data-fx="epvp:host:'+e.id+'" style="font-size:11px;padding:3px 8px" title="'+e.town+'">Host · '+e.name+'</button>').join('')+'</span></div>';
   /* friendly races */
   html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🤝 Friendly races</b>'
    +'<span class="epvpCard">No ticket, no ribbon, no coins — just a route and whoever is near enough to hear you call it.</span>'
    +'<span class="epvpGrid">'+[...new Set(pvpRaces().map(e=>e.route))].map(rt=>'<button data-fx="epvp:friendly:'+rt+'" style="font-size:11px;padding:3px 8px">'+rt.toUpperCase()+' loop</button>').join('')+'</span></div>';
   /* the item set */
   html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎁 What is on the track</b><span class="epvpCard">'
    +ITEM_HELP.map(([ic,n,d])=>ic+' <b>'+n+'</b> — '+d).join('<br>')+'</span></div>';
   /* the rank ladder */
   html+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🏇 Racing ranks · '+(R.races||0)+' races · '+(R.wins||0)+' wins</b>'
    +'<span class="epvpCard">Points come from every race you finish: ten to start, five a star, and fifteen for every rival you beat.'+(nx?' Next: <b>'+nx.label+'</b> at '+nx.at+' ('+Math.max(0,nx.at-(R.pts||0))+' to go).':' You are at the top of the ladder.')+'</span>';
   RACE_RANKS.forEach((t,i)=>{
    const has=(R.pts||0)>=t.at, cl=!!R.claimed[i], any=Object.keys(t.r).length;
    html+='<div class="evrow" style="width:100%">'+t.icon+' <b>'+t.label+'</b><span style="font-size:11px">'+t.at+' pts · '+(any?G.money.rewardLabel(t.r):'the starting rank')+'</span>'
     +(!any?'<span style="flex:none;font-size:11px;color:#b8a98a">—</span>':cl?'<span style="flex:none;color:#3f5f2c">✅</span>':has?'<button data-fx="epvp:rank:'+i+'">Claim</button>':'<span style="flex:none;font-size:11px;color:#b8a98a">🔒</span>')+'</div>';
   });
   html+='</div>';
   return html;
  },
  vr:{tab:'race',label:'Race',build(rows,sv){
   const R=(sv&&sv.racing)||{pts:0}; const ri=rankIdx(R.pts||0);
   rows.push(RACE_RANKS[ri].icon+' '+RACE_RANKS[ri].label+' · '+(R.pts||0)+' pts');
   rows.push('🎟️ '+tix(sv)+' race tickets');
   rows.push(PVP.offer?('🏁 '+PVP.offer.by+' is challenging you'):'🏁 no open challenge');
   return 'Challenges and ranks are on the flat screen.';
  }}});

 /* the Boards → Week tab gains the weekly leaderboard events and the prize ladder */
 G.ui.lbWeekSection(s=>{
  s=s||{};
  const feat=G.course.weeklyFeatured(), wk=nowWeek();
  let html='<div class="passCard"><div class="ph"><b>🏁 This week\'s leaderboard events</b><span style="font-size:11px;color:#8c7a63">ranked by time · resets Monday</span></div>'
   +'<div class="sub">Four events are featured each week. <b>You have to take a 🥇 gold ribbon to be ranked at all</b> — a finish is not enough. Ranking is by completion time against the other ranches in the valley and everyone in your club.</div>';
  for(const ev of feat){
   const rows=weeklyRows(ev,s), place=myPlace(rows), mine=s.weekly&&s.weekly.times&&s.weekly.times[ev.id];
   html+='<div class="bGroup">'+ev.name+' · '+ev.town+'</div>'
    +rows.slice(0,3).map((r,i)=>'<div class="evrow"><b>'+(i===0?'👑':i===1?'🥈':'🥉')+' '+r.n+'</b><span>'+r.v.toFixed(1)+'s</span></div>').join('');
   if(place>3)html+='<div class="evrow"><b>#'+place+' You</b><span>'+(+mine).toFixed(1)+'s</span></div>';
   if(!place)html+='<div class="evrow"><span style="font-size:11px;color:#8c7a63">'+(mine?'Ridden — but not gold yet, so not ranked.':'Not ranked yet — ride it for a gold ribbon.')+'</span></div>';
   else html+='<div class="evrow"><span style="font-size:11px;color:#3f5f2c">🥇 ranked #'+place+' of '+rows.length+' — '+((prizeFor(place)||{}).label||'')+' on the ladder</span></div>';
  }
  /* the ladder itself */
  html+='<div class="bGroup">🏅 The prize ladder</div>'
   +LB_PRIZES.map(p=>'<div class="evrow"><b>'+p.label+'</b><span style="font-size:11px">'+prizeLabel(p)+'</span></div>').join('')
   +'<div class="sub">Star Equestrian\'s ladder pays three thousand gems for second place. This valley\'s whole economy is smaller than that, so the ladder is printed as it stands and paid at Meadowlark scale ('+Math.round(LB_GEM_SCALE*100)+'% of the gems, '+Math.round(LB_KEY_SCALE*100)+'% of the keys). The exclusive is the real prize.</div></div>';
  /* last week's settlement */
  const L=s.lbLast;
  if(L&&L.prizes&&L.prizes.length&&!L.claimed){
   html+='<div class="passCard" style="background:linear-gradient(180deg,#fff4e0,#ffe9c4)"><div class="ph"><b>🏅 Last week\'s leaderboards are settled</b><span style="font-size:11px;color:#4a3526">week of '+L.week+'</span></div>'
    +L.prizes.map(p=>'<div class="evrow"><b>🏁 '+p.name+'</b><span>#'+p.place+' · '+p.tier+'</span></div>').join('')
    +'<button data-fx="epvp:lbclaim" class="claimBtn">Collect the leaderboard prizes</button></div>';
  }
  return html;
 });

 /* the Club panel gets the friendly-race call and the dance */
 G.ui.onlineSection(s=>'<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🏁 Race the riders near you</b>'
  +'<span class="epvpCard">A friendly race costs nothing and pays nothing — call one and whoever is close enough gets the same countdown. A challenge race (🏁 Race Club) takes a ticket and counts toward your racing rank.</span>'
  +'<span class="epvpGrid"><button data-fx="epvp:friendly:pp">🤝 Friendly · pasture loop</button><button data-fx="epvp:friendly:rr">🤝 Friendly · river run</button>'
  +'<button data-fx="epvp:dance">💃 Call the Dance of Harmony</button>'+(PVP.offer?'<button data-fx="epvp:join">🏁 Join '+PVP.offer.by+'</button>':'')+'</span></div>');

 /* a ticket stall in the shop */
 G.ui.shopTab({id:'race',label:'🎟️ Racing',render(s){
  return '<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🎟️ Race tickets · '+tix(s)+' in the book</b>'
   +'<span class="epvpCard">Tickets let you enter a challenge race against other riders. '+TIX_DAILY+' arrive free every day; the book holds '+TIX_MAX+'. Never gems — only coins and quests.</span>'
   +'<button data-fx="epvp:buytix">Buy one · '+TIX_PRICE+'🪙</button></div>'
   +'<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">🏇 What a race pays</b><span class="epvpCard">Coins and a ribbon like any course, plus stat XP in the traits the race favours, racing points toward the rank ladder, and a 💞 breeding token for a three-star run or a win over another rider.</span></div>';
 }});

 /* ================================================================= quests + boards ====== */
 W.addBoard({k:'racing',g:'ride',label:'Racing points',rate:7,val:s=>(s.racing&&s.racing.pts)||0});
 G.quest.addDaily({type:'race',icon:'🏁',label:'Finish a race',goal:1,r:{c:150,tickets:1,p:15}});
 G.quest.addDaily({type:'pvpwin',icon:'🏇',label:'Beat another rider in a race',goal:1,r:{c:300,g:2,tickets:2,p:25}});
 G.quest.addDaily({type:'show',icon:'🧼',label:'Ride a showmanship class',goal:1,r:{c:200,p:20}});
 G.quest.addDaily({type:'freestyle',icon:'🎽',label:'Three minutes in the freestyle arena',goal:3,r:{c:120,p:12}});
 G.quest.addAch({id:'champq',icon:'🏆',label:'Qualified',desc:'Qualify at all four championship venues',v:s=>champQualified(s).n,goal:4,r:{c:500,k:1}});
 G.quest.addAch({id:'show95',icon:'🧼',label:'Best in show',desc:'Score 95% in a showmanship class',v:s=>Math.round(100*Math.max(0,...[0].concat(Object.values(s.showBest||{})))),goal:95,r:{g:3,k:1}});
 G.quest.addAch({id:'gaunt3',icon:'⏳',label:'Through the gauntlet',desc:'Finish the seasonal gauntlet 3 times',v:s=>(s.stats&&s.stats.gauntlet)||0,goal:3,r:{c:600,g:2}});
 G.quest.addAch({id:'rankgold',icon:'🥇',label:'Gold Girth',desc:'Reach 700 racing points',v:s=>(s.racing&&s.racing.pts)||0,goal:700,r:{g:6,k:1}});
 G.quest.addAch({id:'pvpwin5',icon:'🏇',label:'Head to head',desc:'Beat another rider in 5 races',v:s=>(s.racing&&s.racing.wins)||0,goal:5,r:{c:800,g:4}});
 G.quest.addAch({id:'bt5',icon:'💞',label:'Bloodlines',desc:'Earn 5 breeding tokens from racing',v:s=>(s.life&&s.life.breedToken)||0,goal:5,r:{g:4}});
 G.quest.addAch({id:'bundle1',icon:'🎁',label:'Outfitted',desc:'Claim a themed kit',v:s=>Object.keys(s.bundles||{}).length,goal:1,r:{g:5,k:1}});
 G.quest.addAch({id:'dress6',icon:'🎽',label:'Through the tests',desc:'Score on all six dressage tests',v:s=>Object.keys(s.bestScore||{}).filter(k=>k[0]==='d'&&k!=='dance').length,goal:6,r:{c:900,g:3}});
 G.quest.types.champq=(m,val,prog)=>Math.max(prog,typeof val==='number'?val:prog);
 G.quest.story.append([
  {ch:'The Basin Championship',npc:'ada',label:'Qualify at all four venues',
   text:'Four towns, four sets of ribbons, and then Hollowpeak will have you. Nobody gets to the Final on a level alone — go and be seen.',
   type:'champq',goal:4,reward:{c:600,k:1,tickets:3}},
 ]);

 /* ================================================================= boot + state ========= */
 G.on('boot',(s)=>{
  /* Sister packages add their own racing rows after this one installs; every race in the
     valley advertises favoured traits, so give any latecomer a deterministic set. */
  const POOL=['speed','stamina','agility','accel','jump'];
  for(const e of T.EVENTS3){
   if(!e.race||e.friendly||(e.traits&&e.traits.length))continue;
   const n=1+Math.floor(hash('trn'+e.id)*3), out=[];
   for(let i=0;i<n;i++){const k=POOL[Math.floor(hash('tr'+i+e.id)*POOL.length)%POOL.length];if(!out.includes(k))out.push(k);}
   e.traits=out.length?out:['speed'];
  }
  try{
   G.save.sync(sv=>{settleWeek(sv,true);});
   const sv=G.save.fresh();
   if(sv&&sv.lbLast&&!sv.lbLast.claimed&&sv.lbLast.prizes&&sv.lbLast.prizes.length)
    setTimeout(()=>toast('🏅 Last week\'s leaderboards are settled — collect in 🏅 Boards → Week'),4200);
  }catch(e){}
 });
 G.on('weekRoll',(s)=>{try{settleWeek(s,true);}catch(e){}});
 G.on('state',o=>{
  const c=G.course.get(), s=G.save.fresh()||{};
  o.racing={pts:(s.racing&&s.racing.pts)||0,races:(s.racing&&s.racing.races)||0,wins:(s.racing&&s.racing.wins)||0,
   rank:RACE_RANKS[rankIdx((s.racing&&s.racing.pts)||0)].k,tickets:tix(s)};
  o.arena={freestyle,spectate,letters:arenaLetters?arenaLetters.length:0,calls:FIGURE_CALLS.length};
  o.champ=champQualified(s);
  if(o.player)Object.assign(o.player,{shield:+(player.shieldT||0).toFixed(2),slip:+(player.slipT||0).toFixed(2)});
  if(o.course&&c)Object.assign(o.course,{pvp:!!c.pvp,friendly:!!c.friendly,gauntlet:!!c.gauntlet,show:!!c.show,
   turnout:c.turnout==null?null:+c.turnout.toFixed(3),traitMul:c.traitMul||1,traitMatch:(c.traitMatch||[]).slice(),
   place:(c.pvp||c.friendly)?PVP.place:0,field:PVP.field,hazards:(c.hazards||[]).length,
   gtKinds:c.gauntlet?c.jumps.map(j=>j.gtKind):undefined});
 });

 /* handles for QA and sister packages */
 G.events={CHAMP_VENUES,champQualified,SHOW_PARTS,turnoutOf,SHOW_TESTS,NEW_TESTS,GAUNTLETS,GTD,GT_KINDS,GT_LIMIT,
  RACE_RANKS,rankIdx,claimRank,LB_PRIZES,LB_GEM_SCALE,LB_KEY_SCALE,prizeFor,weeklyRows,myPlace,settleWeek,claimLbPrizes,
  BUNDLES3,bundleHave,claimBundle,TIX_DAILY,TIX_MAX,tix,spendTicket,hostPvp,joinPvp,startFriendly,startDance,
  setFreestyle,callFigure,FIGURE_CALLS,setSpectate,PVP,raceTraitMul,traitMatches,RACE_HAZARDS,ITEM_HELP,isFreestyle:()=>freestyle};
}
