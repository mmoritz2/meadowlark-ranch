/* Package check: bond-personality-emotes.
   Seeds a three-horse save (a challenging ridden horse at bond 39 with one stamina point, an
   aloof and a relaxed horse out in the pasture), boots ranch3d.html?qa=bpe, then drives every
   feature through window.__features / advanceTime / render_game_to_text:
   personality template + bondGain kinds, bond levels + care text, artist-rig emotes (rear lifts
   the head, kick lifts a hind hoof, lie-down locked at Lv 1), petting animation + level-up,
   riding bond with the daily cap, exhaustion stop + rear on a challenging horse, the whistle
   (ignored by an aloof horse, answered by a relaxed one), wildlife spook, magnificent ribbons
   feeding bond, rider emotes + guitar prop + pass reward kind, the emote panel, coat dirt and
   the no-chore course start, remote emote mirroring, and the quest/board/state additions.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-bond-personality-emotes.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=bpe&seed='+Date.now();
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
const SEED={v:2,ranchName:'Meadowlark Ranch',founded:Date.now()-864e5*9,coins:900,gems:9,items:{carrot:6,apple:2,hay:3},nextId:4,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:true,
 lastSeen:Date.now()-60e3,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:2,tack:[],ridingHorseId:1,
 horses:[
  {id:1,name:'Clover',breed:'bay-sporthorse',colors:{body:'#765035',mane:'#221b16'},horn:false,rainbow:false,stats:{speed:3,stamina:1,jump:3,accel:3,agility:3},sxp:{},level:3,xp:0,bond:39,pers:'challenging',needs:{hunger:90,thirst:90,clean:10,happy:90},foal:false,tack:null,out:false},
  {id:2,name:'Juniper',breed:'bay',colors:{body:'#8a5a2b',mane:'#332214'},horn:false,rainbow:false,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},level:2,xp:0,bond:30,pers:'aloof',needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null,out:true},
  {id:3,name:'Maple',breed:'bay',colors:{body:'#9c4f23',mane:'#6e3617'},horn:false,rainbow:false,stats:{speed:3,stamina:3,jump:3,accel:3,agility:3},sxp:{},level:2,xp:0,bond:30,pers:'relaxed',needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null,out:true}]};
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page.addInitScript(seed=>{try{if(!sessionStorage.getItem('bpeSeeded')){localStorage.setItem('starRanchFable_v1',JSON.stringify(seed));sessionStorage.setItem('bpeSeeded','1');}}catch(e){}},SEED);
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage('horseReady');
 /* let the pasture rigs settle too */
 await page.waitForTimeout(2500);
 const r=await page.evaluate(()=>{
  const G=window.__features, out={}, st=()=>JSON.parse(render_game_to_text());
  const kd=code=>window.dispatchEvent(new KeyboardEvent('keydown',{code}));
  const ku=code=>window.dispatchEvent(new KeyboardEvent('keyup',{code}));
  out.installed=G.installed.length; out.errors=G.errors.slice();
  const P=G.tables.PERS;
  /* 1. personality template */
  out.pers={n:Object.keys(P).length,full:Object.keys(P).every(k=>['ride','ribbon','whistleLv','exhaust','fearless'].every(f=>P[k][f]!==undefined)),
   aloofRibbon:G.horse.bondGain({pers:'aloof',bond:80},4,'ribbon'),aloofRide:G.horse.bondGain({pers:'aloof',bond:80},4,'ride'),
   defaults:G.horse.persOf({}),whistleLow:G.horse.persWhistleOk({pers:'aloof',bond:30}),whistleOk:G.horse.persWhistleOk({pers:'aloof',bond:45}),
   aloofFearless:G.horse.persOf({pers:'aloof'}).fearless,alertSpook:G.horse.persOf({pers:'alert'}).spookMul};
  /* 2. bond levels + care surfaces */
  const h0=G.horse.ridden();
  out.bond0={name:h0.name,pers:h0.pers,bond:h0.bond,lv:G.horse.bondLevel(h0),lvDefault:G.horse.bondLevel(),names:G.horse.BOND_NAMES.length,unlocks:Object.keys(G.horse.BOND_UNLOCKS).length};
  G.ui.openCare(); const careTxt=document.getElementById('carePanel').innerText;
  out.care={lv:/Bond Lv 1/.test(careTxt),traits:/Bonds from:/.test(careTxt)&&/whistle/.test(careTxt),ladder:/Lv 5 Heart-bonded/.test(careTxt),locked:/🔒 🙇 Bow/.test(careTxt)&&/🔒 😴 Lie down/.test(careTxt),kickFree:/🦵 Kick/.test(careTxt)&&!/🔒 🦵 Kick/.test(careTxt),petBtn:!!document.querySelector('#carePanel [data-fx="bpe:pet"]')};
  G.hidePanels();
  /* 3. artist-rig emotes */
  const RIG=G.horse.RIG(); const bone=n=>RIG.boneMap?RIG.boneMap[n]:RIG.bones.find(b=>b.name===n);
  const wy=n=>{const b=bone(n);if(!b)return null;const v=new G.THREE.Vector3();b.getWorldPosition(v);return v.y;};
  out.rigNames={head:!!bone('head'),FLhoof:!!bone('FLhoof'),HLhoof:!!bone('HLhoof'),artist:!!RIG.profile?.artistBreed,motion:!!RIG.heroMotion};
  window.advanceTime(300);
  const head0=wy('head'), toastBefore=document.getElementById('toasts').textContent;
  kd('Digit1'); ku('Digit1'); window.advanceTime(200);
  const emA=st().horse.emote;
  window.advanceTime(800);
  const head1=wy('head');
  window.advanceTime(2500);
  out.rear={emote:emA,head0:+head0.toFixed(3),head1:+head1.toFixed(3),rise:+(head1-head0).toFixed(3),cleared:st().horse.emote,noAvail:!/not available/.test(document.getElementById('toasts').textContent)};
  /* locked: lie down at bond Lv 1 */
  kd('Digit3'); ku('Digit3'); window.advanceTime(150);
  out.lock={emote:st().horse.emote,toast:G.horse.log.slice(-1)[0]||''};
  window.advanceTime(200);
  /* kick (bond Lv 1) lifts a hind hoof */
  const hl0=wy('HLhoof');
  const kickOk=G.horse.horseEmote('kick'); window.advanceTime(650);
  const hl1=wy('HLhoof'); const kickEm=st().horse.emote;
  window.advanceTime(1500);
  out.kick={ok:kickOk,emote:kickEm,rise:+(hl1-hl0).toFixed(3)};
  /* 4. petting: bond 39 -> 40 (challenging pet x0.7 of 2 = 1), level 2, animation plays */
  const life0=(G.save.fresh().life||{}).pet||0;
  G.ui.openCare(); document.querySelector('#carePanel [data-care="pet"]').click(); window.advanceTime(300);
  const sP=G.save.fresh();
  out.pet={bond:sP.horses[0].bond,live:G.horse.ridden().bond,lv:G.horse.bondLevel(),emote:st().horse.emote,anim:G.horse.PET_ANIMS.filter(p=>p.lvl<=G.horse.bondLevel()).pop().em,lifePet:(sP.life||{}).pet-life0,levelToast:G.horse.log.some(m=>/bond Lv 2/.test(m)),careClosed:document.getElementById('carePanel').style.display};
  window.advanceTime(2500);
  /* 5. riding bond + exhaustion (stamina 1 -> blown in ~18 s; challenging stops and rears) */
  const bondR0=G.save.fresh().horses[0].bond;
  kd('KeyW'); kd('ShiftLeft');
  let maxSp=0,blownAt=null,minSpAfter=99,rearSeen=false,exhaustSeen=false,samples=0;
  for(let i=0;i<70;i++){ window.advanceTime(500); const o=st(); samples++; maxSp=Math.max(maxSp,o.player.speed);
   if(o.player.blown&&blownAt===null)blownAt=i*0.5;
   if(blownAt!==null){minSpAfter=Math.min(minSpAfter,o.player.speed); if(o.horse.emote==='rear')rearSeen=true; if(o.player.exhaustT>0)exhaustSeen=true;}
   if(blownAt!==null&&i*0.5>blownAt+6)break; }
  ku('KeyW'); ku('ShiftLeft'); window.advanceTime(1500);
  const sR=G.save.fresh();
  out.ride={bond0:bondR0,bond1:sR.horses[0].bond,day:sR.horses[0].bondDay,maxSp:+maxSp.toFixed(2),blownAt,minSpAfter:+minSpAfter.toFixed(2),rearSeen,exhaustSeen,stam:st().stamina,mastery7:G.tables.MASTERY_UNLOCKS[7]};
  /* 6. whistle: aloof Juniper (Lv 1 < 2) ignores; relaxed Maple comes */
  window.advanceTime(4500);   // clear the whistle cooldown from any earlier press
  const herd=G.horse.herd(); const jun=herd.find(a=>G.horse.myHorses[a.idx].name==='Juniper'), map=herd.find(a=>G.horse.myHorses[a.idx].name==='Maple');
  const pd=a=>a?+Math.hypot(a.pos.x-G.horse.player.pos.x,a.pos.z-G.horse.player.pos.z).toFixed(1):null;
  G.save.sync(s=>{s.whistleHorse=2;});
  const w1=G.horse.doWhistle(); const junD0=pd(jun);
  window.advanceTime(3000);
  const junD1=pd(jun), ignoreToast=G.horse.log.some(m=>/ignores/.test(m));
  window.advanceTime(1500);
  G.save.sync(s=>{s.whistleHorse=3;});
  const w2=G.horse.doWhistle(); const mapD0=pd(map);
  let mapD1=null,arrived=false; for(let i=0;i<40;i++){window.advanceTime(500);mapD1=pd(map);if(mapD1<3.5){arrived=true;break;}}
  out.whistle={btn:!!document.getElementById('whistleBtn'),herd:herd.length,w1,junD0,junD1,ignoreToast,w2,mapD0,mapD1,arrived,state:st().whistle};
  /* 7. wildlife spook: a deer within reach, random forced, walking past it */
  const crs=G.world.critters; const deer=crs.find(c=>c.def&&c.def.fleeR&&c.mode!=='flee'&&c.p.group.visible)||crs[0];
  const mr=Math.random; Math.random=()=>0;
  G.horse.player.pos.set(deer.x-3,0,deer.z); G.horse.player.heading=Math.PI/2; G.horse.player.speed=0; G.horse.spook.cd=0; G.horse.spook.t=0;
  kd('KeyW'); let spT=0,spSpeedDrop=false,pre=0;
  for(let i=0;i<12;i++){window.advanceTime(150);const o=st();if(o.spook.t>0){spT=o.spook.t;if(o.player.speed<pre*0.6)spSpeedDrop=true;break;}pre=o.player.speed;}
  ku('KeyW'); Math.random=mr; window.advanceTime(1500);
  out.spook={critter:deer.def&&deer.def.name||deer.key,spT,spSpeedDrop,lifeSpook:(G.save.fresh().life||{}).spook||0,toast:G.horse.log.some(m=>/shies/.test(m))};
  /* 8. magnificent ribbons feed bond (challenging ribbon x1.5) */
  const ev=G.tables.EVENTS3[0]; const b0=G.save.fresh().horses[0].bond;
  const RB=G.course.awardRibbons(ev,1,0); G.run('courseFinish',{c:{},ev,stars:3,RB,pay:0,dressage:false});
  const s1=G.save.fresh();
  const RB2=G.course.awardRibbons(ev,1,1); G.run('courseFinish',{c:{},ev,stars:3,RB:RB2,pay:0,dressage:false});
  const s2=G.save.fresh();
  G.ui.openEvents(); const evTxt=document.getElementById('eventsPanel').innerHTML; G.hidePanels();
  out.magnif={rib1:RB.rib,magnif:s1.magnif,bond1:s1.horses[0].bond,d1:s1.horses[0].bond-b0,rib2:RB2.rib,magnif2:s2.magnif,d2:s2.horses[0].bond-s1.horses[0].bond,glyph:/🏵️/.test(evTxt),ach:G.quest.ACHS.some(a=>a.id==='magnif5'),daily:G.quest.DAILYQ.some(d=>d.type==='magnif'),board:G.tables.BOARDS.some(b=>b.k==='magnif')};
  /* 9. rider emotes */
  G.horse.player.speed=0; window.advanceTime(200);
  const R=G.horse.player.rider; const hy=()=>{const v=new G.THREE.Vector3();R.sk.by.handR.getWorldPosition(v);return v.y;};
  const hand0=hy(); const wv=G.horse.riderEmote('wave'); window.advanceTime(700); const hand1=hy(); const reState=st().riderEmote;
  window.advanceTime(2500);
  const thumbs0=G.horse.riderEmote('thumbs'); G.save.sync(s=>{s.emotes.thumbs=1;}); const thumbs1=G.horse.riderEmote('thumbs'); window.advanceTime(2600);
  out.rider={wave:wv,hand0:+hand0.toFixed(3),hand1:+hand1.toFixed(3),lift:+(hand1-hand0).toFixed(3),state:reState,after:st().riderEmote,thumbs0,thumbs1,n:Object.keys(G.horse.RIDER_EMOTES).length};
  /* 10. guitar: pass reward kind, prop visible while strumming, campfire thing */
  const g0=G.horse.riderEmote('guitar'); const gToast=G.horse.log.slice(-1)[0]||'';
  G.save.sync(s=>{G.money.payReward(s,{emote:'guitar'});});
  const g1=G.horse.riderEmote('guitar'); window.advanceTime(600);
  const prop=R._guitar; const gVis=!!(prop&&prop.visible), gState=st().riderEmote;
  window.advanceTime(7000);
  out.guitar={g0,gToast:/pass/i.test(gToast),g1,gVis,gState,after:st().riderEmote,hidden:!!(prop&&!prop.visible),pass:G.tables.PASS_FREE[19]&&G.tables.PASS_FREE[19].emote,label:G.money.rewardLabel({emote:'guitar'}),camp:G.world.things.some(t=>t.kind==='camp')};
  /* 11. emote panel + dock */
  G.ui.open('emotePanel'); const ep=document.getElementById('emotePanel');
  out.panel={shown:ep&&ep.style.display,btns:ep?ep.querySelectorAll('[data-fx^="bpe:"]').length:0,locks:(ep&&ep.innerText.match(/🔒/g)||[]).length,dock:!!document.getElementById('emoteBtn'),hotkey:G.key('emoteBar')};
  G.hidePanels();
  /* 12. dirt + no chore gate */
  G.horse.applyDirt(); const mat=Array.isArray(RIG.skin.material)?RIG.skin.material[0]:RIG.skin.material;
  const dirt0=mat.userData.dirt, hex0=mat.color?mat.color.getHex():null;
  G.ui.openCare(); document.querySelector('#carePanel [data-care="groom"]').click(); window.advanceTime(100); G.hidePanels();
  const dirt1=mat.userData.dirt, hex1=mat.color?mat.color.getHex():null, clean1=G.save.fresh().horses[0].needs.clean;
  const lum=x=>x==null?null:((x>>16)&255)+((x>>8)&255)+(x&255);
  G.course.startCourse(ev); window.advanceTime(100); const courseOn=!!st().course; G.course.cancelCourse(); window.advanceTime(100);
  out.dirt={dirt0,dirt1,lum0:lum(hex0),lum1:lum(hex1),clean1,courseOn,stateClean:st().horse.clean};
  /* 13. remote mirroring via a synthetic /pos packet */
  G.net.onMessage('srf1/x/pos',JSON.stringify({id:'qa2',n:'Ana',x:G.horse.player.pos.x+3,z:G.horse.player.pos.z+3,h:0,sp:0,b:'bay-sporthorse',em:'rear',rem:'wave'}));
  window.advanceTime(300);
  const rm=G.net.remotes.qa2;
  out.remote={exists:!!rm,em:rm&&rm.rig&&rm.rig.emote&&rm.rig.emote.type,rem:rm&&rm.riderEmote&&rm.riderEmote.type};
  let payload={}; G.run('netPos',payload,G.save.fresh(),G.horse.ridden()); out.netPos={hasEm:'em' in payload,hasRem:'rem' in payload};
  /* 14. quests, boards, state keys */
  G.ui.openStable(); const stTxt=document.getElementById('stablePanel').innerHTML; G.hidePanels();
  out.stable={traitTip:/title="Bonds from:/.test(stTxt),lvName:/bond Lv 2 · Companion/.test(stTxt),helpers:G.horse.persExhaust({pers:'aloof'})==='stop'&&G.horse.persFearless({pers:'relaxed'})===true&&G.horse.persRecover({pers:'energetic'})===1.15};
  out.tables={achs:['magnif5','spook10','emote25','bond5'].filter(id=>!G.quest.ACHS.some(a=>a.id===id)),dailies:['magnif','emote','whistle'].filter(t=>!G.quest.DAILYQ.some(d=>d.type===t)),kick:!!G.tables.EMOTES.kick,pose:!!document.querySelector('#poseBar [data-pose="kick"]')};
  const o=st(); out.state={keys:['bondLevel','emote','clean','persTraits'].filter(k=>o.horse[k]===undefined),top:['spook','whistle','riderEmote'].filter(k=>o[k]===undefined),blown:o.player.blown,exhaustT:o.player.exhaustT};
  out.save={emotes:!!G.save.fresh().emotes,magnif:G.save.fresh().magnif,whistleHorse:G.save.fresh().whistleHorse};
  return out;
 });
 check('every package installed, none failed',r.installed>=16&&r.errors.length===0,{installed:r.installed,errors:r.errors});
 check('six personalities carry the full behaviour template',r.pers.n===6&&r.pers.full,r.pers);
 check('bondGain honours ribbon/ride weights (aloof ribbon 4->10, ride 4->1)',r.pers.aloofRibbon===10&&r.pers.aloofRide===1,{ribbon:r.pers.aloofRibbon,ride:r.pers.aloofRide});
 check('persOf defaults + whistle threshold (aloof Lv2)',r.pers.defaults.whistleLv===1&&r.pers.defaults.exhaust==='slow'&&r.pers.whistleLow===false&&r.pers.whistleOk===true&&r.pers.aloofFearless===true&&r.pers.alertSpook>1,r.pers);
 check('bondLevel schema (bond 39 -> Lv 1, 6 names, 5 unlocks)',r.bond0.lv===1&&r.bond0.lvDefault===1&&r.bond0.names===6&&r.bond0.unlocks===5,r.bond0);
 check('care panel shows bond level, traits, ladder, locked tricks',r.care.lv&&r.care.traits&&r.care.ladder&&r.care.locked&&r.care.kickFree&&r.care.petBtn,r.care);
 check('artist rig has named joints and the motion path',r.rigNames.head&&r.rigNames.FLhoof&&r.rigNames.HLhoof&&r.rigNames.artist&&r.rigNames.motion,r.rigNames);
 check('rear plays on the artist rig and lifts the head > 0.25 m, then clears',r.rear.emote==='rear'&&r.rear.rise>0.25&&r.rear.cleared===null&&r.rear.noAvail,r.rear);
 check('lie down is locked at bond Lv 1 with a lock toast',r.lock.emote===null&&/🔒/.test(r.lock.toast)&&/Lie down/.test(r.lock.toast),r.lock);
 check('kick (bond Lv 1) lifts a hind hoof > 0.12 m',r.kick.ok&&r.kick.emote==='kick'&&r.kick.rise>0.12,r.kick);
 check('petting: +1 bond (challenging), level 2, animation matches PET_ANIMS, live copy synced, panel closed',r.pet.bond===40&&r.pet.live===40&&r.pet.lv===2&&r.pet.emote===r.pet.anim&&r.pet.lifePet===1&&r.pet.levelToast&&r.pet.careClosed==='none',r.pet);
 check('riding raises bond within the daily cap',r.ride.bond1>r.ride.bond0&&r.ride.bond1-r.ride.bond0<=8&&r.ride.day&&r.ride.day.n>0,r.ride);
 check('exhaustion: challenging horse blows, plants its feet (< 0.6 m/s) and rears',r.ride.blownAt!==null&&r.ride.minSpAfter<0.6&&r.ride.rearSeen&&r.ride.exhaustSeen&&r.ride.maxSp>8,r.ride);
 check('Second wind mastery unlock listed',/Second wind/.test(r.ride.mastery7||''),r.ride.mastery7);
 check('whistle: aloof Juniper at Lv 1 ignores it, stays put',r.whistle.w1===false&&r.whistle.ignoreToast&&Math.abs(r.whistle.junD1-r.whistle.junD0)<5,r.whistle);
 check('whistle: relaxed Maple gallops over within 3.5 units',r.whistle.w2===true&&r.whistle.arrived&&r.whistle.btn,r.whistle);
 check('wildlife spooks a non-fearless horse (speed cut, toast, counter)',r.spook.spT>0&&r.spook.lifeSpook>=1&&r.spook.toast,r.spook);
 check('magnificent ribbon: rib 4, s.magnif 1, +9 bond (6 x 1.5); faulted run rib 3, +5',r.magnif.rib1===4&&r.magnif.magnif===1&&r.magnif.d1===9&&r.magnif.rib2===3&&r.magnif.magnif2===1&&r.magnif.d2===5,r.magnif);
 check('magnificent glyph in events, achievement, daily, board',r.magnif.glyph&&r.magnif.ach&&r.magnif.daily&&r.magnif.board,r.magnif);
 check('rider wave lifts the right hand > 0.2 m and clears; thumbs locked then owned',r.rider.wave&&r.rider.lift>0.2&&r.rider.state==='wave'&&r.rider.after===null&&r.rider.thumbs0===false&&r.rider.thumbs1===true&&r.rider.n>=16,r.rider);
 check('guitar: locked until the pass reward kind pays it, prop shows while strumming, campfire thing',r.guitar.g0===false&&r.guitar.gToast&&r.guitar.g1===true&&r.guitar.gVis&&r.guitar.gState==='guitar'&&r.guitar.after===null&&r.guitar.hidden&&r.guitar.pass==='guitar'&&r.guitar.camp,r.guitar);
 check('emote panel: dock button, hotkey, 24 buttons, locks',r.panel.shown==='flex'&&r.panel.btns>=24&&r.panel.locks>=2&&r.panel.dock&&r.panel.hotkey==='KeyY',r.panel);
 check('coat dirt darkens at clean 10 and lightens after a groom; no chore gate on courses',r.dirt.dirt0>0.8&&r.dirt.dirt1<0.5&&r.dirt.lum1>r.dirt.lum0&&r.dirt.clean1>=60&&r.dirt.courseOn,r.dirt);
 check('remote rider mirrors horse + rider emotes from /pos; netPos adds em/rem',r.remote.exists&&r.remote.em==='rear'&&r.remote.rem==='wave'&&r.netPos.hasEm&&r.netPos.hasRem,{remote:r.remote,netPos:r.netPos});
 check('achievements, dailies, kick emote, pose bar button',r.tables.achs.length===0&&r.tables.dailies.length===0&&r.tables.kick&&r.tables.pose,r.tables);
 check('stable rows carry the bond level name and a personality trait tooltip; template helpers exposed',r.stable.traitTip&&r.stable.lvName&&r.stable.helpers,r.stable);
 check('render_game_to_text carries bond/emote/spook/whistle keys',r.state.keys.length===0&&r.state.top.length===0,r.state);
 check('save fields ensured on an old save (emotes, magnif, whistleHorse)',r.save.emotes&&typeof r.save.magnif==='number',r.save);
 check('no console/page errors',errors.length===0,errors.slice(0,5));
 console.log(await page.evaluate(()=>render_game_to_text()));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
