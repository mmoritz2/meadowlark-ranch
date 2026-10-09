// The world owns trust and the physical horse. These rules only decide whether
// its explicit handover is available and commit one chosen outcome per encounter.
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
const choices=new Set(['home','sanctuary','helper']);
const validRun=id=>typeof id==='string'&&id.trim().length>0&&id.length<=160;
export function wildTamingInteraction({trust,distance,speed,blocked=false,flee=false}={}){
 const ready=Number.isFinite(trust)&&trust>=100;
 const inReach=Number.isFinite(distance)&&distance>=0&&distance<=5.5;
 let status='ready',reason='Your new friend trusts you. Choose a home together.';
 if(blocked){status='paused';reason='Return to riding to meet your new friend.';}
 else if(flee){status='spooked';reason='Give the horse room to settle, then approach gently.';}
 else if(!inReach){status='far';reason='Walk closer to your new friend.';}
 else if(!Number.isFinite(speed)||Math.abs(speed)>=1.2){status='moving';reason='Come to a gentle stop beside the horse.';}
 else if(!ready){status='trust';reason='Walk together calmly and keep building trust.';}
 return {ready,inReach,eligible:status==='ready',status,reason,label:ready?'Choose a home':'Build trust'};
}
function receiptFor(save,runId){
 const state=object(save?.wildTaming),records=object(state?.receipts);
 const receipt=records&&Object.hasOwn(records,runId)?records[runId]:state?.lastResult;
 return object(receipt)&&receipt.runId===runId&&receipt.saved===true&&choices.has(receipt.choice)?receipt:null;
}
function read(storage){try{return storage.fresh();}catch{return null;}}
function confirmed(storage,pending,choice){
 const saved=read(storage),result=receiptFor(saved,pending.runId);
 if(!result)return null;
 if(result.choice!==choice)return {ok:false,reason:'This encounter already has a different saved outcome.'};
 pending.result=result;if(result.horseId!=null)pending.horseId=result.horseId;
 return {ok:true,result,saved};
}
// apply(save, pending) must mutate only that draft and return serializable receipt
// details. It may throw to abort. For home, return horseId for a horse in the draft.
// Notifications, removal, respawn and network messages belong after ok:true.
export function saveWildTaming(storage,pending,apply){
 if(!object(pending)||!validRun(pending.runId)||!choices.has(pending.choice))return {ok:false,reason:'Choose a home for this encounter first.'};
 const choice=pending.lockedChoice??pending.choice;
 if(!choices.has(choice)||pending.choice!==choice)return {ok:false,reason:'Retry the outcome already chosen for this encounter.'};
 pending.lockedChoice=choice;
 if(!storage||typeof storage.fresh!=='function'||typeof storage.sync!=='function'||typeof apply!=='function')return {ok:false,reason:'Your ranch save is unavailable.'};
 const existing=confirmed(storage,pending,choice);if(existing)return existing;
 let failure='The wild-horse save could not be confirmed.';
 try{storage.sync(save=>{
  try{
   if(!object(save))throw Error('Your ranch save is unavailable.');
   const prior=receiptFor(save,pending.runId);
   if(prior){if(prior.choice!==choice)throw Error('This encounter already has a different saved outcome.');return;}
   const details=apply(save,pending);
   if(!object(details))throw Error('The encounter did not produce a reward receipt.');
   if(choice==='home'&&(details.horseId==null||!Array.isArray(save.horses)||!save.horses.some(h=>h.id===details.horseId)))throw Error('The new horse could not be added to your ranch.');
   // Detach callback-owned objects and fail before writing if the receipt cannot
   // survive storage. Retain every run identity so older callbacks cannot repay.
   const result=JSON.parse(JSON.stringify({...details,runId:pending.runId,choice,saved:true}));
   const state=object(save.wildTaming)||{},receipts=object(state.receipts)||{};
   save.wildTaming={...state,version:1,receipts:{...receipts,[pending.runId]:result},lastResult:result};
   pending.result={...result,saved:false};if(result.horseId!=null)pending.horseId=result.horseId;
  }catch(error){failure=error?.message||failure;throw error;}
 });}catch(error){failure=error?.message||failure;}
 return confirmed(storage,pending,choice)||{ok:false,reason:failure};
}
