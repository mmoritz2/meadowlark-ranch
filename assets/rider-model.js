import {CANINO_HAIR_STYLES,caninoHairId} from './rider-canino-hair101.mjs?v=canino-style101-20261022';
import {withCaninoCharacter} from './rider-canino100.mjs?v=canino-style101-20261022';
import {installHair99} from './rider-hair99.mjs?v=character-foundation99-20261021';
import {installLong98} from './rider-long98.js?v=character-redesign98-20261020';
import {createRiderLibrary as create59} from './rider-model-braids.js?v=character-foundation99-20261021';
export * from './rider-model-braids.js?v=character-foundation99-20261021';
import {installSideflow7} from './rider-long-framing.js?v=hair-flow76-20261012';
import {finishRiderComplexion} from './rider-complexion.mjs?v=character-foundation99-20261021';
import {riderMaterialLifecycle15} from './rider-material-lifecycle.js?v=character-polish-20261009';
import {installSweptCrown} from './rider-swept-crown.mjs?v=continuous-crown-20261020';
import {refineRiderNeckNormals} from './rider-neck-normals.mjs?v=neck-fairing-20261020';
function createLegacyRiderLibrary(options){
 const lifecycle=options.riderMaterialLifecycle||riderMaterialLifecycle15;
 // Finish every material before the world receiver installs its shader hooks.
 const base=create59({...options,riderMaterialLifecycle:{...lifecycle,trackRig:rig=>rig}});
 return {...base,materialLifecycle:lifecycle,build(...args){
  const rig=installSideflow7(options.THREE,base.build(...args));
  refineRiderNeckNormals(options.THREE,rig);
  installSweptCrown(options.THREE,rig);
  finishRiderComplexion(rig);
  lifecycle.trackRig(rig);
  try{return rig.kit.headAsset.portrait99?installHair99(options.THREE,rig,lifecycle):installLong98(options.THREE,rig,lifecycle);}catch(error){rig.dispose();throw error;}
 }};
}

export function createRiderLibrary(options){return withCaninoCharacter(options,createLegacyRiderLibrary(options),options.riderMaterialLifecycle||riderMaterialLifecycle15);}

import {RIDER_HAIR as legacyHair,riderHairId as legacyHairId} from './rider-model-base.js?v=character-foundation99-20261021';
export const RIDER_HAIR=[...CANINO_HAIR_STYLES.map(h=>({...h,body:legacyHair.some(x=>x.id===h.id&&x.body.includes('m'))?['f','m']:['f']})),...legacyHair.filter(h=>h.body.includes('m')&&!CANINO_HAIR_STYLES.some(x=>x.id===h.id)).map(h=>({...h,body:['m']}))];
export const riderHairId=(id,body)=>body==='m'?legacyHairId(id,body):caninoHairId(id);
