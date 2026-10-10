// TMP39: final synchronous wardrobe methods are explicitly tracked after construction.
import {createRiderLibrary as createWardrobe} from './rider-wardrobe.js?v=outward-lapels70-20261010';
export * from './rider-wardrobe.js?v=outward-lapels70-20261010';
import {riderMaterialLifecycle15} from './rider-material-lifecycle.js?v=character-polish-20261009';
export function createRiderLibrary(options){
 const base=createWardrobe(options),lifecycle=options.riderMaterialLifecycle||riderMaterialLifecycle15;
 return {...base,materialLifecycle:lifecycle,build(...args){return lifecycle.trackRig(base.build(...args));}};
}
