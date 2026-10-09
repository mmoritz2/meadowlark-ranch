// Original landform paths: [x,z,relative height,left shoulder,right shoulder].
// Long tapering spurs and broad drainage hollows replace an uninterrupted soft
// plain with unequal folds. No per-vertex noise or ambient RNG is introduced.
export const OUTER_LANDFORMS=Object.freeze([
 ['northwest-long-spur',[[ -760,-1000,0,105,125],[-690,-885,15,110,135],[-610,-770,19,90,120],[-580,-625,10,68,105],[-545,-526,0,55,70]]],
 ['northwest-inner-fold',[[-425,-950,0,80,105],[-450,-840,13,90,115],[-465,-750,17,72,92],[-405,-630,7,55,75],[-380,-526,0,42,56]]],
 ['north-west-low-spur',[[-205,-1000,0,85,95],[-200,-865,14,95,115],[-115,-735,11,75,95],[-160,-610,6,52,72],[-130,-526,0,45,58]]],
 ['north-east-fold',[[300,-1010,0,105,100],[275,-900,11,115,100],[230,-765,18,100,78],[110,-635,8,74,55],[155,-526,0,48,42]]],
 ['northeast-shoulder',[[870,-835,0,100,130],[815,-720,15,105,135],[730,-650,17,88,120],[635,-585,8,65,87],[550,-535,0,45,60]]],
 ['eastern-spur',[[1030,-100,0,90,110],[905,-155,13,100,125],[780,-115,17,76,100],[655,-225,7,57,82],[526,-215,0,42,55]]],
 ['southeast-shoulder',[[1005,505,0,105,105],[875,465,14,115,100],[755,520,18,85,110],[630,440,8,65,82],[526,415,0,45,50]]],
 ['south-east-fold',[[355,1030,0,100,120],[300,900,12,110,125],[270,790,17,82,108],[190,655,8,62,83],[210,526,0,44,57]]],
 ['south-central-spur',[[125,1010,0,105,110],[80,895,14,115,92],[95,795,20,86,78],[-10,695,11,76,63],[5,545,0,50,48]]],
 ['south-west-fold',[[-355,990,0,105,105],[-305,865,15,110,122],[-285,750,18,85,96],[-365,630,7,62,73],[-320,526,0,44,56]]],
 ['western-shoulder',[[-1025,315,0,90,110],[-910,260,13,102,124],[-790,315,15,80,112],[-655,240,7,60,78],[-526,260,0,43,55]]],
 ['west-north-fold',[[-1020,-325,0,110,105],[-900,-360,11,120,105],[-785,-300,17,92,82],[-655,-370,8,70,65],[-526,-335,0,48,44]]],
 ['northwest-drain',[[-550,-985,0,65,78],[-525,-905,-5,70,82],[-540,-790,-12,52,67],[-510,-670,-11,46,61],[-455,-542,-2,55,65],[-440,-526,0,55,65]]],
 ['north-central-drain',[[20,-980,0,70,85],[30,-900,-6,78,88],[70,-770,-11,58,73],[0,-660,-8,50,62],[-10,-526,0,52,60]]],
 ['northeast-drain',[[610,-990,0,75,80],[530,-870,-6,80,84],[510,-750,-10,60,72],[450,-625,-7,52,64],[460,-526,0,52,60]]],
 ['east-drain',[[1000,175,0,75,85],[885,115,-6,80,92],[735,125,-10,57,74],[625,35,-7,48,62],[526,60,0,50,60]]],
 ['south-drain',[[-80,1010,0,75,85],[-100,875,-5,80,85],[-95,730,-11,57,76],[-120,615,-7,50,65],[-90,526,0,52,64]]],
 ['south-east-drain',[[525,975,0,75,85],[490,835,-6,80,88],[420,700,-10,57,74],[455,585,-6,50,62],[465,526,0,50,60]]],
 ['west-drain',[[-1000,-30,0,80,90],[-895,-15,-6,88,95],[-760,-70,-10,62,74],[-630,-35,-7,50,66],[-526,-65,0,50,60]]],
].map(([id,nodes])=>Object.freeze({id,nodes:Object.freeze(nodes.map(Object.freeze))})));
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
function pathHeight(x,z,nodes){
 let selected=0;
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  const side=(dx*(z-a[1])-dz*(x-a[0]))>=0?3:4,width=a[side]+(b[side]-a[side])*t;
  const q=Math.max(0,1-Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/width);
  const value=(a[2]+(b[2]-a[2])*t)*(.35*q+.65*smooth(q));
  if(Math.abs(value)>Math.abs(selected))selected=value;
 }
 return selected;
}
export function outerCountrysideRelief(x,z){
 // Preserve the full original first four square bands, including every point
 // of the first15m strip. Beyond the authored terrain, blend back into old hills.
 const distance=Math.max(Math.abs(x),Math.abs(z))-500;
 const envelope=smooth((distance-26)/42)*(1-smooth((distance-430)/210));
 if(envelope===0)return 0;
 let raised=0,hollow=0;
 for(const form of OUTER_LANDFORMS){const h=pathHeight(x,z,form.nodes);raised=Math.max(raised,h);hollow=Math.min(hollow,h);}
 return (raised+hollow)*envelope;
}
