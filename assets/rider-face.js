import {createTriangleSurface} from './rider-head-surface.js?v=couture-riders-20261007';
/* Bind-pose facial refinements. Joint locations, weights and the scalp stay fixed,
   so the existing animations, helmet and saved appearances continue to fit. */
export function refineRiderFace(THREE,skin,brows,body){
 const geometry=skin.geometry;if(geometry.userData.faceRefined)return;geometry.userData.faceRefined=true;
 const head=skin.skeleton.bones.findIndex(b=>b.name==='Head'),inverse=skin.skeleton.boneInverses[head],bind=inverse.clone().invert(),p=geometry.attributes.position,v=new THREE.Vector3();
 const bell=(x,center,width)=>Math.exp(-1*((x-center)/width)**2);
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).applyMatrix4(inverse);
  if(v.y<-.015||v.y>.13||v.z<.038)continue;
  const cheek=bell(Math.abs(v.x),.046,.027)*bell(v.y,body==='f'?.066:.055,.030);
  const nose=bell(v.x,0,.012)*bell(v.y,.084,.032)*Math.max(0,Math.min(1,(v.z-.090)/.025));
  // Fill the sharply cut cheek plane a little and soften the projecting nose tip.
  if(body==='f'){const jaw=bell(v.y,.022,.036)*Math.min(1,Math.abs(v.x)/.040);v.x*=1-.045*jaw;}
  const lip=bell(v.x,0,.024)*bell(v.y,.032,.008);
  v.z+=cheek*(body==='f'?.0035:.0018)-nose*(body==='f'?.0034:.0025)+(body==='f'?lip*.0012:0);
  v.applyMatrix4(bind);p.setXYZ(i,v.x,v.y,v.z);
 }
 p.needsUpdate=true;smoothNormals(geometry);geometry.computeBoundingSphere();
 if(!brows)return;
 const bp=brows.geometry.attributes.position;let min=Infinity,max=0,mean=0;
 for(let i=0;i<bp.count;i++){const x=Math.abs(bp.getX(i));min=Math.min(min,x);max=Math.max(max,x);mean+=bp.getY(i);}mean/=bp.count;
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surface=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,0,-1);surface.updateMatrixWorld(true);
 const positions=[],uv=[],joints=[],weights=[],indices=[],columns=32,rows=5,joint=brows.skeleton.bones.findIndex(b=>b.name==='Head');
 for(const side of [-1,1]){const offset=positions.length/3;
  for(let i=0;i<=columns;i++){const t=i/columns,x=side*(min+(max-min)*t),center=mean+.003+.006*Math.sin(t*Math.PI)-.004*t;
   const width=(body==='m'?.0038:.0032)*Math.pow(Math.max(.015,1-t),.50)*(.8+.2*Math.sin(t*Math.PI));
   for(let j=0;j<rows;j++){const across=j/(rows-1)*2-1,y=center+across*width;
    ray.set(new THREE.Vector3(x,y,.6),direction);const hit=ray.intersectObject(surface,false)[0];
    positions.push(x,y,(hit?hit.point.z:.09)+.0006+.0007*(1-across*across));uv.push(t,j/(rows-1));joints.push(joint,0,0,0);weights.push(1,0,0,0);
    if(i<columns&&j<rows-1){const k=offset+i*rows+j;side>0?indices.push(k,k+rows,k+1,k+1,k+rows,k+rows+1):indices.push(k,k+1,k+rows,k+1,k+rows+1,k+rows);}
   }
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();brows.geometry=geo;material.dispose();

}
function smoothNormals(geometry){
 geometry.computeVertexNormals();const p=geometry.attributes.position,n=geometry.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(!groups.has(key))groups.set(key,{indices:[],x:0,y:0,z:0});const g=groups.get(key);g.indices.push(i);g.x+=n.getX(i);g.y+=n.getY(i);g.z+=n.getZ(i);}
 for(const g of groups.values()){const length=Math.hypot(g.x,g.y,g.z)||1;for(const i of g.indices)n.setXYZ(i,g.x/length,g.y/length,g.z/length);}n.needsUpdate=true;
}

/* Soft, skin-tone-relative makeup in head bind space, so it follows the face
   through every pose and keeps the selected complexion. */
export const RIDER_FACE_GLSL=`
uniform float uRunway;
varying vec3 vFace;
float riderLip(vec3 p){
 return exp(-pow(abs(p.x)/.024,4.0)-pow((p.y-.032)/.008,4.0))*smoothstep(.070,.095,p.z);
}
vec3 riderFaceFinish(vec3 skin,vec3 source,vec3 p){
 float face=uRunway*smoothstep(.035,.080,p.z)*smoothstep(-.010,.018,p.y)*(1.0-smoothstep(.155,.195,p.y));
 float lum=dot(source,vec3(.2126,.7152,.0722)),ref=dot(uSkinRef,vec3(.2126,.7152,.0722));
 vec3 chroma=(source/max(lum,.001))/(uSkinRef/ref);
 vec3 evenSkin=uSkin*pow(max(lum/ref,.02),.33)*mix(vec3(1.0),chroma,.49);
 skin=mix(skin,evenSkin,face*.75);
 float blush=exp(-pow((abs(p.x)-.052)/.022,2.0)-pow((p.y-.070)/.020,2.0));
 skin=mix(skin,uSkin*vec3(1.02,.74,.77),face*blush*.14);
 float lip=riderLip(p)*smoothstep(.17,.38,lum/ref);
 vec3 rose=uSkin*vec3(.87,.43,.49)+vec3(.020,.002,.006);
 skin=mix(skin,rose,face*lip*.58);
 float eye=(abs(p.x)-.034)/.022,arch=.101+.006*sqrt(max(0.0,1.0-eye*eye));
 float liner=exp(-pow((p.y-arch)/.0015,2.0))*(1.0-smoothstep(.78,1.0,abs(eye)));
 skin=mix(skin,vec3(.040,.022,.019),face*liner*.46);
 return skin;
}`;

/* Tapered upper lashes, fitted to the face in the Head bone's space. */
export function riderLashGeometry(THREE,skin,eyes,body,asset=null){
 if(body!=='f'||!eyes)return null;
 const head=skin.skeleton.bones.findIndex(b=>b.name==='Head'),inverse=skin.skeleton.boneInverses[head];
 const face=skin.geometry.clone();face.applyMatrix4(inverse);
 // Restrict fitting rays to the eye region; the full body is unnecessary here.
 const eyeY=asset?.config.target[1]??.109,eyeX=asset?.config.target[0]??.035,minY=asset?eyeY-.01:.099,maxY=asset?eyeY+.033:.120,maxX=asset?eyeX+.03:.051;
 const p=face.attributes.position,source=face.index?Array.from(face.index.array):Array.from({length:p.count},(_,i)=>i),region=[];
 for(let i=0;i<source.length;i+=3){const tri=source.slice(i,i+3),xs=tri.map(n=>p.getX(n)),ys=tri.map(n=>p.getY(n));
  if(Math.min(...xs)<=maxX&&Math.max(...xs)>=-maxX&&Math.min(...ys)<=maxY+.001&&Math.max(...ys)>=minY-.001&&tri.some(n=>p.getZ(n)>.04))region.push(...tri);
 }
 face.setIndex(region);
 const surface=createTriangleSurface(THREE,face);
 const eyeGeometry=eyes.geometry.clone(),eyeHead=eyes.skeleton.bones.findIndex(b=>b.name==='Head');eyeGeometry.applyMatrix4(eyes.skeleton.boneInverses[eyeHead]);
 const eyeSurface=createTriangleSurface(THREE,eyeGeometry);
 const positions=[],indices=[],roots=[],segments=7,sides=6,V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const front=(mesh,x,y)=>{return mesh.cast(V(x,y,.3),V(0,0,-1));};
 for(const side of [-1,1])for(let i=0;i<16;i++){
  const t=[.02,.07,.13,.20,.245,.30,.42,.47,.52,.64,.68,.73,.83,.87,.93,1][i],x=side*(asset?eyeX-.017+.037*t:.020+.030*t);let exposed=false,root=null;
  // Find where the visible eye meets the upper lid instead of guessing an arc.
  for(let y=minY;y<=maxY;y+=.0001){const skinHit=front(surface,x,y),eyeHit=front(eyeSurface,x,y);if(!skinHit||!eyeHit)continue;
   if(skinHit.point.z<eyeHit.point.z){exposed=true;continue;}
   if(exposed){root=V(x,y,skinHit.point.z+.0002);break;}
  }
  if(!root)continue;
  // A graduated, softly staggered fan keeps the longer outer lashes readable.
  const stagger=[.89,1.04,.96,.92][i%4],length=(.0037+.0116*Math.pow(t,.8))*stagger,fan=side*(.0003+.0070*t+[.0002,-.0001,.0001,-.0002][i%4]),base=positions.length/3;
  const curve=new THREE.QuadraticBezierCurve3(root,root.clone().add(V(fan*.30,length*.06,length*.62)),root.clone().add(V(fan,length*.74,length*.76)));
  roots.push(root.toArray());
  for(let j=0;j<=segments;j++){
   const u=j/segments,p=curve.getPoint(u),tangent=curve.getTangent(u).normalize(),normal=V(1,0,0).addScaledVector(tangent,-tangent.x).normalize(),binormal=tangent.clone().cross(normal),r=.00027*Math.pow(1-u,.9)+.000018;
   for(let k=0;k<sides;k++){const angle=k*Math.PI*2/sides,v=p.clone().addScaledVector(normal,Math.cos(angle)*r).addScaledVector(binormal,Math.sin(angle)*r);positions.push(...v.toArray());
    if(j<segments){const a=base+j*sides+k,b=base+j*sides+(k+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
   }
  }
 }
 // Join the strands with a fine fitted upper-lid line for a readable dark base.
 for(const side of [-1,1]){
  const lid=roots.filter(p=>Math.sign(p[0])===side).map(p=>V(...p));
  if(lid.length<2)continue;
  const line=new THREE.CatmullRomCurve3(lid),band=new THREE.TubeGeometry(line,32,.00035,6,false),offset=positions.length/3,points=band.attributes.position;
  for(let i=0;i<points.count;i++){
   const t=Math.floor(i/7)/32,center=line.getPointAt(t),taper=.08+.92*Math.min(1,t/.12,(1-t)/.12);
   const point=new THREE.Vector3().fromBufferAttribute(points,i).sub(center).multiplyScalar(taper).add(center);positions.push(...point.toArray());
  }
  for(const i of band.index.array)indices.push(offset+i);band.dispose();
 }
 surface.dispose();eyeSurface.dispose();face.dispose();eyeGeometry.dispose();
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();geo.userData.lashRoots=roots;geo.userData.lashStyle={strands:roots.length,lengthM:[.0037,.0159],radiusM:.000288,fan:'graduated-outward'};return geo;
}
