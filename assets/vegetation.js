/* Botanical replacement meshes for the old sphere shrubs and solid cone pines.
   Shared prototypes keep repeated plants inexpensive. Each plant is two meshes:
   bark and alpha-tested leaves. Shapes and texture artwork are original. */
import { getFoliageTexture, tuneFoliage } from './world-art.js?v=world-cinematic-1';
import {partitionStaticInstances} from './spatial-instances.js';

const TAU = Math.PI * 2;
const prototypes = new Map(), materials = new Map();
const random = seed => {
  let state = seed >>> 0 || 91;
  return () => {state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
};

function barkMaterial(THREE, birch) {
  const key = birch ? 'birch-bark' : 'bark';
  if (materials.has(key)) return materials.get(key);
  if(!birch){
    const loader=new THREE.TextureLoader(),load=(kind,color=false)=>{const t=loader.load('assets/textures/scanned/pine_sapling_small_bark_'+kind+'.webp');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;};
    const m=new THREE.MeshStandardMaterial({name:key,map:load('diff',true),normalMap:load('nor_gl'),roughnessMap:load('rough'),normalScale:new THREE.Vector2(.65,.65),roughness:1,vertexColors:true,color:'#d8d1bf'});materials.set(key,m);return m;
  }
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
    const height=5.2+rng()*1.2,leanX=(rng()-.5)*.40,leanZ=(rng()-.5)*.35;
    let last=V(0,0,0);
    for(let i=1;i<=11;i++){const t=i/11,p=V(leanX*t*t,height*t,leanZ*t*t);
      wood.cylinder(last,p,(i===1?.21:.145)*(1-(i-1)/12),.145*(1-i/12),.94,9);last=p;}
    for(let i=0;i<5;i++){const a=i*2.399;wood.cylinder(V(Math.cos(a)*.37,-.04,Math.sin(a)*.37),V(0,.36,0),.08,.055,.83);}
    for(let tier=0;tier<12;tier++){
      const t=tier/12,y=.68+t*(height-.78),radius=(1-t)**.83*(1.65+rng()*.48);
      const count=3+tier%3;
      for(let j=0;j<count;j++){
        const a=j/count*TAU+tier*2.399+variant*.8+(rng()-.5)*.8,r=radius*(.65+rng()*.44);
        const start=V(leanX*t,y+(rng()-.5)*.25,leanZ*t),mid=V(Math.cos(a)*r*.50+leanX*t,y-.23,Math.sin(a)*r*.50+leanZ*t);
        const tip=V(Math.cos(a)*r+leanX*t,y-.13+rng()*.27,Math.sin(a)*r+leanZ*t);
        wood.cylinder(start,mid,.043*(1-t)+.007,.020*(1-t)+.004,.76);wood.cylinder(mid,tip,.02*(1-t)+.004,.003,.89);
        for(let k=1;k<=6;k++){
          const f=k/6,p=k<3?start.clone().lerp(mid,f*2):mid.clone().lerp(tip,(f-.33)/.67);
          for(const side of[-1,1]){
            const size=(.28+rng()*.13)*(1-t*.52),twig=p.clone().add(V(-Math.sin(a)*side*size*.7,.07+rng()*.10,Math.cos(a)*side*size*.7));
            wood.cylinder(p,twig,.009*(1-t)+.002,.002,.84);
            const n=V(Math.cos(a)*.35,.7+rng()*.3,Math.sin(a)*.35).normalize();
            leaves.card(twig,n,size*1.5,size*1.55,a+side*.63+(rng()-.5)*.35,.63+.24*f+.08*t);
          }
        }
      }
    }
    for(let k=0;k<6;k++){const a=k/6*TAU,p=V(leanX,height-.14+rng()*.10,leanZ);leaves.card(p,V(Math.cos(a)*.55,.7,Math.sin(a)*.55).normalize(),.21,.36,a,.93);}
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

export function plantNaturalPines({THREE,scene,placements,groundH,species='pine'}){
  const made=[],m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let v=0;v<4;v++){
    const rows=placements.filter((_,i)=>i%4===v);if(!rows.length)continue;
    const source=makeNaturalPine({THREE,species,seed:v});
    for(const part of source.children){const mesh=new THREE.InstancedMesh(part.geometry,part.material,rows.length);mesh.name='Natural '+species+' saplings';mesh.customDepthMaterial=part.customDepthMaterial;
      rows.forEach((pt,i)=>{p.set(pt.x,groundH(pt.x,pt.z)-.03,pt.z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),pt.r);scale.setScalar(pt.s);m.compose(p,q,scale);mesh.setMatrixAt(i,m);});
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);made.push(mesh);}
  }return made;
}

// Seed clusters share scanned bark/needle geometry, then split into spatial
// cells for camera/shadow culling. Every authored sapling remains at full detail.
export function plantScannedSaplings({THREE,scene,template,placements,groundH}){
  const made=[],center=placements.reduce((a,p)=>({x:a.x+p.x/placements.length,z:a.z+p.z/placements.length}),{x:0,z:0});
  template.updateMatrixWorld(true);
  template.traverse(part=>{if(!part.isMesh)return;
    const geo=part.geometry.clone().applyMatrix4(part.matrixWorld);
    for(let c=0;c<4;c++){
      const rows=placements.filter(p=>(p.x>center.x?1:0)+(p.z>center.z?2:0)===c);if(!rows.length)continue;
      const mesh=new THREE.InstancedMesh(geo,part.material,rows.length),m=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
      rows.forEach((p,i)=>{v.set(p.x,groundH(p.x,p.z)-.025,p.z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),p.r);scale.setScalar(p.s*2);m.compose(v,q,scale);mesh.setMatrixAt(i,m);});
      mesh.name='Frostpine | scanned saplings';mesh.castShadow=true;mesh.receiveShadow=true;
      const cells=partitionStaticInstances(THREE,mesh);scene.add(...cells);made.push(...cells);mesh.dispose();
    }
  });return made;
}
