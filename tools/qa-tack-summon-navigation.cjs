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
 const routes=[],G={tackCollection:{catalog:Array(127)},tackSummon:{},commerce:{isStaticStore:true},ui:{openShop:id=>routes.push(id)}};
 const navigation=vm.runInNewContext(between(market,' const GROUPS=['," const TOP=")+'({GROUPS,LBL,INTRO});',{G});
 check(navigation.GROUPS.find(g=>g[0]==='tack')[2].join(',')==='tackcollection,tacksummon,tack','Tack department contains boutique, summoning and locker together');
 check(navigation.GROUPS.filter(g=>g[2].includes('tacksummon')).length===1,'summoning has exactly one market department');
 check(navigation.LBL.tacksummon==='Tack Summoning Stall'&&navigation.INTRO.tacksummon.includes('200 earned coins'),'market heading explains destination and earned-coin cost');
 const destinations=vm.runInNewContext(between(frame,'  const MAIN=[','  const HANDLED=')+'MAIN;',{G,clickId:()=>()=>{},location:{assign(){}}});
 const summon=destinations.find(d=>d.k==='tacksummon');
 check(summon.need()&&summon.groups.includes('horses')&&summon.groups.includes('more'),'menu entry available alongside horse and tack destinations');
 check(destinations.findIndex(d=>d.k==='tack')<destinations.indexOf(summon)&&destinations.indexOf(summon)<destinations.findIndex(d=>d.k==='fitting'),'summoning sits between boutique and fitting room');
 check(destinations.filter(d=>d.groups.includes('home')).length===6,'home menu remains six primary choices');
 summon.go();check(routes.pop()==='tacksummon','actual menu action opens tack summoning');
 delete G.tackSummon;check(!summon.need(),'menu hides unavailable feature');G.tackSummon={};
 let summonTab;
 vm.runInNewContext(between(horseMarket," U.shopTab({id:'summon'",' /* ---- 6.'),{G,U:{shopTab:tab=>summonTab=tab},bannerCards:()=>'<div data-original-horse-banner></div>'});
 const tabHtml=summonTab.render({gems:17});
 check(tabHtml.includes('data-fx="shop:tacksummon"')&&tabHtml.includes('Summon tack')&&tabHtml.includes('200 earned coins'),'horse summon tab offers clearly priced tack navigation');
 check(tabHtml.includes('data-original-horse-banner')&&tabHtml.includes('17💎'),'horse banner content and gem wallet remain present');
 const actions={};
 const dispatch=vm.runInNewContext(between(game,'function uiDispatch(','function addTab(')+"uiAction('shop',a=>openShop(a[0]||undefined));({bindFx});",{UI_ACTIONS:actions,uiAction:(id,fn)=>actions[id]=fn,openShop:id=>routes.push(id),console});
 const link={dataset:{fx:'shop:tacksummon'}};dispatch.bindFx({querySelectorAll:selector=>selector==='[data-fx]'?[link]:[]});link.onclick();
 check(routes.pop()==='tacksummon','actual data-fx binding dispatches tack route');
 delete G.tackSummon;check(!summonTab.render({gems:0}).includes('shop:tacksummon'),'horse summon tab omits unavailable route');G.tackSummon={};
 const physical={style:{display:'none'},innerHTML:'',querySelectorAll:()=>[]},close={},tack={};
 const physicalRoutes=[];
 const physicalG={tackSummon:{},ui:{openShop:id=>physicalRoutes.push({id,previousDisplay:physical.style.display})}};
 const physicalContext=vm.createContext({G:physicalG,$:id=>id==='summonPanel'?physical:id==='summonClose'?close:id==='summonTack'&&physical.innerHTML.includes('id="summonTack"')?tack:null,
  hidePanels(){physical.style.display='none';},freshSave:()=>({gems:0,horses:[]}),SUMMON_TIERS:[],SUMMON_ORDER:[],SUMMON_COL:{},stableCap:()=>5,sect:()=>'',startSummon(){throw Error('Navigation must not summon a horse');}});
 vm.runInContext(between(game,'function openSummon(){','/* The ceremony.'),physicalContext);physicalContext.openSummon();
 check(physical.style.display==='flex'&&physical.innerHTML.includes('id="summonTack"'),'physical stall exposes native button');
 tack.onclick();check(physicalRoutes.length===1&&physicalRoutes[0].id==='tacksummon'&&physicalRoutes[0].previousDisplay==='none','physical link closes its original panel before opening tack summon');
 delete physicalG.tackSummon;physicalContext.openSummon();check(!physical.innerHTML.includes('id="summonTack"'),'physical stall remains safe without tack summon feature');
 // Import the actual boutique to exercise its delegated click handler and no-mutation contract.
 global.document={getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},activeElement:null};global.location={search:'',hostname:'player.github.io'};
 const {install}=await import('../assets/features/tack-collection.js');
 const save={coins:600,rider:{made:true},horses:[{id:'clover',breed:'bay-sporthorse',name:'Clover',gear:{}}],tack:[]};
 let boutique,saves=0;const listeners={};
 const boutiqueG={tackSummon:{},save:{fresh:()=>structuredClone(save),sync(){saves++;throw Error('Navigation must not mutate a save');}},ui:{shopTab:t=>boutique=t,openShop:id=>routes.push(id)},on(){},horse:{rideIdx:()=>0}};
 install(boutiqueG);const boutiqueHTML=boutique.render(save);
 check(boutiqueHTML.includes('data-tc-summon')&&boutiqueHTML.includes('200 earned coins'),'boutique exposes the same earned-coin route');
 const boutiqueRoot={innerHTML:boutiqueHTML,addEventListener:(kind,fn)=>listeners[kind]=fn,contains:()=>true};boutique.bind({querySelector:()=>boutiqueRoot});
 listeners.click({target:{closest:()=>({dataset:{tcSummon:''}})}});
 check(routes.pop()==='tacksummon'&&saves===0&&save.coins===600&&save.tack.length===0,'boutique link opens summon without charging, drawing or changing inventory');
 delete boutiqueG.tackSummon;check(!boutique.render(save).includes('data-tc-summon'),'boutique omits unavailable route');
 console.log(`PASS tack summoning navigation: ${checks} focused route and no-mutation checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
