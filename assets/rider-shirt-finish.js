import {surfaceSampler,trimGarment} from './rider-fit.js?v=tailored-coats69-20261010';
import {poloFinish} from './rider-polo-finish.js?v=tailored-coats69-20261010';

// Full-button cotton shirt: folded collar, sewn front, buttoned cuffs and two
// curved chest pockets. Every fitted point inherits the actual shirt's skin field.
export function shirtFinish(T,kit,garment,data,{color='#a78269',trim='#8e6e58',recipe={id:'peasant'}}={}) {
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),a=garment.geometry.attributes;
 const parent=garment.geometry.clone();if(!parent.attributes.uv)parent.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(a.position.count*2),2));parent.computeVertexNormals();
 const neck=data.boundaryLoops.find(l=>l.label==='neck').ids,roots=neck.map(i=>V().fromBufferAttribute(a.position,i)),center=roots.reduce((p,v)=>p.add(v),V()).divideScalar(roots.length),front=roots.filter(p=>p.z>center.z).sort((p,q)=>Math.abs(p.x)-Math.abs(q.x))[0];
 const hemY=Math.max(...data.boundaryLoops.find(l=>l.label==='hem').ids.map(i=>a.position.getY(i))),cuffX=Math.max(...data.boundaryLoops.filter(l=>l.label.startsWith('cuff')).flatMap(l=>l.ids.map(i=>Math.abs(a.position.getX(i)))));
 const sampler=surfaceSampler(T,[{...garment,geometry:parent}]),fit=(x,y,offset=.001)=>{const h=sampler.cast(V(x,y,.65),V(0,0,-1));if(!h)return null;return {p:h.point.clone().addScaledVector(h.normal,offset),joints:h.joints,weights:h.weights};};
 const geo=(v,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flatMap(q=>q.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(v.flatMap(q=>q.joints),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(v.flatMap(q=>q.weights),4));g.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap(q=>[q.p.x*4,q.p.y*4]),2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const pieces=[],push=(name,geometry,material)=>pieces.push({name,geometry,material,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 const fabric=c=>new T.MeshStandardMaterial({color:c,roughness:.9,metalness:0,side:T.DoubleSide});
 const collar=poloFinish(T,kit,garment,data,{color,trim,collarColor:color});for(const p of collar.pieces){if(p.name==='Polo_Folded_Collar')pieces.push({...p,name:'Shirt_Folded_Collar'});else{p.geometry.dispose();p.material.dispose();}}collar.material.dispose();
 const ribbon=(path,width,offset=.001)=>{const v=[],idx=[];let prev=null;for(let i=0;i<path.length;i++){const [x,y]=path[i],before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],len=Math.hypot(dx,dy)||1,nx=dy/len*width/2,ny=-dx/len*width/2,q=fit(x-nx,y-ny,offset),r=fit(x+nx,y+ny,offset);if(!q||!r){prev=null;continue;}const k=v.length;v.push(q,r);if(prev!==null)idx.push(prev,prev+1,k,prev+1,k+1,k);prev=k;}return geo(v,idx);};
 push('Shirt_Full_Button_Placket',ribbon(Array.from({length:75},(_,i)=>[0,hemY+.004+(front.y-.003-hemY)*i/74]),.017,.0011),fabric(trim));
 const bv=[],bi=[],button=(x,y,r=.0027)=>{const n=14,base=bv.length,mid=fit(x,y,.0027);if(!mid)return;bv.push(mid);for(let i=0;i<n;i++){const angle=i*Math.PI*2/n,q=fit(x+r*Math.cos(angle),y+r*Math.sin(angle),.002);if(!q)throw Error('Shirt button leaves surface');bv.push(q);}for(let i=0;i<n;i++)bi.push(base,base+1+i,base+1+(i+1)%n);};
 let buttons=0;for(let y=front.y-.028;y>hemY+.018;y-=.052){button(0,y);buttons++;}
 const pocketed=['peasant','flannel','western','safari','gingham','orchard'].includes(recipe.id);
 if(pocketed)for(const side of[-1,1]){
  const px=side*.084,py=front.y-.110,w=.058,h=.070,vertices=[],indices=[],rows=16,cols=10;
  for(let row=0;row<rows;row++){const t=row/(rows-1);for(let col=0;col<cols;col++){const u=col/(cols-1),x=px+(u-.5)*w,y=py-h*t+.006*Math.abs(u-.5)*2*t,q=fit(x,y,.0012+.0015*Math.sin(u*Math.PI)*Math.sin(t*Math.PI));if(!q)throw Error('Shirt pocket leaves torso');vertices.push(q);}}
  for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+cols;indices.push(a,b,a+1,b,b+1,a+1);}push('Shirt_Chest_Pocket_'+side,geo(vertices,indices),fabric(color));
  push('Shirt_Pocket_Fold_'+side,ribbon(Array.from({length:20},(_,i)=>[px-w/2+w*i/19,py-.006]),.0045,.0024),fabric(trim));
 }
 const band=trimGarment(T,parent,[(x)=>Math.abs(x)-(cuffX-.032)]);for(let i=0;i<band.attributes.position.count;i++){const p=V().fromBufferAttribute(band.attributes.position,i),n=V().fromBufferAttribute(band.attributes.normal,i);p.addScaledVector(n,.0008);band.attributes.position.setXYZ(i,p.x,p.y,p.z);}band.computeBoundingSphere();push('Shirt_Tailored_Cuffs',band,fabric(trim));
 push('Shirt_Pearl_Snaps',geo(bv,bi),new T.MeshStandardMaterial({color:'#d9d4c7',roughness:.4,metalness:.05,side:T.DoubleSide}));
 sampler.dispose();parent.dispose();return {material:fabric(color),pieces,evidence:{style:'full-button cotton riding shirt',buttons,fullPlacketLengthM:front.y-hemY,pockets:pocketed?2:0,cuffWidthM:.032,collar:'source-root folded',detailTriangles:pieces.reduce((s,p)=>s+p.geometry.index.count/3,0)}};
}
