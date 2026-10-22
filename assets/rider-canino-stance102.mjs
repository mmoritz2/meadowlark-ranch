/* A relaxed standing idle for the imported female rider. Bake the correction
 * once into the clip so the creator, cards and on-foot controller agree. */
const prepared=new WeakSet();let identityState=0x102c4a17;
export function prepareCaninoStance102(T,kit){
 if(kit.body!=='f'||prepared.has(kit)||!kit.clips.Idle_Loop)return kit;
 // THREE creates resource UUIDs while baking. Keep those identifier draws
 // independent of the seeded world layout's ambient random stream.
 const previous=Math.random;Math.random=()=>{identityState^=identityState<<13;identityState^=identityState>>>17;identityState^=identityState<<5;return(identityState>>>0)/4294967296;};
 try{return prepare(T,kit);}finally{Math.random=previous;}
}
function prepare(T,kit){
 if(kit.body!=='f'||prepared.has(kit)||!kit.clips.Idle_Loop)return kit;
 const source=kit.clips.Idle_Loop,scene=kit.scene,bones=kit.bones;
 const names=['spine_01','spine_03',...['upperarm','lowerarm','hand','thigh','calf','foot'].flatMap(n=>[n+'_l',n+'_r'])];
 const saved=new Map(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 const mixer=new T.AnimationMixer(scene),action=mixer.clipAction(source);action.play();
 const pelvisPositions=[],times=[],rotations=new Map(names.map(n=>[n,[]])),V=(...v)=>new T.Vector3(...v),Q=()=>new T.Quaternion(),point=n=>bones[n].getWorldPosition(V());
 const setWorld=(bone,q)=>{bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(q)).normalize();bone.updateMatrixWorld(true);};
 const aim=(name,child,direction)=>{const from=point(child).sub(point(name)).normalize(),turn=Q().setFromUnitVectors(from,direction.clone().normalize());setWorld(bones[name],turn.multiply(bones[name].getWorldQuaternion(Q())));};
 let maxAnkleErrorM=0,maxPelvisLoweringM=0;
 const count=Math.max(2,Math.ceil(source.duration*30));
 try{
  for(let i=0;i<=count;i++){
   const time=source.duration*i/count,phase=2*Math.PI*i/count;mixer.setTime(time);scene.updateMatrixWorld(true);
   const legs=['l','r'].map(sd=>{const H=point('thigh_'+sd),K=point('calf_'+sd),A=point('foot_'+sd);return {sd,H,K,A,a:H.distanceTo(K),b:K.distanceTo(A),foot:bones['foot_'+sd].getWorldQuaternion(Q())};});
   // Shift the weight slightly onto one side while both soles keep their
   // original planted frame. A counter-lean keeps the upper body relaxed.
   const pelvis=bones.pelvis,hip=point('pelvis').add(V(.026,0,0));pelvis.position.copy(pelvis.parent.worldToLocal(hip));pelvis.updateMatrixWorld(true);
   let lower=0;
   for(const leg of legs){const delta=point('thigh_'+leg.sd).sub(leg.A),reach=leg.a+leg.b-.00005;lower=Math.max(lower,delta.y-Math.sqrt(Math.max(0,reach*reach-delta.x*delta.x-delta.z*delta.z)));}
   if(lower>0){const H=point('pelvis');H.y-=lower;pelvis.position.copy(pelvis.parent.worldToLocal(H));pelvis.updateMatrixWorld(true);maxPelvisLoweringM=Math.max(maxPelvisLoweringM,lower);}
   for(const leg of legs){
    const H=point('thigh_'+leg.sd),delta=leg.A.clone().sub(H),distance=delta.length(),u=delta.clone().divideScalar(distance),a=(leg.a*leg.a-leg.b*leg.b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,leg.a*leg.a-a*a));
    const oldAxis=leg.A.clone().sub(leg.H).normalize(),pole=leg.K.clone().sub(leg.H);pole.addScaledVector(oldAxis,-pole.dot(oldAxis));pole.addScaledVector(u,-pole.dot(u));if(pole.lengthSq()<1e-8)pole.copy(V(0,0,1)).addScaledVector(u,-u.z);pole.normalize();
    const knee=H.clone().addScaledVector(u,a).addScaledVector(pole,height);
    aim('thigh_'+leg.sd,'calf_'+leg.sd,knee.sub(H));aim('calf_'+leg.sd,'foot_'+leg.sd,leg.A.clone().sub(point('calf_'+leg.sd)));setWorld(bones['foot_'+leg.sd],leg.foot);
    maxAnkleErrorM=Math.max(maxAnkleErrorM,point('foot_'+leg.sd).distanceTo(leg.A));
   }
   const spine=bones.spine_01;setWorld(spine,Q().setFromAxisAngle(V(0,0,1),.025).multiply(spine.getWorldQuaternion(Q())));
   // A small counter-turn breaks the square mannequin shoulder line.
   const chest=bones.spine_03,turn=Q().setFromEuler(new T.Euler(0,.018,-.010));setWorld(chest,turn.multiply(chest.getWorldQuaternion(Q())));
   for(const side of [1,-1]){
    const sd=side>0?'l':'r',upper='upperarm_'+sd,lower='lowerarm_'+sd,hand='hand_'+sd;
    aim(upper,lower,V((side>0?.115:.15)*side,-1,-.025));
    aim(lower,hand,V((side>0?.035:.055)*side,-1,(side>0?.255:.215)+.004*Math.sin(phase)));
    bones[hand].quaternion.copy(kit.seat.restLocal.get(hand).q);bones[hand].updateMatrixWorld(true);
    // Rotate the whole forearm so the palm rests toward the thigh, with the
    // thumb forward; a wrist-only correction would create an awkward twist.
    const axis=point(hand).sub(point(lower)).normalize(),width=point('index_01_'+sd).sub(point('pinky_01_'+sd));
    width.addScaledVector(axis,-width.dot(axis)).normalize();const target=V(0,0,1).addScaledVector(axis,-axis.z).normalize();
    const angle=Math.atan2(axis.dot(V().crossVectors(width,target)),width.dot(target));
    setWorld(bones[lower],Q().setFromAxisAngle(axis,angle).multiply(bones[lower].getWorldQuaternion(Q())));
    aim(hand,'middle_01_'+sd,V(.055*side,-1,.18));
   }
   times.push(time);pelvisPositions.push(...bones.pelvis.position.toArray());
   for(const name of names){const q=bones[name].quaternion,values=rotations.get(name),n=values.length;if(n&&q.x*values[n-4]+q.y*values[n-3]+q.z*values[n-2]+q.w*values[n-1]<0)values.push(-q.x,-q.y,-q.z,-q.w);else values.push(q.x,q.y,q.z,q.w);}
  }
 }finally{
  mixer.stopAllAction();mixer.uncacheRoot(scene);
  for(const[n,r]of saved){bones[n].position.copy(r.p);bones[n].quaternion.copy(r.q);bones[n].scale.copy(r.s);}scene.updateMatrixWorld(true);kit.skin.skeleton.update();
 }
 const replaced=new Set([...names.map(n=>n+'.quaternion'),'pelvis.position']),tracks=source.tracks.filter(t=>!replaced.has(t.name));
 for(const[name,values]of rotations){values.splice(values.length-4,4,...values.slice(0,4));tracks.push(new T.QuaternionKeyframeTrack(name+'.quaternion',times,values));}
 pelvisPositions.splice(pelvisPositions.length-3,3,...pelvisPositions.slice(0,3));tracks.push(new T.VectorKeyframeTrack('pelvis.position',times,pelvisPositions));
 kit.clips.Idle_Loop=new T.AnimationClip(source.name,source.duration,tracks);
 kit.caninoStance102={clip:'Idle_Loop',sampleCount:times.length,elbows:'soft bend, palms toward thighs',legs:'weight shifted with both ankle frames planted',hipShiftM:.026,maxAnkleErrorM,maxPelvisLoweringM,unchangedClips:Object.keys(kit.clips).filter(n=>n!=='Idle_Loop')};prepared.add(kit);return kit;
}
