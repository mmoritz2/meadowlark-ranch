import {coyoteCoverDryWeight} from './biome-weights.mjs?v=dry-foothills-1';
// Grass retreats gradually through the same broad transition zones as the
// terrain materials. Hard circular exclusions left green pasture completely bald.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function meadowCoverWeight(x,z){
 const canyon=1-coyoteCoverDryWeight(x,z);
 const winter=smooth(92,158,Math.hypot(x+160,z+210));
 return Math.min(canyon,winter);
}
function coverRandom(x,z){
 let h=Math.imul(Math.floor(x*47),374761393)^Math.imul(Math.floor(z*47),668265263);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967296;
}

export function hasMeadowCover(x,z){return coverRandom(x,z)<meadowCoverWeight(x,z)}
// Seed acceptance consumes the same random draws as the original world. The
// resulting seed blades still use the new visible cover mask and dry palette.
export function hasSeedMeadowCover(x,z){return coverRandom(x,z)<Math.min(smooth(100,170,Math.hypot(x+220,z-130)),smooth(92,158,Math.hypot(x+160,z+210)))}
