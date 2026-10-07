import {enableOpaqueFoliageCoverage,patchFoliageCoverage} from './tree-impostors.js?v=canopy-lighting-1';

// Original bulrush geometry. Curved leaves, round stems and brown seed heads
// occupy the same one-metre envelope as the old settlement reed cards.
export function createReedGeometry(T){
 const P=[],N=[],C=[],I=[],col=new T.Color();
 const vertex=(x,y,z,nx,ny,nz,hex,shade=1)=>{P.push(x,y,z);N.push(nx,ny,nz);col.set(hex).multiplyScalar(shade);C.push(col.r,col.g,col.b);};
 for(let leaf=0;leaf<9;leaf++){
  const a=leaf*2.39996,ca=Math.cos(a),sa=Math.sin(a),root=.025+(leaf%3)*.037,h=.48+(leaf%5)*.08,bend=.24+(leaf%4)*.052,w=.014+(leaf%3)*.003,b=P.length/3;
  for(let j=0;j<=4;j++){
   const t=j/4,width=w*Math.pow(1-t,.7)*(.7+.5*Math.sin(t*Math.PI)),heading=a+.32*t*(leaf%2?1:-1),sx=-Math.sin(heading),sz=Math.cos(heading);
   const n=new T.Vector3(-ca*.4,.82,-sa*.4).normalize();
   for(const side of j===4?[0]:[-1,1])vertex(ca*(root+bend*t*t)+sx*width*side,h*(t-.24*t*t*t),sa*(root+bend*t*t)+sz*width*side,n.x,n.y,n.z,leaf%4===0?'#9e9d61':'#708b43',.64+.36*t);
   const k=b+j*2;if(j<3)I.push(k,k+1,k+2,k+1,k+3,k+2);else if(j===3)I.push(k,k+1,k+2);
  }
 }
 function tube(x,z,bottom,height,radius,head,phase){
  const b=P.length/3,fine=radius<.005,rings=head?4:fine?1:2,sides=fine?3:6;
  for(let j=0;j<=rings;j++){
   const t=j/rings,y=bottom+height*t,bend=.018*y*y;
   const r=radius*(head?(.55+.45*Math.sin(t*Math.PI)):(1-.32*t));
   for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2+phase,c=Math.cos(a),s=Math.sin(a);vertex(x+c*r+bend,y,z+s*r,c,0,s,head?'#695039':'#75864b',head?.78+.22*(k%3)/2:1);}
  }
  for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const a=b+j*sides+k,aa=b+j*sides+(k+1)%sides;I.push(a,a+sides,aa,aa,a+sides,aa+sides);}
  const lo=P.length/3;vertex(x+.018*bottom*bottom,bottom,z,0,-1,0,head?'#695039':'#75864b');const top=bottom+height,hi=P.length/3;vertex(x+.018*top*top,top,z,0,1,0,head?'#8a7151':'#75864b');
  for(let k=0;k<sides;k++){I.push(lo,b+k,b+(k+1)%sides);const off=b+rings*sides;I.push(hi,off+(k+1)%sides,off+k);}
 }
 for(let i=0;i<3;i++){
  const a=i*2.4,x=Math.cos(a)*.08,z=Math.sin(a)*.08,h=.81+i*.10;
  tube(x,z,0,h,.009,false,a);
  if(i!==1){tube(x,z,h-.19,.15,.029,true,a);tube(x+.018*h*h,z,h-.04,.095,.0038,false,a);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingBox();g.computeBoundingSphere();g.name='Original curved bulrush';return g;
}

// Nearby reed beds use actual leaves/stems. Existing cards carry the shoreline
// into the distance. A complementary pixel mask blends both without translucency.
export function createReedBeds({THREE:T,scene,sources,player,getQuality=()=> 'high'}){
 const active=sources.filter(Boolean),records=[],m=new T.Matrix4(),color=new T.Color();
 for(const source of active){source.updateWorldMatrix(true,false);for(let i=0;i<source.count;i++){
  source.getMatrixAt(i,m);if(Math.abs(m.determinant())<1e-8)continue;m.premultiply(source.matrixWorld);
  if(source.instanceColor)source.getColorAt(i,color);else color.set('#ffffff');
  records.push({matrix:m.clone(),color:color.clone(),x:m.elements[12],z:m.elements[14]});
 }source.visible=false;source.userData.replacedGroundReeds=true;}
 const geo=createReedGeometry(T),mat=new T.MeshStandardMaterial({name:'Reed bed | curved leaves and seed heads',vertexColors:true,side:T.DoubleSide,roughness:1,envMapIntensity:.4});
 const farMat=active[0]?.material.clone()||new T.MeshStandardMaterial({side:T.DoubleSide});farMat.name='Reed bed | distance cover';farMat.transparent=false;farMat.opacity=1;farMat.envMapIntensity=.4;enableOpaqueFoliageCoverage(T,farMat);
 const clock={value:0},eye={value:new T.Vector2()},limit={value:32};
 function wind(material,near){
  material.onBeforeCompile=(sh,renderer)=>{
   Object.assign(sh.uniforms,{reedTime:clock,reedEye:eye,reedLimit:limit});
   sh.vertexShader='uniform float reedTime;uniform vec2 reedEye;varying float reedDistance;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec2 reedSite=instanceMatrix[3].xz;reedDistance=distance(reedSite,reedEye);
    float reedPhase=reedSite.x*.19+reedSite.y*.13;
    transformed.x+=sin(reedTime*1.15+reedPhase)*position.y*position.y*.045;
    transformed.z+=cos(reedTime*.92+reedPhase)*position.y*position.y*.027;`);
   sh.fragmentShader='uniform float reedLimit;varying float reedDistance;\n'+sh.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    float reedBlend=smoothstep(reedLimit-4.0,reedLimit,reedDistance);
    float reedPixel=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    if(${near?'reedPixel<reedBlend':'reedPixel>=reedBlend'})discard;`);
   if(!near)patchFoliageCoverage(sh,renderer);
  };
  material.customProgramCacheKey=()=> 'curved-reed-bed-1-'+near;
 }
 wind(mat,true);wind(farMat,false);
 const detail=new T.InstancedMesh(geo,mat,320),far=new T.InstancedMesh(active[0]?.geometry.clone()||new T.PlaneGeometry(1,1),farMat,Math.max(1,records.length));
 detail.name='Reed beds | living bulrushes';far.name='Reed beds | distant stems';
 for(const mesh of[detail,far]){mesh.count=0;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);}
 let oldX=Infinity,oldZ=Infinity,oldQuality=null,disposed=false;
 const state={detail,far,records,sources:active,stats:{sites:records.length,detailTriangles:geo.index.count/3,capacity:320},
  update(dt,time){if(disposed)return;clock.value=time;const p=player.pos||player,q=getQuality();
   if(q===oldQuality&&Math.hypot(p.x-oldX,p.z-oldZ)<.75)return;oldX=p.x;oldZ=p.z;oldQuality=q;
   // The fade origin and packed instances change together; moving the shader
   // origin alone can reveal an instance that has not entered the near batch.
   eye.value.set(p.x,p.z);
   const cap=q==='low'?80:q==='medium'?180:320,radius=q==='low'?16:q==='medium'?24:32;
   const nearby=records.map(r=>({r,d:Math.hypot(r.x-p.x,r.z-p.z)})).filter(v=>v.d<150).sort((a,b)=>a.d-b.d);
   limit.value=Math.min(radius,nearby[cap]?.d??radius);let a=0,b=0;
   for(const {r,d}of nearby){if(d<limit.value&&a<cap){detail.setMatrixAt(a,r.matrix);detail.setColorAt(a,r.color);a++;}if(d>limit.value-4){far.setMatrixAt(b,r.matrix);far.setColorAt(b,r.color);b++;}}
   detail.count=a;far.count=b;for(const mesh of[detail,far]){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  },
  dispose(){disposed=true;for(const mesh of[detail,far]){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}for(const s of active){s.visible=true;delete s.userData.replacedGroundReeds;}}
 };state.update(0,0);return state;
}
