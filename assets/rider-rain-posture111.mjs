import {prepareRainPosture110} from './rider-rain-posture110.mjs?v=rain-posture110-20261023';
import {relaxedOnFootFingerPose} from './rider-natural-hand-pose.js?v=character-finish68-20261010';
import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';

const prepared=new WeakSet();let identityState=0x111c4a17;
export function prepareRainPosture111(T,kit){
 if(kit.body!=='f'||prepared.has(kit))return kit;
 const previous=Math.random;Math.random=()=>{identityState^=identityState<<13;identityState^=identityState>>>17;identityState^=identityState<<5;return(identityState>>>0)/4294967296;};
 try{prepareRainPosture110(T,kit);bakeIdle(T,kit);prepared.add(kit);return kit;}finally{Math.random=previous;}
}
function bakeIdle(T,kit){
 const source=kit.clips.Idle_Loop;if(!source)return;
 const scene=kit.scene,B=kit.bones,V=(...v)=>new T.Vector3(...v),Q=()=>new T.Quaternion(),rad=T.MathUtils.degToRad;
 const saved=new Map(Object.entries(B).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 const restore=()=>{for(const[n,r]of saved){B[n].position.copy(r.p);B[n].quaternion.copy(r.q);B[n].scale.copy(r.s);}scene.updateMatrixWorld(true);};
 const point=n=>B[n].getWorldPosition(V()),world=n=>B[n].getWorldQuaternion(Q());
 const setWorld=(n,q)=>{B[n].quaternion.copy(B[n].parent.getWorldQuaternion(Q()).invert().multiply(q)).normalize();B[n].updateMatrixWorld(true);};
 const setPosition=(n,p)=>{B[n].position.copy(B[n].parent.worldToLocal(p.clone()));B[n].updateMatrixWorld(true);};
 const aim=(n,child,to)=>{const from=point(child).sub(point(n)).normalize();setWorld(n,Q().setFromUnitVectors(from,to.clone().normalize()).multiply(world(n)));};
 const mixer=new T.AnimationMixer(scene),action=mixer.clipAction(source);action.play();mixer.setTime(0);scene.updateMatrixWorld(true);
 const base=new Map(Object.entries(B).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}])),pelvis=point('pelvis'),headWorld=world('Head'),torsoWorld=new Map(['spine_01','spine_02','spine_03'].map(n=>[n,world(n)])),torso=new Map();
 // Foot frames are captured once. Neither foot follows the hip sway or twists
 // with the knee: the leg chains solve back to these planted source frames.
 const feet=Object.fromEntries(['l','r'].map(s=>[s,{p:point('foot_'+s),q:world('foot_'+s),toe:base.get('ball_'+s).q.clone()}]));
 const fingerLow=relaxedOnFootFingerPose(T,scene,B,kit.seat,.72),fingerHigh=relaxedOnFootFingerPose(T,scene,B,kit.seat,.82);
 const poseNames=['pelvis','spine_01','spine_02','spine_03','neck_01','Head','clavicle_l','clavicle_r',...['upperarm','lowerarm','hand','thigh','calf','foot','ball'].flatMap(n=>[n+'_l',n+'_r']),...fingerLow.keys()];
 const rotations=new Map(poseNames.map(n=>[n,[]])),positions=[],times=[],duration=6,count=180,arms=new Map();
 const lengths=Object.fromEntries(['l','r'].map(s=>[s,{a:point('thigh_'+s).distanceTo(point('calf_'+s)),b:point('calf_'+s).distanceTo(point('foot_'+s))}]));
 const report={duration,samples:count+1,weightSide:'right',hipShiftM:.019,ankleErrorMaxM:0,sourceSoleDriftMaxM:0,kneeFlexDegrees:{l:[Infinity,-Infinity],r:[Infinity,-Infinity]},elbowFlexDegrees:{l:[Infinity,-Infinity],r:[Infinity,-Infinity]},fingerRelaxationScale:[.73,.78],armClearanceCorrectionDeg:{},handPantsClearanceM:{l:Infinity,r:Infinity},walkingAndSeatUnchanged:true,sourceFootFramesPlanted:true};
 let shoeProxy=null,shoeMaterial=null,soleSamples=null,handProxy=null,pantsProxy=null,pantsSurface=null,handIds=null;
 if(kit.rain109){
  let shoes;kit.rain109.scene.traverse(m=>{if(m.isMesh&&m.name==='Rain_shoes')shoes=m;});
  if(shoes){
   shoeMaterial=new T.MeshBasicMaterial();shoeProxy=new T.SkinnedMesh(shoes.geometry,shoeMaterial);shoeProxy.bind(kit.skin.skeleton,kit.skin.bindMatrix);kit.skin.parent.add(shoeProxy);scene.updateMatrixWorld(true);
   const a=shoes.geometry.attributes,names=kit.skin.skeleton.bones.map(b=>b.name);soleSamples={};
   for(const s of['l','r']){const rows=[];for(let i=0;i<a.position.count;i++){let own=0;for(let k=0;k<4;k++)if(['foot_'+s,'ball_'+s].includes(names[a.skinIndex.getComponent(i,k)]))own+=a.skinWeight.getComponent(i,k);if(own>.8){const p=shoeProxy.getVertexPosition(i,V()).applyMatrix4(shoeProxy.matrixWorld);rows.push({i,p});}}const low=Math.min(...rows.map(x=>x.p.y)),ids=rows.filter(x=>x.p.y<low+.004);soleSamples[s]=ids.map(x=>({id:x.i,p:x.p.clone()}));}
  }
  let body;kit.rain109.scene.traverse(m=>{if(m.isMesh&&m.name==='Rain_body')body=m;});
  if(body&&kit.connectedWardrobe?.breeches99Geometry){
   shoeMaterial=shoeMaterial||new T.MeshBasicMaterial();handProxy=new T.SkinnedMesh(body.geometry,shoeMaterial);handProxy.bind(kit.skin.skeleton,kit.skin.bindMatrix);pantsProxy=new T.SkinnedMesh(kit.connectedWardrobe.breeches99Geometry,shoeMaterial);pantsProxy.bind(kit.skin.skeleton,kit.skin.bindMatrix);kit.skin.parent.add(handProxy,pantsProxy);
   const a=body.geometry.attributes,names=kit.skin.skeleton.bones.map(b=>b.name);handIds={l:[],r:[]};
   for(let i=0;i<a.position.count;i++)for(const s of['l','r']){let own=0;for(let k=0;k<4;k++){const n=names[a.skinIndex.getComponent(i,k)]||'';if(n.endsWith('_'+s)&&/^(hand|index|middle|ring|pinky|thumb)_/.test(n))own+=a.skinWeight.getComponent(i,k);}if(own>.8)handIds[s].push(i);}
  }
 }
 const flex=(a,b,c)=>180-T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(point(a).sub(point(b)).normalize().dot(point(c).sub(point(b)).normalize()),-1,1)));
 function solveLeg(s,target){
  const H=point('thigh_'+s),a=lengths[s].a,b=lengths[s].b,axis=target.clone().sub(H),D=Math.min(a+b-.00001,Math.max(Math.abs(a-b)+.00001,axis.length()));axis.normalize();
  const projection=(a*a-b*b+D*D)/(2*D),height=Math.sqrt(Math.max(0,a*a-projection*projection)),side=s==='l'?1:-1,pole=V(side*.06,-.35,.32);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const K=H.clone().addScaledVector(axis,projection).addScaledVector(pole,height);aim('thigh_'+s,'calf_'+s,K.sub(H));aim('calf_'+s,'foot_'+s,target.clone().sub(point('calf_'+s)));setWorld('foot_'+s,feet[s].q);B['ball_'+s].quaternion.copy(feet[s].toe);B['ball_'+s].updateMatrixWorld(true);
  report.ankleErrorMaxM=Math.max(report.ankleErrorMaxM,point('foot_'+s).distanceTo(target));
 }
 function handClearance(s){
  const side=s==='l'?1:-1;let min=Infinity;for(const id of handIds[s]){const p=handProxy.getVertexPosition(id,V()).applyMatrix4(handProxy.matrixWorld),hit=pantsSurface.cast(V(side*.6,p.y,p.z),V(-side,0,0),h=>h.point.x*side>0,.6);if(hit)min=Math.min(min,p.x*side-hit.point.x*side);}return min;
 }
 function fitActualHands(deltas){
  if(!pantsProxy||!handProxy)return;
  const sourceGeometry=pantsProxy.geometry,p=new Float32Array(sourceGeometry.attributes.position.count*3);for(let i=0;i<p.length/3;i++)pantsProxy.getVertexPosition(i,V()).applyMatrix4(pantsProxy.matrixWorld).toArray(p,i*3);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));g.setIndex(sourceGeometry.index);pantsSurface=createTriangleSurface(T,g);g.dispose();
  for(const s of['l','r']){
   const n='upperarm_'+s,side=s==='l'?1:-1,original=world(n),margin=.030;
   const test=a=>{setWorld(n,Q().setFromAxisAngle(V(0,0,1),side*a).multiply(original));scene.updateMatrixWorld(true);kit.skin.skeleton.update();return handClearance(s);};
   let lo=0,hi=rad(25);if(test(0)<margin){if(test(hi)<margin)throw Error('Rain hand cannot clear its pants within a relaxed arm range: '+s);for(let j=0;j<9;j++){const mid=(lo+hi)*.5;if(test(mid)<margin)lo=mid;else hi=mid;}test(hi);}else{hi=0;test(0);}
   arms.set(n,B[n].quaternion.clone().multiply(deltas.get(n).clone().invert()));report.armClearanceCorrectionDeg[s]=T.MathUtils.radToDeg(hi);
  }
 }
 try{
  // Balance the upright rib cage above the shifted pelvis once. Subsequent
  // breathing is local animation, not a frame-by-frame world constraint.
  aim('pelvis','spine_01',V(-Math.sin(rad(3.2)),Math.cos(rad(3.2)),Math.tan(rad(3))));setWorld('pelvis',Q().setFromAxisAngle(V(0,1,0),rad(.8)).multiply(world('pelvis')));
  for(const n of['spine_01','spine_02','spine_03']){setWorld(n,Q().setFromAxisAngle(V(0,0,1),rad(-1.2)).multiply(torsoWorld.get(n)));torso.set(n,B[n].quaternion.clone());}
  // Establish asymmetry once in the local shoulder frame. During the loop the
  // arms inherit breathing and counter-sway, with their own small soft motion.
  // Re-aiming both arms to fixed world vectors every frame caused the old pose.
  for(const side of[1,-1]){
   const s=side>0?'l':'r',upper='upperarm_'+s,lower='lowerarm_'+s,hand='hand_'+s;
   aim(upper,lower,V(side*(side>0?.075:.13),-1,side>0?.035:-.025));aim(lower,hand,V(side*.025,-1,side>0?.17:.27));
   B[hand].quaternion.copy(kit.seat.restLocal.get(hand).q);B[hand].updateMatrixWorld(true);
   const axis=point(hand).sub(point(lower)).normalize(),width=point('index_01_'+s).sub(point('pinky_01_'+s));width.addScaledVector(axis,-width.dot(axis)).normalize();const target=V(0,0,1).addScaledVector(axis,-axis.z).normalize(),angle=Math.atan2(axis.dot(V().crossVectors(width,target)),width.dot(target));setWorld(lower,Q().setFromAxisAngle(axis,angle).multiply(world(lower)));aim(hand,'middle_01_'+s,V(side*.045,-1,side>0?.075:.13));
   for(const n of[upper,lower,hand])arms.set(n,B[n].quaternion.clone());
  }
  for(let i=0;i<=count;i++){
   const t=duration*i/count,ph=2*Math.PI*i/count,breath=Math.sin(ph),slow=Math.sin(ph+.6),sway=Math.sin(ph-1.0);
   for(const[n,r]of base){B[n].position.copy(r.p);B[n].quaternion.copy(r.q);}scene.updateMatrixWorld(true);
   // A modest absolute weight shift, with the support hip a little higher.
   // The opposite knee softens because both feet remain in their own frames.
   setPosition('pelvis',pelvis.clone().add(V(.019+.0022*sway,0,.0018*slow)));
   const roll=rad(3.2+.25*slow),pitch=rad(3.0+.35*breath);aim('pelvis','spine_01',V(-Math.sin(roll),Math.cos(roll),Math.tan(pitch)));
   setWorld('pelvis',Q().setFromAxisAngle(V(0,1,0),rad(.8+.35*slow)).multiply(world('pelvis')));
   const H=point('thigh_l'),target=feet.l.p,L=lengths.l,soft=rad(5.5+.7*breath),reach=Math.sqrt(L.a*L.a+L.b*L.b+2*L.a*L.b*Math.cos(soft)),horizontal=(H.x-target.x)**2+(H.z-target.z)**2,wantedY=target.y+Math.sqrt(Math.max(.01,reach*reach-horizontal)),P=point('pelvis');P.y+=wantedY-H.y;setPosition('pelvis',P);
   for(const s of['l','r'])solveLeg(s,feet[s].p);
   // Slow small motion is local to the torso, so shoulders and elbows breathe
   // with the body rather than remaining frozen in the world frame.
   for(const[n,x,y,z]of[['spine_01',.40*breath,-.28*slow,-.25*slow],['spine_02',.35*breath,.28*slow,0],['spine_03',-.45*breath,-.40*slow,.20*slow]])B[n].quaternion.copy(torso.get(n)).multiply(Q().setFromEuler(new T.Euler(rad(x),rad(y),rad(z))));
   const armDeltas=new Map();
   for(const side of[1,-1]){
    const s=side>0?'l':'r',a=ph+(side>0?.25:1.2),cl='clavicle_'+s;B[cl].quaternion.copy(base.get(cl).q).multiply(Q().setFromEuler(new T.Euler(rad(.22*Math.sin(a)),rad(.35*Math.sin(a)),rad(side*.25*Math.sin(a)))));
    for(const[n,x,y,z]of[['upperarm_'+s,.60*Math.sin(a),.25*Math.sin(a+.3),side*.35*Math.sin(a)],['lowerarm_'+s,.70*Math.sin(a+.45),.30*Math.sin(a+.8),0],['hand_'+s,.50*Math.sin(a+.8),.60*Math.sin(a+.4),side*.65*Math.sin(a+.6)]]){const delta=Q().setFromEuler(new T.Euler(rad(x),rad(y),rad(z)));B[n].quaternion.copy(arms.get(n)).multiply(delta);armDeltas.set(n,delta);}
   }
   for(const[n,q]of fingerLow){const offset=n.endsWith('_l')?.4:1.5,amount=.35+.25*Math.sin(ph+offset);B[n].quaternion.copy(q).slerp(fingerHigh.get(n),amount);}
   scene.updateMatrixWorld(true);setWorld('Head',headWorld.clone().multiply(Q().setFromEuler(new T.Euler(rad(.55*breath),rad(1.0*slow),rad(.25*sway)))));scene.updateMatrixWorld(true);kit.skin.skeleton.update();
   if(i===0)fitActualHands(armDeltas);
   if(pantsSurface&&i%22===0)for(const s of['l','r'])report.handPantsClearanceM[s]=Math.min(report.handPantsClearanceM[s],handClearance(s));
   for(const s of['l','r']){const knee=flex('thigh_'+s,'calf_'+s,'foot_'+s),elbow=flex('upperarm_'+s,'lowerarm_'+s,'hand_'+s);report.kneeFlexDegrees[s][0]=Math.min(report.kneeFlexDegrees[s][0],knee);report.kneeFlexDegrees[s][1]=Math.max(report.kneeFlexDegrees[s][1],knee);report.elbowFlexDegrees[s][0]=Math.min(report.elbowFlexDegrees[s][0],elbow);report.elbowFlexDegrees[s][1]=Math.max(report.elbowFlexDegrees[s][1],elbow);if(shoeProxy)for(const sample of soleSamples[s])report.sourceSoleDriftMaxM=Math.max(report.sourceSoleDriftMaxM,shoeProxy.getVertexPosition(sample.id,V()).applyMatrix4(shoeProxy.matrixWorld).distanceTo(sample.p));}
   times.push(t);positions.push(...B.pelvis.position.toArray());for(const n of poseNames){const q=B[n].quaternion,a=rotations.get(n),k=a.length;if(k&&q.x*a[k-4]+q.y*a[k-3]+q.z*a[k-2]+q.w*a[k-1]<0)a.push(-q.x,-q.y,-q.z,-q.w);else a.push(q.x,q.y,q.z,q.w);}
  }
  const replaced=new Set([...poseNames.map(n=>n+'.quaternion'),'pelvis.position']),tracks=source.tracks.filter(t=>!replaced.has(t.name)).map(t=>{const x=t.clone();x.times=Float32Array.from(x.times,v=>v*duration/source.duration);return x;});
  for(const[n,a]of rotations){a.splice(a.length-4,4,...a.slice(0,4));tracks.push(new T.QuaternionKeyframeTrack(n+'.quaternion',times,a));}positions.splice(positions.length-3,3,...positions.slice(0,3));tracks.push(new T.VectorKeyframeTrack('pelvis.position',times,positions));kit.clips.Idle_Loop=new T.AnimationClip(source.name,duration,tracks);kit.rainPosture111=report;
 }finally{mixer.stopAllAction();mixer.uncacheRoot(scene);shoeProxy?.removeFromParent();handProxy?.removeFromParent();pantsProxy?.removeFromParent();pantsSurface?.dispose();shoeMaterial?.dispose();restore();kit.skin.skeleton.update();}
}
