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
 return (bed-erosion+toe)*hem;
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
