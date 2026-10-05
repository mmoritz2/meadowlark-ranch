import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';

// Resolve thin branches and grass after tone mapping, where visible contrast
// is known. Canvas MSAA alone does not smooth the final post-processed image.
export function createScreenAntialias(composer) {
  const pass=new ShaderPass(FXAAShader);
  pass.material.depthTest=false;pass.material.depthWrite=false;
  pass.setSize=(w,h)=>pass.uniforms.resolution.value.set(1/Math.max(1,Math.floor(w)),1/Math.max(1,Math.floor(h)));
  composer.addPass(pass);
  return pass;
}
