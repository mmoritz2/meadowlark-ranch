import {prepareRiderHead as prepareFemale2} from './rider-head-contour.js?v=character-polish-20261009';
export {patchStylizedHead,patchStylizedEyes} from './rider-head-contour.js?v=character-polish-20261009';
import {FACE_CAGE} from './rider-face-profile-data.js?v=character-polish-20261009';
export function prepareRiderHead(T,skin,oldEyes,oldBrows,source,body,asset,nativeGeometry){
 const result=prepareFemale2(T,skin,oldEyes,oldBrows,source,body,asset,nativeGeometry);if(body!=='f')return result;
 const g=result.mesh.geometry,p=g.attributes.position,n=g.attributes.normal,V=()=>new T.Vector3(),beforeNormal=n.array.slice(),inv=result.inverse,bind=result.bind,edited=[];
 // Explicit frozen source-ID cage only. No coordinate-based deformer, ownership,
 // topology, shader or eye feature edits occur at runtime.
 for(const row of FACE_CAGE.changes)for(const id of row.ids){const q=V().fromBufferAttribute(p,id).applyMatrix4(inv);if(q.distanceTo(new T.Vector3(...row.before))>1e-7)throw Error('Female face cage source mismatch '+id);const delta=new T.Vector3(...row.delta).applyMatrix3(new T.Matrix3().setFromMatrix4(bind));if(delta.length()>FACE_CAGE.maximumM+1e-10)throw Error('Female face cage exceeds budget');const b=V().fromBufferAttribute(p,id).add(delta);p.setXYZ(id,b.x,b.y,b.z);edited.push(id);}
 // Only a narrow external normal support can change. Rebuild the actual final
 // connected surface fan and weld aliases; preserve exact fixed feature normals outside the sculpt.
 const buckets=new Map(),sums=Array.from({length:p.count},V);for(let f=0;f<g.index.count;f+=3){const ids=[0,1,2].map(k=>g.index.getX(f+k)),qs=ids.map(i=>V().fromBufferAttribute(p,i)),cross=qs[2].clone().sub(qs[1]).cross(qs[0].clone().sub(qs[1]));for(const id of ids)sums[id].add(cross);}for(let i=0;i<p.count;i++){const key=V().fromBufferAttribute(p,i).toArray().map(v=>Math.round(v*1e6)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}for(const ids of buckets.values()){const fan=ids.reduce((v,i)=>v.add(sums[i]),V()).normalize();for(const i of ids)sums[i]=fan;}
 const normalChanges=[];for(const[idText,alpha]of Object.entries(FACE_CAGE.normalBlend)){const id=Number(idText),prior=V().fromArray(beforeNormal,id*3),fan=sums[id];if(fan.lengthSq()<.5||fan.dot(prior)<.60)throw Error('Female face fan outward guard '+id);const out=prior.clone().lerp(fan,alpha).normalize();n.setXYZ(id,out.x,out.y,out.z);normalChanges.push({id,blend:alpha,turnDeg:prior.angleTo(out)*180/Math.PI});}
 p.needsUpdate=true;n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();result.local.dispose();result.local=g.clone().applyMatrix4(inv);g.userData.femaleFaceCage3={scope:FACE_CAGE.scope,maximumM:FACE_CAGE.maximumM,maxActualM:FACE_CAGE.maxActualM,changedIDs:edited,normalChangedIDs:normalChanges.map(r=>r.id),normalChanges,protectedIDs:FACE_CAGE.protectedIDs,sourceHeadDumpSHA:FACE_CAGE.sourceHeadDumpSHA,method:FACE_CAGE.method};return result;
}
