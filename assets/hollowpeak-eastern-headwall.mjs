// One original dry eastern shoulder, applied to the established physical field.
// No mesh, material, placement, historical-reference or random ownership.
export const HOLLOWPEAK_EASTERN_HEADWALL_PROFILE='hollowpeak-eastern-headwall-2';
export const MAX_CUT=5;
export const HOLLOWPEAK_EASTERN_HEADWALL_BOUNDS=Object.freeze({x0:-137,x1:-112,z0:-279,z1:-249});
const STEP=1000/512;
const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
// Each row gives open left/right boundary indices, not new terrain heights.
// At all canonical rows the compact support is a subset of the reviewed
// 56-node envelope. The complete inner ledge cell and outer cleft remain exact.
const HEM=Object.freeze([
 [114,189,193],[115,189,193],[116,189,193],[117,189,193],
 [118,188,193],[119,188,193],[120,188,194],[121,188,194],
 [122,188,194],[123,188,194],[124,188,193],
 [125,187,193],[126,187,193],[127,187,193],[128,187,193],
].map(([row,left,right])=>Object.freeze([row*STEP-500,left*STEP-500,right*STEP-500])));
// [z, inner crest x, relief, exposed-side slope]. The new shoulder belongs to
// the broad inner bank. Its entire former upper cap is lowered and tilted;
// retaining the old high node while cutting its body made a separate pyramid.
// The foreground anchor and separate outer pier stay outside this footprint.
const CREST=Object.freeze([
 [-277.34375,-130.3,24.0,.65],[-273.4375,-130.9,23.7,.65],
 [-270.5,-131.25,23.3,.65],[-268,-131.6,22.8,.62],
 [-265.625,-132.1,22.0,.55],[-263.671875,-132.5,21.2,.38],
 [-261.71875,-132.9,20.3,.30],[-259.765625,-133.2,19.7,.30],
 [-257.8125,-133.4,19.1,.30],[-255.859375,-133.5,18.3,.32],
 [-251.953125,-133.8,17.3,.38],[-250,-133.9,17.0,.38],
].map(Object.freeze));
function tangent(points,i,k){
 if(i===0||i===points.length-1)return 0;
 const a=points[i-1],p=points[i],b=points[i+1],ha=p[0]-a[0],hb=b[0]-p[0],da=(p[k]-a[k])/ha,db=(b[k]-p[k])/hb;
 if(da*db<=0)return 0;const wa=2*hb+ha,wb=hb+2*ha;return(wa+wb)/(wa/da+wb/db);
}
function field(points,i,k,z){const a=points[i-1],b=points[i],h=b[0]-a[0],t=(z-a[0])/h,t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*h*tangent(points,i-1,k)+(-2*t3+3*t2)*b[k]+(t3-t2)*h*tangent(points,i,k);}
function hinge(x,w){if(x<=-w)return 0;if(x>=w)return x;return(x+w)*(x+w)/(4*w);}
function cap(d,c){const w=Math.min(.6,c*.25);if(d<=c-w)return d;if(d>=c+w)return c;const t=(d-c+w)/(2*w);return d-w*t*t;}
export function sculptEasternHeadwall(x,z,original,protection=1){
 if(![x,z,original,protection].every(Number.isFinite))throw TypeError('Finite eastern headwall field required');
 const b=HOLLOWPEAK_EASTERN_HEADWALL_BOUNDS;
 if(x<=b.x0||x>=b.x1||z<=HEM[0][0]||z>=HEM.at(-1)[0]||original<=10||protection<=0)return original;
 let i=1;while(z>HEM[i][0])i++;
 const left=field(HEM,i,1,z),right=field(HEM,i,2,z);
 if(x<=left||x>=right)return original;
 const hem=ease(left,left+STEP,x)*(1-ease(right-STEP,right,x))
  *ease(HEM[0][0],HEM[0][0]+2*STEP,z)*(1-ease(HEM.at(-1)[0]-2*STEP,HEM.at(-1)[0],z));
 i=1;while(z>CREST[i][0])i++;
 const crest=field(CREST,i,1,z),height=field(CREST,i,2,z),slope=field(CREST,i,3,z);
 const target=height-slope*hinge(x-crest,.8)-.25*hinge(crest-x,1.6),gap=original-target;
 if(gap<=0)return original;
 // C1 onset and cap retain the ten-metre basal mass without a hard new ledge.
 const demand=gap<1?gap*gap*.5:gap-.5,capacity=Math.min(MAX_CUT,.7*(original-10));
 const cut=cap(demand,capacity)*hem*ease(10,14,original)*Math.min(1,protection);
 return original-cut;
}
