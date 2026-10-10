import {createRiderLibrary as create49} from './rider-hands.js?v=character-finish68-20261010';
export * from './rider-hands.js?v=character-finish68-20261010';
import {refineHandSurface} from './rider-hand-refinement.js?v=character-polish-20261009';
export function createRiderLibrary(options){const base=create49(options);return{...base,build(...args){return refineHandSurface(options.THREE,base.build(...args));}};}
