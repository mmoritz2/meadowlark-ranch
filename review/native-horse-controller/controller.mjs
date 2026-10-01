// Private integration prototype. Only the slow Walk has passed contact review.
// Keep the actor transform outside mixerRoot; the clip animates its original rig.
export function createNativeHorseController({THREE, mixerRoot, clips, actor,
  walkClip='Target Native Walk', idleClip='Horse|Horse_Idle',
  cycleSeconds=1.12, strokeM=.40, stanceFraction=.65}={}) {
  if (!THREE || !mixerRoot || !actor || actor===mixerRoot) {
    throw new Error('Native horse requires a separate actor and mixer root');
  }
  let ancestor=mixerRoot.parent;
  while(ancestor && ancestor!==actor) ancestor=ancestor.parent;
  if(ancestor!==actor) throw new Error('Native horse mixer root must belong to its actor');
  if (!(cycleSeconds>0 && strokeM>0 && stanceFraction>0 && stanceFraction<1)) {
    throw new Error('Invalid measured Walk timing');
  }
  const walk=THREE.AnimationClip.findByName(clips, walkClip);
  const idle=THREE.AnimationClip.findByName(clips, idleClip);
  if (!walk || !idle) throw new Error('Missing native Walk or creator Idle');
  if (Math.abs(walk.duration-cycleSeconds)>1e-5) {
    throw new Error('Walk timing differs from contact-reviewed clip');
  }
  const nominalSpeedMps=strokeM/(stanceFraction*cycleSeconds);
  const rest=[];
  mixerRoot.traverse(o=>{
    if (o.isBone) rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);
  });
  const mixer=new THREE.AnimationMixer(mixerRoot);
  const actions={stand:mixer.clipAction(idle),walk:mixer.clipAction(walk)};
  const direction=new THREE.Vector3(),worldDirection=new THREE.Vector3(),parentLinear=new THREE.Matrix3();
  let mode='rest', distanceM=0, disposed=false;
  function restore() {
    mixer.stopAllAction();
    for (const [o,p,q,s] of rest) {o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}
    mixerRoot.updateMatrixWorld(true);
  }
  function assertLive() {if(disposed) throw new Error('Native horse controller disposed');}
  function set(next) {
    assertLive();
    if (!['rest','stand','walk'].includes(next)) {
      throw new Error('Native gait is not available: '+next);
    }
    if (next===mode) return;
    restore(); mode=next;
    if (mode!=='rest') actions[mode].reset().play();
    mixer.update(0);
  }
  function snapshot() {
    let speedMps=0;
    if(mode==='walk') {
      worldDirection.set(0,0,nominalSpeedMps*actor.scale.z).applyQuaternion(actor.quaternion);
      if(actor.parent) {
        actor.parent.updateWorldMatrix(true,false);
        worldDirection.applyMatrix3(parentLinear.setFromMatrix4(actor.parent.matrixWorld));
      }
      speedMps=worldDirection.length();
    }
    return {mode,phase01:mode==='rest'?0:actions[mode].time/(mode==='walk'?walk:idle).duration,
      speedMps,distanceM,nominalSpeedMps,
      supportedModes:['rest','stand','walk'],transitionsReviewed:false};
  }
  function update(dt) {
    assertLive();
    if (!Number.isFinite(dt) || dt<0) throw new Error('Invalid native motion delta');
    if (mode==='rest' || dt===0) return snapshot();
    mixer.update(dt);
    if (mode==='walk') {
      // Travel in the actor's own +Z direction, expressed in its parent space.
      // Actor scale changes both the mesh stride and actual traveled distance.
      direction.set(0,0,nominalSpeedMps*dt*actor.scale.z).applyQuaternion(actor.quaternion);
      actor.position.add(direction);
      worldDirection.copy(direction);
      if(actor.parent) {
        actor.parent.updateWorldMatrix(true,false);
        worldDirection.applyMatrix3(parentLinear.setFromMatrix4(actor.parent.matrixWorld));
      }
      distanceM+=worldDirection.length();
    }
    mixerRoot.updateMatrixWorld(true);
    return snapshot();
  }
  function reset() {assertLive();restore();mode='rest';distanceM=0;}
  function dispose() {
    if (disposed) return;
    restore();mixer.uncacheRoot(mixerRoot);disposed=true;
  }
  return {set,update,snapshot,reset,dispose,mixer};
}
