import {meadowGrazingAt,westMeadowSwardAt,WEST_MEADOW_SWARD_RECOVERY} from './pastoral-fields.mjs?v=clover-approach-1';

// A final height response for the older static tussocks. The field mask and
// west-meadow recovery are the same ones used by the travelling grass layers.
// height is the actual transformed vertical extent, including each card's lean.
export function grazedTuftScale(x,z,height){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(height))throw new TypeError('Finite tuft position and height required');
  if(height<=0)return 1;
  const grazing=meadowGrazingAt(x,z)*(1-WEST_MEADOW_SWARD_RECOVERY*westMeadowSwardAt(x,z));
  if(grazing<=0)return 1;
  // Gentle world-space variation avoids identical tops without consuming RNG.
  const cap=.30+.04*Math.sin(x*.13+Math.sin(z*.11));
  if(height<=cap)return 1;
  return 1-grazing*(1-cap/height);
}
