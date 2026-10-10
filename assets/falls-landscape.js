import {hollowpeakRockSurface,applyHollowpeakRockSurface} from './hollowpeak-rock-surface.mjs?v=hollowpeak-ridges-1';
// Hollowpeak's watercourse is cut into the same height field used by the horses.
// Original landforms; the cliff material is Poly Haven / Amal Kumar, CC0.
export const HOLLOWPEAK=Object.freeze({x:-150,z:-242.2,top:14.2,level:-.1,run:7.8,width:2.45,
 pool:{x:-150,z:-230.4,r:9.8,aspect:.86,level:-.1},tarn:{x:-147,z:-284,r:5.8,aspect:1.16,level:16.2},
 channel:[[-147,-284,16.2],[-145.8,-277.5,16.2],[-145,-274,15.85],[-148,-261,15.2],[-150,-249,14.55],[-150,-242.2,14.2]]});
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export const ALPINE_BOUNDS=Object.freeze({x0:-274,x1:-32,z0:-414,z1:-214});
const within=(x,z)=>x>ALPINE_BOUNDS.x0&&x<ALPINE_BOUNDS.x1&&z>ALPINE_BOUNDS.z0&&z<ALPINE_BOUNDS.z1;
const withinFalls=(x,z)=>x> -202&&x< -100&&z> -321&&z< -214;
// Unequal, overlapping shoulders connect the waterfall to a northern divide.
// Compact support keeps every height exactly unchanged beyond these landforms.
const RIDGES=[[-164,-345,63,48,38,-.18],[-211,-358,49,36,29,.42],
 [-108,-324,46,60,31,-.42],[-187,-308,29,43,16,.22],[-92,-281,39,44,12,.54]];
// One unequal divide and three connected front buttresses. Each record is
// [along, crestAcross, relief, negativeWidth, positiveWidth] in world metres.
// Piecewise crests form real saddles; asymmetric flanks form rock faces without
// adding fine noise or changing the existing terrain triangle budget.
const ALPINE_DIVIDE=[[-253,-358,0,22,26],[-232,-367,25,25,24],
 [-211,-351,43,30,28],[-194,-355,51,33,29],[-177,-365,35,25,25],
 [-158,-347,44,30,32],[-139,-331,28,30,28],[-117,-340,33,28,34],
 [-95,-316,20,28,30],[-62,-284,0,20,24]];
const ALPINE_BUTTRESSES=[
 [[-379,-222,0,15,16],[-370,-215,20,15,16],[-355,-205,39,17,16],[-332,-191,31,13,15],[-309,-183,18,14,12],[-282,-175,0,14,13]],
 [[-379,-167,0,12,13],[-360,-167,38,12,13],[-341,-168,42,13,14],[-322,-163,30,11,12],[-304,-164,17,11,13],[-282,-169,0,9,12]],
 [[-365,-119,0,13,17],[-349,-118,27,13,17],[-330,-109,33,13,13],[-311,-98,31,13,14],[-295,-102,20,11,15],[-281,-88,17,11,13],[-259,-90,0,14,14]]
];
// Round only the few metres nearest a crest or authored bend. Long sloping
// faces stay directional; a whole-segment ease would turn the chain into domes.
function ridgeSection(along,across,points){
 if(along<=points[0][0]||along>=points[points.length-1][0])return 0;
 let found=false,crest=0,height=0,negativeWidth=0,positiveWidth=0;
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],p=points[i],b=points[i+1];
  const radius=Math.min(3,(p[0]-a[0])*.3,(b[0]-p[0])*.3),d=along-p[0];
  if(Math.abs(d)>=radius)continue;
  const blend=smooth(-radius,radius,d);found=true;
  for(let k=1;k<5;k++){
   const left=p[k]+(p[k]-a[k])*d/(p[0]-a[0]);
   const right=p[k]+(b[k]-p[k])*d/(b[0]-p[0]);
   const value=mix(left,right,blend);
   if(k===1)crest=value;else if(k===2)height=value;else if(k===3)negativeWidth=value;else positiveWidth=value;
  }
  break;
 }
 if(!found)for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];if(along>b[0])continue;
  const t=(along-a[0])/(b[0]-a[0]);found=true;crest=mix(a[1],b[1],t);height=mix(a[2],b[2],t);negativeWidth=mix(a[3],b[3],t);positiveWidth=mix(a[4],b[4],t);break;
 }
 if(!found)return 0;
 const offset=across-crest,width=offset<0?negativeWidth:positiveWidth,rounding=2.8;
 if(Math.abs(offset)>=width)return 0;
 const r=(Math.sqrt(offset*offset+rounding*rounding)-rounding)/(Math.sqrt(width*width+rounding*rounding)-rounding);
 return Math.max(0,height)*(1-r)**1.35;
}
function joinDryRidges(a,b){
 // A shallow fillet joins intersecting rock faces without adding a new floor.
 const blend=Math.max(0,2.4-Math.abs(a-b));
 return Math.max(a,b)+blend*blend/9.6*smooth(0,2,Math.min(a,b));
}
export function alpineRelief(x,z){
 if(!within(x,z)||z>=-253)return 0;
 // Retain the exact original support union and its north-valley apron. The
 // silhouette may change substantially inside it; the outer foot cannot grow.
 let support=0,originalSum=0;
 for(const [cx,cz,rx,rz,top,yaw] of RIDGES){
  const co=Math.cos(yaw),si=Math.sin(yaw),dx=x-cx,dz=z-cz;
  const u=(dx*co+dz*si)/rx,v=(dz*co-dx*si)/rz;
  const r2=u*u+v*v;support=Math.max(support,1-r2);
  if(r2<1)originalSum+=top*(1-r2)**2;
 }
 if(support<=0)return 0;
 let h=ridgeSection(x,z,ALPINE_DIVIDE);
 for(const spur of ALPINE_BUTTRESSES)h=joinDryRidges(h,ridgeSection(z,x,spur));
 const protectedTrail=smooth(12,24,nearest(x,z,trail).d);
 const settlement=smooth(65,88,Math.hypot(x+300,z+320));
 const catchment=smooth(12,24,nearest(x,z,HOLLOWPEAK.channel).d);
 const foreground=1-smooth(-272,-253,z);
 const folds=.91+.055*Math.sin(x*.12+z*.035)+.035*Math.sin(z*.16-x*.06);
 const original=originalSum*protectedTrail*settlement*catchment*foreground*folds;
 const weight=dryRidgeWeight(x,z);if(weight===0)return original;
 return mix(original,h*smooth(0,.22,support)*protectedTrail*settlement*catchment*foreground,weight);
}
export function alpineSnowAt(x,z){return 1-smooth(.65,1.10,Math.hypot((x+150)/100,(z+333)/92));}

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
// Retain the full original water influence plus more than one terrain-cell
// diagonal, so interpolation cannot pull a remodeled dry bank into the water.
function dryRidgeWeight(x,z){
 let weight=smooth(12,18,nearest(x,z,HOLLOWPEAK.channel).d);
 for(const p of [HOLLOWPEAK.pool,HOLLOWPEAK.tarn]){
  const radius=p.r*Math.min(1,p.aspect),edge=1.55+3/radius;
  weight=Math.min(weight,smooth(edge,edge+6/radius,poolRadius(x,z,p)));
 }
 return weight;
}
const FALLS_BUTTRESSES=[
 [[-313,-169,0,14,15],[-296,-175,20,12,13],[-278,-171,26,11,12],[-266,-179,32,12,13],[-253,-169,25,10,11],[-239,-174,17,11,10],[-224,-170,0,12,12]],
 [[-309,-130,0,12,15],[-288,-120,15,11,13],[-269,-123,29,14,12],[-257,-128,26,13,11],[-244,-119,18,11,11],[-225,-125,0,12,13]]
];
export function fallsRelief(x,z){
 const alpine=alpineRelief(x,z);
 if(!withinFalls(x,z))return alpine;
 const keep=smooth(7,13,nearest(x,z,trail).d);
 if(!keep)return alpine;
 const dx=(x+146)/38,dz=(z+268)/45,r=Math.hypot(dx,dz);
 const edge=r+.042*Math.sin(x*.34+z*.16)+.027*Math.sin(z*.37-x*.18);
 const bulk=(1-smooth(.56,1.07,edge))*(20.7+1.6*Math.sin(x*.12+z*.07));
 const face=-241.5+Math.sin(x*.34)*1.8+Math.cos(x*.7)*.9;
 const front=1-.18*smooth(face-6,face-4,z)-.55*smooth(face-1,face+3,z)-.27*smooth(face+3,face+10,z);
 const shoulder=4.6*Math.exp(-(((x+168)/9)**2+((z+254)/15)**2))+6.5*Math.exp(-(((x+129)/12)**2+((z+260)/17)**2));
 const original=Math.max(0,(bulk+shoulder)*front*keep),weight=dryRidgeWeight(x,z);
 if(weight===0)return alpine+original;
 let banks=(bulk+shoulder)*.46;
 for(const spine of FALLS_BUTTRESSES)banks=joinDryRidges(banks,ridgeSection(z,x,spine));
 return alpine+mix(original,Math.max(0,banks*front*keep),weight);
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
 const mat=new T.MeshStandardMaterial({name:'Hollowpeak | scanned marble cliffs',color:'#adb7c2',roughness:.92,normalScale:new T.Vector2(.48,.48),envMapIntensity:.65,vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 if(loadTextures){const loader=new T.TextureLoader(),tex=(suffix,srgb=false)=>{const t=loader.load(new URL('./textures/falls/marble_cliff_02_'+suffix+'.webp',import.meta.url).href);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;return t;};mat.map=tex('diff',true);mat.normalMap=tex('nor_gl');mat.roughnessMap=tex('arm');}
 applyHollowpeakRockSurface(mat);
 const step=terrainStep,x0=Math.floor((ALPINE_BOUNDS.x0+500)/step)*step-500,z0=Math.floor((ALPINE_BOUNDS.z0+500)/step)*step-500;
 const nx=Math.ceil((ALPINE_BOUNDS.x1-x0)/step),nz=Math.ceil((ALPINE_BOUNDS.z1-z0)/step),p=[],uv=[],colors=[],cover=[],weather=[],idx=[];
 for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
  const x=x0+ix*step,z=z0+iz*step,y=heightAt(x,z),slope=Math.hypot(heightAt(x+1,z)-heightAt(x-1,z),heightAt(x,z+1)-heightAt(x,z-1))/2;
  const relief=fallsRelief(x,z),wet=fallsContainsWater(x,z,2);
  const curvature=y-(heightAt(x+6,z)+heightAt(x-6,z)+heightAt(x,z+6)+heightAt(x,z-6))*.25;
  const surface=hollowpeakRockSurface({slope,curvature,relief,wet});
  p.push(x,y+.012,z);uv.push(x/6.8,z/6.8);cover.push(surface.cover);weather.push(surface.weather);
  const shade=wet?.61:1;colors.push(shade,shade,shade);
 }
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const a=iz*(nx+1)+ix,b=a+nx+1,d=a+1,c=b+1;if(Math.max(cover[a],cover[b],cover[c],cover[d])>.001)idx.push(a,b,d,d,b,c);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('rockCover',new T.Float32BufferAttribute(cover,1));geometry.setAttribute('rockWeather',new T.Float32BufferAttribute(weather,1));geometry.setIndex(idx);geometry.computeVertexNormals();geometry.computeBoundingSphere();
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
 for(let z=ALPINE_BOUNDS.z0;z< -222;z+=cell)for(let x=ALPINE_BOUNDS.x0;x<ALPINE_BOUNDS.x1;x+=cell){const corners=[[x,z],[x+cell,z],[x+cell,z+cell],[x,z+cell]],h=corners.map(p=>fallsRelief(...p));
  for(let i=0;i<4;i++){const j=(i+1)%4;if((h[i]>level)===(h[j]>level))continue;const t=(level-h[i])/(h[j]-h[i]),cx=mix(corners[i][0],corners[j][0],t),cz=mix(corners[i][1],corners[j][1],t),key=Math.round(cx*2)+','+Math.round(cz*2);if(seen.has(key)||fallsContainsWater(cx,cz,3))continue;seen.add(key);
   let top=heightAt(cx,cz);for(let a=0;a<8;a++)for(const d of[5,10,18])top=Math.max(top,heightAt(cx+Math.cos(a*Math.PI/4)*d,cz+Math.sin(a*Math.PI/4)*d));
   const c={x:cx,z:cz,r:1.05,height:40,topY:top+.3,landform:true,terrainCliff:true};barriers.push(c);colliders.push(c);
  }
 }
 // The rear of the plunge basin is a rock face, including behind the water.
 for(let x=HOLLOWPEAK.x-4.8;x<=HOLLOWPEAK.x+4.8;x+=1.6){const c={x,z:HOLLOWPEAK.z+3.4,r:1,height:40,topY:HOLLOWPEAK.top+10,landform:true,terrainCliff:true};barriers.push(c);colliders.push(c);}
 scene.add(group);return {group,rock,shadow,bounds:ALPINE_BOUNDS,waters,pool:pools[0],tarn:pools[1],stream,barriers,triangles:idx.length/3};
}
