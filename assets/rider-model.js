import {installLong98} from './rider-long98.js?v=character-redesign98-20261020';
import {createRiderLibrary as create59} from './rider-model-braids.js?v=character-redesign98-20261020';
export * from './rider-model-braids.js?v=character-redesign98-20261020';
import {installSideflow7} from './rider-long-framing.js?v=hair-flow76-20261012';
import {finishRiderComplexion} from './rider-complexion.mjs?v=character-redesign98-20261020';
import {riderMaterialLifecycle15} from './rider-material-lifecycle.js?v=character-polish-20261009';
export function createRiderLibrary(options){
 const lifecycle=options.riderMaterialLifecycle||riderMaterialLifecycle15;
 // Finish every material before the world receiver installs its shader hooks.
 const base=create59({...options,riderMaterialLifecycle:{...lifecycle,trackRig:rig=>rig}});
 return {...base,materialLifecycle:lifecycle,build(...args){
  const rig=finishRiderComplexion(installSideflow7(options.THREE,base.build(...args)));
  lifecycle.trackRig(rig);
  try{return installLong98(options.THREE,rig,lifecycle);}catch(error){rig.dispose();throw error;}
 }};
}
