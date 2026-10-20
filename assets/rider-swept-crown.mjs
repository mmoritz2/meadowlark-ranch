import {scalpPoint} from './rider-hairstyles.js?v=rider-details-20261009';

// Tied styles used independent fringe slabs over a separate gathered scalp.
// One continuous fitted shell supplies their crown, sweep and tapered temples.
// The existing tail, bun, braid, ties, material and helmet deformation stay intact.
const templates=new WeakMap();
const COLUMNS=128,ROWS=30,TAU=Math.PI*2;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const bell=(x,c,w)=>Math.exp(-Math.pow((x-c)/w,2));
let identityState=0x6bc73a21;
function withCrownIdentity(fn){
 const previous=Math.random;
 Math.random=()=>{identityState^=identityState<<13;identityState^=identityState>>>17;identityState^=identityState<<5;return(identityState>>>0)/4294967296;};
 try{return fn();}finally{Math.random=previous;}
}

function crownTemplate(T,kit){
 const cached=templates.get(kit);if(cached)return cached;
 const H=kit.head,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),center=V(H.cx,H.cy,H.cz),radii=V(H.rx,H.ry,H.rz);
 if(![H.cx,H.cy,H.cz,H.rx,H.ry,H.rz,H.top,H.browTop].every(Number.isFinite)||Math.min(H.rx,H.ry,H.rz)<=0)throw Error('Swept crown requires a measured head');
 const poleDirection=V(.0025/H.rx,1,.0025/H.rz).normalize(),positions=[],uv=[],fade=[],index=[],normal=V(),identity=new T.Quaternion();
 const tieDirection=V(0,.028,-H.rz*.97).normalize(),combUp=V(0,1,0).addScaledVector(tieDirection,-tieDirection.y).normalize(),combSide=tieDirection.clone().cross(combUp);
 const boundary=theta=>{
  const a=Math.abs(theta),knots=[[0,.024],[.50,.014],[.95,-.002],[1.30,-.022],[1.55,-.018],[1.95,-.048],[2.60,-.085],[Math.PI,-.095]];
  let height=knots.at(-1)[1];for(let i=1;i<knots.length;i++)if(a<=knots[i][0]){height=knots[i-1][1]+(knots[i][1]-knots[i-1][1])*smooth(knots[i-1][0],knots[i][0],a);break;}
  // A raised part on one side and a lower opposing sweep retain face framing.
  height+=.014*bell(theta,.14,.20)-.007*bell(theta,-.43,.40);
  // A narrow side point meets the temple; the hem rises over the ear itself.
  height-=.017*bell(a,1.19,.20);
  return H.browTop+height;
 };
 const add=(theta,t)=>{
  const y=boundary(theta),phi=Math.acos(T.MathUtils.clamp((y-H.cy)/H.ry,-.985,.985)),end=V(Math.sin(theta)*Math.sin(phi),Math.cos(phi),Math.cos(theta)*Math.sin(phi));
  const turn=new T.Quaternion().setFromUnitVectors(poleDirection,end),direction=poleDirection.clone().applyQuaternion(identity.clone().slerp(turn,t));
  const target=center.clone().add(direction.clone().multiply(radii)),p=scalpPoint(T,kit,target,0);
  // The shared face includes folded ear cartilage. Its radial sample must not
  // become hair lying across the ear. Use the original gathered scalp's
  // cranial envelope, with a smooth blend into the upper and front/back skull.
  const earBand=(1-smooth(H.browTop+.012,H.browTop+.035,p.y))*smooth(H.cz-.080,H.cz-.065,p.z)*(1-smooth(H.cz+.065,H.cz+.080,p.z));
  const side=H.rx*.85*Math.sqrt(Math.max(.2,1-Math.pow((p.y-H.cy)/.13,2)-Math.pow((p.z-H.cz)/.16,2)));
  if(Math.abs(p.x)>side)p.x=T.MathUtils.lerp(p.x,Math.sign(p.x)*side,earBand);
  normal.copy(p).sub(center).divide(radii.clone().multiply(radii)).normalize();
  const combDirection=p.clone().sub(center).normalize(),azimuth=Math.atan2(combDirection.dot(combSide),combDirection.dot(combUp)),polar=Math.acos(T.MathUtils.clamp(combDirection.dot(tieDirection),-1,1));
  const phase=azimuth*7+.65*Math.sin(polar*2),crest=Math.pow(.5+.5*Math.cos(phase),3),edge=1-smooth(.88,1,t),root=smooth(0,.17,t),partX=H.cx+.010+.004*smooth(H.cz-.020,H.cz+.075,p.z),part=bell(p.x,partX,.0045)*smooth(H.cy+.050,H.cy+.084,p.y)*smooth(H.cz-.025,H.cz+.030,p.z);
  // Broad sculpted ridges share the shell rather than overlapping tube roots.
  // Thickness rounds down into the hairline instead of ending as a cut slab.
  const lift=.0012+edge*(.0034+.0034*Math.sin(Math.PI*t)+.0014*crest*root-.0011*part+.0065*earBand);
  p.addScaledVector(normal,lift);positions.push(...p.toArray());
  // Both broad locks and fine comb coordinates flow toward the existing rear
  // tie. Integer angular frequencies close exactly across this radian chart.
  uv.push(azimuth,polar/Math.PI*1.7);fade.push((1-t)*10+.035);
 };
 add(0,0);
 for(let row=1;row<=ROWS;row++)for(let col=0;col<=COLUMNS;col++)add(-Math.PI+col/COLUMNS*TAU,row/ROWS);
 for(let col=0;col<COLUMNS;col++)index.push(0,1+col,1+col+1);
 for(let row=0;row<ROWS-1;row++)for(let col=0;col<COLUMNS;col++){
  const a=1+row*(COLUMNS+1)+col,b=a+1,c=a+COLUMNS+1,d=c+1;index.push(a,c,b,b,c,d);
 }
 // Identical positional seam aliases avoid tiny cracks from trig rounding.
 for(let row=0;row<ROWS;row++){const a=1+row*(COLUMNS+1),b=a+COLUMNS;for(let k=0;k<3;k++)positions[b*3+k]=positions[a*3+k];fade[b]=fade[a];}
 const geometry=withCrownIdentity(()=>new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('hairFade',new T.Float32BufferAttribute(fade,1));geometry.setIndex(index);geometry.computeVertexNormals();
 const p=geometry.attributes.position,n=geometry.attributes.normal;
 for(let row=0;row<ROWS;row++){
  const first=1+row*(COLUMNS+1),last=first+COLUMNS,joined=V().fromBufferAttribute(n,first).add(V().fromBufferAttribute(n,last)).normalize();n.setXYZ(first,...joined.toArray());n.setXYZ(last,...joined.toArray());
 }
 // Duplicate only UV aliases across the rear chart's angular cut. Positions
 // and smooth normals stay identical, so this never creates a geometric seam.
 const channels=Object.fromEntries(Object.entries(geometry.attributes).map(([key,a])=>[key,{size:a.itemSize,values:Array.from(a.array)}])),aliases=new Map(),unwrapped=[];
 for(let i=0;i<index.length;i+=3){const ids=index.slice(i,i+3),values=ids.map(id=>channels.uv.values[id*2]),crosses=Math.max(...values)-Math.min(...values)>Math.PI;
  for(const id of ids){if(!crosses||channels.uv.values[id*2]>=0){unwrapped.push(id);continue;}if(!aliases.has(id)){const next=channels.position.values.length/3;for(const [key,a]of Object.entries(channels)){const sample=a.values.slice(id*a.size,(id+1)*a.size);if(key==='uv')sample[0]+=TAU;a.values.push(...sample);}aliases.set(id,next);}unwrapped.push(aliases.get(id));}
 }
 for(const [key,a]of Object.entries(channels))geometry.setAttribute(key,new T.Float32BufferAttribute(a.values,a.size));geometry.setIndex(unwrapped);geometry.computeTangents();
 const finalNormal=geometry.attributes.normal,tangent=geometry.attributes.tangent;
 for(let id=0;id<tangent.count;id++){const norm=V().fromBufferAttribute(finalNormal,id),tan=V(tangent.getX(id),tangent.getY(id),tangent.getZ(id));if(!tan.toArray().every(Number.isFinite)||tan.lengthSq()<.5){tan.set(Math.abs(norm.x)<.8?1:0,0,Math.abs(norm.x)<.8?0:1);tan.addScaledVector(norm,-tan.dot(norm)).normalize();}else tan.normalize();tangent.setXYZW(id,...tan.toArray(),Math.abs(tangent.getW(id))===1?tangent.getW(id):1);}
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const data={position:geometry.attributes.position.array.slice(),normal:finalNormal.array.slice(),uv:geometry.attributes.uv.array.slice(),hairFade:geometry.attributes.hairFade.array.slice(),tangent:tangent.array.slice(),index:geometry.index.array.slice(),bounds:geometry.boundingBox.clone(),sphere:geometry.boundingSphere.clone(),evidence:{version:2,columns:COLUMNS,rows:ROWS,vertices:geometry.attributes.position.count,triangles:index.length/3,connectedShell:true,sourceHeadFitted:true,asymmetricSweep:true,partFurrow:true,templeTaper:true,earEnvelope:true,rearTieComb:true,bareHeadOnly:true,sourceGeometryRetained:true}};
 geometry.dispose();templates.set(kit,data);return data;
}

export function createSweptCrownGeometry(T,kit){
 const data=crownTemplate(T,kit),g=withCrownIdentity(()=>new T.BufferGeometry());
 for(const [name,size]of [['position',3],['normal',3],['uv',2],['hairFade',1],['tangent',4]])g.setAttribute(name,new T.Float32BufferAttribute(data[name].slice(),size));
 g.setIndex(new T.BufferAttribute(data.index.slice(),1));g.boundingBox=data.bounds.clone();g.boundingSphere=data.sphere.clone();g.userData.sweptCrown={...data.evidence};return g;
}

export function installSweptCrown(T,rig){
 if(!rig?.kit||typeof rig.setHair!=='function'||rig.sweptCrown)return rig;
 const setHair=rig.setHair,dispose=rig.dispose;let dead=false,active=null,lastGroup=null;
 const stats={rebuilds:0,removedFrontMeshes:0,retiredOwnedMaterials:0,skipped:0};
 function apply(){
  if(dead||!rig.hair||rig.hair===lastGroup)return;
  const group=rig.hair,fringe=group.children.find(m=>m.isMesh&&m.geometry===rig.kit.gatheredCrown),cap=group.children.find(m=>m.isMesh&&m!==fringe&&m.geometry?.attributes.hairFade&&m.material?.alphaToCoverage);
  active=null;lastGroup=group;
  if(rig.u?.uHelmet?.value>.5||!fringe||!cap||!fringe.geometry.index?.count){stats.skipped++;return;}
  const geometry=createSweptCrownGeometry(T,rig.kit),previous=cap.geometry,previousOwned=cap.userData.ownGeo;
  cap.geometry=geometry;cap.userData.ownGeo=true;cap.name='Rider_Swept_Crown';cap.castShadow=true;
  fringe.removeFromParent();fringe.userData.hairMassResource?.dispose();
  if(fringe.userData.ownMat&&fringe.material!==cap.material){for(const material of Array.isArray(fringe.material)?fringe.material:[fringe.material]){material.dispose();stats.retiredOwnedMaterials++;}}
  // gatheredCrown and ordinary scalp are resident kit geometry. Only an owned
  // previous scalp copy may be retired; the shared source is never disposed.
  if(previousOwned&&previous!==rig.kit.scalps?.gathered)previous.dispose();
  stats.rebuilds++;stats.removedFrontMeshes++;active=cap;
 }
 rig.setHair=function(...args){const result=setHair.apply(this,args);apply();return result;};
 rig.dispose=function(...args){if(dead)return;dead=true;active=null;lastGroup=null;return dispose.apply(this,args);};
 rig.sweptCrown={inspect(){return{...stats,active:!!active,disposed:dead,geometry:active?.geometry.uuid||null};}};
 apply();return rig;
}
