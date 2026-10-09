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
body.dialogue-open :is(#seHudRoot,#seNorth,#seMarketLbl,#hud,#mini,#mkMiniPlate,#questTrack,#ctx,#touch,#stickZone,#stamWrap,#toasts,#courseHud,#hint,#dock,#statusCard,#chatFeed,#rushQuick,#seWay){visibility:hidden!important;pointer-events:none!important}
@media(max-width:600px){body.dialogue-open #dlg{bottom:calc(12px + env(safe-area-inset-bottom))!important;width:calc(100vw - 24px)!important;padding:16px 18px;max-height:76dvh!important}}
@media(max-height:500px){body.dialogue-open #dlg{bottom:calc(12px + env(safe-area-inset-bottom))!important;max-height:76dvh!important;padding:12px 20px}body.dialogue-open #dlg p{font-size:14px;line-height:1.4;margin:6px 0 10px}body.dialogue-open #dlg>b{font-size:17px;margin-bottom:6px}}
`;document.head.append(style);
 let active=false,previousFocus=null,speaker=null,horseFrame=null;
 const heldKeys=new Set(),blockedUntilRelease=new Set();
 const visible=()=>dlg.style.display!=='none'&&getComputedStyle(dlg).display!=='none';
 const controls=()=>[...dlg.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
 function sync(){
  const open=visible();
  if(horseFrame&&(!open||!horseFrame.group.parent||horseFrame.owner!==dlg.firstElementChild))horseFrame=null;
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
 G.dialogue={get active(){return visible();},get speaker(){return visible()?speaker:null;},setSpeaker(q){speaker=q||null;},frameHorse};
 // A subject belongs to this exact choice, not every later conversation using #dlg.
 // Approximate the horse's body; its floating nameplate must not enlarge the shot.
 function frameHorse(group,heading){
  if(!visible()||!dlg.firstElementChild||!group?.parent||!G.THREE||!G.camera||!Number.isFinite(heading)){horseFrame=null;return false;}
  const V=G.THREE.Vector3;
  horseFrame={group,heading,owner:dlg.firstElementChild,side:null,eye:null,at:new V(),desired:new V(),alternate:new V(),scale:new V()};
  return true;
 }
 G.on('camera',c=>{
  const shot=horseFrame;
  if(!shot)return false;
  if(!visible()||shot.owner!==dlg.firstElementChild||!shot.group.parent){horseFrame=null;return false;}
  const cam=G.camera,W=G.world,width=innerWidth,height=innerHeight,rect=dlg.getBoundingClientRect();
  const top=18,bottom=Math.min(height-18,rect.top-18),gap=bottom-top;
  if(gap<60||width<=0||height<=0)return false;
  shot.group.getWorldPosition(shot.at);shot.group.getWorldScale(shot.scale);
  const scale=Math.max(.5,Math.min(2.5,Math.max(shot.scale.x,shot.scale.y,shot.scale.z)));
  if(![shot.at.x,shot.at.y,shot.at.z,scale].every(Number.isFinite)){horseFrame=null;return false;}
  shot.at.y+=1.25*scale;
  const vf=cam.fov*Math.PI/180,tanV=Math.tan(vf/2),tanH=tanV*(cam.aspect||width/height);
  const distance=Math.max(3.8*scale/(2*.82*tanH),2.7*scale/(2*.80*(gap/height)*tanV))+scale;
  const forwardX=Math.sin(shot.heading),forwardZ=Math.cos(shot.heading);
  const place=(side,out)=>{
   out.set(shot.at.x+(-Math.cos(shot.heading)*side+forwardX*.22)*distance,shot.at.y+distance*.12,
    shot.at.z+(Math.sin(shot.heading)*side+forwardZ*.22)*distance);
   W?.followCamera?.resolve(shot.at,out,out);return out.distanceTo(shot.at);
  };
  if(shot.side===null){const right=place(1,shot.desired),left=place(-1,shot.alternate);shot.side=right>=left*.95?1:-1;}
  place(shot.side,shot.desired);
  // Other camera hooks run first. Smooth our own position so they cannot tug
  // this shot back toward the rider, and never change the player's orbit/FOV.
  if(!shot.eye)shot.eye=shot.desired.clone();
  else shot.eye.lerp(shot.desired,1-Math.exp(-6*Math.min(.1,Math.max(0,c.dt||0))));
  W?.followCamera?.resolve(shot.at,shot.eye,shot.eye);
  cam.position.copy(shot.eye);cam.lookAt(shot.at);
  cam.rotateX(Math.atan(((top+bottom)/height-1)*tanV));
  return true;
 });
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
