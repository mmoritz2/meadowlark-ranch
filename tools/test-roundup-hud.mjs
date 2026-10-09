import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roundupPace,roundupNextAttempt} from '../assets/roundup-presentation.mjs';

// Execute the real UI installer with an inert scene and a small DOM model that
// disconnects replaced children. No browser, renderer or production save is used.
const source=fs.readFileSync(new URL('../assets/features/roundup-upgrade.js',import.meta.url),'utf8')
 .replace(/^import .*;$/gm,'').replace(/^export /gm,'');
function dom(){
 const document={activeElement:null};
 const match=(n,s)=>s[0]==='.'?n.className.split(/\s+/).includes(s.slice(1)):s[0]==='#'?n.id===s.slice(1):n.tagName.toLowerCase()===s;
 function node(tag){
  const n={tagName:tag.toUpperCase(),id:'',className:'',style:{display:''},dataset:{},attributes:{},children:[],parentNode:null,onclick:null};
  n.classList={contains:k=>n.className.split(/\s+/).includes(k),add(k){if(!this.contains(k))n.className=(n.className+' '+k).trim();},remove(k){n.className=n.className.split(/\s+/).filter(x=>x!==k).join(' ');},toggle(k,on){const yes=on??!this.contains(k);yes?this.add(k):this.remove(k);return yes;}};
  n.setAttribute=(k,v)=>{n.attributes[k]=String(v);if(k==='id')n.id=String(v);if(k==='class')n.className=String(v);};n.getAttribute=k=>n.attributes[k];
  n.appendChild=c=>{c.parentNode=n;n.children.push(c);return c;};n.append=(...xs)=>xs.forEach(n.appendChild);
  n.contains=c=>c===n||n.children.some(x=>x.contains(c));
  n.focus=()=>{document.activeElement=n;};n.click=()=>n.onclick?.({currentTarget:n,target:n});
  Object.defineProperty(n,'isConnected',{get:()=>n===document.body||n===document.head||!!n.parentNode?.isConnected});
  const clear=()=>{for(const c of n.children){if(c.contains(document.activeElement))document.activeElement=document.body;c.parentNode=null;}n.children=[];n._text='';};
  Object.defineProperty(n,'textContent',{get:()=>n._text||n.children.map(c=>c.textContent).join(''),set:v=>{clear();n._text=String(v);}});
  Object.defineProperty(n,'innerHTML',{get:()=>n._html||'',set:html=>{
   clear();n._html=String(html);const stack=[n];
   for(const token of String(html).matchAll(/<\/?[^>]+>|[^<]+/g)){
    const value=token[0];if(value.startsWith('</')){if(stack.length>1)stack.pop();continue;}
    if(value.startsWith('<')){const name=/^<([\w-]+)/.exec(value)?.[1];if(!name)continue;const child=node(name);
     for(const a of value.matchAll(/([\w-]+)="([^"]*)"/g))child.setAttribute(a[1],a[2]);stack.at(-1).appendChild(child);
     if(!/\/$/.test(value.slice(0,-1))&&!['input','br','hr'].includes(name))stack.push(child);
    }else{const text=node('#text');text._text=value;stack.at(-1).appendChild(text);}
   }
  }});
  n.querySelectorAll=selector=>{const parts=selector.split(/\s+/),all=[];const walk=p=>{for(const c of p.children){all.push(c);walk(c);}};walk(n);
   return all.filter(c=>{if(!match(c,parts.at(-1)))return false;let p=c.parentNode;for(let i=parts.length-2;i>=0;i--){while(p&&!match(p,parts[i]))p=p.parentNode;if(!p)return false;p=p.parentNode;}return true;});};
  n.querySelector=s=>n.querySelectorAll(s)[0]||null;return n;
 }
 document.head=node('head');document.body=node('body');document.activeElement=document.body;document.createElement=node;
 document.getElementById=id=>document.body.querySelector('#'+id)||document.head.querySelector('#'+id);return document;
}
function fixture(){
 const document=dom(),hooks=new Map(),panels=new Map(),actions=new Map(),timers=new Map(),trace={cancels:0,opens:[],retry:0};let nextTimer=0;
 const state={active:true,runId:'one',mode:'beginner',name:'Gentle Roundup',timeLimit:120,goldTimeLimit:78,timeLeft:110,elapsed:10,countdown:0,total:3,penned:0,pending:null,lastResult:null,pen:{x:-44,z:-8},
  target:{name:'Juniper',standX:-90,standZ:2,x:-80,z:0,pressure:'circle behind'}};
 const G={roundup:{state:()=>structuredClone(state),cancel(){trace.cancels++;state.active=false;G.run('roundupCancel');},start(){return false;},retrySave(){trace.retry++;}},
  on(name,fn){const list=hooks.get(name)||[];list.push(fn);hooks.set(name,list);},run(name,...args){for(const fn of hooks.get(name)||[])fn(...args);},toast(){},
  hidePanels(){for(const id of panels.keys())document.getElementById(id).style.display='none';},
  ui:{panel(def){panels.set(def.id,def);const n=document.createElement('div');n.id=def.id;n.style.display='none';document.body.append(n);},action:(name,fn)=>actions.set(name,fn),open(id){G.hidePanels();const p=document.getElementById(id);p.innerHTML=panels.get(id).render();p.style.display='flex';trace.opens.push(id);}},
  seFrame:{screens:new Set(),settle(){}},scene:{add(marker){trace.marker=marker;}},world:{miniMarkers:[],groundH:()=>0},
  THREE:{RingGeometry:class{},MeshBasicMaterial:class{constructor(){this.color={set(){}};}},Mesh:class{constructor(_g,material){this.material=material;this.position={set(){}};this.rotation={};}}}};
 const install=Function('document','MutationObserver','roundupPace','roundupNextAttempt','setTimeout','clearTimeout',source+'\nreturn install;')(
  document,class{observe(){}},roundupPace,roundupNextAttempt,fn=>{timers.set(++nextTimer,fn);return nextTimer;},id=>timers.delete(id));
 install(G);const hud=document.getElementById('roundupGuide');
 const pending=runId=>({runId,mode:'beginner',name:'Gentle Roundup',penned:3,total:3,time:60,remaining:60,score:1200,medal:'gold',pay:540,gems:1,keys:0,saved:false});
 return {G,state,trace,document,hud,pending,paint:()=>G.run('tick',.15),flush(){for(const [id,fn]of timers){timers.delete(id);fn();}}};
}

test('elapsed and pressure updates preserve the focused HUD button and refresh real text',()=>{
 const f=fixture(),button=f.hud.querySelector('button');button.focus();const before=f.hud.textContent;
 for(let i=0;i<8;i++){f.state.elapsed+=.15;f.state.timeLeft-=.15;f.state.target.pressure=i%2?'guiding':'too close';f.state.target.name=i%2?'Maple':'Juniper';f.paint();
  assert.equal(f.hud.querySelector('button'),button,'the live paint must retain its actual actionable node');assert.equal(f.document.activeElement,button);assert.equal(button.isConnected,true);
 }
 assert.notEqual(f.hud.textContent,before);assert.match(f.hud.textContent,/Maple/);assert.match(f.hud.textContent,/Good angle/);assert.equal(button.textContent,'Leave');assert.equal(button.getAttribute('aria-label'),'Leave roundup');
 button.click();assert.equal(f.trace.cancels,1);
});

test('pending state preserves button identity, focus and an explicit result reopening action',()=>{
 const f=fixture(),button=f.hud.querySelector('button');button.focus();f.state.pending=f.pending('one');f.state.target=null;f.G.run('roundupSavePending',f.state.pending);
 assert.equal(f.hud.querySelector('button'),button);assert.equal(f.document.activeElement,button);assert.equal(button.textContent,'Result');assert.equal(button.getAttribute('aria-label'),'View pending roundup result');assert.equal(f.hud.dataset.pending,'true');assert.equal(f.G.world.miniMarkers[0].hidden(),true,'The finished horse no longer has a pressure marker on the minimap');
 f.flush();assert.equal(f.document.getElementById('roundupResultPanel').style.display,'flex');f.G.hidePanels();button.click();f.flush();
 assert.equal(f.trace.cancels,0);assert.equal(f.trace.retry,0);assert.equal(f.document.getElementById('roundupResultPanel').style.display,'flex');assert.equal(f.G.roundupUI.state().receiptId,'one');
 assert.match(f.document.getElementById('roundupResultPanel').textContent,/Retry save/);
});

test('the persistent button reads current state even before the next throttled paint',()=>{
 const f=fixture(),button=f.hud.querySelector('button');assert.equal(button.textContent,'Leave');f.state.pending=f.pending('new-proof');f.state.target=null;
 button.click();f.flush();assert.equal(f.trace.cancels,0,'stale Leave text cannot cancel a pending result');assert.equal(f.G.roundupUI.state().receiptId,'new-proof');
 f.G.hidePanels();f.state.pending=null;button.click();assert.equal(f.trace.cancels,1,'the same handler returns to cancel for an active unsaved run');
});


test('a blocked approach hides the pressure ring and explains how to circle for a clear route',()=>{
 const f=fixture();f.state.target.approachBlocked=true;f.state.target.standX=null;f.state.target.standZ=null;f.paint();
 assert.equal(f.trace.marker.visible,false);assert.match(f.hud.querySelector('.round-hint').textContent,/Circle around Juniper/);
 assert.doesNotMatch(f.hud.querySelector('.round-hint').textContent,/gold ring/);
 f.state.target.approachBlocked=false;f.state.target.standX=-90;f.state.target.standZ=2;f.paint();assert.equal(f.trace.marker.visible,true);
});
