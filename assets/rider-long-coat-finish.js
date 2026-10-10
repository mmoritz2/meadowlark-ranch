import {coatHemDisplacement} from './rider-coat-cutaway.js?v=tailored-coats69-20261010';
import {finishCoatHem} from './rider-coat-hem.js?v=rider-fit74-20261010';
import {fitLowerLayer} from './rider-garment-layer-fit.js?v=tailored-coats69-20261010';
import {showJacketFinish} from './rider-show-jacket-finish.js?v=outward-lapels70-20261010';

// Curve the connected lower coat while retaining its inherited skin weights.
// Rear ease gives coarse shell edges clearance over the men's trouser ridge.
export function longCoatFinish(T,kit,garment,data,options={}){
 const a=garment.geometry.attributes,hem=Math.max(...data.boundaryLoops.find(l=>l.label==='hem').ids.map(i=>a.position.getY(i))),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 const rearEaseByVertex=new Float32Array(a.position.count);
 for(let i=0;i<a.position.count;i++){
  const x=a.position.getX(i),y=a.position.getY(i),z=a.position.getZ(i),lower=(1-smooth((y-hem)/.18))*(1-smooth((Math.abs(x)-.16)/.12));
  rearEaseByVertex[i]=kit.body==='m'?.0025*lower*(1-smooth((z+.070)/.070)):0;
  a.position.setXYZ(i,x*(1+.028*lower),y+coatHemDisplacement(x,z)*lower,z*(1+.018*lower));
 }
 garment.geometry.computeVertexNormals();garment.geometry.computeBoundingSphere();
 const lowerFit=fitLowerLayer(T,kit,garment,{clearance:.008});
 // Apply the rear reserve after fitting so the radial clamp cannot absorb it.
 for(let i=0;i<a.position.count;i++)a.position.setZ(i,a.position.getZ(i)-rearEaseByVertex[i]);
 garment.geometry.computeVertexNormals();garment.geometry.computeBoundingSphere();
 const result=showJacketFinish(T,kit,garment,data,options);
 result.pieces.push(finishCoatHem(T,garment,data,options.color));
 return{...result,evidence:{...result.evidence,lowerFit,hemFacingWidthM:.006,hemOuterLiftMaxM:.0024,hemInnerInsetM:.0013,style:options.recipe?.id==='tweed'?'long tweed hack coat':'long hunt coat',backHemExtensionM:.060,frontCutawayRiseM:.028,cutawayCurve:'rounded front from center to hip'}};
}
