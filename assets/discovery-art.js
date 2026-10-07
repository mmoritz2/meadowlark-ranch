/* Original discovery props. Materials share the ranch builder's existing CC0
 * timber/linen maps; templates share geometry while every chest has its own hinge. */
import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
export function createDiscoveryArt({THREE:T,materials}) {
 const templates=new Map(),collectibles=new Map(),TAU=Math.PI*2;
 const clone=(source,name,options={})=>{const m=source.clone();Object.assign(m,options);m.name='Discovery | '+name;m.vertexColors=true;m.envMapIntensity=.55;return m;};
 const wood=clone(materials.aged,'weathered chest timber',{roughness:.94}),iron=clone(materials.iron,'worn ironwork',{roughness:.64}),linen=clone(materials.cloth,'seed paper',{roughness:1});
 const brass=new T.MeshStandardMaterial({name:'Discovery | aged brass',color:'#b79a65',vertexColors:true,roughness:.46,metalness:.78,envMapIntensity:.55});
 const pigment=new T.MeshStandardMaterial({name:'Discovery | natural pigment',vertexColors:true,roughness:.84,side:T.DoubleSide,envMapIntensity:.45});
 const pearl=new T.MeshPhysicalMaterial({name:'Discovery | shell nacre',vertexColors:true,roughness:.42,metalness:0,clearcoat:.32,clearcoatRoughness:.28,side:T.DoubleSide,envMapIntensity:.45});
 const crystal=new T.MeshPhysicalMaterial({name:'Discovery | mineral facets',vertexColors:true,roughness:.27,metalness:.08,clearcoat:.45,clearcoatRoughness:.2,emissive:'#204f65',emissiveIntensity:.06,envMapIntensity:.55});
 const glass=new T.MeshPhysicalMaterial({name:'Discovery | seed jar glass',color:'#b9c6b2',roughness:.14,metalness:0,clearcoat:.6,transparent:true,opacity:.29,depthWrite:false,side:T.DoubleSide,vertexColors:true,envMapIntensity:.65});glass.forceSinglePass=true;
 const hash=(i,s=0)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
 const V=(x,y,z)=>new T.Vector3(x,y,z);
 function rounded(w,h,d,r=.007){
  r=Math.min(r,w*.2,h*.2,d*.2);const g=new T.BoxGeometry(1,1,1,3,3,3).toNonIndexed(),p=g.attributes.position,n=g.attributes.normal,q=new T.Vector3();
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);q.set(x-Math.sign(x)/6,y-Math.sign(y)/6,z-Math.sign(z)/6).normalize();p.setXYZ(i,Math.sign(x)*(w/2-r)+q.x*r,Math.sign(y)*(h/2-r)+q.y*r,Math.sign(z)*(d/2-r)+q.z*r);n.setXYZ(i,q.x,q.y,q.z);}return g;
 }
 class Batch {
  constructor(name){this.name=name;this.parts=new Map();this.count=0;}
  add(geo,mat,at=[0,0,0],rotation=[0,0,0],color='#ffffff',scale=null,grain=false){
   let g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
   const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,original=g.attributes.color,c=new T.Color(color),colors=[];
   if(!uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.count*2),2));
   if(grain){g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z',u=g.attributes.uv,offset=hash(this.count,8);
    for(let i=0;i<p.count;i++){const along=axis==='x'?p.getX(i):axis==='y'?p.getY(i):p.getZ(i),across=axis==='x'?(Math.abs(n.getY(i))>Math.abs(n.getZ(i))?p.getZ(i):p.getY(i)):axis==='y'?(Math.abs(n.getX(i))>Math.abs(n.getZ(i))?p.getZ(i):p.getX(i)):(Math.abs(n.getY(i))>Math.abs(n.getX(i))?p.getX(i):p.getY(i));u.setXY(i,along/1.1+offset,across/1.1+.27);}
   }
   for(let i=0;i<p.count;i++)colors.push(c.r*(original?original.getX(i):1),c.g*(original?original.getY(i):1),c.b*(original?original.getZ(i):1));
   g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
   g.applyMatrix4(new T.Matrix4().compose(V(...at),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),scale?V(...scale):V(1,1,1)));
   if(!this.parts.has(mat))this.parts.set(mat,[]);this.parts.get(mat).push(g);this.count++;
  }
  box(w,h,d,mat,at,rot=[0,0,0],color='#ffffff',r=.006){this.add(rounded(w,h,d,r),mat,at,rot,color,null,mat===wood);}
  tube(points,r,mat,color='#ffffff',sides=6){const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)));this.add(new T.TubeGeometry(curve,Math.max(4,(points.length-1)*4),r,sides,false),mat,[0,0,0],[0,0,0],color);}
  stud(at,rot=[0,0,0],metal=iron,r=.009){this.add(new T.SphereGeometry(r,8,5),metal,at,rot,'#c3bfb3',[1,1,.38]);}
  finish(){const root=new T.Group();root.name=this.name;let triangles=0;
   for(const [mat,parts]of this.parts){const g=mergeGeometries(parts,false);for(const part of parts)part.dispose();g.computeBoundingBox();g.computeBoundingSphere();const m=new T.Mesh(g,mat);m.name=this.name+' | '+mat.name;m.castShadow=!mat.transparent;m.receiveShadow=true;root.add(m);triangles+=g.attributes.position.count/3;}
   root.userData.discoveryArt={triangles,draws:root.children.length};return root;
  }
 }
 // An elliptical barrel section, extruded along the length of the chest.
 function arch(width,depth,rise,y,a0=0,a1=Math.PI,thickness=.025,steps=24){
  const shape=new T.Shape();for(let i=0;i<=steps;i++){const a=a0+(a1-a0)*i/steps,x=depth*Math.cos(a),h=y+rise*Math.sin(a);i?shape.lineTo(x,h):shape.moveTo(x,h);}
  for(let i=steps;i>=0;i--){const a=a0+(a1-a0)*i/steps;shape.lineTo((depth-thickness)*Math.cos(a),y+(rise-thickness)*Math.sin(a));}shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:width,steps:1,bevelEnabled:false,curveSegments:1});geo.rotateY(Math.PI/2);geo.translate(-width/2,0,0);return geo;
 }
 function endCap(thickness,x){const shape=new T.Shape();shape.moveTo(.314,.52);for(let i=1;i<=24;i++){const a=i*Math.PI/24;shape.lineTo(.314*Math.cos(a),.52+.18*Math.sin(a));}shape.lineTo(.314,.52);const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:1});g.rotateY(Math.PI/2);g.translate(x-thickness/2,0,0);return g;}
 function chestTemplate(tier){
  const b=new Batch('Discovery chest | fitted body'),l=new Batch('Discovery chest | barrel lid'),trim=tier===1?iron:brass;
  const tint=tier===3?'#71958e':tier===2?'#b4a18c':'#d5c8ac';
  for(let row=0;row<3;row++){const y=.105+row*.13+.059;
   for(const sign of[-1,1]){b.box(.916,.123,.038,wood,[0,y,sign*.279],[0,0,0],tint);b.box(.038,.123,.52,wood,[sign*.45,y,0],[0,0,0],tint);}
  }
  for(const x of[-.365,.365])b.box(.145,.067,.55,wood,[x,.035,0],[0,0,0],'#958774');
  b.box(.868,.035,.514,wood,[0,.089,0],[0,0,0],'#8b7963');
  for(const sign of[-1,1]){b.box(.975,.046,.052,wood,[0,.507,sign*.29],[0,0,0],tint);b.box(.052,.046,.552,wood,[sign*.461,.507,0],[0,0,0],tint);}
  // Separate staves, shallow joints and worn edges remain visible under sunlight.
  for(let i=0;i<9;i++)l.add(arch(.963,.321,.185,.532,i*Math.PI/9+.009,(i+1)*Math.PI/9-.009,.022,4),wood,[0,0,0],[0,0,0],new T.Color(tint).multiplyScalar(.9+hash(i,tier)*.12),null,true);
  for(const sign of[-1,1])l.add(endCap(.033,sign*.459),wood,[0,0,0],[0,0,0],tint,null,true);
  for(const x of[-.304,.304]){
   l.add(arch(.054,.333,.197,.534,0,Math.PI,.011,28),trim,[x,0,0]);
   for(const sign of[-1,1]){b.box(.054,.386,.012,trim,[x,.305,sign*.307]);for(const y of[.133,.253,.438])b.stud([x,y,sign*.317]);}
   // Back hinge leaves stay with the body; the pin sits on the lid's rear axis.
   b.box(.076,.13,.014,iron,[x,.461,-.315]);l.add(new T.CylinderGeometry(.014,.014,.09,10),iron,[x,.519,-.316],[0,0,Math.PI/2]);
  }
  for(const sign of[-1,1]){
   b.box(.012,.074,.155,iron,[sign*.478,.323,0]);
   b.add(new T.TorusGeometry(.075,.008,6,18,Math.PI*1.65),iron,[sign*.50,.28,0],[0,Math.PI/2,Math.PI*.175]);
   for(const z of[-.058,.058])b.stud([sign*.488,.34,z],[0,Math.PI/2,0]);
   b.box(.971,.025,.018,trim,[0,.115,sign*.306]);
  }
  l.box(.068,.15,.017,trim,[0,.51,.333]);b.box(.083,.102,.024,brass,[0,.404,.342],undefined,'#b6a78a',.009);
  b.add(new T.CylinderGeometry(.008,.008,.026,8),iron,[0,.424,.359],[Math.PI/2,0,0]);b.box(.006,.023,.002,iron,[0,.410,.373]);
  if(tier>=2){for(const sign of[-1,1])l.add(arch(.024,.33,.195,.535,0,Math.PI,.009,24),brass,[sign*.458,0,0]);}
  if(tier===3){for(const x of[-.412,.412])for(const z of[-.305,.305]){b.box(.094,.079,.013,brass,[x,.153,z]);b.stud([x,.154,z*1.04],undefined,iron,.012);}l.add(new T.TorusGeometry(.047,.006,6,16,Math.PI*1.62),brass,[0,.738,0],[Math.PI/2,0,.6]);}
  const root=new T.Group();root.name='Discovery | chest tier '+tier;const body=b.finish(),contents=l.finish(),lid=new T.Group();lid.name='Discovery | rear hinge';lid.position.set(0,.519,-.316);contents.position.set(0,-.519,.316);lid.add(contents);root.add(body,lid);
  root.userData.solidParts=[{min:[-.484,.012,-.32],max:[.484,.53,.32],matrix:new T.Matrix4().toArray()}];
  root.userData.discoveryArt={kind:'chest',tier,hinged:true,triangles:body.userData.discoveryArt.triangles+contents.userData.discoveryArt.triangles,draws:body.children.length+contents.children.length};return root;
 }
 function surface(points,indices,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(points.length/3*2),2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;}
 function shell(){const b=new Batch('Discovery | scalloped lake shell'),p=[],c=[],idx=[],rows=14,cols=48;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const r=.055+j/rows*.945,a=-1.32+i/cols*2.64,rib=Math.pow(.5+.5*Math.cos(a*18),2),edge=1+.018*Math.cos(a*36),x=Math.sin(a)*r*.205*edge,z=-.105+Math.cos(a)*r*.28*edge,y=.068*Math.sin(r*Math.PI*.92)+rib*.009*r;
   p.push(x,y,z);const col=new T.Color().lerpColors(new T.Color('#dfb6ad'),new T.Color('#e6dcc8'),r).multiplyScalar(.88+rib*.12);c.push(col.r,col.g,col.b);if(j<rows&&i<cols){const k=j*(cols+1)+i;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}
  b.add(surface(p,idx,c),pearl);const lip=[];for(let i=0;i<=cols;i++){const k=(rows*(cols+1)+i)*3;lip.push(p.slice(k,k+3));}b.tube(lip,.0033,pearl,'#f0e4cc',5);b.box(.064,.017,.037,pearl,[0,.012,-.098],[.2,0,0],'#bfa499');return b.finish();}
 function feather(){const b=new Batch('Discovery | barred kestrel feather');
  for(const side of[-1,1]){const p=[],c=[],idx=[],rows=32;
   for(let j=0;j<=rows;j++){const t=j/rows,centre=.054*t*t,y=-.245+t*.51,width=Math.pow(Math.sin(t*Math.PI),.8)*.094*(side===1?1:.74);
    for(let k=0;k<3;k++){const u=k/2,rag=(j%3===0?.89:1);p.push(centre+side*width*u*rag,y-u*.023*Math.sin(t*Math.PI),.025*Math.sin(t*Math.PI)+Math.abs(u)*.017);
     const bar=Math.sin(t*38+u*.6)> .2,col=new T.Color(bar?'#c8bcaa':'#7d7162').multiplyScalar(1-u*.14);c.push(col.r,col.g,col.b);if(j<rows&&k<2){const a=j*3+k;idx.push(a,a+3,a+1,a+1,a+3,a+4);}}
   }b.add(surface(p,idx,c),pigment);}
  b.tube([[0,-.3,0],[.003,-.13,.014],[.02,.08,.028],[.054,.265,.002]],.004,pigment,'#e2d4b7',6);return b.finish();
 }
 function crystals(){const b=new Batch('Discovery | quartz crystal cluster');
  for(let stone=0;stone<5;stone++){const height=stone===0?.36:.16+hash(stone,4)*.12,radius=stone===0?.068:.033+hash(stone,6)*.015,p=[],c=[],idx=[];
   for(let j=0;j<3;j++)for(let i=0;i<6;i++){const a=i*TAU/6,r=j===2?radius*.13:radius,y=j===0?-.11:j===1?height*.58-.11:height-.11;p.push(Math.cos(a)*r,y,Math.sin(a)*r);const col=new T.Color(i%2?'#568c9e':'#8bb5b9').multiplyScalar(.76+j*.14);c.push(col.r,col.g,col.b);}
   for(let j=0;j<2;j++)for(let i=0;i<6;i++){const a=j*6+i,d=j*6+(i+1)%6;idx.push(a,a+6,d,d,a+6,d+6);}for(let i=1;i<5;i++){idx.push(0,i,i+1);idx.push(12,13+i,12+i);}
   const indexed=surface(p,idx,c),g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();b.add(g,crystal,stone?[Math.sin(stone*2.4)*.085,-.015,Math.cos(stone*2.4)*.075]:[0,0,0],stone?[.15*Math.sin(stone),0,.23*Math.cos(stone)]:[0,0,0]);
  }
  b.add(new T.IcosahedronGeometry(.105,1),pigment,[0,-.115,0],[0,.4,0],'#676c68',[1.3,.38,1]);return b.finish();
 }
 function jar(){const b=new Batch('Discovery | barley seed jar');
  const profile=[[0,-.17],[.08,-.17],[.106,-.15],[.112,-.1],[.112,.10],[.097,.13],[.068,.145],[.068,.184],[.061,.184],[.061,.148],[.091,.127],[.104,.10],[.104,-.14],[.078,-.156],[0,-.156]].map(p=>new T.Vector2(...p));b.add(new T.LatheGeometry(profile,24),glass);
  for(let i=0;i<126;i++){const layer=Math.floor(i/21),seed=i%21,a=seed*2.39996+layer*.72,r=Math.sqrt((seed+.5)/21)*.073,y=-.136+layer*.029+hash(i,7)*.006;b.add(new T.SphereGeometry(1,7,5),pigment,[Math.sin(a)*r,y,Math.cos(a)*r],[Math.PI*.5,hash(i,2)*TAU,hash(i,8)*.4],i%3?'#a68c54':'#c1a369',[.017,.027,.015]);}
  b.add(new T.CylinderGeometry(.066,.062,.035,18),wood,[0,.187,0],[0,0,0],'#cbbb9b',null,true);
  for(const y of[.155,.167])b.add(new T.TorusGeometry(.07,.003,5,24),linen,[0,y,0],[Math.PI/2,0,0],'#99815a');
  const label=new T.CylinderGeometry(.1135,.1135,.125,18,1,true,-.64,1.28);b.add(label,pigment,[0,-.012,0],[0,0,0],'#dccda9');
  b.tube([[0,-.061,.116],[.002,-.01,.117],[.006,.034,.116]],.0019,pigment,'#766441',5);
  for(let i=0;i<4;i++)for(const side of[-1,1])b.add(new T.SphereGeometry(1,6,4),pigment,[side*.013,-.032+i*.014,.117],[0,0,side*-.7],'#927749',[.005,.012,.002]);
  return b.finish();
 }
 return {
  chest(tier=1){tier=Math.max(1,Math.min(3,tier));if(!templates.has(tier))templates.set(tier,chestTemplate(tier));const root=templates.get(tier).clone(true);return {root,lid:root.getObjectByName('Discovery | rear hinge')};},
  collectible(kind){if(!collectibles.has(kind)){const root=({shells:shell,feathers:feather,crystals,jars:jar}[kind])();root.userData.discoveryArt.kind=kind;collectibles.set(kind,root);}return collectibles.get(kind).clone(true);},
  stats(){return {chests:[...templates.values()].map(o=>o.userData.discoveryArt),collectibles:[...collectibles.values()].map(o=>o.userData.discoveryArt)};},
 };
}
