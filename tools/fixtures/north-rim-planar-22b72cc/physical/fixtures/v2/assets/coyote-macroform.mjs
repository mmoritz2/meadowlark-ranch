// Original connected sandstone macroforms, shared by rock skin and hoof ground.
// Pure metre-scale contours; no decoration meshes, scene resources or randomness.
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const chain=(nodes,x)=>{
 if(x<=nodes[0][0]||x>=nodes.at(-1)[0])return 0;
 let i=1;while(x>nodes[i][0])i++;const a=nodes[i-1],b=nodes[i],t=ease(a[0],b[0],x);
 return a[1]+(b[1]-a[1])*t;
};
const freeze=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));
export const COYOTE_MACRO_CONTROLS=Object.freeze({
 northCrown:freeze([[-32,0],[-22,3],[-10,9],[8,20],[24,25],[45,23],[62,17],[77,11],[95,27],[112,19],[132,12],[151,5],[173,0]]),
 northRecesses:freeze([[33,6.5,3.8],[73,15,5.4],[106,8.5,4.3],[137,5.5,2.4]]),
 oasisCrown:freeze([[-189,0],[-180,7],[-171,18],[-162,22],[-155,18.5],[-146,23],[-136,19.5],[-128,16],[-119,7],[-109,0]]),
 oasisRecesses:freeze([[-173,6.7,3.7],[-151,5.8,4.3],[-132,6.5,2.8]]),
 scanFootMaxZ:150.390625,
});
function faceProfile(r,facing,along){
 // Gently uneven bed edges, broad shelves, and short steep risers. Each edge
 // moves coherently with its neighbours rather than making repeated sawteeth.
 const drift=.028*Math.sin(along*.087)+.012*Math.sin(along*.191+.6);
 const upper=.27+drift,lower=.58+drift*.72;
 const crown=1-.12*ease(.08,.23,r);
 const front=crown-.31*ease(upper,upper+.115,r)-.29*ease(lower,lower+.13,r)-.28*ease(.82,1.08,r);
 const rear=1-.20*ease(.13,.36,r)-.34*ease(.49+drift*.5,.72+drift*.5,r)-.46*ease(.81,1.08,r),blend=ease(-.16,.12,facing);
 return Math.max(0,rear+(front-rear)*blend);
}
function recesses(nodes,along,facing,r){
 let cut=0;for(const[station,width,depth]of nodes){const u=(along-station-facing*5.1)/width;if(Math.abs(u)<1)cut+=depth*(1-u*u)**3;}
 return cut*ease(.13,.34,facing)*(1-ease(.79,1.04,r));
}
// The river approaches from the south. Two unequal retained shoulders flank a
// broad eroded embayment; their beds advance and retreat along the same ridge.
// This is physical metre-scale terrain, also sampled by the hoof grid and skin.
function northRiverFace(r,along){
 const drift=.038*Math.sin(along*.043+.5)+.019*Math.sin(along*.103-1.1);
 const upper=.32+drift,lower=.65+drift*.62+.023*Math.sin(along*.027+.8);
 return Math.max(0,1-.12*ease(.07,.27,r)
  -.32*ease(upper-.025,upper+.092,r)
  -.28*ease(lower-.018,lower+.090,r)-.28*ease(.82,1.10,r));
}
function northRiverGullies(along,q,r){
 let cut=0;
 for(const[station,width,depth]of COYOTE_MACRO_CONTROLS.northRecesses){
  const lean=q*(5.2+2.1*Math.sin(station*.071))+q*q*(station===73?7.5:-2.0);
  const u=(along-station-lean)/(width*(1+.12*q));
  if(Math.abs(u)<1)cut+=depth*(1-u*u)**3;
 }
 return cut*ease(.10,.35,q)*(1-ease(.86,1.08,r));
}
// Locally affine dry bank faces. Quintic integral caps give a linear interior
// with C2 joins instead of rounding the entire scarp into another soft tier.
function northPlanarDrop(a,b,v){
 const t=clamp((v-a)/(b-a)),cap=.13,k=1/(1-cap);
 const integral=u=>u*u*u*u*(u*u-3*u+2.5);
 if(t<cap)return k*cap*integral(t/cap);
 if(t>1-cap)return 1-k*cap*integral((1-t)/cap);
 return k*(t-cap*.5);
}
function northShoulderFace(r,along,centre,right){
 const cant=(along-centre)*.0007,upper=.268+cant,lower=(right?.612:.635)-cant*.3;
 return .88-.34*northPlanarDrop(upper,.552+cant,r)
  -(right?.28:.25)*northPlanarDrop(lower,.79-cant*.3,r);
}
function northDirectedShoulderHeight(original,bed,erosion,toe,r,q,along,rise,best,edge){
 const left=ease(10,18,along)*(1-ease(42,55,along)),right=ease(86,92,along)*(1-ease(106,116,along));
 const width=left+right;if(width===0)return original;
 // The old crown, deep central embayment, low toe and complete2.2m contour
 // remain outside this dry face core. No new foot or extent is introduced.
 const core=ease(.20,.30,r)*(1-ease(.74,.84,r))*ease(.10,.27,q)
  *ease(4.8,7.2,original)*(1-ease(.82,.90,best))*(1-ease(.82,.90,edge));
 if(core===0)return original;
 const isRight=right>left,centre=isRight?99:28,cap=chain(COYOTE_MACRO_CONTROLS.northCrown,centre),profile=northShoulderFace(r,along,centre,isRight);
 const plane=cap*profile+(along-centre)*(isRight?-.026:.033);
 const eroded=plane*(1-(bed>0?erosion/bed:0))+toe;
 const ledgeCentre=centre+(isRight?7:12)+r*4,u=(along-ledgeCentre)/(isRight?5:6),notch=Math.abs(u)<1?(1-u*u)**3:0;
 const interrupted=eroded-(isRight?1.6:1.25)*notch*ease(.48,.56,r)*(1-ease(.69,.76,r));
 const target=Math.max(4.6,Math.min(rise*.94,interrupted));
 return original+(target-original)*core*width;
}
export function coyoteNorthMacroHeight(best,side,along,edge){
 const rise=chain(COYOTE_MACRO_CONTROLS.northCrown,along);if(rise===0)return 0;
 const offset=.065*Math.sin(along*.047+.4),q=side+offset,r=Math.abs(q);
 const south=ease(-.10,.24,q),profile=faceProfile(r,-q,along)
  +(northRiverFace(r,along)-faceProfile(r,-q,along))*south;
 const bed=rise*profile,cut=northRiverGullies(along,q,r);
 // A bounded fractional cut keeps every eroded foot continuous and positive.
 const erosion=bed*.67*(1-Math.exp(-cut/(rise*.67+.000001)));
 const toe=(.84+.24*Math.sin(along*.041+.6)*Math.sin(along*.083))
  *ease(0,3,rise)*ease(.64,.84,r)*(1-ease(.94,1.08,r));
 const hem=(1-ease(.92,1.08,best))*(1-ease(.92,1.08,edge));
 const shaped=northDirectedShoulderHeight(bed-erosion+toe,bed,erosion,toe,r,q,along,rise,best,edge);
 return shaped*hem;
}
export function coyoteOasisMacroBlend(x,z,best,edge){
 if(x<=-189||x>=-109||z<=COYOTE_MACRO_CONTROLS.scanFootMaxZ||z>=197||best>=1.08||edge>=1.08)return 0;
 // The old fixed photoscan seat and its terrain triangle row are exact. A
 // wide smooth dry transition avoids making a new knife ridge at that row.
 return ease(COYOTE_MACRO_CONTROLS.scanFootMaxZ,159.2,z)*(1-ease(188,197,z))
  *ease(-189,-181,x)*(1-ease(-117,-109,x))
  *(1-ease(.90,1.08,best))*(1-ease(.90,1.08,edge));
}
export function coyoteOasisMacroHeight(x,z,best,edge){
 const rise=chain(COYOTE_MACRO_CONTROLS.oasisCrown,x);if(rise===0)return 0;
 const centre=161.2+1.9*Math.sin((x+172)*.070),width=18.7+1.0*Math.sin((x+163)*.059);
 const q=(z-centre)/width,r=Math.abs(q),facing=q,along=x+189;
 const toe=1.7*ease(.60,.78,r)*(1-ease(.95,1.10,r));
 const cut=recesses(COYOTE_MACRO_CONTROLS.oasisRecesses,x,facing,r);
 const hem=(1-ease(.93,1.08,best))*(1-ease(.93,1.08,edge));
 return Math.max(0,rise*faceProfile(r,facing,along)-cut+toe)*hem;
}
