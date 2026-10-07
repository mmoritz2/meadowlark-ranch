import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

const random=initial=>{let seed=initial;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};};

// Original willow architecture: spreading scaffold limbs, pendant shoots and
// folded lanceolate leaves. The leaf outline is geometry, without opaque cards.
export function createWillowGeometry(T,seed=62193){
 const rand=random(seed),V=(x,y,z)=>new T.Vector3(x,y,z),wood=[],leaves=[];let leafCount=0,shootCount=0;
 function tube(points,radius,sides=7,steps=10,flexible=false){
  const curve=new T.CatmullRomCurve3(points),frames=curve.computeFrenetFrames(steps,false),p=[],uv=[],color=[],flex=[],index=[];
  let length=curve.getLength();
  for(let k=0;k<=steps;k++){
   const t=k/steps,point=curve.getPointAt(t),side=frames.normals[k],front=frames.binormals[k];
   const r=radius*Math.pow(1-t,.82)+radius*.075;
   for(let j=0;j<=sides;j++){
    const a=j/sides*Math.PI*2,n=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(front,Math.sin(a)),rr=r*(1+.065*Math.sin(a*3+t*7));
    const v=point.clone().addScaledVector(n,rr);p.push(v.x,v.y,v.z);uv.push(j/sides*radius*9,t*length*.6);const shade=.86+.12*t;color.push(shade,shade,shade);flex.push(flexible?t*t:0);
    if(k<steps&&j<sides){const b=k*(sides+1)+j,c=b+sides+1;index.push(b,b+1,c,b+1,c+1,c);}
   }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(color,3));geo.setAttribute('willowFlex',new T.Float32BufferAttribute(flex,1));geo.setIndex(index);geo.computeVertexNormals();wood.push(geo);return curve;
 }
 function leaf(point,length,width,heading,lean,flex=0){
  const geo=new T.BufferGeometry(),p=[],uv=[],colors=[],fx=[];
  const axis=V(Math.cos(heading)*Math.sin(lean),-Math.cos(lean),Math.sin(heading)*Math.sin(lean)),right=V(-Math.sin(heading),0,Math.cos(heading)),normal=right.clone().cross(axis).normalize();
  const verts=[[0,0,0],[-.5,.34,0],[0,.34,.10],[.5,.34,0],[-.30,.72,0],[0,.72,.14],[.30,.72,0],[0,1,0]];
  const light=.70+rand()*.25+point.y*.015;
  for(const [x,y,crease]of verts){const v=point.clone().addScaledVector(axis,y*length).addScaledVector(right,x*width).addScaledVector(normal,crease*width+Math.sin(y*Math.PI)*length*.08);p.push(v.x,v.y,v.z);uv.push(x+.5,y);const shade=light*(crease?1.04:.95);colors.push(shade*.90,shade,shade*.79);fx.push(flex);}
  geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('willowFlex',new T.Float32BufferAttribute(fx,1));geo.setIndex([0,1,2,0,2,3,1,4,5,1,5,2,2,5,6,2,6,3,4,7,5,5,7,6]);geo.computeVertexNormals();leaves.push(geo);leafCount++;
 }
 tube([V(0,-.12,0),V(.10,1.1,.07),V(-.12,2.25,.10),V(.22,3.75,.15)],.48,13,15);
 for(let i=0;i<8;i++){const a=i*2.39996; tube([V(0,.40,0),V(Math.cos(a)*.38,.13,Math.sin(a)*.38),V(Math.cos(a)*.85,-.06,Math.sin(a)*.85)],.16,7,6);}
 for(let i=0;i<9;i++){
  const a=i*2.39996+(rand()-.5)*.3,radius=(i<3?2.0:3.1)+rand()*.9,top=(i<3?6.5:5.5)+rand()*.8,base=V(-.05,2.6+rand()*.65,.10);
  const limb=tube([base,V(Math.cos(a)*radius*.32,top*.77+rand()*.3,Math.sin(a)*radius*.32),V(Math.cos(a)*radius*.68,top+rand()*.2,Math.sin(a)*radius*.68),V(Math.cos(a)*radius,top-.65+rand()*.3,Math.sin(a)*radius)],.17+rand()*.07,9,13);
  for(let j=0;j<6;j++){
   const t=.27+j*.125,origin=limb.getPoint(t),side=(j%2?1:-1),angle=a+side*(.45+rand()*.55),reach=.45+rand()*.65;
   const end=origin.clone().add(V(Math.cos(angle)*reach,.35+rand()*.30,Math.sin(angle)*reach));
   const branch=tube([origin,origin.clone().lerp(end,.48).add(V(0,.12,0)),end],.027+rand()*.018,5,5);
   for(let k=0;k<4;k++){
    const start=branch.getPoint(.14+k*.27),hang=1.6+rand()*2.8,drift=.18+rand()*.40,aa=angle+(k-1)*.55;
    const bottom=start.clone().add(V(Math.cos(aa)*drift,-Math.min(hang,start.y-.85),Math.sin(aa)*drift));
    const shoot=tube([start,start.clone().lerp(bottom,.35).add(V(Math.cos(aa)*.24,.08,Math.sin(aa)*.24)),bottom],.0095,4,7,true);shootCount++;
    for(let n=0;n<40;n++){
     const f=.015+n*.024,pt=shoot.getPoint(f),heading=aa+n*2.39996;
     leaf(pt,.24+rand()*.13,.048+rand()*.029,heading,.35+rand()*.80,f*f);
    }
   }
   // Short upright sprays fill the crown above the hanging curtains.
   for(let k=0;k<14;k++){
    const f=rand(),pt=branch.getPoint(f),heading=rand()*Math.PI*2;
    leaf(pt,.22+rand()*.13,.044+rand()*.025,heading,1.15+rand()*1.7,.08);
   }
  }
 }
 const bark=mergeGeometries(wood,false),crown=mergeGeometries(leaves,false);[...wood,...leaves].forEach(g=>g.dispose());
 for(const geo of[bark,crown]){geo.computeBoundingBox();geo.computeBoundingSphere();}
 return {bark,crown,stats:{leaves:leafCount,shoots:shootCount,triangles:(bark.index.count+crown.index.count)/3}};
}

export async function installWillowArt(G,roots,wind){
 const T=G.THREE,loader=new T.TextureLoader();
 const textures=await Promise.all(['diff','nor_gl','rough'].map(k=>loader.loadAsync('./assets/textures/scanned/pine_sapling_small_bark_'+k+'.webp')));
 textures.forEach((t,i)=>{t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());if(i===0)t.colorSpace=T.SRGBColorSpace;});
 const bark=new T.MeshStandardMaterial({name:'Willow | scanned bark',map:textures[0],normalMap:textures[1],roughnessMap:textures[2],normalScale:new T.Vector2(.7,.7),color:'#e0d5bf',roughness:1,vertexColors:true});
 const leaf=new T.MeshStandardMaterial({name:'Willow | folded narrow leaves',color:'#82984e',side:T.DoubleSide,roughness:.93,envMapIntensity:.48,vertexColors:true});
 const deform=sh=>{sh.uniforms.willowWind=wind;sh.vertexShader='uniform float willowWind;attribute float willowFlex;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float phase=position.x*.65+position.z*.41;
   transformed.x+=sin(willowWind*.67+phase)*willowFlex*.07;
   transformed.z+=sin(willowWind*.53+phase*.7)*willowFlex*.05;`);
 };
 bark.onBeforeCompile=deform;bark.customProgramCacheKey=()=> 'willow-bark-1';
 leaf.onBeforeCompile=sh=>{deform(sh);
  sh.vertexShader='varying vec2 willowUV;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nwillowUV=uv;');
  sh.fragmentShader='varying vec2 willowUV;\n'+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float vein=1.0-smoothstep(.018,.055,abs(willowUV.x-.5));
   diffuseColor.rgb*=.96+vein*.07;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize(mix(normal,mat3(viewMatrix)*vec3(0.0,1.0,0.0),.22));`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <opaque_fragment>',`
   #if NUM_DIR_LIGHTS > 0
    outgoingLight+=diffuseColor.rgb*directionalLights[0].color*pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0)*.045;
   #endif
   #include <opaque_fragment>`);
 };leaf.customProgramCacheKey=()=> 'willow-leaves-1';
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});depth.onBeforeCompile=deform;depth.customProgramCacheKey=()=> 'willow-depth-1';
 const templates=[createWillowGeometry(T,62193),createWillowGeometry(T,97647)];
 for(const source of templates){
  // Preserve every leaf silhouette at distance; remove only the folded centre.
  const far=source.crown.clone(),index=[];
  for(let i=0;i<far.attributes.position.count;i+=8)for(const j of[0,1,3,1,4,6,1,6,3,4,7,6])index.push(i+j);
  far.setIndex(index);source.farCrown=far;source.farTriangles=(source.bark.index.count+far.index.count)/3;
 }
 const group=new T.Group();group.name='Willowmere | living willows';const records=[];
 roots.forEach((old,i)=>{
  const source=templates[i%2],root=new T.Group(),floor=G.world.groundH(old.position.x,old.position.z),yaw=old.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw);root.name='Willowmere willow | '+i;root.position.set(old.position.x,floor,old.position.z);root.rotation.y=yaw;
  const wood=source.bark.clone(),p=wood.attributes.position;
  for(let j=0;j<p.count;j++)if(p.getY(j)<.75){const x=p.getX(j),z=p.getZ(j),dy=G.world.groundH(root.position.x+x*c+z*s,root.position.z-x*s+z*c)-floor;p.setY(j,p.getY(j)+dy*Math.max(0,1-p.getY(j)/.75)**2);}
  wood.computeVertexNormals();wood.computeBoundingBox();wood.computeBoundingSphere();
  for(const [geo,mat]of[[wood,bark],[source.crown,leaf]]){const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=depth;root.add(mesh);}
  group.add(root);records.push({root,source,near:true,index:i,x:root.position.x,z:root.position.z,yaw,height:source.crown.boundingBox.max.y,leaves:source.stats.leaves,shoots:source.stats.shoots,triangles:source.stats.triangles});
 });
 G.scene.add(group);
 roots.forEach((old,i)=>{old.visible=false;const at=records[i],collider=G.world.colliders.find(c=>Math.hypot(c.x-at.x,c.z-at.z)<.001&&c.r===1);if(collider){collider.height=at.height;collider.trunk=true;}
  // Register only the opaque bole with the riding camera. Soft leaf curtains
  // must not behave like the enclosing walls of a building.
  const proxy=new T.Mesh(new T.CylinderGeometry(.28,.55,3.2,8),bark);proxy.position.set(at.x,G.world.groundH(at.x,at.z)+1.6,at.z);G.world.followCamera.register(proxy);
 });
 const state={group,records,trees:records.length,triangles:0,drawCalls:records.length*2,budget:650000};
 state.update=()=>{
  const tier=G.gfx.get(),range=tier==='high'?70:tier==='medium'?45:0,xr=G.renderer.xr.isPresenting,p=G.horse.player.pos;
  let triangles=0;for(const t of records){
   const near=range>0&&!xr&&Math.hypot(t.x-p.x,t.z-p.z)<range+(t.near?6:0);
   t.root.children[1].geometry=near?t.source.crown:t.source.farCrown;t.near=near;
   t.triangles=near?t.source.stats.triangles:t.source.farTriangles;triangles+=t.triangles;
   for(const mesh of t.root.children)mesh.castShadow=!xr;
  }
  state.triangles=triangles;
 };state.update();return state;
}
