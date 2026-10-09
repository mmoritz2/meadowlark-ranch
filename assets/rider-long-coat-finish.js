import {finishCoatHem} from './rider-coat-hem.js?v=character-polish-20261009';
import {fitLowerLayer} from './rider-garment-layer-fit.js?v=character-polish-20261009';
import {showJacketFinish} from './rider-show-jacket-finish.js?v=character-polish-20261009';

// Extend the original connected lower coat with its inherited pelvis/thigh
// weights. The actual seated fit remains an art check for this candidate.
export function longCoatFinish(T,kit,garment,data,options={}){
 const a=garment.geometry.attributes,hem=Math.max(...data.boundaryLoops.find(l=>l.label==='hem').ids.map(i=>a.position.getY(i))),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 for(let i=0;i<a.position.count;i++){
  const x=a.position.getX(i),y=a.position.getY(i),z=a.position.getZ(i),lower=(1-smooth((y-hem)/.18))*(1-smooth((Math.abs(x)-.16)/.12));
  a.position.setXYZ(i,x*(1+.028*lower),y+(-.042+.072*smooth((z+.065)/.115))*lower,z*(1+.018*lower));
 }
 garment.geometry.computeVertexNormals();garment.geometry.computeBoundingSphere();
 const lowerFit=fitLowerLayer(T,kit,garment,{clearance:.008});
 const result=showJacketFinish(T,kit,garment,data,options);
 result.pieces.push(finishCoatHem(T,garment,data,options.color));
 return{...result,evidence:{...result.evidence,lowerFit,hemFacingWidthM:.006,hemThicknessM:.0013,style:options.recipe?.id==='tweed'?'long tweed hack coat':'long hunt coat',backHemExtensionM:.042,frontCutawayRiseM:.030}};
}
