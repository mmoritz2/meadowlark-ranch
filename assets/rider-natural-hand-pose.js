// Isolated natural-hand study. Only the on-foot finger relaxation map changes.
// Uses canonical segment lengths and the actual palm frame; no mesh or rest edit.
export function naturalHandPose(THREE,scene,bones,seat){
 const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),P=n=>bones[n].getWorldPosition(V());
 const saved=new Map(Object.entries(bones).map(([n,b])=>[n,{q:b.quaternion.clone(),p:b.position.clone()}]));
 const aim=(b,from,to)=>{const delta=Q().setFromUnitVectors(from.clone().normalize(),to.clone().normalize()),world=b.getWorldQuaternion(Q()).premultiply(delta),parent=b.parent.getWorldQuaternion(Q());b.quaternion.copy(parent.invert().multiply(world)).normalize();b.updateMatrixWorld(true);};
 const report={scope:'On-foot finger relaxation only; mounted grip, wrist, arm, bind and weights preserved',sides:{}};
 try{
  for(const [n,r]of seat.restLocal){bones[n].quaternion.copy(r.q);bones[n].position.copy(r.p);}scene.updateMatrixWorld(true);
  for(const side of ['l','r']){
   const names=f=>[`${f}_01_${side}`,`${f}_02_${side}`,`${f}_03_${side}`,`${f}_04_leaf_${side}`];
   const rest=Object.fromEntries(['thumb','index','middle','ring','pinky'].map(f=>[f,names(f).map(P)]));
   const long=P(`middle_01_${side}`).sub(P(`hand_${side}`)).normalize(),width=P(`index_01_${side}`).sub(P(`pinky_01_${side}`)),span=width.length();width.addScaledVector(long,-width.dot(long)).normalize();
   const normal=V().crossVectors(width,long).normalize();
   for(const[n,q]of seat.relax)if(n.endsWith('_'+side))bones[n].quaternion.copy(q);scene.updateMatrixWorld(true);
   const relaxed=Object.fromEntries(['thumb','index','middle','ring','pinky'].map(f=>[f,names(f).map(P)]));
   const indexBend=relaxed.index[3].clone().sub(relaxed.index[1]),palmar=normal.clone().multiplyScalar(indexBend.dot(normal)<0?-1:1);
   const angles={index:[14,22,12],middle:[16,24,14],ring:[18,26,16],pinky:[20,28,18]};
   for(const f of ['index','middle','ring','pinky']){
    const ns=names(f),ps=rest[f],lengths=ps.slice(1).map((p,i)=>p.distanceTo(ps[i])),ray=ps[1].clone().sub(ps[0]).normalize(),bend=palmar.clone().addScaledVector(ray,-palmar.dot(ray)).normalize();
    let total=0;for(let i=0;i<3;i++){total+=angles[f][i]*Math.PI/180;const direction=ray.clone().multiplyScalar(Math.cos(total)).addScaledVector(bend,Math.sin(total));aim(bones[ns[i]],P(ns[i+1]).sub(P(ns[i])),direction);}
    for(const n of ns.slice(0,3))seat.relax.set(n,bones[n].quaternion.clone());
   }
   // A single continuous, canonical-length thumb arc adducts toward the index
   // edge and lifts the thumb pad toward the palm plane. It does not chase a
   // rein endpoint or scale a fixed grip quaternion.
   const ns=names('thumb'),ps=rest.thumb,lengths=ps.slice(1).map((p,i)=>p.distanceTo(ps[i])),base=ps[0],target=relaxed.thumb[3].clone().addScaledVector(width,-.18*span).addScaledVector(palmar,-.20*span).addScaledVector(long,.08*span),delta=target.clone().sub(base),distance=delta.length(),forward=delta.clone().normalize(),bow=width.clone().addScaledVector(forward,-width.dot(forward)).normalize();
   const reach=a=>Math.hypot((lengths[0]+lengths[2])*Math.cos(a)+lengths[1],(lengths[0]-lengths[2])*Math.sin(a));
   if(distance>=reach(0)||distance<=reach(Math.PI*.5)||bow.lengthSq()<.99)throw Error('Natural-hand thumb target outside canonical arc reach: '+side);
   let lo=0,hi=Math.PI*.5;for(let i=0;i<60;i++){const a=(lo+hi)*.5;if(reach(a)>distance)lo=a;else hi=a;}const curvature=(lo+hi)*.5,beta=-Math.atan2((lengths[0]-lengths[2])*Math.sin(curvature),(lengths[0]+lengths[2])*Math.cos(curvature)+lengths[1]);
   for(let i=0;i<3;i++){const a=beta+(1-i)*curvature,direction=forward.clone().multiplyScalar(Math.cos(a)).addScaledVector(bow,Math.sin(a));aim(bones[ns[i]],P(ns[i+1]).sub(P(ns[i])),direction);seat.relax.set(ns[i],bones[ns[i]].quaternion.clone());}
   report.sides[side]={palmSpanM:span,long:long.toArray(),width:width.toArray(),palmar:palmar.toArray(),anglesDeg:angles,thumbTarget:target.toArray(),thumbTip:P(ns[3]).toArray(),thumbTargetErrorM:P(ns[3]).distanceTo(target),thumbCurvatureDeg:curvature*180/Math.PI,thumbLengths:lengths,thumbIndexGapM:P(ns[3]).distanceTo(P(`index_04_leaf_${side}`))};
  }
 }finally{for(const[n,r]of saved){bones[n].quaternion.copy(r.q);bones[n].position.copy(r.p);}scene.updateMatrixWorld(true);}
 seat.naturalHandPose=report;
}

// Lighter female idle, conversation and walking hands share one palm-local target.
export function relaxedOnFootFingerPose(THREE,scene,bones,seat,scale=.50){
 const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),P=n=>bones[n].getWorldPosition(V());
 const saved=new Map(Object.entries(bones).map(([n,b])=>[n,{q:b.quaternion.clone(),p:b.position.clone()}])),result=new Map();
 const aim=(b,from,to)=>{const delta=Q().setFromUnitVectors(from.clone().normalize(),to.clone().normalize()),world=b.getWorldQuaternion(Q()).premultiply(delta),parent=b.parent.getWorldQuaternion(Q());b.quaternion.copy(parent.invert().multiply(world)).normalize();b.updateMatrixWorld(true);};
 try{
  for(const[n,r]of seat.restLocal){bones[n].quaternion.copy(r.q);bones[n].position.copy(r.p);}scene.updateMatrixWorld(true);
  for(const side of ['l','r']){
   const palmar=V().fromArray(seat.naturalHandPose.sides[side].palmar);
   for(const f of ['index','middle','ring','pinky']){
    const ns=[`${f}_01_${side}`,`${f}_02_${side}`,`${f}_03_${side}`,`${f}_04_leaf_${side}`],ps=ns.map(P),ray=ps[1].clone().sub(ps[0]).normalize(),bend=palmar.clone().addScaledVector(ray,-palmar.dot(ray)).normalize();
    // Begin at the accepted natural target to retain its existing axial twist.
    for(const n of ns.slice(0,3))bones[n].quaternion.copy(seat.relax.get(n));scene.updateMatrixWorld(true);
    let total=0;for(let i=0;i<3;i++){total+=seat.naturalHandPose.sides[side].anglesDeg[f][i]*scale*Math.PI/180;const direction=ray.clone().multiplyScalar(Math.cos(total)).addScaledVector(bend,Math.sin(total));aim(bones[ns[i]],P(ns[i+1]).sub(P(ns[i])),direction);}
    for(const n of ns.slice(0,3))result.set(n,bones[n].quaternion.clone());
   }
   // Adduct the thumb beside the index edge with lighter palmar opposition,
   // using the canonical segment lengths throughout the continuous arc.
   const pose=seat.naturalHandPose.sides[side],width=V().fromArray(pose.width),long=V().fromArray(pose.long),ns=[`thumb_01_${side}`,`thumb_02_${side}`,`thumb_03_${side}`,`thumb_04_leaf_${side}`],ps=ns.map(P),lengths=ps.slice(1).map((p,i)=>p.distanceTo(ps[i])),base=ps[0],target=V().fromArray(pose.thumbTarget).addScaledVector(palmar,-.40*pose.palmSpanM).addScaledVector(long,.03*pose.palmSpanM),delta=target.clone().sub(base),distance=delta.length(),forward=delta.clone().normalize(),bow=width.clone().addScaledVector(forward,-width.dot(forward)).normalize();
   const reach=a=>Math.hypot((lengths[0]+lengths[2])*Math.cos(a)+lengths[1],(lengths[0]-lengths[2])*Math.sin(a));
   if(distance>=reach(0)||distance<=reach(Math.PI*.5)||bow.lengthSq()<.99)throw Error('Relaxed on-foot thumb target outside canonical arc reach: '+side);
   let lo=0,hi=Math.PI*.5;for(let i=0;i<60;i++){const a=(lo+hi)*.5;if(reach(a)>distance)lo=a;else hi=a;}const curvature=(lo+hi)*.5,beta=-Math.atan2((lengths[0]-lengths[2])*Math.sin(curvature),(lengths[0]+lengths[2])*Math.cos(curvature)+lengths[1]);
   for(let i=0;i<3;i++){const a=beta+(1-i)*curvature,direction=forward.clone().multiplyScalar(Math.cos(a)).addScaledVector(bow,Math.sin(a));aim(bones[ns[i]],P(ns[i+1]).sub(P(ns[i])),direction);result.set(ns[i],bones[ns[i]].quaternion.clone());}
  }
 }finally{for(const[n,r]of saved){bones[n].quaternion.copy(r.q);bones[n].position.copy(r.p);}scene.updateMatrixWorld(true);}
 return result;
}
