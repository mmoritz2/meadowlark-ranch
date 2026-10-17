// Original connected mesa erosion. Existing geometry, seeded draws, surfaces and
// collision owners stay with geology.js; this helper only shapes its upper mass.
export const MESA_LANDFORM_PROFILE='mesa-landforms-1';
const TAU=Math.PI*2;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const hash=(seed,k)=>{let n=(seed^Math.imul(k+1,0x9e3779b1))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967296;};
const bump=x=>{if(Math.abs(x)>=1)return 0;const q=1-x*x;return q*q;};
export function createMesaLandform(radius,height,seed,phase){
 if(!(Number.isFinite(radius)&&radius>0&&Number.isFinite(height)&&height>0&&Number.isInteger(seed)&&Number.isFinite(phase)))throw new TypeError('Finite mesa dimensions, seed and phase required');
 // This entire band includes the original terrain feather and mounted body.
 // No radial or vertical edit may change a vertex inside it.
 const contactCeiling=Math.max(3.8,height*.23+.05);
 const crownBaseLoss=.045+.018*hash(seed,2);
 const coves=Array.from({length:4},(_,k)=>({
  angle:phase+k*TAU/4+(.08+hash(seed,k+5)*.34)*(k%2?1:-1),
  width:.36+hash(seed,k+11)*.28,
  bend:(hash(seed,k+17)-.5)*.48,
  depth:.23+hash(seed,k+23)*.12,
  crown:.045+hash(seed,k+29)*.060,
  shelf:.40+hash(seed,k+35)*.12
 }));
 const coreLoss=.055+.025*hash(seed,3);
 function sample(a,t,y){
  if(y<=contactCeiling)return {inset:0,loss:0};
  const rise=smooth(contactCeiling,Math.max(contactCeiling+.8,height*.64),y);
  let cove=0,crown=0,shelf=0;
  for(const c of coves){
   // A metre-scale diagonal cleft cuts a rounded cove between retained piers.
   // The wide upper shoulder recedes unevenly rather than extruding a drum.
   const q=angle(a,c.angle+c.bend*(t-.55))/c.width;
   const cut=bump(q);cove=Math.max(cove,c.depth*cut);
   crown=Math.max(crown,c.crown*bump(q*.82));
   const shelfHeight=c.shelf+.055*Math.sin(a*2+phase+c.angle);
   const ledge=smooth(shelfHeight,shelfHeight+.045,t)
    +.72*smooth(shelfHeight+.255,shelfHeight+.305,t);
   // Shelf runs terminate inside the clefts, leaving unequal buttress faces.
   shelf=Math.max(shelf,(.016+.026*hash(seed,41))*ledge*(1-cut*.90));
  }
  return {inset:Math.min(.38,(cove+shelf)*rise),
   loss:height*(crownBaseLoss+crown)*smooth(contactCeiling/height,1,t)*rise};
 }
 return Object.freeze({profile:MESA_LANDFORM_PROFILE,contactCeiling,coreLoss,
  surface(a,t,r,y){const q=sample(a,t,y);return [r*(1-q.inset),y-q.loss];},
  crown:height*(.925-coreLoss)});
}
