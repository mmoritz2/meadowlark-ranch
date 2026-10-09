/* Training presentation follows the core drill state; target acceptance and
 * payouts remain owned by the game. The jump clinic supplies its own world art. */
export const id='training-drills';
const LABELS={speed:'Speed',stamina:'Stamina',jump:'Jump',accel:'Acceleration',agility:'Agility'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const fmt=n=>Math.max(0,Math.round(finite(n))).toLocaleString();

// Receipts can contain a proposed after-state while a write is unconfirmed.
// Never present that proposal as retained XP or a saved stat increase.
export function trainingReceiptView(receipt,statNeed){
 const r=receipt||{},saved=r.saved===true,before=r.before&&Number.isFinite(r.before.value)?r.before:null;
 const after=saved&&r.after&&Number.isFinite(r.after.value)?r.after:null;
 const capped=!!after&&Number.isFinite(after.cap)&&after.value>=after.cap;
 const need=after?Math.max(1,finite(statNeed?.(after.value),1)):1;
 const xp=after?Math.max(0,finite(after.xp)):0;
 const raw=saved&&r.growth,maxLevel=Math.max(1,Math.floor(finite(raw?.maxLevel,50)));
 let growth=null;
 if(raw&&Number.isFinite(raw.before?.level)&&Number.isFinite(raw.after?.level)&&raw.before.level>=1&&raw.after.level>=raw.before.level&&raw.after.level<=maxLevel&&Number.isFinite(raw.after.xp)){
  const level=Math.floor(raw.after.level),levels=Math.max(0,Math.floor(finite(raw.levels))),atMax=level>=maxLevel;
  const nextLevelXp=Math.max(1,finite(raw.nextLevelXp,50+level*50)),levelXp=atMax?0:Math.max(0,raw.after.xp);
  growth={before:{level:Math.floor(raw.before.level),xp:Math.max(0,finite(raw.before.xp))},after:{level,xp:levelXp},levels,maxLevel,atMax,nextLevelXp,
   horseXp:raw.before.level>=maxLevel?0:Math.max(0,finite(raw.horseXp)),
   percent:atMax?100:Math.max(0,Math.min(100,levelXp/nextLevelXp*100)),
   statGains:Object.fromEntries(Object.keys(LABELS).map(k=>[k,levels?Math.max(0,Math.floor(finite(raw.statGains?.[k]))):0]).filter(([,n])=>n>0)),
   nextTrainingLevel:Number.isFinite(raw.nextTrainingLevel)&&raw.nextTrainingLevel>level&&raw.nextTrainingLevel<=maxLevel?Math.floor(raw.nextTrainingLevel):null,
   breedCap:Number.isFinite(raw.breedCap)?raw.breedCap:null};
 }
 let trainingHint='';
 if(growth&&after){
  if(capped){
   if(growth.breedCap!==null&&after.value>=growth.breedCap)trainingHint='Breed ceiling reached for '+(LABELS[r.stat]||'this stat')+'. More horse levels cannot raise this base stat; tack can add effective stats.';
   else if(growth.nextTrainingLevel!==null)trainingHint='Next '+(LABELS[r.stat]||'stat')+' training cap opens at horse Lv '+growth.nextTrainingLevel+'.'+(r.activity==='jump'?' Cleared practice jumps still earn horse XP.':'');
   else trainingHint='Current training ceiling reached. No further training cap is available.';
  }else if(before&&Number.isFinite(before.cap)&&before.value>=before.cap&&after.cap>before.cap){
   trainingHint='Horse Lv '+growth.after.level+' opened a training cap of '+after.cap+'. '+(LABELS[r.stat]||'Stat')+' training can grow again.';
  }
 }

 return {saved,before,after,capped,need,xp,growth,trainingHint,cleanJumps:saved?Math.max(0,Math.floor(finite(r.progress?.cleanJumps))):0,percent:after?(capped?100:Math.max(0,Math.min(100,xp/need*100))):0,
  retainedXp:saved?Math.max(0,finite(r.statXp)):0,coins:saved?Math.max(0,finite(r.coins)):0,
  passPoints:saved?Math.max(0,finite(r.passPoints)):0,stat:LABELS[r.stat]||'Training',horse:r.horseName||'Your horse',
  jumping:r.activity==='jump',unit:r.activity==='jump'?'jumps':'cones',misses:Math.max(0,Math.floor(finite(r.clinic?.misses)))};
}

export function install(G){
 const C=G.course,T=G.THREE,$=id=>document.getElementById(id),hud=$('drillHud');
 if(!hud||!C?.drillState)return;
 let receipt=null,elapsed=1,guide=null,guideKey='',lastSignature='',resultTimer=0;
 let eventTarget=null,launchTarget=null,wasActive=false;
 const style=document.createElement('style');style.textContent=`
 #drillHud{top:calc(18px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 450px));max-width:calc(100vw - 28px);padding:12px 15px;border:1px solid #eee4ba40;border-radius:14px;background:#193e34f5;color:#fff8e5;box-shadow:0 7px 28px #102d2c30;font:500 13px/1.4 system-ui,sans-serif;box-sizing:border-box;text-align:left;z-index:7}
 #drillHud *{box-sizing:border-box}.td-hud-head{display:flex;align-items:center;gap:10px}.td-hud-title{min-width:0;flex:1}.td-hud-title strong{display:block;font-size:14px;line-height:1.25}.td-hud-title small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d1dec9;font-size:11px;margin-top:3px}
 #drillHud button{font:600 12px/1.2 system-ui,sans-serif;min-height:44px;padding:8px 11px;border:1px solid #fff6dc50;border-radius:8px;background:#ffffff0d;color:#fff9e9;cursor:pointer;flex:none}#drillHud button[hidden]{display:none!important}
 .td-hud-main{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:9px 0 7px}.td-hud-main strong{font-size:21px;font-weight:750;letter-spacing:-.035em}.td-hud-main span{color:#ebd79e;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}.td-dots{display:flex;gap:5px}.td-dots i{height:4px;flex:1;border-radius:8px;background:#ffffff26}.td-dots i.done{background:#b0cb99}.td-dots i.next{background:#f1d48c}.td-hud-cue{font-size:11px;color:#dbe5d0;margin:8px 0 0;line-height:1.45}
 body.training-active :is(#rushQuick,#seGoal,#questTrack,#sgFocus,#seWay,#ctx){display:none!important}body.se-screen-open #drillHud,body.freecam #drillHud,body.posing #drillHud,body.summoning #drillHud{display:none!important}
 #trainingResultPanel{position:fixed!important;inset:0!important;transform:none!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;display:none;align-items:center;justify-content:center;padding:16px!important;margin:0!important;border:0!important;border-radius:0!important;background:#102d2baa!important;box-shadow:none!important;overflow:auto!important;z-index:13!important;color:#25483a;font:14px/1.45 system-ui,sans-serif}
 #trainingResultPanel *{box-sizing:border-box}#trainingResultPanel>.mk-x{display:none!important}.td-result{width:min(510px,100%);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;padding:24px;border:1px solid #e0dfca;border-radius:18px;background:#f7f3e8;box-shadow:0 20px 65px #081f2345;scrollbar-width:thin}
 .td-result-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:18px}.td-result-head>div{min-width:0;flex:1}.td-eyebrow{font-size:10px;font-weight:750;letter-spacing:.1em;text-transform:uppercase;color:#65765b}.td-result h1{font:400 32px/1.1 Georgia,serif;letter-spacing:-.6px;margin:7px 0 7px;color:#25483a}.td-horse{font-size:13px;color:#65775f;overflow-wrap:anywhere;margin:0}
 #trainingResultPanel button{min-height:44px;cursor:pointer;font:650 13px/1.3 system-ui,sans-serif;color:#25483a;background:#fffcf3;border:1px solid #cbd3bf;border-radius:9px;padding:10px 13px;box-shadow:none}#trainingResultPanel button:disabled{opacity:.5;cursor:default}#trainingResultPanel button.td-close{padding:8px;min-width:44px;flex:none;font-size:22px;line-height:1;background:transparent}#trainingResultPanel button.td-primary{background:#295b44;border-color:#295b44;color:#fff9e7}
 #trainingResultPanel button:focus-visible,#drillHud button:focus-visible{outline:3px solid #ba8c36;outline-offset:3px}
 .td-result-grid{display:grid;grid-template-columns:minmax(0,1fr) 126px;gap:12px}.td-progress{border:1px solid #ccd7be;border-radius:12px;background:#e8eddc;padding:15px}.td-stat-change{display:flex;align-items:center;gap:11px;margin:7px 0 11px;font-size:29px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}.td-stat-change span{font-size:17px;font-weight:400;color:#7b8b6b}.td-stat-change .td-before{color:#7b8b6b;font-size:24px}.td-retained{font-size:13px;font-weight:750;margin:0 0 9px}.td-xp-bar{height:7px;border-radius:8px;background:#cbd6bd;overflow:hidden}.td-xp-bar i{display:block;height:100%;background:#557c42;border-radius:8px}.td-progress small{display:block;margin-top:7px;color:#58704e;font-size:11px;line-height:1.4}.td-tallies{display:flex;flex-direction:column;gap:8px}.td-tally{border:1px solid #d8dac8;border-radius:11px;padding:11px;background:#fffcf4;flex:1}.td-tally strong{display:block;font-size:21px;margin-bottom:2px;line-height:1.2;font-variant-numeric:tabular-nums}.td-tally span{font-size:11px;color:#68765d}.td-result-note{font-size:12px;line-height:1.55;color:#627258;margin:14px 0}.td-result-note strong{color:#36563d}.td-pending{padding:16px;background:#f3e7c7;border:1px solid #dbc69a;border-radius:11px;font-size:13px;line-height:1.6}.td-pending p{margin:6px 0 0;color:#705f3f}.td-pending small{display:block;color:#786a4d;margin-top:7px}.td-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.td-actions>.td-primary{grid-column:1/-1}.td-next-horse{font-size:11px;color:#64765c;margin:10px 0 0}
 .td-growth{margin-top:10px;padding:10px 12px;border:1px solid #d8dac8;border-radius:10px;background:#fffcf4}.td-growth-head{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:3px 12px;font-size:12px}.td-growth-head strong{font-size:13px}.td-growth-head span{font-weight:750;color:#45663b}.td-growth .td-xp-bar{margin:6px 0}.td-growth small{display:block;color:#58704e;font-size:11px;line-height:1.4}.td-growth .td-level-bonus{margin-top:4px}
 @media(max-height:500px) and (min-width:601px){.td-growth{margin-top:8px;padding:8px 10px}.td-growth .td-xp-bar{height:5px;margin:4px 0}}
 @media(max-width:800px){#drillHud{top:calc(132px + env(safe-area-inset-top));width:min(420px,calc(100vw - 28px))}}
 @media(max-width:600px){.td-result{padding:20px 17px}.td-result h1{font-size:29px}.td-result-grid{grid-template-columns:minmax(0,1fr) 104px;gap:9px}.td-progress{padding:13px}.td-tally{padding:10px}.td-result-head{margin-bottom:15px}}
 @media(max-height:500px) and (min-width:601px){#drillHud{top:calc(9px + env(safe-area-inset-top));left:calc(220px + env(safe-area-inset-left));transform:none;width:min(310px,calc(100vw - 336px));padding:8px 11px}.td-hud-main{margin:3px 0 5px}.td-hud-main strong{font-size:17px}.td-hud-cue{display:none}#drillHud[data-activity="jump"] .td-hud-cue{display:block;margin-top:5px}.td-hud-title strong{font-size:12px}.td-hud-title small{font-size:10px}.td-result{width:min(610px,100%);padding:14px 18px}.td-result-head{margin-bottom:10px}.td-result h1{font-size:25px;margin:3px 0}.td-result-grid{grid-template-columns:minmax(0,1fr) 190px}.td-tallies{flex-direction:row}.td-progress{padding:11px 14px}.td-stat-change{display:inline-flex;font-size:25px;margin:5px 10px 5px 0}.td-retained{display:inline-block;margin:0 0 6px}.td-result-note{margin:9px 0;font-size:11px}.td-actions{grid-template-columns:1fr 1fr 1fr;margin-top:9px;gap:7px}.td-actions>.td-primary{grid-column:auto}.td-next-horse{margin-top:6px}.td-pending{padding:11px 14px}}
 `;document.head.appendChild(style);
 hud.setAttribute('role','region');hud.setAttribute('aria-label','Horse training');
 hud.innerHTML='<div class="td-hud-head"><div class="td-hud-title"><strong id="trainingHudStat"></strong><small id="trainingHudHorse"></small></div><button id="trainingEnd" type="button">End training</button><button id="trainingPending" type="button" hidden>Retry save</button></div><div class="td-hud-main"><strong id="trainingHudTarget" aria-live="polite"></strong><span id="trainingHudTime"></span></div><div id="trainingHudProgress" class="td-dots" aria-label="Cones cleared"></div><p class="td-hud-cue" id="trainingHudCue"></p>';
 const refs={stat:$('trainingHudStat'),horse:$('trainingHudHorse'),target:$('trainingHudTarget'),time:$('trainingHudTime'),progress:$('trainingHudProgress'),cue:$('trainingHudCue'),end:$('trainingEnd'),pending:$('trainingPending')};
 const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 const getState=()=>C.drillState()||{};
 const pendingReceipt=s=>s.pending&&typeof s.pending==='object'?s.pending:receipt?.saved===false?receipt:null;
 const selectedCap=r=>{const h=G.horse.ridden?.();if(!h||!r)return {atCap:true,horse:h};const cap=Math.min(G.xp.statCap(h),G.xp.statCeil(h,r.stat));return {atCap:finite(h.stats?.[r.stat])>=cap,horse:h};};
 const canRepeat=r=>{const selection=selectedCap(r);return !!selection.horse&&(r?.stat==='jump'||!selection.atCap);};

 function resultMarkup(){
  const r=receipt||{},v=trainingReceiptView(r,G.xp.statNeed),total=finite(r.total,8),cleared=finite(r.cleared),selection=selectedCap(r);
  const title=!v.saved?'Training is waiting to save':v.jumping?(r.completed?'A jumping partnership.':'Building your jumping rhythm.'):r.completed?'A clear round.':'Every cone counts.';
  const progress=v.after?`<section class="td-progress" aria-label="${esc(v.stat)} progress"><div class="td-eyebrow">${esc(v.stat)}</div><div class="td-stat-change"><b class="td-before">${fmt(v.before?.value)}</b><span aria-hidden="true">→</span><b>${fmt(v.after.value)}</b></div><p class="td-retained">+${fmt(v.retainedXp)} stat XP saved</p><div class="td-xp-bar" role="progressbar" aria-label="${esc(v.stat)} training XP" aria-valuemin="0" aria-valuemax="${v.capped?1:v.need}" aria-valuenow="${v.capped?1:Math.min(v.need,v.xp)}" aria-valuetext="${v.capped?'Current training ceiling reached':`${fmt(v.xp)} of ${fmt(v.need)} XP toward ${v.stat} ${fmt(v.after.value+1)}`}"><i style="width:${v.percent}%"></i></div><small>${v.capped?`Current ceiling: ${fmt(v.after.value)} / ${fmt(v.after.cap)}`:`${fmt(v.xp)} / ${fmt(v.need)} XP toward ${esc(v.stat)} ${fmt(v.after.value+1)}`}</small></section>`:'';
  const growth=v.growth,growthBar=growth?`<section class="td-growth" aria-label="Horse level progress"><div class="td-growth-head"><strong>Horse level ${growth.levels?`${fmt(growth.before.level)} → ${fmt(growth.after.level)}`:fmt(growth.after.level)}</strong><span>+${fmt(growth.horseXp)} horse XP saved</span></div><div class="td-xp-bar" role="progressbar" aria-label="Horse level XP" aria-valuemin="0" aria-valuemax="${growth.atMax?1:growth.nextLevelXp}" aria-valuenow="${growth.atMax?1:Math.min(growth.nextLevelXp,growth.after.xp)}" aria-valuetext="${growth.atMax?'Maximum horse level reached':`${fmt(growth.after.xp)} of ${fmt(growth.nextLevelXp)} XP toward horse level ${fmt(growth.after.level+1)}`}"><i style="width:${growth.percent}%"></i></div><small>${growth.atMax?`Maximum horse level: ${fmt(growth.maxLevel)}`:`${fmt(growth.after.xp)} / ${fmt(growth.nextLevelXp)} XP toward horse Lv ${fmt(growth.after.level+1)}`}</small>${Object.keys(growth.statGains).length?`<small class="td-level-bonus">Level-up bonus: ${Object.entries(growth.statGains).map(([k,n])=>'+'+fmt(n)+' '+esc(LABELS[k])).join(' · ')}</small>`:''}</section>`:'';
  const progressNote=v.trainingHint?esc(v.trainingHint):v.capped?(v.jumping?'<strong>Current training ceiling reached.</strong> You can keep practicing. No stat XP is added while this horse is at its ceiling.':'<strong>Current training ceiling reached.</strong> A higher horse level may unlock more room; breed limits still apply.'):r.statRaised?`<strong>${esc(v.stat)} increased.</strong> Your remaining XP is kept toward the next point.`:v.jumping?'Your earned XP is kept toward the next stat point.':'Your XP is kept toward the next stat point. Follow the gold ring and take each turn at a steady pace.';
  const jumpNote=v.jumping?`<p class="td-result-note">${v.cleanJumps?fmt(v.cleanJumps)+' clean jump'+(v.cleanJumps===1?'':'s')+' recorded.':r.completed?'All '+fmt(total)+' jumps cleared.':'Every cleared jump counts toward the rewards shown here.'} ${v.misses?fmt(v.misses)+' missed approach'+(v.misses===1?'':'es')+'. Circle back and line up again; a miss does not undo your cleared jumps.':'Keep a steady approach and give your horse room to land.'}</p>`:'';
  const savedBody=`<div class="td-result-grid">${progress}<div class="td-tallies"><div class="td-tally"><strong>+${fmt(v.coins)}</strong><span>coins saved</span></div><div class="td-tally"><strong>${fmt(cleared)} / ${fmt(total)}</strong><span>${v.unit} cleared</span></div></div></div>${growthBar}<p class="td-result-note">${progressNote}${v.passPoints?` +${fmt(v.passPoints)} pass points saved.`:''}</p>${jumpNote}`;
  const pendingBody=`<div class="td-pending" role="status"><strong>${fmt(cleared)} / ${fmt(total)} ${v.unit} completed. Your ride is kept in this tab.</strong><p>Retry saving to confirm your horse XP, stat XP and coins. Keep this tab open until it succeeds.</p>${r.reason?`<small>${esc(r.reason)}</small>`:''}</div>`;
  const destination=eventTarget?`<p class="td-result-note td-event-target">Training for <strong>${esc(eventTarget.eventName)}</strong>. ${v.saved?"Return to check your horse’s updated readiness.":"Save this training before returning to check readiness."}</p>`:'';
  const backButton=v.saved&&eventTarget?`<button type="button" class="td-primary" data-fx="training:event">Back to ${esc(eventTarget.eventName)}</button>`:'';
  return `<section class="td-result" aria-labelledby="trainingResultTitle"><header class="td-result-head"><div><div class="td-eyebrow">${v.jumping?'Jump clinic':'Training · '+esc(v.stat)} · ${v.saved?'saved':'save pending'}</div><h1 id="trainingResultTitle">${title}</h1><p class="td-horse">${esc(v.horse)} · ${fmt(r.elapsed)}s of riding</p></div><button type="button" class="td-close" data-fx="training:close" aria-label="Back to riding">×</button></header>${v.saved?savedBody:pendingBody}${destination}<div class="td-actions">${backButton}${v.saved?`<button type="button" class="${eventTarget?'':'td-primary'}" data-fx="training:again"${canRepeat(r)?'':' disabled title="Choose a horse with room to train this stat."'}>${r.stat==='jump'?'Practice again':selection.atCap?'Stat at current ceiling':'Train again'}</button><button type="button" data-fx="training:choose">Choose another stat</button>`:'<button type="button" class="td-primary" data-fx="training:retry-save">Retry save</button><button type="button" data-fx="training:choose" disabled title="Save this training before starting another session.">Choose another stat</button>'}<button type="button" data-fx="training:close">Back to riding</button></div>${v.saved&&selection.horse?.id!==r.horseId?`<p class="td-next-horse">Next session: ${esc(selection.horse?.name||'your current horse')} · ${esc(v.stat)}</p>`:''}</section>`;
 }
 G.ui.panel({id:'trainingResultPanel',title:'Training result',render:resultMarkup});
 const panel=$('trainingResultPanel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','trainingResultTitle');
 const isOpen=()=>panel.style.display==='flex';G.seFrame?.screens.add(isOpen);
 new MutationObserver(()=>G.seFrame?.settle()).observe(panel,{attributes:true,attributeFilter:['style']});
 function closeResult(){clearTimeout(resultTimer);panel.style.display='none';if(panel.contains(document.activeElement))document.activeElement.blur();G.seFrame?.settle();paint();}
 function showResult(r){if(!r)return;receipt=r;clearTimeout(resultTimer);disposeGuide();paint();G.ui.open(panel.id);G.seFrame?.settle();panel.querySelector('.td-primary:not(:disabled),[data-fx="training:choose"]:not(:disabled),.td-close')?.focus({preventScroll:true});}
 function scheduleResult(r){
  if(eventTarget){if(r.stat!==eventTarget.stat||r.horseId!==eventTarget.horseId||eventTarget.runId&&eventTarget.runId!==r.runId)eventTarget=null;else eventTarget.runId=r.runId;}
  receipt=r;clearTimeout(resultTimer);resultTimer=setTimeout(()=>{if(!getState().active)showResult(r);},0);paint();}
 function choose(){if(getState().pending)return;eventTarget=null;closeResult();G.ui.openEvents();setTimeout(()=>{G.seEvents?.openPage('__drill');G.seFrame?.settle();},0);}
 // A destination belongs to a successfully started session. It survives repeat
 // and a pending-save retry, but never leaks into unrelated free practice.
 function startForEvent(stat,target){
  if(!LABELS[stat]||!target?.eventId||!target.eventName||typeof target.onBack!=='function'||getState().active||getState().pending)return false;
  const next={eventId:target.eventId,eventName:String(target.eventName),difficulty:target.difficulty,onBack:target.onBack,stat,horseId:G.horse.ridden?.()?.id,runId:null};
  launchTarget=next;
  try{return C.startDrill(stat)===true;}finally{launchTarget=null;}
 }
 function returnToEvent(){
  if(!eventTarget||getState().active||getState().pending||receipt?.saved===false)return false;
  const target=eventTarget;eventTarget=null;closeResult();target.onBack();return true;
 }
 function repeat(){
  if(!receipt?.saved||!canRepeat(receipt))return;
  const previous=receipt;launchTarget=eventTarget?{...eventTarget,horseId:G.horse.ridden?.()?.id,runId:null}:null;
  closeResult();try{if(!C.startDrill(previous.stat))showResult(previous);}finally{launchTarget=null;}paint();
 }
 G.ui.action('training',([action])=>{
  if(action==='close')closeResult();
  else if(action==='retry-save')C.retryDrillSave();
  else if(action==='choose')choose();
  else if(action==='event')returnToEvent();
  else if(action==='again')repeat();
 });
 refs.end.onclick=()=>{C.cancelDrill();paint();};refs.pending.onclick=()=>showResult(pendingReceipt(getState()));
 // Buttons retain native Enter/Space activation without forwarding it to riding.
 for(const element of [hud,panel])element.addEventListener('keydown',event=>{if(event.target.closest('button')&&['Space','Enter'].includes(event.code))event.stopPropagation();});
 panel.addEventListener('keydown',event=>{if(event.code!=='Tab')return;const buttons=[...panel.querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
 G.on('escape',()=>{if(!isOpen())return false;closeResult();return true;});

 function disposeGuide(){
  if(!guide)return;G.scene.remove(guide.group);
  for(const geometry of guide.geometries)geometry.dispose();for(const material of guide.materials)material.dispose();
  guide=null;guideKey='';
 }
 function createGuide(points){
  disposeGuide();if(!points.length)return;
  const group=new T.Group();group.name='Training arrival rings';
  const materials=[0xf1d48c,0xb9ceaa,0x6f897b,0x739064].map((color,i)=>new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:[.95,.46,.16,.12][i],depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  const geometries=[],rings=[];
  for(const point of points){
   const geometry=new T.RingGeometry(3.49,3.6,64);geometry.rotateX(-Math.PI/2);
   const p=geometry.attributes.position,ground=G.world.groundH(point.x,point.z);
   for(let i=0;i<p.count;i++)p.setY(i,G.world.groundH(point.x+p.getX(i),point.z+p.getZ(i))-ground+.055);
   geometry.computeBoundingSphere();const ring=new T.Mesh(geometry,materials[2]);ring.position.set(point.x,ground,point.z);ring.renderOrder=2;group.add(ring);rings.push(ring);geometries.push(geometry);
  }
  const geometry=new T.BufferGeometry(),positions=new Float32Array(2*12*2*3);geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setDrawRange(0,0);geometries.push(geometry);
  const lineMaterial=new T.LineBasicMaterial({color:0xe8d29c,transparent:true,opacity:.46,depthWrite:false});materials.push(lineMaterial);
  const line=new T.LineSegments(geometry,lineMaterial);line.frustumCulled=false;group.add(line);G.scene.add(group);
  guide={group,rings,geometries,materials,line,positions};
 }
 function paintGuide(state){
  if(!state.active||state.activity==='jump'){disposeGuide();return;}
  const points=(state.points||[]).slice(0,8).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
  const key=points.map(p=>p.x+','+p.z).join('|');if(!guide||key!==guideKey){createGuide(points);guideKey=key;}if(!guide)return;
  const next=Math.max(0,Math.min(points.length,finite(state.cleared))),rider=G.horse.player.pos;
  guide.rings.forEach((ring,i)=>{ring.material=guide.materials[i<next||points[i].cleared?3:i===next?0:i===next+1?1:2];});
  const route=[{x:rider.x,z:rider.z},...points.slice(next,next+2)];let offset=0;
  for(let j=1;j<route.length;j++)for(let k=0;k<12;k++)for(const f of [k/12,(k+1)/12]){
   const a=route[j-1],b=route[j],x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;
   guide.positions[offset++]=x;guide.positions[offset++]=G.world.groundH(x,z)+.07;guide.positions[offset++]=z;
  }
  guide.line.geometry.attributes.position.needsUpdate=true;guide.line.geometry.setDrawRange(0,offset/3);
 }
 function paint(){
  const s=getState(),pending=!!s.pending,active=!!s.active;
  if(wasActive&&!active&&!pending&&!receipt&&eventTarget){const target=eventTarget;setTimeout(()=>{if(eventTarget===target&&!getState().active&&!getState().pending&&!receipt)returnToEvent();},0);}
  wasActive=active;
  document.body.classList.toggle('training-active',active||pending);hud.style.display=active||pending?'block':'none';paintGuide(s);
  if(!active&&!pending){lastSignature='';return;}
  const r=pendingReceipt(s),stat=LABELS[s.stat||r?.stat]||'Training',jumping=(pending?r?.activity:s.activity)==='jump',unit=jumping?'jumps':'cones';
  hud.setAttribute('data-activity',jumping?'jump':'slalom');
  text(refs.stat,jumping?'Jump clinic':stat+' training');text(refs.horse,(s.horseName||r?.horseName||'Your horse')+(eventTarget?' · Preparing for '+eventTarget.eventName:''));
  refs.end.hidden=!active;refs.pending.hidden=!pending;
  const countdown=Math.max(0,finite(s.countdown)),total=Math.max(1,finite(s.total,8)),cleared=Math.max(0,Math.min(total,finite(s.cleared,r?.cleared||0)));
  text(refs.target,pending?'Your ride is kept':s.paused?'Training paused':countdown>0?'Ready in '+Math.ceil(countdown):jumping?'Fence '+(s.clinic?.obstacle?.number||cleared%4+1)+' · Lap '+(s.clinic?.obstacle?.lap||Math.floor(cleared/4)+1)+'/2':'Cone '+Math.min(total,cleared+1)+' of '+total);
  text(refs.time,pending?'Save pending':Math.ceil(Math.max(0,finite(s.timeRemaining,jumping?120:55)))+'s left');
  const jumpCue=typeof s.clinic?.cue==='string'&&s.clinic.cue?s.clinic.cue:'Follow the approach markers, jump in the takeoff band, then land.';
  text(refs.cue,pending?'Keep this tab open. Retry saving your horse XP, stat XP and coins.':s.paused?'Return to riding to continue. Your timer is paused.':countdown>0?(jumping?'Face the first fence. Follow its takeoff cue, then land.':'Face the gold ring. Training begins after the countdown.'):jumping?jumpCue:'Ride into each gold ring in order. Menus pause your timer.');
  const signature=unit+':'+total+':'+cleared+':'+pending;
  if(signature!==lastSignature){refs.progress.innerHTML=Array.from({length:Math.min(8,total)},(_,i)=>'<i class="'+(i<cleared?'done':i===cleared&&!pending?'next':'')+'"></i>').join('');refs.progress.setAttribute('aria-label',cleared+' of '+total+' '+unit+' cleared');lastSignature=signature;}
 }
 G.on('drillStart',()=>{clearTimeout(resultTimer);receipt=null;eventTarget=launchTarget;paint();});
 G.on('drillFinish',scheduleResult);G.on('drillSavePending',scheduleResult);
 G.on('tick',dt=>{elapsed+=Math.max(0,finite(dt));if(elapsed<.1)return;elapsed=0;paint();});
 G.on('state',s=>{s.trainingUI={resultOpen:isOpen(),receipt:receipt?.runId||null,guideRings:guide?.rings.length||0,guideRadius:3.6,eventTarget:eventTarget?{eventId:eventTarget.eventId,difficulty:eventTarget.difficulty,stat:eventTarget.stat}:null};});
 G.trainingDrills={startForEvent,returnToEvent,showResult:()=>showResult(pendingReceipt(getState())||getState().lastResult||receipt),choose,refresh:paint};
 paint();
}
