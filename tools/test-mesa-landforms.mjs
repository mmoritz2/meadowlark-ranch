import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.MESA_SOURCE_ROOT||new URL('../',import.meta.url).pathname;
const dependencies=process.env.MESA_DEPENDENCY_ROOT||root;
const fixture=new URL('./fixtures/mesa-landforms-8f811f1/',import.meta.url);
const edits=JSON.parse(fs.readFileSync(new URL('source-edits.json',fixture)));
const layout=JSON.parse(fs.readFileSync(new URL('actual-sites.json',fixture)));
const sha=x=>createHash('sha256').update(x).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const current=fs.readFileSync(path.join(root,'assets/geology.js'),'utf8');
let previous=current;
for(const edit of edits['assets/geology.js'].changes.toReversed())previous=previous.replace(edit.after,edit.before);
const assetURL=name=>pathToFileURL(path.join(fs.existsSync(path.join(root,'assets',name.split('?')[0]))?root:dependencies,'assets',name.split('?')[0])).href+(name.includes('?')?'?'+name.split('?').slice(1).join('?'):'');
async function sourceModule(s){
 const transformed=s.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,quote,spec)=>'from '+quote+assetURL(spec.slice(2))+quote);
 return import('data:text/javascript;base64,'+Buffer.from(transformed).toString('base64'));
}
const T=await import(assetURL('vendor/three/build/three.module.js'));
const {createGeology:oldFactory}=await sourceModule(previous);
const {createGeology:newFactory}=await sourceModule(current);
const helper=await import(assetURL('mesa-landforms.mjs?v=mesa-landforms-1'));
const {canyonReplacesFormation}=await import(assetURL('canyon-landscape.js'));
const {COTTONWOOD_PUBLIC}=await import(assetURL('cottonwood-layout.js'));
const {COTTONWOOD_TRACKS}=await import(assetURL('cottonwood-routes.mjs'));
const html=fs.readFileSync(path.join(dependencies,'ranch3d.html'),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const paths=between('const PATHS=[','const PATH_W=');
const segments=between('const _PSEG=(()=>{','function pathDist(');
const ps=html.indexOf('function pathDist('),pe=html.indexOf('\n}',ps)+2;
const pathDist=new Function('COTTONWOOD_TRACKS','COTTONWOOD_PUBLIC',paths+'const villageGroundZones=COTTONWOOD_PUBLIC.map(q=>({...q}));'+segments+html.slice(ps,pe)+';return pathDist;')(COTTONWOOD_TRACKS,COTTONWOOD_PUBLIC);
const terrain=(x,z)=>2.5*Math.sin(x*.031)+1.7*Math.cos(z*.043)+.011*x-.006*z;
function controlled(fn){const old=Math.random;let state=0x7c5a30f1,calls=0;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const value=fn(),count=calls,future=Array.from({length:32},()=>Math.random());return{value,calls:count,future};}finally{Math.random=old;}}
function whole(factory){return controlled(()=>{const scene=new T.Scene(),g=factory({THREE:T,scene,groundH:terrain,loadTextures:false}),colliders=[];
 for(const body of Object.values(layout.sourceSnippets))new Function('CANYON','pathDist','riverZ','canyonReplacesFormation','geology','colliders',body)({x:-220,z:130},pathDist,x=>120+Math.sin(x*.012)*45,canyonReplacesFormation,g,colliders);
 for(const site of layout.ochre){g.placeMesa(site.x,site.z,site.radius,site.height,site.seed);colliders.push({x:site.x,z:site.z,r:site.radius*.95});}
 return{scene,g,colliders};});}
const baseline=whole(oldFactory),candidate=whole(newFactory);
const oldGroups=new Map(baseline.value.scene.children.map(g=>[g.userData.geology.seed,g]));
const newGroups=new Map(candidate.value.scene.children.map(g=>[g.userData.geology.seed,g]));
const visible=layout.visibleMesaSeeds.map(seed=>({...layout.sites.concat(layout.ochre).find(s=>s.seed===seed),a:oldGroups.get(seed).children[0].geometry,b:newGroups.get(seed).children[0].geometry}));
const beds=h=>Math.min(27,Math.max(16,Math.round(h*1.05)));
const bodyRows=h=>3+(beds(h)-1)*3;
const bodyVertices=h=>bodyRows(h)*73;
const bodyIndices=h=>(bodyRows(h)-1)*72*6;
const topVertices=5*73;
function sameGeometry(a,b){assert.deepEqual(Object.keys(a.attributes),Object.keys(b.attributes));assert.deepEqual(a.index.array,b.index.array);for(const k of Object.keys(a.attributes))assert.deepEqual(a.attributes[k].array,b.attributes[k].array);}
const measured=[];

test('frozen four integration edits invert to the exact prechange geology and use the final helper query',()=>{
 const contract=edits['assets/geology.js'];assert.equal(sha(current),contract.afterSHA256);assert.equal(sha(previous),contract.beforeSHA256);assert.equal(contract.changes.length,4);
 let text=current;for(const e of contract.changes.toReversed()){assert.equal(text.split(e.after).length-1,e.occurrences);text=text.replace(e.after,e.before);}assert.equal(text,previous);
 assert.ok(current.includes("./mesa-landforms.mjs?v=mesa-landforms-1"));assert.equal(helper.MESA_LANDFORM_PROFILE,'mesa-landforms-1');
 const source=fs.readFileSync(path.join(root,'assets/mesa-landforms.mjs'),'utf8');assert.ok(!/Math\.random|THREE|new\s+(?:Mesh|BufferGeometry|Material|Texture)/.test(source));
});

test('actual production loops keep all seventeen boot owners, six visible mesa sites and original retirement policy',()=>{
 assert.equal(sha(between(' /* Sedimentary mesas and weathered spires',' /* ===== Dawn mist, and dust')),layout.sources['ranch3d.html:formationLoop']);
 assert.equal(sha(between('{let seed=20260929;','for(let i=0;i<14;i++){')),layout.sources['ranch3d.html:extraMesaLoop']);
 assert.equal(layout.sites.length,17);assert.deepEqual([...newGroups.keys()],[...oldGroups.keys()]);
 assert.deepEqual([...newGroups.keys()],layout.sites.concat(layout.ochre).map(s=>s.seed));
 assert.equal(visible.length,6);assert.deepEqual(layout.retiredScanMesaSeeds,[1113,1116,1122]);
 for(const s of layout.sites)assert.equal(canyonReplacesFormation(s.x,s.z,s.radius),false);
 for(const s of layout.sites.concat(layout.ochre)){assert.equal(newGroups.get(s.seed).position.x,s.x);assert.equal(newGroups.get(s.seed).position.z,s.z);}
});

test('arithmetic helper is deterministic without RNG and excludes its entire contact band',()=>{
 const random=Math.random;Math.random=()=>{throw Error('Ambient RNG touched');};try{
  for(const site of visible){const a=helper.createMesaLandform(site.radius,site.height,site.seed,.713),b=helper.createMesaLandform(site.radius,site.height,site.seed,.713);assert.ok(a.contactCeiling>=3.8&&a.contactCeiling>site.height*.23);
   for(let k=0;k<50;k++){const angle=k*.173,t=k/49,y=t*site.height;assert.deepEqual(a.surface(angle,t,site.radius*.8,y),b.surface(angle,t,site.radius*.8,y));if(y<=a.contactCeiling)assert.deepEqual(a.surface(angle,t,site.radius*.8,y),[site.radius*.8,y]);}
  }
  for(const site of visible){const a=helper.createMesaLandform(site.radius,site.height,site.seed,.713);for(let k=0;k<=20;k++){const t=k/20,y=a.contactCeiling+1e-4,p=a.surface(k*.391,t,site.radius*.8,y);assert.ok(Math.abs(p[0]-site.radius*.8)<1e-6);assert.ok(Math.abs(p[1]-y)<1e-6);}}
  assert.throws(()=>helper.createMesaLandform(0,30,1,0),TypeError);
 }finally{Math.random=random;}
});

test('all original Three constructors, private draws and global RNG future stream remain identical',()=>{
 assert.equal(candidate.calls,baseline.calls);assert.deepEqual(candidate.future,baseline.future);assert.deepEqual(candidate.value.colliders,baseline.value.colliders);
 for(const [seed,a]of oldGroups){const b=newGroups.get(seed);assert.equal(b.uuid,a.uuid);assert.equal(b.children.length,a.children.length);assert.equal(b.children[0].uuid,a.children[0].uuid);assert.equal(b.children[0].geometry.uuid,a.children[0].geometry.uuid);assert.equal(b.children[0].material.uuid,a.children[0].material.uuid);assert.deepEqual(b.position,a.position);assert.deepEqual(b.quaternion.toArray(),a.quaternion.toArray());assert.equal(b.children[0].userData.solidParts,undefined);}
 assert.equal(candidate.value.g.canyonMaterial.customProgramCacheKey(),baseline.value.g.canyonMaterial.customProgramCacheKey());assert.equal(candidate.value.g.canyonMaterial.map,null);
});

test('six visible mesas have substantive metre-scale erosion within identical buffer topology and source colours',()=>{
 for(const s of visible){const a=s.a,b=s.b,A=a.attributes.position.array,B=b.attributes.position.array;assert.equal(A.length,B.length);assert.deepEqual(a.index.array,b.index.array);assert.deepEqual(a.attributes.color.array,b.attributes.color.array);assert.equal(a.index.array.constructor,b.index.array.constructor);
  const source=a.userData.groundReference,target=b.userData.groundReference;let maximumDisplacement=0,maximumInset=0,changed=0;
  for(let i=0;i<A.length;i+=3){const displacement=Math.hypot(B[i]-A[i],B[i+1]-A[i+1],B[i+2]-A[i+2]);maximumDisplacement=Math.max(maximumDisplacement,displacement);if(displacement>1e-5)changed++;maximumInset=Math.max(maximumInset,Math.hypot(source[i],source[i+2])-Math.hypot(target[i],target[i+2]));}
  assert.ok(changed>2000);assert.ok(maximumDisplacement>1.8&&maximumDisplacement<s.radius*.40);assert.ok(maximumInset>s.radius*.11&&maximumInset<s.radius*.35);
  measured.push({seed:s.seed,radius:s.radius,height:s.height,vertices:B.length/3,triangles:b.index.count/3,changedVertices:changed,maximumDisplacementM:maximumDisplacement,maximumRadialInsetM:maximumInset,contactCeilingM:Math.max(3.8,s.height*.23+.05)});
 }
});

test('closed upper-body and crown seams have no new gaps or inward body triangles',()=>{
 for(const s of visible){const g=s.b,p=g.attributes.position.array,I=g.index.array,rows=bodyRows(s.height),N=bodyVertices(s.height);let minimumTwiceArea=Infinity;
  for(let j=0;j<rows;j++){const a=j*73,b=a+72;for(let c=0;c<3;c++)assert.ok(Math.abs(p[a*3+c]-p[b*3+c])<1e-6);for(let c=0;c<3;c++)assert.equal(g.attributes.normal.array[a*3+c],g.attributes.normal.array[b*3+c]);}
  for(let i=0;i<73;i++)for(let c=0;c<3;c++)assert.equal(p[((rows-1)*73+i)*3+c],p[(N+i)*3+c]);
  for(let j=0;j<bodyIndices(s.height);j+=3){const a=I[j]*3,b=I[j+1]*3,c=I[j+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;minimumTwiceArea=Math.min(minimumTwiceArea,Math.hypot(nx,ny,nz));assert.ok(nx*(p[a]+p[b]+p[c])/3+nz*(p[a+2]+p[b+2]+p[c+2])/3>0,'body winding '+s.seed+':'+j);}
  assert.ok(minimumTwiceArea>.001);measured.find(m=>m.seed===s.seed).minimumBodyTwiceTriangleAreaM2=minimumTwiceArea;
 }
});

test('every used normal is finite/unit and all upper crown triangles retain upward winding',()=>{
 for(const s of visible){const g=s.b,p=g.attributes.position.array,n=g.attributes.normal.array,I=g.index.array,used=new Set(I);for(const i of used){const l=Math.hypot(n[i*3],n[i*3+1],n[i*3+2]);assert.ok(Number.isFinite(l)&&Math.abs(l-1)<2e-6);}
  const start=bodyIndices(s.height),count=72*(2*3+1)*3;for(let j=start;j<start+count;j+=3){const a=I[j]*3,b=I[j+1]*3,c=I[j+2]*3;const ny=(p[b+2]-p[a+2])*(p[c]-p[a])-(p[b]-p[a])*(p[c+2]-p[a+2]);assert.ok(ny>0,'crown winding '+s.seed+':'+j);}
 }
});

test('terrain feather/contact geometry and original lower body are exact for any terrain sampler',()=>{
 for(const s of visible){const A=s.a.userData.groundReference,B=s.b.userData.groundReference,ceiling=Math.max(3.8,s.height*.23+.05);let protectedVertices=0,changedAboveFeather=0;
  for(let i=0;i<A.length;i+=3){if(A[i+1]<=ceiling){assert.equal(B[i],A[i]);assert.equal(B[i+1],A[i+1]);assert.equal(B[i+2],A[i+2]);protectedVertices++;}if(A[i]!==B[i]||A[i+1]!==B[i+1]||A[i+2]!==B[i+2]){assert.ok(A[i+1]>s.height*.23&&B[i+1]>s.height*.23);changedAboveFeather++;}}
  assert.ok(protectedVertices>3000);assert.ok(changedAboveFeather>2000);measured.find(m=>m.seed===s.seed).exactContactAndLowerVertices=protectedVertices;
  const before=s.b.attributes.position.array.slice();candidate.value.g.groundAt(newGroups.get(s.seed),s.x,s.z);assert.deepEqual(s.b.attributes.position.array,before);
 }
});

test('all original talus and fragment positions, normals, UVs, colours and indices remain byte exact',()=>{
 for(const s of visible){const offset=bodyVertices(s.height)+topVertices;for(const k of ['position','normal','uv','color']){const a=s.a.attributes[k],b=s.b.attributes[k];assert.deepEqual(a.array.slice(offset*a.itemSize),b.array.slice(offset*b.itemSize),s.seed+':'+k);}}
});

test('upper mass stays within the original horizontal envelope with varied retained buttresses and receding coves',()=>{
 for(const s of visible){const A=s.a.userData.groundReference,B=s.b.userData.groundReference,rows=bodyRows(s.height);assert.ok(s.b.boundingBox.min.x>=s.a.boundingBox.min.x-1e-6&&s.b.boundingBox.max.x<=s.a.boundingBox.max.x+1e-6);assert.ok(s.b.boundingBox.min.z>=s.a.boundingBox.min.z-1e-6&&s.b.boundingBox.max.z<=s.a.boundingBox.max.z+1e-6);
  let deep=0,retained=0;for(let j=0;j<rows;j++)for(let i=0;i<72;i++){const k=(j*73+i)*3;if(A[k+1]<s.height*.65)continue;const delta=Math.hypot(A[k],A[k+2])-Math.hypot(B[k],B[k+2]);if(delta>s.radius*.09)deep++;if(delta<s.radius*.04)retained++;assert.ok(B[k+1]<=A[k+1]);}
  assert.ok(deep>25&&retained>25);measured.find(m=>m.seed===s.seed).deepUpperSamples=deep;measured.find(m=>m.seed===s.seed).retainedUpperSamples=retained;
 }
});

test('all eleven hoodoo/fieldstone placements and arch, boulder, waterfall outputs remain exact',()=>{
 for(const s of layout.sites.filter(s=>s.kind==='hoodoo')){const a=oldGroups.get(s.seed),b=newGroups.get(s.seed);sameGeometry(a.children[0].geometry,b.children[0].geometry);assert.deepEqual(b.userData,a.userData);}
 const make=f=>controlled(()=>{const g=f({THREE:T,groundH:terrain,loadTextures:false});return[g.makeArch(6413),g.makeBoulder(2.2,924),g.makeWaterfallCliff({width:34,lip:15,foot:0,seed:9031,notchWidth:6.4})];});
 const a=make(oldFactory),b=make(newFactory);assert.equal(a.calls,b.calls);assert.deepEqual(a.future,b.future);for(let i=0;i<a.value.length;i++){const am=[],bm=[];a.value[i].traverse(o=>{if(o.isMesh)am.push(o);});b.value[i].traverse(o=>{if(o.isMesh)bm.push(o);});assert.equal(am.length,bm.length);for(let j=0;j<am.length;j++)sameGeometry(am[j].geometry,bm[j].geometry);}
 if(process.env.MESA_AUDIT_OUTPUT)fs.writeFileSync(process.env.MESA_AUDIT_OUTPUT,JSON.stringify({scope:'Actual unchanged production source placement replay and arbitrary analytic terrain; no GPU or visual quality claim.',sources:{geology:sha(current),helper:sha(fs.readFileSync(path.join(root,'assets/mesa-landforms.mjs')))},constructorRandomCalls:candidate.calls,sourceGroups:newGroups.size,visibleMesaOwners:measured},null,2)+'\n');
});
