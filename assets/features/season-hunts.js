/* Feature package 'season-hunts' — the half of a season you ride out and DO, rather than watch
   fill up. Owned by that package: edit only this file. See index.js for the contract. Nothing
   runs at import time.

   What lives here:

     the hunt engine  the golden-horseshoe hunt at ranch3d.html:6528 is the right idea wearing
                      exactly one costume: a date hashed into a seed, ten spots rejected against
                      the ranch and the river, a spin-and-bob tick, a set bonus. This generalises
                      it — a hunt is a season, a glyph, a count, a placement rule and a reward
                      ladder — and then hides four of them, one per season, across the WHOLE
                      basin including the four quarters past the old fence, so a hunt is a reason
                      to ride out to Amberwood rather than a lap of the home paddock
     egg hunt         🥚 twelve painted eggs in the bloom season, +40🪙 +5🎟️ each
     honey pots       🍯 fourteen in the long sun, left where the Barleyfold swarms settled
     lanterns         🏮 fifteen in the ember season — but the festival questline lights them,
                      so this hunt starts LOCKED and season-quests opens it through setOpen
     frost bells      🔔 thirteen under the snow in the frost season
     rescue bounty    a horse has got loose somewhere in the basin. A board by the ranch gate
                      says roughly where, the map pin is a guess until you get near, hoofprints
                      on the ground narrow it down, and standing quiet beside her long enough
                      gets a halter on. Lead her back to the post and the owner pays
     season coats     which coats run wild shifts with the season, some tied to one region's
                      herd, and while a season's exclusive coat is out there the auction house
                      cannot get that breed — go and tame one instead

   Everything here is findable with no menu open: map pins per quarter, minimap sparks at sixty
   metres, a physical board you press E at, hoofprints in the dirt, and a toast when you are
   close. The Hunts tab is a summary of what the world is already telling you. */
export const id='season-hunts';
export function install(G){
 const THREE=G.THREE, scene=G.scene, $=G.$;
 const W=G.world, T=G.tables, H=G.horse, S=G.save, M=G.money, Q=G.quest, UI=G.ui;
 const toast=(...a)=>G.toast(...a);                       // through G, so a QA run can listen in
 const player=H.player, groundH=W.groundH, riverZ=W.riverZ, riverLevel=W.riverLevel, streamX=W.streamX;
 const hyp=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
 const clock=()=>performance.now()*0.001;                 // a thing's tick is handed the THING, not the time
 const COMPASS=['north','north-east','east','south-east','south','south-west','west','north-west'];
 const compassTo=(dx,dz)=>COMPASS[Math.round(((Math.atan2(dx,-dz)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8];
 /* FNV-1a into the same little LCG the horseshoe hunt uses. Deterministic from a string, which
    is the whole point: everybody in a club digs in the same holes for the same week. */
 function hash32(str){let h=0x811c9dc5|0;str=String(str);for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return Math.abs(h)||1;}
 function lcg(seed){let k=hash32(seed);return()=>((k=(k*1103515245+12345)%2147483647)/2147483647);}
 const P={}; G.hunts=P;                                   // this package's live state, for QA and for its two siblings
 const season=()=>{try{return G.time.seasonNow();}catch(e){return {n:0,key:'S0',day:1,def:(T.SEASONS&&T.SEASONS[0])||{id:'bloom'}};}};
 const seasonId=()=>{const d=season().def;return d?d.id:'bloom';};

 /* ================= save ================= */
 /* s.hunt.seed stamps which season+week the finds belong to. The reset decision lives in
    refresh(), not here: an ensure runs on every read and must never decide anything. */
 S.ensure(s=>{
  s.hunt=s.hunt||{seed:'',got:{},done:{},sets:0};
  s.hunt.got=s.hunt.got||{}; s.hunt.done=s.hunt.done||{};
  s.bounty=s.bounty||{key:'',done:[],home:0,kept:0};
  s.bounty.done=s.bounty.done||[];
 });

 /* ================= 1. where a hidden thing may lie ================= */
 /* Eight zones, and a hunt deals its pieces round them in turn, so the four quarters past the
    old fence always get some — a hunt that lived within sight of the barn would not be a reason
    to ride anywhere. Rejection does the rest: off the river and its creek, out of the lake, off
    the ranch yard, clear of every collider, and off anything steep enough that a bobbing mesh
    would read as hanging in the air off a cliff face. */
 const ZONES=[
  {id:'core',      x:0,    z:0,    r:165,label:'🌾 the home basin'},
  {id:'amberwood', x:300,  z:-300, r:108,label:'🍂 Amberwood'},
  {id:'willowmere',x:310,  z:300,  r:102,label:'🪻 Willowmere Marsh'},
  {id:'frostpine', x:-300, z:-320, r:105,label:'❄️ Frostpine Tundra'},
  {id:'ochre',     x:-330, z:300,  r:105,label:'🏜️ Ochre Reach'},
  {id:'coyote',    x:-220, z:130,  r:95, label:'🏜️ Coyote Canyon'},
  {id:'barleyfold',x:215,  z:-105, r:72, label:'🌾 Barleyfold Farms'},
  {id:'hollowpeak',x:-160, z:-210, r:90, label:'🏔️ Hollowpeak Heights'},
 ];
 P.ZONES=ZONES;
 function placeable(x,z){
  if(Math.hypot(x,z)>428)return false;                              // the ride clamps you at 455
  if(Math.abs(x)<34&&Math.abs(z)<30)return false;                   // not in the yard, where you would trip over it
  if(Math.abs(z-riverZ(x))<11)return false;                         // the river ribbon and both banks
  if(z<163&&Math.abs(x-streamX(z))<10)return false;                 // the creek that feeds it
  if(hyp(x,z,20,16)<15)return false;                                // Loon Lake
  const h=groundH(x,z);
  if(Math.abs(z-riverZ(x))<55&&h<riverLevel(x)+0.35)return false;    // the wet bottoms either side of the channel
  if(Math.abs(groundH(x+1.5,z)-h)>1.0||Math.abs(groundH(x,z+1.5)-h)>1.0)return false;
  for(const c of W.colliders){if(Math.abs(c.x-x)>9)continue;if(hyp(x,z,c.x,c.z)<(c.r||1)+1.4)return false;}
  return true;
 }
 P.placeable=placeable;
 function spotIn(zone,rnd){
  for(let k=0;k<70;k++){
   const a=rnd()*Math.PI*2, r=Math.sqrt(rnd())*zone.r;
   const x=zone.x+Math.cos(a)*r, z=zone.z+Math.sin(a)*r;
   if(placeable(x,z))return [x,z];
  }
  /* Seventy draws and nothing took — borrow the world package's spiral search, and if even that
     fails take the centre, because a hunt with a hole in it is worse than a piece in a hedge. */
  try{const at=G.worldPkg.findClear(zone.x,zone.z,2.2,zone.r);if(placeable(at[0],at[1]))return at;}catch(e){}
  return [zone.x,zone.z];
 }

 /* ================= 2. the hunt engine ================= */
 /* Deliberately not the built-in 'coll' path: that hard-codes COLL_SETS and writes s.sets. A
    hunt owns its own save, its own reward ladder and its own week. */
 const HUNTS=[];
 const huntSeed=def=>def.id+'|'+season().key+'|'+G.time.isoWeekKey();
 const weekStamp=()=>season().key+'|'+G.time.isoWeekKey();
 const shouldLive=h=>h.def.season===seasonId()&&(h.def.gated?!!P.open[h.def.id]:true);
 function makeHunt(def){
  const h={def,items:[],live:false,built:false,geo:null,mat:null};
  /* One map pin per zone, no exact spot and no label: it says WHICH quarter to ride to, which is
     as much as a hunt ought to give away. The minimap spark below does the last sixty metres. */
  for(const zone of ZONES)W.mapMarkers.push({x:zone.x,z:zone.z-24,glyph:def.glyph,alpha:0.9,kind:'hunt',hunt:def.id,zone:zone.id,
   hidden:()=>!h.live||!h.items.some(it=>it.zone===zone.id&&!it.got)});
  HUNTS.push(h); return h;
 }
 const byId=id=>HUNTS.find(h=>h.def.id===id);
 function gotList(s,def){s.hunt.got[def.id]=s.hunt.got[def.id]||[];return s.hunt.got[def.id];}
 function clearHunt(h){
  for(const it of h.items){
   const k=W.things.indexOf(it); if(k>=0)W.things.splice(k,1);
   const m=W.miniMarkers.indexOf(it.mini); if(m>=0)W.miniMarkers.splice(m,1);
   if(it.g){try{scene.remove(it.g);}catch(e){}}
  }
  h.items=[]; h.live=false;
 }
 /* Lay the hunt out from this week's seed. Called at boot, when the season turns, and by the
    slow pass when the ISO week rolls over under a session somebody left running overnight. */
 function placeHunt(h){
  const def=h.def, rnd=lcg(huntSeed(def));
  const sv=S.fresh()||{}, have=((sv.hunt&&sv.hunt.got)||{})[def.id]||[];
  if(!h.built){const b=def.build(THREE,W)||{};h.geo=b.geo||null;h.mat=b.mat||null;h.built=true;}
  const lift=def.lift==null?0.05:def.lift, bob=def.bob==null?0.08:def.bob;
  for(let i=0;i<def.n;i++){
   const zone=ZONES[i%ZONES.length], at=spotIn(zone,rnd);
   const g=def.mesh(THREE,W,h,i);
   const y=groundH(at[0],at[1])+lift;
   g.position.set(at[0],y,at[1]); scene.add(g);
   const it={kind:def.kind,id:def.id+'_'+i,i,zone:zone.id,g,x:at[0],z:at[1],y,bob,ph:rnd()*9,reach:2.9,
    got:have.indexOf(i)>=0,
    label:t=>t.got?'':def.glyph+' '+def.pickup+' (E)',
    use:t=>collect(h,t),
    tick:(dt,t,d)=>tickItem(h,t,d)};
   if(it.got){it.g.visible=false;it.reach=0.01;}
   W.addThing(it);
   /* miniMarkers' hidden() means 'do not draw', so the test is inverted: a spark shows up only
      inside sixty metres, exactly the way the golden horseshoes come up on the minimap. */
   it.mini={x:at[0],z:at[1],col:def.col,r:3,hidden:()=>!(h.live&&!it.got&&hyp(player.pos.x,player.pos.z,at[0],at[1])<62)};
   W.miniMarkers.push(it.mini);
   h.items.push(it);
  }
  h.live=true;
 }
 let hintAt=0;
 function tickItem(h,it,d){
  if(it.got||!h.live)return;
  const t=clock(), def=h.def;
  if(def.spin!==false)it.g.rotation.y=t*0.9+it.ph;
  if(it.bob)it.g.position.y=it.y+Math.sin(t*2+it.ph)*it.bob;
  if(def.pulse)def.pulse(it,t);
  if(d<2.4&&player.y<1.6){collect(h,it);return;}
  /* The warm signal: one line, throttled hard, naming a direction. Enough to turn your head,
     not enough to save you the ride. */
  if(d<30&&!it.hinted&&t-hintAt>12){it.hinted=true;hintAt=t;toast(def.glyph+' '+def.near+' — something to the '+compassTo(it.x-player.pos.x,it.z-player.pos.z));}
 }
 function collect(h,it){
  if(it.got||!h.live)return;
  const def=h.def;
  it.got=true; it.reach=0.01; if(it.g)it.g.visible=false;   // left in things: splicing mid-tickThings is how you drop a frame
  let cnt=0,all=false,extra=null;
  S.sync(s=>{
   const got=gotList(s,def);
   if(got.indexOf(it.i)<0)got.push(it.i);
   cnt=got.length;
   M.payReward(s,def.pay);
   for(const step of (def.ladder||[]))if(step[0]===cnt){extra=step[1];M.payReward(s,extra);}
   if(cnt>=def.n&&!s.hunt.done[def.id]){s.hunt.done[def.id]=1;s.hunt.sets=(s.hunt.sets||0)+1;M.payReward(s,def.all);all=true;}
  });
  M.refreshWallet(); G.sCoin(); if(all||extra)G.sGem();
  G.xp.addXp3D(12); G.xp.passAdd(4);
  Q.dailyEvt('hunt',1);
  const left=h.items.filter(q=>!q.got).length;
  toast(all?def.glyph+' Every '+def.noun+' found this week! +'+M.rewardLabel(def.all)
          :def.glyph+' '+def.found+' +'+M.rewardLabel(def.pay)+(extra?' +'+M.rewardLabel(extra):'')+' — '+left+' still hidden out there');
 }
 /* Which hunts should exist right now, and are they laid out for this week? */
 P.open={};
 let laidFor='';
 function refresh(force){
  const stamp=weekStamp();
  if(!force&&stamp===laidFor&&HUNTS.every(h=>h.live===shouldLive(h)))return;
  if(stamp!==laidFor||force){
   laidFor=stamp;
   S.sync(s=>{if(s.hunt.seed!==stamp){s.hunt.seed=stamp;s.hunt.got={};s.hunt.done={};}});
   for(const h of HUNTS)if(h.live)clearHunt(h);
  }
  for(const h of HUNTS){
   const want=shouldLive(h);
   if(want&&!h.live)placeHunt(h);
   else if(!want&&h.live)clearHunt(h);
  }
 }
 /* The seam with season-quests: it owns the festival questline, this owns the lanterns, and the
    only thing that crosses is a boolean. Neither of us reads the other's save. */
 P.setOpen=(id,on)=>{const h=byId(id);if(!h)return false;P.open[id]=!!on;refresh();
  if(on&&h.live)toast(h.def.glyph+' '+h.def.opened);
  return h.live;};
 P.isOpen=id=>!!P.open[id];
 P.items=id=>{const h=byId(id);return h?h.items.slice():[];};
 P.found=id=>{const h=byId(id);return h?h.items.filter(i=>i.got).length:0;};
 P.live=()=>HUNTS.filter(h=>h.live).map(h=>h.def.id);
 P.zonesOf=id=>{const h=byId(id);return h?h.items.map(i=>i.zone):[];};
 P.seedOf=id=>{const h=byId(id);return h?huntSeed(h.def):'';};
 P.reseed=()=>{for(const h of HUNTS)if(h.live)clearHunt(h);laidFor='';refresh(true);};
 P.defs=()=>HUNTS.map(h=>h.def);

 /* ================= 3. the four hunts ================= */
 function eggMesh(THREE,W,h,i){
  const g=new THREE.Group();
  const shell=new THREE.Mesh(h.geo,h.mat[i%h.mat.length]);
  shell.scale.set(1,1.32,1); shell.position.y=0.32; shell.castShadow=true; g.add(shell);
  for(let k=0;k<7;k++){const a=k/7*Math.PI*2;W.tube(0.035,0.035,0.5,'#8a6a45',Math.cos(a)*0.3,0.06,Math.sin(a)*0.3,g).rotation.z=Math.cos(a)*1.4;}
  return g;
 }
 makeHunt({id:'egg',kind:'hunt-egg',season:'bloom',glyph:'🥚',col:'#f2a0c8',n:12,lift:0.02,bob:0.06,
  noun:'egg',pickup:'Pick up the painted egg',found:'A painted egg!',near:'Something tucked in the grass',
  label:'Blossom Egg Hunt',blurb:'Twelve painted eggs hidden across the basin, fresh spots every Monday.',
  pay:{c:40,tok:5},ladder:[[4,{k:1}],[8,{g:1}]],all:{g:2,k:1},
  build:THREE=>({geo:new THREE.SphereGeometry(0.24,14,11),
   mat:['#f2a0c8','#ffd166','#9fd8f2','#b6e08a'].map(c=>new THREE.MeshStandardMaterial({color:new THREE.Color(c),roughness:0.42,emissive:new THREE.Color(c),emissiveIntensity:0.22}))}),
  mesh:eggMesh});
 function potMesh(THREE,W,h){
  const g=new THREE.Group();
  const pot=new THREE.Mesh(h.geo,h.mat); pot.position.y=0.28; pot.castShadow=true; g.add(pot);
  W.box(0.44,0.07,0.44,'#7a5a30',0,0.55,0,g);
  W.tube(0.05,0.05,0.22,'#7a5a30',0,0.66,0,g);
  return g;
 }
 makeHunt({id:'honey',kind:'hunt-honey',season:'sun',glyph:'🍯',col:'#ffd166',n:14,lift:0.02,bob:0.06,
  noun:'pot',pickup:'Take the honey pot',found:'A Barleyfold honey pot!',near:'Bees, and not far off',
  label:'The Long Sun Honey Run',blurb:'The Barleyfold hives summer out on the open pasture; fourteen pots left where the swarms settled.',
  pay:{c:35,tok:5},ladder:[[5,{k:1}],[10,{g:1}]],all:{g:2,k:1},
  build:THREE=>({geo:new THREE.CylinderGeometry(0.28,0.22,0.52,14),
   mat:new THREE.MeshStandardMaterial({color:0xe0a13a,roughness:0.35,emissive:0x7a4a10,emissiveIntensity:0.3})}),
  mesh:potMesh});
 /* The lanterns are the one hunt that is not simply on because it is autumn: the festival has to
    be lit first, and that is season-quests' story to tell. A lantern stands on a post, so it
    neither spins nor bobs — the flame does the moving. */
 function lanternMesh(THREE,W){
  let g=null;
  try{g=W.buildDecorMesh('lantern',false);}catch(e){g=null;}
  if(!g){g=new THREE.Group();W.tube(0.05,0.06,2.2,'#3a2e24',0,1.1,0,g);W.box(0.3,0.3,0.3,'#3a2e24',0,2.3,0,g);}
  g.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissiveIntensity>0.8)g.userData.lamp=o;});
  g.scale.setScalar(0.8);
  return g;
 }
 makeHunt({id:'lantern',kind:'hunt-lantern',season:'ember',glyph:'🏮',col:'#e07a3c',n:15,lift:0,bob:0,spin:false,gated:true,
  noun:'lantern',pickup:'Lift the festival lantern',found:'A festival lantern!',near:'A light, somewhere in the dark',
  label:'Harmony Festival Lanterns',blurb:'Fifteen lanterns lit across the valley each week of the festival — once the festival has opened.',
  locked:'the festival questline has not lit them yet',opened:'The lanterns are lit across the valley — go and gather them in.',
  pay:{c:30,tok:6},ladder:[[5,{k:1}],[10,{g:1}]],all:{g:3,k:1},
  build:()=>({}),mesh:lanternMesh,
  pulse:(it,t)=>{const lamp=it.g.userData.lamp;if(lamp&&lamp.material)lamp.material.emissiveIntensity=1.2+Math.sin(t*2.2+it.ph)*0.55;}});
 function bellMesh(THREE,W,h){
  const g=new THREE.Group();
  W.tube(0.03,0.03,0.62,'#8a97a6',0,0.31,0,g);
  const bell=new THREE.Mesh(h.geo,h.mat); bell.position.y=0.52; bell.castShadow=true; g.add(bell);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6),h.mat); ball.position.y=0.32; g.add(ball);
  return g;
 }
 makeHunt({id:'frostbell',kind:'hunt-frostbell',season:'frost',glyph:'🔔',col:'#9fd8f2',n:13,lift:0.02,bob:0.05,
  noun:'bell',pickup:'Free the frost bell',found:'A frost bell, still ringing!',near:'A bell, thin and far off',
  label:'The Frost Bell Ring',blurb:'Thirteen little bells hung out at first snow and buried by the second.',
  pay:{c:45,tok:6},ladder:[[4,{k:1}],[9,{g:1}]],all:{g:3,k:1},
  build:THREE=>({geo:new THREE.ConeGeometry(0.22,0.4,12,1,true),
   mat:new THREE.MeshStandardMaterial({color:0xcfe6f2,roughness:0.25,metalness:0.7,emissive:0x4f8fb0,emissiveIntensity:0.35,side:THREE.DoubleSide})}),
  mesh:bellMesh});

 /* ================= 4. the rescue bounty ================= */
 /* The valley already has a runaway roundup and none of it is reachable: RUNAWAY_SPOTS,
    spawnRunaways and tickRunaways are module-private, and G.course.startRoundup is the pen
    minigame, a different thing entirely. So these are our own strays, built from makeHorse and
    animated through G.anim, and on a weekend they are out there alongside the inline three. The
    board says so rather than pretending otherwise. */
 const BOUNTY_N=3;
 const STRAY_NAMES=['Dandelion','Pepper','Tuppence','Marbles','Bramble','Nutmeg','Pike','Solstice','Clover','Rook'];
 const OWNERS=['Otto at Barleyfold','Bea at the saddlery','Hanne in the wheat rows','Old Ned','Ilse up at the cabin','the Blossom Inn','Dusty at the outpost'];
 const bounties=[];
 P.bounties=()=>bounties.filter(b=>!b.done);
 P.allBounties=()=>bounties.slice();
 let POST={x:18,z:-16};
 function rollBounties(){
  const key=G.time.dateKey(), rnd=lcg('bounty|'+key);
  const done=((S.fresh()||{}).bounty||{}).done||[];
  const names=STRAY_NAMES.slice(), owners=OWNERS.slice();   // drawn without replacement: two Tuppences on one board reads as a bug
  const draw=a=>a.splice(Math.floor(rnd()*a.length),1)[0];
  const out=[];
  for(let i=0;i<BOUNTY_N;i++){
   const zone=ZONES[1+Math.floor(rnd()*(ZONES.length-1))];     // a stray has STRAYED: never the home basin
   const at=spotIn(zone,rnd);
   const wb=T.WILD_BREEDS[Math.floor(rnd()*T.WILD_BREEDS.length)]||{breed:'bay',body:'#8a5a2b',mane:'#332214',base:4};
   const far=Math.hypot(at[0],at[1]);
   /* Where the board THINKS she is: always a genuine guess, on a ring forty to seventy metres
      off, never accidentally right. It sharpens to her real position once you have been within
      a hundred metres of her. */
   const da=rnd()*Math.PI*2, dr=40+rnd()*30;
   out.push({id:key+'#'+i,i,name:draw(names),owner:draw(owners),
    wb,zone,x:at[0],z:at[1],pos:new THREE.Vector3(at[0],0,at[1]),heading:rnd()*6,tx:at[0],tz:at[1],rest:2+rnd()*4,
    phase:rnd()*6,settle:0,spook:0,haltered:false,found:false,tracked:false,done:done.indexOf(key+'#'+i)>=0,
    dec:[at[0]+Math.cos(da)*dr,at[1]+Math.sin(da)*dr],parts:null,tag:null,thing:null,sign:null,signT:0,dlg:false,
    pay:{c:160+Math.round(far*1.1),tok:3+Math.floor(far/140),p:25}});
  }
  return out;
 }
 function bountyMesh(b){
  if(b.parts)return;
  b.parts=H.makeHorse({colors:{body:b.wb.body,mane:b.wb.mane},seed:(b.i*3+2)%9,breed:b.wb.breed});
  b.tag=G.nameSprite('🪢 '+b.name+' — loose'); b.tag.position.y=2.7; b.parts.group.add(b.tag);
  b.parts.group.position.set(b.pos.x,groundH(b.pos.x,b.pos.z),b.pos.z);
  scene.add(b.parts.group);
  b.thing=W.addThing({kind:'bounty',id:'stray_'+b.i,x:b.pos.x,z:b.pos.z,g:null,reach:6.2,bounty:b,
   label:()=>b.done?'':b.haltered?'🪢 '+b.name+' is on the lead — back to the bounty post':
    b.settle>=55?'🪢 Slip the halter on '+b.name+' (E)':'🐴 Halt beside '+b.name+' and wait — '+Math.round(b.settle)+'%',
   use:()=>ropeThrow(b),
   tick:(dt,t)=>{t.x=b.pos.x;t.z=b.pos.z;}});
 }
 function bountyUnmesh(b){
  if(b.parts){try{scene.remove(b.parts.group);}catch(e){}b.parts=null;b.tag=null;}
  if(b.thing){const k=W.things.indexOf(b.thing);if(k>=0)W.things.splice(k,1);b.thing=null;}
 }
 /* Hoofprints. Five flattened discs on the line she came in on, dragged along as she drifts, and
    drawn only once you are inside a hundred and seventy metres — which is what makes them
    tracking sign rather than a second map pin. */
 const printMat=new THREE.MeshStandardMaterial({color:0x3a2c20,roughness:1,transparent:true,opacity:0.55});
 const printGeo=new THREE.CircleGeometry(0.16,10);
 function bountySign(b){
  if(!b.sign){
   b.sign=new THREE.Group();
   for(let k=0;k<5;k++){const m=new THREE.Mesh(printGeo,printMat);m.rotation.x=-Math.PI/2;b.sign.add(m);}
   scene.add(b.sign);
  }
  const a=Math.atan2(b.pos.x-b.x,b.pos.z-b.z)||b.heading;
  b.sign.children.forEach((m,k)=>{
   const back=(5-k)*7.5+3, x=b.pos.x-Math.sin(a)*back+(k%2?0.5:-0.5), z=b.pos.z-Math.cos(a)*back;
   m.position.set(x,groundH(x,z)+0.06,z);
  });
 }
 function ropeThrow(b){
  if(b.done||b.haltered)return;
  if(Math.abs(player.speed)>2.2){toast('🪢 Halt first — she will not stand for a rope thrown at a gallop.');return;}
  if(b.settle<55){toast('🐴 '+b.name+' is not having it yet. Sit quiet beside her a while longer.');return;}
  halter(b);
 }
 function halter(b){
  b.haltered=true; b.settle=100; G.sChime();
  if(b.tag)b.tag.visible=false;
  toast('🪢 The halter goes on '+b.name+'. Lead her back to the bounty post by the ranch gate.');
 }
 function handOver(b){
  if(b.dlg||b.done)return; b.dlg=true;
  const d=$('dlg'); if(!d){payBounty(b,'hand');return;}
  d.innerHTML='<b>🪢 '+b.name+' is home</b><p style="font-size:13px">'+b.owner+' put her on the board this morning. She had got as far as '+b.zone.label+'.</p>'
   +'<button id="huntPay" style="margin-right:6px">📜 Hand her over (+'+M.rewardLabel(b.pay)+')</button>'
   +'<button id="huntKeep">🏡 Nobody claimed her — keep her</button>';
  d.style.display='block';
  const close=()=>{d.style.display='none';};
  $('huntPay').onclick=()=>{close();payBounty(b,'hand');};
  $('huntKeep').onclick=()=>{close();payBounty(b,'keep');};
 }
 function payBounty(b,how){
  if(b.done)return;
  b.done=true;
  const half={c:Math.round(b.pay.c*0.4),p:b.pay.p};
  S.sync(s=>{
   if(s.bounty.done.indexOf(b.id)<0)s.bounty.done.push(b.id);
   if(how==='hand'){M.payReward(s,b.pay);s.bounty.home=(s.bounty.home||0)+1;}
   else{
    M.payReward(s,half); s.bounty.kept=(s.bounty.kept||0)+1;
    const cl=(v,a,c)=>Math.max(a,Math.min(c,v)), ri=(a,c)=>Math.floor(a+Math.random()*(c-a+1)), base=b.wb.base||4;
    H.grantHorse(s,b.wb.breed,{name:b.name,colors:{body:b.wb.body,mane:b.wb.mane},bond:25,src:'bounty',
     stats:{speed:cl(base+ri(-1,1),1,10),stamina:cl(base+ri(-1,1),1,10),jump:cl(base+ri(-1,1),1,10),accel:cl(base+ri(-1,1),1,10),agility:cl(base+ri(-1,1),1,10)},
     needs:{hunger:70,thirst:70,clean:40,happy:80},extra:{variant:b.wb.variant||null,stray:true}});
   }
  });
  bountyUnmesh(b);
  if(b.sign){try{scene.remove(b.sign);}catch(e){}b.sign=null;}
  M.refreshWallet(); G.sGem(); G.xp.addXp3D(30); G.xp.passAdd(25);
  Q.dailyEvt('bounty',1); Q.questEvt('tame',1);
  if(how==='keep'){try{H.reloadHorses();}catch(e){}toast('🏡 '+b.name+' stays at Meadowlark. +'+M.rewardLabel(half));}
  else toast('📜 '+b.owner+' pays the bounty on '+b.name+'. +'+M.rewardLabel(b.pay));
 }
 function tickBounties(dt){
  const sp=Math.abs(player.speed), t=clock();
  for(const b of bounties){
   if(b.done)continue;
   const d=hyp(player.pos.x,player.pos.z,b.pos.x,b.pos.z);
   if(b.mk){b.mk.x=b.pos.x;b.mk.z=b.pos.z;}                  // the minimap spark rides with her
   if(d>300&&!b.haltered){bountyUnmesh(b);if(b.mark&&!b.found){b.mark.x=b.dec[0];b.mark.z=b.dec[1];}continue;}
   bountyMesh(b);
   if(d<120&&!b.found)b.found=true;                          // close enough that the pin can stop lying
   if(d<65&&!b.tracked){b.tracked=true;toast('🐾 Fresh tracks — '+b.name+' went '+compassTo(b.pos.x-player.pos.x,b.pos.z-player.pos.z)+' from here.');}
   if(b.mark){const ex=b.found||b.haltered;b.mark.x=ex?b.pos.x:b.dec[0];b.mark.z=ex?b.pos.z:b.dec[1];}
   if(d<170){if(t-b.signT>3){b.signT=t;bountySign(b);}if(b.sign)b.sign.visible=!b.haltered;}
   else if(b.sign)b.sign.visible=false;
   if(b.dlg&&d>24)b.dlg=false;                               // walked off without choosing: let her be handed over later
   let gait='walk',amp=0.4,mv=0;
   if(b.spook>0){
    b.spook-=dt; b.settle=Math.max(0,b.settle-dt*30);
    b.heading=Math.atan2(b.pos.x-player.pos.x,b.pos.z-player.pos.z);
    try{b.heading=W.avoid(b,b.heading,3);}catch(e){}
    b.pos.x+=Math.sin(b.heading)*7*dt; b.pos.z+=Math.cos(b.heading)*7*dt;
    try{W.pushOut(b,0.5);}catch(e){}
    b.phase+=dt*9; gait='gallop'; amp=0.9; mv=9;
   }else if(b.haltered){
    const bx=player.pos.x-Math.sin(player.heading)*4.2, bz=player.pos.z-Math.cos(player.heading)*4.2;
    try{mv=W.steer(b,bx,bz,dt,7,{stop:1.7,base:1.2,gain:0.8,turn:3.5});}catch(e){mv=0;}
    b.phase+=dt*(mv>3.5?6:3); gait=mv>3.5?'gallop':'walk'; amp=mv>3.5?0.72:mv>0.2?0.42:0.05;
    if(hyp(b.pos.x,b.pos.z,POST.x,POST.z)<13)handOver(b);
   }else{
    if(d<14&&sp>5.5)b.spook=1.8;
    else if(d<6.5&&sp<2.2){b.settle=Math.min(100,b.settle+dt*24);b.rest=Math.max(b.rest,0.6);if(b.settle>=100){halter(b);}}
    else b.settle=Math.max(0,b.settle-dt*3);
    b.phase+=dt*(b.rest>0?1.2:4);
    if(b.rest>0)b.rest-=dt;
    else if(hyp(b.tx,b.tz,b.pos.x,b.pos.z)<0.7){b.rest=3+Math.random()*5;const a=Math.random()*Math.PI*2,r=Math.random()*26;b.tx=b.x+Math.cos(a)*r;b.tz=b.z+Math.sin(a)*r;}
    else{try{mv=W.steer(b,b.tx,b.tz,dt,1.2,{stop:0.7,base:1.1,gain:0,turn:2});}catch(e){mv=0;}}
    amp=b.rest>0?0.05:0.4;
   }
   if(b.parts){
    const A=G.anim, calm=b.rest>0&&!b.haltered&&b.spook<=0?1:0;
    if(A){A.animateHorse(b.parts,b.phase,amp,gait==='gallop'?A.GAITS.gallop:A.GAITS.walk,true,t,calm,dt);
     if(d<60)H.dressWithRig(b,b.parts,{body:b.wb.body,mane:b.wb.mane},{breed:b.wb.breed});
     A.tickRig(b,mv,dt,t,calm);}
    b.parts.group.position.set(b.pos.x,groundH(b.pos.x,b.pos.z),b.pos.z);
    b.parts.group.rotation.y=b.heading;
   }
  }
 }
 /* The board itself: a real post by the ranch gate with three papers nailed to it. */
 function buildPost(){
  try{const at=G.worldPkg.findClear(18,-16,3.2,60);POST={x:at[0],z:at[1]};}catch(e){}
  const g=new THREE.Group();
  W.tube(0.09,0.11,2.2,'#6b4a2a',-0.8,1.1,0,g); W.tube(0.09,0.11,2.2,'#6b4a2a',0.8,1.1,0,g);
  W.box(2.0,1.25,0.12,'#8a6a45',0,1.65,0,g);
  W.box(2.2,0.12,0.26,'#6b4a2a',0,2.36,0,g);
  for(let k=0;k<3;k++)W.box(0.5,0.62,0.03,'#f4e8c8',-0.6+k*0.6,1.66,0.08,g);
  g.position.set(POST.x,groundH(POST.x,POST.z),POST.z); g.rotation.y=-0.5;
  const sp=G.nameSprite('📜 Bounty board'); sp.position.y=3.0; g.add(sp);
  scene.add(g); try{W.followCamera.register(g);}catch(e){}
  W.addThing({kind:'bountyboard',id:'bountyboard',x:POST.x,z:POST.z,g:null,reach:4.4,
   label:()=>{const n=bounties.filter(b=>!b.done).length;return n?'📜 Read the bounty board — '+n+' loose (E)':'📜 Bounty board — all brought in today (E)';},
   use:()=>openBoard()});
  W.colliders.push({x:POST.x,z:POST.z,r:0.9});
  W.mapMarkers.push({x:POST.x,z:POST.z,glyph:'📜',kind:'bountyboard',alpha:0.95});
 }
 function openBoard(){
  const d=$('dlg'); if(!d)return;
  const rows=bounties.map(b=>{
   const px=b.found?b.pos.x:b.dec[0], pz=b.found?b.pos.z:b.dec[1];
   const far=Math.round(hyp(player.pos.x,player.pos.z,px,pz));
   return '<div class="evrow">'+(b.done?'✅':b.haltered?'🪢':'🐎')+' <b>'+b.name+'</b><span>'
    +(b.done?'brought in — thank you'
            :b.owner+' · last seen in '+b.zone.label+', about '+far+' m '+compassTo(px-player.pos.x,pz-player.pos.z)
             +(b.found?' · tracked':' · rough')+' · pays '+M.rewardLabel(b.pay))+'</span></div>';
  }).join('');
  d.innerHTML='<b>📜 Kestrel Basin bounty board</b><p style="font-size:13px">Horses off their own ground. Ride out, halt beside one and sit quiet until she settles, then slip the halter on and lead her back here. The pin on your map is a guess until you get within a hundred metres — look for hoofprints before that.</p>'
   +rows+'<div style="font-size:12px;color:#8c7a63;margin-top:6px">These are the board\'s horses, tagged 🪢. On a weekend Grandpa Wren\'s own three get out as well; those are a different job.</div>'
   +'<button id="dlgBtn" style="margin-top:6px">🐴</button>';
  d.style.display='block'; $('dlgBtn').onclick=()=>{d.style.display='none';};
 }
 function refreshBounties(force){
  const key=G.time.dateKey();
  let rolled=false;
  S.sync(s=>{if(s.bounty.key!==key){s.bounty.key=key;s.bounty.done=[];rolled=true;}});
  if(!force&&!rolled&&bounties.length&&bounties[0].id.indexOf(key)===0)return;
  for(const b of bounties){
   bountyUnmesh(b);
   if(b.sign){try{scene.remove(b.sign);}catch(e){}b.sign=null;}
   const i=W.mapMarkers.indexOf(b.mark); if(i>=0)W.mapMarkers.splice(i,1);
   const j=W.miniMarkers.indexOf(b.mk); if(j>=0)W.miniMarkers.splice(j,1);
  }
  bounties.length=0;
  for(const b of rollBounties()){
   bounties.push(b);
   b.mark={x:b.dec[0],z:b.dec[1],glyph:'🐎',kind:'bounty',alpha:0.95,hidden:()=>b.done};
   W.mapMarkers.push(b.mark);
   b.mk={x:b.pos.x,z:b.pos.z,col:'#e0553a',r:3,hidden:()=>b.done||hyp(player.pos.x,player.pos.z,b.pos.x,b.pos.z)>80};
   W.miniMarkers.push(b.mk);
  }
 }

 /* ================= 5. season-weighted wild horses ================= */
 /* world.js's pickWb filters WILD_BREEDS live on every spawn and prefers an exclusive herd's own
    region at 60%, so the contract-only way to make a coat seasonal is to put the row in the table
    while the season runs and take it out again when the season turns. Standing herd members do
    not re-roll: a new coat turns up on the next respawn, three minutes after somebody tames one.
    Region tags are the four herd regions, because a coat tagged to a region with no herd in it
    would never be rolled at all. */
 const WILD_SEASON={
  bloom:[{breed:'pinto',variant:'Blossom Pinto',body:'#e6cfd6',mane:'#6f4352',base:5,region:'pines'},
         {breed:'palomino',variant:'Orchard Cream',body:'#e6cf9e',mane:'#f7eedb',base:5}],
  sun:  [{breed:'appaloosa',variant:'Long-Sun Dun',body:'#c8a06a',mane:'#4a3220',base:6,region:'coyote'},
         {breed:'bay',variant:'Dust Devil',body:'#a9702f',mane:'#2e1d10',base:5}],
  ember:[{breed:'haflinger',variant:'Amberwood Chestnut',body:'#b4622b',mane:'#f0dcb4',base:6,region:'pines'},
         {breed:'black',variant:'Woodsmoke Roan',body:'#4a4448',mane:'#211d21',base:5}],
  frost:[{breed:'grey',variant:'Rimefall Silver',body:'#cdd6df',mane:'#8d98a6',base:6,region:'hollowpeak'},
         {breed:'fjord',variant:'Frostpine Fjord',body:'#dfd4bd',mane:'#f7f3e8',base:5}],
 };
 const liveCoats=()=>T.WILD_BREEDS.filter(w=>w.season);
 P.wildCoats=()=>liveCoats().map(w=>w.variant);
 function applyCoats(){
  for(let i=T.WILD_BREEDS.length-1;i>=0;i--)if(T.WILD_BREEDS[i].season)T.WILD_BREEDS.splice(i,1);
  for(const c of (WILD_SEASON[seasonId()]||[]))T.WILD_BREEDS.push(Object.assign({season:seasonId()},c));
 }
 applyCoats();
 /* The other half of 'exclusive': while a season's region coat is out with a herd, the auction
    house cannot get that breed. The shop still sells it at its listed price, so nobody is ever
    blocked — but the cheap way to one this season is to go and tame it. */
 H.sourceRule((ctx,b)=>{
  if(ctx!=='market')return undefined;
  const k=b&&b[0]; if(!k)return undefined;
  return liveCoats().some(c=>c.region&&c.breed===k)?false:undefined;
 });
 /* A herd carrying a season coat gets a note on the big map, so 'what is running wild now' is a
    question the map answers rather than a wiki. */
 const coatMarks=[];
 function buildCoatMarks(){
  for(const hd of ((G.worldPkg&&G.worldPkg.WILD_HERDS)||[])){
   const mk={x:hd.x,z:hd.z+20,glyph:'✨',kind:'coat',alpha:0.9,label:'',labelDz:12,hidden:()=>!mk.label};
   W.mapMarkers.push(mk); coatMarks.push({hd,mk});
  }
 }
 function refreshCoatMarks(){
  const herds=(G.worldPkg&&G.worldPkg.herds)||[];
  for(const c of coatMarks){
   const coat=liveCoats().find(w=>w.region===c.hd.region);
   const live=herds.find(h=>h.def===c.hd);
   const wearing=!!(live&&live.members.some(m=>m.wb&&m.wb.season));
   c.mk.label=coat?(wearing?'✨ '+coat.variant:'✨ '+coat.variant+' (next respawn)'):'';
  }
 }
 P.coatMarks=()=>coatMarks.map(c=>({herd:c.hd.id,label:c.mk.label}));

 /* ================= 6. the panel, the boards, the dailies ================= */
 UI.questTab({id:'hunts',label:'🥚 Hunts',render(s){
  const S0=season(), def=S0.def||{};
  const row=(ico,title,pct,right,sub)=>'<div class="qrow'+(pct>=100?' claimed':'')+'"><span class="qico">'+ico+'</span><span class="qmain"><b>'+title+'</b>'
   +(sub?'<span style="font-size:11px;color:#8c7a63;font-weight:600">'+sub+'</span>':'')
   +'<span class="qbar"><span class="qfill" style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></span></span><span style="font-size:11px;color:#8c7a63">'+right+'</span></div>';
  let html='<span style="font-size:12px;color:#8c7a63">'+(def.emoji||'')+' '+(def.name||'')+' · day '+S0.day+' of 28. Hidden pieces move every Monday and are in the same places for everyone in your club. Press M — every quarter with something still in it carries a pin.</span>';
  for(const h of HUNTS){
   const d=h.def, got=((s.hunt&&s.hunt.got&&s.hunt.got[d.id])||[]).length;
   const mine=d.season===seasonId(), locked=d.gated&&!P.open[d.id];
   const zones=h.live?ZONES.filter(z=>h.items.some(it=>it.zone===z.id&&!it.got)).map(z=>z.label.split(' ').slice(1).join(' ')).join(' · '):'';
   html+=row(d.glyph,d.label,mine?got/d.n*100:0,
    mine?(locked?'🔒':got+'/'+d.n):'out of season',
    mine?(locked?d.locked:(zones?'still hidden in: '+zones:'every one found — '+M.rewardLabel(d.all)+' paid'))
        :d.blurb);
  }
  const open=bounties.filter(b=>!b.done).length;
  html+='<div class="qrow"><span class="qico">📜</span><span class="qmain"><b>Bounty board</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'
   +(open?open+' loose in the basin — the board is by the ranch gate':'all brought in today')
   +' · '+((s.bounty&&s.bounty.home)||0)+' handed back, '+((s.bounty&&s.bounty.kept)||0)+' kept</span></span></div>';
  const coats=liveCoats();
  html+='<div class="qrow"><span class="qico">✨</span><span class="qmain"><b>Running wild this season</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'
   +(coats.length?coats.map(c=>c.variant+(c.region?' — only the '+c.region+' herd':'')).join('<br>'):'nothing seasonal out there just now')
   +'</span></span></div>';
  return html;
 }});
 W.addBoard({k:'life_hunt',g:'hobby',label:'Season pieces found',rate:2.2});
 W.addBoard({k:'bountyhome',g:'ranch',label:'Strays brought in',rate:0.3,val:s=>((s.bounty&&s.bounty.home)||0)});
 Q.addAch({id:'hunt24',icon:'🥚',label:'Basin forager',desc:'Find 24 hidden season pieces',v:s=>(s.life&&s.life.hunt)||0,goal:24,r:{c:500,g:2}});
 Q.addAch({id:'huntset',icon:'🏮',label:'Clean sweep',desc:'Find every piece of one week\'s hunt',v:s=>(s.hunt&&s.hunt.sets)||0,goal:1,r:{c:400,g:3,k:1}});
 Q.addAch({id:'bounty5',icon:'🪢',label:'Basin regulator',desc:'Bring in 5 strays from the bounty board',v:s=>(s.bounty&&s.bounty.home)||0,goal:5,r:{c:600,g:3,k:1}});
 Q.addDaily({type:'hunt',icon:'🥚',label:'Find 4 hidden season pieces',goal:4,r:{c:180,p:20}});
 Q.addDaily({type:'bounty',icon:'🪢',label:'Bring a stray back to the bounty board',goal:1,r:{c:220,p:25}});

 /* ================= 7. the seam with seasons.js, the frame pass, boot ================= */
 /* A's special-event card asks who owns this season's headline activity. Answer for our own hunt
    ids AND for the bare season ids, because the card's registry is A's to name and we cannot see
    it from here. G.run takes the first truthy answer, so returning undefined is how a package
    politely declines a question meant for somebody else. */
 const specialOf=key=>HUNTS.find(h=>h.def.id===key||(h.def.season===key&&h.def.season===seasonId()))||null;
 P.specialIds=()=>HUNTS.map(h=>h.def.id).concat(Object.keys(WILD_SEASON));
 P.starts=0;
 G.on('specialStatus',key=>{
  const h=specialOf(key); if(!h)return undefined;
  const d=h.def, got=(((S.fresh()||{}).hunt||{}).got||{})[d.id]||[];
  if(d.gated&&!P.open[d.id])return d.glyph+' <b>'+d.label+'</b> — 🔒 '+d.locked;
  if(!h.live)return d.glyph+' <b>'+d.label+'</b> — waiting for its season';
  return d.glyph+' <b>'+d.label+'</b> — '+got.length+'/'+d.n+' found this week · '+M.rewardLabel(d.pay)+' each';
 });
 G.on('specialStart',key=>{
  const h=specialOf(key); if(!h)return undefined;
  P.starts++;
  if(h.def.gated&&!P.open[h.def.id]){toast(h.def.glyph+' '+h.def.locked);return true;}
  if(!h.live){toast(h.def.glyph+' '+h.def.label+' runs in its own season.');return true;}
  const near=h.items.filter(i=>!i.got).sort((a,b)=>hyp(player.pos.x,player.pos.z,a.x,a.z)-hyp(player.pos.x,player.pos.z,b.x,b.z))[0];
  toast(near?h.def.glyph+' Nearest '+h.def.noun+': '+Math.round(hyp(player.pos.x,player.pos.z,near.x,near.z))+' m '+compassTo(near.x-player.pos.x,near.z-player.pos.z)+' — press M for the quarters.'
            :h.def.glyph+' Every '+h.def.noun+' is in. New spots on Monday.');
  return true;
 });
 let slowT=0;
 G.on('tick',dt=>{
  tickBounties(dt);
  slowT+=dt; if(slowT>5){slowT=0;refresh();}
 });
 G.on('seasonRoll',()=>{applyCoats();refresh(true);refreshCoatMarks();});
 G.on('interval30',()=>{refresh();refreshBounties();refreshCoatMarks();});
 G.on('state',o=>{
  const s=S.fresh()||{}, got=(s.hunt&&s.hunt.got)||{};
  o.hunt={season:seasonId(),week:(s.hunt&&s.hunt.seed)||'',sets:(s.hunt&&s.hunt.sets)||0,
   live:HUNTS.filter(h=>h.live).map(h=>({id:h.def.id,n:h.def.n,placed:h.items.length,got:(got[h.def.id]||[]).length,
    zones:h.items.filter(i=>!i.got).map(i=>i.zone).filter((v,i,a)=>a.indexOf(v)===i)})),
   locked:HUNTS.filter(h=>h.def.gated&&!P.open[h.def.id]).map(h=>h.def.id),
   bounty:{post:[Math.round(POST.x),Math.round(POST.z)],home:(s.bounty&&s.bounty.home)||0,kept:(s.bounty&&s.bounty.kept)||0,
    open:bounties.filter(b=>!b.done).map(b=>({name:b.name,zone:b.zone.id,found:!!b.found,haltered:!!b.haltered,
     settle:Math.round(b.settle),at:[Math.round(b.pos.x),Math.round(b.pos.z)]}))},
   coats:liveCoats().map(w=>({variant:w.variant,breed:w.breed,region:w.region||null}))};
 });
 G.on('boot',()=>{
  applyCoats();
  try{buildPost();}catch(e){console.error('bounty post',e);}
  buildCoatMarks();
  refresh(true); refreshBounties(true); refreshCoatMarks();
  const s=S.fresh();
  if(s&&S.flag(s,'seen-hunts')){
   S.sync(sv=>{sv.flags=sv.flags||{};sv.flags['seen-hunts']=1;});
   setTimeout(()=>{try{const h=HUNTS.find(x=>x.live);
    toast(h?h.def.glyph+' '+h.def.label+' is on — '+h.def.n+' hidden across the basin, and a bounty board by the ranch gate.'
           :'📜 There is a bounty board by the ranch gate now — horses get loose out here.');}catch(e){}},9000);
  }
 });
 Object.assign(P,{HUNTS,ZONES,makeHunt,refresh,applyCoats,rollBounties,refreshBounties,openBoard,handOver,payBounty,halter,post:()=>POST,WILD_SEASON});
}
