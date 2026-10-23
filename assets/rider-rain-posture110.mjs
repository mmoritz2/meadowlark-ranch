// Rain owns its standing posture. The Canino102 hip/arm correction was tailored
// to a different body and is deliberately not layered onto this character.
const done=new WeakSet();
let identityState=0x110c4a17;
const limits={
 Idle_Loop:{spine:[1,2,1],gaze:[-2,2],arms:true},
 Idle_Talking_Loop:{spine:[1,3,2],gaze:[-4,4]},
 Walk_Loop:{spine:[2,4,3],gaze:[-5,3]},
 Jog_Fwd_Loop:{spine:[7,10,13],gaze:[-8,2]},
 Sprint_Loop:{spine:[10,15,19],gaze:[-10,1]},
};
export function prepareRainPosture110(T,kit){
 if(kit.body!=='f'||done.has(kit))return kit;
 const previous=Math.random;Math.random=()=>{identityState^=identityState<<13;identityState^=identityState>>>17;identityState^=identityState<<5;return(identityState>>>0)/4294967296;};
 try{return prepare(T,kit);}finally{Math.random=previous;}
}
function prepare(T,kit){
 const scene=kit.scene,bones=kit.bones,V=(...v)=>new T.Vector3(...v),Q=()=>new T.Quaternion(),deg=T.MathUtils.degToRad;
 const saved=new Map(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 scene.updateMatrixWorld(true);const bindHead=bones.Head.getWorldQuaternion(Q()),report={clips:{},noJointTranslationsChanged:true,headGeometryShift:false,canonicalMaleUnchanged:true};
 const point=n=>bones[n].getWorldPosition(V()),world=n=>bones[n].getWorldQuaternion(Q());
 const setWorld=(n,q)=>{const b=bones[n];b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(q)).normalize();b.updateMatrixWorld(true);};
 const turnWorld=(n,axis,a)=>setWorld(n,Q().setFromAxisAngle(axis,a).multiply(world(n)));
 const aim=(n,child,to)=>{const from=point(child).sub(point(n)).normalize();setWorld(n,Q().setFromUnitVectors(from,to.clone().normalize()).multiply(world(n)));};
 const restore=()=>{for(const[n,s]of saved){const b=bones[n];b.position.copy(s.p);b.quaternion.copy(s.q);b.scale.copy(s.s);}scene.updateMatrixWorld(true);kit.skin.skeleton.update();};
 try{
  for(const[name,setting]of Object.entries(limits)){
   const source=kit.clips[name];if(!source)continue;restore();
   const names=['spine_01','spine_02','spine_03','Head',...(setting.arms?['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r']:[])];
   const mixer=new T.AnimationMixer(scene),action=mixer.clipAction(source);action.play();
   const count=Math.max(2,Math.ceil(source.duration*30)),times=[],values=new Map(names.map(n=>[n,[]]));
   const metrics={samples:count+1,maxTorsoCorrectionDeg:0,maxGazeCorrectionDeg:0,maxJointTranslationDeltaM:0};
   for(let i=0;i<=count;i++){
    const time=source.duration*i/count;
    // A few source clips omit Head/neck tracks. Reset the edited joints before
    // sampling so an unkeyed rotation cannot accumulate from the previous frame.
    for(const n of names){bones[n].quaternion.copy(saved.get(n).q);bones[n].position.copy(saved.get(n).p);}
    mixer.setTime(time);scene.updateMatrixWorld(true);
    const originalHead=world('Head');
    for(const[n,child,k]of[['spine_01','spine_02',0],['spine_02','spine_03',1],['spine_03','neck_01',2]]){
     const d=point(child).sub(point(n)),pitch=Math.atan2(d.z,d.y),wanted=deg(setting.spine[k]);
     // Keep running motion and breathing, but bound forward rounding. A small
     // residual keeps the result relaxed rather than a rigid parade stance.
     const target=setting.arms?wanted+(pitch-wanted)*.10:T.MathUtils.clamp(pitch,wanted-deg(3),wanted+deg(3));
     const turn=T.MathUtils.clamp(target-pitch,-deg(12),deg(12));turnWorld(n,V(1,0,0),turn);metrics.maxTorsoCorrectionDeg=Math.max(metrics.maxTorsoCorrectionDeg,Math.abs(T.MathUtils.radToDeg(turn)));
    }
    // A torso adjustment must not tip the face at the sky. Preserve source yaw
    // and small motion while keeping the gaze close to the horizon.
    setWorld('Head',originalHead);
    const delta=world('Head').multiply(bindHead.clone().invert()),forward=V(0,0,1).applyQuaternion(delta).normalize(),pitch=Math.atan2(forward.y,Math.hypot(forward.x,forward.z)),wanted=T.MathUtils.clamp(pitch,deg(setting.gaze[0]),deg(setting.gaze[1])),right=V().crossVectors(V(0,1,0),forward).normalize();
    turnWorld('Head',right,-(wanted-pitch));metrics.maxGazeCorrectionDeg=Math.max(metrics.maxGazeCorrectionDeg,Math.abs(T.MathUtils.radToDeg(wanted-pitch)));
    if(setting.arms)for(const side of[1,-1]){
     const sd=side>0?'l':'r',upper='upperarm_'+sd,lower='lowerarm_'+sd,hand='hand_'+sd;
     aim(upper,lower,V(side*(side>0?.105:.125),-1,.012));
     aim(lower,hand,V(side*.035,-1,side>0?.115:.13));
     bones[hand].quaternion.copy(kit.seat.restLocal.get(hand).q);bones[hand].updateMatrixWorld(true);
     const axis=point(hand).sub(point(lower)).normalize(),width=point('index_01_'+sd).sub(point('pinky_01_'+sd));width.addScaledVector(axis,-width.dot(axis)).normalize();
     const target=V(0,0,1).addScaledVector(axis,-axis.z).normalize(),angle=Math.atan2(axis.dot(V().crossVectors(width,target)),width.dot(target));turnWorld(lower,axis,angle);
     aim(hand,'middle_01_'+sd,V(side*.035,-1,.055));
    }
    times.push(time);
    for(const n of names){const q=bones[n].quaternion,a=values.get(n),last=a.length;if(last&&q.x*a[last-4]+q.y*a[last-3]+q.z*a[last-2]+q.w*a[last-1]<0)a.push(-q.x,-q.y,-q.z,-q.w);else a.push(q.x,q.y,q.z,q.w);}
   }
   mixer.stopAllAction();mixer.uncacheRoot(scene);
   const replaced=new Set(names.map(n=>n+'.quaternion')),tracks=source.tracks.filter(t=>!replaced.has(t.name)).map(t=>t.clone());
   for(const[n,a]of values){a.splice(a.length-4,4,...a.slice(0,4));tracks.push(new T.QuaternionKeyframeTrack(n+'.quaternion',times,a));}
   kit.clips[name]=new T.AnimationClip(source.name,source.duration,tracks);report.clips[name]=metrics;
  }
 }finally{restore();}
 kit.rainPosture110=report;done.add(kit);return kit;
}
