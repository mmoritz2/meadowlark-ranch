// TMP explicit material lifecycle. No frame polling or whole-scene discovery.
// Install tracking after the rider adapter has installed its final public methods.
export function createRiderMaterialLifecycle() {
 const live=new Map();let connection=null,enabled=true,disposed=false,generation=0;
 const stats={tracked:0,changes:0,notifications:0,registrations:0,unregistered:0,connections:0,replacements:0};
 const methodNames=['setOutfit','setLook','setHair','setHelmet','refreshAccessories','setBoots'];
 function flush(record){
  if(!record.dirty||record.depth||record.closed||!live.has(record.rig))return;
  record.dirty=false;record.revision++;stats.notifications++;
  if(connection){connection.receiver.registerRider(record.rig);stats.registrations++;}
 }
 function changed(rig,reason='materials'){
  const record=live.get(rig);if(!record||record.closed||rig.disposed)return false;
  record.dirty=true;record.reasons.add(reason);stats.changes++;flush(record);return true;
 }
 function batch(rig,fn){
  const record=live.get(rig);if(!record||record.closed)return fn();
  record.depth++;try{return fn();}finally{record.depth--;flush(record);}
 }
 function dropRig(rig){
  const record=live.get(rig);if(!record)return false;
  record.closed=true;record.dirty=false;live.delete(rig);
  if(connection){connection.receiver.unregisterRider(rig);stats.unregistered++;}
  for(const [name,h]of record.hooks)if(rig[name]===h.wrapper)rig[name]=h.original;
  record.hooks.clear();return true;
 }
 function trackRig(rig){
  if(disposed)throw Error('Rider material lifecycle disposed');
  if(!rig?.root||!rig.body||rig.disposed)throw Error('Live actual rider rig required');
  if(live.has(rig))return rig;
  const record={rig,depth:0,dirty:false,closed:false,revision:0,reasons:new Set(),hooks:new Map()};live.set(rig,record);stats.tracked++;
  for(const name of methodNames){
   const original=rig[name];if(typeof original!=='function')continue;
   const wrapper=function(...args){return batch(rig,()=>{try{return original.apply(this,args);}finally{changed(rig,name);}});};
   record.hooks.set(name,{original,wrapper});rig[name]=wrapper;
  }
  const original=rig.dispose;
  if(typeof original==='function'){
   const wrapper=function(...args){dropRig(rig);return original.apply(this,args);};
   record.hooks.set('dispose',{original,wrapper});rig.dispose=wrapper;
  }
  changed(rig,'build');return rig;
 }
 function detach(which=connection){
  if(!which||connection!==which)return false;
  connection=null;
  for(const rig of live.keys()){which.receiver.unregisterRider(rig);stats.unregistered++;}
  which.receiver.dispose();return true;
 }
 function connectReceiver(receiver){
  if(disposed)throw Error('Rider material lifecycle disposed');
  if(!receiver||['registerRider','unregisterRider','dispose','setEnabled'].some(k=>typeof receiver[k]!=='function'))throw Error('Complete rider AO receiver required');
  if(connection?.receiver===receiver)return connection.handle;
  if(connection){detach();stats.replacements++;}
  const next={receiver,generation:++generation,handle:null};
  next.handle=Object.freeze({generation:next.generation,dispose:()=>detach(next)});
  connection=next;stats.connections++;
  try{receiver.setEnabled(enabled);for(const rig of live.keys()){receiver.registerRider(rig);stats.registrations++;}}
  catch(error){detach(next);throw error;}
  return next.handle;
 }
 return {
  trackRig,changed,batch,dropRig,connectReceiver,
  replaceReceiver(factory){if(disposed)throw Error('Rider material lifecycle disposed');if(typeof factory!=='function')throw Error('Receiver factory required');if(connection)stats.replacements++;detach();return connectReceiver(factory());},
  disconnectReceiver(){return detach();},
  setEnabled(value){enabled=!!value;connection?.receiver.setEnabled(enabled);},
  has:rig=>live.has(rig),
  inspect(){return {disposed,enabled,liveRigs:live.size,connected:!!connection,generation:connection?.generation||null,stats:{...stats},rigs:[...live.values()].map(r=>({name:r.rig.root.name,body:r.rig.kit?.body||null,revision:r.revision,depth:r.depth,dirty:r.dirty,reasons:[...r.reasons],hookedMethods:[...r.hooks.keys()]}))};},
  dispose(){if(disposed)return;detach();for(const rig of [...live.keys()])dropRig(rig);disposed=true;}
 };
}
// One main world contact pipeline subscribes to this shared explicit live set.
// An application may inject its own registry into the adapter for isolated QA.
export const riderMaterialLifecycle15=createRiderMaterialLifecycle();
