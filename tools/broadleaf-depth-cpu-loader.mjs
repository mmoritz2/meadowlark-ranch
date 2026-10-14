// Match the runtime import map with the existing resident vendor tree.
const root=new URL('../',import.meta.url);
export async function resolve(specifier,context,next){if(specifier==='three')return{url:new URL('assets/vendor/three/build/three.module.js',root).href,shortCircuit:true};if(specifier.startsWith('three/addons/'))return{url:new URL('assets/vendor/three/examples/jsm/'+specifier.slice('three/addons/'.length),root).href,shortCircuit:true};return next(specifier,context);}
