const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/fieldstone-wall-a78ed79/contract.json')));
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
// These already-reviewed exact import guards are the only compatibility
// projection. Pin their complete bodies; no version-stripping regexp is used.
for(const [file,hash]of Object.entries(contract.dependencySHA256))assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),hash,'Exact prior cache/camera projection guard '+file);
const {normalizePublishedCacheSource}=require('./published-world-import-source-guard.cjs');
const {normalizeAuthoredCameraSource}=require('./authored-camera-source-guard.cjs');
function normalizeFieldstoneWallCacheSource(source,file){
 const row=contract.files[file];if(!row)return source;
 // Undo only the reviewed optional lifecycle-owner call before its unchanged
 // cache edge and the complete original a78 route-owner body are checked.
 for(const c of (row.ownerSourceChanges||[]).toReversed()){
  const count=literal=>source.split(literal).length-1;
  if(source.includes(c.after)){
   assert.equal(count(c.after),1,'Exactly one approved fieldstone lifecycle owner call '+file);
   assert.equal(count(c.before),0,'No mixed original/lifecycle owner calls '+file);
   source=source.replace(c.after,c.before);
  }else assert.equal(count(c.before),1,'Exact original or approved fieldstone lifecycle owner call '+file);
 }
 const c=row.change,values=[...new Set([c.before,c.after,...row.compatibilityAliases])];
 const counts=values.map(value=>({value,count:source.split(value).length-1}));
 assert.equal(counts.reduce((sum,row)=>sum+row.count,0),1,'Exactly one original or reviewed fieldstone owner import '+file);
 const found=counts.find(row=>row.count===1).value;
 if(found===c.after)source=source.replace(c.after,c.before);
 const projected=normalizeAuthoredCameraSource(normalizePublishedCacheSource(source,file),file);
 assert.equal(sha(projected),row.priorPublishedCameraProjectionSHA256,'Entire a78 fieldstone import owner restored with exact prior published/camera imports '+file);
 return source;
}
module.exports={normalizeFieldstoneWallCacheSource};
