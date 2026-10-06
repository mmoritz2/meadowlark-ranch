import {JOURNEY_CHAPTERS,sanitizeJourneySave,journeySnapshot,applyJourneyClaim,equipJourneyReward} from './rider-journey-rules.mjs?v=rider-journey-1';
export const id='rider-journey';
export function install(G){
 const S=G.save,H=G.horse;let previous='';
 S.ensure(s=>{s.riderJourney=sanitizeJourneySave(s.riderJourney);});
 const snapshot=()=>journeySnapshot(S.fresh(),H.ridden?.()?.id);
 function refresh(){
  const state=snapshot(),key=JSON.stringify(state);
  if(key!==previous){previous=key;G.run('journeyProgress',state);}return state;
 }
 function claim(chapterId){
  let proposed=null;
  S.sync(s=>{proposed=applyJourneyClaim(s,chapterId,{
   makeGear:g=>H.genGear(g.rarity,g.slot,{set:g.set,style:g.style}),
   payReward:(save,reward)=>G.money.payReward(save,reward)
  });});
  if(!proposed)return null;
  // syncSave intentionally catches storage failures. Confirm the persisted receipt
  // before showing a reward, emitting a claim, or refreshing the live inventory.
  const persisted=S.fresh(),receipt=sanitizeJourneySave(persisted?.riderJourney).claimed[chapterId];
  if(!receipt||receipt.gearId!==proposed.gearId){G.toast('Your reward could not be saved. Please try claiming it again.');return null;}
  H.refreshTack();G.money.refreshWallet();G.sGem?.();refresh();G.run('journeyClaim',proposed);return proposed;
 }
 function equip(chapterId){
  const horseId=H.ridden?.()?.id;if(horseId==null)return false;let proposed=null;
  S.sync(s=>{proposed=equipJourneyReward(s,chapterId,horseId);});
  if(!proposed)return false;
  const persisted=S.fresh(),horse=persisted?.horses?.find(h=>h.id===horseId);
  if(horse?.gear?.[proposed.slot]!==proposed.gearId){G.toast('Your tack change could not be saved. Please try again.');return false;}
  H.refreshTack();H.attachTack();H.dressSaddle();G.sChime?.();refresh();G.run('journeyEquip',proposed);return true;
 }
 function busy(){return G.course?.get()||G.course?.drillActive?.()||G.roundup?.state?.().active||G.rescueRide?.snapshot?.().active||G.trail?.ride||G.worldPkg?.vehicle?.();}
 function startNext(){
  const action=snapshot().nextAction;if(!action)return false;
  if(busy()){G.toast('Finish or end your current ride before starting the next chapter activity.');return false;}
  if(action.kind==='claim')return !!claim(action.id);
  let started=false;
  if(action.kind==='rescue')started=!!G.rescueRide?.start();
  if(action.kind==='rush')started=!!G.ranchRush?.start(action.id);
  if(action.kind==='roundup')started=!!G.roundup?.start(action.mode);
  if(started){G.hidePanels();G.seFrame?.settle();}return started;
 }
 G.riderJourney={chapters:JOURNEY_CHAPTERS,snapshot,claim,equip,startNext,refresh};
 for(const event of ['rushFinish','rescueFinish','roundupFinish','rescueAdopt','rebuild','wallet','boot'])G.on(event,()=>{refresh();});
 G.on('state',state=>{state.riderJourney=snapshot();});
 refresh();
}
