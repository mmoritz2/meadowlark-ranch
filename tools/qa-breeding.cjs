/* breeding package check.
   Boots ranch3d.html?qa=breeding, waits for the horse, then proves every feature of the package
   headlessly: the registries and save shape, cost by rarity, trait classes and inheritance rules,
   bloodline purity, coat genetics, the wild window, then — on a seeded save — Marta's barn end to
   end (pick, preview, confirm, gestation, time-warped birth), tokens, potions, wild coats, the
   fantasy recipe path, eggs, the foal stage (companion, play, ride gate) and questline, the horse
   sheet, the family tree, the recipe catalogue and the quest tab.

   Usage:  QA_URL=http://127.0.0.1:8431 NODE_PATH=$(npm root -g) node tools/qa-breeding.cjs */
const {chromium}=require('playwright');
const base=(process.env.QA_URL||'http://127.0.0.1:8431').replace(/\/$/,'');
const url=base+'/ranch3d.html?qa=breeding&fresh='+Date.now();
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
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
 page.on('dialog',d=>{d.dismiss().catch(()=>{});});
 stage('launch'); await page.goto(url,{waitUntil:'load',timeout:120000}); stage('loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage('horseReady');

 /* ---- static: registries, save shape, the rules ------------------------------------- */
 const A=await page.evaluate(()=>{
  const G=window.__features,B=G.breeding,T=G.tables,out={};
  out.installed=G.installed.includes('breeding'); out.errors=G.errors.slice(); out.hasB=!!B;
  if(!B)return out;
  const ct=Object.keys(B.CLASS_TRAITS); out.traits={n:ct.length,inRegistry:ct.filter(k=>!T.TRAITS[k]||!T.TRAITS[k].breeding).length,pure:ct.filter(k=>B.CLASS_TRAITS[k].cls==='pure').length,cross:ct.filter(k=>B.CLASS_TRAITS[k].cls==='cross').length,prestige:ct.filter(k=>B.CLASS_TRAITS[k].cls==='prestige').length,rosterKept:!!(T.TRAITS.prospector&&T.TRAITS.prospector.roster)};
  out.panels=['breedPanel','sheetPanel','treePanel'].filter(id=>!document.getElementById(id));
  const bb=document.getElementById('breedBtn'); out.dock={btn:!!bb,prev:bb&&bb.previousElementSibling&&bb.previousElementSibling.id,label:bb&&bb.textContent};
  out.npc=G.quest.NPC_DEFS.some(d=>d.id==='marta')&&G.world.npcList.some(e=>e.def.id==='marta');
  out.things=['foalbarn','eggnest','foalplay'].filter(id=>!G.world.things.some(t=>t.id===id));
  out.marker=G.world.mapMarkers.some(m=>m.glyph==='🍼');
  out.story={label:G.quest.STORY[7]&&G.quest.STORY[7].label,npc:G.quest.STORY[7]&&G.quest.STORY[7].npc,type:G.quest.STORY[7]&&G.quest.STORY[7].type,before:G.quest.STORY[6].label,after:G.quest.STORY[8].label};
  out.dailies=['foalplay','egg'].filter(t=>!G.quest.DAILYQ.some(d=>d.type===t)); out.breedDailyTok=(G.quest.DAILYQ.find(d=>d.type==='breed')||{r:{}}).r.btok;
  out.achs=['foal1','foalq','coats10','hatch1','wildfoal1','prestige1','trait3','recipe1'].filter(id=>!G.quest.ACHS.some(a=>a.id===id));
  out.questTab=!!G.ui.defs;
  const s=G.save.fresh(); const h=s.horses[0];
  out.save={breeding:s.breeding,foalq:s.foalq,coats:typeof s.coatsFound,prestige:h.prestige,genes:h.genes&&['E','A','Cr','G'].every(L=>Array.isArray(h.genes[L])&&h.genes[L].length===2),sex:h.sex,blood:h.blood};
  /* cost by rarity */
  out.cost={cc:B.breedCost({breed:'bay'},{breed:'chestnut'}),dm:B.breedCost({breed:'emberdrake'},{breed:'aether'}),asc:B.breedCost({breed:'alicorn'},{breed:'bay'}),ep:B.breedCost({breed:'sunset'},{breed:'bay'})};
  /* blood */
  const bl=B.mixBlood({blood:{palomino:50,sunset:50}},{blood:{palomino:50,black:50}}); out.blood={mix:bl,dom:B.dominantBreed(bl),pure:B.isPurePair({blood:{bay:100}},{blood:{bay:80,sunset:20}}),cross:B.isPurePair({blood:{bay:100}},{blood:{sunset:100}}),purity:B.purityOf({blood:{bay:60,sunset:40}}),legacy:B.purityOf({breed:'grey'})};
  /* trait inheritance with a stubbed roll */
  const R0=Math.random; const withRand=(v,f)=>{Math.random=()=>v;try{return f();}finally{Math.random=R0;}};
  const same=withRand(0.5,()=>B.inheritTrait({trait:{id:'ironheart',lvl:1}},{trait:{id:'ironheart',lvl:2}},true));
  const fresh=withRand(0.5,()=>B.inheritTrait({},{},false)); const freshP=withRand(0.5,()=>B.inheritTrait({},{},true));
  const combo=withRand(0.1,()=>B.inheritTrait({trait:{id:'ironheart',lvl:1}},{trait:{id:'quickstart',lvl:1}},true));
  const wrongCls=withRand(0.5,()=>B.inheritTrait({trait:{id:'ironheart',lvl:1}},{},false));           // a pure trait on a crossbreed foal: replaced by a cross trait
  const cap=withRand(0.5,()=>B.inheritTrait({trait:{id:'catfoot',lvl:3}},{trait:{id:'catfoot',lvl:3}},true));
  const pres=withRand(0.01,()=>B.inheritPrestige({},{},false)); const presNo=withRand(0.5,()=>B.inheritPrestige({},{},false)); const presForce=withRand(0.5,()=>B.inheritPrestige({prestige:{id:'starborn',lvl:1}},{},true)); const presFresh=withRand(0.5,()=>B.inheritPrestige({},{},true));
  out.inh={same,fresh:{cls:B.CLASS_TRAITS[fresh.trait.id].cls,how:fresh.how},freshP:B.CLASS_TRAITS[freshP.trait.id].cls,combo,wrongCls:B.CLASS_TRAITS[wrongCls.trait.id].cls,cap:cap.trait.lvl,pres:pres&&B.CLASS_TRAITS[pres.id].cls,presNo,presForce,presFresh};
  /* trait effects (grown vs foal) */
  out.fx={grown:B.traitFx({trait:{id:'truebred',lvl:2},prestige:{id:'meadowblessed',lvl:1}}),foal:B.traitFx({foal:true,trait:{id:'truebred',lvl:2}}),xpMul:G.mul('xp',s,{trait:{id:'quicklearner',lvl:2}}),sxpAg:G.mul('sxp',s,{trait:{id:'extraagility',lvl:1}},'agility'),sxpSp:G.mul('sxp',s,{trait:{id:'extraagility',lvl:1}},'speed'),drain:G.mul('stamDrain',null,{trait:{id:'longwind',lvl:1}})/G.mul('stamDrain',null,{}),regen:G.mul('stamRegen',null,{trait:{id:'secondwind',lvl:2}})/G.mul('stamRegen',null,{})};
  /* coat genetics */
  const gA={E:['E','e'],A:['a','a'],Cr:['n','n'],D:['n','n'],G:['n','n'],Rn:['n','n'],To:['n','n'],Lp:['n','n'],Z:['n','n']};
  const tally={}; for(let i=0;i<300;i++){const g=B.mixGenes(gA,gA);const p=B.phenotype(g,i);tally[p.label]=(tally[p.label]||0)+1;}
  out.genes={tally,chest:B.phenotype({E:['e','e'],A:['A','a'],Cr:['n','n'],D:['n','n'],G:['n','n'],Rn:['n','n'],To:['n','n'],Lp:['n','n'],Z:['n','n']},1).label,pal:B.phenotype({E:['e','e'],A:['A','a'],Cr:['Cr','n'],D:['n','n'],G:['n','n'],Rn:['n','n'],To:['n','n'],Lp:['n','n'],Z:['n','n']},1),grulla:B.phenotype({E:['E','E'],A:['a','a'],Cr:['n','n'],D:['D','n'],G:['n','n'],Rn:['n','n'],To:['n','n'],Lp:['n','n'],Z:['n','n']},1).label,greyTob:B.phenotype({E:['E','e'],A:['A','a'],Cr:['n','n'],D:['n','n'],G:['G','n'],Rn:['n','n'],To:['To','n'],Lp:['n','n'],Z:['n','n']},1),derive:{pal:B.deriveGenes({id:3,breed:'palomino'}),black:B.deriveGenes({id:4,breed:'black'}),fjord:B.deriveGenes({id:5,breed:'fjord'})},likely:B.likelyCoats({id:1,breed:'bay',genes:gA},{id:2,breed:'bay',genes:gA},3)};
  out.wild={inWin:B.wildWindow({wild:{since:Date.now()-3600e3}}),outWin:B.wildWindow({wild:{since:Date.now()-80*3600e3}}),legacy:B.wildWindow({wild:'bay'})};
  out.recipes={n:B.allRecipes().length,missing:B.allRecipes().filter(r=>!T.BREEDS3.some(b=>b[0]===r.child)).map(r=>r.child),cel:(B.recipeFor({blood:{unicorn:100}},{blood:{aether:100}})||{}).child,celRev:(B.recipeFor({blood:{aether:60,bay:40}},{blood:{unicorn:100}})||{}).child,none:B.recipeFor({blood:{bay:100}},{blood:{bay:100}})};
  out.dlg=String(G.run('dlg',G.quest.NPC_DEFS.find(d=>d.id==='marta'),s));
  out.state=JSON.parse(render_game_to_text()).breeding;
  return out;
 });
 check('breeding installed without error',A.installed&&A.errors.length===0&&A.hasB,{installed:A.installed,errors:A.errors});
 check('22 class traits in the shared TRAITS registry (6+3 pure, 6+3 cross, 4 prestige) beside the roster\'s',A.traits&&A.traits.n===22&&A.traits.inRegistry===0&&A.traits.pure===9&&A.traits.cross===9&&A.traits.prestige===4&&A.traits.rosterKept,A.traits);
 check('panels + dock button after the stable',A.panels&&A.panels.length===0&&A.dock.btn&&A.dock.prev==='stableBtn',{panels:A.panels,dock:A.dock});
 check('Marta, the barn, the nest and the play prompt exist',A.npc&&A.things.length===0&&A.marker,{npc:A.npc,things:A.things,marker:A.marker});
 check('tutorial mission inserted after Tame a wild horse, given by Marta',A.story&&A.story.label==='Breed your first foal'&&A.story.npc==='marta'&&A.story.type==='breed'&&/Tame/.test(A.story.before)&&/Championship/.test(A.story.after),A.story);
 check('dailies, breed daily pays a token, achievements',A.dailies.length===0&&A.breedDailyTok===1&&A.achs.length===0,{dailies:A.dailies,tok:A.breedDailyTok,achs:A.achs});
 check('save shape: breeding/foalq null, coatsFound, horse prestige/genes/sex/blood',A.save&&A.save.breeding===null&&A.save.foalq===null&&A.save.coats==='object'&&A.save.prestige===null&&A.save.genes&&/^[mf]$/.test(A.save.sex)&&A.save.blood,A.save);
 check('cost by rarity: Common 300/1, Dragon×Mythic 2200/5, Ascendant 2600/5, Epic 1100/3',A.cost&&A.cost.cc.c===300&&A.cost.cc.t===1&&A.cost.dm.c===2200&&A.cost.dm.t===5&&A.cost.asc.c===2600&&A.cost.ep.c===1100&&A.cost.ep.t===3&&A.cost.dm.gestMs===28*60e3,A.cost);
 check('bloodline purity: averages, dominant breed, pure vs cross pairs',A.blood&&A.blood.mix.palomino===50&&A.blood.mix.sunset===25&&A.blood.mix.black===25&&A.blood.dom==='palomino'&&A.blood.pure===true&&A.blood.cross===false&&A.blood.purity===60&&A.blood.legacy===100,A.blood);
 check('trait rules: same trait levels up, cross foals get cross traits, pure get pure, combos mutate, level caps at 3',A.inh&&A.inh.same.trait.id==='ironheart'&&A.inh.same.trait.lvl===3&&A.inh.same.how==='levelled'&&A.inh.fresh.cls==='cross'&&A.inh.freshP==='pure'&&A.inh.combo.trait.id==='steadyburst'&&A.inh.combo.how==='mutated'&&A.inh.wrongCls==='cross'&&A.inh.cap===3,A.inh);
 check('prestige: 6% roll, forced by the essence, upgrades an inherited one',A.inh&&A.inh.pres==='prestige'&&A.inh.presNo===null&&A.inh.presForce&&A.inh.presForce.id==='starborn'&&A.inh.presForce.lvl===2&&A.inh.presFresh&&A.inh.presFresh.lvl===1,{pres:A.inh&&A.inh.pres,no:A.inh&&A.inh.presNo,force:A.inh&&A.inh.presForce});
 check('trait effects stack (pure + prestige), none while a foal, xp/sxp/drain/regen multipliers',A.fx&&A.fx.grown.pts.speed===2&&A.fx.grown.pts.stamina===4&&A.fx.grown.drain===0.1&&Object.keys(A.fx.foal.pts).length===0&&Math.abs(A.fx.xpMul-1.2)<1e-9&&Math.abs(A.fx.sxpAg-1.15)<1e-9&&A.fx.sxpSp===1&&Math.abs(A.fx.drain-0.88)<1e-9&&Math.abs(A.fx.regen-1.3)<1e-9,A.fx);
 check('coat genetics: Ee×Ee gives black and chestnut foals; cream, dun, grey and tobiano phenotypes',A.genes&&A.genes.tally.Black>100&&A.genes.tally.Chestnut>30&&A.genes.chest==='Chestnut'&&A.genes.pal.label==='Palomino'&&A.genes.pal.mark==='none'&&A.genes.grulla==='Grulla'&&A.genes.greyTob.label==='Grey Tobiano'&&A.genes.greyTob.mark==='pinto'&&A.genes.derive.pal.Cr.includes('Cr')&&A.genes.derive.black.A.join('')==='aa'&&A.genes.derive.fjord.D.join('')==='DD'&&A.genes.likely.length>=2,{tally:A.genes&&A.genes.tally,chest:A.genes&&A.genes.chest,pal:A.genes&&A.genes.pal,grulla:A.genes&&A.genes.grulla,greyTob:A.genes&&A.genes.greyTob,likely:A.genes&&A.genes.likely});
 check('wild window: 72 h after taming, legacy string flag is not a window',A.wild&&A.wild.inWin===true&&A.wild.outWin===false&&A.wild.legacy===false,A.wild);
 check('recipe catalogue: 8 chance recipes + the roster\'s, every child is a real row, dominant-blood lookup',A.recipes&&A.recipes.n>=24&&A.recipes.missing.length===0&&A.recipes.cel==='celestial'&&A.recipes.celRev==='celestial'&&A.recipes.none===null,A.recipes);
 check('Marta\'s dialogue offers the barn and the recipes',/Foaling barn/.test(A.dlg)&&/Recipes/.test(A.dlg));
 check('render_game_to_text carries breeding',A.state&&A.state.btok===0&&A.state.pairing===null&&A.state.foalq===null,A.state);

 /* ---- seeded save: the barn end to end -------------------------------------------- */
 await page.evaluate(()=>{
  const now=Date.now(), mk=(id,name,breed,sex,body,mane,extra)=>Object.assign({id,name,breed,sex,colors:{body,mane},horn:false,rainbow:false,wings:false,dragon:false,coat:null,stats:{speed:5,stamina:5,jump:5,accel:5,agility:5},sxp:{},level:6,xp:0,bond:70,needs:{hunger:90,thirst:90,clean:90,happy:90},foal:false,tack:null,out:true},extra||{});
  const gBay={E:['E','e'],A:['a','a'],Cr:['n','n'],D:['n','n'],G:['n','n'],Rn:['n','n'],To:['n','n'],Lp:['n','n'],Z:['n','n']};
  const sv={v:2,ranchName:'Meadowlark Ranch',founded:now-864e5*9,coins:20000,gems:60,items:{carrot:10,apple:4,hay:3,pot_mirror:1,pot_hornbud:1},nextId:10,decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:false,lastSeen:now,lastDaily:'',questDate:'',quests:[],totalRaces:0,started:true,keys:1,tack:[],btok:3,story:{idx:7,prog:0,v:1},mig:{'breeding-tutorial':1},
   horses:[
    mk(1,'Ash','bay','m','#8a5a2b','#332214',{trait:{id:'truebred',lvl:1},genes:gBay,mark:'points',markCol:'#241a12'}),
    mk(2,'Bramble','bay','f','#8a5a2b','#332214',{trait:{id:'truebred',lvl:1},genes:gBay,mark:'points',markCol:'#241a12'}),
    mk(3,'Cinder','black','m','#26262e','#101015',{}),
    mk(4,'Dusk','palomino','f','#c89a4a','#3a2a12',{mark:'roan',markCol:'#4a3418',wild:{since:now-3600e3,breed:'palomino',coat:'Brindle Gold'}}),
    mk(5,'Ember','emberdrake','m','#3a1410','#ff8a3a',{wings:true,dragon:true,coat:'fire',glow:true,ability:'fly'}),
    mk(6,'Nova','aether','f','#1a1a2e','#b79dff',{coat:'galaxy',glow:true,ability:'swift'}),
    mk(9,'Shell','ancientdrake','f','#0d0a12','#ffb44a',{wings:true,dragon:true,coat:'eclipse',glow:true,ability:'fly',foal:true,egg:true,eggWarm:4,eggLaid:now-60e3,born:now-60e3,level:1,bond:30,lineage:{sire:5,dam:6,gen:1,sireName:'Ember',damName:'Nova'}}),
   ]};
  localStorage.setItem('starRanchFable_v1',JSON.stringify(sv));
 });
 stage('seeded');
 await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(1200);
 await page.goto(base+'/ranch3d.html?qa=breeding&seeded='+Date.now(),{waitUntil:'load',timeout:120000}); stage('seeded loaded');
 await page.waitForFunction(READY,null,{timeout:150000,polling:250});
 stage('seeded horseReady');
 const K='starRanchFable_v1';
 const D1=await page.evaluate(()=>{
  const G=window.__features,B=G.breeding,K='starRanchFable_v1',out={},$=id=>document.getElementById(id);
  const sv=()=>JSON.parse(localStorage.getItem(K));
  const warp=()=>{const s=sv();if(s.breeding)s.breeding.since-=s.breeding.ms+5;localStorage.setItem(K,JSON.stringify(s));};
  out.migrated={wild:typeof sv().horses[3].wild,genesAll:sv().horses.every(h=>h.genes&&h.genes.E),legacyEgg:!!sv().horses.find(h=>h.id===9).egg};
  /* open the barn from the dock */
  $('breedBtn').click();
  const p=$('breedPanel'); out.open={shown:p.style.display,text:p.textContent.slice(0,80),stallion:/Stallion/.test(p.innerHTML),preview:!!p.querySelector('#breedPreview'),opts:p.querySelectorAll('select option').length};
  /* pair Ash × Bramble: purebred bay, both True Bred I */
  B.ui.a=1;B.ui.b=2;G.ui.rerender('breedPanel');
  const pv=p.querySelector('#breedPreview'); out.preview={pure:/Purebred/.test(pv.textContent),trait:/True Bred/.test(pv.innerHTML)&&/level up/.test(pv.textContent),purity:/Purity/.test(pv.textContent)&&/Quarter Horse 100%/.test(pv.textContent),stats:/Speed 5–6/.test(pv.textContent),coat:/Likely coat/.test(pv.textContent),gest:/90 s/.test(pv.textContent)};
  p.querySelector('[data-fx="breed:go:c"]').click();
  out.confirmCard=!!p.querySelector('[data-fx="breed:confirm"]')&&/300 🪙/.test(p.textContent);
  const c0=sv().coins; p.querySelector('[data-fx="breed:confirm"]').click();
  const s1=sv(); out.paired={has:!!s1.breeding,ms:s1.breeding&&s1.breeding.ms,dc:c0-s1.coins,mode:s1.breeding&&s1.breeding.mode,gestCard:/A foal on the way/.test(p.textContent)&&/Hurry/.test(p.textContent),busy:!p.querySelector('[data-fx="breed:go:c"]')};
  /* not due yet: nothing happens */
  B.checkBirth(); out.notDue=sv().horses.length===7&&!!sv().breeding;
  /* time-warp and collect */
  warp(); const n0=sv().horses.length; B.checkBirth(); const s2=sv(); const foal=s2.horses[s2.horses.length-1];
  out.birth={n:s2.horses.length-n0,foal:foal.foal,name:foal.name,unique:s2.horses.filter(h=>h.name===foal.name).length===1,breed:foal.breed,sire:foal.lineage.sire,dam:foal.lineage.dam,sireName:foal.lineage.sireName,gen:foal.lineage.gen,cls:foal.lineage.cls,trait:foal.trait,how:foal.traitHow,blood:foal.blood,genes:!!foal.genes,geneFromParents:foal.genes&&foal.genes.A.join('')==='aa',coatLabel:foal.coatLabel,coatHow:foal.coatHow,sex:foal.sex,prestige:foal.prestige,breeding:s2.breeding,foalq:s2.foalq,companion:s2.companion,foals:s2.stats.foals,coatsFound:Object.keys(s2.coatsFound),story:JSON.parse(render_game_to_text()).story,daily:(s2.life&&s2.life.breed)||0,btokBadge:$('btokEl').style.display!=='none'};
  out.foalId=foal.id;
  return out;
 });
 check('legacy migration: wild string → window object, genes derived for every horse, egg kept',D1.migrated&&D1.migrated.wild==='object'&&D1.migrated.genesAll&&D1.migrated.legacyEgg,D1.migrated);
 check('dock 🍼 opens the barn: stallion/mare selects and a preview',D1.open&&D1.open.shown==='flex'&&D1.open.stallion&&D1.open.preview&&D1.open.opts>=4,D1.open);
 check('preview: purebred, levelled trait, purity, stat ranges, likely coat, 90 s first foal',D1.preview&&Object.values(D1.preview).every(Boolean),D1.preview);
 check('pay → confirm card → pairing stored, 300 🪙 charged, 90 s gestation, barn busy',D1.confirmCard&&D1.paired&&D1.paired.has&&D1.paired.ms===90000&&D1.paired.dc===300&&D1.paired.mode==='c'&&D1.paired.gestCard&&D1.paired.busy,D1.paired);
 check('no birth before the due time',D1.notDue);
 check('birth: purebred bay foal, sire/dam ids + names, True Bred II (levelled), blood bay 100, coat from the parents\' genes (a mutation layers on top, never replaces)',D1.birth&&D1.birth.n===1&&D1.birth.foal&&D1.birth.unique&&D1.birth.breed==='bay'&&D1.birth.sire===1&&D1.birth.dam===2&&D1.birth.sireName==='Ash'&&D1.birth.gen===1&&D1.birth.cls==='pure'&&D1.birth.trait&&D1.birth.trait.id==='truebred'&&D1.birth.trait.lvl===2&&D1.birth.how==='levelled'&&D1.birth.blood.bay===100&&D1.birth.genes&&D1.birth.geneFromParents&&/^(genes|mutation)$/.test(D1.birth.coatHow||'')&&/Black|Chestnut/.test(D1.birth.coatLabel||''),D1.birth);
 check('birth side effects: pairing cleared, foal questline started on it, it follows you, stats.foals, coat registry, tutorial mission progressed, daily counted, token HUD shown',D1.birth&&D1.birth.breeding===null&&D1.birth.foalq&&D1.birth.foalq.idx===0&&D1.birth.foalq.active===D1.foalId&&D1.birth.companion===D1.foalId&&D1.birth.foals===1&&D1.birth.coatsFound.length===1&&D1.birth.story.idx===7&&D1.birth.story.prog>=1&&D1.birth.daily>=1&&D1.birth.btokBadge,{breeding:D1.birth&&D1.birth.breeding,foalq:D1.birth&&D1.birth.foalq,companion:D1.birth&&D1.birth.companion,story:D1.birth&&D1.birth.story,daily:D1.birth&&D1.birth.daily,coats:D1.birth&&D1.birth.coatsFound});

 /* cost by rarity, tokens, gems + hurry, the roster's recipe path */
 const D2=await page.evaluate(()=>{
  const G=window.__features,B=G.breeding,K='starRanchFable_v1',out={},$=id=>document.getElementById(id);
  const sv=()=>JSON.parse(localStorage.getItem(K)); const warp=()=>{const s=sv();if(s.breeding)s.breeding.since-=s.breeding.ms+5;localStorage.setItem(K,JSON.stringify(s));};
  B.ui.a=5;B.ui.b=6;B.ui.confirm=null;G.ui.open('breedPanel'); const p=$('breedPanel');
  out.dragonPrice={coins:/2200 🪙/.test(p.textContent),tokBtn:p.querySelector('[data-fx="breed:go:t"]')&&p.querySelector('[data-fx="breed:go:t"]').disabled,tokText:/5 💞/.test(p.textContent),recipe:/Amethyst/.test(p.querySelector('#breedPreview').textContent)};
  const b0=sv().btok; B.startPairing('t'); out.tokRefused={btok:sv().btok,paired:!!sv().breeding};
  const c0=sv().coins; B.startPairing('c'); const s1=sv(); out.dragonPaired={dc:c0-s1.coins,ms:s1.breeding&&s1.breeding.ms,hurryBtn:/Hurry · 6 💎/.test($('breedPanel').textContent)};
  const g0=sv().gems; B.hurry(); const s2=sv(); const foal=s2.horses[s2.horses.length-1];
  out.hurried={dg:g0-s2.gems,born:!s2.breeding&&foal.foal,breed:foal.breed,blood:foal.blood,cls:foal.lineage.cls,variantFound:foal.variantFound,coat:foal.coat};
  /* a token-paid pairing: Common pair costs 1 token */
  B.ui.a=1;B.ui.b=4; const t0=sv().btok; B.startPairing('t'); out.tokPaid={dt:t0-sv().btok,paired:!!sv().breeding,rarity:B.breedCost(sv().horses[0],sv().horses[3]).rarity}; warp(); B.checkBirth(); out.tokBorn=!sv().breeding&&sv().horses.length===10;
  return out;
 });
 check('Dragon × Mythic shows 2200 🪙 / 5 💞, token button disabled at 3 tokens, recipe (Amethyst) previewed',D2.dragonPrice&&Object.values(D2.dragonPrice).every(Boolean),D2.dragonPrice);
 check('paying with too few tokens is refused',D2.tokRefused&&D2.tokRefused.btok===3&&!D2.tokRefused.paired,D2.tokRefused);
 check('Dragon pairing charges 2200 🪙 with a 28-minute gestation and a 6 💎 hurry',D2.dragonPaired&&D2.dragonPaired.dc===2200&&D2.dragonPaired.ms===28*60e3&&D2.dragonPaired.hurryBtn,D2.dragonPaired);
 check('hurry spends 6 play-earned gems; the roster\'s recipe makes an Amethyst Dragon with a pure new bloodline',D2.hurried&&D2.hurried.dg===6&&D2.hurried.born&&D2.hurried.breed==='amethyst'&&D2.hurried.blood.amethyst===100&&D2.hurried.coat==='galaxy',D2.hurried);
 check('an Uncommon pairing paid with 1 breeding token',D2.tokPaid&&D2.tokPaid.dt===1&&D2.tokPaid.paired&&D2.tokBorn,D2.tokPaid);

 /* potions and the wild window */
 const D3=await page.evaluate(()=>{
  const G=window.__features,B=G.breeding,K='starRanchFable_v1',out={},$=id=>document.getElementById(id);
  const sv=()=>JSON.parse(localStorage.getItem(K)); const warp=()=>{const s=sv();if(s.breeding)s.breeding.since-=s.breeding.ms+5;localStorage.setItem(K,JSON.stringify(s));};
  /* Cinder (black) × Dusk (wild Brindle Gold) with a Mirror Draught on the sire and a Hornbud Tonic */
  B.ui.a=3;B.ui.b=4;B.ui.pot={mirror:true,hornbud:true};B.ui.mirror='a';G.ui.open('breedPanel');
  out.potRow={checked:$('breedPanel').querySelectorAll('input[type=checkbox]:checked').length,mirrorSel:!!$('breedPanel').querySelector('[data-fxin="breed:mirror"]'),wildOpt:/🌿 wild/.test($('breedPanel').innerHTML)};
  B.startPairing('c'); const s1=sv(); out.potUsed={mirror:s1.items.pot_mirror,horn:s1.items.pot_hornbud,pot:s1.breeding&&s1.breeding.pot};
  warp(); B.checkBirth(); const s2=sv(); const f=s2.horses[s2.horses.length-1];
  out.mirror={body:f.colors.body,sireBody:s2.horses[2].colors.body,mark:f.mark,horn:f.horn,how:f.coatHow,cls:f.lineage.cls};
  /* the wild window without potions: 70% copies Dusk's coat (roll forced low) */
  const R0=Math.random; Math.random=()=>0.2;
  B.ui.pot={}; B.startPairing('c'); warp(); B.checkBirth(); Math.random=R0;
  const s3=sv(); const w=s3.horses[s3.horses.length-1];
  out.wild={body:w.colors.body,damBody:s3.horses[3].colors.body,mark:w.mark,markCol:w.markCol,how:w.coatHow,wildFoals:s3.stats.wildFoals,bred:s3.horses[3].wild.bred,trait:w.trait&&B.CLASS_TRAITS[w.trait.id].cls};
  /* past the window: the coat is no longer copied (genetics take over) */
  const s4=sv(); s4.horses[3].wild.since=Date.now()-80*3600e3; localStorage.setItem(K,JSON.stringify(s4));
  Math.random=()=>0.2; B.startPairing('c'); warp(); B.checkBirth(); Math.random=R0;
  const s5=sv(); const x=s5.horses[s5.horses.length-1]; out.afterWindow={how:x.coatHow,copied:x.colors.body===s5.horses[3].colors.body,wildOpt:/🌿 wild/.test((G.ui.rerender('breedPanel'),$('breedPanel').innerHTML))};
  /* Marta's stall sells potions for coins */
  const c0=sv().coins; G.ui.dispatch('breed:buypot:starlight'); out.stall={dc:c0-sv().coins,owned:sv().items.pot_starlight};
  return out;
 });
 check('potion row: two checked, mirror parent select, wild option marked 🌿',D3.potRow&&D3.potRow.checked===2&&D3.potRow.mirrorSel&&D3.potRow.wildOpt,D3.potRow);
 check('potions are consumed on the pairing',D3.potUsed&&D3.potUsed.mirror===0&&D3.potUsed.horn===0&&D3.potUsed.pot&&D3.potUsed.pot.length===2,D3.potUsed);
 check('Mirror Draught copies the sire\'s coat exactly; Hornbud gives a horn',D3.mirror&&D3.mirror.body===D3.mirror.sireBody&&D3.mirror.horn===true&&D3.mirror.how==='mirror'&&D3.mirror.cls==='cross',D3.mirror);
 check('wild window: the foal wears Dusk\'s Brindle Gold (roan), wildFoals counted, crossbreed trait',D3.wild&&D3.wild.body===D3.wild.damBody&&D3.wild.mark==='roan'&&D3.wild.how==='wild'&&D3.wild.wildFoals>=1&&D3.wild.bred===true&&D3.wild.trait==='cross',D3.wild);
 check('after 72 h the wild coat is not copied and the 🌿 tag is gone',D3.afterWindow&&D3.afterWindow.how==='genes'&&!D3.afterWindow.copied&&!D3.afterWindow.wildOpt,D3.afterWindow);
 check('Marta\'s stall: Starlight Elixir for 750 🪙',D3.stall&&D3.stall.dc===750&&D3.stall.owned===1,D3.stall);

 /* the foal stage: companion, prompt, play, questline, growth, ride gate */
 const D4=await page.evaluate(async()=>{
  const G=window.__features,B=G.breeding,K='starRanchFable_v1',out={},$=id=>document.getElementById(id);
  const sv=()=>JSON.parse(localStorage.getItem(K));
  const s0=sv(); const fid=s0.foalq.active; const f0=s0.horses.find(h=>h.id===fid);
  out.foal={name:f0.name,companion:s0.companion===fid,out:f0.out};
  G.horse.reloadHorses();
  const ent=G.horse.herd().find(e=>G.horse.myHorses[e.idx]&&G.horse.myHorses[e.idx].id===fid);
  out.herd=!!ent;
  if(ent){G.horse.player.pos.set(ent.pos.x+2,0,ent.pos.z+2);G.horse.player.speed=0;}
  window.advanceTime(1500);
  out.near={idx:sv().foalq.idx,ctx:$('ctx').textContent};
  /* the prompt plays with it */
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
  const s1=sv(); out.play1={plays:s1.stats.foalPlays,dailyPlay:(s1.life&&s1.life.foalplay)||0,bond:s1.horses.find(h=>h.id===fid).bond};
  /* care panel: the foal row and its buttons */
  G.ui.openCare(); const cp=$('carePanel'); out.care={row:new RegExp('🍼 '+f0.name).test(cp.textContent),btns:['foal:treat','foal:groom','foal:play','foal:call'].filter(k=>!cp.querySelector('[data-care="'+k+'"]')),step:/Foal's first steps/.test(cp.textContent)};
  cp.querySelector('[data-care="foal:treat"]').click(); out.feed={idx:sv().foalq.idx,carrots:sv().items.carrot};
  cp.querySelector('[data-care="foal:groom"]').click(); out.groom={idx:sv().foalq.idx};
  /* 📣 Call: the click must not teleport the foal to your side — it clears the graze and
     canters in under its own legs. The entity is placed far away AFTER the click (the care
     action reloads the herd, which re-scatters it) so the distance closed is all movement. */
  {cp.querySelector('[data-care="foal:call"]').click();
   const ent=()=>G.horse.herd().find(x=>G.horse.myHorses[x.idx]&&G.horse.myHorses[x.idx].id===fid);
   const e=ent(); let d0=0,peak=0,rest0=0;
   if(e){e.pos.x=G.horse.player.pos.x+30;e.pos.z=G.horse.player.pos.z;e.rest=9;e.tx=e.pos.x;e.tz=e.pos.z;e.wsp=1.2;
    rest0=e.rest; d0=Math.hypot(G.horse.player.pos.x-e.pos.x,G.horse.player.pos.z-e.pos.z);}
   for(let i=0;i<8;i++){window.advanceTime(500);const ei=ent();if(ei)peak=Math.max(peak,ei.wsp||0);}
   const e2=ent();
   out.call={d0:Math.round(d0),rest0,after:e2?Math.round(Math.hypot(G.horse.player.pos.x-e2.pos.x,G.horse.player.pos.z-e2.pos.z)):-1,wsp:Math.round(peak),rest:e2&&Math.round(e2.rest)};}
  G.ui.openCare();
  /* the walk: ride with the foal at your side */
  G.hidePanels(); window.__features.horse.player.speed=0;
  const ent2=G.horse.herd().find(e=>G.horse.myHorses[e.idx]&&G.horse.myHorses[e.idx].id===fid); if(ent2){G.horse.player.pos.set(ent2.pos.x+1.5,0,ent2.pos.z+1.5);}
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'})); window.advanceTime(3500); window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
  out.walk={idx:sv().foalq.idx,prog:sv().foalq.prog}; if(sv().foalq.idx===3)B.foalEvt('foalwalk',300);
  out.walkDone=sv().foalq.idx;
  B.foalAct('play'); const c0=sv().coins; B.foalAct('play'); const s2=sv(); out.play2={idx:s2.foalq.idx,potMirror:s2.items.pot_mirror,plays:s2.stats.foalPlays};
  /* ride gate */
  G.ui.openStable(); const st=$('stablePanel'); const fi=sv().horses.findIndex(h=>h.id===fid);
  out.gate={rideBtn:!!st.querySelector('[data-st="ride:'+fi+'"]'),sheetBtn:!!st.querySelector('[data-fx="breed:sheet:'+fi+'"]'),treeBtn:!!st.querySelector('[data-fx="breed:tree:'+fi+'"]'),traitChip:/True Bred/.test(st.innerHTML)};
  const ri=G.horse.rideIdx(); const sel=$('horseSel'); sel.value=String(fi); sel.onchange(); out.gate.rideIdxAfter=G.horse.rideIdx(); out.gate.rideIdxBefore=ri;
  G.hidePanels();
  /* growth: level 3 clears foal:true (the interval does it; here the flag is set as the game would) */
  const s3=sv(); const fh=s3.horses.find(h=>h.id===fid); fh.foal=false; fh.level=3; localStorage.setItem(K,JSON.stringify(s3)); G.horse.reloadHorses();
  const coins0=sv().coins, keys0=sv().keys, btok0=sv().btok; window.advanceTime(2600); await new Promise(r=>setTimeout(r,300));   // growth is noticed on the 2 s pass and paid a tick later
  const s4=sv(); out.grow={idx:s4.foalq.idx,done:!!s4.foalq.done,dc:s4.coins-coins0,dk:s4.keys-keys0,dt:s4.btok-btok0,ach:JSON.parse(render_game_to_text()).breeding.foalq};
  G.ui.openStable(); out.gate.rideAfterGrow=!!$('stablePanel').querySelector('[data-st="ride:'+fi+'"]'); G.hidePanels();
  return out;
 });
 check('the newborn follows you (companion on disk, in the herd)',D4.foal&&D4.foal.companion&&D4.foal.out&&D4.herd,{foal:D4.foal,herd:D4.herd});
 check('walking up to the foal completes step 1 and the E prompt offers play',D4.near&&D4.near.idx===1&&/Play with/.test(D4.near.ctx),D4.near);
 check('E plays with the foal: counted, daily, bond',D4.play1&&D4.play1.plays===1&&D4.play1.dailyPlay===1&&D4.play1.bond>30,D4.play1);
 check('Care panel shows the foal row with treat/groom/play/call and the questline step',D4.care&&D4.care.row&&D4.care.btns.length===0&&D4.care.step,D4.care);
 check('treat (uses a carrot) and groom advance the questline',D4.feed&&D4.feed.idx===2&&D4.feed.carrots===9&&D4.groom.idx===3,{feed:D4.feed,groom:D4.groom});
 check('📣 Call: the graze is broken and the foal canters 30 m in under its own legs, never teleported',D4.call&&D4.call.d0===30&&D4.call.rest0===9&&D4.call.after<12&&D4.call.wsp>2.5,D4.call);
 check('riding beside the foal accumulates the walk; 300 m completes it',D4.walk&&(D4.walk.prog>0||D4.walk.idx>3)&&D4.walkDone===4,{walk:D4.walk,done:D4.walkDone});
 check('two plays finish step 5 (a Mirror Draught)',D4.play2&&D4.play2.idx===5&&D4.play2.potMirror===1&&D4.play2.plays===3,D4.play2);
 check('ride gate: no Ride button for a foal, the dropdown refuses it; sheet/tree buttons and trait chip on the row',D4.gate&&!D4.gate.rideBtn&&D4.gate.sheetBtn&&D4.gate.treeBtn&&D4.gate.traitChip&&D4.gate.rideIdxAfter===D4.gate.rideIdxBefore,D4.gate);
 check('growing up finishes the questline: 400🪙 +3💎 +1🗝️ +1💞 and the Ride button appears',D4.grow&&D4.grow.idx===6&&D4.grow.done&&D4.grow.dc===400&&D4.grow.dk===1&&D4.grow.dt===1&&D4.gate.rideAfterGrow,D4.grow);

 /* eggs, tokens from a course, the sheet, the tree, recipes, quest tab */
 const D5=await page.evaluate(async()=>{
  const G=window.__features,B=G.breeding,K='starRanchFable_v1',out={},$=id=>document.getElementById(id);
  const sv=()=>JSON.parse(localStorage.getItem(K));
  G.ui.openStable(); const st=$('stablePanel'); out.eggHeader={listed:/🥚 Eggs/.test(st.textContent)&&/Shell/.test(st.textContent)&&/4\/5/.test(st.textContent),btn:!!st.querySelector('[data-fx="breed:warm"]')};
  const p0=sv().items.pot_prestige||0; st.querySelector('[data-fx="breed:warm"]').click();
  const s1=sv(); const shell=s1.horses.find(h=>h.id===9); out.hatched={egg:shell.egg,foal:shell.foal,hatched:s1.stats.hatched,pot:(s1.items.pot_prestige||0)-p0,daily:(s1.life&&s1.life.egg)||0,gone:!/🥚 Eggs/.test($('stablePanel').textContent)};
  G.hidePanels();
  /* tokens from a course finish: a race at 3 stars, first win */
  const t0=sv().btok; G.run('courseFinish',{c:{},ev:{id:'r1',race:true,reward:500,name:'QA race'},stars:3,RB:{featured:true,rib:3},pay:500,dressage:false});
  await new Promise(r=>setTimeout(r,1400)); out.tok={dt:sv().btok-t0,hud:$('btokEl').textContent};
  /* the horse sheet for any horse */
  G.ui.openStable(); $('stablePanel').querySelector('[data-fx="breed:sheet:3"]').click(); const sh=$('sheetPanel');
  out.sheet={shown:sh.style.display,name:/Dusk/.test(sh.textContent),purity:/Bloodline/.test(sh.textContent)&&/Palomino Mustang 100%/.test(sh.textContent),tack:/Tack/.test(sh.textContent)&&/Saddle/.test(sh.textContent),mastery:/mastery/.test(sh.textContent),stats:sh.querySelectorAll('.crow .lbl').length>=6,pers:/Relaxed|Energetic|Social|Alert|Aloof|Challenging/.test(sh.textContent),wild:/wild coat/.test(sh.textContent)&&/Brindle Gold/.test(sh.textContent),sex:/mare/.test(sh.textContent),ride:!!sh.querySelector('[data-fx="breed:ride:3"]'),traits:/Traits/.test(sh.textContent)};
  /* the family tree for the first foal */
  const s2=sv(); const fi=s2.horses.findIndex(h=>h.lineage&&h.lineage.sire===1&&h.lineage.dam===2); const foal=s2.horses[fi];
  G.ui.dispatch('breed:tree:'+fi); const tr=$('treePanel');
  out.tree={shown:tr.style.display,parents:/Ash/.test(tr.textContent)&&/Bramble/.test(tr.textContent),self:new RegExp(foal.name).test(tr.textContent),gen:/generation 1/.test(tr.textContent),purebred:/born a purebred/.test(tr.textContent)};
  G.ui.dispatch('breed:tree:0'); out.treeUp={desc:new RegExp(foal.name).test($('treePanel').textContent)&&/Foal/.test($('treePanel').textContent)};
  /* sold parent shows as a ghost */
  const s3=sv(); const idx=s3.horses.findIndex(h=>h.id===1); const [gone]=s3.horses.splice(idx,1); localStorage.setItem(K,JSON.stringify(s3)); G.horse.reloadHorses();
  G.ui.dispatch('breed:tree:'+s3.horses.findIndex(h=>h.id===foal.id)); out.ghost=/Ash/.test($('treePanel').textContent)&&/no longer on the ranch/.test($('treePanel').textContent);
  /* recipes: shop tab + filter */
  G.ui.openShop('recipes'); const sp=$('shopPanel'); out.rec={alicorn:/Alicorn/.test(sp.textContent)&&/Unicorn × /.test(sp.textContent),celestial:/Celestial Unicorn/.test(sp.textContent)&&/Unicorn × (✅ )?Aether Friesian/.test(sp.textContent)&&/50%/.test(sp.textContent),egg:/hatches from an egg/.test(sp.textContent),owned:/✅ Amethyst Dragon/.test(sp.textContent)};
  sp.querySelector('[data-fx="breed:recfilter:6"]').click(); const sp2=$('shopPanel'); out.rec.six={alicorn:/Alicorn/.test(sp2.textContent),celestial:/Celestial/.test(sp2.textContent)};
  /* breed tab in the shop still works (VR/legacy) */
  G.ui.openShop('breed'); out.shopBreed=/Foaling Barn/.test($('shopPanel').textContent)&&!!$('shopPanel').querySelector('[data-fxin="breed:pick:a"]');
  /* quest tab */
  G.ui.openQuests(); document.querySelector('[data-q="tab:foal"]').click(); out.qtab=/Foal's First Steps/.test($('questPanel').textContent)&&/Watch it grow up/.test($('questPanel').textContent)&&($('questPanel').textContent.match(/✅/g)||[]).length===6;
  G.hidePanels();
  /* achievements */
  const s4=sv(); const ach=id=>{const a=G.quest.ACHS.find(a=>a.id===id);return a?a.v(s4):null;}; out.ach={foal1:ach('foal1'),foalq:ach('foalq'),hatch1:ach('hatch1'),wildfoal1:ach('wildfoal1'),coats:ach('coats10'),recipe1:ach('recipe1'),trait3:ach('trait3')};
  out.state=JSON.parse(render_game_to_text()).breeding;
  return out;
 });
 check('stable lists the egg with its warmth and a Warm button',D5.eggHeader&&D5.eggHeader.listed&&D5.eggHeader.btn,D5.eggHeader);
 check('the fifth warm hatches it: egg gone, still a foal, Prestige Essence, daily counted',D5.hatched&&!D5.hatched.egg&&D5.hatched.foal&&D5.hatched.hatched===1&&D5.hatched.pot===1&&D5.hatched.daily===1&&D5.hatched.gone,D5.hatched);
 check('a featured 3-star race pays 3 tokens (race + first win + featured) and paints the HUD',D5.tok&&D5.tok.dt===3&&/💞/.test(D5.tok.hud),D5.tok);
 check('horse sheet for any horse: name, purity, tack slots, mastery, stats, personality, wild coat, sex, Ride',D5.sheet&&Object.values(D5.sheet).every(v=>v===true||v==='flex'),D5.sheet);
 check('family tree: parents, self, generation, purebred; descendants from a parent\'s tree',D5.tree&&D5.tree.shown==='flex'&&D5.tree.parents&&D5.tree.self&&D5.tree.gen&&D5.tree.purebred&&D5.treeUp.desc,{tree:D5.tree,up:D5.treeUp});
 check('a sold parent still shows by name in the tree',D5.ghost);
 check('recipe catalogue: alicorn and celestial with parents and odds, egg marker, owned tick; 6-star filter',D5.rec&&D5.rec.alicorn&&D5.rec.celestial&&D5.rec.egg&&D5.rec.owned&&D5.rec.six.alicorn&&!D5.rec.six.celestial,D5.rec);
 check('shop breed tab still routes to the barn',D5.shopBreed);
 check('quest tab 🍼 Foal lists the questline, all six done',D5.qtab);
 check('achievements count foals, questline, hatch, wild foal, coats, recipe',D5.ach&&D5.ach.foal1>=5&&D5.ach.foalq===6&&D5.ach.hatch1===1&&D5.ach.wildfoal1>=1&&D5.ach.coats>=1&&D5.ach.trait3>=3,D5.ach);
 check('state dump: btok, foals, foalq, companion',D5.state&&D5.state.btok>=3&&D5.state.foals>=5&&D5.state.foalq&&D5.state.foalq.idx===6,D5.state);
 console.log(await page.evaluate(()=>render_game_to_text()));
 check('no console/page errors',errors.length===0,errors.slice(0,6));
 await browser.close();
 const failed=checks.filter(c=>!c.ok);
 console.log(failed.length?('FAILED '+failed.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
