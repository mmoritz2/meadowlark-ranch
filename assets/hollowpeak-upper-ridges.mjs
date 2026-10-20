// Original physical upper-Hollowpeak sculpt. Its bounded dry upper relief
// feeds the existing shared terrain/horse/camera height path.
// No geometry, material, planting layout, historical reference or RNG is owned here.
export const HOLLOWPEAK_UPPER_PROFILE='hollowpeak-upper-ridges-3';
export const HOLLOWPEAK_UPPER_BOUNDS=Object.freeze({x0:-224,x1:-81,z0:-378,z1:-329});
export const HOLLOWPEAK_UPPER_MAX_RAISE=2.5;
const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
const bump=x=>{if(Math.abs(x)>=1)return 0;const q=1-x*x;return q*q*q;};

// [along x, crest z, relief, shoulder break, exposed face slope]. One western
// summit feeds a long descending crest. The former left knob is subordinate;
// the former eastern satellite becomes a broad falling shoulder rather than
// another radial peak. All stations and slopes are authored at landscape scale.
const CREST=Object.freeze([
 [-225,-365,25,8,.85],[-218,-358,31,9,.85],[-211,-351,36,10,.90],
 [-203,-352,44,8,1.12],[-194,-355,50.4,6.5,1.30],
 [-185,-361,43,7,1.20],[-177,-363,38,9,1.04],[-168,-354,35,12,.82],
 [-158,-347,32,15,.70],[-146,-340,28,16,.63],[-139,-334,25,17,.58],
 [-127,-336,22,14,.65],[-117,-340,21,12,.78],[-105,-330,17,10,.77],
 [-95,-316,13,10,.70],[-80,-310,10,8,.70],
].map(Object.freeze));
// [along z, gully x, half width, maximum cut]. Broad oblique clefts leave
// connected rock shoulders between them, and open toward the unchanged south.
const GULLIES=Object.freeze([
 [[-378,-214,5.0,0],[-367,-210,5.3,0],[-357,-204,5.2,.5],[-347,-199,6.0,4.5],[-337,-194,7.5,8],[-329,-189,8.0,0]],
 [[-378,-188,5.0,0],[-367,-181,4.8,.2],[-357,-176,5.0,.5],[-347,-172,6.0,3],[-337,-166,7.5,6],[-329,-161,8.5,0]],
].map(points=>Object.freeze(points.map(Object.freeze))));

function tangent(points,i,k){
 if(i===0||i===points.length-1)return 0;
 const a=points[i-1],p=points[i],b=points[i+1],ha=p[0]-a[0],hb=b[0]-p[0],da=(p[k]-a[k])/ha,db=(b[k]-p[k])/hb;
 if(da*db<=0)return 0;
 const wa=2*hb+ha,wb=hb+2*ha;return(wa+wb)/(wa/da+wb/db);
}
function field(points,index,k,along){
 const a=points[index-1],b=points[index],h=b[0]-a[0],t=(along-a[0])/h,t2=t*t,t3=t2*t;
 return(2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*h*tangent(points,index-1,k)
  +(-2*t3+3*t2)*b[k]+(t3-t2)*h*tangent(points,index,k);
}
// Compact C1 hinge: its straight regions preserve a real directional rock
// face, unlike multiplying the entire hill by a rounded distance falloff.
function hinge(x,width){if(x<=-width)return 0;if(x>=width)return x;return(x+width)*(x+width)/(4*width);}
function cappedCut(demand,capacity){
 const w=Math.min(2,capacity*.25);
 if(demand<=capacity-w)return demand;if(demand>=capacity+w)return capacity;
 const t=(demand-capacity+w)/(2*w);return demand-w*t*t;
}

export function sculptUpperHollowpeakRelief(x,z,original){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(original))throw new TypeError('Finite Hollowpeak upper relief required');
 const b=HOLLOWPEAK_UPPER_BOUNDS;
 if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1||original<=10)return original;
 let index=1;while(x>CREST[index][0])index++;
 const crest=field(CREST,index,1,x),across=z-crest,a=Math.sqrt(across*across+.8*.8)-.8;
 const breakAt=field(CREST,index,3,x),slope=field(CREST,index,4,x);
 // Long oblique planes, an inclined narrow shoulder, then a steeper lower
 // face. These are unequal cross-ridge sections, not concentric height rings.
 // The northern back remains broader, retaining a connected divide behind
 // the open south-facing clefts. The shoulder shifts along the ridge, so it
 // never forms a constant-height cut across the landform.
 const face=across>=0?slope*a-.34*hinge(a-breakAt,1.5)+.47*hinge(a-breakAt-7,1.8):.43*a;
 let target=field(CREST,index,2,x)-face;
 for(const points of GULLIES){
  if(z<=points[0][0]||z>=points.at(-1)[0])continue;
  let i=1;while(z>points[i][0])i++;
  const centre=field(points,i,1,z),halfWidth=field(points,i,2,z),depth=field(points,i,3,z);
  target-=Math.max(0,depth)*bump((x-centre)/halfWidth);
 }
 // Preserve the entire ten-metre basal band, including both endpoints of the
 // established three-metre cliff contour's interpolation edges. A smooth onset
 // avoids cutting a shelf immediately above that protected band. Capacity also
 // leaves a connected basal mass below every upper shoulder and gully.
 const rise=original-10,capacity=cappedCut(.62*rise,22);
 const loss=cappedCut(Math.max(0,original-target),capacity);
 // A small near-crest bridge is permitted only in the existing upper saddle.
 // It cannot raise the summit, low foot, outer apron or a separate surface.
 const bridge=ease(22,28,original)*(1-ease(38,42,original))*bump(across/16);
 const gain=cappedCut(Math.max(0,target-original),HOLLOWPEAK_UPPER_MAX_RAISE)*bridge;
 const hem=ease(b.x0,b.x0+8,x)*(1-ease(b.x1-8,b.x1,x))
  *ease(b.z0,b.z0+6,z)*(1-ease(b.z1-7,b.z1,z));
 return original+(gain-loss)*hem*ease(10,16,original);
}
