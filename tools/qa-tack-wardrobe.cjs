/* tack-wardrobe package check.
   Boots ranch3d.html?qa=tack-wardrobe against a local server and proves every feature of the package
   headlessly: the rarity bonus table, stat-encoding names, the 26 tack sets and their saddle tints,
   upgrade levels with toolkits, merge and strip, the market stall and chest odds, English/Western
   saddles and the rider's seat, the two tack missions, the rider creator, the wardrobe (live recolour,
   dust unlocks, helmet off, hairstyles), the Season Store, the prestige set and its badge on remotes,
   and the render_game_to_text keys. A second load checks the creator shows once for an old save.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-tack-wardrobe.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));}
const t0=Date.now();
const stage=s=>console.log('… '+s+' @'+((Date.now()-t0)/1000).toFixed(1)+'s');
let browser=null;
setTimeout(async()=>{console.error('WATCHDOG: no result after 600 s');try{if(browser)await browser.close();}catch(e){}process.exit(3);},600000).unref();
const READY=()=>window.render_game_to_text&&(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics&&s.graphics.horseReady&&!s.graphics.horseLoading;}catch(e){return false;}})();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 await page.route('**/ranch3d.html*',async route=>{
  const response=await route.fetch();const html=await response.text();
  const marker='const MERGE_STATS=mergeStatics();';
  if(!html.includes(marker))throw Error('Game QA injection point is missing');
  await route.fulfill({response,body:html.replace(marker,`window.__qa={genGear,gearBonus,gearUpgradeCost,gearMergeCost,gearSet,setBonus,effStats,gearPrimary,TACK_SETS,SET_KEYS,RAR_PATTERN,STAT_ADJ,STAT_OF,RAR_PARTS,TOOLKITS,TACK_MAX_LVL,tackAct,marketTackStock,riderSeat,TACK,player,RIG,attachTack,dressSaddle,refreshTack,saddleStyleOf,remoteUpdate,remotes,useThing,things,CHESTS,setNear:t=>{nearThing=t;},setStory:(i,p)=>{storyIdx=i;storyProg=p;saveStory();},STORY,scene,freshSave,syncSave,rideIdx:()=>rideIdx,RIDER_MESH};`+marker)});
 });
 stage('launch'); await page.goto(base+'/ranch3d.html?qa=tack-wardrobe&fresh='+Date.now(),{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250}); stage('horseReady');
 await page.waitForFunction(()=>window.__qa&&window.__qa.RIDER_MESH.geo&&window.__features,null,{timeout:60000,polling:250}).catch(()=>{});
 await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:30000,polling:250}).catch(()=>{});
 await page.evaluate(()=>window.advanceTime(700)); stage('curtain down');
 const r=await page.evaluate(()=>{
  const Q=window.__qa, G=window.__features, out={};
  const sorted=o=>Object.values(o).sort((a,b)=>b-a);
  const autoOpen=(document.getElementById('riderPanel')||{style:{}}).style.display==='flex';   // read before any tab opens (openShop hides other panels)
  /* A. rarity bonus table */
  out.pattern={};
  for(const rar of ['Common','Uncommon','Rare','Epic','Legendary']){let ok=true,prim=true;for(let i=0;i<200;i++){const it=Q.genGear(rar);const p=Q.RAR_PATTERN[rar];if(JSON.stringify(sorted(it.bonus))!==JSON.stringify(p.slice().sort((a,b)=>b-a))||Object.keys(it.bonus).length!==p.length)ok=false;if(it.bonus[it.primary]!==p[0])prim=false;}out.pattern[rar]={ok,prim};}
  /* B. naming */
  {const re=/^(Agile|Enduring|Leaping|Quick|Swift) [A-Z][a-z]+ (Saddle|Pad|Bridle|Shoes)( of (Agility|Stamina|Jump|Acceleration|Speed))?$/;let bad=0,adjBad=0,ofBad=0,setBad=0,styleBad=0,western=0;
   for(let i=0;i<300;i++){const it=Q.genGear();if(!re.test(it.name))bad++;const w=it.name.split(' ');if(Q.STAT_ADJ[it.primary]!==w[0])adjBad++;const of=it.name.includes(' of ')?it.name.split(' of ')[1]:null;if((it.secondary?Q.STAT_OF[it.secondary]:null)!==of)ofBad++;
    if(['Rare','Epic','Legendary'].includes(it.rarity)){if(Q.gearSet(it)!==it.set||!it.set||w[1]!==it.set)setBad++;}else if(it.set)setBad++;
    if(it.slot==='saddle'||it.slot==='bridle'){if(!['english','western'].includes(it.style))styleBad++;if(it.style==='western')western++;}else if(it.style)styleBad++;}
   out.naming={bad,adjBad,ofBad,setBad,styleBad,western};
   out.legacy={starlit:Q.gearSet({name:'Starlit Pad',rarity:'Epic',bonus:{jump:2},lvl:1}),silver:Q.gearSet({name:'Silver-stitched Bridle',rarity:'Rare',bonus:{speed:1},lvl:1}),plain:Q.gearSet({name:'Plain Saddle',rarity:'Common',bonus:{speed:1},lvl:1}),legacyBonus:Q.gearBonus({name:'Storm Pad',rarity:'Epic',bonus:{accel:2,speed:1},lvl:5})};}
  /* C. sets */
  {const S=Q.TACK_SETS;out.setCounts={L:Q.SET_KEYS.Legendary.length,E:Q.SET_KEYS.Epic.length,R:Q.SET_KEYS.Rare.length,total:Object.keys(S).length};
   const groups={};let mismatch=0;for(let i=0;i<500;i++){const it=Q.genGear('Legendary');const k=it.set;const sig=JSON.stringify(it.bonus);if(!groups[k])groups[k]=sig;else if(groups[k]!==sig)mismatch++;const d=S[k];if(!(it.bonus[d.primary]===5&&it.bonus[d.secondary]===5&&it.bonus[d.tertiary]===2))mismatch++;}
   out.legendGroups={sets:Object.keys(groups).length,mismatch};
   let rareNull=0,rareTwo=0;for(let i=0;i<300;i++){const it=Q.genGear('Rare');if(!Q.gearSet(it))rareNull++;}
   /* wear four Kestrel pieces and a Rare pair */
   let counts=null,eff=null,base=null;
   G.save.sync(s=>{s.tack=s.tack||[];const h=s.horses[Q.rideIdx()];h.gear={};for(const sl of ['saddle','pad','bridle','shoes']){const it=Q.genGear('Legendary',sl,{set:'Kestrel',style:'english'});s.tack.push(it);h.gear[sl]=it.id;}base=Object.assign({},h.stats);});
   Q.refreshTack();const h=G.horse.ridden();const sb=Q.setBonus(h);counts=sb._counts;eff=Q.effStats(h);
   out.kestrel={counts,speedGain:eff.speed-base.speed,accelGain:eff.accel-base.accel,agilityGain:eff.agility-base.agility,four:S.Kestrel.four};
   Q.attachTack();Q.dressSaddle();const sd=Q.TACK.saddle;out.tint={has:!!(sd&&sd.userData.mats),hex:sd&&sd.userData.mats?sd.userData.mats.leather.color.getHexString():null,want:S.Kestrel.tint.slice(1)};
   G.save.sync(s=>{const h=s.horses[Q.rideIdx()];h.gear={};const a=Q.genGear('Rare','saddle',{set:'Basin',style:'english'}),b=Q.genGear('Rare','pad',{set:'Basin'});s.tack.push(a,b);h.gear.saddle=a.id;h.gear.pad=b.id;});Q.refreshTack();
   const sb2=Q.setBonus(G.horse.ridden());out.rarePair={rareNull,counts:sb2._counts,bonus:Object.keys(sb2).filter(k=>k[0]!=='_').map(k=>k+':'+sb2[k]).join(',')};}
  /* D. upgrade levels with toolkits */
  {let id=null;G.save.sync(s=>{s.coins=5000;s.items.kit1=1;s.items.kit2=0;s.items.kit3=0;s.sp=s.sp||{pts:0};s.sp.pts=0;const it=Q.genGear('Common','shoes');s.tack.push(it);id=it.id;});
   Q.tackAct('up:'+id);let s=Q.freshSave();let it=s.tack.find(t=>t.id===id);out.up1={lvl:it.lvl,kit1:s.items.kit1,sp:s.sp.pts,coins:s.coins};
   const c1=s.coins;Q.tackAct('up:'+id);s=Q.freshSave();it=s.tack.find(t=>t.id===id);out.up2={lvl:it.lvl,coinsSame:s.coins===c1,kit1:s.items.kit1};
   G.save.sync(s=>{s.coins=50000;s.items.kit1=5;s.items.kit2=5;s.items.kit3=5;});for(let i=0;i<9;i++)Q.tackAct('up:'+id);
   s=Q.freshSave();it=s.tack.find(t=>t.id===id);out.up8={lvl:it.lvl,max:Q.TACK_MAX_LVL,kits:[s.items.kit1,s.items.kit2,s.items.kit3],btn:!!document.querySelector('#shopPanel [data-tk="up:'+id+'"]'),bonus:Q.gearBonus(it)};
   const leg=Q.genGear('Legendary','pad',{set:'Kestrel'});leg.lvl=8;out.legend8=Q.gearBonus(leg);out.costs={l1:Q.gearUpgradeCost({rarity:'Common',lvl:1}),l4:Q.gearUpgradeCost({rarity:'Legendary',lvl:4}),l7:Q.gearUpgradeCost({rarity:'Epic',lvl:7})};}
  /* E. merge and strip */
  {let a=null,b=null;G.save.sync(s=>{s.coins=10000;s.parts=0;const A=Q.genGear('Uncommon','bridle'),B=Q.genGear('Uncommon','bridle');s.tack.push(A,B);a=A;b=B;});
   const n0=Q.freshSave().tack.length;Q.tackAct('strip:'+b.id);let s=Q.freshSave();out.strip={removed:n0-s.tack.length,parts:s.parts,want:Q.RAR_PARTS.Uncommon};
   const c0=s.coins,p0=s.parts,pk=Q.gearPrimary(a),b0=a.bonus[pk],cost=Q.gearMergeCost(a);Q.tackAct('merge:'+a.id);s=Q.freshSave();let A=s.tack.find(t=>t.id===a.id);
   out.merge={coinsDown:c0-s.coins,cost,partsDown:p0-s.parts,bonusUp:A.bonus[pk]-b0,merged:A.merged};
   G.save.sync(s=>{s.coins=0;});Q.tackAct('merge:'+a.id);s=Q.freshSave();A=s.tack.find(t=>t.id===a.id);out.mergePoor={bonus:A.bonus[pk],merged:A.merged,coins:s.coins};G.save.sync(s=>{s.coins=5000;});}
  /* F. sources: market stall + chest odds */
  {const st1=Q.marketTackStock(),st2=Q.marketTackStock();out.market={n:st1.length,same:JSON.stringify(st1.map(i=>[i.id,i.name,i.price]))===JSON.stringify(st2.map(i=>[i.id,i.name,i.price]))};
   G.save.sync(s=>{s.coins=5000;});const c0=Q.freshSave().coins,n0=Q.freshSave().tack.length;Q.tackAct('mkt:0');let s=Q.freshSave();out.marketBuy={coinsDown:c0-s.coins,price:st1[0].price,grew:s.tack.length-n0};Q.tackAct('mkt:0');out.marketBuy.twice=Q.freshSave().tack.length-n0;
   const chest=Q.things.find(t=>t.kind==='chest'&&t.tier===1);let unc=0,kits=0,N=200;if(chest){Q.setNear(chest);for(let i=0;i<N;i++){G.save.sync(sv=>{sv.chests={};sv.items.kit1=0;sv.items.kit3=0;const n=(sv.tack||[]).length;sv.__n=n;});Q.useThing();const sv=Q.freshSave();if(sv.tack.length>sv.__n)unc++;if((sv.items.kit1||0)+(sv.items.kit3||0)>0)kits++;}}
   G.save.sync(sv=>{delete sv.__n;sv.chests={};});out.chest={found:!!chest,uncRate:unc/N,kitRate:kits/N};}
  /* G. English and Western */
  {let wid=null,eid=null;G.save.sync(s=>{const W=Q.genGear('Rare','saddle',{style:'western'}),E=Q.genGear('Rare','saddle',{style:'english'});s.tack.push(W,E);wid=W.id;eid=E.id;});
   Q.tackAct('on:'+eid);const seatE=Q.riderSeat();const hornE=!!Q.TACK.saddle.getObjectByName('horn');
   Q.tackAct('on:'+wid);const seatW=Q.riderSeat();const hornW=!!Q.TACK.saddle.getObjectByName('horn');
   const scale=Q.player.mesh.scale.x;
   out.western={styleW:Q.TACK.saddle.userData.style,hornW,hornE,seatDrop:+(seatE.y-seatW.y).toFixed(4),wantDrop:+(0.03/scale).toFixed(4),of:Q.saddleStyleOf(G.horse.ridden()),hero:!!Q.TACK.saddle.userData.hero};
   window.advanceTime(400);out.western.post=Q.player.rider._post||0;
   Q.tackAct('on:'+eid);out.western.backE={style:Q.TACK.saddle.userData.style,horn:!!Q.TACK.saddle.getObjectByName('horn')};}
  /* H. tack missions */
  {const [M1,M2]=G.wardrobe.missions;const i1=Q.STORY.indexOf(M1),i2=Q.STORY.indexOf(M2);out.missions={i1,i2,npc:G.quest.NPC_DEFS.some(d=>d.id==='saddler'),npcSpawned:G.world.npcList.some(n=>n.def.id==='saddler'),daily:G.quest.DAILYQ.some(q=>q.type==='tackup'),achs:['tack10','merge5','saddler8','legendset','season3'].filter(id=>!G.quest.ACHS.some(a=>a.id===id))};
   Q.setStory(i1,0);let id=null;G.save.sync(s=>{s.coins=5000;s.items.kit1=1;const it=Q.genGear('Common','pad');s.tack.push(it);id=it.id;});Q.tackAct('up:'+id);
   out.missions.prog=G.quest.storyProg();out.missions.done=G.quest.missionDone();
   const k0=Q.freshSave().items.kit1||0;Q.setStory(i1+1,0);window.advanceTime(700);const s=Q.freshSave();out.missions.kitPaid=(s.items.kit1||0)-k0;out.missions.mig=!!s.mig['tw-kit-kit1-2'];window.advanceTime(700);out.missions.kitOnce=(Q.freshSave().items.kit1||0)-k0;
   Q.setStory(0,0);}
  /* I. rider creator */
  {const p=document.getElementById('riderPanel');out.creator={exists:!!p,autoOpen};
   G.ui.open('riderPanel');p.querySelector('[data-fx="wd:body:m"]').click();out.creator.cropShown=!!p.querySelector('[data-fx="wd:hair:crop"]');out.creator.braidHidden=!p.querySelector('[data-fx="wd:hair:braid"]');
   Q.tackAct('off:saddle');G.ui.open('riderPanel');p.querySelector('[data-fx="wd:hair:crop"]').click();p.querySelector('[data-fx="wd:dice"]').click();const nm=p.querySelector('[data-fxin="wd:name"]').value;p.querySelector('[data-fx="wd:done"]').click();
   const s=Q.freshSave();const R=Q.player.rider;out.creator.after={made:s.rider.made,name:s.playerName,nameMatches:s.playerName===nm&&nm.length>0,hairStyle:s.rider.hairStyle,body:s.rider.body,starter:s.tack.some(t=>t.name==="Grandma's Old Saddle"),starterWorn:s.tack.some(t=>t.name==="Grandma's Old Saddle"&&s.horses[Q.rideIdx()].gear.saddle===t.id),hairMesh:R&&R._twHair&&R._twHair.name,scaleX:+(R.fitG.scale.x/R.fitG.scale.y).toFixed(3),closed:p.style.display};}
  /* J. change outfit: live recolour without a rebuild, helmet off */
  {G.ui.openShop('outfit');const sp=document.getElementById('shopPanel');const n0=Q.scene.children.length;const R=Q.player.rider;const u=R.mesh.material.userData.u;
   sp.querySelector('[data-fx="wd:wear:shirt:#b34a4a"]').click();const s=Q.freshSave();
   out.outfit={shirt:s.rider.shirt,hex:u.uShirt.value.getHexString(),w:u.uShirtW.value,sameRider:Q.player.rider===R,sceneSame:Q.scene.children.length===n0};
   document.querySelector('#shopPanel [data-fx="wd:wear:helmet:none"]').click();out.outfit.helmet={saved:Q.freshSave().rider.helmet,hide:u.uHelmHide.value,helmW:u.uHelmW.value,cap:!!(R._twHair&&R._twHair.getObjectByName('haircap'))};
   document.querySelector('#shopPanel [data-fx="wd:hair:bun"]').click();out.outfit.bun=R._twHair&&R._twHair.name;}
  /* K. dust unlocks */
  {G.save.sync(s=>{s.dust=10;});G.ui.openShop('outfit');const sp=document.getElementById('shopPanel');const locked=sp.querySelectorAll('[data-fx^="wd:unlock:"]');out.dust={locked:locked.length,header:/10<\/b> dust/.test(sp.innerHTML)};
   const first=locked[0];const id=first.dataset.fx.split(':')[2];const it=G.wardrobe.WARDROBE.find(i=>i.id===id);first.click();let s=Q.freshSave();
   out.dust.after={dust:s.dust,cost:it.cost,owned:s.wardrobe.owned[id],slotSet:String(s.rider[it.slot]).toLowerCase()===it.col.toLowerCase(),stateOwned:JSON.parse(render_game_to_text()).rider.owned,nowWear:!!document.querySelector('#shopPanel [data-fx="wd:wear:'+it.slot+':'+it.col+'"]')};
   G.save.sync(s=>{s.dust=0;});G.ui.openShop('outfit');const o0=Object.keys(Q.freshSave().wardrobe.owned).length;document.querySelector('#shopPanel [data-fx^="wd:unlock:"]').click();s=Q.freshSave();out.dust.poor={ownedSame:Object.keys(s.wardrobe.owned).length===o0,dust:s.dust,stillLocked:document.querySelectorAll('#shopPanel [data-fx^="wd:unlock:"]').length};}
  /* L. season store */
  {G.save.sync(s=>{s.tokens={key:'',n:100};});G.ui.dispatch('wd:store');const lp=document.getElementById('lbPanel');const sn=G.time.seasonNow();const items=G.wardrobe.SEASON_OUTFITS[sn.def.id];
   out.store={open:lp.style.display,season:lp.textContent.includes(sn.def.name),n:lp.querySelectorAll('[data-fx^="wd:season:"]').length,want:items.length,tab:!!lp.querySelector('[data-lbtab="store"]')};
   const b=lp.querySelector('[data-fx^="wd:season:"]');const id=b.dataset.fx.split(':')[2];const it=items.find(i=>i.id===id);b.click();let s=Q.freshSave();
   out.store.after={tokens:s.tokens.n,want:100-it.cost,owned:!!s.wardrobe.owned[id],slot:it.slot?String(s.rider[it.slot]).toLowerCase()===it.col.toLowerCase():'tack',rows:document.querySelectorAll('#lbPanel [data-fx^="wd:season:"]').length};
   const other=Object.keys(G.wardrobe.SEASON_OUTFITS).find(k=>k!==sn.def.id);const oid=G.wardrobe.SEASON_OUTFITS[other][0].id;G.ui.dispatch('wd:season:'+oid);s=Q.freshSave();out.store.outOfSeason={owned:!!s.wardrobe.owned[oid],tokens:s.tokens.n};
   const ranger=items.find(i=>i.kind==='tack');if(ranger){G.save.sync(s=>{s.tokens.n=500;});const n0=Q.freshSave().tack.length;G.ui.dispatch('wd:season:'+ranger.id);const t=Q.freshSave().tack.slice(n0);out.store.ranger={n:t.length,allRanger:t.every(x=>x.set==='Ranger'&&x.rarity==='Epic'),western:t.filter(x=>x.style==='western').length};}}
  /* M. prestige set + badge on a remote + live outfit propagation */
  {out.prestige={before:G.wardrobe.prestigeOwned(Q.freshSave())};G.save.sync(s=>{s.vip={until:Date.now()+864e5};});G.ui.openShop('outfit');const btn=document.querySelector('#shopPanel [data-fx="wd:set:prestige"]');out.prestige.btn=!!btn;if(btn)btn.click();
   const s=Q.freshSave();const u=Q.player.rider.mesh.material.userData.u;const st=JSON.parse(render_game_to_text());out.prestige.after={helmet:s.rider.helmet,boots:s.rider.boots,bootW:u.uBootW.value,bootHex:u.uBoot.value.getHexString(),state:st.rider.prestige,stateBoots:st.rider.boots};
   Q.remoteUpdate({id:'qa1',n:'Tess',x:Q.player.pos.x+3,z:Q.player.pos.z+3,h:0,sp:0,bd:1,b:'bay-sporthorse',s:'#4a7ab3',p:'#3a3a3a',bo:'m',hs:'crop',bt:'#a8322a',ss:'western'});
   const rm=Q.remotes.qa1;out.remote={exists:!!rm,badge:rm&&rm.badge,tag:rm&&rm.parts.group.children.some(o=>o.isSprite&&Math.abs(o.position.y-3.15)<1e-3),saddleStyle:rm&&rm.rig&&rm.rig.saddle&&rm.rig.saddle.userData.style};
   G.net.openProfile('Tess');out.remote.profile=/PRESTIGE/.test(document.getElementById('profilePanel').textContent);G.hidePanels();
   if(rm&&rm.rider.mesh){const ru=rm.rider.mesh.material.userData.u;out.remote.shirt1=ru.uShirt.value.getHexString();out.remote.boots=ru.uBootW.value;out.remote.hair=rm.rider._twHair&&rm.rider._twHair.name;out.remote.body=+(rm.rider.fitG.scale.x/rm.rider.fitG.scale.y).toFixed(3);
    Q.remoteUpdate({id:'qa1',n:'Tess',x:Q.player.pos.x+3,z:Q.player.pos.z+3,h:0,sp:0,bd:0,b:'bay-sporthorse',s:'#8a5ab3',p:'#3a3a3a',bo:'f',hs:'bun'});out.remote.shirt2=ru.uShirt.value.getHexString();out.remote.badge2=rm.badge;out.remote.hair2=rm.rider._twHair&&rm.rider._twHair.name;}
  }
  /* N. state */
  {const st=JSON.parse(render_game_to_text());out.state={rider:st.rider&&Object.keys(st.rider),tack:st.tack&&Object.keys(st.tack),sets:st.tack&&st.tack.sets,dustEl:document.getElementById('dustEl').textContent};}
  return out;
 });
 const P=r.pattern;
 check('A rarity bonus table: fixed pattern per rarity, primary holds the top value',P&&Object.values(P).every(v=>v.ok&&v.prim),P);
 check('B names encode primary adjective, style word, slot and "of secondary"; saddles/bridles carry a style',r.naming&&r.naming.bad===0&&r.naming.adjBad===0&&r.naming.ofBad===0&&r.naming.setBad===0&&r.naming.styleBad===0&&r.naming.western>0,r.naming);
 check('B legacy names still resolve their set (Starlit, Silver-stitched) and Common stays set-less',r.legacy&&r.legacy.starlit==='Starlit'&&r.legacy.silver==='Silver'&&r.legacy.plain===null&&r.legacy.legacyBonus.accel===4,r.legacy);
 check('C 11 Legendary + 10 Epic + 5 Rare sets',r.setCounts&&r.setCounts.L===11&&r.setCounts.E===10&&r.setCounts.R===5&&r.setCounts.total===26,r.setCounts);
 check('C every Legendary piece of a set wears the same +5/+5/+2 on the set stats',r.legendGroups&&r.legendGroups.mismatch===0&&r.legendGroups.sets>=8,r.legendGroups);
 check('C four Kestrel pieces: set bonus counts 4/4 and effStats carries the four-piece bonus',r.kestrel&&r.kestrel.counts.Kestrel===4&&r.kestrel.speedGain>=5+3+4&&r.kestrel.accelGain>=5+3,r.kestrel);
 check('C worn Kestrel saddle tints the leather to the set colour',r.tint&&r.tint.has&&r.tint.hex===r.tint.want,r.tint);
 check('C Rare pieces always belong to a set and a Rare pair pays a bonus',r.rarePair&&r.rarePair.rareNull===0&&r.rarePair.counts.Basin===2&&/agility:1/.test(r.rarePair.bonus),r.rarePair);
 check('D upgrade spends coins + Toolkit I, pays 1 SP per rarity star',r.up1&&r.up1.lvl===2&&r.up1.kit1===0&&r.up1.sp===1&&r.up1.coins<5000,r.up1);
 check('D upgrade refused without a toolkit (level and coins unchanged)',r.up2&&r.up2.lvl===2&&r.up2.coinsSame&&r.up2.kit1===0,r.up2);
 check('D levels stop at 8, kits I/II/III consumed by tier, no upgrade button at max',r.up8&&r.up8.lvl===8&&r.up8.max===8&&r.up8.kits[0]===3&&r.up8.kits[1]===2&&r.up8.kits[2]===4&&!r.up8.btn,r.up8);
 check('D Legendary Lv8 bonus is +8/+6/+2 and upgrade cost carries the kit tier',r.legend8&&Object.values(r.legend8).sort((a,b)=>b-a).join()==='8,6,2'&&r.costs.l1.kit==='kit1'&&r.costs.l4.kit==='kit2'&&r.costs.l7.kit==='kit3'&&r.costs.l4.c>r.costs.l1.c,{legend8:r.legend8,costs:r.costs});
 check('E strip removes the spare and pays parts',r.strip&&r.strip.removed===1&&r.strip.parts===r.strip.want,r.strip);
 check('E merge costs coins + parts and raises the primary bonus',r.merge&&r.merge.coinsDown===r.merge.cost&&r.merge.partsDown===3&&r.merge.bonusUp===1&&r.merge.merged===1,r.merge);
 check('E merge refused with no coins',r.mergePoor&&r.mergePoor.merged===1&&r.mergePoor.coins===0,r.mergePoor);
 check('F market stall: 3 date-seeded pieces, buy once',r.market&&r.market.n===3&&r.market.same&&r.marketBuy.coinsDown===r.marketBuy.price&&r.marketBuy.grew===1&&r.marketBuy.twice===1,{market:r.market,buy:r.marketBuy});
 check('F tier-1 chest drops Uncommon tack ~15% and a toolkit ~10%',r.chest&&r.chest.found&&r.chest.uncRate>=0.08&&r.chest.uncRate<=0.24&&r.chest.kitRate>=0.04&&r.chest.kitRate<=0.2,r.chest);
 check('G worn Western saddle: style, horn, seat drops by the Western offset, no posting',r.western&&r.western.styleW==='western'&&r.western.hornW&&!r.western.hornE&&Math.abs(r.western.seatDrop-r.western.wantDrop)<1e-3&&r.western.of==='western'&&r.western.post<0.01&&r.western.backE.style==='english'&&!r.western.backE.horn,r.western);
 check('H tack missions inserted with Bo the Saddler, daily and achievements registered',r.missions&&r.missions.i1===4&&r.missions.i2>r.missions.i1&&r.missions.npc&&r.missions.npcSpawned&&r.missions.daily&&r.missions.achs.length===0,r.missions);
 check('H upgrading advances the tacklvl mission and the kit reward is paid once on completion',r.missions&&r.missions.prog===2&&r.missions.done&&r.missions.kitPaid===1&&r.missions.mig&&r.missions.kitOnce===1,r.missions);
 check('I rider creator opens on first launch, body gates hairstyles, dice names, done saves + starter saddle',r.creator&&r.creator.exists&&r.creator.autoOpen&&r.creator.cropShown&&r.creator.braidHidden&&r.creator.after.made&&r.creator.after.nameMatches&&r.creator.after.hairStyle==='crop'&&r.creator.after.body==='m'&&r.creator.after.starter&&r.creator.after.starterWorn&&r.creator.after.hairMesh==='hair-crop'&&r.creator.after.scaleX>1.05&&r.creator.after.closed==='none',r.creator);
 check('J outfit change recolours the live rider without a rebuild',r.outfit&&r.outfit.shirt==='#b34a4a'&&r.outfit.hex==='b34a4a'&&r.outfit.w===1&&r.outfit.sameRider&&r.outfit.sceneSame,r.outfit);
 check('J helmet off hides the helmet band and shows a hair cap; hairstyle swaps the mesh',r.outfit&&r.outfit.helmet.saved==='none'&&r.outfit.helmet.hide===1&&r.outfit.helmet.helmW===0&&r.outfit.helmet.cap&&r.outfit.bun==='hair-bun',r.outfit&&r.outfit.helmet);
 check('K dust unlocks: locked pieces listed, unlock spends dust and wears it',r.dust&&r.dust.locked>=10&&r.dust.header&&r.dust.after.dust===10-r.dust.after.cost&&r.dust.after.owned===1&&r.dust.after.slotSet&&r.dust.after.stateOwned>=1&&r.dust.after.nowWear,r.dust);
 check('K unlock refused without dust (nothing owned, still locked)',r.dust&&r.dust.poor.ownedSame&&r.dust.poor.dust===0&&r.dust.poor.stillLocked===r.dust.locked-1,r.dust&&r.dust.poor);
 check('L season store shows this season\'s outfits and sells for tokens',r.store&&r.store.open==='flex'&&r.store.season&&r.store.tab&&r.store.n===r.store.want&&r.store.after.tokens===r.store.after.want&&r.store.after.owned&&(r.store.after.slot===true||r.store.after.slot==='tack')&&r.store.after.rows===r.store.want-1,r.store);
 check('L out-of-season outfit refused',r.store&&!r.store.outOfSeason.owned,r.store&&r.store.outOfSeason);
 if(r.store&&r.store.ranger)check('L Ranger Western tack set: four Epic Western Ranger pieces',r.store.ranger.n===4&&r.store.ranger.allRanger&&r.store.ranger.western===2,r.store.ranger);
 check('M prestige set gated, then worn with boots band + state flag',r.prestige&&r.prestige.before===false&&r.prestige.btn&&r.prestige.after.helmet==='#d4af37'&&r.prestige.after.boots==='#3b2a14'&&r.prestige.after.bootW===1&&r.prestige.after.bootHex==='3b2a14'&&r.prestige.after.state===true,r.prestige);
 check('M remote rider: badge tag, Western saddle, hairstyle/body/boots applied and live outfit propagation',r.remote&&r.remote.exists&&r.remote.badge===true&&r.remote.tag&&r.remote.saddleStyle==='western'&&r.remote.shirt1==='4a7ab3'&&r.remote.boots===1&&r.remote.hair==='hair-crop'&&r.remote.body>1.05&&r.remote.shirt2==='8a5ab3'&&r.remote.badge2===false&&r.remote.hair2==='hair-bun'&&r.remote.profile===true,r.remote);
 check('N render_game_to_text carries rider + tack keys, dust HUD painted',r.state&&r.state.rider&&r.state.rider.includes('prestige')&&r.state.tack&&r.state.tack.includes('maxLvl')&&r.state.sets===26&&/✨ 0/.test(r.state.dustEl),r.state);
 /* second load: an old save without rider.made shows the creator once; after Done a reload does not */
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));delete s.rider.made;s.rider={shirt:'#c98c5a',pants:'#2e3a52'};delete s.tw;localStorage.setItem('starRanchFable_v1',JSON.stringify(s));});
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(2500);
 await page.goto(base+'/ranch3d.html?qa=tack-wardrobe&legacy='+Date.now(),{waitUntil:'load',timeout:120000}); stage('legacy loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:30000,polling:250}).catch(()=>{});
 await page.evaluate(()=>window.advanceTime(700));
 const L=await page.evaluate(()=>{const p=document.getElementById('riderPanel');const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));const o={shown:p&&p.style.display,made:s.rider.made,body:s.rider.body,hairStyle:s.rider.hairStyle,parts:s.parts};p.querySelector('[data-fx="wd:done"]').click();o.madeAfter=JSON.parse(localStorage.getItem('starRanchFable_v1')).rider.made;return o;});
 check('O old save: creator shows once (ensure fills body/hairStyle/parts), Done marks it made',L.shown==='flex'&&L.made===false&&L.body==='f'&&L.hairStyle==='loose'&&L.parts===0&&L.madeAfter===true,L);
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(2500);
 await page.goto(base+'/ranch3d.html?qa=tack-wardrobe&again='+Date.now(),{waitUntil:'load',timeout:120000}); stage('third load');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:30000,polling:250}).catch(()=>{});
 await page.evaluate(()=>window.advanceTime(700));
 const T=await page.evaluate(()=>{const p=document.getElementById('riderPanel');return {shown:p&&p.style.display,installed:window.__features.installed.length,errors:window.__features.errors};});
 check('O creator does not reopen once made; all packages installed',T.shown!=='flex'&&T.installed===16&&T.errors.length===0,T);
 check('no console/page errors',errors.length===0,errors.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
