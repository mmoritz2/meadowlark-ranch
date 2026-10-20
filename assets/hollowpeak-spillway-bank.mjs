// Connected eastern spillway-bank relief over the established physical field.
// The old bulk/core and dry guard stay recoverable in falls-landscape. This
// selected replacement owns a larger cap/face, not a narrowed legacy guard.
export const HOLLOWPEAK_SPILLWAY_BANK_PROFILE='hollowpeak-spillway-bank-4';
export const HOLLOWPEAK_SPILLWAY_BANK_BOUNDS=Object.freeze({x0:-148.4375,x1:-125,z0:-285.15625,z1:-230.46875});
export const HOLLOWPEAK_SPILLWAY_MAX_CUT=7;
// Exact union of protected canonical cells: wet/shore/motion/route/contour and
// the current source-wood foot/normal fans. Each closed cell keeps all corners.
const PROTECTED=Object.freeze([[-152.34375,-140.625,-289.0625,-277.34375],[-148.4375,-142.578125,-277.34375,-275.390625],[-148.4375,-140.625,-275.390625,-273.4375],[-148.4375,-142.578125,-273.4375,-271.484375],[-150.390625,-142.578125,-271.484375,-263.671875],[-150.390625,-144.53125,-263.671875,-261.71875],[-152.34375,-144.53125,-261.71875,-253.90625],[-152.34375,-146.484375,-253.90625,-240.234375],[-152.34375,-142.578125,-240.234375,-238.28125],[-115.234375,-113.28125,-240.234375,-238.28125],[-152.34375,-140.625,-238.28125,-236.328125],[-132.8125,-130.859375,-238.28125,-236.328125],[-119.140625,-113.28125,-238.28125,-236.328125],[-152.34375,-138.671875,-236.328125,-232.421875],[-134.765625,-115.234375,-236.328125,-234.375],[-136.71875,-130.859375,-234.375,-232.421875],[-128.90625,-119.140625,-234.375,-232.421875],[-152.34375,-132.8125,-232.421875,-230.46875],[-152.34375,-136.71875,-230.46875,-226.5625],[-128.90625,-121.09375,-228.515625,-224.609375],[-152.34375,-138.671875,-226.5625,-224.609375]].map(Object.freeze));
// Calibrated to the established fixed source course. The focused physical
// test binds these stations to HOLLOWPEAK.channel and checks the resulting
// canonical bank after the bed and forward-ravine blends, not just this floor.
export const HOLLOWPEAK_SPILLWAY_CHANNEL=Object.freeze([[-147,-284,16.2],[-145.8,-277.5,16.2],[-145,-274,15.85],[-148,-261,15.2],[-150,-249,14.55],[-150,-242.2,14.2]].map(Object.freeze));
function channelStation(x,z){
 let distance2=Infinity,y=0;
 for(let i=1;i<HOLLOWPEAK_SPILLWAY_CHANNEL.length;i++){
  const a=HOLLOWPEAK_SPILLWAY_CHANNEL[i-1],b=HOLLOWPEAK_SPILLWAY_CHANNEL[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  const qx=x-a[0]-dx*t,qz=z-a[1]-dz*t,d=qx*qx+qz*qz;
  if(d<distance2){distance2=d;y=a[2]+(b[2]-a[2])*t;}
 }
 return {d:Math.sqrt(distance2),y};
}
const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
function hinge(x,w){if(x<=-w)return 0;if(x>=w)return x;return(x+w)*(x+w)/(4*w);}
function limited(demand,capacity){const w=Math.min(.5,capacity*.2);if(demand<=capacity-w)return demand;if(demand>=capacity+w)return capacity;const t=(demand-capacity+w)/(2*w);return demand-w*t*t;}
export function spillwayBankSupport(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError('Finite spillway coordinates required');
 const b=HOLLOWPEAK_SPILLWAY_BANK_BOUNDS;if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1)return 0;
 let distance2=Infinity;
 for(const r of PROTECTED){const dx=Math.max(r[0]-x,0,x-r[1]),dz=Math.max(r[2]-z,0,z-r[3]);const d=dx*dx+dz*dz;if(d===0)return 0;distance2=Math.min(distance2,d);}
 // One continuous erosion distance around the union, not per-node bumps.
 const contact=ease(0,2.2,Math.sqrt(distance2));
 const hem=ease(b.x0,b.x0+3.90625,x)*(1-ease(b.x1-3.90625,b.x1,x))
  *ease(b.z0,b.z0+5.859375,z)*(1-ease(b.z1-5.859375,b.z1,z));
 return contact*hem;
}
export function sculptSpillwayBankRelief(x,z,original){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(original))throw new TypeError('Finite spillway physical samples required');
 if(original<=8)return original;const weight=spillwayBankSupport(x,z);if(weight===0)return original;
 // A north/east crest descends into an oblique upper plane and a steeper
 // southern face. Lower the entire old cap before joining its anchored foot.
 const plane=19.4+.27*(x+133)-.14*(z+269)-.28*hinge(z+251,2);
 // Retain one broad, low channel bank, then roll its outer shoulder into the
 // descending face. This broad lower envelope limits erosion; it never adds
 // height above the established bank or changes the fixed wet-cell supports.
 const flow=channelStation(x,z),outward=Math.max(0,flow.d-4.5);
 const bank=flow.y+1.53-.05*outward*outward;
 // The retained bank ends with the finite channel. A short dry landing
 // preserves its complete last canonical cell; the next two cells roll into
 // the established lower face instead of extending a radial crown forward.
 const end=HOLLOWPEAK_SPILLWAY_CHANNEL[HOLLOWPEAK_SPILLWAY_CHANNEL.length-1][1]+.1;
 const retention=1-ease(end,end+3.90625,z);
 const target=plane+hinge(bank-plane,.6)*retention;
 const rise=original-8,capacity=Math.min(HOLLOWPEAK_SPILLWAY_MAX_CUT,.8*rise*ease(0,3,rise));
 const demand=hinge(original-target,.4),loss=limited(demand,capacity);
 return original-loss*weight;
}
