// Historical Hollowpeak planting reference (73ec33a). This is not rendered and
// never supplies physical contact. Keeping sequential placement decisions on
// their authored ground prevents a local mountain edit from moving distant woods.
// Only pure numbers/arrays are allocated: no Three resources or random draws.
// Hollowpeak's watercourse is cut into the same height field used by the horses.
// Original landforms; the cliff material is Poly Haven / Amal Kumar, CC0.
const HOLLOWPEAK=Object.freeze({x:-150,z:-242.2,top:14.2,level:-.1,run:7.8,width:2.45,
 pool:{x:-150,z:-230.4,r:9.8,aspect:.86,level:-.1},tarn:{x:-147,z:-284,r:5.8,aspect:1.16,level:16.2},
 channel:[[-147,-284,16.2],[-145.8,-277.5,16.2],[-145,-274,15.85],[-148,-261,15.2],[-150,-249,14.55],[-150,-242.2,14.2]]});
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const ALPINE_BOUNDS=Object.freeze({x0:-274,x1:-32,z0:-414,z1:-214});
const within=(x,z)=>x>ALPINE_BOUNDS.x0&&x<ALPINE_BOUNDS.x1&&z>ALPINE_BOUNDS.z0&&z<ALPINE_BOUNDS.z1;
const withinFalls=(x,z)=>x> -202&&x< -100&&z> -321&&z< -214;
// Unequal, overlapping shoulders connect the waterfall to a northern divide.
// Compact support keeps every height exactly unchanged beyond these landforms.
const RIDGES=[[-164,-345,63,48,38,-.18],[-211,-358,49,36,29,.42],
 [-108,-324,46,60,31,-.42],[-187,-308,29,43,16,.22],[-92,-281,39,44,12,.54]];
function alpineRelief(x,z){
 if(!within(x,z)||z>=-253)return 0;
 let h=0;
 for(const [cx,cz,rx,rz,top,yaw] of RIDGES){
  const co=Math.cos(yaw),si=Math.sin(yaw),dx=x-cx,dz=z-cz;
  const u=(dx*co+dz*si)/rx,v=(dz*co-dx*si)/rz;
  const r2=u*u+v*v;if(r2>=1)continue;
  h+=top*(1-r2)**2;
 }
 const protectedTrail=smooth(12,24,nearest(x,z,trail).d);
 const settlement=smooth(65,88,Math.hypot(x+300,z+320));
 const catchment=smooth(12,24,nearest(x,z,HOLLOWPEAK.channel).d);
 const foreground=1-smooth(-272,-253,z);
 // Broad folds give the ridge a changing silhouette without noisy hoof contact.
 const folds=.91+.055*Math.sin(x*.12+z*.035)+.035*Math.sin(z*.16-x*.06);
 return h*protectedTrail*settlement*catchment*foreground*folds;
}
function alpineSnowAt(x,z){return 1-smooth(.65,1.10,Math.hypot((x+150)/100,(z+333)/92));}

const trail=[[-160,-215],[-173.0439,-225.4024],[-187.0279,-235.9788],[-200.6802,-244.8582],[-260,-280]];
function nearest(x,z,points){let best={d:Infinity};for(let k=1;k<points.length;k++){
 const a=points[k-1],b=points[k],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
 const cx=a[0]+dx*t,cz=a[1]+dz*t,d=Math.hypot(x-cx,z-cz);
 if(d<best.d)best={d,x:cx,z:cz,y:mix(a[2]||0,b[2]||0,t),dx,dz,t};
}return best;}
function fallsRadius(a,p){return p.r*(1+.05*Math.sin(a*3+.4)+.025*Math.cos(a*7));}
function poolRadius(x,z,p){const dx=x-p.x,dz=(z-p.z)/p.aspect;return Math.hypot(dx,dz)/fallsRadius(Math.atan2(dz,dx),p);}
function fallsContainsWater(x,z,padding=0){
 if(!within(x,z))return false;
 for(const p of [HOLLOWPEAK.pool,HOLLOWPEAK.tarn])if(poolRadius(x,z,p)<1+padding/p.r)return true;
 return nearest(x,z,HOLLOWPEAK.channel).d<2.6+padding||z>HOLLOWPEAK.z&&z< HOLLOWPEAK.z+HOLLOWPEAK.run+1&&Math.abs(x-HOLLOWPEAK.x)<3.6+padding;
}
function fallsRelief(x,z){
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
 return alpine+Math.max(0,(bulk+shoulder)*front*keep);
}
function fallsTerrainHeight(x,z,height){
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
function fallsAllowsHorse(x,z){return !fallsContainsWater(x,z,1.4)&&fallsRelief(x,z)<1.3;}
function fallsExcludesDryPlants(x,z,heightAt){
 if(!within(x,z))return false;
 return fallsContainsWater(x,z,1.5)||fallsRelief(x,z)>.1&&Math.hypot(heightAt(x+1,z)-heightAt(x-1,z),heightAt(x,z+1)-heightAt(x,z-1))>1.35;
}

export {fallsTerrainHeight as legacyFallsTerrainHeight};
export const HOLLOWPEAK_PLACEMENT_PROFILE='hollowpeak-placement-73ec33a';
export function createHollowpeakPlacementPlan({rawHeightAt,heightAt,terrainStep}){
 if(typeof rawHeightAt!=='function'||typeof heightAt!=='function'||!(terrainStep>0))throw Error('Invalid Hollowpeak planting sampler');
 // One extra grid cell permits all existing 1m/2m slope probes to interpolate
 // across the original support edge using the identical 512-cell diagonal.
 const ix0=Math.floor((ALPINE_BOUNDS.x0+500)/terrainStep)-1,iz0=Math.floor((ALPINE_BOUNDS.z0+500)/terrainStep)-1;
 const ix1=Math.ceil((ALPINE_BOUNDS.x1+500)/terrainStep)+1,iz1=Math.ceil((ALPINE_BOUNDS.z1+500)/terrainStep)+1;
 const nx=ix1-ix0+1,nz=iz1-iz0+1,heights=new Float32Array(nx*nz);
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
  const value=rawHeightAt((ix+ix0)*terrainStep-500,(iz+iz0)*terrainStep-500);
  if(!Number.isFinite(value))throw Error('Nonfinite historical Hollowpeak planting ground');
  heights[iz*nx+ix]=value;
 }
 function planningHeight(x,z){
  const gx=(x+500)/terrainStep-ix0,gz=(z+500)/terrainStep-iz0,ix=Math.floor(gx),iz=Math.floor(gz);
  if(ix<0||iz<0||ix>=nx-1||iz>=nz-1)return heightAt(x,z);
  const fx=gx-ix,fz=gz-iz,i=iz*nx+ix,a=heights[i],b=heights[i+nx],c=heights[i+nx+1],d=heights[i+1];
  return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);
 }
 // The original contour circles are planning occupancy only. Live cliff
 // colliders remain owned by the revised createFallsLandscape implementation.
 const barriers=[],seen=new Set(),cell=2.2,level=3;
 for(let z=ALPINE_BOUNDS.z0;z< -222;z+=cell)for(let x=ALPINE_BOUNDS.x0;x<ALPINE_BOUNDS.x1;x+=cell){
  const corners=[[x,z],[x+cell,z],[x+cell,z+cell],[x,z+cell]],h=corners.map(p=>fallsRelief(...p));
  for(let i=0;i<4;i++){
   const j=(i+1)%4;if((h[i]>level)===(h[j]>level))continue;
   const t=(level-h[i])/(h[j]-h[i]),cx=mix(corners[i][0],corners[j][0],t),cz=mix(corners[i][1],corners[j][1],t),key=Math.round(cx*2)+','+Math.round(cz*2);
   if(seen.has(key)||fallsContainsWater(cx,cz,3))continue;seen.add(key);
   barriers.push({x:cx,z:cz,r:1.05});
  }
 }
 for(let x=HOLLOWPEAK.x-4.8;x<=HOLLOWPEAK.x+4.8;x+=1.6)barriers.push({x,z:HOLLOWPEAK.z+3.4,r:1});
 return Object.freeze({profile:HOLLOWPEAK_PLACEMENT_PROFILE,heightAt:planningHeight,
  excludesDryPlants:(x,z)=>fallsExcludesDryPlants(x,z,planningHeight),
  collidersForPlanning(colliders,liveBarriers){
   const live=new Set(liveBarriers||[]);
   return [...colliders.filter(c=>!live.has(c)),...barriers];
  },
  stats:Object.freeze({gridVertices:heights.length,gridBytes:heights.byteLength,barriers:barriers.length,
   bounds:Object.freeze({x0:ix0*terrainStep-500,x1:ix1*terrainStep-500,z0:iz0*terrainStep-500,z1:iz1*terrainStep-500})})});
}
