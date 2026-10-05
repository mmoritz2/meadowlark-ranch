/* Show the paid bundle and the next objective without triggering any additional reward. */
export const id='mission-receipt';
export function install(G){
 const dlg=G.$('dlg'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const style=document.createElement('style');style.textContent=`
.mission-receipt-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#617355;font-weight:800}
.mission-receipt-reward{display:block;padding:12px 14px;margin:10px 0 14px;background:#e4eddc;border:1px solid #c0d1b7;border-radius:10px;color:#35503a;line-height:1.65}
.mission-receipt-next{padding:12px 14px;background:#fffaf1;border:1px solid #e0d2ba;border-radius:10px;margin-bottom:14px}
.mission-receipt-next strong{display:block;font-size:17px;margin:4px 0}
.mission-receipt-next p{margin:6px 0!important;font-size:14px!important}
.mission-receipt-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
@media(max-height:500px) and (min-width:600px){
 .mission-receipt-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin:8px 0}
 .mission-receipt-body>div{margin:0;padding:8px 12px;font-size:14px;line-height:1.4}
 .mission-receipt-next strong{font-size:16px}
 body.dialogue-open #dlg:has(.mission-receipt-body)>p{margin:4px 0;font-size:14px}
}
`;document.head.append(style);
 G.on('missionReceipt',({mission,reward,next,npc})=>{
  if(next?.type==='cine'||G.storyQuests?.cine?.on||(mission.type==='door'&&!G.save.fresh().named))return false;
  const plan=next&&G.storyGuidance?.describe(next);
  const direct=plan?.action&&plan.action!=='return';
  dlg.innerHTML='<b>'+esc(npc.name)+'</b><div class="mission-receipt-label">Mission complete</div>'
   +'<p>'+esc(String(mission.label).replace(/\{name\}/g,G.save.fresh().story?.name||'the grey mare'))+'</p>'
   +'<div class="mission-receipt-body"><div class="mission-receipt-reward"><strong>Added to your rewards</strong><br>'+esc(G.money.rewardLabel(reward))+'</div>'
   +(next?'<div class="mission-receipt-next"><div class="mission-receipt-label">Up next</div><strong>'+esc(plan?.title||next.label)+'</strong>'+(plan?.hint?'<p>'+esc(plan.hint)+'</p>':'')+'</div>':'<p>Your story is complete. The valley is yours to explore.</p>')
   +'</div><div class="mission-receipt-actions"><button id="dlgBtn">Continue riding</button>'+(direct?'<button id="missionNext">'+esc(plan.label||'Start next task')+'</button>':'')+'</div>';
  dlg.style.display='block';
  G.$('dlgBtn').onclick=()=>{dlg.style.display='none';};
  const action=G.$('missionNext');if(action)action.onclick=()=>{dlg.style.display='none';G.storyGuidance.activateCurrent();};
  return true;
 });
}
