import {coyoteDryWeight} from './biome-weights.mjs?v=dry-foothills-1';

// Original pasture geology. The original seeded spire is constructed first, so
// source admission, geometry/material ownership and shared constructor RNG stay
// unchanged. Only the two warm transition sites currently qualify.
export const RANCH_FIELDSTONES=Object.freeze({profile:'pastoral-weathered-fieldstones-1',maximumDryWeight:.65,masses:3,toes:7,triangles:912,maximumFootprintFraction:.95});
export const needsPastoralFieldstone=(x,z)=>coyoteDryWeight(x,z)<RANCH_FIELDSTONES.maximumDryWeight;
const tau=Math.PI*2;
const hash=(seed,k)=>{let n=(seed^Math.imul(k+1,0x9e3779b1))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967296;};
// All six boundary faces share this same continuous position function; rounded
// corners, tilted broken roofs and two small recesses form an actual solid rock.
export function fieldstoneArrays(radius,seed){
 if(!(radius>0&&Number.isFinite(radius)&&Number.isInteger(seed)))throw Error('Finite authored fieldstone radius/seed required');
 const P=[],UV=[],C=[],I=[],phase=hash(seed,1)*tau;
 const masses=[{x:-.105,z:.025,s:.70,h:.87,turn:phase},
  {x:.355,z:-.225,s:.385,h:.62,turn:phase+.71},
  {x:-.31,z:.39,s:.27,h:.405,turn:phase-1.15}];
 for(let k=0;k<7;k++){const a=phase+k*2.399963229728653,rr=.53+.09*hash(seed,k+5);masses.push({x:Math.cos(a)*rr,z:Math.sin(a)*rr,s:.075+.045*hash(seed,k+15),h:.09+.055*hash(seed,k+25),turn:a+.35});}
 // Plane axes follow the bundled BoxGeometry winding: two real triangles per
 // cell, with independent material seams but exactly coincident boundary sites.
 const faces=[['z','y','x',-1,-1,1],['z','y','x',1,-1,-1],['x','z','y',1,1,1],['x','z','y',1,-1,-1],['x','y','z',1,-1,1],['x','y','z',-1,-1,-1]];
 for(const [id,m]of masses.entries()){
  const grid=id<3?4:2,co=Math.cos(m.turn),sn=Math.sin(m.turn),start=P.length/3;
  for(const [u,v,w,ud,vd,wd]of faces){const faceStart=P.length/3;
   for(let j=0;j<=grid;j++)for(let i=0;i<=grid;i++){
    const q={x:0,y:0,z:0};q[u]=(i/grid*2-1)*ud;q[v]=(j/grid*2-1)*vd;q[w]=wd;
    const original={...q},norm=Math.pow(Math.abs(q.x)**4.6+Math.abs(q.y)**4.6+Math.abs(q.z)**4.6,1/4.6);q.x/=norm;q.y/=norm;q.z/=norm;
    const weather=1+.045*Math.sin(q.x*5.7+q.z*3.1+phase+id)*Math.cos(q.y*3.4-phase);
    let xx=q.x*weather*m.s,zz=q.z*weather*m.s;
    const recess=.075*Math.exp(-(((q.x-.44)/.16)**2))*Math.max(0,q.z)*Math.max(0,q.y+.1);xx-=recess*m.s;
    let yy=(q.y+1)*.5;
    yy=Math.min(yy,.86-.16*q.x+.085*q.z,.90+.10*q.x-.145*q.z);
    yy*=m.h;
    // A flat buried contact face and its coincident side edges seat on actual
    // shared terrain in the existing groundAt pass, rather than hovering toes.
    if(original.y===-1)yy=-.028/radius;
    const x=radius*(m.x+xx*co+zz*sn),z=radius*(m.z-xx*sn+zz*co),y=radius*yy;
    P.push(x,y,z);
    const axis=w,uu=axis==='x'?zz*radius:xx*radius,vv=axis==='y'?zz*radius:y;UV.push(uu/3.2,vv/3.2);
    const shade=.90+.055*Math.sin(q.x*3.1+q.z*4.7+phase+id)+.025*q.y;C.push(shade,shade*.985,shade*.945);
   }
   for(let j=0;j<grid;j++)for(let i=0;i<grid;i++){const a=faceStart+j*(grid+1)+i,b=a+grid+1;I.push(a,b,a+1,b,b+1,a+1);}
  }
  if(P.length/3<=start)throw Error('Empty fieldstone mass');
 }
 let maximumRadius=0;for(let i=0;i<P.length;i+=3)maximumRadius=Math.max(maximumRadius,Math.hypot(P[i],P[i+2]));
 // Existing circle footprints are authoritative. This is a uniform horizontal
 // fit of one connected outcrop, never a site or individual volume deletion.
 const fit=Math.min(1,(radius*RANCH_FIELDSTONES.maximumFootprintFraction-.015)/maximumRadius);
 for(let i=0;i<P.length;i+=3){P[i]*=fit;P[i+2]*=fit;}
 return {position:new Float32Array(P),uv:new Float32Array(UV),color:new Float32Array(C),index:new Uint16Array(I),fit,maximumRadius:maximumRadius*fit};
}
export function dressPastoralFieldstone({THREE:T,group,x,z,radius,height,seed,material}){
 if(!needsPastoralFieldstone(x,z))return null;
 const mesh=group.children.find(o=>o.isMesh);if(!mesh||group.children.filter(o=>o.isMesh).length!==1)throw Error('One original spire mesh required');
 const geometry=mesh.geometry,model=fieldstoneArrays(radius,seed),old={geometry:geometry.uuid,mesh:mesh.uuid,group:group.uuid,triangles:geometry.index.count/3};
 geometry.setAttribute('position',new T.BufferAttribute(model.position,3));geometry.setAttribute('uv',new T.BufferAttribute(model.uv,2));geometry.setAttribute('color',new T.BufferAttribute(model.color,3));geometry.setIndex(new T.BufferAttribute(model.index,1));geometry.deleteAttribute('normal');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();delete geometry.userData.unwrapSeam;
 mesh.material=material;mesh.name='Geology | pasture fieldstone outcrop';group.name=mesh.name;
 const measuredHeight=geometry.boundingBox.max.y;
 const profile={...RANCH_FIELDSTONES,legacyKind:'weathered spire',legacyHeight:height,seed,radius,height:measuredHeight,collisionHeight:measuredHeight,triangles:model.index.length/3,vertices:model.position.length/3,fit:model.fit,maximumRadius:model.maximumRadius,previousTriangles:old.triangles,ownership:old,materialBorrowed:true,min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray(),texturePatchMetres:3.2,surfaceProfile:'resident-cracked-limestone'};
 mesh.userData.geology=group.userData.geology={...group.userData.geology,...profile,kind:'pasture fieldstone outcrop',fieldstone:true};return profile;
}
// Each toe is a physical rock rather than a globally scaled apron. Seating all
// vertices on the shared terrain carries the original local thickness intact;
// the old single-height feather would invert tiny uphill stone roofs.
export function groundPastoralFieldstone({group,groundH,x,z}){
 if(!group.userData.geology.fieldstone)throw Error('Only authored fieldstone owner may use this grounding branch');
 const mesh=group.children.find(o=>o.isMesh),g=mesh.geometry,p=g.attributes.position,base=groundH(x,z);
 if(!g.userData.groundReference)g.userData.groundReference=new Float32Array(p.array);
 const original=g.userData.groundReference;
 for(let i=0;i<p.count;i++){
  const lx=original[i*3],ly=original[i*3+1],lz=original[i*3+2],ground=groundH(x+lx,z+lz);
  if(!Number.isFinite(ground))throw Error('Actual fieldstone terrain required');
  p.setXYZ(i,lx,ly+ground-base,lz);
 }
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();group.position.set(x,base,z);
 const height=g.boundingBox.max.y;let sourceTop=0;for(let i=1;i<original.length;i+=3)sourceTop=Math.max(sourceTop,original[i]);
 // Player jump height is terrain-relative. Keep the measured centre-relative
 // top and a small continuous-terrain support allowance above the source top.
 const collisionHeight=Math.max(height,sourceTop+.02);
 Object.assign(group.userData.geology,{height,collisionHeight,collisionTopAllowance:.02,min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray(),grounded:true,groundedBounds:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},grounding:'whole-mass-terrain-conform'});
 return group;
}
