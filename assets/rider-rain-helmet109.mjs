import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';

/** Replace the visible helmet artwork inside the existing group. The base
 * wardrobe keeps owning that group and its colour material. All measurements
 * and fitted surfaces use Rain's own Head bind frame. */
export function installRainHelmet109(T,rig,{head,eyes}){
 const V=(...a)=>new T.Vector3(...a),group=rig.helmet,original=group.children.slice(),capMaterial=original.find(m=>m.isMesh)?.material;
 if(!capMaterial)throw Error('Existing helmet colour material is required');
 const index=rig.body.skeleton.bones.indexOf(rig.bones.Head),inverse=rig.body.skeleton.boneInverses[index].clone().multiply(rig.body.bindMatrix),local=head.geometry.clone().applyMatrix4(inverse),eye=eyes.geometry.clone().applyMatrix4(inverse),surface=createTriangleSurface(T,local);
 const owned=[],added=[],p=local.attributes.position;local.computeBoundingBox();eye.computeBoundingBox();
 const eyeCenter=eye.boundingBox.getCenter(V()),top=local.boundingBox.max.y,cx=0,cy=eyeCenter.y+.022,cz=eyeCenter.z-.075;
 const widths=[],depths=[];
 for(let i=0;i<p.count;i++){const y=p.getY(i);if(y>eyeCenter.y+.018&&y<top-.010){widths.push(Math.abs(p.getX(i)));depths.push(Math.abs(p.getZ(i)-cz));}}
 const percentile=(values,t)=>{values.sort((a,b)=>a-b);return values[Math.floor((values.length-1)*t)];};
 const rx=T.MathUtils.clamp(percentile(widths,.985)+.007,.080,.103),ry=top-cy+.008,rz=T.MathUtils.clamp(percentile(depths,.985)+.008,.082,.115);
 const rimY=th=>{const a=Math.abs(th)/Math.PI;return a<.28?cy+.041-.028*(a/.28):a<.62?cy+.013-.053*((a-.28)/.34):cy-.040-.020*((a-.62)/.38);};
 let shellProjected=0,strapProjected=0;
 function outside(th,y,extra=0){
  const dir=V(Math.sin(th),0,Math.cos(th)),factor=Math.sqrt(Math.max(0,1-Math.pow((y-cy)/ry,2))),q=V(cx+dir.x*rx*factor,y,cz+dir.z*rz*factor),origin=V(cx+dir.x*.35,y,cz+dir.z*.35),hit=surface.cast(origin,dir.clone().negate(),null,.35);
  if(hit){const limit=hit.point.clone().addScaledVector(dir,.004+extra);if(q.clone().sub(limit).dot(dir)<0){q.copy(limit);shellProjected++;}else q.addScaledVector(dir,extra);}else q.addScaledVector(dir,extra);
  return q;
 }
 function mesh(name,geometry,material=capMaterial){owned.push(geometry);const m=new T.Mesh(geometry,material);m.name=name;m.castShadow=!name.includes('strap');m.receiveShadow=true;group.add(m);added.push(m);return m;}
 const nt=64,ny=20,positions=[],uv=[],triangles=[];
 for(let j=0;j<=ny;j++)for(let i=0;i<=nt;i++){const th=(i/nt-.5)*Math.PI*2,t=j/ny,y=(cy+ry*.999)*(1-t)+rimY(th)*t;positions.push(...outside(th,y).toArray());uv.push(i/nt,j/ny);}
 for(let j=0;j<ny;j++)for(let i=0;i<nt;i++){const a=j*(nt+1)+i,b=a+nt+1;triangles.push(a,b,a+1,b,b+1,a+1);}
 const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(positions,3));shell.setAttribute('uv',new T.Float32BufferAttribute(uv,2));shell.setIndex(triangles);shell.computeVertexNormals();mesh('Rain fitted helmet cap',shell);
 const rim=[];for(let i=0;i<nt;i++){const th=(i/nt-.5)*Math.PI*2;rim.push(outside(th,rimY(th),.001));}
 mesh('Rain fitted helmet rolled edge',new T.TubeGeometry(new T.CatmullRomCurve3(rim,true,'centripetal'),nt*2,.0022,6,true));
 const visorP=[],visorU=[],visorI=[],nw=6,np=32,span=.31;
 for(let w=0;w<=nw;w++)for(let i=0;i<=np;i++){const th=(i/np-.5)*Math.PI*2*span,f=w/nw,q=outside(th,rimY(th),.001),out=.045*f*Math.pow(Math.cos((i/np-.5)*Math.PI),.65);q.add(V(Math.sin(th)*out,-.002-.007*f*f,Math.cos(th)*out));visorP.push(...q.toArray());visorU.push(i/np,f);}
 for(let w=0;w<nw;w++)for(let i=0;i<np;i++){const a=w*(np+1)+i,b=a+np+1;visorI.push(a,a+1,b,b,a+1,b+1);}
 const visor=new T.BufferGeometry();visor.setAttribute('position',new T.Float32BufferAttribute(visorP,3));visor.setAttribute('uv',new T.Float32BufferAttribute(visorU,2));visor.setIndex(visorI);visor.computeVertexNormals();mesh('Rain fitted helmet visor',visor);
 const bottom=(x,z)=>{const hit=surface.cast(V(x,local.boundingBox.min.y-.15,z),V(0,1,0));return hit?hit.point.add(V(0,-.0045,0)):V(x,eyeCenter.y-.13,z);};
 const under=bottom(0,eyeCenter.z+.012),sidePoint=(side,y,z)=>{const hit=surface.cast(V(side*.30,y,z),V(-side,0,0),h=>h.point.x*side>0,.30);return hit?hit.point.add(V(side*.0045,0,0)):V(side*rx,y,z);};
 const sides=[];
 for(const side of[-1,1]){const th=side*Math.PI*.58;sides.push([outside(th,rimY(th),.002),sidePoint(side,eyeCenter.y-.021,eyeCenter.z-.022),sidePoint(side,under.y+.025,under.z-.025),bottom(side*.025,under.z-.005)]);}
 const guide=new T.CatmullRomCurve3([...sides[0],under,...sides[1].slice().reverse()],false,'centripetal'),center=V(0,eyeCenter.y-.025,eyeCenter.z-.040),samples=[];
 for(let i=0;i<=128;i++){
  const q=guide.getPoint(i/128),dir=q.clone().sub(center),length=dir.length();dir.normalize();const hit=surface.cast(center.clone().addScaledVector(dir,.4),dir.clone().negate(),null,.4);
  if(hit&&i>0&&i<128){const min=center.distanceTo(hit.point)+.0048;if(length<min){q.copy(center).addScaledVector(dir,min);strapProjected++;}}
  samples.push(q);
 }
 const strapMaterial=new T.MeshStandardMaterial({color:0x201d1b,roughness:.72,metalness:.02});
 mesh('Rain fitted helmet chin strap',new T.TubeGeometry(new T.CatmullRomCurve3(samples,false,'centripetal'),192,.0028,6,false),strapMaterial);
 for(const child of original)child.visible=false;
 group.position.set(0,0,0);group.quaternion.identity();group.scale.set(1,1,1);group.updateMatrix();
 surface.dispose();local.dispose();eye.dispose();
 const metadata={cx,cy,cz,rx,ry,rz,rimY,eyeCenter:eyeCenter.toArray(),topY:top,shellProjected,strapProjected,underChin:under.toArray(),source:'Rain head surface',oldVisibleChildren:0,newMeshes:added.length};
 rig.rainHelmet109={metadata,inspect:()=>({...metadata,rimY:undefined}),dispose(){added.forEach(m=>m.removeFromParent());owned.forEach(g=>g.dispose());strapMaterial.dispose();}};
 return rig.rainHelmet109;
}
