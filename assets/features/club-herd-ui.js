/* Presentation for the shared herd controller. Membership, movement, readiness,
   and personal records remain owned by G.clubHerd. */
export const id='club-herd-ui';
export function install(G){
 const H=G.clubHerd,U=G.ui;if(!H||!U)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const seconds=v=>Math.max(0,Number.isFinite(v)?v:0).toFixed(1)+'s';
 const roster=c=>Array.isArray(c?.roster)?c.roster:[];
 const readyCount=c=>roster(c).filter(r=>r.ready&&r.online!==false).length;
 const snapshot=()=>H.snapshot();
 let receipt=null,resultTimer=0,tick=0,ridingId=null,resultStamp='';
 const style=document.createElement('style');style.id='clubHerdStyle';style.textContent=`
 .ch-herd{margin:0 0 24px;padding:24px;border:1px solid #b5c4ad;border-radius:12px;background:linear-gradient(125deg,#e5edda,#fff9e9);color:#294c39;min-width:0;overflow-wrap:anywhere}.ch-herd *{box-sizing:border-box}.ch-herd h2{margin:6px 0 10px;font:600 30px Georgia,serif}.ch-herd h3{margin:0 0 8px;font-size:17px}.ch-herd p{margin:8px 0;line-height:1.55}.ch-herd-kicker{text-transform:uppercase;letter-spacing:.1em;font-size:11px;font-weight:800}.ch-herd-intro{max-width:660px}.ch-herd-note{font-size:13px;color:#55705b}.ch-herd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ch-herd-actions>button{flex:0 1 auto;white-space:normal}.ch-herd button,.herd-result button,#clubHerdHud button{font:700 14px system-ui;min-height:44px;padding:10px 15px;border:1px solid #879f7a;border-radius:8px;background:#fffbee;color:#294c39;cursor:pointer;touch-action:manipulation}.ch-herd button.primary,.herd-result button.primary{background:#315d43;color:#fff9e9;border-color:#315d43}.ch-herd button:disabled,.herd-result button:disabled{opacity:.55;cursor:default}.ch-herd button:focus-visible,.herd-result button:focus-visible,#clubHerdHud button:focus-visible{outline:3px solid #d8ad55;outline-offset:3px}.ch-herd-party{margin-top:18px;border-top:1px solid #bdcab3;padding-top:18px}.ch-herd-party-head{display:flex;gap:8px;align-items:baseline;justify-content:space-between;flex-wrap:wrap}.ch-herd-count{font-size:13px;font-weight:750}.ch-herd-roster{list-style:none;margin:12px 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px}.ch-herd-roster li{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #cbd5bf;min-width:0}.ch-herd-roster strong{font-size:14px;min-width:0;overflow-wrap:anywhere}.ch-herd-roster small{font-size:12px;text-align:right;flex-shrink:0}.ch-herd-roster .is-ready{color:#376b42}.ch-herd-consent{padding:10px 12px;background:#fffbed;border-left:3px solid #b3944b;font-size:13px;line-height:1.5}.ch-herd-lobbies{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px;margin-top:18px}.ch-herd-lobby{padding:14px;border:1px solid #c3cfb7;border-radius:9px;background:#fffdf4;min-width:0}.ch-herd-lobby .ch-herd-roster{grid-template-columns:1fr}.ch-herd-lobby button{width:100%}.ch-herd-message{padding:10px 12px;background:#f2e8ca;border-radius:7px;font-size:13px}
 #clubHerdHud{position:fixed;top:22px;left:50%;transform:translateX(-50%);width:min(390px,calc(100vw - 440px));padding:12px 14px;border:1px solid #91a47b;border-radius:12px;background:#193e34f2;color:#fff9e9;box-shadow:0 6px 22px #16382a22;z-index:7;box-sizing:border-box;font:13px system-ui;overflow-wrap:anywhere}#clubHerdHud[hidden]{display:none!important}.herd-hud-top{display:flex;gap:8px;align-items:center;justify-content:space-between}.herd-hud-heading{min-width:0}.herd-hud-heading>strong{display:block;font-size:12px;letter-spacing:.04em}.herd-hud-count{font-size:22px;font-weight:800}.herd-hud-time{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}.herd-hud-hint{margin:8px 0 6px;font-size:12px;line-height:1.45;color:#e5edcf}.herd-hud-roster{margin:0;padding-top:7px;border-top:1px solid #ffffff28;color:#e5edcf;font-size:11px;line-height:1.4}#clubHerdHud button{padding:6px 9px;background:#ffffff16;border-color:#ffffff55;color:#fff9e9;font-size:12px;flex-shrink:0}.club-herd-riding #questTrack,.club-herd-riding #sgFocus{display:none!important}body.se-screen-open #clubHerdHud,body.club-hub-open #clubHerdHud,body.freecam #clubHerdHud,body.posing #clubHerdHud{display:none!important}
 #clubHerdResultPanel{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;transform:none!important;margin:0!important;padding:24px!important;box-sizing:border-box;border:0!important;border-radius:0!important;background:radial-gradient(ellipse at top right,#dce9ce,transparent 60%),#f9f4e7!important;color:#294c39!important;z-index:14!important;overflow:auto!important}#clubHerdResultPanel>.mk-x{display:none!important}.herd-result{width:min(620px,100%);margin:auto;min-width:0;overflow-wrap:anywhere;font-family:system-ui}.herd-result h1{font:600 clamp(32px,7vw,48px)/1.05 Georgia,serif;margin:12px 0}.herd-result>p{font-size:15px;line-height:1.6;color:#526a55}.herd-result-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.herd-result-stats>div{padding:18px;border:1px solid #c4d0b7;border-radius:12px;background:#fffdf6}.herd-result-stats strong{display:block;font-size:32px;font-variant-numeric:tabular-nums}.herd-result-stats small{display:block;margin-top:6px;font-size:12px;line-height:1.4}.herd-result-team{padding:14px 16px;border-radius:9px;background:#e6eddc;line-height:1.65}.herd-result-team strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.herd-result-save{padding:14px 16px;border-left:3px solid #77985d;background:#e6eddc;margin-top:16px;font-size:14px;line-height:1.55}.herd-result-save.pending{border-color:#b3944b;background:#f3e8ca}.herd-result .ch-herd-actions{margin-top:20px}.herd-result .ch-herd-actions>button{flex:1 1 140px;min-height:46px}
 @media(max-width:800px){#clubHerdHud{top:135px;width:min(390px,calc(100vw - 28px))}}
 @media(max-width:600px){.ch-herd{padding:17px;margin-bottom:18px}.ch-herd h2{font-size:25px}.ch-herd-roster{grid-template-columns:1fr}.ch-herd-actions>button{flex:1 1 120px}.ch-herd-lobbies{grid-template-columns:1fr}#clubHerdResultPanel{padding:20px!important}.herd-result-stats{gap:9px}.herd-result-stats>div{padding:14px 12px}.herd-result-stats strong{font-size:27px}.herd-result .ch-herd-actions{flex-direction:column}.herd-result .ch-herd-actions>button{flex:auto;width:100%}}
 @media(max-height:520px) and (min-width:600px){#clubHerdHud{top:12px;width:280px;max-width:calc(100vw - 280px);padding:8px 11px}.herd-hud-count{font-size:18px}.herd-hud-hint{margin:5px 0;font-size:11px}.herd-hud-roster{padding-top:5px;font-size:10px}.herd-result h1{font-size:32px}.herd-result-stats{margin:14px 0}.herd-result-stats>div{padding:12px}.herd-result .ch-herd-actions{margin-top:14px}.herd-result>p{margin:8px 0}}
 `;document.head.append(style);
 function button(action,label,{disabled=false,primary=false,attrs=''}={}){return '<button type="button" data-fx="clubherd:'+action+'"'+(primary?' class="primary"':'')+(disabled?' disabled':'')+(attrs?' '+attrs:'')+'>'+esc(label)+'</button>';}
 function people(c,live=false){return '<ul class="ch-herd-roster">'+roster(c).map(r=>'<li><strong>'+esc(r.name)+(r.id===c.hostId?' <small>Host</small>':'')+'</strong><small class="'+(r.ready&&r.online!==false?'is-ready':'')+'">'+(r.online===false?'Offline':c.status==='finished'?'Finished':live?'Riding':r.ready?'Ready':'Getting ready')+'</small></li>').join('')+'</ul>';}
 function section(){
  const s=snapshot(),c=s.current,available=s.connected&&!!s.code,others=(s.lobbies||[]).filter(l=>l.id!==c?.id);
  let body='';
  if(c){
   const waiting=c.status==='waiting',finished=c.status==='finished',live=c.status==='riding';
   const label=waiting?'Gather your team':finished?'Everyone is home':live?'Your herd drive':'Herd drive ended';
   let actions='';
   if(waiting){actions=button('ready',c.ready?'Not ready':'Ready',{disabled:!s.connected,primary:!c.ready,attrs:'aria-pressed="'+!!c.ready+'"'})+(c.hosted?button('start','Start herd drive',{disabled:!s.connected||!c.canStart,primary:true}):'');}
   else if(c.riding&&live)actions=button('return','Return to the herd',{primary:true});
   else if(finished&&s.lastResult)actions=button('result','View your time',{primary:true});
   actions+=button(c.hosted?'stop':'leave',c.hosted?(waiting?'Close gathering':'End herd drive'):'Leave');
   body='<div class="ch-herd-party"><div class="ch-herd-party-head"><h3>'+label+'</h3><span class="ch-herd-count">'+(waiting?readyCount(c)+' / '+roster(c).length+' ready':Math.min(c.penned||0,5)+' / 5 home')+'</span></div><p class="ch-herd-note">Hosted by '+esc(c.host)+' · '+roster(c).length+' / 4 riders</p>'+people(c,live)+(waiting?'<p class="ch-herd-consent">'+(c.hosted?'Hosting marks you Ready. Start once your team is ready, or choose Not ready to wait.':'Choose Ready to enter the pasture when '+esc(c.host)+' starts. You can choose Not ready while you wait.')+'</p><p class="ch-herd-note">'+(c.canStart?'Your team is ready to ride.':readyCount(c)<2?'At least two connected riders must be ready.':readyCount(c)<roster(c).length?'Waiting for every rider to be connected and ready.':'Waiting for the host to start.')+'</p>':c.waitingForRiders?'<p class="ch-herd-message">Gathering riders in the pasture. Your shared clock starts when everyone arrives.</p>':c.waitingForHost?'<p class="ch-herd-message">Waiting for '+esc(c.host)+'. Your shared clock is paused.</p>':c.paused?'<p class="ch-herd-message">'+(c.hosted?'Your team is paused while your screen is open. Return to the herd to continue.':'The host has paused. Your shared clock is waiting.')+'</p>':'')+'<div class="ch-herd-actions">'+actions+'</div></div>';
  }else body='<p class="ch-herd-note">Hosting marks you Ready. You choose when to start with your team.</p><div class="ch-herd-actions">'+button('host','Host herd drive',{disabled:!available,primary:true})+(s.lastResult?button('result','Last herd drive'):'')+'</div>';
  const lobbies=others.length?'<div class="ch-herd-lobbies">'+others.map(l=>'<article class="ch-herd-lobby"><h3>Ride with '+esc(l.host)+'</h3><p class="ch-herd-note">'+(l.status==='waiting'?readyCount(l)+' / '+roster(l).length+' ready · '+roster(l).length+' / 4 riders':l.status==='riding'?'Herd drive in progress':'Herd drive finished')+'</p>'+people(l,l.status==='riding')+button('join','Join',{disabled:!available||!!c||!l.canJoin,primary:true,attrs:'data-herd-id="'+esc(l.id)+'"'})+'</article>').join('')+'</div>':'';
  return '<section class="ch-herd" aria-label="Club herd drive"><span class="ch-herd-kicker">Cooperative practice · 2–4 riders</span><h2>Guide the herd together</h2><p class="ch-herd-intro">Guide five horses together. One rider leads from behind while teammates cover the sides. Beat your shared time.</p><p class="ch-herd-note">Save your best shared time as a separate personal record.</p>'+(!available?'<p class="ch-herd-message">'+esc(s.reason||'Connect with your club to gather a team.')+'</p>':'')+(s.notice?'<p class="ch-herd-message" role="status">'+esc(s.notice)+'</p>':'')+body+lobbies+'</section>';
 }
 // The existing clubhouse can refresh meaningful lobby changes without replacing
 // focused controls for every elapsed-time or position broadcast.
 function sectionKey(){const s=snapshot(),c=s.current;return JSON.stringify({connected:s.connected,reason:s.reason,code:s.code,notice:s.notice,lobbies:(s.lobbies||[]).map(l=>({id:l.id,host:l.host,hostId:l.hostId,status:l.status,canJoin:l.canJoin,roster:l.roster})),current:c&&{id:c.id,host:c.host,hostId:c.hostId,status:c.status,hosted:c.hosted,ready:c.ready,canStart:c.canStart,riding:c.riding,paused:c.paused,waitingForRiders:c.waitingForRiders,waitingNames:c.waitingNames,waitingForHost:c.waitingForHost,penned:c.penned,roster:c.roster},result:s.lastResult});}
 function rideView(){G.hidePanels();G.riding?.releaseAll();document.activeElement?.blur?.();G.seFrame?.settle();}
 function command(action,el){
  if(action==='return'){rideView();return;}
  if(action==='close'||action==='activities'){
   if(snapshot().current?.status==='finished'){const ended=H.stop();if(ended?.ok===false){G.toast(ended.reason||'The herd drive could not be closed.');return;}}
   G.hidePanels();if(action==='activities')G.clubHub?.open('activities');G.seFrame?.settle();return;
  }
  if(action==='result'){showResult(snapshot().lastResult||receipt);return;}
  let result;
  if(action==='ready')result=H.ready(!snapshot().current?.ready);
  else if(action==='join')result=H.join(el?.dataset.herdId);
  else if(action==='save')result=H.retrySave();
  else if(['host','start','leave','stop','again'].includes(action))result=H[action]();
  else return;
  if(result===false||result?.ok===false){G.toast(result?.reason||'The herd drive could not be updated. Try again.');paint();return;}
  if(action==='again'){clearTimeout(resultTimer);G.hidePanels();G.clubHub?.open('activities');}
  paint();G.seFrame?.settle();
 }
 U.action('clubherd',([action],el)=>command(action,el));
 function renderResult(){
  const r=snapshot().lastResult||receipt;if(!r)return '';
  const saved=r.saved===true,best=Number.isFinite(r.bestTime)&&r.bestTime>0?r.bestTime:null;
  const status=saved?(r.newBest?'New personal best · saved':'Your herd drive time is saved.'):(r.reason||'Your time is waiting to save. Keep this tab open and retry.');
  const actions=(saved?'':button('save','Retry save',{primary:true}))+button('again','Ride again',{disabled:!saved,primary:saved})+button('activities','Back to club')+button('close','Free ride');
  return '<div class="herd-result"><span class="ch-herd-kicker">Club herd drive · Together</span><h1>All five are home.</h1><p>You brought the herd home as a team. Find your next rhythm and beat this time together.</p><div class="herd-result-stats"><div><strong>'+seconds(r.elapsed)+'</strong><small>Your shared time · '+r.penned+' / '+r.total+' home</small></div><div><strong>'+(saved&&best?seconds(best):'—')+'</strong><small>Your personal best'+(!saved?' · waiting to save':'')+'</small></div></div><div class="herd-result-team"><strong>Your team</strong>'+esc((r.participants||[]).join(' · '))+'</div><div class="herd-result-save'+(saved?'':' pending')+'" role="status">'+esc(status)+'</div><p>Cooperative practice keeps its own time records. Ride together for a faster finish.</p><div class="ch-herd-actions">'+actions+'</div></div>';
 }
 U.panel({id:'clubHerdResultPanel',title:'Herd drive complete',render:renderResult});
 const panel=document.getElementById('clubHerdResultPanel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Club herd drive result');
 G.seFrame?.screens.add(()=>panel.style.display==='flex');new MutationObserver(()=>G.seFrame?.settle()).observe(panel,{attributes:true,attributeFilter:['style']});
 function refreshResult(){if(panel.style.display!=='flex')return;const focused=panel.contains(document.activeElement)?document.activeElement?.dataset.fx:null,scroll=panel.scrollTop;U.rerender('clubHerdResultPanel');panel.scrollTop=scroll;if(focused)[...panel.querySelectorAll('[data-fx]')].find(b=>b.dataset.fx===focused&&!b.disabled)?.focus({preventScroll:true});}
 function showResult(r){if(!r)return;receipt=r;clearTimeout(resultTimer);resultTimer=setTimeout(()=>{const s=snapshot();if(s.lastResult?.runId!==r.runId||s.current?.riding&&s.current.status==='riding'||s.current?.status==='waiting')return;U.open('clubHerdResultPanel');G.riding?.releaseAll();G.seFrame?.settle();},0);}
 const hud=document.createElement('aside');hud.id='clubHerdHud';hud.hidden=true;hud.setAttribute('aria-label','Shared herd drive progress');
 hud.innerHTML='<div class="herd-hud-top"><div class="herd-hud-heading"><strong>Club herd drive</strong><span class="herd-hud-count"></span></div><span class="herd-hud-time"></span><button type="button" id="clubHerdLeave" aria-label="Leave herd drive">Leave</button></div><p class="herd-hud-hint"></p><p class="herd-hud-roster"></p>';
 const fields={count:hud.querySelector('.herd-hud-count'),time:hud.querySelector('.herd-hud-time'),hint:hud.querySelector('.herd-hud-hint'),team:hud.querySelector('.herd-hud-roster')};
 hud.querySelector('button').onclick=e=>{command('leave');if(e.detail>0)e.currentTarget.blur();};document.body.append(hud);
 function paint(){
  const s=snapshot(),c=s.current,live=!!c?.riding&&c.status==='riding';
  if(live&&ridingId!==c.id){ridingId=c.id;clearTimeout(resultTimer);rideView();}else if(!live)ridingId=null;
  const visible=!!(live||c?.status==='riding'&&c.waitingForHost);hud.hidden=!visible;document.body.classList.toggle('club-herd-riding',visible);
  if(visible){
   const guide=c.guide;let hint='One rider leads from behind; teammates cover the sides.';
   if(c.waitingForRiders)hint=c.waitingNames?.length?'Gathering '+c.waitingNames.join(' and ')+'. Your shared clock has not started.':'Gathering riders in the pasture. Your shared clock has not started.';
   else if(c.waitingForHost)hint='Waiting for '+c.host+'. Your shared clock is paused.';
   else if(c.paused)hint=c.hosted?'Your team is paused. Close your screen to continue.':'The host has paused. Your shared clock is waiting.';
   else if(guide?.approachBlocked)hint='Circle around '+guide.name+' to find a clear approach.';
   else if(guide?.pressure==='guiding')hint='Good angle. Walk behind '+guide.name+' toward the pen.';
   else if(guide?.pressure==='too close')hint='Give '+guide.name+' a little room to turn.';
   else if(guide?.name)hint='Lead from behind '+guide.name+'. Teammates cover the sides.';
   const values={count:Math.min(c.penned||0,5)+' / 5 home',time:seconds(c.elapsed),hint,team:roster(c).map(r=>r.name+(r.online===false?' (offline)':'')).join(' · ')};
   for(const [key,value]of Object.entries(values))if(fields[key].textContent!==value)fields[key].textContent=value;
  }
  const stamp=JSON.stringify(s.lastResult);if(stamp!==resultStamp){resultStamp=stamp;refreshResult();}
 }
 G.on('clubHerdChanged',paint);G.on('clubHerdFinish',r=>{paint();showResult(r);});G.on('tick',dt=>{tick+=dt;if(tick>=.2){tick=0;paint();}});
 G.clubHerdUI={section,sectionKey,showResult:()=>showResult(snapshot().lastResult||receipt),state:()=>({open:panel.style.display==='flex',receiptId:(snapshot().lastResult||receipt)?.runId||null})};paint();
}
