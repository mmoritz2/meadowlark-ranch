import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {installBackdrop} from '../assets/world-art.js';
const originalLoad=THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
const make=()=>{const scene=new THREE.Scene();return installBackdrop({THREE,scene});};
const backdrop=make();THREE.TextureLoader.prototype.load=originalLoad;
const regionMax=(mesh,start,end)=>{const p=mesh.geometry.attributes.position;let max=-Infinity;for(let i=0;i<p.count;i++){const angle=Math.atan2(p.getZ(i),p.getX(i));if(angle>=start&&angle<=end)max=Math.max(max,p.getY(i));}return max;};
test('three static relief layers retain a fixed draw and triangle budget',()=>{assert.equal(backdrop.children.length,3);for(const mesh of backdrop.children){assert.equal(mesh.geometry.index.count/3,49152);assert.equal(mesh.geometry.attributes.position.count,25137);assert.equal(mesh.matrixAutoUpdate,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);for(const a of Object.values(mesh.geometry.attributes))assert(a.array.every(Number.isFinite));}});
test('angular strip closes exactly in position, colour and lighting normal',()=>{for(const mesh of backdrop.children){for(const a of Object.values(mesh.geometry.attributes))for(let j=0;j<=48;j++)for(let k=0;k<a.itemSize;k++)assert.equal(a.array[(j*513)*a.itemSize+k],a.array[(j*513+512)*a.itemSize+k]);}});
test('real meshes retain open southwest/east valleys and raised dry shoulders',()=>{
 for(const mesh of backdrop.children){
  const sw=regionMax(mesh,2.03,2.3),east=regionMax(mesh,.25,.48),dry=regionMax(mesh,2.7,2.9);
  assert(sw<12);assert(dry>sw+10);assert(east<dry*.5);
 }
});
test('far northern geometry forms three raised ranges separated by broad low passes',()=>{
 const far=backdrop.children[0];
 // Sample full sectors of the emitted mesh, including every radial row. This
 // catches a continuous high wall or a flattened range, not one chosen vertex.
 const crests=[[-2.50,-1.95],[-1.80,-1.38],[-1.34,-.84]].map(([a,b])=>regionMax(far,a,b));
 const passes=[[-1.91,-1.84],[-1.50,-1.43]].map(([a,b])=>regionMax(far,a,b));
 for(const crest of crests)assert(crest>90&&crest<210,'Each distant range retains bounded relief');
 for(const pass of passes)assert(pass>0&&pass<75,'Broad connecting passes stay low without a missing floor');
 assert(Math.min(crests[0],crests[1])-passes[0]>50,'Western pass separates adjacent ranges');
 assert(Math.min(crests[1],crests[2])-passes[1]>50,'Eastern pass separates adjacent ranges');
});
test('middle and near northern layers remain low foothills with a visible depth hierarchy',()=>{
 const peaks=[1,2].map(layer=>regionMax(backdrop.children[layer],-2.55,-.55));
 for(const [index,layer]of [1,2].entries()){
  const peak=peaks[index],centre=regionMax(backdrop.children[layer],-1.8,-1.3);
  assert(peak>20&&peak<(layer===1?120:80),'Northern foothill envelope stays bounded');
  assert(centre>0,'Northern centre retains a connected low ridge');
  assert(peak>centre*1.25,'Low centre and unequal side ridges remain distinct');
 }
 assert(peaks[0]>peaks[1]*1.25,'Middle relief remains higher than the near foothills');
});
test('dry and pastoral vertex palettes remain distinct rather than generic green rings',()=>{for(const mesh of backdrop.children){const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color;let dry=0,green=0;for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i));if(a>2.65&&a<2.95&&c.getX(i)>c.getY(i))dry++;if(a>1.45&&a<1.75&&c.getY(i)>c.getX(i))green++;}assert(dry>500);assert(green>500);}});
test('landscape geometry is independent of ambient random placement streams',()=>{const prior=Math.random;try{Math.random=()=>.123;const second=make();for(let j=0;j<3;j++){const a=backdrop.children[j].geometry,b=second.children[j].geometry;assert.deepEqual(a.index.array,b.index.array);for(const k of Object.keys(a.attributes))assert.deepEqual(a.attributes[k].array,b.attributes[k].array);}}finally{Math.random=prior;}});
test('regional mineral shader composes bounded climate woodland and fog on every layer',()=>{for(const mesh of backdrop.children){const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};mesh.material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('vec4 regionalWeights(float angle)'));assert(shader.fragmentShader.includes('vColor.g-max(vColor.r,vColor.b)'));assert(shader.fragmentShader.includes('climate.w*.65'));assert(shader.fragmentShader.includes('if(abs(ldet)>.000001)'));assert.equal((shader.fragmentShader.match(/vec4 regionalWeights\(float angle\)/g)||[]).length,1);}});
