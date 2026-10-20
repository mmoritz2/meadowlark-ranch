import {HEAD94} from './rider-authored-head-data94.mjs?v=character-redesign98-20261020';
import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
function typed(encoded,Type){const raw=atob(encoded),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new Type(bytes.buffer);}
function buffers(data){if(data.decoded)return data.decoded;const b=data.buffers;return data.decoded={positionIDs:typed(b.positionIDs,Uint16Array),sourcePositions:typed(b.sourcePositions,Float64Array),localDeltas:typed(b.localDeltas,Float32Array),normalIDs:typed(b.normalIDs,Uint16Array),normals:typed(b.normals,Float32Array)};}
export function installAuthoredHead94(T,asset,body){
 const data=HEAD94[body],g=asset.mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
 if(p.count!==data.counts.vertices||g.index.count/3!==data.counts.triangles)throw Error('Authored94 published topology mismatch');
 const pigmentSource=new Float32Array(p.count*3),sourcePoint=new T.Vector3();for(let i=0;i<p.count;i++){sourcePoint.fromBufferAttribute(p,i).applyMatrix4(asset.inverse);pigmentSource.set(sourcePoint.toArray(),i*3);}g.setAttribute('artistFaceCoord',new T.Float32BufferAttribute(pigmentSource,3));
 const b=buffers(data),v=new T.Vector3(),linear=new T.Matrix3().setFromMatrix4(asset.bind),normalMatrix=new T.Matrix3().getNormalMatrix(asset.bind);
 for(let i=0;i<b.positionIDs.length;i++){const id=b.positionIDs[i];v.fromBufferAttribute(p,id).applyMatrix4(asset.inverse);if(v.distanceTo(new T.Vector3().fromArray(b.sourcePositions,i*3))>1e-7)throw Error('Authored94 source correspondence mismatch '+body+'/'+id);const d=new T.Vector3().fromArray(b.localDeltas,i*3).applyMatrix3(linear);v.fromBufferAttribute(p,id).add(d);p.setXYZ(id,...v.toArray());}
 for(let i=0;i<b.normalIDs.length;i++){const id=b.normalIDs[i];v.fromArray(b.normals,i*3).applyMatrix3(normalMatrix).normalize();if(!v.toArray().every(Number.isFinite))throw Error('Authored94 invalid normal');n.setXYZ(id,...v.toArray());}
 p.needsUpdate=true;n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.authoredHead94={source:data.headSource,sourceHeadCaptureSHA256:data.sourceHeadCaptureSHA256,changedIDs:Array.from(b.positionIDs),normalSupport:Array.from(b.normalIDs),body84:data.bodyBoundary,startingEarRelief:data.sourceEarReliefIDs,maxDisplacementM:data.maximumActualDisplacementM,qualityStatus:'UNREVIEWED_MACRO_ART_CANDIDATE'};
 const previousLocal=asset.local,nextLocal=g.clone().applyMatrix4(asset.inverse),oldSurface=createTriangleSurface(T,previousLocal),newSurface=createTriangleSurface(T,nextLocal),bp=asset.brows.geometry.attributes.position;
 let browRefits=0,maxBrowRefitM=0;
 try{for(let i=0;i<bp.count;i++){
  const before=new T.Vector3().fromBufferAttribute(bp,i).applyMatrix4(asset.inverse),origin=new T.Vector3(before.x,before.y,.3),direction=new T.Vector3(0,0,-1),oldHit=oldSurface.cast(origin,direction),newHit=newSurface.cast(origin,direction);
  if(!oldHit||!newHit)throw Error('Authored94 brow projection missing');
  const gap=before.z-oldHit.point.z,after=before.clone();after.z=newHit.point.z+gap;maxBrowRefitM=Math.max(maxBrowRefitM,after.distanceTo(before));after.applyMatrix4(asset.bind);bp.setXYZ(i,...after.toArray());browRefits++;
 }}finally{oldSurface.dispose();newSurface.dispose();previousLocal.dispose();}
 bp.needsUpdate=true;asset.brows.geometry.computeVertexNormals();asset.brows.geometry.computeBoundingSphere();asset.local=nextLocal;asset.config={...asset.config,mouth:asset.config.mouth};asset.authoredHead94=true;
 g.userData.authoredHead94.browRefit={vertices:browRefits,maxDisplacementM:maxBrowRefitM,actualIndexedBeforeAfterSurface:true};g.userData.authoredHead94.pigment={sourceCoordinates:'Actual before-morph indexed Head-local coordinates',method:'Attached per-vertex source coordinates',medianShiftApplied:false};return asset;
}
