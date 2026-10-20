// Ground-mounted horse steering only. The caller owns movement, collisions and
// the explicit horse/ground/mode gate; this filter never changes travel speed.
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const MAX_STEP=.25,ONSET=6.5,RELEASE=10;

function limit(speed,agility){
 const v=Math.abs(speed),nimble=Math.sqrt(clamp(agility,.45,2.1));
 // Collected steps can turn in a small space. Faster gaits trade tightness for
 // a wider arc, rather than gaining an ever-faster spin at a gallop.
 return Math.min(1.15,.58+.24*v)/(1+v/30)*nimble;
}
function travelDirection(speed){
 if(speed>=0)return 1;
 // A deliberate rein-back reverses the yaw, with no sign snap at zero speed.
 const t=clamp(-speed/.35,0,1),blend=t*t*(3-2*t);
 return 1-2*blend;
}
function snapshot({turn=0,input=0,yawRate=0,yawDelta=0,maxYawRate=0,speed=0,direction=1,active=false,mountKey=null,dt=0,reason='reset'}={}){
 return Object.freeze({turn,input,yawRate,yawDelta,maxYawRate,turnRadius:Math.abs(speed)>.01&&Math.abs(yawRate)>1e-8?Math.abs(speed/yawRate):null,speed,direction,reverse:speed<0,active,mountKey,dt,reason});
}

export function createMountedSteering(){
 let rein=0,mount=null,last=snapshot();
 function reset(){rein=0;mount=null;last=snapshot();return last;}
 function update({dt=0,input=0,speed=0,agility=1,active=true,locked=false,mountKey=null,reset:resetNow=false}={}){
  const valid=Number.isFinite(dt)&&Number.isFinite(input)&&Number.isFinite(speed)&&Number.isFinite(agility);
  if(!active||locked||resetNow||!valid){
   reset();last=snapshot({reason:!valid?'invalid':locked?'locked':resetNow?'reset':'inactive'});return last;
  }
  const key=typeof mountKey==='string'||typeof mountKey==='number'&&Number.isFinite(mountKey)?mountKey:null;
  if(key!==mount){rein=0;mount=key;}
  const seconds=clamp(dt,0,MAX_STEP),wanted=clamp(input,-1,1),rate=wanted===0?RELEASE:ONSET;
  const cap=limit(speed,finite(agility,1)),direction=travelDirection(speed);
  let average=0;
  if(seconds>0){
   const x=rate*seconds,decay=Math.exp(-x);
   // The exact interval average preserves heading at 30/60/120 Hz. Integrating
   // only the end-of-frame rein value makes low frame rates turn more sharply.
   average=wanted+(rein-wanted)*(-Math.expm1(-x)/x);
   rein=wanted+(rein-wanted)*decay;
  }
  const yawRate=average*cap*direction;
  last=snapshot({turn:clamp(rein,-1,1),input:wanted,yawRate,yawDelta:yawRate*seconds,maxYawRate:cap,speed,direction,active:true,mountKey:mount,dt:seconds,reason:'step'});
  return last;
 }
 return Object.freeze({update,reset,state:()=>last});
}
