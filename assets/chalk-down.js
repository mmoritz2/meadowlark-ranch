import {chalkDownlandLift,chalkDownlandReferenceLift,chalkMareOutline,chalkScourDepth,CHALK_MARE_PANEL,drawChalkMare} from './chalk-downland.mjs?v=chalk-scour-1';

// Lower only this hill's sun caster; visible turf and hoof contact stay on the
// shared surface. A private synchronous stream keeps its extra material UUID
// out of the sequential world-layout random stream.
let chalkShadowEpoch=0;
function chalkSunDepth(T){
 const prior=Math.random;let state=(0x6d2b79f5^Math.imul(++chalkShadowEpoch,0x9e3779b1))>>>0;
 Math.random=()=>{state=(state+0x6d2b79f5)|0;let v=Math.imul(state^(state>>>15),1|state);v^=v+Math.imul(v^(v>>>7),61|v);return((v^(v>>>14))>>>0)/4294967296;};
 let depth;try{depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});}finally{Math.random=prior;}
 depth.name='Chalk Down | inward sun caster';depth.userData.chalkCasterInsetM=.10;
 depth.onBeforeCompile=shader=>{
  const token='#include <begin_vertex>';
  if(!shader.vertexShader.includes(token))throw Error('Chalk sun depth requires the bundled begin_vertex chunk');
  shader.vertexShader=shader.vertexShader.replace(token,token+'\ntransformed -= normal * 0.10;');
 };
 depth.customProgramCacheKey=()=> 'chalk-sun-caster-inset-2';
 return depth;
}

// One sampled surface is shared by the visible down, the chalk cutting and hoof height.
export function createChalkDown({THREE:T,site,baseHeight,groundMaterial,groundColorAt}) {
 const {x,z,len,depth,h,crest}=site,face=Math.atan2(x,z),ax=Math.cos(face),az=-Math.sin(face),ox=Math.sin(face),oz=Math.cos(face);
 const nx=160,nz=112,heights=new Float32Array((nx+1)*(nz+1)),uncutHeights=new Float32Array((nx+1)*(nz+1)),planningHeights=new Float32Array((nx+1)*(nz+1)),positions=[],colors=[],uvs=[],indices=[],relief=[];
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 // A lower, broad down has one larger western shoulder and a shallow saddle
 // through its crown. All terms meet the original surveyed footprint at zero rise.
 const bell=(u,width)=>Math.exp(-((u/width)**2));
 const crestAt=u=>crest+.025*Math.sin(u*.035+.5)+.018*Math.sin(u*.08-.6);
 function column(u){
  const shoulder=len*(u<0?.24:.20),taper=1-smooth((Math.abs(u)-shoulder)/(len*.5-shoulder));
  return {crest:crestAt(u),peak:h*taper*(.79+.26*bell(u+19,22)+.18*bell(u-26,18)-.17*bell(u-5,17)),gully:.035*bell(u+34,11)+.025*bell(u-29,12)};
 }
 function columnLift(c,t){
  const p=t<c.crest?Math.pow(smooth(t/c.crest),.91):Math.pow(smooth((1-t)/(1-c.crest)),1.10);
  return c.peak*p*(1-c.gully*4*p*(1-p));
 }
 const legacyLift=(u,t)=>columnLift(column(u),t);
 const physicalOutline=chalkMareOutline();
 // Keep the entire pre-existing foot outside historical tree clearance exact.
 // Within that cleared down the new shoulders and valleys are actual ground.
 const uncutLift=(u,t)=>{const old=chalkDownlandReferenceLift(site,u,t),w=smooth((Math.min(legacyLift(u,t),old)-1.2)/2);return old+(chalkDownlandLift(site,u,t)-old)*w;};
 const lift=(u,t)=>Math.max(0,uncutLift(u,t)-chalkScourDepth(site,u,t,physicalOutline));
 // Keep the original galloping outline affine in across-slope distance and rise.
 // One shared mapping seats the complete figure below the lower crown; its
 // forward and inverse expressions are used by the cutting and plant exclusion.
 const glyphMap={xScale:.95,xOffset:-1,base:.25,scale:.060,referencePeak:column(-1).peak};
 const glyphWant=fy=>glyphMap.referencePeak*(glyphMap.base+fy*glyphMap.scale);
 const glyphFy=rise=>(rise/glyphMap.referencePeak-glyphMap.base)/glyphMap.scale;
 const frame=(u,t)=>[x+ax*u+ox*(t-.5)*depth,z+az*u+oz*(t-.5)*depth];
 const turf=new T.Color('#a9b397'),bleached=new T.Color('#d1c3a0'),c=new T.Color();
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const u=(i/nx-.5)*len,t=j/nz,[wx,wz]=frame(u,t),rise=lift(u,t),base=baseHeight(wx,wz),y=base+rise;
  planningHeights[j*(nx+1)+i]=base+legacyLift(u,t);uncutHeights[j*(nx+1)+i]=base+uncutLift(u,t);
  heights[j*(nx+1)+i]=y;relief.push(rise);positions.push(wx,y,wz);uvs.push(groundMaterial?(wx+500)/1000:wx/1.6,groundMaterial?(500-wz)/1000:wz/1.6);
  const wear=(Math.sin(u*.14+t*5)+Math.sin(u*.047-t*9)+2)*.065;
  if(groundColorAt)groundColorAt(wx,wz,c,rise);
  else c.copy(turf).lerp(bleached,wear*lift(u,t)/h);
  colors.push(c.r,c.g,c.b);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+nx+1;indices.push(a,b+1,a+1,a,b,b+1);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('chalkRelief',new T.Float32BufferAttribute(relief,1));geometry.setIndex(indices);geometry.computeVertexNormals();
 const loader=new T.TextureLoader(),texture=(file,color=false)=>{const map=loader.load(file);map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;if(color)map.colorSpace=T.SRGBColorSpace;return map;};
 const mat=groundMaterial||new T.MeshStandardMaterial({vertexColors:true,roughness:1,map:texture('assets/textures/pasture/grass_diff.webp',true),normalMap:texture('assets/textures/pasture/grass_nor_gl.webp'),normalScale:new T.Vector2(.38,.38),roughnessMap:texture('assets/textures/pasture/grass_arm.webp')});
 // The down is a heightfield, so both faces must participate in the sun's depth pass.
 mat.shadowSide=T.DoubleSide;
 const root=new T.Group();root.name='Whitehorse Down';root.userData.walkable=true;
 const ground=new T.Mesh(geometry,mat);ground.name='vista:chalkscarp';ground.receiveShadow=true;ground.castShadow=true;root.add(ground);
 const sunDepth=chalkSunDepth(T);ground.customDepthMaterial=sunDepth;
 const releaseSunDepth=()=>{geometry.removeEventListener('dispose',releaseSunDepth);sunDepth.dispose();};geometry.addEventListener('dispose',releaseSunDepth);
 function sampleUV(u,t,field=heights){
  let fx=(u/len+.5)*nx,fz=t*nz;
  // Packed world XZ can round a surveyed hem point a few micrometres outside
  // its inverse frame. Live contact closes only that 0.05mm hem; historical
  // planning keeps the original strict outside/-Infinity semantics exactly.
  if(field!==planningHeights){const ex=.00005*nx/len,ez=.00005*nz/depth;if(fx>=-ex&&fx<=nx+ex&&fz>=-ez&&fz<=nz+ez){fx=Math.max(0,Math.min(nx,fx));fz=Math.max(0,Math.min(nz,fz));}}
  if(fx<0||fz<0||fx>nx||fz>nz)return -Infinity;
  const i=Math.min(nx-1,Math.floor(fx)),j=Math.min(nz-1,Math.floor(fz)),a=j*(nx+1)+i,dx=fx-i,dz=fz-j;
  const A=field[a],B=field[a+1],C=field[a+nx+1],D=field[a+nx+2];
  return dx>=dz?A+(B-A)*dx+(D-B)*dz:A+(D-C)*dx+(C-A)*dz;
 }
 const coordinates=(wx,wz)=>{const dx=wx-x,dz=wz-z;return [dx*ax+dz*az,(dx*ox+dz*oz)/depth+.5];};
 const heightAt=(wx,wz)=>sampleUV(...coordinates(wx,wz));
 // Historical planning is used only by the sequential flora pass, never hoof contact.
 const planningHeightAt=(wx,wz)=>sampleUV(...coordinates(wx,wz),planningHeights);
 const reliefAt=(wx,wz)=>{const v=sampleUV(...coordinates(wx,wz),relief);return Number.isFinite(v)?Math.max(0,v):0;};
 // A continuous, original galloping silhouette. Curved haunches, a tapering neck,
 // bent hocks and open space between the legs replace the old overlapping polygons.
 const s=new T.Shape();s.moveTo(-7,4.9);
 s.bezierCurveTo(-10,6,-12,7.8,-15,6.3);s.bezierCurveTo(-12.2,6.3,-11.2,3.6,-7.9,3.1);
 s.bezierCurveTo(-8.7,2,-10.3,.7,-12.3,-.3);s.lineTo(-14.1,-2.4);s.lineTo(-12.8,-2.7);s.lineTo(-10.8,-1.1);s.lineTo(-6.2,1.2);
 s.lineTo(-5.8,.3);s.lineTo(-7.1,-2.4);s.lineTo(-5.4,-3.4);s.lineTo(-3.4,-3.1);s.lineTo(-3.6,-2.45);s.lineTo(-5.6,-2.2);s.lineTo(-3.7,.9);
 s.bezierCurveTo(-1.6,.3,.8,.6,2.6,1.7);s.lineTo(5.8,-.7);s.lineTo(9.7,-1.7);s.lineTo(10.7,-1.2);s.lineTo(10.2,-.6);s.lineTo(6.6,.1);s.lineTo(4.5,2.8);
 s.lineTo(7.3,1.3);s.lineTo(10.6,2.2);s.lineTo(11.1,3);s.lineTo(10.45,3.35);s.lineTo(7.7,2.65);s.lineTo(6,4.3);
 s.bezierCurveTo(7.3,5,8.6,6.7,9.5,7.4);s.lineTo(11.4,6.8);s.lineTo(13.1,7.1);s.lineTo(13.5,7.8);s.lineTo(12.8,8.5);s.lineTo(11.3,9.15);
 s.lineTo(10.9,10.9);s.lineTo(10.35,10.6);s.lineTo(10.05,9.4);s.lineTo(9.5,10.4);s.lineTo(9.05,10.15);s.lineTo(9.15,8.85);
 s.bezierCurveTo(7.9,8.6,6.7,7.6,5.65,6.4);s.bezierCurveTo(3.7,4.3,1.5,5.2,-1.1,5.1);s.bezierCurveTo(-3.4,5.6,-5.6,6,-7,4.9);
 const planningCurve=s.getPoints(14);if(planningCurve[0].equals(planningCurve.at(-1)))planningCurve.pop();
 // Reuse the existing Shape resource so downstream UUID/random allocation is unchanged.
 s.curves.length=0;drawChalkMare(s);
 const curve=s.getPoints(14);if(curve[0].equals(curve.at(-1)))curve.pop();
 const outline=[];
 for(let i=0;i<curve.length;i++){const a=curve[i],b=curve[(i+1)%curve.length],n=Math.max(1,Math.ceil(a.distanceTo(b)/.16));
  for(let k=0;k<n;k++){const p=a.clone().lerp(b,k/n),rough=.012*Math.sin(p.x*41+p.y*23)+.007*Math.sin(p.x*67-p.y*37);p.x+=rough;p.y+=rough*.8;outline.push(p);}}
 // Each mineral face is clipped to one original A-D terrain triangle. The
 // scoured turf and exposed chalk therefore share the exact packed support;
 // polygonOffset selects the mineral material without a lifted white mesh.
 const triangles=T.ShapeUtils.triangulateShape(outline,[]),ps=[],ns=[],cs=[],uv=[];
 const chalk=new T.Color('#969887'),chalkLight=new T.Color('#c2bda5');
 const normal=geometry.attributes.normal;
 const chart=p=>[(p.x*CHALK_MARE_PANEL.xScale+CHALK_MARE_PANEL.xOffset)/len*nx+nx*.5,(CHALK_MARE_PANEL.tBase+p.y*CHALK_MARE_PANEL.tScale)*nz];
 const sign=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 function clip(poly,tri){
  const orientation=Math.sign(sign(tri[0],tri[1],tri[2]));
  for(let edge=0;edge<3&&poly.length;edge++){
   const a=tri[edge],b=tri[(edge+1)%3],next=[];
   for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const p=poly[j],q=poly[i],dp=sign(a,b,p)*orientation,dq=sign(a,b,q)*orientation,P=dp>=-1e-10,Q=dq>=-1e-10;
    if(P!==Q){const k=dp/(dp-dq);next.push([p[0]+(q[0]-p[0])*k,p[1]+(q[1]-p[1])*k]);}if(Q)next.push(q);
   }poly=next;
  }return poly;
 }
 const point=(gx,gz)=>{
  const u=(gx/nx-.5)*len,t=gz/nz,[wx,wz]=frame(u,t),i=Math.min(nx-1,Math.max(0,Math.floor(gx))),j=Math.min(nz-1,Math.max(0,Math.floor(gz))),dx=gx-i,dz=gz-j,a=j*(nx+1)+i;
  const ids=dx>=dz?[a,a+1,a+nx+2]:[a,a+nx+2,a+nx+1],weights=dx>=dz?[1-dx,dx-dz,dz]:[1-dz,dx,dz-dx];
  let X=0,Y=0,Z=0;for(let k=0;k<3;k++){X+=normal.getX(ids[k])*weights[k];Y+=normal.getY(ids[k])*weights[k];Z+=normal.getZ(ids[k])*weights[k];}const m=Math.hypot(X,Y,Z);
  return{wx,wz,y:sampleUV(u,t),n:[X/m,Y/m,Z/m],u,t};
 };
 let omittedCutArea=0;
 function emit(poly,positions,normals,colors,uvs,edge=false){
  if(poly.length<3)return;
  for(let i=1;i<poly.length-1;i++){
   let pts=[poly[0],poly[i],poly[i+1]];if(sign(...pts)>0)[pts[1],pts[2]]=[pts[2],pts[1]];
   const qs=pts.map(p=>point(...p)),f=qs.map(q=>[Math.fround(q.wx),Math.fround(q.y),Math.fround(q.wz)]),ab=f[1].map((v,k)=>v-f[0][k]),ac=f[2].map((v,k)=>v-f[0][k]);
   const faceNormal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],cy=faceNormal[1],faceLength=Math.hypot(...faceNormal);
   const alignment=Math.min(...qs.map(q=>q.n.reduce((s,v,k)=>s+v*faceNormal[k],0)/Math.max(faceLength,1e-30)));
   if(cy<=1e-9||alignment<.93){if(Math.abs(cy)>.00002)throw Error('Chalk cell clipping produced a substantial misaligned face');omittedCutArea+=Math.abs(cy)*.5;continue;}
   for(const q of qs){positions.push(q.wx,q.y,q.wz);normals?.push(...q.n);uvs?.push((q.wx-x)/1.25,(q.wz-z)/1.25);
    if(colors){const grain=.5+.18*Math.sin(q.u*.87+q.t*13)*Math.sin(q.u*.31-q.t*21)+.12*Math.sin(q.u*7.1+q.t*41);c.copy(chalk).lerp(chalkLight,Math.max(0,Math.min(1,grain)));colors.push(c.r,c.g,c.b);}}
  }
 }
 function fitChartTriangle(chartTri,positions,normals,colors,uvs){
  const x0=Math.max(0,Math.floor(Math.min(...chartTri.map(p=>p[0])))),x1=Math.min(nx-1,Math.floor(Math.max(...chartTri.map(p=>p[0])))),z0=Math.max(0,Math.floor(Math.min(...chartTri.map(p=>p[1])))),z1=Math.min(nz-1,Math.floor(Math.max(...chartTri.map(p=>p[1]))));
  for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++)for(const tri of [[[i,j],[i+1,j+1],[i+1,j]],[[i,j],[i,j+1],[i+1,j+1]]])emit(clip(chartTri,tri),positions,normals,colors,uvs);
 }
 for(const [a,b,c2]of triangles)fitChartTriangle([outline[a],outline[b],outline[c2]].map(chart),ps,ns,cs,uv);
 const cut=new T.BufferGeometry();cut.setAttribute('position',new T.Float32BufferAttribute(ps,3));cut.setAttribute('normal',new T.Float32BufferAttribute(ns,3));cut.setAttribute('color',new T.Float32BufferAttribute(cs,3));cut.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 const rock=new T.TextureLoader().load('assets/textures/scanned/rock_boulder_cracked_arm.webp');rock.wrapS=rock.wrapT=T.RepeatWrapping;
 const chalkMat=new T.MeshStandardMaterial({vertexColors:true,roughness:1,map:texture('assets/textures/scanned/rock_boulder_cracked_diff.webp',true),bumpMap:rock,bumpScale:.018,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 chalkMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec3 grain=texture2D(map,vMapUv).rgb;
 float chalkGrain=dot(grain,vec3(.30,.59,.11));
 diffuseColor.rgb*=.69+chalkGrain*.44;
 #endif`);};chalkMat.customProgramCacheKey=()=> 'weathered-chalk-scour-1';
 const rimPos=[],rimNormals=[];
 // Discontinuous torn turf returns sit on the same physical transition. They
 // are deliberately not a dark, constant-width outline around the whole mare.
 for(let i=0;i<outline.length;i++){
  const a=outline[i],b=outline[(i+1)%outline.length],midX=(a.x+b.x)*.5,midY=(a.y+b.y)*.5;
  if(Math.sin(midX*1.37+midY*.83)+Math.sin(midX*.53-midY*1.61)<.10)continue;
  const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,width=.025+.025*(.5+.5*Math.sin(midX*2.3-midY*1.4));
  // The authored outline is counterclockwise: its left normal points inward.
  const inX=-dy/l*width/CHALK_MARE_PANEL.xScale,inY=dx/l*width/(CHALK_MARE_PANEL.tScale*depth),aa={x:a.x+inX,y:a.y+inY},bb={x:b.x+inX,y:b.y+inY};
  fitChartTriangle([a,aa,bb].map(chart),rimPos,rimNormals);fitChartTriangle([a,bb,b].map(chart),rimPos,rimNormals);
 }
 const rimGeo=new T.BufferGeometry();rimGeo.setAttribute('position',new T.Float32BufferAttribute(rimPos,3));rimGeo.setAttribute('normal',new T.Float32BufferAttribute(rimNormals,3));
 const rim=new T.Mesh(rimGeo,new T.MeshStandardMaterial({color:'#8e8a6f',roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));rim.receiveShadow=true;rim.name='Chalk Mare | worn turf edge';root.add(rim);
 const mare=new T.Mesh(cut,chalkMat);mare.name='Chalk Mare | ground cutting';mare.receiveShadow=true;root.add(mare);
 const planningIsChalk=(wx,wz)=>{const [u,t]=coordinates(wx,wz);if(t<0||t>crestAt(u)||Math.abs(u)>22)return false;
  const px=(u-glyphMap.xOffset)/glyphMap.xScale,py=glyphFy(legacyLift(u,t));let inside=false;
  for(let i=0,j=planningCurve.length-1;i<planningCurve.length;j=i++){const a=planningCurve[i],b=planningCurve[j];if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
 const isChalk=(wx,wz)=>{const [u,t]=coordinates(wx,wz),px=(u-CHALK_MARE_PANEL.xOffset)/CHALK_MARE_PANEL.xScale,py=(t-CHALK_MARE_PANEL.tBase)/CHALK_MARE_PANEL.tScale;
  if(Math.abs(px)>16||py< -4||py>13)return false;let inside=false,edgeDistance2=Infinity;
  const sx=CHALK_MARE_PANEL.xScale,sz=CHALK_MARE_PANEL.tScale*depth;
  for(let i=0,j=curve.length-1;i<curve.length;j=i++){const a=curve[i],b=curve[j];if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)inside=!inside;
   const dx=(b.x-a.x)*sx,dz=(b.y-a.y)*sz,qx=(px-a.x)*sx,qz=(py-a.y)*sz,l2=dx*dx+dz*dz,f=l2?Math.max(0,Math.min(1,(qx*dx+qz*dz)/l2)):0;
   edgeDistance2=Math.min(edgeDistance2,(qx-dx*f)**2+(qz-dz*f)**2);
  }
  // Keep long neighbouring blades off the cut with a narrow 40cm mown margin.
  // The original acceptance mask above remains untouched for seeded planning.
  return inside||edgeDistance2<.4*.4;};
 const planningContains=(wx,wz)=>{const [u,t]=coordinates(wx,wz);return Math.abs(u)<len/2&&t>0&&t<1&&legacyLift(u,t)>.12;};
 return {root,heightAt,uncutHeightAt:(wx,wz)=>sampleUV(...coordinates(wx,wz),uncutHeights),reliefAt,isChalk,planningHeightAt,planningIsChalk,planningContains,contains(wx,wz){const [u,t]=coordinates(wx,wz);return Math.abs(u)<len/2&&t>0&&t<1&&lift(u,t)>.12;},site,stats:{groundTriangles:indices.length/3,chalkTriangles:ps.length/9,planningBytes:planningHeights.byteLength,scourReferenceBytes:uncutHeights.byteLength,repairedCutTriangles:0,omittedCutArea,profile:'chalk-scour-1'}};
}
