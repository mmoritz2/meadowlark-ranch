// Static architecture is registered before render batching. Sweep the camera's
// clearance volume against those solid surfaces, independently of horse collisions.
export function createFollowCamera({THREE,groundHeight,clearance=.3}) {
 const bounds=[],direction=new THREE.Vector3(),candidate=new THREE.Vector3();
 const orbit=new THREE.Vector3(),base=new THREE.Vector3();let avoidanceAngle=0;
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
  for(const b of bounds){
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
  base.subVectors(desired,origin);let angle=0;
  if(limit(origin,desired)<.72){
   let score=-Infinity;
   for(const a of [.52,-.52,1.05,-1.05,1.57,-1.57,2.1,-2.1]){
    orbit.set(base.x*Math.cos(a)+base.z*Math.sin(a),base.y,-base.x*Math.sin(a)+base.z*Math.cos(a)).add(origin);
    const visible=limit(origin,orbit),s=visible*6-Math.abs(a)*.45-(a*avoidanceAngle<0?.25:0);
    if(s>score){score=s;angle=a;}
   }
  }
  avoidanceAngle+=(angle-avoidanceAngle)*(1-Math.exp(-6*dt));
  orbit.set(base.x*Math.cos(avoidanceAngle)+base.z*Math.sin(avoidanceAngle),base.y,
   -base.x*Math.sin(avoidanceAngle)+base.z*Math.cos(avoidanceAngle)).add(origin);
  return resolve(origin,orbit,out);
 }
 return {register,resolve,frame,isClear:(origin,end)=>limit(origin,end)>.995,get obstacleCount(){return bounds.length;}};
}
