// Conditional mixed-sward V3 art prototype with narrower arched leaves. No import-time resources, RNG, terrain or collision edits.
// Resident CC0 Poly Haven grass_medium_02 specimens; source material/maps remain owned by ranch-world-details.
export const MIXED_SWARD = Object.freeze({high:96,medium:48,low:0,radius:18,partingRadius:1.75,fadeZeroRadius:39.48,retireRadius:40.98,sourceTriangles:40,sourceGeometryBytes:2704,richTriangles:70,maxTriangleRatio:1.20,variantTriangles:Object.freeze([450,649,595,633,626]),variantVertices:Object.freeze([432,716,614,743,710]),assetSha256:'357008b2584a93e6db0709faadac7b41745843dbffc38b09b230b4f3bb514902'});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const now=()=>globalThis.performance?.now()??Date.now();
export function swardHash(x,z,salt=0){let h=(Math.imul(Math.round(x*1000),374761393)^Math.imul(Math.round(z*1000),668265263)^Math.imul(salt+1,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
export function swardPatchAt(x,z){const a=x/5.7,b=z/5.7,ix=Math.floor(a),iz=Math.floor(b),f=a-ix,g=b-iz,u=f*f*(3-2*f),v=g*g*(3-2*g);const h=(i,j)=>swardHash(i,j,11);const q=(h(ix,iz)*(1-u)+h(ix+1,iz)*u)*(1-v)+(h(ix,iz+1)*(1-u)+h(ix+1,iz+1)*u)*v;return clamp((q-.28)/.43,0,1);}

// Classification is cached per original cell fill version, not globally per window or per movement.
export function prepareSwardRows(cells,{canBasal=()=>true,cellCache=new WeakMap()}={}){
 const start=now(),rows=[];let classified=0,reused=0,index=0;
 for(let cellIndex=0;cellIndex<cells.length;cellIndex++){const c=cells[cellIndex];if(!Number.isInteger(c.count)||c.count<0||c.count*16>c.matrices.length||c.count*3>c.colors.length)throw Error('Invalid source cell count');let cached=cellCache.get(c);
  if(!cached||cached.version!==c.version||cached.count!==c.count){const list=[];for(let row=0;row<c.count;row++){const o=row*16,x=c.matrices[o+12],y=c.matrices[o+13],z=c.matrices[o+14];if(!Number.isFinite(x+y+z))throw Error('Nonfinite source root');const warm=!!canBasal(x,z),basal=warm&&swardHash(x,z,19)<.75,variant=Math.min(4,Math.floor(swardHash(x,z,2)*5)),scaleY=Math.hypot(c.matrices[o+4],c.matrices[o+5],c.matrices[o+6]);list.push({cellIndex,row,x,y,z,richEligible:basal,basal,variant,height:(.32+.20*swardHash(x,z,3))*clamp(scaleY,.65,1.25),accent:null,accentCandidate:basal&&swardHash(x,z,1)<.045*swardPatchAt(x,z)});classified++;}cached={version:c.version,count:c.count,rows:list};cellCache.set(c,cached);}else reused+=cached.count;
  for(const r of cached.rows){r.sourceIndex=index++;rows.push(r);}
 }
 return {rows,classifiedRoots:classified,reusedRoots:reused,eligibilityMs:now()-start};
}
// Preserve tall volume at some original roots and a fuller mixed-height family at the remainder.
// Higher geometry is funded by zero-faded source rows first, then an explicit <=20% near-layer allowance.
export function planMixedSward(cells,{x,z,quality='high',vr=false,canBasal=()=>true,canAccent=()=>true,metadata=null}={}){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Finite sward centre required');
 const meta=metadata||prepareSwardRows(cells,{canBasal}),rows=meta.rows,outer=[],candidates=[];let accentChecks=0;
 const active=!vr&&['high','medium'].includes(quality);
 for(const r of rows){const d2=(r.x-x)**2+(r.z-z)**2;r.d2=d2;r.basal=active&&r.richEligible;r.triangles=r.basal?MIXED_SWARD.richTriangles:MIXED_SWARD.sourceTriangles;if(!vr&&d2>=MIXED_SWARD.retireRadius**2)outer.push(r);
  if(active&&r.basal&&r.accentCandidate&&d2>=MIXED_SWARD.partingRadius**2&&d2<=MIXED_SWARD.radius**2){accentChecks++;if(canAccent(r.x,r.z,.65))candidates.push({...r,triangles:MIXED_SWARD.variantTriangles[r.variant]});}
 }
 const cap=active?(MIXED_SWARD[quality]??0):0;outer.sort((a,b)=>b.d2-a.d2||a.sourceIndex-b.sourceIndex);candidates.sort((a,b)=>a.d2-b.d2||a.sourceIndex-b.sourceIndex);
 const originalTriangles=(vr?Math.floor(rows.length*.5):rows.length)*MIXED_SWARD.sourceTriangles,budgetMaxTriangles=active?Math.floor(originalTriangles*MIXED_SWARD.maxTriangleRatio):originalTriangles;
 let richTriangles=rows.reduce((n,r)=>n+r.triangles,0),scanTriangles=0;const scans=[];
 const available=Math.max(0,budgetMaxTriangles-richTriangles+outer.reduce((n,r)=>n+r.triangles,0));
 for(const c of candidates){if(scans.length===cap)break;if(scanTriangles+c.triangles>available)continue;scans.push(c);scanTriangles+=c.triangles;}
 let needed=Math.max(0,richTriangles+scanTriangles-budgetMaxTriangles),retiredTriangles=0;const retired=[];for(const r of outer){if(retiredTriangles>=needed)break;retired.push(r);retiredTriangles+=r.triangles;}
 const retiredSet=new Set(retired.map(r=>r.sourceIndex));let fallbackRoots=0;
 // If a narrow eligible window lacks enough invisible rows, keep source tall tufts rather than erase visible grass.
 if(retiredTriangles<needed){for(const r of rows.filter(r=>r.basal&&!retiredSet.has(r.sourceIndex)).sort((a,b)=>b.d2-a.d2)){r.basal=false;r.triangles=MIXED_SWARD.sourceTriangles;richTriangles-=MIXED_SWARD.richTriangles-MIXED_SWARD.sourceTriangles;fallbackRoots++;if(richTriangles+scanTriangles-retiredTriangles<=budgetMaxTriangles)break;}}
 const near=[],basal=[];for(const r of rows)if(!retiredSet.has(r.sourceIndex))(r.basal?basal:near).push(r);if(vr)near.length=Math.floor(near.length*.5);
 const submittedTriangles=near.length*MIXED_SWARD.sourceTriangles+basal.length*MIXED_SWARD.richTriangles+scanTriangles;
 if(submittedTriangles>budgetMaxTriangles)throw Error('Mixed sward exceeded explicit near-layer budget');
 return {near,basal,scans,retired,stats:{sourceRoots:rows.length,nearRoots:near.length,basalRoots:basal.length,scanRoots:scans.length,scanCap:cap,eligibleScanRoots:candidates.length,zeroFadedAvailable:outer.length,retiredRoots:retired.length,retiredTriangles,scanTriangles,submittedTriangles,sourceSubmittedTriangles:originalTriangles,budgetMaxTriangles,triangleDelta:submittedTriangles-originalTriangles,richFallbackRoots:fallbackRoots,classifiedRoots:meta.classifiedRoots,reusedEligibilityRoots:meta.reusedRoots,accentChecks}};
}

export function createBasalSwardGeometry(T) {
  const positions = [], colors = [], uvs = [], indices = [];
  const roots = [[-.072, -.051], [.056, -.089], [.091, .047], [-.044, .089], [.007, .013]];
  // Lower bowed leaves sit between three retained graceful taller leaves.
  const heights = [.28, .62, .46, .34, .56, .70, .38, .53, .31, .77];
  const bends = [.22, .23, .26, .245, .24, .28, .225, .255, .23, .285];
  const headings = [.22, 1.08, .56, 2.02, 2.48, 3.30, 3.57, 4.62, 5.17, 5.63];
  const curls = [.041, -.028, .052, -.063, -.035, .047, -.054, .031, .058, -.043];
  const turns = [.12, -.17, .07, -.09, .20, -.04, -.18, .11, -.08, .16];
  // More samples around the arch keep the final segment from making a knee.
  const samples = [0, .34, .63, .84, 1];
  const segments = 4;

  for (let leaf = 0; leaf < heights.length; leaf++) {
    const root = roots[leaf % roots.length];
    // Each pair shares a small root neighbourhood without a radial rosette.
    const rootX = root[0] + (leaf < 5 ? -.004 : .006);
    const rootZ = root[1] + (leaf % 3 - 1) * .004;
    const heading = headings[leaf] + turns[leaf] * .65;
    const dx = Math.cos(heading), dz = Math.sin(heading);
    const sx = -dz, sz = dx;
    const height = heights[leaf], bend = bends[leaf], curl = curls[leaf];
    const width = 1.2 * (.011 + (leaf % 4) * .0023);
    const low = height < .5, tipHeight = height * (low ? .76 : .89);
    const twist = (leaf % 2 ? -1 : 1) * (.12 + (leaf % 3) * .055);
    const base = positions.length / 3;

    for (let ring = 0; ring <= segments; ring++) {
      const t = samples[ring], rest = 1 - t;
      // Cubic Bezier: upright emergence, gradual bow and a gently falling tip.
      const b1 = 3 * rest * rest * t, b2 = 3 * rest * t * t, b3 = t * t * t;
      const lean = bend * (.025 * b1 + .46 * b2 + b3);
      const sideways = curl * (.28 * b2 + b3);
      const centerX = rootX + dx * lean + sx * sideways;
      const centerY = height * ((low ? .58 : .62) * b1 + (low ? .98 : 1.02) * b2) + tipHeight * b3;
      const centerZ = rootZ + dz * lean + sz * sideways;
      // A continuous taper avoids a broad central diamond and blunt knees.
      const halfWidth = width * (.52 + .78 * Math.sin(Math.PI * t * .88)) * Math.pow(rest, .72);
      const sideHeading = heading + twist * t * t;
      const sideX = -Math.sin(sideHeading), sideZ = Math.cos(sideHeading);
      const tip = ring === segments;

      for (const side of tip ? [0] : [-1, 1]) {
        positions.push(centerX + sideX * halfWidth * side, centerY, centerZ + sideZ * halfWidth * side);
        const shade = .57 + .43 * Math.sin(t * Math.PI * .5), dry = leaf === 0;
        colors.push(shade * (dry ? 1.02 : .90), shade * (dry ? .96 : 1), shade * (dry ? .57 : .73));
        uvs.push((side + 1) / 2, t);
      }
      if (ring < segments - 1) {
        const k = base + ring * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      } else if (ring === segments - 1) {
        const k = base + ring * 2;
        indices.push(k, k + 1, k + 2);
      }
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Indexed rings share the area-weighted normals of the actual Float32 faces.
  // No fabricated upward normal or independent dark reverse-face material.
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Read only the frozen five geometry primitives. Images/materials in the GLB are never decoded or created.
export function readSwardSpecimens(buffer){
 const d=new DataView(buffer);if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength)throw Error('Invalid sward GLB');
 const jsonBytes=d.getUint32(12,true);if(d.getUint32(16,true)!==0x4e4f534a)throw Error('Missing sward JSON');const meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonBytes))),binStart=28+jsonBytes;if(d.getUint32(24+jsonBytes,true)!==0x004e4942)throw Error('Missing sward binary');
 const read=index=>{const a=meta.accessors[index],v=meta.bufferViews[a.bufferView],types={5126:Float32Array,5123:Uint16Array},T=types[a.componentType],size={VEC3:3,VEC2:2,SCALAR:1}[a.type];if(!T||!size||v.byteStride&&v.byteStride!==size*T.BYTES_PER_ELEMENT)throw Error('Unsupported sward attribute');const bytes=a.count*size*T.BYTES_PER_ELEMENT,offset=binStart+(v.byteOffset||0)+(a.byteOffset||0);if(offset+bytes>buffer.byteLength)throw Error('Sward attribute overrun');return new T(buffer.slice(offset,offset+bytes));};
 if(meta.meshes.length!==5||meta.nodes.length!==5||meta.materials.length!==1)throw Error('Sward library must contain five isolated specimens');
 return meta.meshes.map((mesh,i)=>{const p=mesh.primitives[0],node=meta.nodes.find(n=>n.mesh===i),height=node?.extras?.sourceHeight,positions=read(p.attributes.POSITION),normals=read(p.attributes.NORMAL),uvs=read(p.attributes.TEXCOORD_0),indices=read(p.indices);if(mesh.primitives.length!==1||positions.length!==MIXED_SWARD.variantVertices[i]*3||indices.length!==MIXED_SWARD.variantTriangles[i]*3||normals.length!==positions.length||uvs.length!==positions.length/3*2||!(height>0)||!Array.from(positions).every(Number.isFinite)||!Array.from(normals).every(Number.isFinite)||!Array.from(uvs).every(Number.isFinite)||indices.some(n=>n>=positions.length/3))throw Error('Sward geometry contract mismatch');return {positions,normals,uvs,indices,sourceHeight:height,sourceAnchor:node.extras.sourceAnchor,sourceComponents:node.extras.sourceComponents,triangles:indices.length/3};});
}

export function installMixedSward(G,{assetUrl='./assets/models/world/grass_medium_02_specimens.glb',fetchAsset=fetch}={}){
 const {THREE:T,scene,world:W}=G,cover=W.nearGroundCover,source=cover?.swardSource;
 if(!source)throw Error('Mixed sward needs the counted near source-cell adapter');
 const state={ready:null,errors:[],stats:null,basal:null,meshes:[],sources:[],disposed:false};let lastKey=null,lastX=Infinity,lastZ=Infinity,lastQuality=null,lastVR=null,rebuilds=0,cachedKey=null,cachedMetadata=null;const cellCache=new WeakMap(),timingSamples=[];const originalNear=cover.near,ownedGeometries=[];
 function copy(rows,mesh,colors=true){const dst=mesh.instanceMatrix.array;dst.fill(0);if(colors)mesh.instanceColor.array.fill(0);for(let i=0;i<rows.length;i++){const r=rows[i],c=source.cells[r.cellIndex];dst.set(c.matrices.subarray(r.row*16,r.row*16+16),i*16);if(colors)mesh.instanceColor.array.set(c.colors.subarray(r.row*3,r.row*3+3),i*3);}mesh.count=rows.length;mesh.instanceMatrix.needsUpdate=true;if(colors)mesh.instanceColor.needsUpdate=true;}
 function restore(){const rows=[];for(let c=0;c<source.cells.length;c++)for(let i=0;i<source.cells[c].count;i++)rows.push({cellIndex:c,row:i});if(source.vr())rows.length=Math.floor(rows.length*.5);copy(rows,originalNear);}
 function tick(t,x,z,force=false){if(state.disposed||!state.basal)return;const key=source.key(),quality=G.gfx.get(),vr=source.vr(),active=!vr&&['high','medium'].includes(quality);
  if(!force&&key===lastKey&&quality===lastQuality&&vr===lastVR&&(!active||Math.hypot(x-lastX,z-lastZ)<1.25))return;
  // Low/VR use the original source draw; no per-root biome or accent planning.
  if(!active){const started=now();if(lastQuality===null||(['high','medium'].includes(lastQuality)&&!lastVR)||vr!==lastVR)restore();
   state.basal.count=0;for(const mesh of state.meshes)mesh.count=0;
   const roots=source.cells.reduce((n,c)=>n+c.count,0),count=vr?Math.floor(roots*.5):roots,total=now()-started;
   state.stats={sourceRoots:roots,nearRoots:count,basalRoots:0,scanRoots:0,scanCap:0,scanCounts:[0,0,0,0,0],submittedTriangles:count*MIXED_SWARD.sourceTriangles,sourceSubmittedTriangles:count*MIXED_SWARD.sourceTriangles,budgetMaxTriangles:count*MIXED_SWARD.sourceTriangles,triangleDelta:0,classifiedRoots:0,reusedEligibilityRoots:0,accentChecks:0,timing:{rebuilds:++rebuilds,eligibilityMs:0,broadphaseMs:0,selectionMs:0,planMs:0,packMs:total,totalMs:total,scope:'Original Low/VR draw, no grass classification or scan selection'},geometryBytes:124978,addedTextureCount:0,addedMaterialCount:0};
   lastKey=key;lastX=x;lastZ=z;lastQuality=quality;lastVR=vr;return;
  }
  const started=now();let eligibilityMs=0;if(key!==cachedKey||!cachedMetadata){cachedMetadata=prepareSwardRows(source.cells,{canBasal:source.canBasal,cellCache});eligibilityMs=cachedMetadata.eligibilityMs;cachedKey=key;}else{cachedMetadata.classifiedRoots=0;cachedMetadata.reusedRoots=cachedMetadata.rows.length;}const classified=now();source.beginAccentQuery?.(x,z,MIXED_SWARD.radius);const scoped=now(),plan=planMixedSward(source.cells,{x,z,quality,vr,canAccent:source.canAccent,metadata:cachedMetadata}),planned=now();copy(plan.near,originalNear);copy(plan.basal,state.basal);
  const counts=[0,0,0,0,0];for(const mesh of state.meshes){mesh.count=0;mesh.instanceMatrix.array.fill(0);}
  for(const r of plan.scans){const i=r.variant,mesh=state.meshes[i],row=counts[i]++,c=source.cells[r.cellIndex],offset=r.row*16,dst=row*16,scale=r.height/state.sources[i].sourceHeight;
   for(let col=0;col<3;col++){const start=offset+col*4,length=Math.hypot(c.matrices[start],c.matrices[start+1],c.matrices[start+2]);if(length<1e-8)throw Error('Zero scan root basis');for(let axis=0;axis<3;axis++)mesh.instanceMatrix.array[dst+col*4+axis]=c.matrices[start+axis]*scale/length;}
   mesh.instanceMatrix.array[dst+12]=r.x;mesh.instanceMatrix.array[dst+13]=r.y;mesh.instanceMatrix.array[dst+14]=r.z;mesh.instanceMatrix.array[dst+15]=1;
  }
  for(let i=0;i<5;i++){state.meshes[i].count=counts[i];state.meshes[i].instanceMatrix.needsUpdate=true;}
  const finished=now();timingSamples.push(finished-started);if(timingSamples.length>32)timingSamples.shift();const sorted=timingSamples.slice().sort((a,b)=>a-b);
  state.stats={...plan.stats,scanCounts:counts,timing:{rebuilds:++rebuilds,eligibilityMs,broadphaseMs:scoped-classified,selectionMs:planned-scoped,planMs:planned-started,packMs:finished-planned,totalMs:finished-started,last32MedianMs:sorted[Math.floor(sorted.length*.5)],last32P95Ms:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],scope:'CPU planning/repacking only; no render, GPU or FPS claim'},geometryBytes:124978,addedTextureCount:0,addedMaterialCount:0,geometrySource:'Five isolated resident source contours plus mixed-height fuller leaf geometry',rootPolicy:'Every drawn row uses an unchanged counted near source root/yaw; no coordinate resampling',retirementPolicy:'Only rows beyond original near-wind zero-fade radius plus 1.5m movement buffer are omitted from this draw'};
  lastKey=key;lastX=x;lastZ=z;lastQuality=quality;lastVR=vr;
 }
 const onTick=(dt,t)=>{try{const p=G.horse.player.pos;tick(t,p.x,p.z);}catch(error){state.errors.push(error.message);state.dispose();console.warn('Mixed sward returned to original cover',error);}};
 state.dispose=()=>{if(state.disposed)return;state.disposed=true;G.off('tick',onTick);if(state.basal){restore();scene.remove(state.basal);state.basal.dispose();}for(const mesh of state.meshes){scene.remove(mesh);mesh.dispose();}for(const geo of ownedGeometries)geo.dispose();state.meshes.length=0;state.sources.length=0;ownedGeometries.length=0;cachedMetadata=null;for(const cell of source.cells)cellCache.delete(cell);state.basal=null;};
 state.tick=tick;state.refreshEligibility=()=>{cachedKey=null;cachedMetadata=null;for(const cell of source.cells)cellCache.delete(cell);};
 state.ready=(async()=>{
  // The source clocks/placements finish before ANY new Three resource UUID is allocated.
  await Promise.all([G.photoscans?.ready,G.worldDetails?.ready,G.undergrowth?.ready,W.ranchBuilderArt?.ready,G.quartersPkg?.saplingsReady,G.worldPkg?.oasisReady,G.worldPaths?.roadsideReady]);if(state.disposed)return state;
  let material=null;scene.traverse(o=>{if(o.isMesh&&!material&&!Array.isArray(o.material)&&o.material.name==='Trail edge | scanned meadow grass')material=o.material;});if(!material?.map)throw Error('Resident scanned grass material unavailable; keeping original grass');
  const response=await fetchAsset(assetUrl);if(!response.ok)throw Error('Sward asset HTTP '+response.status);const data=await response.arrayBuffer();if(globalThis.crypto?.subtle){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==MIXED_SWARD.assetSha256)throw Error('Sward asset bytes changed');}const sources=readSwardSpecimens(data);if(state.disposed)return state;state.sources=sources;
  const basalGeo=createBasalSwardGeometry(T);ownedGeometries.push(basalGeo);const basal=state.basal=new T.InstancedMesh(basalGeo,originalNear.material,originalNear.instanceMatrix.count);basal.setColorAt(0,new T.Color());basal.name='Mixed pasture | fuller mixed-height sward';basal.count=0;basal.frustumCulled=false;basal.receiveShadow=true;basal.castShadow=false;basal.userData.fineGroundCover=true;scene.add(basal);
  for(let i=0;i<5;i++){const s=sources[i],geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(s.positions,3));geo.setAttribute('normal',new T.BufferAttribute(s.normals,3));geo.setAttribute('uv',new T.BufferAttribute(s.uvs,2));geo.setIndex(new T.BufferAttribute(s.indices,1));geo.computeBoundingBox();geo.computeBoundingSphere();ownedGeometries.push(geo);const mesh=new T.InstancedMesh(geo,material,MIXED_SWARD.high);mesh.name='Mixed pasture | resident specimen '+i;mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.fineGroundCover=true;mesh.userData.sourceSpecimen=i;mesh.userData.sourceHeight=s.sourceHeight;state.meshes.push(mesh);scene.add(mesh);}
  G.on('tick',onTick);const p=G.horse.player.pos;tick(0,p.x,p.z,true);return state;
 })().catch(error=>{state.errors.push(error.message);state.dispose();console.warn('Mixed sward prototype unavailable',error);return state;});
 return state;
}
