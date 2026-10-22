/* A narrower outer hip silhouette, shared by the female body and every garment.
 * Inner seat contact, skeleton, inverse binds, weights and footwear stay exact. */
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function caninoHipInset101(x,y){
 return .026*smooth(.66,.84,y)*(1-smooth(1.02,1.20,y))*smooth(.095,.1825,Math.abs(x));
}
export function installCaninoFit101(T,rig){
 if(!rig.canino100||rig.caninoFit101)return rig;
 const fitted=new WeakSet(),stats={geometries:0,vertices:0,maxInsetM:0,refreshes:0};let disposed=false,nesting=0;
 function needsFit(mesh){
  if(!mesh.isSkinnedMesh||fitted.has(mesh.geometry)||mesh.userData.riderSurfaceRole==='footwear'||/Feet|Boot/.test(mesh.name))return false;
  const p=mesh.geometry.attributes.position;if(!p)return false;
  for(let i=0;i<p.count;i++)if(caninoHipInset101(p.getX(i),p.getY(i))>0)return true;
  fitted.add(mesh.geometry);return false;
 }
 function apply(){
  if(disposed||rig.disposed)return;
  const meshes=[];rig.root.traverse(mesh=>{if(needsFit(mesh))meshes.push(mesh);});
  if(!meshes.length)return;
  // Coat and overall transports cache their rest surface. Rebuild those caches
  // from the fitted cut so subsequent motion cannot restore the wider shape.
  rig.clothingPose?.release();
  const unique=new Set();
  for(const mesh of meshes){
   const g=mesh.geometry;if(unique.has(g))continue;unique.add(g);fitted.add(g);
   const p=g.attributes.position;let changed=0,maxInset=0;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),inset=caninoHipInset101(x,p.getY(i));if(!inset)continue;
    p.setX(i,x-Math.sign(x)*inset);changed++;maxInset=Math.max(maxInset,inset);
   }
   p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
   if(g.attributes.tangent&&g.attributes.uv&&g.index)g.computeTangents();
   g.userData.caninoFit101={changedVertices:changed,maxInsetM:maxInset,innerContactPreservedM:.095};
   stats.geometries++;stats.vertices+=changed;stats.maxInsetM=Math.max(stats.maxInsetM,maxInset);
  }
  rig.clothingPose?.update();stats.refreshes++;
 }
 const oldLook=rig.setLook,oldOutfit=rig.setOutfit,oldDispose=rig.dispose;
 rig.setLook=function(...args){nesting++;try{return oldLook.apply(this,args);}finally{if(!--nesting)apply();}};
 rig.setOutfit=function(id,callback){return oldOutfit.call(this,id,()=>{apply();callback?.();});};
 rig.dispose=function(...args){if(disposed)return;disposed=true;return oldDispose.apply(this,args);};
 rig.caninoFit101={apply,evidence:()=>({...stats,insetM:.026,innerContactPreservedM:.095,bonesChanged:false})};
 apply();return rig;
}
