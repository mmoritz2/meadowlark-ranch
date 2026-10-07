/* Artist-authored CC0 heads from Blender Studio, fitted to the shared rider rig.
   Only the neck transition inherits body weights; face, eyes and brows follow Head. */
const SOURCE={
 f:{eye:[.047546,1.46305735,.09338943],scale:[.72,.72,.78],target:[.034233,.099,.065],cut:-.075,mouth:.0374},
 m:{eye:[.041604,1.63004830,.09728113],scale:[.78,.65,.78],target:[.032451,.094,.078],cut:-.050,mouth:.0353}
};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const comp=(a,i,k)=>a[['getX','getY','getZ','getW'][k]](i);
function smoothNormals(THREE,geo){
 geo.deleteAttribute('tangent');geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,buckets=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
 for(const ids of buckets.values()){const sum=new THREE.Vector3();for(const i of ids)sum.add(new THREE.Vector3().fromBufferAttribute(n,i));sum.normalize();for(const i of ids)n.setXYZ(i,sum.x,sum.y,sum.z);}
 geo.computeBoundingBox();geo.computeBoundingSphere();
}
function weighted(THREE,geo,skin,headIndex,bind,weights){
 geo.applyMatrix4(bind);const joints=[],values=[];
 for(let i=0;i<geo.attributes.position.count;i++){const sample=weights?.[i]||[[headIndex,1]],ranked=sample.filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),total=ranked.reduce((sum,v)=>sum+v[1],0)||1;while(ranked.length<4)ranked.push([0,0]);joints.push(...ranked.map(v=>v[0]));values.push(...ranked.map(v=>v[1]/total));}
 geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));smoothNormals(THREE,geo);
 const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.56,metalness:0}));mesh.bind(skin.skeleton,skin.bindMatrix);mesh.frustumCulled=false;return mesh;
}
/* Keep every original body vertex index stable, including its foot-contact samples.
   New neck-boundary vertices interpolate all source attributes and normalized weights. */
function clipOldHead(THREE,skin,inverse,cut){
 const old=skin.geometry,attrs=old.attributes,positions=attrs.position,local=[],arrays={},edges=new Map(),faces=[];
 for(let i=0;i<positions.count;i++)local.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(inverse));
 for(const [key,a]of Object.entries(attrs))if(key!=='tangent'){arrays[key]=[];for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)arrays[key].push(comp(a,i,k));}
 const field=i=>Math.max(cut-local[i].y,Math.abs(local[i].x)-.15);
 const intersection=(a,b,fa,fb)=>{
  const key=a<b?a+':'+b:b+':'+a;if(edges.has(key))return edges.get(key);
  const t=fa/(fa-fb),i=arrays.position.length/3,weights=new Map();
  for(const [key,attr]of Object.entries(attrs))if(key!=='tangent'&&!['skinIndex','skinWeight'].includes(key))for(let k=0;k<attr.itemSize;k++)arrays[key].push(comp(attr,a,k)*(1-t)+comp(attr,b,k)*t);
  for(const [v,weight]of [[a,1-t],[b,t]])for(let k=0;k<4;k++){const j=comp(attrs.skinIndex,v,k);weights.set(j,(weights.get(j)||0)+comp(attrs.skinWeight,v,k)*weight);}
  const ranked=[...weights].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,v)=>n+v[1],0)||1;while(ranked.length<4)ranked.push([0,0]);arrays.skinIndex.push(...ranked.map(v=>v[0]));arrays.skinWeight.push(...ranked.map(v=>v[1]/sum));
  local.push(local[a].clone().lerp(local[b],t));edges.set(key,i);return i;
 };
 const idx=old.index?Array.from(old.index.array):Array.from({length:positions.count},(_,i)=>i);
 for(let i=0;i<idx.length;i+=3){const tri=idx.slice(i,i+3),poly=[];for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],fa=field(a),fb=field(b);if(fa>=0)poly.push(a);if((fa>=0)!==(fb>=0))poly.push(intersection(a,b,fa,fb));}for(let k=1;k<poly.length-1;k++)faces.push(poly[0],poly[k],poly[k+1]);}
 const geo=new THREE.BufferGeometry();for(const [key,data]of Object.entries(arrays)){const a=attrs[key];geo.setAttribute(key,key==='skinIndex'?new THREE.Uint16BufferAttribute(data,a.itemSize):new THREE.Float32BufferAttribute(data,a.itemSize));}geo.setIndex(faces);geo.userData={...old.userData,headReplaced:true,neckSeam:cut,originalVertexCount:positions.count};geo.computeBoundingBox();geo.computeBoundingSphere();skin.geometry=geo;
}
function merge(THREE,geometries){
 const p=[],uv=[],idx=[];for(const geo of geometries){const offset=p.length/3;p.push(...geo.attributes.position.array);if(geo.attributes.uv)uv.push(...geo.attributes.uv.array);else uv.push(...new Float32Array(geo.attributes.position.count*2));for(const i of geo.index?geo.index.array:Array.from({length:geo.attributes.position.count},(_,i)=>i))idx.push(offset+i);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);return geo;
}
/* A shared boundary closes the join exactly, even when the two source meshes
   have different ring counts. The narrow transition inherits the body's weights. */
function stitchNeck(THREE,headGeometry,weights,skin,inverse,cut,sampleNeck){
 const hp=headGeometry.attributes.position,uv=headGeometry.attributes.uv,indices=Array.from(headGeometry.index.array),body=skin.geometry,bp=body.attributes.position,used=new Set(body.index.array),upper=[],lower=[],seenTop=new Set(),seenBottom=new Set(),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),angle=p=>(Math.atan2(p.x,p.z+.03)+Math.PI*2)%(Math.PI*2);
 const P=[],UV=[];
 for(let i=0;i<hp.count;i++){
  const p=V().fromBufferAttribute(hp,i);if(Math.abs(p.y-cut)<.00001){const key=[p.x,p.z].map(v=>Math.round(v*1e6)).join(',');if(!seenTop.has(key)){seenTop.add(key);upper.push({id:i,a:angle(p)});}p.y+=.016;const hit=sampleNeck(p);if(hit){p.x=hit.point.x;p.z=hit.point.z;weights[i]=hit.weights;}}
  P.push(...p.toArray());UV.push(uv?.getX(i)||0,uv?.getY(i)||0);
 }
 for(const i of used){const p=V().fromBufferAttribute(bp,i).applyMatrix4(inverse);if(Math.abs(p.y-cut)>.00001||Math.abs(p.x)>.15)continue;const key=[p.x,p.z].map(v=>Math.round(v*1e6)).join(',');if(seenBottom.has(key))continue;seenBottom.add(key);
  const id=P.length/3;P.push(...p.toArray());UV.push(angle(p)/(Math.PI*2),0);const w=[];for(let k=0;k<4;k++)w.push([comp(body.attributes.skinIndex,i,k),comp(body.attributes.skinWeight,i,k)]);weights.push(w);lower.push({id,bodyId:i,a:angle(p)});
 }
 if(upper.length<8||lower.length<8)throw Error('Rider neck boundary is incomplete');upper.sort((a,b)=>a.a-b.a);lower.sort((a,b)=>a.a-b.a);
 let i=0,j=0;while(i<upper.length||j<lower.length){const top=upper[i%upper.length],bottom=lower[j%lower.length],nt=i<upper.length?(i+1===upper.length?upper[0].a+Math.PI*2:upper[i+1].a):Infinity,nb=j<lower.length?(j+1===lower.length?lower[0].a+Math.PI*2:lower[j+1].a):Infinity;
  if(nt<=nb){indices.push(top.id,bottom.id,upper[(i+1)%upper.length].id);i++;}else{indices.push(top.id,bottom.id,lower[(j+1)%lower.length].id);j++;}
 }
 headGeometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));headGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));headGeometry.deleteAttribute('normal');headGeometry.setIndex(indices);headGeometry.userData.neckBoundary=lower.map(v=>v.id);headGeometry.userData.neckBodyBoundary=lower.map(v=>v.bodyId);return lower.length;
}

export function prepareRiderHead(THREE,skin,oldEyes,oldBrows,source,body){
 const cfg=SOURCE[body],bones=skin.skeleton.bones,hi=bones.findIndex(b=>b.name==='Head'),inverse=skin.skeleton.boneInverses[hi],bind=inverse.clone().invert(),V=(x,y,z)=>new THREE.Vector3(x,y,z);
 source.updateMatrixWorld(true);let headSource;const eyeSources=[];source.traverse(m=>{if(!m.isMesh)return;const geo=m.geometry.clone().applyMatrix4(m.matrixWorld);if(/head/.test(m.name))headSource=geo;else if(/eye/.test(m.name))eyeSources.push(geo);});if(!headSource||eyeSources.length!==2)throw Error('Stylized rider head parts missing');
 const original=skin.geometry.clone().applyMatrix4(inverse),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surface=new THREE.Mesh(original,material);surface.updateMatrixWorld(true);const ray=new THREE.Raycaster(),a=V(),b=V(),c=V(),bary=V();
 const oldSkinWeights=hit=>{const f=hit.face,p=original.attributes.position;a.fromBufferAttribute(p,f.a);b.fromBufferAttribute(p,f.b);c.fromBufferAttribute(p,f.c);THREE.Triangle.getBarycoord(hit.point,a,b,c,bary);const weights=new Map();for(const [i,t]of [[f.a,bary.x],[f.b,bary.y],[f.c,bary.z]])for(let k=0;k<4;k++){const j=comp(original.attributes.skinIndex,i,k);weights.set(j,(weights.get(j)||0)+comp(original.attributes.skinWeight,i,k)*t);}return weights;};
 const map=p=>V(p.x*cfg.scale[0],(p.y-cfg.eye[1])*cfg.scale[1]+cfg.target[1],(p.z-cfg.eye[2])*cfg.scale[2]+cfg.target[2]);
 const refineEyes=p=>{const dx=(Math.abs(p.x)-cfg.target[0])/.030,dy=(p.y-cfg.target[1])/.028,region=Math.exp(-Math.pow(dx,4)-Math.pow(dy,4))*smooth(.045,.070,p.z);p.y=cfg.target[1]+(p.y-cfg.target[1])*(1-region*(body==='f'?.18:.20));return p;};
 const sampleNeck=p=>{const center=V(0,p.y,-.03),dir=p.clone().sub(center);dir.y=0;dir.normalize();ray.set(center.clone().addScaledVector(dir,.4),dir.clone().negate());const hit=ray.intersectObject(surface,false)[0];if(hit)hit.weights=[...oldSkinWeights(hit)];return hit;};
 const baseY=(headSource.boundingBox|| (headSource.computeBoundingBox(),headSource.boundingBox)).min.y,baseLocal=map(V(0,baseY,0)).y,weights=[],hp=headSource.attributes.position;
 for(let i=0;i<hp.count;i++){
  const src=V().fromBufferAttribute(hp,i),p=refineEyes(map(src));
  if(body==='m'){const nose=Math.exp(-Math.pow(p.x/.025,4)-Math.pow((p.y-.063)/.026,4));p.z-=Math.max(0,p.z-.103)*.11*nose;}
  // Bring the ear lobes into the same measured envelope as the rider hair/helmet.
  if(Math.abs(src.x)>.105)p.x=Math.sign(src.x)*(.105+(Math.abs(src.x)-.105)*.62)*cfg.scale[0];
  const jawGuard=smooth(baseLocal+.002,baseLocal+.010,p.y)*smooth(.045,.075,p.z),neck=(1-smooth(baseLocal,.030,p.y))*(1-jawGuard);
  p.y+=(cfg.cut-baseLocal)*neck;
  let w=new Map([[hi,1]]);
  if(neck>.001){const center=V(0,Math.min(p.y,-.035),-.03),dir=p.clone().sub(center);dir.y=0;dir.normalize();ray.set(center.clone().addScaledVector(dir,.4),dir.clone().negate());const hit=ray.intersectObject(surface,false)[0];
   if(hit){const fit=1-smooth(cfg.cut,.027,p.y);p.x=p.x*(1-fit)+hit.point.x*fit;p.z=p.z*(1-fit)+hit.point.z*fit;const old=oldSkinWeights(hit);w=new Map([...old].map(([j,n])=>[j,n*fit]));w.set(hi,(w.get(hi)||0)+1-fit);}
  }
  weights.push([...w]);hp.setXYZ(i,p.x,p.y,p.z);
 }
 const garmentSkin={geometry:skin.geometry,skeleton:skin.skeleton,bindMatrix:skin.bindMatrix};
 clipOldHead(THREE,skin,inverse,cfg.cut);
 const seamCount=stitchNeck(THREE,headSource,weights,skin,inverse,cfg.cut,sampleNeck);
 const headLocal=headSource.clone();smoothNormals(THREE,headLocal);
 const head=weighted(THREE,headSource,skin,hi,bind,weights);
 // Preserve the body's smooth surface normal at the shared boundary. Otherwise
 // two individually smoothed meshes produce a visible horizontal lighting seam.
 const normals=head.geometry.attributes.normal,bodyNormals=skin.geometry.attributes.normal,headPositions=head.geometry.attributes.position;
 const normalMatrix=new THREE.Matrix3().getNormalMatrix(bind),sourceNormals=original.attributes.normal;
 for(let i=0;i<headPositions.count;i++){
  const local=V().fromBufferAttribute(headPositions,i).applyMatrix4(inverse),blend=1-smooth(cfg.cut+.016,cfg.cut+.032,local.y);if(blend<=0)continue;
  const hit=sampleNeck(local);if(!hit)continue;const f=hit.face,op=original.attributes.position;
  a.fromBufferAttribute(op,f.a);b.fromBufferAttribute(op,f.b);c.fromBufferAttribute(op,f.c);THREE.Triangle.getBarycoord(hit.point,a,b,c,bary);
  const n=V().fromBufferAttribute(sourceNormals,f.a).multiplyScalar(bary.x).addScaledVector(V().fromBufferAttribute(sourceNormals,f.b),bary.y).addScaledVector(V().fromBufferAttribute(sourceNormals,f.c),bary.z).applyMatrix3(normalMatrix).normalize();
  const mixed=V().fromBufferAttribute(normals,i).lerp(n,blend).normalize();normals.setXYZ(i,mixed.x,mixed.y,mixed.z);
 }
 head.geometry.userData.neckBoundary.forEach((id,k)=>{const n=V().fromBufferAttribute(bodyNormals,head.geometry.userData.neckBodyBoundary[k]).normalize();normals.setXYZ(id,n.x,n.y,n.z);});
 head.name='Rider_Head';head.userData.artistHead=true;head.userData.source='Blender Studio Human Base Meshes · Julien Kaspar · CC0';skin.parent.add(head);
 for(const geo of eyeSources){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const v=refineEyes(map(V().fromBufferAttribute(p,i)));p.setXYZ(i,v.x,v.y,v.z);}}
 const eyes=weighted(THREE,merge(THREE,eyeSources),skin,hi,bind);eyes.name='Eyes_Stylized';skin.parent.add(eyes);
 oldEyes?.removeFromParent();oldBrows?.removeFromParent();
 const headProbe=new THREE.Mesh(headLocal,material);headProbe.updateMatrixWorld(true);const positions=[],uv=[],indices=[],columns=40,rows=5;
 const faceHit=(x,y)=>{ray.set(V(x,y,.35),V(0,0,-1));return ray.intersectObject(headProbe,false)[0];};
 let browTop=-Infinity;
 for(const side of [-1,1]){const offset=positions.length/3;for(let i=0;i<=columns;i++){
  const t=i/columns,x=side*(cfg.target[0]-.022+.048*t),y=cfg.target[1]+.026+(body==='f'?.007:.009)*Math.sin(t*Math.PI)-.004*t,width=(body==='f'?.0026:.00305)*Math.pow(Math.max(.012,1-t),.55)*(.5+.5*smooth(0,.09,t));
  for(let j=0;j<rows;j++){const across=j/(rows-1)*2-1,by=y+across*width,hit=faceHit(x,by);positions.push(x,by,(hit?.point.z||.09)+.00065+.00035*(1-across*across));uv.push(t,j/(rows-1));browTop=Math.max(browTop,by);if(i<columns&&j<rows-1){const k=offset+i*rows+j;side>0?indices.push(k,k+rows,k+1,k+1,k+rows,k+rows+1):indices.push(k,k+1,k+rows,k+1,k+rows+1,k+rows);}}
 }}
 const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bg.setIndex(indices);const brows=weighted(THREE,bg,skin,hi,bind);brows.name='Eyebrows_Stylized';skin.parent.add(brows);
 original.dispose();material.dispose();eyeSources.forEach(g=>g.dispose());
 return {mesh:head,eyes,brows,garmentSkin,seamCount,local:headLocal,browTop,config:cfg,source:'Blender Studio CC0',inverse,bind};
}
export function patchStylizedHead(material,u,asset,body){
 material.map=null;material.normalMap=null;material.roughness=.55;material.ior=1.42;material.specularIntensity=.48;
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 uFaceBind; varying vec3 vHead;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHead=(uFaceBind*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uSkin;varying vec3 vHead;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float front=smoothstep(.045,.077,vHead.z),face=smoothstep(.015,.040,vHead.y)*front;
   float cheeks=exp(-pow((abs(vHead.x)-.051)/.023,2.0)-pow((vHead.y-${body==='f'?'.063':'.065'})/.026,2.0));
   vec3 skin=uSkin;skin=mix(skin,uSkin*vec3(1.025,.87,.87),cheeks*face*${body==='f'?'.42':'.24'});
   float lip=exp(-pow(abs(vHead.x)/.026,4.0)-pow((vHead.y-${(asset.config.mouth+(body==='f'?.0025:.001)).toFixed(5)})/.009,4.0))*front;
   vec3 lipColor=uSkin*vec3(.88,.47,.52)+vec3(.015,.001,.002);
   diffuseColor.rgb=mix(skin,lipColor,lip*.76);
   float pores=sin(vHead.x*2250.0)*sin(vHead.y*2010.0)*sin(vHead.z*2170.0);
   diffuseColor.rgb*=1.0+pores*.003;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.55,.38,lip*.65);');
 };
 material.customProgramCacheKey=()=>'rider-artist-head-'+body;
}
export function patchStylizedEyes(material,u,asset,body){
 material.map=null;material.normalMap=null;material.roughness=.18;material.clearcoat=.75;material.clearcoatRoughness=.06;
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 uFaceBind;varying vec3 vEyeHead;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeHead=(uFaceBind*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uEye;varying vec3 vEyeHead;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 e=vec2(abs(vEyeHead.x)-${(body==='f'?.03431453:.03320741).toFixed(6)},vEyeHead.y-${(body==='f'?.09881232:.09402493).toFixed(6)});
   float radius=${body==='f'?'.0102':'.0096'},r=length(e),iris=1.0-smoothstep(radius-.00035,radius+.00035,r);
   iris*=smoothstep(${(asset.config.target[2]+.0056).toFixed(5)},${(asset.config.target[2]+.0064).toFixed(5)},vEyeHead.z);
   float pupil=1.0-smoothstep(.0036,.0042,r),limbus=smoothstep(radius-.0015,radius-.0004,r);
   float angle=atan(e.y,e.x),fibers=sin(angle*67.0+sin(r*1870.0))*sin(angle*43.0-r*2240.0);
   vec3 irisColor=uEye*(.90+.15*sin(r/radius*3.1416)+.07*fibers);
   irisColor=mix(irisColor,uEye*.46,limbus);irisColor=mix(irisColor,vec3(.003,.004,.006),pupil);
   float glint=1.0-smoothstep(.0010,.0015,length(e-vec2(-.0036,.0038)));
   glint=max(glint,(1.0-smoothstep(.00045,.0008,length(e-vec2(.003,-.0025))))*.58);
   irisColor=mix(irisColor,vec3(.94,.97,1.0),glint);
   diffuseColor.rgb=mix(vec3(.78,.81,.79),irisColor,iris);`);
 };material.customProgramCacheKey=()=>'rider-artist-eyes-'+body;
}
