/* Shared keyboard/touch intent. Selection changes pace, never starts movement. */
export const RIDING_GAITS=Object.freeze(['walk','trot','canter','gallop']);
export function createRidingInput(initial='canter'){
 let selected=RIDING_GAITS.includes(initial)?initial:'canter',stopHeld=false,backWait=0,cameraGrace=0;
 let last={selected,requested:selected,braking:false,reversing:false,forward:false,back:false};
 const select=g=>{if(!RIDING_GAITS.includes(g))return false;selected=g;last.selected=g;return true;};
 return {
  select,
  shift(n){select(RIDING_GAITS[Math.max(0,Math.min(3,RIDING_GAITS.indexOf(selected)+Math.sign(n)))]);return selected;},
  brake(on){stopHeld=!!on;},
  state(){return {...last,selected};},
  reset(){stopHeld=false;backWait=0;},
  cameraReady(dt,dragging){cameraGrace=dragging?1.4:Math.max(0,cameraGrace-Math.max(0,dt||0));return !dragging&&cameraGrace===0;},
  resolve({keys={},touch={},speed=0,dt=0,onFoot=false,flying=false}={}){
   const back=!!(keys.KeyS||keys.ArrowDown||touch.back),forward=!!(keys.KeyW||keys.ArrowUp||touch.go)&&!back;
   const shift=!!(keys.ShiftLeft||keys.ShiftRight||touch.gal);
   const requested=keys.ControlLeft||keys.ControlRight?'walk':keys.AltLeft||keys.AltRight?'trot':shift?'gallop':selected;
   const stop=stopHeld||!!touch.brake;
   // First stop, then ask for a short deliberate rein-back. Pulling back never flips velocity instantly.
   if(!back||stop||speed>.15||onFoot||flying)backWait=0;
   else backWait+=Math.max(0,dt||0);
   const reversing=back&&!stop&&(onFoot||flying||backWait>=.18);
   const braking=stop||(back&&!reversing);
   last={selected,requested,braking,reversing,forward:forward&&!braking,back,gallop:onFoot||flying?shift:requested==='gallop'};
   return {...last};
  }
 };
}
