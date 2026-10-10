import {createHeadSurface,createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
/* New styles are fitted in the Head bone's space, using the same scalp, strand
   materials and helmet deformation as the original character. */
const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
export const EXTRA_HAIR=[
 {id:'bob',label:'Chin-length bob',mesh:'Hair_Long',shape:'bob'},
 {id:'lob',label:'Shoulder-length',mesh:'Hair_Long',shape:'lob'},
 {id:'waves',label:'Loose waves',mesh:'Hair_Long',shape:'waves'},
 {id:'halfup',label:'Half-up twist',mesh:'Hair_Long',shape:'waves',detail:'halfup'},
 {id:'lowpony',label:'Low ponytail',scalp:true,detail:'lowpony'},
 {id:'sidebraid',label:'Side braid',scalp:true,detail:'sidebraid'},
 {id:'twinbraids',label:'Twin braids',scalp:true,detail:'twinbraids'},
 {id:'crownbraid',label:'Braided crown',scalp:true,detail:'crownbraid'},
 {id:'lowbun',label:'Low chignon',scalp:true,detail:'lowbun'},
 {id:'messybun',label:'Loose bun',scalp:true,detail:'messybun'},
 {id:'coils',label:'Natural coils',scalp:true,detail:'coils'},
 {id:'pixie',label:'Swept pixie',scalp:true,mesh:'Hair_SimpleParted',shape:'pixie'},
 {id:'ribbonpony',label:'Ribbon ponytail',scalp:true,detail:'ribbonpony'},
 {id:'highpony',label:'High ponytail',scalp:true,detail:'highpony'},
 {id:'bubblepony',label:'Bubble ponytail',scalp:true,detail:'bubblepony'},
 {id:'braidedpony',label:'Braided ponytail',scalp:true,detail:'braidedpony'},
 {id:'twintails',label:'Low twin tails',scalp:true,detail:'twintails'},
 {id:'halfupbun',label:'Half-up bun',mesh:'Hair_Long',shape:'waves',detail:'halfupbun'},
 {id:'beachbob',label:'Wavy bob',mesh:'Hair_Long',shape:'beachbob'},
 {id:'mermaidwaves',label:'Long flowing waves',mesh:'Hair_Long',shape:'mermaidwaves'},
 {id:'croppedcoils',label:'Cropped coils',scalp:true,detail:'croppedcoils'},
 {id:'twists',label:'Shoulder twists',scalp:true,detail:'twists'},
 {id:'braidedbun',label:'Braided chignon',scalp:true,detail:'braidedbun'},
].map(h=>({...h,body:['f','m']}));

export function shapeHair(source,style,head,THREE,kit){
 if(THREE&&kit)return sculptedHairShape(THREE,kit,style);
 const geo=source.clone(),p=geo.attributes.position;geo.computeBoundingBox();const sourceEnd=geo.boundingBox.min.y;
 const end=style==='bob'?-.027:style==='beachbob'?-.073:style==='mermaidwaves'?-.46:style==='lob'?-.165:style==='long'?-.315:-.305;
 // A soft U-shaped perimeter and staggered lengths keep the ends from reading
 // as a single cut sheet. The upper locks retain their fitted scalp roots.
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  if(style==='pixie'){
   x*=1.025;z*=1.03;if(y>head.cy)y+=(y-head.cy)*.075;
  }else if(y<.095){
   const t=Math.min(1,Math.max(0,(.095-y)/Math.max(.02,.095-sourceEnd))),side=Math.sign(x)||1,angle=Math.atan2(x,z-head.cz);
   const layered=.020*Math.abs(Math.sin(angle))+.008*Math.sin(angle*5.0+1.4)+.004*Math.sin(angle*11.0-.8);
   y=.095+(end-.095)*t+layered*t*t*t;
   const volume=Math.sin(t*Math.PI)*(.010+(style==='bob'?.001:.005)),neck=Math.min(1,t*4);
   x+=side*volume;z-=Math.max(0,t-.22)*.069;
   const waved=['waves','beachbob','mermaidwaves'].includes(style),amplitude=waved?(style==='beachbob'?.010:.014):.0025,phase=angle*1.7;
   x+=side*amplitude*Math.sin(t*8.8+phase)*Math.sin(t*Math.PI*.92)*neck;
   z+=amplitude*.65*Math.sin(t*9.6+phase+.7)*Math.sin(t*Math.PI)*neck;
   if(style==='bob'||style==='beachbob')x*=1-.075*t*t;
   // Fine end variation is deliberately confined to the last few centimetres.
   y+=.004*Math.sin(x*73+z*49)*Math.max(0,(t-.78)/.22);
  }
  p.setXYZ(i,x,y,z);
 }
 smoothHairNormals(geo);geo.computeBoundingSphere();return geo;
}

function mergeHairGeometry(THREE,list){
 const P=[],UV=[],I=[];let offset=0;
 for(const g of list){const p=g.attributes.position,u=g.attributes.uv;for(let i=0;i<p.count;i++){P.push(p.getX(i),p.getY(i),p.getZ(i));UV.push(u?u.getX(i):0,u?u.getY(i):0);}if(g.index)for(const i of g.index.array)I.push(i+offset);else for(let i=0;i<p.count;i++)I.push(i+offset);offset+=p.count;g.dispose();}
 const g=new THREE.BufferGeometry();g.setIndex(I);g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));smoothHairNormals(g);g.computeBoundingSphere();g.userData.proceduralHair=true;return g;
}
function originalHairFallPoint(THREE,kit,style,theta,t){
 const H=kit.head,ends={long:-.435,waves:-.375,mermaidwaves:-.515,lob:-.205,bob:-.060,beachbob:-.095,curlyFall:-.255},end=ends[style]??-.375,curly=style==='curlyFall',waved=['waves','mermaidwaves','beachbob','curlyFall'].includes(style),sine=Math.sin(theta),cosine=Math.cos(theta),yStart=H.cy+.055,yEnd=end+.023*Math.abs(sine)+.010*Math.sin(theta*5.1+.7)+.013*(.5+.5*Math.cos(theta*19)),y=yStart+(yEnd-yStart)*t,hang=Math.max(0,(t-.21)/.79),ridge=.004*Math.sin(theta*19+t*4)*Math.sin(Math.PI*t),wave=waved?(curly?.024:.022)*Math.sin(hang*(curly?16.5:10.8)+theta*2.7)*Math.sin(hang*Math.PI*.92):.0025*Math.sin(hang*4+theta*2),rx=H.rx+.014+(curly?.010:.025)*Math.sin(hang*Math.PI*.8),sideSweep=.130*smooth(.015,.38,hang)*Math.pow(Math.abs(sine),.75),backDrop=.055*hang*Math.abs(cosine)+.092*smooth(.10,.72,hang)*Math.pow(Math.max(0,-cosine),2),p=new THREE.Vector3(H.cx+sine*(rx+wave+ridge),y,H.cz+cosine*.106-sideSweep-backDrop+wave*.32*cosine);
 if(t<.35){const fitted=scalpPoint(THREE,kit,new THREE.Vector3(H.cx+sine*H.rx,y,H.cz+cosine*H.rz),.006);p.lerp(fitted,1-smooth(.13,.35,t));}return p;
}
function hairFallPoint(THREE,kit,style,theta,t){
 if(!['waves','mermaidwaves','beachbob'].includes(style))return originalHairFallPoint(THREE,kit,style,theta,t);
 const H=kit.head,sine=Math.sin(theta),cosine=Math.cos(theta),hang=smooth(.17,.98,t),end=style==='beachbob'?-.105:style==='mermaidwaves'?-.505:-.340,
  yEnd=end+.020*Math.abs(sine)+.010*Math.sin(theta*5.2+.7),y=H.cy+.055+(yEnd-H.cy-.055)*t,
  phase=hang*(style==='beachbob'?7.7:10.1)-theta*1.35,wave=(style==='beachbob'?.014:.022)*Math.sin(phase)*smooth(0,.25,hang),
  radius=(H.rx+.012+.010*Math.sin(Math.PI*hang))*(1-.19*hang*hang*hang),clearance=style==='mermaidwaves'?smooth(H.cy+.018,H.chin.y-.100,y):smooth(0,.52,hang),back=(style==='beachbob'?.008:.020)*clearance*Math.abs(cosine)+.008*clearance*Math.pow(Math.abs(sine),.65),
  p=new THREE.Vector3(H.cx+sine*(radius+wave),y,H.cz+cosine*(H.rz+.007)-back+cosine*wave*.65);
 // Every rear column leaves its own fitted occiput/behind-ear point. The
 // shoulder endpoint is anticipated above the jaw, avoiding a late turn from
 // a side-neck lock onto a global posterior plane.
 if(!kit.hairReleasePoints)kit.hairReleasePoints=new Map();const key=theta.toFixed(6);
 if(!kit.hairReleasePoints.has(key))kit.hairReleasePoints.set(key,scalpPoint(THREE,kit,new THREE.Vector3(H.cx+sine*H.rx,H.cy+.024,H.cz+cosine*H.rz),.006));
 const release=kit.hairReleasePoints.get(key),backZ=hairBodyZ(THREE,kit,p.x,Math.min(y,H.chin.y-.140),false),drop=smooth(H.cy+.024,H.chin.y-.120,y);
 if(backZ!==null)p.z=THREE.MathUtils.lerp(release.z,backZ-(kit.hairGarmentEnvelope?.010:.022)+cosine*wave*.14,drop);
 // A mounted male torso projects farther behind the neck than the neutral pose.
 // Preserve its separate lower-center clearance after shaping the rest path.
 if(kit.body==='m'&&style!=='beachbob')p.z-=.018*smooth(H.chin.y-.065,H.chin.y-.195,y)*smooth(-.30,-.70,cosine);
 if(y>H.chin.y+.052){const fitted=scalpPoint(THREE,kit,new THREE.Vector3(H.cx+sine*H.rx,y,H.cz+cosine*H.rz),.006);p.lerp(fitted,smooth(H.chin.y+.052,H.cy+.047,y));}
 return p;
}

/* The lower locks rest against the torso instead of a fixed forward/backward
   shelf. This bind-space proxy is shared by styles and does not move scalp roots. */
function hairBodyZ(THREE,kit,x,y,front){
 const H=kit.head;if(y>H.chin.y-.008)return null;
 if(!kit.hairBodySurface){
  const source=kit.skin||kit.garmentSkin,inverse=kit.headAsset?.inverse||source.skeleton.boneInverses[source.skeleton.bones.findIndex(b=>b.name==='Head')],body=source.geometry.clone().applyMatrix4(inverse),positions=[],indices=[];let offset=0;
  // Use the visible sculpted neck, not the removed source head retained by
  // garment templates. Both surfaces are copied in the same Head bind space.
  for(const part of [body,kit.headAsset?.local].filter(Boolean)){const a=part.attributes.position;for(let i=0;i<a.count;i++)positions.push(a.getX(i),a.getY(i),a.getZ(i));if(part.index)for(const i of part.index.array)indices.push(offset+i);else for(let i=0;i<a.count;i++)indices.push(offset+i);offset+=a.count;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);kit.hairBodySurface=createTriangleSurface(THREE,geometry);geometry.dispose();body.dispose();
 }
 if(kit.hairGarmentEnvelope&&!kit.hairClothSurface){const geometry=kit.hairGarmentEnvelope.geometry.clone().applyMatrix4(kit.headAsset.inverse);kit.hairClothSurface=createTriangleSurface(THREE,geometry);geometry.dispose();}
 const origin=new THREE.Vector3(x,y,H.cz+(front?.65:-.65)),direction=new THREE.Vector3(0,0,front?-1:1),accept=p=>Math.abs(p.point.x)<.23&&Math.abs(p.point.z-H.cz)<.32;let hit=kit.hairBodySurface.cast(origin,direction,accept);
 // A side lock outside the neck has no positional collision. Extending the
 // central neck depth here would pull it sharply behind an unrelated surface.
 const cloth=kit.hairClothSurface?.cast(new THREE.Vector3(x,y,H.cz+(front?.65:-.65)),direction,accept);if(cloth)return hit?(front?Math.max(hit.point.z,cloth.point.z):Math.min(hit.point.z,cloth.point.z)):cloth.point.z;
 return hit?.point.z??null;
}
function restHairPoint(THREE,kit,p,front,padding=.014){
 const z=hairBodyZ(THREE,kit,p.x,p.y,front);if(z===null)return p;
 const male=kit.body==='m'&&!front?.018*smooth(kit.head.chin.y-.065,kit.head.chin.y-.195,p.y):0,clearance=kit.hairGarmentEnvelope?Math.min(padding,.010+male):padding;
 if(front)p.z=Math.max(p.z,z+clearance);else p.z=Math.min(p.z,z-clearance);
 return p;
}


/* Roots keep the exact Head attachment; lower waves inherit the neck/torso
   surface's barycentric skin influences, so they rest through body animation. */
function flexibleHair(THREE,kit,geometry){
 const bones=kit.skin?.skeleton?.bones;if(!bones)return geometry;
 const H=kit.head,headIndex=bones.findIndex(b=>b.name==='Head'),fallback=bones.findIndex(b=>b.name==='spine_03');
 if(headIndex<0||fallback<0)throw Error('Flexible hair requires Head and upper-spine joints');
 if(!kit.hairWeightSurface){
  const inverse=kit.headAsset?.inverse||kit.skin.skeleton.boneInverses[headIndex],positions=[],joints=[],weights=[],indices=[];let offset=0;
  const component=(a,i,k)=>a[['getX','getY','getZ','getW'][k]](i),canonical=new Map();
  bones.forEach((b,i)=>{if(!canonical.has(b.name)||kit.bones?.[b.name]===b)canonical.set(b.name,i);});
  const allowed=new Set(bones.map((b,i)=>/^(Head|neck_\d+|spine_\d+|clavicle_[lr]|pelvis)$/.test(b.name)?canonical.get(b.name):-1).filter(i=>i>=0));
  for(const mesh of [kit.skin,kit.headAsset?.mesh,kit.hairGarmentEnvelope].filter(Boolean)){
   const g=mesh.geometry,a=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;if(!si||!sw)continue;
   for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(inverse);positions.push(...p.toArray());for(let k=0;k<4;k++){joints.push(canonical.get(bones[component(si,i,k)]?.name)??headIndex);weights.push(component(sw,i,k));}}
   if(g.index)for(const i of g.index.array)indices.push(offset+i);else for(let i=0;i<a.count;i++)indices.push(offset+i);offset+=a.count;
  }
  const proxy=new THREE.BufferGeometry();proxy.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));proxy.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));proxy.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));proxy.setIndex(indices);
  const p=proxy.attributes.position,si=proxy.attributes.skinIndex,sw=proxy.attributes.skinWeight,surface=createTriangleSurface(THREE,proxy);proxy.dispose();
  kit.hairWeightSurface={p,si,sw,surface,allowed,component,headIndex:canonical.get('Head'),fallback:canonical.get('spine_03')};
 }
 const fit=kit.hairWeightSurface,position=geometry.attributes.position,joints=[],weights=[],a=new THREE.Vector3(),b=a.clone(),c=a.clone(),bary=a.clone(),point=a.clone(),origin=a.clone(),direction=new THREE.Vector3(0,0,1);
 const start=H.chin.y-.020,end=H.chin.y-.170;
 const sample=hit=>{
  const f=hit.face;a.fromBufferAttribute(fit.p,f.a);b.fromBufferAttribute(fit.p,f.b);c.fromBufferAttribute(fit.p,f.c);THREE.Triangle.getBarycoord(hit.point,a,b,c,bary);const result=new Map();
  for(const [i,t]of [[f.a,Math.max(0,bary.x)],[f.b,Math.max(0,bary.y)],[f.c,Math.max(0,bary.z)]])for(let k=0;k<4;k++){const joint=fit.component(fit.si,i,k),weight=fit.component(fit.sw,i,k)*t;if(fit.allowed.has(joint)&&Number.isFinite(weight)&&weight>0)result.set(joint,(result.get(joint)||0)+weight);}
  const total=[...result.values()].reduce((s,w)=>s+w,0);if(total>1e-6)for(const [j,w]of result)result.set(j,w/total);return total>1e-6?result:null;
 };
 if(!fit.fields){
  fit.fields={};for(const front of [false,true]){
   const step=.005,xStep=.008,xMin=-.20,columns=51,count=Math.ceil((start+.56)/step)+1,fallbacks=[],hits=[];let rows=[];
   for(let row=0;row<count;row++){
    const y=start-row*step,values=[];let missing=0;
    for(let col=0;col<columns;col++){
     const x=xMin+col*xStep;origin.set(x,y,H.cz+(front?.65:-.65));direction.set(0,0,front?-1:1);
     const hit=fit.surface.cast(origin,direction,h=>Math.abs(h.point.z-H.cz)<.32&&!!sample(h));values.push(hit?sample(hit):null);
     if(hit)hits.push({x,y,faceIndex:hit.faceIndex});else missing++;
    }
    // Side locks extend beyond the narrow neck. Continue the nearest accepted
    // same-height ownership outwards; the fill is a field, not a vertex switch.
    const valid=values.map((v,i)=>v?i:-1).filter(i=>i>=0);
    if(valid.length)for(let col=0;col<columns;col++)if(!values[col]){
     let nearest=valid[0];for(const candidate of valid)if(Math.abs(candidate-col)<Math.abs(nearest-col))nearest=candidate;
     values[col]=new Map(values[nearest]);
    }
    rows.push(values);if(missing)fallbacks.push({y,count:missing,reason:valid.length?'Nearest accepted same-height surface weights':'No accepted surface at this height',validColumns:valid.length});
   }
   // A whole missing row borrows the nearest measured row before smoothing.
   // Only a wholly absent proxy uses the deterministic upper-spine fallback.
   const validRows=rows.map((r,i)=>r.some(Boolean)?i:-1).filter(i=>i>=0);
   for(let row=0;row<rows.length;row++)if(!rows[row].some(Boolean)){
    let nearest=validRows[0];for(const candidate of validRows)if(Math.abs(candidate-row)<Math.abs(nearest-row))nearest=candidate;
    rows[row]=Array.from({length:columns},(_,col)=>nearest===undefined?new Map([[fit.fallback,1]]):new Map(rows[nearest][col]));
    const report=fallbacks.find(f=>Math.abs(f.y-(start-row*step))<1e-8);report.reason=nearest===undefined?'No measured surface; upper-spine fallback':'Nearest accepted longitudinal row';if(nearest!==undefined)report.sourceY=start-nearest*step;
   }
   // A continuous shoulder field retains left/right clavicle ownership while
   // removing source-triangle and silhouette discontinuities. Interpolation is
   // shared by every lock; scalp roots retain their separate Head100% domain.
   const kernel=[1,4,6,4,1];
   for(let pass=0;pass<2;pass++)for(const axis of ['x','y'])rows=rows.map((r,row)=>r.map((_,col)=>{
    const mixed=new Map();for(let k=-2;k<=2;k++){
     const values=axis==='x'?rows[row][Math.max(0,Math.min(columns-1,col+k))]:rows[Math.max(0,Math.min(rows.length-1,row+k))][col];
     for(const [j,w]of values)mixed.set(j,(mixed.get(j)||0)+w*kernel[k+2]/16);
    }return mixed;
   }));
   fit.fields[front?'front':'back']={rows,start,step,xMin,xStep,columns,hits,fallbacks};
  }
 }
 const fieldStats=Object.fromEntries(Object.entries(fit.fields).map(([name,f])=>[name,{samples:f.rows.length*f.columns,rows:f.rows.length,columns:f.columns,xMin:f.xMin,xMax:f.xMin+(f.columns-1)*f.xStep,step:f.step,xStep:f.xStep,hits:f.hits.length,noHitFallbacks:f.fallbacks.reduce((n,r)=>n+r.count,0),fallbacks:f.fallbacks}])),stats={sampling:'Shared smooth X/Y neck, spine and clavicle fields, one per front/rear lock family',dressedEnvelope:!!kit.hairGarmentEnvelope,envelopeRepresentatives:kit.hairGarmentEnvelope?.representatives||[],headIndex:fit.headIndex,fallbackIndex:fit.fallback,blendStart:start,blendEnd:end,headOnly:0,sampled:0,fields:fieldStats,allowedJoints:[...fit.allowed].map(i=>({index:i,name:bones[i].name}))};
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i);const follow=1-smooth(end,start,point.y);let influences=new Map([[fit.headIndex,1]]);
  if(follow>0){
   stats.sampled++;const field=fit.fields[point.z>H.cz+.025?'front':'back'],fy=Math.max(0,Math.min(field.rows.length-1,(field.start-point.y)/field.step)),fx=Math.max(0,Math.min(field.columns-1,(point.x-field.xMin)/field.xStep)),y0=Math.floor(fy),y1=Math.min(field.rows.length-1,y0+1),x0=Math.floor(fx),x1=Math.min(field.columns-1,x0+1),ty=fy-y0,tx=fx-x0,torso=new Map();
   for(const [row,col,factor]of [[y0,x0,(1-ty)*(1-tx)],[y0,x1,(1-ty)*tx],[y1,x0,ty*(1-tx)],[y1,x1,ty*tx]])for(const [j,w]of field.rows[row][col])torso.set(j,(torso.get(j)||0)+w*factor);
   influences=new Map([...torso].map(([j,w])=>[j,w*follow]));influences.set(fit.headIndex,(influences.get(fit.headIndex)||0)+1-follow);
  }else stats.headOnly++;
  const ranked=[...influences].filter(([j,w])=>fit.allowed.has(j)&&Number.isFinite(w)&&w>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),total=ranked.reduce((s,p)=>s+p[1],0);if(!(total>0))throw Error('Invalid flexible hair weights');while(ranked.length<4)ranked.push([fit.headIndex,0]);joints.push(...ranked.map(p=>p[0]));weights.push(...ranked.map(p=>p[1]/total));
 }
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.userData.flexibleHair=true;geometry.userData.hairSkinning=stats;return geometry;
}

/* A rounded ribbon, with width running across the lock and a shallow lenticular
   section. Independent S-curves and staggered tips create layers rather than a sheet. */
function waveLeaf(THREE,points,width,thickness,outward,kit,profile={}){
 const path=new THREE.CatmullRomCurve3(points),P=[],UV=[],I=[],segments=54,sides=10;
 for(let i=0;i<=segments;i++){
  const t=i/segments,center=path.getPointAt(t),tangent=path.getTangentAt(t).normalize(),scalpBlend=kit&&profile.contact!=='back'?smooth(kit.head.chin.y+.013,kit.head.chin.y+.062,center.y):0;
  let sectionOut=outward.clone();
  const sampleScalp=target=>{if(!kit.hairFrontArchSurface)kit.hairFrontArchSurface=createTriangleSurface(THREE,kit.headAsset.local);const skull=new THREE.Vector3(kit.head.cx,kit.head.cy,kit.head.cz),direction=target.clone().sub(skull).normalize(),hit=kit.hairFrontArchSurface.cast(skull,direction);if(!hit)return null;const g=kit.headAsset.local,p=g.attributes.position,n=g.attributes.normal,bary=new THREE.Vector3();THREE.Triangle.getBarycoord(hit.point,new THREE.Vector3().fromBufferAttribute(p,hit.face.a),new THREE.Vector3().fromBufferAttribute(p,hit.face.b),new THREE.Vector3().fromBufferAttribute(p,hit.face.c),bary);const normal=new THREE.Vector3().fromBufferAttribute(n,hit.face.a).multiplyScalar(bary.x).addScaledVector(new THREE.Vector3().fromBufferAttribute(n,hit.face.b),bary.y).addScaledVector(new THREE.Vector3().fromBufferAttribute(n,hit.face.c),bary.z).normalize();if(normal.dot(direction)<0)normal.negate();return{point:hit.point,normal};};
  if(scalpBlend>0){const fit=sampleScalp(center);if(fit)sectionOut.lerp(fit.normal,scalpBlend);}
  const out=sectionOut.addScaledVector(tangent,-sectionOut.dot(tangent)).normalize(),side=out.clone().cross(tangent).normalize(),
   root=smooth(0,.13,t),tip=profile.rounded?Math.sqrt(Math.max(0,1-smooth(profile.taper??.78,1,t)**2)):1-smooth(profile.taper??.62,1,t),base=profile.root??.18,tipWidth=profile.tip??.035,breadth=width*(base+(1-base)*root)*(tipWidth+(1-tipWidth)*tip)*(1+.08*Math.sin(t*9.0)),depth=thickness*(.30+.70*root)*(.07+.93*tip);
  const ring=[];
  for(let j=0;j<=sides;j++){
   const angle=j/sides*Math.PI*2,across=Math.cos(angle),point=center.clone().addScaledVector(side,across*breadth).addScaledVector(out,Math.sin(angle)*depth*(1-.15*Math.abs(across)));
   if(scalpBlend>0){
    // The scalp-facing side stays buried beneath the crown while the exterior
    // arches gently above it. Each cross-section follows the actual curved
    // head; moving an entire straight ring outward made unsupported ridges.
    const query=center.clone().addScaledVector(side,across*breadth),fit=sampleScalp(query);
    if(fit){const outer=(1+Math.sin(angle))*.5,arch=depth*outer*(1-.15*Math.abs(across))*smooth(0,.15,t);point.lerp(fit.point.clone().addScaledVector(fit.normal,.0048+arch),scalpBlend);}
   }ring.push(point);
  }
  // Fit the full lenticular section as one ring, preserving its roundness.
  // Vertex-by-vertex projection flattens inner faces and makes blunt shelf tips.
  if(kit){const front=profile.contact!=='back',male=!front&&kit.body==='m'?.018*smooth(kit.head.chin.y-.065,kit.head.chin.y-.195,center.y):0,margin=(profile.padding??.009)+male,clearance=kit.hairGarmentEnvelope?Math.min(margin,.010+male):margin;let shift=0;
   for(const point of [...ring,center]){const z=hairBodyZ(THREE,kit,point.x,point.y,front);if(z!==null)shift=front?Math.max(shift,z+clearance-point.z):Math.min(shift,z-clearance-point.z);}
   for(const point of ring)point.z+=shift;
  }
  for(let j=0;j<=sides;j++){P.push(...ring[j].toArray());UV.push(j/sides*1.8,t*3);if(i<segments&&j<sides){const k=i*(sides+1)+j,n=sides+1;I.push(k,k+1,k+n,k+1,k+n+1,k+n);}}

 }
 // Seal both tapered ends; these small rounded tips remain visible from behind.
 for(const ring of [0,segments]){const c=new THREE.Vector3();for(let j=0;j<sides;j++)c.add(new THREE.Vector3().fromArray(P,(ring*(sides+1)+j)*3));c.multiplyScalar(1/sides);const id=P.length/3;P.push(...c.toArray());UV.push(.9,ring/segments*3+(ring ? .015 : -.015));for(let j=0;j<sides;j++){const k=ring*(sides+1)+j;ring?I.push(id,k,k+1):I.push(id,k+1,k);}}
 const geo=new THREE.BufferGeometry();geo.setIndex(I);geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));geo.computeVertexNormals();return geo;
}
/* One continuous exterior joins the crown and rear core. The seam is cut from
   existing crown triangles; the lower core and every separate lock stay exact. */
function joinedRearShell(THREE,kit,cap,fall,A,B,theta0,span){
 const H=kit.head,N=96,M=26,P=Array.from(cap.attributes.position.array),UV=Array.from(cap.attributes.uv.array),originalP=cap.attributes.position,originalUV=cap.attributes.uv,
  first=79,last=17,edgeTheta=31*Math.PI/48,wrap=theta=>theta<0?theta+Math.PI*2:theta,vertexTheta=[],cut=[],seam=[],cache=new Map(),indices=[];
 for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
  const theta=(i/N-.5)*Math.PI*2,a=Math.abs(theta),lower=originalP.getY(M*(N+1)+i),amount=smooth(edgeTheta,edgeTheta+.16,a),height=THREE.MathUtils.lerp(lower,Math.max(lower,H.cy+.031),amount);
  vertexTheta.push(wrap(theta));cut.push(originalP.getY(j*(N+1)+i)-height);
 }
 vertexTheta.push(Math.PI);cut.push(1);
 const interpolate=(a,b)=>{if(Math.abs(cut[a])<1e-9)return a;if(Math.abs(cut[b])<1e-9)return b;const key=a<b?a+':'+b:b+':'+a;if(cache.has(key))return cache.get(key);const t=cut[a]/(cut[a]-cut[b]),id=P.length/3;
  for(let k=0;k<3;k++)P.push(P[a*3+k]+(P[b*3+k]-P[a*3+k])*t);for(let k=0;k<2;k++)UV.push(UV[a*2+k]+(UV[b*2+k]-UV[a*2+k])*t);
  vertexTheta.push(vertexTheta[a]+(vertexTheta[b]-vertexTheta[a])*t);cut.push(0);cache.set(key,id);return id;
 };
 for(let i=0;i<cap.index.count;i+=3){const ids=[cap.index.getX(i),cap.index.getX(i+1),cap.index.getX(i+2)],rear=ids.every(id=>id!==M*(N+1)+N+1&&((id%(N+1))>=first||(id%(N+1))<=last));
  if(!rear){indices.push(...ids);continue;}const polygon=[];
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],inside=cut[a]>=-1e-9,next=cut[b]>=-1e-9;if(inside)polygon.push(a);if(inside!==next)polygon.push(interpolate(a,b));}
  const unique=polygon.filter((id,k)=>id!==polygon[(k+polygon.length-1)%polygon.length]);for(let k=1;k<unique.length-1;k++)indices.push(unique[0],unique[k],unique[k+1]);
 }
 cap.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));cap.setIndex(indices);cap.deleteAttribute('normal');cap.computeVertexNormals();
 // Boundary edges on the measured cut form a single rear arc. Duplicated UV
 // seam positions remain exact, while geometry below the arc is omitted.
 const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);}
 const ids=new Set();for(const [key,count]of edges)if(count===1){const [a,b]=key.split(':').map(Number);if(Math.abs(cut[a])<1e-7&&Math.abs(cut[b])<1e-7&&vertexTheta[a]>=edgeTheta-1e-6&&vertexTheta[b]>=edgeTheta-1e-6&&vertexTheta[a]<=Math.PI*2-edgeTheta+1e-6&&vertexTheta[b]<=Math.PI*2-edgeTheta+1e-6){ids.add(a);ids.add(b);}}
 const cp=cap.attributes.position,cu=cap.attributes.uv,cn=cap.attributes.normal;
 for(const id of [...ids].sort((a,b)=>vertexTheta[a]-vertexTheta[b]||a-b)){
  const p=new THREE.Vector3().fromBufferAttribute(cp,id);if(seam.length&&p.distanceTo(seam.at(-1).p)<1e-7)continue;seam.push({id,theta:vertexTheta[id],p,uv:new THREE.Vector2(cu.getX(id)+(vertexTheta[id]>=Math.PI&&cu.getX(id)<2.5?5:0),cu.getY(id)),normal:new THREE.Vector3().fromBufferAttribute(cn,id)});
 }
 if(seam.length<20)throw Error('Incomplete crown/fall seam');
 const fp=fall.attributes.position,fu=fall.attributes.uv,total=(A+1)*(B+1),
  // Use the first whole pre-existing row below the bounded join domain.
  joinRow=(()=>{for(let row=1;row<B-1;row++){let above=false;for(let col=0;col<=A;col++)if(fp.getY(row*(A+1)+col)>H.cy-.018)above=true;if(!above)return row;}return B-2;})();
 const kept=[];for(let i=0;i<fall.index.count;i+=3){const ids=[fall.index.getX(i),fall.index.getX(i+1),fall.index.getX(i+2)];if(ids.every(id=>Math.floor((id%total)/(A+1))>=joinRow))kept.push(...ids);}fall.setIndex(kept);fall.computeVertexNormals();
 const positions=[],uvs=[],I=[],topIds=[],ringIds=[[],[]],rows=7,seamSample=theta=>{let i=0;while(i<seam.length-2&&seam[i+1].theta<theta)i++;const a=seam[i],b=seam[i+1],t=THREE.MathUtils.clamp((theta-a.theta)/Math.max(1e-8,b.theta-a.theta),0,1);return {p:a.p.clone().lerp(b.p,t),uv:a.uv.clone().lerp(b.uv,t),normal:a.normal.clone().lerp(b.normal,t).normalize()};},push=(p,uv)=>{const id=positions.length/3;positions.push(...p.toArray());uvs.push(uv.x,uv.y);return id;};
 for(const s of seam)topIds.push(push(s.p,s.uv));
 for(let side=0;side<2;side++)for(let row=1;row<=rows;row++){
  const ring=[];for(let col=0;col<=A;col++){
   const theta=theta0+span*col/A,top=seamSample(theta),id=side*total+joinRow*(A+1)+col,end=new THREE.Vector3().fromBufferAttribute(fp,id),next=new THREE.Vector3().fromBufferAttribute(fp,id+(A+1)),dy=end.y-top.p.y,
    tangent0=new THREE.Vector3(0,-1,0).addScaledVector(top.normal,top.normal.y).normalize().multiplyScalar(Math.abs(dy)),tangent1=next.sub(end);tangent1.multiplyScalar(dy/Math.min(-1e-5,tangent1.y));
   const t=row/rows,t2=t*t,t3=t2*t,point=top.p.clone().multiplyScalar(2*t3-3*t2+1).addScaledVector(tangent0,t3-2*t2+t).addScaledVector(end,-2*t3+3*t2).addScaledVector(tangent1,t3-t2);
   if(side&&row<rows)point.addScaledVector(top.normal,-.004*(1-t));
   if(row<rows){const center=new THREE.Vector3(H.cx,H.cy,H.cz),fitted=scalpPoint(THREE,kit,point,side?-.0032:.0008),rawRadius=point.distanceTo(center),minimum=fitted.distanceTo(center);if(rawRadius<minimum)point.lerp(fitted,smooth(1,.25,t));}
   if(!point.toArray().every(Number.isFinite))throw Error('Join nonfinite '+JSON.stringify({side,row,col,theta,t,top:top.p.toArray(),normal:top.normal.toArray(),end:end.toArray(),tangent0:tangent0.toArray(),tangent1:tangent1.toArray(),joinRow,dy}));
   const uv=new THREE.Vector2(top.uv.x,top.uv.y+(top.p.y-point.y)*6);ring.push(push(point,uv));
  }ringIds[side].push(ring);
 }
 const topSides=[topIds];// A single angular chart follows the same columns down the joined shell.
 // The original core chart stretched across height, rotating the fine fibers.
 for(let side=0;side<2;side++)for(let row=joinRow;row<=B;row++)for(let col=0;col<=A;col++){const top=seamSample(theta0+span*col/A),id=side*total+row*(A+1)+col;fu.setXY(id,top.uv.x,top.uv.y+(top.p.y-fp.getY(id))*6);}
 const triangle=(side,a,b,c)=>side?I.push(a,c,b):I.push(a,b,c),angles=Array.from({length:A+1},(_,col)=>theta0+span*col/A);
 for(let side=0;side<2;side++){
  const top=side?seam.map(s=>push(s.p.clone().addScaledVector(s.normal,-.004),s.uv)):topIds,bottom=ringIds[side][0];topSides[side]=top;let a=0,b=0;
  while(a<top.length-1||b<bottom.length-1){if(b===bottom.length-1||(a<top.length-1&&seam[a+1].theta<=angles[b+1])){triangle(side,top[a],bottom[b],top[a+1]);a++;}else{triangle(side,top[a],bottom[b],bottom[b+1]);b++;}}
  for(let row=0;row<rows-1;row++)for(let col=0;col<A;col++){const a=ringIds[side][row][col],b=ringIds[side][row+1][col],c=ringIds[side][row][col+1],d=ringIds[side][row+1][col+1];triangle(side,a,b,c);triangle(side,c,b,d);}
 }
 for(const col of [0,A]){const topCol=col===0?0:seam.length-1,a=topSides[0][topCol],b=ringIds[0][0][col],c=topSides[1][topCol],d=ringIds[1][0][col];col===0?I.push(a,c,b,b,c,d):I.push(a,b,c,b,d,c);}
 for(let row=0;row<rows-1;row++)for(const col of [0,A]){const a=ringIds[0][row][col],b=ringIds[0][row+1][col],c=ringIds[1][row][col],d=ringIds[1][row+1][col];col===0?I.push(a,c,b,b,c,d):I.push(a,b,c,b,d,c);}
 const bridge=new THREE.BufferGeometry();bridge.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bridge.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));bridge.setIndex(I);bridge.computeVertexNormals();
 bridge.userData.crownFallJoin={seamCount:seam.length,joinRow,seamCapIndices:seam.map(s=>s.id),seamBridgeIndices:topIds,bottomBridgeIndices:ringIds[0].at(-1),bottomFallIndices:Array.from({length:A+1},(_,col)=>joinRow*(A+1)+col),capCount:cp.count,fallCount:fp.count,bridgeCount:positions.length/3,domain:{topY:Math.max(...seam.map(s=>s.p.y)),bottomY:Math.min(...ringIds[0].at(-1).map(id=>positions[id*3+1]))}};
 return bridge;
}

function joinedLooseShell(THREE,kit,cap,fall,A,B,theta0,span){
 const H=kit.head,N=96,M=26,P=Array.from(cap.attributes.position.array),UV=Array.from(cap.attributes.uv.array),originalP=cap.attributes.position,originalUV=cap.attributes.uv,
  first=79,last=17,edgeTheta=31*Math.PI/48,wrap=theta=>theta<0?theta+Math.PI*2:theta,vertexTheta=[],cut=[],seam=[],cache=new Map(),indices=[];
 for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
  const theta=(i/N-.5)*Math.PI*2,a=Math.abs(theta),lower=originalP.getY(M*(N+1)+i),amount=smooth(edgeTheta,edgeTheta+.16,a),height=THREE.MathUtils.lerp(lower,Math.max(lower,H.cy+.031),amount);
  vertexTheta.push(wrap(theta));cut.push(originalP.getY(j*(N+1)+i)-height);
 }
 vertexTheta.push(Math.PI);cut.push(1);
 const interpolate=(a,b)=>{if(Math.abs(cut[a])<1e-9)return a;if(Math.abs(cut[b])<1e-9)return b;const key=a<b?a+':'+b:b+':'+a;if(cache.has(key))return cache.get(key);const t=cut[a]/(cut[a]-cut[b]),id=P.length/3;
  for(let k=0;k<3;k++)P.push(P[a*3+k]+(P[b*3+k]-P[a*3+k])*t);for(let k=0;k<2;k++)UV.push(UV[a*2+k]+(UV[b*2+k]-UV[a*2+k])*t);
  vertexTheta.push(vertexTheta[a]+(vertexTheta[b]-vertexTheta[a])*t);cut.push(0);cache.set(key,id);return id;
 };
 for(let i=0;i<cap.index.count;i+=3){const ids=[cap.index.getX(i),cap.index.getX(i+1),cap.index.getX(i+2)],rear=ids.every(id=>id!==M*(N+1)+N+1&&((id%(N+1))>=first||(id%(N+1))<=last));
  if(!rear){indices.push(...ids);continue;}const polygon=[];
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],inside=cut[a]>=-1e-9,next=cut[b]>=-1e-9;if(inside)polygon.push(a);if(inside!==next)polygon.push(interpolate(a,b));}
  const unique=polygon.filter((id,k)=>id!==polygon[(k+polygon.length-1)%polygon.length]);for(let k=1;k<unique.length-1;k++)indices.push(unique[0],unique[k],unique[k+1]);
 }
 cap.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));cap.setIndex(indices);cap.deleteAttribute('normal');cap.computeVertexNormals();
 // Boundary edges on the measured cut form a single rear arc. Duplicated UV
 // seam positions remain exact, while geometry below the arc is omitted.
 const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);}
 const ids=new Set();for(const [key,count]of edges)if(count===1){const [a,b]=key.split(':').map(Number);if(Math.abs(cut[a])<1e-7&&Math.abs(cut[b])<1e-7&&vertexTheta[a]>=edgeTheta-1e-6&&vertexTheta[b]>=edgeTheta-1e-6&&vertexTheta[a]<=Math.PI*2-edgeTheta+1e-6&&vertexTheta[b]<=Math.PI*2-edgeTheta+1e-6){ids.add(a);ids.add(b);}}
 const cp=cap.attributes.position,cu=cap.attributes.uv,cn=cap.attributes.normal;
 for(const id of [...ids].sort((a,b)=>vertexTheta[a]-vertexTheta[b]||a-b)){
  const p=new THREE.Vector3().fromBufferAttribute(cp,id);if(seam.length&&p.distanceTo(seam.at(-1).p)<1e-7)continue;seam.push({id,theta:vertexTheta[id],p,uv:new THREE.Vector2(cu.getX(id)+(vertexTheta[id]>=Math.PI&&cu.getX(id)<2.5?5:0),cu.getY(id)),normal:new THREE.Vector3().fromBufferAttribute(cn,id)});
 }
 if(seam.length<20)throw Error('Incomplete crown/fall seam');
 const fp=fall.attributes.position,fu=fall.attributes.uv,total=(A+1)*(B+1),
  // Use the first whole pre-existing row below the bounded join domain.
  joinRow=(()=>{for(let row=1;row<B-1;row++){let above=false;for(let col=0;col<=A;col++)if(fp.getY(row*(A+1)+col)>H.chin.y+.012)above=true;if(!above)return row;}return B-2;})();
 const kept=[];for(let i=0;i<fall.index.count;i+=3){const ids=[fall.index.getX(i),fall.index.getX(i+1),fall.index.getX(i+2)];if(ids.every(id=>Math.floor((id%total)/(A+1))>=joinRow))kept.push(...ids);}fall.setIndex(kept);fall.computeVertexNormals();
 const positions=[],uvs=[],I=[],topIds=[],ringIds=[[],[]],rows=7,seamSample=theta=>{let i=0;while(i<seam.length-2&&seam[i+1].theta<theta)i++;const a=seam[i],b=seam[i+1],t=THREE.MathUtils.clamp((theta-a.theta)/Math.max(1e-8,b.theta-a.theta),0,1);return {p:a.p.clone().lerp(b.p,t),uv:a.uv.clone().lerp(b.uv,t),normal:a.normal.clone().lerp(b.normal,t).normalize()};},push=(p,uv)=>{const id=positions.length/3;positions.push(...p.toArray());uvs.push(uv.x,uv.y);return id;};
 for(const s of seam)topIds.push(push(s.p,s.uv));
 for(let side=0;side<2;side++)for(let row=1;row<=rows;row++){
  const ring=[];for(let col=0;col<=A;col++){
   const theta=theta0+span*col/A,top=seamSample(edgeTheta+(Math.PI*2-2*edgeTheta)*col/A),id=side*total+joinRow*(A+1)+col,end=new THREE.Vector3().fromBufferAttribute(fp,id),next=new THREE.Vector3().fromBufferAttribute(fp,id+(A+1)),dy=end.y-top.p.y,
    tangent0=new THREE.Vector3(0,-1,0).addScaledVector(top.normal,top.normal.y).normalize().multiplyScalar(Math.abs(dy)),tangent1=next.sub(end);tangent1.multiplyScalar(dy/Math.min(-1e-5,tangent1.y));
   const t=row/rows,t2=t*t,t3=t2*t,point=top.p.clone().multiplyScalar(2*t3-3*t2+1).addScaledVector(tangent0,t3-2*t2+t).addScaledVector(end,-2*t3+3*t2).addScaledVector(tangent1,t3-t2);
   if(side&&row<rows)point.addScaledVector(top.normal,-.004*(1-t));
   if(row<rows){const center=new THREE.Vector3(H.cx,H.cy,H.cz),fitted=scalpPoint(THREE,kit,point,side?-.0032:.0008),rawRadius=point.distanceTo(center),minimum=fitted.distanceTo(center);if(rawRadius<minimum)point.lerp(fitted,smooth(1,.25,t));}
   if(!point.toArray().every(Number.isFinite))throw Error('Join nonfinite '+JSON.stringify({side,row,col,theta,t,top:top.p.toArray(),normal:top.normal.toArray(),end:end.toArray(),tangent0:tangent0.toArray(),tangent1:tangent1.toArray(),joinRow,dy}));
   const uv=new THREE.Vector2(top.uv.x,top.uv.y+(top.p.y-point.y)*6);ring.push(push(point,uv));
  }ringIds[side].push(ring);
 }
 const topSides=[topIds];// A single angular chart follows the same columns down the joined shell.
 // The original core chart stretched across height, rotating the fine fibers.
 for(let side=0;side<2;side++)for(let row=joinRow;row<=B;row++)for(let col=0;col<=A;col++){const top=seamSample(edgeTheta+(Math.PI*2-2*edgeTheta)*col/A),id=side*total+row*(A+1)+col;fu.setXY(id,top.uv.x,top.uv.y+(top.p.y-fp.getY(id))*6);}
 const triangle=(side,a,b,c)=>side?I.push(a,c,b):I.push(a,b,c),angles=Array.from({length:A+1},(_,col)=>edgeTheta+(Math.PI*2-2*edgeTheta)*col/A);
 for(let side=0;side<2;side++){
  const top=side?seam.map(s=>push(s.p.clone().addScaledVector(s.normal,-.004),s.uv)):topIds,bottom=ringIds[side][0];topSides[side]=top;let a=0,b=0;
  while(a<top.length-1||b<bottom.length-1){if(b===bottom.length-1||(a<top.length-1&&seam[a+1].theta<=angles[b+1])){triangle(side,top[a],bottom[b],top[a+1]);a++;}else{triangle(side,top[a],bottom[b],bottom[b+1]);b++;}}
  for(let row=0;row<rows-1;row++)for(let col=0;col<A;col++){const a=ringIds[side][row][col],b=ringIds[side][row+1][col],c=ringIds[side][row][col+1],d=ringIds[side][row+1][col+1];triangle(side,a,b,c);triangle(side,c,b,d);}
 }
 for(const col of [0,A]){const topCol=col===0?0:seam.length-1,a=topSides[0][topCol],b=ringIds[0][0][col],c=topSides[1][topCol],d=ringIds[1][0][col];col===0?I.push(a,c,b,b,c,d):I.push(a,b,c,b,d,c);}
 for(let row=0;row<rows-1;row++)for(const col of [0,A]){const a=ringIds[0][row][col],b=ringIds[0][row+1][col],c=ringIds[1][row][col],d=ringIds[1][row+1][col];col===0?I.push(a,c,b,b,c,d):I.push(a,b,c,b,d,c);}
 const bridge=new THREE.BufferGeometry();bridge.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));bridge.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));bridge.setIndex(I);bridge.computeVertexNormals();
 bridge.userData.crownFallJoin={seamCount:seam.length,joinRow,seamCapIndices:seam.map(s=>s.id),seamBridgeIndices:topIds,bottomBridgeIndices:ringIds[0].at(-1),bottomFallIndices:Array.from({length:A+1},(_,col)=>joinRow*(A+1)+col),capCount:cp.count,fallCount:fp.count,bridgeCount:positions.length/3,method:'joined behind-ear cap arc to unchanged first whole row below chin+12mm;unified strand UV chart',domain:{topY:Math.max(...seam.map(s=>s.p.y)),bottomY:Math.min(...ringIds[0].at(-1).map(id=>positions[id*3+1]))}};
 return bridge;
}

function sculptedHairShape(THREE,kit,style){
 let joinMeta=null;const forelockMeta=[];const H=kit.head,V=(x,y,z)=>new THREE.Vector3(x,y,z),pieces=[],P=[],U=[],I=[],N=96,M=26,short=style==='pixie',fallOnly=style==='curlyFall',layered=['waves','mermaidwaves','beachbob'].includes(style),joinedLoose=['long','lob','bob'].includes(style);
 const line=theta=>{const a=Math.abs(theta),part=.0035*Math.exp(-1*((theta+.13)/.11)**2);
  if(layered){const front=H.browTop+.032+.010*Math.sin(Math.min(1,a/.90)*Math.PI*.5)**2-part,side=H.browTop+.042-.022*smooth(.90,1.85,a),back=H.browTop+.020-.088*smooth(1.85,Math.PI,a);return a<.90?front:a<1.85?side:back;}
  const original=a<.90?H.browTop+.032+.010*Math.sin(a/.90*Math.PI*.5)**2-part:a<1.55?H.browTop+.042-(a-.90)*.090:H.browTop-.0165-(a-1.55)*.045;
  return original+(joinedLoose?.012*smooth(.90,1.50,a)*(1-smooth(2.00,2.40,a)):0);};
 // The fitted crown is a single smooth shell with shallow directional clumps.
 for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
  const v=j/M,theta=(i/N-.5)*Math.PI*2,y=H.top-.003+(line(theta)-H.top+.003)*Math.pow(v,.72),section=Math.sqrt(Math.max(.00001,1-((y-H.cy)/Math.max(.01,H.ry))**2)),target=V(H.cx+Math.sin(theta)*H.rx*section,y,H.cz+Math.cos(theta)*H.rz*section),p=scalpPoint(THREE,kit,target,layered?.0006+.0039*(1-smooth(.73,1,v)):.0045),normal=p.clone().sub(V(H.cx,H.cy,H.cz)).normalize(),clump=.0017*Math.sin(theta*17+v*3)*Math.sin(v*Math.PI);
  const part=layered?Math.exp(-1*((p.x-H.cx-.007)/.0055)**2)*smooth(H.cy+.052,H.top-.006,p.y)*smooth(H.cz-.027,H.cz+.030,p.z):0;
  const edge=layered?(1-smooth(.70,1,v)):1;
  p.addScaledVector(normal,.003*edge+clump*edge-part*.0018*edge);P.push(...p.toArray());U.push(i/N*5,v*1.3);
  if(j<M&&i<N){const k=j*(N+1)+i;I.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}
 }
 // Close the UV seam with the same lifted ray hit on both endpoints.
 for(let j=0;j<=M;j++){const first=j*(N+1)*3,last=(j*(N+1)+N)*3;for(let k=0;k<3;k++)P[last+k]=P[first+k];}
 // The first crown row is a small ring, not a pole. Seal its opening with
 // the same fitted scalp sample; the positional UV seam above remains closed.
 const pole=scalpPoint(THREE,kit,V(H.cx,H.top+.015,H.cz),.007),poleIndex=P.length/3;P.push(...pole.toArray());U.push(2.5,-.045);
 for(let i=0;i<N;i++)I.push(poleIndex,i,i+1);
 const cap=new THREE.BufferGeometry();cap.setIndex(I);cap.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));cap.computeVertexNormals();pieces.push(cap);
 const lock=(pts,width,depth)=>{
  const path=new THREE.CatmullRomCurve3(pts),geo=new THREE.TubeGeometry(path,40,1,12,false),p=geo.attributes.position,u=geo.attributes.uv;
  for(let i=0;i<=40;i++){const t=i/40,center=path.getPointAt(t),tangent=path.getTangentAt(t),side=V(1,0,0).addScaledVector(tangent,-tangent.x).normalize(),out=tangent.clone().cross(side).normalize(),r=width*(.35+.65*Math.sin(Math.PI*Math.min(.999,t*.96+.04)))*Math.max(.025,1-t*t*t);
   for(let j=0;j<=12;j++){const k=i*13+j,a=j/12*Math.PI*2,point=center.clone().addScaledVector(side,Math.cos(a)*r).addScaledVector(out,Math.sin(a)*r*depth);p.setXYZ(k,point.x,point.y,point.z);u.setXY(k,j/12*2,t*3);}
  }geo.computeVertexNormals();pieces.push(geo);
 };
 if(!short){
  const ends={long:-.435,waves:-.375,mermaidwaves:-.515,lob:-.205,bob:-.060,beachbob:-.095,curlyFall:-.255},end=ends[style]??-.375,waved=['waves','mermaidwaves','beachbob','curlyFall'].includes(style),A=112,B=48,positions=[],uvs=[],indices=[],theta0=layered?2.02:1.43,span=Math.PI*2-2*theta0;
  // A closed draped fall provides a continuous silhouette. Low ridges separate
  // the clumps; the tips form an irregular soft U instead of a blunt curtain.
  for(let side=0;side<2;side++)for(let j=0;j<=B;j++)for(let i=0;i<=A;i++){
   const u=i/A,theta=theta0+span*u,t=j/B*(layered?(style==='beachbob'?.77:.68)+.022*Math.sin(theta*7.0+.7):1),sine=Math.sin(theta),cosine=Math.cos(theta),point=hairFallPoint(THREE,kit,style,theta,t);
   const normal=V(sine,0,cosine).normalize(),cover=layered?-.002+.006*smooth(.015,.10,t)-.007*smooth(.35,.65,t):.003;point.addScaledVector(normal,side?(layered?cover-.004:-.005):cover);positions.push(...point.toArray());uvs.push(u*8,t*3);
   if(j<B&&i<A){const k=side*(A+1)*(B+1)+j*(A+1)+i,n=A+1;if(side)indices.push(k,k+1,k+n,k+1,k+n+1,k+n);else indices.push(k,k+n,k+1,k+1,k+n,k+n+1);}
  }
  const total=(A+1)*(B+1);for(let j=0;j<B;j++)for(const i of [0,A]){const k=j*(A+1)+i,n=k+A+1;indices.push(k,n,k+total,n,n+total,k+total);}for(let i=0;i<A;i++){const k=B*(A+1)+i;indices.push(k,k+total,k+1,k+1,k+total,k+1+total);}
  const fall=new THREE.BufferGeometry();fall.setIndex(indices);fall.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));fall.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));fall.computeVertexNormals();if(layered||joinedLoose){const bridge=(joinedLoose?joinedLooseShell:joinedRearShell)(THREE,kit,cap,fall,A,B,theta0,span);joinMeta=bridge.userData.crownFallJoin;pieces.push(fall,bridge);}else pieces.push(fall);
 }
 // Overlapping back layers begin inside the fitted crown and follow the same
 // gravity-led fall. Their varied length and shallow S-bends break its outer contour.
 if(layered){
  const count=style==='mermaidwaves'?11:9,theta0=2.02,span=Math.PI*2-2*theta0;
  for(let j=0;j<count;j++){
   const theta=theta0+span*j/(count-1),normal=V(Math.sin(theta),0,Math.cos(theta)),length=1-.11*Math.abs(normal.x)-.055*(.5+.5*Math.sin(j*2.7+.8)),phase=j*1.73,pts=[];
   for(let k=0;k<=22;k++){
    const t=k/22,start=.045+.020*(.5+.5*Math.sin(j*2.1)),along=start+(length-start)*t,p=hairFallPoint(THREE,kit,style,theta,along),free=smooth(.10,.42,t),swing=(style==='beachbob'?.0025:.0045)*Math.sin(t*(style==='beachbob'?5.7:8.6)+phase)*free,
     depth=(style==='beachbob'?.0018:.0030)*Math.sin(t*7.3+phase+.6)*free;
    p.addScaledVector(normal,-.004*(1-smooth(.06,.24,t))+.0055*smooth(.14,.42,t)+depth);p.x+=swing;
    restHairPoint(THREE,kit,p,false,.017+(kit.body==='m'?.018*smooth(H.chin.y-.065,H.chin.y-.195,p.y):0));pts.push(p);
   }
   pieces.push(waveLeaf(THREE,pts,H.rx*(.23+.024*Math.sin(j*1.7)),.0058,normal,kit,{root:.22,tip:.10,taper:.84+(j%3)*.012,rounded:true,contact:'back',padding:.009}));
  }
  // Fitted framing stays on the temple and cheek. The shallow wave begins below
  // the jaw; two overlapping layers share a fall rather than forming an airy loop.
  for(const sd of [-1,1])for(let j=0;j<(style==='beachbob'?1:2);j++){
   const length=style==='beachbob'?.105:style==='mermaidwaves'?.245:.165,tipY=-length+j*(style==='beachbob'?.012:.037)+(sd>0?(style==='beachbob'?.010:.022):0),
    root=scalpPoint(THREE,kit,V(H.cx+.007+sd*(.009+j*.010),H.top-.014,H.cz+.024-j*.006),.006),
    brow=scalpPoint(THREE,kit,V(sd*H.rx*.82,H.browTop+.036-j*.006,H.cz+.058-j*.003),.007),
    temple=scalpPoint(THREE,kit,V(sd*H.rx*.98,H.cy+.002,H.cz+.047-j*.004),.008),
    jaw=scalpPoint(THREE,kit,V(sd*H.rx*.98,H.chin.y+.035,H.cz+.050-j*.004),.009),
    released=restHairPoint(THREE,kit,V(sd*(H.rx*.96+j*.004),H.chin.y-.026,H.cz+.046-j*.002),true,.019),
    bend=restHairPoint(THREE,kit,V(sd*(H.rx*1.06+j*.003),H.chin.y-.026+(tipY-H.chin.y+.026)*.40,H.cz+.052-j*.002),true,j?.019:.025),
    inside=restHairPoint(THREE,kit,V(sd*(H.rx*.91+j*.004),H.chin.y-.026+(tipY-H.chin.y+.026)*.73,H.cz+.057-j*.002),true,j?.019:.021),
    tip=restHairPoint(THREE,kit,V(sd*(H.rx*1.06+j*.004),tipY,H.cz+.060-j*.002),true,j?.019:.021);
   pieces.push(waveLeaf(THREE,[root,scalpPoint(THREE,kit,root.clone().lerp(brow,.52),.008),brow,temple,jaw,released,bend,inside,tip],H.rx*(.220-j*.050)*(sd>0?.89:1),.0058-j*.0009,V(sd*.50,0,1).normalize(),kit,{taper:.83,tip:.085,rounded:true,contact:'front',padding:.018}));
  }
 }

 // Long framing clumps follow the actual cheek/jaw before releasing onto the
 // torso. Preserve the source part roots and style-specific tip heights.
 const originalForelock=(sd,j,root,rootMid,temple,tipY,width)=>{
  const V=(x,y,z)=>new THREE.Vector3(x,y,z),below=H.chin.y-.024;
  const tip=restHairPoint(THREE,kit,V(sd*(H.rx*1.08+j*.007),tipY,H.cz+.076-j*.006),true,.013);
  const cheek=scalpPoint(THREE,kit,V(sd*H.rx*.97,H.cy-.026,H.cz+.056-j*.005),.008);
  const jaw=scalpPoint(THREE,kit,V(sd*H.rx*.95,H.chin.y+.024,H.cz+.047-j*.005),.009);
  const released=restHairPoint(THREE,kit,V(sd*(H.rx*.97+j*.004),below,H.cz+.047-j*.005),true,.013);
  const bend=restHairPoint(THREE,kit,V(sd*(H.rx*1.075+j*.007),below+(tipY-below)*.54,H.cz+.068-j*.006),true,.015);
  const points=[root,rootMid,temple,...[cheek,jaw,released,bend].filter(v=>v.y<temple.y-.002&&v.y>tipY+.005).sort((a,b)=>b.y-a.y),tip];
  const path=new THREE.CatmullRomCurve3(points),P=[],U=[],I=[],segments=64,sides=12,centers=[],widths=[],depths=[];
  for(let i=0;i<=segments;i++){
   const t=i/segments,c=path.getPointAt(t),tangent=path.getTangentAt(t).normalize(),out=V(sd*.58,0,1);out.addScaledVector(tangent,-out.dot(tangent)).normalize();const across=out.clone().cross(tangent).normalize();
   const rootGrow=.25+.75*smooth(0,.16,t),fallTaper=1-.58*smooth(.32,.86,t),end=smooth(.86,1,t),roundEnd=Math.sqrt(Math.max(.0001,1-end*end)),w=width*rootGrow*fallTaper*roundEnd,depth=width*.45*(.55+.45*smooth(0,.16,t))*fallTaper*roundEnd;
   centers.push(c.toArray());widths.push(w);depths.push(depth);
   for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,q=c.clone().addScaledVector(across,Math.cos(a)*w).addScaledVector(out,Math.sin(a)*depth);P.push(...q.toArray());U.push(k/sides*2,t*3);if(i<segments&&k<sides){const n=sides+1,v=i*n+k;I.push(v,v+1,v+n,v+1,v+n+1,v+n);}}
  }
  for(const i of [0,segments]){const id=P.length/3;P.push(...centers[i]);U.push(1,i/segments*3);for(let k=0;k<sides;k++){const v=i*(sides+1)+k;i?I.push(id,v+1,v):I.push(id,v,v+1);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));geometry.setIndex(I);geometry.computeVertexNormals();pieces.push(geometry);forelockMeta.push({side:sd,layer:j,sourceRoot:root.toArray(),tipY,tip:tip.toArray(),centerArcLength:path.getLength(),centers,widths,depths});
 };
 const longForelock=(sd,j,root,rootMid,temple,tipY,width)=>{
  const V=(x,y,z)=>new THREE.Vector3(x,y,z),below=H.chin.y-.024;
  const tip=restHairPoint(THREE,kit,V(sd*(H.rx*1.08+j*.007),tipY,H.cz+.076-j*.006),true,.013);
  const cheek=scalpPoint(THREE,kit,V(sd*H.rx*.97,H.cy-.026,H.cz+.056-j*.005),.008);
  const jaw=scalpPoint(THREE,kit,V(sd*H.rx*.95,H.chin.y+.024,H.cz+.047-j*.005),.009);
  const released=restHairPoint(THREE,kit,V(sd*(H.rx*.97+j*.004),below,H.cz+.047-j*.005),true,.013);
  const bend=restHairPoint(THREE,kit,V(sd*(H.rx*1.075+j*.007),below+(tipY-below)*.54,H.cz+.068-j*.006),true,.015);
  const points=[root,rootMid,temple,...[cheek,jaw,released,bend].filter(v=>v.y<temple.y-.002&&v.y>tipY+.005).sort((a,b)=>b.y-a.y),tip];
  const path=new THREE.CatmullRomCurve3(points),arcLength=path.getLength(),P=[],U=[],I=[],sides=12,centers=[],widths=[],depths=[];
  // The shorter lock shares the longer lock's lower flow at equal anatomical
  // height. Its tip tucks under that surface; the long outline remains intact.
  const parentFlow=j?forelockMeta.find(c=>c.side===sd&&c.layer===0):null;
  const parentAtHeight=y=>{
   if(!parentFlow)return null;
   const a=parentFlow.centers;
   for(let k=1;k<a.length;k++)if(a[k-1][1]>=y&&a[k][1]<=y){
    const f=(a[k-1][1]-y)/(a[k-1][1]-a[k][1]||1),c=V(...a[k-1]).lerp(V(...a[k]),f),tangent=V(...a[k]).sub(V(...a[k-1])).normalize(),out=V(sd*.58,0,1);out.addScaledVector(tangent,-out.dot(tangent)).normalize();
    return{c,out,across:out.clone().cross(tangent).normalize(),w:parentFlow.widths[k-1]*(1-f)+parentFlow.widths[k]*f,depth:parentFlow.depths[k-1]*(1-f)+parentFlow.depths[k]*f};
   }
   return null;
  };
  const flowAt=t=>{
   const c=path.getPointAt(t),parent=parentAtHeight(c.y),blend=parent?smooth(H.chin.y-.003,H.chin.y-.060,c.y):0;
   if(blend){const q=parent.c.clone().addScaledVector(parent.across,sd*parent.w*.12).addScaledVector(parent.out,-parent.depth*.10);q.y=c.y;c.lerp(q,blend);}
   return{c,parent,blend};
  };
  // Leave the fitted scalp and temple section exactly where it was. Shape the
  // free lock as one unequal, shallow clump, rather than parallel round cords.
  let lo=0,hi=1;
  for(let n=0;n<32;n++){const mid=(lo+hi)*.5;if(path.getUtoTmapping(mid)<2/(points.length-1))lo=mid;else hi=mid;}
  const protectedArc=(lo+hi)*.5,capLength=.019-j*.002,capStart=1-capLength/arcLength;
  const arcParameters=Array.from({length:65},(_,i)=>i/64);
  // Extra rings resolve the last centimetre without resampling protected roots.
  for(let i=0;i<8;i++)arcParameters.push(capStart+(1-capStart)*i/8);
  arcParameters.sort((a,b)=>a-b);
  const samples=arcParameters.filter((t,i)=>!i||t-arcParameters[i-1]>1e-10),segments=samples.length-1;
  for(let i=0;i<=segments;i++){
   const t=samples[i],flow=flowAt(t),c=flow.c,tangent=flow.blend?flowAt(Math.min(1,t+1e-5)).c.sub(flowAt(Math.max(0,t-1e-5)).c).normalize():path.getTangentAt(t).normalize(),out=V(sd*.58,0,1);out.addScaledVector(tangent,-out.dot(tangent)).normalize();const across=out.clone().cross(tangent).normalize();
   const rootGrow=.25+.75*smooth(0,.16,t),oldTaper=1-.58*smooth(.32,.86,t),oldEnd=smooth(.86,1,t),oldRound=Math.sqrt(Math.max(.0001,1-oldEnd*oldEnd));
   const oldWidth=width*rootGrow*oldTaper*oldRound,oldDepth=width*.45*(.55+.45*smooth(0,.16,t))*oldTaper*oldRound;
   const free=smooth(protectedArc,Math.min(.84,protectedArc+.18),t),cap=Math.max(0,Math.min(1,(t-capStart)/(1-capStart))),roundEnd=Math.sqrt(Math.max(.00001,1-cap*cap));
   const shapedWidth=width*.80*rootGrow*(1-.66*smooth(.32,.98,t))*roundEnd;
   let w=oldWidth+(shapedWidth-oldWidth)*free,depth=oldDepth+(shapedWidth*(.235+j*.020)-oldDepth)*free;
   if(flow.blend){w+=(Math.min(w,flow.parent.w*.75)-w)*flow.blend;depth+=(Math.min(depth,flow.parent.depth*.75)-depth)*flow.blend;}
   centers.push(c.toArray());widths.push(w);depths.push(depth);
   const ridgeCenter=.12+.20*Math.sin((t-protectedArc)*2.8+sd*.35+j*.7);
   for(let k=0;k<=sides;k++){
    const a=k/sides*Math.PI*2,x=Math.cos(a),y=Math.sin(a),outer=Math.max(0,y),ridge=w*.075*Math.exp(-Math.pow((x-ridgeCenter)/.34,2))*outer*outer*free;
    const q=c.clone().addScaledVector(across,x*w+w*.10*y*y*free*(j?-.7:1)).addScaledVector(out,y*depth+ridge);P.push(...q.toArray());U.push(k/sides*2,t*3);
    if(i<segments&&k<sides){const n=sides+1,v=i*n+k;I.push(v,v+1,v+n,v+1,v+n+1,v+n);}
   }
  }
  for(const i of [0,segments]){const id=P.length/3;P.push(...centers[i]);U.push(1,samples[i]*3);for(let k=0;k<sides;k++){const v=i*(sides+1)+k;i?I.push(id,v+1,v):I.push(id,v,v+1);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));geometry.setIndex(I);geometry.computeVertexNormals();pieces.push(geometry);forelockMeta.push({side:sd,layer:j,sourceRoot:root.toArray(),tipY,tip:tip.toArray(),centerArcLength:arcLength,centers,widths,depths,arcParameters:samples,protectedArc,capLength,profileFlow5:true,sourceTip:tip.toArray(),emittedTip:flowAt(1).c.toArray(),flowReleaseChinY:H.chin.y,flowMethod:parentFlow?"short underlap into main at equal height":"main flow preserved"});
 };
 const faceFollowingForelock=style==='long'?longForelock:originalForelock;
 // Swept framing leaves blend the part into the temple and break the outline.
 if(!fallOnly&&!layered)for(const sd of [-1,1])for(let j=0;j<(short?5:2);j++){
  const root=scalpPoint(THREE,kit,V(sd*(.018+j*.012),H.top-.007,H.cz+.032),.005),temple=scalpPoint(THREE,kit,V(sd*H.rx*.91,H.browTop+.031-j*.010,H.cz+.083),.006),tipEnd=style==='bob'?-.050:style==='beachbob'?-.078:style==='lob'?-.118:style==='mermaidwaves'?-.185:style==='waves'?-.132:-.152,tip=short?scalpPoint(THREE,kit,V(sd*H.rx,H.browTop-.010-j*.009,H.cz+.038),.004):V(sd*(H.rx*1.10+j*.007),tipEnd+j*.027,H.cz+.126+j*.004),mid=short?temple.clone().lerp(tip,.52):V(sd*(H.rx*.97+.007*Math.sin(j*1.7)),(temple.y+tip.y)*.45,H.cz+.142+.007*Math.cos(j*1.6));
  const rootMid=scalpPoint(THREE,kit,root.clone().lerp(temple,.54),.008);
  if(short)lock([root,rootMid,temple,mid,tip],.011-j*.0012,.26);
  else faceFollowingForelock(sd,j,root,rootMid,temple,tipEnd+j*.027,.0175-j*.0034);
 }
 const geometry=mergeHairGeometry(THREE,pieces);if(joinMeta)geometry.userData.crownFallJoin=joinMeta;if(forelockMeta.length)geometry.userData.forelockCorrection={version:1,method:'source-root-preserving cheek/jaw/torso curve, rounded lenticular clumps, continuous lower taper; same style tip heights',clumps:forelockMeta};return layered?flexibleHair(THREE,kit,geometry):geometry;
}

/* The measured skull narrows sharply at the nape. A bounding-box radius leaves
   tails hanging in space there, so every root is projected onto the real head. */
export function scalpPoint(THREE,kit,target,lift=.002){
 if(!kit.hairSurface){
  const H=kit.head;
  let geometry=kit.headAsset?.local;
  if(!geometry){const source=kit.skin,hi=source.skeleton.bones.findIndex(b=>b.name==='Head');geometry=source.geometry.clone().applyMatrix4(source.skeleton.boneInverses[hi]);}
  kit.hairSurface=createHeadSurface(THREE,geometry,new THREE.Vector3(H.cx,H.cy,H.cz));
  if(!kit.headAsset)geometry.dispose();
 }
 return kit.hairSurface.sample(target,lift);
}

export function hairDetails({THREE,kit,style,helmet,tube,merge,tiePoint}){
 const H=kit.head,hair=[],ties=[],ribbon=[],V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const anchor=p=>scalpPoint(THREE,kit,p,-.003);
 const ring=(p,r=0.016,dir=V(0,-1,0))=>{const g=new THREE.TorusGeometry(r,0.0022,7,24);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),dir.clone().normalize()));g.translate(p.x,p.y,p.z);ties.push(g);return g;};
 const curve=(points,radii,segs=30,rad=8)=>tube(points,radii,segs,rad);
 // Broad, shallow cross sections overlap into a continuous mass of hair.
 const lock=(points,radii,segs=36,width=1.25,depth=.72)=>{
  const geo=curve(points,radii,segs,12),axis=new THREE.CatmullRomCurve3(points),p=geo.attributes.position;
  for(let i=0;i<=segs;i++){const center=axis.getPointAt(i/segs),tangent=axis.getTangentAt(i/segs),n=Math.abs(tangent.x)<.9?V(1,0,0):V(0,0,1);n.addScaledVector(tangent,-n.dot(tangent)).normalize();const b=tangent.clone().cross(n);
   for(let j=0;j<=12;j++){const k=i*13+j,t=i/segs,ripple=1+.035*Math.sin(t*18.0+j*.91)*Math.sin(t*Math.PI),offset=V(p.getX(k),p.getY(k),p.getZ(k)).sub(center),point=center.clone().addScaledVector(n,offset.dot(n)*width*ripple).addScaledVector(b,offset.dot(b)*depth*ripple);p.setXYZ(k,point.x,point.y,point.z);}
  }
  geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
 };
 const gather=(at,end,r=.015)=>{const start=anchor(at),mid=start.clone().lerp(end,.5);hair.push(curve([start,mid,end],[r*1.2,r,r*.9],12));};
 const pony=(at,length=.30)=>{
  at=anchor(at);const pieces=[],splay=Math.sign(at.x)*Math.min(1,Math.abs(at.x)/.06);
  const axis=new THREE.CatmullRomCurve3([at,at.clone().add(V(0,-.014,-.024)),at.clone().add(V(.006+splay*.017,-length*.32,-.054)),at.clone().add(V(.012+splay*.023,-length*.68,-.061)),at.clone().add(V(.007+splay*.020,-length,-.047))]);
  // Overlapping inner leaves form a continuous tail, while the outer leaves
  // separate into different lengths with a soft bend and tapered ends.
  for(let j=0;j<18;j++){
   const angle=j*2.399963,outer=j>=4,spread=outer?.010+.004*Math.sin(j*1.9):.003,tip=outer?.83+.17*(.5+.5*Math.sin(j*2.7)):1,pts=[];
   for(let k=0;k<=12;k++){
    const t=k/12,along=t*tip,center=axis.getPoint(along),fan=Math.sin(t*Math.PI)*.006,grow=Math.min(1,t*7),wave=.0035*Math.sin(t*8+j*1.7)*Math.sin(t*Math.PI);
    center.x+=(Math.cos(angle)*(spread+fan)+wave)*grow;center.z+=Math.sin(angle)*spread*.62*grow;pts.push(center);
   }
   pieces.push(lock(pts,outer?[.003,.008,.009,.007,.004,.00035]:[.005,.010,.011,.009,.005,.0005],44,1.45,.66));
  }
  hair.push(merge(pieces));
  const band=axis.getPoint(.085),direction=axis.getTangent(.085);ring(band,.016,direction);ring(band.clone().addScaledVector(direction,.0032),.016,direction);
 };
 const wrappedBraid=(points,radius=0.017,turns=7,rooted=true)=>{
  if(rooted)points[0]=anchor(points[0]);
  turns*=.62;radius*=.91;const axis=new THREE.CatmullRomCurve3(points),pieces=[],samples=Math.max(64,Math.ceil(turns*28));
  for(let strand=0;strand<3;strand++){
   const pts=[];
   for(let k=0;k<=samples;k++){
    const t=k/samples,along=rooted?t*.90:t,center=axis.getPoint(along),tangent=axis.getTangent(along).normalize();
    const side=Math.abs(tangent.x)>.85?V(0,0,1):V(1,0,0);side.addScaledVector(tangent,-side.dot(tangent)).normalize();const cross=tangent.clone().cross(side);
    const a=t*turns*Math.PI*2+strand*Math.PI*2/3,rr=radius*(1-0.48*t)*(rooted?Math.min(1,t*18):1);
    center.addScaledVector(side,Math.cos(a)*rr).addScaledVector(cross,Math.sin(a)*rr*.66);pts.push(center);
   }
   const scale=radius/.017;pieces.push(lock(pts,[0.0065,0.0074,0.0065,0.0045,0.0025].map(v=>v*scale),Math.max(96,Math.ceil(turns*32)),1.10,.83));
  }
  if(rooted){
   const end=axis.getPoint(.90),direction=axis.getTangent(.90);ring(end,radius*.57,direction);
   for(let j=0;j<5;j++){const a=j/5*Math.PI*2,spread=V(Math.cos(a),0,Math.sin(a));spread.addScaledVector(direction,-spread.dot(direction)).normalize();
    const start=end.clone().addScaledVector(spread,radius*.20),middle=axis.getPoint(.97).addScaledVector(spread,radius*.38),tip=axis.getPoint(1).addScaledVector(direction,.008+.003*Math.sin(j));
    pieces.push(lock([start,middle,tip],[radius*.26,radius*.23,.0004],18,1.2,.7));
   }
  }
  hair.push(merge(pieces));
 };
 const braid=(points,radius=.017,turns=7,rooted=true)=>{
  // Crown/bun weaves retain their existing scalp paths in this bounded change.
  if(!rooted)return wrappedBraid(points,radius,turns,false);
  points=points.map(p=>p.clone());points[0]=anchor(points[0]);
  radius*=.91;turns*=.44;
  const axis=new THREE.CatmullRomCurve3(points),samples=Math.max(144,Math.ceil(turns*48)),sides=12,pieces=[],frames=[];
  const binding={assembly:hair.length,axis:points.map(p=>p.toArray()),front:style==='sidebraid',radius};let previousTangent=null,previousSide=null;
  for(let k=0;k<=samples;k++){
   const t=k/samples,center=axis.getPoint(t*.90),tangent=axis.getTangent(t*.90).normalize();
   const side=previousSide?previousSide.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(previousTangent,tangent)):V(1,0,0);
   side.addScaledVector(tangent,-side.dot(tangent)).normalize();
   frames.push({center,tangent,side,cross:tangent.clone().cross(side)});
   previousTangent=tangent;previousSide=side;
  }
  for(let strand=0;strand<3;strand++){
   const centers=frames.map((f,k)=>{
    const t=k/samples,phase=t*turns*Math.PI*2+strand*Math.PI*2/3,r=radius*(1-.62*t),gather=(.25+.75*smooth(0,.10,t))*(1-smooth(.85,1,t));
    return f.center.clone().addScaledVector(f.side,Math.sin(phase)*r*.64*gather).addScaledVector(f.cross,Math.sin(2*phase)*r*.34*gather);
   });
   const P=[],UV=[],I=[];
   for(let k=0;k<=samples;k++){
    const t=k/samples,center=centers[k],tangent=centers[Math.min(samples,k+1)].clone().sub(centers[Math.max(0,k-1)]).normalize();
    const side=frames[k].side.clone().addScaledVector(tangent,-frames[k].side.dot(tangent)).normalize(),cross=tangent.clone().cross(side),width=radius*.60*(1-.62*t),depth=width*.62;
    for(let j=0;j<=sides;j++){
     const angle=j/sides*Math.PI*2,point=center.clone().addScaledVector(side,Math.cos(angle)*width).addScaledVector(cross,Math.sin(angle)*depth);
     P.push(...point.toArray());UV.push(j/sides*2,t*3);
     if(k<samples&&j<sides){const v=k*(sides+1)+j,w=v+sides+1;I.push(v,w,v+1,w,w+1,v+1);}
    }
   }
   // Closed ends meet at the tie, so neither a tapered gap nor an open rim shows.
   for(const k of [0,samples]){
    const centerIndex=P.length/3;P.push(...centers[k].toArray());UV.push(1,k/samples*3);
    for(let j=0;j<sides;j++){const v=k*(sides+1)+j;if(k===0)I.push(centerIndex,v,v+1);else I.push(centerIndex,v+1,v);}
   }
   // The lateral/cross frame uses tangent cross side; reverse the ring winding
   // so side walls and both caps face outward.
   for(let i=0;i<I.length;i+=3)[I[i+1],I[i+2]]=[I[i+2],I[i+1]];
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));geometry.setIndex(I);geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData.braidBinding={...binding,part:'weave',along:Array.from({length:(samples+1)*(sides+1)},(_,i)=>Math.floor(i/(sides+1))/samples*.90).concat([0,.90])};pieces.push(geometry);
  }
  const end=axis.getPoint(.90),direction=axis.getTangent(.90);const tie=ring(end,radius*.35,direction);tie.userData.braidBinding={...binding,part:'tie',along:Array(tie.attributes.position.count).fill(.90)};
  for(let j=0;j<5;j++){
   const phase=j/5*Math.PI*2,spread=frames[samples].side.clone().multiplyScalar(Math.cos(phase)).addScaledVector(frames[samples].cross,Math.sin(phase));
   const start=end.clone().addScaledVector(direction,-.002).addScaledVector(spread,radius*.10),middle=axis.getPoint(.97).addScaledVector(spread,radius*.24),tip=axis.getPoint(1).addScaledVector(direction,.008+.003*Math.sin(j));
   const tail=lock([start,middle,tip],[radius*.24,radius*.19,.0004],18,1.2,.7);tail.userData.braidBinding={...binding,part:'tail',along:Array.from({length:tail.attributes.position.count},(_,i)=>.90+.10*Math.floor(i/13)/18)};pieces.push(tail);
  }
  const geometry=merge(pieces);geometry.userData.braidWeave={version:3,root:points[0].toArray(),tie:end.toArray(),tip:axis.getPoint(1).toArray(),strands:3,closedEnds:true,transport:'parallel along shared axis',rooted:true};hair.push(geometry);
 };
 const bun=(messy=false,anchor=null)=>{
  const root=anchor||tiePoint(kit,helmet||!messy?'nape':'crown'),at=root.clone();at.z-=0.014;
  if(!helmet&&(style==='classicbun'||style==='messybun')){at.y+=.018;at.z-=.008;}
  gather(root,at,.019);
  const core=new THREE.SphereGeometry(.035,24,16);core.scale(1.08,.82,.69);core.translate(at.x,at.y,at.z-.006);
  const pieces=[core];
  for(let j=0;j<10;j++){
   const pts=[],a0=j*.6283185;
   for(let k=0;k<=24;k++){
    const t=k/24,a=t*Math.PI*2.7+a0,r=(.032+.0025*Math.sin(j*2.3))*Math.sin(t*Math.PI);
    const x=Math.cos(a)*r*(messy?1.18:1.1),y=Math.sin(a)*r*.72,z=-.006-.029*Math.sqrt(Math.max(.04,1-(x/.043)**2-(y/.031)**2));
    pts.push(V(at.x+x,at.y+y,at.z+z));
   }
   pieces.push(lock(pts,[.005,.010,.010,.008,.002],36,1.15,.85));
  }
  if(messy&&!helmet)for(const sd of [-1,1])pieces.push(curve([V(sd*H.rx,H.browTop+.015,H.cz+.025),V(sd*(H.rx+.009),H.browTop-.025,H.cz+.045),V(sd*(H.rx+.005),H.browTop-.065,H.cz+.035)],[.004,.003,.0008],16));
  hair.push(merge(pieces));ring(at,.021);
 };
 if(style==='ponytail'||style==='lowpony'||style==='ribbonpony'||style==='halfup'){
  const at=tiePoint(kit,(style==='halfup'||style==='ponytail')&&!helmet?'back':'nape');
  pony(at,style==='halfup'?.20:.29);
  if(style==='ribbonpony'){
   for(const sd of [-1,1]){
    const g=new THREE.SphereGeometry(1,14,10);g.scale(.031,.013,.006);g.rotateZ(sd*.35);g.translate(at.x+sd*.026,at.y+.004,at.z-.019);ribbon.push(g);
    const tail=new THREE.PlaneGeometry(.019,.061,1,4);tail.rotateZ(sd*.20);tail.translate(at.x+sd*.013,at.y-.036,at.z-.020);ribbon.push(tail);
   }
  }
 }else if(style==='ringlets'){
  hair.push(sculptedHairShape(THREE,kit,'curlyFall'));
  const locks=[];
  // A closed softly waved fall carries the silhouette. A smaller set of varied
  // ribbon curls follows it; no repeated tube grid or shoulder-sized rope mass.
  for(let j=0;j<19;j++){
   const theta=1.45+j/18*(Math.PI*2-2.90),phase=j*2.399963,first=.16+.065*(.5+.5*Math.sin(j*2.17)),last=.92+.07*(.5+.5*Math.sin(j*2.31)),pts=[];
   for(let k=0;k<=52;k++){
    const t=k/52,along=first+(last-first)*t,center=hairFallPoint(THREE,kit,'curlyFall',theta,along),hang=Math.max(0,(t-.12)/.88),turn=hang*(18+2.7*Math.sin(j*1.71))+phase,wave=.009*smooth(0,.20,t)*Math.sin(Math.PI*t);
    center.x+=Math.sin(turn)*wave;center.z+=Math.cos(turn+.4)*wave*.66;center.addScaledVector(V(Math.sin(theta),0,Math.cos(theta)).normalize(),.0025);pts.push(center);
   }
   locks.push(lock(pts,[.0002,.0033,.0045,.0038,.0021,.0002],56,1.28,.53));
  }
  hair.push(merge(locks));
 }else if(style==='highpony'){
  pony(tiePoint(kit,helmet?'nape':'crown'),.37);
 }else if(style==='bubblepony'){
  const at=tiePoint(kit,helmet?'nape':'back'),pieces=[];
  gather(at,at.clone().add(V(0,-.010,-.024)),.013);
  for(let i=0;i<5;i++){
   const center=V(at.x+Math.sin(i*.7)*.012,at.y-.033-i*.057,at.z-.026-i*.008),r=.027-i*.003;
   for(let j=0;j<10;j++){
    const a=j/10*Math.PI*2,pts=[];for(let k=0;k<=12;k++){const t=k/12,rr=.008+Math.sin(t*Math.PI)*r;pts.push(V(center.x+Math.cos(a)*rr,center.y+.030-t*.060,center.z+Math.sin(a)*rr));}
    pieces.push(curve(pts,[.004,.006,.006,.004],16));
   }
   ring(V(center.x,center.y-.028,center.z),.010);
  }
  hair.push(merge(pieces));ring(at);
 }else if(style==='braidedpony'){
  const at=tiePoint(kit,helmet?'nape':'back');braid([at,V(at.x,at.y-.10,at.z-.055),V(at.x+.025,at.y-.24,at.z-.06),V(at.x+.04,at.y-.38,at.z-.04)],.0165,8.5);
 }else if(style==='twintails'||style==='pigtails'){
  for(const sd of [-1,1])pony(V(sd*H.rx*(style==='pigtails'?.98:.86),H.cy-(style==='pigtails'?.004:.055),H.cz-.072),style==='pigtails'?.27:.24);
 }else if(style==='halfupbun'){
  bun(false,tiePoint(kit,helmet?'nape':'back'));
 }else if(style==='braidedbun'){
  const at=tiePoint(kit,'nape'),pts=[];
  gather(at,at.clone().add(V(0,0,-.025)),.020);
  for(let i=0;i<=60;i++){const t=i/60,a=t*Math.PI*5,r=.012+.03*t;pts.push(V(at.x+Math.cos(a)*r,at.y+Math.sin(a)*r*.75,at.z-.024-t*.018));}
  braid(pts,.009,15,false);
 }else if(style==='twists'){
  const pieces=[];
  for(let j=0;j<17;j++){
   const a=1.20+j/16*(Math.PI*2-2.4),start=scalpPoint(THREE,kit,V(Math.sin(a)*H.rx,H.cy+.022,H.cz+Math.cos(a)*H.rz),.012);
   for(let strand=0;strand<2;strand++){
    const pts=[],crown=V(Math.sin(a)*.028,H.top-.008,H.cz+Math.cos(a)*.030);
    for(let k=0;k<=52;k++){
     const t=k/52,turn=t*Math.PI*23+strand*Math.PI,root=Math.min(1,t*20),hang=Math.max(0,(t-.28)/.72);
     const center=t<.28?scalpPoint(THREE,kit,crown.clone().lerp(start,t/.28),.008):V(start.x+Math.sin(a)*hang*.016,start.y-hang*(.30+.018*Math.cos(j*3)),start.z-.020*hang);
     pts.push(center.add(V(Math.cos(turn)*.005*root,0,Math.sin(turn)*.005*root)));
    }
    pieces.push(curve(pts,[.0045,.006,.006,.004,.001],58,6));
   }
  }
  hair.push(merge(pieces));
 }else if(style==='sidebraid'){
  const T=tiePoint(kit,'nape');
  braid([T,V(.064,.015,-.065),V(.080,-.075,.016),V(.092,-.16,.084),V(.095,-.28,.133)],.014,9);
 }else if(style==='twinbraids'){
  for(const sd of [-1,1])braid([V(sd*H.rx*.80,H.cy-.044,H.cz-.060),V(sd*.080,-.028,-.076),V(sd*.090,-.15,-.090),V(sd*.087,-.27,-.098)],.013,8);
 }else if(style==='crownbraid'){
  if(helmet)bun();else{
   const pts=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;pts.push(scalpPoint(THREE,kit,V(Math.sin(a)*H.rx,H.cy+.046+.022*Math.cos(a),H.cz+Math.cos(a)*H.rz),.005));}
   braid(pts,.0065,18,false);
  }
 }else if(style==='classicbun')bun(false,tiePoint(kit,helmet?'nape':'crown'));
  else if(style==='lowbun'||style==='messybun')bun(style==='messybun');
 else if(style==='coils'||style==='croppedcoils'){
  const pieces=[],cropped=style==='croppedcoils';
  for(let j=0;j<420;j++){
   const th=j*2.39996322973,phi=Math.acos(1-(j+.5)/420*1.38);
   const target=V(Math.sin(th)*Math.sin(phi)*H.rx,H.cy+Math.cos(phi)*H.ry,H.cz+Math.cos(th)*Math.sin(phi)*H.rz);
   if(Math.cos(th)>.35&&target.y<H.browTop+.026)continue;
   const size=(cropped?.0085:.017)*(1+.18*Math.sin(j*7.3+Math.cos(j*2.8)));
   const root=scalpPoint(THREE,kit,target,.001),normal=root.clone().sub(V(H.cx,H.cy,H.cz)).normalize();
   const tangent=V(Math.cos(th),0,-Math.sin(th)).normalize(),cross=normal.clone().cross(tangent).normalize(),pts=[];
   for(let k=0;k<=20;k++){const t=k/20,a=t*Math.PI*2.7+j*.83,r=size*(.36+.35*Math.sin(Math.PI*t));pts.push(root.clone().addScaledVector(normal,size*(.16+.50*Math.sin(Math.PI*t))).addScaledVector(tangent,Math.cos(a)*r).addScaledVector(cross,Math.sin(a)*r));}
   pieces.push(curve(pts,[size*.28,size*.32,size*.29,size*.13],22,6));
  }
  hair.push(merge(pieces));
 }
 return {hair,ties,ribbon};
}

/* Keep the sculpted part and face-framing locks of the loose style, drawing the
   lengths back around the ears into a compact crown for tied styles. */
export function gatheredCrown(THREE,source,kit){
 const geo=source.clone(),p=geo.attributes.position,index=geo.index;
 // The source has individual sculpted locks. Keep its five front locks; its
 // loose back curtain would turn into a blunt bob when gathered up.
 const parent=Array.from({length:p.count},(_,i)=>i),weld=new Map();
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{parent[root(a)]=root(b);};
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);}
 for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
 const bounds=new Map();for(let i=0;i<p.count;i++){const id=root(i),b=bounds.get(id)||{z:Infinity,y:-Infinity};b.z=Math.min(b.z,p.getZ(i));b.y=Math.max(b.y,p.getY(i));bounds.set(id,b);}
 const kept=[];for(let i=0;i<index.count;i+=3){const b=bounds.get(root(index.getX(i)));if(b.z>.019&&b.y>.18)kept.push(index.getX(i),index.getX(i+1),index.getX(i+2));}
 geo.setIndex(kept);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const originalY=y;
  if(y<.145){
   const t=smooth((.145-y)/.18);
   y=.145+(y-.145)*.78;
   z-=.012*t;
   const point=new THREE.Vector3(x,y,z),fitted=scalpPoint(THREE,kit,point,.006);
   point.lerp(fitted,smooth((.15-originalY)/.20));
   x=point.x;y=point.y;z=point.z;
  }
  p.setXYZ(i,x,y,z);
 }
 smoothHairNormals(geo);geo.computeBoundingSphere();return geo;
}

function smoothHairNormals(geo){
 // Reshaping changes the lighting frame, even when the shared source already has tangents.
 geo.deleteAttribute('tangent');
 geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 for(const ids of groups.values()){let x=0,y=0,z=0;for(const i of ids){x+=n.getX(i);y+=n.getY(i);z+=n.getZ(i);}const length=Math.hypot(x,y,z)||1;for(const i of ids)n.setXYZ(i,x/length,y/length,z/length);}
}

/* Subdivide the source locks once, sharing positional adjacency across UV seams.
   UVs stay on their own charts; scalp projection keeps the crown above the head. */
export function polishHairSurface(THREE,source,kit,name='Hair_Long'){
 const pos=source.attributes.position,uv=source.attributes.uv,weld=new Map(),vertices=[],ids=[];
 for(let i=0;i<pos.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(pos,i),key=[p.x,p.y,p.z].map(v=>Math.round(v*1e5)).join(',');
  if(!weld.has(key)){weld.set(key,vertices.length);vertices.push({p,near:new Set(),boundary:new Set()});}ids.push(weld.get(key));
 }
 const indices=source.index?Array.from(source.index.array):Array.from({length:pos.count},(_,i)=>i),edges=new Map();
 const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
 for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3).map(n=>ids[n]);for(let j=0;j<3;j++){
  const a=tri[j],b=tri[(j+1)%3],opposite=tri[(j+2)%3];if(a===b)continue;
  vertices[a].near.add(b);vertices[b].near.add(a);const key=edgeKey(a,b);
  if(!edges.has(key))edges.set(key,{a,b,opposite:[]});edges.get(key).opposite.push(opposite);
 }}
 for(const e of edges.values())if(e.opposite.length===1){vertices[e.a].boundary.add(e.b);vertices[e.b].boundary.add(e.a);}
 const constrain=p=>{
  if(p.y>.09){const scalp=scalpPoint(THREE,kit,p,.0025),center=new THREE.Vector3(kit.head.cx,kit.head.cy,kit.head.cz),distance=p.distanceTo(center),skinDistance=scalp.distanceTo(center);
   if(distance<skinDistance)p.copy(scalp);
   else if(['Hair_Long','Hair_SimpleParted','Hair_Ponytail','Hair_Bun'].includes(name)&&p.y>kit.head.cy+.048){const crown=Math.min(1,(p.y-kit.head.cy-.048)/.055),excess=Math.max(0,distance-skinDistance-.009);if(excess)p.addScaledVector(p.clone().sub(center).normalize(),-excess*crown*.68);}}
  return p;
 };
 const smooth=vertices.map(v=>{
  const ns=[...v.near],bs=[...v.boundary],p=v.p.clone();
  if(bs.length===2){p.multiplyScalar(.75);for(const n of bs)p.addScaledVector(vertices[n].p,.125);}
  else if(bs.length===0&&ns.length>2){const beta=ns.length===3?3/16:3/(8*ns.length);p.multiplyScalar(1-ns.length*beta);for(const n of ns)p.addScaledVector(vertices[n].p,beta);}
  return constrain(p);
 });
 for(const e of edges.values()){
  e.p=vertices[e.a].p.clone().add(vertices[e.b].p).multiplyScalar(e.opposite.length===2?.375:.5);
  if(e.opposite.length===2)for(const n of e.opposite)e.p.addScaledVector(vertices[n].p,.125);constrain(e.p);
 }
 const positions=[],uvs=[],faces=[],seams=new Map();
 for(let i=0;i<indices.length;i+=3){
  const original=indices.slice(i,i+3),v=original.map(n=>ids[n]);if(new Set(v).size<3)continue;
  const points=v.map(n=>smooth[n]),tex=original.map(n=>new THREE.Vector2(uv.getX(n),uv.getY(n)));
  for(let j=0;j<3;j++){points.push(edges.get(edgeKey(v[j],v[(j+1)%3])).p);tex.push(tex[j].clone().lerp(tex[(j+1)%3],.5));}
  for(const tri of [[0,3,5],[3,1,4],[5,4,2],[3,4,5]])for(const n of tri){const values=[...points[n].toArray(),...tex[n].toArray()],key=values.map(v=>Math.round(v*1e6)).join(',');if(!seams.has(key)){seams.set(key,positions.length/3);positions.push(...values.slice(0,3));uvs.push(...values.slice(3));}faces.push(seams.get(key));}
 }
 const geo=new THREE.BufferGeometry();geo.setIndex(faces);geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 smoothHairNormals(geo);geo.computeBoundingSphere();return geo;
}
