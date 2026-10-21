// One post-allocation source-foot plan. No Three resources, random draws,
// loader, source/variant choice, quota refill or scene mutation lives here.
export const HOLLOWPEAK_SOURCE_FOOT_PROFILE='hollowpeak-owned-source-foot-2';
// .22m low wood band and .25m exposure follow the existing resident root
// adapter. Its one-metre sink/burial guards are retained, rather than imposing
// centimetre burial on flared roots known to be naturally embedded. Grade and
// wet exclusion intentionally retire unsuitable NEW habitats; no body claim.
const POLICY=Object.freeze({bandM:.22,maximumExposureM:.25,maximumBurialM:1,maximumAdjustmentM:1,maximumGrade:.55,wetMarginM:.6,numericalToleranceM:.00008});
const finite=Number.isFinite,wood=part=>!/leaf|leaves|needle|twig|fruit/i.test((part.mat??part.material)?.name??part.name??''),cache=new WeakMap(),shoreCache=new WeakMap();
export const permitsHollowpeakMember=member=>member?.hollowpeakCohort?.action!=='retire';
const bounds=()=>({x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity});
function grow(b,p){b.x0=Math.min(b.x0,p[0]);b.x1=Math.max(b.x1,p[0]);b.z0=Math.min(b.z0,p[2]);b.z1=Math.max(b.z1,p[2]);}
function clip(poly,distance){if(!poly.length)return poly;const out=[];let a=poly.at(-1),da=distance(a);for(const b of poly){const db=distance(b),ina=da>=0,inb=db>=0;if(ina!==inb){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}if(inb)out.push(b);a=b;da=db;}return out;}
function sourceParts(parts){
 if(cache.has(parts))return cache.get(parts);
 const result=[];let sourceVertices=0;
 for(const part of parts.filter(wood)){
  const geo=part.geo??part.geometry,p=geo?.attributes?.position;if(!p)continue;
  if(!Number.isInteger(p.count)||p.count<3)throw Error('Indexed resident source wood positions required');
  const index=geo.index,count=index?.count??index?.array?.length??index?.length??p.count;
  if(!Number.isInteger(count)||count%3)throw Error('Resident wood must contain complete triangles');
  const at=i=>index?(index.getX?index.getX(i):(index.array??index)[i]):i;
  for(let i=0;i<count;i++)if(!Number.isInteger(at(i))||at(i)<0||at(i)>=p.count)throw Error('Invalid resident source wood index');
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];if(!v.every(finite))throw Error('Nonfinite resident source wood');for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}}
  result.push({p,at,count,lo,hi});sourceVertices+=p.count;
 }
 if(!result.length)throw Error('Actual resident source wood triangles required');
 const out={parts:result,sourceVertices};cache.set(parts,out);return out;
}
function shoreOwners(geometry){
 if(!geometry)return new Map();if(shoreCache.has(geometry))return shoreCache.get(geometry);
 const {position:p,index:I,owners:o}=geometry,map=new Map();
 if(!(p instanceof Float32Array)||!(I instanceof Uint32Array)||!(o instanceof Uint16Array)||o.length!==I.length)throw Error('Actual typed shore geometry required');
 for(let f=0;f<I.length/3;f++){const key=o[f*3]+','+o[f*3+1]+','+o[f*3+2],tri=[0,1,2].map(k=>{const i=I[f*3+k]*3;return[p[i],p[i+1],p[i+2]];}),list=map.get(key)||[];list.push(tri);map.set(key,list);}
 shoreCache.set(geometry,map);return map;
}
const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
function intersectsShore(poly,tri){let p=poly;const sign=cross(tri[0],tri[1],tri[2])>=0?1:-1;for(let k=0;k<3&&p.length;k++)p=clip(p,v=>sign*cross(tri[k],tri[(k+1)%3],v));return p.length>0;}
// Clip actual low-band source surfaces against each exact anti-diagonal
// canonical plane. Affine wood-minus-ground extrema are polygon vertices.
// This includes triangles crossing the band with NO original vertex inside.
function measure(polys,field,geometry,supportAt){
 const S=1.953125,O=-500,cell=v=>Math.max(0,Math.min(511,Math.floor((v-O)/S))),shores=shoreOwners(geometry);
 let minimum=Infinity,maximum=-Infinity,maximumGrade=0,samples=0,canonicalPieces=0,shoreIntersection=false,foreignSupport=false;
 for(const poly of polys){const b=bounds();for(const v of poly)grow(b,v);
  if(b.x0<O||b.z0<O||b.x1>500||b.z1>500)throw Error('Affected source foot outside canonical field');
  for(let iz=cell(b.z0);iz<=cell(b.z1);iz++)for(let ix=cell(b.x0);ix<=cell(b.x1);ix++)for(let half=0;half<2;half++){
   const x=O+ix*S,z=O+iz*S;let p=poly;
   for(const d of half?[v=>x+S-v[0],v=>z+S-v[2],v=>v[0]+v[2]-x-z-S]:[v=>v[0]-x,v=>v[2]-z,v=>x+z+S-v[0]-v[2]])p=clip(p,d);
   if(!p.length)continue;canonicalPieces++;
   const cx=x+S*(half?2/3:1/3),cz=z+S*(half?2/3:1/3);maximumGrade=Math.max(maximumGrade,field.derivativesAt(cx,cz).grade);
   for(const tri of shores.get(ix+','+iz+','+half)||[])if(intersectsShore(p,tri)){shoreIntersection=true;break;}
   for(const v of p){const h=field.heightAt(v[0],v[2]),gap=v[1]-h;if(!finite(gap))throw Error('Nonfinite canonical source-foot gap');minimum=Math.min(minimum,gap);maximum=Math.max(maximum,gap);samples++;
    if(supportAt){const support=supportAt(v[0],v[2]);if(!finite(support))throw Error('Nonfinite supplied support');if(Math.abs(support-h)>POLICY.numericalToleranceM)foreignSupport=true;}
   }
  }
 }
 if(!samples)throw Error('No canonical intersection for actual resident source foot');
 return{minimum,maximum,maximumGrade,samples,canonicalPieces,shoreIntersection,foreignSupport};
}
export function planHollowpeakSourceFoot({id,parts,matrix,queries,supportAt=null,role='tree',sourceKey=null}){
 const e=Array.from(matrix?.elements??matrix??[]);if(e.length!==16||!e.every(finite)||e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1)throw Error('Finite affine source owner matrix required');
 if(!Array.isArray(parts)||!queries?.affectsFootprint||!queries.ecologyAt)throw Error('Actual source parts and final owned ecology queries required');
 const field=typeof queries.heightAt==='function'?queries:queries.design;if(typeof field?.heightAt!=='function'||typeof field.derivativesAt!=='function')throw Error('Actual canonical field handle required');
 const src=sourceParts(parts),transform=p=>[p[0]*e[0]+p[1]*e[4]+p[2]*e[8]+e[12],p[0]*e[1]+p[1]*e[5]+p[2]*e[9]+e[13],p[0]*e[2]+p[1]*e[6]+p[2]*e[10]+e[14]],coarse=bounds();
 for(const part of src.parts)for(const x of[part.lo[0],part.hi[0]])for(const y of[part.lo[1],part.hi[1]])for(const z of[part.lo[2],part.hi[2]])grow(coarse,transform([x,y,z]));
 const base={profile:HOLLOWPEAK_SOURCE_FOOT_PROFILE,id,role,sourceKey,originalMatrix:e,matrix:e.slice(),footBounds:coarse,sourceVertices:src.sourceVertices,policy:POLICY,sourceAndPoseChoiceChanged:false,completeBodyAccepted:false,supportScope:'Actual canonical terrain plus explicit exclusion of the shared owned shore. Arbitrary other support callbacks are not certified.'};
 if(!queries.affectsFootprint(coarse,0))return{...base,affected:false,action:'keep',reason:'outside conservative actual wood bounds'};
 let low=Infinity,high=-Infinity;
 for(const part of src.parts){const p=part.p;for(let i=0;i<p.count;i++){const y=p.getX(i)*e[1]+p.getY(i)*e[5]+p.getZ(i)*e[9]+e[13];low=Math.min(low,y);high=Math.max(high,y);}}
 const foot=[],b=bounds();let originalBandVertices=0;
 for(const part of src.parts){const p=part.p;for(let i=0;i<p.count;i++)if(p.getX(i)*e[1]+p.getY(i)*e[5]+p.getZ(i)*e[9]+e[13]<=low+POLICY.bandM+1e-7)originalBandVertices++;
  for(let i=0;i<part.count;i+=3){let tri=[0,1,2].map(k=>{const j=part.at(i+k);return transform([p.getX(j),p.getY(j),p.getZ(j)]);});if(tri.every(v=>v[1]>low+POLICY.bandM))continue;tri=clip(tri,v=>low+POLICY.bandM-v[1]);if(tri.length){foot.push(tri);for(const v of tri)grow(b,v);}}
 }
 if(!foot.length)throw Error('Actual indexed source low band is empty');
 Object.assign(base,{footBounds:b,sourceFootPolygons:foot.length,sourceFootVertices:originalBandVertices,sourceWoodHeightM:high-low});
 if(!queries.affectsFootprint(b,0))return{...base,affected:false,action:'keep',reason:'outside complete actual indexed low wood foot'};
 const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,r=Math.hypot(b.x1-b.x0,b.z1-b.z0)/2,ecology=queries.ecologyAt(x,z,{pad:r+POLICY.wetMarginM,footprint:b,probe:0,gradeLimit:POLICY.maximumGrade});
 const retire=(reason,extra={})=>({...base,affected:true,action:'retire',reason,ecology,...extra});
 if(ecology.wet||ecology.fall)return retire(ecology.wet?'actual wet footprint intersects conservative source foot':'actual fall envelope intersects conservative source foot');
 const measured=measure(foot,field,queries.shoreGeometry,supportAt),diagnostics={canonicalFootSampleCount:measured.samples,canonicalFootPieces:measured.canonicalPieces,maximumFootGrade:measured.maximumGrade,actualGapBeforeMin:measured.minimum,actualGapBeforeMax:measured.maximum};
 if(measured.shoreIntersection)return retire('actual indexed source foot intersects shared finite wet shore',diagnostics);
 if(measured.foreignSupport)return retire('supplied noncanonical support cannot be certified by canonical source-foot solver',diagnostics);
 if(measured.maximumGrade>POLICY.maximumGrade)return retire('canonical grade exceeds owned root-foot policy',diagnostics);
 const lower=-POLICY.maximumBurialM-measured.minimum,upper=POLICY.maximumExposureM-measured.maximum;
 if(lower>upper+POLICY.numericalToleranceM)return retire('actual low wood cannot fit both exposure and burial bounds',{...diagnostics,lowerAdjustmentM:lower,upperAdjustmentM:upper});
 const adjustmentM=Math.max(lower,Math.min(upper,0));
 if(Math.abs(adjustmentM)>POLICY.maximumAdjustmentM+POLICY.numericalToleranceM)return retire('actual low wood requires excessive additional root seating',{...diagnostics,adjustmentM});
 const out=e.slice();out[13]+=adjustmentM;
 return{...base,matrix:out,affected:true,action:adjustmentM===0?'keep':'fit',reason:adjustmentM===0?'actual indexed low wood already fits':'bounded shared indexed source-foot translation',ecology,...diagnostics,adjustmentM,actualGapMin:measured.minimum+adjustmentM,actualGapMax:measured.maximum+adjustmentM};
}

// Preserve the original source pose/constructor rows. Only an actually owned
// foot uses the new authoritative host, excluding obsolete selected shore.
export function planHollowpeakRebasedSourceFoot(args,originalGroundY){
 const original=Array.from(args.matrix?.elements??args.matrix),first=planHollowpeakSourceFoot(args);
 if(!first.affected)return first;
 if(!Number.isFinite(originalGroundY))throw Error('Captured original placement ground required');
 const matrix=original.slice();matrix[13]+=args.queries.ownedSupportHeightAt(matrix[12],matrix[14])-originalGroundY;
 const plan=planHollowpeakSourceFoot({...args,matrix});
 return {...plan,originalMatrix:original,nominalMatrix:matrix,nominalRootYShiftM:matrix[13]-original[13],adjustmentFromOriginalM:plan.matrix[13]-original[13]};
}
