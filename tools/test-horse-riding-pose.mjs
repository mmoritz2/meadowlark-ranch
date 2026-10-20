import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleMountedSeat,mountedHorseBank} from '../assets/horse-riding-pose.mjs';
test('rider follows the actual gait instead of a horse-specific maximum speed fraction',()=>{
 const trot=sampleMountedSeat({gait:'trot',phase:.25,speed:4.2});
 const canter=sampleMountedSeat({gait:'canterLeft',phase:.25,speed:7.5});
 const gallop=sampleMountedSeat({gait:'gallopRight',phase:.25,speed:15});
 assert(trot.postRise>.1);assert.equal(canter.postRise,0);assert.equal(gallop.postRise,0);
 assert(gallop.lean>canter.lean&&canter.lean>trot.lean);
 assert.deepEqual(sampleMountedSeat({gait:'canterLeft',phase:.25,speed:7.5}),sampleMountedSeat({gait:'canterRight',phase:.25,speed:7.5}));
});
test('Western and bareback seats remain seated while the English rider posts only at trot',()=>{
 for(const opts of [{western:true},{bareback:true}])for(const gait of ['walk','trot','canter','gallop'])assert.equal(sampleMountedSeat({gait,phase:.25,speed:5,...opts}).postRise,0);
 for(const gait of ['stand','walk','canter','gallop','jump'])assert.equal(sampleMountedSeat({gait,phase:.25,speed:5}).postRise,0);
});
test('body bank is physical, signed and bounded with no stationary lean or immediate full-lock tilt',()=>{
 assert.equal(mountedHorseBank({speed:0,yawRate:1}),0);
 assert.equal(mountedHorseBank({speed:15,yawRate:0}),0);
 const a=mountedHorseBank({speed:4,yawRate:.5}),b=mountedHorseBank({speed:8,yawRate:.5});assert(b>a&&a>0);
 assert.equal(mountedHorseBank({speed:8,yawRate:-.5}),-b);
 for(const speed of [0,2,7.5,15,30])for(const yawRate of [-3,0,3])assert(Math.abs(mountedHorseBank({speed,yawRate}))<=.085);
 assert.equal(mountedHorseBank({speed:NaN,yawRate:1}),0);
});
test('a complete stride remains continuous and finite with modest movement, preserving the saddle origin',()=>{
 for(const gait of ['walk','trot','canter','gallop']){
  let prev=null;
  for(let i=0;i<=240;i++){
   const out=sampleMountedSeat({gait,phase:i/240,speed:8,turn:.7,yawRate:.4});
   for(const key of ['lean','side','postRise','postLean'])assert(Number.isFinite(out[key]));
   assert(!('x' in out)&&!('y' in out)&&!('z' in out),'No detached rider translation');
   if(prev)assert(Math.abs(out.lean-prev.lean)<.003);prev=out;
  }
 }
});
