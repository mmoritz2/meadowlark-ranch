// Leaves close to the lens can cover a third-person riding view. Fade only
// those fragments; keep tree geometry, source cutouts and shadow casters intact.
// The existing opaque foliage coverage patch supplies foliageMultisample and
// preserves framebuffer alpha. Single-sample targets use stable pixel coverage.
export const LEAF_CAMERA_CLEARANCE=Object.freeze({profile:'leaf-camera-clearance-1',hidden:.65,opaque:1.0});
export function patchLeafCameraClearance(shader){
  const marker='#include <alphatest_fragment>';
  if(shader.fragmentShader.includes('float leafLensCoverage='))return;
  if(shader.fragmentShader.split(marker).length!==2)throw Error('Leaf camera clearance requires one material alpha-test stage');
  shader.fragmentShader=shader.fragmentShader.replace(marker,marker+`
    // Only the color material receives this patch. Source shadow cutouts stay exact.
    if(vViewPosition.z<1.0){
      float leafLensCoverage=smoothstep(.65,1.0,length(vViewPosition));
      if(foliageMultisample){
        diffuseColor.a*=leafLensCoverage;
        if(diffuseColor.a<=0.0)discard;
      }else{
        // Interleaved gradient coverage is fixed to pixel coordinates: no frame RNG.
        float leafLensThreshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
        if(leafLensCoverage<=leafLensThreshold)discard;
      }
    }
  `);
}
