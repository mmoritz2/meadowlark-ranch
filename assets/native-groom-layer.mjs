// Hair-only inertial response on the verified native WildMesh skin.
import {createFrameGroomInertia} from './frame-inertia.mjs?v=native-secondary-1';
import {NATIVE_GROOM_PROFILE_IDS,NATIVE_GROOM_HIERARCHY,NATIVE_GROOM_AUDIT} from './native-groom-controls.mjs?v=native-secondary-1';

// An additive Fjord crest may reuse the audited hair controls only when every
// influence is copied exactly from an original mane/forelock donor. A tag alone
// never exempts an extra mesh from the native topology gate.
function verifiedFjordCrest(mesh,hair,profile){
 const groom=profile.nativeVariant?.groom?.uprightCrest,shell=groom?.shell,attrs=mesh.geometry?.attributes;
 if(profile.nativeVariant?.id!=='fjord'||shell?.version!==1||shell.space!=='native-source-mesh'||!attrs)return false;
 const count=attrs.position?.count,index=mesh.geometry.index;
 if(!Number.isInteger(count)||count<4||count>2048||count!==shell.vertexCount||!index||index.itemSize!==1||index.count!==shell.indexCount||index.count<3||index.count>12000||index.count%3)return false;
 for(const [name,size]of [['position',3],['normal',3],['uv',2],['skinIndex',4],['skinWeight',4],['nativeFjordOuter',1],['nativeFjordSourceVertex',1]]){
  const a=attrs[name];if(!a||a.itemSize!==size||a.count!==count||a.normalized||!a.array.every(Number.isFinite))return false;
 }
 if(index.array.some(i=>!Number.isInteger(i)||i<0||i>=count)||attrs.nativeFjordOuter.array.some(v=>v<0||v>1))return false;
 if(mesh.parent!==hair.parent||mesh.bindMode!==hair.bindMode||!mesh.position.equals(hair.position)||!mesh.quaternion.equals(hair.quaternion)||!mesh.scale.equals(hair.scale)||!mesh.bindMatrix.equals(hair.bindMatrix))return false;
 const bones=mesh.skeleton?.bones,inverses=mesh.skeleton?.boneInverses;
 if(bones?.length!==677||inverses?.length!==677||bones.some((b,i)=>b!==hair.skeleton.bones[i]||!inverses[i].equals(hair.skeleton.boneInverses[i])))return false;
 const donorMask=new Uint8Array(23514);
 if(!Array.isArray(groom.colorCards)||!groom.colorCards.length)return false;
 for(const card of groom.colorCards){if(!Number.isInteger(card.start)||!Number.isInteger(card.count)||card.start<0||card.count<1||card.start+card.count>donorMask.length)return false;donorMask.fill(1,card.start,card.start+card.count);}
 hair.updateWorldMatrix(true,false);const sourceScale=hair.matrixWorld.getMaxScaleOnAxis();if(!Number.isFinite(sourceScale)||sourceScale<=0)return false;
 const source=hair.geometry.attributes;
 for(let i=0;i<count;i++){
  const donor=attrs.nativeFjordSourceVertex.getX(i);
  if(!Number.isInteger(donor)||!donorMask[donor])return false;
  let distanceSquared=0;for(let c=0;c<3;c++)distanceSquared+=(attrs.position.getComponent(i,c)-source.position.getComponent(donor,c))**2;
  if(distanceSquared*sourceScale*sourceScale>.25)return false; // half-metre envelope after native centimetre normalization
  for(let c=0;c<4;c++)if(attrs.skinIndex.getComponent(i,c)!==source.skinIndex.getComponent(donor,c)||attrs.skinWeight.getComponent(i,c)!==source.skinWeight.getComponent(donor,c))return false;
 }
 return true;
}

/** One-time, fail-closed verification of the original skin and optional crest. */
export function validateNativeGroomRig(rig){
 try{
  if(!rig?.profile?.nativeBreed||rig.profile.nativeKind!=='horse'||!(rig.profile.nativeRoster||NATIVE_GROOM_PROFILE_IDS.includes(rig.profile.id||rig.key)))return {eligible:false,reason:'Unverified native profile'};
  const root=rig.nativeRoot;if(!root)return {eligible:false,reason:'Missing original native root'};
  const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  const crests=meshes.filter(m=>m.userData?.nativeFjordCrest===true),sourceMeshes=meshes.filter(m=>!crests.includes(m));
  const expectedCounts=[2028,5092,13895,16159,23514],counts=sourceMeshes.map(m=>m.geometry?.attributes?.position?.count).sort((a,b)=>a-b);
  if(counts.length!==5||counts.some((n,i)=>n!==expectedCounts[i]))return {eligible:false,reason:'Unverified five-mesh topology'};
  const hair=sourceMeshes.find(m=>m.geometry.attributes.position.count===23514);
  if(crests.length>1||crests.some(m=>!verifiedFjordCrest(m,hair,rig.profile)))return {eligible:false,reason:'Unverified additive Fjord crest'};
  const hierarchy=new Map(NATIVE_GROOM_HIERARCHY),safe=new Set(NATIVE_GROOM_AUDIT.controls.map(s=>s.name)),boneMap={};
  for(const mesh of meshes){
   const bones=mesh.skeleton?.bones;
   if(bones?.length!==677||new Set(bones.map(b=>b.name)).size!==677)return {eligible:false,reason:'Unverified native skeleton size'};
   for(const b of bones){
    if(!hierarchy.has(b.name)||(b.parent?.name??null)!==hierarchy.get(b.name))return {eligible:false,reason:'Unverified native joint hierarchy'};
    if(boneMap[b.name]&&boneMap[b.name]!==b)return {eligible:false,reason:'Multiple unrelated native skins'};
    boneMap[b.name]=b;
   }
   const attrs=mesh.geometry.attributes,J=attrs.skinIndex,W=attrs.skinWeight;
   // These verified assets use one complete four-influence set. Fail closed on new sets.
   if(!J||!W||J.itemSize!==4||W.itemSize!==4||J.count!==W.count||W.count!==attrs.position.count||Object.keys(attrs).some(k=>/^(skinIndex|skinWeight|joints_|weights_)/i.test(k)&&k!=='skinIndex'&&k!=='skinWeight'))return {eligible:false,reason:'Unverified source influence attributes'};
   const isHair=attrs.position.count===23514||crests.includes(mesh);
   for(let i=0;i<W.count;i++)for(let c=0;c<4;c++){
    const weight=W.getComponent(i,c),index=J.getComponent(i,c);
    if(!Number.isFinite(weight)||weight<0||!Number.isInteger(index)||index<0||index>=bones.length)return {eligible:false,reason:'Invalid source skin influence'};
    if(weight>0&&!isHair){
     for(let b=bones[index];b;b=b.parent)if(safe.has(b.name))return {eligible:false,reason:'Non-hair-weighted control or descendant'};
    }
   }
  }
  for(const spec of NATIVE_GROOM_AUDIT.controls)if(!boneMap[spec.name]||boneMap[spec.name].parent?.name!==spec.parent)return {eligible:false,reason:'Missing audited groom control'};
  return {eligible:true,reason:crests.length?'Verified WildMesh677 skin and donor-bound Fjord crest':'Verified WildMesh677 original skin',root,boneMap,controls:58};
 }catch(error){return {eligible:false,reason:'Native groom validation failed: '+String(error?.message||error)};}
}

/** Call beforePose before the existing motion update and afterPose once after it. */
export function createNativeGroomLayer({THREE,rig}={}){
 const validation=validateNativeGroomRig(rig);if(!validation.eligible||!THREE)return null;
 const core=createFrameGroomInertia({THREE,root:validation.root,audit:NATIVE_GROOM_AUDIT,boneMap:validation.boneMap});
 let disposed=false,armed=false,reseededIntervals=0;
 function beforePose(){if(disposed)return;core.beforePose();armed=true;}
 function afterPose(dt){
  if(disposed)return;
  // A missing restore hook must never compound last frame's additive pose.
  if(!armed)return;armed=false;
  if(!Number.isFinite(dt)||dt<0||dt>.25){
   // Sample the NEW authored pose before clearing, so reset cannot restore stale source.
   core.afterPose(0);core.reset();validation.root.updateMatrixWorld(true);reseededIntervals++;return snapshot();
  }
  core.afterPose(dt);return snapshot();
 }
 function reset(){if(disposed)return;core.reset();validation.root.updateMatrixWorld(true);armed=false;}
 function snapshot(){return {...core.snapshot(),adapterDisposed:disposed,reseededIntervals,eligibleProfile:rig.profile.id||rig.key,sourceControllerUpdatesOwned:0};}
 return {beforePose,afterPose,reset,snapshot,validation:{eligible:true,controls:58},dispose(){if(disposed)return;core.dispose();armed=false;disposed=true;}};
}
