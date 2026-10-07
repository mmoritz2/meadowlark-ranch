// Approximate sky occlusion from the actual leaf area, once per loaded scan.
// A small voxel field is shared by the detailed mesh and its offline view bake;
// it preserves authored leaves and adds no per-frame ray tracing or geometry.
export function prepareCanopyShade(THREE,root){
  root.updateMatrixWorld(true);
  const leaves=[],bounds=new THREE.Box3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  root.traverse(o=>{if(o.isMesh&&/leaves/.test(o.material?.name||'')){
    const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)bounds.expandByPoint(a.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));
    leaves.push(o);
  }});
  if(!leaves.length)return null;
  // Summer pasture foliage has a greener pigment than the dry source scans.
  // Apply once to shared materials; the view baker uses this same preparation.
  const summer=new THREE.Color().setRGB(.82,1,.66);
  for(const material of new Set(leaves.map(o=>o.material)))material.color.multiply(summer);
  const size=bounds.getSize(new THREE.Vector3()),cell=Math.max(size.x,size.y,size.z)/44;
  const origin=bounds.min.clone().addScalar(-cell*2),dims=size.toArray().map(v=>Math.ceil(v/cell)+5),[nx,ny,nz]=dims;
  const density=new Float32Array(nx*ny*nz),shade=new Float32Array(density.length).fill(1);
  const index=(x,y,z)=>x+nx*(y+ny*z),coord=p=>[(p.x-origin.x)/cell,(p.y-origin.y)/cell,(p.z-origin.z)/cell];
  const cross=new THREE.Vector3(),edge=new THREE.Vector3();let area=0,triangles=0;
  for(const o of leaves){const g=o.geometry,p=g.attributes.position,idx=g.index,count=idx?idx.count:p.count;
    for(let i=0;i<count;i+=3){
      a.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
      const weight=cross.subVectors(b,a).cross(edge.subVectors(c,a)).length()*.5;area+=weight;triangles++;
      a.add(b).add(c).multiplyScalar(1/3);const v=coord(a).map(n=>n-.5),base=v.map(Math.floor),f=v.map((n,i)=>n-base[i]);
      // Leaf cards include transparent margins. Their average coverage is about
      // half a rectangle; distribute area continuously across neighbouring cells.
      for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)density[index(base[0]+dx,base[1]+dy,base[2]+dz)]+=weight*.52/(cell*cell)*(dx?f[0]:1-f[0])*(dy?f[1]:1-f[1])*(dz?f[2]:1-f[2]);
    }
  }
  const directions=Array.from({length:12},(_,i)=>{const y=.18+.78*(i+.5)/12,r=Math.sqrt(1-y*y),angle=i*2.399963;return [Math.cos(angle)*r,y,Math.sin(angle)*r];});
  let occupied=0,min=1,max=0;
  for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
    const id=index(x,y,z);if(density[id]<1e-6)continue;occupied++;let visibility=0;
    for(const [dx,dy,dz]of directions){let optical=0;
      for(let t=1.5;t<60;t+=1){const ix=Math.floor(x+.5+dx*t),iy=Math.floor(y+.5+dy*t),iz=Math.floor(z+.5+dz*t);if(ix<0||ix>=nx||iy<0||iy>=ny||iz<0||iz>=nz)break;optical+=density[index(ix,iy,iz)];}
      visibility+=Math.exp(-optical*.85);
    }
    shade[id]=.36+.64*visibility/directions.length;min=Math.min(min,shade[id]);max=Math.max(max,shade[id]);
  }
  for(const o of leaves){const p=o.geometry.attributes.position,values=new Float32Array(p.count);
    for(let i=0;i<p.count;i++){
      const v=coord(a.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld)).map(n=>n-.5),base=v.map(Math.floor),f=v.map((n,j)=>n-base[j]);let value=0;
      for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)value+=shade[index(base[0]+dx,base[1]+dy,base[2]+dz)]*(dx?f[0]:1-f[0])*(dy?f[1]:1-f[1])*(dz?f[2]:1-f[2]);
      values[i]=value;
    }
    o.geometry.setAttribute('canopyShade',new THREE.BufferAttribute(values,1));
  }
  return {triangles,area,cell,occupied,min,max};
}

export function patchCanopyShade(shader){
  shader.vertexShader='attribute float canopyShade; varying float vCanopyShade;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vCanopyShade=canopyShade;');
  shader.fragmentShader='varying float vCanopyShade;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n diffuseColor.rgb*=vCanopyShade;');
}
