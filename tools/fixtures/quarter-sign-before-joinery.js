 function indexed(g){
  if(!g.index){const n=g.attributes.position.count,a=n>65535?new Uint32Array(n):new Uint16Array(n);
   for(let i=0;i<n;i++)a[i]=i;g.setIndex(new THREE.BufferAttribute(a,1));}
  return g;
 }
 function bake(g,shadow,prepared=false){
  if(!prepared){const token=workshop.prepareBake(g);if(token)return workshop.legacyBake(token,()=>bake(g,shadow,true));}
  g.updateMatrixWorld(true);
  const byMat=new Map();let n=0;
  g.traverse(o=>{
   if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;
   const geo=o.geometry;if(!geo.index||!geo.attributes.normal||!geo.attributes.uv)return;
   const c=geo.clone();if(!c.userData.workshopUV)setQuarterPrimitiveUV(c,o.scale,o.position,o.material.userData.quarterSurface);c.applyMatrix4(o.matrixWorld);
   for(const k of Object.keys(c.attributes))if(k!=='position'&&k!=='normal'&&k!=='uv')c.deleteAttribute(k);
   const e=byMat.get(o.material)||{list:[],cast:false};
   e.list.push(c);e.cast=e.cast||o.castShadow;byMat.set(o.material,e);n++;
  });
  const out=[];
  for(const [m,e] of byMat){
   const merged=mergeGeometries(e.list,false);e.list.forEach(c=>c.dispose());if(!merged)continue;
   const mesh=own(new THREE.Mesh(merged,m));mesh.name='quarter_baked';
   mesh.castShadow=shadow!==false&&e.cast;mesh.receiveShadow=true;
   scene.add(mesh);out.push(mesh);
   if(P.millPondSource){if(m===P.millPondSource.waterMaterial)P.millPondSource.water=mesh;if(m===P.millPondSource.bankMaterial)P.millPondSource.bank=mesh;}
  }
  if(g.parent)g.parent.remove(g);
  P.mergedFrom+=n;P.draws+=out.length;
  return out;
 }
 function signboard(g,text,w){
  w=w||3.4;
  try{const s=W.arrivalArt.buildSign({text,width:w,height:0.5});s.position.y=2.9;g.add(s);}catch(e){}
  cy(g,'#6b5334',-w/2-0.2,1.45,0,0.09,2.9);cy(g,'#6b5334',w/2+0.2,1.45,0,0.09,2.9);
  bx(g,'#6b5334',0,3.34,0,w+0.7,0.14,0.16);
 }
