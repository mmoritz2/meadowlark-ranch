const ease=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
// One welded rear envelope carries broad asymmetric flow and shallow wave relief.
// The continuous rounded lower cut tapers in depth instead of ending as a slab.
export function shapeLongRearMass(T,g,rearSupport){
 const join=g.userData.crownFallJoin,cap=join.capCount,W=113,B=48,total=49*W,startRow=join.joinRow+2;
 const oldCount=g.attributes.position.count,source=g.attributes.position.array.slice(),oldIndex=Array.from(g.index.array),P=Array.from(source),attrs=Object.fromEntries(Object.entries(g.attributes).filter(([n])=>n!=='position').map(([n,a])=>[n,Array.from(a.array)])),changed=new Set(),extra=[],masses=[],grids=[];
 const V=()=>new T.Vector3(),get=(side,r,c)=>V().fromArray(source,(cap+side*total+r*W+c)*3);
 const sample=(side,row,col)=>{row=Math.max(0,Math.min(B,row));col=Math.max(0,Math.min(W-1,col));const r=Math.min(B-1,Math.floor(row)),c=Math.min(W-2,Math.floor(col)),fy=row-r,fx=col-c;return get(side,r,c).lerp(get(side,r,c+1),fx).lerp(get(side,r+1,c).lerp(get(side,r+1,c+1),fx),fy);};
 const center=(r,c)=>sample(0,r,c).add(sample(1,r,c)).multiplyScalar(.5);
 const sourceIds=new Map(),append=(id,chart=false)=>{const q=P.length/3;P.push(...(chart?P.slice(id*3,id*3+3):source.subarray(id*3,id*3+3)));for(const[n,a]of Object.entries(g.attributes))if(n!=='position')attrs[n].push(...(chart?attrs[n].slice(id*a.itemSize,(id+1)*a.itemSize):a.array.subarray(id*a.itemSize,(id+1)*a.itemSize)));const original=sourceIds.get(id)??id;sourceIds.set(q,original);extra.push({id:q,source:original,copyFrom:id,chart});return q;};
 const ownership=(row,col)=>{row=Math.max(0,Math.min(B,row));col=Math.max(0,Math.min(W-1,col));const r=Math.min(B-1,Math.floor(row)),c=Math.min(W-2,Math.floor(col)),fy=row-r,fx=col-c,m=new Map();for(const[rr,cc,w]of[[r,c,(1-fy)*(1-fx)],[r,c+1,(1-fy)*fx],[r+1,c,fy*(1-fx)],[r+1,c+1,fy*fx]])for(let k=0;k<4;k++){const at=(cap+rr*W+cc)*4+k,bone=g.attributes.skinIndex.array[at],value=g.attributes.skinWeight.array[at]*w;if(value)m.set(bone,(m.get(bone)||0)+value);}const ranked=[...m].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=ranked.reduce((s,x)=>s+x[1],0);while(ranked.length<4)ranked.push([0,0]);return ranked.map(([id,w])=>[id,w/sum]);};
 const atHeight=(y,col)=>{let r=startRow;while(r<B-1&&center(r+1,col).y>y)r++;const a=center(r,col).y,b=center(r+1,col).y;return r+Math.max(0,Math.min(1,(a-y)/Math.max(1e-8,a-b)));};
 {
  const a=0,b=112,grid=[[],[]];
  for(let side=0;side<2;side++)for(let r=startRow;r<=B;r++){
   const t=(r-startRow)/(B-startRow),free=ease(0,.18,t),gather=ease(.56,1,t),rowIds=[];
   for(let c=a;c<=b;c++){
    const id=cap+side*total+r*W+c,u=c/112,local=2*u-1,col=c,base=center(r,col),root=center(startRow,c),outer=sample(side,r,col);
    // A continuous unequal arc, with small subordinate lobes, has no central
    // patch edge. Its shortest side turns upward into the gathered silhouette.
    const end=-.444+.050*local*local+.022*local+.004*Math.sin(local*11+.6)+.002*Math.sin(local*6-1.1),
      y=root.y+(end-root.y)*t,desiredY=base.y+(y-base.y)*free,anatomicalRow=atHeight(desiredY,col),at=center(anatomicalRow,col),
      flow=.016*(Math.sin(t*6.0-.45)-Math.sin(-.45))*free,
      width=1+.05*Math.sin(Math.PI*t)-.32*gather,
      x=at.x*width+flow,
      broadWave=.006*(1+Math.sin(t*6.0+local*.7-.4)),
      grooves=.0018*Math.sin(local*9.5+.8*Math.sin(t*5.7-.6)),
      round=.45+.55*Math.sqrt(Math.max(.08,1-.92*local*local)),
      depth=(.008-.0076*ease(.80,1,t))*round;
    const desired=V().set(x,desiredY,at.z-(.004+broadWave+grooves)*free+(side?1:-1)*depth*.5),q=outer.lerp(desired,free);
    if(r===startRow)q.copy(get(side,r,c));
    P[id*3]=q.x;P[id*3+1]=q.y;P[id*3+2]=q.z;rowIds.push(id);
    if(r>startRow){changed.add(id);const weights=ownership(anatomicalRow,col);for(let j=0;j<4;j++){attrs.skinIndex[id*4+j]=weights[j][0];attrs.skinWeight[id*4+j]=weights[j][1];}}
   }
   grid[side].push(rowIds);
  }
  // A coherent row offset retains the authored shallow grooves while fitting
  // its new footprint against actual clothing; there is no runtime solver.
  let maxFit=0;for(let r=1;r<=B-startRow;r++){let correction=0;for(const side of[0,1])for(const id of grid[side][r]){const p=V().fromArray(P,id*3),hit=rearSupport(p);if(hit)correction=Math.max(correction,p.z-hit.z+.018);}correction=Math.max(0,correction);maxFit=Math.max(maxFit,correction);if(correction)for(const side of[0,1])for(const id of grid[side][r])P[id*3+2]-=correction;}
  grids.push(grid);masses.push({sourceSector:[a,b],rootRow:startRow,continuousEnvelope:true,tipWidthScale:.68,tipDepthM:.0004,endArc:{baseY:-.444,quadraticM:.050,tiltM:.022,smallLobesM:[.004,.002]},maxFitM:maxFit});
 }
 const index=[];let removedTriangles=0;for(let i=0;i<oldIndex.length;i+=3){const tri=oldIndex.slice(i,i+3),fall=tri.every(id=>id>=cap&&id<cap+2*total),rows=fall?tri.map(id=>Math.floor((id-cap)%total/W)):[];if(fall&&Math.min(...rows)>=startRow){removedTriangles++;continue;}index.push(...tri);}
 for(const grid of grids){const rows=grid[0].length,cols=grid[0][0].length;
  for(const side of[0,1])for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=grid[side][r][c],b=grid[side][r][c+1],d=grid[side][r+1][c],e=grid[side][r+1][c+1];side?index.push(a,b,d,b,e,d):index.push(a,d,b,b,d,e);}
  for(const c of[0,cols-1]){const wall=Array.from({length:rows},(_,r)=>[0,1].map(side=>{const id=append(grid[side][r][c],true);attrs.uv[id*2]+=(side?1:-1)*.05;return id;}));for(let r=0;r<rows-1;r++){const[a,d]=wall[r],[b,e]=wall[r+1];c===0?index.push(a,d,b,b,d,e):index.push(a,b,d,b,e,d);}}
  const bottom=[0,1].map(side=>grid[side].at(-1).map(old=>{const id=append(old,true);attrs.uv[id*2+1]+=(side?1:-1)*.04;return id;}));for(let c=0;c<cols-1;c++){const a=bottom[0][c],b=bottom[0][c+1],d=bottom[1][c],e=bottom[1][c+1];index.push(a,d,b,b,d,e);}
 }
 const groups=g.groups.slice();if(groups.length>1)throw Error('Rear mass requires one hair material');g.setAttribute('position',new T.Float32BufferAttribute(P,3));for(const[n,a]of Object.entries(g.attributes))if(n!=='position')g.setAttribute(n,new T.BufferAttribute(new a.array.constructor(attrs[n]),a.itemSize,a.normalized));g.setIndex(index);g.clearGroups();if(groups.length)g.addGroup(0,index.length,groups[0].materialIndex);
 const oldNormals=g.attributes.normal.array.slice(),oldTangents=g.attributes.tangent?.array.slice();g.computeVertexNormals();const normalGroups=new Map();for(const q of extra)if(q.chart){if(!normalGroups.has(q.copyFrom))normalGroups.set(q.copyFrom,[q.copyFrom]);normalGroups.get(q.copyFrom).push(q.id);}for(const ids of normalGroups.values()){const n=ids.map(i=>V().fromBufferAttribute(g.attributes.normal,i)).reduce((a,b)=>a.add(b),V()).normalize();for(const id of ids)g.attributes.normal.setXYZ(id,n.x,n.y,n.z);}if(g.attributes.tangent)g.computeTangents();
 for(let i=0;i<oldCount;i++)if(!changed.has(i)){g.attributes.normal.array.set(oldNormals.subarray(i*3,i*3+3),i*3);if(oldTangents)g.attributes.tangent.array.set(oldTangents.subarray(i*4,i*4+4),i*4);}
 for(const q of extra)if(Math.floor((q.source-cap)%total/W)===startRow){g.attributes.normal.array.set(oldNormals.subarray(q.source*3,q.source*3+3),q.id*3);if(oldTangents)g.attributes.tangent.array.set(oldTangents.subarray(q.source*4,q.source*4+4),q.id*4);}
 g.computeBoundingSphere();if(g.boundingBox)g.computeBoundingBox();g.userData.longRearMass={version:2,method:'One continuous broad gathered envelope, shallow traveling wave relief, asymmetric rounded lower cut with small lobes and tapered edge depth; exact cap/bridge/attachment and front73',sourceVertexCount:oldCount,addedVertices:extra.length,duplicateSources:extra,startRow,masses,removedTriangles,originalGridIdsRetained:true};return g;
}
