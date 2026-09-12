/* story-quests package check.
   Four boots of ranch3d.html?qa=story-quests against a local server:
    1. a brand-new save — the prologue (name the foal, ride, the storm, June's key, the old stall
       with naming + coat), the NPC roster and roles, six dailies + umbrella, the quest log tabs;
    2. a legacy save — the story-index migration, side quests (take / progress / turn in / cap),
       the #dlg rename and the arrival naming prompt, the quest board, the ridden story horse's
       moonlit coat, the state dump;
    3. a save parked on 'Let the Show Begin' — the ribbon snapshot type and awardRibbons wiring;
    4. a save parked on the builder chapter — real placements through the pointer, builder points,
       ranch level, then the clue hunt across Mia, Theo and Wren, and the season cadence.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-story-quests.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const SAVE_KEY='starRanchFable_v1';
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 900 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},900000).unref();
const ARGS=['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist'];
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
async function boot(page,tag){
 await page.goto(base+'/ranch3d.html?qa=story-quests&'+tag+'='+Date.now(),{waitUntil:'load',timeout:120000}); stage(tag+' loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage(tag+' horseReady');
}
/* helpers evaluated in the page */
const H=`
 const G=window.__features, SQ=G.storyQuests, $=id=>document.getElementById(id);
 const sv=()=>G.save.fresh();
 const st=()=>JSON.parse(render_game_to_text());
 const key=code=>{try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(e){}window.dispatchEvent(new KeyboardEvent('keydown',{code}));};
 const goto=(x,z)=>{G.horse.player.pos.set(x,0,z);G.horse.player.speed=0;window.advanceTime(120);};
 const talk=(x,z)=>{goto(x,z);key('KeyE');return $('dlg').style.display==='block';};
 const dlgText=()=>$('dlg').textContent;
 const click=sel=>{const b=document.querySelector(sel);if(!b)return false;b.click();return true;};
 const wrenTalk=()=>talk(-11,-17.5);
 const claim=()=>{wrenTalk();const ok=/Claim/.test(dlgText());click('#dlgBtn');return ok;};
`;
const run=(page,code)=>page.evaluate('(()=>{'+H+code+'})()');
(async()=>{
 browser=await chromium.launch({headless:true,args:ARGS});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[]; let dialogs=0;
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{dialogs++;d.dismiss().catch(()=>{});});
 stage('launch');

 /* ================= 1. a brand-new save: the prologue ================= */
 await boot(page,'fresh');
 const r1=await run(page,`
  const out={};
  out.installed=G.installed.includes('story-quests'); out.errors=G.errors.slice(); out.hasSQ=!!SQ;
  const s0=sv(); out.fresh={idx:s0.story.idx,prog:s0.story.prog,era:s0.story.era,keys:s0.keys,named:s0.named,keysGiven:s0.keysGiven,mig:!!s0.mig['sq-prologue'],coins:s0.coins,gems:s0.gems,tack:(s0.tack||[]).length};
  out.state0=st().story; out.pill0=$('questTrack').textContent;
  out.storyLen=G.quest.STORY.length; out.booksTotal=G.quest.STORY.length+SQ.STORY_BOOKS.filter(b=>!b.added).reduce((a,b)=>a+b.missions.length,0);
  out.types=[...new Set(G.quest.STORY.map(m=>m.type))]; out.tracks=G.quest.STORY.filter(m=>m.track==='search').length+'/'+G.quest.STORY.filter(m=>m.track==='qualify').length;
  const handled=new Set(['carrots','cleanjump','gallop','visit','event','talk','forage','train','photo','tame','kestrel','guess','name','cine','door','ribbons','build','build2','ranchlvl','clues','roundup','side','fish','shoe','ft','feed','groom','pet','water','wildphoto','trail','breed']);
  for(const k in (G.quest.types||{}))handled.add(k);   // sibling packages register their own mission types (tacklvl, …) and braid missions in
  out.badTypes=G.quest.STORY.concat(SQ.STORY_BOOKS.flatMap(b=>b.missions)).filter(m=>!handled.has(m.type)).map(m=>m.type);
  out.badNpc=G.quest.STORY.concat(SQ.STORY_BOOKS.flatMap(b=>b.missions)).filter(m=>m.npc&&!G.quest.NPC_DEFS.some(d=>d.id===m.npc)).map(m=>m.npc);
  out.npcs={n:G.quest.NPC_DEFS.length,roles:G.quest.NPC_DEFS.filter(d=>d.role).length,riders:G.world.npcList.filter(q=>q.def&&q.def.rider).length,ids:G.quest.NPC_DEFS.map(d=>d.id)};
  out.foal=!!SQ.foal(); out.stall=!!SQ.stall();
  out.foalCoat=(()=>{const f=SQ.foal();if(!f)return null;let hex=null;f.parts.group.traverse(o=>{if(!hex&&o.isMesh&&o.material&&o.material.emissive&&o.material.emissiveIntensity>0)hex=o.material.emissive.getHexString();});return hex;})();
  out.kestrelRow=((G.tables.BREEDS3.find(b=>b[0]==='kestrel')||[])[7])||null;
  /* mission 0: name the foal */
  out.talk0=wrenTalk(); out.nameIn=!!$('nameIn'); out.dlg0=dlgText().slice(0,80);
  if($('nameIn')){$('nameIn').value='Snowfall';click('#dlgBtn');}
  const s1=sv(); window.advanceTime(300); out.named={name:s1.story.name,prog:s1.story.prog,pill:$('questTrack').textContent,active:document.activeElement&&document.activeElement.tagName};
  wrenTalk(); out.claim0=/Claim/.test(dlgText())&&/50🪙/.test(dlgText())&&/3 🥕/.test(dlgText()); out.claim0Txt=dlgText().slice(0,90); click('#dlgBtn');
  const s2=sv(); out.after0={idx:s2.story.idx,coins:s2.coins-s0.coins,carrot:s2.items.carrot-10,named:s2.stats.named};
  /* mission 1: gallop 300 with her */
  G.quest.questEvt('gallop',300); window.advanceTime(50); out.gallopPill=$('questTrack').textContent;
  out.claim1=claim(); out.idx2=sv().story.idx;
  /* mission 2: the storm plays itself */
  window.advanceTime(400); const cineEl=()=>$('sqCine')||{classList:{contains:()=>false}}; out.cineOn=SQ.cine.on&&cineEl().classList.contains('show');
  window.advanceTime(10500); const s3=sv(); out.cine={on:SQ.cine.on,shown:cineEl().classList.contains('show'),era:s3.story.era,prog:s3.story.prog,foalGone:!SQ.foal(),name:s3.story.name};
  out.claim2=claim(); out.idx3=sv().story.idx;
  /* mission 3: June and the Silver Key */
  out.juneTalk=talk(9,-11); out.juneDlg=dlgText().slice(0,60); const s4=sv(); out.june={keys:s4.keys,keysGiven:s4.keysGiven,claimable:/Claim/.test(dlgText())}; click('#dlgBtn');
  const s5=sv(); out.idx4=s5.story.idx; out.keys4=s5.keys; out.apples=s5.items.apple; out.coins5=s5.coins;
  /* mission 4: the old stall */
  out.wrenDoor=wrenTalk(); out.doorDlg=/old stall/.test(dlgText()); click('#dlgBtn');
  goto(-3,-21); out.ctx=$('ctx').textContent; key('KeyE');
  out.stallDlg={open:$('dlg').style.display,nameIn:!!$('nameIn'),def:$('nameIn')&&$('nameIn').value,coats:document.querySelectorAll('[data-nm^="coat:"]').length};
  click('[data-nm="coat:grey"]'); if($('nameIn')){$('nameIn').value='Biscuit';click('#dlgBtn');}
  const s6=sv(); out.stall2={keys:s6.keys,door:!!s6.doors.starter,name:s6.horses[0].name,body:s6.horses[0].colors.body,chosen:s6.starterCoat.chosen,named:s6.named,prog:s6.story.prog,nameEl:$('nameEl').textContent,stateName:st().horse.name};
  out.claim4=claim(); window.advanceTime(50); const s7=sv(); out.bundle={idx:s7.story.idx,coins:s7.coins-out.coins5,gems:s7.gems-s5.gems,tack:(s7.tack||[]).length,rarity:s7.tack[0]&&s7.tack[0].rarity,carrot:s7.items.carrot-s5.items.carrot,pill:$('questTrack').textContent};
  /* roster: Bram opens the saddlery */
  out.bram=talk(44,-48); out.bramRole=!!$('dlgRole')&&$('dlgRole').textContent; out.bramTxt=dlgText().slice(0,60); click('#dlgRole');
  out.shop={shown:$('shopPanel').style.display,tackOn:!!document.querySelector('[data-shoptab="tack"].on')}; G.hidePanels();
  out.met=Object.keys(sv().met);
  /* a second sporthorse arrives in the coat you chose */
  G.save.sync(s=>{G.horse.grantHorse(s,'bay-sporthorse',{src:'qa'});}); out.adopt=(()=>{const h=sv().horses.find(h=>h.breed==='bay-sporthorse'&&h.name!=='Biscuit');return h?{body:h.colors.body,mane:h.colors.mane}:null;})();
  /* stable header offers the coat only until chosen */
  G.ui.openStable(); out.coatRow=document.querySelectorAll('[data-fx^="sq:coat:"]').length; G.hidePanels();
  /* dailies + umbrella */
  const today=G.quest.todayDaily(); out.daily={n:today.length,sp:G.quest.DAILYQ.every(q=>q.r.sp===10),train:G.quest.DAILYQ.some(q=>q.type==='train'),build:G.quest.DAILYQ.some(q=>q.type==='build'),total:G.quest.DAILYQ.length,roll:sv().dq.roll};
  const q0=today[0]; let sp0=0,g0=0; G.save.sync(s=>{s.dq.prog[q0.type]=q0.goal;sp0=(s.sp&&s.sp.pts)||0;g0=s.gems;}); G.quest.claimDaily(q0.type);
  const s8=sv(); out.dailyClaim={sp:(s8.sp.pts||0)-sp0,gems:s8.gems-g0,rg:q0.r.g,claimed:!!s8.dq.claimed[q0.type]};
  let k0=0,g1=0,sp1=0; G.save.sync(s=>{for(const q of today)s.dq.claimed[q.type]=true;k0=s.keys;g1=s.gems;sp1=s.sp.pts;}); G.quest.claimUmbrella?0:0; document.querySelector('[data-q="um:x"]')?0:0;
  G.ui.renderQuests(); click('[data-q="tab:daily"]'); out.umbrellaBtn=!!document.querySelector('[data-q="um:x"]'); click('[data-q="um:x"]');
  const s9=sv(); out.umbrella={on:s9.dq.umbrella,keys:s9.keys-k0,gems:s9.gems-g1,sp:s9.sp.pts-sp1};
  click('[data-q="um:x"]'); out.umbrellaTwice=sv().keys-k0;
  /* quest log */
  G.ui.openQuests(); click('[data-q="tab:story"]'); const qp=$('questPanel');
  out.log={shown:qp.style.display,pct:/Story \\d+%/.test(qp.textContent),rows:qp.querySelectorAll('.qrow').length,ribbonRow:/🎀 5 show-jumping ribbons/.test(qp.textContent),next:/Next chapter: Frost on the Falls/.test(qp.textContent),cur:/Collect 5 carrots/.test(qp.textContent)};
  click('[data-q="tab:side"]'); out.sideTab={rows:qp.querySelectorAll('.qrow').length,people:/PEOPLE OF THE BASIN/.test(qp.textContent)}; G.hidePanels();
  out.sideq={n:SQ.SIDEQ.length,badNpc:SQ.SIDEQ.filter(q=>!G.quest.NPC_DEFS.some(d=>d.id===q.npc)).length,badType:SQ.SIDEQ.filter(q=>!['gallop','cleanjump','feed','groom','pet','water','carrots','photo','event','fish','shoe','ft','build','train','wildphoto','trail','tame','breed','forage','talkn','visit'].includes(q.type)).length,hand:SQ.SIDEQ.filter(q=>q.hand).length,regions:[...new Set(SQ.SIDEQ.map(q=>q.region))].length};
  out.ach={named:G.quest.ACHS.some(a=>a.id==='named1'),story8:G.quest.ACHS.find(a=>a.id==='story8').goal,book2:G.quest.ACHS.find(a=>a.id==='book2').goal,w2:G.quest.STORY.findIndex(m=>m.ev==='w2')+1};
  out.state=st().story; out.migAll=Object.keys(sv().mig).filter(k=>k.startsWith('sq-'));
  return out;`);
 check('package installed without error',r1.installed&&r1.errors.length===0&&r1.hasSQ,{errors:r1.errors});
 check('fresh save starts the prologue: idx 0, era 1, 0 keys, unnamed, no tack',r1.fresh&&r1.fresh.idx===0&&r1.fresh.era===1&&r1.fresh.keys===0&&r1.fresh.named===false&&r1.fresh.keysGiven===false&&r1.fresh.mig&&r1.fresh.tack===0,r1.fresh);
 check('quest pill carries the story percentage and the prologue mission',/^📜 \d{1,3}% · /.test(r1.pill0)&&/Name the grey foal/.test(r1.pill0),r1.pill0);
 check('render_game_to_text story: pct/era/book',r1.state0&&r1.state0.pct===0&&r1.state0.era===1&&/Prologue/.test(r1.state0.book),r1.state0);
 check('story arc: >=55 missions available, >=60 with the scheduled book, two tracks',r1.storyLen>=55&&r1.booksTotal>=60&&r1.badTypes.length===0&&r1.badNpc.length===0,{len:r1.storyLen,total:r1.booksTotal,tracks:r1.tracks,badTypes:r1.badTypes,badNpc:r1.badNpc,types:r1.types});
 check('NPC roster: 12 people, 3 with roles, Mia and Theo talkable',r1.npcs&&r1.npcs.n>=12&&r1.npcs.roles>=3&&r1.npcs.riders===2,r1.npcs);
 check('story foal and the old stall are in the world',r1.foal&&r1.stall);
 check('the foal wears the moonlit coat; the Kestrel row carries coat + glow',r1.foalCoat==='9fb4dc'&&r1.kestrelRow&&r1.kestrelRow.coat==='moonlit'&&r1.kestrelRow.glow===true&&r1.kestrelRow.story===true,{foal:r1.foalCoat,row:r1.kestrelRow});
 check('mission 0 opens the naming dialogue at Wren',r1.talk0&&r1.nameIn,r1.dlg0);
 check('naming writes s.story.name and completes the mission; the pill says so; focus is released',r1.named&&r1.named.name==='Snowfall'&&r1.named.prog===1&&/✅/.test(r1.named.pill)&&r1.named.active!=='INPUT',r1.named);
 check('claim pays the bundle label (50🪙 + 3 🥕) and advances',r1.claim0&&r1.after0.idx===1&&r1.after0.coins===50&&r1.after0.carrot===3&&r1.after0.named===1,{after:r1.after0,txt:r1.claim0Txt});
 check('mission 1 speaks the foal\'s name in the pill',/Snowfall/.test(r1.gallopPill)&&/300\/300|✅/.test(r1.gallopPill),r1.gallopPill);
 check('mission 1 claimed',r1.claim1&&r1.idx2===2,r1.idx2);
 check('the storm plays as an overlay driven by the tick',r1.cineOn===true);
 check('storm ends: era 2, foal gone, cine mission done, name kept',r1.cine&&!r1.cine.on&&!r1.cine.shown&&r1.cine.era===2&&r1.cine.prog===1&&r1.cine.foalGone&&r1.cine.name==='Snowfall',r1.cine);
 check('mission 2 claimed',r1.claim2&&r1.idx3===3,r1.idx3);
 check('Auntie June hands over the first Silver Key in person',r1.juneTalk&&r1.june.keys===1&&r1.june.keysGiven&&r1.june.claimable,r1.june);
 check('June mission claimed (+2 🍎)',r1.idx4===4&&r1.keys4===1&&r1.apples===4,{idx:r1.idx4,keys:r1.keys4,apples:r1.apples});
 check('Wren explains the old stall',r1.wrenDoor&&r1.doorDlg);
 check('old stall prompt + naming with three coats',/old stall/.test(r1.ctx)&&r1.stallDlg.open==='block'&&r1.stallDlg.nameIn&&r1.stallDlg.def==='Clover'&&r1.stallDlg.coats===3,{ctx:r1.ctx,dlg:r1.stallDlg});
 check('door spends the key, names the starter, applies the grey coat',r1.stall2&&r1.stall2.keys===0&&r1.stall2.door&&r1.stall2.name==='Biscuit'&&r1.stall2.body==='#b9b9bd'&&r1.stall2.chosen&&r1.stall2.named&&r1.stall2.prog===1&&/^Biscuit/.test(r1.stall2.nameEl)&&r1.stall2.stateName==='Biscuit',r1.stall2);
 check('starter bundle: +100🪙 +5💎 + Common tack + 5 🥕, story moves to Collect 5 carrots',r1.claim4&&r1.bundle.idx===5&&r1.bundle.coins===100&&r1.bundle.gems===5&&r1.bundle.tack===1&&r1.bundle.rarity==='Common'&&r1.bundle.carrot===5&&/Collect 5 carrots/.test(r1.bundle.pill),r1.bundle);
 check('Bram the Saddler opens the tack shop from his dialogue',r1.bram&&/saddlery/.test(r1.bramRole||'')&&r1.shop.shown==='flex'&&r1.shop.tackOn,{talk:r1.bram,role:r1.bramRole,txt:r1.bramTxt,shop:r1.shop});
 check('people met are recorded',r1.met.includes('bram')&&r1.met.includes('june'),r1.met);
 check('coat card leaves the stable once chosen',r1.coatRow===0,r1.coatRow);
 check('a later sporthorse (adoption) wears the chosen grey coat',r1.adopt&&r1.adopt.body==='#b9b9bd'&&r1.adopt.mane==='#5a5a60',r1.adopt);
 check('six dailies, 23+ templates, SP on all, train/build rows, roll snapshotted',r1.daily&&r1.daily.n===6&&r1.daily.sp&&r1.daily.train&&r1.daily.build&&r1.daily.total>=23&&r1.daily.roll&&r1.daily.roll.length===6,r1.daily);
 check('claimDaily pays 10 club SP and the gems',r1.dailyClaim&&r1.dailyClaim.sp===10&&r1.dailyClaim.gems===r1.dailyClaim.rg&&r1.dailyClaim.claimed,r1.dailyClaim);
 check('umbrella needs all six and pays +1🗝️ +4💎 +40⭐; second claim is a no-op',r1.umbrellaBtn&&r1.umbrella.on&&r1.umbrella.keys===1&&r1.umbrella.gems===4&&r1.umbrella.sp===40&&r1.umbrellaTwice===1,r1.umbrella);
 check('quest log Story tab: percentage, every mission, ribbon gate, next chapter',r1.log&&r1.log.shown==='flex'&&r1.log.pct&&r1.log.rows>=r1.storyLen&&r1.log.ribbonRow&&r1.log.next&&r1.log.cur,r1.log);
 check('quest log Side tab lists people of the Basin',r1.sideTab&&r1.sideTab.rows>=13&&r1.sideTab.people,r1.sideTab);
 check('side quests: >=200 generated + 24 hand-written over 8+ regions, all givers/types valid',r1.sideq&&r1.sideq.n>=200&&r1.sideq.badNpc===0&&r1.sideq.badType===0&&r1.sideq.hand===24&&r1.sideq.regions>=8,r1.sideq);
 check('achievements follow the new mission count',r1.ach&&r1.ach.named&&r1.ach.story8===r1.ach.w2&&r1.ach.book2>r1.ach.w2,r1.ach);
 check('all story migrations tagged on the save',r1.migAll.length>=6,r1.migAll);

 /* ================= 2. a legacy save: migration, side quests, naming ================= */
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(1200);
 await page.evaluate(()=>{
  const legacy={v:2,ranchName:'Meadowlark Ranch',founded:Date.now()-864e5*30,coins:3000,gems:20,items:{carrot:3},nextId:2,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:false,
   lastSeen:Date.now()-3600e3,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:2,tack:[],stats:{earned:5000},
   horses:[{id:1,name:'Clover',breed:'bay-sporthorse',colors:{body:'#765035',mane:'#221b16'},horn:false,rainbow:false,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},level:4,xp:0,bond:25,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null}],
   story:{idx:3,prog:1}};
  localStorage.setItem('starRanchFable_v1',JSON.stringify(legacy));
 });
 await boot(page,'legacy');
 const r2=await run(page,`
  const out={}; const s0=sv();
  out.mig={idx:s0.story.idx,prog:s0.story.prog,label:G.quest.STORY[s0.story.idx].label,era:s0.story.era,named:s0.named,keysGiven:s0.keysGiven,keys:s0.keys,coat:s0.starterCoat.chosen,v:s0.story.v};
  out.foal=!!SQ.foal(); out.pill=$('questTrack').textContent;
  /* side quests at Ada */
  out.ada=talk(39,-41); const offers=[...document.querySelectorAll('[data-fx^="sq:take:"]')].map(b=>b.dataset.fx.slice(8)); out.offers=offers;
  click('[data-fx="sq:take:'+offers[0]+'"]'); const q=SQ.SIDE_BY[offers[0]]; out.q={id:q.id,type:q.type,goal:q.goal,item:q.item||null};
  const s1=sv(); out.taken=Object.keys(s1.side.active);
  SQ.sideEvt(q.type,q.goal,q.item||undefined); const s2=sv(); out.prog=s2.side.active[q.id]&&s2.side.active[q.id].p;
  G.ui.openQuests(); click('[data-q="tab:side"]'); out.sideRow=/Done — turn in to Ada/.test($('questPanel').textContent); G.hidePanels();
  out.ada2=talk(39,-41); out.turnBtn=!!document.querySelector('[data-fx="sq:turnin:'+q.id+'"]'); const c0=sv().coins; click('[data-fx="sq:turnin:'+q.id+'"]');
  const s3=sv(); out.turned={n:s3.side.n,done:!!s3.side.done[q.id],active:Object.keys(s3.side.active).length,dc:s3.coins-c0,rc:q.reward.c,sideLife:s3.life.side,stat:s3.stats.side};
  /* tier two of the same line unlocks, the cap holds at five */
  out.tier2=SQ.sideAvailable(sv(),'ada').some(x=>x.id===q.id.replace(/-1$/,'-2'));
  const more=SQ.SIDEQ.filter(x=>x.tier===1&&x.npc!=='ada').slice(0,6).map(x=>x.id); for(const id of more)SQ.takeSide(id);
  out.cap=Object.keys(sv().side.active).length;
  /* gallop side progress is throttled through the tick */
  const gq=Object.keys(sv().side.active).map(id=>SQ.SIDE_BY[id]).find(x=>x.type==='gallop');
  if(gq){G.quest.dailyEvt('gallop',30);window.advanceTime(2500);out.gallopSide=sv().side.active[gq.id].p;}else out.gallopSide='none';
  /* the quest board by the arena */
  goto(5,-1); out.boardCtx=$('ctx').textContent; key('KeyE'); out.boardTab={shown:$('questPanel').style.display,side:!!document.querySelector('[data-q="tab:side"].on')}; G.hidePanels();
  /* rename through the #dlg dialogue, no native prompt */
  G.ui.openCare(); click('[data-care="rename"]'); out.renameDlg={open:$('dlg').style.display,input:!!$('nameIn')};
  if($('nameIn')){$('nameIn').value='Rowan';click('#dlgBtn');} out.renamed={save:sv().horses[0].name,el:$('nameEl').textContent,state:st().horse.name}; G.hidePanels();
  /* a new horse asks for its name */
  G.save.sync(s=>{G.horse.grantHorse(s,'bay',{src:'shop'});}); window.advanceTime(1300);
  out.arrival={open:$('dlg').style.display,input:!!$('nameIn'),text:dlgText().slice(0,40)};
  if($('nameIn')){$('nameIn').value='Pippin';click('#dlgBtn');} out.arrivalName=sv().horses[1].name;
  out.dice=(()=>{G.ui.nameDialog({title:'t',def:'Zed',onDone:()=>{}});const v0=$('nameIn').value;click('[data-nm="rnd"]');const v1=$('nameIn').value;click('[data-nm="x"]');return {v0,v1,closed:$('dlg').style.display};})();
  /* the story horse: granted by QA (taming is a live chase), then ridden */
  G.save.sync(s=>{G.horse.grantHorse(s,'kestrel',{src:'qa',name:'Snowfall'});}); G.horse.reloadHorses(); const ki=sv().horses.findIndex(h=>h.breed==='kestrel'); $('horseSel').value=String(ki); $('horseSel').onchange();
  const kh=sv().horses[ki]; out.kestrelSave={ki,coat:kh.coat,glow:kh.glow,name:kh.name};
  out.state=st().story;
  return out;`);
 await page.waitForFunction(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading&&s.horse&&s.horse.breed==='kestrel';}catch(e){return false;}},null,{timeout:90000,polling:250}).catch(()=>{}); stage('kestrel ridden');
 const r2b=await run(page,`
  const RIG=G.horse.RIG(); const mat=RIG&&RIG.skin&&RIG.skin.material; window.advanceTime(200);
  return {breed:st().horse.breed,artist:!!(RIG&&RIG.profile&&RIG.profile.artistBreed),matName:mat&&mat.name,fmName:RIG&&RIG.fantasyMaterial&&RIG.fantasyMaterial.name,theme:RIG&&RIG.fantasyAppearance&&RIG.fantasyAppearance.theme,emissive:mat&&mat.emissive&&mat.emissive.getHexString()};`);
 check('legacy save: story index migrates behind the inserted chapters (3 → Visit Loon Lake), era 2, named, key kept',r2.mig&&r2.mig.label==='Visit Loon Lake'&&r2.mig.prog===1&&r2.mig.era===2&&r2.mig.named===true&&r2.mig.keysGiven===true&&r2.mig.keys===2&&r2.mig.v===1,r2.mig);
 check('no prologue foal for a returning player',r2.foal===false);
 check('Ada offers up to three side quests',r2.ada&&r2.offers.length===3,r2.offers);
 check('take a side quest → active; sideEvt progresses it; log shows turn-in hint',r2.taken.length===1&&r2.prog===r2.q.goal&&r2.sideRow,{taken:r2.taken,prog:r2.prog,q:r2.q,row:r2.sideRow});
 check('turn in pays the reward, counts it, fires the daily',r2.ada2&&r2.turnBtn&&r2.turned.n===1&&r2.turned.done&&r2.turned.active===0&&r2.turned.dc===r2.turned.rc&&r2.turned.sideLife===1&&r2.turned.stat===1,r2.turned);
 check('tier two unlocks after tier one; active cap holds at 5',r2.tier2&&r2.cap===5,{tier2:r2.tier2,cap:r2.cap});
 check('gallop side progress flushes through the tick',r2.gallopSide==='none'||r2.gallopSide===30,r2.gallopSide);
 check('quest board opens the Side tab',/Quest board/.test(r2.boardCtx)&&r2.boardTab.shown==='flex'&&r2.boardTab.side,{ctx:r2.boardCtx,tab:r2.boardTab});
 check('rename uses the #dlg dialogue and lands everywhere',r2.renameDlg.open==='block'&&r2.renameDlg.input&&r2.renamed.save==='Rowan'&&/^Rowan/.test(r2.renamed.el)&&r2.renamed.state==='Rowan',r2.renamed);
 check('a granted horse asks for its name on the next tick',r2.arrival.open==='block'&&r2.arrival.input&&r2.arrivalName==='Pippin',{arrival:r2.arrival,name:r2.arrivalName});
 check('dice picks another name; Later closes',r2.dice&&r2.dice.v0==='Zed'&&r2.dice.v1!=='Zed'&&r2.dice.closed==='none',r2.dice);
 check('the granted Kestrel carries coat moonlit + glow and the prologue name',r2.kestrelSave&&r2.kestrelSave.coat==='moonlit'&&r2.kestrelSave.glow===true&&r2.kestrelSave.name==='Snowfall',r2.kestrelSave);
 check('ridden, the Kestrel wears the moonlit shader on her rig',r2b&&r2b.breed==='kestrel'&&(/moonlit/i.test(r2b.matName||'')||/moonlit/i.test(r2b.fmName||'')||r2b.theme==='moonlit'||r2b.emissive==='9fb4dc'),r2b);
 check('state dump: side counts and daily count',r2.state&&r2.state.side&&r2.state.side.done===1&&r2.state.daily===6&&r2.state.available>=55,r2.state);
 check('no native prompt()/confirm() fired',dialogs===0,dialogs);

 /* ================= 3. parked on 'Let the Show Begin': ribbon gates ================= */
 const seed3=await page.evaluate(()=>{const G=window.__features;const s=G.save.fresh();const i=G.quest.STORY.findIndex(m=>m.type==='ribbons'&&m.disc==='jump');const jumps=G.tables.EVENTS3.filter(e=>!e.race&&!e.dressage).map(e=>e.id);return {i,mig:s.mig,jumps};});
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(800);
 await page.evaluate(seed=>{
  const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));
  s.story={idx:seed.i,prog:0,era:2,name:'Snowfall',clues:[],v:1}; s.mig=seed.mig; s.ribbons={[seed.jumps[0]]:2,[seed.jumps[1]]:1}; s.ribbonTotal=3; s.coins=5000;
  localStorage.setItem('starRanchFable_v1',JSON.stringify(s));
 },seed3);
 await boot(page,'ribbons');
 const r3=await run(page,`
  const out={}; const s0=sv(); out.idx=s0.story.idx; out.type=G.quest.STORY[s0.story.idx].type;
  out.boot={prog:s0.story.prog,pill:$('questTrack').textContent,count:SQ.ribbonCount(s0,'jump')};
  out.ada=talk(39,-41); out.dlg=dlgText(); out.hasEvents=!!document.querySelector('[data-fx="open:eventsPanel"]'); click('#dlgBtn');
  const ev=G.tables.EVENTS3.find(e=>e.id==='${seed3.jumps[0]}'); const RB=G.course.awardRibbons(ev,1,0,{acc:1}); G.run('courseFinish',{c:{rb:{acc:1},ce:{}},ev,stars:3,RB,pay:0,dressage:false});
  window.advanceTime(50); const s1=sv(); out.after={rib:RB.rib,prog:s1.story.prog,count:SQ.ribbonCount(s1,'jump'),any:SQ.ribbonCount(s1,'any'),pill:$('questTrack').textContent};
  G.ui.openQuests(); click('[data-q="tab:story"]'); out.log=/show-jumping ribbons/.test($('questPanel').textContent); G.hidePanels();
  out.claim=(()=>{talk(39,-41);const ok=/Claim/.test(dlgText());click('#dlgBtn');return ok;})(); out.idx2=sv().story.idx; out.next=G.quest.STORY[sv().story.idx].label;
  out.anyGate=G.quest.STORY.slice(out.idx2).some(m=>m.type==='ribbons'&&(m.disc||'any')==='any');
  out.riding=SQ.ribbonCount({ribbons:{r1:2,d1:3,h1:4}},'riding');
  return out;`);
 check('boot snapshots jump ribbons into the ribbons mission (3/5)',r3.type==='ribbons'&&r3.boot.prog===3&&r3.boot.count===3&&/\(3\/5\)/.test(r3.boot.pill),r3.boot);
 check('Ada\'s dialogue shows the ribbon count and an Events button',r3.ada&&/\(3\/5\)/.test(r3.dlg)&&r3.hasEvents);
 check('awardRibbons + courseFinish complete the gate (5/5)',r3.after&&r3.after.rib>=2&&r3.after.prog===5&&r3.after.count>=5&&/✅/.test(r3.after.pill),r3.after);
 check('story tab names the discipline',r3.log);
 check('claim moves past the jump gate; the any-ribbon gate is still ahead',r3.claim&&r3.idx2>r3.idx&&r3.anyGate,{next:r3.next,idx:r3.idx,idx2:r3.idx2,anyGate:r3.anyGate});
 check('riding discipline counts races and dressage only',r3.riding===5,r3.riding);

 /* ================= 4. parked on the builder chapter, then the clue hunt ================= */
 const seed4=await page.evaluate(()=>{const G=window.__features;const s=G.save.fresh();return {i:G.quest.STORY.findIndex(m=>m.type==='build'&&m.item==='fence'),mig:s.mig};});
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(800);
 await page.evaluate(seed=>{
  const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));
  s.story={idx:seed.i,prog:0,era:2,name:'Snowfall',clues:[],v:1}; s.mig=seed.mig; s.coins=9000; s.decor=[]; s.builderBonus=0; delete s.ribbons;
  localStorage.setItem('starRanchFable_v1',JSON.stringify(s));
 },seed4);
 await boot(page,'builder');
 const r4=await run(page,`
  const out={}; out.type=G.quest.STORY[sv().story.idx].type;
  out.wren=wrenTalk(); out.buildBtn=/Open Build/.test(dlgText()); click('#dlgBtn'); out.buildPanel=$('buildPanel').style.display;
  /* place three fences through the pointer, from the pasture (the arena box refuses pieces) */
  goto(-42,-8); G.horse.player.heading=Math.PI; window.advanceTime(300);
  const place=(t,off)=>{G.hidePanels();G.ui.openBuild();const b=document.querySelector('[data-b="place:'+t+'"]');if(!b)return 'nobtn';b.click();window.advanceTime(80);
   const cv=G.renderer.domElement; const r=cv.getBoundingClientRect(); const x=r.left+r.width/2+(off||0)*110, y=r.top+r.height*0.62;
   cv.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,pointerId:1,bubbles:true}));
   cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,pointerId:1,bubbles:true}));
   window.dispatchEvent(new PointerEvent('pointerup',{clientX:x,clientY:y,pointerId:1,bubbles:true}));
   key('Escape'); return sv().decor.length;};
  const n=[place('fence',-1),place('fence',0),place('fence',1)]; out.placed=n; const s1=sv(); out.fence={decor:s1.decor.length,prog:s1.story.prog,life:s1.life.build};
  if(s1.story.prog<3){for(let k=s1.story.prog;k<3;k++)G.quest.questEvt('build','fence');out.fallback=true;}
  out.claim1=claim(); const s2=sv(); out.bonus1={bonus:s2.builderBonus,idx:s2.story.idx,type:G.quest.STORY[s2.story.idx].type};
  /* lantern + trough: the snapshot type sees pieces already on the ground */
  n.push(place('lantern',-2),place('trough',2)); const s3=sv(); out.b2={decor:s3.decor.length,prog:s3.story.prog};
  if(s3.story.prog<2){G.save.sync(s=>{s.decor.push({id:'qa1',t:'lantern',x:-40,z:-20,ry:0},{id:'qa2',t:'trough',x:-44,z:-22,ry:0});});G.quest.questEvt('build2',0);out.b2fallback=sv().story.prog;}
  out.claim2=claim(); const s4=sv(); out.bonus2={bonus:s4.builderBonus,type:G.quest.STORY[s4.story.idx].type};
  /* ranch level 2 needs 60 points: builder points count */
  G.save.sync(s=>{s.builderBonus=(s.builderBonus||0)+60;}); G.quest.questEvt('ranchlvl',0); window.advanceTime(50); out.lvl={prog:sv().story.prog,pill:$('questTrack').textContent};
  out.claim3=claim(); out.brave=G.quest.STORY[sv().story.idx].label;
  for(let k=0;k<10;k++)G.quest.questEvt('build','post'); out.claim4=claim(); const s5=sv(); out.afterBuild={idx:s5.story.idx,label:G.quest.STORY[s5.story.idx].label,builderQ:s5.stats.builderQ,bonus:s5.builderBonus,ach:G.quest.ACHS.find(a=>a.id==='brave').v(s5)};
  /* gallop 500, visit Loon Lake, then the clue hunt */
  G.quest.questEvt('gallop',500); out.claim5=claim(); goto(20,16); window.advanceTime(200); out.visit=sv().story.prog; out.claim6=claim();
  /* other packages braid their own missions into this chapter — walk forward to the clue hunt,
     satisfying whatever stands in the way and claiming it from whoever gave it */
  out.walk=[]; out.claim7=null;
  for(let guard=0;guard<14;guard++){
   const mm=G.quest.STORY[sv().story.idx]; if(!mm||mm.type==='clues')break;
   out.walk.push(mm.type);
   const g=mm.goal||1;
   if(mm.type==='event')G.quest.questEvt('event',mm.ev||'h1');
   else if(mm.item){for(let k=0;k<g;k++)G.quest.questEvt(mm.type,mm.item);}
   else {G.quest.questEvt(mm.type,g); if(sv().story.prog<g)for(let k=0;k<g;k++)G.quest.questEvt(mm.type,1);}
   window.advanceTime(50);
   const q=G.world.npcList.find(q=>q.def.id===(mm.npc||'wren')); const p=q?[q.g.position.x+0.5,q.g.position.z]:[-11,-17.5];
   talk(p[0],p[1]); const ok=/Claim/.test(dlgText()); click('#dlgBtn');
   if(mm.type==='event')out.claim7=ok;
   if(!ok){out.stuck=mm.label;break;}
  }
  const m=G.quest.STORY[sv().story.idx]; out.cluesM={type:m.type,goal:m.goal,clues:(m.clues||[]).map(c=>c.npc)};
  out.wrenClues=wrenTalk(); out.cluesDlg=/Clues 0\\/2/.test(dlgText())&&/Mia/.test(dlgText()); click('#dlgBtn');
  const at=id=>{const q=G.world.npcList.find(q=>q.def.id===id);return q?[q.g.position.x,q.g.position.z]:null;};
  const mp=at('mia'); out.mia=talk(mp[0]+0.5,mp[1]); out.miaNote=!!document.querySelector('[data-fx="sq:clue:mia"]'); click('[data-fx="sq:clue:mia"]');
  const tp=at('theo'); out.theo=talk(tp[0]+0.5,tp[1]); out.theoNote=!!document.querySelector('[data-fx="sq:clue:theo"]'); click('[data-fx="sq:clue:theo"]');
  window.advanceTime(50); const s6=sv(); out.noted={clues:s6.story.clues,prog:s6.story.prog,pill:$('questTrack').textContent};
  out.wrenAcc=wrenTalk(); out.suspects=document.querySelectorAll('[data-g]').length; out.clueLines=(dlgText().match(/📝/g)||[]).length;
  click('[data-g="0"]'); out.wrongStill=sv().story.prog; click('[data-g="1"]'); const s7=sv(); out.solved={prog:s7.story.prog,claim:/Claim/.test(dlgText())};
  click('#dlgBtn'); const s8=sv(); out.afterClues={idx:s8.story.idx,cases:s8.stats.cases,clues:s8.story.clues,label:G.quest.STORY[s8.story.idx].label};
  /* the season cadence */
  out.books={b3:SQ.STORY_BOOKS[0].added,b4:SQ.STORY_BOOKS[1].added,next:SQ.nextBook()&&SQ.nextBook().title,daysAhead:SQ.STORY_BOOKS[1].releaseAt>Date.now(),len0:G.quest.STORY.length};
  SQ.STORY_BOOKS[1].releaseAt=Date.now()-1; const added=SQ.releaseBooks(false); out.released={added,len1:G.quest.STORY.length,next:SQ.nextBook(),last:G.quest.STORY[G.quest.STORY.length-1].ch};
  out.state=st().story;
  return out;`);
 check('builder mission dialogue offers Open Build',r4.type==='build'&&r4.wren&&r4.buildBtn&&r4.buildPanel==='flex',{type:r4.type,btn:r4.buildBtn,panel:r4.buildPanel});
 check('three fences placed through the pointer count for the mission and the boards',r4.fence&&r4.fence.decor===3&&r4.fence.prog===3&&r4.fence.life===3&&!r4.fallback,{fence:r4.fence,placed:r4.placed});
 check('claim pays builder points (12) and moves to the lantern + trough mission',r4.claim1&&r4.bonus1.bonus===12&&r4.bonus1.type==='build2',r4.bonus1);
 check('lantern + trough snapshot mission sees both pieces',r4.b2&&(r4.b2.prog===2||r4.b2fallback===2),{b2:r4.b2,fallback:r4.b2fallback});
 check('claim → ranch level mission; builder points raise the ranch level',r4.claim2&&r4.bonus2.type==='ranchlvl'&&r4.lvl.prog===2&&/2\/2|✅/.test(r4.lvl.pill),{b:r4.bonus2,lvl:r4.lvl});
 check('Brave Builder: 10 pieces, chapter achievement, 82+ builder points',r4.claim3&&/Brave Builder/.test(r4.brave)&&r4.claim4&&r4.afterBuild.builderQ===1&&r4.afterBuild.bonus>=82&&r4.afterBuild.ach===1&&r4.afterBuild.label==='Gallop 500 m',r4.afterBuild);
 check('gallop + visit + event missions still work after the inserts',r4.claim5&&r4.visit===1&&r4.claim6&&r4.claim7!==false&&!r4.stuck,{c5:r4.claim5,visit:r4.visit,c6:r4.claim6,c7:r4.claim7,walk:r4.walk,stuck:r4.stuck});
 check('the clue hunt: Wren asks for two clues from Mia and Theo',r4.cluesM.type==='clues'&&r4.cluesM.goal===3&&r4.cluesM.clues.join()==='mia,theo'&&r4.wrenClues&&r4.cluesDlg,r4.cluesM);
 check('Mia and Theo hand over clues where they ride',r4.mia&&r4.miaNote&&r4.theo&&r4.theoNote&&r4.noted.clues.join()==='mia,theo'&&r4.noted.prog===2,r4.noted);
 check('accusation: clue lines, three suspects, wrong answer holds, right answer solves',r4.wrenAcc&&r4.suspects===3&&r4.clueLines===2&&r4.wrongStill===2&&r4.solved.prog===3&&r4.solved.claim,{suspects:r4.suspects,lines:r4.clueLines,solved:r4.solved});
 check('case closed: counted, clues cleared, story moves on',r4.afterClues&&r4.afterClues.cases===1&&r4.afterClues.clues.length===0&&!!r4.afterClues.label,r4.afterClues);
 check('cadence: The Runaway Summer shipped, Frost on the Falls scheduled for the next season',r4.books&&r4.books.b3&&!r4.books.b4&&r4.books.next==='Frost on the Falls'&&r4.books.daysAhead,r4.books);
 check('a book released on its date appends its missions',r4.released&&r4.released.added===1&&r4.released.len1===r4.books.len0+6&&r4.released.next===null&&r4.released.last==='Frost on the Falls',r4.released);
 check('no console/page errors across four boots',errors.length===0,errors.slice(0,6));
 console.log(await page.evaluate(()=>render_game_to_text()));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
