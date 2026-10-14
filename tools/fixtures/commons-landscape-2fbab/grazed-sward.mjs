import {appendArchedMeadowLeaf} from './lush-meadow-geometry.mjs?v=grass-ribbon-5';
import {meadowSwardGrazingAt} from './pastoral-fields.mjs?v=hollowpeak-cascades-1';
import {chalkGrazingAt} from './chalk-grazing.mjs?v=chalk-grazing-1';
import {pastoralCoverAt} from './pastoral-cover.mjs?v=pastoral-cover-1';

// A short turf stand uses the same seventy triangles as an existing rich root.
// Only the already-counted rich rows inside grazed ground can use this shape.
export const GRAZED_SWARD=Object.freeze({triangles:70,leaves:14,bentLeaves:12,maximumRadius:.60,maskStart:.45,maskFull:.92});
export function grazedSwardWeight(x,z,pastoralCut=pastoralCoverAt(x,z).cut){
 const g=Math.max(meadowSwardGrazingAt(x,z),chalkGrazingAt(x,z).cut,pastoralCut),t=Math.max(0,Math.min(1,(g-GRAZED_SWARD.maskStart)/(GRAZED_SWARD.maskFull-GRAZED_SWARD.maskStart)));
 return t*t*(3-2*t);
}
export function selectsGrazedSward(x,z,sample,pastoralCut){return sample<grazedSwardWeight(x,z,pastoralCut);}

export function createGrazedSwardGeometry(T){
 const P=[],C=[],U=[],I=[],leafRanges=[];
 // Two leaves retain each of the original seven root centres. Their wider
 // lower surfaces and true shoulder creases carry cropped turf volume within
 // the same seventy triangles; two slender tips retain the old height cap.
 const roots=[[0,0],[.125,.075],[-.12,.085],[.12,-.09],[-.125,-.095],[.015,.165],[-.025,-.155]];
 const headings=[.20,.77,2.14,.49,3.83,1.21,4.73],offsets=[-.42,-.27];
 for(let leaf=0;leaf<GRAZED_SWARD.leaves;leaf++){
  const root=roots[leaf%roots.length],sourceLeaf=leaf,upright=leaf%7===6,heading=headings[leaf%roots.length]+offsets[Math.floor(leaf/roots.length)],height=(.38+(leaf%7)*.045)*(upright?.8/.97:.96);
  const reach=upright?.13+(leaf%5)*.019:(.38+(leaf%7)*.045)*(.46+(leaf%5)*.030),width=upright?.020:.043+(leaf%3)*.004;
  leafRanges.push(appendArchedMeadowLeaf(P,C,U,I,{root,heading,height,reach,width,upright,sourceLeaf,progressive:[0,2,5,8].includes(sourceLeaf)}));
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.grazedSward={profile:'grazed-sward-progressive-4',triangles:I.length/3,leaves:GRAZED_SWARD.leaves,broadLeaves:GRAZED_SWARD.bentLeaves,leafRanges};return g;
}
