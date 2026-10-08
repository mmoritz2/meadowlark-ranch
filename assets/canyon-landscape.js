// Original terrain composition: connected sandstone banks around the riding
// valley. The same height field feeds visible terrain, hoof contact and dressing.
export const CANYON_RIDGES=[
 {id:'north-rim',clefts:[38,96],points:[[-329,47,25,29],[-297,49,25,36],[-266,44,24,34],[-234,36,22,38],[-205,32,21,31],[-181,29,17,23]]},
 {id:'western-wall',clefts:[21],points:[[-267,146,14,21],[-276,162,16,29],[-284,181,17,25],[-286,193,13,18]]},
 {id:'eastern-wall',clefts:[12],points:[[-224,164,9,20],[-231,174,10,23],[-239,181,8,14]]},
 {id:'oasis-butte',clefts:[19],points:[[-169,153,18,22],[-151,169,21,27],[-132,158,18,23]]},
];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const segment=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);return{a,b,dx,dz,len,len2:len*len};};
const prepared=CANYON_RIDGES.map(r=>{const pad=Math.max(...r.points.map(p=>p[2]))*1.2+3;let run=0;return{...r,
 minX:Math.min(...r.points.map(p=>p[0]))-pad,maxX:Math.max(...r.points.map(p=>p[0]))+pad,
 minZ:Math.min(...r.points.map(p=>p[1]))-pad,maxZ:Math.max(...r.points.map(p=>p[1]))+pad,
 segments:r.points.slice(1).map((p,i)=>{const s=segment(r.points[i],p);s.run=run;run+=s.len;return s;})};});
const cut=[[-222,140],[-240,162],[-252,180],[-258,194]];
const derby=[[-196,200],[-200,262],[-262,280],[-305,255],[-300,212],[-262,198],[-226,190]];
const derbySegments=derby.map((p,i)=>segment(p,derby[(i+1)%derby.length]));
const cutSegments=cut.slice(1).map((p,i)=>segment(cut[i],p));
function closest(x,z,s){return Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/s.len2));}
function lineDistance(x,z,segments){let d=Infinity;for(const s of segments){const t=closest(x,z,s);d=Math.min(d,Math.hypot(x-s.a[0]-t*s.dx,z-s.a[1]-t*s.dz));}return d;}
function keepLandmarks(x,z){
 let keep=smooth(20,27,Math.hypot(x+200,z-158)); // palms, water, and all shoreline approaches
 keep=Math.min(keep,smooth(1,1.45,Math.hypot((x+225)/29,(z-122)/20)));
 keep=Math.min(keep,smooth(1,1.3,Math.hypot((x+238)/36,(z-220)/34)));
 keep=Math.min(keep,smooth(20,27,Math.abs(z-(120+Math.sin(x*.012)*45))));
 if(z>165)keep=Math.min(keep,smooth(10,18,lineDistance(x,z,derbySegments)));
 return keep;
}
// Two original eroded saddles affect only the upper oasis crown. The compact
// cubic bumps and quintic masks have zero first/second derivatives at their ends.
const crestSmooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
function oasisCrestDepression(x,z,relief){
 if(relief<=8)return 0;
 const bump=(cx,cz,yaw,along,across)=>{const dx=x-cx,dz=z-cz,co=Math.cos(yaw),si=Math.sin(yaw);
  const r2=((dx*co+dz*si)/along)**2+((dz*co-dx*si)/across)**2;return r2<1?(1-r2)**3:0;};
 const west=bump(-163.8,163.6,.7266,14,17),east=bump(-138.8,168,-.5248,13,16);
 if(west===0&&east===0)return 0;
 // The authored east/front knot is z158. Retain its front face plus a
 // canonical terrain-cell halo through z160, then fade over six metres.
 // Both saddle centres sit rearward on the upper crown.
 // Retain the named central crown and all existing graded landmark protections.
 let keep=crestSmooth(9,13,Math.hypot(x+151,z-169));
 keep*=crestSmooth(32,38,Math.hypot(x+200,z-158));
 keep*=crestSmooth(1.6,1.8,Math.hypot((x+225)/29,(z-122)/20));
 keep*=crestSmooth(1.4,1.6,Math.hypot((x+238)/36,(z-220)/34));
 keep*=crestSmooth(30,37,Math.abs(z-(120+Math.sin(x*.012)*45)));
 keep*=crestSmooth(21,28,lineDistance(x,z,derbySegments));
 keep*=crestSmooth(11,17,lineDistance(x,z,cutSegments));
 return 4.4*(1-(1-west)*(1-east*3.5/4.4))*crestSmooth(8,16,relief)*keep*crestSmooth(160,166,z);
}
// Original front/crown erosion: unequal retained buttresses and a diagonal
// recess. It changes the shared terrain, never just the sandstone overlay.
// Survey clearance covers the original River Road's15m relaxation drift,
// four-metre walking tube and a canonical terrain-cell interpolation halo.
const oasisFrontRoad=[[-28,135],[-60,131],[-95,125],[-130,120],[-165,120],[-197,126],[-219,133]];
const oasisFrontRoadSegments=oasisFrontRoad.slice(1).map((p,i)=>segment(oasisFrontRoad[i],p));
function oasisFrontMask(x,z,relief){
 if(relief<=8||x<=-183||x>=-114||z<=137||z>=183)return 0;
 let keep=crestSmooth(8,18,relief);
 keep*=crestSmooth(-183,-177,x)*(1-crestSmooth(-120,-114,x));
 keep*=crestSmooth(137,143,z)*(1-crestSmooth(177,183,z));
 keep*=crestSmooth(30,35,Math.hypot(x+200,z-158));
 keep*=crestSmooth(23,29,lineDistance(x,z,oasisFrontRoadSegments));
 keep*=crestSmooth(21,28,lineDistance(x,z,derbySegments));
 keep*=crestSmooth(11,17,lineDistance(x,z,cutSegments));
 return keep;
}
function oasisFrontDepression(x,z,relief){
 const keep=oasisFrontMask(x,z,relief);if(keep===0)return 0;
 const bump=(cx,cz,yaw,along,across)=>{const dx=x-cx,dz=z-cz,co=Math.cos(yaw),si=Math.sin(yaw);
  const r2=((dx*co+dz*si)/along)**2+((dz*co-dx*si)/across)**2;return r2<1?(1-r2)**3:0;};
 const gully=bump(-150.5,160.5,1.0,23,6.6),west=bump(-165,151,.22,14,12),east=bump(-128,157,-.3,12,13);
 if(gully===0&&west===0&&east===0)return 0;
 const erosion=7.0*(1-(1-gully)*(1-west*2.7/7.0)*(1-east*2.1/7.0));
 return erosion*keep;
}
// Original scan-derived backing seat for the principal Oasis face. Values are
// metre cuts authored from the fixed scanned lower surface and final terrain.
// The road and crown remain outside this compact C2 footprint; fixed scan Y is
// retained separately. This is terrain backing, not scan-surface collision.
export const OASIS_FACE=Object.freeze({x:-139,z:145,yaw:-.2,width:30,baseY:9.160923485526174});
const oasisPrincipalCuts=[
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.00678,0.01356,0.00678,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0.00318,0.01936,0.02917,0.01409,0.08895,0.31224,0.56699,0.78177,0.93949,0.96644,0.89374,0.81178,0.68576,0.54572,0.40746,0.22757,0.06424,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0.08833,0.16035,0.36879,0.58233,0.78378,1.00817,1.19754,1.53031,2.19012,2.97824,3.5771,3.76557,3.46752,3.20757,3.19046,2.91034,2.39446,1.89129,1.33155,0.79753,0.49615,0.28984,0.07991,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0.02208,0.04416,0.25447,0.73759,1.15511,1.90455,3.15897,4.11496,4.73966,5.53876,6.46274,6.52591,5.99025,6.11281,6.43703,6.4732,6.02995,5.1022,4.26697,3.53678,2.50238,1.34857,0.57969,0.15982,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0.11619,0.36879,0.57596,1.53518,3.41011,4.69364,5.24419,5.75612,6.2587,5.44758,4.40785,5.62106,6.7924,6.62215,6.07194,5.20392,4.48989,3.98919,2.86914,1.20868,0.28984,0.07991,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0.39506,1.23014,1.76214,1.94589,2.09524,2.20722,1.71701,1.25046,2.02288,2.67599,2.52763,2.26657,1.95045,1.70675,1.55639,1.10004,0.35626,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
];
function oasisPrincipalSeat(x,z,relief){
 if(x<=-155||x>=-121||z<=137||z>=153||relief<=2.2)return 0;
 const gx=x+156,gz=z-136,ix=Math.floor(gx),iz=Math.floor(gz),sx=crestSmooth(0,1,gx-ix),sz=crestSmooth(0,1,gz-iz),i=iz*37+ix;
 const a=oasisPrincipalCuts[i],b=oasisPrincipalCuts[i+1],c=oasisPrincipalCuts[i+37],d=oasisPrincipalCuts[i+38];
 const cut=(a+(b-a)*sx)*(1-sz)+(c+(d-c)*sx)*sz;
 const edge=crestSmooth(-155,-153,x)*(1-crestSmooth(-123,-121,x))*crestSmooth(137,139,z)*(1-crestSmooth(151,153,z));
 return Math.min(Math.max(0,relief-2.2),cut*edge*crestSmooth(2.2,4.5,relief));
}
export function canyonRelief(x,z){
 let height=0,oasisUpperDelta=0;
 for(const r of prepared){
  if(x<r.minX||x>r.maxX||z<r.minZ||z>r.maxZ)continue;
  let best=Infinity,crest=0,along=0;
  for(const s of r.segments){const t=closest(x,z,s),w=s.a[2]+(s.b[2]-s.a[2])*t;
   const d=Math.hypot(x-s.a[0]-t*s.dx,z-s.a[1]-t*s.dz)/w;
   if(d<best){best=d;crest=s.a[3]+(s.b[3]-s.a[3])*t;along=s.run+s.len*t;}
  }
  // Irregular buttresses and recessed beds keep the banks from being capsules.
  const cleft=r.clefts.reduce((n,c)=>n+.22*Math.exp(-Math.pow((along-c)/4.5,2)),0);
  const edge=best+(cleft+Math.sin(x*.15+z*.10)*.080+Math.sin(z*.31-x*.17)*.036)*smooth(.22,.58,best);
  if(edge>=1.08)continue;
  const cap=1-.20*smooth(.34,.52,edge)-.62*smooth(.57,.82,edge)-.18*smooth(.81,1.08,edge);
  const crown=.94+.04*Math.sin(along*.18)+.025*Math.sin(x*.24+z*.19)-cleft*.28;
  const ridgeHeight=Math.max(0,crest*cap*crown);
  if(r.id==='oasis-butte')oasisUpperDelta=Math.max(0,crest*(1-crestSmooth(.18,1.08,edge))*crown)-ridgeHeight;
  height=Math.max(height,ridgeHeight);
 }
 const relief=height>0?height*keepLandmarks(x,z):0;
 const retained=relief-oasisCrestDepression(x,z,relief);
 const face=retained+oasisUpperDelta*keepLandmarks(x,z)*oasisFrontMask(x,z,retained);
 const front=face-oasisFrontDepression(x,z,retained);
 return front-oasisPrincipalSeat(x,z,front);
}
// Retire isolated towers swallowed by the connected banks and the open canyon
// route. Callers still consume their seeded placements, keeping other regions fixed.
export function canyonReplacesFormation(x,z,radius=0){
 if(z>129&&z<209&&lineDistance(x,z,cutSegments)<radius+8)return true;
 for(const r of prepared){
  if(x<r.minX-radius||x>r.maxX+radius||z<r.minZ-radius||z>r.maxZ+radius)continue;
  for(const s of r.segments){const t=closest(x,z,s),w=s.a[2]+(s.b[2]-s.a[2])*t;
   if(Math.hypot(x-s.a[0]-t*s.dx,z-s.a[1]-t*s.dz)<w+radius+2)return true;
  }
 }
 return false;
}
export function canyonCliffAt(x,z,heightAt){
 if(canyonRelief(x,z)<.1)return false;
 return Math.hypot(heightAt(x+1,z)-heightAt(x-1,z),heightAt(x,z+1)-heightAt(x,z-1))>.72*2;
}

export function createCanyonLandscape({THREE,scene,heightAt,terrainStep,material,colliders}){
 const group=new THREE.Group();group.name='Canyon | connected escarpments';
 const surface=material.clone();surface.name='Canyon | terrain sandstone';surface.vertexColors=false;
 surface.transparent=true;surface.depthWrite=false;surface.polygonOffset=true;surface.polygonOffsetFactor=-1;surface.polygonOffsetUnits=-1;
 surface.onBeforeCompile=sh=>{
  sh.vertexShader='attribute float cliffCover; attribute float oasisTone; varying float canyonCover; varying float canyonTone; varying vec3 canyonPosition; varying vec3 canyonNormal;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   canyonCover=cliffCover;canyonTone=oasisTone;canyonPosition=(modelMatrix*vec4(position,1.0)).xyz;canyonNormal=normalize(mat3(modelMatrix)*normal);`);
  sh.fragmentShader=`varying float canyonCover; varying float canyonTone; varying vec3 canyonPosition; varying vec3 canyonNormal;
   vec2 cliffWarp(vec2 p){return p/5.49+vec2(sin(p.x*.06+p.y*.07),sin(p.x*.04-p.y*.09))*.24;}
   vec4 cliffSample(sampler2D tex,vec2 p){vec2 uv=cliffWarp(p);return mix(texture2D(tex,uv),texture2D(tex,uv*.713+vec2(.43,.72)),.44);}
   vec4 cliffTriplanar(sampler2D tex){vec3 w=pow(abs(normalize(canyonNormal)),vec3(6.0));w/=max(dot(w,vec3(1.0)),.001);
    return cliffSample(tex,canyonPosition.zy)*w.x+cliffSample(tex,canyonPosition.xz)*w.y+cliffSample(tex,canyonPosition.xy)*w.z;}
  `+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',"vec4 canyonRock=cliffTriplanar(map); float canyonGrey=dot(canyonRock.rgb,vec3(.2126,.7152,.0722)); canyonRock.rgb=mix(canyonRock.rgb,mix(canyonRock.rgb,vec3(canyonGrey),.64)*vec3(.90,.88,.84),canyonTone); diffuseColor*=canyonRock;");
  sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=canyonCover;\n#include <alphatest_fragment>');
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*cliffTriplanar(roughnessMap).g;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`
   vec3 cn=normalize(canyonNormal),cw=pow(abs(cn),vec3(6.0));cw/=max(dot(cw,vec3(1.0)),.001);
   vec3 cx=cliffSample(normalMap,canyonPosition.zy).xyz*2.0-1.0,cy=cliffSample(normalMap,canyonPosition.xz).xyz*2.0-1.0,cz=cliffSample(normalMap,canyonPosition.xy).xyz*2.0-1.0;
   cx.xy*=normalScale;cy.xy*=normalScale;cz.xy*=normalScale;
   vec3 cliffNormal=normalize(vec3(cx.z*sign(cn.x),cx.y,cx.x)*cw.x+vec3(cy.x,cy.z*sign(cn.y),cy.y)*cw.y+vec3(cz.x,cz.y,cz.z*sign(cn.z))*cw.z);
   normal=normalize(mat3(viewMatrix)*normalize(mix(cn,cliffNormal,.62)));`);
 };
 surface.customProgramCacheKey=()=> 'canyon-terrain-triplanar-oasis-2';
 const fields=[],barriers=[],seen=new Set(),step=terrainStep;
 for(const r of prepared){
  const x0=Math.floor((r.minX+500)/step)*step-500,z0=Math.floor((r.minZ+500)/step)*step-500;
  const nx=Math.ceil((r.maxX-x0)/step),nz=Math.ceil((r.maxZ-z0)/step),p=[],uv=[],cover=[],indices=[];
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){const x=x0+ix*step,z=z0+iz*step;
   p.push(x,heightAt(x,z)+.012,z);uv.push(x/5.49,z/5.49);cover.push(smooth(.4,3.6,canyonRelief(x,z)));
  }
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
   const a=iz*(nx+1)+ix,b=a+nx+1,d=a+1,c=b+1;
   if(Math.max(cover[a],cover[b],cover[c],cover[d])<.001)continue;
   indices.push(a,b,d,d,b,c);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('cliffCover',new THREE.Float32BufferAttribute(cover,1));geo.setAttribute('oasisTone',new THREE.Float32BufferAttribute(new Float32Array(cover.length).fill(r.id==='oasis-butte'?1:0),1));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,surface);mesh.name='Canyon | '+r.id;mesh.castShadow=true;mesh.receiveShadow=true;mesh.renderOrder=1;group.add(mesh);
  fields.push({id:r.id,triangles:indices.length/3,mesh});
  // A two-metre contour follows the foot of each cliff, leaving the floor and
  // graded end approaches clear. Absolute tops let a flying mount pass above.
  const cell=2.5,level=2.2;
  for(let z=r.minZ;z<r.maxZ;z+=cell)for(let x=r.minX;x<r.maxX;x+=cell){
   const corners=[[x,z],[x+cell,z],[x+cell,z+cell],[x,z+cell]],h=corners.map(p=>canyonRelief(...p)),cross=[];
   for(let i=0;i<4;i++){const j=(i+1)%4;if((h[i]>level)===(h[j]>level))continue;const t=(level-h[i])/(h[j]-h[i]);cross.push([corners[i][0]+(corners[j][0]-corners[i][0])*t,corners[i][1]+(corners[j][1]-corners[i][1])*t]);}
   for(const p of cross){const k=Math.round(p[0]*2)+','+Math.round(p[1]*2);if(seen.has(k))continue;seen.add(k);
    let top=heightAt(...p);for(let a=0;a<8;a++)for(const d of[6,12,20])top=Math.max(top,heightAt(p[0]+Math.cos(a*Math.PI/4)*d,p[1]+Math.sin(a*Math.PI/4)*d));
    const c={x:p[0],z:p[1],r:1.05,height:80,topY:top+.3,landform:true,terrainCliff:true};barriers.push(c);colliders.push(c);
   }
  }
 }
 scene.add(group);return {group,fields,barriers,triangles:fields.reduce((n,f)=>n+f.triangles,0),relief:canyonRelief};
}
