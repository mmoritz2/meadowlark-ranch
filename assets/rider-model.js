import {createRiderLibrary as create59} from './rider-model-braids.js?v=more-noticeable-lashes96-20261013';
export * from './rider-model-braids.js?v=more-noticeable-lashes96-20261013';
import {installSideflow7} from './rider-long-framing.js?v=hair-flow76-20261012';
import {finishRiderComplexion} from './rider-complexion.mjs?v=natural-complexion-20261020';
import {riderMaterialLifecycle15} from './rider-material-lifecycle.js?v=character-polish-20261009';
import {installSweptCrown} from './rider-swept-crown.mjs?v=continuous-crown-20261020';
import {refineRiderNeckNormals} from './rider-neck-normals.mjs?v=neck-fairing-20261020';
export function createRiderLibrary(options){
 const lifecycle=options.riderMaterialLifecycle||riderMaterialLifecycle15;
 // Finish every material before the world receiver installs its shader hooks.
 const base=create59({...options,riderMaterialLifecycle:{...lifecycle,trackRig:rig=>rig}});
 return {...base,materialLifecycle:lifecycle,build(...args){
  const rig=installSideflow7(options.THREE,base.build(...args));
  refineRiderNeckNormals(options.THREE,rig);
  installSweptCrown(options.THREE,rig);
  finishRiderComplexion(rig);
  return lifecycle.trackRig(rig);
 }};
}
