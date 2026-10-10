/* Sparse breastcollar attachment on private native draft geometry. The body,
 * skeleton, clips and source morph blocks retain their existing data. */
const SOURCE_SHA='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07';
const MORPH_BYTES=728256,TACK_VERTICES=13895,JOINTS=677;
// Complete source collar islands, including duplicated seams. This excludes
// fenders, irons, girth, headstall, reins and the separate saddle surface.
const COLLAR_RANGES=[[0,43],[76,196],[426,531],[754,976],[3348,3428],[3601,3823],[4053,4158],[5369,5393],[5517,5690],[5826,5999],[7416,7646],[8356,8586],[9508,9738],[9782,9802],[9810,9855],[9892,10064],[11392,11412],[11522,11542],[12073,12224]];
const allowed=id=>COLLAR_RANGES.some(([lo,hi])=>id>=lo&&id<=hi);
const fail=reason=>{throw Error('Invalid native breastcollar attachment: '+reason);};
export function applyNativeCollarAttachment({THREE,mesh,record,binary,profile}){
 if(!record)return null;
 if(record.version!==1||record.meshIndex!==3||record.sourceSha256!==SOURCE_SHA||
    !['shire','percheron','clyde'].includes(profile?.nativeVariant?.id)||
    profile?.nativeKind!=='horse'||!profile?.nativeRoster)fail('source profile');
 const geometry=mesh?.geometry,a=geometry?.attributes;
 if(!mesh?.isSkinnedMesh||mesh.skeleton?.bones.length!==JOINTS||a?.position?.count!==TACK_VERTICES||
    a.normal?.count!==TACK_VERTICES||a.skinIndex?.count!==TACK_VERTICES||a.skinWeight?.count!==TACK_VERTICES||
    a.position.itemSize!==3||a.normal.itemSize!==3||a.skinIndex.itemSize!==4||a.skinWeight.itemSize!==4)fail('source topology');
 const count=record.vertexCount;
 if(!Number.isInteger(count)||count<1||count>2404||!(binary instanceof ArrayBuffer))fail('vertex count or buffer');
 const intervals=[],arrays={};
 for(const [name,type,size]of [['vertexIds','uint16',1],['position','float32',3],['normal','float32',3],['skinIndex','uint16',4],['skinWeight','float32',4]]){
  const d=record[name],Ctor=type==='uint16'?Uint16Array:Float32Array,bytes=Ctor.BYTES_PER_ELEMENT;
  if(!d||d.componentType!==type||d.itemSize!==size||d.count!==count*size||
     !Number.isSafeInteger(d.byteOffset)||d.byteOffset<MORPH_BYTES||d.byteOffset%bytes!==0||
     d.byteOffset+d.count*bytes>binary.byteLength)fail(name+' descriptor');
  const end=d.byteOffset+d.count*bytes;
  if(intervals.some(([lo,hi])=>d.byteOffset<hi&&end>lo))fail('overlapping fields');
  intervals.push([d.byteOffset,end]);arrays[name]=new Ctor(binary,d.byteOffset,d.count);
 }
 const seen=new Set();
 for(let i=0;i<count;i++){
  const id=arrays.vertexIds[i];if(!allowed(id)||seen.has(id))fail('protected or duplicate vertex');seen.add(id);
  let sum=0,norm=0;
  for(let k=0;k<3;k++){
   const p=arrays.position[i*3+k],n=arrays.normal[i*3+k];
   if(!Number.isFinite(p)||!Number.isFinite(n))fail('nonfinite surface');norm+=n*n;
  }
  if(Math.abs(norm-1)>.002)fail('normal length');
  for(let k=0;k<4;k++){
   const joint=arrays.skinIndex[i*4+k],weight=arrays.skinWeight[i*4+k];
   if(joint>=JOINTS||!Number.isFinite(weight)||weight<0||weight>1)fail('skin influence');sum+=weight;
  }
  if(Math.abs(sum-1)>1e-4)fail('weight sum');
 }
 // All validation precedes mutation. The original geometry can be shared by
 // cached source assets or another instance, so even its attributes stay owned.
 const next=geometry.clone();
 next.userData=JSON.parse(JSON.stringify(geometry.userData||{}));
 for(const name of ['position','normal','skinIndex','skinWeight']){
  const old=a[name],values=new old.array.constructor(old.array),size=old.itemSize;
  for(let i=0;i<count;i++)for(let k=0;k<size;k++)values[arrays.vertexIds[i]*size+k]=arrays[name][i*size+k];
  next.setAttribute(name,new THREE.BufferAttribute(values,size,old.normalized));
 }
 next.computeBoundingBox();next.computeBoundingSphere();
 next.userData.nativeCollarAttachment={version:1,vertexCount:count,sourceSha256:SOURCE_SHA};
 mesh.geometry=next;
 return {version:1,vertices:count,mesh:mesh.name};
}
