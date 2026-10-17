import {appendArchedMeadowLeaf} from './lush-meadow-geometry.mjs?v=grass-ribbon-5';
import {meadowSwardGrazingAt} from './pastoral-fields.mjs?v=hollowpeak-cascades-1-commons-landscape-1';
import {chalkGrazingAt} from './chalk-grazing.mjs?v=chalk-grazing-1';
import {pastoralCoverAt} from './pastoral-cover.mjs?v=pastoral-cover-1-commons-landscape-1-grove-field-1-countryside-fields-1-regional-cover-2';

// A short turf stand uses the same seventy triangles as an existing rich root.
// Only the already-counted rich rows inside grazed ground can use this shape.
export const GRAZED_SWARD=Object.freeze({triangles:70,leaves:34,bentLeaves:18,maximumRadius:.60,maskStart:.45,maskFull:.92});
export function grazedSwardWeight(x,z,pastoralCut=pastoralCoverAt(x,z).cut){
 const field=pastoralCoverAt(x,z),bank=field.bank||0,g=Math.max(meadowSwardGrazingAt(x,z)*(1-bank),chalkGrazingAt(x,z).cut,pastoralCut),t=Math.max(0,Math.min(1,(g-GRAZED_SWARD.maskStart)/(GRAZED_SWARD.maskFull-GRAZED_SWARD.maskStart)));
 return t*t*(3-2*t);
}
export function selectsGrazedSward(x,z,sample,pastoralCut){return sample<grazedSwardWeight(x,z,pastoralCut);}

// Low keeps complete source leaves within the original forty-triangle root
// budget. The resident70 stand supplies identical rooted positions/UV/colors.
export function createLowGrazedSwardGeometry(T,source){
 if(!source?.userData?.grazedSward||source.index?.count!==210)throw Error('Current complete70-triangle turf source required');
 const leaves=[0,1,2,3,5,6,8,9,12,17,18,19,20,23,24,25,26,27,30,33],ranges=source.userData.grazedSward.leafRanges,arrays=Object.fromEntries(Object.entries(source.attributes).map(([name])=>[name,[]])),indices=[],leafRanges=[];
 let vertex=0;
 for(const leaf of leaves){
  const r=ranges[leaf];if(!r||r.indexCount!==(r.curved?9:3))throw Error('Whole source turf leaf required');
  for(const[name,a]of Object.entries(source.attributes))for(let i=r.vertexStart*a.itemSize;i<(r.vertexStart+r.vertexCount)*a.itemSize;i++)arrays[name].push(a.array[i]);
  const indexStart=indices.length;for(let i=r.indexStart;i<r.indexStart+r.indexCount;i++)indices.push(source.index.array[i]-r.vertexStart+vertex);
  leafRanges.push({...r,sourceLeaf:leaf,vertexStart:vertex,indexStart,root:[...r.root]});vertex+=r.vertexCount;
 }
 const g=new T.BufferGeometry();for(const[name,a]of Object.entries(source.attributes))g.setAttribute(name,new T.Float32BufferAttribute(arrays[name],a.itemSize,a.normalized));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.grazedSward={profile:'grazed-natural-low-1',triangles:40,leaves:20,broadLeaves:0,bentLeaves:10,fineBlades:10,rootGroups:7,sourceLeaves:leaves,leafRanges};return g;
}

export function createGrazedSwardGeometry(T){
 const P=[],C=[],U=[],I=[],leafRanges=[];
 // The seven original rooted centres remain fixed. Eighteen unequal two-stage
 // leaves and sixteen finer upright blades spend exactly seventy triangles.
 // Broad basal spoons are replaced by narrow rooted surfaces, not flat fans.
 const roots=[[0,0],[.125,.075],[-.12,.085],[.12,-.09],[-.125,-.095],[.015,.165],[-.025,-.155]];
 const hash=n=>{let h=Math.imul(n+137,1597334677);h=Math.imul(h^(h>>>15),2246822519);return((h^(h>>>13))>>>0)/4294967296;};
 const heights=[.24,.29,.26,.22,.43,.34,.46,.38,.40,.50,.35,.45,.31,.41,.33,.47,.36,.42];
 // Four genuine prostrate leaf tips retain the old local XZ footprint. They
 // belong to complete connected leaves and never serve as hidden extent points.
 const outer=[{root:4,tip:[-.4381703734397888,-.080]},{root:3,tip:[.40255632996559143,-.045]},{root:5,tip:[.065,.41905778646469116]},{root:6,tip:[-.045,-.3360755741596222]}];
 const emit=(point,u,t,leaf)=>{P.push(...point);U.push(u,t);const shade=.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72),dry=leaf%17===0?.15:0;C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));};
 for(let leaf=0;leaf<34;leaf++){
  const curved=leaf<18,outerLeaf=curved&&leaf<4?outer[leaf]:null,rootIndex=outerLeaf?outerLeaf.root:(leaf*3+Math.floor(leaf/7))%7,root=roots[rootIndex];
  let angle=leaf*2.399963229728653+rootIndex*.317+(hash(leaf+91)-.5)*.67;
  let reach=curved?.065+hash(leaf+27)*.115:.018+hash(leaf+43)*.064;
  if(outerLeaf){angle=Math.atan2(outerLeaf.tip[1]-root[1],outerLeaf.tip[0]-root[0]);reach=Math.hypot(outerLeaf.tip[0]-root[0],outerLeaf.tip[1]-root[1]);}
  const dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx,h=curved?heights[leaf]:leaf===27?.52:.145+hash(leaf+17)*.325;
  const halfWidth=curved?.0075+hash(leaf+73)*.0045:.0038+hash(leaf+59)*.0039,rootHalf=halfWidth*(curved?.58:.87),start=P.length/3,indexStart=I.length;
  emit([root[0]-sx*rootHalf,0,root[1]-sz*rootHalf],0,0,leaf);emit([root[0]+sx*rootHalf,0,root[1]+sz*rootHalf],1,0,leaf);
  if(curved){
   const t=.49+hash(leaf+81)*.19,shoulder=reach*(.18*t+.82*t*t),sweep=(hash(leaf+101)-.5)*.021,heading=angle+(hash(leaf+113)-.5)*.24,wx=-Math.sin(heading),wz=Math.cos(heading),roll=(leaf%2?-1:1)*halfWidth*(.08+hash(leaf+119)*.14),y=h*(.61+hash(leaf+131)*.12);
   const x=root[0]+dx*shoulder+sx*sweep,z=root[1]+dz*shoulder+sz*sweep;
   emit([x-wx*halfWidth,y-roll,z-wz*halfWidth],0,t,leaf);emit([x+wx*halfWidth,y+roll,z+wz*halfWidth],1,t,leaf);
   emit([root[0]+dx*reach,h*(leaf<4?.91:.95+hash(leaf+149)*.045),root[1]+dz*reach],.5,1,leaf);
   I.push(start,start+1,start+2,start+1,start+3,start+2,start+2,start+3,start+4);
  }else{
   emit([root[0]+dx*reach,h,root[1]+dz*reach],.5,1,leaf);I.push(start,start+1,start+2);
  }
  leafRanges.push({vertexStart:start,vertexCount:P.length/3-start,indexStart,indexCount:I.length-indexStart,rootIndex,root:[...root],curved,segments:curved?2:1,upright:!curved});
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.grazedSward={profile:'grazed-natural-1',triangles:I.length/3,leaves:34,broadLeaves:0,bentLeaves:18,fineBlades:16,rootGroups:7,leafRanges};return g;
}
