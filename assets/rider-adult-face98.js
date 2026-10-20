// Coherent adult proportion pass over the actual prepared P5 head, eyes and
// brows. This changes the eye aperture and oral volume together; the skin
// shader and refitted fine lashes follow the resulting surfaces.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
export function installAdultFace98(T,asset,body){
 const female=body==='f',cx=female?.03431453:.03320741,cy=female?.09881232:.09402493,mouth=asset.config.mouth;
 const eyeScaleX=female?.84:.90,eyeScaleY=female?.78:.86;
 const morph=p=>{
  const q=p.clone(),ax=Math.abs(p.x),side=Math.sign(p.x),dx=ax-cx,dy=p.y-cy;
  const front=smooth(.030,.062,p.z),eye=(1-smooth(.025,.049,Math.abs(dx)))*(1-smooth(.020,.045,Math.abs(dy)))*smooth(.007,.017,ax)*front;
  q.x-=side*dx*(1-eyeScaleX)*eye;q.y-=dy*(1-eyeScaleY)*eye;
  // Broad supraorbital relief removes the stern projecting shelf, while the
  // connected cheek lift supports the smaller lower lid without a hard ring.
  const shelf=Math.exp(-Math.pow(dx/.030,4)-Math.pow((p.y-(cy+.026))/.016,2))*front;
  q.z-=(female?.0017:.0032)*shelf;
  const cheek=Math.exp(-Math.pow((ax-(cx+.009))/.028,4)-Math.pow((p.y-(cy-.024))/.020,2))*front;
  q.z+=(female?.0009:.0012)*cheek;
  const oral=(1-smooth(.031,.056,ax))*smooth(-.014,.009,p.y)*(1-smooth(.057,.082,p.y))*smooth(female?.050:.070,female?.077:.096,p.z);
  q.x-=p.x*(female?.055:.040)*oral;
  q.y-=(p.y-mouth)*(female?.18:.14)*oral;
  q.z-=(female?.0040:.0048)*oral;
  const corner=Math.exp(-Math.pow((ax-(female?.025:.029))/.010,2)-Math.pow((p.y-mouth)/.010,2))*front;
  q.y+=(female?.0011:.0013)*corner;
  const mouthFinish=1-smooth(mouth+.012,mouth+.022,p.y);
  q.y+=.0007*corner*mouthFinish;
  const lowerLip=Math.exp(-Math.pow(ax/(female?.028:.032),4)-Math.pow((p.y-(mouth-.006))/.009,4))*smooth(female?.055:.075,female?.080:.100,p.z);
  q.z-=.0014*lowerLip*mouthFinish;q.y+=.0004*lowerLip*mouthFinish;
  // The nasal envelope remains attached to the middle face as the oral mound
  // relaxes, avoiding a sharp projecting nose over a newly flattened mouth.
  const nose=(1-smooth(.021,.038,ax))*smooth(.051,.064,p.y)*(1-smooth(.093,.108,p.y))*smooth(female?.066:.080,female?.089:.103,p.z);
  q.x-=p.x*.08*nose;q.z-=(female?.0014:.0020)*nose;
  return q;
 };
 const normalToHead=new T.Matrix3().getNormalMatrix(asset.inverse),normalToBind=new T.Matrix3().getNormalMatrix(asset.bind),step=.00001;
 const summary={body,eyeScaleX,eyeScaleY,oralRetractionM:female?.0040:.0048,oralHeightScale:female?.82:.86,relaxedExpression3:{lowerLipRetractionM:.0014,lowerLipRiseM:.0004,cornerLiftM:female?.0018:.0020},normalMethod:'Numerical local deformation Jacobian inverse transpose, same coherent field on head/eyes/brows',meshes:[]};
 for(const [name,mesh]of [['head',asset.mesh],['eyes',asset.eyes],['brows',asset.brows]]){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,old=p.array.slice(),metrics={name,vertices:p.count,changed:0,maxDisplacementM:0,minJacobianDeterminant:Infinity};
  for(let i=0;i<p.count;i++){
   const point=new T.Vector3().fromArray(old,i*3).applyMatrix4(asset.inverse),after=morph(point),d=after.distanceTo(point);if(d<1e-11)continue;
   const columns=[];for(let k=0;k<3;k++){const a=point.clone(),b=point.clone();a.setComponent(k,a.getComponent(k)+step);b.setComponent(k,b.getComponent(k)-step);columns.push(morph(a).sub(morph(b)).multiplyScalar(1/(2*step)));}
   const J=new T.Matrix3().set(columns[0].x,columns[1].x,columns[2].x,columns[0].y,columns[1].y,columns[2].y,columns[0].z,columns[1].z,columns[2].z),det=J.determinant();
   if(!(det>.15)&&Number.isFinite(det))throw Error('AdultFace98 local fold '+name+'/'+i+'/'+det);
   const normal=new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalToHead).applyMatrix3(J.invert().transpose()).applyMatrix3(normalToBind).normalize();
   if(![...after.toArray(),...normal.toArray(),det].every(Number.isFinite))throw Error('AdultFace98 nonfinite '+name+'/'+i);
   after.applyMatrix4(asset.bind);p.setXYZ(i,...after.toArray());n.setXYZ(i,...normal.toArray());metrics.changed++;metrics.maxDisplacementM=Math.max(metrics.maxDisplacementM,d);metrics.minJacobianDeterminant=Math.min(metrics.minJacobianDeterminant,det);
  }
  p.needsUpdate=true;n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();summary.meshes.push(metrics);
 }
 asset.local.dispose();asset.local=asset.mesh.geometry.clone().applyMatrix4(asset.inverse);
 asset.adultFace98={...summary,lashes:{length:.62,fan:.52,radius:.57}};
 asset.mesh.geometry.userData.adultFace98=asset.adultFace98;
 return asset;
}
