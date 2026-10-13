import {createRiderLibrary as create57} from './rider-model-hand-refined.js?v=more-noticeable-lashes96-20261013';
export * from './rider-model-hand-refined.js?v=more-noticeable-lashes96-20261013';
import {installRearFall4c} from './rider-long-fall.js?v=character-polish-20261009';
export function createRiderLibrary(options){const base=create57(options);return {...base,build(...args){return installRearFall4c(options.THREE,base.build(...args));}};}
