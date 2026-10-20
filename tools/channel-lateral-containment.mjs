// Continuous lateral support of a fixed channel mesh against canonical terrain.
// This is a CPU QA tool; it does not change terrain, water or scene resources.
function clip(polygon,distance){
 if(!polygon.length)return polygon;
 const result=[];let p=polygon.at(-1),dp=distance(p);
 for(const q of polygon){const dq=distance(q);
  if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);result.push(p.map((v,k)=>v+(q[k]-v)*t));}
  if(dq>=0)result.push(q);p=q;dp=dq;
 }
 return result;
}
function union(intervals){
 const result=[];
 for(const[a,b]of intervals.sort((a,b)=>a[0]-b[0])){
  if(b-a<1e-12)continue;
  const prior=result.at(-1);if(prior&&a<=prior[1]+1e-10)prior[1]=Math.max(prior[1],b);else result.push([a,b]);
 }
 return result;
}
export function subtractIntervals(base,removed){
 const result=[];
 for(const[a,b]of base){let cursor=a;
  for(const[c,d]of removed){if(d<=cursor)continue;if(c>=b)break;if(c>cursor)result.push([cursor,Math.min(c,b)]);cursor=Math.max(cursor,d);if(cursor>=b)break;}
  if(cursor<b)result.push([cursor,b]);
 }
 return result;
}

/**
 * Each mesh row is linear in z and has a fixed horizontal cross-section.
 * Canonical terrain is affine on each of its two cell triangles. Clipping
 * those triangles to a side belt and then to clearance>=threshold produces
 * exact supported-z projections, including intervals between mesh rows.
 */
export function auditChannelLateralContainment({before,after,positions,size=513,step=1000/512,columns=12,outwardM=10,thresholds=[0,.15],endpointLipM=1.5}){
 if(before.length!==size*size||after.length!==before.length||positions.length%((columns+1)*3)!==0)throw new TypeError('Complete canonical fields and regular channel rows required');
 if(!(step>0&&outwardM>0&&endpointLipM>=0)||thresholds.some(v=>!Number.isFinite(v)||v<0))throw new TypeError('Finite positive channel audit dimensions required');
 const rows=positions.length/((columns+1)*3)-1;if(rows<1)throw new TypeError('At least two channel rows required');
 const vertex=(j,i)=>{const k=(j*(columns+1)+i)*3;return[positions[k],positions[k+1],positions[k+2]];};
 for(let j=0;j<=rows;j++){const a=vertex(j,0),b=vertex(j,columns);if(![...a,...b].every(Number.isFinite)||a[2]!==b[2]||a[1]!==b[1]||a[0]>=b[0]||j&&a[2]<=vertex(j-1,0)[2])throw new TypeError('Finite ordered horizontal channel rows required');}
 const result={rows,columns,outwardM,endpointLipM,sides:{}};
 for(const[side,sign,column]of[['west',-1,0],['east',1,columns]]){
  const collected={before:new Map(thresholds.map(v=>[v,[]])),after:new Map(thresholds.map(v=>[v,[]]))};
  let clippedTriangles=0,coveredAreaM2=0;
  for(let j=0;j<rows;j++){
   const a=vertex(j,column),b=vertex(j+1,column),z0=a[2],z1=b[2],xm=(b[0]-a[0])/(z1-z0),xb=a[0]-xm*z0,ym=(b[1]-a[1])/(z1-z0),yb=a[1]-ym*z0;
   const edge=z=>xm*z+xb,water=z=>ym*z+yb;
   const xmin=Math.min(a[0],b[0],a[0]+sign*outwardM,b[0]+sign*outwardM),xmax=Math.max(a[0],b[0],a[0]+sign*outwardM,b[0]+sign*outwardM);
   const ix0=Math.floor((xmin+500)/step),ix1=Math.floor((xmax+500)/step),iz0=Math.floor((z0+500)/step),iz1=Math.floor((z1+500)/step);
   if(ix0<0||ix1>=size-1||iz0<0||iz1>=size-1)throw new RangeError('Complete side belt must lie within canonical terrain');
   let rowArea=0;
   for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++)for(const coordinates of[[[ix,iz],[ix+1,iz],[ix,iz+1]],[[ix+1,iz],[ix+1,iz+1],[ix,iz+1]]]){
    let polygon=coordinates.map(([gx,gz])=>{const x=gx*step-500,z=gz*step-500,i=gz*size+gx;return[x,z,before[i]-water(z),after[i]-water(z)];});
    if(polygon.some(p=>!p.every(Number.isFinite)))throw new TypeError('Finite actual terrain samples required');
    for(const f of[p=>p[1]-z0,p=>z1-p[1],p=>sign*(p[0]-edge(p[1])),p=>outwardM-sign*(p[0]-edge(p[1]))])polygon=clip(polygon,f);
    if(polygon.length<3)continue;
    const area=Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
    if(area<1e-10)continue;
    rowArea+=area;clippedTriangles++;
    for(const[key,index]of[['before',2],['after',3]])for(const threshold of thresholds){
     const supported=clip(polygon,p=>p[index]-threshold);
     if(supported.length)collected[key].get(threshold).push([Math.min(...supported.map(p=>p[1])),Math.max(...supported.map(p=>p[1]))]);
    }
   }
   if(Math.abs(rowArea-outwardM*(z1-z0))>1e-7)throw new Error('Clipped triangles do not cover the entire side belt');
   coveredAreaM2+=rowArea;
  }
  const z0=vertex(0,column)[2],z1=vertex(rows,column)[2],lipStart=z1-endpointLipM,domain=[[z0,z1]],sideResult={zDomain:[z0,z1],lastLip:[lipStart,z1],clippedTriangles,coveredAreaM2,thresholds:{}};
  for(const threshold of thresholds){const beforeSupportedZ=union(collected.before.get(threshold)),afterSupportedZ=union(collected.after.get(threshold)),newLostContainmentZ=subtractIntervals(beforeSupportedZ,afterSupportedZ);sideResult.thresholds[threshold]={beforeSupportedZ,afterSupportedZ,newLostContainmentZ,newLostCoreZ:subtractIntervals(newLostContainmentZ,[[lipStart,z1]]),baselineUnsupportedZ:subtractIntervals(domain,beforeSupportedZ),candidateUnsupportedZ:subtractIntervals(domain,afterSupportedZ)};}
  result.sides[side]=sideResult;
 }
 return result;
}
