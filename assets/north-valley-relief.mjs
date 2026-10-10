import {fallsRelief} from './falls-landscape.js?v=alpine-range-1';

// Original connected field shoulders. The terrain grid and horse contact share
// this height; vegetation and props retain their existing placement owners.
export const NORTH_VALLEY_RELIEF_PROFILE='north-valley-relief-1';
export const NORTH_VALLEY_BOUNDS=Object.freeze({minX:-145,maxX:95,minZ:-497,maxZ:-330});
export const NORTH_VALLEY_SHOULDERS=Object.freeze([
 Object.freeze({id:'western-shoulder',points:Object.freeze([[-50,-370,37,4],[-62,-406,43,8],[-81,-443,40,9]].map(Object.freeze))}),
 Object.freeze({id:'eastern-shoulder',points:Object.freeze([[48,-397,29,3],[58,-431,32,6],[51,-463,27,4]].map(Object.freeze))}),
]);
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
// Conservative horizontal envelopes of the five alpine-range-1 landforms.
// Distance uses each ellipse's smallest radius, so the 12m protected apron is
// never narrower than 12 world metres. A further 24m transition avoids turning
// tiny height-field values at the old mountain foot into a vertical trench.
const ALPINE_ENVELOPES=Object.freeze([
 [-164,-345,63,48,-.18],[-211,-358,49,36,.42],
 [-108,-324,46,60,-.42],[-187,-308,29,43,.22],[-92,-281,39,44,.54]
].map(Object.freeze));
function alpineApronDistance(x,z){
 let nearest=Infinity;
 for(const [cx,cz,rx,rz,yaw] of ALPINE_ENVELOPES){
  const co=Math.cos(yaw),si=Math.sin(yaw),dx=x-cx,dz=z-cz;
  const radius=Math.hypot((dx*co+dz*si)/rx,(dz*co-dx*si)/rz);
  nearest=Math.min(nearest,(radius-1)*Math.min(rx,rz));
 }
 return nearest;
}
export function northValleyShoulder(x,z,points){
 let height=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
  const radius=a[2]+(b[2]-a[2])*t,crest=a[3]+(b[3]-a[3])*t;
  const r2=((x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2)/(radius*radius);
  if(r2<1)height=Math.max(height,crest*(1-r2)**3);
 }
 return height;
}
export function northValleyRelief(x,z){
 const b=NORTH_VALLEY_BOUNDS;
 if(x<=b.minX||x>=b.maxX||z<=b.minZ||z>=b.maxZ)return 0;
 let height=0;for(const shoulder of NORTH_VALLEY_SHOULDERS)height+=northValleyShoulder(x,z,shoulder.points);
 // A slight lift of the meadow floor joins the shoulders without a central dome.
 const floor=((x+8)/45)**2+((z+428)/66)**2;
 if(floor<1)height+=1.25*(1-floor)**3;
 if(height===0)return 0;
 // The explicit source check also retains any existing exposed mountain skin.
 // Current alpine relief is fully inside the zero part of the distance apron.
 if(fallsRelief(x,z)>.001)return 0;
 let keep=smooth(12,36,alpineApronDistance(x,z));
 const creekX=118+Math.sin(z*.03)*14+Math.sin(z*.011+3)*8;
 keep*=smooth(20,32,Math.abs(x-creekX));
 keep*=smooth(b.minX,b.minX+12,x)*(1-smooth(b.maxX-12,b.maxX,x));
 keep*=smooth(b.minZ,b.minZ+15,z)*(1-smooth(-346,b.maxZ,z));
 return height*keep;
}
