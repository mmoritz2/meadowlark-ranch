import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Run the production scheduler, observer registration and close path. Rendering
// is a measured write stub; no browser, map travel or player save is involved.
const source=fs.readFileSync(new URL('../assets/travel-map.js',import.meta.url),'utf8');
function section(from,to){const start=source.indexOf(from),end=source.indexOf(to,start);assert(start>=0&&end>start,from);return source.slice(start,end);}
const scheduler=section(' let resizeFrame=', ' function setZoom(');
const close=section(' function close(){', ' closeButton.onclick=');
const observer=section(' new ResizeObserver(', 'G.seFrame?.screens.add');
function fixture(){
 const stage={clientWidth:600,clientHeight:400},jobs=new Map(),canceled=[],draws=[],clamps=[];
 let next=0,callback=null,dpr=1;
 const document={};
 const api=Function('stage','requestAnimationFrame','cancelAnimationFrame','ResizeObserver','readDpr','draws','clamps',`
 let open=false,art={},timer=null,previousFocus=null;
 const wrap={style:{display:'none'}},G={riding:{releaseAll(){},lock(){}},seFrame:{settle(){}}};
 const clearInterval=()=>{};
 function clampPan(){clamps.push([stage.clientWidth,stage.clientHeight]);}
 function draw(){draws.push([stage.clientWidth,stage.clientHeight,Math.min(2,readDpr()||1)]);}
 const devicePixelRatioProxy={};
 ${scheduler.replace(/devicePixelRatio/g,'readDpr()')}
 ${close}
 ${observer}
 return {show(){open=true;wrap.style.display='flex';resize();},close,resize,get open(){return open;},get queued(){return resizeFrame;}};
 `)(stage,fn=>{jobs.set(++next,fn);return next;},id=>{canceled.push(id);jobs.delete(id);},class{constructor(fn){callback=fn;}observe(value){assert.equal(value,stage);}},()=>dpr,draws,clamps);
 return {api,stage,jobs,canceled,draws,clamps,notify:()=>callback([]),dpr:v=>{dpr=v;},flush(){const pending=[...jobs];jobs.clear();for(const [,fn]of pending)fn();},take:id=>jobs.get(id)};
}

test('observer notifications coalesce without synchronous drawing and use the latest layout',()=>{
 const f=fixture();f.api.show();for(let i=0;i<12;i++)f.notify();
 assert.equal(f.draws.length,0,'canvas and pin writes cannot run during observer delivery');assert.equal(f.clamps.length,0);assert.equal(f.jobs.size,1);
 f.stage.clientWidth=720;f.stage.clientHeight=460;f.notify();f.flush();
 assert.deepEqual(f.draws,[[720,460,1]]);assert.deepEqual(f.clamps,[[720,460]]);assert.equal(f.api.queued,null);
});

test('unchanged observer boxes do not redraw, while real dimensions and DPR changes do',()=>{
 const f=fixture();f.api.show();f.flush();for(let i=0;i<4;i++){f.notify();f.flush();}assert.equal(f.draws.length,1,'self-induced unchanged-box notifications settle without more writes');
 f.stage.clientWidth=610;f.notify();f.flush();f.stage.clientHeight=410;f.notify();f.flush();f.dpr(2);f.notify();f.flush();
 assert.deepEqual(f.draws,[[600,400,1],[610,400,1],[610,410,1],[610,410,2]]);
 f.dpr(3);f.notify();f.flush();assert.equal(f.draws.length,4,'backing-store DPR retains the production limit of two');
});

test('zero-size layout waits for a usable stage instead of writing canvas dimensions',()=>{
 const f=fixture();f.stage.clientWidth=0;f.api.show();f.flush();assert.equal(f.draws.length,0);
 f.stage.clientWidth=600;f.stage.clientHeight=0;f.notify();f.flush();assert.equal(f.draws.length,0);
 f.stage.clientHeight=400;f.notify();f.flush();assert.deepEqual(f.draws,[[600,400,1]]);
});

test('production close cancels pending work and hidden observers cannot schedule redraws',()=>{
 const f=fixture();f.api.show();const id=f.api.queued,late=f.take(id);f.api.close();
 assert.deepEqual(f.canceled,[id]);assert.equal(f.jobs.size,0);assert.equal(f.api.open,false);assert.equal(f.api.queued,null);
 f.notify();late();assert.equal(f.jobs.size,0);assert.equal(f.draws.length,0);
});

test('close and reopen redraw the map and a stale callback cannot disturb the new frame',()=>{
 const f=fixture();f.api.show();f.flush();assert.equal(f.draws.length,1);
 f.notify();const oldId=f.api.queued,late=f.take(oldId);f.api.close();f.api.show();const newId=f.api.queued;
 assert.notEqual(oldId,newId);late();assert.equal(f.api.queued,newId,'stale work cannot clear the new pending handle');
 f.notify();assert.equal(f.jobs.size,1,'repeated notifications remain coalesced after stale work');f.flush();assert.equal(f.draws.length,2,'unchanged dimensions still redraw reset map content on reopen');
});
