/* Focus ownership for full-screen game menus. Rendering and Back/Escape actions stay
   with each screen; no game/save state is changed here. */
const CONTROLS='button,input,select,textarea,a[href],[tabindex]';
const CUSTOM=['seHs','seEv','seJy','seOv','seChar'];
export function installMenuDialogFocus(G){
 if(G.menuDialogFocus)return G.menuDialogFocus;
 const doc=document,win=window,$=id=>doc.getElementById(id);
 const backgrounds=new Map(),attributes=new Map(),watched=new WeakSet();
 let current=null,history=[],queued=false,disposed=false,adjusting=false,locked=false;
 const visible=el=>!!el?.isConnected&&!el.hidden&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
 const external=()=>!!$('seMenu')?.classList.contains('on')||visible($('dlg'))||visible($('tackStallDialog'))||!!G.tackSummon?.ceremony?.active;
 const inside=(el,scope=current)=>!!el&&!!scope&&scope.parts.some(p=>p===el||p.contains(el));
 const usable=el=>visible(el)&&!el.disabled&&!el.closest('[inert]')&&el.getAttribute('aria-hidden')!=='true';
 function remember(el,name,value){
  let saved=attributes.get(el);if(!saved){saved=new Map();attributes.set(el,saved);}
  if(!saved.has(name))saved.set(name,el.getAttribute(name));
  el.setAttribute(name,value);
 }
 function restoreAttributes(){for(const [el,values] of attributes)for(const [name,value] of values)value===null?el.removeAttribute(name):el.setAttribute(name,value);attributes.clear();}
 function restoreBackground(){for(const [el,saved] of backgrounds){el.inert=saved.inert;if(saved.aria===null)el.removeAttribute('aria-hidden');else el.setAttribute('aria-hidden',saved.aria);}backgrounds.clear();}
 function lock(on){if(on===locked)return;locked=on;G.riding?.releaseAll?.();G.riding?.lock?.('menu-dialog',on);}
 function release({restore=false,keepHistory=false}={}){
  current=null;contents.disconnect();restoreBackground();restoreAttributes();lock(false);
  if(restore){const target=[...history].reverse().map(r=>r.opener).find(usable)||$('seMenuBtn');if(usable(target))target.focus({preventScroll:true});}
  if(!keepHistory)history=[];
 }
 function roots(){return [...new Set([...CUSTOM.map($),...doc.querySelectorAll('.se-fr,.fpanel'),...(G.ui?.panels||[]).map($)])].filter(Boolean);}
 function scope(){
  // These cover screens use .on as their open contract; a pending stylesheet
  // must not make a closed cover claim focus. Registered panels keep their own
  // visibility conventions (inline display or authored open classes).
  const list=roots().filter(el=>(!CUSTOM.includes(el.id)||el.classList.contains('on'))&&visible(el)&&!el.classList.contains('se-covered')&&(el.getAttribute('aria-hidden')!=='true'||backgrounds.has(el)));
  // Higher layers win; equal layers use DOM order, matching browser painting.
  list.sort((a,b)=>(parseInt(getComputedStyle(a).zIndex)||0)-(parseInt(getComputedStyle(b).zIndex)||0)||(a.compareDocumentPosition(b)&4?-1:1));
  const base=list.at(-1);if(!base)return null;
  const nested=[...base.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(visible).at(-1);
  const root=nested||base;
  const top=!nested&&base.classList.contains('se-fr')&&visible($('seFrameTop'))?$('seFrameTop'):
   !nested&&base.id==='shopPanel'&&base.classList.contains('se-mk')&&visible($('seMkTop'))?$('seMkTop'):null;
  return {root,base,parts:top?[top,root]:[root]};
 }
 function controls(){return current?current.parts.flatMap(p=>[...p.querySelectorAll(CONTROLS)]).filter(el=>el.tabIndex>=0&&usable(el)):[];}
 function focusTarget(record){
  if(inside(doc.activeElement)&&usable(doc.activeElement))return;
  const target=record?.last&&inside(record.last)&&usable(record.last)?record.last:current.root;
  target.focus({preventScroll:true});
 }
 function isolate(){
  // Only visible branches are leased. Covered source panels keep se-frame's own
  // inert/aria snapshots, and live receipts remain available to assistive readers.
  function visit(parent){for(const el of parent.children){
   if(current.parts.some(p=>p===el))continue;
   if(current.parts.some(p=>el.contains(p))){visit(el);continue;}
   if(!visible(el)||el.matches('script,style,link')||el.id==='toasts'||el.classList.contains('se-covered'))continue;
   if(!backgrounds.has(el))backgrounds.set(el,{inert:el.inert,aria:el.getAttribute('aria-hidden')});
   el.inert=true;el.setAttribute('aria-hidden','true');
  }}
  visit(doc.body);
 }
 function sync(){
  if(disposed||adjusting)return;adjusting=true;
  try{
   for(const el of [...roots(),$('seFrameTop'),$('seMkTop'),$('seMenu'),$('dlg'),$('tackStallDialog')].filter(Boolean))if(!watched.has(el)){watched.add(el);visibility.observe(el,{attributes:true,attributeFilter:['class','style','hidden']});}
   if(external()){if(current)release({keepHistory:true});return;}
   const next=scope();
   if(!next){if(current||history.length)release({restore:true});return;}
   if(current?.root!==next.root||current?.parts.length!==next.parts.length){
    if(current){const old=history.find(r=>r.root===current.root);if(old&&inside(doc.activeElement))old.last=doc.activeElement;}
    const found=history.findIndex(r=>r.root===next.root);
    if(found>=0)history=history.slice(0,found+1);else history.push({root:next.root,opener:doc.activeElement,last:null});
    restoreBackground();restoreAttributes();contents.disconnect();current=next;
    remember(next.root,'tabindex','-1');remember(next.root,'role','dialog');remember(next.root,'aria-modal','true');
    if(!next.root.hasAttribute('aria-label')&&!next.root.hasAttribute('aria-labelledby')){
     const title=next.root.id==='shopPanel'&&next.root.classList.contains('se-mk')?'Market':(next.parts[0].querySelector('.se-ttl-b,h1,h2,h3')?.textContent||G.ui?.defs?.[next.base.id]?.title||'Ranch menu');remember(next.root,'aria-label',title.trim());
    }
    if(next.parts.length>1)remember(next.root,'aria-owns',[next.parts[0].id,next.root.getAttribute('aria-owns')].filter(Boolean).join(' '));
    for(const part of next.parts)contents.observe(part,{childList:true,subtree:true});
    lock(true);isolate();focusTarget(history.at(-1));
   }else{isolate();if(!inside(doc.activeElement)||!usable(doc.activeElement))focusTarget(history.at(-1));}
  }finally{adjusting=false;}
 }
 function schedule(){if(queued||disposed)return;queued=true;queueMicrotask(()=>{queued=false;sync();});}
 const visibility=new MutationObserver(schedule),contents=new MutationObserver(schedule),structure=new MutationObserver(schedule);
 visibility.observe(doc.body,{attributes:true,attributeFilter:['class','style']});structure.observe(doc.body,{childList:true});
 const onFocus=()=>{if(adjusting||external())return;sync();if(current&&inside(doc.activeElement)){const record=history.at(-1);if(record)record.last=doc.activeElement;}};
 const onKey=e=>{
  sync();if(!current||external()||e.key!=='Tab')return;
  const list=controls(),index=list.indexOf(doc.activeElement);
  e.preventDefault();e.stopPropagation();
  const next=e.shiftKey?(index<=0?list.at(-1):list[index-1]):list[(index+1)%list.length];
  (next||current.root).focus({preventScroll:true});
 };
 const onBubble=e=>{
  if(!current||external()||!inside(e.target)||e.key==='Escape')return;
  // Native text/select editing and button activation belong to the menu. Arrow
  // navigation on cards still reaches the screenKey hooks in the game shell.
  if(e.target.matches('input,select,textarea')||e.target.isContentEditable||(['Enter',' ','Spacebar'].includes(e.key)&&e.target.closest('button,a[href],[role="button"]')))e.stopPropagation();
 };
 doc.addEventListener('focusin',onFocus,true);doc.addEventListener('keydown',onKey,true);doc.addEventListener('keydown',onBubble);
 const api={sync,suspend:()=>release(),get active(){return current?.root.id||null;},dispose(){disposed=true;release();visibility.disconnect();contents.disconnect();structure.disconnect();doc.removeEventListener('focusin',onFocus,true);doc.removeEventListener('keydown',onKey,true);doc.removeEventListener('keydown',onBubble);delete G.menuDialogFocus;}};
 G.menuDialogFocus=api;sync();return api;
}
