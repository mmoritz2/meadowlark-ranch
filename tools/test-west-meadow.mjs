// CPU preservation review against the pinned 1122de3 baseline, restored in memory.
// No renderer, network, random sampling or production writes.
// Run: node --test tools/test-west-meadow.mjs
// Optional captured native fixture: QA_WEST_BASELINE=/absolute/report.json
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=process.env.QA_WEST_ROOT||path.dirname(HERE);
// Immutable diff receipt permits actual before/after module execution without a
// second checkout or committed baseline asset fixture. Cache URLs are normalized
// for this code-preservation receipt only; runtime modules retain current URLs.
const patch="diff --git a/assets/pastoral-fields.mjs b/assets/pastoral-fields.mjs\n--- a/assets/pastoral-fields.mjs\n+++ b/assets/pastoral-fields.mjs\n@@ -34,6 +34,14 @@\n   [140,38,9,20],[204,59,14,8],[33,208,16,6],[80,253,13,6],\n   [215,115,12,6],[262,141,8,12],[147,-121,7,17],\n ];\n+// Recover a fuller west sward without changing the shared grazing mask that\n+// suppresses old flower cards and ferns. The compact field has C2-soft margins.\n+export const WEST_MEADOW_SWARD_RECOVERY=.76;\n+export const WEST_MEADOW_FLOWER_DRIFT=Object.freeze([-69,36,8,18]);\n+export function westMeadowSwardAt(x,z){\n+  const west=Math.hypot((x+54)/22,(z-43)/16)+Math.sin(x*.18+z*.11)*.06;\n+  return 1-smooth(.55,1.12,west);\n+}\n export function meadowBloomAt(x,z){\n   let mask=0;\n   for(const [cx,cz,rx,rz] of FLOWER_DRIFTS){\n@@ -41,7 +49,16 @@\n     const edge=d+Math.sin(x*.32+Math.sin(z*.17))*.12+Math.sin(z*.41)*.06;\n     mask=Math.max(mask,1-smooth(.50,1.12,edge));\n   }\n-  return mask*(1-.96*meadowGrazingAt(x,z));\n+  const grazing=meadowGrazingAt(x,z),legacy=mask*(1-.96*grazing);\n+  // One modelled lupin margin joins the old west colony. Legacy colonies keep\n+  // their original grazing response; only this new contribution recovers.\n+  const [cx,cz,rx,rz]=WEST_MEADOW_FLOWER_DRIFT;\n+  const d=Math.hypot((x-cx)/rx,(z-cz)/rz);\n+  const edge=d+Math.sin(x*.32+Math.sin(z*.17))*.12+Math.sin(z*.41)*.06;\n+  const colony=1-smooth(.50,1.12,edge);\n+  if(colony===0)return legacy;\n+  const recovered=grazing*(1-WEST_MEADOW_SWARD_RECOVERY*westMeadowSwardAt(x,z));\n+  return Math.max(legacy,colony*(1-.96*recovered));\n }\n \n // Open pasture between tree groups makes the foreground slopes and village\ndiff --git a/assets/meadow-cover.js b/assets/meadow-cover.js\n--- a/assets/meadow-cover.js\n+++ b/assets/meadow-cover.js\n@@ -1,5 +1,5 @@\n import {coyoteCoverDryWeight} from './biome-weights.mjs?v=dry-foothills-1';\n-import {meadowGrazingAt} from './pastoral-fields.mjs?v=leafy-orchard-1';\n+import {meadowGrazingAt,westMeadowSwardAt,WEST_MEADOW_SWARD_RECOVERY} from './pastoral-fields.mjs?v=leafy-orchard-1';\n \n // Curved ribbon leaves: narrow roots, a fuller lower blade, and a curling tip.\n // The nearby tuft has eight leaves and forty triangles. Middle-distance tufts\n@@ -45,7 +45,8 @@\n }\n export function meadowGrowthAt(x,z){\n   const stand=.65*fieldPatch(x/11+3.4,z/11-8.2)+.35*fieldPatch(x/29-5.1,z/29+2.7);\n-  const grazed=meadowGrazingAt(x,z);\n+  const grazing=meadowGrazingAt(x,z),sward=westMeadowSwardAt(x,z);\n+  const grazed=sward===0?grazing:grazing*(1-WEST_MEADOW_SWARD_RECOVERY*sward);\n   return ((.42+stand*.95)*(1-grazed)+(.23+stand*.33)*grazed)*(1-coyoteCoverDryWeight(x,z)*.38);\n }\n \n";
const hashes={
 'assets/pastoral-fields.mjs':'96c5e5efcfb3f230984abc5ecf6cb1fc33cc68be6e99654d11f2b671264f81bc',
 'assets/meadow-cover.js':'8dd3ea1c44b2f7795258029d938380f860e63ace4b3362475c46c02166e2a887',
};
const hash=s=>createHash('sha256').update(s).digest('hex');
const proposed=Object.fromEntries(Object.keys(hashes).map(p=>[p,readFileSync(path.join(ROOT,p),'utf8').replace('./pastoral-fields.mjs?v=west-meadow-sward-1','./pastoral-fields.mjs?v=leafy-orchard-1')]));

// Apply strict unified-diff hunks in memory. Source context must match exactly;
// no git command, staging, tracked mutation or fallback fuzzy patch application.
function applyPatch(sources,diff){
 const lines=diff.split('\n'),result={...sources};let i=0,files=0;
 while(i<lines.length){
  if(!lines[i].startsWith('--- a/')){i++;continue;}
  const file=lines[i++].slice(6);assert.equal(lines[i++],'+++ b/'+file);assert(file in sources);files++;
  const input=sources[file].split('\n');assert.equal(input.pop(),'');const output=[];let cursor=0;
  while(i<lines.length&&!lines[i].startsWith('diff --git ')){
   const m=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
   if(!m){assert.equal(lines[i],'');i++;continue;}
   i++;const start=+m[1]-1,oldCount=m[2]===undefined?1:+m[2],newCount=m[4]===undefined?1:+m[4];
   assert(start>=cursor);output.push(...input.slice(cursor,start));cursor=start;
   assert.equal(output.length,+m[3]-1);let removed=0,added=0;
   while(i<lines.length&&!lines[i].startsWith('@@ ')&&!lines[i].startsWith('diff --git ')&&lines[i]!==''){
    const line=lines[i++],mark=line[0],body=line.slice(1);assert([' ','+','-'].includes(mark));
    if(mark!=='+' ){assert.equal(input[cursor++],body,file+' hunk context');removed++;}
    if(mark!=='-'){output.push(body);added++;}
   }
   assert.equal(removed,oldCount);assert.equal(added,newCount);
  }
  output.push(...input.slice(cursor));result[file]=output.join('\n')+'\n';
 }
 assert.equal(files,2);return result;
}
function reversePatch(diff){return diff.split('\n').map(line=>{
 if(line.startsWith('@@ '))return line.replace(/^@@ -(\d+(?:,\d+)?) \+(\d+(?:,\d+)?) @@/,'@@ -$2 +$1 @@');
 if(line.startsWith('+++')||line.startsWith('---'))return line;
 return line.startsWith('+')?'-'+line.slice(1):line.startsWith('-')?'+'+line.slice(1):line;
}).join('\n');}
const original=applyPatch(proposed,reversePatch(patch));
for(const [p,source]of Object.entries(original))assert.equal(hash(source),hashes[p],p+' must retain pinned baseline code outside the reviewed hunks');
const dataURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const beforeFields=await import(dataURL(original['assets/pastoral-fields.mjs']));
const afterFields=await import(dataURL(proposed['assets/pastoral-fields.mjs']));
const biomeURL=pathToFileURL(path.join(ROOT,'assets/biome-weights.mjs')).href;
function coverURL(source,fieldsURL){
 return dataURL(source.replace(/'\.\/biome-weights\.mjs\?[^']*'/,JSON.stringify(biomeURL)).replace(/'\.\/pastoral-fields\.mjs\?[^']*'/,JSON.stringify(fieldsURL)));
}
const beforeCover=await import(coverURL(original['assets/meadow-cover.js'],dataURL(original['assets/pastoral-fields.mjs'])));
const afterCover=await import(coverURL(proposed['assets/meadow-cover.js'],dataURL(proposed['assets/pastoral-fields.mjs'])));
const T=await import(pathToFileURL(path.join(ROOT,'assets/vendor/three/build/three.module.js')).href);
const {coyoteCoverDryWeight}=await import(biomeURL);
const {westMeadowSwardAt,meadowBloomAt,WEST_MEADOW_FLOWER_DRIFT,WEST_MEADOW_SWARD_RECOVERY}=afterFields;
const growthBounds={minX:-79.96,maxX:-28.04,minZ:24.12,maxZ:61.88};
const flowerBounds={minX:-79.4,maxX:-58.6,minZ:12.6,maxZ:59.4};
const outside=(x,z,b)=>x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ;
const functionExact=(a,b)=>assert.equal(a.toString(),b.toString());

// Isolate the real new-colony expression from the proposed function body, so
// its C2 taper is exercised without max(legacy,colony) or grazing products.
// The composed bloom field retains pre-existing max seams; no global C2 claim.
const fieldsSource=proposed['assets/pastoral-fields.mjs'];
const smoothLine=fieldsSource.split('\n').find(l=>l.startsWith('const smooth='));
const start=fieldsSource.indexOf('  const [cx,cz,rx,rz]=WEST_MEADOW_FLOWER_DRIFT;');
const end=fieldsSource.indexOf('\n  if(colony===0)return legacy;',start);
assert(start>=0&&end>start);
const flowerMask=new Function('x','z','WEST_MEADOW_FLOWER_DRIFT',smoothLine+'\n'+fieldsSource.slice(start,end)+'\nreturn colony;');
const westFlowerAt=(x,z)=>flowerMask(x,z,WEST_MEADOW_FLOWER_DRIFT);

function geometryReceipt(g){
 return {index:hash(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength)),attributes:Object.fromEntries(Object.entries(g.attributes).map(([key,a])=>[key,{itemSize:a.itemSize,count:a.count,bytes:hash(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))}])),bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],radius:g.boundingSphere.radius};
}
function checkContinuousBoundary(weight,cx,cz,rx,rz,level,noiseBound){
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){
  const co=Math.cos(angle),si=Math.sin(angle),p=r=>[cx+co*rx*r,cz+si*rz*r];
  let lo=Math.max(0,level-noiseBound-.001),hi=level+noiseBound+.001;
  for(let i=0;i<64;i++){const mid=(lo+hi)/2,[x,z]=p(mid),v=weight(x,z);if(level<.8?(v===1):(v>0))lo=mid;else hi=mid;}
  const r=(lo+hi)/2,[x,z]=p(r),v=weight(x,z),expected=level<.8?1:0;
  assert(Math.abs(v-expected)<1e-12);
  const h=.01,px=weight(x+h,z),nx=weight(x-h,z),pz=weight(x,z+h),nz=weight(x,z-h);
  const dx=(px-nx)/(2*h),dz=(pz-nz)/(2*h),dxx=(px-2*v+nx)/(h*h),dzz=(pz-2*v+nz)/(h*h);
  const dxz=(weight(x+h,z+h)-weight(x+h,z-h)-weight(x-h,z+h)+weight(x-h,z-h))/(4*h*h);
  assert(Math.hypot(dx,dz)<1e-5,'first derivatives vanish at compact/plateau boundary');
  assert(Math.max(Math.abs(dxx),Math.abs(dzz),Math.abs(dxz))<.004,'second derivatives approach zero at compact/plateau boundary');
  const vOut=weight(...p(r+(expected===0?h:-h)));assert.equal(vOut,expected);
 }
}

test('patch scope preserves legacy grazing, openings, earthworks, descriptors and palette exactly',()=>{
 assert.equal(WEST_MEADOW_SWARD_RECOVERY,.76);assert.deepEqual(WEST_MEADOW_FLOWER_DRIFT,[-69,36,8,18]);assert(Object.isFrozen(WEST_MEADOW_FLOWER_DRIFT));
 assert.deepEqual(afterFields.FLOWER_DRIFTS,beforeFields.FLOWER_DRIFTS);assert.equal(afterFields.FLOWER_DRIFTS.length,11);
 for(const key of ['FIELD_RISES','FIELD_ANCHORS','MEADOW_OPENINGS'])assert.deepEqual(afterFields[key],beforeFields[key]);
 for(const key of ['pastureRise','meadowOpeningAt','inMeadowOpening','meadowGrazingAt'])functionExact(afterFields[key],beforeFields[key]);
 functionExact(afterCover.meadowBladeColor,beforeCover.meadowBladeColor);
 const changed=patch.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>l.slice(1)).join('\n').replace(/\/\/[^\n]*/g,'');
 assert(!/Math\.random|\bnew\s+|fetch\s*\(|Texture|Material|Geometry|renderer|sampler|collider|wall|dispose\s*\(/.test(changed));
 assert.equal((changed.match(/WEST_MEADOW_FLOWER_DRIFT=Object\.freeze/g)||[]).length,1);
});

test('bounded deterministic fields are bit-exact outside compact support and never reduce existing growth/bloom',()=>{
 const a=new T.Color(),b=new T.Color();let recovered=0,newFlowers=0;
 for(let x=-480;x<=480;x+=2.25)for(let z=-480;z<=480;z+=2.75){
  const s=westMeadowSwardAt(x,z),oldG=beforeCover.meadowGrowthAt(x,z),newG=afterCover.meadowGrowthAt(x,z),oldB=beforeFields.meadowBloomAt(x,z),newB=meadowBloomAt(x,z);
  assert(Number.isFinite(s)&&s>=0&&s<=1);assert(Number.isFinite(newG)&&newG>=.23*.62&&newG<=1.37);assert(newB>=oldB&&newB>=0&&newB<=1);assert(newG>=oldG-1e-15);
  assert.equal(s,westMeadowSwardAt(x,z));assert.equal(newG,afterCover.meadowGrowthAt(x,z));assert.equal(newB,meadowBloomAt(x,z));
  if(outside(x,z,growthBounds)){assert.equal(s,0);assert.equal(newG,oldG);}
  if(outside(x,z,flowerBounds))assert.equal(newB,oldB);
  if(newG>oldG+.02)recovered++;if(newB>oldB+.05)newFlowers++;
  assert.equal(afterFields.meadowGrazingAt(x,z),beforeFields.meadowGrazingAt(x,z));
  beforeCover.meadowBladeColor(a,x,z,.47);afterCover.meadowBladeColor(b,x,z,.47);assert.deepEqual(a.toArray(),b.toArray());
 }
 assert(recovered>50&&newFlowers>30,'global grid samples meaningful interiors: '+JSON.stringify({recovered,newFlowers}));
});

test('C2 weight tapers remain smooth at all compact and plateau boundaries',()=>{
 checkContinuousBoundary(westMeadowSwardAt,-54,43,22,16,.55,.06);
 checkContinuousBoundary(westMeadowSwardAt,-54,43,22,16,1.12,.06);
 checkContinuousBoundary(westFlowerAt,-69,36,8,18,.50,.18);
 checkContinuousBoundary(westFlowerAt,-69,36,8,18,1.12,.18);
 assert.equal(westMeadowSwardAt(-54,43),1);assert.equal(westFlowerAt(-69,36),1);
});

test('west recovery lifts the pale-gap sward while cultivated and distant pasture stays unchanged',()=>{
 for(const [x,z,min,max]of [[-54,43,.69,.70],[-63,38,.88,.89],[-69,36,.98,1.0]]){
  const old=beforeCover.meadowGrowthAt(x,z),next=afterCover.meadowGrowthAt(x,z);assert(next>=min&&next<=max);assert(next>old+.28);
 }
 for(const [x,z]of [[70,-50],[58,-66],[65,-145],[172,34],[-300,-320],[215,-108],[300,-300]]){
  assert.equal(westMeadowSwardAt(x,z),0);assert.equal(afterCover.meadowGrowthAt(x,z),beforeCover.meadowGrowthAt(x,z));assert.equal(meadowBloomAt(x,z),beforeFields.meadowBloomAt(x,z));
 }
 assert.equal(afterFields.meadowGrazingAt(-52,44),1);assert(meadowBloomAt(-52,44)<.05);
});

test('one elongated colony connects to the retained west margin without blanket flowers across the field',()=>{
 for(let z=24;z<=54;z+=.25){const x=-69-(z-36)*4/18;assert(westFlowerAt(x,z)>0||beforeFields.meadowBloomAt(x,z)>0);assert(meadowBloomAt(x,z)>.1,'connected support, not a uniform-density promise, at '+JSON.stringify([x,z,meadowBloomAt(x,z)]));}
 assert.equal(meadowBloomAt(-54,43),0);assert.equal(meadowBloomAt(0,0),beforeFields.meadowBloomAt(0,0));
 assert.equal(meadowBloomAt(-73,54),beforeFields.meadowBloomAt(-73,54));
 for(const [x,z]of beforeFields.FLOWER_DRIFTS)if(outside(x,z,flowerBounds))assert.equal(meadowBloomAt(x,z),beforeFields.meadowBloomAt(x,z));
});

test('all existing source grass LODs and modelled lupins have identical geometry, normals, UVs and budgets',()=>{
 functionExact(afterCover.createGrassTuftGeometry,beforeCover.createGrassTuftGeometry);functionExact(afterCover.createLupinGeometry,beforeCover.createLupinGeometry);functionExact(afterCover.createMeadowDistance,beforeCover.createMeadowDistance);
 for(const options of [{},{bladeCount:4,segments:2},{bladeCount:6,segments:2},{bladeCount:8,segments:2}]){
  const a=beforeCover.createGrassTuftGeometry(T,options),b=afterCover.createGrassTuftGeometry(T,options);assert.deepEqual(geometryReceipt(a),geometryReceipt(b));assert(a.index.count/3<=40);a.dispose();b.dispose();
 }
 const a=beforeCover.createLupinGeometry(T),b=afterCover.createLupinGeometry(T);assert.deepEqual(geometryReceipt(a),geometryReceipt(b));assert.equal(a.index.count/3,146);a.dispose();b.dispose();
});

function releaseMiddle(field){const materials=Array.isArray(field.mesh.material)?field.mesh.material:[field.mesh.material];for(const m of materials)m.dispose();field.mesh.geometry.dispose();field.mesh.removeFromParent();}
function compareMiddle(low){
 let quality=low?'low':'high';
 const config={THREE:T,canGrow:(x,z)=>z<92&&((Math.floor(x/6)+Math.floor(z/6))%7!==0),heightAt:(x,z)=>2+.006*x-.01*z+.0002*x*z,managedAt:(x,z)=>Math.hypot(x+40,z-22)<7?.8:0,low,getQuality:()=>quality};
 const a=beforeCover.createMeadowDistance({...config,scene:new T.Scene()}),b=afterCover.createMeadowDistance({...config,scene:new T.Scene()});let changed=0;
 for(const tier of low?['low']:['high','medium','low']){
  quality=tier;a.invalidate();b.invalidate();a.tick(5,-60,56);b.tick(5,-60,56);
  assert.equal(a.mesh.count,b.mesh.count);assert.equal(a.mesh.instanceMatrix.array.length,b.mesh.instanceMatrix.array.length);assert.deepEqual(a.mesh.instanceColor.array,b.mesh.instanceColor.array);
  assert.deepEqual(geometryReceipt(a.mesh.geometry),geometryReceipt(b.mesh.geometry));
  const p=a.mesh.instanceMatrix.array,q=b.mesh.instanceMatrix.array;
  for(let o=0;o<p.length;o+=16){
   const x=p[o+12],z=p[o+14];assert.equal(q[o+12],x);assert.equal(q[o+13],p[o+13]);assert.equal(q[o+14],z);assert.equal(q[o+15],p[o+15]);
   const live=Math.hypot(p[o],p[o+1],p[o+2])>0;assert.equal(Math.hypot(q[o],q[o+1],q[o+2])>0,live);
   if(outside(x,z,growthBounds)||!live)assert.deepEqual(q.slice(o,o+16),p.slice(o,o+16));
   else{
    for(let col=0;col<3;col++){const offset=o+col*4,pa=Math.hypot(p[offset],p[offset+1],p[offset+2]),qa=Math.hypot(q[offset],q[offset+1],q[offset+2]);assert(qa>=pa-1e-6);for(let c=0;c<3;c++)assert(Math.abs(p[offset+c]/pa-q[offset+c]/qa)<2e-7);}
    if(Math.abs(q[o+5]-p[o+5])>.05)changed++;
   }
  }
  const oldPose=hash(Buffer.from(p.buffer)),newPose=hash(Buffer.from(q.buffer)),colors=hash(Buffer.from(b.mesh.instanceColor.array.buffer));
  a.tick(6,110,-145);b.tick(6,110,-145);a.tick(7,-60,56);b.tick(7,-60,56);
  assert.equal(hash(Buffer.from(a.mesh.instanceMatrix.array.buffer)),oldPose);assert.equal(hash(Buffer.from(b.mesh.instanceMatrix.array.buffer)),newPose);assert.equal(hash(Buffer.from(b.mesh.instanceColor.array.buffer)),colors);
 }
 assert(changed>100,'actual middle-distance controller grows retained west instances');releaseMiddle(a);releaseMiddle(b);
}

test('actual middle-distance controller retains roots, yaw, membership, palette and repeat-travel poses in every quality tier',()=>{compareMiddle(false);compareMiddle(true);});

test('main-world placement, exclusion, seeded RNG and existing flower/fern suppression source is untouched',()=>{
 const html=readFileSync(path.join(ROOT,'ranch3d.html'),'utf8').replace('./assets/meadow-cover.js?v=west-meadow-sward-1','./assets/meadow-cover.js?v=dry-foothills-1').replace('./assets/pastoral-fields.mjs?v=west-meadow-sward-1','./assets/pastoral-fields.mjs?v=leafy-orchard-1');
 assert.equal(hash(html),'25c4f93012dd81c62ad1704b3f8276c0c021e65a93b2f887bb041f92a4cc793e');
 assert(!patch.includes('a/ranch3d.html'));assert(!patch.includes('a/assets/vegetation.js'));assert(!patch.includes('a/assets/terrain-realism.js'));
 // These unchanged production consumers demonstrate why grazing stays exact.
 assert(html.includes('meadowGrazingAt(x,z)<.75'));assert(html.includes('meadowGrazingAt(x,z)*(1-blend)'));
 assert(html.includes('if(h3>bloom||coldWoodlandWeights(x,z).weight>.08||biomeAt(x,z)!==\'meadow\'||!okClutter(x,z))continue;'));
});

const receiptPath=process.env.QA_WEST_BASELINE;
test('actual native candidate receipt preserves all grass membership and adds only the eligible connected-margin lupins',{skip:!receiptPath},()=>{
 const report=JSON.parse(readFileSync(receiptPath,'utf8'));assert.equal(report.gitHead,'1122de3072890fdf94adccabf0ea70a7d9fd898d');assert(Object.values(report.checks).every(Boolean));
 // Cross-process Node/Chromium trigonometric last-bit differences are allowed
 // only for recorded scalar values; pure before/after equality above is exact.
 const nativeScalar=(a,b)=>assert(Math.abs(a-b)<=2e-12,'native scalar '+a+' vs '+b);
 let nearChanged=0,totalAdded=0;
 for(const name of ['west-forward-high','west-reverse-high','west-side-high','west-forward-medium','west-forward-low']){
  const row=report.rows.find(r=>r.name===name);assert(row);const field=row.field;
  assert.deepEqual(field.candidateColumns,['cellX','cellZ','ordinal','rootX','rootZ','groundRootY','hashVariation','yaw','growthOrBloom','eligibility']);
  assert.deepEqual(field.eligibilityColumns,['okGrass','okClutter','biome','managed','grazing','pathDistance','trackDistance','coldWeight','winterCover','dryWeight','meadowCover','seedCover']);
  let oldCount=0,newCount=0,added=0,rejected=0,rejectedSupport=0,rejectedRecovery=0;const bounds=[Infinity,-Infinity,Infinity,-Infinity];
  for(const c of field.candidates.near){
   const [, , ,x,z,y,variation,yaw,growth,e]=c;assert([x,z,y,variation,yaw].every(Number.isFinite));
   nativeScalar(beforeCover.meadowGrowthAt(x,z),growth);nativeScalar(beforeFields.meadowGrazingAt(x,z),e[4]);nativeScalar(afterFields.meadowGrazingAt(x,z),e[4]);
   const next=afterCover.meadowGrowthAt(x,z);if(westMeadowSwardAt(x,z)===0)nativeScalar(next,growth);
   // No eligibility depends on the growth-only recovery; retained rows remain
   // the exact original roots/yaw/hash. Native after must validate actual buffers.
   if(e[0]&&next>growth+.02)nearChanged++;
  }
  for(const c of field.candidates.lupin){
   const [, , ,x,z,y,h3,yaw,bloom,e]=c;nativeScalar(beforeFields.meadowBloomAt(x,z),bloom);nativeScalar(coyoteCoverDryWeight(x,z),e[9]);
   const next=meadowBloomAt(x,z),eligible=e[7]<=.08&&e[2]==='meadow'&&!!e[1],dry=(1-e[9]*.95)*.82,was=eligible&&h3<=bloom*dry,now=eligible&&h3<=next*dry;
   oldCount+=+was;newCount+=+now;assert(!was||now,'no old flower removed');
   if(!was&&now){assert(next>bloom);assert(!outside(x,z,flowerBounds));assert(e[1]&&e[2]==='meadow'&&e[7]<=.08);assert([y,yaw].every(Number.isFinite));added++;bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.max(bounds[1],x);bounds[2]=Math.min(bounds[2],z);bounds[3]=Math.max(bounds[3],z);}
   if(h3<=next*dry&&!eligible)rejected++;if(next>0&&!eligible)rejectedSupport++;if(next>bloom&&!eligible)rejectedRecovery++;
  }
  assert(newCount>oldCount);assert(added>0);totalAdded+=added;
  if(name==='west-forward-high'){
   assert.equal(oldCount,195);assert.equal(newCount,306);assert.equal(added,111);assert.equal(rejected,121);assert.equal(rejectedSupport,356,'positive-support exclusions: '+JSON.stringify({rejected,rejectedSupport,rejectedRecovery}));
   assert(Math.abs(bounds[0]+76.0514)<.0001);assert(Math.abs(bounds[1]+62.6074)<.0001);assert(Math.abs(bounds[2]-23.3558)<.0001);assert(Math.abs(bounds[3]-50.1982)<.0001);
  }
  if(name==='west-reverse-high')assert.equal(added,111);
  if(name==='west-side-high'){assert.equal(oldCount,174);assert.equal(newCount,285);}
 }
 assert(nearChanged>1000&&totalAdded>400);
});
