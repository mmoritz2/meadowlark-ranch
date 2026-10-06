import test from 'node:test';
import assert from 'node:assert/strict';
import {RESCUE_DEFINITION,sanitizeRescueSave,recordRescueFinish,canAdoptClover,calmAfter,isTravelJump} from '../assets/features/rescue-rules.mjs';

const finish=(overrides={})=>({runId:'actual-ride',stage:'escort',clues:2,returnStep:3,elapsed:140,...overrides});
test('a physical completed escort unlocks one adoption and records a best time',()=>{
 const first=recordRescueFinish(null,finish());
 assert.equal(first.recorded,true);assert.equal(first.save.completions,1);assert.equal(first.save.bestTime,140);
 assert.equal(first.result.firstCompletion,true);assert.deepEqual(first.result.pay,{c:180,xp:60});assert.equal(canAdoptClover(first.save),true);
 const next=recordRescueFinish({...first.save,adopted:true},finish({runId:'second',elapsed:120}));
 assert.equal(next.save.completions,2);assert.equal(next.save.bestTime,120);assert.equal(next.result.firstCompletion,false);assert.equal(next.result.canAdopt,false);
 assert.equal(canAdoptClover({...first.save,adopted:true}),false);
});
test('duplicate callbacks, cancellations and skipped route steps do not earn rewards',()=>{
 const first=recordRescueFinish(null,finish());
 assert.equal(recordRescueFinish(first.save,finish()).recorded,false);
 for(const change of [{stage:'find'},{stage:'calm'},{clues:1},{returnStep:2},{returnStep:4},{elapsed:0},{elapsed:NaN},{runId:''}])assert.equal(recordRescueFinish(null,finish(change)).recorded,false);
 assert.equal(canAdoptClover(null),false);
});
test('calming requires proximity and a gentle stop, not time in a menu or a gallop',()=>{
 let calm=0;for(let i=0;i<40;i++)calm=calmAfter(calm,{distance:4,speed:0,dt:.1});assert.equal(calm,100);
 assert(calmAfter(50,{distance:4,speed:8,dt:.1})<50);
 assert(calmAfter(50,{distance:12,speed:0,dt:.1})<50);
 assert(calmAfter(50,{distance:4,speed:2,dt:.1})<50);
 assert.equal(calmAfter(50,{distance:4,speed:0,dt:10}),50);
});
test('fast travel is rejected while continuous galloping and dismount steps are allowed',()=>{
 assert.equal(isTravelJump(50,.016,0),true);
 assert.equal(isTravelJump(20,.016,40),true);
 assert.equal(isTravelJump(.8,.016,50),false);
 assert.equal(isTravelJump(1.5,.016,0),false);
 assert.equal(isTravelJump(NaN,.016,0),true);
});
test('save fields are bounded and the permanent hay bales and trough stay clear of the rescue route',()=>{
 assert.deepEqual(sanitizeRescueSave({completions:NaN,bestTime:Infinity,lastRunId:5}),{version:1,completions:0,bestTime:null,adopted:false,lastRunId:'',adoptedHorseId:null});
 assert.equal(sanitizeRescueSave({completions:-3,bestTime:20}).bestTime,null);
 for(let i=1;i<RESCUE_DEFINITION.route.length;i++){
  const a=RESCUE_DEFINITION.route[i-1],b=RESCUE_DEFINITION.route[i];
  for(const [x,z] of [[-90,-35],[-88.6,-33.8],[-100,-10]]){
   const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
   assert(Math.hypot(a[0]+dx*t-x,a[1]+dz*t-z)>3);
  }
 }
});
