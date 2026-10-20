import {setTimberBoxUV,applyTimberGrain} from './timber-cladding.mjs?v=timber-cladding-1';
import {dressTimberBox} from './ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {dressRoofCoverBox} from './ranch-roof-courses.mjs?v=ranch-roof-courses-3';

// Three's object/resource UUIDs use Math.random. Presentation-only construction
// gets a persistent stream, without advancing the world's placement generator
// or repeating UUIDs when a stable row is reset and rebuilt.
let presentationSeed=0x5354414c;
function presentation(build){
  const random=Math.random;let seed=presentationSeed;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try{return build();}finally{presentationSeed=seed;Math.random=random;}
}

// Install immediately after createRanchArchitecture, before any caller builds
// a stall. Every old root still authors its original solidParts and metadata;
// only visible meshes are replaced. One geometry/material set serves all rows.
export function installEstateOpenStalls({THREE:T,architecture}={}){
  if(!T||!architecture?.materials||typeof architecture.buildOpenStall!=='function')
    throw new TypeError('Estate stalls require THREE and the resident architecture factory');
  if(architecture.estateOpenStalls)return architecture.estateOpenStalls;
  const original=architecture.buildOpenStall,instances=new WeakMap(),roots=new Set(),
    collected=new FinalizationRegistry(ref=>roots.delete(ref));let shared=null,disposed=false;
  const liveRoots=()=>{const live=[];for(const ref of roots){const root=ref.deref();if(root)live.push(root);else roots.delete(ref);}return live;};
  const state={version:'estate-open-stalls-1',replacements:0,originalBuild:original,
    get liveInstances(){return liveRoots().length;},get resources(){return shared;}};
  const wrapped=function(...args){
    const root=original.apply(this,args);
    state.dress(root);return root;
  };
  state.dress=root=>{
    if(disposed)throw new Error('Estate stall installer has been disposed');
    if(root?.userData?.estateOpenStall)return root;
    if(root?.userData?.architecture?.kind!=='open-stall')
      throw new TypeError('Dress an original open-stall root');
    const oldMeshes=root.children.filter(c=>c.isMesh),
      interior=oldMeshes.find(c=>c.material?.name==='Ranch | window interior')?.material;
    const meshes=presentation(()=>{
      shared??=buildResources(T,architecture,interior);
      return shared.batches.map(({geometry,material})=>{
        const mesh=new T.Mesh(geometry,material);mesh.name=material.name;
        mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
      });
    });
    const oldVisibility=oldMeshes.map(mesh=>mesh.visible);
    for(const mesh of oldMeshes)mesh.visible=false;
    // Keep batches direct children. Camera registration sees the root's fine
    // authored pieces instead of enclosing an open stall in one inferred box.
    liveRoots();const ref=new WeakRef(root);roots.add(ref);collected.register(root,ref,ref);
    root.add(...meshes);instances.set(root,{oldMeshes,oldVisibility,meshes,ref});
    root.userData.estateOpenStall={...shared.metadata,inheritedWindowLighting:!!interior};
    root.userData.disposeEstateOpenStall=()=>state.release(root);
    state.replacements++;return root;
  };
  state.release=root=>{
    const entry=instances.get(root);if(!entry)return false;
    for(const mesh of entry.meshes)mesh.removeFromParent();
    entry.oldMeshes.forEach((mesh,i)=>{mesh.visible=entry.oldVisibility[i];});
    delete root.userData.estateOpenStall;delete root.userData.disposeEstateOpenStall;
    roots.delete(entry.ref);collected.unregister(entry.ref);
    instances.delete(root);return true;
  };
  state.uninstall=()=>{
    if(disposed)return;disposed=true;
    if(architecture.buildOpenStall===wrapped)architecture.buildOpenStall=original;
    for(const root of liveRoots())state.release(root);
    shared?.dispose();
    if(architecture.estateOpenStalls===state)delete architecture.estateOpenStalls;
  };
  state.dispose=state.uninstall;
  architecture.buildOpenStall=wrapped;architecture.estateOpenStalls=state;return state;
}

function buildResources(T,architecture,interior){
  const source=n=>architecture.materials.get(n),owned=new Set(),batches=new Map();
  function material(name,base,opts={}){
    const m=new T.MeshStandardMaterial({roughness:.94,envMapIntensity:.58,...opts});
    owned.add(m);m.name='Estate stalls | '+name;
    if(base)for(const k of['map','normalMap','roughnessMap','aoMap'])if(base[k])m[k]=base[k];
    m.userData.patchMetres=base?.userData?.patchMetres||1.6;return m;
  }
  const sage=material('sage painted vertical boards',source('Ranch | weathered timber siding'),
    {color:'#d4d1be',roughness:1,normalScale:new T.Vector2(.24,.24)});
  sage.userData.timber=true;sage.userData.siding=true;applyTimberGrain(sage,T);
  const grain=sage.onBeforeCompile,pigment=new T.Color('#586d60').toArray().map(v=>v.toFixed(8)).join(',');
  sage.onBeforeCompile=function(shader,renderer){
    grain.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\nfloat estateStallGrain=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.0,0.0,1.0);\n'+
      'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+pigment+')*(.82+.18*estateStallGrain),.94);');
  };
  sage.customProgramCacheKey=()=> 'estate-open-stall-sage-v1';
  const oak=material('smoked oak posts and joinery',source('Ranch | oiled oak doors'),{color:'#a18a6e',roughness:.88});
  oak.userData.timber=true;applyTimberGrain(oak,T);
  const cream=material('warm painted roof fascia',source('Ranch | warm painted joinery'),
    {color:'#d5ceb6',normalScale:new T.Vector2(.16,.16)});
  const limestone=material('buff limestone feet and plinth',source('Ranch | dressed limestone'),
    {color:'#bab29d',roughness:.97,normalScale:new T.Vector2(.30,.30)});
  const slate=material('aged blue slate',source('Village | blue grey slate'),
    {color:'#89989d',roughness:.97,normalScale:new T.Vector2(.56,.56)});
  const iron=material('forged iron bars and rainwater goods',null,{color:'#293330',roughness:.62,metalness:.66});
  const glass=material('recessed live evening window',null,{color:'#718780',roughness:.24,metalness:.35,envMapIntensity:1.1,emissiveIntensity:.70});
  if(interior)glass.emissive=interior.color;
  const Y=new T.Vector3(0,1,0);let parts=0,roofReceipt=null;
  function add(g,m,matrix){
    g.applyMatrix4(matrix);let batch=batches.get(m);
    if(!batch){batch={p:[],n:[],u:[],i:[]};batches.set(m,batch);}
    const offset=batch.p.length/3;
    for(const v of g.attributes.position.array)batch.p.push(v);
    for(const v of g.attributes.normal.array)batch.n.push(v);
    for(const v of g.attributes.uv.array)batch.u.push(v);
    if(g.index)for(const i of g.index.array)batch.i.push(i+offset);
    else for(let i=0;i<g.attributes.position.count;i++)batch.i.push(i+offset);
    parts++;g.dispose();
  }
  function box(w,h,d,m,x=0,y=0,z=0,rotation=null,{roof=false}={}){
    const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,
      patch=m.userData.patchMetres||1.6;
    for(let i=0;i<p.count;i++){
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
      u.setXY(i,(roof&&ny>.5?p.getZ(i)+z:nx>.5?p.getZ(i)+z:p.getX(i)+x)/patch,
        (ny>.5?(roof?p.getX(i)+x:p.getZ(i)+z):p.getY(i)+y)/patch);
    }
    if(m.userData.timber){
      setTimberBoxUV(g,{width:w,height:h,depth:d,x,y,z,siding:!!m.userData.siding,lengthMetres:2.4});
      if(m===sage)dressTimberBox(T,g,{width:w,height:h,depth:d,x,y,z,radius:.003,siding:true,lengthMetres:2.4});
    }
    if(roof){
      roofReceipt=dressRoofCoverBox(T,g,{width:w,height:h,depth:d,axis:'x',downSlope:1,style:'slate'});
      // Row spacing is3.3 m, while the retained roof envelope is3.5 m. A
      // recessed 200 mm underlap avoids two coplanar top/underside surfaces
      // where the next repeated roof covers this negative-Z end. Compression
      // stays inside the original thickness, slope and footprint.
      // Clip every original triangle at both lap boundaries first. This keeps
      // its 20 mm transition localized even on the four-corner underside.
      const oldP=g.attributes.position,oldU=g.attributes.uv,ix=g.index,P=[],U=[],I=[];
      const clip=(poly,z,keepGreater)=>{
        const out=[];
        for(let i=0;i<poly.length;i++){
          const a=poly[i],b=poly[(i+1)%poly.length],insideA=keepGreater?a[2]>=z:a[2]<=z,insideB=keepGreater?b[2]>=z:b[2]<=z;
          if(insideA)out.push(a);
          if(insideA!==insideB){const t=(z-a[2])/(b[2]-a[2]);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
        }
        return out;
      };
      for(let i=0;i<ix.count;i+=3){
        const triangle=[0,1,2].map(k=>{const j=ix.getX(i+k);return[oldP.getX(j),oldP.getY(j),oldP.getZ(j),oldU.getX(j),oldU.getY(j)];});
        for(const[low,high]of[[-Infinity,-1.55],[-1.55,-1.53],[-1.53,Infinity]]){
          let poly=triangle;if(Number.isFinite(low))poly=clip(poly,low,true);if(Number.isFinite(high)&&poly.length)poly=clip(poly,high,false);
          if(poly.length<3)continue;const offset=P.length/3;
          for(const p of poly){P.push(p[0],p[1],p[2]);U.push(p[3],p[4]);}
          for(let k=1;k<poly.length-1;k++){
            const a=poly[0],b=poly[k],c=poly[k+1],ab=b.slice(0,3).map((v,j)=>v-a[j]),ac=c.slice(0,3).map((v,j)=>v-a[j]),
              area=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);
            if(area>1e-12)I.push(offset,offset+k,offset+k+1);
          }
        }
      }
      g.setIndex(I);g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));
      g.deleteAttribute('normal');
      const rp=g.attributes.position;
      for(let i=0;i<rp.count;i++){
        const amount=Math.max(0,Math.min(1,(-1.53-rp.getZ(i))/.02)),yy=rp.getY(i);
        if(amount)rp.setY(i,yy+(.006-(yy+h/2)/h*.031)*amount);
      }
      g.computeVertexNormals();
    }
    const q=rotation instanceof T.Quaternion?rotation:new T.Quaternion().setFromEuler(rotation||new T.Euler());
    add(g,m,new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1)));
  }
  function beam(a,b,width,depth,m=oak){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p),mid=p.clone().add(q).multiplyScalar(.5);
    box(width,v.length(),depth,m,mid.x,mid.y,mid.z,new T.Quaternion().setFromUnitVectors(Y,v.normalize()));
  }
  function pipe(a,b,r,m=iron){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);
    add(new T.CylinderGeometry(r,r,v.length(),8),m,new T.Matrix4().compose(p.clone().add(q).multiplyScalar(.5),
      new T.Quaternion().setFromUnitVectors(Y,v.normalize()),new T.Vector3(1,1,1)));
  }
  const frontX=-.9,backX=.9,halfZ=1.6,windowBottom=.995,windowTop=1.845,windowHalf=.53;
  // Each narrow rear board stops at the same real window opening as the old
  // wall. The limestone strip remains on its original .24 x 3.23 footprint.
  const rearCuts=[-halfZ,-windowHalf,windowHalf,halfZ];
  for(let i=0;i<rearCuts.length-1;i++){
    const left=rearCuts[i],right=rearCuts[i+1],count=Math.ceil((right-left)/.185),pitch=(right-left)/count,
      intervals=i===1?[[.15,windowBottom],[windowTop,2.3]]:[[.15,2.3]];
    for(const[low,high]of intervals)for(let k=0;k<count;k++){
      const z=left+(k+.5)*pitch;
      // Thin genuine board gaps add contact edges without opaque extra walls.
      box(.18,high-low,pitch-.003,sage,backX,(low+high)/2,z);
    }
  }
  box(.24,.15,3.23,limestone,backX,.075,0);
  for(let k=0;k<8;k++){
    const z=-1.413+k*.404;
    box(.244,.014,.007,limestone,backX,.15,z);
  }
  // Recessed window: an opaque pane 184 mm behind the outer wall face. Real
  // wood jambs and sill expose depth from both the horse bay and the rear lane.
  box(.018,.74,.95,glass,.797,1.42,0);
  for(const s of[-1,1]){
    box(.23,.90,.065,oak,.895,1.42,s*(windowHalf-.012));
    box(.23,.067,1.17,oak,.895,1.42+s*.43,0);
  }
  box(.045,.74,.030,cream,.837,1.42,0);
  box(.045,.030,.95,cream,.837,1.40,0);
  box(.29,.090,1.27,limestone,.925,.935,0);
  box(.20,.024,1.23,iron,.945,1.905,0);

  for(const s of[-1,1]){
    const z=s*halfZ;
    // The partitions remain half boarded and half open. Narrow boards, a
    // mortised oak frame and round iron bars read as working stable joinery.
    for(let k=0;k<10;k++)box(.178,.52,.085,sage,-.81+k*.18,.46,z);
    for(const y of[.79,1.48,2.26])box(1.9,.105,.12,oak,0,y,z);
    for(let k=0;k<9;k++)pipe([-.72+k*.18,.845,z],[-.72+k*.18,1.425,z],.012);
    box(1.8,.055,.11,oak,0,.185,z);
    for(const x of[frontX,backX]){
      const top=x<0?2.58:2.38;
      box(.145,top-.15,.145,oak,x,(top+.15)/2,z);
      box(.19,.17,.19,limestone,x,.085,z);
      box(.15,.030,.15,iron,x,.184,z);
      box(.155,.12,.018,iron,x,top-.18,z-s*.079);
      for(const dx of[-.041,.041])box(.018,.018,.024,iron,x+dx,top-.18,z-s*.084);
    }
    // Retain the old front braces and head clearance rather than closing the
    // entrance with a new gate or a full-height front facade.
    beam([frontX,2.12,z],[frontX+.35,2.54,z],.075,.075);
    beam([frontX,2.12,z],[frontX,2.52,z-s*.38],.075,.075);
    for(const x of[-.48,.42])box(.095,.025,.148,iron,x,1.54,z);
  }
  box(.13,.16,3.26,oak,frontX,2.50,0);
  box(.12,.13,3.24,oak,backX,2.33,0);
  // Small under-roof rafters sit above the existing header and side rail,
  // clear of the horse bay. Every top corner retains the old mono-pitch roof.
  const angle=-.12,roofX=.1,roofY=2.55,roofW=2.6,roofD=3.5,
    slope=new T.Euler(0,0,angle),roofHalfX=Math.cos(angle)*roofW/2;
  for(const z of[-1.13,0,1.13])box(2.32,.055,.065,oak,.1,2.435,z,slope);
  box(roofW,.14,roofD,slate,roofX,roofY,0,slope,{roof:true});
  for(const s of[-1,1]){
    box(roofW+.04,.14,.10,cream,roofX,roofY-.025,s*(roofD/2+.012),slope);
    const x=roofX+s*roofHalfX,y=roofY+s*Math.sin(angle)*roofW/2;
    box(.105,.17,roofD+.12,cream,x,y-.035,0);
  }
  const gutterX=roofX+roofHalfX+.07,gutterY=roofY+Math.sin(angle)*roofW/2-.145;
  box(.13,.023,roofD+.07,iron,gutterX,gutterY,0);
  for(const s of[-1,1])box(.018,.066,roofD+.07,iron,gutterX+s*.059,gutterY+.028,0);
  const drainZ=-halfZ+.14;
  pipe([gutterX,gutterY,drainZ],[gutterX,gutterY-.19,drainZ],.029);
  pipe([gutterX,gutterY-.19,drainZ],[backX+.13,gutterY-.38,drainZ],.029);
  pipe([backX+.13,gutterY-.38,drainZ],[backX+.13,.16,drainZ],.029);

  const finished=[];let triangles=0,bytes=0;
  for(const[m,b]of batches){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setIndex(b.i);
    g.computeBoundingBox();g.computeBoundingSphere();triangles+=b.i.length/3;
    bytes+=(b.p.length+b.n.length+b.u.length)*4+g.index.array.byteLength;
    finished.push({geometry:g,material:m});
  }
  let disposed=false;
  return{batches:finished,metadata:{version:'estate-open-stalls-1',drawCalls:finished.length,triangles,geometryBytes:bytes,
    batchedParts:parts,sharedResources:true,roofCenter:[.1,2.55,0],roofRotationZ:angle,
    physicalSlateCourses:roofReceipt?.rows||0,roofReceipt,openFrontX:frontX,
    repeatedRoofUnderlap:{edge:'negativeZ',width:.20,transition:.02,upperRecess:.025,undersideLift:.006,rowStep:3.3},
    window:{centerY:1.42,width:1.06,height:.85,outerFaceX:.99,paneFrontX:.806}},
    dispose(){if(disposed)return;disposed=true;for(const{geometry}of finished)geometry.dispose();for(const m of owned)m.dispose();}};
}
