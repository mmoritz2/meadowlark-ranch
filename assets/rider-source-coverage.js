// Source-domain visibility for the authored rider. The same fragment predicate
// is used by visible shading, directional/spot depth and point distance shadows.
// Skinning remains Three's built-in path; source fields are bind-space attributes.
export const SOURCE_COVERAGE_VERSION = 'source-coverage-1';

export function sourceCoverageCode({shirt = true, boots = false} = {}) {
  if (!shirt && !boots) throw Error('Source coverage needs a supported field');
  const vertexDeclarations = [
    shirt ? 'attribute vec3 qaSourceCut; varying vec3 vQaSourceCut;' : '',
    boots ? 'attribute float qaBootCoverage; varying float vQaBootCoverage;' : ''
  ].filter(Boolean).join('\n');
  const fragmentDeclarations = [
    shirt ? 'varying vec3 vQaSourceCut;' : '',
    boots ? 'varying float vQaBootCoverage;' : ''
  ].filter(Boolean).join('\n');
  const assignment = [
    shirt ? 'vQaSourceCut=qaSourceCut;' : '',
    boots ? 'vQaBootCoverage=qaBootCoverage;' : ''
  ].filter(Boolean).join('\n');
  const conditions = [
    shirt ? '(vQaSourceCut.x>.0015&&vQaSourceCut.y>.0015&&vQaSourceCut.z>.0012)' : '',
    boots ? '(vQaBootCoverage<0.0)' : ''
  ].filter(Boolean).join('||');
  const discard = `/* ${SOURCE_COVERAGE_VERSION} begin */\nif(${conditions})discard;\n/* ${SOURCE_COVERAGE_VERSION} end */`;
  return Object.freeze({shirt:!!shirt, boots:!!boots, vertexDeclarations,
    fragmentDeclarations, assignment, discard,
    cacheKey:`${SOURCE_COVERAGE_VERSION}-${shirt?'shirt':''}-${boots?'boots':''}`});
}

export function sourceCovered(cut, boot, {shirt = true, boots = false} = {}) {
  return !!((shirt && cut[0]>.0015 && cut[1]>.0015 && cut[2]>.0012) ||
    (boots && boot<0));
}

function insertOnce(source, anchor, text) {
  if (source.split(anchor).length !== 2) throw Error('Source coverage shader anchor changed: '+anchor);
  return source.replace(anchor, anchor+'\n'+text);
}

export function patchSourceCoverage(material, options) {
  const code=sourceCoverageCode(options), previous=material.onBeforeCompile,
    key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader, renderer) {
    previous.call(this, shader, renderer);
    if (shader.vertexShader.includes(SOURCE_COVERAGE_VERSION) ||
        shader.fragmentShader.includes(SOURCE_COVERAGE_VERSION)) throw Error('Source coverage installed twice');
    shader.vertexShader=insertOnce(shader.vertexShader,'#include <common>',code.vertexDeclarations);
    shader.vertexShader=insertOnce(shader.vertexShader,'#include <begin_vertex>',code.assignment);
    shader.fragmentShader=insertOnce(shader.fragmentShader,'#include <common>',code.fragmentDeclarations);
    shader.fragmentShader=insertOnce(shader.fragmentShader,'#include <clipping_planes_fragment>',code.discard);
    material.userData.sourceCoverage.compiles++;
    material.userData.sourceCoverage.lastShader={vertexDeclarations:code.vertexDeclarations,
      fragmentDeclarations:code.fragmentDeclarations,assignment:code.assignment,discard:code.discard,
      skinning:shader.vertexShader.includes('#include <skinning_vertex>')};
  };
  material.customProgramCacheKey=()=>key+'-'+code.cacheKey;
  material.userData.sourceCoverage={version:SOURCE_COVERAGE_VERSION,shirt:code.shirt,
    boots:code.boots,compiles:0,discard:code.discard};
  material.needsUpdate=true;
  return code;
}

export function installSourceCoverage(THREE, mesh, options) {
  if (Array.isArray(mesh.material)) throw Error('Source coverage expects one owned material');
  if (mesh.customDepthMaterial || mesh.customDistanceMaterial) throw Error('Source coverage must not replace another shadow deformation hook');
  const code=sourceCoverageCode(options), attrs=mesh.geometry.attributes, count=attrs.position.count;
  for (const [name,size] of [['qaSourceCut',code.shirt?3:0],['qaBootCoverage',code.boots?1:0]]) {
    if(size && (!attrs[name] || attrs[name].itemSize!==size || attrs[name].count!==count))
      throw Error('Source coverage attribute mismatch: '+name);
  }
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),
    distance=new THREE.MeshDistanceMaterial();
  patchSourceCoverage(mesh.material,code);
  patchSourceCoverage(depth,code);
  patchSourceCoverage(distance,code);
  mesh.customDepthMaterial=depth;
  mesh.customDistanceMaterial=distance;
  mesh.userData.sourceCoverage={version:SOURCE_COVERAGE_VERSION,shirt:code.shirt,
    boots:code.boots,bindSpaceFields:true,sharedDiscard:code.discard,
    normalMaterial:mesh.material.uuid,depthMaterial:depth.uuid,distanceMaterial:distance.uuid};
  let disposed=false;
  return {code,depth,distance,dispose(){
    if(disposed)return;disposed=true;
    if(mesh.customDepthMaterial===depth)mesh.customDepthMaterial=undefined;
    if(mesh.customDistanceMaterial===distance)mesh.customDistanceMaterial=undefined;
    depth.dispose();distance.dispose();
  }};
}
