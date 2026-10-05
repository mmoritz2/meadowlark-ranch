/* Bind-pose facial refinements. Joint locations, weights and the scalp stay fixed,
   so the existing animations, helmet and saved appearances continue to fit. */
export function refineRiderFace(THREE,skin,brows,body){
 const geometry=skin.geometry;if(geometry.userData.faceRefined)return;geometry.userData.faceRefined=true;
 const head=skin.skeleton.bones.findIndex(b=>b.name==='Head'),inverse=skin.skeleton.boneInverses[head],bind=inverse.clone().invert(),p=geometry.attributes.position,v=new THREE.Vector3();
 const bell=(x,center,width)=>Math.exp(-1*((x-center)/width)**2);
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).applyMatrix4(inverse);
  if(v.y<-.015||v.y>.13||v.z<.038)continue;
  const cheek=bell(Math.abs(v.x),.046,.027)*bell(v.y,.055,.030);
  const nose=bell(v.x,0,.012)*bell(v.y,.084,.032)*Math.max(0,Math.min(1,(v.z-.090)/.025));
  // Fill the sharply cut cheek plane a little and soften the projecting nose tip.
  v.z+=cheek*(body==='f'?.0028:.0018)-nose*.0025;
  v.applyMatrix4(bind);p.setXYZ(i,v.x,v.y,v.z);
 }
 p.needsUpdate=true;smoothNormals(geometry);geometry.computeBoundingSphere();
 if(!brows)return;
 const bp=brows.geometry.attributes.position;let min=Infinity,max=0,mean=0;
 for(let i=0;i<bp.count;i++){const x=Math.abs(bp.getX(i));min=Math.min(min,x);max=Math.max(max,x);mean+=bp.getY(i);}mean/=bp.count;
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surface=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,0,-1);surface.updateMatrixWorld(true);
 const positions=[],uv=[],joints=[],weights=[],indices=[],columns=32,rows=5,joint=brows.skeleton.bones.findIndex(b=>b.name==='Head');
 for(const side of [-1,1]){const offset=positions.length/3;
  for(let i=0;i<=columns;i++){const t=i/columns,x=side*(min+(max-min)*t),center=mean+.003+.006*Math.sin(t*Math.PI)-.004*t;
   const width=(body==='m'?.0038:.0032)*Math.pow(Math.max(.015,1-t),.50)*(.8+.2*Math.sin(t*Math.PI));
   for(let j=0;j<rows;j++){const across=j/(rows-1)*2-1,y=center+across*width;
    ray.set(new THREE.Vector3(x,y,.6),direction);const hit=ray.intersectObject(surface,false)[0];
    positions.push(x,y,(hit?hit.point.z:.09)+.0006+.0007*(1-across*across));uv.push(t,j/(rows-1));joints.push(joint,0,0,0);weights.push(1,0,0,0);
    if(i<columns&&j<rows-1){const k=offset+i*rows+j;side>0?indices.push(k,k+rows,k+1,k+1,k+rows,k+rows+1):indices.push(k,k+1,k+rows,k+1,k+rows+1,k+rows);}
   }
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();brows.geometry=geo;material.dispose();

}
function smoothNormals(geometry){
 geometry.computeVertexNormals();const p=geometry.attributes.position,n=geometry.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(!groups.has(key))groups.set(key,{indices:[],x:0,y:0,z:0});const g=groups.get(key);g.indices.push(i);g.x+=n.getX(i);g.y+=n.getY(i);g.z+=n.getZ(i);}
 for(const g of groups.values()){const length=Math.hypot(g.x,g.y,g.z)||1;for(const i of g.indices)n.setXYZ(i,g.x/length,g.y/length,g.z/length);}n.needsUpdate=true;
}
