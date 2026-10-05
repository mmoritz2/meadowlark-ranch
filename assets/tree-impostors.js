// Matching albedo/normal views of each source scan. The normal is rotated with
// the tree, so a distant crown keeps its volume as the sun and camera move.
export function treeImpostor({THREE,albedo,normals,width,height,bottom}) {
  const geo=new THREE.PlaneGeometry(width,height);geo.translate(0,bottom+height*.5,0);
  const mat=new THREE.MeshStandardMaterial({map:albedo,alphaTest:.22,side:THREE.DoubleSide,roughness:1,envMapIntensity:.48});
  mat.alphaToCoverage=true;
  const vertex=sh=>{
    sh.vertexShader='varying vec2 treeHeading;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 toEye=cameraPosition-instanceMatrix[3].xyz;
        float eyeAngle=atan(toEye.x,toEye.z);
        float treeAngle=atan(instanceMatrix[2].x,instanceMatrix[2].z);
        float localAngle=eyeAngle-treeAngle;
        float frame=mod(floor((localAngle+6.2831853+.3926991)/.7853982),8.0);
        transformed.x=position.x*cos(localAngle);
        transformed.z=-position.x*sin(localAngle);
        vMapUv=(uv+vec2(mod(frame,4.0),1.0-floor(frame/4.0)))/vec2(4.0,2.0);
        treeHeading=vec2(sin(treeAngle),cos(treeAngle));
      #endif`);
  };
  mat.onBeforeCompile=sh=>{
    vertex(sh);sh.uniforms.treeNormals={value:normals};
    sh.fragmentShader='uniform sampler2D treeNormals;varying vec2 treeHeading;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 treeN=texture2D(treeNormals,vMapUv).xyz*2.0-1.0;
      // Filtered atlas normals can cancel to zero at leaf edges. Normalizing
      // that vector produced NaNs which bloom spread into large black tiles.
      float treeLength2=dot(treeN,treeN);
      treeN=treeLength2>1e-6?treeN*inversesqrt(treeLength2):vec3(0.0,1.0,0.0);
      // A little canopy averaging softens the lighting of individual leaf cards.
      treeN=normalize(mix(treeN,vec3(treeN.x,.8,treeN.z),.30));
      treeN=vec3(treeN.x*treeHeading.y+treeN.z*treeHeading.x,treeN.y,-treeN.x*treeHeading.x+treeN.z*treeHeading.y);
      normal=normalize(mat3(viewMatrix)*treeN);`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <opaque_fragment>',`
      #if NUM_DIR_LIGHTS > 0
        float backlit=pow(max(dot(normalize(vViewPosition),-directionalLights[0].direction),0.0),4.0);
        outgoingLight+=diffuseColor.rgb*directionalLights[0].color*backlit*.04;
      #endif
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey=()=> 'scan-tree-normal-views-v3';
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:albedo,alphaTest:.22,side:THREE.DoubleSide});
  depth.onBeforeCompile=vertex;depth.customProgramCacheKey=()=> 'scan-tree-normal-depth-v2';mat.userData.scanDepth=depth;
  return {geo,mat};
}
