// Refine the free toe and heel around a measured, unchanged tread-support patch.
// IDs refer to the current connected boot source. The protected triangles cover
// the actual native tread top polygon plus 5 mm in the game foot target frame;
// the visible source skin remains governed by the existing coverage shader.
// Male forward support also retains the complete mirrored sole row witnessed
// by actual game mount/wardrobe transitions (source IDs64/113 and189/236).
const support={"f":{"sourceSHA":"3da0996dfbd403ab8a9edf5cf0f7497a681c8d52bb2cc29644c00d86680a7824","count":3946,"ids":[0,3,20,21,30,32,33,34,35,36,37,38,39,40,41,42,43,62,64,65,66,67,68,69,70,74,75,76,77,78,79,80,81,82,87,88,89,90,91,92,94,104,105,109,110,111,112,117,118,119,140,141,148,150,151,152,153,154,155,156,157,158,159,160,161,181,182,183,184,185,186,187,188,192,193,194,195,196,197,198,199,200,205,206,207,208,209,210,211,222,223,227,228,229,230,235,1514,1515,1516,1517,1518,1519,1520,1521,1522,1523,1524,1540,1541,1542,1543,1544,1545,1546,1547,1548,1549,1550,1551,1552,1553,1554,1555,1556,1557,1570,1571,1572,1573,1574,1575,1576,1577,2730,2731,2732,2733,2734,2735,2736,2752,2753,2754,2755,2756,2757,2758,2759,2760,2761,2762,2763,2764,2765,2766,2767,2768,2769,2770,2783,2784,2785,2786,2787,2788,2789,2790,2791,2792,2793]},"m":{"sourceSHA":"453b440c4756d2abab38194862d7a46a90a7f736a12e256552c314efe8c7e214","count":3998,"ids":[0,1,4,5,24,25,29,36,37,38,39,40,41,42,43,44,45,46,47,64,67,68,69,70,71,72,73,74,75,79,80,81,82,83,84,85,92,93,94,95,96,97,98,99,109,110,113,114,115,116,117,121,122,123,124,127,130,149,150,152,159,160,161,162,163,164,165,166,167,168,169,171,189,190,191,192,193,194,195,196,197,198,202,203,204,205,206,207,208,215,216,217,218,219,220,221,222,232,233,236,237,238,239,240,244,245,1566,1567,1568,1569,1570,1571,1572,1573,1574,1590,1591,1592,1593,1594,1595,1596,1597,1598,1599,1600,1601,1602,1603,1604,1605,1606,1607,1608,1609,1624,1625,1626,1627,1628,1629,2782,2783,2784,2785,2786,2787,2788,2789,2790,2806,2807,2808,2809,2810,2811,2812,2813,2814,2815,2816,2817,2818,2819,2820,2835,2836,2837,2838,2839,2840,2841,2842,2843,2844,2845]}};
const templates=new WeakMap();
export function refineRidingBootLast(T,geometry,data){
 const cached=templates.get(data);if(cached){geometry.copy(cached.geometry);return cached.evidence;}
 const spec=support[data.sex],p=geometry.attributes.position;
 if(!spec||data.sourceSHA!==spec.sourceSHA||p.count!==spec.count)throw Error('Boot last source changed; remeasure tread support');
 const originalCount=p.count,protectedIDs=new Set(spec.ids),oldIndex=Array.from(geometry.index.array),attributes={};
 for(const[name,a]of Object.entries(geometry.attributes))attributes[name]={size:a.itemSize,array:Array.from(a.array),type:a.array.constructor,normalized:a.normalized};
 const sources=[],midpoints=new Map(),key=(a,b)=>a<b?a+':'+b:b+':'+a,point=id=>new T.Vector3().fromArray(attributes.position.array,id*3);
 // One conforming split follows the front perimeter, rounding the last without
 // changing any triangle in the protected tread support or the upper shaft.
 for(let f=0;f<oldIndex.length;f+=3)for(let j=0;j<3;j++){
  const a=oldIndex[f+j],b=oldIndex[f+(j+1)%3],k=key(a,b);if(midpoints.has(k)||protectedIDs.has(a)||protectedIDs.has(b))continue;
  if(Math.max(p.getY(a),p.getY(b))>=.065||Math.min(p.getZ(a),p.getZ(b))<=.105)continue;
  const id=attributes.position.array.length/3;
  for(const[name,q]of Object.entries(attributes)){
   if(name==='skinIndex'||name==='skinWeight')continue;
   for(let c=0;c<q.size;c++)q.array.push((q.array[a*q.size+c]+q.array[b*q.size+c])*.5);
  }
  const owned=new Map();for(const v of[a,b])for(let c=0;c<4;c++){const w=attributes.skinWeight.array[v*4+c]*.5;if(w)owned.set(attributes.skinIndex.array[v*4+c],(owned.get(attributes.skinIndex.array[v*4+c])||0)+w);}
  if(owned.size!==1)throw Error('Refined toe edge no longer has a rigid foot binding');
  const joint=[...owned.keys()][0];attributes.skinIndex.array.push(joint,0,0,0);attributes.skinWeight.array.push(1,0,0,0);
  midpoints.set(k,id);sources.push([a,b]);
 }
 const indices=[];
 for(let f=0;f<oldIndex.length;f+=3){const[a,b,c]=oldIndex.slice(f,f+3),ab=midpoints.get(key(a,b)),bc=midpoints.get(key(b,c)),ca=midpoints.get(key(c,a)),mask=(ab!==undefined?1:0)+(bc!==undefined?2:0)+(ca!==undefined?4:0);
  const faces=mask===0?[[a,b,c]]:mask===1?[[a,ab,c],[ab,b,c]]:mask===2?[[b,bc,a],[bc,c,a]]:mask===4?[[c,ca,b],[ca,a,b]]:mask===3?[[b,bc,ab],[a,ab,c],[ab,bc,c]]:mask===5?[[a,ab,ca],[b,c,ab],[ab,c,ca]]:mask===6?[[c,ca,bc],[a,b,ca],[b,bc,ca]]:[[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];
  for(const tri of faces)indices.push(...tri);
 }
 const rest=attributes.position.array.slice(),fixed=spec.ids.map(point),smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 // A fixed ring protects the established ankle/calf and trouser opening. The
 // rest sole height stays fixed; only the free toe and heel are shaped.
 const centres={};for(const s of[-1,1]){const xs=[];for(let id=0;id<originalCount;id++)if(Math.sign(p.getX(id))===s&&p.getY(id)<.025)xs.push(p.getX(id));centres[s]=(Math.min(...xs)+Math.max(...xs))*.5;}
 let changed=0,maxDelta=0,maxToeNarrowing=0,maxHeelInset=0;
 for(let id=0;id<attributes.position.array.length/3;id++){
  const x=rest[id*3],y=rest[id*3+1],z=rest[id*3+2];if(protectedIDs.has(id)||y>=.165)continue;
  const s=Math.sign(x),cx=centres[s],dx=x-cx,q=new T.Vector3(x,y,z);let distance=Infinity;for(const v of fixed)if(Math.sign(v.x)===s)distance=Math.min(distance,q.distanceTo(v));
  const free=smooth(0,.018,distance),toe=smooth(.065,.148,z)*(1-smooth(.105,.165,y))*free;
  const toeX=-dx*.17*toe,rounding=(.0028+.010*Math.pow(Math.min(1,Math.abs(dx)/.058),2))*toe;
  const rear=(1-smooth(-.095,-.025,z))*smooth(.008,.047,y)*(1-smooth(.090,.165,y))*free;
  const heelX=-Math.sign(dx)*.0035*Math.min(1,Math.abs(dx)/.040)*rear,heelZ=.008*rear;
  const nx=x+toeX+heelX,nz=z-rounding+heelZ,delta=Math.hypot(nx-x,nz-z);attributes.position.array[id*3]=nx;attributes.position.array[id*3+2]=nz;
  if(delta>1e-9)changed++;maxDelta=Math.max(maxDelta,delta);maxToeNarrowing=Math.max(maxToeNarrowing,Math.abs(toeX));maxHeelInset=Math.max(maxHeelInset,heelZ);
 }
 for(const[name,q]of Object.entries(attributes))geometry.setAttribute(name,new T.BufferAttribute(new q.type(q.array),q.size,q.normalized));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 if(!geometry.attributes.position.array.every(Number.isFinite))throw Error('Nonfinite boot last');
 geometry.userData.bootLastRefinement={originalVertexCount:originalCount,midpointSources:sources,protectedVertexIDs:spec.ids.slice()};
 const evidence={version:2,sourceSHA:data.sourceSHA,originalVertexCount:originalCount,addedPerimeterVertices:sources.length,protectedTreadVertices:spec.ids.length,changedVertices:changed,maxDisplacementM:maxDelta,maxPerSideToeInsetM:maxToeNarrowing,maxHeelCupInsetM:maxHeelInset,yCoordinatesUnchanged:true,originalSkinWeightsUnchanged:true,newToeVerticesRigidFootBound:true,shaftAndOpeningUnchangedAboveM:.165,contactScope:'Canonical seated native tread top plus5mm polygon margin, extended symmetrically across the male forward sole row witnessed by actual game mount/wardrobe transitions. The unchanged ±50mm projected-support audit still requires integration review.'};
 templates.set(data,{geometry:geometry.clone(),evidence});return evidence;
}
