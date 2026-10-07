const assert=require('node:assert/strict');
const clone=x=>JSON.parse(JSON.stringify(x));let checks=0;
const check=(ok,name)=>{assert(ok,name);checks++;};
(async()=>{
 const [{install:installBoutique},C,R,A,F]=await Promise.all([import('../assets/features/tack-collection.js'),import('../assets/tack-collection.mjs'),import('../assets/tack-summon.mjs'),import('../assets/tack-collection-art.mjs'),import('../assets/features/tack-collection.js')]);
 const fs=require('node:fs'),vm=require('node:vm'),{pathToFileURL}=require('node:url'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../assets/features/tack-summon.js'),'utf8').replace(/^import .*;$/gm,'').replace(/export const id=/,'const id=').replace(/export function install/,'function install').replace(/import\.meta\.url/g,JSON.stringify(pathToFileURL(path.join(__dirname,'../assets/features/tack-summon.js')).href));
 const install=G=>vm.runInNewContext(source+'\ninstall(G)',{G,...C,...R,...A,...F,document:global.document,location:global.location,URL,URLSearchParams,Math,setTimeout:global.setTimeout,installTackSummonStall(){}});
 const originalTimer=global.setTimeout,timers=[];global.setTimeout=fn=>{timers.push(fn);return timers.length;};
 try{
  function fixture({made=true,coins=1000,search='?shop=tacksummon'}={}){
   let save={coins,tack:[],rider:{made},horses:[{id:'a',name:'<Clover>',breed:'bay',gear:{}},{id:'b',name:'Fern',breed:'white-western',gear:{}},{id:'f',name:'Foal',foal:true,gear:{}},{id:'d',name:'Dragon',breed:'dragon',gear:{}}]},persist=true;
   const tabs={},hooks={},opens=[],messages=[],listeners={};let root;
   global.document={getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},activeElement:null};global.location={search,hostname:'player.github.io'};
   const G={world:{addBuilding(){},addThing:x=>x,mapMarkers:[],miniMarkers:[]},
    save:{fresh:()=>clone(save),sync:fn=>{const next=clone(save);fn(next);if(persist)save=next;}},
    ui:{shopTab:t=>tabs[t.id]=t,openShop:id=>opens.push(id)},on:(name,fn)=>(hooks[name]||=[]).push(fn),
    horse:{rideIdx:()=>0,breedModels:{profile:key=>({nativeKind:key==='dragon'?'dragon':'horse'})},refreshTack(){},attachTack(){},dressSaddle(){}},
    money:{refreshWallet(){}},tackCollectionModels:{refresh(){}},toast:x=>messages.push(x),sChime(){}};
   installBoutique(G);install(G);
   root={innerHTML:tabs.tacksummon.render(clone(save)),contains:()=>true,isConnected:true,querySelector:()=>null,addEventListener:(event,fn)=>listeners[event]=fn};tabs.tacksummon.bind({querySelector:()=>root});
   return {G,tabs,hooks,root,opens,messages,read:()=>clone(save),mutate:fn=>fn(save),fail:value=>persist=!value,
    click:dataset=>listeners.click({target:{closest:()=>({dataset})}}),change:(dataset,value)=>listeners.change({target:{dataset,value}}),event:name=>(hooks[name]||[]).forEach(fn=>fn())};
  }
  let f=fixture();f.event('boot');check(f.opens[0]==='tacksummon','deep link opens correct tab');check(f.read().tack.length===0&&f.read().coins===1000,'opening stall does not charge/grant');check(f.root.innerHTML.includes('100 possible new pieces')&&f.root.innerHTML.includes('1 in 100')&&f.root.innerHTML.includes('200 coins'),'pre-spend cost and exact odds');check(!f.root.innerHTML.includes('tc_rainbow'),'paid tack not in reward UI');
  f.click({tsPool:''});check((f.root.innerHTML.match(/<article>/g)||[]).length===8&&f.root.innerHTML.includes('3D preview'),'bounded reward previews');f.click({tsPage:'1'});check(f.root.innerHTML.includes('2 / 13'),'preview pagination');
  f.change({tsSlot:''},'bridle');check(f.root.innerHTML.includes('25 possible new pieces')&&f.root.innerHTML.includes('1 in 25'),'category-specific exact odds');
  f.click({tsSummon:''});let s=f.read(),p=C.getTackPiece(s.tackSummon.lastCatalogId);check(s.coins===800&&s.tack.length===1&&p.slot==='bridle','UI summon charges exactly one category reward');check(f.root.innerHTML.includes('YOUR LATEST DISCOVERY')&&f.root.innerHTML.includes('ts-reveal'),'saved reward reveals');check(f.root.innerHTML.includes('&lt;Clover&gt;')&&!f.root.innerHTML.includes('<Clover>'),'names escaped');check(!f.root.innerHTML.includes('>Dragon</option>')&&!f.root.innerHTML.includes('>Foal</option>'),'unsupported horses excluded');
  f.click({tsSummon:''});check(f.read().coins===800&&f.read().tack.length===1,'double click blocked during reveal');timers.splice(0).forEach(fn=>fn());
  f.change({tsHorse:''},'b');f.click({tsEquip:''});check(f.read().horses[1].gear.bridle===s.tack[0].id&&f.root.innerHTML.includes('Equipped on Fern'),'reward equips selected horse');
  f.change({tsHorse:''},'a');f.click({tsEquip:''});check(!f.read().horses[1].gear.bridle&&f.read().horses[0].gear.bridle===s.tack[0].id,'moves same piece to another horse');
  check(f.tabs.tacksummon.render(f.read()).includes('YOUR LATEST DISCOVERY'),'latest reward survives render/reload');f.click({tsLocker:''});check(f.opens.at(-1)==='tackcollection','locker link navigates without charge');
  f.fail(true);let before=JSON.stringify(f.read());f.click({tsSummon:''});check(JSON.stringify(f.read())===before&&f.root.innerHTML.includes('could not be saved'),'storage failure no success reveal/charge');check(!f.root.innerHTML.includes('ts-reveal'),'failed transaction has no new animation');
  f=fixture({made:false});f.event('boot');check(f.opens.length===0,'new rider deep link waits');f.mutate(s=>s.rider.made=true);f.event('riderCreated');f.event('boot');check(f.opens.length===1&&f.opens[0]==='tacksummon','route resumes once after rider creation');
  f=fixture({coins:199});before=JSON.stringify(f.read());check(f.root.innerHTML.includes('1 more coins needed'),'shortfall displayed');f.click({tsSummon:''});check(JSON.stringify(f.read())===before,'stale unaffordable click does not charge');
  f=fixture();f.change({tsSlot:''},'pad');f.mutate(s=>{s.coins=100000;for(const p of C.TACK_PIECES.filter(p=>!p.premiumProduct&&!p.free&&p.slot==='pad'))C.buyTackPiece(s,p.id);});before=JSON.stringify(f.read());f.click({tsSummon:''});check(JSON.stringify(f.read())===before&&f.root.innerHTML.includes('All pieces collected'),'complete category no charge');
  f=fixture();f.mutate(s=>s.horses=[]);f.click({tsSummon:''});check(f.read().tack.length===1&&f.root.innerHTML.includes('No adult horses'),'collection works before horse ownership');timers.splice(0).forEach(fn=>fn());
  console.log(`PASS tack summon UI: ${checks} actual render/save/click/route checks`);
 }finally{global.setTimeout=originalTimer;}
})().catch(e=>{console.error(e);process.exitCode=1;});
