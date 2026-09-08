/* Botanical replacement meshes for the old sphere shrubs and solid cone pines.
   Shared prototypes keep repeated plants inexpensive. Each plant is two meshes:
   bark and alpha-tested leaves. Shapes and texture artwork are original. */
import { getFoliageTexture, tuneFoliage, onFoliageAtlasReady } from './world-art.js';

const TAU = Math.PI * 2;
const prototypes = new Map(), materials = new Map();
const random = seed => {
  let state = seed >>> 0 || 91;
  return () => {state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
};

function barkMaterial(THREE, birch) {
  const key = birch ? 'birch-bark' : 'bark';
  if (materials.has(key)) return materials.get(key);
  const canvas = document.createElement('canvas'); canvas.width=256;canvas.height=512;
  const c=canvas.getContext('2d'), r=random(birch?1463:824);
  c.fillStyle=birch?'#9e9c8f':'#655c4e';c.fillRect(0,0,256,512);
  for(let i=0;i<420;i++){
    const x=r()*256,w=.4+r()*2.3;
    c.strokeStyle=birch?`rgba(55,51,43,${.03+r()*.11})`:`rgba(28,25,22,${.08+r()*.2})`;
    c.lineWidth=w;c.beginPath();c.moveTo(x,0);
    c.bezierCurveTo(x+r()*10-5,170,x+r()*8-4,360,x+r()*7-3,512);c.stroke();
  }
  for(let i=0;i<(birch?110:34);i++){
    const x=r()*256,y=r()*512;
    c.fillStyle=birch?'rgba(50,48,39,.42)':'rgba(168,152,116,.16)';
    c.fillRect(x,y,2+r()*24,.7+r()*2.2);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
  const m=new THREE.MeshStandardMaterial({map:texture,roughness:1,vertexColors:true,color:0xc4c3b7});
  m.name=key;materials.set(key,m);return m;
}

function leafMaterial(THREE, species) {
  const key='leaves-'+species;if(materials.has(key))return materials.get(key);
  const m=new THREE.MeshStandardMaterial({map:getFoliageTexture(THREE,species),side:THREE.DoubleSide,
    roughness:1,vertexColors:true,alphaTest:.34,alphaToCoverage:true});
  m.userData.depthMat=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,
    map:m.map,alphaTest:.34,side:THREE.DoubleSide});
  tuneFoliage({THREE,material:m,species});m.name=key;materials.set(key,m);return m;
}

function geometryWriter(THREE) {
  const positions=[],normals=[],uvs=[],colors=[],indices=[];
  const vertex=(p,n,u,v,c)=>{
    positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uvs.push(u,v);
    colors.push(c,c,c);return positions.length/3-1;
  };
  const cylinder=(from,to,r0,r1,shade=1,sides=6)=>{
    const axis=to.clone().sub(from),length=axis.length();if(length<.01)return;axis.normalize();
    let right=new THREE.Vector3(0,1,0).cross(axis);
    if(right.lengthSq()<.001)right.set(1,0,0);right.normalize();
    const forward=axis.clone().cross(right).normalize();
    const base=positions.length/3;
    for(let ring=0;ring<2;ring++)for(let i=0;i<=sides;i++){
      const a=i/sides*TAU,n=right.clone().multiplyScalar(Math.cos(a)).addScaledVector(forward,Math.sin(a));
      const p=(ring?to:from).clone().addScaledVector(n,ring?r1:r0);
      vertex(p,n,i/sides,ring*length*.45,shade*(ring?.93:.8));
    }
    for(let i=0;i<sides;i++){const a=base+i,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
  };
  const card=(position,normal,width,height,spin,shade)=>{
    let right=new THREE.Vector3(0,1,0).cross(normal);
    if(right.lengthSq()<.001)right.set(1,0,0);right.normalize();
    const up=normal.clone().cross(right).normalize();
    const rr=right.clone().multiplyScalar(Math.cos(spin)).addScaledVector(up,Math.sin(spin));
    const uu=up.clone().multiplyScalar(Math.cos(spin)).addScaledVector(right,-Math.sin(spin));
    const base=positions.length/3;
    const coords=[[-.5,0],[.5,0],[.5,1],[-.5,1]];
    for(let i=0;i<4;i++){
      const [x,y]=coords[i];
      const p=position.clone().addScaledVector(rr,x*width).addScaledVector(uu,y*height)
        .addScaledVector(normal,y*(i===2?.09:-.04)*width);
      vertex(p,normal,x+.5,y,shade*(.89+.11*y));
    }
    indices.push(base,base+1,base+2,base,base+2,base+3);
  };
  const finish=()=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
    g.computeBoundingSphere();return g;
  };
  return {cylinder,card,finish};
}

function buildPrototype(THREE,type,species,variant) {
  const rng=random(8917+variant*7421+(type==='pine'?271:type==='shrub'?19:125));
  const wood=geometryWriter(THREE),leaves=geometryWriter(THREE);
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  if(type==='pine'){
    const height=5.0+rng()*1.4,leanX=(rng()-.5)*.32,leanZ=(rng()-.5)*.28;
    let last=V(0,0,0);
    for(let i=1;i<=9;i++){
      const t=i/9,p=V(leanX*t*t,height*t,leanZ*t*t);
      wood.cylinder(last,p,.13*(1-(i-1)/10),.13*(1-i/10),.94,8);last=p;
    }
    for(let tier=0;tier<10;tier++){
      const t=tier/10,y=.9+t*(height-.95),radius=(1-t)**.86*(1.48+rng()*.44);
      const count=4+(tier%3===0?1:0);
      for(let j=0;j<count;j++){
        const a=j/count*TAU+tier*2.399+variant*.8+(rng()-.5)*.35;
        const r=radius*(.78+rng()*.35),start=V(leanX*t,y,leanZ*t);
        const tip=V(Math.cos(a)*r+leanX*t,y-.22+rng()*.19,Math.sin(a)*r+leanZ*t);
        wood.cylinder(start,tip,.037*(1-t)+.008,.006,.78+rng()*.14);
        for(let k=1;k<=4;k++){
          const f=k/4,p=start.clone().lerp(tip,f);p.y+=(rng()-.5)*.26;
          const n=V(Math.cos(a)*.7,.32+rng()*.5,Math.sin(a)*.7).normalize();
          const size=(.45+rng()*.15)*(1-t*.65);
          leaves.card(p,n,size*1.4,size,a+(rng()-.5)*.5,.64+.26*f+.1*t);
          if(k>1){const side=V(-Math.sin(a),.2,Math.cos(a));
            const twig=p.clone().addScaledVector(side,(k%2?-1:1)*size*.3);
            wood.cylinder(p,twig,.01,.004,.85);
            leaves.card(twig,n,size,size*.9,a+(k%2?1:-1)*.5,.72+.2*f);
          }
        }
      }
    }
    for(let k=0;k<7;k++){
      const a=k/7*TAU,p=V(leanX,height-.25+rng()*.16,leanZ);
      const n=V(Math.cos(a)*.65,.6,Math.sin(a)*.65).normalize();
      leaves.card(p,n,.26,.39,a,.88+rng()*.1);
    }
  }else if(type==='shrub'){
    const count=7+variant;
    for(let b=0;b<count;b++){
      const a=b/count*TAU+variant*.73,spread=.45+rng()*.53,height=.72+rng()*.55;
      const start=V((rng()-.5)*.18,.02,(rng()-.5)*.18),mid=V(Math.cos(a)*spread*.65,height*.5,Math.sin(a)*spread*.65);
      const tip=V(Math.cos(a)*spread,height,Math.sin(a)*spread);
      wood.cylinder(start,mid,.035,.018,.8);wood.cylinder(mid,tip,.018,.006,.95);
      for(let k=0;k<8;k++){
        const t=.15+k/9,p=mid.clone().lerp(tip,t);
        p.x+=(rng()-.5)*.44;p.z+=(rng()-.5)*.44;
        const n=V(Math.cos(a)*.5,.3+rng()*.7,Math.sin(a)*.5).normalize();
        leaves.card(p,n,.52+rng()*.18,.49+rng()*.2,rng()*TAU,.65+rng()*.27);
      }
    }
  }else{
    const birch=species==='birch',height=(birch?5.0:4.3)+rng()*.9;
    const leanX=(rng()-.5)*.5,leanZ=(rng()-.5)*.5;
    const root=V(0,0,0),fork=V(leanX*.25,height*.34,leanZ*.25);
    wood.cylinder(root,fork,birch?.12:.19,birch?.074:.13,.94,8);
    for(let b=0;b<8;b++){
      const a=b*2.39996+variant*.9,h=height*(.62+rng()*.3),r=(birch?1.05:1.65)*(.7+rng()*.4);
      const start=fork.clone().add(V(leanX*.2,b*.055,leanZ*.2));
      const mid=V(Math.cos(a)*r*.52+leanX,h*.77,Math.sin(a)*r*.52+leanZ);
      const tip=V(Math.cos(a)*r+leanX,h,Math.sin(a)*r+leanZ);
      wood.cylinder(start,mid,.073,.037,.83,7);wood.cylinder(mid,tip,.037,.012,.91);
      for(let k=0;k<10;k++){
        const t=.1+k*.085,p=mid.clone().lerp(tip,t);
        const twig=p.clone().add(V((rng()-.5)*1.0,rng()*.45,(rng()-.5)*1.0));
        wood.cylinder(p,twig,.009,.003,.92);
        const n=V(twig.x-leanX,.55+rng()*.4,twig.z-leanZ).normalize();
        const size=(birch?.65:.76)*(1+rng()*.2);
        leaves.card(twig,n,size,size*1.12,rng()*TAU,.70+rng()*.25);
        if(k%3===0)leaves.card(twig.clone().add(V(.17,.12,-.13)),n,size*.84,size,rng()*TAU,.83);
      }
    }
  }
  return {wood:wood.finish(),leaves:leaves.finish()};
}

function makePlant({THREE,type,species,scale=1,seed=1}) {
  const variant=Math.abs(seed|0)%4,key=`${type}:${species}:${variant}`;
  if(!prototypes.has(key))prototypes.set(key,buildPrototype(THREE,type,species,variant));
  const geometry=prototypes.get(key),g=new THREE.Group();
  g.name=`Natural ${species} ${type}`;
  const trunk=new THREE.Mesh(geometry.wood,barkMaterial(THREE,species==='birch'));
  trunk.castShadow=true;trunk.receiveShadow=true;g.add(trunk);
  const foliage=new THREE.Mesh(geometry.leaves,leafMaterial(THREE,species));
  foliage.castShadow=true;foliage.receiveShadow=true;
  foliage.customDepthMaterial=foliage.material.userData.depthMat;
  g.add(foliage);g.scale.setScalar(scale);return g;
}

export function makeNaturalPine(options){return makePlant({...options,type:'pine',species:options.species||'pine'});}
export function makeNaturalShrub(options){return makePlant({...options,type:'shrub',species:options.flowering?'blossom':options.species||'oak'});}
export function makeNaturalTree(options){return makePlant({...options,type:'tree',species:options.species||'oak'});}

export function plantNaturalShrubs({THREE,scene,placements,groundH,flowering=false}) {
  // Replacement for the old generated opaque sphere shrubs, using exactly the
  // caller's placements. The two instanced draws add no new scattered objects.
  const species=flowering?'blossom':'oak';
  const made=[];
  for(let variant=0;variant<4;variant++){
    const group=placements.filter((_,i)=>i%4===variant);if(!group.length)continue;
    const key=`shrub:${species}:${variant}`;
    if(!prototypes.has(key))prototypes.set(key,buildPrototype(THREE,'shrub',species,variant));
    const geo=prototypes.get(key),mat=leafMaterial(THREE,species);
    const wood=new THREE.InstancedMesh(geo.wood,barkMaterial(THREE,false),group.length);
    const leaf=new THREE.InstancedMesh(geo.leaves,mat,group.length);
    leaf.customDepthMaterial=mat.userData.depthMat;
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    group.forEach((pt,i)=>{
      p.set(pt.x,groundH(pt.x,pt.z)-.06,pt.z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),pt.r||0);
      const size=(pt.s||1)*(flowering?1.02:1.12);s.set(size,size*(.8+(i%5)*.06),size);
      m.compose(p,q,s);wood.setMatrixAt(i,m);leaf.setMatrixAt(i,m);
    });
    for(const mesh of [wood,leaf]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);made.push(mesh);}
  }
  return made;
}

const impostors = new WeakMap();
export function createForestImpostor({THREE,renderer,species='oak'}) {
  // Bake the same botanical models used beside the trail into a distant forest
  // card. Thousands of distant trees still cost only the caller's instanced draw.
  if(!impostors.has(renderer))impostors.set(renderer,new Map());
  const cache=impostors.get(renderer);
  if(cache.has(species))return cache.get(species);
  const pine=species==='pine'||species==='snowpine';
  const scene=new THREE.Scene(),cluster=new THREE.Group();scene.add(cluster);
  const placements=pine?[[-1.0,0,-.2,.76],[.86,0,-.5,.85],[0,0,.3,1]]:
    [[-1.15,0,-.3,.77],[1.08,0,-.4,.83],[0,0,.3,1]];
  placements.forEach(([x,y,z,scale],i)=>{
    const tree=(pine?makeNaturalPine:makeNaturalTree)({THREE,species,scale,seed:i+1});
    tree.position.set(x,y,z);tree.rotation.y=i*1.77;
    tree.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=false;}});
    cluster.add(tree);
  });
  scene.add(new THREE.HemisphereLight('#e6f0f7','#a3aa88',1.75));
  const sun=new THREE.DirectionalLight('#fff5e8',1.7);sun.position.set(-4,9,7);scene.add(sun);
  cluster.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(cluster),size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3()),span=Math.max(size.x,size.y)*1.10;
  const camera=new THREE.OrthographicCamera(-span/2,span/2,span/2,-span/2,.1,60);
  camera.position.set(center.x,center.y,24);camera.lookAt(center.x,center.y,0);
  const target=new THREE.WebGLRenderTarget(512,512,{
    format:THREE.RGBAFormat,type:THREE.UnsignedByteType,
    minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,
    generateMipmaps:true,depthBuffer:true,stencilBuffer:false,samples:4
  });
  const texture=target.texture;
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  texture.name=`Botanical ${species} forest silhouette`;
  texture.userData.impostorAspect=size.x/size.y;
  cache.set(species,texture);
  let disposed=false,timer;
  const bake=()=>{
    if(disposed)return;
    const state={target:renderer.getRenderTarget(),
      cubeFace:renderer.getActiveCubeFace(),mipLevel:renderer.getActiveMipmapLevel(),
      clearColor:renderer.getClearColor(new THREE.Color()),clearAlpha:renderer.getClearAlpha(),
      viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),
      scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,
      toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,
      outputColorSpace:renderer.outputColorSpace,shadows:renderer.shadowMap.enabled,xr:renderer.xr.enabled,
      info:{...renderer.info.render}};
    try{
      renderer.xr.enabled=false;renderer.shadowMap.enabled=false;renderer.autoClear=true;
      renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
      renderer.setRenderTarget(target);renderer.setScissorTest(false);
      renderer.setViewport(0,0,512,512);renderer.setClearColor(0x000000,0);
      renderer.clear(true,true,true);renderer.render(scene,camera);
      texture.userData.bakeCount=(texture.userData.bakeCount||0)+1;
    }finally{
      renderer.setRenderTarget(state.target,state.cubeFace,state.mipLevel);
      renderer.setClearColor(state.clearColor,state.clearAlpha);renderer.autoClear=state.autoClear;
      renderer.toneMapping=state.toneMapping;renderer.toneMappingExposure=state.exposure;
      renderer.outputColorSpace=state.outputColorSpace;
      renderer.shadowMap.enabled=state.shadows;renderer.xr.enabled=state.xr;
      renderer.setViewport(state.viewport);renderer.setScissor(state.scissor);
      renderer.setScissorTest(state.scissorTest);
      Object.assign(renderer.info.render,state.info);
    }
  };
  bake();
  const unsubscribe=onFoliageAtlasReady(targets=>{
    if(targets.includes(species)){clearTimeout(timer);bake();}
  });
  timer=setTimeout(bake,3000);
  texture.userData.disposeImpostor=()=>{
    disposed=true;clearTimeout(timer);unsubscribe();cache.delete(species);target.dispose();
    // Prototypes and leaf materials are shared with the live forest.
    cluster.clear();scene.clear();
  };
  return texture;
}
