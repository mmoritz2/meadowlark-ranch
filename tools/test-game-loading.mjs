import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../assets/game-loading.js',import.meta.url),'utf8');
function fixture(){
 let now=0,next,reloads=0;
 const nodes=Object.fromEntries(['load','loadTitle','loadpct','loadRetry','loadHelp'].map(id=>[id,{hidden:true,textContent:'',classList:new Set()}]));
 const document={visibilityState:'visible',getElementById:id=>nodes[id],addEventListener(){}};
 const window={};
 vm.runInNewContext(source,{window,document,performance:{now:()=>now},location:{reload:()=>reloads++},setTimeout:fn=>{next=fn;}});
 return {window,document,nodes,advance(ms){for(let n=0;n<ms;n+=500){now+=500;const tick=next;next=null;tick?.();}},get reloads(){return reloads;}};
}
test('slow imports remain loading, preserve their stage, and offer retry without claiming failure',()=>{
 const f=fixture();f.window.GameLoading.stage('Loading your horse…');f.advance(10000);
 assert.equal(f.nodes.loadpct.textContent,'Loading your horse…');assert(!f.nodes.load.classList.has('load-failed'));assert(f.nodes.loadRetry.hidden);
 f.advance(5000);assert(!f.nodes.loadRetry.hidden);assert(!f.nodes.load.classList.has('load-failed'));assert.equal(f.nodes.loadpct.textContent,'Loading your horse…');
 f.nodes.loadRetry.onclick();assert.equal(f.reloads,1);
 f.window.GameLoading.ready();assert(f.nodes.load.classList.has('load-ready'));assert.equal(f.nodes.loadpct.textContent,'Your horse is ready');
});
test('background time does not trigger slow-connection advice',()=>{
 const f=fixture();f.document.visibilityState='hidden';f.advance(60000);assert(f.nodes.loadRetry.hidden);
 f.document.visibilityState='visible';f.advance(14500);assert(f.nodes.loadRetry.hidden);f.advance(500);assert(!f.nodes.loadRetry.hidden);
});
test('a real model/import failure keeps a retry action and cannot be overwritten by late progress',()=>{
 const f=fixture();f.window.GameLoading.fail('Your horse could not finish loading.');f.window.GameLoading.stage('Loading');f.window.GameLoading.ready();f.advance(20000);
 assert(f.nodes.load.classList.has('load-failed'));assert(!f.nodes.load.classList.has('load-ready'));assert(!f.nodes.loadRetry.hidden);assert.match(f.nodes.loadpct.textContent,/could not finish/);
});
