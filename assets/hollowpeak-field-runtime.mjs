// The canonical field is installed before derived world construction. Existing
// source layout decisions finish before this cohort replaces support and solids.
import {loadHollowpeakCohortPayload} from './hollowpeak-cohort-payload.mjs';
import {applyHollowpeakCanonicalField,decodeHollowpeakCanonicalField} from './hollowpeak-canonical-field.mjs';
import {createHollowpeakConstructionReference} from './hollowpeak-construction-reference.mjs';
import {createOwnedHollowpeakQueries} from './owned-hollowpeak-queries.mjs';
export async function prepareHollowpeakRuntime({heights,outsideHeightAt,fetchImpl,signal}={}){
 const payload=await loadHollowpeakCohortPayload({fetchImpl,signal});
 if(payload.authenticated!==true)throw Error('Authenticated Hollowpeak package required before terrain installation');
 // Validate both packed fields and every pure owner before touching the only
 // physical terrain. The reference reads outside nodes from that same field.
 decodeHollowpeakCanonicalField(payload.fieldBytes);
 const historicalPatch=decodeHollowpeakCanonicalField(payload.constructionBytes);
 const construction=createHollowpeakConstructionReference({heights,historicalPatch,outsideHeightAt});
 const queries=createOwnedHollowpeakQueries({heights,waterTriangles:payload.waterTriangles,shoreGeometry:payload.shoreGeometry,finalFieldSHA256:payload.finalFieldSHA256});
 const installation=applyHollowpeakCanonicalField(heights,payload.fieldBytes);
 return {profile:'hollowpeak-connected-runtime-1',payload,queries,construction,installation,heights,status:'field-ready',hydrology:null,collision:null};
}
