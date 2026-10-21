import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';

// Hair99 is authored as a fitted continuous crown and overlapping curved cards.
// The actual portrait99 skull supplies the roots; head-local guides only direct
// the comb and the layer lengths. There is no texture download or frame solver.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const NEW_STYLES=new Set(['long','waves','mermaidwaves','ponytail','highpony','lowpony']);
let identityState=0x21cb99a1;
export function withHair99Identity(fn){
 const previous=Math.random;Math.random=()=>{identityState^=identityState<<13;identityState^=identityState>>>17;identityState^=identityState<<5;return(identityState>>>0)/4294967296;};
 try{return fn();}finally{Math.random=previous;}
}

function portraitFrame(T,asset){
 const p=asset.portrait99,s=p?.scalp,eyes=p?.eyes;
 if(p?.hairFrame)return {...p.hairFrame,scale:p.scale||1};
 if(!s||!eyes?.length)throw Error('Hair99 requires final portrait99 scalp and eye guides');
 const eye=eyes.reduce((v,e)=>v.add(new T.Vector3(...e.center)),new T.Vector3()).multiplyScalar(1/eyes.length),scale=p.scale||1;
 return {scale,eye:eye.toArray(),center:[eye.x,eye.y+.029*scale,eye.z-.084*scale],
  crown:[eye.x,s.crownY,eye.z-.084*scale],hairline:s.frontHairline,temple:s.templeL,
  ear:s.earGuideL,nape:s.napeGuide};
}

function geometry(T,P,UV,I,head,solid){
 const g=withHair99Identity(()=>new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));
 g.setAttribute('hair99Coord',new T.Float32BufferAttribute(head||P,3));g.setAttribute('hair99Solid',new T.Float32BufferAttribute(solid||new Float32Array(P.length/3),1));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 if(g.index&&g.attributes.uv)g.computeTangents();return g;
}

function weldedNormals(T,g){
 g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,buckets=new Map(),v=new T.Vector3();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
 for(const ids of buckets.values()){const sum=new T.Vector3();for(const i of ids)sum.add(v.fromBufferAttribute(n,i));sum.normalize();for(const i of ids)n.setXYZ(i,sum.x,sum.y,sum.z);}
 if(g.attributes.uv)g.computeTangents();
}

// Also used by the CPU preview. Geometry is in actual final Head-local meters.
export function buildHair99Geometry(T,{headGeometry,frame,style='long',helmet=false,backSupport=null}){
 const V=(...a)=>new T.Vector3(...a),S=frame.scale||1,E=V(...frame.eye),C=V(...frame.center),line=frame.hairline,temple=frame.temple,nape=frame.nape;
 const surface=createTriangleSurface(T,headGeometry),metrics={queries:0,misses:0,style,helmet,scale:S,frame,locks:[]},P=[],UV=[],I=[],SOLID=[],CP=[],CUV=[],CI=[];
 const bounds=headGeometry.boundingBox||(headGeometry.computeBoundingBox(),headGeometry.boundingBox),top=bounds.max.y,rx=Math.max(.055*S,Math.min(.082*S,Math.max(Math.abs(bounds.min.x-C.x),Math.abs(bounds.max.x-C.x))*.88)),rz=.096*S;
 const crownCenter=V();let crownCount=0;for(let i=0;i<headGeometry.attributes.position.count;i++){const p=V().fromBufferAttribute(headGeometry.attributes.position,i);if(p.y>top-.00025*S){crownCenter.add(p);crownCount++;}}
 if(!crownCount)throw Error('Hair99 maximum crown support missing');crownCenter.multiplyScalar(1/crownCount);crownCenter.y=top;
 const hairline=theta=>{const a=Math.abs(theta),rows=[[0,line[1]-.0015*S],[.38,line[1]+.001*S],[.85,temple[1]+.014*S],[1.18,temple[1]],[1.48,temple[1]-.010*S],[1.72,frame.ear[1]+.021*S],[2.02,E.y-.028*S],[2.40,nape[1]+.008*S],[Math.PI,nape[1]]];for(let i=1;i<rows.length;i++)if(a<=rows[i][0])return mix(rows[i-1][1],rows[i][1],smooth(rows[i-1][0],rows[i][0],a));return rows.at(-1)[1];};
 const radial=(theta,y,lift=0)=>{
  metrics.queries++;const direction=V(Math.sin(theta),0,Math.cos(theta)),pole=smooth(top-.038*S,top-.003*S,y),origin=V(mix(C.x,crownCenter.x,pole),y,mix(C.z,crownCenter.z,pole));let hit=surface.cast(origin,direction);
  if(!hit){const height=(y-C.y)/Math.max(.03*S,top-C.y),r=Math.sqrt(Math.max(.001,1-height*height)),target=V(C.x+rx*r*Math.sin(theta),y,C.z+rz*r*Math.cos(theta));hit=surface.cast(C,target.sub(C));}
  if(!hit){metrics.misses++;return V(C.x+rx*Math.sin(theta),y,C.z+rz*Math.cos(theta));}
  // A radial envelope gives one continuous surface across the skull. Individual
  // source triangle normals must not produce separate lifted plates.
  return hit.point.addScaledVector(direction,lift);
 };
 const crownLift=helmet?.0013*S:.0075*S;
 const cap=(theta,t,lift=0)=>{const latitude=1-Math.cos(t*Math.PI*.5),y=mix(top-.00010*S,hairline(theta),latitude),p=radial(theta,y,lift);p.y+=(helmet?.0007:.0065)*S*(1-.50*t);return p;};
 // One shared apex plus regular rings avoids the old faceted multi-peak crown.
 CP.push(crownCenter.x,crownCenter.y+(helmet?.0013:.0080)*S,crownCenter.z);CUV.push(.5,0);
 const N=80,R=28;
 for(let j=1;j<=R;j++)for(let i=0;i<=N;i++){
  const th=-Math.PI+i/N*Math.PI*2,t=j/R,p=cap(th,t,crownLift+(!helmet?.0012*S*Math.sin(th*2.0+t*3.2)**2:0));CP.push(...p.toArray());CUV.push(i/N,t);
 }
 for(let i=0;i<N;i++)CI.push(0,1+i,1+i+1);
 for(let j=0;j<R-1;j++)for(let i=0;i<N;i++){const a=1+j*(N+1)+i,b=a+N+1;CI.push(a,b,a+1,a+1,b,b+1);}

 const isPony=/pony/.test(style),wavy=style==='waves'||style==='mermaidwaves';
 const support=(p,t)=>{
  if(backSupport&&t>0){const z=backSupport(p.x,p.y);if(Number.isFinite(z))p.z=mix(p.z,Math.min(p.z,z-.009*S),t);}
  return p;
 };
 const smoothCurve=points=>new T.CatmullRomCurve3(points,false,'centripetal');
 const addCard=(name,points,width,{segments=20,rootWidth=.62,endWidth=.16,taperStart=.80,phase=0,scalp=false,back=false,wave=0,bulge=.0018}={})=>{
  const curve=smoothCurve(points),base=P.length/3,NW=3;
  for(let j=0;j<=segments;j++){
   const t=j/segments,center=curve.getPoint(t),tangent=curve.getTangent(Math.min(.99999,Math.max(.00001,t))).normalize();
   let normal=V(center.x-C.x,0,center.z-C.z).normalize();if(normal.lengthSq()<.5)normal=V(0,0,-1);if(back)normal.lerp(V(0,0,-1),smooth(.05,.45,t)).normalize();
   let across=tangent.clone().cross(normal).normalize();if(across.lengthSq()<.5)across=V(1,0,0);
   normal=across.clone().cross(tangent).normalize();
   const taper=mix(rootWidth,1,smooth(0,.17,t))*mix(1,endWidth,smooth(taperStart,1,t)),w=width*taper;
   const waveShift=wave*Math.sin(t*6.8+phase)*smooth(.28,.58,t);center.addScaledVector(across,waveShift);
   for(let k=0;k<=NW;k++){
    const u=k/NW,side=u*2-1,p=center.clone().addScaledVector(across,side*w*.5).addScaledVector(normal,bulge*S*(1-side*side)*Math.sin(Math.PI*t));
    if(scalp&&p.y>E.y+.016*S){const th=Math.atan2(p.x-C.x,p.z-C.z),q=radial(th,p.y,crownLift+.0012*S),r=Math.hypot(p.x-C.x,p.z-C.z),rq=Math.hypot(q.x-C.x,q.z-C.z);if(r<rq&&q.distanceTo(p)<.026*S)p.copy(q);}
    P.push(...p.toArray());UV.push(u,t);SOLID.push(0);
   }
  }
  for(let j=0;j<segments;j++)for(let k=0;k<NW;k++){const a=base+j*(NW+1)+k,b=a+NW+1;I.push(a,a+1,b,a+1,b+1,b);}
  metrics.locks.push({name,width,vertices:(segments+1)*(NW+1),triangles:segments*NW*2,points:points.map(p=>p.toArray())});
 };
 const addClump=(name,points,width,depth,phase)=>{
  const curve=smoothCurve(points),base=P.length/3,segments=14,sides=8;
  for(let j=0;j<=segments;j++){
   const t=j/segments,p=curve.getPoint(t),tangent=curve.getTangent(Math.min(.99999,Math.max(.00001,t))).normalize(),radial=V(p.x-C.x,0,p.z-C.z).normalize();
   let across=tangent.clone().cross(radial).normalize();if(across.lengthSq()<.5)across=V(1,0,0);const normal=across.clone().cross(tangent).normalize();
   const taper=mix(.58,1,smooth(0,.18,t))*mix(1,.018,smooth(.77,1,t));
   for(let k=0;k<=sides;k++){const u=k/sides,a=u*Math.PI*2,q=p.clone().addScaledVector(across,Math.cos(a)*width*taper).addScaledVector(normal,Math.sin(a)*depth*taper);P.push(...q.toArray());UV.push(u,t);SOLID.push(1);}
  }
  for(let j=0;j<segments;j++)for(let k=0;k<sides;k++){const a=base+j*(sides+1)+k,b=a+sides+1;I.push(a,b,a+1,a+1,b,b+1);}
  metrics.locks.push({name,kind:'elliptical flowing clump',widthM:width*2,depthM:depth*2,vertices:(segments+1)*(sides+1),triangles:segments*sides*2,phase,points:points.map(p=>p.toArray())});
 };
 try{
  if(isPony){
   const high=style==='highpony',low=style==='lowpony',tie=radial(Math.PI,E.y+(high?.065:low?-.060:.010)*S,.006*S),length=(low?.30:.34)*S;
   // The continuous crown carries the gathered comb. Separate broad overlays
   // on the skull caused the visibly stepped plates in native prototype4.
   for(let i=0;i<12;i++){
    const th=i/12*Math.PI*2,rad=.020*S,root=tie.clone().add(V(Math.cos(th)*rad,Math.sin(th)*rad,0)),mid=root.clone().add(V(Math.cos(th)*.012*S,-length*.43,-.034*S)),end=tie.clone().add(V(Math.cos(th)*.038*S,-length*(.91+.10*Math.sin(i*2.4)),-.055*S+Math.sin(th)*.018*S));
    addCard('pony-layer-'+i,[root,root.clone().add(V(0,-.035*S,-.020*S)),mid,end],.022*S,{segments:18,rootWidth:.8,phase:i,back:true,wave:.003*S,bulge:.0012});
   }
  }else{
   // The loose back is a distribution of small elliptical clumps. A flat
   // strip plane became a narrow diagonal tail in the actual profile image.
   const count=22;
   for(let i=0;i<count;i++){
    const th=1.60+i/(count-1)*(Math.PI*2-3.20),signed=th>Math.PI?th-Math.PI*2:th,theta=signed,phase=i*2.39996,layer=.5+.5*Math.sin(phase);
    const length=(.305+.013*Math.sin(i*1.9)-.016*layer)*S,root=cap(theta,.81,crownLift-.0040*S),q1=cap(theta,1,crownLift-.0010*S);
    const q2=V(C.x+Math.sin(theta)*(.078+.005*layer)*S,Math.min(E.y-.105*S,q1.y-.035*S),Math.min(C.z+Math.cos(theta)*.076*S-.008*layer*S,q1.z-.002*S)),q3=V(C.x+Math.sin(theta)*(.081+.006*layer)*S,E.y-.175*S,C.z+Math.cos(theta)*.086*S-(.025+.012*layer)*S),q4=V(C.x+Math.sin(theta)*.084*S,E.y-.245*S,C.z+Math.cos(theta)*.091*S-(.063+.016*layer)*S),end=V(C.x+Math.sin(theta)*.079*S+.003*S*Math.sin(phase),E.y-length,C.z+Math.cos(theta)*.085*S-(.073+.020*layer)*S);
    const wave=wavy?.009:.0035;q3.x+=wave*S*Math.sin(phase);q4.x-=wave*S*Math.sin(phase*.7);
    support(q2,1);support(q3,1);support(q4,1);support(end,1);
    addClump('long-volume-'+i,[root,q1,q2,q3,q4,end],(.0085+.0015*Math.sin(i*1.7))*S,(.0055+.0025*layer)*S,phase);
   }
   // Short, thin face frames finish beside the jaw, never as sternum cords.
   for(const side of [-1,1])for(let k=0;k<3;k++){
    const th=side*(.87+k*.15),endTh=side*(1.22+k*.12),root=cap(th,.83,crownLift-.0020*S),q1=cap(endTh,1,crownLift+.0005*S),q2=V(C.x+side*(.080+k*.001)*S,E.y-(.038+k*.009)*S,E.z-(.030+k*.009)*S),end=V(C.x+side*(.077+k*.001)*S,E.y-(.082+k*.012)*S,E.z-(.042+k*.010)*S);
    addCard('face-layer-'+side+'-'+k,[root,q1,q2,end],(.010-k*.0015)*S,{segments:18,rootWidth:.4,phase:k+side,endWidth:.03,taperStart:.46,bulge:.0008});
   }
  }
  const crown=geometry(T,CP,CUV,CI),cards=geometry(T,P,UV,I,null,SOLID);weldedNormals(T,crown);weldedNormals(T,cards);
  metrics.vertices=crown.attributes.position.count+cards.attributes.position.count;metrics.triangles=(crown.index.count+cards.index.count)/3;metrics.surface={...surface.metrics};
  if(metrics.triangles>10000)throw Error('Hair99 triangle budget exceeded');
  crown.userData.hair99={kind:'continuous-scalp',style,helmet};cards.userData.hair99={kind:'overlapping-curved-cards',style,helmet};
  return {crown,cards,metrics};
 }finally{surface.dispose();}
}

const ALPHA=`
float hair99Alpha(vec2 q){
 float fiber=q.x*188.4956+sin(q.y*10.0)*.55;
 float resolved=1.0-smoothstep(.5,2.0,fwidth(fiber));
 float feather=.07+(.020+.018*sin(fiber))*resolved;
 float edge=smoothstep(0.0,feather,q.x)*(1.0-smoothstep(1.0-feather,1.0,q.x));
 float tip=1.0-.065*(.5+.5*sin(q.x*69.0+sin(q.x*17.0)*2.0));
 return edge*(1.0-smoothstep(tip-.06,tip,q.y))*smoothstep(0.0,.018,q.y);
}
float hair99TipAlpha(vec2 q){
 float tip=.987-.035*(.5+.5*sin(q.x*43.9823+sin(q.x*18.8496)));
 return (1.0-smoothstep(tip-.035,tip,q.y))*smoothstep(0.0,.018,q.y);
}`;
function patchUV(m,fragment){
 m.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 hair99Coord;attribute float hair99Solid;varying float vHair99Solid; varying vec2 vHair99UV; varying vec3 vHair99Head;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHair99UV=uv;vHair99Head=hair99Coord;vHair99Solid=hair99Solid;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vHair99Solid;varying vec2 vHair99UV;varying vec3 vHair99Head;\n'+ALPHA);
  fragment(sh);
 };
}
function materials(T,rig,frame){
 const scalp=withHair99Identity(()=>new T.MeshPhysicalMaterial({color:0xffffff,roughness:.69,metalness:0,ior:1.46,specularIntensity:.43,anisotropy:.35,anisotropyRotation:Math.PI/2,alphaTest:.43,alphaToCoverage:true}));
 const cards=withHair99Identity(()=>new T.MeshPhysicalMaterial({color:0xffffff,roughness:.61,metalness:0,ior:1.46,specularIntensity:.48,anisotropy:.60,anisotropyRotation:Math.PI/2,side:T.DoubleSide,alphaTest:.43,alphaToCoverage:true}));
 const depth=withHair99Identity(()=>new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide,alphaTest:.43}));
 const part={value:new T.Vector3(frame.eye[0],frame.eye[1],frame.eye[2])},scale={value:frame.scale||1};
 for(const [m,isCard]of [[scalp,false],[cards,true]]){
  patchUV(m,sh=>{Object.assign(sh.uniforms,{uHair:rig.u.uHair,uSkin:rig.u.uSkin,uHair99Part:part,uHair99Scale:scale});
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uHair,uSkin,uHair99Part;uniform float uHair99Scale;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float fiber=vHair99UV.x*${isCard?'207.345':'2450.44'}+sin(vHair99UV.y*8.0)*.75;
    float resolved=1.0-smoothstep(.5,2.0,fwidth(fiber));
    float shade=.96+sin(fiber)*.032*resolved+sin(fiber*.273+vHair99UV.y*2.0)*.024;
    diffuseColor.rgb=uHair*shade*mix(.88,1.015,smoothstep(0.0,.45,vHair99UV.y));
    ${isCard?'diffuseColor.a*=mix(hair99Alpha(vHair99UV),hair99TipAlpha(vHair99UV),vHair99Solid);':`
    float partX=uHair99Part.x+.0015*uHair99Scale*sin((vHair99Head.z-uHair99Part.z)*22.0/uHair99Scale);
    float partMask=(1.0-smoothstep(.00025*uHair99Scale,.0008*uHair99Scale,abs(vHair99Head.x-partX)))*smoothstep(uHair99Part.y+.056*uHair99Scale,uHair99Part.y+.076*uHair99Scale,vHair99Head.y);
    diffuseColor.rgb=mix(diffuseColor.rgb,uSkin*.45,partMask*.28);
    float hairlineTip=.994-.009*(.5+.5*sin(vHair99UV.x*1445.13+sin(vHair99UV.x*283.0)*1.2));
    diffuseColor.a*=1.0-smoothstep(hairlineTip-.018,hairlineTip,vHair99UV.y);`}`);
  });m.customProgramCacheKey=()=>'rider-hair99-'+(isCard?'cards':'scalp')+'-3';m.userData.hair99Owned=true;
 }
 patchUV(depth,sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=mix(hair99Alpha(vHair99UV),hair99TipAlpha(vHair99UV),vHair99Solid);');});depth.customProgramCacheKey=()=>'rider-hair99-depth-3';depth.userData.hair99Owned=true;
 return {scalp,cards,depth};
}

export function installHair99(T,rig,lifecycle){
 const asset=rig.kit?.headAsset;if(!asset?.portrait99)return rig;if(rig.hair99)return rig;
 if(!lifecycle?.has(rig))throw Error('Hair99 must install after actual material lifecycle tracking');
 const frame=portraitFrame(T,asset),mat=materials(T,rig,frame),V=(...a)=>new T.Vector3(...a),bones=rig.body.skeleton.bones,headID=bones.indexOf(rig.bones.Head),B=rig.body.skeleton.boneInverses[headID].clone().invert(),Binv=B.clone().invert();
 const palette=['Head','neck_01','spine_03','spine_02'].map(n=>bones.findIndex(b=>b.name===n));if(palette.some(i=>i<0))throw Error('Hair99 shared upper-body palette missing');
 const oldHair=rig.setHair,oldLook=rig.setLook,oldOutfit=rig.setOutfit,oldRefresh=rig.refreshAccessories,oldDispose=rig.dispose;
 let dead=false,nesting=0,pending=false,last=null,builds=0,helmetNow=rig.u.uHelmet.value>.5;
 for(const m of [mat.scalp,mat.cards])rig.mats.push(m);
 const roster=()=>[rig.face.geometry.uuid,rig.outfitId,...(rig.outfit?.meshes||[]).map(m=>m.geometry.uuid)].join('|');
 const remove=g=>{if(!g)return;g.parent?.remove(g);const gs=new Set(),ms=new Set();g.traverse(m=>{if(!m.isMesh)return;m.userData.hairMassResource?.dispose();if(m.userData.ownGeo)gs.add(m.geometry);if(m.userData.ownMat&&!m.material.userData.hair99Owned)ms.add(m.material);if(m.isInstancedMesh)m.dispose();});for(const x of gs)x.dispose();for(const x of ms)x.dispose();};
 const styleNow=()=>rig.hair?.name?.replace(/^hair-/,'')||'long';
 function build(){
  const style=styleNow();if(dead||!NEW_STYLES.has(style)||!rig.outfit?.meshes?.length||rig.outfit.id!==rig.outfitId)return;
  const start=performance.now();rig.root.updateMatrixWorld(true);for(const s of new Set([rig.body.skeleton,...rig.outfit.meshes.filter(m=>m.isSkinnedMesh).map(m=>m.skeleton)]))s.update();
  const HW=rig.bones.Head.matrixWorld.clone(),HI=HW.clone().invert(),headGeo=withHair99Identity(()=>rig.face.geometry.clone()).applyMatrix4(asset.inverse),targets=[];
  for(const m of [rig.face,rig.body,...rig.outfit.meshes])if(m.isMesh&&m.visible){const g=withHair99Identity(()=>new T.BufferGeometry()),p=[];for(let i=0;i<m.geometry.attributes.position.count;i++)m.getVertexPosition(i,V()).applyMatrix4(m.matrixWorld).applyMatrix4(HI).toArray(p,i*3);g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(Array.from(m.geometry.index.array));targets.push({g,surface:createTriangleSurface(T,g)});}
  let packet;
  try{
   const samples=[],backSupport=(x,y)=>{let z=Infinity;for(const t of targets){const hit=t.surface.cast(V(x,y,-1),V(0,0,1));if(hit)z=Math.min(z,hit.point.z);}samples.push({x,y,z:Number.isFinite(z)?z:null});return Number.isFinite(z)?z:null;};
   packet=buildHair99Geometry(T,{headGeometry:headGeo,frame,style,helmet:helmetNow,backSupport});
   const mats=bones.map((b,i)=>b.matrixWorld.clone().multiply(rig.body.skeleton.boneInverses[i])),group=withHair99Identity(()=>new T.Group());group.name='hair-'+style;group.userData.hair99=true;
   let maxRebaseError=0;
   for(const [kind,g,material]of [['crown',packet.crown,mat.scalp],['cards',packet.cards,mat.cards]]){
    const p=g.attributes.position,original=p.array.slice(),SI=[],SW=[],cache=new Map();
    for(let i=0;i<p.count;i++){
     const v=V().fromArray(original,i*3),t=1-smooth(frame.eye[1]-.200*frame.scale,frame.eye[1]-.055*frame.scale,v.y),h=1-t*.92,n=(1-h)*.30,weights=[h,n,(1-h-n)*.76,(1-h-n)*.24],A=new T.Matrix4();A.elements.fill(0);
     for(let k=0;k<4;k++)for(let j=0;j<16;j++)A.elements[j]+=mats[palette[k]].elements[j]*weights[k];
     const key=weights.join(',');let M=cache.get(key);if(!M){M=Binv.clone().multiply(A.clone().invert());cache.set(key,M);}const world=v.clone().applyMatrix4(HW),q=world.clone().applyMatrix4(M);p.setXYZ(i,...q.toArray());maxRebaseError=Math.max(maxRebaseError,q.clone().applyMatrix4(B).applyMatrix4(A).distanceTo(world));SI.push(...palette);SW.push(...weights);
    }
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(SI,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(SW,4));weldedNormals(T,g);g.computeBoundingBox();g.computeBoundingSphere();
    const m=withHair99Identity(()=>new T.SkinnedMesh(g,material));m.name='Hair99_'+kind;m.bindMode=T.AttachedBindMode;m.bind(rig.body.skeleton,B);m.frustumCulled=false;m.castShadow=kind==='cards';m.receiveShadow=true;if(kind==='cards')m.customDepthMaterial=mat.depth;m.userData.ownGeo=true;m.userData.ownMat=false;group.add(m);
   }
   const previous=rig.hair;remove(previous);rig.bones.Head.add(group);rig.hair=group;last={revision:3,builds:++builds,style,helmet:helmetNow,targetRoster:roster(),vertices:packet.metrics.vertices,triangles:packet.metrics.triangles,materialCount:2,depthMaterials:1,frame,backSamples:samples,scalpRayMisses:packet.metrics.misses,maxCurrentPoseRebaseErrorM:maxRebaseError,buildMs:performance.now()-start,perFrameWork:'ordinary shared-skeleton LBS only'};
   lifecycle.changed(rig,'hair99-complete');
  }catch(error){if(packet){packet.crown.dispose();packet.cards.dispose();}throw error;}
  finally{headGeo.dispose();for(const t of targets){t.surface.dispose();t.g.dispose();}}
 }
 const ensure=()=>{if(dead)return;if(nesting){pending=true;return;}const style=styleNow();if(!NEW_STYLES.has(style))return;if(!rig.outfit?.meshes?.length||rig.outfit.id!==rig.outfitId){pending=true;return;}if(!rig.hair.userData.hair99||!last||last.targetRoster!==roster()){pending=false;build();}};
 rig.setHair=(...args)=>{if(rig.hair?.userData.hair99){remove(rig.hair);rig.hair=null;}last=null;if(args[1])rig.u.uHair.value.set(args[1]);if(typeof args[2]==='boolean')helmetNow=args[2];const q=oldHair.apply(rig,args);ensure();return q;};
 rig.setLook=(...args)=>{nesting++;try{return oldLook.apply(rig,args);}finally{nesting--;if(!nesting)ensure();}};
 rig.setOutfit=(id,cb)=>{let returned=false,done=false,closed=false;const finish=()=>{if(dead||closed)return;closed=true;ensure();cb?.();};const q=oldOutfit.call(rig,id,()=>{done=true;if(returned)finish();});returned=true;if(done)finish();return q;};
 if(typeof oldRefresh==='function')rig.refreshAccessories=(...args)=>{const q=oldRefresh.apply(rig,args);ensure();return q;};
 rig.hair99={evidence:()=>last?{...last,currentTargetRoster:roster(),targetsMatch:last.targetRoster===roster(),installed:!!rig.hair?.userData.hair99,pending,liveOwnedMaterials:3}:null};
 rig.dispose=()=>{if(dead)return;dead=true;if(rig.hair?.userData.hair99){remove(rig.hair);rig.hair=null;}for(const m of [mat.scalp,mat.cards]){const i=rig.mats.indexOf(m);if(i>=0)rig.mats.splice(i,1);}oldDispose.call(rig);for(const m of [mat.scalp,mat.cards,mat.depth])m.dispose();};
 ensure();return rig;
}
