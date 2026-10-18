// Original open estate gateway. Mounted as visual batches on the retained gate owner.
export function buildArrivalGateway({THREE:T,architecture}){
 const previous=Math.random;let seed=0x4d4c4741;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{
  const group=new T.Group();group.name='Meadowlark open estate gateway';const bins=new Map(),owned=[];
  function material(name,color,source,roughness=.92){const options={color,roughness,normalScale:new T.Vector2(.24,.24),envMapIntensity:.55};if(source?.map)options.map=source.map;if(source?.normalMap)options.normalMap=source.normalMap;const m=new T.MeshStandardMaterial(options);m.name='Arrival gateway | '+name;owned.push(m);return m;}
  const source=n=>architecture.materials.get(n),stone=material('limestone piers','#cbc3aa',source('Ranch | foundation stone')),paint=material('ivory painted frame','#ddd8bd',null),oak=material('warm oak crossbeam','#ac9276',source('Ranch | oiled oak doors')),iron=material('forged straps','#333d36',null,.7);
  function box(w,h,d,m,x,y,z,rz=0){const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,mat=new T.Matrix4().makeRotationZ(rz);mat.setPosition(x,y,z);for(let i=0;i<p.count;i++)u.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/1.8,p.getY(i)/1.8);g.applyMatrix4(mat);let b=bins.get(m);if(!b){b={p:[],n:[],u:[],i:[]};bins.set(m,b);}const offset=b.p.length/3;b.p.push(...p.array);b.n.push(...n.array);b.u.push(...u.array);for(const i of g.index.array)b.i.push(offset+i);g.dispose();}
  for(const x of[-3,3]){
   box(.52,.08,.52,stone,x,.04,0);for(let r=0;r<3;r++)box(.46,.185,.46,stone,x,.1725+r*.19,0);box(.56,.10,.56,stone,x,.705,0);
   box(.24,2.91,.24,paint,x,2.18,0);box(.31,.12,.31,paint,x,3.69,0);box(.31,.10,.31,oak,x,.84,0);
   const sx=-Math.sign(x),dx=.55,dy=.47;box(.095,Math.hypot(dx,dy),.13,oak,x+sx*dx/2,3.34,0,-sx*Math.atan2(dx,dy));
   for(const z of[-.132,.132])for(const y of[.86,1.04,3.52])box(.075,.052,.018,iron,x,y,z);
  }
  box(6.48,.19,.22,oak,0,3.655,0);box(6.56,.045,.28,paint,0,3.772,0);
  for(const x of[-2.18,2.18])box(.044,.34,.045,iron,x,3.98,0);
  for(const[m,b]of bins){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setIndex(b.i);g.computeBoundingBox();g.computeBoundingSphere();const mesh=new T.Mesh(g,m);mesh.name=m.name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
  group.userData.arrivalGateway={profile:'open-estate-gateway-1',clearWidth:5.5,clearHeight:3.55,oldCollisionAuthorityRetained:true,draws:bins.size};
  const meshes=group.children.slice();group.userData.dispose=()=>{for(const m of meshes)m.geometry.dispose();for(const m of owned)m.dispose();};return group;
 }finally{Math.random=previous;}
}
