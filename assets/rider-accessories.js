/* Small, independently selectable pieces, fitted to the shared rider skeleton.
   Every mesh belongs to one rider; switching or removing a piece frees its resources. */
import {scalpPoint} from './rider-hairstyles.js?v=hair-20261005b';
import {surfaceSampler} from './rider-fit.js?v=art-20261005';
const item=(id,label,col)=>({id,label,col});
export const RIDER_ACCESSORIES={
 eyewear:[item('none','No glasses','#b8b1a5'),item('round','Round gold','#c9aa65'),item('square','Black frames','#262b34'),item('cateye','Rose cat-eye','#ae596e'),item('tortoise','Tortoiseshell','#815438'),item('aviator','Aviator shades','#b9c4c7'),item('sport','Sport sunglasses','#355f69')],
 earrings:[item('none','No earrings','#b8b1a5'),item('studs','Gold studs','#d1af62'),item('pearls','Pearl studs','#f4e8d5'),item('hoops','Gold hoops','#d1af62'),item('silverhoops','Silver hoops','#bec9d0'),item('drops','Turquoise drops','#53a6a0'),item('stars','Little stars','#d1af62')],
 neckwear:[item('none','No necklace or scarf','#b8b1a5'),item('pendant','Gold pendant','#d1af62'),item('pearls','Pearl necklace','#f4e8d5'),item('layered','Layered chains','#d1af62'),item('choker','Velvet choker','#543945'),item('bandana','Red bandana','#b34a4a'),item('silkscarf','Sage neck scarf','#93a893')],
};
export const accessoryId=(slot,id)=>RIDER_ACCESSORIES[slot]?.some(a=>a.id===id)?id:'none';
export const accessoryFit=fit=>Object.fromEntries(Object.keys(RIDER_ACCESSORIES).map(slot=>[slot,accessoryId(slot,fit?.[slot])]));

export function buildAccessories(THREE,kit,bones,fit,garments=[],parent=null){
 let neckSurface=null;
 const roots=[],H=kit.head,V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const material=(col,metal=false)=>new THREE.MeshStandardMaterial({color:col,roughness:metal?.27:.64,metalness:metal?.72:0,side:THREE.DoubleSide});
 const attach=(slot,bone)=>{const g=new THREE.Group();g.name='accessory-'+slot+'-'+fit[slot];(bone?bones[bone]:parent).add(g);if(!bone)g.userData.skinned=true;roots.push(g);return g;};
 const put=(group,geo,mat)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const tube=(points,r=.0018,closed=false)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed),Math.max(24,points.length*3),r,6,closed);
 const bead=(group,p,r,mat)=>{const g=new THREE.SphereGeometry(r,12,8);g.translate(p.x,p.y,p.z);return put(group,g,mat);};
 const star=(size)=>{const s=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?size*.44:size,x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();return new THREE.ExtrudeGeometry(s,{depth:.002,bevelEnabled:false});};
 if(fit.eyewear!=='none'){
  const id=fit.eyewear,g=attach('eyewear','Head'),record=RIDER_ACCESSORIES.eyewear.find(x=>x.id===id),metal=id==='round'||id==='aviator',mat=material(record.col,metal);
  const y=H.browTop-.022,z=H.cz+H.rz*.84+.010,cx=H.rx*.48;
  const shaded=id==='aviator'||id==='sport',lens=new THREE.MeshStandardMaterial({color:shaded?'#293b42':'#b7d4d3',roughness:.17,metalness:shaded?.12:0,transparent:true,opacity:shaded?.86:.10,depthWrite:false,side:THREE.DoubleSide});
  for(const side of [-1,1]){
   const pts=[],rx=H.rx*.39,ry=id==='sport'?.018:id==='square'||id==='tortoise'?.020:.023;
   for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a);
    let x=cs*rx,dy=sn*ry;
    if(id==='square'||id==='tortoise'){x=Math.sign(cs)*Math.pow(Math.abs(cs),.55)*rx;dy=Math.sign(sn)*Math.pow(Math.abs(sn),.55)*ry;}
    if(id==='cateye')dy+=Math.max(0,x*side)*.40;
    if(id==='aviator')dy-=Math.max(0,-sn)*.005;
    pts.push(V(side*cx+x,y+dy,z-.008*Math.abs(x/rx)));
   }
   put(g,tube(pts,metal?.0017:.0028,true),mat);
   const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(p.x,p.y))),glass=new THREE.ShapeGeometry(shape);glass.translate(0,0,z-.009);put(g,glass,lens);
   put(g,tube([V(side*(cx+rx),y,z-.008),V(side*(H.rx+.004),y+.002,H.cz+.026),V(side*(H.rx+.005),y-.008,H.cz-.032)],.0018),mat);
  }
  put(g,tube([V(-cx+H.rx*.39,y+.003,z),V(0,y+.010,z+.010),V(cx-H.rx*.39,y+.003,z)],.0017),mat);
 }
 if(fit.earrings!=='none'){
  const id=fit.earrings,g=attach('earrings','Head'),mat=material(RIDER_ACCESSORIES.earrings.find(x=>x.id===id).col,id!=='pearls'&&id!=='drops');
  for(const sd of [-1,1]){
   const p=scalpPoint(THREE,kit,V(sd*(H.rx+.002),H.browTop-.072,H.cz-.002),.0008);
   bead(g,p,id==='pearls'?.0055:.0036,mat);
   if(id==='hoops'||id==='silverhoops'){
    const geo=new THREE.TorusGeometry(.015,.0018,8,32);geo.rotateY(sd*.30);geo.translate(p.x,p.y-.013,p.z+.003);put(g,geo,mat);
   }else if(id==='drops'){
    put(g,tube([p,p.clone().add(V(0,-.014,0))],.0011),mat);
    const geo=new THREE.SphereGeometry(1,14,10);geo.scale(.006,.010,.004);geo.translate(p.x,p.y-.019,p.z);put(g,geo,mat);
   }else if(id==='stars'){const geo=star(.008);geo.translate(p.x,p.y-.010,p.z);put(g,geo,mat);}
  }
 }
 if(fit.neckwear!=='none'){
  const id=fit.neckwear,g=attach('neckwear',null),ny=kit.zones.neckY,mat=material(RIDER_ACCESSORIES.neckwear.find(x=>x.id===id).col,id==='pendant'||id==='layered');
  // The chain rests on the outer garment, and the uncovered portion rests on
  // the neck. Radial surface hits stay outside; mixing front/back hits does not.
  const cloth=garments.filter(m=>!/Legs|Feet|Buttons/.test(m.name));
  neckSurface=surfaceSampler(THREE,[...cloth,kit.skin]);
  const cast=(a,y)=>{
   const dir=V(Math.sin(a),0,Math.cos(a)),origin=V(dir.x*.6,y,-.03+dir.z*.6);
   // Never pass through the neck to catch the garment on the opposite side.
   const near=p=>(p.x*dir.x+(p.z+.03)*dir.z)>.005&&Math.hypot(p.x,p.z+.03)<(y>ny+.02?.13:.25);
   const clothing=y<ny+.008&&cloth.length?neckSurface.cast(origin,dir.clone().negate(),(p,src)=>src!==kit.skin&&near(p)):null;
   return clothing||neckSurface.cast(origin,dir.clone().negate(),near);
  };
  const point=(a,drop=.105)=>{
   const front=(Math.cos(a)+1)*.5,y=ny+.083-drop*Math.pow(front,3),hit=cast(a,y);
   return hit?hit.point.clone().addScaledVector(hit.normal,.007):V(Math.sin(a)*.064,y,-.03+Math.cos(a)*.064);
  };
  const necklace=(drop,r=.0015)=>{const pts=[];for(let i=0;i<64;i++)pts.push(point(i/64*Math.PI*2,drop));const smooth=pts.map((p,i)=>p.clone().multiplyScalar(.5).addScaledVector(pts[(i+63)%64],.25).addScaledVector(pts[(i+1)%64],.25));put(g,tube(smooth,r,true),mat);return smooth;};
  if(id==='pendant'||id==='layered'){
   necklace(.105);if(id==='layered')necklace(.155);
   const geo=new THREE.SphereGeometry(1,16,12);geo.scale(.008,.011,.0025);const p=point(0,id==='layered'?.155:.105);geo.translate(p.x,p.y-.010,p.z+.003);put(g,geo,mat);
  }else if(id==='pearls'){
   for(let i=0;i<48;i++)bead(g,point(i/48*Math.PI*2,.085),.0046,mat);
  }else if(id==='choker'){
   necklace(.008,.005);const p=point(0,.008);bead(g,p.clone().add(V(0,-.010,.003)),.005,material('#d1af62',true));
  }else{
   const pos=[],uv=[],idx=[],N=64;
   for(let i=0;i<=N;i++){
    const a=i/N*Math.PI*2,front=Math.pow((Math.cos(a)+1)*.5,5);
    for(let row=0;row<2;row++){
     const p=point(a,.024+row*(id==='bandana'?.09*front+.012:.022));p.z+=.004;
     pos.push(p.x,p.y,p.z);uv.push(i/N,row);
    }
    if(i<N){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();put(g,geo,mat);
   if(id==='silkscarf'){
    const p=point(.52,.06);bead(g,p,.013,mat);
    for(const sd of [-1,1]){
     const vertices=[],indices=[];
     for(let i=0;i<=12;i++){
      const t=i/12,c=point(.52,.06+t*(sd===1?.12:.095));c.x+=sd*(.009+.010*Math.sin(t*2));c.z+=.008;
      vertices.push(c.x-.009,c.y,c.z,c.x+.009,c.y,c.z+.002*Math.sin(t*8));
      if(i<12){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
     }
     const tail=new THREE.BufferGeometry();tail.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));tail.setIndex(indices);tail.computeVertexNormals();put(g,tail,mat);
    }
   }
   // A fine ivory stitched edge helps the fabric read at wardrobe distance.
   const edge=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2,front=Math.pow((Math.cos(a)+1)*.5,5);const p=point(a,.024+(id==='bandana'?.09*front+.012:.022));p.z+=.005;edge.push(p);}put(g,tube(edge,.0012,true),material('#e5d5bc'));
  }

 }
 // One draw call per material, including the many individual necklace pearls.
 for(const group of roots){
  const batches=new Map();for(const m of group.children){if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(m);}
  for(const [mat,meshes] of batches){if(meshes.length<2)continue;
   const source=meshes.map(m=>m.geometry.index?m.geometry.toNonIndexed():m.geometry),merged=new THREE.BufferGeometry();
   for(const key of ['position','normal','uv']){
    const size=key==='uv'?2:3,data=new Float32Array(source.reduce((n,g)=>n+g.attributes.position.count*size,0));let at=0;
    for(const geo of source){const a=geo.attributes[key];if(a)data.set(a.array,at);at+=geo.attributes.position.count*size;}
    merged.setAttribute(key,new THREE.BufferAttribute(data,size));
   }
   source.forEach((geo,i)=>{if(geo!==meshes[i].geometry)geo.dispose();meshes[i].geometry.dispose();group.remove(meshes[i]);});put(group,merged,mat);
  }
 }
 const skinSamples=new Map();
 for(const group of roots)if(group.userData.skinned){
  for(const old of [...group.children]){
   const geo=old.geometry,p=geo.attributes.position,joints=[],weights=[];
   for(let i=0;i<p.count;i++){
    const pos=V(p.getX(i),p.getY(i),p.getZ(i)),radial=V(pos.x,0,pos.z+.03).normalize(),origin=V(radial.x*.6,pos.y,-.03+radial.z*.6);
    const key=[pos.x,pos.y,pos.z].map(v=>Math.round(v*1000)).join(',');
    if(!skinSamples.has(key))skinSamples.set(key,neckSurface.cast(origin,radial.clone().negate(),point=>Math.hypot(point.x,point.z+.03)<.25&&point.x*radial.x+(point.z+.03)*radial.z>.005));
    const hit=skinSamples.get(key);
    if(hit){joints.push(...hit.joints.map(j=>kit.skin.skeleton.bones.findIndex(b=>b.name===hit.source.skeleton.bones[j].name)));weights.push(...hit.weights);}else{joints.push(kit.skin.skeleton.bones.findIndex(b=>b.name==='spine_03'),0,0,0);weights.push(1,0,0,0);}
   }
   geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
   const mesh=new THREE.SkinnedMesh(geo,old.material);mesh.name='Fitted_neckwear';mesh.bind(new THREE.Skeleton(kit.skin.skeleton.bones.map(b=>bones[b.name]),kit.skin.skeleton.boneInverses),kit.skin.bindMatrix);mesh.castShadow=true;mesh.frustumCulled=false;group.remove(old);group.add(mesh);
  }
 }
 if(neckSurface)neckSurface.dispose();
 return {roots,dispose(){const geos=new Set(),mats=new Set();for(const g of roots){g.removeFromParent();g.traverse(m=>{if(m.isMesh){geos.add(m.geometry);mats.add(m.material);if(m.skeleton)m.skeleton.dispose();}});}geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
