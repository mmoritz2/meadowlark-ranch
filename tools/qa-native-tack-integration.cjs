// Actual core integration helpers + real catalog, isolated from browser/save/network.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(ROOT,'ranch3d.html'),'utf8');
const helpers=core.slice(core.indexOf('function collectionPieces('),core.indexOf('// --- tunables (adjust to fit) ---'));
assert(helpers.startsWith('function collectionPieces('),'core tack integration helpers found');
const mirror=core.split('\n').find(line=>line.startsWith('function refreshTack('));
const copy=value=>JSON.parse(JSON.stringify(value));
let assertions=0;
function check(value,message){assert(value,message);assertions++;}

(async()=>{
 const catalog=await import('../assets/tack-collection.mjs');
 const pieces=Object.fromEntries(catalog.TACK_SLOTS.map(slot=>[slot,catalog.TACK_PIECES.find(p=>p.slot===slot)]));
 const alternate=catalog.TACK_PIECES.find(p=>p.slot==='saddle'&&p.id!==pieces.saddle.id);
 const save={coins:100000,tack:[],horses:[{id:1,gear:{},bareback:true},{id:2,gear:{},bareback:false}]};
 for(const p of [...Object.values(pieces),alternate])check(catalog.buyTackPiece(save,p.id).ok,'catalog item purchased in isolated save');
 const calls=[];let uuid=0,wild=false;
 const mount=()=>({uuid:'mount-'+uuid++,children:[],add(item){this.children.push(item);item.parent=this;}});
 const foundation=style=>({uuid:'base-'+uuid++,visible:true,style,position:{copy(){}},userData:{style,nativeAnchorCarrier:style==='native'}});
 const player={mesh:mount(),rider:{g:{visible:true}},onFoot:false},RIG={scene:{},skin:{},ready:true,profile:{nativeBreed:true,nativeKind:'horse'},attachedTo:player.mesh};
 const TACK={saddle:foundation('native'),bridle:null};TACK.saddle.parent=player.mesh;RIG._nativeTackScene=RIG.scene;RIG._nativeTackRider=player.rider;
 const nativeRiderBridge={readyForReins:true,prepareReins(){calls.push(['prepareReins']);return this.readyForReins;},setTackVisible(value){this.visible=value;},showReins(value){this.reinsVisible=value;},setReinColor(value){this.reinColor=value;}};
 const G={mastery:{isWild:()=>wild}};
 const ctx=vm.createContext({console,THREE:{},G,RIG,TACK,player,nativeRiderBridge,SADDLE_GLB:{},tackInv:save.tack,myHorses:copy(save.horses),rideIdx:0,herd:[],barnHorses:[],
  freshSave:()=>copy(save),getTackPiece:catalog.getTackPiece,
  saddleStyleOf:h=>save.tack.find(t=>t.id===h?.gear?.saddle)?.style||h?.saddleStyle||'english',
  breedSeat:()=>({}),buildSaddle:(style,rig)=>{calls.push(['saddle',style]);return foundation(style);},buildBridle:()=>foundation('bridle'),
  createTackCollection:opts=>{
   const model={opts,group:{},applies:0,updates:[],disposed:false,
    apply(next){this.applies++;this.opts={...this.opts,equippedDesigns:next};},
    update(dt,state){this.updates.push({dt,...state});if(opts.rig.profile?.nativeKind==='horse')opts.rig.scene.traverse?.(mesh=>{if(mesh.isSkinnedMesh&&[13895,5092].includes(mesh.geometry?.attributes.position.count))mesh.visible=!state.wild&&Object.entries(this.opts.equippedDesigns).some(([slot,p])=>p.design.nativeOriginal&&(slot==='bridle'||!state.bareback));});},
    dispose(){this.disposed=true;}};
   calls.push(['create',model]);return model;
  }
 });
 vm.runInContext(helpers+'\n'+mirror,ctx,{filename:'ranch3d-tack-integration.js'});
 G.tackCollectionModels={refresh:ctx.refreshCollectionTack};
 const h=ctx.myHorses[0],other=ctx.myHorses[1];
 const resolve=()=>ctx.collectionPieces(h);
 check(Object.keys(resolve()).length===0,'owning pieces does not equip them');
 ctx.syncCollectionTack(RIG,player.mesh,h);
 check(!!RIG.collectionTack&&Object.keys(RIG.collectionTack.opts.equippedDesigns).length===0,'empty native outfit gets an empty visibility controller');
 check(!TACK.saddle.visible&&!nativeRiderBridge.reinsVisible,'empty equipment has no stirrup IK or display reins');
 check(RIG.collectionTack.updates.at(-1).reinsMode==='none','empty outfit hides both resting and hand-held reins');
 const empty=RIG.collectionTack;ctx.syncCollectionTack(RIG,player.mesh,h);
 check(RIG.collectionTack===empty&&empty.applies===0,'empty outfit does not rebuild each sync');
 ctx.disposeCollectionTack(RIG);
 const classic=Object.fromEntries(['saddle','pad','bridle'].map(slot=>[slot,catalog.getTackPiece('tc_classicwestern_'+slot)]));
 check(Object.values(classic).every(p=>p?.design.nativeOriginal&&p.priceCoins===0),'Classic Western exposes exactly the three optional free source pieces');
 const freeSave={coins:0,tack:[],horses:[{id:7,gear:{}}]};
 for(const p of Object.values(classic))check(catalog.buyTackPiece(freeSave,p.id).ok,'Classic Western can be explicitly claimed without coins');
 check(freeSave.coins===0&&freeSave.tack.length===3&&!Object.keys(freeSave.horses[0].gear).length,'claiming the free set does not auto-equip it');
 for(const p of Object.values(classic))check(catalog.equipTackPiece(freeSave,p.id,7).ok,'Classic Western pieces equip through ordinary ownership checks');
 const legacy={id:'earned-saddle',slot:'saddle',name:'Earned trail saddle',rarity:'Rare'};
 ctx.tackInv.push(legacy);const snapshot=JSON.stringify(legacy);
 h.gear={saddle:legacy.id};check(resolve().saddle?.id===classic.saddle.id,'equipped legitimate legacy saddle resolves to its optional Western visual');
 check(JSON.stringify(legacy)===snapshot&&!legacy.catalogId,'legacy visual mapping never mutates or grants inventory');
 legacy.catalogId='unknown-catalog';check(!resolve().saddle,'unsupported catalog IDs cannot fall back to original equipment');
 delete legacy.catalogId;legacy.paidProduct='tack_rainbow';check(!resolve().saddle,'paid metadata cannot fall back to a free legacy visual');
 ctx.tackInv.pop();h.gear={};
 h.gear={saddle:pieces.saddle.id};check(!resolve().saddle,'catalog ID cannot substitute for inventory ID');
 h.gear={saddle:save.tack.find(t=>t.catalogId===pieces.pad.id).id};check(!resolve().saddle,'wrong inventory slot rejected');
 h.gear={saddle:'missing'};check(!resolve().saddle,'missing inventory entry rejected');
 ctx.tackInv.push({slot:'saddle',catalogId:pieces.saddle.id});h.gear={};check(!resolve().saddle,'malformed ID-less entry cannot equip itself');ctx.tackInv.pop();
 for(const p of Object.values(pieces))check(catalog.equipTackPiece(save,p.id,1).ok,'catalog equips owned slot');
 ctx.refreshTack();
 check(h.bareback===false,'saddle equip leaves bareback immediately in live mirror');
 check(Object.keys(resolve()).length===4,'all four equipped inventory slots resolve to visible pieces');
 const first=RIG.collectionTack;
 check(calls.findIndex(c=>c[0]==='prepareReins')<calls.findIndex(c=>c[0]==='create'),'native reins geometry is prepared before renderer wraps materials');
 check(first&&Object.keys(first.opts.equippedDesigns).length===4,'live refresh creates one fitted collection');
 check(first.updates.at(-1).reinsMode==='ridden'&&nativeRiderBridge.reinsVisible,'equipped mounted bridle uses only hand-held reins');
 player.rider.g.visible=false;ctx.updateCollectionTack(RIG,.016);check(first.updates.at(-1).reinsMode==='resting'&&!nativeRiderBridge.reinsVisible,'hidden rider cannot leave hand-held reins floating in the air');
 player.rider.g.visible=true;ctx.updateCollectionTack(RIG,.016);
 ctx.syncCollectionTack(RIG,player.mesh,h);ctx.refreshTack();
 check(RIG.collectionTack===first&&first.applies===0,'unchanged equipment does not rebuild geometry');
 h.bareback=true;wild=true;ctx.updateCollectionTack(RIG,.016);
 check(first.updates.at(-1).bareback&&first.updates.at(-1).wild,'bareback and Wild Mode reach renderer');
 check(!nativeRiderBridge.visible&&!nativeRiderBridge.reinsVisible&&!TACK.saddle.visible,'Wild Mode hides native source tack, display reins and stirrup IK');
 check(first.updates.at(-1).reinsMode==='none','Wild Mode hides the resting pair too');
 wild=false;ctx.updateCollectionTack(RIG,.016);check(!TACK.saddle.visible&&nativeRiderBridge.reinsVisible,'bareback can retain an equipped bridle but no stirrup IK');
 player.onFoot=true;ctx.updateCollectionTack(RIG,.016);check(!nativeRiderBridge.reinsVisible,'dismount hides rider display reins');
 check(first.updates.at(-1).reinsMode==='resting','dismount hands bridle over to exactly one resting pair');
 player.onFoot=false;ctx.updateCollectionTack(RIG,.016);check(first.updates.at(-1).reinsMode==='ridden'&&nativeRiderBridge.reinsVisible,'remount returns to hand-held reins without resting duplicate');
 h.bareback=false;wild=false;
 catalog.equipTackPiece(save,alternate.id,1);ctx.refreshTack();
 check(RIG.collectionTack===first&&first.applies===1,'changing one slot reapplies without replacing controller');
 check(first.opts.equippedDesigns.saddle.id===alternate.id,'new design is the equipped one');
 const oldBase=TACK.saddle;TACK.saddle=foundation('native');TACK.saddle.parent=player.mesh;ctx.syncCollectionTack(RIG,player.mesh,h);
 check(first.disposed&&RIG.collectionTack!==first,'foundation replacement releases old overrides');
 check(RIG.collectionTack.opts.tack.saddle!==oldBase,'new controller receives replacement seat foundation');
 const second=RIG.collectionTack;
 for(const p of [...Object.values(pieces),alternate])catalog.unequipTackPiece(save,p.id,1);
 ctx.refreshTack();check(!second.disposed&&RIG.collectionTack===second&&Object.keys(second.opts.equippedDesigns).length===0,'last item unequipped keeps empty native controller and hides original defaults');
 check(!TACK.saddle.visible&&!nativeRiderBridge.reinsVisible,'last item removed clears stirrup IK and reins immediately');
 h.gear={bridle:ctx.tackInv.find(it=>it.catalogId===pieces.bridle.id).id};ctx.syncCollectionTack(RIG,player.mesh,h);
 check(!TACK.saddle.visible&&nativeRiderBridge.reinsVisible&&RIG.collectionTack.updates.at(-1).reinsMode==='ridden','bridle alone supports hand-held reins without any saddle');
 h.gear={};ctx.syncCollectionTack(RIG,player.mesh,h);check(!nativeRiderBridge.reinsVisible&&RIG.collectionTack.updates.at(-1).reinsMode==='none','removing the bridle hides both rein systems immediately');

 catalog.equipTackPiece(save,pieces.saddle.id,2);ctx.refreshTack();
 check(Object.keys(RIG.collectionTack.opts.equippedDesigns).length===0,'another horse equipment does not leak to ridden horse');
 ctx.rideIdx=1;ctx.refreshCollectionTack();check(RIG.collectionTack?.opts.equippedDesigns.saddle.id===pieces.saddle.id,'switching to equipped horse restores appearance');
 const serialized=JSON.stringify(save);ctx.tackInv=[];h.gear={};other.gear={};Object.assign(save,JSON.parse(serialized));ctx.refreshTack();
 check(RIG.collectionTack?.opts.equippedDesigns.saddle.id===pieces.saddle.id,'serialized inventory/gear restores appearance');
 save.horses.reverse();ctx.refreshTack();
 check(!h.gear.saddle&&!!other.gear.saddle,'save mirror uses horse IDs after save order changes');

 const herdMount=mount(),herdRig={scene:{},skin:{},profile:{artistBreed:true}};
 ctx.syncCollectionTack(herdRig,herdMount,other);
 check(herdRig.saddle?.style==='western','owned artist horse gets proper Western foundation');
 check(herdRig.collectionTack?.opts.tack.saddle===herdRig.saddle,'herd collection uses its own foundation');
 const herdController=herdRig.collectionTack;ctx.syncCollectionTack(herdRig,herdMount,{gear:{}});
 check(herdController.disposed&&!herdRig.saddle.visible,'unequipped grazing horse loses added collection/foundation');
 const nativeMesh={isSkinnedMesh:true,geometry:{attributes:{position:{count:13895}}}},nativeRig={scene:{traverse:fn=>fn(nativeMesh)},skin:{},profile:{nativeBreed:true,nativeKind:'horse'},collectionDefaultTack:true};
 const nativeMount=mount();ctx.syncCollectionTack(nativeRig,nativeMount,{gear:{}});check(!nativeMesh.visible&&!!nativeRig.collectionTack,'parked native horse is bare despite old default-tack flag');
 ctx.syncCollectionTack(nativeRig,nativeMount,other);check(!nativeMesh.visible,'new collection does not reveal original native saddle');
 check(nativeRig.collectionTack.updates.at(-1).reinsMode==='none','saddle alone does not add reins');
 ctx.syncCollectionTack(nativeRig,nativeMount,{}, {bridle:pieces.bridle.id});check(nativeRig.collectionTack.updates.at(-1).reinsMode==='resting','parked native bridle uses resting reins');
 ctx.tackInv.push({id:'original-pad',catalogId:classic.pad.id,slot:'pad'});
 ctx.syncCollectionTack(nativeRig,nativeMount,{gear:{pad:'original-pad'}});check(nativeMesh.visible&&nativeRig.collectionPieces.pad&&!nativeRig.collectionPieces.saddle,'pad-only outfit reveals only its equipped native pad');
 ctx.syncCollectionTack(nativeRig,nativeMount,{gear:{pad:'original-pad'},bareback:true});check(!nativeMesh.visible,'explicit bareback hides the pad');
 ctx.syncCollectionTack(nativeRig,nativeMount,{gear:{}});check(!nativeMesh.visible&&Object.keys(nativeRig.collectionPieces).length===0,'last native original removed returns parked horse to bare');
 ctx.tackInv.pop();

 const before=JSON.stringify(save),remote={scene:{traverse(){}},skin:{},profile:{nativeBreed:true,nativeKind:'horse'},collectionDefaultTack:true};
 ctx.syncCollectionTack(remote,mount(),{bareback:false},{saddle:'not-a-piece',pad:pieces.saddle.id,bridle:pieces.bridle.id});
 check(Object.keys(remote.collectionPieces).join(',')==='bridle','remote packets accept only known IDs in their matching slot');
 check(remote.collectionTack.updates.at(-1).reinsMode==='resting','remote native bridle has a resting pair when no rider bridge exists');
 check(!remote.collectionPieces.saddle&&!remote.collectionPieces.pad,'remote default-tack flag cannot add unequipped source parts');
 ctx.syncCollectionTack(remote,mount(),{bareback:false},{});check(!!remote.collectionTack&&!Object.keys(remote.collectionPieces).length,'empty remote appearance stays bare with a live controller');
 check(JSON.stringify(save)===before,'remote appearance never changes ownership or save');
 remote.collectionWild=true;ctx.updateCollectionTack(remote,.02);check(remote.collectionTack.updates.at(-1).wild,'remote Wild Mode reaches renderer');

 // The first Western piece must not build once on English and again on Western.
 ctx.syncCollectionTack(RIG,player.mesh,{gear:{}});RIG.profile={artistBreed:true};RIG.key='artist-bay';
 TACK.saddle=foundation('english');Object.assign(TACK.saddle.userData,{hero:true,modelKey:RIG.key});
 let refits=0;ctx.attachTack=()=>{refits++;TACK.saddle=foundation('western');Object.assign(TACK.saddle.userData,{hero:true,modelKey:RIG.key});ctx.syncCollectionTack(RIG,player.mesh,other);};
 const buildsBefore=calls.filter(c=>c[0]==='create').length;
 ctx.refreshCollectionTack();ctx.refreshCollectionTack();
 check(refits===1,'English foundation refits exactly once before collection geometry');
 check(calls.filter(c=>c[0]==='create').length===buildsBefore+1,'Western equip avoids a discarded initial renderer build');
 check(RIG.collectionTack.opts.tack.saddle===TACK.saddle,'first collection build uses the final foundation');

 // Native dragons/foals never receive equine overlay geometry.
 const countBefore=calls.filter(c=>c[0]==='create').length;
 ctx.syncCollectionTack({scene:{},skin:{},profile:{nativeBreed:true,nativeKind:'european-dragon'}},mount(),other);
 check(calls.filter(c=>c[0]==='create').length===countBefore,'dragon rendering skips equine tack');
 check(Object.keys(ctx.collectionPieces({...other,foal:true})).length===0,'foal equipment is not rendered');
 // If the rider arrives asynchronously, the first collection waits for its
 // display-rein clone; it cannot wrap a geometry that the bridge will replace.
 ctx.disposeCollectionTack(RIG);RIG.profile={nativeBreed:true,nativeKind:'horse'};RIG.scene={};
 TACK.saddle=foundation('native');TACK.saddle.parent=player.mesh;RIG._nativeTackScene=RIG.scene;RIG._nativeTackRider=player.rider;
 nativeRiderBridge.readyForReins=false;ctx.syncCollectionTack(RIG,player.mesh,other);
 check(RIG._collectionPending&&!RIG.collectionTack,'collection waits for delayed native rider');
 check(!nativeRiderBridge.visible,'unpartitioned originals stay hidden while rider loads');
 nativeRiderBridge.readyForReins=true;ctx.updateCollectionTack(RIG,.01);
 check(!RIG._collectionPending&&!!RIG.collectionTack,'collection resumes once native reins can be prepared');
 const paid=catalog.TACK_PIECES.find(p=>p.premiumProduct&&p.slot==='saddle');
 ctx.tackInv.push({id:'paid-forged',slot:'saddle',catalogId:paid.id});
 check(!ctx.collectionPieces({gear:{saddle:'paid-forged'}}).saddle,'unverified premium inventory cannot render as owned');
 G.paidTack={authorized:it=>it.id==='paid-forged'};
 check(ctx.collectionPieces({gear:{saddle:'paid-forged'}}).saddle.id===paid.id,'verified account premium piece may render');

 // Render the actual legacy locker row: cosmetics offer equipment controls,
 // without upgrade or salvage buttons that could never succeed.
 Object.assign(ctx,{gearBonus:it=>it.bonus||{},formatTackStat:String,STAT_OF:{},STAT_KEYS:[],gearSet:()=>null,TACK_MAX_LVL:8,RAR_COL:{Common:'#aaa'},gearUpgradeCost:()=>({c:120,kit:'kit1'}),TOOLKITS:{kit1:{label:'Toolkit',tier:1}},RAR_PARTS:{Common:1},RAR_SELL:{Common:50},gearMergeCost:()=>250});
 const gearRow=core.slice(core.indexOf('function gearRow('),core.indexOf('/* Three pieces on the Cottonwood'));
 vm.runInContext(gearRow,ctx);
 const cosmeticRow=ctx.gearRow(freeSave.tack[0],null,false),cosmeticWornRow=ctx.gearRow(freeSave.tack[0],freeSave.horses[0],true);
 check(cosmeticRow.includes('data-tk="on:')&&!/data-tk="(?:up|sell|strip|merge):/.test(cosmeticRow),'free cosmetic locker row offers Equip without unsupported money or upgrade actions');
 check(cosmeticWornRow.includes('data-tk="off:')&&cosmeticWornRow.includes('Free cosmetic · no stat bonus'),'equipped cosmetic row offers removal with a clear no-stat label');
 const ordinaryRow=ctx.gearRow({id:'earned',slot:'saddle',rarity:'Common',name:'Earned saddle',bonus:{},lvl:1},null,false);
 check(['up','sell','strip','merge'].every(op=>ordinaryRow.includes('data-tk="'+op+':')),'earned ordinary tack retains its existing management controls');

 const hero=fs.readFileSync(path.join(ROOT,'assets/game-hero-horse.js'),'utf8');
 const dispose=hero.slice(hero.indexOf('export function disposeMountedRig('),hero.indexOf('export function heroGroomFacade(')).replace('export ','');
 vm.runInContext(dispose,ctx);
 const order=[];ctx.disposeMountedRig({profile:{nativeBreed:true},collectionTack:{dispose:()=>order.push('collection')},nativeRider:{dispose:()=>order.push('rider')},nativeMotion:{dispose:()=>order.push('motion')},materials:[{dispose:()=>order.push('material')}]});
 check(order.join(',')==='collection,rider,motion,material','collection restores private materials before native rig disposal');
 // Exercise the actual native bridge's preparation API without rendering or a
 // real player save. Its original display geometry must be prepared exactly once.
 const nativeSource=fs.readFileSync(path.join(ROOT,'assets/native-rider.js'),'utf8');
 const bridgeBody=nativeSource.slice(nativeSource.indexOf('function createDraftBarebackBarrel(')).replace('export ','');
 const original={id:'original'},display={id:'display-reins'},partition={id:'collection-groups'};
 const nativeTack={isSkinnedMesh:true,visible:true,geometry:original},nativeOther={isSkinnedMesh:true,visible:false,geometry:{attributes:{position:{count:5092}}}};
 original.attributes={position:{count:13895}};
 const lifecycle=[],rider={sk:null},fakeTHREE={Vector3:class{}};
 const bridgeContext=vm.createContext({THREE:fakeTHREE,CONTACTS:{},console,
  createNativeTackModes:()=>({mode:'saddled',setMode(value){this.mode=value;return true;},inspect(){return {mode:this.mode};},barebackSeatLocal(){return null;},dispose(){nativeTack.visible=true;nativeOther.visible=false;}}),
  createNativeRiderReins:()=>{lifecycle.push('prepare');nativeTack.geometry=display;return {group:{visible:false},inspect(){return {};},setColor(color){lifecycle.push(['color',color]);},update(){lifecycle.push('update');},dispose(){lifecycle.push('dispose');nativeTack.geometry=original;}};}
 });
 vm.runInContext(bridgeBody,bridgeContext);
 const bridge=bridgeContext.createNativeRiderBridge({THREE:fakeTHREE,scene:{},mount:{},rig:{profile:{nativeKind:'horse'},nativeSeatFollower:{},nativeContacts:{tack:nativeTack},scene:{traverse(fn){fn(nativeTack);fn(nativeOther);}}},rider});
 check(!bridge.prepareReins()&&nativeTack.geometry===original,'bridge defers preparation until native rider exists');
 rider.sk={};check(bridge.prepareReins()&&nativeTack.geometry===display,'bridge prepares display clone before collection fitting');
 check(!bridge.inspect().reinsWanted&&!bridge.inspect().enabled,'native bridge begins with no visible rider reins');
 bridge.setTackVisible(true);check(!bridge.inspect().reinsWanted,'source visibility cannot silently enable reins');
 bridge.showReins(true);bridge.setReinColor('#abcdef');bridge.updateReins();
 check(lifecycle.some(x=>Array.isArray(x)&&x[0]==='color'&&x[1]==='#abcdef'),'equipped colored bridle recolors native rider reins');
 check(bridge.inspect().reinsVisible,'bridge inspection confirms the hand-held pair actually became visible');
 const reinUpdates=lifecycle.filter(x=>x==='update').length;bridge.showReins(false);bridge.setTackVisible(true);bridge.updateReins();
 check(lifecycle.filter(x=>x==='update').length===reinUpdates,'visibility refresh cannot restart unequipped or dismounted reins');
 check(!bridge.inspect().reinsVisible,'bridge inspection confirms hand-held pair hidden after dismount or bridle removal');
 bridge.setReinColor(null);check(bridge.inspect().reinColor===null,'Classic Western resets reins to native brown');
 nativeTack.geometry=partition;bridge.prepareReins();bridge.updateReins();
 check(nativeTack.geometry===partition&&lifecycle.filter(x=>x==='prepare').length===1,'later reins updates never replace the collection geometry');
 nativeTack.geometry=display;bridge.dispose();bridge.dispose();
 check(nativeTack.geometry===original&&lifecycle.filter(x=>x==='dispose').length===1,'collection-first teardown restores native geometry exactly once');
 check(nativeTack.visible&&!nativeOther.visible,'native bridge restores each original mesh visibility');

 const instantiate=core.slice(core.indexOf('function instantiateArtistBreed('),core.indexOf('function rigCalibrate('));
 const initialTack={isSkinnedMesh:true,visible:true,geometry:{attributes:{position:{count:13895}}}},initialBody={isSkinnedMesh:true,visible:true,geometry:{attributes:{position:{count:16159}}}};
 ctx.BREED_MODELS={instantiate:()=>({profile:{nativeBreed:true,nativeKind:'horse'},scene:{traverse(fn){fn(initialTack);fn(initialBody);}}})};
 vm.runInContext(instantiate,ctx);ctx.instantiateArtistBreed({});
 check(!initialTack.visible&&initialBody.visible,'fresh native instances cannot flash original tack before setup');

 console.log(`PASS native tack integration: ${assertions} ownership, persistence, switching, lifecycle, herd and remote checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
