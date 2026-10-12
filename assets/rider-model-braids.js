import {createRiderLibrary as create58} from './rider-model-long-fall.js?v=lip-contour78-20261012';
export * from './rider-model-long-fall.js?v=lip-contour78-20261012';
import {installNativeBraids} from './rider-braids.js?v=braid-curve77-20261012';
export function createRiderLibrary(options){const base=create58(options);return {...base,build(...args){return installNativeBraids(options.THREE,base.build(...args));}};}
