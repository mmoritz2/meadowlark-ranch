import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

// Original lightning-split oak. Closed cut faces reveal the hollow instead of
// covering it with dark cylinders; branch frames follow each curved centreline.
export function createThunderOakGeometry(T,ground=(x,z)=>0){
 let seed=6607;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const V=(x,y,z)=>new T.Vector3(x,y,z),wood=[],scar=[],leafP=[],leafUV=[],leafC=[],leafFlex=[],leafI=[],farI=[],proxies=[];
 const stats={limbs:0,leaves:0,splitFaces:2};
 const fit=p=>{if(p.y<1.15)p.y+=ground(p.x,p.z)*(1-smooth(.05,1.15,p.y));return p;};
 const geo=(p,uv,c,index)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(index);g.computeVertexNormals();return g;};
 function bounds(points){const b=new T.Box3();for(const p of points)b.expandByPoint(p);if(b.max.y-b.min.y>.055)proxies.push({min:b.min.toArray(),max:b.max.toArray(),matrix:new T.Matrix4().toArray()});}
 function shade(p,inside=false){const moss=(1-smooth(.2,1.3,p.y))*.18,light=.82+.08*Math.sin(p.y*.8+p.x*2+p.z);return inside?[.71,.66,.57]:[light-moss*.8,light-moss*.1,light-moss];}
 function tube(points,r0,{end=.015,sides=9,steps=14,collision=false,burnt=false,broken=false}={}){
  stats.limbs++;const curve=new T.CatmullRomCurve3(points),frames=curve.computeFrenetFrames(steps,false),p=[],uv=[],c=[],idx=[],rings=[],length=curve.getLength();
  for(let k=0;k<=steps;k++){const t=k/steps,at=curve.getPointAt(t),r=(end+(r0-end)*Math.pow(1-t,.92))*(.62+.38*smooth(0,.10,t)),ring=[];
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,rad=r*(1+.07*Math.sin(a*5+t*8)+.025*Math.sin(a*11-t*17)),n=frames.normals[k].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[k],Math.sin(a)),point=fit(at.clone().addScaledVector(n,rad));if(broken&&k===steps)point.addScaledVector(curve.getTangentAt(1),r0*.10*Math.sin(j*1.71+points[0].x));ring.push(point);p.push(...point);uv.push(j/sides*Math.PI*2*r0,t*length);c.push(...shade(point,burnt));
    if(k<steps&&j<sides){const b=k*(sides+1)+j,d=b+sides+1;idx.push(b,b+1,d,b+1,d+1,d);}}
   if(collision&&k)bounds([...ring,...rings[k-1]]);rings.push(ring);
  }
  // Irregular branch ends are closed, including the tiny twig tips.
  for(const k of[0,steps]){const point=fit(curve.getPointAt(k/steps)),center=p.length/3;p.push(...point);uv.push(.5,.5);c.push(...shade(point,burnt));
   // Broken faces have a hard bark-to-endgrain seam. Reusing the tube normals
   // would smear their irregular cut into the lateral bark at a blunt end.
   const capStart=p.length/3;
   if(broken)for(let j=0;j<=sides;j++){const source=k*(sides+1)+j;p.push(...p.slice(source*3,source*3+3));uv.push(.5+.5*Math.cos(j/sides*Math.PI*2),.5+.5*Math.sin(j/sides*Math.PI*2));c.push(...c.slice(source*3,source*3+3));}
   for(let j=0;j<sides;j++){const a=broken?capStart+j:k*(sides+1)+j,b=a+1;idx.push(center,...(k===0?[b,a]:[a,b]));}}
  (burnt?scar:wood).push(geo(p,uv,c,idx));return curve;
 }
 function splitShaft(side,points,radii){
  const steps=46,sides=25,curve=new T.CatmullRomCurve3(points),length=curve.getLength(),outer=[],cut=[],ou=[],cu=[],oc=[],cc=[],oi=[],ci=[],rings=[];
  for(let k=0;k<=steps;k++){
   const t=k/steps,at=curve.getPointAt(t),tangent=curve.getTangentAt(t),out=V(side,0,0).addScaledVector(tangent,-tangent.x*side).normalize(),front=tangent.clone().cross(out).normalize();
   const f=t*(radii.length-1),n=Math.min(radii.length-2,Math.floor(f)),r=radii[n]+(radii[n+1]-radii[n])*(f-n),ring=[];
   for(let j=0;j<=sides;j++){const a=-Math.PI*.55+j/sides*Math.PI*1.10,flute=1+.055*Math.sin(a*11+t*10)+.02*Math.sin(a*23-t*17),point=fit(at.clone().addScaledVector(out,Math.cos(a)*r*flute).addScaledVector(front,Math.sin(a)*r*.80*flute));if(k===steps)point.y+=.04*Math.sin(j*.51+side)+.012*Math.sin(j*1.4);outer.push(...point);ou.push(j/sides*Math.PI*1.1*radii[0],t*length);oc.push(...shade(point));ring.push(point);
    if(k<steps&&j<sides){const b=k*(sides+1)+j,d=b+sides+1;oi.push(b,b+1,d,b+1,d+1,d);}}
   // Charred heartwood is recessed and corrugated along the torn grain.
   for(let j=0;j<=10;j++){const u=j/10,point=ring[0].clone().lerp(ring[sides],u).addScaledVector(out,Math.sin(u*Math.PI)*(.27+.035*Math.sin(t*47+u*5))*r);cut.push(...point);cu.push(u*radii[0]*1.6,t*length);cc.push(...shade(point,true));
    if(k<steps&&j<10){const b=k*11+j,d=b+11;ci.push(b,d,b+1,b+1,d,d+1);}}
   if(k&&at.y<7)bounds([...ring,...rings[k-1]]);rings.push(ring);
  }
  // Join the bark and split at the broken tip; the buried base needs no cap.
  const rim=[...rings[steps],...Array.from({length:9},(_,j)=>new T.Vector3().fromArray(cut,(steps*11+9-j)*3))],center=new T.Vector3();for(const p of rim)center.add(p);center.divideScalar(rim.length);
  const tipP=[...center],tipUV=[.5,.5],tipC=[...shade(center,true)],tipI=[];for(const p of rim){tipP.push(...p);tipUV.push((p.x-center.x)*2+.5,(p.z-center.z)*2+.5);tipC.push(...shade(p,true));}for(let j=0;j<rim.length;j++)tipI.push(0,j+1,(j+1)%rim.length+1);
  wood.push(geo(outer,ou,oc,oi));scar.push(geo(cut,cu,cc,ci),geo(tipP,tipUV,tipC,tipI));return curve;
 }
 splitShaft(-1,[V(-.72,-.12,0),V(-.94,2.4,.12),V(-1.48,5.8,-.15),V(-2.4,9.1,.18),V(-3.17,12.3,.32),V(-3.9,14.5,.42)],[1.27,1.15,.93,.64,.38,.24]);
 splitShaft(1,[V(.72,-.12,.10),V(1.03,2.1,.13),V(1.70,5.7,-.22),V(2.54,8.4,-.45),V(2.98,10.6,-.1),V(3.56,12.85,-.35)],[1.23,1.16,.92,.65,.43,.28]);
 // Buttresses join the split to the hill; root tips fit the exact terrain.
 for(let i=0;i<11;i++){const a=i*2.399,reach=2.5+rand()*1.3,s=Math.cos(a)>0?1:-1;const base=V(s*.76,.86,.08),end=V(Math.cos(a)*reach,-.12,Math.sin(a)*reach*.82);
  tube([base,V(end.x*.58,.28,end.z*.58),end],.31+rand()*.15,{end:.035,sides:11,steps:11,collision:true});}
 // Unequal lateral dead scaffolds have blunt storm-torn ends and short crooked
 // side shoots, rather than repeated upward antlers.
 const limbs=[[-1.30,4.8,.1,-6.0,6.6,-1.9,.48],[-1.8,6.7,-.1,-5.6,8.4,2.8,.43],[-2.5,9.5,.15,-6.1,11.0,-1.2,.36],[-3.0,11.7,.3,-6.6,12.25,2.0,.25],[-3.6,13.5,.4,-5.35,14.25,1.4,.18],[1.55,4.9,-.1,5.35,6.8,-2.7,.45],[2.4,8.1,-.4,6.3,8.8,-3.4,.36],[3.0,10.3,-.1,7.0,11.2,1.6,.29],[3.45,12.2,-.25,5.8,13.0,-2.2,.20]];
 for(const row of limbs){const a=V(...row.slice(0,3));a.x+=Math.sign(a.x)*.35;const b=V(...row.slice(3,6)),d=b.clone().sub(a),mid=a.clone().lerp(b,.56).add(V(d.z*.13,.65,-d.x*.10));const curve=tube([a,mid,b],row[6],{end:.055+row[6]*.16,sides:11,steps:18,broken:true});
  for(let j=0;j<3;j++){const t=.47+j*.18,start=curve.getPoint(t),side=j%2?1:-1,end=start.clone().add(V(side*(.50+rand()*1.15),-.35+rand()*.95,(rand()-.5)*1.7));const fork=tube([start,start.clone().lerp(end,.5).add(V(.12,-.18,.09)),end],row[6]*(1-t)*.63,{end:.028,sides:7,steps:10,broken:true});
   for(let k=0;k<2;k++){const s=fork.getPoint(.60+k*.18),e=s.clone().add(V((rand()-.5)*.90,-.28+rand()*.60,(rand()-.5)*.80));tube([s,s.clone().lerp(e,.55).add(V(.08,.05,-.05)),e],.028,{end:.006,sides:5,steps:6});}
  }
 }
 // One low, living bough spreads south from the surviving right-hand stem.
 const living=tube([V(1.90,5.5,.38),V(3.0,6.7,2.1),V(1.8,8.3,5.1),V(-.4,8.45,6.4)],.48,{end:.035,sides:12,steps:22});
 function leaf(at,heading,tilt,length,width,flex){
  const axis=V(Math.cos(heading)*Math.sin(tilt),Math.cos(tilt),Math.sin(heading)*Math.sin(tilt)),right=V(-Math.sin(heading),0,Math.cos(heading)),normal=axis.clone().cross(right).normalize(),base=leafP.length/3,light=.66+rand()*.33;
  const outline=[[0,0],[-.20,.13],[-.42,.21],[-.29,.31],[-.50,.42],[-.34,.52],[-.44,.65],[-.27,.75],[-.29,.84],[0,1],[.29,.84],[.27,.75],[.44,.65],[.34,.52],[.50,.42],[.29,.31],[.42,.21],[.20,.13]];
  const put=(x,y,crease)=>{const p=at.clone().addScaledVector(axis,y*length).addScaledVector(right,x*width).addScaledVector(normal,(crease+Math.sin(y*Math.PI)*.075)*width);leafP.push(...p);leafUV.push(x+.5,y);leafC.push(light*.86,light,light*.69);leafFlex.push(flex);};
  for(const[x,y]of outline)put(x,y,0);put(0,.48,.075);
  for(let i=0;i<outline.length;i++)leafI.push(base+18,base+i,base+(i+1)%18);
  // The far silhouette keeps every leaf, tip and widest lobe, with fewer notches.
  const rim=[0,2,4,6,8,9,10,12,14,16];for(let i=1;i<rim.length-1;i++)farI.push(base+rim[0],base+rim[i],base+rim[i+1]);stats.leaves++;
 }
 for(let i=0;i<15;i++){
  const f=.22+i*.052,start=living.getPoint(f),side=i%2?1:-1,spread=.9+rand()*1.5,end=start.clone().add(V(side*spread*.95,.20+rand()*1.15,side*spread*.30));
  const twig=tube([start,start.clone().lerp(end,.55).add(V(.2,.45,.12)),end],.10*(1-f)+.015,{end:.012,sides:7,steps:10});
  for(let j=0;j<9;j++){
   const t=.28+j*.077,anchor=twig.getPoint(t),a=rand()*Math.PI*2,reach=.42+rand()*.56,tip=anchor.clone().add(V(Math.cos(a)*reach,.2+rand()*.45,Math.sin(a)*reach));
   const shoot=tube([anchor,anchor.clone().lerp(tip,.48),tip],.016,{end:.003,sides:4,steps:4});
   for(let k=0;k<20;k++){const u=.20+.76*Math.pow((k+.5)/20,.65),at=shoot.getPoint(u),head=a+k*2.399;leaf(at,head,1.2+rand()*1.8,.20+rand()*.16,.145+rand()*.095,t);}
  }
 }
 const bark=mergeGeometries(wood,false),heart=mergeGeometries(scar,false);[...wood,...scar].forEach(g=>g.dispose());const leaves=geo(leafP,leafUV,leafC,leafI);leaves.setAttribute('oakFlex',new T.Float32BufferAttribute(leafFlex,1));const farLeaves=leaves.clone();farLeaves.setIndex(farI);
 // The upper weathered crown is broad and broken, while the original split
 // root plate and every shaft vertex below7m keep their exact ground/contact fit.
 // A monotone height transform also updates the recorded upper proxy extents.
 const crownY=y=>y<=7?y:y-.20*(y-7)*smooth(0,4,y-7);
 for(const g of[bark,heart,leaves,farLeaves]){
  const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,crownY(p.getY(i)));
  if(g===farLeaves)g.setAttribute('normal',leaves.attributes.normal.clone());else g.computeVertexNormals();
  g.computeBoundingBox();g.computeBoundingSphere();
 }
 for(const proxy of proxies){proxy.min[1]=crownY(proxy.min[1]);proxy.max[1]=crownY(proxy.max[1]);}
 stats.woodTriangles=(bark.index.count+heart.index.count)/3;stats.leafTriangles=leafI.length/3;stats.farLeafTriangles=farI.length/3;
 return{bark,heart,leaves,farLeaves,proxies,stats};
}

export async function installThunderOak(G,wind){
 const T=G.THREE,W=G.world,L=G.vistas?.LAND.find(l=>l.id==='thunderoak');if(!L)return null;
 const loader=new T.TextureLoader(),textures=await Promise.all(['diff','nor_gl','rough'].map(role=>loader.loadAsync('./assets/textures/landmarks/bark_brown_02_'+role+'.webp')));
 textures.forEach((t,i)=>{t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());if(i===0)t.colorSpace=T.SRGBColorSpace;});
 const bark=new T.MeshStandardMaterial({name:'Thunder Oak | furrowed bark',map:textures[0],normalMap:textures[1],normalScale:new T.Vector2(.75,.75),roughnessMap:textures[2],roughness:1,color:'#cec3b1',vertexColors:true});
 const heart=bark.clone();heart.name='Thunder Oak | scorched heartwood';heart.color.set('#66513f');heart.normalScale.set(.38,.38);heart.side=T.DoubleSide;
 const leaf=new T.MeshStandardMaterial({name:'Thunder Oak | lobed oak leaves',color:'#819955',vertexColors:true,side:T.DoubleSide,roughness:.92,envMapIntensity:.45});
 const deform=sh=>{sh.uniforms.oakWind=wind;sh.vertexShader='attribute float oakFlex;uniform float oakWind;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed.x+=sin(oakWind*.83+position.x*.62+position.z)*oakFlex*.065;transformed.z+=cos(oakWind*.64+position.z*.76)*oakFlex*.043;`);};
 leaf.onBeforeCompile=sh=>{deform(sh);sh.vertexShader='varying vec2 oakUV;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\noakUV=uv;');sh.fragmentShader='varying vec2 oakUV;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat vein=1.0-smoothstep(.010,.043,abs(oakUV.x-.5));diffuseColor.rgb*=.94+vein*.095;');sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,mat3(viewMatrix)*vec3(0.0,1.0,0.0),.24));');};leaf.customProgramCacheKey=()=> 'thunder-oak-leaf-1';
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});depth.onBeforeCompile=deform;depth.customProgramCacheKey=()=> 'thunder-oak-depth-1';
 const source=createThunderOakGeometry(T,(x,z)=>W.groundH(L.x+x,L.z+z)-L.y),root=new T.Group();root.name='Thunder Oak | weathered split oak';root.userData.solidParts=source.proxies.slice();
 const add=(g,m,name)=>{const o=new T.Mesh(g,m);o.name=name;o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 add(source.bark,bark,'Thunder Oak | curved limbs and buttresses');add(source.heart,heart,'Thunder Oak | lightning split');const crown=add(source.leaves,leaf,'Thunder Oak | surviving bough');crown.customDepthMaterial=depth;
 // The nearby shrine keeps its authored position and three ribbon posts.
 const mats=W.ranchBuilderArt.materials;
 const proxyBox=(g,matrix)=>{g.computeBoundingBox();root.userData.solidParts.push({min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray(),matrix:matrix.toArray()});};
 const batches=new Map();const piece=(g,m,x,y,z,rx=0,ry=0,rz=0)=>{const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1));proxyBox(g,matrix);g.applyMatrix4(matrix);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);};
 for(let i=0;i<3;i++){const x=2+i*1.4,z=4.4-i*.5,y=W.groundH(L.x+x,L.z+z)-L.y;
  piece(new T.CylinderGeometry(.067,.10,1.9,10),mats.aged,x,y+.90,z,0,i*.42,.025*(i-1));piece(new T.BoxGeometry(.17,.05,.17),mats.oak,x,y+1.87,z);}
 const stones=[[3.4,2.2,1.7,1.20,1.30],[-3.4,3.3,.70,.38,.54],[4.9,-3.7,.55,.29,.43],[-5.5,-1.5,.47,.25,.64]];
 for(let i=0;i<stones.length;i++){const[x,z,w,h,d]=stones[i],g=new T.IcosahedronGeometry(1,2),p=g.attributes.position;for(let k=0;k<p.count;k++){const px=p.getX(k),py=p.getY(k),pz=p.getZ(k),n=1+.095*Math.sin(px*7+pz*8+py*6);p.setXYZ(k,px*w*n,py*h*n,pz*d*n);}g.computeVertexNormals();piece(g,mats.stone,x,W.groundH(L.x+x,L.z+z)-L.y+h*.62,z,0,.7+i,0);}
 for(const [m,parts]of batches){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());add(g,m,'Thunder Oak | '+m.name);}
 const ribbonP=[],ribbonC=[],ribbonFlex=[],ribbonI=[],palette=['#ad5141','#536f9c','#c6aa65','#719466'],color=new T.Color();
 for(let i=0;i<3;i++)for(let j=0;j<4;j++){const x=2+i*1.4,z=4.4-i*.5,y=W.groundH(L.x+x,L.z+z)-L.y+1.68-j*.04,len=.53+j*.09,offset=ribbonP.length/3;color.set(palette[j]);for(let k=0;k<=8;k++)for(const side of[-1,1]){const t=k/8;ribbonP.push(x+side*.034+j*.04+Math.sin(t*4+i)*.055,y-t*len,z+.1+Math.sin(t*3+j)*.09);ribbonC.push(color.r,color.g,color.b);ribbonFlex.push(t);}for(let k=0;k<8;k++){const a=offset+k*2;ribbonI.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const ribbonGeo=new T.BufferGeometry();ribbonGeo.setAttribute('position',new T.Float32BufferAttribute(ribbonP,3));ribbonGeo.setAttribute('color',new T.Float32BufferAttribute(ribbonC,3));ribbonGeo.setAttribute('oakFlex',new T.Float32BufferAttribute(ribbonFlex,1));ribbonGeo.setIndex(ribbonI);ribbonGeo.computeVertexNormals();const ribbonMat=new T.MeshStandardMaterial({name:'Thunder Oak | tied cloth ribbons',vertexColors:true,side:T.DoubleSide,roughness:1});ribbonMat.onBeforeCompile=deform;ribbonMat.customProgramCacheKey=()=> 'thunder-oak-ribbons-1';const ribbons=add(ribbonGeo,ribbonMat,'Thunder Oak | twelve wishes');ribbons.customDepthMaterial=depth;
 L.g.add(root);L.mesh.visible=false;W.solidWorld.register(root);
 // Camera obstruction only follows the low wood; the wide crown never becomes a wall.
 const cameraParts=new T.Group();cameraParts.position.copy(L.g.position);cameraParts.userData.collisionIgnore=true;
 for(const p of root.userData.solidParts){const box=new T.Box3(new T.Vector3(...p.min),new T.Vector3(...p.max)).applyMatrix4(new T.Matrix4().fromArray(p.matrix)),min=box.min,max=box.max;if(min.y>4.8||max.y-min.y<.18)continue;const g=new T.BoxGeometry(...max.clone().sub(min).toArray()),o=new T.Mesh(g,bark);o.position.copy(min.add(max).multiplyScalar(.5));cameraParts.add(o);}
 W.followCamera.register(cameraParts);
 let total=0,draws=0;root.traverse(o=>{if(o.isMesh){total+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;draws++;}});source.stats.nearTotalTriangles=total;source.stats.farTotalTriangles=total-source.stats.leafTriangles+source.stats.farLeafTriangles;source.stats.draws=draws;
 const state={root,source,cameraParts,stats:source.stats,site:{x:L.x,y:L.y,z:L.z},triangles:0,near:true};
 state.update=()=>{const p=G.horse.player.pos,tier=G.gfx.get(),near=tier!=='low'&&!G.renderer.xr.isPresenting&&Math.hypot(p.x-L.x,p.z-L.z)<(tier==='high'?72:45)+(state.near?6:0);crown.geometry=near?source.leaves:source.farLeaves;state.near=near;state.triangles=source.stats.woodTriangles+(near?source.stats.leafTriangles:source.stats.farLeafTriangles);};state.update();return state;
}
