/* Actual long sculpted Fjord tail clearance after the unchanged horse solver.
 * Rest art stays untouched. This candidate's tail lifts about its anatomical
 * root during locomotion instead of following a torso support drop into soil. */
import {createArtistMotion} from './artist-horse-motion.js';

export function createFjordMotion({THREE,root,skin,heightM,profile}){
  const core=createArtistMotion({THREE,root,skin,heightM,profile});
  if(!core)return null;
  const tail=skin.skeleton.bones.find(b=>b.name.replace(/[.\s]/g,'')==='tail1');
  if(!tail)throw new Error('Fjord source tail root missing');
  const samples=[],point=new THREE.Vector3(),inverse=new THREE.Matrix4(),matrix=new THREE.Matrix4(),transform=new THREE.Matrix4(),axis=new THREE.Vector3(1,0,0),extra=new THREE.Quaternion();
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight,ids=new Set(mesh.skeleton.bones.map((b,i)=>/^tail/.test(b.name)?i:-1).filter(i=>i>=0));
    const indices=[];
    for(let i=0;i<p.count;i++){let owned=0;for(let k=0;k<4;k++)if(ids.has(j.getComponent(i,k)))owned+=w.getComponent(i,k);if(owned>=.05&&p.getY(i)<1.35)indices.push(i);}
    if(indices.length){const positions=new Float64Array(indices.length*3);for(let n=0;n<indices.length;n++)point.fromBufferAttribute(p,indices[n]).applyMatrix4(mesh.bindMatrix).toArray(positions,n*3);samples.push({mesh,indices,positions,rows:new Float64Array(mesh.skeleton.bones.length*4)});}
  });
  if(!samples.length)throw new Error('No actual Fjord tail-owned surfaces');
  let liftAngle=0,minTailY=Infinity,maxRequiredAngle=0,ground=-Infinity;
  const p=skin.geometry.attributes.position;ground=Infinity;for(let i=0;i<p.count;i++)ground=Math.min(ground,p.getY(i));
  const top=p.array.reduce((a,v,i)=>i%3===1?Math.max(a,v):a,-Infinity),metres=heightM?heightM/(top-ground):1,margin=.005/metres;
  function minimum(){
    root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();let low=Infinity;
    // Exact linear skin evaluation, retaining every selected source point.
    // Only the Y row is needed; precomputed rest coordinates avoid thousands
    // of temporary Three vectors during the finite clearance search.
    for(const {mesh,indices,positions,rows} of samples){
      transform.multiplyMatrices(inverse,mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
      for(let k=0;k<mesh.skeleton.bones.length;k++){matrix.multiplyMatrices(transform,mesh.skeleton.bones[k].matrixWorld).multiply(mesh.skeleton.boneInverses[k]);const e=matrix.elements;rows.set([e[1],e[5],e[9],e[13]],k*4);}
      const j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
      for(let n=0;n<indices.length;n++){const i=indices[n],x=positions[n*3],y=positions[n*3+1],z=positions[n*3+2];let value=0;for(let k=0;k<4;k++){const a=j.getComponent(i,k)*4;value+=w.getComponent(i,k)*(rows[a]*x+rows[a+1]*y+rows[a+2]*z+rows[a+3]);}low=Math.min(low,value);}
    }
    return low;
  }
  function clear(dt,immediate=false){
    if(core.mode==='rest'){liftAngle=0;minTailY=minimum();return;}
    const original=tail.quaternion.clone();
    const apply=angle=>{tail.quaternion.copy(original).multiply(extra.setFromAxisAngle(axis,angle));return minimum();};
    // Lift only enough to clear the actual source surface. Releasing at a
    // bounded angular speed keeps the long tail from snapping downward.
    let required=0,low=apply(0);
    if(low<ground+margin){let lo=0,hi=1.48;if(apply(hi)<ground+margin)throw new Error('Fjord tail cannot clear actual surface at its anatomical pivot');for(let i=0;i<11;i++){const middle=(lo+hi)/2;if(apply(middle)<ground+margin)lo=middle;else hi=middle;}required=hi;}
    liftAngle=immediate?required:Math.max(required,liftAngle-Math.max(0,dt)*1.15);
    minTailY=apply(liftAngle);maxRequiredAngle=Math.max(maxRequiredAngle,required);
  }
  clear(0,true);
  return {gaits:core.gaits,size:core.size,setTurn:v=>core.setTurn(v),
    get mode(){return core.mode;},get state(){return {...core.state,tailLiftAngle:liftAngle};},
    set(gait,options){core.set(gait,options);if(core.mode==='rest'){liftAngle=0;minTailY=minimum();}},
    reset(){core.reset();liftAngle=0;maxRequiredAngle=0;clear(0,true);},
    update(dt){core.update(dt);clear(dt);},
    snapshot(){const snapshot=core.snapshot();root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();return {...snapshot,bonePositions:skin.skeleton.bones.map(b=>{point.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inverse);point.y-=ground;return point.multiplyScalar(metres).toArray();}),localPositions:skin.skeleton.bones.map(b=>b.position.toArray()),localQuaternions:skin.skeleton.bones.map(b=>b.quaternion.toArray()),tailClearance:{minY:(minTailY-ground)*metres,liftAngle,maxRequiredAngle,samples:samples.map(s=>({mesh:s.mesh.name,vertices:s.indices.length}))}};}
  };
}
