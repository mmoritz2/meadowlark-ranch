// Shared original foam density image. Only synchronous Three texture/UUID
// construction uses private randomness; image decoding runs after restoration.
const caches=new WeakMap();
function privateRandom(key){let s=2166136261;for(let i=0;i<key.length;i++)s=Math.imul(s^key.charCodeAt(i),16777619);return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function constructVisual(key,make){const previous=Math.random;Math.random=privateRandom('cascade-foam-texture|'+key);try{return make();}finally{Math.random=previous;}}
export function loadCascadeFoamTexture({THREE:T,url}){
 const key=String(url);let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache);}const previous=cache.get(key);if(previous)return previous.promise;
 const entry={status:'loading',texture:null,width:0,height:0,promise:null};cache.set(key,entry);
 entry.promise=new Promise(resolve=>{
  let done=false,pendingTexture=null;
  const fail=()=>{if(done)return;done=true;entry.status='fallback';entry.texture=null;try{pendingTexture?.dispose();}catch{}resolve(null);};
  const ready=async texture=>{
   if(done)return;
   try{
    const image=texture?.image;if(!image)throw Error('Foam image missing');
    if(typeof image.decode==='function')await image.decode();
    if(done)return;
    const width=Number(image.naturalWidth||image.width),height=Number(image.naturalHeight||image.height);if(!(width>0&&height>0))throw Error('Foam image dimensions missing');
    texture.name='Water | original cascade foam density';texture.colorSpace=T.NoColorSpace;texture.wrapS=T.RepeatWrapping;texture.wrapT=T.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;
    entry.texture=texture;entry.width=width;entry.height=height;entry.status='ready';done=true;resolve(texture);
   }catch{fail();}
  };
  // Always defer callbacks: even a synchronous cache callback must decode after
  // the visual constructor section has restored the real gameplay generator.
  try{pendingTexture=constructVisual(key,()=>new T.TextureLoader().load(key,texture=>{Promise.resolve().then(()=>ready(texture));},undefined,()=>{Promise.resolve().then(fail);}));}catch{Promise.resolve().then(fail);}
 });
 return entry.promise;
}
export function cascadeFoamTextureStatus({THREE:T,url}){const entry=caches.get(T)?.get(String(url));return entry?{status:entry.status,width:entry.width,height:entry.height}:{status:'idle',width:0,height:0};}
