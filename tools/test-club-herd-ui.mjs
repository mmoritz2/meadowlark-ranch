import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const original=fs.readFileSync(new URL('./test-roundup-hud.mjs',import.meta.url),'utf8');
let domSource=original.slice(original.indexOf('function dom(){'),original.indexOf('function fixture(){'));
domSource=domSource.replace("const match=(n,s)=>", "const match=(n,s)=>s.startsWith('[data-')?n.getAttribute(s.slice(1,-1))!==undefined:");
domSource=domSource.replace("n.attributes[k]=String(v);", "n.attributes[k]=String(v);if(k.startsWith('data-'))n.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);");
domSource=domSource.replace("n.focus=()=>", "n.blur=()=>{if(document.activeElement===n)document.activeElement=document.body;};n.focus=()=>");
const makeDOM=Function(domSource+'return dom;')();
const source=fs.readFileSync(new URL('../assets/features/club-herd-ui.js',import.meta.url),'utf8').replace(/^export /gm,'');
const copy=v=>structuredClone(v);
function fixture(){
 const document=makeDOM(),hooks=new Map(),panels=new Map(),actions=new Map(),timers=new Map();let timer=0;
 const s={connected:true,reason:'',code:'MEADOW',lobbies:[],current:null,lastResult:null,notice:''};
 const calls=[],trace={closes:0,releases:0,opens:[],clubOpens:[],toasts:[]};
 const G={clubHerd:{snapshot:()=>copy(s)},on(k,fn){const a=hooks.get(k)||[];a.push(fn);hooks.set(k,a);},run(k,...a){for(const fn of hooks.get(k)||[])fn(...a);},toast:v=>trace.toasts.push(v),
  hidePanels(){trace.closes++;for(const id of panels.keys())document.getElementById(id).style.display='none';},riding:{releaseAll(){trace.releases++;}},seFrame:{screens:new Set(),settle(){}},clubHub:{open(t){trace.clubOpens.push(t);}},
  ui:{action:(k,fn)=>actions.set(k,fn),panel(def){panels.set(def.id,def);const n=document.createElement('div');n.id=def.id;n.style.display='none';document.body.append(n);},rerender(id){document.getElementById(id).innerHTML=panels.get(id).render();},open(id){G.hidePanels();this.rerender(id);document.getElementById(id).style.display='flex';trace.opens.push(id);}}};
 for(const k of ['host','join','ready','start','leave','stop','again','retrySave'])G.clubHerd[k]=(...args)=>{calls.push({k,args});return {ok:true};};
 const install=Function('document','MutationObserver','setTimeout','clearTimeout',source+'return install;')(document,class{observe(){}},fn=>{timers.set(++timer,fn);return timer;},id=>timers.delete(id));install(G);
 const current=()=>({id:'g1',hostId:'p1',host:'Mae',status:'waiting',hosted:true,ready:false,canStart:false,riding:false,paused:false,waitingForHost:false,elapsed:0,penned:0,total:5,roster:[{id:'p1',name:'Mae',slot:0,ready:false,online:true},{id:'p2',name:'Jess & <horse>',slot:1,ready:true,online:true}],guide:null});
 return {G,s,calls,trace,document,current,hud:document.getElementById('clubHerdHud'),panel:document.getElementById('clubHerdResultPanel'),act:(k,el)=>actions.get('clubherd')([k],el),paint:()=>G.run('tick',.2),flush(){for(const [id,fn]of timers){timers.delete(id);fn();}}};
}
const result={runId:'r1',elapsed:91.2,total:5,penned:5,participants:['Mae','Jess & <horse>'],saved:false,bestTime:null,newBest:false,reason:'Keep this tab open and retry saving.'};
test('offline and live lobby card uses only real roster names and explicit ready consent',()=>{
 const f=fixture();f.s.connected=false;f.s.reason='Connect to your club.';let html=f.G.clubHerdUI.section();assert.match(html,/clubherd:host[^>]*disabled/);assert.match(html,/Connect to your club/);
 f.s.connected=true;f.s.current=f.current();html=f.G.clubHerdUI.section();assert.match(html,/1 \/ 2 ready/);assert.match(html,/Jess &amp; &lt;horse&gt;/);assert.match(html,/Hosting marks you Ready/);assert.match(html,/clubherd:start[^>]*disabled/);assert(!html.includes('coins'));f.s.current.hosted=false;assert.match(f.G.clubHerdUI.section(),/Choose Ready to enter the pasture when Mae starts/);
 f.act('ready');assert.deepEqual(f.calls.at(-1),{k:'ready',args:[true]});f.s.current.ready=true;f.act('ready');assert.deepEqual(f.calls.at(-1),{k:'ready',args:[false]});
});
test('join sends the selected lobby identity and does not ready the guest',()=>{
 const f=fixture();f.s.lobbies=[{id:'room-42',host:'Mae',hostId:'p1',status:'waiting',canJoin:true,roster:[{id:'p1',name:'Mae',slot:0,ready:true,online:true}]}];assert.match(f.G.clubHerdUI.section(),/data-herd-id="room-42"/);f.act('join',{dataset:{herdId:'room-42'}});assert.deepEqual(f.calls,[{k:'join',args:['room-42']}]);
});
test('semantic clubhouse key ignores changing elapsed and guide positions but tracks readiness',()=>{
 const f=fixture();f.s.current=f.current();const before=f.G.clubHerdUI.sectionKey();f.s.current.elapsed=33;f.s.current.guide={name:'Maple',standX:1,standZ:2};assert.equal(f.G.clubHerdUI.sectionKey(),before);f.s.current.roster[0].ready=true;assert.notEqual(f.G.clubHerdUI.sectionKey(),before);
});
test('accepted riding transition closes menus once and keeps actual HUD Leave node and focus stable',()=>{
 const f=fixture();f.s.current={...f.current(),status:'riding',riding:true};f.G.run('clubHerdChanged');assert.equal(f.trace.closes,1);assert.equal(f.hud.hidden,false);const leave=f.hud.querySelector('button');leave.focus();
 for(let i=0;i<8;i++){f.s.current.elapsed+=.2;f.s.current.guide={name:'Maple',pressure:'guiding'};f.paint();assert.equal(f.hud.querySelector('button'),leave);assert.equal(f.document.activeElement,leave);}
 assert.equal(f.trace.closes,1);assert.match(f.hud.textContent,/Maple/);assert.match(f.hud.textContent,/Jess & <horse>/);f.s.current.hosted=false;f.s.current.paused=true;f.paint();assert.match(f.hud.textContent,/host has paused/);f.s.current.waitingForHost=true;f.paint();assert.match(f.hud.textContent,/Waiting for Mae/);leave.onclick({detail:1,currentTarget:leave});assert.equal(f.calls.at(-1).k,'leave');
});
test('finish panel shows unsaved record honestly, retry refreshes the confirmed personal best',()=>{
 const f=fixture();f.s.current={...f.current(),status:'finished',riding:true};f.s.lastResult=copy(result);f.G.run('clubHerdFinish',f.s.lastResult);f.flush();assert.equal(f.panel.style.display,'flex');assert.match(f.panel.textContent,/All five are home/);assert.match(f.panel.innerHTML,/clubherd:again[^>]*disabled/);assert.match(f.panel.textContent,/Retry save/);assert(!f.panel.textContent.includes('coins'));
 f.G.clubHerd.retrySave=()=>{f.calls.push({k:'retrySave',args:[]});f.s.lastResult={...result,saved:true,newBest:true,bestTime:91.2,reason:undefined};f.G.run('clubHerdChanged');return {ok:true};};f.act('save');assert.match(f.panel.textContent,/New personal best · saved/);assert.match(f.panel.textContent,/91.2s/);assert.doesNotMatch(f.panel.innerHTML,/clubherd:again[^>]*disabled/);f.act('again');assert.equal(f.calls.at(-1).k,'again');assert.deepEqual(f.trace.clubOpens,['activities']);assert.equal(f.panel.style.display,'none');
});
test('stale finish timers cannot interrupt a later gathering',()=>{
 const f=fixture();f.s.lastResult=copy(result);f.G.run('clubHerdFinish',f.s.lastResult);f.s.current=f.current();f.flush();assert.equal(f.panel.style.display,'none');assert.equal(f.trace.opens.length,0);
});
test('controller refusal keeps the current screen and explains the failed command',()=>{
 const f=fixture();f.G.clubHerd.host=()=>({ok:false,reason:'Join your club first.'});f.act('host');assert.deepEqual(f.trace.toasts,['Join your club first.']);assert.equal(f.trace.closes,0);
});

test('Free ride releases a finished core but preserves the unsaved result for reopening',()=>{
 const f=fixture();f.s.current={...f.current(),status:'finished',riding:true};f.s.lastResult=copy(result);f.G.run('clubHerdFinish',f.s.lastResult);f.flush();
 f.G.clubHerd.stop=()=>{f.calls.push({k:'stop',args:[]});f.s.current=null;f.G.run('clubHerdChanged');return {ok:true};};f.act('close');assert.equal(f.calls.at(-1).k,'stop');assert.equal(f.panel.style.display,'none');assert.equal(f.s.lastResult.saved,false);
 f.act('result');f.flush();assert.equal(f.panel.style.display,'flex');assert.match(f.panel.textContent,/Retry save/);
});
test('Back to club releases a finished core and opens the existing Activities tab',()=>{
 const f=fixture();f.s.current={...f.current(),status:'finished'};f.act('activities');assert.equal(f.calls.at(-1).k,'stop');assert.deepEqual(f.trace.clubOpens,['activities']);
});

test('staged riders see gathering feedback until the shared countdown can begin',()=>{
 const f=fixture();f.s.current={...f.current(),status:'riding',riding:true,paused:true,waitingForRiders:true,waitingNames:['Jess & <horse>']};f.paint();
 assert.equal(f.hud.hidden,false);assert.match(f.hud.textContent,/Gathering Jess & <horse>/);assert.match(f.hud.textContent,/clock has not started/);assert.match(f.G.clubHerdUI.section(),/starts when everyone arrives/);
 const key=f.G.clubHerdUI.sectionKey();f.s.current.waitingForRiders=false;f.s.current.waitingNames=[];f.s.current.paused=false;f.paint();
 assert.notEqual(f.G.clubHerdUI.sectionKey(),key);assert.doesNotMatch(f.hud.textContent,/Gathering|clock has not started/);
});
