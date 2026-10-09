/* Local, explicit browser QA. No horse position, speed, jump state or proof is patched. */
'use strict';
const PORT='8598',MARKER='meadowlark-training-growth-qa-v1',SAVE='starRanchFable_v1';
const $=id=>document.getElementById(id),frame=$('game'),report={version:1,checks:[],errors:[],blockedNetwork:[],ride:[],status:'ready'};
let started=false,allowSave=false,saveBoundary=null,fixtureMeta=null,baseline=null,guardDocument=null,held={},keyWindow=null;
const clone=value=>JSON.parse(JSON.stringify(value));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function show(message){if(message){report.status=message;$('status').textContent=message;}$('report').textContent=JSON.stringify(report,null,2);$('download').disabled=false;}
function check(ok,label,data){report.checks.push({ok:!!ok,label,...(data===undefined?{}:{data:clone(data)})});show();if(!ok)throw Error(label);}
function fail(error){report.failure=error?.stack||String(error);release();$('resume').disabled=true;try{report.featureErrors=clone(frame.contentWindow.__features?.errors||[]);}catch{}refreshReset();show('FAILED — inspect the report.');}
function requireLocal(){if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||location.port!==PORT)throw Error('Refusing to run: use the dedicated localhost port 8598.');}
function claimOrigin(){
 requireLocal();const keys=Object.keys(localStorage);
 if(keys.length){
  let mark,s;try{mark=JSON.parse(localStorage.getItem(MARKER));s=JSON.parse(localStorage.getItem(SAVE));}catch{}
  if(!mark?.owned||mark.port!==PORT||!s?.qaTrainingGrowth||s.qaTrainingGrowth.id!==mark.id||keys.some(key=>!(mark.keys||[]).includes(key)))throw Error('Refusing to write: this origin already has unrelated or unrecognized localStorage data. Use a fresh dedicated test origin.');
  // A completed fixture may be repeated only if all data belongs to this page.
  for(const key of keys)localStorage.removeItem(key);
 }
 const mark={owned:true,port:PORT,id:'training-growth-'+Date.now(),keys:[MARKER]};localStorage.setItem(MARKER,JSON.stringify(mark));return mark;
}
function interruptedOrigin(){
 requireLocal();let mark,s;try{mark=JSON.parse(localStorage.getItem(MARKER));s=JSON.parse(localStorage.getItem(SAVE));}catch{return null;}
 const created=Number(/^training-growth-(\d+)$/.exec(mark?.id||'')?.[1]);
 const allowed=new Set([MARKER,SAVE,'mk_sev','mk_sjy','mlrHudGoalExpanded']);
 const h=s?.horses?.[0];
 // Recovery is deliberately explicit and limited to a fresh anonymous game
 // created AFTER this page claimed this otherwise-empty dedicated origin.
 if(!mark?.owned||mark.port!==PORT||!created||Date.now()-created>3600000||
    !Number.isFinite(s?.founded)||s.founded<created||s.founded>created+600000||
    Object.keys(localStorage).some(key=>!allowed.has(key))||s.qaTrainingGrowth||s.lastTraining||s.playerName||
    s.totalRaces||Object.keys(s.trophies||{}).length||s.horses?.length!==1||
    h?.name!=='Clover'||h.breed!=='bay-sporthorse'||h.level!==1||h.xp!==0||
    Object.values(h.stats||{}).some(v=>v!==3))return null;
 return {mark,keys:Object.keys(localStorage)};
}
function refreshReset(){let owned=null;try{owned=interruptedOrigin();}catch{}$('reset').disabled=!owned;}
function resetInterrupted(){
 try{const owned=interruptedOrigin();if(!owned)throw Error('Refusing reset: the origin is not this page’s untouched interrupted anonymous boot.');
  release();frame.src='about:blank';for(const key of owned.keys)localStorage.removeItem(key);
  started=false;allowSave=false;saveBoundary=null;fixtureMeta=null;baseline=null;guardDocument=null;
  $('start').disabled=false;$('resume').disabled=true;$('reset').disabled=true;
  report.recovery={resetOwnedInterruptedBoot:owned.mark.id,keys:owned.keys};delete report.failure;
  show('Interrupted disposable boot reset. Click Start test to run the corrected fixture.');
 }catch(error){fail(error);}
}
function recordOwnedKeys(){const mark=JSON.parse(localStorage.getItem(MARKER));mark.keys=Object.keys(localStorage);localStorage.setItem(MARKER,JSON.stringify(mark));}
function protectFrame(){
 try{
  const w=frame.contentWindow;if(!w||!w.location.pathname.endsWith('/ranch3d.html')||guardDocument===w.document)return;
  guardDocument=w.document;
  w.addEventListener('error',event=>{report.errors.push({kind:'browser',message:event.message||'resource error'});show();});
  w.addEventListener('unhandledrejection',event=>{report.errors.push({kind:'promise',message:String(event.reason?.stack||event.reason)});show();});
  w.WebSocket=class{constructor(url){report.blockedNetwork.push({type:'WebSocket',url:String(url)});throw Error('External networking disabled by local QA');}};
  const fetch=w.fetch.bind(w);w.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,w.location.href);if(url.origin!==location.origin){report.blockedNetwork.push({type:'fetch',url:url.href});return Promise.reject(Error('External fetch disabled by local QA'));}return fetch(input,init);};
  const open=w.XMLHttpRequest.prototype.open;w.XMLHttpRequest.prototype.open=function(method,url,...rest){const target=new URL(url,w.location.href);if(target.origin!==location.origin){report.blockedNetwork.push({type:'XHR',url:target.href});throw Error('External XHR disabled by local QA');}return open.call(this,method,url,...rest);};
  try{w.navigator.sendBeacon=()=>false;}catch{}
 }catch(error){if(!String(error).includes('Blocked a frame'))report.guardNotice=String(error);}
}
async function until(predicate,label,timeout=180000){const start=Date.now();for(;;){protectFrame();let value;try{value=predicate();}catch{}if(value)return value;if(Date.now()-start>timeout)throw Error('Timed out: '+label);await sleep(100);}}
async function loadGame(label){
 const old=frame.contentWindow?.document;guardDocument=null;held={};keyWindow=null;
 frame.src='/ranch3d.html?qa=training-growth&season=frost&qaRun='+Date.now();show(label);
 await until(()=>frame.contentWindow.document!==old&&frame.contentWindow.__features?.jumpTraining&&frame.contentWindow.__features.horse.RIG().ready&&!frame.contentWindow.document.getElementById('load'),'game and native horse ready',240000);
 const w=frame.contentWindow,G=w.__features;
 G.net?.net?.client?.end?.(true);if(G.net?.net)G.net.net.client=null;
 if(G.net)G.net.netConnect=()=>false;
 await Promise.all([G.undergrowth?.ready,G.photoscans?.ready,G.worldDetails?.ready,G.world?.ranchBuilderArt?.ready].filter(Boolean));
 w.advanceTime(0);G.audio.setMuted(true);G.wardrobe?.closeChar();G.hidePanels();G.seFrame?.settle();G.riding.releaseAll();return {w,G};
}
function seed(G,mark){
 const missions=G.quest.STORY.map((m,index)=>({index,type:m.type,goal:m.goal,label:m.title||m.name||m.text||null})).filter(m=>m.type==='cleanjump'&&Number.isFinite(m.goal)&&m.goal>0);
 const selected=missions.slice().sort((a,b)=>b.goal-a.goal)[0],mission=selected?.index??-1;
 report.startup={featureErrors:clone(G.errors||[]),cleanJumpMissions:clone(missions)};recordOwnedKeys();show();
 const entries=G.houses.entries(),bookIndex=entries.findIndex(e=>e.evt==='cleanjump'&&e.goal>=8),entry=entries[bookIndex];
 const daily=G.quest.DAILYQ,required=['cleanjump','sxp','train'];
 check(mission>=0,'Select the largest currently available production clean-jump mission',selected);
 check(required.every(type=>daily.some(q=>q.type===type)),'Production daily objectives include clean jumps, stat gains and food training');
 check(entry&&G.seasons.now().def.id==='frost','Actual Frost almanac has a clean-jump entry');
 const horseId=G.horse.ridden().id,seasonKey=G.houses.season().key,realKey=G.seasons.realKey(),week=G.time.isoWeekKey();
 const challenges=G.seasons.challenges(),training=challenges.find(c=>c.id==='fr-train');check(training?.type==='drill'&&training.goal===10,'Frost uses completed drills for fr-train');
 G.save.sync(s=>{
  const h=s.horses.find(h=>h.id===horseId);h.level=4;h.xp=240;h.stats=Object.fromEntries(G.tables.STAT_KEYS.map(k=>[k,4]));h.sxp=Object.fromEntries(G.tables.STAT_KEYS.map(k=>[k,0]));
  s.rider.made=true;s.playerName='';s.qaTrainingGrowth={id:mark.id,version:1};
  s.story={...s.story,idx:mission,prog:0};
  s.dq={date:new Date().toDateString(),roll:required,prog:{},claimed:{}};
  s.side={active:{'h-bram-clean':{p:4}},done:{},n:0};
  s.seasonQ={...s.seasonQ,key:seasonKey,idx:bookIndex,prog:entry.goal-8,claimed:{},unlocked:false};
  s.sn={...s.sn,key:realKey,wk:week,prog:{},paid:{},weeks:0};
  for(const c of challenges){s.sn.prog[c.id]=c.id==='fr-train'?9:c.goal;if(c.id!=='fr-train')s.sn.paid[c.id]=1;}
 });
 fixtureMeta={horseId,mission,missionGoal:selected.goal,bookIndex,bookGoal:entry.goal,bookBefore:entry.goal-8,seasonKey,realKey,week,
  dailyGoals:Object.fromEntries(required.map(type=>[type,daily.find(q=>q.type===type).goal])),
  trainingReward:clone(training.r),weekReward:clone(G.seasons.WEEK_BONUS)};
 report.fixture=fixtureMeta;report.fixtureBaseline=G.save.fresh();recordOwnedKeys();
}
function projection(save){
 const h=save.horses.find(h=>h.id===fixtureMeta.horseId);
 return {horse:clone(h),coins:save.coins,pass:save.pass?.pts||0,tokens:save.tokens?.n||0,gems:save.gems||0,
  drills:save.stats?.drills||0,jumps:save.stats?.jumps||0,life:Object.fromEntries(['cleanjump','sxp','drill','train'].map(k=>[k,save.life?.[k]||0])),
  daily:clone(save.dq),story:clone(save.story),side:clone(save.side),book:clone(save.seasonQ),season:clone(save.sn)};
}
function installSaveFailure(w,G){
 const proto=w.Storage.prototype,original=proto.setItem;saveBoundary={attempts:0,writes:0,failedBefore:null,candidate:null};
 proto.setItem=function(key,value){
  if(this===w.localStorage&&key===SAVE){
   let next;try{next=JSON.parse(value);}catch{}
   if(next?.lastTraining?.runId&&next.lastTraining.runId!==report.start?.result?.runId){
    const current=JSON.parse(w.localStorage.getItem(SAVE));
    if(current?.lastTraining?.runId!==next.lastTraining.runId){
     saveBoundary.attempts++;
     if(!allowSave){saveBoundary.failedBefore=current;saveBoundary.candidate=next;throw Error('QA: training reward write deliberately blocked');}
     saveBoundary.writes++;
    }
   }
  }
  return original.call(this,key,value);
 };
}
function step(w,G,ms){const render=G.renderer.render;G.renderer.render=function(scene,camera,...args){if(camera!==G.camera)return render.call(this,scene,camera,...args);};try{w.advanceTime(ms);}finally{G.renderer.render=render;}}
function key(w,code,on){keyWindow=w;if(held[code]===on)return;held[code]=on;w.dispatchEvent(new w.KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));}
function release(){try{for(const code in held)if(held[code])key(keyWindow,code,false);frame.contentWindow.__features?.riding.releaseAll();}catch{}}
function snapshot(G){const s=G.save.fresh(),p=G.horse.player,r=G.horse.RIG();return {drill:clone(G.course.drillState()),result:s.lastTraining||null,horse:clone(s.horses.find(h=>h.id===fixtureMeta.horseId)),position:{x:p.pos.x,z:p.pos.z},heading:p.heading,speed:p.speed,height:p.y,jumpAge:r.heroJumpAge,featureErrors:clone(G.errors||[])};}
async function ride(w,G){
 G.ui.openEvents();G.seEvents.openPage('__drill');G.seFrame?.settle();
 const button=w.document.querySelector('[data-sev="drill:jump"]');check(!!button&&!button.disabled,'The normal Jump training button is available');button.click();
 report.start=snapshot(G);check(report.start.drill.activity==='jump'&&report.start.drill.countdown===3&&report.start.drill.timeRemaining===120,'Normal entry starts the real eight-fence clinic');
 step(w,G,3200);w.advanceTime(0);let previous='';
 for(let batch=0;batch<450;batch++){
  for(let i=0;i<10;i++){
   const d=G.course.drillState(),c=d.clinic,p=G.horse.player;
   if(!d.active){release();break;}if(d.countdown>0){step(w,G,50);continue;}
   const next=d.next;if(!next)throw Error('Active clinic has no next guide');
   const angle=Math.atan2(next.x-p.pos.x,next.z-p.pos.z),delta=Math.atan2(Math.sin(angle-p.heading),Math.cos(angle-p.heading));
   key(w,'KeyA',delta>.07);key(w,'KeyD',delta<-.07);key(w,'ControlLeft',Math.abs(delta)>.60);key(w,'KeyW',Math.abs(delta)<1.10);key(w,'KeyS',Math.abs(delta)>1.35&&p.speed>1);
   const jumping=c.misses>0&&c.inWindow&&G.horse.RIG().heroJumpAge==null;
   key(w,'Space',jumping);step(w,G,50);
   if(G.course.drillState().clinic?.phase==='landing')break;
  }
  const state=snapshot(G),signature=[state.drill.cleared,state.drill.clinic?.phase,state.drill.clinic?.misses].join(':');
  if(signature!==previous){report.ride.push(state);previous=signature;show('Riding: '+state.drill.cleared+' / 8 cleared, '+Math.ceil(state.drill.timeRemaining)+'s left.');}
  if(batch%10===0)w.advanceTime(0);
  if(!state.drill.active)break;
  await sleep(0);
 }
 release();w.advanceTime(0);await sleep(30);
 const pending=G.course.drillState().pending;report.pending=snapshot(G);report.saveBoundary=clone(saveBoundary);
 check(pending?.completed&&pending.cleared===8&&pending.activity==='jump','Keyboard riding lands all eight jumps before timeout',pending);
 check(pending.saved===false&&saveBoundary.attempts===1&&saveBoundary.writes===0,'Training reward save is pending after exactly one deliberately blocked write');
 check(JSON.stringify(projection(G.save.fresh()))===JSON.stringify(projection(saveBoundary.failedBefore)),'Blocked reward write retains the exact pre-write horse and progress state');
 check(!G.save.fresh().lastTraining||G.save.fresh().lastTraining.runId!==pending.runId,'Unsaved reward receipt is not stored');
 check((G.errors||[]).length===0&&!report.errors.length,'No browser or feature errors before retry',G.errors||[]);
 baseline=clone(G.save.fresh());report.preSaveBaseline=baseline;
 await until(()=>w.document.querySelector('[data-fx="training:retry-save"]')?.getClientRects().length,'pending result appears',10000);
 resize(390,844);await assertResultLayout(w,false,390,844);resize(667,375);await assertResultLayout(w,false,667,375);resize(390,844);$('resume').disabled=false;show('PENDING SAVE — inspect the phone result, then click Resume / save.');recordOwnedKeys();
}
function verifySaved(G){
 const after=G.save.fresh(),r=after.lastTraining,before=baseline,h=after.horses.find(h=>h.id===fixtureMeta.horseId),old=before.horses.find(h=>h.id===fixtureMeta.horseId),p=r?.progress;
 check(r?.saved===true&&r.completed&&r.cleared===8&&r.horseId===fixtureMeta.horseId,'Saved receipt belongs to the original eight-jump horse');
 check(r.growth?.horseXp===24,'Receipt retains exactly 24 horse XP',r.growth);
 check(r.before?.cap===4&&r.growth.before.level===4&&r.statXp===0,'This initially capped practice itself opens the next horse-level cap',{before:r.before,growthBefore:r.growth.before,statXp:r.statXp});
 check(h.level===5&&Math.min(G.xp.statCap(h),G.xp.statCeil(h,'jump'))===5,'Practice grows this horse to level 5 and cap 5',{horse:h,growth:r.growth});
 check(r.growth.before.level===old.level&&r.growth.before.xp===old.xp,'Growth receipt starts from the exact saved pre-retry horse');
 check(p.cleanJumps===8&&(after.stats.jumps||0)-(before.stats.jumps||0)===8,'Exactly eight clean jumps enter the durable jump tally');
 const expectedStory=Math.min(fixtureMeta.missionGoal,before.story.prog+8);
 check(after.story.idx===fixtureMeta.mission&&after.story.prog===expectedStory,'Main story records all eight jumps up to its actual goal cap',{goal:fixtureMeta.missionGoal,before:before.story.prog,after:after.story.prog,expected:expectedStory});
 check(G.quest.storyIdx()===after.story.idx&&G.quest.storyProg()===after.story.prog,'Live main story cache matches its saved training progress');
 check((after.life?.cleanjump||0)-(before.life?.cleanjump||0)===8,'Daily lifetime clean-jump credit is exactly eight');
 check(after.dq.prog.cleanjump===Math.min(fixtureMeta.dailyGoals.cleanjump,(before.dq.prog.cleanjump||0)+8),'Daily clean-jump progress respects the production goal cap');
 check((after.side.active['h-bram-clean']?.p||0)-(before.side.active['h-bram-clean']?.p||0)===8,'Active Bram side quest receives exactly eight clean jumps');
 check(after.seasonQ.idx===fixtureMeta.bookIndex&&after.seasonQ.prog-before.seasonQ.prog===8&&!after.seasonQ.unlocked,'Current Frost almanac receives eight without auto turn-in');
 check(after.sn.prog['fr-train']===10&&after.sn.paid['fr-train']===1&&after.sn.paid['week:'+fixtureMeta.week]===1&&after.sn.weeks-before.sn.weeks===1,'Completed drill finishes Frost challenge and banks the week once');
 const challenge=fixtureMeta.trainingReward,week=fixtureMeta.weekReward;
 check(after.tokens.n-before.tokens.n===(challenge.tok||0)+(week.tok||0)&&after.pass.pts-before.pass.pts===12+(challenge.p||0)+(week.p||0)&&after.gems-before.gems===(challenge.g||0)+(week.g||0),'Challenge and whole-week payouts match actual production reward tables');
 check((after.life?.train||0)===(before.life?.train||0)&&(after.dq.prog.train||0)===(before.dq.prog.train||0),'Riding does not credit food-training objectives');
 const levelBonus=Object.values(r.growth.statGains||{}).reduce((sum,value)=>sum+value,0),actualRaised=r.statRaised+levelBonus;
 check(p.statsRaised===actualRaised&&(after.life?.sxp||0)-(before.life?.sxp||0)===actualRaised,'Stat progress counts actual drill and level-bonus gains without assuming random bonus choice');
 check(after.coins-before.coins===64&&(after.stats.drills||0)-(before.stats.drills||0)===1,'Eight cleared jumps retain exact coins and one completed drill');
 const committed=JSON.stringify(projection(after));check(G.course.retryDrillSave()===false,'Duplicate retry has no pending transaction');
 check(JSON.stringify(projection(G.save.fresh()))===committed&&saveBoundary.writes===1,'Duplicate retry changes no XP, progress or rewards');
 report.saved=snapshot(G);report.savedState=after;report.saveBoundary=clone(saveBoundary);
 check((G.errors||[]).length===0&&!report.errors.length,'No browser or feature errors through successful retry',G.errors||[]);
}
async function start(){
 if(started)return;
 try{
  const mark=claimOrigin();started=true;$('start').disabled=true;$('warning').textContent='This origin now contains a marked disposable QA save. The normal public game save is untouched.';
  let game=await loadGame('Loading the real game to seed its disposable fixture…');seed(game.G,mark);
  game=await loadGame('Reloading the marked fixture to synchronize story and almanac cursors…');
  check(game.G.quest.storyIdx()===fixtureMeta.mission,'Fixture main story cursor is active after normal reload');
  check(game.G.houses.bookState().cur?.evt==='cleanjump','Fixture almanac cursor is active after normal reload');
  check(!game.G.net?.net?.client?.connected,'Fresh anonymous fixture is offline');installSaveFailure(game.w,game.G);await ride(game.w,game.G);
 }catch(error){fail(error);}
}
async function resume(){
 $('resume').disabled=true;
 try{
  const w=frame.contentWindow,G=w.__features,button=w.document.querySelector('[data-fx="training:retry-save"]');
  check(!!button&&!button.disabled,'Pending result exposes the real Retry save action');allowSave=true;button.click();
  await until(()=>G.course.drillState().lastResult?.saved===true&&!G.course.drillState().pending,'training save confirmation',10000);
  await sleep(60);w.advanceTime(0);verifySaved(G);resize(390,844);await assertResultLayout(w,true,390,844);resize(667,375);await assertResultLayout(w,true,667,375);resize(390,844);recordOwnedKeys();show('PASSED — saved result remains visible. Switch frame size for screenshots.');
 }catch(error){fail(error);}
}
async function assertResultLayout(w,saved,width,height){
 await new Promise(resolve=>w.requestAnimationFrame(()=>w.requestAnimationFrame(resolve)));
 const panel=w.document.getElementById('trainingResultPanel'),result=panel?.querySelector('.td-result'),growth=panel?.querySelector('.td-growth');
 const text=panel?.textContent||'',rect=result?.getBoundingClientRect(),actions=[...(panel?.querySelectorAll('button[data-fx]')||[])].filter(b=>b.getClientRects().length).map(b=>({action:b.dataset.fx,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}));
 check(!!result&&panel.getClientRects().length,'Training result remains visible at '+width+' × '+height);
 check(saved?!!growth&&/\+24 horse XP saved/.test(growth.textContent):!growth&&!/horse XP saved/.test(text),saved?'Saved result renders retained 24 horse XP':'Pending result makes no saved horse-XP claim');
 check(rect.left>=-1&&rect.right<=w.innerWidth+1&&result.scrollWidth<=result.clientWidth+1,'Result has no horizontal overflow at '+width+' × '+height,{viewport:{width:w.innerWidth,height:w.innerHeight},result:{left:rect.left,right:rect.right,scrollWidth:result.scrollWidth,clientWidth:result.clientWidth}});
 check(actions.length>0&&actions.every(b=>b.height>=43.99),'Result action buttons are at least 44px tall at '+width+' × '+height,actions);
}
function resize(width,height){frame.style.width=width+'px';frame.style.height=height+'px';report.viewport={width,height};try{frame.contentWindow.advanceTime?.(0);}catch{}show();}
$('start').onclick=start;$('resume').onclick=resume;$('reset').onclick=resetInterrupted;$('phone').onclick=()=>resize(390,844);$('landscape').onclick=()=>resize(667,375);$('desktop').onclick=()=>resize(1280,850);
$('download').onclick=()=>{const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='training-growth-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
try{requireLocal();refreshReset();}catch(error){$('start').disabled=true;$('warning').textContent=error.message;}
window.trainingGrowthQA={report,start,resume,resize,resetInterrupted};
