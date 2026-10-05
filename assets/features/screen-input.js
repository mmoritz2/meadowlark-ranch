/* Full-screen menus own riding controls without pausing the world or event clock. */
export const id='screen-input';
export function install(G){
 const held=new Set(),blocked=new Set();let wasOpen=false;
 const visible=()=>document.body.classList.contains('se-screen-open')||!!G.input?.blocked();
 function sync(){
  const open=visible();if(open===wasOpen)return;
  wasOpen=open;
  for(const code of held)blocked.add(code);
  G.riding.releaseAll();G.riding.lock('screen',open);
  document.getElementById('seGaitChoices')?.classList.remove('on');
  document.getElementById('seGaitLabel')?.setAttribute('aria-expanded','false');
 }
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('game-input-change',sync);
 document.addEventListener('keydown',e=>{
  held.add(e.code);
  if(!visible()&&blocked.has(e.code)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 document.addEventListener('keyup',e=>{if(e.isTrusted){held.delete(e.code);blocked.delete(e.code);}},true);
 window.addEventListener('blur',()=>{held.clear();blocked.clear();});
 G.screenInput={get active(){return visible();}};
 G.on('ride',ride=>{if(visible()){ride.target=0;ride.noJump=true;}});
 sync();
}
