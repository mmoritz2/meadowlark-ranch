import {setTimberBoxUV,applyTimberGrain} from './timber-cladding.mjs?v=timber-cladding-1';
import {dressTimberBox} from './ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {dressRoofCoverBox} from './ranch-roof-courses.mjs?v=ranch-roof-courses-3';

/* Original Meadowlark gatehouse stable. A complete replacement of the main
 * barn's visible architecture, mounted on its existing collision root.
 * All textures are borrowed from the resident architecture factory. This
 * model does not create terrain, colliders, textures, timers or async work.
 */
export function buildArrivalStable({THREE:T,architecture}={}) {
  if(!T||!architecture?.materials)throw new TypeError('Arrival stable requires THREE and the resident architecture factory');
  // Three UUID creation must not advance the later world's seeded stream.
  const random=Math.random;let seed=0x4d4c5354;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{return build(T,architecture);}finally{Math.random=random;}
}

function build(T,architecture){
  const source=name=>architecture.materials.get(name),owned=new Set(),batches=new Map();
  const make=(name,base,options={})=>{
    const m=new T.MeshStandardMaterial({roughness:.93,envMapIntensity:.62,...options});
    m.name='Arrival stable | '+name;
    if(base)for(const channel of['map','normalMap','roughnessMap','aoMap'])if(base[channel])m[channel]=base[channel];
    m.userData.patchMetres=base?.userData?.patchMetres||1.6;
    owned.add(m);return m;
  };
  const oak=make('smoked oak joinery',source('Ranch | oiled oak doors'),{color:'#99816a',roughness:.87});
  oak.userData.timber=true;applyTimberGrain(oak,T);
  const sage=make('deep sage painted boards',source('Ranch | weathered timber siding'),{
    color:'#d4d1be',normalScale:new T.Vector2(.24,.24),roughness:1});
  sage.userData.timber=true;sage.userData.siding=true;applyTimberGrain(sage,T);
  // An opaque mineral paint coat retains photographed grain, without tinting
  // brown photographic timber into an almost-black multiplication result.
  const grain=sage.onBeforeCompile,pigment=new T.Color('#536d60').toArray().map(v=>v.toFixed(8)).join(',');
  sage.onBeforeCompile=function(shader,renderer){
    grain.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\nfloat arrivalGrain=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.0,0.0,1.0);\n'+
      'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+pigment+')*(.83+.17*arrivalGrain),.94);');
  };
  sage.customProgramCacheKey=()=> 'arrival-sage-painted-board-v1';
  const stone=make('warm limestone plinth',source('Ranch | foundation stone'),{color:'#c7bea6',normalScale:new T.Vector2(.38,.38)});
  const cream=make('cream limewash',source('Village | limewashed plaster 0'),{color:'#eee4c9',normalScale:new T.Vector2(.14,.14)});
  const slate=make('blue slate roofs',source('Village | blue grey slate'),{color:'#929da2',normalScale:new T.Vector2(.56,.56)});
  const iron=make('forged black iron',null,{color:'#29312e',roughness:.65,metalness:.68});
  const recess=make('interior timber shadow',null,{color:'#303b34',roughness:1});
  const glass=make('opaque reflective stable glass',null,{color:'#7b9693',roughness:.22,metalness:.38,envMapIntensity:1.15});
  const lamp=make('warm lantern panes',null,{color:'#e5ce99',roughness:.42,emissive:'#dca852',emissiveIntensity:.32});
  const group=new T.Group();group.name='Meadowlark gatehouse stable';
  let parts=0;const roofReceipts=[],Y=new T.Vector3(0,1,0),identity=new T.Matrix4();
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
  function box(w,h,d,m,x=0,y=0,z=0,rotation=null,roofAxis=null,roofDown=1){
    if(![w,h,d,x,y,z].every(Number.isFinite)||Math.min(w,h,d)<=0)throw Error('Finite positive stable part required');
    const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    const patch=m.userData.patchMetres||1.6;
    for(let i=0;i<p.count;i++){
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
      uv.setXY(i,(roofAxis==='x'&&ny>.5?p.getZ(i)+z:nx>.5?p.getZ(i)+z:p.getX(i)+x)/patch,
        (ny>.5?(roofAxis==='x'?p.getX(i)+x:p.getZ(i)+z):p.getY(i)+y)/patch);
    }
    if(m.userData.timber){
      setTimberBoxUV(g,{width:w,height:h,depth:d,x,y,z,siding:!!m.userData.siding,lengthMetres:2.4});
      if(m===sage&&h>.25&&w>.10&&d<.22)dressTimberBox(T,g,{width:w,height:h,depth:d,x,y,z,radius:.003,siding:true,lengthMetres:2.4});
    }
    if(m===slate&&roofAxis){
      const q=dressRoofCoverBox(T,g,{width:w,height:h,depth:d,axis:roofAxis,downSlope:roofDown,style:'slate'});
      if(q)roofReceipts.push(q);
    }
    const q=rotation instanceof T.Quaternion?rotation:new T.Quaternion().setFromEuler(rotation||new T.Euler());
    add(g,m,new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1)));
  }
  function beam(a,b,w,d,m=oak){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);
    const mid=p.clone().add(q).multiplyScalar(.5);
    box(w,v.length(),d,m,mid.x,mid.y,mid.z,new T.Quaternion().setFromUnitVectors(Y,v.normalize()));
  }
  function pipe(a,b,r,m=iron){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p),g=new T.CylinderGeometry(r,r,v.length(),8);
    add(g,m,new T.Matrix4().compose(p.add(q).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(Y,v.normalize()),new T.Vector3(1,1,1)));
  }
  const front=1.65,back=-2.75,halfW=3.5,wallTop=3.55;
  function localPanel(w,h,m,x,y,z,angle=0){
    const root=new T.Matrix4().makeRotationY(angle);root.setPosition(x,y,z);
    const g=new T.BoxGeometry(w,h,.17);
    const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
    for(let i=0;i<p.count;i++)u.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/1.6,p.getY(i)/1.6);
    if(m===sage){
      setTimberBoxUV(g,{width:w,height:h,depth:.17,x,y,z,siding:true,lengthMetres:2.4});
      dressTimberBox(T,g,{width:w,height:h,depth:.17,x,y,z,radius:.003,siding:true,lengthMetres:2.4});
    }
    add(g,m,root);
  }
  function wall(width,x,z,angle,openings=[]){
    const cuts=[-width/2,width/2,...openings.flatMap(o=>[o.x-o.w/2,o.x+o.w/2])].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const left=cuts[i],right=cuts[i+1],mid=(left+right)/2;if(right-left<1e-6)continue;
      const o=openings.find(o=>mid>o.x-o.w/2&&mid<o.x+o.w/2);
      for(const [lo,hi]of(o?[[.16,o.lo],[o.hi,wallTop]]:[[.16,wallTop]])){
        if(hi-lo<1e-6)continue;
        const cx=x+Math.cos(angle)*mid,cz=z-Math.sin(angle)*mid;
        const split=Math.max(lo,.58);
        if(split>lo)localPanel(right-left,split-lo,stone,cx,(lo+split)/2,cz,angle);
        if(hi>split)localPanel(right-left,hi-split,sage,cx,(split+hi)/2,cz,angle);
      }
    }
  }
  const opening={x:0,w:1.9,lo:.16,hi:2.82};
  const frontWindows=[-2.3,2.3].map(x=>({x,w:1.55,lo:1.40,hi:2.80}));
  wall(7,0,front,0,[opening,...frontWindows]);
  wall(7,0,back,Math.PI,[-2.20,2.20].map(x=>({x,w:1.25,lo:1.65,hi:2.80})));
  for(const s of[-1,1])wall(4.4,s*halfW,-.55,s*Math.PI/2,[{x:0,w:1.65,lo:1.60,hi:2.75}]);
  // Substantial corner posts and a continuous pale stone base belong to the
  // building, never the riding lane. The outer veranda post centres are old.
  for(const x of[-3.34,-1.12,1.12,3.34]){
    box(.28,.65,.28,stone,x,.325,2.695);
    box(.205,2.76,.205,oak,x,2.03,2.695);
    box(.29,.10,.29,stone,x,.67,2.695);
    for(const s of[-1,1])if(Math.abs(x+s*.41)<3.45)beam([x,2.98,2.695],[x+s*.41,3.42,2.695],.095,.12);
    beam([x,3.46,front],[x,3.46,2.695],.12,.15);
  }
  box(7.10,.24,.23,oak,0,3.46,2.695);
  for(const x of[-3.49,3.49])for(const z of[back,front]){
    box(.18,wallTop-.15,.18,oak,x,(wallTop+.15)/2,z);
    box(.25,.42,.25,stone,x,.25,z);
  }
  // Stable doors retain the original closed leaf plane at z=1.65. The deep
  // entrance apron in front is physically open; there is no fake black panel.
  for(const s of[-1,1]){
    const x=s*.478;
    box(.93,2.62,.095,oak,x,1.49,front+.015);
    for(const yy of[.43,1.38,2.50])box(.85,.12,.07,sage,x,yy,front+.10);
    beam([x-.38,.48,front+.12],[x+.38,1.31,front+.12],.095,.045,sage);
    for(const yy of[.51,2.48])box(.30,.034,.025,iron,x+s*.24,yy,front+.16);
    box(.038,.23,.055,iron,s*.16,1.52,front+.15);
  }
  for(const s of[-1,1])box(.14,2.83,.25,stone,s*1.025,1.495,front+.055);
  box(2.22,.18,.26,stone,0,2.89,front+.06);
  // Actual recessed windows with thick timber jambs, lower Dutch hatches and
  // separate iron bars. Side/back windows share the same spatial assembly.
  function stableWindow(cx,cy,cz,w,h,angle=0){
    const transform=new T.Matrix4().makeRotationY(angle);transform.setPosition(cx,cy,cz);
    const place=(w,h,d,m,x,y,z)=>{
      const g=new T.BoxGeometry(w,h,d);const uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal;
      if(m.userData.timber)setTimberBoxUV(g,{width:w,height:h,depth:d,x,y,z,lengthMetres:2.4});
      else for(let i=0;i<p.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/1.6,p.getY(i)/1.6);
      const mat=new T.Matrix4().makeTranslation(x,y,z);mat.premultiply(transform);add(g,m,mat);
    };
    place(w-.04,h-.04,.04,recess,0,0,-.22);
    place(w-.14,h-.16,.018,glass,0,0,-.18);
    place(w-.10,.50,.09,sage,0,-h/2+.27,.03);
    for(const s of[-1,1]){
      place(.09,h+.12,.30,oak,s*(w/2+.005),0,.035);
      place(w+.18,.09,.30,oak,0,s*(h/2+.018),.035);
    }
    for(let k=1;k<=7;k++)place(.018,h-.62,.03,iron,-w/2+k*w/8,.26,.015);
    place(w+.23,.11,.36,stone,0,-h/2-.055,.07);
    for(const s of[-1,1])place(.25,.035,.035,iron,s*(w/2-.18),-h/2+.30,.11);
  }
  for(const x of[-2.3,2.3])stableWindow(x,2.10,front,1.55,1.40);
  for(const x of[-2.2,2.2])stableWindow(-x,2.225,back,1.25,1.15,Math.PI);
  for(const s of[-1,1])stableWindow(s*halfW,2.175,-.55,1.65,1.15,s*Math.PI/2);
  // Main roof is a lower longitudinal range; the projecting central gable is
  // a full volume, so its strong silhouette is visible from the arena/start.
  const mainRidge=4.88,mainEave=3.58,run=3.08,pitch=Math.atan2(mainRidge-mainEave,run),len=run/Math.cos(pitch);
  for(const s of[-1,1]){
    box(7.76,.13,len+.04,slate,0,(mainRidge+mainEave)/2,s*run/2,new T.Euler(s*pitch,0,0),'z',s);
    box(7.79,.18,.13,cream,0,mainEave-.045,s*run);
    box(7.76,.026,.14,iron,0,mainEave-.155,s*(run+.03));
    for(const lip of[-1,1])box(7.76,.064,.018,iron,0,mainEave-.125,s*(run+.03)+lip*.06);
  }
  box(7.82,.085,.20,iron,0,mainRidge+.045,0);
  for(const x of[-3.85,3.85])for(const s of[-1,1])beam([x,mainEave-.025,s*run],[x,mainRidge+.02,0],.13,.16,cream);
  function gableShape(width,eave,ridge,base){
    const sh=new T.Shape();sh.moveTo(-width/2,base);sh.lineTo(width/2,base);sh.lineTo(width/2,eave);sh.lineTo(0,ridge);sh.lineTo(-width/2,eave);sh.closePath();return sh;
  }
  for(const s of[-1,1]){
    const sh=gableShape(5.5,3.55,mainRidge,3.52),g=new T.ExtrudeGeometry(sh,{depth:.16,bevelEnabled:false});
    const m=new T.Matrix4().makeRotationY(s*Math.PI/2);m.setPosition(s*3.48,0,0);add(g,sage,m);
  }
  const centerW=3.12,centerEave=3.79,centerRidge=6.12,centerFront=2.78,centerBack=-1.78,roofHalf=1.76;
  const sh=gableShape(centerW,centerEave,centerRidge,3.44),hole=new T.Path();
  hole.absarc(0,4.78,.365,0,Math.PI*2,true);sh.holes.push(hole);
  const upper=new T.ExtrudeGeometry(sh,{depth:.18,bevelEnabled:false,curveSegments:28});
  const pos=upper.attributes.position,nor=upper.attributes.normal,uv=upper.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,(Math.abs(nor.getX(i))>.5?pos.getZ(i):pos.getX(i))/2,pos.getY(i)/2);
  add(upper,cream,new T.Matrix4().makeTranslation(0,0,centerFront-.18));
  const rearShape=gableShape(centerW,centerEave,centerRidge,3.44);
  add(new T.ExtrudeGeometry(rearShape,{depth:.16,bevelEnabled:false}),cream,new T.Matrix4().makeTranslation(0,0,centerBack));
  for(const s of[-1,1]){
    box(.17,.50,centerFront-centerBack,cream,s*centerW/2,3.64,(centerFront+centerBack)/2);
    const r=6.12-3.79,p=Math.atan2(r,centerW/2),low=centerRidge-roofHalf*Math.tan(p),slope=roofHalf/Math.cos(p);
    box(slope+.04,.13,centerFront-centerBack+.43,slate,s*roofHalf/2,(centerRidge+low)/2,(centerFront+centerBack)/2,new T.Euler(0,0,-s*p),'x',s);
    beam([s*roofHalf,low,centerFront+.18],[0,centerRidge+.035,centerFront+.18],.16,.17,cream);
    beam([s*roofHalf,low,centerBack-.18],[0,centerRidge+.035,centerBack-.18],.13,.15,cream);
    box(.14,.16,centerFront-centerBack+.44,cream,s*roofHalf,low-.045,(centerFront+centerBack)/2);
    // Valley flashing follows the real meeting line of the two roof masses.
    beam([s*.90,mainRidge+.065,0],[s*1.73,3.69,2.86],.07,.035,iron);
  }
  box(.15,.10,centerFront-centerBack+.48,iron,0,centerRidge+.065,(centerFront+centerBack)/2);
  // Truss, carved oculus ring, and deep glazing give the front gable a clear
  // hierarchy instead of enlarging a flat rectangular facade.
  box(3.12,.18,.15,oak,0,3.57,centerFront+.045);
  beam([-1.43,3.72,centerFront+.045],[0,5.91,centerFront+.045],.11,.12);
  beam([1.43,3.72,centerFront+.045],[0,5.91,centerFront+.045],.11,.12);
  box(.11,.59,.12,oak,0,5.70,centerFront+.045);
  const rim=new T.TorusGeometry(.414,.061,8,48);add(rim,stone,new T.Matrix4().makeTranslation(0,4.78,centerFront+.025));
  const disk=new T.CircleGeometry(.354,48);add(disk,glass,new T.Matrix4().makeTranslation(0,4.78,centerFront-.095));
  box(.032,.68,.065,iron,0,4.78,centerFront-.035);box(.68,.032,.065,iron,0,4.78,centerFront-.035);
  // Floor, interior roof ties and stable partitions are real surfaces behind
  // the recessed openings. Nothing projects beyond the old walls below eaves.
  box(6.82,.09,4.28,stone,0,.115,-.55);
  for(const x of[-1.15,1.15]){
    box(.085,1.35,3.35,oak,x,.87,-.60);
    for(let k=0;k<13;k++)box(.022,.75,.022,iron,x,1.92,-2.18+k*.26);
  }
  for(const z of[-2.35,-.8,.75])beam([-3.38,3.37,z],[3.38,3.37,z],.12,.14,oak);
  function lantern(x,y,z){
    box(.065,.25,.07,iron,x,y+.17,z-.13);box(.10,.045,.28,iron,x,y+.29,z);
    box(.17,.28,.17,lamp,x,y,z+.08);
    for(const dy of[-.16,.16])box(.24,.045,.23,iron,x,y+dy,z+.08);
    for(const dx of[-.10,.10])box(.025,.30,.025,iron,x+dx,y,z+.17);
    const cap=new T.ConeGeometry(.18,.11,4);cap.rotateY(Math.PI/4);add(cap,iron,new T.Matrix4().makeTranslation(x,y+.235,z+.08));
  }
  for(const x of[-1.37,1.37])lantern(x,2.60,front+.18);
  // Small split-leaf hinges, roof drainage, and stone paving are subordinate
  // to the new gatehouse silhouette. There are no game-scale novelty props.
  for(const s of[-1,1]){
    pipe([s*3.59,3.40,-2.92],[s*3.59,.28,-2.92],.032);
    pipe([s*3.59,.28,-2.92],[s*3.42,.16,-2.92],.032);
  }
  let triangles=0,bytes=0;
  for(const[m,b]of batches){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setIndex(b.i);g.computeBoundingBox();g.computeBoundingSphere();
    triangles+=b.i.length/3;bytes+=g.index.array.byteLength+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0);
    const mesh=new T.Mesh(g,m);mesh.name=m.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.arrivalStable={version:'arrival-stable-1',originalDesign:true,width:7,depth:5.5,
    wallHeight:wallTop,ridgeHeight:centerRidge,drawCalls:batches.size,triangles,geometryBytes:bytes,parts,
    inheritedCollisionAuthority:true,door:{x:0,z:1.65,width:1.9,height:2.66,closedLeaves:true},
    clearEntryApron:{minX:-.95,maxX:.95,minZ:1.78,maxZ:2.78,minY:.17,maxY:2.82},
    porchPostX:[-3.34,-1.12,1.12,3.34],porchPostZ:2.695,physicalSlateCourses:roofReceipts.length,
    ownedMaterials:[...owned].map(m=>m.name),borrowedTextures:true,isolatedConstructionRandom:true};
  const ownedMeshes=group.children.slice();
  group.userData.dispose=()=>{for(const c of ownedMeshes)c.geometry?.dispose();for(const m of owned)m.dispose();};
  return group;
}
