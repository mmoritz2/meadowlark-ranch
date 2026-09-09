/* The generated multiview albedo contains large baked highlights. Compress
 * those on the brown coat so lighting comes from the scene. Keep dark points,
 * facial pigment and small texture variation, with separate eye materials.
 * Coordinates are the authored hero's +X-forward / +Y-up rest mesh.
 */
export function finishHeroCoat({THREE,scene}){
  let body=null;scene.traverse(o=>{if(o.isMesh&&(!body||o.geometry.attributes.position.count>body.geometry.attributes.position.count))body=o;});
  if(!body?.material?.map)return null;
  const source=body.material;
  if(!body.geometry.getAttribute('normal'))body.geometry.computeVertexNormals();
  const material=new THREE.MeshPhysicalMaterial({map:source.map,normalMap:source.normalMap,
    roughness:.69,metalness:0,envMapIntensity:.65,specularIntensity:.34,
    sheen:.14,sheenColor:new THREE.Color('#a9866c'),sheenRoughness:.85});
  material.name='Bay coat, balanced pigment';
  if(source.normalScale)material.normalScale.copy(source.normalScale);
  material.onBeforeCompile=shader=>{
    shader.uniforms.heroBay={value:new THREE.Color('#88503a')};
    shader.vertexShader='varying vec3 vHeroRest;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHeroRest=position;');
    shader.fragmentShader='varying vec3 vHeroRest;\nuniform vec3 heroBay;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float pigmentLuma=max(.0001,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
      float torso=smoothstep(-.27,-.04,vHeroRest.y)*smoothstep(-.86,-.69,vHeroRest.x)*(1.-smoothstep(.68,.90,vHeroRest.x));
      float brown=smoothstep(.015,.065,diffuseColor.r-diffuseColor.b);
      vec3 torsoPigment=heroBay*clamp(pow(pigmentLuma/.11,.25),.52,1.28);
      vec3 facePigment=heroBay*clamp(pow(pigmentLuma/.11,.44),.30,1.30);
      diffuseColor.rgb=mix(diffuseColor.rgb,torsoPigment,torso*.86);
      diffuseColor.rgb=mix(diffuseColor.rgb,facePigment,(1.-torso)*brown*.68);
    `);
  };
  material.customProgramCacheKey=()=> 'hero-bay-pigment-2';
  body.material=material;
  return material;
}
