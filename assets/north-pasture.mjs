// Original open pasture composition in the north-facing riding vista. These
// shapes manage existing grass: they are not a path or a root/terrain mask.
export const NORTH_PASTURE_PROFILE='north-pasture-2';
export const NORTH_PASTURE_BOUNDS=Object.freeze({minX:-50,maxX:40,minZ:-348,maxZ:-237});
const shape=(id,strength,feather,knots)=>Object.freeze({id,strength,feather,knots:Object.freeze(knots.map(Object.freeze))});
export const NORTH_PASTURE_SHAPES=Object.freeze({
 cut:shape('open-swale',1,5,[[0,-242,4],[0,-258,7],[-5,-279,12],[-7,-304,17],[0,-331,21]]),
 left:shape('western-uncut-stand',1,5,[[-10,-249,4],[-19,-270,7],[-28,-292,10],[-34,-315,10],[-27,-333,5]]),
 right:shape('eastern-woodland-shoulder',.62,5,[[11,-255,3],[19,-272,5],[23,-290,7],[19,-310,5]])
});
const ZERO=Object.freeze({cut:0,uncut:0});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
export function northPastureShapeAt(x,z,s){
 let weight=0;
 for(let i=1;i<s.knots.length;i++){
  const a=s.knots[i-1],b=s.knots[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  const width=a[2]+(b[2]-a[2])*t,distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
  weight=Math.max(weight,1-smooth(width,width+s.feather,distance));
 }
 return weight*s.strength;
}
export function northPastureAt(x,z){
 const b=NORTH_PASTURE_BOUNDS;if(x<=b.minX||x>=b.maxX||z<=b.minZ||z>=b.maxZ)return ZERO;
 // Compact start/end blends keep an opening rather than a closed green ring.
 const reach=smooth(-348,-330,z)*(1-smooth(-245,-237,z))*smooth(-50,-44,x)*(1-smooth(34,40,x));
 const cut=northPastureShapeAt(x,z,NORTH_PASTURE_SHAPES.cut)*reach;
 const uncut=Math.max(northPastureShapeAt(x,z,NORTH_PASTURE_SHAPES.left),northPastureShapeAt(x,z,NORTH_PASTURE_SHAPES.right))*reach*(1-cut);
 return cut===0&&uncut===0?ZERO:{cut,uncut};
}
// Apply after the original woodland skirts: all red/green/alpha texels remain
// exact and no new sampler is needed. Only the swale's blue channel is raised.
export function applyNorthPastureGrazingPixels(data,size){
 if(!Number.isInteger(size)||size<1||data.length!==size*size*4)throw Error('Invalid north pasture mask');
 const step=1000/size,b=NORTH_PASTURE_BOUNDS;
 const loX=Math.max(0,Math.floor((b.minX+500)/step)),hiX=Math.min(size-1,Math.ceil((b.maxX+500)/step));
 const loZ=Math.max(0,Math.floor((b.minZ+500)/step)),hiZ=Math.min(size-1,Math.ceil((b.maxZ+500)/step));let changed=0;
 for(let iz=loZ;iz<=hiZ;iz++)for(let ix=loX;ix<=hiX;ix++){
  const x=-500+(ix+.5)*step,z=-500+(iz+.5)*step,k=(iz*size+ix)*4+2,next=Math.max(data[k],Math.round(northPastureAt(x,z).cut*255));
  if(next>data[k]){data[k]=next;changed++;}
 }
 return changed;
}
