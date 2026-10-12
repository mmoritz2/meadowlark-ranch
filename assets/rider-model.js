import {createRiderLibrary as create59} from './rider-model-braids.js?v=lip-contour78-20261012';
export * from './rider-model-braids.js?v=lip-contour78-20261012';
import {installSideflow7} from './rider-long-framing.js?v=hair-flow76-20261012';
export function createRiderLibrary(options){const base=create59(options);return {...base,build(...args){return installSideflow7(options.THREE,base.build(...args));}};}
