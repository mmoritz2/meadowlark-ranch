// Original desert plants. Geometry and colours use only a local deterministic hash.
// No alpha cards: ribbed cactus columns, folded agave leaves and woody ocotillo canes.
export function createDesertArt({THREE:T}) {
 const TAU=Math.PI*2,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),hash=(i,s=0)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
 const mat=new T.MeshStandardMaterial({name:'Desert | botanical surfaces',vertexColors:true,roughness:.88,metalness:0,side:T.DoubleSide,envMapIntensity:.45});
 const templates=new Map(),c=new T.Color();
 class Writer {
  constructor(){this.p=[];this.c=[];this.u=[];this.i=[];this.areoles=0;this.leaves=0;this.canes=0;}
  vertex(p,hex,shade=1,u=0,v=0){this.p.push(...p);c.set(hex).multiplyScalar(shade);this.c.push(c.r,c.g,c.b);this.u.push(u,v);return this.p.length/3-1;}
  triangle(a,b,d,hex){const i=this.vertex(a,hex);this.vertex(b,hex);this.vertex(d,hex);this.i.push(i,i+1,i+2);}
  needle(base,tip,width,hex){const a=V(...base),b=V(...tip),axis=b.clone().sub(a).normalize(),side=axis.clone().cross(V(0,1,.31)).normalize().multiplyScalar(width);
   this.triangle(a.clone().add(side).toArray(),b.toArray(),a.clone().sub(side).toArray(),hex);
   const side2=axis.clone().cross(side).normalize().multiplyScalar(width);this.triangle(a.clone().add(side2).toArray(),b.toArray(),a.clone().sub(side2).toArray(),hex);}
  column(points,radius,{ribs=12,rings=16,seed=1,spines=true}={}){
   const curve=new T.CatmullRomCurve3(points.map(p=>V(...p))),sides=ribs*4,offset=this.p.length/3;
   const cap=Math.max(.60,1-radius/curve.getLength()),levels=Array.from({length:rings+1},(_,j)=>j/rings*cap).concat([.35,.65,.84,.95,1].map(t=>cap+(1-cap)*t));
   const frame=t=>{const center=curve.getPoint(t),tangent=curve.getTangent(t),right=tangent.clone().cross(V(0,0,1)).normalize(),forward=right.clone().cross(tangent).normalize();return {center,tangent,right,forward};};
   const skin=(a,t)=>radius*(.91+.09*Math.sin(t*Math.PI))*(1+.14*Math.cos(a*ribs))*(t>cap?Math.max(.008,Math.sqrt(Math.max(0,1-((t-cap)/(1-cap))**2))):1);
   for(let j=0;j<levels.length;j++)for(let k=0;k<=sides;k++){
    const t=levels[j],a=k/sides*TAU,f=frame(t),r=skin(a,t),p=f.center.clone().addScaledVector(f.right,Math.cos(a)*r).addScaledVector(f.forward,Math.sin(a)*r);
    const shade=.82+.13*(.5+.5*Math.cos(a*ribs))+.045*Math.sin(t*53+a*5+seed);
    this.vertex(p.toArray(),t<.11?'#787754':'#65764d',shade,k/sides,t);
    if(j<levels.length-1&&k<sides){const i=offset+j*(sides+1)+k;this.i.push(i,i+sides+1,i+1,i+1,i+sides+1,i+sides+2);}
   }
   // Seal the small end rings; even a nearly invisible hole breaks top raycasts.
   const bottom=this.vertex(curve.getPoint(0).toArray(),'#787754'),top=this.vertex(curve.getPoint(1).toArray(),'#65764d');
   for(let k=0;k<sides;k++){const a=offset+k,b=offset+(levels.length-1)*(sides+1)+k;this.i.push(a,a+1,bottom,b,top,b+1);}
   if(spines)for(let j=1;j<=13;j++)for(let k=0;k<ribs;k++){
    const t=.04+j/15*.84,a=k/ribs*TAU,f=frame(t),normal=f.right.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.forward,Math.sin(a));
    const at=f.center.clone().addScaledVector(normal,skin(a,t)+.0007),size=radius*.047;
    const side=f.tangent.clone().cross(normal).multiplyScalar(size),up=f.tangent.clone().multiplyScalar(size*1.6),tip=at.clone().addScaledVector(normal,size*.7);
    this.triangle(at.clone().sub(side).toArray(),at.clone().sub(up).toArray(),tip.toArray(),'#b7a27c');
    this.triangle(at.clone().add(side).toArray(),at.clone().add(up).toArray(),tip.toArray(),'#b7a27c');this.areoles++;
    for(const sign of[-1,1]){const end=at.clone().addScaledVector(normal,radius*.15).addScaledVector(f.tangent,sign*radius*.15);this.needle(at.toArray(),end.toArray(),radius*.006,'#ac9469');}
   }
  }
  blade({yaw,length,width,height,base=.015,seed=0,rows=7,color='#6c826b'}){
   const offset=this.p.length/3,side=V(Math.cos(yaw),0,-Math.sin(yaw)),out=V(Math.sin(yaw),0,Math.cos(yaw));
   for(let j=0;j<=rows;j++)for(let k=0;k<3;k++){
    const t=j/rows,v=k-1,taper=Math.max(.006,Math.pow(Math.sin(Math.PI*(.07+t*.93)),.7)),w=width*.5*taper;
    const distance=length*(.30*t+.70*t*t),lift=height*Math.sin(t*Math.PI*.57)-length*.10*t*t;
    const p=out.clone().multiplyScalar(distance).addScaledVector(side,v*w);p.y=base+lift-Math.abs(v)*w*.42;
    const dry=t>.84&&hash(seed,4)>.6;this.vertex(p.toArray(),dry?'#a79965':color,(k===1?1.04:.87)*(1-.1*t),k/2,t);
    if(j<rows&&k<2){const a=offset+j*3+k;this.i.push(a,a+3,a+1,a+1,a+3,a+4);}
   }
   this.leaves++;
  }
  cane(points,radius,seed,detail){
   const curve=new T.CatmullRomCurve3(points.map(p=>V(...p))),segments=detail?10:6,sides=5,offset=this.p.length/3;
   for(let j=0;j<=segments;j++)for(let k=0;k<=sides;k++){
    const t=j/segments,a=k/sides*TAU,p=curve.getPoint(t),r=radius*(1-t*.82);p.x+=Math.cos(a)*r;p.z+=Math.sin(a)*r;
    this.vertex(p.toArray(),'#756e50',.85+hash(k,seed)*.2,k/sides,t);
    if(j<segments&&k<sides){const i=offset+j*(sides+1)+k;this.i.push(i,i+sides+1,i+1,i+1,i+sides+1,i+sides+2);}
   }
   if(detail)for(let j=2;j<10;j++){
    const t=j/11,p=curve.getPoint(t),a=j*2.399+seed;
    for(const side of[-1,1]){
     const q=p.clone().add(V(Math.sin(a)*.021*side,.007,Math.cos(a)*.021*side)),tip=q.clone().add(V(Math.sin(a)*.012*side,.020,Math.cos(a)*.012*side)),w=V(Math.cos(a)*.008,0,-Math.sin(a)*.008);
     this.triangle(p.toArray(),q.clone().add(w).toArray(),tip.toArray(),'#71835a');this.triangle(p.toArray(),tip.toArray(),q.clone().sub(w).toArray(),'#66774e');
    }
   }
   if(seed%3===0){const p=curve.getPoint(.98);for(let j=0;j<3;j++)this.needle(p.clone().add(V((j-1)*.005,0,0)).toArray(),p.clone().add(V((j-1)*.013,.025,0)).toArray(),.004,'#a44f30');}
   this.canes++;
  }
  geometry(){const g=new T.BufferGeometry();for(const [name,array,size]of[['position',this.p,3],['color',this.c,3],['uv',this.u,2]])g.setAttribute(name,new T.Float32BufferAttribute(array,size));g.setIndex(this.i);g.computeVertexNormals();
   // Tiny closed cactus caps can leave unused seam vertices; keep finite unit normals.
   const n=g.attributes.normal;for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.5)n.setXYZ(i,0,1,0);
   g.computeBoundingBox();g.computeBoundingSphere();g.userData.desertArt={triangles:this.i.length/3,areoles:this.areoles,leaves:this.leaves,canes:this.canes};return g;}
 }
 function geometry(kind,variant=0,detail=true){
  const key=kind+':'+variant+':'+detail;if(templates.has(key))return templates.get(key);
  const w=new Writer();
  if(kind==='saguaro'){
   const bend=(variant-1)*.022;
   w.column([[0,-.02,0],[bend,.34,0],[bend*.4,.70,.018],[0,1,.025]],.085,{seed:variant+1});
   for(let j=0;j<(variant===1?1:2);j++){
    const sign=j?-1:1,y=.33+j*.14+variant*.025,out=.23+j*.04,z=(variant-1)*.055;
    w.column([[sign*.045,y,z],[sign*.14,y+.025,z],[sign*out,y+.13,z],[sign*(out+.015),y+.35+(j?-.03:.1),z]],.051,{ribs:8,rings:12,seed:j+variant*7});
   }
  }else if(kind==='barrel'){
   // A squat barrel, with ribs continuing across the rounded crown.
   const points=[[0,-.02,0],[0,.20,0],[.013,.48,0],[.02,.72,0]];
   w.column(points,.285,{ribs:16,rings:20,seed:variant+11});
  }else if(kind==='agave'){
   const n=detail?25:15;
   for(let j=0;j<n;j++){
    const t=j/(n-1),length=.95*(1-t*.60),height=.29+t*.51;
    w.blade({yaw:j*2.39996+variant*.6,length:length*(.86+hash(j,5)*.2),width:.25*(1-t*.4),height,base:.015+t*.025,seed:j,rows:detail?7:4,color:j%4?'#6b816e':'#83907c'});
   }
  }else if(kind==='rush'){
   for(let j=0;j<19;j++)w.blade({yaw:j*2.39996+variant*.43,length:.20+hash(j,8)*.46,width:.024+hash(j,6)*.032,height:.55+hash(j,7)*.35,base:0,seed:j,rows:5,color:j%6?'#667245':'#a08c60'});
  }else if(kind==='ocotillo'){
   const n=detail?11:8;
   for(let j=0;j<n;j++){const a=j*2.39996,h=.65+hash(j,9)*.35,spread=.20+hash(j,4)*.16;
    w.cane([[Math.sin(a)*.012,0,Math.cos(a)*.012],[Math.sin(a)*spread*.28,h*.36,Math.cos(a)*spread*.28],[Math.sin(a)*spread*.75,h*.73,Math.cos(a)*spread*.75],[Math.sin(a)*spread,h,Math.cos(a)*spread]],.007,j,detail);}
  }else throw Error('Unknown desert plant '+kind);
  const g=w.geometry();g.userData.desertArt={...g.userData.desertArt,kind,variant,detail};templates.set(key,g);return g;
 }
 function create(kind,variant=0){const g=new T.Group(),geo=geometry(kind,variant),m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;g.name='Desert | '+kind;g.add(m);g.userData.desertArt=geo.userData.desertArt;return g;}
 return {geometry,create,material:mat};
}
