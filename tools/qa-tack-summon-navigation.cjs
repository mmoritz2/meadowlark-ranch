/* Actual navigation handlers in isolated Node fixtures; no browser, network or player save. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
let checks=0;
const check=(ok,message)=>{assert(ok,message);checks++;};
function between(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'fixture source boundaries');return source.slice(a,b);}
(async()=>{
 const market=read('assets/features/se-market.js'),frame=read('assets/features/se-frame.js'),horseMarket=read('assets/features/market-summon-keys-pets.js'),game=read('ranch3d.html');
 const routes=[],visit=()=>routes.push('visit-stall'),G={tackCollection:{catalog:Array(127)},tackSummon:{visit},commerce:{isStaticStore:true},ui:{openShop(){throw Error('Stall navigation must not open a market page');}}};
 const navigation=vm.runInNewContext(between(market,' const GROUPS=[',' let marketReturn=null;')+'({GROUPS,LBL,INTRO});',{G});
 check(navigation.GROUPS.find(g=>g[0]==='tack')[2].join(',')==='tackcollection,tacksummon,tack','Tack department contains boutique, summoning and locker together');
 check(navigation.GROUPS.filter(g=>g[2].includes('tacksummon')).length===1,'summoning has exactly one market department');
 check(navigation.LBL.tacksummon==='Tack Summoning Stall'&&navigation.INTRO.tacksummon.includes('200 earned coins'),'market heading explains destination and earned-coin cost');
 const destinations=vm.runInNewContext(between(frame,'  const MAIN=[','  const HANDLED=')+'MAIN;',{G,clickId:()=>()=>{},location:{assign(){}}});
 const summon=destinations.find(d=>d.k==='tacksummon');
 check(summon.need()&&summon.groups.includes('horses')&&summon.groups.includes('more'),'menu entry available alongside horse and tack destinations');
 check(destinations.findIndex(d=>d.k==='tack')<destinations.indexOf(summon)&&destinations.indexOf(summon)<destinations.findIndex(d=>d.k==='fitting'),'summoning sits between boutique and fitting room');
 check(destinations.filter(d=>d.groups.includes('home')).length===6,'home menu remains six primary choices');
 check(summon.t==='Visit Summoning Stall'&&summon.s==='Visit the Summoning Stall · discover fitted tack','menu describes a physical stall visit');
 summon.go();check(routes.pop()==='visit-stall','actual menu action visits the physical stall');
 delete G.tackSummon;check(!summon.need(),'menu hides unavailable feature');G.tackSummon={visit};
 let summonTab;const actions={};
 vm.runInNewContext(between(horseMarket," U.action('tackstall'",' /* ---- 6.'),{G,U:{action:(id,fn)=>actions[id]=fn,shopTab:tab=>summonTab=tab},bannerCards:()=>'<div data-original-horse-banner></div>'});
 const tabHtml=summonTab.render({gems:17});
 check(tabHtml.includes('data-fx="tackstall:visit"')&&tabHtml.includes('Visit Summoning Stall')&&tabHtml.includes('200 earned coins'),'horse summon tab offers a physical visit and separates the summon price');
 check(tabHtml.includes('data-original-horse-banner')&&tabHtml.includes('17💎'),'horse banner content and gem wallet remain present');
 const dispatch=vm.runInNewContext(between(game,'function uiDispatch(','function addTab(')+'({bindFx,uiDispatch});',{UI_ACTIONS:actions,console});
 const link={dataset:{fx:'tackstall:visit'}};dispatch.bindFx({querySelectorAll:selector=>selector==='[data-fx]'?[link]:[]});link.onclick();
 check(routes.pop()==='visit-stall','actual data-fx binding dispatches the custom physical-stall action');
 delete G.tackSummon;check(!summonTab.render({gems:0}).includes('tackstall:visit'),'horse summon tab omits unavailable route');G.tackSummon={visit};
 const physical={style:{display:'none'},innerHTML:'',querySelectorAll:()=>[]},close={},tack={};
 const physicalRoutes=[];
 const physicalG={tackSummon:{openWorld:()=>physicalRoutes.push({id:'world-overlay',previousDisplay:physical.style.display}),visit(){throw Error('Already at the stall; do not travel again');}},ui:{openShop(){throw Error('Physical stall must not open a market page');}}};
 const physicalContext=vm.createContext({G:physicalG,$:id=>id==='summonPanel'?physical:id==='summonClose'?close:id==='summonTack'&&physical.innerHTML.includes('id="summonTack"')?tack:null,
  hidePanels(){physical.style.display='none';},freshSave:()=>({gems:0,horses:[]}),SUMMON_TIERS:[],SUMMON_ORDER:[],SUMMON_COL:{},stableCap:()=>5,sect:()=>'',startSummon(){throw Error('Navigation must not summon a horse');}});
 vm.runInContext(between(game,'function openSummon(){','/* The ceremony.'),physicalContext);physicalContext.openSummon();
 check(physical.style.display==='flex'&&physical.innerHTML.includes('id="summonTack"'),'physical stall exposes native button');
 tack.onclick();check(physicalRoutes.length===1&&physicalRoutes[0].id==='world-overlay'&&physicalRoutes[0].previousDisplay==='none','physical link closes its original panel before opening the world summon overlay without travelling again');
 delete physicalG.tackSummon;physicalContext.openSummon();check(!physical.innerHTML.includes('id="summonTack"'),'physical stall remains safe without tack summon feature');
 // Construct the real stall with inert scene objects, then use the real interaction loop.
 class SceneNode{constructor(){this.position={set(x,y,z){Object.assign(this,{x,y,z});}};this.rotation={};this.userData={};}add(){}traverse(){}}
 const collision=[],stallGame={tackSummon:{}},summonState={on:false},things=[],player={pos:{x:0,z:0},y:0,speed:0};let stallOpened=0;
 const world=vm.createContext({THREE:{Group:SceneNode,Mesh:SceneNode,PlaneGeometry:class{},MeshBasicMaterial:class{},PointLight:SceneNode},
  ranchArchitecture:{buildOutbuilding:()=>{const shell=new SceneNode();shell.userData.architecture={suggestedLabelY:4};return shell;}},box:()=>new SceneNode(),plankBrownMat:{},
  groundH:()=>0,scene:new SceneNode(),colliders:collision,nameSprite:()=>new SceneNode(),followCamera:{register(){}},SUMMON:summonState,G:stallGame,
  things,player,nearThing:null,fishing:null,openSummon:()=>stallOpened++});
 const stallLocation=game.match(/const SUMMON_STALL=\{[^;]+;/)[0];
 vm.runInContext(stallLocation+'\n'+between(game,'function mkSummonStall(){','function mkTackRoom(){')+'\n'+between(game,'function thingLabel(t){','function collect(t){'),world);
 const stall=world.mkSummonStall();things.push(stall);
 const mountRadius=Number(game.match(/rad=c\.r\+([\d.]+)/)[1]);
 check(stall.reach===4.5&&stall.reach>collision[0].r+mountRadius,'stall reach extends beyond the actual mounted collision boundary');
 for(const distance of [collision[0].r+mountRadius+.05,3.7]){player.pos.x=stall.x;player.pos.z=stall.z-distance;world.tickThings(.016);check(world.nearThing===stall,'mounted rider gets the stall interaction at distance '+distance);}
 check(world.thingLabel(stall)==='✨ Summon horses or tack (E)','installed tack feature is advertised by the world E prompt');
 world.useThing();check(stallOpened===1,'the reachable stall E action still opens the original summoning panel');
 player.pos.z=stall.z-stall.reach-.01;world.tickThings(.016);check(world.nearThing===null,'stall prompt stops outside the intended range');
 delete stallGame.tackSummon;check(world.thingLabel(stall)==='✨ Call a horse (E)','horse-only fallback prompt is preserved');
 summonState.on=true;check(world.thingLabel(stall)==='✨ …something is coming','active horse ceremony prompt is preserved');
 // Import the actual boutique to exercise its delegated click handler and no-mutation contract.
 global.document={getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},activeElement:null};global.location={search:'',hostname:'player.github.io'};
 const {install}=await import('../assets/features/tack-collection.js');
 const save={coins:600,rider:{made:true},horses:[{id:'clover',breed:'bay-sporthorse',name:'Clover',gear:{}}],tack:[]};
 let boutique,saves=0;const listeners={};
 const boutiqueG={tackSummon:{visit},save:{fresh:()=>structuredClone(save),sync(){saves++;throw Error('Navigation must not mutate a save');}},ui:{shopTab:t=>boutique=t,dispatch:dispatch.uiDispatch,openShop(){throw Error('Boutique visit must not open a market page');}},on(){},horse:{rideIdx:()=>0}};
 install(boutiqueG);const boutiqueHTML=boutique.render(save);
 check(boutiqueHTML.includes('data-tc-summon')&&boutiqueHTML.includes('Visit Summoning Stall'),'boutique offers a physical visit');
 const boutiqueRoot={innerHTML:boutiqueHTML,addEventListener:(kind,fn)=>listeners[kind]=fn,contains:()=>true};boutique.bind({querySelector:()=>boutiqueRoot});
 listeners.click({target:{closest:()=>({dataset:{tcSummon:''}})}});
 check(routes.pop()==='visit-stall'&&saves===0&&save.coins===600&&save.tack.length===0,'boutique link visits the physical stall without charging, drawing or changing inventory');
 delete boutiqueG.tackSummon;check(!boutique.render(save).includes('data-tc-summon'),'boutique omits unavailable route');
 console.log(`PASS tack summoning navigation: ${checks} focused route and no-mutation checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
