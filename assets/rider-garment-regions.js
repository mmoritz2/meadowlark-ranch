import {trimGarment} from './rider-fit.js?v=tailored-coats69-20261010';

// Each region is an intersection of linear half-planes. Partition a union into
// non-overlapping convex regions so a narrow strap crossing a triangle cannot
// disappear just because all original triangle corners lie outside its strip.
export function trimRegions(T,source,regions){
 const parts=regions.map(fields=>trimGarment(T,source,fields)),out=new T.BufferGeometry();
 for(const name of ['position','normal','uv','skinIndex','skinWeight']){
  const first=parts[0].attributes[name],values=[];for(const p of parts)values.push(...p.attributes[name].array);
  out.setAttribute(name,new T.BufferAttribute(new first.array.constructor(values),first.itemSize));
 }
 out.setIndex(Array.from({length:out.attributes.position.count},(_,i)=>i));out.computeBoundingSphere();for(const p of parts)p.dispose();return out;
}
