import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import {recordSolidPart} from './solid-collisions.js?v=solid-world-1';
import {buildWillowmereLandscape} from './willowmere-landscape.js?v=willowmere-settlement-1';

export function buildWillowmereArt(G,sites){
 const T=G.THREE,W=G.world,landscape=buildWillowmereLandscape(G,sites),{aged,oak,iron,steel}=W.ranchBuilderArt.materials;
 const root=new T.Group();root.name='Willowmere | timber settlement';
 const decks=[],routes=[],houses=[],solids=new T.Group(),batches=new Map(),cameraProxies=[],up=new T.Vector3(0,1,0);
 solids.name='Willowmere | walkway joinery';root.add(solids);
 const stats={boards:0,posts:0,triangles:0,drawCalls:0,clearedCover:0};
 function geometry(g,mat,x,y,z,yaw=0,solid=true){
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,scale=mat.userData.metres||1;
  g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3()),long=size.x>=size.y&&size.x>=size.z?'x':size.y>size.z?'y':'z';
  for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));const a=long==='x'?p.getX(i):long==='y'?p.getY(i):p.getZ(i),b=long==='x'?(ny>nz?p.getZ(i):p.getY(i)):long==='y'?(nx>nz?p.getZ(i):p.getX(i)):(ny>nx?p.getX(i):p.getY(i));uv.setXY(i,a/scale+x*.13,b/scale+z*.11);}
  const matrix=new T.Matrix4();if(yaw.isQuaternion)matrix.makeRotationFromQuaternion(yaw);else matrix.makeRotationY(yaw);matrix.setPosition(x,y,z);if(solid)recordSolidPart(T,solids,g,mat,matrix);g.applyMatrix4(matrix);
  if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);
 }
 function box(w,h,d,mat,x,y,z,yaw=0,solid=true){geometry(new T.BoxGeometry(w,h,d),mat,x,y,z,yaw,solid);}
 function beam(a,b,w,d,mat){
  const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start),g=new T.BoxGeometry(w,dir.length(),d),q=new T.Quaternion().setFromUnitVectors(up,dir.normalize());const m=start.add(end).multiplyScalar(.5);geometry(g,mat,m.x,m.y,m.z,q);
 }
 function deck(x,z,y,yaw,width,length,slope=0){
  const c=Math.cos(yaw),s=Math.sin(yaw),surface={x,z,y,yaw,width,length,slope,c,s};decks.push(surface);
  const count=Math.ceil(length/.22),spacing=length/count;
  for(let i=0;i<count;i++){
   const v=-length/2+(i+.5)*spacing,g=new T.BoxGeometry(width,.075,spacing-.004),p=g.attributes.position;
   for(let j=0;j<p.count;j++)p.setY(j,p.getY(j)+p.getZ(j)*slope);g.computeVertexNormals();
   geometry(g,i%7===3?oak:aged,x+v*s,y+v*slope-.0375,z+v*c,yaw,false);stats.boards++;
  }
  for(const side of[-1,1]){
   // Short collision spans follow the local underside of sloped stringers.
   const u=side*(width/2-.21),n=Math.ceil(length/.8);
   for(let i=0;i<n;i++){const a=-length/2+i*length/n,b=-length/2+(i+1)*length/n;
    beam([x+u*c+a*s,y+a*slope-.18,z-u*s+a*c],[x+u*c+b*s,y+b*slope-.18,z-u*s+b*c],.14,.20,aged);
   }
  }
  return surface;
 }
 const sample=(x,z,pad=0,except=null)=>{
  let y=-Infinity;for(const d of decks){if(d===except)continue;const dx=x-d.x,dz=z-d.z,u=dx*d.c-dz*d.s,v=dx*d.s+dz*d.c;if(Math.abs(u)<=d.width/2+pad&&Math.abs(v)<=d.length/2+pad)y=Math.max(y,d.y+d.slope*v);}return y;
 };
 // Floor height is sampled from the same planes as the visible boards.
 const waterSafe=(x,z)=>Math.max(W.terrainH(x,z)+.46,landscape.shore(x,z)<1.5?landscape.level+.31:-Infinity);
 const main=sites.routes[0].pts.map(p=>p.slice());
 main[0][1]-=1.05; // Leave the established arrival willow's trunk clear.
 main[2][1]+=2; // Pass outside the boathouse's projecting corner.
 // Bend around the Eel House veranda, leaving room beyond its corner posts.
 {const h=sites.houses[0],c=Math.cos(h.yaw),s=Math.sin(h.yaw);main[4]=[h.x-4.7*c+5.35*s,h.z+4.7*s+5.35*c];}
 const hide=sites.houses[3],hideC=Math.cos(hide.yaw),hideS=Math.sin(hide.yaw);
 main[main.length-1]=[hide.x+(hide.depth/2+3.4)*hideS,hide.z+(hide.depth/2+3.4)*hideC];
 main.splice(main.length-1,0,[335.1,296.5]);
 const main3=main.map(([x,z],i)=>[x,i===0?W.terrainH(x,z)+.03:waterSafe(x,z),z]);
 // End at the lookout's porch elevation, avoiding the old walk through its wall.
 main3[main3.length-1][1]=hide.deckY;
 {const a=main3.at(-3),b=main3.at(-2),c=main3.at(-1),ab=Math.hypot(b[0]-a[0],b[2]-a[2]),bc=Math.hypot(c[0]-b[0],c[2]-b[2]);b[1]=a[1]+(c[1]-a[1])*ab/(ab+bc);}
 function route(points,width,name){
  const pieces=[];for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]),yaw=Math.atan2(b[0]-a[0],b[2]-a[2]),slope=(b[1]-a[1])/length;
   if(length<.1)continue;pieces.push(deck((a[0]+b[0])/2,(a[2]+b[2])/2,(a[1]+b[1])/2,yaw,width,length+.045,slope));
  }routes.push({name,points,width,pieces});return pieces;
 }
 route(main3,2.8,'Marsh promenade');
 for(let i=0;i<sites.houses.length;i++){
  const h=sites.houses[i],c=Math.cos(h.yaw),s=Math.sin(h.yaw),front=h.depth/2+2.15,back=-h.depth/2-.45,length=front-back,mid=(front+back)/2;
  const terrace=deck(h.x+mid*s,h.z+mid*c,h.deckY,h.yaw,h.deckWidth,length);
  const body=W.ranchArchitecture.buildMarshHouse({...h,variant:i,chimneyTop:i===0?5.53:i===1?4.23:null});body.position.set(h.x,h.deckY,h.z);body.rotation.y=h.yaw;root.add(body);houses.push({body,terrace,...h});
  // Piles are rooted below the newly shaped bed, with cross bracing below the deck.
  for(const u of[-h.deckWidth/2+.16,0,h.deckWidth/2-.16])for(const v of[back+.22,front-.18]){
   const x=h.x+u*c+v*s,z=h.z-u*s+v*c,low=W.terrainH(x,z)-.32,high=h.deckY-.08;
   box(.19,high-low,.19,aged,x,(high+low)/2,z,h.yaw);box(.23,.075,.23,steel,x,high-.18,z,h.yaw);stats.posts++;
  }
  for(const side of[-1,1]){
   const u=side*(h.deckWidth/2-.16),a=[h.x+u*c+(back+.22)*s,h.deckY-.20,h.z-u*s+(back+.22)*c],b=[h.x+u*c+(front-.18)*s,Math.max(W.terrainH(h.x,h.z)+.06,h.deckY-.90),h.z-u*s+(front-.18)*c];beam(a,b,.105,.105,aged);
  }
  const old=W.colliders.find(o=>Math.hypot(o.x-h.x,o.z-h.z)<.001&&o.r===h.collisionRadius);if(old)old.precise=true;
  // Join the centre of the front landing to the nearest point on the promenade.
  const end=[h.x+(front+.02)*s,h.deckY,h.z+(front+.02)*c],lead=[h.x+(front+1.25)*s,h.deckY,h.z+(front+1.25)*c];
  if(i===3){route([main3.at(-1),end],2.2,'Lookout landing');continue;}
  let nearest=null,best=Infinity;for(let j=1;j<main3.length;j++){
   const a=main3[j-1],b=main3[j],dx=b[0]-a[0],dz=b[2]-a[2],f=Math.max(.02,Math.min(.98,((lead[0]-a[0])*dx+(lead[2]-a[2])*dz)/(dx*dx+dz*dz))),p=[a[0]+dx*f,a[1]+(b[1]-a[1])*f,a[2]+dz*f],dist=Math.hypot(p[0]-lead[0],p[2]-lead[2]);if(dist<best){nearest=p;best=dist;}
  }
  route([nearest,lead,end],2.2,['Eel House landing','West cottage landing','East cottage landing'][i]);
 }
 // Keep the existing feed-shop approach, but join it at the actual main deck.
 const shop=sites.boathouse,shopYaw=sites.boathouseYaw,shopC=Math.cos(shopYaw),shopS=Math.sin(shopYaw),shopEnd=[shop[0]+shopS*3,shop[1]+shopC*3],shopY=W.groundH(...shopEnd)+.03;
 const shopCorner=[shop[0]+3.8*shopC+4.3*shopS,(main3[1][1]+shopY)/2,shop[1]-3.8*shopS+4.3*shopC];
 route([main3[1],shopCorner,[shopEnd[0],shopY,shopEnd[1]]],2.2,'Boathouse approach');
 // Rails leave every branch junction and house landing open.
 for(const d of decks){
  const n=Math.max(1,Math.ceil(d.length/2.2));
  for(let k=0;k<=n;k++)for(const side of[-1,1]){
   const v=-d.length/2+.08+(d.length-.16)*k/n,u=side*(d.width/2+.04),x=d.x+u*d.c+v*d.s,z=d.z-u*d.s+v*d.c,y=d.y+v*d.slope;
   if(sample(x,z,.34,d)>y-.35)continue;
   const low=W.terrainH(x,z)-.22;box(.14,y+.98-low,.14,aged,x,(low+y+.98)/2,z,d.yaw);box(.19,.04,.19,oak,x,y+1,z,d.yaw);stats.posts++;
   // Only tall narrow pile proxies reach the riding camera; never an enclosing deck box.
   if(y+.98-low>1.4){const proxy=new T.Mesh(new T.BoxGeometry(.16,y+.98-low,.16),aged);proxy.position.set(x,(low+y+.98)/2,z);proxy.rotation.y=d.yaw;cameraProxies.push(proxy);}
   if(k<n){
    const next=-d.length/2+.08+(d.length-.16)*(k+1)/n,mv=(v+next)/2,mx=d.x+u*d.c+mv*d.s,mz=d.z-u*d.s+mv*d.c,my=d.y+mv*d.slope;
    if(sample(mx,mz,.52,d)>my-.35)continue;
    const nx=d.x+u*d.c+next*d.s,nz=d.z-u*d.s+next*d.c,ny=d.y+next*d.slope;
    for(const h of[.43,.87])beam([x,y+h,z],[nx,ny+h,nz],.075,.08,h>.8?oak:aged);
   }
  }
 }
 // Warm framed lamps, kept outside the mounted corridor.
 const lampMat=new T.MeshStandardMaterial({name:'Willowmere | lantern panes',color:'#ead5ac',emissive:'#f2b957',emissiveIntensity:.25,roughness:.35});
 for(const [i,at]of main3.entries())if(i>0&&i<main3.length-1){
  const next=main3[i+1],yaw=Math.atan2(next[0]-at[0],next[2]-at[2]),x=at[0]+Math.cos(yaw)*1.68,z=at[2]-Math.sin(yaw)*1.68,y=at[1];
  if(sample(x,z,.3)>y-.2)continue;
  box(.12,2.65,.12,aged,x,y+1.325,z,yaw);box(.40,.09,.40,iron,x,y+2.56,z,yaw);box(.29,.37,.29,lampMat,x,y+2.31,z,yaw,false);
  for(const a of[-1,1])for(const b of[-1,1])box(.033,.40,.033,iron,x+a*.16,y+2.31,z+b*.16);box(.42,.07,.42,iron,x,y+2.07,z,yaw);
 }
 for(const [mat,list]of batches){const g=mergeGeometries(list,false);list.forEach(x=>x.dispose());g.computeBoundingBox();g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.name=mat.name;mesh.castShadow=mesh.receiveShadow=true;solids.add(mesh);stats.triangles+=g.index.count/3;stats.drawCalls++;}
 for(const h of houses){stats.triangles+=h.body.userData.architecture.triangles;stats.drawCalls+=h.body.userData.architecture.drawCalls;}
 G.scene.add(root);W.solidWorld.register(solids);for(const p of cameraProxies)W.followCamera.register(p);for(const h of houses)W.followCamera.register(h.body);
 const deckBounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};for(const d of decks){const r=Math.hypot(d.width,d.length)/2;deckBounds.minX=Math.min(deckBounds.minX,d.x-r);deckBounds.maxX=Math.max(deckBounds.maxX,d.x+r);deckBounds.minZ=Math.min(deckBounds.minZ,d.z-r);deckBounds.maxZ=Math.max(deckBounds.maxZ,d.z+r);}
 const deckAt=(x,z,pad=0)=>x<deckBounds.minX-pad||x>deckBounds.maxX+pad||z<deckBounds.minZ-pad||z>deckBounds.maxZ+pad?-Infinity:sample(x,z,pad);
 W.groundSurfaces.push((x,z)=>deckAt(x,z));
 const excludesPlants=(x,z)=>Number.isFinite(deckAt(x,z,.2))||landscape.shore(x,z)<2.1;
 const m=new T.Matrix4(),v=new T.Vector3(),zero=new T.Matrix4().makeScale(0,0,0);
 for(const kind of['scrub','brack','reed','tuft','petal']){
  const bank=G.floraPkg?.bank[kind];if(!bank)continue;for(let i=0;i<bank.n;i++){bank.im.getMatrixAt(i,m);v.setFromMatrixPosition(m);if(excludesPlants(v.x,v.z)){bank.im.setMatrixAt(i,zero);stats.clearedCover++;}}bank.im.instanceMatrix.needsUpdate=true;
 }
 if(W.seedGrass){for(let i=0;i<W.seedGrass.count;i++){W.seedGrass.getMatrixAt(i,m);v.setFromMatrixPosition(m);if(excludesPlants(v.x,v.z)){W.seedGrass.setMatrixAt(i,zero);stats.clearedCover++;}}W.seedGrass.instanceMatrix.needsUpdate=true;}
 const reed=sites.reeds;if(reed){for(let i=0;i<reed.count;i++){reed.getMatrixAt(i,m);v.setFromMatrixPosition(m);if(Number.isFinite(deckAt(v.x,v.z,.35))||landscape.shore(v.x,v.z)<-.55){reed.setMatrixAt(i,zero);stats.clearedCover++;}else{m.elements[13]=W.terrainH(v.x,v.z)-.04;reed.setMatrixAt(i,m);}}reed.instanceMatrix.needsUpdate=true;}
 // Keep residents on their actual porch floor after the water and walkways change.
 const npcPlacements=[[1,-1.15],[0,1.85],[0,-1.85]];
 sites.npcs.forEach((entry,i)=>{const[hidx,u]=npcPlacements[i],h=houses[hidx],v=h.depth/2+1.15,c=Math.cos(h.yaw),s=Math.sin(h.yaw),x=h.x+u*c+v*s,z=h.z-u*s+v*c;
  entry.def.x=x;entry.def.z=z;entry.g.position.set(x,W.groundH(x,z),z);entry.g.rotation.y=h.yaw;
 });
 // A walk cannot be built through a moored boat. Move only boats whose hull
 // footprint now meets the new walkway, and keep them inside the same marsh.
 for(const boat of sites.boats){
  if(!Number.isFinite(deckAt(boat.position.x,boat.position.z,2)))continue;
  const x=boat.position.x,z=boat.position.z;let found=false;
  for(let r=2;r<=12&&!found;r+=1.5)for(let i=0;i<20;i++){
   const a=i*Math.PI/10,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;
   if(landscape.shore(px,pz)>-2||W.terrainH(px,pz)>landscape.level-.15||Number.isFinite(deckAt(px,pz,2)))continue;
   boat.position.set(px,landscape.level,pz);found=true;break;
  }
 }
 W.nearGroundCover?.invalidate();
 return{root,landscape,routes,decks,houses,stats,deckAt,excludesPlants};
}
