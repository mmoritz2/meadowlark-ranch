/* Feature package 'world' — the place-making pass over Kestrel Basin.
   Regions with metadata and gating, living towns, named landmarks and per-town arenas, four
   collectible families (horseshoes, bottles, sheriff badges, the toy unicorn), the world map
   markers, balloons and the ferry, wild herds with co-op taming and sanctuaries, the trust
   HUD, and the follower AI the foal, the pet and a trusting wild horse all share.
   Owned by this package: this file plus five one-line hot spots in ranch3d.html (G.anim,
   G.wild + the stray-spawn guard, the companion foal guard, G.petComp, ev.at in startCourse).
   Nothing runs at import time. */
export const id='world';
export function install(G){
 const {THREE,scene,$,toast}=G;
 const W=G.world,T=G.tables,H=G.horse,S=G.save,M=G.money,Q=G.quest,N=G.net,UI=G.ui;
 const player=H.player;
 const groundH=W.groundH, riverZ=W.riverZ, riverLevel=W.riverLevel;
 const box=W.box,tube=W.tube,blob=W.blob;
 const hyp=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
 const wrap=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
 const rnd=(a,b)=>a+Math.random()*(b-a);
 const P={};                                             // this package's live state, exposed as G.worldPkg for QA
 G.worldPkg=P;

 /* ================= save fields ================= */
 S.ensure(s=>{
  s.unlocked=s.unlocked||{}; s.bottles=s.bottles||[]; if(s.toyUnicorn===undefined)s.toyUnicorn=null;
  s.sanctuary=s.sanctuary||{}; s.wildSeen=s.wildSeen||{}; if(s.companion===undefined)s.companion=null;
  s.stats=s.stats||{}; if(s.stats.balloons==null)s.stats.balloons=0; if(s.stats.ferry==null)s.stats.ferry=0; if(s.stats.tamedWild==null)s.stats.tamedWild=0; if(s.stats.released==null)s.stats.released=0;
 });

 /* ================= 1. regions: metadata, unlock rules, venues ================= */
 /* Region ids are stable keys the rest of the package (and other packages) ask for. Unlock
    rules are story-by-label so a story package that inserts a prologue does not shift them,
    with a ranch-level alternative so a builder is never stuck, and a seasonal open week. */
 const REGION_META={
  '🐴 Home Pasture':{id:'pasture',biome:'meadow',ft:'🐴 Pasture'},
  '🏜️ Coyote Canyon':{id:'coyote',biome:'desert',ft:'🤠 Coyote Canyon',unlock:{story:['Visit Loon Lake',2,8],ranch:3,text:'after book one of the story, or at ranch level 3'},venue:{x:-220,z:130}},
  '🌾 Barleyfold Farms':{id:'barleyfold',biome:'farm',ft:'🌾 Barleyfold',unlock:{story:['Win Cottonwood Welcome Jump',1,4],ranch:2,text:'after Grandpa Wren\'s fourth errand, or at ranch level 2'},venue:{x:150,z:-122}},
  '💦 Hollowpeak Falls':{id:'falls',biome:'mountain',ft:'💦 The Falls',unlock:{story:['Win the Championship Final',1,7],ranch:3,text:'once the Championship Final is on the board, or at ranch level 3'}},
  '🏔️ Hollowpeak Heights':{id:'hollowpeak',biome:'mountain',ft:'🏔️ Hollowpeak',unlock:{story:['Win the Championship Final',1,7],ranch:3,text:'once the Championship Final is on the board, or at ranch level 3'},venue:{x:-110,z:-170}},
  '🌉 Riverside Crossing':{id:'riverside',biome:'river',ft:null},
  '🌊 Loon Lake':{id:'lake',biome:'lake',ft:'🌊 Loon Lake'},
  '🏘️ Cottonwood Village':{id:'cottonwood',biome:'meadow',ft:'🏘️ Cottonwood',venue:{x:76,z:-28}},
  '🌲 Hollowpeak Pines':{id:'pines',biome:'forest',ft:null},
  '🏡 Meadowlark Ranch':{id:'ranch',biome:'meadow',ft:'🏠 Ranch',venue:{x:2,z:1}},
  '🌾 Kestrel Basin Meadows':{id:'meadows',biome:'meadow',ft:null},
  /* The four quarters past the old fence. Deliberately no unlock rule: a locked region is
     physically barred, not merely un-fast-travellable, and gating these would hand the
     player a bigger basin and then fence most of it off again. They are open country,
     and their fast-travel stops open with them. */
  '🍂 Amberwood':{id:'amberwood',biome:'forest',ft:'🍂 Amberwood'},
  '🪻 Willowmere Marsh':{id:'willowmere',biome:'marsh',ft:'🪻 Willowmere'},
  '❄️ Frostpine Tundra':{id:'frostpine',biome:'mountain',ft:'❄️ Frostpine'},
  '🏜️ Ochre Reach':{id:'ochre',biome:'desert',ft:'🏜️ Ochre Reach'},
 };
 for(const rg of T.REGIONS){const m=REGION_META[rg.name];if(m)Object.assign(rg,m);else if(!rg.id)rg.id=rg.name.replace(/[^a-z]/gi,'').toLowerCase();}
 const OPEN_ROTATION=['coyote','hollowpeak','barleyfold'];   // one locked region opens to everyone for a season's first week
 const regionById=id=>T.REGIONS.find(r=>r.id===id);
 function ranchLevel(s){const p=(s.decor||[]).reduce((a,d)=>a+((T.DECOR_CAT[d.t]||{}).pts||0),0);let l=1;for(let i=1;i<T.RANCH_LEVELS.length;i++)if(p>=T.RANCH_LEVELS[i])l=i+1;return l;}
 function storyIndexOf(label,nth){let k=0;for(let i=0;i<Q.STORY.length;i++)if(Q.STORY[i].label===label){k++;if(k===nth)return i;}return -1;}
 function storyReached(rule){const i=storyIndexOf(rule[0],rule[1]);return Q.storyIdx()>=(i>=0?i:rule[2]);}
 function seasonOpen(rg){
  try{const sn=G.time.seasonNow(); if(sn.def&&(sn.def.openRegion===rg.id||(Array.isArray(sn.def.openRegions)&&sn.def.openRegions.includes(rg.id))))return true;
   return sn.day<=7&&OPEN_ROTATION[sn.n%OPEN_ROTATION.length]===rg.id;}catch(e){return false;}
 }
 function ruleTrue(rg,s){const u=rg.unlock;if(!u)return true;return (u.story&&storyReached(u.story))||(u.ranch&&ranchLevel(s)>=u.ranch);}
 function regionUnlocked(rg,s){if(!rg||!rg.unlock)return true;s=s||S.fresh()||{};return !!((s.unlocked&&s.unlocked[rg.id])||ruleTrue(rg,s)||seasonOpen(rg));}
 function lockText(rg){return rg.name+' opens '+(rg.unlock?rg.unlock.text:'')+(seasonOpen(rg)?'':' — or during its season open week');}
 /* Write the permanent unlock the first time a rule is true, and say so once. */
 function ensureUnlocks(){
  const news=[];
  S.sync(s=>{s.unlocked=s.unlocked||{};for(const rg of T.REGIONS){if(!rg.unlock||s.unlocked[rg.id])continue;if(ruleTrue(rg,s)){s.unlocked[rg.id]=Date.now();news.push(rg);}}});
  for(const rg of news){try{toast('🗺️ New region: '+rg.name+' is open to you!');G.xp.passAdd(50);}catch(e){}}
  if(news.length)refreshFtLocks();
  return news;
 }
 function lockedRegionsAt(x,z){return T.REGIONS.filter(rg=>rg.unlock&&rg.r<999&&hyp(x,z,rg.x,rg.z)<rg.r&&!regionUnlocked(rg));}
 Object.assign(P,{REGION_META,regionUnlocked,ruleTrue,seasonOpen,ensureUnlocks,lockText,ranchLevel,storyIndexOf,lockedRegionsAt,regionById});

 /* Jumping events are laid in their own town's arena (startCourse reads ev.at). Dressage keeps
    the lettered home arena; races already cross the regions. */
 const VENUE_OF={Cottonwood:'cottonwood',Barleyfold:'barleyfold',Coyote:'coyote',Hollowpeak:'hollowpeak'};
 for(const rg of T.REGIONS){if(rg.venue&&rg.id!=='ranch'){const at=findClear(rg.venue.x,rg.venue.z,24,80);rg.venue.x=at[0];rg.venue.z=at[1];}}   // the canyon's mesas were placed before us
 for(const ev of T.EVENTS3){if(ev.race||ev.dressage||ev.kind||ev.at)continue;const rg=regionById(VENUE_OF[ev.town]);if(rg&&rg.venue)ev.at=[rg.venue.x,rg.venue.z];}
 /* A course that starts in another town takes you there: the fences are 250 m away otherwise. */
 G.on('courseStart',c=>{const ev=c&&c.ev;if(!ev||!ev.at||P.veh)return;if(hyp(player.pos.x,player.pos.z,ev.at[0],ev.at[1])>45){player.pos.set(ev.at[0]-22,0,ev.at[1]);player.speed=0;player.heading=Math.PI/2;toast('🧭 Off to the '+ev.town+' arena!');}});

 /* Fast travel respects the locks (capture phase runs before the button's own handler), and
    the bar is greyed whenever it is rebuilt. The soft boundary in tick handles riding in. */
 function ftRegion(f){const rg=T.REGIONS.find(r=>r.ft===f[0]);return rg||T.REGIONS.find(r=>r.r<999&&hyp(f[1],f[2],r.x,r.z)<r.r&&r.unlock)||null;}
 function refreshFtLocks(){const bar=$('ftBar');if(!bar)return;bar.querySelectorAll('[data-ft]').forEach(b=>{const f=T.FT[+b.dataset.ft];const rg=f&&ftRegion(f);const locked=rg&&!regionUnlocked(rg);b.classList.toggle('ftLocked',!!locked);b.title=locked?lockText(rg):'';b.textContent=(locked?'🔒 ':'')+f[0];});}
 {const bar=$('ftBar');if(bar){bar.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-ft]');if(!b)return;const f=T.FT[+b.dataset.ft];const rg=f&&ftRegion(f);if(rg&&!regionUnlocked(rg)){e.stopImmediatePropagation();e.preventDefault();P.lastLock=rg.id;toast('🔒 '+lockText(rg));}},true);
  try{new MutationObserver(()=>refreshFtLocks()).observe(bar,{childList:true});}catch(e){}}}
 refreshFtLocks();
 {const st=document.createElement('style');st.textContent='#ftBar .ftLocked{opacity:.55;filter:grayscale(.7)}#tameHud.bad{background:#a33}#tameHud .cbar{background:rgba(255,255,255,.22);width:170px;margin-top:5px}#tameHud .cfill{background:#8fe08a}#tameHud small{display:block;font-weight:600;font-size:11px;opacity:.85}';document.head.appendChild(st);}

 /* ================= helpers: clear ground, structures ================= */
 /* The canyon's mesas and the mountain's slopes are placed by the terrain, so a structure asks
    for a clear circle before it is built instead of assuming one. */
 function clear(x,z,need){for(const c of W.colliders){if(hyp(x,z,c.x,c.z)<c.r+need)return false;}return Math.abs(z-riverZ(x))>need+8&&hyp(x,z,20,16)>need+10;}
 /* ok, when it is given, is one more test the spot has to pass: for a placement that has to keep
    off something that is not a collider. */
 function findClear(cx,cz,need,maxR,ok){const fits=(x,z)=>clear(x,z,need)&&(!ok||ok(x,z));if(fits(cx,cz))return [cx,cz];for(let r=6;r<=(maxR||60);r+=6)for(let k=0;k<10;k++){const a=k/10*Math.PI*2+r*0.3,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(fits(x,z))return [x,z];}return [cx,cz];}
 P.findClear=findClear;
 const paintMat=W.mats.paintMat;
 function post(x,z,g,h,c){box(0.18,h||1.25,0.18,c||'#c9b083',x,(h||1.25)/2,z,g);}
 function railRing(g,R,segs,gapFrom,gapTo,col){   // posts and rails round a circle with one mouth
  let prev=null;
  for(let k=0;k<=segs;k++){const a=k/segs*Math.PI*2,inGap=gapFrom!=null&&a>gapFrom&&a<gapTo;const x=Math.cos(a)*R,z=Math.sin(a)*R;
   if(!inGap)post(x,z,g);
   if(prev&&!inGap&&!prev.gap){const mx=(x+prev.x)/2,mz=(z+prev.z)/2,len=Math.hypot(x-prev.x,z-prev.z);const rail=box(len,0.10,0.07,col||'#e2d3ae',mx,0.95,mz,g);rail.rotation.y=Math.atan2(x-prev.x,z-prev.z)+Math.PI/2;const r2=box(len,0.08,0.06,col||'#e2d3ae',mx,0.55,mz,g);r2.rotation.y=rail.rotation.y;}
   prev={x,z,gap:inGap};}
 }
 function sign(text,w,h){try{return W.arrivalArt.buildSign({text,width:w||2.4,height:h||0.42});}catch(e){return new THREE.Group();}}
 /* ---- nameplates ---------------------------------------------------------------------
    Two things are wrong with the built-in plate and both of them show up in a screenshot.
    It cuts the text at 22 characters, which is how "Wick the Almanac-Keeper" came to read
    "Wick the Almanac-Ke" and how half this package's shopfronts lost their last word; and a
    plate is 2.4 m of fixed world geometry, so the moment anything wearing one walks past the
    lens it becomes a white billboard across a third of the frame. plate() sizes the canvas to
    the words instead of slicing them. The billboard half is handled by tickLabels() further
    down, which fades every plate in the scene by distance — ours, the game's, anybody's.
    Declared up here rather than beside the fade pass: labelAt runs while this file installs,
    long before section 10's line is reached, and a const declared down there would still be
    in its dead zone. */
 const LABELS=[];
 /* One house size for a nameplate. A couple of them are hung four metres wide — the quest
    board's and the calendar's — which at eight metres away is a quarter of the screen and reads
    as a menu that has escaped into the world. The canvas is untouched, so the words stay every
    bit as readable; they simply stop shouting. */
 const PLATE_MAX=2.6;
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;
 function plate(text){
  const s=String(text==null?'':text);
  const cv=document.createElement('canvas'),c=cv.getContext('2d');
  let fs=56;c.font='700 '+fs+'px "Trebuchet MS",sans-serif';
  let w=c.measureText(s).width;
  while(w>860&&fs>30){fs-=2;c.font='700 '+fs+'px "Trebuchet MS",sans-serif';w=c.measureText(s).width;}   // something very long shrinks to fit instead of running off the end
  cv.height=128;cv.width=Math.max(256,Math.ceil((w+120)/8)*8);   // setting width resets the context, so the font is set again below
  c.fillStyle='rgba(255,255,253,0.88)';c.beginPath();c.roundRect(10,12,cv.width-20,104,44);c.fill();
  c.font='700 '+fs+'px "Trebuchet MS",sans-serif';c.textAlign='center';c.fillStyle='#4a3526';
  c.fillText(s,cv.width/2,68+fs*0.34);
  const tx=new THREE.CanvasTexture(cv);tx.minFilter=THREE.LinearFilter;tx.generateMipmaps=false;
  try{tx.anisotropy=G.renderer.capabilities.getMaxAnisotropy();}catch(e){}
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true}));
  sp.scale.set(0.6*cv.width/cv.height,0.6,1);   // the plate keeps the game's 0.6 m height and grows sideways
  sp.userData.plate=1;
  return sp;
 }
 /* Repaint a plate somebody else already hung, for the cases where we know the full text and
    the game only kept the first 22 characters of it. */
 function redress(sp,text){
  if(!sp||!sp.material)return sp;
  const np=plate(text);
  try{if(sp.material.map)sp.material.map.dispose();}catch(e){}
  sp.material.map=np.material.map;sp.material.needsUpdate=true;
  sp.scale.copy(np.scale);
  for(const L of LABELS)if(L.sp===sp){const k=np.scale.x>PLATE_MAX?PLATE_MAX/np.scale.x:1;L.bx=np.scale.x*k;L.by=np.scale.y*k;}
  try{np.material.dispose();}catch(e){}
  return sp;
 }
 function labelAt(g,text,y){const sp=plate(text);sp.position.y=y||3;g.add(sp);return sp;}
 function building(kind,opts){opts=opts||{};if(kind==='cottage')return W.ranchArchitecture.buildCottage({variant:opts.variant||0});if(kind==='barn')return W.ranchArchitecture.buildBarn();return W.ranchArchitecture.buildOutbuilding(Object.assign({width:4.6,depth:3.2,height:3.4,animatedDoorOpening:{width:1.0,height:1.9}},opts));}
 /* A door: stand near a building and press E to open the panel it houses. */
 function door(id,x,z,r,label,open){return W.addThing({kind:'door',id,x,z,g:null,reach:r,label:()=>label+' (E)',use:()=>{try{open();}catch(e){console.error('door '+id,e);}}});}

 /* ================= 2. towns, landmarks, walls, oasis, arenas ================= */
 const TOWNS=[
  {id:'cottonwood',region:'cottonwood',name:'Cottonwood Village',cx:47,cz:-50,
   buildings:[
    {id:'store',kind:'outbuilding',x:34,z:-58,rot:0.9,label:'🛍️ Petal & Pail general store',r:2.8,open:()=>UI.openShop('food'),door:'🛍️ Enter the general store'},
    {id:'auction',kind:'barn',x:64,z:-58,rot:-0.5,label:'🏛️ Cottonwood Auction House',r:5.2,open:()=>UI.openShop('market'),door:'🏛️ Step into the auction house',glyph:'🏛️'},
    {id:'clubhouse',kind:'cottage',x:33,z:-45,rot:1.2,variant:2,label:'🏠 The Meadowlark Club House',r:2.6,open:()=>UI.openOnline(),door:'🏠 Go into the club house',glyph:'🏠'},
    {id:'inn',kind:'cottage',x:41,z:-63,rot:0.2,variant:3,label:'🏨 The Blossom Inn',r:2.6,open:()=>UI.openCare(),door:'🏨 Rest at the inn'},
   ],
   folk:[
    {id:'cw_pim',name:'Pim',icon:'🧑',hat:'#c9a86a',shirt:'#6a8fbf',idle:'Morning! The store had fresh apples in — go on, your horse will thank you.',path:[[40,-52],[36,-58],[44,-60],[50,-54]]},
    {id:'cw_rosa',name:'Rosa',icon:'👩',hat:'#e07a7a',shirt:'#9bbf6a',idle:'The auction house is buzzing today. A grey went for six hundred, can you believe it?',path:[[58,-52],[62,-46],[52,-44],[50,-56]]},
    {id:'cw_ned',name:'Old Ned',icon:'👴',hat:'#8a7a5a',shirt:'#7a5a3a',idle:'Been here since before the bridge. Cottonwood was three cottages and a well.',path:[[36,-48],[38,-40],[46,-38],[44,-46]]},
   ]},
  {id:'barleyfold',region:'barleyfold',name:'Barleyfold Farms',cx:215,cz:-105,
   buildings:[
    {id:'breedbarn',kind:'barn',x:236,z:-120,rot:0.6,label:'💞 Barleyfold Breeding Barn',r:5.4,open:()=>UI.openShop('breed'),door:'💞 Visit the breeding barn',glyph:'💞'},
    {id:'grain',kind:'outbuilding',x:196,z:-118,rot:-0.4,label:'🌾 Barleyfold grain store',r:2.8,open:()=>UI.openShop('food'),door:'🌾 Buy feed at the grain store'},
    {id:'farmhouse',kind:'cottage',x:200,z:-86,rot:2.4,variant:1,label:'🏠 Otto\'s farmhouse',r:2.6},
    {id:'gatehouse',kind:'outbuilding',x:186,z:-72,rot:0.0,label:'🚪 Barleyfold gatehouse',r:2.6,opts:{width:3.2,depth:2.6,height:2.8}},
   ],
   walls:{x1:180,z1:-146,x2:256,z2:-64,gaps:[[180,-96,180,-82],[214,-146,232,-146],[256,-112,256,-98]]},
   folk:[
    {id:'bf_hanne',name:'Hanne',icon:'👩‍🌾',hat:'#d9c47f',shirt:'#c46a3a',idle:'Mind the wheat rows! The harvest cart comes through at noon.',path:[[205,-112],[222,-100],[224,-88],[208,-92]]},
    {id:'bf_kip',name:'Kip',icon:'🧑‍🌾',hat:'#7a5a3a',shirt:'#5a7a3a',idle:'I feed the stud horses at the breeding barn. Some of them are faster than yours, no offence.',path:[[228,-112],[240,-108],[242,-126],[226,-128]]},
    {id:'bf_lotte',name:'Lotte',icon:'👧',hat:'#f2c1d1',shirt:'#8ab0e0',idle:'Did you come in the gate? Uncle Otto says the walls kept the coyotes out for a hundred years.',path:[[192,-90],[188,-78],[200,-76],[204,-90]]},
   ]},
  {id:'coyote',region:'coyote',name:'Coyote Canyon outpost',cx:-220,cz:130,
   buildings:[
    {id:'saddlery',kind:'outbuilding',x:-206,z:112,rot:0.4,label:'🧵 Bea\'s Saddlery',r:2.9,open:()=>UI.openShop('tack'),door:'🧵 Browse the saddlery',glyph:'🧵',opts:{width:5.2,depth:3.4,height:3.2,animatedDoorOpening:{width:1.1,height:1.9}}},
    {id:'outpost',kind:'outbuilding',x:-230,z:116,rot:-0.7,label:'🤠 Sheriff\'s outpost',r:2.9,open:()=>UI.openQuests(),door:'🤠 Read the bounty board',glyph:'🤠'},
    {id:'trading',kind:'outbuilding',x:-236,z:140,rot:0.2,label:'🏜️ Dry Gulch trading post',r:2.8,open:()=>UI.openShop('food'),door:'🏜️ Trade at the post'},
   ],
   rail:{x:-218,z:120},
   oasis:{x:-200,z:158,r:7},
   folk:[
    {id:'cc_dusty',name:'Dusty',icon:'🤠',hat:'#5a4a3a',shirt:'#b07a4a',idle:'Ain\'t seen the Sheriff\'s badge since the dust storm. Reckon it is out on the mesas somewhere.',path:[[-222,124],[-228,130],[-218,136],[-212,126]]},
    {id:'cc_sol',name:'Sol',icon:'🧑',hat:'#e8c070',shirt:'#c85a3a',idle:'There is water at the oasis east of here. The wild herd comes down to drink at dusk.',path:[[-208,146],[-198,152],[-194,164],[-206,160]]},
   ]},
  {id:'hollowpeak',region:'hollowpeak',name:'Hollowpeak hamlet',cx:-160,cz:-210,
   buildings:[
    {id:'lodge',kind:'outbuilding',x:-168,z:-192,rot:0.5,label:'🎽 Summit Lodge outfitters',r:2.9,open:()=>UI.openShop('style'),door:'🎽 Step into the lodge',glyph:'🎽',opts:{width:5.0,depth:3.6,height:3.4,animatedDoorOpening:{width:1.1,height:1.9}}},
    {id:'cabin',kind:'cottage',x:-138,z:-204,rot:-0.8,variant:0,label:'🧣 Ilse\'s cabin',r:2.6},
   ],
   folk:[
    {id:'hp_bjorn',name:'Bjørn',icon:'🧔',hat:'#3a3a4a',shirt:'#4a6a8a',idle:'Snow on the pass by morning. The falls freeze at the edges — beautiful, and treacherous.',path:[[-160,-200],[-152,-194],[-146,-208],[-158,-214]]},
   ]},
 ];
 P.TOWNS=TOWNS; P.LANDMARKS=[]; P.townsfolk=[];
 function buildTown(tn){
  const rg=regionById(tn.region);
  for(const b of tn.buildings){
   const need=b.r+1.5; const at=findClear(b.x,b.z,need,40); b.x=at[0]; b.z=at[1];
   let grp=null;
   /* No label passed to addBuilding: its plate would arrive pre-truncated — "🛍️ Petal & Pail
      general store" came out as "🛍️ Petal & Pail gener". We hang our own at the height the
      architecture suggests instead. */
   try{grp=W.addBuilding({x:b.x,z:b.z,rot:b.rot||0,r:b.r,build:()=>building(b.kind,Object.assign({variant:b.variant||0},b.opts||{}))});
    if(grp)labelAt(grp,b.label,(grp.userData.architecture&&grp.userData.architecture.suggestedLabelY)||3);}catch(e){console.error('town building '+b.id,e);}
   if(b.open)door(tn.id+':'+b.id,b.x,b.z,b.r+2.6,b.door||b.label,b.open);
   P.LANDMARKS.push({id:tn.id+':'+b.id,region:tn.region,x:b.x,z:b.z,label:b.label,glyph:b.glyph||null,kind:b.kind,grp});
  }
  if(tn.walls){   // the walled farm town: stone runs with gaps for the roads, every run a collider
   const w=tn.walls,g=new THREE.Group();const runs=[[w.x1,w.z1,w.x2,w.z1],[w.x2,w.z1,w.x2,w.z2],[w.x2,w.z2,w.x1,w.z2],[w.x1,w.z2,w.x1,w.z1]];
   let n=0;
   for(const r of runs){const len=Math.hypot(r[2]-r[0],r[3]-r[1]),steps=Math.round(len/6);
    for(let k=0;k<steps;k++){const x=r[0]+(r[2]-r[0])*(k+0.5)/steps,z=r[1]+(r[3]-r[1])*(k+0.5)/steps;
     if(w.gaps.some(gp=>x>=Math.min(gp[0],gp[2])-1&&x<=Math.max(gp[0],gp[2])+1&&z>=Math.min(gp[1],gp[3])-1&&z<=Math.max(gp[1],gp[3])+1))continue;
     const gy=groundH(x,z),ry=Math.atan2(r[2]-r[0],r[3]-r[1])+Math.PI/2;
     const seg=box(6.1,2.2,0.9,'#b8a98a',0,0,0,g);seg.position.set(x,gy+1.1,z);seg.rotation.y=ry;seg.castShadow=true;seg.receiveShadow=true;
     const cap=box(6.2,0.25,1.1,'#8a7a62',0,0,0,g);cap.position.set(x,gy+2.3,z);cap.rotation.y=ry;
     W.colliders.push({x,z,r:3.0});n++;}}
   for(const gp of w.gaps){const gx=(gp[0]+gp[2])/2,gz=(gp[1]+gp[3])/2;post(gp[0],gp[1],g,3.2,'#8a7a62');post(gp[2],gp[3],g,3.2,'#8a7a62');const arch=sign('BARLEYFOLD',3.2,0.5);arch.position.set(gx,groundH(gx,gz)+3.4,gz);arch.rotation.y=Math.atan2(gp[2]-gp[0],gp[3]-gp[1])+Math.PI/2;g.add(arch);}
   scene.add(g);W.followCamera.register(g);tn.wallSegs=n;
  }
  if(tn.rail){const g=new THREE.Group();post(-1.4,0,g,1.1,'#6b4a2a');post(1.4,0,g,1.1,'#6b4a2a');box(3.2,0.09,0.09,'#8a6a4a',0,1.05,0,g);g.position.set(tn.rail.x,groundH(tn.rail.x,tn.rail.z),tn.rail.z);scene.add(g);}
  if(tn.oasis){   // a desert pond ringed with palms: the herd drinks here, and so can you
   const o=tn.oasis,g=new THREE.Group();
   const water=new THREE.Mesh(new THREE.CircleGeometry(o.r,28),new THREE.MeshStandardMaterial({color:0x3f9fc6,roughness:0.15,metalness:0.2,transparent:true,opacity:0.86}));water.rotation.x=-Math.PI/2;water.position.y=0.12;g.add(water);
   const bank=new THREE.Mesh(new THREE.RingGeometry(o.r,o.r+2.2,28),new THREE.MeshStandardMaterial({color:0x7fb26a,roughness:1}));bank.rotation.x=-Math.PI/2;bank.position.y=0.08;g.add(bank);
   for(let k=0;k<7;k++){const a=k/7*Math.PI*2,x=Math.cos(a)*(o.r+1.6),z=Math.sin(a)*(o.r+1.6);const tr=tube(0.12,0.2,4.2,'#8a6a45',x,2.1,z,g);tr.rotation.z=Math.cos(a)*0.18;tr.rotation.x=-Math.sin(a)*0.18;for(let f=0;f<6;f++){const fr=blob(0.28,0.12,1.6,'#4f9a4a',x,4.2,z,g);fr.rotation.y=f/6*Math.PI*2;fr.rotation.x=0.35;fr.position.x+=Math.sin(f/6*Math.PI*2)*0.9;fr.position.z+=Math.cos(f/6*Math.PI*2)*0.9;}}
   for(let k=0;k<12;k++){const a=Math.random()*Math.PI*2,r=o.r+0.3+Math.random()*1.2;tube(0.02,0.03,0.9,'#6a9a3a',Math.cos(a)*r,0.45,Math.sin(a)*r,g);}
   const y=groundH(o.x,o.z);g.position.set(o.x,y,o.z);scene.add(g);P.oasis={x:o.x,z:o.z,r:o.r,y:y+0.12};
   labelAt(g,'🌴 Dry Gulch Oasis',3.2);
   W.addThing({kind:'oasis',id:'oasis',x:o.x,z:o.z,g:null,reach:o.r+3,label:()=>'🌴 Let your horse drink (E)',use:()=>{let ok=false;S.sync(s=>{const h=s.horses[H.rideIdx()];if(!h)return;h.needs=h.needs||{};h.needs.thirst=Math.min(100,(h.needs.thirst||0)+40);ok=true;});if(ok){toast('🌴 '+H.ridden().name+' drinks deep at the oasis. +40 thirst');G.sChime();}}});
  }
  for(const f of tn.folk){   // townsfolk stroll their little rounds; quest-givers stay put so they can be found
   const def={id:f.id,name:f.name,icon:f.icon,x:f.path[0][0],z:f.path[0][1],hat:f.hat,shirt:f.shirt,idle:f.idle,folk:true};
   try{const e=W.addNPC(def);P.townsfolk.push({e,def,path:f.path,wi:1,x:def.x,z:def.z,heading:0,town:tn.id,pause:0});}catch(err){console.error('townsfolk '+f.id,err);}
  }
 }
 for(const tn of TOWNS){try{buildTown(tn);}catch(e){console.error('town '+tn.id,e);}}
 /* Arenas: a fenced ring round each town's jumping ellipse, a grandstand and a sign. Venue coords
    are what startCourse now reads from ev.at. */
 const ARENAS=[];
 for(const rg of T.REGIONS){
  if(!rg.venue||rg.id==='ranch')continue;
  const v=rg.venue,g=new THREE.Group(),A=20,B=15;
  let prev=null;for(let k=0;k<=36;k++){const th=k/36*Math.PI*2,x=Math.cos(th)*A,z=Math.sin(th)*B;if(k%2===0)post(x,z,g,1.1,'#dcd3bd');if(prev){const mx=(x+prev.x)/2,mz=(z+prev.z)/2,len=Math.hypot(x-prev.x,z-prev.z);const rail=box(len,0.09,0.07,'#f2ecdc',mx,0.9,mz,g);rail.rotation.y=Math.atan2(x-prev.x,z-prev.z)+Math.PI/2;}prev={x,z};}
  const townName=(rg.name.slice(rg.name.indexOf(' ')+1)).split(' ')[0].toUpperCase();
  const sg=sign(townName+' ARENA',4.4,0.5);sg.position.set(0,3.1,-B-1.5);g.add(sg);post(-2.3,-B-1.5,g,3.0,'#8a7a62');post(2.3,-B-1.5,g,3.0,'#8a7a62');
  const stand=new THREE.Group();for(let r=0;r<3;r++){const b=box(12,0.5,1.2,r%2?'#c9a86a':'#b8935a',0,0.25+r*0.55,-r*1.25,stand);b.castShadow=true;}box(12.4,0.2,4,'#6b4a2a',0,0.05,-1.25,stand);post(-6,-3.6,stand,3.2,'#6b4a2a');post(6,-3.6,stand,3.2,'#6b4a2a');const roof=box(13,0.16,4.6,'#a33a3a',0,3.3,-1.4,stand);roof.rotation.x=0.12;
  stand.position.set(0,0,B+4.5);stand.rotation.y=Math.PI;g.add(stand);
  g.position.set(v.x,groundH(v.x,v.z),v.z);
  for(const c of g.children){if(c.isMesh){c.castShadow=true;}}
  scene.add(g);W.followCamera.register(g);
  W.colliders.push({x:v.x,z:v.z+B+4.5,r:5.5});
  const lbl=rg.name.slice(rg.name.indexOf(' ')+1).split(' ')[0]+' Arena';
  door('grandstand:'+rg.id,v.x,v.z+B+4.5,7.5,'🏆 '+lbl+' grandstand — see the events',()=>UI.openEvents());
  ARENAS.push({id:rg.id,x:v.x,z:v.z,label:lbl,g});
  P.LANDMARKS.push({id:'arena:'+rg.id,region:rg.id,x:v.x,z:v.z,label:'🏟️ '+lbl,glyph:'🏟️',kind:'arena',grp:g});
 }
 P.ARENAS=ARENAS;
 /* Townsfolk walk their rounds only when someone is there to see it. */
 function tickTownsfolk(dt){
  for(const f of P.townsfolk){
   if(hyp(player.pos.x,player.pos.z,f.x,f.z)>180)continue;
   if(f.pause>0){f.pause-=dt;continue;}
   const wp=f.path[f.wi],dx=wp[0]-f.x,dz=wp[1]-f.z,d=Math.hypot(dx,dz);
   if(d<0.4){f.wi=(f.wi+1)%f.path.length;f.pause=1.5+Math.random()*4;continue;}
   const want=Math.atan2(dx,dz);f.heading+=wrap(want-f.heading)*Math.min(1,dt*4);
   const sp=0.9;f.x+=Math.sin(f.heading)*sp*dt;f.z+=Math.cos(f.heading)*sp*dt;
   const g=f.e.g;g.position.set(f.x,groundH(f.x,f.z),f.z);g.rotation.y=f.heading;
   g.position.y+=Math.abs(Math.sin(performance.now()*0.008))*0.03;
  }
 }

 /* ================= 3. collectibles: bottles, sheriff badges, the toy unicorn ================= */
 /* Eight bottles along the water, each with a note from the valley's past. */
 const BOTTLE_NOTES=[
  'To whoever finds this: the river was high the spring we built the bridge. Grandma W. swam it on a grey mare to fetch the doctor. Nobody believed her but me.',
  'Loon Lake, midsummer. Counted eleven loons and one silver horse drinking at the far shore. Did not tell Wren. He would only go looking.',
  'Ferry log, day 40: two riders, one dog, a sack of Barleyfold pumpkins that rolled overboard. The bass have never eaten so well.',
  'If the Cottonwood blossom is out before the ice leaves the falls, plant the lettuce late. My mother said so and she was never wrong about lettuce.',
  'Sheriff\'s note: lost my badge somewhere between the mesas and the river. If found, keep it — I have another, and you earned it.',
  'The canyon herd has a dun with a stripe down her back like a river on a map. She will not be caught by anyone in a hurry.',
  'Ilse says the snowfield horses came down the pass a hundred winters ago and simply stayed. So did she, I think.',
  'For the one who reads every note: the toy unicorn was Grandma\'s. She hid it behind the falls for a grandchild who could find it. Look where the mist is thickest.',
 ];
 function bank(x,off){const z0=riverZ(x);for(const dz of [off,-off]){const z=z0+dz;if(groundH(x,z)>riverLevel(x)+0.35)return [x,z];}return [x,z0+off];}
 const BOTTLES=[
  {id:'b1',pt:bank(-120,7),region:'meadows'},{id:'b2',pt:bank(-70,7),region:'meadows'},{id:'b3',pt:[14,124],region:'riverside'},{id:'b4',pt:bank(60,7),region:'meadows'},
  {id:'b5',pt:bank(110,7),region:'meadows'},{id:'b6',pt:bank(-190,7),region:'coyote'},{id:'b7',pt:[31,17],region:'lake'},{id:'b8',pt:[9,20],region:'lake'},
 ].map((b,i)=>Object.assign(b,{note:BOTTLE_NOTES[i],x:b.pt[0],z:b.pt[1]}));
 P.BOTTLES=BOTTLES;
 const glassMat=new THREE.MeshStandardMaterial({color:0x7fd8c8,emissive:0x3fa898,emissiveIntensity:0.35,roughness:0.15,metalness:0.1,transparent:true,opacity:0.85});
 function mkBottle(b){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,0.42,10),glassMat);body.position.y=0.3;g.add(body);const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.08,0.16,8),glassMat);neck.position.y=0.58;g.add(neck);box(0.07,0.08,0.07,'#c9a86a',0,0.68,0,g);const note=box(0.06,0.2,0.02,'#f4e8c8',0,0.3,0,g);note.rotation.y=0.6;g.rotation.z=0.35;g.position.set(b.x,groundH(b.x,b.z),b.z);scene.add(g);return g;}
 function loreCard(title,text,extra){const d=$('dlg');if(!d)return;d.innerHTML='<b>'+title+'</b><p style="font-style:italic">'+text+'</p>'+(extra||'')+'<button id="dlgBtn">Keep it 🍾</button>';d.style.display='block';$('dlgBtn').onclick=()=>{d.style.display='none';};}
 for(const b of BOTTLES){
  const g=mkBottle(b);
  W.addThing({kind:'bottle',id:b.id,g,x:b.x,z:b.z,reach:0,label:()=>'',
   tick(dt,t,d){if(!g.visible)return;g.position.y=groundH(b.x,b.z)+Math.sin(performance.now()*0.002+b.x)*0.04;if(d<1.7&&player.y<1.2)collectBottle(b,t);}});
  b.thing=g;
 }
 function collectBottle(b,t){
  if(!b.thing.visible)return; b.thing.visible=false;
  let n=0,key=false,all=false;
  S.sync(s=>{s.bottles=s.bottles||[];if(!s.bottles.includes(b.id))s.bottles.push(b.id);n=s.bottles.length;s.coins+=60;if(n%4===0){s.keys=(s.keys||0)+1;key=true;}if(n>=BOTTLES.length&&!S.flag(s,'bottles-all')){}else if(n>=BOTTLES.length&&!(s.setsDone&&s.setsDone.bottles)){s.setsDone=s.setsDone||{};s.setsDone.bottles=true;M.payReward(s,{g:5,k:1});all=true;}});
  M.refreshWallet();G.sChime();G.xp.passAdd(4);Q.dailyEvt('bottle',1);
  loreCard('🍾 Message in a bottle '+n+'/'+BOTTLES.length,b.note,'<div style="font-size:12px;color:#8c7a63">+60🪙'+(key?' +1🗝️':'')+(all?' — every bottle found! +5💎 +1🗝️':'')+'</div>');
  toast('🍾 A message in a bottle! +60🪙'+(key?' +1🗝️':''));
 }
 /* Sheriff badges: eight brass stars, six lost on the mesas and two carried off toward the river. */
 T.COLL_SETS.badges={label:'⭐ Sheriff badges',col:'#f0b429',n:8,reward:{g:5,k:2},
  pts:[[-198,98],[-246,112],[-262,150],[-228,176],[-188,168],[-256,86],[236,-62],[-14,140]]};
 const badgeMat=new THREE.MeshStandardMaterial({color:0xf0b429,emissive:0xa87418,emissiveIntensity:0.35,metalness:0.9,roughness:0.25});
 function mkBadge(i,pt){const g=new THREE.Group();const star=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.04,5),badgeMat);star.rotation.x=Math.PI/2;star.position.y=0.55;g.add(star);const pin=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.06,12),badgeMat);pin.rotation.x=Math.PI/2;pin.position.set(0,0.55,0.03);g.add(pin);g.position.set(pt[0],groundH(pt[0],pt[1]),pt[1]);scene.add(g);return {g,m:star};}
 T.COLL_SETS.badges.pts.forEach((pt,i)=>{
  const at=findClear(pt[0],pt[1],1.2,30);pt[0]=at[0];pt[1]=at[1];
  const {g,m}=mkBadge(i,pt);
  W.addThing({kind:'badge',id:'badge_'+i,set:'badges',i,g,m,x:pt[0],z:pt[1],reach:0,label:()=>'',tick(dt,t,d){if(!g.visible)return;m.rotation.y+=dt*1.5;if(d<1.6&&player.y<1.2)collectSet(t);}});
 });
 /* A set with more than five pieces: the same save shape as the built-in sets, n-aware. */
 function collectSet(t){
  if(!t.g.visible)return;t.g.visible=false;const set=T.COLL_SETS[t.set],n=set.n||5;let done=false,cnt=0;
  S.sync(sv=>{sv.sets=sv.sets||{};const a=sv.sets[t.set]=sv.sets[t.set]||[];if(!a.includes(t.i))a.push(t.i);cnt=a.length;if(cnt>=n&&!(sv.setsDone&&sv.setsDone[t.set])){sv.setsDone=sv.setsDone||{};sv.setsDone[t.set]=true;M.payReward(sv,set.reward);done=true;}});
  G.sCoin();G.xp.passAdd(3);M.refreshWallet();Q.questEvt('coll',t.set);
  toast(set.label+' '+cnt+'/'+n+(done?' — set complete! +'+M.rewardLabel(set.reward):''));if(done)G.sGem();
 }
 Q.types.coll=(m,val,prog)=>val===m.set?Math.min(m.goal,prog+1):prog;   // a story mission can ask for a set piece: {type:'coll',set:'badges',goal:3}
 /* The rare toy unicorn, behind the falls where the mist is thickest. Not on the map. */
 const TOY_UNICORN={x:-172,z:-238,r:1.6};P.TOY_UNICORN=TOY_UNICORN;
 {
  const g=new THREE.Group(),c='#f2d9ec',m='#c9a0e8';
  blob(0.22,0.16,0.34,c,0,0.42,0,g);blob(0.10,0.14,0.16,c,0,0.66,0.26,g);blob(0.08,0.08,0.12,c,0,0.78,0.38,g);
  for(const [x,z] of [[-0.1,0.16],[0.1,0.16],[-0.1,-0.16],[0.1,-0.16]])tube(0.035,0.035,0.34,c,x,0.18,z,g);
  const horn=new THREE.Mesh(new THREE.ConeGeometry(0.03,0.16,8),new THREE.MeshStandardMaterial({color:0xffe6a8,emissive:0xffd070,emissiveIntensity:0.6}));horn.position.set(0,0.9,0.42);horn.rotation.x=-0.5;g.add(horn);
  blob(0.05,0.12,0.2,m,0,0.74,0.1,g);blob(0.05,0.05,0.22,m,0,0.42,-0.36,g);
  g.position.set(TOY_UNICORN.x,groundH(TOY_UNICORN.x,TOY_UNICORN.z),TOY_UNICORN.z);g.scale.setScalar(0.9);scene.add(g);
  W.addThing({kind:'toy',id:'unicorn',g,x:TOY_UNICORN.x,z:TOY_UNICORN.z,reach:0,label:()=>'',tick(dt,t,d){if(!g.visible)return;g.rotation.y+=dt*0.8;if(d<TOY_UNICORN.r&&player.y<1.2){g.visible=false;S.sync(s=>{s.toyUnicorn=Date.now();M.payReward(s,{g:10,k:2});});M.refreshWallet();G.sGem();G.xp.addXp3D(50);G.xp.passAdd(40);
   loreCard('🦄 A rare toy unicorn','Tucked in a dry crevice behind the falls: a little cloth unicorn, mane stitched from purple wool, one bead eye. On its belly, in faded ink: <b>for the one who looked</b>.','<div style="font-size:12px;color:#8c7a63">+10💎 +2🗝️ +50 XP</div>');toast('🦄 You found Grandma\'s toy unicorn! +10💎 +2🗝️');}}});
  P.toyMesh=g;
 }
 /* Restore what an older session already found. */
 function restoreFound(){const s=S.fresh();if(!s)return;for(const t of W.things){if(t.kind==='bottle'&&s.bottles&&s.bottles.includes(t.id))t.g.visible=false;if(t.kind==='badge'&&s.sets&&s.sets.badges&&s.sets.badges.includes(t.i))t.g.visible=false;if(t.kind==='toy'&&s.toyUnicorn)t.g.visible=false;}}
 restoreFound();
 /* Region hint for a point: which named zone (not the catch-all) it lies in. */
 const regionOf=(x,z)=>{const rg=T.REGIONS.find(r=>r.r<999&&hyp(x,z,r.x,r.z)<r.r);return rg?rg.name:'🌾 the meadows';};
 function perRegion(pts,have){const by={};pts.forEach((pt,i)=>{const k=regionOf(pt[0],pt[1]);by[k]=by[k]||{n:0,got:0};by[k].n++;if(have(i))by[k].got++;});return Object.keys(by).map(k=>k.split(' ').slice(1).join(' ')+' '+by[k].got+'/'+by[k].n).join(' · ');}
 /* The Collection tab now holds every family in one place, with the counts by region. */
 UI.questTab({id:'coll',label:'🗺️ Collection',render(s){
  const shoeToday=(s.shoes&&s.shoes.date===new Date().toDateString())?s.shoes.got.length:0, shoes=(s.stats&&s.stats.shoesFound)||0;
  const bottles=(s.bottles||[]).length, fishB=(s.fish&&s.fish.bottles)||0;
  const row=(ico,title,pct,right,sub)=>'<div class="qrow'+(pct>=100?' claimed':'')+'"><span class="qico">'+ico+'</span><span class="qmain"><b>'+title+'</b>'+(sub?'<span style="font-size:11px;color:#8c7a63;font-weight:600">'+sub+'</span>':'')+'<span class="qbar"><span class="qfill" style="width:'+Math.min(100,pct)+'%"></span></span></span><span style="font-size:11px;color:#8c7a63">'+right+'</span></div>';
  let html='<span style="font-size:12px;color:#8c7a63">Open the map (M) — chests, collectibles, bottles, venues, balloons and the ferry are all marked. Four families, one per region, plus the treasure chests.</span>';
  html+=row('🍀','Golden horseshoes',shoeToday*10,shoeToday+'/10 today · '+shoes+' ever','Ten new hiding spots every day, +80🪙 each and +6💎 for the set');
  html+=row('🍾','Messages in a bottle',bottles/BOTTLES.length*100,bottles+'/'+BOTTLES.length+((s.setsDone&&s.setsDone.bottles)?' ✅':' → 5💎 1🗝️'),perRegion(BOTTLES.map(b=>[b.x,b.z]),i=>(s.bottles||[]).includes(BOTTLES[i].id))+(fishB?' · '+fishB+' fished up':''));
  for(const k of Object.keys(T.COLL_SETS)){const set=T.COLL_SETS[k],n=set.n||5,have=(s.sets&&s.sets[k]||[]),done=s.setsDone&&s.setsDone[k];
   html+=row(set.label.split(' ')[0],set.label.slice(set.label.indexOf(' ')+1),have.length/n*100,have.length+'/'+n+(done?' ✅':' → '+M.rewardLabel(set.reward)),perRegion(set.pts,i=>have.includes(i)));}
  html+=row('🦄','A rare toy unicorn',s.toyUnicorn?100:0,s.toyUnicorn?'found ✅':'?/1',s.toyUnicorn?'Grandma\'s, from behind the falls':'One of a kind, hidden somewhere the mist is thickest. Read the bottles.');
  const opened=T.CHESTS.filter(c=>s.chests&&s.chests[c.id]).length;
  html+=row('🎁','Treasure chests',opened/T.CHESTS.length*100,opened+'/'+T.CHESTS.length+' found · refill in 3 days','');
  const fish=s.fish||{n:0,bottles:0};
  html+='<div class="qrow"><span class="qico">🎣</span><span class="qmain"><b>Loon Lake</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+fish.n+' fish caught</span></span></div>';
  html+='<div class="qrow"><span class="qico">🔐</span><span class="qmain"><b>Grandma\'s tack room</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+((s.doors&&s.doors.tackroom)===G.time.weekKey()?'opened this week':'a Silver Key opens it: rare tack at least, once a week')+'</span></span></div>';
  const sanct=Object.keys(s.sanctuary||{}).reduce((a,k)=>a+(s.sanctuary[k]||[]).length,0);
  html+='<div class="qrow"><span class="qico">🏕️</span><span class="qmain"><b>Sanctuaries</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+sanct+' horse'+(sanct===1?'':'s')+' released · '+((s.stats&&s.stats.tamedWild)||0)+' wild horses tamed</span></span></div>';
  const locked=T.REGIONS.filter(r=>r.unlock&&!regionUnlocked(r,s));
  html+='<div class="qrow"><span class="qico">🗺️</span><span class="qmain"><b>Regions</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+(locked.length?locked.map(r=>'🔒 '+r.name.slice(r.name.indexOf(' ')+1)+' — '+r.unlock.text).join('<br>'):'every region of Kestrel Basin is open to you')+'</span></span></div>';
  return html;
 }});
 Q.addAch({id:'badges8',icon:'⭐',label:'Deputy',desc:'Find all 8 sheriff badges',v:s=>((s.sets&&s.sets.badges)||[]).length,goal:8,r:{c:400,g:2}});
 Q.addAch({id:'bottles8',icon:'🍾',label:'Beachcomber',desc:'Read every message in a bottle',v:s=>(s.bottles||[]).length,goal:8,r:{c:400,g:2}});
 Q.addAch({id:'toyuni',icon:'🦄',label:'A rare find',desc:'Find the toy unicorn',v:s=>s.toyUnicorn?1:0,goal:1,r:{c:300,g:3}});
 Q.addAch({id:'regions4',icon:'🗺️',label:'Basin explorer',desc:'Unlock every region',v:s=>T.REGIONS.filter(r=>r.unlock&&regionUnlocked(r,s)).length,goal:T.REGIONS.filter(r=>r.unlock).length,r:{c:500,g:2,k:1}});
 Q.addAch({id:'balloon3',icon:'🎈',label:'Head in the clouds',desc:'Take 3 balloon rides',v:s=>(s.stats&&s.stats.balloons)||0,goal:3,r:{c:250,g:1}});
 Q.addAch({id:'ferry3',icon:'⛵',label:'Ferry regular',desc:'Cross on the ferry 3 times',v:s=>(s.stats&&s.stats.ferry)||0,goal:3,r:{c:200,g:1}});
 Q.addAch({id:'wild5',icon:'🐎',label:'Horse whisperer',desc:'Tame 5 wild horses from the herds',v:s=>(s.stats&&s.stats.tamedWild)||0,goal:5,r:{c:600,g:3}});
 Q.addAch({id:'sanct3',icon:'🏕️',label:'Sanctuary keeper',desc:'Release 3 horses to a sanctuary',v:s=>(s.stats&&s.stats.released)||0,goal:3,r:{c:400,g:2,k:1}});
 Q.addAch({id:'coop1',icon:'👥',label:'Better together',desc:'Tame a wild horse with a friend',v:s=>(s.stats&&s.stats.coopTames)||0,goal:1,r:{c:500,g:3},social:true});
 Q.addDaily({type:'bottle',icon:'🍾',label:'Find a message in a bottle',goal:1,r:{c:100,p:15}});
 Q.addDaily({type:'balloon',icon:'🎈',label:'Ride a hot-air balloon',goal:1,r:{c:90,p:15}});
 Q.addDaily({type:'walkwild',icon:'🐎',label:'Walk a wild horse 50 m',goal:50,r:{c:120,p:20}});

 /* ================= 4. the world map: markers for everything ================= */
 const MK=W.mapMarkers;
 for(const rg of T.REGIONS){   // every region labelled, locks drawn as a padlock with the rule
  if(rg.r>=999)continue;
  if(!['ranch','cottonwood','barleyfold','coyote','hollowpeak','riverside'].includes(rg.id)){const LBL={pasture:['🐴 Home Pasture',18],pines:['🌲 Pines',14],falls:['💦 The Falls',-16],lake:['🌊 Loon Lake',14],meadows:['',0]}[rg.id]||[rg.name,-4];   // placed clear of the built-in town labels
   if(LBL[0])MK.push({x:rg.x,z:rg.z,glyph:' ',label:LBL[0],labelDz:LBL[1],kind:'region'});}
  if(rg.unlock)MK.push({x:rg.x,z:rg.z-16,glyph:'🔒',kind:'lock',hidden:s=>regionUnlocked(rg,s)});
 }
 /* A forage spot comes in two shapes: a scatter box [cx,cz,rMin,rMax,n], and a list of exact
    points ({at:[[x,z]…],count,jitter}) for the things that hang on a particular tree or hive.
    Reading box fields off the second shape gave NaN, so the apple, honey, corn and royal-jelly
    pins have been sitting at no coordinate at all — four map markers a player could never see or
    steer by. Average the points instead. And skip an item whose own package has already named the
    patch, or the map carries the same fruit twice a few metres apart. */
 for(const item in W.FORAGE_SPOTS){
  if(MK.some(m=>m.kind==='forage'&&m.item===item))continue;
  const b=W.FORAGE_SPOTS[item],f=T.FOODS3[item],at=!Array.isArray(b)&&b.at||null;
  const x=at?at.reduce((t,p)=>t+p[0],0)/at.length:b[0]+(b[2]+b[3])/2*0.5;
  const z=at?at.reduce((t,p)=>t+p[1],0)/at.length:b[1]-(b[2]+b[3])/2*0.5;
  MK.push({x,z,glyph:(f&&f.emoji)||'🌿',alpha:0.8,kind:'forage',item});
 }
 for(const ev of T.EVENTS3){const at=ev.at||(ev.race&&T.RACE_ROUTES[ev.route]&&T.RACE_ROUTES[ev.route][0])||(ev.dressage?[2,1]:null);if(at)MK.push({x:at[0]+(ev.race?0:4),z:at[1]+(ev.race?-4:0),glyph:ev.race?'🏁':'🏆',kind:'venue',ev:ev.id,alpha:0.9});}
 for(const d of Q.NPC_DEFS){if(d.folk)continue;MK.push({x:d.x,z:d.z+6,glyph:d.icon||'💬',kind:'npc',npc:d.id});}
 for(const f of T.FT)MK.push({x:f[1],z:f[2]-7,glyph:'🧭',alpha:0.85,kind:'ft'});
 for(const b of BOTTLES)MK.push({x:b.x,z:b.z,glyph:'🍾',kind:'bottle',hidden:s=>(s.bottles||[]).includes(b.id)});
 for(const l of P.LANDMARKS)if(l.glyph)MK.push({x:l.x,z:l.z,glyph:l.glyph,kind:'landmark',id:l.id});
 P.markerKinds=()=>MK.reduce((a,m)=>{a[m.kind||'other']=(a[m.kind||'other']||0)+1;return a;},{});
 /* Clicking a fast-travel pin on the map travels there (locks honoured); the click is stopped
    before the wrapper's own toggle sees it. */
 {const cv=$('bigmap');if(cv)cv.addEventListener('click',e=>{const r=cv.getBoundingClientRect(),sx=560/r.width,S2=560/700;const mx=(e.clientX-r.left)*sx,my=(e.clientY-r.top)*sx;let best=null,bd=13;
  T.FT.forEach((f,i)=>{const px=280+f[1]*S2,pz=280+(f[2]-7)*S2;const d=Math.hypot(px-mx,pz-my);if(d<bd){bd=d;best=i;}});
  if(best==null)return;e.stopImmediatePropagation();e.preventDefault();const btn=document.querySelector('#ftBar [data-ft="'+best+'"]');if(btn)btn.click();},true);}

 /* ================= 5. balloons and the ferry: one vehicle, one freeze guard ================= */
 const BALLOON_STATIONS=[
  {id:'cottonwood',region:'cottonwood',x:72,z:-72,label:'🎈 Cottonwood balloon field',stripe:['#e0553a','#f4e2c0']},
  {id:'coyote',region:'coyote',x:-176,z:138,label:'🎈 Canyon balloon field',stripe:['#e8a13a','#3a6a9a']},
  {id:'hollowpeak',region:'hollowpeak',x:-116,z:-196,label:'🎈 Hollowpeak balloon field',stripe:['#7fb2e0','#f4f4f4']},
 ];
 P.BALLOON_STATIONS=BALLOON_STATIONS;
 function stripeTex(a,b){const c=document.createElement('canvas');c.width=64;c.height=8;const x=c.getContext('2d');for(let i=0;i<8;i++){x.fillStyle=i%2?a:b;x.fillRect(i*8,0,8,8);}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1);return t;}
 function mkBalloon(st){
  const g=new THREE.Group();
  const env=new THREE.Mesh(new THREE.SphereGeometry(2.8,18,14),new THREE.MeshStandardMaterial({map:stripeTex(st.stripe[0],st.stripe[1]),roughness:0.6}));env.scale.set(1,1.18,1);env.position.y=7.2;env.castShadow=true;g.add(env);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(2.0,2.2,16,1,true),new THREE.MeshStandardMaterial({color:st.stripe[0],roughness:0.7,side:THREE.DoubleSide}));cone.rotation.x=Math.PI;cone.position.y=3.6;g.add(cone);
  const basket=box(3.2,1.3,3.2,'#a8804a',0,0.65,0,g);basket.castShadow=true;box(3.3,0.12,3.3,'#7a5a30',0,1.3,0,g);
  for(const [x,z] of [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]]){const rp=tube(0.03,0.03,2.6,'#5a4630',x*0.9,2.4,z*0.9,g);rp.rotation.z=-x*0.22;rp.rotation.x=z*0.22;}
  const burner=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,6),new THREE.MeshStandardMaterial({color:0xffb040,emissive:0xff7a10,emissiveIntensity:1.2}));burner.position.y=2.5;g.add(burner);
  /* Off every doorstep already standing, not just off the colliders. The auction house and the
     Cottonwood field are both found room for round the same corner of town, and in an unlucky
     boot the field came down on the auction-house doorstep; the prompt is whichever thing in
     reach is nearest, so E at the door took off in a balloon. If nowhere within fifty metres
     is clear of every prompt, clear of the colliders is still better than the bare centre. */
  const offSteps=(x,z)=>W.things.every(t=>t.x==null||hyp(x,z,t.x,t.z)>(t.reach||3.2)+5.5);
  let at=findClear(st.x,st.z,4.5,50,offSteps);
  if(!offSteps(at[0],at[1])||!clear(at[0],at[1],4.5))at=findClear(st.x,st.z,4.5,50);
  st.x=at[0];st.z=at[1];
  g.position.set(st.x,groundH(st.x,st.z),st.z);scene.add(g);W.followCamera.register(g);
  labelAt(g,st.label,11.5);
  return {g,burner};
 }
 for(const st of BALLOON_STATIONS){
  const {g,burner}=mkBalloon(st);st.g=g;st.burner=burner;st.home={x:st.x,z:st.z};
  W.addThing({kind:'balloon',id:st.id,x:st.x,z:st.z,g:null,reach:5.5,label:()=>P.veh?'🎈 …':'🎈 Ride the balloon (E) — 45 s over the valley',use:()=>boardBalloon(st)});
  W.colliders.push({x:st.x,z:st.z,r:2.2});
 }
 function boardBalloon(st){
  if(P.veh)return;
  if(G.course.get()){toast('🏁 Finish the course first!');return;}
  const s=S.fresh()||{};
  const others=BALLOON_STATIONS.filter(o=>o!==st&&regionUnlocked(regionById(o.region),s));
  const to=others.length?others[Math.floor(Math.random()*others.length)]:null;
  const from={x:st.x,z:st.z};
  P.veh={kind:'balloon',st,from,to:to?{x:to.x,z:to.z,st:to}:null,t:0,dur:45,alt:0,g:st.g,burner:st.burner,heading:player.heading,loop:!to};
  player.speed=0;player.y=0;player.vy=0;
  toast(to?'🎈 Up we go — landing at '+to.label.slice(2)+' in 45 s. Enjoy the view!':'🎈 Up we go — a lap over the valley and back down. Enjoy the view!');
  G.sChime();
 }
 /* Where a balloon is after u∈[0,1] of its ride: straight across with a lazy sway, up over the
    first fifth, down over the last, cruising at 30 m. A loop ride flies a circle instead. */
 function balloonPos(v,u){
  const lift=u<0.2?u/0.2:u>0.8?(1-u)/0.2:1;const alt=Math.sin(lift*Math.PI/2)*30;
  let x,z;
  if(v.loop){const a=u*Math.PI*2;x=v.from.x+Math.sin(a)*70;z=v.from.z+(1-Math.cos(a))*70;}
  else{x=v.from.x+(v.to.x-v.from.x)*u+Math.sin(u*Math.PI*3)*6;z=v.from.z+(v.to.z-v.from.z)*u+Math.cos(u*Math.PI*2.5)*4;}
  return {x,z,alt};
 }
 /* The ferry: Otter Ford, downstream to the far bank and back. */
 const FERRY={docks:[{id:'ford',x:16,label:'⛵ Otter Ford ferry'},{id:'farbank',x:134,label:'⛵ Far bank ferry'}],speed:4.2,pts:[]};
 for(let x=16;x<=134;x+=6)FERRY.pts.push([x,riverZ(x)]);
 for(const d of FERRY.docks){d.z=riverZ(d.x);const side=groundH(d.x,d.z+9)>groundH(d.x,d.z-9)?1:-1;d.bz=d.z+side*8;d.side=side;}
 P.FERRY=FERRY;
 {
  const g=new THREE.Group();
  const hull=box(4.8,0.55,2.1,'#6b4a2a',0,0.28,0,g);hull.castShadow=true;box(5.0,0.14,2.3,'#8a6a45',0,0.6,0,g);
  box(4.6,0.5,0.14,'#5a3a1a',0,0.85,1.0,g);box(4.6,0.5,0.14,'#5a3a1a',0,0.85,-1.0,g);box(0.14,0.5,2.1,'#5a3a1a',2.35,0.85,0,g);box(0.14,0.5,2.1,'#5a3a1a',-2.35,0.85,0,g);
  box(0.8,0.1,1.6,'#a8804a',-1.7,0.95,0,g);tube(0.04,0.04,3.2,'#3a2a1a',2.0,1.9,0.8,g);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6),new THREE.MeshStandardMaterial({color:0xffd080,emissive:0xffb040,emissiveIntensity:1.0}));lamp.position.set(2.0,3.4,0.8);g.add(lamp);
  const d0=FERRY.docks[0];g.position.set(d0.x,riverLevel(d0.x)+0.3,d0.z);scene.add(g);FERRY.g=g;FERRY.at=0;
  for(const d of FERRY.docks){const dg=new THREE.Group();for(let k=0;k<3;k++){post(-1.2,k*2.6-2.6,dg,1.4,'#5a3a1a');post(1.2,k*2.6-2.6,dg,1.4,'#5a3a1a');}box(2.8,0.12,8.4,'#8a6a45',0,1.35,0,dg);
   const bx=d.x,bz=d.z+d.side*4.6;dg.position.set(bx,riverLevel(bx)+0.05,bz);scene.add(dg);labelAt(dg,d.label,3.4);
   W.addThing({kind:'ferry',id:d.id,x:d.x,z:d.bz,g:null,reach:9,label:()=>P.veh?'⛵ …':(FERRY.at===FERRY.docks.indexOf(d)?'⛵ Take the ferry (E) — across the river':'⛵ The ferry is at the other dock — wait for it (E)'),use:()=>boardFerry(d)});}
 }
 function boardFerry(d){
  if(P.veh)return;if(G.course.get()){toast('🏁 Finish the course first!');return;}
  const i=FERRY.docks.indexOf(d);
  if(FERRY.at!==i){FERRY.at=i;toast('⛵ The ferryman poles back over for you…');const dk=FERRY.docks[i];FERRY.g.position.set(dk.x,riverLevel(dk.x)+0.3,dk.z);return;}
  const pts=i===0?FERRY.pts.slice():FERRY.pts.slice().reverse();let len=0;for(let k=1;k<pts.length;k++)len+=Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]);
  P.veh={kind:'boat',pts,len,t:0,dur:len/FERRY.speed,g:FERRY.g,to:1-i,heading:player.heading};
  player.speed=0;player.y=0;player.vy=0;
  toast('⛵ Casting off — '+Math.round(len/FERRY.speed)+' s down the river.');G.sChime();
 }
 function boatPos(pts,len,u){let d=u*len;for(let k=1;k<pts.length;k++){const seg=Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]);if(d<=seg||k===pts.length-1){const f=seg>0?Math.max(0,Math.min(1,d/seg)):0;const x=pts[k-1][0]+(pts[k][0]-pts[k-1][0])*f,z=pts[k-1][1]+(pts[k][1]-pts[k-1][1])*f;return {x,z,heading:Math.atan2(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1])};}d-=seg;}return {x:pts[0][0],z:pts[0][1],heading:0};}
 /* The freeze guard: aboard, the reins do nothing and the mount sits where the vehicle puts it. */
 G.on('ride',R=>{if(!P.veh)return;R.target=0;R.noJump=true;player.speed=0;});
 function tickVehicle(dt){
  const v=P.veh;if(!v)return;
  v.t+=dt;const u=Math.min(1,v.t/v.dur);
  let x,z,y,heading;
  if(v.kind==='balloon'){const p=balloonPos(v,u);x=p.x;z=p.z;const gy=groundH(x,z);y=gy+p.alt;v.alt=p.alt;heading=v.heading;
   v.g.position.set(x,y,z);v.g.rotation.y+=dt*0.05;v.burner.material.emissiveIntensity=0.6+Math.random()*0.9;
   player.pos.set(x,0,z);player.mesh.position.set(x,y+1.3,z);player.mesh.rotation.y=heading;player.mesh.rotation.x=0;}
  else{const p=boatPos(v.pts,v.len,u);x=p.x;z=p.z;y=riverLevel(x)+0.3+Math.sin(v.t*1.7)*0.04;heading=p.heading;v.g.position.set(x,y,z);v.g.rotation.y=heading;v.g.rotation.z=Math.sin(v.t*1.3)*0.02;
   player.pos.set(x,0,z);player.mesh.position.set(x,y+0.6,z);player.mesh.rotation.y=heading+Math.PI/2;player.mesh.rotation.x=0;}
  v.x=x;v.z=z;v.y=y;v.h=heading;
  if(u>=1)landVehicle(v);
 }
 function landVehicle(v){
  P.veh=null;
  if(v.kind==='balloon'){
   const to=v.to?v.to.st:v.st;
   v.g.position.set(v.st.home.x,groundH(v.st.home.x,v.st.home.z),v.st.home.z);   // the balloon we rode drifts home; we step out at the landing field
   player.pos.set(to.x+4.5,0,to.z+2);player.heading=Math.PI;
   S.sync(s=>{s.stats=s.stats||{};s.stats.balloons=(s.stats.balloons||0)+1;});
   Q.dailyEvt('balloon',1);if(v.to)Q.dailyEvt('ft',1);G.xp.passAdd(10);
   toast('🎈 Touched down at '+to.label.slice(2)+'. What a view!');
  }else{
   const dk=FERRY.docks[v.to];FERRY.at=v.to;
   player.pos.set(dk.x,0,dk.bz);player.heading=dk.side>0?0:Math.PI;
   S.sync(s=>{s.stats=s.stats||{};s.stats.ferry=(s.stats.ferry||0)+1;});
   Q.dailyEvt('ft',1);G.xp.passAdd(8);
   toast('⛵ Ashore at the '+dk.label.slice(2)+'.');
  }
  player.mesh.rotation.x=0;player.speed=0;G.sChime();
 }
 /* Aboard, the camera hangs back and a little above whatever we are riding. */
 G.on('camera',c=>{
  const v=P.veh;if(!v||v.x==null)return false;
  const back=v.kind==='balloon'?14:9,up=v.kind==='balloon'?5:3.2;
  const dx=Math.sin(v.h),dz=Math.cos(v.h);
  const dx2=v.kind==='boat'?-dz:dx,dz2=v.kind==='boat'?dx:dz;   // beside the boat, behind the basket
  const px=v.x-dx2*back,pz=v.z-dz2*back;
  const py=Math.max(v.y+up,groundH(px,pz)+2.2);
  const des=new THREE.Vector3(px,py,pz);
  G.camera.position.lerp(des,1-Math.exp(-3*c.dt));
  c.camLook.lerp(new THREE.Vector3(v.x,v.y+1.6,v.z),1-Math.exp(-6*c.dt));
  G.camera.lookAt(c.camLook);
  return true;
 });
 for(const st of BALLOON_STATIONS)MK.push({x:st.x,z:st.z,glyph:'🎈',kind:'balloon'});
 for(const d of FERRY.docks)MK.push({x:d.x,z:d.bz,glyph:'⛵',kind:'ferry'});

 /* ================= 6. the follower AI: steer() with whiskers and push-out ================= */
 /* One steering routine for everything that follows something: turn toward the target, probe
    a whisker two metres ahead against the colliders and the fence walls, turn away from what
    it finds, integrate, then push out of anything it is inside. The foal, the pet and a wild
    horse that has decided to follow all go through it. */
 function segDist(px,pz,w){const dx=w.x2-w.x1,dz=w.z2-w.z1,l2=dx*dx+dz*dz;let t=l2>0?((px-w.x1)*dx+(pz-w.z1)*dz)/l2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(w.x1+dx*t),pz-(w.z1+dz*t));}
 function blocked(x,z,pad){for(const c of W.colliders){if(hyp(x,z,c.x,c.z)<c.r+pad)return c;}for(const w of W.walls){if(segDist(x,z,w)<pad)return w;}return null;}
 function pushOut(a,pad){
  for(const c of W.colliders){const ox=a.pos.x-c.x,oz=a.pos.z-c.z,d=Math.hypot(ox,oz),rad=c.r+pad;if(d<rad){if(d<0.02){a.pos.x=c.x+rad;}else{a.pos.x=c.x+ox/d*rad;a.pos.z=c.z+oz/d*rad;}}}
  for(const w of W.walls){const dx=w.x2-w.x1,dz=w.z2-w.z1,l2=dx*dx+dz*dz;let t=l2>0?((a.pos.x-w.x1)*dx+(a.pos.z-w.z1)*dz)/l2:0;t=Math.max(0,Math.min(1,t));const qx=w.x1+dx*t,qz=w.z1+dz*t;const d=Math.hypot(a.pos.x-qx,a.pos.z-qz);if(d<pad&&d>0.001){a.pos.x=qx+(a.pos.x-qx)/d*pad;a.pos.z=qz+(a.pos.z-qz)/d*pad;}}
 }
 /* Nudge a heading away from whatever the whisker touches; returns the adjusted heading. */
 function avoid(a,heading,look){
  const fx=a.pos.x+Math.sin(heading)*(look||2.2),fz=a.pos.z+Math.cos(heading)*(look||2.2);
  const hit=blocked(fx,fz,0.6);if(!hit)return heading;
  const cx=hit.r!=null?hit.x:(hit.x1+hit.x2)/2,cz=hit.r!=null?hit.z:(hit.z1+hit.z2)/2;
  const side=Math.sign(Math.sin(heading)*(cz-a.pos.z)-Math.cos(heading)*(cx-a.pos.x))||1;   // which side the obstacle sits on
  return heading+side*0.6;
 }
 function steer(a,tx,tz,dt,maxSp,opts){
  opts=opts||{};const dx=tx-a.pos.x,dz=tz-a.pos.z,d=Math.hypot(dx,dz);
  if(d<(opts.stop||0.5))return 0;
  let want=Math.atan2(dx,dz);want=avoid(a,want);
  a.heading+=wrap(want-a.heading)*Math.min(1,dt*(opts.turn||3));
  const sp=Math.min(maxSp,(opts.base||1.2)+d*(opts.gain||0.55));
  a.pos.x+=Math.sin(a.heading)*sp*dt;a.pos.z+=Math.cos(a.heading)*sp*dt;
  pushOut(a,opts.pad||0.5);
  return sp;
 }
 W.steer=steer;W.pushOut=pushOut;W.avoid=avoid;P.steer=steer;
 /* Nothing that follows you is allowed to stand in the lens. The built-in loop parks a
    companion 2.5 m from the rider on whichever side it happens to have arrived from, and that
    is very often the side the camera is on: a horse three metres off the near plane is a wall
    across a third of the frame, and you cannot see the horse you are actually riding. Push it
    out of a cylinder round the camera at a couple of metres a second, so it reads as the foal
    stepping aside rather than as a teleport. */
 function clearOfCamera(a,dt,r){
  const cx=G.camera.position.x,cz=G.camera.position.z;
  const dx=a.pos.x-cx,dz=a.pos.z-cz,d=Math.hypot(dx,dz);
  if(d>=r)return false;
  if(d<0.05){a.pos.x+=Math.min(r,dt*2.5);return true;}   // dead on the lens: any direction will do
  const push=Math.min(r-d,dt*2.5);a.pos.x+=dx/d*push;a.pos.z+=dz/d*push;return true;
 }
 /* The companion foal (or any horse you take along) and the pet: the built-in loops integrate
    them straight at their targets; this pass runs right after and keeps them out of the barn
    and out of the camera. */
 function tickFollowers(dt){
  if(P.companionEntry&&P.companionEntry.idx!=null){const a=P.companionEntry;if(H.myHorses[a.idx]&&H.myHorses[a.idx].id===P.companionId){const h0=a.heading;a.heading=avoid(a,a.heading,2.4);if(a.heading!==h0){a.pos.x+=Math.sin(a.heading)*dt*1.5;a.pos.z+=Math.cos(a.heading)*dt*1.5;}pushOut(a,0.55);clearOfCamera(a,dt,4.2);a.parts.group.position.set(a.pos.x,groundH(a.pos.x,a.pos.z),a.pos.z);a.parts.group.rotation.y=a.heading;}}
  const pet=G.petComp&&G.petComp();if(pet&&pet.pos){const before=pet.pos.x+':'+pet.pos.z;pushOut(pet,0.4);clearOfCamera(pet,dt,2.4);if(before!==pet.pos.x+':'+pet.pos.z)pet.parts.group.position.set(pet.pos.x,groundH(pet.pos.x,pet.pos.z),pet.pos.z);}
 }
 P.companionEntry=null;
 const findCompanion=()=>{const cid=(S.fresh()||{}).companion;P.companionEntry=null;P.companionId=cid;if(cid==null)return;for(const a of H.herd()){const hh=H.myHorses[a.idx];if(hh&&hh.id===cid){P.companionEntry=a;break;}}};
 G.on('rebuild',()=>setTimeout(findCompanion,0));
 /* Any horse out in the pasture can be taken along, not only a foal. */
 UI.stableRow((h,i)=>{if(h.foal||i===H.rideIdx())return '';const s=S.fresh()||{};const on=s.companion===h.id;if(!h.out&&!on)return '<span style="font-size:11px;color:#8c7a63" title="Turn it out to pasture to take it along">🐎 turn out to take along</span>';return '<button data-st="eq:'+i+'" '+(on?'class="claimBtn"':'')+' title="Walks along behind you on the trails">'+(on?'🐎 Following ✓':'🐎 Take along')+'</button>';});

 /* ================= 7. wild herds, taming, co-op, the trust HUD ================= */
 /* Region coats: the canyon's dun and grulla, the mountain's fjord — wild only, and only there. */
 T.WILD_BREEDS.push(
  {breed:'appaloosa',variant:'Canyon Dun',body:'#c8a06a',mane:'#4a3220',base:5,region:'coyote'},
  {breed:'black',variant:'Mesa Grulla',body:'#6f6a66',mane:'#2a2624',base:5,region:'coyote'},
  {breed:'fjord',variant:'Snowline Fjord',body:'#d9cbb0',mane:'#f4efe4',base:5,region:'hollowpeak'},
 );
 const WILD_HERDS=[
  {id:'pines',region:'pines',x:-48,z:-84,r:20,n:3,label:'Pines herd'},
  {id:'meadow',region:'meadows',x:118,z:52,r:24,n:4,label:'River meadow herd'},
  {id:'coyote',region:'coyote',x:-246,z:150,r:26,n:4,exclusive:true,coop:true,label:'Canyon herd'},
  {id:'hollowpeak',region:'hollowpeak',x:-128,z:-222,r:22,n:3,exclusive:true,coop:true,label:'Snowfield herd'},
 ];
 P.WILD_HERDS=WILD_HERDS;P.herds=[];
 const NAMES=['Comet','Misty','River','Blaze','Willow','Storm','Maple','Echo','Sage','Juniper','Ember','Sorrel','Dune','Frost','Reed'];
 function pickWb(herd){const pool=T.WILD_BREEDS.filter(w=>!w.region||w.region===herd.region);const ex=pool.filter(w=>w.region===herd.region);const src=(herd.exclusive&&ex.length&&Math.random()<0.6)?ex:pool;return src[Math.floor(Math.random()*src.length)];}
 function spawnMember(herd,i){
  const wb=pickWb(herd);const a=Math.random()*Math.PI*2,r=Math.random()*herd.r*0.7;
  let x=herd.x+Math.cos(a)*r,z=herd.z+Math.sin(a)*r;const at=findClear(x,z,1.5,herd.r);x=at[0];z=at[1];
  const parts=H.makeHorse({colors:{body:wb.body,mane:wb.mane},seed:Math.floor(Math.random()*9),breed:wb.breed});
  const tag=plate('✨ wild'+(wb.variant?' · '+wb.variant:''));tag.position.y=2.7;parts.group.add(tag);   // "✨ wild · Snowline Fjord" is 24 characters and the built-in plate ate the last two
  parts.group.position.set(x,groundH(x,z),z);scene.add(parts.group);
  const m={herd,i,wb,parts,tag,pos:new THREE.Vector3(x,0,z),heading:Math.random()*6,tx:x,tz:z,rest:rnd(1,4),phase:Math.random()*6,flee:0,trust:0,follow:false,remote:{},walked:0,name:NAMES[Math.floor(Math.random()*NAMES.length)],lastPub:0,coop:!!herd.coop,shown:false};
  m.thing=W.addThing({kind:'wild',id:herd.id+':'+i,x,z,g:null,reach:3.2,member:m,
   label:()=>m.flee>0?'':(m.follow?'🐎 '+m.name+' is following you · trust '+Math.round(effTrust(m))+'%':'🥕 Offer '+m.name+' a carrot (E) · trust '+Math.round(effTrust(m))+'%'),
   use:()=>offerCarrot(m),tick:(dt,t)=>{t.x=m.pos.x;t.z=m.pos.z;}});
  return m;
 }
 for(const herd of WILD_HERDS){const list=[];for(let i=0;i<herd.n;i++)list.push(spawnMember(herd,i));P.herds.push({def:herd,members:list,respawn:[]});}
 function offerCarrot(m){
  if(m.flee>0){toast('🐎 She is spooked — wait for her to settle.');return;}
  if(Math.abs(player.speed)>0.8){toast('🐎 Halt first, then hold the carrot out.');return;}
  let ok=false;S.sync(s=>{s.items=s.items||{};if((s.items.carrot||0)<1)return;s.items.carrot--;ok=true;});
  if(!ok){toast('🥕 You have no carrots — the general store sells them.');return;}
  m.trust=Math.min(100,m.trust+25);m.rest=3;m.fedT=1.2;G.sChime();
  toast('🥕 '+m.name+' takes the carrot. Trust '+Math.round(effTrust(m))+'%');
  Q.dailyEvt('feed',1);checkTame(m);
 }
 /* Local trust, plus what club mates standing with the horse have built up, each capped at
    60 for a shy herd so it really does take two. */
 function effTrust(m){
  const now=performance.now();let tot=m.coop?Math.min(60,m.trust):m.trust;
  for(const id in m.remote){const r=m.remote[id];if(now-r.at>4000){delete m.remote[id];continue;}tot+=Math.min(60,r.tr);}
  return Math.min(100,tot);
 }
 function helpers(m){const now=performance.now();return Object.values(m.remote).filter(r=>now-r.at<=4000).map(r=>r.n);}
 function checkTame(m){if(effTrust(m)>=100&&!m.taming){m.taming=true;tameMember(m,true);}}
 function removeMember(m){try{scene.remove(m.parts.group);}catch(e){}const H2=P.herds.find(h=>h.def===m.herd);if(H2){H2.members=H2.members.filter(x=>x!==m);H2.respawn.push({at:performance.now()+180000,i:m.i});}const k=W.things.indexOf(m.thing);if(k>=0)W.things.splice(k,1);if(P.trustFocus===m)P.trustFocus=null;}
 function nearestSanctuary(x,z){let best=null,bd=1e9;for(const sc of SANCTUARIES){const d=hyp(x,z,sc.x,sc.z);if(d<bd){bd=d;best=sc;}}return best;}
 /* Tamed. Bring her home, or release her to the nearest sanctuary — both pay, and the herd
    fills the gap again in a few minutes. Helpers are told, and paid, over the club channel. */
 function tameMember(m,finisher){
  const hn=helpers(m);
  removeMember(m);G.sChime();G.sGem();
  if(finisher&&hn.length)N.sendChat('',{wildDone:{h:m.herd.id,i:m.i,by:String(N.myName()).slice(0,14)}});
  const sc=nearestSanctuary(m.pos.x,m.pos.z);
  const d=$('dlg');
  d.innerHTML='<b>🎉 '+m.name+' trusts you!</b><p>The '+(m.wb.variant||m.wb.breed)+' stands quiet at your side'+(hn.length?' — with '+hn.join(', ')+' helping':'')+'.</p>'
   +'<button id="wTameHome" style="margin-right:6px">🏡 Bring her home</button><button id="wTameSanct">🏕️ Release to '+sc.label.slice(sc.label.indexOf(' ')+1)+' (+150🪙 +1💎)</button>';
  d.style.display='block';
  const done=(how)=>{d.style.display='none';
   S.sync(s=>{s.stats=s.stats||{};s.stats.tamedWild=(s.stats.tamedWild||0)+1;if(hn.length)s.stats.coopTames=(s.stats.coopTames||0)+1;s.wildSeen=s.wildSeen||{};s.wildSeen[m.herd.id]=(s.wildSeen[m.herd.id]||0)+1;
    if(how==='home'){const cl=(v,a,b)=>Math.max(a,Math.min(b,v)),ri=(a,b)=>Math.floor(a+Math.random()*(b-a+1)),base=m.wb.base;
     H.grantHorse(s,m.wb.breed,{name:m.name,colors:{body:m.wb.body,mane:m.wb.mane},bond:20,src:'wild',stats:{speed:cl(base+ri(-1,1),1,10),stamina:cl(base+ri(-1,1),1,10),jump:cl(base+ri(-1,1),1,10),accel:cl(base+ri(-1,1),1,10),agility:cl(base+ri(-1,1),1,10)},needs:{hunger:80,thirst:80,clean:60,happy:90},extra:{wild:m.wb.breed,variant:m.wb.variant||null}});
     G.money.grantGems(s,1);}
    else{s.sanctuary=s.sanctuary||{};(s.sanctuary[sc.id]=s.sanctuary[sc.id]||[]).push({breed:m.wb.breed,variant:m.wb.variant||null,body:m.wb.body,mane:m.wb.mane,name:m.name,from:'wild',at:Date.now()});s.stats.released=(s.stats.released||0)+1;M.payReward(s,{c:150,g:1});}
   });
   M.refreshWallet();G.xp.passAdd(40);Q.questEvt('tame',1);Q.dailyEvt('tame',1);
   if(how==='home'){try{H.reloadHorses();}catch(e){}toast('🎉 '+m.name+' joins your ranch! +1💎');}
   else{refreshSanctuary(sc);toast('🏕️ '+m.name+' runs free at the '+sc.label.slice(sc.label.indexOf(' ')+1)+'. +150🪙 +1💎');}
  };
  $('wTameHome').onclick=()=>done('home');$('wTameSanct').onclick=()=>done('sanct');
 }
 /* Club mates: every second, while you are working on a shy horse, say so; a helper's trust
    reaches you the same way. The finisher's wildDone pays everyone who helped. */
 G.on('chat',(m,nm)=>{
  if(m.wild&&typeof m.wild==='object'){const hd=P.herds.find(h=>h.def.id===String(m.wild.h).slice(0,14));const mem=hd&&hd.members.find(x=>x.i===+m.wild.i);if(mem){mem.remote[String(m.id).slice(0,24)]={n:String(nm||'?').slice(0,14),tr:Math.max(0,Math.min(100,+m.wild.tr||0)),at:performance.now()};if(!mem.taming)checkTame(mem);}return true;}
  if(m.wildDone&&typeof m.wildDone==='object'){const hd=P.herds.find(h=>h.def.id===String(m.wildDone.h).slice(0,14));const mem=hd&&hd.members.find(x=>x.i===+m.wildDone.i);if(mem&&mem.trust>0&&!mem.taming){mem.taming=true;removeMember(mem);S.sync(s=>{M.payReward(s,{c:300,g:2});s.stats=s.stats||{};s.stats.coopTames=(s.stats.coopTames||0)+1;});M.refreshWallet();G.xp.passAdd(40);Q.dailyEvt('tame',1);toast('👥 '+String(m.wildDone.by||nm).slice(0,14)+' tamed '+mem.name+' with your help! +300🪙 +2💎');}return true;}
 });
 /* The herd loop. Idle herds cost nothing: a herd more than 260 m off is skipped whole. */
 function tickHerds(dt,t){
  const sp=Math.abs(player.speed),now=performance.now();
  P.trustFocus=null;let focusScore=-1e9;   // the horse you are working on wins over a stranger that wandered closer
  for(const hd of P.herds){
   const far=hyp(player.pos.x,player.pos.z,hd.def.x,hd.def.z);
   if(hd.respawn.length&&hd.respawn[0].at<now){const r=hd.respawn.shift();hd.members.push(spawnMember(hd.def,r.i));}
   if(far>260){for(const m of hd.members)m.parts.group.visible=false;continue;}
   if(!hd.seen&&far<hd.def.r+40){hd.seen=true;S.sync(s=>{s.wildSeen=s.wildSeen||{};s.wildSeen[hd.def.id]=s.wildSeen[hd.def.id]||0;});toast('✨ Wild horses — the '+hd.def.label+'. Walk up slowly, no galloping.');}
   for(const m of hd.members){
    m.parts.group.visible=true;
    const wd=hyp(player.pos.x,player.pos.z,m.pos.x,m.pos.z);
    if(m.fedT>0)m.fedT-=dt;
    const tolerant=m.follow?9:4.5;
    if(wd<14&&sp>tolerant&&!P.veh)m.flee=2.5;
    let gait='walk',amp=0.4,mv=0;
    if(m.flee>0){
     m.flee-=dt;m.follow=false;
     m.heading=Math.atan2(m.pos.x-player.pos.x,m.pos.z-player.pos.z);m.heading=avoid(m,m.heading,3);
     m.pos.x+=Math.sin(m.heading)*7*dt;m.pos.z+=Math.cos(m.heading)*7*dt;pushOut(m,0.5);
     const fd=hyp(m.pos.x,m.pos.z,m.herd.x,m.herd.z);if(fd>m.herd.r*2.2){m.pos.x=m.herd.x+(m.pos.x-m.herd.x)*m.herd.r*2.2/fd;m.pos.z=m.herd.z+(m.pos.z-m.herd.z)*m.herd.r*2.2/fd;}
     m.trust=Math.max(0,m.trust-dt*12);m.phase+=dt*9;gait='gallop';amp=0.9;mv=9;
    }else if(m.follow){
     const bx=player.pos.x-Math.sin(player.heading)*4,bz=player.pos.z-Math.cos(player.heading)*4;
     const px=m.pos.x,pz=m.pos.z;
     mv=steer(m,bx,bz,dt,6.5,{stop:1.6,base:1.2,gain:0.8,turn:3.5});
     if(mv>0){m.walked+=hyp(m.pos.x,m.pos.z,px,pz);if(m.walked>=5){Q.dailyEvt('walkwild',Math.floor(m.walked));m.walked-=Math.floor(m.walked);}}
     if(wd<9&&sp<6.5)m.trust=Math.min(100,m.trust+dt*6);
     if(wd>40){m.follow=false;m.trust=Math.max(0,m.trust-20);toast('🐎 '+m.name+' lost sight of you and turned back.');}
     m.phase+=dt*(mv>3.5?6:3);gait=mv>3.5?'gallop':'walk';amp=mv>3.5?0.72:mv>0.2?0.42:0.05;
    }else{
     m.phase+=dt*(m.rest>0?1.2:4);
     if(m.rest>0)m.rest-=dt;
     else{const dd=hyp(m.tx,m.tz,m.pos.x,m.pos.z);
      if(dd<0.6){m.rest=2+Math.random()*4;const a2=Math.random()*Math.PI*2,rr=Math.random()*m.herd.r;m.tx=m.herd.x+Math.cos(a2)*rr;m.tz=m.herd.z+Math.sin(a2)*rr;}
      else mv=steer(m,m.tx,m.tz,dt,1.1,{stop:0.6,base:1.1,gain:0,turn:2});}
     amp=m.rest>0?0.05:0.4;
     if(wd<5.5&&sp<2){m.trust=Math.min(100,m.trust+dt*9*(m.fedT>0?2:1));m.rest=Math.max(m.rest,0.6);   // she stands for you while you are calm beside her
      if(m.trust>=50&&!m.follow&&!m.coop){m.follow=true;toast('🐎 '+m.name+' trusts you enough to follow — walk her home, slowly.');}
      if(m.trust>=50&&m.coop&&!m.follow&&effTrust(m)>=50){m.follow=true;toast('🐎 '+m.name+' trusts you enough to follow — walk her home, slowly.');}
      checkTame(m);}
    }
    if(m.coop&&wd<8&&m.trust>0&&t-m.lastPub>1&&N.SOCIAL){m.lastPub=t;N.sendChat('',{wild:{h:m.herd.id,i:m.i,tr:Math.round(m.trust),x:+m.pos.x.toFixed(0),z:+m.pos.z.toFixed(0)}});}
    /* draw */
    const A=G.anim;
    if(A){const gt=gait==='gallop'?A.GAITS.gallop:A.GAITS.walk;A.animateHorse(m.parts,m.phase,amp,gt,true,t,m.rest>0&&!m.follow&&m.flee<=0?1:0,dt);
     if(wd<60)H.dressWithRig(m,m.parts,{body:m.wb.body,mane:m.wb.mane},{breed:m.wb.breed});
     A.tickRig(m,mv,dt,t,m.rest>0&&!m.follow&&m.flee<=0?1:0);}
    m.parts.group.position.set(m.pos.x,groundH(m.pos.x,m.pos.z),m.pos.z);m.parts.group.rotation.y=m.heading;
    if(wd<20){const sc=effTrust(m)*10-wd+(m.follow?200:0);if(sc>focusScore){focusScore=sc;P.trustFocus=m;}}
   }
  }
 }
 /* One HUD for every wild horse — the herds and the Silver Kestrel alike: a bar, what she is
    doing, and who is helping. Shown whenever one is within twenty metres. */
 const hud=$('tameHud');
 if(hud)hud.innerHTML='<span id="tameTxt"></span><small id="tameSub"></small><div class="cbar"><div id="tameFill" class="cfill" style="width:0%"></div></div>';
 function tickTrustHud(){
  if(!hud)return;
  if(!$('tameTxt'))hud.innerHTML='<span id="tameTxt"></span><small id="tameSub"></small><div class="cbar"><div id="tameFill" class="cfill" style="width:0%"></div></div>';   // the Kestrel loop writes textContent
  const sp=Math.abs(player.speed);
  let tr=null,txt='',sub='',bad=false;
  const k=G.wild&&G.wild.get&&G.wild.get();
  if(k){const wd=hyp(player.pos.x,player.pos.z,k.pos.x,k.pos.z);if(wd<20){tr=G.wild.trust();bad=k.flee>0;txt=bad?'🐎 Spooked — slow down!':wd<5.5&&sp<2?'🤝 Earning her trust… '+Math.round(tr)+'%':'🐎 Walk closer, gently · trust '+Math.round(tr)+'%';sub=k.wb&&k.wb.kestrel?'the Silver Kestrel':'a wild horse';}}
  const m=P.trustFocus;
  if(tr==null&&m){const wd=hyp(player.pos.x,player.pos.z,m.pos.x,m.pos.z);tr=effTrust(m);bad=m.flee>0;const hn=helpers(m);
   txt=bad?'🐎 Spooked — slow down!':m.follow?'🐎 '+m.name+' is following you — walk her home · '+Math.round(tr)+'%':wd<5.5&&sp<2?'🤝 Earning '+m.name+'\'s trust… '+Math.round(tr)+'%':'🐎 Walk closer, gently · trust '+Math.round(tr)+'%';
   sub=(m.wb.variant||m.wb.breed)+' · '+m.herd.label+(m.coop?' · shy: '+(hn.length?'👥 '+hn.join(', ')+' helping':'needs two riders (each up to 60%)'):'')+(m.trust<50&&!m.follow?' · E with a carrot for +25':'');}
  if(tr==null){hud.style.display='none';return;}
  hud.style.display='block';hud.classList.toggle('bad',bad);
  $('tameTxt').textContent=txt;$('tameSub').textContent=sub;$('tameFill').style.width=Math.round(tr)+'%';
 }
 P.effTrust=effTrust;P.helpers=helpers;
 if(G.wild)G.wild.strays=false;   // the herds replace the single stray; the Kestrel still comes for the story

 /* ================= 8. sanctuaries ================= */
 const SANCTUARIES=[
  {id:'pines',region:'pines',x:-62,z:-90,r:14,label:'🌲 Pines Horse Sanctuary'},
  {id:'coyote',region:'coyote',x:-188,z:98,r:14,label:'🏜️ Coyote Horse Sanctuary'},
 ];
 P.SANCTUARIES=SANCTUARIES;
 for(const sc of SANCTUARIES){
  const at=findClear(sc.x,sc.z,sc.r+3,60);sc.x=at[0];sc.z=at[1];
  const g=new THREE.Group();railRing(g,sc.r,22,-0.25,0.25,'#e2d3ae');
  const sg=sign(sc.label.slice(sc.label.indexOf(' ')+1).toUpperCase(),4.2,0.46);sg.position.set(sc.r+0.4,2.6,-2.6);sg.rotation.y=-Math.PI/2;g.add(sg);post(sc.r+0.4,-4.8,g,2.8,'#8a7a62');post(sc.r+0.4,-0.4,g,2.8,'#8a7a62');
  box(2.2,0.7,0.9,'#8a6a45',0,0.35,-sc.r+2.5,g);box(2.0,0.2,0.7,'#b8a040',0,0.75,-sc.r+2.5,g);   // hay feeder
  const trough=box(1.8,0.5,0.7,'#6b6b6b',-sc.r+3,0.25,3,g);const wat=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.5),new THREE.MeshStandardMaterial({color:0x4f9ad6}));wat.rotation.x=-Math.PI/2;wat.position.set(-sc.r+3,0.48,3);g.add(wat);
  const ring=new THREE.Mesh(new THREE.CircleGeometry(sc.r,30),new THREE.MeshBasicMaterial({color:0x8fd070,transparent:true,opacity:0.12,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=0.05;g.add(ring);
  labelAt(g,sc.label,3.4);
  g.position.set(sc.x,groundH(sc.x,sc.z),sc.z);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);W.followCamera.register(g);
  for(let k=0;k<22;k++){const a=k/22*Math.PI*2;if(a>-0.25&&a<0.25)continue;W.colliders.push({x:sc.x+Math.cos(a)*sc.r,z:sc.z+Math.sin(a)*sc.r,r:0.35});}
  sc.g=g;sc.horses=[];
  W.addThing({kind:'sanctuary',id:sc.id,x:sc.x,z:sc.z,g:null,reach:sc.r+4,label:()=>{const n=((S.fresh()||{}).sanctuary||{})[sc.id]||[];return '🏕️ '+sc.label.slice(sc.label.indexOf(' ')+1)+' — '+n.length+' horse'+(n.length===1?'':'s')+' (E to visit)';},use:()=>openSanctuary(sc)});
  MK.push({x:sc.x,z:sc.z,glyph:'🏕️',kind:'sanctuary'});
  P.LANDMARKS.push({id:'sanctuary:'+sc.id,region:sc.region,x:sc.x,z:sc.z,label:sc.label,glyph:'🏕️',kind:'sanctuary',grp:g});
 }
 /* The rescued horses graze inside the rails: up to six shown, the rest counted. */
 function refreshSanctuary(sc){
  for(const h of sc.horses){try{scene.remove(h.parts.group);}catch(e){}}sc.horses=[];
  const list=((S.fresh()||{}).sanctuary||{})[sc.id]||[];
  list.slice(0,6).forEach((e,k)=>{const a=k/6*Math.PI*2,r=sc.r*0.5;const x=sc.x+Math.cos(a)*r,z=sc.z+Math.sin(a)*r;
   const parts=H.makeHorse({colors:{body:e.body||'#8a5a2b',mane:e.mane||'#332214'},seed:k+3,breed:e.breed||'bay'});const tag=plate('🏕️ '+String(e.name||'Rescue').slice(0,14));tag.position.y=2.7;parts.group.add(tag);parts.group.position.set(x,groundH(x,z),z);parts.group.name='sanctuary-horse';scene.add(parts.group);
   sc.horses.push({parts,pos:new THREE.Vector3(x,0,z),heading:Math.random()*6,tx:x,tz:z,rest:rnd(1,5),phase:Math.random()*6,e});});
 }
 for(const sc of SANCTUARIES)refreshSanctuary(sc);
 P.refreshSanctuary=refreshSanctuary;
 function tickSanctuaries(dt,t){
  for(const sc of SANCTUARIES){
   const far=hyp(player.pos.x,player.pos.z,sc.x,sc.z);if(far>220){for(const h of sc.horses)h.parts.group.visible=false;continue;}
   for(const h of sc.horses){h.parts.group.visible=true;let mv=0;h.phase+=dt*(h.rest>0?1.2:4);
    if(h.rest>0)h.rest-=dt;else{if(hyp(h.tx,h.tz,h.pos.x,h.pos.z)<0.6){h.rest=3+Math.random()*6;const a=Math.random()*Math.PI*2,r=Math.random()*(sc.r-3);h.tx=sc.x+Math.cos(a)*r;h.tz=sc.z+Math.sin(a)*r;}else mv=steer(h,h.tx,h.tz,dt,1.1,{stop:0.6,base:1.1,gain:0,turn:2,pad:0.3});}
    const A=G.anim;if(A){A.animateHorse(h.parts,h.phase,h.rest>0?0.05:0.4,A.GAITS.walk,true,t,h.rest>0?1:0,dt);if(far<50)H.dressWithRig(h,h.parts,{body:h.e.body,mane:h.e.mane},{breed:h.e.breed||'bay'});A.tickRig(h,mv,dt,t,h.rest>0?1:0);}
    h.parts.group.position.set(h.pos.x,groundH(h.pos.x,h.pos.z),h.pos.z);h.parts.group.rotation.y=h.heading;}
  }
 }
 function openSanctuary(sc){
  const s=S.fresh()||{};const list=(s.sanctuary||{})[sc.id]||[];
  const d=$('dlg');
  d.innerHTML='<b>'+sc.label+'</b><p style="font-size:13px">A fenced meadow for horses that came in from the wild or off the roads. They stay free here — and every one you release pays its keep.</p>'
   +(list.length?list.map(e=>'<div class="evrow">🐎 <b>'+e.name+'</b><span>'+(e.variant||G.horse.breedLabel(e.breed))+' · '+(e.from==='wild'?'tamed from the herd':'rescued')+'</span></div>').join(''):'<span style="font-size:12px;color:#8c7a63">No horses here yet. Tame one from a wild herd and choose “Release to sanctuary”.</span>')
   +'<div style="font-size:12px;color:#8c7a63;margin-top:6px">Wild herds graze nearby: walk up slowly, halt, and offer a carrot.</div><button id="dlgBtn" style="margin-top:6px">🐴</button>';
  d.style.display='block';$('dlgBtn').onclick=()=>{d.style.display='none';};
 }

 /* ================= 9. nameplates that earn their place ================= */
 /* Stand in the yard and count them: the barn, the old stall, the tack room, Wren, Marta, the
    quest board, June, every horse in the pasture and every horse that follows you, all wearing
    a floating white plate at once. It reads as a debug view of a world rather than as a place,
    and the moment one of the wearers walks past the camera its plate becomes a billboard. No
    package owns them — a dozen of us hang them — so rather than chase the call sites, find them
    in the scene and fade them by distance. They are easy to find: every plate the game builds
    is a 512x128 canvas on a sprite, which nothing else in here is. */
 function isPlate(o){
  if(!o.isSprite||!o.material)return false;
  if(o.userData&&o.userData.plate)return true;
  const im=o.material.map&&o.material.map.image;
  return !!(im&&im.width===512&&im.height===128);   // the chat bubble is 512x96 and stays out of this: a speech bubble you cannot read is worse than none
 }
 function scanLabels(){
  let n=0;
  scene.traverse(o=>{if(o.userData.wlbl||!isPlate(o))return;o.userData.wlbl=1;
   const k=o.scale.x>PLATE_MAX?PLATE_MAX/o.scale.x:1;
   LABELS.push({sp:o,bx:o.scale.x*k,by:o.scale.y*k,op:o.material.opacity});n++;});
  for(let i=LABELS.length-1;i>=0;i--)if(!LABELS[i].sp.parent)LABELS.splice(i,1);   // a rebuilt barn throws its old plates away
  return n;
 }
 /* Distances in metres from the camera. A wide plate is a name: you want it when you are close
    enough for the name to matter, and never in your face — a building you are looking straight
    at does not need telling you what it is. A narrow one is an arena letter or a jump number,
    which you steer by from the far end of the school, so it keeps its range and only loses the
    near end. Everything eases in and out; a plate that pops is as distracting as the clutter. */
 function labelAlpha(d,wide){
  if(wide)return d<2.6?0:d<5.4?(d-2.6)/2.8:d<18?1:d<30?1-(d-18)/12:0;
  return d<1.5?0:d<3?(d-1.5)/1.5:d<52?1:d<72?1-(d-52)/20:0;
 }
 /* Sprites ignore lighting, so the game dims the ones it made by hand after dark; ours are not
    in its list and would glow like UI at midnight. Same curve, read off the same clock. */
 function dayTint(){try{const u=G.time.dayT(),elev=-12+66*(0.5-0.5*Math.cos(u*Math.PI*2));return 0.30+0.70*clamp(elev/14,0,1);}catch(e){return 1;}}
 let labelScanT=0;
 function tickLabels(dt){
  labelScanT+=dt;if(labelScanT>2){labelScanT=0;scanLabels();}
  const cx=G.camera.position.x,cy=G.camera.position.y,cz=G.camera.position.z,k=Math.min(1,dt*6);
  let tint=-1;
  for(let i=0;i<LABELS.length;i++){
   const L=LABELS[i],sp=L.sp;if(!sp.parent)continue;
   const e=sp.matrixWorld.elements,dx=e[12]-cx,dy=e[13]-cy,dz=e[14]-cz;   // one frame stale, which nobody can see in a fade
   const d=Math.sqrt(dx*dx+dy*dy+dz*dz),wide=L.bx>=1.6;
   L.op+=(labelAlpha(d,wide)-L.op)*k;
   /* Only ever un-hide a plate we hid ourselves. Somebody else's visible=false is a decision —
      the party banner is parked invisible at the origin between parties — and quietly turning
      it back on would hang a "🎉 Party!" sign over an empty yard. */
   if(L.op<0.015){if(sp.visible){sp.visible=false;L.hid=1;}continue;}
   if(!sp.visible){if(!L.hid)continue;sp.visible=true;L.hid=0;}
   sp.material.opacity=L.op;
   const s=wide?clamp(d/12,0.45,1):1;   // and never bigger on screen than it is at twelve metres, whatever it does up close
   sp.scale.set(L.bx*s,L.by*s,1);
   if(sp.userData.plate){if(tint<0)tint=dayTint();sp.material.color.setScalar(tint);}
  }
 }
 /* The people get their names back. addNPC builds the plate inside the game, where the text is
    already cut, but the full name is right there on the def — so repaint it. This is what was
    making Wick the Almanac-Keeper introduce himself as "Wick the Almanac-Ke". */
 function fixNpcTags(){
  let n=0;
  for(const e of (W.npcList||[])){
   const nm=e&&e.def&&e.def.name;if(!nm||!e.g)continue;
   const txt='💬 '+String(nm).replace('Grandpa ','').replace('Farmer ','').replace('Sheriff ','');
   if(txt.length<=22)continue;   // short enough that the game drew it whole
   e.g.traverse(o=>{if(o.isSprite&&isPlate(o)&&!o.userData.plate){redress(o,txt);o.userData.plate=1;n++;}});
  }
  return n;
 }
 P.plate=plate;P.labels=LABELS;P.scanLabels=scanLabels;P.labelAlpha=labelAlpha;

 /* ================= 10. the ambient butterflies ================= */
 /* This is the pink rectangle that floats over the arena. A butterfly here is two bare quads
    standing on edge, and the loop that animates them turns rotation.z — which, for a quad in
    the XY plane, spins it in its own plane instead of flapping it. So what a player actually
    sees is a flat pink card slowly rotating in mid-air, with no body, no shape and no shading:
    it looks exactly like a missing texture. Lay the wings flat so the same rotation becomes a
    flap, cut a wing shape out of them, and give the thing a body. The objects live in
    ranch3d.html and are published there for diagnostics; nothing else touches them. */
 function wingTex(col){
  const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');
  c.fillStyle=col;
  c.beginPath();c.ellipse(27,23,25,20,-0.22,0,Math.PI*2);c.fill();          // fore wing
  c.beginPath();c.ellipse(21,47,18,15,0.18,0,Math.PI*2);c.fill();          // hind wing
  c.globalAlpha=0.4;c.fillStyle='#fff6e8';c.beginPath();c.ellipse(33,17,8,6,-0.2,0,Math.PI*2);c.fill();   // one pale eyespot, so it is not a single flat colour
  c.globalAlpha=0.5;c.fillStyle='#3a3228';c.beginPath();c.ellipse(46,12,5,4,0,0,Math.PI*2);c.fill();
  const t=new THREE.CanvasTexture(cv);t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;return t;
 }
 function fixFlutters(){
  const F=(window._life&&window._life.flutters)||[];
  let n=0;
  for(const f of F){
   if(!f||!f.wl||!f.wr||f.wl.userData.wfix)continue;
   let col='#ff8fab';try{col='#'+f.wl.material.color.getHexString();}catch(e){}
   const g=new THREE.PlaneGeometry(0.1,0.085);g.rotateX(-Math.PI/2);g.translate(0.05,0,0);   // flat and hinged at the body, so rotation.z is a flap
   const m=new THREE.MeshBasicMaterial({map:wingTex(col),transparent:true,alphaTest:0.4,side:THREE.DoubleSide,depthWrite:false});
   const og=f.wl.geometry,om=f.wl.material;
   f.wl.geometry=g;f.wr.geometry=g;f.wl.material=m;f.wr.material=m;
   f.wl.userData.wfix=f.wr.userData.wfix=1;
   try{og.dispose();om.dispose();}catch(e){}
   const body=tube(0.009,0.011,0.085,'#463c30',0,0,0,f.g);body.rotation.x=Math.PI/2;   // a dark thread of a body, enough to read as an insect rather than as paper
   blob(0.013,0.012,0.013,'#463c30',0,0,0.05,f.g);
   n++;
  }
  return n;
 }
 /* A butterfly is 10 cm of wing. Half a metre from the lens that is a quarter of the screen in
    flat colour, which is how a charming detail turns into a bug report. Nothing this small is
    worth drawing inside arm's reach of the camera. */
 function tickFlutters(){
  const F=(window._life&&window._life.flutters)||[];if(!F.length)return;
  const c=G.camera.position;
  for(const f of F){if(!f.g.visible)continue;const p=f.g.position;if(Math.hypot(p.x-c.x,p.y-c.y,p.z-c.z)<1.5)f.g.visible=false;}
 }
 /* The pennant bunting is 36 unlit triangles floating at 1.12 m with nothing holding them up
    and nothing between them — they read as coloured scraps hanging in the air over the rails.
    Hang them point-down off a cord and the same 36 triangles read as bunting. Built in
    ranch3d.html, so the flags are found in the scene rather than at their call site. */
 function fixBunting(){
  const flags=[];
  scene.traverse(o=>{const g=o.geometry;if(!o.isMesh||!g||g.type!=='CircleGeometry')return;
   const pr=g.parameters||{};if(pr.segments!==3||Math.abs(pr.radius-0.16)>0.01)return;flags.push(o);});
  if(!flags.length)return 0;
  for(const f of flags){f.rotation.z=-Math.PI/2;f.position.y=1.06;}   // the point hangs down, just under the cord
  const cord=new THREE.Group();
  for(const [x1,x2,z] of [[-22.2,22.4,-20],[-22.2,-3.9,20],[3.9,22.4,20]]){
   const c=box(x2-x1,0.025,0.025,'#6b5a45',(x1+x2)/2,1.2,z,cord);c.castShadow=false;
  }
  scene.add(cord);
  return flags.length;
 }
 P.fixFlutters=fixFlutters;P.fixBunting=fixBunting;

 /* ================= 11. the per-frame pass, gating, state, boot ================= */
 let gateT=0,unlockT=0,lastLockToast=0,followersT=0,companionT=0;
 G.on('tick',(dt,t)=>{
  tickVehicle(dt);
  tickHerds(dt,t);
  tickTrustHud();
  tickSanctuaries(dt,t);
  tickTownsfolk(dt);
  tickLabels(dt);
  tickFlutters();
  followersT+=dt;if(followersT>0.1){followersT=0;tickFollowers(0.1);}
  unlockT+=dt;if(unlockT>3){unlockT=0;ensureUnlocks();}
  companionT+=dt;if(companionT>0.5){companionT=0;findCompanion();}
  /* the soft boundary: a locked region turns you round at its edge; ridden in deep (a race
     dropped you there), you are carried out to the nearest open fast-travel spot */
  if(!P.veh&&!G.course.get()){gateT+=dt;if(gateT>0.25){gateT=0;const L=lockedRegionsAt(player.pos.x,player.pos.z);if(L.length){const rg=L.reduce((a,b)=>a.r>b.r?a:b);const dx=player.pos.x-rg.x,dz=player.pos.z-rg.z,d=Math.hypot(dx,dz)||1;
    if(d<rg.r-25){const s=S.fresh();const open=T.FT.map(f=>({f,rg:ftRegion(f)})).filter(o=>!o.rg||regionUnlocked(o.rg,s));const best=open.reduce((a,o)=>{const dd=hyp(player.pos.x,player.pos.z,o.f[1],o.f[2]);return !a||dd<a.dd?{o,dd}:a;},null);if(best){player.pos.set(best.o.f[1],0,best.o.f[2]);}}
    else{player.pos.x=rg.x+dx/d*(rg.r+2);player.pos.z=rg.z+dz/d*(rg.r+2);}
    player.speed=0;P.lastLock=rg.id;if(t-lastLockToast>4){lastLockToast=t;toast('🔒 '+lockText(rg));}}}}
 });
 G.on('interval30',()=>{ensureUnlocks();fixNpcTags();});   // a package may put someone new in a town long after boot
 G.on('state',o=>{
  const rg=W.regionAt(player.pos.x,player.pos.z);
  o.player.region=rg?rg.id:null;
  const s=S.fresh()||{};
  o.world={region:rg?rg.id:null,locked:T.REGIONS.filter(r=>r.unlock&&!regionUnlocked(r,s)).map(r=>r.id),
   vehicle:P.veh?{kind:P.veh.kind,t:Number(P.veh.t.toFixed(1)),dur:Number(P.veh.dur.toFixed(1)),x:Number((P.veh.x||0).toFixed(1)),z:Number((P.veh.z||0).toFixed(1)),y:Number((P.veh.y||0).toFixed(1)),alt:Number((P.veh.alt||0).toFixed(1))}:null,
   herds:P.herds.map(h=>({id:h.def.id,n:h.members.length,near:Math.min.apply(null,h.members.map(m=>hyp(player.pos.x,player.pos.z,m.pos.x,m.pos.z)).concat([1e9]))|0,trust:Math.round(Math.max.apply(null,h.members.map(m=>effTrust(m)).concat([0])))})),
   trust:P.trustFocus?{name:P.trustFocus.name,herd:P.trustFocus.herd.id,i:P.trustFocus.i,local:Math.round(P.trustFocus.trust),eff:Math.round(effTrust(P.trustFocus)),follow:!!P.trustFocus.follow,flee:P.trustFocus.flee>0,helpers:helpers(P.trustFocus)}:null,
   companion:s.companion==null?null:s.companion,bottles:(s.bottles||[]).length,badges:((s.sets&&s.sets.badges)||[]).length,toy:!!s.toyUnicorn,
   sanctuary:Object.keys(s.sanctuary||{}).reduce((a,k)=>{a[k]=(s.sanctuary[k]||[]).length;return a;},{}),
   townsfolk:P.townsfolk.length,landmarks:P.LANDMARKS.length,markers:MK.length,
   labels:LABELS.length,labelsShown:LABELS.reduce((a,L)=>a+(L.sp.visible?1:0),0)};
 });
 G.on('boot',()=>{ensureUnlocks();refreshFtLocks();findCompanion();
  /* Last in the queue, on purpose: every package has hung its plates by now, so one sweep of
     the scene catches all of them. */
  try{P.labelsFound=scanLabels();P.tagsFixed=fixNpcTags();P.fluttersFixed=fixFlutters();P.buntingFixed=fixBunting();}catch(e){console.error('world labels',e);}
  const s=S.fresh();if(s&&S.flag(s,'seen-world')){S.sync(sv=>{sv.flags=sv.flags||{};sv.flags['seen-world']=1;});setTimeout(()=>{try{toast('🗺️ Kestrel Basin has grown: towns, a ferry, balloons and wild herds. Press M for the map.');}catch(e){}},6000);}});
 Object.assign(P,{boardBalloon,boardFerry,vehicle:()=>P.veh,landVehicle,findCompanion,tameMember,offerCarrot,openSanctuary,collectBottle,regionOf,refreshFtLocks,ftRegion,VENUE_OF});
}
