import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import {recordSolidPart} from './solid-collisions.js?v=solid-world-1';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

// Original small wildlife, sharing one mesh and material per bird. The neck and
// head have independent bones; standing feet stay fixed on the shore.
export function createMarshHeron(T){
 const parts=[],color=new T.Color(),V=(x,y,z)=>new T.Vector3(x,y,z),up=V(0,1,0);
 const skinAt=y=>y<.86?[0,1,1,0]:y<1.18?[0,1,1-smooth(.86,1.18,y),smooth(.86,1.18,y)]:[1,2,1-smooth(1.18,1.34,y),smooth(1.18,1.34,y)];
 function put(g,col,bone=0){
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  color.set(col);const colors=[],indices=[],weights=[],detail=[],p=g.attributes.position;const feather=Number.parseInt(col.slice(1,3),16)>110&&Number.parseInt(col.slice(5,7),16)>115;
  for(let i=0;i<p.count;i++){colors.push(color.r,color.g,color.b);detail.push(feather?1:0);const s=bone==='neck'?skinAt(p.getY(i)):[bone,0,1,0];indices.push(s[0],s[1],0,0);weights.push(s[2],s[3],0,0);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('featherDetail',new T.Float32BufferAttribute(detail,1));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));parts.push(g);
 }
 const ell=(at,scale,col,bone=0)=>{const g=new T.SphereGeometry(1,18,12);g.scale(...scale);g.translate(...at);put(g,col,bone);};
 function tube(points,r1,r2,col,bone=0,segments=8,sides=7){
  const curve=new T.CatmullRomCurve3(points.map(p=>V(...p))),g=new T.TubeGeometry(curve,segments,1,sides,false),p=g.attributes.position;
  for(let k=0;k<=segments;k++){const at=curve.getPointAt(k/segments),r=r1+(r2-r1)*k/segments;for(let j=0;j<=sides;j++){const i=k*(sides+1)+j,v=V(p.getX(i),p.getY(i),p.getZ(i)).sub(at).multiplyScalar(r).add(at);p.setXYZ(i,...v.toArray());}}g.computeVertexNormals();put(g,col,bone);
 }
 // Thigh, hock, tarsus and three forward toes plus the rear toe.
 for(const side of[-1,1]){
  const x=side*.061;tube([[x,.71,-.045],[x,.39,.022],[x,.025,-.015]],.015,.009,'#656b59',0,10,7);
  ell([x,.39,.022],[.018,.021,.018],'#757965');
  for(const fan of[-1,0,1])tube([[x,.025,-.015],[x+fan*.025,.016,.062],[x+fan*.052,.005,.15-Math.abs(fan)*.035]],.008,.003,'#737866',0,4,5);
  tube([[x,.025,-.015],[x,.010,-.085]],.007,.002,'#737866',0,2,5);
 }
 ell([0,.78,-.025],[.143,.207,.302],'#adb8bd');
 ell([0,.865,.176],[.107,.147,.126],'#d4d7d0');
 // Folded wing shields and overlapping long primaries.
 for(const side of[-1,1]){
  ell([side*.119,.79,-.042],[.048,.165,.28],'#85969f');
  for(let i=0;i<10;i++){
   const g=new T.SphereGeometry(1,12,7);g.scale(.019,.055,.18-i*.006);g.rotateX(-.18-i*.03);g.rotateY(side*.11);g.translate(side*(.131+Math.sin(i*.30)*.016),.887-i*.021,-.14-i*.011);put(g,i%3?'#7d8f98':'#99a6ac');
  }
 }
 for(let i=0;i<5;i++){const g=new T.SphereGeometry(1,12,7);g.scale(.025,.018,.19);g.rotateY((i-2)*.10);g.translate((i-2)*.024,.692,-.29);put(g,i%2?'#52626c':'#657780');}
 tube([[0,.85,.17],[0,1.005,.305],[0,1.175,.155],[0,1.34,.245]],.085,.040,'#d6d9d2','neck',23,12);
 // Small dark markings down the front of the neck and chest.
 for(let i=0;i<7;i++){const t=i/6,at=[(i%2?1:-1)*.02,.88+t*.20,.247+Math.sin(t*Math.PI)*.112];const g=new T.SphereGeometry(1,6,4);g.scale(.009,.022,.004);g.translate(...at);put(g,'#505b5e','neck');}
 ell([0,1.374,.274],[.065,.071,.105],'#dfe2dc',2);
 for(const side of[-1,1]){
  tube([[side*.045,1.401,.294],[side*.051,1.414,.241],[side*.035,1.405,.17]],.012,.008,'#283439',2,6,6);
  ell([side*.062,1.397,.304],[.010,.010,.008],'#d5ac44',2);ell([side*.070,1.397,.307],[.003,.006,.005],'#182126',2);
  tube([[side*.026,1.405,.17],[side*.031,1.383,.055],[side*.016,1.333,-.057]],.010,.002,'#29363e',2,7,5);
 }
 // Upper and lower halves retain a visible bill seam.
 for(const side of[-1,1]){
  const g=new T.BufferGeometry(),p=[-.033,1.375+side*.003,.340,.033,1.375+side*.003,.340,0,1.375+side*.029,.340,0,1.352+side*.001,.659];
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.5,.2,.5,1],2));g.setIndex(side===1?[0,3,1,0,2,3,1,3,2,0,1,2]:[0,1,3,0,3,2,1,2,3,0,2,1]);g.computeVertexNormals();put(g,side===1?'#b49655':'#a88a4e',2);
 }
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const material=new T.MeshStandardMaterial({name:'Willowmere | grey heron plumage',vertexColors:true,roughness:.86,envMapIntensity:.55});
 material.onBeforeCompile=sh=>{sh.vertexShader='attribute float featherDetail;varying float featherMask;varying vec2 featherUV;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nfeatherUV=uv;featherMask=featherDetail;');sh.fragmentShader='varying float featherMask;varying vec2 featherUV;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=sin((featherUV.x*28.0+featherUV.y*8.0)*6.283);diffuseColor.rgb*=1.0-featherMask*(.018+.018*grain);');};material.customProgramCacheKey=()=> 'heron-plumage-1';
 const create=()=>{const mesh=new T.SkinnedMesh(geometry,material),root=new T.Bone(),neck=new T.Bone(),head=new T.Bone();root.name='Heron | planted feet';neck.name='Heron | neck';head.name='Heron | head';neck.position.set(0,.86,.17);head.position.set(0,.46,.075);root.add(neck);neck.add(head);mesh.add(root);mesh.bind(new T.Skeleton([root,neck,head]));mesh.name='Willowmere | grey heron';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;return{mesh,neck,head};};
 return{geometry,material,triangles:geometry.index.count/3,create};
}

export function buildMarshDressing(G,sites,A){
 const T=G.THREE,W=G.world,materials=W.ranchBuilderArt.materials,root=new T.Group();root.name='Willowmere | working marsh details';
 const mast=new T.Group(),nets=new T.Group(),batches=new Map(),V=(x,y,z)=>new T.Vector3(x,y,z),up=V(0,1,0);
 const old=sites.mast;root.add(mast,nets);mast.name='Willowmere | framed beacon';mast.position.set(old.position.x,W.terrainH(old.position.x,old.position.z),old.position.z);mast.rotation.y=old.rotation.y;
 const metal=materials.iron,brass=new T.MeshStandardMaterial({name:'Willowmere | aged lantern brass',color:'#8d744c',metalness:.72,roughness:.53}),rope=materials.cloth.clone();rope.name='Willowmere | tarred cord';rope.color.set('#80705b');rope.userData.metres=.2;
 function add(g,mat,x,y,z,rot=0,owner=mast,solid=true){
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,k=mat.userData.metres||1;
  if(u){g.computeBoundingBox();const sz=g.boundingBox.getSize(V(0,0,0)),long=sz.y>sz.x&&sz.y>sz.z?'y':sz.z>sz.x?'z':'x';for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));if(mat.userData.grain){const a=long==='y'?p.getY(i):long==='x'?p.getX(i):p.getZ(i),b=long==='y'?(nx>nz?p.getZ(i):p.getX(i)):long==='x'?(ny>nz?p.getZ(i):p.getY(i)):(ny>nx?p.getX(i):p.getY(i));u.setXY(i,a/k+x*.07,b/k+z*.05);}else u.setXY(i,(ny>nx?p.getX(i):p.getY(i))/k,(nz>ny?p.getX(i):p.getZ(i))/k);}}
  const matrix=new T.Matrix4();if(rot.isQuaternion)matrix.makeRotationFromQuaternion(rot);else matrix.makeRotationY(rot);matrix.setPosition(x,y,z);if(solid)recordSolidPart(T,owner,g,mat,matrix);g.applyMatrix4(matrix);
  if(!batches.has(owner))batches.set(owner,new Map());const map=batches.get(owner);if(!map.has(mat))map.set(mat,[]);map.get(mat).push(g);
 }
 const box=(w,h,d,mat,x,y,z,yaw=0,owner=mast,solid=true)=>add(new T.BoxGeometry(w,h,d),mat,x,y,z,yaw,owner,solid);
 const cylinder=(rt,rb,h,mat,x,y,z,owner=mast,solid=true,sides=16)=>add(new T.CylinderGeometry(rt,rb,h,sides),mat,x,y,z,0,owner,solid);
 function beam(a,b,r,mat,owner=mast,solid=false){const v=V(...a),end=V(...b),d=end.clone().sub(v),m=v.clone().add(end).multiplyScalar(.5),q=new T.Quaternion().setFromUnitVectors(up,d.clone().normalize());add(new T.CylinderGeometry(r,r,d.length(),7),mat,m.x,m.y,m.z,q,owner,solid);}
 const footing=Math.max(.62,A.landscape.level-mast.position.y+.30);
 // A piled foundation emerges above the water, with individual irregular stones.
 for(let ring=0;ring<3;ring++)for(let j=0;j<10-ring*2;j++){
  const a=j/(10-ring*2)*Math.PI*2+ring*.5,r=ring===0?1.2:ring===1?.8:.35,g=new T.IcosahedronGeometry(1,1),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+.08*Math.sin(x*9+y*7+z*6+j);p.setXYZ(i,x*(.50-ring*.045)*f,y*(footing/3+.05)*f,z*.40*f);}g.computeVertexNormals();add(g,materials.stone,Math.cos(a)*r,footing*(.20+ring*.28),Math.sin(a)*r,j*.7,mast,true);
 }
 const poleBase=footing*.62,poleTop=14.5;
 cylinder(.18,.29,poleTop-poleBase,materials.aged,0,(poleBase+poleTop)/2,0);
 // Forged collars, bolts and staggered climbing irons are visible from the path.
 for(const y of[poleBase+.25,3.2,6.4,9.15,12.6,14.25]){
  const r=.29-(y-poleBase)/(poleTop-poleBase)*.11;cylinder(r+.022,r+.022,.10,metal,0,y,0,mast,false);
  for(const a of[0,Math.PI]){const g=new T.SphereGeometry(.025,6,4);add(g,brass,Math.sin(a)*(r+.025),y,Math.cos(a)*(r+.025),0,mast,false);}
 }
 for(let i=0;i<25;i++){const y=1.7+i*.46,x=(i%2?1:-1)*.31;beam([x*.4,y,0],[x,y,0],.018,metal);beam([x,y,0],[x,y+.07,0],.018,metal);}
 for(let i=0;i<3;i++){
  const a=i*Math.PI*2/3,x=Math.cos(a)*3.2,z=Math.sin(a)*3.2,at=V(x,0,z).applyAxisAngle(up,mast.rotation.y),base=W.terrainH(mast.position.x+at.x,mast.position.z+at.z)-mast.position.y;
  cylinder(.065,.065,.50,metal,x,base+.18,z,mast,true,10);beam([x,base+.34,z],[0,9.1,0],.012,metal);
  const lower=V(x,base+.34,z),upper=V(0,9.1,0),m=lower.clone().lerp(upper,.09),dir=upper.clone().sub(lower).normalize();beam(m.clone().addScaledVector(dir,-.14).toArray(),m.clone().addScaledVector(dir,.14).toArray(),.026,brass);
 }
 // A six-pane enclosed lantern with a vented cap and a small warm burner.
 const y=14.7,r=.56; cylinder(.61,.61,.09,metal,0,y-.16,0,mast,false,6);cylinder(.57,.57,.055,brass,0,y-.08,0,mast,false,6);
 const glass=new T.MeshStandardMaterial({name:'Willowmere | beacon glazing',color:'#b7c6c1',metalness:.12,roughness:.20,transparent:true,opacity:.20,depthWrite:false,side:T.DoubleSide});
 for(let i=0;i<6;i++){const a=i*Math.PI/3,b=(i+1)*Math.PI/3,ax=Math.cos(a)*r,az=Math.sin(a)*r,bx=Math.cos(b)*r,bz=Math.sin(b)*r;
  beam([ax,y,az],[ax,y+.92,az],.026,metal);beam([ax,y+.45,az],[bx,y+.45,bz],.011,brass);beam([ax,y+.92,az],[bx,y+.92,bz],.025,metal);
  const pane=new T.PlaneGeometry(r-.07,.84),angle=Math.atan2(bx-ax,bz-az);add(pane,glass,(ax+bx)/2,y+.46,(az+bz)/2,angle+Math.PI/2,mast,false);
 }
 cylinder(.17,.66,.36,metal,0,y+1.12,0,mast,false,6);cylinder(.135,.135,.17,brass,0,y+1.37,0,mast,false,12);cylinder(.20,.16,.055,metal,0,y+1.48,0,mast,false,12);
 cylinder(.16,.22,.10,brass,0,y+.04,0,mast,false,16);
 const glow=new T.MeshStandardMaterial({name:'Willowmere | lamp mantle',color:'#ddd0a5',emissive:'#ffbb66',emissiveIntensity:.25,roughness:.35});const bulb=new T.SphereGeometry(1,14,10);bulb.scale(.12,.25,.12);add(bulb,glow,0,y+.34,0,0,mast,false);
 const reflector=new T.ConeGeometry(.29,.17,16,1,true);reflector.rotateX(Math.PI);add(reflector,brass,0,y+.75,0,0,mast,false);
 const vane=new T.Group();vane.name='Willowmere | heron weather vane';vane.position.y=y+1.5;mast.add(vane);beam([0,0,0],[0,.7,0],.016,metal,vane);
 beam([-.75,.28,0],[.85,.28,0],.014,metal,vane);const shape=new T.Shape();shape.moveTo(-.33,.29);shape.lineTo(-.38,.56);shape.quadraticCurveTo(-.04,.49,.06,.67);shape.bezierCurveTo(.16,.84,.05,.9,.19,1.01);shape.quadraticCurveTo(.27,1.08,.36,1.00);shape.lineTo(.65,.95);shape.lineTo(.37,.92);shape.bezierCurveTo(.23,.88,.37,.76,.21,.60);shape.quadraticCurveTo(.07,.47,-.22,.47);shape.lineTo(-.16,.29);shape.lineTo(-.20,.29);shape.lineTo(-.29,.46);shape.lineTo(-.29,.29);shape.closePath();
 add(new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:false,curveSegments:7}),metal,0,.1,-.011,0,vane,false);
 // Net cords follow the sagging cloth, leaving actual open diamonds.
 const ns=sites.nets;nets.name='Willowmere | drying net';nets.position.set(ns.x,W.terrainH(ns.x,ns.z),ns.z);
 for(const x of[-1.65,1.65]){cylinder(.078,.105,2.5,materials.aged,x,1.2,0,nets,true);cylinder(.12,.12,.055,metal,x,2.45,0,nets,false);}
 beam([-1.65,2.27,0],[1.65,2.27,0],.022,rope,nets);
 const netP=(u,v)=>[u*3.08-1.54,2.21-v*1.45-.17*Math.sin(u*Math.PI)*(.25+.75*v),Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.12];
 for(const sign of[-1,1])for(let line=-10;line<=20;line++){
  const pts=[];for(let k=0;k<=80;k++){const v=k/80,u=line*.10+sign*v*.58;if(u>=0&&u<=1)pts.push(netP(u,v));}
  for(let k=1;k<pts.length;k+=4)beam(pts[k-1],pts[Math.min(k+3,pts.length-1)],.0045,rope,nets);
 }
 for(let i=0;i<14;i++){const p=netP(i/13,1);add(new T.SphereGeometry(.026,6,4),metal,...p,0,nets,false);}
 for(const [owner,maps]of batches)for(const [mat,list]of maps){const geometry=mergeGeometries(list,false);list.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,mat);mesh.name=mat.name;mesh.castShadow=mat!==glass;mesh.receiveShadow=true;owner.add(mesh);}
 const lamp=new T.PointLight('#ffc779',0,8,2);lamp.position.set(0,y+.34,0);mast.add(lamp);
 G.scene.add(root);W.solidWorld.register(mast);W.solidWorld.register(nets);const oldCollider=W.colliders.find(c=>Math.hypot(c.x-old.position.x,c.z-old.position.z)<.001&&c.r===1.7);if(oldCollider)oldCollider.precise=true;
 // Short camera proxies for the pole and individual frame posts, never the guys.
 const camera=new T.Group();camera.name='Willowmere | mast camera solids';camera.userData.collisionIgnore=true;
 for(const [owner,points]of[[mast,[[0,(poleBase+14.5)/2,0,.56,14.5-poleBase,.56]]],[nets,[[-1.65,1.2,0,.2,2.5,.2],[1.65,1.2,0,.2,2.5,.2]]]])for(const[x,py,z,w,h,d]of points){const m=new T.Mesh(new T.BoxGeometry(w,h,d),metal);m.position.copy(owner.localToWorld(V(x,py,z)));camera.add(m);}W.followCamera.register(camera);
 const heron=createMarshHeron(T),birds=[];
 for(let i=0;i<sites.herons.length;i++){
  const old=sites.herons[i],bird=heron.create();let best=null;
  for(let r=0;r<=8;r+=.5)for(let j=0;j<(r===0?1:32);j++){
   const a=j*Math.PI/16,x=old.position.x+Math.cos(a)*r,z=old.position.z+Math.sin(a)*r,bed=W.terrainH(x,z),depth=A.landscape.level-bed,shore=A.landscape.shore(x,z);
   if(Number.isFinite(A.deckAt(x,z,.7))||depth>.23||depth<-.32||shore>1.8||shore<-.9)continue;
   const p={x,z};if(W.solidWorld.resolve(p,{bottom:bed+.05,top:bed+1.45,radius:.18}))continue;
   const score=r+Math.abs(depth-.08)*5;if(!best||score<best.score)best={x,z,bed,score};
  }
  best??={x:old.position.x,z:old.position.z,bed:W.terrainH(old.position.x,old.position.z)};bird.mesh.position.set(best.x,best.bed-.006,best.z);bird.mesh.rotation.y=old.rotation.y;root.add(bird.mesh);old.visible=false;birds.push({...bird,original:old.position.toArray(),site:{x:best.x,y:best.bed-.006,z:best.z},phase:i*1.73});
 }
 old.visible=false;sites.nets.legacy.visible=false;
 let triangles=0,draws=0;root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;draws++;}});
 const state={root,mast,nets,vane,glow,lamp,camera,heron,birds,stats:{triangles,draws,birds:birds.length,heronTriangles:heron.triangles},legacy:sites.mast};
 state.update=(dt,t)=>{
  const night=1-smooth(.08,.27,.5-.5*Math.cos(G.time.dayT()*Math.PI*2));glow.emissiveIntensity=.16+night*1.25;lamp.intensity=night*4;lamp.visible=G.gfx.get()==='high'&&Math.hypot(G.horse.player.pos.x-mast.position.x,G.horse.player.pos.z-mast.position.z)<75;
  vane.rotation.y=.42+Math.sin(t*.065)*.12;
  for(const b of birds){const near=Math.hypot(G.horse.player.pos.x-b.site.x,G.horse.player.pos.z-b.site.z)<145;b.mesh.visible=near;if(!near)continue;const p=t*.31+b.phase;b.neck.rotation.y=Math.sin(p)*.14;b.neck.rotation.x=Math.sin(p*.63)*.045;b.head.rotation.y=Math.sin(p*.7+.8)*.23;b.head.rotation.x=Math.sin(p*1.3)*.065;}
 };G.on('tick',state.update);state.update(0,0);return state;
}

// View-facing puffs are rebuilt in the vertex shader for every rendering camera,
// including reflections. Their noisy edge and per-puff fade remove crossed sheets.
export function installChimneySmoke(G,sources){
 const T=G.THREE,records=[],clock={value:0},smokeColor=new T.Color('#cecbc2'),geometry=new T.PlaneGeometry(1,1),up=new T.Vector3(1,1,1),position=new T.Vector3(),q=new T.Quaternion(),matrix=new T.Matrix4();
 for(const source of sources){
  const geo=geometry.clone(),n=18,life=new T.InstancedBufferAttribute(new Float32Array(n),1);geo.setAttribute('puffLife',life);
  const mat=new T.MeshBasicMaterial({name:'Settlement | drifting chimney smoke',color:'#cecbc2',transparent:true,depthWrite:false,opacity:.34,side:T.DoubleSide});
  mat.onBeforeCompile=sh=>{sh.uniforms.plumeTime=clock;sh.vertexShader='attribute float puffLife;varying float plumeLife;varying vec2 plumeUV;\n'+sh.vertexShader;
   sh.vertexShader=sh.vertexShader.replace('#include <project_vertex>',`plumeLife=puffLife;plumeUV=uv;vec4 centre=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);float radius=length(instanceMatrix[0].xyz);vec4 mvPosition=centre+vec4(position.xy*radius,0.0,0.0);gl_Position=projectionMatrix*mvPosition;`);
   sh.fragmentShader=`varying float plumeLife;varying vec2 plumeUV;uniform float plumeTime;
float plumeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float plumeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(plumeHash(i),plumeHash(i+vec2(1,0)),f.x),mix(plumeHash(i+vec2(0,1)),plumeHash(i+vec2(1,1)),f.x),f.y);}
`+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',`vec2 p=plumeUV*2.0-1.0;float noise=plumeNoise(p*3.2+vec2(plumeLife*7.0,plumeTime*.06))*.65+plumeNoise(p*7.0-plumeTime*.025)*.35;float edge=1.0-smoothstep(.22,.96,length(p)+(noise-.5)*.25);diffuseColor.a*=edge*edge*(.55+.45*noise)*smoothstep(0.0,.12,plumeLife)*(1.0-smoothstep(.60,1.0,plumeLife));\n#include <alphatest_fragment>`);
  };mat.customProgramCacheKey=()=> 'chimney-plume-1';
  const mesh=new T.InstancedMesh(geo,mat,n);mesh.name='Settlement | soft chimney plume';mesh.position.copy(source.im.position);mesh.frustumCulled=false;mesh.renderOrder=3;G.scene.add(mesh);source.im.visible=false;source.replaced=true;records.push({mesh,source,n,life});
 }
 geometry.dispose();const state={records,triangles:records.length*18*2};state.update=(dt,t)=>{clock.value=t;const daylight=smooth(.04,.35,.5-.5*Math.cos(G.time.dayT()*Math.PI*2));for(const r of records){r.mesh.material.color.copy(smokeColor).multiplyScalar(.12+.88*daylight);r.mesh.material.opacity=.20+.14*daylight;const s=r.source;r.mesh.visible=Math.hypot(G.horse.player.pos.x-s.x,G.horse.player.pos.z-s.z)<320;if(!r.mesh.visible)continue;for(let i=0;i<r.n;i++){const age=(t*s.rise/s.h*.38+s.t*.04+i/r.n)%1,h=age*s.h,sz=.34+age*2.5;position.set(age*age*s.drift*2.1+Math.sin(age*8+t*.10)*age*.26,h,age*s.drift*.45+Math.sin(age*11+t*.08)*age*.31);up.set(sz,sz,sz);r.mesh.setMatrixAt(i,matrix.compose(position,q,up));r.life.setX(i,age);}r.mesh.instanceMatrix.needsUpdate=true;r.life.needsUpdate=true;}};G.on('tick',state.update);state.update(0,0);return state;
}
