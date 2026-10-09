import {createTextilePanels as createSleevePanels} from './rider-textile-panels.js?v=character-polish-20261009';

// Repeating prints use distance around a fitted torso section. The previous
// planar x coordinate has zero density at the side of the body.
const REPEATING=new Set([1,6,7,14,15,16,17,19,20,21,22]);
const ROWS=24;
export function createTextilePanels(THREE,kit){
 const sleeves=createSleevePanels(THREE,kit),owned=new WeakSet();
 let profile=null;
 function sections(){
  if(profile)return profile;
  const geometry=kit.connectedWardrobe.shirtGeometry,p=geometry.attributes.position,j=geometry.attributes.skinIndex,w=geometry.attributes.skinWeight;
  const armIds=new Set(kit.skin.skeleton.bones.flatMap((bone,i)=>/^(upperarm|lowerarm|hand)_[lr]$/.test(bone.name)?[i]:[]));
  const arm=new Float32Array(p.count),components=['getX','getY','getZ','getW'];
  for(let i=0;i<p.count;i++)for(const component of components)if(armIds.has(j[component](i)))arm[i]+=w[component](i);
  const torsoY=Array.from({length:p.count},(_,i)=>i).filter(i=>arm[i]<.5&&Math.abs(p.getX(i))<sleeves.shoulderX).map(i=>p.getY(i));
  const minY=Math.min(...torsoY)+.018,maxY=Math.min(kit.zones.neckY-.045,Math.max(...torsoY)-.018),rows=[];
  for(let row=0;row<ROWS;row++){
   const y=minY+(maxY-minY)*row/(ROWS-1),points=[];
   for(let t=0;t<geometry.index.count;t+=3){
    const ids=[0,1,2].map(k=>geometry.index.getX(t+k));
    for(let k=0;k<3;k++){
     const a=ids[k],b=ids[(k+1)%3],ay=p.getY(a),by=p.getY(b);
     if((ay<=y&&by>y)||(by<=y&&ay>y)){
      const blend=(y-ay)/(by-ay),ownership=arm[a]+(arm[b]-arm[a])*blend;
      const x=p.getX(a)+(p.getX(b)-p.getX(a))*blend,z=p.getZ(a)+(p.getZ(b)-p.getZ(a))*blend;
      if(ownership<.5&&Math.abs(x)<sleeves.shoulderX*1.2)points.push([x,z]);
     }
    }
   }
   if(points.length<8)throw Error('Torso textile section lacks source support at '+y);
   const minX=Math.min(...points.map(q=>q[0])),maxX=Math.max(...points.map(q=>q[0])),minZ=Math.min(...points.map(q=>q[1])),maxZ=Math.max(...points.map(q=>q[1]));
   const rx=(maxX-minX)*.5,rz=(maxZ-minZ)*.5,cz=(minZ+maxZ)*.5;
   if(rx<.04||rz<.035||![rx,rz,cz].every(Number.isFinite))throw Error('Invalid fitted textile section at '+y);
   rows.push({y,rx,rz,cz,samples:points.length});
  }
  profile={minY,maxY,rows,uniforms:rows.map(r=>new THREE.Vector3(r.rx,r.rz,r.cz))};
  return profile;
 }
 function material(m,design){
  sleeves.material(m,design);
  if(!REPEATING.has(design)||owned.has(m))return;
  owned.add(m);
  const field=sections(),previous=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=shader=>{
   previous(shader);
   const original='vec3 torsoColor=riderFabric(diffuseColor.rgb,vWardrobeBind);';
   if(!shader.fragmentShader.includes(original))throw Error('Torso textile source mapping missing');
   shader.uniforms.uTorsoSections={value:field.uniforms};
   shader.uniforms.uTorsoRange={value:new THREE.Vector2(field.minY,field.maxY)};
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform vec3 uTorsoSections[24];
uniform vec2 uTorsoRange;
float torsoArcSpeed(float angle,vec2 radii){
 vec2 tangent=vec2(cos(angle),sin(angle))*radii;
 return length(tangent);
}
vec3 torsoTextileCoordinate(vec3 p){
 float row=clamp((p.y-uTorsoRange.x)/(uTorsoRange.y-uTorsoRange.x),0.,1.)*23.;
 int lo=int(floor(row)),hi=min(lo+1,23);
 vec3 shape=mix(uTorsoSections[lo],uTorsoSections[hi],fract(row));
 float angle=atan(abs(p.x)/shape.x,abs(p.z-shape.z)/shape.y);
 // Four-point Gaussian quadrature of the ellipse's physical arc length.
 float arc=angle*.5*(
  .3478548451*(torsoArcSpeed(angle*.0694318442,shape.xy)+torsoArcSpeed(angle*.9305681558,shape.xy))+
  .6521451549*(torsoArcSpeed(angle*.3300094782,shape.xy)+torsoArcSpeed(angle*.6699905218,shape.xy)));
 // A torso section is no longer closed at the armhole/neck opening.
 // Preserve the established shoulder panel above the supported torso chart.
 float torsoMix=1.-smoothstep(uTorsoRange.y-.065,uTorsoRange.y,p.y);
 return vec3(mix(p.x,sign(p.x)*arc,torsoMix),p.y,p.z);
}
`).replace(original,'vec3 torsoColor=riderFabric(diffuseColor.rgb,torsoTextileCoordinate(vWardrobeBind));');
   m.userData.textileTorso8.compiled=true;
  };
  m.customProgramCacheKey=()=>key+'-torso-surface-distance8';
  m.userData.textileTorso8={version:8,design,compiled:false,sections:field.rows};
 }
 return {...sleeves,material,torsoSections:sections};
}
