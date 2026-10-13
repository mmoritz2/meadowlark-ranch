import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {horseProgressSnapshot} from '../assets/event-horse-growth.mjs';

// The actual discipline finish runs before the actual ladder finish, as in the
// feature index. Both consume production finalField; this is not a replacement
// scorer. Clock, crossings, gates, gold rules and course rewards are untouched.
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const disc=read('assets/features/events2-disciplines.js'),ladder=read('assets/features/events2-ladder.js');
function section(source,a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i,a);return source.slice(i,j);}
function actualFunction(source,name){
 const start=source.indexOf(' function '+name+'(');assert(start>=0,name);
 const open=source.indexOf('{',start);let depth=0;
 for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}
 assert.fail('Function boundary: '+name);
}
const finalSource=actualFunction(ladder,'finalField'),cacheName=finalSource.match(/(\w+)\.get\(c\)/)?.[1];assert(cacheName,'Actual final field cache');
const ghostProjection=actualFunction(ladder,'ghostProj'),placing=actualFunction(disc,'finalPlace'),build=actualFunction(disc,'buildResult');
const disciplineFinish=section(disc," G.on('courseFinish',({c,ev,stars,RB,pay,dressage,pct})=>{",' /* ================================================================= per frame');
const ladderFinish=section(ladder,' let LAST=null, cardT=null;',' function openCard(){');
const courseStart=section(ladder," G.on('courseStart',c=>{"," G.on('courseTick',(c,dt,t)=>{");
const horseMaps=[' const courseHorseIds=new WeakMap();',' const courseHorseProgress=new WeakMap();'];
for(const declaration of horseMaps)assert(ladder.includes(declaration),'Actual course baseline map');
const maxHorseLevel=ladder.split('\n').find(line=>line.startsWith(' const maxHorseLevel='));assert(maxHorseLevel);
const horseBaseline=horseMaps.join('\n')+'\n'+maxHorseLevel+'\n'+actualFunction(ladder,'savedHorseProgress');

const copy=value=>JSON.parse(JSON.stringify(value));
function fixture({time=32.38310000000893,done=[true,true,false],withLadder=true,synthetic=false,fieldMissing=false,pvp=false,rematch=false}={}){
 const ev={id:'pp',name:'Pasture Pony Dash',town:'Meadowlark Ranch',race:true,lvl:1,reward:180};
 const c={ev,t:time,par:41,started:true,race:true,jumps:[],pvp,ladRematch:rematch,ladRunId:'actual-final-round',faults:0,
  ce:{kind:'race',diff:{k:'open',label:'Open'},grades:[],lineOff:0,gateClean:.62,timeAllowed:41},rb:{acc:.838}};
 const GH={on:true,fin:100,run:10,list:[
  {nm:'Hollypark',done:done[0],ft:32.7,s:100,v:5,rt:1,slowT:0},
  {nm:'Fernmere',done:done[1],ft:26.9,s:100,v:5,rt:1,slowT:0},
  {nm:'Silverbirch',done:done[2],ft:35.3,s:100-(35.3-time)*10,v:10,rt:1,slowT:0},
 ]};
 const rivals=GH.list.map(g=>({n:g.nm,gh:synthetic?null:g,target:g.ft,pen:0}));
 const FIELD={c,rivals,ghosts:synthetic?null:GH};
 const CUR={raceAcc:.838,demoted:false,hazHits:0,gold:false,rib:2,show:null,fenceFaults:0};
 let disk={coins:100,gems:2,keys:0,horses:[{id:1,name:'Bramble',level:2,xp:97,bond:40}],racing:{pts:100,claimed:{}},lad:{races:0,wins:0,podiums:0,rib:{total:0,byEv:{}},wk:{times:{},gold:{},score:{}},titles:[]},weekly:{gold:{}}};
 const hooks=[],starts=[],trace={toasts:[],daily:[],writes:0,panels:[]};
 const G={xp:{MAX_LEVEL:50},horse:{ridden:()=>copy(disk.horses[0])},course:{get:()=>c},save:{fresh:()=>copy(disk),sync:fn=>{const draft=copy(disk);fn(draft);disk=draft;trace.writes++;}},quest:{dailyEvt:(type,n)=>trace.daily.push({type,n})},
  ui:{rerender:id=>trace.panels.push(id),open:id=>trace.panels.push(id)},toast:s=>trace.toasts.push(s),on:(name,fn)=>{if(name==='courseFinish')hooks.push(fn);else if(name==='courseStart')starts.push(fn);}};
 const ctx=vm.createContext({G,Date,Math,WeakMap,Object,GH,CUR,horseProgressSnapshot,FIELD:fieldMissing?null:FIELD,[cacheName]:new WeakMap(),RESULT:null,
  ghostField:()=>GH,placeIn:rows=>rows.findIndex(row=>row.me)+1,toast:G.toast,discOf:()=>({k:'race',label:'Race',icon:'🏁'}),starsOf:n=>'⭐'.repeat(n),gateClean:()=>.62,
  priceGrades(){},turnoutParts:()=>[],GRADE:{},seasonKey:()=>'autumn',showResult(...args){ctx.buildResult(...args);},
  goldOf:(_,RB)=>RB?.gold===true,preFinish:null,diffOf:k=>({k,label:k}),E:()=>({rankIdx:()=>0,PVP:{place:2,field:3}}),
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),ghostProj:null,judgedOfWeek:()=>null,writeWeekly:()=>({best:null}),judgedRows:()=>[],finalStandings:()=>[],
  REMATCH_PTS:2,finalField:null,resumeContext:()=>null,newRunId:()=>'actual-final-round',ridden:G.horse.ridden,pendingRematch:null,clearField(){},spawnField(){},clearRun(){},stripResidue(){},tallyRibbons:()=>2,cardT:null,setTimeout:()=>1,clearTimeout(){},console,
 });
 vm.runInContext(horseBaseline+'\n'+ghostProjection+'\n'+finalSource+'\n'+placing+'\n'+build,ctx);
 if(withLadder)G.ladder={finalField:ctx.finalField,openCard(){}};
 vm.runInContext(disciplineFinish+(withLadder?'\n'+courseStart+'\n'+ladderFinish+'\nthis.readLast=()=>LAST;':''),ctx);
 // Use the production course-start capture rather than an invented growth state.
 // Prepared race field geometry is external to this finish-order fixture.
 if(withLadder){assert.equal(starts.length,1);starts[0](c);}
 const payload={c,ev,stars:2,RB:{rib:2,gold:false,saved:true,featured:false},pay:180,dressage:false};
 return {ctx,G,c,ev,GH,FIELD,CUR,trace,payload,initialTime:time,get disk(){return copy(disk);},snapshot:()=>ctx.finalField(c),last:()=>ctx.readLast?.()??null,result:()=>ctx.RESULT,
  finish({between}={}){assert.equal(hooks.length,withLadder?2:1);hooks[0](payload);between?.();hooks[1]?.(payload);},
 };
}
const placingRow=f=>copy(f.result().rows).find(row=>row[0]==='Placing')?.[1];
const finishNote=f=>f.trace.toasts.find(note=>note.startsWith('🏁 Gates '));
function shared(f,{place,points}){
 assert.equal(f.last().place,place);assert.equal(f.last().aiPts,points);assert.equal(f.last().horseBefore.horseId,1);assert.equal(f.last().horseBefore.xp,97);assert.equal(f.last().rows.findIndex(row=>row.me)+1,place);
 assert.match(placingRow(f),new RegExp('^P'+place+'/4'));
 assert.match(finishNote(f),new RegExp('P'+place+'/4 of the field'));
 assert.equal(f.disk.racing.pts,100+points);assert.equal(f.payload.RB.gold,false);assert.equal(f.payload.RB.rib,2);assert.equal(f.CUR.raceAcc,.838);assert.equal(f.c.t,f.initialTime);
}

test('the reproduced pickup-adjusted finish shows P2 in discipline, table, recap and the actual 30-point payout',()=>{
 const f=fixture();assert.equal(f.GH.list.filter(g=>g.done).length+1,3,'The old physically-done count contradicts the final score clock.');
 f.finish();shared(f,{place:2,points:30});
 assert.deepEqual(copy(f.last().rows),[{n:'Fernmere',proj:26.9},{n:'You',proj:32.4,me:true},{n:'Hollypark',proj:32.7},{n:'Silverbirch',proj:35.3}]);
 assert.equal(f.disk.lad.podiums,1);assert.equal(f.disk.lad.wins,0);assert.equal(f.payload.RB.gold,false,'Placement does not change the gold grade.');
});
test('the earlier discipline reader freezes the standings before later finish-hook changes or field cleanup',()=>{
 const f=fixture();f.finish({between(){f.GH.list.forEach(g=>{g.done=true;g.ft=1;g.s=100;});f.ctx.FIELD=null;}});
 shared(f,{place:2,points:30});assert.equal(f.snapshot(),f.snapshot());assert(Object.isFrozen(f.snapshot()));assert(Object.isFrozen(f.snapshot().rows));assert(f.snapshot().rows.every(Object.isFrozen));
});
test('a later finish clock behind two rival times consistently earns P3 and fifteen placing points',()=>{
 const f=fixture({time:34});f.finish();shared(f,{place:3,points:15});assert.equal(f.disk.lad.podiums,1);assert.equal(f.disk.lad.wins,0);
});
test('winning and rematch placing rewards use the same frozen result without changing their multiplier',()=>{
 const f=fixture({time:24,done:[false,false,false],synthetic:true});f.finish();shared(f,{place:1,points:45});assert.equal(f.disk.lad.wins,1);
 const rematch=fixture({rematch:true});rematch.finish();shared(rematch,{place:2,points:60});assert.equal(rematch.disk.lad.podiums,1);
});
test('synthetic-field fallback also shares its final projected table rather than a second live count',()=>{
 const f=fixture({synthetic:true});f.finish();shared(f,{place:2,points:30});assert.deepEqual(copy(f.snapshot().rows),copy(f.last().rows));
});
test('same-event later courses and stale fields cannot reuse another course snapshot',()=>{
 const f=fixture(),snapshot=f.snapshot(),other={...f.c,ladRunId:'later-round',t:40};assert.equal(f.ctx.finalField(other),null);
 f.ctx.FIELD={...f.FIELD,c:other};const later=f.ctx.finalField(other);assert.notEqual(later,snapshot);assert.equal(later.place,3);assert.equal(snapshot.place,2);
 f.ctx.FIELD=null;assert.equal(f.ctx.finalField(other),later);assert.equal(f.snapshot(),snapshot);
});
test('an absent ladder or field keeps the standalone discipline behavior and adds no AI placing payout',()=>{
 const standalone=fixture({withLadder:false});standalone.finish();assert.match(placingRow(standalone),/^P3\/4/);assert.match(finishNote(standalone),/P3\/4/);
 const noField=fixture({fieldMissing:true});noField.finish();assert.equal(noField.snapshot(),null);assert.equal(noField.last().field,0);assert.equal(noField.last().aiPts,0);assert.equal(noField.disk.racing.pts,100);
});
test('live multiplayer placement remains owned by its existing live result when no solo field exists',()=>{
 const f=fixture({fieldMissing:true,pvp:true});f.GH.on=false;f.finish();assert.equal(f.last().place,2);assert.equal(f.last().field,3);assert.equal(f.last().aiPts,0);
 assert.equal(placingRow(f),undefined);assert.doesNotMatch(finishNote(f),/P\d\/\d/);assert.equal(f.disk.racing.pts,100);
});


test('the existing rounded-time tie order remains unchanged for table, sheet and placing reward',()=>{
 const f=fixture({time:32.44});f.GH.list[0].ft=32.41;f.finish();shared(f,{place:3,points:15});
 assert.deepEqual(copy(f.last().rows).slice(1,3),[{n:'Hollypark',proj:32.4},{n:'You',proj:32.4,me:true}]);
});
