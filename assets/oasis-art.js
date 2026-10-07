import {enableOpaqueFoliageCoverage,patchFoliageCoverage} from './tree-impostors.js?v=opaque-foliage-1';

export const OASIS=Object.freeze({x:-200,z:158,r:7,level:3.85});
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const oasisRadius=a=>OASIS.r*(1+.045*Math.sin(a*3+.4)+.025*Math.sin(a*7)+.03*Math.cos(a*2));
// Dry plants and props share the rendered water outline, including a root clearance.
export function oasisContainsWater(x,z,padding=0){
 const dx=x-OASIS.x,dz=z-OASIS.z,limit=OASIS.r*1.1+padding;
 if(Math.abs(dx)>limit||Math.abs(dz)>limit)return false;
 return Math.hypot(dx,dz)<oasisRadius(Math.atan2(dz,dx))+padding;
}
// The visible terrain and riding sampler both use this shallow basin.
export function oasisTerrainHeight(x,z,height){
 const dx=x-OASIS.x,dz=z-OASIS.z;
 if(dx*dx+dz*dz>(OASIS.r*1.82)**2)return height;
 const r=Math.hypot(dx,dz)/oasisRadius(Math.atan2(dz,dx));
 if(r>=1.65)return height;
 const bed=OASIS.level-.85+.74*smooth(.25,.97,r)+.36*smooth(.85,1.18,r);
 return height+(bed-height)*(1-smooth(1.15,1.65,r));
}
let palmModel;
async function loadPalmModel(){
 if(!palmModel)palmModel=import('./vendor/three/examples/jsm/loaders/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().loadAsync(new URL('./models/oasis/next_spring_palm.glb',import.meta.url).href));
 return palmModel;
}
export function createOasisPalms({THREE,groundH,x,z,radius,loadTextures=true,loadModel=loadTextures}){
 const group=createFallbackPalms({THREE,groundH,x,z,radius,loadTextures:loadTextures&&!loadModel});
 const state=group.userData.oasisPalms;state.source='original fallback';state.error=null;
 if(!loadModel){group.ready=Promise.resolve(group);return group;}
 for(let k=0;k<state.palms.length;k++){const p=state.palms[k];p.height=5.8+(Math.sin(k*4.71+2)+1)*.65;p.r=p.height*.09;}
 group.ready=loadPalmModel().then(asset=>{
  const source=asset.scene;source.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(source),height=bounds.max.y-bounds.min.y;
  if(!(height>0))throw Error('Palm model has no height');
  const pieces=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3();let triangles=0;
  source.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);geo.translate(0,-bounds.min.y,0);geo.scale(1/height,1/height,1/height);geo.computeBoundingBox();geo.computeBoundingSphere();
   const src=mesh.material,leaf=src.alphaTest>0;
   const mat=new THREE.MeshStandardMaterial({name:leaf?'Oasis | attributed palm fronds':'Oasis | attributed palm bark',map:src.map,color:leaf?'#b5c49c':'#cbb99e',alphaTest:src.alphaTest,side:THREE.DoubleSide,roughness:leaf?.86:.96,metalness:0,envMapIntensity:leaf?.6:.7});
   if(mat.map)mat.map.anisotropy=4;
   if(leaf){enableOpaqueFoliageCoverage(THREE,mat);mat.onBeforeCompile=(sh,renderer)=>patchFoliageCoverage(sh,renderer);mat.customProgramCacheKey=()=> 'oasis-leaves-opaque-1';}
   const inst=new THREE.InstancedMesh(geo,mat,state.palms.length);inst.name=leaf?'Oasis | palm fronds':'Oasis | palm trunks';inst.castShadow=true;inst.receiveShadow=true;
   state.palms.forEach((p,k)=>{pos.set(p.x-x,groundH(p.x,p.z)-groundH(x,z)-.045,p.z-z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),k*2.39996);scale.setScalar(p.height);matrix.compose(pos,q,scale);inst.setMatrixAt(k,matrix);});
   inst.instanceMatrix.needsUpdate=true;inst.computeBoundingBox();inst.computeBoundingSphere();pieces.push(inst);triangles+=(geo.index?geo.index.count:geo.attributes.position.count)/3*state.palms.length;
  });
  if(pieces.length!==3)throw Error('Palm model is missing a surface');
  for(const mesh of [...group.children]){group.remove(mesh);mesh.geometry?.dispose();mesh.material?.dispose();}
  group.add(...pieces);state.source='Next Spring / CC BY 4.0';state.triangles=triangles;state.draws=pieces.length;return group;
 }).catch(error=>{state.error=String(error.message||error);return group;});
 return group;
}

// Original feather-palm geometry. Each frond has a curved rachis and narrow,
// drooping leaflets; the seven established oasis sites stay in the same place.
function createFallbackPalms({THREE,groundH,x,z,radius,loadTextures=true}) {
  const group=new THREE.Group();group.name='Oasis | feather palms';
  const pos=[],uv=[],colors=[],indices=[],barkPos=[],barkUV=[],barkIndices=[];
  const color=new THREE.Color(),baseY=groundH(x,z),TAU=Math.PI*2;
  const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
  const palms=[];
  function leaf(a,b,c,tone){
    const n=pos.length/3;pos.push(...a,...b,...c);uv.push(0,0,.5,1,1,0);
    for(const shade of [.68,1,.85]){color.setHSL(.215+tone*.025,.47,.095*shade+tone*.023);colors.push(color.r,color.g,color.b);}
    indices.push(n,n+1,n+2);
  }
  for(let k=0;k<7;k++){
    const a=k/7*TAU,px=Math.cos(a)*(radius+1.6),pz=Math.sin(a)*(radius+1.6);
    const floor=groundH(x+px,z+pz)-baseY,h=4.1+hash(k,9)*.6,lean=.45+hash(k,6)*.22;
    const crown=[px+Math.cos(a)*lean,floor+h,pz+Math.sin(a)*lean];
    palms.push({x:x+px,z:z+pz,height:h,r:.21});
    const trunkStart=barkPos.length/3,rings=24,sides=10;
    for(let j=0;j<=rings;j++)for(let n=0;n<=sides;n++){
      const t=j/rings,theta=n/sides*TAU,r=(.195-.095*t)*(1+.035*Math.sin(t*95));
      barkPos.push(px+Math.cos(a)*lean*t*t+Math.cos(theta)*r,floor+h*t,pz+Math.sin(a)*lean*t*t+Math.sin(theta)*r);
      barkUV.push(n/sides*2,t*3.2);
      if(j<rings&&n<sides){const v=trunkStart+j*(sides+1)+n;barkIndices.push(v,v+sides+1,v+1,v+1,v+sides+1,v+sides+2);}
    }
    for(let f=0;f<11;f++){
      const yaw=f/11*TAU+k*.63,dx=Math.sin(yaw),dz=Math.cos(yaw),nx=dz,nz=-dx;
      const length=2.4+hash(k,f+23)*.75,rise=.85+hash(k,f+61)*.6;
      const at=t=>[crown[0]+dx*length*t,crown[1]+rise*Math.sin(t*Math.PI*.88)-1.05*t*t,crown[2]+dz*length*t];
      // The slim central spine is part of the leaf mesh, keeping all crowns one draw.
      for(let n=0;n<12;n++){
        const t=n/12,p=at(t),q=at((n+1)/12),w=.016*(1-t)+.003;
        leaf([p[0]-nx*w,p[1],p[2]-nz*w],q,[p[0]+nx*w,p[1],p[2]+nz*w],.55);
      }
      for(let n=0;n<30;n++)for(const side of [-1,1]){
        const t=.06+n/32,p=at(t),width=(.18+.62*Math.sin(t*Math.PI))*(.84+hash(k*71+f,n)*.24);
        const tip=[p[0]+nx*width*side+dx*.22,p[1]-.13-width*.34,p[2]+nz*width*side+dz*.22];
        const root=.017+.019*Math.sin(t*Math.PI),tone=hash(k*37+f,n);
        leaf([p[0]-dx*root,p[1],p[2]-dz*root],tip,[p[0]+dx*root,p[1]+.013,p[2]+dz*root],tone);
      }
    }
  }
  function geometry(p,u,index,c){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
    if(c)g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
  const leafMat=new THREE.MeshStandardMaterial({name:'Oasis | palm leaflets',vertexColors:true,side:THREE.DoubleSide,roughness:.85,envMapIntensity:.6});
  const barkMat=new THREE.MeshStandardMaterial({name:'Oasis | textured palm stems',color:'#baa88a',roughness:1,envMapIntensity:.5});
  if(loadTextures){
    const loader=new THREE.TextureLoader();
    const tex=(file,srgb=false)=>{const t=loader.load('./assets/textures/scanned/'+file);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
    barkMat.map=tex('pine_sapling_small_bark_diff.webp',true);barkMat.normalMap=tex('pine_sapling_small_bark_nor_gl.webp');barkMat.normalScale=new THREE.Vector2(.3,.3);
  }
  for(const mesh of [new THREE.Mesh(geometry(pos,uv,indices,colors),leafMat),new THREE.Mesh(geometry(barkPos,barkUV,barkIndices),barkMat)]){
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.oasisPalms={palms,triangles:(indices.length+barkIndices.length)/3};return group;
}

export function createOasisBank({THREE,groundH,x,z,radius,terrainStep=1000/512,loadTextures=true}) {
 // Copy the terrain's lattice and diagonal, avoiding a second triangulation
 // crossing above/below its faces on slopes. Fade wetness over the outer cells.
 const p=[],u=[],c=[],alpha=[],index=[],base=groundH(x,z),tint=new THREE.Color();
 const inner=new THREE.Color('#586951'),outer=new THREE.Color('#b4a38c');
 const x0=Math.floor((x-radius*1.6)/terrainStep)*terrainStep,z0=Math.floor((z-radius*1.6)/terrainStep)*terrainStep;
 const cols=Math.ceil((x+radius*1.6-x0)/terrainStep)+1,rows=Math.ceil((z+radius*1.6-z0)/terrainStep)+1;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const wx=x0+i*terrainStep,wz=z0+j*terrainStep,px=wx-x,pz=wz-z,r=Math.hypot(px,pz)/(oasisRadius(Math.atan2(pz,px))/OASIS.r*radius),t=smooth(.9,1.42,r);
  p.push(px,groundH(wx,wz)-base+.012,pz);u.push(wx/4,wz/4);tint.copy(inner).lerp(outer,t);c.push(tint.r,tint.g,tint.b);alpha.push((1-smooth(1.05,1.42,r))*smooth(.78,.92,r));
  if(j<rows-1&&i<cols-1){const v=j*cols+i;index.push(v,v+cols,v+1,v+1,v+cols,v+cols+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geo.setAttribute('shoreOpacity',new THREE.Float32BufferAttribute(alpha,1));geo.setIndex(index);geo.computeVertexNormals();geo.computeBoundingSphere();
 const mat=new THREE.MeshStandardMaterial({name:'Oasis | wet sand transition',vertexColors:true,roughness:.92,envMapIntensity:.5,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 mat.onBeforeCompile=sh=>{sh.vertexShader='attribute float shoreOpacity; varying float shoreFade;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshoreFade=shoreOpacity;');sh.fragmentShader='varying float shoreFade;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=shoreFade;\n#include <alphatest_fragment>');};
 mat.customProgramCacheKey=()=> 'oasis-shore-wetness-1';
 if(loadTextures){const t=new THREE.TextureLoader().load('./assets/textures/ground_dirt.jpg');t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;mat.map=t;}
 const bank=new THREE.Mesh(geo,mat);bank.name='Oasis | grounded shoreline';bank.receiveShadow=true;return bank;
}
export function createOasisWater({THREE,groundH,x,z,radius,waterMaterial}){
 const p=[0,0,0],uv=[0,0],colors=[],index=[],segments=96,rings=18,tint=new THREE.Color(),deep=new THREE.Color('#183f36'),shallow=new THREE.Color('#718966');
 colors.push(deep.r,deep.g,deep.b);
 for(let j=1;j<=rings;j++)for(let k=0;k<=segments;k++){
  const t=j/rings,a=k/segments*Math.PI*2,r=oasisRadius(a)/OASIS.r*radius*t;
  p.push(Math.cos(a)*r,0,Math.sin(a)*r);uv.push(k/segments,t);tint.copy(deep).lerp(shallow,smooth(.45,1,t));colors.push(tint.r,tint.g,tint.b);
  if(k<segments){const v=1+(j-1)*(segments+1)+k;if(j===1)index.push(0,v+1,v);if(j<rings)index.push(v,v+1,v+segments+1,v+1,v+segments+2,v+segments+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(index);geo.computeVertexNormals();geo.computeBoundingSphere();
 const mat=waterMaterial.clone();mat.name='Oasis | reflective spring';mat.map=null;mat.color.set(0xffffff);mat.vertexColors=true;mat.opacity=.96;mat.roughness=.15;mat.clearcoat=.35;
 mat.onBeforeCompile=(sh,renderer)=>{waterMaterial.userData.plainShader(sh,renderer);sh.fragmentShader=sh.fragmentShader.replace('edge*(.28+.58*fresnel)*localReflection','edge*(.18+.48*fresnel)*localReflection');sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.0-smoothstep(.86,1.0,waterBankUV.y);\n#include <alphatest_fragment>');};
 mat.customProgramCacheKey=()=> 'oasis-spring-water-1';
 const water=new THREE.Mesh(geo,mat);water.name='Oasis | spring water';water.position.y=OASIS.level-groundH(x,z);water.receiveShadow=true;water.renderOrder=2;return water;
}
