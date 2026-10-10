import test from 'node:test';
import assert from 'node:assert/strict';
import {roundupPace, roundupNextAttempt} from '../assets/roundup-presentation.mjs';
import {createRoundupFinish} from '../assets/roundup-rewards.mjs';

const live = (elapsed, extra = {}) => ({mode:'beginner', active:true, timeLimit:150,
 goldTimeLimit:97.5, timeLeft:150-elapsed, elapsed, countdown:0, penned:0, total:3, ...extra});
const finish = (time, mode = 'beginner', extra = {}) => {
 const duration = 150;
 const proof = createRoundupFinish({runId:`test-${mode}-${time}`, mode,
  penned:mode === 'full' ? 5 : 3, time, remaining:duration-time, at:1000});
 assert.ok(proof, 'Use a valid production completion proof');
 return {...proof, saved:true, ...extra};
};

test('beginner countdown states the explicit inclusive gold target before the clock starts', () => {
 const cue = roundupPace(live(0, {countdown:2.1}));
 assert.equal(cue.label, 'Starting in 3s');
 assert.equal(cue.tone, 'ready');
 assert.match(cue.detail, /all 3 horses home in 97\.5s or less/);
 assert.match(cue.detail, /clock starts after the countdown/);
});

test('full herd countdown keeps the half-second target accurate', () => {
 const cue = roundupPace(live(0, {mode:'full', timeLimit:150, goldTimeLimit:97.5,
  timeLeft:150, total:5, countdown:3}));
 assert.match(cue.detail, /all 5 horses home in 97\.5s or less/);
});

test('active gold window counts down rather than claiming a medal', () => {
 const cue = roundupPace(live(60, {penned:2}));
 assert.equal(cue.label, 'Gold window · 37.5s left');
 assert.equal(cue.tone, 'gold');
 assert.doesNotMatch(cue.detail, /earned|won|saved|reward/i);
});

test('97.5 seconds exactly remains inside the actual production gold boundary', () => {
 const receipt = finish(97.5);
 assert.equal(receipt.medal, 'gold');
 assert.equal(roundupPace(live(97.5)).tone, 'gold');
 assert.equal(roundupPace(live(97.5)).label, 'Gold window · 0s left');
 assert.equal(roundupNextAttempt(receipt).title, 'Try the full herd');
});

test('97.51 seconds is silver in production and in the live pace cue', () => {
 const receipt = finish(97.51);
 assert.equal(receipt.medal, 'silver');
 const cue = roundupPace(live(97.51));
 assert.equal(cue.tone, 'silver');
 assert.equal(cue.label, 'Keep going for silver');
 assert.match(cue.detail, /all 3 horses home by 150s/);
 assert.equal(roundupNextAttempt(receipt).title, 'Go for gold');
});

test('97.5 seconds is gold for the full herd but 97.51 is silver', () => {
 assert.equal(finish(97.5, 'full').medal, 'gold');
 assert.equal(finish(97.51, 'full').medal, 'silver');
 assert.equal(roundupPace(live(97.5, {mode:'full', timeLimit:150, goldTimeLimit:97.5,
  timeLeft:52.5, total:5})).tone, 'gold');
 assert.equal(roundupPace(live(97.51, {mode:'full', timeLimit:150, goldTimeLimit:97.5,
  timeLeft:52.49, total:5})).tone, 'silver');
});

test('tiny positive gold windows remain visibly positive', () => {
 assert.equal(roundupPace(live(97.49)).label, 'Gold window · 0.1s left');
});

test('pending save overrides countdown and apparent gold completion', () => {
 const cue = roundupPace(live(55, {countdown:3, penned:3, pending:finish(55, 'beginner', {saved:false})}));
 assert.equal(cue.tone, 'pending');
 assert.equal(cue.label, 'Waiting to save');
 assert.match(cue.detail, /retry saving/);
 assert.doesNotMatch(cue.detail, /gold|won|earned|new best|fastest/i);
});

test('a direct unsaved status is also pending', () => {
 assert.equal(roundupPace(live(40, {saved:false})).tone, 'pending');
});

test('unverified receipt cannot claim success or recommend another attempt', () => {
 const cue = roundupNextAttempt(finish(50, 'full', {saved:false, newBestTime:true, newBestScore:true}));
 assert.equal(cue.title, 'Save your round first');
 assert.match(cue.detail, /retry saving before starting another ride/);
 assert.doesNotMatch(cue.detail, /gold|earned|fastest|best|full herd/i);
 assert.deepEqual(roundupNextAttempt({medal:'gold'}), cue);
});

test('silver target states exactly the integer improvement and gold time', () => {
 const cue = roundupNextAttempt(finish(109.5));
 assert.equal(cue.title, 'Go for gold');
 assert.match(cue.detail, /Aim for 12s faster/);
 assert.match(cue.detail, /all 3 home in 97\.5s or less/);
});

test('a hundredth-second miss receives a useful tenth-second improvement', () => {
 const cue = roundupNextAttempt(finish(97.51));
 assert.match(cue.detail, /Aim for 0\.1s faster/);
 assert.doesNotMatch(cue.detail, /Aim for 0s faster/);
});

test('full herd silver uses its own deadline and improvement', () => {
 const cue = roundupNextAttempt(finish(102, 'full'));
 assert.match(cue.detail, /4\.5s faster/);
 assert.match(cue.detail, /all 5 home in 97\.5s or less/);
});

test('partial bronze rounds target the whole herd without claiming silver or gold', () => {
 const proof = createRoundupFinish({runId:'partial', mode:'beginner', penned:2, time:150, remaining:0, at:1000});
 assert.equal(proof.medal, 'bronze');
 const cue = roundupNextAttempt({...proof, saved:true, newBestScore:true});
 assert.equal(cue.title, 'Bring everyone home');
 assert.match(cue.detail, /all 3 horses in the pen by 150s/);
 assert.doesNotMatch(cue.detail, /gold|silver|new best/i);
});

test('zero-home rounds offer the full target without inventing a reward', () => {
 const proof = createRoundupFinish({runId:'practice', mode:'full', penned:0, time:150, remaining:0, at:1000});
 assert.equal(proof.medal, 'none');
 assert.deepEqual(roundupNextAttempt({...proof, saved:true}), {
  title:'Bring everyone home', detail:'Next target: all 5 horses in the pen by 150s.'});
});

test('beginner gold invites the larger herd and acknowledges only an actual new best', () => {
 const cue = roundupNextAttempt(finish(55, 'beginner', {newBestTime:true, previousBestTime:60}));
 assert.equal(cue.title, 'Try the full herd');
 assert.match(cue.detail, /^New fastest time\./);
 assert.match(cue.detail, /all 5 horses home in 97\.5s or less for gold/);
 assert.doesNotMatch(roundupNextAttempt(finish(55)).detail, /New fastest|New best/);
});

test('full gold chases the newly saved faster time rather than the older slower record', () => {
 const cue = roundupNextAttempt(finish(70, 'full', {previousBestTime:80, newBestTime:true}));
 assert.equal(cue.title, 'Chase your best time');
 assert.equal(cue.detail, 'New fastest time. Bring all 5 home faster than 70s.');
});

test('full gold retains a faster previous record when this ride did not beat it', () => {
 const cue = roundupNextAttempt(finish(80, 'full', {previousBestTime:70, newBestTime:false}));
 assert.equal(cue.detail, 'Bring all 5 home faster than 70s.');
});

test('score and time record flags remain distinct', () => {
 const cue = roundupNextAttempt(finish(70, 'full', {previousBestTime:60, newBestScore:true}));
 assert.equal(cue.detail, 'New best score. Bring all 5 home faster than 60s.');
 assert.doesNotMatch(cue.detail, /New fastest/);
});

test('pace handles the expired partial round without a saved success claim', () => {
 assert.deepEqual(roundupPace(live(150, {penned:2})), {
  label:'Time is up', detail:'2 of 3 home. Your next target is the whole herd.', tone:'neutral'});
});

test('default targets and time-left fallback use the production mode definitions', () => {
 assert.match(roundupPace({mode:'beginner', active:false}).detail, /3 horses home in 97\.5s/);
 assert.match(roundupPace({mode:'full', active:false}).detail, /5 horses home in 97\.5s/);
 assert.equal(roundupPace({mode:'beginner', timeLeft:60}).label, 'Gold window · 7.5s left');
 assert.equal(roundupPace({mode:'full', timeLeft:60}).label, 'Gold window · 7.5s left');
});

test('presentation is pure and does not change live state or durable receipts', () => {
 const state = Object.freeze({...live(60), records:Object.freeze({beginner:Object.freeze({time:50})})});
 const receipt = Object.freeze(finish(60, 'full', {previousBestTime:70, newBestTime:true}));
 const before = JSON.stringify({state, receipt});
 roundupPace(state); roundupNextAttempt(receipt);
 assert.equal(JSON.stringify({state, receipt}), before);
});


test('paused world reports a stopped timer rather than a running gold countdown', () => {
 const cue = roundupPace(live(60, {paused:true}));
 assert.equal(cue.label, 'Roundup paused');
 assert.equal(cue.tone, 'neutral');
 assert.match(cue.detail, /timer waits/);
 assert.doesNotMatch(cue.detail, /left|gold window/i);
 assert.equal(roundupPace(live(60, {paused:true, pending:{saved:false}})).tone, 'pending');
});


test('explicit historical 120-second timing remains presentable without using new defaults',()=>{
 const old=live(78,{timeLimit:120,goldTimeLimit:78,timeLeft:42});
 assert.equal(roundupPace(old).label,'Gold window · 0s left');assert.match(roundupPace(old).detail,/in 78s or less/);
 const silver=roundupPace({...old,elapsed:78.01,timeLeft:41.99});assert.equal(silver.tone,'silver');assert.match(silver.detail,/by 120s/);
 assert.equal(roundupPace({...old,elapsed:120,timeLeft:0}).label,'Time is up');
});
