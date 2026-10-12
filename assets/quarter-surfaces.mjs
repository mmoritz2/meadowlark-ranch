import {applyTimberGrain} from './timber-cladding.mjs?v=timber-cladding-1';
// Original regional surface dressing. The existing colour-cache materials keep
// their identity and allocation order; all photographs are resident CC0 maps
// already used by the ranch. Static primitives receive metre-scaled UVs in the
// clone that the existing bake was already going to allocate.
export const QUARTER_SURFACE_PROFILE='quarter-worked-materials-1';
const TIMBER=new Set(['#4e3a26','#7a5a3a','#3f3527','#66543a','#5b4a30','#5a4a34','#6b5334','#5a4634','#7d6245','#8a7a5a','#9c8a66','#6f5f44','#8e7a52']);
const PALE=new Set(['#a8834e','#c6ab7c','#9a8462','#8a5c3a','#c9bda0']);
const STONE=new Set(['#7d7468','#7a7871','#968d80','#645c52','#847a6e','#564f46','#9e9488','#6e655b','#a89d8e']);
const ROOF=new Set(['#8e4a2a','#5c4b33','#8a7a5c','#9a8a68']);
const METAL=new Set(['#3a3d40','#33383c','#454a4c','#8e9296']);
export function quarterSurfaceRole(color,options){
 if(options?.transparent||options?.opacity<1)return null;
 if(TIMBER.has(color)||PALE.has(color))return 'timber';
 if(STONE.has(color))return 'stone';
 if(ROOF.has(color))return 'roof';
 if(METAL.has(color))return 'metal';
 return null;
}
export function applyQuarterSurface(material,color,options,materials,architecture,THREE){
 const role=quarterSurfaceRole(color,options);if(!role)return false;
 if(role==='metal'){
  material.metalness=.78;material.roughness=color==='#8e9296'?.48:.62;
  material.userData.quarterSurface={profile:QUARTER_SURFACE_PROFILE,role,metres:1};return true;
 }
 const source=role==='timber'?(PALE.has(color)?materials.oak:materials.aged):role==='stone'?materials.stone:architecture.roofMaterial;
 if(!source?.map||!source.normalMap||!source.roughnessMap)return false;
 material.map=source.map;material.normalMap=source.normalMap;material.roughnessMap=source.roughnessMap;
 material.normalScale.set(role==='stone'?.38:role==='roof'?.45:.40,role==='stone'?.38:role==='roof'?.45:.40);
 material.roughness=role==='stone'?.98:1;material.envMapIntensity=.55;
 material.color.multiplyScalar(role==='stone'?1.8:PALE.has(color)?1.6:1.9);
 material.name='Quarter | '+role+' '+color;
 material.userData.quarterSurface={profile:QUARTER_SURFACE_PROFILE,role,metres:role==='stone'?1.4:1.8,source:source.name};
 if(role==='timber'&&!PALE.has(color))applyTimberGrain(material,THREE);
 material.needsUpdate=true;return true;
}
export function setQuarterPrimitiveUV(geometry,scale,position,surface){
 if(!surface||surface.role==='metal')return false;
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
 if(!p||!n||!uv||p.count!==uv.count)return false;
 geometry.computeBoundingBox();const b=geometry.boundingBox;
 const dims=[(b.max.x-b.min.x)*Math.abs(scale.x),(b.max.y-b.min.y)*Math.abs(scale.y),(b.max.z-b.min.z)*Math.abs(scale.z)];
 const along=dims[1]>dims[0]&&dims[1]>dims[2]?1:dims[2]>dims[0]?2:0;
 const period=surface.metres,wood=surface.role==='timber',origin=[position.x,position.y,position.z],s=[scale.x,scale.y,scale.z];
 const phase=Math.floor(position.x*7+position.y*11+position.z*13);
 for(let i=0;i<p.count;i++){
  const xyz=[p.getX(i)*s[0],p.getY(i)*s[1],p.getZ(i)*s[2]],normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
  const face=normal[1]>normal[0]&&normal[1]>normal[2]?1:normal[0]>normal[2]?0:2;
  if(wood&&face!==along){
   const other=[0,1,2].filter(a=>a!==along),across=normal[other[0]]>normal[other[1]]?other[1]:other[0];
   // Raw coated-pine photos retain plank detail on pale cladding. Dark
   // structural timber uses the resident board-interior shader coordinates.
   const pitch=surface.source?.includes('oiled oak')?period:dims[across]>.32?.25:Math.max(.025,dims[across]*1.06);
   uv.setXY(i,(xyz[along]+origin[along])/period,phase+.5+(xyz[across]+origin[across])/pitch);
  }else{
   const axes=face===1?[0,2]:face===0?[2,1]:[0,1];
   uv.setXY(i,(xyz[axes[0]]+origin[axes[0]])/period,(xyz[axes[1]]+origin[axes[1]])/period);
  }
 }
 uv.needsUpdate=true;return true;
}
