import {createRiderLibrary as create58} from './rider-model-long-fall.js?v=character-foundation99-20261021';
export * from './rider-model-long-fall.js?v=character-foundation99-20261021';
import {installNativeBraids} from './rider-braids.js?v=cotton-twin79d-20261012';
export function createRiderLibrary(options){const base=create58(options);return {...base,build(...args){return installNativeBraids(options.THREE,base.build(...args));}};}
