// Original surface growth for the Island Tree scan's 44,168 separate quads.
// Each scanned quad grows uniformly about its own retained center, never an
// inferred botanical petiole. UV, authored normals, indices and wood stay exact.
// Caps preserve the original XYZ and all eight view projection extrema.
export const ISLAND_LEAF_FACTOR=1.25;
export const ISLAND_LEAF_SOURCE=Object.freeze({
  modelSha256:'04a80fe9c2584bbea686cf9637009dd03b48905b229773c17a8cc611e8d21b58',
  vertices:176672,indices:265008,quads:44168,
  positionFnv:'23668056',normalFnv:'3600978d',indexUint32Fnv:'be2f3545',
});
const assert=(ok,message)=>{if(!ok)throw Error('Island leaf source: '+message);};
function byteFnv(array){let h=2166136261;for(const b of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))h=Math.imul(h^b,16777619);return(h>>>0).toString(16).padStart(8,'0');}
const directions=Object.freeze([[1,0,0],[0,1,0],[0,0,1],...Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4),0,-Math.sin(i*Math.PI/4)])].map(Object.freeze));

export function growIslandLeafArrays(positions,indices){
  const source=ISLAND_LEAF_SOURCE;
  assert(positions instanceof Float32Array&&positions.length===source.vertices*3,'contiguous source POSITION required');
  const index32=indices instanceof Uint32Array?indices:Uint32Array.from(indices);
  assert(index32.length===source.indices&&byteFnv(positions)===source.positionFnv&&byteFnv(index32)===source.indexUint32Fnv,'unknown position/index buffers');
  // The reviewed original consists of four unique vertices per indexed quad.
  // Validate those connected surfaces rather than assuming arbitrary chunks.
  for(let q=0;q<source.quads;q++){
    const v=q*4,i=q*6,pattern=[v,v+1,v+2,v,v+3,v+1];
    for(let k=0;k<6;k++)assert(index32[i+k]===pattern[k],'quad connectivity mismatch');
  }
  const low=directions.map(()=>Infinity),high=directions.map(()=>-Infinity);
  for(let i=0;i<positions.length;i+=3)for(let d=0;d<directions.length;d++){
    const a=directions[d],v=positions[i]*a[0]+positions[i+1]*a[1]+positions[i+2]*a[2];
    low[d]=Math.min(low[d],v);high[d]=Math.max(high[d],v);
  }
  const output=positions.slice();let full=0,limited=0,held=0,maxDisplacement=0,maxCenterError=0;
  for(let q=0;q<source.quads;q++){
    const start=q*12,center=[0,0,0];
    for(let v=0;v<4;v++)for(let a=0;a<3;a++)center[a]+=positions[start+v*3+a]*.25;
    let factor=ISLAND_LEAF_FACTOR;
    for(let d=0;d<directions.length;d++){
      const axis=directions[d],origin=center[0]*axis[0]+center[1]*axis[1]+center[2]*axis[2];
      for(let v=0;v<4;v++){
        const i=start+v*3,offset=(positions[i]-center[0])*axis[0]+(positions[i+1]-center[1])*axis[1]+(positions[i+2]-center[2])*axis[2];
        if(offset>1e-12)factor=Math.min(factor,(high[d]-origin)/offset);
        else if(offset< -1e-12)factor=Math.min(factor,(low[d]-origin)/offset);
      }
    }
    factor=Math.max(1,factor);
    if(factor<ISLAND_LEAF_FACTOR){limited++;if(factor===1)held++;else factor=1+(factor-1)*.999999;}else full++;
    // Held extrema retain their original bytes. The tiny inward safety margin
    // above prevents Float32 rounding from expanding a capped view envelope.
    if(factor===1)continue;
    const nextCenter=[0,0,0];
    for(let v=0;v<4;v++){
      const i=start+v*3;
      for(let a=0;a<3;a++){output[i+a]=center[a]+(positions[i+a]-center[a])*factor;nextCenter[a]+=output[i+a]*.25;}
      maxDisplacement=Math.max(maxDisplacement,Math.hypot(output[i]-positions[i],output[i+1]-positions[i+1],output[i+2]-positions[i+2]));
    }
    maxCenterError=Math.max(maxCenterError,...center.map((v,i)=>Math.abs(v-nextCenter[i])));
  }
  const stats=Object.freeze({profile:'island-leaf-surfaces-1',factor:ISLAND_LEAF_FACTOR,quads:source.quads,vertices:source.vertices,triangles:source.indices/3,fullFactorQuads:full,limitedQuads:limited,heldQuads:held,maxDisplacement,maxCenterError,positionFnv:byteFnv(output)});
  return {positions:output,stats};
}

const prepared=new WeakMap();
export function applyIslandLeafSurfaces(THREE,geometry){
  if(prepared.has(geometry))return prepared.get(geometry);
  const p=geometry?.attributes?.position,n=geometry?.attributes?.normal,index=geometry?.index;
  assert(p&&n&&index&&p.count===ISLAND_LEAF_SOURCE.vertices&&n.count===p.count,'indexed source geometry required');
  assert(!geometry.attributes.canopyShade,'apply before canopy occlusion preparation');
  const positions=new Float32Array(p.count*3),normals=new Float32Array(n.count*3),indices=new Uint32Array(index.count);
  for(let i=0;i<p.count;i++){const j=i*3;positions[j]=p.getX(i);positions[j+1]=p.getY(i);positions[j+2]=p.getZ(i);normals[j]=n.getX(i);normals[j+1]=n.getY(i);normals[j+2]=n.getZ(i);}
  assert(byteFnv(normals)===ISLAND_LEAF_SOURCE.normalFnv,'unknown authored normals');
  for(let i=0;i<index.count;i++)indices[i]=index.getX(i);
  const result=growIslandLeafArrays(positions,indices);
  // Reuse the loaded geometry object. BufferAttribute does not allocate a
  // Three UUID or consume RNG before subsequent deterministic scenery builds.
  geometry.setAttribute('position',new THREE.BufferAttribute(result.positions,3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.islandLeafSurfaces=result.stats;prepared.set(geometry,result.stats);
  return result.stats;
}
