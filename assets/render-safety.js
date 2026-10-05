// Bloom repeatedly downsamples and blurs its input. A single non-finite scene
// pixel otherwise poisons a large rectangular area across every blur level.
export function protectBloomInput(pass) {
  const material=pass.materialHighPassFilter;
  material.fragmentShader=material.fragmentShader.replace('vec3 luma =',`
    if (!all(lessThan(abs(texel.rgb), vec3(65000.0)))) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec3 luma =`);
  material.needsUpdate=true;
}
