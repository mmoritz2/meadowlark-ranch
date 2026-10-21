// CPU-only mirror resolver; runtime browser imports remain the proposed URLs.
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=process.env.MEADOWLARK_TEST_ROOT||fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
export function resolve(specifier,context,nextResolve){
 if(specifier==='three')return{url:pathToFileURL(root+'/assets/vendor/three/build/three.module.js').href,shortCircuit:true};
 if(context.parentURL&&specifier.startsWith('.')){
  const url=new URL(specifier,context.parentURL);
  if(url.pathname.includes('/vendor/three/'))return{url:pathToFileURL(root+'/assets/vendor/three/'+url.pathname.split('/vendor/three/')[1]).href,shortCircuit:true};
 }
 return nextResolve(specifier,context);
}
