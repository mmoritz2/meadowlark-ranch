import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the actual rank table and claim function against the actual core JSON
// save/readback functions and reward registry. Browser output and localStorage
// faults are scoped. A confirmed marker is not proof of external transactions.
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const core=read('ranch3d.html'),pvp=read('assets/features/events-pvp.js');
function section(text,a,b){const i=text.indexOf(a),j=text.indexOf(b,i);assert(i>=0&&j>i,a);return text.slice(i,j);}
const saveSource=section(core,'function syncSave(fn){','function addCoins(');
const freshSource=core.split('\n').find(line=>line.startsWith('function freshSave(){'));assert(freshSource);
const ensureSource=core.split('\n').find(line=>line.startsWith('function runEnsures(s){'));assert(ensureSource);
const rewards=section(core,'const REWARD_KINDS={};','function isoWeekKey(');
const gems=core.split('\n').find(line=>line.startsWith('function grantGems(s,n){'));assert(gems);
const earning=section(core,'function logEarn(s,amount){','function bondGain(');
const gearSource=section(core,"const GEAR_SLOTS=['saddle'",'let tackInv=[];');
const rankSource=section(pvp,' const TIX_DAILY=',' /* --- the weekly leaderboard prize ladder');
const rankEnsure=section(pvp,' G.save.ensure(s=>{',' const tix=');
const claimSource=section(pvp,' function claimRank(i){',' /* ================================================================= weekly boards');
const copy=value=>structuredClone(value);
function seed(points=100){return {coins:100,gems:2,keys:1,btok:0,items:{},stats:{earned:0},tack:[],horses:[{id:1,name:'Bramble',gear:{}}],tix:{date:new Date().toDateString(),n:10},racing:{pts:points,races:2,wins:1,pvp:0,claimed:{}}};}
function fixture(initial=seed()){
 let stored=JSON.stringify(initial),mode='normal',freshMode='normal',mutatorMode='normal';
 const first=stored,trace={reads:0,writes:0,commits:0,notices:[],effects:[],errors:[]};
 let sinceWrite=false;
 const localStorage={
  getItem(key){assert.equal(key,'rank-claim-test');trace.reads++;
   if(sinceWrite&&freshMode==='storage-unavailable')throw Error('read unavailable');
   if(sinceWrite&&freshMode==='stale')return first;
   if(mode==='read-failure')throw Error('storage unavailable');
   return stored;
  },
  setItem(key,value){assert.equal(key,'rank-claim-test');trace.writes++;
   if(mode==='before-write')throw Error('quota exceeded');
   stored=String(value);trace.commits++;sinceWrite=true;
   if(mode==='after-write')throw Error('write returned ambiguously');
  }
 };
 const G={
  save:{ensure(fn){ctx.SAVE_ENSURES.push(fn);}},
  time:{dateKey:()=>new Date().toDateString()},
  money:{refreshWallet:()=>trace.effects.push('wallet')},
  horse:{refreshTack:()=>trace.effects.push('tack')},sGem:()=>trace.effects.push('sound'),
  ui:{rerender:id=>trace.effects.push('render:'+id)}
 };
 const ctx=vm.createContext({G,Date,Math,localStorage,SAVE_KEY:'rank-claim-test',save:{},SAVE_ENSURES:[],STAT_KEYS:['speed','stamina','jump','accel','agility'],
  mulOf:()=>1,toast:message=>trace.notices.push(String(message)),console:{error:(...args)=>trace.errors.push(args.map(String))}});
 vm.runInContext(ensureSource+saveSource+freshSource+gems+earning+gearSource+rewards+rankSource+rankEnsure+claimSource,ctx);
 G.save.sync=ctx.syncSave;
 G.save.fresh=()=>{if(sinceWrite&&freshMode==='throws')throw Error('caller readback failed');return ctx.freshSave();};
 G.money.payReward=(s,r)=>{if(mutatorMode==='before-rewards')throw Error('mutator failed');ctx.payReward(s,r);if(mutatorMode==='after-rewards')throw Error('mutator failed after draft rewards');};
 G.money.rewardLabel=ctx.rewardLabel;
 return {
  claim:i=>ctx.claimRank(i),trace,
  get raw(){return JSON.parse(stored);},get bytes(){return stored;},
  fresh:()=>JSON.parse(JSON.stringify(ctx.freshSave())),
  mode:value=>{mode=value;},readback:value=>{freshMode=value;},mutator:value=>{mutatorMode=value;},
  stopReadbackFault:()=>{freshMode='normal';sinceWrite=false;},
  ranks:()=>JSON.parse(vm.runInContext('JSON.stringify(RACE_RANKS)',ctx)),
 };
}
const hasSuccess=f=>f.trace.notices.some(message=>message.includes('claimed —'));
const quiet=f=>{assert.deepEqual(f.trace.effects,[]);assert.equal(hasSuccess(f),false);};
const retry=f=>{quiet(f);assert.match(f.trace.notices.at(-1)||'',/could not be confirmed as saved.*try again/);};

test('Bronze Bit uses the actual fixed rank reward and confirms one shared JSON write before UI success',()=>{
 const f=fixture(),row=f.ranks()[1];assert.equal(row.at,100);assert.deepEqual(row.r,{c:300,tickets:3});
 assert.equal(f.claim(1),true);assert.equal(f.raw.coins,400);assert.equal(f.raw.stats.earned,300);assert.equal(f.raw.racing.claimed[1],true);
 assert.equal(f.raw.tickets,3);assert.equal(f.trace.commits,1);assert.deepEqual(f.trace.effects,['wallet','tack','sound','render:pvpPanel']);assert.equal(hasSuccess(f),true);
 assert.match(f.trace.notices.at(-1),/Bronze Bit claimed — 300/);
});
test('a failed write cannot confirm the marker, refresh the wallet or sound a false reward',()=>{
 const f=fixture(),before=f.bytes;f.mode('before-write');assert.equal(f.claim(1),false);assert.equal(f.bytes,before);assert.equal(f.trace.commits,0);retry(f);
 f.mode('normal');assert.equal(f.claim(1),true);assert.equal(f.raw.coins,400);assert.equal(f.trace.commits,1);assert.equal(f.trace.effects.filter(e=>e==='sound').length,1);
});
test('an ambiguous post-write error succeeds only because actual persisted readback contains the committed claim',()=>{
 const f=fixture();f.mode('after-write');assert.equal(f.claim(1),true);assert.equal(f.raw.racing.claimed[1],true);assert.equal(f.raw.coins,400);assert.equal(f.trace.commits,1);
 assert.equal(hasSuccess(f),true);assert.equal(f.trace.effects.filter(e=>e==='sound').length,1);
 const before=f.raw.coins;assert.equal(f.claim(1),false);assert.equal(f.raw.coins,before);assert.equal(f.trace.effects.filter(e=>e==='sound').length,1);
});
test('unavailable, throwing and stale post-write readbacks retain the committed reward but suppress unconfirmed success',()=>{
 for(const failure of ['storage-unavailable','throws','stale']){
  const f=fixture();f.readback(failure);assert.equal(f.claim(1),false);assert.equal(f.raw.racing.claimed[1],true);assert.equal(f.raw.coins,400);assert.equal(f.trace.commits,1);retry(f);
  f.stopReadbackFault();const notices=f.trace.notices.length;assert.equal(f.claim(1),false);assert.equal(f.raw.coins,400);assert.equal(f.trace.notices.length,notices);quiet(f);
  const reload=fixture(f.raw);assert.equal(reload.claim(1),false);assert.equal(reload.raw.coins,400);quiet(reload);
 }
});
test('an unavailable initial storage read cannot reach the draft reward mutation or show success',()=>{
 const f=fixture(),before=f.bytes;f.mode('read-failure');assert.equal(f.claim(1),false);assert.equal(f.bytes,before);assert.equal(f.trace.writes,0);assert.equal(f.trace.commits,0);quiet(f);
 f.mode('normal');assert.equal(f.claim(1),true);assert.equal(f.raw.coins,400);
});
test('mutator exceptions before or after draft reward changes abort the actual JSON write',()=>{
 for(const failure of ['before-rewards','after-rewards']){
  const f=fixture(),before=f.bytes;f.mutator(failure);assert.equal(f.claim(1),false);assert.equal(f.bytes,before);assert.equal(f.trace.writes,0);assert.equal(f.trace.commits,0);quiet(f);
  f.mutator('normal');assert.equal(f.claim(1),true);assert.equal(f.raw.coins,400);assert.equal(f.raw.racing.claimed[1],true);
 }
});
test('insufficient points, the empty starter rank and invalid indices never pay or announce rewards',()=>{
 for(const value of [-1,6,999,1.5,'1',null,undefined,NaN,Infinity]){
  const f=fixture(),before=f.bytes;assert.equal(f.claim(value),false);assert.equal(f.bytes,before);assert.equal(f.trace.writes,0);quiet(f);
 }
 for(const [points,index] of [[99,1],[299,2],[699,3],[1199,4],[1999,5],[2000,0]]){
  const f=fixture(seed(points)),before=f.raw;assert.equal(f.claim(index),false);assert.equal(f.raw.coins,before.coins);assert.equal(f.raw.gems,before.gems);assert.deepEqual(f.raw.tack,[]);assert.deepEqual(f.raw.racing.claimed,{});quiet(f);
 }
});
test('a duplicate claim and a new runtime after reload preserve the once-only economy outcome',()=>{
 const f=fixture();assert.equal(f.claim(1),true);const before=copy(f.raw),sounds=f.trace.effects.filter(e=>e==='sound').length;
 assert.equal(f.claim(1),false);assert.equal(f.raw.coins,before.coins);assert.equal(f.raw.stats.earned,before.stats.earned);assert.equal(f.trace.effects.filter(e=>e==='sound').length,sounds);
 const reload=fixture(f.raw),coins=reload.raw.coins;assert.equal(reload.claim(1),false);assert.equal(reload.raw.coins,coins);assert.deepEqual(reload.raw.racing.claimed,{'1':true});quiet(reload);
});
test('actual ticket reward migration respects the cap across readback, duplicate attempts and reload',()=>{
 const f=fixture(seed(700));assert.equal(f.claim(3),true);assert.equal(f.raw.gems,12);assert.equal(f.raw.keys,3);
 assert.equal(f.raw.tickets,5);assert.equal(f.fresh().tix.n,12);assert.equal(f.fresh().tickets,undefined);
 assert.equal(f.claim(3),false);assert.equal(f.raw.tix.n,12);assert.equal(f.raw.tickets,undefined);assert.equal(f.raw.gems,12);
 const reload=fixture(f.raw);assert.equal(reload.fresh().tix.n,12);assert.equal(reload.claim(3),false);assert.equal(reload.fresh().tix.n,12);
});
test('Silver and Champion generate actual gear once and keep it unchanged after duplicate claim and reload',()=>{
 for(const [index,rarity,gemsAdded] of [[2,'Rare',5],[5,'Epic',20]]){
  const f=fixture(seed(2000));assert.equal(f.claim(index),true);assert.equal(f.raw.gems,2+gemsAdded);assert.equal(f.raw.tack.length,1);
  const item=f.raw.tack[0];assert.equal(item.rarity,rarity);assert.ok(['saddle','pad','bridle','shoes'].includes(item.slot));assert.equal(typeof item.id,'string');assert(item.id.length>0);assert.equal(item.lvl,1);assert.equal(Object.keys(item.bonus).length,2);
  assert.deepEqual(Object.values(item.bonus),rarity==='Rare'?[3,1]:[4,4]);
  assert.equal(f.claim(index),false);assert.deepEqual(f.raw.tack,[item]);assert.equal(f.raw.gems,2+gemsAdded);
  const reload=fixture(f.raw);assert.equal(reload.claim(index),false);assert.deepEqual(reload.raw.tack,[item]);assert.equal(reload.raw.gems,2+gemsAdded);quiet(reload);
 }
});
test('all actual nonempty ranks pay their listed coin/gem/key/token rewards independently once',()=>{
 const f=fixture(seed(2000)),ranks=f.ranks().filter(rank=>Object.keys(rank.r).length),expected=ranks.reduce((total,rank)=>({
  coins:total.coins+(rank.r.c||0),gems:total.gems+(rank.r.g||0),keys:total.keys+(rank.r.k||0),btok:total.btok+(rank.r.btok||0)
 }),{coins:100,gems:2,keys:1,btok:0});
 for(let index=1;index<=5;index++)assert.equal(f.claim(index),true);
 assert.equal(f.raw.coins,expected.coins);assert.equal(f.raw.gems,expected.gems);assert.equal(f.raw.keys,expected.keys);assert.equal(f.raw.btok,expected.btok);assert.equal(f.raw.tack.length,2);
 assert.deepEqual(f.raw.racing.claimed,{'1':true,'2':true,'3':true,'4':true,'5':true});assert.equal(f.fresh().tix.n,12);
 const before=copy(f.raw);for(let index=1;index<=5;index++)assert.equal(f.claim(index),false);
 assert.equal(f.raw.coins,before.coins);assert.equal(f.raw.gems,before.gems);assert.equal(f.raw.keys,before.keys);assert.equal(f.raw.btok,before.btok);assert.deepEqual(f.raw.tack,before.tack);
 assert.equal(f.trace.effects.filter(effect=>effect==='sound').length,5);
});
