import {bondingPlan} from './care-presentation.js?v=bonding-1';

const LABELS={speed:'Speed',stamina:'Stamina',jump:'Jump',accel:'Acceleration',agility:'Agility'};
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clip=(value,min,max)=>Math.max(min,Math.min(max,value));
const percent=factor=>Math.round((factor-1)*10000)/100;
export function eventHorseById(save,id){
 if(!(typeof id==='number'&&Number.isFinite(id)||typeof id==='string'&&id.length>0))return null;
 const matches=(save?.horses||[]).filter(h=>h?.id===id);
 return matches.length===1&&!matches[0].foal&&!matches[0].egg?matches[0]:null;
}

// Entry totals and race effects arrive from their production helpers. Personality
// effects use the same exported persMul; bond stamina uses the existing 2%/level rule.
export function eventHorseComparison({horse,event,preparation,stats,personality={},personalityMultipliers={},bondLevel=0,bondGain,names=[],racePace=null,raceMatches=null,turnout=null}={}){
 const h=horse||{},ev=event||{},prep=preparation||{},bond=clip(finite(h.bond),0,100),level=Math.floor(clip(finite(bondLevel),0,5));
 const bondPlan=bondingPlan(h,{personality,bondGain,names});
 const effects=[];
 for(const [key,label]of [['sp','Pace'],['ac','Acceleration'],['ag','Turning']]){const value=finite(personalityMultipliers[key],1),change=percent(value);if(change)effects.push(label+' '+(change>0?'+':'')+change+'%');}
 const milestones=[];
 if(personality.agLow&&bond<50)milestones.push('At 50 bond, the turning penalty ends.');
 if(personality.spBond&&bond<80)milestones.push('At 80 bond, pace gains '+percent(personality.spBond)+'%.');
 if(personality.agHigh&&bond<80)milestones.push('At 80 bond, turning gains '+percent(personality.agHigh)+'%.');
 const exhaustion=personality.exhaust==='stop'?'Stops briefly when exhausted.':personality.exhaust==='balk'?'Balks briefly when exhausted.':'Slows down when exhausted.';
 const favourKeys=ev.race&&!ev.rush?Object.keys(LABELS).filter(k=>ev.traits?.includes(k)):[];
 const favours=favourKeys.map(key=>({key,label:LABELS[key],value:finite(stats?.total?.[key]),matched:Array.isArray(raceMatches)?raceMatches.includes(key):null}));
 const paceBonus=favours.length&&Number.isFinite(racePace)?Math.max(0,percent(racePace)):null;
 const requirements=Array.isArray(prep.requirements)?prep.requirements:[];
 const rows=Object.keys(LABELS).map(key=>{const requirement=requirements.find(r=>r.key===key);return {key,label:LABELS[key],base:finite(stats?.base?.[key]),tack:finite(stats?.tack?.[key]),total:finite(stats?.total?.[key]),need:requirement?.need??null,met:requirement?.met??null};});
 return {id:h.id,name:h.name||'Your horse',breed:h.breed,level:h.level||1,ready:prep.ready===true,reason:prep.reason||'',requirements,rows,
  training:(prep.training||[]).map(plan=>({...plan})),levelHint:prep.levelHint||'',
  personality:{label:personality.label||h.pers||'Your horse',effects,milestones,exhaustion},
  bond:{value:bond,level,staminaSaving:Math.round(2*level),preference:bondPlan.preference,next:bondPlan.next,nextBenefit:bondPlan.nextBenefit,actions:bondPlan.actions},
  favours,paceBonus,turnout:ev.kind==='show'&&Number.isFinite(turnout?.total)?{percent:Math.round(turnout.total*10000)/100,manners:Math.round((turnout.parts?.find(row=>row.p?.k==='manner')?.v||0)*10000)/100}:null};
}

export function createEventHorseSelection(G,{selector,changed=()=>{},now=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=20000}={}){
 const H=G.horse||{},P=H.player||{};let request=null,attemptId=null,error='';
 const read=()=>{try{return G.save.fresh();}catch{return null;}};
 const aligned=s=>Array.isArray(H.myHorses)&&H.myHorses.length===s?.horses?.length&&H.myHorses.every((h,i)=>h.id===s.horses[i]?.id&&h.breed===s.horses[i]?.breed);
 function busy(){
  if(G.course?.get?.()||G.course?.drillActive?.()||G.roundup?.state?.().active||G.rescueRide?.snapshot?.().active||G.trail?.ride)return 'Finish or end your current ride before changing horses.';
  if(P.flying||P.landing||finite(P.y)>.15||G.worldPkg?.vehicle?.())return 'Land and finish your journey before changing horses.';
  const rig=H.RIG?.(),foot=G.onFoot?.state?.()?.horse;
  if(rig?.heroJumpAge!=null||rig?.heroMotion?.mode==='jump')return 'Finish your jump before changing horses.';
  if(rig?.emote||rig?.heroMotion?.state?.action||foot?.action||foot?.pending||foot?.departure)return 'Let your horse finish its action before changing horses.';
  if(G.photoPause||G.cam?.isFree?.())return 'Return to the ranch before changing horses.';
  return '';
 }
 function ready(h,s){const rig=H.RIG?.(),model=h&&H.breedModels?.resolve?.(h.breed);return !!(h&&s?.ridingHorseId===h.id&&H.ridden?.()?.id===h.id&&H.ridden?.()?.breed===h.breed&&rig?.ready&&!rig.loadingBreed&&rig.attachedTo===P.mesh&&P.mesh&&(!model||rig.modelKey===model&&rig.requestedBreed===h.breed));}
 function state(){const save=read(),h=eventHorseById(save,attemptId),selected=attemptId!==null&&H.ridden?.()?.id===attemptId;return {pending:!!request,horseId:attemptId,reason:error,blocked:!!request||selected&&!ready(h,save)};}
 const notify=()=>{try{changed(state());}catch{}};
 const fail=reason=>{error=reason;return {ok:false,reason,horseId:attemptId};};
 async function select(id){
  let save=read(),h=eventHorseById(save,id);if(!h)return fail('This adult horse is no longer available. Reopen your comparison.');
  const reason=busy();if(reason)return fail(reason);
  const breed=h.breed;if(!aligned(save))return fail('Your stable changed. Reopen the comparison before choosing a horse.');
  if(ready(h,save))return {ok:true,horseId:id};
  const input=selector?.();if(!input||typeof input.onchange!=='function')return fail('Horse selection is not ready. Try again.');
  const index=save.horses.findIndex(row=>row.id===id);
  G.riding?.releaseAll?.();input.value=String(index);input.onchange();
  const deadline=now()+timeoutMs;
  for(;;){
   save=read();h=eventHorseById(save,id);
   if(!h||h.breed!==breed||H.ridden?.()?.id!==id)return fail('Your selected horse changed. Choose your event horse again.');
   if(save.ridingHorseId!==id)return fail('Your horse selection could not be saved. Try choosing this horse again.');
   if(!aligned(save))return fail('Your stable changed while the horse was loading. Reopen the comparison.');
   const reason=busy();if(reason)return fail(reason);
   if(ready(h,save))return {ok:true,horseId:id};
   const rig=H.RIG?.();if(!rig?.loadingBreed&&rig?.requestedBreed!==breed)return fail(h.name+' could not finish loading. Try choosing this horse again.');
   if(now()>=deadline)return fail(h.name+' is taking longer to load. Try again when your horse is ready.');
   await delay(100);
  }
 }
 function choose(id){if(request)return id===attemptId?request:Promise.resolve({ok:false,reason:'Wait for the selected horse to finish loading before choosing another.',horseId:id});attemptId=id;error='';request=Promise.resolve().then(()=>select(id)).catch(()=>fail('The horse could not be prepared. Try choosing it again.')).finally(()=>{request=null;notify();});notify();return request;}
 return {choose,state};
}
