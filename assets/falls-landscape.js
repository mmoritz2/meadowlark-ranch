// Hollowpeak's watercourse is cut into the same height field used by the horses.
// Original landforms; the cliff material is Poly Haven / Amal Kumar, CC0.
export const HOLLOWPEAK=Object.freeze({x:-150,z:-242.2,top:14.2,level:-.1,run:7.8,width:2.45,
 pool:{x:-150,z:-230.4,r:9.8,aspect:.86,level:-.1},tarn:{x:-147,z:-284,r:5.8,aspect:1.16,level:16.2},
 channel:[[-147,-284,16.2],[-145.8,-277.5,16.2],[-145,-274,15.85],[-148,-261,15.2],[-150,-249,14.55],[-150,-242.2,14.2]]});
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const within=(x,z)=>x> -202&&x< -100&&z> -321&&z< -214;
const trail=[[-160,-215],[-173.0439,-225.4024],[-187.0279,-235.9788],[-200.6802,-244.8582],[-260,-280]];
function nearest(x,z,points){let best={d:Infinity};for(let k=1;k<points.length;k++){
 const a=points[k-1],b=points[k],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
 const cx=a[0]+dx*t,cz=a[1]+dz*t,d=Math.hypot(x-cx,z-cz);
 if(d<best.d)best={d,x:cx,z:cz,y:mix(a[2]||0,b[2]||0,t),dx,dz,t};
}return best;}
export function fallsRadius(a,p){return p.r*(1+.05*Math.sin(a*3+.4)+.025*Math.cos(a*7));}
function poolRadius(x,z,p){const dx=x-p.x,dz=(z-p.z)/p.aspect;return Math.hypot(dx,dz)/fallsRadius(Math.atan2(dz,dx),p);}
export function fallsContainsWater(x,z,padding=0){
 if(!within(x,z))return false;
 for(const p of [HOLLOWPEAK.pool,HOLLOWPEAK.tarn])if(poolRadius(x,z,p)<1+padding/p.r)return true;
 return nearest(x,z,HOLLOWPEAK.channel).d<2.6+padding||z>HOLLOWPEAK.z&&z< HOLLOWPEAK.z+HOLLOWPEAK.run+1&&Math.abs(x-HOLLOWPEAK.x)<3.6+padding;
}
export function fallsRelief(x,z){
 if(!within(x,z))return 0;
 const keep=smooth(7,13,nearest(x,z,trail).d);
 if(!keep)return 0;
 const dx=(x+146)/38,dz=(z+268)/45,r=Math.hypot(dx,dz);
 const edge=r+.042*Math.sin(x*.34+z*.16)+.027*Math.sin(z*.37-x*.18);
 const bulk=(1-smooth(.56,1.07,edge))*(20.7+1.6*Math.sin(x*.12+z*.07));
 const face=-241.5+Math.sin(x*.34)*1.8+Math.cos(x*.7)*.9;
 const front=1-.18*smooth(face-6,face-4,z)-.55*smooth(face-1,face+3,z)-.27*smooth(face+3,face+10,z);
 const shoulder=4.6*Math.exp(-(((x+168)/9)**2+((z+254)/15)**2))+6.5*Math.exp(-(((x+129)/12)**2+((z+260)/17)**2));
 return Math.max(0,(bulk+shoulder)*front*keep);
}
export function fallsTerrainHeight(x,z,height){
 if(!within(x,z))return height;
 let h=height+fallsRelief(x,z);
 const flow=nearest(x,z,HOLLOWPEAK.channel);
 // Recess the ravine under the airborne sheet, including one terrain cell of
 // clearance at its lip; this keeps interpolated ground out of falling water.
 if(z>HOLLOWPEAK.z-1.5&&z<HOLLOWPEAK.z+HOLLOWPEAK.run+2){
  const u=Math.max(0,Math.min(1,(z-HOLLOWPEAK.z+1.5)/(HOLLOWPEAK.run+1.5))),fallY=HOLLOWPEAK.top-(HOLLOWPEAK.top-HOLLOWPEAK.level)*Math.pow(Math.sqrt(u),1.055)-1.6;
  h=mix(h,Math.min(h,fallY),1-smooth(4.4,8.0,Math.abs(x-HOLLOWPEAK.x)));
 }
 for(const p of[HOLLOWPEAK.pool,HOLLOWPEAK.tarn]){const r=poolRadius(x,z,p);if(r>=1.55)continue;
  const bed=p.level-1.5+1.36*smooth(.3,1.02,r)+.55*smooth(.91,1.3,r);
  h=mix(h,bed,1-smooth(1.13,1.55,r));
 }
 if(flow.d<7.2)h=mix(h,Math.min(h,flow.y-1.15+.3*smooth(1.9,4.5,flow.d)),1-smooth(2.7,7.2,flow.d));
 return mix(height,h,smooth(7,9,nearest(x,z,trail).d));
}
export function fallsAllowsHorse(x,z){return !fallsContainsWater(x,z,1.4)&&fallsRelief(x,z)<1.3;}
export function fallsExcludesDryPlants(x,z,heightAt){
 if(!within(x,z))return false;
 return fallsContainsWater(x,z,1.5)||fallsRelief(x,z)>.1&&Math.hypot(heightAt(x+1,z)-heightAt(x-1,z),heightAt(x,z+1)-heightAt(x,z-1))>1.35;
}
export function createFallsLandscape({THREE:T,scene,heightAt,terrainStep,waterMaterial,colliders,loadTextures=true}){
 const group=new T.Group();group.name='Hollowpeak | mountain watercourse';
 const mat=new T.MeshStandardMaterial({name:'Hollowpeak | scanned marble cliffs',color:'#b5c1c7',roughness:.92,normalScale:new T.Vector2(.66,.66),envMapIntensity:.65,vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 if(loadTextures){const loader=new T.TextureLoader(),tex=(suffix,srgb=false)=>{const t=loader.load(new URL('./textures/falls/marble_cliff_02_'+suffix+'.webp',import.meta.url).href);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;return t;};mat.map=tex('diff',true);mat.normalMap=tex('nor_gl');mat.roughnessMap=tex('arm');}
 mat.onBeforeCompile=sh=>{
  sh.vertexShader='attribute float rockCover; varying float mountainCover; varying vec3 rockWorld,rockNormal;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmountainCover=rockCover;rockWorld=(modelMatrix*vec4(position,1.0)).xyz;rockNormal=normalize(mat3(modelMatrix)*normal);');
  sh.fragmentShader=`varying float mountainCover; varying vec3 rockWorld,rockNormal;
   vec4 rockSample(sampler2D tex,vec2 p){vec2 uv=p/6.8+vec2(sin(p.x*.08+p.y*.045),cos(p.y*.07))*.11;return mix(texture2D(tex,uv),texture2D(tex,uv*.713+vec2(.31,.62)),.26);}
   vec4 rockTri(sampler2D tex){vec3 w=pow(abs(normalize(rockNormal)),vec3(6.0));w/=max(dot(w,vec3(1.0)),.001);return rockSample(tex,rockWorld.zy)*w.x+rockSample(tex,rockWorld.xz)*w.y+rockSample(tex,rockWorld.xy)*w.z;}
  `+sh.fragmentShader;
  if(mat.map){sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','vec4 rockColour=rockTri(map); rockColour.rgb=mix(vec3(dot(rockColour.rgb,vec3(.2126,.7152,.0722))),rockColour.rgb,.52); diffuseColor*=rockColour;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*rockTri(roughnessMap).g;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`vec3 rn=normalize(rockNormal),w=pow(abs(rn),vec3(6.0));w/=max(dot(w,vec3(1.0)),.001);
    vec3 nx=rockSample(normalMap,rockWorld.zy).xyz*2.0-1.0,ny=rockSample(normalMap,rockWorld.xz).xyz*2.0-1.0,nz=rockSample(normalMap,rockWorld.xy).xyz*2.0-1.0;
    nx.xy*=normalScale;ny.xy*=normalScale;nz.xy*=normalScale;
    vec3 rnormal=normalize(vec3(nx.z*sign(rn.x),nx.y,nx.x)*w.x+vec3(ny.x,ny.z*sign(rn.y),ny.y)*w.y+vec3(nz.x,nz.y,nz.z*sign(rn.z))*w.z);
    normal=normalize(mat3(viewMatrix)*normalize(mix(rn,rnormal,.62)));`);
  }
  sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=mountainCover;\n#include <alphatest_fragment>');
 };
 mat.customProgramCacheKey=()=> 'hollowpeak-triplanar-1';
 const step=terrainStep,x0=Math.floor((-202+500)/step)*step-500,z0=Math.floor((-321+500)/step)*step-500;
 const nx=Math.ceil((-100-x0)/step),nz=Math.ceil((-214-z0)/step),p=[],uv=[],colors=[],cover=[],idx=[];
 for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
  const x=x0+ix*step,z=z0+iz*step,y=heightAt(x,z),slope=Math.hypot(heightAt(x+1,z)-heightAt(x-1,z),heightAt(x,z+1)-heightAt(x,z-1))/2;
  const relief=fallsRelief(x,z),wet=fallsContainsWater(x,z,2),rock=smooth(.16,.44,slope);
  const amount=Math.max(rock*smooth(.03,.7,relief),wet?.94:0);
  p.push(x,y+.012,z);uv.push(x/6.8,z/6.8);cover.push(amount);
  const shade=wet?.61:1;colors.push(shade,shade,shade);
 }
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const a=iz*(nx+1)+ix,b=a+nx+1,d=a+1,c=b+1;if(Math.max(cover[a],cover[b],cover[c],cover[d])>.001)idx.push(a,b,d,d,b,c);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('rockCover',new T.Float32BufferAttribute(cover,1));geometry.setIndex(idx);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const rock=new T.Mesh(geometry,mat);rock.name='Hollowpeak | grounded rock and snow';rock.receiveShadow=true;rock.renderOrder=1;group.add(rock);
 // A colourless copy of the full local terrain casts the mountain silhouette.
 // The material skin receives light but never casts its blended coverage mask.
 const shadowGeo=geometry.clone(),shadowIndex=[];
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const a=iz*(nx+1)+ix,b=a+nx+1,d=a+1,c=b+1;shadowIndex.push(a,b,d,d,b,c);}
 shadowGeo.setIndex(shadowIndex);shadowGeo.computeVertexNormals();
 const shadow=new T.Mesh(shadowGeo,new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));shadow.name='Hollowpeak | mountain shadow';shadow.castShadow=true;group.add(shadow);
 const waters=[];
 function water(p,uv,col,index,name,flow=false){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();
  const m=waterMaterial.clone();m.name='Hollowpeak | '+name;m.map=null;m.color.set(0xffffff);m.vertexColors=true;m.opacity=.96;m.roughness=.16;m.clearcoat=.36;
  m.onBeforeCompile=(sh,r)=>{waterMaterial.userData.plainShader(sh,r);sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',(flow?'diffuseColor.a*=smoothstep(0.0,.025,waterBankUV.x)*smoothstep(0.0,.09,waterBankUV.y)*(1.0-smoothstep(.91,1.0,waterBankUV.y));':'diffuseColor.a*=1.0-smoothstep(.91,1.0,waterBankUV.y);')+'\n#include <alphatest_fragment>');};m.customProgramCacheKey=()=> 'hollowpeak-water-'+flow;
  const mesh=new T.Mesh(g,m);mesh.name='Hollowpeak | '+name;mesh.receiveShadow=true;mesh.renderOrder=2;group.add(mesh);waters.push(mesh);return mesh;
 }
 const deep=new T.Color('#244f53'),shallow=new T.Color('#507778'),tint=new T.Color();
 const pools=[HOLLOWPEAK.pool,HOLLOWPEAK.tarn].map((basin,bi)=>{const p=[basin.x,basin.level,basin.z],uv=[0,0],col=[deep.r,deep.g,deep.b],idx=[],segments=96,rings=18;
  for(let j=1;j<=rings;j++)for(let k=0;k<=segments;k++){const t=j/rings,a=k/segments*Math.PI*2,r=fallsRadius(a,basin)*t;p.push(basin.x+Math.cos(a)*r,basin.level,basin.z+Math.sin(a)*r*basin.aspect);uv.push(k/segments,t);tint.copy(deep).lerp(shallow,smooth(.5,1,t));col.push(tint.r,tint.g,tint.b);
   if(k<segments){const v=1+(j-1)*(segments+1)+k;if(j===1)idx.push(0,v+1,v);if(j<rings)idx.push(v,v+1,v+segments+1,v+1,v+segments+2,v+segments+1);}
  }return water(p,uv,col,idx,bi?'upper tarn':'plunge pool');
 });
 const cp=[],cu=[],cc=[],ci=[],rows=88,cols=12;
 for(let j=0;j<=rows;j++){const z=mix(-278.6,HOLLOWPEAK.z,j/rows);let k=1;while(k<HOLLOWPEAK.channel.length-1&&HOLLOWPEAK.channel[k][1]<z)k++;const a=HOLLOWPEAK.channel[k-1],b=HOLLOWPEAK.channel[k],t=(z-a[1])/(b[1]-a[1]),x=mix(a[0],b[0],t),y=mix(a[2],b[2],t);
  for(let i=0;i<=cols;i++){const u=i/cols,offset=(u*2-1)*HOLLOWPEAK.width;cp.push(x+offset,y,z);cu.push(j/rows,u);tint.copy(deep).lerp(shallow,Math.abs(u*2-1));cc.push(tint.r,tint.g,tint.b);if(j<rows&&i<cols){const v=j*(cols+1)+i;ci.push(v,v+cols+1,v+1,v+1,v+cols+1,v+cols+2);}}
 }
 const stream=water(cp,cu,cc,ci,'source channel',true);stream.material.side=T.FrontSide;
 const barriers=[],seen=new Set(),cell=2.2,level=3;
 for(let z=-320;z< -222;z+=cell)for(let x=-202;x< -100;x+=cell){const corners=[[x,z],[x+cell,z],[x+cell,z+cell],[x,z+cell]],h=corners.map(p=>fallsRelief(...p));
  for(let i=0;i<4;i++){const j=(i+1)%4;if((h[i]>level)===(h[j]>level))continue;const t=(level-h[i])/(h[j]-h[i]),cx=mix(corners[i][0],corners[j][0],t),cz=mix(corners[i][1],corners[j][1],t),key=Math.round(cx*2)+','+Math.round(cz*2);if(seen.has(key)||fallsContainsWater(cx,cz,3))continue;seen.add(key);
   let top=heightAt(cx,cz);for(let a=0;a<8;a++)for(const d of[5,10,18])top=Math.max(top,heightAt(cx+Math.cos(a*Math.PI/4)*d,cz+Math.sin(a*Math.PI/4)*d));
   const c={x:cx,z:cz,r:1.05,height:40,topY:top+.3,landform:true,terrainCliff:true};barriers.push(c);colliders.push(c);
  }
 }
 // The rear of the plunge basin is a rock face, including behind the water.
 for(let x=HOLLOWPEAK.x-4.8;x<=HOLLOWPEAK.x+4.8;x+=1.6){const c={x,z:HOLLOWPEAK.z+3.4,r:1,height:40,topY:HOLLOWPEAK.top+10,landform:true,terrainCliff:true};barriers.push(c);colliders.push(c);}
 scene.add(group);return {group,rock,shadow,waters,pool:pools[0],tarn:pools[1],stream,barriers,triangles:idx.length/3};
}
