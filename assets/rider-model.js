import {createRiderLibrary as create59} from './rider-model-braids.js?v=rider-fit74-20261010';
export * from './rider-model-braids.js?v=rider-fit74-20261010';
import {installSideflow7} from './rider-long-framing.js?v=rider-fit74-20261010';
export function createRiderLibrary(options){const base=create59(options);return {...base,build(...args){return installSideflow7(options.THREE,base.build(...args));}};}
