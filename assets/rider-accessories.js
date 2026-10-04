/* Small, independently selectable pieces, fitted to the shared rider skeleton.
   Every mesh belongs to one rider; switching or removing a piece frees its resources. */
import {riderOutfit} from './rider-clothes.js?v=appearance-3';
const item=(id,label,col)=>({id,label,col});
export const RIDER_ACCESSORIES={
 eyewear:[item('none','No glasses','#b8b1a5'),item('round','Round gold','#c9aa65'),item('square','Black frames','#262b34'),item('cateye','Rose cat-eye','#ae596e'),item('tortoise','Tortoiseshell','#815438'),item('aviator','Aviator shades','#b9c4c7'),item('sport','Sport sunglasses','#355f69')],
 earrings:[item('none','No earrings','#b8b1a5'),item('studs','Gold studs','#d1af62'),item('pearls','Pearl studs','#f4e8d5'),item('hoops','Gold hoops','#d1af62'),item('silverhoops','Silver hoops','#bec9d0'),item('drops','Turquoise drops','#53a6a0'),item('stars','Little stars','#d1af62')],
 neckwear:[item('none','No necklace or scarf','#b8b1a5'),item('pendant','Gold pendant','#d1af62'),item('pearls','Pearl necklace','#f4e8d5'),item('layered','Layered chains','#d1af62'),item('choker','Velvet choker','#543945'),item('bandana','Red bandana','#b34a4a'),item('silkscarf','Sage neck scarf','#93a893')],
};
export const accessoryId=(slot,id)=>RIDER_ACCESSORIES[slot]?.some(a=>a.id===id)?id:'none';
export const accessoryFit=fit=>Object.fromEntries(Object.keys(RIDER_ACCESSORIES).map(slot=>[slot,accessoryId(slot,fit?.[slot])]));

export function buildAccessories(THREE,kit,bones,fit){
 const roots=[],H=kit.head,V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const material=(col,metal=false)=>new THREE.MeshStandardMaterial({color:col,roughness:metal?.27:.64,metalness:metal?.72:0,side:THREE.DoubleSide});
 const attach=(slot,bone)=>{const g=new THREE.Group();g.name='accessory-'+slot+'-'+fit[slot];bones[bone].add(g);roots.push(g);return g;};
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
   const p=V(sd*(H.rx+.002),H.browTop-.072,H.cz-.002);
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
  const id=fit.neckwear,g=attach('neckwear','spine_03'),ny=kit.zones.neckY,mat=material(RIDER_ACCESSORIES.neckwear.find(x=>x.id===id).col,id==='pendant'||id==='layered');
  // Project onto the actual neck/chest instead of an ellipse floating in front of it.
  const probeMat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),probe=new THREE.Mesh(kit.skin.geometry,probeMat),ray=new THREE.Raycaster();probe.updateMatrixWorld(true);
  const ease=riderOutfit(fit.outfit).cut==='sweater'?.038:.026;
  const point=(a,drop=.105)=>{
   const front=(Math.cos(a)+1)*.5,y=ny+.068-drop*Math.pow(front,2),x=Math.sin(a)*(.057+.030*front*drop/.105);
   ray.set(V(x,y,.5),V(0,0,-1));const fore=ray.intersectObject(probe,false)[0];
   ray.set(V(x,y,-.5),V(0,0,1));const back=ray.intersectObject(probe,false)[0];
   const pad=y<ny+.008?ease:.006;
   const z=fore&&back?(back.point.z-pad)*(1-front)+(fore.point.z+pad)*front:-.03+Math.cos(a)*(.066+pad);
   return V(x,y,z);
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
  // The pieces were authored in bind-world metres; move them into the chest bone's frame.
  const inv=kit.bones.spine_03.matrixWorld.clone().invert();g.traverse(m=>{if(m.isMesh)m.geometry.applyMatrix4(inv);});
  probeMat.dispose();
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
 return {roots,dispose(){const geos=new Set(),mats=new Set();for(const g of roots){g.removeFromParent();g.traverse(m=>{if(m.isMesh){geos.add(m.geometry);mats.add(m.material);}});}geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
