// Original outer forest composition, in world metres. Shared mask drives trees
// and ground shading; this module neither creates geometry nor consumes RNG.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const OUTER_GROVES=Object.freeze([
 ['northwest-shoulder',-645,-650,165,135,.50],
 ['north-west-fold',-220,-690,180,125,-.18],
 ['north-east-fold',225,-725,200,125,.12],
 ['northeast-shoulder',665,-490,145,170,-.40],
 ['east-wood',710,-95,130,175,.13],
 ['southeast-wood',675,485,170,145,.22],
 ['south-east-wood',295,725,180,135,-.20],
 ['south-wood',-175,705,175,120,.08],
 ['west-scrub',-705,290,135,150,-.20],
 ['northwest-wood',-695,-230,125,190,.15],
].map(([id,x,z,rx,rz,yaw])=>Object.freeze({id,x,z,rx,rz,cos:Math.cos(yaw),sin:Math.sin(yaw)})));
export const OUTER_WOODLAND_LIMIT=4200;
export function outerGroveWeight(x,z){
 const d=Math.hypot(Math.max(0,Math.abs(x)-500),Math.max(0,Math.abs(z)-500));
 const reach=smooth(58,82,d)*(1-smooth(335,400,d));if(!reach)return 0;
 const warp=Math.sin(x*.023+z*.009)*.09+Math.sin(z*.041-x*.013)*.05;
 let radius=Infinity;
 for(const g of OUTER_GROVES){const dx=x-g.x,dz=z-g.z,u=(dx*g.cos+dz*g.sin)/g.rx,v=(-dx*g.sin+dz*g.cos)/g.rz;radius=Math.min(radius,Math.hypot(u,v));}
 return (1-smooth(.54,1.06,radius+warp))*reach;
}
const f=n=>Number(n).toFixed(9);
export const OUTER_GROVES_GLSL=`
float outerGroveWeight(vec2 p){
 float d=length(max(abs(p)-vec2(500.0),vec2(0.0)));
 float reach=smoothstep(58.0,82.0,d)*(1.0-smoothstep(335.0,400.0,d));
 float warp=sin(p.x*.023+p.y*.009)*.09+sin(p.y*.041-p.x*.013)*.05;
 float radius=10000.0;
 ${OUTER_GROVES.map(g=>`{vec2 q=p-vec2(${f(g.x)},${f(g.z)});vec2 v=vec2(q.x*${f(g.cos)}+q.y*${f(g.sin)},-q.x*${f(g.sin)}+q.y*${f(g.cos)})/vec2(${f(g.rx)},${f(g.rz)});radius=min(radius,length(v));}`).join('\n ')}
 return (1.0-smoothstep(.54,1.06,radius+warp))*reach;
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
   const probability=Math.pow(grove,1.30)*region.woodlandDensity*valley*(1-smooth(.22,.52,slope));
   if(hash(i+809,j+307)>probability)continue;
   const pineProbability=region.north*(.50+.30*grove)+(1-region.north)*.10;
   const source=hash(i+313,j+131)<pineProbability?'mature-pine':hash(i+17,j+3)>.50?'canopy-broadleaf':'woodland-broadleaf';
   let height=(14+5*grove+hash(i+617,j+19)*8)*(1-region.dry*.60)*(1-region.valley*.16);
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
