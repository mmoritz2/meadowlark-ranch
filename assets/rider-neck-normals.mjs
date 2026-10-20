// Model-normal refinement for the connected neck loft only. Source positions,
// topology, binding, garment coverage and both authored boundary normals stay exact.
const prepared=new WeakMap(),SIGMA=.012,RADIUS=SIGMA*3,BLEND=.70,MAX_TURN=Math.PI/12;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// BufferGeometry cloning allocates UUIDs. Keep those draws out of the world's
// ambient placement stream, while advancing a dedicated stream for unique copies.
let neckUUIDState=0x4e45434b;
function cloneGeometry(source){
 const ambient=Math.random;Math.random=()=>{neckUUIDState=(Math.imul(neckUUIDState,1664525)+1013904223)>>>0;return neckUUIDState/4294967296;};
 try{return source.clone();}finally{Math.random=ambient;}
}
function prepare(T,source,asset){
 const p=source.attributes.position,n=source.attributes.normal,index=source.index,meta=source.userData.neck16LiveUpper;
 const stamp=[p,p.version,n,n.version,index,index.version,...asset.inverse.elements,...asset.bind.elements],cached=prepared.get(source);
 if(cached&&stamp.every((v,i)=>v===cached.stamp[i]))return cached;
 const ids=meta.chartIDs,cols=meta.outerCutVertices,rows=meta.chartRows,lower=source.userData.neckBoundary,upper=meta.upperBoundary;
 if(!Number.isInteger(cols)||cols<3||rows<3||ids.length!==(rows-1)*cols||upper?.length!==cols||lower?.length!==84||new Set(ids).size!==ids.length)throw Error('Connected neck normal topology changed');
 const protectedIDs=new Set([...lower,...upper]);
 if(ids.some(i=>protectedIDs.has(i)||!Number.isInteger(i)||i<0||i>=p.count))throw Error('Connected neck interior overlaps a protected boundary');
 const positions=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(asset.inverse));
 const fans=Array.from({length:p.count},()=>new T.Vector3()),area=new Float64Array(p.count),cross=new T.Vector3(),edge=new T.Vector3();
 // Area-weighted fans and dual areas balance the irregular inherited columns.
 for(let f=0;f<index.count;f+=3){
  const a=index.getX(f),b=index.getX(f+1),c=index.getX(f+2);
  cross.copy(positions[b]).sub(positions[a]).cross(edge.copy(positions[c]).sub(positions[a]));
  const mass=cross.length()/6;fans[a].add(cross);fans[b].add(cross);fans[c].add(cross);area[a]+=mass;area[b]+=mass;area[c]+=mass;
 }
 for(const fan of fans)fan.normalize();
 const toLocal=new T.Matrix3().getNormalMatrix(asset.inverse),toBind=new T.Matrix3().getNormalMatrix(asset.bind);
 for(const i of protectedIDs)fans[i].fromBufferAttribute(n,i).applyMatrix3(toLocal).normalize();
 const neighbors=[...ids,...lower,...upper],out=n.array.slice(),sum=new T.Vector3(),prior=new T.Vector3(),next=new T.Vector3();
 let changed=0,maxTurn=0;
 for(let k=0;k<ids.length;k++){
  const i=ids[k],position=positions[i];sum.set(0,0,0);
  for(const j of neighbors){
   const d2=position.distanceToSquared(positions[j]);if(d2>RADIUS*RADIUS)continue;
   sum.addScaledVector(fans[j],area[j]*Math.exp(-d2/(2*SIGMA*SIGMA)));
  }
  if(sum.lengthSq()<1e-20)throw Error('Connected neck has no finite surface fan '+i);
  sum.normalize();prior.fromBufferAttribute(n,i).applyMatrix3(toLocal).normalize();
  const t=(Math.floor(k/cols)+1)/rows,alpha=BLEND*smooth(0,.20,t)*(1-smooth(.80,1,t));
  next.copy(prior).lerp(sum,alpha).normalize();let turn=prior.angleTo(next);
  // Keep the normal inside a modest cone around its authored direction.
  if(turn>MAX_TURN){sum.copy(next);next.copy(prior).lerp(sum,MAX_TURN/turn).normalize();turn=prior.angleTo(next);}
  if(!next.toArray().every(Number.isFinite)||next.lengthSq()<.99)throw Error('Invalid connected neck normal '+i);
  if(turn>1e-7){next.applyMatrix3(toBind).normalize().toArray(out,i*3);changed++;maxTurn=Math.max(maxTurn,turn);}
 }
 const result={stamp,normals:out,evidence:Object.freeze({version:1,scope:'connected neck loft interior normals only',sourceVertices:p.count,interiorVertices:ids.length,changedVertices:changed,protectedBodySeamVertices:lower.length,protectedUpperVertices:upper.length,sigmaM:SIGMA,radiusM:RADIUS,blend:BLEND,maxNormalTurnDeg:maxTurn*180/Math.PI,positionsUnchanged:true,topologyUnchanged:true,weightsUnchanged:true,boundaryNormalsUnchanged:true})};
 prepared.set(source,result);return result;
}
export function refineRiderNeckNormals(T,rig){
 if(rig?.neckNormals?.version===1)return rig;
 const face=rig?.face,source=face?.geometry,asset=rig?.kit?.headAsset;
 if(!source?.userData.neck16LiveUpper||!asset?.inverse||!asset?.bind)return rig;
 const result=prepare(T,source,asset),owned=cloneGeometry(source);
 // Each rig owns only its copy. The kit's shared source never gets disposed here.
 owned.setAttribute('normal',new T.BufferAttribute(result.normals.slice(),source.attributes.normal.itemSize));
 owned.userData={...source.userData,riderNeckNormals:result.evidence};face.geometry=owned;
 rig.neckNormals=Object.freeze({version:1,evidence:result.evidence});
 const previous=rig.dispose;let dead=false;
 rig.dispose=function(...args){
  if(dead)return;dead=true;
  try{return previous?.apply(this,args);}
  finally{if(face.geometry===owned)face.geometry=source;owned.dispose();}
 };
 return rig;
}
