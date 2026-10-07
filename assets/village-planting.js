import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {enableOpaqueFoliageCoverage,patchFoliageCoverage} from './tree-impostors.js?v=opaque-foliage-1';

const random=initial=>{let seed=initial;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};};

// Original compact geometry; the flower/leaf UVs refer to the existing CC0
// Poly Haven periwinkle atlas. Curved surfaces keep highlights off flat cards.
export function floweringBorderGeometry(T,seed=7391){
 const rand=random(seed),parts=[],pivot=new T.Object3D();
 function spray(position,width,height,uv,normal,spin=0){
  const g=new T.PlaneGeometry(width,height,2,2),p=g.attributes.position,tex=g.attributes.uv;
  for(let i=0;i<p.count;i++){
   const u=tex.getX(i),v=tex.getY(i);p.setZ(i,Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*width*.17);
   tex.setXY(i,uv[0]+u*(uv[2]-uv[0]),uv[3]+v*(uv[1]-uv[3]));
  }
  g.computeVertexNormals();pivot.position.copy(position);pivot.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal.normalize());pivot.rotateZ(spin);pivot.updateMatrix();g.applyMatrix4(pivot.matrix);parts.push(g);
 }
 // Dense branching crowns, lower leaves conceal the bare stalks in the scan.
 for(let i=0;i<125;i++){
  const a=i*2.399963,r=Math.sqrt(rand()),y=.10+rand()*.40;
  const radius=.31*Math.sqrt(Math.max(.1,1-((y-.30)/.32)**2))*r;
  const pos=new T.Vector3(Math.cos(a)*radius,y,Math.sin(a)*radius);
  spray(pos,.13+rand()*.07,.066+rand()*.025,[.590,.044,.765,.145],new T.Vector3(Math.cos(a)*.7,.40+rand()*.7,Math.sin(a)*.7),rand()*6.28);
 }
 for(let i=0;i<38;i++){
  const a=i*2.399963+.6,r=Math.sqrt(rand())*.285;
  const y=.47+.14*Math.sqrt(1-r*r/(.31*.31))+(rand()-.5)*.075;
  const pos=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r),size=.066+rand()*.038;
  spray(pos,size,size,[.286,.242,.531,.496],new T.Vector3(Math.cos(a)*.5,.72+rand()*.5,Math.sin(a)*.5),rand()*6.28);
 }
 const geo=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
}

// Columnar evergreen with ascending shoots, uneven crown and a tapered leader.
// Uses the game's original needle spray; no new texture or runtime model download.
export function cypressGeometry(T,seed=5017){
 const rand=random(seed),leaves=[],wood=[],pivot=new T.Object3D(),up=new T.Vector3(0,1,0);
 function branch(a,b,r){
  const d=b.clone().sub(a),g=new T.CylinderGeometry(r*.35,r,d.length(),5,1);
  pivot.position.copy(a).add(b).multiplyScalar(.5);pivot.quaternion.setFromUnitVectors(up,d.normalize());pivot.updateMatrix();g.applyMatrix4(pivot.matrix);wood.push(g);
 }
 branch(new T.Vector3(0,-.045,0),new T.Vector3(.055,7.2,-.04),.12);
 for(let i=0;i<110;i++){
  const t=(i+.4)/110,y=.56+t*6.35,a=i*2.399963+(rand()-.5)*.5;
  const radius=(.22+.47*Math.sin(Math.PI*t)**.7)*(1-.56*t)*(.88+rand()*.22);
  const base=new T.Vector3(Math.sin(t*4)*.045,y-.34,Math.cos(t*3)*.035);
  const tip=new T.Vector3(Math.cos(a)*radius,y+.24+rand()*.23,Math.sin(a)*radius);
  branch(base,tip,.013*(1-t*.6));
  for(let j=0;j<6;j++){
   const f=.28+j*.125,pos=base.clone().lerp(tip,f),angle=a+(j%2?1:-1)*(.30+rand()*.72);
   const height=(.55+rand()*.40)*(1-t*.62),width=height*(.54+rand()*.16);
   const g=new T.PlaneGeometry(width,height,2,2),p=g.attributes.position,uv=g.attributes.uv;
   for(let k=0;k<p.count;k++)p.setZ(k,Math.sin(uv.getX(k)*Math.PI)*height*.12);
   // The foliage normal follows the whole crown, with a small upward component.
   // Individual bent sprays retain texture detail without harsh checker lighting.
   g.computeVertexNormals();pivot.position.copy(pos);pivot.rotation.set((rand()-.5)*.7,angle,(rand()-.5)*.42);pivot.updateMatrix();g.applyMatrix4(pivot.matrix);
   const colors=[],shade=.62+f*.23+t*.12;
   for(let k=0;k<p.count;k++)colors.push(shade*.91,shade,shade*.86);
   g.setAttribute('color',new T.Float32BufferAttribute(colors,3));leaves.push(g);
  }
 }
 const bark=mergeGeometries(wood,false),crown=mergeGeometries(leaves,false);[...wood,...leaves].forEach(g=>g.dispose());
 bark.computeBoundingBox();crown.computeBoundingBox();bark.computeBoundingSphere();crown.computeBoundingSphere();return {bark,crown};
}

export async function installVillageEvergreens(G,trees,wind){
 const T=G.THREE,texture=await new T.TextureLoader().loadAsync('./assets/textures/realism/foliage_needle_rgba.png');
 texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());
 const foliage=new T.MeshStandardMaterial({map:texture,alphaTest:.44,side:T.DoubleSide,roughness:1,envMapIntensity:.48,vertexColors:true});
 enableOpaqueFoliageCoverage(T,foliage);
 const deform=shader=>{
  shader.uniforms.cypressWind=wind;shader.vertexShader='uniform float cypressWind;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float crownBend=pow(max(position.y,0.0)/7.2,2.0);
   transformed.x+=sin(cypressWind*.65+position.y*.7)*crownBend*.045;
   transformed.z+=sin(cypressWind*.51+position.y)*crownBend*.035;`);
 };
 foliage.onBeforeCompile=(shader,renderer)=>{deform(shader);patchFoliageCoverage(shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize(mix(normal,mat3(viewMatrix)*vec3(0.0,1.0,0.0),.28));`);
 };
 foliage.customProgramCacheKey=()=> 'village-cypress-1';
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:texture,alphaTest:foliage.alphaTest,side:T.DoubleSide});
 depth.onBeforeCompile=deform;depth.customProgramCacheKey=()=> 'village-cypress-depth-1';
 const geos=cypressGeometry(T),wood=new T.MeshStandardMaterial({color:'#6d6251',roughness:1}),root=new T.Group();root.name='Cottonwood | columnar evergreens';
 for(const [key,mat]of [['bark',wood],['crown',foliage]]){
  const mesh=new T.InstancedMesh(geos[key],mat,trees.length),p=new T.Object3D();mesh.name='Cottonwood evergreen | '+key;
  trees.forEach((t,i)=>{p.position.set(t.x,G.world.groundH(t.x,t.z),t.z);p.rotation.y=t.yaw;p.scale.set(1,t.height/7.2,1);p.updateMatrix();mesh.setMatrixAt(i,p.matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;if(key==='crown')mesh.customDepthMaterial=depth;root.add(mesh);
 }
 G.scene.add(root);
 return {trees:trees.length,triangles:trees.length*(geos.bark.index.count+geos.crown.index.count)/3,drawCalls:2,heightRange:trees.map(t=>t.height)};
}

export function installFloweringBorders(G,group,gardens,sourceMaterial){
 const T=G.THREE,geo=floweringBorderGeometry(T),mat=sourceMaterial.clone();mat.name='Cottonwood | flowering periwinkle borders';mat.vertexColors=false;mat.normalScale.multiplyScalar(.55);
 enableOpaqueFoliageCoverage(T,mat);mat.onBeforeCompile=(sh,r)=>patchFoliageCoverage(sh,r);mat.customProgramCacheKey=()=> 'village-periwinkle-borders-1';
 const matrices=[],placements=[],p=new T.Object3D(),rand=random(27631);
 for(const [index,b]of gardens.entries()){
  const alongX=b.width>b.depth,length=alongX?b.width:b.depth,count=Math.floor((length-.7)/.34)+1;
  for(let row=0;row<2;row++)for(let i=0;i<count;i++){
   const along=-length/2+.37+i*(length-.74)/(count-1),across=(row-.5)*.34;
   const x=b.x+(alongX?along:across),z=b.z+(alongX?across:along),scale=.90+rand()*.19;
   p.position.set(x,G.world.groundH(b.x,b.z)+.245,z);p.rotation.y=rand()*6.28;p.scale.set(scale,1.03+rand()*.24,scale);p.updateMatrix();matrices.push(p.matrix.clone());placements.push({x,z,bed:index,height:.245+geo.boundingBox.max.y*p.scale.y});
  }
 }
 const mesh=new T.InstancedMesh(geo,mat,matrices.length);mesh.name='Cottonwood | living square flowers';
 matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 return {plants:matrices.length,flowers:matrices.length*38,triangles:geo.index.count/3*matrices.length,drawCalls:1,placements};
}
