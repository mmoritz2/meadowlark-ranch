// Finite authored lilac colonies occupy meadow shoulders, never a new path.
// The caller retains all existing water, yard, course and trail exclusions.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const MEADOW_FLOWER_BANKS=Object.freeze([
 {id:'otter-west',nodes:[[19,108,2.7],[13,115,4.0],[13,121,2.2]]},
 {id:'otter-east',nodes:[[34,116,2.1],[32,122,2.9],[28,126,1.8]]},
 {id:'clover-shoulder',nodes:[[43,-151,2.4],[48,-157,3.8],[55,-164,2.7]]},
].map(bank=>Object.freeze({...bank,nodes:Object.freeze(bank.nodes.map(n=>Object.freeze(n))),
 bounds:Object.freeze([Math.min(...bank.nodes.map(n=>n[0]-n[2]*1.1)),Math.max(...bank.nodes.map(n=>n[0]+n[2]*1.1)),
  Math.min(...bank.nodes.map(n=>n[1]-n[2]*1.1)),Math.max(...bank.nodes.map(n=>n[1]+n[2]*1.1))])})));
export function meadowFlowerBankAt(x,z){
 let cover=0;
 for(const bank of MEADOW_FLOWER_BANKS){
  const [loX,hiX,loZ,hiZ]=bank.bounds;
  if(x<loX||x>hiX||z<loZ||z>hiZ)continue;
  for(let i=1;i<bank.nodes.length;i++){
   const a=bank.nodes[i-1],b=bank.nodes[i],dx=b[0]-a[0],dz=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
   const width=a[2]+(b[2]-a[2])*t,d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/width;
   // Smoothly bounded lobes connect without grid edges or a uniform straight rim.
   const edge=d+.075*Math.sin(x*.72+Math.sin(z*.38))+.025*Math.sin(z*1.17-x*.23);
   cover=Math.max(cover,1-smooth(.38,1.0,edge));
  }
 }
 return cover;
}
export const MEADOW_LUPIN_HEIGHT=1.143;
export const LEGACY_LUPIN_HEIGHT=.791;
// Established colonies retain their previous physical top height. New authored
// groups graduate from shorter fringe plants to uneven taller flowering cores.
export function meadowFlowerHeightAt(x,z,variation=.5){
 const cover=meadowFlowerBankAt(x,z);
 return .82+cover*.42+Math.max(0,Math.min(1,variation))*.14;
}

// Long raceme lupin: two six-leaf palmate whorls, unequal pea flowers and a green terminal bud.
// 238 triangles per stalk; no alpha cards or flower-coloured green stems.
export function createMeadowLupinGeometry(THREE){
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
      [Math.cos(b)*.005+.042,1.115,Math.sin(b)*.005],[Math.cos(a)*.005+.042,1.115,Math.sin(a)*.005]],'#518137');
  }
  // Petiole and all six leaflets meet at one real palmate joint. The two
  // whorls face different directions; no disconnected floating leaf spray.
  for(let whorl=0;whorl<2;whorl++){
    const heading=.72+whorl*2.65,y=.145+whorl*.16,c=Math.cos(heading),s=Math.sin(heading);
    const base=[.042*y/1.115,y,0],joint=[base[0]+c*.096,y+.052,s*.096];
    face([base,[base[0]-s*.008,y,base[2]+c*.008],
      [joint[0]-s*.004,joint[1],joint[2]+c*.004],joint],'#467332');
    for(let leaf=0;leaf<6;leaf++){
      const a=heading+(leaf-2.5)*.67,lc=Math.cos(a),ls=Math.sin(a),len=.14+(leaf%3)*.023,w=.024;
      face([joint,[joint[0]+lc*len*.62-ls*w,joint[1]+.036,joint[2]+ls*len*.62+lc*w],
        [joint[0]+lc*len,joint[1]+.066-(leaf%2)*.018,joint[2]+ls*len],
        [joint[0]+lc*len*.60+ls*w,joint[1]+.025,joint[2]+ls*len*.60-lc*w]],
        whorl?'#648e3e':'#759b48');
    }
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
    const a=flower*Math.PI*2/3+ring*1.87+variation*.19,y=.60+ring*.065+Math.sin(phase)*.004;
    const scale=2.05*(1-ring*.070)*(1+variation*.075),c=Math.cos(a),s=Math.sin(a);
    const sector=Math.PI*2/5,delta=((a%sector)+sector)%sector-sector/2;
    const radius=(.012-y*.007/1.115)*Math.cos(Math.PI/5)/Math.cos(delta);
    const root=[.042*y/1.115+c*radius,y,s*radius],outward=[c,0,s];
    const point=([u,v,d])=>[root[0]+s*u*scale+c*d*scale,root[1]+v*scale,root[2]-c*u*scale+s*d*scale];
    const emit=(points,hex)=>petal(points.map(point),hex,outward);
    const hood=ring%3===0?'#b38bc7':'#9d70ba',wing=ring%2?'#9167b0':'#8058a1';
    // Two shallow banner folds rise above the wings; unequal shoulders avoid
    // the former repeated bowl silhouettes. All dimensions are metres.
    const base=[0,0,0],left=[-.007,.001,.003],right=[.006,.002,.003];
    const upperLeft=[-.023,.024,.011],crest=[-.001,.029,.013],upperRight=[.021,.023,.012];
    emit([base,left,upperLeft,crest],hood);
    emit([base,crest,upperRight,right],hood);
    emit([base,[-.022,-.009,.022],[-.002,-.012,.027]],wing);
    emit([base,[.004,-.012,.027],[.020,-.008,.023]],wing);
    emit([base,[-.007,-.011,.023],[-.003,-.014,.027],[.007,-.012,.026]],'#8762ab');
  }
  // A small closed terminal bud meets the existing stalk before tapering out.
  // Four triangular sides per half keep the whole plant at 238 triangles.
  const lower=[.042*1.075/1.115,1.075,0],upper=[.042,1.143,0],bud=[];
  for(let i=0;i<4;i++){const a=i*Math.PI/2;bud.push([.042+Math.cos(a)*.010,1.111,Math.sin(a)*.010]);}
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
  g.computeBoundingBox();g.computeBoundingSphere();g.userData.meadowFlowers={profile:'palmate-raceme-1',triangles:238,whorls:2,leaflets:12,florets:24};return g;
}

