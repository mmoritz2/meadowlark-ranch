import {fittedZip} from './rider-fitted-zip.js?v=character-finish68-20261010';
import {surfaceSampler,trimGarment} from './rider-fit.js?v=tailored-coats69-20261010';

// Actual default technical silhouette; distinct from workshirt leaf collars.
// Detail surfaces inherit the actual draped shirt's triangle weights. The
// collar shares the literal neck edge; tape and stitching sit on that surface.
export function riding98Finish(T,kit,garment,data,{color='#426776',trim='#263e4b',thread='#71858c'}={}){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),get=['getX','getY','getZ','getW'];
 const parent=garment.geometry.clone();if(!parent.attributes.uv)parent.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(parent.attributes.position.count*2),2));parent.computeVertexNormals();
 const attr=parent.attributes,point=id=>({p:V().fromBufferAttribute(attr.position,id),joints:get.map(k=>attr.skinIndex[k](id)),weights:get.map(k=>attr.skinWeight[k](id))});
 const geo=(vertices,indices)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(v=>v.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(vertices.flatMap(v=>v.joints),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(vertices.flatMap(v=>v.weights),4));g.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap(v=>[v.p.x*4,v.p.y*4]),2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const fabric=(c,rib=false)=>{const m=new T.MeshStandardMaterial({color:c,roughness:.88,metalness:0,side:T.DoubleSide});m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vClothDetail;').replace('#include <begin_vertex>','#include <begin_vertex>\nvClothDetail=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vClothDetail;').replace('#include <map_fragment>',`#include <map_fragment>
 float warp=vClothDetail.x*${rib?'1900.0':'3100.0'},weft=vClothDetail.y*2800.0;
 float resolved=1.0-smoothstep(.8,3.0,max(fwidth(warp),fwidth(weft)));
 float weave=sin(warp)*${rib?'1.0':'sin(weft)'};
 diffuseColor.rgb*=1.0+weave*resolved*${rib?'.038':'.022'};`);};m.customProgramCacheKey=()=> 'fitted-default-technical98-'+(rib?'rib':'weave');return m;};
 const pieces=[],push=(name,geometry,material)=>{pieces.push({name,geometry,material,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});return pieces.at(-1);};
 const neck=data.boundaryLoops.find(l=>l.label==='neck').ids,neckPoints=neck.map(point),center=neckPoints.reduce((p,v)=>p.add(v.p),V()).divideScalar(neck.length);
 // The sewn lower edge follows the shirt. The folded crown is a coherent
 // neckline, rather than a constant extrusion of its shoulder-side rises.
 const crownY=Math.max(...neckPoints.map(v=>v.p.y))+.015,height=crownY-Math.min(...neckPoints.map(v=>v.p.y));
 const collarVertices=[],collarIndices=[],profile=[[0,0],[.28,.00025],[.70,.00040],[.93,.00040],[1,.00005],[.98,-.00055],[.72,-.00070],[.28,-.00065],[0,-.00065]];
 for(const [rise,ease]of profile)for(const v of neckPoints){const radial=V(v.p.x-center.x,0,v.p.z-center.z).normalize(),p=v.p.clone().addScaledVector(radial,ease-.009*rise),frontness=Math.max(0,radial.z),targetY=crownY-.003*frontness; p.y=T.MathUtils.lerp(v.p.y,targetY,rise);collarVertices.push({...v,p});}
 for(let row=0;row<profile.length-1;row++)for(let i=0;i<neck.length;i++){const a=row*neck.length+i,b=row*neck.length+(i+1)%neck.length,c=a+neck.length,d=b+neck.length;collarIndices.push(a,b,c,b,d,c);}
 const collar=push('Technical_Stand_Collar',geo(collarVertices,collarIndices),fabric(color));
 const hem=data.boundaryLoops.find(l=>l.label==='hem').ids,hemY=Math.max(...hem.map(i=>attr.position.getY(i))),cuffX=Math.max(...data.boundaryLoops.filter(l=>l.label.startsWith('cuff')).flatMap(l=>l.ids.map(i=>Math.abs(attr.position.getX(i)))));
 // Narrow supported cuff follows the actual sleeve surface. The folded return
 // owns the literal wrist edge; no wide annulus or added body-clearance reserve.
 const cuffSampler=surfaceSampler(T,[{...garment,geometry:parent}]);
 for(const side of[-1,1]){
  const loop=data.boundaryLoops.find(l=>l.label.startsWith('cuff')&&Math.sign(attr.position.getX(l.ids[0]))===side),edge=loop.ids.map(point),mid=edge.reduce((p,v)=>p.add(v.p),V()).divideScalar(edge.length),vertices=[],indices=[],rows=[[-.010,.00025],[-.0010,.00025],[0,.00042],[.00015,.00010],[0,-.00028],[-.0010,-.00028]];
  for(const[axial,relief]of rows)for(const v of edge){
   const radial=v.p.clone().sub(mid);radial.x=0;radial.normalize();let p=v.p.clone(),field=v,n=radial;
   if(axial<-.0005){const origin=mid.clone();origin.x=p.x+side*axial;origin.addScaledVector(radial,.14);const h=cuffSampler.cast(origin,radial.clone().negate());if(!h)throw Error('Default cuff lacks actual sleeve support');p=h.point.clone();field=h;n=h.normal.clone();if(n.dot(radial)<0)n.negate();}
   else p.x+=side*axial;
   vertices.push({p:p.addScaledVector(n,relief),joints:field.joints,weights:field.weights});
  }
  for(let row=0;row<rows.length-1;row++)for(let i=0;i<edge.length;i++){const a=row*edge.length+i,b=row*edge.length+(i+1)%edge.length,c=a+edge.length,d=b+edge.length;indices.push(a,b,c,b,d,c);}
  push('Technical_Thin_Supported_Cuff_'+side,geo(vertices,indices),fabric(color,true));
 }
 cuffSampler.dispose();
 const sampler=surfaceSampler(T,[{...garment,geometry:parent},collar]);
 // Two-sided folded collar faces can point inward; front attachments need outward relief.
 const fit=(x,y,offset=.001)=>{const h=sampler.cast(V(x,y,.6),V(0,0,-1));if(!h)return null;const normal=h.normal.clone();if(normal.z<0)normal.negate();return{p:h.point.clone().addScaledVector(normal,offset),joints:h.joints,weights:h.weights};};
 const ribbon=(path,width,offset=.001)=>{const vertices=[],indices=[];let previous=null;for(const [x,y]of path){const a=fit(x-width*.5,y,offset),b=fit(x+width*.5,y,offset);if(!a||!b){previous=null;continue;}const i=vertices.length;vertices.push(a,b);if(previous!==null)indices.push(previous,previous+1,i,previous+1,i+1,i);previous=i;}return geo(vertices,indices);};
 const front=neckPoints.filter(v=>v.p.z>center.z).sort((a,b)=>Math.abs(a.p.x)-Math.abs(b.p.x))[0].p,top=crownY-.006,bottom=front.y-.095,path=Array.from({length:82},(_,i)=>[0,bottom+(top-bottom)*i/81]);
 push('Technical_Quarter_Zip_Tape',ribbon(path,.0055,.0011),fabric(trim));
 for(const p of fittedZip(T,{fit,geo,path,trim}))push(p.name,p.geometry,p.material);
 const seamVertices=[],seamIndices=[];
 const append=g=>{const offset=seamVertices.length;for(let i=0;i<g.attributes.position.count;i++)seamVertices.push({p:V().fromBufferAttribute(g.attributes.position,i),joints:get.map(k=>g.attributes.skinIndex[k](i)),weights:get.map(k=>g.attributes.skinWeight[k](i))});for(const i of g.index.array)seamIndices.push(offset+i);g.dispose();};
 // Fitted side material panels use the real torso triangles and transported
 // weights. Low contrast fabric/roughness gives construction without a new
 // painted graphic or changing the saved shirt dye.
 const panelMat=fabric(new T.Color(color).multiplyScalar(.94));panelMat.roughness=.96;
 for(const side of [-1,1]){
  const verts=[],ids=[],rows=40,cols=5;
  for(let j=0;j<=rows;j++){const t=j/rows,y=hemY+.020+(front.y-.055-hemY-.020)*t;let lo=.025,hi=.210;for(let b=0;b<18;b++){const x=(lo+hi)*.5;if(fit(side*x,y,0))lo=x;else hi=x;}const inner=lo*.70,width=lo*.13;for(let k=0;k<=cols;k++){const v=fit(side*(inner+width*k/cols),y,.00050);if(!v)throw Error('Technical side panel lacks actual torso support');verts.push(v);}}
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const a=j*(cols+1)+k,b=a+1,c=a+cols+1,d=c+1;ids.push(a,b,c,b,d,c);}
  push('Technical_Fitted_Side_Panel_'+side,geo(verts,ids),panelMat);
 }
 for(const side of [-1,1]){
  const panel=Array.from({length:75},(_,i)=>{const t=i/74,y=hemY+.015+(front.y-.035-hemY-.015)*t,x=side*(.073+.090*t-.009*Math.sin(t*Math.PI));return[x,y];});append(ribbon(panel,.00095,.00085));
  for(let y=bottom+.005;y<top-.012;y+=.0062)append(ribbon([[side*.0049,y],[side*.0049,y+.0028]],.00055,.0014));
 }
 push('Technical_Topstitch',geo(seamVertices,seamIndices),new T.MeshStandardMaterial({color:new T.Color(color).lerp(new T.Color(thread),.22),roughness:.94,side:T.DoubleSide}));
 sampler.dispose();parent.dispose();return {material:fabric(color),pieces,evidence:{version:2,neckRoots:neck.length,neckRootOffsetM:0,collarHeightM:height,collarCrownYM:crownY,collarCrownTaperM:.009,cuffRibWidthM:.010,cuffFoldThicknessM:.00070,hemRibWidthM:0,authoredTechnical98:true,ordinaryLBS:true,actualSupportedSidePanels:true,technicalCutSource:"Joined authored torso/cap, tapered long sleeve and contained tuck; raw moving-root HOLD remains until native art",palettePreserved:true,quarterZipLengthM:top-bottom,detailVertices:pieces.reduce((n,p)=>n+p.geometry.attributes.position.count,0),detailTriangles:pieces.reduce((n,p)=>n+p.geometry.index.count/3,0)}};
}
