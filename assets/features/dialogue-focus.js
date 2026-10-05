/* Dialogue keeps its existing quest actions, while taking ownership of input and focus. */
export const id='dialogue-focus';
export function install(G){
 const dlg=document.getElementById('dlg');if(!dlg)return;
 const shade=document.createElement('div');shade.id='dialogueShade';shade.hidden=true;document.body.append(shade);
 const style=document.createElement('style');style.textContent=`
#dialogueShade{position:fixed;inset:0;z-index:14;background:linear-gradient(180deg,rgba(13,26,29,.04) 15%,rgba(13,26,29,.34) 65%,rgba(13,26,29,.62));touch-action:none}
body.dialogue-open #dlg{z-index:16!important;top:auto!important;bottom:calc(24px + env(safe-area-inset-bottom))!important;left:50%!important;transform:translateX(-50%)!important;width:min(700px,calc(100vw - 40px))!important;max-height:70dvh!important;box-sizing:border-box;border-radius:18px;border:1px solid #d7c39c;border-top:3px solid #c59d52;padding:18px 24px;color:#332d23;background:linear-gradient(120deg,#fffaf0,#f4ecd9);box-shadow:0 14px 60px rgba(9,20,20,.32);text-align:left}
body.dialogue-open #dlg>b{display:block;width:fit-content;background:none;border:0;border-radius:0;padding:0;margin:0 0 8px;font-size:19px;color:#4c634d}
body.dialogue-open #dlg p{font-size:16px;line-height:1.5;margin:8px 0 14px}
body.dialogue-open #dlg button{min-height:44px;max-width:100%;white-space:normal}
body.dialogue-open #dlg input{min-height:44px;max-width:100%;box-sizing:border-box}
body.dialogue-open #dlg :focus-visible{outline:3px solid #47725d;outline-offset:3px}
body.dialogue-open #dlg:focus{outline:none}
body.dialogue-open :is(#seHudRoot,#seNorth,#seMarketLbl,#hud,#mini,#mkMiniPlate,#questTrack,#ctx,#touch,#stickZone,#stamWrap,#toasts,#courseHud,#hint,#dock,#statusCard,#chatFeed){visibility:hidden!important;pointer-events:none!important}
@media(max-width:600px){body.dialogue-open #dlg{bottom:calc(12px + env(safe-area-inset-bottom))!important;width:calc(100vw - 24px)!important;padding:16px 18px;max-height:76dvh!important}}
@media(max-height:500px){body.dialogue-open #dlg{bottom:calc(12px + env(safe-area-inset-bottom))!important;max-height:76dvh!important;padding:12px 20px}body.dialogue-open #dlg p{font-size:14px;line-height:1.4;margin:6px 0 10px}body.dialogue-open #dlg>b{font-size:17px;margin-bottom:6px}}
`;document.head.append(style);
 let active=false,previousFocus=null,speaker=null;
 const heldKeys=new Set(),blockedUntilRelease=new Set();
 const visible=()=>dlg.style.display!=='none'&&getComputedStyle(dlg).display!=='none';
 const controls=()=>[...dlg.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
 function sync(){
  const open=visible();
  if(open!==active){
   active=open;document.body.classList.toggle('dialogue-open',open);shade.hidden=!open;
   if(open)previousFocus=document.activeElement;
   G.riding?.releaseAll();G.riding?.lock('dialogue',open);
   if(open){document.getElementById('seGaitChoices')?.classList.remove('on');document.getElementById('seGaitLabel')?.setAttribute('aria-expanded','false');}
   else{
    speaker=null;
    for(const code of heldKeys)blockedUntilRelease.add(code);
    if(previousFocus?.isConnected&&previousFocus.getClientRects().length)previousFocus.focus({preventScroll:true});
   }
  }
  if(!open)return;
  dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');dlg.tabIndex=-1;
  const title=dlg.querySelector(':scope>b');
  if(title){title.id='dialogueTitle';dlg.setAttribute('aria-labelledby',title.id);dlg.removeAttribute('aria-label');}
  else{dlg.removeAttribute('aria-labelledby');dlg.setAttribute('aria-label','Ranch conversation');}
  if(!dlg.contains(document.activeElement)){
   // Do not redirect the E that opened Talk into the name field in this same key task.
   dlg.focus({preventScroll:true});
   const input=dlg.querySelector('input:not([disabled])');
   if(input)setTimeout(()=>{if(visible()&&input.isConnected&&document.activeElement===dlg)input.focus({preventScroll:true});},0);
  }
 }
 const observer=new MutationObserver(sync);observer.observe(dlg,{attributes:true,attributeFilter:['style'],childList:true});
 // Read visibility directly as well: opening and the next key event can share a task.
 G.dialogue={get active(){return visible();},get speaker(){return visible()?speaker:null;},setSpeaker(q){speaker=q||null;}};
 G.on('ride',ride=>{if(visible()){G.riding?.lock('dialogue',true);ride.target=0;ride.noJump=true;}});
 document.addEventListener('keydown',e=>{
  heldKeys.add(e.code);
  // A physical key held through a conversation must be released before riding resumes.
  if(!visible()&&blockedUntilRelease.has(e.code)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 document.addEventListener('keyup',e=>{if(e.isTrusted){heldKeys.delete(e.code);blockedUntilRelease.delete(e.code);}},true);
 window.addEventListener('blur',()=>{heldKeys.clear();blockedUntilRelease.clear();});
 document.addEventListener('keydown',e=>{
  if(!visible())return;
  if(e.key==='Tab'){
   const els=controls(),first=els[0],last=els[els.length-1],focused=document.activeElement;
   if(!first){e.preventDefault();dlg.focus();}
   else if(e.shiftKey&&(focused===first||!els.includes(focused))){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(focused===last||!els.includes(focused))){e.preventDefault();first.focus();}
  }
  // Preserve native typing, button activation and Escape. Movement shortcuts never reach
  // document/window listeners while the modal owns input.
  if(e.key!=='Escape')e.stopPropagation();
 });
 sync();
}
