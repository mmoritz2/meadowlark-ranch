/* One discoverable selector for the existing riding styles. Rules and saved
 * state belong to mastery; this screen only presents and invokes that API. */
export const id='riding-modes';
export function install(G){
 if(!G.mastery||!G.ui)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const details={
  saddled:{title:'Saddled',tag:'Ready to ride',text:'Your rider, saddle, bridle and reins. Head out together with your usual riding setup.'},
  bareback:{title:'Bareback',tag:'A closer partnership',text:'Ride directly on your horse’s back with a relaxed leg position. Keep the bridle and reins; leave the saddle and stirrups behind.'},
  wild:{title:'Wild',tag:'Be the horse',text:'Explore as your horse, with no rider or tack. Run, jump, graze and try your horse’s unlocked actions.'},
 };
 const icon=mode=>'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(mode==='wild'?'<path d="M9 39c-3-21 7-30 29-30 0 21-9 31-29 30Zm0 0 23-23m-14 14V19m0 11h12"/>':mode==='bareback'?'<path d="M24 39S6 28 6 17a10 10 0 0 1 18-5 10 10 0 0 1 18 5c0 11-18 22-18 22Z"/>':'<path d="M7 17h34v9c0 13-34 13-34 0ZM13 17V8h7v9m10 0V8h7v9M24 36v7m-7 0h14"/>')+'</svg>';
 let lastFocus=null,returnTo=null;
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='assets/riding-modes.css?v=riding-modes-1';document.head.append(sheet);
 function render(){
  const s=G.mastery.ridingModeStatus(),h=G.horse.ridden()||{},current=details[s.mode]||details.saddled;
  const options=s.options||[];
  let html='<div class="rm-head"><div><span class="rm-kicker">YOUR HORSE · YOUR WAY</span><h2 id="ridingModeTitle">Riding modes</h2></div><button type="button" data-fx="ridemode:close" aria-label="Close riding modes">✕</button></div>'
   +(returnTo?'<button type="button" class="rm-back" data-fx="ridemode:back">← Horse overview</button>':'')+'<p class="rm-intro">Choose how to explore with <strong>'+esc(h.name||'your horse')+'</strong>.</p><div class="rm-current" role="status">Current mode: <strong>'+current.title+'</strong><span>'+esc(G.horse.breedLabel(h.breed))+' mastery '+s.mastery+' / '+s.max+'</span></div>';
  html+='<div class="rm-options" aria-label="Choose riding mode">'+options.map(o=>{const d=details[o.id];if(!d)return '';const selected=o.selected||s.mode===o.id,locked=!o.available;return '<button type="button" class="rm-option '+(selected?'selected':'')+'" data-fx="ridemode:select:'+o.id+'" data-riding-mode="'+o.id+'" aria-pressed="'+selected+'" '+(locked?'disabled':'')+'>'+icon(o.id)+'<span><small>'+d.tag+'</small><strong>'+d.title+'</strong><span>'+d.text+'</span><em>'+(selected?'Selected':locked?esc(o.reason||o.requirement||'Not available yet'):o.requirement?esc(o.requirement)+' · Unlocked':'Choose '+d.title)+'</em></span></button>';}).join('')+'</div>';
  const rig=G.horse.RIG(),actions=rig?.heroMotion?.supportedActions||[],E=G.tables.EMOTES||{};
  if(actions.length){html+='<section class="rm-actions"><h3>Your horse’s actions</h3><p>Come to a halt to try an action. Your horse finishes resting before you can ride again.</p><div>'+actions.map(k=>{const e=E[k];if(!e)return '';const locked=!!e.locked?.(h),record=rig.heroMotion.actionDescriptor?.(k);return '<button type="button" data-fx="ridemode:action:'+esc(k)+'" '+(locked?'disabled':'')+'>'+esc(String(e.label||k).replace(/^[^A-Za-z]+/,''))+(locked?'<small>'+esc(e.lockHint||'Build your bond to unlock')+'</small>':record?.dismountedOnly&&s.mode!=='wild'?'<small>Steps your rider down</small>':'')+'</button>';}).join('')+'</div></section>';}
  html+='<p class="rm-help">Bareback and Wild unlock through breed mastery. Your horse keeps its equipped items and upgrades when you change riding mode.</p><button type="button" class="rm-go" data-fx="ridemode:ride">'+(s.mode==='wild'?'Explore as your horse':'Ride together')+'</button>';
  return html;
 }
 G.ui.panel({id:'rideModePanel',title:'Riding modes',dock:{label:'Riding modes',after:'careBtn',title:'Choose saddled, bareback or wild'},render});
 const panel=document.getElementById('rideModePanel');panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','ridingModeTitle');panel.setAttribute('aria-modal','true');
 const visible=()=>panel.style.display==='flex';
 function open({onBack=null}={}){lastFocus=document.activeElement;returnTo=onBack;G.seCare?.close();G.ui.open('rideModePanel');G.riding?.releaseAll?.();panel.querySelector('[data-riding-mode]:not(:disabled)')?.focus();}
 function refresh(){if(!visible())return;const scroll=panel.scrollTop,hadFocus=panel.contains(document.activeElement),focused=hadFocus?document.activeElement?.dataset?.fx:null;G.ui.rerender('rideModePanel');if(hadFocus){const same=[...panel.querySelectorAll('button:not(:disabled)')].find(b=>b.dataset.fx===focused);(same||panel.querySelector('[data-riding-mode][aria-pressed="true"]:not(:disabled)')||panel.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});}panel.scrollTop=scroll;}
 function close(){G.hidePanels();returnTo=null;const target=lastFocus?.getClientRects?.().length?lastFocus:document.getElementById('seMenuBtn');target?.focus?.();}
 const dock=document.getElementById('rideModeBtn');if(dock)dock.onclick=()=>visible()?close():open();
 G.ui.action('ridemode',([what,value])=>{
  if(what==='open'){open();return;}
  if(what==='close'){close();return;}
  if(what==='back'){const back=returnTo;close();back?.();return;}
  if(what==='select'){G.mastery.selectRidingMode(value);refresh();return;}
  if(what==='ride'){close();return;}
  if(what==='action'){G.hidePanels();G.horse.horseEmote(value);}
 });
 panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button:not(:disabled),a[href]')].filter(n=>n.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 for(const event of ['ridingModeChanged','rebuild'])G.on(event,refresh);
 G.on('interval30',refresh);
 G.ridingModes={open,close,refresh};
}
