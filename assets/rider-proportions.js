/* Shape the female bind pose as one continuous surface, then rebind the skeleton.
   Clothes sample this same surface; fingers and riding anchors use the new joints. */
export function refineRiderProportions(THREE,scene,skin,body){
 if(body!=='f')return 0;
 if(scene.userData.proportionLift)return scene.userData.proportionLift;
 scene.updateMatrixWorld(true);
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const bones=skin.skeleton.bones,by=Object.fromEntries(bones.map(b=>[b.name,b]));
 const pelvis=by.pelvis.getWorldPosition(new THREE.Vector3()),wrist=by.hand_l.getWorldPosition(new THREE.Vector3()),lift=.092;
 const warp=p=>{
  const y=p.y,ax=Math.abs(p.x),side=Math.sign(p.x)||1;
  const torso=smooth(.72,.94,y)*(1-smooth(1.34,1.48,y))*(1-smooth(.175,.265,ax));
  p.x*=1-.075*torso;p.z=-.03+(p.z+.03)*(1-.04*torso);
  // Taper into a slightly smaller hand without a step at the wrist.
  const hand=smooth(wrist.x-.045,wrist.x+.016,ax)*smooth(wrist.y-.14,wrist.y-.07,y),scale=1-.10*hand;
  if(hand){p.x=side*wrist.x+(p.x-side*wrist.x)*scale;p.y=wrist.y+(p.y-wrist.y)*scale;p.z=wrist.z+(p.z-wrist.z)*scale;}
  p.y+=lift*smooth(.12,pelvis.y,y);return p;
 };
 const bindPositions=new Map(bones.map(b=>[b,warp(b.getWorldPosition(new THREE.Vector3()))])),meshes=[];
 scene.traverse(m=>{if(m.isSkinnedMesh)meshes.push(m);});
 for(const m of meshes){
  const p=m.geometry.attributes.position,inverse=m.matrixWorld.clone().invert(),v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);warp(v).applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);}
  p.needsUpdate=true;m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();
 }
 // Parent-first updates preserve each bone's bind rotation while moving its center.
 scene.traverse(b=>{if(!bindPositions.has(b))return;b.position.copy(b.parent.worldToLocal(bindPositions.get(b).clone()));b.updateMatrixWorld(true);});
 scene.updateMatrixWorld(true);
 for(const skeleton of new Set(meshes.map(m=>m.skeleton))){skeleton.calculateInverses();skeleton.update();}
 for(const m of meshes)m.bind(m.skeleton,m.matrixWorld);
 scene.userData.proportionLift=lift;return lift;
}
