'use strict';
const $=id=>document.getElementById(id),frame=$('game'),report={checks:[],errors:[],status:'ready'};
const SAVE='starRanchFable_v1',MARK='wild-bond-qa-owned';let G,w,member,before,allow=true,writes=0,blocked=0;
const copy=o=>JSON.parse(JSON.stringify(o)),pause=()=>new Promise(r=>setTimeout(r,0));
function show(text){if(text)report.status=text;$('status').textContent=report.status;$('report').textContent=JSON.stringify(report,null,2);}
function check(ok,label,data){report.checks.push({ok:!!ok,label,...(data===undefined?{}:{data})});show();if(!ok)throw Error(label);}
function fail(error){report.errors.push(String(error.stack||error));show('FAILED');}
function local(){if(!['localhost','127.0.0.1'].includes(location.hostname)||location.port!=='8599')throw Error('Use a fresh dedicated localhost:8599 origin.');}
async function wait(test,label){for(let n=0;n<2400;n++){if(test())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+label);}
async function load(){const old=frame.contentWindow.document;frame.src='/ranch3d.html?qa=wild-bond&v='+Date.now();await wait(()=>{w=frame.contentWindow;G=w.__features;return w.document!==old&&G?.worldPkg?.herds&&G.horse.RIG().ready&&!w.document.getElementById('load');},'game');w.advanceTime(0);G.hidePanels();w.document.getElementById('dlg').style.display='none';G.audio.setMuted(true);G.riding.releaseAll();G.net?.net?.client?.end?.(true);if(G.net?.net)G.net.net.client=null;await pause();}
function step(ms){const render=G.renderer.render;G.renderer.render=(scene,camera,...rest)=>{if(camera!==G.camera)return render.call(G.renderer,scene,camera,...rest);};try{w.advanceTime(ms);}finally{G.renderer.render=render;}}
function key(code,down){w.dispatchEvent(new w.KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));}
const visible=el=>!!el&&el.getClientRects().length>0;
function projection(s){return {horseCount:s.horses.length,coins:s.coins,gems:s.gems,pass:s.pass.pts,tamed:s.stats.tamedWild,life:s.life.tame||0,story:copy(s.story),daily:copy(s.dq),receipts:copy(s.wildTaming||{})};}
async function start(){
 local();const prior=JSON.parse(localStorage.getItem(SAVE)||'null');if(Object.keys(localStorage).length&&!(localStorage.getItem(MARK)==='owned disposable wild-bond test'&&prior?.qaWildBond&&!prior.wildTaming&&prior.horses?.length===1&&!prior.playerName))throw Error('Refusing to overwrite an existing local save. Use a fresh origin.');
 localStorage.setItem(MARK,'owned disposable wild-bond test');$('start').disabled=true;show('Loading isolated ranch…');await load();
 const index=G.quest.STORY.findIndex(m=>m.type==='tame');check(index>=0,'Production story has a wild-horse objective');
 G.save.sync(s=>{s.story={...s.story,idx:index,prog:0};s.dq={date:new Date().toDateString(),roll:['tame'],prog:{},claimed:{}};s.qaWildBond=true;});await load();
 check(G.quest.storyIdx()===index,'Normal reload synchronizes the selected story objective');
 check(!G.net?.net?.client?.connected,'Anonymous fixture is offline');
 member=G.worldPkg.herds.find(h=>h.def.id==='meadow').members[0];
 const p=G.horse.player;p.pos.set(member.pos.x+4,0,member.pos.z);p.speed=0;p.heading=-Math.PI/2;p.y=0;p.vy=0;
 G.riding.selectGait('walk');w.advanceTime(0);
 before=copy(G.save.fresh());report.encounter={runId:member.runId,name:member.name,breed:member.wb.breed,colors:{body:member.wb.body,mane:member.wb.mane},startTrust:member.trust};
 check(member.trust<1,'Encounter starts with natural zero trust');check(!visible(w.document.getElementById('dlg')),'No forced encounter dialog');
 $('walk').disabled=false;show('Ride and build trust. The horse and trust values have not been patched.');
}
async function walk(){
 $('walk').disabled=true;let steps=0;
 while(!member.follow&&steps++<300){step(100);if(steps%20===0)await pause();}
 check(member.follow&&member.trust>=50,'Patient approach naturally starts following at50');
 const p=G.horse.player,start={x:p.pos.x,z:p.pos.z};
 key('ControlLeft',true);key('KeyW',true);for(let i=0;i<30;i++){step(100);if(i%10===0)await pause();}key('KeyW',false);key('ControlLeft',false);G.riding.brake(true);step(1000);G.riding.brake(false);
 report.walkDistance=Math.hypot(p.pos.x-start.x,p.pos.z-start.z);check(report.walkDistance>2,'Normal keyboard walking moves the rider with the follower');
 while(!member.taming&&steps++<600){step(100);if(steps%20===0)await pause();}
 step(2500);w.advanceTime(0);await pause();
 check(member.taming&&G.worldPkg.effTrust(member)===100,'Follower naturally reaches full trust without carrots');
 check(member.parts.group.parent&&G.world.things.includes(member.thing),'Ready horse remains physically present and interactive');
 check(!visible(w.document.getElementById('dlg')),'Full trust does not interrupt the ride with a dialog');
 check(visible(w.document.getElementById('wildTameAction'))&&!w.document.getElementById('wildTameAction').disabled,'Stopped nearby rider gets an enabled Befriend button',{interaction:G.worldPkg.wildInteraction(member),distance:Math.hypot(p.pos.x-member.pos.x,p.pos.z-member.pos.z),speed:p.speed});
 const now=G.save.fresh();check(now.horses.length===before.horses.length&&(now.items.carrot||0)===(before.items.carrot||0),'Trust does not spend food or auto-grant a horse');
 w.resumeGame();$('block').disabled=false;show('READY — use Befriend in the game. Try Keep walking together, reopen, then block the next save before choosing home.');
}
function block(){
 const proto=w.Storage.prototype,original=proto.setItem;allow=false;
 proto.setItem=function(k,v){if(this===w.localStorage&&k===SAVE){let next;try{next=JSON.parse(v);}catch{}const fresh=JSON.parse(w.localStorage.getItem(SAVE));if(next?.wildTaming?.receipts?.[member.runId]&&!fresh?.wildTaming?.receipts?.[member.runId]){if(!allow){blocked++;throw Error('QA reward save blocked');}writes++;}}return original.call(this,k,v);};
 report.beforeChoice=projection(G.save.fresh());$('block').disabled=true;$('pending').disabled=false;show('Save failure armed. Choose Welcome to my ranch in the actual dialog.');
}
function pending(){
 const now=G.save.fresh();check(blocked===1&&writes===0,'One reward save was deliberately blocked');
 check(JSON.stringify(projection(now))===JSON.stringify(report.beforeChoice),'Failed save preserves horse count, rewards and quest progress');
 check(member.parts.group.parent&&member.pending?.choice==='home','Original horse and selected home remain pending');
 check(visible(w.document.getElementById('wTameRetry')),'Pending dialog exposes Retry save');
 $('pending').disabled=true;$('allow').disabled=false;show('PENDING — original horse stays visible. Allow saving, then use Retry save in the game.');
}
function permit(){allow=true;$('allow').disabled=true;$('verify').disabled=false;show('Saving allowed. Click Retry save in the game.');}
function verify(){
 const s=G.save.fresh(),receipt=s.wildTaming?.receipts?.[member.runId],horse=s.horses.find(h=>h.id===receipt?.horseId),base=report.beforeChoice;
 check(receipt?.saved&&receipt.choice==='home','Confirmed receipt records the chosen home');
 check(writes===1&&s.horses.length===base.horseCount+1,'Exactly one horse added in one reward write');
 check(horse?.name===member.name&&horse.breed===member.wb.breed&&horse.colors.body===member.wb.body&&horse.colors.mane===member.wb.mane,'Saved horse preserves the encountered name, breed and coat');
 check(s.stats.tamedWild===base.tamed+1&&s.life.tame===base.life+1,'Taming and lifetime progress count exactly once');
 check(s.story.prog===Math.min(G.quest.STORY[s.story.idx].goal,base.story.prog+1)&&G.quest.storyProg()===s.story.prog,'Saved main-story progress and live goal agree');
 check(s.dq.prog.tame===1,'Selected daily tame objective is complete');
 check(s.gems-base.gems===receipt.pay.g&&s.pass.pts-base.pass===receipt.pay.p,'Saved reward matches the result receipt');
 check(!member.parts.group.parent&&!G.world.things.includes(member.thing),'Wild horse removed only after verified ownership');
 check(visible(w.document.getElementById('wTameMeet')),'Saved result offers the actual new horse in My Horses');
 check(!G.errors.length,'No feature installation or runtime hook errors',G.errors);
 report.receipt=receipt;$('verify').disabled=true;show('PASSED — inspect the saved result and meet this horse in My Horses.');
}
function resize(a,b){frame.style.width=a+'px';frame.style.height=b+'px';}
for(const [id,fn] of Object.entries({start,walk,block,pending,allow:permit,verify}))$(id).onclick=()=>Promise.resolve().then(fn).catch(fail);
$('phone').onclick=()=>resize(390,844);$('landscape').onclick=()=>resize(667,375);$('desktop').onclick=()=>resize(960,600);
try{local();}catch(e){$('start').disabled=true;show(e.message);}
