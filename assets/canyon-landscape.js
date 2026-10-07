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
export function canyonRelief(x,z){
 let height=0;
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
  height=Math.max(height,Math.max(0,crest*cap*crown));
 }
 return height>0?height*keepLandmarks(x,z):0;
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
  sh.vertexShader='attribute float cliffCover; varying float canyonCover; varying vec3 canyonPosition; varying vec3 canyonNormal;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   canyonCover=cliffCover;canyonPosition=(modelMatrix*vec4(position,1.0)).xyz;canyonNormal=normalize(mat3(modelMatrix)*normal);`);
  sh.fragmentShader=`varying float canyonCover; varying vec3 canyonPosition; varying vec3 canyonNormal;
   vec2 cliffWarp(vec2 p){return p/5.49+vec2(sin(p.x*.06+p.y*.07),sin(p.x*.04-p.y*.09))*.24;}
   vec4 cliffSample(sampler2D tex,vec2 p){vec2 uv=cliffWarp(p);return mix(texture2D(tex,uv),texture2D(tex,uv*.713+vec2(.43,.72)),.44);}
   vec4 cliffTriplanar(sampler2D tex){vec3 w=pow(abs(normalize(canyonNormal)),vec3(6.0));w/=max(dot(w,vec3(1.0)),.001);
    return cliffSample(tex,canyonPosition.zy)*w.x+cliffSample(tex,canyonPosition.xz)*w.y+cliffSample(tex,canyonPosition.xy)*w.z;}
  `+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','diffuseColor*=cliffTriplanar(map);');
  sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=canyonCover;\n#include <alphatest_fragment>');
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*cliffTriplanar(roughnessMap).g;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`
   vec3 cn=normalize(canyonNormal),cw=pow(abs(cn),vec3(6.0));cw/=max(dot(cw,vec3(1.0)),.001);
   vec3 cx=cliffSample(normalMap,canyonPosition.zy).xyz*2.0-1.0,cy=cliffSample(normalMap,canyonPosition.xz).xyz*2.0-1.0,cz=cliffSample(normalMap,canyonPosition.xy).xyz*2.0-1.0;
   cx.xy*=normalScale;cy.xy*=normalScale;cz.xy*=normalScale;
   vec3 cliffNormal=normalize(vec3(cx.z*sign(cn.x),cx.y,cx.x)*cw.x+vec3(cy.x,cy.z*sign(cn.y),cy.y)*cw.y+vec3(cz.x,cz.y,cz.z*sign(cn.z))*cw.z);
   normal=normalize(mat3(viewMatrix)*normalize(mix(cn,cliffNormal,.62)));`);
 };
 surface.customProgramCacheKey=()=> 'canyon-terrain-triplanar-1';
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
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('cliffCover',new THREE.Float32BufferAttribute(cover,1));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
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
