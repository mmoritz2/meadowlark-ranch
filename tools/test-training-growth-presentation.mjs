import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trainingReceiptView} from '../assets/features/training-drills.js';

// Execute the production result renderer with receipts from its core contract.
// No player save, reward implementation, canvas, or browser is replaced or run.
const source=fs.readFileSync(new URL('../assets/features/training-drills.js',import.meta.url),'utf8');
const start=source.indexOf(' function resultMarkup(){'),end=source.indexOf(" G.ui.panel({id:'trainingResultPanel'",start);
assert(start>0&&end>start);
const labels={speed:'Speed',stamina:'Stamina',jump:'Jump',accel:'Acceleration',agility:'Agility'};
const finite=(n,f=0)=>Number.isFinite(n)?n:f,fmt=n=>Math.max(0,Math.round(finite(n))).toLocaleString();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render=new Function('receipt','G','trainingReceiptView','finite','selectedCap','fmt','esc','canRepeat','eventTarget','LABELS',source.slice(start,end)+'return resultMarkup();');
const statNeed=v=>20+10*v;
function markup(r,target=null){return render(r,{xp:{statNeed}},trainingReceiptView,finite,()=>({atCap:true,horse:{id:'willow'}}),fmt,esc,()=>true,target,labels);}
function receipt(overrides={}){return {runId:'growth-run',horseId:'willow',horseName:'Willow',activity:'jump',unit:'jumps',stat:'jump',saved:true,completed:true,cleared:8,total:8,elapsed:60,
 before:{value:4,xp:0,cap:4},after:{value:4,xp:0,cap:4},statXp:0,statRaised:0,coins:64,passPoints:12,clinic:{misses:0},
 growth:{before:{level:4,xp:125},after:{level:4,xp:149},horseXp:24,levels:0,statGains:{},maxLevel:50,nextTrainingLevel:5,breedCap:8,nextLevelXp:250},...overrides};}
function view(r){return trainingReceiptView(r,statNeed);}

test('saved capped practice presents separate actual horse XP and zero retained stat XP without mutation',()=>{
 const r=receipt(),before=structuredClone(r),v=view(r),html=markup(r);
 assert.equal(v.retainedXp,0);assert.equal(v.growth.horseXp,24);assert.equal(v.growth.percent,149/250*100);
 assert.match(html,/Horse level 4<\/strong>/);assert.match(html,/\+24 horse XP saved/);assert.match(html,/\+0 stat XP saved/);
 assert.match(html,/149 \/ 250 XP toward horse Lv 5/);assert.match(html,/aria-label="Horse level XP".*aria-valuemax="250" aria-valuenow="149"/);
 assert.match(html,/Next Jump training cap opens at horse Lv 5/);assert.match(html,/Cleared practice jumps still earn horse XP/);
 assert.deepEqual(r,before);
});
test('training stat XP and level-up bonus are separate even when both raise the same stat',()=>{
 const r=receipt({before:{value:3,xp:49,cap:4},after:{value:5,xp:0,cap:5},statXp:1,statRaised:1,
  growth:{before:{level:4,xp:248},after:{level:5,xp:22},horseXp:24,levels:1,statGains:{jump:1},maxLevel:50,nextTrainingLevel:10,breedCap:8,nextLevelXp:300}});
 const v=view(r),html=markup(r);assert.equal(v.retainedXp,1);assert.equal(v.growth.statGains.jump,1);
 assert.match(html,/Horse level 4 → 5/);assert.match(html,/\+1 stat XP saved/);assert.match(html,/Level-up bonus: \+1 Jump/);
 assert.match(html,/22 \/ 300 XP toward horse Lv 6/);assert.match(html,/Next Jump training cap opens at horse Lv 10/);
 assert.doesNotMatch(html,/\+2 stat XP saved|\+61 stat XP saved/,'level bonus cannot be reconstructed as retained training XP');
});
test('a level-up that reopens training shows the current cap instead of an obsolete ceiling',()=>{
 const r=receipt({after:{value:4,xp:0,cap:5},growth:{before:{level:4,xp:248},after:{level:5,xp:22},horseXp:24,levels:1,statGains:{speed:1},maxLevel:50,nextTrainingLevel:10,breedCap:8,nextLevelXp:300}});
 const v=view(r),html=markup(r);assert.equal(v.capped,false);assert.equal(v.percent,0);assert.equal(v.retainedXp,0);
 assert.match(html,/Horse Lv 5 opened a training cap of 5/);assert.match(html,/Jump training can grow again/);
 assert.match(html,/Level-up bonus: \+1 Speed/);assert.doesNotMatch(html,/Current training ceiling reached|No stat XP is added while/);
});
test('breed ceiling guidance never promises that horse levels unlock the capped base stat',()=>{
 const r=receipt({before:{value:6,xp:0,cap:6},after:{value:6,xp:0,cap:6},growth:{before:{level:30,xp:100},after:{level:30,xp:124},horseXp:24,levels:0,statGains:{},maxLevel:50,nextTrainingLevel:null,breedCap:6,nextLevelXp:1550}});
 const html=markup(r);assert.match(html,/Breed ceiling reached for Jump/);assert.match(html,/More horse levels cannot raise this base stat/);
 assert.match(html,/\+24 horse XP saved/);assert.doesNotMatch(html,/Next Jump training cap opens|higher horse level may unlock/);
});
test('maximum horse level shows a full bar and no saved XP or nonexistent next level',()=>{
 const r=receipt({before:{value:8,xp:0,cap:8},after:{value:8,xp:0,cap:8},growth:{before:{level:50,xp:0},after:{level:50,xp:0},horseXp:0,levels:0,statGains:{},maxLevel:50,nextTrainingLevel:null,breedCap:8,nextLevelXp:2550}});
 const v=view(r),html=markup(r);assert.equal(v.growth.atMax,true);assert.equal(v.growth.percent,100);assert.equal(v.growth.horseXp,0);
 assert.match(html,/\+0 horse XP saved/);assert.match(html,/Maximum horse level: 50/);assert.match(html,/aria-valuetext="Maximum horse level reached"/);
 assert.doesNotMatch(html,/horse Lv 51|horse level 51|Cleared practice jumps still earn horse XP/);
});
test('the final level reports only XP actually retained before the maximum',()=>{
 const r=receipt({growth:{before:{level:49,xp:2497},after:{level:50,xp:0},horseXp:3,levels:1,statGains:{agility:1},maxLevel:50,nextTrainingLevel:null,breedCap:8,nextLevelXp:2550}});
 const html=markup(r);assert.match(html,/Horse level 49 → 50/);assert.match(html,/\+3 horse XP saved/);assert.doesNotMatch(html,/\+24 horse XP saved|toward horse Lv 51/);
});
test('a pending proposal cannot expose level growth, bonuses, cap unlocks or clean-jump claims',()=>{
 const r=receipt({saved:false,progress:{cleanJumps:8},growth:{before:{level:4,xp:248},after:{level:5,xp:22},horseXp:24,levels:1,statGains:{jump:1},maxLevel:50,nextTrainingLevel:10,breedCap:8,nextLevelXp:300}});
 const v=view(r),html=markup(r);assert.equal(v.growth,null);assert.equal(v.trainingHint,'');assert.equal(v.cleanJumps,0);assert.equal(v.after,null);assert.equal(v.retainedXp,0);
 assert.match(html,/Retry saving to confirm your horse XP, stat XP and coins/);
 assert.doesNotMatch(html,/horse XP saved|stat XP saved|Horse level progress|Level-up bonus|clean jumps recorded|training cap opens/);
});
test('legacy receipts remain valid without inventing level rewards',()=>{
 const r=receipt({growth:undefined}),html=markup(r);assert.equal(view(r).growth,null);assert.match(html,/\+0 stat XP saved/);
 assert.doesNotMatch(html,/Horse level progress|horse XP saved|Maximum horse level/);
});
test('multiple level bonuses remain separately labelled and unknown stat text never enters markup',()=>{
 const r=receipt({growth:{before:{level:4,xp:240},after:{level:6,xp:12},horseXp:322,levels:2,statGains:{jump:1,agility:1,'<script>':99},maxLevel:50,nextTrainingLevel:10,breedCap:8,nextLevelXp:350}});
 const html=markup(r);assert.match(html,/Horse level 4 → 6/);assert.match(html,/\+322 horse XP saved/);assert.match(html,/Level-up bonus: \+1 Jump · \+1 Agility/);assert.doesNotMatch(html,/<script>/);
});
test('saved clean jump count and the event return button coexist without inventing a completed round',()=>{
 const r=receipt({completed:false,cleared:3,progress:{cleanJumps:3}}),target={eventName:'Farm <Derby>'},html=markup(r,target);
 assert.equal(view(r).cleanJumps,3);assert.match(html,/3 clean jumps recorded/);assert.match(html,/Building your jumping rhythm/);assert.doesNotMatch(html,/All 8 jumps cleared/);
 assert.match(html,/data-fx="training:event">Back to Farm &lt;Derby&gt;/);assert.match(html,/Return to check your horse’s updated readiness/);
 assert.doesNotMatch(markup({...r,saved:false},target),/data-fx="training:event"|clean jumps recorded|horse XP saved/);
});
test('invalid or absent growth data does not render nonfinite progress or fabricate growth',()=>{
 for(const growth of [null,{}, {before:{level:4},after:{level:NaN,xp:1}}, {before:{level:4},after:{level:3,xp:10}}, {before:{level:4},after:{level:5,xp:Infinity}}]){
  const r=receipt({growth});assert.equal(view(r).growth,null);assert.doesNotMatch(markup(r),/Horse level progress|NaN|Infinity/);
 }
});
