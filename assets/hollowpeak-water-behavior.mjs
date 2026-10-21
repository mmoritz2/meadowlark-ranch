// Optional finite Hollowpeak water only. Legacy water remains consumer-owned.
export const HOLLOWPEAK_WATER_BEHAVIOR_PROFILE='hollowpeak-owned-water-1';

/**
 * ownedQueries.waterAt must be bound to the actual emitted finite water faces.
 * It receives the current composed groundH, so authored dry floors participate
 * in supportDepth. Canonical depth alone is not a body/wading support depth.
 * This adapter does not certify terrain admission, actor shape, or transitions.
 */
export function readOwnedHollowpeakWater(world,x,z){
 const queries=world?.fallsLandscape?.ownedQueries;
 if(typeof queries?.waterAt!=='function'||typeof world.groundH!=='function')return null;
 const water=queries.waterAt(x,z,{groundAt:world.groundH});
 if(water?.valid!==true||water.insideSurface!==true||water.coveredBySupport===true||
    !Number.isFinite(water.level)||!Number.isFinite(water.supportDepth)||water.supportDepth<=0)return null;
 return{depth:water.supportDepth,surface:water.level};
}
