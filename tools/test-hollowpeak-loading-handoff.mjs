import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Portable checkout test: actual entry/loading snippets, no artifact fixtures or network.
const checkout=new URL('../',import.meta.url);
const entry=await readFile(new URL('ranch3d.html',checkout),'utf8');
const loading=await readFile(new URL('assets/game-loading.js',checkout),'utf8');
const oneLine=needle=>{const rows=entry.split('\n').filter(l=>l.includes(needle));assert.equal(rows.length,1,'One production source line: '+needle);return rows[0];};
const initialize=oneLine('let hollowpeakStartupReady=false;');
const setLoadLine=oneLine('const setLoad=(f,label)=>');
const currentBody="if(f>=1){if(hollowpeakStartupReady)window.GameLoading?.ready();else window.GameLoading?.stage('Finishing the mountain landscape…');}";
assert.equal(setLoadLine.split(currentBody).length,2,'Loading completion uses complete late handoff');
const HORSE="  window.__setLoad?.(1,'ready!');\n  if(hollowpeakStartupReady)$('load')?.remove();";
assert.equal(entry.split(HORSE).length,2,'Actual horse completion uses complete late handoff');
const tickLine=oneLine('if(hollowpeakStartupReady&&(!USE_GEN_HORSE');
const finishLine=oneLine('G.world.hollowpeakRuntimeReady=');
assert.equal(finishLine.split('finalizeHollowpeakAnchorGrounding({G,runtime:value});hollowpeakStartupReady=true;').length,2,'UI complete is assigned only after successful late finalizer');
assert(finishLine.includes("window.__setLoad?.(1,'ready!');"),'Successful world handoff reuses progress adapter');
const FAIL="window.GameLoading?.fail('The mountain landscape could not finish loading.');";
assert.equal(entry.split(FAIL).length,2,'Actual landscape failure callback');

function setup({generatedHorse=true,anchorFails=false,control=null}={}){
 let now=0,removed=false,reloads=0;const timers=[],nodes={};
 for(const id of ['load','loadpct','loadTitle','loadRetry','loadHelp']){const classes=new Set();nodes[id]={textContent:'',hidden:id==='loadRetry'||id==='loadHelp',classes,classList:{add:k=>classes.add(k)},remove(){if(id==='load')removed=true;},focus(){}};}
 const runtime={status:'field-ready'},player={mesh:{}},RIG={ready:false,loadingBreed:true,attachedTo:null},world={};
 const context={window:{},document:{getElementById:id=>id==='load'&&removed?null:nodes[id]??null,visibilityState:'visible',addEventListener(){}},performance:{now:()=>now},location:{reload(){reloads++;}},setTimeout:fn=>timers.push(fn),console:{error(){}},G:{world},FALLS:{},hollowpeakRuntime:runtime,USE_GEN_HORSE:generatedHorse,RIG,player,finishHollowpeakRuntime:async()=>{runtime.status='ready';return runtime;},finalizeHollowpeakAnchorGrounding(){if(anchorFails)throw Error('late source/contact finalizer rejected');return{status:'applied-same-owner'};}};
 context.$=context.document.getElementById;vm.createContext(context);vm.runInContext(loading,context,{filename:'actual-game-loading.js'});vm.runInContext(initialize,context);
 // Explicit negative controls restore only previously faulty UI guard policies.
 const guards=source=>control==='physical-status'?source.replaceAll('if(hollowpeakStartupReady)',"if(hollowpeakRuntime.status==='ready')").replace('if(hollowpeakStartupReady&&',"if(hollowpeakRuntime.status==='ready'&&"):source;
 let adapter=guards(setLoadLine);if(control==='former-early-ready')adapter=adapter.replace(currentBody,"if(f>=1)window.GameLoading?.ready();");
 vm.runInContext(adapter+'\nwindow.__setLoad=setLoad;setLoad(.05,\'reading the map…\');',context);
 return{runtime,horse(){RIG.ready=true;RIG.loadingBreed=false;RIG.attachedTo=player.mesh;vm.runInContext(guards(HORSE),context);},async world(){vm.runInContext(finishLine,context);await world.hollowpeakRuntimeReady;},tick(){vm.runInContext("{const ld=$('load');if(ld){"+guards(tickLine)+'}}',context);},fail(){vm.runInContext(FAIL,context);},timers(ms){for(let elapsed=0;elapsed<ms&&timers.length;elapsed+=500){now+=500;timers.shift()();}},snapshot(){return{removed,status:runtime.status,uiComplete:vm.runInContext('hollowpeakStartupReady',context),readyClass:nodes.load.classes.has('load-ready'),failedClass:nodes.load.classes.has('load-failed'),label:nodes.loadpct.textContent,title:nodes.loadTitle.textContent,retryHidden:nodes.loadRetry.hidden,helpHidden:nodes.loadHelp.hidden,timersRemaining:timers.length,reloads,error:world.hollowpeakRuntimeError??null};}};
}

test('former early horse-ready policy suppresses later failures in the unchanged loader',()=>{
 const old=setup({control:'former-early-ready'});old.horse();old.timers(16000);old.fail();const s=old.snapshot();
 assert(!s.removed&&s.readyClass&&!s.failedClass&&s.retryHidden);assert.equal(s.timersRemaining,0);
});
test('horse-first and complete-world-first both succeed only at the combined handoff',async()=>{
 const a=setup();a.horse();assert(!a.snapshot().removed&&!a.snapshot().readyClass);await a.world();assert(a.snapshot().removed&&a.snapshot().readyClass&&a.snapshot().uiComplete);
 const b=setup();await b.world();assert(!b.snapshot().removed&&!b.snapshot().readyClass&&b.snapshot().uiComplete);b.horse();assert(b.snapshot().removed&&b.snapshot().readyClass);
});
test('physical-ready alone keeps both curtain and actual slow-loading retry active',()=>{
 const c=setup();c.horse();c.runtime.status='ready';c.tick();c.timers(16000);const s=c.snapshot();assert(!s.removed&&!s.readyClass&&!s.retryHidden&&!s.helpHidden&&!s.uiComplete);assert.equal(s.label,'Finishing the mountain landscape…');
});
test('landscape failure after horse completion remains visible and retryable',()=>{
 const c=setup();c.horse();c.fail();c.tick();const s=c.snapshot();assert(s.failedClass&&!s.readyClass&&!s.removed&&!s.retryHidden);assert.equal(s.label,'The mountain landscape could not finish loading.');assert.equal(s.title,'Let’s try that again');
});
test('failure before horse completion cannot be hidden by its later callback',()=>{
 const c=setup();c.fail();c.horse();c.tick();const s=c.snapshot();assert(s.failedClass&&!s.readyClass&&!s.retryHidden&&!s.removed);
});
test('late anchor rejection reproduces the old physical-status curtain escape',async()=>{
 const c=setup({control:'physical-status',anchorFails:true});c.horse();await c.world();assert(c.snapshot().failedClass&&!c.snapshot().removed);c.tick();assert(c.snapshot().removed);assert.equal(c.snapshot().status,'ready');
});
test('late anchor rejection preserves error/retry and blocks tick plus later horse removal',async()=>{
 const c=setup({anchorFails:true});c.horse();await c.world();c.tick();c.horse();const s=c.snapshot();assert(s.failedClass&&!s.readyClass&&!s.removed&&!s.retryHidden&&!s.uiComplete);assert.equal(s.status,'ready');assert.match(s.error,/finalizer rejected/);
});
test('non-generated horse completes with successful late world handoff',async()=>{
 const c=setup({generatedHorse:false});await c.world();const s=c.snapshot();assert(s.removed&&s.readyClass&&s.uiComplete&&s.retryHidden);
});
