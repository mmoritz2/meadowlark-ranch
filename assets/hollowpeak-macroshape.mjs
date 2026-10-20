import {sculptEasternHeadwall} from './hollowpeak-eastern-headwall.mjs?v=hollowpeak-eastern-headwall-2';
// Original directional erosion for the physical Hollowpeak falls front.
// Connected gullies cut the existing mass; low toes and wet/trail supports stay exact.
export const HOLLOWPEAK_MACROSHAPE_PROFILE='hollowpeak-macroshape-1';
export const HOLLOWPEAK_MACROSHAPE_BOUNDS=Object.freeze({x0:-198,x1:-107,z0:-302,z1:-240});
const ease=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
const bump=x=>{if(Math.abs(x)>=1)return 0;const q=1-x*x;return q*q*q;};
// Each knot is [z, across x, half width, cut depth] in world metres.
// Unequal oblique clefts separate retained piers and open into their old toes.
const GULLIES=[
 [[-300,-183,6,0],[-289,-179,5.5,5],[-278,-174,5.2,13],[-266,-172,5.8,17],[-255,-176,6.4,13],[-244,-172,6.1,9],[-233,-169,7,0]],
 [[-301,-193,5,0],[-287,-188,5.5,9],[-273,-188,4.8,11],[-260,-183,5.8,9],[-248,-184,5.3,5],[-237,-181,6,0]],
 [[-301,-118,5.7,0],[-289,-119,5.3,7],[-277,-123,5.7,13],[-264,-120,5.8,16],[-252,-122,5.2,12],[-241,-116,6.2,7],[-233,-117,7,0]],
 [[-299,-137,5,0],[-285,-132,5.2,8],[-272,-134,5.3,11],[-260,-130,5.8,14],[-247,-132,5.4,11],[-235,-130,6,0]]
];
// Local benches belong to specific surviving piers. Their edges terminate in
// the adjacent gullies instead of drawing a continuous contour round the mountain.
const BENCHES=[
 {x:-181,z:-262,rx:8.1,rz:9.0,target:17.2,tiltX:.075,tiltZ:-.035,yaw:-.18},
 {x:-165.5,z:-254,rx:6.8,rz:7.6,target:14.0,tiltX:-.08,tiltZ:-.045,yaw:.24},
 {x:-126.8,z:-257,rx:7.0,rz:8.7,target:12.3,tiltX:.055,tiltZ:-.06,yaw:.28},
 {x:-114.5,z:-250,rx:6.4,rz:8.4,target:8.3,tiltX:-.07,tiltZ:-.04,yaw:-.24}
];
function tangent(points,i,k){
 if(i===0||i===points.length-1)return 0;
 const a=points[i-1],p=points[i],b=points[i+1],ha=p[0]-a[0],hb=b[0]-p[0],da=(p[k]-a[k])/ha,db=(b[k]-p[k])/hb;
 if(da*db<=0)return 0;
 const wa=2*hb+ha,wb=hb+2*ha;return(wa+wb)/(wa/da+wb/db);
}
function field(points,i,k,z){const a=points[i-1],b=points[i],h=b[0]-a[0],t=(z-a[0])/h,t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*h*tangent(points,i-1,k)+(-2*t3+3*t2)*b[k]+(t3-t2)*h*tangent(points,i,k);}
function establishedHollowpeakMacroshape(x,z,original,protection=1){
 const b=HOLLOWPEAK_MACROSHAPE_BOUNDS;
 if(!Number.isFinite(x+z+original+protection))throw new TypeError('Finite Hollowpeak physical samples required');
 if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1||original<=6||protection<=0)return original;
 let cut=0;
 for(const points of GULLIES){if(z<=points[0][0]||z>=points.at(-1)[0])continue;let i=1;while(z>points[i][0])i++;
  const centre=field(points,i,1,z),width=field(points,i,2,z),depth=field(points,i,3,z);
  cut+=Math.max(0,depth)*bump((x-centre)/width);
 }
 for(const bench of BENCHES){const dx=x-bench.x,dz=z-bench.z,c=Math.cos(bench.yaw),s=Math.sin(bench.yaw),u=(dx*c+dz*s)/bench.rx,v=(dz*c-dx*s)/bench.rz;
  const terrace=bump(u)*bump(v),target=bench.target+dx*bench.tiltX+dz*bench.tiltZ;
  cut=Math.max(cut,Math.max(0,original-target)*terrace);
 }
 if(cut<=0)return original;
 // C1 zero onset above the unchanged six-metre foot, with bounded inward loss.
 // The soft cap keeps the retained basal mass connected without a hard cut seam.
 const rise=original-6,capacity=.84*rise*rise/(rise+3);
 const loss=capacity*(-Math.expm1(-cut/capacity));
 const boundary=ease(b.x0,b.x0+5,x)*(1-ease(b.x1-5,b.x1,x))
  *ease(b.z0,b.z0+4,z)*(1-ease(b.z1-5,b.z1,z));
 return original-loss*Math.min(1,protection)*boundary;
}

export function hollowpeakMacroshape(x,z,original,protection=1){return sculptEasternHeadwall(x,z,establishedHollowpeakMacroshape(x,z,original,protection),protection);}
