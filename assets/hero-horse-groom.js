/** Original fine-strand hero groom. Rest coordinates: +X nose, +Y up, +Z side.
 * Await the factory: the cutout atlas is fully loaded before any meshes appear.
 * Supports the 33-bone ranch rig or a static mount with explicit anchors.
 * Call update(dtSeconds, {speedMps, phase01, intensity, grounded, turn}) after
 * the skeletal gait update. `turn` is signed yaw rate in radians/second; speed
 * and intensity are nonnegative. reset() removes all secondary motion, useful
 * after teleports/model switches. Missing state settles back to the rest groom.
 */
const atlases=new WeakMap();
function random(seed){let s=2166136261;for(const c of String(seed))s=Math.imul(s^c.charCodeAt(0),16777619);return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
async function atlas(THREE){
  if(!atlases.has(THREE))atlases.set(THREE,new THREE.TextureLoader().loadAsync(new URL('./textures/horse-hair/strand-atlas.png',import.meta.url).href).then(t=>{
    t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=8;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t;
  }).catch(e=>{atlases.delete(THREE);throw e}));
  return atlases.get(THREE);
}

// Tip movement is evaluated in rest space before skinning. All three passes
// share the same uniform objects, so directional and point-light shadows follow
// the strands exactly. No skeleton transforms or rest vertices are modified.
const motionShader=`
attribute vec4 heroHairFlow;
attribute vec3 heroHairTangent;
uniform float heroHairClock;
uniform float heroHairPhase;
uniform float heroHairActivity;
uniform float heroHairScale;
uniform vec2 heroHairLag;
vec3 heroHairOffset(out vec3 derivative) {
  float t = heroHairFlow.x;
  float kind = heroHairFlow.z;
  float flex = t * t;
  float slope = 2.0 * t;
  vec3 amplitude = vec3(0.0020, 0.0012, 0.0030);
  vec3 bias = vec3(-0.0030 + heroHairLag.x * 0.0050, 0.0010, 0.0020 + heroHairLag.y * 0.0060);
  if (kind > 0.5 && kind < 1.5) {
    flex *= t;
    slope = 3.0 * t * t;
    amplitude = vec3(0.0030, 0.0010, 0.0045);
    bias = vec3(-0.0020 + heroHairLag.x * 0.0070, 0.0, heroHairLag.y * 0.0090);
  } else if (kind > 1.5) {
    flex *= 0.18;
    slope *= 0.18;
  }
  vec3 angle = vec3(heroHairClock + heroHairPhase * 2.0 + heroHairFlow.y + t * 4.0) + vec3(0.0, 1.7, 3.2);
  vec3 wave = bias + amplitude * sin(angle);
  float strength = heroHairScale * heroHairActivity;
  derivative = strength * (slope * wave + flex * amplitude * cos(angle) * 4.0);
  return strength * flex * wave;
}
`;

function strandMotion(THREE,scale){
  const uniforms={heroHairClock:{value:0},heroHairPhase:{value:0},heroHairActivity:{value:0},heroHairScale:{value:scale},heroHairLag:{value:new THREE.Vector2()}};
  let clock=0,phase=0,activity=0,lagX=0,lagZ=0,velocityX=0,velocityZ=0,previousSpeed=0,initialized=false,disposed=false;
  const clamp=THREE.MathUtils.clamp,tau=Math.PI*2;
  function reset(){
    clock=phase=activity=lagX=lagZ=velocityX=velocityZ=previousSpeed=0;initialized=false;
    uniforms.heroHairClock.value=uniforms.heroHairPhase.value=uniforms.heroHairActivity.value=0;uniforms.heroHairLag.value.set(0,0);
  }
  return{uniforms,reset,
    install(material){
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,uniforms);
        shader.vertexShader=motionShader+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec3 hairDerivative;\ntransformed += heroHairOffset(hairDerivative);');
        // Inverse-transpose of the small strand bend. The local tangent provides
        // dt/dposition; this keeps highlights attached while the card bends.
        shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec3 hairNormalDerivative;\nheroHairOffset(hairNormalDerivative);\nvec3 hairGradient = heroHairTangent * heroHairFlow.w;\nobjectNormal -= hairGradient * dot(hairNormalDerivative, objectNormal) / max(0.5, 1.0 + dot(hairGradient, hairNormalDerivative));');
      };
      material.customProgramCacheKey=()=> 'hero-fine-strands-motion-v1';
    },
    update(dt,state){
      if(disposed||!Number.isFinite(dt)||dt<=0)return;
      const step=Math.min(dt,.05),speed=Number.isFinite(state?.speedMps)?clamp(state.speedMps,0,30):0;
      const intensity=Number.isFinite(state?.intensity)?clamp(state.intensity,0,1):clamp(speed/8,0,1);
      const turn=Number.isFinite(state?.turn)?clamp(state.turn,-2,2):0;
      // A resumed tab or first sample has no trustworthy acceleration history.
      const acceleration=initialized&&dt<.25?clamp((speed-previousSpeed)/step,-6,6):0;
      previousSpeed=speed;initialized=true;
      const targetX=-acceleration/6,targetZ=clamp(-turn*speed/10,-1,1),omega=7,decay=Math.exp(-omega*step);
      let difference=lagX-targetX,impulse=(velocityX+omega*difference)*step;
      lagX=targetX+(difference+impulse)*decay;velocityX=(velocityX-omega*impulse)*decay;
      difference=lagZ-targetZ;impulse=(velocityZ+omega*difference)*step;
      lagZ=targetZ+(difference+impulse)*decay;velocityZ=(velocityZ-omega*impulse)*decay;
      const targetActivity=Math.max(intensity,Math.min(speed/12,1),state?.grounded===false ? .35 : 0);
      activity+=(targetActivity-activity)*(1-Math.exp(-step*6));
      if(activity<1e-7&&targetActivity===0)activity=0;
      clock=(clock+step*2.2)%tau;
      if(Number.isFinite(state?.phase01)){
        const requested=(state.phase01-Math.floor(state.phase01))*tau;
        const difference=Math.atan2(Math.sin(requested-phase),Math.cos(requested-phase));
        phase=(phase+difference*(1-Math.exp(-step*24))+tau)%tau;
      }else phase=(phase+step*speed*.8)%tau;
      uniforms.heroHairClock.value=clock;uniforms.heroHairPhase.value=phase;uniforms.heroHairActivity.value=activity;uniforms.heroHairLag.value.set(lagX,lagZ);
    },
    dispose(){reset();disposed=true;}
  };
}

// Local triangle projection, used only while building the groom. This grid
// follows the true neck surface without raising roots onto neighboring ears.
function projection(geometry,a,b,height,cell,bounds){
  if(!geometry?.attributes?.position)return p=>p.getComponent(height);
  const pos=geometry.attributes.position,ix=geometry.index,grid=new Map(),key=(x,y)=>`${x},${y}`;
  const value=(i,d)=>pos.getComponent(i,d),count=ix?ix.count:pos.count;
  for(let k=0;k<count;k+=3){
    const id=[0,1,2].map(j=>ix?ix.getX(k+j):k+j),x=id.map(i=>value(i,a)),y=id.map(i=>value(i,b)),h=id.map(i=>value(i,height));
    const xmin=Math.max(bounds[0],Math.min(...x)),xmax=Math.min(bounds[1],Math.max(...x)),ymin=Math.max(bounds[2],Math.min(...y)),ymax=Math.min(bounds[3],Math.max(...y));
    if(xmin>xmax||ymin>ymax)continue;
    const dx=x[1]-x[0],dy=y[1]-y[0],ex=x[2]-x[0],ey=y[2]-y[0],det=dx*ey-ex*dy;if(Math.abs(det)<1e-10)continue;
    const triangle=[x[0],y[0],dx,dy,ex,ey,h[0],h[1]-h[0],h[2]-h[0],1/det];
    for(let gx=Math.floor(xmin/cell);gx<=Math.floor(xmax/cell);gx++)for(let gy=Math.floor(ymin/cell);gy<=Math.floor(ymax/cell);gy++){
      const q=key(gx,gy);if(!grid.has(q))grid.set(q,[]);grid.get(q).push(triangle);
    }
  }
  return(p,limit=Infinity,range=.25)=>{
    const px=p.getComponent(a),py=p.getComponent(b),base=p.getComponent(height);let top=-Infinity;
    for(const t of grid.get(key(Math.floor(px/cell),Math.floor(py/cell)))||[]){
      const x=px-t[0],y=py-t[1],u=(x*t[5]-t[4]*y)*t[9],v=(t[2]*y-x*t[3])*t[9];
      if(u<-.0001||v<-.0001||u+v>1.0001)continue;const h=t[6]+u*t[7]+v*t[8];if(h<limit&&Math.abs(h-base)<range)top=Math.max(top,h);
    }
    return Number.isFinite(top)?top:base;
  };
}

export async function createHeroHorseGroom({THREE,skin,bones=skin?.skeleton?.bones,mount,surfaceMesh,
  profile={},anchors=profile.anchors,boneMap=profile.groomBones,maneColor='#302820',tailColor=maneColor,seed='hero-bay'}={}){
  if(!THREE)throw new Error('Hero groom requires THREE.');
  const skinned=!!skin?.isSkinnedMesh,parent=skinned?skin.parent:mount;
  if(!parent)throw new Error('Hero groom requires a skin parent or static mount.');
  const map=await atlas(THREE),V=(...a)=>new THREE.Vector3(...a),rng=random(seed),clamp=THREE.MathUtils.clamp;
  const settings=profile.heroGroom||{};
  const asPoints=name=>(anchors?.[name]||[]).map(p=>Array.isArray(p)?V(...p):V(p.x,p.y,p.z));
  const invBind=skinned?skin.bindMatrix.clone().invert():null;
  const rest=skinned?bones.map((b,i)=>V().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(invBind,skin.skeleton.boneInverses[i].clone().invert()))):[];
  const indices=(list,fallback)=>(list||fallback).map(v=>typeof v==='string'?bones.findIndex(b=>b.name===v):v).filter(i=>rest[i]);
  const neckBones=skinned?indices(boneMap?.neck,[3,4,5]):[],headBones=skinned?indices(boneMap?.head,[5,6]):[],tailBones=skinned?indices(boneMap?.tail,[19,20,21,22]):[];
  if(skinned&&(!neckBones.length||!headBones.length||tailBones.length<2))throw new Error('Hero groom boneMap needs valid neck, head and tail entries.');
  // An explicit authored scale is shared by static and skinned previews. Bone
  // dimensions are a fallback for older profiles without their own hair scale.
  const stature=settings.scale??(skinned&&rest[4]&&rest[5]?clamp(rest[5].distanceTo(rest[4])/.368,.78,1.3):1);
  let crest=asPoints('crest'),tail=asPoints('tail');
  if(crest.length<2||tail.length<2)throw new Error('Hero groom needs crest (poll to withers) and tail (dock to tip) anchors.');
  if(crest[0].x<crest.at(-1).x)crest.reverse();
  const sourceGeometry=(skin||surfaceMesh)?.geometry,minX=Math.min(...crest.map(p=>p.x)),maxX=Math.max(...crest.map(p=>p.x));
  const minY=Math.min(...crest.map(p=>p.y)),maxY=Math.max(...crest.map(p=>p.y)),midZ=crest.reduce((s,p)=>s+p.z,0)/crest.length;
  const top=projection(sourceGeometry,0,2,1,.028*stature,[minX-.12*stature,maxX+.4*stature,midZ-.17*stature,midZ+.17*stature]);
  const side=projection(sourceGeometry,0,1,2,.028*stature,[minX-.24*stature,maxX+.06*stature,minY-.5*stature,maxY+.08*stature]);
  const guide=new THREE.CatmullRomCurve3(crest,false,'centripetal');
  crest=Array.from({length:31},(_,i)=>{const p=guide.getPoint(i/30);p.y=top(p,i<4?p.y+.014*stature:Infinity,.25*stature)+.002*stature;return p});
  const crestCurve=new THREE.CatmullRomCurve3(crest,false,'centripetal'),tailCurve=new THREE.CatmullRomCurve3(tail,false,'centripetal');
  const nearest=(p,list)=>{
    if(!skinned)return null;const w=list.map(i=>[i,1/Math.max(.012,p.distanceTo(rest[i]))**4]).sort((a,b)=>b[1]-a[1]).slice(0,4),total=w.reduce((s,v)=>s+v[1],0);
    return {indices:[0,0,0,0].map((_,i)=>w[i]?.[0]||0),weights:[0,0,0,0].map((_,i)=>(w[i]?.[1]||0)/total)};
  };
  const tailWeights=p=>{
    if(!skinned)return null;let best=Infinity,result;
    for(let j=0;j<tailBones.length-1;j++){const a=tailBones[j],b=tailBones[j+1],ab=rest[b].clone().sub(rest[a]);const t=clamp(p.clone().sub(rest[a]).dot(ab)/Math.max(1e-8,ab.lengthSq()),0,1),d=p.distanceToSquared(rest[a].clone().addScaledVector(ab,t));if(d<best){best=d;result={indices:[a,b,0,0],weights:[1-t,t,0,0]}}}
    return result;
  };
  const buffer=()=>({p:[],uv:[],color:[],si:[],sw:[],flow:[],tangent:[],ix:[],cards:0}),maneData=buffer(),tailData=buffer();
  function card(out,points,width,{tile=0,rows=10,across=2,axis=V(1,0,0),twist=0,shade=1,weights,tailShape=false,fitNeck=false,foreheadLimit}={}){
    const curve=new THREE.CatmullRomCurve3(points,false,'centripetal'),start=out.p.length/3;
    const inverseLength=1/Math.max(.05,curve.getLength()),strandPhase=(out.cards*.731)%(Math.PI*2),kind=tailShape?1:foreheadLimit!==undefined?2:0;
    for(let j=0;j<=rows;j++){
      const t=j/rows,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize(),wide=axis.clone().addScaledVector(tangent,-axis.dot(tangent)).normalize();
      if(wide.lengthSq()<.001)wide.set(0,0,1);wide.applyAxisAngle(tangent,twist*t);const normal=V().crossVectors(wide,tangent).normalize();
      const widthProfile=tailShape?(.50+.66*Math.sin(Math.PI*t*.82)):(.82+.18*Math.sin(Math.PI*t));
      const half=width*widthProfile*.5,wt=typeof weights==='function'?weights(p):weights;
      for(let c=0;c<=across;c++){
        const q=-1+2*c/across,vertex=p.clone().addScaledVector(wide,q*half).addScaledVector(normal,(1-q*q)*.035*width);
        if(fitNeck){
          if(j===0)vertex.y=top(vertex,vertex.x>maxX-.06*stature?crest[0].y+.013*stature:Infinity,.25*stature)+.004*stature;
          else vertex.z=Math.max(vertex.z,side(vertex,Infinity,.3*stature)+.004*stature);
        }
        if(foreheadLimit!==undefined)vertex.y=top(vertex,foreheadLimit,.22*stature)+.0035*stature;
        out.p.push(vertex.x,vertex.y,vertex.z);out.uv.push((tile+.025+.95*c/across)/8,1-(.002+.996*t));
        out.flow.push(t,strandPhase,kind,inverseLength);out.tangent.push(tangent.x,tangent.y,tangent.z);
        const tone=shade*(.84+.16*THREE.MathUtils.smoothstep(t,0,.28));out.color.push(tone,tone,tone);
        if(skinned){out.si.push(...wt.indices);out.sw.push(...wt.weights)}
      }
    }
    for(let j=0;j<rows;j++)for(let c=0;c<across;c++){const a=start+j*(across+1)+c,b=a+across+1;out.ix.push(a,b,a+1,a+1,b,b+1)}out.cards++;
  }
  const maneLength=(settings.maneLength??1)*stature;
  // Staggered overlapping cards follow the neck rather than one broad sheet.
  for(let i=0;i<80;i++){
    const t=clamp((i+(rng()-.5)*.8)/79,0,1),root=crestCurve.getPoint(t),layer=i%3,length=(.176+.125*Math.sin(Math.PI*t))*(.75+rng()*.37)*maneLength;
    const drift=(rng()-.5)*.075*stature,phase=Math.floor(i/8)*.34,points=[];
    for(let j=0;j<=7;j++){
      const u=j/7,p=root.clone();p.x-=length*.24*u;p.x+=drift*u*u+Math.sin(u*5.1+phase)*Math.sin(u*Math.PI)*.008*stature;p.y-=length*u;
      p.z+=.085*stature*Math.sin(u*Math.PI*.5);if(u>0)p.z=Math.max(p.z,side(p,Infinity,.32*stature)+(.006+layer*.006)*stature);
      points.push(p);
    }
    card(maneData,points,(.038+rng()*.031)*stature,{tile:i%6,shade:.90+rng()*.12,axis:V(1,.08,0),twist:(rng()-.5)*.3,weights:nearest(root,neckBones),fitNeck:true});
  }
  // Sparse flyaways break up the silhouette without turning into opaque ropes.
  for(let i=0;i<26;i++){
    const t=rng(),root=crestCurve.getPoint(t),length=(.205+.145*Math.sin(Math.PI*t))*(.85+rng()*.2)*maneLength,points=[];
    for(let j=0;j<=5;j++){const u=j/5,p=root.clone().add(V(-length*.29*u,-length*u,.11*stature*Math.sin(u*Math.PI*.5)));if(u>0)p.z=Math.max(p.z,side(p,Infinity,.35*stature)+.025*stature);p.x+=.03*stature*Math.sin(u*4+i);points.push(p)}
    card(maneData,points,.024*stature,{tile:7,rows:6,across:1,shade:.94,weights:nearest(root,neckBones),fitNeck:true});
  }
  const poll=asPoints('poll')[0]||crest[0],eyes=asPoints('eyes'),brow=eyes.length?eyes.reduce((s,p)=>s.add(p),V()).multiplyScalar(1/eyes.length).add(V(.045,.026,0)):poll.clone().add(V(.13,-.10,0));
  // The authored poll guide predates scalp cleanup. Project the full forelock
  // onto the raised forehead, starting between the ears instead of hiding the
  // roots under the scalp and leaving only an isolated tuft farther forward.
  const foreheadLimit=poll.y+.090*stature;
  for(let i=0;i<20;i++){
    const lateral=(rng()-.5)*.065*stature,root=poll.clone().add(V(-.034*stature,0,lateral*.42)),points=[],reach=.78+rng()*.32;
    root.y=top(root,foreheadLimit,.22*stature)+.003*stature;
    for(let j=0;j<=6;j++){const t=j/6,p=root.clone().lerp(brow,t*reach);p.z+=lateral*t;p.y=top(p,foreheadLimit,.22*stature)+.003*stature;points.push(p)}
    card(maneData,points,(.029+rng()*.017)*stature,{tile:i%6,rows:7,axis:V(0,0,1),shade:.93+rng()*.12,weights:nearest(root,headBones),foreheadLimit});
  }
  const dockInset=tail[0].clone().sub(tail[1]).normalize().multiplyScalar(.021*stature);
  for(let i=0;i<126;i++){
    const angle=i*2.39996323+(rng()-.5)*.28,layer=.58+rng()*.43,reach=(.82+rng()*.20)*(settings.tailLength??1),points=[],phase=rng()*Math.PI*2;
    for(let j=0;j<=10;j++){
      const t=j/10,p=tailCurve.getPoint(clamp(t*reach,0,1));p.addScaledVector(dockInset,Math.exp(-t*12));
      const r=(.014+.074*Math.sin(Math.PI*t*.87))*layer*stature;p.z+=Math.cos(angle)*r+Math.sin(t*5+phase)*.008*t*stature;p.x+=Math.sin(angle)*r*.72-.035*t*t*stature;points.push(p);
    }
    card(tailData,points,(.040+rng()*.036)*stature,{tile:i%6,rows:12,axis:V(Math.cos(angle),0,-Math.sin(angle)),twist:(rng()-.5)*.38,shade:.88+rng()*.17,weights:tailWeights,tailShape:true});
  }
  for(let i=0;i<22;i++){
    const a=rng()*Math.PI*2,points=[],reach=.87+rng()*.18;
    for(let j=0;j<=8;j++){const t=j/8,p=tailCurve.getPoint(clamp(t*reach,0,1));p.addScaledVector(dockInset,Math.exp(-t*12));const r=(.015+.091*Math.sin(Math.PI*t*.85))*stature;p.x+=Math.sin(a)*r*.8-.038*t*t*stature;p.z+=Math.cos(a)*r+.025*Math.sin(t*4+a)*t*stature;points.push(p)}
    card(tailData,points,.023*stature,{tile:7,rows:8,across:1,axis:V(Math.cos(a),0,-Math.sin(a)),shade:1.02,weights:tailWeights,tailShape:true});
  }
  const materials=[],motion=strandMotion(THREE,stature);
  const material=color=>{
    const m=new THREE.MeshPhysicalMaterial({color,map,vertexColors:true,roughness:.65,metalness:0,alphaTest:.28,alphaToCoverage:true,side:THREE.DoubleSide,depthWrite:true,transparent:false,envMapIntensity:.55,specularIntensity:.28,anisotropy:.45,anisotropyRotation:Math.PI/2});
    m.name='Fine horse strands, alpha-tested';m.shadowSide=THREE.DoubleSide;motion.install(m);materials.push(m);return m;
  };
  const meshes=[];
  function make(data,color,name){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(data.color,3));g.setAttribute('heroHairFlow',new THREE.Float32BufferAttribute(data.flow,4));g.setAttribute('heroHairTangent',new THREE.Float32BufferAttribute(data.tangent,3));g.setIndex(data.ix);
    if(skinned){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.sw,4))}g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=skinned?new THREE.SkinnedMesh(g,material(color)):new THREE.Mesh(g,material(color));mesh.name=name;
    if(skinned){mesh.position.copy(skin.position);mesh.quaternion.copy(skin.quaternion);mesh.scale.copy(skin.scale);parent.add(mesh);mesh.bind(skin.skeleton,skin.bindMatrix)}else parent.add(mesh);
    mesh.customDepthMaterial=new THREE.MeshDepthMaterial({map,alphaTest:.28,side:THREE.DoubleSide,depthPacking:THREE.RGBADepthPacking});mesh.customDistanceMaterial=new THREE.MeshDistanceMaterial({map,alphaTest:.28,side:THREE.DoubleSide});
    motion.install(mesh.customDepthMaterial);motion.install(mesh.customDistanceMaterial);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;meshes.push(mesh);return mesh;
  }
  const mane=make(maneData,maneColor,'Hero fine-strand mane and forelock'),tailMesh=make(tailData,tailColor,'Hero fine-strand flowing tail');
  const stats={triangles:(maneData.ix.length+tailData.ix.length)/3,cards:maneData.cards+tailData.cards,drawCalls:meshes.length,skinned,atlas:'2048x1024 / 8 strand clumps',alphaTest:.28,secondaryMotion:true};
  let disposed=false;
  return{mane,tail:tailMesh,meshes,stats,update:motion.update,reset:motion.reset,setColors({maneColor,tailColor}={}){if(maneColor)mane.material.color.set(maneColor);if(tailColor)tailMesh.material.color.set(tailColor)},dispose(){if(disposed)return;disposed=true;motion.dispose();for(const m of meshes){m.removeFromParent();m.geometry.dispose();m.customDepthMaterial.dispose();m.customDistanceMaterial.dispose()}for(const m of materials)m.dispose()}};
}
