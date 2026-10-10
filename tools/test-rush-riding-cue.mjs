import test from 'node:test';
import assert from 'node:assert/strict';
import {rushRidingCue} from '../assets/features/ranch-rush-ui.js';
const active={started:true,completed:2,total:8,next:{kind:'fence'},lastCue:'Clean gate · +125 · 2 in a row'};
test('a previous score cannot hide recovery or an imminent jump instruction',()=>{
 assert.equal(rushRidingCue({active,jumpCue:'perfect',feedback:true}), 'Jump now — press Space.');
 assert.equal(rushRidingCue({active,jumpCue:'perfect',feedback:true,recovery:{hint:'Go around the log to retry.'}}),'Go around the log to retry.');
 assert.match(rushRidingCue({active,jumpCue:'lineup',feedback:true}),/^Line up/);
 assert.match(rushRidingCue({active,jumpCue:'late',feedback:true}),/^Too close/);
});
test('keyboard and touch riders learn the actual jump input even with direct Journey entry',()=>{
 assert.match(rushRidingCue({active:{...active,started:false},hasJumps:true}),/Press Space/);
 assert.match(rushRidingCue({active:{...active,started:false},hasJumps:true,touch:true}),/Tap Jump/);
 assert.equal(rushRidingCue({active,jumpCue:'perfect',touch:true}),'Jump now — tap Jump.');
 assert.doesNotMatch(rushRidingCue({active:{...active,started:false},hasJumps:false}),/Space|Jump/);
});
test('airborne riders keep their line and cannot receive a second jump request',()=>{
 for(const cue of ['perfect','good','late',''])assert.equal(rushRidingCue({active,jumpCue:cue,airborne:true,feedback:true}),'Stay straight over the log.');
});
test('brief earned feedback returns to the next action without adding a second overlay',()=>{
 const gate={...active,next:{kind:'gate'}};
 assert.equal(rushRidingCue({active:gate,feedback:true}),active.lastCue);
 assert.equal(rushRidingCue({active:gate,feedback:false}),'Next gate 3 of 8 — follow the glowing line.');
 assert.match(rushRidingCue({active,feedback:false}),/Low log ahead/);
 assert.equal(rushRidingCue({}), '');
});
