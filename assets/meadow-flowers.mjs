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

// Original rounded pea raceme: small convex banners, unequal curved wings and
// a cupped keel share each stem attachment. Connected palmate leaves retain
// their old outer contacts while a curved midrib replaces the flat leaf fan.
export function createMeadowLupinGeometry(THREE){
 const P=[],C=[],I=[],ranges=[],color=new THREE.Color();
 const push=(p,hex)=>{color.set(hex);P.push(...p);C.push(color.r,color.g,color.b);return P.length/3-1;};
 const triangle=(a,b,c,wanted)=>{const A=P.slice(a*3,a*3+3),B=P.slice(b*3,b*3+3),D=P.slice(c*3,c*3+3),u=B.map((v,k)=>v-A[k]),v=D.map((v,k)=>v-A[k]);const dot=(u[1]*v[2]-u[2]*v[1])*wanted[0]+(u[2]*v[0]-u[0]*v[2])*wanted[1]+(u[0]*v[1]-u[1]*v[0])*wanted[2];I.push(...(dot<0?[a,c,b]:[a,b,c]));};
 function face(points,hex,wanted){const base=P.length/3;points.forEach(p=>push(p,hex));triangle(base,base+1,base+2,wanted);if(points.length===4)triangle(base,base+2,base+3,wanted);}
 function patch(outline,centre,hex,wanted,kind,owner){
  const vertexStart=P.length/3,indexStart=I.length;outline.forEach(p=>push(p,hex));const center=push(centre,hex);
  for(let i=0;i<outline.length;i++)triangle(vertexStart+i,vertexStart+(i+1)%outline.length,center,wanted);
  ranges.push({kind,owner,vertexStart,vertexCount:outline.length+1,indexStart,indexCount:outline.length*3,attachment:vertexStart});
 }
 // Keep the established stem and two petiole anchors; all floret attachments
 // remain on these original pentagonal faces and the walkable root stays zero.
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5,b=(i+1)*Math.PI*2/5;
  face([[Math.cos(a)*.012,0,Math.sin(a)*.012],[Math.cos(b)*.012,0,Math.sin(b)*.012],[Math.cos(b)*.005+.042,1.115,Math.sin(b)*.005],[Math.cos(a)*.005+.042,1.115,Math.sin(a)*.005]],'#518137',[Math.cos((a+b)/2),0,Math.sin((a+b)/2)]);
 }
 const joints=[];
 for(let whorl=0;whorl<2;whorl++){
  const heading=.72+whorl*2.65,y=.145+whorl*.16,c=Math.cos(heading),s=Math.sin(heading),base=[.042*y/1.115,y,0],joint=[base[0]+c*.096,y+.052,s*.096];joints.push(joint);
  face([base,[base[0]-s*.008,y,base[2]+c*.008],[joint[0]-s*.004,joint[1],joint[2]+c*.004],joint],'#467332',[0,1,0]);
  for(let leaf=0;leaf<6;leaf++){
   const a=heading+(leaf-2.5)*.67,lc=Math.cos(a),ls=Math.sin(a),len=.14+(leaf%3)*.023,w=.024;
   const outline=[joint,[joint[0]+lc*len*.26-ls*w*.58,joint[1]+.021,joint[2]+ls*len*.26+lc*w*.58],
    [joint[0]+lc*len*.62-ls*w,joint[1]+.036,joint[2]+ls*len*.62+lc*w],
    [joint[0]+lc*len,joint[1]+.066-(leaf%2)*.018,joint[2]+ls*len],
    [joint[0]+lc*len*.60+ls*w,joint[1]+.025,joint[2]+ls*len*.60-lc*w],
    [joint[0]+lc*len*.26+ls*w*.58,joint[1]+.018,joint[2]+ls*len*.26-lc*w*.58]];
   patch(outline,[joint[0]+lc*len*.51,joint[1]+.050,joint[2]+ls*len*.51],whorl?'#648e3e':'#759b48',[0,1,0],'leaf',whorl*6+leaf);
  }
 }
 const flowerRoots=[];
 for(let ring=0;ring<8;ring++)for(let flower=0;flower<3;flower++){
  const phase=ring*2.07+flower*2.39996,variation=Math.sin(phase*1.71+2.1),a=flower*Math.PI*2/3+ring*1.87+variation*.19,y=.60+ring*.065+Math.sin(phase)*.004;
  const scale=2.05*(1-ring*.070)*(1+variation*.075),c=Math.cos(a),s=Math.sin(a),sector=Math.PI*2/5,delta=((a%sector)+sector)%sector-sector/2;
  const radius=(.012-y*.007/1.115)*Math.cos(Math.PI/5)/Math.cos(delta),root=[.042*y/1.115+c*radius,y,s*radius],wanted=[c,0,s],owner=ring*3+flower;flowerRoots.push(root);
  const point=([u,v,d])=>[root[0]+s*u*scale+c*d*scale,root[1]+v*scale,root[2]-c*u*scale+s*d*scale];
  const emit=(outline,centre,hex,kind)=>patch(outline.map(point),point(centre),hex,wanted,kind,owner);
  const hood=ring%3===0?'#b38bc7':'#9d70ba',wing=ring%2?'#9167b0':'#8058a1';
  // Rounded outline with a raised centre supplies a real small pea banner,
  // rather than a four-corner purple shelf. Its two side wings cup the keel.
  emit([[0,0,0],[-.010,.002,.004],[-.020,.012,.008],[-.018,.024,.011],[-.007,.030,.012],[.009,.028,.013],[.019,.021,.011],[.017,.009,.008]],[0,.015,.019],hood,'banner');
  emit([[0,0,0],[-.008,-.002,.011],[-.020,-.006,.019],[-.020,-.012,.023],[-.006,-.014,.025]],[-.010,-.007,.024],wing,'left-wing');
  emit([[0,0,0],[.006,-.002,.011],[.018,-.006,.020],[.017,-.011,.023],[.005,-.013,.025]],[.009,-.007,.025],wing,'right-wing');
  emit([[0,0,0],[-.005,-.007,.022],[-.004,-.014,.028],[.006,-.014,.027],[.008,-.007,.021]],[.001,-.010,.028],'#8762ab','keel');
 }
 // Original green terminal bud establishes the exact historic top1.143m.
 const lower=[.042*1.075/1.115,1.075,0],upper=[.042,1.143,0],bud=[];
 for(let i=0;i<4;i++){const a=i*Math.PI/2;bud.push([.042+Math.cos(a)*.010,1.111,Math.sin(a)*.010]);}
 for(let i=0;i<4;i++){const j=(i+1)%4,wanted=[Math.cos((i+.5)*Math.PI/2),0,Math.sin((i+.5)*Math.PI/2)];face([lower,bud[j],bud[i]],i%2?'#638547':'#719150',wanted);face([upper,bud[i],bud[j]],i%2?'#719150':'#86a364',wanted);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.meadowFlowers={profile:'rounded-pea-raceme-2',triangles:I.length/3,whorls:2,leaflets:12,florets:24,ranges,joints,flowerRoots};return g;
}
