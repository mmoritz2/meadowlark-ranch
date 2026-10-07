// Catalog, transaction and boutique fixtures. No browser, network, or user save access.
const assert=require('node:assert/strict');
const clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
(async()=>{
 const C=await import('../assets/tack-collection.mjs');
 const {tackPieceSVG}=await import('../assets/tack-collection-art.mjs');
 const {install,filterTackPieces}=await import('../assets/features/tack-collection.js');
 const {TACK_PIECES:allPieces,TACK_COLLECTIONS:themes,TACK_SLOTS:slots}=C;
 const pieces=allPieces.filter(p=>!p.premiumProduct&&!p.free);
 check(allPieces.length===127&&themes.length===32,'100 earned pieces plus 24 paid pieces and 3 free originals');
 check(allPieces.filter(p=>p.premiumProduct).every(p=>C.buyTackPiece({coins:100000,tack:[]},p.id).code==='paid-purchase-required'),'paid pieces cannot use coin transactions');
 check(pieces.length===100,'original 100 earned items preserved');
 check(new Set(pieces.map(p=>p.id)).size===100,'all catalog IDs unique');
 check(new Set(pieces.map(p=>JSON.stringify(p.design))).size===100,'all authored designs distinct');
 check(new Set(themes.map(t=>t.ornament)).size===25,'25 original ornament designs');
 for(const t of themes)assert.deepEqual(allPieces.filter(p=>p.theme===t.id).map(p=>p.slot),t.slots||slots,'each collection declares its actual slots');
 for(const p of pieces){check(Object.isFrozen(p)&&Object.isFrozen(p.design),'catalog deeply immutable');check(Number.isInteger(p.priceCoins)&&p.priceCoins>0&&p.currency==='coins','earned coin catalog price');const svg=tackPieceSVG(p);check(svg.startsWith('<svg')&&svg.includes('aria-label="'+p.name+' illustration"'),'named vector item illustration');check(!/\b(?:script|foreignObject|onload)\b/.test(svg),'art is inert SVG');}
 const base=()=>({coins:100000,tack:[{id:'legacy-pad',slot:'pad',name:'Existing pad',bonus:{jump:3}}],horses:[{id:'a',name:'Maple',gear:{pad:'legacy-pad'},bareback:true},{id:'b',name:'Fern',gear:{}},{id:'foal',foal:true,gear:{}}],stats:{earned:500},rider:{name:'Existing rider'}});
 let save=base();const existing=clone(save.tack[0]),rider=clone(save.rider),coins=save.coins;let total=0;
 for(const p of pieces){let r=C.buyTackPiece(save,p.id);check(r.ok&&r.changed&&r.cost===p.priceCoins,'buys exact catalog price');total+=p.priceCoins;check(r.item.catalogId===p.id&&r.item.slot===p.slot,'inventory snapshot maps catalog and slot');const before=JSON.stringify(save);r=C.buyTackPiece(save,p.id,{inventoryId:'ignored'});check(r.ok&&!r.changed&&before===JSON.stringify(save),'repeat purchase makes no second charge');r=C.equipTackPiece(save,p.id,'a');check(r.ok&&save.horses[0].gear[p.slot]===C.ownedTackPiece(save,p.id).id,'each of 100 pieces equips');check(!save.horses[0].bareback,'saddle equip disables bareback');}
 assert.deepEqual(save.tack[0],existing);assert.deepEqual(save.rider,rider);check(save.coins===coins-total&&save.stats.tackBought===100&&save.stats.earned===500,'correct total charges and preserved stats');
 const p=pieces[0],item=C.ownedTackPiece(save,p.id);C.equipTackPiece(save,p.id,'a');C.equipTackPiece(save,p.id,'b');check(save.horses[1].gear[p.slot]===item.id&&save.horses[0].gear[p.slot]!==item.id,'equip transfers single inventory piece');let before=JSON.stringify(save);check(!C.equipTackPiece(save,p.id,'b').changed&&before===JSON.stringify(save),'repeat equip is inert');check(!C.equipTackPiece(save,p.id,'foal').ok&&before===JSON.stringify(save),'foal cannot equip');check(C.unequipTackPiece(save,p.id,'b').changed&&C.ownedTackPiece(save,p.id),'unequip keeps ownership');before=JSON.stringify(save);check(!C.unequipTackPiece(save,p.id,'b').changed&&before===JSON.stringify(save),'repeat unequip inert');
 save=clone(save);check(pieces.every(p=>C.ownedTackPiece(save,p.id)),'all ownership survives JSON reload');
 let poor=base();poor.coins=p.priceCoins-1;before=JSON.stringify(poor);check(C.buyTackPiece(poor,p.id).code==='insufficient-coins'&&before===JSON.stringify(poor),'insufficient funds no mutation');check(!C.buyTackPiece(poor,'forged').ok&&before===JSON.stringify(poor),'unknown catalog ID no mutation');check(!C.equipTackPiece(poor,p.id,'a').ok,'unowned item cannot equip');
 poor.coins=10000;poor.tack.push({id:'forged',catalogId:p.id,slot:'pad'});check(!C.ownedTackPiece(poor,p.id),'wrong-slot forged entry does not prove ownership');C.buyTackPiece(poor,p.id);check(poor.coins===10000-p.priceCoins&&poor.tack.length===3,'valid purchase preserves malformed unrelated inventory');
 let coll=base();coll.tack.push({id:'boutique_'+p.id,slot:'bridle'});check(C.buyTackPiece(coll,p.id).item.id==='boutique_'+p.id+'_2','inventory ID collision handled');coll=base();before=JSON.stringify(coll);check(!C.buyTackPiece(coll,p.id,{inventoryId:'legacy-pad'}).ok&&before===JSON.stringify(coll),'explicit collision cannot charge');check(!C.buyTackPiece({...base(),tack:{}},p.id).ok,'invalid inventory is not overwritten');
 assert.deepEqual(filterTackPieces(save,{theme:'moonpetal'}).map(x=>x.slot),slots);check(filterTackPieces(save,{slot:'shoes'}).length===31,'Legwear category');check(filterTackPieces(save,{query:'CRESCENT'}).length>0,'case insensitive detail search');check(filterTackPieces(base(),{owned:true}).length===0,'legacy inventory not mislabeled as catalog ownership');
 // Original Western pieces are optional, free and cosmetic. No auto-grants or coin/stat changes.
 const originals=allPieces.filter(p=>p.free),western=themes.find(t=>t.id==='classicwestern');
 assert.deepEqual(originals.map(p=>p.slot),['saddle','pad','bridle']);assert.deepEqual(allPieces.slice(-3).map(p=>p.id),originals.map(p=>p.id));
 check(western.slots.length===3&&!C.getTackPiece('tc_classicwestern_shoes'),'no invented original legwear');
 for(const original of originals){
  check(original.priceCoins===0&&original.currency==='coins'&&!original.premiumProduct&&original.design.nativeOriginal,'free original renderer contract');
  check(Object.isFrozen(original)&&Object.isFrozen(original.design)&&Object.keys(original.bonus).length===0,'originals add no free stat bonus');
  check(tackPieceSVG(original).includes(original.name+' illustration'),'originals retain safe art fallback');
 }
 let freeSave=base();delete freeSave.coins;const freeStats=clone(freeSave.stats),oldInventory=clone(freeSave.tack);
 let freeResult=C.buyTackPiece(freeSave,originals[0].id);check(freeResult.ok&&freeResult.code==='claimed'&&freeResult.cost===0&&!('coins'in freeSave),'free claim works without a coin balance');assert.deepEqual(freeSave.stats,freeStats);
 before=JSON.stringify(freeSave);check(!C.buyTackPiece(freeSave,originals[0].id).changed&&JSON.stringify(freeSave)===before,'repeated free claim cannot duplicate or change stats');
 freeSave.coins=0;freeSave.horses[0].gear.shoes='existing-wraps';
 freeResult=C.equipTackCollection(freeSave,'classicwestern','a');
 check(freeResult.ok&&originals.every(p=>freeSave.horses[0].gear[p.slot]===C.ownedTackPiece(freeSave,p.id).id),'explicit free set action claims all three and equips');
 check(freeSave.horses[0].gear.shoes==='existing-wraps'&&freeSave.coins===0,'set keeps existing legwear and coins');assert.deepEqual(freeSave.stats,freeStats);assert.deepEqual(freeSave.tack.slice(0,1),oldInventory);
 before=JSON.stringify(freeSave);check(!C.equipTackCollection(freeSave,'classicwestern','a').changed&&JSON.stringify(freeSave)===before,'repeat set equip is inert');
 freeResult=C.equipTackCollection(freeSave,'classicwestern','b');
 check(freeResult.ok&&originals.every(p=>!freeSave.horses[0].gear[p.slot]&&freeSave.horses[1].gear[p.slot]===C.ownedTackPiece(freeSave,p.id).id),'free set transfers the same inventory pieces to another horse');
 freeSave.horses[1].gear.pad='different-owned-pad';C.unequipTackCollection(freeSave,'classicwestern','b');
 check(freeSave.horses[1].gear.pad==='different-owned-pad'&&!freeSave.horses[1].gear.saddle&&!freeSave.horses[1].gear.bridle,'remove set leaves unrelated mixed tack in place');
 check(originals.every(p=>C.ownedTackPiece(clone(freeSave),p.id)),'free ownership survives save/reload and removal');
 before=JSON.stringify(freeSave);check(!C.unequipTackCollection(freeSave,'classicwestern','b').changed&&JSON.stringify(freeSave)===before,'repeat removal is inert');
 for(const [id,horse] of [['classicwestern','missing'],['classicwestern','foal'],['rainbow','a'],['moonpetal','a'],['unknown','a']]){const fresh=base(),snapshot=JSON.stringify(fresh);const result=C.equipTackCollection(fresh,id,horse);check(!result.ok&&JSON.stringify(fresh)===snapshot,'invalid or unowned set cannot partially grant/equip');}
 const malformed={...base(),tack:{}};before=JSON.stringify(malformed);check(!C.equipTackCollection(malformed,'classicwestern','a').ok&&JSON.stringify(malformed)===before,'invalid inventory is never overwritten by set claim');
 // Exercise actual install, render and click handlers using an isolated save adapter.
 const links=[],events={},listeners={};let tab,opened=null,refreshes=0,persist=true;save=base();save.rider={made:true};save.horses[0].name='<script>horse</script>';
 global.document={getElementById:()=>null,createElement:()=>({}),head:{appendChild:l=>links.push(l)},activeElement:null};global.location={search:'?shop=tackcollection'};
 const G={save:{fresh:()=>clone(save),sync:fn=>{const draft=clone(save);fn(draft);if(persist)save=draft;}},ui:{shopTab:t=>tab=t,openShop:id=>opened=id},on:(name,fn)=>events[name]=fn,ranchSys:{tackIdx:()=>0},horse:{refreshTack:()=>refreshes++,attachTack(){},dressSaddle(){}},money:{refreshWallet(){}},tackCollectionModels:{refresh(){}},toast(){},sChime(){}};
 const preInstall=JSON.stringify(save);install(G);events.boot();check(JSON.stringify(save)===preInstall,'opening boutique does not grant or equip free originals');check(opened==='tackcollection'&&tab.id==='tackcollection','boot link opens boutique');check(links.length===1&&new URL(links[0].href).pathname.endsWith('/assets/tack-collection.css'),'stylesheet registered');let html=tab.render(save);check((html.match(/data-tc-card=/g)||[]).length===12,'only one manageable page is rendered');check(html.includes('&lt;script&gt;horse&lt;/script&gt;')&&!html.includes('<script>horse'),'horse names escaped');check(html.includes('tack-studio.html?item=tc_moonpetal_saddle')&&html.includes('rel="noopener"'),'real studio links use catalog item ID');
 const root={innerHTML:html,addEventListener:(type,fn)=>listeners[type]=fn,contains:()=>true,querySelector:()=>null};tab.bind({querySelector:()=>root});
 const click=dataset=>{const button={dataset};listeners.click({target:{closest:()=>button}});};
 const initial=save.coins;click({tcBuy:p.id});check(save.coins===initial-p.priceCoins&&root.innerHTML.includes('data-tc-equip="'+p.id+'"'),'Buy becomes Equip');click({tcBuy:p.id});check(save.coins===initial-p.priceCoins,'repeated stale click does not charge');click({tcEquip:p.id});check(save.horses[0].gear.saddle===C.ownedTackPiece(save,p.id).id,'UI equips selected horse');listeners.change({target:{dataset:{tcFilter:'horseId'},value:'b'}});click({tcEquip:p.id});check(!save.horses[0].gear.saddle&&save.horses[1].gear.saddle,'horse selector determines target');click({tcUnequip:p.id});check(!save.horses[1].gear.saddle,'UI unequip works');
 click({tcDetail:p.id});check(root.innerHTML.includes('data-tc-heading')&&root.innerHTML.includes('See all four'),'item detail has actual art and collection navigation');click({tcTheme:'moonpetal'});check((root.innerHTML.match(/data-tc-card=/g)||[]).length===4,'collection link filters four coordinated pieces');listeners.input({target:{dataset:{tcFilter:'query'},value:'no matches'}});check(root.innerHTML.includes('No matching pieces'),'empty filter explained');click({tcClear:''});check((root.innerHTML.match(/data-tc-card=/g)||[]).length===12,'clear restores first page');
 click({tcTheme:'classicwestern'});check((root.innerHTML.match(/data-tc-card=/g)||[]).length===3&&root.innerHTML.includes('Add to locker · Free')&&!root.innerHTML.includes('Buy · 0'),'free three-piece UI uses claim, not zero-price purchase');
 click({tcDetail:originals[0].id});check(root.innerHTML.includes('See all three')&&root.innerHTML.includes('Original cosmetic tack')&&!root.innerHTML.includes('+1 stamina'),'free item detail states actual count and no bonus');
 click({tcBack:''});const beforeFreeCoins=save.coins,beforeFreeStats=clone(save.stats);click({tcBuy:originals[0].id});check(C.ownedTackPiece(save,originals[0].id)&&save.coins===beforeFreeCoins,'individual free item explicitly claims');
 click({tcEquipSet:'classicwestern'});check(originals.every(p=>save.horses[1].gear[p.slot]===C.ownedTackPiece(save,p.id).id)&&root.innerHTML.includes('Remove set'),'UI equips all three on selected horse');assert.deepEqual(save.stats,beforeFreeStats);
 click({tcRemoveSet:'classicwestern'});check(originals.every(p=>!save.horses[1].gear[p.slot]&&C.ownedTackPiece(save,p.id)),'UI Remove set returns originals to locker');
 persist=false;const failedSet=G.tackCollection.equipSet('classicwestern','b');check(!failedSet.ok&&failedSet.code==='save-unavailable','unsaved set change is not reported as success');
 persist=false;const result=G.tackCollection.buy(pieces[4].id);check(!result.ok&&result.code==='save-unavailable','save failure is not reported as ownership');persist=true;save.horses=[];check(G.tackCollection.buy(pieces[4].id).ok,'pieces can be collected without an adult horse');check(refreshes>0,'mutations refresh actual tack runtime');
 console.log('Tack collection QA passed: '+checks+' checks, 100 purchases/equips, isolated UI flows.');
})().catch(error=>{console.error(error);process.exitCode=1;});
