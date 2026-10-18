import {LOON_LAKE,loonLakeFootprintPoints,loonLakeShoreDistance,buildLoonLakeWetSurface,createLoonWetQueries} from './loon-lake.mjs?v=loon-lake-4';

// Original landscape arrays. Both water and shore are clipped inside the actual
// canonical terrain triangles: no second bed and no groundH callback recursion.
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const bankWidthAt=(x,z)=>.72+.48*(.5+.5*Math.sin(x*.21+z*.31))+.26*(.5+.5*Math.sin(x*.47-z*.23));
function clip(poly,value){
 const out=[];if(!poly.length)return out;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],va=value(a),vb=value(b),ia=va>=-1e-10,ib=vb>=-1e-10;
  if(ia)out.push(a);
  if(ia!==ib){const t=va/(va-vb);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}
 }
 return out;
}
function polygonTriangles(points){
 const ids=points.map((_,i)=>i),out=[],p=points.map(([x,z])=>({x,z}));
 let area=0;for(let i=0;i<p.length;i++)area+=p[i].x*p[(i+1)%p.length].z-p[(i+1)%p.length].x*p[i].z;
 if(area<0)ids.reverse();
 for(let guard=0;ids.length>3&&guard<points.length**2;guard++){
  let found=false;
  for(let i=0;i<ids.length;i++){
   const a=ids[(i+ids.length-1)%ids.length],b=ids[i],c=ids[(i+1)%ids.length];if(cross(p[a],p[b],p[c])<=1e-9)continue;
   if(ids.some(k=>k!==a&&k!==b&&k!==c&&cross(p[a],p[b],p[k])>=-1e-9&&cross(p[b],p[c],p[k])>=-1e-9&&cross(p[c],p[a],p[k])>=-1e-9))continue;
   out.push([p[a],p[b],p[c]]);ids.splice(i,1);found=true;break;
  }
  if(!found)throw Error('Loon shore outline cannot be triangulated');
 }
 if(ids.length===3)out.push(ids.map(i=>p[i]));else throw Error('Incomplete Loon shore triangulation');
 return out;
}
function subtractConvex(poly,hole){
 // The island contour is clockwise. Partition the complement at each edge;
 // emitted polygons are disjoint and the final inside remainder is discarded.
 const out=[];let remainder=poly;
 for(let e=0;e<hole.length&&remainder.length;e++){
  const a={x:hole[e][0],z:hole[e][1]},b={x:hole[(e+1)%hole.length][0],z:hole[(e+1)%hole.length][1]};
  const outside=clip(remainder,p=>cross(a,b,p));if(outside.length>=3)out.push(outside);
  remainder=clip(remainder,p=>-cross(a,b,p));
 }
 return out;
}
function arrays(){return {position:[],normal:[],uv:[],color:[],index:[],cells:[]};}
function face(out,tri,cell,water,shoreDistance=loonLakeShoreDistance){
 if(Math.abs(cross(...tri))<1e-9)return;
 const p=tri.map(q=>[Math.fround(q.x),Math.fround(water?LOON_LAKE.level:q.y+.018),Math.fround(q.z)]),beds=tri.map(q=>q.y);
 const a=p[0],b=p[1],c=p[2],u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
 let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 if(n[1]<0){[p[1],p[2]]=[p[2],p[1]];[beds[1],beds[2]]=[beds[2],beds[1]];n=n.map(x=>-x);}
 const length=Math.hypot(...n);if(length<1e-10)return;n=n.map(q=>q/length);
 const start=out.position.length/3;
 for(let i=0;i<p.length;i++){const q=p[i];
  out.position.push(...q);out.normal.push(...n);out.uv.push(q[0]/(water?9:1.7),q[2]/(water?9:1.7));
  if(water){const d=Math.max(0,LOON_LAKE.level-beds[i]),t=Math.max(0,Math.min(1,d/1.15));out.color.push(1.35-.69*t,1.22-.33*t,.83+.20*t,.28+.68*Math.min(1,d/.65));}
  else{const sd=shoreDistance(q[0],q[2]),tone=.68+.06*Math.sin(q[0]*.17+q[2]*.29);out.color.push(tone,tone*.94,tone*.79,Math.max(0,Math.min(1,(bankWidthAt(q[0],q[2])-sd)/.45)));}
 }
 out.index.push(start,start+1,start+2);out.cells.push(cell);
}
function pack(out){return {position:new Float32Array(out.position),normal:new Float32Array(out.normal),uv:new Float32Array(out.uv),
 color:new Float32Array(out.color),index:new Uint32Array(out.index),sourceCells:new Uint32Array(out.cells)};}

export function buildLoonLakeLandscape({terrainH,terrainStep=1.953125,origin=-500,terrainSegments=512,lakeRuntime=null}){
 if(typeof terrainH!=='function')throw Error('Actual Loon canonical terrain required');
 const wet=lakeRuntime?.wetSurface||buildLoonLakeWetSurface({terrainH,terrainStep}),queries=lakeRuntime||createLoonWetQueries(wet),water=arrays(),shore=arrays(),B=wet.bounds;
 for(let i=0;i<wet.faces.length;i++){const tri=wet.faces[i].map(k=>({x:wet.verts[k].x,y:wet.verts[k].bed,z:wet.verts[k].z}));face(water,tri,wet.sourceCells[i],true);}
 const ix0=Math.floor((B.minX-2-origin)/terrainStep),ix1=Math.ceil((B.maxX+2-origin)/terrainStep),iz0=Math.floor((B.minZ-2-origin)/terrainStep),iz1=Math.ceil((B.maxZ+2-origin)/terrainStep);
 for(let iz=iz0;iz<iz1;iz++)for(let ix=ix0;ix<ix1;ix++){
  const x=origin+ix*terrainStep,z=origin+iz*terrainStep;
  const v=[[x,z],[x+terrainStep,z],[x,z+terrainStep],[x+terrainStep,z+terrainStep]].map(([x,z])=>({x,y:terrainH(x,z),z}));
  for(let side=0;side<2;side++){
   const tri=side?[v[3],v[2],v[1]]:[v[0],v[1],v[2]],cell=(iz*terrainSegments+ix)*2+side;
   let poly=clip(tri,p=>bankWidthAt(p.x,p.z)-queries.shoreDistance(p.x,p.z));
   poly=clip(poly,p=>queries.shoreDistance(p.x,p.z)+.38);
   poly=clip(poly,p=>Math.hypot(p.x/23.5,p.z/18.5)-1.02);
   for(let k=1;k<poly.length-1;k++)face(shore,[poly[0],poly[k],poly[k+1]],cell,false,queries.shoreDistance);
  }
 }
 return {profile:LOON_LAKE.profile,water:pack(water),shore:pack(shore),bounds:{...B},sourceTerrainStep:terrainStep};
}

// Existing mesh/BufferGeometry/material identities are retained. Normal arrays
// are replaced explicitly when the vertex count changes (resident THREE does
// not resize an existing normal attribute in computeVertexNormals()).
export function replaceLoonLakeGeometry(THREE,mesh,data,{pondLocal=false}={}){
 const geometry=mesh.geometry,p=data.position.slice(),n=data.normal.slice();
 if(pondLocal)for(let i=0;i<p.length;i+=3){const z=p[i+2]-16;p[i]-=20;p[i+1]=-z;p[i+2]=0;n[i]=0;n[i+1]=0;n[i+2]=1;}
 geometry.setAttribute('position',new THREE.BufferAttribute(p,3));
 geometry.setAttribute('normal',new THREE.BufferAttribute(n,3));geometry.setAttribute('uv',new THREE.BufferAttribute(data.uv.slice(),2));
 if(data.color.length)geometry.setAttribute('color',new THREE.BufferAttribute(data.color.slice(),4));else geometry.deleteAttribute('color');
 geometry.setIndex(new THREE.BufferAttribute(data.index.slice(),1));geometry.setDrawRange(0,data.index.length);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return mesh;
}

export function retargetLoonLakeScatter(scatter,terrainH){
 const shore=loonLakeFootprintPoints();
 const stations=[4,5,6,9,10,11,13,14];
 for(const [kind,rows] of Object.entries(scatter))for(let i=0;i<rows.length;i++){
  const s=stations[Math.floor(i/4)%stations.length],a=shore[s],b=shore[(s+1)%shore.length],t=.14+.22*(i%4);
  const dx=b[0]-a[0],dz=b[1]-a[1],inv=1/Math.hypot(dx,dz),off=kind==='reeds'?.25+.12*(i%3):.55+.17*(i%4);
  const row=rows[i];row.x=a[0]+dx*t+dz*inv*off;row.z=a[1]+dz*t-dx*inv*off;
  row.y=terrainH(row.x,row.z)+(kind==='reeds'?-.06:row.sy*.3);
 }
}

export function reconcileLoonLakeDecor(scene,lake){
 let pads=0,flowers=0,foam=0,retired=0;
 scene.traverse(o=>{
  const g=o.geometry,p=g?.parameters;
  if(o.isMesh&&!o.isInstancedMesh&&g?.type==='RingGeometry'&&p.outerRadius>5&&p.outerRadius<7&&Math.hypot(o.position.x-20,o.position.z-16)<.1){o.visible=false;foam++;return;}
  const pad=g?.type==='CircleGeometry'&&p.thetaLength<6.2&&p.radius<.5,flower=g?.type==='SphereGeometry'&&p.radius<.07;
  if(!o.isInstancedMesh||!pad&&!flower)return;
  const a=o.instanceMatrix.array;let touched=false;
  for(let i=0;i<o.count;i++){
   const k=i*16,x=a[k+12],z=a[k+14];if(Math.hypot(x-20,z-16)>6)continue;
   const water=lake.waterAt(x,z);
   if(!water){for(let j=0;j<12;j++)a[k+j]=0;retired++;}
   else{a[k+13]=lake.level+.014;if(pad)pads++;else flowers++;}
   touched=true;
  }
  if(touched){o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();}
 });
 return {pads,flowers,legacyFoamRetired:foam,dryOriginalPadsRetired:retired};
}

export function seatLoonLakePunt(punt,jetty,lake){
 const yaw=jetty.rotation.y,sn=Math.sin(yaw),cs=Math.cos(yaw),before=punt.position.toArray(),boatYaw=punt.rotation.y,bs=Math.sin(boatYaw),bc=Math.cos(boatYaw);
 for(const forward of[3.5,4,4.5])for(const side of[-1.65,1.65]){
  const x=jetty.position.x+sn*forward+cs*side,z=jetty.position.z+cs*forward-sn*side;let minimum=Infinity;
  for(const a of[-.675,0,.675])for(const b of[-1.75,0,1.75]){const water=lake.waterAt(x+bc*a+bs*b,z-bs*a+bc*b);minimum=Math.min(minimum,water?.depth??0);}
  if(minimum<.36)continue;
  punt.position.set(x,lake.level,z);
  return{before,after:punt.position.toArray(),forward,side,minimumRectangleDepth:minimum,hullAndMotionDepthBudget:.36};
 }
 throw Error('No adequately deep Loon punt mooring beside the original stage');
}
