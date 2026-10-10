const $=id=>document.getElementById(id),frame=$('game'),q=new URLSearchParams(location.search),role=q.get('role'),code=q.get('code');
const PORTS={host:'18796',guest:'18797'},NAMES={host:'QA Host',guest:'QA Guest'},SAVE='starRanchFable_v1',MARK='club-herd-qa-owned',MARK_VALUE='anonymous disposable club herd QA';
const ids={host:'p'+String(code).replaceAll('-','')+'h',guest:'p'+String(code).replaceAll('-','')+'g'},parentOrigin='http://'+location.hostname+':18796';
let G,w,booting=false,booted=false,driver=null,driveSteps=0,lastDrive=null;const held={},runtimeErrors=[],trace=[];
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const WRAPPER_COMMANDS=new Set(['boot','connect','club','drive','stop','disconnect','reportNow']);
const HERD_ACTIONS=new Set(['host','join','ready','start','leave','stop','again','save','result','activities','close','return'].map(a=>'clubherd:'+a));
let lastCommand=null;
function visibleButton(button){return !!button&&button.tagName==='BUTTON'&&!button.hidden&&button.getClientRects().length>0&&!['hidden','collapse'].includes(button.ownerDocument.defaultView.getComputedStyle(button).visibility);}
function disabledButton(button){return !!button.disabled||button.getAttribute('aria-disabled')==='true'||button.matches(':disabled');}
function productionButtons(){return booted&&w?[...w.document.querySelectorAll('button[data-fx]')].filter(b=>HERD_ACTIONS.has(b.dataset.fx)&&visibleButton(b)):[];}
function controlReport(){
 const wrapper=[...WRAPPER_COMMANDS].map(command=>{const b=$(command);return {kind:'wrapper',command,label:b.textContent.trim(),disabled:disabledButton(b)};});
 const game=productionButtons().map(b=>({kind:'herd',action:b.dataset.fx,herdId:b.dataset.herdId||'',label:b.textContent.trim(),disabled:disabledButton(b)}));
 const leave=booted&&w?.document.getElementById('clubHerdLeave');if(visibleButton(leave))game.push({kind:'hud',command:'leave',label:leave.textContent.trim(),disabled:disabledButton(leave)});
 return {wrapper,game,lastCommand};
}
function relayClick(command){
 let button;
 if(command?.kind==='wrapper'&&WRAPPER_COMMANDS.has(command.command))button=$(command.command);
 else if(command?.kind==='herd'&&HERD_ACTIONS.has(command.action)&&typeof command.herdId==='string'&&command.herdId.length<=96)button=productionButtons().find(b=>b.dataset.fx===command.action&&(b.dataset.herdId||'')===command.herdId);
 else if(command?.kind==='hud'&&command.command==='leave'&&booted)button=w?.document.getElementById('clubHerdLeave');
 if(!visibleButton(button)||disabledButton(button)){lastCommand={at:Date.now(),ok:false,reason:'That exact visible control is unavailable or disabled.'};publish();return;}
 lastCommand={at:Date.now(),ok:true,label:button.textContent.trim()};button.click();publish();
}
function guard(){if(location.protocol!=='http:'||!['localhost','127.0.0.1'].includes(location.hostname)||location.port!==PORTS[role]||!/^qah-[a-z0-9]{6,20}$/.test(code||'')||code.length>24)throw Error('Use the dedicated host/guest QA ports and a private qah- code.');}
function status(text){$('status').textContent=text;}
function fail(e){runtimeErrors.push(String(e?.stack||e));if(runtimeErrors.length>20)runtimeErrors.shift();status('FAILED: '+String(e?.message||e));publish();}
function read(){return JSON.parse(localStorage.getItem(SAVE)||'null');}
function seed(){
 guard();const old=read();if(localStorage.length&&(localStorage.getItem(MARK)!==MARK_VALUE||old?.qaHerd?.owned!==true))throw Error('Refusing an unrelated save. Use a fresh browser profile on this dedicated origin; nothing was deleted.');
 const at=Date.now(),day=new Date().toDateString(),d=new Date(at),week=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7)).toISOString().slice(0,10);
 const s=old||{v:2,ranchName:'QA Herd Ranch',founded:at,coins:150,gems:3,items:{carrot:10,apple:2,hay:3},nextId:1,horses:[],decor:[],projects:{},trophies:{},wild:null,wildTrust:0,muted:true,lastSeen:at,lastDaily:day,questDate:'',quests:[],totalRaces:0,started:true};
 const meta={name:'QA Herd Club',motto:'Anonymous two-rider test',founder:NAMES.host,founderId:ids.host,created:at,pub:false,crest:'horse',color:'#497657',revision:1,roles:{},roleIds:{},roleOwners:{}};
 s.qaHerd={owned:true,code,role,ids};s.pid='ID:'+ids[role].slice(1);s.playerName=NAMES[role];s.quality='low';s.qualityLocked=true;s.muted=true;s.ridingClub=code;s.club=code;s.clubPriv=code;s.pubWorld=false;s.clubMeta=meta;
 s.clubRecords=s.clubRecords||{};s.clubRecords[code]={pendingJoin:false,meta,notice:{t:'Anonymous QA herd drive',by:NAMES.host,at},seen:at,log:[],members:Object.fromEntries(Object.entries(ids).map(([key,id])=>[id,{n:NAMES[key],last:at,wk:week,sp:0,left:false}])),claims:{},points:{week,pts:0},allTime:0,week:{week,total:0,ownSP:0,rewardPolicy:2,rank:0,n:2},last:null};
 s.clubNotice=s.clubRecords[code].notice;s.clubSeen=at;s.chatLog=[];s.clubWeek=s.clubRecords[code].week;s.clubWeekLast=null;
 localStorage.setItem(MARK,MARK_VALUE);localStorage.setItem(SAVE,JSON.stringify(s));if(read()?.pid!==s.pid)throw Error('The QA seed could not be saved.');
}
async function wait(fn,label){for(let i=0;i<2400;i++){if(fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+label);}
async function boot(){
 if(booting)return;booting=true;stopDriver();seed();$('boot').disabled=true;status('Loading production ranch with the seeded QA identity…');
 const previous=frame.contentWindow.document;frame.src='/ranch3d.html?qa=club-herd&v='+Date.now();
 await wait(()=>{w=frame.contentWindow;G=w.__features;return w.document!==previous&&G?.clubHerd&&G?.clubHerdUI&&G.horse?.RIG().ready&&!w.document.getElementById('load');},'ranch and herd features');
 await Promise.all([G.undergrowth?.ready,G.photoscans?.ready,G.worldDetails?.ready,G.world?.ranchBuilderArt?.ready].filter(Boolean));
 w.addEventListener('error',e=>fail(e.error||e.message));w.addEventListener('unhandledrejection',e=>fail(e.reason));
 G.hidePanels();const dlg=w.document.getElementById('dlg');if(dlg)dlg.style.display='none';G.audio?.setMuted(true);G.riding?.releaseAll();
 if(G.net.net.id!==ids[role]||G.net.myName()!==NAMES[role]||G.clubs.identity().code!==code)throw Error('Reloaded production identity does not match this QA client.');
 booting=false;booted=true;for(const id of ['connect','club','drive','disconnect'])$(id).disabled=false;status('Ready. Connect if needed, then use Open club and the real herd buttons.');publish();
}
function key(k,on){if(held[k]===on||!w)return;held[k]=on;w.document.dispatchEvent(new w.KeyboardEvent(on?'keydown':'keyup',{code:k,key:{KeyW:'w',KeyA:'a',KeyD:'d',KeyS:'s'}[k],bubbles:true}));}
function release(){for(const k of Object.keys(held))key(k,false);G?.riding?.releaseAll();}
function stopDriver(){if(driver)clearInterval(driver);driver=null;release();$('stop').disabled=true;if(booted)$('drive').disabled=false;}
function drive(){
 if(!G?.clubHerd.snapshot().current?.riding)throw Error('Start through the real club UI before using the driver.');
 stopDriver();w.document.activeElement?.blur?.();$('drive').disabled=true;$('stop').disabled=false;status('Normal keyboard '+(role==='host'?'lead':'flank')+' driver running in real wall time.');
 driver=setInterval(()=>{
  try{
   const s=G.roundup.state(),c=G.clubHerd.snapshot().current,p=G.horse.player,h=s.target;
   if(!c?.riding||!s.shared){stopDriver();publish();return;}
   if(G.input?.blocked?.()||G.photoPause||w.document.hidden||c.paused||c.waitingForHost){release();return;}
   if(!h){release();return;}
   const dx=s.pen.x-h.x,dz=s.pen.z-h.z,l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l,px=p.pos.x-h.x,pz=p.pos.z-h.z,along=px*ux+pz*uz,side=px*(-uz)+pz*ux;
   let x=h.standX,z=h.standZ;if(role==='guest'){x=h.x-ux*10-uz*4;z=h.z-uz*10+ux*4;}
   if(h.approachBlocked||!Number.isFinite(x)||!Number.isFinite(z)||along>-5){const sign=Math.sign(side)||1;x=h.x-ux*8-uz*sign*17;z=h.z-uz*8+ux*sign*17;}
   const distance=Math.hypot(x-p.pos.x,z-p.pos.z),angle=Math.atan2(x-p.pos.x,z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
   G.riding.selectGait(distance>8?'trot':'walk');key('KeyA',delta>.035);key('KeyD',delta<-.035);key('KeyW',Math.abs(delta)<.6&&distance>.8);key('KeyS',Math.abs(delta)>1&&p.speed>1.2);driveSteps++;lastDrive={target:h.name,x,z,distance,gait:distance>8?'trot':'walk'};
  }catch(e){stopDriver();fail(e);}
 },100);
}
function sample(){
 const save=read(),safe=localStorage.getItem(MARK)===MARK_VALUE&&save?.qaHerd?.owned===true&&save.qaHerd.code===code;
 if(!G||!booted)return {at:Date.now(),role,status:$('status').textContent,booted:false,controls:controlReport(),errors:[],runtimeErrors:copy(runtimeErrors)};
 const controller=G.clubHerd.snapshot(),shared=G.roundup.shared.state(),round=G.roundup.state(),p=G.horse.player,record=safe?save.clubRecords?.[code]:null,personal=safe?save.clubHerdRecords:null;
 const out={at:Date.now(),role,status:$('status').textContent,booted,controls:controlReport(),net:{id:G.net.net.id,name:G.net.myName(),club:G.net.net.club,connected:!!G.net.net.client?.connected},shared,controller:{connected:controller.connected,code:controller.code,reason:controller.reason,notice:controller.notice,lobbies:controller.lobbies,current:controller.current,lastResult:controller.lastResult},roundup:{active:round.active,shared:round.shared,target:round.target,paused:round.paused,penned:round.penned,total:round.total,elapsed:round.elapsed},player:{x:p.pos.x,z:p.pos.z,heading:p.heading,speed:p.speed,onFoot:p.onFoot,y:p.y},driver:{active:!!driver,steps:driveSteps,last:lastDrive},save:safe?{qaHerd:save.qaHerd,club:{code,pub:record?.meta?.pub,founderId:record?.meta?.founderId,members:Object.entries(record?.members||{}).filter(([id])=>Object.values(ids).includes(id)).map(([id,r])=>({id,name:r.n,left:!!r.left}))},personal:{bestTime:personal?.bestTime??null,plays:personal?.plays??null,lastResult:personal?.receipts?.[personal?.lastRunId]??null,receiptCount:Object.keys(personal?.receipts||{}).length}}:null,errors:copy(G.errors||[]),runtimeErrors:copy(runtimeErrors),screens:{club:w.document.getElementById('clubHubPanel')?.style.display,result:w.document.getElementById('clubHerdResultPanel')?.style.display}};
 return out;
}
function publish(){try{const out=sample();$('report').textContent=JSON.stringify(out,null,2);trace.push(out);if(trace.length>180)trace.shift();if(parent!==window)parent.postMessage({type:'club-herd-qa-report',role,code,report:out},parentOrigin);}catch(e){$('report').textContent='Report failed: '+String(e);}}
window.addEventListener('message',e=>{
 if(parent===window||e.source!==parent||e.origin!==parentOrigin||e.data?.code!==code)return;
 if(e.data.type==='club-herd-qa-request'&&e.data.action==='report')publish();
 else if(e.data.type==='club-herd-qa-command')relayClick(e.data.command);
});
for(const [id,fn]of Object.entries({boot,connect:()=>G.net.netConnect(),club:()=>{stopDriver();G.clubHub.open('activities');},drive,stop:()=>{stopDriver();status('Keys released.');publish();},disconnect:()=>{stopDriver();G.net.net.client?.end(true);status('Actual MQTT client disconnected. Watch the other rider’s report.');publish();},reportNow:publish}))$(id).onclick=()=>Promise.resolve().then(fn).catch(fail);
window.addEventListener('pagehide',stopDriver);
try{guard();$('title').textContent=NAMES[role]+' · port '+PORTS[role];setInterval(publish,1000);publish();}catch(e){$('boot').disabled=true;fail(e);}
