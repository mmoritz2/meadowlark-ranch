import { refineRidingBootLast } from './rider-boot-last-fit.js?v=rider-fit74-20261010';
// Fitted riding-boot shell and leather finish. The measured tread support,
// top opening and anatomical skin weights keep their established geometry.
const bootTemplates = new WeakMap();
const fittedShells = new WeakMap();
function fittedBootShell(T,geometry,data){
 const cached=fittedShells.get(data);if(cached)return cached;
 const g=geometry.clone(),p=g.attributes.position,index=g.index,top=data.parameters.topY,sections=[],protectedOpening=new Set();
 // Keep every triangle touching the visible trouser underlap unchanged.
 for(let i=0;i<index.count;i+=3){const ids=[0,1,2].map(k=>index.getX(i+k));if(ids.some(id=>p.getY(id)>=top-.010))for(const id of ids)protectedOpening.add(id);}
 for(let j=0;j<=64;j++){
  const y=.08+(top-.08)*j/64,bounds=[{lo:[Infinity,Infinity],hi:[-Infinity,-Infinity]},{lo:[Infinity,Infinity],hi:[-Infinity,-Infinity]}];
  for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){const a=index.getX(i+k),b=index.getX(i+(k+1)%3),ya=p.getY(a),yb=p.getY(b);if((ya<y)===(yb<y)||Math.abs(ya-yb)<1e-10)continue;const t=(y-ya)/(yb-ya),x=p.getX(a)+(p.getX(b)-p.getX(a))*t,z=p.getZ(a)+(p.getZ(b)-p.getZ(a))*t,q=bounds[x>0?1:0];q.lo[0]=Math.min(q.lo[0],x);q.hi[0]=Math.max(q.hi[0],x);q.lo[1]=Math.min(q.lo[1],z);q.hi[1]=Math.max(q.hi[1],z);}
  if(j===64&&bounds.some(q=>!Number.isFinite(q.lo[0]))){sections.push(sections.at(-1));continue;}
  sections.push(bounds.map(q=>[(q.lo[0]+q.hi[0])*.5,(q.lo[1]+q.hi[1])*.5,(q.hi[0]-q.lo[0])*.5,(q.hi[1]-q.lo[1])*.5]));
 }
 const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);},controls=[[.022,0],[.070,0],[.095,.003],[.125,.0055],[.160,.0045],[top-.065,.0045],[top-.025,0]];
 const allowance=y=>{for(let k=1;k<controls.length;k++)if(y<=controls[k][0])return T.MathUtils.lerp(controls[k-1][1],controls[k][1],smooth(controls[k-1][0],controls[k][0],y));return 0;};
 let changed=0,maxDisplacementM=0,protectedSoleVertices=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y<=.0220001){protectedSoleVertices++;continue;}if(protectedOpening.has(i))continue;
  const f=T.MathUtils.clamp((y-.08)/(top-.08)*64,0,64),a=Math.floor(f),b=Math.min(64,a+1),side=x>0?1:0,q=sections[a][side].map((v,k)=>T.MathUtils.lerp(v,sections[b][side][k],f-a)),inset=allowance(y);
  let nx=q[0]+(x-q[0])*(1-inset/Math.max(.001,q[2])),nz=q[1]+(z-q[1])*(1-inset/Math.max(.001,q[3]));
  // Lower only the forward toe crown, leaving the welt, sole and heel intact.
  const toe=smooth(.025,.090,z)*(1-smooth(.100,.155,y)),lift=smooth(.022,.058,y),ny=y-.0055*toe*lift;
  const toeInset=.0020*toe*smooth(.022,.060,y);nx-=T.MathUtils.clamp((x-q[0])/Math.max(.001,q[2]),-1,1)*toeInset;
  const delta=Math.hypot(nx-x,ny-y,nz-z);if(delta>1e-9)changed++;maxDisplacementM=Math.max(maxDisplacementM,delta);p.setXYZ(i,nx,ny,nz);
 }
 if(!p.array.every(Number.isFinite))throw Error('Nonfinite fitted boot shell');g.computeVertexNormals();
 const result={positions:p.array.slice(),normals:g.attributes.normal.array.slice(),evidence:{version:1,changedVertices:changed,maxDisplacementM,shaftAllowanceReductionM:.0045,ankleAllowanceReductionM:.0055,toeCrownReductionM:.0055,protectedSoleVertices,protectedOpeningVertices:protectedOpening.size,soleMaxYM:.0220001,openingUnderlapM:.010}};g.dispose();fittedShells.set(data,result);return result;
}
function prepareBootTemplate(T, geometry, data) {
 const cached=bootTemplates.get(data);if(cached)return cached;
 const p=geometry.attributes.position,normal=geometry.attributes.normal,idx=geometry.index,top=data.parameters.topY;
 const edges=new Map();
 for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){
  const a=idx.getX(i+k),b=idx.getX(i+(k+1)%3),key=a<b?a+':'+b:b+':'+a;
  const item=edges.get(key);if(item)item.count++;else edges.set(key,{a,b,count:1});
 }
 const rimEdges=[...edges.values()].filter(e=>e.count===1);
 if(rimEdges.some(e=>Math.abs(p.getY(e.a)-top)>1e-6||Math.abs(p.getY(e.b)-top)>1e-6))throw Error('Boot rim contains an unexpected open edge');
 // A rolled leather opening with the exact boundary's skinning coefficients.
 // Its inner/outer sides continue below the source edge, hiding neither calf
 // nor trousers and leaving the established trouser coverage plane intact.
 const vertices=[],joints=[],weights=[],triangles=[],rimSource=[];const columns=9,owned=new Map();
 const add=id=>{
  if(owned.has(id))return owned.get(id);
  const offset=vertices.length/3,n=new T.Vector3(normal.getX(id),0,normal.getZ(id)).normalize();
  for(let k=0;k<columns;k++){
   const a=-Math.PI*.5+k/(columns-1)*Math.PI*2;
   const radial=Math.cos(a)*.0015,vertical=Math.sin(a)*.002-.0018;
   vertices.push(p.getX(id)+n.x*radial,p.getY(id)+vertical,p.getZ(id)+n.z*radial);
   for(const f of ['getX','getY','getZ','getW']){joints.push(geometry.attributes.skinIndex[f](id));weights.push(geometry.attributes.skinWeight[f](id));}
   rimSource.push(id);
  }
  owned.set(id,offset);return offset;
 };
 for(const e of rimEdges){const a=add(e.a),b=add(e.b);for(let k=0;k<columns-1;k++)triangles.push(a+k,b+k,a+k+1,b+k,b+k+1,a+k+1);}
 const rim=new T.BufferGeometry();rim.setAttribute('position',new T.Float32BufferAttribute(vertices,3));rim.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));rim.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));rim.setIndex(triangles);rim.computeVertexNormals();rim.computeBoundingSphere();rim.userData.sourceVertex=rimSource;
 // Rest-space cross sections locate the zip and seams on both boots. They do
 // not participate in deformation; the canonical skeleton remains authoritative.
 const sections=[];
 for(let j=0;j<=40;j++){
  const y=.08+(top-.08)*j/40,sideBounds=[{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity},{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity}];
  for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){
   const a=idx.getX(i+k),b=idx.getX(i+(k+1)%3),ya=p.getY(a),yb=p.getY(b);
   if((ya<y)===(yb<y)||Math.abs(ya-yb)<1e-10)continue;
   const t=(y-ya)/(yb-ya),x=p.getX(a)+(p.getX(b)-p.getX(a))*t,z=p.getZ(a)+(p.getZ(b)-p.getZ(a))*t,s=sideBounds[x>0?1:0];s.minX=Math.min(s.minX,x);s.maxX=Math.max(s.maxX,x);s.minZ=Math.min(s.minZ,z);s.maxZ=Math.max(s.maxZ,z);
  }
  // Float32 top vertices may sit a few nanometers below the JSON cut plane.
  if(j===40&&sideBounds.some(s=>!Number.isFinite(s.minX))){sections.push(sections[sections.length-1]);continue;}
  sections.push(sideBounds.map(s=>[(s.minX+s.maxX)*.5,(s.minZ+s.maxZ)*.5,(s.maxX-s.minX)*.5,(s.maxZ-s.minZ)*.5]));
 }
 const local=[];
 for(let i=0;i<p.count;i++){
  const f=T.MathUtils.clamp((p.getY(i)-.08)/(top-.08)*40,0,40),a=Math.floor(f),b=Math.min(40,a+1),s=p.getX(i)>0?1:0,q=sections[a][s].map((v,k)=>T.MathUtils.lerp(v,sections[b][s][k],f-a));
  local.push((p.getX(i)-q[0])/Math.max(.001,q[2])*(s?1:-1),p.getY(i), (p.getZ(i)-q[1])/Math.max(.001,q[3]));
 }
 if(!local.every(Number.isFinite))throw Error('Nonfinite boot section coordinates');
 const template={local:new Float32Array(local),rim,boundaryVertices:owned.size,rolledEdgeVertices:rimSource.length};bootTemplates.set(data,template);return template;
}
export function finishRidingBoots(T, geometry, data, bootUniform) {
 const fit=fittedBootShell(T,geometry,data);geometry.attributes.position.array.set(fit.positions);geometry.attributes.normal.array.set(fit.normals);geometry.computeBoundingSphere();
 const last=refineRidingBootLast(T,geometry,data);
 const template=prepareBootTemplate(T,geometry,data),top=data.parameters.topY,rim=template.rim.clone();
 rim.userData={sourceVertex:template.rim.userData.sourceVertex.slice()};
 geometry.setAttribute('riderBootLocal',new T.Float32BufferAttribute(template.local.slice(),3));
 const mat=new T.MeshStandardMaterial({color:'#372923',roughness:.48,metalness:0});
 mat.onBeforeCompile=shader=>{
  shader.uniforms.uRidingBoot=bootUniform;shader.uniforms.uRidingBootTop={value:top};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 riderBootLocal; varying vec3 vRidingBootLocal; varying vec3 vRidingBootBind;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRidingBootLocal=riderBootLocal;vRidingBootBind=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   uniform vec3 uRidingBoot; uniform float uRidingBootTop; varying vec3 vRidingBootLocal,vRidingBootBind;
   float bootLine(float d,float width){return 1.0-smoothstep(width,width+max(fwidth(d),.00015),abs(d));}
   vec3 bootLeatherNormal(vec3 position,vec3 sourceNormal,vec2 heightDerivative){
    vec3 dx=dFdx(position),dy=dFdy(position),rx=cross(dy,sourceNormal),ry=cross(sourceNormal,dx);
    float determinant=dot(dx,rx);
    vec3 gradient=sign(determinant)*(heightDerivative.x*rx+heightDerivative.y*ry);
    if(abs(determinant)<1e-12)return sourceNormal;
    vec3 detailed=normalize(abs(determinant)*sourceNormal-gradient);
    return normalize(mix(sourceNormal,detailed,.70));
   }

  `).replace('#include <map_fragment>',`#include <map_fragment>
   float y=vRidingBootBind.y, angle=atan(vRidingBootLocal.x,vRidingBootLocal.z);
   float rear=3.14159265-abs(angle), shaft=smoothstep(.145,.185,y)*(1.0-smoothstep(uRidingBootTop-.028,uRidingBootTop-.020,y));
   float zipTape=bootLine(rear*.058,.0033)*shaft;
   float zipTeeth=bootLine(rear*.058,.0011)*shaft*(.6+.4*smoothstep(.25,.4,fract(y/.0036)));
   float rearStitch=(bootLine(rear*.058-.0045,.00045)+bootLine(rear*.058-.0059,.00035))*shaft*smoothstep(.22,.35,fract(y/.0048));
   float topStitch=bootLine(y-(uRidingBootTop-.009),.00045)*smoothstep(.25,.4,fract(angle*22.0));
   float topBand=smoothstep(uRidingBootTop-.018,uRidingBootTop-.017,y);
   float vampSeam=bootLine(y-(.135+.033*max(vRidingBootLocal.z,0.0)),.0007)*(1.0-smoothstep(.55,.9,abs(angle)));
   float sideSeam=bootLine((angle+1.75)*.050,.0008)*shaft;
   float grain=sin(vRidingBootBind.x*7800.0+sin(y*5100.0))*sin((vRidingBootBind.z+y*.37)*6400.0);
   float resolved=1.0-smoothstep(.7,2.4,max(fwidth(vRidingBootBind.x*7800.0),fwidth((vRidingBootBind.z+y*.37)*6400.0)));
   vec3 leather=uRidingBoot*(.96+.014*grain*resolved);
   leather*=1.0-.1*topBand-.20*vampSeam-.18*sideSeam-.20*zipTape;
   leather=mix(leather,uRidingBoot*.64,clamp(topStitch+rearStitch,0.0,1.0)*.65);
   leather=mix(leather,vec3(.20,.18,.14),zipTeeth*.55);
   float outsole=1.0-smoothstep(.011,.014,y);
   float heel=(1.0-smoothstep(-.027,-.012,vRidingBootBind.z))*(1.0-smoothstep(.027,.032,y));
   float welt=bootLine(y-.023,.0013);
   leather=mix(leather,uRidingBoot*.52,welt*.55);
   diffuseColor.rgb=mix(leather,vec3(.020,.017,.014),max(outsole,heel));
  `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float polishedVamp=(1.0-smoothstep(.10,.21,y))*smoothstep(-.035,.035,vRidingBootBind.z);
   float leatherRoughness=mix(.49,.41,polishedVamp)+.014*grain*resolved;
   roughnessFactor=mix(leatherRoughness,.76,max(outsole,heel));
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Differentiate only analytic heights. Apply derivative-based visibility
   // afterwards so the shader never takes derivatives of fwidth/derivatives.
   float rawVamp=(1.0-smoothstep(.00025,.0010,abs(y-(.135+.033*max(vRidingBootLocal.z,0.0)))))*(1.0-smoothstep(.55,.9,abs(angle)));
   float rawSide=(1.0-smoothstep(.00030,.00115,abs((angle+1.75)*.050)))*shaft;
   float relief=(-.00016*rawVamp-.00012*rawSide+.00010*topBand)*(1.0-max(outsole,heel));
   float grainHeight=.000016*grain*(1.0-max(outsole,heel));
   float seamVisibility=1.0-smoothstep(.0007,.003,length(fwidth(vRidingBootBind)));
   vec2 dh=seamVisibility*vec2(dFdx(relief),dFdy(relief))+resolved*vec2(dFdx(grainHeight),dFdy(grainHeight));
   normal=bootLeatherNormal(-vViewPosition,normal,dh);
  `);
 };
 mat.customProgramCacheKey=()=> 'riding-boot-leather72b-'+top.toFixed(6);
 const rimMaterial=new T.MeshStandardMaterial({color:'#372923',roughness:.48,side:T.DoubleSide});rimMaterial.onBeforeCompile=shader=>{shader.uniforms.uRidingBoot=bootUniform;shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uRidingBoot;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=uRidingBoot*.80;');};rimMaterial.customProgramCacheKey=()=> 'riding-boot-rolled-rim1';
 return {material:mat,pieces:[{name:'Riding_Boot_Rolled_Edge',geometry:rim,material:rimMaterial}],evidence:{version:3,sourceShellUnchanged:false,sourceWeightsUnchanged:true,topY:top,boundaryVertices:template.boundaryVertices,rolledEdgeVertices:template.rolledEdgeVertices,measuredTreadSupportUnchanged:true,restSoleHeightUnchanged:true,rearZip:true,stitchedLeatherPanels:true,fit:fit.evidence,last}};
}
