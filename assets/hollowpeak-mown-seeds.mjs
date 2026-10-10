// A changed cliff can move an event course. Its wide vegetation strip may hide
// a seed tree beyond the narrower trunk-clearing strip. Retire that tree's own
// old circle only where the revised Hollowpeak terrain caused local change.
const SEED_HEIGHT=Object.freeze({oak:6.2,birch:6.6,blossom:6.2,pine:7.4,snowpine:7.2});
export function retireHiddenHollowpeakSeed(world,point,species,hidden,bounds){
 if(!hidden||!point||!bounds||!Object.hasOwn(SEED_HEIGHT,species))return null;
 const {x,z,s}=point,reference=world.hollowpeakPlacement;
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(s)||s<=0
   ||x<=bounds.x0||x>=bounds.x1||z<=bounds.z0||z>=bounds.z1
   ||typeof reference?.heightAt!=='function'||typeof world.terrainH!=='function'
   ||!Array.isArray(world.forestPoints)||!Array.isArray(world.colliders))return null;
 // The shared original record, not proximity, establishes seed ownership.
 const forestIndex=world.forestPoints.indexOf(point);if(forestIndex<0)return null;
 const originalHeight=reference.heightAt(x,z),height=world.terrainH(x,z);
 if(!Number.isFinite(originalHeight)||!Number.isFinite(height)||Math.abs(height-originalHeight)<=1e-5)return null;
 const expectedHeight=s*SEED_HEIGHT[species];let colliderIndex=-1;
 for(let i=0;i<world.colliders.length;i++){
  const c=world.colliders[i];
  if(!c||c.x!==x||c.z!==z||c.r!==.8||c.height!==expectedHeight
    ||Object.keys(c).some(key=>!['x','z','r','height'].includes(key)))continue;
  if(colliderIndex>=0)return null; // Ambiguous ownership must not remove either.
  colliderIndex=i;
 }
 if(colliderIndex<0)return null;
 const collider=world.colliders[colliderIndex];
 world.colliders.splice(colliderIndex,1);world.forestPoints.splice(forestIndex,1);
 return {x,z,species,radius:collider.r,colliderHeight:collider.height,originalHeight,height,
  reason:'hidden seed on changed Hollowpeak terrain'};
}
