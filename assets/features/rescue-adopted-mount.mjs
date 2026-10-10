// Direct riding changes only the saved/current mount. Adoption and rewards keep
// their own verified receipts; no name lookup or replacement horse is permitted.
export function resolveAdoptedRescueHorse(save){
 const record=save?.rescueRides,id=record?.adoptedHorseId;
 if(record?.adopted!==true||!Number.isFinite(record.completions)||record.completions<1||
  !(typeof id==='string'&&id.length||typeof id==='number'&&Number.isFinite(id))||!Array.isArray(save?.horses))return null;
 const matches=save.horses.filter(h=>h?.id===id);
 const horse=matches.length===1?matches[0]:null;
 return horse?.rescueClover===true&&!horse.foal&&!horse.egg&&typeof horse.breed==='string'&&horse.breed?horse:null;
}
export function createAdoptedRescueMount(G,{active=()=>false,adoptionPending=()=>false,now=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=20000}={}){
 const H=G.horse,S=G.save,P=H.player;
 let request=null,lastError=null,errorHorseId=null;
 const read=()=>{try{return S.fresh();}catch(_){return null;}};
 function blocked(){
  if(active()||G.course?.get?.()||G.course?.drillActive?.()||G.roundup?.state?.().active||G.trail?.ride)return 'Finish or end your current ride before changing horses.';
  if(G.worldPkg?.vehicle?.()||P.flying||P.landing||Number(P.y)>.15)return 'Land and finish your journey before changing horses.';
  const body=typeof document==='undefined'?null:document.body;
  if(G.photoPause||G.cam?.isFree?.()||body?.classList.contains('freecam')||body?.classList.contains('posing')||typeof document!=='undefined'&&document.hidden)return 'Return to riding before changing horses.';
  const rig=H.RIG?.(),motion=rig?.heroMotion?.state,foot=G.onFoot?.state?.()?.horse;
  if(rig?.emote||motion?.action||foot?.action||foot?.pending||foot?.departure||G.onFoot?.horseActionTarget?.()?.heroMotion?.state?.action)return 'Let your horse finish its action before changing horses.';
  // The on-foot action controller exposes its return blend through this target.
  if(G.onFoot?.on&&G.onFoot?.horseActionTarget?.()?.heroMotion?.state?.transitioning)return 'Let your horse settle before changing horses.';
  return '';
 }
 function rigReady(horse){
  const rig=H.RIG?.(),model=horse&&H.breedModels?.resolve?.(horse.breed);
  return !!(horse&&typeof model==='string'&&model&&H.ridden?.()?.id===horse.id&&H.ridden?.()?.breed===horse.breed&&
   rig?.ready&&!rig.loadingBreed&&rig.requestedBreed===horse.breed&&rig.modelKey===model&&rig.attachedTo===P.mesh&&P.mesh);
 }
 function isReady(horse,save){return rigReady(horse)&&save?.ridingHorseId===horse.id&&!P.onFoot&&!G.onFoot?.on;}
 function adoptedMount(){
  const save=read(),horse=resolveAdoptedRescueHorse(save),available=!!horse&&!adoptionPending();
  return {available,name:horse?.name||'Clover',horseId:horse?.id??null,selected:!!horse&&H.ridden?.()?.id===horse.id,
   ready:available&&isReady(horse,save),loading:!!request,error:!save?'Your stable could not be read. Try again.':adoptionPending()?'Retry welcoming Clover before riding her.':
    lastError&&(errorHorseId==null||errorHorseId===horse?.id)?lastError:null};
 }
 function fail(message,id=null){lastError=message;errorHorseId=id;G.toast?.(message);return false;}
 async function select(){
  let save=read(),horse=resolveAdoptedRescueHorse(save);
  if(!save)return fail('Your stable could not be read. Try riding Clover again.');
  if(adoptionPending())return fail('Retry welcoming Clover before riding her.');
  if(!horse)return fail('Your adopted Clover is not in this stable. Choose one of your horses in My Horses.');
  const id=horse.id,breed=horse.breed,reason=blocked();if(reason)return fail(reason,id);
  if(typeof G.ranchSys?.setRideIdx!=='function'||typeof H.rebuildAll!=='function')return fail('Horse switching is not ready. Try again.',id);
  lastError=null;errorHorseId=id;
  if(isReady(horse,save))return true;
  // The core still uses parallel saved/live indices for some care actions.
  // Never select from a stale/reordered roster or rebuild before confirmation.
  // Confirmed adoption already reloads both the real roster and its selector.
  const index=H.myHorses?.findIndex(h=>h.id===id&&h.rescueClover===true&&h.breed===breed)??-1;
  if(index<0||H.myHorses.length!==save.horses.length||H.myHorses.some((h,i)=>h.id!==save.horses[i]?.id))return fail('Your stable changed. Reopen My Horses and try again.',id);
  // syncSave swallows failures. Do not change the visible mount until this
  // exact selection is read back; a retry can confirm an ambiguous prior write.
  try{S.sync(s=>{const current=resolveAdoptedRescueHorse(s);if(current?.id===id&&current.breed===breed)s.ridingHorseId=id;});}catch(_){}
  save=read();horse=resolveAdoptedRescueHorse(save);
  if(!horse||horse.id!==id||horse.breed!==breed||save.ridingHorseId!==id)return fail('Your horse selection could not be saved. Try riding Clover again.',id);
  if(H.myHorses.length!==save.horses.length||H.myHorses.some((h,i)=>h.id!==save.horses[i]?.id)||H.myHorses[index]?.id!==id)return fail('Your stable changed. Reopen My Horses and try again.',id);
  const freshReason=blocked();if(freshReason)return fail(freshReason,id);
  G.riding?.releaseAll?.();P.speed=0;P.y=0;P.vy=0;
  G.ranchSys.setRideIdx(index);H.rebuildAll();
  if(G.onFoot?.on||P.onFoot)G.onFoot?.mount?.({here:true});
  const deadline=now()+timeoutMs;
  for(;;){
   save=read();horse=resolveAdoptedRescueHorse(save);
   if(!save)return fail('Your horse selection could not be confirmed. Try riding Clover again.',id);
   if(!horse||horse.id!==id||horse.breed!==breed||H.ridden?.()?.id!==id||save.ridingHorseId!==id)return fail('Your selected horse changed. Choose your next ride again.',id);
   const reason=blocked();if(reason)return fail(reason,id);
   if(isReady(horse,save)){lastError=null;return true;}
   const rig=H.RIG?.();
   if(!rig?.loadingBreed&&rig?.requestedBreed!==breed)return fail(horse.name+' could not finish loading. Try riding her again.',id);
   if(now()>=deadline)return fail(horse.name+' is taking longer to load. Try riding her again, or open My Horses.',id);
   await delay(100);
  }
 }
 function rideAdopted(){
  if(request)return request;
  // Set the in-flight marker before selection can cause synchronous UI hooks.
  request=Promise.resolve().then(select).catch(()=>fail('Clover could not be prepared for riding. Try again.')).finally(()=>{request=null;});
  return request;
 }
 function loadingGate(){
  // A timed-out request releases its Retry button, not the unfinished model.
  // Readiness excludes mounted/on-foot state: ordinary courses may mount a
  // fully loaded horse through their existing on-foot entry flow.
  const horse=request?null:resolveAdoptedRescueHorse(read());
  if(!request&&!(horse&&H.ridden?.()?.id===horse.id&&!rigReady(horse)))return;
  G.toast?.(request?'Wait for your chosen horse to finish loading before starting another ride.':'Your chosen horse is not ready. Retry riding her or choose another horse in My Horses.');return true;
 }
 for(const event of ['activityGate','courseGate','travelGate'])G.on?.(event,loadingGate);
 return {rideAdopted,adoptedMount};
}
