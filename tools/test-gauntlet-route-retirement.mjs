// Executes the production seasonal route functions without installing the game.
// The default root is portable when this file lives in tools/.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=process.env.QA_ROUTE_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=process.env.QA_ROUTE_SOURCE||join(ROOT,'assets/features/events2-disciplines.js');
const source=readFileSync(SOURCE,'utf8');
const RETIRE="  if(def.route!=='gt'&&!T.EVENTS3.some(e=>e.route==='gt'))delete T.RACE_ROUTES.gt;";
const previous=source.replace(RETIRE,'');
const clone=value=>structuredClone(value);
function section(body,start,end){
 assert.equal(body.split(start).length,2,'Production fixture start must be unique: '+start);
 assert.equal(body.split(end).length,2,'Production fixture end must be unique: '+end);
 const first=body.indexOf(start),last=body.indexOf(end);
 assert(last>first,'Production fixture section must be ordered');
 return body.slice(first,last);
}
const names=Object.fromEntries(['bloom','sun','ember','frost'].map(k=>[k,{name:k+' trial',icon:'G',blurb:k+' season'}]));
function fixture(body=source,{missing=false,shared=false,selectedLegacy=false,absentLegacy=false}={}){
 const T={RACE_ROUTES:{gt:[[-20,-24],[-42,-46],[-72,-54]],race:[[10,10],[20,10],[20,20]]},EVENTS3:[
  {id:'gt',route:'gt',gauntlet:true,name:'Initial trial',time:100,limit:150,training:{score:2,medals:['bronze']},laps:2,requirement:{bond:4}},
  {id:'race',route:'race',race:true,par:10}
 ]};
 if(missing)T.EVENTS3.shift();
 if(shared)T.EVENTS3.push({id:'other-event',route:'gt',race:true,training:{score:1}});
 if(absentLegacy)delete T.RACE_ROUTES.gt;
 const G={events:{GTD:{name:'Initial trial',icon:'G',keep:'shared UI state'}}};
 let rngCalls=0;
 const guardedMath=Object.create(Math);
 Object.defineProperty(guardedMath,'random',{value(){rngCalls++;throw Error('Seasonal route assignment must not consume RNG');}});
 const code=section(body,' const GAUNTLET_SEASONS={','\n const GT_BASE=')+'\n'+
  section(body,' function routeLen(key){','\n function fixPars(){')+'\n'+
  // Only presentation dependencies are stubbed; all route definitions and functions are actual source.
  'function discOf(){return {icon:"G",label:"Gauntlet"};}\n'+
  'function discDetail(ev){return (T.RACE_ROUTES[ev.route]||[]).length+" elements";}\n'+
  section(body,' function gauntletDef(k){','\n applyGauntletSeason(seasonKey());')+'\n'+
  'return {seasons:GAUNTLET_SEASONS,routeLen,gauntletDef,apply:applyGauntletSeason};';
 const actual=new Function('T','G','GT_NAMES','Math',code)(T,G,clone(names),guardedMath);
 if(selectedLegacy)actual.seasons.bloom.route='gt';
 return {T,G,...actual,rngCalls:()=>rngCalls};
}
function independentLoopLength(points){
 return points.reduce((sum,p,i)=>{const next=points[(i+1)%points.length];return sum+Math.hypot(next[0]-p[0],next[1]-p[1]);},0);
}

test('production has exactly the unused-route retirement statement',()=>{
 assert.equal(source.split(RETIRE).length,2,'The production function must contain the retirement guard');
 assert.equal(previous.split(RETIRE).length,1);
});

test('all four actual loops preserve seasonal definitions, par, limits, event ID, training and UI behavior',()=>{
 const expected={bloom:{route:'gt_bloom',limit:165,count:12},sun:{route:'gt_sun',limit:150,count:10},ember:{route:'gt_ember',limit:140,count:10},frost:{route:'gt_frost',limit:130,count:10}};
 assert.deepEqual(Object.keys(fixture().seasons),Object.keys(expected));
 for(const [key,contract] of Object.entries(expected)){
  const a=fixture(previous),b=fixture(),definitions=clone(b.seasons),unrelated=clone(b.T.RACE_ROUTES.race);
  const oldDef=a.apply(key),def=b.apply(key),event=b.T.EVENTS3[0];
  assert.strictEqual(def,b.seasons[key]);assert.deepEqual(def,oldDef);assert.deepEqual(b.seasons,definitions);
  assert.equal(def.route,contract.route);assert.equal(def.limit,contract.limit);assert.equal(def.pts.length,contract.count);
  assert(def.pts.every(p=>p.length===2&&p.every(Number.isFinite)));
  assert.equal(b.routeLen(def.route),independentLoopLength(def.pts));
  assert.equal(event.par,+(independentLoopLength(def.pts)/7.2).toFixed(1));
  assert.equal(event.limit,contract.limit);assert.equal(event.time,contract.limit);assert.equal(event.id,'gt');
  assert.deepEqual(event.training,{score:2,medals:['bronze']});assert.deepEqual(event.requirement,{bond:4});assert.equal(event.laps,2);
  assert.deepEqual(b.T.EVENTS3,a.T.EVENTS3);assert.deepEqual(b.G,a.G);
  assert.equal(event.name,names[key].name);assert.equal(b.G.events.GTD.keep,'shared UI state');
  const oldRoutes=clone(a.T.RACE_ROUTES);delete oldRoutes.gt;
  assert.deepEqual(b.T.RACE_ROUTES,oldRoutes);assert.deepEqual(b.T.RACE_ROUTES.race,unrelated);
  assert.equal(Object.hasOwn(b.T.RACE_ROUTES,'gt'),false,'Only the unused legacy outer loop is retired');
  assert.equal(b.rngCalls(),0);assert.equal(a.rngCalls(),0);
 }
});

test('live loop coordinates are cloned and reapplying restores edits without mutating seasonal definitions',()=>{
 const b=fixture();
 for(const key of Object.keys(b.seasons)){
  const expected=clone(b.seasons[key].pts),def=b.apply(key),live=b.T.RACE_ROUTES[def.route];
  assert.notStrictEqual(live,def.pts);
  for(let i=0;i<live.length;i++)assert.notStrictEqual(live[i],def.pts[i]);
  live[0][0]+=1000;live.push([123,456]);
  assert.deepEqual(def.pts,expected);
  b.apply(key);assert.deepEqual(b.T.RACE_ROUTES[def.route],expected);
  assert.notStrictEqual(b.T.RACE_ROUTES[def.route],live);
 }
 assert.equal(b.rngCalls(),0);
});

test('an unrelated event using legacy gt keeps that exact route and event intact',()=>{
 for(const key of Object.keys(names)){
  const a=fixture(previous,{shared:true}),b=fixture(source,{shared:true}),legacy=b.T.RACE_ROUTES.gt,other=b.T.EVENTS3[2];
  a.apply(key);b.apply(key);
  assert.deepEqual(b.T,a.T);assert.deepEqual(b.G,a.G);assert.strictEqual(b.T.RACE_ROUTES.gt,legacy);assert.strictEqual(b.T.EVENTS3[2],other);
  assert.equal(other.id,'other-event');assert.equal(other.route,'gt');assert.equal(b.rngCalls(),0);
 }
});

test('missing gauntlet returns null without touching route, event or UI state',()=>{
 for(const key of [...Object.keys(names),'unknown']){
  const b=fixture(source,{missing:true}),before=clone({T:b.T,G:b.G}),legacy=b.T.RACE_ROUTES.gt;
  assert.equal(b.apply(key),null);assert.deepEqual({T:b.T,G:b.G},before);assert.strictEqual(b.T.RACE_ROUTES.gt,legacy);assert.equal(b.rngCalls(),0);
 }
});

test('unknown season retains the existing bloom fallback while retiring only its unused outer loop',()=>{
 const a=fixture(previous),b=fixture(),def=b.apply('unknown'),old=a.apply('unknown');
 assert.strictEqual(def,b.seasons.bloom);assert.deepEqual(def,old);assert.equal(b.T.EVENTS3[0].route,'gt_bloom');
 assert.deepEqual(b.T.EVENTS3,a.T.EVENTS3);assert.deepEqual(b.G,a.G);
 assert.equal(b.T.EVENTS3[0].name,'Initial trial');assert.equal(Object.hasOwn(b.T.RACE_ROUTES,'gt'),false);assert.equal(b.rngCalls(),0);
});

test('a selected season actually naming gt keeps its freshly cloned current loop',()=>{
 const a=fixture(previous,{selectedLegacy:true}),b=fixture(source,{selectedLegacy:true}),legacy=b.T.RACE_ROUTES.gt;
 a.apply('bloom');const def=b.apply('bloom');
 assert.equal(def.route,'gt');assert.deepEqual(b.T,a.T);assert.deepEqual(b.G,a.G);assert(Object.hasOwn(b.T.RACE_ROUTES,'gt'));
 assert.notStrictEqual(b.T.RACE_ROUTES.gt,legacy);assert.notStrictEqual(b.T.RACE_ROUTES.gt,def.pts);assert.deepEqual(b.T.RACE_ROUTES.gt,def.pts);assert.equal(b.rngCalls(),0);
});

test('repeated seasonal switches preserve previous seasonal and unrelated routes, and tolerate an absent legacy key',()=>{
 for(const absentLegacy of [false,true]){
  const b=fixture(source,{absentLegacy}),unrelated=clone(b.T.RACE_ROUTES.race);
  for(const key of ['sun','bloom','frost','ember','sun']){
   const existing=clone(b.T.RACE_ROUTES);delete existing.gt;
   const def=b.apply(key);
   for(const [route,pts] of Object.entries(existing))assert.deepEqual(b.T.RACE_ROUTES[route],pts);
   assert.deepEqual(b.T.RACE_ROUTES[def.route],def.pts);assert.deepEqual(b.T.RACE_ROUTES.race,unrelated);
   assert.equal(Object.hasOwn(b.T.RACE_ROUTES,'gt'),false);assert.equal(b.T.EVENTS3[0].id,'gt');
  }
  assert.equal(b.rngCalls(),0);
 }
});
