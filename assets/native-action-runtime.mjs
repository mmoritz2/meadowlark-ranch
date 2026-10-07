// Native action clocks belong to the animation controller. UI and peers only
// observe that clock; they never add another frame delta to it.
export function syncNativeActionEmote(rig){
 const action=rig?.heroMotion?.state?.action;
 if(rig?.emote?.native){if(action&&action.type===rig.emote.type){rig.emote.t=action.timeS;rig.emote.dur=action.durationS;}else rig.emote=null;}
 return action||null;
}
export function nativeActionPacket(rig){
 if(!rig?.heroMotion?.supportedActions?.length)return null;
 const action=rig.heroMotion.state.action;
 return {seq:rig.nativeActionSeq||0,type:action?.type||null,elapsedS:action?.timeS||0};
}
export function receiveNativeAction(rig,packet,{wild=false}={}){
 const motion=rig?.heroMotion;
 if(!motion?.startAction||!packet||!Number.isSafeInteger(packet.seq)||packet.seq<=0||packet.seq<(rig.receivedNativeActionSeq||0))return false;
 if(packet.type===null){
  rig.receivedNativeActionSeq=packet.seq;motion.cancelAction();rig.emote=null;return true;
 }
 const record=motion.actionDescriptor(packet.type);
 if(!record||record.dismountedOnly&&wild!==true||!Number.isFinite(packet.elapsedS)||packet.elapsedS<0||packet.elapsedS>=record.durationS||rig.nativeFlying)return false;
 if(packet.seq===rig.receivedNativeActionSeq)return false;
 if(motion.state.action)motion.cancelAction();
 if(!motion.startAction(packet.type,{elapsedS:packet.elapsedS}))return false;
 rig.receivedNativeActionSeq=packet.seq;rig.nativeActionSeatActive=true;
 rig.emote={type:packet.type,native:true,t:packet.elapsedS,dur:record.durationS,seq:packet.seq};
 return true;
}

export function captureNativeActionSeat(THREE,rig){
 if(rig.profile?.nativeKind!=='horse'||!rig.nativeSeatFollower)return;
 rig.scene.updateWorldMatrix(true,true);
 const frame=rig.scene.getWorldQuaternion(new THREE.Quaternion()).invert();
 rig.nativeActionSeatRest=frame.multiply(rig.nativeSeatFollower.getWorldQuaternion(new THREE.Quaternion()));
 rig.nativeActionSeatDelta=new THREE.Quaternion();
}
export function nativeActionSeatRotation(THREE,rig,mount,out){
 out.identity();
 if(!rig.nativeActionSeatActive||!rig.nativeActionSeatRest||!rig.nativeSeatFollower)return out;
 const state=rig.heroMotion.state;
 if(!state.action&&!state.transitioning){rig.nativeActionSeatActive=false;rig.nativeActionSeatDelta?.identity();return out;}
 mount.updateWorldMatrix(true,true);
 const frame=mount.getWorldQuaternion(new THREE.Quaternion()).invert();
 const restInMount=frame.clone().multiply(rig.scene.getWorldQuaternion(new THREE.Quaternion())).multiply(rig.nativeActionSeatRest);
 out.copy(frame).multiply(rig.nativeSeatFollower.getWorldQuaternion(new THREE.Quaternion())).multiply(restInMount.invert()).normalize();
 rig.nativeActionSeatDelta?.copy(out);
 return out;
}

// Hand references and this saved rider origin share the mount's coordinate
// frame, including pony scale and saddle clearance. Convert only once.
export function transformNativeActionReference(rider,point,out){
 const frame=rider._handFrame;
 out.copy(point);
 if(frame)out.sub(frame.position).applyQuaternion(frame.inverseRotation).applyQuaternion(rider.g.quaternion).add(rider.g.position);
 return out;
}
