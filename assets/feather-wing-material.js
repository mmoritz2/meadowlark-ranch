/* Newly authored analytic material for the approved CGCookie feather cards.
 * The original missing maps are not recovered. Position/index/normal/skin data
 * and all source joints stay unchanged; only private shading coordinates and
 * materials are added. No generated images or replacement geometry are used. */
export function applyFeatherWingMaterial({THREE,root,profile,tint='#eef1e8'}){
 if(!profile?.featherWingRig)throw new Error('Source feather rig profile required');
 const clean=name=>name.replace(/[.\s]/g,''),entries=Object.values(profile.featherWingRig.feathers).flat(),byName=new Map(entries.map(f=>[clean(f.name),f]));
 const modified=[],materials=[],report={authorship:'Meadowlark newly authored analytic feather silhouette, rachis and barb shading; original color/alpha maps unavailable',geometryPositionsIndicesNormalsAndSkinUnchanged:true,sourceJointsUnchanged:true,originalMapsRecovered:false,feathers:[],structuralMeshes:[]};
 const normal=new THREE.Vector3(),axis=new THREE.Vector3(),across=new THREE.Vector3(),point=new THREE.Vector3(),center=new THREE.Vector3();
 function coordinates(mesh){
  const original=mesh.geometry,g=original.clone(),P=g.attributes.position,N=g.attributes.normal,I=g.attributes.skinIndex,W=g.attributes.skinWeight;
  if(!P||!N||!I||!W)throw new Error('Long feather source attributes missing: '+mesh.name);
  const groups=new Map(),values=new Float32Array(P.count*3);
  for(let i=0;i<P.count;i++){
   if(Math.abs(W.getX(i)-1)>1e-6||Math.abs(W.getY(i))+Math.abs(W.getZ(i))+Math.abs(W.getW(i))>1e-6)throw new Error('Expected rigid source feather ownership: '+mesh.name+'/'+i);
   const j=I.getX(i);if(!groups.has(j))groups.set(j,[]);groups.get(j).push(i);
  }
  for(const [joint,indices]of groups){
   const bone=mesh.skeleton.bones[joint],entry=byName.get(clean(bone?.name||''));if(!entry)throw new Error('Not a real source feather joint: '+bone?.name);
   center.set(0,0,0);normal.set(0,0,0);for(const i of indices){center.add(point.fromBufferAttribute(P,i));normal.add(point.fromBufferAttribute(N,i));}center.multiplyScalar(1/indices.length);normal.normalize();
   // The recorded source-local fan direction chooses the correct basal-to-tip
   // sign. Power iteration fits the real elongated card, not a new feather.
   axis.fromArray(entry.fanAxis).normalize();
   for(let pass=0;pass<12;pass++){const next=new THREE.Vector3();for(const i of indices){point.fromBufferAttribute(P,i).sub(center);next.addScaledVector(point,point.dot(axis));}if(next.lengthSq()<1e-12)throw new Error('Degenerate source feather card');axis.copy(next.normalize());}
   if(axis.dot(new THREE.Vector3().fromArray(entry.fanAxis))<0)axis.negate();
   across.crossVectors(normal,axis).normalize();if(across.lengthSq()<.5)throw new Error('Degenerate source feather plane');
   let lo=Infinity,hi=-Infinity,left=Infinity,right=-Infinity;
   for(const i of indices){point.fromBufferAttribute(P,i).sub(center);const along=point.dot(axis),cross=point.dot(across);lo=Math.min(lo,along);hi=Math.max(hi,along);left=Math.min(left,cross);right=Math.max(right,cross);}
   const length=hi-lo,width=right-left;if(!(length>.02&&width>.001&&length>width*1.2))throw new Error('Source mesh is not an elongated feather card');
   const crossCenter=(left+right)/2;
   for(const i of indices){point.fromBufferAttribute(P,i).sub(center);values[i*3]=(point.dot(across)-crossCenter)/(width*.5);values[i*3+1]=(point.dot(axis)-lo)/length;values[i*3+2]=entry.index;}
   report.feathers.push({mesh:mesh.name,joint:bone.name,vertices:indices.length,lengthM:length,widthM:width,sourceRigidWeight:1});
  }
  g.setAttribute('sourceFeatherCoordinates',new THREE.BufferAttribute(values,3));return g;
 }
 function patch(material,color){
  material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute vec3 sourceFeatherCoordinates;\nvarying vec3 analyticFeather;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nanalyticFeather=sourceFeatherCoordinates;');
   shader.fragmentShader='varying vec3 analyticFeather;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
    float featherT=clamp(analyticFeather.y,0.0,1.0);
    float featherCross=abs(analyticFeather.x);
    float featherPhase=featherT*260.0-featherCross*74.0+analyticFeather.z*.79;
    float featherWidth=.045+.92*pow(max(0.0,sin(3.14159265*pow(featherT,1.58))),.48);
    featherWidth-=.006*(.5+.5*sin(featherPhase*1.3));
    float featherAA=max(fwidth(analyticFeather.x)*1.1,.009);
    float featherVane=1.0-smoothstep(featherWidth-featherAA,featherWidth+featherAA,featherCross);
    float featherQuill=(1.0-smoothstep(.015,.027,featherCross))*(1.0-smoothstep(.93,1.0,featherT));
    diffuseColor.a*=max(featherVane,featherQuill);
    ${color?`float featherBarb=.91+.045*sin(featherPhase)+.015*sin(featherPhase*2.17);
    float featherRachis=1.0-smoothstep(.018,.050,featherCross);
    float featherRoot=.84+.16*smoothstep(.0,.22,featherT);
    diffuseColor.rgb*=mix(featherBarb*featherRoot,1.035,featherRachis);
    diffuseColor.rgb*=gl_FrontFacing?1.0:.91;`:''}
    #include <alphatest_fragment>`);
  };
  material.customProgramCacheKey=()=>color?'cgcookie-authored-analytic-feather-v1':'cgcookie-authored-analytic-feather-shadow-v1';material.needsUpdate=true;materials.push(material);return material;
 }
 const feather=patch(new THREE.MeshStandardMaterial({name:'Authored analytic source feather vanes',color:tint,roughness:.74,metalness:0,side:THREE.DoubleSide,alphaTest:.45,alphaToCoverage:true}),true);
 const depth=patch(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide,alphaTest:.45}),false);
 const distance=patch(new THREE.MeshDistanceMaterial({side:THREE.DoubleSide,alphaTest:.45}),false);
 const structural=new THREE.MeshStandardMaterial({name:'Opaque source wing shoulder and shafts',color:tint,roughness:.8,metalness:0,side:THREE.DoubleSide});materials.push(structural);
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(/^RealLongFeathers[LR]$/.test(clean(mesh.name))){
   const original={mesh,geometry:mesh.geometry,material:mesh.material,depth:mesh.customDepthMaterial,distance:mesh.customDistanceMaterial};
   mesh.geometry=coordinates(mesh);mesh.material=feather;mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;mesh.userData.authoredAnalyticFeather=true;modified.push(original);
  }else if(/^RealWingBody[LR]$/.test(clean(mesh.name))){
   modified.push({mesh,geometry:mesh.geometry,material:mesh.material,structural:true});mesh.material=structural;report.structuralMeshes.push({name:mesh.name,opaque:true,alphaTest:0});
  }
 });
 if(report.feathers.length!==96||report.structuralMeshes.length!==2)throw new Error('Expected all96 genuine source long feathers and both opaque structural wing bodies');
 let disposed=false;
 return{materials,report,dispose(){if(disposed)return;disposed=true;for(const before of modified){if(!before.structural)before.mesh.geometry.dispose();before.mesh.geometry=before.geometry;before.mesh.material=before.material;before.mesh.customDepthMaterial=before.depth;before.mesh.customDistanceMaterial=before.distance;}for(const material of materials)material.dispose();}};
}
