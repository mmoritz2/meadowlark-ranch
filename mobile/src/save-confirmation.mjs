import {SAVE_KEYS} from './save-store.mjs';

const unavailable=()=>new Error('Your ranch save could not be confirmed. Retry saving.');
function parseGameSave(raw){
 if(typeof raw!=='string')throw unavailable();
 let value;try{value=JSON.parse(raw);}catch{throw unavailable();}
 if(!value||typeof value!=='object'||Array.isArray(value))throw unavailable();
 return value;
}
// Native getItem is a synchronous working mirror. Only a verified slot
// acknowledgement can authorize a completed reward on the device.
export async function confirmGameSave(platform,key){
 if(!SAVE_KEYS.includes(key)||!platform?.storage)throw unavailable();
 const storage=platform.storage;
 if(platform.native===false)return parseGameSave(storage.getItem(key));
 if(platform.native!==true||typeof storage.checkpoint!=='function'||typeof storage.whenDurable!=='function')throw unavailable();
 const target=storage.checkpoint(),ack=await storage.whenDurable(target);
 if(!Number.isSafeInteger(target)||target<0||ack?.targetVersion!==target||
  !Number.isSafeInteger(ack?.durableVersion)||ack.durableVersion<target||
  !Number.isSafeInteger(ack?.revision)||ack.revision<0||!ack.values||Array.isArray(ack.values)||
  !Object.hasOwn(ack.values,key))throw unavailable();
 return parseGameSave(ack.values[key]);
}
