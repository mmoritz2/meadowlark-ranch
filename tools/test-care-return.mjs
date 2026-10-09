import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Exercise the actual overview detour callback without a browser or horse rig.
const source=fs.readFileSync(new URL('../assets/features/se-care.js',import.meta.url),'utf8');
const start=source.indexOf(' function openOther(what){'),end=source.indexOf(' function rideHorse(i){',start);
assert(start>=0&&end>start,'production Care return boundary');
const code=source.slice(start,end);
function fixture(){
 let horses=[{id:'willow'},{id:'fern'},{id:'clover'}],riding=0,back=null;
 const caller=()=>{},ST={tab:'equipment',onBack:caller,backLabel:'Back to event'},body={scrollTop:87};
 const calls={selected:[],opened:[],destinations:[],closed:0};
 const selector={value:'0',onchange(){riding=Number(this.value);calls.selected.push(horses[riding]?.id);}};
 const G={horse:{rideIdx:()=>riding},seFrame:{setBack(id,fn){back=fn;calls.destinations.push(id);}},
  seMarket:{setBack(fn){back=fn;}},ui:{openStable(){calls.destinations.push('stable');},dispatch(cmd){calls.destinations.push(cmd);}},
  ridingModes:{open(options){back=options.onBack;}}};
 const openOther=Function('G','ST','$','fresh','close','open',code+';return openOther;')(G,ST,
  id=>id==='horseSel'?selector:body,()=>({horses}),()=>{calls.closed++;ST.onBack=null;},
  (tab,options)=>{body.scrollTop=0;calls.opened.push({tab,options,horseId:horses[riding]?.id});});
 return {openOther,calls,body,caller,get horses(){return horses;},set horses(v){horses=v;},
  get riding(){return riding;},set riding(v){riding=v;},takeBack(){const fn=back;back=null;return fn;},return(){assert(back,'a real return callback was installed');back();}};
}

test('Stable return keeps the deliberately selected horse and caller context',()=>{
 const f=fixture();f.openOther('stable');f.riding=1;f.return();
 assert.equal(f.riding,1);assert.deepEqual(f.calls.selected,[]);
 assert.equal(f.calls.opened[0].horseId,'fern');assert.equal(f.calls.opened[0].tab,'equipment');
 assert.equal(f.calls.opened[0].options.onBack,f.caller);assert.equal(f.calls.opened[0].options.label,'Back to event');
 assert.equal(f.body.scrollTop,87);assert.equal(f.calls.closed,1);
});
test('Stable return preserves a new selection after herd changes',()=>{
 const f=fixture();f.openOther('stable');f.horses=[f.horses[2],f.horses[0],f.horses[1]];f.riding=0;f.return();
 assert.equal(f.calls.opened[0].horseId,'clover');assert.deepEqual(f.calls.selected,[]);
});
test('equipment return still restores its original horse by identity after reordering',()=>{
 const f=fixture();f.openOther('tack');assert(f.calls.destinations.includes('ranch:tack:0'));
 f.horses=[f.horses[1],f.horses[2],f.horses[0]];f.riding=0;f.return();
 assert.equal(f.riding,2);assert.deepEqual(f.calls.selected,['willow']);assert.equal(f.calls.opened[0].horseId,'willow');
 assert.equal(f.body.scrollTop,87);
});
test('detour return never substitutes a removed horse or an unrideable foal',()=>{
 for(const removed of [true,false]){
  const f=fixture();f.openOther('tack');
  if(removed)f.horses=f.horses.slice(1);else{f.horses[0].foal=true;f.riding=1;}
  f.return();assert.deepEqual(f.calls.selected,[]);assert.equal(f.calls.opened[0].horseId,'fern');
 }
});

const stableSource=fs.readFileSync(new URL('../assets/features/se-horses.js',import.meta.url),'utf8');
const primaryStart=stableSource.indexOf(' function doPrimary(which){'),primaryEnd=stableSource.indexOf(' function doChip(key){',primaryStart);
assert(primaryStart>=0&&primaryEnd>primaryStart,'production Stable primary-action boundary');
const primaryCode=stableSource.slice(primaryStart,primaryEnd);
function stablePrimary(f,{legacy=true}={}){
 const timers=[],calls=[],selector={value:'0',onchange(){f.riding=Number(this.value);calls.push('select');}};
 const G={horse:{rideIdx:()=>f.riding},hidePanels:()=>calls.push('hide')};
 const K={takeBack(id){assert.equal(id,'stablePanel');calls.push('take-back');const fn=f.takeBack();return fn?()=>{calls.push('return');fn();}:null;}};
 const bindings={G,K,S:()=>({horses:f.horses}),idxOf:(s,id)=>s.horses.findIndex(h=>h.id===id),st:{sel:'fern'},
  stateOf:(h,i,ri)=>i===ri?'ridden':'adult',via:sel=>{if(!legacy)return false;assert.equal(sel,'[data-st="ride:1"]');f.riding=1;calls.push('select');return true;},
  $:()=>selector,setTimeout:fn=>timers.push(fn),openOverview:()=>calls.push('overview'),openSheet:()=>calls.push('sheet')};
 const primary=Function(...Object.keys(bindings),primaryCode+';return doPrimary;')(...Object.values(bindings));
 return {primary,calls,flush(){while(timers.length)timers.shift()();}};
}
test('Stable Ride returns through the actual Care callback with the newly selected horse',()=>{
 for(const legacy of [true,false]){
  const f=fixture();f.openOther('stable');const stable=stablePrimary(f,{legacy});stable.primary('primary');
  assert.equal(f.riding,1);assert.equal(f.calls.opened.length,0,'defer return until the Stable action finishes');
  stable.flush();assert.equal(f.calls.opened[0].horseId,'fern');assert.equal(f.calls.opened[0].options.onBack,f.caller);
  assert.deepEqual(stable.calls,['select','take-back','hide','return']);assert.equal(f.takeBack(),null,'return is consumed once');
  assert.deepEqual(f.calls.selected,[],'Care never switches back to the old horse');
 }
});
test('ordinary Stable Ride closes to riding when there is no registered caller',()=>{
 const f=fixture(),stable=stablePrimary(f);stable.primary('primary');stable.flush();
 assert.equal(f.riding,1);assert.deepEqual(stable.calls.filter(c=>c==='hide'||c==='return'),['hide']);assert.deepEqual(f.calls.opened,[]);
});
test('Stable secondary action retains its existing Overview flow',()=>{
 const f=fixture();f.openOther('stable');const stable=stablePrimary(f);stable.primary('secondary');stable.flush();
 assert.deepEqual(stable.calls,['overview']);assert.equal(typeof f.takeBack(),'function','secondary action does not consume the Stable caller');
});
