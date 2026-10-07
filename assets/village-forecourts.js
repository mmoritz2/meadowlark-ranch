import {COTTONWOOD_GARDENS,villageRectDistance} from './cottonwood-layout.js?v=village-gardens-1';
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

// A single clipped mesh joins the public square and every doorstep without
// coplanar overlapping tiles. Its vertices follow the horse's ground surface.
export function installVillageForecourts(G,zones,{shrubs=[]}={}) {
  const {THREE:T,world:W,scene}=G,positions=[],uv=[],colors=[],indices=[];
  zones.push(...villageCourtZones(G.worldPkg.LANDMARKS));
  const textureLoader=new T.TextureLoader(),texture=(suffix,color=false)=>{
    const t=textureLoader.load('./assets/textures/village-paving/patterned_cobblestone_'+suffix+'.webp');
    t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());
    if(color)t.colorSpace=T.SRGBColorSpace;return t;
  };
  const arm=texture('arm'),stone=new T.MeshStandardMaterial({name:'Village | photographed cobblestone',color:new T.Color('#f5e6ce').multiplyScalar(3.2),
    map:texture('diff',true),normalMap:texture('nor_gl'),normalScale:new T.Vector2(.7,.7),roughnessMap:arm,
    roughness:1,aoMap:arm,aoMapIntensity:.5,vertexColors:true,envMapIntensity:.55});
  const distance=(x,z)=>Math.min(...zones.map(q=>villageRectDistance(q,x,z)));
  const bounds=G.worldPkg.LANDMARKS.filter(l=>l.grp?.userData.architecture?.kind==='townhouse')
    .map(l=>({id:l.id,width:l.grp.userData.architecture.width,depth:l.grp.userData.architecture.depth}));
  // Clip each half-metre triangle against the union's signed boundary. The
  // sampled boundary gives diagonal approaches a clean edge instead of stairs.
  const polygon=points=>{
    const clipped=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],da=distance(...a),db=distance(...b);
      if(da<=0)clipped.push(a);
      if((da<0)!==(db<0)){const t=da/(da-db);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
    if(clipped.length<3)return;
    const base=positions.length/3;
    for(const [x,z]of clipped){positions.push(x,W.groundH(x,z)+.055,z);uv.push(x/2.5,z/2.5);
      const shade=.95+.035*Math.sin(x*.37+z*.23)+.02*Math.cos(z*.55);colors.push(shade,shade,shade);}
    for(let i=1;i<clipped.length-1;i++)indices.push(base,base+i,base+i+1);
  };
  for(let z=-80;z< -25;z+=.5)for(let x=23;x<86;x+=.5){
    if(distance(x+.25,z+.25)>.8)continue;
    polygon([[x,z],[x,z+.5],[x+.5,z]]);polygon([[x+.5,z],[x,z+.5],[x+.5,z+.5]]);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('uv1',geometry.attributes.uv.clone());
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,stone);mesh.name='Cottonwood | connected cobblestone square';mesh.receiveShadow=true;mesh.userData.walkable=true;scene.add(mesh);
  const contains=(x,z,margin=0)=>inVillageCourt(zones,x,z,margin);
  const hidden=new T.Matrix4().makeScale(0,0,0),matrix=new T.Matrix4(),point=new T.Vector3();let cleared=0;
  const banks=['scrub','juni','sage','brack','reed','tuft','petal'].map(k=>G.floraPkg?.bank?.[k]?.im).filter(Boolean);
  if(W.seedGrass)banks.push(W.seedGrass);banks.push(...shrubs);
  for(const bank of banks){for(let i=0;i<bank.instanceMatrix.count;i++){
    bank.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-8)continue;point.setFromMatrixPosition(matrix);
    if(contains(point.x,point.z,bank===W.seedGrass ? .45 : 1.7)){bank.setMatrixAt(i,hidden);cleared++;}
  }bank.instanceMatrix.needsUpdate=true;}
  W.nearGroundCover.invalidate();
  const dressing=installSquareDressing(G);
  G.villageCourts={zones,bounds,contains,mesh,cleared,...dressing};
}

function installSquareDressing(G){
 const {THREE:T,world:W,scene}=G,group=new T.Group();group.name='Cottonwood | square gardens and fountain';scene.add(group);
 const stone=W.ranchArchitecture.materials.get('Ranch | dressed limestone').clone();stone.name='Village | carved pale limestone';stone.color.multiplyScalar(2.2);
 const soil=new T.MeshStandardMaterial({name:'Village | garden soil',color:'#37362b',roughness:1});
 const bedRoots=[];
 for(const b of COTTONWOOD_GARDENS){
  const root=new T.Group();root.name='Cottonwood | planted limestone bed';root.position.set(b.x,W.groundH(b.x,b.z),b.z);group.add(root);
  const add=(w,h,d,x,y,z,m)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);};
  add(b.width-.18,.23,b.depth-.18,0,.125,0,soil);
  for(const sx of[-1,1])add(.16,.34,b.depth,sx*(b.width-.16)/2,.17,0,stone);
  for(const sz of[-1,1])add(b.width,.34,.16,0,.17,sz*(b.depth-.16)/2,stone);
  W.solidWorld.register(root,{primitives:true});W.followCamera.register(root);bedRoots.push(root);
 }
 // The round basin has a real open profile and a separate water surface. A
 // low rim and narrow column leave clear sightlines across the riding square.
 const fountain=new T.Group();fountain.name='Cottonwood | carved stone fountain';
 fountain.position.set(53.8,W.groundH(53.8,-49),-49);group.add(fountain);
 const lathe=points=>{const g=new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),48),uv=g.attributes.uv,height=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])),circumference=2*Math.PI*Math.max(...points.map(p=>p[0]));
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*circumference/1.6,uv.getY(i)*height/1.6);
 const m=new T.Mesh(g,stone);m.castShadow=m.receiveShadow=true;fountain.add(m);return m;};
 lathe([[0,0],[1.48,0],[1.52,.10],[1.43,.20],[1.40,.56],[1.47,.61],[1.47,.72],[1.29,.72],[1.27,.24],[0,.24]]);
 lathe([[0,.24],[.40,.24],[.43,.34],[.27,.43],[.21,1.30],[.38,1.42],[.70,1.47],[.74,1.57],[.65,1.61],[.22,1.55],[.15,1.76],[0,1.80]]);
 const water=new T.Mesh(new T.CircleGeometry(1.28,48),new T.MeshPhysicalMaterial({name:'Village | fountain water',color:'#638b85',roughness:.23,metalness:.14,clearcoat:.75}));
 water.rotation.x=-Math.PI/2;water.position.y=.58;water.receiveShadow=true;fountain.add(water);
 const streamMat=new T.MeshPhysicalMaterial({name:'Village | fountain stream',color:'#b7d6d0',roughness:.15,transparent:true,opacity:.62,depthWrite:false});
 for(let i=0;i<8;i++){const a=i*Math.PI/4,curve=new T.CatmullRomCurve3([new T.Vector3(Math.cos(a)*.65,1.55,Math.sin(a)*.65),new T.Vector3(Math.cos(a)*.88,1.3,Math.sin(a)*.88),new T.Vector3(Math.cos(a),.59,Math.sin(a))]);
  const stream=new T.Mesh(new T.TubeGeometry(curve,10,.018,4,false),streamMat);fountain.add(stream);}
 W.colliders.push({x:53.8,z:-49,r:1.52,height:1.80});W.followCamera.register(fountain);
 const furniture=[];
 for(const [type,x,z,rot]of[['bench',41,-60.3,0],['bench',56,-60.3,0],['bench',58.5,-47.4,-Math.PI/2],
  ['lantern',38.2,-59,0],['lantern',58.8,-54.3,0],['lantern',43,-40.4,0],['lantern',60,-65.8,0],['lantern',73,-70.5,0]]){
  const root=W.ranchBuilderArt.create(type);root.name='Cottonwood | '+type;root.position.set(x,W.groundH(x,z)+.055,z);root.rotation.y=rot;group.add(root);
  W.solidWorld.register(root);W.followCamera.register(root);furniture.push({type,x,z,root});
 }
 return {gardens:COTTONWOOD_GARDENS,bedRoots,fountain,furniture};
}
