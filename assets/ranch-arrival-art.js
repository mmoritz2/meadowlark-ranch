/* Original arena dressing. All dimensions are metres. Helpers create visual
 * geometry only: no colliders, placements, horse data or gameplay mutations. */
export function createArrivalArt({THREE,anisotropy=8}={}) {
 if(!THREE)throw new TypeError('createArrivalArt requires THREE');
 const loader=new THREE.TextureLoader(),grain=loader.load('assets/textures/realism/siding_albedo.jpg');
 grain.colorSpace=THREE.SRGBColorSpace;grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.anisotropy=anisotropy;
 const timber=new THREE.MeshStandardMaterial({color:'#8b7152',map:grain,roughness:.91,envMapIntensity:.38});
 const darkTimber=new THREE.MeshStandardMaterial({color:'#544b39',map:grain,roughness:.96});
 const soil=new THREE.MeshStandardMaterial({color:'#322b21',roughness:1});
 const botanical=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,side:THREE.DoubleSide,envMapIntensity:.38});
 const iron=new THREE.MeshStandardMaterial({color:'#3c4038',roughness:.69,metalness:.48});
 const railPaint=new THREE.MeshStandardMaterial({color:'#dcdace',roughness:.79});
 const railAccent=new THREE.MeshStandardMaterial({color:'#6c4850',roughness:.8});
 const poleGeo=new THREE.CylinderGeometry(.5,.5,1,12);
 const cube=new THREE.BoxGeometry(1,1,1),stemGeo=new THREE.CylinderGeometry(.65,1,1,5,1);
 const palettes={meadow:['#bc7593','#d7cbb0','#8576a9'],lavender:['#a898c2','#807baf','#d4c7dc'],ivory:['#e8dfbe','#cfbd87','#d7d7c6']};
 function random(seed=1){let n=typeof seed==='number'?seed:Math.abs([...String(seed)].reduce((s,c)=>(s*31+c.charCodeAt(0))|0,0));return()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};}
 function batch(name){
  const group=new THREE.Group();group.name=name;const bins=new Map(),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),v=new THREE.Vector3(),s=new THREE.Vector3(),nmat=new THREE.Matrix3(),p=new THREE.Vector3(),n=new THREE.Vector3();
  function add(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,color='#ffffff'){
   const b=bins.get(mat)||{p:[],n:[],uv:[],c:[]};bins.set(mat,b);e.set(rx,ry,rz);q.setFromEuler(e);m.compose(v.set(x,y,z),q,s.set(sx,sy,sz));nmat.getNormalMatrix(m);
   const pos=geo.attributes.position,normal=geo.attributes.normal,uv=geo.attributes.uv,index=geo.index,c=new THREE.Color(color),count=index?index.count:pos.count;
   for(let k=0;k<count;k++){const i=index?index.getX(k):k;p.fromBufferAttribute(pos,i).applyMatrix4(m);n.fromBufferAttribute(normal,i).applyMatrix3(nmat).normalize();b.p.push(p.x,p.y,p.z);b.n.push(n.x,n.y,n.z);b.uv.push(uv?uv.getX(i):0,uv?uv.getY(i):0);b.c.push(c.r,c.g,c.b);}
  }
  function box(w,h,d,mat,x,y,z,ry=0,color){add(cube,mat,x,y,z,w,h,d,0,ry,0,color);}
  function finish(){for(const [mat,b]of bins){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));if(mat.vertexColors)g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();const mesh=new THREE.Mesh(g,mat);mesh.name=name+' | '+(mat===botanical?'botanical planting':'joinery');mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}group.userData.arrivalArt=true;return group;}
  return {add,box,finish,group};
 }
 // Tapered, folded leaf/petal surface, with a lifted tip and a visible midrib.
 function blade(width,length,fold=.12){
  const p=[],uv=[],idx=[];for(let j=0;j<=4;j++){const t=j/4,w=Math.sin(Math.PI*t)*width/2;for(let k=0;k<3;k++){const side=k-1;p.push(side*w,length*t,Math.sin(Math.PI*t)*length*.16+(k===1?0:fold*length*Math.sin(Math.PI*t)));uv.push(k/2,t);}}
  for(let j=0;j<4;j++)for(let k=0;k<2;k++){const a=j*3+k;idx.push(a,a+3,a+1,a+1,a+3,a+4);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 const leafGeo=blade(1,1,.09),petalGeo=blade(1,1,.05),coreGeo=new THREE.SphereGeometry(1,6,4);
 function buildPlanter({width=1.2,depth=.45,height=.36,seed=1,palette='meadow'}={}){
  const b=batch('Arrival timber flower planter'),rnd=random(seed),petals=palettes[palette]||palettes.meadow;
  const thick=.035,post=.046,base=.035,top=height;
  b.box(width-.055,.055,depth-.055,darkTimber,0,base,0);
  for(const sign of[-1,1]){
   for(let row=0;row<3;row++){const h=(height-.055)/3-.006,y=.055+row*(height-.055)/3+h/2;b.box(width,h,thick,timber,0,y,sign*(depth-thick)/2);b.box(thick,h,depth-.04,timber,sign*(width-thick)/2,y,0);}
   b.box(width+.032,.035,.052,timber,0,top,sign*depth/2);
   b.box(.052,.035,depth+.032,timber,sign*width/2,top,0);
   for(const side of[-1,1]){b.box(post,height+.02,post,darkTimber,side*(width/2-.04),height/2,sign*(depth/2-.032));b.box(.018,height*.74,.008,iron,side*(width/2-.055),height*.47,sign*(depth/2+.005));}
  }
  b.box(width-.1,.028,depth-.09,soil,0,height-.035,0);
  const count=Math.max(12,Math.round(width*depth*86));
  for(let i=0;i<count;i++){
   const x=(rnd()-.5)*(width-.13),z=(rnd()-.5)*(depth-.10),h=.11+rnd()*.16,y=height-.03,tilt=(rnd()-.5)*.18,angle=rnd()*Math.PI*2;
   b.add(stemGeo,botanical,x,y+h/2,z,.0045,h,.0045,tilt,angle,0,'#4b6537');
   for(let j=0;j<4;j++){const a=angle+j*2.4,lh=.07+rnd()*.055; b.add(leafGeo,botanical,x,y+h*(.13+j*.16),z,lh*.52,lh,lh,Math.PI*.39,a,.14, i%3===0?'#738552':'#527244');}
   if(i%5===0)continue;
   const radius=.046+rnd()*.029,headY=y+h,petalColor=petals[Math.floor(rnd()*petals.length)],petalCount=5+(i%2);
   for(let j=0;j<petalCount;j++){const a=j*Math.PI*2/petalCount+angle; b.add(petalGeo,botanical,x,headY,z,radius*1.12,radius,radius,Math.PI*.40,a,0,petalColor);}
   b.add(coreGeo,botanical,x,headY+.006,z,.010,.006,.010,0,0,0,'#bda34c');
  }
  return b.finish();
 }
 function buildNoticeboard({title='MEADOWLARK RIDING CLUB',lines=['Lessons & trail rides','Meet at the arena gate'],width=1.65,height=1.15}={}){
  const b=batch('Arrival club noticeboard'),boardY=1.25;
  for(const x of[-width*.43,width*.43])b.box(.095,boardY+height*.55,.095,darkTimber,x,(boardY+height*.55)/2,.055);
  b.box(width+.10,height+.11,.11,timber,0,boardY,0);
  b.box(width-.06,height-.05,.02,darkTimber,0,boardY,.067);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=640;const c=canvas.getContext('2d');
  c.fillStyle='#283a32';c.fillRect(0,0,1024,640);c.strokeStyle='#acaa83';c.lineWidth=3;c.strokeRect(25,25,974,590);
  c.textAlign='center';c.fillStyle='#eee5c9';c.font='600 42px Georgia';c.fillText(title,512,104,890);c.strokeStyle='#9f9c75';c.beginPath();c.moveTo(110,137);c.lineTo(914,137);c.stroke();
  lines.slice(0,3).forEach((line,i)=>{c.font='32px Georgia';c.fillStyle='#ddd4b8';c.fillText(line,512,220+i*60,860);});
  c.font='italic 28px Georgia';c.fillStyle='#b8c0a8';c.fillText('Welcome, riders',512,540);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=anisotropy;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width-.10,height-.10),new THREE.MeshStandardMaterial({map:tex,roughness:.95,side:THREE.DoubleSide}));face.position.set(0,boardY,.080);face.castShadow=true;b.group.add(face);
  b.box(width+.27,.055,.36,timber,0,boardY+height*.58,0);
  return b.finish();
 }
 function buildPracticeJump(){
  const b=batch('Meadowlark practice fence');
  for(const side of [-1,1]){
   const x=side*1.55;
   b.box(.13,1.19,.13,railPaint,x,.595,0);
   b.box(.18,.055,.18,railAccent,x,1.215,0);
   b.box(.52,.07,.13,railPaint,x,.045,0);
   b.box(.13,.07,.58,railPaint,x,.045,0);
   // Open slatted wings preserve sightlines to the landing side.
   for(const z of[-.31,.31])b.box(.07,.87,.07,railPaint,x,.44,z);
   for(const y of[.16,.81])b.box(.08,.065,.67,railPaint,x,y,0);
   for(const z of[-.16,0,.16])b.box(.055,.61,.045,railPaint,x,.485,z);
   for(const y of[.55,.9])b.box(.055,.06,.14,iron,x-side*.07,y-.045,0);
  }
  for(const y of[.55,.9])for(let segment=0;segment<7;segment++){
   const length=3.05/7,x=-3.05/2+(segment+.5)*length;
   b.add(poleGeo,segment%2?railAccent:railPaint,x,y,0,.105,length,.105,0,0,Math.PI/2);
  }
  return b.finish();
 }
 function buildSign({text,width=3,height=.5}={}){
  const b=batch('Painted ranch wayfinding');b.box(width+.09,height+.08,.10,timber,0,0,0);
  const c=document.createElement('canvas');c.width=1024;c.height=192;const ctx=c.getContext('2d');
  ctx.fillStyle='#35443c';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#aa9f77';ctx.lineWidth=3;ctx.strokeRect(14,14,996,164);
  ctx.fillStyle='#eee6d3';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 62px Georgia';ctx.fillText(text,512,99,930);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=anisotropy;
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.95});
  for(const side of [-1,1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);face.position.z=side*.056;face.rotation.y=side===1?0:Math.PI;b.group.add(face);}
  return b.finish();
 }
 let baleGeometry=null,baleMaterial=null;
 function buildHayStack({seed=1}={}){
  if(!baleGeometry){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const ctx=canvas.getContext('2d'),rnd=random(713);
   ctx.fillStyle='#92815a';ctx.fillRect(0,0,768,256);
   for(let i=0;i<6200;i++){const x=rnd()*768,y=rnd()*256;ctx.strokeStyle=['#b2a074','#89794e','#c0ae82','#75694a'][i%4];ctx.lineWidth=.35+rnd()*.9;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8+rnd()*70,y+(rnd()-.5)*5);ctx.stroke();}
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;
   baleMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:1,envMapIntensity:.35});
   baleGeometry=new THREE.BoxGeometry(.98,.46,.48,6,4,4);
   const p=baleGeometry.attributes.position,v=new THREE.Vector3(),core=new THREE.Vector3();
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);core.set(THREE.MathUtils.clamp(v.x,-.44,.44),THREE.MathUtils.clamp(v.y,-.18,.18),THREE.MathUtils.clamp(v.z,-.19,.19));
    v.sub(core).normalize().multiplyScalar(.048+.003*Math.sin(i*12.13)).add(core);p.setXYZ(i,v.x,v.y,v.z);
   }
   baleGeometry.computeVertexNormals();
  }
  const b=batch('Bound hay bales');
  for(const [x,y,z,angle] of [[0,.24,-.27,.03],[0,.24,.27,-.02],[.02,.70,0,.04]]){
   b.add(baleGeometry,baleMaterial,x,y,z,1,1,1,0,angle,0);
   for(const side of[-1,1]){
    const xx=x+side*.29;
    b.box(.015,.013,.46,darkTimber,xx,y+.227,z,angle);
    b.box(.015,.44,.013,darkTimber,xx,y,z-.238,angle);
    b.box(.015,.44,.013,darkTimber,xx,y,z+.238,angle);
   }
  }
  return b.finish();
 }
 function enhanceArenaMaterial(material){
  if(material.userData.arrivalFooting)return material;material.userData.arrivalFooting=true;
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
   previous.call(material,shader,renderer);
   shader.vertexShader='varying vec3 vArrivalWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvArrivalWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
   shader.fragmentShader=`varying vec3 vArrivalWorld;
    float arrivalHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float arrivalNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(arrivalHash(i),arrivalHash(i+vec2(1,0)),f.x),mix(arrivalHash(i+vec2(0,1)),arrivalHash(i+vec2(1,1)),f.x),f.y);}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 ap=vArrivalWorld.xz;float ar=length(ap/vec2(23.5,18.5));
    float coarse=arrivalNoise(ap*.23),grain=arrivalNoise(ap*1.15);
    float worn=smoothstep(.80,.87,ar)*(1.0-smoothstep(.96,1.01,ar));
    worn*=.78+.22*arrivalNoise(ap*.66);
    float damp=pow(arrivalNoise(ap*.32+vec2(19.0,7.0)),3.0);
    float rake=(.5+.5*sin(ap.x*36.0+sin(ap.y*.37)*1.8))*.024;
    float trackBand=exp(-pow((ar-.885)/.012,2.0));
    float footprint=pow(.5+.5*sin(atan(ap.y/18.5,ap.x/23.5)*270.0),8.0)*trackBand*.065;
    diffuseColor.rgb*=vec3(.98,.955,.91)*(.94+.12*coarse+.04*grain-rake);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.49,.51,.49),worn*.88+damp*.24+footprint);
   `);
  };
  material.customProgramCacheKey=()=>oldKey()+'|arrival-footing-1';material.needsUpdate=true;return material;
 }
 return {buildPlanter,buildNoticeboard,buildPracticeJump,buildSign,buildHayStack,enhanceArenaMaterial,materials:{timber,darkTimber,soil,botanical,iron}};
}
