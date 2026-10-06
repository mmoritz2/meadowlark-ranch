import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load=async name=>{
 const source=await readFile(new URL('../assets/features/'+name,import.meta.url),'utf8');
 return {source,module:await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))};
};
const quests=await load('story-quests.js'),guidance=await load('story-guidance.js');
const {createBuilderRideAlternative,storyFocusCard}=quests.module;
const {nextAction,install}=guidance.module;

function fixture(type='build'){
 let mission={type,ridingAlternative:true,goal:3,item:'fence'},progress=1,active;
 const completed=[];
 const finish=createBuilderRideAlternative({current:()=>mission,progress:()=>progress,activeCourse:()=>active,complete:m=>{completed.push(m);progress=m.goal;}});
 const ev={id:'rush-meadow',rush:true},c={ev,started:true,t:48};active=c;
 return {c,ev,completed,finish,get progress(){return progress;},get mission(){return mission;},set mission(m){mission=m;progress=0;},set active(c){active=c;}};
}

test('one real finish satisfies only the current optional construction mission',()=>{
 for(const type of ['build','build2','ranchlvl']){
  const f=fixture(type),m=f.mission;
  assert.equal(f.finish({c:f.c,ev:f.ev}),true);
  assert.equal(f.progress,m.goal);assert.deepEqual(f.completed,[m]);
  f.mission={type,ridingAlternative:true,goal:10};
  assert.equal(f.finish({c:f.c,ev:f.ev}),false,'a duplicate finish cannot qualify the successor');
  assert.equal(f.progress,0);assert.equal(f.completed.length,1);
 }
});

test('cancelled, unstarted, replayed, malformed and unrelated results cannot satisfy a task',()=>{
 const changes=[f=>{f.active=null;},f=>{f.c.started=false;},f=>{f.c.t=0;},f=>{f.c.t=-1;},f=>{f.c.t=NaN;},f=>{f.c.t=Infinity;},f=>{f.ev={id:f.ev.id};},f=>{f.c={...f.c};}];
 for(const change of changes){const f=fixture();change(f);assert.equal(f.finish({c:f.c,ev:f.ev}),false);assert.equal(f.completed.length,0);}
 const f=fixture();assert.equal(f.finish(),false);assert.equal(f.finish({c:null}),false);
 for(const m of [{type:'event',ridingAlternative:true,goal:1},{type:'build',goal:3},null]){
  const x=fixture();x.mission=m;assert.equal(x.finish({c:x.c,ev:x.ev}),false);
 }
});

test('a prior finish cannot be replayed after a construction mission becomes current',()=>{
 const f=fixture();f.mission={type:'event',goal:1};
 assert.equal(f.finish({c:f.c,ev:f.ev}),false);
 f.mission={type:'build',ridingAlternative:true,goal:3};
 assert.equal(f.finish({c:f.c,ev:f.ev}),false);
 assert.equal(f.completed.length,0);
});

test('regular events qualify too; task completion never mutates course or pays rewards',()=>{
 const f=fixture();f.ev.rush=false;f.ev.id='h1';const before=JSON.stringify(f.c);
 assert.equal(f.finish({c:f.c,ev:f.ev}),true);
 assert.equal(JSON.stringify(f.c),before);
 assert.equal(f.mission.item,'fence');assert.equal(f.mission.type,'build');
});

test('original placement and snapshot counters still work beside the private ride signal',()=>{
 const QT={},RIDING_ALTERNATIVE=Symbol('test completed ride'),save={decor:[{t:'lantern'}]};
 const lines=quests.source.split('\n').filter(l=>/^ QT\.(build|build2|ranchlvl)=/.test(l)).join('\n');
 new Function('QT','RIDING_ALTERNATIVE','fresh','buildPairProgress','ranchLevelOf',lines)(QT,RIDING_ALTERNATIVE,()=>save,quests.module.buildPairProgress,()=>2);
 assert.equal(QT.build({item:'fence',goal:3},'fence',1),2);
 assert.equal(QT.build({item:'fence',goal:3},'trough',1),1);
 assert.equal(QT.build2({goal:2},0,0),1);
 save.decor.push({t:'trough'});assert.equal(QT.build2({goal:2},0,0),2);
 assert.equal(QT.ranchlvl({goal:2},0),2);
 for(const type of ['build','build2','ranchlvl'])assert.equal(QT[type]({ridingAlternative:true,goal:10},RIDING_ALTERNATIVE,1),10);
});

function guideFixture(){
 const mission={type:'build2',ridingAlternative:true,label:'Place a lantern post and a water trough',goal:2,reward:{c:200}},save={story:{idx:7,prog:1},decor:[{t:'lantern'}]},calls=[],actions={};
 const G={quest:{STORY:[mission],storyIdx:()=>0,storyProg:()=>save.story.prog,NPC_DEFS:[{id:'wren',name:'Grandpa Wren'}]},
  horse:{ridden:()=>({}),player:{pos:{x:0,z:0}}},world:{},save:{fresh:()=>save},money:{rewardLabel:()=> '200 coins'},
  tables:{DECOR_CAT:{lantern:{label:'Lantern post',cat:'yard'},trough:{label:'Water trough',cat:'stable'}}},
  ui:{action:(k,f)=>{actions[k]=f;},openEvents:()=>calls.push('events'),openBuild:()=>calls.push('build'),dispatch:k=>calls.push(k)},
  ranchRush:{definitions:[{id:'meadow-run'}],start:id=>calls.push('rush:'+id)},$:()=>null,on(){},hidePanels:()=>calls.push('world')};
 install(G);return {G,mission,save,calls,actions};
}

test('guidance exposes both choices without changing progress or spending money',()=>{
 const f=guideFixture(),before=JSON.stringify(f.save),step=f.G.storyGuidance.describe();
 assert.equal(step.action,'builder-ride');assert.equal(step.label,'Ride instead');
 assert.match(step.hint,/or choose Build instead/);assert.match(step.title,/or finish one ride/);
 const html=storyFocusCard(step,'Build It Back Up Again');
 assert.match(html,/data-fx="story-guide">Ride instead/);assert.match(html,/data-fx="story-build">Build instead/);
 f.actions['story-guide']();assert.deepEqual(f.calls,['rush:meadow-run']);
 f.calls.length=0;globalThis.requestAnimationFrame=fn=>fn();
 try{f.actions['story-build']();}finally{delete globalThis.requestAnimationFrame;}
 assert.deepEqual(f.calls,['world','build','ranch:cat:stable']);
 assert.equal(JSON.stringify(f.save),before);
});

test('a missing Rush module falls back to events; a completed task points to its giver',()=>{
 const f=guideFixture();delete f.G.ranchRush;f.G.storyGuidance.activateCurrent();
 assert.deepEqual(f.calls,['events']);f.save.story.prog=2;
 const step=f.G.storyGuidance.describe();assert.equal(step.action,'return');assert.equal(step.label,'Return to Wren');
 assert(!storyFocusCard(step).includes('data-fx="story-build"'));
 const unchanged=nextAction({type:'build2'},false,null,{save:{decor:[{t:'lantern'}]},catalog:{trough:{label:'Water trough'}}});
 assert.equal(unchanged.action,'build');assert.equal(unchanged.item,'trough','unmarked missions retain original guidance');
});
