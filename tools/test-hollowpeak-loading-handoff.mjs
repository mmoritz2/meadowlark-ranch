import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Portable checkout test; no browser/network/output files or generated fixtures.
const checkout=new URL('../',import.meta.url);
const entry=await readFile(new URL('ranch3d.html',checkout),'utf8');
const loading=await readFile(new URL('assets/game-loading.js',checkout),'utf8');
const lines=entry.split('\n').filter(l=>l.includes('const setLoad=(f,label)=>'));
assert.equal(lines.length,1,'One production loading progress adapter');
const setLoadLine=lines[0];
const newBody="if(f>=1){if(hollowpeakRuntime.status==='ready')window.GameLoading?.ready();else window.GameLoading?.stage('Finishing the mountain landscape…');}";
assert.equal(setLoadLine.split(newBody).length,2,'Completion waits for actual runtime readiness');
// This explicit old control restores only the former early-completion branch;
// successful cases execute the current production source excerpt unchanged.
const legacySetLoadLine=setLoadLine.replace(newBody,"if(f>=1)window.GameLoading?.ready();");
const finishLine=entry.split('\n').find(l=>l.startsWith('G.world.hollowpeakRuntimeReady='));
assert(finishLine,'Actual world completion owner');
const match=finishLine.match(/\.then\(value=>\{([\s\S]*?)\}\)\.catch/);
assert(match,'Actual runtime success callback');
assert(match[1].includes("window.__setLoad?.(1,'ready!');"),'World success completes the same progress adapter');
const finishExpression='.then(value=>{'+match[1]+'})';
const HORSE="  window.__setLoad?.(1,'ready!');\n  if(hollowpeakRuntime.status==='ready')$('load')?.remove();";
const FAIL="window.GameLoading?.fail('The mountain landscape could not finish loading.');";
assert.equal(entry.split(HORSE).length,2,'Actual unchanged mounted-horse completion callback');
assert.equal(entry.split(FAIL).length,2,'Actual landscape failure callback');

function setup(updated,{generatedHorse=true}={}){
 let now=0,removed=false,reloads=0;const timers=[],nodes={};for(const id of['load','loadpct','loadTitle','loadRetry','loadHelp']){const classes=new Set();nodes[id]={id,textContent:'',hidden:id==='loadRetry'||id==='loadHelp',classList:{add:k=>classes.add(k),has:k=>classes.has(k)},classes,remove(){if(id==='load')removed=true;},focus(){}};}
 const window={},document={getElementById:id=>id==='load'&&removed?null:nodes[id]??null,visibilityState:'visible',addEventListener(){}},context={window,document,performance:{now:()=>now},location:{reload(){reloads++;}},setTimeout:fn=>timers.push(fn)};vm.runInNewContext(loading,context,{filename:'actual-game-loading.js'});
 const runtime={status:'field-ready'},player={mesh:{}},RIG={ready:false,loadingBreed:true,attachedTo:null},$=document.getElementById,edge=updated?setLoadLine:legacySetLoadLine,setLoad=Function('window','hollowpeakRuntime',edge+'\nwindow.__setLoad=setLoad;return setLoad;')(window,runtime),finishText=finishExpression,finishBody=finishText.slice('.then(value=>{'.length,-2),finish=Function('window','USE_GEN_HORSE','RIG','player','$','value',finishBody),horse=Function('window','hollowpeakRuntime','$',HORSE),fail=Function('window',FAIL);
 setLoad(.05,'reading the map…');
 return{window,nodes,runtime,RIG,player,horse(){RIG.ready=true;RIG.loadingBreed=false;RIG.attachedTo=player.mesh;horse(window,runtime,$);},world(){runtime.status='ready';finish(window,generatedHorse,RIG,player,$,{status:'ready'});},fail(){fail(window);},timers(ms){for(let elapsed=0;elapsed<ms&&timers.length;elapsed+=500){now+=500;timers.shift()();}},snapshot(){return{removed,readyClass:nodes.load.classes.has('load-ready'),failedClass:nodes.load.classes.has('load-failed'),label:nodes.loadpct.textContent,title:nodes.loadTitle.textContent,retryHidden:nodes.loadRetry.hidden,helpHidden:nodes.loadHelp.hidden,help:nodes.loadHelp.textContent,timersRemaining:timers.length,reloads};}};
}

test('former early horse-ready call suppresses later world errors and retry in the actual loader',()=>{
 const old=setup(false);old.horse();old.timers(16000);old.fail();const s=old.snapshot();
 assert.equal(s.removed,false);assert.equal(s.readyClass,true);assert.equal(s.failedClass,false);assert.equal(s.retryHidden,true);assert.equal(s.label,'Your horse is ready');assert.equal(s.timersRemaining,0);
});
test('horse-first and runtime-first success complete only at the combined handoff',()=>{
 const a=setup(true);a.horse();assert(!a.snapshot().removed&&!a.snapshot().readyClass);a.world();assert(a.snapshot().removed&&a.snapshot().readyClass&&a.snapshot().retryHidden);
 const b=setup(true);b.world();assert(!b.snapshot().removed&&!b.snapshot().readyClass);b.horse();assert(b.snapshot().removed&&b.snapshot().readyClass&&b.snapshot().retryHidden);
});
test('pending landscape keeps the actual slow-loading retry timer alive',()=>{
 const c=setup(true);c.horse();assert.equal(c.snapshot().label,'Finishing the mountain landscape…');assert.equal(c.snapshot().readyClass,false);c.timers(16000);assert.equal(c.snapshot().retryHidden,false);assert.equal(c.snapshot().helpHidden,false);assert.equal(c.snapshot().removed,false);
});
test('world failure after horse completion remains visible and retryable',()=>{
 const c=setup(true);c.horse();c.fail();const s=c.snapshot();assert.equal(s.failedClass,true);assert.equal(s.readyClass,false);assert.equal(s.removed,false);assert.equal(s.retryHidden,false);assert.equal(s.label,'The mountain landscape could not finish loading.');assert.equal(s.title,'Let’s try that again');
});
test('failure before horse completion cannot be hidden by later horse progress',()=>{
 const c=setup(true);c.fail();c.horse();const s=c.snapshot();assert(s.failedClass&&!s.readyClass&&!s.retryHidden&&!s.removed);
});
test('non-generated-horse branch completes with runtime success without new global loader semantics',()=>{
 const c=setup(true,{generatedHorse:false});c.world();assert(c.snapshot().removed&&c.snapshot().readyClass&&c.snapshot().retryHidden);
});
