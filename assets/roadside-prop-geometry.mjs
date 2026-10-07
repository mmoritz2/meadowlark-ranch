/* Original joined timber bench. Pure metre-space data: no renderer, resources,
 * scene mutation, collision metadata or random stream. Build once, instance it.
 * Positive Z is the front; X is the seat span; all four feet touch Y = 0.
 */
const IDENTITY=[[1,0,0],[0,1,0],[0,0,1]];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);if(l<1e-12)throw Error('Zero bench axis');return mul(a,1/l);};
const transform=(p,origin,axes)=>add(origin,p.reduce((v,s,i)=>add(v,mul(axes[i],s)),[0,0,0]));
const direction=(p,axes)=>p.reduce((v,s,i)=>add(v,mul(axes[i],s)),[0,0,0]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function axesAlongY(axis){
 const y=unit(axis),seed=Math.abs(y[0])<.9?[1,0,0]:[0,0,1],x=unit(sub(seed,mul(y,dot(seed,y))));
 return [x,y,unit(cross(x,y))];
}
function boundsOf(positions,start=0,count=positions.length/3){
 if(!count)return {min:[0,0,0],max:[0,0,0],size:[0,0,0]};
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=start;i<start+count;i++)for(let k=0;k<3;k++){min[k]=Math.min(min[k],positions[i*3+k]);max[k]=Math.max(max[k],positions[i*3+k]);}
 return {min,max,size:max.map((v,i)=>v-min[i])};
}
function matrixOf(origin,axes){return [...axes[0],0,...axes[1],0,...axes[2],0,...origin,1];}

export const ROADSIDE_BENCH_SPEC=Object.freeze({
 width:1.55,seatDepth:.51,seatHeight:.46,seatThickness:.065,
 footX:.59,footZ:.20,footHeight:.385,footWidth:.085,
 bearerWidth:.11,bearerHeight:.075,bearerDepth:.56,bearerY:.3615,
 fitHeight:.16,backRecline:-.10,backSlatHeight:.13,backSlatDepth:.055,
 backSlatY:Object.freeze([.69,.86]),footprintRadius:.85,
 woodGrainMetres:.74,agedGrainMetres:1.8,
});

export function createRoadsideBenchGeometry(){
 const groups=Object.fromEntries(['wood','aged','iron'].map(key=>[key,{positions:[],normals:[],uvs:[],indices:[]}]));
 const components=[],attachments=[],timberOrdinal={wood:0,aged:0},S=ROADSIDE_BENCH_SPEC;
 function begin(id,material,kind,origin,axes,shape){
  const g=groups[material],component={id,material,kind,origin:[...origin],axes:axes.map(a=>[...a]),matrix:matrixOf(origin,axes),shape,
   vertexStart:g.positions.length/3,indexStart:g.indices.length,faces:[]};
  components.push(component);return {g,component};
 }
 function vertex(g,p,n,uv){const index=g.positions.length/3;g.positions.push(...p.map(v=>Math.fround(Math.abs(v)<1e-12?0:v)));g.normals.push(...n.map(Math.fround));g.uvs.push(...uv.map(Math.fround));return index;}
 function finish(g,c){c.vertexCount=g.positions.length/3-c.vertexStart;c.indexCount=g.indices.length-c.indexStart;c.triangles=c.indexCount/3;c.bounds=boundsOf(g.positions,c.vertexStart,c.vertexCount);}
 function triangle(g,a,b,c){g.indices.push(a,b,c);}
 function timber(id,material,kind,size,origin,axes=IDENTITY,grainAxis=0,bevel=.008,levels={}){
  const r=Math.min(bevel,...size.map(s=>s*.2)),half=size.map(s=>s/2),inner=half.map(h=>h-r),metres=material==='wood'?S.woodGrainMetres:S.agedGrainMetres;
  const {g,component:c}=begin(id,material,kind,origin,axes,{type:'roundedBox',size:[...size],bevel:r});c.grainAxis=grainAxis;c.grainDirection=[...axes[grainAxis]];c.grainMetres=metres;
  // Authored cut phases avoid stamping one identical photographed strip onto
  // every board. They change neither physical grain scale nor the world RNG.
  const cut=timberOrdinal[material]++,phase=[.15+(cut%7)*.173,.43+(cut%5)*.119];c.uvPhase=phase;
  // A four-coordinate grid makes a flat face, two round-edge subdivisions and
  // a spherical corner patch. Adjacent face seams share exact positions/normals.
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const other=[0,1,2].filter(k=>k!==axis),u=other[0],v=other[1],start=g.positions.length/3,indexStart=g.indices.length;
   const coords=k=>[...new Set([-half[k],-inner[k],...(levels[k]||[]),inner[k],half[k]])].sort((a,b)=>a-b);
   const us=coords(u),vs=coords(v),columns=us.length;
   for(let j=0;j<vs.length;j++)for(let i=0;i<us.length;i++){
    const p=[0,0,0];p[axis]=sign*half[axis];p[u]=us[i];p[v]=vs[j];
    const centre=p.map((value,k)=>clamp(value,-inner[k],inner[k])),normal=unit(sub(p,centre)),rounded=add(centre,mul(normal,r));
    let uv;
    if(axis===grainAxis){const ends=[0,1,2].filter(k=>k!==grainAxis);uv=[rounded[ends[0]]/metres+phase[0],rounded[ends[1]]/metres+phase[1]];}
    else{const across=[0,1,2].find(k=>k!==axis&&k!==grainAxis);uv=[rounded[grainAxis]/metres+phase[0],rounded[across]/metres+phase[1]];}
    vertex(g,transform(rounded,origin,axes),direction(normal,axes),uv);
   }
   const faceDirection=[0,0,0];faceDirection[axis]=sign;const positive=dot(cross(IDENTITY[u],IDENTITY[v]),faceDirection)>0;
   for(let j=0;j<vs.length-1;j++)for(let i=0;i<us.length-1;i++){
    const a=start+j*columns+i,b=a+1,d=a+columns,e=d+1;
    if(positive){triangle(g,a,b,e);triangle(g,a,e,d);}else{triangle(g,a,e,b);triangle(g,a,d,e);}
   }
   c.faces.push({axis,sign,vertexStart:start,vertexCount:us.length*vs.length,indexStart,indexCount:g.indices.length-indexStart,grainFace:axis!==grainAxis});
  }
  finish(g,c);return c;
 }
 function beam(id,material,kind,a,b,width,depth){const origin=mul(add(a,b),.5);return timber(id,material,kind,[width,Math.hypot(...sub(b,a)),depth],origin,axesAlongY(sub(b,a)),1,.006);}
 function cylinder(id,kind,origin,axis,radius,height,segments,bevel=0){
  const axes=axesAlongY(axis),{g,component:c}=begin(id,'iron',kind,origin,axes,{type:'cylinder',radius,height,segments,bevel});
  const lo=-height/2,hi=height/2,rings=bevel?[[radius*.82,lo],[radius,lo+bevel],[radius,hi-bevel],[radius*.82,hi]]:[[radius,lo],[radius,hi]];
  for(let band=0;band<rings.length-1;band++){
   const [r0,y0]=rings[band],[r1,y1]=rings[band+1],start=g.positions.length/3,slope=-(r1-r0)/(y1-y0);
   for(const [r,y]of [[r0,y0],[r1,y1]])for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,p=[Math.cos(a)*r,y,Math.sin(a)*r],n=unit([Math.cos(a),slope,Math.sin(a)]);
    vertex(g,transform(p,origin,axes),direction(n,axes),[a*radius,y]);
   }
   for(let i=0;i<segments;i++){const a=start+i,b=a+segments+1;triangle(g,a,b,a+1);triangle(g,a+1,b,b+1);}
  }
  for(const [r,y,sign]of [[rings[0][0],lo,-1],[rings.at(-1)[0],hi,1]]){
   const centre=vertex(g,transform([0,y,0],origin,axes),direction([0,sign,0],axes),[0,0]),start=g.positions.length/3;
   for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,p=[Math.cos(a)*r,y,Math.sin(a)*r];vertex(g,transform(p,origin,axes),direction([0,sign,0],axes),[p[0],p[2]]);}
   for(let i=0;i<segments;i++)if(sign>0)triangle(g,centre,start+i+1,start+i);else triangle(g,centre,start+i,start+i+1);
  }
  finish(g,c);return c;
 }
 function attach(a,b,point){attachments.push({a,b,point:[...point]});}
 function fastener(id,board,face,axis){
  const washerHeight=.003,embed=.001,headHeight=.009;
  const washer=cylinder(id+':washer','washer',add(face,mul(axis,washerHeight/2-embed)),axis,.0155,washerHeight,8);
  const headBase=add(face,mul(axis,washerHeight-embed)),head=cylinder(id+':head','boltHead',add(headBase,mul(axis,headHeight/2)),axis,.0105,headHeight,6,.0018);
  attach(board,washer.id,face);attach(washer.id,head.id,headBase);
 }
 const backAxis=[0,Math.cos(S.backRecline),Math.sin(S.backRecline)],frontAxis=[0,-Math.sin(S.backRecline),Math.cos(S.backRecline)];
 const backStartY=.20,backTopY=.975,backLine=(x,y)=>[x,y,-S.footZ+(y-backStartY)*Math.tan(S.backRecline)];
 for(const [side,x]of [['left',-S.footX],['right',S.footX]]){
  for(const [end,z]of [['front',S.footZ],['rear',-S.footZ]]){
   timber(`leg:${side}:${end}`,'wood','leg',[S.footWidth,S.footHeight,S.footWidth],[x,S.footHeight/2,z],IDENTITY,1,.008,{1:[S.fitHeight-S.footHeight/2]});
  }
  timber(`bearer:${side}`,'aged','bearer',[S.bearerWidth,S.bearerHeight,S.bearerDepth],[x,S.bearerY,0],IDENTITY,2,.010);
  for(const [end,z]of [['front',S.footZ],['rear',-S.footZ]])attach(`leg:${side}:${end}`,`bearer:${side}`,[x,.36,z]);
  const a=[x,.18,S.footZ],b=[x,.36,-S.footZ];beam(`brace:${side}`,'aged','brace',a,b,.060,.060);attach(`brace:${side}`,`leg:${side}:front`,a);attach(`brace:${side}`,`bearer:${side}`,b);
  beam(`backPost:${side}`,'wood','backPost',backLine(x,backStartY),backLine(x,backTopY),.075,.075);
  attach(`backPost:${side}`,`leg:${side}:rear`,backLine(x,.23));
  fastener(`bolt:frame:${side}`,`bearer:${side}`,[x+Math.sign(x)*S.bearerWidth/2,.36,-S.footZ],[Math.sign(x),0,0]);
 }
 for(let i=0;i<4;i++){
  const z=-S.seatDepth/2+(i+.5)*S.seatDepth/4,id=`seat:${i}`;
  timber(id,'wood','seatSlat',[S.width,S.seatThickness,S.seatDepth/4-.006],[0,S.seatHeight-S.seatThickness/2,z],IDENTITY,0,.010);
  for(const [side,x]of [['left',-S.footX],['right',S.footX]]){attach(id,`bearer:${side}`,[x,.397,z]);fastener(`bolt:seat:${i}:${side}`,id,[x,S.seatHeight,z],[0,1,0]);}
 }
 const axes=[[1,0,0],backAxis,frontAxis];
 for(let i=0;i<S.backSlatY.length;i++){
  const y=S.backSlatY[i],id=`back:${i}`,offset=.075/2+S.backSlatDepth/2-.004,origin=add(backLine(0,y),mul(frontAxis,offset));
  timber(id,'wood','backSlat',[S.width,S.backSlatHeight,S.backSlatDepth],origin,axes,0,.009);
  for(const [side,x]of [['left',-S.footX],['right',S.footX]]){
   attach(id,`backPost:${side}`,add(backLine(x,y),mul(frontAxis,.075/2-.002)));
   fastener(`bolt:back:${i}:${side}`,id,add(add(origin,[x,0,0]),mul(frontAxis,S.backSlatDepth/2)),frontAxis);
  }
 }
 for(const [key,g]of Object.entries(groups)){
  g.positions=new Float32Array(g.positions);g.normals=new Float32Array(g.normals);g.uvs=new Float32Array(g.uvs);g.indices=new Uint32Array(g.indices);g.bounds=boundsOf(g.positions);g.triangles=g.indices.length/3;
  g.grainMetres=key==='wood'?S.woodGrainMetres:key==='aged'?S.agedGrainMetres:null;
 }
 const all=Object.values(groups).flatMap(g=>Array.from(g.positions)),bounds=boundsOf(all),footprint=Math.max(...components.map(c=>{
  const g=groups[c.material];let radius=0;for(let i=c.vertexStart;i<c.vertexStart+c.vertexCount;i++)radius=Math.max(radius,Math.hypot(g.positions[i*3],g.positions[i*3+2]));return radius;
 }));
 return {version:1,groups,components,attachments,spec:S,bounds,footprintRadius:footprint,
  triangles:Object.values(groups).reduce((sum,g)=>sum+g.triangles,0),vertices:Object.values(groups).reduce((sum,g)=>sum+g.positions.length/3,0)};
}


/* Three roadside placements can share three baked material batches. The low
 * foot ring fits real ground; everything above the 0.16m ring stays authored.
 * Height derivatives are sampled independently in world space, and normals
 * use the actual deformation Jacobian's inverse transpose. No tick hook.
 */
export function fitRoadsideBenchGeometry(template,placements,heightAt,{embed=.001,normalStep=.001}={}){
 if(!template?.groups||!Array.isArray(placements)||typeof heightAt!=='function'||!Number.isFinite(embed)||embed<0||!Number.isFinite(normalStep)||normalStep<=0)throw Error('Invalid bench fitting input');
 const fitHeight=template.spec.fitHeight,groups=Object.fromEntries(Object.keys(template.groups).map(key=>[key,{positions:[],normals:[],uvs:[],indices:[],sites:[]}])),sites=[];
 let minVerticalScale=1,maxContactError=0;
 const sample=(x,z)=>{const y=heightAt(x,z);if(!Number.isFinite(y))throw Error('Nonfinite bench ground');return y;};
 for(let siteIndex=0;siteIndex<placements.length;siteIndex++){
  const p=placements[siteIndex],rootY=p.y??p.rootY;
  if(![p.x,rootY,p.z,p.yaw].every(Number.isFinite))throw Error('Nonfinite bench placement');
  const visible=p.visible!==false,c=Math.cos(p.yaw),s=Math.sin(p.yaw),point=a=>[p.x+c*a[0]+s*a[2],rootY+a[1],p.z-s*a[0]+c*a[2]],rotate=a=>[c*a[0]+s*a[2],a[1],-s*a[0]+c*a[2]];
  const site={siteIndex,x:p.x,y:rootY,z:p.z,yaw:p.yaw,visible,groups:{},components:[],footContacts:[],footprintRadius:0};
  for(const [material,source]of Object.entries(template.groups)){
   const g=groups[material],vertexStart=g.positions.length/3,indexStart=g.indices.length,parts=template.components.filter(v=>v.material===material),legs=parts.filter(v=>v.kind==='leg');
   const owner=new Int16Array(source.positions.length/3).fill(-1),scales=new Float64Array(source.positions.length/3).fill(1);
   legs.forEach((leg,i)=>{for(let k=leg.vertexStart;k<leg.vertexStart+leg.vertexCount;k++)owner[k]=i;});
   if(visible){
    for(let i=0;i<source.positions.length/3;i++){
     const a=Array.from(source.positions.slice(i*3,i*3+3)),n=rotate(Array.from(source.normals.slice(i*3,i*3+3))),world=point(a);
     // The sampler sees exactly the X/Z floats the renderer will draw.
     world[0]=Math.fround(world[0]);world[2]=Math.fround(world[2]);
     let normal=n;
     if(owner[i]>=0&&a[1]<fitHeight-1e-7){
      const ground=sample(world[0],world[2]),delta=ground-rootY-embed,w=1-a[1]/fitHeight,b=1-delta/fitHeight;
      if(!(b>0))throw Error('Bench foot fit would invert its vertical surface');
      const hx=(sample(world[0]+normalStep,world[2])-sample(world[0]-normalStep,world[2]))/(2*normalStep),hz=(sample(world[0],world[2]+normalStep)-sample(world[0],world[2]-normalStep))/(2*normalStep);
      world[1]=rootY+a[1]+w*delta;
      normal=unit([n[0]-w*hx*n[1]/b,n[1]/b,n[2]-w*hz*n[1]/b]);scales[i]=b;minVerticalScale=Math.min(minVerticalScale,b);
     }
     g.positions.push(...world.map(Math.fround));g.normals.push(...normal.map(Math.fround));g.uvs.push(source.uvs[i*2],source.uvs[i*2+1]);
     site.footprintRadius=Math.max(site.footprintRadius,Math.hypot(world[0]-p.x,world[2]-p.z));
    }
    for(const index of source.indices)g.indices.push(vertexStart+index);
    for(const part of parts){site.components.push({id:part.id,kind:part.kind,material,vertexStart:vertexStart+part.vertexStart,vertexCount:part.vertexCount,indexStart:indexStart+part.indexStart,indexCount:part.indexCount,bounds:boundsOf(g.positions,vertexStart+part.vertexStart,part.vertexCount)});}
    for(const leg of legs){
     const vertices=[];let footScale=1,minGroundGap=Infinity,maxGroundGap=-Infinity,error=0;
     for(let i=leg.vertexStart;i<leg.vertexStart+leg.vertexCount;i++){
      footScale=Math.min(footScale,scales[i]);
      if(Math.abs(source.positions[i*3+1])>1e-7)continue;
      const index=vertexStart+i,x=g.positions[index*3],y=g.positions[index*3+1],z=g.positions[index*3+2],gap=y-sample(x,z);
      vertices.push(index);minGroundGap=Math.min(minGroundGap,gap);maxGroundGap=Math.max(maxGroundGap,gap);error=Math.max(error,Math.abs(gap+embed));
     }
     if(!vertices.length)throw Error('Bench foot has no ground contact vertices');
     const root=point([leg.origin[0],0,leg.origin[2]]);root[0]=Math.fround(root[0]);root[2]=Math.fround(root[2]);root[1]=sample(root[0],root[2])-embed;
     site.footContacts.push({id:leg.id,material,vertexIndices:vertices,bottomContactCount:vertices.length,maxContactError:error,minGroundGap,maxGroundGap,root:{x:root[0],y:root[1],z:root[2],groundY:root[1]+embed},minVerticalScale:footScale});
     maxContactError=Math.max(maxContactError,error);
    }
   }
   const range={siteIndex,x:p.x,y:rootY,z:p.z,yaw:p.yaw,visible,vertexStart,vertexCount:g.positions.length/3-vertexStart,indexStart,indexCount:g.indices.length-indexStart,footprintRadius:site.footprintRadius};
   site.groups[material]={vertexStart:range.vertexStart,vertexCount:range.vertexCount,indexStart:range.indexStart,indexCount:range.indexCount};g.sites.push(range);
  }
  // Every group carries the complete site footprint, including its tiny iron.
  for(const g of Object.values(groups))g.sites.at(-1).footprintRadius=site.footprintRadius;
  if(site.footprintRadius>template.spec.footprintRadius+1e-5)throw Error('Bench fit escaped its existing collider footprint');
  sites.push(site);
 }
 let geometryBytes=0,triangles=0,vertices=0;
 for(const [material,g]of Object.entries(groups)){
  g.positions=new Float32Array(g.positions);g.normals=new Float32Array(g.normals);g.uvs=new Float32Array(g.uvs);g.indices=new Uint32Array(g.indices);g.bounds=boundsOf(g.positions);g.triangles=g.indices.length/3;g.grainMetres=template.groups[material].grainMetres;
  geometryBytes+=g.positions.byteLength+g.normals.byteLength+g.uvs.byteLength+g.indices.byteLength;triangles+=g.triangles;vertices+=g.positions.length/3;
 }
 return {version:1,groups,sites,spec:template.spec,stats:{sites:placements.length,visibleSites:placements.filter(p=>p.visible!==false).length,triangles,vertices,geometryBytes,fitHeight,embed,normalStep,minVerticalScale,maxContactError}};
}
