import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Run the production reducers/registrations without installing their world, UI,
// or timers. Only storage and notification boundaries are replaced by observers.
const read=name=>fs.readFileSync(new URL('../assets/features/'+name,import.meta.url),'utf8');
const sideSource=read('story-quests.js'),seasonSource=read('seasons.js'),bookSource=read('season-quests.js');
function section(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,'production boundary: '+start);return source.slice(a,b);
}
const sideCode=section(sideSource,' function applySideProgress(',' function openSideTab(');
const seasonCode=section(seasonSource,' function payTrainingChallenge(',' G.on(\'weekRoll\'');
const seasonTable=section(seasonSource,' const CHALLENGES=',' const chalDone=');
const seasonRoll=section(seasonSource,' function rollState(',' /* ================= 4.');
const bookCode=section(bookSource,' function applyBookProgress(',' function claimEntry(');
const bookCursor=section(bookSource,' function syncCur(',' function bookState(');
const clone=v=>structuredClone(v);
function fixture(save){
 let live=clone(save);const trace={reads:0,writes:0,toasts:[],sounds:[],wallet:0,render:0,timers:0},registered={},hooks={};
 const fresh=()=>{trace.reads++;return clone(live);};
 const S={sync(fn){trace.writes++;const draft=clone(live);fn(draft);live=draft;}};
 const G={trainingProgress:{register(id,reduce,confirmed){assert(!registered[id]);registered[id]={reduce,confirmed};}},
  on:(name,fn)=>{(hooks[name]??=[]).push(fn);},time:{isoWeekKey:()=> 'week-current'},
  sChime:()=>trace.sounds.push('chime'),sGem:()=>trace.sounds.push('gem')};
 const toast=m=>trace.toasts.push(m);
 return {trace,registered,hooks,G,S,fresh,toast,get live(){return clone(live);},commit(s){live=clone(s);}};
}
function sideFixture(){
 const f=fixture({story:{idx:5,prog:2},side:{active:{jump:{p:2},other:{p:0},food:{p:0},item:{p:0},event:{p:0},talk:{p:0}},done:{},n:0}});
 const SIDE_BY={jump:{type:'cleanjump',goal:3,label:'Clean for Bram',npc:'bram'},other:{type:'photo',goal:2,label:'Photos',npc:'ada'},
  food:{type:'train',goal:2,label:'Feed training',npc:'wren'},item:{type:'cleanjump',item:'special',goal:2},
  event:{type:'cleanjump',ev:'h1',goal:2},talk:{type:'cleanjump',talk:'wren',goal:2}};
 f.api=new Function('G','S','fresh','toast','SIDE_BY','npcShort',sideCode+'return {sideEvt};')(f.G,f.S,f.fresh,f.toast,SIDE_BY,id=>id);
 f.module=f.registered['side-quests'];return f;
}
function seasonFixture({prog={},paid={},season='frost',rewardFailure=false}={}){
 const f=fixture({coins:0,gems:0,tokens:{n:2},pass:{pts:5},sn:{key:'season-current',wk:'week-current',prog,paid,weeks:0,store:{owned:1}}});
 let fail=rewardFailure;
 // These are the exact draft-only reward kinds used by all current challenges.
 const kinds={tok:{pay:(s,n)=>{s.tokens.n+=n;}},p:{pay:(s,n)=>{if(fail)throw Error('pass reward unavailable');s.pass.pts+=n;}},g:{pay:(s,n)=>{s.gems+=n;}}};
 const M={payReward(s,r){for(const [k,v] of Object.entries(r))kinds[k].pay(s,v);},rewardLabel:r=>JSON.stringify(r),refreshWallet:()=>f.trace.wallet++};
 f.api=new Function('G','S','T','M','toast','realKey','sid','sn','rerender','setTimeout',seasonRoll+seasonTable+seasonCode+'return {CHALLENGES,WEEK_BONUS};')(
  f.G,f.S,{REWARD_KINDS:kinds},M,f.toast,()=> 'season-current',()=>season,()=>({def:{name:'Frost'}}),()=>f.trace.render++,fn=>{f.trace.timers++;fn();});
 f.module=f.registered['season-challenges'];f.failReward=v=>{fail=v;};f.kinds=kinds;return f;
}
function bookFixture({idx=0,prog=0,key='season-current'}={}){
 const f=fixture({seasonQ:{key,idx,prog,claimed:{},unlocked:false},tokens:{n:2}});
 const book={entries:[{evt:'cleanjump',goal:8,label:'Eight clean jumps'},{evt:'gallop',goal:40,label:'Ride forty metres'}]};
 const CUR={};
 f.api=new Function('G','S','fresh','toast','book','SKEY','CUR',bookCursor+bookCode+'syncCur();return {flushQ,get pending(){return pend;},get cursor(){return {...CUR};}};')(
  f.G,f.S,f.fresh,f.toast,()=>book,'season-current',CUR);
 f.trace.reads=0;f.module=f.registered['season-almanac'];return f;
}
function noEffects(f){
 assert.equal(f.trace.reads,0);assert.equal(f.trace.writes,0);assert.deepEqual(f.trace.toasts,[]);assert.deepEqual(f.trace.sounds,[]);assert.equal(f.trace.timers,0);
}

test('side reducer counts only matching active objectives in its supplied draft',()=>{
 const f=sideFixture(),original=f.live,draft=clone(original);
 const summary=f.module.reduce(draft,[{type:'cleanjump',value:8},{type:'sxp',value:2},{type:'train',value:2},{type:'photo',value:2}],{runId:'one'});
 assert.equal(draft.side.active.jump.p,3);
 for(const id of ['other','food','item','event','talk'])assert.equal(draft.side.active[id].p,0);
 assert.deepEqual(draft.story,original.story,'the side reducer must not duplicate main-story credit');
 assert.deepEqual(draft.side.done,{});assert.equal(draft.side.n,0,'completion still needs NPC turn-in');
 assert.deepEqual(f.live,original);assert.equal(summary.updates.length,1);assert.equal(summary.updates[0].completed,true);
 assert.deepEqual(JSON.parse(JSON.stringify(summary)),summary);noEffects(f);
 f.commit(draft);f.module.confirmed(summary,{runId:'one',saved:true});
 assert.equal(f.trace.toasts.length,1);assert.match(f.trace.toasts[0],/Bram|bram/);assert.equal(f.trace.writes,0);
});

test('side legacy events still use item/event/talk filters and notify only on crossing',()=>{
 const f=sideFixture();f.api.sideEvt('cleanjump',1,'special');
 assert.equal(f.live.side.active.jump.p,3);assert.equal(f.live.side.active.item.p,1);assert.equal(f.live.side.active.event.p,0);
 assert.equal(f.trace.toasts.length,1);f.api.sideEvt('cleanjump',1,'h1');
 assert.equal(f.live.side.active.event.p,1);assert.equal(f.trace.toasts.length,1);
 f.api.sideEvt('train',1);assert.equal(f.live.side.active.food.p,1);
 const writes=f.trace.writes;f.api.sideEvt('cleanjump',1,'unmatched');
 assert.equal(f.trace.writes,writes,'already completed and unmatched objectives do not cause empty save writes');
});

test('invalid training values cannot reduce, inflate, or finish side progress',()=>{
 const f=sideFixture(),draft=f.live,before=clone(draft);
 assert.deepEqual(f.module.reduce(draft,[{type:'cleanjump',value:NaN},{type:'cleanjump',value:Infinity},{type:'cleanjump',value:-1},{type:'cleanjump',value:'8'},null]),{updates:[]});
 assert.deepEqual(draft,before);noEffects(f);
});

test('Frost counts completed drills separately from food training, preserving its existing ID',()=>{
 const f=seasonFixture({prog:{'fr-train':8}}),draft=f.live;
 const c=f.api.CHALLENGES.frost.find(c=>c.id==='fr-train');assert.equal(c.type,'drill');assert.equal(c.goal,10);
 assert.equal(f.module.reduce(draft,[{type:'train',value:10}]).updates.length,0);assert.equal(draft.sn.prog['fr-train'],8);
 const summary=f.module.reduce(draft,[{type:'drill',value:1}]);assert.equal(draft.sn.prog['fr-train'],9);assert.equal(summary.completed.length,0);
 assert.equal(f.live.sn.prog['fr-train'],8);noEffects(f);
 const allowed=new Set(['tok','p','g']);
 for(const c of Object.values(f.api.CHALLENGES).flat())for(const kind of Object.keys(c.r))assert(allowed.has(kind),'horse-scoped rewards require receipt identity handling');
 for(const kind of Object.keys(f.api.WEEK_BONUS))assert(allowed.has(kind));
});

test('season challenge and whole-week rewards belong to the same draft and pay once',()=>{
 const f=seasonFixture({prog:{'fr-train':9,'fr-care':12,'fr-xc':2},paid:{'fr-care':1,'fr-xc':1}}),original=f.live,draft=clone(original);
 const summary=f.module.reduce(draft,[{type:'drill',value:1},{type:'drill',value:1}]);
 assert.equal(draft.sn.prog['fr-train'],10);assert.equal(draft.sn.paid['fr-train'],1);assert.equal(draft.sn.paid['week:week-current'],1);assert.equal(draft.sn.weeks,1);
 assert.equal(draft.tokens.n,30);assert.equal(draft.pass.pts,125);assert.equal(draft.gems,1);assert.deepEqual(draft.sn.store,{owned:1});
 assert.equal(summary.completed.length,1);assert.equal(summary.banked,true);assert.deepEqual(JSON.parse(JSON.stringify(summary)),summary);
 assert.deepEqual(f.live,original);noEffects(f);
 // Dropping an unsaved draft and retrying starts from the same persisted values.
 const retry=clone(original);assert.deepEqual(f.module.reduce(retry,[{type:'drill',value:1}]),summary);assert.deepEqual(retry,draft);
 f.commit(retry);f.module.confirmed(summary,{runId:'one',saved:true});
 assert.equal(f.trace.writes,0);assert.equal(f.trace.reads,0);assert.equal(f.trace.toasts.length,2);assert.deepEqual(f.trace.sounds,['chime','gem']);
 const after=f.live;assert.equal(f.module.reduce(after,[{type:'drill',value:1}]).completed.length,0);assert.deepEqual(after,f.live);
});

test('strict seasonal reward failures abort training reducers instead of marking a durable payout',()=>{
 const f=seasonFixture({prog:{'fr-train':9},rewardFailure:true}),original=f.live,draft=clone(original);
 assert.throws(()=>f.module.reduce(draft,[{type:'drill',value:1}]),/pass reward unavailable/);
 assert.deepEqual(f.live,original);noEffects(f);
 f.failReward(false);const retry=clone(original),summary=f.module.reduce(retry,[{type:'drill',value:1}]);
 assert.equal(retry.tokens.n,10);assert.equal(retry.pass.pts,45);assert.equal(summary.completed.length,1);
 delete f.kinds.tok;assert.throws(()=>f.module.reduce(clone(original),[{type:'drill',value:1}]),/Unknown training challenge reward: tok/);
});

test('legacy seasonal event reward path still pays and refreshes after completion',()=>{
 const f=seasonFixture({season:'bloom',prog:{'bl-groom':9}});
 f.hooks.dailyEvt[0]('groom',1);
 assert.equal(f.live.sn.prog['bl-groom'],10);assert.equal(f.live.tokens.n,10);assert.equal(f.live.pass.pts,45);
 assert.equal(f.trace.writes,1);assert.equal(f.trace.wallet,1);assert.equal(f.trace.render,1);assert.equal(f.trace.toasts.length,1);
 f.hooks.dailyEvt[0]('cleanjump',1);assert.equal(f.trace.writes,1,'irrelevant events do not open storage');
});

test('season rollover applies inside the draft only and preserves purchases',()=>{
 const f=seasonFixture(),draft=f.live;draft.sn.key='old-season';draft.sn.wk='old-week';draft.sn.weeks=7;draft.sn.prog={'fr-train':9};draft.sn.paid={'fr-care':1};
 f.module.reduce(draft,[{type:'drill',value:1}]);
 assert.equal(draft.sn.key,'season-current');assert.equal(draft.sn.wk,'week-current');assert.equal(draft.sn.weeks,0);assert.deepEqual(draft.sn.prog,{'fr-train':1});assert.deepEqual(draft.sn.paid,{});assert.deepEqual(draft.sn.store,{owned:1});noEffects(f);
});

test('almanac training progresses current clean-jump entry but does not turn in or pay it',()=>{
 const f=bookFixture({prog:5}),original=f.live,draft=clone(original);
 const summary=f.module.reduce(draft,[{type:'cleanjump',value:8},{type:'sxp',value:2},{type:'drill',value:1}]);
 assert.equal(draft.seasonQ.prog,8);assert.equal(draft.seasonQ.idx,0);assert.deepEqual(draft.seasonQ.claimed,{});assert.equal(draft.seasonQ.unlocked,false);assert.deepEqual(draft.tokens,original.tokens);
 assert.equal(summary.updates.length,1);assert.equal(summary.updates[0].completed,true);assert.deepEqual(JSON.parse(JSON.stringify(summary)),summary);assert.deepEqual(f.live,original);noEffects(f);
 f.commit(draft);f.module.confirmed(summary,{runId:'one',saved:true});
 assert.equal(f.trace.writes,0);assert.equal(f.trace.reads,1);assert.equal(f.trace.toasts.length,1);assert.match(f.trace.toasts[0],/Wick/);
 assert.deepEqual(f.module.reduce(draft,[{type:'cleanjump',value:8}]),{updates:[]});
});

test('almanac ignores stale seasons, wrong objectives, and invalid counts',()=>{
 for(const options of [{key:'old-season'},{idx:1},{idx:2}]){
  const f=bookFixture(options),draft=f.live,before=clone(draft);
  assert.deepEqual(f.module.reduce(draft,[{type:'cleanjump',value:8}]),{updates:[]});assert.deepEqual(draft,before);noEffects(f);
 }
 const f=bookFixture(),draft=f.live;f.module.reduce(draft,[{type:'cleanjump',value:NaN},{type:'cleanjump',value:-1},{type:'cleanjump',value:0},{type:'cleanjump',value:Infinity}]);
 assert.equal(draft.seasonQ.prog,0);noEffects(f);
});

test('almanac training leaves pending riding distance intact and legacy flush still works',()=>{
 const f=bookFixture({idx:1});f.hooks.dailyEvt[0]('gallop',12);
 assert.equal(f.api.pending,12);assert.equal(f.trace.writes,0);const draft=f.live;
 const summary=f.module.reduce(draft,[{type:'cleanjump',value:8},{type:'sxp',value:1},{type:'drill',value:1}]);
 assert.equal(f.api.pending,12);assert.equal(draft.seasonQ.prog,0);
 f.commit(draft);f.module.confirmed(summary,{runId:'one',saved:true});assert.equal(f.api.pending,12);assert.equal(f.trace.writes,0);
 f.hooks.dailyEvt[0]('gallop',8);assert.equal(f.api.pending,0);assert.equal(f.live.seasonQ.prog,20);assert.equal(f.trace.writes,1);
 f.hooks.dailyEvt[0]('gallop',20);assert.equal(f.live.seasonQ.prog,40);assert.equal(f.trace.toasts.length,1);
 f.hooks.dailyEvt[0]('gallop',20);assert.equal(f.live.seasonQ.prog,40);assert.equal(f.trace.toasts.length,1,'completed entries notify once');
});

test('the three modules expose the agreed receipt reducers without save-writing confirmation callbacks',()=>{
 const fixtures=[sideFixture(),seasonFixture(),bookFixture()];
 assert.deepEqual(fixtures.flatMap(f=>Object.keys(f.registered)),['side-quests','season-challenges','season-almanac']);
 for(const f of fixtures){f.module.confirmed({updates:[],completed:[]},{runId:'one',saved:true});assert.equal(f.trace.writes,0);assert.deepEqual(f.trace.toasts,[]);}
});
