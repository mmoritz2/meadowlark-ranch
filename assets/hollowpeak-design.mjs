// Artifact-only shared Hollowpeak design. No loader, runtime state, Three, RNG,
// or terrainH/rawH import. All runtime heights read the supplied packed field.
const finite=Number.isFinite;
const EPS=1e-10;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
const station=([x,z,level,halfWidth,bedDepth])=>({x,z,level,halfWidth,bedDepth});

export const HOLLOWPEAK_DESIGN=freeze({
 profile:'hollowpeak-owned-hydrology-2',
 parentFieldSHA256:'f93dd64095687a124c0dfc44f89cd2c80adcf91c8230fe1ac8745b7f2e2ade05',
 // The carving builder binds its own final field hash; this descriptor does
 // not pretend the V3 parent is the hydrologically carved final field.
 finalFieldSHA256:null,
 bounds:{x0:-274,x1:-32,z0:-414,z1:-214},
 joinHem:14,
 grid:{segments:512,size:513,step:1.953125,originX:-500,originZ:-500,diagonal:'u+v<=1'},
 channels:[
  {id:'upper-cleft',stations:[
   [-191,-332,39.6,2.25,.75],[-187,-325,35,2.25,.8],
   [-182,-319,31.8,2.4,.8],[-175,-312,28.9,2.5,.85],
   [-171,-306,26.1,2.6,.9],[-163,-293,21.2,2.7,1],
   [-156.4,-286.8,16.3,2.5,1.15],[-147,-284,16.3,2.8,1.4],
  ].map(station)},
  {id:'lower-source',stations:[
   [-147,-284,16.3,2.8,1.4],[-145.8,-277.5,16.3,2.8,1.1],
   [-145,-274,15.9,3,1.1],[-148,-261,15.2,3.1,1.2],
   [-150,-249,14.6,3.2,1.1],[-150,-242.2,14.2,3.15,.25],
  ].map(station)},
 ],
 tarn:{id:'upper-tarn',kind:'tarn',x:-147,z:-284,rx:6.2,rz:5.5,level:16.3,depth:1.6,segments:192,
  shore:{innerFraction:.94,outerMarginM:3.2,clearance:.014,innerBelowWater:.10,maxLift:.28,radialFractions:[0,.12,.28,.50,.75,1]}},
 pool:{id:'plunge-pool',kind:'pool',x:-151,z:-232,rx:10.2,rz:6.1,level:-.1,depth:1.8,segments:192,
  radiusControls:{angles:[-Math.PI,-3*Math.PI/4,-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI],
   scales:[1.05,.72,.62,.80,.95,.94,1.02,.95,1.05]},
  bankSectors:{angles:[-Math.PI,-3*Math.PI/4,-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI],
   reachM:[8,5,2.6,3.0,4,5,6,8,8],gentleWeight:[1,.25,0,.1,.3,.8,1,1,1],
   supportMarginM:[1.2,.7,.6,.7,.9,1.3,1.6,1.4,1.2]},
  shore:{innerFraction:.94,outerMarginM:3.8,clearance:.014,innerBelowWater:.10,maxLift:.28,radialFractions:[0,.12,.28,.50,.75,1]}},
 basinRadius:{sin3Amplitude:.055,sin3Phase:.4,sin5Amplitude:.025,sin5Phase:-1.2},
 fall:{id:'hollowpeak-fall',axis:'+Z',lip:[-150,14.2,-242.2],landing:[-150,-.06,-232.1],
  x:-150,z:-242.2,top:14.2,bottom:-.06,run:10.1,width:3.15,
  trajectory:{linear:.35,quadratic:.65},impactRadius:3.4,
  // This is a declared preliminary wet/exclusion envelope, not proof of the
  // factory's moving veils or clearance. The builder may bind exact triangles.
  exclusionHalfWidth:4.9,exclusionBeforeLip:.35,exclusionAfterLanding:.5},
 bankGeology:{
  policy:'Unequal connected buttresses flank the actual fall width; gentler front/west pool sectors cut toward the original outer apron, while the narrow northern head retains steep bedrock.',
  channelSupportMarginM:.9,tarnSupportMarginM:.9,
  buttresses:[
   {id:'west-fall-buttress',halfWidthInFallWidths:1.3,maxCutM:2.6,maxRaiseM:1.8,nodes:[[-2.1,-4,14],[-2.6,1.2,9.2],[-3.2,6.2,5],[-4.1,11.2,2.7],[-4.8,16.2,1.3]]},
   {id:'east-fall-shoulder',halfWidthInFallWidths:1.7,maxCutM:2.6,maxRaiseM:1.8,nodes:[[2.1,-5,14.4],[2.55,.2,10],[3.1,5.7,6.3],[3.8,10.7,4],[4.6,16.2,2.6]]},
  ],
  nodeCoordinates:'[cross offset in fall widths, Z offset from fall lip, absolute target height]; finite profiles blend into the same V3 mass, not separate rock props.',
 },
 anchors:[
  {id:'hollowpeak-ft5',x:-160,z:-210},
  {id:'falls-ft6',x:-150,z:-222},
  {id:'west-access',x:-260,z:-280},
  {id:'frostpine-road-end',x:-256,z:-278},
  {id:'toy-unicorn',x:-173,z:-230,previousLocation:{x:-172,z:-238},relocation:{
   identityPreserved:true,distanceM:Math.hypot(1,8),
   reason:'Owned collectible relocation from the steep redesigned front to a lower-grade dry apron; no terrain-preservation core or water geometry change.',
   fieldEvidence:{fieldSHA256Prefix:'11977d6e',oldPointGrade:.62320,oldFootRingMaximumGrade:.82264,
    newPointGrade:.21188,newFootRingMaximumGrade:.32211,footRingRadiusM:1.5,outsideActualWaterPaddingM:2},
   routeAccepted:false,bodyAccepted:false,reachabilityAccepted:false,
  }},
 ],
 anchorsStatus:'Approach anchors retained; the same toy-unicorn identity has one explicit owned dry-apron relocation. Final route, body and interaction reachability remain to be checked.',
 waterFootprintPolicy:'Finite shared basin polygons and connected mitered channel strips. Runtime exact footprint must bind the builder\'s final clipped water triangles.',
 dryReliefPolicy:'Design overlap/exposure proxy only: positive height above design datum 0 m, or positive final-minus-bare-base height when baseHeights is supplied. Not actual walkability.',
 admission:{hydrology:false,body:false,camera:false,ecology:false,release:false},
});
export const DESIGN=HOLLOWPEAK_DESIGN;

// Periodic C2 interpolation of explicit angular sectors. Angles use the same
// X=cos(a), Z=sin(a) convention as basinPoint; -pi/2 is the northern head.
function angularControl(angle,angles,values){
 if(!finite(angle))throw new TypeError('Finite basin angle required');
 const period=2*Math.PI,a=((angle+Math.PI)%period+period)%period-Math.PI;
 let i=0;while(i<angles.length-2&&a>angles[i+1])i++;
 const t=clamp((a-angles[i])/(angles[i+1]-angles[i]),0,1),q=t*t*t*(t*(t*6-15)+10);
 return values[i]+(values[i+1]-values[i])*q;
}
/** Dimensionless radius multiplier: explicit pool controls; unchanged tarn sinusoid. */
export function basinRadius(basin,angle){
 if(!finite(angle))throw new TypeError('Finite basin angle required');
 if(basin?.id===DESIGN.pool.id||basin?.kind==='pool'){
  const c=DESIGN.pool.radiusControls;return angularControl(angle,c.angles,c.scales);
 }
 const p=DESIGN.basinRadius;
 return 1+p.sin3Amplitude*Math.sin(3*angle+p.sin3Phase)+p.sin5Amplitude*Math.sin(5*angle+p.sin5Phase);
}
/** Pool bank shaping data only; not a carved bank, registered floor or admission. */
export function basinBankParameters(angle){
 const s=DESIGN.pool.bankSectors;
 return {reachM:angularControl(angle,s.angles,s.reachM),
  gentleWeight:angularControl(angle,s.angles,s.gentleWeight),
  supportMarginM:angularControl(angle,s.angles,s.supportMarginM)};
}
/** [world X, water Y, world Z]. The finite polygon is authoritative, not the analytic ellipse. */
export function basinPoint(basin,angle){const r=basinRadius(basin,angle);return[basin.x+basin.rx*r*Math.cos(angle),basin.level,basin.z+basin.rz*r*Math.sin(angle)];}
export function basinPolygon(basin){
 const n=basin.segments;
 if(!Number.isInteger(n)||n<8)throw new RangeError('Finite basin polygon segment count required');
 return Array.from({length:n},(_,i)=>basinPoint(basin,i*Math.PI*2/n));
}

/** Shared left/right cross sections. End caps are finite and butt-ended. */
export function channelSections(channel){
 const s=channel.stations;
 return s.map((p,i)=>{
  const a=s[Math.max(0,i-1)],b=s[Math.min(s.length-1,i+1)];
  const previous=i>0?[p.x-a.x,p.z-a.z]:[b.x-p.x,b.z-p.z];
  const next=i<s.length-1?[b.x-p.x,b.z-p.z]:previous;
  const la=Math.hypot(...previous),lb=Math.hypot(...next);
  if(!(la>0&&lb>0))throw new RangeError('Channel stations must have distinct neighboring positions');
  const na=[-previous[1]/la,previous[0]/la],nb=[-next[1]/lb,next[0]/lb];
  const nx=na[0]+nb[0],nz=na[1]+nb[1],nl=Math.hypot(nx,nz);
  if(nl<EPS)throw new RangeError('Channel reverses onto itself');
  const ux=nx/nl,uz=nz/nl,den=ux*na[0]+uz*na[1];
  if(den<.25)throw new RangeError('Channel miter is too acute for one finite strip');
  const width=p.halfWidth/den;
  return {...p,left:[p.x+ux*width,p.level,p.z+uz*width],right:[p.x-ux*width,p.level,p.z-uz*width],miterScale:1/den};
 });
}

function triangle(id,kind,a,b,c,extra={}){return{id,kind,a:a.slice(),b:b.slice(),c:c.slice(),swimmable:true,...extra};}
/**
 * Unclipped descriptor templates. The builder should clip these exact finite
 * triangles against the final canonical bed and bind the result to the factory.
 * Each a/b/c is [X,Y,Z]; channel sections carry station levels and depths.
 */
export function buildDesignWaterTriangles(){
 const out=[];
 for(const basin of[DESIGN.tarn,DESIGN.pool]){
  const ring=basinPolygon(basin),center=[basin.x,basin.level,basin.z];
  for(let i=0;i<ring.length;i++)out.push(triangle(basin.id,basin.kind,center,ring[(i+1)%ring.length],ring[i],{basin:true,bedDepth:basin.depth,sourceTriangle:i}));
 }
 for(const channel of DESIGN.channels){
  const sections=channelSections(channel);
  for(let i=0;i<sections.length-1;i++){
   const a=sections[i],b=sections[i+1],extra={channel:true,segment:i,stationA:i,stationB:i+1,bedDepthA:a.bedDepth,bedDepthB:b.bedDepth};
   out.push(triangle(channel.id,'channel',a.left,b.left,a.right,{...extra,sourceTriangle:i*2}));
   out.push(triangle(channel.id,'channel',a.right,b.left,b.right,{...extra,sourceTriangle:i*2+1}));
  }
 }
 return out;
}

/**
 * Raw finite shore annuli from the SAME basin polygon rays. These triangles
 * are not clipped to canonical owners. The caller must fit/clip them against
 * final canonical triangles and register only the resulting owned surface.
 * Cross-shore profile uses C1 smoothstep and the outer ray's actual height;
 * every raw vertex lift stays in [clearance,maxLift] above heightAt there.
 */
export function buildDesignShoreTriangles(heightAt){
 if(typeof heightAt!=='function')throw new TypeError('Final canonical height sampler required for shore templates');
 const out=[];
 for(const basin of[DESIGN.tarn,DESIGN.pool]){
  const s=basin.shore,ring=basinPolygon(basin),vertices=s.radialFractions.map(()=>[]);
  for(let i=0;i<ring.length;i++){
   const edge=ring[i],vx=edge[0]-basin.x,vz=edge[2]-basin.z,length=Math.hypot(vx,vz),ux=vx/length,uz=vz/length,
    inner=length*s.innerFraction,outer=length+s.outerMarginM,
    outerX=basin.x+ux*outer,outerZ=basin.z+uz*outer,outerGround=heightAt(outerX,outerZ);
   if(!finite(outerGround))throw new RangeError('Finite final canonical outer shore sample required');
   for(let j=0;j<s.radialFractions.length;j++){
    const fraction=s.radialFractions[j],radius=inner+(outer-inner)*fraction,x=basin.x+ux*radius,z=basin.z+uz*radius,
     ground=heightAt(x,z),ease=fraction*fraction*(3-2*fraction),
     profile=basin.level-s.innerBelowWater+(outerGround+s.clearance-(basin.level-s.innerBelowWater))*ease;
    if(!finite(ground))throw new RangeError('Finite final canonical shore sample required');
    const y=Math.max(ground+s.clearance,Math.min(ground+s.maxLift,profile));
    vertices[j].push([x,y,z]);
   }
  }
  for(let j=0;j<s.radialFractions.length-1;j++)for(let i=0;i<ring.length;i++){
   const k=(i+1)%ring.length,a=vertices[j][i],b=vertices[j][k],c=vertices[j+1][i],d=vertices[j+1][k],
    sourceTriangle=(j*ring.length+i)*2,extra={basinId:basin.id,basinKind:basin.kind,swimmable:false,
     radialRing:j,innerFraction:s.radialFractions[j],outerFraction:s.radialFractions[j+1],
     clearance:s.clearance,maxLift:s.maxLift,canonicalOwnerFitted:false,physicalContactAccepted:false};
   out.push(triangle(basin.id,'shore',a,b,c,{...extra,sourceTriangle}));
   out.push(triangle(basin.id,'shore',b,d,c,{...extra,sourceTriangle:sourceTriangle+1}));
  }
 }
 return out;
}

const templates=buildDesignWaterTriangles();
function checkedPoint(x,z,pad=0){if(![x,z,pad].every(finite)||pad<0)throw new TypeError('Finite XZ and nonnegative world-space padding required');}
function weights(t,x,z){
 const[a,b,c]=[t.a,t.b,t.c],den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 if(!finite(den)||Math.abs(den)<1e-16)return null;
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
 const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
 return[u,v,1-u-v];
}
function closestTriangle(t,x,z){
 const w=weights(t,x,z);
 if(w&&w.every(v=>v>=-EPS))return{x,z,distance:0,weights:w};
 let best=null;
 for(const[a,b]of[[t.a,t.b],[t.b,t.c],[t.c,t.a]]){
  const dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz;
  const u=d?clamp(((x-a[0])*dx+(z-a[2])*dz)/d,0,1):0;
  const px=a[0]+u*dx,pz=a[2]+u*dz,distance=Math.hypot(x-px,z-pz);
  if(!best||distance<best.distance)best={x:px,z:pz,distance,weights:weights(t,px,pz)};
 }
 return best;
}
function prepareTriangles(list){
 if(!Array.isArray(list))throw new TypeError('Water triangles must be an array of {id,kind,a,b,c} records');
 return list.map((t,i)=>{
  if(!t||!['a','b','c'].every(k=>Array.isArray(t[k])&&t[k].length===3&&t[k].every(finite)))throw new TypeError('Finite XYZ water triangle required at '+i);
  const out={...t,a:t.a.slice(),b:t.b.slice(),c:t.c.slice()};
  if(!weights(out,out.a[0],out.a[2]))throw new RangeError('Degenerate XZ water triangle at '+i);
  out.bounds={x0:Math.min(out.a[0],out.b[0],out.c[0]),x1:Math.max(out.a[0],out.b[0],out.c[0]),z0:Math.min(out.a[2],out.b[2],out.c[2]),z1:Math.max(out.a[2],out.b[2],out.c[2])};
  return out;
 });
}
const plannedTriangles=prepareTriangles(templates);
function footprintQuery(triangles,x,z,pad,out,source){
 checkedPoint(x,z,pad);
 let best=null,nearest=Infinity,minLevel=Infinity,maxLevel=-Infinity,overlaps=0;
 for(let i=0;i<triangles.length;i++){
  const t=triangles[i];if(t.swimmable===false||t.kind==='fall')continue;
  const b=t.bounds;if(x<b.x0-pad-EPS||x>b.x1+pad+EPS||z<b.z0-pad-EPS||z>b.z1+pad+EPS)continue;
  const p=closestTriangle(t,x,z);if(!p?.weights||p.distance>pad+EPS)continue;
  const level=p.weights[0]*t.a[1]+p.weights[1]*t.b[1]+p.weights[2]*t.c[1];
  if(!finite(level))throw new RangeError('Nonfinite interpolated water level');
  overlaps++;minLevel=Math.min(minLevel,level);maxLevel=Math.max(maxLevel,level);
  // Distance wins when querying a padded envelope; at an actual overlap the
  // highest represented surface wins and disagreement is explicitly reported.
  if(p.distance<nearest-EPS||Math.abs(p.distance-nearest)<=EPS&&(!best||level>best.level)){
   nearest=p.distance;best={triangle:i,id:t.id,kind:t.kind,level,x:p.x,z:p.z,distance:p.distance,weights:p.weights};
  }
 }
 for(const k of Object.keys(out))delete out[k];
 return Object.assign(out,{valid:true,inside:!!best,insideSurface:!!best&&best.distance<=EPS,footprintSource:source,hydrologyAccepted:false,
  id:best?.id??null,kind:best?.kind??null,level:best?.level??null,nearestX:best?.x??null,nearestZ:best?.z??null,
  distance:best?.distance??null,triangle:best?.triangle??null,overlaps,
  surfaceLevelDisagreement:overlaps?maxLevel-minLevel:0,swimmableSurface:!!best&&best.distance<=EPS});
}

/** Pure planned footprint. Exact runtime footprint is the factory's bound triangles. */
export function waterFootprintAt(x,z,pad=0,out={}){return footprintQuery(plannedTriangles,x,z,pad,out,'unclipped-design-templates');}
export function containsFallEnvelope(x,z,pad=0){
 checkedPoint(x,z,pad);const f=DESIGN.fall;
 const dx=Math.max(0,Math.abs(x-f.x)-f.exclusionHalfWidth);
 const dz=Math.max(0,f.z-f.exclusionBeforeLip-z,z-(f.z+f.run+f.exclusionAfterLanding));
 return Math.hypot(dx,dz)<=pad+EPS;
}
/** Planned wet/exclusion envelope, not a moving-water collision certificate. */
export function excludesPlants(x,z,pad=0){return waterFootprintAt(x,z,pad).inside||containsFallEnvelope(x,z,pad);}

function boxOf(box){
 const b=box?.min&&box?.max?{x0:box.min.x,x1:box.max.x,z0:box.min.z,z1:box.max.z}:box;
 if(!b||![b.x0,b.x1,b.z0,b.z1].every(finite)||b.x0>b.x1||b.z0>b.z1)throw new TypeError('Complete finite XZ footprint AABB required');
 return b;
}
/** Conservative changed-support cohort test, expanded by one incident cell. */
export function affectsFootprint(box,probe=0){
 const b=boxOf(box);if(!finite(probe)||probe<0)throw new RangeError('Nonnegative finite probe reach required');
 const d=DESIGN.bounds,p=probe+DESIGN.grid.step;
 return b.x1+p>d.x0&&b.x0-p<d.x1&&b.z1+p>d.z0&&b.z0-p<d.z1;
}

function makeGrid({heights,segments=512,step=1.953125,originX=-500,originZ=-500}){
 if(!(heights instanceof Float32Array)||!Number.isInteger(segments)||segments<1||heights.length!==(segments+1)**2||
  ![step,originX,originZ].every(finite)||step<=0||!finite(segments*step)||originX+step===originX||originZ+step===originZ)
  throw new TypeError('Complete representable packed Float32 canonical grid required');
 const stride=segments+1,maxX=originX+segments*step,maxZ=originZ+segments*step;
 if(![maxX,maxZ].every(finite))throw new RangeError('Nonfinite canonical grid extent');
 function read(x,z,out={}){
  checkedPoint(x,z);
  if(x<originX||z<originZ||x>maxX||z>maxZ)throw new RangeError('Canonical sample outside supplied grid');
  const u=(x-originX)/step,v=(z-originZ)/step,ix=Math.min(segments-1,Math.floor(u)),iz=Math.min(segments-1,Math.floor(v)),fx=u-ix,fz=v-iz,i=iz*stride+ix;
  const a=heights[i],b=heights[i+1],c=heights[i+stride],d=heights[i+stride+1];
  if(![a,b,c,d].every(finite))throw new RangeError('Nonfinite live canonical cell');
  const lower=fx+fz<=1,height=lower?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz),
   dx=lower?(b-a)/step:(d-c)/step,dz=lower?(c-a)/step:(d-b)/step;
  return Object.assign(out,{height,dx,dz,grade:Math.hypot(dx,dz),cellX:ix,cellZ:iz,triangle:lower?0:1});
 }
 return{heights,segments,step,originX,originZ,maxX,maxZ,read};
}
export function canonicalDerivatives(x,z,field,out={}){return makeGrid(field).read(x,z,out);}
export function sampleCanonicalField(x,z,field){return makeGrid(field).read(x,z).height;}
/** Pure packed-field lookup: no call to rawH/terrainH and no unfinished grid dependency. */
export function dryReliefAt(x,z,field){
 checkedPoint(x,z);const b=DESIGN.bounds;if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1)return 0;
 const g=makeGrid(field),h=g.read(x,z).height;
 const base=field.baseHeights?makeGrid({...field,heights:field.baseHeights}).read(x,z).height:0;
 return Math.max(0,h-base);
}

/**
 * Bind a COMPLETE FINAL authored Float32 field. Arrays remain caller-owned and
 * are read live; the caller freezes its field lifecycle/hash. waterTriangles is
 * an optional array of {id,kind,a:[X,Y,Z],b,c,swimmable}; provide the builder's
 * exact clipped surface triangles to make queries match rendered footprints.
 * No physical/hydrology acceptance is inferred from accepting those triangles.
 */
export function createHollowpeakDesign(options){
 const g=makeGrid(options),base=options.baseHeights?makeGrid({...options,heights:options.baseHeights}):null;
 const actual=options.waterTriangles!==undefined,triangles=actual?prepareTriangles(options.waterTriangles):plannedTriangles;
 const fieldSHA256=options.finalFieldSHA256??null;
 if(fieldSHA256!==null&&!/^[0-9a-f]{64}$/i.test(fieldSHA256))throw new TypeError('Final field hash must be a supplied SHA256 or null');
 const footprint=(x,z,pad=0,out={})=>footprintQuery(triangles,x,z,pad,out,actual?'bound-clipped-water-triangles':'unclipped-design-templates');
 const heightAt=(x,z)=>g.read(x,z).height;
 function shapeHeight(x,z,baseHeight,establishedHeight){
  if(![x,z,baseHeight,establishedHeight].every(finite))throw new TypeError('Finite absolute shape inputs required');
  const b=DESIGN.bounds;
  return x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1?heightAt(x,z):establishedHeight;
 }
 function relative(x,z){
  checkedPoint(x,z);const b=DESIGN.bounds;
  if(x<=b.x0||x>=b.x1||z<=b.z0||z>=b.z1)return 0;
  return Math.max(0,heightAt(x,z)-(base?base.read(x,z).height:0));
 }
 function waterAt(x,z,{groundAt=null,supportClearance=.04,pad=0}={},out={}){
  if(!finite(supportClearance)||supportClearance<0)throw new RangeError('Finite nonnegative support clearance required');
  const f=footprint(x,z,pad,out);
  Object.assign(f,{bedY:null,supportY:null,depth:0,terrainDepth:0,supportDepth:0,wet:false,coveredBySupport:false,swimmable:false,airborneFall:containsFallEnvelope(x,z)});
  if(!f.inside)return f;
  const bedY=heightAt(x,z),depth=f.level-bedY,supportY=groundAt?groundAt(x,z):bedY;
  if(!finite(supportY))return Object.assign(f,{valid:false,bedY,depth,terrainDepth:depth,supportDepth:null,reason:'nonfinite-support',swimmable:false});
  const coveredBySupport=supportY>f.level+supportClearance;
  return Object.assign(f,{bedY,supportY,depth,terrainDepth:depth,supportDepth:f.level-supportY,wet:f.insideSurface&&depth>0,coveredBySupport,swimmable:f.insideSurface&&depth>0&&!coveredBySupport,
   reason:!f.insideSurface?'padded-envelope-only':depth<=0?'represented-surface-not-above-bed':coveredBySupport?'support-above-water':null,
   actorAdmissionAccepted:false});
 }
 function ecologyAt(x,z,{pad=0,footprint:foot=null,probe=2,gradeLimit=.55}={},out={}){
  checkedPoint(x,z,pad);
  if(![probe,gradeLimit].every(finite)||probe<0||gradeLimit<0)throw new RangeError('Finite nonnegative ecology probes required');
  const b=DESIGN.bounds,owned=x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1,
   affected=affectsFootprint(foot??{x0:x-pad,x1:x+pad,z0:z-pad,z1:z+pad},probe),p=g.read(x,z),
   wet=footprint(x,z,pad).inside,fall=containsFallEnvelope(x,z,pad);
  let maxGrade=p.grade;
  for(const[dx,dz]of[[probe,0],[-probe,0],[0,probe],[0,-probe]])maxGrade=Math.max(maxGrade,g.read(x+dx,z+dz).grade);
  const excluded=wet||fall||maxGrade>gradeLimit;
  return Object.assign(out,{owned,affected,height:p.height,grade:p.grade,maxProbeGrade:maxGrade,wet,fall,
   eligible:!excluded,reason:wet?'wet-footprint':fall?'fall-envelope':maxGrade>gradeLimit?'steep-canonical-foot':'eligible-by-ecology-probes',
   probeReach:probe,gradeLimit,physicalClearanceAccepted:false,treelineAccepted:false});
 }
 function barrierCandidates({gradeThreshold=.65,includeWet=false}={}){
  if(!finite(gradeThreshold)||gradeThreshold<0)throw new RangeError('Nonnegative barrier grade required');
  const out=[],b=DESIGN.bounds;
  const ix0=Math.max(0,Math.floor((b.x0-g.originX)/g.step)),ix1=Math.min(g.segments-1,Math.ceil((b.x1-g.originX)/g.step)-1),
   iz0=Math.max(0,Math.floor((b.z0-g.originZ)/g.step)),iz1=Math.min(g.segments-1,Math.ceil((b.z1-g.originZ)/g.step)-1);
  for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++)for(let side=0;side<2;side++){
   const x=g.originX+(ix+(side?2/3:1/3))*g.step,z=g.originZ+(iz+(side?2/3:1/3))*g.step,
    p=g.read(x,z),wet=footprint(x,z).inside||containsFallEnvelope(x,z);
   if(p.grade<gradeThreshold||wet&&!includeWet)continue;
   const length=Math.hypot(p.dx,1,p.dz);
   out.push({cellX:ix,cellZ:iz,triangle:side,x,z,height:p.height,grade:p.grade,normal:[-p.dx/length,1/length,-p.dz/length],wet,
    classification:'canonical-steep-face-candidate',collisionAccepted:false});
  }
  return out;
 }
 return Object.freeze({design:DESIGN,profile:DESIGN.profile,finalFieldSHA256:fieldSHA256,
  fieldPolicy:'Caller-owned complete final Float32 field; no analytic resculpt or loader in queries.',
  waterFootprintSource:actual?'bound-clipped-water-triangles':'unclipped-design-templates',
  dryReliefSemantics:base?'positive final-minus-supplied-bare-base design overlap proxy':'positive height above design datum 0 m; design overlap/exposure proxy only',
  heightAt,shapeHeight,dryReliefAt:relative,derivativesAt:(x,z,out={})=>g.read(x,z,out),
  waterFootprintAt:footprint,waterAt,containsFallEnvelope,
  excludesPlants:(x,z,pad=0)=>footprint(x,z,pad).inside||containsFallEnvelope(x,z,pad),
  affectsFootprint,ecologyAt,barrierCandidates,
  // Detached public data helps the builder use one descriptor without callers
  // mutating the bound query's triangles or typed geometry behind its back.
  waterTriangles:()=>triangles.map(({bounds,...t})=>({...t,a:t.a.slice(),b:t.b.slice(),c:t.c.slice()})),
  physicalOrHydrologyAccepted:false,
 });
}
