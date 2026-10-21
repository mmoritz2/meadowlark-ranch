// Render attributes only. Accepted shore/contact and canonical field stay untouched.
export const HOLLOWPEAK_SHORE_ATTRIBUTES_PROFILE='hollowpeak-shore-optical-attributes-1';
const STEP=1.953125,ORIGIN=-500,SIDE=513,EDGE_GUARD=.0001,DISTANCE_GUARD=.000016,FADE_WIDTH=.45,MAX_LIFT=.0198;
const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
const pointKey=(x,z)=>x+','+z;
const distance=(x,z,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);};
function ceilFloat32(value,scratch){let result=Math.fround(value);if(result<value){scratch.f[0]=result;scratch.u[0]+=result<0?-1:1;result=scratch.f[0];}return result;}
// Does a finite line segment meet any part of this closed clockwise triangle?
function segmentMeetsTriangle(ax,az,bx,bz,t){let lo=0,hi=1;for(let k=0;k<3;k++){const a=t.p[k],b=t.p[(k+1)%3],dx=b.x-a.x,dz=b.z-a.z,c0=cross(dx,dz,ax-a.x,az-a.z),cd=cross(dx,dz,bx-ax,bz-az);if(Math.abs(cd)<1e-18){if(c0>0)return false;}else{const r=-c0/cd;if(cd>0)hi=Math.min(hi,r);else lo=Math.max(lo,r);if(lo>hi)return false;}}return hi>=0&&lo<=1;}
export function createHollowpeakShoreOpticalAttributes({position,index,owners,heights}){
 if(!position||!index||!owners||!heights||position.length%9||index.length!==position.length/3||owners.length!==index.length||heights.length!==SIDE*SIDE)throw Error('Hollowpeak shore attribute source shape mismatch');
 const count=index.length,faceCount=count/3,canonicalLift=new Float32Array(count),outerDistance=new Float32Array(count),hemEligible=new Float32Array(count),scratch={f:new Float32Array(1)};scratch.u=new Uint32Array(scratch.f.buffer);
 const points=new Map(),edges=new Map(),faces=[],eligible=[],seen=new Uint8Array(count);
 let invalidOwners=0,maxLift=-Infinity,minLift=Infinity,maxEligibleLift=-Infinity;
 for(let f=0;f<faceCount;f++){
  const ix=owners[f*3],iz=owners[f*3+1],half=owners[f*3+2],ownerOK=Number.isInteger(ix)&&Number.isInteger(iz)&&ix>=0&&ix<512&&iz>=0&&iz<512&&(half===0||half===1),p=[],lift=[];let valid=ownerOK;
  for(let k=0;k<3;k++){
   const v=index[f*3+k];if(!Number.isInteger(v)||v<0||v>=count||seen[v])throw Error('Hollowpeak shore attributes require unshared finite vertices');seen[v]=1;
   const x=position[v*3],y=position[v*3+1],z=position[v*3+2];if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw Error('Nonfinite Hollowpeak shore position');
   const key=pointKey(x,z);let point=points.get(key);if(!point){point={x,z,key};points.set(key,point);}p.push(point);
   let h=NaN;if(ownerOK){const u=(x-(ORIGIN+ix*STEP))/STEP,w=(z-(ORIGIN+iz*STEP))/STEP;valid&&=u>=0&&u<=1&&w>=0&&w<=1&&(half?u+w>=1:u+w<=1);const n=iz*SIDE+ix,a=heights[n],b=heights[n+1],c=heights[n+SIDE],d=heights[n+SIDE+1];h=half?d+(c-d)*(1-u)+(b-d)*(1-w):a+(b-a)*u+(c-a)*w;}
   const l=y-h;lift.push(l);if(Number.isFinite(l)){minLift=Math.min(minLift,l);maxLift=Math.max(maxLift,l);canonicalLift[v]=ceilFloat32(l,scratch);}else canonicalLift[v]=1;
  }
  const area=cross(p[1].x-p[0].x,p[1].z-p[0].z,p[2].x-p[0].x,p[2].z-p[0].z);if(!(area<0))throw Error('Hollowpeak shore must have clockwise nondegenerate XZ faces');
  const max=Math.max(...lift);eligible[f]=valid&&max<=MAX_LIFT&&Math.min(...lift)>=0;if(!valid)invalidOwners++;if(eligible[f])maxEligibleLift=Math.max(maxEligibleLift,max);
  faces.push({p,minX:Math.min(...p.map(q=>q.x)),maxX:Math.max(...p.map(q=>q.x)),minZ:Math.min(...p.map(q=>q.z)),maxZ:Math.max(...p.map(q=>q.z))});
  for(let k=0;k<3;k++){const a=p[k],b=p[(k+1)%3],key=a.key<b.key?a.key+'|'+b.key:b.key+'|'+a.key,entry={a,b,face:f};if(!edges.has(key))edges.set(key,[]);edges.get(key).push(entry);}
 }
 let paired=0,nonmanifold=0;const open=[];
 for(const group of edges.values()){if(group.length===1)open.push(group[0]);else if(group.length===2&&group[0].a===group[1].b&&group[0].b===group[1].a)paired++;else nonmanifold+=group.length;}
 const outgoing=new Map();open.forEach((e,i)=>{if(!outgoing.has(e.a.key))outgoing.set(e.a.key,[]);outgoing.get(e.a.key).push(i);});
 const next=new Int32Array(open.length).fill(-1),nextCount=new Uint16Array(open.length),ambiguous=new Uint8Array(open.length);
 open.forEach((e,i)=>{const dx=e.b.x-e.a.x,dz=e.b.z-e.a.z,candidates=(outgoing.get(e.b.key)||[]).map(j=>{const q=open[j],ex=q.b.x-q.a.x,ez=q.b.z-q.a.z;return{j,angle:Math.atan2(cross(dx,dz,ex,ez),dx*ex+dz*ez)};}).sort((a,b)=>a.angle-b.angle);if(candidates.length){next[i]=candidates[0].j;nextCount[next[i]]++;if(candidates.length>1&&Math.abs(candidates[0].angle-candidates[1].angle)<1e-12)ambiguous[i]=1;}});
 const visited=new Uint8Array(open.length),outer=new Uint8Array(open.length),loopAreas=[];let openOrAmbiguous=0,holeEdges=0;
 for(let start=0;start<open.length;start++){
  if(visited[start])continue;const path=[],local=new Set();let at=start,good=true;
  while(at>=0&&!visited[at]&&!local.has(at)){path.push(at);local.add(at);if(ambiguous[at]||nextCount[at]!==1)good=false;at=next[at];}
  path.forEach(i=>visited[i]=1);good&&=at===start;
  if(!good){openOrAmbiguous+=path.length;continue;}
  const origin=open[start].a;let twiceArea=0;for(const i of path){const e=open[i];twiceArea+=cross(e.a.x-origin.x,e.a.z-origin.z,e.b.x-origin.x,e.b.z-origin.z);}const area=twiceArea/2;loopAreas.push({edges:path.length,signedArea:area});
  if(area<0)path.forEach(i=>outer[i]=1);else holeEdges+=path.length;
 }
 // Keep only actual outer segments with no near-coincident endpoints/T junction
 // and no accepted triangle immediately outside. Uncertain edges never fade.
 const boundary=[],uncertainFaces=new Set();let nearPackingOrTJunction=0,outsideCovered=0;
 for(let i=0;i<open.length;i++){
  if(!outer[i])continue;const e=open[i],dx=e.b.x-e.a.x,dz=e.b.z-e.a.z,len=Math.hypot(dx,dz);let uncertain=len<=4*EDGE_GUARD;
  if(!uncertain)for(const p of points.values()){if(p===e.a||p===e.b)continue;if(p.x<Math.min(e.a.x,e.b.x)-EDGE_GUARD||p.x>Math.max(e.a.x,e.b.x)+EDGE_GUARD||p.z<Math.min(e.a.z,e.b.z)-EDGE_GUARD||p.z>Math.max(e.a.z,e.b.z)+EDGE_GUARD)continue;if(distance(p.x,p.z,e.a,e.b)<=EDGE_GUARD){uncertain=true;break;}}
  if(uncertain){nearPackingOrTJunction++;uncertainFaces.add(e.face);continue;}
  const nx=-dz/len,nz=dx/len,ax=e.a.x+nx*EDGE_GUARD,az=e.a.z+nz*EDGE_GUARD,bx=e.b.x+nx*EDGE_GUARD,bz=e.b.z+nz*EDGE_GUARD;
  for(let f=0;f<faces.length;f++){if(f===e.face)continue;const t=faces[f];if(t.maxX<Math.min(ax,bx)||t.minX>Math.max(ax,bx)||t.maxZ<Math.min(az,bz)||t.minZ>Math.max(az,bz))continue;if(segmentMeetsTriangle(ax,az,bx,bz,t)){uncertain=true;break;}}
  if(uncertain){outsideCovered++;uncertainFaces.add(e.face);continue;}boundary.push(e);
 }
 let eligibleFaces=0,nearHemFaces=0;
 for(let f=0;f<faceCount;f++){
  const face=faces[f],canFade=eligible[f]&&!uncertainFaces.has(f)&&boundary.length>0;let chosen=null,best=Infinity;
  if(canFade){const x=(face.p[0].x+face.p[1].x+face.p[2].x)/3,z=(face.p[0].z+face.p[1].z+face.p[2].z)/3;for(const edge of boundary){const d=distance(x,z,edge.a,edge.b);if(d<best){best=d;chosen=edge;}}eligibleFaces++;if(best<FADE_WIDTH)nearHemFaces++;}
  for(let k=0;k<3;k++){const v=index[f*3+k],p=face.p[k];hemEligible[v]=canFade?1:0;outerDistance[v]=chosen?ceilFloat32(distance(p.x,p.z,chosen.a,chosen.b)+DISTANCE_GUARD,scratch):1;}
 }
 return{canonicalLift,outerDistance,hemEligible,profile:HOLLOWPEAK_SHORE_ATTRIBUTES_PROFILE,stats:{faces:faceCount,vertices:count,uniqueXZ:points.size,exactPairedInternalEdges:paired,nonmanifoldEdges:nonmanifold,unpairedEdges:open.length,closedLoops:loopAreas.length,loopAreas,openOrAmbiguousEdges:openOrAmbiguous,holeAndPackingCrackEdgesExcluded:holeEdges,outerCandidateEdges:outer.reduce((a,b)=>a+b,0),nearPackingOrTJunctionEdgesExcluded:nearPackingOrTJunction,outsideCoveredEdgesExcluded:outsideCovered,uncertainBoundaryFacesOpaque:uncertainFaces.size,acceptedOuterSegments:boundary.length,invalidOwnerFacesOpaque:invalidOwners,eligibleFaces,eligibleFacesNearHem:nearHemFaces,minActualCanonicalLift:minLift,maxActualCanonicalLift:maxLift,maxEligibleActualCanonicalLift:maxEligibleLift,eligibleLiftCeiling:MAX_LIFT,outerEdgeGuard:EDGE_GUARD,distanceRoundingGuard:DISTANCE_GUARD,maximumFadeWidth:FADE_WIDTH,geometryMutation:false}};
}
