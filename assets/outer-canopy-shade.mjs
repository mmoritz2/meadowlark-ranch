// Ambient shelter beneath the actual distant tree crowns. This is ground
// occlusion, not a painted directional sun shadow or another billboard layer.
export const OUTER_CANOPY_SHADE_CACHE='outer-canopy-shelter-1';
export const OUTER_CANOPY_SHADE_SIZE=1024;
export const OUTER_CANOPY_SHADE_EXTENT=1024;
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};

export function createOuterCanopyShadePixels(footprints,{size=OUTER_CANOPY_SHADE_SIZE,extent=OUTER_CANOPY_SHADE_EXTENT}={}){
 if(!Number.isInteger(size)||size<8||!Number.isFinite(extent)||extent<=0)throw Error('Invalid outer canopy mask bounds');
 const data=new Uint8Array(size*size),step=2*extent/size;
 let covered=0,maximum=0;
 for(const tree of footprints){
  const {x,z,radius}=tree;
  if(![x,z,radius].every(Number.isFinite)||radius<=0)throw Error('Invalid outer canopy footprint');
  const radiusWithEdge=radius+step,loX=Math.max(0,Math.floor((x-radiusWithEdge+extent)/step)),hiX=Math.min(size-1,Math.floor((x+radiusWithEdge+extent)/step));
  const loZ=Math.max(0,Math.floor((z-radiusWithEdge+extent)/step)),hiZ=Math.min(size-1,Math.floor((z+radiusWithEdge+extent)/step));
  for(let iz=loZ;iz<=hiZ;iz++)for(let ix=loX;ix<=hiX;ix++){
   const px=-extent+(ix+.5)*step,pz=-extent+(iz+.5)*step;
   // Only distant ground is eligible, including at the soft edge of a crown.
   const seam=Math.hypot(Math.max(0,Math.abs(px)-500),Math.max(0,Math.abs(pz)-500));
   const reach=smooth((seam-26)/32);if(!reach)continue;
   const q=Math.hypot(px-x,pz-z)/radiusWithEdge;
   if(q>=1)continue;
   const value=.72*(1-smooth((q-.20)/.80))*reach;
   // Bounded union lets overlapping crowns shelter a stand without stacking
   // opaque dark circles. The one-channel texture stores only coverage.
   const i=iz*size+ix,old=data[i],next=Math.round(255*(1-(1-old/255)*(1-value)));
   data[i]=next;
  }
 }
 for(const value of data){if(value)covered++;maximum=Math.max(maximum,value);}
 return {data,size,extent,step,covered,maximum,footprints:footprints.length};
}

export function patchOuterCanopyShade(shader,texture,extent=OUTER_CANOPY_SHADE_EXTENT){
 const anchor='#include <aomap_fragment>';
 if(shader.fragmentShader.split(anchor).length!==2)return false;
 shader.uniforms.outerCanopyShelter={value:texture};
 shader.fragmentShader='uniform sampler2D outerCanopyShelter;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace(anchor,`${anchor}
   // OUTER_CANOPY_SHELTER_V1: occlude ambient light only. Direct sunlight and
   // the existing real-time shadows retain their original rendering.
   vec2 outerShelterUV=(terrainPosition.xz+vec2(${extent.toFixed(1)}))/${(extent*2).toFixed(1)};
   float outerShelter=texture2D(outerCanopyShelter,outerShelterUV).r
     *smoothstep(26.0,58.0,length(max(abs(terrainPosition.xz)-vec2(500.0),vec2(0.0))));
   reflectedLight.indirectDiffuse*=1.0-.62*outerShelter;
   #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=1.0-.34*outerShelter;
   #endif
 `);
 return true;
}

export function installOuterCanopyShade(G){
 const outer=G.world.outerLandscape;
 if(!outer||outer.canopyShelter)return;
 const footprints=outer.canopyFootprints||[];
 if(!footprints.length)return;
 const pixels=createOuterCanopyShadePixels(footprints),T=G.THREE;
 const texture=new T.DataTexture(pixels.data,pixels.size,pixels.size,T.RedFormat,T.UnsignedByteType);
 texture.name='Outer woodland ambient shelter';texture.colorSpace=T.NoColorSpace;
 texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;
 const material=outer.mesh.material,compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);if(!patchOuterCanopyShade(shader,texture,pixels.extent))throw Error('Outer canopy shelter shader anchor missing');};
 material.customProgramCacheKey=function(){return key.call(this)+'-'+OUTER_CANOPY_SHADE_CACHE;};
 material.needsUpdate=true;
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;texture.dispose();};
 material.addEventListener('dispose',dispose);
 outer.canopyShelter={texture,footprints,profile:OUTER_CANOPY_SHADE_CACHE,size:pixels.size,extent:pixels.extent,coveredTexels:pixels.covered,maximum:pixels.maximum,bytes:pixels.data.byteLength,newSamplers:1,newDraws:0,dispose};
}
