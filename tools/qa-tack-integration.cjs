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
 const foundation=style=>({uuid:'base-'+uuid++,visible:true,style,position:{copy(){}},userData:{style,henry:style==='native'}});
 const player={mesh:mount()},RIG={scene:{},skin:{},ready:true,profile:{henryHorse:true},attachedTo:player.mesh};
 const TACK={saddle:foundation('native'),bridle:null};
 const G={mastery:{isWild:()=>wild}};
 const ctx=vm.createContext({console,THREE:{},G,RIG,TACK,player,SADDLE_GLB:{},tackInv:save.tack,myHorses:copy(save.horses),rideIdx:0,herd:[],barnHorses:[],
  freshSave:()=>copy(save),getTackPiece:catalog.getTackPiece,
  saddleStyleOf:h=>save.tack.find(t=>t.id===h?.gear?.saddle)?.style||h?.saddleStyle||'english',
  breedSeat:()=>({}),buildSaddle:(style,rig)=>{calls.push(['saddle',style]);return foundation(style);},buildBridle:()=>foundation('bridle'),
  setHenryTack:(rig,state)=>{rig.nativeTack=state;},
  createTackCollection:opts=>{
   const model={opts,group:{},applies:0,updates:[],disposed:false,
    apply(next){this.applies++;this.opts={...this.opts,equippedDesigns:next};},
    update(dt,state){this.updates.push({dt,...state});},
    dispose(){this.disposed=true;}};
   calls.push(['create',model]);return model;
  }
 });
 vm.runInContext(helpers+'\n'+mirror,ctx,{filename:'ranch3d-tack-integration.js'});
 G.tackCollectionModels={refresh:ctx.refreshCollectionTack};
 const h=ctx.myHorses[0],other=ctx.myHorses[1];
 const resolve=()=>ctx.collectionPieces(h);
 check(Object.keys(resolve()).length===0,'owning pieces does not equip them');
 h.gear={saddle:pieces.saddle.id};check(!resolve().saddle,'catalog ID cannot substitute for inventory ID');
 h.gear={saddle:save.tack.find(t=>t.catalogId===pieces.pad.id).id};check(!resolve().saddle,'wrong inventory slot rejected');
 h.gear={saddle:'missing'};check(!resolve().saddle,'missing inventory entry rejected');
 ctx.tackInv.push({slot:'saddle',catalogId:pieces.saddle.id});h.gear={};check(!resolve().saddle,'malformed ID-less entry cannot equip itself');ctx.tackInv.pop();
 for(const p of Object.values(pieces))check(catalog.equipTackPiece(save,p.id,1).ok,'catalog equips owned slot');
 ctx.refreshTack();
 check(h.bareback===false,'saddle equip leaves bareback immediately in live mirror');
 check(Object.keys(resolve()).length===4,'all four equipped inventory slots resolve to visible pieces');
 const first=RIG.collectionTack;
 check(first&&Object.keys(first.opts.equippedDesigns).length===4,'live refresh creates one fitted collection');
 ctx.syncCollectionTack(RIG,player.mesh,h);ctx.refreshTack();
 check(RIG.collectionTack===first&&first.applies===0,'unchanged equipment does not rebuild geometry');
 h.bareback=true;wild=true;ctx.updateCollectionTack(RIG,.016);
 check(first.updates.at(-1).bareback&&first.updates.at(-1).wild,'bareback and Wild Mode reach renderer');
 h.bareback=false;wild=false;
 catalog.equipTackPiece(save,alternate.id,1);ctx.refreshTack();
 check(RIG.collectionTack===first&&first.applies===1,'changing one slot reapplies without replacing controller');
 check(first.opts.equippedDesigns.saddle.id===alternate.id,'new design is the equipped one');
 const oldBase=TACK.saddle;TACK.saddle=foundation('native');ctx.syncCollectionTack(RIG,player.mesh,h);
 check(first.disposed&&RIG.collectionTack!==first,'foundation replacement releases old overrides');
 check(RIG.collectionTack.opts.tack.saddle!==oldBase,'new controller receives replacement seat foundation');
 const second=RIG.collectionTack;
 for(const p of [...Object.values(pieces),alternate])catalog.unequipTackPiece(save,p.id,1);
 ctx.refreshTack();check(second.disposed&&RIG.collectionTack===null,'last item unequipped disposes fitted collection');

 catalog.equipTackPiece(save,pieces.saddle.id,2);ctx.refreshTack();
 check(RIG.collectionTack===null,'another horse equipment does not leak to ridden horse');
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
 const henryRig={scene:{},skin:{},profile:{henryHorse:true}};
 ctx.syncCollectionTack(henryRig,mount(),other);check(henryRig.nativeTack.saddle,'owned Henry native saddle is shown for equipped saddle');
 ctx.syncCollectionTack(henryRig,mount(),{gear:{}});check(!henryRig.nativeTack.saddle&&!henryRig.nativeTack.bridle,'unequipped owned Henry returns to untacked state');

 const before=JSON.stringify(save),remote={scene:{},skin:{},profile:{henryHorse:true},collectionDefaultTack:true};
 ctx.syncCollectionTack(remote,mount(),{bareback:false},{saddle:'not-a-piece',pad:pieces.saddle.id,bridle:pieces.bridle.id});
 check(Object.keys(remote.collectionPieces).join(',')==='bridle','remote packets accept only known IDs in their matching slot');
 check(remote.nativeTack.saddle&&remote.nativeTack.bridle,'remote normal riding foundations stay visible');
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

 const hero=fs.readFileSync(path.join(ROOT,'assets/game-hero-horse.js'),'utf8');
 const dispose=hero.slice(hero.indexOf('export function disposeMountedRig('),hero.indexOf('export function heroGroomFacade(')).replace('export ','');
 vm.runInContext(dispose,ctx);
 const order=[];ctx.disposeMountedRig({collectionTack:{dispose:()=>order.push('collection')},heroMotion:{dispose:()=>order.push('motion')},materials:[{dispose:()=>order.push('material')}]});
 check(order.join(',')==='collection,motion,material','collection restores private materials before native rig disposal');
 console.log(`PASS tack integration: ${assertions} ownership, persistence, switching, lifecycle, herd and remote checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
