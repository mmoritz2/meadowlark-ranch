// Pure storage core. The native backend stores alternating verified snapshots.
// Checksums detect damaged writes; they are not authentication or encryption.
export const SAVE_KEYS=Object.freeze(['starRanchFable_v1','starRanchFable_photos_v1','mlrVRCtrl','mlrHinted','mk_sjy','mk_sev']);
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
export async function createSaveStore({backend,seed={},onStatus=()=>{},delay=300}){
 let currentSlot=null,revision=0,values=Object.create(null),version=0,written=0,timer=null,running=null,resetVersion=null;
 const slots=[];let hadFile=false;
 for(const name of ['a','b']){
  // Only backend-confirmed absence is a new installation. Other read errors fail closed.
  const raw=await backend.read(name);if(raw===null)continue;hadFile=true;
  try{slots.push({name,...decodeSnapshot(raw)});}catch{/* An intact older slot can recover a torn write. */}
 }
 slots.sort((a,b)=>b.revision-a.revision);
 if(hadFile&&!slots.length)throw Error('Saved ranch files could not be read. Existing files were preserved.');
 if(slots.length){const best=slots[0];currentSlot=best.name;revision=best.revision;Object.assign(values,best.values);if(slots.length===1&&hadFile)onStatus({state:'restored'});}
 else for(const key of SAVE_KEYS)if(typeof seed[key]==='string')values[key]=seed[key];
 function changed(){version++;onStatus({state:'saving'});clearTimeout(timer);timer=setTimeout(()=>{timer=null;void flush().catch(()=>{});},delay);}
 function flush(){
  clearTimeout(timer);timer=null;
  if(running)return running;
  running=(async()=>{
   while(written<version||resetVersion!==null){
    const targetVersion=version,nextRevision=revision+1,nextSlot=currentSlot==='a'?'b':'a',encoded=encodeSnapshot(nextRevision,values);
    await backend.write(nextSlot,encoded);
    const readback=await backend.read(nextSlot);
    if(readback!==encoded)throw Error('Saved ranch verification failed');
    decodeSnapshot(readback);
    revision=nextRevision;currentSlot=nextSlot;written=targetVersion;
    if(resetVersion!==null&&targetVersion>=resetVersion){
     // A confirmed reset must not leave old personal data in the recovery slot.
     // A reset that arrives during an older write belongs to a later snapshot.
     const verifiedReset=resetVersion;
     const other=nextSlot==='a'?'b':'a';await backend.write(other,encoded);
     if(await backend.read(other)!==encoded)throw Error('Reset verification failed');
     if(resetVersion===verifiedReset)resetVersion=null;
    }
   }
   onStatus({state:'saved'});
  })().catch(error=>{onStatus({state:'error',message:String(error.message||error)});throw error;}).finally(()=>{running=null;});
  return running;
 }
 const store={
  getItem(key){return Object.hasOwn(values,key)?values[key]:null;},
  setItem(key,value){if(!allowed.has(key))throw Error('Unregistered game save key: '+key);value=String(value);if(values[key]===value)return;values[key]=value;changed();},
  removeItem(key){if(Object.hasOwn(values,key)){delete values[key];changed();}},
  clear(){values=Object.create(null);changed();resetVersion=version;},
  key(index){return Object.keys(values)[index]??null;},
  get length(){return Object.keys(values).length;},
  flush,
  snapshot(){return {...values};},
  dispose(){clearTimeout(timer);timer=null;}
 };
 if(!slots.length&&Object.keys(values).length){changed();await flush();}
 return store;
}
