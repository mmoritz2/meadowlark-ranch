import {meadowGrazingAt} from './pastoral-fields.mjs?v=leafy-orchard-1';

// Tapered meadow leaves with softer root shading and varied, bending tips.
// Three triangles per leaf keep the travelling cover within its existing budget.
export function createGrassTuftGeometry(THREE,{bladeCount=12}={}) {
  const P=[],N=[],C=[],U=[],I=[];
  for(let blade=0;blade<bladeCount;blade++) {
    const a=blade*2.39996,spread=.035+(blade%6)*.045;
    const ox=Math.cos(a)*spread,oz=Math.sin(a)*spread;
    const tall=blade%3!==1,h=tall?.60+(blade%4)*.085:.24+(blade%5)*.034;
    const bend=tall?.21+(blade%3)*.040:.26+(blade%3)*.035,width=.016+(blade%4)*.003;
    const ca=Math.cos(a),sa=Math.sin(a),base=P.length/3;
    for(const t of [0,.55,1])for(const side of t===1?[0]:[-1,1]){
      const w=width*(1-t*.80)*side;
      P.push(ox+ca*bend*t*t-sa*w,h*t*(1-.14*t),oz+sa*bend*t*t+ca*w);
      N.push(ca*.32,.895,sa*.32);
      const shade=.40+t*.60,dry=blade%13===0;
      C.push(shade*(dry?1.06:.83),shade*(dry?.94:1),shade*(dry?.48:.62));U.push((side+1)/2,t);
    }
    I.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// Smooth world-space patches cross cell and LOD boundaries without stripes or
// resampling when the rider returns. Height and ripeness use separate fields.
function fieldPatch(x,z){
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const hash=(a,b)=>{let h=Math.imul(a,374761393)^Math.imul(b,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
export function meadowGrowthAt(x,z){
  const stand=.65*fieldPatch(x/11+3.4,z/11-8.2)+.35*fieldPatch(x/29-5.1,z/29+2.7);
  const grazed=meadowGrazingAt(x,z);
  return (.42+stand*.95)*(1-grazed)+(.23+stand*.33)*grazed;
}

// One palette for the near leaves, distant sward and old seed layer. Separate
// green and golden stands give fields variation without random colour speckles.
export function meadowBladeColor(color,x,z,variation=.5){
  const patch=fieldPatch(x/18+8.7,z/18-3.1);
  const dry=Math.max(0,Math.min(1,(fieldPatch(x/24-7.4,z/24+6.8)-.42)*3.5))*(1-meadowGrazingAt(x,z)*.85);
  return color.setHSL(.225+patch*.029-dry*.075,.55+variation*.08-dry*.08,.15+variation*.035+dry*.055);
}

// Fully modelled lupin: palmate foliage and a spiral of cupped pea flowers.
// 146 triangles per stalk; no alpha cards or flower-coloured green stems.
export function createLupinGeometry(THREE){
  const P=[],C=[],I=[];
  const color=new THREE.Color();
  function face(points,hex){
    const b=P.length/3;color.set(hex);
    for(const p of points){P.push(...p);C.push(color.r,color.g,color.b);}
    I.push(b,b+1,b+2);if(points.length===4)I.push(b,b+2,b+3);
  }
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,b=(i+1)*Math.PI*2/5;
    face([[Math.cos(a)*.012,0,Math.sin(a)*.012],[Math.cos(b)*.012,0,Math.sin(b)*.012],
      [Math.cos(b)*.004+.028,.78,Math.sin(b)*.004],[Math.cos(a)*.004+.028,.78,Math.sin(a)*.004]],'#518137');
  }
  for(let leaf=0;leaf<14;leaf++){
    const a=leaf*2.39996,y=.055+(leaf%3)*.060,len=.12+(leaf%4)*.018;
    const c=Math.cos(a),s=Math.sin(a),w=.028;
    face([[0,y,0],[c*len*.60-s*w,y+.03,s*len*.60+c*w],[c*len,y+.10,s*len],
      [c*len*.60+s*w,y+.05,s*len*.60-c*w]],leaf%2?'#648e3e':'#83a852');
  }
  for(let ring=0;ring<9;ring++)for(let petal=0;petal<3;petal++){
    const t=ring/9,a=petal*Math.PI*2/3+ring*1.23,y=.33+t*.44;
    const r=.105*(1-t*.72),c=Math.cos(a),s=Math.sin(a),bx=.028*y/.78;
    const base=[bx+c*.009,y-.012,s*.009],tip=[bx+c*r,y+.025,s*r];
    const left=[bx+c*r*.63-s*r*.52,y-.008,s*r*.63+c*r*.52];
    const right=[bx+c*r*.63+s*r*.52,y-.008,s*r*.63-c*r*.52];
    const ridge=[bx+c*r*.57,y+.017,s*r*.57];
    face([base,left,ridge],ring%2?'#9252c3':'#a967d1');
    face([left,tip,ridge],'#d6a3ec');face([tip,right,ridge],'#e1b8f1');face([right,base,ridge],'#b875d8');
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// A bounded ring carries pasture silhouettes into the middle distance. Slots
// only rebuild when a 12 m cell enters the ring; no extra work per grass blade
// on normal frames. Positions are keyed by world cell, so riding back is stable.
export function createMeadowDistance({THREE,scene,canGrow,heightAt,managedAt,low=false,getQuality=()=>low?'low':'high'}){
  const CELL=12,W=18,K=low?48:120;
  const hash=(x,z)=>{let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const geometries={low:createGrassTuftGeometry(THREE,{bladeCount:4}),medium:createGrassTuftGeometry(THREE,{bladeCount:6}),high:createGrassTuftGeometry(THREE,{bladeCount:8})};
  const geo=geometries[getQuality()]||geometries.high;
  const mat=new THREE.MeshStandardMaterial({name:'Middle distance meadow',vertexColors:true,side:THREE.DoubleSide,roughness:1,envMapIntensity:.7});
  const uniforms={fieldTime:{value:0},fieldRider:{value:new THREE.Vector2()}};
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader='uniform float fieldTime; uniform vec2 fieldRider;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip=instanceMatrix[3].xz;float distanceToRider=distance(ip,fieldRider);
        float grow=smoothstep(15.0,29.0,distanceToRider)*(1.0-smoothstep(78.0,102.0,distanceToRider));
        transformed*=grow;
        transformed.x+=sin(fieldTime*1.2+ip.x*.3+ip.y*.16)*transformed.y*.15;
      #endif`);
  };
  mat.customProgramCacheKey=()=> 'middle-meadow-v2';
  const mesh=new THREE.InstancedMesh(geo,mat,W*W*K);mesh.name='Middle distance pasture';
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;scene.add(mesh);
  const slots=new Array(W*W),matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),color=new THREE.Color();
  let cx=Infinity,cz=Infinity;
  return {mesh,invalidate(){cx=cz=Infinity;slots.fill(undefined);},tick(time,x,z){
    mesh.geometry=geometries[getQuality()]||geometries.high;
    uniforms.fieldTime.value=time;uniforms.fieldRider.value.set(x,z);
    const nx=Math.floor(x/CELL),nz=Math.floor(z/CELL);if(nx===cx&&nz===cz)return;cx=nx;cz=nz;
    for(let dz=-W/2;dz<W/2;dz++)for(let dx=-W/2;dx<W/2;dx++){
      const ix=cx+dx,iz=cz+dz,slot=((ix%W+W)%W)+((iz%W+W)%W)*W,key=ix+','+iz;
      if(slots[slot]===key)continue;slots[slot]=key;
      for(let k=0;k<K;k++){
        const a=hash(ix*137+k*11,iz*73+k*31),b=hash(ix*59+k*23,iz*151+k*7),c=hash(ix+k*19,iz-k*17);
        const px=(ix+a)*CELL,pz=(iz+b)*CELL,id=slot*K+k;
        pos.set(px,0,pz);q.setFromAxisAngle(up,c*Math.PI);
        if(canGrow(px,pz)){const trim=1-.67*managedAt(px,pz),growth=meadowGrowthAt(px,pz),spread=(2.1+c*.6)*(.55+.45*growth);pos.y=heightAt(px,pz)-.03;scale.set(spread,trim*growth*(.9+b*.2),spread);}
        else scale.setScalar(0);
        matrix.compose(pos,q,scale);mesh.setMatrixAt(id,matrix);meadowBladeColor(color,px,pz,c);mesh.setColorAt(id,color);
      }
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  }};
}
