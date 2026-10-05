/* Fit attachments to bind-space surfaces, retaining the same interpolated joint
   weights as the surface underneath. Used by clothing edges and neck jewelry. */
export function surfaceSampler(THREE,meshes){
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),bins=new Map(),probes=[],owned=[];
 // Horizontal necklace rays only need triangles in their height band. Sharing
 // attributes keeps this index lightweight and avoids rescanning the whole body.
 for(const source of meshes){
  const geometry=source.geometry,p=geometry.attributes.position,idx=geometry.index,lists=new Map();
  for(let i=0;i<(idx?idx.count:p.count);i+=3){const tri=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),ys=tri.map(j=>p.getY(j));
   for(let bin=Math.floor(Math.min(...ys)/.025);bin<=Math.floor(Math.max(...ys)/.025);bin++){if(!lists.has(bin))lists.set(bin,[]);lists.get(bin).push(...tri);}
  }
  for(const [bin,indices]of lists){const geo=new THREE.BufferGeometry();for(const [key,attribute]of Object.entries(geometry.attributes))geo.setAttribute(key,attribute);geo.setIndex(indices);
   const probe=new THREE.Mesh(geo,material);probe.userData.source=source;probe.updateMatrixWorld(true);owned.push(geo);probes.push(probe);if(!bins.has(bin))bins.set(bin,[]);bins.get(bin).push(probe);
  }
 }
 const ray=new THREE.Raycaster(),bary=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const sample=(hit)=>{
  const source=hit.object.userData.source,g=source.geometry,face=hit.face,p=g.attributes.position;
  a.fromBufferAttribute(p,face.a);b.fromBufferAttribute(p,face.b);c.fromBufferAttribute(p,face.c);THREE.Triangle.getBarycoord(hit.point,a,b,c,bary);
  const entries=new Map(),si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  if(si&&sw)for(const [i,t]of [[face.a,bary.x],[face.b,bary.y],[face.c,bary.z]])for(let k=0;k<4;k++){
   const j=si[['getX','getY','getZ','getW'][k]](i),w=sw[['getX','getY','getZ','getW'][k]](i)*t;entries.set(j,(entries.get(j)||0)+w);
  }
  const ranked=[...entries].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((s,v)=>s+v[1],0)||1;
  while(ranked.length<4)ranked.push([0,0]);
  return {point:hit.point.clone(),normal:face.normal.clone(),joints:ranked.map(v=>v[0]),weights:ranked.map(v=>v[1]/sum),source};
 };
 return {
  cast(origin,direction,accept=()=>true){ray.set(origin,direction);for(const hit of ray.intersectObjects(Math.abs(direction.y)<1e-8?(bins.get(Math.floor(origin.y/.025))||[]):probes,false)){if(accept(hit.point,hit.object.userData.source))return sample(hit);}return null;},
  dispose(){material.dispose();owned.forEach(g=>g.dispose());}
 };
}

/* Clip triangles at a garment edge instead of drawing a complete body and
   cutting its silhouette in a fragment shader. Skin weights survive new vertices. */
export function trimGarment(THREE,source,fields){
 const p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv,si=source.attributes.skinIndex,sw=source.attributes.skinWeight,index=source.index;
 const vertex=i=>({p:[p.getX(i),p.getY(i),p.getZ(i)],n:[n.getX(i),n.getY(i),n.getZ(i)],uv:[uv.getX(i),uv.getY(i)],weights:(()=>{const w=new Map();for(let k=0;k<4;k++){const j=si[['getX','getY','getZ','getW'][k]](i);w.set(j,(w.get(j)||0)+sw[['getX','getY','getZ','getW'][k]](i));}return w;})()});
 const mix=(a,b,t)=>{const weights=new Map();for(const [j,w]of a.weights)weights.set(j,w*(1-t));for(const [j,w]of b.weights)weights.set(j,(weights.get(j)||0)+w*t);return {p:a.p.map((v,i)=>v+(b.p[i]-v)*t),n:a.n.map((v,i)=>v+(b.n[i]-v)*t),uv:a.uv.map((v,i)=>v+(b.uv[i]-v)*t),weights};};
 const P=[],N=[],U=[],J=[],W=[];
 const push=v=>{P.push(...v.p);N.push(...v.n);U.push(...v.uv);const ranked=[...v.weights].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((s,v)=>s+v[1],0)||1;while(ranked.length<4)ranked.push([0,0]);J.push(...ranked.map(v=>v[0]));W.push(...ranked.map(v=>v[1]/sum));};
 for(let i=0;i<(index?index.count:p.count);i+=3){let poly=[0,1,2].map(k=>vertex(index?index.getX(i+k):i+k));
  for(const field of fields){const next=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],fa=field(...a.p),fb=field(...b.p);if(fa>=0)next.push(a);if((fa>=0)!==(fb>=0))next.push(mix(a,b,fa/(fa-fb)));}poly=next;if(!poly.length)break;}
  for(let k=1;k<poly.length-1;k++){push(poly[0]);push(poly[k]);push(poly[k+1]);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4));geo.setIndex(Array.from({length:P.length/3},(_,i)=>i));geo.computeBoundingSphere();return geo;
}
