import {setTimberBoxUV} from './timber-cladding.mjs?v=timber-cladding-1';
export const RANCH_TIMBER_JOINERY_PROFILE='ranch-board-joinery-1';

// A real limed coating mixes opaque cream pigment over the resident timber
// photograph, retaining subtle worn grain and all original normal/roughness
// channels. Multiplying a brown photograph by white cannot produce this finish.
export function installLimedTimberFinish(material,{amount=.90}={}){
 if(!Number.isFinite(amount)||amount<0||amount>1)throw Error('Bounded limed timber coating required');
 if(material.userData.limedTimberFinish?.amount===amount)return material;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),baseRGB=material.color.toArray().map(v=>Math.fround(Math.max(v,.01)));
 if(!baseRGB.every(Number.isFinite))throw Error('Finite timber pigment reference required');
 material.onBeforeCompile=function(shader,renderer){
  previous?.call(this,shader,renderer);
  if(!shader.fragmentShader.includes('#include <color_fragment>'))throw Error('Timber coating shader seam changed');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ranchCoatWear=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   vec3 ranchCoatTint=clamp(diffuse/vec3(${baseRGB.map(v=>v.toPrecision(9)).join(',')}),0.0,4.0);
   vec3 ranchCreamPigment=clamp(vec3(.78,.74,.65)*(.90+.10*sqrt(clamp(ranchCoatWear*2.0,0.0,1.0)))*ranchCoatTint,0.0,1.0);
   diffuseColor.rgb=mix(diffuseColor.rgb,ranchCreamPigment,${amount.toFixed(5)});
  `);
 };
 material.customProgramCacheKey=()=>key()+'|limed-timber-2:'+amount+':'+baseRGB.join(',');
 material.userData.limedTimberFinish={profile:'limed-timber-2',amount,pigment:[.78,.74,.65],baseRGB};material.needsUpdate=true;return material;
}

// Mutate only a geometry whose original solid proxy was already recorded.
// Six planar faces, twelve edge bevels and eight corners model complete boards
// inside the original architectural panel bounds. No new geometry or UUID.
export function dressTimberBox(T,g,{width,height,depth,radius=.006,x=0,y=0,z=0,siding=false,lengthMetres=1.8}={}){
 if(![width,height,depth,radius,x,y,z,lengthMetres].every(Number.isFinite)||Math.min(width,height,depth,lengthMetres)<=0)throw Error('Finite authored timber box required');
 const P=[],N=[],U=[],I=[],dims=[width,height,depth],half=dims.map(v=>v/2),r=Math.min(radius,...dims.map(v=>v*.19));
 const pitch=Math.max(.30,width/47),edges=[-half[0]];if(siding&&width>.25&&height>.35&&depth<.24){for(let u=Math.ceil((x-half[0])/pitch)*pitch-x;u<half[0]-.007;u+=pitch)if(u>-half[0]+.007)edges.push(u);}edges.push(half[0]);const boards=edges.length-1;
 if(boards>48)throw Error('Timber panel exceeded bounded board budget');
 function face(points){
  let[a,b,c]=points,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  const centre=a.map((v,k)=>points.reduce((s,p)=>s+p[k],0)/points.length);
  // Each component is convex around its own local origin. Board translation
  // is applied after normals, so it cannot influence the outward orientation.
  if(nx*centre[0]+ny*centre[1]+nz*centre[2]<0){points=points.slice().reverse();[a,b,c]=points;ux=b[0]-a[0];uy=b[1]-a[1];uz=b[2]-a[2];vx=c[0]-a[0];vy=c[1]-a[1];vz=c[2]-a[2];nx=uy*vz-uz*vy;ny=uz*vx-ux*vz;nz=ux*vy-uy*vx;}
  const length=Math.hypot(nx,ny,nz);if(length<1e-12)throw Error('Degenerate timber face');nx/=length;ny/=length;nz/=length;
  const offset=P.length/3;for(const p of points){P.push(...p);N.push(nx,ny,nz);U.push(0,0);}for(let i=1;i<points.length-1;i++)I.push(offset,offset+i,offset+i+1);
 }
 function box(h,bevel){
  const inner=h.map(v=>v-bevel),start=P.length;
  for(let axis=0;axis<3;axis++)for(const sign of[-1,1]){
   const other=[0,1,2].filter(k=>k!==axis),points=[];
   for(const[a,b]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const p=[0,0,0];p[axis]=sign*h[axis];p[other[0]]=a*inner[other[0]];p[other[1]]=b*inner[other[1]];points.push(p);}face(points);
  }
  for(let axis=0;axis<3;axis++){const[b,c]=[0,1,2].filter(k=>k!==axis);for(const sb of[-1,1])for(const sc of[-1,1]){
   const points=[];for(const[t,edge]of[[-1,0],[1,0],[1,1],[-1,1]]){const p=[0,0,0];p[axis]=t*inner[axis];p[b]=sb*(edge?h[b]:inner[b]);p[c]=sc*(edge?inner[c]:h[c]);points.push(p);}face(points);
  }}
  for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]){
   const signs=[sx,sy,sz];face([0,1,2].map(axis=>h.map((v,k)=>signs[k]*(k===axis?v:inner[k]))));
  }
  return start;
 }
 for(let board=0;board<boards;board++){
  const gap=Math.min(.0022,(edges[board+1]-edges[board])*.15),left=edges[board]+(board?gap:0),right=edges[board+1]-(board<boards-1?gap:0),cx=(left+right)/2;
  const top=siding&&board%5===2?half[1]-.002:half[1],bottom=-half[1],cy=(top+bottom)/2,start=box([(right-left)/2,(top-bottom)/2,half[2]],Math.min(r,(right-left)*.19));
  for(let i=start;i<P.length;i+=3){P[i]+=cx;P[i+1]+=cy;}
 }
 g.setIndex(I);g.clearGroups();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));
 setTimberBoxUV(g,{width,height,depth,x,y,z,siding,lengthMetres});g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.ranchTimberJoinery={profile:RANCH_TIMBER_JOINERY_PROFILE,boards,triangles:I.length/3,bytes:(P.length+N.length+U.length)*4+g.index.array.byteLength,authoredBounds:[width,height,depth]};return g;
}
