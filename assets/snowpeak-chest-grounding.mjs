// Artifact proposal only. Pure rigid fit of the ONE original snowpeak chest.
// No loaders, Three constructors, field edits, support floors or generic props.
export const SNOWPEAK_CHEST_GROUNDING_PROFILE='snowpeak-source-bottom-grounding-1';
const SITE=Object.freeze({id:'snowpeak',x:-177,z:-238,tier:3,yaw:Math.atan2(177,238)});
const POLICY=Object.freeze({bottomContactBandM:.006,reportBandM:.22,maximumTiltDegrees:30,maximumRootTranslationM:.35,maximumBottomGapM:.03,clearanceM:.0015,numericalToleranceM:1e-7});
const S=1000/512,O=-500,N=513;
const AUTHORED_SOLID=Object.freeze({min:Object.freeze([-.484,.012,-.32]),max:Object.freeze([.484,.53,.32]),matrix:Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])});
const clip=(poly,f)=>{if(!poly.length)return poly;const out=[];let a=poly.at(-1),da=f(a);for(const b of poly){const db=f(b),ia=da>=0,ib=db>=0;if(ia!==ib){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}if(ib)out.push(b);a=b;da=db;}return out;};
function cross(a,b,p){return(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);}
function field(heights){
 if(!(heights instanceof Float32Array)||heights.length!==N*N)throw Error('Exact canonical Float32 field required');
 const owner=(ix,iz,half)=>{const x=O+ix*S,z=O+iz*S,i=iz*N+ix;return half?[[x+S,heights[i+1],z],[x+S,heights[i+N+1],z+S],[x,heights[i+N],z+S]]:[[x,heights[i],z],[x+S,heights[i+1],z],[x,heights[i+N],z+S]];};
 const plane=(t,x,z)=>{const[a,b,c]=t,D=cross(a,b,c),gx=((b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]))/D,gz=((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/D;return{height:a[1]+gx*(x-a[0])+gz*(z-a[2]),gx,gz};};
 const at=(x,z)=>{const ix=Math.floor((x-O)/S),iz=Math.floor((z-O)/S);if(ix<0||ix>511||iz<0||iz>511)throw Error('Chest outside canonical field');const u=(x-O)/S-ix,v=(z-O)/S-iz;return plane(owner(ix,iz,u+v>1?1:0),x,z);};
 return{owner,plane,at};
}
// Orthonormal axes with +Z's horizontal heading EXACTLY the authored yaw.
// gx/gz describe the supporting plane normal; this introduces no scale/shear.
function axes(gx,gz){
 const s=Math.sin(SITE.yaw),c=Math.cos(SITE.yaw),ul=Math.hypot(gx,1,gz),up=[-gx/ul,1/ul,-gz/ul],f=[s,gx*s+gz*c,c],fl=Math.hypot(...f);for(let i=0;i<3;i++)f[i]/=fl;
 const right=[up[1]*f[2]-up[2]*f[1],up[2]*f[0]-up[0]*f[2],up[0]*f[1]-up[1]*f[0]],rl=Math.hypot(...right);for(let i=0;i<3;i++)right[i]/=rl;
 return{right,up,forward:f,tiltDegrees:Math.atan(Math.hypot(gx,gz))*180/Math.PI};
}
function transform(p,a,y){return[SITE.x+p[0]*a.right[0]+p[1]*a.up[0]+p[2]*a.forward[0],y+p[0]*a.right[1]+p[1]*a.up[1]+p[2]*a.forward[1],SITE.z+p[0]*a.right[2]+p[1]*a.up[2]+p[2]*a.forward[2]];}
function measure(polys,a,y,g){
 const out={min:Infinity,max:-Infinity,minimumWitness:null,maximumWitness:null,canonicalPieces:0,samples:0};
 for(let face=0;face<polys.length;face++){
  const p=polys[face].map(v=>transform(v,a,y)),xs=p.map(v=>v[0]),zs=p.map(v=>v[2]),ix0=Math.floor((Math.min(...xs)-O)/S),ix1=Math.floor((Math.max(...xs)-O)/S),iz0=Math.floor((Math.min(...zs)-O)/S),iz1=Math.floor((Math.max(...zs)-O)/S);
  if(ix0<0||ix1>511||iz0<0||iz1>511)throw Error('Source chest footprint outside canonical field');
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++)for(let half=0;half<2;half++){
   const t=g.owner(ix,iz,half);let q=p;for(let k=0;k<3&&q.length;k++)q=clip(q,v=>cross(t[k],t[(k+1)%3],v));if(!q.length)continue;out.canonicalPieces++;
   for(const v of q){const h=g.plane(t,v[0],v[2]).height,gap=v[1]-h,w={sourceFace:face,xyz:v,terrainHeight:h,gap,canonicalOwner:[ix,iz,half]};out.samples++;if(gap<out.min){out.min=gap;out.minimumWitness=w;}if(gap>out.max){out.max=gap;out.maximumWitness=w;}}
  }
 }
 if(!out.samples)throw Error('No actual chest surface/canonical intersection');return out;
}
function actualSource(triangles){
 if(!Array.isArray(triangles)||!triangles.length)throw Error('Actual chest triangles required');let low=Infinity;
 for(const t of triangles){if(t.length!==3||!t.flat().every(Number.isFinite))throw Error('Finite actual chest triangles required');for(const p of t)low=Math.min(low,p[1]);}
 const band=reach=>triangles.map(t=>clip(t,p=>low+reach-p[1])).filter(t=>t.length);
 return{low,bottom:band(POLICY.bottomContactBandM),report:band(POLICY.reportBandM)};
}
export function measureSnowpeakChestPose({triangles,heights,rootY=null,gx=0,gz=0}){
 const g=field(heights),source=actualSource(triangles),a=axes(gx,gz),y=rootY??g.at(SITE.x,SITE.z).height;
 return{rootY:y,gx,gz,tiltDegrees:a.tiltDegrees,actualSourceMinimumLocalY:source.low,bottomBandM:POLICY.bottomContactBandM,bottomContact:measure(source.bottom,a,y,g),reportBandM:POLICY.reportBandM,reportLowFoot:measure(source.report,a,y,g),fullRendered:measure(triangles,a,y,g)};
}
export function planSnowpeakChestGrounding({triangles,openedTriangles=null,heights,sourceSignature=null,fieldSHA256=null}){
 const g=field(heights),source=actualSource(triangles),root0=g.at(SITE.x,SITE.z).height,seed=g.at(SITE.x,SITE.z),maxSlope=Math.tan(POLICY.maximumTiltDegrees*Math.PI/180);let evaluations=0;
 function evaluate(gx,gz){
  if(Math.hypot(gx,gz)>maxSlope)return null;evaluations++;const a=axes(gx,gz),m=measure(source.bottom,a,root0,g);return{gx,gz,a,m,score:m.max-m.min};
 }
 let best=evaluate(seed.gx,seed.gz)??evaluate(0,0);const flat=evaluate(0,0);if(flat.score<best.score)best=flat;
 // One deterministic local minimax solve, not a family of authored alternatives.
 for(let step=.12;step>2e-7;){let improved=false;for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const q=evaluate(best.gx+dx*step,best.gz+dz*step);if(q&&q.score<best.score-1e-12){best=q;improved=true;}}if(!improved)step*=.5;}
 const fullAtInitial=measure(triangles,best.a,root0,g),lift=POLICY.clearanceM-fullAtInitial.min,rootY=root0+lift;
 const closed=measureSnowpeakChestPose({triangles,heights,rootY,gx:best.gx,gz:best.gz}),opened=openedTriangles?measureSnowpeakChestPose({triangles:openedTriangles,heights,rootY,gx:best.gx,gz:best.gz}):null;
 const checks={tiltWithinBound:best.a.tiltDegrees<=POLICY.maximumTiltDegrees,rootTranslationWithinBound:Math.abs(lift)<=POLICY.maximumRootTranslationM,continuousClosedPenetrationClear:closed.fullRendered.min>=POLICY.clearanceM-POLICY.numericalToleranceM,continuousOpenedPenetrationClear:!opened||opened.fullRendered.min>=-POLICY.numericalToleranceM,bottomGapWithinBound:closed.bottomContact.max<=POLICY.maximumBottomGapM,bottomNearSupport:closed.bottomContact.min<=POLICY.clearanceM+.0001};
 const accepted=Object.values(checks).every(Boolean),a=best.a,matrix=[...a.right,0,...a.up,0,...a.forward,0,SITE.x,rootY,SITE.z,1];
 return{profile:SNOWPEAK_CHEST_GROUNDING_PROFILE,status:accepted?'CPU_SUPPORTED_RIGID_POSE_PROPOSED_FOR_REVIEW':'BLOCKED_NO_SUPPORTED_RIGID_POSE_WITHIN_DECLARED_BOUNDS',accepted,site:SITE,policy:POLICY,fieldSHA256,fieldBinding:{requireExpectedFieldSHA256:true,callerResponsibility:'Caller must derive expectedFieldSHA256 from the currently admitted authoritative field. This helper compares that binding; it does not hash or independently certify runtime field bytes.'},sourceSignature,originalRootY:root0,rootY,rootTranslationM:lift,gx:best.gx,gz:best.gz,tiltDegrees:a.tiltDegrees,matrix,checks,continuousClosed:closed,continuousOpened:opened,bottomSourcePolygons:source.bottom.length,optimizer:{evaluations,method:'Deterministic pattern minimax of continuous actual 6 mm bottom contact gap spread, followed by whole-render nonpenetration translation and strict final gap checks.',globalOptimumClaim:false},authoredXZUnchanged:true,projectedForwardYaw:Math.atan2(a.forward[0],a.forward[2]),scaleChanged:false,sourceChanged:false,runtimeResourcesAdded:0,physicalOrInteractionAdmission:false};
}
// Diagnostic source signature: actual mesh position/index bytes and names.
// No resource construction; this does not replace the source-file SHA binding.
export function snowpeakResidentSignature(root){let h=2166136261,vertices=0,triangles=0,meshes=0;const byte=v=>{h=Math.imul(h^v,16777619)>>>0;};root.traverse(m=>{if(!m.isMesh)return;meshes++;for(const ch of m.name)byte(ch.charCodeAt(0)&255);for(const a of[m.geometry.attributes.position.array,m.geometry.index?.array])if(a)for(const v of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))byte(v);vertices+=m.geometry.attributes.position.count;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});return{fnv32:h,meshes,vertices,triangles};}
function exactAuthoredSolid(root){
 const parts=root.userData.solidParts,p=parts?.[0];return parts?.length===1&&p&&['min','max','matrix'].every(k=>Array.isArray(p[k])&&p[k].length===AUTHORED_SOLID[k].length&&p[k].every((v,i)=>v===AUTHORED_SOLID[k][i]));
}
const NO_ROOT_CALLBACK=()=>{};
function captureRootState(g){return{position:g.position.toArray(),rotation:g.rotation.toArray(),quaternion:g.quaternion.toArray(),scale:g.scale.toArray(),matrix:g.matrix.toArray(),matrixWorld:g.matrixWorld.toArray(),matrixAutoUpdate:g.matrixAutoUpdate,matrixWorldAutoUpdate:g.matrixWorldAutoUpdate,matrixWorldNeedsUpdate:g.matrixWorldNeedsUpdate,marker:Object.getOwnPropertyDescriptor(g.userData,'snowpeakGrounding')};}
function restoreRootState(g,s){
 // Pinned Three synchronizes Euler/quaternion through callbacks. Suspend only
 // those callbacks while restoring BOTH original arrays exactly, without an
 // Euler round-trip or constructing new Three objects/resources.
 const rc=g.rotation._onChangeCallback,qc=g.quaternion._onChangeCallback;
 try{g.rotation._onChangeCallback=NO_ROOT_CALLBACK;g.quaternion._onChangeCallback=NO_ROOT_CALLBACK;g.position.fromArray(s.position);g.rotation.fromArray(s.rotation);g.quaternion.fromArray(s.quaternion);g.scale.fromArray(s.scale);}
 finally{g.rotation._onChangeCallback=rc;g.quaternion._onChangeCallback=qc;}
 g.matrix.fromArray(s.matrix);g.matrixWorld.fromArray(s.matrixWorld);g.matrixAutoUpdate=s.matrixAutoUpdate;g.matrixWorldAutoUpdate=s.matrixWorldAutoUpdate;g.matrixWorldNeedsUpdate=s.matrixWorldNeedsUpdate;
 if(s.marker)Object.defineProperty(g.userData,'snowpeakGrounding',s.marker);else delete g.userData.snowpeakGrounding;
}
function rootStateIsExact(g,s){
 const current=captureRootState(g);return['position','rotation','quaternion','scale','matrix','matrixWorld'].every(k=>current[k].length===s[k].length&&current[k].every((v,i)=>Object.is(v,s[k][i])))&&['matrixAutoUpdate','matrixWorldAutoUpdate','matrixWorldNeedsUpdate'].every(k=>current[k]===s[k])&&(!s.marker?!current.marker:!!current.marker&&Reflect.ownKeys(s.marker).every(k=>Object.is(current.marker[k],s.marker[k])));
}
// Caller binds the trusted proposal to the currently admitted field SHA. No
// runtime field hashing, loaders or resources are introduced by this apply seam.
export function applySnowpeakChestGroundingProposal({thing,plan,solidWorld,expectedFieldSHA256}){
 if(!plan?.accepted||plan.profile!==SNOWPEAK_CHEST_GROUNDING_PROFILE)throw Error('Accepted exact chest proposal required');
 if(typeof expectedFieldSHA256!=='string'||!/^[a-f0-9]{64}$/.test(expectedFieldSHA256)||plan.fieldSHA256!==expectedFieldSHA256)throw Error('Current admitted field SHA binding required');
 if(!Array.isArray(plan.matrix)||plan.matrix.length!==16||!plan.matrix.every(Number.isFinite))throw Error('Finite exact proposal matrix required');
 const g=thing?.g;if(thing?.kind!=='chest'||thing.id!==SITE.id||thing.tier!==SITE.tier||thing.x!==SITE.x||thing.z!==SITE.z||!g||g.position.x!==SITE.x||g.position.z!==SITE.z)throw Error('Exact original snowpeak owner required');
 if(JSON.stringify(snowpeakResidentSignature(g))!==JSON.stringify(plan.sourceSignature)||!exactAuthoredSolid(g)||!solidWorld?.hasParts(g))throw Error('Exact resident geometry and original authored solid part required');
 // Decompose/recompose can introduce unit-scale rounding. Accept only the
 // recognized applied pose, not merely a marker, before checking original TRS.
 if(g.userData.snowpeakGrounding===SNOWPEAK_CHEST_GROUNDING_PROFILE){
  g.updateMatrix();if(g.matrix.elements.some((v,i)=>!Number.isFinite(v)||Math.abs(v-plan.matrix[i])>1e-12))throw Error('Recognized chest pose changed after finalizer');
  return{status:'already-applied',sameAppliedMatrix:true,fieldBindingVerified:true};
 }
 if(![g.position.y,g.rotation.x,g.rotation.y,g.rotation.z].every(Number.isFinite)||g.scale.x!==1||g.scale.y!==1||g.scale.z!==1||Math.abs(g.rotation.x)>1e-12||Math.abs(g.rotation.z)>1e-12||Math.abs(g.rotation.y-SITE.yaw)>1e-12||Math.abs(g.position.y-plan.originalRootY)>1e-7)throw Error('Chest original authored root changed before finalizer');
 const lid=thing.lid,lidX=lid?.rotation.x,parts=g.userData.solidParts,geometry=[],materials=[],original=captureRootState(g);g.traverse(m=>{if(m.isMesh){geometry.push(m.geometry);materials.push(m.material);}});
 const verifyResources=()=>{let i=0;g.traverse(m=>{if(m.isMesh){if(m.geometry!==geometry[i]||m.material!==materials[i])throw Error('Chest resources changed during root fit');i++;}});if(i!==geometry.length||g.userData.solidParts!==parts)throw Error('Chest resident owner changed during root fit');if(lid&&lid.rotation.x!==lidX)throw Error('Chest lid state changed during root fit');};
 try{
  g.matrix.fromArray(plan.matrix);g.matrix.decompose(g.position,g.quaternion,g.scale);g.updateMatrixWorld(true);const registered=solidWorld.register(g);
  if(registered!==parts.length||!solidWorld.hasParts(g))throw Error('Chest authored solid owner did not re-register completely');
  verifyResources();g.userData.snowpeakGrounding=SNOWPEAK_CHEST_GROUNDING_PROFILE;
  return{status:'applied-same-owner',registeredParts:registered,resourcesAdded:0,lidUnchanged:true,authoredSolidPartVerified:true,fieldBindingVerified:true,registrationTransactional:true};
 }catch(applyError){
  try{
   restoreRootState(g,original);const restored=solidWorld.register(g);
   if(restored!==parts.length||!solidWorld.hasParts(g))throw Error('Original chest authored solid owner rollback registration incomplete');
   // Registration may update matrices/dirty flags. Restore the exact captured
   // root values after it has rebuilt collision data from the original pose.
   restoreRootState(g,original);verifyResources();if(!rootStateIsExact(g,original))throw Error('Original chest root rollback was not exact');
  }catch(rollbackError){
   // Still attempt the original transform/marker even if registry recovery
   // failed. Never claim the owner was restored on this branch.
   let finalRestoreError;try{restoreRootState(g,original);}catch(e){finalRestoreError=e;}
   const error=new AggregateError([applyError,rollbackError,...(finalRestoreError?[finalRestoreError]:[])],'Snowpeak grounding failed and rollback failed; original registration restoration is NOT confirmed');error.rollbackRestored=false;error.originalPoseRestored=!finalRestoreError&&rootStateIsExact(g,original);throw error;
  }
  const error=new Error('Snowpeak grounding failed; original exact root pose and authored solid registration restored');error.cause=applyError;error.rollbackRestored=true;error.originalPoseRestored=true;throw error;
 }
}
