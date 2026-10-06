import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bondingPlan,foodTrainingPlan,careReceipt} from '../assets/features/care-presentation.js';
const horse={id:'willow',name:'Willow',bond:38,level:2,xp:20,stats:{speed:3},sxp:{speed:30}};
const names=['Stranger','Acquaintance','Companion','Partner','Kindred','Heart-bonded'];
const xp={statCap:()=>5,statCeil:()=>8,statNeed:v=>20+10*v};
test('Personality recommendations and preview match actual gain with the bond cap',()=>{
 const h={...horse,bond:98},before=JSON.stringify(h),personality={groom:2,pet:1,feed:1.5,whistleLv:0};
 const p=bondingPlan(h,{personality,names,bondGain:(h,v,k)=>Math.round(v*(personality[k]||1))});
 assert.equal(p.actions.find(a=>a.id==='groom').gain,2);assert.equal(p.remaining,2);assert.match(p.preference,/grooming and treats/);
 assert.equal(p.nextName,'Heart-bonded');assert.match(p.nextBenefit,/10% less stamina/);assert.equal(JSON.stringify(h),before);
});
test('Whistle milestone uses the actual temperament threshold, with no invented tricks',()=>{
 const p=bondingPlan(horse,{names,personality:{whistleLv:2}});assert.match(p.nextBenefit,/Answers the pasture whistle/);
 assert.doesNotMatch(p.nextBenefit,/bow|trick|cuddle|animation/);
 const complete=bondingPlan({...horse,bond:100},{names});assert.equal(complete.next,null);assert(complete.actions.every(a=>a.gain===0));
});
test('Training includes a bond multiplier reached by this very treat',()=>{
 const h={...horse,bond:79},food={stat:'speed',sxp:12,bond:2};
 const p=foodTrainingPlan(h,food,{...xp,have:4,multiplier:fed=>fed.bond>=80?1.05:1});
 assert.equal(p.gain,13);assert.equal(p.remaining,20);assert.equal(p.count,2);assert.equal(p.have,4);assert.equal(h.bond,79);
});
test('Level and breed caps both prevent a misleading training promise',()=>{
 for(const limits of [{statCap:()=>3,statCeil:()=>8},{statCap:()=>8,statCeil:()=>3}]){
  const p=foodTrainingPlan(horse,{stat:'speed',sxp:48,bond:1},{...xp,...limits});assert(p.capped);assert.equal(p.gain,0);assert.equal(p.count,null);
 }
 assert.equal(foodTrainingPlan(horse,{label:'Hay'},xp),null);
});
test('Training handles no stock and a zero multiplier without infinity or mutation',()=>{
 const before=JSON.stringify(horse),p=foodTrainingPlan(horse,{stat:'speed',sxp:6},{...xp,have:0,multiplier:()=>0});
 assert.equal(p.gain,0);assert.equal(p.count,null);assert.equal(p.have,0);assert.equal(JSON.stringify(horse),before);
});
test('Receipt reports actual capped bond and trained base stat from the saved result',()=>{
 const before={...horse,bond:99},after={...horse,bond:100,xp:25,stats:{speed:4},sxp:{speed:3}};
 const r=careReceipt(before,after,{action:'carrot',food:{label:'Carrot',stat:'speed'},statLabels:{speed:'💨 Speed'}});
 assert.equal(r.bond,1);assert.deepEqual(r.gains,['+1 bond','+5 horse XP','Speed 3 → 4']);assert.equal(r.title,'Fed Carrot to Willow');
 assert.doesNotMatch(r.gains.join(' '),/\+23 speed XP/,'level-up progress is not mislabelled as newly granted XP');
});
test('XP receipt survives level rollover and never invents discarded maximum-level XP',()=>{
 const before={...horse,level:2,xp:148},after={...horse,level:3,xp:3};
 assert.deepEqual(careReceipt(before,after,{action:'groom'}).gains,['Level 2 → 3','+5 horse XP']);
 const max=careReceipt({...horse,level:49,xp:2498},{...horse,level:50,xp:0},{action:'groom'});
 assert.deepEqual(max.gains,['Level 49 → 50']);
});
test('Receipt includes stat XP without a level, and rejects a different horse identity',()=>{
 const r=careReceipt(horse,{...horse,sxp:{speed:42}},{action:'carrot',food:{stat:'speed',label:'Carrot'},statLabels:{speed:'Speed'}});
 assert.deepEqual(r.gains,['+12 speed XP']);assert.equal(careReceipt(horse,{...horse,id:'another'},{action:'pet'}),null);
});

const source=await readFile(new URL('../assets/features/se-care.js',import.meta.url),'utf8');
const careCode=source.slice(source.indexOf(' let pendingCare=null;'),source.indexOf(' function openOther(what)'));
test('Overview delegates once and reads the completed transaction by horse id after reordering',()=>{
 let save={horses:[structuredClone(horse)]},calls=0,hook;const announce={},ST={receipt:null},T={FOODS3:{carrot:{label:'Carrot',stat:'speed'}},STAT_LBL:{speed:'Speed'}};
 const G={on(k,f){assert.equal(k,'careDone');hook=f;},xp:{MAX_LEVEL:50},horse:{rideIdx:()=>0},ui:{careAct(action){calls++;const h=save.horses[0];h.bond+=2;h.xp+=5;save.horses.unshift({...horse,id:'new'});hook(action,true);}}};
 const perform=Function('G','ST','T','fresh','$','careReceipt',careCode+'\nreturn performCare;')(G,ST,T,()=>structuredClone(save),()=>announce,careReceipt);
 perform('carrot');assert.equal(calls,1);assert.equal(ST.receipt.horseId,'willow');assert.equal(ST.receipt.bond,2);assert.match(announce.textContent,/Willow/);
});
test('Unsuccessful care clears the receipt without reporting a reward',()=>{
 let hook;const ST={receipt:{horseId:'old'}},G={on(k,f){hook=f;},xp:{},horse:{rideIdx:()=>0},ui:{careAct(action){hook(action,false);}}};
 const perform=Function('G','ST','T','fresh','$','careReceipt',careCode+'\nreturn performCare;')(G,ST,{FOODS3:{}},()=>({horses:[horse]}),()=>({}),careReceipt);
 perform('pet');assert.equal(ST.receipt,null);
});

const bondSource=await readFile(new URL('../assets/features/bond-personality-emotes.js',import.meta.url),'utf8');
const petCode=bondSource.slice(bondSource.indexOf(' function playPet(h){'),bondSource.indexOf(" G.on('careDone'"));
test('Native petting keeps heart feedback without calling unsupported emotes or claiming an animation',()=>{
 const calls=[],G={horse:{RIG:()=>({profile:{nativeBreed:true}}),horseEmote:()=>{throw Error('unsupported emote called');}}};
 const pet=Function('G','petAnimFor','player','headPos','burst','toast','PET_ANIMS',petCode+'\nreturn playPet;')(G,()=>({em:'nuzzle',lvl:0,label:'Stroke'}),{speed:0,y:0},()=>({x:1,y:2,z:3}),(...a)=>calls.push(a),()=>{throw Error('unearned animation promise');},[]);
 pet(horse);assert.equal(calls.length,1);assert.equal(calls[0][3],'heart');
});
test('Legacy supported pet emotes still run once',()=>{
 const rig={profile:{}},calls=[],G={horse:{RIG:()=>rig,horseEmote(type){calls.push(type);rig.emote={};return true;}}};
 const pet=Function('G','petAnimFor','player','headPos','burst','toast','PET_ANIMS',petCode+'\nreturn playPet;')(G,()=>({em:'nuzzle',lvl:0,label:'Stroke'}),{speed:0,y:0},()=>({x:0,y:0,z:0}),()=>{},()=>{},[]);
 pet(horse);assert.deepEqual(calls,['nuzzle']);assert(rig.emote.pet);
});
test('Overview Back returns to its calling event after closing; Close stays a dismissal',()=>{
 const closeLine=source.split('\n').find(l=>l.includes("if(op==='close')")),calls=[];
 const run=Function('op','b','ST','close',closeLine);
 const ST={onBack:()=>calls.push('event')};run('close',{dataset:{careBack:'true'}},ST,()=>{calls.push('close');ST.onBack=null;});assert.deepEqual(calls,['close','event']);
 calls.length=0;ST.onBack=()=>calls.push('event');run('close',{dataset:{}},ST,()=>calls.push('close'));assert.deepEqual(calls,['close']);
 assert.match(source,/data-se="close" data-care-back="true" title="Back"/,'stable return selector remains intact');
});
