/* Repeatable herding: a readable pressure target, immediate results, and saved bests.
   The inline roundup owns horse movement, pen crossings, and its one payout transaction. */
export const id='roundup-upgrade';
export function install(G){
 const round=G.roundup;if(!round)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let receipt=null,tick=0,timer=0,last='';
 const style=document.createElement('style');style.textContent=`
 #roundupGuide{position:fixed;top:22px;left:50%;transform:translateX(-50%);z-index:7;width:min(400px,calc(100vw - 440px));background:#193d34f2;color:#fff9e9;padding:14px 16px;border-radius:14px;box-shadow:0 8px 24px #193d3426;font-family:inherit;display:none;box-sizing:border-box}
 #roundupGuide .round-top{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:750}#roundupGuide .round-main{font-size:22px;font-weight:850;margin:6px 0}#roundupGuide .round-hint{font-size:12px;line-height:1.5;color:#e5edcf}#roundupGuide .round-time{font-variant-numeric:tabular-nums;color:#efdba0}#roundupGuide button{border:1px solid #ffffff44;background:#ffffff15;color:white;padding:5px 8px;border-radius:7px;min-height:36px;font:inherit;font-size:11px;cursor:pointer}
 .roundup-active #roundHud,.roundup-active #rushQuick,.roundup-active #questTrack,.roundup-active #sgFocus{display:none!important}
 #roundupResultPanel{position:fixed!important;inset:0!important;max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;transform:none!important;margin:0!important;padding:22px!important;background:radial-gradient(ellipse at top right,#d3e1c7,transparent 60%),#f7f2e6!important;border:0!important;border-radius:0!important;color:#234536!important;box-sizing:border-box;z-index:14!important;overflow:auto!important}
 #roundupResultPanel>.mk-x{display:none!important}.round-recap{width:min(640px,100%);margin:auto;font-family:inherit}.round-recap h1{font-size:clamp(32px,6vw,48px);letter-spacing:-.035em;line-height:1.05;margin:12px 0}.round-eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:800;color:#64816a}.round-recap p{line-height:1.6;color:#4e6757;font-size:15px}.round-recap .round-results{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.round-results>div{background:#fffdf7;border:1px solid #d6d8be;border-radius:12px;padding:18px 12px}.round-results b{display:block;font-size:29px;margin-bottom:6px}.round-results small{font-size:11px;color:#60765f}.round-earned{padding:16px;border-left:3px solid #6f995d;background:#e5ecd9;font-size:15px;line-height:1.65}.round-buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.round-recap button{min-height:46px;padding:12px 16px;border:1px solid #b9c8ad;border-radius:10px;background:#fffaf0;color:#29513d;font:750 14px inherit;cursor:pointer;flex:1}.round-recap button:first-child{background:#285940;color:#fff7e6;border-color:#285940}.round-recap button:focus-visible{outline:3px solid #dbb654;outline-offset:3px}
 body.se-screen-open #roundupGuide,body.freecam #roundupGuide,body.posing #roundupGuide{display:none!important}
 @media(max-width:800px){#roundupGuide{top:135px;width:min(400px,calc(100vw - 28px))}.round-recap .round-results{gap:7px}.round-results>div{padding:15px 9px}.round-results b{font-size:24px}.round-buttons{flex-direction:column}}
 @media(max-width:380px){.round-results b{font-size:20px}.round-results>div{padding:14px 7px}#roundupResultPanel{padding:18px!important}}
 @media(max-height:520px) and (min-width:600px){#roundupGuide{top:12px;left:50%;width:330px;max-width:calc(100vw - 440px);padding:8px 12px}.round-main{font-size:18px!important;margin:4px 0!important}.round-recap{max-width:760px}.round-recap h1{font-size:30px}.round-recap .round-results{margin:12px 0}.round-results>div{padding:10px}.round-buttons{margin-top:12px;flex-direction:row}.round-recap p{margin:8px 0}}
 `;document.head.append(style);
 G.ui.panel({id:'roundupResultPanel',title:'Roundup complete',render(){
  const r=receipt;if(!r)return '';
  const all=r.penned===r.total,medal=r.medal==='none'?'Keep practicing':r.medal[0].toUpperCase()+r.medal.slice(1)+' roundup';
  return `<div class="round-recap"><div class="round-eyebrow">${esc(r.name)} · ${medal}</div><h1>${all?'Everyone is home.':'Every horse counts.'}</h1><p>${all?'You found the right angle and brought the herd home.':'Circle to the far side of a loose horse, then walk toward the pen behind it.'} ${r.newBestScore?'That is your new best score.':''}</p><div class="round-results"><div><b>${r.penned} / ${r.total}</b><small>Horses brought home</small></div><div><b>${r.score.toLocaleString()}</b><small>Points · ${r.medal==='none'?'First benchmark':esc(r.medal)+' medal'}</small></div><div><b>${r.time.toFixed(1)}s</b><small>${r.newBestTime?'New fastest full herd':'Riding time'}</small></div></div><div class="round-earned"><strong>+${r.pay} coins${r.gems?' · +'+r.gems+' gem'+(r.gems===1?'':'s'):''}${r.keys?' · +1 key':''}</strong><br>${all?'Bring them home with at least 35% of the clock left for gold.':'You keep the rewards for every horse you brought home.'}</div><div class="round-buttons"><button data-fx="herd:retry">Ride again</button><button data-fx="herd:${r.mode==='beginner'?'harder':'easier'}">${r.mode==='beginner'?'Try the full herd':'Try a gentle roundup'}</button><button data-fx="herd:activities">Choose an activity</button><button data-fx="herd:close">Free ride</button></div></div>`;
 }});
 const panel=document.getElementById('roundupResultPanel');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Roundup results');
 G.seFrame?.screens.add(()=>panel.style.display==='flex');new MutationObserver(()=>G.seFrame?.settle()).observe(panel,{attributes:true,attributeFilter:['style']});
 G.ui.action('herd',([action])=>{
  if(action==='retry'&&receipt)round.start(receipt.mode);
  else if(action==='harder')round.start('full');
  else if(action==='easier')round.start('beginner');
  else if(action==='activities'){G.hidePanels();G.rideHub?.open();}
  else if(action==='close')G.hidePanels();
  G.seFrame?.settle();
 });
 const hud=document.createElement('aside');hud.id='roundupGuide';hud.setAttribute('aria-label','Roundup progress and guidance');document.body.append(hud);
 const THREE=G.THREE,marker=new THREE.Mesh(new THREE.RingGeometry(.8,1.08,40),new THREE.MeshBasicMaterial({color:0xe3c977,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide}));
 marker.name='Roundup pressure position';marker.rotation.x=-Math.PI/2;marker.visible=false;G.scene.add(marker);
 const mini={x:0,z:0,col:'#efcd72',r:3,hidden:()=>!round.state().active};G.world.miniMarkers.push(mini);
 const home=round.state().pen;G.world.miniMarkers.push({x:home.x,z:home.z,col:'#8bc67c',r:4,hidden:()=>!round.state().active});
 G.on('courseGate',()=>{if(round.state().active){G.toast('Finish or leave your roundup before starting an event.');return true;}});
 G.on('emoteGate',()=>{if(round.state().active){G.toast('Bring the herd home first.');return true;}});
 G.on('roundupStart',()=>{clearTimeout(timer);receipt=null;G.hidePanels();G.seFrame?.settle();paint();});
 G.on('roundupCancel',()=>{clearTimeout(timer);paint();});
 G.on('roundupFinish',r=>{receipt=r;clearTimeout(timer);paint();timer=setTimeout(()=>{if(!round.state().active){G.ui.open('roundupResultPanel');G.seFrame?.settle();}},0);});
 function paint(){
  const s=round.state();document.body.classList.toggle('roundup-active',s.active);hud.style.display=s.active?'block':'none';marker.visible=!!(s.active&&s.target);if(!s.active)return;
  const t=s.target;
  if(t){marker.position.set(t.standX,G.world.groundH(t.standX,t.standZ)+.065,t.standZ);marker.material.color.set(t.pressure==='guiding'?0xa5d987:0xe3c977);mini.x=t.x;mini.z=t.z;}
  let hint=s.countdown>0?`Starting in ${Math.ceil(s.countdown)} — the gold ring shows where to ride.`:t?.pressure==='guiding'?`Good angle. Walk behind ${t.name} toward the green pen.`:t?.pressure==='too close'?`Give ${t.name} a little room. Circle around to the gold ring.`:`Ride to the gold ring behind ${t?.name||'a loose horse'}, then ease toward the pen.`;
  const html=`<div class="round-top"><span>${esc(s.name)}</span><span class="round-time">${Math.ceil(s.timeLeft)}s</span><button type="button" aria-label="Leave roundup">Leave</button></div><div class="round-main">${s.penned} of ${s.total} home</div><div class="round-hint">${esc(hint)}</div>`;
  if(html!==last){hud.innerHTML=html;hud.querySelector('button').onclick=()=>round.cancel();last=html;}
 }
 G.on('tick',dt=>{tick+=dt;if(tick<.15)return;tick=0;paint();});
 G.on('state',o=>{o.roundup=round.state();});
 G.roundupUI={state:()=>({open:panel.style.display==='flex',receiptId:receipt?.runId||null})};paint();
}
