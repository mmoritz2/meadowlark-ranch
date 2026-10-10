import {OUTER_ROCK_SOURCE} from './outer-rock-source.mjs?v=outer-rock-clusters-3';
// Original scenic clusters built from resident CC0 full rock masses. Uniform
// transforms preserve the scan proportions; no new ground or grass cap is made.
export const OUTER_ROCK_PROFILE='outer-rock-clusters-3';
export const OUTER_ROCK_SITES=Object.freeze([
 {id:'northwest-slab',part:0,x:-549,z:-639,width:64,yaw:1.03,sink:5.5},
 {id:'northwest-buttress',part:3,x:-507,z:-621,width:30,yaw:-.42,sink:4},
 {id:'northwest-toe',part:4,x:-557,z:-607,width:27,yaw:.28,sink:1.7},
 {id:'north-main',part:5,x:-138,z:-618,width:54,yaw:-.84,sink:4},
 {id:'north-shoulder',part:2,x:-98,z:-597,width:30,yaw:.65,sink:2.1},
 {id:'north-toe',part:1,x:-155,z:-592,width:28,yaw:1.51,sink:1.4},
 {id:'clover-main',part:1,x:397,z:-645,width:61,yaw:1.19,sink:4.8},
 {id:'clover-buttress',part:3,x:440,z:-620,width:29,yaw:.23,sink:3.7},
 {id:'clover-toe',part:2,x:382,z:-619,width:24,yaw:-.59,sink:1.5},
].map(Object.freeze));
export function createOuterRockGroundSampler(positions,index,colors=null){
 const bins=new Map(),cell=48;
 for(let k=0;k<index.length;k+=3){
  const a=index[k]*3,b=index[k+1]*3,c=index[k+2]*3;
  const minX=Math.floor(Math.min(positions[a],positions[b],positions[c])/cell),maxX=Math.floor(Math.max(positions[a],positions[b],positions[c])/cell);
  const minZ=Math.floor(Math.min(positions[a+2],positions[b+2],positions[c+2])/cell),maxZ=Math.floor(Math.max(positions[a+2],positions[b+2],positions[c+2])/cell);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(k);}
 }
 return(x,z)=>{
  for(const k of bins.get(Math.floor(x/cell)+':'+Math.floor(z/cell))||[]){
   const a=index[k]*3,b=index[k+1]*3,c=index[k+2]*3,ax=positions[a],az=positions[a+2],bx=positions[b],bz=positions[b+2],cx=positions[c],cz=positions[c+2];
   const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-12)continue;
   const wa=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,wb=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,wc=1-wa-wb;
   if(wa>=-1e-7&&wb>=-1e-7&&wc>=-1e-7)return {height:wa*positions[a+1]+wb*positions[b+1]+wc*positions[c+1],color:colors?[0,1,2].map(i=>wa*colors[a+i]+wb*colors[b+i]+wc*colors[c+i]):null};
  }
  return null;
 };
}

export function createOuterRockData({positions,index}){
 const sample=createOuterRockGroundSampler(positions,index),records=[];
 for(const site of OUTER_ROCK_SITES){
  const source=OUTER_ROCK_SOURCE.parts[site.part],scale=site.width/Math.max(source.max[0]-source.min[0],source.max[2]-source.min[2]);
  const cx=(source.min[0]+source.max[0])/2,cz=(source.min[2]+source.max[2])/2,c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  const xz=(x,z)=>[site.x+scale*(c*(x-cx)+s*(z-cz)),site.z+scale*(-s*(x-cx)+c*(z-cz))];
  let ty=Infinity,minFootGap=Infinity,maxFootGap=-Infinity;
  for(const foot of source.foot){const [x,z]=xz(foot[0],foot[2]),ground=sample(x,z);if(!ground)throw Error('Scenic rock foot misses outer terrain: '+site.id);ty=Math.min(ty,ground.height-scale*foot[1]);}
  ty-=site.sink;
  for(const foot of source.foot){const [x,z]=xz(foot[0],foot[2]),gap=scale*foot[1]+ty-sample(x,z).height;minFootGap=Math.min(minFootGap,gap);maxFootGap=Math.max(maxFootGap,gap);}
  const bounds={min:[Infinity,source.min[1]*scale+ty,Infinity],max:[-Infinity,source.max[1]*scale+ty,-Infinity]};
  for(const x of [source.min[0],source.max[0]])for(const z of [source.min[2],source.max[2]]){const p=xz(x,z);bounds.min[0]=Math.min(bounds.min[0],p[0]);bounds.max[0]=Math.max(bounds.max[0],p[0]);bounds.min[2]=Math.min(bounds.min[2],p[1]);bounds.max[2]=Math.max(bounds.max[2],p[1]);}
  // Source-centred rotation in a column-major Three transform; Y is the exact
  // minimum ground-minus-low-foot offset, never the floating downhill maximum.
  const matrix=[scale*c,0,-scale*s,0,0,scale,0,0,scale*s,0,scale*c,0,site.x-scale*(c*cx+s*cz),ty,site.z-scale*(-s*cx+c*cz),1];
  records.push({...site,scale,matrix,bounds,minFootGap,maxFootGap,sourceCenter:[cx,cz],sourceHalf:[(source.max[0]-source.min[0])*scale/2,(source.max[2]-source.min[2])*scale/2],vertices:source.vertices,triangles:source.triangles,groundAtCenter:sample(site.x,site.z).height});
 }
 const intersectsRoot=site=>records.some(r=>{const dx=site.x-r.x,dz=site.z-r.z,c=Math.cos(r.yaw),s=Math.sin(r.yaw),x=c*dx-s*dz,z=s*dx+c*dz;return Math.abs(x)<=r.sourceHalf[0]+1.2&&Math.abs(z)<=r.sourceHalf[1]+1.2;});
 return{records,intersectsRoot,stats:{profile:OUTER_ROCK_PROFILE,source:OUTER_ROCK_SOURCE.id,sourceSha256:OUTER_ROCK_SOURCE.sha256,clusters:3,masses:records.length,vertices:records.reduce((n,r)=>n+r.vertices,0),triangles:records.reduce((n,r)=>n+r.triangles,0),draws:1,newTextures:0,groundUnchanged:true,records}};
}
export function retainRockClearWoodland(sites,data){const kept=[],excluded=[];for(const site of sites)(data.intersectsRoot(site)?excluded:kept).push(site);return{kept,excluded};}
export function installOuterRockClusters(G,parts,mergeGeometries){
 const outer=G.world.outerLandscape,data=outer?.rockClusterData;if(!data||outer.rockClusters.ready)return;
 if(!parts||parts.length!==OUTER_ROCK_SOURCE.parts.length)throw Error('Scenic rocks require resident moss scan parts');
 const material=parts[0].mat;
 for(let i=0;i<parts.length;i++){
  const p=parts[i],source=OUTER_ROCK_SOURCE.parts[i];
  if(p.mat!==material||p.geo.attributes.position.count!==source.vertices||p.geo.index.count!==source.triangles*3)throw Error('Scenic rock source identity mismatch');
  for(let axis=0;axis<3;axis++){const name=['x','y','z'][axis];if(Math.abs(p.bounds.min[name]-source.min[axis])>1e-6||Math.abs(p.bounds.max[name]-source.max[axis])>1e-6)throw Error('Scenic rock source framing mismatch');}
 }
 const T=G.THREE,transforms=[],geometries=[];
 for(const record of data.records){const geometry=parts[record.part].geo.clone(),matrix=new T.Matrix4().fromArray(record.matrix);geometry.applyMatrix4(matrix);geometries.push(geometry);transforms.push(record.matrix);}
 const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)throw Error('Scenic rock merge failed');geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,material);mesh.name='Northern scanned rock clusters';mesh.castShadow=false;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.userData.outerRockClusters={profile:OUTER_ROCK_PROFILE,source:OUTER_ROCK_SOURCE.id};G.scene.add(mesh);
 Object.assign(outer.rockClusters,{ready:true,mesh,sourceMaterialName:material.name,sourceMaterialShared:true,source:OUTER_ROCK_SOURCE.id});
}
