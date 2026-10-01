// Pose-only playback of the preserved native clips. The Ranch owns actor travel.
export function createNativeHorseMotion({THREE,root,clips,profile}={}){
 if(!THREE||!root||!profile?.nativeBreed)throw new Error('Native motion requires its original root and profile');
 // Creator dragon clips retain their source playback behavior; their ground
 // contact has not been approved for blended transitions.
 if(profile.nativeKind!=='horse')return createCreatorMotion({THREE,root,clips,profile});
 const rest=[];root.traverse(o=>rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
 const mixer=new THREE.AnimationMixer(root),records=profile.nativeGaits||{},actions={},sourceClips={};
 const add=(mode,name,duration)=>{if(!name)return;const clip=THREE.AnimationClip.findByName(clips,name);if(!clip||duration&&Math.abs(clip.duration-duration)>1e-5)throw new Error('Missing or mismatched native clip '+name);sourceClips[mode]=clip;actions[mode]=mixer.clipAction(clip);};
 add('stand',profile.nativeIdleClip);add('sit',profile.nativeSitClip);
 for(const [key,record]of Object.entries(records)){if(!(record.nominalSpeedMps>0))throw new Error('Invalid native gait reference '+key);if(record.strokeM&&Math.abs(record.nominalSpeedMps-record.strokeM/(record.stanceFraction*record.durationS))>1e-7)throw new Error('Native gait speed/timing mismatch '+key);add(key,record.clip,record.durationS);}
 // Use the original default values through the same bindings as the source
 // clips. This is a static rest target, not a fabricated creator idle clip.
 const restTracks=[],bindings=new Set();
 for(const clip of Object.values(sourceClips))for(const track of clip.tracks){
  if(bindings.has(track.name))continue;bindings.add(track.name);
  const cubic=!!track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline;
  const size=track.getValueSize()/(cubic?3:1),value=new Float32Array(size);
  const binding=THREE.PropertyBinding.create(root,track.name);binding.bind();binding.getValue(value,0);binding.unbind();
  if(!value.every(Number.isFinite))throw new Error('Invalid native default binding '+track.name);
  restTracks.push(new track.constructor(track.name,[0,1],[...value,...value],THREE.InterpolateLinear));
 }
 const restClip=new THREE.AnimationClip('Native default standing pose',1,restTracks);
 actions.rest=mixer.clipAction(restClip);if(!actions.stand)actions.stand=actions.rest;
 const gaits={stand:{speed:0},rest:{speed:0}};for(const [key,r]of Object.entries(records))gaits[key]={speed:r.nominalSpeedMps,clip:r.clip,duration:r.durationS};if(records.canterLeft)gaits.canter={speed:records.canterLeft.nominalSpeedMps};
 const availableModes=['rest','stand',...(profile.nativeSitClip?['sit']:[]),...Object.keys(records).filter(k=>!/^canter/.test(k)),...(records.canterLeft?['canter']:[])];
 const fadeSeconds=.20,active=new Map();
 let mode='rest',key='rest',lead='left',speedMps=0,turn=0,disposed=false,transition=null;
 actions.rest.setEffectiveWeight(1).play();active.set(actions.rest,1);mixer.update(0);
 function assertLive(){if(disposed)throw new Error('Native motion disposed');}
 function restore(){mixer.stopAllAction();active.clear();transition=null;for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}root.updateMatrixWorld(true);}
 function phaseOf(action){const duration=action?.getClip().duration;return duration?((action.time/duration)%1+1)%1:0;}
 function alignedPhase(previous,next){
  const phase=phaseOf(actions[previous]);
  if(!records[previous]||!records[next])return 0;
  // Both lead clips share the torso cycle; preserve it when changing lead.
  if(/^canter/.test(previous)&&/^canter/.test(next))return phase;
  // Match the anatomical FL touchdown between the authored horse cycles.
  const flOffset=k=>records[k]?.footOffsets?.FL??records[k]?.offsets?.FL??(k==='walk'?.25:k==='trot'?0:k==='canterLeft'?.48:k==='canterRight'?.24:0);
  return profile.nativeKind==='horse'?((phase-flOffset(previous)+flOffset(next))%1+1)%1:phase;
 }
 function set(value,{lead:nextLead=lead,speedMps:nextSpeed}={}){
  assertLive();const byClip=Object.keys(sourceClips).find(k=>sourceClips[k].name===value);if(byClip)value=byClip;
  nextLead=nextLead==='right'?'right':'left';let nextKey=value;
  if(value==='canter')nextKey=nextLead==='right'?'canterRight':'canterLeft';
  if(value==='canterLeft'||value==='canterRight'){nextLead=value==='canterRight'?'right':'left';value='canter';}
  if(!actions[nextKey])throw new Error('Native '+profile.id+' has no '+value+' animation');
  if(nextSpeed!==undefined){if(!Number.isFinite(nextSpeed)||nextSpeed<0)throw new Error('Invalid native speed');speedMps=nextSpeed;}else speedMps=records[nextKey]?.nominalSpeedMps||0;
  if(nextKey===key){lead=nextLead;return;}
  const target=actions[nextKey],previous=key;
  if(!active.has(target)){
   target.reset();target.time=alignedPhase(previous,nextKey)*target.getClip().duration;
   target.setEffectiveWeight(0).play();active.set(target,0);
  }
  mode=value;key=nextKey;lead=nextLead;
  // Interrupted blends begin from their current weights, so repeated speed
  // input cannot jump a fading action back to full influence.
  transition={elapsed:0,start:new Map(active),target};
  if(active.size===1&&active.has(target)){target.setEffectiveWeight(1);active.set(target,1);transition=null;}
 }
 function update(dt,{rate=1}={}){
  assertLive();if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid native motion delta');
  if(!Number.isFinite(rate)||rate<0)throw new Error('Invalid native playback rate');
  const target=actions[key];target.setEffectiveTimeScale(records[key]?rate:1);
  if(transition){
   transition.elapsed=Math.min(fadeSeconds,transition.elapsed+dt);if(fadeSeconds-transition.elapsed<1e-10)transition.elapsed=fadeSeconds;
   const t=transition.elapsed/fadeSeconds,s=t*t*t*(t*(t*6-15)+10);
   for(const[action,start]of transition.start){const weight=start+(action===transition.target?1-start:-start)*s;action.setEffectiveWeight(weight);active.set(action,weight);}
  }
  // Mixer time is wall time. Each gait's own time scale controls its playback.
  mixer.update(dt);root.updateMatrixWorld(true);
  if(transition?.elapsed>=fadeSeconds){for(const action of active.keys())if(action!==target){action.stop();active.delete(action);}target.setEffectiveWeight(1);active.set(target,1);transition=null;}
 }
 function snapshot(){const clip=sourceClips[key];return {gait:mode,lead,phase01:clip?phaseOf(actions[key]):0,bodyLiftM:0,speedMps,grounded:mode!=='fly',intensity:profile.nativeMaxSpeedMps?Math.min(1,speedMps/profile.nativeMaxSpeedMps):0,turn,transitioning:!!transition,transitionElapsedS:transition?.elapsed||0,transitionDurationS:fadeSeconds,activeActions:active.size,restFallback:!clip,transitionsReviewed:false};}
 function reset(){assertLive();restore();mode='rest';key='rest';speedMps=0;actions.rest.reset().setEffectiveWeight(1).play();active.set(actions.rest,1);mixer.update(0);}
 return {set,update,reset,snapshot,gaits,availableModes,supportedModes:availableModes,mixer,get mode(){return mode;},get state(){return snapshot();},get clip(){return sourceClips[key]?.name||null;},get time(){return sourceClips[key]?actions[key]?.time||0:0;},setTurn(v){turn=Math.max(-1,Math.min(1,Number(v)||0));},dispose(){if(disposed)return;restore();mixer.uncacheRoot(root);disposed=true;}};

}

function createCreatorMotion({THREE,root,clips,profile}={}){
 if(!THREE||!root||!profile?.nativeBreed)throw new Error('Native motion requires its original root and profile');
 const rest=[];root.traverse(o=>rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
 const mixer=new THREE.AnimationMixer(root),records=profile.nativeGaits||{},actions={},sourceClips={};
 const add=(mode,name,duration)=>{if(!name)return;const clip=THREE.AnimationClip.findByName(clips,name);if(!clip||duration&&Math.abs(clip.duration-duration)>1e-5)throw new Error('Missing or mismatched native clip '+name);sourceClips[mode]=clip;actions[mode]=mixer.clipAction(clip);};
 add('stand',profile.nativeIdleClip);add('sit',profile.nativeSitClip);
 for(const [key,record]of Object.entries(records)){if(!(record.nominalSpeedMps>0))throw new Error('Invalid native gait reference '+key);if(record.strokeM&&Math.abs(record.nominalSpeedMps-record.strokeM/(record.stanceFraction*record.durationS))>1e-7)throw new Error('Native gait speed/timing mismatch '+key);add(key,record.clip,record.durationS);}
 const gaits={stand:{speed:0},rest:{speed:0}};for(const [key,r]of Object.entries(records))gaits[key]={speed:r.nominalSpeedMps,clip:r.clip,duration:r.durationS};if(records.canterLeft)gaits.canter={speed:records.canterLeft.nominalSpeedMps};
 const availableModes=['rest','stand',...(profile.nativeSitClip?['sit']:[]),...Object.keys(records).filter(k=>!/^canter/.test(k)),...(records.canterLeft?['canter']:[])];
 let mode='rest',key='rest',lead='left',speedMps=0,turn=0,disposed=false;
 function assertLive(){if(disposed)throw new Error('Native motion disposed');}
 function restore(){mixer.stopAllAction();for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}root.updateMatrixWorld(true);}
 function set(value,{lead:nextLead=lead,speedMps:nextSpeed}={}){
  assertLive();const byClip=Object.keys(sourceClips).find(k=>sourceClips[k].name===value);if(byClip)value=byClip;
  nextLead=nextLead==='right'?'right':'left';let nextKey=value;
  if(value==='canter'){nextKey=nextLead==='right'?'canterRight':'canterLeft';}
  if(value==='canterLeft'||value==='canterRight'){nextLead=value==='canterRight'?'right':'left';value='canter';}
  if(value!=='rest'&&value!=='stand'&&!actions[nextKey])throw new Error('Native '+profile.id+' has no '+value+' animation');
  if(nextSpeed!==undefined){if(!Number.isFinite(nextSpeed)||nextSpeed<0)throw new Error('Invalid native speed');speedMps=nextSpeed;}else speedMps=records[nextKey]?.nominalSpeedMps||0;
  if(nextKey===key){lead=nextLead;return;}
  restore();mode=value;key=nextKey;lead=nextLead;if(actions[key]){actions[key].reset().play();mixer.update(0);}root.updateMatrixWorld(true);
 }
 function update(dt,{rate=1}={}){assertLive();if(!Number.isFinite(rate)||rate<0)throw new Error('Invalid native playback rate');if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid native motion delta');if(actions[key])mixer.update(dt*rate);root.updateMatrixWorld(true);}
 function snapshot(){const clip=sourceClips[key];return {gait:mode,lead,phase01:clip?actions[key].time/clip.duration:0,bodyLiftM:0,speedMps,grounded:mode!=='fly',intensity:profile.nativeMaxSpeedMps?Math.min(1,speedMps/profile.nativeMaxSpeedMps):0,turn,transitioning:false,transitionDurationS:0,restFallback:!clip,transitionsReviewed:false};}
 function reset(){assertLive();restore();mode='rest';key='rest';speedMps=0;}
 return {set,update,reset,snapshot,gaits,availableModes,supportedModes:availableModes,mixer,get mode(){return mode;},get state(){return snapshot();},get clip(){return sourceClips[key]?.name||null;},get time(){return actions[key]?.time||0;},setTurn(v){turn=Math.max(-1,Math.min(1,Number(v)||0));},dispose(){if(disposed)return;restore();mixer.uncacheRoot(root);disposed=true;}};
}

export function getNativeHorseCapabilities(rig){
 if(!rig?.profile?.nativeBreed)return null;
 const profile=rig.profile,scale=rig.scene?.getWorldScale(rig.scene.position.clone().set(1,1,1)).z||1;
 return {native:true,nativeKind:profile.nativeKind,maxSpeedMps:profile.nativeMaxSpeedMps*Math.abs(scale),flightMaxSpeedMps:(profile.nativeGaits?.fly?.nominalSpeedMps||0)*Math.abs(scale),nominalMaxSpeedMps:profile.nativeMaxSpeedMps,worldScale:Math.abs(scale),supportedModes:rig.heroMotion?.availableModes||['rest','stand',...Object.keys(profile.nativeGaits||{})],canJump:false,canGallop:false,canFly:!!profile.nativeCanFly,speedBasis:profile.nativeSpeedBasis||'Measured stance backflow of checked native horse clips'};
}

export function tickNativeHorse(rig,speed,dt,turn=0){
 const motion=rig.heroMotion,cap=getNativeHorseCapabilities(rig);if(!motion||!cap)return null;
 if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid native update delta');
 const actual=Math.max(0,Math.min(rig.nativeFlying&&cap.canFly?cap.flightMaxSpeedMps:cap.maxSpeedMps,Math.abs(Number(speed)||0))),gaits=rig.profile.nativeGaits||{};
 let gait='stand',rate=1,record=null;
 if(rig.nativeFlying&&gaits.fly){gait='fly';record=gaits.fly;}
 else if(actual>.02){const ground=Object.entries(gaits).filter(([key])=>key!=='fly'&&key!=='canterRight').sort((a,b)=>a[1].nominalSpeedMps-b[1].nominalSpeedMps);const chosen=ground.find(([,r])=>actual<=r.nominalSpeedMps*cap.worldScale+1e-7)||ground.at(-1);if(chosen){gait=chosen[0];record=chosen[1];}}
 const lead=turn<-.32?'right':turn>-.08?'left':rig.heroLead||'left';rig.heroLead=lead;if(gait==='canterLeft')gait='canter';
 if(record)rate=actual/(record.nominalSpeedMps*cap.worldScale);if(gait==='fly')rate=Math.max(.1,Math.min(1,rate||1));else rate=Math.min(1,Math.max(0,rate));
 motion.set(gait,{lead,speedMps:actual});motion.setTurn(turn);motion.update(dt,{rate});rig.phase=motion.state.phase01;rig.heroJumpAge=null;rig.heroJumpExtra=0;rig.heroRate=rate;return motion.state;
}
