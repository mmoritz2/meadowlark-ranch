import {createRiderLibrary as create58} from './rider-model-long-fall.js?v=character-polish-20261009';
export * from './rider-model-long-fall.js?v=character-polish-20261009';
import {installNativeBraids} from './rider-braids.js?v=character-polish-20261009';
export function createRiderLibrary(options){const base=create58(options);return {...base,build(...args){return installNativeBraids(options.THREE,base.build(...args));}};}
