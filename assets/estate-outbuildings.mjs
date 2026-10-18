import {setTimberBoxUV,applyTimberGrain} from './timber-cladding.mjs?v=timber-cladding-1';
import {dressTimberBox} from './ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {dressRoofCoverBox} from './ranch-roof-courses.mjs?v=ranch-roof-courses-3';

// UUID generation is isolated from world placement randomness, but advances
// between models so resource/object identities never repeat across instances.
let presentationSeed=0x45535441;

// Original Meadowlark estate service buildings. The old factory remains the
// collision and random-stream authority; this module replaces visible batches
// only. Animated doors and ceremony effects are siblings owned by callers.
export function installEstateOutbuildings({THREE:T,architecture}={}){
  if(!T||!architecture?.materials||typeof architecture.buildOutbuilding!=='function')
    throw new TypeError('Estate outbuildings require THREE and the resident architecture factory');
  if(architecture.estateOutbuildings)return architecture.estateOutbuildings;
  const original=architecture.buildOutbuilding;
  const state={version:'estate-outbuildings-1',replacements:0,originalBuild:original};
  const wrapped=function(...args){
    const root=original.apply(this,args);
    if(root.userData.architecture?.exterior==='village')return root;
    dressEstateOutbuilding({THREE:T,architecture,root});
    state.replacements++;return root;
  };
  architecture.buildOutbuilding=wrapped;
  state.uninstall=()=>{if(architecture.buildOutbuilding===wrapped)architecture.buildOutbuilding=original;
    if(architecture.estateOutbuildings===state)delete architecture.estateOutbuildings;};
  architecture.estateOutbuildings=state;return state;
}

export function dressEstateOutbuilding({THREE:T,architecture,root}={}){
  if(!T||!architecture?.materials||!root?.userData?.architecture)
    throw new TypeError('Dress an existing authored outbuilding root');
  if(root.userData.estateOutbuilding||root.userData.architecture.exterior==='village')return root;
  const data=root.userData.architecture;
  if(data.kind!=='outbuilding')throw new TypeError('Estate dressing requires an outbuilding shell');
  const visual=buildEstateOutbuilding({THREE:T,architecture,width:data.width,depth:data.depth,
    height:data.wallHeight,animatedDoorOpening:data.animatedDoorOpening,name:root.name});
  // The original factory registers this live colour with the world's evening
  // lighting. Keep that controller while replacing its old window geometry.
  const interior=root.children.find(child=>child.isMesh&&child.material?.name==='Ranch | window interior')?.material;
  const pane=visual.children.find(child=>child.material?.name==='Estate service | deep opaque casement glass')?.material;
  if(interior&&pane){pane.emissive=interior.color;pane.emissiveIntensity=.70;
    visual.userData.estateOutbuilding.inheritedWindowLighting=true;}
  // Flat material batches are intentional: the follow camera uses the root's
  // authored solidParts and must not infer a full-room AABB from a nested group.
  for(const child of root.children)if(child.isMesh)child.visible=false;
  root.add(...visual.children.slice());
  root.userData.estateOutbuilding=visual.userData.estateOutbuilding;
  root.userData.disposeEstateOutbuilding=visual.userData.dispose;
  return root;
}

export function buildEstateOutbuilding({THREE:T,architecture,width=4.6,depth=3.2,height=3.4,
  animatedDoorOpening={width:2.3,height:2.5},name='Meadowlark estate service building'}={}){
  if(!T||!architecture?.materials)throw new TypeError('Estate outbuildings require resident architecture materials');
  const w=width,d=depth,h=height,spec=animatedDoorOpening===true?{}:(animatedDoorOpening||{}),
    dw=spec.width??spec.w??Math.min(2.3,w*.5),dh=spec.height??spec.h??Math.min(2.5,h-.55),dx=spec.x??0;
  if(![w,d,h,dw,dh,dx].every(Number.isFinite)||Math.min(w,d,h)<=1||dw<=0||dh<=0||
    dw+Math.abs(dx)*2>w-.42||dh>h-.27)throw new RangeError('Finite fitted estate shell and doorway dimensions required');
  const random=Math.random;let seed=presentationSeed;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{return build(T,architecture,{w,d,h,dw,dh,dx,name});}
  finally{presentationSeed=seed;Math.random=random;}
}

function build(T,architecture,{w,d,h,dw,dh,dx,name}){
  const source=n=>architecture.materials.get(n),owned=new Set(),batches=new Map(),roofReceipts=[];
  const make=(n,base,opts={})=>{
    const m=new T.MeshStandardMaterial({roughness:.94,envMapIntensity:.58,...opts});
    m.name='Estate service | '+n;
    if(base)for(const k of['map','normalMap','roughnessMap','aoMap'])if(base[k])m[k]=base[k];
    m.userData.patchMetres=base?.userData?.patchMetres||1.6;owned.add(m);return m;
  };
  const timber=make('muted sage board cladding',source('Ranch | weathered timber siding'),
    {color:'#d4d1be',normalScale:new T.Vector2(.24,.24),roughness:1});
  timber.userData.timber=true;timber.userData.siding=true;applyTimberGrain(timber,T);
  const grain=timber.onBeforeCompile,pigment=new T.Color(w<=3.6?'#677567':'#586d60').toArray().map(v=>v.toFixed(8)).join(',');
  timber.onBeforeCompile=function(shader,renderer){
    grain.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\nfloat estateBoardGrain=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.0,0.0,1.0);\n'+
      'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+pigment+')*(.82+.18*estateBoardGrain),.94);');
  };
  timber.customProgramCacheKey=()=>w<=3.6?'estate-service-sage-small-v1':'estate-service-sage-wide-v1';
  const oak=make('smoked oak joinery',source('Ranch | oiled oak doors'),{color:'#a18a6e',roughness:.88});
  oak.userData.timber=true;applyTimberGrain(oak,T);
  const cream=make('warm mineral gable and trim',source('Village | limewashed plaster 0'),
    {color:'#d5ceb6',normalScale:new T.Vector2(.16,.16)});
  const stone=make('buff limestone plinth and quoins',source('Ranch | dressed limestone'),
    {color:'#bab29d',normalScale:new T.Vector2(.30,.30)});
  const slate=make('aged blue slate',source('Village | blue grey slate'),
    {color:'#89989d',normalScale:new T.Vector2(.56,.56),roughness:.97});
  const iron=make('dark forged iron and rainwater goods',null,{color:'#293330',roughness:.62,metalness:.66});
  const recess=make('interior shadow',null,{color:'#303b36',roughness:1});
  const glass=make('deep opaque casement glass',null,{color:'#718780',roughness:.24,metalness:.35,envMapIntensity:1.1});
  const lamp=make('warm sheltered lantern panes',null,{color:'#d7c59d',roughness:.38,emissive:'#c69b54',emissiveIntensity:.20});
  const group=new T.Group();group.name=name+' | estate model';
  const Y=new T.Vector3(0,1,0),identity=new T.Matrix4();let parts=0;
  function add(g,m,matrix=identity){
    g.applyMatrix4(matrix);let b=batches.get(m);if(!b){b={p:[],n:[],u:[],i:[]};batches.set(m,b);}
    const offset=b.p.length/3;
    for(const v of g.attributes.position.array)b.p.push(v);
    for(const v of g.attributes.normal.array)b.n.push(v);
    for(const v of g.attributes.uv.array)b.u.push(v);
    if(g.index)for(const i of g.index.array)b.i.push(i+offset);
    else for(let i=0;i<g.attributes.position.count;i++)b.i.push(i+offset);
    parts++;g.dispose();
  }
  function box(width,height,depth,m,x=0,y=0,z=0,rotation=null,frame=null,roofAxis=null,roofDown=1){
    if(![width,height,depth,x,y,z].every(Number.isFinite)||Math.min(width,height,depth)<=0)
      throw new RangeError('Positive finite estate part required');
    const g=new T.BoxGeometry(width,height,depth),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,
      patch=m.userData.patchMetres||1.6;
    for(let i=0;i<p.count;i++){
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
      u.setXY(i,(roofAxis==='x'&&ny>.5?p.getZ(i)+z:nx>.5?p.getZ(i)+z:p.getX(i)+x)/patch,
        (ny>.5?(roofAxis==='x'?p.getX(i)+x:p.getZ(i)+z):p.getY(i)+y)/patch);
    }
    if(m.userData.timber){
      setTimberBoxUV(g,{width,height,depth,x,y,z,siding:!!m.userData.siding,lengthMetres:2.4});
      if(m===timber&&height>.25&&width>.10&&depth<.22)
        dressTimberBox(T,g,{width,height,depth,x,y,z,radius:.003,siding:true,lengthMetres:2.4});
    }
    if(m===slate&&roofAxis){const q=dressRoofCoverBox(T,g,{width,height,depth,axis:roofAxis,downSlope:roofDown,style:'slate'});if(q)roofReceipts.push(q);}
    const q=rotation instanceof T.Quaternion?rotation:new T.Quaternion().setFromEuler(rotation||new T.Euler()),
      transform=new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1));
    if(frame)transform.premultiply(frame);add(g,m,transform);
  }
  const face=(x,z,a)=>new T.Matrix4().compose(new T.Vector3(x,0,z),
    new T.Quaternion().setFromAxisAngle(Y,a),new T.Vector3(1,1,1));
  function beam(a,b,width,depth,m=oak,frame=null){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p),mid=p.clone().add(q).multiplyScalar(.5);
    box(width,v.length(),depth,m,mid.x,mid.y,mid.z,new T.Quaternion().setFromUnitVectors(Y,v.normalize()),frame);
  }
  function pipe(a,b,r,m=iron){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p),mid=p.clone().add(q).multiplyScalar(.5);
    add(new T.CylinderGeometry(r,r,v.length(),8),m,new T.Matrix4().compose(mid,
      new T.Quaternion().setFromUnitVectors(Y,v.normalize()),new T.Vector3(1,1,1)));
  }
  const front=d/2,back=-d/2,ridge=h+Math.min(1.15,d*.31),plinth=.48,frontF=face(0,front,0);
  const doorway={type:'door',x:dx,y:dh/2,w:dw,h:dh};
  const frontWindows=[];
  for(const s of[-1,1]){
    const inner=dx+s*dw/2,outer=s*w/2,clear=Math.abs(outer-inner);
    if(clear>.86)frontWindows.push({x:(inner+outer)/2,y:Math.min(h-.60,dh*.69+.16),
      w:Math.min(.68,clear-.48),h:Math.min(.90,h*.34)});
  }
  const backWindows=(w>4?[-w*.24,w*.24]:[0]).map(x=>({x,y:Math.min(h-.75,h*.58),
    w:Math.min(1.02,w*.25),h:Math.min(1.02,h*.36)}));
  const sideWindow={x:0,y:Math.min(h-.75,h*.58),w:Math.min(.90,d*.32),h:Math.min(1.0,h*.36)};
  function wall(width,frame,openings=[]){
    const cuts=[-width/2,width/2,...openings.flatMap(o=>[o.x-o.w/2,o.x+o.w/2])].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const left=cuts[i],right=cuts[i+1],mid=(left+right)/2;if(right-left<1e-6)continue;
      const o=openings.find(q=>mid>q.x-q.w/2&&mid<q.x+q.w/2),
        intervals=o?[[.16,Math.max(.16,o.y-o.h/2)],[o.y+o.h/2,h]]:[[.16,h]];
      for(const[lo,hi]of intervals){
        if(hi-lo<1e-6)continue;
        const split=Math.max(lo,Math.min(hi,plinth));
        if(split>lo)box(right-left,split-lo,.18,stone,mid,(lo+split)/2,0,null,frame);
        if(hi>split)box(right-left,hi-split,.18,timber,mid,(split+hi)/2,0,null,frame);
      }
    }
    for(const o of openings)if(o.type!=='door')window(o,frame);
  }
  function window(o,frame){
    const{x,y,w:ww,h:hh}=o;
    // Opaque glass is inset 90 mm behind the outer wall face. Actual wall
    // rectangles stop at the aperture, exposing the timber-lined deep jambs.
    box(ww-.025,hh-.025,.025,recess,x,y,-.16,null,frame);
    box(ww-.11,hh-.11,.018,glass,x,y,-.125,null,frame);
    for(const s of[-1,1]){
      box(.065,hh+.045,.24,oak,x+s*(ww/2-.012),y,.003,null,frame);
      box(ww+.11,.067,.24,oak,x,y+s*(hh/2+.005),.003,null,frame);
    }
    box(.030,hh-.105,.047,cream,x,y,-.057,null,frame);
    box(ww-.105,.030,.047,cream,x,y-.02,-.057,null,frame);
    box(ww+.20,.095,.29,stone,x,y-hh/2-.055,.035,null,frame);
    box(ww+.17,.024,.20,iron,x,y+hh/2+.06,.045,null,frame);
    // Paired held-back shutters add thickness and angled edges without
    // crossing the aperture or extending beyond existing joinery envelopes.
    if(ww>.72)for(const s of[-1,1]){
      const sx=x+s*(ww/2+.155);
      box(.21,hh-.04,.045,timber,sx,y,.12,null,frame);
      for(const yy of[-hh*.28,hh*.28])box(.19,.045,.024,iron,sx,y+yy,.157,null,frame);
    }
  }
  // Reuse original walls' exact window and animated-door apertures.
  wall(w,frontF,[doorway,...frontWindows]);wall(w,face(0,back,Math.PI),backWindows);
  for(const s of[-1,1])wall(d,face(s*w/2,0,s*Math.PI/2),[sideWindow]);
  // Low mineral foundation and floor remain at the old shell levels.
  box(w+.14,.24,d+.14,stone,0,.08,0);
  box(w-.23,.026,d-.23,oak,0,.205,0);
  // Door jambs sit strictly outside its original open rectangle. No new
  // leaves or threshold are authored here; sibling gameplay doors survive.
  for(const s of[-1,1]){
    box(.115,dh+.12,.26,stone,dx+s*(dw/2+.065),(dh+.12)/2,front+.025);
    box(.050,dh-.05,.18,oak,dx+s*(dw/2+.027),dh/2,front-.015);
  }
  box(dw+.26,.15,.28,stone,dx,dh+.12,front+.025);
  box(dw+.13,.055,.20,oak,dx,dh+.023,front-.015);
  // Coursed quoins and restrained corner posts frame genuinely modeled boards.
  for(const x of[-w/2,w/2])for(const z of[back,front]){
    box(.15,h-.15,.15,oak,x,(h+.15)/2,z);
    for(let row=0;row<3;row++)box(.23,.145,.23,stone,x,.19+row*.155,z);
  }
  // A steep front-facing gable gives each service building a new silhouette.
  // Eave overhangs and ridge height stay inside the original roof envelope.
  function gable(atZ,reverse=false){
    const sh=new T.Shape();sh.moveTo(-w/2,h-.025);sh.lineTo(w/2,h-.025);sh.lineTo(0,ridge-.06);sh.closePath();
    const ventW=Math.min(.62,w*.17),ventH=Math.min(.30,(ridge-h)*.38),ventY=h+(ridge-h)*.40,
      hole=new T.Path();hole.moveTo(-ventW/2,ventY-ventH/2);hole.lineTo(-ventW/2,ventY+ventH/2);
    hole.lineTo(ventW/2,ventY+ventH/2);hole.lineTo(ventW/2,ventY-ventH/2);hole.closePath();sh.holes.push(hole);
    const g=new T.ExtrudeGeometry(sh,{depth:.16,bevelEnabled:false}),p=g.attributes.position,u=g.attributes.uv;
    for(let i=0;i<p.count;i++)u.setXY(i,p.getX(i)/2,p.getY(i)/2);
    const frame=face(0,atZ,reverse?Math.PI:0);add(g,cream,new T.Matrix4().makeTranslation(0,0,-.08).premultiply(frame));
    box(w+.06,.13,.17,oak,0,h+.006,.02,null,frame);
    box(ventW+.08,ventH+.06,.025,recess,0,ventY,-.105,null,frame);
    for(let k=0;k<4;k++)box(ventW+.08,.035,.09,oak,0,ventY-ventH/2+.035+k*(ventH-.035)/3,.025,new T.Euler(.24,0,0),frame);
    for(const s of[-1,1])box(.050,ventH+.12,.13,stone,s*(ventW/2+.035),ventY,.01,null,frame);
    for(const s of[-1,1])box(ventW+.12,.05,.13,stone,0,ventY+s*(ventH/2+.035),.01,null,frame);
    beam([-w*.40,h+.05,.045],[0,ridge-.15,.045],.075,.08,oak,frame);
    beam([w*.40,h+.05,.045],[0,ridge-.15,.045],.075,.08,oak,frame);
  }
  gable(front);gable(back,true);
  const over=.23,run=w/2+over,pitch=Math.atan2(ridge-h,w/2),low=ridge-run*Math.tan(pitch),length=run/Math.cos(pitch),roofD=d+over*2;
  for(const s of[-1,1]){
    box(length+.015,.12,roofD,slate,s*run/2,(ridge+low)/2,0,new T.Euler(0,0,-s*pitch),null,'x',s);
    box(.11,.16,roofD+.035,cream,s*run,low-.035,0);
    box(.112,.022,roofD+.02,iron,s*(run+.015),low-.135,0);
    for(const lip of[-1,1])box(.015,.055,roofD+.02,iron,s*(run+.015)+lip*.050,low-.108,0);
    for(const z of[-roofD/2,roofD/2])beam([s*run,low-.005,z],[0,ridge+.02,z],.12,.13,cream);
    const px=s*(w/2+.105),pz=back+.16;
    pipe([s*(run+.015),low-.13,pz],[px,low-.43,pz],.026);
    pipe([px,low-.43,pz],[px,.18,pz],.026);
    for(const yy of[.5,Math.max(.8,h-.55)])box(.075,.045,.095,iron,px,yy,pz);
  }
  box(.16,.080,roofD+.035,iron,0,ridge+.045,0);
  // Small framed pentice over the entry: its nose stays inside the old
  // overhang and its underside stays above the animated door's top edge.
  const hoodW=Math.min(w-.38,dw+.48),hoodBack=front+.07,hoodFront=front+.22,
    hoodY=Math.min(h-.08,dh+.34),hoodSlope=.12;
  box(hoodW,.072,hoodFront-hoodBack,slate,dx,hoodY,(hoodFront+hoodBack)/2,new T.Euler(hoodSlope,0,0),null,'z',1);
  box(hoodW+.03,.075,.07,oak,dx,hoodY-.03,hoodFront);
  for(const s of[-1,1])beam([dx+s*(hoodW/2-.08),dh+.15,front+.07],
    [dx+s*(hoodW/2-.08),hoodY-.025,hoodFront-.02],.043,.045,iron);
  // Readable interior framing behind the open doors, kept off the central
  // aisle and away from the independent summoning light plane.
  for(const z of[-d*.32,d*.24])beam([-w/2+.16,h-.12,z],[w/2-.16,h-.12,z],.09,.13);
  for(const s of[-1,1])beam([s*(w/2-.16),h-.16,0],[0,ridge-.18,0],.075,.085);
  const benchW=Math.max(.7,w-.66);
  box(benchW,.075,.29,oak,0,.89,back+.25);
  for(const x of[-benchW*.41,benchW*.41])box(.065,.63,.21,oak,x,.55,back+.25);
  box(Math.min(1.15,w*.34),.065,.22,oak,-w*.16,1.56,back+.22);
  function lantern(x,y,z){
    box(.06,.21,.07,iron,x,y+.10,z-.08);box(.085,.035,.20,iron,x,y+.23,z);
    box(.13,.22,.12,lamp,x,y,z+.055);
    for(const yy of[-.12,.12])box(.19,.035,.18,iron,x,y+yy,z+.055);
    for(const xx of[-.072,.072])box(.020,.235,.020,iron,x+xx,y,z+.12);
  }
  const lampX=dx-(dw/2+.30),lampY=Math.min(h-.32,dh-.12);
  lantern(Math.max(-w/2+.20,lampX),lampY,front+.12);
  let triangles=0,bytes=0;
  for(const[m,b]of batches){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setIndex(b.i);
    g.computeBoundingBox();g.computeBoundingSphere();triangles+=b.i.length/3;
    bytes+=g.index.array.byteLength+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);
    const mesh=new T.Mesh(g,m);mesh.name=m.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.estateOutbuilding={version:'estate-outbuildings-1',originalDesign:true,width:w,depth:d,
    wallHeight:h,ridgeHeight:ridge,roofOrientation:'front-facing-gable',drawCalls:batches.size,triangles,geometryBytes:bytes,parts,
    animatedDoorOpening:{x:dx,width:dw,height:dh,bottomY:0,frontZ:front},
    windows:{front:frontWindows.map(o=>({...o})),back:backWindows.map(o=>({...o})),side:{...sideWindow}},
    physicalSlateCourses:roofReceipts.length,borrowedTextures:true,isolatedConstructionRandom:true,
    inheritedCollisionAuthority:true,containsAnimatedDoors:false};
  const meshes=group.children.slice();let disposed=false;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;for(const m of meshes)m.geometry.dispose();for(const m of owned)m.dispose();};
  return group;
}
