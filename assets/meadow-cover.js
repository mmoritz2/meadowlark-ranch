import {createLushMeadowGeometry} from './lush-meadow-geometry.mjs?v=world-cohesion-1';
import {northPastureAt} from './north-pasture.mjs?v=north-pasture-2';
import {installPastureLighting} from './pasture-lighting.mjs?v=grass-volume-1';
import {coyoteCoverDryWeight} from './biome-weights.mjs?v=dry-foothills-1';
import {meadowGrazingAt,meadowSwardGrazingAt} from './pastoral-fields.mjs?v=world-cohesion-1';
import {fieldSwardAt,FIELD_SWARD_HEIGHT_BOOST} from './field-sward-bands.mjs?v=field-sward-bands-3';

// Middle-distance long blades match the nearby upright stand. Four/six/eight
// three-triangle ribbons preserve the existing 12/18/24-triangle tier budgets.
function createMiddleCoverGeometry(THREE,bladeCount) {
 return createLushMeadowGeometry(THREE,{leafCount:bladeCount,segments:2,profile:'middle'});
}

// Curved ribbon leaves: narrow roots, a fuller lower blade, and a curling tip.
// The nearby tuft has eight leaves and forty triangles. Middle-distance tufts
// retain two segments, where the extra curvature is smaller than a pixel.
export function createGrassTuftGeometry(THREE,{bladeCount=8,segments=3,profile='legacy'}={}) {
  if(profile==='middle-natural-v1'&&segments===2&&[4,6,8].includes(bladeCount))return createMiddleCoverGeometry(THREE,bladeCount);
  if(profile==='near-folded-v1'&&bladeCount===8&&segments===3)return createLushMeadowGeometry(THREE,{leafCount:8,segments:3,profile:'near'});
  const P=[],N=[],C=[],U=[],I=[];
  const foldedNear=profile==='near-folded-v1'&&bladeCount===8&&segments===3;
  const structured=foldedNear||profile==='middle-natural-v1';
  for(let blade=0;blade<bladeCount;blade++) {
    const a=blade*2.39996,spread=structured?.014+(blade%5)*.017:.018+(blade%5)*.029;
    const ca=Math.cos(a),sa=Math.sin(a),ox=ca*spread,oz=sa*spread;
    const tall=structured?blade===1||blade===5:blade%3!==1;
    const h=structured?[.34,.63,.29,.47,.38,.71,.26,.51][blade%8]:(tall?.56+(blade%4)*.080:.29+(blade%3)*.045);
    const bend=structured?[.23,.18,.29,.26,.25,.21,.27,.30][blade%8]:(tall?.14+(blade%3)*.055:.26+(blade%3)*.05);
    const width=structured?(tall?.014+(blade%3)*.002:.022+(blade%3)*.0024):.011+(blade%4)*.0023;
    const base=P.length/3,twist=(blade%2?1:-1)*(.25+(blade%3)*.12);
    // The lower leaves bend beyond a real shoulder then fall to the tip.
    // Reusing each tuft's old vertices avoids broad straight V-shaped blades.
    const profileHeight=t=>{const r=1-t;return h*(3*r*r*t*(tall?.60:.56)+3*r*t*t*(tall?1.0:.79)+t*t*t*(tall?.83:.38));};
    if(foldedNear) {
      // Reuse seven vertices for a tapered outline and one physical crease.
      // The two coincident crease vertices carry independent facet normals.
      const t=.62,lean=bend*t*t;
      const heading=a+twist*t,sideX=-Math.sin(heading),sideZ=Math.cos(heading);
      const half=width*(.52+.78*Math.sin(Math.PI*t*.88))*Math.pow(1-t,.72);
      const tangent=new THREE.Vector3(ca*2*bend*t,(profileHeight(t+.001)-profileHeight(t-.001))/.002,sa*2*bend*t).normalize();
      const ridge=new THREE.Vector3(sideX,0,sideZ).cross(tangent).normalize().multiplyScalar(half*.34);
      const cx=ox+ca*lean,cy=profileHeight(t),cz=oz+sa*lean,rootHalf=width*.52;
      const leftHalf=half*(.90+(blade%3)*.035),rightHalf=half*(.99-(blade%3)*.035);
      const points=[
        [ox+Math.sin(a)*rootHalf,0,oz-Math.cos(a)*rootHalf],
        [ox-Math.sin(a)*rootHalf,0,oz+Math.cos(a)*rootHalf],
        [cx+ridge.x,cy+ridge.y,cz+ridge.z],
        [cx+ridge.x,cy+ridge.y,cz+ridge.z],
        [cx-sideX*leftHalf,cy,cz-sideZ*leftHalf],
        [cx+sideX*rightHalf,cy,cz+sideZ*rightHalf],
        [ox+ca*bend,profileHeight(1),oz+sa*bend]
      ];
      for(let j=0;j<7;j++) {
        P.push(...points[j]);N.push(0,0,0);
        // Root-to-tip shading follows physical leaf coordinates, including the
        // duplicated crease, so the root mass is dark and the blade stays lit.
        const leafT=j<2?0:j===6?1:t,side=j===6?0:j===0||j===4?-1:1;
        const shade=.27+.67*Math.pow(Math.sin(leafT*Math.PI*.5),.72),dry=blade%11===0;
        C.push(shade*(dry?.96:.90),shade*(dry?.94:1),shade*(dry?.61:.73));U.push((side+1)/2,leafT);
      }
      for(const k of [0,1,2,0,2,4,1,5,3,4,2,6,3,5,6])I.push(base+k);
      continue;
    }
    for(let j=0;j<=segments;j++) {
      const t=structured&&segments===2&&j===1?.60:j/segments,tip=j===segments,lean=bend*t*t,drop=(tall?.12:.28)*t*t*t;
      const heading=a+twist*t,sideX=-Math.sin(heading),sideZ=Math.cos(heading);
      const half=width*(.52+.78*Math.sin(Math.PI*t*.88))*Math.pow(1-t,.72);
      const tangent=new THREE.Vector3(ca*2*bend*t,h*(1-3*(structured?(tall?.21:.40):(tall?.12:.28))*t*t),sa*2*bend*t).normalize();
      const normal=new THREE.Vector3(sideX,0,sideZ).cross(tangent).normalize();
      if(normal.y<0)normal.negate();normal.lerp(new THREE.Vector3(0,1,0),.68).normalize();
      for(const side of tip?[0]:[-1,1]) {
        P.push(ox+ca*lean+sideX*half*side,structured?profileHeight(t):h*(t-drop),oz+sa*lean+sideZ*half*side);
        N.push(normal.x,normal.y,normal.z);
        const shade=structured?.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72):.57+.43*Math.sin(t*Math.PI*.5),dry=blade%11===0;
        C.push(shade*(dry?1.02:.90),shade*(dry?.96:1),shade*(dry?.57:.73));U.push((side+1)/2,t);
      }
      if(j<segments-1){const k=base+j*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
      else if(j===segments-1){const k=base+j*2;I.push(k,k+1,k+2);}
    }
  }
  if(foldedNear) {
    // Area-weighted normals derive from the actual Float32 mesh triangles.
    // Do not substitute an upward lighting normal for the modeled fold.
    for(let i=0;i<I.length;i+=3) {
      const a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3;
      const ux=Math.fround(P[b])-Math.fround(P[a]),uy=Math.fround(P[b+1])-Math.fround(P[a+1]),uz=Math.fround(P[b+2])-Math.fround(P[a+2]);
      const vx=Math.fround(P[c])-Math.fround(P[a]),vy=Math.fround(P[c+1])-Math.fround(P[a+1]),vz=Math.fround(P[c+2])-Math.fround(P[a+2]);
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      for(const k of [a,b,c]){N[k]+=nx;N[k+1]+=ny;N[k+2]+=nz;}
    }
    for(let i=0;i<N.length;i+=3) {
      const length=Math.hypot(N[i],N[i+1],N[i+2]);N[i]/=length;N[i+1]/=length;N[i+2]/=length;
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);if(profile==='middle-natural-v1')g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
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
  const grazed=meadowSwardGrazingAt(x,z);
  const band=fieldSwardAt(x,z).cover;
  return ((.42+stand*.95)*(1-grazed)+(.23+stand*.33)*grazed)*(1-coyoteCoverDryWeight(x,z)*.38)*(1+FIELD_SWARD_HEIGHT_BOOST*band)*(1+northPastureAt(x,z).uncut*.20);
}

// One palette for the near leaves, distant sward and old seed layer. Separate
// green and golden stands give fields variation without random colour speckles.
export function meadowBladeColor(color,x,z,variation=.5){
  const patch=fieldPatch(x/18+8.7,z/18-3.1);
  const dry=Math.max(0,Math.min(1,(fieldPatch(x/24-7.4,z/24+6.8)-.42)*3.5))*(1-meadowGrazingAt(x,z)*.85);
  const arid=coyoteCoverDryWeight(x,z);
  const h=.225+patch*.029-dry*.075-arid*.105,s=.55+variation*.08-dry*.08-arid*.11,l=.15+variation*.035+dry*.055+arid*.07;
  const band=fieldSwardAt(x,z);
  let hh=h,ss=s,ll=l;
  if(band.cover>0){
    // Preserve the original margin arithmetic and floating-point operation order.
    const ripe=band.seed/band.cover,w=band.cover;
    hh=h+(.208-ripe*.082-h)*w;
    ss=s+(.57+variation*.045-ripe*.025-s)*w;
    ll=l+(.202+ripe*.034+variation*.025-l)*w;
  }
  const pasture=northPastureAt(x,z);
  // Most recycled grass rows are outside this authored field. No per-row
  // closure or temporary HSL object is allocated on their unchanged path.
  if(pasture.cut===0&&pasture.uncut===0)return color.setHSL(hh,ss,ll);
  const cut=pasture.cut,uncut=pasture.uncut;
  hh+=(.247-hh)*cut;ss+=(.61-ss)*cut;ll+=(.151+variation*.025-ll)*cut;
  hh+=(.207-hh)*uncut;ss+=(.59-ss)*uncut;ll+=(.185+variation*.028-ll)*uncut;
  return color.setHSL(hh,ss,ll);
}

// Fully modelled lupin: palmate foliage, asymmetric pea flowers and green buds.
// 238 triangles per stalk; no alpha cards or flower-coloured green stems.
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
  // Each pea floret has a folded upright banner, two unequal wings and a
  // projecting keel. The petals share one root on the real pentagonal stalk.
  const petal=(points,hex,outward)=>{
    const [a,b,c]=points,u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-a[k]);
    const dot=(u[1]*v[2]-u[2]*v[1])*outward[0]+(u[2]*v[0]-u[0]*v[2])*outward[1]+(u[0]*v[1]-u[1]*v[0])*outward[2];
    face(dot<0?[...points].reverse():points,hex);
  };
  for(let ring=0;ring<8;ring++)for(let flower=0;flower<3;flower++){
    const phase=ring*2.07+flower*2.39996,variation=Math.sin(phase*1.71+2.1);
    const a=flower*Math.PI*2/3+ring*1.87+variation*.19,y=.335+ring*.055+Math.sin(phase)*.004;
    const scale=1.25*(1-ring*.065)*(1+variation*.075),c=Math.cos(a),s=Math.sin(a);
    const sector=Math.PI*2/5,delta=((a%sector)+sector)%sector-sector/2;
    const radius=(.012-y*.008/.78)*Math.cos(Math.PI/5)/Math.cos(delta);
    const root=[.028*y/.78+c*radius,y,s*radius],outward=[c,0,s];
    const point=([u,v,d])=>[root[0]+s*u*scale+c*d*scale,root[1]+v*scale,root[2]-c*u*scale+s*d*scale];
    const emit=(points,hex)=>petal(points.map(point),hex,outward);
    const hood=ring%3===0?'#a875c2':'#9763b5',wing=ring%2?'#8b60ad':'#8055a2';
    // Two shallow banner folds rise above the wings; unequal shoulders avoid
    // the former repeated bowl silhouettes. All dimensions are metres.
    const base=[0,0,0],left=[-.007,.001,.003],right=[.006,.002,.003];
    const upperLeft=[-.023,.024,.011],crest=[-.001,.029,.013],upperRight=[.021,.023,.012];
    emit([base,left,upperLeft,crest],hood);
    emit([base,crest,upperRight,right],hood);
    emit([base,[-.022,-.009,.022],[-.002,-.012,.027]],wing);
    emit([base,[.004,-.012,.027],[.020,-.008,.023]],wing);
    emit([base,[-.007,-.011,.023],[-.003,-.014,.027],[.007,-.012,.026]],'#835ba6');
  }
  // A small closed terminal bud meets the existing stalk before tapering out.
  // Four triangular sides per half keep the whole plant at 238 triangles.
  const lower=[.028*.754/.78,.754,0],upper=[.028,.791,0],bud=[];
  for(let i=0;i<4;i++){const a=i*Math.PI/2;bud.push([.028+Math.cos(a)*.007,.779,Math.sin(a)*.007]);}
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    petal([lower,bud[j],bud[i]],i%2?'#638547':'#719150',[Math.cos((i+.5)*Math.PI/2),0,Math.sin((i+.5)*Math.PI/2)]);
    petal([upper,bud[i],bud[j]],i%2?'#719150':'#86a364',[Math.cos((i+.5)*Math.PI/2),0,Math.sin((i+.5)*Math.PI/2)]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();
  // Join only the two banner panels for soft petal shading. Their normals
  // derive from these Float32 triangles; stem, leaves, wings and keel stay exact.
  const positions=g.attributes.position.array,normals=g.attributes.normal.array,indices=g.index.array;
  for(let flower=0;flower<24;flower++){
    const start=76+flower*18,sums=new Map(),key=id=>positions.slice(id*3,id*3+3).join(',');
    for(let triangle=38+flower*8;triangle<42+flower*8;triangle++){
      const ids=Array.from(indices.slice(triangle*3,triangle*3+3)),[a,b,c]=ids.map(id=>id*3);
      const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2];
      const vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
      const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
      for(const id of ids){const k=key(id),sum=sums.get(k)||[0,0,0];for(let axis=0;axis<3;axis++)sum[axis]+=n[axis];sums.set(k,sum);}
    }
    for(let id=start;id<start+8;id++){const n=sums.get(key(id)),length=Math.hypot(...n);for(let axis=0;axis<3;axis++)normals[id*3+axis]=n[axis]/length;}
  }
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// A bounded ring carries pasture silhouettes into the middle distance. Slots
// only rebuild when a 12 m cell enters the ring; no extra work per grass blade
// on normal frames. Positions are keyed by world cell, so riding back is stable.
export function createMeadowDistance({THREE,scene,canGrow,heightAt,managedAt,low=false,getQuality=()=>low?'low':'high'}){
  const CELL=12,W=18,K=low?48:120;
  const hash=(x,z)=>{let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const geometries={low:createGrassTuftGeometry(THREE,{bladeCount:4,segments:2,profile:'middle-natural-v1'}),medium:createGrassTuftGeometry(THREE,{bladeCount:6,segments:2,profile:'middle-natural-v1'}),high:createGrassTuftGeometry(THREE,{bladeCount:8,segments:2,profile:'middle-natural-v1'})};
  const geo=geometries[getQuality()]||geometries.high;
  const mat=new THREE.MeshStandardMaterial({name:'Middle distance meadow',vertexColors:true,side:THREE.DoubleSide,roughness:1,envMapIntensity:.7});
  const uniforms={fieldTime:{value:0},fieldRider:{value:new THREE.Vector2()}};
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.vertexShader=sh.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      #ifdef USE_INSTANCING
        float middleNormalDistance=distance(instanceMatrix[3].xz,fieldRider);
        float middleNormalFade=smoothstep(15.0,29.0,middleNormalDistance)*(1.0-smoothstep(78.0,102.0,middleNormalDistance));
        // Inverse transpose of (sqrt(fade),fade,sqrt(fade)), up to a
        // common scalar. No division, including at the fully retired endpoint.
        objectNormal.xz*=max(sqrt(middleNormalFade),.0001);
      #endif`);
    sh.vertexShader='uniform float fieldTime; uniform vec2 fieldRider;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip=instanceMatrix[3].xz;float distanceToRider=distance(ip,fieldRider);
        float grow=smoothstep(15.0,29.0,distanceToRider)*(1.0-smoothstep(78.0,102.0,distanceToRider));
        // Height retires smoothly; square-root reach makes projected cover
        // linear in grow instead of disappearing quadratically at both LODs.
        transformed.xz*=sqrt(grow);transformed.y*=grow;
        transformed.x+=sin(fieldTime*1.2+ip.x*.3+ip.y*.16)*transformed.y*.15;
      #endif`);
  };
  mat.customProgramCacheKey=()=> 'middle-meadow-cover-2';
  installPastureLighting(mat);
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
