/* Slow connections are still loading; only an actual failure displays an error. */
(()=>{
 const get=id=>document.getElementById(id);
 let failed=false,finished=false,seen=0,last=performance.now();
 const retry=get('loadRetry'),help=get('loadHelp');
 if(retry)retry.onclick=()=>location.reload();
 document.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||!get('load'))return;
  e.preventDefault();if(retry&&!retry.hidden)retry.focus();
 });
 function offerRetry(message){if(help){help.textContent=message;help.hidden=false;}if(retry)retry.hidden=false;}
 window.GameLoading={
  stage(label){if(failed||finished)return;const text=get('loadpct');if(text)text.textContent=label;},
  fail(message){if(finished)return;failed=true;get('load')?.classList.add('load-failed');const title=get('loadTitle');if(title)title.textContent='Let’s try that again';const text=get('loadpct');if(text)text.textContent=message;offerRetry('Your saved ranch is safe. Check your connection, then retry.');},
  ready(){if(failed)return;finished=true;get('load')?.classList.add('load-ready');const text=get('loadpct');if(text)text.textContent='Your horse is ready';},
 };
 function tick(){
  if(finished||failed||window.__gameModuleBlocked||!get('load'))return;
  const now=performance.now();if(document.visibilityState==='visible')seen+=Math.min(1000,now-last);last=now;
  if(seen>=15000)offerRetry('The first visit can take a little longer while your horse and world load. You can wait here or retry.');
  setTimeout(tick,500);
 }
 setTimeout(tick,500);
})();
