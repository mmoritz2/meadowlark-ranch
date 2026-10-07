import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries,deinterleaveGeometry} from 'three/addons/utils/BufferGeometryUtils.js';

// Individual CC0 Poly Haven specimens. Their source gallery offsets are removed
// in the asset build; roots, proportions, alpha masks and PBR maps are preserved.
export async function loadUndergrowthModels(T){
 const loader=new GLTFLoader(),[ferns,shrubs,rooibos]=await Promise.all(['undergrowth/fern_02','undergrowth/shrub_03','builder/wild_rooibos_bush'].map(id=>loader.loadAsync(new URL('./models/world/'+id+'.glb',import.meta.url).href)));
 rooibos.scene.children.forEach(o=>o.position.set(0,0,0));
 const list=asset=>{asset.scene.updateMatrixWorld(true);const out=[];asset.scene.traverse(o=>{if(o.isMesh)out.push({geo:o.geometry.clone().applyMatrix4(o.matrixWorld),mat:o.material,name:o.name});});return out;};
 const fern=list(ferns),shoot=list(shrubs),templates=[];
 function add(id,kind,geo,mat){
  geo.computeBoundingBox();const b=geo.boundingBox.clone(),h=b.max.y-b.min.y;geo.translate(0,-b.min.y,0);geo.scale(1/h,1/h,1/h);geo.computeBoundingBox();geo.computeBoundingSphere();
  templates.push({id,kind,geo,mat:mat.clone(),sourceHeight:h,sourceBottom:b.min.y,triangles:geo.index.count/3});
 }
 fern.forEach((p,i)=>add('fern-'+i,'fern',p.geo,p.mat));
 // Three real upright shoots form a small, open shrub instead of a flat fan of
 // branch photographs. Each cluster uses different specimens and headings.
 for(let variant=0;variant<2;variant++){
  const pieces=[];for(let k=0;k<3;k++){
   const src=shoot[(k+variant)%shoot.length],g=src.geo.clone(),angle=k*2.39996+variant*.91,scale=.82+k*.09;
   g.scale(scale,scale,scale);g.rotateY(angle);g.translate(Math.sin(angle)*.035,0,Math.cos(angle)*.035);pieces.push(g);
  }
  const geo=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());add('shrub-'+variant,'shrub',geo,shoot[0].mat);
 }
 // Each rooibos specimen contains separate stem and leaf primitives sharing
 // one material. Keep the complete specimen, rather than indexing primitives.
 rooibos.scene.updateMatrixWorld(true);
 for(const [i,index]of[1,2].entries()){
  const pieces=[];let material;rooibos.scene.children[index].traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);deinterleaveGeometry(g);pieces.push(g);material=o.material;}});
  const geo=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());add('woody-'+i,'woody',geo,material);
 }
 shoot.forEach(p=>p.geo.dispose());return templates;
}
