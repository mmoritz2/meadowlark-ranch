// Original outer woodland composition in world metres. Branching stands,
// open bays and small detached islands share one mask with the ground shader.
// This module neither creates geometry/resources nor consumes ambient RNG.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const clamp=x=>Math.max(0,Math.min(1,x));
// Each node is [x,z,woodland width]. Branches taper differently and advance
// different distances, rather than putting every grove on one front contour.
const authored=[
 ['northwest-core',[[-760,-740,90],[-650,-755,110],[-600,-690,88]]],
 ['northwest-finger',[[-650,-735,76],[-560,-642,35],[-510,-585,10]]],
 ['northwest-outer-spur',[[-725,-720,70],[-720,-612,44],[-655,-580,13]]],
 ['north-west-core',[[-355,-805,95],[-230,-770,105],[-120,-815,110]]],
 ['north-west-finger',[[-245,-770,82],[-292,-664,58],[-348,-588,17]]],
 ['north-west-bough',[[-155,-795,76],[-85,-710,43],[-125,-620,13]]],
 ['north-east-core',[[100,-810,100],[215,-755,105],[335,-805,100]]],
 ['north-east-finger',[[185,-770,72],[170,-650,38],[92,-580,12]]],
 ['north-east-bough',[[300,-785,78],[363,-710,49],[395,-628,16]]],
 ['northeast-core',[[670,-670,100],[715,-540,105],[660,-430,80]]],
 ['northeast-finger',[[680,-535,70],[596,-490,40],[572,-415,10]]],
 ['east-core',[[785,-200,100],[755,-85,110],[815,40,100]]],
 ['east-finger',[[745,-70,74],[650,-140,40],[580,-208,12]]],
 ['southeast-core',[[720,330,100],[775,455,120],[700,560,105]]],
 ['southeast-finger',[[730,430,76],[630,420,45],[574,340,12]]],
 ['south-east-core',[[430,735,120],[270,785,110],[155,740,80]]],
 ['south-east-finger',[[315,755,76],[260,650,45],[305,575,10]]],
 ['south-core',[[-25,825,105],[-155,775,110],[-285,805,95]]],
 ['south-west-finger',[[-160,785,78],[-235,665,55],[-320,578,13]]],
 ['south-east-bough',[[-80,780,65],[-70,660,35],[-40,590,12]]],
 ['west-scrub-core',[[-785,165,80],[-735,295,95],[-785,410,85]]],
 ['west-scrub-finger',[[-760,290,65],[-640,270,38],[-575,325,8]]],
 ['west-core',[[-770,15,85],[-815,-145,110],[-750,-295,100]]],
 ['west-finger',[[-770,-175,74],[-660,-210,45],[-585,-160,11]]],
 ['west-north-bough',[[-760,-310,68],[-660,-395,42],[-615,-475,12]]],
];
export const OUTER_GROVES=Object.freeze(authored.map(([id,points])=>{
 const nodes=Object.freeze(points.map(Object.freeze)),margin=Math.max(...nodes.map(n=>n[2]))*1.18;
 const xs=nodes.map(n=>n[0]),zs=nodes.map(n=>n[1]);
 return Object.freeze({id,nodes,minX:Math.min(...xs)-margin,maxX:Math.max(...xs)+margin,minZ:Math.min(...zs)-margin,maxZ:Math.max(...zs)+margin});
}));
export const OUTER_WOODLAND_ISLANDS=Object.freeze([
 [-485,-672,22,.75],[-395,-730,28,.85],[-30,-660,23,.68],[445,-605,24,.72],
 [585,60,27,.72],[-605,35,20,.60],[30,630,21,.65],[-425,645,25,.70],[585,565,20,.65],
].map(Object.freeze));
export const OUTER_WOODLAND_LIMIT=4200;
function segmentRadius(x,z,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
 return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/(a[2]+(b[2]-a[2])*t);
}
export function outerGroveWeight(x,z){
 const d=Math.hypot(Math.max(0,Math.abs(x)-500),Math.max(0,Math.abs(z)-500));
 const reach=smooth(58,82,d)*(1-smooth(335,400,d));if(!reach)return 0;
 let woodland=0;
 for(const g of OUTER_GROVES){
  if(x<g.minX||x>g.maxX||z<g.minZ||z>g.maxZ)continue;
  let radius=10000;
  for(let i=1;i<g.nodes.length;i++)radius=Math.min(radius,segmentRadius(x,z,g.nodes[i-1],g.nodes[i]));
  woodland=Math.max(woodland,1-smooth(.28,1.18,radius));
 }
 for(const [ix,iz,r,strength]of OUTER_WOODLAND_ISLANDS)woodland=Math.max(woodland,(1-smooth(.15,1,Math.hypot(x-ix,z-iz)/r))*strength);
 return woodland*reach;
}
const f=n=>Number(n).toFixed(9),v=n=>`vec3(${n.map(f).join(',')})`;
export const OUTER_GROVES_GLSL=`
float outerWoodSegment(vec2 p,vec3 a,vec3 b){
 vec2 direction=b.xy-a.xy;
 float t=clamp(dot(p-a.xy,direction)/dot(direction,direction),0.0,1.0);
 return length(p-a.xy-direction*t)/mix(a.z,b.z,t);
}
float outerGroveWeight(vec2 p){
 float d=length(max(abs(p)-vec2(500.0),vec2(0.0)));
 float reach=smoothstep(58.0,82.0,d)*(1.0-smoothstep(335.0,400.0,d));
 if(reach<=0.0)return 0.0;
 float woodland=0.0;
 ${OUTER_GROVES.map(g=>`if(p.x>=${f(g.minX)}&&p.x<=${f(g.maxX)}&&p.y>=${f(g.minZ)}&&p.y<=${f(g.maxZ)}){
  float radius=10000.0;
  ${g.nodes.slice(1).map((b,i)=>`radius=min(radius,outerWoodSegment(p,${v(g.nodes[i])},${v(b)}));`).join('\n  ')}
  woodland=max(woodland,1.0-smoothstep(.28,1.18,radius));
 }`).join('\n ')}
 ${OUTER_WOODLAND_ISLANDS.map(([x,z,r,strength])=>`woodland=max(woodland,(1.0-smoothstep(.15,1.0,length(p-vec2(${f(x)},${f(z)}))/${f(r)}))*${f(strength)});`).join('\n ')}
 return woodland*reach;
}
`;

function hash(x,z){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
export function selectOuterWoodland({positions,index,regionalProfileAt}){
 const candidates=[],v=id=>[positions[id*3],positions[id*3+1],positions[id*3+2]];
 for(let i=0;i<index.length;i+=3){
  const a=[v(index[i]),v(index[i+1]),v(index[i+2])],dx=a[1][0]-a[0][0],dz=a[1][2]-a[0][2],ex=a[2][0]-a[0][0],ez=a[2][2]-a[0][2];
  const determinant=dx*ez-ex*dz,area=Math.abs(determinant)*.5;if(area<.01)continue;
  const cx=(a[0][0]+a[1][0]+a[2][0])/3,cz=(a[0][2]+a[1][2]+a[2][2])/3,cd=Math.hypot(Math.max(0,Math.abs(cx)-500),Math.max(0,Math.abs(cz)-500));
  if(cd<40||cd>430)continue;
  const dy=a[1][1]-a[0][1],ey=a[2][1]-a[0][1],normal=[dy*ez-dz*ey,dz*ex-dx*ez,dx*ey-dy*ex],length=Math.hypot(...normal);
  if(normal[1]<0)for(let k=0;k<3;k++)normal[k]*=-1;
  for(let k=0;k<3;k++)normal[k]/=length;
  const slope=Math.hypot(normal[0],normal[2])/Math.max(.0001,normal[1]);if(slope>.52)continue;
  const count=Math.ceil(area/26);
  for(let j=0;j<count;j++){
   if(hash(i+1,j+70)>area/(count*26))continue;
   const u=Math.sqrt(hash(i+17,j+153)),v=hash(i+41,j+371),weights=[1-u,u*(1-v),u*v];
   const [x,y,z]=[0,1,2].map(k=>a.reduce((sum,p,n)=>sum+p[k]*weights[n],0)),grove=outerGroveWeight(x,z);
   if(grove<.065)continue;
   const region=regionalProfileAt(x,z),valley=1-smooth(.36,.78,region.valley);
   const probability=(.17+.83*grove)*smooth(.035,.28,grove)*region.woodlandDensity*valley*(1-smooth(.22,.52,slope));
   if(hash(i+809,j+307)>probability)continue;
   const pineProbability=region.north*(.30+.52*grove)+(1-region.north)*.10;
   const source=hash(i+313,j+131)<pineProbability?'mature-pine':hash(i+17,j+3)>.50?'canopy-broadleaf':'woodland-broadleaf';
   // Graduated young fringes expose irregular bays below the mature canopy.
   let height=(9+12*smooth(.12,.88,grove)+hash(i+617,j+19)*6)*(1-region.dry*.60)*(1-region.valley*.16);
   if(hash(i+331,j+73)<.18)height*=.68;
   if(region.dry>.7)height=Math.min(height,9.8);
   candidates.push({x,y,z,height,yaw:hash(i+941,j+71)*Math.PI*2,source,grove,slope,triangle:i/3,barycentric:weights,normal,
    rank:hash(i+1601,j+967),spacing:source==='mature-pine'?4.6+height*.035:5.3+height*.035});
  }
 }
 // Sort across the whole world before packing. The fixed cap never truncates
 // one side of the map, and a spatial hash prevents coincident billboard trunks.
 candidates.sort((a,b)=>a.rank-b.rank||a.x-b.x||a.z-b.z);
 const sites=[],bins=new Map(),cell=7;
 for(const site of candidates){
  const ix=Math.floor(site.x/cell),iz=Math.floor(site.z/cell);let crowded=false;
  for(let dx=-1;dx<=1&&!crowded;dx++)for(let dz=-1;dz<=1&&!crowded;dz++)for(const other of bins.get((ix+dx)+','+(iz+dz))||[])
   if(Math.hypot(site.x-other.x,site.z-other.z)<Math.max(site.spacing,other.spacing)){crowded=true;break;}
  if(crowded)continue;
  const key=ix+','+iz;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(site);sites.push(site);
  if(sites.length===OUTER_WOODLAND_LIMIT)break;
 }
 return sites.map(({rank,spacing,...site})=>site);
}
