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

function createRetainedMeadowGeometry(T,{leafCount=14,segments=3,profile='meadow',seeded=false}={}){
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


// Selected blades spend seven triangles on four progressively rising stations.
// Physical transverse roll and narrowing break the old broad shoulder fan.
// Exact authored upright root/tip pairs use one triangle, balancing each tier.
// Every drawn point belongs to a connected physical surface; no extent proxy.
export function appendArchedMeadowLeaf(P,C,U,I,leaf){
 const {root,heading,height,reach,width,upright=false,sourceLeaf=0,dry=0,progressive=false,preserveNearMinX=false}=leaf;
 const dx=Math.cos(heading),dz=Math.sin(heading),rise=upright?.77:.82+(sourceLeaf%3)*.025,tipRise=upright?.97:.56+(sourceLeaf%4)*.035;
 const direction=sourceLeaf%2?-1:1,base=P.length/3,indexStart=I.length,peak=height*rise,tipY=upright?height*tipRise:peak*(.950+(sourceLeaf%3)*.008);
 const emit=(x,y,z,side,t)=>{P.push(x,y,z);U.push((side+1)/2,t);const shade=.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72);C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));};
 const rootHalf=width*.40,sx=-Math.sin(heading),sz=Math.cos(heading);
 emit(root[0]-sx*rootHalf,0,root[1]-sz*rootHalf,-1,0);emit(root[0]+sx*rootHalf,0,root[1]+sz*rootHalf,1,0);
 if(upright){
  emit(root[0]+dx*reach,tipY,root[1]+dz*reach,0,1);I.push(base,base+1,base+2);
  return{vertexStart:base,vertexCount:3,indexStart,indexCount:3,segments:1,bent:false,creased:false,ribbon:false,sourceLeaf,upright:true,slenderStem:true};
 }
 if(progressive){
  const samples=[.29,.55,.72],heights=[peak*.45,peak*.84,peak],widths=[width*.30,width*.225,width*.18];
  for(let ring=0;ring<3;ring++){
   const t=samples[ring],lean=reach*(.10*t+.90*t*t),sweep=direction*height*[.021,.005,-.011][ring],a=heading+direction*[-.10,.02,.15][ring],sx=-Math.sin(a),sz=Math.cos(a);
   const x=root[0]+dx*lean-dz*sweep,z=root[1]+dz*lean+dx*sweep,roll=widths[ring]*[.10,-.09,.08][ring];
   for(const side of[-1,1]){
    const xx=preserveNearMinX&&ring===0&&side===1?x+sx*(width*.58):x+sx*widths[ring]*side;
    emit(xx,heights[ring]+(ring<2?direction*side*roll:-Math.abs(roll)*(1-direction*side)),z+sz*widths[ring]*side,side,t);
   }
  }
  emit(root[0]+dx*reach,tipY,root[1]+dz*reach,0,1);
  for(const k of[0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6,6,7,8])I.push(base+k);
  return{vertexStart:base,vertexCount:9,indexStart,indexCount:21,segments:4,bent:true,creased:false,ribbon:true,sourceLeaf,upright:false,progressive:true,transverseRoll:true};
 }
 const samples=[.29,.68],heights=[peak*.765,peak],widths=[width*.26,width*.205];
 for(let ring=0;ring<2;ring++){
  const t=samples[ring],lean=reach*(.10*t+.90*t*t),sweep=direction*height*(ring===0?.021:-.011),a=heading+direction*(ring===0?-.10:.15),sx=-Math.sin(a),sz=Math.cos(a);
  const x=root[0]+dx*lean-dz*sweep,z=root[1]+dz*lean+dx*sweep,roll=widths[ring]*(.035+(sourceLeaf%3)*.005);
  for(const side of[-1,1])emit(x+sx*widths[ring]*side,heights[ring]+(ring===0?direction*side*roll:-roll*(1-direction*side)),z+sz*widths[ring]*side,side,t);
 }
 emit(root[0]+dx*reach,tipY,root[1]+dz*reach,0,1);
 for(const k of[0,1,2,1,3,2,2,3,4,3,5,4,4,5,6])I.push(base+k);
 return{vertexStart:base,vertexCount:7,indexStart,indexCount:15,segments:3,bent:true,creased:false,ribbon:true,sourceLeaf,upright:false};
}


// Original dry-cover leaf surfaces. Spend each retained tier on an unequal
// lower leaf mass, a few recovery leaves and finer accents. Existing rooted
// matrices, tint, wind, normal correction, admission and wet plants stay owned
// by their callers. This factory allocates exactly one original geometry.
function createReconciledDryCover(T,{profile,leafCount,seeded}){
 const middle=profile==='middle',near=profile==='near',low=profile==='low';
 const tier=middle?leafCount*3:near?40:70,leafTriangles=seeded?42:tier;
 const plan=middle?(leafCount===4?[3,3,1,1,1,1,1,1]:leafCount===6?[3,3,3,3,1,1,1,1,1,1]:[3,3,3,3,3,3,1,1,1,1,1,1]):near?[7,7,3,3,3,3,3,3,3,3,1,1]:seeded?[7,7,3,3,3,3,3,3,3,3,1,1,1,1]:[7,7,7,7,3,3,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,1];
 const P=[],C=[],U=[],I=[],leafRanges=[];
 const emit=(p,u,v,shade,dry=0)=>{P.push(...p);U.push(u,v);C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));};
 const variation=[.11,.73,.32,.94,.48,.06,.61,.87,.24,.55,.99,.39,.18,.80,.44,.67,.03,.90,.29,.58,.76,.14];
 for(let leaf=0;leaf<plan.length;leaf++){
  const triangles=plan[leaf],rings=(triangles+3)/2,curved=triangles>1;
  const rootIndex=(leaf*4+Math.floor(leaf/3))%(middle||near?6:9),root=ROOTS[rootIndex];
  const v=variation[leaf],recovery=triangles===7,accent=!curved;
  const heading=leaf*2.399963229728653+rootIndex*.31+(v-.5)*.68+(low?.41:middle?.19:0);
  const dx=Math.cos(heading),dz=Math.sin(heading),sx=-dz,sz=dx;
  let height=middle?(curved?.32+v*.45:.43+v*.56):recovery?.52+v*.50:accent?.42+v*.68:.16+v*.40;
  if(low)height*=.63;
  // Middle instances have a broad XZ footprint. Their real leaves are finer
  // and lean less locally, rather than becoming broad fans after that scale.
  const reach=middle?(curved?.032+v*.022:.016+v*.020):recovery?.20+v*.13:accent?.042+v*.055:.08+v*.13;
  const width=(middle?(accent?.0028:.0045)+v*.0013:(accent?.0037:recovery?.0077:.0064)+v*.0028)*(middle?2.6:1.9);
  const start=P.length/3,indexStart=I.length,sign=leaf%2?-1:1;
  const times=rings===5?[0,.25,.53,.77,1]:rings===3?[0,.59,1]:[0,1];
  for(let ring=0;ring<times.length;ring++){
   const t=times[ring],tip=ring===times.length-1;
   const rise=accent?t:rings===5?[0,.36,.70,.94,.93+v*.05][ring]:[0,.69,.91+v*.07][ring];
   const along=reach*(.16*t+.84*t*t),sweep=sign*reach*.055*Math.sin(Math.PI*t),angle=heading+sign*(.10*t+.14*t*t);
   const x=root[0]+dx*along+sx*sweep,z=root[1]+dz*along+sz*sweep;
   const half=width*(ring===0?.48:.85-.55*t),roll=sign*half*.13*Math.sin(Math.PI*t);
   const shade=.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72),dry=leaf%17===0?.15:0;
   for(const side of tip?[0]:[-1,1])emit([x-Math.sin(angle)*half*side,height*rise+roll*side,z+Math.cos(angle)*half*side],(side+1)/2,t,shade,dry);
   if(ring<times.length-2){const k=start+ring*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
   else if(ring===times.length-2){const k=start+ring*2;I.push(k,k+1,k+2);}
  }
  leafRanges.push({vertexStart:start,vertexCount:P.length/3-start,indexStart,indexCount:I.length-indexStart,rootIndex,root:[...root],segments:rings-1,bent:curved,upright:accent,recovery,sourceLeaf:leaf,progressive:rings===5,transverseRoll:curved});
 }
 if(I.length/3!==leafTriangles)throw Error('Dry-cover leaf budget mismatch');
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
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(P,3));geometry.setAttribute('color',new T.Float32BufferAttribute(C,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(U,2));geometry.setIndex(I);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.lushMeadow={profile:'dry-cover-reconciled-1',form:profile,leaves:leafRanges.length,requestedLeaves:leafCount,triangles:I.length/3,seedTriangles:seeded?28:0,leafRanges,shape:'Fine multidirectional curved basal leaves with unequal recovery leaves and slender accents'};
 if(middle)geometry.userData.middleCover={profile:'dry-middle-reconciled-1',leaves:leafRanges.length,requestedLeaves:leafCount,leafRanges};
 return geometry;
}

export function createLushMeadowGeometry(T,{leafCount=14,segments=3,profile='meadow',seeded=false}={}){
 if(!Number.isInteger(leafCount)||leafCount<4||leafCount>14||![2,3].includes(segments)||!['meadow','low','seeded','near','middle'].includes(profile))throw Error('Invalid lush meadow geometry');
 if(profile==='middle'&&segments===2&&[4,6,8].includes(leafCount)&&!seeded||profile==='near'&&leafCount===8&&segments===3&&!seeded||['meadow','low'].includes(profile)&&leafCount===14&&segments===3&&!seeded||profile==='seeded'&&leafCount===14&&segments===2&&seeded)return createReconciledDryCover(T,{profile,leafCount,seeded});
 const canonical=profile==='near'&&leafCount===8&&segments===3&&!seeded||['meadow','low'].includes(profile)&&leafCount===14&&segments===3&&!seeded||profile==='seeded'&&leafCount===14&&segments===2&&seeded;
 // The broad-scaled middle tier and noncanonical public factory combinations
 // retain every attribute/index byte from their original implementation.
 if(!canonical)return createRetainedMeadowGeometry(T,{leafCount,segments,profile,seeded});
 const P=[],C=[],U=[],I=[],leafRanges=[],low=profile==='low',near=profile==='near';
 const chosen=near?[0,1,2,4,5,7,8,10]:seeded?[0,1,2,4,5,7,8,10]:[0,1,2,3,4,6,7,8,10,12,14,16,18,20];
 const heightScale=low?.59:seeded?.91:1;
 for(const sourceLeaf of chosen){
  const root=ROOTS[Math.floor(sourceLeaf/2)%ROOTS.length],upright=[1,4,14].includes(sourceLeaf),height=HEIGHTS[sourceLeaf]*heightScale;
  const reach=(upright?.082+(sourceLeaf%5)*.009:.23+(sourceLeaf%5)*.018)*(low?.72:1);
  const width=(near?.033:low?.034:.030)+(sourceLeaf%3)*.003;
  leafRanges.push(appendArchedMeadowLeaf(P,C,U,I,{root,heading:HEADINGS[sourceLeaf]+(low?.13:0),height,reach,width,upright,sourceLeaf,dry:sourceLeaf%17===0?.15:0,progressive:[0,2,5,6,8,12,16].includes(sourceLeaf),preserveNearMinX:near&&sourceLeaf===8}));
 }
 if(seeded)for(const sourceLeaf of [14,17]){
  const root=ROOTS[Math.floor(sourceLeaf/2)%ROOTS.length],a=HEADINGS[sourceLeaf],h=HEIGHTS[sourceLeaf]*heightScale*.82,reach=.082+(sourceLeaf%5)*.009,width=.0135+(sourceLeaf%4)*.0007,start=P.length/3,indexStart=I.length;
  const points=[[root[0]+Math.sin(a)*width*.78,0,root[1]-Math.cos(a)*width*.78],[root[0]-Math.sin(a)*width*.78,0,root[1]+Math.cos(a)*width*.78],[root[0]+Math.cos(a)*reach,h*.96,root[1]+Math.sin(a)*reach]];
  for(let i=0;i<3;i++){const t=i===2?1:0,shade=.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72);P.push(...points[i]);U.push(i===2?.5:i,t);C.push(shade*.90,shade,shade*.73);}I.push(start,start+1,start+2);
  leafRanges.push({vertexStart:start,vertexCount:3,indexStart,indexCount:3,segments:1,bent:false,creased:false,sourceLeaf,upright:true});
 }
 const emit=(p,u,v,shade,dry=0)=>{P.push(...p);U.push(u,v);C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));};
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

 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(P,3));geometry.setAttribute('color',new T.Float32BufferAttribute(C,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(U,2));geometry.setIndex(I);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.lushMeadow={profile:'lush-meadow-progressive-4',form:profile,leaves:leafRanges.length,requestedLeaves:leafCount,triangles:I.length/3,seedTriangles:seeded?28:0,leafRanges,shape:'Slender stems and original progressive four-stage twisted ribbons'};
 return geometry;
}
