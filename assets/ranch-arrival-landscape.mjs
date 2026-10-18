// Original, metre-scale arrival landscape. A designed court, short lawn and
// layered woody borders share the existing ground surface and never own physics.
export const ARRIVAL_LANDSCAPE_PROFILE='ranch-estate-arrival-1';
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const hash=(a,b=0)=>{let n=(Math.imul(Math.round(a*997),374761393)+Math.imul(Math.round(b*991),668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export const ARRIVAL_LAWNS=Object.freeze([
 Object.freeze({id:'north-stable-green',x:-10,z:-29,rx:27,rz:14}),
 Object.freeze({id:'south-arrival-green',x:-12,z:29,rx:25,rz:13}),
 Object.freeze({id:'east-ring-green',x:31,z:-15,rx:12,rz:15}),
 Object.freeze({id:'stable-yard-green',x:-39,z:-12,rx:13,rz:28}),
]);
export const ARRIVAL_BORDERS=Object.freeze([
 Object.freeze({id:'stable-rear-screen',a:[-24,-35.3],b:[-9,-35.0],width:3.7,height:1.65}),
 Object.freeze({id:'north-east-hedgerow',a:[1,-27],b:[16,-28],width:3.3,height:1.35}),
 Object.freeze({id:'east-pavilion-shoulder',a:[33,-19],b:[35,-7],width:3.0,height:1.15}),
 Object.freeze({id:'west-arrival-garden',a:[-22,25.5],b:[-9,29.5],width:3.1,height:.90}),
 Object.freeze({id:'east-arrival-garden',a:[9.3,26],b:[14,31],width:2.8,height:.85}),
 Object.freeze({id:'stable-west-copse',a:[-47,-24],b:[-47,-14],width:3.0,height:1.45}),
]);
function lawnAt(x,z){let w=0;for(const q of ARRIVAL_LAWNS){const d=Math.hypot((x-q.x)/q.rx,(z-q.z)/q.rz);w=Math.max(w,1-smooth(.73,1,d));}return w;}
export function arrivalLawnAt(x,z){if(Math.abs(x)<25.55&&Math.abs(z)<20.55)return 0;return lawnAt(x,z);}
// A flared court becomes the existing narrow bridleway without a hard rectangle.
export function arrivalCourtAt(z){
 const t=clamp((z-20.55)/25.45),bend=smooth(0,1,t);
 const x=7*bend;
 const half=z<29?2.8+3.3*smooth(20.55,29,z):6.1-3.5*smooth(29,46,z);
 return{x,half:Math.max(2.6,half)};
}
const segDist=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
function inCourt(x,z,margin=0){if(z<20.55-margin||z>46+margin)return false;const c=arrivalCourtAt(clamp(z,20.55,46));return Math.abs(x-c.x)<c.half+margin;}
function inYard(x,z,margin=0){return x>-29-margin&&x< -7+margin&&z> -32-margin&&z< -22.4+margin;}
export function arrivalPlantingReason(G,x,z,r=.55,height=1){
 const W=G.world;
 if(![x,z,r,height].every(Number.isFinite))return'nonfinite';
 if(Math.abs(x)<25.6+r&&Math.abs(z)<20.6+r)return'arena';
 if(inCourt(x,z,r+.8)||inYard(x,z,r+.5))return'court';
 if((Math.abs(x+3)<3.9+r&&z> -28&&z< -17)||(Math.abs(x)<4+r&&z>17&&z<28))return'gate approach';
 if(x> -35.8-r&&x< -25+r&&z> -35-r&&z< -11+r)return'stable doors';
 if(W.pathDist(x,z)<r+3.0||(G.worldPaths?.trackDist(x,z)??Infinity)<r+3.2)return'bridleway';
 if(W.loonLake?.containsWater(x,z,r+1.0)||G.quartersPkg?.pondContains?.(x,z))return'water';
 if(G.photoscans?.excludesGroundCover?.(x,z)||G.villageCourts?.contains?.(x,z,r))return'landmark';
 if(Object.values(G.ranch?.SLOTS||{}).some(s=>Math.abs(s.x-x)<6+r+.5&&Math.abs(s.z-z)<6+r+.5))return'building plot';
 if((W.colliders||[]).some(c=>Math.hypot(c.x-x,c.z-z)<(c.r||0)+r+.25))return'existing collider';
 if((W.walls||[]).some(w=>segDist(x,z,[w.x1,w.z1],[w.x2,w.z2])<r+.45))return'fence';
 for(const route of Object.values(G.tables?.RACE_ROUTES||{}).filter(Array.isArray))for(let i=1;i<route.length;i++)if(segDist(x,z,route[i-1],route[i])<r+4.0)return'event lane';
 if(typeof window!=='undefined'&&window.__onCourse?.(x,z,r+3.8))return'event lane';
 const h=W.groundH(x,z);if(!Number.isFinite(h))return'ground';
 if([[r,0],[-r,0],[0,r],[0,-r]].some(([dx,dz])=>Math.abs(W.groundH(x+dx,z+dz)-h)>r*.45))return'slope';
 if(W.solidWorld?.resolve){const p={x,z};W.solidWorld.resolve(p,{bottom:h+.02,top:h+height,radius:r});if(Math.hypot(p.x-x,p.z-z)>.001)return'precise solid';}
 return null;
}
function groundClear(G,x,z,margin=0){const W=G.world;if(W.loonLake?.containsWater(x,z,margin+.35)||G.quartersPkg?.pondContains?.(x,z))return false;if(G.photoscans?.excludesGroundCover?.(x,z))return false;return Number.isFinite(W.groundH(x,z));}
function turfClear(G,x,z){
 const W=G.world;if(arrivalLawnAt(x,z)<.04||inCourt(x,z,.45)||inYard(x,z,.35)||!groundClear(G,x,z,.3))return false;
 if(W.pathDist(x,z)<3.1||(G.worldPaths?.trackDist(x,z)??Infinity)<3.4)return false;
 if((W.colliders||[]).some(c=>Math.hypot(c.x-x,c.z-z)<(c.r||0)+.3))return false;
 if(Object.values(G.ranch?.SLOTS||{}).some(s=>Math.abs(s.x-x)<6.3&&Math.abs(s.z-z)<6.3))return false;
 return true;
}
function leafGeometry(T){
 const p=[0,0,0,-.49,.38,.035,0,.41,.12,.49,.38,.035,-.29,.79,.09,0,.82,.16,.29,.79,.09,0,1,.18];
 const uv=[.5,0,0,.38,.5,.41,1,.38,.2,.79,.5,.82,.8,.79,.5,1],ix=[0,1,2,0,2,3,1,4,5,1,5,2,2,5,6,2,6,3,4,7,5,5,7,6];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function shortTurfGeometry(T){
 const rnd=random(71961),p=[],colors=[],ix=[];
 for(let i=0;i<12;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*.39,x=Math.cos(a)*d,z=Math.sin(a)*d,h=.045+rnd()*.045,w=.006+rnd()*.005,bend=.012+rnd()*.018,ca=Math.cos(a),sa=Math.sin(a),b=p.length/3;
 p.push(x-ca*w,0,z-sa*w,x+ca*w,0,z+sa*w,x+sa*bend,h*.66,z+ca*bend,x+sa*bend*1.4,h,z+ca*bend*1.4);
 ix.push(b,b+1,b+2,b+1,b+3,b+2);for(let j=0;j<4;j++)colors.push(j<2?.48:.80,j<2?.61:.86,j<2?.28:.45);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function batch(T){
 const p=[],n=[],uv=[],c=[],v=new T.Vector3(),norm=new T.Vector3(),normalMatrix=new T.Matrix3(),color=new T.Color();
 return{add(geometry,matrix,tint){const a=geometry.attributes.position,b=geometry.attributes.normal,u=geometry.attributes.uv,index=geometry.index;color.set(tint);normalMatrix.getNormalMatrix(matrix);for(let i=0,len=index?index.count:a.count;i<len;i++){const j=index?index.getX(i):i;v.fromBufferAttribute(a,j).applyMatrix4(matrix);norm.fromBufferAttribute(b,j).applyMatrix3(normalMatrix).normalize();p.push(v.x,v.y,v.z);n.push(norm.x,norm.y,norm.z);uv.push(u?u.getX(j):0,u?u.getY(j):0);c.push(color.r,color.g,color.b);}},finish(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeBoundingSphere();return g;}};
}
// Clip every overlay polygon to the canonical terrain triangles before
// assigning height. This keeps the 12 mm layer continuous on sloped grid cells.
function clipPolygon(poly,a,b,insideSign){
 const cross=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=cross(p)*insideSign,dq=cross(q)*insideSign;if(dp>=-1e-9)out.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out;
}
function groundPolygon(G,poly,append){
 const step=G.world.terrainStep||1000/512,minX=Math.min(...poly.map(p=>p[0])),maxX=Math.max(...poly.map(p=>p[0])),minZ=Math.min(...poly.map(p=>p[1])),maxZ=Math.max(...poly.map(p=>p[1]));
 for(let iz=Math.floor((minZ+500)/step);iz<=Math.floor((maxZ+500)/step);iz++)for(let ix=Math.floor((minX+500)/step);ix<=Math.floor((maxX+500)/step);ix++){
 const x=ix*step-500,z=iz*step-500,A=[x,z],B=[x,z+step],C=[x+step,z+step],D=[x+step,z];
 // PlaneGeometry's diagonal is from its lower-left B to upper-right D.
 for(const tri of[[A,B,D],[B,C,D]]){let clipped=poly;for(let i=0;i<3&&clipped.length;i++)clipped=clipPolygon(clipped,tri[i],tri[(i+1)%3],-1);if(clipped.length<3||!clipped.every(v=>groundClear(G,v[0],v[1])))continue;
 const area=clipped.reduce((sum,p,i)=>{const q=clipped[(i+1)%clipped.length];return sum+p[0]*q[1]-q[0]*p[1];},0);if(Math.abs(area)<1e-10)continue;if(area>0)clipped=clipped.slice().reverse();for(let i=1;i<clipped.length-1;i++)append([clipped[0],clipped[i],clipped[i+1]]);
 }
 }
}
function surfaceGeometry(T,G,quads){
 const p=[],uv=[],c=[],W=G.world;
 for(const q of quads){const[x0,z0,x1,z1,tint]=Array.isArray(q)?q:[0,0,0,0,q.tint],cc=new T.Color(tint),poly=q.polygon||[[x0,z0],[x0,z1],[x1,z1],[x1,z0]];
 groundPolygon(G,poly,tri=>{for(const[x,z]of tri){p.push(x,W.groundH(x,z)+.012,z);uv.push(x/.55,z/.55);c.push(cc.r,cc.g,cc.b);}});}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function settGeometry(T,G,stones){
 const p=[],uv=[],c=[],W=G.world;
 for(const s of stones){const{x,z,w,d,yaw,shade}=s,ca=Math.cos(yaw),sa=Math.sin(yaw),cut=.12,poly=[[-.5+cut,-.5],[.5-cut,-.5],[.5,-.5+cut],[.5,.5-cut],[.5-cut,.5],[-.5+cut,.5],[-.5,.5-cut],[-.5,-.5+cut]].map(([a,b])=>[x+a*w*ca-b*d*sa,z+a*w*sa+b*d*ca]);
 const color=new T.Color().setRGB(.48+shade*.10,.49+shade*.095,.48+shade*.09);
 // Each clipped top remains within the shallow visual layer, with no kerb.
 groundPolygon(G,poly,tri=>{for(const v of tri){p.push(v[0],W.groundH(v[0],v[1])+.014+shade*.002,v[1]);uv.push(v[0]/1.1,v[1]/1.1);c.push(color.r,color.g,color.b);}});
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
// One bounded rendering field is shared by original seed, recycled near,
// middle, mixed and static cover. Current instance roots, not cached rows,
// keep the new hardscape clear after movement, LOD and cell refills.
export function arrivalHardscapeAt(x,z){
 if(inCourt(x,z,.23))return true;
 if(x> -28.73&&x< -7.07&&z> -32.03&&z< -22.27)return true;
 return x> -19.55&&x< -15.25&&z> -11.37&&z< -7.45&&Math.hypot(x+13,z+10)>2.6;
}
const ARRIVAL_COVER_MASK_GLSL=`varying vec2 vEstateCoverRoot;
 float estateHardscape(vec2 p){
  if(p.x< -28.73||p.x>15.3||p.y< -32.03||p.y>46.23)return 0.0;
  if(p.y>=20.32&&p.y<=46.23){float z=clamp(p.y,20.55,46.0),t=clamp((z-20.55)/25.45,0.0,1.0),cx=7.0*t*t*(3.0-2.0*t);
   float hw=z<29.0?2.8+3.3*smoothstep(20.55,29.0,z):6.1-3.5*smoothstep(29.0,46.0,z);
   if(abs(p.x-cx)<max(2.6,hw)+.23)return 1.0;}
  if(p.x> -28.73&&p.x< -7.07&&p.y> -32.03&&p.y< -22.27)return 1.0;
  if(p.x> -19.55&&p.x< -15.25&&p.y> -11.37&&p.y< -7.45&&length(p-vec2(-13.0,-10.0))>2.6)return 1.0;
  return 0.0;
 }
`;
export function installArrivalCoverMask(G){
 const W=G.world,cover=W.nearGroundCover,actual=new Set([W.seedGrass,cover?.near,cover?.flow,cover?.fern,cover?.reed,cover?.rock,cover?.lupin,cover?.meadowDistance?.mesh]),restores=[],materials=new Set(),owners=[];
 function patch(material){
  if(!material||materials.has(material))return;materials.add(material);
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey;
  material.onBeforeCompile=(shader,renderer)=>{
   previous.call(material,shader,renderer);
   shader.vertexShader='varying vec2 vEstateCoverRoot;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 estateCoverRoot=vec4(0.0,0.0,0.0,1.0);
    #ifdef USE_INSTANCING
      estateCoverRoot=instanceMatrix*estateCoverRoot;
    #else
      estateCoverRoot=vec4(transformed,1.0);
    #endif
    vEstateCoverRoot=(modelMatrix*estateCoverRoot).xz;
    #include <project_vertex>`);
   shader.fragmentShader=ARRIVAL_COVER_MASK_GLSL+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(estateHardscape(vEstateCoverRoot)>.5)discard;');
  };
  material.customProgramCacheKey=()=>key.call(material)+'|estate-hardscape-mask-1';material.needsUpdate=true;
  restores.push(()=>{material.onBeforeCompile=previous;material.customProgramCacheKey=key;material.needsUpdate=true;});
 }
 G.scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData.arrivalLandscape||mesh.name.startsWith('Arrival |'))return;
  const named=/^(?:Middle distance pasture|Trail edge \| meadow tussocks|Trail garden \| gazania|Seeded pasture flower clumps|flora_(?:tuft|petal|brack|reed|scrub|juni|sage))$/.test(mesh.name)||/^(?:Undergrowth (?:detail|distance) \| |Retained local cold\/dry cover$|Retained cold\/dry cover \| )/.test(mesh.name);
  if(!actual.has(mesh)&&!mesh.userData.fineGroundCover&&!named)return;
  owners.push({name:mesh.name,uuid:mesh.uuid,instanced:!!mesh.isInstancedMesh});
  for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))patch(material);
  patch(mesh.customDepthMaterial);patch(mesh.customDistanceMaterial);
 });
 return{profile:'estate-hardscape-mask-1',owners,materials:materials.size,currentInstanceRoots:true,matrixRowsChanged:0,newMaterials:0,newTextures:0,dispose(){for(const restore of restores)restore();}};
}
function enhanceLawn(material){
 const old=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);if(material.userData.arrivalLandscape)return()=>{};
 material.userData.arrivalLandscape=ARRIVAL_LANDSCAPE_PROFILE;
 material.onBeforeCompile=(shader,renderer)=>{old.call(material,shader,renderer);shader.vertexShader='varying vec3 vEstatePosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvEstatePosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
 shader.fragmentShader=`varying vec3 vEstatePosition;
 float estateGreen(vec2 p,vec2 c,vec2 r){return 1.0-smoothstep(.73,1.0,length((p-c)/r));}
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`vec2 ep=vEstatePosition.xz;
 float eg=max(max(estateGreen(ep,vec2(-10.0,-29.0),vec2(27.0,14.0)),estateGreen(ep,vec2(-12.0,29.0),vec2(25.0,13.0))),max(estateGreen(ep,vec2(31.0,-15.0),vec2(12.0,15.0)),estateGreen(ep,vec2(-39.0,-12.0),vec2(13.0,28.0))));
 eg*=step(20.55,abs(ep.y))+step(25.55,abs(ep.x))*(1.0-step(20.55,abs(ep.y)));
 // Close-mown alternating lay catches the light, with only a restrained tint.
 float cutLay=.5+.5*sin((ep.x*.89+ep.y*.46)*1.21);
 diffuseColor.rgb*=mix(vec3(1.0),vec3(.91,1.025,.83)*(1.0+(cutLay-.5)*.045),eg*.78);
 #include <roughnessmap_fragment>`);};
 material.customProgramCacheKey=()=>key()+'|'+ARRIVAL_LANDSCAPE_PROFILE;material.needsUpdate=true;
 return()=>{material.onBeforeCompile=old;material.customProgramCacheKey=key;delete material.userData.arrivalLandscape;material.needsUpdate=true;};
}
export function installRanchArrivalLandscape(G){
 if(G.world.arrivalLandscape)return G.world.arrivalLandscape;
 const{THREE:T,world:W,scene}=G,state={profile:ARRIVAL_LANDSCAPE_PROFILE,artOnly:true,physicsChanged:false,ready:null,errors:[],borders:[],rejected:[],turfRoots:[],draws:0,triangles:0,group:null};W.arrivalLandscape=state;
 state.ready=(async()=>{
 await Promise.resolve(); // Capture late synchronous grass installers before binding shared materials.
 await Promise.all([G.horse?.arrivalReady,G.photoscans?.countrysideVistaReady||G.photoscans?.ready,G.worldDetails?.ready,G.undergrowth?.ready,W.mixedSward?.ready,G.worldPaths?.roadsideReady]);
 // THREE allocates UUIDs through Math.random even for static geometry. Isolate
 // only this synchronous build so later world/actor choices retain their stream.
 const previousRandom=Math.random;Math.random=random(12877391);
 try{
 const group=new T.Group();group.name='Meadowlark | designed arrival landscape';group.userData.arrivalLandscape=true;group.userData.collisionIgnore=true;state.group=group;
 const ownedMaterials=[],ownedGeometry=[],ownedTextures=[],terrain=scene.getObjectByName('Pasture terrain'),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),q=new T.Quaternion(),euler=new T.Euler(),up=new T.Vector3(0,1,0),color=new T.Color();
 const resourceMap=source=>{if(!source)return null;const t=source.clone();t.repeat.set(1,1);t.offset.set(0,0);t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;ownedTextures.push(t);return t;};
 const stoneSource=W.ranchArchitecture?.materials?.get('Ranch | foundation stone')?.map;
 const gravelSource=stoneSource; // Resident neutral limestone, never the orange river soil.
 const surfaceMat=new T.MeshStandardMaterial({map:resourceMap(gravelSource),color:'#edf0ee',vertexColors:true,roughness:1,envMapIntensity:.34});surfaceMat.name='Arrival | compressed limestone gravel';ownedMaterials.push(surfaceMat);
 const stoneMat=new T.MeshStandardMaterial({map:resourceMap(stoneSource),vertexColors:true,roughness:.94,envMapIntensity:.38});stoneMat.name='Arrival | embedded limestone setts';ownedMaterials.push(stoneMat);
 const add=(name,geo,mat,cast=false)=>{ownedGeometry.push(geo);const mesh=new T.Mesh(geo,mat);mesh.name=name;mesh.castShadow=cast;mesh.receiveShadow=true;mesh.userData.arrivalLandscape=true;mesh.userData.collisionIgnore=true;group.add(mesh);return mesh;};
 const quads=[],stones=[];
 // A broad pear-shaped gravel court: flared at the gateway, narrow at the trail.
 let ribbonSegments=0;
 for(let z=20.55;z<46;z+=.15){const end=Math.min(46,z+.15),a=arrivalCourtAt(z),b=arrivalCourtAt(end),v=.92+hash(z,17)*.012;quads.push({polygon:[[a.x-a.half,z],[b.x-b.half,end],[b.x+b.half,end],[a.x+a.half,z]],tint:new T.Color().setRGB(v*.985,v,v*1.015)});ribbonSegments++;}
 // The stable working court is kept outside the arena's rail and its riding gates.
 for(let z=-31.8;z< -22.5;z+=.40)for(let x=-28.5;x< -7.3;x+=.40){if((Math.abs(x+3)<4&&z> -28)||!groundClear(G,x,z))continue;const v=.89+hash(x,z)*.018;quads.push([x,z,x+.40,z+.40,new T.Color().setRGB(v*.985,v,v*1.012)]);}
 // Setts follow both curved margins in two unequal courses, never a hard kerb.
 for(let z=20.7,i=0;z<45.7;z+=.36,i++)for(const sign of[-1,1])for(let row=0;row<2;row++){const c=arrivalCourtAt(z),next=arrivalCourtAt(z+.05),x=c.x+sign*(c.half-.13-row*.26),yaw=Math.atan2(next.x-c.x+(next.half-c.half)*sign,.05);stones.push({x,z:z+(row%2)*.17,w:.23+hash(i,row)*.035,d:.30+hash(i,sign)*.035,yaw:-yaw,shade:hash(i+row,sign)});}
 // A short fan of paving within the arrival court signals a cared-for entrance.
 for(let row=0;row<8;row++)for(let col=-7;col<=7;col++){const z=21.1+row*.34,x=col*.34+(row%2)*.17,c=arrivalCourtAt(z);if(Math.abs(x-c.x)<c.half-.65)stones.push({x,z,w:.305,d:.295,yaw:(hash(row,col)-.5)*.035,shade:hash(col,row)});}
 for(let x=-28.3,i=0;x< -7.5;x+=.36,i++)for(const z of[-31.8,-22.55])stones.push({x,z,w:.32,d:.26,yaw:(hash(i,z)-.5)*.04,shade:hash(i,z)});
 // Barn front: restrained flat paving stays away from the existing practice wing.
 for(let z=-11.12,row=0;z< -7.7;z+=.34,row++)for(let x=-19.3,col=0;x< -15.5;x+=.36,col++)if(Math.hypot(x+13,z+10)>2.6)stones.push({x,z,w:.325,d:.295,yaw:(hash(row,col)-.5)*.028,shade:hash(col+21,row)});
 add('Arrival | flowing limestone court',surfaceGeometry(T,G,quads),surfaceMat);
 add('Arrival | fitted ground-level stone edging',settGeometry(T,G,stones),stoneMat);
 const turfRows=[];for(let z=-43;z<43;z+=.78)for(let x=-51;x<44;x+=.78){const rx=x+(hash(x,z)-.5)*.55,rz=z+(hash(z,x)-.5)*.55,w=arrivalLawnAt(rx,rz);if(!turfClear(G,rx,rz)||hash(rx+3,rz)>w*.95)continue;turfRows.push({x:rx,z:rz,y:W.groundH(rx,rz),scale:.84+hash(rx,rz+11)*.30,yaw:hash(rx+31,rz)*TAU});}
 if(turfRows.length>3800){const stride=turfRows.length/3800,selected=Array.from({length:3800},(_,i)=>turfRows[Math.floor(i*stride)]);turfRows.splice(0,turfRows.length,...selected);}
 const turfGeo=shortTurfGeometry(T),turfMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1,envMapIntensity:.4});turfMat.name='Arrival | clipped living turf';ownedGeometry.push(turfGeo);ownedMaterials.push(turfMat);
 const turf=new T.InstancedMesh(turfGeo,turfMat,turfRows.length);turf.name='Arrival | dense short lawn';turf.receiveShadow=true;turf.castShadow=false;turf.userData.fineGroundCover=true;turf.userData.collisionIgnore=true;
 turfRows.forEach((p,i)=>{position.set(p.x,p.y-.008,p.z);q.setFromAxisAngle(up,p.yaw);scale.set(p.scale,p.scale,p.scale);matrix.compose(position,q,scale);turf.setMatrixAt(i,matrix);color.setRGB(.87+hash(p.x,p.z)*.10,.97,.88);turf.setColorAt(i,color);});turf.instanceMatrix.needsUpdate=true;if(turf.instanceColor)turf.instanceColor.needsUpdate=true;turf.computeBoundingSphere();group.add(turf);state.turfRoots=turfRows;
 const leaves=leafGeometry(T),twigs=new T.CylinderGeometry(.011,.018,1,5),leafBatch=batch(T),woodBatch=batch(T),rnd=random(827139),local=new T.Vector3(),direction=new T.Vector3();
 const palette=['#41592e','#536a35','#617a42','#71844a','#3d5733','#7a8750'];
 for(const bed of ARRIVAL_BORDERS){const length=Math.hypot(bed.b[0]-bed.a[0],bed.b[1]-bed.a[1]),dx=(bed.b[0]-bed.a[0])/length,dz=(bed.b[1]-bed.a[1])/length,plants=[];
 for(let t=.3;t<length;t+=1.02)for(let row=0;row<2;row++){const offset=(row-.5)*bed.width*.40+(rnd()-.5)*.28,x=bed.a[0]+dx*t-dz*offset,z=bed.a[1]+dz*t+dx*offset,height=bed.height*(.65+rnd()*.35)*(row===1?1:.78),radius=.54+rnd()*.18,reason=arrivalPlantingReason(G,x,z,radius+.18,height);if(reason){state.rejected.push({bed:bed.id,x,z,reason});continue;}const root={x,y:W.groundH(x,z)-.025,z,height,radius,bed:bed.id};plants.push(root);
 // Fan-shaped woody shoots carry individual folded leaves. No opaque sphere core.
 for(let shoot=0;shoot<6;shoot++){const a=shoot*2.399+rnd()*.42,h=height*(.5+rnd()*.5),reach=radius*(.45+rnd()*.45),start=new T.Vector3(x,root.y+.03,z),end=new T.Vector3(x+Math.cos(a)*reach,root.y+h,z+Math.sin(a)*reach),len=start.distanceTo(end);direction.subVectors(end,start).normalize();q.setFromUnitVectors(up,direction);position.copy(start).add(end).multiplyScalar(.5);scale.set(1,len,1);matrix.compose(position,q,scale);woodBatch.add(twigs,matrix,'#5c5940');
 for(let j=0;j<17;j++){const along=.28+(j/17)*.74,side=j%2?1:-1,leafA=a+side*(.8+rnd()*.6),length=.12+rnd()*.065;local.lerpVectors(start,end,along);local.x+=Math.cos(leafA)*.035;local.z+=Math.sin(leafA)*.035;position.copy(local);euler.set(.5+rnd()*.95,leafA,(rnd()-.5)*.36);q.setFromEuler(euler);scale.set(length*.58,length,length);matrix.compose(position,q,scale);leafBatch.add(leaves,matrix,palette[(shoot+j+row)%palette.length]);}
 }
 }
 state.borders.push({id:bed.id,plants});}
 const leafMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.91,envMapIntensity:.42});leafMat.name='Arrival | modelled broadleaf hedge';
 const woodMat=new T.MeshStandardMaterial({vertexColors:true,roughness:1,envMapIntensity:.32});woodMat.name='Arrival | living woody stems';ownedMaterials.push(leafMat,woodMat);
 add('Arrival | layered hedge leaves',leafBatch.finish(),leafMat,true);add('Arrival | branching boundary stems',woodBatch.finish(),woodMat,true);leaves.dispose();twigs.dispose();
 const restore=terrain?.material?enhanceLawn(terrain.material):()=>{},coverMask=installArrivalCoverMask(G);state.coverMask=coverMask;scene.add(group);
 group.traverse(o=>{if(o.isMesh){state.draws++;state.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
 state.court={quads:quads.length,ribbonSegments,continuousWidth:true,continuousCurvedBoundary:true,palette:'resident-cool-limestone',setts:stones.length,surfaceOffset:.012,edgeTopMax:.016,gateWidth:5.6,terrainAuthorityUnchanged:true};state.plants=state.borders.reduce((n,b)=>n+b.plants.length,0);state.resources={draws:state.draws,triangles:state.triangles,materials:ownedMaterials.length,textures:ownedTextures.length,newNetworkLoads:0};
 state.setVisible=visible=>{group.visible=!!visible;};state.dispose=()=>{coverMask.dispose();restore();group.removeFromParent();ownedGeometry.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());delete W.arrivalLandscape;};
 return state;
 }finally{Math.random=previousRandom;}
 })().catch(error=>{state.errors.push(String(error?.message||error));throw error;});
 return state;
}
