/* Exact static triangle indexing for Head-local hair roots and bind-space fitting.
   Input geometry is copied once; animated bones never mutate the indexed surface. */
export function createTriangleSurface(THREE,geometry){
 const started=performance.now(),position=geometry.attributes.position,index=geometry.index,draw=geometry.drawRange||{start:0,count:Infinity};
 const available=index?index.count:(position?.count||0),first=Math.max(0,draw.start||0),end=Math.min(available,first+(draw.count??Infinity)),count=Math.max(0,Math.floor((end-first)/3));
 let vertices=new Float64Array(count*9),normals=new Float64Array(count*3),corners=new Uint32Array(count*3),bounds=new Float64Array(count*6),centroids=new Float64Array(count*3),order=new Uint32Array(count),nodes=[];
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),hit=new THREE.Vector3(),ray=new THREE.Ray();
 for(let triangle=0;triangle<count;triangle++){
  const offset=first+triangle*3,points=[a,b,c];
  for(let k=0;k<3;k++){const id=index?index.getX(offset+k):offset+k;corners[triangle*3+k]=id;points[k].fromBufferAttribute(position,id).toArray(vertices,triangle*9+k*3);}
  THREE.Triangle.getNormal(a,b,c,normal).toArray(normals,triangle*3);
  for(let axis=0;axis<3;axis++){const x=vertices[triangle*9+axis],y=vertices[triangle*9+3+axis],z=vertices[triangle*9+6+axis];bounds[triangle*6+axis]=Math.min(x,y,z);bounds[triangle*6+3+axis]=Math.max(x,y,z);centroids[triangle*3+axis]=(x+y+z)/3;}
  order[triangle]=triangle;
 }
 let leaves=0;
 function build(start,finish){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],clo=[Infinity,Infinity,Infinity],chi=[-Infinity,-Infinity,-Infinity];
  for(let i=start;i<finish;i++){const t=order[i];for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],bounds[t*6+axis]);hi[axis]=Math.max(hi[axis],bounds[t*6+3+axis]);clo[axis]=Math.min(clo[axis],centroids[t*3+axis]);chi[axis]=Math.max(chi[axis],centroids[t*3+axis]);}}
  const id=nodes.length,node={lo,hi,start,finish,left:-1,right:-1};nodes.push(node);if(finish-start<=8){leaves++;return id;}
  const spans=chi.map((v,k)=>v-clo[k]),axis=spans.indexOf(Math.max(...spans));order.subarray(start,finish).sort((x,y)=>centroids[x*3+axis]-centroids[y*3+axis]||x-y);
  const middle=(start+finish)>>>1;node.left=build(start,middle);node.right=build(middle,finish);return id;
 }
 if(count)build(0,count);bounds=null;centroids=null;let stack=new Int32Array(nodes.length),disposed=false;
 const metrics={triangleCount:count,nodeCount:nodes.length,leafCount:leaves,buildMs:performance.now()-started,queries:0,hits:0,misses:0,trianglesTested:0,nodesVisited:0};
 function entry(node,limit){
  let near=0,far=limit+1e-12;for(let axis=0;axis<3;axis++){const origin=ray.origin.getComponent(axis),d=ray.direction.getComponent(axis),lo=node.lo[axis]-1e-12,hi=node.hi[axis]+1e-12;if(d===0){if(origin<lo||origin>hi)return Infinity;continue;}let one=(lo-origin)/d,two=(hi-origin)/d;if(one>two){const swap=one;one=two;two=swap;}near=Math.max(near,one);far=Math.min(far,two);if(near>far)return Infinity;}return near;
 }
 function result(triangle,point,distance){
  const offset=triangle*3,n=new THREE.Vector3().fromArray(normals,offset);
  return {point:point.clone(),normal:n,distance,faceIndex:Math.floor(first/3)+triangle,face:{a:corners[offset],b:corners[offset+1],c:corners[offset+2],normal:n}};
 }
 function cast(origin,direction,accept=null,limit=Infinity){
  metrics.queries++;ray.origin.copy(origin);ray.direction.copy(direction).normalize();
  if(disposed||!count||ray.direction.lengthSq()===0||!Number.isFinite(ray.direction.lengthSq())){metrics.misses++;return null;}
  let size=0,best=limit,bestTriangle=-1,bestHit=null;stack[size++]=0;
  while(size){const node=nodes[stack[--size]];metrics.nodesVisited++;if(entry(node,best)===Infinity)continue;
   if(node.left>=0){const left=entry(nodes[node.left],best),right=entry(nodes[node.right],best);if(left<right){if(right!==Infinity)stack[size++]=node.right;if(left!==Infinity)stack[size++]=node.left;}else{if(left!==Infinity)stack[size++]=node.left;if(right!==Infinity)stack[size++]=node.right;}continue;}
   for(let i=node.start;i<node.finish;i++){const triangle=order[i],offset=triangle*9;metrics.trianglesTested++;a.fromArray(vertices,offset);b.fromArray(vertices,offset+3);c.fromArray(vertices,offset+6);if(!ray.intersectTriangle(a,b,c,false,hit))continue;const distance=ray.origin.distanceTo(hit);
    if(distance>best||(distance===best&&bestTriangle>=0&&triangle>=bestTriangle))continue;
    const candidate=accept?result(triangle,hit,distance):null;if(accept&&!accept(candidate))continue;best=distance;bestTriangle=triangle;bestHit=candidate||result(triangle,hit,distance);
   }
  }
  if(bestTriangle<0){metrics.misses++;return null;}metrics.hits++;return bestHit;
 }
 function dispose(){disposed=true;vertices=null;normals=null;corners=null;order=null;nodes=[];stack=null;}
 return {cast,metrics,dispose};
}

/* Match a DoubleSide Mesh Raycaster from the measured skull center, including
   face-normal lift and the original target fallback when the neck opening misses. */
export function createHeadSurface(THREE,geometry,centerVector){
 const surface=createTriangleSurface(THREE,geometry),center=centerVector.clone(),direction=new THREE.Vector3();
 return {sample(target,lift=.002){direction.copy(target).sub(center).normalize();const hit=surface.cast(center,direction);return hit?hit.point.addScaledVector(hit.normal,lift):target.clone();},metrics:surface.metrics,dispose:surface.dispose};
}
