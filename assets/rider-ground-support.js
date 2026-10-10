/* Exact support of skinned geometry. Points with identical decoded skin tuples
   share an affine map; only their rest convex-hull boundary can be extremal.
   Degenerate or uncertified hulls retain every point. No geometry is changed. */
function hullBoundary(points) {
 const n=points.length, eps=1e-12;
 if(n<12)return {points,reason:'small'};
 const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 let a=0,b=0,c=0,d=0,far=0;
 for(let i=1;i<n;i++)if(points[i][0]<points[a][0])a=i;
 for(let i=0;i<n;i++){const v=sub(points[i],points[a]),q=dot(v,v);if(q>far){far=q;b=i;}}
 if(far<eps*eps)return {points,reason:'rank0'};
 const ab=sub(points[b],points[a]);far=0;
 for(let i=0;i<n;i++){const v=cross(ab,sub(points[i],points[a])),q=dot(v,v);if(q>far){far=q;c=i;}}
 if(far<eps*eps*dot(ab,ab))return {points,reason:'rank1'};
 const normal=cross(ab,sub(points[c],points[a])),length=Math.sqrt(dot(normal,normal));far=0;
 for(let i=0;i<n;i++){const q=Math.abs(dot(normal,sub(points[i],points[a])))/length;if(q>far){far=q;d=i;}}
 if(far<eps)return {points,reason:'rank2'};
 const center=[0,1,2].map(k=>(points[a][k]+points[b][k]+points[c][k]+points[d][k])/4);
 const face=(i,j,k)=>{let v=cross(sub(points[j],points[i]),sub(points[k],points[i])),l=Math.sqrt(dot(v,v));if(l<1e-24)return null;v=v.map(x=>x/l);if(dot(v,sub(center,points[i]))>0){[j,k]=[k,j];v=v.map(x=>-x);}return {ids:[i,j,k],v,t:dot(v,points[i])};};
 let faces=[[a,b,c],[a,d,b],[a,c,d],[b,d,c]].map(f=>face(...f));
 for(let i=0;i<n;i++){
  const visible=faces.filter(f=>dot(f.v,points[i])-f.t>eps);if(!visible.length)continue;
  const edges=new Map();for(const f of visible)for(let k=0;k<3;k++){const x=f.ids[k],y=f.ids[(k+1)%3],reverse=y+','+x;if(edges.has(reverse))edges.delete(reverse);else edges.set(x+','+y,[x,y]);}
  const removed=new Set(visible);faces=faces.filter(f=>!removed.has(f));
  for(const [x,y]of edges.values()){const f=face(x,y,i);if(!f)return {points,reason:'degenerate-face'};faces.push(f);}
 }
 // The candidate must form a closed oriented surface and contain every input.
 const edges=new Map();for(const f of faces)for(let k=0;k<3;k++){const x=f.ids[k],y=f.ids[(k+1)%3],key=Math.min(x,y)+','+Math.max(x,y),v=edges.get(key)||[0,0];v[0]++;v[1]+=x<y?1:-1;edges.set(key,v);}
 if([...edges.values()].some(v=>v[0]!==2||v[1]!==0))return {points,reason:'open-hull'};
 const retained=new Set(faces.flatMap(f=>f.ids));
 for(let i=0;i<n;i++)for(const f of faces){const distance=dot(f.v,points[i])-f.t;if(distance>eps)return {points,reason:'outside-hull'};if(distance>=-eps)retained.add(i);}
 return {points:points.filter((_,i)=>retained.has(i)),reason:'hull',faces:faces.map(f=>f.ids.map(i=>points[i][3]))};
}
export function createGroundSupport(THREE) {
 const cache=new WeakMap(), point=new THREE.Vector3(), composite=new THREE.Matrix4(), boneMatrix=new THREE.Matrix4();
 const affine=m=>{const e=m.elements;return e[3]===0&&e[7]===0&&e[11]===0&&Number.isFinite(e[15])&&e[15]!==0;};
 const stamp=g=>[g.index,g.attributes.position,g.attributes.skinIndex,g.attributes.skinWeight].flatMap(a=>[a,a?.version,a?.data,a?.data?.version]);
 function prepare(mesh){
  const g=mesh.geometry,s=stamp(g);let state=cache.get(g);if(state&&s.every((x,i)=>x===state.stamp[i]))return state;
  const p=g.attributes.position,ix=g.attributes.skinIndex,w=g.attributes.skinWeight;
  const used=g.index?[...new Set(g.index.array)]:Array.from({length:p.count},(_,i)=>i),map=new Map();
  if(!ix||!w){state={stamp:s,used,groups:null};cache.set(g,state);return state;}
  for(const i of used){const indices=[ix.getX(i),ix.getY(i),ix.getZ(i),ix.getW(i)],weights=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)],key=indices.join(',')+';'+weights.join(',');let group=map.get(key);if(!group){group={indices,weights,points:[],unique:new Set()};map.set(key,group);}const v=[p.getX(i),p.getY(i),p.getZ(i),i],position=v.slice(0,3).join(',');if(!group.unique.has(position)){group.unique.add(position);group.points.push(v);}}
  const groups=[...map.values()],boneIds=new Set();
  for(const group of groups){const h=hullBoundary(group.points);group.allIds=group.points.map(v=>v[3]);group.points=h.points;group.reason=h.reason;group.faces=h.faces;delete group.unique;for(let i=0;i<4;i++)if(group.weights[i]!==0)boneIds.add(group.indices[i]);}
  state={stamp:s,used,groups,boneIds:[...boneIds],boneRows:new Map([...boneIds].map(i=>[i,new Float64Array(4)]))};cache.set(g,state);return state;
 }
 function fallback(mesh,toFloor,state){let low=Infinity;for(const i of state.used){mesh.getVertexPosition(i,point).applyMatrix4(toFloor);low=Math.min(low,point.y);}return low;}
 function minimum(mesh,toFloor){
  const state=prepare(mesh);
  // Morph offsets may change hull membership, so their native result stays exact.
  if(!state.groups||mesh.morphTargetInfluences?.some(x=>x!==0)||!affine(mesh.bindMatrix)||!affine(mesh.bindMatrixInverse)||!affine(toFloor))return fallback(mesh,toFloor,state);
  composite.multiplyMatrices(toFloor,mesh.bindMatrixInverse);const c=composite.elements,b=mesh.bindMatrix.elements;
  const cy0=c[1]/c[15],cy1=c[5]/c[15],cy2=c[9]/c[15],cy3=c[13]/c[15];
  // A constant non-unit homogeneous coordinate is still affine. Native
  // Vector3.applyMatrix4 divides by it at each stage; preserve those divisions.
  for(const id of state.boneIds){
   boneMatrix.multiplyMatrices(mesh.skeleton.bones[id].matrixWorld,mesh.skeleton.boneInverses[id]);if(!affine(boneMatrix))return fallback(mesh,toFloor,state);
   const m=boneMatrix.elements,r=state.boneRows.get(id),x=(cy0*m[0]+cy1*m[1]+cy2*m[2])/m[15],y=(cy0*m[4]+cy1*m[5]+cy2*m[6])/m[15],z=(cy0*m[8]+cy1*m[9]+cy2*m[10])/m[15],t=(cy0*m[12]+cy1*m[13]+cy2*m[14])/m[15];
   r[0]=(x*b[0]+y*b[1]+z*b[2])/b[15];r[1]=(x*b[4]+y*b[5]+z*b[6])/b[15];r[2]=(x*b[8]+y*b[9]+z*b[10])/b[15];r[3]=t+(x*b[12]+y*b[13]+z*b[14])/b[15];
  }
  let low=Infinity;
  for(const group of state.groups){let px=0,py=0,pz=0,pt=cy3;
   for(let i=0;i<4;i++){const w=group.weights[i];if(w===0)continue;const p=state.boneRows.get(group.indices[i]);px+=w*p[0];py+=w*p[1];pz+=w*p[2];pt+=w*p[3];}
   for(const v of group.points)low=Math.min(low,px*v[0]+py*v[1]+pz*v[2]+pt);
  }
  return low;
 }
 function describe(mesh){const s=prepare(mesh);return {used:s.used,selected:s.groups?s.groups.flatMap(g=>g.points.map(v=>v[3])):s.used,groups:s.groups?.map(g=>({indices:g.indices,weights:g.weights,allIds:g.allIds,selected:g.points.map(v=>v[3]),reason:g.reason,faces:g.faces}))};}
 return {minimum,describe,prepare:mesh=>{prepare(mesh);}};
}
