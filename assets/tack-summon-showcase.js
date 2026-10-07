import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

// Standalone reward sculptures: authored geometry, no horse, textures or DOM.
// +Z is the presentation front. The returned root is centered and fits in 1.8 m.
export function createTackSummonShowcase({THREE:T},piece){
 if(!T||!piece?.design||!['saddle','pad','bridle','shoes'].includes(piece.slot))throw new TypeError('A catalog tack piece is required');
 const d=piece.design,root=new T.Group(),parts=new Map(),resources=new Set(),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
 root.name='Summoned '+piece.name;root.userData.catalogId=piece.catalogId||piece.id;
 const make=(name,color,roughness,metalness=0)=>{const m=new T.MeshStandardMaterial({name:'Reward | '+name,color,roughness,metalness});resources.add(m);return m;};
 const mat={leather:make('leather',d.leather,.49),cloth:make('woven cloth',d.cloth,.92),lining:make('lining',d.lining,.95),edge:make('bound trim',d.accent,.55),metal:make('cast hardware',d.metal,.30,.75),gem:make('inset stones',d.accent,.22,.22)};
 const rainbow=d.rainbow===true&&Array.isArray(d.palette)&&d.palette.length===6?d.palette.map((c,i)=>make('rainbow '+i,c,.74)):null;
 const variant=Number.isFinite(d.variant)?d.variant:0,detailScale=1+(variant%7)*.013;
 let primitives=0;
 function add(geo,m,point=V(),normal=null,scale=1,turn=0){
  if(normal){const q=new T.Quaternion().setFromUnitVectors(V(0,0,1),normal.clone().normalize());geo.applyMatrix4(new T.Matrix4().compose(point,q,V(scale,scale,scale)).multiply(new T.Matrix4().makeRotationZ(turn)));}
  else geo.translate(point.x,point.y,point.z);
  if(geo.index){const old=geo;geo=old.toNonIndexed();old.dispose();}
  // All geometries share only render attributes, making batching deterministic.
  for(const name of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(name))geo.deleteAttribute(name);
  if(!geo.attributes.uv)geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  if(!parts.has(m))parts.set(m,[]);parts.get(m).push(geo);primitives++;
 }
 function ball(p,size,m){const geo=new T.SphereGeometry(1,16,10);geo.scale(...size);add(geo,m,p);}
 function tube(points,r,m,closed=false){const curve=new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:V(...p)),closed,'centripetal');add(new T.TubeGeometry(curve,Math.max(16,Math.min(72,points.length*6)),r,6,closed),m);}
 function ring(p,r,m=mat.metal,normal=V(0,0,1),rx=1,ry=1){const geo=new T.TorusGeometry(r,r*.15,6,28);geo.scale(rx,ry,1);add(geo,m,p,normal);}
 function surface(sample,n=16,m=16,material=mat.leather,thickness=.018){
  const pos=[],uv=[],ix=[];
  for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){pos.push(...sample(i/n,j/m).toArray());uv.push(i/n,j/m);}
  for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;ix.push(a,a+1,b,a+1,b+1,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
  const count=pos.length/3,normals=g.attributes.normal.array,front=ix.slice();
  for(let i=0;i<count;i++){pos.push(pos[i*3]-normals[i*3]*thickness,pos[i*3+1]-normals[i*3+1]*thickness,pos[i*3+2]-normals[i*3+2]*thickness);uv.push(uv[i*2],uv[i*2+1]);}
  for(let i=0;i<front.length;i+=3)ix.push(front[i]+count,front[i+2]+count,front[i+1]+count);
  const edge=[];for(let i=0;i<=n;i++)edge.push(i);for(let j=1;j<=m;j++)edge.push(j*(n+1)+n);for(let i=n-1;i>=0;i--)edge.push(m*(n+1)+i);for(let j=m-1;j>0;j--)edge.push(j*(n+1));
  for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length],k=pos.length/3;for(const v of[a,b,b+count,a+count])pos.push(...pos.slice(v*3,v*3+3));uv.push(0,0,1,0,1,1,0,1);ix.push(k,k+2,k+1,k,k+3,k+2);}
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.deleteAttribute('normal');g.computeVertexNormals();add(g,material);
 }
 function band(points,width,material=mat.leather,thickness=.012){const curve=new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:V(...p)),false,'centripetal');surface((u,v)=>{const p=curve.getPoint(v),t=curve.getTangent(v),a=V(t.y,-t.x,0);if(a.lengthSq()<.01)a.set(1,0,0);return p.addScaledVector(a.normalize(),(u-.5)*width);},2,24,material,thickness);}
 function trim(points,r=.009){tube(points,r,mat.edge,true);if(d.trim==='double')tube(points.map(p=>p.clone().multiplyScalar(.975)),r*.48,mat.metal,true);if(d.trim==='studded')for(let i=0;i<points.length;i+=4)ball(points[i],[r*.8,r*.8,r*.8],mat.metal);if(d.trim==='braid')tube(points.map((p,i)=>p.clone().add(V(Math.sin(i*2.4)*r*.5,Math.cos(i*2.4)*r*.5,r*.3))),r*.38,mat.metal,true);}
 function buckle(p,w=.085,h=.105,normal=V(0,0,1)){
  const s=new T.Shape(),hole=new T.Path();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();hole.moveTo(-w*.32,-h*.34);hole.lineTo(-w*.32,h*.34);hole.lineTo(w*.32,h*.34);hole.lineTo(w*.32,-h*.34);hole.closePath();s.holes.push(hole);
  add(new T.ExtrudeGeometry(s,{depth:.009,steps:1,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:2}),mat.metal,p,normal);
 }
 function emblem(p,normal,size=.09){
  if(d.nativeOriginal)return;
  const k=d.ornament,s=new T.Shape(),outline=[],shapes=[];const polygon=(n,inner=.45)=>{for(let i=0;i<n*2;i++){const a=Math.PI/2+i*Math.PI/n,r=i%2?inner:1;outline.push([Math.cos(a)*r,Math.sin(a)*r]);}};
  if(k==='crescent'){s.absarc(0,0,1,.6,Math.PI*2-.6,false);s.absarc(.48,0,.79,Math.PI*2-.45,.45,true);}
  else if(['leaf','feather','wisp','flame'].includes(k)){s.moveTo(0,-1);s.bezierCurveTo(-1,-.3,-.8,.4,k==='flame'?.18:0,1);s.bezierCurveTo(k==='wisp'?-.2:.85,.45,1,-.25,0,-1);}
  else if(k==='bolt')outline.push([.05,1],[-.72,-.12],[-.08,-.12],[-.25,-1],[.74,.18],[.10,.18]);
  else if(k==='crystal')outline.push([0,1],[.6,.4],[.46,-.55],[0,-1],[-.46,-.55],[-.6,.4]);
  else if(k==='maple')outline.push([0,1],[.2,.53],[.55,.72],[.46,.22],[1,.32],[.72,-.12],[.87,-.39],[.24,-.5],[.09,-1],[-.09,-1],[-.24,-.5],[-.87,-.39],[-1,.32],[-.46,.22],[-.55,.72],[-.2,.53]);
  else if(k==='compass'){for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%2?.18:i%4===0?1:.6;outline.push([Math.sin(a)*r,Math.cos(a)*r]);}}
  else if(k==='shell'){s.moveTo(0,-.8);for(let i=0;i<=12;i++){const a=Math.PI*i/12,r=1+(i%2?.1:0);s.lineTo(Math.cos(a)*r,Math.sin(a)*r-.25);}s.closePath();}
  else if(k==='moth'||k==='ribbon'){s.moveTo(0,.2);s.bezierCurveTo(-1,1,-1.1,-.6,0,-.2);s.bezierCurveTo(1.1,-.6,1,1,0,.2);}
  else if(k==='wave'){for(let i=0;i<=30;i++){const x=i/15-1;outline.push([x,Math.sin(x*5)*.27+.26]);}for(let i=30;i>=0;i--){const x=i/15-1;outline.push([x,Math.sin(x*5)*.27-.26]);}}
  else if(['rose','orchid','thistle'].includes(k)){const n=k==='rose'?9:k==='orchid'?5:14;for(let i=0;i<72;i++){const a=i*Math.PI/36,r=.74+.24*Math.cos(a*n);outline.push([Math.cos(a)*r,Math.sin(a)*r]);}}
  else if(['wheat','vine','lavender','reeds','laurel'].includes(k)){
   const leaf=(x,y,rx,ry,turn=0)=>{const q=new T.Shape();for(let i=0;i<16;i++){const a=i*Math.PI/8,xx=Math.cos(a)*rx,yy=Math.sin(a)*ry,p=[x+xx*Math.cos(turn)-yy*Math.sin(turn),y+xx*Math.sin(turn)+yy*Math.cos(turn)];if(i)q.lineTo(...p);else q.moveTo(...p);}q.closePath();shapes.push(q);};
   const stem=new T.Shape();stem.moveTo(-.035,-1);stem.lineTo(.035,-1);stem.lineTo(.035,.96);stem.lineTo(-.035,.96);stem.closePath();shapes.push(stem);
   for(let i=0;i<(k==='wheat'?5:4);i++)for(const side of[-1,1])leaf(side*(k==='reeds'?.43:.23),-.6+i*.38,k==='lavender'?.12:.17,k==='reeds'?.29:.22,side*(k==='laurel'?-.85:.65));
  }else if(k==='pearl'){ball(p,[size*.7,size*.7,size*.5],mat.gem);return;}
  else polygon(k==='snowflake'?6:k==='thorn'?5:5,k==='snowflake'?.28:k==='thorn'?.2:.45);
  if(outline.length){s.moveTo(...outline[0]);for(const a of outline.slice(1))s.lineTo(...a);s.closePath();}
  if(!shapes.length)shapes.push(s);
  add(new T.ExtrudeGeometry(shapes,{depth:.12,steps:1,bevelEnabled:true,bevelSize:.026,bevelThickness:.025,bevelSegments:1,curveSegments:8}),mat.metal,p,normal,size*detailScale);
  if(!['wheat','vine','lavender','reeds','laurel'].includes(k)){const geo=new T.OctahedronGeometry(.19,0);add(geo,mat.gem,p.clone().addScaledVector(normal,size*.25),normal,size);}
  if(d.premiumTheme==='glacier')for(const side of[-1,1]){const geo=new T.OctahedronGeometry(1,0);geo.scale(.025,.09,.025);add(geo,mat.gem,p.clone().add(V(side*.06,.03,.025)),normal);}
  if(d.premiumTheme==='starlight')tube([p.clone().add(V(-size,.08,.02)),p.clone().add(V(0,.14,.02)),p.clone().add(V(size,.095,.02))],.004,mat.metal);
 }
 const outlineOf=f=>{const p=[];for(let i=0;i<=24;i++)p.push(f(i/24,0));for(let i=1;i<=24;i++)p.push(f(1,i/24));for(let i=23;i>=0;i--)p.push(f(i/24,1));for(let i=23;i>0;i--)p.push(f(0,i/24));return p;};
 function pad(){
  const f=(u,v,lift=0)=>{const x=(u*2-1)*.59,a=Math.abs(u*2-1);let front=.43,back=.45;
   if(d.profile==='round'){front*=Math.sqrt(1-.5*a*a);back=front;}
   if(d.profile==='swallowtail')back*=.91+.29*a-.12*Math.cos(u*Math.PI*4);if(d.profile==='shield')back*=1.12-.4*a;if(d.profile==='scallop')back+=.044*Math.cos(u*Math.PI*10);
   const z=-back+(front+back)*v,y=.26-.40*a*a+lift;
   const seam=d.pattern==='quilt'||d.pattern==='lattice'?Math.sin(u*11*Math.PI+v*9*Math.PI)*Math.sin(u*11*Math.PI-v*9*Math.PI):d.pattern==='chevron'?Math.sin(v*26+Math.abs(u-.5)*23):d.pattern==='herringbone'?Math.sin(u*30+(Math.floor(v*10)%2?1:-1)*v*15):Math.sin(u*28+Math.sin(v*16));
   return V(x,y+.008*seam,z);};
  surface((u,v)=>f(u,v),32,26,mat.cloth,.035);surface((u,v)=>f(u,v,-.037),18,16,mat.lining,.008);trim(outlineOf((u,v)=>f(u,v,.008)),.016);
  if(rainbow)for(const side of[0,1])for(let i=0;i<6;i++)surface((u,v)=>f((side?.58:.04)+u*.38,.05+(i+v)/6*.9,.014),8,4,rainbow[i],.004);
  for(let i=1;i<11;i++){const u=i/11;tube(Array.from({length:17},(_,j)=>f(u,j/16,.012)),.0028,mat.lining);}
  if(d.pattern==='quilt'||d.pattern==='lattice')for(let i=1;i<10;i++)tube(Array.from({length:25},(_,j)=>f(j/24,i/10,.012)),.0028,mat.lining);
  for(const sign of[-1,1])emblem(f(sign<0?.12:.88,.3,.03),V(sign*.75,1,0).normalize(),.085);
 }
 function saddle(){
  const size={trail:[.43,.16],roper:[.48,.23],endurance:[.37,.14],show:[.45,.28],barrel:[.39,.25]}[d.profile]||[.43,.20];
  const seat=(u,v)=>V((u*2-1)*(.27+.03*Math.cos(v*Math.PI*2)),.34+.075*(u*2-1)**2+.09*(v*2-1)**2,(v*2-1)*.29);
  surface(seat,22,22,mat.cloth,.048);trim(outlineOf((u,v)=>seat(u,v).add(V(0,.006,0))),.012);
  for(const sign of[-1,1]){
   const skirt=(u,v)=>{let edge=size[0];if(d.profile==='show')edge+=.025*Math.cos(u*Math.PI*6);if(d.profile==='barrel')edge*=1-.13*Math.sin(u*Math.PI);return V(sign*(.25+.23*u),.32-.31*u-.03*Math.cos(v*Math.PI*2),(v*2-1)*edge);};
   surface(skirt,12,22,mat.leather,.035);trim(outlineOf(skirt),.011);
   const fender=(u,v)=>V(sign*(.40+.035*Math.sin(v*Math.PI)),.20-v*.76,.045+(u-.5)*(.23-.07*v)+.03*Math.sin(v*Math.PI));
   surface(fender,8,18,mat.leather,.025);trim(outlineOf(fender),.008);
   surface((u,v)=>fender(.14+u*.72,.13+v*.68).add(V(sign*.018,0,0)),6,10,mat.cloth,.008);
   if(rainbow)for(let i=0;i<6;i++)surface((u,v)=>fender(.14+(i+u)/6*.72,.13+v*.68).add(V(sign*.024,0,0)),2,10,rainbow[i],.006);
   emblem(V(sign*.45,-.08,.05),V(sign,0,0),.087);buckle(V(sign*.445,-.32,.05),.075,.085,V(sign,0,0));
   const iron=V(sign*.44,-.63,.05);ring(iron,.105,mat.metal,V(sign,0,0),.8,1.15);band([[sign*.44,-.72,-.027],[sign*.44,-.72,.127]],.035,mat.leather);
   if(['trail','endurance'].includes(d.profile)){ball(V(sign*.44,.15,-.24),[.10,.13,.14],mat.leather);buckle(V(sign*.535,.18,-.24),.055,.055,V(sign,0,0));}
  }
  // Sweeping raised cantle and padded pommel form a real seat rather than a box.
  const cantle=(u,v)=>{const a=(u-.5)*Math.PI*.93;return V(Math.sin(a)*.31,.42+v*size[1],-.27-Math.cos(a)*.065+v*.03);};
  surface(cantle,24,8,mat.leather,.036);tube(Array.from({length:25},(_,i)=>cantle(i/24,1)),.019,mat.edge);
  const pommel=(u,v)=>V((u*2-1)*.27,.39+Math.sin(u*Math.PI)*.14+v*.03,.27+(v-.5)*.13);surface(pommel,20,6,mat.leather,.04);
  add(new T.CylinderGeometry(.025,.037,.135,16),mat.leather,V(0,.59,.28));ball(V(0,.665,.28),[.064,.022,.05],mat.leather);ring(V(0,.67,.28),.049,mat.metal,V(0,1,0),1,.8);
  for(const sign of[-1,1])emblem(V(sign*.23,.46,.31),V(0,0,1),.052);
  tube([[-.27,.23,.14],[-.38,-.23,.14],[-.20,-.41,.14],[.20,-.41,.14],[.38,-.23,.14],[.27,.23,.14]],.025,mat.leather);
 }
 function bridle(){
  const cheek=[[-.29,-.19,.09],[-.28,.20,0],[-.27,.55,-.08],[-.18,.70,-.12],[.12,.73,-.12],[.27,.56,-.08],[.28,.20,0],[.30,-.19,.09]];
  band(cheek,.055);band(cheek.map(([x,y,z])=>[x,y,z+.012]),.010,mat.edge,.004);
  const drop={classic:.02,browband:.075,crescent:.145,plaited:.06,crown:.10}[d.profile]||.02;
  const brow=Array.from({length:13},(_,i)=>{const u=i/12;return V((u*2-1)*.276,.45-drop*Math.sin(u*Math.PI)+(d.profile==='crown'?.037*Math.cos(u*Math.PI*6):0),-.025);});
  band(brow,.061,mat.cloth);if(rainbow)for(let i=0;i<6;i++)band([brow[i*2].clone().add(V(0,0,.015)),brow[i*2+1].clone().add(V(0,0,.015)),brow[i*2+2].clone().add(V(0,0,.015))],.048,rainbow[i],.004);
  tube(brow.map(p=>p.clone().add(V(0,.03,.012))),.007,mat.metal);if(d.profile==='plaited')tube(brow.map((p,i)=>p.clone().add(V(0,Math.sin(i*2)*.013,.017))),.009,mat.edge);
  band([[-.28,-.08,.08],[-.15,-.12,.23],[.15,-.12,.23],[.29,-.08,.08]],.052);
  band([[-.27,.31,-.055],[-.32,-.10,-.18],[0,-.31,-.24],[.32,-.10,-.18],[.27,.31,-.055]],.026);
  for(const sign of[-1,1]){buckle(V(sign*.285,.11,.02),.068,.083);ring(V(sign*.30,-.20,.10),.057);band([[sign*.32,-.20,.105],[sign*.66,-.36,.16],[sign*.65,-.67,.18],[sign*.30,-.70,.23],[sign*.12,-.39,.25]],.023);}
  tube([[-.25,-.205,.11],[0,-.235,.15],[.25,-.205,.11]],.012,mat.metal);
  emblem(V(0,.445-drop,-.005),V(0,0,1),.075);emblem(V(0,-.12,.27),V(0,0,1),.05);
 }
 function legwear(){
  for(let j=0;j<4;j++){
   const origin=V((j%2?1:-1)*.31,j<2?.20:-.18,j<2?-.20:.21),guard=d.profile==='guards',h=guard?.23:.56,r=guard?.19:.145;
   const at=(x,y,z)=>origin.clone().add(V(x,y,z));
   const profile=[V(r*.80,0),V(r,0),V(r*.92,h*.2),V(r*.83,h),V(r*.66,h),V(r*.64,h*.2),V(r*.80,0)].map(p=>new T.Vector2(p.x,p.y));
   const shell=new T.LatheGeometry(profile,28);shell.scale(1,1,.84);add(shell,d.profile==='plated'?mat.leather:mat.cloth,origin);
   for(const y of[.012,h-.01]){const rr=y<h/2?r*.96:r*.80;ring(at(0,y,0),rr,mat.edge,V(0,1,0),1,.84);}
   if(rainbow)for(let i=0;i<6;i++)surface((u,v)=>{const a=(u*2-1)*Math.PI*.88,yy=(i+v)/6*h,rr=r*(1-.17*yy/h)+.005;return at(Math.sin(a)*rr,yy,Math.cos(a)*rr*.84);},18,2,rainbow[i],.007);
   if(d.profile==='wraps'||d.profile==='ribbon'){
    for(let k=0;k<(guard?2:4);k++)surface((u,v)=>{const a=v*Math.PI*2,yy=.04+k*.115+v*.10+(u-.5)*.032,rr=r*(1-.17*Math.min(1,yy/h))+.009;return at(Math.sin(a)*rr,Math.min(h-.015,yy),Math.cos(a)*rr*.84);},2,24,mat.edge,.005);
   }else for(let k=0;k<(guard?1:3);k++){
    const y=guard?.11:.105+k*.17;
    surface((u,v)=>{const a=(v*2-1)*Math.PI*.88,yy=y+(u-.5)*.065,rr=r*(1-.17*yy/h)+.009;return at(Math.sin(a)*rr,yy,Math.cos(a)*rr*.84);},2,24,d.profile==='plated'?mat.metal:mat.leather,.011);
    buckle(at(.065,y,r*.83),.05,.045);
   }
   emblem(at(0,h*.62,r*.91),V(0,0,1),guard?.055:.062);
  }
 }
 ({saddle,pad,bridle,shoes:legwear}[piece.slot])();
 let triangles=0,vertices=0;
 for(const [material,geometries]of parts){const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)throw Error('Reward geometry merge failed');resources.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.name=piece.slot+' | '+material.name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);vertices+=geometry.attributes.position.count;triangles+=geometry.attributes.position.count/3;}
 // Transform vertices, not the caller's root: root remains centered with identity scale.
 const box=new T.Box3().setFromObject(root),size=box.getSize(V()),center=box.getCenter(V()),scale=1.8/Math.max(size.x,size.y,size.z);
 for(const mesh of root.children){mesh.geometry.translate(-center.x,-center.y,-center.z);mesh.geometry.scale(scale,scale,scale);mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}
 root.updateMatrixWorld(true);const finalBox=new T.Box3().setFromObject(root),dimensions=finalBox.getSize(V()).toArray();
 const fingerprint=JSON.stringify({id:piece.catalogId||piece.id,slot:piece.slot,...d});
 const stats={catalogId:piece.catalogId||piece.id,slot:piece.slot,profile:d.profile,ornament:d.ornament,meshes:root.children.length,triangles,vertices,primitives,dimensions,fingerprint};root.userData.showcase=stats;
 let disposed=false;return {root,stats,dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const r of resources)r.dispose();resources.clear();root.clear();}};
}
