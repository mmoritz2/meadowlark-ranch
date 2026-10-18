import {setTimberBoxUV,applyTimberGrain} from './timber-cladding.mjs?v=timber-cladding-1';
import {dressTimberBox} from './ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {RANCH_ROOF_PHOTO_PROFILES} from './ranch-roof-courses.mjs?v=ranch-roof-courses-3';

// Original Meadowlark estate pavilion. Presentation only: the builder root,
// its authored solidParts, its pose, and all terrain/body authority stay intact.
// One resident model is shared by normal, town, placed and ghost instances.
export function createEstateGrandstandDresser({THREE:T,architecture}={}){
  if(!T||!architecture?.materials)throw new TypeError('Estate grandstand requires THREE and resident architecture');
  let model,disposed=false;
  function decorate(root){
    if(disposed)throw Error('Estate grandstand dresser is disposed');
    if(!root?.isObject3D)throw new TypeError('An existing grandstand root is required');
    if(root.userData.estateGrandstand)return root;
    return isolated(()=>{
      model??=build(T,architecture);
      for(const child of root.children)if(child.isMesh)child.visible=false;
      for(const original of model.children){const mesh=original.clone(false);mesh.visible=true;root.add(mesh);}
      root.userData.estateGrandstand={...model.userData.estateGrandstand};
      return root;
    });
  }
  // The root and the legacy hierarchy retain precisely their former UUID
  // draws. Only the extra presentation batches use the independent stream.
  // This is the factory's src.clone(true) replacement for this one type.
  decorate.clone=root=>{
    if(disposed)throw Error('Estate grandstand dresser is disposed');
    const out=root.clone(false);
    for(const child of root.children){
      const copy=child.geometry?.userData.estateGrandstandResident?
        isolated(()=>child.clone(true)):child.clone(true);
      out.add(copy);
    }
    return out;
  };
  // Used only for the additional resident ghost material clones. Legacy
  // preview material clones must keep consuming their old world UUID draws.
  decorate.isolated=isolated;
  decorate.dispose=()=>{if(disposed)return;disposed=true;model?.userData.dispose();};
  return decorate;
}

export function buildEstateGrandstand({THREE:T,architecture}={}){
  if(!T||!architecture?.materials)throw new TypeError('Estate grandstand requires THREE and resident architecture');
  return isolated(()=>build(T,architecture));
}

let presentationSeed=0x45535447;
function isolated(fn){
  const random=Math.random;
  Math.random=()=>{presentationSeed=(Math.imul(presentationSeed,1664525)+1013904223)>>>0;return presentationSeed/4294967296;};
  try{return fn();}finally{Math.random=random;}
}

function build(T,architecture){
  const owned=new Set(),batches=new Map(),source=name=>architecture.materials.get(name);
  const make=(name,base,options={})=>{
    const material=new T.MeshStandardMaterial({roughness:.93,envMapIntensity:.62,...options});
    material.name='Estate grandstand | '+name;
    for(const slot of['map','normalMap','roughnessMap','aoMap'])if(base?.[slot])material[slot]=base[slot];
    material.userData.patchMetres=base?.userData?.patchMetres||1.6;
    owned.add(material);return material;
  };
  const oak=make('weathered oak joinery',source('Ranch | oiled oak doors'),{color:'#a88d6d',roughness:.88});
  oak.userData.timber=true;applyTimberGrain(oak,T);
  const sage=make('sage boarded aprons',source('Ranch | weathered timber siding'),{color:'#d4d1be',normalScale:new T.Vector2(.24,.24)});
  sage.userData.timber=true;applyTimberGrain(sage,T);
  const prior=sage.onBeforeCompile,pigment=new T.Color('#536d60').toArray().map(v=>v.toFixed(8)).join(',');
  sage.onBeforeCompile=function(shader,renderer){
    prior.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\nfloat estateGrain=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.0,0.0,1.0);\n'+
      'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+pigment+')*(.83+.17*estateGrain),.94);');
  };
  sage.customProgramCacheKey=()=> 'estate-grandstand-sage-v1';
  const stone=make('warm limestone piers',source('Ranch | foundation stone'),{color:'#c7bea6',normalScale:new T.Vector2(.34,.34)});
  const cream=make('cream cornice',source('Village | limewashed plaster 0'),{color:'#e9e0c9',normalScale:new T.Vector2(.12,.12)});
  const slate=make('blue grey coursed slate',source('Village | blue grey slate'),{color:'#929da2',normalScale:new T.Vector2(.50,.50)});
  const iron=make('forged iron',null,{color:'#303a35',roughness:.65,metalness:.7});
  const shadow=make('open joint shadows',null,{color:'#41473c',roughness:1});
  const lamp=make('warm lantern panes',null,{color:'#dcc795',roughness:.5,emissive:'#d5aa62',emissiveIntensity:.27});
  const group=new T.Group();group.name='Meadowlark estate grandstand';
  let parts=0,courses=0;const Y=new T.Vector3(0,1,0),identity=new T.Matrix4();
  function add(g,m,matrix=identity){
    g.applyMatrix4(matrix);let b=batches.get(m);if(!b){b={p:[],n:[],u:[],i:[]};batches.set(m,b);}
    const offset=b.p.length/3;
    b.p.push(...g.attributes.position.array);b.n.push(...g.attributes.normal.array);b.u.push(...g.attributes.uv.array);
    if(g.index)for(const i of g.index.array)b.i.push(i+offset);else for(let i=0;i<g.attributes.position.count;i++)b.i.push(i+offset);
    parts++;g.dispose();
  }
  function box(w,h,d,m,x=0,y=0,z=0,rotation=null,bevel=false){
    if(![w,h,d,x,y,z].every(Number.isFinite)||Math.min(w,h,d)<=0)throw Error('Finite positive pavilion part required');
    const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,patch=m.userData.patchMetres;
    if(m.userData.timber){
      setTimberBoxUV(g,{width:w,height:h,depth:d,x,y,z,siding:m===sage,lengthMetres:2.4});
      if(bevel)dressTimberBox(T,g,{width:w,height:h,depth:d,x,y,z,radius:.003,siding:m===sage,lengthMetres:2.4});
    }else for(let i=0;i<p.count;i++)u.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i)+z:p.getX(i)+x)/patch,(Math.abs(n.getY(i))>.5?p.getZ(i)+z:p.getY(i)+y)/patch);
    const q=rotation instanceof T.Quaternion?rotation:new T.Quaternion().setFromEuler(rotation||new T.Euler());
    add(g,m,new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1)));
  }
  function beam(a,b,w,d,m=oak){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p),mid=p.clone().add(q).multiplyScalar(.5);
    box(w,v.length(),d,m,mid.x,mid.y,mid.z,new T.Quaternion().setFromUnitVectors(Y,v.normalize()));
  }
  function pipe(a,b,r=.018,m=iron){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);
    add(new T.CylinderGeometry(r,r,v.length(),8),m,new T.Matrix4().compose(p.add(q).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(Y,v.normalize()),new T.Vector3(1,1,1)));
  }
  // Closed slabs built from real planes. Each course is a shallow watertight
  // volume; no alpha cards or normal-only seams make up the roof silhouette.
  function slab(points,thickness,m,uvAt=null){
    points=points.filter((p,i)=>!i||p.some((v,k)=>Math.abs(v-points[i-1][k])>1e-10));
    if(points.length>2&&points[0].every((v,k)=>Math.abs(v-points.at(-1)[k])<1e-10))points.pop();
    if(points.length<3)return;
    const P=[],N=[],U=[],I=[],bottom=points.map(p=>[p[0],p[1]-thickness,p[2]]),center=points.reduce((a,p)=>a.map((v,k)=>v+p[k]/points.length),[0,0,0]);
    function face(poly,hint){
      poly=poly.filter((p,i)=>!i||p.some((v,k)=>Math.abs(v-poly[i-1][k])>1e-10));
      if(poly.length<3)return;
      const a=new T.Vector3(...poly[0]);let normal;
      for(let k=1;k<poly.length-1;k++){
        const n=new T.Vector3(...poly[k]).sub(a).cross(new T.Vector3(...poly[k+1]).sub(a));
        if(n.lengthSq()>1e-20){normal=n;break;}
      }
      if(!normal)return;
      if(normal.dot(new T.Vector3(...hint))<0){poly=poly.slice().reverse();normal.negate();}
      normal.normalize();const offset=P.length/3;
      for(const p of poly){
        P.push(...p);N.push(...normal.toArray());
        const uv=uvAt&&normal.y>.5?uvAt(p):Math.abs(normal.y)>.5?[p[0]/3,p[2]/3]:Math.abs(normal.x)>.5?[p[2]/3,p[1]/3]:[p[0]/3,p[1]/3];U.push(...uv);
      }
      for(let k=1;k<poly.length-1;k++){
        const a=new T.Vector3(...poly[k]).sub(new T.Vector3(...poly[0])),b=new T.Vector3(...poly[k+1]).sub(new T.Vector3(...poly[0]));
        if(a.cross(b).lengthSq()>1e-20)I.push(offset,offset+k,offset+k+1);
      }
    }
    face(points,[0,1,0]);face(bottom,[0,-1,0]);
    for(let k=0;k<points.length;k++){
      const j=(k+1)%points.length,hint=[(points[k][0]+points[j][0])/2-center[0],0,(points[k][2]+points[j][2])/2-center[2]];
      face([points[k],bottom[k],bottom[j],points[j]],hint);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);add(g,m);
  }
  const front=.35,back=-3.15,supportX=[-5.85,-1.8,1.8,5.85];
  for(const x of supportX)for(const z of[front,back]){
    box(.42,.24,.42,stone,x,.06,z);
    for(let row=0;row<3;row++)box(.35,.175,.35,stone,x,.27+row*.18,z);
    box(.42,.075,.42,cream,x,.76,z);
    box(.21,3.07,.21,oak,x,2.33,z,null,true);
    box(.26,.085,.26,iron,x,.84,z);
    box(.27,.11,.27,cream,x,3.78,z);
    for(const s of[-1,1])if(Math.abs(x+s*.57)<6.15){
      // The carved knee is a solid concave bracket rather than a thin pole.
      const sh=new T.Shape();sh.moveTo(0,0);sh.lineTo(0,.57);sh.lineTo(s*.60,.57);sh.lineTo(s*.60,.44);sh.quadraticCurveTo(s*.15,.41,s*.13,0);sh.closePath();
      const g=new T.ExtrudeGeometry(sh,{depth:.12,bevelEnabled:false,curveSegments:10});
      add(g,oak,new T.Matrix4().makeTranslation(x,3.17,z-.06));
    }
    if(z===back)for(const zz of[-.12,.12])box(.035,.19,.024,iron,x,1.14,z+zz);
  }
  // More substantial entablature and a pale cornice anchor the entire roof.
  for(const z of[front,back]){
    box(12.17,.25,.23,oak,0,3.80,z,null,true);
    box(12.26,.075,.27,cream,0,3.955,z);
  }
  // Three real stepped seating decks, each split by the 1.12 m centre aisle.
  const levels=[.18,.62,1.06];
  for(let row=0;row<3;row++){
    const level=levels[row],z=-.10-row*1.1;
    for(const side of[-1,1]){
      const x=side*3.34;
      for(let k=0;k<7;k++)box(5.46,.065,1.09/7-.005,oak,x,level-.032,z-.545+(k+.5)*1.09/7,null,true);
      box(5.46,.14,.065,sage,x,level-.08,z+.53);
      box(5.46,Math.max(.08,level-.12),.075,shadow,x,Math.max(.08,level-.12)/2,z+.48);
      for(const lx of[side*.72,side*3.05,side*5.92]){
        box(.10,level,.10,oak,lx,level/2,z-.14);
        box(.075,.43,.075,iron,lx,level+.19,z-.19);
        box(.09,.07,.49,oak,lx,level+.41,z-.19,null,true);
        box(.055,.87,.055,iron,lx,level+.42,z-.42);
      }
      for(const dz of[-.055,-.20,-.345])box(5.36,.055,.135,oak,x,level+.46,z+dz,null,true);
      for(const dy of[.70,.85])box(5.36,.115,.055,oak,x,level+dy,z-.44,new T.Euler(.10,0,0),true);
      for(const lx of[side*.72,side*3.05,side*5.92])for(const yy of[.70,.85])pipe([lx,level+yy,z-.408],[lx,level+yy,z-.390],.011);
    }
  }
  for(let i=0;i<5;i++){
    const h=.18+i*.22,z=.45-i*.55;
    box(1.10,h,.55,stone,0,h/2,z);
    box(1.14,.055,.55,oak,0,h+.015,z,null,true);
    box(1.08,.012,.045,iron,0,h+.048,z+.22);
  }
  for(let i=0;i<8;i++)box(1.10,.065,.15-.005,oak,0,1.04,-3.08+(i+.5)*.15,null,true);
  // Rear apron and side panels enclose only under-deck service space. The
  // spectator eye line and all public seating remain completely open.
  for(let k=0;k<4;k++){
    const left=[-6.02,-1.70,.58,1.90][k],right=[-1.90,-.58,1.70,6.02][k];
    box(right-left,.78,.095,sage,(left+right)/2,.55,back-.015,null,true);
    box(right-left,.09,.14,oak,(left+right)/2,1.00,back-.015,null,true);
  }
  for(const x of[-6.04,6.04]){
    slab([[x-.04,.08,.35],[x+.04,.08,.35],[x+.04,1.02,-3.15],[x-.04,1.02,-3.15]],.065,sage);
    for(let i=0;i<4;i++){
      const z=.30-i*1.1,level=.20+i*.29;box(.085,1.00,.085,oak,x,level+.5,z,null,true);
    }
    for(const offset of[.60,1.06])beam([x,.18+offset,.35],[x,1.06+offset,-3.15],.065,.075,oak);
    for(let i=0;i<24;i++){
      const z=.29-i*3.38/23,t=(.35-z)/3.5,y=.18+.88*t;
      pipe([x,y+.15,z],[x,y+.98,z],.011);
    }
  }
  for(const x of[-5.9,-4,-2,0,2,4,5.9])box(.085,1.11,.085,oak,x,1.58,back,null,true);
  for(const y of[1.48,2.12])box(12.15,.065,.075,oak,0,y,back,null,true);
  for(let i=0;i<43;i++)pipe([-5.88+i*.28,1.51,back],[-5.88+i*.28,2.08,back],.011);
  // Low hipped slate roof: it leaves the arena front open, ends with real
  // triangular hips, and stays quieter than the stable's tall central gable.
  const cz=-1.4,half=2.35,roofX=6.50,ridgeX=4.15,eave=4.04,rise=.78,slope=Math.hypot(half,rise);
  const roofPoint=(side,t,x)=>[x,eave+rise*t,cz+side*half*(1-t)];
  for(const s of[-1,1]){
    slab([roofPoint(s,0,-roofX),roofPoint(s,0,roofX),roofPoint(s,1,ridgeX),roofPoint(s,1,-ridgeX)],.10,slate,p=>[p[0]/3,Math.abs(p[2]-cz)/Math.cos(Math.atan2(rise,half))/3]);
    slab([[s*roofX,eave,cz-half],[s*roofX,eave,cz+half],[s*ridgeX,eave+rise,cz]],.10,slate,p=>[p[2]/3,(Math.abs(p[0])-ridgeX)/Math.cos(Math.atan2(rise,half))/3]);
  }
  // Course locations and UV direction follow the resident CC0 slate photo.
  // Its nonuniform photographed butt rows produce the real lap geometry.
  const distances=[0,slope];
  for(let turn=-1;turn<3;turn++)for(const pixel of RANCH_ROOF_PHOTO_PROFILES.slate.butts){
    const d=(turn+1-pixel/1024)*3;if(d>1e-5&&d<slope-1e-5)distances.push(d);
  }
  distances.sort((a,b)=>a-b);const cuts=distances.filter((d,i)=>!i||d-distances[i-1]>1e-6).map(d=>1-d/slope).sort((a,b)=>a-b);
  for(let row=0;row<cuts.length-1;row++){
    const t0=cuts[row],t1=cuts[row+1],h0=roofX-(roofX-ridgeX)*t0,h1=roofX-(roofX-ridgeX)*t1;
    for(const s of[-1,1]){
      const p=[roofPoint(s,t0,-h0),roofPoint(s,t0,h0),roofPoint(s,t1,h1),roofPoint(s,t1,-h1)];
      // Slight raised downhill butt; the uphill lap beds into the plane.
      p[0][1]+=.014;p[1][1]+=.014;p[2][1]+=.002;p[3][1]+=.002;
      slab(p,.014,slate,q=>[q[0]/3,Math.abs(q[2]-cz)/Math.cos(Math.atan2(rise,half))/3]);courses++;
      const xx0=s*(roofX-(roofX-ridgeX)*t0),xx1=s*(roofX-(roofX-ridgeX)*t1),w0=half*(1-t0),w1=half*(1-t1);
      slab([[xx0,eave+rise*t0+.014,cz-w0],[xx0,eave+rise*t0+.014,cz+w0],[xx1,eave+rise*t1+.002,cz+w1],[xx1,eave+rise*t1+.002,cz-w1]],.014,slate,q=>[q[2]/3,(Math.abs(q[0])-ridgeX)/Math.cos(Math.atan2(rise,half))/3]);courses++;
    }
  }
  for(const z of[cz-half,cz+half]){
    box(13.08,.15,.08,cream,0,eave-.07,z);
    box(13.08,.035,.115,iron,0,eave-.165,z);
    for(const dz of[-.053,.053])box(13.08,.06,.013,iron,0,eave-.135,z+dz);
  }
  for(const x of[-6.5,6.5])box(.08,.15,4.7,cream,x,eave-.07,cz);
  box(8.42,.07,.16,iron,0,eave+rise+.035,cz);
  for(const s of[-1,1])for(const side of[-1,1])pipe([s*6.50,eave+.03,cz+side*half],[s*ridgeX,eave+rise+.025,cz],.036);
  for(const x of[-5.85,-3.9,-1.8,1.8,3.9,5.85]){
    const trussRidge=eave+rise*Math.min(1,(roofX-Math.abs(x))/(roofX-ridgeX))-.23;
    box(.11,.16,3.82,oak,x,3.83,cz,null,true);
    for(const s of[-1,1])beam([x,3.97,cz+s*1.90],[x,trussRidge,cz],.105,.13);
    box(.09,trussRidge-3.88,.10,oak,x,(trussRidge+3.88)/2,cz);
  }
  for(const x of[-6.08,6.08]){
    pipe([x,eave-.16,cz-half],[x,.20,back-.23],.029);
    pipe([x,.20,back-.23],[x,.13,back-.44],.029);
  }
  // Two shaded, solid lanterns supply a restrained evening detail.
  for(const x of[-1.80,1.80]){
    box(.045,.18,.06,iron,x,2.82,front+.11);box(.08,.035,.22,iron,x,2.91,front+.17);
    box(.135,.235,.135,lamp,x,2.66,front+.25);
    for(const y of[2.53,2.79])box(.18,.035,.18,iron,x,y,front+.25);
    for(const dx of[-.075,.075])box(.018,.24,.018,iron,x+dx,2.66,front+.33);
  }
  let triangles=0,bytes=0;
  for(const[m,b]of batches){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setIndex(b.i);g.computeBoundingBox();g.computeBoundingSphere();
    g.userData.estateGrandstandResident=true;
    triangles+=g.index.count/3;bytes+=g.index.array.byteLength+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0);
    const mesh=new T.Mesh(g,m);mesh.name=m.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.estateGrandstand={version:'estate-grandstand-1',originalDesign:true,drawCalls:batches.size,triangles,geometryBytes:bytes,parts,
    supportPoints:supportX.flatMap(x=>[front,back].map(z=>[x,z])),seatRows:3,deckLevels:levels,centreAisleWidth:1.10,
    roof:{type:'hipped',ridgeHeight:eave+rise,ridgeHalfLength:ridgeX,eaveHeight:eave,halfWidth:roofX,halfDepth:half,centreZ:cz,physicalCourses:courses},
    inheritedCollisionAuthority:true,borrowedTextures:true,isolatedConstructionRandom:true};
  const meshes=group.children.slice();let disposed=false;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;for(const mesh of meshes)mesh.geometry.dispose();for(const m of owned)m.dispose();};
  return group;
}
