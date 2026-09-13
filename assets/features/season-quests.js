/* Feature package 'season-quests' — the narrative and allegiance half of a season.

   Three things live here, and they lean on each other:

     · THE ALMANAC.  Wick walks the Basin four times a year and writes down what it did.
       Each season he is filling a different book, and each book is four entries long — one
       short questline that starts over when the season turns, given and turned in at the man
       himself rather than through the main story's single cursor.  The ember book ends by
       lighting the valley's lanterns, which is season-hunts' business, so it asks that
       package rather than doing it.
     · FOUR HOUSES.  Cottonwood, Barleyfold, Coyote and Hollowpeak are the four venues the
       Championship already qualifies you at; they are houses now, and you pledge to one for
       the season.  Everything you earn on the season pass is your house's score as well as
       yours, there is a standing that counts the valley's own ranches alongside your club
       mates, and each house keeps a post out by its village that pays its own members a
       daily handful of season tokens.
     · ENCORES.  horse-roster already runs the encore pool — the Season Call carries the last
       three seasons' banner horses at 40%, and the seasonal summon banner is market's.  What
       was missing was anybody telling you.  This package reads both, says out loud which
       horse you missed is back and how long you have, and never mints a second copy of
       either system.

   Owned by this package: this file, s.house / s.seasonQ, the 'house' action namespace, the
   🛡️ Houses leaderboard tab, the 🗓️ Season quest tab, the housepost things and Wick.  It
   writes no pass tier, no shop tab and no season store — those belong to 'seasons'.  Season
   tokens are only ever minted through payReward, so the carry-over rule stays in one place.
   Nothing runs at import time. */
export const id='season-quests';

/* The four houses. Each is a place that already exists in the valley with somebody already
   living in it, which is why the pledge screen can name a person: you are not joining a
   faction, you are telling Ada you ride for Cottonwood this season. */
const HOUSES=[
 {id:'cottonwood',name:'House Cottonwood',emoji:'🌳',col:'#7fb069',npc:'ada',town:'Cottonwood Village',
  x:44,z:-36,motto:'Gardeners and ribbon-winners.',
  blurb:'Ada keeps the village books and expects them balanced. Cottonwood wins seasons by turning up to everything and losing nothing.'},
 {id:'barleyfold',name:'House Barleyfold',emoji:'🌾',col:'#d9a441',npc:'otto',town:'Barleyfold Farms',
  x:214,z:-94,motto:'Farmers. They count a season in hay bales.',
  blurb:'Otto has never once been early and has never once been short. Barleyfold starts every season last and is usually there at the end of it.'},
 {id:'coyote',name:'House Coyote',emoji:'🌵',col:'#c96a3a',npc:'bea',town:'Coyote Canyon',
  x:-204,z:126,motto:'Riders who like the far end of the map.',
  blurb:'Bea signs the pledge with a thumbprint and no ceremony. Nobody in Coyote has ever explained what the house is for and nobody has ever left it.'},
 {id:'hollowpeak',name:'House Hollowpeak',emoji:'❄️',col:'#9fd8f2',npc:'ilse',town:'Hollowpeak',
  x:-144,z:-194,motto:'Snow readers. The smallest house.',
  blurb:'Ilse takes four riders a season and turns away the fifth. Hollowpeak has finished first twice and last five times, which she says is the same thing over a long enough winter.'},
];
const POST_TOK=10, POST_PASS=20;          // what a house post pays its own members, once a day
const GAUNTLET_HOUSE=25;                  // house points per ribbon star on the seasonal gauntlet

/* The almanac. One book a season, four entries, each counted off a moment the game already
   reports through dailyEvt — so a book never needs its own bookkeeping in the world, and a
   player who is simply playing is filling it without being told to. */
const BOOKS={
 bloom:{title:'The Foaling Book',emoji:'🌸',
  open:'Blossom three days early and nobody has written down where. I am four entries behind already.',
  done:'Foaling book closed. Earliest bloom in nine years and the only proof is your handwriting on my page.',
  entries:[
   {evt:'gallop',goal:900,label:'Walk the orchard line — 900 m at a gallop',reward:{c:220,tok:6,p:30},
    text:'The blossom came early and I have nobody to blame but the weather. Ride the orchard line for me — nine hundred metres, flat out, and do not stop to admire it. Admiring it is how it gets trampled.'},
   {evt:'groom',goal:4,label:'Strip four winter coats',reward:{c:260,tok:6,p:35,items:{carrot:3}},
    text:'Every horse in the Basin is shedding at once and the hedges are full of hair. Groom four of them properly. I am counting nests this year, not horses, and the birds do better out of a bad spring than we do.'},
   {evt:'feed',goal:6,label:'Six treats, given honestly',reward:{c:300,tok:8,p:40,g:1},
    text:'A horse decides in spring what it thinks of people and does not revisit the question until the next one. Six treats. Not thrown — given.'},
   {evt:'event',goal:2,label:'Two events ridden in the bloom',reward:{c:450,tok:12,p:60,g:2},
    text:'The last line of a spring entry is always the same: what the valley did with the good weather while it had it. Ride two events and I will be able to write down that somebody did something.'},
  ]},
 sun:{title:'The Water Book',emoji:'☀️',
  open:'Long Sun. The lake is down a foot, the passes are open, and I have six weeks of notes to make in four.',
  done:'Water book closed, and closed honestly. The lake was down eleven inches and I have a witness.',
  entries:[
   {evt:'fish',goal:3,label:'Three fish out of Loon Lake',reward:{c:240,tok:6,p:30},
    text:'The lake drops a foot in the Long Sun and everything in it turns suspicious. Three fish. Old Rook will tell you it takes patience; what it takes is not talking.'},
   {evt:'trail',goal:1,label:'One trail ride, end to end',reward:{c:280,tok:7,p:35,items:{apple:3}},
    text:'I want the trail written down while the passes are open. Ride one end to end — every stop, no shortcuts. The shortcut is in the book already and it is wrong.'},
   {evt:'gallop',goal:1500,label:'Fifteen hundred metres of open ground',reward:{c:320,tok:8,p:40,g:1},
    text:'Heat makes a horse honest about its fitness in a way that no amount of schooling does. Fifteen hundred metres of open ground, and afterwards you will both know exactly where you stand.'},
   {evt:'event',goal:2,label:'Two events under the Long Sun',reward:{c:480,tok:12,p:60,g:2},
    text:'Anybody can ride in April. Two events in this heat, and I will note down who turned up — which in most years is a shorter list than you would like.'},
  ]},
 ember:{title:'The Lantern Book',emoji:'🍂',
  open:'The woods turn over about nine days and then it is done for a year. I would like the lanterns lit before it is.',
  done:'Lantern book closed and the lamps are up. That is the valley\'s doing, not mine — I only keep the tally.',
  unlock:'lantern',
  entries:[
   {evt:'photo',goal:2,label:'Two photographs of the turn',reward:{c:250,tok:6,p:30},
    text:'The woods turn over about nine days and then it is finished for a year. Two photographs — I do not much care what of, only that they are this week and not last.'},
   {evt:'cleanjump',goal:8,label:'Eight clean jumps before the ground goes',reward:{c:300,tok:7,p:35},
    text:'Ember ground is the best you will ever jump on and it lasts a fortnight. Eight clean, while it holds. After the first frost you will be wishing you had.'},
   {evt:'pet',goal:5,label:'Five horses, a hand on each',reward:{c:340,tok:8,p:40,g:1},
    text:'Horses go strange in the ember light — they stand at the fence at dusk looking at nothing at all. Go and put a hand on five of them. It is not sentiment; it is how you find out one of them is sick.'},
   {evt:'event',goal:2,label:'Two events before the frost',reward:{c:520,tok:14,p:70,g:2},
    text:'Then the lanterns. I do not light them — that is the valley\'s job and the valley has to have earned it. Two events, and the lamps go up along the water.'},
  ]},
 frost:{title:'The Long Night Book',emoji:'❄️',
  open:'Short days, long entries. The frost book is the one nobody has ever finished for me.',
  done:'Four years I have carried that last page. Ten clean on frozen ground. Signed and dated.',
  entries:[
   {evt:'groom',goal:5,label:'Five winter grooms, down to the skin',reward:{c:260,tok:6,p:30},
    text:'A frosted coat looks magnificent and hides everything underneath it. Five grooms, down to the skin, and tell me if you turn up anything I ought to write down.'},
   {evt:'feed',goal:8,label:'Eight hard feeds',reward:{c:320,tok:7,p:35,items:{oats:2}},
    text:'Cold costs a horse more than work does, and it costs it quietly. Eight feeds. If you think that sounds generous you have not wintered here.'},
   {evt:'event',goal:3,label:'Three events in the dark half of the year',reward:{c:420,tok:10,p:50,g:1},
    text:'The frost season is short on daylight and long on excuses. Three events. I will take the results either way — it is the turning up I am recording.'},
   {evt:'cleanjump',goal:10,label:'Ten clean jumps on frozen ground',reward:{c:600,tok:16,p:80,g:3},
    text:'Last page. Ten clean with the ground like iron. That is the entry I have been trying to make for four years and not one rider in this valley has ever finished it.'},
  ]},
};
const WICK={id:'almanac',name:'Wick the Almanac-Keeper',icon:'🗓️',hat:'#6a5a4a',shirt:'#4a6a7a',
 idle:'Four times a year I walk the Basin end to end and write down what it did. It has never once done the same thing twice.'};

export function install(G){
 const {$,toast,THREE}=G; const S=G.save, Q=G.quest, T=G.tables, W=G.world, M=G.money, U=G.ui, N=G.net;
 const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const fresh=()=>S.fresh()||{};
 const houseOf=id=>HOUSES.find(h=>h.id===id)||null;
 /* seasonNow() allocates, and the save ensure below runs on every read and every write, so
    the season key is cached and refreshed at the three moments it can possibly change. */
 let SKEY='', SDEF=T.SEASONS[0]||{id:'bloom',name:'Season',emoji:'🌸',tint:'#f2a0c8'}, SN=null;
 function refreshSeason(){ try{ SN=G.time.seasonNow(); SKEY=SN.key; SDEF=SN.def||SDEF; }catch(e){} return SN; }
 refreshSeason();
 const book=()=>BOOKS[SDEF.id]||BOOKS.bloom;
 /* What the per-frame code needs to know without reading the save every frame: the minimap
    loop asks whether a post is yours on every draw, and dailyEvt fires for every stride of a
    gallop, so both of those answer out of here rather than out of localStorage. */
 const CUR={house:null,evt:null,goal:0,idx:0,done:false};
 const repaint=id=>{ try{ const p=$(id); if(!p||p.style.display!=='flex')return;
  if(id==='lbPanel')U.renderLB(); else if(id==='questPanel')U.renderQuests(); else U.rerender(id); }catch(e){} };

 /* ---------- save shape ----------------------------------------------------------------
    Both subtrees are per season and both are cleared by comparing keys rather than by
    listening for the roll, because a player who was away for the whole of a season never
    sees 'seasonRoll' fire at all — they simply come back to a different key. */
 S.ensure(s=>{
  s.house=s.house||{id:null,key:SKEY,pts:0,seen:0,posts:{}};
  if(s.house.key!==SKEY)s.house={id:null,key:SKEY,pts:0,seen:0,posts:{}};
  s.house.posts=s.house.posts||{};
  s.seasonQ=s.seasonQ||{key:SKEY,idx:0,prog:0,claimed:{},unlocked:false,met:false};
  if(s.seasonQ.key!==SKEY)s.seasonQ={key:SKEY,idx:0,prog:0,claimed:{},unlocked:false,met:false};
 });

 /* ---------- houses: points, the pledge, the standing ---------------------------------- */
 /* passAdd has no hook of its own, so house points are a watermark diff against the season
    pass rather than a running total: whatever the pass gained since we last looked, the house
    gained too. Cheap, impossible to double-count, and one interval behind at worst. */
 function credit(s){
  if(!s||!s.house||!s.house.id)return 0;
  const pts=(s.pass&&s.pass.pts)||0, seen=s.house.seen||0;
  if(pts<=seen){ s.house.seen=pts; return 0; }      // a season roll takes the pass back to zero; follow it down rather than banking the drop
  const d=pts-seen; s.house.pts=(s.house.pts||0)+d; s.house.seen=pts; return d;
 }
 function bonus(s,n){ if(!s||!s.house||!s.house.id||!(n>0))return 0; s.house.pts=(s.house.pts||0)+n; return n; }
 function myHouse(s){ const h=(s||fresh()).house; return h&&h.id?houseOf(h.id):null; }
 function pledge(hid){
  const h=houseOf(hid); if(!h)return false;
  let ok=false, already=null;
  S.sync(s=>{
   if(s.house.id){already=s.house.id;return;}
   /* Everything already earned this season goes with you — pledging late costs you nothing,
      which is the whole reason anybody pledges at all. */
   s.house.id=h.id; s.house.pts=(s.pass&&s.pass.pts)||0; s.house.seen=s.house.pts; ok=true;
  });
  if(already){ toast('🛡️ You already ride for '+(houseOf(already)||{}).name+' this season. It settles at the turn.'); return false; }
  if(!ok)return false;
  CUR.house=h.id; try{G.sChime();}catch(e){}
  toast('🛡️ Pledged to '+h.name+' — '+h.emoji+' '+h.motto);
  publishHouse(); try{N.publishMyBoards();}catch(e){}
  return true;
 }
 /* The other ranches in the valley belong to houses too. Their allegiance is a hash of their
    name so it never moves, and their score is paced off the day of the season the same way
    the pass-tier board paces its neighbours — a board that is never empty and never hopeless. */
 function ihash(str){ let h=0x811c9dc5|0; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);} return ((h>>>8)&0xffff)/0xffff; }
 const REMOTE={};                                   // club mates who published a house over chat, name -> {h,p,at}
 function standings(s){
  s=s||fresh();
  const day=Math.max(1,(SN&&SN.day)||1);
  const rows=HOUSES.map(h=>({h,pts:0,riders:[]}));
  const at=hid=>rows.find(r=>r.h.id===hid);
  for(const [nm,str] of (T.NEIGHBOURS||[])){
   const r=rows[Math.floor(ihash(nm+'|house')*rows.length)%rows.length];
   r.pts+=Math.round(95*day*str*(0.55+0.9*ihash('house|'+nm))); r.riders.push(nm);
  }
  const now=performance.now();
  for(const nm in REMOTE){ const e=REMOTE[nm]; if(now-e.at>600000)continue; const r=at(e.h); if(!r)continue; r.pts+=Math.max(0,e.p|0); r.riders.push(nm); }
  const mine=s.house&&s.house.id?at(s.house.id):null;
  if(mine){ mine.pts+=(s.house.pts||0); mine.me=true; mine.riders.push('You'); }
  rows.sort((a,b)=>b.pts-a.pts);
  rows.forEach((r,i)=>{r.rank=i+1;});
  return rows;
 }
 /* Allegiance travels over the club's chat channel, the way world.js sends taming progress:
    not retained, so it only ever shows riders who are actually about, which is honest. */
 function publishHouse(){
  if(!N||!N.SOCIAL)return;
  const s=fresh(); if(!s.house||!s.house.id)return;
  try{N.sendChat('',{house:{h:s.house.id,p:Math.max(0,Math.round(s.house.pts||0))}});}catch(e){}
 }
 G.on('chat',(m,nm)=>{ if(m&&m.house&&typeof m.house==='object'){ const hid=String(m.house.h||'').slice(0,14);
   if(houseOf(hid))REMOTE[String(nm||'?').slice(0,14)]={h:hid,p:+m.house.p||0,at:performance.now()};
   return true; } });
 G.on('connect',()=>{ setTimeout(publishHouse,2200); });
 /* The house score is a board like any other, so it publishes over the club channel and gets
    a row on 🏅 Boards without this package writing a second ranking screen. */
 try{ W.addBoard({k:'housepts',g:'ranch',label:'House points this season',rate:60,cap:5200,val:s=>(s.house&&s.house.pts)||0}); }catch(e){}

 /* ---------- the house posts ------------------------------------------------------------
    One out by each village: a painted board on a post that pays its own members a handful of
    season tokens and a slice of pass progress once a day, and tells everybody else, politely,
    to go and find their own. */
 function clearOf(x,z,r){
  const cl=W.colliders||[];
  const hit=(px,pz)=>cl.some(c=>Math.hypot(px-c.x,pz-c.z)<(c.r||0)+r);
  if(!hit(x,z))return [x,z];
  for(let ring=1;ring<=4;ring++)for(let i=0;i<10;i++){
   const a=i/10*Math.PI*2, px=x+Math.cos(a)*ring*3.2, pz=z+Math.sin(a)*ring*3.2;
   if(!hit(px,pz))return [px,pz];
  }
  return [x,z];
 }
 function postMesh(h){
  const g=new THREE.Group();
  W.tube(0.12,0.14,2.6,'#7a6650',0,1.3,0,g);
  W.box(1.5,0.9,0.12,h.col,0,2.25,0,g);
  W.box(1.62,0.14,0.16,'#5a4a38',0,2.76,0,g);
  W.box(0.5,0.5,0.14,'#fff6e6',0,2.22,0.03,g);
  const tag=G.nameSprite(h.emoji+' '+h.name); tag.position.y=3.35; g.add(tag);
  return g;
 }
 const POSTS=[];
 for(const h of HOUSES){
  try{
   const [px,pz]=clearOf(h.x,h.z,2.2);
   const g=postMesh(h); g.position.set(px,W.groundH(px,pz),pz);
   g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   G.scene.add(g); try{W.followCamera.register(g);}catch(e){}
   const th=W.addThing({kind:'housepost',id:'house:'+h.id,house:h.id,g,x:px,z:pz,reach:4.2,
    label(){ const s=fresh(); const mine=s.house&&s.house.id;
     if(!mine)return h.emoji+' '+h.name+' — nobody has pledged here yet (E)';
     if(mine!==h.id)return h.emoji+' '+h.name+' — you ride for '+(houseOf(mine)||{}).name;
     return (s.house.posts||{})[h.id]===G.time.dateKey()?h.emoji+' Collected today — the post refills at midnight':h.emoji+' Collect from your house post (E)'; },
    use(){ collectPost(h); }});
   POSTS.push({h,x:px,z:pz,thing:th});
   W.mapMarkers.push({x:px,z:pz,glyph:'🛡️',label:h.name});
   W.miniMarkers.push({x:px,z:pz,col:h.col,hidden:()=>CUR.house!==h.id});
  }catch(e){ console.error('house post '+h.id,e); }
 }
 function collectPost(h){
  const s0=fresh(); const mine=s0.house&&s0.house.id;
  if(!mine){ toast('🛡️ Pledge to a house first — 🏅 Boards, the 🛡️ Houses tab.'); try{U.openLB();}catch(e){} return; }
  if(mine!==h.id){ toast('🛡️ '+h.name+' keeps this post for its own riders. Yours is at '+(houseOf(mine)||{}).town+'.'); return; }
  let paid=false;
  S.sync(s=>{ const dk=G.time.dateKey(); s.house.posts=s.house.posts||{};
   if(s.house.posts[h.id]===dk)return;
   s.house.posts[h.id]=dk; M.payReward(s,{tok:POST_TOK,p:POST_PASS}); credit(s); paid=true; });
  if(!paid){ toast('🛡️ Already collected today — the post refills at midnight.'); return; }
  M.refreshWallet(); try{G.sCoin();}catch(e){} Q.dailyEvt('housepost',1);
  toast(h.emoji+' '+h.name+' pays its own: +'+POST_TOK+'🎟️ +'+POST_PASS+' pass points');
  repaint('lbPanel');
 }

 /* ---------- Wick and the book ----------------------------------------------------------
    The main story is one list read at one cursor, so a seasonal chain cannot live in it: it
    would sit behind the whole of book two and it would never reset. Wick carries his own
    four entries instead, counted off dailyEvt and turned in at the man himself, which is
    what a player sees anyway. */
 const WICK_AT=clearOf(-18,-9,2.0);
 let wick=null;
 try{ wick=W.addNPC(Object.assign({},WICK,{x:WICK_AT[0],z:WICK_AT[1],
  extraHtml:s=>bookDialogue(s), onTalk:()=>{ S.sync(s=>{ if(!s.seasonQ.met){s.seasonQ.met=true;} }); }})); }
 catch(e){ console.error('almanac npc',e); }
 const entries=()=>book().entries;
 const entryAt=i=>entries()[i]||null;
 /* Which entry is open, held in memory so the hook below can decide in a string compare. */
 function syncCur(s){ const B=book(), i=((s||fresh()).seasonQ||{}).idx||0, c=B.entries[i];
  CUR.idx=i; CUR.done=!c; CUR.evt=c?c.evt:null; CUR.goal=c?c.goal:0; }
 let pend=0;
 function bookState(s){
  s=s||fresh(); const B=book(), q=s.seasonQ||{idx:0,prog:0};
  const i=Math.min(q.idx||0,B.entries.length), c=B.entries[i]||null;
  return {B,i,done:i>=B.entries.length,cur:c,prog:c?Math.min(c.goal,(q.prog||0)+pend):(q.prog||0),unlocked:!!q.unlocked};
 }
 /* Every moment the game already reports feeds the open entry, so nothing else in the world
    has to know a questline exists. dailyEvt fires once a frame for a gallop, though, and it
    already spends two syncSaves getting there — so distance is banked in memory and written
    back in twenty-metre lumps, and anything counted in whole numbers goes straight through. */
 function flushQ(){
  if(pend<=0||CUR.done)return false;
  const n=pend; pend=0; let crossed=null;
  S.sync(s=>{ const B=book(), c=B.entries[s.seasonQ.idx||0]; if(!c)return;
   const before=s.seasonQ.prog||0; if(before>=c.goal)return;
   s.seasonQ.prog=Math.min(c.goal,before+n); if(s.seasonQ.prog>=c.goal)crossed=c; });
  if(crossed)toast('🗓️ '+crossed.label+' — done. Wick keeps the almanac west of the ranch yard.');
  return !!crossed;
 }
 G.on('dailyEvt',(type,val)=>{
  if(CUR.done||type!==CUR.evt)return;
  const n=typeof val==='number'&&isFinite(val)?val:1;
  pend+=n; if(pend<(CUR.evt==='gallop'?20:1))return;
  flushQ();
 });
 function claimEntry(){
  flushQ();
  const st=bookState(); if(st.done||!st.cur)return false;
  if(st.prog<st.cur.goal){ toast('🗓️ '+st.cur.label+' — '+Math.floor(st.prog)+'/'+st.cur.goal+' so far.'); return false; }
  const B=st.B, was=st.i; let opened=false, paid=null;
  S.sync(s=>{ const c=B.entries[s.seasonQ.idx||0]; if(!c||(s.seasonQ.prog||0)<c.goal)return;
   const r=Object.assign({},c.reward); M.payReward(s,r); paid=r;
   s.seasonQ.claimed[String(s.seasonQ.idx||0)]=1; s.seasonQ.idx=(s.seasonQ.idx||0)+1; s.seasonQ.prog=0;
   if(s.seasonQ.idx>=B.entries.length&&!s.seasonQ.unlocked){ s.seasonQ.unlocked=true; opened=true; }
   credit(s); });
  if(!paid)return false;
  syncCur(); M.refreshWallet(); try{G.sGem();}catch(e){}
  toast('🗓️ '+B.entries[was].label+' — entered. +'+M.rewardLabel(paid));
  if(opened)finishBook(B);
  repaint('questPanel');
  return true;
 }
 /* Closing a book is the only seam this package has with season-hunts: it asks, it does not
    reach in, and an absent hunts package costs nothing but the extra line of toast. */
 function finishBook(B){
  Q.dailyEvt('sqbook',1);
  toast('📖 '+B.title+' is closed. '+B.done);
  if(B.unlock&&G.hunts&&typeof G.hunts.setOpen==='function'){
   try{ G.hunts.setOpen(B.unlock,true); }catch(e){ console.error('hunt unlock '+B.unlock,e); }
  }
 }
 function bookDialogue(s){
  const st=bookState(s), B=st.B;
  let h='<div style="font-size:11px;color:#8c7a63;letter-spacing:.04em">📖 '+esc(B.emoji+' '+B.title)+' · '+esc(SDEF.name)+'</div>';
  if(st.done)return h+'<p style="font-size:13px">'+esc(B.done)+'</p>'
   +'<span style="color:#8c7a63;font-size:12px">All four entries in. The next book opens when the season turns'+(SN?' — '+SN.daysLeft+' day'+(SN.daysLeft===1?'':'s')+'.':'.')+'</span><br><br>';
  const c=st.cur, ready=st.prog>=c.goal;
  h+='<p style="font-size:13px">'+esc(ready?'Good. Give me a moment to write it down.':c.text)+'</p>'
   +'<span style="color:#8c7a63;font-size:13px">🗓️ '+esc(c.label)+' ('+Math.floor(Math.min(st.prog,c.goal))+'/'+c.goal+') · entry '+(st.i+1)+' of '+B.entries.length+'</span><br>'
   +'<span style="color:#8c7a63;font-size:12px">Pays '+esc(M.rewardLabel(c.reward)||'—')+'</span><br><br>'
   +(ready?'<button class="claimBtn" data-fx="house:entry">Turn it in ✨</button> ':'')
   +'<button data-fx="house:quests">📜 The season book</button> ';
  return h;
 }

 /* ---------- encores --------------------------------------------------------------------
    horse-roster owns the Season Call and its returning pool, and market owns the seasonal
    summon banner. Neither of them tells you that a horse you missed two seasons ago is back
    in the pool this month, which is the only part a player would actually notice. */
 function encores(s){
  s=s||fresh();
  const R=G.horse&&G.horse.roster; if(!R||!R.seasonInfo||!SN)return [];
  const out=[], owned=new Set((s.horses||[]).map(h=>h.breed));
  for(let n=Math.max(0,SN.n-3);n<SN.n;n++){
   let I=null; try{I=R.seasonInfo(n);}catch(e){continue;}
   const key=I&&I.horses&&I.horses.banner; if(!key||out.some(o=>o.key===key))continue;
   out.push({key,n,def:I.def,label:(G.horse.breedLabel?G.horse.breedLabel(key):key),have:owned.has(key)});
  }
  return out;
 }
 function bannerRow(){
  const row=(T.SUMMON_TIERS||[]).find(t=>t.id==='limited'); if(!row)return null;
  let on=true; try{ on=typeof row.when==='function'?!!row.when():true; }catch(e){ on=false; }
  return on?row:null;
 }
 /* The pity and no-repeat counters belong to market's draw; this only reads them back so the
    season screen can say where you stand without a second ledger. */
 function bannerState(s){
  const row=bannerRow(); if(!row)return null;
  s=s||fresh(); const mk=s.mk||{};
  return {row,pity:((mk.pity||{})[row.id])||0,draws:((mk.draws||{})[row.id])||0};
 }
 function announceEncores(){
  const s=fresh(); const list=encores(s).filter(e=>!e.have); if(!list.length)return;
  /* If the spine package has already taken this job, stay quiet rather than toasting twice. */
  if(G.seasons&&(G.seasons.encores||G.seasons.announceEncores))return;
  const e=list[0]; let first=false;
  S.sync(sv=>{ first=S.flag(sv,'sq-encore-'+e.key+'-'+SKEY); });
  if(!first)return;
  setTimeout(()=>{ try{ toast('↩️ '+e.label+' is back — it was '+e.def.emoji+' '+e.def.name+'\'s horse and the Season Call is carrying it again.'); }catch(x){} },2600);
 }

 /* ---------- the 🛡️ Houses leaderboard tab ---------------------------------------------- */
 const medal=i=>i===0?'👑':i===1?'🥈':i===2?'🥉':'#'+(i+1);
 U.lbTab({id:'house',label:'🛡️ Houses',pos:5,render(s){
  if(!s)return '';
  S.sync(sv=>{credit(sv);});
  s=fresh();
  const mine=myHouse(s), rows=standings(s), me=mine?rows.find(r=>r.h.id===mine.id):null;
  let h='<div class="passCard"><div class="ph"><b>🛡️ The four houses · '+esc(SDEF.emoji+' '+SDEF.name)+'</b>'
   +'<span style="font-size:11px;color:#8c7a63">'+(SN?'day '+SN.day+' · '+SN.daysLeft+' day'+(SN.daysLeft===1?'':'s')+' to the count':'')+'</span></div>'
   +'<div class="sub">Pledge to one house for the season. Every point you put on the season pass is your house\'s as well as yours, and the post out by your village pays its own riders '+POST_TOK+'🎟️ a day. The pledge clears when the season turns and you may swap then — not before.</div></div>';
  if(mine){
   h+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">'+esc(mine.emoji+' '+mine.name)+' · '+(me?'#'+me.rank+' of 4':'')+'</b>'
    +'<span style="width:100%;font-size:11.5px;color:#6b5a45">'+esc(mine.blurb)+'</span>'
    +'<span class="bE me">🛡️ '+Math.round(s.house.pts||0)+' your points</span>'
    +'<span class="bE">🎟️ post at '+esc(mine.town)+'</span>'
    +'<span class="bE">'+((s.house.posts||{})[mine.id]===G.time.dateKey()?'✅ collected today':'▫️ post not collected')+'</span></div>';
  }else{
   h+='<div class="bGroup">Pledge for '+esc(SDEF.name)+'</div>';
   h+=HOUSES.map(x=>'<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">'+esc(x.emoji+' '+x.name)+'</b>'
    +'<span style="width:100%;font-size:11.5px;color:#6b5a45">'+esc(x.blurb)+'</span>'
    +'<span style="font-size:11px;color:#8c7a63">'+esc(x.town)+'</span>'
    +'<button class="claimBtn" data-fx="house:pledge:'+x.id+'">Ride for '+esc(x.name.replace('House ',''))+'</button></div>').join('');
  }
  h+='<div class="bGroup">The standing</div>'
   +'<div style="font-size:11px;color:#8c7a63;margin-bottom:3px">The valley\'s own ranches are counted in — they pledge too, and their allegiance does not move from one season to the next. Club mates appear while they are riding.</div>';
  h+=rows.map((r,i)=>'<div class="clubRow'+(r.me?' me':'')+'">'+medal(i)+' <b>'+esc(r.h.emoji+' '+r.h.name)+'</b>'
   +'<span style="margin-left:auto;font-weight:700">'+(r.pts>=10000?(Math.round(r.pts/100)/10)+'k':r.pts)+'</span>'
   +'<span style="flex-basis:100%;font-size:11px;color:#8c7a63">'+esc(r.riders.slice(0,4).join(', '))+(r.riders.length>4?' +'+(r.riders.length-4)+' more':'')+'</span></div>').join('');
  h+='<div class="bGroup">What feeds a house</div>'
   +'<div class="evrow"><span>🎟️ Season pass points</span><span style="margin-left:auto">1 for 1, while you are pledged</span></div>'
   +'<div class="evrow"><span>🐉 The seasonal gauntlet</span><span style="margin-left:auto">'+GAUNTLET_HOUSE+' a ribbon star</span></div>'
   +'<div class="evrow"><span>🛡️ Your house post</span><span style="margin-left:auto">'+POST_PASS+' pass points a day</span></div>';
  return h;
 }});

 /* ---------- the 🗓️ Season quest tab ----------------------------------------------------- */
 U.questTab({id:'season',label:'🗓️ Season',pos:2,render(s){
  if(!s)return '';
  const st=bookState(s), B=st.B, mine=myHouse(s), bs=bannerState(s), enc=encores(s);
  let h='<div class="passCard"><div class="ph"><b>'+esc(B.emoji+' '+B.title)+'</b>'
   +'<span style="font-size:11px;color:#8c7a63">'+esc(SDEF.name)+(SN?' · '+SN.daysLeft+' day'+(SN.daysLeft===1?'':'s')+' left':'')+'</span></div>'
   +'<div class="sub">'+esc(st.done?B.done:B.open)+'</div>'
   +'<div class="sub" style="margin-top:4px">Wick keeps the almanac at the ranch, west of the yard. Four entries a season; the book starts again when the season turns.</div></div>';
  h+=B.entries.map((c,i)=>{
   const done=i<st.i, open=i===st.i, prog=open?Math.min(st.prog,c.goal):done?c.goal:0;
   return '<div class="qrow'+(done?' claimed':open&&prog>=c.goal?' done':'')+'"><span class="qico">'+(done?'✅':open?'🗓️':'🔒')+'</span>'
    +'<span class="qmain"><b>'+esc(c.label)+'</b>'
    +(open?'<span style="font-size:11px;color:#8c7a63;font-weight:600">'+esc(c.text)+'</span>':'')
    +'<span class="qbar"><span class="qfill" style="width:'+Math.round(100*prog/c.goal)+'%"></span></span></span>'
    +'<span style="font-size:11px;color:#8c7a63">'+Math.floor(prog)+'/'+c.goal+'</span>'
    +(open&&prog>=c.goal?'<button class="claimBtn" data-fx="house:entry">Turn in</button>':'<span style="font-size:11px;color:#b8a888">'+esc(M.rewardLabel(c.reward)||'')+'</span>')+'</div>';
  }).join('');
  h+='<div class="bGroup">Your house</div>';
  h+=mine?'<div class="evrow"><b>'+esc(mine.emoji+' '+mine.name)+'</b><span>'+Math.round((s.house&&s.house.pts)||0)+' house points this season</span><button data-fx="house:lb">🛡️ Standing</button></div>'
        :'<div class="evrow"><span>No pledge yet — four houses are taking riders for '+esc(SDEF.name)+'.</span><button class="claimBtn" data-fx="house:lb">🛡️ Pledge</button></div>';
  /* Encores and the banner: both of these are other packages' machinery, read and reported. */
  h+='<div class="bGroup">Back this season</div>';
  if(bs){
   h+='<div class="evrow" style="flex-wrap:wrap"><b style="width:100%">'+esc(bs.row.emoji+' '+bs.row.label)+'</b>'
    +'<span style="width:100%;font-size:11.5px;color:#6b5a45">'+esc(bs.row.blurb||'')+'</span>'
    +'<span class="bE">'+(bs.row.pity?'pity '+bs.pity+'/'+bs.row.pity:'no pity counter')+'</span>'
    +(bs.row.nodup?'<span class="bE">no repeats for '+Math.max(0,bs.row.nodup-bs.draws)+' more calls</span>':'')
    +'<button data-fx="shop:summon">✨ Open it</button></div>';
  }
  if(enc.length){
   h+='<div style="font-size:11px;color:#8c7a63;margin:3px 0">Returning to the Season Call — horses from the last three seasons, in the pool again rather than gone for good.</div>';
   h+=enc.map(e=>'<div class="evrow"><span>'+(e.have?'✅':'↩️')+' <b>'+esc(e.label)+'</b></span><span style="margin-left:auto;font-size:11px;color:#8c7a63">'+esc(e.def.emoji+' '+e.def.name)+(e.have?' · already yours':' · returning')+'</span></div>').join('');
  }else if(!bs){
   h+='<div style="font-size:11.5px;color:#8c7a63">Nothing returning yet — encores start once the Basin has a season behind it.</div>';
  }
  return h;
 }});

 /* ---------- actions -------------------------------------------------------------------- */
 U.action('house',(a)=>{
  const cmd=a[0];
  if(cmd==='pledge'){ if(pledge(a[1]))repaint('lbPanel'); return; }
  if(cmd==='entry'){ if(claimEntry()){ try{ if($('dlg')&&$('dlg').style.display==='block')G.openDlg(); }catch(e){} } return; }
  if(cmd==='lb'){ try{U.openLB();}catch(e){} return; }
  if(cmd==='quests'){ try{ if($('dlg'))$('dlg').style.display='none'; U.openQuests(); }catch(e){} return; }
 });

 /* ---------- hooks ----------------------------------------------------------------------- */
 /* passClaim and interval30 both hand over the save the 30-second pass is about to write, so
    crediting inside them costs nothing extra and lands with everything else. */
 G.on('passClaim',(sv)=>{ credit(sv); });
 G.on('interval30',(s)=>{ refreshSeason(); credit(s); syncCur(s);
  CUR.house=(s.house&&s.house.id)||null; if(CUR.house)publishHouse();
  setTimeout(flushQ,0); });                        // banked gallop metres, written on their own pass rather than nested inside this one
 /* The seasonal gauntlet is events-pvp's event and its course kind; the house layer only
    reads the result off the finish and pays its own points for it. */
 G.on('courseFinish',(o)=>{ try{ if(!o||!o.ev||o.ev.id!=='gt')return; const n=GAUNTLET_HOUSE*Math.max(1,o.stars||1);
   let got=0; S.sync(s=>{ got=bonus(s,n); }); if(got)toast('🛡️ +'+got+' house points from the gauntlet.'); }catch(e){} });
 G.on('seasonRoll',(s,prev,next)=>{
  refreshSeason();
  /* The engine has already replaced s.pass; both subtrees start over with it so the new
     season opens on an empty book and an unpledged rider. */
  s.house={id:null,key:next||SKEY,pts:0,seen:(s.pass&&s.pass.pts)||0,posts:{}};
  s.seasonQ={key:next||SKEY,idx:0,prog:0,claimed:{},unlocked:false,met:false};
  CUR.house=null; pend=0; syncCur(s);
  setTimeout(()=>{ try{ const B=BOOKS[SDEF.id]||BOOKS.bloom; toast('🗓️ '+B.emoji+' '+B.title+' — Wick is at the ranch with a fresh page.'); }catch(e){} },3400);
 });
 G.on('boot',()=>{
  refreshSeason();
  S.sync(s=>{ credit(s); CUR.house=(s.house&&s.house.id)||null; syncCur(s); });
  announceEncores();
 });
 G.on('state',o=>{
  const s=fresh(), st=bookState(s), rows=standings(s), mine=s.house&&s.house.id;
  o.house={id:mine||null,pts:Math.round((s.house&&s.house.pts)||0),
   rank:mine?(rows.find(r=>r.h.id===mine)||{}).rank||0:0,
   posts:Object.keys((s.house&&s.house.posts)||{}).length,
   quest:{book:st.B.title,season:SDEF.id,idx:st.i,goal:st.cur?st.cur.goal:0,prog:Math.floor(st.prog),
    done:st.done,unlocked:!!st.unlocked},
   encores:encores(s).filter(e=>!e.have).map(e=>e.key)};
 });

 /* ---------- the ledger nobody else keeps ------------------------------------------------ */
 Q.addDaily({type:'housepost',icon:'🛡️',label:'Collect from your house post',goal:1,r:{c:140,g:1,p:15}});
 Q.addAch({id:'sqpledge',icon:'🛡️',label:'Sworn in',desc:'Pledge to a house',v:s=>(s.house&&s.house.id)?1:0,goal:1,r:{c:200}});
 Q.addAch({id:'sqbook1',icon:'📖',label:'One for the almanac',desc:'Close one of Wick\'s season books',v:s=>((s.life||{}).sqbook)||0,goal:1,r:{c:400,g:2}});
 Q.addAch({id:'sqbook4',icon:'📚',label:'A year in the Basin',desc:'Close all four season books',v:s=>((s.life||{}).sqbook)||0,goal:4,r:{g:6,k:2}});
 Q.addAch({id:'sqhouse',icon:'🏰',label:'Pillar of the house',desc:'Put 2,000 points on your house in one season',v:s=>Math.round((s.house&&s.house.pts)||0),goal:2000,r:{g:4,k:1}});

 /* ---------- the seam the spine may or may not offer -------------------------------------
    'seasons' owns the special-event card and asks who wants the slot. It is being written
    alongside this file, so the answer is registered and forgotten: if nobody ever asks, none
    of this runs, and if they ask about somebody else's activity it falls through untouched. */
 const MINE=new Set(['questline','seasonquest','almanac','house','houses']);
 G.on('specialStatus',sid=>{ if(!MINE.has(String(sid)))return undefined;
  const st=bookState(); const s=fresh(); const mine=myHouse(s);
  return st.done?'📖 '+st.B.title+' closed · '+(mine?mine.emoji+' '+mine.name:'no house pledged')
   :'📖 '+st.B.title+' · entry '+(st.i+1)+' of '+st.B.entries.length+(st.cur?' — '+Math.floor(st.prog)+'/'+st.cur.goal:''); });
 G.on('specialStart',sid=>{ if(!MINE.has(String(sid)))return undefined; try{U.openQuests();}catch(e){} return true; });

 G.houses={HOUSES,BOOKS,houseOf,myHouse,pledge,standings,credit:()=>{let n=0;S.sync(s=>{n=credit(s);});return n;},
  bonus:n=>{let g=0;S.sync(s=>{g=bonus(s,n);});return g;},
  book,bookState,claimEntry,entryAt,entries,finish:finishBook,
  posts:POSTS,collectPost,wick:()=>wick,encores,bannerRow,bannerState,publishHouse,remotes:REMOTE,
  season:()=>({key:SKEY,def:SDEF,n:SN?SN.n:0,day:SN?SN.day:1})};
}
