import {fallsRelief,fallsContainsWater} from './falls-landscape.js?v=hollowpeak-cascades-1-connected-landforms-1';
import {retireHiddenHollowpeakSeed} from './hollowpeak-mown-seeds.mjs?v=hollowpeak-mow-1';

// The two foremost falls crests lie at z=-266/-269. Their bare front faces
// need current-terrain planting checks after sculpting; the rear catchment
// and the wider alpine woodland retain their authored planting decisions.
const FRONT=Object.freeze({x0:-202,x1:-100,z0:-270,z1:-224});
export function retireSteepFallsSeed(world,point,species){
 if(!point||!['pine','snowpine'].includes(species)||typeof world?.terrainH!=='function')return null;
 const {x,z}=point;
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<=FRONT.x0||x>=FRONT.x1||z<=FRONT.z0||z>=FRONT.z1)return null;
 if(fallsRelief(x,z)<=3||fallsContainsWater(x,z,2))return null;
 const h=world.terrainH;
 const grade=Math.hypot(h(x+1,z)-h(x-1,z),h(x,z+1)-h(x,z-1))*.5;
 if(!Number.isFinite(grade)||grade<=1.8+1e-6)return null;
 // The existing retirement policy proves the shared original forest record
 // and a unique exact untagged seed collider before mutating either owner.
 const retired=retireHiddenHollowpeakSeed(world,point,species,true,FRONT);
 return retired?{...retired,grade,reason:'seed on the remodeled bare steep falls front'}:null;
}
