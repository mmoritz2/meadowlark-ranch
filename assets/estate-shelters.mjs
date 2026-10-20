import {setTimberBoxUV,applyTimberGrain} from './timber-cladding.mjs?v=timber-cladding-1';
import {dressTimberBox} from './ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {dressRoofCoverBox} from './ranch-roof-courses.mjs?v=ranch-roof-courses-3';

// Original estate run-in and single stall. The builder's original hierarchy,
// solidParts, entrance, side bars and mono-pitch cover remain the authority.
// The two resident presentations borrow all photographed channels from the
// architecture library and are shared across placements, ghosts and reloads.
let presentationSeed=0x45535453;
function isolated(fn){
  const random=Math.random;
  Math.random=()=>{presentationSeed=(Math.imul(presentationSeed,1664525)+1013904223)>>>0;return presentationSeed/4294967296;};
  try{return fn();}finally{Math.random=random;}
}

export function createEstateShelterDresser({THREE:T,architecture,strawMaterial=null}={}){
  if(!T||!architecture?.materials)throw new TypeError('Estate shelter requires THREE and resident architecture');
  const models=new Map();let disposed=false;
  function decorate(root,type='shelter'){
    if(disposed)throw Error('Estate shelter dresser is disposed');
    if(!root?.isObject3D||!['shelter','stall'].includes(type))throw new TypeError('An existing shelter or stall root is required');
    if(root.userData.estateShelter)return root;
    return isolated(()=>{
      let model=models.get(type);if(!model){model=build(T,architecture,type,strawMaterial);models.set(type,model);}
      // The fallback contains nested divider groups. Keep those groups and
      // their UUID draws; hide every old mesh rather than only direct batches.
      root.traverse(o=>{if(o.isMesh)o.visible=false;});
      for(const original of model.children){const mesh=original.clone(false);mesh.visible=true;root.add(mesh);}
      root.userData.estateShelter={...model.userData.estateShelter};
      return root;
    });
  }
  decorate.clone=root=>{
    if(disposed)throw Error('Estate shelter dresser is disposed');
    const out=root.clone(false);
    for(const child of root.children)out.add(child.geometry?.userData.estateShelterResident?
      isolated(()=>child.clone(true)):child.clone(true));
    return out;
  };
  decorate.isolated=isolated;
  decorate.dispose=()=>{if(disposed)return;disposed=true;for(const model of models.values())model.userData.dispose();models.clear();};
  return decorate;
}

export function buildEstateShelter({THREE:T,architecture,type='shelter',strawMaterial=null}={}){
  if(!T||!architecture?.materials||!['shelter','stall'].includes(type))throw new TypeError('A shelter or stall and resident architecture are required');
  return isolated(()=>build(T,architecture,type,strawMaterial));
}

function build(T,architecture,type,strawMaterial){
  const owned=new Set(),batches=new Map(),source=n=>architecture.materials.get(n),group=new T.Group();
  group.name='Meadowlark estate '+type;let parts=0,roofReceipt;
  const make=(name,base,options={})=>{
    const m=new T.MeshStandardMaterial({roughness:.94,envMapIntensity:.58,...options});
    m.name='Estate shelter | '+name;
    for(const slot of['map','normalMap','roughnessMap','aoMap'])if(base?.[slot])m[slot]=base[slot];
    m.userData.patchMetres=base?.userData?.patchMetres||base?.userData?.metres||1.6;owned.add(m);return m;
  };
  const oak=make('smoked oak mortised framing',source('Ranch | oiled oak doors'),{color:'#a78e6e',roughness:.87});
  oak.userData.timber=true;applyTimberGrain(oak,T);
  const sage=make('sage vertical stable boards',source('Ranch | weathered timber siding'),{color:'#d4d1be',normalScale:new T.Vector2(.24,.24)});
  sage.userData.timber=true;sage.userData.siding=true;applyTimberGrain(sage,T);
  const prior=sage.onBeforeCompile,pigment=new T.Color('#5b7060').toArray().map(v=>v.toFixed(8)).join(',');
  sage.onBeforeCompile=function(shader,renderer){
    prior.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\nfloat estateShelterGrain=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.0,0.0,1.0);\n'+
      'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+pigment+')*(.82+.18*estateShelterGrain),.94);');
  };
  sage.customProgramCacheKey=()=> 'estate-shelter-sage-v1';
  const stone=make('warm fitted limestone',source('Ranch | dressed limestone'),{color:'#c3baa2',normalScale:new T.Vector2(.28,.28)});
  const slate=make('blue grey coursed slate',source('Village | blue grey slate'),{color:'#9da7aa',normalScale:new T.Vector2(.46,.46)});
  const iron=make('forged dark iron',null,{color:'#333d37',metalness:.64,roughness:.63});
  const shadow=make('recessed joints',null,{color:'#3f4438',roughness:1});
  const straw=make('dry oat fibres',strawMaterial,{color:strawMaterial?.color?.clone()||'#c4ae73',roughness:1,normalScale:new T.Vector2(.22,.22)});
  const lamp=make('solid warm lantern panes',null,{color:'#d5c08e',roughness:.44,emissive:'#cc9f51',emissiveIntensity:.24});
  const Y=new T.Vector3(0,1,0);
  function add(g,m,matrix=new T.Matrix4()){
    g.applyMatrix4(matrix);let b=batches.get(m);if(!b){b={p:[],n:[],u:[],i:[]};batches.set(m,b);}
    const off=b.p.length/3;b.p.push(...g.attributes.position.array);b.n.push(...g.attributes.normal.array);b.u.push(...g.attributes.uv.array);
    if(g.index)for(const i of g.index.array)b.i.push(i+off);else for(let i=0;i<g.attributes.position.count;i++)b.i.push(i+off);
    parts++;g.dispose();
  }
  function box(w,h,d,m,x=0,y=0,z=0,rotation=null,bevel=false,roof=false){
    if(![w,h,d,x,y,z].every(Number.isFinite)||Math.min(w,h,d)<=0)throw Error('A finite positive shelter part is required');
    const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,k=m.userData.patchMetres;
    if(m.userData.timber){
      setTimberBoxUV(g,{width:w,height:h,depth:d,x,y,z,siding:!!m.userData.siding,lengthMetres:2.4});
      if(bevel)dressTimberBox(T,g,{width:w,height:h,depth:d,x,y,z,radius:.0025,siding:!!m.userData.siding,lengthMetres:2.4});
    }else for(let i=0;i<p.count;i++)u.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i)+z:p.getX(i)+x)/k,(Math.abs(n.getY(i))>.5?p.getZ(i)+z:p.getY(i)+y)/k);
    if(roof)roofReceipt=dressRoofCoverBox(T,g,{width:w,height:h,depth:d,axis:'z',downSlope:-1,style:'slate',relief:.011});
    const q=rotation instanceof T.Quaternion?rotation:new T.Quaternion().setFromEuler(rotation||new T.Euler());
    add(g,m,new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1)));
  }
  function beam(a,b,w,d,m=oak){const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p),mid=p.clone().add(q).multiplyScalar(.5);box(w,v.length(),d,m,mid.x,mid.y,mid.z,new T.Quaternion().setFromUnitVectors(Y,v.normalize()),true);}
  function pipe(a,b,r=.012,m=iron,sides=10){const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);add(new T.CylinderGeometry(r,r,v.length(),sides),m,new T.Matrix4().compose(p.add(q).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(Y,v.normalize()),new T.Vector3(1,1,1)));}
  const w=4,d=3.25,h=3.25,front=d/2,rear=-d/2;
  // The 100 mm slab and its inset joints retain the old -.035/.065 level.
  box(w,.10,d,stone,0,.015,0);
  for(let i=1;i<6;i++)box(.006,.001,d-.10,shadow,-w/2+i*w/6,.0645,0);
  for(const z of[-.54,.54])box(w-.10,.001,.006,shadow,0,.0645,z);
  // Rear wall and lower dividers stay inside the original 85 mm envelopes.
  box(w,2.8,.025,shadow,0,1.505,rear);
  for(let i=0;i<25;i++)box(w/25-.005,2.8,.080,sage,-w/2+(i+.5)*w/25,1.505,rear,null,true);
  for(const x of[-1,0,1])box(.055,2.8,.085,oak,x,1.505,rear,null,true);
  for(const y of[.22,2.855])box(w,.075,.085,oak,0,y,rear,null,true);
  for(const side of[-1,1]){
    const x=side*w/2;
    box(.025,1.5,d,shadow,x,.82,0);
    for(let i=0;i<21;i++)box(.080,1.5,d/21-.005,sage,x,.82,-d/2+(i+.5)*d/21,null,true);
    // Low limestone kick-course remains flush with the original side boards.
    box(.085,.17,d,stone,x,.155,0);
    for(const z of[-1.05,0,1.05])box(.085,1.45,.045,oak,x,.845,z,null,true);
    for(const y of[.27,1.525])box(.085,.075,d,oak,x,y,0,null,true);
    for(let i=0;i<13;i++)pipe([x,1.58,-d/2+.13+i*.25],[x,2.20,-d/2+.13+i*.25],.012);
    for(const z of[rear,front]){
      box(.17,h,.17,oak,x,h/2,z,null,true);
      box(.22,.18,.22,stone,x,.045,z);
      box(.17,.065,.17,iron,x,.175,z);
      beam([x,h-.55,z],[x-side*.43,h-.13,z],.09,.1);
      for(const yy of[.33,2.78,3.10])pipe([x-.025,yy,z+.08],[x-.025,yy,z+.084],.010,iron,8);
    }
  }
  box(w+.18,.19,.16,oak,0,h-.1,front,null,true);
  // The roof is the EXACT former 4.5 x .12 x 3.75 cover, centre and -.07
  // rotation. Slate relief cuts down from its old plane, never above it.
  box(w+.5,.12,d+.5,slate,0,h+.06,0,new T.Euler(-.07,0,0),false,true);
  for(const z of[rear-.24,front+.24])box(w+.55,.16,.09,oak,0,h+.035+z*.07,z,null,true);
  for(const x of[-1.2,0,1.2])box(.10,.16,d+.2,oak,x,h-.12,0,new T.Euler(-.07,0,0),true);
  // Open U-shaped rear gutter retains the former iron bar's whole envelope.
  box(w+.55,.014,.12,iron,0,h-.073,rear-.26);
  for(const dz of[-.053,.053])box(w+.55,.08,.014,iron,0,h-.04,rear-.26+dz);
  for(const x of[-2.02,2.02])pipe([x,.22,rear-.065],[x,3.14,rear-.065],.017);
  if(type==='stall'){
    const doorX=-1,doorW=1.8;
    box(doorW,1.15,.018,shadow,doorX,.64,front);
    for(let i=0;i<12;i++)box(doorW/12-.005,1.15,.07,sage,doorX-doorW/2+(i+.5)*doorW/12,.64,front,null,true);
    for(const y of[.25,1.05])box(1.87,.09,.1,oak,-1,y,front+.02,null,true);
    beam([-1.85,.28,front+.08],[-.14,1.02,front+.08],.075,.075);
    for(const y of[.30,1]){
      box(.32,.055,.03,iron,-1.76,y,front+.075);
      for(const dx of[-.10,.10])pipe([-1.76+dx,y,front+.088],[-1.76+dx,y,front+.09],.010,iron,8);
    }
  }
  // Hay stays in the former rear-right bale volume; individual fine ridges
  // and two woven bindings supply readable scale without a new texture load.
  box(.99,.495,.576,straw,1,.3275,-.9,null,true);
  for(const x of[.73,1.27])box(.012,.499,.583,oak,x,.3275,-.9);
  for(let i=0;i<46;i++){
    const z=-1.166+(i%23)*.024,x=.55+Math.floor(i/23)*.44;
    beam([x,.576,z],[x+.35,.578,z+.007],.004,.004,straw);
  }
  // Opaque panes avoid the transparent black-card artefacts at low settings.
  const lx=-1.78,ly=1.7,lz=front+.08;
  box(.162,.224,.162,lamp,lx,ly+.144,lz);
  for(const y of[ly+.016,ly+.272])box(.184,.028,.184,iron,lx,y,lz);
  for(const dx of[-.080,.080])for(const dz of[-.080,.080])box(.014,.25,.014,iron,lx+dx,ly+.144,lz+dz);
  box(.20,.045,.20,iron,lx,ly+.308,lz);
  box(.035,.07,.035,iron,lx,ly+.34,lz);
  let triangles=0,geometryBytes=0;
  for(const[m,b]of batches){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setIndex(b.i);g.computeBoundingBox();g.computeBoundingSphere();g.userData.estateShelterResident=true;
    triangles+=g.index.count/3;geometryBytes+=g.index.array.byteLength+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0);
    const mesh=new T.Mesh(g,m);mesh.name=m.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.estateShelter={version:'estate-shelters-1',kind:type,originalDesign:true,drawCalls:batches.size,triangles,geometryBytes,parts,
    roof:{width:4.5,height:.12,depth:3.75,centre:[0,3.31,0],rotationX:-.07,courses:roofReceipt},
    apertures:{frontPostInnerX:[-1.915,1.915],frontBeamMinY:3.055,sideBars:[1.58,2.20],stallDoor:type==='stall'?{minX:-1.935,maxX:-.065,top:1.215}:null},
    inheritedCollisionAuthority:true,borrowedTextures:true,isolatedConstructionRandom:true};
  const meshes=group.children.slice();let disposed=false;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;for(const mesh of meshes)mesh.geometry.dispose();for(const m of owned)m.dispose();};
  return group;
}
