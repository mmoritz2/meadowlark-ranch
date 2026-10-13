// Static architecture is registered before render batching. Sweep the camera's
// clearance volume against those solid surfaces, independently of horse collisions.
export function createFollowCamera({THREE,groundHeight,clearance=.3}) {
 const bounds=[],direction=new THREE.Vector3(),candidate=new THREE.Vector3();
 const orbit=new THREE.Vector3(),base=new THREE.Vector3(),previousOrigin=new THREE.Vector3(),futureOrigin=new THREE.Vector3(),probe=new THREE.Vector3();let hasOrigin=false;let avoidanceAngle=0,avoidanceTarget=0,clearTime=0,reach=1;
 function register(root){
  root.updateWorldMatrix(true,true);
  root.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.geometry||mesh.material?.transparent&&mesh.material.opacity<.7)return;
   mesh.geometry.computeBoundingBox();
   const b=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
   const size=b.getSize(new THREE.Vector3());
   // Tiny fittings cannot hide the rider. Keep walls, beams, roofs and canopies.
   if(Math.max(size.x,size.y,size.z)<1.4)return;
   bounds.push(b.expandByScalar(clearance));
  });
 }
 function limit(origin,end){
  direction.subVectors(end,origin);let result=1;
  const minX=Math.min(origin.x,end.x),maxX=Math.max(origin.x,end.x),minZ=Math.min(origin.z,end.z),maxZ=Math.max(origin.z,end.z);
  for(const b of bounds){
   if(b.max.x<minX||b.min.x>maxX||b.max.z<minZ||b.min.z>maxZ)continue;
   // When the subject stands under a canopy, an enclosing surface must not
   // collapse the camera into the rider. Only crossing an outside face clips.
   if(b.containsPoint(origin))continue;
   let near=0,far=result;
   for(const axis of ['x','y','z']){
    const delta=direction[axis];
    if(Math.abs(delta)<1e-8){if(origin[axis]<b.min[axis]||origin[axis]>b.max[axis]){far=-1;break;}}
    else{let a=(b.min[axis]-origin[axis])/delta,c=(b.max[axis]-origin[axis])/delta;if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);if(near>far)break;}
   }
   if(near<=far&&far>=0)result=Math.min(result,Math.max(0,near-.015));
  }
  return result;
 }
 function resolve(origin,desired,out){
  candidate.copy(desired);
  candidate.y=Math.max(candidate.y,groundHeight(candidate.x,candidate.z)+clearance+.4);
  const fraction=limit(origin,candidate);
  out.copy(origin).lerp(candidate,fraction);
  return fraction;
 }
 function frame(origin,desired,out,dt){
  base.subVectors(desired,origin);
  const direct=limit(origin,desired);
  clearTime=direct>.96?clearTime+dt:0;
  const visibility=a=>{
   orbit.set(base.x*Math.cos(a)+base.z*Math.sin(a),base.y,-base.x*Math.sin(a)+base.z*Math.cos(a)).add(origin);
   return limit(origin,orbit);
  };
  // Keep the chosen side while passing a wall. The old per-frame winner could
  // switch from +120 to -120 degrees and whip through the rider at a corner.
  if(direct<.78||avoidanceTarget!==0&&clearTime<.25){
   const current=visibility(avoidanceTarget);
   if(avoidanceTarget===0||current<.86){
    let best=avoidanceTarget,score=current*6-Math.abs(avoidanceTarget)*.45;
    for(const a of [.35,-.35,.7,-.7,1.05,-1.05,1.4,-1.4,1.75,-1.75,2.1,-2.1,2.5,-2.5,Math.PI]){
     const s=visibility(a)*6-Math.abs(a)*.45-(a*avoidanceTarget<0?.85:0);
     if(s>score+.18){score=s;best=a;}
    }
    avoidanceTarget=best;
   }
  }else if(clearTime>=.25)avoidanceTarget=0;
  const delta=(avoidanceTarget-avoidanceAngle)*(1-Math.exp(-6*dt));
  const nextAngle=avoidanceAngle+Math.max(-2.2*dt,Math.min(2.2*dt,delta));
  // Anticipate the rider's movement and the orbit's swept arc. Retract before
  // turning around a corner, and hold that turn until the shorter radius fits.
  const horizon=.6;
  futureOrigin.copy(origin);
  if(hasOrigin&&dt>0){probe.subVectors(origin,previousOrigin);if(probe.length()<8)futureOrigin.addScaledVector(probe,Math.min(horizon/dt,60));}
  previousOrigin.copy(origin);hasOrigin=true;
  const futureAngle=avoidanceAngle+Math.max(-2.2*horizon,Math.min(2.2*horizon,avoidanceTarget-avoidanceAngle));
  let safe=visibility(nextAngle);
  for(const part of [.125,.25,.375,.5,.625,.75,.875,1]){
   probe.copy(origin).lerp(futureOrigin,part);
   const a=avoidanceAngle+(futureAngle-avoidanceAngle)*part;
   orbit.set(base.x*Math.cos(a)+base.z*Math.sin(a),base.y,-base.x*Math.sin(a)+base.z*Math.cos(a)).add(probe);
   safe=Math.min(safe,limit(probe,orbit));
   // Translation still continues when a turn is held for clearance.
   orbit.set(base.x*Math.cos(avoidanceAngle)+base.z*Math.sin(avoidanceAngle),base.y,-base.x*Math.sin(avoidanceAngle)+base.z*Math.cos(avoidanceAngle)).add(probe);
   safe=Math.min(safe,limit(probe,orbit));
  }
  const radialStep=8*dt/Math.max(1,base.length());
  reach+=Math.max(-radialStep,Math.min(radialStep,(safe-reach)*(1-Math.exp(-10*dt))));
  if(visibility(nextAngle)>=reach-.005)avoidanceAngle=nextAngle;
  orbit.set(base.x*Math.cos(avoidanceAngle)+base.z*Math.sin(avoidanceAngle),base.y,
   -base.x*Math.sin(avoidanceAngle)+base.z*Math.cos(avoidanceAngle)).add(origin);
  const fraction=resolve(origin,orbit,out);
  reach=Math.min(reach,fraction);
  out.copy(origin).lerp(candidate,reach);
  return fraction;
 }
 return {register,resolve,frame,isClear:(origin,end)=>limit(origin,end)>.995,get obstacleCount(){return bounds.length;}};
}
