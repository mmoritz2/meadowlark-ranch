import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original fruit geometry attached to the existing CC0 island_tree_01 branches.
// The runtime and distant-view baker share the complete tree, so fruit cannot
// float beside a differently rotated billboard crown on lower graphics tiers.
export function createOrchardFruit({THREE:T,branchGeometry,sourceHeight,forageArt}){
 const template=forageArt.make('apple'),matrices=[],anchors=[],p=new T.Object3D(),v=new T.Vector3();
 const vertices=branchGeometry.attributes.position,candidates=[];
 for(let i=0;i<vertices.count;i+=3){
  v.fromBufferAttribute(vertices,i);const r=Math.hypot(v.x,v.z),h=v.y/sourceHeight;
  if(h>.40&&h<.78&&r>.8&&r<2.0)candidates.push(v.clone());
 }
 for(let i=0;i<candidates.length&&anchors.length<12;i++){
  const point=candidates[i*37%candidates.length];
  if(anchors.some(p=>p.distanceTo(point)<.36))continue;anchors.push(point.clone());
  const scale=.92+(anchors.length%3)*.08;
  p.position.copy(point).add(new T.Vector3(0,-.171*scale,0));p.rotation.set(0,anchors.length*2.39996,0);p.scale.setScalar(scale);p.updateMatrix();matrices.push(p.matrix.clone());
 }
 if(anchors.length<12)throw Error('Orchard scan has insufficient branch attachments');
 const root=new T.Group();root.name='Orchard | branch-grown apples';let triangles=0;
 for(const source of template.children){
  if(!source.isMesh)continue;
  const parts=matrices.map(m=>source.geometry.clone().applyMatrix4(m)),geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,source.material);mesh.name='Orchard fruit | '+source.material.name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  triangles+=geometry.index.count/3;
 }
 return {root,stats:{clusters:anchors.length,apples:anchors.length*2,drawCalls:root.children.length,triangles,anchors:anchors.map(p=>p.toArray())}};
}
