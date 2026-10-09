/* Private, bone-attached hair for the feathered native draft foundations.
 * The approved skinned meshes, weights, inverse binds and clips stay untouched. */
const owned=new WeakMap();
const LEGS=[
 ['FL','hand_l_0206','fingers_01_l_0187','fingers_02_l_0208'],
 ['FR','hand_r_0272','fingers_01_r_0273','fingers_02_r_0274'],
 ['HL','foot_l_0407','toes_01_l_0408','toes_02_l_0409'],
 ['HR','foot_r_0476','toes_01_r_0477','toes_02_r_0478'],
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function once(resource){const dispose=resource.dispose.bind(resource);let disposed=false;resource.dispose=()=>{if(disposed)return;disposed=true;dispose();};return resource;}

function strandTexture(THREE,dense=false){
 const width=64,height=256,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=y/(height-1),edge=Math.pow(Math.sin(Math.PI*u),.45);
  const fiber=.5+.5*Math.sin(u*Math.PI*16+.20*Math.sin(v*9+u*7));
  const split=clamp((1-v)*8+.35*Math.sin(u*29),0,1),i=(y*width+x)*4;
  const shade=Math.round(220+35*fiber);data[i]=shade;data[i+1]=shade;data[i+2]=shade;
  // Vanner locks need a continuous undercoat; the fiber shading and split
  // tips still read as fine hair without cutting each card into tassels.
  data[i+3]=Math.round(255*edge*(dense?.60+.40*fiber:.27+.73*fiber)*split);
 }
 const texture=once(new THREE.DataTexture(data,width,height));
 texture.name='Native draft feather fibers';texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}

export function createNativeDraftFeathers({THREE,scene,skin,profile}={}){
 const foundation=profile?.nativeVariant?.id;
 if(!THREE||!scene||!skin||!profile?.nativeRoster||!['shire','clyde','vanner'].includes(foundation))return null;
 const existing=owned.get(skin);if(existing&&!existing.disposed)return existing;
 scene.updateWorldMatrix(true,true);
 const at=bone=>scene.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
 const anchors=LEGS.map(([id,upperName,pasternName,hoofName])=>{
  const upper=scene.getObjectByName(upperName),pastern=scene.getObjectByName(pasternName),hoof=scene.getObjectByName(hoofName);
  if(!upper||!pastern||!hoof)return null;
  return {id,upper,pastern,hoof,top:at(upper),pivot:at(pastern),toe:at(hoof),minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,samples:0};
 });
 if(anchors.some(a=>!a||![...a.top.toArray(),...a.pivot.toArray(),...a.toe.toArray()].every(Number.isFinite)))return null;
 // Read the current conformation at the lower cannon. The draft morph may be
 // wider than its preserved skeleton; roots must emerge from the actual skin.
 const point=new THREE.Vector3(),p=skin.geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  skin.getVertexPosition(i,point);skin.localToWorld(point);scene.worldToLocal(point);
  for(const a of anchors)if(point.y>a.pivot.y+.015&&point.y<a.pivot.y+.11&&Math.abs(point.x-a.pivot.x)<.14&&Math.abs(point.z-a.pivot.z)<.15){
   a.minX=Math.min(a.minX,point.x);a.maxX=Math.max(a.maxX,point.x);a.minZ=Math.min(a.minZ,point.z);a.maxZ=Math.max(a.maxZ,point.z);a.samples++;
  }
 }
 const fantasy=profile.family==='fantasy',vanner=foundation==='vanner',texture=strandTexture(THREE,vanner);
 const color=new THREE.Color(vanner?'#f1ede4':'#e6e0d4');
 if(fantasy){const mane=profile.nativeRosterAppearance?.mane||profile.nativeRosterColors?.mane;if(mane)color.set(mane).lerp(new THREE.Color('#e6e0d4'),.42);}
 const material=once(new THREE.MeshStandardMaterial({name:'Native draft silky feather',map:texture,color,
  side:THREE.DoubleSide,alphaTest:.36,roughness:.86,metalness:0,depthWrite:true}));
 const meshes=[],segments=6,strandsPerLeg=vanner?72:foundation==='clyde'?62:56;
 for(let leg=0;leg<anchors.length;leg++){
  const a=anchors[leg],rnd=random(1987+leg*811+(vanner?831:foundation==='clyde'?412:0));
  const rx=a.samples?clamp((a.maxX-a.minX)*.5,.032,.085):.047;
  const rz=a.samples?clamp((a.maxZ-a.minZ)*.5,.031,.077):.043;
  const cx=a.samples?(a.minX+a.maxX)*.5:a.pivot.x,cz=a.samples?(a.minZ+a.maxZ)*.5:a.pivot.z;
  const axis=a.top.clone().sub(a.pivot).normalize(),positions=[],uvs=[],colors=[],indices=[];
  const local=new THREE.Vector3(),center=new THREE.Vector3();
  for(let strand=0;strand<strandsPerLeg;strand++){
   const front=strand>=strandsPerLeg-(vanner?14:10);
   // Most hair grows behind and beside the cannon. The front has only short,
   // scattered wisps so the joints and hoof breakover remain visible.
   const angle=vanner
    ?front?Math.PI+((strand-58+rnd())/14-.5)*1.15:((strand%29+rnd())/29-.5)*Math.PI*1.68
    :front?Math.PI+(rnd()-.5)*1.15:(rnd()-.5)*Math.PI*1.58;
   // Vanner's two overlapping layers form a full collar below the cannon.
   // Staggered roots and broad locks avoid sparse, isolated tassels while
   // short front wisps leave the hoof breakover clear. Draft shapes stay intact.
   const upperLayer=vanner&&!front&&strand>=29;
   const radialX=Math.sin(angle),radialZ=-Math.cos(angle),rootUp=front?.01+rnd()*.06:vanner?(upperLayer?.085+rnd()*.065:.03+rnd()*.06):.025+rnd()*.105;
   const length=front?(vanner?.06+rnd()*.04:.045+rnd()*.035):(vanner?.14+rnd()*.075:.10+rnd()*.07);
   const width=vanner?front?.006+rnd()*.005:.013+rnd()*.011:front?.003+rnd()*.003:.004+rnd()*.009;
   const flare=front?.006+rnd()*.009:vanner?(upperLayer?.018+rnd()*.025:.026+rnd()*.031):.020+rnd()*.033,bend=(rnd()-.5)*(vanner?.016:.025);
   const rootY=a.pivot.y+rootUp,drop=Math.min(length,Math.max(.03,rootY-(a.toe.y-.035)));
   const shade=.82+rnd()*.18,base=positions.length/3;
   for(let step=0;step<=segments;step++){
    const t=step/segments,taper=Math.pow(1-t,vanner?.42:.72)*.96+.04,spread=flare*Math.sin(t*Math.PI*.5);
    center.set(cx+axis.x*rootUp+radialX*(rx*.94+spread)+bend*t*t,
     rootY-drop*t,cz+axis.z*rootUp+radialZ*(rz*.94+spread)-.012*Math.sin(t*Math.PI));
    for(const side of [-1,1]){
     local.copy(center);local.x+=Math.cos(angle)*width*taper*side*.5;local.z+=Math.sin(angle)*width*taper*side*.5;
     scene.localToWorld(local);a.pastern.worldToLocal(local);positions.push(local.x,local.y,local.z);
     uvs.push(side<0?0:1,t);colors.push(shade,shade,shade);
    }
    if(step<segments){const n=base+step*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
   }
  }
  const geometry=once(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='NativeDraftFeather_'+a.id;mesh.userData.nativeDraftFeather=true;
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;a.pastern.add(mesh);meshes.push(mesh);
 }
 material.vertexColors=true;
 const controller={foundation,meshes,anchors,strands:4*strandsPerLeg,disposed:false,
  setColors({maneColor}={}){if(!this.disposed&&fantasy&&maneColor)material.color.set(maneColor).lerp(new THREE.Color('#e6e0d4'),.42);},
  inspect(){return inspectNativeDraftFeathers(this);},
  dispose(){if(this.disposed)return;this.disposed=true;for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}material.dispose();texture.dispose();owned.delete(skin);},
 };
 owned.set(skin,controller);return controller;
}

/** QA-only inspection; no per-frame work or vertex changes are required. */
export function inspectNativeDraftFeathers(feathers){
 if(!feathers)return {enabled:false,drawCalls:0,triangles:0,strands:0,finiteAnchors:true};
 let triangles=0,finite=true;for(const mesh of feathers.meshes){triangles+=mesh.geometry.index.count/3;finite=finite&&mesh.geometry.attributes.position.array.every(Number.isFinite);}
 return {enabled:!feathers.disposed,foundation:feathers.foundation,drawCalls:feathers.disposed?0:feathers.meshes.length,
  triangles,strands:feathers.strands,finiteAnchors:finite&&feathers.anchors.every(a=>a.pastern.matrixWorld.elements.every(Number.isFinite)),
  boneNames:feathers.anchors.map(a=>a.pastern.name),skinSamples:feathers.anchors.map(a=>a.samples)};
}
