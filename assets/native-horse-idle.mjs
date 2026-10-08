/* A restrained, separately authored standing expression for the two native Bay
 * horses without an Idle clip. No source animation, geometry or bind is edited.
 * The ordinary mixer blends these upper-body bindings before the groom runs. */
const IDS=new Set(['bay-western','bay-sporthorse-native']);
const CHEST=[['chestiddleslider_00_0191',[0,.002,0]],['chestiddleslider_01_r_0194',[-.0045,0,0]],['chestiddleslider_02_0197',[0,-.0035,0]],['chestiddleslider_01_l_0200',[.0045,0,0]]];
const ROTATIONS=['neck_03_016','head_019','ear_01_l_051','ear_01_r_055'];
const D=Math.PI/180;
function attention(p,start,end){if(p<=start||p>=end)return 0;return Math.sin(Math.PI*(p-start)/(end-start))**2;}
export function createNativeHorseIdle({THREE,root,profile}={}){
 if(!THREE||!root||!profile?.nativeBreed||profile.nativeKind!=='horse'||profile.nativeIdleClip||!IDS.has(profile.id))return null;
 const controls=[...CHEST.map(([name])=>name),...ROTATIONS],bones=controls.map(name=>root.getObjectByName(name));
 const skins=[];root.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
 if(bones.some(b=>!b?.isBone)||!skins.some(m=>m.geometry?.attributes.position.count===16159)||skins.some(m=>m.skeleton?.bones.length!==677))return null;
 // Names alone are insufficient: these chest sliders must stay on their small
 // corrective branches, never the spine/leg chain or a different rig's controls.
 if(CHEST.some(([name])=>root.getObjectByName(name).parent?.name!=='chest_correctiveRoot_0190')||root.getObjectByName('neck_03_016').parent?.name!=='neck_02_015'||root.getObjectByName('head_019').parent?.name!=='neck_05_018'||ROTATIONS.slice(2).some(name=>root.getObjectByName(name).parent?.name!=='head_019'))return null;
 root.updateWorldMatrix(true,true);
 const rootQ=root.getWorldQuaternion(new THREE.Quaternion()),duration=12,frames=240,times=Array.from({length:frames+1},(_,i)=>i/frames*duration),tracks=[];
 for(const [name,offset]of CHEST){
  const bone=root.getObjectByName(name),rest=bone.position.clone();
  const sourceToParent=new THREE.Matrix4().copy(bone.parent.matrixWorld).invert().multiply(root.matrixWorld);
  const delta=new THREE.Vector3(...offset).applyMatrix3(new THREE.Matrix3().setFromMatrix4(sourceToParent)),values=[];
  for(let i=0;i<=frames;i++){const breath=i===frames?0:(1-Math.cos(6*Math.PI*i/frames))*.5;values.push(rest.x+delta.x*breath,rest.y+delta.y*breath,rest.z+delta.z*breath);}
  tracks.push(new THREE.VectorKeyframeTrack(name+'.position',times,values));
 }
 for(const name of ROTATIONS){
  const bone=root.getObjectByName(name),rest=bone.quaternion.clone(),basis=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ),inverse=basis.clone().invert(),values=[],q=new THREE.Quaternion(),euler=new THREE.Euler(0,0,0,'YXZ');
  for(let i=0;i<=frames;i++){
   const p=i===frames?0:i/frames,breath=(1-Math.cos(6*Math.PI*p))*.5;let pitch=0,yaw=0,roll=0;
   if(name==='neck_03_016')pitch=.18*breath+.14*Math.sin(2*Math.PI*p);
   else if(name==='head_019'){pitch=.28*breath+.22*Math.sin(4*Math.PI*p);yaw=.48*Math.sin(2*Math.PI*p);}
   else {const left=name==='ear_01_l_051',turn=attention(p,left?.13:.57,left?.34:.81);pitch=-2.2*turn;yaw=(left?5.5:-4.5)*turn;roll=(left?1:-1)*turn;}
   q.setFromEuler(euler.set(pitch*D,yaw*D,roll*D)).premultiply(basis).multiply(inverse).multiply(rest).normalize();
   if(values.length&&q.dot(new THREE.Quaternion().fromArray(values,values.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);
   values.push(...q.toArray());
  }
  tracks.push(new THREE.QuaternionKeyframeTrack(name+'.quaternion',times,values));
 }
 return {clip:new THREE.AnimationClip('Meadowlark | Quiet Stand',duration,tracks),controls:Object.freeze(controls),source:'Original rest expression; no creator Idle copied'};
}
