import {NATIVE_HOOF_CONTROLS} from './native-hoof-controls.mjs?v=native-hoof-flex-2';

// The main mixer keeps the original distal pose. Authored hoof articulation is
// added only where that pose has clearance; gait clocks and actor travel stay
// owned by the existing controller.
export function prepareNativeHoofFlex({THREE,root,clips,profile}){
 if(!profile.nativeHoofFlex)return{clips,layer:null};
 const controls=NATIVE_HOOF_CONTROLS[profile.id];
 if(profile.nativeKind!=='horse'||!controls)throw new Error('Unverified native hoof profile');
 const boneNames=Object.values(controls).flatMap(c=>c.bones),bones=new Map();root.traverse(o=>{if(o.isBone)bones.set(o.name,o);});
 if(bones.size!==677||boneNames.some(n=>!bones.has(n)))throw new Error('Native hoof rig mismatch');
 for(const c of Object.values(controls))if(c.bones.length!==2||bones.get(c.bones[1]).parent!==bones.get(c.bones[0])||!c.hull?.length||c.hull.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x))))throw new Error('Native hoof controls mismatch');
 const names=new Set(boneNames.map(n=>n+'.quaternion')),defaults=new Map(boneNames.map(n=>[n,bones.get(n).quaternion.clone()])),samplers=new Map(),replacement=new Map();
 for(const record of Object.values(profile.nativeGaits||{})){
  if(record.authoredHoofFold)continue;
  const folded=THREE.AnimationClip.findByName(clips,record.clip),original=THREE.AnimationClip.findByName(clips,'Native Foreleg Baseline | '+record.clip);
  if(!folded||!original||Math.abs(folded.duration-original.duration)>1e-5)throw new Error('Missing original native foreleg tracks');
  const originalTracks=new Map(original.tracks.map(t=>[t.name,t]));
  if(originalTracks.size!==4||[...names].some(n=>!originalTracks.has(n)))throw new Error('Native foreleg track mismatch');
  const tracks=folded.tracks.map(t=>names.has(t.name)?originalTracks.get(t.name):t);
  if([...names].some(n=>!tracks.some(t=>t.name===n)))throw new Error('Missing authored native hoof curve');
  replacement.set(folded,new THREE.AnimationClip(folded.name,folded.duration,tracks,folded.blendMode));
 }
 for(const clip of clips){if(clip.name.startsWith('Native Foreleg Baseline | '))continue;const byName=new Map();for(const t of clip.tracks)if(names.has(t.name))byName.set(t.name.slice(0,-11),t.createInterpolant(new Float32Array(4)));samplers.set(clip.name,byName);}
 const source=new Map(),desired=new Map(),scratch=new THREE.Quaternion(),point=new THREE.Vector3(),inverse=new THREE.Matrix4(),relative=new THREE.Matrix4();
 let sampled=false,disposed=false,fallbacks=0,maxCost=0,state={eligible:true,finite:true,sourceControllerUpdatesOwned:0,feet:{}};
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
 function minimum(c){relative.multiplyMatrices(inverse,bones.get(c.bones[1]).matrixWorld);let min=Infinity;for(const p of c.hull){point.fromArray(p).applyMatrix4(relative);min=Math.min(min,point.y);}return min+(profile.nativeTranslation?.[1]||0);}
 function restore(){if(!sampled)return;for(const[n,q]of source)bones.get(n).quaternion.copy(q);sampled=false;}
 function afterPose(active){
  if(disposed)throw new Error('Native hoof layer disposed');const started=performance.now();inverse.copy(root.matrixWorld).invert();source.clear();desired.clear();
  for(const n of boneNames){const q=bones.get(n).quaternion;source.set(n,q.clone());let total=0,result=null;
   for(const[action,weight]of active){if(!(weight>0))continue;const sampler=samplers.get(action.getClip().name)?.get(n);scratch.copy(defaults.get(n));if(sampler)scratch.fromArray(sampler.evaluate(action.time));scratch.normalize();if(!result)result=scratch.clone();else result.slerp(scratch,weight/(total+weight));total+=weight;}
   if(!result)result=q.clone();if(total<1)result.slerp(defaults.get(n),1-total);desired.set(n,result);
  }
  const feet={};
  for(const[foot,c]of Object.entries(controls)){
   // Fade the stronger fold through a wider clearance band before contact.
   const sourceMinimum=minimum(c),gate=smooth((sourceMinimum-.012)/.030),first=bones.get(c.bones[0]);
   for(const n of c.bones)bones.get(n).quaternion.copy(source.get(n)).slerp(desired.get(n),gate);
   first.updateWorldMatrix(false,true);let finalMinimum=minimum(c),appliedGate=gate;const requestedMinimum=finalMinimum;
   // A rare pose outside the audited envelope falls back to its source pose.
   // This does not lift the root, move joints, or correct source contact faults.
   if(finalMinimum<Math.min(.0005,sourceMinimum)-1e-7){for(const n of c.bones)bones.get(n).quaternion.copy(source.get(n));first.updateWorldMatrix(false,true);finalMinimum=minimum(c);appliedGate=0;fallbacks++;}
   feet[foot]={sourceMinimumM:sourceMinimum,finalMinimumM:finalMinimum,gate:appliedGate,requestedGate:gate,requestedMinimumM:requestedMinimum,maxAddedLocalAngleDeg:Math.max(...c.bones.map(n=>source.get(n).angleTo(bones.get(n).quaternion)*180/Math.PI))};
  }
  sampled=true;const cost=performance.now()-started;maxCost=Math.max(maxCost,cost);state={eligible:true,finite:boneNames.every(n=>bones.get(n).quaternion.toArray().every(Number.isFinite)),sourceControllerUpdatesOwned:0,feet,fallbacks,lastCostMs:cost,maxCostMs:maxCost};
 }
 const layer={beforePose:restore,afterPose,reset(){restore();state={eligible:true,finite:true,sourceControllerUpdatesOwned:0,feet:{},fallbacks};},snapshot(){return{...state,disposed};},dispose(){if(disposed)return;restore();disposed=true;}};
 return{clips:clips.map(c=>replacement.get(c)||c),layer};
}
