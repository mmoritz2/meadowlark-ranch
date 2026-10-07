// Actual boutique boot listener and creator save/close ordering; no browser or user save.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const clone=value=>JSON.parse(JSON.stringify(value));
let checks=0;
function check(value,message){assert(value,message);checks++;}
(async()=>{
 const {install}=await import('../assets/features/tack-collection.js');
 const wardrobe=fs.readFileSync(path.join(__dirname,'../assets/features/tack-wardrobe.js'),'utf8');
 const finish=wardrobe.slice(wardrobe.indexOf(' function finishCreator('),wardrobe.indexOf(' /* ---- the Character screen'));
 const closeAndSave=wardrobe.slice(wardrobe.indexOf(' function closeChar('),wardrobe.indexOf(" chRoot.addEventListener('click'"));
 function fixture({made=false,search='?shop=tackcollection&collection=moonpetal'}={}){
  let save={rider:{made},playerName:'River',tw:{},horses:[{id:1,name:'Clover',breed:'bay',gear:{}}],coins:500,tack:[]},persist=true,tab;
  const hooks={},calls=[],events=[];
  const dom={getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}},body:{classList:{remove(){}}},activeElement:null};
  global.document=dom;global.location={search,hostname:'player.github.io'};
  const G={save:{fresh:()=>clone(save),sync:fn=>{const next=clone(save);fn(next);if(persist)save=next;}},
   ui:{shopTab:t=>tab=t,openShop:id=>calls.push('shop:'+id)},
   on:(name,fn)=>(hooks[name]||=[]).push(fn),run(name,...args){events.push(name);calls.push('event:'+name);for(const fn of hooks[name]||[])fn(...args);},
   horse:{rideIdx:()=>0,genGear:()=>({id:'starter-saddle',slot:'saddle'}),refreshTack(){},attachTack(){},dressSaddle(){}},
   net:{myName:()=>save.playerName},hidePanels:()=>calls.push('hide-panels'),sChime(){}};
  install(G);
  const CH={open:true,draft:{body:'f',shirt:'#e8b598',pants:'#cfc6ae'},R:null,disp:[],raf:0};
  const context=vm.createContext({G,CH,document:dom,chRoot:{classList:{remove:()=>calls.push('close-character')}},
   $:id=>id==='chName'?{value:'River'}:null,accessoryFit:()=>({}),cancelAnimationFrame(){},applyLocal(){},toast:text=>calls.push('toast:'+text),RIDER_NAMES:['Robin']});
  vm.runInContext(finish+'\n'+closeAndSave,context,{filename:'actual-creator-save.js'});
  return {G,CH,calls,events,saveChar:()=>context.saveChar(),cancel:()=>context.closeChar(),fresh:()=>clone(save),fail:value=>persist=!value,html:()=>tab.render(clone(save))};
 }
 let f=fixture();f.G.run('boot');
 check(!f.calls.some(x=>x.startsWith('shop:')),'first-time boutique route waits through boot');
 f.cancel();check(!f.calls.some(x=>x.startsWith('shop:')),'cancelling first-time creator does not open boutique');
 f.CH.open=true;f.saveChar();
 check(f.fresh().rider.made&&f.fresh().rider.shirt==='#e8b598','actual saveChar persists appearance and creation');
 check(f.events.filter(x=>x==='riderCreated').length===1,'first successful creator emits one completion event');
 check(f.calls.filter(x=>x==='shop:tackcollection').length===1,'deferred boutique opens once after creator save');
 check(f.calls.indexOf('hide-panels')<f.calls.indexOf('event:riderCreated')&&f.calls.indexOf('event:riderCreated')<f.calls.indexOf('shop:tackcollection')&&f.calls.lastIndexOf('close-character')<f.calls.indexOf('shop:tackcollection'),'actual close/save sequence cannot close the newly opened boutique');
 check(f.html().includes('<option value="moonpetal" selected>')&&(f.html().match(/data-tc-card=/g)||[]).length===4,'requested collection filter survives creator flow');
 f.CH.open=true;f.saveChar();f.G.run('boot');f.G.run('riderCreated');
 check(f.calls.filter(x=>x==='shop:tackcollection').length===1,'later wardrobe save or repeated events cannot reopen consumed route');
 check(f.fresh().tack.length===1,'route handling does not duplicate the starter saddle');
 f=fixture({made:true});f.G.run('boot');
 check(f.calls.filter(x=>x==='shop:tackcollection').length===1,'existing rider opens the requested boutique directly at boot');
 f.saveChar();check(f.events.filter(x=>x==='riderCreated').length===0&&f.calls.filter(x=>x==='shop:tackcollection').length===1,'ordinary wardrobe edits emit no creation event or repeated route');
 f=fixture({search:'?collection=moonpetal'});f.G.run('boot');f.saveChar();
 check(!f.calls.some(x=>x.startsWith('shop:')),'creator completion without shop deep link does not navigate');
 f=fixture();f.fail(true);f.G.run('boot');f.saveChar();
 check(!f.fresh().rider.made&&!f.events.includes('riderCreated')&&!f.calls.some(x=>x.startsWith('shop:')),'failed persistent save neither signals creation nor consumes route');
 f.fail(false);f.CH.open=true;f.saveChar();
 check(f.fresh().rider.made&&f.calls.filter(x=>x==='shop:tackcollection').length===1,'retry after failed save resumes pending boutique exactly once');
 console.log(`PASS tack deep link: ${checks} actual creator/boot ordering and persistence checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
