// Shared before roads are dressed and again when paving is built. Field hedges
// and their collision segments must stop at the same edge as the planting.
export function villageCourtZones(landmarks) {
  return landmarks.filter(l=>l.grp?.userData.architecture?.kind==='townhouse').map(l=>{
    const root=l.grp,a=root.userData.architecture;
    return {id:l.id,x:root.position.x,z:root.position.z,sin:Math.sin(root.rotation.y),cos:Math.cos(root.rotation.y),
      halfX:a.width/2+.70,minZ:-a.depth/2-.65,maxZ:a.depth/2+3.25};
  });
}
export function inVillageCourt(zones,x,z,margin=0) {
  return zones.some(q=>{const dx=x-q.x,dz=z-q.z,lx=dx*q.cos-dz*q.sin,lz=dx*q.sin+dz*q.cos;
    return Math.abs(lx)<q.halfX+margin&&lz>q.minZ-margin&&lz<q.maxZ+margin;});
}

// Ground-draped paving for the three Cottonwood landmarks. The same rectangles
// clear procedural cover, imported shrubs, and the older static planting banks.
export function installVillageForecourts(G,zones,{shrubs=[]}={}) {
  const {THREE:T,world:W,scene}=G,positions=[],uv=[],colors=[],indices=[];
  const stone=W.ranchArchitecture.materials.get('Ranch | dressed limestone').clone();
  stone.name='Village | weathered forecourt flags';stone.color.set('#b4ad9b');stone.vertexColors=true;
  const bounds=[];zones.push(...villageCourtZones(G.worldPkg.LANDMARKS));
  for(const landmark of G.worldPkg.LANDMARKS){
    const root=landmark.grp,a=root?.userData.architecture;if(a?.kind!=='townhouse')continue;
    root.updateMatrixWorld(true);
    const zone=zones.find(z=>z.id===landmark.id);bounds.push({id:landmark.id,width:a.width,depth:a.depth});
    const world=(x,z)=>({x:zone.x+x*zone.cos+z*zone.sin,z:zone.z-x*zone.sin+z*zone.cos});
    const stepX=.64,stepZ=.43;
    for(let z=zone.minZ,row=0;z<zone.maxZ;z+=stepZ,row++)for(let x=-zone.halfX-(row%2)*stepX/2;x<zone.halfX;x+=stepX){
      const x0=Math.max(-zone.halfX,x)+.012,x1=Math.min(zone.halfX,x+stepX)-.012,z0=z+.012,z1=Math.min(zone.maxZ,z+stepZ)-.012;
      if(x1<=x0||z1<=z0)continue;
      if(x0>-a.width/2+.02&&x1<a.width/2-.02&&z0>-a.depth/2+.02&&z1<a.depth/2-.02)continue;
      const base=positions.length/3,tint=.88+((Math.sin(x*13.3+z*19.7)*43758.54)%1+1)%1*.18;
      for(const [px,pz]of[[x0,z0],[x0,z1],[x1,z1],[x1,z0]]){
        const p=world(px,pz);positions.push(p.x,W.groundH(p.x,p.z)+.025,p.z);uv.push(p.x/1.6,p.z/1.6);colors.push(tint,tint,tint);
      }
      indices.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,stone);mesh.name='Cottonwood | grounded stone forecourts';mesh.receiveShadow=true;mesh.userData.walkable=true;scene.add(mesh);
  const contains=(x,z,margin=0)=>inVillageCourt(zones,x,z,margin);
  const hidden=new T.Matrix4().makeScale(0,0,0),matrix=new T.Matrix4(),point=new T.Vector3();let cleared=0;
  const banks=['scrub','juni','sage','brack','reed','tuft','petal'].map(k=>G.floraPkg?.bank?.[k]?.im).filter(Boolean);
  if(W.seedGrass)banks.push(W.seedGrass);banks.push(...shrubs);
  for(const bank of banks){for(let i=0;i<bank.instanceMatrix.count;i++){
    bank.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-8)continue;point.setFromMatrixPosition(matrix);
    if(contains(point.x,point.z,bank===W.seedGrass ? .45 : 1.7)){bank.setMatrixAt(i,hidden);cleared++;}
  }bank.instanceMatrix.needsUpdate=true;}
  W.nearGroundCover.invalidate();
  G.villageCourts={zones,bounds,contains,mesh,cleared};
}
