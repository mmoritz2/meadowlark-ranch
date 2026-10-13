import {LIP_SCULPTS} from './rider-face-lip-sculpt-data.js?v=lip-contour78-20261012';
import {prepareRiderHead as prepareShared} from './rider-head-surface-finish.js?v=character-polish-20261009';
export {patchStylizedHead,patchStylizedEyes} from './rider-head-surface-finish.js?v=character-polish-20261009';
import {NOSE} from './rider-male-nose-data.js?v=character-polish-20261009';
function preparePreviousHead(T,...args){
 const result=prepareShared(T,...args),body=args[4];if(body!=='m')return result;
 const g=result.mesh.geometry,p=g.attributes.position,n=g.attributes.normal,V=()=>new T.Vector3();
 for(const row of NOSE.changes)for(const id of row.ids){const q=V().fromBufferAttribute(p,id).applyMatrix4(result.inverse);if(q.distanceTo(new T.Vector3(...row.before))>1e-7)throw Error('Male nasal cage source mismatch '+id);const delta=new T.Vector3(...row.delta).applyMatrix3(new T.Matrix3().setFromMatrix4(result.bind)),out=V().fromBufferAttribute(p,id).add(delta);p.setXYZ(id,out.x,out.y,out.z);}
 const sums=Array.from({length:p.count},V),buckets=new Map();for(let f=0;f<g.index.count;f+=3){const ids=[0,1,2].map(k=>g.index.getX(f+k)),q=ids.map(i=>V().fromBufferAttribute(p,i)),cross=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));for(const i of ids)sums[i].add(cross);}
 for(let i=0;i<p.count;i++){const key=V().fromBufferAttribute(p,i).toArray().map(v=>Math.round(v*1e6)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}for(const ids of buckets.values()){const fan=ids.reduce((v,i)=>v.add(sums[i]),V()).normalize();for(const i of ids)sums[i]=fan;}
 for(const i of NOSE.normalSupport){const fan=sums[i];if(fan.lengthSq()<.5||!fan.toArray().every(Number.isFinite))throw Error('Male nasal normal invalid '+i);n.setXYZ(i,fan.x,fan.y,fan.z);}
 p.needsUpdate=true;n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();g.userData.maleNasalCage1={scope:NOSE.scope,changedIDs:NOSE.changes.flatMap(r=>r.ids),normalSupport:NOSE.normalSupport,maxDisplacementM:NOSE.maxActualM};result.local.dispose();result.local=g.clone().applyMatrix4(result.inverse);return result;
}


// Authored joined oral exterior contour over the exact established face. Only guarded source
// position IDs and transported smooth normals change; all other buffers stay exact.
export function prepareRiderHead(T,...args){
 const result=preparePreviousHead(T,...args),data=LIP_SCULPTS[args[4]];if(!data)return result;
 const g=result.mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
 if(p.count!==data.counts.vertices||g.index.count/3!==data.counts.triangles)throw Error('Lip76c4 topology mismatch');
 const deltaMatrix=new T.Matrix3().setFromMatrix4(result.bind),normalMatrix=new T.Matrix3().getNormalMatrix(result.bind),v=new T.Vector3(),before=new T.Vector3(),delta=new T.Vector3();
 for(const row of data.changes){
  v.fromBufferAttribute(p,row.id).applyMatrix4(result.inverse);before.fromArray(row.before);
  if(v.distanceTo(before)>1e-7)throw Error('Lip76c4 source mismatch '+args[4]+'/'+row.id);
  delta.fromArray(row.after).sub(before).applyMatrix3(deltaMatrix);v.fromBufferAttribute(p,row.id).add(delta);p.setXYZ(row.id,v.x,v.y,v.z);
 }
 for(const row of data.normalChanges){v.fromArray(row.normal).applyMatrix3(normalMatrix).normalize();if(!v.toArray().every(Number.isFinite)||v.lengthSq()<.5)throw Error('Lip76c4 normal invalid '+row.id);n.setXYZ(row.id,v.x,v.y,v.z);}
 p.needsUpdate=true;n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.joinedLipContour76c4={scope:data.scope,sourceSHA256:data.sourceSHA256,changedIDs:data.changes.map(r=>r.id),normalSupport:data.normalChanges.map(r=>r.id),maxDisplacementMm:data.guard.maxDisplacementMm,topologyPreserved:true,normalMethod:'upper authored transport; lower emitted tangent-frame rotation'};
 result.local.dispose();result.local=g.clone().applyMatrix4(result.inverse);return result;
}
