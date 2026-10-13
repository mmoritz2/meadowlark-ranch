export const BOTANICAL_PETALS=Object.freeze({profile:'physical-meadow-petals-1',triangles:72,flowers:3,leafPairs:3,newDrawOwners:0});
// Replace only the already-constructed prototype: its exact original bounds
// remain the course/plant classifier's conservative envelope.
export function dressBotanicalPetals({THREE:T,geometry:g,material:m}){
 if(!g?.attributes.position||!m?.isMeshStandardMaterial||!m.vertexColors)throw Error('Actual meadow petal owner required');
 if(!g.boundingSphere)g.computeBoundingSphere();if(!g.boundingBox)g.computeBoundingBox();
 const bounds=g.boundingBox.clone(),sphere=g.boundingSphere.clone(),uuid=g.uuid,materialUUID=m.uuid,P=[],U=[],C=[],R=[],I=[],color=new T.Color();
 const face=(points,hex,role)=>{const at=P.length/3;color.set(hex);for(let i=0;i<points.length;i++){P.push(...points[i]);U.push(i===1||i===2?1:0,i>=2?1:0);C.push(color.r,color.g,color.b);R.push(role);}I.push(at,at+1,at+2);if(points.length===4)I.push(at,at+2,at+3);};
 const branches=[{root:[-.115,.075],top:[-.078,.092],height:.77,heading:.38},{root:[.10,.045],top:[.078,.060],height:.90,heading:2.41},{root:[.008,-.115],top:[.033,-.095],height:.961,heading:4.29}];
 for(let flower=0;flower<branches.length;flower++){
  const b=branches[flower],point=(t,a,r)=>[b.root[0]+(b.top[0]-b.root[0])*t+Math.cos(a)*r,b.height*t,b.root[1]+(b.top[1]-b.root[1])*t+Math.sin(a)*r];
  // A closed-sided triangular stem; the flower centre covers its upper opening.
  for(let side=0;side<3;side++){const a=b.heading+side*Math.PI*2/3,c=b.heading+(side+1)*Math.PI*2/3;face([point(0,c,.009),point(0,a,.009),point(1,a,.004),point(1,c,.004)],side%2?'#62863d':'#547834',0);}
  for(let leaf=0;leaf<2;leaf++){
   const t=.29+leaf*.25,root=point(t,b.heading,.005),a=b.heading+leaf*2.87,dx=Math.cos(a),dz=Math.sin(a),len=.082+leaf*.015,w=.019;
   const left=[root[0]+dx*len*.53-dz*w,root[1]+.022,root[2]+dz*len*.53+dx*w],tip=[root[0]+dx*len,root[1]+.031,root[2]+dz*len],right=[root[0]+dx*len*.52+dz*w,root[1]+.009,root[2]+dz*len*.52-dx*w];
   face([root,left,tip,right],leaf?'#709747':'#5a843b',0);
  }
  // Unequal five-petal lobes have a shallow ridge and a drooping outer edge.
  for(let petal=0;petal<5;petal++){
   const a=b.heading+petal*Math.PI*2/5+.045*Math.sin(petal*2.1+flower),dx=Math.cos(a),dz=Math.sin(a),radial=.056+.006*Math.sin(petal*1.8+flower),w=.021+.003*Math.cos(petal*2.4+flower);
   const p=(r,s,y)=>[b.top[0]+dx*r-dz*s,b.height+y,b.top[1]+dz*r+dx*s];
   face([p(.010,0,.001),p(radial*.57,w,.004),p(radial,0,-.010),p(radial*.56,-w,.008)],petal%2?'#faf8ee':'#eeeadd',1);
  }
  const centre=[b.top[0],b.height+.007,b.top[1]],ring=Array.from({length:4},(_,i)=>{const a=b.heading+i*Math.PI/2;return[b.top[0]+Math.cos(a)*.017,b.height+.002,b.top[1]+Math.sin(a)*.017];});
  for(let i=0;i<4;i++)face([centre,ring[(i+1)%4],ring[i]],i%2?'#dcc262':'#ead47b',0);
 }
 if(I.length!==BOTANICAL_PETALS.triangles*3)throw Error('Botanical triangle budget');
 for(let i=0;i<P.length;i+=3){const v=new T.Vector3(P[i],P[i+1],P[i+2]);if(!bounds.containsPoint(v)||sphere.center.distanceTo(v)>sphere.radius+1e-7)throw Error('Botanical form exceeded original conservative envelope');}
 g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('botanicalPigment',new T.Float32BufferAttribute(R,1));g.setIndex(I);g.deleteAttribute('normal');g.computeVertexNormals();g.boundingBox.copy(bounds);g.boundingSphere.copy(sphere);
 const compile=m.onBeforeCompile,key=m.customProgramCacheKey;m.map=null;
 m.onBeforeCompile=(sh,renderer)=>{
  compile.call(m,sh,renderer);
  sh.vertexShader='attribute float botanicalPigment;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
   #ifdef USE_COLOR
   if(botanicalPigment<.5)vColor.rgb=color.rgb;
   #endif`);
  // Inverse transpose of the existing source wind's two horizontal shears.
  sh.vertexShader=sh.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   #ifdef USE_INSTANCING
   vec2 botanicalIP=instanceMatrix[3].xz;
   float botanicalPhase=botanicalIP.x*.31+botanicalIP.y*.23;
   float botanicalWindX=sin(uFT*1.15+botanicalPhase)*.045+sin(uFT*2.73+botanicalPhase*1.9)*.015;
   float botanicalWindZ=cos(uFT*.93+botanicalPhase)*.025;
   objectNormal.y-=botanicalWindX*objectNormal.x+botanicalWindZ*objectNormal.z;
   #endif`);
 };
 m.customProgramCacheKey=()=>key.call(m)+':'+BOTANICAL_PETALS.profile;m.needsUpdate=true;
 g.userData.botanicalPetals={...BOTANICAL_PETALS,vertices:g.attributes.position.count,originalBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},originalSphere:{center:sphere.center.toArray(),radius:sphere.radius}};m.userData.botanicalPetals=BOTANICAL_PETALS.profile;
 if(g.uuid!==uuid||m.uuid!==materialUUID)throw Error('Botanical source-owner identity changed');
 return{...g.userData.botanicalPetals,geometryBytes:Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,g.index.array.byteLength),newGeometryObjects:0,newMaterials:0,newTextures:0};
}
