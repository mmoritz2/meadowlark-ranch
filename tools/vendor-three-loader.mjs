import {pathToFileURL} from 'node:url';
const root=process.env.WORLD_HORSE_SOURCE_ROOT?pathToFileURL(process.env.WORLD_HORSE_SOURCE_ROOT+'/'):new URL('../',import.meta.url);
export async function resolve(specifier,context,nextResolve){if(specifier==='three')return{url:new URL('assets/vendor/three/build/three.module.js',root).href,shortCircuit:true};return nextResolve(specifier,context);}
