import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {createSaveStore,SAVE_KEYS} from './save-store.mjs';

const native=Capacitor.isNativePlatform();
let game=null,wasActive=true,statusNode=null;
const platform={mode:'native-development',native,social:false,paused:false,storage:null,ready:null,flush:async()=>{},
 attachGame(hooks){game=hooks;if(platform.paused)game.pause?.();},
 async reload(){try{await platform.flush();location.replace(location.pathname);}catch(error){showStatus({state:'error',message:error.message});}},
 async reset(){platform.storage.clear();await platform.reload();}
};
Object.defineProperty(window,'MeadowlarkNative',{value:platform,writable:false});
function showStatus(status){
 window.dispatchEvent(new CustomEvent('meadowlark:save-status',{detail:status}));
 if(!document.body)return;
 if(status.state!=='error'){if(statusNode){statusNode.remove();statusNode=null;}return;}
 if(!statusNode){statusNode=document.createElement('button');statusNode.type='button';statusNode.setAttribute('role','alert');statusNode.style.cssText='position:fixed;z-index:20000;top:env(safe-area-inset-top,0px);left:50%;transform:translateX(-50%);padding:12px 18px;background:#7e2424;color:white;border:2px solid white;border-radius:12px;font:600 14px system-ui;max-width:90vw';document.body.append(statusNode);}
 statusNode.textContent='Your ranch could not be saved. Tap to retry.';
 statusNode.title=String(status.message||'');statusNode.onclick=()=>void platform.flush().catch(()=>{});
}
function setActive(active){
 if(active===wasActive)return;wasActive=active;platform.paused=!active;
 if(!active){game?.pause?.();void platform.flush().catch(()=>{});}
 else game?.resume?.();
 window.dispatchEvent(new CustomEvent(active?'meadowlark:resume':'meadowlark:pause'));
}
platform.ready=(async()=>{
 if(native){
  const prefix='meadowlark-save-';
  const backend={
   async read(slot){try{const r=await Filesystem.readFile({path:prefix+slot+'.json',directory:Directory.Library,encoding:Encoding.UTF8});return r.data;}catch(error){if(error.code==='OS-PLUG-FILE-0008')return null;throw error;}},
   async write(slot,data){await Filesystem.writeFile({path:prefix+slot+'.json',directory:Directory.Library,encoding:Encoding.UTF8,data});}
  };
  // One-time migration of this app's own WebView save. Safari has a separate origin.
  const seed={};for(const key of SAVE_KEYS){try{const value=window.localStorage.getItem(key);if(value!==null)seed[key]=value;}catch{/* Durable files remain authoritative when WebView storage is unavailable. */}}
  platform.storage=await createSaveStore({backend,seed,onStatus:showStatus});
  platform.flush=()=>platform.storage.flush();
  await App.addListener('appStateChange',({isActive})=>setActive(isActive));
  const initial=await App.getState();setActive(initial.isActive);
 }else{
  // A staged-browser preview uses browser persistence; it does not prove native durability.
  const storage=window.localStorage;
  platform.storage={getItem:k=>storage.getItem(k),setItem:(k,v)=>storage.setItem(k,v),removeItem:k=>storage.removeItem(k),clear(){for(const k of SAVE_KEYS)storage.removeItem(k);},key:i=>SAVE_KEYS.filter(k=>storage.getItem(k)!==null)[i]??null,get length(){return SAVE_KEYS.filter(k=>storage.getItem(k)!==null).length;}};
 }
 document.addEventListener('visibilitychange',()=>setActive(!document.hidden));
 window.addEventListener('pagehide',()=>setActive(false));
 window.addEventListener('pageshow',()=>setActive(!document.hidden));
 window.dispatchEvent(new CustomEvent('meadowlark:native-ready'));
 return platform;
})().catch(error=>{
 window.__gameModuleBlocked=true;
 const show=()=>{const load=document.getElementById('load');if(load){load.textContent='Your saved ranch could not be opened. Existing files are safe. Restart the app to retry.';}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
 showStatus({state:'error',message:error.message});if(statusNode){statusNode.textContent='Your saved ranch could not be opened. Tap to restart safely.';statusNode.onclick=()=>location.reload();}throw error;
});
