// Render-only cells for the two fixed flora desert banks. Canonical rows retain
// their IDs, counts, colors and clearing/quality authority; no distance cutoff.
export function createDesertPlantRenderCells({THREE:T,owners,enabled=false}){
 const state={status:enabled?'waiting':'disabled',reason:null,owners:[],install,refresh,dispose,retain};
 let closed=false;
 if(!enabled)return state;
 const hooks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
 const shapes={oco:{kind:'ocotillo',high:[1854,1476],low:[390,498]},succ:{kind:'agave',high:[600,700],low:[225,240]}};
 const point=(a,o)=>[0,1,2,4,5,6,8,9,10].every(i=>a[o+i]===0);
 const finiteSphere=s=>s&&s.radius>0&&[s.radius,s.center.x,s.center.y,s.center.z].every(Number.isFinite);
 const defaults=m=>hooks.every(k=>m[k]===T.Object3D.prototype[k]);
 const templateValid=(g,spec,detail)=>g?.isBufferGeometry&&g.userData.desertArt?.kind===spec.kind&&g.userData.desertArt.variant===0&&g.userData.desertArt.detail===detail&&g.userData.desertArt.triangles===(detail?spec.high[1]:spec.low[1])&&g.attributes.position?.count===(detail?spec.high[0]:spec.low[0])&&g.index?.count===(detail?spec.high[1]:spec.low[1])*3&&finiteSphere(g.boundingSphere)&&!Object.keys(g.morphAttributes).length;
 function materialValid(m){return m?.isMeshStandardMaterial&&m.name==='Desert | botanical surfaces'&&m.vertexColors&&!m.transparent&&m.opacity===1&&m.alphaTest===0&&!m.displacementMap&&m.onBeforeCompile===T.Material.prototype.onBeforeCompile;}
 function retain(reason,status='retained-original'){
  if(closed)return state;closed=true;
  for(const o of state.owners){
   o.source.removeEventListener('removed',o.onRemoved);o.source.removeEventListener('dispose',o.onRemoved);
   for(const cell of o.cells){cell.mesh?.removeFromParent();cell.mesh?.dispose();}
   if(o.leased&&o.source.layers.mask===0)o.source.layers.mask=o.layerMask;
  }
  state.status=status;state.reason=String(reason?.message||reason);return state;
 }
 function dispose(){return retain('disposed','disposed');}
 function sourceValid(o){
  const m=o.source;
  return (o.leased?m.children.length===o.cells.length&&o.cells.every(c=>c.mesh?.parent===m):m.children.length===0)&&o.bank.im===m&&o.bank.n===o.rows&&o.bank.cap===o.capacity&&m.parent===o.parent&&m.material===o.material&&materialValid(m.material)&&m.instanceMatrix===o.matrix&&m.instanceColor===o.color&&m.instanceMatrix.count===o.capacity&&m.instanceColor.count===o.capacity&&m.layers.mask===(o.leased?0:o.layerMask)&&m.castShadow===o.castShadow&&m.receiveShadow===o.receiveShadow&&m.frustumCulled===o.frustumCulled&&m.renderOrder===o.renderOrder&&m.customDepthMaterial===o.customDepthMaterial&&m.customDistanceMaterial===o.customDistanceMaterial&&defaults(m)&&!m.morphTexture&&Number.isInteger(m.count)&&m.count>=0&&m.count<=o.rows&&(m.geometry===o.high||m.geometry===o.low);
 }
 function prepare(o){
  if(!sourceValid(o))throw Error('Desert source identity/quality/flags changed');
  const a=o.matrix.array,c=o.color.array,bits=new Uint32Array(a.buffer,a.byteOffset,a.length),colors=new Uint32Array(c.buffer,c.byteOffset,c.length);
  for(let i=0;i<o.rows;i++){
   const at=i*16;for(let j=0;j<16;j++)if(!Number.isFinite(a[at+j]))throw Error('Nonfinite desert source row');
   if(a[at+3]!==0||a[at+7]!==0||a[at+11]!==0||a[at+15]!==1)throw Error('Nonaffine desert source row');
   // Only known point retirements or byte-exact original rows are supported.
   if(!point(a,at))for(let j=0;j<16;j++)if(bits[at+j]!==o.originalBits[at+j])throw Error('Desert source moved or reshaped');
   for(let j=0;j<3;j++)if(!Number.isFinite(c[i*3+j])||colors[i*3+j]!==o.colorBits[i*3+j])throw Error('Desert source color changed');
  }
  for(const [g,attrs,index,version]of o.templates){if(g.index!==index||index.version!==version||Object.values(g.attributes).length!==attrs.length||attrs.some(([key,a,v])=>g.attributes[key]!==a||a.version!==v))throw Error('Desert template changed');}
 }
 function fill(o){
  const a=o.matrix.array,c=o.color.array,sphere=new T.Sphere();
  for(const cell of o.cells){
   const mesh=cell.mesh;mesh.geometry=o.source.geometry;let n=0,bound=null;
   for(const id of cell.rowIDs){if(id>=o.source.count||point(a,id*16))continue;
    const row=mesh.instanceMatrix.array.subarray(n*16,n*16+16);row.set(a.subarray(id*16,id*16+16));mesh.instanceColor.array.set(c.subarray(id*3,id*3+3),n*3);cell.sourceIndices[n++]=id;
    const e=row,p=o.template.center;
    sphere.center.set(e[0]*p.x+e[4]*p.y+e[8]*p.z+e[12],e[1]*p.x+e[5]*p.y+e[9]*p.z+e[13],e[2]*p.x+e[6]*p.y+e[10]*p.z+e[14]);
    // Frobenius norm conservatively bounds the affine sphere radius, including
    // nonuniform scale and Float32 round-off shear. Both quality templates fit.
    sphere.radius=o.template.radius*Math.hypot(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]);
    if(bound)bound.union(sphere);else bound=sphere.clone();
   }
   mesh.count=n;mesh.visible=n>0;mesh.boundingSphere=bound||new T.Sphere(new T.Vector3(),0);mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  }
 }
 function refresh(){
  if(closed||state.status!=='applied')return false;
  try{for(const o of state.owners)prepare(o);for(const o of state.owners)fill(o);return true;}catch(error){retain(error);return false;}
 }
 function install(){
  if(closed||state.status!=='waiting')return state;
  try{
   for(const o of state.owners){
    o.low=o.lowSource();
    if(!templateValid(o.high,shapes[o.kind],true)||!templateValid(o.low,shapes[o.kind],false))throw Error('Unsupported desert quality templates');
    o.template=o.high.boundingSphere.clone().union(o.low.boundingSphere);
    o.templates=[o.high,o.low].map(g=>[g,Object.entries(g.attributes).map(([key,a])=>[key,a,a.version]),g.index,g.index.version]);
    prepare(o);
    for(const cell of o.cells){
     const mesh=new T.InstancedMesh(o.source.geometry,o.material,cell.rowIDs.length);cell.mesh=mesh;cell.sourceIndices=new Uint32Array(cell.rowIDs.length);
     mesh.name='flora_'+o.kind+':courseDryCell:'+cell.key;mesh.userData.desertPlantRenderCell={kind:o.kind,key:cell.key};mesh.layers.mask=o.layerMask;mesh.castShadow=o.castShadow;mesh.receiveShadow=o.receiveShadow;mesh.frustumCulled=true;mesh.renderOrder=o.renderOrder;mesh.customDepthMaterial=o.customDepthMaterial;mesh.customDistanceMaterial=o.customDistanceMaterial;
     mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(cell.rowIDs.length*3),3);mesh.updateMatrix();mesh.matrixAutoUpdate=false;
    }
    fill(o);
   }
   // Publish after both owners are prepared, without awaits or source row writes.
   for(const o of state.owners){o.source.layers.mask=0;o.leased=true;for(const cell of o.cells)o.source.add(cell.mesh);o.source.addEventListener('removed',o.onRemoved);o.source.addEventListener('dispose',o.onRemoved);}
   state.status='applied';return state;
  }catch(error){return retain(error);}
 }
 // Capture before path/course retirement, using only arrays and existing refs.
 // No Three constructor/UUID allocation or global RNG swap occurs here.
 try{
  if(owners.length!==2||new Set(owners.map(o=>o.kind)).size!==2)throw Error('Expected exact two desert owners');
  for(const input of owners){
   const {kind,bank,high,low}=input,m=bank.im,spec=shapes[kind];
   if(!spec||m?.name!=='flora_'+kind||!m.isInstancedMesh||!m.parent||m.children.length||!Number.isInteger(bank.n)||bank.n<=0||bank.n>bank.cap||!m.frustumCulled||m.layers.mask===0||!defaults(m)||m.morphTexture||!materialValid(m.material)||!templateValid(high,spec,true)||!(m.instanceMatrix?.array instanceof Float32Array)||m.instanceMatrix.itemSize!==16||m.instanceMatrix.count!==bank.cap||!(m.instanceColor?.array instanceof Float32Array)||m.instanceColor.itemSize!==3||m.instanceColor.count!==bank.cap)throw Error('Unsupported canonical desert bank');
   const original=m.instanceMatrix.array.slice(0,bank.n*16),color=m.instanceColor.array.slice(0,bank.n*3),bins=new Map();
   for(let i=0;i<bank.n;i++){
    const at=i*16;if(!original.subarray(at,at+16).every(Number.isFinite)||original[at+3]!==0||original[at+7]!==0||original[at+11]!==0||original[at+15]!==1)throw Error('Invalid original desert row');
    const key=Math.floor(original[at+12]/32)+','+Math.floor(original[at+14]/32);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);
   }
   const o={kind,bank,source:m,parent:m.parent,rows:bank.n,capacity:bank.cap,matrix:m.instanceMatrix,color:m.instanceColor,material:m.material,high,low:null,lowSource:low,templates:[],originalBits:new Uint32Array(original.buffer),colorBits:new Uint32Array(color.buffer),layerMask:m.layers.mask,castShadow:m.castShadow,receiveShadow:m.receiveShadow,frustumCulled:m.frustumCulled,renderOrder:m.renderOrder,customDepthMaterial:m.customDepthMaterial,customDistanceMaterial:m.customDistanceMaterial,leased:false,cells:[...bins].map(([key,rowIDs])=>({key,rowIDs,mesh:null,sourceIndices:null})),onRemoved:()=>retain('Desert source removed or disposed')};state.owners.push(o);
  }
 }catch(error){retain(error);}
 return state;
}
