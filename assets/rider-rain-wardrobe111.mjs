// The connected wardrobe is authored in the exact canonical bind frame used
// by Rain. Hidden source clothes must never act as a second fitting body.
// In particular a radial torso projection cannot represent two trouser legs:
// it closes the inseam and produces a pinched front and angular seat.
export function createRainWardrobeFit111(T,rig){
 const fitted=new WeakSet(),stats={geometries:0,vertices:0,maxDisplacementM:0,misses:0,smoothSurfaceGroups:0};
 function smoothSurfaceNormals(g){
  g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,groups=new Map(),unit=new T.Vector3(),sum=new T.Vector3();
  for(let i=0;i<p.count;i++){
   const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(':');
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
  }
  const source=n.array.slice();
  for(const ids of groups.values())if(ids.length>1){
   // Trimmed garment surfaces have separate corners for every triangle.
   // Average their smooth surface while retaining a sewn edge or sharp fold.
   for(const id of ids){unit.fromArray(source,id*3);sum.set(0,0,0);
    for(const j of ids){const dot=unit.x*source[j*3]+unit.y*source[j*3+1]+unit.z*source[j*3+2];if(dot>.5)sum.add(new T.Vector3().fromArray(source,j*3));}
    if(sum.lengthSq()>0){sum.normalize();n.setXYZ(id,sum.x,sum.y,sum.z);}
   }
   stats.smoothSurfaceGroups++;
  }
  n.needsUpdate=true;
 }
 function apply(){
  for(const mesh of rig.outfit?.meshes||[]){
   const g=mesh.geometry;if(!mesh.isSkinnedMesh||fitted.has(g))continue;fitted.add(g);
   // Geometry and skinning remain on their authored skeleton. No trunk/hip
   // raycast, clothing-on-clothing inflation, or one-axis crotch deformation.
   if(mesh.userData.riderSurfaceRole==='outer-shell')smoothSurfaceNormals(g);
   g.computeBoundingBox();g.computeBoundingSphere();stats.geometries++;stats.vertices+=g.attributes.position.count;
  }
 }
 return{apply,evidence:()=>({...stats,method:'authored-canonical-bind111',targetSurfaces:[],pantsGeometryPreserved:true,garmentSkinningPreserved:true}),dispose(){}};
}

// Clip covered skin in the posed lowerarm frame. Native hand-weight borders
// are not sleeve borders, and can leave isolated wrist fragments through cloth.
export function createRainSleeveMask111(T,rig){
 const sides=['l','r'],uniforms=sides.map(()=>({value:new T.Vector4()})),planes=sides.map((s,i)=>new T.Plane(new T.Vector3(i?-1:1,0,0),-.60)),matrix=new T.Matrix4(),posed=new T.Plane();
 const owners=sides.map(s=>'lowerarm_'+s),bindInverse=rig.body.bindMatrix.clone().invert(),elbowX=sides.map(s=>{
  const id=rig.body.skeleton.bones.indexOf(rig.bones['lowerarm_'+s]);
  return Math.abs(new T.Vector3().setFromMatrixPosition(rig.body.skeleton.boneInverses[id].clone().invert()).applyMatrix4(bindInverse).x);
 });
 const evidence={method:'posed-authored-cuff-plane111',underlapM:.001,cuffBindX:[.60,.60],ownerBones:owners};
 function measure(){
  const g=rig.connectedWardrobe?.top?.geometry,p=g?.attributes.position;if(!p)return;
  // Short cuts retain unused full-sleeve attributes; only drawn vertices count.
  const ids=g.index?new Set(g.index.array):Array.from({length:p.count},(_,i)=>i),ends=[0,0];
  for(const i of ids){const x=p.getX(i);ends[x<0?1:0]=Math.max(ends[x<0?1:0],Math.abs(x));}
  for(let i=0;i<2;i++)if(ends[i]>.1){planes[i].constant=-(ends[i]-.001);evidence.cuffBindX[i]=ends[i];owners[i]=(ends[i]<elbowX[i]?'upperarm_':'lowerarm_')+sides[i];}
 }
 function update(mesh){
  for(let i=0;i<2;i++){
   const bone=rig.bones[owners[i]],id=mesh.skeleton.bones.indexOf(bone);
   matrix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[id]).multiply(mesh.bindMatrix);
   posed.copy(planes[i]).applyMatrix4(matrix);uniforms[i].value.set(posed.normal.x,posed.normal.y,posed.normal.z,posed.constant);
  }
 }
 return{left:uniforms[0],right:uniforms[1],measure,update,evidence:()=>({...evidence,cuffBindX:evidence.cuffBindX.slice(),ownerBones:owners.slice()})};
}
