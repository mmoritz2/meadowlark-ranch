// Hair-only inertial response on the verified native WildMesh skin.
import {createFrameGroomInertia} from './frame-inertia.mjs?v=native-secondary-1';
import {NATIVE_GROOM_PROFILE_IDS,NATIVE_GROOM_HIERARCHY,NATIVE_GROOM_AUDIT} from './native-groom-controls.mjs?v=native-secondary-1';

/** One-time, fail-closed verification of the original five-mesh WildMesh skin. */
export function validateNativeGroomRig(rig){
 try{
  if(!rig?.profile?.nativeBreed||rig.profile.nativeKind!=='horse'||!NATIVE_GROOM_PROFILE_IDS.includes(rig.profile.id||rig.key))return {eligible:false,reason:'Unverified native profile'};
  const root=rig.nativeRoot;if(!root)return {eligible:false,reason:'Missing original native root'};
  const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  const expectedCounts=[2028,5092,13895,16159,23514],counts=meshes.map(m=>m.geometry?.attributes?.position?.count).sort((a,b)=>a-b);
  if(counts.length!==5||counts.some((n,i)=>n!==expectedCounts[i]))return {eligible:false,reason:'Unverified five-mesh topology'};
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
   const isHair=attrs.position.count===23514;
   for(let i=0;i<W.count;i++)for(let c=0;c<4;c++){
    const weight=W.getComponent(i,c),index=J.getComponent(i,c);
    if(!Number.isFinite(weight)||weight<0||!Number.isInteger(index)||index<0||index>=bones.length)return {eligible:false,reason:'Invalid source skin influence'};
    if(weight>0&&!isHair){
     for(let b=bones[index];b;b=b.parent)if(safe.has(b.name))return {eligible:false,reason:'Non-hair-weighted control or descendant'};
    }
   }
  }
  for(const spec of NATIVE_GROOM_AUDIT.controls)if(!boneMap[spec.name]||boneMap[spec.name].parent?.name!==spec.parent)return {eligible:false,reason:'Missing audited groom control'};
  return {eligible:true,reason:'Verified WildMesh677 original skin',root,boneMap,controls:58};
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
