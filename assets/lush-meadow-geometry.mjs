// Original long grass stands. Source roots, per-instance growth and wind remain
// owned by the established pasture pipeline. These shapes compensate for its
// shorter Y scale with upright ribbons, rather than a flat radial leaf fan.
const ROOTS=[[-.075,-.040],[.065,-.060],[.015,.085],[-.060,.075],[.090,.025]];
const HEADINGS=[.22,.48,1.08,1.36,2.04,2.27,3.08,3.40,4.14,4.36,5.12,5.40,5.93,6.15];
const HEIGHTS=[.76,1.10,.86,.64,1.18,.82,.92,.68,1.03,.79,.98,.71,1.05,.88];

export function createLushMeadowGeometry(T,{leafCount=14,segments=3,profile='meadow',seeded=false}={}){
 if(!Number.isInteger(leafCount)||leafCount<4||leafCount>14||![2,3].includes(segments)
   ||!['meadow','low','seeded','near','middle'].includes(profile))throw Error('Invalid lush meadow geometry');
 const P=[],C=[],U=[],I=[],leafRanges=[];
 const low=profile==='low',middle=profile==='middle',heightScale=low?.59:profile==='seeded'?.91:1;
 const emit=(p,u,v,shade,dry=0)=>{P.push(...p);U.push(u,v);C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));};
 for(let leaf=0;leaf<leafCount;leaf++){
  // Paired leaves share a small growth point, with uneven heading/height. Five
  // offset growth points overlap through a stand without all meeting in a V.
  const source=leafCount===14?leaf:Math.floor(leaf*14/leafCount),root=ROOTS[Math.floor(source/2)%ROOTS.length];
  const a=HEADINGS[source]+(low?.13:0),dx=Math.cos(a),dz=Math.sin(a),sx=-dz,sz=dx;
  const h=HEIGHTS[source]*heightScale,reach=(.32+(source%5)*.032)*(low?1.07:1);
  const width=(middle?.052:.030)+(source%4)*.0023;
  const curl=(source%2?-.030:.037),twist=(source%2?-1:1)*(.10+(source%3)*.025);
  const tipHeight=source%4===0?.86:source%4===1?.99:.90;
  const samples=segments===3?[0,.33,.73,1]:[0,.66,1],start=P.length/3,indexStart=I.length;
  for(let ring=0;ring<samples.length;ring++){
   const t=samples[ring],r=1-t,b1=3*r*r*t,b2=3*r*t*t,b3=t*t*t;
   const lean=reach*(.025*b1+.23*b2+b3),cross=curl*(.10*b2+b3);
   const x=root[0]+dx*lean+sx*cross,y=h*(.67*b1+1.18*b2+tipHeight*b3),z=root[1]+dz*lean+sz*cross;
   const half=width*(.40+.78*Math.sin(Math.PI*t*.92))*Math.pow(r,.52),heading=a+twist*t*t;
   const last=ring===samples.length-1,shade=.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72);
   for(const side of last?[0]:[-1,1])emit([x-Math.sin(heading)*half*side,y,z+Math.cos(heading)*half*side],(side+1)/2,t,shade);
   if(ring<samples.length-2){const k=start+ring*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
   else if(ring===samples.length-2){const k=start+ring*2;I.push(k,k+1,k+2);}
  }
  leafRanges.push({vertexStart:start,vertexCount:P.length/3-start,indexStart,indexCount:I.length-indexStart,bent:true});
 }
 if(seeded)for(let stem=0;stem<2;stem++){
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
 geometry.userData.lushMeadow={profile:'lush-meadow-1',form:profile,leaves:leafCount,triangles:I.length/3,leafRanges};
 if(middle)geometry.userData.middleCover={profile:'lush-middle-1',leaves:leafCount,leafRanges};
 return geometry;
}
