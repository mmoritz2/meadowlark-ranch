/* Native jumps advance at one second per simulation second. Keep only adjacent
   samples: this estimates the age at the rail plane, never a future jump or a
   crossing skipped by the course engine. Legacy accelerated clocks stay out. */
export function createNativeJumpCrossingSampler(){
 let previous=null,age=null;
 function reset(){previous=null;age=null;}
 function sample(c,player,rig,dt,t){
  const before=previous;reset();
  const state=c?.ce,fence=c?.jumps?.[c.idx],motion=rig?.heroMotion;
  const native=rig?.profile?.nativeBreed||rig?.profile?.referenceMotion;
  if(!state||!fence||fence.kind!=='fence'||!native||!motion||c.done||c.started===false||
     player?.flying||player?.onFoot||rig.ready===false||rig.loadingBreed)return null;
  const x=player?.pos?.x,z=player?.pos?.z,speed=player?.speed,jumpAge=rig.heroJumpAge;
  if(![x,z,speed,jumpAge,fence.x,fence.z,fence.rotY,t,dt].every(Number.isFinite)||
     jumpAge<0||dt<=0||dt>.25+1e-9)return null;
  const across=(x-fence.x)*Math.sin(fence.rotY)+(z-fence.z)*Math.cos(fence.rotY);
  previous={c,state,fence,idx:c.idx,lap:state.lap,refusals:state.refusals,
   rig,motion,profile:rig.profile,x,z,speed,jumpAge,t,across,
   fenceX:fence.x,fenceZ:fence.z,fenceYaw:fence.rotY};
  if(!before||before.c!==c||before.state!==state||before.fence!==fence||
     before.idx!==c.idx||before.lap!==state.lap||before.refusals!==state.refusals||
     before.rig!==rig||before.motion!==motion||before.profile!==rig.profile||
     before.fenceX!==fence.x||before.fenceZ!==fence.z||before.fenceYaw!==fence.rotY||
     fence.prevSide===0)return null;
  // Native age resets on takeoff and becomes null on landing/action interruption.
  // A missed tick, a clock reset, or an accelerated/held clock cannot be joined.
  if(Math.abs((t-before.t)-dt)>1e-5||Math.abs((jumpAge-before.jumpAge)-dt)>1e-5)return null;
  // Real movement is collision-substepped using this frame's speed. Allow a small
  // collision correction, but never infer timing across a marshal/teleport move.
  if(Math.hypot(x-before.x,z-before.z)>Math.max(Math.abs(speed),Math.abs(before.speed))*dt+.15)return null;
  if(before.across>0||across<=0||across<=before.across)return null;
  const fraction=-before.across/(across-before.across);
  // Remove sub-picosecond arithmetic dust at inclusive grade boundaries. This
  // is numerical normalization, not an extra input or scoring tolerance.
  age=Math.round((before.jumpAge+(jumpAge-before.jumpAge)*fraction)*1e12)/1e12;
  return age;
 }
 return {sample,reset,get age(){return age;}};
}
