// Authored northern watershed: connected divides, unequal descending ridge arms
// and shallow drainage corridors. This field introduces no random displacement.
export const OUTER_WATERSHED_PROFILE='northern-watershed-2';
// [x,z,height,left width,right width]. Ends taper to zero instead of round caps.
export const OUTER_WATERSHED_RIDGES=Object.freeze([
 ['rear-divide',[[-1080,-870,0,130,150],[-920,-870,20,165,170],[-755,-892,43,170,185],[-630,-941,41,176,166],[-447,-876,12,142,178],[-185,-930,47,180,195],[10,-869,16,170,160],[188,-917,44,175,170],[380,-948,20,180,180],[575,-873,42,170,180],[785,-887,33,165,160],[1050,-895,0,120,140]]],
 ['northwest-shoulder',[[-808,-941,0,115,145],[-738,-853,32,125,105],[-659,-775,36,95,130],[-602,-689,26,78,108],[-518,-607,12,65,89],[-472,-540,0,49,66]]],
 ['northwest-inner-arm',[[-448,-927,0,95,120],[-407,-825,21,108,92],[-394,-748,28,92,115],[-387,-672,25,67,91],[-320,-611,10,54,76],[-336,-540,0,43,57]]],
 ['north-arm',[[-164,-974,0,115,130],[-177,-872,36,126,96],[-184,-794,34,103,130],[-96,-716,24,80,106],[-130,-632,10,62,79],[-75,-540,0,45,58]]],
 ['northeast-arm',[[172,-967,0,105,140],[187,-880,34,128,94],[215,-789,33,103,128],[306,-711,27,79,107],[384,-633,12,66,82],[363,-539,0,45,60]]],
 ['east-shoulder',[[575,-975,0,112,142],[576,-865,34,130,99],[585,-764,36,100,132],[656,-674,24,84,110],[616,-591,10,62,80],[575,-539,0,46,61]]],
].map(([id,nodes])=>Object.freeze({id,nodes:Object.freeze(nodes.map(Object.freeze))})));
export const OUTER_WATERSHED_DRAINS=Object.freeze([
 ['west-gully',[[-420,-934,0,80,90],[-433,-860,1.8,93,75],[-472,-793,3,75,64],[-478,-720,3.2,58,82],[-423,-632,2,60,88],[-354,-557,.8,75,92],[-340,-526,0,75,90]]],
 ['north-gully',[[-24,-883,0,72,83],[12,-805,4,74,87],[2,-724,8,50,65],[43,-636,6,43,56],[22,-542,0,55,63]]],
 ['east-gully',[[448,-876,0,76,80],[461,-786,5,78,70],[470,-711,8,48,63],[477,-624,5,42,54],[468,-541,0,48,61]]],
].map(([id,nodes])=>Object.freeze({id,nodes:Object.freeze(nodes.map(Object.freeze))})));
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
function spline(a,b,c,d,t){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
function sampledPath(nodes){const samples=[];for(let i=0;i<nodes.length-1;i++){const a=nodes[Math.max(0,i-1)],b=nodes[i],c=nodes[i+1],d=nodes[Math.min(nodes.length-1,i+2)],steps=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/12);for(let k=0;k<steps;k++){const t=k/steps;samples.push([spline(a[0],b[0],c[0],d[0],t),spline(a[1],b[1],c[1],d[1],t),Math.max(0,spline(a[2],b[2],c[2],d[2],t)),Math.max(24,spline(a[3],b[3],c[3],d[3],t)),Math.max(24,spline(a[4],b[4],c[4],d[4],t))]);}}samples.push(nodes.at(-1));return samples;}
const ridges=OUTER_WATERSHED_RIDGES.map(r=>sampledPath(r.nodes));
const drains=OUTER_WATERSHED_DRAINS.map(r=>sampledPath(r.nodes));
function crossSection(t){if(t>=1)return 0;const q=clamp(t);return Math.pow(1-q*q,2)*(1-.16*q);}
function pathRelief(x,z,points){let value=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));const ox=x-a[0]-dx*t,oz=z-a[1]-dz*t,left=a[3]+(b[3]-a[3])*t,right=a[4]+(b[4]-a[4])*t,perpendicular=(dx*(z-a[1])-dz*(x-a[0]))/Math.hypot(dx,dz),width=right+(left-right)*smooth((perpendicular+12)/24);value=Math.max(value,(a[2]+(b[2]-a[2])*t)*crossSection(Math.hypot(ox,oz)/width));}return value;}
// A fourth-power union has an exact zero identity. Unlike a polynomial soft
// maximum, a newly entering ridge cannot add a constant at its support edge.
function joinedRidge(a,b){return Math.pow(a*a*a*a+b*b*b*b,.25);}
export function outerWatershedWeight(x,z){const d=Math.max(Math.abs(x),Math.abs(z))-500;return smooth((d-26)/60)*(1-smooth((d-480)/220))*smooth((-z-526)/40)*(1-smooth((Math.abs(x)-890)/230));}
export function outerWatershedHeight(x,z,legacyHeight){const weight=outerWatershedWeight(x,z);if(weight===0)return legacyHeight;
 let ridge=0;for(const path of ridges){const value=pathRelief(x,z,path);if(value>0)ridge=joinedRidge(ridge,value);}
 let drain=0;for(const path of drains)drain=Math.max(drain,pathRelief(x,z,path));
 const distance=Math.max(Math.abs(x),Math.abs(z))-500;
 const lowland=5.5+4*smooth((distance-30)/270);
 const authored=lowland+ridge-drain;
 return legacyHeight+(authored-legacyHeight)*weight;
}
// Keep authored woodland XZ, species, size and yaw. Only its actual-triangle
// grounding is recomputed when the outside landscape topology changes.
export function reseatOuterWoodland(sites,positions,index){
 const bins=new Map(),cell=48;
 for(let k=0;k<index.length;k+=3){const a=index[k]*3,b=index[k+1]*3,c=index[k+2]*3,minX=Math.floor(Math.min(positions[a],positions[b],positions[c])/cell),maxX=Math.floor(Math.max(positions[a],positions[b],positions[c])/cell),minZ=Math.floor(Math.min(positions[a+2],positions[b+2],positions[c+2])/cell),maxZ=Math.floor(Math.max(positions[a+2],positions[b+2],positions[c+2])/cell);for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(k);}}
 return sites.map(site=>{
  for(const k of bins.get(Math.floor(site.x/cell)+':'+Math.floor(site.z/cell))||[]){const a=index[k]*3,b=index[k+1]*3,c=index[k+2]*3,ax=positions[a],az=positions[a+2],bx=positions[b],bz=positions[b+2],cx=positions[c],cz=positions[c+2],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-12)continue;const wa=((bz-cz)*(site.x-cx)+(cx-bx)*(site.z-cz))/den,wb=((cz-az)*(site.x-cx)+(ax-cx)*(site.z-cz))/den,wc=1-wa-wb;if(wa< -1e-7||wb< -1e-7||wc< -1e-7)continue;
   const u=[positions[b]-positions[a],positions[b+1]-positions[a+1],positions[b+2]-positions[a+2]],v=[positions[c]-positions[a],positions[c+1]-positions[a+1],positions[c+2]-positions[a+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n),normal=n.map(q=>q/length);if(normal[1]<0)throw Error('Reversed outer woodland triangle');
   return {...site,y:wa*positions[a+1]+wb*positions[b+1]+wc*positions[c+1],triangle:k/3,barycentric:[wa,wb,wc],normal,slope:Math.hypot(normal[0],normal[2])/normal[1]};
  }throw Error('Existing woodland root misses rebuilt outside terrain');
 });
}
