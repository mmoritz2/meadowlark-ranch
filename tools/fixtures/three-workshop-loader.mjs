// CPU tests use the same bundled Three that the browser import map selects.
export function resolve(specifier,context,nextResolve){if(specifier==='three')return{url:new URL('../../assets/vendor/three/build/three.module.js',import.meta.url).href,shortCircuit:true};return nextResolve(specifier,context);}
