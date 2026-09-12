/* Feature package 'story-quests'.
   The prologue and the story arc, side quests, the quest log, the detective / ribbon / builder
   quest patterns, six dailies and the umbrella, the NPC roster, and horse naming.

   Story shape. A prologue (era 1): you name a grey filly Grandpa Wren pulled out of the spring
   flood, ride with her, and lose her in a storm; two summers pass. Era 2 is the game as it was,
   braided into two tracks — 🔎 Search (the grey mare, chapter by chapter, region by region) and
   🏆 Qualify (ribbons, the Championship, the builder chapter) — with a book that arrives with each
   new season. Missions insert before an index once per save (s.mig tags), so an old save keeps
   its place. Nothing here runs at import time; everything happens inside install(G). */
export const id='story-quests';

const STARTER_COATS=[['bay','Bay','#765035','#221b16'],['grey','Dapple grey','#b9b9bd','#5a5a60'],['chestnut','Chestnut','#a0522d','#6b2f14']];
const SIDE_CAP=5;
const NATIVE_STORY=new Set(['carrots','cleanjump','gallop','event','forage','train','photo','tame','kestrel','visit','talk','guess','build','ranchlvl']);   // questEvt already hears these inline
const STORY_BRIDGE=new Set(['fish','shoe','ft','feed','groom','pet','water','wildphoto','trail','breed','side','talkn']);   // daily-reported moments the story can also count

export function install(G){
 const {$,toast,THREE}=G; const S=G.save, Q=G.quest, T=G.tables, W=G.world, H=G.horse, M=G.money, U=G.ui;
 const STORY=Q.STORY, NPC_DEFS=Q.NPC_DEFS, DAILYQ=Q.DAILYQ, ACHS=Q.ACHS;
 const QA=new URLSearchParams(location.search).get('qa'); const AUTO_NAME=!QA||QA==='story-quests';
 const fresh=()=>S.fresh()||{};
 const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const nowMs=()=>Date.now();

 /* ---------- save shape ---------- */
 S.ensure(s=>{
  s.story=s.story||{idx:0,prog:0};
  if(!s.story.era)s.story.era=1;
  if(s.story.name===undefined)s.story.name=null;
  s.story.clues=s.story.clues||[];
  s.side=s.side||{active:{},done:{},n:0};
  s.side.active=s.side.active||{}; s.side.done=s.side.done||{}; if(s.side.n==null)s.side.n=0;
  if(s.builderBonus==null)s.builderBonus=0;
  s.met=s.met||{};
  s.starterCoat=s.starterCoat||{id:'bay',chosen:false};
  if(s.named==null)s.named=true;
  if(s.keysGiven==null)s.keysGiven=true;
 });
 /* First look at this save: is it brand new (the prologue plays) or a returning player (the
    prologue is inserted behind them and the story jumps straight to era 2)? Decided before any
    mission is inserted, because storyInsertBefore moves a save that is at index 0. */
 let FRESH=false;
 S.sync(s=>{
  s.mig=s.mig||{}; if(s.mig['sq-init'])return; s.mig['sq-init']=1;
  const earned=(s.stats&&s.stats.earned)||0;
  FRESH=(s.story.idx||0)===0&&(s.story.prog||0)===0&&!earned&&(s.horses||[]).length<=1&&!(s.decor&&s.decor.length);
  if(FRESH){ s.mig['sq-prologue']=1; s.story.era=1; s.named=false; s.keysGiven=false; s.keys=0; s.starterCoat={id:'bay',chosen:false}; }
  else { s.story.era=2; s.named=true; s.keysGiven=true; }
 });

 /* ---------- small helpers ---------- */
 const idx=()=>Q.storyIdx(), prog=()=>Q.storyProg(), cur=()=>STORY[idx()];
 const npcDef=id=>NPC_DEFS.find(d=>d.id===id);
 const npcShort=id=>{const d=npcDef(id);return d?d.name.replace('Grandpa ','').replace('Farmer ','').replace('Sheriff ','').replace('Auntie ','').replace(' the Saddler','').replace('Old ',''):id;};
 const giverOf=m=>m?(m.npc||'wren'):'wren';
 function ribbonCount(s,disc){let n=0;const rb=(s&&s.ribbons)||{};for(const id in rb){const ev=T.EVENTS3.find(e=>e.id===id);if(!ev)continue;const d=ev.race?'race':ev.dressage?'dressage':'jump';if(disc==='any'||d===disc||(disc==='riding'&&d!=='jump'))n+=rb[id]||0;}return n;}
 const DISC_LBL={any:'',jump:'show-jumping ',race:'racing ',dressage:'dressage ',riding:'riding-event '};
 function ranchLevelOf(s){const p=(s.decor||[]).reduce((a,d)=>a+((T.DECOR_CAT[d.t]||{}).pts||0),0)+(s.builderBonus||0);let l=1;for(let i=1;i<T.RANCH_LEVELS.length;i++)if(p>=T.RANCH_LEVELS[i])l=i+1;return l;}
 function storyPct(){const m=cur();if(!STORY.length)return 0;return Math.min(100,Math.round(100*(idx()+(m?Math.min(1,prog()/m.goal):0))/STORY.length));}
 const chapterOf=m=>m.ch||(m.book||'The Home Meadow');
 function daysUntil(t){return Math.max(0,Math.ceil((t-nowMs())/864e5));}

 /* ---------- naming: a #dlg dialogue instead of prompt(), with dice and, for the starter, coats ---------- */
 function randName(){const s=fresh();const used=new Set((s.horses||[]).map(h=>h.name));const pool=T.NAMES3.filter(n=>!used.has(n));const p=pool.length?pool:T.NAMES3;return p[Math.floor(Math.random()*p.length)];}
 function nameDialog(o){
  o=o||{};
  if(G.renderer&&G.renderer.xr&&G.renderer.xr.isPresenting){const n=(o.def||randName()).slice(0,o.max||14);try{toast('🐴 Named '+n);}catch(e){}if(o.onDone)o.onDone(n,o.coat||null);return;}
  const d=$('dlg'); if(!d){if(o.onDone)o.onDone(o.def||randName(),o.coat||null);return;}
  const max=o.max||14; let coat=o.coat||(o.coats&&o.coats[0]&&o.coats[0][0])||null;
  d.innerHTML='<b>🐴 '+esc(o.title||'Name your horse')+'</b>'+(o.body?'<p>'+o.body+'</p>':'')
   +'<div style="display:flex;gap:6px;align-items:center;margin-top:4px"><input id="nameIn" maxlength="'+max+'" value="'+esc(o.def||randName())+'" style="flex:1;font-size:16px;padding:8px 10px;border-radius:12px;border:1px solid #d8ccb4;font-family:inherit"><button data-nm="rnd" title="A random name">🎲</button></div>'
   +(o.coats?'<div style="font-size:12px;color:#8c7a63;margin-top:10px;font-weight:700">Coat</div><div id="sqCoats" style="display:flex;gap:6px;flex-wrap:wrap">'+o.coats.map(c=>'<button data-nm="coat:'+c[0]+'" class="tabbtn'+(c[0]===coat?' on':'')+'" style="display:inline-flex;align-items:center;gap:6px;border:1px solid #d8ccb4"><span style="width:16px;height:16px;border-radius:50%;background:'+c[2]+';border:2px solid '+c[3]+'"></span>'+c[1]+'</button>').join('')+'</div>':'')
   +'<div style="display:flex;gap:6px;margin-top:10px"><button id="dlgBtn" class="claimBtn">'+esc(o.ok||'Name it ✨')+'</button>'+(o.cancel===false?'':'<button data-nm="x">'+esc(o.cancelLabel||'Later')+'</button>')+'</div>';
  d.style.display='block';
  const inp=$('nameIn'); try{inp.focus();inp.select();}catch(e){}
  const finish=(n,c)=>{try{inp.blur();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(e){}d.style.display='none';if(o.onDone)o.onDone(n,c);};   // blur first: the game ignores keys while an input has focus
  $('dlgBtn').onclick=()=>{const n=String(inp.value||'').trim().slice(0,max);if(!n){toast('Give the horse a name first!');try{inp.focus();}catch(e){}return;}finish(n,coat);};
  inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('dlgBtn').click();}e.stopPropagation();};
  d.querySelectorAll('[data-nm]').forEach(b=>{b.onclick=()=>{const v=b.dataset.nm;
   if(v==='rnd'){inp.value=randName();}
   else if(v==='x'){finish(null,coat);}
   else if(v.startsWith('coat:')){coat=v.slice(5);d.querySelectorAll('[data-nm^="coat:"]').forEach(x=>x.classList.toggle('on',x.dataset.nm===v));}
  };});
 }
 U.nameDialog=nameDialog;
 function applyStarterCoat(s,h,coatId){const c=STARTER_COATS.find(x=>x[0]===coatId);if(!c||!h)return;h.colors=h.colors||{};h.colors.body=c[2];h.colors.mane=c[3];s.starterCoat={id:c[0],chosen:true};}
 function setName(i,nm,coatId){
  let ok=false;
  S.sync(s=>{const h=s.horses[i];if(!h)return;h.name=nm;if(coatId&&h.breed==='bay-sporthorse')applyStarterCoat(s,h,coatId);s.named=true;s.stats=s.stats||{};s.stats.named=(s.stats.named||0)+1;ok=true;});
  if(!ok)return;
  const h=H.myHorses[i]; if(h)h.name=nm;
  if(i===H.rideIdx()){const ne=$('nameEl');if(ne)ne.textContent=nm+(h&&h.horn?' 🦄':'');}
  const sel=$('horseSel'); if(sel&&sel.options[i])sel.options[i].textContent='🐴 '+nm;
  try{H.reloadHorses();}catch(e){}
  toast('✏️ '+nm+' it is!');
 }
 /* Every horse that arrives gets a name from the player: shop, market, summon, taming, foals.
    grantHorse fires inside syncSave, so the dialogue is queued and opened from the tick. */
 const pendingNames=[];
 G.on('grantHorse',(s,h,opts)=>{opts=opts||{};if(!AUTO_NAME||opts.src==='qa'||opts.noName||opts.silent)return;pendingNames.push({id:h.id,def:h.name,breed:h.breed});});
 function flushPendingName(){
  if(!pendingNames.length)return; const d=$('dlg'); if(d&&d.style.display==='block')return;
  const p=pendingNames.shift(); const s=fresh(); const i=(s.horses||[]).findIndex(h=>h.id===p.id); if(i<0)return;
  nameDialog({title:'A new arrival',body:'<b>'+esc(p.def)+'</b> the '+esc(H.breedLabel?H.breedLabel(p.breed):p.breed)+' has joined the ranch. What will you call '+(s.horses[i].sex==='m'?'him':'her')+'?',def:p.def,onDone:n=>{if(n&&n!==p.def)setName(i,n);}});
 }

 /* ---------- the roster: people who front a system, riders with their own horses ---------- */
 const ROSTER=[
  {id:'june',name:'Auntie June',icon:'🎪',x:9,z:-9,hat:'#b04a4a',shirt:'#e8c76a',idle:'Every horse in the Basin passed through my auction tent once, kiddo — including your grandmother\'s. Come see what\'s on the block.',role:{open:'market',label:'🤝 Open the market'},region:'Meadowlark Ranch'},
  {id:'bram',name:'Bram the Saddler',icon:'🧵',x:44,z:-46,hat:'#4a3a2a',shirt:'#7a6a9a',idle:'A saddle should sit like it grew there. Bring me anything that rubs and I\'ll set it right.',role:{open:'tack',label:'🐎 Open the saddlery'},region:'Cottonwood Village'},
  {id:'hesper',name:'Hesper',icon:'🐎',x:216,z:-104,hat:'#c9a56a',shirt:'#5a8a6a',idle:'Bloodlines are a story you write one foal at a time. Mind the mares — they know more than we do.',role:{open:'breed',label:'💞 The breeding barn'},region:'Barleyfold Farms'},
  {id:'rook',name:'Old Rook',icon:'🎣',x:26,z:22,hat:'#3a4a5a',shirt:'#8a7a5a',idle:'Loon Lake gives up a fish to anyone who can stand still long enough. Most can\'t.',region:'Loon Lake'},
  {id:'tamsin',name:'Tamsin',icon:'🧗',x:-144,z:-216,hat:'#2a5a3a',shirt:'#c96a3a',idle:'I keep the trail count up here — every eagle, every fox, every hoofprint in the spray. Bring me pictures.',region:'Hollowpeak Falls'},
 ];
 const RIDERS=[{id:'mia',name:'Mia',icon:'👧',horse:'Comet',idle:'Comet and I ride the arena loop every morning. He\'s a chestnut with a sweet tooth — watch your oranges!',region:'Home Pasture'},
               {id:'theo',name:'Theo',icon:'🧒',horse:'Pepper',idle:'Pepper is the smallest pony in the Basin and the bossiest. She never leaves the arena after dark.',region:'Home Pasture'}];
 for(const d of ROSTER)W.addNPC(d);
 /* Mia and Theo already ride the arena as visitors; they become people to talk to wherever they
    happen to be by pointing a talk entry at the visitor's moving group. */
 RIDERS.forEach((d,i)=>{const v=W.visitors[i]; Object.assign(d,{x:0,z:0,rider:true}); NPC_DEFS.push(d); if(v&&v.parts&&v.parts.group)W.npcList.push({def:d,g:v.parts.group});});
 const REGION_OF={wren:'Meadowlark Ranch',ada:'Cottonwood Village',otto:'Barleyfold Farms',bea:'Coyote Canyon',ilse:'Hollowpeak'};
 for(const d of ROSTER.concat(RIDERS))REGION_OF[d.id]=d.region;
 const ROLE_LBL={june:'auction & market · Silver Keys',bram:'saddler',hesper:'breeder',rook:'angler',tamsin:'ranger',mia:'rider · Comet',theo:'rider · Pepper',wren:'your grandfather',ada:'village gardener',otto:'farmer',bea:'sheriff',ilse:'snow reader'};
 const wren=npcDef('wren'); if(wren)wren.idle='We pulled that grey filly out of the spring flood as a yearling, you know. Half drowned and silver as the moon. Fine day for a ride, kiddo.';

 /* ---------- the prologue ---------- */
 const PRO='Prologue: The Spring Flood';
 const PROLOGUE=[
  {ch:PRO,book:'Prologue',track:'search',npc:'wren',label:'Name the grey foal',type:'name',goal:1,reward:{c:50,items:{carrot:3}},text:'Kiddo, come look at her. We pulled this grey filly out of the spring flood as a yearling — half drowned, silver as the moon, and she has not left your side since. She is yours to name.'},
  {ch:PRO,book:'Prologue',track:'search',npc:'wren',label:'Ride with {name}: gallop 300 m',type:'gallop',goal:300,reward:{c:80,xp:20},text:'{name} follows you like a shadow. Take her out — open up to a full gallop for 300 metres and let her run beside you. Mind the sky, though; there is weather coming off Hollowpeak.'},
  {ch:PRO,book:'Prologue',track:'search',npc:'wren',label:'The storm',type:'cine',goal:1,reward:{c:100},text:'That storm came in faster than any I have seen. She bolted into the rain and never came back. Two summers, and not a hoofprint. I am glad you are home, kiddo.'},
  {ch:PRO,book:'Prologue',track:'qualify',npc:'june',label:'Meet Auntie June at the auction tent',type:'talk',talk:'june',goal:1,reward:{c:80,items:{apple:2}},text:'There you are! Your grandmother left something with me for the day you came back: her Silver Key. There is an old stall by the barn it fits, and a bay horse waiting inside it.'},
  {ch:PRO,book:'Prologue',track:'qualify',npc:'wren',label:'Open the old stall',type:'door',door:'starter',goal:1,reward:{c:100,g:5,gear:'Common',items:{carrot:5,apple:2}},text:'June gave you the key? Then go and open that stall — the bay in there is yours, saddle and all. Give her a name and we will start you off properly: coins, a few gems, and a piece of tack from the locker.'},
 ];
 Q.story.insertBefore(0,PROLOGUE,'sq-prologue');
 const PRO_N=PROLOGUE.length;

 /* ---------- the braid: builder chapter, search interleaves, ribbon gates ---------- */
 const at=pred=>{const i=STORY.findIndex(pred);return i<0?STORY.length:i;};   // a missing anchor appends instead of splicing at -1
 const BUILDER=[
  {ch:'Build It Back Up Again',track:'qualify',npc:'wren',label:'Place 3 fence sections',type:'build',item:'fence',goal:3,reward:{c:150,pts:12},text:'The ranch has gone to seed while you were away. Open 🏗️ Build and put up three fence sections wherever the pasture wants them — I will pay you builder points for every one.'},
  {ch:'Build It Back Up Again',track:'qualify',npc:'wren',label:'Place a lantern post and a water trough',type:'build2',goal:2,reward:{c:200,pts:20,items:{hay:3}},text:'Good fencing. Now something for the evenings: a lantern post, and a water trough so the horses stop drinking from the river. Both are in the Build catalogue.'},
  {ch:'Build It Back Up Again',track:'qualify',npc:'wren',label:'Reach ranch level 2',type:'ranchlvl',goal:2,reward:{c:250,g:1,pts:20},text:'Builder points add up to a ranch level, and the level does real things — slower hunger, faster XP. Keep placing pieces until Meadowlark reaches level 2.'},
  {ch:'Build It Back Up Again',track:'qualify',npc:'wren',label:'Brave Builder: place 10 pieces',type:'build',goal:10,reward:{c:400,g:2,pts:30,xp:60},text:'Your grandmother built this place with her own hands. Ten more pieces, any you like, and it will look like a ranch again. Brave builder!'},
 ];
 Q.story.insertBefore(at(m=>m.label==='Gallop 500 m'&&!m.ch),BUILDER,'sq-builder');
 const SEARCH1=[
  {ch:'A Silver Hair on the Gate',track:'search',npc:'wren',label:'Ask Mia and Theo about the grey mare',type:'clues',goal:3,clues:[{npc:'mia',text:'A grey horse? At dawn last week, drinking at the arena trough — no halter, no shoes, gone before Comet even snorted.'},{npc:'theo',text:'Pepper went mad one night, pacing the rail. In the morning there were prints in the arena sand twice the size of hers.'}],options:['A runaway from Barleyfold','{name} — she is alive, and close','One of Sheriff Bea\'s patrol horses'],answer:1,wrong:'Think about what they said: no halter, no shoes, and prints bigger than a pony\'s. Whose would those be?',reward:{c:200,g:1,xp:40},text:'Kiddo — Mia and Theo both swear they have seen a grey horse around the arena at night. Ask them what they saw, then come and tell me what you make of it.'},
  {ch:'A Silver Hair on the Gate',track:'search',npc:'wren',label:'Gallop 600 m along the river',type:'gallop',goal:600,reward:{c:180,sxp:{stamina:15}},text:'If she is alive she is running the river bottoms, where the grass is. Open up along the water and see if you cut her trail.'},
 ];
 Q.story.insertBefore(at(m=>m.label==='Visit Cottonwood Village'&&!m.ch),SEARCH1,'sq-search1');
 const SEARCH2=[
  {ch:'Hoofprints on the Bridge',track:'search',npc:'june',label:'Photograph the river bridge',type:'photo',goal:1,reward:{c:200,items:{lettuce:3}},text:'A carter swears a grey horse crossed the river bridge at dusk, silver in the last light. Take a photograph up there for me — proof, or the start of a good story.'},
  {ch:'Hoofprints on the Bridge',track:'search',npc:'june',label:'Fast travel to Loon Lake',type:'ft',goal:1,reward:{c:120},text:'She waters at Loon Lake, I would bet the tent on it. Open the map (M) and fast travel there before the light goes.'},
 ];
 Q.story.insertBefore(at(m=>m.label==='Tame a wild horse'&&!m.ch),SEARCH2,'sq-search2');
 const RIBBONS=[
  {ch:'Let the Show Begin',track:'qualify',npc:'ada',label:'Earn 5 show-jumping ribbons',type:'ribbons',disc:'jump',goal:5,reward:{c:350,g:2,xp:60},text:'The Basin Championship takes ribbons, not promises. Five show-jumping ribbons from the 🏆 Events board — each event pays up to four, so ride them clean.'},
  {ch:'Making a Name',track:'qualify',npc:'ada',label:'Earn 15 ribbons of any kind',type:'ribbons',disc:'any',goal:15,reward:{c:500,g:3,sxp:{speed:20},gear:'Rare'},text:'People are starting to say your name in the village. Fifteen ribbons, any discipline, and they will say it at the Championship too.'},
  {ch:'Are You Qualified?',track:'qualify',npc:'wren',label:'Earn 12 riding-event ribbons (races & dressage)',type:'ribbons',disc:'riding',goal:12,reward:{c:700,g:3,xp:120},text:'The Final is not a jumping show, kiddo — it is a horse race with a test in it. Twelve ribbons from races and dressage tests, and I will put your name down myself.'},
 ];
 Q.story.insertBefore(at(m=>m.type==='event'&&m.ev==='w2'),RIBBONS,'sq-ribbons');

 /* Detective pattern: the two riddle missions become clue hunts across several people, and
    book two speaks the prologue horse's name. */
 for(const m of STORY){
  if(m.type==='guess'&&m.label==='Who trampled the flowerbed?'){Object.assign(m,{type:'clues',goal:4,clues:[{npc:'mia',text:'Comet was shod at Bram\'s last Tuesday — fresh iron on all four. He could not leave a bare print if he tried.'},{npc:'theo',text:'Pepper never leaves the arena after dark, and she is black to the roots. No grey hair on her.'},{npc:'bram',text:'I found a long grey hair on my gate the same morning. Unshod prints in the lane, too, and small — a mare, light on her feet.'}],options:['Mia\'s Comet (a shod chestnut)','Theo\'s Pepper (a black pony)','{name}, the grey mare herself'],answer:2});delete m.clue;}
  if(m.type==='guess'&&m.label==='Who raided the grove?'){Object.assign(m,{type:'clues',goal:4,clues:[{npc:'otto',text:'Mia buys oranges by the crate for that chestnut of hers. A horse with a sweet tooth learns where the trees are.'},{npc:'mia',text:'Comet slipped his halter two nights ago and came home sticky to the knees. I did not think anything of it…'},{npc:'june',text:'A coyote cannot open a gate latch, dear. Whatever got in there had hands — or a very clever pair of lips.'}],options:['Mia\'s Comet (a chestnut with a sweet tooth)','{name}, the grey mare','A coyote'],answer:0});delete m.clue;}
  if(m.ch==='Hoofprints at Dawn'&&m.type==='visit')m.text='Kiddo — at dusk last night I saw a grey horse drinking at Loon Lake, silver as the moon. Nobody\'s horse. Two summers, and I swear it was {name}. Ride down and look for her.';
  if(m.ch==='The Silver Kestrel'&&m.type==='kestrel'){m.label='Find and tame {name}';m.text='She is on the snowfield now — the grey the mountain calls the Silver Kestrel, the one you named {name}. Walk up slowly, no galloping, and stay near her. If she remembers you, she is yours.';}
  if(m.ch==='The Silver Kestrel'&&m.type==='talk'&&m.talk==='wren')m.text='You did it. Ride {name} home and tell your grandfather — he has waited longer than you know.';
  if(!m.track)m.track=(m.ch&&['Hoofprints at Dawn','The Cottonwood Ribbon','Barleyfold Whispers','Canyon Tracks','The Silver Kestrel'].includes(m.ch))?'search':'qualify';
 }
 /* Reward bundles: the base missions pay mixes of coins, gems, XP, stat XP, feed and tack. */
 const ENRICH={'Collect 5 carrots':{g:3,items:{carrot:5},xp:15},'Land a clean jump':{xp:20,sxp:{jump:10}},'Gallop 500 m':{sxp:{speed:12}},'Visit Loon Lake':{items:{apple:3}},'Win Cottonwood Welcome Jump':{xp:60,gear:'Common'},
  'Visit Cottonwood Village':{items:{lettuce:2}},'Tame a wild horse':{xp:80,sp:10},'Win the Championship Final':{xp:200,sxp:{speed:20,stamina:20},gear:'Epic',sp:25},
  'Gather 3 lettuces from the meadow':{sxp:{agility:12}},'Gallop 800 m on her trail':{xp:40},'Win the Cottonwood Meadow Dash':{xp:80},'Train a stat with food':{items:{oats:2}},'Collect 5 pumpkins':{items:{pumpkin:3},sxp:{accel:12}},
  'Win the Barleyfold Farm Derby':{xp:100},'Collect 4 oranges':{items:{orange:3}},'Win the Coyote Desert Derby':{xp:120,sp:10},'Win the Hollowpeak Snow Trail':{xp:150,sp:15},'Land 6 clean jumps':{sxp:{jump:20}},'Tell Grandpa Wren':{xp:300,sp:30}};
 for(const m of STORY){const e=ENRICH[m.label];if(e&&!m._enriched){m._enriched=1;m.reward=Object.assign({},m.reward||{},e,{c:(m.reward&&m.reward.c)||0,g:((m.reward&&m.reward.g)||0)+(e.g||0)});}}
 M.rewardKind('pts',(s,v)=>{s.builderBonus=(s.builderBonus||0)+v;},v=>v+'🏗️ builder pts');

 /* ---------- the books that arrive with the seasons (story cadence) ---------- */
 const sn=G.time.seasonNow(); const seasonStart=sn.start, seasonEnd=sn.end;
 const B3='The Runaway Summer', B4='Frost on the Falls';
 const STORY_BOOKS=[
  {id:'b3',title:B3,releaseAt:seasonStart,missions:[
   {ch:'The Runaway Summer',npc:'wren',track:'qualify',label:'Pen 5 runaways in a Roundup',type:'roundup',goal:5,reward:{c:400,g:2,xp:80},text:'Half of Otto\'s youngstock has broken out and is loose in the pasture. Start a Runaway Roundup from the 🏆 Events board and pen five of them — that is what the {name} search taught you: patience.'},
   {ch:'The Runaway Summer',npc:'wren',track:'search',label:'Who opened the pen?',type:'clues',goal:4,clues:[{npc:'otto',text:'The latch was lifted, not broken. Lifted from the outside — by something tall enough to reach over.'},{npc:'theo',text:'I heard hooves on the road at midnight, one horse, going fast, then coming back slower. Like it had fetched something.'},{npc:'rook',text:'Grey shape on the far shore that same night, with a string of youngsters behind it. Led them straight to the water, cool as you like.'}],options:['A horse thief from over the ridge','{name} — leading the youngsters to water','Old Rook, sleepwalking'],answer:1,wrong:'Lifted from outside, one fast horse fetching something, a grey shape leading youngsters to the shore…',reward:{c:300,g:2,xp:60},text:'Somebody opened that pen on purpose. Otto, Theo and Old Rook all saw something that night — ask them, then tell me who you think it was.'},
   {ch:'The Runaway Summer',npc:'june',track:'qualify',label:'Finish 3 side quests',type:'side',goal:3,reward:{c:350,g:2,sp:15},text:'Everybody in the Basin has a job that wants doing and nobody to do it. Pick up three of their side quests — ask anyone with a 📌 — and see them through.'},
   {ch:'The Runaway Summer',npc:'june',track:'search',label:'Fast travel to Coyote Canyon',type:'ft',goal:1,reward:{c:150,items:{orange:3}},text:'The youngsters came back on their own, but she did not. A carter saw a grey horse heading for the canyon. Fast travel out there and pick up the trail.'},
   {ch:'The Runaway Summer',npc:'bea',track:'search',label:'Photograph 2 wild animals in the canyon',type:'wildphoto',goal:2,reward:{c:300,g:1,xp:60},text:'She is out here, partner, and so is everything else that lives on this sand. Photograph two wild animals and I will show you which water hole she uses.'},
   {ch:'The Runaway Summer',npc:'bea',track:'qualify',label:'Win the Coyote Desert Derby again',type:'event',ev:'bd',goal:1,reward:{c:450,g:2,xp:100,gear:'Rare'},text:'A Runaway Summer wants a fast horse. Win the Desert Derby again — this time with the sand in your favour.'},
   {ch:'The Runaway Summer',npc:'rook',track:'search',label:'Catch 3 fish at Loon Lake',type:'fish',goal:3,reward:{c:250,g:1,items:{apple:4}},text:'She drinks at my shore every third night. Sit with me and catch three fish — a horse comes to still water, not to a rider stamping up and down.'},
   {ch:'The Runaway Summer',npc:'rook',track:'search',label:'Find 3 golden horseshoes',type:'shoe',goal:3,reward:{c:400,g:3,xp:80},text:'She has been casting shoes all summer — golden ones, if you believe the light. Three are out there on the meadow paths. Find them and you will know where she runs.'},
   {ch:'The Runaway Summer',npc:'wren',track:'qualify',label:'Earn 10 more ribbons',type:'ribbons',disc:'any',goal:10,reward:{c:600,g:3,sp:20,xp:150},text:'Ten more ribbons, kiddo — I want the Basin to know that whoever brings her home earned the right.'},
   {ch:'The Runaway Summer',npc:'wren',track:'search',label:'Tell Grandpa Wren what you found',type:'talk',talk:'wren',goal:1,reward:{c:800,g:5,xp:200,gear:'Epic'},text:'Golden shoes, a grey shape at the water, youngsters led to safety. She is alive and she is looking after this valley. When the frost comes she will go up to the Falls — and so will we.'},
  ]},
  {id:'b4',title:B4,releaseAt:seasonEnd,missions:[
   {ch:'Frost on the Falls',npc:'tamsin',track:'search',label:'Ride to Hollowpeak Falls',type:'visit',x:-150,z:-222,r:14,goal:1,reward:{c:250,items:{truffle:2}},text:'The frost is on the Falls and there are hoofprints in the spray. Ride up and find me at the pool.'},
   {ch:'Frost on the Falls',npc:'tamsin',track:'search',label:'Photograph 3 wild animals near the Falls',type:'wildphoto',goal:3,reward:{c:350,g:2,xp:80},text:'Everything that winters here comes to the pool. Photograph three animals and you will see her tracks among theirs.'},
   {ch:'Frost on the Falls',npc:'ilse',track:'qualify',label:'Land 8 clean jumps',type:'cleanjump',goal:8,reward:{c:400,g:2,sxp:{jump:25}},text:'Snowdrifts jump like fences and land like nothing at all. Eight clean jumps, so I know you can follow her over the drifts.'},
   {ch:'Frost on the Falls',npc:'ilse',track:'search',label:'The frozen latch',type:'clues',goal:3,clues:[{npc:'tamsin',text:'Somebody cleared the ice from the hay-store latch with their teeth — I found the marks. Big teeth. A horse\'s.'},{npc:'bea',text:'Every winter the hay-store is broken into and every spring the wild herd on the ridge has come through fat. Draw your own conclusion, partner.'}],options:['A bear','{name}, feeding the ridge herd','Poachers'],answer:1,wrong:'Teeth marks on a latch, a herd that winters well… who up here looks after horses?',reward:{c:400,g:3,xp:100},text:'Someone keeps breaking into the hay-store every winter. Tamsin and Bea both have a theory — ask them, then tell me yours.'},
   {ch:'Frost on the Falls',npc:'wren',track:'qualify',label:'Earn 6 dressage ribbons',type:'ribbons',disc:'dressage',goal:6,reward:{c:600,g:3,xp:150,gear:'Rare'},text:'She was never a racehorse, kiddo — she was made of balance. Six dressage ribbons, and you will be able to sit her when the time comes.'},
   {ch:'Frost on the Falls',npc:'wren',track:'search',label:'Tell Grandpa Wren',type:'talk',talk:'wren',goal:1,reward:{c:1000,g:6,xp:250,sp:40,gear:'Legendary'},text:'Feeding the ridge herd through the winter, all these years. Your grandmother would have laughed till she cried. Spring, kiddo — spring, and we go up for her.'},
  ]},
 ];
 let releasedBooks=0;
 function releaseBooks(quiet){
  let added=0;
  for(const b of STORY_BOOKS){
   if(b.added)continue;
   if(b.releaseAt>nowMs())break;   // books arrive in order
   for(const m of b.missions)m.book=b.title;
   Q.story.append(b.missions); b.added=true; releasedBooks++; added++;
   if(!quiet)try{toast('📖 New chapter: '+b.title+' — see Grandpa Wren');}catch(e){}
  }
  return added;
 }
 releaseBooks(true);
 const nextBook=()=>STORY_BOOKS.find(b=>!b.added)||null;
 G.on('interval30',()=>{releaseBooks(false);});
 G.on('storyEpilogue',()=>{const b=nextBook();if(!b)return null;return 'Two books of the story are behind you, and the next is on its way: <b>'+esc(b.title)+'</b> arrives with the new season in '+daysUntil(b.releaseAt)+' day'+(daysUntil(b.releaseAt)===1?'':'s')+'. Until then — ride free, kiddo.';});

 /* Achievements follow the new mission count instead of hard-coded goals. */
 {const a8=ACHS.find(a=>a.id==='story8'), b2=ACHS.find(a=>a.id==='book2');
  const i8=STORY.findIndex(m=>m.type==='event'&&m.ev==='w2'), i2=STORY.findIndex(m=>m.ch==='The Silver Kestrel'&&m.type==='talk');
  if(a8&&i8>=0)a8.goal=i8+1; if(b2&&i2>=0)b2.goal=i2+1;}
 Q.addAch({id:'named1',icon:'✏️',label:'Christened',desc:'Name a horse yourself',v:s=>(s.stats&&s.stats.named)||0,goal:1,r:{c:100}});
 Q.addAch({id:'meet8',icon:'🤝',label:'Know the Basin',desc:'Meet 8 people',v:s=>Object.keys(s.met||{}).length,goal:8,r:{c:250,g:1}});
 Q.addAch({id:'side10',icon:'📌',label:'Helping hands',desc:'Finish 10 side quests',v:s=>(s.side&&s.side.n)||0,goal:10,r:{c:300,g:2}});
 Q.addAch({id:'side50',icon:'📌',label:'Pillar of the Basin',desc:'Finish 50 side quests',v:s=>(s.side&&s.side.n)||0,goal:50,r:{c:1500,g:5,k:2}});
 Q.addAch({id:'sleuth3',icon:'🔍',label:'Sleuth',desc:'Solve 3 cases',v:s=>(s.stats&&s.stats.cases)||0,goal:3,r:{c:400,g:2}});
 Q.addAch({id:'prologue',icon:'🌧️',label:'The Spring Flood',desc:'Finish the prologue',v:s=>Math.min(PRO_N,(s.story&&s.story.idx)||0),goal:PRO_N,r:{c:150,items:{carrot:5}}});
 Q.addAch({id:'brave',icon:'🏗️',label:'Brave Builder',desc:'Finish the builder chapter',v:s=>(s.stats&&s.stats.builderQ)||0,goal:1,r:{c:300,g:1}});

 /* ---------- custom mission types (snapshot or counter, see questEvt) ---------- */
 const QT=Q.types;
 QT.name=m=>m.goal;
 QT.cine=m=>m.goal;
 QT.door=(m,val,p)=>val===m.door?m.goal:p;
 QT.ribbons=m=>ribbonCount(fresh(),m.disc||'any');
 QT.build=(m,val,p)=>(!m.item||m.item===val)?p+1:p;
 QT.build2=(m,val,p)=>{const s=fresh();const need=['lantern','trough'];const have=need.filter(t=>(s.decor||[]).some(d=>d.t===t)).length;return Math.max(p,have);};
 QT.ranchlvl=m=>ranchLevelOf(fresh());
 QT.clues=(m,val,p)=>p+(typeof val==='number'?val:1);
 QT.roundup=m=>{const s=fresh();return Math.max(0,((s.stats&&s.stats.rounded)||0)-((s.story&&s.story.rbase)||0));};
 QT.side=(m,val,p)=>p+(typeof val==='number'?val:1);
 G.on('courseFinish',({ev})=>{Q.questEvt('ribbons',0);sideEvt('event',1,ev&&ev.id);});
 G.on('missionClaim',(m,i)=>{
  S.sync(s=>{ if(m.type==='clues'){s.stats=s.stats||{};s.stats.cases=(s.stats.cases||0)+1;s.story.clues=[];}
   if(m.label==='Brave Builder: place 10 pieces'){s.stats=s.stats||{};s.stats.builderQ=1;}
   const nm=STORY[i+1]; if(nm&&nm.type==='roundup'){s.story.rbase=(s.stats&&s.stats.rounded)||0;}
   if(m.type==='cine'){s.story.era=2;} });
  const nm=STORY[i+1]; if(nm&&(nm.type==='ribbons'||nm.type==='ranchlvl'||nm.type==='build2'||nm.type==='roundup'))Q.questEvt(nm.type,0);   // the cursor has already moved on: snapshot the new mission now
  if(m.type==='door'){setTimeout(()=>{if(!fresh().named)openStarterNaming();},50);}
 });
 /* daily-reported moments the story and side quests also count */
 G.on('dailyEvt',(type,val)=>{
  if(type==='event'||type==='forage')return;   // counted with their ids in courseFinish / the forage hook
  const m=cur(); if(m&&m.type===type&&!NATIVE_STORY.has(type)&&STORY_BRIDGE.has(type))Q.questEvt(type,val);
  if(type==='gallop'){pend.gallop+=val;return;}
  sideEvt(type,val);
 });
 G.on('forage',item=>{sideEvt('forage',1,item);});

 /* ---------- dialogue for the mission types this package owns ---------- */
 function dlgHead(def){return '<b>'+def.icon+' '+esc(def.name)+'</b>';}
 const chLine=m=>m.ch?'<div style="font-size:11px;color:#8c7a63;letter-spacing:.04em">📖 '+esc(m.ch)+(m.track?' · '+(m.track==='search'?'🔎 Search':'🏆 Qualify'):'')+'</div>':'';
 const txt=t=>{const s=fresh();return String(t==null?'':t).replace(/\{name\}/g,esc((s.story&&s.story.name)||'the grey mare'));};
 function closeBtn(lbl){return '<button id="dlgBtn">'+esc(lbl||'On it!')+'</button>';}
 G.on('dlgMission',(def,m,d)=>{
  const s=fresh(); const p=prog();
  const nr=m.needRib; if(nr&&ribbonCount(s,nr.disc||'any')<nr.n){
   d.innerHTML=dlgHead(def)+chLine(m)+'<p>'+txt(m.text)+'</p><p style="color:#8c7a63;font-size:13px">🎀 Come back with '+nr.n+' '+(DISC_LBL[nr.disc||'any']||'')+'ribbons (you have '+ribbonCount(s,nr.disc||'any')+') — ride the 🏆 Events board.</p>'+closeBtn('I will');
   d.style.display='block'; $('dlgBtn').onclick=()=>{d.style.display='none';}; return true;
  }
  if(m.type==='name'){
   d.style.display='none';
   nameDialog({title:'Name the grey foal',body:txt(m.text),def:'',cancel:false,ok:'That is her name ✨',onDone:n=>{
    n=String(n||'').trim().slice(0,14)||'Kestrel';
    S.sync(sv=>{sv.story.name=n;sv.stats=sv.stats||{};sv.stats.named=(sv.stats.named||0)+1;});
    setFoalName(n); Q.questEvt('name',1); toast('✨ '+n+'. She likes it.'); setTimeout(()=>{try{G.openDlg();}catch(e){}},60);
   }});
   return true;
  }
  if(m.type==='clues'){
   const have=s.story.clues||[]; const need=m.clues||[];
   const got=need.filter(c=>have.includes(c.npc));
   let html=dlgHead(def)+chLine(m)+'<p>'+txt(m.text)+'</p>';
   if(got.length<need.length){
    html+='<p style="font-size:13px;color:#5a4a3a">🔍 Clues '+got.length+'/'+need.length+' — ask '+need.filter(c=>!have.includes(c.npc)).map(c=>'<b>'+esc(npcShort(c.npc))+'</b> ('+esc(REGION_OF[c.npc]||'')+')').join(', ')+'.</p>'
     +got.map(c=>'<p style="font-size:12px;color:#5a4a3a;margin:2px 0">📝 '+esc(npcShort(c.npc))+': '+txt(c.text)+'</p>').join('')+closeBtn('On it!');
    d.innerHTML=html; d.style.display='block'; $('dlgBtn').onclick=()=>{d.style.display='none';}; return true;
   }
   html+=got.map(c=>'<p style="font-size:12px;color:#5a4a3a;margin:2px 0">📝 '+esc(npcShort(c.npc))+': '+txt(c.text)+'</p>').join('')+'<p style="font-size:13px"><b>So — who was it?</b></p>'
    +m.options.map((o,i)=>'<button data-g="'+i+'" style="display:block;margin:4px 0">'+txt(o)+'</button>').join('')+'<button id="dlgBtn" style="margin-top:6px">Let me think…</button>';
   d.innerHTML=html; d.style.display='block';
   d.querySelectorAll('[data-g]').forEach(b=>{b.onclick=()=>{if(+b.dataset.g===m.answer){Q.questEvt('clues',m.goal);G.sGem();toast('🔍 Solved!');G.openDlg();}else toast(txt(m.wrong||'Hmm — look at the clues again.'));};});
   $('dlgBtn').onclick=()=>{d.style.display='none';}; return true;
  }
  if(m.type==='ribbons'){
   const n=ribbonCount(s,m.disc||'any'); if(n!==p)Q.questEvt('ribbons',0);
   d.innerHTML=dlgHead(def)+chLine(m)+'<p>'+txt(m.text)+'</p><span style="color:#8c7a63;font-size:13px">🎀 '+esc(m.label)+' ('+Math.min(m.goal,n)+'/'+m.goal+')</span><br><br><button id="dlgBtn">On it!</button><button data-fx="open:eventsPanel" style="margin-left:6px">🏆 Events</button>';
   d.style.display='block'; G.ui.bindFx(d); $('dlgBtn').onclick=()=>{d.style.display='none';}; return true;
  }
  if(m.type==='build'||m.type==='build2'||m.type==='ranchlvl'){
   if(m.type!=='build')Q.questEvt(m.type,0);
   const pp=prog();
   d.innerHTML=dlgHead(def)+chLine(m)+'<p>'+txt(m.text)+'</p><span style="color:#8c7a63;font-size:13px">📜 '+esc(m.label)+(m.goal>1?' ('+Math.floor(pp)+'/'+m.goal+')':'')+'</span><br><br><button id="dlgBtn" class="claimBtn">🏗️ Open Build</button><button data-nm="x" style="margin-left:6px">Later</button>';
   d.style.display='block'; $('dlgBtn').onclick=()=>{d.style.display='none';try{G.ui.openBuild();}catch(e){}}; d.querySelector('[data-nm="x"]').onclick=()=>{d.style.display='none';}; return true;
  }
  if(m.type==='door'){
   d.innerHTML=dlgHead(def)+chLine(m)+'<p>'+txt(m.text)+'</p><span style="color:#8c7a63;font-size:13px">🔐 The old stall is beside the barn — it is marked on the map. You have '+(s.keys||0)+' 🗝️.</span><br><br>'+closeBtn('On it!');
   d.style.display='block'; $('dlgBtn').onclick=()=>{d.style.display='none';}; return true;
  }
  if(m.type==='cine'){
   d.innerHTML=dlgHead(def)+chLine(m)+'<p>'+(cine.on?'The sky… kiddo, get her under the roof —':txt(m.text))+'</p>'+closeBtn('…');
   d.style.display='block'; $('dlgBtn').onclick=()=>{d.style.display='none';}; return true;
  }
  if(m.type==='roundup'||m.type==='side'||STORY_BRIDGE.has(m.type)){
   if(m.type==='roundup')Q.questEvt('roundup',0);
   const pp=prog();
   d.innerHTML=dlgHead(def)+chLine(m)+'<p>'+txt(m.text)+'</p><span style="color:#8c7a63;font-size:13px">📜 '+txt(m.label)+(m.goal>1?' ('+Math.floor(pp)+'/'+m.goal+')':'')+'</span><br><br>'+closeBtn('On it!')+(m.type==='roundup'?'<button data-fx="open:eventsPanel" style="margin-left:6px">🏆 Events</button>':'');
   d.style.display='block'; G.ui.bindFx(d); $('dlgBtn').onclick=()=>{d.style.display='none';}; return true;
  }
  return false;
 });
 /* Extra lines in anyone's idle dialogue: a clue they hold, side quests to take or turn in, and
    the roster's own greetings. */
 G.on('dlg',(def,s)=>{
  let out='';
  S.sync(sv=>{sv.met=sv.met||{};if(!sv.met[def.id])sv.met[def.id]=nowMs();});
  if(def.id!==giverOf(cur()))G.quest.dailyEvt('talkn',1);
  const m=cur();
  if(m&&m.type==='clues'&&prog()<m.goal){const c=(m.clues||[]).find(c=>c.npc===def.id);
   if(c){const have=(s.story&&s.story.clues)||[]; out+=have.includes(def.id)?'<p style="font-size:12px;color:#5a4a3a">📝 '+txt(c.text)+'</p>':'<p style="font-size:13px;color:#5a4a3a">🔍 '+txt(c.text)+'</p><button data-fx="sq:clue:'+def.id+'" class="claimBtn">Note it 📝</button>';}}
  if(def.id==='june'&&!s.keysGiven){out+='<p style="font-size:13px">🗝️ "And this is yours — your grandmother\'s Silver Key. Keep it safe."</p>';}
  out+=sideDlgHtml(def,s);
  return out;
 });
 G.ui.action('sq',(a,btn)=>{
  const op=a[0];
  if(op==='clue'){const npc=a[1];const m=cur();if(!m||m.type!=='clues')return;let added=false;S.sync(sv=>{sv.story.clues=sv.story.clues||[];if(!sv.story.clues.includes(npc)){sv.story.clues.push(npc);added=true;}});if(added){Q.questEvt('clues',1);G.sChime();toast('📝 Noted. '+(prog()>=(m.clues||[]).length?'Tell '+npcShort(giverOf(m))+' who it was.':'Clues '+prog()+'/'+(m.clues||[]).length));}$('dlg').style.display='none';}
  else if(op==='take')takeSide(a[1]);
  else if(op==='turnin')turnInSide(a[1]);
  else if(op==='drop')dropSide(a[1]);
  else if(op==='coat'){S.sync(sv=>{const h=sv.horses.find(h=>h.breed==='bay-sporthorse')||sv.horses[0];applyStarterCoat(sv,h,a[1]);});try{H.reloadHorses();}catch(e){}toast('🎨 Coat chosen!');try{G.ui.renderStable();}catch(e){}}
  else if(op==='board'){openSideTab();}
  else if(op==='tab'){try{G.ui.openQuests();}catch(e){}const b=document.querySelector('[data-q="tab:'+a[1]+'"]');if(b)b.click();}
 });
 /* June hands over the first Silver Key in person. */
 const june=npcDef('june'); if(june)june.onTalk=(def,s)=>{if(s.keysGiven)return;S.sync(sv=>{if(sv.keysGiven)return;sv.keysGiven=true;sv.keys=(sv.keys||0)+1;});M.refreshWallet();G.sGem();toast('🗝️ Auntie June presses a Silver Key into your hand.');};

 /* ---------- the prologue horse, the storm, the old stall, the starter coat ---------- */
 let foal=null;
 function setFoalName(n){if(!foal)return;try{foal.group.remove(foal.tag);}catch(e){}foal.tag=G.nameSprite('✨ '+n);foal.tag.position.y=2.7;foal.group.add(foal.tag);}
 function spawnFoal(){
  if(foal)return;
  const parts=H.makeHorse({colors:{body:'#d7dbe3',mane:'#f4f6fa'},seed:11}); const g=parts.group; g.scale.setScalar(0.78);
  const x=-7,z=-21; g.position.set(x,W.groundH(x,z),z); G.scene.add(g);
  foal={parts,group:g,tag:null,x,z,heading:0,phase:0,bolt:0};
  setFoalName(fresh().story.name||'?');
 }
 function removeFoal(){if(!foal)return;try{G.scene.remove(foal.group);}catch(e){}foal=null;}
 function tickFoal(dt){
  if(!foal)return; const p=H.player; const i=idx();
  if(foal.bolt>0){foal.bolt-=dt;const sp=11;foal.x+=Math.sin(foal.heading)*sp*dt;foal.z+=Math.cos(foal.heading)*sp*dt;foal.phase+=dt*14;foal.group.position.set(foal.x,W.groundH(foal.x,foal.z)+Math.abs(Math.sin(foal.phase))*0.12,foal.z);foal.group.rotation.y=foal.heading;if(foal.bolt<=0)removeFoal();return;}
  if(i>PRO_N-4)return;   // she only follows in the first two beats
  const tx=p.pos.x-Math.sin(p.heading)*2.6+Math.cos(p.heading)*1.6, tz=p.pos.z-Math.cos(p.heading)*2.6-Math.sin(p.heading)*1.6;
  const dx=tx-foal.x,dz=tz-foal.z,d=Math.hypot(dx,dz);
  if(d>90){foal.x=tx;foal.z=tz;}
  else if(d>1.2){const want=Math.atan2(dx,dz);let dh=want-foal.heading;while(dh>Math.PI)dh-=Math.PI*2;while(dh<-Math.PI)dh+=Math.PI*2;foal.heading+=dh*Math.min(1,dt*4);const sp=Math.min(12,1.5+d*1.4);foal.x+=Math.sin(foal.heading)*sp*dt;foal.z+=Math.cos(foal.heading)*sp*dt;foal.phase+=dt*(sp>6?12:7);}
  const bob=d>1.2?Math.abs(Math.sin(foal.phase))*0.09:0;
  foal.group.position.set(foal.x,W.groundH(foal.x,foal.z)+bob,foal.z); foal.group.rotation.y=foal.heading;
  if(foal.parts.legs)foal.parts.legs.forEach((l,k)=>{if(l&&l.rotation)l.rotation.x=(d>1.2?Math.sin(foal.phase+k*Math.PI/2)*0.5:0);});
 }
 /* The storm: an overlay the tick drives with dt, so a headless advanceTime plays it too. */
 const cine={on:false,t:0,step:-1};
 const CINE_LINES=['The storm came in off Hollowpeak faster than anyone had seen.','She bolted into the rain. You called until your voice went. She did not come back.','Two summers later…'];
 let cineEl=null;
 function cineDom(){ if(cineEl)return cineEl; const st=document.createElement('style'); st.textContent='#sqCine{position:fixed;inset:0;z-index:40;background:radial-gradient(ellipse at 50% 30%,#1d2a4a,#05070f 70%);color:#eef2ff;display:none;align-items:center;justify-content:center;text-align:center;padding:40px;font-family:var(--display,serif);font-size:clamp(20px,3.4vw,34px);line-height:1.4;opacity:0;transition:opacity .7s ease}#sqCine.show{display:flex;opacity:1}#sqCine.flash{animation:sqFlash .5s steps(2) 3}@keyframes sqFlash{50%{background:#dfe8ff;color:#05070f}}#sqCine i{display:block;font-size:14px;opacity:.7;margin-top:18px;font-style:normal}'; document.head.appendChild(st); cineEl=document.createElement('div'); cineEl.id='sqCine'; document.body.appendChild(cineEl); return cineEl; }
 function startCine(){ if(cine.on)return; cine.on=true; cine.t=0; cine.step=-1; const el=cineDom(); el.innerHTML=''; el.classList.add('show','flash'); try{toast('⛈️ Thunder over Hollowpeak — she is bolting!');}catch(e){} if(foal){foal.heading=Math.atan2(-160-foal.x,-210-foal.z);foal.bolt=4;} }
 function tickCine(dt){
  if(!cine.on)return; cine.t+=dt; const el=cineDom();
  const step=cine.t<3.4?0:cine.t<6.8?1:cine.t<9.6?2:3;
  if(step!==cine.step){cine.step=step; if(step<3){el.innerHTML='<div>'+CINE_LINES[step]+(step===2?'<i>Kestrel Basin · Meadowlark Ranch</i>':'')+'</div>'; if(step>0)el.classList.remove('flash');}
   else {el.classList.remove('show','flash'); cine.on=false; removeFoal(); S.sync(s=>{s.story.era=2;}); Q.questEvt('cine',1); try{toast('📜 Two summers later. Tell Grandpa Wren you are home.');}catch(e){}}}
 }
 /* the old stall beside the barn: a Silver Key opens it once, and the bay inside gets a name and a coat */
 let stall=null;
 function mkStall(){
  const g=new THREE.Group(); const x=-3,z=-26;
  const shell=W.ranchArchitecture.buildOutbuilding({width:3.4,depth:2.8,height:2.5,animatedDoorOpening:{width:1.0,height:1.8}}); g.add(shell);
  const door=W.box(1.0,1.8,.08,W.mats.plankBrownMat,0,.9,1.41,g); for(const y of [.45,1.35])W.box(.9,.085,.04,W.mats.plankBrownMat,0,y,1.47,g); W.box(.05,.15,.06,'#393c35',.34,.95,1.48,g);
  g.position.set(x,W.groundH(x,z),z); g.rotation.y=Math.atan2(-x,-z)+Math.PI; g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  W.colliders.push({x,z,r:2.1});
  const sp=G.nameSprite('🔐 The old stall'); sp.position.y=(shell.userData.architecture&&shell.userData.architecture.suggestedLabelY)||3; g.add(sp);
  W.followCamera.register(g);
  const opened=!!(fresh().doors||{}).starter; if(opened)door.rotation.y=-1.3;
  stall={kind:'sqdoor',id:'starter',g,door,x,z,reach:5.4,
   label:()=>{const s=fresh();const m=cur();if(s.doors&&s.doors.starter)return '🐴 The old stall (E)';return (m&&m.type==='door')?'🔐 Open the old stall — 1 🗝️ (E)':'🔐 The old stall (locked)';},
   use:()=>{const s=fresh();const m=cur();
    if(s.doors&&s.doors.starter){try{G.ui.openStable();}catch(e){}return;}
    if(!(m&&m.type==='door')){toast('Grandpa Wren has the story of this stall — ask him.');return;}
    if((s.keys||0)<1){toast('You need a Silver Key — Auntie June has your grandmother\'s.');return;}
    S.sync(sv=>{sv.keys=(sv.keys||0)-1;sv.doors=sv.doors||{};sv.doors.starter=nowMs();}); M.refreshWallet(); G.sGem(); door.rotation.y=-1.3;
    toast('🔐 The door swings open. A bay mare lifts her head.');
    openStarterNaming();
    Q.questEvt('door','starter');
   }};
  W.addThing(stall);
  W.mapMarkers.push({x,z,glyph:'🔐',label:'The old stall'});
 }
 function openStarterNaming(){
  const s=fresh(); const i=Math.max(0,(s.horses||[]).findIndex(h=>h.breed==='bay-sporthorse')); const h=(s.horses||[])[i]; if(!h)return;
  nameDialog({title:'A horse of your own',body:'She is yours — saddle, stall and all. Give her a name and pick her coat.',def:h.name||'Clover',coats:STARTER_COATS,coat:(s.starterCoat&&s.starterCoat.id)||'bay',cancel:false,onDone:(n,c)=>{setName(i,n||h.name||'Clover',c||'bay');}});
 }
 mkStall();
 if(fresh().story.era!==2&&idx()<PRO_N)spawnFoal();
 U.stableHeader(s=>{ if(!s.starterCoat||s.starterCoat.chosen)return ''; const h=(s.horses||[]).find(h=>h.breed==='bay-sporthorse'); if(!h)return '';
  return '<div class="evrow" style="flex-wrap:wrap"><b>🎨 Choose '+esc(h.name)+'\'s coat</b><span style="font-size:12px;color:#8c7a63">Once, for free — the sporthorse comes in three</span><span style="display:flex;gap:6px">'+STARTER_COATS.map(c=>'<button data-fx="sq:coat:'+c[0]+'" style="display:inline-flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:50%;background:'+c[2]+';border:2px solid '+c[3]+'"></span>'+c[1]+'</button>').join('')+'</span></div>'; });

 /* ---------- side quests: a generator over people, tiers and templates, plus hand-written ones ---------- */
 const TPL={
  gallop:{ico:'💨',g:[400,900,1600],l:n=>'Gallop '+n+' m'},
  cleanjump:{ico:'⤴️',g:[3,6,10],l:n=>'Land '+n+' clean jumps'},
  feed:{ico:'🥕',g:[3,6,10],l:n=>'Hand out '+n+' treats'},
  groom:{ico:'🧼',g:[2,4,6],l:n=>'Groom a horse '+n+' times'},
  pet:{ico:'💗',g:[3,5,8],l:n=>'Pet horses '+n+' times'},
  water:{ico:'💧',g:[2,4,6],l:n=>'Water a horse '+n+' times'},
  carrots:{ico:'🌼',g:[5,10,15],l:n=>'Collect '+n+' meadow carrots'},
  photo:{ico:'📷',g:[1,2,3],l:n=>'Take '+n+' photograph'+(n>1?'s':'')},
  event:{ico:'🏆',g:[1,2,3],l:n=>'Finish '+n+' event'+(n>1?'s':'')},
  fish:{ico:'🎣',g:[1,3,5],l:n=>'Catch '+n+' fish'},
  shoe:{ico:'🍀',g:[1,3,5],l:n=>'Find '+n+' golden horseshoe'+(n>1?'s':'')},
  ft:{ico:'🧭',g:[1,2,3],l:n=>'Fast travel '+n+' time'+(n>1?'s':'')},
  build:{ico:'🏗️',g:[2,4,6],l:n=>'Place '+n+' ranch pieces'},
  train:{ico:'📈',g:[1,2,3],l:n=>'Raise '+n+' stat'+(n>1?'s':'')+' with food'},
  wildphoto:{ico:'📸',g:[1,2,3],l:n=>'Photograph '+n+' wild animal'+(n>1?'s':'')},
  trail:{ico:'🥾',g:[1,2,3],l:n=>'Finish '+n+' trail ride'+(n>1?'s':'')},
  tame:{ico:'🦄',g:[1,1,2],l:n=>'Tame '+n+' wild horse'+(n>1?'s':'')},
  breed:{ico:'💞',g:[1,1,2],l:n=>'Breed '+n+' foal'+(n>1?'s':'')},
  forage:{ico:'🧺',g:[3,6,9],l:(n,x)=>'Forage '+n+' '+(T.FOODS3[x]?T.FOODS3[x].label.toLowerCase()+(n>1?'s':''):x)},
  talkn:{ico:'💬',g:[2,4,6],l:n=>'Chat with '+n+' other people'},
 };
 const NPC_TPL={
  wren:['feed','groom','carrots','build','pet','train'],
  ada:['cleanjump','carrots','event','photo','forage:lettuce','talkn'],
  otto:['forage:pumpkin','gallop','feed','event','build','water'],
  bea:['forage:orange','gallop','wildphoto','event','ft','tame'],
  ilse:['cleanjump','event','photo','gallop','tame','trail'],
  june:['event','ft','talkn','breed','train','photo'],
  bram:['cleanjump','groom','event','train','build','gallop'],
  hesper:['feed','breed','groom','train','water','pet'],
  rook:['fish','photo','water','carrots','shoe','trail'],
  tamsin:['wildphoto','photo','shoe','gallop','forage:truffle','trail'],
  mia:['gallop','cleanjump','pet','trail','photo','carrots'],
  theo:['pet','groom','feed','cleanjump','ft','shoe'],
 };
 const FLAVOUR={wren:'The pasture will not keep itself, kiddo.',ada:'The village would be glad of it.',otto:'Harvest waits for no one.',bea:'Out here we look after our own, partner.',ilse:'Snow country asks more of a rider.',june:'Every good auction starts with a good story.',bram:'A saddler notices everything about how a horse goes.',hesper:'Good horses come from good days.',rook:'Still water, steady hands.',tamsin:'The trail count needs you.',mia:'Comet says you can do it.',theo:'Pepper bets you cannot.'};
 const SIDEQ=[]; const SIDE_BY={};
 const TIER_R=[{c:60,xp:15,sp:3},{c:140,g:1,xp:35,sp:6},{c:260,g:2,xp:70,sp:10}];
 for(const npc in NPC_TPL){NPC_TPL[npc].forEach(key=>{const [type,item]=key.split(':');const tp=TPL[type];if(!tp)return;
  for(let tier=1;tier<=3;tier++){const goal=tp.g[tier-1];const q={id:npc+'-'+type+(item?'-'+item:'')+'-'+tier,npc,region:REGION_OF[npc],type,goal,tier,icon:tp.ico,label:tp.l(goal,item),text:FLAVOUR[npc]||'',reward:Object.assign({},TIER_R[tier-1]),repeat:tier===3?'weekly':false};
   if(item)q.item=item; if(tier===3&&(type==='event'||type==='tame'||type==='breed'))q.reward.gear='Common'; if(tier===2&&item)q.reward.items={[item]:2};
   SIDEQ.push(q);}});}
 const HAND=[
  {id:'h-wren-fence',npc:'wren',type:'build',item:'fence',goal:5,icon:'🚧',label:'Fence the north line',text:'Five fence sections along the north pasture, where the youngstock keep wandering off.',reward:{c:200,pts:10,xp:30}},
  {id:'h-wren-lanterns',npc:'wren',type:'build',item:'lantern',goal:3,icon:'🏮',label:'Light the yard',text:'Three lantern posts, so nobody trips over a bucket after dark.',reward:{c:220,pts:12,g:1}},
  {id:'h-ada-blossom',npc:'ada',type:'photo',goal:2,icon:'🌸',label:'Blossom for the noticeboard',text:'Two photographs of the village in bloom for the noticeboard, please.',reward:{c:150,g:1,items:{lettuce:3}}},
  {id:'h-ada-dash',npc:'ada',type:'event',ev:'h2',goal:1,icon:'🏁',label:'Run the Meadow Dash for Cottonwood',text:'Fly the village colours in the Meadow Dash — a finish is all I ask.',reward:{c:300,xp:60,sp:8}},
  {id:'h-otto-pumpkins',npc:'otto',type:'forage',item:'pumpkin',goal:8,icon:'🎃',label:'Pumpkin cart',text:'Eight pumpkins for the Cottonwood cart, and one for your horse.',reward:{c:260,items:{pumpkin:4},sxp:{accel:15}}},
  {id:'h-otto-derby',npc:'otto',type:'event',ev:'a1',goal:1,icon:'🌾',label:'Farm Derby for Barleyfold',text:'Show the village folk a farm horse can run: finish the Farm Derby.',reward:{c:320,xp:70,gear:'Common'}},
  {id:'h-bea-oranges',npc:'bea',type:'forage',item:'orange',goal:6,icon:'🍊',label:'Orange patrol',text:'Six oranges before the coyotes — and the horses — get them.',reward:{c:240,items:{orange:3},g:1}},
  {id:'h-bea-desert',npc:'bea',type:'event',ev:'bd',goal:1,icon:'🏜️',label:'Desert Derby deputy',text:'Ride the Desert Derby and show them a sheriff\'s deputy can handle sand.',reward:{c:400,xp:90,sp:10}},
  {id:'h-ilse-snow',npc:'ilse',type:'event',ev:'wt',goal:1,icon:'❄️',label:'Snow Trail scout',text:'Finish the Snow Trail and tell me how deep the drifts are on the top turn.',reward:{c:450,xp:100,g:2}},
  {id:'h-ilse-truffles',npc:'ilse',type:'forage',item:'truffle',goal:4,icon:'🍄',label:'Truffles under the pines',text:'Four truffles from under the pines — the jumpers love them.',reward:{c:300,items:{truffle:2},sxp:{jump:15}}},
  {id:'h-june-tour',npc:'june',type:'ft',goal:4,icon:'🗺️',label:'The grand tour',text:'Fast travel to four places in one go and tell me which is prettiest.',reward:{c:200,g:1,xp:40}},
  {id:'h-june-herd',npc:'june',type:'breed',goal:1,icon:'🐣',label:'A foal for the tent',text:'Breed a foal — my auction tent has not seen a foal since spring.',reward:{c:500,g:2,xp:80}},
  {id:'h-bram-clean',npc:'bram',type:'cleanjump',goal:12,icon:'🐎',label:'Twelve clean for the saddler',text:'Twelve clean jumps in that saddle and I will call it fitted.',reward:{c:350,gear:'Rare',xp:60}},
  {id:'h-hesper-feed',npc:'hesper',type:'feed',goal:12,icon:'🧺',label:'Feed the barn',text:'Twelve treats handed out — the mares talk, you know.',reward:{c:260,items:{apple:4,hay:2},sp:6}},
  {id:'h-rook-perch',npc:'rook',type:'fish',goal:6,icon:'🐟',label:'Six for supper',text:'Six fish and you can sit on my end of the jetty.',reward:{c:320,g:2,items:{apple:3}}},
  {id:'h-rook-bottles',npc:'rook',type:'water',goal:5,icon:'💧',label:'Water the herd',text:'Water your horses five times — a dry horse is a sad horse.',reward:{c:180,xp:30}},
  {id:'h-tamsin-count',npc:'tamsin',type:'wildphoto',goal:4,icon:'🦅',label:'The trail count',text:'Four wild animals photographed for this month\'s count.',reward:{c:380,g:2,xp:80}},
  {id:'h-tamsin-falls',npc:'tamsin',type:'visit',x:-150,z:-222,r:14,goal:1,icon:'💦',label:'See the Falls',text:'Ride to the foot of Hollowpeak Falls and stand in the spray.',reward:{c:200,g:1}},
  {id:'h-mia-race',npc:'mia',type:'gallop',goal:1200,icon:'🏇',label:'Race Comet',text:'Gallop 1,200 metres — Comet says he can beat that.',reward:{c:240,sxp:{speed:15},xp:40}},
  {id:'h-theo-pony',npc:'theo',type:'pet',goal:10,icon:'🐴',label:'Pepper\'s ten',text:'Pet horses ten times. Pepper counts.',reward:{c:180,items:{carrot:6}}},
  {id:'h-wren-lake',npc:'wren',type:'visit',x:20,z:16,r:10,goal:1,icon:'🌊',label:'Grandma\'s bench',text:'Ride down to Loon Lake at any hour and sit a while where your grandmother sat.',reward:{c:120,xp:20}},
  {id:'h-ada-villagers',npc:'ada',type:'talkn',goal:5,icon:'💬',label:'Say hello to everyone',text:'Five people in the Basin you have not spoken to today — go and say hello.',reward:{c:220,g:1}},
  {id:'h-bea-canyon',npc:'bea',type:'visit',x:-220,z:130,r:16,icon:'🤠',goal:1,label:'Report to the canyon post',text:'Ride out to the canyon post and report in.',reward:{c:150,items:{orange:2}}},
  {id:'h-hesper-train',npc:'hesper',type:'train',goal:4,icon:'📈',label:'Bring one on',text:'Raise a stat four times with food — a horse built on the plate, as we say.',reward:{c:400,g:2,sxp:{stamina:20}}},
 ];
 for(const q of HAND){q.tier=q.tier||2;q.region=REGION_OF[q.npc];q.hand=true;SIDEQ.push(q);}
 for(const q of SIDEQ)SIDE_BY[q.id]=q;
 function sideDone(s,q){const d=s.side.done[q.id];if(!d)return false;if(q.repeat==='weekly')return d===G.time.weekKey();return true;}
 function sideAvailable(s,npc){const wk=G.time.weekKey();return SIDEQ.filter(q=>q.npc===npc&&!s.side.active[q.id]&&!sideDone(s,q)&&(q.minStory==null||idx()>=q.minStory)&&(q.tier<=1||q.hand||!!s.side.done[q.id.replace(/-(\d)$/,(m,t)=>'-'+(t-1))]));}
 const activeCount=s=>Object.keys(s.side.active||{}).length;
 function sideDlgHtml(def,s){
  const act=Object.keys(s.side.active).map(id=>SIDE_BY[id]).filter(q=>q&&q.npc===def.id);
  let out='';
  for(const q of act){const p=s.side.active[q.id].p||0;const done=p>=q.goal;
   out+='<div class="qrow" style="margin:4px 0;font-size:12px"><span class="qico">'+q.icon+'</span><span class="qmain">'+esc(q.label)+'<span class="qbar"><span class="qfill" style="width:'+Math.round(100*Math.min(1,p/q.goal))+'%"></span></span></span><span style="font-size:11px;color:#8c7a63">'+Math.floor(Math.min(p,q.goal))+'/'+q.goal+'</span>'+(done?'<button class="claimBtn" data-fx="sq:turnin:'+q.id+'">Turn in · '+M.rewardLabel(q.reward)+'</button>':'<button data-fx="sq:drop:'+q.id+'" title="Give it up">✖</button>')+'</div>';}
  const offers=sideAvailable(s,def.id).slice(0,3);
  if(offers.length){out+='<div style="font-size:11px;color:#8c7a63;margin-top:6px;letter-spacing:.04em">📌 SIDE QUESTS'+(activeCount(s)>=SIDE_CAP?' · you have '+SIDE_CAP+' on the go':'')+'</div>';
   for(const q of offers)out+='<div class="qrow" style="margin:4px 0;font-size:12px"><span class="qico">'+q.icon+'</span><span class="qmain">'+esc(q.label)+'<span style="font-size:11px;color:#8c7a63;font-weight:600">'+esc(q.text)+'</span></span><span style="font-size:11px;color:#8c7a63">'+M.rewardLabel(q.reward)+'</span>'+(activeCount(s)<SIDE_CAP?'<button data-fx="sq:take:'+q.id+'">Take</button>':'')+'</div>';}
  return out;
 }
 function takeSide(qid){const q=SIDE_BY[qid];if(!q)return;let ok=false;S.sync(s=>{if(activeCount(s)>=SIDE_CAP||s.side.active[qid]||sideDone(s,q))return;s.side.active[qid]={p:0,at:nowMs()};ok=true;});if(!ok){toast('You have '+SIDE_CAP+' side quests on the go — finish one first.');return;}G.sChime();toast('📌 '+q.label+' — for '+npcShort(q.npc));$('dlg').style.display='none';
  if(q.type==='ribbons'||q.type==='ranchlvl')sideEvt(q.type,0);
 }
 function dropSide(qid){S.sync(s=>{delete s.side.active[qid];});toast('Dropped.');$('dlg').style.display='none';}
 function turnInSide(qid){const q=SIDE_BY[qid];if(!q)return;let ok=false;S.sync(s=>{const a=s.side.active[qid];if(!a||a.p<q.goal)return;delete s.side.active[qid];s.side.done[qid]=q.repeat==='weekly'?G.time.weekKey():true;s.side.n=(s.side.n||0)+1;s.stats=s.stats||{};s.stats.side=(s.stats.side||0)+1;M.payReward(s,q.reward);ok=true;});
  if(!ok)return;M.refreshWallet();try{H.refreshTack();}catch(e){}G.sGem();toast('📌 Side quest done! +'+M.rewardLabel(q.reward));$('dlg').style.display='none';Q.dailyEvt('side',1);}   // the dailyEvt bridge also counts it for a 'side' story mission
 const pend={gallop:0,t:0};
 function sideEvt(type,val,x){
  const s=fresh(); if(!s.side)return; const act=s.side.active; const ids=Object.keys(act); if(!ids.length)return;
  const upd={}; const doneNow=[];
  for(const id of ids){const q=SIDE_BY[id];if(!q||q.type!==type)continue;if(q.item&&q.item!==x)continue;if(q.ev&&q.ev!==x)continue;if(q.talk&&q.talk!==x)continue;
   const a=act[id];const before=a.p||0;if(before>=q.goal)continue;const np=Math.min(q.goal,before+val);if(np===before)continue;upd[id]=np;if(np>=q.goal)doneNow.push(q);}
  if(!Object.keys(upd).length)return;
  S.sync(sv=>{for(const id in upd)if(sv.side.active[id])sv.side.active[id].p=upd[id];});
  for(const q of doneNow)toast('📌 Side quest done: '+q.label+' — tell '+npcShort(q.npc)+'!');
 }
 function openSideTab(){try{G.ui.openQuests();}catch(e){}const b=document.querySelector('[data-q="tab:side"]');if(b)b.click();}
 /* a notice board by the arena that opens the side-quest log */
 {const g=new THREE.Group(); const x=5,z=-3; for(const bx of[-0.6,0.6])W.box(0.1,1.9,0.1,'#5a3d22',bx,0.95,0,g); W.box(1.7,1.0,0.08,'#e9dcc0',0,1.6,0,g); W.box(1.9,0.12,0.16,'#8a6745',0,2.15,0,g); const sp=G.nameSprite('📌 Quest board'); sp.position.y=2.6; g.add(sp); g.position.set(x,W.groundH(x,z),z); g.rotation.y=Math.PI*0.15; g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  W.addThing({kind:'sqboard',id:'board',g,x,z,reach:3.4,label:()=>'📌 Quest board (E)',use:()=>openSideTab()});}

 /* ---------- dailies: six a day, club points on every one, five new templates ---------- */
 for(const q of DAILYQ){q.r=q.r||{};if(!q.r.sp)q.r.sp=10;if(q.r.g)q.r.g=Math.min(6,q.r.g+1);}   // 2-4 gems a daily: SE's 10 rescaled to this economy
 Q.addDaily({type:'train',icon:'📈',label:'Raise a stat with food',goal:1,r:{c:120,g:4,p:15,sp:10}});
 Q.addDaily({type:'build',icon:'🏗️',label:'Place 2 ranch pieces',goal:2,r:{c:100,g:3,p:10,sp:10}});
 Q.addDaily({type:'forage',icon:'🧺',label:'Forage 4 wild foods',goal:4,r:{c:120,g:3,p:15,sp:10}});
 Q.addDaily({type:'talkn',icon:'💬',label:'Chat with 3 people',goal:3,r:{c:80,g:3,p:10,sp:10}});
 Q.addDaily({type:'side',icon:'📌',label:'Finish a side quest',goal:1,r:{c:150,g:4,p:20,sp:10}});

 /* ---------- the quest log: Story and Side tabs ---------- */
 const trackChip=t=>t==='search'?'<span style="font-size:10px;color:#5b7fbf">🔎</span>':'<span style="font-size:10px;color:#b8892f">🏆</span>';
 U.questTab({id:'story',label:'📖 Story',pos:0,render(s){
  const i=idx(), m=cur(), pct=storyPct(); const nb=nextBook();
  let html='<div class="qrow" style="background:#fffaf0"><span class="qico">📖</span><span class="qmain"><b>Story '+pct+'%</b><span class="qbar"><span class="qfill" style="width:'+pct+'%"></span></span></span><span style="font-size:11px;color:#8c7a63">'+Math.min(i,STORY.length)+'/'+STORY.length+' missions · '+(s.story.era===2?'two summers later':'the spring flood')+'</span></div>';
  html+='<span style="font-size:11.5px;color:#8c7a63">🔎 <b>Search</b> — the grey mare'+(s.story.name?', '+esc(s.story.name):'')+' · 🏆 <b>Qualify</b> — ribbons, the Championship, the ranch. Talk to the giver to start or finish a mission.</span>';
  let lastCh=null;
  STORY.forEach((q,k)=>{const ch=chapterOf(q); if(ch!==lastCh){lastCh=ch;const done=STORY.every((z,kk)=>chapterOf(z)!==ch||kk<i);html+='<div style="font-size:11px;color:#8c7a63;letter-spacing:.05em;margin-top:6px">📖 '+esc(ch).toUpperCase()+(done?' ✅':'')+'</div>';}
   const st=k<i?'done':k===i?'cur':'lock';
   const giver=npcShort(giverOf(q));
   const lbl=txt(q.label);
   if(st==='done')html+='<div class="qrow claimed" style="font-size:12px"><span class="qico">✅</span><span class="qmain">'+lbl+'</span>'+trackChip(q.track)+'</div>';
   else if(st==='cur'){const p=prog();const ready=p>=q.goal;const nr=q.needRib;const gate=nr&&ribbonCount(s,nr.disc||'any')<nr.n;
    html+='<div class="qrow'+(ready?' done':'')+'" style="border-color:#e9bb52"><span class="qico">▶</span><span class="qmain"><b>'+lbl+'</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+(ready?'Done — tell '+esc(giver):(gate?'🎀 needs '+nr.n+' '+(DISC_LBL[nr.disc||'any']||'')+'ribbons ('+ribbonCount(s,nr.disc||'any')+')':'from '+esc(giver)+' · '+esc(REGION_OF[giverOf(q)]||'')))+(q.type==='ribbons'?' · 🎀 '+(DISC_LBL[q.disc||'any']||'')+'ribbons':'')+'</span>'+(q.goal>1?'<span class="qbar"><span class="qfill" style="width:'+Math.round(100*Math.min(1,p/q.goal))+'%"></span></span>':'')+'</span><span style="font-size:11px;color:#8c7a63">'+(q.goal>1?Math.floor(Math.min(p,q.goal))+'/'+q.goal+' · ':'')+M.rewardLabel(q.reward)+'</span>'+trackChip(q.track)+'</div>';}
   else html+='<div class="qrow" style="font-size:12px;opacity:.7"><span class="qico">🔒</span><span class="qmain">'+lbl+(q.type==='ribbons'?' <span style="font-size:10px;color:#8c7a63">🎀 '+q.goal+' '+(DISC_LBL[q.disc||'any']||'')+'ribbons</span>':'')+'</span><span style="font-size:11px;color:#b8a888">'+esc(giver)+'</span>'+trackChip(q.track)+'</div>';
  });
  if(!m)html+='<div class="qrow done"><span class="qico">🏆</span><span class="qmain"><b>Every chapter so far is done.</b></span></div>';
  if(nb)html+='<div class="qrow" style="background:#f4f7ff"><span class="qico">📅</span><span class="qmain"><b>Next chapter: '+esc(nb.title)+'</b><span style="font-size:11px;color:#8c7a63;font-weight:600">arrives with the new season in '+daysUntil(nb.releaseAt)+' day'+(daysUntil(nb.releaseAt)===1?'':'s')+' · '+nb.missions.length+' missions</span></span></div>';
  else html+='<div style="font-size:11px;color:#8c7a63">A new book of the story arrives with every season.</div>';
  return html;
 }});
 U.questTab({id:'side',label:'📌 Side',pos:1,render(s){
  const act=Object.keys(s.side.active).map(id=>SIDE_BY[id]).filter(Boolean);
  const doneN=SIDEQ.filter(q=>sideDone(s,q)).length;
  let html='<div class="qrow" style="background:#fffaf0"><span class="qico">📌</span><span class="qmain"><b>Side quests · '+act.length+'/'+SIDE_CAP+' on the go</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+(s.side.n||0)+' finished · '+doneN+' of '+SIDEQ.length+' cleared · ask anyone in the Basin for more</span></span></div>';
  for(const q of act){const p=s.side.active[q.id].p||0;const done=p>=q.goal;
   html+='<div class="qrow'+(done?' done':'')+'"><span class="qico">'+q.icon+'</span><span class="qmain"><b>'+esc(q.label)+'</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+(done?'Done — turn in to ':'for ')+esc(npcShort(q.npc))+' · '+esc(q.region||'')+'</span><span class="qbar"><span class="qfill" style="width:'+Math.round(100*Math.min(1,p/q.goal))+'%"></span></span></span><span style="font-size:11px;color:#8c7a63">'+Math.floor(Math.min(p,q.goal))+'/'+q.goal+' · '+M.rewardLabel(q.reward)+'</span></div>';}
  if(!act.length)html+='<span style="font-size:12px;color:#8c7a63">Nothing on the go. Everyone with a 📌 in their dialogue has work for you.</span>';
  html+='<div style="font-size:11px;color:#8c7a63;letter-spacing:.05em;margin-top:8px">👥 PEOPLE OF THE BASIN</div>';
  for(const d of NPC_DEFS){const met=!!(s.met&&s.met[d.id]);const avail=sideAvailable(s,d.id).length;const total=SIDEQ.filter(q=>q.npc===d.id).length;const dn=SIDEQ.filter(q=>q.npc===d.id&&sideDone(s,q)).length;
   html+='<div class="qrow" style="font-size:12px'+(met?'':';opacity:.75')+'"><span class="qico">'+(met?d.icon:'❔')+'</span><span class="qmain"><b>'+(met?esc(d.name):'Someone in '+esc(REGION_OF[d.id]||'the Basin'))+'</b><span style="font-size:11px;color:#8c7a63;font-weight:600">'+esc(REGION_OF[d.id]||'')+(ROLE_LBL[d.id]?' · '+esc(ROLE_LBL[d.id]):'')+(d.role?' · opens the '+esc((d.role.label||'shop').replace(/^[^\w]+/,'')):'')+'</span></span><span style="font-size:11px;color:#8c7a63">'+dn+'/'+total+' done'+(avail?' · '+avail+' waiting':'')+'</span></div>';}
  return html;
 }});

 /* ---------- per frame ---------- */
 let pillTxt='', pillT=0, pillSig='', visitT=0;
 G.on('tick',(dt,t)=>{
  tickFoal(dt); tickCine(dt);
  const m=cur(); const i=idx();
  if(m&&m.type==='cine'&&prog()<m.goal&&!cine.on&&fresh().story.era!==2)startCine();
  pillT+=dt; const sig=i+':'+prog()+':'+STORY.length; if(pillT>0.25||!pillTxt||sig!==pillSig){pillT=0;pillSig=sig;
   let s2;
   if(m){const giver=npcShort(giverOf(m));const done=prog()>=m.goal;s2=storyPct()+'% · '+(m.ch?txt(m.ch)+' · ':'')+txt(m.label)+(done?' ✅ → tell '+giver+'!':(m.goal>1?' ('+Math.floor(prog())+'/'+m.goal+')':''));}
   else {const nb=nextBook();s2=storyPct()+'% · '+(nb?'📅 Next chapter, '+nb.title+', in '+daysUntil(nb.releaseAt)+' day'+(daysUntil(nb.releaseAt)===1?'':'s'):'Story complete! 🏆');}
   pillTxt='📜 '+s2;
  }
  if(pend.gallop>0){pend.t+=dt;if(pend.gallop>=25||pend.t>2){sideEvt('gallop',pend.gallop);pend.gallop=0;pend.t=0;}}
  visitT+=dt; if(visitT>1){visitT=0;const s=fresh();const p=H.player;
   for(const id in (s.side&&s.side.active)||{}){const q=SIDE_BY[id];if(!q||q.type!=='visit'||(s.side.active[id].p||0)>=q.goal)continue;if(Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<(q.r||10))sideEvt('visit',1);}
   if(m&&m.type==='roundup'&&prog()<m.goal)Q.questEvt('roundup',0);
   flushPendingName();}
 });
 G.on('questPill',()=>pillTxt);
 G.on('state',o=>{const s=fresh();o.story=Object.assign(o.story||{},{pct:storyPct(),era:s.story&&s.story.era,name:s.story&&s.story.name,available:STORY.length,book:cur()?chapterOf(cur()):null,type:cur()?cur().type:null,books:releasedBooks,side:{active:activeCount(s),done:s.side?s.side.n:0,total:SIDEQ.length},daily:Q.todayDaily().length,npcs:NPC_DEFS.length});});
 G.on('boot',s=>{
  if(s&&s.story&&s.story.era!==2&&idx()<PRO_N)try{toast('🌧️ Prologue: The Spring Flood — talk to Grandpa Wren by the barn.');}catch(e){}
  for(const q of ['ribbons','ranchlvl','build2'])if(cur()&&cur().type===q)Q.questEvt(q,0);
 });
 /* what QA reads through window.__features */
 G.storyQuests={STORY_BOOKS,SIDEQ,SIDE_BY,STARTER_COATS,PRO_N,storyPct,ribbonCount,sideEvt,takeSide,turnInSide,sideAvailable,nameDialog,startCine,cine,releaseBooks,nextBook,openStarterNaming,stall:()=>stall,foal:()=>foal,ROSTER,RIDERS,DAILY_N:6};
}
