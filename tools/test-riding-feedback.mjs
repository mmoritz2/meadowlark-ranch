import assert from 'node:assert/strict';
import test from 'node:test';
import {createJumpBuffer,createHoofContacts,contactPattern,ridingSurface} from '../assets/riding-feedback.js';
import {NATIVE_COMPLETE_GAITS} from '../assets/native-complete-gaits.js';
import {NATIVE_BREED_PROFILES} from '../assets/native-breed-profiles.js';
import {dragonProfile} from '../assets/dragon-roster.js';
const profile=NATIVE_COMPLETE_GAITS['white-western'];

test('brief landing tap is remembered, consumed once, and a held button cannot repeat',()=>{
 const q=createJumpBuffer();
 assert.equal(q.update({pressed:true,canStart:false,dt:1/60,mountKey:'horse'}),false);
 assert.equal(q.update({pressed:false,canStart:false,dt:.08,mountKey:'horse'}),false);
 assert.equal(q.update({pressed:false,canStart:true,dt:.05,mountKey:'horse'}),true);q.consume();
 assert.equal(q.update({pressed:false,canStart:true,dt:.01,mountKey:'horse'}),false);
 assert.equal(q.update({pressed:true,canStart:true,dt:.01,mountKey:'horse'}),true);q.consume();
 assert.equal(q.update({pressed:true,canStart:true,dt:.01,mountKey:'horse'}),false);
});
test('old taps expire and camera/menu locks clear buffered jumps',()=>{
 const q=createJumpBuffer();q.update({pressed:true,canStart:false,mountKey:'a'});
 assert.equal(q.update({pressed:false,canStart:true,dt:.181,mountKey:'a'}),false);
 q.update({pressed:true,canStart:false,mountKey:'a'});
 assert.equal(q.update({pressed:true,blocked:true,canStart:true,mountKey:'a'}),false);
 assert.equal(q.update({pressed:true,canStart:true,mountKey:'a'}),false);
 q.reset();assert.equal(q.remaining,0);
});
test('changing horses cannot carry a jump request into the new mount',()=>{
 const q=createJumpBuffer();q.update({pressed:true,canStart:false,mountKey:'a'});
 assert.equal(q.update({pressed:true,canStart:true,mountKey:'b'}),false);
 q.update({pressed:false,mountKey:'b'});assert.equal(q.update({pressed:true,mountKey:'b'}),true);
});
test('native trot groups its diagonal hoof pairs into two contact beats',()=>{
 const p=contactPattern(profile,'trot');assert.equal(p.length,2);
 assert.deepEqual(p[0].feet.sort(),['FL','HR']);assert.deepEqual(p[1].feet.sort(),['FR','HL']);
 assert.equal(contactPattern(profile,'walk').length,4);
 assert.equal(contactPattern(profile,'canter','left').length,3);
 assert.equal(contactPattern(profile,'gallop','right').length,4);
});
test('actual native gait contact counts are independent of rendering frame rate',()=>{
 for(const [gait,lead,beats]of [['walk','left',4],['trot','left',2],['canter','right',3],['gallop','left',4]]){
  const counts=[];
  for(const fps of [30,60,120]){
   const c=createHoofContacts();let count=0;const duration=1,cycles=6;
   c.update({phase:0,gait,lead,profile,dt:1/fps,speed:18});
   for(let frame=1;frame<=fps*duration*cycles;frame++)count+=c.update({phase:frame/fps/duration%1,gait,lead,profile,dt:1/fps,speed:18}).contacts.length;
   counts.push(count);assert.equal(count,beats*cycles,gait+' at '+fps+' fps');
  }
  assert.equal(new Set(counts).size,1);
 }
});
test('reverse contact crossings stay ordered, and changing gait does not make a burst',()=>{
 const c=createHoofContacts(),base={gait:'walk',profile,reverse:true,speed:1,dt:.1};
 c.update({...base,phase:.8});assert.deepEqual(c.update({...base,phase:.6}).contacts.map(c=>c.feet),[['HL']]);
 const reverse=contactPattern(profile,'walk','left',true);assert.ok(Math.abs(reverse.find(p=>p.feet.includes('HL')).phase-.65)<1e-12);
 assert.equal(c.update({...base,gait:'trot',phase:.3}).contacts.length,0);
 assert.equal(c.update({...base,gait:'trot',phase:.6}).contacts.length,0,'large reverse seek is ignored');
});
test('airborne, idle, paused, on-foot and long-frame states do not accumulate impacts',()=>{
 const c=createHoofContacts(),base={gait:'gallop',profile,speed:28,dt:1/60};
 c.update({...base,phase:0});assert.equal(c.update({...base,phase:.3,grounded:false}).contacts.length,0);
 assert.equal(c.update({...base,phase:.5,grounded:true}).landed,true);
 assert.equal(c.update({...base,phase:.6}).landed,false);
 for(const patch of [{active:false},{speed:0},{dt:0},{dt:1}])assert.equal(c.update({...base,phase:.99,...patch}).contacts.length,0);
 assert.equal(c.update({...base,phase:0}).contacts.length,0,'resuming does not replay accumulated contacts');
});
test('water suppresses dry soil feedback and bridge decks stay dry over rivers',()=>{
 assert.equal(ridingSurface({waterDepth:.3,pathDistance:1}),'water');
 assert.equal(ridingSurface({waterDepth:.3,pathDistance:1,bridge:true}),'wood');
 assert.equal(ridingSurface({pathDistance:2}),'soil');assert.equal(ridingSurface({arena:true}),'soil');assert.equal(ridingSurface(),'grass');
});


test('Black Dragon and its variants use the authored two-beat run and four-beat walk',()=>{
 for(const black of [NATIVE_BREED_PROFILES['black-dragon-native'],dragonProfile(NATIVE_BREED_PROFILES,'stormdrake')]){
  assert.deepEqual(contactPattern(black,'run'),[{phase:0,feet:['FL','HR']},{phase:.5,feet:['FR','HL']}]);
  assert.deepEqual(contactPattern(black,'walk'),[{phase:0,feet:['FL']},{phase:.25,feet:['HL']},{phase:.5,feet:['FR']},{phase:.75,feet:['HR']}]);
  const reverse=contactPattern(black,'walk','left',true);
  assert(Math.abs(reverse.find(p=>p.feet.includes('FL')).phase-.73)<1e-12,'reversing touches down at the authored .73 stance boundary');
  for(const fps of [30,60,120]){
   const c=createHoofContacts(),base={gait:'run',profile:black,speed:10,dt:1/fps};
   c.update({...base,phase:0});let beats=0;
   for(let frame=1;frame<=fps*6;frame++)beats+=c.update({...base,phase:frame/fps%1}).contacts.length;
   assert.equal(beats,12,'six Black Dragon run cycles have twelve paired footfalls');
  }
 }
 const black=NATIVE_BREED_PROFILES['black-dragon-native'];
 assert.equal(contactPattern({...black,nativeKind:'european-dragon'},'run').length,4,'another source kind must not inherit Black Dragon timing');
 assert.equal(contactPattern({...black,nativeGaits:{run:{clip:'DifferentRun'}}},'run').length,4,'different clips must not inherit measured timing');
 const custom={...black,nativeGaits:{run:{clip:'DragonRun',footOffsets:{FL:.25,FR:.75}}}};
 assert.deepEqual(contactPattern(custom,'run'),[{phase:.25,feet:['FL']},{phase:.75,feet:['FR']}],'explicit profile metadata has priority');
});

test('zero, invalid and suspended-frame deltas suppress landing and do not replay it',()=>{
 for(const dt of [0,-.01,NaN,Infinity,1]){
  const c=createHoofContacts(),base={gait:'jump',speed:5,phase:.7,dt:1/60};
  c.update({...base,grounded:false});
  assert.deepEqual(c.update({...base,grounded:true,dt}),{contacts:[],landed:false},String(dt)+' cannot emit a landing');
  assert.deepEqual(c.update({...base,grounded:true}),{contacts:[],landed:false},'resume cannot replay a suppressed landing');
  c.update({...base,grounded:false});
  assert.equal(c.update({...base,grounded:true}).landed,true,'a subsequent real landing still emits once');
  assert.equal(c.update({...base,grounded:true}).landed,false);
 }
});
