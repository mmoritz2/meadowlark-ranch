// One late source-owner transaction; resource construction stays synchronous.
import {planSnowpeakBoulderSeating} from './snowpeak-boulder-seating.mjs?v=snowpeak-boulder-contact-1';
export const SNOWPEAK_BOULDER_CONTACT_PROFILE='snowpeak-boulder-contact-1';
export const SNOWPEAK_BOULDER_PLAN={"fieldSHA256":"e11fd7647db59d06d0cc357f1898ea40da7373c7ae5724297fb74d3b277facd0","sourceIndex":3,"seed":9204,"part":3,"partName":"rock_moss_set_01_rock04","triangles":4499,"originalPositionFNV32":3013830386,"originalIndexFNV32":2345438837,"piecePositionFNV32":3984408010,"pieceIndexFNV32":4131235589,"sourceSignatureNote":"Actual deterministic builder bytes, including negative-zero Float32 signs lost in JSON ray serialization."};
const installed=new WeakMap(),need=(yes,message)=>{if(!yes)throw Error(message);};
const signature=array=>{let h=2166136261;for(const b of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;};
const same=(a,b,epsilon=0)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=epsilon);
function privateClone(key,make){
 const previous=Math.random;let seed=2166136261,draws=0;
 for(const c of SNOWPEAK_BOULDER_CONTACT_PROFILE+'|'+key)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 Math.random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{return{value:make(),draws};}finally{Math.random=previous;}
}
// Exact actual-face vertical query. Only this owner's triangles enter its small
// subcells. It is a support acceleration index, never an enclosing box floor.
function supportIndex(geometry,matrix){
 const P=geometry.attributes.position,I=geometry.index,M=matrix.elements,step=.2,cells=new Map();
 const world=j=>{const x=P.getX(j),y=P.getY(j),z=P.getZ(j);return[M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14]];};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,faces=0,maxCellFaces=0;
 for(let i=0;i<I.count;i+=3){
  const [a,b,c]=[0,1,2].map(k=>world(I.getX(i+k))),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(den)<1e-10)continue;
  const e={a,b,c,den,minX:Math.min(a[0],b[0],c[0]),maxX:Math.max(a[0],b[0],c[0]),minZ:Math.min(a[2],b[2],c[2]),maxZ:Math.max(a[2],b[2],c[2])};faces++;
  minX=Math.min(minX,e.minX);maxX=Math.max(maxX,e.maxX);minZ=Math.min(minZ,e.minZ);maxZ=Math.max(maxZ,e.maxZ);
  for(let x=Math.floor(e.minX/step);x<=Math.floor(e.maxX/step);x++)for(let z=Math.floor(e.minZ/step);z<=Math.floor(e.maxZ/step);z++){const k=x+','+z;if(!cells.has(k))cells.set(k,[]);const list=cells.get(k);list.push(e);maxCellFaces=Math.max(maxCellFaces,list.length);}
 }
 const heightAt=(x,z)=>{
  if(x<minX||x>maxX||z<minZ||z>maxZ)return-Infinity;let h=-Infinity;
  for(const e of cells.get(Math.floor(x/step)+','+Math.floor(z/step))||[]){
   if(x<e.minX-1e-10||x>e.maxX+1e-10||z<e.minZ-1e-10||z>e.maxZ+1e-10)continue;
   const{a,b,c,den}=e,u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
   if(Math.min(u,v,w)>=-1e-10)h=Math.max(h,u*a[1]+v*b[1]+w*c[1]);
  }return h;
 };
 return{heightAt,stats:{step,cells:cells.size,projectedFaces:faces,maxCellFaces,bounds:{minX,maxX,minZ,maxZ}}};
}
export function replaceSnowpeakBoulderContact({G,source,piece,runtime}){
 const W=G?.world,T=G?.THREE,P=SNOWPEAK_BOULDER_PLAN,mesh=source?.mesh,circle=source?.collider;
 need(W&&T&&runtime===W.hollowpeakRuntime&&runtime?.status==='ready'&&runtime.payload?.authenticated===true&&runtime.payload.finalFieldSHA256===P.fieldSHA256&&runtime.ecology?.status==='applied'&&runtime.ecology?.trees?.status==='applied'&&runtime.collision?.legacyReplaced===true&&W.fallsLandscape?.ownedQueries===runtime.queries,'Final admitted canonical/runtime owner required');
 need(['applied-same-owner','already-applied'].includes(runtime.anchorGrounding?.status)&&runtime.anchorGrounding?.id==='snowpeak','Late successful Snowpeak anchor finalizer required');
 need(source?.index===3&&source?.seed===9204&&mesh?.isMesh&&!mesh.isInstancedMesh&&mesh.parent===G.scene&&mesh.visible,'Exact admitted raw28 index3 Mesh required');
 if(installed.has(mesh))return installed.get(mesh);
 need(mesh.userData.geology?.seed===9204&&mesh.userData.geology?.kind==='boulder'&&!mesh.userData.solidParts,'Original raw28 geology owner required');
 mesh.updateWorldMatrix(true,false);const M=mesh.matrixWorld.elements,s=mesh.scale.x;
 need(M.every(Number.isFinite)&&s>0&&mesh.scale.y===s&&mesh.scale.z===s&&[1,3,4,6,7,9,11].every(i=>Math.abs(M[i])<1e-10)&&Math.abs(Math.hypot(M[0],M[2])-s)<1e-10&&Math.abs(Math.hypot(M[8],M[10])-s)<1e-10,'Original uniform upright raw28 placement required');
 need(signature(mesh.geometry.attributes.position.array)===P.originalPositionFNV32&&signature(mesh.geometry.index.array)===P.originalIndexFNV32,'Raw28 source geometry changed');
 const circleIndex=W.colliders?.indexOf(circle);
 need(circle&&circleIndex>=0&&W.colliders.filter(c=>c.x===circle.x&&c.z===circle.z&&Math.abs(c.r-circle.r)<1e-10).length===1&&circle.x===mesh.position.x&&circle.z===mesh.position.z&&Math.abs(circle.r-mesh.scale.x*1.05)<1e-10&&!circle.precise,'One exact retained source circle required; never recreate a pruned record');
 const descriptor=Object.getOwnPropertyDescriptor(circle,'precise');
 need(descriptor?('value'in descriptor&&descriptor.writable):Object.isExtensible(circle),'Source circle handoff property must be reversible');
 need(Array.isArray(W.groundSurfaces)&&typeof W.solidWorld?.hasSurface==='function'&&!W.solidWorld.hasSurface(mesh),'Fresh static surface owner required');
 need(piece?.geo?.attributes?.position&&piece.mat&&signature(piece.geo.attributes.position.array)===P.piecePositionFNV32&&signature(piece.geo.index.array)===P.pieceIndexFNV32,'Exact resident rock_moss_set_01 part3 required');
 const H=runtime.heights;need(H instanceof Float32Array&&H.length===513*513,'Actual canonical field required');
 const fit=planSnowpeakBoulderSeating({sourcePositions:mesh.geometry.attributes.position.array,sourceIndex:mesh.geometry.index.array,scanPositions:piece.geo.attributes.position.array,scanIndex:piece.geo.index.array,matrixWorld:mesh.matrixWorld.elements,heights:H,segments:512,step:1000/512,originX:-500,originZ:-500,burial:.025});
 if(!fit?.accepted){
  const reason=fit?.reason||fit?.status||'Actual placed boulder has no admitted scan seat';
  const error=Error('Actual placed boulder has no admitted scan seat: '+reason,{cause:Error(reason)});
  error.admission={status:fit?.status||'RETAIN_ORIGINAL_NO_ADMITTED_SCAN_SEAT',reason,resourceBound:fit?.resourceBound===true,...(fit?.metrics?.visibility?.budget?{visibilityBudget:fit.metrics.visibility.budget}:{})};
  error.rollbackRestored=true;throw error;
 }
 const before={geometry:mesh.geometry,material:mesh.material,matrixWorld:mesh.matrixWorld.elements.slice(),circleIndex,circleFields:{...circle},circleDescriptor:descriptor,surfaceStats:W.solidWorld.surfaceStats(),groundCallbacks:W.groundSurfaces.slice()};
 let geometry,index,callback,registered=false,privateDraws=0,outcome=null,rolledBack=false;
 const restoreCircle=()=>{if(descriptor)Object.defineProperty(circle,'precise',descriptor);else delete circle.precise;};
 const rollback=()=>{
  if(rolledBack)return outcome;const state=installed.get(mesh);
  let phase='ownership-check';
  try{
  if(state){need(mesh.geometry===geometry&&mesh.material===piece.mat&&W.colliders.filter(c=>c===circle).length<=1&&circle.precise===true,'Boulder ownership changed before rollback');}
  phase='unregister-surface';
  if(registered||W.solidWorld.hasSurface(mesh))W.solidWorld.unregisterSurface(mesh);
  phase='remove-support';
  const ci=W.groundSurfaces.indexOf(callback);if(ci>=0)W.groundSurfaces.splice(ci,1);
  phase='restore-original';
  mesh.geometry=before.geometry;mesh.material=before.material;restoreCircle();
  geometry?.dispose();registered=false;rolledBack=true;
  if(state){state.status='rolled-back';installed.delete(mesh);}return state;
  }catch(cause){
   if(state){state.status='rollback-failed';state.rollbackRestored=false;state.rollbackPhase=phase;state.rollbackCause=cause;}
   const error=Error('Snowpeak boulder rollback failed at '+phase,{cause});error.rollbackRestored=false;error.rollbackPhase=phase;throw error;
  }
 };
 try{
  const clone=privateClone(mesh.uuid,()=>{
   const geo=geometry=piece.geo.clone();geo.translate(-fit.centerXZ[0],-fit.sourceMinY,-fit.centerXZ[1]);geo.scale(fit.localScale,fit.localScale,fit.localScale);geo.translate(0,fit.localYShift,0);geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
  });geometry=clone.value;privateDraws=clone.draws;
  need(geometry.attributes.position.array.every(Number.isFinite),'Nonfinite private scan fit');
  index=supportIndex(geometry,mesh.matrixWorld);
  callback=(x,z)=>{if(!mesh.parent&&!mesh.userData.collisionBatched)return-Infinity;const h=index.heightAt(x,z);return h>W.terrainH(x,z)?h:-Infinity;};
  // registerSurface snapshots the supplied geometry with the COMPLETE existing
  // root world matrix. No visible geometry changes and no numeric skip precede it.
  const triangles=W.solidWorld.registerSurface(mesh,geometry,mesh.matrixWorld);registered=true;
  need(triangles===P.triangles&&W.solidWorld.hasSurface(mesh),'Exact nonempty triangle body registration required');
  let witnesses=0;const B=index.stats.bounds;
  for(let x=B.minX;x<=B.maxX;x+=(B.maxX-B.minX)/4)for(let z=B.minZ;z<=B.maxZ;z+=(B.maxZ-B.minZ)/4){const a=index.heightAt(x,z),b=W.solidWorld.surfaceHeight(x,z,mesh);need(a===b||(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8),'Private support/registered body source mismatch');if(Number.isFinite(a))witnesses++;}
  need(witnesses>0,'No actual supporting scan triangles');
  W.groundSurfaces.push(callback);
  need(W.groundSurfaces.filter(f=>f===callback).length===1,'One exact support callback required');
  mesh.geometry=geometry;mesh.material=piece.mat;
  circle.precise=true;need(circle.precise===true,'Numeric circle handoff failed');
  need(same(mesh.matrixWorld.elements,before.matrixWorld)&&W.colliders[circleIndex]===circle,'Original root/record identity changed');
  const state=outcome={profile:SNOWPEAK_BOULDER_CONTACT_PROFILE,status:'applied-same-mesh-triangle-body-support',sourceIndex:3,seed:9204,part:3,mesh,circle,circleIndex,geometry,material:piece.mat,sourcePiece:piece,support:callback,rawHeightAt:index.heightAt,supportIndexStats:index.stats,triangles,privateConstructorDraws:privateDraws,fit,before,rollback};
  installed.set(mesh,state);return state;
 }catch(cause){
  let rollbackError=null;try{rollback();}catch(error){rollbackError=error;}
  const error=Error('Snowpeak boulder replacement failed; '+(rollbackError?'rollback incomplete':'original restored'),{cause});error.rollbackRestored=!rollbackError;error.rollbackError=rollbackError;throw error;
 }
}
