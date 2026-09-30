// Private integration prototype for exact measured native gait clips.
// Switching modes is instantaneous; transitions and steering remain unreviewed.
// Keep the actor transform outside mixerRoot; the clip animates its original rig.
export function createNativeHorseController({THREE, mixerRoot, clips, actor,
  gaits, idleClip='Horse|Horse_Idle'}={}) {
  if (!THREE || !mixerRoot || !actor || actor===mixerRoot) {
    throw new Error('Native horse requires a separate actor and mixer root');
  }
  let ancestor=mixerRoot.parent;
  while(ancestor && ancestor!==actor) ancestor=ancestor.parent;
  if(ancestor!==actor) throw new Error('Native horse mixer root must belong to its actor');
  const idle=THREE.AnimationClip.findByName(clips, idleClip);
  if (!idle || !gaits || !Object.keys(gaits).length) throw new Error('Missing native gait records or Idle');
  const records={}, gaitClips={};
  for (const [name,record] of Object.entries(gaits)) {
    if (['rest','stand'].includes(name)) throw new Error('Reserved native mode: '+name);
    const {durationS,strokeM,stanceFraction,nominalSpeedMps,clip}=record;
    if (!(durationS>0 && strokeM>0 && stanceFraction>0 && stanceFraction<1 && Number.isFinite(nominalSpeedMps))) {
      throw new Error('Invalid measured gait: '+name);
    }
    if (Math.abs(nominalSpeedMps-strokeM/(stanceFraction*durationS))>1e-8) {
      throw new Error('Speed differs from measured contact timing: '+name);
    }
    const found=THREE.AnimationClip.findByName(clips, clip);
    if (!found || Math.abs(found.duration-durationS)>1e-5) throw new Error('Missing or mismatched native clip: '+name);
    records[name]=Object.freeze({...record});gaitClips[name]=found;
  }
  Object.freeze(records);
  const supportedModes=Object.freeze(['rest','stand',...Object.keys(records)]);
  const rest=[];
  mixerRoot.traverse(o=>{
    if (o.isBone) rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);
  });
  const mixer=new THREE.AnimationMixer(mixerRoot);
  const actions={stand:mixer.clipAction(idle)};
  for (const [name,clip] of Object.entries(gaitClips)) actions[name]=mixer.clipAction(clip);
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
    if (!supportedModes.includes(next)) {
      throw new Error('Native gait is not available: '+next);
    }
    if (next===mode) return;
    restore(); mode=next;
    if (mode!=='rest') actions[mode].reset().play();
    mixer.update(0);
  }
  function snapshot() {
    let speedMps=0;
    if(records[mode]) {
      worldDirection.set(0,0,records[mode].nominalSpeedMps*actor.scale.z).applyQuaternion(actor.quaternion);
      if(actor.parent) {
        actor.parent.updateWorldMatrix(true,false);
        worldDirection.applyMatrix3(parentLinear.setFromMatrix4(actor.parent.matrixWorld));
      }
      speedMps=worldDirection.length();
    }
    return {mode,phase01:mode==='rest'?0:actions[mode].time/(gaitClips[mode]||idle).duration,
      speedMps,distanceM,nominalSpeedMps:records[mode]?.nominalSpeedMps||0,
      supportedModes:[...supportedModes],transitionsReviewed:false};
  }
  function update(dt) {
    assertLive();
    if (!Number.isFinite(dt) || dt<0) throw new Error('Invalid native motion delta');
    if (mode==='rest' || dt===0) return snapshot();
    mixer.update(dt);
    if (records[mode]) {
      // Travel in the actor's own +Z direction, expressed in its parent space.
      // Actor scale changes both the mesh stride and actual traveled distance.
      direction.set(0,0,records[mode].nominalSpeedMps*dt*actor.scale.z).applyQuaternion(actor.quaternion);
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
