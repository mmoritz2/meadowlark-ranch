// Actual acquisition/save/dye function slices, isolated from browser, account and real saves.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const roster=read('assets/features/horse-roster.js'),style=read('assets/features/mastery-style.js'),core=read('ranch3d.html');
const copy=v=>JSON.parse(JSON.stringify(v));let checks=0;
function check(ok,label){assert(ok,label);checks++;}
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a,`source boundaries: ${start}`);return source.slice(a,b);}
(async()=>{
 const THREE=await import('../assets/vendor/three/build/three.module.js');
 const palettes=vm.runInNewContext(section(core,'const DYE_HAIR=','const DYE_MARK=')+section(style,' const DYE_NATURAL=',' const RIBBON_COLS=')+';({DYE_HAIR,DYE_NATURAL,DYE_BOLD})');
 const row=['fjord','Norwegian Fjord','Uncommon',145,0,'#c2a06a','#3a3428',{mark:'dun',markCol:'#3a3024'}];
 const hooks={},ensures=[],horseEnsures=[],G={mastery:palettes,on:(name,fn)=>hooks[name]=fn,save:{ensure:fn=>ensures.push(fn),ensureHorse:fn=>horseEnsures.push(fn)}};
 const ctx=vm.createContext({THREE,G,BREEDS3:[row],T:{...palettes,DYE_MARK:[['#f2ece0','White']]},TRAITS:{},byKey:()=>row,flagsOf:()=>row[7],starsN:()=>2,rollTraits:()=>[],noteCoat:()=>{},Number});
 vm.runInContext(section(roster,'const COATS3=','/* Every fantasy horse')+section(roster,' function coatsFor(',' function variantOf(')+section(roster,' function lcg(',' function coatKey(')+section(roster,' function ensureRosterHorse(',' /* Foals:'),ctx);
 const acquire=(id=12,opts={})=>{const h={id,breed:'fjord',src:'shop',colors:{body:row[5],mane:row[6]},traits:[],mark2:null};hooks.grantHorse({},h,opts);return h;};
 const fresh=acquire(),generated=ctx.rollAppearance('fjord',fresh.id,{});
 check(fresh.maneAppearance.source==='natural'&&fresh.maneAppearance.color===fresh.colors.mane,'ordinary acquisition records its exact natural generated mane');
 check(JSON.stringify(fresh.colors)===JSON.stringify(generated.colors)&&fresh.variant===generated.variant,'acquisition colors and RNG sequence stay unchanged');
 const natural=copy(fresh),before=JSON.stringify(natural);ensures.forEach(fn=>fn({horses:[natural]}));
 check(JSON.stringify(natural)===before,'new provenance survives save ensures without rewriting');
 const legacy=copy(fresh);delete legacy.maneAppearance;const legacyBefore=copy(legacy);ensures.forEach(fn=>fn({horses:[legacy]}));
 check(legacy.maneAppearance.source==='natural'&&legacy.maneAppearance.color===legacy.colors.mane,'already migrated legacy horse with traits/mark2 recovers exact natural provenance');
 delete legacyBefore.maneAppearance;const recoveredCopy=copy(legacy);delete recoveredCopy.maneAppearance;
 check(JSON.stringify(recoveredCopy)===JSON.stringify(legacyBefore),'legacy migration changes no saved colors, gear, names, or other fields');
 const loaded=copy(legacy);horseEnsures.forEach(fn=>fn(loaded));check(JSON.stringify(loaded)===JSON.stringify(legacy),'JSON reload and repeated per-horse ensures are stable');
 const initialActor=copy(fresh);delete initialActor.maneAppearance;G.horse={myHorses:[initialActor]};vm.runInContext(section(roster,"  for(const h of G.horse.myHorses||[])recoverNaturalMane(h);",'  let got=[];'),ctx);check(initialActor.maneAppearance?.source==='natural','boot repairs the initial in-memory actor snapshot as well as the stored save');
 for(let id=1;id<=50;id++){const h=acquire(id);delete h.maneAppearance;ctx.recoverNaturalMane(h);check(h.maneAppearance?.source==='natural','seeded acquisition '+id+' recovers exactly');}
 const editedBody=copy(fresh);delete editedBody.maneAppearance;editedBody.colors.body='#123456';ctx.recoverNaturalMane(editedBody);check(editedBody.maneAppearance?.source==='natural'&&editedBody.colors.body==='#123456','unrelated body dye does not hide a proven natural mane');
 for(const patch of [{id:'12'},{id:0},{id:12.5},{breed:'bay'},{variant:'wrong'},{coat:'ice'},{src:'wild'},{lineage:{sire:1}},{maneAppearance:{source:'dyed',color:fresh.colors.mane}},{maneAppearance:{source:'natural',color:'#ffffff'}}]){
  const h={...copy(fresh),...patch};if(!('maneAppearance' in patch))delete h.maneAppearance;const b=JSON.stringify(h);ctx.recoverNaturalMane(h);check(JSON.stringify(h)===b,'ambiguous/custom save is untouched: '+JSON.stringify(patch));
 }
 const changed=copy(fresh);delete changed.maneAppearance;changed.colors.mane='#3a3429';ctx.recoverNaturalMane(changed);check(!changed.maneAppearance,'nearby color is never approximated as generated');
 const unavailable=copy(fresh);delete unavailable.maneAppearance;G.mastery=null;ctx.recoverNaturalMane(unavailable);check(!unavailable.maneAppearance,'legacy inference waits until every dye palette is registered');G.mastery=palettes;
 // Force an exact seed collision to prove known swatches win even over a generated match.
 const roll=ctx.rollAppearance;for(const [color] of [...palettes.DYE_HAIR,...palettes.DYE_NATURAL,...palettes.DYE_BOLD]){const h={id:12,breed:'fjord',variant:'reddun',colors:{mane:color}};ctx.rollAppearance=()=>({variant:h.variant,colors:{mane:color}});ctx.recoverNaturalMane(h);check(!h.maneAppearance,'explicit dye swatch remains ambiguous on seed collision: '+color);}ctx.rollAppearance=roll;
 const wild=acquire(3,{colors:{body:'#abc123',mane:'#f7f3e8'}});check(!wild.maneAppearance,'explicit acquisition colors are never marked natural');
 const selected=copy(fresh);selected.maneAppearance={source:'dyed',color:'#5a3a24'};vm.runInContext('globalThis.selectedVariant=COATS3.fjord[1]',ctx);ctx.applyVariant(selected,ctx.selectedVariant);
 check(selected.maneAppearance.source==='natural'&&selected.colors.mane==='#5a3a24','explicit named-coat selection resolves the Red Dun/Liver ambiguity as natural');

 let save={coins:1000,horses:[copy(fresh)]},lookCalls=0;const active=copy(fresh);
 const styleG={horse:{myHorses:[active],applyCoat:()=>lookCalls++,hairColour(){}},sChime(){}};
 const dyeCtx=vm.createContext({G:styleG,...palettes,fresh:()=>copy(save),sync:fn=>fn(save),rideIdx:()=>0,masteryOf:()=>10,breedRow:()=>row,breedLabel:()=>row[1],NEED:{dye1:()=>2,dye2:()=>6},applyPlayerLook(){},toast(){}});
 vm.runInContext(section(style,' function mirror(',' function setHair(')+section(style,' function setDye(',' function setRibbon('),dyeCtx);
 check(dyeCtx.setDye('mane','#5a3a24')&&save.horses[0].maneAppearance.source==='dyed','mastery natural-color swatch remains an explicit dye');
 check(active.maneAppearance.color==='#5a3a24'&&active.maneAppearance.source==='dyed'&&lookCalls>0,'mastery dye mirrors provenance into the active actor immediately');
 check(dyeCtx.setDye('mane','#9a6cff')&&save.horses[0].maneAppearance.color==='#9a6cff','mastery bold dye records exact pigment');
 check(dyeCtx.setDye('mane','none')&&save.horses[0].colors.mane===row[6]&&active.maneAppearance.source==='natural'&&active.maneAppearance.color===row[6],'Natural reset restores the existing base color and records natural intent live');
 const beforeTail=JSON.stringify(save.horses[0].maneAppearance);dyeCtx.setDye('tail','#ffffff');check(JSON.stringify(save.horses[0].maneAppearance)===beforeTail&&save.horses[0].tailCol==='#ffffff','tail dye never changes mane provenance');
 const beforeInvalid=JSON.stringify(save);check(!dyeCtx.setDye('mane','#badbad')&&JSON.stringify(save)===beforeInvalid,'invalid mastery swatch cannot change provenance or save');
 dyeCtx.masteryOf=()=>0;check(!dyeCtx.setDye('mane','#9a6cff')&&JSON.stringify(save)===beforeInvalid,'locked mastery dye is nonmutating');
 const coreCtx=vm.createContext({rideIdx:0,DYE_COST:120,syncSave:fn=>fn(save),refreshWallet(){},reloadHorses(){},applyCoat(){},hairColour(){},sChime(){},openShop(){},toast(){}});
 vm.runInContext(section(core,'function dyeHorse(','function openShop('),coreCtx);coreCtx.dyeHorse('mane','#5a3a24');
 check(save.coins===880&&save.horses[0].colors.mane==='#5a3a24'&&save.horses[0].maneAppearance.source==='dyed'&&save.horses[0].maneAppearance.color==='#5a3a24','coin dye charges once and records exact explicit dye');
 const paidProvenance=JSON.stringify(save.horses[0].maneAppearance);coreCtx.dyeHorse('body','#c2a06a');coreCtx.dyeHorse('tail','#d8dde3');check(JSON.stringify(save.horses[0].maneAppearance)===paidProvenance,'other coin dye writers preserve mane intent');
 save.coins=0;const poor=JSON.stringify(save);coreCtx.dyeHorse('mane','#332214');check(JSON.stringify(save)===poor,'unaffordable coin dye changes neither pigment nor provenance');
 save=copy(save);ensures.forEach(fn=>fn(save));check(save.horses[0].maneAppearance.source==='dyed','explicit dye remains explicit after JSON reload and recovery');
 // Owned parked actors use the same complete horse snapshot; previews remain caller-driven.
 const dressed=[],owned={...copy(fresh),gear:{pad:'kept-pad'}},dressCtx=vm.createContext({THREE:{},myHorses:[owned],worldRigCount:0,applyNativeRemoteMode(){},rigCalibrate(){},initGameHero(){},configureArtistCustomization:(rig,h)=>dressed.push(h),syncCollectionTack(){}});
 vm.runInContext('function dressNative(inst,parts,ent,opts,breed,colors){'+section(core,' if(inst.profile.nativeBreed){',' if(inst.profile.withersM)')+'}',dressCtx);
 const dress=(opts,breed='fjord')=>dressCtx.dressNative({profile:{nativeBreed:true,nativeKind:'horse'},bones:[]},{group:{scale:{setScalar(){}}}},{},opts,breed,{body:'#112233',mane:'#334455'});
 dress({mine:true,seed:owned.id});check(dressed.at(-1)===owned&&dressed.at(-1).maneAppearance.source==='natural','parked/barn actor receives whole owned horse and provenance');
 dress({mine:false,seed:owned.id,maneAppearance:{source:'dyed',color:'#334455'}});check(dressed.at(-1)!==owned&&dressed.at(-1).maneAppearance.source==='dyed','unowned preview preserves caller appearance despite matching a local numeric ID');
 dress({mine:true,seed:owned.id},'bay');check(dressed.at(-1)!==owned&&dressed.at(-1).breed==='bay','owned lookup cannot borrow a different breed color');
 const remoteCalls=[],remote={breed:'fjord',rig:{profile:{nativeRoster:true}},parts:{group:{}}},remoteCtx=vm.createContext({remotes:{peer:remote},remoteBreedPending:new Map(),G:{run(){}},configureArtistCustomization:(rig,h)=>remoteCalls.push(h),syncCollectionTack(){}});
 vm.runInContext(section(core,'function remoteUpdate(','function netTick('),remoteCtx);
 const packet={id:'peer',b:'fjord',x:1,z:2,c:copy(fresh.colors),ma:copy(fresh.maneAppearance)};
 remoteCtx.remoteUpdate(packet);check(remoteCalls.at(-1).maneAppearance.source==='natural','remote update copies optional natural provenance to the native renderer');
 const callCount=remoteCalls.length;remoteCtx.remoteUpdate({...packet,ma:{source:'dyed',color:packet.c.mane}});check(remoteCalls.length===callCount+1&&remoteCalls.at(-1).maneAppearance.source==='dyed','same-color intent change invalidates the remote appearance key');
 const oldPacket={...packet};delete oldPacket.ma;remoteCtx.remoteUpdate(oldPacket);check(remoteCalls.at(-1).maneAppearance===undefined,'old clients without the optional field retain the legacy fallback');
 const sendCtx=vm.createContext({h:fresh,s:{rider:{}},net:{id:'sender'},player:{pos:{x:1,z:2},heading:0,speed:0},myName:()=> 'Rider',RIDER_DEF_SHIRT:'#fff',RIDER_DEF_PANTS:'#000',collectionPieces:()=>({})});
 const sent=vm.runInContext('(function(){'+section(core,'   const payload={','   G.run(\'netPos\'')+'return payload;})()',sendCtx);
 check(sent.ma===fresh.maneAppearance&&JSON.parse(JSON.stringify(sent)).ma.source==='natural','existing position protocol sends optional provenance and survives JSON');
 console.log('PASS mane provenance: '+checks+' checks (actual acquisition, migration, both dye writers and Natural reset; no browser/network).');
})().catch(e=>{console.error(e);process.exitCode=1;});
