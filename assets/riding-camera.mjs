// Composition only. The existing camera owner retains input and collision work.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),finite=Number.isFinite;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const blend=(a,b,k)=>a+(b-a)*k;
const ease=(rate,dt)=>1-Math.exp(-rate*dt);
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
export function createRidingCamera(){
 const anchor={x:0,y:0,z:0},look={x:0,y:0,z:0},desired={x:0,y:0,z:0};
 const frame={active:false,snap:false,anchor,look,desired,distance:6.3,pitch:.47,angle:0,lead:0,lookHeight:1.4,fov:52,blend:1,framingLimited:false};
 let placed=false,key=null,lastX=0,lastZ=0,lastHeading=0,head=0,mix=0,scale=1,arm=6.3,pitch=.47,lead=0,turn=0,fov=52,aspect=1.6,foot=0,subjectHeight=2.65,halfLength=1.45,halfWidth=.48,heading=0,lookX=0,lookZ=0;
 function reset(){placed=false;key=null;frame.active=false;frame.snap=false;}
 // Reuse this result and its vectors. No per-frame result/geometry allocation.
 function update(input){
  const i=input||{};
  if(i.active!==true||!finite(i.x)||!finite(i.z)||!finite(i.groundY)||!finite(i.heading)||!finite(i.speed)||!finite(i.dt)||i.dt<0){reset();return frame;}
  const dt=clamp(i.dt,0,.1),nextScale=clamp(finite(i.mountScale)?i.mountScale:1,.55,1.7);
  const moved=Math.hypot(i.x-lastX,i.z-lastZ),relocated=placed&&moved>Math.max(8,Math.abs(i.speed)*Math.min(i.dt,.25)*2+2);
  const snap=!placed||i.mountId!==key||relocated||i.dt>.75;
  const observed=placed&&!snap&&i.dt>0?Math.min(25,moved/i.dt):Math.abs(i.speed);
  const targetMix=smooth(.5,13,observed),rawTurn=placed&&!snap&&i.dt>0?clamp(wrap(i.heading-lastHeading)/i.dt,-2.5,2.5):0;
  aspect=clamp(finite(i.aspect)?i.aspect:1.6,.35,3);
  const narrow=1-smooth(.45,1.1,aspect),zoom=clamp(finite(i.zoom)?i.zoom:1,.62,1.75);
  const yaw=finite(i.orbitYaw)?i.orbitYaw:0,userPitch=finite(i.orbitPitch)?i.orbitPitch:0,manual=i.manualOrbit===true;
  if(snap){head=i.heading;mix=targetMix;scale=nextScale;turn=0;}else if(dt){
   mix=blend(mix,targetMix,ease(targetMix>mix?2.5:1.8,dt));scale=blend(scale,nextScale,ease(4,dt));
   head+=wrap(i.heading-head)*ease(5+Math.abs(rawTurn)*2,dt);head=i.heading-clamp(wrap(i.heading-head),-.42,.42);
   turn=blend(turn,rawTurn,ease(5,dt));
  }
  const tight=smooth(.25,1.8,Math.abs(turn)),sideSpace=clamp(aspect/1.2,.45,1),manualWeight=manual?0:1-smooth(.25,1.2,Math.abs(wrap(yaw)));
  const targetArm=(6.3+.65*mix+.65*narrow)*scale*zoom;
  const targetPitch=clamp(.47-.025*mix+.035*narrow+userPitch,.08,1.12);
  const targetLead=(.55+2.15*mix)*(1-.55*tight)*manualWeight*scale;
  const targetFov=52+4*mix;
  if(snap){arm=targetArm;pitch=targetPitch;lead=targetLead;fov=finite(i.currentFov)?clamp(i.currentFov,40,90):targetFov;}else if(dt){
   arm=blend(arm,targetArm,ease(4,dt));pitch=blend(pitch,targetPitch,ease(5,dt));lead=blend(lead,targetLead,ease(5,dt));fov=blend(fov,targetFov,ease(3,dt));
  }
  const lag=wrap(i.heading-head),angle=head+yaw+(.12-.025*mix)*sideSpace*manualWeight+lag*.72;
  heading=i.heading;foot=i.groundY+(finite(i.height)?Math.max(0,i.height):0);
  subjectHeight=clamp(finite(i.subjectHeight)?i.subjectHeight:2.65*scale,1.3,4.7);
  halfLength=1.45*scale;halfWidth=.48*scale;
  anchor.x=i.x;anchor.y=foot+subjectHeight*.54;anchor.z=i.z;
  frame.active=true;frame.snap=snap;frame.distance=arm;frame.pitch=pitch;frame.angle=angle;frame.lead=lead;frame.lookHeight=subjectHeight*.52;frame.fov=fov;frame.blend=snap?1:ease(5,dt);frame.framingLimited=false;
  const run=arm*Math.cos(pitch);desired.x=i.x-Math.sin(angle)*run;desired.y=foot+arm*Math.sin(pitch);desired.z=i.z-Math.cos(angle)*run;
  const aimHeading=i.heading+clamp(turn*.18,-.28,.28)*(1-.6*tight);
  lookX=Math.sin(aimHeading)*lead;lookZ=Math.cos(aimHeading)*lead;
  look.x=anchor.x+lookX;look.y=foot+frame.lookHeight;look.z=anchor.z+lookZ;
  key=i.mountId;lastX=i.x;lastZ=i.z;lastHeading=i.heading;placed=true;return frame;
 }
 // Test a conservative horse+rider hull against the actual final camera view.
 // This is framing only: it never relocates the collision-resolved camera.
 function fits(camera,x,y,z){
  const dx=x-camera.x,dy=y-camera.y,dz=z-camera.z,len=Math.hypot(dx,dy,dz),flat=Math.hypot(dx,dz);if(len<.001||flat<.001)return false;
  const fx=dx/len,fy=dy/len,fz=dz/len,rx=-dz/flat,rz=dx/flat,ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy;
  const tv=Math.tan(frame.fov*Math.PI/360),th=tv*aspect,sn=Math.sin(heading),cs=Math.cos(heading);
  for(let n=0;n<10;n++){
   let px=anchor.x,py=foot,pz=anchor.z;
   if(n<8){const across=(n&1)?halfWidth:-halfWidth,along=(n&2)?halfLength:-halfLength;px+=across*cs+along*sn;pz+=-across*sn+along*cs;py+=n&4?subjectHeight*.68:0;}
   else py+=n===8?subjectHeight:subjectHeight*.45;
   const vx=px-camera.x,vy=py-camera.y,vz=pz-camera.z,depth=vx*fx+vy*fy+vz*fz;
   if(depth<=.08||Math.abs(vx*rx+vz*rz)>depth*th*.88||Math.abs(vx*ux+vy*uy+vz*uz)>depth*tv*.91)return false;
  }
  return true;
 }
 function aim(camera,riseCorrection=0){
  if(!frame.active||!finite(camera?.x)||!finite(camera?.y)||!finite(camera?.z))return look;
  const got=clamp(Math.hypot(camera.x-anchor.x,camera.z-anchor.z)/Math.max(.1,frame.distance*Math.cos(frame.pitch)),0,1);
  const y=foot+frame.lookHeight-clamp(finite(riseCorrection)?riseCorrection:0,0,.5)*.6*got;
  let amount=got;
  // Reduce lead immediately when clearance retracts the lens. A delayed previous
  // frame ratio could aim past the horse after a gate or abrupt corner.
  if(!fits(camera,anchor.x+lookX*amount,y,anchor.z+lookZ*amount)){
   amount=0;
   if(fits(camera,anchor.x,y,anchor.z)){
    let lo=0,hi=got;for(let n=0;n<8;n++){const mid=(lo+hi)*.5;if(fits(camera,anchor.x+lookX*mid,y,anchor.z+lookZ*mid))lo=mid;else hi=mid;}amount=lo;
   }else frame.framingLimited=true; // Tight geometry/user zoom can make a full hull impossible.
  }
  look.x=anchor.x+lookX*amount;look.y=y;look.z=anchor.z+lookZ*amount;return look;
 }
 return {update,aim,reset};
}
