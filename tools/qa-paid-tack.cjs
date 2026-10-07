/* Real paid-tack frontend logic; isolated fake clock/save/account, no network. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const clone=x=>JSON.parse(JSON.stringify(x)),root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/features/paid-tack.js'),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
(async()=>{
 const catalog=await import('../assets/tack-collection.mjs'),access=await import('../assets/paid-tack-access.mjs'),{PREMIUM_TACK_SETS}=await import('../assets/premium-tack.mjs');
 const {TACK_PIECES,TACK_SLOTS,getTackPiece,RAINBOW_TACK_PRODUCT,ownedTackPiece,buyTackPiece,equipTackPiece}=catalog;
 const pieces=TACK_PIECES.filter(p=>p.premiumProduct===RAINBOW_TACK_PRODUCT);assert.equal(pieces.length,4);
 const horse=id=>({id,name:id===1?'Clover':'Maple',breed:'bay',gear:{},bareback:true});
 const ordinary=(id='ordinary-saddle',slot='saddle')=>({id,slot,name:'Ordinary '+slot,rarity:'Common',primary:'speed',bonus:{speed:1},lvl:1,merged:0});
 const initial=()=>({horses:[horse(1),horse(2)],coins:20000,tack:[ordinary()],parts:0,items:{kit1:10},stats:{},tw:{}});
 const account=(user='alice',orders=['order-a'])=>({user:{id:user},wallet:{held:false},tack:orders.map(id=>({id,product:RAINBOW_TACK_PRODUCT,tack:{collectionId:'rainbow',pieceIds:pieces.map(p=>p.id)}}))});
 function fixture(input=initial()){
  let disk=clone(input),current=null,now=1700000000000,serial=0;const hooks={},ensures=[],timers=new Map(),focus=[],counts={sync:0,horseRefresh:0,modelRefresh:0};
  const G={on(name,fn){(hooks[name]??=[]).push(fn);},run(name,...args){for(const fn of hooks[name]||[])fn(...args);},commerce:{currentAccount:()=>current},save:{ensure:fn=>ensures.push(fn),fresh(){const s=clone(disk);for(const fn of ensures)fn(s);return s;},sync(fn){counts.sync++;const s=G.save.fresh();fn(s);disk=clone(s);}},horse:{refreshTack(){counts.horseRefresh++;}},tackCollectionModels:{refresh(){counts.modelRefresh++;}}};
  class Clock extends Date{static now(){return now;}}
  const window={addEventListener(name,fn){if(name==='focus')focus.push(fn);}};
  const install=new Function('TACK_PIECES','getTackPiece','setPaidTackVerifier','window','Date','setTimeout','clearTimeout',source+'\nreturn install;')(TACK_PIECES,getTackPiece,access.setPaidTackVerifier,window,Clock,(fn,ms)=>{const id=++serial;timers.set(id,{fn,due:now+ms});return id;},id=>timers.delete(id));install(G);
  return {G,counts,get disk(){return clone(disk);},edit(fn){fn(disk);},receive(a){current=a;G.run('commerceAccount',a);},setCurrent(a){current=a;},advance(ms,fireTimers=true){now+=ms;if(fireTimers)for(const [id,t]of [...timers])if(t.due<=now){timers.delete(id);t.fn();}},tick(ms=1001){now+=ms;G.run('tick',ms/1000);},focus(){for(const fn of focus)fn();},equipAll(horseId=1){G.save.sync(s=>{for(const p of pieces)assert(equipTackPiece(s,p.id,horseId).ok);});}};
 }
 const owned=f=>f.disk.tack.filter(t=>f.G.paidTack.isPaid(t));
 const assertRevoked=(f,label)=>{assert.equal(owned(f).length,0,label+' removes inventory');assert(f.disk.horses.every(h=>Object.values(h.gear).every(id=>!String(id).startsWith('paid_'))),label+' clears gear');for(const p of pieces)assert.equal(ownedTackPiece(f.disk,p.id),null,label+' denies catalog ownership');};
 const f=fixture();assert.equal(owned(f).length,0);f.receive(account());assert.equal(owned(f).length,4);assert.equal(f.disk.tack.length,5);assert.equal(f.disk.coins,20000);
 for(const t of owned(f)){const p=getTackPiece(t.catalogId);assert(f.G.paidTack.authorized(t));assert.equal(t.rarity,'Common');assert.equal(t.lvl,1);assert.equal(t.merged,0);assert.equal(t.secondary,null);assert.deepEqual(t.bonus,p.bonus);assert.equal(Object.values(t.bonus).reduce((a,b)=>a+b,0),1);assert(ownedTackPiece(f.disk,p.id));}
 for(const id of [undefined,null,'',77])assert.equal(f.G.paidTack.authorized({...owned(f)[0],id}),false,'invalid inventory IDs never authorize');
 const ids=owned(f).map(t=>t.id);f.equipAll();assert.deepEqual(Object.keys(f.disk.horses[0].gear).sort(),[...TACK_SLOTS].sort());assert.equal(f.disk.horses[0].bareback,false);for(const p of pieces)assert.equal(f.disk.horses[0].gear[p.slot],ownedTackPiece(f.disk,p.id).id);
 f.edit(s=>{s.tack.push(clone(s.tack.find(t=>t.paidProduct)));});f.G.paidTack.sync();assert.equal(owned(f).length,4);assert.equal(Object.keys(f.disk.horses[0].gear).length,4,'removing same-ID duplicate does not unequip the retained item');
 f.receive(account());f.receive(account('alice',['order-a','order-a','order-b']));assert.equal(owned(f).length,4,'duplicate orders never create duplicate pieces');assert.deepEqual(owned(f).map(t=>t.id),ids);
 f.edit(s=>{const t=s.tack.find(t=>t.paidProduct);t.rarity='Legendary';t.lvl=20;t.bonus={speed:999};s.tack.push({...clone(t),id:'duplicate-paid'});});f.G.paidTack.sync();assert.equal(owned(f).length,4);assert.equal(owned(f)[0].rarity,'Common');assert.equal(owned(f)[0].lvl,1);assert.equal(Object.values(owned(f)[0].bonus)[0],1,'saved upgrades cannot inflate paid stats');
 f.receive(null);assertRevoked(f,'signout');assert.equal(f.disk.paidTackArchive.length,4);f.receive(account());assert.deepEqual(owned(f).map(t=>t.catalogId).sort(),pieces.map(p=>p.id).sort());assert.equal(Object.keys(f.disk.horses[0].gear).length,4,'same account restores all previously worn pieces');
 f.receive(null);f.edit(s=>{s.horses[0].gear.saddle='ordinary-saddle';});f.receive(account());assert.equal(f.disk.horses[0].gear.saddle,'ordinary-saddle','reverification does not displace a newly equipped piece');assert.equal(Object.keys(f.disk.horses[0].gear).length,4);
 console.log('PASS verified grant of four Common +1 pieces, real equips, repeat refresh, duplicate rights/save repair, fixed stats, logout and respectful restoration');

 f.equipAll();f.receive(account('bob',['order-b']));assert.equal(owned(f).length,4);assert(owned(f).every(t=>t.paidAccountId==='bob'));assert.equal(Object.keys(f.disk.horses[0].gear).length,0,'another account cannot inherit old gear');f.receive(account());assert.equal(Object.keys(f.disk.horses[0].gear).length,4);
 f.advance(119999,false);assert(owned(f).every(t=>f.G.paidTack.authorized(t)));f.advance(1,false);assert(owned(f).every(t=>!f.G.paidTack.authorized(t)),'TTL closes exactly at 120 seconds');f.focus();assertRevoked(f,'TTL focus');f.receive(account());f.equipAll();f.advance(120001);assertRevoked(f,'TTL timer');
 f.receive(account());f.equipAll();f.receive(account('alice',[]));assertRevoked(f,'refund');f.receive(account());f.equipAll();f.receive({...account(),wallet:{held:true}});assertRevoked(f,'held wallet');f.receive(account());f.equipAll();f.setCurrent(null);f.tick();assertRevoked(f,'session identity lost');f.receive(account());f.equipAll();f.setCurrent(account('bob'));f.focus();assertRevoked(f,'commerce account changed before event');
 console.log('PASS account isolation, 120-second active TTL, delayed timer/focus/tick expiry, refund, held wallet and current-account identity checks');

 const forged={id:'forged-paid',catalogId:pieces[0].id,slot:pieces[0].slot,paidProduct:RAINBOW_TACK_PRODUCT,paidAccountId:'alice',paidEntitlementId:'order-a',bonus:{speed:900}};
 const saved=initial();saved.tack.push(forged);saved.horses[0].gear.saddle=forged.id;saved.paidTackArchive=[{key:'alice|fake|'+pieces[1].id,accountId:'alice',entitlementId:'fake',catalogId:pieces[1].id,inventoryId:'archive-forged',wearers:[1]}];
 const forgedFixture=fixture(saved);assert.equal(owned(forgedFixture).length,0);assert.equal(forgedFixture.disk.horses[0].gear.saddle,undefined);forgedFixture.receive(account('alice',[]));assert.equal(owned(forgedFixture).length,0,'archive does not grant authority');
 for(const bad of [{product:'other'},{tack:{collectionId:'wrong',pieceIds:pieces.map(p=>p.id)}},{tack:{collectionId:'rainbow',pieceIds:pieces.slice(0,3).map(p=>p.id)}},{tack:{collectionId:'rainbow',pieceIds:[pieces[0].id,pieces[0].id,pieces[1].id,pieces[2].id]}},{id:''}]){const a=account();Object.assign(a.tack[0],bad);forgedFixture.receive(a);assert.equal(owned(forgedFixture).length,0,'malformed entitlements fail closed');}
 forgedFixture.receive(account());assert.equal(owned(forgedFixture).length,4);const restart=fixture(forgedFixture.disk);assertRevoked(restart,'fresh runtime');restart.receive(account());assert.equal(owned(restart).length,4);
 for(const p of pieces){const s=restart.disk,before=clone(s);assert.deepEqual(buyTackPiece(s,p.id),{ok:false,code:'paid-purchase-required'});assert.deepEqual(s,before,'premium coin purchase is a no-op');}
 const regularPiece=TACK_PIECES.find(p=>!p.premiumProduct),shop=initial();assert(buyTackPiece(shop,regularPiece.id).ok);assert.equal(shop.coins,20000-regularPiece.priceCoins,'ordinary coin purchase preserved');
 for(const archive of [{unexpected:'object'},[{accountId:'alice',entitlementId:'order-a',catalogId:pieces[0].id,inventoryId:77,wearers:{bad:true}}],[null,17,'invalid']]){const malformedSave=initial();malformedSave.paidTackArchive=archive;const repaired=fixture(malformedSave);assert.equal(owned(repaired).length,0,'malformed archive grants no rights');repaired.receive(account());assert.equal(owned(repaired).length,4,'verified grant tolerates malformed archived data');assert(owned(repaired).every(t=>typeof t.id==='string'&&t.id));repaired.equipAll();repaired.receive(null);assertRevoked(repaired,'malformed archive revoke');}
 const returningHorse=fixture();returningHorse.receive(account());returningHorse.equipAll();
 returningHorse.edit(s=>{const h=s.horses.find(h=>h.id===1);s.paidHorseArchive=[{accountId:'alice',horse:clone(h)}];s.horses=s.horses.filter(h=>h.id!==1);});
 returningHorse.receive(null);assert.equal(returningHorse.disk.paidTackArchive.filter(a=>a.wearers.includes(1)).length,4,'purchase horse archiving before tack retains all equipment slots');
 returningHorse.edit(s=>{s.horses.push({...clone(s.paidHorseArchive[0].horse),gear:{}});});returningHorse.receive(account());assert.equal(Object.keys(returningHorse.disk.horses.find(h=>h.id===1).gear).length,4,'reverified purchased horse gets its previous tack back');
 const paidPieces=TACK_PIECES.filter(p=>p.premiumProduct),forSet=set=>paidPieces.filter(p=>p.premiumProduct===set.productId);
 const setsAccount=(sets=PREMIUM_TACK_SETS,user='alice')=>({user:{id:user},wallet:{held:false},tack:sets.map(set=>({id:'owned-'+set.id,product:set.productId,tack:{collectionId:set.id,pieceIds:forSet(set).map(p=>p.id)}}))});
 assert.equal(TACK_PIECES.length,127);assert.equal(TACK_PIECES.filter(p=>!p.premiumProduct&&p.priceCoins>0).length,100);assert.equal(TACK_PIECES.filter(p=>!p.premiumProduct&&p.priceCoins===0).length,3);assert.equal(paidPieces.length,24);
 for(const set of PREMIUM_TACK_SETS){
  const only=fixture(),expected=forSet(set);assert.equal(expected.length,4);only.receive(setsAccount([set]));
  assert.deepEqual(owned(only).map(p=>p.catalogId).sort(),expected.map(p=>p.id).sort(),set.id+' grants exactly its own four pieces');
  for(const piece of paidPieces.filter(p=>p.premiumProduct!==set.productId))assert.equal(ownedTackPiece(only.disk,piece.id),null,'foreign product never owns '+piece.id);
  const before=only.counts.sync;for(let i=0;i<8;i++)only.tick();only.focus();only.G.run('interval30');assert.equal(only.counts.sync,before,'missing unowned sets never trigger recurring reconciliation');
  for(const piece of expected){const snapshot=only.disk,beforeBuy=clone(snapshot);assert.equal(buyTackPiece(snapshot,piece.id).code,'paid-purchase-required');assert.deepEqual(snapshot,beforeBuy);assert.equal(owned(only).find(p=>p.catalogId===piece.id).lvl,1);}
  const foreign=PREMIUM_TACK_SETS.find(other=>other!==set);
  for(const bad of [{collectionId:foreign.id,pieceIds:expected.map(p=>p.id)},{collectionId:set.id,pieceIds:forSet(foreign).map(p=>p.id)},{collectionId:set.id,pieceIds:[expected[0].id,...forSet(foreign).slice(1).map(p=>p.id)]}]){
   const a=setsAccount([set]);a.tack[0].tack=bad;only.receive(a);assert.equal(owned(only).length,0,'wrong collection or foreign/mixed piece IDs fail closed');
  }
 }
 const multi=fixture();multi.receive(setsAccount());assert.equal(owned(multi).length,24);const multiIds=new Map(owned(multi).map(p=>[p.catalogId,p.id]));
 multi.G.save.sync(s=>{for(const set of PREMIUM_TACK_SETS.slice(0,2))for(const piece of forSet(set))assert(equipTackPiece(s,piece.id,set.id==='rainbow'?1:2).ok);});
 multi.receive(setsAccount(PREMIUM_TACK_SETS.filter(set=>set.id!=='starlight')));
 assert.equal(owned(multi).length,20);assert.equal(Object.keys(multi.disk.horses[0].gear).length,4,'refund leaves another set equipped');assert.equal(Object.keys(multi.disk.horses[1].gear).length,0,'only revoked set unequips');
 multi.receive(setsAccount());assert.equal(owned(multi).length,24);assert.equal(Object.keys(multi.disk.horses[1].gear).length,4,'restored independent order restores its previous wearers');
 for(const piece of owned(multi))assert.equal(piece.id,multiIds.get(piece.catalogId),'existing entitlement inventory ID stays stable');
 multi.receive(setsAccount([PREMIUM_TACK_SETS[2]],'bob'));assert.equal(owned(multi).length,4);assert(owned(multi).every(p=>p.paidAccountId==='bob'&&p.paidProduct==='tack_dragonfire'));assert(multi.disk.horses.every(h=>Object.keys(h.gear).length===0),'switching accounts cannot inherit equipment');
 multi.receive(setsAccount());assert.equal(owned(multi).length,24);multi.receive(null);assert.equal(owned(multi).length,0);assert.equal(multi.disk.paidTackArchive.filter(a=>a.accountId==='alice').length,24);
 const multiRestart=fixture(multi.disk);assert.equal(owned(multiRestart).length,0);multiRestart.receive(setsAccount());assert.equal(owned(multiRestart).length,24);
 for(const piece of owned(multiRestart))assert.equal(piece.id,multiIds.get(piece.catalogId),'all set archives survive restart without replacing Rainbow IDs');
 console.log('PASS all six products grant only their four pieces, no unowned-set reconciliation loop, mixed snapshot rejection, independent refunds, 24-piece archive/restart and cross-account isolation; ordinary 100 retained');
 // Restore the verifier for the real action fixture below.
 restart.receive(account());access.setPaidTackVerifier(restart.G.paidTack.authorized);
 console.log('PASS forged saves/archives, restart, malformed archive shapes/entries and entitlements, premium coin-purchase denial and ordinary coin purchasing');

 // Execute the real core action function so protections are tested before any
 // entitlement refresh could silently replace a sold/stripped/upgraded item.
 const main=fs.readFileSync(path.join(root,'ranch3d.html'),'utf8'),start=main.indexOf('function tackAct(cmd){'),end=main.indexOf('\n/* The saddle you see',start);assert(start>=0&&end>start);const actionSource=main.slice(start,end);
 let actionSave=restart.disk,message='',attached=0;
 const env={G:restart.G,getTackPiece,syncSave:fn=>fn(actionSave),tackIdx:()=>0,ensureStats:h=>{h.gear=h.gear||{};},BREED_MODELS:{profile:()=>null},TACK_MAX_LVL:20,RARITIES:['Common','Rare','Epic','Legendary'],RAR_PARTS:{Common:3},RAR_SELL:{Common:40},GEAR_NOUN:{saddle:'Saddle'},STAT_OF:{speed:'Speed'},TOOLKITS:{kit1:{label:'Toolkit'}},gearUpgradeCost:()=>({kit:'kit1',c:10}),gearMergeCost:()=>20,gearPrimary:t=>t.primary||'speed',refreshTack:()=>{},refreshWallet:()=>{},freshSave:()=>actionSave,attachTack:()=>{attached++;},dressSaddle:()=>{},questEvt:()=>{},dailyEvt:()=>{},toast:text=>{message=text;},sGem:()=>{},sChime:()=>{},openShop:()=>{}};
 const act=new Function('env','with(env){let rideIdx=0,myHorses=[];'+actionSource+';return tackAct;}')(env),paid=actionSave.tack.find(t=>t.slot==='saddle'&&t.paidProduct);
 for(const op of ['sell','strip','merge','up']){const before=clone(actionSave);act(op+':'+paid.id);assert.deepEqual(actionSave,before,op+' must leave paid inventory/resources untouched');assert.match(message,/purchased|cannot/i);}
 actionSave.horses[0].bareback=true;act('on:'+paid.id);assert.equal(actionSave.horses[0].bareback,false,'real saddle equip exits bareback');assert.equal(actionSave.horses[0].gear.saddle,paid.id);assert(attached>0,'real core equip refreshes fitted tack');act('off:saddle');assert.equal(actionSave.horses[0].gear.saddle,undefined);
 const rightless={...paid,paidEntitlementId:'not-verified',id:'unverified'};actionSave.tack.push(rightless);act('on:'+rightless.id);assert.equal(actionSave.horses[0].gear.saddle,undefined);assert.match(message,/verify/i);actionSave.tack=actionSave.tack.filter(t=>t!==rightless);
 const beforeMerge=clone(actionSave);act('merge:ordinary-saddle');assert.deepEqual(actionSave,beforeMerge,'paid spare cannot become ordinary merge fodder');assert.match(message,/nothing to merge/i);
 actionSave.tack.push(ordinary('regular-fodder'));const paidCount=actionSave.tack.filter(t=>t.paidProduct).length,coins=actionSave.coins;act('merge:ordinary-saddle');assert.equal(actionSave.tack.filter(t=>t.paidProduct).length,paidCount);assert.equal(actionSave.tack.find(t=>t.id==='regular-fodder'),undefined);assert.equal(actionSave.coins,coins-20);assert.equal(actionSave.tack.find(t=>t.id==='ordinary-saddle').merged,1);
 const sellCoins=actionSave.coins;act('sell:ordinary-saddle');assert.equal(actionSave.coins,sellCoins+40,'ordinary sale preserved');
 console.log('PASS real tackAct paid sell/strip/merge/upgrade guards, verified equip, unverified rejection, paid fodder exclusion and ordinary merge/sale');
 const classic=TACK_PIECES.filter(p=>p.design.nativeOriginal);assert.equal(classic.length,3);
 for(const piece of classic){
  const beforeCoins=actionSave.coins,bought=buyTackPiece(actionSave,piece.id);assert(bought.ok);assert.equal(actionSave.coins,beforeCoins,'classic original is free');assert.deepEqual(bought.item.bonus,{},'classic original is cosmetic');
  for(const op of ['sell','strip','merge','up']){const before=clone(actionSave);act(op+':'+bought.item.id);assert.deepEqual(actionSave,before,op+' cannot turn a free original into resources or stats');assert.match(message,/free|classic|cosmetic|cannot/i);}
  act('on:'+bought.item.id);assert.equal(actionSave.horses[0].gear[piece.slot],bought.item.id,'free original still equips');act('off:'+piece.slot);assert.equal(actionSave.horses[0].gear[piece.slot],undefined,'free original still removes');
 }
 actionSave.tack.push(ordinary('classic-fodder-target'));actionSave.parts=0;
 const beforeClassicMerge=clone(actionSave);act('merge:classic-fodder-target');assert.deepEqual(actionSave,beforeClassicMerge,'free originals cannot be consumed as ordinary merge fodder');assert.match(message,/nothing to merge/i);
 const beforeClaims=clone(actionSave);for(const piece of classic)assert.equal(buyTackPiece(actionSave,piece.id).changed,false);assert.deepEqual(actionSave,beforeClaims,'repeat free claims do not duplicate inventory or rewards');
 console.log('PASS Classic Western free claim, no-stat cosmetics, real equip/remove, no sell/strip/upgrade/merge or fodder loop, and duplicate claim protection');

})().catch(error=>{console.error(error);process.exitCode=1;});
