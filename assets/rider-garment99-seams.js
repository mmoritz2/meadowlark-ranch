// An actual armhole sewing ribbon, owned by the sleeve's material chart.
// It follows the joined surface and its field; no source body or shading mask.
export function garment99ShoulderSeams(T,garment,data,color){
 const g=garment.geometry,a=g.attributes,chart=data.construction93.perVertexMaterialChart,V=()=>new T.Vector3(),get=['getX','getY','getZ','getW'],pieces=[];
 for(const side of ['l','r']){
  const ordered=chart.flatMap((c,i)=>c.piece==='sleeve'&&c.side===side&&c.row===0?[[i,c.column]]:[]).sort((x,y)=>x[1]-y[1]);
  const ids=[...new Map(ordered.map(x=>[x[1],x[0]])).values()];if(ids.length<12)throw Error('Garment99 actual sewing chart missing');
  const p=[],j=[],w=[],idx=[];
  for(let k=0;k<ids.length;k++){
   const i=ids[k],point=V().fromBufferAttribute(a.position,i),n=V().fromBufferAttribute(a.normal,i).normalize(),tangent=V().fromBufferAttribute(a.position,ids[(k+1)%ids.length]).sub(V().fromBufferAttribute(a.position,ids[(k+ids.length-1)%ids.length])).normalize(),across=V().crossVectors(n,tangent).normalize();
   for(const sign of [-1,1]){const q=point.clone().addScaledVector(n,.00055).addScaledVector(across,sign*.00038);p.push(...q.toArray());for(const key of get){j.push(a.skinIndex[key](i));w.push(a.skinWeight[key](i));}}
  }
  for(let k=0;k<ids.length;k++){const x=k*2,y=((k+1)%ids.length)*2;idx.push(x,y,x+1,y,y+1,x+1);}
  const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(p,3));out.setAttribute('skinIndex',new T.Uint16BufferAttribute(j,4));out.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));out.setIndex(idx);out.computeVertexNormals();out.computeBoundingSphere();
  pieces.push({name:'Garment99_Armhole_Sewing_'+side,geometry:out,material:new T.MeshStandardMaterial({color:new T.Color(color).multiplyScalar(.80),roughness:.94,side:T.DoubleSide}),skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 }
 return pieces;
}
