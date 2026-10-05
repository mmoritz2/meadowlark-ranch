/* Placed ranch catalogue: measured joinery, PBR surfaces and CC0 scanned props.
 * Templates share geometry/textures. Preview clones share the exact silhouette,
 * with separate cached translucent materials; loading upgrades both in place.
 */
import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import {createDeferredLoad} from './deferred-load.js';

export function createRanchBuilderArt({THREE,GLTFLoader,architecture,anisotropy=8,getRanchName=()=> 'Meadowlark Ranch',deferModels=false}) {
 const T=THREE,loader=new T.TextureLoader(),textures=new Map(),templates=new Map(),scans=new Map(),ghosts=new Map();
 const state={version:1,loaded:false,errors:[],models:[],materialNames:[],ready:null};
 function tex(path,color=false){if(textures.has(path))return textures.get(path);const t=loader.load(path,undefined,undefined,()=>state.errors.push(path));t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,anisotropy);textures.set(path,t);return t;}
 function material(name,color,roughness=0.8,metalness=0,scan=null,scale=1){
  const p={name:'Builder | '+name,color,roughness,metalness};
  if(scan){const root=scan.startsWith('scanned/')?'assets/textures/':'assets/textures/builder/';p.map=tex(root+scan+'_diff.webp',true);p.normalMap=tex(root+scan+'_nor_gl.webp');p.normalScale=new T.Vector2(.55,.55);p.roughnessMap=tex(root+scan+'_arm.webp');p.aoMap=p.roughnessMap;p.aoMapIntensity=.55;}
  const m=new T.MeshStandardMaterial(p);m.userData.metres=scale;state.materialNames.push(m.name);return m;
 }
 const oak=material('oiled oak','#f1ece0',.88,0,'coated_pine',.74);
 const aged=material('weathered timber','#dfd2bd',.98,0,'weathered_brown_planks',1.8);
 const endgrain=oak;
 const paint=material('limed timber','#e1dfcb',.88,0,'coated_pine',.74);
 for(const m of [oak,aged,paint])m.userData.grain=true;
 const iron=material('forged iron','#363e3d',.54,.8);
 const steel=material('brushed galvanized steel','#b2bcb9',.38,.91);
 const brass=material('aged brass','#9e7950',.42,.82);
 const stone=material('rough limestone','#c4beb0',.96,0,'scanned/rock_boulder_cracked',1.4);
 const mortar=material('lime mortar','#777567',1);
 const soil=material('potting soil','#7c7263',1,0,'scanned/forest_ground_04',1.5);
 const leather=material('saddle leather','#b4a599',.82,0,'brown_leather',.4);
 const cloth=material('linen weave','#e8dfcb',.98,0,'rough_linen',.27);cloth.normalScale.set(.32,.32);
 const red=cloth.clone();red.name='Builder | oxblood woven cloth';red.color.set('#884b40');
 const blue=cloth.clone();blue.name='Builder | washed indigo cloth';blue.color.set('#566e7e');
 const leaf=material('living foliage','#47633d',.92),petal=material('rose petals','#ac737b',.86),yellow=material('warm ochre','#bf9855',.92),straw=material('dry hay','#eee1ba',1,0,'riet_01',1.15),snow=material('granular snow','#eef0e8',1);
 // The reed photograph supplies fine fibres; warm dry-hay albedo and softer normals keep bales from reading as stone.
 straw.color.setRGB(1.8,1.4,.72);straw.userData.metres=.45;straw.normalScale.set(.30,.30);
 snow.normalMap=cloth.normalMap;snow.normalScale=new T.Vector2(.12,.12);snow.userData.metres=.45;
 const bronze=material('patinated bronze','#54675b',.53,.73),rubber=material('rubber','#303734',.96);
 const water=new T.MeshPhysicalMaterial({name:'Builder | water',color:'#527c79',roughness:.13,metalness:.18,clearcoat:1,transparent:true,opacity:.78,depthWrite:false});
 const glass=new T.MeshPhysicalMaterial({name:'Builder | glass',color:'#d5d9ce',roughness:.13,metalness:.1,transparent:true,opacity:.22,depthWrite:false});
 const glow=material('warm lamp flame','#d9a85a',.6);glow.emissive.set('#ffb45c');glow.emissiveIntensity=1.7;
 const roof=architecture.roofMaterial;roof.userData.metres=1.8;
 // Share the photographed grain with the structural architecture without replacing
 // its custom window/door materials, metre-scaled UVs or recessed geometry.
 for(const m of [architecture.sidingMaterial,...architecture.materials.values()].filter((m,i,a)=>m&&(m===architecture.sidingMaterial||/oiled oak/.test(m.name))&&a.indexOf(m)===i)){
  m.map=aged.map;m.normalMap=aged.normalMap;m.roughnessMap=aged.roughnessMap;m.aoMap=aged.aoMap;m.aoMapIntensity=.45;m.color.set('#d4c2a5');m.needsUpdate=true;
 }
 function rounded(w,h,d,r=.012){
  r=Math.min(r,w*.2,h*.2,d*.2);const g=new T.BoxGeometry(1,1,1,3,3,3).toNonIndexed(),p=g.attributes.position,n=g.attributes.normal;
  const v=new T.Vector3(),q=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);q.set(v.x-Math.sign(v.x)/6,v.y-Math.sign(v.y)/6,v.z-Math.sign(v.z)/6).normalize();p.setXYZ(i,Math.sign(v.x)*(w/2-r)+q.x*r,Math.sign(v.y)*(h/2-r)+q.y*r,Math.sign(v.z)*(d/2-r)+q.z*r);n.setXYZ(i,q.x,q.y,q.z);}
  return g;
 }
 class Model {
  constructor(name){this.root=new T.Group();this.root.name=name;this.parts=new Map();this.count=0;}
  mesh(geo,m,x=0,y=0,z=0,rot=null,scale=null,uv=true){
   let g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
   if(uv&&g.attributes.uv){const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,k=m.userData.metres||1;
    g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());const long=size.y>size.x&&size.y>size.z?'y':size.z>size.x?'z':'x';
    for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
     if(m.userData.grain){const along=long==='x'?p.getX(i):long==='y'?p.getY(i):p.getZ(i);const across=long==='x'?(ny>nz?p.getZ(i):p.getY(i)):long==='y'?(nx>nz?p.getZ(i):p.getX(i)):(ny>nx?p.getX(i):p.getY(i));u.setXY(i,along/k+.15,across/k+.43);}
     else if(ny>nx&&ny>nz)u.setXY(i,p.getX(i)/k,p.getZ(i)/k);else if(nx>nz)u.setXY(i,p.getZ(i)/k,p.getY(i)/k);else u.setXY(i,p.getX(i)/k,p.getY(i)/k);
    }}
   const q=new T.Quaternion();if(rot)q.setFromEuler(new T.Euler(...rot));g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),q,scale?new T.Vector3(...scale):new T.Vector3(1,1,1)));
   if(!this.parts.has(m))this.parts.set(m,[]);this.parts.get(m).push(g);this.count++;return this;
  }
  box(w,h,d,m,x=0,y=0,z=0,rot=null,r=.012){return this.mesh(rounded(w,h,d,r),m,x,y,z,rot);}
  sphere(rx,ry,rz,m,x=0,y=0,z=0,rot=null){const small=Math.max(rx,ry,rz)<.11;return this.mesh(new T.SphereGeometry(1,small?10:20,small?6:12),m,x,y,z,rot,[rx,ry,rz],false);}
  cylinder(rt,rb,h,m,x=0,y=0,z=0,rot=null,n=24){return this.mesh(new T.CylinderGeometry(rt,rb,h,n),m,x,y,z,rot);}
  beam(a,b,w,d,m=oak){const va=new T.Vector3(...a),vb=new T.Vector3(...b),mid=va.clone().add(vb).multiplyScalar(.5),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());const e=new T.Euler().setFromQuaternion(q);return this.box(w,new T.Vector3(...a).distanceTo(new T.Vector3(...b)),d,m,...mid.toArray(),[e.x,e.y,e.z]);}
  tube(points,r,m=iron){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return this.mesh(new T.TubeGeometry(curve,Math.max(8,points.length*5),r,6,false),m);}
  torus(radius,tube,m,x=0,y=0,z=0,rot=null,arc=Math.PI*2){return this.mesh(new T.TorusGeometry(radius,tube,6,32,arc),m,x,y,z,rot,null,false);}
  lathe(points,m,x=0,y=0,z=0){return this.mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),40),m,x,y,z,null,null,false);}
  add(g,x=0,y=0,z=0,ry=0){g.position.set(x,y,z);g.rotation.y=ry;this.root.add(g);return g;}
  bolt(x,y,z,r=.012){this.cylinder(r,r,.012,iron,x,y,z,[Math.PI/2,0,0],8);}
  finish(){for(const [m,parts] of this.parts){const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geo)throw Error('Builder geometry merge failed');const mesh=new T.Mesh(geo,m);mesh.name=m.name;mesh.castShadow=!m.transparent;mesh.receiveShadow=true;this.root.add(mesh);}this.root.userData.builderArt={version:1,parts:this.count,scanned:this.root.userData.scanned||false};return this.root;}
 }
 function scan(b,id,{height=null,width=null,depth=null,x=0,y=0,z=0,ry=0}={}){
  const src=scans.get(id);if(!src)return false;const group=src.clone(true);const bounds=new T.Box3().setFromObject(group),size=bounds.getSize(new T.Vector3()),c=bounds.getCenter(new T.Vector3());
  const s=height?height/size.y:width?width/size.x:depth?depth/size.z:1;
  const wrap=new T.Group();group.position.set(-c.x*s,-bounds.min.y*s,-c.z*s);group.scale.setScalar(s);wrap.add(group);b.add(wrap,x,y,z,ry);b.root.userData.scanned=true;return true;
 }
 function boards(b,w,h,d,m,x,y,z,vertical=false){const n=Math.max(2,Math.ceil((vertical?w:d)/.16));for(let i=0;i<n;i++){if(vertical)b.box(w/n-.006,h,d,m,x-w/2+(i+.5)*w/n,y,z);else b.box(w,h,d/n-.006,m,x,y,z-d/2+(i+.5)*d/n);}}
 function fence(b,length=3,x=0,z=0,ry=0){const f=new Model('Mortised three-rail fence');for(const s of[-1,1]){f.box(.16,1.25,.16,aged,s*length/2,.595,0);f.box(.19,.045,.19,endgrain,s*length/2,1.235,0);for(const y of[.4,.78,1.1])for(const dx of[-.035,.035])f.bolt(s*length/2+dx,y,.088,.009);}for(const y of[.4,.78,1.1])f.box(length+.07,.11,.058,paint,0,y,.015);b.add(f.finish(),x,0,z,ry);}
 function hay(b,x=0,y=0,z=0,s=1){b.box(1.1*s,.55*s,.64*s,straw,x,y+.275*s,z,null,.06);for(const a of[-.30,.30]){b.box(.012*s,.565*s,.657*s,cloth,x+a*s,y+.275*s,z);}
  for(let i=0;i<85;i++){const a=i*2.3999,xx=x+Math.sin(a)*.51*s,zz=z+Math.cos(a*1.47)*.30*s;const yy=y+.55*s+Math.sin(a*3)*.008;b.beam([xx-.045*s,yy,zz],[xx+.07*s,yy+.013*s,zz+.015*s],.004*s,.004*s,i%3?straw:yellow);}}
 function flowers(b,x=0,z=0,n=9,y=.4){
  if(scans.has('flower_gazania')){const count=Math.max(1,Math.ceil(n/4));for(let i=0;i<count;i++){const a=i*2.39996,r=count===1?0:.19;scan(b,'flower_gazania',{height:.37+.035*(i%3),x:x+Math.sin(a)*r,y,z:z+Math.cos(a)*r,ry:a});}return;}
  for(let i=0;i<n;i++){const a=i*2.39996,r=.1+Math.sqrt(i/n)*.32,xx=x+Math.sin(a)*r,zz=z+Math.cos(a)*r,h=.21+.17*(.5+.5*Math.sin(i*8.3));b.tube([[xx,y,zz],[xx+.025,y+h*.55,zz+.018],[xx,y+h,zz]],.009,leaf);for(const s of[-1,1])b.sphere(.085,.012,.029,leaf,xx+s*.05,y+h*.45,zz,[0,a,s*.5]);for(let j=0;j<6;j++){const t=j*Math.PI/3;b.sphere(.037,.028,.018,i%3?petal:cloth,xx+Math.cos(t)*.03,y+h+.013,zz+Math.sin(t)*.03,[0,-t,.35]);}b.sphere(.015,.014,.015,yellow,xx,y+h+.022,zz);}}
 function planter(b){const hasScan=scan(b,'planter_box_01',{width:1.28});const top=hasScan?new T.Box3().setFromObject(b.root).max.y-.045:.39;if(!hasScan){boards(b,1.28,.40,.075,aged,0,.22,-.24,true);boards(b,1.28,.40,.075,aged,0,.22,.24,true);for(const x of[-.62,.62])b.box(.075,.4,.55,aged,x,.22,0);for(const x of[-.56,.56])for(const z of[-.25,.25])b.box(.085,.48,.085,oak,x,.24,z);}b.box(1.1,.045,.40,soil,0,top,0);flowers(b,-.3,0,8,top+.01);flowers(b,.3,0,8,top+.01);}
 function lamp(b,x=0,y=0,z=0,scale=1){if(scan(b,'wooden_lantern_01',{height:.49*scale,x,y,z})){b.cylinder(.031*scale,.035*scale,.12*scale,cloth,x,y+.10*scale,z);b.sphere(.015*scale,.042*scale,.015*scale,glow,x,y+.195*scale,z);return;}const w=.23*scale;b.box(w,.035*scale,w,iron,x,y+.02*scale,z);b.box(w*.88,.28*scale,w*.88,glass,x,y+.18*scale,z);for(const dx of[-1,1])for(const dz of[-1,1])b.beam([x+dx*w*.46,y+.03*scale,z+dz*w*.46],[x+dx*w*.46,y+.34*scale,z+dz*w*.46],.018*scale,.018*scale,iron);b.cylinder(0,w*.8,.14*scale,iron,x,y+.4*scale,z,null,4);b.sphere(.025*scale,.07*scale,.025*scale,glow,x,y+.18*scale,z);}
 function basin(b,r=.6,h=.35,x=0,y=0,z=0,m=stone){const wall=Math.min(.11,r*.18),floor=h*.20;b.lathe([[0,0],[r*.86,0],[r,h*.18],[r,h*.85],[r-.025,h],[r-wall,h],[r-wall-.02,floor],[0,floor]],m,x,y,z);if(m!==iron)b.cylinder(r-wall-.02,r-wall-.02,.008,water,x,y+h*.72,z);}
 function stoneCourses(b,r,h,x=0,z=0){for(let row=0;row<4;row++)for(let i=0;i<14;i++){const a=(i+(row%2)*.5)*Math.PI/7;b.box(r*.40,h/4-.008,.21,stone,x+Math.sin(a)*r,row*h/4+h/8,z+Math.cos(a)*r,[0,a,0],.025);}}
 function wheel(b,x,y,z,r=.3){b.torus(r,.025,iron,x,y,z);b.torus(r-.04,.032,aged,x,y,z);for(let i=0;i<10;i++){const a=i*Math.PI/5;b.beam([x,y,z],[x+Math.sin(a)*(r-.05),y+Math.cos(a)*(r-.05),z],.026,.027,oak);}b.cylinder(.06,.06,.16,iron,x,y,z,[Math.PI/2,0,0]);}
 function pumpkin(b,x,y,z,r){const geo=new T.SphereGeometry(1,40,20),p=geo.attributes.position;for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i)),rr=1+.065*Math.cos(a*10);p.setXYZ(i,p.getX(i)*rr,p.getY(i),p.getZ(i)*rr);}geo.computeVertexNormals();b.mesh(geo,yellow,x,y,z,null,[r,r*.8,r],false);b.tube([[x,y+r*.73,z],[x+.015,y+r*1.02,z],[x+.055,y+r*1.06,z+.014]],r*.10,aged);}
 function fabric(b,w,h,x,y,z,m=red){const geo=new T.PlaneGeometry(w,h,16,14),p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,.025*Math.sin(p.getX(i)*23)+.012*Math.sin(p.getY(i)*11));geo.computeVertexNormals();const mat=m.clone();mat.side=T.DoubleSide;b.mesh(geo,mat,x,y,z);}
 function shelter(b,stall=false){const w=4,d=3.25,h=2.5;
  b.box(w,.10,d,stone,0,.015,0);
  boards(b,w,2.15,.085,aged,0,1.18,-d/2,true);
  for(const x of[-w/2,w/2]){const side=new Model('Boarded divider');boards(side,d,1.5,.085,aged,0,.82,0,true);for(let i=0;i<13;i++)side.cylinder(.012,.012,.62,iron,-d/2+.13+i*.25,1.89,0);b.add(side.finish(),x,0,0,Math.PI/2);for(const z of[-d/2,d/2]){b.box(.17,h,.17,oak,x,h/2,z);b.box(.22,.18,.22,stone,x,.045,z);b.beam([x,h-.55,z],[x-Math.sign(x)*.43,h-.13,z],.09,.1,oak);}}
  b.box(w+.18,.19,.16,oak,0,h-.1,d/2);b.box(w+.5,.12,d+.5,roof,0,h+.06,0,[-.07,0,0]);
  for(const z of[-d/2-.24,d/2+.24])b.box(w+.55,.16,.09,aged,0,h+.035+z*.07,z);
  b.box(w+.55,.08,.12,iron,0,h-.04,-d/2-.26);
  for(const x of[-1.2,0,1.2])b.box(.10,.16,d+.2,oak,x,h-.12,0,[-.07,0,0]);
  if(stall){boards(b,1.8,1.15,.07,aged,-1,.64,d/2,true);for(const y of[.25,1.05])b.box(1.87,.09,.1,oak,-1,y,d/2+.02);b.beam([-1.85,.28,d/2+.08],[-.14,1.02,d/2+.08],.075,.075,oak);for(const y of[.30,1])b.box(.32,.055,.03,iron,-1.76,y,d/2+.075);}
  hay(b,1,.08,-.9,.9);lamp(b,-1.78,1.7,d/2+.08,.8);
 }
 function tree(b,frost=false,blossom=false){
  if(scan(b,frost?'pine_sapling_small':'tree_small_02',{height:frost?2.85:blossom?3.8:2.5})){
   const plant=b.root.children[b.root.children.length-1];
   if(frost||blossom)plant.traverse(o=>{if(!o.isMesh||!/leaves|twig/i.test(o.material.name))return;
    o.material=o.material.clone();o.material.name='Builder | '+(frost?'snow-dusted needles':'spring blossom canopy');
    o.material.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     #ifdef USE_MAP
      float canopyPatch=smoothstep(.25,.70,fract(sin(dot(floor(vMapUv*18.0),vec2(12.9898,78.233)))*43758.5453));
      diffuseColor.rgb=mix(diffuseColor.rgb,${frost?'vec3(.72,.79,.78)':'vec3(.64,.34,.40)'},canopyPatch*${frost?'.62':'.87'});
     #endif`);};o.material.customProgramCacheKey=()=>frost?'builder-frost-1':'builder-blossom-1';
   });
   if(!frost){
    const lod=new T.LOD();b.root.remove(plant);lod.addLevel(plant,0);
    const height=blossom?3.8:2.5,atlas=tex('assets/models/world/realism/tree_small_02_views.webp',true);
    const geo=new T.PlaneGeometry(height*1.2,height),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/4,uv.getY(i)/2+.5);geo.translate(0,height*.48,0);
    const mat=new T.MeshStandardMaterial({name:'Builder | distant tree canopy',map:atlas,alphaTest:.3,side:T.DoubleSide,roughness:.97,color:blossom?'#d8bbc3':'#ffffff'});
    const card=new T.Mesh(geo,mat);card.name='Builder tree impostor';card.userData.builderBillboard=true;card.castShadow=false;card.receiveShadow=true;lod.addLevel(card,28);b.root.add(lod);
   }
   return;
  }
  b.cylinder(.045,.095,1.6,aged,0,.8,0);const branchMap=tex('assets/textures/realism/foliage_branch_rgba.png',true);const lm=new T.MeshStandardMaterial({name:'Builder | leaf sprays',map:branchMap,alphaTest:.38,side:T.DoubleSide,roughness:.94,color:blossom?'#b4a792':'#c7cfb6'});
  for(let i=0;i<30;i++){const a=i*2.399,r=.2+.4*Math.sin(i*1.13)**2,y=1.4+.8*(i%7)/7;const x=Math.sin(a)*r,z=Math.cos(a)*r;b.beam([0,y-.35,0],[x,y,z],.015,.015,aged);b.mesh(new T.PlaneGeometry(.58,.58),lm,x,y,z,[.1,a,.25]);}
 }
 const arenaPaint=paint.clone();arenaPaint.name='Arena | painted timber';arenaPaint.map=null;arenaPaint.color.set('#d9d7c9');
 const arenaRed=arenaPaint.clone();arenaRed.name='Arena | painted red rails';arenaRed.color.set('#984d40');
 const arenaBlue=arenaPaint.clone();arenaBlue.name='Arena | painted blue rails';arenaBlue.color.set('#4d7285');
 // Arena structures use the same measured joinery and photographed surfaces as placed furniture.
 // Local +Z faces the arena; the centre aisle stays clear from the stairs to the rear row.
 function arenaEntry(b){
  b.root.userData.arenaArt={kind:'arena_entry',version:2,clearWidth:5.5,clearHeight:3.55};
  for(const x of[-3,3]){
   b.box(.54,.10,.54,stone,x,.015,0,null,.026);
   for(let row=0;row<3;row++){
    b.box(.46,.18,.46,stone,x,.15+row*.185,0,null,.025);
   }
   b.box(.56,.075,.56,stone,x,.66,0,null,.016);
   b.box(.25,3.15,.25,oak,x,2.23,0,null,.015);
   b.box(.28,.30,.28,iron,x,.81,0,null,.005);
   for(const z of[-.132,.132])for(const y of[.75,.91,3.58,3.75])b.bolt(x,y,z,.018);
   b.beam([x,2.95,0],[x-Math.sign(x)*.70,3.65,0],.13,.16,oak);
   b.box(.36,.11,.36,oak,x,3.80,0,null,.016);
   for(const z of[-.25,.25])b.beam([x,3.48,0],[x,4.27,z],.08,.08,aged);
  }
  b.box(6.85,.23,.25,aged,0,3.665,0,null,.018);
  b.box(6.94,.055,.29,oak,0,3.805,0,null,.01);
  for(const x of[-2.18,2.18])b.box(.045,.38,.045,iron,x,4.02,0);
  // Cedar weather cap, fascia, and exposed rafter ends complete the silhouette.
  const half=.59,rise=.25,slope=Math.hypot(half,rise),angle=Math.atan2(rise,half);
  for(const side of[-1,1]){
   b.box(7.18,.075,slope,roof,0,4.365,side*.295,[-side*angle,0,0]);
   b.box(7.23,.12,.075,aged,0,4.225,side*.61);
  }
  b.box(7.24,.07,.12,iron,0,4.52,0,null,.014);
  for(const x of[-3,-1.5,0,1.5,3])for(const side of[-1,1])
   b.beam([x,4.42,0],[x,4.17,side*.67],.07,.09,oak);
 }
 function grandstand(b){
  const front=.35,back=-3.15;
  b.root.userData.arenaArt={kind:'grandstand',version:1,seatRows:3};
  for(const x of[-5.85,-1.8,1.8,5.85])for(const z of[front,back]){
   b.box(.42,.24,.42,stone,x,.06,z);b.box(.25,.07,.25,iron,x,.20,z);
   b.box(.18,3.73,.18,arenaPaint,x,2.07,z);
   for(const dz of[-.07,.07])b.bolt(x,3.61,z+dz,.018);
   for(const s of[-1,1])if(Math.abs(x+s*.65)<6.1)b.beam([x,3.15,z],[x+s*.65,3.83,z],.085,.13,aged);
  }
  for(const z of[front,back])b.box(12.15,.23,.18,aged,0,3.86,z);
  for(let row=0;row<3;row++){
   const level=.18+row*.44,z=-.10-row*1.1;
   for(const side of[-1,1]){
    const x=side*3.34;
    boards(b,5.46,.065,1.09,aged,x,level-.032,z);
    b.box(5.46,.15,.06,arenaPaint,x,level-.075,z+.535);
    for(const lx of[side*.72,side*3.05,side*5.92]){
     b.box(.11,level,.11,aged,lx,level/2,z);
     b.box(.095,.43,.095,arenaPaint,lx,level+.19,z-.19);
     b.box(.10,.07,.48,aged,lx,level+.41,z-.19);
     b.box(.065,.84,.065,arenaPaint,lx,level+.42,z-.42);
    }
    for(const dz of[-.06,-.20,-.34])b.box(5.36,.047,.13,oak,x,level+.46,z+dz);
    for(const dy of[.70,.84]){b.box(5.36,.115,.047,oak,x,level+dy,z-.44,[.10,0,0]);for(const lx of[side*.72,side*3.05,side*5.92])b.bolt(lx,level+dy,z-.411,.01);}
   }
  }
  // Five shallow, closed risers; a level landing continues between the back benches.
  for(let i=0;i<5;i++){
   const h=.18+i*.22,z=.45-i*.55;
   b.box(1.10,h,.55,aged,0,h/2,z);
   b.box(1.14,.055,.55,oak,0,h+.015,z);
   b.box(1.08,.012,.055,rubber,0,h+.048,z+.225);
  }
  boards(b,1.1,.065,1.2,aged,0,1.04,-2.48);
  for(const x of[-6.04,6.04]){
   b.beam([x,.23,.35],[x,1.08,-3.15],.13,.13,aged);
   b.beam([x,.04,-3.15],[x,1.04,-.65],.10,.10,aged);
   for(let i=0;i<4;i++){const z=.30-i*1.1,y=.2+i*.29;b.box(.095,1.02,.095,arenaPaint,x,y+.5,z);}
   for(const offset of[.62,1.08])b.beam([x,.18+offset,.35],[x,1.06+offset,-3.15],.065,.075,paint);
  }
  for(const x of[-5.9,-4,-2,0,2,4,5.9])b.box(.095,1.12,.095,arenaPaint,x,1.57,-3.15);
  for(const y of[1.48,2.12])b.box(12.15,.065,.075,arenaPaint,0,y,-3.15);
  for(let i=0;i<43;i++)b.box(.028,.59,.028,iron,-5.88+i*.28,1.80,-3.15);
  // Real rafters carry two shingled roof slopes, with fascia, ridge cap and guttering.
  const cz=-1.4,half=2.35,rise=.78,angle=Math.atan2(rise,half),slope=Math.hypot(half,rise);
  for(const s of[-1,1]){
   b.box(13,.09,slope,roof,0,4.06+rise/2,cz+s*half/2,[s*angle,0,0]);
   b.box(13.08,.17,.08,arenaPaint,0,4.02,cz+s*half);
   b.box(13.08,.05,.10,iron,0,3.97,cz+s*(half+.065));
  }
  b.box(13.12,.065,.17,iron,0,4.85,cz);
  for(const x of[-6.3,-5.85,-3.9,-1.8,1.8,3.9,5.85,6.3]){
   b.box(.10,.14,4.75,aged,x,3.93,cz);
   for(const s of[-1,1])b.beam([x,4.0,cz+s*half],[x,4.78,cz],.10,.14,aged);
   b.box(.085,.70,.085,arenaPaint,x,4.35,cz);
  }
  for(const x of[-6.1,6.1])b.tube([[x,3.97,cz-half],[x,3.75,back-.22],[x,.20,back-.22],[x,.12,back-.45]],.036,iron);
  b.box(3.5,.33,.055,aged,0,3.68,.48);
  const cv=document.createElement('canvas');cv.width=1024;cv.height=128;const cx=cv.getContext('2d');cx.fillStyle='#e9e5d8';cx.font='500 48px Georgia';cx.textAlign='center';cx.textBaseline='middle';cx.fillText('SPECTATOR PAVILION',512,64,950);
  const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;
  const lettering=new T.MeshStandardMaterial({name:'Arena | pavilion lettering',map:tx,transparent:true,roughness:.9,depthWrite:false});
  b.mesh(new T.PlaneGeometry(3.3,.29),lettering,0,3.68,.511,null,null,false);
 }
 function judgesPavilion(b){
  b.root.userData.arenaArt={kind:'judges_pavilion',version:1};
  for(const x of[-.98,.98])for(const z of[-.98,.98]){
   b.box(.36,.20,.36,stone,x,.05,z);b.box(.17,3.19,.17,arenaPaint,x,1.715,z);
   b.box(.22,.06,.22,iron,x,.16,z);
  }
  for(const x of[-.97,.97]){b.beam([x,.22,-.98],[x,1.01,.98],.075,.075,aged);b.beam([x,.22,.98],[x,1.01,-.98],.075,.075,aged);}
  for(const z of[-.99,.99])b.box(2.2,.20,.14,aged,0,.94,z);
  boards(b,2.22,.08,2.22,oak,0,1.08,0);
  for(const x of[-1.02,1.02]){
   for(const y of[1.31,2.12])b.box(.07,.07,2.1,arenaPaint,x,y,0);
   for(let i=0;i<8;i++)b.box(.038,.75,.038,arenaPaint,x,1.72,-.87+i*.25);
   b.box(.16,.17,2.3,aged,x,3.29,0);
   for(const z of[-.98,.98])b.beam([x,2.78,z],[x,3.21,z-Math.sign(z)*.48],.08,.08,aged);
  }
  for(const y of[1.31,2.12])b.box(2.1,.07,.07,arenaPaint,0,y,1.02);
  for(let i=0;i<9;i++)b.box(.038,.75,.038,arenaPaint,-1+i*.25,1.72,1.02);
  for(const side of[-1,1]){b.box(.56,.07,.07,arenaPaint,side*.77,2.12,-1.02);b.box(.065,1.05,.065,arenaPaint,side*.5,1.63,-1.02);}
  for(let i=0;i<6;i++){
   const h=(i+1)*.18,z=-2.56+i*.27;b.box(.92,h,.275,aged,0,h/2,z);b.box(.97,.045,.29,oak,0,h+.018,z);
   b.box(.89,.012,.045,rubber,0,h+.046,z-.10);
  }
  for(const x of[-.54,.54]){b.box(.065,.95,.065,arenaPaint,x,.48,-2.62);b.beam([x,.95,-2.62],[x,2.10,-1.0],.055,.065,paint);}
  for(const z of[-1.11,1.11])b.box(2.27,.16,.16,aged,0,3.29,z);
  const a=Math.atan2(.58,1.43),len=Math.hypot(.58,1.43);
  for(const s of[-1,1]){b.box(2.91,.085,len,roof,0,3.68,s*.715,[s*a,0,0]);b.box(2.97,.13,.07,arenaPaint,0,3.35,s*1.43);}
  for(const x of[-1.4,1.4])for(const s of[-1,1])b.beam([x,3.35,s*1.44],[x,3.95,0],.085,.12,paint);
  b.box(2.98,.06,.15,iron,0,4.0,0);
  boards(b,1.66,.055,.5,oak,0,1.84,.58);
  for(const x of[-.65,.65])b.box(.055,.70,.055,iron,x,1.46,.6);
  b.add(createTemplate('chair'),0,1.12,-.12);
  b.box(.23,.01,.31,cloth,.34,1.88,.6,[0,.17,0]);b.cylinder(.045,.042,.10,steel,-.45,1.92,.67);
 }
 function mountingBlock(b){
  for(let i=0;i<3;i++){const h=.18*(i+1),z=.34-i*.32;boards(b,.82,.055,.32,oak,0,h,z);for(const x of[-.35,.35]){b.box(.10,h,.30,aged,x,h/2,z);b.bolt(x,h-.07,z+.155,.012);}b.box(.78,.13,.045,arenaPaint,0,h-.08,z+.14);for(const dz of[-.075,.075])b.box(.76,.01,.035,rubber,0,h+.033,z+dz);}
  for(const x of[-.35,.35])b.box(.10,.07,.96,aged,x,.06,.02);
 }
 function poleRack(b){
  for(const x of[-1.1,1.1]){
   b.box(.16,.10,.94,aged,x,.05,0);b.box(.105,1.18,.105,arenaPaint,x,.62,-.23);
   b.beam([x,.10,-.40],[x,.68,-.23],.065,.065,aged);
   for(const y of[.32,.65,.98]){b.box(.07,.055,.58,iron,x,y,.02);b.box(.075,.09,.045,iron,x,y+.025,.30);b.bolt(x,y,-.17,.015);}
  }
  b.box(2.35,.11,.09,aged,0,.24,-.23);
  for(let row=0;row<3;row++)for(let band=0;band<9;band++)b.cylinder(.052,.052,1/3,band%3===1?arenaPaint:row===1?arenaRed:arenaBlue,-4/3+band/3,.405+row*.33,.12,[0,0,Math.PI/2],16);
 }
 function floodlight(b){
  b.box(.36,.13,.36,stone,0,.025,0);b.box(.28,.035,.28,steel,0,.11,0);
  for(const x of[-.10,.10])for(const z of[-.10,.10])b.cylinder(.02,.02,.035,iron,x,.145,z,null,6);
  b.cylinder(.065,.095,6.5,steel,0,3.37,0);
  b.box(.18,.32,.13,iron,0,.62,-.10);b.box(.025,.09,.02,steel,.055,.62,-.175);
  b.box(.58,.045,.075,iron,0,6.53,0);
  for(const x of[-.29,.29]){b.box(.045,.29,.075,iron,x,6.65,0);b.bolt(x,6.72,.045,.025);}
  b.box(.76,.45,.22,iron,0,6.7,0,[-.25,0,0]);
  for(let i=0;i<8;i++)b.box(.018,.35,.08,steel,-.31+i*.089,6.69,-.16,[-.25,0,0]);
  b.tube([[0,6.45,-.075],[.11,6.5,-.16],[.12,6.65,-.19]],.012,rubber);
 }
 function windmillTower(b){
  b.root.userData.arenaArt={kind:'windmill_tower',version:1};
  // A stone plinth carries a tapered, boarded octagonal mill, with framed openings.
  stoneCourses(b,1.61,.43);
  b.cylinder(1.07,1.68,6.64,aged,0,3.73,0,null,8);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=Math.sin(a),z=Math.cos(a);
   b.beam([x*1.69,.39,z*1.69],[x*1.08,7.03,z*1.08],.12,.12,arenaPaint);
   for(const y of[.48,3.58,6.94]){const r=1.73-(y-.39)*.092,next=a+Math.PI/4;b.beam([x*r,y,z*r],[Math.sin(next)*r,y,Math.cos(next)*r],.08,.095,arenaPaint);}
  }
  for(const y of[1.0,1.65,2.30,2.95,4.12,4.77,5.42,6.07,6.72]){
   const r=1.69-(y-.39)*.092;b.cylinder(r+.018,r+.03,.038,oak,0,y,0,null,8);
  }
  boards(b,.80,1.66,.06,oak,0,1.15,1.64,true);
  for(const x of[-.45,.45])b.box(.085,1.79,.11,arenaPaint,x,1.16,1.66);
  b.box(.98,.095,.11,arenaPaint,0,2.02,1.66);
  b.beam([-.34,.41,1.69],[.34,1.83,1.69],.07,.04,aged);
  for(const y of[.65,1.65])b.box(.27,.04,.025,iron,-.2,y,1.71);
  b.torus(.04,.009,iron,.26,1.13,1.72);
  for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const w=new Model('Mill window');w.box(.50,.72,.055,iron,0,4.83,0);
   for(const x of[-.28,0,.28])w.box(.045,.83,.06,arenaPaint,x,4.83,.035);
   for(const y of[4.42,4.83,5.24])w.box(.60,.045,.06,arenaPaint,0,y,.035);
   w.box(.64,.045,.19,oak,0,4.4,.055);b.add(w.finish(),Math.sin(a)*1.23,0,Math.cos(a)*1.23,a);
  }
  b.cylinder(0,1.47,1.46,roof,0,7.76,0,null,32);
  b.torus(1.45,.065,arenaPaint,0,7.02,0,[Math.PI/2,0,0]);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;b.beam([Math.sin(a)*1.46,7.04,Math.cos(a)*1.46],[0,8.50,0],.055,.055,iron);}
  b.cylinder(.055,.065,.23,iron,0,8.60,0);
  b.cylinder(.14,.14,.86,iron,0,6.8,1.35,[Math.PI/2,0,0]);
 }
 function windmillRotor(b){
  b.cylinder(.23,.23,.28,iron,0,0,0,[Math.PI/2,0,0]);
  b.cylinder(.13,.13,.06,brass,0,0,.17,[Math.PI/2,0,0]);
  for(let i=0;i<4;i++){
   const sail=new Model('Mill | lattice sail');sail.box(.095,3.62,.075,aged,0,1.66,0);
   sail.box(.70,2.55,.015,cloth,.35,2.14,.015);
   for(const x of[0,.70])sail.box(.048,2.64,.055,arenaPaint,x,2.14,.035);
   for(let k=0;k<10;k++)sail.box(.75,.04,.07,oak,.35,.84+k*.29,.042);
   sail.beam([0,.88,.055],[.7,3.43,.055],.032,.03,aged);
   const g=sail.finish();g.rotation.z=i*Math.PI/2;b.root.add(g);
  }
 }
 function createTemplate(type){const b=new Model('Ranch builder | '+type);
  switch(type){
   case 'windmill_tower':windmillTower(b);break;
   case 'windmill_rotor':windmillRotor(b);break;
   case 'beehive':
    for(const x of[-.19,.19]){b.box(.10,.20,.55,aged,x,.09,0);b.box(.17,.10,.20,stone,x,.015,0);}
    b.box(.57,.055,.61,oak,0,.205,.025);
    for(let row=0;row<3;row++){
     const y=.33+row*.21;b.box(.51,.20,.52,arenaPaint,0,y,0);
     for(const x of[-.22,.22])b.box(.055,.19,.032,oak,x,y,.27);
     b.box(.19,.025,.055,aged,0,y+.045,.28);
     for(const x of[-.25,.25])b.box(.035,.025,.17,oak,x,y+.045,0);
    }
    b.box(.25,.025,.012,iron,0,.25,.268);b.box(.34,.02,.15,oak,0,.237,.32);
    b.box(.62,.055,.65,steel,0,.895,0,[.055,0,0]);
    break;
   case 'arena_entry':arenaEntry(b);break;
   case 'grandstand':grandstand(b);break;
   case 'judges_pavilion':judgesPavilion(b);break;
   case 'mounting_block':mountingBlock(b);break;
   case 'pole_rack':poleRack(b);break;
   case 'floodlight':floodlight(b);break;
   case 'fence':fence(b);break;
   case 'post':b.box(.19,1.4,.19,aged,0,.66,0);b.box(1.03,.13,.16,oak,0,1.24,0);b.box(.24,.045,.24,oak,0,1.38,0);for(const x of[-.32,.32]){b.torus(.058,.012,iron,x,1.12,.10);b.bolt(x,1.23,.09,.02);}break;
   case 'haybale':hay(b);break;
   case 'barrel':if(!scan(b,'wine_barrel_01',{height:1.02})){b.lathe([[.31,0],[.39,.24],[.42,.5],[.37,.9],[.31,1]],aged);for(const y of[.1,.25,.78,.92])b.torus(.345+(.5-Math.abs(y-.5))*.14,.026,iron,0,y,0,[Math.PI/2,0,0]);b.cylinder(.31,.31,.025,oak,0,.99,0);}break;
   case 'stump':if(!scan(b,'tree_stump_01',{height:.63}))b.cylinder(.38,.5,.6,aged,0,.3,0);break;
   case 'boulder':if(!scan(b,'rock_moss_set_01',{height:1.12}))b.sphere(.85,.64,.67,stone,0,.50,0);break;
   case 'planter':planter(b);break;
   case 'lantern':b.box(.14,2.36,.14,aged,0,1.15,0);b.box(.23,.23,.23,stone,0,.045,0);b.beam([0,1.86,0],[.34,2.32,0],.055,.055,iron);b.box(.46,.065,.07,iron,.14,2.35,0);b.torus(.046,.009,iron,.3,2.29,0);lamp(b,.3,1.75,0);break;
   case 'bench':for(const x of[-.59,.59]){for(const z of[-.20,.20])b.box(.085,.5,.085,oak,x,.245,z);b.box(.11,.075,.56,aged,x,.44,0);b.beam([x,.18,-.21],[x,.99,-.26],.075,.075,oak);b.beam([x,.27,.16],[x,.45,-.16],.06,.06,aged);}boards(b,1.55,.065,.51,oak,0,.5,0);for(const y of[.72,.88]){b.box(1.55,.13,.055,oak,0,y,-.245,[.10,0,0]);for(const x of[-.59,.59])b.bolt(x,y,-.207);}break;
   case 'stand':for(const x of[-.3,.3]){b.beam([x*1.2,.035,-.34],[x*.8,1.0,-.24],.065,.065,aged);b.beam([x*1.2,.035,.34],[x*.8,1.0,.24],.065,.065,aged);}b.box(.75,.07,.11,oak,0,.97,0);b.sphere(.31,.12,.4,leather,0,1.015,0);for(const x of[-.26,.26]){b.sphere(.06,.22,.29,leather,x,.89,.04,[0,0,-Math.sign(x)*.35]);b.torus(.09,.012,steel,x*1.35,.63,.02,[0,Math.PI/2,0]);}break;
   case 'sapling':tree(b);break;
   case 'sign':for(const x of[-.69,.69])b.box(.12,1.85,.12,aged,x,.86,0);boards(b,1.72,.62,.085,oak,0,1.40,0,true);for(const y of[1.12,1.70])b.box(1.84,.07,.11,aged,0,y,0);for(const x of[-.68,.68])for(const y of[1.2,1.6])b.bolt(x,y,.048);{
    const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const cx=cv.getContext('2d');cx.fillStyle='#eee7d4';cx.textAlign='center';cx.textBaseline='middle';cx.font='600 66px Georgia';cx.fillText(getRanchName().slice(0,36),512,126,940);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;const m=new T.MeshStandardMaterial({name:'Builder | painted ranch lettering',map:t,transparent:true,depthWrite:false,roughness:.93,polygonOffset:true,polygonOffsetFactor:-1});b.mesh(new T.PlaneGeometry(1.62,.405),m,0,1.42,.047,null,null,false);
   }break;
   case 'stall':shelter(b,true);break;
   case 'shelter':shelter(b);break;
   case 'wall':case 'door':{
    if(type==='wall')boards(b,3,2.4,.13,paint,0,1.2,0,true);
    else {for(const x of[-1,1])boards(b,1,2.4,.13,paint,x,1.2,0,true);boards(b,1,.42,.13,paint,0,2.19,0,true);boards(b,.90,1.91,.065,oak,0,.96,.025,true);for(const x of[-.5,.5])b.box(.085,2,.20,aged,x,1,0);b.box(1.1,.085,.20,aged,0,2,0);for(const y of[.3,1.65])b.box(.32,.055,.02,iron,-.31,y,.07);b.beam([-.4,.2,.07],[.4,1.73,.07],.075,.04,aged);b.torus(.047,.009,iron,.31,1,.10);}
    for(const y of[.065,2.41])b.box(3,.11,.19,aged,0,y,0);for(const x of[-1.44,1.44])b.box(.095,2.4,.17,oak,x,1.2,0);
   }break;
   case 'floor':boards(b,2,.07,2,oak,0,.035,0);for(const z of[-.83,.83])for(let i=0;i<12;i++)b.cylinder(.006,.006,.003,iron,-.92+i*.166,.072,z);break;
   case 'flower_arch':for(const x of[-1,1]){b.box(.095,2.4,.095,aged,x,1.18,0);for(const z of[-.2,.2])b.box(.05,2.1,.05,oak,x,1.1,z);for(const y of[.45,.9,1.35,1.8,2.2])b.box(.085,.035,.48,oak,x,y,0);flowers(b,x,0,10,1.6);}b.tube([[-1,2.30,0],[-.65,2.7,0],[0,2.85,0],[.65,2.7,0],[1,2.3,0]],.045,aged);for(let i=0;i<9;i++){const x=-.9+i*.225;flowers(b,x,0,3,2.35+.25*(1-x*x));}break;
   case 'birdbath':b.lathe([[0,0],[.32,0],[.35,.07],[.22,.15],[.12,.26],[.10,.65],[.23,.84]],stone);basin(b,.52,.19,0,.82);break;
   case 'hedge':for(const x of[-.75,0,.75]){if(!scan(b,'wild_rooibos_bush',{height:1.1,x})){tree(b);break;}}break;
   case 'fountain':basin(b,1.28,.38);b.lathe([[.3,0],[.3,.1],[.17,.2],[.12,.85],[.24,1]],stone,0,.29);basin(b,.52,.18,0,1.27);b.sphere(.07,.12,.07,stone,0,1.58,0);for(let i=0;i<8;i++){const a=i*Math.PI/4;b.tube([[Math.sin(a)*.42,1.42,Math.cos(a)*.42],[Math.sin(a)*.58,.93,Math.cos(a)*.58],[Math.sin(a)*.67,.33,Math.cos(a)*.67]],.009,water);}break;
   case 'pond':basin(b,1.45,.15,0,-.055);for(let i=0;i<18;i++){const a=i*Math.PI/9;b.sphere(.23,.10,.15,stone,Math.sin(a)*1.4,.035,Math.cos(a)*1.4,[0,a,.1]);}for(let i=0;i<3;i++){const x=.2+i*.22,z=.25-i*.19;b.sphere(.19,.009,.16,leaf,x,.032,z);flowers(b,x,z,1,.04);}break;
   case 'maypole':b.cylinder(.055,.09,3.85,paint,0,1.88,0);b.torus(.42,.05,leaf,0,3.68,0,[Math.PI/2,0,0]);for(let i=0;i<8;i++){const a=i*Math.PI/4;b.tube([[Math.sin(a)*.42,3.68,Math.cos(a)*.42],[Math.sin(a+.3)*.55,2.4,Math.cos(a+.3)*.55],[Math.sin(a)*1.0,.6,Math.cos(a)*1.0]],.018,i%2?red:cloth);}break;
   case 'tulip_bed':b.box(1.8,.10,1.0,soil,0,.035,0);for(const z of[-.5,.5])b.box(1.85,.14,.065,aged,0,.06,z);flowers(b,-.45,0,12,.1);flowers(b,.4,0,12,.1);break;
   case 'butterfly_house':b.box(.10,1.6,.10,aged,0,.76,0);boards(b,.42,.65,.10,paint,0,1.63,0,true);for(const x of[-.22,.22])b.box(.055,.66,.32,oak,x,1.63,0);for(const x of[-.12,0,.12])b.box(.018,.34,.012,iron,x,1.66,.059);b.box(.56,.065,.4,roof,0,2,0,[0,0,.09]);break;
   case 'blossom_tree':tree(b,false,true);break;
   case 'trough':for(const x of[-.57,.57])b.box(.18,.22,.57,stone,x,.08,0);b.box(1.55,.06,.65,steel,0,.19,0,null,.03);for(const z of[-.32,.32]){b.box(1.55,.45,.045,steel,0,.4,z,null,.02);b.box(1.61,.035,.062,steel,0,.64,z);}for(const x of[-.76,.76])b.box(.045,.45,.64,steel,x,.4,0);b.box(1.44,.01,.56,water,0,.52,0);b.tube([[.79,.24,0],[.82,.7,0],[.62,.74,0],[.60,.66,0]],.02,brass);for(const x of[-.68,.68])for(const z of[-.345,.345])for(const y of[.26,.56])b.bolt(x,y,z,.009);break;
   case 'wash_rack':b.box(2.4,.09,2.4,stone,0,.018,0);for(const x of[-1.05,1.05])b.tube([[x,.03,.9],[x,1.25,.9],[x,1.4,.4],[x,1.4,-.9],[x,2.2,-1.0]],.032,steel);b.tube([[-1.05,2.2,-1.0],[0,2.2,-1.0],[1.05,2.2,-1]],.032,steel);b.tube([[.8,1.9,-.95],[.55,1.55,-.86],[.7,.42,-.64],[.86,.37,-.66],[.97,1.13,-.62]],.012,rubber);for(let i=0;i<15;i++)b.box(.045,.018,.30,iron,-.36+i*.05,.073,.2);break;
   case 'muck_cart':case 'harvest_wagon':{
    const big=type==='harvest_wagon',w=big?2.1:1.1,d=big?1.2:.7,h=big?.55:.42;
    boards(b,w,.07,d,aged,0,.51,0);for(const z of[-d/2,d/2])for(let j=0;j<3;j++)b.box(w,.12,.055,oak,0,.59+j*.14,z);
    for(const x of[-w/2,w/2]){const e=new Model('Cart end');boards(e,d,h,.055,aged,0,.51+h/2,0,true);b.add(e.finish(),x,0,0,Math.PI/2);}
    for(const x of(big?[-.75,.75]:[0]))for(const z of[-d/2-.06,d/2+.06])wheel(b,x,.32,z,.30);b.box(w+.35,.09,.09,iron,0,.31,0);for(const z of[-d*.31,d*.31])b.beam([w/2,.48,z],[w/2+.67,.84,z],.045,.045,oak);
    if(big){for(let i=0;i<6;i++)pumpkin(b,-.65+(i%3)*.63,.99,Math.floor(i/3)*.52-.26,.25);hay(b,.45,1.16,0,.65);}else hay(b,0,.57,0,.7);
   }break;
   case 'feed_bin':b.box(1,.76,.7,steel,0,.38,0);b.box(1.07,.045,.77,steel,0,.805,-.06,[-.16,0,0]);for(const x of[-.45,.45])b.box(.045,.68,.045,iron,x,.35,.36);b.box(.24,.04,.03,iron,0,.74,.37);for(const y of[.14,.6])for(const x of[-.44,.44])b.bolt(x,y,.365);break;
   case 'tack_hook':for(const x of[-.53,.53]){b.box(.065,1.82,.065,aged,x,.87,-.03);b.box(.22,.065,.32,aged,x,0,-.03);}boards(b,1.2,.24,.095,aged,0,1.65,0,true);for(const x of[-.43,0,.43]){b.tube([[x,1.66,.06],[x,1.49,.12],[x,1.5,.20],[x,1.57,.2]],.017,iron);b.bolt(x,1.72,.055);}for(const x of[-.43,.43])b.torus(.13,.024,leather,x,1.21,.15);break;
   case 'bed':for(const x of[-.89,.89])for(const z of[-.56,.56])b.box(.095,.57,.095,oak,x,.27,z);b.box(1.99,.13,1.28,aged,0,.35,0);boards(b,2,.72,.075,oak,0,.72,-.62,true);b.box(1.9,.21,1.19,cloth,0,.565,0,null,.07);b.box(1.9,.13,.91,red,0,.7,.13,null,.055);for(const x of[-.49,.49])b.box(.69,.13,.34,cloth,x,.735,-.41,[0,0,.035],.07);for(let i=0;i<8;i++)b.box(.008,.012,.8,cloth,-.79+i*.225,.769,.12);break;
   case 'table':boards(b,1.65,.06,.95,oak,0,.78,0);for(const x of[-.68,.68])for(const z of[-.33,.33])b.box(.075,.74,.075,oak,x,.37,z);for(const z of[-.34,.34])b.box(1.46,.11,.055,aged,0,.66,z);basin(b,.15,.07,.26,.816,0,stone);break;
   case 'chair':boards(b,.47,.055,.45,oak,0,.45,0);for(const x of[-.18,.18])for(const z of[-.18,.18])b.box(.047,z<0?.94:.44,.047,oak,x,z<0?.47:.22,z);for(const y of[.19,.78,.92])b.box(.39,.055,.045,aged,0,y,-.18);for(const x of[-.09,0,.09])b.box(.025,.33,.025,oak,x,.73,-.18);break;
   case 'rug':b.box(2.2,.016,1.5,red,0,.012,0,null,.003);for(const z of[-.58,.58])b.box(2.08,.003,.08,cloth,0,.022,z);for(const x of[-1.0,1.0])b.box(.07,.003,1.15,cloth,x,.022,0);for(let i=0;i<45;i++)for(const x of[-1,1])b.beam([x*1.07,.021,-.70+i*.032],[x*1.17,.018,-.70+i*.032+.015],.006,.006,cloth);break;
   case 'shelf':for(const x of[-.57,.57])b.box(.055,1.82,.35,aged,x,.91,0);b.box(1.2,1.8,.035,oak,0,.9,-.16);for(const y of[.075,.48,.91,1.34,1.81])b.box(1.2,.055,.38,oak,0,y,0);for(let row=0;row<3;row++)for(let i=0;i<7;i++){const h=.24+.08*Math.sin(i*2+row)**2,x=-.46+i*.143,y=.51+row*.43+h/2;b.box(.09,h,.23,[red,cloth,blue,leather][(i+row)%4],x,y,0,[0,0,i===6?-.13:0],.003);b.box(.084,h-.024,.005,cloth,x,y,.117);}break;
   case 'lamp':b.lathe([[0,0],[.20,0],[.21,.035],[.11,.085],[.04,.15],[.026,1.13]],brass);lamp(b,0,1.13,0,1.1);break;
   case 'wardrobe':b.box(1.23,2,.62,aged,0,1,0);for(const x of[-.3,.3]){boards(b,.57,1.77,.04,oak,x,1,.33,true);for(const y of[.25,1.77])b.box(.59,.07,.045,aged,x,y,.357);b.torus(.032,.007,brass,x*.27,1.03,.388);}b.box(1.34,.09,.71,oak,0,2.04,0);b.box(1.28,.11,.66,oak,0,.055,0);break;
   case 'fireplace':b.box(1.75,.09,.78,stone,0,.025,.10);for(let row=0;row<6;row++)for(const x of[-.63,.63])b.box(.33,.21,.57,stone,x,.19+row*.215,0,null,.018);b.box(.94,.04,.04,iron,0,1.20,.27);b.box(1.65,.2,.61,stone,0,1.35,0);b.box(1.82,.11,.75,oak,0,1.51,0);b.box(1,.97,.07,iron,0,.58,-.23);for(const x of[-.24,0,.24]){b.cylinder(.07,.06,.59,aged,x,.20,.06,[Math.PI/2,0,.2]);b.sphere(.05,.14,.032,glow,x,.30,.1);}break;
   case 'snowman':b.sphere(.54,.48,.5,snow,0,.46,0);b.sphere(.40,.39,.39,snow,0,1.15,0);b.sphere(.28,.29,.27,snow,0,1.77,0);b.cylinder(.30,.30,.04,iron,0,2.04,0);b.cylinder(.19,.20,.25,iron,0,2.18,0);for(const x of[-.09,.09])b.sphere(.024,.024,.018,iron,x,1.83,.25);for(const y of[.98,1.14,1.3])b.sphere(.022,.023,.02,iron,0,y,.39);b.cylinder(0,.037,.20,yellow,0,1.75,.32,[Math.PI/2,0,0]);for(const s of[-1,1])b.tube([[s*.28,1.25,0],[s*.60,1.4,0],[s*.85,1.53,.03]],.017,aged);b.torus(.31,.043,red,0,1.5,0,[Math.PI/2,0,0]);fabric(b,.14,.43,.17,1.30,.33);break;
   case 'ice_lantern':b.box(.48,.65,.48,glass,0,.32,0,null,.07);b.cylinder(.085,.095,.24,cloth,0,.13,0);b.sphere(.018,.065,.018,glow,0,.32,0);break;
   case 'sled':for(const z of[-.29,.29])b.tube([[-.75,.08,z],[.55,.08,z],[.77,.14,z],[.80,.3,z]],.019,iron);boards(b,1.27,.05,.7,oak,0,.3,0);for(const x of[-.46,.46])for(const z of[-.25,.25])b.beam([x,.08,z],[x,.28,z],.027,.03,iron);b.tube([[.7,.27,-.2],[.95,.4,0],[.7,.27,.2]],.012,cloth);break;
   case 'frost_tree':tree(b,true);break;
   case 'pumpkin_pile':[[0,.25,0,.31],[.4,.20,.20,.25],[-.40,.19,.23,.23],[.02,.61,.02,.21]].forEach(p=>pumpkin(b,...p));break;
   case 'scarecrow':b.box(.075,2.22,.075,aged,0,1.05,0);b.box(1.36,.065,.07,aged,0,1.69,0);b.box(.47,.65,.25,blue,0,1.44,0,null,.055);for(const s of[-1,1])b.box(.44,.18,.20,blue,s*.44,1.67,0,[0,0,s*.1],.07);b.sphere(.2,.23,.19,cloth,0,2.0,0);b.cylinder(.36,.37,.035,straw,0,2.19,0);b.cylinder(.16,.19,.2,straw,0,2.30,0);for(const x of[-.066,.066])b.sphere(.012,.015,.008,iron,x,2.03,.18);for(const y of[1.30,1.48,1.62])b.bolt(0,y,.14);break;
   case 'corn_stook':for(let i=0;i<26;i++){const a=i*2.4,r=.12+Math.sqrt(i/26)*.32;b.tube([[Math.sin(a)*r,.02,Math.cos(a)*r],[Math.sin(a)*r*.38,1.15,Math.cos(a)*r*.38],[Math.sin(a)*r*.8,1.80+(i%4)*.045,Math.cos(a)*r*.8]],.009,straw);for(let j=0;j<2;j++)b.sphere(.014,.15,.02,straw,Math.sin(a)*r*.7,1.43+j*.16,Math.cos(a)*r*.7,[0,a,.25]);}b.torus(.21,.019,aged,0,1.10,0,[Math.PI/2,0,0]);break;
   case 'sun_umbrella':b.cylinder(.035,.04,2.5,oak,0,1.2,0);b.cylinder(.26,.3,.07,stone,0,.02,0);{
    const geo=new T.ConeGeometry(1.3,.46,48,5,true),p=geo.attributes.position;for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i)),a=Math.atan2(p.getZ(i),p.getX(i));p.setY(i,p.getY(i)-.065*Math.sin(a*6)**2*r/1.3);}geo.computeVertexNormals();const m=cloth.clone();m.side=T.DoubleSide;b.mesh(geo,m,0,2.35,0);for(let i=0;i<12;i++){const a=i*Math.PI/6;b.beam([0,2.55,0],[Math.sin(a)*1.28,2.115,Math.cos(a)*1.28],.012,.012,iron);}
   }break;
   case 'picnic_table':if(!scan(b,'wooden_picnic_table',{height:.77})){boards(b,1.9,.065,.8,oak,0,.77,0);for(const z of[-.63,.63])boards(b,1.9,.055,.28,oak,0,.43,z);for(const x of[-.63,.63]){b.beam([x,.04,-.68],[x,.71,.27],.07,.09,aged);b.beam([x,.04,.68],[x,.71,-.27],.07,.09,aged);b.box(.08,.075,1.55,aged,x,.38,0);}}break;
   case 'paddling_pool':for(const y of[.055,.15,.25])b.torus(1.29,.055,blue,0,y,0,[Math.PI/2,0,0]);b.cylinder(1.26,1.26,.025,blue,0,.025,0);b.cylinder(1.24,1.24,.008,water,0,.23,0);break;
   case 'lemonade_stand':boards(b,1.6,.82,.08,paint,0,.45,.3,true);for(const x of[-.76,.76])b.box(.075,2.3,.075,aged,x,1.12,-.27);boards(b,1.73,.075,.78,oak,0,.92,0);fabric(b,1.67,.36,0,2.10,-.27,red);for(const x of[-.36,.20]){b.cylinder(.061,.055,.17,glass,x,1.04,.04);b.cylinder(.054,.054,.11,yellow,x,1.01,.04);}break;
   case 'dragon_statue':{
    b.box(1.23,.19,1.2,stone,0,.08,0);b.box(1.08,.14,1.04,stone,0,.245,0);b.sphere(.31,.40,.48,bronze,0,.65,-.08);b.tube([[0,.7,.2],[0,1.1,.25],[0,1.32,.5]],.13,bronze);b.sphere(.15,.14,.26,bronze,0,1.35,.54);for(const s of[-1,1]){b.sphere(.1,.20,.23,bronze,s*.26,.46,.15);b.sphere(.1,.055,.19,bronze,s*.25,.34,.31);b.tube([[s*.1,1.45,.43],[s*.15,1.63,.34],[s*.17,1.7,.28]],.025,bronze);b.sphere(.025,.025,.015,brass,s*.137,1.40,.66);const shape=new T.Shape();shape.moveTo(.18,.7);shape.bezierCurveTo(.4,1.2,.75,1.5,1.07,1.45);shape.lineTo(.88,.95);shape.quadraticCurveTo(.52,1.04,.5,.63);shape.quadraticCurveTo(.32,.83,.18,.7);const wing=new T.ShapeGeometry(shape,12);b.mesh(wing,bronze,0,0,-.15,[0,s<0?Math.PI:0,s*.08]);for(const end of[[s*1.03,1.44,-.15],[s*.88,.95,-.15],[s*.5,.65,-.15]])b.beam([s*.19,.78,-.15],end,.025,.025,bronze);}
    b.tube([[0,.49,-.41],[.36,.35,-.77],[.54,.38,-.90],[.63,.54,-.94]],.075,bronze);for(let i=0;i<7;i++)b.cylinder(0,.045,.09,bronze,0,.91+i*.067,-.30+i*.10,null,8);
   }break;
   case 'dragon_banner':b.cylinder(.04,.055,3.2,iron,0,1.58,0);b.box(1.19,.036,.045,brass,.51,3.04,0);fabric(b,1.07,1.42,.56,2.3,0);b.torus(.22,.021,brass,.56,2.43,.055);b.sphere(.055,.1,.015,brass,.56,2.38,.061);break;
   case 'ember_brazier':for(let i=0;i<3;i++){const a=i*Math.PI*2/3;b.beam([Math.sin(a)*.3,0,Math.cos(a)*.3],[Math.sin(a)*.2,.86,Math.cos(a)*.2],.04,.04,iron);}basin(b,.4,.24,0,.82,0,iron);for(const x of[-.16,0,.16]){b.cylinder(.055,.055,.48,aged,x,1.04,0,[Math.PI/2,0,.3]);b.sphere(.028,.13,.028,glow,x,1.17,0);}break;
   case 'scale_arch':for(const x of[-1.17,1.17]){b.box(.5,.15,.6,stone,x,.06,0);for(let row=0;row<10;row++)b.box(.32,.25,.36,stone,x,.3+row*.25,0,null,.02);b.box(.48,.16,.49,stone,x,2.72,0);}for(let i=0;i<13;i++){const a=i/13*Math.PI+.008,c=(i+1)/13*Math.PI-.008,shape=new T.Shape();shape.absarc(0,0,1.37,a,c,false);shape.absarc(0,0,1.02,c,a,true);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1,curveSegments:3});b.mesh(geo,stone,0,2.72,-.2,null,[1,.52,1]);}break;
   case 'paddock':for(const z of[-5,5])for(const x of[-3.75,-1.25,1.25,3.75])fence(b,2.5,x,z);for(const x of[-5,5])for(const z of[-3.75,-1.25,1.25,3.75])fence(b,2.5,x,z,Math.PI/2);hay(b,2,0,2);break;
   case 'ring':{
    const n=16,r=5;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,c=(i+1)/n*Math.PI*2,x=(Math.sin(a)+Math.sin(c))*r/2,z=(Math.cos(a)+Math.cos(c))*r/2;fence(b,2*r*Math.sin(Math.PI/n),x,z,(a+c)/2);}
    const sand=material('riding sand','#b1a187',.97);sand.map=tex('assets/textures/pastoral/arena_albedo.jpg',true);sand.normalMap=tex('assets/textures/pastoral/arena_normal.jpg');sand.normalScale=new T.Vector2(.22,.22);sand.userData.metres=4;b.cylinder(4.83,4.83,.06,sand,0,.012,0,null,64);for(const x of[-2,2]){b.cylinder(.025,.20,.52,yellow,x,.28,0);b.box(.48,.035,.48,rubber,x,.025,0);}
   }break;
   case 'well':stoneCourses(b,.72,.86);b.torus(.72,.095,stone,0,.88,0,[Math.PI/2,0,0]);b.cylinder(.57,.57,.02,water,0,.28,0);for(const x of[-.91,.91])b.box(.15,2.22,.15,aged,x,1.07,0);for(const s of[-1,1])b.box(2.2,.10,.86,roof,0,2.21,s*.35,[s*-.38,0,0]);b.cylinder(.065,.065,1.92,oak,0,1.65,0,[0,0,Math.PI/2]);b.tube([[0,1.67,0],[0,1.15,0],[0,.58,0]],.012,cloth);b.cylinder(.17,.13,.24,steel,.34,1.52,0);b.torus(.14,.012,iron,.34,1.70,0);break;
   default:return null;
  }
  return b.finish();
 }
 function key(type){return type==='sign'?type+':'+getRanchName():type;}
 function copy(type,ghost){const k=key(type);let src=templates.get(k);if(!src){src=createTemplate(type);if(!src)return null;templates.set(k,src);}const out=src.clone(true);out.traverse(o=>{if(!o.isMesh)return;if(o.userData.builderBillboard)o.onBeforeRender=function(renderer,scene,camera){const here=this.getWorldPosition(new T.Vector3()),cam=camera.getWorldPosition(new T.Vector3());this.lookAt(cam.x,here.y,cam.z);this.updateWorldMatrix(false,false);};o.castShadow=!ghost&&!o.material.transparent&&!o.userData.builderBillboard;o.receiveShadow=true;if(ghost){const convert=m=>{if(!ghosts.has(m)){const c=m.clone();c.transparent=true;c.opacity=Math.min(m.opacity,.48);c.depthWrite=false;c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;ghosts.set(m,c);}return ghosts.get(m);};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);}});return out;}
 function create(type,ghost=false){const out=copy(type,ghost);if(!out)return null;if(!state.loaded)state.ready.then(()=>{const replacement=copy(type,ghost);out.clear();for(const child of [...replacement.children])out.add(child);out.userData={...replacement.userData};});return out;}
 const sources={
  wine_barrel_01:'builder/wine_barrel_01',wooden_picnic_table:'builder/wooden_picnic_table',planter_box_01:'builder/planter_box_01',wooden_lantern_01:'builder/wooden_lantern_01',tree_stump_01:'builder/tree_stump_01',flower_gazania:'builder/flower_gazania',wild_rooibos_bush:'builder/wild_rooibos_bush',
  tree_small_02:'realism/tree_small_02',pine_sapling_small:'realism/pine_sapling_small',rock_moss_set_01:'realism/rock_moss_set_01',
 };
 const gltf=new GLTFLoader();
 // The game starts this batch after the mounted horse is ready (with a bounded
 // fallback). Existing procedural props stay visible until the same scans arrive.
 // Art tools retain eager loading unless they explicitly opt into the gate.
 const modelLoad=createDeferredLoad(()=>Promise.all(Object.entries(sources).map(async([id,path])=>{
  try{const data=await gltf.loadAsync('assets/models/world/'+path+'.glb');let root=data.scene;
   if(['pine_sapling_small','rock_moss_set_01','flower_gazania','wild_rooibos_bush'].includes(id)){
    // A glTF node can contain several primitives (pine bark + needles). Keep
    // the whole first authored plant/rock, not just its first material mesh.
    const first=id==='flower_gazania'?(root.children.find(o=>/_e_LOD0$/.test(o.name))||root.children[0]):root.children[0];if(first){root.updateMatrixWorld(true);const one=new T.Group(),clone=first.clone(true);clone.applyMatrix4(first.parent.matrixWorld);one.add(clone);root=one;}
   }
   root.traverse(o=>{if(o.isMesh){o.geometry.userData.builderScan=true;o.castShadow=true;o.receiveShadow=true;for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.envMapIntensity=.65;for(const map of[m.map,m.normalMap,m.roughnessMap,m.metalnessMap,m.aoMap])if(map)map.anisotropy=Math.min(8,anisotropy);}}});scans.set(id,root);state.models.push(id);
  }catch(e){state.errors.push(id+': '+e.message);}
 })).then(()=>{state.loaded=true;const old=[...templates.values()];templates.clear();
  // The existing instances swap children in the following promise callbacks.
  // Retire only procedural fallback geometry, never shared scan resources.
  setTimeout(()=>{for(const root of old)root.traverse(o=>{if(o.isMesh&&!o.geometry.userData.builderScan)o.geometry.dispose();});},0);
  return state;}));
 state.ready=modelLoad.ready;
 state.startLoading=()=>modelLoad.start();
 if(!deferModels)state.startLoading();
 return Object.assign(state,{create,materials:{oak,aged,iron,steel,stone,cloth,leather,water},templates});
}
