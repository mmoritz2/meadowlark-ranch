/* Actual pure summon/catalog rules. No browser, network, clocks, or player save. */
const assert=require('node:assert/strict');
const clone=value=>structuredClone(value);
let checks=0;
const check=(value,label)=>{assert(value,label);checks++;};
(async()=>{
 const S=await import('../assets/tack-summon.mjs'),C=await import('../assets/tack-collection.mjs');
 const {TACK_SUMMON_COST:cost,TACK_SUMMON_POOL:all,getTackSummonPool:pool,summonTackPiece:summon}=S;
 const base=()=>({coins:50000,gems:77,wallet:{purchasedGems:123},tack:[{id:'legacy-pad',slot:'pad',name:'Existing pad',bonus:{jump:3}}],horses:[{id:'a',name:'Maple',gear:{pad:'legacy-pad'},bareback:true},{id:'b',name:'Fern',gear:{}}],stats:{tackBought:7,earned:500},rider:{name:'Rider'}});
 const noMutation=(save,options,code)=>{const before=clone(save),result=summon(save,options);assert.equal(result.code,code);check(!result.ok&&!result.changed,code+' fails without a change');assert.deepEqual(save,before,code+' must not mutate any save field');return result;};
 assert.equal(cost,200);assert.equal(all.length,100);assert.equal(new Set(all.map(p=>p.id)).size,100);
 check(Object.isFrozen(all)&&all.every(p=>Object.isFrozen(p)&&Object.isFrozen(p.design)),'pool and catalog entries are immutable');
 assert.deepEqual(all,C.TACK_PIECES.filter(p=>!p.premiumProduct&&!p.free));
 check(all.every(p=>p.currency==='coins'&&p.priceCoins>0&&!p.premiumProduct&&!p.free),'only ordinary earned-coin tack enters the pool');
 const unchanged=base(),initial=clone(unchanged),query=pool(unchanged);query.pop();assert.equal(pool(unchanged).length,100);assert.deepEqual(unchanged,initial,'pool query is read-only');
 check(C.TACK_SLOTS.every(slot=>pool(unchanged,slot).length===25),'all four categories start with 25 pieces');
 assert.deepEqual(pool(unchanged,'invalid'),[]);
 console.log('PASS exact 100-piece immutable earned-only pool, four categories and read-only queries');

 // Equal-size roll intervals choose each remaining item exactly once, including
 // category pools after prior ownership changes their denominators.
 for(const slot of ['all',...C.TACK_SLOTS]){
  const save=base();for(const p of all.filter(p=>slot==='all'||p.slot===slot).slice(0,3))assert(C.buyTackPiece(save,p.id).ok);
  const remaining=pool(save,slot),seen=new Set();
  for(let i=0;i<remaining.length;i++){
   const trial=clone(save),r=summon(trial,{slot,roll:(i+.5)/remaining.length});
   check(r.ok&&r.piece.id===remaining[i].id&&r.poolSize===remaining.length,slot+' uniform current-pool selection');seen.add(r.piece.id);
   assert.equal(r.item.slot,r.piece.slot);assert.equal(trial.coins,save.coins-cost);
  }
  assert.equal(seen.size,remaining.length);
  assert.equal(summon(clone(save),{slot,roll:0}).piece.id,remaining[0].id);
  assert.equal(summon(clone(save),{slot,roll:1-Number.EPSILON}).piece.id,remaining.at(-1).id);
 }
 console.log('PASS uniform interval selection and boundary rolls across every remaining slot pool');

 let save=base();const before=clone(save),seen=new Set();
 for(let i=0;i<100;i++){
  const result=summon(save,{roll:.6180339887});
  check(result.ok&&result.changed&&result.code==='summoned'&&result.cost===200&&result.poolSize===100-i,'one atomic charged grant per summon');
  check(!seen.has(result.piece.id),'summons never duplicate owned ordinary pieces');seen.add(result.piece.id);
  const bought=base(),purchase=C.buyTackPiece(bought,result.piece.id);assert.deepEqual(result.item,purchase.item,'summon inventory is identical to boutique inventory');
  assert.notEqual(result.item.bonus,result.piece.bonus,'inventory bonus is a mutable copy, not shared catalog state');
  assert.equal(save.tackSummon.count,i+1);assert.equal(save.tackSummon.lastCatalogId,result.piece.id);assert.equal(save.stats.tackSummons,i+1);assert.equal(save.stats.tackBought,7);
  assert.deepEqual(save.horses,before.horses,'grant never auto-equips or changes horses');
 }
 assert.equal(seen.size,100);assert.equal(save.coins,before.coins-100*cost);assert.equal(save.tack.length,101);assert.deepEqual(save.tack[0],before.tack[0]);
 for(const key of ['gems','wallet','rider'])assert.deepEqual(save[key],before[key],key+' remains untouched');
 assert.equal(save.stats.earned,before.stats.earned);assert.equal(pool(save).length,0);noMutation(save,{roll:0},'complete');
 const reloaded=JSON.parse(JSON.stringify(save));assert.equal(reloaded.tackSummon.lastCatalogId,save.tackSummon.lastCatalogId);assert.equal(pool(reloaded).length,0);noMutation(reloaded,{roll:.5},'complete');
 for(const p of all){const result=C.equipTackPiece(reloaded,p.id,'a');check(result.ok,'each summoned piece equips using ordinary boutique flow');assert.equal(reloaded.horses[0].gear[p.slot],C.ownedTackPiece(reloaded,p.id).id);}
 const chosen=all[0],item=C.ownedTackPiece(reloaded,chosen.id);assert(C.equipTackPiece(reloaded,chosen.id,'b').ok);assert.equal(reloaded.horses[1].gear[chosen.slot],item.id);assert.notEqual(reloaded.horses[0].gear[chosen.slot],item.id);
 assert(C.unequipTackPiece(reloaded,chosen.id,'b').ok);assert(C.ownedTackPiece(reloaded,chosen.id));assert.equal(reloaded.stats.tackBought,7);
 console.log('PASS all 100 charged once, exact boutique schema, JSON recovery, unchanged unrelated data and real equip/move/remove compatibility');

 for(const roll of [undefined,null,NaN,Infinity,-Infinity,-.1,1,1.1,'0',{},()=>.5])noMutation(base(),{roll},'invalid-roll');
 noMutation(base(),undefined,'invalid-roll');
 for(const slot of ['','legs','__proto__','constructor',null,3,{},...C.TACK_PIECES.filter(p=>p.premiumProduct||p.free).map(p=>p.id)])noMutation(base(),{slot,roll:.5},'invalid-slot');
 for(const coins of [undefined,0,199,-1,NaN,Infinity,'200']){const poor=base();poor.coins=coins;noMutation(poor,{roll:.5},'insufficient-coins');}
 for(const malformed of [null,[],{coins:200,tack:{}},{coins:200,tack:[],stats:[]},{coins:200,tack:[],stats:1},{coins:200,tack:[],tackSummon:'bad'},{coins:200,tack:[],tackSummon:{count:-1}},{coins:200,tack:[],stats:{tackSummons:NaN}},{coins:200,tack:[],tackSummon:{count:Number.MAX_SAFE_INTEGER}}])noMutation(malformed,{roll:0},'invalid-save');
 const exact={coins:cost};assert(summon(exact,{roll:0}).ok);assert.equal(exact.coins,0);assert.equal(exact.tack.length,1);assert.deepEqual(exact.stats,{tackSummons:1});assert.deepEqual(exact.tackSummon,{count:1,lastCatalogId:all[0].id});
 const categoryDone=base();for(const p of all.filter(p=>p.slot==='pad'))assert(C.buyTackPiece(categoryDone,p.id).ok);assert.equal(pool(categoryDone).length,75);noMutation(categoryDone,{slot:'pad',roll:0},'complete');assert(summon(categoryDone,{slot:'saddle',roll:0}).ok);
 console.log('PASS invalid/missing rolls, forged slots, insufficient coins, malformed saves and completed categories never charge or mutate');

 const collision=base(),first=all[0];collision.tack.push({id:'boutique_'+first.id,slot:'shoes'},{id:'boutique_'+first.id+'_2',slot:'pad'});
 const existing=clone(collision.tack),collisionResult=summon(collision,{roll:0});assert.equal(collisionResult.item.id,'boutique_'+first.id+'_3');assert.deepEqual(collision.tack.slice(0,existing.length),existing);assert.equal(new Set(collision.tack.map(t=>t.id)).size,collision.tack.length);
 const resumed=JSON.parse(JSON.stringify(collision));assert(!pool(resumed).some(p=>p.id===first.id));assert(summon(resumed,{roll:0}).ok);assert.equal(resumed.tackSummon.count,2);assert.equal(resumed.stats.tackSummons,2);assert.equal(resumed.stats.tackBought,7);
 const counterSave=base();counterSave.tackSummon={count:12,lastCatalogId:first.id};counterSave.stats.tackSummons=15;assert(summon(counterSave,{roll:0}).ok);assert.equal(counterSave.tackSummon.count,13);assert.equal(counterSave.stats.tackSummons,16);
 for(const p of C.TACK_PIECES.filter(p=>p.premiumProduct||p.free)){
  const guarded=base(),snapshot=clone(guarded);assert.equal(C.grantEarnedTackPiece(guarded,p.id).ok,false);assert.deepEqual(guarded,snapshot,'earned reward grant cannot award free or premium items');
 }
 const rights=base();rights.tack.push({id:'account-rainbow',catalogId:'tc_rainbow_saddle',slot:'saddle',paidProduct:'tack_rainbow',paidAccountId:'alice',paidEntitlementId:'test-order'});rights.paidTackArchive=[{accountId:'alice',entitlementId:'other',catalogId:'tc_rainbow_pad'}];
 const paidBefore=clone(rights);assert.equal(pool(rights).length,100);assert(summon(rights,{roll:0}).ok);assert.deepEqual(rights.tack[1],paidBefore.tack[1]);assert.deepEqual(rights.paidTackArchive,paidBefore.paidTackArchive);check(!rights.tack.at(-1).paidProduct&&!rights.tack.at(-1).paidEntitlementId,'summoned item never inherits account rights');
 const missing=base(),missingBefore=clone(missing);assert.equal(C.grantEarnedTackPiece(missing,'forged').ok,false);assert.deepEqual(missing,missingBefore);
 const duplicate=base();assert(C.grantEarnedTackPiece(duplicate,first.id).changed);const duplicateBefore=clone(duplicate);assert.equal(C.grantEarnedTackPiece(duplicate,first.id).changed,false);assert.deepEqual(duplicate,duplicateBefore,'guarded grant does not duplicate owned inventory');
 const deterministicA=base(),deterministicB=clone(deterministicA);summon(deterministicA,{slot:'bridle',roll:.37});summon(deterministicB,{slot:'bridle',roll:.37});assert.deepEqual(deterministicA,deterministicB,'caller-provided roll is deterministic without a clock/random source');
 console.log('PASS collision-safe inventory IDs, continued recovery counters, paid/free isolation, guarded grants and deterministic selection');
 console.log('PASS '+checks+' focused tack summon checks');
})().catch(error=>{console.error(error);process.exitCode=1;});
