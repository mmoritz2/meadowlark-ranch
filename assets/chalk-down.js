
// One sampled surface is shared by the visible down, the chalk cutting and hoof height.
export function createChalkDown({THREE:T,site,baseHeight,groundMaterial,groundColorAt}) {
 const {x,z,len,depth,h,crest}=site,face=Math.atan2(x,z),ax=Math.cos(face),az=-Math.sin(face),ox=Math.sin(face),oz=Math.cos(face);
 const nx=160,nz=112,heights=new Float32Array((nx+1)*(nz+1)),positions=[],colors=[],uvs=[],indices=[],relief=[];
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 // Unequal shoulders and a wandering crest make a down rather than a single dome.
 // Every term tapers to zero at the existing footprint, keeping roads and plots clear.
 const bell=(u,width)=>Math.exp(-((u/width)**2));
 const crestAt=u=>crest+.055*Math.sin(u*.055+.4)+.025*Math.sin(u*.14-1);
 function column(u){
  const shoulder=len*(u<0?.19:.08),taper=1-smooth((Math.abs(u)-shoulder)/(len*.5-shoulder));
  return {crest:crestAt(u),peak:h*taper*(.84+.23*bell(u+18,17)+.31*bell(u-16,13)-.05*bell(u-2,9)),gully:.08*bell(u+32,5)+.06*bell(u-31,6)};
 }
 function columnLift(c,t){
  const p=t<c.crest?Math.pow(smooth(t/c.crest),.91):Math.pow(smooth((1-t)/(1-c.crest)),1.10);
  return c.peak*p*(1-c.gully*4*p*(1-p));
 }
 const lift=(u,t)=>columnLift(column(u),t);
 const frame=(u,t)=>[x+ax*u+ox*(t-.5)*depth,z+az*u+oz*(t-.5)*depth];
 const turf=new T.Color('#a9b397'),bleached=new T.Color('#d1c3a0'),c=new T.Color();
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const u=(i/nx-.5)*len,t=j/nz,[wx,wz]=frame(u,t),rise=lift(u,t),y=baseHeight(wx,wz)+rise;
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
 function sampleUV(u,t,field=heights){
  const fx=(u/len+.5)*nx,fz=t*nz;if(fx<0||fz<0||fx>nx||fz>nz)return -Infinity;
  const i=Math.min(nx-1,Math.floor(fx)),j=Math.min(nz-1,Math.floor(fz)),a=j*(nx+1)+i,dx=fx-i,dz=fz-j;
  const A=field[a],B=field[a+1],C=field[a+nx+1],D=field[a+nx+2];
  return dx>=dz?A+(B-A)*dx+(D-B)*dz:A+(D-C)*dx+(C-A)*dz;
 }
 const coordinates=(wx,wz)=>{const dx=wx-x,dz=wz-z;return [dx*ax+dz*az,(dx*ox+dz*oz)/depth+.5];};
 const heightAt=(wx,wz)=>sampleUV(...coordinates(wx,wz));
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
 const curve=s.getPoints(14);if(curve[0].equals(curve.at(-1)))curve.pop();
 const outline=[];
 for(let i=0;i<curve.length;i++){const a=curve[i],b=curve[(i+1)%curve.length],n=Math.max(1,Math.ceil(a.distanceTo(b)/.16));
  for(let k=0;k<n;k++){const p=a.clone().lerp(b,k/n),rough=.012*Math.sin(p.x*41+p.y*23)+.007*Math.sin(p.x*67-p.y*37);p.x+=rough;p.y+=rough*.8;outline.push(p);}}
 const triangles=T.ShapeUtils.triangulateShape(outline,[]),ps=[],ns=[],cs=[],uv=[];
 const chalk=new T.Color('#a5a38f'),chalkLight=new T.Color('#d4cfbb');
 const peg=(fx,fy)=>{
  const u=fx*1.2-1,want=5.7+fy*.77,col=column(u);let lo=0,hi=col.crest;
  for(let k=0;k<20;k++){const t=(lo+hi)/2;if(columnLift(col,t)<want)lo=t;else hi=t;}
  const t=(lo+hi)/2,[wx,wz]=frame(u,t),y=sampleUV(u,t)+.023;
  const e=.05,n=new T.Vector3(heightAt(wx-e,wz)-heightAt(wx+e,wz),2*e,heightAt(wx,wz-e)-heightAt(wx,wz+e)).normalize();
  return {wx,wz,y,n};
 };
 function tri(a,b,c2,depth=0){
  const ab=a.distanceTo(b),bc=b.distanceTo(c2),ca=c2.distanceTo(a);
  if(Math.max(ab,bc,ca)>.28&&depth<9){
   if(ab>=bc&&ab>=ca){const m=a.clone().add(b).multiplyScalar(.5);tri(a,m,c2,depth+1);tri(m,b,c2,depth+1);}
   else if(bc>=ca){const m=b.clone().add(c2).multiplyScalar(.5);tri(a,b,m,depth+1);tri(a,m,c2,depth+1);}
   else{const m=c2.clone().add(a).multiplyScalar(.5);tri(a,b,m,depth+1);tri(m,b,c2,depth+1);}return;
  }
  // Positive local XY winding maps to an upward-facing surface in this frame.
  if((b.x-a.x)*(c2.y-a.y)-(b.y-a.y)*(c2.x-a.x)>0)[b,c2]=[c2,b];
  for(const p of[a,b,c2]){const q=peg(p.x,p.y);ps.push(q.wx,q.y,q.wz);ns.push(q.n.x,q.n.y,q.n.z);uv.push(p.x*.85,p.y*.85);
   const grain=.5+.22*Math.sin(p.x*1.7+p.y*.9)*Math.sin(p.y*1.2-p.x*.7)+.12*Math.sin(p.x*23+p.y*17)*Math.sin(p.y*31-p.x*7);c.copy(chalk).lerp(chalkLight,grain);cs.push(c.r,c.g,c.b);}
 }
 for(const [a,b,c2]of triangles)tri(outline[a],outline[b],outline[c2]);
 const cut=new T.BufferGeometry();cut.setAttribute('position',new T.Float32BufferAttribute(ps,3));cut.setAttribute('normal',new T.Float32BufferAttribute(ns,3));cut.setAttribute('color',new T.Float32BufferAttribute(cs,3));cut.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 const rock=new T.TextureLoader().load('assets/textures/scanned/rock_boulder_cracked_arm.webp');rock.wrapS=rock.wrapT=T.RepeatWrapping;
 const chalkMat=new T.MeshStandardMaterial({vertexColors:true,roughness:1,map:texture('assets/textures/scanned/rock_boulder_cracked_diff.webp',true),bumpMap:rock,bumpScale:.035,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 chalkMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec3 grain=texture2D(map,vMapUv).rgb;
 float chalkGrain=dot(grain,vec3(.30,.59,.11));
 diffuseColor.rgb*=.78+chalkGrain*.50;
 #endif`);};chalkMat.customProgramCacheKey=()=> 'weathered-chalk-cut-1';
 const rimPos=[];
 for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],direction=b.clone().sub(a).normalize(),out=new T.Vector2(direction.y,-direction.x).multiplyScalar(.055);
  const points=[a,a.clone().add(out),b.clone().add(out),a,b.clone().add(out),b];for(const p of points){const q=peg(p.x,p.y);rimPos.push(q.wx,q.y-.008,q.wz);}}
 const rimGeo=new T.BufferGeometry();rimGeo.setAttribute('position',new T.Float32BufferAttribute(rimPos,3));rimGeo.computeVertexNormals();
 const rim=new T.Mesh(rimGeo,new T.MeshStandardMaterial({color:'#716957',roughness:1,side:T.DoubleSide}));rim.receiveShadow=true;rim.name='Chalk Mare | worn turf edge';root.add(rim);
 const mare=new T.Mesh(cut,chalkMat);mare.name='Chalk Mare | ground cutting';mare.receiveShadow=true;root.add(mare);
 const isChalk=(wx,wz)=>{const [u,t]=coordinates(wx,wz);if(t<0||t>crestAt(u)||Math.abs(u)>22)return false;
  const px=(u+1)/1.2,py=(lift(u,t)-5.7)/.77;let inside=false;
  for(let i=0,j=curve.length-1;i<curve.length;j=i++){const a=curve[i],b=curve[j];if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
 return {root,heightAt,reliefAt,isChalk,contains(wx,wz){const [u,t]=coordinates(wx,wz);return Math.abs(u)<len/2&&t>0&&t<1&&lift(u,t)>.12;},site,stats:{groundTriangles:indices.length/3,chalkTriangles:ps.length/9}};
}
