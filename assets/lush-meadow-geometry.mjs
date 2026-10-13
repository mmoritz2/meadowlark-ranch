// Original upright pasture blades. Extra narrow leaves share the existing
// triangle allowance instead of widening a few flat fans to fill each stand.
// Existing source roots, instance transforms, wind, colour and ground-contact
// policies stay with their owners. In particular the middle layer's broad XZ
// scaling is accounted for by short local lean and slender local leaf widths.
const ROOTS=[[-.092,-.056],[.063,-.072],[-.035,.081],[.088,.030],[-.102,.028],[.022,-.007],[.048,.092],[-.037,-.095],[.111,-.010]];
const HEADINGS=[-.45,.14,.61,.35,.94,.82,.50,.27,1.40,1.52,.90,1.00,-.21,.10,2.06,1.96,.40,.58,2.55,2.31,1.19,1.33];
const HEIGHTS=[.76,1.10,.86,.64,1.18,.82,.92,.68,1.03,.79,.98,.71,1.05,.88,.69,.96,.83,1.14,.73,.91,.80,1.01];

function layout(leafCount,segments,profile,seeded){
 if(profile==='near'&&leafCount===8&&segments===3&&!seeded)return {leaves:12,curved:2,baseSegments:2,seedTriangles:0};
 if(['meadow','low'].includes(profile)&&leafCount===14&&segments===3&&!seeded)return {leaves:22,curved:2,baseSegments:2,seedTriangles:0};
 if(profile==='seeded'&&leafCount===14&&segments===2&&seeded)return {leaves:22,curved:10,baseSegments:1,seedTriangles:28};
 if(profile==='middle'&&segments===2&&[4,6,8].includes(leafCount)&&!seeded)return {
  leaves:{4:6,6:10,8:12}[leafCount],curved:{4:3,6:4,8:6}[leafCount],baseSegments:1,seedTriangles:0};
 return {leaves:leafCount,curved:0,baseSegments:segments,seedTriangles:seeded?28:0};
}

export function createLushMeadowGeometry(T,{leafCount=14,segments=3,profile='meadow',seeded=false}={}){
 if(!Number.isInteger(leafCount)||leafCount<4||leafCount>14||![2,3].includes(segments)
   ||!['meadow','low','seeded','near','middle'].includes(profile))throw Error('Invalid lush meadow geometry');
 const P=[],C=[],U=[],I=[],leafRanges=[],plan=layout(leafCount,segments,profile,seeded);
 const low=profile==='low',middle=profile==='middle',heightScale=low?.59:profile==='seeded'?.91:1;
 const emit=(p,u,v,shade,dry=0)=>{P.push(...p);U.push(u,v);C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));};
 for(let leaf=0;leaf<plan.leaves;leaf++){
  const root=ROOTS[Math.floor(leaf/2)%ROOTS.length],a=HEADINGS[leaf]+(low?.13:0),dx=Math.cos(a),dz=Math.sin(a);
  const localSegments=plan.baseSegments+(leaf<plan.curved?1:0),short=localSegments===1;
  const h=HEIGHTS[leaf]*heightScale*(short?.82:1);
  const reach=(middle?.035+(leaf%5)*.005:.082+(leaf%5)*.009)*(low?1.08:1);
  const width=(middle?.015:.0135)+(leaf%4)*(middle?.0008:.0007),twist=(leaf%2?-1:1)*(.07+(leaf%3)*.025);
  const samples=localSegments===3?[0,.34,.76,1]:localSegments===2?[0,.68,1]:[0,1],start=P.length/3,indexStart=I.length;
  for(let ring=0;ring<samples.length;ring++){
   const t=samples[ring],last=ring===samples.length-1;
   // Most leaves keep rising into a fine tip. The few extra-segment leaves
   // retain a gently changing rise through an additional upper shoulder.
   const height=localSegments===3?[0,.36,.87,.97][ring]:localSegments===2?[0,.77,.97][ring]:[0,.96][ring];
   const lean=reach*(.10*t+.90*t*t),cross=(leaf%2?-.005:.006)*t*t;
   const x=root[0]+dx*lean-dz*cross,y=h*height,z=root[1]+dz*lean+dx*cross;
   const half=(width+(profile==='near'&&leaf%2===0?(.008+(leaf%4)*.001)*Math.sin(Math.PI*t):0))*(short?.78:.40+.75*Math.sin(Math.PI*t*.88))*Math.pow(1-t,.58),heading=a+twist*t*t;
   const shade=.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72);
   for(const side of last?[0]:[-1,1])emit([x-Math.sin(heading)*half*side,y,z+Math.cos(heading)*half*side],(side+1)/2,t,shade,leaf%17===0?.15:0);
   if(ring<samples.length-2){const k=start+ring*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
   else if(ring===samples.length-2){const k=start+ring*2;I.push(k,k+1,k+2);}
  }
  leafRanges.push({vertexStart:start,vertexCount:P.length/3-start,indexStart,indexCount:I.length-indexStart,segments:localSegments,bent:localSegments>1});
 }
 if(plan.seedTriangles===28)for(let stem=0;stem<2;stem++){
  const a=stem===0?.81:3.97,dx=Math.cos(a),dz=Math.sin(a),rx=stem===0?.024:-.038,rz=stem===0?-.021:.032;
  const height=stem===0?1.35:1.52,lean=stem===0?.21:.17,base=P.length/3;
  for(let ring=0;ring<2;ring++)for(let side=0;side<4;side++){
   const angle=a+side*Math.PI*.5,radius=ring?.0028:.004;
   emit([rx+dx*lean*ring+Math.cos(angle)*radius,height*ring,rz+dz*lean*ring+Math.sin(angle)*radius],side/3,ring,.32+ring*.54,.15);
  }
  for(let side=0;side<4;side++){const b=base+side,c=base+(side+1)%4,d=base+4+side,e=base+4+(side+1)%4;I.push(b,d,c,c,d,e);}
  const x=rx+dx*lean,z=rz+dz*lean,length=stem===0?.075:.065,width=stem===0?.009:.007;
  const grain=[{p:[x,height-.004,z],u:.5,v:.80,shade:.95,dry:.65}];
  for(let side=0;side<3;side++){const angle=a+side*Math.PI*2/3;grain.push({p:[x+dx*.014+Math.cos(angle)*width,height+length*.36,z+dz*.014+Math.sin(angle)*width],u:side/2,v:.9,shade:1,dry:.8});}
  grain.push({p:[x+dx*.038,height+length,z+dz*.038],u:.5,v:1,shade:1,dry:.85});
  for(let side=0;side<3;side++)for(const ids of [[0,1+side,1+(side+1)%3],[1+side,4,1+(side+1)%3]]){
   const at=P.length/3;for(const id of ids){const q=grain[id];emit(q.p,q.u,q.v,q.shade,q.dry);}I.push(at,at+1,at+2);
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(P,3));geometry.setAttribute('color',new T.Float32BufferAttribute(C,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(U,2));geometry.setIndex(I);
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.lushMeadow={profile:'lush-meadow-3',form:profile,leaves:plan.leaves,requestedLeaves:leafCount,triangles:I.length/3,seedTriangles:plan.seedTriangles,leafRanges,shape:'Narrow upright blades with short lateral lean and uneven tops'};
 if(middle)geometry.userData.middleCover={profile:'lush-middle-3',leaves:plan.leaves,requestedLeaves:leafCount,leafRanges};
 return geometry;
}
