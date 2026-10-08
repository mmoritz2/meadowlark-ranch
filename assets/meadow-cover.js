import {coyoteCoverDryWeight} from './biome-weights.mjs?v=dry-foothills-1';
import {meadowGrazingAt,westMeadowSwardAt,WEST_MEADOW_SWARD_RECOVERY} from './pastoral-fields.mjs?v=west-meadow-sward-1';

// Curved ribbon leaves: narrow roots, a fuller lower blade, and a curling tip.
// The nearby tuft has eight leaves and forty triangles. Middle-distance tufts
// retain two segments, where the extra curvature is smaller than a pixel.
export function createGrassTuftGeometry(THREE,{bladeCount=8,segments=3}={}) {
  const P=[],N=[],C=[],U=[],I=[];
  for(let blade=0;blade<bladeCount;blade++) {
    const a=blade*2.39996,spread=.018+(blade%5)*.029;
    const ca=Math.cos(a),sa=Math.sin(a),ox=ca*spread,oz=sa*spread;
    const tall=blade%3!==1,h=tall?.56+(blade%4)*.080:.29+(blade%3)*.045;
    const bend=tall?.14+(blade%3)*.055:.26+(blade%3)*.05,width=.011+(blade%4)*.0023;
    const base=P.length/3,twist=(blade%2?1:-1)*(.25+(blade%3)*.12);
    for(let j=0;j<=segments;j++) {
      const t=j/segments,tip=j===segments,lean=bend*t*t,drop=(tall?.12:.28)*t*t*t;
      const heading=a+twist*t,sideX=-Math.sin(heading),sideZ=Math.cos(heading);
      const half=width*(.52+.78*Math.sin(Math.PI*t*.88))*Math.pow(1-t,.72);
      const tangent=new THREE.Vector3(ca*2*bend*t,h*(1-3*(tall?.12:.28)*t*t),sa*2*bend*t).normalize();
      const normal=new THREE.Vector3(sideX,0,sideZ).cross(tangent).normalize();
      if(normal.y<0)normal.negate();normal.lerp(new THREE.Vector3(0,1,0),.68).normalize();
      for(const side of tip?[0]:[-1,1]) {
        P.push(ox+ca*lean+sideX*half*side,h*(t-drop),oz+sa*lean+sideZ*half*side);
        N.push(normal.x,normal.y,normal.z);
        const shade=.57+.43*Math.sin(t*Math.PI*.5),dry=blade%11===0;
        C.push(shade*(dry?1.02:.90),shade*(dry?.96:1),shade*(dry?.57:.73));U.push((side+1)/2,t);
      }
      if(j<segments-1){const k=base+j*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
      else if(j===segments-1){const k=base+j*2;I.push(k,k+1,k+2);}
    }
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
  const grazing=meadowGrazingAt(x,z),sward=westMeadowSwardAt(x,z);
  const grazed=sward===0?grazing:grazing*(1-WEST_MEADOW_SWARD_RECOVERY*sward);
  return ((.42+stand*.95)*(1-grazed)+(.23+stand*.33)*grazed)*(1-coyoteCoverDryWeight(x,z)*.38);
}

// One palette for the near leaves, distant sward and old seed layer. Separate
// green and golden stands give fields variation without random colour speckles.
export function meadowBladeColor(color,x,z,variation=.5){
  const patch=fieldPatch(x/18+8.7,z/18-3.1);
  const dry=Math.max(0,Math.min(1,(fieldPatch(x/24-7.4,z/24+6.8)-.42)*3.5))*(1-meadowGrazingAt(x,z)*.85);
  const arid=coyoteCoverDryWeight(x,z);
  return color.setHSL(.225+patch*.029-dry*.075-arid*.105,.55+variation*.08-dry*.08-arid*.11,.15+variation*.035+dry*.055+arid*.07);
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
  const flowerStart=P.length/3,cupNormals=[],pitch=.28,cp=Math.cos(pitch),sp=Math.sin(pitch);
  const rim=[[0,-1],[Math.sqrt(3)/2,-.5],[Math.sqrt(3)/2,.5],[0,1],[-Math.sqrt(3)/2,.5],[-Math.sqrt(3)/2,-.5]];
  const purple=['#a967d1','#9252c3','#d6a3ec','#e1b8f1'].map(hex=>{color.set(hex);return [color.r,color.g,color.b];});
  for(let ring=0;ring<9;ring++)for(let flower=0;flower<3;flower++){
    const t=ring/9,a=flower*Math.PI*2/3+ring*1.23,y=.33+t*.44,scale=1-t*.72;
    const c=Math.cos(a),s=Math.sin(a),width=.053*scale,height=.042*scale,depth=.008*scale,radial=.045*scale;
    // The rear lip touches the actual tapered pentagonal stalk. A linear
    // reach term tilts the shallow bowl without another pedicel triangle.
    const sector=Math.PI*2/5,delta=((a%sector)+sector)%sector-sector/2;
    const stemShape=Math.cos(Math.PI/5)/Math.cos(delta),taper=.008/.78;
    const reach=(radial-height*sp+depth*cp-.012*stemShape
      +stemShape*taper*(y+height*cp+depth*sp))/(cp+stemShape*taper*sp);
    const attachY=y+height*cp+(depth-reach)*sp,bx=.028*attachY/.78;
    const side=[s,0,-c],vertical=[-c*sp,cp,-s*sp],outward=[c*cp,sp,s*cp];
    const base=P.length/3,baseColor=purple[ring%2];
    for(const [ru,rv] of [[0,0],...rim]){
      const u=ru*width,v=rv*height;
      const d=depth*(ru*ru+rv*rv)-reach*rv;
      P.push(bx+c*radial+side[0]*u+vertical[0]*v+outward[0]*d,
        y+vertical[1]*v+outward[1]*d,
        s*radial+side[2]*u+vertical[2]*v+outward[2]*d);
      // Derivatives of the same bowl/reach surface give smooth normals.
      const du=2*depth*u/(width*width),dv=2*depth*v/(height*height)-reach/height;
      const nx=outward[0]-side[0]*du-vertical[0]*dv,ny=outward[1]-vertical[1]*dv,nz=outward[2]-side[2]*du-vertical[2]*dv;
      const inv=1/Math.hypot(nx,ny,nz);cupNormals.push(nx*inv,ny*inv,nz*inv);
      const lip=(1-rv)*.38,highlight=purple[ru<0?2:3];
      C.push(...baseColor.map((v,k)=>v+(highlight[k]-v)*lip));
    }
    for(let k=0;k<6;k++)I.push(base,base+1+k,base+1+(k+1)%6);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();
  g.attributes.normal.array.set(cupNormals,flowerStart*3);
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// A bounded ring carries pasture silhouettes into the middle distance. Slots
// only rebuild when a 12 m cell enters the ring; no extra work per grass blade
// on normal frames. Positions are keyed by world cell, so riding back is stable.
export function createMeadowDistance({THREE,scene,canGrow,heightAt,managedAt,low=false,getQuality=()=>low?'low':'high'}){
  const CELL=12,W=18,K=low?48:120;
  const hash=(x,z)=>{let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const geometries={low:createGrassTuftGeometry(THREE,{bladeCount:4,segments:2}),medium:createGrassTuftGeometry(THREE,{bladeCount:6,segments:2}),high:createGrassTuftGeometry(THREE,{bladeCount:8,segments:2})};
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
