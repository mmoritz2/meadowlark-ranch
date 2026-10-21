import {PORTRAIT99} from './rider-portrait99-data.mjs?v=character-foundation99-20261021';
import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
import {installRiderDiffuseResponse98} from './rider-skin-lighting98.js?v=character-redesign98-20261020';

let portraitIdentity=0x504f5254;
function portraitResources(fn){const ambient=Math.random;Math.random=()=>{portraitIdentity=(Math.imul(portraitIdentity,1664525)+1013904223)>>>0;return portraitIdentity/4294967296;};try{return fn();}finally{Math.random=ambient;}}
export function preparePortrait99(...args){return portraitResources(()=>preparePortrait(...args));}
export function portraitLashes99(...args){return portraitResources(()=>portraitLashes(...args));}
const TAU=Math.PI*2;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const component=(a,i,k)=>a[['getX','getY','getZ','getW'][k]](i);

// A complete, uniformly fitted anatomical head replaces the old facial
// deformation stack. Only the neck transition is constructed for the game rig.
function preparePortrait(T,skin,_eyes,_brows,source,body,asset){
 const data=PORTRAIT99[body],V=(...x)=>new T.Vector3(...x),B=asset.bind,inv=asset.inverse;
 const headIndex=skin.skeleton.bones.findIndex(b=>b.name==='Head');
 const map=q=>V(q.x*data.scale,(q.y-data.sourceEye[1])*data.scale+data.target[1],(q.z-data.sourceEye[2])*data.scale+data.target[2]);
 // A small neutral eyelid repose keeps the source eye/lid unit, with a
 // continuous field confined to the upper lids. The globes never change.
 const sourceEyes=data.landmarks.eyes.map(e=>({center:map(V(...e.globeCenter)),radius:e.globeRadius*data.scale}));
 const lidDrop=body==='f'?.00145:.00065;
 const repose=q=>{for(const eye of sourceEyes){const dx=q.x-eye.center.x,dy=q.y-eye.center.y,x=dx/.0118;
  if(Math.abs(x)>1.8||q.z<eye.center.z-.001)continue;
  const w=Math.exp(-Math.pow(x,4)-Math.pow((dy-.0048)/.010,2))*smooth((dy+.0004)/.0036)*smooth((q.z-eye.center.z+.001)/.006);
  const drop=lidDrop*w,oldFront=Math.sqrt(Math.max(0,eye.radius*eye.radius-dx*dx-dy*dy)),newFront=Math.sqrt(Math.max(0,eye.radius*eye.radius-dx*dx-(dy-drop)*(dy-drop)));
  q.y-=drop;q.z+=Math.max(-.0008,Math.min(.0008,newFront-oldFront))*w;
 }return q;};
 const mapped=p=>map(V(...p)).toArray(),mappedLid=p=>repose(map(V(...p))).toArray(),normalToBind=new T.Matrix3().getNormalMatrix(B),reposed=[];
 source.updateMatrixWorld(true);let original;const eyeSources=[];
 source.traverse(m=>{if(!m.isMesh)return;const g=m.geometry.clone().applyMatrix4(m.matrixWorld);if(m.name.includes('-head'))original=g;else if(m.name.includes('-eye'))eyeSources.push(g);else g.dispose();});
 if(!original||eyeSources.length!==2)throw Error('Portrait99 requires its original head and two anatomical eyes');
 const bodyGeometry=skin.geometry,bp=bodyGeometry.attributes.position,bodyIDs=bodyGeometry.userData.artistNeckBoundary;
 if(bodyIDs?.length!==84)throw Error('Portrait99 requires the canonical 84-point body neck boundary');
 const seam=bodyIDs.map(id=>V().fromBufferAttribute(bp,id).applyMatrix4(inv)),seamCenter=seam.reduce((p,q)=>p.add(q),V()).multiplyScalar(1/seam.length),neckAngle=q=>(Math.atan2(q.x-seamCenter.x,q.z-seamCenter.z)+TAU)%TAU,neckRows=seam.map(q=>({q,a:neckAngle(q)})).sort((a,b)=>a.a-b.a),cutY=(data.cutY-data.sourceEye[1])*data.scale+data.target[1];
 const neckFit=q=>{const top=.005+.027*(1-smooth((q.z+.050)/.060)),w=smooth((top-q.y)/(top-cutY))*(1-smooth((q.z-.020)/.025));if(w<=0)return q;
  const angle=neckAngle(q);let j=neckRows.findIndex(e=>e.a>angle);if(j<0)j=neckRows.length;const lo=neckRows[(j+neckRows.length-1)%neckRows.length],hi=neckRows[j%neckRows.length],a=lo.a-(j===0?TAU:0),b=hi.a+(j===neckRows.length?TAU:0),target=lo.q.clone().lerp(hi.q,(angle-a)/(b-a));q.z+=(target.z-q.z)*w;return q;
 };
 const a=original.attributes,P=[],N=[],UV=[],SI=[],SW=[],I=Array.from(original.index.array),locals=[];
 for(let i=0;i<a.position.count;i++){
  const q=map(V().fromBufferAttribute(a.position,i)),before=q.clone();repose(q);neckFit(q);reposed.push(q.distanceToSquared(before)>1e-12);locals.push(q);P.push(...q.clone().applyMatrix4(B).toArray());
  N.push(...V().fromBufferAttribute(a.normal,i).applyMatrix3(normalToBind).normalize().toArray());
  UV.push(a.uv?.getX(i)||0,a.uv?.getY(i)||0);SI.push(headIndex,0,0,0);SW.push(1,0,0,0);
 }
 const sourceCount=locals.length;
 const key=p=>p.toArray().map(x=>Math.round(x*1e6)).join(',');
 const byPosition=new Map();locals.forEach((q,i)=>{const k=key(q);if(!byPosition.has(k))byPosition.set(k,i);});
 const upper=data.neckBoundary.map(p=>{const q=neckFit(map(V(...p))),id=byPosition.get(key(q));if(id===undefined)throw Error('Portrait99 exported neck boundary is missing');return {id,q};});
 const lower=bodyIDs.map(id=>({bodyId:id,q:V().fromBufferAttribute(bp,id).applyMatrix4(inv),weights:[0,1,2,3].map(k=>[component(bodyGeometry.attributes.skinIndex,id,k),component(bodyGeometry.attributes.skinWeight,id,k)])}));
 const center=ring=>ring.reduce((p,e)=>p.add(e.q),V()).multiplyScalar(1/ring.length),lc=center(lower),uc=center(upper),angle=(q,c)=>(Math.atan2(q.x-c.x,q.z-c.z)+TAU)%TAU;
 for(const e of lower)e.angle=angle(e.q,lc);for(const e of upper)e.angle=angle(e.q,uc);
 lower.sort((a,b)=>a.angle-b.angle);upper.sort((a,b)=>a.angle-b.angle);
 const rank=rows=>{const weights=new Map();for(const [entries,factor]of rows)for(const[j,w]of entries)weights.set(j,(weights.get(j)||0)+w*factor);const r=[...weights].filter(x=>x[1]>1e-10).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=r.reduce((n,x)=>n+x[1],0);if(!(sum>0))throw Error('Portrait99 empty neck weights');while(r.length<4)r.push([0,0]);return r.map(([j,w])=>[j,w/sum]);};
 const append=(q,w,uv)=>{const id=P.length/3;locals.push(q);P.push(...q.clone().applyMatrix4(B).toArray());N.push(0,1,0);UV.push(...uv);SI.push(...w.map(x=>x[0]));SW.push(...w.map(x=>x[1]));return id;};
 const sample=a=>{let j=lower.findIndex(e=>e.angle>a);if(j<0)j=lower.length;const b=lower[j%lower.length],c=lower[(j+lower.length-1)%lower.length];let aa=c.angle,bb=b.angle,t=a;if(j===0){aa-=TAU;}if(j===lower.length)bb+=TAU;const s=(t-aa)/(bb-aa);return{q:c.q.clone().lerp(b.q,s),weights:rank([[c.weights,1-s],[b.weights,s]])};};
 const lowerIDs=lower.map(e=>{const id=append(e.q,e.weights,[e.angle/TAU,0]);P.splice(id*3,3,bp.getX(e.bodyId),bp.getY(e.bodyId),bp.getZ(e.bodyId));return id;});
 const rows=[lowerIDs],steps=6;
 for(let row=1;row<steps;row++){
  const t=row/steps,ids=[];for(const e of upper){const l=sample(e.angle),q=l.q.clone().lerp(e.q,t);ids.push(append(q,rank([[l.weights,1-smooth(t)],[[[headIndex,1]],smooth(t)]]),[e.angle/TAU,t]));}rows.push(ids);
 }
 rows.push(upper.map(e=>e.id));
 const bridge=[];
 // The first strip joins unequal angular rings without changing either seam.
 let li=0,ui=0;const first=rows[1];
 while(li<lower.length||ui<upper.length){
  const a=lowerIDs[li%lower.length],b=first[ui%upper.length],la=li<lower.length?(li+1===lower.length?lower[0].angle+TAU:lower[li+1].angle):Infinity,ua=ui<upper.length?(ui+1===upper.length?upper[0].angle+TAU:upper[ui+1].angle):Infinity;
  if(la<ua){bridge.push(a,lowerIDs[(li+1)%lower.length],b);li++;}else{bridge.push(a,first[(ui+1)%upper.length],b);ui++;}
 }
 for(let row=1;row<steps;row++)for(let col=0;col<upper.length;col++){const next=(col+1)%upper.length,a=rows[row][col],b=rows[row][next],c=rows[row+1][col],d=rows[row+1][next];bridge.push(a,b,c,b,d,c);}
 let orientation=0;
 for(let f=0;f<bridge.length;f+=3){const [a,b,c]=bridge.slice(f,f+3).map(i=>locals[i]),cross=b.clone().sub(a).cross(c.clone().sub(a)),mid=a.clone().add(b).add(c).multiplyScalar(1/3);orientation+=cross.dot(V(mid.x,0,mid.z-(lc.z+uc.z)*.5));}
 if(orientation<0)for(let f=0;f<bridge.length;f+=3)[bridge[f+1],bridge[f+2]]=[bridge[f+2],bridge[f+1]];
 I.push(...bridge);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(P,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(N,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(UV,2));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(SI,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(SW,4));geometry.setIndex(I);
 const authoredNormals=N.slice();geometry.computeVertexNormals();const normals=geometry.attributes.normal;
 // Source UV seams duplicate positions. Share their emitted smooth normal in
 // the reposed lids and fitted neck so neither acquires vertical shading strips.
 const normalGroups=new Map();for(let i=0;i<sourceCount;i++){const k=key(locals[i]);let group=normalGroups.get(k);if(!group){group={ids:[],sum:V(),changed:false};normalGroups.set(k,group);}group.ids.push(i);group.sum.add(V().fromBufferAttribute(normals,i));group.changed||=reposed[i];}
 for(const group of normalGroups.values()){if(!group.changed)continue;group.sum.normalize();for(const i of group.ids){normals.setXYZ(i,group.sum.x,group.sum.y,group.sum.z);reposed[i]=true;}}
 for(let i=0;i<sourceCount;i++)if(!reposed[i])normals.setXYZ(i,authoredNormals[i*3],authoredNormals[i*3+1],authoredNormals[i*3+2]);
 lowerIDs.forEach((id,k)=>{const bi=lower[k].bodyId;normals.setXYZ(id,bodyGeometry.attributes.normal.getX(bi),bodyGeometry.attributes.normal.getY(bi),bodyGeometry.attributes.normal.getZ(bi));});
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={neckBoundary:lowerIDs,neckBodyBoundary:lower.map(e=>e.bodyId),portrait99:{version:1,sourceVertices:sourceCount,sourceTriangles:original.index.count/3,neckRows:steps,neckUpperVertices:upper.length,neckBodyVertices:84,uniformScale:data.scale,sourceAnatomyRetained:true,upperLidReposeM:lidDrop,lowerNeckFittedToBody:true,oldFaceDeformationsApplied:false}};
 const oldHead=asset.mesh.geometry;asset.mesh.geometry=geometry;oldHead.dispose();asset.local.dispose();asset.local=geometry.clone().applyMatrix4(inv);asset.garmentSkin={geometry:skin.geometry,skeleton:skin.skeleton,bindMatrix:skin.bindMatrix};asset.seamCount=84;
 // The original lids, globes and closed mouth remain one authored anatomical unit.
 const EP=[],EN=[],EUV=[],EI=[];
 for(const g of eyeSources){const offset=EP.length/3;for(let i=0;i<g.attributes.position.count;i++){EP.push(...map(V().fromBufferAttribute(g.attributes.position,i)).applyMatrix4(B).toArray());EN.push(...V().fromBufferAttribute(g.attributes.normal,i).applyMatrix3(normalToBind).normalize().toArray());EUV.push(g.attributes.uv?.getX(i)||0,g.attributes.uv?.getY(i)||0);}for(const id of g.index.array)EI.push(offset+id);g.dispose();}
 const eyeGeometry=new T.BufferGeometry();eyeGeometry.setAttribute('position',new T.Float32BufferAttribute(EP,3));eyeGeometry.setAttribute('normal',new T.Float32BufferAttribute(EN,3));eyeGeometry.setAttribute('uv',new T.Float32BufferAttribute(EUV,2));eyeGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(Array.from({length:EP.length/3},()=>[headIndex,0,0,0]).flat(),4));eyeGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:EP.length/3},()=>[1,0,0,0]).flat(),4));eyeGeometry.setIndex(EI);eyeGeometry.computeBoundingSphere();asset.eyes.geometry.dispose();asset.eyes.geometry=eyeGeometry;
 const eyes=data.landmarks.eyes.map(e=>({center:mapped(e.globeCenter),radius:e.globeRadius*data.scale,upperLidCurve:e.upperLidCurve.map(mappedLid),lowerLidCurve:e.lowerLidCurve.map(mappedLid),browRidgeSurfaceGuide:e.browRidgeSurfaceGuide.map(mapped)})),mouth={center:mapped(data.landmarks.mouth.center),halfWidth:data.landmarks.mouth.halfWidthEstimate*data.scale,seamCurve:data.landmarks.mouth.centerSeamCurve.map(mapped)},scalp=Object.fromEntries(Object.entries(data.landmarks.scalp).map(([k,v])=>[k,Array.isArray(v)?mapped(v):(v-data.sourceEye[1])*data.scale+data.target[1]]));
 const eyeX=eyes.reduce((n,e)=>n+Math.abs(e.center[0]),0)/2,target=[eyeX,data.target[1],data.target[2]],bounds=asset.local.boundingBox||(asset.local.computeBoundingBox(),asset.local.boundingBox),crownPoints=locals.slice(0,sourceCount).filter(q=>q.y>bounds.max.y-.0015),crown=crownPoints.reduce((p,q)=>p.add(q),V()).multiplyScalar(1/crownPoints.length);
 const hairFrame={eye:[0,target[1],target[2]],crown:crown.toArray(),hairline:scalp.frontHairline,temple:scalp.templeL,ear:scalp.earGuideL,nape:scalp.napeGuide,center:[0,target[1]+.035,(bounds.min.z+bounds.max.z)*.5-.010]};
 const chinCandidates=locals.slice(0,sourceCount).filter(q=>Math.abs(q.x)<.007&&q.y<mouth.center[1]-.016&&q.z>target[2]+.005).sort((a,b)=>a.y-b.y);if(!chinCandidates.length)throw Error('Portrait99 anatomical chin missing');const chin=chinCandidates[0].clone();chin.x=0;
 asset.portrait99={version:1,scale:data.scale,upperLidReposeM:lidDrop,eyes,mouth,scalp,hairFrame,landmarks:hairFrame,chin:chin.toArray(),source:'Blender Studio Human Base Meshes v1.4.1, realistic adult pair, CC0',oldFaceDeformationsApplied:false};
 asset.config={target,mouth:mouth.center[1],irisRadius:.0056*data.scale,globeRadius:eyes[0].radius};delete asset.adultFace98;delete asset.authoredHead94;
 // Brows follow the source ridge with a soft tapered width, rather than a
 // projecting replacement shelf. Their existing selected-hair material is reused.
 const surface=createTriangleSurface(T,asset.local),BP=[],BUV=[],BI=[];let browTop=-Infinity;
 for(const e of eyes){const guide=e.browRidgeSurfaceGuide.map(p=>V(...p)),side=Math.sign(e.center[0]);guide.sort((a,b)=>Math.abs(a.x)-Math.abs(b.x));const curve=new T.CatmullRomCurve3(guide),offset=BP.length/3,columns=40,across=6;
  for(let i=0;i<=columns;i++){const t=i/columns,q=curve.getPoint(t),width=(body==='f'?.0026:.0030)*Math.pow(Math.sin(Math.PI*(.05+.94*t)),.6)*(1-.45*t);
   for(let j=0;j<=across;j++){const y=q.y+(j/across*2-1)*width,hit=surface.cast(V(q.x,y,.35),V(0,0,-1)),p=V(q.x,y,(hit?.point.z??q.z)+.00035);browTop=Math.max(browTop,y);BP.push(...p.applyMatrix4(B).toArray());BUV.push(t,j/across);if(i<columns&&j<across){const a=offset+i*(across+1)+j,b=a+across+1;side>0?BI.push(a,b,a+1,a+1,b,b+1):BI.push(a,a+1,b,a+1,b+1,b);}}
  }
 }
 surface.dispose();const browGeometry=new T.BufferGeometry();browGeometry.setAttribute('position',new T.Float32BufferAttribute(BP,3));browGeometry.setAttribute('uv',new T.Float32BufferAttribute(BUV,2));browGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(Array.from({length:BP.length/3},()=>[headIndex,0,0,0]).flat(),4));browGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:BP.length/3},()=>[1,0,0,0]).flat(),4));browGeometry.setIndex(BI);browGeometry.computeVertexNormals();browGeometry.computeBoundingSphere();asset.brows.geometry.dispose();asset.brows.geometry=browGeometry;asset.browTop=browTop;asset.source=asset.portrait99.source;original.dispose();return asset;
}

function portraitLashes(T,asset,body){
 if(body!=='f')return null;const P=[],I=[],roots=[],V=(...p)=>new T.Vector3(...p);
 for(const eye of asset.portrait99.eyes){const side=Math.sign(eye.center[0]),guide=eye.upperLidCurve.map(p=>V(...p)).sort((a,b)=>Math.abs(a.x)-Math.abs(b.x)),curve=new T.CatmullRomCurve3(guide);
  for(let i=1;i<17;i++){const t=i/17,root=curve.getPoint(t);root.z+=.00022;roots.push(root.toArray());const length=(.0022+.0031*Math.sin(Math.PI*t*.82))*(.95+.07*Math.sin(i*2.3)),fan=side*.0015*t,end=root.clone().add(V(fan,length*.80,length*.60)),arc=new T.QuadraticBezierCurve3(root,root.clone().add(V(fan*.4,length*.16,length*.60)),end),base=P.length/3,segments=5,sides=4;
   for(let row=0;row<=segments;row++){const u=row/segments,q=arc.getPoint(u),tangent=arc.getTangent(u),n=V(1,0,0).addScaledVector(tangent,-tangent.x).normalize(),b=tangent.clone().cross(n),radius=.00013*Math.pow(1-u,.8)+.000008;for(let k=0;k<sides;k++){P.push(...q.clone().addScaledVector(n,Math.cos(k*TAU/sides)*radius).addScaledVector(b,Math.sin(k*TAU/sides)*radius).toArray());if(row<segments){const a=base+row*sides+k,c=a+sides,d=base+row*sides+(k+1)%sides;I.push(a,d,c,d,d+sides,c);}}}
  }
  const band=new T.TubeGeometry(curve,36,.00018,4,false),offset=P.length/3;for(let i=0;i<band.attributes.position.count;i++)P.push(...V().fromBufferAttribute(band.attributes.position,i).add(V(0,0,.00018)).toArray());for(const id of band.index.array)I.push(offset+id);band.dispose();
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();g.computeBoundingSphere();g.userData.lashRoots=roots;g.userData.lashStyle={version:99,strands:roots.length,lengthM:[.0022,.0055],radiusM:.000138,anatomicalSourceLids:true};return g;
}

export function patchPortraitHead99(material,u,asset,body){
 const cfg=asset.config,mouth=asset.portrait99.mouth;
 material.map=null;material.normalMap=null;material.roughness=.62;material.ior=1.4;material.specularIntensity=.30;
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 uFaceBind;varying vec3 vPortrait99;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPortrait99=(uFaceBind*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uSkin;varying vec3 vPortrait99;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat portraitFront=smoothstep(.040,.072,vPortrait99.z);\nfloat lipX=vPortrait99.x/'+mouth.halfWidth.toFixed(8)+';\nfloat lipY=vPortrait99.y-'+mouth.center[1].toFixed(8)+'+.0018*pow(abs(lipX),2.0);\nfloat lip=exp(-pow(abs(lipX),6.0)-pow(lipY/.0061,4.0))*portraitFront;\nfloat cheek=exp(-pow((abs(vPortrait99.x)-.049)/.021,2.0)-pow((vPortrait99.y-.063)/.023,2.0))*portraitFront;\nvec3 portraitSkin=mix(uSkin,uSkin*vec3(1.025,.86,.85),cheek*.30);\nvec3 portraitLip=uSkin*vec3(.83,.30,.36)+vec3(.008,.001,.002);\ndiffuseColor.rgb=mix(portraitSkin,portraitLip,lip*'+(body==='f'?'.82':'.52')+');');
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.63,.43,lip*.85);');
 };
 material.customProgramCacheKey=()=>'rider-portrait99-head-'+body;
 delete material.userData.riderDiffuseResponse98;installRiderDiffuseResponse98(material,{kind:'skin',strength:1});
 material.userData.riderNaturalSkin={version:99,anatomicalHead:true,geometryDeformation:false,selectedSkinUniform:true,spatialRoughness:true};
}

export function patchPortraitEyes99(material,u,asset,body){
 const cfg=asset.config,radius=cfg.irisRadius,eyeZ=cfg.target[2],globe=cfg.globeRadius;
 material.map=null;material.normalMap=null;material.roughness=.20;material.ior=1.376;material.specularIntensity=.48;material.clearcoat=.55;material.clearcoatRoughness=.10;
 material.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 uFaceBind;varying vec3 vPortraitEye99;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPortraitEye99=(uFaceBind*vec4(position,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uEye;varying vec3 vPortraitEye99;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec2 e=vec2(abs(vPortraitEye99.x)-'+cfg.target[0].toFixed(8)+',vPortraitEye99.y-'+cfg.target[1].toFixed(8)+');\nfloat radius='+radius.toFixed(8)+',r=length(e),aa=max(fwidth(r),.00010);\nfloat iris=(1.0-smoothstep(radius-aa,radius+aa,r))*smoothstep('+(eyeZ+globe*.65).toFixed(8)+','+(eyeZ+globe*.88).toFixed(8)+',vPortraitEye99.z);\nfloat pupil=1.0-smoothstep(radius*.40-aa,radius*.43+aa,r);\nfloat limbus=smoothstep(radius*.82,radius*.98,r);\nfloat phase=atan(e.y,e.x+.000001)*67.0+sin(r/radius*19.0);\nfloat fibers=sin(phase)*.08*(1.0-smoothstep(.6,2.2,fwidth(phase)));\nvec3 irisColor=uEye*(.76+.17*sin(clamp(r/radius,0.0,1.0)*3.14159)+fibers);\nirisColor=mix(irisColor,uEye*.22,limbus*.80);\nirisColor=mix(irisColor,vec3(.002,.003,.004),pupil);\nfloat corner=smoothstep(radius*.95,radius*2.05,abs(e.x));\nfloat upperShade=smoothstep(-radius*.15,radius*.95,e.y);\nvec3 sclera=mix(vec3(.66,.65,.62),vec3(.56,.39,.37),corner*.28)*(1.0-upperShade*.12);\ndiffuseColor.rgb=mix(sclera,irisColor,iris);');
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.34,.18,iris);');
 };
 material.customProgramCacheKey=()=>'rider-portrait99-eyes-'+body;
 delete material.userData.riderDiffuseResponse98;installRiderDiffuseResponse98(material,{kind:'eye',strength:.45});
 material.userData.riderNaturalEyes={version:99,anatomicalGlobes:true,physicalHighlights:true,paintedHighlights:false};
}
