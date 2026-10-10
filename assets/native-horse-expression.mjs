/* Restrained expressions on the verified native horse's existing controls.
 * Each frame restores the mixer's unmodified pose before adding anything;
 * clips, bind matrices, geometry and the actor transform remain untouched. */
const LIDS=[['l','uppereyelid_l_086','lowereyelid_l_089','eye_l_059'],['r','uppereyelid_r_092','lowereyelid_r_095','eye_r_063']];
const EARS=['ear_01_l_051','ear_01_r_055'];
const CHEST=[['chestiddleslider_00_0191',[0,.002,0]],['chestiddleslider_01_r_0194',[-.004,0,0]],['chestiddleslider_02_0197',[0,-.0025,0]],['chestiddleslider_01_l_0200',[.004,0,0]]];
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0,smooth=v=>{v=clamp(v);return v*v*(3-2*v);},D=Math.PI/180;
const pulse=(t,start,duration)=>t<start||t>start+duration?0:Math.sin(Math.PI*(t-start)/duration)**2;
const blinkPulse=t=>t<0||t>.23?0:t<.07?smooth(t/.07):t<.095?1:1-smooth((t-.095)/.135);
function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0)/4294967296;}
export function sampleNativeHorseExpression(time,seed=0){
 const t=Math.max(0,time)+seed*2.1,b=t%18.7,ear=t%13.8;
 return {blink:Math.max(...[2.4,7.9,13.5,13.84].map(start=>blinkPulse(b-start))),
  leftEar:pulse(ear,.9,1.8)-.42*pulse(ear,8.2,1.4),rightEar:pulse(ear,4.7,1.6)-.35*pulse(ear,10.3,1.5),
  breath:(1-Math.cos(t*Math.PI*2/4.6))*.5};
}
const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
export function createNativeHorseExpression({THREE,root,profile,seed=hash((profile?.id||'')+'|'+(root?.uuid||''))}={}){
 if(!THREE||!root||profile?.nativeExpressions===false||!profile?.nativeBreed||profile.nativeKind!=='horse')return null;
 const body=[];root.traverse(o=>{if(o.isSkinnedMesh&&o.geometry?.attributes.position?.count===16159)body.push(o);});
 if(body.length!==1||body[0].skeleton?.bones.length!==677)return null;
 const skin=body[0],head=root.getObjectByName('head_019'),names=[...EARS,...LIDS.flatMap(row=>row.slice(1,3)),...CHEST.map(row=>row[0])],bones=names.map(n=>root.getObjectByName(n));
 if(!head?.isBone||bones.some(b=>!b?.isBone||!skin.skeleton.bones.includes(b)))return null;
 if(bones.slice(0,6).some(b=>b.parent!==head)||bones.slice(6).some(b=>b.parent?.name!=='chest_correctiveRoot_0190'))return null;
 root.updateWorldMatrix(true,true);
 const rootQ=root.getWorldQuaternion(new THREE.Quaternion()),sourceUp=new THREE.Vector3(0,1,0).applyQuaternion(rootQ),headInverse=head.getWorldQuaternion(new THREE.Quaternion()).invert();
 const indices=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,p=new THREE.Vector3();
 // Calibrate a closing hinge from each eye's real optical axis, then measure
 // its central lid surfaces. Mirrored eyes intentionally have opposite axes.
 const lids=[];
 function fitLid([side,upperName,lowerName,eyeName]){
  const eye=root.getObjectByName(eyeName),upper=root.getObjectByName(upperName),lower=root.getObjectByName(lowerName);
  if(!eye?.isBone||eye.parent!==head||!eye.children[0]?.isBone)return null;
  const centre=eye.getWorldPosition(new THREE.Vector3());
  const out=eye.children[0].getWorldPosition(new THREE.Vector3()).sub(centre).normalize(),axis=new THREE.Vector3().crossVectors(out,sourceUp).normalize(),up=new THREE.Vector3().crossVectors(axis,out).normalize();
  if(axis.lengthSq()<.99)return null;
  const surfaces=[];
  for(const bone of [upper,lower]){
   const joint=skin.skeleton.bones.indexOf(bone),points=[];
   for(let i=0;i<indices.count;i++){
    let w=0;for(let c=0;c<4;c++)if(indices.getComponent(i,c)===joint)w+=weights.getComponent(i,c);
    if(w<.97)continue;
    skin.getVertexPosition(i,p);p.applyMatrix4(skin.matrixWorld).sub(centre);
    points.push({index:i,radius:p.length(),out:p.dot(out),up:p.dot(up),side:p.dot(axis)});
   }
   if(points.length<4)return null;
   const radius=median(points.map(v=>v.radius)),central=points.filter(v=>Math.abs(v.side)<radius*.32&&v.out>radius*.6);
   if(central.length<2)return null;
   surfaces.push({radius,angle:median(central.map(v=>Math.atan2(v.up,v.out))),indices:central.map(v=>v.index)});
  }
  const gap=surfaces[0].angle-surfaces[1].angle;
  // A malformed/unrelated facial rig must never get a guessed closing pose.
  if(!(gap>35*D&&gap<95*D)||Math.abs(surfaces[0].radius/surfaces[1].radius-1)>.6)return null;
  const pivot=head.worldToLocal(centre.clone());
  return {side,upper,lower,pivot,axis:axis.applyQuaternion(headInverse).normalize(),upperAngle:-gap*.76,lowerAngle:gap*.24,
   calibration:{side,pivot:pivot.toArray(),gapDegrees:gap/D,upperDegrees:gap*.76/D,lowerDegrees:gap*.24/D,upper:surfaces[0].indices,lower:surfaces[1].indices}};
 }
 // Sculpted conformations move lid skin without its original pivot. Keep
 // listening/breathing, but do not invent a closing pose for those surfaces.
 if(!profile.nativeVariant){const fitted=LIDS.map(fitLid);if(fitted.every(Boolean))lids.push(...fitted);}
 const blinkSupported=lids.length===2;
 const calibration=Object.freeze(lids.map(l=>Object.freeze({...l.calibration,pivot:Object.freeze([...l.calibration.pivot]),upper:Object.freeze([...l.calibration.upper]),lower:Object.freeze([...l.calibration.lower])})));
 const blinkOwnership=new WeakMap();
 function authoredBlinkWeight(active){
  let weight=0;for(const [action,w]of active){const clip=action.getClip();if(!blinkOwnership.has(clip)){let owns=false;for(const track of clip.tracks){if(!/^(upper|lower)eyelid_[lr]_\d+\.(position|quaternion|scale)$/.test(track.name))continue;const size=track.getValueSize();for(let i=size;i<track.values.length;i++)if(Math.abs(track.values[i]-track.values[i%size])>.001){owns=true;break;}}blinkOwnership.set(clip,owns);}if(blinkOwnership.get(clip))weight+=w;}return clamp(weight);
 }
 const records=bones.map(bone=>({bone,p:bone.position.clone(),q:bone.quaternion.clone()}));
 const earBasis=headInverse.clone().multiply(rootQ),earInverse=earBasis.clone().invert(),q=new THREE.Quaternion(),euler=new THREE.Euler(0,0,0,'YXZ');
 const chest=CHEST.map(([name,offset])=>{const bone=root.getObjectByName(name),sourceToParent=new THREE.Matrix4().copy(bone.parent.matrixWorld).invert().multiply(root.matrixWorld);return{bone,delta:new THREE.Vector3(...offset).applyMatrix3(new THREE.Matrix3().setFromMatrix4(sourceToParent))};});
 let applied=false,disposed=false,time=0,last={blink:0,leftEar:0,rightEar:0,breath:0},lastWeights={blink:0,ears:0,breathing:0};
 function beforePose(){if(!applied)return;for(const r of records){r.bone.position.copy(r.p);r.bone.quaternion.copy(r.q);}applied=false;}
 function afterPose(dt,{blink=0,ears=0,breathing=0}={}){
  if(disposed)return;if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid horse expression delta');
  // Also make repeated afterPose calls harmless for tools that sample a pose.
  beforePose();time+=dt;last=sampleNativeHorseExpression(time,seed);lastWeights={blink:blinkSupported?clamp(blink):0,ears:clamp(ears),breathing:clamp(breathing)};
  if(!(last.blink*lastWeights.blink)&&!((last.leftEar||last.rightEar)*lastWeights.ears)&&!(last.breath*lastWeights.breathing))return;
  for(const r of records){r.p.copy(r.bone.position);r.q.copy(r.bone.quaternion);}
  for(const lid of lids){const amount=last.blink*lastWeights.blink;for(const [bone,angle]of [[lid.upper,lid.upperAngle],[lid.lower,lid.lowerAngle]]){q.setFromAxisAngle(lid.axis,angle*amount);bone.quaternion.premultiply(q).normalize();}}
  EARS.forEach((name,i)=>{const amount=(i?last.rightEar:last.leftEar)*lastWeights.ears;if(!amount)return;const bone=root.getObjectByName(name);q.setFromEuler(euler.set(-2*D*amount,(i?-6:7)*D*amount,(i?-1:1)*D*amount));q.premultiply(earBasis).multiply(earInverse);bone.quaternion.premultiply(q).normalize();});
  for(const r of chest)r.bone.position.addScaledVector(r.delta,last.breath*lastWeights.breathing);
  applied=true;root.updateMatrixWorld(true);
 }
 function reset(){beforePose();time=0;last={blink:0,leftEar:0,rightEar:0,breath:0};lastWeights={blink:0,ears:0,breathing:0};}
 return {beforePose,afterPose,reset,authoredBlinkWeight,snapshot:()=>({enabled:!disposed,blinkSupported,time,...last,weights:{...lastWeights},controls:records.length,calibration}),dispose(){if(disposed)return;reset();disposed=true;}};
}
