// A turned hem follows the literal shell surface before its thin facing is added.
export function finishCoatHem(T, garment, data, color) {
  const g=garment.geometry,a=g.attributes,ids=data.boundaryLoops.find(l=>l.label==='hem').ids;
  const boundary=new Set(ids),neighbors=new Map(ids.map(i=>[i,new Set()])),faces=new Map(ids.map(i=>[i,[]]));
  for(let k=0;k<g.index.count;k+=3){
    const corners=[0,1,2].map(j=>g.index.getX(k+j));
    for(const i of corners)if(boundary.has(i)){
      faces.get(i).push({faceIndex:k/3,ids:corners});
      for(const j of corners)if(!boundary.has(j))neighbors.get(i).add(j);
    }
  }
  const V=()=>new T.Vector3(),get=['getX','getY','getZ','getW'];
  const roots=ids.map(i=>{
    const p=V().fromBufferAttribute(a.position,i),n=V().fromBufferAttribute(a.normal,i).normalize(),inward=V();
    for(const j of neighbors.get(i))inward.add(V().fromBufferAttribute(a.position,j).sub(p));
    inward.addScaledVector(n,-inward.dot(n));
    if(inward.lengthSq()<1e-12)inward.set(0,1,0);else inward.normalize();
    return {i,p,n,inward};
  });
  // Some authored front cutaway roots belong to a folded inward-facing strip.
  // Sample their visible front support instead of lifting inward from that fold.
  const frontFaces=[];
  for(let k=0;k<g.index.count;k+=3){
    const ids=[0,1,2].map(j=>g.index.getX(k+j)),triangle=new T.Triangle(...ids.map(i=>V().fromBufferAttribute(a.position,i))),normal=triangle.getNormal(V());
    if(normal.z>.01)frontFaces.push({faceIndex:k/3,ids,triangle,normal});
  }
  const position=[],joints=[],weights=[],uv=[],index=[],bindings=[];
  const profile=[[.006,.0022],[.001,.0024],[-.00045,.0015],[0,-.0013],[.006,-.0013]];
  const sample=(root,rise)=>{
    const wanted=root.p.clone().addScaledVector(root.inward,Math.max(0,rise));let best=null;
    const exteriorFront=root.p.z>0&&root.n.z<0;
    for(const face of exteriorFront?frontFaces:faces.get(root.i)){
      const triangle=face.triangle||new T.Triangle(...face.ids.map(i=>V().fromBufferAttribute(a.position,i))),point=triangle.closestPointToPoint(wanted,V()),distance=point.distanceToSquared(wanted);
      if(best&&distance>=best.distance)continue;
      best={...face,point,distance,bary:triangle.getBarycoord(point,V()).toArray()};
    }
    if(!best)throw Error('Coat hem root has no supporting shell face');
    const normal=V(),mixed=new Map();
    for(let k=0;k<3;k++){
      const id=best.ids[k],w=best.bary[k];normal.addScaledVector(V().fromBufferAttribute(a.normal,id),w);
      for(const component of get){const j=a.skinIndex[component](id);mixed.set(j,(mixed.get(j)||0)+a.skinWeight[component](id)*w);}
    }
    if(exteriorFront)normal.copy(best.normal);else normal.normalize();const ranked=[...mixed].filter(([,w])=>w>0).sort((x,y)=>y[1]-x[1]||x[0]-y[0]).slice(0,4),sum=ranked.reduce((n,[,w])=>n+w,0);
    while(ranked.length<4)ranked.push([0,0]);
    return {point:best.point,normal,joints:ranked.map(v=>v[0]),weights:ranked.map(v=>v[1]/sum),binding:{faceIndex:best.faceIndex,ids:best.ids,bary:best.bary}};
  };
  for(let r=0;r<profile.length;r++)for(let c=0;c<roots.length;c++){
    const root=roots[c],[rise,depth]=profile[r],h=sample(root,rise),q=h.point.clone().addScaledVector(h.normal,depth);
    if(rise<0)q.addScaledVector(root.inward,rise);
    position.push(...q.toArray());uv.push(c/roots.length,r/(profile.length-1));joints.push(...h.joints);weights.push(...h.weights);bindings.push(h.binding);
  }
  for(let r=0;r<profile.length-1;r++)for(let c=0;c<roots.length;c++){
    const i=r*roots.length+c,j=r*roots.length+(c+1)%roots.length,k=i+roots.length,l=j+roots.length;
    index.push(i,k,j,j,k,l);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData.sourceHemVertex=profile.flatMap(()=>ids);geometry.userData.coatSurfaceBindings=bindings;
  const material=new T.MeshStandardMaterial({color:new T.Color(color).multiplyScalar(.95),roughness:.84,side:T.DoubleSide});
  return {name:'Coat_Turned_Hem',geometry,material,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix};
}
