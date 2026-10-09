// A narrow turned edge gives the cutaway a closed cloth cross-section.
export function finishCoatHem(T, garment, data, color) {
  const g=garment.geometry,a=g.attributes,ids=data.boundaryLoops.find(l=>l.label==='hem').ids;
  const boundary=new Set(ids),neighbors=new Map(ids.map(i=>[i,new Set()]));
  for(let k=0;k<g.index.count;k+=3){
    const tri=[0,1,2].map(j=>g.index.getX(k+j));
    for(const i of tri)if(boundary.has(i))for(const j of tri)if(!boundary.has(j))neighbors.get(i).add(j);
  }
  const V=()=>new T.Vector3(),get=['getX','getY','getZ','getW'];
  const roots=ids.map(i=>{
    const p=V().fromBufferAttribute(a.position,i),n=V().fromBufferAttribute(a.normal,i).normalize(),inward=V();
    for(const j of neighbors.get(i))inward.add(V().fromBufferAttribute(a.position,j).sub(p));
    inward.addScaledVector(n,-inward.dot(n));
    if(inward.lengthSq()<1e-12)inward.set(0,1,0);else inward.normalize();
    return {i,p,n,inward};
  });
  const position=[],joints=[],weights=[],uv=[],index=[];
  const profile=[[.006,.00045],[.001,.00065],[-.00045,.00015],[0,-.0013],[.006,-.0013]];
  for(let r=0;r<profile.length;r++)for(let c=0;c<roots.length;c++){
    const {i,p,n,inward}=roots[c],[rise,depth]=profile[r],q=p.clone().addScaledVector(inward,rise).addScaledVector(n,depth);
    position.push(...q.toArray());uv.push(c/roots.length,r/(profile.length-1));
    joints.push(...get.map(k=>a.skinIndex[k](i)));weights.push(...get.map(k=>a.skinWeight[k](i)));
  }
  for(let r=0;r<profile.length-1;r++)for(let c=0;c<roots.length;c++){
    const i=r*roots.length+c,j=r*roots.length+(c+1)%roots.length,k=i+roots.length,l=j+roots.length;
    index.push(i,k,j,j,k,l);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData.sourceHemVertex=profile.flatMap(()=>ids);
  const material=new T.MeshStandardMaterial({color:new T.Color(color).multiplyScalar(.95),roughness:.84,side:T.DoubleSide});
  return {name:'Coat_Turned_Hem',geometry,material,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix};
}
