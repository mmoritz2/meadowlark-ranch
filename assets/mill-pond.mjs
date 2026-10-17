// Original Amberwood mill-pond shore. Terrain, water level and physical owners stay authoritative.
export const MILL_POND_PROFILE='amberwood-shore-1';
const installed=new WeakMap(),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const millPondImagesReady=m=>!!m&&[m.map,m.normalMap,m.roughnessMap].every(t=>{const i=t?.image;return i&&(i.naturalWidth??i.width)>0&&(i.naturalHeight??i.height)>0;});
export async function waitForMillPondImages(material,{timeout=12000,now=()=>performance.now(),frame=()=>new Promise(resolve=>setTimeout(resolve,40))}={}){const start=now();while(!millPondImagesReady(material)){if(now()-start>=timeout)throw Error('Mill bank resident images missed bounded deadline');await frame();}return true;}
export function millPondRadius(a){return 12.25+.14*Math.sin(3*a+.5)+.06*Math.sin(7*a-1)+.025*Math.cos(11*a);}
export function millPondOuterRadius(a){return 14.82+.48*Math.sin(2*a-.6)+.23*Math.cos(5*a+.9);}
export function buildMillPondData(site,heightAt){
 if(!site||Math.abs(site.r-12.5)>1e-8||![site.x,site.z,site.y].every(Number.isFinite)||typeof heightAt!=='function')throw Error('Original Amberwood pond required');
 const bank={position:[],normal:[],uv:[],color:[],index:[]},water={position:[],normal:[],uv:[],color:[],index:[]},segments=144;
 const add=(out,x,y,z,col)=>{out.position.push(x,y,z);out.normal.push(0,1,0);out.uv.push(x/2.7,z/2.7);out.color.push(...col);};
 const deep=[.045,.105,.095],shallow=[.19,.28,.18];
 // A radial surface with a genuinely unequal perimeter; its mean plane remains the old level.
 for(let j=0;j<=8;j++)for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,t=j/8,r=millPondRadius(a)*t,x=site.x+Math.cos(a)*r,z=site.z+Math.sin(a)*r,edge=smooth((t-.69)/.31);add(water,x,site.y,z,deep.map((v,i)=>v+(shallow[i]-v)*edge));}
 for(let j=0;j<8;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;if(j===0)water.index.push(a,b+1,b);else water.index.push(a,a+1,b+1,a,b+1,b);}
 const rings=[0,.10,.24,.45,.70,1];let maxBankRise=0,maxRadius=0,minOuterGroundGap=Infinity,maxOuterGroundGap=-Infinity;
 for(let j=0;j<rings.length;j++)for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,t=rings[j],inner=millPondRadius(a)-.30,outer=millPondOuterRadius(a),r=inner+(outer-inner)*t,x=site.x+Math.cos(a)*r,z=site.z+Math.sin(a)*r,g=heightAt(x,z);if(!Number.isFinite(g))throw Error('Finite terrain required');
  // A low, rounded mill embankment meets the actual ground, without the old open cylindrical side.
  const crest=site.y+.025+.018*Math.sin(4*a+.7),base=site.y-.095,shore=t<=.10?base+(crest-base)*smooth(t/.10):crest+(g+.012-crest)*smooth((t-.10)/.90),y=Math.max(g+.012,shore);
  const wet=1-smooth(t/.55),v=.76+.12*Math.sin(3*a+2*t)+.05*Math.cos(11*a),col=[v*(1-.25*wet),v*(1-.18*wet),v*(1-.35*wet)];add(bank,x,y,z,col);maxBankRise=Math.max(maxBankRise,y-g);maxRadius=Math.max(maxRadius,r);if(j===rings.length-1){minOuterGroundGap=Math.min(minOuterGroundGap,y-g);maxOuterGroundGap=Math.max(maxOuterGroundGap,y-g);}}
 for(let j=0;j<rings.length-1;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;bank.index.push(a,a+1,b+1,a,b+1,b);}
 const pack=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,k==='index'?new Uint16Array(v):new Float32Array(v)]));
 return{water:pack(water),bank:pack(bank),stats:{segments,waterTriangles:water.index.length/3,bankTriangles:bank.index.length/3,waterLevel:site.y,minWaterRadius:12.025,maxWaterRadius:12.475,maxOuterRadius:maxRadius,maxBankRise,minOuterGroundGap,maxOuterGroundGap,oldOuterRadius:site.r*1.26}};
}
function privateResources(fn){const prior=Math.random;let s=0x6d696c6c;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};try{return fn();}finally{Math.random=prior;}}
export function installMillPond(G,source){
 if(installed.has(source))return installed.get(source);const T=G.THREE,W=G.world,{site,water:oldWater,bank:oldBank}=source||{},stone=W.ranchBuilderArt?.materials.stone;
 if(!oldWater?.isMesh||!oldBank?.isMesh||!oldWater.visible||!oldBank.visible||oldWater.geometry.index?.count!==84||oldBank.geometry.index?.count!==168||!stone?.map||!stone.normalMap||!stone.roughnessMap)throw Error('Original mill pond and resident shore material required');
 if(!millPondImagesReady(stone))throw Error('Resident mill bank images unavailable');
 const data=buildMillPondData(site,W.groundH),owned=[],meshes=[],oldRanges=[oldWater,oldBank].map(o=>({...o.geometry.drawRange}));let normalTexture;
 try{privateResources(()=>{
  // Small intersecting capillary waves: integer frequencies tile exactly, with no dominant wave train.
  const size=128,pixels=new Uint8Array(size*size*4),waves=[[3,2,.035,.1],[-2,5,.023,1.7],[7,-4,.012,2.4],[-6,-9,.009,.8],[13,3,.005,4.2],[5,17,.004,3.1]];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*Math.PI*2,v=y/size*Math.PI*2;let dx=0,dz=0;for(const[kx,kz,amplitude,phase]of waves){const slope=amplitude*Math.cos(kx*u+kz*v+phase);dx+=kx*slope;dz+=kz*slope;}const l=Math.hypot(dx,dz,1),i=(y*size+x)*4;pixels.set([Math.round((-.5*dx/l+.5)*255),Math.round((-.5*dz/l+.5)*255),Math.round((.5/l+.5)*255),255],i);}
  normalTexture=new T.DataTexture(pixels,size,size);normalTexture.wrapS=normalTexture.wrapT=T.RepeatWrapping;normalTexture.magFilter=normalTexture.minFilter=T.LinearFilter;normalTexture.needsUpdate=true;owned.push(normalTexture);
  const waterMaterial=new T.MeshPhysicalMaterial({name:'Amberwood | shaded ripple water',color:'#d1e8e2',vertexColors:true,roughness:.34,metalness:0,specularIntensity:.22,clearcoat:.08,clearcoatRoughness:.38,normalMap:normalTexture,normalScale:new T.Vector2(.14,.14),transparent:true,opacity:.95,depthWrite:false,envMapIntensity:.40});owned.push(waterMaterial);
  const bankMaterial=new T.MeshStandardMaterial({name:'Amberwood | damp irregular mill bank',color:'#918768',vertexColors:true,map:stone.map,normalMap:stone.normalMap,roughnessMap:stone.roughnessMap,normalScale:new T.Vector2(.15,.15),roughness:1,metalness:0,envMapIntensity:.55});owned.push(bankMaterial);
  for(const[kind,arrays,material]of[['bank',data.bank,bankMaterial],['water',data.water,waterMaterial]]){const geo=new T.BufferGeometry();owned.push(geo);for(const[k,a]of Object.entries(arrays))if(k==='index')geo.setIndex(new T.BufferAttribute(a,1));else geo.setAttribute(k,new T.BufferAttribute(a,k==='uv'?2:3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();const mesh=new T.Mesh(geo,material);mesh.name='Amberwood mill pond | '+kind;mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.collisionIgnore=true;mesh.renderOrder=kind==='water'?1:0;meshes.push(mesh);}
 });}catch(error){for(const r of owned)r.dispose();throw error;}
 const state={profile:MILL_POND_PROFILE,status:'ready',site:{...site},...data.stats,meshes,newMeshes:2,newGeometries:2,newMaterials:2,newTextures:1,geometryBytes:meshes.reduce((sum,m)=>sum+m.geometry.index.array.byteLength+Object.values(m.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0),0),disposed:false};
 for(const m of meshes)G.scene.add(m);oldWater.geometry.setDrawRange(0,0);oldBank.geometry.setDrawRange(0,0);state.update=t=>{normalTexture.offset.set(t*.004,t*.002);};state.dispose=()=>{if(state.disposed)return;state.disposed=true;for(let i=0;i<2;i++)[oldWater,oldBank][i].geometry.setDrawRange(oldRanges[i].start,oldRanges[i].count);for(const m of meshes)G.scene.remove(m);for(const r of owned)r.dispose();installed.delete(source);};installed.set(source,state);return state;
}
