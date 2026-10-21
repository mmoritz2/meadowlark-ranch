import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
// Original regional machinery. The gameplay roots and their old construction
// sequence survive; only selected static surfaces or dynamic root children change.
export const WORKSHOP_PROFILE='regional-workshops-1';
let factoryEpoch=0;
function random(key){let s=2166136261;for(let i=0;i<key.length;i++)s=Math.imul(s^key.charCodeAt(i),16777619);return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
// Shared arithmetic-only cap relief closes on the exact original bark polygon.
// No original bark position, normal, UV, colour or index is rewritten.
export function appendAmberwoodLogEnds({position:p,uv,color,index:ix,segments:S,bodyRings:R}){
 const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 if(S!==24||R!==5||p.length!==450||ix.length!==720)throw Error('Original shared workshop log body required');
 const stations=[.065,.12,.175,.23,.285,.34,.395,.45,.505,.56,.615,.67,.845,.925],startIndices=ix.length,ends=[];
 for(const side of[-1,1]){
  const row=side<0?0:R,centerY=.006*Math.sin(row*1.3),centerZ=.006*Math.cos(row*.9);
  const sectors=side<0?[2,9,18]:[3,8,19],checks=[{a:sectors[0]/S*TAU,lo:.18,hi:.87},{a:sectors[1]/S*TAU,lo:.33,hi:.71},{a:sectors[2]/S*TAU,lo:.09,hi:.92}];
  const angles=Array.from({length:S},(_,j)=>j/S*TAU),N=angles.length,firstVertex=p.length/3,firstIndex=ix.length;
  let minInset=Infinity,maxInset=0;
  const detail=(r,a)=>{
   const latewood=.5+.5*Math.cos(r*Math.PI/.055+.28*Math.sin(3*a+side*.4)+.12*Math.sin(7*a));
   let check=0;for(const c of checks){const d=Math.atan2(Math.sin(a-c.a),Math.cos(a-c.a));check=Math.max(check,Math.exp(-Math.pow(d/.014,2))*smooth((r-c.lo)/.09)*(1-smooth((r-c.hi)/.06)));}
   const sapwood=smooth((r-.86)/.065),inset=.0026+.0013*latewood+.0042*check+.002*sapwood;
   return{inset,light:Math.max(.45,.98-.12*latewood-.30*check-.22*sapwood)};
  };
  const put=(r,a,boundary=false)=>{
   const q=a/TAU*S,j=Math.min(S-1,Math.floor(q)),f=q-j,k=(row*(S+1)+j)*3,l=k+3;
   const y=p[k+1]+(p[l+1]-p[k+1])*f,z=p[k+2]+(p[l+2]-p[k+2])*f;
   const rho=r*(1+.024*Math.sin(3*a+side*.2)*Math.sin(Math.PI*r)+.009*Math.sin(7*a+1.1)*Math.sin(Math.PI*r)),d=detail(r,a),inset=boundary?0:d.inset;
   const id=p.length/3,yy=centerY+(y-centerY)*rho,zz=centerZ+(z-centerZ)*rho;
   p.push(side*(.5-inset),yy,zz);uv.push(.5+yy*.5,.5+zz*.5);
   const v=boundary?.64:d.light;color.push(v,v*(boundary?.953:.985),v*(boundary?.844:.945));
   minInset=Math.min(minInset,inset);maxInset=Math.max(maxInset,inset);return id;
  };
  const triangle=(a,b,c)=>{if(side<0)ix.push(a,c,b);else ix.push(a,b,c);};
  const center=p.length/3,d=detail(0,0);p.push(side*(.5-d.inset),centerY,centerZ);uv.push(.5+centerY*.5,.5+centerZ*.5);color.push(d.light,d.light*.985,d.light*.945);
  minInset=Math.min(minInset,d.inset);maxInset=Math.max(maxInset,d.inset);
  // Twelve vertices suffice at the tiny pith ring; all other rings retain
  // every original angular sector. This saves 48 faces without losing a ridge.
  const rings=stations.map((r,k)=>(k===0?angles.filter((_,j)=>j%2===0):angles).map(a=>put(r,a))),H=N/2;
  for(let j=0;j<H;j++)triangle(center,rings[0][j],rings[0][(j+1)%H]);
  for(let j=0;j<H;j++){const A=rings[0][j],B=rings[0][(j+1)%H],o=rings[1],k=j*2;triangle(A,o[k],o[(k+1)%N]);triangle(A,o[(k+1)%N],o[(k+2)%N]);triangle(A,o[(k+2)%N],B);}
  for(let k=1;k<rings.length-1;k++)for(let j=0;j<N;j++){const n=(j+1)%N;triangle(rings[k][j],rings[k+1][j],rings[k+1][n]);triangle(rings[k][j],rings[k+1][n],rings[k][n]);}
  const outside=Array.from({length:S},(_,j)=>put(1,j/S*TAU,true)),last=rings.at(-1);
  for(let j=0;j<S;j++){const n=(j+1)%S;triangle(outside[j],outside[n],last[n]);triangle(outside[j],last[n],last[j]);}
  ends.push({side,vertices:p.length/3-firstVertex,triangles:(ix.length-firstIndex)/3,angularStations:N,pithAngularStations:H,radialStations:stations.length,checks:checks.length,minInset,maxInset});
 }
 return{profile:'amberwood-log-ends-2',bodyVertices:150,bodyTriangles:240,capTriangles:(ix.length-startIndices)/3,axialEnvelope:[-.5,.5],ends};
}
export function createRegionalWorkshopArt({G,onStaticTowerReady=null}){
 const T=G.THREE,W=G.world,materials=W.ranchBuilderArt.materials,A=W.ranchArchitecture;
 const factory=++factoryEpoch;let epoch=0;const pending=[],stats={profile:WORKSHOP_PROFILE,static:[],dynamic:[],logBatches:[],barkReady:false,textureAllocations:0};
 const visual=(key,make)=>{const prior=Math.random;Math.random=random('regional-workshop|'+factory+'|'+key+'|'+(++epoch));try{return make();}finally{Math.random=prior;}};
 class Kit{
  constructor(name,captureCameraParts=false){this.root=new T.Group();this.root.name=name;this.parts=new Map();this.cameraParts=captureCameraParts?[]:null;}
  add(g,m,x=0,y=0,z=0,rotation=null){if(!g.index){const ix=Array.from({length:g.attributes.position.count},(_,i)=>i);g.setIndex(ix);}const q=new T.Quaternion();if(rotation)q.setFromEuler(new T.Euler(...rotation));const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1));const list=this.parts.get(m)||[];if(this.cameraParts)this.cameraParts.push({material:m,firstVertex:list.reduce((n,p)=>n+p.attributes.position.count,0),vertexCount:g.attributes.position.count,matrix:matrix.toArray()});g.applyMatrix4(matrix);g.userData.workshopUV=true;list.push(g);this.parts.set(m,list);}
  box(w,h,d,m,x=0,y=0,z=0,rotation=null){const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,k=m.userData?.patchMetres||m.userData?.metres||1.8;
   const along=h>w&&h>d?1:d>w?2:0;for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)],normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))],face=normal[1]>normal[0]&&normal[1]>normal[2]?1:normal[0]>normal[2]?0:2;if(m.userData?.quarterSurface?.role==='timber'||/timber|oak/.test(m.name)){const other=[0,1,2].filter(a=>a!==along),across=normal[other[0]]>normal[other[1]]?other[1]:other[0];u.setXY(i,(v[along]+[x,y,z][along])/k,.5+Math.floor(x*7+y*11+z*13)+(v[across]/Math.max(.04,[w,h,d][across]))*.44);}else{const axes=face===1?[0,2]:face===0?[2,1]:[0,1];u.setXY(i,v[axes[0]]/k,v[axes[1]]/k);}}this.add(g,m,x,y,z,rotation);}
  beam(a,b,w,d,m){const p=new T.Vector3(...a),q=new T.Vector3(...b),mid=p.clone().add(q).multiplyScalar(.5),e=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),q.clone().sub(p).normalize()));this.box(w,p.distanceTo(q),d,m,...mid.toArray(),[e.x,e.y,e.z]);}
  pipe(r,h,m,x=0,y=0,z=0,rotation=null,sides=24){this.add(new T.CylinderGeometry(r,r,h,sides),m,x,y,z,rotation);}
  ring(outer,inner,depth,m,z=0,sides=64){const p=[],u=[],ix=[];for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;for(const [r,zz]of[[outer,-depth/2],[outer,depth/2],[inner,depth/2],[inner,-depth/2]]){p.push(Math.cos(a)*r,Math.sin(a)*r,zz+z);u.push(j/sides*Math.PI*2*outer,zz*4);}}for(let j=0;j<sides;j++)for(let side=0;side<4;side++){const a=j*4+side,b=j*4+(side+1)%4,c=a+4,d=b+4;ix.push(a,c,b,b,c,d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(u,2));g.setIndex(ix);g.computeVertexNormals();this.add(g,m);}
  finish(meta={}){for(const[m,list]of this.parts){const g=mergeGeometries(list,false);list.forEach(p=>p.dispose());g.userData.workshopUV=true;g.computeBoundingBox();g.computeBoundingSphere();const mesh=new T.Mesh(g,m);mesh.name=this.root.name+' | '+m.name;mesh.castShadow=!m.transparent;mesh.receiveShadow=true;this.root.add(mesh);}let triangles=0,bytes=0;this.root.traverse(o=>{if(!o.isMesh)return;triangles+=o.geometry.index.count/3;bytes+=o.geometry.index.array.byteLength+Object.values(o.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0);});this.root.userData.workshopArt={profile:WORKSHOP_PROFILE,draws:this.root.children.length,triangles,geometryBytes:bytes,...meta};return this.root;}
 }
 const surfaces=visual('surfaces',()=>{
  const bark=new T.MeshStandardMaterial({name:'Workshop | brown furrowed bark',color:'#9e8260',roughness:1,metalness:0,vertexColors:true,envMapIntensity:.45});
  const end=new T.MeshStandardMaterial({name:'Workshop | warm sawn endgrain',color:'#bba176',roughness:1,metalness:0,vertexColors:true,envMapIntensity:.4});
  end.onBeforeCompile=sh=>{sh.vertexShader='varying vec2 logCutUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlogCutUV=uv;');sh.fragmentShader='varying vec2 logCutUV;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 cut=(logCutUV-.5)*2.0+vec2(.046,-.031);float cutR=length(cut),cutA=atan(cut.y,cut.x);float rings=sin(cutR*87.0+.53*sin(cutA*5.0)+.35*sin(cutR*19.0));float latewood=1.0-smoothstep(.08,.27,abs(rings+.20));float grain=fract(sin(dot(floor(cut*230.0),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=.91+grain*.08-latewood*.11;`);};end.customProgramCacheKey=()=> 'regional-sawn-endgrain-1';
  return{bark,end};
 });
 // Borrow the already resident brown-bark photographs. No new texture, fetch,
 // decode or constructor occurs after the promise; the initial logs stay brown.
 const borrowBark=()=>{if(stats.barkReady)return;const root=G.photoscans?.thunderOak?.root;let source=null;root?.traverse(o=>{if(o.isMesh&&o.material.name==='Thunder Oak | furrowed bark')source=o.material;});if(!source?.map)return;for(const key of['map','normalMap','roughnessMap'])surfaces.bark[key]=source[key];surfaces.bark.normalScale.set(.42,.42);surfaces.bark.needsUpdate=true;stats.barkReady=true;};
 borrowBark();Promise.resolve().then(()=>{borrowBark();G.photoscans?.ready?.then(borrowBark,()=>{});});
 const logGeometry=visual('shared-logs',()=>{const p=[],uv=[],color=[],ix=[],S=24,R=5;for(let k=0;k<=R;k++){const x=-.5+k/R;for(let j=0;j<=S;j++){const a=j/S*Math.PI*2,rad=.955+.022*Math.sin(a*5+k*.67)+.011*Math.sin(a*11-k*.37),cy=.006*Math.sin(k*1.3),cz=.006*Math.cos(k*.9);p.push(x,Math.cos(a)*rad+cy,Math.sin(a)*rad+cz);uv.push(j/S*Math.PI*2*.28,k/R*4.8);const light=.90+.08*Math.sin(a*3+k*.7);color.push(light,light,light);if(k<R&&j<S){const b=k*(S+1)+j,c=b+S+1;ix.push(b,b+1,c,b+1,c+1,c);}}}const bodyCount=ix.length;
  const capRelief=appendAmberwoodLogEnds({position:p,uv,color,index:ix,segments:S,bodyRings:R});
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(ix);g.addGroup(0,bodyCount,0);g.addGroup(bodyCount,ix.length-bodyCount,1);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.workshopArt={profile:WORKSHOP_PROFILE,kind:'worked-log',triangles:ix.length/3,geometryBytes:g.index.array.byteLength+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),capRelief};return g;
 });
 function mill(){const b=new Kit('Amberwood | boarded sawmill'),wall=A.sidingMaterial,wood=materials.aged,oak=materials.oak,roof=A.roofMaterial,iron=materials.iron,dark=A.materials.get('Ranch | window recess'),w=6.8,d=4.8,base=1.1,h=3.6,eave=4.7,ridge=6.2;
  const panel=(width,x,z,yaw,openings)=>{const local=new Kit('Mill | wall');const xs=[-width/2,width/2,...openings.flatMap(o=>[o.x-o.w/2,o.x+o.w/2])].sort((a,b)=>a-b);for(let j=0;j<xs.length-1;j++){const lo=xs[j],hi=xs[j+1],mid=(lo+hi)/2,o=openings.find(o=>mid>o.x-o.w/2&&mid<o.x+o.w/2);const segments=o?[[base,o.y-o.h/2],[o.y+o.h/2,eave]]:[[base,eave]];for(const[a,c]of segments)if(c-a>.005){local.box(hi-lo,c-a,.14,wall,mid,(a+c)/2,0);for(let u=Math.ceil(lo/.25)*.25;u<hi-.02;u+=.25)if(u>lo+.02)local.box(.035,c-a,.021,wall,u,(a+c)/2,.081);}}
   for(const o of openings){for(const s of[-1,1])local.box(.085,o.h+.15,.22,oak,o.x+s*(o.w/2+.026),o.y,.02);local.box(o.w+.23,.095,.24,oak,o.x,o.y+o.h/2+.035,.03);if(!o.door){local.box(o.w+.25,.08,.29,oak,o.x,o.y-o.h/2-.035,.04);local.box(o.w-.03,o.h-.03,.025,dark,o.x,o.y,-.12);for(const s of[-1,1])local.box(.025,o.h-.06,.048,iron,o.x+s*o.w*.20,o.y,-.015);local.box(o.w-.04,.035,.06,oak,o.x,o.y,-.005);}}
   const root=local.finish();root.position.set(x,0,z);root.rotation.y=yaw;root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh)b.add(o.geometry.clone(),o.material,0,0,0);});// Rebuild the newly appended geometries using this wall's exact frame.
   for(const child of root.children){const list=b.parts.get(child.material),g=list[list.length-1];g.applyMatrix4(root.matrixWorld);}root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  };
  panel(w,0,d/2,0,[{x:0,y:base+1.15,w:1.6,h:2.3,door:true},...[-2.45,2.45].map(x=>({x,y:3.02,w:.84,h:1.12}))]);panel(w,0,-d/2,Math.PI,[-1.7,1.7].map(x=>({x,y:3.03,w:1.14,h:1.20})));for(const s of[-1,1])panel(d,s*w/2,0,s*Math.PI/2,[{x:0,y:3.05,w:1.30,h:1.12}]);
  for(const x of[-w/2,w/2]){const g=new T.BufferGeometry(),p=[x-.07,eave,-d/2,x-.07,eave,d/2,x-.07,ridge,0,x+.07,eave,-d/2,x+.07,eave,d/2,x+.07,ridge,0];g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,d/1.8,0,d/3.6,1.5/1.8,0,0,d/1.8,0,d/3.6,1.5/1.8],2));g.setIndex([0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5]);g.computeVertexNormals();b.add(g,wall);}
  const half=2.7,rise=1.5,slope=Math.hypot(half,rise),pitch=Math.atan2(rise,half);for(const s of[-1,1]){b.box(7.4,.13,slope,roof,0,eave+rise/2,s*half/2,[s*pitch,0,0]);b.box(7.5,.16,.105,oak,0,eave-.025,s*half);b.box(7.42,.025,.12,iron,0,eave-.115,s*(half+.03));}b.box(7.52,.13,.24,roof,0,ridge+.05,0);
  for(const x of[-3.43,3.43])for(const z of[-2.43,2.43])b.box(.135,h,.135,oak,x,base+h/2,z);for(const x of[-3.4,-1.7,0,1.7,3.4])for(const s of[-1,1])b.beam([x,4.60,s*2.35],[x,6.03,0],.085,.12,wood);b.box(6.50,.035,4.5,wood,0,base+.018,0);
  return b.finish({kind:'sawmill-shell',width:6.8,depth:4.8,wallHeight:3.6,eave:4.7,ridge:6.2,base:1.1,doorWidth:1.6,doorHeight:2.3,windows:6});
 }
 function wheel(){const b=new Kit('Amberwood | bucket waterwheel'),wood=materials.aged,oak=materials.oak,iron=materials.iron;for(const z of[-.62,.62]){b.ring(2.58,2.25,.13,wood,z,64);b.ring(2.586,2.548,.045,iron,z,64);for(let j=0;j<8;j++){const a=j/8*Math.PI*2;b.beam([Math.cos(a)*.22,Math.sin(a)*.22,z],[Math.cos(a)*2.29,Math.sin(a)*2.29,z],.105,.07,oak);}}
  for(let j=0;j<24;j++){const a=j/24*Math.PI*2;b.box(.39,.085,1.47,oak,Math.cos(a)*2.22,Math.sin(a)*2.22,0,[0,0,a+Math.PI/2]);b.box(.07,.21,1.47,wood,Math.cos(a)*2.40,Math.sin(a)*2.40,0,[0,0,a]);}
  b.pipe(.16,1.7,iron,0,0,0,[Math.PI/2,0,0],32);for(const z of[-.73,.73])b.pipe(.29,.055,iron,0,0,z,[Math.PI/2,0,0],32);return b.finish({kind:'waterwheel',outerRadius:2.586,axleDepth:1.7,buckets:24,pivot:[0,0,0]});
 }
 function tank(){const b=new Kit('Ochre | open stave water tank'),wood=materials.aged,iron=materials.iron,oak=materials.oak,N=48,y0=3.37,y1=7.04;for(let j=0;j<N;j++){const a=j/N*Math.PI*2,c=(j+1)/N*Math.PI*2,g=new T.BufferGeometry(),p=[],u=[],ix=[],r0=1.96,r1=2.05;for(const y of[y0,y1])for(const[r,angle]of[[r0,a+.0015],[r1,a+.0015],[r1,c-.0015],[r0,c-.0015]]){p.push(Math.sin(angle)*r,y,Math.cos(angle)*r);u.push((y-y0)/1.8,j+.5+(angle-a)/(c-a)*.40);}for(const face of[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])ix.push(face[0],face[1],face[2],face[0],face[2],face[3]);g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(u,2));g.setIndex(ix);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();b.add(flat,wood);}
  for(const y of[3.51,4.24,5.24,6.25,6.91])b.add(new T.TorusGeometry(2.073,.031,6,64),iron,0,y,0,[Math.PI/2,0,0]);b.add(new T.TorusGeometry(2.105,.055,6,64),oak,0,6.985,0,[Math.PI/2,0,0]);b.pipe(1.96,.07,wood,0,3.405,0,null,48);return b.finish({kind:'water-tank',staves:48,bottom:3.37,top:7.04,outerRadius:2.16,innerRadius:1.96,waterLevel:6.88,openTop:true});
 }
 function fan(){const b=new Kit('Ochre | pitched windpump rotor'),iron=materials.iron,steel=materials.steel,N=14,R=8,C=3;for(let j=0;j<N;j++){const p=[],uv=[],ix=[],a=j/N*Math.PI*2;for(let k=0;k<=R;k++){const s=k/R,r=1.08+s*.92;for(let c=0;c<=C;c++){const u=c/C,angle=a-.15+u*.30+s*.075,z=-.105*Math.sin(u*Math.PI)*(.25+.75*s)-.055*(u-.5)*s;p.push(Math.cos(angle)*r,Math.sin(angle)*r,z);uv.push(u*.50,s*.96);if(k<R&&c<C){const n=k*(C+1)+c;ix.push(n,n+C+1,n+1,n+1,n+C+1,n+C+2);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const back=g.clone();back.setIndex(Array.from(g.index.array).map((v,i,a)=>i%3===1?a[i+1]:i%3===2?a[i-1]:v));back.computeVertexNormals();b.add(g,steel);b.add(back,steel);b.beam([Math.cos(a)*.22,Math.sin(a)*.22,-.035],[Math.cos(a+.075)*1.94,Math.sin(a+.075)*1.94,-.035],.035,.045,iron);}
  b.pipe(.18,.55,iron,0,0,-.24,[Math.PI/2,0,0],32);b.pipe(.105,.06,steel,0,0,.005,[Math.PI/2,0,0],32);return b.finish({kind:'windpump-rotor',blades:14,outerRadius:2.00,curved:true,pivot:[0,0,0]});
 }
 function towerBraces(root){const b=new Kit('Ochre | tower cross braces',!!onStaticTowerReady);const f=y=>1.5+( .45-1.5)*(y/7.8);for(let k=0;k<3;k++){const y0=.28+k*2.50,y1=Math.min(7.55,y0+2.42);for(const[ax,az,bx,bz]of[[-1,-1,1,-1],[1,-1,1,1],[1,1,-1,1],[-1,1,-1,-1]])for(const swap of[false,true])b.beam([ax*f(swap?y1:y0),swap?y1:y0,az*f(swap?y1:y0)],[bx*f(swap?y0:y1),swap?y0:y1,bz*f(swap?y0:y1)],.055,.07,materials.aged);}const bracesRoot=b.finish({kind:'windpump-bracing'});root.add(bracesRoot);return{bracesRoot,braceParts:b.cameraParts};}
 const queue=(root,kind)=>{pending.push({root,kind,done:false});};
 function prepareBake(root){const jobs=pending.filter(j=>!j.done&&(()=>{let p=j.root;while(p&&p!==root)p=p.parent;return p===root;})());if(!jobs.length)return null;let count=0;const mats=new Set();root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&o.geometry.index&&o.geometry.attributes.normal&&o.geometry.attributes.uv){count++;mats.add(o.material);}});const legacyDraws=count*4+mats.size*8;
  visual('static-upgrade',()=>{for(const job of jobs){const g=job.root;if(job.kind==='mill'){for(const child of g.children.slice(2,12))g.remove(child);g.add(mill());}if(job.kind==='tank'){for(const child of g.children.slice(9,19))g.remove(child);g.add(tank());}if(job.kind==='tower'){const source=towerBraces(g);if(onStaticTowerReady)try{onStaticTowerReady({root:g,...source});}catch(error){(stats.cameraAdmissionErrors??=[]).push({kind:'tower',message:String(error?.message||error),rollbackClaimed:false});}}job.done=true;job.root=null;stats.static.push({...g.children[g.children.length-1].userData.workshopArt,kind:job.kind,position:g.position.toArray(),yaw:g.rotation.y});}});for(let i=pending.length-1;i>=0;i--)if(pending[i].done)pending.splice(i,1);return{legacyDraws,legacyMeshes:count,legacyMaterials:mats.size};
 }
 function legacyBake(token,make){const result=visual('static-bake',make);for(let i=0;i<token.legacyDraws;i++)Math.random();return result;}
 function upgradeDynamic(root,kind){visual('dynamic-'+kind,()=>{const art=kind==='wheel'?wheel():fan();root.clear();for(const o of[...art.children])root.add(o);root.userData.workshopArt=art.userData.workshopArt;stats.dynamic.push({kind,...art.userData.workshopArt});});return root;}
 function logItems(items){return items.map(o=>{const c=new T.Color(o.c||'#ffffff'),v=.86+.12*Math.max(c.r,c.g,c.b);return{...o,c:new T.Color(v,v,v)};});}
 return{queue,prepareBake,legacyBake,upgradeDynamic,logGeometry,logMaterials:[surfaces.bark,surfaces.end],logItems,stats};
}
// QA camera proposals use actual relocated construction roots and real pond/
// collider data. They do not move the camera/player or allocate Three objects.
export function proposeWorkshopCameras(G){
 const W=G.world,P=G.quartersPkg,stats=P?.workshops,results=[];
 for(const[kind,name,offsets]of[['mill','Amberwood sawmill',[[-18,-10],[-20,-14],[-14,-20],[-25,-8],[18,-12]]],['tower','Ochre tank and windpump',[[-18,10],[-22,8],[-20,14],[18,12],[-24,-6]]]]){
  const site=stats?.static.find(s=>s.kind===kind);if(!site)continue;const[x,y,z]=site.position,c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  for(const[dx,dz]of offsets){const cx=x+dx*c+dz*s,cz=z-dx*s+dz*c,ponds=P.ponds||[],clearance=ponds.reduce((v,p)=>Math.min(v,Math.hypot(cx-p.x,cz-p.z)-p.r),Infinity),solid=(W.colliders||[]).filter(p=>Number.isFinite(p.r)).reduce((v,p)=>Math.min(v,Math.hypot(cx-p.x,cz-p.z)-p.r),Infinity);if(clearance<2||solid<1.2)continue;const look=kind==='tower'?stats.static.find(s=>s.kind==='tank')?.position:null;results.push({name,position:[cx,W.groundH(cx,cz)+3.8,cz],lookAt:look?[ (x+look[0])/2,Math.max(y,look[1])+5,(z+look[2])/2]:[x,y+3.3,z],source:{kind,position:site.position,yaw:site.yaw},pondClearanceM:Number.isFinite(clearance)?clearance:null,colliderClearanceM:Number.isFinite(solid)?solid:null});break;}
 }
 return results;
}
