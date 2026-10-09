import {surfaceSampler} from './rider-fit.js?v=character-polish-20261009';

// A longer hem enters the hip region. Fit it to the actual connected trousers
// instead of extrapolating the narrower shirt's waist cross-section.
export function fitLowerLayer(T,kit,garment,{clearance=.004,underlayer=null,maximumY=null}={}){
 const pants=kit.connectedWardrobe?.pantsGeometry;if(!pants)return{adjusted:0,maxOffsetM:0};
 const V=()=>new T.Vector3(),a=garment.geometry.attributes,p=V(),radial=V(),pantsY=Math.max(...Array.from(pants.attributes.position.array).filter((_,i)=>i%3===1));
 const sampler=surfaceSampler(T,[{geometry:pants,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix},...(underlayer?[underlayer]:[])]);let adjusted=0,maxOffsetM=0;
 for(let i=0;i<a.position.count;i++){
  p.fromBufferAttribute(a.position,i);if(p.y>(maximumY??pantsY-.002)||Math.abs(p.x)>.24)continue;
  radial.set(p.x,0,p.z).normalize();if(!radial.lengthSq())continue;
  const origin=radial.clone().multiplyScalar(.65);origin.y=p.y;
  const h=sampler.cast(origin,radial.clone().negate(),q=>q.x*radial.x+q.z*radial.z>0);if(!h)continue;
  const distance=h.point.x*radial.x+h.point.z*radial.z+clearance-(p.x*radial.x+p.z*radial.z);
  if(distance>0){p.addScaledVector(radial,distance);a.position.setXYZ(i,p.x,p.y,p.z);adjusted++;maxOffsetM=Math.max(maxOffsetM,distance);}
 }
 sampler.dispose();garment.geometry.computeVertexNormals();garment.geometry.computeBoundingSphere();return{adjusted,maxOffsetM,clearanceM:clearance};
}
