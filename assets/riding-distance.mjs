// Distances come from one collision-resolved movement frame, never speed × time.
// The animation snapshot is read after driveRig has resolved gait and jump height.
export function ridingTravelCredit(from,to,{dt,mountId,onFoot=false,flying=false,vehicle=false,locked=false,grounded=false,native=false,gait=null}={}){
 const zero=()=>Object.freeze({mountId:mountId??null,travel:0,ground:0,gallop:0,bond:0});
 if(!from||!to||mountId==null||mountId===''||from.mountId!==mountId||from.onFoot||onFoot||from.vehicle||vehicle||from.locked||locked)return zero();
 if(![from.x,from.z,to.x,to.z,from.speed,dt].every(Number.isFinite)||dt<=0||Math.abs(from.speed)<.02)return zero();
 const distance=Math.hypot(to.x-from.x,to.z-from.z),expected=Math.abs(from.speed)*dt;
 // Reject relocation/contact ejection rather than turning it into a capped reward.
 if(distance<=1e-5||distance>expected+.003+expected*.025)return zero();
 const ground=from.grounded&&grounded&&!from.flying&&!flying?distance:0;
 const galloping=from.speed>0&&(native?gait==='gallop':from.speed>7);
 return Object.freeze({mountId,travel:distance,ground,gallop:ground&&galloping?distance:0,bond:!from.flying&&!flying?distance:0});
}
