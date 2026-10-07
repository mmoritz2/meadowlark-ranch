// Exact live native roster and boutique preview links. No browser, remote fetch, or user save.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
(async()=>{
 const root=path.resolve(__dirname,'..');
 const asset=name=>pathToFileURL(path.join(root,'assets',name)).href;
 const text=await fs.readFile(path.join(root,'assets/tack-studio.js'),'utf8');
 const helpers=text.slice(0,text.indexOf('const $=id=>')).replace(/^import .*;\n/gm,'');
 const S=await import('data:text/javascript,'+encodeURIComponent(helpers));
 const {createBreedLibrary}=await import(asset('breed-models.js'));
 const {registerNewBreedPreviews}=await import(asset('features/new-breeds.js'));
 const {registerRosterPreviews}=await import(asset('features/horse-roster.js'));
 const {registerClubHorsePreviews}=await import(asset('features/clubs-boards.js'));
 const {registerMarketHorsePreviews}=await import(asset('features/market-summon-keys-pets.js'));
 const originalFetch=global.fetch,fetches=[];
 global.fetch=async input=>{
  const url=new URL(input);check(url.protocol==='file:','catalog fixture must never fetch a remote resource');fetches.push(url.pathname);
  return {ok:true,json:async()=>JSON.parse(await fs.readFile(fileURLToPath(url),'utf8'))};
 };
 let library;
 try{
  library=createBreedLibrary({THREE:{LoadingManager:class{setURLModifier(){}}},GLTFLoader:class{},clone(){throw Error('no GPU in roster fixture');}});
  await library.manifestReady;
 }finally{global.fetch=originalFetch;}
 check(fetches.length===2,'reads shared artist identity and native variant manifests');
 const rows=[registerRosterPreviews,registerNewBreedPreviews,registerClubHorsePreviews,registerMarketHorsePreviews].flatMap(register=>register(library)),options=S.studioHorseOptions(library.manifest),keys=new Set(options.map(x=>x.key));
 check(options.length===73,'all 43 manifest equines and 30 live feature aliases available');
 check(options[0].key==='bay-sporthorse-native','detailed Bay Sporthorse is first/default');
 check(keys.has('white-western')&&keys.has('bay-western'),'both Western originals are explicit options');
 check(options.slice(0,3).every(x=>x.group==='Original horses'),'originals are grouped together');
 check(rows.every(row=>keys.has(row[0])),'all live extra breed IDs retain exact picker entries');
 for(const option of options){
  const profile=library.profile(option.key);
  check(library.resolve(option.key)===option.key,'every option resolves exactly, without fallback');
  check(profile.nativeKind==='horse'&&!profile.nativeDragon&&profile.nativeBreed,'only supported equine native rigs');
  check(profile.artist==='WildMesh 3D'&&profile.license==='CC BY-NC 4.0','source credit preserved for each exact horse');
  await fs.access(fileURLToPath(new URL(profile.file,asset('breed-models.js'))));
 }
 const dragons=Object.entries(library.manifest.breeds).filter(([,p])=>p.nativeKind!=='horse'||p.nativeDragon);
 check(dragons.length>=7&&dragons.every(([key])=>!keys.has(key)),'all dragon identities excluded from equine tack');
 check(S.studioHorseOptions({breeds:{bad:{nativeBreed:true,nativeKind:'horse'},legacy:{file:'x'},dragon:{file:'x',nativeBreed:true,nativeKind:'horse',nativeDragon:true}}}).length===0,'missing files, legacy rigs and dragon flags rejected');
 for(const key of keys)check(S.studioInitialHorse(key,'starlight',options).key===key,'explicit horse wins over collection styling');
 for(const key of ['unknown','weekly_moonstone','black-dragon-native']){const choice=S.studioInitialHorse(key,'starlight',options);check(choice.key===S.DEFAULT_STUDIO_HORSE&&choice.unavailable,'unsupported URL is identified, never silently substituted');}
 check(S.studioInitialHorse(null,'moonpetal',options).key===S.DEFAULT_STUDIO_HORSE,'ordinary studio starts with detailed Bay Sporthorse');
 for(const id of ['rainbow','starlight','dragonfire','blossom','glacier','forestguardian'])check(keys.has(S.studioInitialHorse(null,id,options).key),'premium looks choose a live native counterpart');
 check(options.find(x=>x.key==='opaline').group==='Fantasy horses','registered fantasy alias remains grouped as fantasy');
 const opal=library.profile('opaline'),suffolk=library.profile('suffolk');
 check(opal.nativeRosterAppearance.horn&&opal.nativeRosterAppearance.coat==='opal','unicorn identity and coat retained');
 check(suffolk.nativeRosterAlias&&suffolk.nativeRosterColors.body==='#a8561f'&&suffolk.nativeRosterAppearance.maneCol==='#c47a42','natural alias preserves distinct body and mane defaults');
 const newRows=registerNewBreedPreviews(library);newRows[0][7].body='tampered';check(registerNewBreedPreviews(library)[0][7].body==='palomino','preview row copies cannot alter game catalog');
 check(['tidewalker','alicorn','lumen','emberfriesian','larksong','snowlark'].every(key=>keys.has(key)),'reward, season, club and summon horse identities included');
 check(library.profile('alicorn').nativeRosterAppearance.wings&&library.profile('larksong').nativeRosterAppearance.horn&&library.profile('lumen').nativeRosterAppearance.coat==='moonlit','remaining provider fantasy traits preserved');
 const clubRows=registerClubHorsePreviews(library);
 check(clubRows.map(row=>row[0]).join(',')==='emberfriesian,moonveil,stormglass,rosebloom,larksong','preview shares all four current club rewards and photo prize');
 for(const [id,name,base,body,mane,markCol,size] of [
  ['moonveil','Moonveil Andalusian','grey','#d9dbeb','#4d497a','#dae7ff',1.02],
  ['stormglass','Stormglass Arabian','sunset','#182932','#93b5c6','#69dbc9',1],
  ['rosebloom','Rosebloom Gypsy Vanner','vanner','#ead5d0','#75445f','#abc58e',1.06],
 ]){
  const row=clubRows.find(row=>row[0]===id),profile=library.profile(id),appearance=profile.nativeRosterAppearance;
  check(keys.has(id)&&options.find(option=>option.key===id).group==='Fantasy horses'&&row[1]===name&&row[7].body===base,'new club identity and authored foundation retained: '+id);
  check(profile.nativeRosterColors.body===body&&profile.nativeRosterColors.mane===mane&&appearance.coat===id&&appearance.mark==='none'&&appearance.markCol===markCol,'new club coat, mane and marking colors retained: '+id);
  check(appearance.size===size&&appearance.glow&&appearance.club&&appearance.exclusive==='club'&&appearance.src==='club'&&appearance.family==='fantasy','new club fantasy and reward-only traits retained: '+id);
 }
 check(clubRows[0][7].description.includes('glowing forehead crest')&&clubRows[0][7].family==='fantasy','updated Ember Friesian appearance metadata retained');
 clubRows[1][7].coat='tampered';check(registerClubHorsePreviews(library)[1][7].coat==='moonveil','preview row copies cannot mutate shared club rewards');

 const {nativeHorseSpeedLimits}=await import(asset('native-horse-motion.js'));
 for(const key of ['bay-sporthorse-native','white-western','bay-western','fjord','opaline']){
  const p=library.profile(key),cap={...nativeHorseSpeedLimits(p,p.fitScale),supportedModes:Object.keys(p.nativeGaits),canGallop:!!p.nativeGaits.gallopLeft,canJump:!!p.nativeJump};
  check(S.studioSupportsGait('walk',cap)&&S.studioGaitSpeed('walk',cap)===cap.gaitSpeeds.walk,'walk uses game speed for this horse');
  check(S.studioSupportsGait('gallop',cap)&&S.studioGaitSpeed('gallop',cap)>cap.gaitSpeeds.canterLeft,'Gallop actually selects gallop, not slower canter');
  check(S.studioSupportsGait('jump',cap),'native jump capability available');
 }
 check(!S.studioSupportsGait('gallop',{canGallop:false})&&!S.studioSupportsGait('jump',{canJump:false}),'unsupported movement controls stay disabled');
 check(!text.includes('weekly-horses.mjs')&&text.includes('finishNativeHorseGrooms()'),'preview uses native motion and groom completion');
 const html=await fs.readFile(path.join(root,'tack-studio.html'),'utf8');
 check(html.includes('horse-artist')&&html.includes('WildMesh 3D')&&html.includes('CC BY-NC 4.0')&&html.includes('Horse and Classic Western tack by')&&!html.includes('Henry S'),'visible source credit matches live horse');
 // Actual boutique rendering and selected-horse link updates, using only a private in-memory save.
 const C=await import(asset('tack-collection.mjs'));
 const {install,tackPreviewURL,isStaticTackPreview}=await import(asset('features/tack-collection.js'));
 const piece=C.TACK_PIECES[0],url=new URL(tackPreviewURL(piece,{breed:'white-western'},'https://example.test/ranch/tack-studio.html'));
 check(url.pathname==='/ranch/tack-studio.html'&&url.searchParams.get('item')===piece.id&&url.searchParams.get('horse')==='white-western','project subpath and exact horse survive Try on URL');
 let save={coins:1000,tack:[],horses:[{id:'a',name:'Snow',breed:'white-western',gear:{}},{id:'b',name:'Bay',breed:'bay-western',gear:{}},{id:'c',name:'Dragon',breed:'black-dragon-native',gear:{}},{id:'d',name:'Foal',breed:'bay',foal:true,gear:{}}]};
 C.buyTackPiece(save,piece.id);
 const clone=x=>JSON.parse(JSON.stringify(x)),listeners={};let tab;
 global.document={getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},activeElement:null};global.location={search:''};
 const G={save:{fresh:()=>clone(save),sync:fn=>{const next=clone(save);fn(next);save=next;}},ui:{shopTab:t=>tab=t},on(){},horse:{breedModels:library},ranchSys:{tackIdx:()=>0}};
 install(G);
 const dom={innerHTML:tab.render(save),addEventListener:(type,fn)=>listeners[type]=fn,contains:()=>true,querySelector:()=>null};tab.bind({querySelector:()=>dom});
 check(dom.innerHTML.includes('&amp;horse=white-western'),'card Try on selects currently dressed horse');
 check(!dom.innerHTML.includes('<option value="c"')&&!dom.innerHTML.includes('<option value="d"'),'only adult horses appear in boutique target picker');
 listeners.change({target:{dataset:{tcFilter:'horseId'},value:'b'}});
 check(dom.innerHTML.includes('&amp;horse=bay-western')&&!dom.innerHTML.includes('&amp;horse=white-western'),'changing horse updates preview card links');
 listeners.click({target:{closest:()=>({dataset:{tcDetail:piece.id}})}});
 check(dom.innerHTML.includes('tc-detail')&&dom.innerHTML.includes('&amp;horse=bay-western'),'expanded detail previews the selected horse too');
 let before=JSON.stringify(save),result=G.tackCollection.equip(piece.id,'c');
 check(!result.ok&&result.code==='unsupported-horse'&&before===JSON.stringify(save),'boutique API cannot equip equine collection on a dragon');
 result=G.tackCollection.equip(piece.id,'b');check(result.ok&&save.horses[1].gear.saddle,'supported selected horse still equips');
 result=G.tackCollection.unequip(piece.id,'b');check(result.ok&&!save.horses[1].gear.saddle,'unequip remains available');
 // GitHub Pages has no Tack checkout tab: unowned sets must remain working previews.
 check(isStaticTackPreview('player.github.io')&&isStaticTackPreview('github.io')&&!isStaticTackPreview('localhost')&&!isStaticTackPreview('github.io.example.com'),'static-host matching is exact');
 global.location.hostname='player.github.io';
 listeners.click({target:{closest:()=>({dataset:{tcBack:''}})}});
 listeners.change({target:{dataset:{tcFilter:'theme'},value:'rainbow'}});
 check(dom.innerHTML.includes('Preview set in 3D')&&dom.innerHTML.includes('collection=rainbow')&&dom.innerHTML.includes('horse=bay-western'),'static premium cards preview the whole set on selected horse');
 check(!dom.innerHTML.includes('store.html?tab=tack')&&dom.innerHTML.includes('purchases unavailable'),'no broken static premium checkout link');
 global.location.hostname='localhost';
 check(tab.render(save).includes('store.html?tab=tack&product=tack_rainbow'),'local paid checkout route retained');
 const {premiumTackSet}=await import(asset('premium-tack.mjs'));
 const paintSource=text.slice(text.indexOf('function paintInfo(){'),text.indexOf('function paintHorseCredit('));
 for(const staticStore of [true,false]){
  const nodes={},get=id=>nodes[id]||(nodes[id]={options:[{}],style:{setProperty(){}}});
  const look={equipped:Object.fromEntries(C.TACK_PIECES.filter(p=>p.collectionId==='rainbow').map(p=>[p.slot,p]))};
  require('node:vm').runInNewContext(paintSource+';paintInfo();',{state:look,TACK_SLOTS:C.TACK_SLOTS,TACK_COLLECTIONS:C.TACK_COLLECTIONS,premiumTackSet,staticStore,$:get,esc:String,Intl});
  check(staticStore?nodes['shop-link'].href==='ranch3d.html?shop=tackcollection&collection=rainbow':nodes['shop-link'].href==='store.html?tab=tack&product=tack_rainbow','actual studio CTA respects host capability');
  check(staticStore?nodes.details.innerHTML.includes('purchases are not available'):nodes.details.innerHTML.includes('Test checkout'),'studio availability copy matches route');
 }
 // Studio previews originals only on request, and clearing never restores source tack.
 const nativePieces=C.TACK_PIECES.filter(p=>p.collectionId==='classicwestern');
 const nodes={},get=id=>nodes[id]||(nodes[id]={options:[{}],style:{setProperty(){}}});
 const look={equipped:{}};
 const paintContext={state:look,TACK_SLOTS:C.TACK_SLOTS,TACK_COLLECTIONS:C.TACK_COLLECTIONS,premiumTackSet,staticStore:false,$:get,esc:String,Intl};
 require('node:vm').runInNewContext(paintSource+';paintInfo();',paintContext);
 check(nodes['look-name'].textContent==='No tack equipped'&&nodes['piece-count'].textContent==='0 pieces in this look','empty studio clearly displays bare horse');
 for(const piece of nativePieces)look.equipped[piece.slot]=piece;
 require('node:vm').runInNewContext(paintSource+';paintInfo();',paintContext);
 check(nodes['piece-count'].textContent==='3 pieces in this look'&&nodes['total-price'].textContent==='Free','Classic Western summary uses three free pieces');
 check(nodes.details.innerHTML.includes('No legwear included')&&nodes['shop-link'].href==='ranch3d.html?shop=tackcollection&collection=classicwestern','free original preview links to explicit boutique equip');
 const selectSource=text.slice(text.indexOf('function selectCollection('),text.indexOf('function updateDetailBounds('));
 let applied=0;look.equipped.shoes=C.TACK_PIECES.find(p=>p.slot==='shoes');
 require('node:vm').runInNewContext(selectSource+";selectCollection('classicwestern');",{state:look,TACK_COLLECTIONS:C.TACK_COLLECTIONS,TACK_PIECES:C.TACK_PIECES,applyLook:()=>applied++});
 check(applied===1&&Object.keys(look.equipped).length===3&&!look.equipped.shoes,'selecting original collection removes legwear in studio preview');
 const clearStatement=text.match(/\$\('clear'\)\.onclick=(.*);/)[1];
 const clear=require('node:vm').runInNewContext(clearStatement,{state:look,applyLook:()=>applied++});clear();
 check(Object.keys(look.equipped).length===0&&applied===2,'Remove all tack sends an empty renderer selection');
 check(!text.includes('No collection ')&&html.includes('Remove all tack')&&html.includes('127 pieces'),'none labels and catalog count are current');
 check(!text.includes('||TACK_COLLECTIONS[0]'),'studio does not force a default collection');
 console.log(`Native tack studio QA passed: ${checks} checks, ${options.length} exact horse profiles, all project-subpath and selected-horse link flows.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
