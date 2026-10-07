// Original foothills connect the fixed riding terrain to the distant skyline.
// The innermost ring copies every terrain edge vertex; nothing inside is altered.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function hash(x,z){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v);}
// The outer terrain and its trees share the mountain haze. Blend from normal
// scene fog at the exact terrain seam, so the join cannot become a colour line.
export function patchOuterFog(shader,blend='1.0'){
 shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
  #ifdef USE_FOG
   float outerFogBlend=${blend};
   #ifdef FOG_EXP2
    float outerFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth*mix(1.0,.70,outerFogBlend));
   #else
    float outerFog=smoothstep(fogNear,fogFar,vFogDepth);
   #endif
   gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,min(mix(1.0,.94,outerFogBlend),outerFog));
  #endif`);
}
export function outerDistance(x,z){return Math.hypot(Math.max(0,Math.abs(x)-500),Math.max(0,Math.abs(z)-500));}
export function foothillHeight(x,z,heightAt){
 const d=outerDistance(x,z),edge=heightAt(Math.max(-500,Math.min(500,x)),Math.max(-500,Math.min(500,z)));
 if(!d)return edge;
 const warp=(noise(x*.0038+41,z*.0038-13)-.5)*75;
 const broad=noise((x+warp)*.0051-8,(z-warp)*.0051+19);
 const folds=1-Math.abs(noise(x*.009+7,z*.007-31)*2-1);
 const ridges=(7+24*broad+8*folds*folds)*smooth(0,145,d)*(1-smooth(370,950,d));
 const shoulders=(noise(x*.015+51,z*.013+16)-.5)*6*smooth(12,65,d)*(1-smooth(260,650,d));
 return edge*(1-smooth(20,100,d))+ridges+shoulders-24*smooth(650,1150,d);
}
const BANDS=[[0,2048],[4,2048],[12,1024],[26,1024],[48,512],[78,512],[116,512],[164,512],[224,512],[304,512],[410,512],[550,512],[730,512],[950,512],[1200,512]];
function edgePoint(i,n){const t=i/n*4,side=Math.min(3,Math.floor(t)),u=(t-side)*1000;return side===0?[-500+u,-500]:side===1?[500,-500+u]:side===2?[500-u,500]:[-500,500-u];}
export function createOuterLandscape({THREE:T,scene,heightAt,groundMesh}){
 const old=scene.getObjectByName('Horizon ground disc');
 const source=groundMesh.geometry,sourceColor=source.attributes.color,segments=Math.round(Math.sqrt(source.attributes.position.count))-1;
 const color=new T.Color(),p=[],colors=[],uv=[],indices=[],rows=[];
 const boundaryColor=(x,z)=>{const gx=(x+500)/1000*segments,gz=(z+500)/1000*segments,ix=Math.min(segments-1,Math.floor(gx)),iz=Math.min(segments-1,Math.floor(gz)),fx=gx-ix,fz=gz-iz;
  const a=iz*(segments+1)+ix,b=a+segments+1,c=b+1,d=a+1;
  for(let k=0;k<3;k++){const values=sourceColor.array;const value=fx+fz<=1?values[a*3+k]+(values[d*3+k]-values[a*3+k])*fx+(values[b*3+k]-values[a*3+k])*fz:values[c*3+k]+(values[b*3+k]-values[c*3+k])*(1-fx)+(values[d*3+k]-values[c*3+k])*(1-fz);color[['r','g','b'][k]]=value;}
 };
 for(const [distance,n]of BANDS){const start=p.length/3;rows.push({start,n});for(let i=0;i<=n;i++){
  const [bx,bz]=edgePoint(i,n),scale=1+distance/500,x=bx*scale,z=bz*scale,y=foothillHeight(x,z,heightAt);p.push(x,y,z);uv.push((x+500)/1000,(500-z)/1000);
  boundaryColor(bx,bz);const lum=.91+noise(x*.032,z*.032)*.09,t=smooth(0,90,distance);colors.push(mix(color.r,lum*.94,t),mix(color.g,lum*.98,t),mix(color.b,lum*.89,t));
 }}
 for(let j=0;j<rows.length-1;j++){const a=rows[j],b=rows[j+1];for(let i=0;i<b.n;i++){
  const c=b.start+i,d=c+1,k=a.n/b.n,x=a.start+i*k;
  if(k===1)indices.push(x,x+1,c,x+1,d,c);
  else indices.push(x,x+1,c,x+1,d,c,x+1,x+2,d);
 }}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(p.length),3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 // Match the original edge normals at the shared vertices, including stream cuts.
 const normals=geometry.attributes.normal,sourceNormal=source.attributes.normal;
 for(let i=0;i<=BANDS[0][1];i++){const [x,z]=edgePoint(i,BANDS[0][1]),ix=Math.round((x+500)/1000*segments),iz=Math.round((z+500)/1000*segments),id=iz*(segments+1)+ix;normals.setXYZ(i,sourceNormal.getX(id),sourceNormal.getY(id),sourceNormal.getZ(id));}
 const base=groundMesh.material,material=base.clone();material.name='Continuous countryside | ground';material.onBeforeCompile=(shader,renderer)=>{base.onBeforeCompile(shader,renderer);patchOuterFog(shader,'smoothstep(0.0,58.0,length(max(abs(terrainPosition.xz)-vec2(500.0),vec2(0.0))))');};material.customProgramCacheKey=()=>base.customProgramCacheKey()+'-outer-landscape';material.defaultAttributeValues={...base.defaultAttributeValues};material.defines={...base.defines,CHEAP_GROUND:1,OUTER_LANDSCAPE:1};material.bumpMap=null;material.bumpScale=0;
 const mesh=old||new T.Mesh();if(old){old.geometry.dispose();old.material.map?.dispose();old.material.dispose();}else scene.add(mesh);
 mesh.geometry=geometry;mesh.material=material;mesh.name='Continuous outer countryside';mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);mesh.castShadow=false;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
 // Sample the actual mesh triangles so every woodland root touches the new
 // surface. A separate hash stream leaves all in-basin placement unchanged.
 const woodlandSites=[],gp=geometry.attributes.position,gi=geometry.index;
 for(let i=0;i<gi.count;i+=3){const ids=[gi.getX(i),gi.getX(i+1),gi.getX(i+2)],a=ids.map(id=>[gp.getX(id),gp.getY(id),gp.getZ(id)]);
  const area=Math.abs((a[1][0]-a[0][0])*(a[2][2]-a[0][2])-(a[2][0]-a[0][0])*(a[1][2]-a[0][2]))*.5;
  const cx=(a[0][0]+a[1][0]+a[2][0])/3,cz=(a[0][2]+a[1][2]+a[2][2])/3,cd=outerDistance(cx,cz);
  if(cd<40||cd>420)continue;
  const count=Math.ceil(area/480);
  for(let j=0;j<count;j++){
   if(hash(i+1,j+70)>area/(count*480))continue;
   const u=Math.sqrt(hash(i+17,j+153)),v=hash(i+41,j+371),weights=[1-u,u*(1-v),u*v];
   const [x,y,z]=[0,1,2].map(k=>a.reduce((sum,p,n)=>sum+p[k]*weights[n],0)),d=outerDistance(x,z);
   if(d<58||d>400||noise(x*.008+19,z*.008-27)<.5)continue;
   const arid=x< -500&&z>80;if(arid&&hash(i,j+7)>.13)continue;
   const cold=z< -500&&x<150,source=cold?'mature-pine':hash(i,j+3)>.48?'canopy-broadleaf':'woodland-broadleaf';
   woodlandSites.push({x,y,z,height:7+hash(i,j+19)*7,yaw:hash(i,j+71)*Math.PI*2,source});
  }
 }
 const stats={woodlandTrees:woodlandSites.length,triangles:indices.length/3,vertices:p.length/3,draws:1,bands:BANDS.length,innerHalfSize:500,outerHalfSize:1700};
 return{mesh,woodlandSites,edgeCount:BANDS[0][1]+1,stats};
}
