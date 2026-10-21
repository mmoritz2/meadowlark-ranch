// Original Amberwood litter only. Frostpine keeps its shared flat sled geometry.
export const AMBERWOOD_LEAF_PROFILE='amberwood-worked-clearing-1';
let resourceSerial=0;
function privateResources(make){
 const ambient=Math.random;let state=(0x6b5ea421+Math.imul(++resourceSerial,0x9e3779b9))>>>0;
 Math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 try{return make();}finally{Math.random=ambient;}
}
export function createAmberwoodLeafGeometry(T){
 return privateResources(()=>{
  // Five irregular lobes and a narrow stem; shallow ridge/curl catches the sun
  // without another material, alpha texture, or rectangular billboard.
  const outline=[[0,-.56],[.09,-.24],[.30,-.38],[.23,-.15],[.47,-.08],[.23,.02],[.34,.22],[.13,.18],[.04,.35],[.025,.50],[-.025,.50],[-.04,.35],[-.13,.18],[-.34,.22],[-.23,.02],[-.47,-.08],[-.23,-.15],[-.30,-.38],[-.09,-.24]],p=[0,.035,0],uv=[.5,.5],indices=[];
  for(let i=0;i<outline.length;i++){const[x,z]=outline[i];p.push(x,.045*(x/.47)**2+.012*Math.sin(z*8+i*.71),z);uv.push(x+.5,z+.56);indices.push(0,(i+1)%outline.length+1,i+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.amberwoodLeaves={profile:AMBERWOOD_LEAF_PROFILE,source:'original-lobed-curled-leaf',triangles:indices.length/3};return g;
 });
}

export function seatAmberwoodLeafLitter({mesh,items,groundH}){
 if(!mesh?.isInstancedMesh||mesh.count!==items.length||typeof groundH!=='function')throw Error('Actual Amberwood litter owner required');
 const a=mesh.instanceMatrix.array,p=mesh.geometry.attributes.position,index=mesh.geometry.index.array;
 let minGap=Infinity,maxGap=-Infinity,steep=0;
 for(let row=0;row<items.length;row++){
  const it=items[row],o=row*16,x=it.x,z=it.z,y=groundH(x,z),variation=row%9===0?1.2:1,sx=it.sx*.28*variation,sz=it.sz*.28*variation,sy=Math.sqrt(sx*sz),c=Math.cos(it.ry),s=Math.sin(it.ry);
  let gx=(groundH(x+.06,z)-groundH(x-.06,z))/.12,gz=(groundH(x,z+.06)-groundH(x,z-.06))/.12;
  const grade=Math.hypot(gx,gz);if(grade>1.4){gx*=1.4/grade;gz*=1.4/grade;steep++;}
  if(!Number.isFinite(x+y+z+gx+gz))throw Error('Nonfinite Amberwood litter contact');
  // Preserve source XZ/yaw exactly. The vertical row follows the local ground
  // tangent, then every vertex and triangle centre contributes to seating.
  a[o]=c*sx;a[o+1]=(gx*c-gz*s)*sx;a[o+2]=-s*sx;a[o+3]=0;
  a[o+4]=0;a[o+5]=sy;a[o+6]=0;a[o+7]=0;
  a[o+8]=s*sz;a[o+9]=(gx*s+gz*c)*sz;a[o+10]=c*sz;a[o+11]=0;
  a[o+12]=x;a[o+13]=y;a[o+14]=z;a[o+15]=1;
  let required=-Infinity;
  const sample=(px,py,pz,measure=false)=>{
   const wx=a[o+12]+a[o]*px+a[o+8]*pz,wz=a[o+14]+a[o+2]*px+a[o+10]*pz,wy=a[o+13]+a[o+1]*px+a[o+5]*py+a[o+9]*pz,ground=groundH(wx,wz);
   if(!Number.isFinite(ground))throw Error('Nonfinite Amberwood leaf support');
   if(measure){const gap=wy-ground;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);}else required=Math.max(required,ground-wy);
  };
  for(let i=0;i<p.count;i++)sample(p.getX(i),p.getY(i),p.getZ(i));
  for(let i=0;i<index.length;i+=3){const j=index[i],k=index[i+1],l=index[i+2];sample((p.getX(j)+p.getX(k)+p.getX(l))/3,(p.getY(j)+p.getY(k)+p.getY(l))/3,(p.getZ(j)+p.getZ(k)+p.getZ(l))/3);}
  a[o+13]=y+required+.009;
  for(let i=0;i<p.count;i++)sample(p.getX(i),p.getY(i),p.getZ(i),true);
 }
 mesh.name='Amberwood | grounded lobed leaf litter';mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
 const state={profile:AMBERWOOD_LEAF_PROFILE,count:items.length,triangles:items.length*index.length/3,minSampledGroundGap:minGap,maxSampledGroundGap:maxGap,steepContactFits:steep,sourceXZAndYawRetained:true,originalMaterialAndPaletteRetained:true};mesh.userData.amberwoodLeaves=state;return state;
}
