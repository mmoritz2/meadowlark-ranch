import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.RIBBON_SOURCE_ROOT||new URL('../',import.meta.url).pathname;
const dep=process.env.RIBBON_DEPENDENCY_ROOT||root;
const fixture=new URL('./fixtures/ribbon-falls-b3f2d33/',import.meta.url);
const tile=JSON.parse(fs.readFileSync(new URL('actual-terrain.json',fixture)));
const owners=JSON.parse(fs.readFileSync(new URL('actual-owners.json',fixture)));
const edits=JSON.parse(fs.readFileSync(new URL('source-edits.json',fixture)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const url=s=>pathToFileURL(path.join(fs.existsSync(path.join(root,s))?root:dep,s)).href;
const T=await import(url('assets/vendor/three/build/three.module.js'));
const helper=await import(url('assets/ribbon-falls-landform.mjs'));
const {createGeology}=await import(url('assets/geology.js'));
const {createWaterfallArt}=await import(url('assets/waterfall-art.js'));
const {createSolidWorld}=await import(url('assets/solid-collisions.js'));
const {forTerrainIntersections}=await import(url('tools/terrain-water-contact.mjs'));
const terrain=(x,z)=>{
 const gx=(x-tile.origin)/tile.step-tile.ix0,gz=(z-tile.origin)/tile.step-tile.iz0,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*tile.nx+ix;
 assert.ok(ix>=0&&iz>=0&&ix+1<tile.nx&&iz+1<tile.nz,'query inside actual compact grid');
 const a=tile.heights[i],d=tile.heights[i+1],b=tile.heights[i+tile.nx],c=tile.heights[i+tile.nx+1];
 return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);
};
const options={heightAt:terrain,lipY:terrain(342,65.5)+2.95,shelfY:terrain(342,67.9)+.35};
const data=helper.buildRibbonFallsLandform(options);
const current=fs.readFileSync(path.join(root,'assets/features/world-water.js'),'utf8');
let previous=current;for(const e of edits['assets/features/world-water.js'].changes.slice().reverse())previous=previous.replace(e.after,e.before);
const fn=(source,start)=>{const a=source.indexOf(start);assert.ok(a>=0,start);let brace=source.indexOf('{',a),level=1,i=brace+1;for(;level&&i<source.length;i++){if(source[i]==='{')level++;if(source[i]==='}')level--;}return source.slice(a,i);};
const summary={baselineCommit:owners.baselineCommit,profile:data.profile};
function controlled(make){const original=Math.random;let calls=0,s=0x391af53;Math.random=()=>{calls++;s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};try{const value=make(),count=calls,future=Array.from({length:64},()=>Math.random());return{value,calls:count,future};}finally{Math.random=original;}}
const make=change=>controlled(()=>{
 const geology=createGeology({THREE:T,loadTextures:false}),cliff=geology.makeWaterfallCliff({width:17.5,lip:options.lipY,foot:options.shelfY-1.1,seed:8723,notchWidth:3.5});
 cliff.position.set(342,options.shelfY-1.1,65.5);const before={group:cliff,mesh:cliff.children[0],geometry:cliff.children[0].geometry,material:cliff.children[0].material};
 const result=change?helper.remodelRibbonFallsCliff({THREE:T,cliff,...options}):null;return{cliff,before,result};
});
const baseline=make(false),candidate=make(true),rock=candidate.value.result,geometry=rock.mesh.geometry;
const point=i=>[geometry.attributes.position.getX(i)+342,geometry.attributes.position.getY(i)+options.shelfY-1.1,geometry.attributes.position.getZ(i)+65.5];

test('six scoped edits invert exact b3 parent and all original water/layout calls precede new contact registration',()=>{
 const contract=edits['assets/features/world-water.js'];assert.equal(sha(current),contract.afterSHA256);assert.equal(sha(previous),contract.beforeSHA256);assert.equal(contract.changes.length,6);
 let s=current;for(const e of contract.changes.slice().reverse()){assert.equal(s.split(e.after).length-1,e.occurrences);s=s.replace(e.after,e.before);}assert.equal(s,previous);
 const hook=current.indexOf('W.solidWorld.registerSurface(P.ribbonRocks.mesh,P.ribbonRocks.bodyGeometry)');assert.ok(hook>current.indexOf('installFerryBankApproach(G);'));assert.ok(hook>current.indexOf('P.boulderMeshes='));assert.ok(hook>current.indexOf('for(let i=0;i<373;i++)rnd()'));
 assert.ok(!/new\s+(?:T|THREE)\.(?:Mesh|Group|BufferGeometry|\w*Material|\w*Texture)\b|Math\.random/.test(fs.readFileSync(path.join(root,'assets/ribbon-falls-landform.mjs'),'utf8')));
});

test('original cliff constructor budget and actual geometry/mesh/material identities persist with global random suffix exact',()=>{
 assert.equal(candidate.calls,baseline.calls);assert.deepEqual(candidate.future,baseline.future);
 assert.equal(rock.cliff,candidate.value.before.group);assert.equal(rock.mesh,candidate.value.before.mesh);assert.equal(geometry,candidate.value.before.geometry);assert.equal(rock.mesh.material,candidate.value.before.material);
 assert.equal(geometry.attributes.normal.count,geometry.attributes.position.count);for(let i=0;i<geometry.attributes.normal.count;i++){const n=geometry.attributes.normal;assert.ok([n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));assert.ok(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.9);}
 assert.ok(geometry.attributes.position.count<30000);assert.ok(geometry.index.count/3<26000);
 const repeat=helper.buildRibbonFallsLandform(options);for(const part of['cliff','bank'])for(const name of['position','uv','color','index'])assert.deepEqual(data[part][name],repeat[part][name]);summary.constructorRandomCalls=baseline.calls;summary.newTriangles=geometry.index.count/3;summary.oldTriangles=baseline.value.before.geometry.index.count/3;
});

test('closed original shoulders/source bridge have exact welded face boundaries and metre-scale unequal clefts/crowns',()=>{
 const edges=new Map();let minArea=Infinity,volume=0;
 const p=i=>Array.from(data.cliff.position.slice(i*3,i*3+3)),key=p=>p.join(',');
 for(let i=0;i<data.cliff.index.length;i+=3){
  const ps=Array.from(data.cliff.index.slice(i,i+3)).map(p),[a,b,c]=ps,u=b.map((v,k)=>v-a[k]),v=c.map((q,k)=>q-a[k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];minArea=Math.min(minArea,Math.hypot(...n)/2);
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  for(let k=0;k<3;k++){const ends=[key(ps[k]),key(ps[(k+1)%3])].sort(),e=ends.join('|');edges.set(e,(edges.get(e)||0)+1);}
 }
 assert.ok(minArea>1e-7);assert.ok(volume>100);for(const count of edges.values())assert.equal(count,2);
 const crownRanges=data.shoulders.map(s=>{const y=s.crown.map(p=>p[1]);return Math.max(...y)-Math.min(...y);});assert.ok(crownRanges.every(r=>r>1.0));
 for(const s of data.shoulders){const f=s.front,z=f.map(p=>p[2]);let depth=0;for(let i=3;i+3<z.length;i++)depth=Math.max(depth,(z[i-3]+z[i+3])/2-z[i]);assert.ok(depth>.5);}
 summary.closedCliff={edges:edges.size,minFaceAreaM2:minArea,signedVolumeM3:volume,crownRangesM:crownRanges};
});

test('actual vertical end-wall UVs span metre-scaled Z depth instead of a collapsed X strip',()=>{
 // Actual fixed production grid ranges, covering both ends of both shoulders
 // and the two constant-X source-bridge ends. Front/back and top projectors stay.
 let preimage=fs.readFileSync(path.join(root,'assets/ribbon-falls-landform.mjs'),'utf8');for(const e of owners.uvRevision.changes.slice().reverse()){assert.equal(preimage.split(e.after).length-1,e.occurrences);preimage=preimage.replace(e.after,e.before);}assert.equal(sha(preimage),owners.uvRevision.beforeHelperSHA256);
 const native=owners.uvRevision.actualV2Native.cliff;for(const name of['position','normal','color'])assert.equal(sha(bytes(geometry.attributes[name].array)),native.attributes[name].sha256,name+' actual native V2 exact');assert.equal(sha(bytes(geometry.index.array)),native.index.sha256);
 const ranges=[{start:2254,cols:10,rows:22},{start:2507,cols:10,rows:22},{start:6092,cols:10,rows:22},{start:6345,cols:10,rows:22},{start:9076,cols:16,rows:10},{start:9263,cols:16,rows:10}];
 let endVertices=0,minDepthSpan=Infinity;
 for(const {start,cols,rows}of ranges){
  for(let j=0;j<=rows;j++){
   const a=start+j*(cols+1),b=a+cols,depth=Math.abs(data.cliff.position[b*3+2]-data.cliff.position[a*3+2]),span=Math.abs(data.cliff.uv[b*2]-data.cliff.uv[a*2]);
   assert.ok(depth>3);assert.ok(Math.abs(span-depth/3.2)<3e-6);minDepthSpan=Math.min(minDepthSpan,span);
  }
  for(let i=start;i<start+(cols+1)*(rows+1);i++){assert.ok(Math.abs(data.cliff.uv[i*2]-data.cliff.position[i*3+2]/3.2)<2e-6);assert.ok(Math.abs(data.cliff.uv[i*2+1]-data.cliff.position[i*3+1]/3.2)<2e-6);endVertices++;}
 }
 summary.endWallUV={vertices:endVertices,minMetreDepthRepeats:minDepthSpan,projection:'Z/Y',patchMetres:3.2};
});

test('original local20 boulder calls consume identical private RNG and only those rows disappear',()=>{
 const drawSource=previous.slice(previous.indexOf(' let _s='),previous.indexOf(' const clamp='));
 const boulderSource=fn(previous,'const boulder=(x,y,z,s,squat)=>')+';';
 const segment=source=>{const a=source.indexOf('const oldRockStarts='),b=source.indexOf('for(let i=0;i<20;i++){');if(a>=0&&a<b)return source.slice(a,source.indexOf('\n  }',b));return source.slice(b,source.indexOf('\n  }',b));};
 const run=(source,initial)=>new Function('groundH','initial',drawSource+' _s=initial; const boulderProtos=[0,1,2],boulderRows=[[{outside:0}],[{outside:1}],[{outside:2}]];'+boulderSource+'const FALL_X=342,SHELF_Z=67.9,TOE_Z=76,P={ribbonRocks:{}};'+segment(source)+';return{rows:boulderRows,future:Array.from({length:64},rnd),replaced:P.ribbonRocks.replacedLooseStones};')(terrain,initial);
 for(const initial of[1,0x9e3779b9,0x75fa31]){const a=run(previous,initial),b=run(current,initial);assert.deepEqual(a.future,b.future);assert.equal(a.rows.flat().length-b.rows.flat().length,20);assert.equal(b.replaced,20);assert.deepEqual(b.rows,[[{outside:0}],[{outside:1}],[{outside:2}]]);}
 summary.localLooseStonesReplaced=20;
});

test('packed low banks clear every intersected canonical terrain face and support equals actual registered bank triangles only',()=>{
 let min=Infinity,max=0,area=0,intersections=0;
 const solid=createSolidWorld({THREE:T}),scene=new T.Scene();scene.add(rock.cliff);const count=solid.registerSurface(rock.mesh,rock.bodyGeometry);assert.equal(count,rock.bankRange.firstIndex/3);
 for(let i=rock.bankRange.firstIndex;i<geometry.index.count;i+=3){
  const ps=[0,1,2].map(k=>point(geometry.index.getX(i+k))),poly=ps.map(p=>[p[0],p[2],p[1]]);
  forTerrainIntersections(poly,tile.step,clipped=>{for(const p of clipped){const clearance=p[2]-terrain(p[0],p[1]);min=Math.min(min,clearance);max=Math.max(max,clearance);intersections++;}});
  const [a,b,c]=ps;area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
  const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,y=(a[1]+b[1]+c[1])/3;assert.ok(Math.abs(rock.supportAt(x,z)-y)<2e-5);
 }
 assert.ok(min>=.011);assert.ok(max<.30);assert.ok(area>40&&area<90);assert.ok(intersections>10000);
 // The full collider sees a high shoulder; the bank support must not raise a rider there.
 assert.ok(solid.surfaceHeight(347,65,rock.mesh)>terrain(347,65)+1);assert.equal(rock.supportAt(347,65),-Infinity);
 const arrival=[335,120+Math.sin(342*.012)*45-9.5];for(const dx of[-.55,0,.55])for(const dz of[-.55,0,.55])assert.equal(rock.supportAt(arrival[0]+dx,arrival[1]+dz),-Infinity);
 for(const p of [[0,0],[330,70],[355,70],[342,68],[342,75],[342,60]])assert.equal(rock.supportAt(...p),-Infinity);
 summary.bank={minCompleteFaceTerrainClearanceM:min,maxReliefM:max,projectedAreaM2:area,intersections,arrivalSupportDeltaM:0};
});

test('actual baseline fall and chute buffers reconstruct byte-exact, and their complete swept footprints clear all new stone faces',()=>{
 const art=createWaterfallArt({THREE:T});const fall=art.fall({x:342,z:66.05,top:options.lipY-.30,bottom:terrain(342,67.9)+.075,width:1.35,run:1.85,name:'Ribbon Falls',footHeightAt:terrain,footWidth:1.35});
 const fg=fall.children[0].geometry,record=owners.waterRows.find(r=>r.role==='fallSheet');
 for(const [name,a]of Object.entries(fg.attributes))assert.equal(sha(bytes(a.array)),record.attributes[name].sha256,name);assert.equal(sha(bytes(fg.index.array)),record.index.sha256);
 const marker=previous.indexOf('const rows=[];',previous.indexOf('below the shelf the water stops falling'));
 const rowSource=previous.slice(marker,previous.indexOf('P.chute=band(',marker));
 const rows=new Function('groundH','FALL_X','SHELF_Z','TOE_Z',rowSource+';return rows;')(terrain,342,67.9,76);
 const scene=new T.Scene(),band=new Function('THREE','scene',fn(previous,'function band(rows,cols,mat,name)')+';return band;')(T,scene),chute=band(rows,9,art.material,'Water | falls chute'),cg=chute.geometry;
 for(let i=0;i<cg.attributes.uv.count;i++)cg.attributes.uv.setXY(i,(i%9)/8,Math.floor(i/9)/24);
 const cr=owners.waterRows.find(r=>r.role==='chute');for(const [name,a]of Object.entries(cg.attributes))assert.equal(sha(bytes(a.array)),cr.attributes[name].sha256,name);assert.equal(sha(bytes(cg.index.array)),cr.index.sha256);
 const fp=fg.attributes.position,motion=fg.attributes.cascadeMotion.array;let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<fp.count;i++){minX=Math.min(minX,fp.getX(i)-motion[i]);maxX=Math.max(maxX,fp.getX(i)+motion[i]);minZ=Math.min(minZ,fp.getZ(i));maxZ=Math.max(maxZ,fp.getZ(i));}
 let minFallGap=Infinity,minChuteGap=Infinity;
 for(let i=0;i<geometry.index.count;i+=3){const ps=[0,1,2].map(k=>point(geometry.index.getX(i+k))),xs=ps.map(p=>p[0]),zs=ps.map(p=>p[2]);
  const gap=Math.max(minX-Math.max(...xs),Math.min(...xs)-maxX,minZ-Math.max(...zs),Math.min(...zs)-maxZ);assert.ok(gap>0,'each rock face separates from whole all-phase fall rectangle');minFallGap=Math.min(minFallGap,gap);
  if(i>=rock.bankRange.firstIndex)for(const p of ps){const wet=1.35+Math.max(0,Math.min(1,(p[2]-67.9)/8.1))*2.5;minChuteGap=Math.min(minChuteGap,Math.abs(p[0]-342)-wet);}
 }
 assert.ok(minFallGap>.15);assert.ok(minChuteGap>.7499);summary.water={fallFaces:fg.index.count/3,chuteFaces:cg.index.count/3,allFallAttributesActualNativeExact:true,allChuteAttributesActualNativeExact:true,minAllPhaseFallRectangleGapM:minFallGap,minWholeChuteLateralGapM:minChuteGap};
});

test('fresh actual tree centers and outside cover exclusions keep original ground/placement authority',()=>{
 assert.equal(owners.nearbyTrees.length,0);const at=current.indexOf('P.excludesPlants=(x,z)=>'),end=current.indexOf(';',at),body=current.slice(at,end).replace('P.excludesPlants=','');
 const predicate=new Function('P','FALL_X','SHELF_Z','TOE_Z','return '+body)({ribbonRocks:rock},342,67.9,76);
 let changed=0;for(let z=52;z<=84;z+=.35)for(let x=327;x<=357;x+=.35){const old=z>64.5&&z<78&&Math.abs(x-342)<1.9+Math.max(0,(z-67.9)/8.1)*2.5,now=predicate(x,z),support=rock.supportAt(x,z);if(now!==old){changed++;assert.equal(now,true);assert.ok(Number.isFinite(support));}}
 assert.ok(changed>0);summary.cover={changedProbesOnlyInsideActualBank:changed,nearbyActualTreeCenters:0};
});

test('production radius and body offsets traverse the new supported bank without an uphill-plane body snag',()=>{
 const solid=createSolidWorld({THREE:T}),scene=new T.Scene();scene.add(rock.cliff);solid.registerSurface(rock.mesh,rock.bodyGeometry);
 let previous=null,probes=0,minGroundDelta=Infinity,maxGrade=0;
 for(let i=0;i<=100;i++){
  const t=i/100,x=336.9+.10*t,z=74.0+1.4*t,support=rock.supportAt(x,z);assert.ok(Number.isFinite(support));
  const foot=Math.max(terrain(x,z),support),body={bottom:foot+.38,top:foot+2.65,radius:.55,previous};
  const hits=solid.surfaceContacts({x,z},body);assert.equal(hits.length,0);
  const position={x,z};assert.equal(solid.resolve(position,body),0);assert.deepEqual(position,{x,z});
  if(previous)maxGrade=Math.max(maxGrade,Math.abs((foot-previous.foot)/Math.hypot(x-previous.x,z-previous.z)));
  minGroundDelta=Math.min(minGroundDelta,foot-terrain(x,z));previous={x,z,foot,bottom:foot+.38,top:foot+2.65};probes++;
 }
 assert.ok(minGroundDelta>.011);summary.ridingBank={probes,radiusM:.55,bottomOffsetM:.38,topOffsetM:2.65,bodyContacts:0,minNewSupportDeltaM:minGroundDelta,maxExistingSlopeGrade:maxGrade,route:[[336.9,74],[337,75.4]]};
 if(process.env.RIBBON_AUDIT_OUTPUT)fs.writeFileSync(process.env.RIBBON_AUDIT_OUTPUT,JSON.stringify(summary,null,2)+'\n');
});
