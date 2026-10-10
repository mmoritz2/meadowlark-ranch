import {roundupPace,roundupNextAttempt} from '../roundup-presentation.mjs?v=gentle-herd-1';
/* Repeatable herding: a readable pressure target, medal targets, saved results, and a reason to ride again.
   The inline roundup owns horse movement, pen crossings, and its one payout transaction. */
export const id='roundup-upgrade';
export function install(G){
 const round=G.roundup;if(!round)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let receipt=null,tick=0,timer=0,penNotice=null;
 const style=document.createElement('style');style.textContent=`
 #roundupGuide{position:fixed;top:22px;left:50%;transform:translateX(-50%);z-index:7;width:min(400px,calc(100vw - 440px));background:#193d34f2;color:#fff9e9;padding:14px 16px;border-radius:14px;box-shadow:0 8px 24px #193d3426;font-family:inherit;display:none;box-sizing:border-box}
 #roundupGuide .round-top{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;font-size:12px;font-weight:750}#roundupGuide .round-main{font-size:22px;font-weight:850;margin:6px 0}#roundupGuide .round-hint{font-size:12px;line-height:1.5;color:#e5edcf}#roundupGuide .round-time{font-variant-numeric:tabular-nums;color:#efdba0}#roundupGuide button{border:1px solid #ffffff44;background:#ffffff15;color:white;padding:5px 8px;border-radius:7px;min-height:44px;font:inherit;font-size:11px;cursor:pointer}
 #roundupGuide .round-target{font-size:13px;font-weight:800;color:#f3d885;margin:3px 0 5px}#roundupGuide[data-pressure="guiding"] .round-target{color:#b8e7a0}#roundupGuide[data-pressure="too close"] .round-target,#roundupGuide[data-pressure="blocked"] .round-target{color:#ffc596}#roundupGuide .round-note{font-size:12px;color:#c4e7b3;line-height:1.4;margin-top:6px}#roundupGuide .round-note:empty{display:none}
 #roundupGuide .round-pace{border-top:1px solid #ffffff28;margin-top:8px;padding-top:8px;font-size:11px;line-height:1.45;color:#f0dda7}#roundupGuide .round-pace small{display:block;color:#e5edcf;font-size:11px}#roundupGuide[data-pending="true"] .round-main{font-size:18px}.round-next{padding:14px 16px;border:1px solid #cad5ba;border-radius:12px;margin-top:14px;background:#fffdf7}.round-next strong{display:block}.round-next p{margin:5px 0 0;font-size:13px}.round-pending{background:#f2e5c8;border-color:#c7a768}.round-saved{font-size:12px;font-weight:750;color:#58794d;margin-top:12px}
 .roundup-active #roundHud,.roundup-active #rushQuick,.roundup-active #questTrack,.roundup-active #sgFocus{display:none!important}
 #roundupResultPanel{position:fixed!important;inset:0!important;max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;transform:none!important;margin:0!important;padding:22px!important;background:radial-gradient(ellipse at top right,#d3e1c7,transparent 60%),#f7f2e6!important;border:0!important;border-radius:0!important;color:#234536!important;box-sizing:border-box;z-index:14!important;overflow:auto!important}
 #roundupResultPanel>.mk-x{display:none!important}.round-recap{width:min(640px,100%);margin:auto;font-family:inherit}.round-recap h1{font-size:clamp(32px,6vw,48px);letter-spacing:-.035em;line-height:1.05;margin:12px 0}.round-eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:800;color:#64816a}.round-recap p{line-height:1.6;color:#4e6757;font-size:15px}.round-recap .round-results{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.round-results>div{background:#fffdf7;border:1px solid #d6d8be;border-radius:12px;padding:18px 12px}.round-results b{display:block;font-size:29px;margin-bottom:6px}.round-results small{font-size:11px;color:#60765f}.round-earned{padding:16px;border-left:3px solid #6f995d;background:#e5ecd9;font-size:15px;line-height:1.65}.round-buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.round-recap button{min-height:46px;padding:12px 16px;border:1px solid #b9c8ad;border-radius:10px;background:#fffaf0;color:#29513d;font:750 14px inherit;cursor:pointer;flex:1}.round-recap button:first-child{background:#285940;color:#fff7e6;border-color:#285940}.round-recap button:focus-visible{outline:3px solid #dbb654;outline-offset:3px}
 body.se-screen-open #roundupGuide,body.freecam #roundupGuide,body.posing #roundupGuide{display:none!important}
 @media(max-width:800px){#roundupGuide{top:135px;width:min(400px,calc(100vw - 28px))}.round-recap .round-results{gap:7px}.round-results>div{padding:15px 9px}.round-results b{font-size:24px}.round-buttons{flex-direction:column}}
 @media(max-width:380px){.round-results b{font-size:20px}.round-results>div{padding:14px 7px}#roundupResultPanel{padding:18px!important}}
 @media(max-height:520px) and (min-width:600px){#roundupGuide{top:12px;left:50%;width:330px;max-width:calc(100vw - 440px);padding:8px 12px}.round-main{font-size:18px!important;margin:4px 0!important}.round-recap{max-width:760px}.round-recap h1{font-size:30px}.round-recap .round-results{margin:12px 0}.round-results>div{padding:10px}.round-buttons{margin-top:12px;flex-direction:row}.round-recap p{margin:8px 0}}
 `;document.head.append(style);
 G.ui.panel({id:'roundupResultPanel',title:'Roundup complete',render(){
  const r=round.state().pending||receipt;if(!r)return '';
  const pending=r.saved!==true,all=r.penned===r.total,next=roundupNextAttempt(r);
  const medal=r.medal==='none'?'Practice round':r.medal[0].toUpperCase()+r.medal.slice(1)+' roundup';
  const rewards=[r.pay+' coins',r.gems?r.gems+' gem'+(r.gems===1?'':'s'):'',r.keys?r.keys+' key'+(r.keys===1?'':'s'):'',r.passPoints?r.passPoints+' pass points':''].filter(Boolean).join(' · ');
  const title=pending?'Your ride is waiting to save.':all?'Everyone is home.':r.penned?'Every horse counts.':'Find your angle.';
  const intro=pending?'Keep this tab open. Retry saving this result before starting another roundup.':all?'You found the right angle and brought the herd home.':r.penned?'Each horse you brought home counts. Circle behind the others and give them room to turn.':'Try circling behind one horse, then guide it toward the green pen. Give it room to turn, and follow the gold ring when the approach is clear.';
  const bests=pending?'':[r.newBestMedal?'New best medal':null,r.newBestScore?'New best score':null,r.newBestTime?'New fastest full herd':null].filter(Boolean).join(' · ');
  const actions=pending?'<button data-fx="herd:save">Retry save</button><button data-fx="herd:close">Back to pasture</button>':`<button data-fx="herd:retry">Ride again</button><button data-fx="herd:${r.mode==='beginner'?'harder':'easier'}">${r.mode==='beginner'?'Try the full herd':'Try a gentle roundup'}</button><button data-fx="herd:activities">Choose an activity</button><button data-fx="herd:close">Free ride</button>`;
  return `<div class="round-recap"><div class="round-eyebrow">${esc(r.name)} · ${pending?'Save pending':medal}</div><h1>${title}</h1><p>${intro}</p><div class="round-results"><div><b>${r.penned} / ${r.total}</b><small>Horses brought home</small></div><div><b>${r.score.toLocaleString()}</b><small>Points · ${pending?'Result held for saving':r.medal==='none'?'First benchmark':esc(r.medal)+' medal'}</small></div><div><b>${r.time.toFixed(1)}s</b><small>Riding time</small></div></div><div class="round-earned${pending?' round-pending':''}" role="status"><strong>${pending?'Waiting to save':'Saved'} · ${esc(rewards)}</strong>${bests?'<br>'+esc(bests):''}</div><div class="round-next"><strong>${esc(next.title)}</strong><p>${esc(next.detail)}</p></div>${pending?'':(G.clubRallyUI?.receipt(r.runId)||'')+(G.riderJourneyUI?.summary()||'')}<div class="round-buttons">${actions}</div></div>`;
 }});
 const panel=document.getElementById('roundupResultPanel');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Roundup results');
 G.seFrame?.screens.add(()=>panel.style.display==='flex');new MutationObserver(()=>G.seFrame?.settle()).observe(panel,{attributes:true,attributeFilter:['style']});
 G.ui.action('herd',([action])=>{
  if(action==='save')round.retrySave();
  else if(action==='result')showResult(round.state().pending||receipt);
  else if(action==='retry'&&receipt?.saved)round.start(receipt.mode);
  else if(action==='harder')round.start('full');
  else if(action==='easier')round.start('beginner');
  else if(action==='activities'){G.hidePanels();G.rideHub?.open();}
  else if(action==='close')G.hidePanels();
  G.seFrame?.settle();
 });
 const hud=document.createElement('aside');hud.id='roundupGuide';hud.setAttribute('aria-label','Roundup progress and guidance');
 hud.innerHTML='<div class="round-top"><span class="round-name"></span><span class="round-time"></span><button type="button"></button></div><div class="round-main"></div><div class="round-target"></div><div class="round-hint"></div><div class="round-note" role="status" aria-live="polite"></div><div class="round-pace"><span></span><small></small></div>';
 const fields={name:hud.querySelector('.round-name'),time:hud.querySelector('.round-time'),button:hud.querySelector('button'),main:hud.querySelector('.round-main'),target:hud.querySelector('.round-target'),note:hud.querySelector('.round-note'),hint:hud.querySelector('.round-hint'),pace:hud.querySelector('.round-pace span'),detail:hud.querySelector('.round-pace small')};
 fields.button.onclick=()=>{const s=round.state();if(s.pending)showResult(s.pending);else round.cancel();};
 document.body.append(hud);
 const THREE=G.THREE,marker=new THREE.Mesh(new THREE.RingGeometry(.8,1.08,40),new THREE.MeshBasicMaterial({color:0xe3c977,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide}));
 marker.name='Roundup pressure position';marker.rotation.x=-Math.PI/2;marker.visible=false;G.scene.add(marker);
 const focus=new THREE.Mesh(new THREE.RingGeometry(1.3,1.42,40),new THREE.MeshBasicMaterial({color:0xe3c977,transparent:true,opacity:.68,depthWrite:false,side:THREE.DoubleSide}));
 focus.name='Horse to guide home';focus.rotation.x=-Math.PI/2;focus.visible=false;G.scene.add(focus);
 const mini={x:0,z:0,col:'#efcd72',r:3,hidden:()=>{const s=round.state();return !s.active||!s.target;}};G.world.miniMarkers.push(mini);
 const home=round.state().pen;G.world.miniMarkers.push({x:home.x,z:home.z,col:'#8bc67c',r:4,hidden:()=>!round.state().active});
 G.on('courseGate',()=>{if(round.state().active){G.toast(round.state().pending?'Save your roundup result before starting an event.':'Finish or leave your roundup before starting an event.');return true;}});
 G.on('emoteGate',()=>{if(round.state().active){G.toast('Bring the herd home first.');return true;}});
 G.on('roundupStart',()=>{clearTimeout(timer);receipt=null;penNotice=null;G.hidePanels();G.seFrame?.settle();paint();});
 G.on('roundupCancel',()=>{clearTimeout(timer);penNotice=null;paint();});
 G.on('roundupPen',r=>{penNotice={text:r.name+' is home!',until:Date.now()+4500};paint();});
 function showResult(r){if(!r)return;receipt=r;clearTimeout(timer);paint();timer=setTimeout(()=>{const s=round.state();if(s.pending?.runId===r.runId||!s.active&&s.lastResult?.runId===r.runId){G.ui.open('roundupResultPanel');G.seFrame?.settle();}},0);}
 G.on('roundupSavePending',showResult);G.on('roundupFinish',showResult);
 function paint(){
  const s=round.state(),pending=!!s.pending;document.body.classList.toggle('roundup-active',s.active);hud.style.display=s.active&&!s.shared?'block':'none';hud.dataset.pending=String(pending);hud.dataset.pressure=s.target?.pressure||'';marker.visible=!!(s.active&&!s.shared&&!pending&&s.target&&!s.target.approachBlocked);focus.visible=!!(s.active&&!s.shared&&!pending&&s.target);if(!s.active)return;
  const t=s.target;
  if(t){const color=t.pressure==='guiding'?0xa5d987:['too close','blocked'].includes(t.pressure)?0xf0a975:0xe3c977;if(!t.approachBlocked){marker.position.set(t.standX,G.world.groundH(t.standX,t.standZ)+.065,t.standZ);marker.material.color.set(color);}focus.position.set(t.x,G.world.groundH(t.x,t.z)+.07,t.z);focus.material.color.set(color);mini.x=t.x;mini.z=t.z;}
  const pace=roundupPace(s);
  const gentle=s.mode==='beginner',horseName=t?.name||'the next horse';
  const target=pending?'':t?`${gentle?'Guide':'Follow'} ${horseName}${gentle?' first':''} · ${{'guiding':'good spacing','too close':'give more room','turning':'turning','blocked':'path blocked'}[t.pressure]||'circle behind'}`:'';
  let hint=s.countdown>0?`Starting in ${Math.ceil(s.countdown)}. ${gentle?'Bring them home one at a time. ':''}Ride to the gold ring.`:t?.pressure==='guiding'?`${gentle?'Stay in a walk':'Keep pace'} behind ${horseName} toward the green pen.`:t?.pressure==='too close'?`Ease back. ${horseName} needs more room. The gold ring shows a calmer distance.`:t?.pressure==='turning'?`Good position. Give ${horseName} time to turn toward the pen.`:t?.pressure==='blocked'?`Give ${horseName} room to turn around the obstacle.`:`Circle to the gold ring behind ${horseName}, then ${gentle?'walk':'ride'} forward.`;
  if(t?.approachBlocked&&s.countdown<=0)hint=`Circle around ${t.name} to find a clear approach. The direct route is blocked.`;
  if(pending)hint='Your result is held. Keep this tab open and retry saving.';
  const values={name:s.name,time:pending?'Paused':Math.ceil(s.timeLeft)+'s',button:pending?'Result':'Leave',main:`${s.penned} of ${s.total} home`,target,note:!pending&&penNotice&&Date.now()<penNotice.until?penNotice.text:'',hint,pace:pace.label,detail:pace.detail};
  // Keep the focused/touched control alive as the countdown and hints update.
  for(const [key,value] of Object.entries(values))if(fields[key].textContent!==value)fields[key].textContent=value;
  fields.button.setAttribute('aria-label',pending?'View pending roundup result':'Leave roundup');
 }
 G.on('tick',dt=>{tick+=dt;if(tick<.15)return;tick=0;paint();});
 G.on('state',o=>{o.roundup=round.state();});
 G.roundupUI={showResult:()=>showResult(round.state().pending||round.state().lastResult||receipt),state:()=>({open:panel.style.display==='flex',pending:!!round.state().pending,receiptId:receipt?.runId||null})};paint();
}
