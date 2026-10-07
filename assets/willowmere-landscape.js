const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

// One level and one continuous irregular shoreline, including overlapping pools.
// The terrain grid and its riding sampler are edited together by the host.
export function buildWillowmereLandscape(G,sites){
 const T=G.THREE,W=G.world,pools=sites.pools,level=pools.map(p=>p.y).sort((a,b)=>a-b)[Math.floor(pools.length/2)];
 const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(const p of pools){bounds.minX=Math.min(bounds.minX,p.x-p.r-7);bounds.maxX=Math.max(bounds.maxX,p.x+p.r+7);bounds.minZ=Math.min(bounds.minZ,p.z-p.r-7);bounds.maxZ=Math.max(bounds.maxZ,p.z+p.r+7);}
 const shore=(x,z)=>{
  if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ)return Infinity;
  let d=Infinity;for(let i=0;i<pools.length;i++){const p=pools[i],dx=x-p.x,dz=z-p.z,a=Math.atan2(dz,dx),r=p.r*(1+.075*Math.sin(a*3+i*.83)+.045*Math.cos(a*5-i));
   const next=Math.hypot(dx,dz)-r;
   // A smooth union rounds intersections, rather than leaving overlapping disks.
   if(!Number.isFinite(d))d=next;else{const h=Math.max(0,.9-Math.abs(d-next))/.9;d=Math.min(d,next)-h*h*.9*.25;}
  }return Math.max(d,3.7-Math.hypot(x-sites.boathouse[0],z-sites.boathouse[1]));
 };
 const protectedSites=[...G.quartersPkg.willowTrees.map(o=>({x:o.position.x,z:o.position.z,r:2.8})),{x:sites.boathouse[0],z:sites.boathouse[1],r:4.0}];
 const patch=W.patchTerrain(bounds,(x,z,old)=>{
  const d=shore(x,z);if(d>=4.8)return old;
  let target=level-.57+.44*smooth(-2.4,.25,d)+.28*smooth(-.15,1.0,d);
  target=old+(target-old)*(1-smooth(1.3,4.8,d));
  let protection=0;for(const p of protectedSites)protection=Math.max(protection,1-smooth(p.r,p.r+1.2,Math.hypot(x-p.x,z-p.z)));
  return target+(old-target)*protection;
 });
 const group=new T.Group();group.name='Willowmere | continuous marsh';
 const waterP=[],waterU=[],waterC=[],waterI=[],color=new T.Color(),deep=new T.Color('#284a3d'),shallow=new T.Color('#788575');
 const vertex=(x,z)=>{const d=shore(x,z),edge=1-smooth(0,1.8,-d),i=waterP.length/3;waterP.push(x,level,z);waterU.push(.5,edge);color.copy(deep).lerp(shallow,edge);waterC.push(color.r,color.g,color.b);return i;};
 const step=.65;
 for(let z=bounds.minZ;z<bounds.maxZ;z+=step)for(let x=bounds.minX;x<bounds.maxX;x+=step){
  let poly=[[x,z],[x,z+step],[x+step,z+step],[x+step,z]],clipped=[];
  for(let i=0;i<4;i++){const a=poly[i],b=poly[(i+1)%4],da=shore(...a),db=shore(...b);if(da<=0)clipped.push(a);if((da<0)!==(db<0)){const t=da/(da-db);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}
  if(clipped.length<3)continue;const ids=clipped.map(p=>vertex(...p));for(let i=1;i<ids.length-1;i++)waterI.push(ids[0],ids[i],ids[i+1]);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(waterP,3));geo.setAttribute('uv',new T.Float32BufferAttribute(waterU,2));geo.setAttribute('color',new T.Float32BufferAttribute(waterC,3));geo.setIndex(waterI);geo.computeVertexNormals();geo.computeBoundingSphere();
 const waterMat=W.waterMaterial.clone();waterMat.name='Willowmere | connected reflective water';waterMat.map=null;waterMat.color.set(0xffffff);waterMat.vertexColors=true;waterMat.opacity=.91;waterMat.roughness=.26;waterMat.clearcoat=.42;
 waterMat.onBeforeCompile=(sh,renderer)=>{W.waterMaterial.userData.plainShader(sh,renderer);sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.0-smoothstep(.80,1.0,waterBankUV.y);\n#include <alphatest_fragment>');};const waterShader=waterMat.onBeforeCompile;
 waterMat.onBeforeCompile=(sh,renderer)=>{waterShader(sh,renderer);sh.fragmentShader=sh.fragmentShader.replace('vec3 reflected=texture2D(waterReflection,clamp(reflectionUV,0.0,1.0)).rgb;',`vec3 reflected=texture2D(waterReflection,clamp(reflectionUV,0.0,1.0)).rgb*.40;
 for(int i=0;i<4;i++){vec2 offset=vec2(i<2?-.0016:.0016,mod(float(i),2.0)<.5?-.0028:.0028);reflected+=texture2D(waterReflection,clamp(reflectionUV+offset,0.0,1.0)).rgb*.15;}`);};
 waterMat.customProgramCacheKey=()=> 'willowmere-marsh-water-2';
 const water=new T.Mesh(geo,waterMat);water.name='Willowmere | water';water.receiveShadow=true;water.renderOrder=2;group.add(water);
 // A wet soil dressing copies the exact terrain lattice, without a second slope.
 const p=[],uv=[],col=[],alpha=[],idx=[],grid=W.terrainStep,x0=Math.floor(bounds.minX/grid)*grid,z0=Math.floor(bounds.minZ/grid)*grid,nx=Math.ceil((bounds.maxX-x0)/grid)+1,nz=Math.ceil((bounds.maxZ-z0)/grid)+1;
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const x=x0+i*grid,z=z0+j*grid,d=shore(x,z),wet=1-smooth(0,3.6,d);p.push(x,W.terrainH(x,z)+.016,z);uv.push(x/3.4,z/3.4);color.set('#a9a080').multiplyScalar(.62+.38*(1-wet));col.push(color.r,color.g,color.b);alpha.push((1-smooth(1.1,4,d))*smooth(-2.5,-.35,d));
  if(i<nx-1&&j<nz-1){const a=j*nx+i;idx.push(a,a+nx,a+1,a+1,a+nx,a+nx+1);}
 }
 const bankGeo=new T.BufferGeometry();for(const[name,array,size]of[['position',p,3],['uv',uv,2],['color',col,3],['marshFade',alpha,1]])bankGeo.setAttribute(name,new T.Float32BufferAttribute(array,size));bankGeo.setIndex(idx);bankGeo.computeVertexNormals();bankGeo.computeBoundingSphere();
 const dirt=new T.TextureLoader().load('./assets/textures/ground_dirt.jpg');dirt.colorSpace=T.SRGBColorSpace;dirt.wrapS=dirt.wrapT=T.RepeatWrapping;dirt.anisotropy=8;
 const bankMat=new T.MeshStandardMaterial({name:'Willowmere | wet earth margin',map:dirt,vertexColors:true,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 bankMat.onBeforeCompile=sh=>{sh.vertexShader='attribute float marshFade;varying float marshAlpha;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmarshAlpha=marshFade;');sh.fragmentShader='varying float marshAlpha;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=marshAlpha;\n#include <alphatest_fragment>');};bankMat.customProgramCacheKey=()=> 'willowmere-wet-earth-1';
 const bank=new T.Mesh(bankGeo,bankMat);bank.name='Willowmere | soil shore';bank.receiveShadow=true;group.add(bank);G.scene.add(group);
 for(const b of sites.boats)b.position.y=level;
 for(const m of sites.mist)m.y=level+.28;
 return{group,level,bounds,shore,patch,triangles:(waterI.length+idx.length)/3,containsWater:(x,z,pad=0)=>shore(x,z)<pad&&W.terrainH(x,z)<level+.10};
}
