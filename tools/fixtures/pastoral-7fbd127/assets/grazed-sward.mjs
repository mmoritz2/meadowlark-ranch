import {meadowSwardGrazingAt} from './pastoral-fields.mjs?v=hollowpeak-cascades-1';
import {chalkGrazingAt} from './chalk-grazing.mjs?v=chalk-grazing-1';

// A short turf stand uses the same seventy triangles as an existing rich root.
// Only the already-counted rich rows inside grazed ground can use this shape.
export const GRAZED_SWARD=Object.freeze({triangles:70,leaves:46,bentLeaves:12,maximumRadius:.60,maskStart:.45,maskFull:.92});
export function grazedSwardWeight(x,z){
 const g=Math.max(meadowSwardGrazingAt(x,z),chalkGrazingAt(x,z).cut),t=Math.max(0,Math.min(1,(g-GRAZED_SWARD.maskStart)/(GRAZED_SWARD.maskFull-GRAZED_SWARD.maskStart)));
 return t*t*(3-2*t);
}
export function selectsGrazedSward(x,z,sample){return sample<grazedSwardWeight(x,z);}

export function createGrazedSwardGeometry(T){
 const P=[],C=[],U=[],I=[];
 // Slim upright leaves collect around seven existing growth points. Several
 // leaves share each point's lean instead of spreading into a broad star. Twelve
 // curved leaves and thirty-four fine tips retain the seventy-triangle budget;
 // their exact source heights and sampled parent ground stay unchanged.
 const roots=[[0,0],[.125,.075],[-.12,.085],[.12,-.09],[-.125,-.095],[.015,.165],[-.025,-.155]];
 const headings=[.20,.77,2.14,.49,3.83,1.21,4.73],offsets=[-.42,-.27,-.10,.09,.25,.43,.60];
 for(let leaf=0;leaf<GRAZED_SWARD.leaves;leaf++){
  const root=roots[leaf%roots.length],angle=headings[leaf%roots.length]+offsets[Math.floor(leaf/roots.length)],dx=Math.cos(angle),dz=Math.sin(angle);
  const height=.38+(leaf%7)*.045,lean=.13+(leaf%5)*.019,half=.0072+(leaf%5)*.0005;
  const rings=leaf<GRAZED_SWARD.bentLeaves?[0,.57,1]:[0,1],base=P.length/3;
  for(let ring=0;ring<rings.length;ring++){
   const t=rings[ring],turn=angle+(leaf%2?-.17:.20)*t,rx=-Math.sin(turn),rz=Math.cos(turn);
   const bend=lean*(.18*t+.82*t*t),y=height*(1.48*t-.68*t*t),width=half*(.58+.81*Math.sin(Math.PI*t*.9))*Math.pow(1-t,.65);
   const shade=.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72);
   for(const side of ring===rings.length-1?[0]:[-1,1]){
    P.push(root[0]+dx*bend+rx*width*side,y,root[1]+dz*bend+rz*width*side);
    U.push((side+1)/2,t);C.push(shade*.9,shade,shade*.73);
   }
   if(ring<rings.length-2){const a=base+ring*2;I.push(a,a+1,a+2,a+1,a+3,a+2);}
   else if(ring===rings.length-2){const a=base+ring*2;I.push(a,a+1,a+2);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.grazedSward={profile:'grazed-sward-5',triangles:I.length/3,leaves:GRAZED_SWARD.leaves};return g;
}
