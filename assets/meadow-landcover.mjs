import {meadowGrazingAt} from './pastoral-fields.mjs?v=clover-approach-1';

// Canvas rows increase with world Z. The terrain sampler already supplies the
// corresponding texture Y flip; flipping here as well would mirror the fields.
const WORLD_METRES=1000, WORLD_MIN=-500;
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const smooth=value=>{const t=clamp01(value);return t*t*(3-2*t);};
function checkSize(size){
  if(!Number.isInteger(size)||size<1)throw new RangeError('Landcover size must be a positive integer');
}

// Cache the returned pixels once per terrain surface. Red/green begin empty;
// subsequent tree/path redraws copy these pixels before adding their own fields.
export function createMeadowGrazingPixels(size=1024){
  checkSize(size);
  const data=new Uint8ClampedArray(size*size*4),step=WORLD_METRES/size;
  for(let row=0;row<size;row++){
    const z=WORLD_MIN+(row+.5)*step;
    for(let column=0;column<size;column++){
      const x=WORLD_MIN+(column+.5)*step,index=(row*size+column)*4;
      data[index+2]=Math.round(clamp01(meadowGrazingAt(x,z))*255);
      data[index+3]=255;
    }
  }
  return data;
}

// Add a soft skirt after the old red trunk/core mask has been drawn. Per-channel
// max retains every old red value, including cores inside maintained grounds.
// This touches no positions, geometry, collisions, or non-red mask channels.
export function extendWoodlandMask(data,size,trees,protectedAt=()=>0){
  checkSize(size);
  if(!ArrayBuffer.isView(data)||data.length!==size*size*4)throw new RangeError('Landcover pixels must match size');
  const step=WORLD_METRES/size,stats={trees:0,texelsRaised:0};
  for(const tree of trees||[]){
    if(!Number.isFinite(tree.x)||!Number.isFinite(tree.z))continue;
    const scale=tree.s||1,core=2+scale*1.7,radius=Math.min(core*1.30,6.5);
    if(!Number.isFinite(radius)||core<=0||radius<=core)continue;
    const minX=Math.max(0,Math.ceil((tree.x-radius-WORLD_MIN)/step-.5));
    const maxX=Math.min(size-1,Math.floor((tree.x+radius-WORLD_MIN)/step-.5));
    const minZ=Math.max(0,Math.ceil((tree.z-radius-WORLD_MIN)/step-.5));
    const maxZ=Math.min(size-1,Math.floor((tree.z+radius-WORLD_MIN)/step-.5));
    if(minX>maxX||minZ>maxZ)continue;
    stats.trees++;
    for(let row=minZ;row<=maxZ;row++){
      const z=WORLD_MIN+(row+.5)*step;
      for(let column=minX;column<=maxX;column++){
        const x=WORLD_MIN+(column+.5)*step,distance=Math.hypot(x-tree.x,z-tree.z);
        if(distance>=radius)continue;
        const index=(row*size+column)*4;
        const grazing=data[index+2]/255,protectedWeight=clamp01(protectedAt(x,z));
        const falloff=1-smooth((distance-core*.35)/(radius-core*.35));
        const red=Math.round(255*.88*falloff*(1-.85*grazing)*(1-protectedWeight));
        if(red>data[index]){data[index]=red;stats.texelsRaised++;}
      }
    }
  }
  return stats;
}
