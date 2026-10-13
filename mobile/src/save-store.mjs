// Pure storage core. The native backend stores alternating verified snapshots.
// Checksums detect damaged writes; they are not authentication or encryption.
export const SAVE_KEYS=Object.freeze(['starRanchFable_v1','starRanchFable_photos_v1','mlrVRCtrl','mlrHinted','mlrHudGoalExpanded','mk_sjy','mk_sev']);
const allowed=new Set(SAVE_KEYS);
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);}
export function encodeSnapshot(revision,values){const body=JSON.stringify({format:1,revision,values});return JSON.stringify({body,checksum:checksum(body)});}
export function decodeSnapshot(text){
 const box=JSON.parse(text);
 if(typeof box.body!=='string'||box.checksum!==checksum(box.body))throw Error('Save checksum mismatch');
 const data=JSON.parse(box.body);
 if(data.format!==1||!Number.isSafeInteger(data.revision)||data.revision<0||!data.values||Array.isArray(data.values)||typeof data.values!=='object')throw Error('Invalid save format');
 for(const [key,value] of Object.entries(data.values))if(!allowed.has(key)||typeof value!=='string')throw Error('Invalid save key or value');
 return data;
}
function durabilityError(error,targetVersion,durableVersion,revision){
 const failure=new Error(String(error?.message||error).slice(0,240));
 failure.name='SaveDurabilityError';failure.code='NATIVE_SAVE_NOT_DURABLE';
 failure.targetVersion=targetVersion;failure.durableVersion=durableVersion;failure.revision=revision;failure.retryable=true;
 return failure;
}
export async function createSaveStore({backend,seed={},onStatus=()=>{},delay=300}){
 let currentSlot=null,revision=0,values=Object.create(null),version=0,written=0,timer=null,running=null,resetVersion=null;
 let durableValues=Object.freeze({}),durableRevision=0,state='saved',lastError=null;
 const waiters=new Set(),slots=[];let hadFile=false,restored=false;
 for(const name of ['a','b']){
  // Only backend-confirmed absence is a new installation. Other read errors fail closed.
  const raw=await backend.read(name);if(raw===null)continue;hadFile=true;
  try{slots.push({name,...decodeSnapshot(raw)});}catch{/* An intact older slot can recover a torn write. */}
 }
 slots.sort((a,b)=>b.revision-a.revision);
 if(hadFile&&!slots.length)throw Error('Saved ranch files could not be read. Existing files were preserved.');
 if(slots.length){
  const best=slots[0];currentSlot=best.name;revision=durableRevision=best.revision;
  Object.assign(values,best.values);durableValues=Object.freeze({...best.values});restored=slots.length===1&&hadFile;
 }else for(const key of SAVE_KEYS)if(typeof seed[key]==='string')values[key]=seed[key];
 function status(){return Object.freeze({state,version,durableVersion:written,revision:durableRevision,pending:written<version||resetVersion!==null,inFlight:running!==null,error:lastError,message:lastError?.message??null});}
 function report(nextState){
  if(nextState!=='restored')state=nextState;
  // A UI status observer cannot change whether a backend write was verified.
  try{onStatus(Object.freeze({...status(),state:nextState}));}catch{}
 }
 function acknowledgement(targetVersion){return Object.freeze({targetVersion,durableVersion:written,revision:durableRevision,values:durableValues});}
 function confirmWaiters(){
  for(const waiter of waiters)if(waiter.targetVersion<=written){waiters.delete(waiter);waiter.resolve(acknowledgement(waiter.targetVersion));}
 }
 function changed(reset=false){
  version++;if(reset)resetVersion=version;lastError=null;report('saving');
  clearTimeout(timer);timer=setTimeout(()=>{timer=null;void flush().catch(()=>{});},delay);
 }
 function flush(){
  clearTimeout(timer);timer=null;
  if(running)return running;
  let resolveRun,rejectRun,failedVersion=version;
  const attempt=new Promise((resolve,reject)=>{resolveRun=resolve;rejectRun=reject;});
  // Install the in-flight promise before any backend or status callback can re-enter.
  running=attempt;
  if(written<version||resetVersion!==null){lastError=null;report('saving');}
  void (async()=>{
   while(written<version||resetVersion!==null){
    const targetVersion=version,nextRevision=revision+1,nextSlot=currentSlot==='a'?'b':'a',encoded=encodeSnapshot(nextRevision,values);
    failedVersion=targetVersion;
    await backend.write(nextSlot,encoded);
    const readback=await backend.read(nextSlot);
    if(readback!==encoded)throw Error('Saved ranch verification failed');
    const verified=decodeSnapshot(readback);
    revision=nextRevision;currentSlot=nextSlot;
    if(resetVersion!==null&&targetVersion>=resetVersion){
     // A reset is durable only after both recovery slots contain the cleared snapshot.
     // A newer reset arriving during cleanup is handled by the next loop iteration.
     const verifiedReset=resetVersion,other=nextSlot==='a'?'b':'a';await backend.write(other,encoded);
     const resetReadback=await backend.read(other);
     if(resetReadback!==encoded)throw Error('Reset verification failed');
     decodeSnapshot(resetReadback);
     if(resetVersion===verifiedReset)resetVersion=null;
    }
    durableValues=Object.freeze({...verified.values});durableRevision=verified.revision;written=targetVersion;
    confirmWaiters();
   }
   return acknowledgement(written);
  })().then(result=>{
   running=null;lastError=null;report(written<version||resetVersion!==null?'saving':'saved');resolveRun(result);
   // A status observer can enqueue another write as this attempt finishes.
   if(waiters.size&&(written<version||resetVersion!==null))void flush().catch(()=>{});
  },error=>{
   const failure=durabilityError(error,failedVersion,written,durableRevision);
   lastError=Object.freeze({code:failure.code,message:failure.message,targetVersion:failedVersion,retryable:true});
   for(const waiter of waiters){waiters.delete(waiter);waiter.reject(durabilityError(error,waiter.targetVersion,written,durableRevision));}
   running=null;report('error');rejectRun(failure);
  });
  return attempt;
 }
 // The acknowledgement is the verified snapshot that reached this checkpoint.
 // It may contain later coalesced writes; callers must validate their own receipt.
 function whenDurable(targetVersion=version){
  if(!Number.isSafeInteger(targetVersion)||targetVersion<0||targetVersion>version){
   const error=new RangeError('Invalid save checkpoint');error.code='INVALID_SAVE_CHECKPOINT';error.retryable=false;return Promise.reject(error);
  }
  if(targetVersion<=written)return Promise.resolve(acknowledgement(targetVersion));
  const pending=new Promise((resolve,reject)=>{waiters.add({targetVersion,resolve,reject});});
  void flush().catch(()=>{});return pending;
 }
 const store={
  getItem(key){return Object.hasOwn(values,key)?values[key]:null;},
  getDurableItem(key){return Object.hasOwn(durableValues,key)?durableValues[key]:null;},
  setItem(key,value){if(!allowed.has(key))throw Error('Unregistered game save key: '+key);value=String(value);if(values[key]===value)return;values[key]=value;changed();},
  removeItem(key){if(Object.hasOwn(values,key)){delete values[key];changed();}},
  clear(){values=Object.create(null);changed(true);},
  key(index){return Object.keys(values)[index]??null;},
  get length(){return Object.keys(values).length;},
  checkpoint(){return version;},whenDurable,status,retry(){return whenDurable();},flush,
  snapshot(){return {...values};},
  dispose(){clearTimeout(timer);timer=null;}
 };
 if(restored)report('restored');
 if(!slots.length&&Object.keys(values).length){changed();await flush();}
 return store;
}
